import { describe, expect, test } from "bun:test";
import { theme } from "./theme.ts";

describe("theme", () => {
    test("has all required primary colors", () => {
        expect(theme.primary).toBe("cyan");
        expect(theme.secondary).toBe("blue");
        expect(theme.accent).toBe("magenta");
    });

    test("has all required semantic colors", () => {
        expect(theme.success).toBe("green");
        expect(theme.warning).toBe("yellow");
        expect(theme.error).toBe("red");
    });

    test("has border configuration for all states", () => {
        expect(theme.border.focused).toBe("cyan");
        expect(theme.border.unfocused).toBe("#444");
        expect(theme.border.active).toBe("white");
    });

    test("has text color hierarchy", () => {
        expect(theme.text.primary).toBe("white");
        expect(theme.text.secondary).toBe("#888");
        expect(theme.text.muted).toBe("#555");
        expect(theme.text.highlight).toBe("cyan");
    });

    test("has message bubble colors for both directions", () => {
        expect(theme.message.outgoing.border).toBe("green");
        expect(theme.message.outgoing.sender).toBe("green");
        expect(theme.message.incoming.border).toBe("#555");
        expect(theme.message.incoming.sender).toBe("blue");
    });

    test("has all status indicators", () => {
        expect(theme.status.online).toBe("green");
        expect(theme.status.offline).toBe("#555");
        expect(theme.status.typing).toBe("yellow");
        expect(theme.status.sent).toBe("#888");
        expect(theme.status.delivered).toBe("#888");
        expect(theme.status.read).toBe("#888");
        expect(theme.status.failed).toBe("red");
    });

    test("has all required symbols", () => {
        expect(theme.symbols.group).toBe("#");
        expect(theme.symbols.contact).toBe("@");
        expect(theme.symbols.selected).toBe(">");
        expect(theme.symbols.connected).toBe("\u25CF"); // Filled circle ●
        expect(theme.symbols.disconnected).toBe("\u25CB"); // Empty circle ○
    });

    test("theme object has expected structure", () => {
        // Verify all top-level keys exist
        expect(theme).toHaveProperty("primary");
        expect(theme).toHaveProperty("secondary");
        expect(theme).toHaveProperty("accent");
        expect(theme).toHaveProperty("success");
        expect(theme).toHaveProperty("warning");
        expect(theme).toHaveProperty("error");
        expect(theme).toHaveProperty("border");
        expect(theme).toHaveProperty("text");
        expect(theme).toHaveProperty("message");
        expect(theme).toHaveProperty("status");
        expect(theme).toHaveProperty("symbols");
    });
});
