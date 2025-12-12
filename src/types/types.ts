/**
 * JSON-RPC 2.0 Types
 */
export interface JsonRpcRequest {
  jsonrpc: "2.0";
  method: string;
  params?: Record<string, unknown>;
  id: number;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  result?: unknown;
  error?: JsonRpcError;
  id: number | null;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

/**
 * Signal Message Types
 */
export interface SignalEnvelope {
  source?: string;
  sourceNumber?: string;
  sourceUuid?: string;
  sourceName?: string;
  sourceDevice?: number;
  timestamp: number;
  dataMessage?: DataMessage;
  syncMessage?: SyncMessage;
  receiptMessage?: ReceiptMessage;
  typingMessage?: TypingMessage;
}

export interface DataMessage {
  timestamp: number;
  message?: string;
  expiresInSeconds?: number;
  viewOnce?: boolean;
  groupInfo?: GroupInfo;
  quote?: QuoteMessage;
  mentions?: Mention[];
  attachments?: Attachment[];
}

export interface SyncMessage {
  sentMessage?: {
    destination?: string;
    destinationNumber?: string;
    destinationUuid?: string;
    timestamp: number;
    message?: string;
    expiresInSeconds?: number;
    groupInfo?: GroupInfo;
  };
  readMessages?: ReadMessage[];
}

export interface ReceiptMessage {
  type: "DELIVERY" | "READ" | "VIEWED";
  timestamps: number[];
}

export interface TypingMessage {
  action: "STARTED" | "STOPPED";
  timestamp: number;
  groupId?: string;
}

export interface GroupInfo {
  groupId: string;
  type?: string;
}

export interface QuoteMessage {
  id: number;
  author?: string;
  authorNumber?: string;
  authorUuid?: string;
  text?: string;
}

export interface Mention {
  start: number;
  length: number;
  uuid?: string;
  number?: string;
}

export interface Attachment {
  contentType: string;
  filename?: string;
  id?: string;
  size?: number;
  width?: number;
  height?: number;
  caption?: string;
}

export interface ReadMessage {
  sender?: string;
  senderNumber?: string;
  senderUuid?: string;
  timestamp: number;
}

/**
 * Signal Client Events
 */
export interface SignalClientEvents {
  message: (envelope: SignalEnvelope) => void;
  receipt: (envelope: SignalEnvelope) => void;
  typing: (envelope: SignalEnvelope) => void;
  sync: (envelope: SignalEnvelope) => void;
  error: (error: Error) => void;
  close: (code: number | null) => void;
  ready: () => void;
}

/**
 * Signal Client Options
 */
export interface SignalClientOptions {
  signalCliPath?: string;
  requestTimeout?: number;
  account?: string; // Phone number to use if multiple accounts
}

/**
 * Version Response
 */
export interface VersionResponse {
  name: string;
  version: string;
}
