/*
 * Mishkah Utils — Orders-Focused Toolkit (v1.0)
 * -------------------------------------------------------------
 * مقصد هذا الملف: أدوات خفيفة وعملية تُستعمل داخل orders فقط.
 * لا يحتوي على أي أدوات تخص النواة (الأحداث/الـVDOM/البناء).
 * منظم في مجموعات واضحة تُسهّل الاستدعاء والاكتشاف.
 *
 * التصميم:
 *   U = {
 *     version,
 *     Type, Num, Time, Control, JSON, Data, Array,
 *     Id, Crypto, QS,
 *     Storage, Cookie,
 *     Net, IO,
 *     Cache
 *   }
 *
 * ملاحظات:
 * - لا وجود لـ U.cx أو أي Adapters هنا.
 * - كل شيء يُعلّق تحت Mishkah.utils (مع دمج دون استبدال).
 * - جميع الدوال نقية وآمنة قدر الإمكان.
 */
(function (window) {
  'use strict';

  const U = { version: 'orders-utils v1.0' };

  // ---------------------------------------------------------------------------
  // Type — فحوصات أنماط بسيطة
  // ---------------------------------------------------------------------------
  const isArr = Array.isArray;
  const isObj = v => v != null && typeof v === 'object' && !Array.isArray(v);
  const isStr = v => typeof v === 'string';
  const isFn  = v => typeof v === 'function';
  const isNum = v => typeof v === 'number' && !Number.isNaN(v);

  U.Type = { isArr, isObj, isStr, isFn, isNum };

  // ---------------------------------------------------------------------------
  // Num — أعداد ومرافق حسابية
  // ---------------------------------------------------------------------------
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const between = (v, min, max) => v >= min && v <= max;
  const round = (v, p = 0) => { const m = Math.pow(10, p|0); return Math.round((+v) * m) / m; };
  const randomInt = (min, max) => Math.floor(min + Math.random() * (max - min + 1));

  U.Num = { clamp, between, round, randomInt };

  // ---------------------------------------------------------------------------
  // Color — تحويلات ألوان بسيطة
  // ---------------------------------------------------------------------------
  let colorCanvas = null;
  let colorCtx = null;
  if (typeof document !== 'undefined' && typeof document.createElement === 'function'){
    colorCanvas = document.createElement('canvas');
    colorCanvas.width = colorCanvas.height = 1;
    colorCtx = colorCanvas.getContext && colorCanvas.getContext('2d');
  }
  const clampByte = (v) => Math.max(0, Math.min(255, v|0));
  const byteToHex = (v) => clampByte(v).toString(16).padStart(2, '0');
  const toHex = (value) => {
    if (value == null) return null;
    const str = String(value).trim();
    if (!str) return null;
    if (/^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(str)) return str;
    if (!colorCtx) return null;
    try {
      colorCtx.fillStyle = '#000000';
      colorCtx.fillStyle = str;
      const normalized = colorCtx.fillStyle;
      if (/^#[0-9a-f]{6}$/i.test(normalized) || /^#[0-9a-f]{8}$/i.test(normalized)) return normalized;
      const match = normalized.match(/^rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([0-9.]+))?\)$/);
      if (match){
        const r = clampByte(parseInt(match[1], 10));
        const g = clampByte(parseInt(match[2], 10));
        const b = clampByte(parseInt(match[3], 10));
        if (match[4] != null){
          const alpha = Math.max(0, Math.min(1, parseFloat(match[4])));
          const a = Math.round(alpha * 255);
          return `#${byteToHex(r)}${byteToHex(g)}${byteToHex(b)}${a < 255 ? byteToHex(a) : ''}`;
        }
        return `#${byteToHex(r)}${byteToHex(g)}${byteToHex(b)}`;
      }
      return normalized;
    } catch (_err){
      return null;
    }
  };

  U.Color = { toHex };

  // ---------------------------------------------------------------------------
  // Time — وقت وتأخير
  // ---------------------------------------------------------------------------
  const now = () => Date.now();
  const ts = () => new Date().toISOString();
  const fmt = (d, opts) => new Intl.DateTimeFormat(undefined, opts || { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }).format(d instanceof Date ? d : new Date(d));
  const sleep = ms => new Promise(r => setTimeout(r, ms|0));

  U.Time = { now, ts, fmt, sleep };

  // ---------------------------------------------------------------------------
  // Control — تدفّق وتنظيم محاولات/زمن
  // ---------------------------------------------------------------------------
  const once = fn => { let c=false, val; return (...a)=>{ if(!c){ c=true; val = fn(...a) } return val; } };
  const nextTick = fn => Promise.resolve().then(fn);
  const debounce = (fn, wait=250) => { let t; return (...args)=>{ clearTimeout(t); t = setTimeout(()=>fn(...args), wait); } };
  const throttle = (fn, wait=250) => { let last=0, pend=null, timer=null; const run=a=>{ last=Date.now(); pend=null; fn(...a) }; return (...a)=>{ const now=Date.now(), rem=wait-(now-last); if(rem<=0) run(a); else { pend=a; clearTimeout(timer); timer=setTimeout(()=>run(pend), rem); } } };
  const retry = async (fn, { tries=3, base=300, factor=2, jitter=true }={}) => { let a=0, d=base; for(;;){ try{ return await fn(); } catch(e){ a++; if(a>=tries) throw e; const j = jitter ? Math.floor(d*(0.8+Math.random()*0.4)) : d; await sleep(j); d*=factor; } } };

  U.Control = { once, nextTick, debounce, throttle, retry };

  // ---------------------------------------------------------------------------
  // JSON — JSON آمن وثابت
  // ---------------------------------------------------------------------------
  const parseSafe = (s, def=null) => { try{ return JSON.parse(String(s)); } catch(_){ return def; } };
  const stableStringify = (obj) => { const seen = new WeakSet(); const f = x => { if (x && typeof x === 'object') { if (seen.has(x)) return '"[Circular]"'; seen.add(x); if (Array.isArray(x)) return '['+ x.map(f).join(',') +']'; const keys = Object.keys(x).sort(); return '{' + keys.map(k => JSON.stringify(k)+':'+f(x[k])).join(',') + '}'; } return JSON.stringify(x); }; return f(obj); };
  const clone = (x) => (typeof structuredClone === 'function') ? structuredClone(x) : parseSafe(JSON.stringify(x));

  U.JSON = { parseSafe, stableStringify, clone };

  // ---------------------------------------------------------------------------
  // Data — بنى بيانات عامة
  // ---------------------------------------------------------------------------
  const deepEqual = (a, b) => {
    if (a === b) return true;
    if (typeof a !== typeof b) return false;
    if (isArr(a) && isArr(b)) { if (a.length !== b.length) return false; for (let i=0;i<a.length;i++) if (!deepEqual(a[i], b[i])) return false; return true; }
    if (isObj(a) && isObj(b)) { const ka=Object.keys(a), kb=Object.keys(b); if (ka.length !== kb.length) return false; for (const k of ka) if (!deepEqual(a[k], b[k])) return false; return true; }
    return false;
  };
  const deepMerge = (t, s) => { if (!isObj(t) || !isObj(s)) return s; const o = { ...t }; for (const k of Object.keys(s)) o[k] = isObj(s[k]) && isObj(t[k]) ? deepMerge(t[k], s[k]) : s[k]; return o; };
  const pick = (obj, keys) => { const o={}; for (const k of keys) if (k in obj) o[k]=obj[k]; return o; };
  const omit = (obj, keys) => { const s=new Set(keys); const o={}; for (const k in obj) if (!s.has(k)) o[k]=obj[k]; return o; };
  const getPath = (obj, path, def) => { const ks=String(path).split('.'); let cur=obj; for (const k of ks){ if(cur && typeof cur==='object' && k in cur) cur=cur[k]; else return def; } return cur; };
  const setPath = (obj, path, val) => { const ks=String(path).split('.'); let cur=obj; for(let i=0;i<ks.length-1;i++){ const k=ks[i]; if(!isObj(cur[k])) cur[k]={}; cur=cur[k]; } cur[ks[ks.length-1]]=val; return obj; };
  const hasPath = (obj, path) => getPath(obj, path, Symbol.for('m.na')) !== Symbol.for('m.na');
  const defaults = (obj, def) => deepMerge(def, obj);
  const coalesce = (...vals) => vals.find(v => v!=null);
  const ensureArray = v => isArr(v) ? v : v==null ? [] : [v];
  const isEmptyObj = o => isObj(o) && Object.keys(o).length===0;

  U.Data = { deepEqual, deepMerge, pick, omit, getPath, setPath, hasPath, defaults, coalesce, ensureArray, isEmptyObj };

  // ---------------------------------------------------------------------------
  // Array — أدوات مصفوفات عملية
  // ---------------------------------------------------------------------------
  const uniqueBy = (arr, key) => { const set=new Set(); const out=[]; for(const it of arr){ const k=isFn(key)? key(it): it[key]; if(!set.has(k)){ set.add(k); out.push(it); } } return out; };
  const groupBy = (arr, key) => { const out={}; for(const it of arr){ const k=isFn(key)? key(it): it[key]; (out[k]||(out[k]=[])).push(it); } return out; };
  const sortBy = (arr, key, dir='asc') => { const a=arr.slice(); const g=isFn(key)? key: (x=>x[key]); a.sort((x,y)=>{ const dx=g(x), dy=g(y); if(dx<dy) return dir==='asc'?-1:1; if(dx>dy) return dir==='asc'?1:-1; return 0; }); return a; };
  const chunk = (arr, size) => { const out=[]; for(let i=0;i<arr.length;i+=size) out.push(arr.slice(i,i+size)); return out; };
  const range = (n, s=0) => Array.from({length:n}, (_,i)=> i+s);
  const sum = arr => arr.reduce((a,b)=> a+(+b||0), 0);
  const avg = arr => arr.length ? sum(arr)/arr.length : 0;
  const median = arr => { const a=arr.map(Number).filter(n=>!Number.isNaN(n)).sort((x,y)=>x-y); const l=a.length; if(!l) return 0; const m=Math.floor(l/2); return l%2? a[m] : (a[m-1]+a[m])/2; };
  const flatten = arr => arr.flat ? arr.flat(Infinity) : arr.reduce((a,b)=> a.concat(isArr(b)? flatten(b): b), []);
  const compact = arr => arr.filter(Boolean);

  U.Array = { uniqueBy, groupBy, sortBy, chunk, range, sum, avg, median, flatten, compact };

  // ---------------------------------------------------------------------------
  // Id — معرّفات
  // ---------------------------------------------------------------------------
  const uuid = () => { const b=new Uint8Array(16); crypto.getRandomValues(b); b[6]=(b[6]&0x0f)|0x40; b[8]=(b[8]&0x3f)|0x80; const h=[...b].map(x=>x.toString(16).padStart(2,'0')); return `${h[0]}${h[1]}${h[2]}${h[3]}-${h[4]}${h[5]}-${h[6]}${h[7]}-${h[8]}${h[9]}-${h[10]}${h[11]}${h[12]}${h[13]}${h[14]}${h[15]}`; };
  const uid = (prefix='id') => `${prefix}-${Math.random().toString(36).slice(2,9)}`;

  U.Id = { uuid, uid };

  // ---------------------------------------------------------------------------
  // Crypto — تشفير خفيف
  // ---------------------------------------------------------------------------
  const sha256 = async s => { const enc=new TextEncoder().encode(String(s)); const buf=await crypto.subtle.digest('SHA-256', enc); return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join(''); };

  const base64 = {
  encode(str) {
    const bytes = new TextEncoder().encode(String(str));
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  },
  decode(b64) {
    const bin = atob(String(b64));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  },
  encodeBytes(uint8) {
    let bin = "";
    for (let i = 0; i < uint8.length; i++) bin += String.fromCharCode(uint8[i]);
    return btoa(bin);
  },
  decodeBytes(b64) {
    const bin = atob(String(b64));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  },
  // URL-safe Base64 helpers
  encodeURL(str) {
    return base64.encode(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/,"");
  },
  decodeURL(b64url) {
    let s = String(b64url).replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    return base64.decode(s);
  },
  // مكافئات "one-liner" بدون escape/unescape
  utf8Enc: (s) => base64.encode(s),
  utf8Dec: (s) => base64.decode(s)
};

  // تجميع تحت مساحة الأسماء
  U.Crypto = { sha256, base64 };


  // ---------------------------------------------------------------------------
  // QS — Query String
  // ---------------------------------------------------------------------------
  const qs = {
    parse(s){ const out={}; if(!s) return out; s=String(s).replace(/^\?/,''); for(const part of s.split('&')){ if(!part) continue; const [k,v=''] = part.split('='); const key=decodeURIComponent(k.replace(/\+/g,' ')); const val=decodeURIComponent(v.replace(/\+/g,' ')); if(key in out){ const cur=out[key]; out[key]=Array.isArray(cur)? cur.concat(val): [cur,val]; } else out[key]=val; } return out; },
    stringify(obj){ const enc=x=>encodeURIComponent(String(x)); const parts=[]; for(const k in obj){ const v=obj[k]; if(v==null) continue; if(Array.isArray(v)) for(const it of v) parts.push(`${enc(k)}=${enc(it)}`); else parts.push(`${enc(k)}=${enc(v)}`); } return parts.length? `?${parts.join('&')}` : ''; }
  };

  U.QS = qs;



  
  function createEmitter() {
    const listeners = new Map();
    return {
      on(type, fn) {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type).add(fn);
        return () => listeners.get(type)?.delete(fn);
      },
      emit(type, payload) {
        listeners.get(type)?.forEach(fn => { try { fn(payload); } catch {} });
      }
    };
  }

  // أداة: هل التخزين متاح؟
  function storageAvailable(kind) {
    try {
      const s = root[kind + 'Storage'];
      if (!s) return false;
      const t = '__mishkah_test__' + Math.random();
      s.setItem(t, '1'); s.removeItem(t);
      return true;
    } catch { return false; }
  }

  // تخزين ذاكرة بديل
  function createMemoryStorage() {
    const mem = new Map();
    return {
      getItem: k => (mem.has(k) ? mem.get(k) : null),
      setItem: (k, v) => { mem.set(k, v); },
      removeItem: k => { mem.delete(k); },
      clear: () => { mem.clear(); },
      key: i => Array.from(mem.keys())[i] ?? null,
      get length() { return mem.size; }
    };
  }

  // تحزيم القيمة مع ميتاداتا (يدعم TTL)
  function pack(value, opts) {
    const now = Date.now();
    const ttl = opts?.ttl ? Number(opts.ttl) : 0; // ms
    const exp = ttl > 0 ? now + ttl : 0;
    return JSON.stringify({ v: value, _ts: now, _exp: exp });
  }

  function unpack(json) {
    try {
      const obj = JSON.parse(json);
      return obj && typeof obj === 'object' ? obj : { v: undefined, _exp: 0 };
    } catch {
      // توافق مع قيَم قديمة محفوظة كنص خام
      return { v: json, _exp: 0 };
    }
  }
  // ---------------------------------------------------------------------------
  // Storage — Local/Session مع namespace و TTL
  // ---------------------------------------------------------------------------

  // API الأساس: namespaced storage فوق أي Storage مثل localStorage
  function createNamespacedStorage(rawStorage, ns, emitter) {
    const prefix = String(ns || 'mishkah');

    function fullKey(k) { return prefix + ':' + k; }

    function isExpired(meta) {
      const exp = Number(meta?._exp || 0);
      return exp > 0 && Date.now() > exp;
    }

    function get(k, def) {
      const fk = fullKey(k);
      const raw = rawStorage.getItem(fk);
      if (raw == null) return def;
      const meta = unpack(raw);
      if (isExpired(meta)) {
        rawStorage.removeItem(fk);
        emitter.emit('change', { type: 'expire', key: k, ns: prefix });
        return def;
      }
      return meta.v === undefined ? def : meta.v;
    }

    function set(k, v, opts) {
      const fk = fullKey(k);
      try {
        rawStorage.setItem(fk, pack(v, opts));
        emitter.emit('change', { type: 'set', key: k, ns: prefix, value: v, opts });
        return true;
      } catch (e) {
        emitter.emit('change', { type: 'error', key: k, ns: prefix, error: e });
        return false;
      }
    }

    function remove(k) {
      const fk = fullKey(k);
      rawStorage.removeItem(fk);
      emitter.emit('change', { type: 'remove', key: k, ns: prefix });
    }

    function has(k) {
      return get(k, '__@@__miss') !== '__@@__miss';
    }

    function keys() {
      const out = [];
      for (let i = 0; i < rawStorage.length; i++) {
        const k = rawStorage.key(i);
        if (k && k.startsWith(prefix + ':')) out.push(k.slice(prefix.length + 1));
      }
      return out;
    }

    function entries() {
      return keys().map(k => [k, get(k)]);
    }

    function values() {
      return entries().map(p => p[1]);
    }

    function clear() {
      keys().forEach(remove);
      emitter.emit('change', { type: 'clear', ns: prefix });
    }

    function sizeBytes() {
      let total = 0;
      for (let i = 0; i < rawStorage.length; i++) {
        const k = rawStorage.key(i);
        if (!k || !k.startsWith(prefix + ':')) continue;
        const v = rawStorage.getItem(k) || '';
        total += (k.length + v.length) * 2; // UTF-16 تقديري
      }
      return total;
    }

    function batchSet(obj, opts) {
      for (const k in obj) set(k, obj[k], opts);
    }

    function withPrefix(sub) {
      return createNamespacedStorage(rawStorage, prefix + ':' + sub, emitter);
    }

    // وصول خام (لو احتجت)
    function getRaw(k) { return rawStorage.getItem(fullKey(k)); }
    function setRaw(k, rawString) {
      rawStorage.setItem(fullKey(k), rawString);
      emitter.emit('change', { type: 'setRaw', key: k, ns: prefix });
    }

    // واجهة الأحداث
    function on(ev, fn) { return emitter.on(ev, fn); }

    return {
      // أساسيات
      get, set, remove, has,
      // مجموعات
      keys, entries, values, clear, batchSet,
      // أدوات
      withPrefix, sizeBytes,
      // خام
      getRaw, setRaw,
      // أحداث
      on
    };
  }

  // بناء Storage موحّد (local/session) مع Fallback
  const emitter = createEmitter();

  function make(kind, defaultNs) {
    const available = storageAvailable(kind);
    const raw = available ? root[kind + 'Storage'] : createMemoryStorage();
    return function (ns = defaultNs) {
      return createNamespacedStorage(raw, ns, emitter);
    };
  }

  // لا نكسر الموجود لو موجود مسبقاً
  U.Storage = Object.assign({}, U.Storage, {
    local:   make('local',   'mishkah'),
    session: make('session', 'mishkah:session'),
    // اشتراك على مستوى كل المخازن لو تحب
    on: emitter.on
  });

  // ---------------------------------------------------------------------------
  // Cookie — إدارة الكوكيز
  // ---------------------------------------------------------------------------
  const setCookie = (name, value, { days=7, path='/', domain, sameSite='Lax', secure }={}) => {
    const d = new Date(); d.setTime(d.getTime() + days*24*60*60*1000);
    let str = `${encodeURIComponent(name)}=${encodeURIComponent(value)};expires=${d.toUTCString()};path=${path}`;
    if (domain) str += `;domain=${domain}`;
    if (sameSite) str += `;samesite=${sameSite}`;
    if (secure) str += `;secure`;
    document.cookie = str;
  };
  const getCookie = (name) => { const m = document.cookie.match(new RegExp('(^| )'+encodeURIComponent(name)+'=([^;]+)')); return m ? decodeURIComponent(m[2]) : null; };
  const delCookie = (name, path='/', domain) => { setCookie(name, '', { days:-1, path, domain }); };

  U.Cookie = { set: setCookie, get: getCookie, remove: delCookie };

  // ---------------------------------------------------------------------------
  // Net — Ajax/Fetch قوي، مع JSON/timeout/retry و client builder
  // ---------------------------------------------------------------------------
  class HttpError extends Error { constructor(status, message, response){ super(`HTTP ${status} ${message||''}`.trim()); this.name='HttpError'; this.status=status; this.response=response; } }

  const buildURL = (url, query) => {
    if (!query || (isObj(query) && Object.keys(query).length===0)) return url;
    const usp = new URLSearchParams();
    for (const k in query) {
      const v = query[k];
      if (v == null) continue;
      if (Array.isArray(v)) v.forEach(x => usp.append(k, String(x))); else usp.append(k, String(v));
    }
    const sep = url.includes('?') ? '&' : '?';
    return url + sep + usp.toString();
  };

  const parseByType = async (res, responseType) => {
    if (responseType === 'json') return res.json();
    if (responseType === 'text') return res.text();
    if (responseType === 'blob') return res.blob();
    if (responseType === 'arrayBuffer') return res.arrayBuffer();
    if (responseType === 'formData') return res.formData();
    const ct = (res.headers.get('content-type')||'').toLowerCase();
    if (ct.includes('application/json')) return res.json();
    if (ct.includes('text/')) return res.text();
    if (ct.includes('application/octet-stream')) return res.arrayBuffer();
    if (ct.includes('multipart/') || ct.includes('form-data')) return res.formData();
    return res.blob();
  };

  const ajax = async (url, opt={}) => {
    const {
      method='GET', headers={}, query=null, body,
      timeout=0, withCredentials=false, responseType=null,
      retry: rConf = 0, retryBase=300, retryFactor=2, retryJitter=true,
      signal
    } = opt;

    const run = async () => {
      const full = buildURL(url, query);
      const ctrl = new AbortController();
      const to = timeout>0 ? setTimeout(()=>ctrl.abort(), timeout) : null;
      const wantJSON = isObj(body) && !headers['Content-Type'] && !headers['content-type'];
      const h = wantJSON
        ? { 'Content-Type':'application/json', 'Accept':'application/json, text/plain, */*', ...headers }
        : { 'Accept':'application/json, text/plain, */*', ...headers };
      const b = isObj(body) && h['Content-Type']==='application/json' ? JSON.stringify(body) : body;

      // merge external signal
      if (signal) {
        if (signal.aborted) ctrl.abort(); else signal.addEventListener('abort', ()=> ctrl.abort(), { once:true });
      }

      try {
        const res = await fetch(full, { method, headers:h, body:b, credentials: withCredentials ? 'include' : 'same-origin', signal: ctrl.signal });
        if (to) clearTimeout(to);
        if (!res.ok) {
          let msg = res.statusText || '';
          try { const j = await res.clone().json(); msg = j?.message || msg; } catch(_){}
          throw new HttpError(res.status, msg, res);
        }
        return parseByType(res, responseType);
      } finally { if (to) clearTimeout(to); }
    };

    if (!rConf) return run();
    const tries = isNum(rConf) ? rConf : (rConf.tries||3);
    return retry(run, { tries, base: retryBase, factor: retryFactor, jitter: retryJitter });
  };

  const methods = ['GET','POST','PUT','PATCH','DELETE','HEAD'];
  const Net = { ajax };
  methods.forEach(M => {
    Net[M.toLowerCase()] = (url, opt={}) => ajax(url, { ...opt, method:M });
  });

  Net.client = (base, baseHeaders={}) => {
    const req = (path, opt={}) => ajax(String(base).replace(/\/$/, '') + '/' + String(path).replace(/^\//,''), { ...opt, headers: { ...baseHeaders, ...(opt.headers||{}) } });
    const api = { request: req };
    methods.forEach(M => { api[M.toLowerCase()] = (p, opt={}) => req(p, { ...opt, method:M }); });
    return api;
  };

  Net.form = (obj) => { const fd = new FormData(); const push=(k,v)=> fd.append(k, v==null?'': String(v)); const walk=(p, v)=>{ if (v==null) { push(p,''); } else if (v instanceof Blob || v instanceof File) { fd.append(p, v); } else if (Array.isArray(v)) { v.forEach((it,i)=> walk(`${p}[${i}]`, it)); } else if (typeof v==='object') { for (const k in v) walk(`${p}.${k}`, v[k]); } else push(p, v); }; for (const k in obj) walk(k, obj[k]); return fd; };

  U.Net = Net;
  U.HttpError = HttpError;

  // Back-compat اختياري (يمكن حذفه لاحقاً):
  U.ajax = ajax;

  // ---------------------------------------------------------------------------
  // IO — تفاعلات نسخ/تحميل بسيطة
  // ---------------------------------------------------------------------------
  const copyText = async (text) => { try { await navigator.clipboard.writeText(String(text)); return true; } catch (_) { const ta=document.createElement('textarea'); ta.value=String(text); ta.style.position='fixed'; ta.style.top='-1000px'; document.body.appendChild(ta); ta.select(); let ok=false; try{ ok=document.execCommand('copy'); } catch(_){ ok=false; } document.body.removeChild(ta); return ok; } };
  const download = (data, filename='file.txt', mime='application/octet-stream') => { const blob = data instanceof Blob ? data : new Blob([data], { type:mime }); const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); };

  U.IO = { copyText, download };

  // ---------------------------------------------------------------------------
  // DOM — مساعدات تركيز ولمسات بصرية
  // ---------------------------------------------------------------------------
  const focusById = (id, { scroll=true }={}) => {
    if (typeof document === 'undefined') return false;
    const el = document.getElementById(id);
    if (!el) return false;
    try { if (typeof el.focus === 'function') el.focus({ preventScroll: !scroll }); }
    catch (_err) { /* ignore */ }
    if (scroll && typeof el.scrollIntoView === 'function'){
      try { el.scrollIntoView({ behavior:'smooth', block:'center' }); }
      catch(_err){ /* ignore */ }
    }
    return true;
  };

  const flashClass = (id, className, duration=1500) => {
    if (typeof document === 'undefined') return false;
    const el = document.getElementById(id);
    if (!el || !className) return false;
    el.classList.add(className);
    if (duration > 0){
      setTimeout(()=>{
        try { el.classList.remove(className); }
        catch(_err){ /* ignore */ }
      }, duration);
    }
    return true;
  };

  U.DOM = { focusById, flashClass };

  // ---------------------------------------------------------------------------
  // Cache — واجهة بسيطة على Cache API (اختياري)
  // ---------------------------------------------------------------------------
  const Cache = {
    async get(name, req, fetcher){ if(!('caches' in window)) throw new Error('Cache API not available'); const c=await caches.open(name); const key= typeof req==='string'? new Request(req): req; const hit=await c.match(key); if(hit) return hit.clone(); const res = fetcher? await fetcher(key) : await fetch(key); if(res && res.ok) await c.put(key, res.clone()); return res.clone(); },
    async put(name, req, res){ if(!('caches' in window)) throw new Error('Cache API not available'); const c=await caches.open(name); await c.put(req, res); return true; },
    async del(name, req){ if(!('caches' in window)) throw new Error('Cache API not available'); const c=await caches.open(name); return c.delete(req); },
    async clear(name){ if(!('caches' in window)) throw new Error('Cache API not available'); const keys=await caches.keys(); for(const k of keys){ if(!name || k===name) await caches.delete(k); } }
  };

  U.Cache = Cache;
// — i18n helpers (محليّة للصفحة)
const __i18nCache = new WeakMap();

function buildLangTables(dict) {
  if (!dict || typeof dict !== 'object') return {};
  if (__i18nCache.has(dict)) return __i18nCache.get(dict);
  const tables = {};
  for (const key of Object.keys(dict)) {
    const row = dict[key];
    if (!row || typeof row !== 'object') continue;
    for (const L of Object.keys(row)) {
      (tables[L] || (tables[L] = {}))[key] = row[L];
    }
  }
  __i18nCache.set(dict, tables);
  return tables;
}

function makeLangLookup(db) {
  const dict = db?.i18n?.dict || {};
  const langs = buildLangTables(dict);
  const fallback = db?.i18n?.fallback || 'en';
  const current  = db?.env?.lang || db?.i18n?.lang || fallback;

  const TL = (key) => {
    const v = langs[current]?.[key];
    if (v != null && v !== '') return String(v);
    const vEn = langs[fallback]?.[key];
    return vEn != null && vEn !== '' ? String(vEn) : String(key);
  };

  return { TL, langs, current, fallback };
}
 U.lang ={buildLangTables,makeLangLookup}
 
 
 
  // ---------------------------------------------------------------------------
  // التسجيل تحت Mishkah.utils (دمج دون استبدال)
  // ---------------------------------------------------------------------------
  window.Mishkah = window.Mishkah || {};
  window.Mishkah.utils = Object.assign({}, window.Mishkah.utils || {}, U);

})(window);



