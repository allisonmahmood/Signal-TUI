import { useState, memo, useRef } from "react";
import { Box, Text, useInput } from "ink";
import { homedir } from "node:os";
import { existsSync } from "node:fs";
import { theme } from "../theme.ts";

/**
 * Analyze /attach command for visual feedback
 */
function analyzeAttachCommand(text: string): {
  isAttachCommand: boolean;
  commandPart: string;
  filePath: string;
  filePathExpanded: string;
  message: string;
  fileExists: boolean | null; // null = not yet determined (still typing)
  stage: "command" | "filepath" | "message";
} {
  const defaultResult = {
    isAttachCommand: false,
    commandPart: "",
    filePath: "",
    filePathExpanded: "",
    message: "",
    fileExists: null,
    stage: "command" as const,
  };

  // Check if starting to type /attach
  if (!text.startsWith("/")) return defaultResult;

  // Partial command match
  if ("/attach".startsWith(text) || text.startsWith("/attach")) {
    if (!text.startsWith("/attach ")) {
      return {
        ...defaultResult,
        isAttachCommand: true,
        commandPart: text,
        stage: "command",
      };
    }
  } else {
    return defaultResult;
  }

  // Full command with space - now parsing file path
  const rest = text.slice(8); // After "/attach "

  let filePath = "";
  let message = "";
  let inQuotes = false;
  let quoteChar = "";

  // Parse file path (with quote support)
  if (rest.startsWith('"') || rest.startsWith("'")) {
    quoteChar = rest[0];
    const endQuote = rest.indexOf(quoteChar, 1);
    if (endQuote > 0) {
      filePath = rest.slice(1, endQuote);
      message = rest.slice(endQuote + 1).trimStart();
    } else {
      // Still in quoted path
      filePath = rest.slice(1);
      inQuotes = true;
    }
  } else {
    // Unquoted path
    const spaceIndex = rest.indexOf(" ");
    if (spaceIndex > 0) {
      filePath = rest.slice(0, spaceIndex);
      message = rest.slice(spaceIndex + 1);
    } else {
      filePath = rest;
    }
  }

  // Expand ~ for validation
  const filePathExpanded = filePath.startsWith("~")
    ? filePath.replace(/^~/, homedir())
    : filePath;

  // Check if file exists (only if we have a non-empty path and not still typing)
  const fileExists = filePath.length > 0 && !inQuotes
    ? existsSync(filePathExpanded)
    : null;

  const stage = message.length > 0 ? "message" : filePath.length > 0 ? "filepath" : "command";

  return {
    isAttachCommand: true,
    commandPart: "/attach",
    filePath,
    filePathExpanded,
    message,
    fileExists,
    stage,
  };
}

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

  // Analyze for /attach command
  const attachInfo = analyzeAttachCommand(value);

  const renderValue = () => {
    if (!value && !focus) {
      return <Text color={theme.text.muted}>Type a message...</Text>;
    }
    if (!value) {
      return <Text><Text inverse> </Text><Text color={theme.text.muted}>Type a message...</Text></Text>;
    }

    // Special rendering for /attach command
    if (attachInfo.isAttachCommand && focus) {
      return renderAttachCommand();
    }

    const before = value.slice(0, cursorOffset);
    const cursor = value[cursorOffset] || " ";
    const after = value.slice(cursorOffset + 1);

    if (focus) {
      return <Text color={theme.text.primary}>{before}<Text inverse>{cursor}</Text>{after}</Text>;
    }
    return <Text color={theme.text.primary}>{value}</Text>;
  };

  // Render /attach command with syntax highlighting and validation
  const renderAttachCommand = () => {
    const parts: JSX.Element[] = [];
    const fullCommand = "/attach";

    // Handle partial command typing (e.g., "/att" shows "att" bright, "ach" very dim)
    if (value.length <= 7 && !value.includes(" ")) {
      // Still typing the command itself
      const typed = value; // What user has typed
      const suggestion = fullCommand.slice(typed.length); // Rest to autocomplete

      // Handle cursor position within typed text
      if (cursorOffset < typed.length) {
        // Cursor is within the typed portion
        const beforeCursor = typed.slice(0, cursorOffset);
        const cursorChar = typed[cursorOffset] || " ";
        const afterCursor = typed.slice(cursorOffset + 1);

        parts.push(
          <Text key="typed" color={theme.secondary} bold>
            {beforeCursor}<Text inverse>{cursorChar}</Text>{afterCursor}
          </Text>
        );
      } else {
        // Cursor is at the end of typed text
        parts.push(
          <Text key="typed" color={theme.secondary} bold>{typed}</Text>
        );
        // Cursor appears right after typed text, before suggestion
        parts.push(<Text key="cursor" inverse> </Text>);
      }

      // Show suggestion in very dim (after cursor)
      if (suggestion) {
        parts.push(
          <Text key="suggest" color={theme.text.muted} dimColor>{suggestion}</Text>
        );
      }

      return <Text>{parts}</Text>;
    }

    // Full command typed - show it highlighted
    parts.push(
      <Text key="cmd" color={theme.secondary} bold>/attach</Text>
    );

    if (value.length > 7) {
      // Space after command
      parts.push(<Text key="sp1"> </Text>);

      if (attachInfo.filePath) {
        // File path with validation indicator
        const pathColor = attachInfo.fileExists === true
          ? theme.success
          : attachInfo.fileExists === false
            ? theme.error
            : theme.warning;

        const pathIndicator = attachInfo.fileExists === true
          ? " \u2713" // checkmark
          : attachInfo.fileExists === false
            ? " \u2717" // X
            : ""; // still typing

        // Check if cursor is within the file path portion
        const pathStart = 8; // After "/attach "
        const pathEnd = pathStart + attachInfo.filePath.length;

        if (cursorOffset >= pathStart && cursorOffset <= pathEnd) {
          // Cursor is in file path
          const pathCursorPos = cursorOffset - pathStart;
          const pathBefore = attachInfo.filePath.slice(0, pathCursorPos);
          const pathCursor = attachInfo.filePath[pathCursorPos] || " ";
          const pathAfter = attachInfo.filePath.slice(pathCursorPos + 1);

          parts.push(
            <Text key="path" color={pathColor}>
              {pathBefore}<Text inverse>{pathCursor}</Text>{pathAfter}
              <Text color={attachInfo.fileExists === true ? theme.success : attachInfo.fileExists === false ? theme.error : theme.text.muted}>{pathIndicator}</Text>
            </Text>
          );
        } else {
          parts.push(
            <Text key="path" color={pathColor}>
              {attachInfo.filePath}
              <Text color={attachInfo.fileExists === true ? theme.success : attachInfo.fileExists === false ? theme.error : theme.text.muted}>{pathIndicator}</Text>
            </Text>
          );
        }

        // Message part (if any)
        if (attachInfo.message || attachInfo.stage === "message") {
          parts.push(<Text key="sp2"> </Text>);

          const msgStart = 8 + attachInfo.filePath.length + 1;
          if (cursorOffset >= msgStart) {
            const msgCursorPos = cursorOffset - msgStart;
            const msgBefore = attachInfo.message.slice(0, msgCursorPos);
            const msgCursor = attachInfo.message[msgCursorPos] || " ";
            const msgAfter = attachInfo.message.slice(msgCursorPos + 1);

            parts.push(
              <Text key="msg" color={theme.text.primary}>
                {msgBefore}<Text inverse>{msgCursor}</Text>{msgAfter}
              </Text>
            );
          } else {
            parts.push(
              <Text key="msg" color={theme.text.primary}>{attachInfo.message}</Text>
            );
          }
        } else if (cursorOffset > pathEnd) {
          // Cursor after path, before message
          parts.push(<Text key="cursor" inverse> </Text>);
        }
      } else {
        // No file path yet, show cursor
        parts.push(<Text key="cursor" inverse> </Text>);
      }
    } else if (cursorOffset >= value.length) {
      // Cursor at end of partial command
      parts.push(<Text key="cursor" inverse> </Text>);
    }

    return <Text>{parts}</Text>;
  };

  // Hint text for /attach command
  const getHint = () => {
    if (!attachInfo.isAttachCommand || !focus) return null;

    if (attachInfo.stage === "command" && !value.includes(" ")) {
      return <Text color={theme.text.muted}> (type file path next)</Text>;
    }
    if (attachInfo.stage === "filepath" && attachInfo.filePath && attachInfo.fileExists === true) {
      return <Text color={theme.text.muted}> (press space to add caption, or Enter to send)</Text>;
    }
    if (attachInfo.stage === "filepath" && attachInfo.filePath && attachInfo.fileExists === false) {
      return <Text color={theme.error}> (file not found)</Text>;
    }
    if (attachInfo.stage === "filepath" && !attachInfo.filePath) {
      return <Text color={theme.text.muted}> (enter file path)</Text>;
    }
    return null;
  };

  return (
    <Box
      flexDirection="column"
    >
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
        {getHint()}
      </Box>
    </Box>
  );
}

export default memo(MessageInput);
