(function bootstrapWs2(global){
  if (!global) return;
  const watchers = new Set();
  const config = global.POS_WS2_CONFIG || {};
  const endpoint = config.endpoint || global.POS_WS2_ENDPOINT || 'ws://ws.mas.com.eg';
  const branchId = config.branchId || (global.database && global.database.settings && global.database.settings.sync && global.database.settings.sync.branch_id) || 'branch-main';
  const role = config.role || 'pos-app';
  const reconnectDelay = typeof config.reconnectDelay === 'number' ? Math.max(config.reconnectDelay, 500) : 3000;
  const historyLimit = typeof config.historyLimit === 'number' ? config.historyLimit : 25;

  let socket = null;
  let reconnectTimer = null;
  let attempts = 0;
  let latestSnapshot = null;
  let readyResolve;
  let readyReject;
  let readySettled = false;
  const sendQueue = [];
  const readyPromise = new Promise((resolve, reject)=>{
    readyResolve = resolve;
    readyReject = reject;
  });

  const connectionState = {
    endpoint,
    branchId,
    connected: false,
    attempts: 0,
    lastError: null,
    lastEvent: null
  };

  const structured = typeof structuredClone === 'function' ? structuredClone : null;

  function clone(value){
    if (value === null || typeof value !== 'object') return value;
    if (structured) {
      try { return structured(value); } catch (_err){}
    }
    try { return JSON.parse(JSON.stringify(value)); } catch (_err){}
    if (Array.isArray(value)) return value.map(clone);
    const result = {};
    for (const key of Object.keys(value)) result[key] = clone(value[key]);
    return result;
  }

  function merge(base, patch){
    if (patch === undefined) return clone(base);
    if (patch === null || typeof patch !== 'object') return clone(patch);
    if (Array.isArray(patch)) return patch.map(clone);
    const baseObj = base && typeof base === 'object' && !Array.isArray(base) ? base : {};
    const result = {};
    for (const key of Object.keys(baseObj)) result[key] = clone(baseObj[key]);
    for (const key of Object.keys(patch)){
      const value = patch[key];
      if (value && typeof value === 'object' && !Array.isArray(value)){
        result[key] = merge(baseObj[key], value);
      } else if (Array.isArray(value)){
        result[key] = value.map(clone);
      } else {
        result[key] = clone(value);
      }
    }
    return result;
  }

  function extractOverlay(source){
    if (!source || typeof source !== 'object') return {};
    const overlay = {};
    if (source.settings && typeof source.settings === 'object'){
      overlay.settings = overlay.settings || {};
      if (source.settings.sync && typeof source.settings.sync === 'object'){
        overlay.settings.sync = merge({}, source.settings.sync);
      }
      if (source.settings.pos && typeof source.settings.pos === 'object'){
        overlay.settings.pos = merge({}, source.settings.pos);
      }
    }
    return overlay;
  }

  function createRequestId(){
    return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  const logPrefix = '[Mishkah][WS2]';
  function log(level, message, data){
    const fn = typeof console[level] === 'function' ? level : 'log';
    console[fn](`${logPrefix} ${message}`, data || '');
  }

  function getConnectionState(){
    return {
      ...connectionState,
      readyState: socket ? socket.readyState : global.WebSocket ? global.WebSocket.CLOSED : -1
    };
  }

  function emit(event){
    const payload = { ...event, ts: Date.now(), connection: getConnectionState() };
    watchers.forEach((fn)=>{
      try { fn(payload); } catch (error){ console.error(`${logPrefix} subscriber error`, error); }
    });
  }

  function applySnapshot(snapshot, meta){
    const overlay = extractOverlay(global.database);
    latestSnapshot = merge(snapshot || {}, overlay);
    global.database = latestSnapshot;
    global.__MISHKAH_POS_LAST_SNAPSHOT__ = clone(latestSnapshot);
    if (!readySettled){
      readySettled = true;
      readyResolve(latestSnapshot);
    }
    emit({ type:'snapshot', snapshot: clone(latestSnapshot), meta });
  }

  function flushQueue(){
    if (!socket || socket.readyState !== socket.OPEN) return;
    while (sendQueue.length){
      const frame = sendQueue.shift();
      socket.send(frame);
    }
  }

  function scheduleReconnect(){
    if (reconnectTimer) return;
    reconnectTimer = global.setTimeout(()=>{
      reconnectTimer = null;
      connect();
    }, reconnectDelay);
  }

  function handleMessage(raw){
    let data = raw?.data ?? raw;
    if (data instanceof ArrayBuffer) data = new TextDecoder().decode(data);
    if (ArrayBuffer.isView(data)) data = new TextDecoder().decode(data);
    if (typeof data !== 'string'){
      log('warn', 'Received non-text frame', data);
      return;
    }
    let parsed;
    try { parsed = JSON.parse(data); }
    catch (error){
      log('warn', 'Failed to parse message', { error: error.message, preview: data.slice(0, 80) });
      return;
    }
    switch (parsed.type){
      case 'server:hello':
        emit({ type:'server:hello', info: parsed });
        break;
      case 'server:snapshot':{
        const meta = {
          ...(parsed.meta || {}),
          branchId: parsed.branchId,
          version: parsed.version,
          historySize: parsed.historySize
        };
        applySnapshot(parsed.snapshot || {}, meta);
        break;
      }
      case 'server:event':{
        const meta = { ...(parsed.meta || {}), branchId: parsed.branchId, version: parsed.version };
        emit({ type:'event', entry: parsed.entry, action: parsed.action, meta, snapshot: parsed.snapshot });
        if (parsed.snapshot){
          applySnapshot(parsed.snapshot, { reason:'event', action: parsed.action, entryId: parsed.entry?.id, ...meta });
        }
        break;
      }
      case 'server:history':
        emit({ type:'history', entries: parsed.entries || [], meta: parsed.meta });
        break;
      case 'server:ack':
        emit({ type:'ack', action: parsed.action, entry: parsed.entry, meta: parsed.meta });
        break;
      case 'server:log':
        log(parsed.level || 'info', parsed.message || 'Server log', parsed.context || {});
        emit({ type:'log', level: parsed.level, message: parsed.message, context: parsed.context });
        break;
      default:
        emit({ type:'unknown', payload: parsed });
    }
  }

  function connect(){
    if (!global.WebSocket){
      const error = new Error('WebSocket API unavailable in this environment');
      if (!readySettled){ readySettled = true; readyReject(error); }
      log('error', error.message);
      return;
    }
    if (socket && (socket.readyState === socket.OPEN || socket.readyState === socket.CONNECTING)) return;
    attempts += 1;
    connectionState.attempts = attempts;
    connectionState.connected = false;
    connectionState.lastError = null;
    connectionState.lastEvent = null;
    socket = new global.WebSocket(endpoint);
    socket.addEventListener('open', ()=>{
      connectionState.connected = true;
      emit({ type:'connection:open' });
      const helloFrame = {
        type:'client:hello',
        branchId,
        role,
        requestSnapshot: true,
        requestHistory: historyLimit ? { limit: historyLimit } : undefined
      };
      socket.send(JSON.stringify(helloFrame));
      flushQueue();
    });
    socket.addEventListener('message', handleMessage);
    socket.addEventListener('close', (event)=>{
      connectionState.connected = false;
      connectionState.lastEvent = { code: event.code, reason: event.reason };
      emit({ type:'connection:close', event });
      scheduleReconnect();
    });
    socket.addEventListener('error', (error)=>{
      connectionState.lastError = error;
      emit({ type:'connection:error', error });
      log('warn', 'WebSocket error', { message: error?.message });
    });
  }

  function enqueue(message){
    const encoded = typeof message === 'string' ? message : JSON.stringify(message);
    if (socket && socket.readyState === socket.OPEN){
      socket.send(encoded);
    } else {
      sendQueue.push(encoded);
    }
    return typeof message === 'object' && message && message.requestId ? message.requestId : null;
  }

  function publish(payload, options = {}){
    const frame = {
      type:'client:publish',
      branchId,
      action: options.action || 'event',
      payload,
      snapshot: options.snapshot,
      patch: options.patch,
      requestId: options.requestId || createRequestId()
    };
    return enqueue(frame) || frame.requestId;
  }

  function requestHistory(limit = historyLimit){
    const frame = {
      type:'client:request:history',
      branchId,
      limit,
      requestId: createRequestId()
    };
    return enqueue(frame) || frame.requestId;
  }

  function subscribe(handler){
    if (typeof handler !== 'function') return ()=>{};
    watchers.add(handler);
    if (latestSnapshot){
      handler({ type:'snapshot', snapshot: clone(latestSnapshot), meta:{ reason:'subscribe' }, ts: Date.now(), connection: getConnectionState() });
    }
    return ()=> watchers.delete(handler);
  }

  function getSnapshot(){
    return latestSnapshot ? clone(latestSnapshot) : null;
  }

  global.database = global.database && typeof global.database === 'object' ? global.database : {};

  const api = {
    ready: readyPromise,
    whenReady: () => readyPromise,
    subscribe,
    publish,
    requestHistory,
    getSnapshot,
    getConnectionState: () => ({ ...getConnectionState() })
  };

  Object.defineProperty(api, 'endpoint', { value: endpoint });
  Object.defineProperty(api, 'branchId', { value: branchId });

  global.__MISHKAH_POS_DATA_SOURCE__ = api;
  connect();
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
