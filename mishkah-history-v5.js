// mishkah-history-v5.js (compatible with IndexedDBX)
(function (window) {
  const U = window.Mishkah.utils || {};
  const IDB = U.IndexedDBX || U.IndexedDB;
  const { debounce, uuid } = U;

  function createHistory({ dbName = "mishkah-trace", keepSessions = 10, flushMs = 1000 } = {}) {
    const db = new IDB({
      name: dbName,
      autoBumpVersion: true,
      schema: {
        stores: {
          sessions:  { keyPath: "id", indices: [{ name: "startedAt", keyPath: "startedAt" }] },
          commits:   { keyPath: "id", indices: [{ name: "sessionId", keyPath: "sessionId" }] },
          regions:   { keyPath: ["sessionId", "uKey"], indices: [{ name: "sessionId", keyPath: "sessionId" }] }
        },
        strict: false
      }
    });

    let session = null;
    let bufferCommits = [];
    let bufferRegions = new Map();
    let flushing = false;
    let pending = false;
    let opened = false;

    async function ensureOpen() {
      if (!opened) {
        await db.open();
        await db.ensureSchema();
        opened = true;
      }
    }

    async function flushBuffers() {
      if (!session) return;
      if (flushing) { pending = true; return; }
      flushing = true;
      try {
        await ensureOpen();
        if (bufferCommits.length) {
          const rows = bufferCommits.map(x => ({
            id: x.id, sessionId: session.id, ts: x.ts, uKey: x.uKey, ms: x.ms, mode: x.mode
          }));
          bufferCommits = [];
          await db.bulkPut("commits", rows);
        }
        if (bufferRegions.size) {
          const rows = [];
          for (const [uKey, v] of bufferRegions) {
            rows.push({
              sessionId: session.id, uKey,
              commits: v.commits | 0,
              avgMs: v.avgMs || 0,
              slowCount: v.slowCount | 0,
              errors: v.errors | 0,
              violations: v.violations | 0,
              priority: v.priority || "normal"
            });
          }
          bufferRegions.clear();
          await db.bulkPut("regions", rows);
        }
      } finally {
        flushing = false;
        if (pending) { pending = false; await flushBuffers(); }
      }
    }

    const scheduleFlush = debounce(() => { flushBuffers(); }, flushMs);

    async function start(meta = {}) {
      await ensureOpen();
      session = { id: uuid(), startedAt: Date.now(), endedAt: null, meta };
      await db.put("sessions", session);
      await prune();
      return session.id;
    }

    async function stop() {
      if (!session) return;
      session.endedAt = Date.now();
      await ensureOpen();
      await db.put("sessions", session);
      await flushBuffers();
      session = null;
    }

    async function prune() {
      await ensureOpen();
      const all = await db.getAll("sessions");
      if (!all || all.length <= keepSessions) return;
      const sorted = all.sort((a, b) => b.startedAt - a.startedAt);
      const toDel = sorted.slice(keepSessions);
      for (const s of toDel) {
        await db.delete("sessions", s.id);
        const commits = await db.byIndex("commits", "sessionId", { only: s.id });
        for (const c of commits) await db.delete("commits", c.id);
        const regs = await db.byIndex("regions", "sessionId", { only: s.id });
        for (const r of regs) await db.delete("regions", [s.id, r.uKey]);
      }
    }

    function onRegionCommit({ uKey, ms, mode = "patch", priority = "normal" }) {
      if (!session) return;
      bufferCommits.push({ id: uuid(), ts: Date.now(), uKey, ms, mode });
      const r = bufferRegions.get(uKey) || { commits: 0, avgMs: 0, slowCount: 0, errors: 0, violations: 0, priority };
      r.commits++;
      r.avgMs = r.avgMs ? (r.avgMs * 0.9 + ms * 0.1) : ms;
      if (ms > 32) r.slowCount++;
      r.priority = priority;
      bufferRegions.set(uKey, r);
      scheduleFlush();
    }

    function onRegionError(uKey) {
      if (!session) return;
      const r = bufferRegions.get(uKey) || { commits: 0, avgMs: 0, slowCount: 0, errors: 0, violations: 0, priority: "normal" };
      r.errors++;
      bufferRegions.set(uKey, r);
      scheduleFlush();
    }

    function onRegionViolation(uKey, n = 1) {
      if (!session) return;
      const r = bufferRegions.get(uKey) || { commits: 0, avgMs: 0, slowCount: 0, errors: 0, violations: 0, priority: "normal" };
      r.violations += n;
      bufferRegions.set(uKey, r);
      scheduleFlush();
    }

    async function listSessions() {
      await ensureOpen();
      const all = await db.getAll("sessions");
      return all.sort((a, b) => b.startedAt - a.startedAt);
    }
    async function getSessionRegions(sessionId) {
      await ensureOpen();
      return db.byIndex("regions", "sessionId", { only: sessionId });
    }
    async function getSessionCommits(sessionId) {
      await ensureOpen();
      return db.byIndex("commits", "sessionId", { only: sessionId });
    }
    async function exportSession(sessionId) {
      await ensureOpen();
      const s = await db.get("sessions", sessionId);
      if (!s) return null;
      const regions = await db.byIndex("regions", "sessionId", { only: sessionId });
      const commits = await db.byIndex("commits", "sessionId", { only: sessionId });
      return { session: s, regions, commits };
    }

    return { start, stop, onRegionCommit, onRegionError, onRegionViolation, listSessions, getSessionRegions, getSessionCommits, exportSession };
  }

  function attach(app, opts) {
    const history = createHistory(opts);
    history.start({ startedBy: "app", at: new Date().toISOString() });

    const auditor = app.auditor;
    const origOnCommit = auditor.onCommit;
    auditor.onCommit = function (uKey, ms, priority) {
      history.onRegionCommit({ uKey, ms, mode: "commit", priority });
      return origOnCommit.call(auditor, uKey, ms, priority);
    };
    const origOnError = auditor.onError;
    auditor.onError = function (uKey) {
      history.onRegionError(uKey);
      return origOnError.call(auditor, uKey);
    };
    const origOnViolation = auditor.onViolation;
    auditor.onViolation = function (uKey, n) {
      history.onRegionViolation(uKey, n);
      return origOnViolation.call(auditor, uKey, n);
    };

    const onHide = () => { history.stop(); };
    window.addEventListener("pagehide", onHide);
    window.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") onHide(); });

    app.history = {
      listSessions: history.listSessions,
      getSessionRegions: history.getSessionRegions,
      getSessionCommits: history.getSessionCommits,
      exportSession: history.exportSession
    };

    return history;
  }

  window.Mishkah = window.Mishkah || {};
  window.Mishkah.History = { createHistory, attach };
})(window);
