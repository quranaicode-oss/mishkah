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

function verifyToken(token) {
  if (!token) {
    return null;
  }
  if (!config.jwtSecret) {
    log.warn('Received auth attempt but JWT_SECRET is not configured');
    return null;
  }
  try {
    return jwt.verify(token, config.jwtSecret);
  } catch (err) {
    log.debug({ err }, 'Failed to verify JWT token');
    return null;
  }
}

function topicAllowed(topic, isPublish) {
  return (isPublish ? config.publishRegex : config.subscribeRegex).test(topic);
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

function jsonResponse(res, status, payload = {}) {
  const text = STATUS_TEXT[status] || 'OK';
  res.writeStatus(`${status} ${text}`);
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
  const conversationId = envelope.conversationId || envelope.topic;
  if (!conversationId) {
    sendJSON(ws, { type: 'error', code: 'conversation_required', message: 'conversationId is required.' });
    return;
  }
  if (config.requireAuthPub && !ws.user) {
    sendJSON(ws, { type: 'error', code: 'unauthorized_pub', message: 'Authentication required before publishing.' });
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
  const conversationId = envelope.conversationId || envelope.topic;
  if (!conversationId) {
    sendJSON(ws, { type: 'error', code: 'conversation_required', message: 'conversationId is required.' });
    return;
  }
  if (config.requireAuthSub && !ws.user) {
    sendJSON(ws, { type: 'error', code: 'unauthorized', message: 'Authentication required.' });
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

app.ws('/*', {
  compression: uWS.DEDICATED_COMPRESSOR_256KB,
  maxPayloadLength: config.maxPayloadBytes,
  idleTimeout: config.idleTimeoutSecs,
  maxBackpressure: config.maxBackpressureBytes,
  upgrade: (res, req, context) => {
    const token = req.getQuery('token') || req.getHeader('sec-websocket-protocol') || null;
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
  const token = envelope?.data?.token;
  if (!token) {
    sendJSON(ws, { type: 'error', code: 'token_required', message: 'Authentication token is required.' });
    return;
  }
  const claims = verifyToken(token);
  if (!claims) {
    sendJSON(ws, { type: 'error', code: 'auth_failed', message: 'Invalid or expired token.' });
    return;
  }
  ws.user = normalizeUserClaims(claims);
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