//utils-indexeddb.js

(function (root, factory) {
  if (typeof define === 'function' && define.amd) define(['exports'], function (e) { factory(root, e) });
  else if (typeof module === 'object' && module.exports) factory(root, module.exports);
  else {
    root.Mishkah = root.Mishkah || {};
    root.Mishkah.utils = root.Mishkah.utils || {};
    factory(root, root.Mishkah.utils);
  }
})(typeof self !== 'undefined' ? self : this, function (g, target) {
  const isFn = v => typeof v === 'function';
  const isArr = Array.isArray;
  const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
  const toArr = v => v == null ? [] : (isArr(v) ? v : [v]);
  const now = () => Date.now();
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const canListDbs = !!(g.indexedDB && g.indexedDB.databases);

  class DBError extends Error { constructor(m, meta) { super(m); this.name = 'DBError'; if (meta) Object.assign(this, meta) } }
  const wrapErr = e => { if (e instanceof DBError) return e; const n = (e && e.name) || 'IDBError'; const m = (e && e.message) || String(e); return new DBError(m, { code: n, cause: e }) };
  const reqp = req => new Promise((res, rej) => { req.onsuccess = e => res(e.target.result); req.onerror = e => rej(wrapErr(e.target.error || e)) });

  const keyRange = o => {
    if (!o) return null;
    if ('only' in o) return IDBKeyRange.only(o.only);
    const lo = ('lower' in o) ? o.lower : undefined;
    const hi = ('upper' in o) ? o.upper : undefined;
    const loOpen = !!o.lowerOpen, hiOpen = !!o.upperOpen;
    if (lo == null && hi == null) return null;
    if (lo != null && hi != null) return IDBKeyRange.bound(lo, hi, loOpen, hiOpen);
    if (lo != null) return IDBKeyRange.lowerBound(lo, loOpen);
    return IDBKeyRange.upperBound(hi, hiOpen);
  };

  class TxWrap {
    constructor(tx) { this.tx = tx; this.done = new Promise((res, rej) => { tx.oncomplete = () => res(true); tx.onabort = () => rej(wrapErr(tx.error || new Error('Abort'))); tx.onerror = () => rej(wrapErr(tx.error)) }) }
    store(name) { return this.tx.objectStore(name) }
    complete() { return this.done }
  }

  const schemaVersionFromMigrations = migs => { if (!migs) return 1; const keys = Object.keys(migs).map(k => +k).filter(n => !Number.isNaN(n)); return keys.length ? Math.max(...keys) : 1 };

  const computeSchemaDiff = (db, schema) => {
    const dif = { addStores: [], delStores: [], alter: [] };
    const wanted = new Set(Object.keys(schema.stores || {}));
    for (const name of Array.from(db.objectStoreNames || [])) if (!wanted.has(name)) dif.delStores.push(name);
    for (const [name, def] of Object.entries(schema.stores || {})) {
      if (!db.objectStoreNames.contains(name)) { dif.addStores.push({ name, def }); continue }
      const tx = db.transaction([name], 'readonly');
      const os = tx.objectStore(name);
      const idxWanted = new Map((def.indices || []).map(ix => [ix.name, ix]));
      const idxExisting = new Set(Array.from(os.indexNames || []));
      const addIdx = [], delIdx = [];
      for (const nm of idxExisting) if (!idxWanted.has(nm)) delIdx.push(nm);
      for (const [nm, ix] of idxWanted) if (!idxExisting.has(nm)) addIdx.push(ix);
      if (addIdx.length || delIdx.length) dif.alter.push({ name, addIdx, delIdx });
    }
    return dif;
  };

  const applySchema = (db, tx, schema, migrations, oldVersion, newVersion, strict) => {
    const stores = (schema && schema.stores) ? schema.stores : {};
    for (const [name, def] of Object.entries(stores)) {
      const exists = db.objectStoreNames.contains(name);
      if (!exists) {
        const os = db.createObjectStore(name, { keyPath: def.keyPath, autoIncrement: !!def.autoIncrement });
        toArr(def.indices).forEach(ix => { if (ix && ix.name) os.createIndex(ix.name, ix.keyPath, Object.assign({ unique: false, multiEntry: false }, ix.options || {})) });
      } else {
        const os = tx.objectStore(name);
        if (def.indices) {
          const existing = new Set(Array.from(os.indexNames || []));
          const wanted = new Map(def.indices.map(ix => [ix.name, ix]));
          for (const nm of existing) if (!wanted.has(nm)) os.deleteIndex(nm);
          for (const [nm, ix] of wanted) if (!existing.has(nm)) os.createIndex(ix.name, ix.keyPath, Object.assign({ unique: false, multiEntry: false }, ix.options || {}));
        }
      }
    }
    if (strict) for (const name of Array.from(db.objectStoreNames || [])) if (!stores[name]) db.deleteObjectStore(name);
    if (migrations) {
      const keys = Object.keys(migrations).map(k => +k).filter(n => !Number.isNaN(n)).sort((a, b) => a - b);
      for (const v of keys) if (v > oldVersion && v <= newVersion) { const fn = migrations[v]; if (isFn(fn)) fn(db, oldVersion, newVersion, tx) }
    }
  };

  class IndexedDBX {
    constructor(cfg) {
      const o = cfg || {};
      this.name = o.name || o.dbName || 'app-db';
      this.schema = o.schema || { stores: {} };
      this.migrations = o.migrations || {};
      this.initialVersion = o.version || Math.max(1, schemaVersionFromMigrations(this.migrations));
      this.autoBump = o.autoBumpVersion !== false;
      this.strict = !!o.strictSchema;
      this.onBlocked = o.onBlocked;
      this.onUpgradeStart = o.onUpgradeStart;
      this.onUpgradeEnd = o.onUpgradeEnd;
      this.onVersionChange = o.onVersionChange;
      this.broadcast = o.broadcast !== false;
      this.db = null;
      this.version = this.initialVersion;
      this.closed = false;
      this.channel = null;
      if (this.broadcast && 'BroadcastChannel' in g) try { this.channel = new BroadcastChannel('idb:' + this.name) } catch (_) {}
      this.listeners = new Map();
      this._instrumented = false;
    }

    async currentVersion() {
      if (canListDbs) { try { const list = await g.indexedDB.databases(); const entry = (list || []).find(d => d.name === this.name); return entry && entry.version ? entry.version : 0 } catch (_) { return 0 } }
      try {
        return await new Promise((res, rej) => { const r = g.indexedDB.open(this.name); r.onsuccess = e => { const d = e.target.result; const v = d.version; d.close(); res(v) }; r.onerror = e => rej(wrapErr(e.target.error || e)) })
      } catch (_) { return 0 }
    }

    async open() {
      if (this.db) return this.db;
      let ver = Math.max(this.initialVersion, await this.currentVersion() || 1);
      let attempt = 0;
      for (;;) {
        attempt++;
        try {
          const db = await this._openVersion(ver);
          this.db = db; this.version = db.version; this.closed = false;
          if (this.channel) this.channel.onmessage = e => { const m = e && e.data; if (m && m.t === 'change') this.emit('change', m.d) };
          return db;
        } catch (err) {
          const e = wrapErr(err);
          const code = e.code || e.name;
          if ((code === 'VersionError' || code === 'InvalidStateError') && this.autoBump && attempt < 6) { ver = ver + 1; await sleep(40 * attempt); continue }
          if (code === 'QuotaExceededError') throw new DBError('IndexedDB quota exceeded', { code, hint: 'Free storage or reduce data size' });
          throw e;
        }
      }
    }

    _openVersion(version) {
      return new Promise((resolve, reject) => {
        const req = g.indexedDB.open(this.name, version);
        req.onblocked = () => { if (isFn(this.onBlocked)) try { this.onBlocked({ reason: 'blocked', name: this.name, version }) } catch (_) {} };
        req.onupgradeneeded = e => {
          const db = e.target.result; const oldV = e.oldVersion || 0; const newV = e.newVersion || version; const tx = e.target.transaction;
          if (isFn(this.onUpgradeStart)) try { this.onUpgradeStart({ db, oldVersion: oldV, newVersion: newV }) } catch (_) {}
          try { applySchema(db, tx, this.schema, this.migrations, oldV, newV, this.strict) } catch (er) { reject(wrapErr(er)); return }
          if (isFn(this.onUpgradeEnd)) try { this.onUpgradeEnd({ db, oldVersion: oldV, newVersion: newV }) } catch (_) {}
        };
        req.onerror = e => reject(wrapErr(e.target.error || e));
        req.onsuccess = e => {
          const db = e.target.result;
          db.onversionchange = () => { try { if (isFn(this.onVersionChange)) this.onVersionChange({ reason: 'versionchange' }) } catch (_) {} try { db.close(); this.db = null; this.closed = true } catch (_) {} };
          resolve(db);
        };
      });
    }

    async ensureSchema() {
      const db = await this.open();
      const dif = computeSchemaDiff(db, Object.assign({}, this.schema, { stores: this.schema.stores || {} }));
      const needs = dif.addStores.length || dif.delStores.length || dif.alter.length;
      if (!needs) return false;
      const nextV = db.version + 1;
      db.close(); this.db = null;
      await new Promise((res, rej) => {
        const req = g.indexedDB.open(this.name, nextV);
        req.onupgradeneeded = e => {
          const updb = e.target.result; const oldV = e.oldVersion || db.version; const newV = e.newVersion || nextV; const tx = e.target.transaction;
          if (isFn(this.onUpgradeStart)) try { this.onUpgradeStart({ db: updb, oldVersion: oldV, newVersion: newV }) } catch (_) {}
          try { applySchema(updb, tx, Object.assign({}, this.schema, { strict: this.strict }), this.migrations, oldV, newV, this.strict) } catch (er) { rej(wrapErr(er)); return }
          if (isFn(this.onUpgradeEnd)) try { this.onUpgradeEnd({ db: updb, oldVersion: oldV, newVersion: newV }) } catch (_) {}
        };
        req.onerror = e => rej(wrapErr(e.target.error || e));
        req.onsuccess = e => { const updb = e.target.result; updb.close(); res(true) };
      });
      return true;
    }

    close() { if (this.db) { try { this.db.close() } catch (_) {} this.db = null; this.closed = true } }
    async destroy() { this.close(); await new Promise((res, rej) => { const del = g.indexedDB.deleteDatabase(this.name); del.onsuccess = () => res(true); del.onerror = e => rej(wrapErr(e.target.error || e)); del.onblocked = () => res(true) }); return true }

    tx(stores, mode = 'readonly') { return this.open().then(db => new TxWrap(db.transaction(toArr(stores), mode))) }

    async run(stores, mode, fn) {
      let tw;
      try {
        tw = await this.tx(stores, mode);
        const out = await Promise.resolve(fn(tw));
        await tw.complete();
        return out;
      } catch (err) {
        try { if (tw && tw.tx) tw.tx.abort() } catch (_) {}
        throw wrapErr(err);
      }
    }

    store(name, mode = 'readonly') { return this.tx(name, mode).then(tw => tw.store(name)) }

    get(store, key) { return this.run(store, 'readonly', tw => reqp(tw.store(store).get(key))) }

    getAll(store, query, count) {
      return this.run(store, 'readonly', tw => {
        const os = tw.store(store); const qr = keyRange(query);
        if ('getAll' in os) return reqp(os.getAll(qr, count));
        return new Promise((res, rej) => {
          const out = []; const cur = os.openCursor(qr);
          cur.onsuccess = e => { const c = e.target.result; if (c) { out.push(c.value); c.continue() } else res(out) };
          cur.onerror = e => rej(wrapErr(e.target.error || e));
        });
      });
    }

    getAllKeys(store, query, count) {
      return this.run(store, 'readonly', tw => {
        const os = tw.store(store); const qr = keyRange(query);
        if ('getAllKeys' in os) return reqp(os.getAllKeys(qr, count));
        return new Promise((res, rej) => {
          const out = []; const cur = os.openKeyCursor(qr);
          cur.onsuccess = e => { const c = e.target.result; if (c) { out.push(c.primaryKey); c.continue() } else res(out) };
          cur.onerror = e => rej(wrapErr(e.target.error || e));
        });
      });
    }

    count(store, query) { return this.run(store, 'readonly', tw => reqp(tw.store(store).count(keyRange(query)))) }

    add(store, value, key) { return this.run(store, 'readwrite', tw => reqp(tw.store(store).add(value, key))) }
    put(store, value, key) { return this.run(store, 'readwrite', tw => reqp(tw.store(store).put(value, key))) }

    upsert(store, key, updater) {
      return this.run(store, 'readwrite', async tw => {
        const os = tw.store(store); const cur = await reqp(os.get(key));
        const val = typeof updater === 'function' ? await updater(cur || null) : updater;
        return reqp(os.put(val, key));
      });
    }

    patch(store, key, patch) {
      return this.run(store, 'readwrite', async tw => {
        const os = tw.store(store); const cur = await reqp(os.get(key));
        const next = Object.assign({}, cur || {}, (typeof patch === 'function' ? patch(cur || {}) : patch) || {});
        return reqp(os.put(next));
      });
    }

    delete(store, key) { return this.run(store, 'readwrite', tw => reqp(tw.store(store).delete(key))) }
    clear(store) { return this.run(store, 'readwrite', tw => reqp(tw.store(store).clear())) }

    bulkAdd(store, values, chunk = 500) {
      const vs = toArr(values || []);
      return this.run(store, 'readwrite', async tw => {
        const os = tw.store(store);
        for (let i = 0; i < vs.length; i++) { await reqp(os.add(vs[i])); if (i % chunk === 0) await sleep(0) }
        return true;
      });
    }

    bulkPut(store, values, chunk = 500) {
      const vs = toArr(values || []);
      return this.run(store, 'readwrite', async tw => {
        const os = tw.store(store);
        for (let i = 0; i < vs.length; i++) { await reqp(os.put(vs[i])); if (i % chunk === 0) await sleep(0) }
        return true;
      });
    }

    bulkDelete(store, keys, chunk = 800) {
      const ks = toArr(keys || []);
      return this.run(store, 'readwrite', async tw => {
        const os = tw.store(store);
        for (let i = 0; i < ks.length; i++) { await reqp(os.delete(ks[i])); if (i % chunk === 0) await sleep(0) }
        return true;
      });
    }

    byIndex(store, index, query, dir = 'next') {
      return this.run(store, 'readonly', tw => {
        const os = tw.store(store); const idx = os.index(index);
        return new Promise((res, rej) => {
          const out = []; const cur = idx.openCursor(keyRange(query), dir);
          cur.onsuccess = e => { const c = e.target.result; if (c) { out.push(c.value); c.continue() } else res(out) };
          cur.onerror = e => rej(wrapErr(e.target.error || e));
        });
      });
    }

    firstByIndex(store, index, query, dir = 'next') {
      return this.run(store, 'readonly', tw => {
        const os = tw.store(store); const idx = os.index(index);
        return new Promise((res, rej) => {
          const cur = idx.openCursor(keyRange(query), dir);
          cur.onsuccess = e => { const c = e.target.result; if (c) res(c.value); else res(null) };
          cur.onerror = e => rej(wrapErr(e.target.error || e));
        });
      });
    }

    query(store) {
      const ctx = { store, index: null, range: null, dir: 'next', limit: null, map: null, filter: null, offset: 0 };
      const api = {
        where(ix, rng) { ctx.index = ix || null; ctx.range = rng || null; return api },
        direction(d) { ctx.dir = d || 'next'; return api },
        take(n) { ctx.limit = n | 0; return api },
        skip(n) { ctx.offset = n | 0; return api },
        select(fn) { ctx.map = fn; return api },
        filter(fn) { ctx.filter = fn; return api },
        async toArray() { return await (ctx.index ? this._viaIndex() : this._viaStore()) },
        async _viaStore() { return await this._scan(ctx, tw => tw.store(ctx.store).openCursor(keyRange(ctx.range), ctx.dir)) },
        async _viaIndex() { return await this._scan(ctx, tw => tw.store(ctx.store).index(ctx.index).openCursor(keyRange(ctx.range), ctx.dir)) }
      };
      return api;
    }

    async _scan(ctx, cursorFactory) {
      return this.run(ctx.store, 'readonly', tw => new Promise((res, rej) => {
        const out = []; let skipped = 0; let cursor;
        try { cursor = cursorFactory(tw) } catch (e) { rej(wrapErr(e)); return }
        cursor.onsuccess = e => {
          const c = e.target.result;
          if (!c) return res(out);
          const v = c.value;
          if (ctx.filter && !ctx.filter(v)) return c.continue();
          if (skipped < (ctx.offset || 0)) { skipped++; return c.continue() }
          out.push(ctx.map ? ctx.map(v) : v);
          if (ctx.limit && out.length >= ctx.limit) return res(out);
          c.continue();
        };
        cursor.onerror = e => rej(wrapErr(e.target.error || e));
      }));
    }

    async exportJSON(stores) {
      const names = stores && stores.length ? stores : Array.from((await this.open()).objectStoreNames || []);
      const out = { name: this.name, version: this.version, exportedAt: now(), data: {} };
      for (const s of names) out.data[s] = await this.getAll(s);
      return out;
    }

    async importJSON(payload, mode = 'upsert') {
      const data = (payload && payload.data) || {};
      const names = Object.keys(data);
      for (const s of names) {
        const rows = toArr(data[s]);
        if (mode === 'clear') await this.clear(s);
        await this.bulkPut(s, rows);
      }
      return true;
    }

    on(event, handler) { if (!this.listeners.has(event)) this.listeners.set(event, new Set()); this.listeners.get(event).add(handler); return () => this.off(event, handler) }
    off(event, handler) { const set = this.listeners.get(event); if (set) { set.delete(handler); if (!set.size) this.listeners.delete(event) } }
    emit(event, detail) { const set = this.listeners.get(event); if (set) set.forEach(fn => { try { fn(detail) } catch (_) {} }); if (this.channel) { try { this.channel.postMessage({ t: event, d: detail }) } catch (_) {} } }

    async instrumentWrites() { if (this._instrumented) return; this._instrumented = true; const db = await this.open(); db.addEventListener && db.addEventListener('close', () => { this._instrumented = false }) }

    watch(store, handler) { const h = e => { const d = e && e.store ? e : (e && e.detail ? e.detail : e); if (!d || d.store !== store) return; handler(d) }; return this.on('change', h) }

    _emitWrite(store, type, key) { this.emit('change', { store, type, key, ts: now() }) }

    async putEmit(store, value, key) { const k = await this.put(store, value, key); this._emitWrite(store, 'put', key || value?.[this.schema?.stores?.[store]?.keyPath || 'id']); return k }
    async addEmit(store, value, key) { const k = await this.add(store, value, key); this._emitWrite(store, 'add', key || value?.[this.schema?.stores?.[store]?.keyPath || 'id']); return k }
    async deleteEmit(store, key) { const k = await this.delete(store, key); this._emitWrite(store, 'delete', key); return k }

    async putWithTTL(store, value, ttlMs, key) { const v = Object.assign({}, value, { _expiresAt: now() + Math.max(0, ttlMs | 0) }); return this.putEmit(store, v, key) }
    async purgeExpired(store) { const ts = now(); const rows = await this.getAll(store); const kp = this.schema?.stores?.[store]?.keyPath || 'id'; const dead = rows.filter(x => +x._expiresAt > 0 && x._expiresAt <= ts).map(x => x[kp]); if (dead.length) await this.bulkDelete(store, dead); return dead.length }
  }

  const out = { IndexedDBX, IndexedDB: IndexedDBX, DBError };
  if (target) Object.assign(target, out);
  if (typeof module === 'object' && module.exports) Object.assign(module.exports, out);
  return out;
});


