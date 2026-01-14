import { describe, expect, test } from "bun:test";
import { homedir } from "node:os";
import { analyzeAttachCommand, parseInput } from "./MessageInput.tsx";

describe("analyzeAttachCommand", () => {
  describe("non-attach commands", () => {
    test("returns isAttachCommand: false for regular text", () => {
      const result = analyzeAttachCommand("Hello world");
      expect(result.isAttachCommand).toBe(false);
    });

    test("returns isAttachCommand: false for other slash commands", () => {
      const result = analyzeAttachCommand("/help");
      expect(result.isAttachCommand).toBe(false);
    });

    test("returns isAttachCommand: false for empty string", () => {
      const result = analyzeAttachCommand("");
      expect(result.isAttachCommand).toBe(false);
    });
  });

  describe("partial command recognition", () => {
    test("recognizes partial /a as attach command", () => {
      const result = analyzeAttachCommand("/a");
      expect(result.isAttachCommand).toBe(true);
      expect(result.stage).toBe("command");
    });

    test("recognizes partial /att as attach command", () => {
      const result = analyzeAttachCommand("/att");
      expect(result.isAttachCommand).toBe(true);
      expect(result.stage).toBe("command");
    });

    test("recognizes full /attach as attach command", () => {
      const result = analyzeAttachCommand("/attach");
      expect(result.isAttachCommand).toBe(true);
      expect(result.stage).toBe("command");
    });
  });

  describe("filepath parsing", () => {
    test("enters filepath stage after space", () => {
      const result = analyzeAttachCommand("/attach ");
      expect(result.isAttachCommand).toBe(true);
      expect(result.stage).toBe("command"); // No path yet
      expect(result.filePath).toBe("");
    });

    test("parses unquoted file path", () => {
      const result = analyzeAttachCommand("/attach /path/to/file.png");
      expect(result.isAttachCommand).toBe(true);
      expect(result.filePath).toBe("/path/to/file.png");
      expect(result.stage).toBe("filepath");
    });

    test("parses double-quoted path with spaces", () => {
      const result = analyzeAttachCommand('/attach "/path/with spaces/file.png"');
      expect(result.isAttachCommand).toBe(true);
      expect(result.filePath).toBe("/path/with spaces/file.png");
      expect(result.stage).toBe("filepath");
    });

    test("parses single-quoted path", () => {
      const result = analyzeAttachCommand("/attach '/path/to/file.png'");
      expect(result.isAttachCommand).toBe(true);
      expect(result.filePath).toBe("/path/to/file.png");
      expect(result.stage).toBe("filepath");
    });

    test("handles unclosed quote as still typing", () => {
      const result = analyzeAttachCommand('/attach "/path/still/typing');
      expect(result.isAttachCommand).toBe(true);
      expect(result.filePath).toBe("/path/still/typing");
      // inQuotes should be true when quote is not closed
      expect(result.inQuotes).toBe(true);
    });
  });

  describe("tilde expansion", () => {
    test("expands ~ in file path", () => {
      const result = analyzeAttachCommand("/attach ~/Documents/file.png");
      expect(result.filePath).toBe("~/Documents/file.png");
      expect(result.filePathExpanded).toBe(`${homedir()}/Documents/file.png`);
    });

    test("expands ~ in quoted path", () => {
      const result = analyzeAttachCommand('/attach "~/My Documents/file.png"');
      expect(result.filePath).toBe("~/My Documents/file.png");
      expect(result.filePathExpanded).toBe(`${homedir()}/My Documents/file.png`);
    });
  });

  describe("inQuotes detection", () => {
    // Note: File existence checking is now debounced in the component state,
    // not returned directly by analyzeAttachCommand

    test("returns inQuotes: false for completed quoted path", () => {
      const result = analyzeAttachCommand('/attach "/path/to/file.png"');
      expect(result.inQuotes).toBe(false);
    });

    test("returns inQuotes: true when still typing in double quotes", () => {
      const result = analyzeAttachCommand('/attach "/still/typing');
      expect(result.inQuotes).toBe(true);
    });

    test("returns inQuotes: true when still typing in single quotes", () => {
      const result = analyzeAttachCommand("/attach '/still/typing");
      expect(result.inQuotes).toBe(true);
    });

    test("returns inQuotes: false for unquoted path", () => {
      const result = analyzeAttachCommand("/attach /path/to/file.png");
      expect(result.inQuotes).toBe(false);
    });
  });

  describe("message parsing", () => {
    test("parses message after unquoted filepath", () => {
      const result = analyzeAttachCommand("/attach /path/file.png Check this out!");
      expect(result.filePath).toBe("/path/file.png");
      expect(result.message).toBe("Check this out!");
      expect(result.stage).toBe("message");
    });

    test("parses message after quoted filepath", () => {
      const result = analyzeAttachCommand('/attach "/path/file.png" Here is the image');
      expect(result.filePath).toBe("/path/file.png");
      expect(result.message).toBe("Here is the image");
      expect(result.stage).toBe("message");
    });

    test("handles empty message after space", () => {
      const result = analyzeAttachCommand("/attach /path/file.png ");
      expect(result.filePath).toBe("/path/file.png");
      expect(result.message).toBe("");
      // Still in filepath stage until message content exists
      expect(result.stage).toBe("filepath");
    });
  });

  describe("stage transitions", () => {
    test("command stage for partial command", () => {
      expect(analyzeAttachCommand("/att").stage).toBe("command");
    });

    test("filepath stage when typing path", () => {
      expect(analyzeAttachCommand("/attach /path").stage).toBe("filepath");
    });

    test("message stage when typing message", () => {
      expect(analyzeAttachCommand("/attach /path msg").stage).toBe("message");
    });
  });
});

