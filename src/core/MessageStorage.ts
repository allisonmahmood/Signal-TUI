import { Database } from "bun:sqlite";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { homedir } from "node:os";
import { join } from "node:path";
import { EventEmitter } from "node:events";
import type { ChatMessage, Attachment } from "../types/types.ts";

export class MessageStorage extends EventEmitter {
  private db?: Database;
  private initialized: boolean = false;
  private dbPath: string;

  constructor(customDbPath?: string) {
    super();
    // Database path: ~/.signal-tui/db.sqlite or custom
    this.dbPath = customDbPath || join(homedir(), ".signal-tui", "db.sqlite");
  }

  /**
   * Initialize the database schema
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    // Ensure directory exists
    const dbDir = dirname(this.dbPath);
    await mkdir(dbDir, { recursive: true });

    // Create database
    this.db = new Database(this.dbPath, { create: true });

    // Enable foreign key constraints
    this.db!.query("PRAGMA foreign_keys = ON").run();

    // Create tables
      this.db!.query(`
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
        this.db!.query("ALTER TABLE messages ADD COLUMN status TEXT DEFAULT 'sent'").run();
      } catch (e: any) {
        // Only ignore "duplicate column" errors, rethrow others
        if (!e.message?.includes("duplicate column")) {
          throw e;
        }
      }

    this.db!.query(`
      CREATE INDEX IF NOT EXISTS idx_conversation_timestamp
      ON messages(conversation_id, timestamp);
    `).run();

    // Create attachments table
    this.db!.query(`
      CREATE TABLE IF NOT EXISTS attachments (
        id TEXT PRIMARY KEY,
        message_id TEXT NOT NULL,
        content_type TEXT NOT NULL,
        filename TEXT,
        size INTEGER,
        width INTEGER,
        height INTEGER,
        caption TEXT,
        local_path TEXT,
        download_status TEXT DEFAULT 'pending',
        ascii_art TEXT,
        FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
      )
    `).run();

    // Auto-migrate: Add ascii_art column if it doesn't exist
    try {
      this.db!.query("ALTER TABLE attachments ADD COLUMN ascii_art TEXT").run();
    } catch (e: any) {
      // Only ignore "duplicate column" errors, rethrow others
      if (!e.message?.includes("duplicate column")) {
        throw e;
      }
    }

    this.db!.query(`
      CREATE INDEX IF NOT EXISTS idx_attachments_message
      ON attachments(message_id)
    `).run();

    this.initialized = true;
  }

  /**
   * Add a message to the database
   */
  addMessage(msg: ChatMessage, conversationId: string): void {
    if (!this.db) throw new Error("Database not initialized. Call init() first.");
    this._saveMessage(msg, conversationId);
    this.emit("new-message", msg, conversationId);
  }

