import { createServer } from 'http';
import { readFile, writeFile, access, mkdir, readdir, rename, rm } from 'fs/promises';
import { constants as FS_CONSTANTS } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import { Pool } from 'pg';

import logger from './logger.js';
import { getEventStoreContext, appendEvent as appendModuleEvent, loadEventMeta, updateEventMeta, rotateEventLog, listArchivedLogs, readLogFile, discardLogFile } from './eventStore.js';
import { createId, nowIso, safeJsonParse, deepClone } from './utils.js';
import SchemaEngine from './schema/engine.js';
import ModuleStore from './moduleStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const STATIC_DIR = path.join(ROOT_DIR, 'static');

const DEV_MODE = String(process.env.WS2_DEV_MODE || process.env.NODE_ENV || '').toLowerCase() === 'development';

const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number(process.env.PORT || 3200);
const SERVER_ID = process.env.SERVER_ID || createId('ws');
const BRANCHES_DIR = process.env.BRANCHES_DIR || path.join(ROOT_DIR, 'data', 'branches');
const DEFAULT_SCHEMA_PATH = path.join(ROOT_DIR, 'data', 'schemas', 'pos_schema.json');
const ENV_SCHEMA_PATH = process.env.WS_SCHEMA_PATH
  ? path.isAbsolute(process.env.WS_SCHEMA_PATH)
    ? process.env.WS_SCHEMA_PATH
    : path.join(ROOT_DIR, process.env.WS_SCHEMA_PATH)
  : null;
const MODULES_CONFIG_PATH = process.env.MODULES_CONFIG_PATH || path.join(ROOT_DIR, 'data', 'modules.json');
const BRANCHES_CONFIG_PATH = process.env.BRANCHES_CONFIG_PATH || path.join(ROOT_DIR, 'data', 'branches.config.json');
const HISTORY_DIR = process.env.HISTORY_DIR || path.join(ROOT_DIR, 'data', 'history');
const EVENT_ARCHIVE_INTERVAL_MS = Math.max(60000, Number(process.env.WS2_EVENT_ARCHIVE_INTERVAL_MS || process.env.EVENT_ARCHIVE_INTERVAL_MS) || 5 * 60 * 1000);
const EVENTS_PG_URL = process.env.WS2_EVENTS_PG_URL || process.env.EVENTS_PG_URL || process.env.WS2_PG_URL || process.env.DATABASE_URL || null;
const EVENT_ARCHIVER_DISABLED = ['1', 'true', 'yes'].includes(
  String(process.env.WS2_EVENT_ARCHIVE_DISABLED || process.env.EVENT_ARCHIVE_DISABLED || '').toLowerCase()
);

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

const STATIC_CACHE_HEADERS = DEV_MODE
  ? {
      'cache-control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      pragma: 'no-cache',
      expires: '0'
    }
  : {
      'cache-control': 'public, max-age=86400'
    };

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch (_err) {
    return value;
  }
}

function parseCookies(header) {
  if (typeof header !== 'string' || !header.trim()) return {};
  const entries = header.split(';');
  const cookies = {};
  for (const rawEntry of entries) {
    const entry = rawEntry.trim();
    if (!entry) continue;
    const idx = entry.indexOf('=');
    if (idx <= 0) continue;
    const name = entry.slice(0, idx).trim();
    if (!name) continue;
    const rawValue = entry.slice(idx + 1).trim();
    cookies[name] = safeDecode(rawValue);
  }
  return cookies;
}

function encodeBranchId(branchId) {
  return encodeURIComponent(branchId);
}

function getBranchDir(branchId) {
  return path.join(BRANCHES_DIR, encodeBranchId(branchId));
}

function getBranchModuleDir(branchId, moduleId) {
  return path.join(getBranchDir(branchId), 'modules', moduleId);
}

function getModuleSchemaPath(branchId, moduleId) {
  const def = getModuleConfig(moduleId);
  const relative = def.schemaPath || path.join('schema', 'definition.json');
  return path.join(getBranchModuleDir(branchId, moduleId), relative);
}

function getModuleSchemaFallbackPath(moduleId) {
  const def = getModuleConfig(moduleId);
  if (!def.schemaFallbackPath) return null;
  return path.isAbsolute(def.schemaFallbackPath)
    ? def.schemaFallbackPath
    : path.join(ROOT_DIR, def.schemaFallbackPath);
}

function getModuleSeedPath(branchId, moduleId) {
  const def = getModuleConfig(moduleId);
  const relative = def.seedPath || path.join('seeds', 'initial.json');
  return path.join(getBranchModuleDir(branchId, moduleId), relative);
}

function getModuleSeedFallbackPath(moduleId) {
  const def = getModuleConfig(moduleId);
  if (!def.seedFallbackPath) return null;
  return path.isAbsolute(def.seedFallbackPath)
    ? def.seedFallbackPath
    : path.join(ROOT_DIR, def.seedFallbackPath);
}

function getModuleLivePath(branchId, moduleId) {
  const def = getModuleConfig(moduleId);
  const relative = def.livePath || path.join('live', 'data.json');
  return path.join(getBranchModuleDir(branchId, moduleId), relative);
}

function getModuleLiveDir(branchId, moduleId) {
  return path.dirname(getModuleLivePath(branchId, moduleId));
}

function getModuleFilePath(branchId, moduleId) {
  return getModuleLivePath(branchId, moduleId);
}

function getModuleHistoryDir(branchId, moduleId) {
  const def = getModuleConfig(moduleId);
  const relative = def.historyPath || 'history';
  return path.join(getBranchModuleDir(branchId, moduleId), relative);
}

function getModuleArchivePath(branchId, moduleId, timestamp) {
  const historyDir = getModuleHistoryDir(branchId, moduleId);
  return path.join(historyDir, `${timestamp}.json`);
}

function getModuleEventStoreContext(branchId, moduleId) {
  const liveDir = getModuleLiveDir(branchId, moduleId);
  const historyDir = path.join(getModuleHistoryDir(branchId, moduleId), 'events');
  return getEventStoreContext({ branchId, moduleId, liveDir, historyDir });
}

async function ensureBranchModuleLayout(branchId, moduleId) {
  const moduleDir = getBranchModuleDir(branchId, moduleId);
  await mkdir(moduleDir, { recursive: true });
  await mkdir(path.dirname(getModuleLivePath(branchId, moduleId)), { recursive: true });
  await mkdir(getModuleHistoryDir(branchId, moduleId), { recursive: true });
  await mkdir(path.join(getModuleHistoryDir(branchId, moduleId), 'events'), { recursive: true });
}

async function readJsonSafe(filePath, fallback = null) {
  try {
    const raw = await readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    logger.warn({ err: error, filePath }, 'Failed to read JSON file');
    return fallback;
  }
}

async function writeJson(filePath, payload) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8');
}

async function fileExists(filePath) {
  try {
    await access(filePath, FS_CONSTANTS.F_OK);
    return true;
  } catch (_err) {
    return false;
  }
}

function jsonResponse(res, status, payload) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(payload, null, 2));
}


const PUBSUB_TYPES = new Set(['auth', 'subscribe', 'publish', 'ping', 'pong']);
const LEGACY_POS_TOPIC_PREFIX = 'pos:sync:';
const SYNC_TOPIC_PREFIX = 'sync::';
const PUBSUB_TOPICS = new Map(); // topic => { subscribers:Set<string>, lastData:object|null }
const SYNC_STATES = new Map(); // key => { branchId, moduleId, version, moduleSnapshot, updatedAt }
const TRANS_HISTORY_LIMIT = Math.max(50, Number(process.env.WS2_TRANS_HISTORY_LIMIT) || 500);
const TRANS_MUTATION_HISTORY_LIMIT = Math.max(5, Number(process.env.WS2_TRANS_MUTATION_HISTORY_LIMIT) || 25);
const TRANS_HISTORY = new Map(); // key => { order:string[], records:Map<string,{ts:number,payload:object,mutationIds:Set<string>,lastAckMutationId?:string}> }

