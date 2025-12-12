import { useState, useEffect } from "react";
import { Box, Text, useInput, useStdout } from "ink";
import { SignalClient } from "../../core/SignalClient.ts";
import type { Account, Contact, Group, Conversation } from "../../types/types.ts";

interface SidebarProps {
  currentView: "loading" | "onboarding" | "chat";
  accounts?: Account[];
  onLinkNewDevice?: () => void;
  client?: SignalClient | null;
  selectedConversation?: Conversation | null;
  onSelectConversation?: (conversation: Conversation) => void;
}

export default function Sidebar({ 
  currentView, 
  accounts, 
  onLinkNewDevice,
  client,
  selectedConversation,
  onSelectConversation 
}: SidebarProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);
  const { stdout } = useStdout();
  
  const hasAccounts = accounts && accounts.length > 0;
  const primaryAccount = accounts?.[0];

  // Calculate distinct area for list
  // Header is ~4 lines (Title + Account + margin)
  // Footer is ~8 lines (Hints + borders + margin)
  // Overhead ~12 lines. Increasing to 14 for safety.
  const listHeight = Math.max(5, (stdout?.rows || 24) - 14);

  // Fetch contacts and groups
  useEffect(() => {
    if (client && currentView === "chat") {
      Promise.all([
        client.listContacts(),
        client.listGroups()
      ]).then(([contacts, groups]) => {
        const conversationsList: Conversation[] = [];

        // Add groups
        groups.forEach(g => {
          conversationsList.push({
            id: g.id,
            type: "group",
            displayName: g.name || "Unknown Group",
          });
        });

        // Add contacts (only those with names or profiles)
        contacts.forEach(c => {
          if (c.name || c.profileName) {
            conversationsList.push({
              id: c.number || c.uuid || "",
              number: c.number,
              uuid: c.uuid,
              type: "contact",
              displayName: c.name || c.profileName || c.number || "Unknown Contact",
            });
          }
        });

        // Sort by name for now (later by timestamp)
        conversationsList.sort((a, b) => a.displayName.localeCompare(b.displayName));
        setConversations(conversationsList);
      });
    }
  }, [client, currentView]);

  // Handle keyboard navigation
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
  });

  // Calculate visible conversations
  const visibleConversations = conversations.slice(scrollOffset, scrollOffset + listHeight);

  return (
    <Box
      flexDirection="column"
      width="30%"
      borderStyle="round"
      borderColor="gray"
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
