import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';

export class ChatStore {
  constructor({ connectionString, log }) {
    this.log = log;
    this.pool = connectionString ? new Pool({ connectionString }) : null;
    this.memory = new Map();
  }

  async init() {
    if (!this.pool) {
      this.log?.warn('ChatStore running in memory-only mode');
      return;
    }
    // Ensure connection works early.
    try {
      await this.pool.query('SELECT 1');
      this.log?.info('Connected to PostgreSQL for ChatStore');
    } catch (err) {
      this.log?.error({ err }, 'Failed to connect to PostgreSQL, falling back to memory mode');
      await this.pool?.end?.();
      this.pool = null;
    }
  }

  async saveMessage({ conversationId, senderId, ciphertext, keyId, ttlSeconds = null, metadata = null }) {
    if (!conversationId || !ciphertext) {
      throw new Error('conversationId and ciphertext are required');
    }
    const messageId = randomUUID();
    const createdAt = new Date();
    const expiresAt = ttlSeconds ? new Date(createdAt.getTime() + ttlSeconds * 1000) : null;

    if (!this.pool) {
      const bucket = this.memory.get(conversationId) || [];
      bucket.push({
        id: messageId,
        conversation_id: conversationId,
        sender_id: senderId || null,
        ciphertext,
        key_id: keyId || null,
        metadata: metadata || null,
        created_at: createdAt.toISOString(),
        expires_at: expiresAt ? expiresAt.toISOString() : null,
      });
      this.memory.set(conversationId, bucket);
      return { id: messageId, createdAt, expiresAt };
    }

    const query = `
      INSERT INTO messages (id, conversation_id, sender_id, ciphertext, key_id, metadata, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
      RETURNING id, created_at, expires_at
    `;
    const values = [
      messageId,
      conversationId,
      senderId || null,
      ciphertext,
      keyId || null,
      metadata ? JSON.stringify(metadata) : null,
      expiresAt,
    ];

    const res = await this.pool.query(query, values);
    return {
      id: res.rows[0].id,
      createdAt: res.rows[0].created_at,
      expiresAt: res.rows[0].expires_at,
    };
  }

  async listMessages({ conversationId, limit = 50, before }) {
    if (!conversationId) return [];

    if (!this.pool) {
      const bucket = this.memory.get(conversationId) || [];
      const sorted = bucket
        .filter((m) => !m.expires_at || new Date(m.expires_at) > new Date())
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      return sorted.slice(0, limit).reverse();
    }

    const res = await this.pool.query(
      `
        SELECT id, conversation_id, sender_id, ciphertext, key_id, metadata, created_at, expires_at
        FROM messages
        WHERE conversation_id = $1
          AND ($2::timestamptz IS NULL OR created_at < $2)
          AND (expires_at IS NULL OR expires_at > NOW())
        ORDER BY created_at DESC
        LIMIT $3
      `,
      [conversationId, before || null, limit],
    );
    return res.rows.reverse();
  }

  async recordVoiceNote({
    voiceNoteId = randomUUID(),
    conversationId,
    senderId,
    storagePath,
    mimeType,
    sizeBytes,
    durationMs,
  }) {
    if (!conversationId || !storagePath) {
      throw new Error('conversationId and storagePath are required');
    }

    if (!this.pool) {
      const bucket = this.memory.get(`vn:${conversationId}`) || [];
      const row = {
        id: voiceNoteId,
        conversation_id: conversationId,
        sender_id: senderId || null,
        storage_path: storagePath,
        mime_type: mimeType || 'audio/webm',
        size_bytes: sizeBytes || 0,
        duration_ms: durationMs || null,
        created_at: new Date().toISOString(),
      };
      bucket.push(row);
      this.memory.set(`vn:${conversationId}`, bucket);
      return row;
    }

    const res = await this.pool.query(
      `
        INSERT INTO voice_notes (id, conversation_id, sender_id, storage_path, mime_type, size_bytes, duration_ms)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, conversation_id, sender_id, storage_path, mime_type, size_bytes, duration_ms, created_at
      `,
      [voiceNoteId, conversationId, senderId || null, storagePath, mimeType || 'audio/webm', sizeBytes || 0, durationMs || null],
    );
    return res.rows[0];
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
    }
    this.memory.clear();
  }
}
