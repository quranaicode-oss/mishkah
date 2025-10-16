import { promises as fs } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';

function deepClone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

async function ensureDir(path) {
  await fs.mkdir(path, { recursive: true });
  return path;
}

async function safeReadJSON(path) {
  try {
    const payload = await fs.readFile(path, 'utf8');
    return JSON.parse(payload);
  } catch (err) {
    if (err && (err.code === 'ENOENT' || err.code === 'ENOTDIR')) {
      return null;
    }
    throw err;
  }
}

async function safeWriteJSON(path, data) {
  await ensureDir(dirname(path));
  await fs.writeFile(path, JSON.stringify(data, null, 2), 'utf8');
}

export class PosSyncStore {
  constructor({ liveDir, historyDir, log }) {
    this.liveDir = liveDir;
    this.historyDir = historyDir;
    this.log = log;
    this.branches = new Map();
  }

  async init() {
    await Promise.all([ensureDir(this.liveDir), ensureDir(this.historyDir)]);
    const entries = await fs.readdir(this.liveDir).catch((err) => {
      if (err && err.code === 'ENOENT') {
        return [];
      }
      throw err;
    });
    await Promise.all(entries.map(async (file) => {
      if (!file.endsWith('.json')) return;
      const branchId = file.replace(/\.json$/, '');
      const existing = await safeReadJSON(join(this.liveDir, file));
      const snapshot = existing?.snapshot && typeof existing.snapshot === 'object'
        ? existing.snapshot
        : { stores: {}, meta: {} };
      const version = Number(existing?.version || 0);
      this.branches.set(branchId, {
        branchId,
        version,
        snapshot,
        updatedAt: existing?.updatedAt || Date.now(),
        queue: Promise.resolve(),
      });
    }));
  }

  ensureBranch(branchId) {
    const key = branchId || 'default';
    if (!this.branches.has(key)) {
      this.branches.set(key, {
        branchId: key,
        version: 0,
        snapshot: { stores: {}, meta: {} },
        updatedAt: Date.now(),
        queue: Promise.resolve(),
      });
    }
    return this.branches.get(key);
  }

  async getSnapshot(branchId) {
    const branch = this.ensureBranch(branchId);
    const payload = {
      branchId: branch.branchId,
      version: branch.version,
      updatedAt: branch.updatedAt,
      snapshot: deepClone(branch.snapshot),
    };
    return payload;
  }

  async enqueue(branchId, handler) {
    const branch = this.ensureBranch(branchId);
    branch.queue = branch.queue.then(() => handler(branch));
    return branch.queue.catch((err) => {
      this.log?.error?.({ err, branchId }, 'POS sync branch mutation failed');
      throw err;
    });
  }

  async persistLive(branch) {
    const file = join(this.liveDir, `${branch.branchId}.json`);
    const payload = {
      branchId: branch.branchId,
      version: branch.version,
      updatedAt: branch.updatedAt,
      snapshot: branch.snapshot,
    };
    await safeWriteJSON(file, payload);
  }

  async persistHistory(branchId, entry) {
    const folder = join(this.historyDir, branchId);
    await ensureDir(folder);
    const fileName = `${entry.version}-${Date.now()}-${randomUUID()}.json`;
    await safeWriteJSON(join(folder, fileName), entry);
  }

  async applySnapshot({
    branchId,
    snapshot,
    baseVersion,
    clientId,
    reason,
    archive,
  }) {
    if (!snapshot || typeof snapshot !== 'object') {
      throw new Error('Snapshot payload must be an object');
    }
    return this.enqueue(branchId, async (branch) => {
      if (typeof baseVersion === 'number' && baseVersion !== branch.version) {
        return {
          ok: false,
          code: 'version_conflict',
          version: branch.version,
          snapshot: deepClone(branch.snapshot),
        };
      }
      if (archive) {
        await this.persistHistory(branch.branchId, {
          version: branch.version,
          snapshot: deepClone(branch.snapshot),
          branchId: branch.branchId,
          archivedAt: Date.now(),
          reason: reason || 'snapshot',
          clientId: clientId || null,
        });
      }
      branch.version += 1;
      branch.snapshot = deepClone(snapshot);
      branch.updatedAt = Date.now();
      await this.persistLive(branch);
      return {
        ok: true,
        version: branch.version,
        updatedAt: branch.updatedAt,
        snapshot: deepClone(branch.snapshot),
      };
    });
  }

  async destroyBranch(branchId, { reason, clientId } = {}) {
    return this.enqueue(branchId, async (branch) => {
      await this.persistHistory(branch.branchId, {
        version: branch.version,
        snapshot: deepClone(branch.snapshot),
        branchId: branch.branchId,
        archivedAt: Date.now(),
        reason: reason || 'destroy',
        clientId: clientId || null,
      });
      branch.version += 1;
      branch.snapshot = { stores: {}, meta: { clearedAt: Date.now() } };
      branch.updatedAt = Date.now();
      await this.persistLive(branch);
      return {
        ok: true,
        version: branch.version,
        updatedAt: branch.updatedAt,
        snapshot: deepClone(branch.snapshot),
      };
    });
  }
}
