import { memo, useState } from "react";
import { Box, useStdout } from "ink";
import Sidebar from "./Sidebar.tsx";
import ChatArea from "./ChatArea.tsx";
import Onboarding, { type LinkStatus } from "./Onboarding.tsx";
import StatusBar, { type ConnectionStatus } from "./StatusBar.tsx";
import KeybindBar from "./KeybindBar.tsx";
import { SignalClient } from "../../core/SignalClient.ts";
import type { Account, Conversation } from "../../types/types.ts";
import { MessageStorage } from "../../core/MessageStorage.ts";
import type { FocusArea } from "../state/navigation.ts";

interface LayoutProps {
  currentView: "loading" | "onboarding" | "chat";
  linkUri?: string | null;
  linkStatus?: LinkStatus;
  errorMessage?: string;
  accounts?: Account[];
  client?: SignalClient | null;
  selectedConversation?: Conversation | null;
  onSelectConversation?: (conversation: Conversation) => void;
  storage?: MessageStorage;
  focusArea?: FocusArea;
  cycleFocus?: () => void;
  connectionStatus?: ConnectionStatus;
}

function Layout({
  currentView,
  linkUri,
  linkStatus,
  errorMessage,
  accounts,
  client,
  selectedConversation,
  onSelectConversation,
  storage,
  focusArea,
  cycleFocus,
  connectionStatus = "disconnected",
}: LayoutProps) {
  const { stdout } = useStdout();
  const terminalHeight = stdout?.rows || 24;
  const [searchMode, setSearchMode] = useState(false);
  const [conversationCount, setConversationCount] = useState(0);

  // During onboarding, show full-width Onboarding component
  if (currentView === "onboarding" || currentView === "loading") {
    return (
      <Box flexDirection="row" width="100%" height={terminalHeight} overflow="hidden">
        <Onboarding
          linkUri={linkUri ?? null}
          status={currentView === "loading" ? "loading" : (linkStatus ?? "loading")}
          errorMessage={errorMessage}
        />
      </Box>
    );
  }

  // Reserve 3 lines for StatusBar (1) + KeybindBar (1) + borders
  const mainContentHeight = terminalHeight - 3;

  // Normal chat layout with sidebar
  return (
    <Box flexDirection="column" width="100%" height={terminalHeight} overflow="hidden">
      {/* Main content area */}
      <Box flexDirection="row" width="100%" height={mainContentHeight} overflow="hidden">
        <Sidebar
          currentView={currentView}
          client={client}
          selectedConversation={selectedConversation}
          onSelectConversation={onSelectConversation}
          storage={storage}
          focusArea={focusArea}
          searchMode={searchMode}
          setSearchMode={setSearchMode}
          onConversationCountChange={setConversationCount}
        />
        <Box width={1} />
        <ChatArea
          currentView={currentView}
          client={client}
          selectedConversation={selectedConversation}
          storage={storage}
          focusArea={focusArea}
          cycleFocus={cycleFocus}
        />
      </Box>

      {/* Bottom bar area */}
      <Box flexDirection="column" width="100%">
        <KeybindBar focusArea={focusArea ?? "sidebar"} searchMode={searchMode} />
        <StatusBar
          connectionStatus={connectionStatus}
          accountNumber={accounts?.[0]?.number}
          conversationCount={conversationCount}
        />
      </Box>
    </Box>
  );
}

export default memo(Layout);