function syncStateKey(branchId, moduleId) {
  const safeBranch = branchId || 'default';
  const safeModule = moduleId || 'pos';
  return `${safeBranch}::${safeModule}`;
}

function parseSyncTopic(topic) {
  if (typeof topic !== 'string') return null;
  if (topic.startsWith(LEGACY_POS_TOPIC_PREFIX)) {
    const branchId = topic.slice(LEGACY_POS_TOPIC_PREFIX.length) || 'default';
    return { branchId, moduleId: 'pos' };
  }
  if (topic.startsWith(SYNC_TOPIC_PREFIX)) {
    const segments = topic.slice(SYNC_TOPIC_PREFIX.length).split('::');
    const branchId = segments[0] || 'default';
    const moduleId = segments[1] || 'pos';
    return { branchId, moduleId };
  }
  return null;
}

function getSyncTopics(branchId, moduleId) {
  const safeBranch = branchId || 'default';
  const safeModule = moduleId || 'pos';
  const topics = [`${SYNC_TOPIC_PREFIX}${safeBranch}::${safeModule}`];
  if (safeModule === 'pos') {
    topics.push(`${LEGACY_POS_TOPIC_PREFIX}${safeBranch}`);
  }
  return topics;
}

function transHistoryKey(branchId, moduleId) {
  const safeBranch = branchId || 'default';
  const safeModule = moduleId || 'pos';
  return `${safeBranch}::${safeModule}`;
}

function getTransTracker(key) {
  if (!key) return null;
  if (!TRANS_HISTORY.has(key)) {
    TRANS_HISTORY.set(key, { order: [], records: new Map() });
  }
  return TRANS_HISTORY.get(key);
}

function rememberTransRecord(key, transId, payload) {
  if (!key || !transId || !payload) return null;
  const tracker = getTransTracker(key);
  if (!tracker) return null;
  if (tracker.records.has(transId)) {
    const existing = tracker.records.get(transId);
    if (payload?.mutationId && existing) {
      if (!existing.mutationIds) existing.mutationIds = new Set();
      if (!existing.mutationIds.has(payload.mutationId)) {
        existing.mutationIds.add(payload.mutationId);
        if (existing.mutationIds.size > TRANS_MUTATION_HISTORY_LIMIT) {
          const trimmed = Array.from(existing.mutationIds).slice(-TRANS_MUTATION_HISTORY_LIMIT);
          existing.mutationIds = new Set(trimmed);
        }
        existing.lastAckMutationId = payload.mutationId;
      }
    }
    return existing;
  }
  const record = {
    ts: Date.now(),
    payload: deepClone(payload),
    mutationIds: new Set(),
    lastAckMutationId: payload?.mutationId || null
  };
  if (payload?.mutationId) {
    record.mutationIds.add(payload.mutationId);
  }
  tracker.records.set(transId, record);
  tracker.order.push(transId);
  if (tracker.order.length > TRANS_HISTORY_LIMIT) {
    const overflow = tracker.order.splice(0, tracker.order.length - TRANS_HISTORY_LIMIT);
    for (const oldId of overflow) {
      tracker.records.delete(oldId);
    }
  }
  return record;
}

function recallTransRecord(key, transId) {
  if (!key || !transId) return null;
  const tracker = TRANS_HISTORY.get(key);
  if (!tracker) return null;
  return tracker.records.get(transId) || null;
}

function normalizeTransId(value) {
  if (value == null) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

async function ensureSyncState(branchId, moduleId) {
  const key = syncStateKey(branchId, moduleId);
  if (SYNC_STATES.has(key)) {
    return SYNC_STATES.get(key);
  }
  let moduleSnapshot = null;
  try {
    const store = await ensureModuleStore(branchId, moduleId);
    moduleSnapshot = store.getSnapshot();
  } catch (error) {
    logger.warn({ err: error, branchId, moduleId }, 'Falling back to empty sync snapshot');
  }
  if (!moduleSnapshot) {
    moduleSnapshot = {
      moduleId,
      branchId,
      version: 1,
      tables: {},
      meta: { lastUpdatedAt: nowIso(), branchId, moduleId, serverId: SERVER_ID }
    };
  }
  const state = {
    branchId,
    moduleId,
    version: Number(moduleSnapshot.version) || 1,
    moduleSnapshot,
    updatedAt: moduleSnapshot.meta?.lastUpdatedAt || nowIso()
  };
  SYNC_STATES.set(key, state);
  return state;
}

function summarizeTableCounts(snapshot = {}) {
  const counts = {};
  const tables = snapshot.tables && typeof snapshot.tables === 'object' ? snapshot.tables : {};
  for (const [tableName, rows] of Object.entries(tables)) {
    counts[tableName] = Array.isArray(rows) ? rows.length : 0;
  }
  return counts;
}

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function toIsoTimestamp(value, fallback = nowIso()) {
  if (value == null) return fallback;
  if (typeof value === 'string' && value.trim()) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    const date = new Date(numeric);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }
  return fallback;
}

function snapshotsEqual(a, b) {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch (_err) {
    return false;
  }
}

function normalizePosSnapshot(store, incomingSnapshot) {
  if (!isPlainObject(incomingSnapshot)) return null;
  if (!store.tables.includes('pos_database')) return null;

  let dataset = null;
  if (isPlainObject(incomingSnapshot.stores)) {
    dataset = incomingSnapshot;
  } else if (isPlainObject(incomingSnapshot.payload)) {
    dataset = incomingSnapshot.payload;
  } else if (
    isPlainObject(incomingSnapshot.settings) ||
    Array.isArray(incomingSnapshot.orders) ||
    isPlainObject(incomingSnapshot.meta)
  ) {
    dataset = incomingSnapshot;
  }

  if (!dataset) return null;

  const currentSnapshot = store.getSnapshot();
  const existingRows = Array.isArray(currentSnapshot.tables?.pos_database)
    ? currentSnapshot.tables.pos_database.map((row) => deepClone(row))
    : [];
  const lastPayload = existingRows.length ? existingRows[existingRows.length - 1]?.payload : null;

  if (lastPayload && snapshotsEqual(lastPayload, dataset)) {
    return currentSnapshot;
  }

  const nowTs = nowIso();
  const meta = isPlainObject(dataset.meta) ? dataset.meta : {};
  const baseId = meta.snapshotId || meta.id || meta.exportId || incomingSnapshot.id || null;
  let recordId = baseId ? String(baseId) : createId(`${store.moduleId}-snapshot`);
  if (existingRows.some((row) => row?.id === recordId && !snapshotsEqual(row.payload, dataset))) {
    recordId = `${recordId}-${Date.now().toString(36)}`;
  } else if (existingRows.some((row) => row?.id === recordId && snapshotsEqual(row.payload, dataset))) {
    return currentSnapshot;
  }

  const createdAt = toIsoTimestamp(meta.exportedAt, nowTs);
  const record = {
    id: recordId,
    branchId: store.branchId,
    payload: deepClone(dataset),
    createdAt,
    updatedAt: nowTs
  };

  const nextRows = existingRows.concat([record]);
  const version = Number.isFinite(Number(dataset.version))
    ? Number(dataset.version)
    : Number.isFinite(Number(incomingSnapshot.version))
    ? Number(incomingSnapshot.version)
    : (currentSnapshot.version || 0) + 1;

  const nextMeta = currentSnapshot.meta && isPlainObject(currentSnapshot.meta) ? deepClone(currentSnapshot.meta) : {};
  nextMeta.lastUpdatedAt = nowTs;
  nextMeta.lastCentralSyncAt = nowTs;
  nextMeta.centralVersion = version;

  return {
    moduleId: store.moduleId,
    branchId: store.branchId,
    version,
    tables: { pos_database: nextRows },
    meta: nextMeta
  };
}

