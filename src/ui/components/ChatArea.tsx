import { useState, useEffect, useRef, memo, useMemo, useCallback } from "react";
import { Box, Text, useInput, useStdout } from "ink";
import { SignalClient } from "../../core/SignalClient.ts";
import type { Conversation, Account, ChatMessage, SignalEnvelope } from "../../types/types.ts";
import { MessageStorage } from "../../core/MessageStorage.ts";
import { normalizeNumber } from "../../utils/phone.ts";
import MessageInput from "./MessageInput.tsx";
import type { FocusArea } from "../App.tsx";

// Estimate how many terminal rows a message will take
function estimateMessageHeight(content: string, availableWidth: number): number {
  // Base: 2 (borders) + 1 (header row) = 3 rows minimum
  const BASE_HEIGHT = 3;

  // Estimate content lines based on character count and width
  // Message box is 80% of chat area, minus padding and borders (~8 chars)
  const contentWidth = Math.max(20, availableWidth - 8);
  const contentLines = Math.max(1, Math.ceil(content.length / contentWidth));

  return BASE_HEIGHT + contentLines;
}

interface ChatAreaProps {
  currentView: "loading" | "onboarding" | "chat";
  client?: SignalClient | null;
  selectedConversation?: Conversation | null;
  currentAccount?: Account | null;
  storage?: MessageStorage;
  focusArea?: FocusArea;
  setFocusArea?: (area: FocusArea) => void;
  cycleFocus?: () => void;
}

