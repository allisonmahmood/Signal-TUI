import { useState, useEffect, useRef, useCallback } from "react";
import { useApp, useInput } from "ink";
import { join } from "node:path";
import { homedir } from "node:os";
import Layout from "./components/Layout.tsx";
import { SignalClient } from "../core/SignalClient.ts";
import { findSignalCliPath, getConfigInstructions } from "../core/Config.ts";
import type { LinkStatus } from "./components/Onboarding.tsx";
import type { ConnectionStatus } from "./components/StatusBar.tsx";
import type { Account, Conversation, SignalEnvelope, ChatMessage, Attachment } from "../types/types.ts";
import { MessageStorage } from "../core/MessageStorage.ts";
import { normalizeNumber } from "../utils/phone.ts";
import { generateAsciiArt } from "../utils/asciiArt.ts";
import { getNextFocusArea, type FocusArea } from "./state/navigation.ts";
import { ASCII_ART_WIDTH, ASCII_ART_HEIGHT } from "./constants.ts";

// Get signal-cli's attachment storage directory
function getSignalCliAttachmentsDir(): string {
  const xdgDataHome = process.env.XDG_DATA_HOME;
  if (xdgDataHome) {
    return join(xdgDataHome, "signal-cli", "attachments");
  }
  return join(homedir(), ".local", "share", "signal-cli", "attachments");
}

// Process attachments and generate ASCII art for images
async function processAttachments(
  rawAttachments: Attachment[],
  signalCliDir: string
): Promise<Attachment[]> {
  return Promise.all(rawAttachments.map(async att => {
    const localPath = att.id ? join(signalCliDir, att.id) : undefined;
    let asciiArt: string | undefined;
    if (att.contentType?.startsWith("image/") && localPath) {
      asciiArt = await generateAsciiArt(localPath, ASCII_ART_WIDTH, ASCII_ART_HEIGHT);
    }
    return {
      ...att,
      localPath,
      downloadStatus: "completed" as const,
      asciiArt,
    };
  }));
}

// Async debug logging - only active when DEBUG=true
const DEBUG = process.env.DEBUG === "true";
const debugLog = DEBUG
  ? (msg: string) => Bun.write(Bun.file("debug.log"), msg + "\n")
  : () => {};

export type ViewState = "loading" | "onboarding" | "chat";

