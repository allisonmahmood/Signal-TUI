import { memo } from "react";
import { Box, useStdout } from "ink";
import Sidebar from "./Sidebar.tsx";
import ChatArea from "./ChatArea.tsx";
import Onboarding, { type LinkStatus } from "./Onboarding.tsx";
import { SignalClient } from "../../core/SignalClient.ts";
import type { Account, Conversation } from "../../types/types.ts";
import { MessageStorage } from "../../core/MessageStorage.ts";
import type { FocusArea } from "../App.tsx";

interface LayoutProps {
  currentView: "loading" | "onboarding" | "chat";
  linkUri?: string | null;
  linkStatus?: LinkStatus;
  errorMessage?: string;
  accounts?: Account[];
  onLinkNewDevice?: () => void;
  client?: SignalClient | null;
  selectedConversation?: Conversation | null;
  onSelectConversation?: (conversation: Conversation) => void;
  storage?: MessageStorage;
  focusArea?: FocusArea;
  setFocusArea?: (area: FocusArea) => void;
  cycleFocus?: () => void;
}

function Layout({
  currentView,
  linkUri,
  linkStatus,
  errorMessage,
  accounts,
  onLinkNewDevice,
  client,
  selectedConversation,
  onSelectConversation,
  storage,
  focusArea,
  setFocusArea,
  cycleFocus,
}: LayoutProps) {
  const { stdout } = useStdout();
  const terminalHeight = stdout?.rows || 24;

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

  // Normal chat layout with sidebar
  return (
    <Box flexDirection="row" width="100%" height={terminalHeight} overflow="hidden">
      <Sidebar
        currentView={currentView}
        accounts={accounts}
        onLinkNewDevice={onLinkNewDevice}
        client={client}
        selectedConversation={selectedConversation}
        onSelectConversation={onSelectConversation}
        storage={storage}
        focusArea={focusArea}
        setFocusArea={setFocusArea}
      />
      <ChatArea
        currentView={currentView}
        client={client}
        selectedConversation={selectedConversation}
        currentAccount={accounts?.[0]}
        storage={storage}
        focusArea={focusArea}
        setFocusArea={setFocusArea}
        cycleFocus={cycleFocus}
      />
    </Box>
  );
}

export default memo(Layout);