// utils-websocket.js
(function (window) {
  const M = window.Mishkah = window.Mishkah || {};
  const U = M.utils = M.utils || {};
  const hasIDBX = !!U.IndexedDBX;
  const BC = ('BroadcastChannel' in window) ? window.BroadcastChannel : null;

  class WSXError extends Error {
    constructor(message, code, hint, meta) { super(message); this.name = 'WSXError'; this.code = code || 'WSX_ERR'; this.hint = hint || ''; this.meta = meta || {}; }
  }

  const uuid = () => (U.uuid ? U.uuid() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random()*16|0, v = c==='x'? r : (r&0x3|0x8); return v.toString(16); }));
  const now = () => Date.now();

  const defaultSerialize = {
    encode: (x) => (typeof x === 'string' || x instanceof ArrayBuffer || x instanceof Blob) ? x : JSON.stringify(x),
    decode: (x) => {
      if (x == null) return x;
      if (typeof x === 'string') { try { return JSON.parse(x); } catch(_) { return x; } }
      return x;
    }
  };

  class WebSocketX {
    constructor(url, opt = {}) {
      this.url = url;
      this.protocols = opt.protocols;
      this.autoReconnect = opt.autoReconnect !== false;
      this.backoff = Object.assign({ min: 800, max: 20000, factor: 1.8, jitter: 0.3 }, opt.backoff || {});
      this._attempt = 0;

      this.serializer = opt.serializer || defaultSerialize;

      this.ping = Object.assign({ interval: 15000, send: 'ping', expect: 'pong', timeout: 6000 }, opt.ping || {});
      this._pingTimer = null;
      this._pongTimer = null;

      this.auth = Object.assign({ token: opt.token, getToken: opt.getToken, param: 'token', sendOnUrl: true }, opt.auth || {});

      this.requestTimeout = Number.isFinite(opt.requestTimeout) ? opt.requestTimeout : 15000;
      this.pending = new Map();

      this.handlers = {};
      this.topicHandlers = new Map();

      this.ws = null;
      this.state = 'idle';
      this.lastOpenTs = 0;

      this.clientId = opt.clientId || (localStorage.getItem('wsx_cid') || (localStorage.setItem('wsx_cid', uuid()), localStorage.getItem('wsx_cid')));
      this.seq = 0;
      this.lastServerSeq = 0;

      this.queueMode = Object.assign({ persist: 'memory', max: 5000, store: 'ws_outbox' }, opt.queue || {});
      this._queue = [];
      this._outboxDB = null;

      this.bc = (opt.broadcast !== false && BC) ? new BC(opt.broadcastName || 'mishkah-wsx') : null;
      if (this.bc) {
        this.bc.onmessage = (e) => {
          const msg = e.data;
          if (!msg || msg.__from === this.clientId) return;
          if (msg.type === 'wsx:incoming') this._emit('message', msg.data);
          else if (msg.type === 'wsx:state') this._emit('state', msg.data);
        };
      }

      this.interceptors = { beforeSend: [], onMessage: [] };

      if (hasIDBX && this.queueMode.persist === 'idb') {
        this._outboxDB = new U.IndexedDBX({
          name: opt.dbName || 'wsx-db',
          autoBumpVersion: true,
          schema: { stores: { [this.queueMode.store]: { keyPath: 'id', indices: [{ name: 'ts', keyPath: 'ts' }] } } }
        });
      }

      this._onlineHandler = () => { if (navigator.onLine && this.state !== 'open') this.connect({ waitOpen: false }); };
      this._offlineHandler = () => { this._emit('state', { state: 'offline' }); };
      window.addEventListener('online', this._onlineHandler);
      window.addEventListener('offline', this._offlineHandler);

      this._visHandler = () => { if (!document.hidden && this.state !== 'open') this.connect({ waitOpen: false }); if (document.hidden) this._stopHeartbeat(); else if (this.state === 'open') this._startHeartbeat(); };
      document.addEventListener('visibilitychange', this._visHandler);

      this._openPromise = null;
    }

    on(ev, fn) { (this.handlers[ev] || (this.handlers[ev] = [])).push(fn); return () => this.off(ev, fn); }
    off(ev, fn) { const a = this.handlers[ev]; if (!a) return; const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); }
    _emit(ev, data) { const a = this.handlers[ev]; if (a) for (const fn of a.slice()) try { fn(data); } catch(e) {} }

    subscribe(topic, fn) { if (!this.topicHandlers.has(topic)) this.topicHandlers.set(topic, new Set()); this.topicHandlers.get(topic).add(fn); return () => this.unsubscribe(topic, fn); }
    unsubscribe(topic, fn) { const set = this.topicHandlers.get(topic); if (!set) return; set.delete(fn); if (!set.size) this.topicHandlers.delete(topic); }

    use(what) {
      if (!what) return this;
      if (what.beforeSend) this.interceptors.beforeSend.push(what.beforeSend);
      if (what.onMessage) this.interceptors.onMessage.push(what.onMessage);
      if (what.onOpen) this.on('open', what.onOpen);
      if (what.onClose) this.on('close', what.onClose);
      if (what.onError) this.on('error', what.onError);
      return this;
    }

    async _persistEnqueue(record) {
      if (this.queueMode.persist === 'idb' && this._outboxDB) {
        await this._outboxDB.open(); await this._outboxDB.ensureSchema(); await this._outboxDB.put(this.queueMode.store, record);
      } else if (this.queueMode.persist === 'local') {
        const key = 'wsx_outbox_' + this.clientId;
        const cur = JSON.parse(localStorage.getItem(key) || '[]');
        cur.push(record);
        const max = Math.max(1, this.queueMode.max|0);
        while (cur.length > max) cur.shift();
        try { localStorage.setItem(key, JSON.stringify(cur)); } catch(_) { while (cur.length > Math.floor(max*0.8)) cur.shift(); try { localStorage.setItem(key, JSON.stringify(cur)); } catch(_) {} }
      } else {
        this._queue.push(record);
        const max = Math.max(1, this.queueMode.max|0);
        if (this._queue.length > max) this._queue.splice(0, this._queue.length - max);
      }
    }

    async _persistDrain(sendFn) {
      if (this.queueMode.persist === 'idb' && this._outboxDB) {
        await this._outboxDB.open(); await this._outboxDB.ensureSchema();
        const rows = await this._outboxDB.byIndex(this.queueMode.store, 'ts', { lower: 0 }) || [];
        for (const r of rows) { await sendFn(r.payload); await this._outboxDB.delete(this.queueMode.store, r.id); }
      } else if (this.queueMode.persist === 'local') {
        const key = 'wsx_outbox_' + this.clientId;
        const cur = JSON.parse(localStorage.getItem(key) || '[]');
        for (const r of cur) await sendFn(r.payload);
        try { localStorage.setItem(key, '[]'); } catch(_) {}
      } else {
        while (this._queue.length) { const r = this._queue.shift(); await sendFn(r.payload); }
      }
      this._emit('drain', true);
    }

    _buildUrl() {
      let u = this.url || '';
      const needs = this.auth && this.auth.param && this.auth.token && u && /^wss?:/i.test(u) && this.auth.sendOnUrl !== false;
      if (needs) {
        const sep = u.includes('?') ? '&' : '?';
        u = `${u}${sep}${encodeURIComponent(this.auth.param)}=${encodeURIComponent(this.auth.token)}`;
      }
      return u;
    }

    _delayMs() {
      const { min, max, factor, jitter } = this.backoff;
      const base = Math.min(max, min * Math.pow(factor, Math.max(0, this._attempt - 1)));
      const spread = base * (jitter || 0);
      const rand = (Math.random() * spread * 2) - spread;
      return Math.max(min, Math.floor(base + rand));
    }

    async connect(opts = {}) {
      if (this.state === 'open') return this._openPromise || Promise.resolve(true);
      if (this.state === 'connecting') return this._openPromise || Promise.resolve(false);
      if (!navigator.onLine) { this._emit('state', { state: 'offline' }); return Promise.resolve(false); }

      this.state = 'connecting'; this._emit('state', { state: 'connecting' });

      try {
        if (this.auth && this.auth.getToken && !this.auth.token) {
          try { this.auth.token = await this.auth.getToken(); } catch(_) {}
        }
      } catch(_) {}

      let url = this._buildUrl();
      try { this.ws = this.protocols ? new WebSocket(url, this.protocols) : new WebSocket(url); }
      catch (err) { this._scheduleReconnect('constructor-failed', err); return Promise.resolve(false); }

      const waitOpen = opts.waitOpen !== false;
      this._openPromise = new Promise((resolve) => {
        let settled = false;
        const done = (ok) => { if (!settled) { settled = true; resolve(ok); } };

        this.ws.onopen = async (e) => {
          this.state = 'open'; this.lastOpenTs = now(); this._attempt = 0; this._emit('open', e); this._emit('state', { state: 'open' });
          if (this.bc) { try { this.bc.postMessage({ __from: this.clientId, type: 'wsx:state', data: { state: 'open' } }); } catch(_) {} }
          if (this.auth && this.auth.token && this.auth.sendOnUrl === false) { try { this._rawSend({ type: 'auth', token: this.auth.token, ts: now(), cid: this.clientId }); } catch(_) {} }
          if (this.lastServerSeq) { try { this._rawSend({ type: 'resume', lastSeq: this.lastServerSeq, ts: now(), cid: this.clientId }); } catch(_) {} } else { try { this._rawSend({ type: 'hello', ts: now(), cid: this.clientId }); } catch(_) {} }
          await this._persistDrain(async (payload) => { this._rawSend(payload); });
          while (this._queue.length) { const r = this._queue.shift(); this._rawSend(r.payload); }
          this._startHeartbeat();
          done(true);
        };

        this.ws.onmessage = (e) => {
          const dataEvt = e.data;
          if (typeof dataEvt === 'string') { this._onIncoming(this.serializer.decode(dataEvt)); return; }
          if (dataEvt instanceof Blob) { dataEvt.text().then(t => this._onIncoming(this.serializer.decode(t))).catch(()=>{}); return; }
          if (dataEvt instanceof ArrayBuffer) { const s = new TextDecoder().decode(new Uint8Array(dataEvt)); this._onIncoming(this.serializer.decode(s)); return; }
          this._onIncoming(this.serializer.decode(dataEvt));
        };

        this.ws.onerror = (e) => {
          this._emit('error', new WSXError('socket-error', 'WSX_SOCKET', 'Underlying WebSocket error', { event: e }));
        };

        this.ws.onclose = (e) => {
          this._stopHeartbeat();
          this._emit('close', e);
          this.state = 'closed'; this._emit('state', { state: 'closed', reason: e && e.code });
          if (this.autoReconnect) this._scheduleReconnect('socket-close', e);
          done(false);
        };

        if (!waitOpen) resolve(true);
      });

      if (waitOpen) {
        const to = Number.isFinite(this.requestTimeout) ? Math.max(2000, this.requestTimeout) : 15000;
        const race = new Promise((r) => setTimeout(() => r(false), to));
        return Promise.race([this._openPromise, race]);
      }
      return this._openPromise;
    }

    _startHeartbeat() {
      if (this.ping.interval <= 0) return;
      clearInterval(this._pingTimer); clearTimeout(this._pongTimer);
      this._pingTimer = setInterval(() => {
        try {
          if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
          this._rawSend(this.ping.send);
          clearTimeout(this._pongTimer);
          this._pongTimer = setTimeout(() => { try { this.ws && this.ws.close(); } catch(_) {} }, this.ping.timeout);
        } catch(_) {}
      }, this.ping.interval);
    }

    _stopHeartbeat() { clearInterval(this._pingTimer); this._pingTimer = null; clearTimeout(this._pongTimer); this._pongTimer = null; }

    _scheduleReconnect(why, meta) {
      if (!this.autoReconnect) return;
      this._attempt++; const delay = this._delayMs();
      this._emit('backoff', { attempt: this._attempt, delay, why, meta });
      setTimeout(() => this.connect({ waitOpen: false }), delay);
    }

    async _enqueue(payload) {
      const record = { id: uuid(), ts: now(), payload };
      await this._persistEnqueue(record);
    }

    async send(data) {
      const payload = (typeof data === 'string' || data instanceof ArrayBuffer || data instanceof Blob) ? data : Object.assign({ ts: now(), cid: this.clientId }, data);
      for (const fn of this.interceptors.beforeSend) { try { const v = fn(payload); if (v && typeof v === 'object') Object.assign(payload, v); } catch(_) {} }
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try { this._rawSend(payload); } catch(_) { await this._enqueue({ payload }); }
      } else {
        await this._enqueue({ payload });
      }
    }

    _rawSend(objOrString) {
      const out = this.serializer.encode(objOrString);
      this.ws && this.ws.send(out);
    }

    emit(topic, data) { return this.send({ type: 'event', topic, payload: data, id: uuid(), seq: ++this.seq }); }

    request(route, payload, opts = {}) {
      const id = uuid();
      const timeoutMs = Number.isFinite(opts.timeout) ? opts.timeout : this.requestTimeout;
      const message = { type: 'req', route, payload, id, ts: now(), cid: this.clientId, seq: ++this.seq };
      const promise = new Promise((resolve, reject) => {
        const to = setTimeout(() => {
          this.pending.delete(id);
          reject(new WSXError('request-timeout', 'WSX_TIMEOUT', `No response for route "${route}" within ${timeoutMs}ms`, { route, id }));
        }, timeoutMs);
        this.pending.set(id, { resolve, reject, timeout: to });
      });
      this.send(message);
      return promise;
    }

    respond(reqId, payload, ok = true) {
      const msg = { type: 'res', ok, id: reqId, payload, ts: now(), cid: this.clientId, seq: ++this.seq };
      return this.send(msg);
    }

    setUrl(url) { this.url = url; if (this.state === 'open') { this.close(); this.connect({ waitOpen: false }); } }
    setToken(token) { this.auth = Object.assign({}, this.auth, { token }); }
    setSerializer(serializer) { if (serializer && serializer.encode && serializer.decode) this.serializer = serializer; }
    status() { return { state: this.state, attempt: this._attempt, lastOpenTs: this.lastOpenTs }; }

    flush() { if (this.state === 'open') return this._persistDrain(async (payload) => { this._rawSend(payload); }); return Promise.resolve(false); }
    reconnect() { try { this.close(); } catch(_) {} this.autoReconnect = true; return this.connect({ waitOpen: false }); }

    close(code, reason) {
      this.autoReconnect = false;
      this._stopHeartbeat();
      try { this.ws && this.ws.close(code, reason); } catch(_) {}
    }

    _dispatchTopic(topic, msg) {
      const set = this.topicHandlers.get(topic);
      if (set) for (const fn of set) try { fn(msg.payload, msg); } catch(e) {}
      this._emit('event', msg);
    }

    _touchPong() { clearTimeout(this._pongTimer); }

    _onIncoming(msg) {
      if (this.bc) { try { this.bc.postMessage({ __from: this.clientId, type: 'wsx:incoming', data: msg }); } catch(_) {} }
      for (const fn of this.interceptors.onMessage) { try { const v = fn(msg); if (v && typeof v === 'object') Object.assign(msg, v); } catch(_) {} }
      if (msg === this.ping.expect || (msg && msg.type === this.ping.expect)) { this._touchPong(); return; }
      if (msg && msg.type) {
        if (msg.seq && Number.isFinite(msg.seq) && msg.seq > this.lastServerSeq) this.lastServerSeq = msg.seq;
        switch (msg.type) {
          case 'event': if (msg.topic) this._dispatchTopic(msg.topic, msg); this._emit('message', msg); break;
          case 'req': this._emit('request', msg); break;
          case 'res': {
            const pend = this.pending.get(msg.id);
            if (pend) {
              clearTimeout(pend.timeout);
              this.pending.delete(msg.id);
              msg.ok !== false ? pend.resolve(msg.payload) : pend.reject(new WSXError('request-failed', 'WSX_RESPONSE', 'Server returned an error response', { id: msg.id, payload: msg.payload }));
            }
            this._emit('message', msg);
            break;
          }
          default: this._emit('message', msg);
        }
      } else {
        this._emit('message', msg);
      }
    }
  }

  U.WebSocket = WebSocketX;
  U.WebSocketX = WebSocketX;
})(window);





