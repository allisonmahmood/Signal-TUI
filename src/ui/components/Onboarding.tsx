import { Box, Text } from "ink";
import { useState, useEffect } from "react";
import qrcode from "qrcode-terminal";

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
            <Text color="cyan">⏳ Connecting to Signal CLI...</Text>
            <Text dimColor>Please wait</Text>
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
              borderColor="cyan"
              paddingX={2}
              paddingY={1}
            >
              <Text bold color="cyan">
                📱 Link Your Signal Account
              </Text>
              <Text> </Text>
              <Text>
                <Text color="yellow">1.</Text> Open <Text bold>Signal</Text> on your phone
              </Text>
              <Text>
                <Text color="yellow">2.</Text> Go to <Text bold>Settings</Text> → <Text bold>Linked Devices</Text>
              </Text>
              <Text>
                <Text color="yellow">3.</Text> Tap the <Text bold>+</Text> button
              </Text>
              <Text>
                <Text color="yellow">4.</Text> Scan this QR code
              </Text>
              <Text> </Text>
              <Text dimColor>Waiting for you to scan...</Text>
            </Box>
          </Box>
        );

      case "success":
        return (
          <Box flexDirection="column" alignItems="center">
            <Text color="green" bold>
              ✓ Device Linked Successfully!
            </Text>
            <Text dimColor>Redirecting to chat...</Text>
          </Box>
        );

      case "error":
        return (
          <Box flexDirection="column" alignItems="center">
            <Text color="red" bold>
              ✗ Linking Failed
            </Text>
            <Text color="red">{errorMessage || "An unknown error occurred"}</Text>
            <Text dimColor>Press Ctrl+C to exit and try again</Text>
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
      borderColor="gray"
      paddingX={2}
      paddingY={1}
    >
      {/* Header */}
      <Box marginBottom={2}>
        <Text bold color="cyan">
          👋 Welcome to Signal TUI
        </Text>
      </Box>

      {/* Content based on status */}
      {renderContent()}

      {/* Footer */}
      <Box marginTop={2}>
        <Text dimColor>Press Ctrl+C to exit</Text>
      </Box>
    </Box>
  );
}
