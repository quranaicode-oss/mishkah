import uWS from 'uWebSockets.js';
import jwt from 'jsonwebtoken';
import Redis from 'ioredis';
import pino from 'pino';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

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
  ALLOWED_SUBSCRIBE: z.string().default('^(app|pos|kds|ui):[a-z0-9:_-]+$'),
  ALLOWED_PUBLISH: z.string().default('^(app|pos|kds|ui):[a-z0-9:_-]+$'),
  MAX_PAYLOAD_BYTES: z.coerce.number().int().positive().default(1024 * 1024),
  MAX_BACKPRESSURE_BYTES: z.coerce.number().int().positive().default(1024 * 1024),
  IDLE_TIMEOUT_SECS: z.coerce.number().int().min(1).default(60),
  MESSAGES_PER_10S: z.coerce.number().int().min(1).default(200),
  REDIS_URL: z.string().url().default('redis://redis:6379'),
  REDIS_PREFIX: z.string().default('t:'),
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
  logLevel: parsedEnv.LOG_LEVEL,
};

const log = pino({
  level: config.logLevel,
  base: undefined,
  redact: ['req.headers.authorization', 'token'],
});

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

    handleMessage(ws, payload);
  },
  drain: () => {
    // no-op: we do not queue messages, but handler required for observability
  },
  close: (ws, code, msg) => {
    log.info({ id: ws.id, code, msg: Buffer.from(msg || '').toString() }, 'Client disconnected');
    ws.topics?.clear?.();
  },
});

function handleMessage(ws, envelope) {
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
  const user = verifyToken(token);
  if (!user) {
    sendJSON(ws, { type: 'error', code: 'auth_failed', message: 'Invalid or expired token.' });
    return;
  }
  ws.user = { id: user.sub ?? user.id ?? null, roles: user.roles ?? [], claims: user };
  sendJSON(ws, { type: 'ack', event: 'auth', user: ws.user, ts: nowTs() });
}

function publishMessage(ws, { topic, data, meta }) {
  const envelope = {
    type: 'publish',
    topic,
    data,
    meta: {
      ...(meta || {}),
      from: ws.user?.id ?? null,
      ts: nowTs(),
    },
  };
  const serialized = JSON.stringify(envelope);

  log.debug({ topic }, 'Local publish');
  app.publish(topic, serialized);

  redisPub
    .publish(`${config.redisPrefix}${topic}`, serialized)
    .catch((err) => log.error({ err, topic }, 'Failed to publish to Redis'));

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
