import { EventEmitter } from "node:events";
import { useState } from "react";
import { describe, expect, test } from "bun:test";
import { render } from "ink-testing-library";
import type { SignalClient } from "../../core/SignalClient.ts";
import type { MessageStorage } from "../../core/MessageStorage.ts";
import Sidebar from "./Sidebar.tsx";

class MockStorage extends EventEmitter {
  constructor(private readonly metadata: Map<string, { timestamp: number; content: string }>) {
    super();
  }

  getAllConversationMetadata() {
    return this.metadata;
  }
}

async function waitFor(condition: () => boolean, timeoutMs: number = 500): Promise<void> {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error("Timed out waiting for condition");
    }
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

describe("Sidebar", () => {
  test("loads conversations and reports conversation count", async () => {
    const counts: number[] = [];
    const client = {
      listContacts: async () => [
        { number: "+1", name: "Alice" },
        { number: "+2", name: "Bob" },
      ],
      listGroups: async () => [],
    } as unknown as SignalClient;

    const storage = new MockStorage(
      new Map([
        ["+1", { timestamp: 200, content: "hello from alice" }],
        ["+2", { timestamp: 100, content: "hello from bob" }],
      ])
    ) as unknown as MessageStorage;

    const app = render(
      <Sidebar
        currentView="chat"
        client={client}
        storage={storage}
        focusArea="sidebar"
        searchMode={false}
        setSearchMode={() => {}}
        onConversationCountChange={(count) => counts.push(count)}
      />
    );

    await waitFor(() => counts.includes(2));
    expect(counts[counts.length - 1]).toBe(2);
    app.unmount();
  });

  test("enters search mode and filters conversations from keyboard input", async () => {
    const client = {
      listContacts: async () => [
        { number: "+1", name: "Alice" },
        { number: "+2", name: "Bob" },
      ],
      listGroups: async () => [],
    } as unknown as SignalClient;

    const storage = new MockStorage(
      new Map([
        ["+1", { timestamp: 200, content: "a" }],
        ["+2", { timestamp: 100, content: "b" }],
      ])
    ) as unknown as MessageStorage;

    const Harness = () => {
      const [searchMode, setSearchMode] = useState(false);
      return (
        <Sidebar
          currentView="chat"
          client={client}
          storage={storage}
          focusArea="sidebar"
          searchMode={searchMode}
          setSearchMode={setSearchMode}
        />
      );
    };

    const app = render(<Harness />);

    await waitFor(() => (app.lastFrame() ?? "").includes("Alice"));
    app.stdin.write("/");
    await waitFor(() => (app.lastFrame() ?? "").includes("/"));
    app.stdin.write("z");
    await waitFor(() => (app.lastFrame() ?? "").includes("No matches"));

    expect(app.lastFrame() ?? "").toContain("No matches");
    app.unmount();
  });
});