function normalizeIncomingSnapshot(store, incomingSnapshot) {
  if (!incomingSnapshot || typeof incomingSnapshot !== 'object') return incomingSnapshot;
  if (!incomingSnapshot.tables && isPlainObject(incomingSnapshot.snapshot)) {
    return normalizeIncomingSnapshot(store, incomingSnapshot.snapshot);
  }
  if (isPlainObject(incomingSnapshot.tables)) {
    const normalized = {
      moduleId: store.moduleId,
      branchId: store.branchId,
      version: Number.isFinite(Number(incomingSnapshot.version))
        ? Number(incomingSnapshot.version)
        : store.version,
      tables: {},
      meta: isPlainObject(incomingSnapshot.meta) ? deepClone(incomingSnapshot.meta) : {}
    };
    for (const tableName of store.tables) {
      const rows = Array.isArray(incomingSnapshot.tables?.[tableName])
        ? incomingSnapshot.tables[tableName].map((row) => deepClone(row))
        : [];
      normalized.tables[tableName] = rows;
    }
    return normalized;
  }

  const posSnapshot = normalizePosSnapshot(store, incomingSnapshot);
  if (posSnapshot) {
    return posSnapshot;
  }

  return incomingSnapshot;
}

function ensureInsertOnlySnapshot(store, incomingSnapshot) {
  const currentSnapshot = store.getSnapshot();
  const requiredTables = Array.isArray(store.tables) ? store.tables : Object.keys(currentSnapshot.tables || {});
  const incomingTables = incomingSnapshot.tables && typeof incomingSnapshot.tables === 'object' ? incomingSnapshot.tables : {};

  for (const tableName of requiredTables) {
    const incomingRows = incomingTables[tableName];
    if (!Array.isArray(incomingRows)) {
      return {
        ok: false,
        reason: 'missing-table',
        tableName
      };
    }
    const currentRows = Array.isArray(currentSnapshot.tables?.[tableName]) ? currentSnapshot.tables[tableName] : [];
    if (incomingRows.length < currentRows.length) {
      return {
        ok: false,
        reason: 'row-count-decreased',
        tableName,
        currentCount: currentRows.length,
        incomingCount: incomingRows.length
      };
    }
    for (let idx = 0; idx < currentRows.length; idx += 1) {
      const currentRow = currentRows[idx];
      const incomingRow = incomingRows[idx];
      if (JSON.stringify(currentRow) !== JSON.stringify(incomingRow)) {
        return {
          ok: false,
          reason: 'row-modified',
          tableName,
          index: idx
        };
      }
    }
  }

  return { ok: true };
}

function createInsertOnlyViolation(details) {
  const error = new Error('Incoming snapshot violates insert-only policy.');
  error.code = 'INSERT_ONLY_VIOLATION';
  error.details = details;
  return error;
}

async function applySyncSnapshot(branchId, moduleId, snapshot = {}, context = {}) {
  const key = syncStateKey(branchId, moduleId);
  let moduleSnapshot = snapshot && typeof snapshot === 'object' ? deepClone(snapshot) : null;
  try {
    if (moduleSnapshot) {
      const store = await ensureModuleStore(branchId, moduleId);
      moduleSnapshot = normalizeIncomingSnapshot(store, moduleSnapshot);
      const validation = ensureInsertOnlySnapshot(store, moduleSnapshot);
      if (!validation.ok) {
        throw createInsertOnlyViolation({ ...validation, branchId, moduleId });
      }
      moduleSnapshot = store.replaceTablesFromSnapshot(moduleSnapshot, { ...context, branchId, moduleId });
      await persistModuleStore(store);
    }
  } catch (error) {
    if (error?.code === 'INSERT_ONLY_VIOLATION') {
      const counts = { before: summarizeTableCounts(SYNC_STATES.get(key)?.moduleSnapshot || {}), after: summarizeTableCounts(moduleSnapshot || {}) };
      logger.warn({ branchId, moduleId, violation: error.details, counts }, 'Rejected destructive sync snapshot');
      throw error;
    }
    logger.warn({ err: error, branchId, moduleId }, 'Failed to persist sync snapshot');
    moduleSnapshot = null;
  }
  if (!moduleSnapshot) {
    const fallback = await ensureSyncState(branchId, moduleId);
    moduleSnapshot = fallback.moduleSnapshot;
  }
  const nextState = {
    branchId,
    moduleId,
    version: Number(moduleSnapshot?.version) || (SYNC_STATES.get(key)?.version || 1),
    moduleSnapshot,
    updatedAt: moduleSnapshot?.meta?.lastUpdatedAt || nowIso()
  };
  SYNC_STATES.set(key, nextState);
  return nextState;
}

async function ensurePubsubTopic(topic) {
  if (!PUBSUB_TOPICS.has(topic)) {
    PUBSUB_TOPICS.set(topic, { subscribers: new Set(), lastData: null });
  }
  const record = PUBSUB_TOPICS.get(topic);
  const descriptor = parseSyncTopic(topic);
  if (descriptor && !record.lastData) {
    const state = await ensureSyncState(descriptor.branchId, descriptor.moduleId);
    record.lastData = buildSyncPublishData(state, { meta: { reason: 'bootstrap' } });
  }
  return record;
}

async function registerPubsubSubscriber(topic, client) {
  const record = await ensurePubsubTopic(topic);
  record.subscribers.add(client.id);
  if (!client.pubsubTopics) {
    client.pubsubTopics = new Set();
  }
  client.pubsubTopics.add(topic);
  return record;
}

function unregisterPubsubSubscriptions(client) {
  if (!client || !client.pubsubTopics) return;
  for (const topic of client.pubsubTopics) {
    const record = PUBSUB_TOPICS.get(topic);
    if (record) {
      record.subscribers.delete(client.id);
      if (!record.subscribers.size) {
        PUBSUB_TOPICS.delete(topic);
      }
    }
  }
  client.pubsubTopics.clear();
}

function buildSyncPublishData(state, overrides = {}) {
  const snapshot = overrides.snapshot ? deepClone(overrides.snapshot) : deepClone(state.moduleSnapshot);
  const baseFrame = overrides.frameData && typeof overrides.frameData === 'object' ? deepClone(overrides.frameData) : {};
  const version = Number.isFinite(overrides.version) ? Number(overrides.version) : Number(state.version) || 1;
  const meta = {
    branchId: state.branchId,
    moduleId: state.moduleId,
    serverId: SERVER_ID,
    version,
    updatedAt: overrides.updatedAt || state.updatedAt,
    ...(baseFrame.meta || {}),
    ...(overrides.meta || {})
  };
  const payload = {
    action: overrides.action || baseFrame.action || 'snapshot',
    branchId: state.branchId,
    moduleId: state.moduleId,
    version,
    snapshot,
    mutationId: overrides.mutationId || baseFrame.mutationId || null,
    meta
  };
  delete baseFrame.action;
  delete baseFrame.snapshot;
  delete baseFrame.version;
  delete baseFrame.mutationId;
  delete baseFrame.meta;
  Object.assign(payload, baseFrame);
  return payload;
}

async function broadcastPubsub(topic, data) {
  const record = await ensurePubsubTopic(topic);
  record.lastData = deepClone(data);
  const frame = { type: 'publish', topic, data: deepClone(data) };
  for (const clientId of record.subscribers) {
    const target = clients.get(clientId);
    if (!target) continue;
    sendToClient(target, frame);
  }
}

function isPubsubFrame(payload) {
  if (!payload || typeof payload !== 'object') return false;
  return PUBSUB_TYPES.has(payload.type);
}

async function broadcastSyncUpdate(branchId, moduleId, state, options = {}) {
  const payload = buildSyncPublishData(state, options);
  const topics = getSyncTopics(branchId, moduleId);
  for (const topic of topics) {
    await broadcastPubsub(topic, payload);
  }
  return payload;
}