export default function App() {
  const { exit } = useApp();
  const [currentView, setCurrentView] = useState<ViewState>("loading");
  const [linkUri, setLinkUri] = useState<string | null>(null);
  const [linkStatus, setLinkStatus] = useState<LinkStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [client, setClient] = useState<SignalClient | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const storageRef = useRef<MessageStorage>(new MessageStorage());
  const [storageReady, setStorageReady] = useState(false);
  const [focusArea, setFocusArea] = useState<FocusArea>("sidebar");
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");

  // Track if we're intentionally stopping (for graceful shutdown)
  const isStoppingRef = useRef(false);

  // Message processing queue to ensure ordered processing of async handlers
  const messageQueueRef = useRef<SignalEnvelope[]>([]);
  const processingRef = useRef(false);

  // Cycle focus to next area
  const cycleFocus = useCallback(() => {
    setFocusArea(prev => getNextFocusArea(prev));
  }, []);

  // Handle keyboard input for global shortcuts - disabled when typing
  useInput((input, key) => {
    // Tab to cycle focus: sidebar -> chat -> input -> sidebar
    if (key.tab && currentView === "chat") {
      cycleFocus();
      return;
    }

    // q to quit (when not in input mode)
    if (input === "q") {
      exit();
      return;
    }

    // Ctrl+L to link a new device
    if (currentView === "chat" && input.toLowerCase() === "l" && key.ctrl) {
      startLinkingProcess();
    }
  }, { isActive: focusArea !== "input" });

  // Memoized callback for selecting a conversation - auto-focuses input
  const handleSelectConversation = useCallback((conv: Conversation) => {
    setSelectedConversation(conv);
    setFocusArea("input");
  }, []);

  const startLinkingProcess = async () => {
    if (!client) return;

    setCurrentView("onboarding");
    setLinkStatus("loading");
    setLinkUri(null);
    setErrorMessage(undefined);

    try {
      // Get the device link URI
      const uri = await client.getLinkUri();
      setLinkUri(uri);
      setLinkStatus("waiting");

      // Wait for user to scan QR code
      await client.finishLink(uri, "Signal TUI");

      // Linking successful!
      setLinkStatus("success");

      // Refresh accounts list
      const updatedAccounts = await client.listAccounts();
      setAccounts(updatedAccounts);

      // Transition to chat view after a brief delay
      setTimeout(() => {
        setCurrentView("chat");
      }, 1500);

    } catch (error) {
      // Ignore errors if we're intentionally stopping
      if (isStoppingRef.current) return;
      
      debugLog(`[App] Linking error: ${error}`);
      setLinkStatus("error");
      setErrorMessage(
        error instanceof Error ? error.message : "Unknown error occurred"
      );
    }
  };

  // Initialize SignalClient and check for existing accounts
  useEffect(() => {
    debugLog("[App] Mounting...");

    // Find signal-cli path
    const signalCliPath = findSignalCliPath();
    if (!signalCliPath) {
      setCurrentView("onboarding");
      setLinkStatus("error");
      setErrorMessage(getConfigInstructions());
      return;
    }

    const signalClient = new SignalClient({
      signalCliPath,
      requestTimeout: 120000, // 2 minutes for linking timeout
    });

    setClient(signalClient);
    isStoppingRef.current = false;

    const initialize = async () => {
      try {
        // Start signal-cli
        await signalClient.start();

        // Check for existing accounts
        const existingAccounts = await signalClient.listAccounts();
        setAccounts(existingAccounts);

        if (existingAccounts.length > 0) {
          // Already have linked accounts, go straight to chat
          setCurrentView("chat");
        } else {
          // No accounts, start the linking process
          setCurrentView("onboarding");
          
          // Get the device link URI
          const uri = await signalClient.getLinkUri();
          setLinkUri(uri);
          setLinkStatus("waiting");

          // Wait for user to scan QR code
          await signalClient.finishLink(uri, "Signal TUI");

          // Linking successful!
          setLinkStatus("success");

          // Refresh accounts
          const updatedAccounts = await signalClient.listAccounts();
          setAccounts(updatedAccounts);

          // Transition to chat view after a brief delay
          setTimeout(() => {
            setCurrentView("chat");
          }, 1500);
        }

      } catch (error) {
        // Ignore errors if we're intentionally stopping
        if (isStoppingRef.current) return;
        
        debugLog(`[App] Initialization error: ${error}`);
        setLinkStatus("error");
        setErrorMessage(
          error instanceof Error ? error.message : "Unknown error occurred"
        );
      }
    };

    // Listen for ready event (connected)
    signalClient.on("ready", () => {
      setConnectionStatus("connected");
    });

    // Listen for errors
    signalClient.on("error", (error) => {
      // Ignore errors during shutdown
      if (isStoppingRef.current) return;

      debugLog(`[App] SignalClient error: ${error.message}`);
      setConnectionStatus("reconnecting");
      setLinkStatus("error");
      setErrorMessage(error.message);
    });

    // Process a single envelope (called from queue)
    const handleEnvelope = async (envelope: SignalEnvelope) => {
      let conversationId: string | null = null;
      let newMessage: ChatMessage | null = null;
      let attachments: Attachment[] = [];
      const signalCliDir = getSignalCliAttachmentsDir();

      debugLog(`[App] Received envelope: ${JSON.stringify(envelope)}`);

      // Extract attachments from dataMessage
      if (envelope.dataMessage?.attachments && envelope.dataMessage.attachments.length > 0) {
        attachments = await processAttachments(envelope.dataMessage.attachments, signalCliDir);
      }

      // Check if we have a message or attachments to process
      const hasContent = envelope.dataMessage?.message || attachments.length > 0;
      const hasSyncContent = envelope.syncMessage?.sentMessage?.message ||
        (envelope.syncMessage?.sentMessage?.attachments?.length ?? 0) > 0;

      if (hasContent && envelope.dataMessage) {
        // Incoming Message
        if (envelope.dataMessage.groupInfo) {
           conversationId = envelope.dataMessage.groupInfo.groupId;
        } else {
           conversationId = normalizeNumber(envelope.sourceNumber || envelope.sourceUuid);
        }

        newMessage = {
          id: envelope.timestamp.toString(),
          sender: envelope.sourceNumber || envelope.sourceUuid || "Unknown",
          senderName: envelope.sourceName,
          content: envelope.dataMessage.message || "",
          timestamp: envelope.timestamp,
          isOutgoing: false,
          attachments: attachments.length > 0 ? attachments : undefined,
        };
      } else if (hasSyncContent && envelope.syncMessage?.sentMessage) {
        // Outgoing Sync Message - extract attachments from sync message too
        const syncAttachments = envelope.syncMessage.sentMessage.attachments;
        if (syncAttachments && syncAttachments.length > 0) {
          attachments = await processAttachments(syncAttachments, signalCliDir);
        }

        if (envelope.syncMessage.sentMessage.groupInfo) {
           conversationId = envelope.syncMessage.sentMessage.groupInfo.groupId;
        } else {
           conversationId = normalizeNumber(envelope.syncMessage.sentMessage.destinationNumber ||
                                          envelope.syncMessage.sentMessage.destinationUuid);
        }

        newMessage = {
          id: envelope.timestamp.toString(),
          sender: "Me",
          content: envelope.syncMessage.sentMessage.message || "",
          timestamp: envelope.timestamp,
          isOutgoing: true,
          attachments: attachments.length > 0 ? attachments : undefined,
        };
      }

      if (conversationId && newMessage && storageRef.current) {
         debugLog(`[App] Saving to DB: ${conversationId} ${newMessage.id} attachments=${newMessage.attachments?.length || 0}`);
         storageRef.current.addMessage(newMessage, conversationId);
      } else {
         debugLog(`[App] NOT saving: conversationId=${conversationId}, hasMessage=${!!newMessage}, hasStorage=${!!storageRef.current}`);
      }
    };

    // Process messages from queue sequentially to ensure ordering
    const processMessageQueue = async () => {
      if (processingRef.current) return;
      processingRef.current = true;

      while (messageQueueRef.current.length > 0) {
        const envelope = messageQueueRef.current.shift()!;
        try {
          await handleEnvelope(envelope);
        } catch (error) {
          debugLog(`[App] Error processing envelope: ${error}`);
        }
      }

      processingRef.current = false;
    };

    // Queue incoming messages for sequential processing
    const queueMessage = (envelope: SignalEnvelope) => {
      messageQueueRef.current.push(envelope);
      processMessageQueue();
    };

    signalClient.on("message", queueMessage);
    signalClient.on("sync", queueMessage);

    // Listen for receipt events to update message status
    signalClient.on("receipt", (envelope: SignalEnvelope) => {
      if (!envelope.receiptMessage || !storageRef.current) return;

      const { type, timestamps } = envelope.receiptMessage;

      // Map receipt type to status (highest wins for groups)
      const status = type === "READ" || type === "VIEWED" ? "read" : "delivered";

      // Update status for each message timestamp
      for (const timestamp of timestamps) {
        storageRef.current.updateMessageStatus(timestamp, status);
      }
    });

    // Listen for process close
    signalClient.on("close", (code) => {
      // Ignore close events during intentional shutdown
      if (isStoppingRef.current) return;

      setConnectionStatus("disconnected");
      if (code !== 0) {
        setLinkStatus(prev => prev === "success" ? prev : "error");
        setErrorMessage(`signal-cli exited with code ${code}`);
      }
    });

    // Initialize Storage
    storageRef.current.init().then(() => {
        setStorageReady(true);
    });

    initialize();

    // Cleanup on unmount
    return () => {
      isStoppingRef.current = true;
      signalClient.stop();
    };
  }, []);

  return (
    <Layout
      currentView={currentView}
      linkUri={linkUri}
      linkStatus={linkStatus}
      errorMessage={errorMessage}
      accounts={accounts}
      client={client}
      selectedConversation={selectedConversation}
      onSelectConversation={handleSelectConversation}
      storage={storageReady ? storageRef.current : undefined}
      focusArea={focusArea}
      cycleFocus={cycleFocus}
      connectionStatus={connectionStatus}
    />
  );
}
