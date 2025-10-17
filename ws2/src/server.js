import { createServer } from 'http';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';

import logger from './logger.js';
import BranchStore from './store.js';
import { createId, nowIso, safeJsonParse } from './utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const DATASET_PATH = process.env.DATASET_PATH || path.join(ROOT_DIR, 'data', 'pos-dataset.json');
const HISTORY_DIR = process.env.HISTORY_DIR || path.join(ROOT_DIR, 'data', 'history');
const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number(process.env.PORT || 3200);
const MAX_HISTORY_RESPONSE = Number(process.env.WS2_HISTORY_LIMIT || 250);
const SERVER_ID = process.env.SERVER_ID || createId('ws2');

let dataset = {};
try {
  const raw = await readFile(DATASET_PATH, 'utf8');
  dataset = JSON.parse(raw);
  logger.info({ path: DATASET_PATH }, 'Loaded dataset seed');
} catch (error) {
  logger.error({ err: error, path: DATASET_PATH }, 'Failed to load dataset seed');
  dataset = {};
}

await mkdir(HISTORY_DIR, { recursive: true });

const DEFAULT_BRANCH_ID = dataset?.settings?.sync?.branch_id || 'branch-main';
const branchStores = new Map();
const clients = new Map();
const branchClients = new Map();

function ensureBranch(branchId = DEFAULT_BRANCH_ID) {
  if (!branchStores.has(branchId)) {
    branchStores.set(branchId, new BranchStore(branchId, dataset));
    logger.info({ branchId }, 'Created branch store from seed');
    persistBranch(branchId).catch((error) => {
      logger.warn({ err: error, branchId }, 'Failed to persist initial branch snapshot');
    });
  }
  return branchStores.get(branchId);
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
  clients.delete(client.id);
  if (client.branchId && branchClients.has(client.branchId)) {
    const set = branchClients.get(client.branchId);
    set.delete(client.id);
    if (!set.size) branchClients.delete(client.branchId);
  }
}

