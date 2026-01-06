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

    // =====================================================
    // replaceMessage tests
    // =====================================================

    test("replaceMessage should delete old message and insert new one", async () => {
        const conversationId = "+1234567890";
        const oldId = "optimistic-123";
        const oldMessage = {
            id: oldId,
            sender: "Me",
            content: "Hello",
            timestamp: Date.now(),
            isOutgoing: true,
            status: "sent" as const
        };

        storage.addMessage(oldMessage, conversationId);

        const newMessage = {
            id: "confirmed-456",
            sender: "Me",
            content: "Hello",
            timestamp: Date.now() + 100,
            isOutgoing: true,
            status: "delivered" as const
        };

        storage.replaceMessage(oldId, newMessage, conversationId);

        const messages = storage.getMessages(conversationId);
        expect(messages.length).toBe(1);
        expect(messages[0]!.id).toBe("confirmed-456");
        expect(messages.find(m => m.id === oldId)).toBeUndefined();

        storage.close();
        await unlink(dbPath);
    });

    test("replaceMessage should emit message-replaced event", async () => {
        const conversationId = "+1234567890";
        const oldId = "old-id";
        const oldMessage = {
            id: oldId,
            sender: "Me",
            content: "Test",
            timestamp: Date.now(),
            isOutgoing: true
        };

        storage.addMessage(oldMessage, conversationId);

        const eventPromise = new Promise<{ oldId: string; newMsg: any }>((resolve) => {
            storage.on("message-replaced", (emittedOldId, emittedNewMsg) => {
                resolve({ oldId: emittedOldId, newMsg: emittedNewMsg });
            });
        });

        const newMessage = {
            id: "new-id",
            sender: "Me",
            content: "Test",
            timestamp: Date.now() + 100,
            isOutgoing: true
        };

        storage.replaceMessage(oldId, newMessage, conversationId);

        const result = await eventPromise;
        expect(result.oldId).toBe(oldId);
        expect(result.newMsg.id).toBe("new-id");

        storage.close();
        await unlink(dbPath);
    });

    // =====================================================
    // Pagination with beforeTimestamp tests
    // =====================================================

    test("getMessages with beforeTimestamp should return messages before the timestamp", async () => {
        const conversationId = "+1234567890";
        const baseTime = Date.now();

        // Add 10 messages with sequential timestamps
        for (let i = 0; i < 10; i++) {
            storage.addMessage({
                id: `msg-${i}`,
                sender: "+1234567890",
                content: `Message ${i}`,
                timestamp: baseTime + i * 1000,
                isOutgoing: false
            }, conversationId);
        }

        // Get messages before message 5
        const pivotTime = baseTime + 5000;
        const messages = storage.getMessages(conversationId, 50, pivotTime);

        expect(messages.length).toBe(5);
        expect(messages.every(m => m.timestamp < pivotTime)).toBe(true);
        expect(messages[messages.length - 1]!.content).toBe("Message 4");

        storage.close();
        await unlink(dbPath);
    });

    test("getMessages with beforeTimestamp and limit should paginate correctly", async () => {
        const conversationId = "+1234567890";
        const baseTime = Date.now();

        for (let i = 0; i < 10; i++) {
            storage.addMessage({
                id: `msg-${i}`,
                sender: "+1234567890",
                content: `Message ${i}`,
                timestamp: baseTime + i * 1000,
                isOutgoing: false
            }, conversationId);
        }

        // Get last 3 messages before message 8
        const messages = storage.getMessages(conversationId, 3, baseTime + 8000);

        expect(messages.length).toBe(3);
        expect(messages[0]!.content).toBe("Message 5");
        expect(messages[2]!.content).toBe("Message 7");

        storage.close();
        await unlink(dbPath);
    });

    // =====================================================
    // Status hierarchy tests (no downgrade)
    // =====================================================

    test("updateMessageStatus should not downgrade from read to delivered", async () => {
        const timestamp = Date.now();
        const msg = {
            id: "status-test",
            sender: "Me",
            content: "Status Test",
            timestamp: timestamp,
            isOutgoing: true,
            status: "sent" as const
        };
        const conversationId = "+1234567890";

        storage.addMessage(msg, conversationId);

        // Upgrade to read
        storage.updateMessageStatus(timestamp, "read");
        let messages = storage.getMessages(conversationId);
        expect(messages[0]!.status).toBe("read");

        // Attempt to downgrade to delivered - should be ignored
        storage.updateMessageStatus(timestamp, "delivered");
        messages = storage.getMessages(conversationId);
        expect(messages[0]!.status).toBe("read"); // Still read

        storage.close();
        await unlink(dbPath);
    });

    test("updateMessageStatus should not downgrade from delivered to sent", async () => {
        const timestamp = Date.now();
        const msg = {
            id: "status-test-2",
            sender: "Me",
            content: "Status Test 2",
            timestamp: timestamp,
            isOutgoing: true,
            status: "sent" as const
        };
        const conversationId = "+1234567890";

        storage.addMessage(msg, conversationId);
        storage.updateMessageStatus(timestamp, "delivered");

        // Attempt downgrade
        storage.updateMessageStatus(timestamp, "sent");

        const messages = storage.getMessages(conversationId);
        expect(messages[0]!.status).toBe("delivered");

        storage.close();
        await unlink(dbPath);
    });

    test("updateMessageStatus should emit status-updated event on successful update", async () => {
        const timestamp = Date.now();
        const msg = {
            id: "event-test",
            sender: "Me",
            content: "Event Test",
            timestamp: timestamp,
            isOutgoing: true,
            status: "sent" as const
        };
        const conversationId = "+1234567890";

        storage.addMessage(msg, conversationId);

        const eventPromise = new Promise<{ ts: number; status: string }>((resolve) => {
            storage.on("status-updated", (emittedTs, emittedStatus) => {
                resolve({ ts: emittedTs, status: emittedStatus });
            });
        });

        storage.updateMessageStatus(timestamp, "delivered");

        const result = await eventPromise;
        expect(result.ts).toBe(timestamp);
        expect(result.status).toBe("delivered");

        storage.close();
        await unlink(dbPath);
    });
});
