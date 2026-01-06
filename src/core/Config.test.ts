import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { loadConfig, findSignalCliPath, getConfigInstructions } from "./Config.ts";

describe("Config", () => {
    const originalEnv = process.env.SIGNAL_CLI_PATH;

    beforeEach(() => {
        // Clear env var for clean tests
        delete process.env.SIGNAL_CLI_PATH;
    });

    afterEach(() => {
        // Restore env
        if (originalEnv !== undefined) {
            process.env.SIGNAL_CLI_PATH = originalEnv;
        } else {
            delete process.env.SIGNAL_CLI_PATH;
        }
    });

    describe("loadConfig", () => {
        test("returns an object", () => {
            const config = loadConfig();
            expect(typeof config).toBe("object");
            expect(config).not.toBeNull();
        });

        test("returns object with optional signalCliPath property", () => {
            const config = loadConfig();
            // Config may or may not have signalCliPath depending on user's setup
            expect(config.signalCliPath === undefined || typeof config.signalCliPath === "string").toBe(true);
        });
    });

    describe("findSignalCliPath", () => {
        test("returns SIGNAL_CLI_PATH env var when set", () => {
            process.env.SIGNAL_CLI_PATH = "/custom/path/signal-cli";
            const path = findSignalCliPath();
            expect(path).toBe("/custom/path/signal-cli");
        });

        test("returns string or null", () => {
            // Without env var, result depends on system configuration
            const path = findSignalCliPath();
            expect(typeof path === "string" || path === null).toBe(true);
        });

        test("prefers env var over common paths", () => {
            process.env.SIGNAL_CLI_PATH = "/env/path/signal-cli";
            const path = findSignalCliPath();
            // Should return env path even if common paths exist
            expect(path).toBe("/env/path/signal-cli");
        });
    });

    describe("getConfigInstructions", () => {
        test("returns a non-empty string", () => {
            const instructions = getConfigInstructions();
            expect(typeof instructions).toBe("string");
            expect(instructions.length).toBeGreaterThan(0);
        });

        test("contains 'signal-cli not found' message", () => {
            const instructions = getConfigInstructions();
            expect(instructions).toContain("signal-cli not found");
        });

        test("lists all searched common paths", () => {
            const instructions = getConfigInstructions();
            expect(instructions).toContain("/usr/bin/signal-cli");
            expect(instructions).toContain("/usr/local/bin/signal-cli");
            expect(instructions).toContain("/opt/homebrew/bin/signal-cli");
        });

        test("mentions SIGNAL_CLI_PATH environment variable", () => {
            const instructions = getConfigInstructions();
            expect(instructions).toContain("SIGNAL_CLI_PATH");
        });

        test("shows example config.json format", () => {
            const instructions = getConfigInstructions();
            expect(instructions).toContain("signalCliPath");
            expect(instructions).toContain("/path/to/your/signal-cli");
        });

        test("mentions config file location", () => {
            const instructions = getConfigInstructions();
            expect(instructions).toContain("config.json");
        });
    });
});
