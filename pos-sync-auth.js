/**
 * بسم الله الرحمن الرحيم
 * FILE: pos-sync-auth.js
 *
 * الغرض: توفير نقطة تكوين واحدة لرمز التوثيق (Bearer Token) الخاص بالمزامنة المركزية للـ POS
 *        مع إمكانية ضبط نقاط النهاية (HTTP/WS) عند الحاجة. عدّل القيم أدناه في بيئات التطوير
 *        أو قم بتحميل قيم ديناميكية عبر window.MishkahPosSyncAuth أو localStorage.
 */
(function configureMishkahPosSyncAuth(){
  if(typeof window === 'undefined') return;

  const POS_SYNC_TOKEN = null; // ← استبدل القيمة برمز JWT/Token الفعلي إذا رغبت في تخزينه داخل المستودع المحلي.
  const POS_SYNC_HTTP_ENDPOINT = null; // ← استبدلها بعنوان HTTP المخصص (مثال: 'https://api.example.com/api/pos-sync/branch-main').
  const POS_SYNC_WS_ENDPOINT = null; // ← استبدلها بعنوان WebSocket المخصص (مثال: 'wss://ws.example.com/ws').
  const POS_SYNC_AUTH_OFF = true; // ← عطّل التوثيق بالكامل أثناء التطوير. أعدها إلى false عند الحاجة لإعادة التحقق.

  const localStorageTokenKey = 'MISHKAH_POS_SYNC_TOKEN';
  const localStorageAuthOffKey = 'MISHKAH_POS_SYNC_AUTH_OFF';

  const externalAuthConfig = (typeof window.MishkahPosSyncAuth === 'object' && window.MishkahPosSyncAuth)
    ? window.MishkahPosSyncAuth
    : {};

  const readBooleanCandidate = (value)=>{
    if(value === true || value === false) return value;
    if(typeof value === 'number') return value !== 0;
    if(typeof value === 'string'){
      const normalized = value.trim().toLowerCase();
      if(!normalized) return null;
      if(['1','true','yes','y','on','enable','enabled'].includes(normalized)) return true;
      if(['0','false','no','n','off','disable','disabled'].includes(normalized)) return false;
    }
    return null;
  };

  const readCandidate = (value)=>{
    if(typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  };

  let tokenSource = null;
  let httpSource = null;
  let wsSource = null;

  let token = readCandidate(POS_SYNC_TOKEN);
  if(token){
    tokenSource = 'pos-sync-auth.js constant';
  }
  if(!token && readCandidate(externalAuthConfig.token)){
    token = readCandidate(externalAuthConfig.token);
    tokenSource = 'window.MishkahPosSyncAuth.token';
  }
  if(!token && typeof window.localStorage !== 'undefined'){
    const stored = readCandidate(window.localStorage.getItem(localStorageTokenKey));
    if(stored){
      token = stored;
      tokenSource = `localStorage:${localStorageTokenKey}`;
    }
  }

  let httpEndpoint = readCandidate(POS_SYNC_HTTP_ENDPOINT);
  if(httpEndpoint){
    httpSource = 'pos-sync-auth.js constant';
  }
  if(!httpEndpoint){
    const externalHttp = readCandidate(externalAuthConfig.httpEndpoint)
      || readCandidate(externalAuthConfig.http_endpoint)
      || readCandidate(externalAuthConfig.posHttpEndpoint)
      || readCandidate(externalAuthConfig.pos_http_endpoint);
    if(externalHttp){
      httpEndpoint = externalHttp;
      httpSource = 'window.MishkahPosSyncAuth.http*';
    }
  }

  let wsEndpoint = readCandidate(POS_SYNC_WS_ENDPOINT);
  if(wsEndpoint){
    wsSource = 'pos-sync-auth.js constant';
  }
  if(!wsEndpoint){
    const externalWs = readCandidate(externalAuthConfig.wsEndpoint)
      || readCandidate(externalAuthConfig.ws_endpoint)
      || readCandidate(externalAuthConfig.posWsEndpoint)
      || readCandidate(externalAuthConfig.pos_ws_endpoint);
    if(externalWs){
      wsEndpoint = externalWs;
      wsSource = 'window.MishkahPosSyncAuth.ws*';
    }
  }

  window.database = window.database || {};
  const settings = window.database.settings = window.database.settings || {};
  const sync = settings.sync = settings.sync || {};

  if(token){
    sync.token = token;
    sync.pos_token = token;
    sync.posToken = token;
  }
  if(httpEndpoint){
    sync.http_endpoint = httpEndpoint;
    sync.httpEndpoint = httpEndpoint;
  }
  if(wsEndpoint){
    sync.ws_endpoint = wsEndpoint;
    sync.wsEndpoint = wsEndpoint;
    sync.pos_ws_endpoint = wsEndpoint;
    sync.posWsEndpoint = wsEndpoint;
  }

  let authOff = null;
  let authOffSource = null;
  const pickAuthOff = (value, source)=>{
    if(authOff !== null) return;
    const parsed = readBooleanCandidate(value);
    if(parsed === null) return;
    authOff = parsed;
    authOffSource = source;
  };

  pickAuthOff(externalAuthConfig.authOff, 'window.MishkahPosSyncAuth.authOff');
  pickAuthOff(externalAuthConfig.auth_off, 'window.MishkahPosSyncAuth.auth_off');
  pickAuthOff(externalAuthConfig.authBypass, 'window.MishkahPosSyncAuth.authBypass');
  pickAuthOff(externalAuthConfig.auth_bypass, 'window.MishkahPosSyncAuth.auth_bypass');

  if(authOff === null && typeof window.localStorage !== 'undefined'){
    const storedAuthOff = window.localStorage.getItem(localStorageAuthOffKey);
    pickAuthOff(storedAuthOff, `localStorage:${localStorageAuthOffKey}`);
  }

  pickAuthOff(POS_SYNC_AUTH_OFF, 'pos-sync-auth.js constant');

  if(authOff === null) authOff = false;

  if(authOff){
    sync.auth_off = true;
    sync.authOff = true;
    sync.auth_bypass = true;
    sync.authBypass = true;
  }

  window.MishkahPosSyncAuth = {
    token,
    httpEndpoint,
    wsEndpoint,
    authOff,
    tokenSource,
    httpSource,
    wsSource,
    authOffSource,
    localStorageKey: localStorageTokenKey,
    authOffStorageKey: localStorageAuthOffKey
  };

  if(token){
    console.info('[Mishkah][POS][Config] Central sync auth token configured.', {
      source: tokenSource || 'unknown',
      length: token.length
    });
  } else if(authOff){
    console.info('[Mishkah][POS][Config] Central sync auth bypass active — token not required.', {
      authOffSource: authOffSource || 'unknown'
    });
  } else {
    console.warn('[Mishkah][POS][Config] No central sync auth token configured yet. POS will fall back to offline mode.', {
      localStorageKey: localStorageTokenKey
    });
  }

  if(httpEndpoint){
    console.info('[Mishkah][POS][Config] Central sync HTTP endpoint override active.', {
      source: httpSource || 'unknown',
      url: httpEndpoint
    });
  }

  if(wsEndpoint){
    console.info('[Mishkah][POS][Config] Central sync WebSocket endpoint override active.', {
      source: wsSource || 'unknown',
      url: wsEndpoint
    });
  }

  if(authOff){
    console.info('[Mishkah][POS][Config] Central sync authentication bypass ENABLED.', {
      source: authOffSource || 'unknown'
    });
  }
})();
