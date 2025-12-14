import { useState, useEffect, useRef } from "react";
import { Box, Text, useInput, useStdout } from "ink";
import { SignalClient } from "../../core/SignalClient.ts";
import type { Conversation, Account, ChatMessage, SignalEnvelope } from "../../types/types.ts";
import { MessageStorage } from "../../core/MessageStorage.ts";
import { normalizeNumber } from "../../utils/phone.ts";
import MessageInput from "./MessageInput.tsx";

interface ChatAreaProps {
  currentView: "loading" | "onboarding" | "chat";
  client?: SignalClient | null;
  selectedConversation?: Conversation | null;
  currentAccount?: Account | null;
  storage?: MessageStorage;
}

export default function ChatArea({ 
  currentView, 
  client, 
  selectedConversation,
  currentAccount,
  storage
}: ChatAreaProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [scrollOffset, setScrollOffset] = useState(0);
  const { stdout } = useStdout();
  
  // Calculate available window size for messages
  // Total rows - Header(3) - Input(3) - Footer/Border(2) = ~8 rows overhead.
  // Increasing safety margin to 10 to ensure fit.
  // Minimum 5 rows to avoid issues
  const windowSize = Math.max(5, (stdout?.rows || 24) - 10);

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

    storage.on("new-message", handleNewMessage);
    storage.on("message-replaced", handleReplacement);

    return () => {
      storage.off("new-message", handleNewMessage);
      storage.off("message-replaced", handleReplacement);
    };
  }, [storage, selectedConversation]);

  const handleReplacement = (oldId: string, newMessage: ChatMessage) => {
    setMessages(prev => prev.map(msg => 
      msg.id === oldId ? newMessage : msg
    ));
  };

  // Handle keyboard navigation for scrolling
  useInput((input, key) => {
    if (currentView !== "chat") return;
    
    // PageUp to see older messages (increase offset)
    if (key.pageUp) {
      setScrollOffset(prev => {
        const maxOffset = Math.max(0, messages.length - windowSize);
        return Math.min(maxOffset, prev + 5);
      });
    }

    // PageDown to see newer messages (decrease offset)
    if (key.pageDown) {
      setScrollOffset(prev => Math.max(0, prev - 5));
    }
  });

  const handleSendMessage = async (text: string) => {
    if (!client || !selectedConversation) return;

    try {
      // Optimistically add message
      const optimisitcMessage: ChatMessage = {
        id: Date.now().toString(),
        sender: "Me",
        content: text,
        timestamp: Date.now(),
        isOutgoing: true,
        status: "sent"
      };
      // Persist locally
      if (storage) {
        storage.addMessage(optimisitcMessage, selectedConversation.id);
      }

      const timestamp = await client.sendMessage(
        selectedConversation.id, 
        text, 
        selectedConversation.type === "group"
      );

      // Replace optimistic message with real one
      const realMessage: ChatMessage = {
        ...optimisitcMessage,
        id: timestamp.toString(),
        timestamp: timestamp
      };

      if (storage) {
        storage.replaceMessage(optimisitcMessage.id, realMessage, selectedConversation.id);
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      // TODO: Show error state
    }
  };

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
        const scrollInfo = scrollOffset > 0 ? ` (History -${scrollOffset})` : "";
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

        // Calculate visible messages window
        // Slice logic: 
        // If we have 100 messages, window=20, offset=0 -> slice(80, 100)
        // offset=5 -> slice(75, 95)
        const start = Math.max(0, messages.length - windowSize - scrollOffset);
        const end = Math.max(Math.min(windowSize, messages.length), messages.length - scrollOffset);
        // Correct slice logic for windowing from end
        // If messages=30, window=10, scroll=0: start=20, end=30. visible=10.
        // scroll=5: start=15, end=25. visible=10.
        
        const visibleMessages = messages.slice(start, end);

        return (
          <Box flexDirection="column" flexGrow={1} overflow="hidden">
            {scrollOffset > 0 && (
               <Box justifyContent="center" marginBottom={0}>
                 <Text dimColor>--- Scrolling History (PageDown to return) ---</Text>
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
                     <Text dimColor> {new Date(msg.timestamp).toLocaleTimeString()}</Text>
                  </Box>
                  <Text>{msg.content}</Text>
                </Box>
              </Box>
            ))}
          </Box>
        );
    }
  };

  return (
    <Box
      flexDirection="column"
      width="70%"
      borderStyle="round"
      borderColor="gray"
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
          <MessageInput onSend={handleSendMessage} />
        </Box>
      )}
    </Box>
  );
}
