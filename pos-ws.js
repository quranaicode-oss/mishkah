(function(global){
  global.MishkahPOSChunks = global.MishkahPOSChunks || {};
  global.MishkahPOSChunks.ws = function(scope){
    if(!scope || typeof scope !== 'object') return;
    with(scope){
          const ensureRequestId = typeof scope.createRequestId === 'function'
            ? scope.createRequestId
            : ()=> `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
          function createKDSSync(options={}){
            const WebSocketX = U.WebSocketX || U.WebSocket;
            const endpoint = options.endpoint;
            if(!WebSocketX){
              console.warn('[Mishkah][POS][KDS] WebSocket adapter is unavailable; disabling sync.');
            }
            if(!endpoint){
              console.warn('[Mishkah][POS][KDS] No KDS endpoint configured; sync bridge is inactive.');
            }
            const requestedChannel = options.channel ? normalizeChannelName(options.channel, BRANCH_CHANNEL) : '';
            const localEmitter = typeof options.localEmitter === 'function'
              ? options.localEmitter
              : (options.localChannel ? (message)=>{
                  if(!options.localChannel || typeof options.localChannel.postMessage !== 'function') return;
                  try { options.localChannel.postMessage({ origin:'pos', ...message }); } catch(_err){}
                }
                : ()=>{});
            const pushLocal = (type, data={}, metaOverride={})=>{
              if(typeof localEmitter !== 'function') return;
              const baseMeta = {
                channel: requestedChannel || BRANCH_CHANNEL,
                via:'pos:local',
                publishedAt: new Date().toISOString()
              };
              const meta = { ...baseMeta, ...metaOverride };
              try { localEmitter({ type, ...data, meta }); } catch(_err){}
            };
            if(!WebSocketX || !endpoint){
              return {
                connect:()=>{},
                publishOrder(orderPayload, state){
                  const envelope = buildOrderEnvelope(orderPayload, state);
                  if(!envelope) return null;
                  pushLocal('orders:payload', { payload: envelope.payload }, { channel: envelope.channel, publishedAt: envelope.publishedAt });
                  return envelope.payload;
                },
                publishJobUpdate(update){
                  if(!update || !update.jobId) return;
                  pushLocal('job:update', { jobId: update.jobId, payload: update.payload || {} }, typeof update.meta === 'object' ? update.meta : {});
                },
                publishDeliveryUpdate(update){
                  if(!update || !update.orderId) return;
                  pushLocal('delivery:update', { orderId: update.orderId, payload: update.payload || {} }, typeof update.meta === 'object' ? update.meta : {});
                },
                publishHandoffUpdate(update){
                  if(!update || !update.orderId) return;
                  pushLocal('handoff:update', { orderId: update.orderId, payload: update.payload || {} }, typeof update.meta === 'object' ? update.meta : {});
                }
              };
            }
            const channelName = requestedChannel;
            const topicPrefix = channelName ? `${channelName}:` : '';
            const topicOrders = options.topicOrders || `${topicPrefix}pos:kds:orders`;
            const topicJobs = options.topicJobs || `${topicPrefix}kds:jobs:updates`;
            const topicDelivery = options.topicDelivery || `${topicPrefix}kds:delivery:updates`;
            const topicHandoff = options.topicHandoff || `${topicPrefix}kds:handoff:updates`;
            const handlers = options.handlers || {};
            const token = options.token;
            let socket = null;
            let ready = false;
            let awaitingAuth = false;
            const queue = [];
            const sendEnvelope = (payload)=>{
              if(!socket) return;
              if(ready && !awaitingAuth){
                socket.send(payload);
              } else {
                queue.push(payload);
              }
            };
            const flushQueue = ()=>{
              if(!ready || awaitingAuth) return;
              while(queue.length){ socket.send(queue.shift()); }
            };
            socket = new WebSocketX(endpoint, {
              autoReconnect:true,
              ping:{ interval:15000, timeout:7000, send:{ type:'ping' }, expect:'pong' }
            });
            socket.on('open', ()=>{
              ready = true;
              if(token){
                awaitingAuth = true;
                socket.send({ type:'auth', data:{ token } });
              } else {
                socket.send({ type:'subscribe', topic: topicOrders });
                socket.send({ type:'subscribe', topic: topicJobs });
                socket.send({ type:'subscribe', topic: topicDelivery });
                socket.send({ type:'subscribe', topic: topicHandoff });
                flushQueue();
              }
            });
            socket.on('close', (event)=>{
              ready = false;
              awaitingAuth = false;
              console.warn('[Mishkah][POS][KDS] Sync connection closed.', { code: event?.code, reason: event?.reason });
            });
            socket.on('error', (error)=>{
              ready = false;
              console.error('[Mishkah][POS][KDS] Sync connection error.', error);
            });
            socket.on('message', (msg)=>{
              if(!msg || typeof msg !== 'object') return;
              if(msg.type === 'ack'){
                if(msg.event === 'auth'){
                  awaitingAuth = false;
                  socket.send({ type:'subscribe', topic: topicOrders });
                  socket.send({ type:'subscribe', topic: topicJobs });
                  socket.send({ type:'subscribe', topic: topicDelivery });
                  socket.send({ type:'subscribe', topic: topicHandoff });
                  flushQueue();
                } else if(msg.event === 'subscribe'){
                  flushQueue();
                }
                return;
              }
              if(msg.type === 'publish'){
                const meta = msg.meta || {};
                if(msg.topic === topicOrders && typeof handlers.onOrders === 'function'){
                  try { handlers.onOrders(msg.data || {}, meta); } catch(handlerErr){ console.warn('[Mishkah][POS][KDS] onOrders handler failed.', handlerErr); }
                }
                if(msg.topic === topicJobs && typeof handlers.onJobUpdate === 'function'){
                  try { handlers.onJobUpdate(msg.data || {}, meta); } catch(handlerErr){ console.warn('[Mishkah][POS][KDS] onJobUpdate handler failed.', handlerErr); }
                }
                if(msg.topic === topicDelivery && typeof handlers.onDeliveryUpdate === 'function'){
                  try { handlers.onDeliveryUpdate(msg.data || {}, meta); } catch(handlerErr){ console.warn('[Mishkah][POS][KDS] onDeliveryUpdate handler failed.', handlerErr); }
                }
                if(msg.topic === topicHandoff && typeof handlers.onHandoffUpdate === 'function'){
                  try { handlers.onHandoffUpdate(msg.data || {}, meta); } catch(handlerErr){ console.warn('[Mishkah][POS][KDS] onHandoffUpdate handler failed.', handlerErr); }
                }
                return;
              }
            });
            const connect = ()=>{ try { socket.connect({ waitOpen:false }); } catch(_err){} };
            return {
              connect,
              publishOrder(orderPayload, state){
                const envelope = buildOrderEnvelope(orderPayload, state);
                if(!envelope){
                  console.warn('[Mishkah][POS][KDS] Skipped publishing order payload — serialization failed.', { orderId: orderPayload?.id });
                  return null;
                }
                sendEnvelope({ type:'publish', topic: topicOrders, data: envelope.payload });
                pushLocal('orders:payload', { payload: envelope.payload }, { channel: envelope.channel, publishedAt: envelope.publishedAt });
                return envelope.payload;
              },
              publishJobUpdate(update){
                if(!update || !update.jobId){
                  console.warn('[Mishkah][POS][KDS] Ignored job update with missing jobId.', update);
                  return;
                }
                sendEnvelope({ type:'publish', topic: topicJobs, data: update });
                pushLocal('job:update', { jobId: update.jobId, payload: update.payload || {} }, typeof update.meta === 'object' ? update.meta : {});
              },
              publishDeliveryUpdate(update){
                if(!update || !update.orderId){
                  console.warn('[Mishkah][POS][KDS] Ignored delivery update with missing orderId.', update);
                  return;
                }
                sendEnvelope({ type:'publish', topic: topicDelivery, data: update });
                pushLocal('delivery:update', { orderId: update.orderId, payload: update.payload || {} }, typeof update.meta === 'object' ? update.meta : {});
              },
              publishHandoffUpdate(update){
                if(!update || !update.orderId){
                  console.warn('[Mishkah][POS][KDS] Ignored handoff update with missing orderId.', update);
                  return;
                }
                sendEnvelope({ type:'publish', topic: topicHandoff, data: update });
                pushLocal('handoff:update', { orderId: update.orderId, payload: update.payload || {} }, typeof update.meta === 'object' ? update.meta : {});
              }
            };
          }
      
      
        function createCentralPosSync(options={}){
          const adapter = options.adapter;
          if(!adapter || typeof adapter.exportSnapshot !== 'function' || typeof adapter.importSnapshot !== 'function'){
            console.warn('[Mishkah][POS] Central sync requires an adapter with snapshot support.');
            if(typeof options.onDiagnostic === 'function'){
              try {
                options.onDiagnostic({
                  event:'config:disable',
                  level:'error',
                  message:'Central sync adapter missing snapshot helpers.',
                  data:{ reason:'adapter-missing' },
                  status:{ state:'disabled', endpoint:null }
                });
              } catch(_err){}
            }
            return {
              async ensureInitialSync(){ return false; },
              connect(){},
              async run(_label, _meta, executor){ return typeof executor === 'function' ? executor() : null; },
              async destroy(){ const err = new Error('Central sync unavailable'); err.code = 'POS_SYNC_UNAVAILABLE'; throw err; },
              isOnline(){ return false; },
              getStatus(){ return { state:'disabled', version:0 }; }
            };
          }
          const WebSocketX = U.WebSocketX || U.WebSocket;
          const branch = options.branch ? normalizeChannelName(options.branch, BRANCH_CHANNEL) : BRANCH_CHANNEL;
          const topic = `pos:sync:${branch}`;
          const httpBase = options.httpEndpoint || null;
          const httpEndpoint = (()=>{
            if(!httpBase) return null;
            if(/\/modules\//.test(httpBase)) return httpBase;
            if(httpBase.includes(':branch')) return httpBase.replace(':branch', branch);
            if(httpBase.includes('{branch}')) return httpBase.replace('{branch}', branch);
            return httpBase.endsWith(branch) ? httpBase : `${httpBase.replace(/\/$/, '')}/${branch}`;
          })();
          const resolvedHttpEndpoint = (()=>{
            const normalized = normalizeEndpointString(httpEndpoint);
            if(!normalized) return null;
            if(isSameOriginEndpoint(normalized)) return normalized;
            if(typeof globalThis !== 'undefined' && globalThis.location){
              try { return new URL(normalized, globalThis.location.origin).toString(); } catch(_err){ return normalized; }
            }
            return normalized;
          })();
          let activeHttpEndpoint = resolvedHttpEndpoint;
          const wsEndpoint = options.wsEndpoint;
          const token = options.token || null;
          const authOff = ensureBoolean(options.authOff, false);
          const clientId = options.clientId || `${options.posId || 'pos'}-${Math.random().toString(36).slice(2, 10)}`;
          const headers = token ? { authorization:`Bearer ${token}` } : {};
          const userId = (()=>{
            if(typeof options.userId === 'string' && options.userId.trim()) return options.userId.trim();
            if(typeof globalThis !== 'undefined'){
              if(globalThis.POS_WS2_IDENTIFIERS && typeof globalThis.POS_WS2_IDENTIFIERS.userId === 'string' && globalThis.POS_WS2_IDENTIFIERS.userId.trim()){
                return globalThis.POS_WS2_IDENTIFIERS.userId.trim();
              }
              if(typeof globalThis.UserUniid === 'string' && globalThis.UserUniid.trim()){
                return globalThis.UserUniid.trim();
              }
            }
            return null;
          })();
          const requireOnline = options.requireOnline !== false;
          const allowLocalFallback = options.allowLocalFallback === true;
          const onDiagnostic = typeof options.onDiagnostic === 'function' ? options.onDiagnostic : null;
          let socket = null;
          let ready = false;
          let awaitingAuth = false;
          let online = false;
          let disabled = !activeHttpEndpoint && !wsEndpoint;
          let disableReason = disabled ? 'Central sync disabled by configuration.' : null;
          let initialSyncComplete = false;
          let initialSyncPromise = null;
          let version = 0;
          let queue = Promise.resolve();
          const pendingFrames = [];
          const pendingMutations = new Map();
          const mode = requireOnline ? (allowLocalFallback ? 'hybrid' : 'central-only') : 'permissive';
          let status = {
            state: disabled ? 'disabled' : (wsEndpoint && WebSocketX ? 'offline' : 'disabled'),
            version: 0,
            updatedAt: null,
            endpoint: wsEndpoint || null,
            httpEndpoint: activeHttpEndpoint,
            lastError: disableReason,
            mode,
            requireOnline,
            allowLocalFallback,
            authOff
          };
      
          const serializeError = (err)=>{
            if(!err) return null;
            const message = err.message || String(err);
            const code = err.code || err.name || null;
            const stack = typeof err.stack === 'string' ? err.stack.split('\n').slice(0, 4).join('\n') : null;
            return { message, code, stack };
          };
      
          const snapshotStatus = ()=>({
            ready,
            awaitingAuth,
            online,
            disabled,
            version,
            endpoint: wsEndpoint || null,
            httpEndpoint: activeHttpEndpoint,
            queueSize: pendingFrames.length,
            pendingMutations: pendingMutations.size,
            requireOnline,
            allowLocalFallback,
            mode,
            authOff
          });
      
          const emitDiagnostic = (event, info={})=>{
            if(!onDiagnostic) return;
            const level = info.level || 'info';
            const message = info.message || '';
            const data = info.data || {};
            const error = info.error ? serializeError(info.error) : null;
            const payload = {
              event,
              level,
              message,
              data: error ? { ...data, error } : data,
              status: snapshotStatus()
            };
            try { onDiagnostic(payload); } catch(handlerErr){ console.warn('[Mishkah][POS] Central diagnostics handler failed', handlerErr); }
          };
      
          emitDiagnostic('config:init', {
            data:{ branch, httpEndpoint: activeHttpEndpoint, wsEndpoint, hasToken: !!token, requireOnline, allowLocalFallback, authOff }
          });
      
          const createSyncError = (code, message)=>{
            const err = new Error(message || code || 'POS sync error');
            err.code = code || 'POS_SYNC_ERROR';
            return err;
          };
      
          const emitStatus = (patch={})=>{
            const previous = { ...status };
            const mergedPatch = patch && typeof patch === 'object'
              ? (patch.httpEndpoint === undefined ? { ...patch, httpEndpoint: activeHttpEndpoint } : { ...patch })
              : { httpEndpoint: activeHttpEndpoint };
            status = { ...status, ...mergedPatch };
            if(patch && (patch.state && patch.state !== previous.state)){
              const stateLevel = status.state === 'online'
                ? 'info'
                : status.state === 'syncing' ? 'debug'
                  : status.state === 'offline' ? 'warn' : 'warn';
              emitDiagnostic('sync:status', {
                level: stateLevel,
                message: `State → ${status.state}`,
                data:{ previous, current: status }
              });
            } else if(patch && patch.lastError && patch.lastError !== previous.lastError){
              emitDiagnostic('sync:status', {
                level:'error',
                message: patch.lastError,
                data:{ previous, current: status }
              });
            }
            if(typeof options.onStatus === 'function'){
              try { options.onStatus({ ...status }); } catch(handlerError){ console.warn('[Mishkah][POS] Central sync status handler failed', handlerError); }
            }
          };
      
          const flushFrames = ()=>{
            if(disabled || !socket || !ready || awaitingAuth) return;
            const flushed = pendingFrames.length;
            while(pendingFrames.length){
              try { socket.send(pendingFrames.shift()); } catch(sendErr){ console.warn('[Mishkah][POS] Central sync send failed', sendErr); break; }
            }
            if(flushed){
              emitDiagnostic('sync:queue:flush', {
                level:'debug',
                message:`Flushed ${flushed} frame(s)`,
                data:{ count: flushed }
              });
            }
          };
      
          const sendFrame = (frame)=>{
            if(disabled){
              return false;
            }
            if(!socket){
              pendingFrames.push(frame);
              return false;
            }
            if(ready && !awaitingAuth){
              try { socket.send(frame); return true; } catch(sendErr){ console.warn('[Mishkah][POS] Central sync immediate send failed', sendErr); }
            }
            pendingFrames.push(frame);
            return false;
          };
      
          const rejectPending = (err)=>{
            const entries = Array.from(pendingMutations.values());
            pendingMutations.clear();
            entries.forEach(entry=>{ try { entry.reject(err); } catch(_rejectErr){} });
          };
      
          const disableSync = (reason, extra={})=>{
            if(disabled) return;
            disabled = true;
            disableReason = reason || 'Central sync disabled.';
            awaitingAuth = false;
            ready = false;
            online = false;
            if(socket && typeof socket.close === 'function'){
              try { socket.close(1000, 'disabled'); } catch(_closeErr){}
            }
            socket = null;
            rejectPending(createSyncError('POS_SYNC_DISABLED', disableReason));
            emitDiagnostic('sync:disable', {
              level:'warn',
              message: disableReason,
              data:{ reason: disableReason, ...extra }
            });
            emitStatus({ state:'disabled', endpoint:null, lastError: disableReason, ...extra });
          };
      
          const waitForAck = (mutationId, timeoutMs=15000)=> new Promise((resolve, reject)=>{
            const timer = setTimeout(()=>{
              pendingMutations.delete(mutationId);
              emitDiagnostic('mutation:timeout', {
                level:'error',
                message:`Mutation ${mutationId} timed out`,
                data:{ mutationId, timeoutMs }
              });
              reject(createSyncError('POS_SYNC_TIMEOUT', 'Timed out waiting for central sync confirmation.'));
            }, timeoutMs);
            pendingMutations.set(mutationId, {
              resolve:(info)=>{ clearTimeout(timer); resolve(info); },
              reject:(err)=>{ clearTimeout(timer); reject(err); }
            });
          });
      
          const deriveHttpFallbackEndpoints = (endpoint)=>{
            const result = [];
            const normalized = normalizeEndpointString(endpoint);
            if(!normalized) return result;
            const trimmed = normalized.replace(/\/$/, '');
            if(!trimmed) return result;
            const addCandidate = (candidate)=>{
              if(!candidate) return;
              if(!result.includes(candidate)) result.push(candidate);
            };
            if(trimmed.endsWith('/events')){
              const base = trimmed.replace(/\/events$/, '');
              addCandidate(base);
              addCandidate(`${base}/snapshot`);
            }
            return result;
          };
      
          const fetchSnapshot = async ()=>{
            if(disabled){
              return { snapshot:null, version, disabled:true };
            }
            if(typeof fetch !== 'function'){
              throw createSyncError('POS_SYNC_UNSUPPORTED', 'Fetch API is not available in this environment.');
            }
            if(!activeHttpEndpoint){
              emitDiagnostic('config:disable', {
                level:'warn',
                message:'Central sync HTTP endpoint unavailable.',
                data:{ endpoint:null, reason:'http-missing' }
              });
              disableSync('Central sync HTTP endpoint unavailable.');
              return { snapshot:null, version, disabled:true };
            }
            const httpCandidates = [activeHttpEndpoint, ...deriveHttpFallbackEndpoints(activeHttpEndpoint)];
            let response = null;
            let httpStatus = null;
            let lastEndpoint = activeHttpEndpoint;
      
            for(let attempt = 0; attempt < httpCandidates.length; attempt += 1){
              const endpointCandidate = normalizeEndpointString(httpCandidates[attempt]);
              if(!endpointCandidate) continue;
              lastEndpoint = endpointCandidate;
              activeHttpEndpoint = endpointCandidate;
              emitDiagnostic('http:fetch:start', {
                level:'debug',
                message:'Fetching central snapshot via HTTP.',
                data:{ endpoint: endpointCandidate, attempt: attempt + 1 }
              });
              try{
                response = await fetch(endpointCandidate, { headers });
              } catch(fetchError){
                emitDiagnostic('http:fetch:error', {
                  level:'error',
                  message:'HTTP fetch failed.',
                  data:{ endpoint: endpointCandidate, attempt: attempt + 1 },
                  error: fetchError
                });
                if(attempt === httpCandidates.length - 1){
                  throw fetchError;
                }
                continue;
              }
              const statusNumber = Number(response.status);
              httpStatus = Number.isFinite(statusNumber) ? statusNumber : response.status;
              if((httpStatus === 404 || httpStatus === 405 || httpStatus === 410) && attempt < httpCandidates.length - 1){
                emitDiagnostic('http:fetch:fallback', {
                  level:'warn',
                  message:`Central sync endpoint unavailable (HTTP ${httpStatus}) — retrying with fallback endpoint.`,
                  data:{ endpoint: endpointCandidate, httpStatus, next: httpCandidates[attempt + 1] || null }
                });
                continue;
              }
              break;
            }
      
            if(!response){
              throw createSyncError('POS_SYNC_HTTP', 'Unable to fetch central snapshot.');
            }
      
            const statusNumber = Number(response.status);
            httpStatus = Number.isFinite(statusNumber) ? statusNumber : response.status;
            if(httpStatus === 401 || httpStatus === 403){
              emitDiagnostic('http:fetch:unauthorized', {
                level: authOff ? 'warn' : 'error',
                message: authOff
                  ? `Central sync responded with HTTP ${httpStatus}, but auth bypass is active.`
                  : `Central sync rejected token (HTTP ${httpStatus}).`,
                data:{ endpoint: lastEndpoint, httpStatus, authOff }
              });
              if(authOff){
                return { snapshot:null, version, disabled:false, httpStatus, authOff:true };
              }
              if(requireOnline && !allowLocalFallback){
                disableSync(`Central sync requires authentication (HTTP ${httpStatus}).`, { httpStatus });
                throw createSyncError('POS_SYNC_UNAUTHORIZED', `Central sync requires authentication (HTTP ${httpStatus}).`);
              }
              return { snapshot:null, version, disabled:true, httpStatus };
            }
            if(httpStatus === 404 || httpStatus === 405 || httpStatus === 410){
              const offlineMessage = `Central sync endpoint unavailable (HTTP ${httpStatus}).`;
              const offlineData = { endpoint: lastEndpoint, httpStatus };
              emitDiagnostic(requireOnline && !allowLocalFallback ? 'config:disable' : 'http:fetch:fallback', {
                level:'warn',
                message: offlineMessage,
                data:{ ...offlineData, allowLocalFallback }
              });
              if(requireOnline && !allowLocalFallback){
                disableSync(offlineMessage, { httpStatus });
                return { snapshot:null, version, disabled:true, httpStatus };
              }
              emitStatus({ state:'offline', lastError: offlineMessage, httpStatus });
              return {
                snapshot:null,
                version,
                disabled:false,
                httpStatus,
                offline:true,
                reason: offlineMessage
              };
            }
            if(!response.ok){
              emitDiagnostic('http:fetch:error', {
                level:'error',
                message:`HTTP ${httpStatus}`,
                data:{ endpoint: lastEndpoint, httpStatus }
              });
              throw createSyncError('POS_SYNC_HTTP', `HTTP ${httpStatus}`);
            }
            const body = await response.json();
            emitDiagnostic('http:fetch:success', {
              level:'debug',
              message:'Central snapshot fetched successfully.',
              data:{ endpoint: lastEndpoint, httpStatus, version: body?.version ?? null, hasSnapshot: !!body?.snapshot }
            });
            if(body && typeof body === 'object' && !body.snapshot){
              const remotePayload = extractRemotePayload(body);
              if(remotePayload && typeof remotePayload === 'object'){
                return { snapshot: remotePayload, version: body.version ?? version, branchId: body.branchId || branch, moduleId: body.moduleId || 'pos' };
              }
            }
            return body;
          };
      
          const ensureInitialSync = async ()=>{
            if(initialSyncComplete) return disabled ? false : true;
            if(!initialSyncPromise){
              initialSyncPromise = (async()=>{
                if(disabled){
                  initialSyncComplete = true;
                  emitStatus({ state:'disabled', endpoint:null, lastError: disableReason });
                  return false;
                }
                emitDiagnostic('sync:initial:start', {
                  level:'debug',
                  message:'Initial HTTP snapshot sync started.'
                });
                emitStatus({ state:'syncing' });
                const remote = await fetchSnapshot();
                if(remote && remote.disabled){
                  initialSyncComplete = true;
                  emitStatus({ state:'disabled', endpoint:null, lastError: disableReason });
                  emitDiagnostic('sync:initial:error', {
                    level:'warn',
                    message:'Initial sync disabled by configuration.',
                    data:{ reason:'remote-disabled' }
                  });
                  if(requireOnline && !allowLocalFallback){
                    throw createSyncError('POS_SYNC_DISABLED', disableReason || 'Central sync disabled.');
                  }
                  return false;
                }
                if(remote && remote.offline){
                  emitDiagnostic('sync:initial:fallback', {
                    level:'warn',
                    message: remote.reason || 'Central sync offline — continuing in local mode.',
                    data:{ reason:'http-offline', httpStatus: remote.httpStatus || null }
                  });
                }
                if(remote && remote.snapshot){
                  try {
                    await adapter.importSnapshot(remote.snapshot);
                  } catch(importErr){
                    console.warn('[Mishkah][POS] Failed to import central snapshot', importErr);
                    emitDiagnostic('sync:initial:error', {
                      level:'warn',
                      message:'Failed to apply initial snapshot.',
                      data:{ reason:'import-error' },
                      error: importErr
                    });
                  }
                  version = Number(remote.version || 0) || 0;
                  emitStatus({ version, updatedAt: remote.updatedAt || Date.now() });
                }
                initialSyncComplete = true;
                emitStatus({ state: online ? 'online' : (status.state === 'disabled' ? 'disabled' : 'offline') });
                emitDiagnostic('sync:initial:success', {
                  level:'info',
                  message:'Initial sync completed.',
                  data:{ version }
                });
                return true;
              })().catch(err=>{
                if(disabled || err?.code === 'POS_SYNC_DISABLED'){
                  initialSyncComplete = true;
                  emitStatus({ state:'disabled', endpoint:null, lastError: disableReason || err?.message });
                  return false;
                }
                const fallbackPermitted = allowLocalFallback || !requireOnline;
                const errorMessage = err?.message || String(err);
                if(fallbackPermitted){
                  initialSyncComplete = true;
                  emitDiagnostic('sync:initial:fallback', {
                    level:'warn',
                    message: errorMessage || 'Initial sync failed — falling back to local mode.',
                    data:{ reason:'http-error' },
                    error: err
                  });
                  emitStatus({ state:'offline', lastError: errorMessage });
                  return false;
                }
                emitDiagnostic('sync:initial:error', {
                  level:'error',
                  message: errorMessage || 'Initial sync failed.',
                  error: err
                });
                emitStatus({ state:'offline', lastError: errorMessage });
                throw err;
              });
            }
            return initialSyncPromise;
          };
      
          const handlePublish = async (payload={})=>{
            if(payload.version != null){
              const numeric = Number(payload.version);
              if(Number.isFinite(numeric)) version = numeric;
            }
            if(payload.snapshot && typeof adapter.importSnapshot === 'function'){
              try { await adapter.importSnapshot(payload.snapshot); } catch(importErr){ console.warn('[Mishkah][POS] Failed to apply central snapshot', importErr); }
            }
            online = true;
            initialSyncComplete = true;
            const syncTs = Date.now();
            emitStatus({ state:'online', version, updatedAt: syncTs, lastSync: syncTs, cleared: !!payload.cleared });
            emitDiagnostic('ws:message', {
              level:'debug',
              message:`Publish ${payload.action || 'snapshot'} received.`,
              data:{ action: payload.action || 'snapshot', mutationId: payload.mutationId || null, cleared: !!payload.cleared, version }
            });
            if(payload.order && posDB && typeof posDB.saveOrder === 'function'){
              const normalizedOrder = {
                ...cloneDeep(payload.order),
                isPersisted:true,
                dirty:false,
                updatedAt: payload.order.updatedAt || syncTs,
                savedAt: payload.order.savedAt || syncTs
              };
              try{
                await posDB.saveOrder(normalizedOrder, { mirror:true, origin:'central-sync' });
                if(typeof posDB.markSync === 'function') await posDB.markSync();
                await refreshPersistentSnapshot({ focusCurrent:false, syncOrders:true }).catch((err)=>{
                  console.warn('[Mishkah][POS] Failed to refresh snapshot after central order', err);
                });
                emitDiagnostic('sync:order:merge', {
                  level:'info',
                  message:'Central order applied from server.',
                  data:{ orderId: normalizedOrder.id, existing: !!payload.existing }
                });
              } catch(orderErr){
                console.warn('[Mishkah][POS] Failed to persist central order', orderErr);
                emitDiagnostic('sync:order:error', {
                  level:'error',
                  message: orderErr?.message || 'Failed to persist central order.',
                  error: orderErr,
                  data:{ orderId: payload.order?.id || null }
                });
              }
            }
            if(payload.mutationId && pendingMutations.has(payload.mutationId)){
              const entry = pendingMutations.get(payload.mutationId);
              pendingMutations.delete(payload.mutationId);
              const ackInfo = {
                version,
                mutationId: payload.mutationId,
                action: payload.action || null,
                order: payload.order || null,
                existing: !!payload.existing,
                meta: payload.meta || {}
              };
              try { entry.resolve(ackInfo); } catch(_resolveErr){}
              emitDiagnostic('mutation:ack', {
                level:'info',
                message:`Mutation ${payload.mutationId} acknowledged.`,
                data:{ mutationId: payload.mutationId, version, orderId: payload.order?.id || null, existing: !!payload.existing }
              });
            }
          };
      
          const pushSnapshot = async (reason, meta={})=>{
            if(disabled){
              return (typeof adapter.exportSnapshot === 'function') ? adapter.exportSnapshot() : null;
            }
            if(!socket || !ready || awaitingAuth){
              throw createSyncError('POS_SYNC_OFFLINE', 'Central sync offline.');
            }
            const snapshot = await adapter.exportSnapshot();
            const mutationId = `${clientId}-${Date.now().toString(36)}-${Math.random().toString(16).slice(2,8)}`;
            const summary = snapshot && typeof snapshot === 'object'
              ? Object.keys(snapshot).slice(0, 6)
              : [];
            sendFrame({
              type:'publish',
              topic,
              data:{
                action:'snapshot',
                baseVersion: version,
                snapshot,
                reason: reason || meta.reason || 'update',
                clientId,
                mutationId,
                userId: userId || null,
                trans_id: mutationId
              }
            });
            emitDiagnostic('mutation:publish', {
              level:'info',
              message:`Snapshot publish queued (${reason || meta.reason || 'update'}).`,
              data:{ reason: reason || meta.reason || 'update', mutationId, snapshotKeys: summary }
            });
            return waitForAck(mutationId, options.timeout || 15000);
          };
      
          const publishCreateOrder = async (order, extras={})=>{
            if(!order || !order.id){
              throw createSyncError('POS_SYNC_INVALID', 'Order payload requires an id.');
            }
            const synced = await ensureInitialSync();
            if(disabled || synced === false){
              if(allowLocalFallback){
                emitDiagnostic('sync:fallback', {
                  level:'warn',
                  message:'Central sync disabled during order publish — continuing locally.',
                  data:{ reason:'order-create-disabled', orderId: order.id }
                });
                return null;
              }
              throw createSyncError('POS_SYNC_DISABLED', disableReason || 'Central sync disabled.');
            }
            if(!socket || !ready || awaitingAuth){
              if(allowLocalFallback){
                emitDiagnostic('sync:fallback', {
                  level:'warn',
                  message:'Central sync offline during order publish — continuing locally.',
                  data:{ reason:'order-create-offline', orderId: order.id }
                });
                return null;
              }
              throw createSyncError('POS_SYNC_OFFLINE', 'Central sync offline.');
            }
            const mutationId = extras.mutationId || `${clientId}-${Date.now().toString(36)}-${Math.random().toString(16).slice(2,8)}`;
            const transSource = extras.transId || order.trans_id || order.transId || mutationId;
            const transId = (typeof transSource === 'string' && transSource.trim())
              ? transSource.trim()
              : String(transSource || mutationId);
            const frame = {
              type:'publish',
              topic,
              data:{
                action:'create-order',
                order: cloneDeep(order),
                kdsPayload: extras.kdsPayload ? cloneDeep(extras.kdsPayload) : undefined,
                meta: extras.meta ? cloneDeep(extras.meta) : undefined,
                mutationId,
                requestId: extras.requestId || ensureRequestId(),
                userId: userId || null,
                trans_id: transId
              }
            };
            sendFrame(frame);
            emitDiagnostic('mutation:publish', {
              level:'info',
              message:'Create-order publish queued.',
              data:{ mutationId, orderId: order.id }
            });
            const ack = await waitForAck(mutationId, extras.timeout || options.timeout || 15000);
            return ack;
          };
      
          const pushDestroy = async (reason)=>{
            if(disabled){
              return true;
            }
            if(!socket || !ready || awaitingAuth){
              throw createSyncError('POS_SYNC_OFFLINE', 'Central sync offline.');
            }
            const mutationId = `${clientId}-destroy-${Date.now().toString(36)}`;
            sendFrame({
              type:'publish',
              topic,
              data:{ action:'destroy', reason: reason || 'reset', clientId, mutationId, userId: userId || null, trans_id: mutationId }
            });
            emitDiagnostic('mutation:publish', {
              level:'warn',
              message:`Destroy command queued (${reason || 'reset'}).`,
              data:{ reason: reason || 'reset', mutationId }
            });
            return waitForAck(mutationId, options.timeout || 15000);
          };
      
          const connect = ()=>{
            if(disabled){
              emitDiagnostic('connect:skipped', {
                level:'warn',
                message:'Central sync disabled — skipping WebSocket connect.',
                data:{ reason: disableReason }
              });
              emitStatus({ state:'disabled', endpoint:null, lastError: disableReason || 'Central sync disabled.' });
              return;
            }
            if(!WebSocketX || !wsEndpoint){
              emitDiagnostic('connect:skipped', {
                level:'warn',
                message:'WebSocket adapter unavailable.',
                data:{ endpoint: wsEndpoint, hasAdapter: !!WebSocketX }
              });
              emitStatus({ state:'offline', lastError:'WebSocket unavailable' });
              return;
            }
            if(socket) return;
            emitDiagnostic('connect:start', {
              level:'debug',
              message:'Opening central sync WebSocket.',
              data:{ endpoint: wsEndpoint }
            });
            socket = new WebSocketX(wsEndpoint, {
              autoReconnect:true,
              ping:{ interval:15000, timeout:7000, send:{ type:'ping' }, expect:'pong' }
            });
            socket.on('open', ()=>{
              ready = true;
              online = true;
              emitStatus({ state: initialSyncComplete ? 'online' : 'syncing', endpoint: wsEndpoint });
              emitDiagnostic('ws:open', {
                level:'info',
                message:'Central sync WebSocket connected.',
                data:{ endpoint: wsEndpoint }
              });
              if(token){
                awaitingAuth = true;
                socket.send({ type:'auth', data:{ token, userId: userId || null } });
                emitDiagnostic('ws:auth:sent', {
                  level:'debug',
                  message:'Auth token sent to central sync.',
                  data:{ endpoint: wsEndpoint }
                });
              } else if(authOff){
                emitDiagnostic('ws:auth:bypass', {
                  level:'info',
                  message:'Auth bypass active; skipping token handshake.',
                  data:{ endpoint: wsEndpoint }
                });
                socket.send({ type:'subscribe', topic });
                emitDiagnostic('ws:subscribe', {
                  level:'debug',
                  message:'Subscribed to central sync topic.',
                  data:{ topic }
                });
                flushFrames();
              } else {
                emitDiagnostic('ws:auth:missing', {
                  level: requireOnline ? 'error' : 'warn',
                  message:'No auth token configured for central sync.',
                  data:{ endpoint: wsEndpoint }
                });
                if(requireOnline && !allowLocalFallback){
                  disableSync('Central sync token missing.');
                  return;
                }
                socket.send({ type:'subscribe', topic });
                emitDiagnostic('ws:subscribe', {
                  level:'debug',
                  message:'Subscribed to central sync topic.',
                  data:{ topic }
                });
                flushFrames();
              }
            });
            socket.on('close', (event)=>{
              ready = false;
              awaitingAuth = false;
              online = false;
              emitStatus({ state: status.state === 'disabled' ? 'disabled' : 'offline', lastError: event?.reason || null });
              emitDiagnostic('ws:close', {
                level: event?.code === 1000 ? 'info' : 'warn',
                message:`WebSocket closed (code ${event?.code || 'unknown'})`,
                data:{ code: event?.code || null, reason: event?.reason || null }
              });
              rejectPending(createSyncError('POS_SYNC_OFFLINE', 'Central sync disconnected.'));
            });
            socket.on('error', (error)=>{
              ready = false;
              online = false;
              emitStatus({ state:'offline', lastError: error?.message || String(error) });
              emitDiagnostic('ws:error', {
                level:'error',
                message: error?.message || 'WebSocket error.',
                error
              });
              rejectPending(createSyncError('POS_SYNC_ERROR', 'Central sync transport error.'));
            });
            socket.on('message', (msg)=>{
              if(!msg || typeof msg !== 'object') return;
              if(msg.type === 'ack'){
                if(msg.event === 'auth'){
                  awaitingAuth = false;
                  socket.send({ type:'subscribe', topic });
                  emitDiagnostic('ws:auth:ack', {
                    level:'info',
                    message:'Central sync authentication acknowledged.'
                  });
                  emitDiagnostic('ws:subscribe', {
                    level:'debug',
                    message:'Subscribed to central sync topic after auth.',
                    data:{ topic }
                  });
                  flushFrames();
                } else if(msg.event === 'subscribe'){
                  emitDiagnostic('ws:subscribe', {
                    level:'debug',
                    message:'Subscription acknowledged.',
                    data:{ topic: msg.topic || topic }
                  });
                  flushFrames();
                }
                return;
              }
              if(msg.type === 'error'){
                emitDiagnostic('ws:error:frame', {
                  level:'error',
                  message: msg.message || 'Central sync error frame received.',
                  data:{ code: msg.code || null, topic: msg.topic || topic, branch: msg.branch || null }
                });
                if(msg.code === 'pos_sync_branch_forbidden' && requireOnline && !allowLocalFallback){
                  disableSync('Central sync token not authorized for branch.', { branch: msg.branch || null });
                }
                return;
              }
              if(msg.type === 'publish' && msg.topic === topic){
                handlePublish(msg.data || {});
              }
            });
            try { socket.connect({ waitOpen:false }); } catch(_err){}
          };
      
          const run = (label, meta={}, executor)=>{
            if(typeof executor !== 'function') return Promise.resolve(null);
            const task = async ()=>{
              const synced = await ensureInitialSync();
              if(disabled){
                if(allowLocalFallback){
                  return executor();
                }
                throw createSyncError('POS_SYNC_DISABLED', disableReason || 'Central sync disabled.');
              }
              if(synced === false){
                if(allowLocalFallback){
                  return executor();
                }
                throw createSyncError('POS_SYNC_OFFLINE', 'Central sync offline.');
              }
              if(!socket || !ready || awaitingAuth || !online){
                if(allowLocalFallback){
                  const offlineMessage = 'Central sync offline.';
                  online = false;
                  emitDiagnostic('sync:fallback', {
                    level:'warn',
                    message: offlineMessage,
                    data:{ reason:'ws-offline', label, meta }
                  });
                  emitStatus({ state:'offline', lastError: offlineMessage });
                  try {
                    return await executor();
                  } catch(execErr){
                    emitStatus({ state:'offline', lastError: execErr?.message || String(execErr) });
                    throw execErr;
                  }
                }
                throw createSyncError('POS_SYNC_OFFLINE', 'Central sync offline.');
              }
              emitStatus({ state:'syncing' });
              let result;
              try {
                result = await executor();
              } catch(execErr){
                emitStatus({ state: online ? 'online' : 'offline', lastError: execErr?.message || String(execErr) });
                throw execErr;
              }
              try {
                const ackVersion = await pushSnapshot(label, meta || {});
                if(Number.isFinite(ackVersion)) version = ackVersion;
                const ts = Date.now();
                emitStatus({ state:'online', version, lastSync: ts, updatedAt: ts });
              } catch(syncErr){
                const lastError = syncErr?.message || String(syncErr);
                emitStatus({ state:'offline', lastError });
                if(allowLocalFallback && (
                  syncErr?.code === 'POS_SYNC_TIMEOUT'
                  || syncErr?.code === 'POS_SYNC_OFFLINE'
                  || syncErr?.code === 'POS_SYNC_ERROR'
                  || syncErr?.code === 'POS_SYNC_DISABLED'
                )){
                  online = false;
                  emitDiagnostic('sync:fallback', {
                    level:'warn',
                    message: lastError || 'Central sync failed — continuing locally.',
                    data:{ reason: syncErr?.code || 'unknown', label, meta }
                  });
                  return result;
                }
                throw syncErr;
              }
              return result;
            };
            const next = queue.then(()=> task(), ()=> task());
            queue = next.catch(()=>{});
            return next;
          };
      
          const destroy = async (reason)=>{
            const synced = await ensureInitialSync();
            if(disabled || synced === false){
              return true;
            }
            if(!socket || !ready || awaitingAuth || !online){
              throw createSyncError('POS_SYNC_OFFLINE', 'Central sync offline.');
            }
            try {
              const ackVersion = await pushDestroy(reason || 'reset');
              if(Number.isFinite(ackVersion)) version = ackVersion;
              const ts = Date.now();
              emitStatus({ state:'online', version, lastSync: ts, updatedAt: ts });
              return true;
            } catch(err){
              emitStatus({ state:'offline', lastError: err?.message || String(err) });
              throw err;
            }
          };
      
          emitStatus(status);
      
          return {
            connect,
            ensureInitialSync,
            run,
            publishCreateOrder,
            destroy,
            isOnline(){ return online; },
            getStatus(){ return { ...status, version }; },
            createError: createSyncError
          };
        }
      
        function createEventReplicator(options={}){
          const adapter = options.adapter;
          const endpoint = options.endpoint || null;
          const branch = options.branch || 'default';
          const interval = Math.max(2000, Number(options.interval) || 15000);
          const fetcher = typeof options.fetch === 'function' ? options.fetch : (typeof fetch === 'function' ? fetch : null);
          const applyEvent = typeof options.applyEvent === 'function' ? options.applyEvent : null;
          const onBatchApplied = typeof options.onBatchApplied === 'function' ? options.onBatchApplied : null;
          const onError = typeof options.onError === 'function' ? options.onError : null;
          const onDiagnostic = typeof options.onDiagnostic === 'function' ? options.onDiagnostic : null;
          if(!adapter || typeof adapter.getSyncMetadata !== 'function' || typeof adapter.updateSyncMetadata !== 'function'){
            console.warn('[Mishkah][POS] Event replicator requires adapter with sync metadata helpers.');
            return {
              start(){},
              stop(){},
              async fetchNow(){ return { appliedCount:0, eventsProcessed:0 }; },
              getCursor(){ return { appliedEventId:null, branchSnapshotVersion:null }; }
            };
          }
          if(!endpoint || !fetcher){
            console.warn('[Mishkah][POS] Event replicator inactive — missing endpoint or fetch implementation.');
            return {
              start(){},
              stop(){},
              async fetchNow(){ return { appliedCount:0, eventsProcessed:0 }; },
              getCursor(){ return { appliedEventId:null, branchSnapshotVersion:null }; }
            };
          }
          let cursorCache = null;
          let timer = null;
          let stopped = true;
          let queue = Promise.resolve();
      
          const emitDiagnostic = (event, payload)=>{
            if(!onDiagnostic) return;
            try { onDiagnostic(event, payload); } catch(_err){}
          };
      
          const loadCursor = async ()=>{
            if(cursorCache) return cursorCache;
            try {
              const record = await adapter.getSyncMetadata(branch);
              cursorCache = {
                appliedEventId: record?.appliedEventId || null,
                branchSnapshotVersion: record?.branchSnapshotVersion || null,
                updatedAt: record?.updatedAt || null
              };
            } catch(error){
              emitDiagnostic('cursor:error', { error, stage:'load' });
              cursorCache = { appliedEventId:null, branchSnapshotVersion:null, updatedAt:null };
            }
            return cursorCache;
          };
      
          const persistCursor = async (patch={})=>{
            cursorCache = { ...(cursorCache || {}), ...patch };
            try {
              const saved = await adapter.updateSyncMetadata(branch, cursorCache);
              cursorCache = { ...cursorCache, ...saved };
            } catch(error){
              emitDiagnostic('cursor:error', { error, stage:'save', patch });
            }
            return cursorCache;
          };
      
          const resolveEventId = (event)=>{
            if(!event || typeof event !== 'object') return null;
            const direct = event.id || event.eventId || event.uuid || event.dataset_id || null;
            if(direct != null) return String(direct);
            if(event.record && event.record.id != null) return String(event.record.id);
            if(event.entry && event.entry.id != null) return String(event.entry.id);
            const payload = event.payload && typeof event.payload === 'object' ? event.payload : null;
            if(payload){
              if(payload.id != null) return String(payload.id);
              if(payload.orderId != null) return String(payload.orderId);
              if(payload.eventId != null) return String(payload.eventId);
            }
            return null;
          };
      
          const resolveTimestamp = (event)=>{
            if(!event || typeof event !== 'object') return Date.now();
            const candidates = [
              event.updatedAt,
              event.createdAt,
              event.ts,
              event.time,
              event.meta?.updatedAt,
              event.meta?.createdAt,
              event.meta?.ts
            ];
            for(const candidate of candidates){
              if(candidate == null) continue;
              const value = typeof candidate === 'string' ? Date.parse(candidate) : Number(candidate);
              if(Number.isFinite(value)) return value;
            }
            return Date.now();
          };
      
          const sortEvents = (events)=>{
            return events.slice().sort((a,b)=>{
              const tsA = resolveTimestamp(a);
              const tsB = resolveTimestamp(b);
              if(tsA !== tsB) return tsA - tsB;
              const idA = resolveEventId(a) || '';
              const idB = resolveEventId(b) || '';
              return idA.localeCompare(idB);
            });
          };
      
          const buildUrl = ()=>{
            let url = endpoint;
            const query = new URLSearchParams();
            const cursor = cursorCache || {};
            if(cursor.appliedEventId){
              query.set('after', cursor.appliedEventId);
            }
            if(cursor.branchSnapshotVersion){
              query.set('since_version', cursor.branchSnapshotVersion);
            }
            if(options.limit){
              query.set('limit', options.limit);
            }
            if(options.query && typeof options.query === 'object'){
              Object.entries(options.query).forEach(([key, value])=>{
                if(value === undefined || value === null) return;
                query.set(key, value);
              });
            }
            if(typeof options.queryBuilder === 'function'){
              try {
                const extra = options.queryBuilder({ cursor, branch });
                if(extra && typeof extra === 'object'){
                  Object.entries(extra).forEach(([key, value])=>{
                    if(value === undefined || value === null) return;
                    query.set(key, value);
                  });
                }
              } catch(error){
                emitDiagnostic('query:error', { error });
              }
            }
            const queryString = query.toString();
            if(queryString){
              url += (url.includes('?') ? '&' : '?') + queryString;
            }
            return url;
          };
      
          const applyBatch = async (events, context)=>{
            if(!Array.isArray(events) || !events.length) return { appliedCount:0, eventsProcessed:0 };
            await loadCursor();
            const sorted = sortEvents(events);
            const pointerId = cursorCache?.appliedEventId || null;
            const startIndex = pointerId ? sorted.findIndex(evt=> resolveEventId(evt) === pointerId) : -1;
            const slice = startIndex >= 0 ? sorted.slice(startIndex + 1) : sorted;
            let applied = 0;
            for(const event of slice){
              const eventId = resolveEventId(event);
              let handled = false;
              if(applyEvent){
                try {
                  const result = await applyEvent(event, { branch, eventId, context });
                  handled = result !== false;
                } catch(error){
                  emitDiagnostic('apply:error', { error, eventId, event });
                  if(onError){
                    try { onError(error, event, { branch, stage:'apply' }); } catch(_err){}
                  } else {
                    console.warn('[Mishkah][POS] Event replicator failed to apply event.', error);
                  }
                  handled = false;
                }
              }
              if(handled && eventId){
                applied += 1;
                await persistCursor({ appliedEventId: eventId, updatedAt: Date.now() });
              }
            }
            if(context && context.version !== undefined && context.version !== null){
              await persistCursor({ branchSnapshotVersion: context.version, updatedAt: Date.now() });
            }
            return { appliedCount: applied, eventsProcessed: slice.length };
          };
      
          const fetchOnce = async ()=>{
            await loadCursor();
            const url = buildUrl();
            let body = null;
            let response = null;
            try {
              response = await fetcher(url, { cache:'no-store' });
            } catch(error){
              emitDiagnostic('fetch:error', { error, url, stage:'network' });
              if(onError){
                try { onError(error, null, { branch, stage:'fetch-network' }); } catch(_err){}
              }
              throw error;
            }
            if(!response || !response.ok){
              const status = response ? response.status : 'network';
              const error = new Error(`WS2 events HTTP ${status}`);
              emitDiagnostic('fetch:error', { error, url, status, stage:'http' });
              if(onError){
                try { onError(error, null, { branch, stage:'fetch-http', status }); } catch(_err){}
              }
              throw error;
            }
            try {
              body = await response.json();
            } catch(error){
              emitDiagnostic('fetch:error', { error, url, stage:'json' });
              if(onError){
                try { onError(error, null, { branch, stage:'fetch-json' }); } catch(_err){}
              }
              throw error;
            }
            const events = Array.isArray(body?.events) ? body.events : [];
            const version = body?.version ?? body?.branchSnapshotVersion ?? body?.meta?.version ?? body?.snapshot?.version ?? null;
            const result = await applyBatch(events, { version, raw: body });
            if(onBatchApplied){
              try { await onBatchApplied({ ...result, version, body }); } catch(error){ emitDiagnostic('batch:error', { error }); }
            }
            if(events.length === 0 && version != null){
              await persistCursor({ branchSnapshotVersion: version, updatedAt: Date.now() });
            }
            return result;
          };
      
          const schedule = ()=>{
            if(stopped) return;
            if(timer){
              clearTimeout(timer);
              timer = null;
            }
            timer = setTimeout(()=>{
              if(stopped) return;
              queue = queue.then(()=> fetchOnce()).catch(()=>{}).finally(()=> schedule());
            }, interval);
          };
      
          return {
            start(){
              if(!stopped) return;
              stopped = false;
              queue = queue.then(()=> loadCursor()).catch(()=>{}).then(()=> fetchOnce()).catch(()=>{});
              schedule();
            },
            stop(){
              stopped = true;
              if(timer){
                clearTimeout(timer);
                timer = null;
              }
            },
            async fetchNow(){
              await loadCursor();
              return queue = queue.then(()=> fetchOnce()).catch(error=>{
                emitDiagnostic('fetch:error', { error, stage:'manual' });
                return { appliedCount:0, eventsProcessed:0, error };
              });
            },
            getCursor(){
              return { ...(cursorCache || {}) };
            }
          };
        }

        function createWs2CrudSync(options={}){
          const WebSocketX = U.WebSocketX || U.WebSocket;
          const fetcher = typeof options.fetch === 'function' ? options.fetch : (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
          const wsEndpoint = options.wsEndpoint || options.endpoint || null;
          const token = options.token || null;
          const httpBase = (options.httpEndpoint || options.httpBase || '/api/branches').replace(/\/$/, '');
          const credentials = options.credentials;
          const headersOverride = options.headers && typeof options.headers === 'object' ? options.headers : {};
          const includeAuthHeader = options.includeAuthHeader !== false;
          const autoConnect = options.autoConnect !== false;
          const pingConfig = options.ping || { interval:15000, timeout:7000, send:{ type:'ping' }, expect:'pong' };
          const wsIdentifiers = typeof POS_WS2_IDENTIFIERS === 'object' && POS_WS2_IDENTIFIERS ? POS_WS2_IDENTIFIERS : {};
          const posInfo = typeof POS_INFO === 'object' && POS_INFO ? POS_INFO : {};
          const defaultBranch = options.branchId
            || options.branch
            || wsIdentifiers.branchId
            || posInfo.branchId
            || (typeof BRANCH_CHANNEL !== 'undefined' ? BRANCH_CHANNEL : null)
            || 'default';
          const branchId = defaultBranch;
          const moduleId = options.moduleId || options.module || 'pos';
          const normalizeTableName = (name)=> String(name || '').trim();
          const toTableKey = (name)=> normalizeTableName(name).toLowerCase();
          const branchSegment = encodeURIComponent(branchId);
          const moduleSegment = encodeURIComponent(moduleId);
          const baseHeaders = { accept:'application/json', ...headersOverride };
          if(token && includeAuthHeader && !baseHeaders.authorization && !baseHeaders.Authorization){
            baseHeaders.authorization = `Bearer ${token}`;
          }

          const globalServiceFactory = typeof globalThis !== 'undefined' ? (globalThis.MishkahPosServiceAdapter || null) : null;
          const serviceAdapter = options.serviceAdapter
            || (typeof globalThis !== 'undefined' ? (globalThis.POS_SERVICE_ADAPTER || null) : null);
          const hasOfflineQueue = !!(serviceAdapter && typeof serviceAdapter.enqueueMutation === 'function');
          const shouldQueueFallback = (error)=>{
            if(!error) return false;
            if(typeof navigator !== 'undefined' && navigator.onLine === false) return true;
            const status = typeof error.status === 'number' ? error.status : null;
            if(status === 0) return true;
            const message = error && error.message ? String(error.message).toLowerCase() : '';
            return message.includes('failed to fetch') || message.includes('network');
          };
          const shouldQueueMutation = (error)=>{
            if(serviceAdapter && typeof serviceAdapter.shouldQueueError === 'function'){
              try { return serviceAdapter.shouldQueueError(error); } catch(_err){ }
            }
            if(globalServiceFactory && typeof globalServiceFactory.shouldQueueError === 'function'){
              try { return globalServiceFactory.shouldQueueError(error); } catch(_err){ }
            }
            return shouldQueueFallback(error);
          };

          let socket = null;
          let ready = false;
          let awaitingAuth = false;
          let manualClose = false;

          const watchers = new Map();
          const lastNotice = new Map();
          const activeTopics = new Set();
          const pendingTopics = new Set();

          const emit = (callback, payload, context={})=>{
            if(typeof callback !== 'function') return;
            try { callback(payload, context); } catch(error){ console.warn('[Mishkah][POS][CRUD] Handler execution failed.', error); }
          };

          const buildTableUrl = (tableName, query={})=>{
            const tableSegment = encodeURIComponent(normalizeTableName(tableName));
            let url = `${httpBase}/${branchSegment}/modules/${moduleSegment}/tables/${tableSegment}`;
            const params = new URLSearchParams();
            Object.entries(query || {}).forEach(([key, value])=>{
              if(value === undefined || value === null) return;
              if(Array.isArray(value)){
                value.forEach((entry)=>{ if(entry !== undefined && entry !== null) params.append(key, entry); });
                return;
              }
              params.set(key, value);
            });
            const serialized = params.toString();
            if(serialized){
              url += `?${serialized}`;
            }
            return url;
          };

          const performRequest = async ({ method, tableName, body=null, query=null, headers: extraHeaders=null })=>{
            if(!fetcher){
              throw new Error('Fetch API is unavailable for WS2 CRUD operations.');
            }
            const normalizedTable = normalizeTableName(tableName);
            const url = buildTableUrl(normalizedTable, query || {});
            const headers = { ...baseHeaders, ...(extraHeaders || {}) };
            const init = { method, headers };
            if(credentials) init.credentials = credentials;
            if(body !== null && body !== undefined && method !== 'GET'){
              if(!headers['content-type'] && !headers['Content-Type']){
                headers['content-type'] = 'application/json; charset=utf-8';
              }
              init.body = JSON.stringify(body);
            }
            let response;
            try {
              response = await fetcher(url, init);
            } catch(error){
              throw error;
            }
            let parsed = null;
            const text = typeof response.text === 'function' ? await response.text() : '';
            if(text){
              try { parsed = JSON.parse(text); } catch(_err){ parsed = null; }
            }
            if(!response.ok){
              const err = new Error(parsed?.message || `HTTP ${response.status}`);
              err.status = response.status;
              err.body = parsed;
              err.url = url;
              throw err;
            }
            const result = parsed === null ? {} : parsed;
            if(serviceAdapter && typeof serviceAdapter.handleEnvelope === 'function'){
              try {
                await serviceAdapter.handleEnvelope(result, { table: normalizedTable, method, query, body });
              } catch(handlerError){
                console.warn('[Mishkah][POS][CRUD] Service adapter reconciliation failed.', handlerError);
              }
            }
            return result;
          };

          const request = async (method, tableName, { body=null, query=null, headers: extraHeaders=null }={})=>{
            try {
              return await performRequest({ method, tableName, body, query, headers: extraHeaders });
            } catch(error){
              if(hasOfflineQueue && shouldQueueMutation(error)){
                try {
                  const entry = {
                    id: `${Date.now().toString(36)}-${Math.random().toString(16).slice(2,8)}`,
                    method,
                    table: normalizeTableName(tableName),
                    body,
                    query,
                    headers: extraHeaders,
                    ts: Date.now()
                  };
                  const record = await serviceAdapter.enqueueMutation(entry);
                  return { queued:true, offline:true, entry: record };
                } catch(queueError){
                  console.warn('[Mishkah][POS][CRUD] Failed to enqueue offline mutation.', queueError);
                }
              }
              const networkError = new Error(error?.message || 'Network request failed.');
              networkError.cause = error;
              throw networkError;
            }
          };

          const ensureTopicSubscription = (topic)=>{
            if(!topic) return;
            if(activeTopics.has(topic)) return;
            activeTopics.add(topic);
            pendingTopics.add(topic);
            if(socket && ready && !awaitingAuth){
              try {
                socket.send({ type:'subscribe', topic });
                pendingTopics.delete(topic);
              } catch(error){
                console.warn('[Mishkah][POS][CRUD] Failed to subscribe to topic.', { topic, error });
              }
            }
          };

          const ensureTopicsForTable = (tableName)=>{
            const normalized = normalizeTableName(tableName);
            if(!normalized) return;
            const topics = [
              `sync-table::${branchId}::${moduleId}::${normalized}`,
              `sync-table::${branchId}::${normalized}`,
              `table::${normalized}`
            ];
            topics.forEach(ensureTopicSubscription);
          };

          const flushPending = ()=>{
            if(!socket || !ready || awaitingAuth || !pendingTopics.size) return;
            const topics = Array.from(pendingTopics);
            topics.forEach((topic)=>{
              try {
                socket.send({ type:'subscribe', topic });
                pendingTopics.delete(topic);
              } catch(error){
                console.warn('[Mishkah][POS][CRUD] Deferred subscription failed.', { topic, error });
              }
            });
          };

          const flushOfflineQueue = async ()=>{
            if(!hasOfflineQueue || !serviceAdapter || typeof serviceAdapter.flushQueue !== 'function'){
              return { flushed:0, pending:0 };
            }
            try {
              return await serviceAdapter.flushQueue(async (entry)=>{
                const payload = {
                  method: entry.method || 'POST',
                  tableName: entry.table || entry.tableName,
                  body: Object.prototype.hasOwnProperty.call(entry, 'body') ? entry.body : null,
                  query: entry.query || null,
                  headers: entry.headers || null
                };
                return performRequest(payload);
              });
            } catch(error){
              return { flushed:0, pending:1, error };
            }
          };

          const dispatchNotice = (notice, meta={})=>{
            if(!notice || typeof notice !== 'object') return;
            const tableName = normalizeTableName(notice.table || notice.meta?.table);
            if(!tableName) return;
            const key = toTableKey(tableName);
            lastNotice.set(key, notice);
            emit(options.onNotice, notice, meta);
            const tableWatchers = watchers.get(key);
            if(tableWatchers && tableWatchers.size){
              tableWatchers.forEach((handler)=> emit(handler, notice, meta));
            }
            if(serviceAdapter && typeof serviceAdapter.handleNotice === 'function'){
              const fetchDelta = async ()=>{
                if(typeof options.fetchDelta === 'function'){
                  try { return await options.fetchDelta(notice, { request, performRequest, serviceAdapter }); }
                  catch(fetchErr){ console.warn('[Mishkah][POS][CRUD] Custom delta fetcher failed.', fetchErr); return null; }
                }
                const identifiers = [];
                if(Array.isArray(notice.ids)) identifiers.push(...notice.ids);
                if(Array.isArray(notice.meta?.ids)) identifiers.push(...notice.meta.ids);
                if(!identifiers.length) return null;
                try {
                  return await performRequest({ method:'GET', tableName, query:{ ids: identifiers } });
                } catch(fetchErr){
                  console.warn('[Mishkah][POS][CRUD] Delta fetch failed.', fetchErr);
                  return null;
                }
              };
              try {
                await serviceAdapter.handleNotice(notice, { fetchDelta });
              } catch(handlerError){
                console.warn('[Mishkah][POS][CRUD] Service adapter notice handler failed.', handlerError);
              }
            }
          };

          const handleFrame = (frame)=>{
            if(!frame || typeof frame !== 'object') return;
            if(frame.type === 'ack'){
              if(frame.event === 'auth'){
                awaitingAuth = false;
                flushPending();
                if(hasOfflineQueue){
                  flushOfflineQueue().catch(()=>{});
                }
              }
              if(frame.event === 'subscribe'){
                flushPending();
              }
              return;
            }
            if(frame.type === 'publish'){
              const payload = frame.data && typeof frame.data === 'object' ? frame.data : null;
              if(payload && payload.type === 'table:update'){
                dispatchNotice(payload, { topic: frame.topic, meta: frame.meta || {} });
              }
            }
          };

          const connect = ()=>{
            if(!WebSocketX || !wsEndpoint){
              if(!WebSocketX){
                console.warn('[Mishkah][POS][CRUD] WebSocket adapter unavailable.');
              }
              if(!wsEndpoint){
                console.warn('[Mishkah][POS][CRUD] Missing WS endpoint; notifications disabled.');
              }
              return null;
            }
            if(socket){
              try { socket.connect({ waitOpen:false }); } catch(_err){}
              return socket;
            }
            manualClose = false;
            socket = new WebSocketX(wsEndpoint, { autoReconnect: options.autoReconnect !== false, ping: pingConfig });
            socket.on('open', ()=>{
              ready = true;
              emit(options.onOpen, { endpoint: wsEndpoint });
              if(token){
                awaitingAuth = true;
                try { socket.send({ type:'auth', data:{ token } }); } catch(error){ console.warn('[Mishkah][POS][CRUD] Auth frame failed.', error); }
              } else {
                flushPending();
                if(hasOfflineQueue){
                  flushOfflineQueue().catch(()=>{});
                }
              }
            });
            socket.on('close', (event)=>{
              ready = false;
              awaitingAuth = false;
              emit(options.onClose, event || {});
              if(!manualClose){
                activeTopics.forEach((topic)=> pendingTopics.add(topic));
              }
            });
            socket.on('error', (error)=>{
              ready = false;
              emit(options.onError, error || {});
            });
            socket.on('message', (msg)=>{
              let payload = msg;
              if(payload && typeof payload === 'string'){
                try { payload = JSON.parse(payload); } catch(_err){ payload = null; }
              }
              if(!payload || typeof payload !== 'object') return;
              handleFrame(payload);
            });
            try { socket.connect({ waitOpen:false }); } catch(_err){}
            return socket;
          };

          const ensureSocket = ()=>{
            if(!socket) connect();
            return socket;
          };

          const disconnect = (code=1000, reason='manual')=>{
            if(!socket) return;
            manualClose = true;
            try { socket.close(code, reason); } catch(_err){}
            socket = null;
            ready = false;
            awaitingAuth = false;
          };

          const subscribe = (tableName, handler)=>{
            if(typeof handler !== 'function') return ()=>{};
            const label = normalizeTableName(tableName);
            if(!label) return ()=>{};
            const key = toTableKey(label);
            if(!watchers.has(key)) watchers.set(key, new Set());
            watchers.get(key).add(handler);
            ensureTopicsForTable(label);
            if(autoConnect) ensureSocket();
            if(lastNotice.has(key)){
              emit(handler, lastNotice.get(key), { replay:true });
            }
            return ()=>{
              const set = watchers.get(key);
              if(!set) return;
              set.delete(handler);
              if(!set.size) watchers.delete(key);
            };
          };

          const getLastNotice = (tableName)=>{
            const key = toTableKey(tableName);
            return lastNotice.get(key) || null;
          };

          const api = {
            connect,
            disconnect,
            isConnected(){ return !!(socket && ready && !awaitingAuth); },
            subscribe,
            getLastNotice,
            list(tableName, query){ return request('GET', tableName, { query }); },
            read(tableName, query){ return request('GET', tableName, { query }); },
            insert(tableName, record, meta){ return request('POST', tableName, { body:{ record, meta } }); },
            merge(tableName, record, meta){ return request('PATCH', tableName, { body:{ record, meta } }); },
            save(tableName, record, meta){ return request('PUT', tableName, { body:{ record, meta } }); },
            remove(tableName, record, meta){ return request('DELETE', tableName, { body:{ record, meta } }); },
            request,
            ensureSocket,
            flushOfflineQueue,
            queuedMutations(){
              if(serviceAdapter && typeof serviceAdapter.listQueued === 'function'){
                return serviceAdapter.listQueued();
              }
              return Promise.resolve([]);
            },
            topics(){ return Array.from(activeTopics); }
          };

          if(Array.isArray(options.topics)){
            options.topics.forEach((topic)=>{
              if(typeof topic === 'string' && topic.trim()){
                ensureTopicSubscription(topic.trim());
              }
            });
          }

          if(Array.isArray(options.tables)){
            options.tables.forEach((tableName)=> ensureTopicsForTable(tableName));
          }

          if(autoConnect && (wsEndpoint || options.tables || options.topics)){
            ensureSocket();
          }

          if(typeof window !== 'undefined' && hasOfflineQueue){
            window.addEventListener('online', ()=>{ flushOfflineQueue().catch(()=>{}); });
          }

          return api;
        }

        const ORDER_TYPE_GUARDS = new Set(['dine_in','dine-in','dine in','takeaway','delivery','pickup','drive_thru','drive-thru']);
      
        function resolveEventType(value){
          if(!value || typeof value !== 'object') return '';
          const payload = value.payload && typeof value.payload === 'object' ? value.payload : null;
          const metaType = payload?.type || payload?.action || payload?.eventType || payload?.event_type;
          const topLevel = value.type || value.action;
          return String(metaType || topLevel || '').toLowerCase();
        }
      
        function isOrderRecord(candidate){
          if(!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return false;
          const header = candidate.header && typeof candidate.header === 'object' ? candidate.header : null;
          const id = candidate.id || candidate.orderId || candidate.order_id || header?.id || null;
          if(!id) return false;
          if(candidate.lines || candidate.orderLines || candidate.order_lines) return true;
          if(candidate.totals || candidate.total || candidate.summary) return true;
          if(candidate.status || candidate.order_status || header?.status) return true;
          if(candidate.shiftId || candidate.shift_id || header?.shiftId) return true;
          if(candidate.metadata && typeof candidate.metadata === 'object' && candidate.metadata.shiftId) return true;
          if(candidate.type && ORDER_TYPE_GUARDS.has(String(candidate.type).toLowerCase())) return true;
          if(header) return true;
          return false;
        }
      
        function normalizeRemoteOrderRecord(raw, eventMeta={}){
          if(!raw || typeof raw !== 'object') return null;
          if(Array.isArray(raw)){
            const picked = raw.find(entry=> isOrderRecord(entry));
            return picked ? normalizeRemoteOrderRecord(picked, eventMeta) : null;
          }
          if(raw.order && typeof raw.order === 'object'){
            return normalizeRemoteOrderRecord(raw.order, eventMeta);
          }
          if(raw.payload && typeof raw.payload === 'object' && !Array.isArray(raw.payload)){
            return normalizeRemoteOrderRecord(raw.payload, eventMeta);
          }
          const header = raw.header && typeof raw.header === 'object' ? raw.header : null;
          const order = cloneDeep(raw);
          if(header){
            order.id = order.id || header.id;
            order.type = order.type || header.type;
            order.status = order.status || header.status;
            order.fulfillmentStage = order.fulfillmentStage || header.fulfillmentStage || header.stage;
            order.paymentState = order.paymentState || header.paymentState;
            order.shiftId = order.shiftId || header.shiftId;
            order.posId = order.posId || header.posId || header.metadata?.posId;
            order.posLabel = order.posLabel || header.posLabel || header.metadata?.posLabel;
            order.posNumber = order.posNumber || header.posNumber || header.metadata?.posNumber;
            if(!Array.isArray(order.lines) && Array.isArray(header.lines)){
              order.lines = header.lines.map(line=> ({ ...line }));
            }
            order.metadata = { ...(order.metadata || {}), ...(header.metadata || {}) };
          }
          order.id = order.id || order.orderId || order.order_id || null;
          order.shiftId = order.shiftId || order.shift_id || order.shift || order.metadata?.shiftId || null;
          order.type = order.type || order.order_type || order.metadata?.orderType || order.metadata?.type || null;
          if(!order.posId){
            order.posId = order.metadata?.posId || POS_INFO.id;
          }
          if(!order.posLabel){
            order.posLabel = order.metadata?.posLabel || POS_INFO.label;
          }
          if(!Number.isFinite(Number(order.posNumber))){
            const posNumberSource = order.metadata?.posNumber || order.posNumber;
            order.posNumber = Number.isFinite(Number(posNumberSource)) ? Number(posNumberSource) : POS_INFO.number;
          }
          if(Array.isArray(order.orderLines) && !Array.isArray(order.lines)){
            order.lines = order.orderLines.map(line=> ({ ...line }));
          }
          if(Array.isArray(order.details) && !Array.isArray(order.lines)){
            order.lines = order.details.map(line=> ({ ...line }));
          }
          if(order.deleted === true || order.isDeleted === true){
            order.status = order.status || 'cancelled';
          }
          order.updatedAt = order.updatedAt || order.updated_at || Date.now();
          order.createdAt = order.createdAt || order.created_at || order.updatedAt;
          order.savedAt = order.savedAt || order.saved_at || order.updatedAt;
          if(order.id && order.shiftId){
            order.dirty = false;
            order.isPersisted = true;
            if(!order.fulfillmentStage && order.status === 'cancelled'){
              order.fulfillmentStage = 'cancelled';
            }
            order.metadata = {
              ...(order.metadata || {}),
              ws2EventType: eventMeta.type || null
            };
            return order;
          }
          return null;
        }
      
        function collectOrderCandidates(event){
          if(!event || typeof event !== 'object') return [];
          const queue = [event];
          const seen = new Set();
          const results = [];
          while(queue.length){
            const current = queue.shift();
            if(!current || typeof current !== 'object') continue;
            if(seen.has(current)) continue;
            seen.add(current);
            if(Array.isArray(current)){
              current.forEach(entry=> queue.push(entry));
              continue;
            }
            if(isOrderRecord(current)){
              const normalized = normalizeRemoteOrderRecord(current, { type: resolveEventType(event) });
              if(normalized && normalized.id) results.push(normalized);
            }
            Object.keys(current).forEach(key=>{
              if(['meta','serverId','version','moduleId','branchId','event','action'].includes(key)) return;
              const value = current[key];
              if(value && typeof value === 'object') queue.push(value);
            });
          }
          return results;
        }

        function applyWs2EventToPos(event, options={}){
          const entries = Array.isArray(event) ? event : [event];
          const notices = [];
          const orders = [];
          const orderNotices = [];
          const seenOrderIds = new Set();

          const registerOrder = (order, source)=>{
            if(!order || !order.id) return;
            const key = String(order.id);
            if(seenOrderIds.has(key)) return;
            seenOrderIds.add(key);
            orders.push(order);
            if(typeof options.onOrder === 'function'){
              try { options.onOrder(order, source); } catch(error){ console.warn('[Mishkah][POS][CRUD] onOrder handler failed.', error); }
            }
          };

          entries.forEach((entry)=>{
            if(!entry || typeof entry !== 'object') return;
            const notice = entry.notice && typeof entry.notice === 'object' ? entry.notice : (entry.type === 'table:update' ? entry : null);
            if(notice){
              notices.push(notice);
              const tableName = String(notice.table || '').toLowerCase();
              if(tableName === 'orders' || tableName === 'job_orders' || tableName === 'job-orders'){
                orderNotices.push(notice);
              }
              if(typeof options.onNotice === 'function'){
                try { options.onNotice(notice, entry); } catch(error){ console.warn('[Mishkah][POS][CRUD] onNotice handler failed.', error); }
              }
            }
            const candidates = collectOrderCandidates(entry);
            if(Array.isArray(candidates) && candidates.length){
              candidates.forEach((order)=> registerOrder(order, entry));
            }
          });

          if(orderNotices.length && typeof options.onOrdersNotice === 'function'){
            try { options.onOrdersNotice(orderNotices); } catch(error){ console.warn('[Mishkah][POS][CRUD] onOrdersNotice handler failed.', error); }
          }

          return { notices, orders };
        }
      scope.ws = {
        createKDSSync,
        createCentralPosSync,
        createEventReplicator,
        createWs2CrudSync,
        applyWs2EventToPos
      };
    }
  };
})(typeof window !== 'undefined' ? window : this);