async function persistBranch(branchId) {
  const store = branchStores.get(branchId);
  if (!store) return;
  const payload = {
    branchId,
    version: store.version,
    snapshot: store.getSnapshot(),
    history: store.listHistory(MAX_HISTORY_RESPONSE),
    savedAt: nowIso(),
    serverId: SERVER_ID
  };
  const target = path.join(HISTORY_DIR, `${branchId}.json`);
  await writeFile(target, JSON.stringify(payload, null, 2), 'utf8');
  store.lastPersistedAt = payload.savedAt;
  logger.debug({ branchId, version: store.version, target }, 'Persisted branch state');
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

function broadcastToBranch(branchId, payload, exceptClient) {
  const set = branchClients.get(branchId);
  if (!set) return;
  for (const clientId of set) {
    const target = clients.get(clientId);
    if (!target) continue;
    if (exceptClient && target.id === exceptClient.id) continue;
    sendToClient(target, payload);
  }
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

function handleHello(client, payload) {
  const branchIdRaw = typeof payload.branchId === 'string' ? payload.branchId.trim() : '';
  const branchId = branchIdRaw || DEFAULT_BRANCH_ID;
  client.branchId = branchId;
  client.role = typeof payload.role === 'string' ? payload.role : 'unknown';
  client.status = 'ready';
  ensureBranch(branchId);
  registerClient(client);
  sendServerLog(client, 'info', 'Client registered', { branchId, role: client.role });
  if (payload.requestSnapshot !== false) {
    sendSnapshot(client, { reason: 'initial-sync', requestId: payload.requestId });
  }
  if (payload.requestHistory) {
    const limit = Math.min(Number(payload.requestHistory.limit) || 50, MAX_HISTORY_RESPONSE);
    sendHistory(client, limit, payload.requestId);
  }
}

function sendSnapshot(client, meta = {}) {
  if (!client.branchId) return;
  const store = ensureBranch(client.branchId);
  sendToClient(client, {
    type: 'server:snapshot',
    branchId: store.branchId,
    version: store.version,
    snapshot: store.getSnapshot(),
    historySize: store.history.length,
    meta: { ...meta, serverId: SERVER_ID }
  });
}

function sendHistory(client, limit = 50, requestId = null) {
  if (!client.branchId) return;
  const store = ensureBranch(client.branchId);
  sendToClient(client, {
    type: 'server:history',
    branchId: store.branchId,
    version: store.version,
    entries: store.listHistory(limit),
    meta: { requestId, limit, serverId: SERVER_ID }
  });
}

async function handlePublish(client, payload) {
  if (!client.branchId) {
    sendServerLog(client, 'error', 'Client attempted publish before hello handshake');
    return;
  }
  const store = ensureBranch(client.branchId);
  const action = payload.action || 'event';
  const requestId = typeof payload.requestId === 'string' ? payload.requestId : null;
  const meta = {
    clientId: client.id,
    role: client.role,
    requestId
  };
  let entry;
  if (action === 'replace') {
    entry = store.replaceSnapshot(payload.snapshot ?? payload.payload ?? {}, meta);
  } else if (action === 'merge') {
    entry = store.mergeSnapshot(payload.patch ?? payload.payload ?? {}, meta);
  } else if (action === 'reset') {
    entry = store.reset(meta);
  } else {
    entry = store.pushEvent(payload.payload ?? payload.event ?? {}, meta);
  }
  try {
    await persistBranch(store.branchId);
  } catch (error) {
    logger.warn({ err: error, branchId: store.branchId }, 'Failed to persist after publish');
  }
  const responseBase = {
    branchId: store.branchId,
    version: store.version,
    entry,
    meta: { serverId: SERVER_ID, requestId }
  };
  sendToClient(client, { type: 'server:ack', action, ...responseBase });
  if (action === 'replace' || action === 'merge' || action === 'reset') {
    broadcastToBranch(store.branchId, {
      type: 'server:event',
      ...responseBase,
      snapshot: store.getSnapshot(),
      action
    }, client);
  } else {
    broadcastToBranch(store.branchId, {
      type: 'server:event',
      ...responseBase,
      action
    }, client);
  }
}

function handleMessage(client, raw) {
  let payload = raw;
  if (typeof raw !== 'object' || !(raw instanceof Buffer)) {
    payload = raw;
  }
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
  switch (parsed.type) {
    case 'client:hello':
      handleHello(client, parsed);
      break;
    case 'client:request:snapshot':
      sendSnapshot(client, { reason: 'explicit-request', requestId: parsed.requestId });
      break;
    case 'client:request:history':
      sendHistory(client, Math.min(Number(parsed.limit) || 50, MAX_HISTORY_RESPONSE), parsed.requestId);
      break;
    case 'client:publish':
      handlePublish(client, parsed);
      break;
    default:
      sendServerLog(client, 'warn', 'Unknown message type', { type: parsed.type });
  }
}

const httpServer = createServer((req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  if (req.method === 'GET' && url.pathname === '/healthz') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', serverId: SERVER_ID, now: nowIso() }));
    return;
  }
  if (req.method === 'GET' && url.pathname.startsWith('/branches/')) {
    const branchId = decodeURIComponent(url.pathname.split('/')[2] || DEFAULT_BRANCH_ID);
    const store = ensureBranch(branchId);
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(store.toJSON(), null, 2));
    return;
  }
  res.writeHead(404, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ error: 'not-found', path: url.pathname }));
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
    remoteAddress: req.socket?.remoteAddress
  };
  logger.info({ clientId, address: client.remoteAddress }, 'Client connected');
  sendToClient(client, {
    type: 'server:hello',
    serverId: SERVER_ID,
    now: nowIso(),
    defaults: { branchId: DEFAULT_BRANCH_ID }
  });
  ws.on('message', (message) => handleMessage(client, message));
  ws.on('close', (code, reason) => {
    unregisterClient(client);
    logger.info({ clientId, code, reason: reason?.toString() }, 'Client disconnected');
  });
  ws.on('error', (error) => {
    logger.warn({ clientId, err: error }, 'WebSocket error');
  });
});

ensureBranch(DEFAULT_BRANCH_ID);

httpServer.listen(PORT, HOST, () => {
  logger.info({ host: HOST, port: PORT, datasetPath: DATASET_PATH }, 'Mishkah WS2 server ready');
});
