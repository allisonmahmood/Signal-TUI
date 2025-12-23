import { describe, expect, test } from "bun:test";
import { sortByRecency } from "./sortByRecency";
import type { Conversation } from "../types/types.ts";

describe("sortByRecency", () => {
  test("sorts conversations with messages by most recent timestamp (descending)", () => {
    const now = Date.now();
    const conv1: Conversation = {
      id: "1",
      type: "contact",
      displayName: "Alice",
      lastMessageTime: now - 1000,
      lastMessage: "Hello"
    };
    const conv2: Conversation = {
      id: "2",
      type: "contact",
      displayName: "Bob",
      lastMessageTime: now,
      lastMessage: "Hi"
    };
    const conv3: Conversation = {
      id: "3",
      type: "contact",
      displayName: "Charlie",
      lastMessageTime: now - 5000,
      lastMessage: "Hey"
    };

    const sorted = sortByRecency([conv1, conv2, conv3]);
    expect(sorted).toEqual([conv2, conv1, conv3]);
  });

  test("places conversations without messages after those with messages", () => {
    const now = Date.now();
    const conv1: Conversation = {
      id: "1",
      type: "contact",
      displayName: "Alice",
      lastMessageTime: now,
      lastMessage: "Hello"
    };
    const conv2: Conversation = {
      id: "2",
      type: "contact",
      displayName: "Bob"
    };
    const conv3: Conversation = {
      id: "3",
      type: "contact",
      displayName: "Charlie",
      lastMessageTime: now - 1000,
      lastMessage: "Hey"
    };
    const conv4: Conversation = {
      id: "4",
      type: "contact",
      displayName: "David"
    };

    const sorted = sortByRecency([conv1, conv2, conv3, conv4]);
    expect(sorted[0]!.id).toBe("1");
    expect(sorted[1]!.id).toBe("3");
    expect(sorted[2]!.id).toBe("2");
    expect(sorted[3]!.id).toBe("4");
  });

  test("sorts no-message conversations alphabetically", () => {
    const conv1: Conversation = {
      id: "1",
      type: "contact",
      displayName: "Charlie"
    };
    const conv2: Conversation = {
      id: "2",
      type: "contact",
      displayName: "Alice"
    };
    const conv3: Conversation = {
      id: "3",
      type: "contact",
      displayName: "Bob"
    };

    const sorted = sortByRecency([conv1, conv2, conv3]);
    expect(sorted[0]!.displayName).toBe("Alice");
    expect(sorted[1]!.displayName).toBe("Bob");
    expect(sorted[2]!.displayName).toBe("Charlie");
  });

  test("handles single conversation", () => {
    const conv: Conversation = {
      id: "1",
      type: "contact",
      displayName: "Alice",
      lastMessageTime: Date.now(),
      lastMessage: "Hello"
    };

    const sorted = sortByRecency([conv]);
    expect(sorted).toEqual([conv]);
  });

  test("handles empty array", () => {
    const sorted = sortByRecency([]);
    expect(sorted).toEqual([]);
  });

  test("handles all conversations with messages", () => {
    const now = Date.now();
    const conv1: Conversation = {
      id: "1",
      type: "contact",
      displayName: "Zoe",
      lastMessageTime: now - 3000,
      lastMessage: "A"
    };
    const conv2: Conversation = {
      id: "2",
      type: "contact",
      displayName: "Adam",
      lastMessageTime: now,
      lastMessage: "B"
    };
    const conv3: Conversation = {
      id: "3",
      type: "contact",
      displayName: "Bob",
      lastMessageTime: now - 1000,
      lastMessage: "C"
    };

    const sorted = sortByRecency([conv1, conv2, conv3]);
    expect(sorted[0]!.id).toBe("2");
    expect(sorted[1]!.id).toBe("3");
    expect(sorted[2]!.id).toBe("1");
  });

  test("handles all conversations without messages", () => {
    const conv1: Conversation = {
      id: "1",
      type: "contact",
      displayName: "Charlie"
    };
    const conv2: Conversation = {
      id: "2",
      type: "contact",
      displayName: "Alice"
    };
    const conv3: Conversation = {
      id: "3",
      type: "contact",
      displayName: "Bob"
    };

    const sorted = sortByRecency([conv1, conv2, conv3]);
    expect(sorted[0]!.displayName).toBe("Alice");
    expect(sorted[1]!.displayName).toBe("Bob");
    expect(sorted[2]!.displayName).toBe("Charlie");
  });

  test("handles both contacts and groups", () => {
    const now = Date.now();
    const contact: Conversation = {
      id: "contact1",
      type: "contact",
      displayName: "Alice",
      lastMessageTime: now,
      lastMessage: "Hi"
    };
    const group1: Conversation = {
      id: "group1",
      type: "group",
      displayName: "Work Chat",
      lastMessageTime: now - 1000,
      lastMessage: "Meeting"
    };
    const group2: Conversation = {
      id: "group2",
      type: "group",
      displayName: "Family"
    };

    const sorted = sortByRecency([contact, group1, group2]);
    expect(sorted[0]!.id).toBe("contact1");
    expect(sorted[1]!.id).toBe("group1");
    expect(sorted[2]!.id).toBe("group2");
  });
});
