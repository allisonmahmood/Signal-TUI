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

    test("getConversationLastMessage should return null for conversation with no messages", async () => {
        const result = storage.getConversationLastMessage("+9999999999");
        expect(result).toBeNull();

        storage.close();
        await unlink(dbPath);
    });

    test("getConversationLastMessage should return the most recent message", async () => {
        const conversationId = "+1234567890";
        const olderTimestamp = 1000000;
        const newerTimestamp = 2000000;

        storage.addMessage({
            id: "msg1",
            sender: "+1234567890",
            content: "First message",
            timestamp: olderTimestamp,
            isOutgoing: false
        }, conversationId);

        storage.addMessage({
            id: "msg2",
            sender: "+1234567890",
            content: "Second message",
            timestamp: newerTimestamp,
            isOutgoing: true
        }, conversationId);

        const result = storage.getConversationLastMessage(conversationId);
        expect(result).not.toBeNull();
        expect(result!.timestamp).toBe(newerTimestamp);
        expect(result!.content).toBe("Second message");

        storage.close();
        await unlink(dbPath);
    });

    test("getAllConversationMetadata should return empty map when no messages exist", async () => {
        const metadata = storage.getAllConversationMetadata();
        expect(metadata.size).toBe(0);

        storage.close();
        await unlink(dbPath);
    });

    test("getAllConversationMetadata should return metadata for single conversation", async () => {
        const conversationId = "+1234567890";
        const timestamp = Date.now();

        storage.addMessage({
            id: "msg1",
            sender: conversationId,
            content: "Test message",
            timestamp: timestamp,
            isOutgoing: false
        }, conversationId);

        const metadata = storage.getAllConversationMetadata();
        expect(metadata.size).toBe(1);

        const meta = metadata.get(conversationId);
        expect(meta).toBeDefined();
        expect(meta!.timestamp).toBe(timestamp);
        expect(meta!.content).toBe("Test message");

        storage.close();
        await unlink(dbPath);
    });

    test("getAllConversationMetadata should return metadata for multiple conversations", async () => {
        const conv1 = "+1234567890";
        const conv2 = "+0987654321";
        const timestamp1 = Date.now();
        const timestamp2 = timestamp1 + 1000;

        storage.addMessage({
            id: "msg1",
            sender: conv1,
            content: "Message from conv1",
            timestamp: timestamp1,
            isOutgoing: false
        }, conv1);

        storage.addMessage({
            id: "msg2",
            sender: conv2,
            content: "Message from conv2",
            timestamp: timestamp2,
            isOutgoing: true
        }, conv2);

        const metadata = storage.getAllConversationMetadata();
        expect(metadata.size).toBe(2);

        expect(metadata.get(conv1)!.timestamp).toBe(timestamp1);
        expect(metadata.get(conv2)!.timestamp).toBe(timestamp2);

        storage.close();
        await unlink(dbPath);
    });

    test("getAllConversationMetadata should use MAX timestamp for multiple messages per conversation", async () => {
        const conversationId = "+1234567890";
        const timestamps = [1000, 5000, 3000, 7000];

        timestamps.forEach((ts, i) => {
            storage.addMessage({
                id: `msg${i}`,
                sender: conversationId,
                content: `Message ${i}`,
                timestamp: ts,
                isOutgoing: i % 2 === 0
            }, conversationId);
        });

        const metadata = storage.getAllConversationMetadata();
        const meta = metadata.get(conversationId);

        expect(meta!.timestamp).toBe(7000);
        expect(meta!.content).toBe("Message 3");

        storage.close();
        await unlink(dbPath);
    });
});
