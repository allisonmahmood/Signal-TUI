import { Box, Text } from "ink";
import { useState, useEffect } from "react";
import qrcode from "qrcode-terminal";
import { theme } from "../theme.ts";

export type LinkStatus = "loading" | "waiting" | "success" | "error";

interface OnboardingProps {
  linkUri: string | null;
  status: LinkStatus;
  errorMessage?: string;
}

/**
 * Generates a QR code string for display in the terminal
 */
function generateQRCode(uri: string): Promise<string> {
  return new Promise((resolve) => {
    qrcode.generate(uri, { small: true }, (qr: string) => {
      resolve(qr);
    });
  });
}

export default function Onboarding({ linkUri, status, errorMessage }: OnboardingProps) {
  const [qrCode, setQrCode] = useState<string>("");

  useEffect(() => {
    if (linkUri && status === "waiting") {
      generateQRCode(linkUri).then(setQrCode);
    }
  }, [linkUri, status]);

  const renderContent = () => {
    switch (status) {
      case "loading":
        return (
          <Box flexDirection="column" alignItems="center">
            <Text color={theme.primary}>Connecting to Signal CLI...</Text>
            <Text color={theme.text.muted}>Please wait</Text>
          </Box>
        );

      case "waiting":
        return (
          <Box flexDirection="column" alignItems="center">
            {/* QR Code Display */}
            <Box marginBottom={1}>
              <Text>{qrCode}</Text>
            </Box>

            {/* Instructions */}
            <Box
              flexDirection="column"
              borderStyle="round"
              borderColor={theme.border.focused}
              paddingX={2}
              paddingY={1}
            >
              <Text bold color={theme.primary}>
                Link Your Signal Account
              </Text>
              <Text> </Text>
              <Text>
                <Text color={theme.warning}>1.</Text> Open <Text bold>Signal</Text> on your phone
              </Text>
              <Text>
                <Text color={theme.warning}>2.</Text> Go to <Text bold>Settings</Text> {"\u2192"} <Text bold>Linked Devices</Text>
              </Text>
              <Text>
                <Text color={theme.warning}>3.</Text> Tap the <Text bold>+</Text> button
              </Text>
              <Text>
                <Text color={theme.warning}>4.</Text> Scan this QR code
              </Text>
              <Text> </Text>
              <Text color={theme.text.muted}>Waiting for you to scan...</Text>
            </Box>
          </Box>
        );

      case "success":
        return (
          <Box flexDirection="column" alignItems="center">
            <Text color={theme.success} bold>
              {theme.symbols.connected} Device Linked Successfully!
            </Text>
            <Text color={theme.text.muted}>Redirecting to chat...</Text>
          </Box>
        );

      case "error":
        return (
          <Box flexDirection="column" alignItems="center">
            <Text color={theme.error} bold>
              {"\u2717"} Linking Failed
            </Text>
            <Text color={theme.error}>{errorMessage || "An unknown error occurred"}</Text>
            <Text color={theme.text.muted}>Press Ctrl+C to exit and try again</Text>
          </Box>
        );
    }
  };

  return (
    <Box
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      width="100%"
      height="100%"
      borderStyle="round"
      borderColor={theme.border.unfocused}
      paddingX={2}
      paddingY={1}
    >
      {/* Header */}
      <Box marginBottom={2}>
        <Text bold color={theme.primary}>
          Welcome to Signal TUI
        </Text>
      </Box>

      {/* Content based on status */}
      {renderContent()}

      {/* Footer */}
      <Box marginTop={2}>
        <Text color={theme.text.muted}>Press Ctrl+C to exit</Text>
      </Box>
    </Box>
  );
}
