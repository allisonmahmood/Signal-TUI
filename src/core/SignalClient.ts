import type { Subprocess } from "bun";
import { EventEmitter } from "events";
import { appendFileSync } from "node:fs";
import type {
  JsonRpcRequest,
  JsonRpcResponse,
  SignalEnvelope,
  SignalClientEvents,
  SignalClientOptions,
  StartLinkResponse,
  FinishLinkResponse,
  Account,
  Contact,
  Group,
} from "../types/types";

const DEFAULT_SIGNAL_CLI_PATH = "/opt/homebrew/bin/signal-cli";
const DEFAULT_REQUEST_TIMEOUT = 30000; // 30 seconds

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

/**
 * SignalClient - A wrapper around signal-cli's JSON-RPC mode
 * 
 * This class spawns signal-cli as a child process and communicates
 * with it via JSON-RPC over stdin/stdout.
 * 
 * @example
 * ```typescript
 * const client = new SignalClient();
 * await client.start();
 * 
 * client.on('message', (envelope) => {
 *   console.log('New message:', envelope.dataMessage?.message);
 * });
 * 
 * const version = await client.sendRequest('version');
 * console.log('Version:', version);
 * ```
 */
export class SignalClient extends EventEmitter {
  private process: Subprocess<"pipe", "pipe", "pipe"> | null = null;
  private requestId: number = 0;
  private pendingRequests: Map<number, PendingRequest> = new Map();
  private buffer: string = "";
  private isRunning: boolean = false;

  private readonly signalCliPath: string;
  private readonly requestTimeout: number;
  private readonly account?: string;

  constructor(options: SignalClientOptions = {}) {
    super();
    this.signalCliPath = options.signalCliPath ?? DEFAULT_SIGNAL_CLI_PATH;
    this.requestTimeout = options.requestTimeout ?? DEFAULT_REQUEST_TIMEOUT;
    this.account = options.account;
  }

  /**
   * Start the signal-cli process in JSON-RPC mode
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error("SignalClient is already running");
    }

    const args = ["--output=json", "jsonRpc"];
    if (this.account) {
      args.unshift("-a", this.account);
    }

    try {
      this.process = Bun.spawn([this.signalCliPath, ...args], {
        stdin: "pipe",
        stdout: "pipe",
        stderr: "pipe",
      });

      this.isRunning = true;
      this.startReadingStdout();
      this.startReadingStderr();
      this.monitorProcess();

      // Give the process a moment to start
      await new Promise((resolve) => setTimeout(resolve, 500));
      
      this.emit("ready");
    } catch (error) {
      this.isRunning = false;
      throw new Error(
        `Failed to start signal-cli: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Stop the signal-cli process
   */
  stop(): void {
    if (this.process) {
      // Reject all pending requests
      for (const [id, pending] of this.pendingRequests) {
        clearTimeout(pending.timeout);
        pending.reject(new Error("SignalClient stopped"));
        this.pendingRequests.delete(id);
      }

      this.process.kill();
      this.process = null;
      this.isRunning = false;
      this.buffer = "";
    }
  }