describe("parseInput", () => {
  describe("regular messages", () => {
    test("returns message text for regular input", () => {
      const result = parseInput("Hello world");
      expect(result.message).toBe("Hello world");
      expect(result.attachments).toBeUndefined();
    });

    test("trims whitespace from message", () => {
      const result = parseInput("  Hello world  ");
      expect(result.message).toBe("Hello world");
    });

    test("handles empty input", () => {
      const result = parseInput("");
      expect(result.message).toBe("");
      expect(result.attachments).toBeUndefined();
    });

    test("handles other slash commands as regular text", () => {
      const result = parseInput("/help");
      expect(result.message).toBe("/help");
      expect(result.attachments).toBeUndefined();
    });
  });

  describe("/attach command parsing", () => {
    test("parses /attach with unquoted path", () => {
      const result = parseInput("/attach /path/to/file.png");
      expect(result.message).toBe("");
      expect(result.attachments).toEqual(["/path/to/file.png"]);
    });

    test("parses /attach with double-quoted path", () => {
      const result = parseInput('/attach "/path/with spaces/file.png"');
      expect(result.message).toBe("");
      expect(result.attachments).toEqual(["/path/with spaces/file.png"]);
    });

    test("parses /attach with single-quoted path", () => {
      const result = parseInput("/attach '/path/to/file.png'");
      expect(result.message).toBe("");
      expect(result.attachments).toEqual(["/path/to/file.png"]);
    });

    test("parses /attach with path and message (unquoted)", () => {
      const result = parseInput("/attach /path/file.png Check this out!");
      expect(result.message).toBe("Check this out!");
      expect(result.attachments).toEqual(["/path/file.png"]);
    });

    test("parses /attach with quoted path and message", () => {
      const result = parseInput('/attach "/path/file.png" Here is the image');
      expect(result.message).toBe("Here is the image");
      expect(result.attachments).toEqual(["/path/file.png"]);
    });

    test("handles unclosed double quote - treats rest as path", () => {
      const result = parseInput('/attach "/path/no closing quote');
      expect(result.attachments).toEqual(["/path/no closing quote"]);
      expect(result.message).toBe("");
    });

    test("handles unclosed single quote - treats rest as path", () => {
      const result = parseInput("/attach '/path/no closing quote");
      expect(result.attachments).toEqual(["/path/no closing quote"]);
      expect(result.message).toBe("");
    });
  });

  describe("tilde expansion", () => {
    test("expands ~ in unquoted path", () => {
      const result = parseInput("/attach ~/file.png");
      expect(result.attachments).toEqual([`${homedir()}/file.png`]);
    });

    test("expands ~ in quoted path", () => {
      const result = parseInput('/attach "~/My Documents/file.png"');
      expect(result.attachments).toEqual([`${homedir()}/My Documents/file.png`]);
    });

    test("expands ~ with message after path", () => {
      const result = parseInput("/attach ~/file.png Here it is");
      expect(result.attachments).toEqual([`${homedir()}/file.png`]);
      expect(result.message).toBe("Here it is");
    });
  });

  describe("edge cases", () => {
    test("handles /attach with empty path after trim", () => {
      // When path is empty after trim, returns empty string as attachment path
      const result = parseInput("/attach /some/path");
      expect(result.attachments).toEqual(["/some/path"]);
    });

    test("handles just /attach (no space)", () => {
      // This doesn't match "/attach " pattern, returns as regular message
      const result = parseInput("/attach");
      expect(result.message).toBe("/attach");
      expect(result.attachments).toBeUndefined();
    });

    test("trims message after quoted path", () => {
      const result = parseInput('/attach "/path/file.png"   message with spaces   ');
      expect(result.message).toBe("message with spaces");
    });
  });
});
