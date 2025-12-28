import { useState, memo, useRef } from "react";
import { Box, Text, useInput } from "ink";

interface MessageInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  focus?: boolean;
  onEscape?: () => void;
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
        onSend(trimmed);
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
      return <Text dimColor>Type a message...</Text>;
    }
    if (!value) {
      return <Text><Text inverse> </Text><Text dimColor>Type a message...</Text></Text>;
    }

    const before = value.slice(0, cursorOffset);
    const cursor = value[cursorOffset] || " ";
    const after = value.slice(cursorOffset + 1);

    if (focus) {
      return <Text>{before}<Text inverse>{cursor}</Text>{after}</Text>;
    }
    return <Text>{value}</Text>;
  };

  return (
    <Box
      borderStyle="single"
      borderTop
      borderBottom={false}
      borderLeft={false}
      borderRight={false}
      borderColor={focus ? "cyan" : "gray"}
    >
      <Text color={focus ? "cyan" : "gray"}>› </Text>
      {renderValue()}
    </Box>
  );
}

export default memo(MessageInput);
