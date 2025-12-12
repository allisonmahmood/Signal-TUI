import { useState, useEffect, useRef } from "react";
import { Box, useApp, useInput } from "ink";
import Layout from "./components/Layout.tsx";
import { SignalClient } from "../core/SignalClient.ts";
import type { LinkStatus } from "./components/Onboarding.tsx";
import type { Account, Conversation, SignalEnvelope, ChatMessage } from "../types/types.ts";
import { appendFileSync } from "node:fs";
import { MessageStorage } from "../core/MessageStorage.ts";
import { normalizeNumber } from "../utils/phone.ts";

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
  
  // Track if we're intentionally stopping (for graceful shutdown)
  const isStoppingRef = useRef(false);

  // Handle keyboard input for linking new device and Global Shortcuts
  useInput((input, key) => {
    // Ctrl+C Graceful Exit
    if (key.ctrl && input.toLowerCase() === "c") {
        isStoppingRef.current = true;
        if (client) {
            client.stop();
        }
        exit();
        return;
    }

    if (currentView === "chat" && input.toLowerCase() === "l" && key.ctrl) {
      // Ctrl+L to link a new device
      startLinkingProcess();
    }
  });

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
      
      console.error("Linking error:", error);
      setLinkStatus("error");
      setErrorMessage(
        error instanceof Error ? error.message : "Unknown error occurred"
      );
    }
  };

  // Initialize SignalClient and check for existing accounts
  useEffect(() => {
    try {
        appendFileSync("debug.log", `[App] Mounting... storedReady=${storageReady}\n`);
    } catch(e) {}

    const signalClient = new SignalClient({
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
        
        console.error("Initialization error:", error);
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
      
      console.error("SignalClient error:", error);
      setLinkStatus("error");
      setErrorMessage(error.message);
    });

    // Listen for messages to persist them
    const handleEnvelope = (envelope: SignalEnvelope) => {
      // Determine conversation ID
      let conversationId: string | null = null;
      let newMessage: ChatMessage | null = null;

      try {
        appendFileSync("debug.log", `[App] Received envelope: ${JSON.stringify(envelope)}\n`);
      } catch (e) {}

      if (envelope.dataMessage?.message) {
        // Incoming Message: Conversation ID is the SENDER
        conversationId = normalizeNumber(envelope.sourceNumber || envelope.sourceUuid);
        
        newMessage = {
          id: envelope.timestamp.toString(),
          sender: envelope.sourceNumber || envelope.sourceUuid || "Unknown",
          senderName: envelope.sourceName,
          content: envelope.dataMessage.message,
          timestamp: envelope.timestamp,
          isOutgoing: false,
        };
      } else if (envelope.syncMessage?.sentMessage?.message) {
        // Outgoing Sync Message: Conversation ID is the DESTINATION
        conversationId = normalizeNumber(envelope.syncMessage.sentMessage.destinationNumber || 
                                       envelope.syncMessage.sentMessage.destinationUuid);
        
        newMessage = {
          id: envelope.timestamp.toString(),
          sender: "Me",
          content: envelope.syncMessage.sentMessage.message,
          timestamp: envelope.timestamp,
          isOutgoing: true,
        };
      }

      if (conversationId && newMessage && storageRef.current) {
         try {
             appendFileSync("debug.log", `[App] Saving to DB: ${conversationId} ${newMessage.id}\n`);
         } catch (e) {}
         storageRef.current.addMessage(newMessage, conversationId);
      } else {
         try {
             appendFileSync("debug.log", `[App] NOT saving: conversationId=${conversationId}, hasMessage=${!!newMessage}, hasStorage=${!!storageRef.current}\n`);
         } catch (e) {}
      }
    };

    signalClient.on("message", handleEnvelope);
    signalClient.on("sync", handleEnvelope);

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
    <Box flexDirection="column" width="100%" height="100%">
      <Layout
        currentView={currentView}
        linkUri={linkUri}
        linkStatus={linkStatus}
        errorMessage={errorMessage}
        accounts={accounts}
        onLinkNewDevice={startLinkingProcess}
        client={client}
        selectedConversation={selectedConversation}
        onSelectConversation={setSelectedConversation}
        storage={storageReady ? storageRef.current : undefined}
      />
    </Box>
  );
}