function ChatArea({
  currentView,
  client,
  selectedConversation,
  currentAccount,
  storage,
  focusArea,
  setFocusArea,
  cycleFocus,
}: ChatAreaProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [scrollOffset, setScrollOffset] = useState(0);
  const { stdout } = useStdout();

  // Calculate available space for messages
  // Total rows - Header(~2) - Input(~2) - borders/margins(~6) = ~10 overhead
  const availableRows = Math.max(10, (stdout?.rows || 24) - 10);
  // Chat area is 70% of terminal, message boxes are 80% of that
  const chatAreaWidth = Math.floor((stdout?.columns || 80) * 0.7 * 0.8);

  // Calculate which messages fit in the visible area
  const visibleMessages = useMemo(() => {
    if (messages.length === 0) return [];

    // Start from the newest message minus scroll offset
    let endIndex = messages.length - scrollOffset;
    if (endIndex <= 0) return [];

    let startIndex = endIndex - 1;
    let totalHeight = 0;

    // Work backwards from scroll position, adding messages until we run out of space
    while (startIndex >= 0 && startIndex < messages.length) {
      const msg = messages[startIndex];
      if (!msg) break;
      const msgHeight = estimateMessageHeight(msg.content, chatAreaWidth);
      if (totalHeight + msgHeight > availableRows && startIndex < endIndex - 1) {
        startIndex++; // This message won't fit, go back one
        break;
      }
      totalHeight += msgHeight;
      startIndex--;
    }
    startIndex = Math.max(0, startIndex + 1); // Adjust to first visible message

    return messages.slice(startIndex, endIndex);
  }, [messages, scrollOffset, availableRows, chatAreaWidth]);

  // Clear messages and reset scroll when conversation changes
  useEffect(() => {
    setMessages([]);
    setScrollOffset(0);
    
    // Load history from storage
    if (storage && selectedConversation) {
        const history = storage.getMessages(selectedConversation.id, 50);
        setMessages(history);
    }
  }, [selectedConversation?.id, storage]);

  // Handle incoming messages from STORAGE (single source of truth)
  useEffect(() => {
    if (!storage || !selectedConversation) return;

    const handleNewMessage = (newMessage: ChatMessage, conversationId: string) => {
      // Check if message belongs to current conversation
      // Since App.tsx now correctly normalizes group IDs, we can just compare IDs
      const isRelevant = conversationId === selectedConversation.id;

      if (isRelevant) {
        setMessages(prev => {
           // Prevent duplicates (especially if synced message arrives after optimistic one)
           if (prev.some(m => m.id === newMessage.id)) {
             return prev;
           }
           return [...prev, newMessage];
        });
        // Reset scroll when new message arrives
        setScrollOffset(0);
      }
    };

    const handleStatusUpdate = (timestamp: number, status: string) => {
      setMessages(prev => prev.map(msg =>
        msg.timestamp === timestamp ? { ...msg, status: status as ChatMessage["status"] } : msg
      ));
    };

    storage.on("new-message", handleNewMessage);
    storage.on("message-replaced", handleReplacement);
    storage.on("status-updated", handleStatusUpdate);

    return () => {
      storage.off("new-message", handleNewMessage);
      storage.off("message-replaced", handleReplacement);
      storage.off("status-updated", handleStatusUpdate);
    };
  }, [storage, selectedConversation]);

  const handleReplacement = (oldId: string, newMessage: ChatMessage) => {
    setMessages(prev => prev.map(msg => 
      msg.id === oldId ? newMessage : msg
    ));
  };

  // Handle keyboard navigation for scrolling - only active when chat area is focused
  useInput((input, key) => {
    if (currentView !== "chat") return;

    const visibleCount = visibleMessages.length;
    const maxOffset = Math.max(0, messages.length - 1);

    // PageUp - scroll up by roughly one screen of messages
    if (key.pageUp) {
      setScrollOffset(prev => Math.min(maxOffset, prev + Math.max(1, visibleCount - 1)));
    }

    // PageDown - scroll down by roughly one screen of messages
    if (key.pageDown) {
      setScrollOffset(prev => Math.max(0, prev - Math.max(1, visibleCount - 1)));
    }

    // Up arrow - scroll up by 1 message
    if (key.upArrow) {
      setScrollOffset(prev => Math.min(maxOffset, prev + 1));
    }

    // Down arrow - scroll down by 1 message
    if (key.downArrow) {
      setScrollOffset(prev => Math.max(0, prev - 1));
    }
  }, { isActive: focusArea === "chat" });

  const handleSendMessage = useCallback(async (text: string) => {
    if (!client || !selectedConversation) return;

    // Create optimistic message outside try block so it's accessible in catch
    const optimisticMessage: ChatMessage = {
      id: Date.now().toString(),
      sender: "Me",
      content: text,
      timestamp: Date.now(),
      isOutgoing: true,
      status: "sent"
    };

    try {
      // Persist locally
      if (storage) {
        storage.addMessage(optimisticMessage, selectedConversation.id);
      }

      const timestamp = await client.sendMessage(
        selectedConversation.id,
        text,
        selectedConversation.type === "group"
      );

      // Replace optimistic message with real one
      const realMessage: ChatMessage = {
        ...optimisticMessage,
        id: timestamp.toString(),
        timestamp: timestamp
      };

      if (storage) {
        storage.replaceMessage(optimisticMessage.id, realMessage, selectedConversation.id);
      }
    } catch (error) {
      // Mark the optimistic message as failed
      if (storage) {
        storage.updateMessageStatus(optimisticMessage.timestamp, "failed");
      }
    }
  }, [client, selectedConversation, storage]);

  const getHeader = () => {
    switch (currentView) {
      case "loading":
        return "⏳ Loading...";
      case "onboarding":
        return "👋 Welcome to Signal TUI";
      case "chat":
        const name = selectedConversation
          ? `💬 ${selectedConversation.displayName}`
          : "💬 Chat";
        const scrollInfo = scrollOffset > 0
          ? ` (${scrollOffset} msgs up - ↓/PgDn to return)`
          : "";
        return name + scrollInfo;
    }
  };

  const getContent = () => {
    switch (currentView) {
      case "loading":
        return (
          <Box flexDirection="column" alignItems="center" justifyContent="center" flexGrow={1}>
            <Text>Connecting to Signal...</Text>
            <Text dimColor>Please wait</Text>
          </Box>
        );
      case "onboarding":
        return (
          <Box flexDirection="column" alignItems="center" justifyContent="center" flexGrow={1}>
            <Text bold color="cyan">Welcome to Signal TUI! 🚀</Text>
            <Text> </Text>
            <Text>A terminal-based Signal messenger client</Text>
            <Text dimColor>Built with Ink + React</Text>
            <Text> </Text>
            <Text color="green">✓ Signal CLI connected</Text>
            <Text dimColor>Select a conversation to start messaging</Text>
          </Box>
        );
      case "chat":
        if (!selectedConversation) {
          return (
            <Box flexDirection="column" alignItems="center" justifyContent="center" flexGrow={1}>
              <Text dimColor>Select a conversation from the sidebar</Text>
              <Text dimColor>to start chatting</Text>
            </Box>
          );
        }

        if (messages.length === 0) {
          return (
            <Box flexDirection="column" flexGrow={1} justifyContent="center" alignItems="center">
              <Text dimColor>No messages yet</Text>
              <Text dimColor>Start the conversation!</Text>
            </Box>
          );
        }

        // visibleMessages is calculated at component level with height-aware logic
        return (
          <Box flexDirection="column" flexGrow={1} overflow="hidden">
            {scrollOffset > 0 && (
               <Box justifyContent="center" marginBottom={0}>
                 <Text dimColor>--- Viewing History (↓/PgDn to return) ---</Text>
               </Box>
            )}
            
            {visibleMessages.map((msg) => (
              <Box 
                key={msg.id} 
                flexDirection="column" 
                marginBottom={0} 
                alignItems={msg.isOutgoing ? "flex-end" : "flex-start"}
              >
                <Box 
                   flexDirection="column" 
                   paddingX={1}
                   borderStyle="round"
                   borderColor={msg.isOutgoing ? "green" : "gray"}
                   width="80%"
                >
                  <Box flexDirection="row" justifyContent="space-between" marginBottom={0}>
                     <Text bold color={msg.isOutgoing ? "green" : "blue"}>
                       {msg.isOutgoing ? "Me" : (msg.senderName || msg.sender)}
                     </Text>
                     <Box>
                       <Text dimColor> {new Date(msg.timestamp).toLocaleTimeString()}</Text>
                       {msg.isOutgoing && (
                         <Text dimColor={msg.status !== "failed"} color={msg.status === "failed" ? "red" : undefined}>
                           {msg.status === "read" ? " ✓✓" :
                            msg.status === "delivered" ? " ✓" :
                            msg.status === "failed" ? " ✗" : " ○"}
                         </Text>
                       )}
                     </Box>
                  </Box>
                  <Text>{msg.content}</Text>
                </Box>
              </Box>
            ))}
          </Box>
        );
    }
  };

  // Chat area is focused when either chat or input is focused
  const isChatAreaFocused = focusArea === "chat" || focusArea === "input";

  return (
    <Box
      flexDirection="column"
      width="70%"
      height="100%"
      overflow="hidden"
      borderStyle="round"
      borderColor={isChatAreaFocused ? "cyan" : "gray"}
      paddingX={1}
    >
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="cyan">
          {getHeader()}
        </Text>
      </Box>

      {/* Content */}
      {getContent()}

      {/* Input area */}
      {currentView === "chat" && selectedConversation && (
        <Box marginTop={1}>
          <MessageInput onSend={handleSendMessage} focus={focusArea === "input"} onEscape={cycleFocus} />
        </Box>
      )}
    </Box>
  );
}

export default memo(ChatArea);
