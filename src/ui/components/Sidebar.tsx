import { useState, useEffect, useRef, memo, useMemo } from "react";
import { Box, Text, useInput, useStdout } from "ink";
import { SignalClient } from "../../core/SignalClient.ts";
import type { Account, Contact, Group, Conversation } from "../../types/types.ts";
import type { MessageStorage } from "../../core/MessageStorage.ts";
import { normalizeNumber } from "../../utils/phone.ts";
import { sortByRecency } from "../../utils/sortByRecency.ts";
import type { FocusArea } from "../App.tsx";

interface SidebarProps {
  currentView: "loading" | "onboarding" | "chat";
  accounts?: Account[];
  onLinkNewDevice?: () => void;
  client?: SignalClient | null;
  selectedConversation?: Conversation | null;
  onSelectConversation?: (conversation: Conversation) => void;
  storage?: MessageStorage;
  focusArea?: FocusArea;
  setFocusArea?: (area: FocusArea) => void;
}

function Sidebar({
  currentView,
  accounts,
  onLinkNewDevice,
  client,
  selectedConversation,
  onSelectConversation,
  storage,
  focusArea,
  setFocusArea,
}: SidebarProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);
  const { stdout } = useStdout();
  const conversationsRef = useRef<Conversation[]>([]);
  const selectedConversationIdRef = useRef<string | null>(null);

  // Keep ref in sync with selectedConversation
  useEffect(() => {
    selectedConversationIdRef.current = selectedConversation?.id ?? null;
  }, [selectedConversation?.id]);

  const hasAccounts = accounts && accounts.length > 0;
  const primaryAccount = accounts?.[0];

  // Calculate distinct area for list
  // Header is ~4 lines (Title + Account + margin)
  // Footer is ~8 lines (Hints + borders + margin)
  // Overhead ~12 lines. Increasing to 14 for safety.
  const listHeight = Math.max(5, (stdout?.rows || 24) - 14);

  // Fetch contacts and groups
  useEffect(() => {
    if (client && currentView === "chat" && storage) {
      Promise.all([
        client.listContacts(),
        client.listGroups(),
        storage.getAllConversationMetadata()
      ]).then(([contacts, groups, metadata]) => {
        const conversationsList: Conversation[] = [];

        groups.forEach(g => {
          const meta = metadata.get(g.id);
          conversationsList.push({
            id: g.id,
            type: "group",
            displayName: g.name || "Unknown Group",
            lastMessageTime: meta?.timestamp || 0,
            lastMessage: meta?.content
          });
        });

        contacts.forEach(c => {
          if (c.name || c.profileName) {
            const id = normalizeNumber(c.number) || c.uuid || "";
            const meta = metadata.get(id);
            conversationsList.push({
              id,
              number: c.number,
              uuid: c.uuid,
              type: "contact",
              displayName: c.name || c.profileName || c.number || "Unknown Contact",
              lastMessageTime: meta?.timestamp || 0,
              lastMessage: meta?.content
            });
          }
        });

        const sorted = sortByRecency(conversationsList);
        setConversations(sorted);
        conversationsRef.current = sorted;
      });
    }
  }, [client, currentView, storage]);

  useEffect(() => {
    if (!storage || currentView !== "chat") return;

    const handleNewMessage = (newMessage: any, conversationId: string) => {
      setConversations(prev => {
        // Find the conversation
        const existing = prev.find(c => c.id === conversationId);
        if (!existing) return prev;

        const convIndex = prev.indexOf(existing);
        const updatedConv: Conversation = {
          id: existing.id,
          type: existing.type,
          displayName: existing.displayName,
          number: existing.number,
          uuid: existing.uuid,
          lastMessageTime: newMessage.timestamp,
          lastMessage: newMessage.content
        };

        // Move to top instead of full re-sort (new messages are most recent)
        const withoutConv = prev.filter((_, i) => i !== convIndex);
        const sorted: Conversation[] = [updatedConv, ...withoutConv];

        // Use ref instead of prop to avoid dependency array issues
        const wasSelected = selectedConversationIdRef.current === conversationId;

        if (wasSelected) {
          // Conversation moved to top, so index is now 0
          if (listHeight > 0) {
            setScrollOffset(0);
          }
          setSelectedIndex(0);
        }

        conversationsRef.current = sorted;
        return sorted;
      });
    };

    storage.on("new-message", handleNewMessage);

    return () => {
      storage.off("new-message", handleNewMessage);
    };
  }, [storage, currentView, listHeight]);

  // Handle keyboard navigation - only active when sidebar is focused
  useInput((input, key) => {
    if (currentView !== "chat") return;

    if (key.upArrow) {
      setSelectedIndex(prev => {
        const newIndex = Math.max(0, prev - 1);
        // Adjust scroll if moving up out of view
        if (newIndex < scrollOffset) {
          setScrollOffset(newIndex);
        }
        return newIndex;
      });
    }

    if (key.downArrow) {
      setSelectedIndex(prev => {
        const newIndex = Math.min(conversations.length - 1, prev + 1);
        // Adjust scroll if moving down out of view
        if (newIndex >= scrollOffset + listHeight) {
          setScrollOffset(newIndex - listHeight + 1);
        }
        return newIndex;
      });
    }

    if (key.return) {
      if (conversations[selectedIndex] && onSelectConversation) {
        onSelectConversation(conversations[selectedIndex]);
      }
    }
  }, { isActive: focusArea === "sidebar" });

  // Calculate visible conversations (memoized)
  const visibleConversations = useMemo(
    () => conversations.slice(scrollOffset, scrollOffset + listHeight),
    [conversations, scrollOffset, listHeight]
  );

  return (
    <Box
      flexDirection="column"
      width="30%"
      height="100%"
      overflow="hidden"
      borderStyle="round"
      borderColor={focusArea === "sidebar" ? "cyan" : "gray"}
      paddingX={1}
    >
      {/* Header */}
      <Box marginBottom={1} flexDirection="column">
        <Text bold color="cyan">
          📨 Signal TUI
        </Text>
        {hasAccounts && primaryAccount?.number && (
          <Text dimColor color="green">
            ✓ {primaryAccount.number}
          </Text>
        )}
      </Box>

      {/* Conversation list */}
      <Box flexDirection="column" flexGrow={1} overflow="hidden">
        {currentView === "loading" ? (
          <Text dimColor>Loading...</Text>
        ) : currentView === "onboarding" ? (
          <Text dimColor>Complete setup to see conversations</Text>
        ) : conversations.length === 0 ? (
          <Box flexDirection="column">
            <Text dimColor>No conversations yet</Text>
            <Text dimColor color="gray">
              Press 'n' to start a new chat
            </Text>
          </Box>
        ) : (
          <>
            {scrollOffset > 0 && <Text dimColor>↑ ...</Text>}
            {visibleConversations.map((conv, index) => {
              // Create pseudo-global index to check selection
              const globalIndex = scrollOffset + index;
              const isSelected = selectedConversation?.id === conv.id;
              const isHighlighted = globalIndex === selectedIndex;
              
              return (
                <Box key={conv.id}>
                  <Text 
                    color={isSelected ? "cyan" : isHighlighted ? "white" : "gray"}
                    bold={isSelected}
                    backgroundColor={isHighlighted ? "#333" : undefined}
                  >
                    {isHighlighted ? "> " : "  "}
                    {conv.type === "group" ? "👥 " : "👤 "}
                    {conv.displayName} 
                  </Text>
                </Box>
              );
            })}
            {scrollOffset + listHeight < conversations.length && <Text dimColor>↓ ...</Text>}
          </>
        )}
      </Box>

      {/* Footer with hints */}
      <Box 
        marginTop={1} 
        flexDirection="column"
        borderStyle="single" 
        borderTop 
        borderBottom={false} 
        borderLeft={false} 
        borderRight={false} 
        borderColor="gray"
      >
        {currentView === "chat" && (
            <>
              <Text dimColor>↑↓ Navigate</Text>
              <Text dimColor>Enter Select</Text>
              <Text dimColor>Ctrl+L Link device</Text>
            </>
        )}
      </Box>
    </Box>
  );
}

export default memo(Sidebar);
