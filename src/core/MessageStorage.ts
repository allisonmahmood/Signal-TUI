import { Database } from "bun:sqlite";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { homedir } from "node:os";
import { join } from "node:path";
import { EventEmitter } from "node:events";
import type { ChatMessage } from "../types/types";

export class MessageStorage extends EventEmitter {
  private db: Database;
  private initialized: boolean = false;

  constructor() {
    super();
    // Database path: ~/.signal-tui/db.sqlite
    const dbPath = join(homedir(), ".signal-tui", "db.sqlite");
    
    // Ensure directory exists (sync for constructor, but mkdir is usually fast)
    // We'll do it lazily in init() to be async-safe
    this.db = new Database(dbPath, { create: true });
  }

  /**
   * Initialize the database schema
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    // Ensure directory exists
    const dbDir = dirname(this.db.filename);
    await mkdir(dbDir, { recursive: true });

    // Create tables
      this.db.query(`
        CREATE TABLE IF NOT EXISTS messages (
          id TEXT PRIMARY KEY,
          conversation_id TEXT NOT NULL,
          sender TEXT NOT NULL,
          sender_name TEXT,
          content TEXT,
          timestamp INTEGER NOT NULL,
          is_outgoing INTEGER NOT NULL,
          status TEXT DEFAULT 'sent'
        )
      `).run();
      
      // Auto-migrate: Try to add status column if it doesn't exist
      try {
        this.db.query("ALTER TABLE messages ADD COLUMN status TEXT DEFAULT 'sent'").run();
      } catch (e) {
        // Ignore error if column likely exists
      }

      this.db.query(`
      CREATE INDEX IF NOT EXISTS idx_conversation_timestamp 
      ON messages(conversation_id, timestamp);
    `);

    this.initialized = true;
  }

  /**
   * Add a message to the database
   */
  addMessage(msg: ChatMessage, conversationId: string): void {
    const query = this.db.query(`
      INSERT OR REPLACE INTO messages (
        id, conversation_id, sender, sender_name, content, timestamp, is_outgoing, status
      ) VALUES (
        $id, $conversation_id, $sender, $sender_name, $content, $timestamp, $is_outgoing, $status
      )
    `);

    query.run({
      $id: msg.id,
      $conversation_id: conversationId,
      $sender: msg.sender,
      $sender_name: msg.senderName || null,
      $content: msg.content,
      $timestamp: msg.timestamp,
      $is_outgoing: msg.isOutgoing ? 1 : 0,
      $status: msg.status || "sent"
    });

    this.emit("new-message", msg, conversationId);
  }

  /**
   * Get recent messages for a conversation
   */
  getMessages(conversationId: string, limit: number = 50, beforeTimestamp?: number): ChatMessage[] {
    let sql = `
      SELECT * FROM messages 
      WHERE conversation_id = $conversation_id
    `;
    
    const params: any = {
      $conversation_id: conversationId,
      $limit: limit
    };

    if (beforeTimestamp) {
      sql += ` AND timestamp < $beforeTimestamp`;
      params.$beforeTimestamp = beforeTimestamp;
    }

    sql += ` ORDER BY timestamp DESC LIMIT $limit`;

    const query = this.db.query(sql);
    const rows = query.all(params) as any[];

    // Convert back to ChatMessage objects and reverse (so oldest is first)
    return rows.map(row => ({
      id: row.id,
      sender: row.sender,
      senderName: row.sender_name || undefined,
      content: row.content,
      timestamp: row.timestamp,
      isOutgoing: Boolean(row.is_outgoing),
      status: row.status as "sent" | "delivered" | "read" | undefined
    })).reverse();
  }

  updateMessageStatus(timestamp: number, status: "sent" | "delivered" | "read"): void {
    const query = this.db.query(`
      UPDATE messages 
      SET status = $status 
      WHERE timestamp = $timestamp AND is_outgoing = 1
    `);
    
    query.run({
      $status: status,
      $timestamp: timestamp
    });
  }
  /**
   * Close the database connection
   */
  close(): void {
    this.db.close();
  }
}
