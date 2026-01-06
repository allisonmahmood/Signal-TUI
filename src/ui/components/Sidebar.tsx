import { useState, useEffect, useRef, memo, useMemo } from "react";
import { Box, Text, useInput, useStdout } from "ink";
import { SignalClient } from "../../core/SignalClient.ts";
import type { Account, Contact, Group, Conversation } from "../../types/types.ts";
import type { MessageStorage } from "../../core/MessageStorage.ts";
import { normalizeNumber } from "../../utils/phone.ts";
import { sortByRecency } from "../../utils/sortByRecency.ts";
import { theme } from "../theme.ts";
import { formatRelativeTime } from "../../utils/formatTime.ts";
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
  searchMode?: boolean;
  setSearchMode?: (mode: boolean) => void;
  onConversationCountChange?: (count: number) => void;
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
  searchMode = false,
  setSearchMode,
  onConversationCountChange,
}: SidebarProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingG, setPendingG] = useState(false);
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
  // Each conversation item is now 2 lines (name + preview)
  // Header is ~3 lines, Footer removed (hints now in KeybindBar)
  // Overhead ~5 lines
  const availableLines = Math.max(6, (stdout?.rows || 24) - 8);
  const itemHeight = 2; // Two lines per conversation item
  const listHeight = Math.floor(availableLines / itemHeight);

  // Filter conversations based on search query
  const filteredConversations = useMemo(() => {
    if (!searchQuery) return conversations;
    const query = searchQuery.toLowerCase();
    return conversations.filter(c =>
      c.displayName.toLowerCase().includes(query)
    );
  }, [conversations, searchQuery]);

  // Report conversation count changes
  useEffect(() => {
    onConversationCountChange?.(conversations.length);
  }, [conversations.length, onConversationCountChange]);

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

    const activeList = filteredConversations;

    // Search mode input handling
    if (searchMode) {
      if (key.escape) {
        setSearchMode?.(false);
        setSearchQuery("");
        return;
      }
      if (key.return) {
        // Select current item and exit search
        if (activeList[selectedIndex] && onSelectConversation) {
          onSelectConversation(activeList[selectedIndex]);
        }
        setSearchMode?.(false);
        setSearchQuery("");
        return;
      }
      if (key.backspace || key.delete) {
        setSearchQuery(prev => prev.slice(0, -1));
        return;
      }
      // Regular character input for search
      if (input && !key.ctrl && !key.meta) {
        setSearchQuery(prev => prev + input);
        setSelectedIndex(0);
        setScrollOffset(0);
        return;
      }
      return;
    }

    // Normal mode - vim keys and arrow keys
    const moveUp = () => {
      setSelectedIndex(prev => {
        const newIndex = Math.max(0, prev - 1);
        if (newIndex < scrollOffset) {
          setScrollOffset(newIndex);
        }
        return newIndex;
      });
    };

    const moveDown = () => {
      setSelectedIndex(prev => {
        const newIndex = Math.min(activeList.length - 1, prev + 1);
        if (newIndex >= scrollOffset + listHeight) {
          setScrollOffset(newIndex - listHeight + 1);
        }
        return newIndex;
      });
    };

    // Arrow keys
    if (key.upArrow) moveUp();
    if (key.downArrow) moveDown();

    // Vim keys: j/k for navigation
    if (input === "k") moveUp();
    if (input === "j") moveDown();

    // G for bottom
    if (input === "G") {
      const lastIndex = activeList.length - 1;
      setSelectedIndex(lastIndex);
      if (lastIndex >= listHeight) {
        setScrollOffset(lastIndex - listHeight + 1);
      }
      setPendingG(false);
    }

    // gg for top (two-key combo)
    if (input === "g") {
      if (pendingG) {
        setSelectedIndex(0);
        setScrollOffset(0);
        setPendingG(false);
      } else {
        setPendingG(true);
        // Reset pending after short delay
        setTimeout(() => setPendingG(false), 500);
      }
    } else {
      setPendingG(false);
    }

    // / to enter search mode
    if (input === "/") {
      setSearchMode?.(true);
      return;
    }

    if (key.return) {
      if (activeList[selectedIndex] && onSelectConversation) {
        onSelectConversation(activeList[selectedIndex]);
      }
    }
  }, { isActive: focusArea === "sidebar" });

  // Calculate visible conversations (memoized)
  const visibleConversations = useMemo(
    () => filteredConversations.slice(scrollOffset, scrollOffset + listHeight),
    [filteredConversations, scrollOffset, listHeight]
  );

  // Truncate text helper
  const truncate = (text: string | undefined, maxLen: number): string => {
    if (!text) return "";
    return text.length > maxLen ? text.slice(0, maxLen - 1) + "…" : text;
  };

  return (
    <Box
      flexDirection="column"
      width="30%"
      height="100%"
      overflow="hidden"
      borderStyle="round"
      borderColor={focusArea === "sidebar" ? theme.border.focused : theme.border.unfocused}
      paddingX={1}
    >
      {/* Header */}
      <Box marginBottom={1} flexDirection="column">
        <Box
          borderStyle="single"
          borderTop={false}
          borderLeft={false}
          borderRight={false}
          borderBottom
          borderColor={theme.border.unfocused}
          paddingBottom={0}
        >
          <Text bold color={focusArea === "sidebar" ? theme.primary : theme.text.secondary}>
            Conversations
          </Text>
          {filteredConversations.length > 0 && (
            <Text color={theme.text.muted}> ({filteredConversations.length})</Text>
          )}
        </Box>
      </Box>

      {/* Search box (when active) */}
      {searchMode && (
        <Box marginBottom={1}>
          <Text color={theme.primary}>/</Text>
          <Text color={theme.text.primary}>{searchQuery}</Text>
          <Text inverse> </Text>
        </Box>
      )}

      {/* Conversation list */}
      <Box flexDirection="column" flexGrow={1} overflow="hidden">
        {currentView === "loading" ? (
          <Text color={theme.text.muted}>Loading...</Text>
        ) : currentView === "onboarding" ? (
          <Text color={theme.text.muted}>Complete setup to see conversations</Text>
        ) : filteredConversations.length === 0 ? (
          <Box flexDirection="column">
            <Text color={theme.text.muted}>
              {searchQuery ? "No matches" : "No conversations yet"}
            </Text>
          </Box>
        ) : (
          <>
            {scrollOffset > 0 && <Text color={theme.text.muted}>↑ more</Text>}
            {visibleConversations.map((conv, index) => {
              const globalIndex = scrollOffset + index;
              const isSelected = selectedConversation?.id === conv.id;
              const isHighlighted = globalIndex === selectedIndex;
              const symbol = conv.type === "group" ? theme.symbols.group : theme.symbols.contact;
              const preview = truncate(conv.lastMessage, 28);
              const timeStr = conv.lastMessageTime ? formatRelativeTime(conv.lastMessageTime) : "";

              return (
                <Box key={conv.id} flexDirection="column" marginBottom={0}>
                  {/* Line 1: Symbol + Name + Time */}
                  <Box>
                    <Text
                      color={isSelected ? theme.primary : isHighlighted ? theme.text.primary : theme.text.secondary}
                      bold={isSelected}
                      backgroundColor={isHighlighted ? "#333" : undefined}
                    >
                      {isHighlighted ? theme.symbols.selected : " "} {symbol} {truncate(conv.displayName, 20)}
                    </Text>
                    {timeStr && (
                      <Text color={theme.text.muted}> {timeStr}</Text>
                    )}
                  </Box>
                  {/* Line 2: Preview */}
                  <Box paddingLeft={3}>
                    <Text color={theme.text.muted}>
                      {preview || " "}
                    </Text>
                  </Box>
                </Box>
              );
            })}
            {scrollOffset + listHeight < filteredConversations.length && (
              <Text color={theme.text.muted}>↓ more</Text>
            )}
          </>
        )}
      </Box>
    </Box>
  );
}

export default memo(Sidebar);
