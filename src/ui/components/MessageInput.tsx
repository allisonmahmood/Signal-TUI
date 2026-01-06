import { useState, memo, useRef } from "react";
import { Box, Text, useInput } from "ink";
import { homedir } from "node:os";
import { theme } from "../theme.ts";

interface MessageInputProps {
  onSend: (message: string, attachments?: string[]) => void;
  disabled?: boolean;
  focus?: boolean;
  onEscape?: () => void;
}

/**
 * Parse input for slash commands like /attach
 * @returns Parsed message and optional attachments
 */
function parseInput(text: string): { message: string; attachments?: string[] } {
  const trimmed = text.trim();

  // /attach <filepath> [message]
  // Supports quoted paths for spaces: /attach "/path/with spaces/file.png"
  if (trimmed.startsWith("/attach ")) {
    const rest = trimmed.slice(8).trim();

    let filePath: string;
    let message: string = "";

    // Check for quoted path
    if (rest.startsWith('"')) {
      const endQuote = rest.indexOf('"', 1);
      if (endQuote > 0) {
        filePath = rest.slice(1, endQuote);
        message = rest.slice(endQuote + 1).trim();
      } else {
        // No closing quote, treat everything as path
        filePath = rest.slice(1);
      }
    } else if (rest.startsWith("'")) {
      const endQuote = rest.indexOf("'", 1);
      if (endQuote > 0) {
        filePath = rest.slice(1, endQuote);
        message = rest.slice(endQuote + 1).trim();
      } else {
        filePath = rest.slice(1);
      }
    } else {
      // No quotes, split on first space
      const spaceIndex = rest.indexOf(" ");
      if (spaceIndex > 0) {
        filePath = rest.slice(0, spaceIndex);
        message = rest.slice(spaceIndex + 1).trim();
      } else {
        filePath = rest;
      }
    }

    // Expand ~ to home directory
    if (filePath.startsWith("~")) {
      filePath = filePath.replace(/^~/, homedir());
    }

    return {
      message,
      attachments: [filePath],
    };
  }

  // No command, regular message
  return { message: trimmed };
}

function MessageInput({ onSend, disabled, focus = true, onEscape }: MessageInputProps) {
  // Use refs for the actual data (synchronous updates)
  const valueRef = useRef("");
  const cursorRef = useRef(0);
  // State only for triggering re-renders
  const [, forceRender] = useState(0);

  const update = () => forceRender(n => n + 1);

  // Handle all input ourselves
  useInput((input, key) => {
    if (!focus) return;

    // Escape to exit input mode
    if (key.escape && onEscape) {
      onEscape();
      return;
    }

    // Submit on Enter
    if (key.return) {
      const trimmed = valueRef.current.trim();
      if (trimmed && !disabled) {
        const parsed = parseInput(trimmed);
        // Only send if we have a message or attachments
        if (parsed.message || (parsed.attachments && parsed.attachments.length > 0)) {
          onSend(parsed.message, parsed.attachments);
        }
        valueRef.current = "";
        cursorRef.current = 0;
        update();
      }
      return;
    }

    // Ignore control keys that shouldn't affect input
    if (key.upArrow || key.downArrow || key.tab) {
      return;
    }

    // Handle backspace
    if (key.backspace || key.delete) {
      if (cursorRef.current > 0) {
        const val = valueRef.current;
        const pos = cursorRef.current;
        valueRef.current = val.slice(0, pos - 1) + val.slice(pos);
        cursorRef.current = pos - 1;
        update();
      }
      return;
    }

    // Handle left/right arrow
    if (key.leftArrow) {
      if (cursorRef.current > 0) {
        cursorRef.current--;
        update();
      }
      return;
    }
    if (key.rightArrow) {
      if (cursorRef.current < valueRef.current.length) {
        cursorRef.current++;
        update();
      }
      return;
    }

    // Ctrl+A - move to start
    if (key.ctrl && input === "a") {
      cursorRef.current = 0;
      update();
      return;
    }

    // Ctrl+E - move to end
    if (key.ctrl && input === "e") {
      cursorRef.current = valueRef.current.length;
      update();
      return;
    }

    // Ctrl+U - clear line
    if (key.ctrl && input === "u") {
      valueRef.current = "";
      cursorRef.current = 0;
      update();
      return;
    }

    // Ctrl+W - delete word backward
    if (key.ctrl && input === "w") {
      const val = valueRef.current;
      const pos = cursorRef.current;
      const beforeCursor = val.slice(0, pos);
      const afterCursor = val.slice(pos);
      const lastSpace = beforeCursor.trimEnd().lastIndexOf(" ");
      const newBefore = lastSpace === -1 ? "" : beforeCursor.slice(0, lastSpace + 1);
      valueRef.current = newBefore + afterCursor;
      cursorRef.current = newBefore.length;
      update();
      return;
    }

    // Ignore other control sequences
    if (key.ctrl || key.meta) {
      return;
    }

    // Regular character input
    if (input) {
      const val = valueRef.current;
      const pos = cursorRef.current;
      valueRef.current = val.slice(0, pos) + input + val.slice(pos);
      cursorRef.current = pos + input.length;
      update();
    }
  }, { isActive: focus });

  // Render the input with cursor
  const value = valueRef.current;
  const cursorOffset = cursorRef.current;

  const renderValue = () => {
    if (!value && !focus) {
      return <Text color={theme.text.muted}>Type a message...</Text>;
    }
    if (!value) {
      return <Text><Text inverse> </Text><Text color={theme.text.muted}>Type a message...</Text></Text>;
    }

    const before = value.slice(0, cursorOffset);
    const cursor = value[cursorOffset] || " ";
    const after = value.slice(cursorOffset + 1);

    if (focus) {
      return <Text color={theme.text.primary}>{before}<Text inverse>{cursor}</Text>{after}</Text>;
    }
    return <Text color={theme.text.primary}>{value}</Text>;
  };

  return (
    <Box
      borderStyle="single"
      borderTop
      borderBottom={false}
      borderLeft={false}
      borderRight={false}
      borderColor={focus ? theme.border.focused : theme.border.unfocused}
    >
      <Text color={focus ? theme.primary : theme.text.muted}>{"\u203A"} </Text>
      {renderValue()}
    </Box>
  );
}

export default memo(MessageInput);
