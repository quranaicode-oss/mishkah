import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

export class VoiceNoteStore {
  constructor({ directory, log }) {
    this.dir = directory;
    this.log = log;
  }

  async init() {
    if (!this.dir) {
      throw new Error('VoiceNoteStore requires a directory');
    }
    await fs.mkdir(this.dir, { recursive: true });
    this.log?.info({ dir: this.dir }, 'Voice note storage initialized');
  }

  async save({ buffer, mimeType = 'audio/webm', conversationId, senderId, durationMs }) {
    if (!buffer || !Buffer.isBuffer(buffer)) {
      throw new Error('VoiceNoteStore.save requires a buffer');
    }
    const voiceNoteId = randomUUID();
    const fileName = `${voiceNoteId}.bin`;
    const filePath = join(this.dir, fileName);
    await fs.writeFile(filePath, buffer);
    return {
      id: voiceNoteId,
      path: filePath,
      fileName,
      mimeType,
      conversationId,
      senderId,
      durationMs: durationMs || null,
      sizeBytes: buffer.byteLength,
    };
  }

  async remove(filePath) {
    if (!filePath) return;
    try {
      await fs.unlink(filePath);
    } catch (err) {
      if (err.code !== 'ENOENT') {
        this.log?.warn({ err, filePath }, 'Failed to delete voice note');
      }
    }
  }
}
