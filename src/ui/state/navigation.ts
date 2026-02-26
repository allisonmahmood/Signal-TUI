/**
 * Focus areas in the chat application.
 */
export type FocusArea = "sidebar" | "chat" | "input";

export interface ListNavigationState {
  selectedIndex: number;
  scrollOffset: number;
  listHeight: number;
  itemCount: number;
}

export interface ChatScrollState {
  scrollOffset: number;
  messageCount: number;
  visibleCount: number;
}

/**
 * Cycle focus through sidebar -> chat -> input -> sidebar.
 */
export function getNextFocusArea(current: FocusArea): FocusArea {
  if (current === "sidebar") return "chat";
  if (current === "chat") return "input";
  return "sidebar";
}

/**
 * Move list selection by one row and maintain visible scroll window.
 */
export function moveListSelection(
  state: ListNavigationState,
  direction: -1 | 1
): Pick<ListNavigationState, "selectedIndex" | "scrollOffset"> {
  if (state.itemCount <= 0) {
    return { selectedIndex: 0, scrollOffset: 0 };
  }

  const maxIndex = state.itemCount - 1;
  const listHeight = Math.max(1, state.listHeight);
  const selectedIndex = Math.max(0, Math.min(maxIndex, state.selectedIndex + direction));

  let scrollOffset = state.scrollOffset;
  if (selectedIndex < scrollOffset) {
    scrollOffset = selectedIndex;
  } else if (selectedIndex >= scrollOffset + listHeight) {
    scrollOffset = selectedIndex - listHeight + 1;
  }

  scrollOffset = Math.max(0, Math.min(maxIndex, scrollOffset));
  return { selectedIndex, scrollOffset };
}

/**
 * Jump list selection to oldest/newest boundary while preserving viewport rules.
 */
export function jumpListSelection(
  state: ListNavigationState,
  boundary: "top" | "bottom"
): Pick<ListNavigationState, "selectedIndex" | "scrollOffset"> {
  if (state.itemCount <= 0) {
    return { selectedIndex: 0, scrollOffset: 0 };
  }

  const maxIndex = state.itemCount - 1;
  const listHeight = Math.max(1, state.listHeight);

  if (boundary === "top") {
    return { selectedIndex: 0, scrollOffset: 0 };
  }

  const selectedIndex = maxIndex;
  const scrollOffset = selectedIndex >= listHeight ? selectedIndex - listHeight + 1 : 0;
  return { selectedIndex, scrollOffset };
}

/**
 * Update message scroll offset for keyboard commands.
 */
export function updateChatScrollOffset(
  state: ChatScrollState,
  command: "up" | "down" | "pageUp" | "pageDown" | "oldest" | "newest"
): number {
  const maxOffset = Math.max(0, state.messageCount - 1);
  const pageStep = Math.max(1, state.visibleCount - 1);

  if (command === "oldest") return maxOffset;
  if (command === "newest") return 0;
  if (command === "up") return Math.min(maxOffset, state.scrollOffset + 1);
  if (command === "down") return Math.max(0, state.scrollOffset - 1);
  if (command === "pageUp") return Math.min(maxOffset, state.scrollOffset + pageStep);
  return Math.max(0, state.scrollOffset - pageStep);
}
