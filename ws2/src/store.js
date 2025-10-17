import { createId, deepClone, mergeDeep, nowIso } from './utils.js';

export class BranchStore {
  constructor(branchId, seed = {}) {
    this.branchId = branchId;
    this.version = 1;
    this.snapshot = deepClone(seed);
    this.history = [];
    this.lastPersistedAt = null;
    this.appendHistory({ type: 'bootstrap', snapshot: this.snapshot, note: 'Initial seed snapshot' });
  }

  appendHistory(entry) {
    const record = {
      id: createId('hist'),
      ts: nowIso(),
      version: this.version,
      ...deepClone(entry)
    };
    this.history.push(record);
    return record;
  }

  getSnapshot() {
    return deepClone(this.snapshot);
  }

  replaceSnapshot(snapshot, meta = {}) {
    this.version += 1;
    this.snapshot = deepClone(snapshot || {});
    return this.appendHistory({ type: 'snapshot', meta, snapshot: this.snapshot });
  }

  mergeSnapshot(patch, meta = {}) {
    this.version += 1;
    this.snapshot = mergeDeep(this.snapshot, patch || {});
    return this.appendHistory({ type: 'merge', meta, patch: deepClone(patch || {}), snapshot: this.snapshot });
  }

  pushEvent(payload, meta = {}) {
    this.version += 1;
    return this.appendHistory({ type: 'event', meta, payload: deepClone(payload) });
  }

  reset(meta = {}) {
    this.version += 1;
    this.snapshot = {};
    return this.appendHistory({ type: 'reset', meta, snapshot: this.snapshot });
  }

  listHistory(limit = 100) {
    if (!limit || limit >= this.history.length) {
      return this.history.map((entry) => deepClone(entry));
    }
    return this.history.slice(Math.max(this.history.length - limit, 0)).map((entry) => deepClone(entry));
  }

  toJSON() {
    return {
      branchId: this.branchId,
      version: this.version,
      snapshot: this.getSnapshot(),
      history: this.history.map((entry) => deepClone(entry)),
      lastPersistedAt: this.lastPersistedAt
    };
  }
}

export default BranchStore;
