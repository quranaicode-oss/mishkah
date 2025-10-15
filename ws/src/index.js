import uWS from 'uWebSockets.js';
import jwt from 'jsonwebtoken';
import Redis from 'ioredis';
import pino from 'pino';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { ChatStore } from './services/chat-store.js';
import { VoiceNoteStore } from './services/voice-note-store.js';

/**
 * ------------------------------------------------------------
 * Configuration
 * ------------------------------------------------------------
 */
const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.string().default('production'),
  JWT_SECRET: z.string().min(16).optional(),
  REQUIRE_AUTH_SUBSCRIBE: z.coerce.boolean().default(true),
  REQUIRE_AUTH_PUBLISH: z.coerce.boolean().default(true),
  ALLOWED_SUBSCRIBE: z.string().default('^(app|pos|kds|ui|chat|rtc):[a-z0-9:_-]+$'),
  ALLOWED_PUBLISH: z.string().default('^(app|pos|kds|ui|chat|rtc):[a-z0-9:_-]+$'),
  MAX_PAYLOAD_BYTES: z.coerce.number().int().positive().default(1024 * 1024),
  MAX_BACKPRESSURE_BYTES: z.coerce.number().int().positive().default(1024 * 1024),
  IDLE_TIMEOUT_SECS: z.coerce.number().int().min(1).default(60),
  MESSAGES_PER_10S: z.coerce.number().int().min(1).default(200),
  REDIS_URL: z.string().url().default('redis://redis:6379'),
  REDIS_PREFIX: z.string().default('t:'),
  PG_URL: z.string().url().optional(),
  VOICE_NOTES_DIR: z.string().default('/tmp/mishkah/voice-notes'),
  API_REQUIRE_AUTH: z.coerce.boolean().default(true),
  RTC_SIGNAL_PREFIX: z.string().default('rtc:'),
  RTC_SIGNAL_TTL_SECS: z.coerce.number().int().min(5).default(120),
  LOG_LEVEL: z.string().default('info'),
  ALLOW_DEMO_GUESTS: z.coerce.boolean().default(true),
  DEMO_GUEST_TOKEN_TTL_SECS: z.coerce.number().int().min(60).max(60 * 60 * 24).default(60 * 60),
});

let parsedEnv;
try {
  parsedEnv = envSchema.parse(process.env);
} catch (err) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment configuration', err.errors ?? err);
  process.exit(1);
}

const config = {
  port: parsedEnv.PORT,
  host: parsedEnv.HOST,
  nodeEnv: parsedEnv.NODE_ENV,
  jwtSecret: parsedEnv.JWT_SECRET,
  requireAuthSub: parsedEnv.REQUIRE_AUTH_SUBSCRIBE,
  requireAuthPub: parsedEnv.REQUIRE_AUTH_PUBLISH,
  subscribeRegex: null,
  publishRegex: null,
  maxPayloadBytes: parsedEnv.MAX_PAYLOAD_BYTES,
  maxBackpressureBytes: parsedEnv.MAX_BACKPRESSURE_BYTES,
  idleTimeoutSecs: parsedEnv.IDLE_TIMEOUT_SECS,
  messagesPer10s: parsedEnv.MESSAGES_PER_10S,
  redisUrl: parsedEnv.REDIS_URL,
  redisPrefix: parsedEnv.REDIS_PREFIX,
  pgUrl: parsedEnv.PG_URL || null,
  voiceNotesDir: parsedEnv.VOICE_NOTES_DIR,
  apiRequireAuth: parsedEnv.API_REQUIRE_AUTH,
  rtcSignalPrefix: parsedEnv.RTC_SIGNAL_PREFIX,
  rtcSignalTtlSecs: parsedEnv.RTC_SIGNAL_TTL_SECS,
  logLevel: parsedEnv.LOG_LEVEL,
  allowDemoGuests: parsedEnv.ALLOW_DEMO_GUESTS,
  demoGuestTokenTtlSecs: parsedEnv.DEMO_GUEST_TOKEN_TTL_SECS,
};

const log = pino({
  level: config.logLevel,
  base: undefined,
  redact: ['req.headers.authorization', 'token'],
});

const STATUS_TEXT = {
  200: 'OK',
  201: 'Created',
  202: 'Accepted',
  204: 'No Content',
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
};

const chatStore = new ChatStore({ connectionString: config.pgUrl, log });
await chatStore.init();

const voiceNoteStore = new VoiceNoteStore({ directory: config.voiceNotesDir, log });
await voiceNoteStore.init();

const chatRooms = new Map([
  [
    'demo:lobby',
    {
      id: 'demo:lobby',
      name: 'الصالة التجريبية',
      description: 'الغرفة التجريبية العامة لعرض إمكانات الدردشة.',
      pin: '8866',
      topic: 'chat:demo:lobby',
    },
  ],
]);

const PIN_MAX_ATTEMPTS = 3;
const PIN_LOCK_DURATION_MS = 10 * 60 * 1000;
const pinAttempts = new Map();

function safeRegex(pattern, label) {
  try {
    return new RegExp(pattern);
  } catch (err) {
    log.fatal({ pattern, err }, `Invalid ${label} regex pattern`);
    process.exit(1);
  }
}

