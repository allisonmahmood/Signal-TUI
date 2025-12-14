import { describe, expect, test, afterAll, beforeEach } from "bun:test";
import { MessageStorage } from "./MessageStorage";
import { unlink } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

// Helper to create a unique DB path for each test
const getTestDbPath = () => join(homedir(), ".signal-tui", `test-db-${Date.now()}-${Math.random()}.sqlite`);

describe("MessageStorage", () => {
    let storage: MessageStorage;
    let dbPath: string;

    beforeEach(async () => {
        dbPath = getTestDbPath();
        storage = new MessageStorage(dbPath);
        await storage.init();
    });

    afterAll(async () => {
        // Cleanup happens in individual tests usually, but here we can try to be clean
    });

    test("should initialize database tables", async () => {
        // Just by invoking init() in beforeEach, we are testing it doesn't crash
        expect(storage).toBeDefined();
        storage.close();
        await unlink(dbPath);
    });

    test("should save and retrieve a message", async () => {
        const msg = {
            id: "123",
            sender: "+1234567890",
            content: "Hello World",
            timestamp: Date.now(),
            isOutgoing: false,
            status: "delivered" as const
        };
        const conversationId = "+1234567890";

        storage.addMessage(msg, conversationId);

        const retrieved = storage.getMessages(conversationId);
        expect(retrieved.length).toBe(1);
        expect(retrieved[0]!.content).toBe("Hello World");
        expect(retrieved[0]!.id).toBe("123");
        
        storage.close();
        await unlink(dbPath);
    });

    test("should emit new-message event when adding a message", async () => {
        const msg = {
            id: "456",
            sender: "+1234567890",
            content: "Event Test",
            timestamp: Date.now(),
            isOutgoing: false
        };
        const conversationId = "+1234567890";

        // Create a promise wrapper for the event
        const eventPromise = new Promise<{msg: any, convId: string}>((resolve) => {
             storage.on("new-message", (emittedMsg, emittedConvId) => {
                resolve({ msg: emittedMsg, convId: emittedConvId });
            });
        });

        storage.addMessage(msg, conversationId);
        
        const result = await eventPromise;
        expect(result.msg.content).toBe("Event Test");
        expect(result.convId).toBe(conversationId);

        storage.close();
        await unlink(dbPath);
    });

    test("should update message status", async () => {
        const timestamp = Date.now();
        const msg = {
            id: "789",
            sender: "Me",
            content: "Status Test",
            timestamp: timestamp,
            isOutgoing: true,
            status: "sent" as const
        };
        const conversationId = "+1234567890";

        storage.addMessage(msg, conversationId);
        storage.updateMessageStatus(timestamp, "read");

        const retrieved = storage.getMessages(conversationId);
        expect(retrieved[0]!.status).toBe("read");

        storage.close();
        await unlink(dbPath);
    });
});
