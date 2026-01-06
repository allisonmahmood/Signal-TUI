import { useState, useEffect, useRef, memo, useMemo, useCallback } from "react";
import { Box, Text, useInput, useStdout } from "ink";
import { existsSync } from "node:fs";
import { basename } from "node:path";
import { SignalClient } from "../../core/SignalClient.ts";
import { getMimeType } from "../../utils/mime.ts";
import type { Conversation, Account, ChatMessage, SignalEnvelope, Attachment } from "../../types/types.ts";
import { MessageStorage } from "../../core/MessageStorage.ts";
import { normalizeNumber } from "../../utils/phone.ts";
import MessageInput from "./MessageInput.tsx";
import { theme } from "../theme.ts";
import { formatTime } from "../../utils/formatTime.ts";
import type { FocusArea } from "../App.tsx";

// Dynamically import terminal-image (ESM module)
let terminalImage: typeof import("terminal-image") | null = null;
import("terminal-image").then(mod => { terminalImage = mod; }).catch(() => {});

// AttachmentDisplay component for rendering images, audio, and files
interface AttachmentDisplayProps {
  attachment: Attachment;
  maxWidth: number;
}

function AttachmentDisplay({ attachment, maxWidth }: AttachmentDisplayProps) {
  const [imageOutput, setImageOutput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Only try to render images with a valid local path
    if (attachment.contentType.startsWith("image/") && attachment.localPath) {
      // Check if file exists before trying to render
      if (!existsSync(attachment.localPath)) {
        setError("File not found");
        return;
      }

      // Try to load and render the image
      const loadImage = async () => {
        try {
          if (!terminalImage) {
            // Module not loaded yet, wait a bit
            await new Promise(r => setTimeout(r, 100));
            if (!terminalImage) {
              setError("Image rendering unavailable");
              return;
            }
          }

          const result = await terminalImage.default.file(attachment.localPath!, {
            width: Math.min(maxWidth, 40),
            preserveAspectRatio: true,
          });
          setImageOutput(result);
        } catch (e) {
          setError("Failed to load image");
        }
      };

      loadImage();
    }
  }, [attachment.localPath, attachment.contentType, maxWidth]);

  // Image display
  if (attachment.contentType.startsWith("image/")) {
    if (imageOutput) {
      return (
        <Box flexDirection="column">
          <Text>{imageOutput}</Text>
          {attachment.caption && <Text color={theme.text.muted}>{attachment.caption}</Text>}
          {attachment.filename && <Text color={theme.text.muted} dimColor>{attachment.filename}</Text>}
        </Box>
      );
    }
    // Fallback to label while loading or on error
    return (
      <Box>
        <Text color={theme.warning}>
          [IMG] {attachment.filename || "image"}
          {attachment.downloadStatus === "pending" && " (downloading...)"}
          {error && ` (${error})`}
        </Text>
      </Box>
    );
  }

  // Voice message / audio
  if (attachment.contentType.startsWith("audio/")) {
    // Rough duration estimate from file size (assuming ~16kbps for voice)
    const duration = attachment.size ? `~${Math.round(attachment.size / 2000)}s` : "";
    return (
      <Box>
        <Text color={theme.secondary}>
          [VOICE] {duration} {attachment.filename || "voice message"}
        </Text>
        {attachment.localPath && (
          <Text color={theme.text.muted} dimColor> {attachment.localPath}</Text>
        )}
      </Box>
    );
  }

  // Video
  if (attachment.contentType.startsWith("video/")) {
    const sizeStr = attachment.size ? `(${Math.round(attachment.size / 1024)}KB)` : "";
    return (
      <Box>
        <Text color={theme.warning}>
          [VIDEO] {attachment.filename || "video"} {sizeStr}
        </Text>
        {attachment.localPath && (
          <Text color={theme.text.muted} dimColor> {attachment.localPath}</Text>
        )}
      </Box>
    );
  }

  // Generic file
  const sizeStr = attachment.size ? `(${Math.round(attachment.size / 1024)}KB)` : "";
  return (
    <Box>
      <Text color={theme.warning}>
        [FILE] {attachment.filename || "attachment"} {sizeStr}
      </Text>
      {attachment.localPath && (
        <Text color={theme.text.muted} dimColor> {attachment.localPath}</Text>
      )}
    </Box>
  );
}

