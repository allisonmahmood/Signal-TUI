import { useState } from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";

interface MessageInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export default function MessageInput({ onSend, disabled }: MessageInputProps) {
  const [value, setValue] = useState("");

  const handleSubmit = (newValue: string) => {
    if (newValue.trim() && !disabled) {
      onSend(newValue.trim());
      setValue("");
    }
  };

  return (
    <Box
      borderStyle="single"
      borderTop
      borderBottom={false}
      borderLeft={false}
      borderRight={false}
      borderColor="gray"
    >
      <Text color="cyan">› </Text>
      <TextInput
        value={value}
        onChange={setValue}
        onSubmit={handleSubmit}
        placeholder={disabled ? "Select a conversation..." : "Type a message..."}
      />
    </Box>
  );
}