// twcss.js — Tailwind CDN + CSS Variables + Auto Scaffold + Theme/Language Orders
(function (w) {
'use strict';

const M = w.Mishkah = w.Mishkah || {};
const U = M.utils = M.utils || {};

// ========== Utils ==========
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
const cx = (...xs)=> xs.flat(Infinity).filter(Boolean).join(' ').replace(/\s+/g,' ').trim();

function normalizeClass(cls) {
  if (!cls) return '';

  let tokens = cls.split(/\s+/).filter(Boolean);

const groups = {
  display: /^flex$|^inline-flex$|^grid$|^block$|^inline-block$|^hidden$/,
  justify: /^justify-(start|end|center|between|around|evenly)$/,
  items: /^items-(start|end|center|baseline|stretch)$/,
  content: /^content-(start|end|center|between|around|evenly)$/,
  textAlign: /^text-(left|right|center|justify|start|end)$/,
  textSize: /^text-(xs|sm|base|lg|xl|\d+xl)$/,
  fontWeight: /^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/,
  rounded: /^rounded(-[trbl]{0,2}|-(sm|md|lg|xl|2xl|3xl|full))?$/,
  shadow: /^shadow(-(sm|md|lg|xl|2xl|inner))?$/,
  overflow: /^overflow-(auto|hidden|visible|scroll|clip)$/,
  position: /^(static|fixed|absolute|relative|sticky)$/,
  inset: /^inset(-[xytrbl])?-.+/,
  w: /^w-(.+)/,
  h: /^h-(.+)/,
  gap: /^gap(-[xy])?-.+/,

  // بدل جروب واحد لـ p… نفصلهم:
  p:  /^p-(.+)/,
  px: /^px-(.+)/,
  py: /^py-(.+)/,
  pt: /^pt-(.+)/,
  pr: /^pr-(.+)/,
  pb: /^pb-(.+)/,
  pl: /^pl-(.+)/,

  // نفس الفكرة للـ margin إن احتجتها:
  m:  /^m-(.+)/,
  mx: /^mx-(.+)/,
  my: /^my-(.+)/,
  mt: /^mt-(.+)/,
  mr: /^mr-(.+)/,
  mb: /^mb-(.+)/,
  ml: /^ml-(.+)/,
};


  const lastSeen = {};
  for (let tok of tokens) {
    for (let key in groups) {
      if (groups[key].test(tok)) lastSeen[key] = tok;
    }
  }

  let filtered = [];
  let used = new Set();

  for (let i = tokens.length - 1; i >= 0; i--) {
    let tok = tokens[i];
    let keep = true;
    for (let key in groups) {
      if (groups[key].test(tok)) {
        if (used.has(key)) keep = false;
        else used.add(key);
      }
    }
    if (keep) filtered.unshift(tok);
  }

  return filtered.join(' ');
}


function tw(strings,...vals){ 
const raw = Array.isArray(strings)? String.raw({raw:strings},...vals): strings; 

let result =String(raw).trim().replace(/\s+/g,' ');


return normalizeClass(result);



 }
 
 

// ========== Modern Palette (light blues / dark deep-blues + layered surfaces) ==========
const DEFAULT_PALETTE = {
  light: {
    background: 'hsl(213 41% 97%)',
    foreground: 'hsl(222 47% 10%)',
    card: 'hsl(0 0% 100%)',
    'card-foreground': 'hsl(222 47% 10%)',
    muted: 'hsl(213 30% 94%)',
    'muted-foreground': 'hsl(215 16% 45%)',
    primary: 'hsl(222 88% 56%)',
    'primary-foreground': 'hsl(210 40% 98%)',
    secondary: 'hsl(214 45% 92%)',
    'secondary-foreground': 'hsl(222 47% 12%)',
    accent: 'hsl(214 60% 90%)',
    'accent-foreground': 'hsl(222 47% 12%)',
    destructive: 'hsl(0 70% 50%)',
    'destructive-foreground': 'hsl(0 0% 98%)',
    border: 'hsl(214 32% 88%)',
    input: 'hsl(214 32% 88%)',
    ring: 'hsl(222 88% 56%)',
    radius: '1rem',
    shadow: '0 10px 30px rgba(15, 23, 42, .08)',
    'surface-1': 'color-mix(in oklab, var(--background) 90%, white)',
    'surface-2': 'color-mix(in oklab, var(--background) 84%, white)',
    'surface-3': 'color-mix(in oklab, var(--background) 78%, white)',
    'gradient-hero': 'linear-gradient(135deg, hsl(220 90% 99%) 0%, hsl(214 45% 92%) 100%)'
  },
  dark: {
    background: 'hsl(222 40% 12%)',
    foreground: 'hsl(210 40% 98%)',
    card: 'hsl(222 42% 14%)',
    'card-foreground': 'hsl(210 40% 98%)',
    muted: 'hsl(222 35% 16%)',
    'muted-foreground': 'hsl(215 20% 70%)',
    primary: 'hsl(220 90% 65%)',
    'primary-foreground': 'hsl(222 40% 12%)',
    secondary: 'hsl(222 30% 18%)',
    'secondary-foreground': 'hsl(210 40% 98%)',
    accent: 'hsl(222 35% 20%)',
    'accent-foreground': 'hsl(210 40% 98%)',
    destructive: 'hsl(0 65% 48%)',
    'destructive-foreground': 'hsl(0 0% 98%)',
    border: 'hsl(215 24% 24%)',
    input: 'hsl(215 24% 24%)',
    ring: 'hsl(220 90% 65%)',
    radius: '1rem',
    shadow: '0 12px 36px rgba(0,0,0,.45)',
    'surface-1': 'color-mix(in oklab, var(--background) 92%, black)',
    'surface-2': 'color-mix(in oklab, var(--background) 86%, black)',
    'surface-3': 'color-mix(in oklab, var(--background) 80%, black)',
    'gradient-hero': 'linear-gradient(135deg, hsl(220 30% 16%) 0%, hsl(220 35% 12%) 100%)'
  }
};

// ========== Theme injector ==========
function ensureStyle(id){ let el=document.getElementById(id); if(!el){ el=document.createElement('style'); el.id=id; document.head.appendChild(el) } return el }
function varBlock(selector, vars){ return selector+'{'+Object.entries(vars).map(([k,v])=>`--${k}:${v};`).join('')+'}' }
function injectTheme(light, dark){ ensureStyle('twcss-theme').textContent = varBlock(':root', light)+'\n'+varBlock(':root.dark', dark) }
function setTheme(mode){ document.documentElement.classList.toggle('dark', mode==='dark') }
function setDir(dir){ document.documentElement.setAttribute('dir', dir||'ltr') }

// ========== Tokens (aliases) ==========
const TOKENS = {};
function def(map){ Object.assign(TOKENS, map||{}) }
function token(name){ return TOKENS[name]||'' }

// ========== Head helpers (Auto scaffold) ==========
function ensureRoot(id='app'){
  let el = document.getElementById(id);
  if(!el){ el=document.createElement('div'); el.id=id; document.body.appendChild(el); }
  return el;
}
function ensureMetaViewport(){
  if(!document.querySelector('meta[name="viewport"]')){
    const m=document.createElement('meta'); m.name='viewport'; m.content='width=device-width, initial-scale=1.0'; document.head.appendChild(m);
  }
}
function ensurePreconnectFonts(){
  if(!document.querySelector('link[rel="preconnect"][href="https://fonts.googleapis.com"]')){
    const l1=document.createElement('link'); l1.rel='preconnect'; l1.href='https://fonts.googleapis.com'; document.head.appendChild(l1);
  }
  if(!document.querySelector('link[rel="preconnect"][href="https://fonts.gstatic.com"]')){
    const l2=document.createElement('link'); l2.rel='preconnect'; l2.href='https://fonts.gstatic.com'; l2.crossOrigin='anonymous'; document.head.appendChild(l2);
  }
}
function googleFontsURL(fonts){
  if(!Array.isArray(fonts)||!fonts.length) return null;
  const families = fonts.map(f=>{
    const fam = encodeURIComponent(f.family||'');
    const w = f.weights? `:wght@${f.weights}`: '';
    return `family=${fam}${w}`;
  }).join('&');
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}
function ensureLink(href, rel='stylesheet', id){
  if(id && document.getElementById(id)) return;
  if([].some.call(document.querySelectorAll('link[rel]'), l=> l.href===href && l.rel===rel)) return;
  const el=document.createElement('link'); if(id) el.id=id; el.rel=rel; el.href=href; document.head.appendChild(el);
}
function ensureScript(src, id){
  return new Promise((resolve)=>{
    const byId = id && document.getElementById(id);
    if(byId && byId.dataset.ready==='1') return resolve(true);
    if(byId){ byId.addEventListener('load', ()=>{ byId.dataset.ready='1'; resolve(true) }, { once:true }); return; }
    const el=document.createElement('script'); if(id) el.id=id; el.src=src; el.onload=()=>{ el.dataset.ready='1'; resolve(true) }; document.head.appendChild(el);
  });
}
function scaffold(opts={}){
  const {
    title, rootId='app',
    tailwind=true, tailwindSrc='https://cdn.tailwindcss.com',
    fonts=[ {family:'Inter',weights:'400;600;800'}, {family:'Scheherazade New',weights:'400;700'} ],
  }=opts;

  if(title) document.title=title;
  ensureMetaViewport();
  ensurePreconnectFonts();
  const href = googleFontsURL(fonts);
  if(href) ensureLink(href,'stylesheet','gfonts');

  // Tailwind config BEFORE script
  w.tailwind = w.tailwind || {};
  w.tailwind.config = Object.assign({ darkMode:'class' }, w.tailwind.config||{});

  const root = ensureRoot(rootId);
  const ready = tailwind? ensureScript(tailwindSrc,'twcdn'): Promise.resolve(true);
  return { root, ready };
}

// ========== Auto ==========
function auto(db, app, opt={}){
  // theme vars
  const env = db.env||{};
  const user = (env.palette && isObj(env.palette))? env.palette: {};
  const light = Object.assign({}, DEFAULT_PALETTE.light, user.light||{});
  const dark  = Object.assign({}, DEFAULT_PALETTE.dark , user.dark ||{});
  injectTheme(light, dark);
  setTheme(env.theme==='dark'?'dark':'light');
  setDir(env.dir || (env.lang==='ar'?'rtl':'ltr'));

  // page scaffold (Auto by default)
  const useScaffold = opt.pageScaffold!==false;
  let gate = Promise.resolve(true);
  if(useScaffold){
    const s = scaffold({ title: (db.head&&db.head.title)||'Mishkah App', fonts: opt.fonts });
    gate = s.ready;
  }

  // wrap mount to wait
  if(app && app.mount && !app.mount.__twPatched){
    const _mount = app.mount;
    app.mount = async function(sel){ await gate; _mount.call(app, sel); };
    app.mount.__twPatched = true;
  }

  // orders
  const orders = {
    'ui.theme.toggle': {
      on:['click'], gkeys:['ui:theme-toggle'],
      handler:(e,ctx)=>{
        const cur = ctx.getState();
        const next = cur.env?.theme==='dark'?'light':'dark';
        setTheme(next);
        ctx.setState(s=> ({ ...s, env:{ ...(s.env||{}), theme: next } }));
      }
    },
    'ui.lang.ar': {
      on:['click'], gkeys:['ui:lang-ar'],
      handler:(e,ctx)=>{ setDir('rtl'); ctx.setState(s=> ({ ...s, env:{...(s.env||{}), lang:'ar', dir:'rtl'}, i18n:{...(s.i18n||{}), lang:'ar'} })); ctx.rebuild(); }
    },
    'ui.lang.en': {
      on:['click'], gkeys:['ui:lang-en'],
      handler:(e,ctx)=>{ setDir('ltr'); ctx.setState(s=> ({ ...s, env:{...(s.env||{}), lang:'en', dir:'ltr'}, i18n:{...(s.i18n||{}), lang:'en'} })); ctx.rebuild(); }
    }
  };
  return { orders };
}

// ========== Export ==========
U.twcss = { tw, cx, def, token, auto, setTheme, setDir, PALETTE: DEFAULT_PALETTE };

})(window);

