import uWS from 'uWebSockets.js';
if (type === 'auth') {
const token = (data && data.token) || null;
const user = verifyToken(token);
if (!user) return sendJSON(ws, { type:'error', code:'auth_failed' });
ws.user = user;
return sendJSON(ws, { type:'ack', event:'auth', user:{ id:user.sub, roles:user.roles }, ts: nowTs() });
}


if ((type === 'subscribe' || type === 'unsubscribe') && !topic) {
return sendJSON(ws, { type:'error', code:'topic_required' });
}


if (type === 'subscribe') {
if (cfg.requireAuthSub && !ws.user) return sendJSON(ws, { type:'error', code:'unauthorized_sub' });
if (!topicAllowed(topic, false)) return sendJSON(ws, { type:'error', code:'topic_not_allowed' });


// استخدم pub/sub المدمج في uWS محليًا
ws.subscribe(topic);
ws.topics.add(topic);
return sendJSON(ws, { type:'ack', event:'subscribe', topic, ts: nowTs() });
}


if (type === 'unsubscribe') {
ws.unsubscribe(topic);
ws.topics.delete(topic);
return sendJSON(ws, { type:'ack', event:'unsubscribe', topic, ts: nowTs() });
}


if (type === 'publish') {
if (cfg.requireAuthPub && !ws.user) return sendJSON(ws, { type:'error', code:'unauthorized_pub' });
if (!topic || !topicAllowed(topic, true)) return sendJSON(ws, { type:'error', code:'topic_not_allowed' });


const envelope = JSON.stringify({ type:'publish', topic, data, env, meta:{ ...(meta||{}), ts: nowTs() } });


// انشر محليًا فورًا لخفض زمن الاستجابة
app.publish(topic, envelope);
// وانشر عبر Redis لتعبر للنسخ الأخرى
redisPub.publish(cfg.redisPrefix + topic, envelope).catch(()=>{});
return sendJSON(ws, { type:'ack', event:'publish', topic, ts: nowTs() });
}


// فلو غير معروف
sendJSON(ws, { type:'error', code:'unknown_type' });
},


drain: (ws) => {
flushQueue(ws);
},


close: (ws, code, msg) => {
// تنظيف بسيط
ws.topics?.clear?.();
}
});


// بدء الاستماع
let listenSocket = null;
app.listen(cfg.port, (token) => {
if (token) {
listenSocket = token;
log.info({ port: cfg.port }, 'WS Gateway listening');
} else {
log.error('Failed to listen');
process.exit(1);
}
});


// إيقاف سلس
function shutdown() {
log.info('Shutting down...');
try { uWS.us_listen_socket_close(listenSocket); } catch {}
try { redisSub.quit(); } catch {}
try { redisPub.quit(); } catch {}
setTimeout(() => process.exit(0), 500).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
