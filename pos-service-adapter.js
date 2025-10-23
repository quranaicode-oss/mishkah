(function (global) {
  if (!global) return;

  const root = global;
  const Mishkah = root.Mishkah || (root.Mishkah = {});
  const utils = Mishkah.utils || root.MishkahUtils || {};
  const IDBFactory = utils.IndexedDBX || utils.IndexedDB || null;

  const hasStructuredClone = typeof structuredClone === 'function';
  const memoryStores = new Map();

  const noop = () => {};

  function clone(value) {
    if (value === null || typeof value !== 'object') return value;
    if (hasStructuredClone) {
      try { return structuredClone(value); } catch (_err) {}
    }
    try { return JSON.parse(JSON.stringify(value)); }
    catch (_err) {
      if (Array.isArray(value)) return value.map(clone);
      const out = {};
      Object.keys(value).forEach((key) => { out[key] = clone(value[key]); });
      return out;
    }
  }

  function mergeDeep(base, patch) {
    if (patch === undefined) return clone(base);
    if (patch === null || typeof patch !== 'object') return clone(patch);
    if (Array.isArray(patch)) return patch.map((entry) => clone(entry));
    const source = (base && typeof base === 'object' && !Array.isArray(base)) ? base : {};
    const result = {};
    Object.keys(source).forEach((key) => { result[key] = clone(source[key]); });
    Object.keys(patch).forEach((key) => {
      const value = patch[key];
      if (Array.isArray(value)) {
        result[key] = value.map((entry) => clone(entry));
        return;
      }
      if (value && typeof value === 'object') {
        result[key] = mergeDeep(result[key], value);
        return;
      }
      result[key] = value;
    });
    return result;
  }

  function toKey(branchId, moduleId) {
    const branch = (branchId && String(branchId).trim()) || 'default';
    const moduleName = (moduleId && String(moduleId).trim()) || 'pos';
    return `${branch}::${moduleName}`;
  }

  function shouldQueueError(error) {
    if (!error) return false;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
    const status = typeof error.status === 'number' ? error.status : null;
    if (status === 0) return true;
    const message = (error && error.message ? String(error.message) : '').toLowerCase();
    return message.includes('failed to fetch') || message.includes('network');
  }

  function createMemoryAdapter(options) {
    const branchId = options.branchId || 'default';
    const moduleId = options.moduleId || 'pos';
    const key = toKey(branchId, moduleId);
    if (!memoryStores.has(key)) {
      memoryStores.set(key, { snapshot: null, queue: [], envelopes: [] });
    }
    const store = memoryStores.get(key);
    const listeners = new Set();
    const queueListeners = new Set();

    const notifyUpdate = (payload) => {
      listeners.forEach((handler) => {
        try { handler(payload); } catch (err) { console.warn('[Mishkah][POS][ServiceAdapter] listener failed', err); }
      });
    };

    const notifyQueue = (payload) => {
      queueListeners.forEach((handler) => {
        try { handler(payload); } catch (err) { console.warn('[Mishkah][POS][ServiceAdapter] queue listener failed', err); }
      });
    };

    return {
      branchId,
      moduleId,
      hasIndexedDb: false,
      async persistSnapshot(snapshot) {
        store.snapshot = clone(snapshot);
        notifyUpdate({ snapshot: store.snapshot, branchId, moduleId, source: 'memory' });
        return true;
      },
      async rehydrate() {
        return store.snapshot ? clone(store.snapshot) : null;
      },
      async loadSnapshot() {
        return store.snapshot ? clone(store.snapshot) : null;
      },
      async handleEnvelope(envelope, meta = {}) {
        if (!envelope || typeof envelope !== 'object') return null;
        if (envelope.snapshot) {
          await this.persistSnapshot(envelope.snapshot);
          return clone(envelope.snapshot);
        }
        const delta = envelope.delta || envelope.patch || envelope.data || null;
        if (delta && typeof delta === 'object') {
          const current = store.snapshot ? clone(store.snapshot) : {};
          const merged = mergeDeep(current, delta);
          await this.persistSnapshot(merged);
          return merged;
        }
        return null;
      },
      async enqueueMutation(entry) {
        const payload = {
          id: entry && entry.id ? entry.id : `${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`,
          ts: Date.now(),
          branchId,
          moduleId,
          entry: clone(entry)
        };
        store.queue.push(payload);
        notifyQueue({ action: 'enqueue', entry: payload, size: store.queue.length });
        return payload;
      },
      async listQueued() {
        return store.queue.map((row) => clone(row));
      },
      async flushQueue(sender) {
        if (typeof sender !== 'function') return { flushed: 0, pending: store.queue.length };
        let flushed = 0;
        const pending = [];
        while (store.queue.length) {
          const row = store.queue.shift();
          try {
            const response = await sender(clone(row.entry), clone(row));
            flushed += 1;
            if (response) await this.handleEnvelope(response, { source: 'queue', entry: row.entry });
          } catch (error) {
            pending.push(row);
            notifyQueue({ action: 'error', error, entry: clone(row), flushed, pending: store.queue.length + pending.length });
            store.queue = pending.concat(store.queue);
            throw error;
          }
        }
        notifyQueue({ action: 'flush', flushed, pending: store.queue.length });
        return { flushed, pending: store.queue.length };
      },
      async removeQueued(id) {
        const before = store.queue.length;
        store.queue = store.queue.filter((row) => row.id !== id);
        const removed = before !== store.queue.length;
        if (removed) notifyQueue({ action: 'remove', id, size: store.queue.length });
        return removed;
      },
      async handleNotice(notice, helpers = {}) {
        if (!notice || typeof helpers.fetchDelta !== 'function') return null;
        try {
          const delta = await helpers.fetchDelta(notice);
          if (delta) return this.handleEnvelope({ delta }, { source: 'notice', notice });
        } catch (error) {
          console.warn('[Mishkah][POS][ServiceAdapter] notice handler failed', error);
        }
        return null;
      },
      shouldQueueError,
      onUpdate(handler) {
        if (typeof handler !== 'function') return noop;
        listeners.add(handler);
        return () => listeners.delete(handler);
      },
      onQueue(handler) {
        if (typeof handler !== 'function') return noop;
        queueListeners.add(handler);
        return () => queueListeners.delete(handler);
      }
    };
  }

  function createIndexedDbAdapter(options) {
    const branchId = options.branchId || 'default';
    const moduleId = options.moduleId || 'pos';
    const key = toKey(branchId, moduleId);
    const dbName = options.dbName || 'mishkah-pos-service';
    const storeNames = {
      dataset: 'dataset',
      queue: 'queue',
      envelopes: 'envelopes'
    };

    const db = new IDBFactory({
      name: dbName,
      version: 1,
      schema: {
        stores: {
          [storeNames.dataset]: { keyPath: 'id' },
          [storeNames.queue]: { keyPath: 'id', indices: [{ name: 'by_branch', keyPath: ['branchId', 'moduleId', 'ts'] }] },
          [storeNames.envelopes]: { keyPath: 'id', indices: [{ name: 'by_branch', keyPath: ['branchId', 'moduleId', 'ts'] }] }
        }
      }
    });

    const listeners = new Set();
    const queueListeners = new Set();

    const notifyUpdate = (payload) => {
      listeners.forEach((handler) => {
        try { handler(payload); } catch (err) { console.warn('[Mishkah][POS][ServiceAdapter] listener failed', err); }
      });
    };

    const notifyQueue = (payload) => {
      queueListeners.forEach((handler) => {
        try { handler(payload); } catch (err) { console.warn('[Mishkah][POS][ServiceAdapter] queue listener failed', err); }
      });
    };

    const ensureDb = async () => {
      await db.open();
      await db.ensureSchema();
      return db;
    };

    const loadSnapshot = async () => {
      const conn = await ensureDb();
      const record = await conn.get(storeNames.dataset, key);
      return record ? clone(record.snapshot) : null;
    };

    const persistSnapshot = async (snapshot) => {
      const conn = await ensureDb();
      const payload = {
        id: key,
        branchId,
        moduleId,
        snapshot: clone(snapshot),
        savedAt: Date.now()
      };
      await conn.put(storeNames.dataset, payload);
      notifyUpdate({ snapshot: clone(payload.snapshot), branchId, moduleId, source: 'indexeddb' });
      return true;
    };

    const enqueueMutation = async (entry) => {
      const conn = await ensureDb();
      const payload = {
        id: entry && entry.id ? entry.id : `${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`,
        branchId,
        moduleId,
        ts: Date.now(),
        entry: clone(entry)
      };
      await conn.put(storeNames.queue, payload);
      notifyQueue({ action: 'enqueue', entry: clone(payload), size: (await conn.count(storeNames.queue)) });
      return payload;
    };

    const listQueued = async () => {
      const conn = await ensureDb();
      const rows = await conn.getAll(storeNames.queue);
      return rows
        .filter((row) => row.branchId === branchId && row.moduleId === moduleId)
        .sort((a, b) => (a.ts || 0) - (b.ts || 0))
        .map((row) => clone(row));
    };

    const removeQueued = async (id) => {
      const conn = await ensureDb();
      await conn.delete(storeNames.queue, id);
      notifyQueue({ action: 'remove', id, size: await conn.count(storeNames.queue) });
      return true;
    };

    const handleEnvelope = async (envelope, meta = {}) => {
      if (!envelope || typeof envelope !== 'object') return null;
      if (envelope.snapshot) {
        await persistSnapshot(envelope.snapshot);
        return clone(envelope.snapshot);
      }
      const delta = envelope.delta || envelope.patch || envelope.data || null;
      if (delta && typeof delta === 'object') {
        const current = await loadSnapshot() || {};
        const merged = mergeDeep(current, delta);
        await persistSnapshot(merged);
        if (options.persistEnvelopes) {
          const conn = await ensureDb();
          const envelopeRecord = {
            id: `${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`,
            branchId,
            moduleId,
            ts: Date.now(),
            meta: clone(meta),
            delta: clone(delta)
          };
          await conn.put(storeNames.envelopes, envelopeRecord);
        }
        return merged;
      }
      return null;
    };

    const flushQueue = async (sender) => {
      if (typeof sender !== 'function') return { flushed: 0, pending: (await listQueued()).length };
      const rows = await listQueued();
      let flushed = 0;
      for (const row of rows) {
        try {
          const response = await sender(clone(row.entry), clone(row));
          flushed += 1;
          await removeQueued(row.id);
          if (response) await handleEnvelope(response, { source: 'queue', entry: row.entry });
        } catch (error) {
          notifyQueue({ action: 'error', error, entry: clone(row), flushed, pending: rows.length - flushed });
          throw error;
        }
      }
      notifyQueue({ action: 'flush', flushed, pending: 0 });
      return { flushed, pending: 0 };
    };

    const handleNotice = async (notice, helpers = {}) => {
      if (!notice || typeof helpers.fetchDelta !== 'function') return null;
      try {
        const delta = await helpers.fetchDelta(notice);
        if (delta) return handleEnvelope({ delta }, { source: 'notice', notice });
      } catch (error) {
        console.warn('[Mishkah][POS][ServiceAdapter] notice handler failed', error);
      }
      return null;
    };

    return {
      branchId,
      moduleId,
      hasIndexedDb: true,
      persistSnapshot,
      rehydrate: loadSnapshot,
      loadSnapshot,
      handleEnvelope,
      enqueueMutation,
      flushQueue,
      listQueued,
      removeQueued,
      handleNotice,
      shouldQueueError,
      onUpdate(handler) {
        if (typeof handler !== 'function') return noop;
        listeners.add(handler);
        return () => listeners.delete(handler);
      },
      onQueue(handler) {
        if (typeof handler !== 'function') return noop;
        queueListeners.add(handler);
        return () => queueListeners.delete(handler);
      }
    };
  }

  function createServiceAdapter(options = {}) {
    if (!IDBFactory || options.forceMemory) {
      return createMemoryAdapter(options);
    }
    try {
      return createIndexedDbAdapter(options);
    } catch (error) {
      console.warn('[Mishkah][POS][ServiceAdapter] IndexedDB adapter failed, falling back to memory.', error);
      const adapter = createMemoryAdapter(options);
      adapter.error = error;
      return adapter;
    }
  }

  const api = {
    create(options) {
      return createServiceAdapter(options || {});
    },
    shouldQueueError
  };

  root.MishkahPosServiceAdapter = api;
})(typeof window !== 'undefined' ? window : this);
