import type { Conversation } from "../types/types.ts";

export function sortByRecency(convs: Conversation[]): Conversation[] {
  return convs.sort((a, b) => {
    const aTime = a.lastMessageTime || 0;
    const bTime = b.lastMessageTime || 0;

    if (aTime > 0 && bTime > 0) {
      return bTime - aTime;
    }
    if (aTime > 0) return -1;
    if (bTime > 0) return 1;
    return a.displayName.localeCompare(b.displayName);
  });
}