async function handlePubsubFrame(client, frame) {
  if (!client) return;
  client.protocol = 'pubsub';
  switch (frame.type) {
    case 'ping':
      sendToClient(client, { type: 'pong' });
      return;
    case 'pong':
      return;
    case 'auth':
      client.authenticated = true;
      sendToClient(client, { type: 'ack', event: 'auth' });
      return;
    case 'subscribe': {
      const topic = typeof frame.topic === 'string' ? frame.topic.trim() : '';
      if (!topic) {
        sendToClient(client, { type: 'error', code: 'invalid-topic', message: 'Subscription topic required.' });
        return;
      }
      const record = await registerPubsubSubscriber(topic, client);
      sendToClient(client, { type: 'ack', event: 'subscribe', topic });
      if (record.lastData) {
        sendToClient(client, { type: 'publish', topic, data: deepClone(record.lastData) });
      }
      return;
    }
    case 'publish': {
      const topic = typeof frame.topic === 'string' ? frame.topic.trim() : '';
      if (!topic) return;
      const descriptor = parseSyncTopic(topic);
      const frameData = frame.data && typeof frame.data === 'object' ? frame.data : {};
      const userFromFrame = typeof frameData.userId === 'string' && frameData.userId.trim()
        ? frameData.userId.trim()
        : null;
      if (userFromFrame) client.userUuid = userFromFrame;
      const transId = normalizeTransId(frameData.trans_id || frameData.transId || frameData.mutationId || null);
      if (descriptor) {
        const trackerKey = transHistoryKey(descriptor.branchId, descriptor.moduleId);
        if (!transId) {
          sendToClient(client, {
            type: 'error',
            code: 'missing-trans-id',
            message: 'Publish frames must include a trans_id.',
            topic
          });
          return;
        }
        const duplicate = recallTransRecord(trackerKey, transId);
        if (duplicate && duplicate.payload) {
          const cached = duplicate.payload;
          const ackPayload = deepClone(cached);
          const requestedMutationId = typeof frameData.mutationId === 'string' && frameData.mutationId.trim()
            ? frameData.mutationId.trim()
            : null;
          const previousMutationId = cached && typeof cached === 'object' && cached.mutationId
            ? cached.mutationId
            : duplicate.lastAckMutationId || null;
          if (ackPayload && typeof ackPayload === 'object') {
            if (requestedMutationId) {
              ackPayload.mutationId = requestedMutationId;
            }
            const baseMeta = ackPayload.meta && typeof ackPayload.meta === 'object'
              ? { ...ackPayload.meta }
              : {};
            const duplicateMeta = {
              ...baseMeta,
              duplicateTrans: true,
              transId,
              previousMutationId: previousMutationId || null,
              ackedMutationId: requestedMutationId || previousMutationId || null
            };
            if (frameData.meta && typeof frameData.meta === 'object') {
              ackPayload.meta = { ...duplicateMeta, ...frameData.meta };
            } else {
              ackPayload.meta = duplicateMeta;
            }
          }
          if (requestedMutationId) {
            if (!duplicate.mutationIds) duplicate.mutationIds = new Set();
            if (!duplicate.mutationIds.has(requestedMutationId)) {
              duplicate.mutationIds.add(requestedMutationId);
              if (duplicate.mutationIds.size > TRANS_MUTATION_HISTORY_LIMIT) {
                const trimmed = Array.from(duplicate.mutationIds).slice(-TRANS_MUTATION_HISTORY_LIMIT);
                duplicate.mutationIds = new Set(trimmed);
              }
            }
            duplicate.lastAckMutationId = requestedMutationId;
          }
          logger.info({
            clientId: client.id,
            branchId: descriptor.branchId,
            moduleId: descriptor.moduleId,
            transId,
            requestedMutationId,
            previousMutationId
          }, 'Duplicate trans_id acknowledged without reapplying payload.');
          sendToClient(client, { type: 'publish', topic, data: ackPayload });
          return;
        }
        let state = await ensureSyncState(descriptor.branchId, descriptor.moduleId);
        if (frameData.snapshot && typeof frameData.snapshot === 'object') {
          try {
            state = await applySyncSnapshot(descriptor.branchId, descriptor.moduleId, frameData.snapshot, {
              origin: 'ws',
              clientId: client.id,
              userUuid: client.userUuid || userFromFrame || null,
              transId
            });
          } catch (error) {
            if (error?.code === 'INSERT_ONLY_VIOLATION') {
              sendToClient(client, {
                type: 'error',
                code: 'insert-only-violation',
                message: error.message,
                details: error.details || null
              });
              return;
            }
            logger.warn({ err: error, branchId: descriptor.branchId, moduleId: descriptor.moduleId }, 'Failed to apply sync snapshot from WS');
            sendToClient(client, {
              type: 'error',
              code: 'sync-snapshot-failed',
              message: error?.message || 'Failed to apply snapshot.'
            });
            return;
          }
        }
        const published = await broadcastSyncUpdate(descriptor.branchId, descriptor.moduleId, state, {
          action: frameData.action,
          mutationId: frameData.mutationId,
          meta: frameData.meta,
          frameData
        });
        rememberTransRecord(trackerKey, transId, published);
      } else {
        await broadcastPubsub(topic, frameData);
      }
      return;
    }
    default: {
      const message = frame.type ? `Unsupported frame type "${frame.type}"` : 'Unsupported frame type';
      sendToClient(client, { type: 'error', code: 'unsupported-frame', message });
    }
  }
}

function traversePath(source, segments = []) {
  if (!segments.length) return source;
  let current = source;
  for (const segment of segments) {
    if (current == null) return undefined;
    if (Array.isArray(current)) {
      const idx = Number(segment);
      if (!Number.isFinite(idx)) return undefined;
      current = current[idx];
    } else if (typeof current === 'object') {
      current = current[segment];
    } else {
      return undefined;
    }
  }
  return current;
}

async function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => {
      if (!data) {
        resolve(null);
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

await mkdir(HISTORY_DIR, { recursive: true });
await mkdir(BRANCHES_DIR, { recursive: true });

const schemaEngine = new SchemaEngine();
const schemaPaths = new Set([path.resolve(DEFAULT_SCHEMA_PATH)]);
if (ENV_SCHEMA_PATH) {
  schemaPaths.add(path.resolve(ENV_SCHEMA_PATH));
}
for (const schemaPath of schemaPaths) {
  try {
    await schemaEngine.loadFromFile(schemaPath);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      logger.warn({ schemaPath }, 'Schema file missing, skipping preload');
      continue;
    }
    throw error;
  }
}
const modulesConfig = (await readJsonSafe(MODULES_CONFIG_PATH, { modules: {} })) || { modules: {} };
const branchConfig = (await readJsonSafe(BRANCHES_CONFIG_PATH, { branches: {}, patterns: [], defaults: [] })) || { branches: {}, patterns: [], defaults: [] };

const moduleStores = new Map(); // key => `${branchId}::${moduleId}`
const clients = new Map();
const branchClients = new Map();
const loadedModuleSchemas = new Set();
const moduleSeeds = new Map();

function getModuleConfig(moduleId) {
  const def = modulesConfig.modules?.[moduleId];
  if (!def) {
    throw new Error(`Module "${moduleId}" not defined in modules.json`);
  }
  if (!Array.isArray(def.tables) || !def.tables.length) {
    throw new Error(`Module "${moduleId}" has no tables defined`);
  }
  return def;
}

async function ensureModuleSchema(branchId, moduleId) {
  const cacheKey = `${branchId}::${moduleId}`;
  if (loadedModuleSchemas.has(cacheKey)) return;
  const schemaPath = getModuleSchemaPath(branchId, moduleId);
  let loaded = false;
  try {
    await schemaEngine.loadFromFile(schemaPath);
    loaded = true;
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      throw error;
    }
  }
  if (!loaded) {
    const fallback = getModuleSchemaFallbackPath(moduleId);
    if (fallback) {
      await schemaEngine.loadFromFile(fallback);
      loaded = true;
    }
  }
  if (!loaded) {
    throw new Error(`Schema for module "${moduleId}" not found for branch "${branchId}"`);
  }
  const moduleDefinition = getModuleConfig(moduleId);
  for (const tableName of moduleDefinition.tables || []) {
    try {
      schemaEngine.getTable(tableName);
    } catch (error) {
      if (error?.message?.includes('Unknown table')) {
        throw new Error(
          `Schema for module "${moduleId}" is missing required table "${tableName}" for branch "${branchId}"`
        );
      }
      throw error;
    }
  }
  loadedModuleSchemas.add(cacheKey);
}

