import { createServer } from 'http';
import { readFile, writeFile, access, mkdir, readdir, rename, rm } from 'fs/promises';
import { constants as FS_CONSTANTS } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';

import logger from './logger.js';
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
const SCHEMA_PATH = process.env.WS_SCHEMA_PATH || path.join(STATIC_DIR, 'POS_schema.json');
const MODULES_CONFIG_PATH = process.env.MODULES_CONFIG_PATH || path.join(ROOT_DIR, 'data', 'modules.json');
const BRANCHES_CONFIG_PATH = process.env.BRANCHES_CONFIG_PATH || path.join(ROOT_DIR, 'data', 'branches.config.json');
const HISTORY_DIR = process.env.HISTORY_DIR || path.join(ROOT_DIR, 'data', 'history');

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

async function ensureBranchModuleLayout(branchId, moduleId) {
  const moduleDir = getBranchModuleDir(branchId, moduleId);
  await mkdir(moduleDir, { recursive: true });
  await mkdir(path.dirname(getModuleLivePath(branchId, moduleId)), { recursive: true });
  await mkdir(getModuleHistoryDir(branchId, moduleId), { recursive: true });
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

async function applySyncSnapshot(branchId, moduleId, snapshot = {}, context = {}) {
  const key = syncStateKey(branchId, moduleId);
  let moduleSnapshot = snapshot && typeof snapshot === 'object' ? deepClone(snapshot) : null;
  try {
    if (moduleSnapshot) {
      const store = await ensureModuleStore(branchId, moduleId);
      moduleSnapshot = store.replaceTablesFromSnapshot(moduleSnapshot, { ...context, branchId, moduleId });
      await persistModuleStore(store);
    }
  } catch (error) {
    logger.warn({ err: error, branchId, moduleId }, 'Failed to persist sync snapshot');
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
      if (descriptor) {
        let state = await ensureSyncState(descriptor.branchId, descriptor.moduleId);
        if (frameData.snapshot && typeof frameData.snapshot === 'object') {
          state = await applySyncSnapshot(descriptor.branchId, descriptor.moduleId, frameData.snapshot, { origin: 'ws', clientId: client.id });
        }
        await broadcastSyncUpdate(descriptor.branchId, descriptor.moduleId, state, {
          action: frameData.action,
          mutationId: frameData.mutationId,
          meta: frameData.meta,
          frameData
        });
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
await schemaEngine.loadFromFile(SCHEMA_PATH);
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
    const state = await applySyncSnapshot(branchId, moduleId, snapshot, { origin: 'http', requestId: frameData.requestId || null });
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

  if (tail.length === 1 && tail[0] === 'events') {
    if (req.method !== 'POST') {
      jsonResponse(res, 405, { error: 'method-not-allowed' });
      return;
    }
    try {
      const body = await readBody(req);
      const result = await handleModuleEvent(branchId, moduleId, body, null);
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

async function handleModuleEvent(branchId, moduleId, payload = {}, client) {
  const action = typeof payload.action === 'string' ? payload.action : 'module:insert';
  if (action !== 'module:insert') {
    throw new Error(`Unsupported module action: ${action}`);
  }
  const tableName = payload.table || payload.tableName || payload.targetTable;
  if (!tableName) throw new Error('Missing table name for module insert');
  const recordPayload = payload.record || payload.data || {};
  const store = await ensureModuleStore(branchId, moduleId);
  const created = store.insert(tableName, recordPayload, { clientId: client?.id || null, userId: payload.userId || null });
  await persistModuleStore(store);
  const snapshot = store.getSnapshot();
  const meta = { serverId: SERVER_ID, branchId, moduleId, table: tableName, timestamp: nowIso() };
  const ack = {
    type: 'server:ack',
    action,
    branchId,
    moduleId,
    version: store.version,
    table: tableName,
    record: created,
    meta
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
    meta
  };
  if (client) {
    sendToClient(client, ack);
  }
  broadcastToBranch(branchId, event, client);
  return { ack, event };
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
        await handleModuleEvent(branchId, moduleId, parsed, client);
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
    pubsubTopics: new Set()
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
