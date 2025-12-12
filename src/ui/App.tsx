import { useState, useEffect, useRef } from "react";
import { Box, useApp, useInput } from "ink";
import Layout from "./components/Layout.tsx";
import { SignalClient } from "../core/SignalClient.ts";
import type { LinkStatus } from "./components/Onboarding.tsx";
import type { Account, Conversation } from "../types/types.ts";

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

    // Listen for process close
    signalClient.on("close", (code) => {
      // Ignore close events during intentional shutdown
      if (isStoppingRef.current) return;
      
      if (code !== 0 && linkStatus !== "success") {
        setLinkStatus("error");
        setErrorMessage(`signal-cli exited with code ${code}`);
      }
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
      />
    </Box>
  );
}