async function ensureModuleSeed(branchId, moduleId) {
  const cacheKey = `${branchId}::${moduleId}`;
  if (moduleSeeds.has(cacheKey)) return moduleSeeds.get(cacheKey);
  const seedPath = getModuleSeedPath(branchId, moduleId);
  let seed = await readJsonSafe(seedPath, undefined);
  if (!seed || typeof seed !== 'object') {
    const fallback = getModuleSeedFallbackPath(moduleId);
    if (fallback) {
      seed = await readJsonSafe(fallback, null);
    }
  }
  if (!seed || typeof seed !== 'object') {
    seed = null;
  }
  moduleSeeds.set(cacheKey, seed);
  return seed;
}

function getBranchModules(branchId) {
  if (branchConfig.branches && branchConfig.branches[branchId] && Array.isArray(branchConfig.branches[branchId].modules)) {
    return branchConfig.branches[branchId].modules.slice();
  }
  for (const pattern of branchConfig.patterns || []) {
    if (!pattern.match || !Array.isArray(pattern.modules)) continue;
    const regex = new RegExp(pattern.match);
    if (regex.test(branchId)) {
      return pattern.modules.slice();
    }
  }
  return Array.isArray(branchConfig.defaults) ? branchConfig.defaults.slice() : [];
}

function moduleKey(branchId, moduleId) {
  return `${branchId}::${moduleId}`;
}

async function persistModuleStore(store) {
  const filePath = getModuleFilePath(store.branchId, store.moduleId);
  store.meta = store.meta || {};
  const totalCount = Object.values(store.data || {}).reduce((acc, value) => {
    if (Array.isArray(value)) return acc + value.length;
    return acc;
  }, 0);
  store.meta.counter = totalCount;
  if ('labCounter' in store.meta) {
    store.meta.labCounter = totalCount;
  }
  const payload = store.toJSON();
  await writeJson(filePath, payload);
  logger.debug({ branchId: store.branchId, moduleId: store.moduleId, version: store.version }, 'Persisted module store');
}

async function archiveModuleFile(branchId, moduleId) {
  const filePath = getModuleFilePath(branchId, moduleId);
  if (!(await fileExists(filePath))) return null;
  const timestamp = nowIso().replace(/[:.]/g, '-');
  const target = getModuleArchivePath(branchId, moduleId, timestamp);
  await mkdir(path.dirname(target), { recursive: true });
  try {
    await rename(filePath, target);
  } catch (error) {
    if (error?.code !== 'EXDEV') throw error;
    const snapshot = await readJsonSafe(filePath);
    await writeJson(target, snapshot);
    await rm(filePath, { force: true }).catch(() => {});
  }
  return target;
}

async function ensureModuleStore(branchId, moduleId) {
  const key = moduleKey(branchId, moduleId);
  if (moduleStores.has(key)) {
    return moduleStores.get(key);
  }
  await ensureBranchModuleLayout(branchId, moduleId);
  await ensureModuleSchema(branchId, moduleId);
  const moduleSeed = await ensureModuleSeed(branchId, moduleId);
  const moduleDefinition = getModuleConfig(moduleId);
  const filePath = getModuleFilePath(branchId, moduleId);
  const existing = await readJsonSafe(filePath, null);
  let seed = {};
  if (existing && typeof existing === 'object') {
    seed = {
      version: existing.version || 1,
      meta: existing.meta || {},
      tables: existing.tables || {}
    };
  }
  const store = new ModuleStore(schemaEngine, branchId, moduleId, moduleDefinition, seed, moduleSeed);
  moduleStores.set(key, store);
  if (!existing) {
    await persistModuleStore(store);
  }
  return store;
}

async function ensureBranchModules(branchId) {
  const modules = getBranchModules(branchId);
  const stores = [];
  for (const moduleId of modules) {
    try {
      const store = await ensureModuleStore(branchId, moduleId);
      stores.push(store);
    } catch (error) {
      logger.warn({ err: error, branchId, moduleId }, 'Failed to ensure module store');
    }
  }
  return stores;
}

async function hydrateModulesFromDisk() {
  const branchDirs = await readdir(BRANCHES_DIR, { withFileTypes: true }).catch(() => []);
  for (const dirEntry of branchDirs) {
    if (!dirEntry.isDirectory()) continue;
    const branchId = safeDecode(dirEntry.name);
    const modulesDir = path.join(getBranchDir(branchId), 'modules');
    const moduleEntries = await readdir(modulesDir, { withFileTypes: true }).catch(() => []);
    for (const entry of moduleEntries) {
      if (!entry.isDirectory()) continue;
      const moduleId = safeDecode(entry.name);
      if (!modulesConfig.modules?.[moduleId]) {
        logger.warn({ branchId, moduleId }, 'Skipping module not present in modules config');
        continue;
      }
      try {
        await ensureModuleStore(branchId, moduleId);
        logger.info({ branchId, moduleId }, 'Hydrated module from disk');
      } catch (error) {
        logger.warn({ err: error, branchId, moduleId }, 'Failed to hydrate module from disk');
      }
    }
  }
}

await hydrateModulesFromDisk();
startEventArchiveService().catch((error) => {
  logger.warn({ err: error }, 'Failed to start event archive service');
});

async function buildBranchSnapshot(branchId) {
  const modules = getBranchModules(branchId);
  await Promise.all(
    modules.map((moduleId) =>
      ensureModuleStore(branchId, moduleId).catch((error) => {
        logger.warn({ err: error, branchId, moduleId }, 'Failed to ensure module during snapshot');
        return null;
      })
    )
  );
  const snapshot = {};
  for (const moduleId of modules) {
    const key = moduleKey(branchId, moduleId);
    if (moduleStores.has(key)) {
      snapshot[moduleId] = moduleStores.get(key).getSnapshot();
    }
  }
  return {
    branchId,
    modules: snapshot,
    updatedAt: nowIso(),
    serverId: SERVER_ID
  };
}

function listBranchSummaries() {
  const summaries = new Map();
  for (const [key, store] of moduleStores.entries()) {
    const [branchId, moduleId] = key.split('::');
    if (!summaries.has(branchId)) {
      summaries.set(branchId, { id: branchId, modules: [] });
    }
    const entry = summaries.get(branchId);
    entry.modules.push({ moduleId, version: store.version, meta: deepClone(store.meta || {}) });
  }
  return Array.from(summaries.values());
}

let eventArchivePool = null;
let eventArchiveTimer = null;
let eventArchiveTableReady = false;

function listEventStoreContexts() {
  const contexts = [];
  for (const key of moduleStores.keys()) {
    const [branchId, moduleId] = key.split('::');
    contexts.push(getModuleEventStoreContext(branchId, moduleId));
  }
  return contexts;
}

