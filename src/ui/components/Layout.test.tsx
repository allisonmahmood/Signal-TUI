import { describe, expect, test } from "bun:test";
import { render } from "ink-testing-library";
import Layout from "./Layout.tsx";

describe("Layout", () => {
  test("renders onboarding view when loading", () => {
    const app = render(<Layout currentView="loading" />);
    expect(app.lastFrame()).toContain("Welcome to Signal TUI");
    app.unmount();
  });

  test("renders chat shell when in chat view", () => {
    const app = render(
      <Layout
        currentView="chat"
        focusArea="sidebar"
        connectionStatus="disconnected"
      />
    );

    const frame = app.lastFrame();
    expect(frame).toContain("Conversations");
    expect(frame).toContain("Select a conversation from the sidebar");
    app.unmount();
  });
});