  /**
   * Internal helper to save message to DB
   */
  private _saveMessage(msg: ChatMessage, conversationId: string): void {
    const query = this.db!.query(`
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

    // Save attachments if present
    if (msg.attachments && msg.attachments.length > 0) {
      const attachmentQuery = this.db!.query(`
        INSERT OR REPLACE INTO attachments (
          id, message_id, content_type, filename, size,
          width, height, caption, local_path, download_status, ascii_art
        ) VALUES (
          $id, $message_id, $content_type, $filename, $size,
          $width, $height, $caption, $local_path, $download_status, $ascii_art
        )
      `);

      for (const [i, att] of msg.attachments.entries()) {
        attachmentQuery.run({
          $id: att.id || `${msg.id}-${i}`,
          $message_id: msg.id,
          $content_type: att.contentType,
          $filename: att.filename || null,
          $size: att.size || null,
          $width: att.width || null,
          $height: att.height || null,
          $caption: att.caption || null,
          $local_path: att.localPath || null,
          $download_status: att.downloadStatus || "pending",
          $ascii_art: att.asciiArt || null
        });
      }
    }
  }

  /**
   * Replace a message with a new one (e.g. optimistic -> confirmed)
   */
  replaceMessage(oldId: string, newMessage: ChatMessage, conversationId: string): void {
    if (!this.db) throw new Error("Database not initialized. Call init() first.");
    // Delete old message
    this.db!.query("DELETE FROM messages WHERE id = $id").run({ $id: oldId });
    
    // Insert new message (without emitting new-message event)
    this._saveMessage(newMessage, conversationId);
    
    // Emit replacement event
    this.emit("message-replaced", oldId, newMessage);
  }

  /**
   * Get recent messages for a conversation
   */
  getMessages(conversationId: string, limit: number = 50, beforeTimestamp?: number): ChatMessage[] {
    if (!this.db) throw new Error("Database not initialized. Call init() first.");
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

    const query = this.db!.query(sql);
    const rows = query.all(params) as any[];

    // Batch load all attachments for messages in this result set (fixes N+1 query)
    const messageIds = rows.map(row => row.id);
    const attachmentsByMessageId = new Map<string, Attachment[]>();

    if (messageIds.length > 0) {
      // Use a single query with IN clause to fetch all attachments at once
      const placeholders = messageIds.map(() => "?").join(", ");
      const attachmentQuery = this.db!.query(`
        SELECT * FROM attachments WHERE message_id IN (${placeholders})
      `);
      const attachmentRows = attachmentQuery.all(...messageIds) as any[];

      // Group attachments by message_id
      for (const a of attachmentRows) {
        const attachment: Attachment = {
          id: a.id,
          contentType: a.content_type,
          filename: a.filename || undefined,
          size: a.size || undefined,
          width: a.width || undefined,
          height: a.height || undefined,
          caption: a.caption || undefined,
          localPath: a.local_path || undefined,
          downloadStatus: a.download_status as Attachment["downloadStatus"],
          asciiArt: a.ascii_art || undefined
        };

        const existing = attachmentsByMessageId.get(a.message_id);
        if (existing) {
          existing.push(attachment);
        } else {
          attachmentsByMessageId.set(a.message_id, [attachment]);
        }
      }
    }

    // Convert back to ChatMessage objects and reverse (so oldest is first)
    return rows.map(row => {
      const attachments = attachmentsByMessageId.get(row.id);

      return {
        id: row.id,
        sender: row.sender,
        senderName: row.sender_name || undefined,
        content: row.content,
        timestamp: row.timestamp,
        isOutgoing: Boolean(row.is_outgoing),
        status: row.status as "sent" | "delivered" | "read" | "failed" | undefined,
        attachments
      };
    }).reverse();
  }

  updateMessageStatus(timestamp: number, status: "sent" | "delivered" | "read" | "failed"): void {
    if (!this.db) throw new Error("Database not initialized. Call init() first.");

    // Get current status to ensure we only upgrade (for group "highest status" behavior)
    const current = this.db.query(
      "SELECT status FROM messages WHERE timestamp = $timestamp AND is_outgoing = 1"
    ).get({ $timestamp: timestamp }) as { status: string } | null;

    if (current) {
      const statusOrder: Record<string, number> = { failed: 0, sent: 1, delivered: 2, read: 3 };
      const currentOrder = statusOrder[current.status] ?? 1;
      const newOrder = statusOrder[status] ?? 1;
      if (newOrder <= currentOrder) {
        return; // Don't downgrade status
      }
    }

    const query = this.db.query(`
      UPDATE messages
      SET status = $status
      WHERE timestamp = $timestamp AND is_outgoing = 1
    `);

    query.run({
      $status: status,
      $timestamp: timestamp
    });

    // Emit event for UI to react
    this.emit("status-updated", timestamp, status);
  }

  /**
   * Update attachment download status and local path
   */
  updateAttachmentStatus(
    attachmentId: string,
    status: "pending" | "downloading" | "completed" | "failed",
    localPath?: string
  ): void {
    if (!this.db) throw new Error("Database not initialized. Call init() first.");

    const query = this.db.query(`
      UPDATE attachments
      SET download_status = $status, local_path = COALESCE($local_path, local_path)
      WHERE id = $id
    `);

    query.run({
      $id: attachmentId,
      $status: status,
      $local_path: localPath || null
    });

    this.emit("attachment-updated", attachmentId, status, localPath);
  }

  getConversationLastMessage(conversationId: string): { timestamp: number; content: string } | null {
    if (!this.db) throw new Error("Database not initialized. Call init() first.");
    const query = this.db!.query(`
      SELECT timestamp, content 
      FROM messages 
      WHERE conversation_id = $conversation_id
      ORDER BY timestamp DESC 
      LIMIT 1
    `);

    const result = query.get({ $conversation_id: conversationId }) as any;
    if (!result) return null;

    return {
      timestamp: result.timestamp,
      content: result.content
    };
  }

  getAllConversationMetadata(): Map<string, { timestamp: number; content: string }> {
    if (!this.db) throw new Error("Database not initialized. Call init() first.");
    const query = this.db!.query(`
      SELECT 
        conversation_id,
        MAX(timestamp) as timestamp,
        (SELECT content FROM messages m2 
         WHERE m2.conversation_id = messages.conversation_id 
         ORDER BY m2.timestamp DESC 
         LIMIT 1) as content
      FROM messages
      GROUP BY conversation_id
    `);

    const rows = query.all() as any[];
    const metadata = new Map<string, { timestamp: number; content: string }>();

    for (const row of rows) {
      metadata.set(row.conversation_id, {
        timestamp: row.timestamp,
        content: row.content || ""
      });
    }

    return metadata;
  }
  /**
   * Close the database connection
   */
  close(): void {
    if (this.db) this.db.close();
  }
}