config.subscribeRegex = safeRegex(parsedEnv.ALLOWED_SUBSCRIBE, 'subscribe');
config.publishRegex = safeRegex(parsedEnv.ALLOWED_PUBLISH, 'publish');

const rtcOfferSchema = z.object({
  sdp: z.string().min(10),
  meta: z.record(z.any()).optional(),
  candidates: z.array(z.string()).optional(),
});

const rtcAnswerSchema = z.object({
  sdp: z.string().min(10),
  meta: z.record(z.any()).optional(),
  candidates: z.array(z.string()).optional(),
});

const rtcIceSchema = z.object({
  candidate: z.string().nullable().optional(),
  sdpMid: z.string().nullable().optional(),
  sdpMLineIndex: z.coerce.number().int().nullable().optional(),
  meta: z.record(z.any()).optional(),
});

const chatSendSchema = z.object({
  ciphertext: z.string().min(1),
  keyId: z.string().optional(),
  ttlSeconds: z.number().int().min(1).max(60 * 60 * 24).optional(),
  metadata: z.record(z.any()).optional(),
});

const voiceNotePayloadSchema = z.object({
  ciphertext: z.string().min(1),
  keyId: z.string().optional(),
  data: z.string().min(1),
  mimeType: z.string().optional(),
  durationMs: z.number().int().min(0).optional(),
  ttlSeconds: z.number().int().min(1).max(60 * 60 * 24).optional(),
  metadata: z.record(z.any()).optional(),
});

/**
 * ------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------
 */
function nowTs() {
  return new Date().toISOString();
}

function sendJSON(ws, payload) {
  const data = JSON.stringify(payload);
  if (ws.getBufferedAmount() > config.maxBackpressureBytes) {
    ws.end(1009, 'Backpressure limit exceeded');
    return false;
  }
  const ok = ws.send(data);
  if (!ok) {
    ws.end(1011, 'Failed to send message');
    return false;
  }
  return true;
}

function parseJSONMessage(message, isBinary) {
  if (isBinary) {
    return null;
  }
  try {
    const text = typeof message === 'string' ? message : Buffer.from(message).toString('utf8');
    return JSON.parse(text);
  } catch (err) {
    return null;
  }
}

function pinAttemptKey(roomId, clientId) {
  return `${roomId || 'unknown'}::${clientId || 'client'}`;
}

function isPinLocked(roomId, clientId) {
  const key = pinAttemptKey(roomId, clientId);
  const entry = pinAttempts.get(key);
  if (!entry) {
    return null;
  }
  const now = Date.now();
  if (entry.lockedUntil && entry.lockedUntil > now) {
    return { lockedUntil: new Date(entry.lockedUntil).toISOString() };
  }
  if (entry.lockedUntil && entry.lockedUntil <= now) {
    pinAttempts.delete(key);
  }
  return null;
}

function registerPinFailure(roomId, clientId) {
  const key = pinAttemptKey(roomId, clientId);
  const now = Date.now();
  const entry = pinAttempts.get(key) || { attempts: 0, lockedUntil: 0 };
  if (entry.lockedUntil && entry.lockedUntil <= now) {
    entry.lockedUntil = 0;
    entry.attempts = 0;
  }
  entry.attempts += 1;
  let lockedUntil = null;
  if (entry.attempts >= PIN_MAX_ATTEMPTS) {
    entry.attempts = 0;
    entry.lockedUntil = now + PIN_LOCK_DURATION_MS;
    lockedUntil = entry.lockedUntil;
  }
  pinAttempts.set(key, entry);
  return lockedUntil ? { lockedUntil: new Date(lockedUntil).toISOString() } : null;
}

function clearPinAttempts(roomId, clientId) {
  pinAttempts.delete(pinAttemptKey(roomId, clientId));
}

function sanitizeRoomForClient(room) {
  if (!room) {
    return null;
  }
  return {
    id: room.id,
    name: room.name,
    description: room.description || '',
    requiresPin: true,
    topic: room.topic,
  };
}

function getChatRoom(conversationId) {
  if (!conversationId) {
    return null;
  }
  return chatRooms.get(conversationId) || null;
}

