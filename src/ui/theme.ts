/**
 * Centralized theme system for Signal-TUI
 * Inspired by lazygit, Claude Code, and LazyVim
 */

export const theme = {
  // Primary colors
  primary: "cyan",
  secondary: "blue",
  accent: "magenta",

  // Semantic colors
  success: "green",
  warning: "yellow",
  error: "red",

  // UI chrome
  border: {
    focused: "cyan",
    unfocused: "#444",
    active: "white",
  },

  // Text colors
  text: {
    primary: "white",
    secondary: "#888",
    muted: "#555",
    highlight: "cyan",
  },

  // Message bubbles
  message: {
    outgoing: {
      border: "green",
      sender: "green",
    },
    incoming: {
      border: "#555",
      sender: "blue",
    },
  },

  // Status indicators
  status: {
    online: "green",
    offline: "#555",
    typing: "yellow",
    sent: "#888",
    delivered: "#888",
    read: "#888",
    failed: "red",
  },

  // Conversation symbols
  symbols: {
    group: "#",
    contact: "@",
    selected: ">",
    connected: "\u25CF", // ●
    disconnected: "\u25CB", // ○
  },
} as const;

export type Theme = typeof theme;
