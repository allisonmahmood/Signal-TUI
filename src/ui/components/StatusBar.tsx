import { memo, useState, useEffect } from "react";
import { Box, Text } from "ink";
import { theme } from "../theme.ts";
import { formatCurrentTime } from "../../utils/formatTime.ts";

export type ConnectionStatus = "connected" | "disconnected" | "reconnecting";

interface StatusBarProps {
  connectionStatus: ConnectionStatus;
  accountNumber?: string;
  conversationCount: number;
}

function StatusBar({
  connectionStatus,
  accountNumber,
  conversationCount,
}: StatusBarProps) {
  const [currentTime, setCurrentTime] = useState(formatCurrentTime());

  // Update time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(formatCurrentTime());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const statusColor =
    connectionStatus === "connected"
      ? theme.status.online
      : connectionStatus === "reconnecting"
        ? theme.warning
        : theme.status.offline;

  const statusSymbol =
    connectionStatus === "connected"
      ? theme.symbols.connected
      : theme.symbols.disconnected;

  return (
    <Box
      flexDirection="row"
      justifyContent="space-between"
      paddingX={1}
      borderStyle="single"
      borderTop
      borderBottom={false}
      borderLeft={false}
      borderRight={false}
      borderColor={theme.border.unfocused}
    >
      <Box flexDirection="row" gap={1}>
        <Text bold color={theme.text.secondary}>
          Signal TUI
        </Text>
        <Text color={theme.text.muted}>|</Text>
        <Text color={statusColor}>
          {statusSymbol} {connectionStatus}
        </Text>
        {accountNumber && (
          <>
            <Text color={theme.text.muted}>|</Text>
            <Text color={theme.text.secondary}>{accountNumber}</Text>
          </>
        )}
      </Box>
      <Box flexDirection="row" gap={1}>
        <Text color={theme.text.secondary}>
          {conversationCount} conversation{conversationCount !== 1 ? "s" : ""}
        </Text>
        <Text color={theme.text.muted}>|</Text>
        <Text color={theme.text.secondary}>{currentTime}</Text>
      </Box>
    </Box>
  );
}

export default memo(StatusBar);
