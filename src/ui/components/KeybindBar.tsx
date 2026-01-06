import { memo } from "react";
import { Box, Text } from "ink";
import { theme } from "../theme.ts";
import type { FocusArea } from "../App.tsx";

interface Keybind {
  key: string;
  action: string;
}

interface KeybindBarProps {
  focusArea: FocusArea;
  searchMode?: boolean;
}

const sidebarBindings: Keybind[] = [
  { key: "j/k", action: "navigate" },
  { key: "Enter", action: "select" },
  { key: "/", action: "search" },
  { key: "Tab", action: "switch" },
  { key: "q", action: "quit" },
];

const sidebarSearchBindings: Keybind[] = [
  { key: "Enter", action: "select" },
  { key: "Esc", action: "cancel" },
  { key: "Tab", action: "switch" },
];

const chatBindings: Keybind[] = [
  { key: "j/k", action: "scroll" },
  { key: "G", action: "bottom" },
  { key: "gg", action: "top" },
  { key: "Tab", action: "switch" },
  { key: "q", action: "quit" },
];

const inputBindings: Keybind[] = [
  { key: "Enter", action: "send" },
  { key: "Esc", action: "cancel" },
  { key: "C-u", action: "clear" },
];

function getBindings(focusArea: FocusArea, searchMode: boolean): Keybind[] {
  if (focusArea === "sidebar") {
    return searchMode ? sidebarSearchBindings : sidebarBindings;
  }
  if (focusArea === "chat") {
    return chatBindings;
  }
  return inputBindings;
}

function KeybindBar({ focusArea, searchMode = false }: KeybindBarProps) {
  const bindings = getBindings(focusArea, searchMode);

  return (
    <Box flexDirection="row" justifyContent="center" gap={2} paddingX={1}>
      {bindings.map(({ key, action }) => (
        <Box key={key} flexDirection="row">
          <Text backgroundColor={theme.text.muted} color={theme.primary}>
            {` ${key} `}
          </Text>
          <Text color={theme.text.secondary}> {action}</Text>
        </Box>
      ))}
    </Box>
  );
}

export default memo(KeybindBar);