  /**
   * Send a JSON-RPC request to signal-cli
   * 
   * @param method - The JSON-RPC method to call
   * @param params - Optional parameters for the method
   * @returns Promise that resolves with the result
   */
  sendRequest<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.process || !this.isRunning) {
        reject(new Error("SignalClient is not running"));
        return;
      }

      const id = ++this.requestId;
      const request: JsonRpcRequest = {
        jsonrpc: "2.0",
        method,
        id,
      };

      if (params !== undefined) {
        request.params = params;
      }

      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request ${method} timed out after ${this.requestTimeout}ms`));
      }, this.requestTimeout);

      this.pendingRequests.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timeout,
      });

      const requestString = JSON.stringify(request) + "\n";
      
      try {
        this.process.stdin.write(requestString);
      } catch (error) {
        clearTimeout(timeout);
        this.pendingRequests.delete(id);
        reject(new Error(`Failed to send request: ${error instanceof Error ? error.message : String(error)}`));
      }
    });
  }

  /**
   * Check if the client is currently running
   */
  get running(): boolean {
    return this.isRunning;
  }

  /**
   * Start the device linking process and get the URI to display as QR code
   * 
   * @returns Promise that resolves with the device link URI (sgnl://linkdevice?...)
   */
  async getLinkUri(): Promise<string> {
    const response = await this.sendRequest<StartLinkResponse>("startLink");
    return response.deviceLinkUri;
  }

  /**
   * Complete the device linking process
   * Waits for the user to scan the QR code on their phone
   * 
   * @param deviceLinkUri - The URI returned by getLinkUri()
   * @param deviceName - Optional name for the linked device
   * @returns Promise that resolves when linking is complete
   */
  async finishLink(deviceLinkUri: string, deviceName?: string): Promise<FinishLinkResponse> {
    const params: Record<string, unknown> = { deviceLinkUri };
    if (deviceName) {
      params.deviceName = deviceName;
    }
    
    const response = await this.sendRequest<FinishLinkResponse>("finishLink", params);
    this.emit("linkSuccess", response);
    return response;
  }

  /**
   * List all registered local accounts
   * 
   * @returns Promise that resolves with array of accounts
   */
  async listAccounts(): Promise<Account[]> {
    const response = await this.sendRequest<Account[]>("listAccounts");
    return response ?? [];
  }

  /**
   * List all known contacts
   */
  async listContacts(): Promise<Contact[]> {
    const response = await this.sendRequest<Contact[]>("listContacts");
    return response ?? [];
  }

  /**
   * List all known groups
   */
  async listGroups(): Promise<Group[]> {
    const response = await this.sendRequest<Group[]>("listGroups");
    return response ?? [];
  }

  /**
   * Send a message to a recipient
   * @param recipient - Phone number, UUID, or group ID
   * @param message - The message text
   * @param isGroup - Whether this is a group message
   */
  async sendMessage(recipient: string, message: string, isGroup: boolean = false): Promise<void> {
    const params: Record<string, unknown> = { message };
    if (isGroup) {
      params.groupId = recipient;
    } else {
      params.recipient = [recipient];
    }
    await this.sendRequest("send", params);
  }

  /**
   * Read stdout line by line and parse JSON responses
   */
  private async startReadingStdout(): Promise<void> {
    if (!this.process?.stdout) return;

    const reader = this.process.stdout.getReader();
    const decoder = new TextDecoder();

    try {
      while (this.isRunning) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        this.buffer += chunk;
        this.processBuffer();
      }
    } catch (error) {
      if (this.isRunning) {
        this.emit("error", new Error(`Stdout read error: ${error instanceof Error ? error.message : String(error)}`));
      }
    }
  }

  /**
   * Read stderr for error messages
   */
  private async startReadingStderr(): Promise<void> {
    if (!this.process?.stderr) return;

    const reader = this.process.stderr.getReader();
    const decoder = new TextDecoder();

    try {
      while (this.isRunning) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        // Log stderr but don't treat it as fatal - signal-cli logs info to stderr
        if (text.trim()) {
          console.error("[signal-cli stderr]:", text.trim());
        }
      }
    } catch (error) {
      // Stderr read errors are non-fatal
    }
  }

  /**
   * Monitor the process for exit
   */
  private async monitorProcess(): Promise<void> {
    if (!this.process) return;

    try {
      const exitCode = await this.process.exited;
      this.isRunning = false;
      
      // Reject all pending requests
      for (const [id, pending] of this.pendingRequests) {
        clearTimeout(pending.timeout);
        pending.reject(new Error(`signal-cli exited with code ${exitCode}`));
        this.pendingRequests.delete(id);
      }

      this.emit("close", exitCode);
    } catch (error) {
      this.emit("error", new Error(`Process monitor error: ${error instanceof Error ? error.message : String(error)}`));
    }
  }

  /**
   * Process the buffer looking for complete JSON lines
   */
  private processBuffer(): void {
    const lines = this.buffer.split("\n");
    
    // Keep the last incomplete line in the buffer
    this.buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const json = JSON.parse(line);
        this.handleJsonMessage(json);
      } catch (error) {
        // Log parse errors but don't crash
        console.error("[SignalClient] Failed to parse JSON:", line);
      }
    }
  }

  /**
   * Handle a parsed JSON message from signal-cli
   */
  private handleJsonMessage(json: unknown): void {
    // Check if it's a JSON-RPC response (has 'id' field that's not null)
    if (this.isJsonRpcResponse(json)) {
      this.handleResponse(json);
      return;
    }

    // Otherwise it's an incoming event (message, receipt, etc.)
    if (this.isSignalEnvelope(json)) {
      this.handleEnvelope(json);
      return;
    }

    // Handle wrapped envelope format { envelope: ... }
    if (typeof json === "object" && json !== null && "envelope" in json) {
      const wrapped = json as { envelope: SignalEnvelope };
      this.handleEnvelope(wrapped.envelope);
      return;
    }

    // Handle JSON-RPC notification (method: "receive")
    // Format: { "jsonrpc": "2.0", "method": "receive", "params": { "envelope": ... } }
    if (
      typeof json === "object" && 
      json !== null && 
      "method" in json && 
      (json as any).method === "receive" &&
      "params" in json
    ) {
      const params = (json as any).params;
      if (params && "envelope" in params) {
        this.handleEnvelope(params.envelope);
        return;
      }
    }
  }

  /**
   * Handle a JSON-RPC response
   */
  private handleResponse(response: JsonRpcResponse): void {
    if (response.id === null) return;

    const pending = this.pendingRequests.get(response.id);
    if (!pending) return;

    clearTimeout(pending.timeout);
    this.pendingRequests.delete(response.id);

    if (response.error) {
      pending.reject(new Error(`${response.error.message} (code: ${response.error.code})`));
    } else {
      pending.resolve(response.result);
    }
  }

  /**
   * Handle an incoming Signal envelope
   */
  private handleEnvelope(envelope: SignalEnvelope): void {
    if (envelope.receiptMessage) {
      this.emit("receipt", envelope);
    } else if (envelope.typingMessage) {
      this.emit("typing", envelope);
    } else if (envelope.syncMessage) {
      this.emit("sync", envelope);
    } else if (envelope.dataMessage) {
      this.emit("message", envelope);
    } else {
      // Generic message event for other envelope types
      this.emit("message", envelope);
    }
  }

  /**
   * Type guard for JSON-RPC response
   */
  private isJsonRpcResponse(json: unknown): json is JsonRpcResponse {
    return (
      typeof json === "object" &&
      json !== null &&
      "jsonrpc" in json &&
      (json as JsonRpcResponse).jsonrpc === "2.0" &&
      "id" in json &&
      (json as JsonRpcResponse).id !== null
    );
  }

  /**
   * Type guard for Signal envelope
   */
  private isSignalEnvelope(json: unknown): json is SignalEnvelope {
    return (
      typeof json === "object" &&
      json !== null &&
      "timestamp" in json &&
      typeof (json as SignalEnvelope).timestamp === "number"
    );
  }
}

// Type-safe event emitter overloads
export interface SignalClient {
  on<K extends keyof SignalClientEvents>(event: K, listener: SignalClientEvents[K]): this;
  emit<K extends keyof SignalClientEvents>(event: K, ...args: Parameters<SignalClientEvents[K]>): boolean;
  off<K extends keyof SignalClientEvents>(event: K, listener: SignalClientEvents[K]): this;
  once<K extends keyof SignalClientEvents>(event: K, listener: SignalClientEvents[K]): this;
}