// Extended message type with grouping info
interface DisplayMessage extends ChatMessage {
  isConsecutive: boolean;
  attachments?: Attachment[];
  quote?: {
    author?: string;
    text?: string;
  };
}

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
  const [pendingG, setPendingG] = useState(false);
  const { stdout } = useStdout();

  // Calculate available space for messages
  // Total rows - Header(~2) - Input(~2) - borders/margins(~6) = ~10 overhead
  const availableRows = Math.max(10, (stdout?.rows || 24) - 10);
  // Chat area is 70% of terminal, minus borders(2) and paddingX(2) for content area
  const terminalCols = stdout?.columns || 80;
  const chatAreaContentWidth = Math.floor(terminalCols * 0.7) - 4;
  // Message boxes are 80% of the content area
  const messageBoxWidth = Math.floor(chatAreaContentWidth * 0.8);
  // For height estimation (used in pagination)
  const chatAreaWidth = messageBoxWidth;

  // Calculate which messages fit in the visible area and add grouping info
  const visibleMessages = useMemo((): DisplayMessage[] => {
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

    const slice = messages.slice(startIndex, endIndex);

    // Add consecutive grouping info
    return slice.map((msg, index): DisplayMessage => {
      const prevMsg = slice[index - 1];
      const isConsecutive = !!(prevMsg &&
        prevMsg.sender === msg.sender &&
        (msg.timestamp - prevMsg.timestamp) < 300000); // 5 minutes

      return { ...msg, isConsecutive };
    });
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

    const scrollUp = () => setScrollOffset(prev => Math.min(maxOffset, prev + 1));
    const scrollDown = () => setScrollOffset(prev => Math.max(0, prev - 1));

    // PageUp - scroll up by roughly one screen of messages
    if (key.pageUp) {
      setScrollOffset(prev => Math.min(maxOffset, prev + Math.max(1, visibleCount - 1)));
    }

    // PageDown - scroll down by roughly one screen of messages
    if (key.pageDown) {
      setScrollOffset(prev => Math.max(0, prev - Math.max(1, visibleCount - 1)));
    }

    // Arrow keys
    if (key.upArrow) scrollUp();
    if (key.downArrow) scrollDown();

    // Vim keys: k for up, j for down
    if (input === "k") scrollUp();
    if (input === "j") scrollDown();

    // G for bottom (newest messages)
    if (input === "G") {
      setScrollOffset(0);
      setPendingG(false);
    }

    // gg for top (oldest messages)
    if (input === "g") {
      if (pendingG) {
        setScrollOffset(maxOffset);
        setPendingG(false);
      } else {
        setPendingG(true);
        setTimeout(() => setPendingG(false), 500);
      }
    } else {
      setPendingG(false);
    }
  }, { isActive: focusArea === "chat" });

  const handleSendMessage = useCallback(async (text: string, attachments?: string[]) => {
    if (!client || !selectedConversation) return;

    // Validate attachment paths exist
    if (attachments && attachments.length > 0) {
      for (const path of attachments) {
        if (!existsSync(path)) {
          // TODO: Show error to user - for now just log and skip
          console.error(`[ChatArea] Attachment not found: ${path}`);
          return;
        }
      }
    }

    // Build attachment metadata for optimistic message
    const attachmentMeta: Attachment[] | undefined = attachments?.map(path => ({
      contentType: getMimeType(path),
      filename: basename(path),
      localPath: path,
      downloadStatus: "completed" as const,
    }));

    // Determine content for display
    const displayContent = text || (attachments?.length ? "[Attachment]" : "");

    // Create optimistic message outside try block so it's accessible in catch
    const optimisticMessage: ChatMessage = {
      id: Date.now().toString(),
      sender: "Me",
      content: displayContent,
      timestamp: Date.now(),
      isOutgoing: true,
      status: "sent",
      attachments: attachmentMeta,
    };

    try {
      // Persist locally
      if (storage) {
        storage.addMessage(optimisticMessage, selectedConversation.id);
      }

      const timestamp = await client.sendMessage(
        selectedConversation.id,
        text || undefined,
        {
          isGroup: selectedConversation.type === "group",
          attachments,
        }
      );

      // Replace optimistic message with real one
      const realMessage: ChatMessage = {
        ...optimisticMessage,
        id: timestamp.toString(),
        timestamp: timestamp,
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
        return "Loading...";
      case "onboarding":
        return "Welcome to Signal TUI";
      case "chat":
        const name = selectedConversation?.displayName ?? "Chat";
        const scrollInfo = scrollOffset > 0
          ? ` (${scrollOffset} up)`
          : "";
        return name + scrollInfo;
    }
  };

  // Helper for attachment display
  const getAttachmentLabel = (att: Attachment): string => {
    if (att.contentType.startsWith("image/")) return "[IMG]";
    if (att.contentType.startsWith("video/")) return "[VIDEO]";
    if (att.contentType.startsWith("audio/")) return "[VOICE]";
    return "[FILE]";
  };

  const getContent = () => {
    switch (currentView) {
      case "loading":
        return (
          <Box flexDirection="column" alignItems="center" justifyContent="center" flexGrow={1}>
            <Text color={theme.text.primary}>Connecting to Signal...</Text>
            <Text color={theme.text.muted}>Please wait</Text>
          </Box>
        );
      case "onboarding":
        return (
          <Box flexDirection="column" alignItems="center" justifyContent="center" flexGrow={1}>
            <Text bold color={theme.primary}>Welcome to Signal TUI</Text>
            <Text> </Text>
            <Text color={theme.text.secondary}>A terminal-based Signal messenger client</Text>
            <Text color={theme.text.muted}>Built with Ink + React</Text>
            <Text> </Text>
            <Text color={theme.success}>{theme.symbols.connected} Signal CLI connected</Text>
            <Text color={theme.text.muted}>Select a conversation to start messaging</Text>
          </Box>
        );
      case "chat":
        if (!selectedConversation) {
          return (
            <Box flexDirection="column" alignItems="center" justifyContent="center" flexGrow={1}>
              <Text color={theme.text.muted}>Select a conversation from the sidebar</Text>
              <Text color={theme.text.muted}>to start chatting</Text>
            </Box>
          );
        }

        if (messages.length === 0) {
          return (
            <Box flexDirection="column" flexGrow={1} justifyContent="center" alignItems="center">
              <Text color={theme.text.muted}>No messages yet</Text>
              <Text color={theme.text.muted}>Start the conversation!</Text>
            </Box>
          );
        }

        return (
          <Box flexDirection="column" flexGrow={1} overflow="hidden">
            {scrollOffset > 0 && (
               <Box justifyContent="center" marginBottom={0}>
                 <Text color={theme.text.muted}>--- viewing history (j/PgDn to return) ---</Text>
               </Box>
            )}

            {visibleMessages.map((msg) => {
              const borderColor = msg.isOutgoing
                ? theme.message.outgoing.border
                : theme.message.incoming.border;
              const senderColor = msg.isOutgoing
                ? theme.message.outgoing.sender
                : theme.message.incoming.sender;

              return (
                <Box
                  key={msg.id}
                  flexDirection="column"
                  marginBottom={msg.isConsecutive ? 0 : 0}
                  alignItems={msg.isOutgoing ? "flex-end" : "flex-start"}
                  width="100%"
                >
                  <Box
                    flexDirection="column"
                    paddingX={1}
                    borderStyle="round"
                    borderColor={borderColor}
                    width={messageBoxWidth}
                  >
                    {/* Header row - only show if not consecutive */}
                    {!msg.isConsecutive && (
                      <Box flexDirection="row" justifyContent="space-between" marginBottom={0}>
                        <Text bold color={senderColor}>
                          {msg.isOutgoing ? "Me" : (msg.senderName || msg.sender)}
                        </Text>
                        <Box>
                          <Text color={theme.text.muted}> {formatTime(msg.timestamp)}</Text>
                          {msg.isOutgoing && (
                            <Text
                              color={msg.status === "failed" ? theme.error : theme.text.muted}
                            >
                              {msg.status === "read" ? " \u2713\u2713" :
                               msg.status === "delivered" ? " \u2713" :
                               msg.status === "failed" ? " \u2717" : " \u25CB"}
                            </Text>
                          )}
                        </Box>
                      </Box>
                    )}

                    {/* Quote/Reply context */}
                    {msg.quote && (
                      <Box
                        borderLeft
                        borderColor={theme.text.muted}
                        paddingLeft={1}
                        marginBottom={0}
                      >
                        <Text color={theme.secondary}>{msg.quote.author}: </Text>
                        <Text color={theme.text.muted}>
                          {(msg.quote.text || "").slice(0, 40)}
                          {(msg.quote.text || "").length > 40 ? "..." : ""}
                        </Text>
                      </Box>
                    )}

                    {/* Attachments */}
                    {msg.attachments && msg.attachments.length > 0 && (
                      <Box flexDirection="column" gap={0}>
                        {msg.attachments.map((att, i) => (
                          <AttachmentDisplay
                            key={att.id || i}
                            attachment={att}
                            maxWidth={messageBoxWidth - 4}
                          />
                        ))}
                      </Box>
                    )}

                    {/* Message content */}
                    <Text color={theme.text.primary} wrap="wrap">{msg.content}</Text>
                  </Box>
                </Box>
              );
            })}
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
      borderColor={isChatAreaFocused ? theme.border.focused : theme.border.unfocused}
      paddingX={1}
    >
      {/* Header */}
      <Box
        marginBottom={1}
        borderStyle="single"
        borderTop={false}
        borderLeft={false}
        borderRight={false}
        borderBottom
        borderColor={theme.border.unfocused}
      >
        <Text bold color={isChatAreaFocused ? theme.primary : theme.text.secondary}>
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
