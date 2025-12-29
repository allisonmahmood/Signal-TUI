import { useState, useEffect, useRef, useCallback } from "react";
import { useApp, useInput } from "ink";
import Layout from "./components/Layout.tsx";
import { SignalClient } from "../core/SignalClient.ts";
import { findSignalCliPath, getConfigInstructions } from "../core/Config.ts";
import type { LinkStatus } from "./components/Onboarding.tsx";
import type { Account, Conversation, SignalEnvelope, ChatMessage } from "../types/types.ts";
import { MessageStorage } from "../core/MessageStorage.ts";
import { normalizeNumber } from "../utils/phone.ts";

// Async debug logging - only active when DEBUG=true
const DEBUG = process.env.DEBUG === "true";
const debugLog = DEBUG
  ? (msg: string) => Bun.write(Bun.file("debug.log"), msg + "\n")
  : () => {};

export type ViewState = "loading" | "onboarding" | "chat";
export type FocusArea = "sidebar" | "chat" | "input";

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

  // Track if we're intentionally stopping (for graceful shutdown)
  const isStoppingRef = useRef(false);

  // Cycle focus to next area
  const cycleFocus = useCallback(() => {
    setFocusArea(prev => {
      if (prev === "sidebar") return "chat";
      if (prev === "chat") return "input";
      return "sidebar";
    });
  }, []);

  // Handle keyboard input for global shortcuts - disabled when typing
  useInput((input, key) => {
    // Tab to cycle focus: sidebar -> chat -> input -> sidebar
    if (key.tab && currentView === "chat") {
      cycleFocus();
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
    debugLog(`[App] Mounting... storedReady=${storageReady}`);

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

    // Listen for errors
    signalClient.on("error", (error) => {
      // Ignore errors during shutdown
      if (isStoppingRef.current) return;
      
      debugLog(`[App] SignalClient error: ${error.message}`);
      setLinkStatus("error");
      setErrorMessage(error.message);
    });

    // Listen for messages to persist them
    const handleEnvelope = (envelope: SignalEnvelope) => {
      // Determine conversation ID
      let conversationId: string | null = null;
      let newMessage: ChatMessage | null = null;

      debugLog(`[App] Received envelope: ${JSON.stringify(envelope)}`);

      if (envelope.dataMessage?.message) {
        // Incoming Message
        if (envelope.dataMessage.groupInfo) {
           // Group Message: Conversation ID is the GROUP ID
           conversationId = envelope.dataMessage.groupInfo.groupId;
        } else {
           // Direct Message: Conversation ID is the SENDER
           conversationId = normalizeNumber(envelope.sourceNumber || envelope.sourceUuid);
        }
        
        newMessage = {
          id: envelope.timestamp.toString(),
          sender: envelope.sourceNumber || envelope.sourceUuid || "Unknown",
          senderName: envelope.sourceName,
          content: envelope.dataMessage.message,
          timestamp: envelope.timestamp,
          isOutgoing: false,
        };
      } else if (envelope.syncMessage?.sentMessage?.message) {
        // Outgoing Sync Message
        if (envelope.syncMessage.sentMessage.groupInfo) {
           // Group Message: Conversation ID is the GROUP ID
           conversationId = envelope.syncMessage.sentMessage.groupInfo.groupId;
        } else {
           // Direct Message: Conversation ID is the DESTINATION
           conversationId = normalizeNumber(envelope.syncMessage.sentMessage.destinationNumber || 
                                          envelope.syncMessage.sentMessage.destinationUuid);
        }
        
        newMessage = {
          id: envelope.timestamp.toString(),
          sender: "Me",
          content: envelope.syncMessage.sentMessage.message,
          timestamp: envelope.timestamp,
          isOutgoing: true,
        };
      }

      if (conversationId && newMessage && storageRef.current) {
         debugLog(`[App] Saving to DB: ${conversationId} ${newMessage.id}`);
         storageRef.current.addMessage(newMessage, conversationId);
      } else {
         debugLog(`[App] NOT saving: conversationId=${conversationId}, hasMessage=${!!newMessage}, hasStorage=${!!storageRef.current}`);
      }
    };

    signalClient.on("message", handleEnvelope);
    signalClient.on("sync", handleEnvelope);

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
      
      if (code !== 0 && linkStatus !== "success") {
        setLinkStatus("error");
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
      onLinkNewDevice={startLinkingProcess}
      client={client}
      selectedConversation={selectedConversation}
      onSelectConversation={handleSelectConversation}
      storage={storageReady ? storageRef.current : undefined}
      focusArea={focusArea}
      setFocusArea={setFocusArea}
      cycleFocus={cycleFocus}
    />
  );
}