async function ensureEventArchiveTable(pool) {
  if (eventArchiveTableReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ws2_event_journal (
      id TEXT PRIMARY KEY,
      branch_id TEXT NOT NULL,
      module_id TEXT NOT NULL,
      table_name TEXT,
      action TEXT NOT NULL,
      record JSONB,
      meta JSONB,
      publish_state JSONB,
      created_at TIMESTAMPTZ NOT NULL,
      recorded_at TIMESTAMPTZ NOT NULL,
      sequence BIGINT
    )
  `);
  await pool.query(
    'CREATE INDEX IF NOT EXISTS ws2_event_journal_branch_module_idx ON ws2_event_journal (branch_id, module_id, sequence)'
  );
  eventArchiveTableReady = true;
}

async function uploadEventArchive(pool, context, filePath) {
  const entries = await readLogFile(filePath);
  if (!entries.length) {
    await discardLogFile(filePath);
    return;
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const insertSql =
      'INSERT INTO ws2_event_journal (id, branch_id, module_id, table_name, action, record, meta, publish_state, created_at, recorded_at, sequence) ' +
      'VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ' +
      'ON CONFLICT (id) DO UPDATE SET meta = EXCLUDED.meta, publish_state = EXCLUDED.publish_state, recorded_at = EXCLUDED.recorded_at';
    for (const entry of entries) {
      await client.query(insertSql, [
        entry.id,
        entry.branchId || context.branchId,
        entry.moduleId || context.moduleId,
        entry.table || null,
        entry.action || 'module:insert',
        entry.record || null,
        entry.meta || {},
        entry.publishState || {},
        entry.createdAt ? new Date(entry.createdAt) : new Date(),
        entry.recordedAt ? new Date(entry.recordedAt) : new Date(),
        entry.sequence || null
      ]);
    }
    await client.query('COMMIT');
    await discardLogFile(filePath);
    logger.info(
      { branchId: context.branchId, moduleId: context.moduleId, filePath, events: entries.length },
      'Archived event log batch to PostgreSQL'
    );
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function runEventArchiveCycle(pool) {
  const contexts = listEventStoreContexts();
  if (!contexts.length) return;
  await ensureEventArchiveTable(pool);
  for (const context of contexts) {
    try {
      await rotateEventLog(context);
    } catch (error) {
      logger.warn({ err: error, branchId: context.branchId, moduleId: context.moduleId }, 'Failed to rotate event log');
    }
    const archives = await listArchivedLogs(context);
    for (const filePath of archives) {
      try {
        await uploadEventArchive(pool, context, filePath);
      } catch (error) {
        logger.warn({ err: error, branchId: context.branchId, moduleId: context.moduleId, filePath }, 'Failed to archive event log');
      }
    }
  }
}

async function startEventArchiveService() {
  if (EVENT_ARCHIVER_DISABLED) {
    logger.info('Event archive service disabled via configuration flag');
    return;
  }
  if (!EVENTS_PG_URL) {
    logger.info('Event archive service disabled: PostgreSQL URL missing');
    return;
  }
  if (!eventArchivePool) {
    eventArchivePool = new Pool({ connectionString: EVENTS_PG_URL });
    eventArchivePool.on('error', (err) => {
      logger.warn({ err }, 'PostgreSQL pool error');
    });
  }
  const runCycle = async () => {
    try {
      await runEventArchiveCycle(eventArchivePool);
    } catch (error) {
      logger.warn({ err: error }, 'Event archive cycle failed');
    }
  };
  await runCycle();
  eventArchiveTimer = setInterval(runCycle, EVENT_ARCHIVE_INTERVAL_MS);
  eventArchiveTimer.unref();
  logger.info({ intervalMs: EVENT_ARCHIVE_INTERVAL_MS }, 'Event archive service started');
}

async function serveStaticAsset(req, res, url) {
  if (!STATIC_DIR) return false;
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;
  let pathname = url.pathname;
  if (!pathname || pathname === '/') pathname = '/index.html';
  const decoded = decodeURIComponent(pathname);
  const normalized = path.normalize(decoded).replace(/^[/\\]+/, '');
  const absolutePath = path.join(STATIC_DIR, normalized);
  if (!absolutePath.startsWith(STATIC_DIR)) return false;
  try {
    const data = await readFile(absolutePath);
    const ext = path.extname(absolutePath).toLowerCase();
    const headers = {
      'content-type': CONTENT_TYPES[ext] || 'application/octet-stream',
      ...STATIC_CACHE_HEADERS
    };
    res.writeHead(200, headers);
    if (req.method === 'HEAD') {
      res.end();
    } else {
      res.end(data);
    }
    return true;
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'EISDIR') {
      return false;
    }
    logger.warn({ err: error, pathname: decoded }, 'Failed to serve static asset');
    jsonResponse(res, 500, { error: 'static-asset-error' });
    return true;
  }
}

function resolveSyncRequest(pathname, searchParams) {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length < 2 || segments[0] !== 'api') return null;
  if (segments[1] === 'pos-sync') {
    const branchId = safeDecode(segments[2] || searchParams.get('branch') || 'default');
    return { branchId, moduleId: 'pos' };
  }
  if (segments[1] === 'sync') {
    const branchId = safeDecode(segments[2] || searchParams.get('branch') || 'default');
    const moduleId = safeDecode(segments[3] || searchParams.get('module') || 'pos');
    return { branchId, moduleId };
  }
  return null;
}

async function handleSyncApi(req, res, url) {
  const descriptor = resolveSyncRequest(url.pathname, url.searchParams);
  if (!descriptor) {
    jsonResponse(res, 404, { error: 'sync-endpoint-not-found', path: url.pathname });
    return true;
  }
  const { branchId, moduleId } = descriptor;

  if (req.method === 'GET') {
    const state = await ensureSyncState(branchId, moduleId);
    jsonResponse(res, 200, {
      branchId,
      moduleId,
      version: state.version,
      updatedAt: state.updatedAt,
      serverId: SERVER_ID,
      snapshot: deepClone(state.moduleSnapshot)
    });
    return true;
  }

  if (req.method === 'POST') {
    let body = null;
    try {
      body = await readBody(req);
    } catch (error) {
      jsonResponse(res, 400, { error: 'invalid-json', message: error.message });
      return true;
    }
    const frameData = body && typeof body === 'object' ? body : {};
    const snapshot = frameData.snapshot && typeof frameData.snapshot === 'object' ? frameData.snapshot : null;
    let state;
    try {
      state = await applySyncSnapshot(branchId, moduleId, snapshot, { origin: 'http', requestId: frameData.requestId || null });
    } catch (error) {
      if (error?.code === 'INSERT_ONLY_VIOLATION') {
        jsonResponse(res, 409, {
          error: 'insert-only-violation',
          message: error.message,
          details: error.details || null
        });
        return true;
      }
      logger.warn({ err: error, branchId, moduleId }, 'Failed to apply sync snapshot via HTTP');
      jsonResponse(res, 500, { error: 'sync-snapshot-failed', message: error?.message || 'Failed to apply snapshot.' });
      return true;
    }
    await broadcastSyncUpdate(branchId, moduleId, state, {
      action: frameData.action,
      mutationId: frameData.mutationId,
      meta: frameData.meta,
      frameData
    });
    jsonResponse(res, 200, {
      status: 'ok',
      branchId,
      moduleId,
      version: state.version,
      updatedAt: state.updatedAt
    });
    return true;
  }

  jsonResponse(res, 405, { error: 'method-not-allowed' });
  return true;
}

async function handleBranchesApi(req, res, url) {
  const segments = url.pathname.split('/').filter(Boolean);
  if (segments.length === 2) {
    if (req.method === 'GET') {
      jsonResponse(res, 200, { branches: listBranchSummaries() });
      return;
    }
    jsonResponse(res, 405, { error: 'method-not-allowed' });
    return;
  }

  const branchId = safeDecode(segments[2]);

  if (segments.length === 3) {
    if (req.method === 'GET') {
      const snapshot = await buildBranchSnapshot(branchId);
      jsonResponse(res, 200, snapshot);
      return;
    }
    jsonResponse(res, 405, { error: 'method-not-allowed' });
    return;
  }

  if (segments[3] !== 'modules' || segments.length < 5) {
    jsonResponse(res, 404, { error: 'not-found' });
    return;
  }

  const moduleId = segments[4];
  const modules = getBranchModules(branchId);
  if (!modules.includes(moduleId)) {
    jsonResponse(res, 404, { error: 'module-not-found' });
    return;
  }

  const store = await ensureModuleStore(branchId, moduleId);
  const snapshot = store.getSnapshot();

  if (segments.length === 5) {
    if (req.method === 'GET') {
      jsonResponse(res, 200, snapshot);
      return;
    }
    if (req.method === 'POST') {
      try {
        const body = await readBody(req);
        jsonResponse(res, 200, { received: body, snapshot });
      } catch (error) {
        jsonResponse(res, 400, { error: 'invalid-json', message: error.message });
      }
      return;
    }
    jsonResponse(res, 405, { error: 'method-not-allowed' });
    return;
  }

  const tail = segments.slice(5);
  if (tail.length === 1 && tail[0] === 'reset') {
    if (req.method !== 'POST') {
      jsonResponse(res, 405, { error: 'method-not-allowed' });
      return;
    }
    await resetModule(branchId, moduleId);
    const snapshot = await buildBranchSnapshot(branchId);
    jsonResponse(res, 200, snapshot);
    return;
  }

  if (tail.length === 2 && tail[0] === 'events' && tail[1] === 'batch') {
    if (req.method !== 'POST') {
      jsonResponse(res, 405, { error: 'method-not-allowed' });
      return;
    }
    let body;
    try {
      body = await readBody(req);
    } catch (error) {
      jsonResponse(res, 400, { error: 'invalid-json', message: error.message });
      return;
    }
    if (!body || !Object.prototype.hasOwnProperty.call(body, 'lastAckId')) {
      jsonResponse(res, 400, { error: 'missing-last-ack-id' });
      return;
    }
    const lastAckId = body.lastAckId;
    if (lastAckId !== null && typeof lastAckId !== 'string') {
      jsonResponse(res, 400, { error: 'invalid-last-ack-id' });
      return;
    }
    const incomingEvents = Array.isArray(body.events) ? body.events : [];
    const normalizedEvents = [];
    for (let idx = 0; idx < incomingEvents.length; idx += 1) {
      const rawEvent = incomingEvents[idx];
      if (!rawEvent || typeof rawEvent !== 'object') {
        jsonResponse(res, 400, { error: 'invalid-event-payload', index: idx });
        return;
      }
      const action = typeof rawEvent.action === 'string' ? rawEvent.action : 'module:insert';
      if (action !== 'module:insert') {
        jsonResponse(res, 400, { error: 'unsupported-event-action', index: idx, action });
        return;
      }
      const tableName = rawEvent.table || rawEvent.tableName || rawEvent.targetTable;
      if (!tableName || typeof tableName !== 'string') {
        jsonResponse(res, 400, { error: 'missing-table-name', index: idx });
        return;
      }
      normalizedEvents.push({
        ...rawEvent,
        action,
        tableName,
        record: rawEvent.record || rawEvent.data || {}
      });
    }
    const eventContext = getModuleEventStoreContext(branchId, moduleId);
    const eventMeta = await loadEventMeta(eventContext);
    const expectedAck = eventMeta.lastEventId || null;
    if (lastAckId !== expectedAck) {
      jsonResponse(res, 409, { error: 'last-ack-mismatch', expected: expectedAck, received: lastAckId });
      return;
    }
    if (eventMeta.lastAckId !== lastAckId) {
      await updateEventMeta(eventContext, { lastAckId });
    }
    const broadcast = body.broadcast !== false;
    const ingested = [];
    for (const entry of normalizedEvents) {
      try {
        const result = await handleModuleEvent(
          branchId,
          moduleId,
          {
            ...entry,
            table: entry.tableName,
            record: entry.record,
            eventId: entry.eventId || entry.id || null
          },
          null,
          { source: 'rest-batch', broadcast }
        );
        ingested.push(result);
      } catch (error) {
        logger.warn({ err: error, branchId, moduleId }, 'Batch event failed');
        jsonResponse(res, 400, { error: 'module-event-failed', message: error.message, index: ingested.length });
        return;
      }
    }
    const latestMeta = await loadEventMeta(eventContext);
    jsonResponse(res, 200, {
      branchId,
      moduleId,
      ingested: ingested.length,
      lastAckId: latestMeta.lastAckId,
      lastEventId: latestMeta.lastEventId,
      sequences: ingested.map((item) => ({
        id: item?.logEntry?.id || null,
        sequence: item?.logEntry?.sequence || null,
        table: item?.logEntry?.table || null,
        createdAt: item?.logEntry?.createdAt || null
      }))
    });
    return;
  }

  if (tail.length === 1 && tail[0] === 'events') {
    if (req.method === 'GET') {
      const events = Array.isArray(snapshot.tables?.pos_database)
        ? snapshot.tables.pos_database.map((row) => ({
            id: row.id,
            branchId: row.branchId,
            createdAt: row.createdAt || null,
            updatedAt: row.updatedAt || null,
            payload: row.payload ? deepClone(row.payload) : null
          }))
        : [];
      const eventContext = getModuleEventStoreContext(branchId, moduleId);
      const eventLogMeta = await loadEventMeta(eventContext).catch(() => null);
      jsonResponse(res, 200, {
        branchId,
        moduleId,
        version: snapshot.version,
        updatedAt: snapshot.meta?.lastUpdatedAt || null,
        serverId: SERVER_ID,
        events,
        eventLog: eventLogMeta ? deepClone(eventLogMeta) : null,
        snapshot: deepClone(snapshot)
      });
      return;
    }
    if (req.method !== 'POST') {
      jsonResponse(res, 405, { error: 'method-not-allowed' });
      return;
    }
    try {
      const body = await readBody(req);
      const result = await handleModuleEvent(branchId, moduleId, body, null, { source: 'rest' });
      jsonResponse(res, 200, result);
    } catch (error) {
      logger.warn({ err: error, branchId, moduleId }, 'Module event failed (REST)');
      jsonResponse(res, 400, { error: 'module-event-failed', message: error.message });
    }
    return;
  }

  if (req.method === 'GET') {
    const value = traversePath(snapshot, tail);
    if (value === undefined) {
      jsonResponse(res, 404, { error: 'path-not-found' });
      return;
    }
    jsonResponse(res, 200, value);
    return;
  }

  jsonResponse(res, 405, { error: 'method-not-allowed' });
}

async function resetModule(branchId, moduleId) {
  const store = await ensureModuleStore(branchId, moduleId);
  const moduleSeed = await ensureModuleSeed(branchId, moduleId);
  await archiveModuleFile(branchId, moduleId);
  store.reset();
  if (moduleSeed) {
    store.applySeed(moduleSeed, { reason: 'reset-seed' });
  }
  await persistModuleStore(store);
  const snapshot = store.getSnapshot();
  broadcastToBranch(branchId, {
    type: 'server:event',
    action: 'module:reset',
    moduleId,
    branchId,
    version: store.version,
    snapshot,
    record: null,
    meta: { serverId: SERVER_ID, reason: 'module-reset', moduleId }
  });
  return store;
}

async function handleModuleEvent(branchId, moduleId, payload = {}, client = null, options = {}) {
  const action = typeof payload.action === 'string' ? payload.action : 'module:insert';
  if (action !== 'module:insert') {
    throw new Error(`Unsupported module action: ${action}`);
  }
  const tableName = payload.table || payload.tableName || payload.targetTable;
  if (!tableName) throw new Error('Missing table name for module insert');
  const recordPayload = payload.record || payload.data || {};
  const store = await ensureModuleStore(branchId, moduleId);
  const created = store.insert(tableName, recordPayload, {
    clientId: client?.id || null,
    userId: payload.userId || null,
    source: options.source || payload.source || null
  });
  await persistModuleStore(store);
  const snapshot = store.getSnapshot();
  const baseMeta = {
    serverId: SERVER_ID,
    branchId,
    moduleId,
    table: tableName,
    timestamp: nowIso()
  };
  if (options.source || payload.source) {
    baseMeta.source = options.source || payload.source;
  }
  if (payload.meta && typeof payload.meta === 'object') {
    baseMeta.clientMeta = deepClone(payload.meta);
  }
  const eventContext = getModuleEventStoreContext(branchId, moduleId);
  const logEntry = await appendModuleEvent(eventContext, {
    id: payload.eventId || payload.id || null,
    action,
    branchId,
    moduleId,
    table: tableName,
    record: created,
    meta: baseMeta,
    publishState: payload.publishState
  });
  await updateEventMeta(eventContext, { lastAckId: logEntry.id });
  const enrichedMeta = { ...baseMeta, eventId: logEntry.id, sequence: logEntry.sequence };
  const ack = {
    type: 'server:ack',
    action,
    branchId,
    moduleId,
    version: store.version,
    table: tableName,
    record: created,
    eventId: logEntry.id,
    sequence: logEntry.sequence,
    publishState: logEntry.publishState,
    meta: enrichedMeta
  };
  const event = {
    type: 'server:event',
    action,
    branchId,
    moduleId,
    version: store.version,
    table: tableName,
    record: created,
    snapshot,
    eventId: logEntry.id,
    sequence: logEntry.sequence,
    publishState: logEntry.publishState,
    meta: enrichedMeta
  };
  if (client) {
    sendToClient(client, ack);
  }
  if (options.broadcast !== false) {
    broadcastToBranch(branchId, event, client);
  }
  return { ack, event, logEntry };
}

function registerClient(client) {
  clients.set(client.id, client);
  if (!client.branchId) return;
  if (!branchClients.has(client.branchId)) {
    branchClients.set(client.branchId, new Set());
  }
  branchClients.get(client.branchId).add(client.id);
}

function unregisterClient(client) {
  if (!client) return;
  unregisterPubsubSubscriptions(client);
  clients.delete(client.id);
  if (client.branchId && branchClients.has(client.branchId)) {
    const set = branchClients.get(client.branchId);
    set.delete(client.id);
    if (!set.size) branchClients.delete(client.branchId);
  }
}

function sendToClient(client, payload) {
  if (!client || !client.ws) return;
  if (client.ws.readyState !== client.ws.OPEN) return;
  try {
    client.ws.send(JSON.stringify(payload));
  } catch (error) {
    logger.warn({ err: error, clientId: client.id }, 'Failed to send message to client');
  }
}

function broadcastToBranch(branchId, payload, exceptClient = null) {
  const set = branchClients.get(branchId);
  if (!set) return;
  for (const clientId of set) {
    const target = clients.get(clientId);
    if (!target) continue;
    if (exceptClient && target.id === exceptClient.id) continue;
    sendToClient(target, payload);
  }
}

async function sendSnapshot(client, meta = {}) {
  if (!client.branchId) return;
  const modules = await ensureBranchModules(client.branchId);
  const snapshot = {};
  for (const store of modules) {
    snapshot[store.moduleId] = store.getSnapshot();
  }
  sendToClient(client, {
    type: 'server:snapshot',
    branchId: client.branchId,
    modules: snapshot,
    meta: { ...meta, serverId: SERVER_ID, branchId: client.branchId }
  });
}

async function handleHello(client, payload) {
  const branchId = typeof payload.branchId === 'string' && payload.branchId.trim() ? payload.branchId.trim() : 'lab:test-pad';
  client.branchId = branchId;
  client.role = typeof payload.role === 'string' ? payload.role : 'unknown';
  if (typeof payload.userId === 'string' && payload.userId.trim()) {
    client.userUuid = payload.userId.trim();
  }
  client.status = 'ready';
  registerClient(client);
  await ensureBranchModules(branchId);
  sendServerLog(client, 'info', 'Client registered', { branchId, role: client.role });
  await sendSnapshot(client, { reason: 'initial-sync', requestId: payload.requestId });
}

function sendServerLog(client, level, message, context = {}) {
  sendToClient(client, {
    type: 'server:log',
    level,
    message,
    context,
    ts: nowIso(),
    serverId: SERVER_ID
  });
}

async function handleMessage(client, raw) {
  let payload = raw;
  if (payload instanceof Buffer) payload = payload.toString('utf8');
  if (typeof payload !== 'string') {
    sendServerLog(client, 'warn', 'Received non-string message');
    return;
  }
  const parsed = safeJsonParse(payload);
  if (!parsed || typeof parsed !== 'object') {
    sendServerLog(client, 'warn', 'Received invalid JSON payload', { preview: payload.slice(0, 80) });
    return;
  }
  if (isPubsubFrame(parsed)) {
    await handlePubsubFrame(client, parsed);
    return;
  }
  switch (parsed.type) {
    case 'client:hello':
      await handleHello(client, parsed);
      break;
    case 'client:request:snapshot':
      await sendSnapshot(client, { reason: 'explicit-request', requestId: parsed.requestId });
      break;
    case 'client:request:history':
      await sendSnapshot(client, { reason: 'history-request', requestId: parsed.requestId });
      break;
    case 'client:publish': {
      if (!client.branchId) {
        sendServerLog(client, 'error', 'Client attempted publish before hello handshake');
        return;
      }
      const branchId = client.branchId;
      const moduleId = parsed.moduleId || parsed.module || null;
      if (!moduleId) {
        sendServerLog(client, 'error', 'Module ID missing in publish payload');
        return;
      }
      try {
        await handleModuleEvent(branchId, moduleId, parsed, client, { source: parsed.source || 'ws-client' });
      } catch (error) {
        logger.warn({ err: error, clientId: client.id, branchId, moduleId }, 'Module event failed');
        sendServerLog(client, 'error', error.message || 'Module event failed');
      }
      break;
    }
    default:
      sendServerLog(client, 'warn', 'Unknown message type', { type: parsed.type });
  }
}

function getConnectionState(client) {
  return {
    id: client.id,
    branchId: client.branchId,
    role: client.role,
    connectedAt: client.connectedAt,
    attempts: client.attempts,
    state: client.state || 'open'
  };
}

const httpServer = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  if (await serveStaticAsset(req, res, url)) return;

  if (req.method === 'GET' && url.pathname === '/healthz') {
    jsonResponse(res, 200, { status: 'ok', serverId: SERVER_ID, now: nowIso() });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/state') {
    const branchParam = url.searchParams.get('branch') || 'lab:test-pad';
    const branchId = decodeURIComponent(branchParam);
    try {
      const snapshot = await buildBranchSnapshot(branchId);
      jsonResponse(res, 200, snapshot);
    } catch (error) {
      logger.warn({ err: error, branchId }, 'Failed to build state response');
      jsonResponse(res, 500, { error: 'state-unavailable', message: error.message });
    }
    return;
  }

  if (url.pathname.startsWith('/api/pos-sync') || url.pathname.startsWith('/api/sync')) {
    const handled = await handleSyncApi(req, res, url);
    if (handled) return;
  }
  if (url.pathname.startsWith('/api/branch/')) {
    const aliasPath = `/api/branches/${url.pathname.slice('/api/branch/'.length)}`.replace(/\/+/g, '/');
    const aliasUrl = new URL(`${aliasPath}${url.search}`, url.origin);
    await handleBranchesApi(req, res, aliasUrl);
    return;
  }
  if (url.pathname.startsWith('/api/branches')) {
    await handleBranchesApi(req, res, url);
    return;
  }

  jsonResponse(res, 404, { error: 'not-found', path: url.pathname });
});

const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (ws, req) => {
  const clientId = createId('client');
  const cookies = parseCookies(req.headers?.cookie || '');
  const cookieUser = typeof cookies.UserUniid === 'string' && cookies.UserUniid.trim() ? cookies.UserUniid.trim() : null;
  const client = {
    id: clientId,
    ws,
    branchId: null,
    role: 'unknown',
    status: 'connecting',
    connectedAt: nowIso(),
    attempts: 0,
    remoteAddress: req.socket?.remoteAddress,
    protocol: 'unknown',
    pubsubTopics: new Set(),
    userUuid: cookieUser || null,
    cookies
  };
  clients.set(client.id, client);
  logger.info({ clientId, address: client.remoteAddress }, 'Client connected');
  sendToClient(client, {
    type: 'server:hello',
    serverId: SERVER_ID,
    now: nowIso(),
    defaults: { branchId: 'lab:test-pad' }
  });
  ws.on('message', (message) => {
    handleMessage(client, message).catch((error) => {
      logger.warn({ err: error, clientId: client.id }, 'Failed to handle message');
    });
  });
  ws.on('close', (code, reason) => {
    unregisterClient(client);
    logger.info({ clientId, code, reason: reason?.toString() }, 'Client disconnected');
  });
  ws.on('error', (error) => {
    logger.warn({ clientId, err: error }, 'WebSocket error');
  });
});

httpServer.listen(PORT, HOST, () => {
  logger.info({ host: HOST, port: PORT, serverId: SERVER_ID }, 'Schema-driven WS server ready');
});
