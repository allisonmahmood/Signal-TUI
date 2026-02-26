import { EventEmitter } from "node:events";
import { describe, expect, test } from "bun:test";
import { render } from "ink-testing-library";
import type { ChatMessage, Conversation } from "../../types/types.ts";
import type { MessageStorage } from "../../core/MessageStorage.ts";
import ChatArea from "./ChatArea.tsx";

class MockStorage extends EventEmitter {
  constructor(private readonly historyByConversation: Map<string, ChatMessage[]>) {
    super();
  }

  getMessages(conversationId: string): ChatMessage[] {
    return this.historyByConversation.get(conversationId) ?? [];
  }
}

async function waitFor(condition: () => boolean, timeoutMs: number = 700): Promise<void> {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error("Timed out waiting for condition");
    }
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

function createConversation(): Conversation {
  return {
    id: "conv-1",
    type: "contact",
    displayName: "Alice",
  };
}

function createMessage(index: number): ChatMessage {
  return {
    id: `m-${index}`,
    sender: "+10000000000",
    content: `Message ${index}`,
    timestamp: 1_700_000_000_000 + index * 1_000,
    isOutgoing: index % 2 === 0,
    status: "sent",
  };
}

describe("ChatArea", () => {
  test("renders loading and onboarding states", () => {
    const loading = render(<ChatArea currentView="loading" />);
    expect(loading.lastFrame()).toContain("Connecting to Signal...");
    loading.unmount();

    const onboarding = render(<ChatArea currentView="onboarding" />);
    expect(onboarding.lastFrame()).toContain("Welcome to Signal TUI");
    onboarding.unmount();
  });

  test("renders chat placeholder when no conversation is selected", () => {
    const app = render(<ChatArea currentView="chat" />);
    expect(app.lastFrame()).toContain("Select a conversation from the sidebar");
    app.unmount();
  });

  test("loads history and applies storage events for selected conversation", async () => {
    const conversation = createConversation();
    const storage = new MockStorage(
      new Map([[conversation.id, [createMessage(1)]]])
    ) as unknown as MessageStorage;

    const app = render(
      <ChatArea
        currentView="chat"
        selectedConversation={conversation}
        storage={storage}
        focusArea="chat"
      />
    );

    await waitFor(() => (app.lastFrame() ?? "").includes("Message 1"));

    const added = createMessage(2);
    storage.emit("new-message", added, conversation.id);
    await waitFor(() => (app.lastFrame() ?? "").includes("Message 2"));

    storage.emit("new-message", createMessage(99), "different-conversation");
    await new Promise(resolve => setTimeout(resolve, 30));
    expect(app.lastFrame() ?? "").not.toContain("Message 99");

    storage.emit("message-replaced", added.id, { ...added, content: "Message 2 edited" });
    await waitFor(() => (app.lastFrame() ?? "").includes("Message 2 edited"));

    app.unmount();
  });

  test("routes keyboard input based on focus area", async () => {
    const conversation = createConversation();
    const history = Array.from({ length: 28 }, (_, i) => createMessage(i));
    const sharedStorage = new MockStorage(
      new Map([[conversation.id, history]])
    ) as unknown as MessageStorage;

    const inputFocused = render(
      <ChatArea
        currentView="chat"
        selectedConversation={conversation}
        storage={sharedStorage}
        focusArea="input"
      />
    );

    await waitFor(() => (inputFocused.lastFrame() ?? "").includes("Message 27"));
    inputFocused.stdin.write("k");
    await waitFor(() => (inputFocused.lastFrame() ?? "").includes("› k"));
    inputFocused.unmount();

    const chatFocused = render(
      <ChatArea
        currentView="chat"
        selectedConversation={conversation}
        storage={sharedStorage}
        focusArea="chat"
      />
    );

    await waitFor(() => (chatFocused.lastFrame() ?? "").includes("Message 27"));
    chatFocused.stdin.write("k");
    await new Promise(resolve => setTimeout(resolve, 30));
    expect(chatFocused.lastFrame() ?? "").toContain("› Type a message...");
    expect(chatFocused.lastFrame() ?? "").not.toContain("› k");
    chatFocused.unmount();
  });
});