function getClientIdentifier(res, req) {
  const headerCandidates = ['cf-connecting-ip', 'x-real-ip', 'x-forwarded-for'];
  for (const header of headerCandidates) {
    const value = req.getHeader(header);
    if (!value) {
      continue;
    }
    if (header === 'x-forwarded-for') {
      return value.split(',')[0].trim();
    }
    return value.trim();
  }
  try {
    const addressBuffer = res.getRemoteAddressAsText();
    if (addressBuffer) {
      const text = Buffer.from(addressBuffer).toString('utf8').replace(/\u0000+$/, '').trim();
      if (text) {
        return text;
      }
    }
  } catch (err) {
    log.debug({ err }, 'Failed to read remote address');
  }
  return `client:${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeToken(rawToken) {
  if (!rawToken) {
    return null;
  }
  const candidates = Array.isArray(rawToken) ? rawToken : [rawToken];
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') {
      continue;
    }
    const trimmed = candidate.trim();
    if (!trimmed) {
      continue;
    }
    if (/^bearer\s+/i.test(trimmed)) {
      const withoutPrefix = trimmed.replace(/^bearer\s+/i, '').trim();
      if (withoutPrefix) {
        return withoutPrefix;
      }
      continue;
    }
    return trimmed;
  }
  return null;
}

function extractEnvelopeToken(envelope) {
  if (!envelope || typeof envelope !== 'object') {
    return null;
  }
  const fromData = normalizeToken(envelope?.data?.token);
  if (fromData) {
    return fromData;
  }
  const fromRoot = normalizeToken(envelope.token || envelope.authToken);
  if (fromRoot) {
    return fromRoot;
  }
  return null;
}

function verifyToken(token) {
  const normalized = normalizeToken(token);
  if (!normalized) {
    return null;
  }
  if (!config.jwtSecret) {
    log.warn('Received auth attempt but JWT_SECRET is not configured');
    return null;
  }
  try {
    return jwt.verify(normalized, config.jwtSecret);
  } catch (err) {
    log.debug({ err }, 'Failed to verify JWT token');
    return null;
  }
}

const CHAT_TOPIC_REGEX = /^chat:[a-z0-9:_-]+$/;

function topicAllowed(topic, isPublish) {
  if (!topic || typeof topic !== 'string') {
    return false;
  }
  const regex = isPublish ? config.publishRegex : config.subscribeRegex;
  if (regex) {
    if (regex.global || regex.sticky) {
      regex.lastIndex = 0;
    }
    if (regex.test(topic)) {
      return true;
    }
  }
  if (CHAT_TOPIC_REGEX.test(topic)) {
    return true;
  }
  return false;
}

function rateLimitExceeded(state) {
  const now = Date.now();
  if (now >= state.resetAt) {
    state.resetAt = now + 10_000;
    state.count = 0;
  }
  state.count += 1;
  return state.count > config.messagesPer10s;
}

function applyCors(res) {
  res.writeHeader('access-control-allow-origin', '*');
  res.writeHeader('access-control-allow-headers', 'content-type,authorization');
  res.writeHeader('access-control-allow-methods', 'GET,POST,OPTIONS');
  res.writeHeader('access-control-allow-credentials', 'false');
}

function jsonResponse(res, status, payload = {}) {
  const text = STATUS_TEXT[status] || 'OK';
  res.writeStatus(`${status} ${text}`);
  applyCors(res);
  res.writeHeader('content-type', 'application/json');
  res.end(JSON.stringify(payload));
}

function errorResponse(res, status, message, extra) {
  jsonResponse(res, status, { error: true, message, ...(extra || {}) });
}

function readJsonBody(res, schema, handler) {
  let buffer = Buffer.alloc(0);
  let aborted = false;
  res.onAborted(() => {
    aborted = true;
  });
  res.onData((chunk, isLast) => {
    if (aborted) return;
    buffer = Buffer.concat([buffer, Buffer.from(chunk)]);
    if (!isLast) {
      return;
    }
    let parsed;
    try {
      parsed = buffer.length ? JSON.parse(buffer.toString('utf8')) : {};
    } catch (err) {
      errorResponse(res, 400, 'Invalid JSON payload');
      return;
    }
    let validated = parsed;
    if (schema) {
      try {
        validated = schema.parse(parsed);
      } catch (err) {
        errorResponse(res, 422, 'Payload validation failed', { issues: err.errors ?? err });
        return;
      }
    }
    Promise.resolve(handler(validated))
      .catch((err) => {
        log.error({ err }, 'HTTP handler error');
        if (!aborted) {
          errorResponse(res, 500, 'Internal server error');
        }
      });
  });
}

function handleAsync(res, handler) {
  let aborted = false;
  res.onAborted(() => {
    aborted = true;
  });
  Promise.resolve()
    .then(() => handler(() => aborted))
    .catch((err) => {
      log.error({ err }, 'HTTP handler error');
      if (!aborted) {
        errorResponse(res, 500, 'Internal server error');
      }
    });
}

function authenticateRequest(req) {
  const authHeader = req.getHeader('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  return verifyToken(token);
}

function normalizeUserClaims(claims) {
  if (!claims) return null;
  return { id: claims.sub ?? claims.id ?? null, roles: claims.roles ?? [], claims };
}

function requireHttpUser(req, res) {
  if (!config.apiRequireAuth) {
    return { id: null, roles: [], claims: null };
  }
  const claims = authenticateRequest(req);
  if (!claims) {
    errorResponse(res, 401, 'Authentication required');
    return null;
  }
  return normalizeUserClaims(claims);
}

function signalTopic(conversationId) {
  return `${config.rtcSignalPrefix}${conversationId}`;
}

function enforceRelayOnlySdp(sdp) {
  if (!sdp) return sdp;
  return sdp
    .split(/\r?\n/)
    .filter((line) => !line.startsWith('a=candidate:') || line.includes(' typ relay'))
    .join('\r\n');
}

function isRelayCandidate(candidate) {
  if (candidate == null || candidate === '') return true;
  return / typ relay( |$)/.test(candidate);
}

function filterRelayCandidates(candidates = []) {
  return candidates.filter((c) => isRelayCandidate(c));
}

function broadcastTopic(topic, data, meta = {}) {
  const envelope = {
    type: 'publish',
    topic,
    data,
    meta: { ...meta, ts: meta.ts || nowTs() },
  };
  const serialized = JSON.stringify(envelope);
  log.debug({ topic }, 'Broadcast topic');
  app.publish(topic, serialized);
  redisPub
    .publish(`${config.redisPrefix}${topic}`, serialized)
    .catch((err) => log.error({ err, topic }, 'Failed to publish to Redis'));
  return envelope;
}

async function storeAndFanOutMessage({ conversationId, senderId, ciphertext, keyId, ttlSeconds, metadata }) {
  const persisted = await chatStore.saveMessage({
    conversationId,
    senderId,
    ciphertext,
    keyId,
    ttlSeconds,
    metadata,
  });
  const payload = {
    id: persisted.id,
    conversationId,
    ciphertext,
    keyId: keyId || null,
    metadata: metadata || null,
    createdAt: persisted.createdAt,
    expiresAt: persisted.expiresAt,
  };
  broadcastTopic(`chat:${conversationId}`, payload, { from: senderId, ttlSeconds });
  return payload;
}

async function handleVoiceNote({ conversationId, senderId, ciphertext, keyId, mimeType, durationMs, ttlSeconds, metadata, data }) {
  const buffer = Buffer.from(data, 'base64');
  if (!buffer.length) {
    throw new Error('Voice note payload is empty');
  }
  const stored = await voiceNoteStore.save({
    buffer,
    mimeType: mimeType || 'audio/webm',
    conversationId,
    senderId,
    durationMs,
  });
  await chatStore.recordVoiceNote({
    voiceNoteId: stored.id,
    conversationId,
    senderId,
    storagePath: stored.path,
    mimeType: stored.mimeType,
    sizeBytes: stored.sizeBytes,
    durationMs: stored.durationMs,
  });
  const enrichedMeta = {
    ...(metadata || {}),
    voiceNote: {
      id: stored.id,
      mimeType: stored.mimeType,
      durationMs: stored.durationMs,
      sizeBytes: stored.sizeBytes,
      fileName: stored.fileName,
    },
  };
  const message = await storeAndFanOutMessage({
    conversationId,
    senderId,
    ciphertext,
    keyId,
    ttlSeconds,
    metadata: enrichedMeta,
  });
  return { voiceNote: stored, message };
}

async function processChatSend(ws, envelope) {
  let conversationId = envelope.conversationId || envelope.topic;
  if (!conversationId) {
    sendJSON(ws, { type: 'error', code: 'conversation_required', message: 'conversationId is required.' });
    return;
  }
  if (config.requireAuthPub && !ws.user) {
    sendJSON(ws, { type: 'error', code: 'unauthorized_pub', message: 'Authentication required before publishing.' });
    return;
  }
  if (typeof conversationId === 'string' && conversationId.startsWith('chat:')) {
    conversationId = conversationId.slice(5);
  }
  const allowedConversation = ws.user?.claims?.conversationId || ws.roomId || null;
  if (allowedConversation && conversationId !== allowedConversation) {
    sendJSON(ws, { type: 'error', code: 'conversation_forbidden', message: 'Not authorized for this conversation.' });
    return;
  }
  const room = getChatRoom(conversationId);
  if (!room) {
    sendJSON(ws, { type: 'error', code: 'unknown_room', message: 'Conversation is not available.' });
    return;
  }
  const parsed = chatSendSchema.safeParse(envelope.data || envelope.payload || {});
  if (!parsed.success) {
    sendJSON(ws, { type: 'error', code: 'invalid_payload', message: 'Invalid chat payload.', issues: parsed.error.issues });
    return;
  }
  try {
    const message = await storeAndFanOutMessage({
      conversationId,
      senderId: ws.user?.id ?? null,
      ciphertext: parsed.data.ciphertext,
      keyId: parsed.data.keyId,
      ttlSeconds: parsed.data.ttlSeconds,
      metadata: parsed.data.metadata,
    });
    sendJSON(ws, {
      type: 'ack',
      event: 'chat:send',
      conversationId,
      message,
      ts: nowTs(),
    });
  } catch (err) {
    log.error({ err, conversationId }, 'Failed to persist message from WS');
    sendJSON(ws, { type: 'error', code: 'chat_store_failed', message: 'Failed to store message.' });
  }
}

async function processChatHistory(ws, envelope) {
  let conversationId = envelope.conversationId || envelope.topic;
  if (!conversationId) {
    sendJSON(ws, { type: 'error', code: 'conversation_required', message: 'conversationId is required.' });
    return;
  }
  if (config.requireAuthSub && !ws.user) {
    sendJSON(ws, { type: 'error', code: 'unauthorized', message: 'Authentication required.' });
    return;
  }
  if (typeof conversationId === 'string' && conversationId.startsWith('chat:')) {
    conversationId = conversationId.slice(5);
  }
  const allowedConversation = ws.user?.claims?.conversationId || ws.roomId || null;
  if (allowedConversation && conversationId !== allowedConversation) {
    sendJSON(ws, { type: 'error', code: 'conversation_forbidden', message: 'Not authorized for this conversation.' });
    return;
  }
  const room = getChatRoom(conversationId);
  if (!room) {
    sendJSON(ws, { type: 'error', code: 'unknown_room', message: 'Conversation is not available.' });
    return;
  }
  const limitRaw = envelope.limit ?? envelope.data?.limit ?? 50;
  const beforeRaw = envelope.before ?? envelope.data?.before ?? null;
  const limit = Number.isFinite(Number(limitRaw)) ? Math.max(1, Math.min(Number(limitRaw), 200)) : 50;
  const beforeDate = beforeRaw ? new Date(beforeRaw) : null;
  try {
    const messages = await chatStore.listMessages({
      conversationId,
      limit,
      before: beforeDate && !Number.isNaN(beforeDate.getTime()) ? beforeDate : null,
    });
    sendJSON(ws, {
      type: 'chat:history',
      conversationId,
      messages,
      ts: nowTs(),
    });
  } catch (err) {
    log.error({ err, conversationId }, 'Failed to load chat history');
    sendJSON(ws, { type: 'error', code: 'chat_history_failed', message: 'Failed to load messages.' });
  }
}

/**
 * ------------------------------------------------------------
 * uWebSockets App
 * ------------------------------------------------------------
 */
const app = uWS.App();

app.options('/*', (res) => {
  res.writeStatus('204 No Content');
  applyCors(res);
  res.end();
});

/**
 * ------------------------------------------------------------
 * Redis bridge setup
 * ------------------------------------------------------------
 */
const redisPub = new Redis(config.redisUrl, {
  enableAutoPipelining: true,
  maxRetriesPerRequest: 3,
});

const redisSub = new Redis(config.redisUrl, {
  enableAutoPipelining: true,
  maxRetriesPerRequest: 3,
});

redisSub.on('error', (err) => log.error({ err }, 'Redis subscriber error'));
redisPub.on('error', (err) => log.error({ err }, 'Redis publisher error'));
redisSub.on('connect', () => log.info('Connected to Redis (subscriber)'));
redisPub.on('connect', () => log.info('Connected to Redis (publisher)'));

redisSub.psubscribe(`${config.redisPrefix}*`, (err, count) => {
  if (err) {
    log.error({ err }, 'Failed to psubscribe to Redis channel');
  } else {
    log.info({ count }, 'Subscribed to Redis pattern channels');
  }
});

redisSub.on('pmessage', (_pattern, channel, rawMessage) => {
  const topic = channel.slice(config.redisPrefix.length);
  if (!topic) {
    return;
  }
  let parsed;
  try {
    parsed = JSON.parse(rawMessage);
  } catch (err) {
    log.warn({ err }, 'Failed to parse message from Redis');
    return;
  }
  if (!parsed || parsed.type !== 'publish' || parsed.topic !== topic) {
    return;
  }
  log.debug({ topic }, 'Redis -> Local publish');
  app.publish(topic, rawMessage);
});

app.get('/healthz', (res) => {
  res.writeStatus('200 OK');
  res.writeHeader('content-type', 'application/json');
  res.end(JSON.stringify({ status: 'ok', now: nowTs() }));
});

app.get('/api/chat/rooms', (res, req) => {
  handleAsync(res, async (isAborted) => {
    const rooms = Array.from(chatRooms.values()).map(sanitizeRoomForClient).filter(Boolean);
    if (!isAborted()) {
      jsonResponse(res, 200, { rooms });
    }
  });
});

app.post('/api/rtc/:conversationId/offer', (res, req) => {
  const conversationId = req.getParameter(0);
  if (!conversationId) {
    errorResponse(res, 400, 'Conversation id is required');
    return;
  }
  const user = requireHttpUser(req, res);
  if (!user) return;
  readJsonBody(res, rtcOfferSchema, async (body) => {
    try {
      const sanitizedSdp = enforceRelayOnlySdp(body.sdp);
      const candidates = filterRelayCandidates(body.candidates || []);
      broadcastTopic(
        signalTopic(conversationId),
        { kind: 'offer', sdp: sanitizedSdp, candidates },
        { ...(body.meta || {}), from: user.id, ttlSeconds: config.rtcSignalTtlSecs },
      );
      jsonResponse(res, 202, { status: 'accepted' });
    } catch (err) {
      log.error({ err, conversationId }, 'Failed to handle RTC offer');
      errorResponse(res, 500, 'Failed to handle offer');
    }
  });
});

app.post('/api/rtc/:conversationId/answer', (res, req) => {
  const conversationId = req.getParameter(0);
  if (!conversationId) {
    errorResponse(res, 400, 'Conversation id is required');
    return;
  }
  const user = requireHttpUser(req, res);
  if (!user) return;
  readJsonBody(res, rtcAnswerSchema, async (body) => {
    try {
      const sanitizedSdp = enforceRelayOnlySdp(body.sdp);
      const candidates = filterRelayCandidates(body.candidates || []);
      broadcastTopic(
        signalTopic(conversationId),
        { kind: 'answer', sdp: sanitizedSdp, candidates },
        { ...(body.meta || {}), from: user.id, ttlSeconds: config.rtcSignalTtlSecs },
      );
      jsonResponse(res, 202, { status: 'accepted' });
    } catch (err) {
      log.error({ err, conversationId }, 'Failed to handle RTC answer');
      errorResponse(res, 500, 'Failed to handle answer');
    }
  });
});

app.post('/api/rtc/:conversationId/ice', (res, req) => {
  const conversationId = req.getParameter(0);
  if (!conversationId) {
    errorResponse(res, 400, 'Conversation id is required');
    return;
  }
  const user = requireHttpUser(req, res);
  if (!user) return;
  readJsonBody(res, rtcIceSchema, async (body) => {
    try {
      if (body.candidate && !isRelayCandidate(body.candidate)) {
        errorResponse(res, 422, 'Only relay ICE candidates are permitted');
        return;
      }
      broadcastTopic(
        signalTopic(conversationId),
        {
          kind: 'ice',
          candidate: body.candidate ?? null,
          sdpMid: body.sdpMid ?? null,
          sdpMLineIndex: body.sdpMLineIndex ?? null,
        },
        { ...(body.meta || {}), from: user.id, ttlSeconds: config.rtcSignalTtlSecs },
      );
      jsonResponse(res, 202, { status: 'accepted' });
    } catch (err) {
      log.error({ err, conversationId }, 'Failed to handle ICE candidate');
      errorResponse(res, 500, 'Failed to handle candidate');
    }
  });
});

app.get('/api/conversations/:conversationId/messages', (res, req) => {
  const conversationId = req.getParameter(0);
  if (!conversationId) {
    errorResponse(res, 400, 'Conversation id is required');
    return;
  }
  const user = requireHttpUser(req, res);
  if (!user) return;
  handleAsync(res, async (isAborted) => {
    const limitParam = parseInt(req.getQuery('limit') || '50', 10);
    const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(limitParam, 200)) : 50;
    const beforeRaw = req.getQuery('before') || null;
    const before = beforeRaw ? new Date(beforeRaw) : null;
    const messages = await chatStore.listMessages({
      conversationId,
      limit,
      before: before && !Number.isNaN(before.getTime()) ? before : null,
    });
    if (!isAborted()) {
      jsonResponse(res, 200, { messages });
    }
  });
});

app.post('/api/conversations/:conversationId/messages', (res, req) => {
  const conversationId = req.getParameter(0);
  if (!conversationId) {
    errorResponse(res, 400, 'Conversation id is required');
    return;
  }
  const user = requireHttpUser(req, res);
  if (!user) return;
  readJsonBody(res, chatSendSchema, async (body) => {
    try {
      const message = await storeAndFanOutMessage({
        conversationId,
        senderId: user.id,
        ciphertext: body.ciphertext,
        keyId: body.keyId,
        ttlSeconds: body.ttlSeconds,
        metadata: body.metadata,
      });
      jsonResponse(res, 201, { message });
    } catch (err) {
      log.error({ err, conversationId }, 'Failed to persist message');
      errorResponse(res, 500, 'Failed to store message');
    }
  });
});

app.post('/api/conversations/:conversationId/voice-notes', (res, req) => {
  const conversationId = req.getParameter(0);
  if (!conversationId) {
    errorResponse(res, 400, 'Conversation id is required');
    return;
  }
  const user = requireHttpUser(req, res);
  if (!user) return;
  readJsonBody(res, voiceNotePayloadSchema, async (body) => {
    try {
      const result = await handleVoiceNote({
        conversationId,
        senderId: user.id,
        ciphertext: body.ciphertext,
        keyId: body.keyId,
        mimeType: body.mimeType,
        durationMs: body.durationMs,
        ttlSeconds: body.ttlSeconds,
        metadata: body.metadata,
        data: body.data,
      });
      jsonResponse(res, 201, result);
    } catch (err) {
      log.error({ err, conversationId }, 'Failed to process voice note');
      errorResponse(res, 500, 'Failed to process voice note');
    }
  });
});

const demoGuestRequestSchema = z.object({
  conversationId: z.string().trim().min(3).regex(/^demo:[a-z0-9:_-]+$/i, 'Demo conversation must start with "demo:"'),
  pin: z.string().trim().min(4).max(32),
  name: z.string().trim().min(1).max(64).optional(),
  expiresInSeconds: z.number().int().min(60).max(60 * 60 * 24).optional(),
});

app.post('/api/demo/guest-token', (res, req) => {
  if (!config.allowDemoGuests) {
    errorResponse(res, 403, 'Guest token issuance is disabled');
    return;
  }
  if (!config.jwtSecret) {
    errorResponse(res, 500, 'JWT secret is not configured');
    return;
  }
  const clientId = getClientIdentifier(res, req);
  readJsonBody(res, demoGuestRequestSchema, async (body) => {
    try {
      const room = getChatRoom(body.conversationId);
      if (!room) {
        errorResponse(res, 404, 'Conversation is not available');
        return;
      }
      const locked = isPinLocked(room.id, clientId);
      if (locked) {
        errorResponse(res, 429, 'PIN attempts temporarily locked', {
          code: 'pin_locked',
          lockedUntil: locked.lockedUntil,
        });
        return;
      }
      if (!body.pin || body.pin.trim() !== room.pin) {
        const lockInfo = registerPinFailure(room.id, clientId);
        if (lockInfo) {
          errorResponse(res, 429, 'PIN attempts temporarily locked', {
            code: 'pin_locked',
            lockedUntil: lockInfo.lockedUntil,
          });
        } else {
          errorResponse(res, 403, 'Invalid PIN code for this room', {
            code: 'pin_invalid',
          });
        }
        return;
      }
      clearPinAttempts(room.id, clientId);
      const guestId = `guest-${randomUUID()}`;
      const displayName = body.name?.trim() || guestId;
      const ttl = body.expiresInSeconds
        ? Math.min(body.expiresInSeconds, config.demoGuestTokenTtlSecs)
        : config.demoGuestTokenTtlSecs;
      const issuedAt = Math.floor(Date.now() / 1000);
      const token = jwt.sign(
        {
          sub: guestId,
          roles: ['guest'],
          demo: true,
          conversationId: body.conversationId,
          name: displayName,
          iat: issuedAt,
        },
        config.jwtSecret,
        { expiresIn: ttl },
      );
      jsonResponse(res, 201, {
        token,
        expiresIn: ttl,
        user: { id: guestId, name: displayName, roles: ['guest'] },
        room: sanitizeRoomForClient(room),
      });
    } catch (err) {
      log.error({ err }, 'Failed to issue demo guest token');
      errorResponse(res, 500, 'Failed to issue demo guest token');
    }
  });
});

app.ws('/*', {
  compression: uWS.DEDICATED_COMPRESSOR_256KB,
  maxPayloadLength: config.maxPayloadBytes,
  idleTimeout: config.idleTimeoutSecs,
  maxBackpressure: config.maxBackpressureBytes,
  upgrade: (res, req, context) => {
    const queryToken = normalizeToken(req.getQuery('token'));
    const protocolHeader = req.getHeader('sec-websocket-protocol');
    const protocolToken = protocolHeader
      ? normalizeToken(
        protocolHeader
          .split(',')
          .map((part) => part.trim())
          .filter(Boolean),
      )
      : null;
    const headerAuth = normalizeToken(req.getHeader('authorization'));
    const token = queryToken || protocolToken || headerAuth || null;
    res.upgrade(
      { token },
      req.getHeader('sec-websocket-key'),
      req.getHeader('sec-websocket-protocol'),
      req.getHeader('sec-websocket-extensions'),
      context,
    );
  },
  open: (ws) => {
    ws.id = randomUUID();
    ws.user = null;
    ws.roomId = null;
    ws.topics = new Set();
    ws.rate = { count: 0, resetAt: Date.now() + 10_000 };
    log.info({ id: ws.id }, 'Client connected');

    const initialToken = ws.token;
    if (initialToken) {
      handleAuth(ws, { type: 'auth', data: { token: initialToken } });
    } else {
      sendJSON(ws, { type: 'hello', id: ws.id, ts: nowTs() });
    }
  },
  message: (ws, message, isBinary) => {
    if (rateLimitExceeded(ws.rate)) {
      log.warn({ id: ws.id }, 'Rate limit exceeded');
      sendJSON(ws, { type: 'error', code: 'rate_limited', message: 'Too many messages, please slow down.' });
      return;
    }

    const payload = parseJSONMessage(message, isBinary);
    if (!payload || typeof payload !== 'object') {
      sendJSON(ws, { type: 'error', code: 'invalid_json', message: 'Message must be valid JSON.' });
      return;
    }

    try {
      const maybePromise = handleMessage(ws, payload);
      if (maybePromise && typeof maybePromise.then === 'function') {
        maybePromise.catch((err) => {
          log.error({ err }, 'Async handler failed');
          sendJSON(ws, { type: 'error', code: 'internal_error', message: 'Internal error processing message.' });
        });
      }
    } catch (err) {
      log.error({ err }, 'Failed to handle message');
      sendJSON(ws, { type: 'error', code: 'internal_error', message: 'Internal error processing message.' });
    }
  },
  drain: () => {
    // no-op: we do not queue messages, but handler required for observability
  },
  close: (ws, code, msg) => {
    log.info({ id: ws.id, code, msg: Buffer.from(msg || '').toString() }, 'Client disconnected');
    ws.topics?.clear?.();
    ws.roomId = null;
  },
});

async function handleMessage(ws, envelope) {
  const { type, topic, data, meta } = envelope;

  if (!type || typeof type !== 'string') {
    sendJSON(ws, { type: 'error', code: 'type_required', message: 'Message requires a type field.' });
    return;
  }

  switch (type) {
    case 'ping':
      sendJSON(ws, { type: 'pong', ts: nowTs() });
      break;

    case 'hello':
      // Mishkah clients send an initial hello frame when opening a connection.
      // Treat it as a no-op handshake hint instead of surfacing an error.
      log.debug({ id: ws.id }, 'Received hello frame from client');
      break;

    case 'auth':
      handleAuth(ws, envelope);
      break;

    case 'chat:send':
      await processChatSend(ws, envelope);
      break;

    case 'chat:history':
      await processChatHistory(ws, envelope);
      break;

    case 'subscribe':
    case 'unsubscribe':
      if (!topic) {
        sendJSON(ws, { type: 'error', code: 'topic_required', message: 'Topic is required.' });
        return;
      }
      if (type === 'subscribe') {
        if (config.requireAuthSub && !ws.user) {
          sendJSON(ws, { type: 'error', code: 'unauthorized_sub', message: 'Authentication required before subscribing.' });
          return;
        }
        if (!topicAllowed(topic, false)) {
          sendJSON(ws, { type: 'error', code: 'topic_not_allowed', message: 'Topic is not allowed for subscription.' });
          return;
        }
        const allowedConversation = ws.user?.claims?.conversationId || ws.roomId || null;
        if (allowedConversation && topic.startsWith('chat:')) {
          const requested = topic.slice(5);
          if (requested !== allowedConversation) {
            sendJSON(ws, { type: 'error', code: 'conversation_forbidden', message: 'Not authorized for this conversation.' });
            return;
          }
        }
        ws.subscribe(topic);
        ws.topics.add(topic);
        sendJSON(ws, { type: 'ack', event: 'subscribe', topic, ts: nowTs() });
      } else {
        ws.unsubscribe(topic);
        ws.topics.delete(topic);
        sendJSON(ws, { type: 'ack', event: 'unsubscribe', topic, ts: nowTs() });
      }
      break;

    case 'publish':
      if (config.requireAuthPub && !ws.user) {
        sendJSON(ws, { type: 'error', code: 'unauthorized_pub', message: 'Authentication required before publishing.' });
        return;
      }
      if (!topic || !topicAllowed(topic, true)) {
        sendJSON(ws, { type: 'error', code: 'topic_not_allowed', message: 'Topic is not allowed for publishing.' });
        return;
      }
      const allowedConversation = ws.user?.claims?.conversationId || ws.roomId || null;
      if (allowedConversation && topic.startsWith('chat:')) {
        const requested = topic.slice(5);
        if (requested !== allowedConversation) {
          sendJSON(ws, { type: 'error', code: 'conversation_forbidden', message: 'Not authorized for this conversation.' });
          return;
        }
      }
      if (typeof data === 'undefined') {
        sendJSON(ws, { type: 'error', code: 'data_required', message: 'Publish messages require a data field.' });
        return;
      }
      publishMessage(ws, { topic, data, meta });
      break;

    default:
      sendJSON(ws, { type: 'error', code: 'unknown_type', message: `Unknown message type: ${type}` });
  }
}

function handleAuth(ws, envelope) {
  const token = extractEnvelopeToken(envelope);
  if (!token) {
    sendJSON(ws, { type: 'error', code: 'token_required', message: 'Authentication token is required.' });
    return;
  }
  const claims = verifyToken(token);
  if (!claims) {
    sendJSON(ws, { type: 'error', code: 'auth_failed', message: 'Invalid or expired token.' });
    return;
  }
  const room = getChatRoom(claims.conversationId);
  if (!room) {
    sendJSON(ws, { type: 'error', code: 'unknown_room', message: 'Conversation is not available.' });
    return;
  }
  ws.user = normalizeUserClaims(claims);
  ws.roomId = room.id;
  sendJSON(ws, { type: 'ack', event: 'auth', user: ws.user, ts: nowTs() });
}

function publishMessage(ws, { topic, data, meta }) {
  broadcastTopic(topic, data, { ...(meta || {}), from: ws.user?.id ?? null });
  sendJSON(ws, { type: 'ack', event: 'publish', topic, ts: nowTs() });
}

/**
 * ------------------------------------------------------------
 * Startup & graceful shutdown
 * ------------------------------------------------------------
 */
let listenSocket = null;

app.listen(config.host, config.port, (token) => {
  if (token) {
    listenSocket = token;
    log.info({ host: config.host, port: config.port }, 'WS Gateway listening');
  } else {
    log.error('Failed to bind to port');
    process.exit(1);
  }
});

function shutdown(signal) {
  log.info({ signal }, 'Shutting down gracefully');
  try {
    if (listenSocket) {
      uWS.us_listen_socket_close(listenSocket);
      listenSocket = null;
    }
  } catch (err) {
    log.warn({ err }, 'Failed to close listen socket');
  }
  redisSub.quit().catch((err) => log.error({ err }, 'Error quitting Redis subscriber'));
  redisPub.quit().catch((err) => log.error({ err }, 'Error quitting Redis publisher'));
  chatStore.close().catch((err) => log.error({ err }, 'Error closing chat store'));
  setTimeout(() => process.exit(0), 500).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('uncaughtException', (err) => {
  log.error({ err }, 'Uncaught exception, shutting down');
  shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  log.error({ err: reason }, 'Unhandled rejection, shutting down');
  shutdown('unhandledRejection');
});

