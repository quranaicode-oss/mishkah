
// utils
(function (window) {
  'use strict';
  
  if(!window.isArr) window.isArr = Array.isArray;
  if(!window.isObj) window.isObj = v => v && typeof v === 'object' && !Array.isArray(v);
  if(!window.isFn)  window.isFn  = v => typeof v === 'function';
  if(!window.isStr) window.isStr = v => typeof v === 'string' || typeof v === 'number';
  if(!window.toArr) window.toArr = v => v==null ? [] : Array.isArray(v) ? v :
                    (typeof v==='string' ? v.split(',').map(s=>s.trim()).filter(Boolean) : [v]);
  if(!window.asArray) window.asArray = window.toArr;
  if(!window.toNum) window.toNum = v => { const n = typeof v==='number'?v:parseFloat(v); return isNaN(n)?0:n };
  if(!window.toBool) window.toBool = v => !!(typeof v==='string' ? (v==='true'||v==='1') : v);
  if(!window.C) window.C = function(...c){ const f = (Array.prototype.flat ? c.flat() : [].concat(...c)); return f.filter(Boolean).join(' ') };

  const U = {};

  const isArr = Array.isArray;
  const isObj = v => v != null && typeof v === 'object' && !Array.isArray(v);
  const isStr = v => typeof v === 'string';
  const isFn = v => typeof v === 'function';
  const isNum = v => typeof v === 'number' && !Number.isNaN(v);
  const noop = () => {};
  const identity = x => x;

  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const between = (v, min, max) => v >= min && v <= max;
  const once = fn => { let c = false, val; return (...a) => { if (!c) { c = true; val = fn(...a) } return val } };
  
 
  const nextTick = fn => Promise.resolve().then(fn);
  const withTimeout = (p, ms, msg = 'Timeout') => new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error(msg)), ms);
    Promise.resolve(p).then(v => { clearTimeout(t); res(v) }, e => { clearTimeout(t); rej(e) })
  });
  U.once = once;
  U.nextTick = nextTick;
  U.withTimeout = withTimeout;
  U.$ = (sel, root = document) => root.querySelector(sel);
  U.$$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  U.ajax = async (url, opt = {}) => {
    const { method = 'GET', headers = {}, query = null, body, timeout = 0, responseType = null, withCredentials = false } = opt;
    const q = !query ? '' : '?' + Object.entries(query).map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&');
    const full = url + q;
    const ctrl = timeout ? new AbortController() : null;
    const id = timeout ? setTimeout(() => ctrl.abort(), timeout) : null;
    try {
      const wantJSON = isObj(body) && !headers['Content-Type'] && !headers['content-type'];
      const h = wantJSON ? { 'Content-Type': 'application/json', Accept: 'application/json, text/plain, */*', ...headers } : { Accept: 'application/json, text/plain, */*', ...headers };
      const b = isObj(body) && h['Content-Type'] === 'application/json' ? JSON.stringify(body) : body;
      const res = await fetch(full, { method, headers: h, body: b, credentials: withCredentials ? 'include' : 'same-origin', signal: ctrl ? ctrl.signal : undefined });
      if (id) clearTimeout(id);
      if (!res.ok) {
        let msg = res.statusText;
        try { const j = await res.clone().json(); msg = j?.message || msg } catch (_) {}
        const e = new Error(`HTTP ${res.status} ${msg}`); e.status = res.status; e.response = res; throw e
      }
      if (responseType) {
        if (responseType === 'json') return res.json();
        if (responseType === 'text') return res.text();
        if (responseType === 'blob') return res.blob();
        if (responseType === 'arrayBuffer') return res.arrayBuffer();
        if (responseType === 'formData') return res.formData();
      }
      const ct = (res.headers.get('content-type') || '').toLowerCase();
      if (ct.includes('application/json')) return res.json();
      if (ct.includes('text/')) return res.text();
      if (ct.includes('application/octet-stream')) return res.arrayBuffer();
      if (ct.includes('multipart/') || ct.includes('form-data')) return res.formData();
      return res.blob()
    } catch (e) { if (id) clearTimeout(id); throw e }
  };

  const createNamespacedStorage = (storage, ns = 'mishkah') => {
    const K = k => `${ns}:${k}`;
    const set = (k, v, ttlMs = null) => { const item = { v, t: Date.now(), e: ttlMs ? Date.now() + ttlMs : null }; try { storage.setItem(K(k), JSON.stringify(item)) } catch (_) {} };
    const get = (k, def = null) => { try { const raw = storage.getItem(K(k)); if (!raw) return def; const item = JSON.parse(raw); if (item.e && Date.now() > item.e) { storage.removeItem(K(k)); return def } return item.v } catch (_) { return def } };
    const remove = k => { try { storage.removeItem(K(k)) } catch (_) {} };
    const clearNS = () => { try { const keys = []; for (let i = 0; i < storage.length; i++) { const key = storage.key(i); if (key && key.startsWith(ns + ':')) keys.push(key) } for (const k of keys) storage.removeItem(k) } catch (_) {} };
    return { set, get, remove, clear: clearNS }
  };
  U.localStorage = createNamespacedStorage(window.localStorage, 'mishkah');
  U.sessionStorage = createNamespacedStorage(window.sessionStorage, 'mishkah:session');

 

  const Evt = () => {
    const m = new Map();
    const on = (t, fn) => { const a = m.get(t) || []; a.push(fn); m.set(t, a); return () => off(t, fn) };
    const onceEvt = (t, fn) => on(t, (...args) => { off(t, fn); fn(...args) });
    const off = (t, fn) => { const a = m.get(t); if (!a) return; const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1) };
    const emit = (t, ...args) => { const a = m.get(t) || []; for (const fn of a.slice()) try { fn(...args) } catch (_) {} };
    return { on, once: onceEvt, off, emit }
  };
  U.EventBus = Evt;

  class Broadcast {
    constructor(name) { this.name = name; this.bc = null; this.bus = Evt(); try { this.bc = new BroadcastChannel(name); this.bc.onmessage = e => this.bus.emit('message', e.data) } catch (_) { window.addEventListener('storage', e => { if (e.key === `bc:${name}` && e.newValue) { try { const d = JSON.parse(e.newValue); this.bus.emit('message', d) } catch (_) {} } }) } }
    post(data) { try { if (this.bc) {this.bc.postMessage(data);} 
	else 
{
  const k = `bc:${this.name}`; 
  localStorage.setItem(k, JSON.stringify(data));
   // تنظيف فوري
   setTimeout(() => { try { localStorage.removeItem(k) } catch(_){} }, 0);
 }

	} catch (_) {} }
    on(fn) { return this.bus.on('message', fn) }
    close() { try { this.bc?.close() } catch (_) {} }
  }
  U.Broadcast = Broadcast;

  U.debounce = (fn, wait = 250) => { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait) } };
  U.throttle = (fn, wait = 250) => {
    let last = 0, pend = null, timer = null;
    const run = (args) => { last = Date.now(); pend = null; fn(...args) };
    return (...args) => {
      const now = Date.now(), rem = wait - (now - last);
      if (rem <= 0) run(args);
      else { pend = args; clearTimeout(timer); timer = setTimeout(() => run(pend), rem) }
    }
  };
  U.sleep = ms => new Promise(r => setTimeout(r, ms));
  U.retry = async (fn, { tries = 3, base = 300, factor = 2, jitter = true } = {}) => { let a = 0, d = base; for (;;) { try { return await fn() } catch (e) { a++; if (a >= tries) throw e; const j = jitter ? Math.floor(d * (0.8 + Math.random() * 0.4)) : d; await U.sleep(j); d *= factor } } };

  U.qs = {
    parse(s) { const out = {}; if (!s) return out; s = s.replace(/^\?/, ''); for (const part of s.split('&')) { if (!part) continue; const [k, v = ''] = part.split('='); const key = decodeURIComponent(k.replace(/\+/g, ' ')); const val = decodeURIComponent(v.replace(/\+/g, ' ')); if (key in out) { const cur = out[key]; out[key] = Array.isArray(cur) ? cur.concat(val) : [cur, val] } else out[key] = val } return out },
    stringify(obj) { const enc = x => encodeURIComponent(String(x)); const parts = []; for (const k in obj) { const v = obj[k]; if (v == null) continue; if (Array.isArray(v)) { for (const it of v) parts.push(`${enc(k)}=${enc(it)}`) } else parts.push(`${enc(k)}=${enc(v)}`) } return parts.length ? `?${parts.join('&')}` : '' }
  };

  U.uuid = () => { const b = new Uint8Array(16); crypto.getRandomValues(b); b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80; const h = [...b].map(x => x.toString(16).padStart(2, '0')); return `${h[0]}${h[1]}${h[2]}${h[3]}-${h[4]}${h[5]}-${h[6]}${h[7]}-${h[8]}${h[9]}-${h[10]}${h[11]}${h[12]}${h[13]}${h[14]}${h[15]}` };
  U.uid = (prefix = 'id') => `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
  U.cx = (...xs) => xs.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  U.sha256 = async s => { const enc = new TextEncoder().encode(String(s)); const buf = await crypto.subtle.digest('SHA-256', enc); return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('') };
  U.base64 = {
    encode(s) { const bytes = new TextEncoder().encode(String(s)); let bin = ''; for (let i = 0; i < bytes.length; i++) bin += Strinwindow.fromCharCode(bytes[i]); return btoa(bin) },
    decode(s) { const bin = atob(String(s)); const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i); return new TextDecoder().decode(bytes) }
  };

  U.cache = {
    async get(name, req, fetcher) { const c = await caches.open(name); const key = typeof req === 'string' ? new Request(req) : req; const hit = await c.match(key); if (hit) return hit.clone(); const res = fetcher ? await fetcher(key) : await fetch(key); if (res && res.ok) await c.put(key, res.clone()); return res.clone() },
    async put(name, req, res) { const c = await caches.open(name); await c.put(req, res); return true },
    async del(name, req) { const c = await caches.open(name); return c.delete(req) },
    async clear(name) { const keys = await caches.keys(); for (const k of keys) { if (!name || k === name) await caches.delete(k) } }
  };

  U.TaskQueue = class {
    constructor(concurrency = 4) { this.c = concurrency; this.q = []; this.r = 0 }
    _next() { if (this.r >= this.c) return; const it = this.q.shift(); if (!it) return; this.r++; Promise.resolve().then(it.fn).then(it.res, it.rej).finally(() => { this.r--; this._next() }) }
    add(fn) { return new Promise((res, rej) => { this.q.push({ fn, res, rej }); this._next() }) }
  };

  U.Time = { now: () => Date.now(), ts: () => new Date().toISOString(), fmt: (d, opts) => new Intl.DateTimeFormat(undefined, opts || { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(d instanceof Date ? d : new Date(d)) };

  U.on = (el, ev, fn, opts) => { el && el.addEventListener(ev, fn, opts); return () => U.off(el, ev, fn, opts) };
  U.off = (el, ev, fn, opts) => { el && el.removeEventListener(ev, fn, opts) };
U.delegate = (root, types, selectorOrFilter, handler, options = {}) => {
  const tlist = Array.isArray(types) ? types : String(types).trim().split(/\s+/).filter(Boolean);
  const opt = options || {};
  const isFn = v => typeof v === 'function';
  const isStr = v => typeof v === 'string';
  const maxDepth = Number.isFinite(opt.maxDepth) ? opt.maxDepth : Infinity;
  const withinSel = opt.within && isStr(opt.within) ? opt.within : null;

  const match = (el, e) => isFn(selectorOrFilter) ? !!selectorOrFilter(el, e) : !!(el && el.matches && el.matches(selectorOrFilter));
  const reject = (el, e) => {
    if (!opt.not) return false;
    if (isFn(opt.not)) return !!opt.not(el, e);
    if (isStr(opt.not) && el.matches) return el.matches(opt.not);
    return false;
  };
  const inWithin = (el) => !withinSel ? true : !!(el.closest && el.closest(withinSel));

  const listener = (e) => {
    let target = null;

    if (opt.path !== false && e.composedPath) {
      let depth = 0;
      for (const node of e.composedPath()) {
        if (depth++ > maxDepth) break;
        if (!(node instanceof Element)) continue;
        if (!root.contains(node)) continue;
        if (!inWithin(node)) continue;
        if (reject(node, e)) continue;
        if (match(node, e)) { target = node; break; }
      }
    }

    if (!target) {
      let cur = e.target, depth = 0;
      while (cur && depth++ <= maxDepth && cur !== document) {
        if (!root.contains(cur)) break;
        if (inWithin(cur) && !reject(cur, e) && match(cur, e)) { target = cur; break; }
        cur = cur.parentNode || cur.host || null;
      }
    }

    if (!target) return;
    if (opt.self && e.target !== target) return;
    if (opt.when && isFn(opt.when) && !opt.when(e, target)) return;
    if (opt.prevent) e.preventDefault();
    if (opt.immediate) e.stopImmediatePropagation();
    else if (opt.stop) e.stopPropagation();
    if (opt.once) offAll();
    return handler.call(target, e, target);
  };

  const offs = tlist.map(t => U.on(root, t, listener, { capture: !!opt.capture, passive: !!opt.passive }));
  function offAll(){ for (const off of offs) try{ off && off(); } catch(_){} }
  return offAll;
};

U.delegateOnce = (root, types, selectorOrFilter, handler, options = {}) =>
  U.delegate(root, types, selectorOrFilter, handler, { ...options, once: true });

U.delegateMap = (root, types, mapOrArray, sharedOptions = {}) => {
  const entries = Array.isArray(mapOrArray)
    ? mapOrArray
    : Object.entries(mapOrArray || {}).map(([selectorOrFilter, handler]) => ({ selectorOrFilter, handler, options: {} }));

  const disposers = [];
  for (const ent of entries) {
    const selOrFilter = ent.selectorOrFilter ?? ent.selector ?? ent.filter;
    const handler = ent.handler;
    const options = { ...sharedOptions, ...(ent.options || {}) };
    disposers.push(U.delegate(root, types, selOrFilter, handler, options));
  }
  return () => { for (const d of disposers) try{ d && d(); }catch(_){} };
};

  U.setVar = (el, name, value) => { if (el) el.style.setProperty(name, value) };
  U.getVar = (el, name) => el ? getComputedStyle(el).getPropertyValue(name) : '';
  U.setStyles = (el, styles = {}) => { if (!el || !styles) return; for (const k in styles) el.style[k] = styles[k] };

  const Keys = { Enter: 'Enter', Escape: 'Escape', Space: ' ', Tab: 'Tab', ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight', Home: 'Home', End: 'End', PageUp: 'PageUp', PageDown: 'PageDown' };
  U.Keys = Keys;

  const focusableSelector = ['a[href]', 'button:not([disabled])', 'input:not([disabled])', 'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])', '[contenteditable="true"]'].join(',');
  U.getFocusables = root => U.$$(focusableSelector, root).filter(el => el.offsetParent !== null || getComputedStyle(el).position === 'fixed');
  U.focusFirst = root => { const f = U.getFocusables(root)[0]; if (f) f.focus(); return !!f };
  U.focusNext = (root, current) => { const a = U.getFocusables(root); const i = Math.max(0, a.indexOf(current)) + 1; const t = a[i] || a[0]; t && t.focus() };
  U.focusPrev = (root, current) => { const a = U.getFocusables(root); const i = Math.max(0, a.indexOf(current)) - 1; const t = a[i] || a[a.length - 1]; t && t.focus() };
  U.trapFocus = root => { const handler = e => { if (e.key !== Keys.Tab) return; const f = U.getFocusables(root); if (!f.length) return; const first = f[0], last = f[f.length - 1]; if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() } }; const off = U.on(root, 'keydown', handler); return () => off() };
  U.onOutsideClick = (root, cb) => { const h = e => { if (!root.contains(e.target)) cb(e) }; const off1 = U.on(document, 'mousedown', h, true); const off2 = U.on(document, 'touchstart', h, true); return () => { off1(); off2() } };
  U.onEscape = cb => U.on(document, 'keydown', e => { if (e.key === Keys.Escape) cb(e) });

  U.getRect = el => el && el.getBoundingClientRect ? el.getBoundingClientRect() : { left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0 };
  U.computePlacement = (anchor, content, opt = {}) => {
    const p = opt.placement || 'bottom';
    const align = opt.align || 'start';
    const offset = opt.offset == null ? 6 : opt.offset;
    const margin = opt.boundaryMargin == null ? 8 : opt.boundaryMargin;
    const flip = opt.flip !== false;
    const ar = U.getRect(anchor);
    const cr = U.getRect(content);
    const vw = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
    const vh = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
    let top = 0, left = 0, place = p;
    const calc = (pl) => {
      let t = 0, l = 0;
      if (pl === 'top') { t = ar.top - cr.height - offset; if (align === 'start') l = ar.left; else if (align === 'end') l = ar.right - cr.width; else l = ar.left + (ar.width - cr.width) / 2 }
      else if (pl === 'bottom') { t = ar.bottom + offset; if (align === 'start') l = ar.left; else if (align === 'end') l = ar.right - cr.width; else l = ar.left + (ar.width - cr.width) / 2 }
      else if (pl === 'left') { l = ar.left - cr.width - offset; if (align === 'start') t = ar.top; else if (align === 'end') t = ar.bottom - cr.height; else t = ar.top + (ar.height - cr.height) / 2 }
      else if (pl === 'right') { l = ar.right + offset; if (align === 'start') t = ar.top; else if (align === 'end') t = ar.bottom - cr.height; else t = ar.top + (ar.height - cr.height) / 2 }
      return { t, l }
    };
    ({ t: top, l: left } = calc(place));
    const overflow = () => left < margin || top < margin || left + cr.width > vw - margin || top + cr.height > vh - margin;
    if (flip && overflow()) {
      const alt = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' }[place] || place;
      ({ t: top, l: left } = calc(alt));
      if (!overflow()) place = alt
    }
    left = clamp(left, margin, vw - cr.width - margin);
    top = clamp(top, margin, vh - cr.height - margin);
    return { left, top, placement: place, style: { position: 'fixed', top: `${top}px`, left: `${left}px` } }
  };

  U.isRTL = l => { const s = (l || '').toLowerCase(); return s === 'rtl' || s === 'ar' || s.startsWith('fa') || s.startsWith('ur') || s.startsWith('he') };
  U.dirFrom = l => U.isRTL(l) ? 'rtl' : 'ltr';

  U.setData = (el, map = {}) => { if (!el || !isObj(map)) return; for (const k in map) { el.dataset[k] = String(map[k]) } };
  U.getData = (el, key, def = null) => { if (!el) return def; const v = el.dataset[key]; return v == null ? def : v };

  U.Escaper = {
    html: s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'),
    attr: s => String(s ?? '').replace(/"/g, '&quot;')
  };

  U.copyText = async (text) => { try { await navigator.clipboard.writeText(String(text)); return true } catch (_) { const ta = document.createElement('textarea'); ta.value = String(text); ta.style.position = 'fixed'; ta.style.top = '-1000px'; document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand('copy') } catch (_) { ok = false } document.body.removeChild(ta); return ok } };
  U.download = (data, filename = 'file.txt', mime = 'application/octet-stream') => { const blob = data instanceof Blob ? data : new Blob([data], { type: mime }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url) };

  U.setCookie = (name, value, days = 7, path = "/") => { const d = new Date(); d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000); document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)};expires=${d.toUTCString()};path=${path}` };
  U.getCookie = (name) => { const m = document.cookie.match(new RegExp("(^| )" + encodeURIComponent(name) + "=([^;]+)")); return m ? decodeURIComponent(m[2]) : null };
  U.getParam = (key, url = window.location.href) => { const u = new URL(url); return u.searchParams.get(key) };

  const ThemeAdapter = { classes: { button({ variant = 'default', size = 'md', disabled }) { const V = variant === 'primary' ? 'ui-btn ui-btn--primary' : variant === 'ghost' ? 'ui-btn ui-btn--ghost' : 'ui-btn'; const S = size === 'sm' ? 'ui-btn--sm' : size === 'lg' ? 'ui-btn--lg' : 'ui-btn--md'; return U.cx(V, S, disabled && 'is-disabled') }, field({ invalid }) { return U.cx('ui-field__input', invalid && 'is-invalid') } } };
  const BootstrapAdapter = { classes: { button({ variant = 'primary', size = 'md', disabled }) { const V = { primary: 'btn btn-primary', ghost: 'btn btn-outline-primary', default: 'btn btn-secondary' }[variant] || 'btn btn-secondary'; const S = { sm: 'btn-sm', md: '', lg: 'btn-lg' }[size] || ''; return U.cx(V, S, disabled && 'disabled') }, field({ invalid }) { return U.cx('form-control', invalid && 'is-invalid') } } };
  const TailwindAdapter = { classes: { button({ variant = 'primary', size = 'md', disabled }) { const base = 'inline-flex items-center justify-center rounded-2xl shadow-sm'; const V = { primary: 'bg-blue-600 text-white hover:bg-blue-700', ghost: 'border border-gray-300 text-gray-800 hover:bg-gray-50', default: 'bg-gray-100 text-gray-900 hover:bg-gray-200' }[variant] || 'bg-gray-100 text-gray-900 hover:bg-gray-200'; const S = { sm: 'text-sm px-3 py-1.5', md: 'text-base px-4 py-2', lg: 'text-lg px-5 py-2.5' }[size] || 'text-base px-4 py-2'; return U.cx(base, V, S, disabled && 'opacity-60 pointer-events-none') }, field({ invalid }) { const base = 'rounded-2xl border px-3 py-2 bg-white text-gray-900'; const err = invalid ? 'border-red-500' : 'border-gray-300'; return U.cx(base, err) } } };

  const a11y = {
    warnMissingKeys(nodes) { if (!Array.isArray(nodes)) return; const noKey = nodes.some(n => n && typeof n === 'object' && n.key == null); if (noKey && typeof console !== 'undefined') console.warn('[A11y] list items should have stable keys') },
    ensureRole(el, role) { if (!el) return; const curr = el.getAttribute('role'); if (curr !== role) { el.setAttribute('role', role); if (typeof console !== 'undefined') console.warn('[A11y] role adjusted to', role) } },
    warnIfNoLabel(input) { if (!input) return; const id = input.getAttribute('id'); if (!id) return; const hasLabel = !!document.querySelector(`label[for="${id}"]`); if (!hasLabel && typeof console !== 'undefined') console.warn('[A11y] input without label', id) }
  };
  U.a11y = a11y;

  U.memoize = fn => { const m = new Map(); return (...args) => { const k = JSON.stringify(args); if (m.has(k)) return m.get(k); const v = fn(...args); m.set(k, v); return v } };
  U.deepEqual = (a, b) => {
    if (a === b) return true;
    if (typeof a !== typeof b) return false;
    if (isArr(a) && isArr(b)) { if (a.length !== b.length) return false; for (let i = 0; i < a.length; i++) if (!U.deepEqual(a[i], b[i])) return false; return true }
    if (isObj(a) && isObj(b)) { const ka = Object.keys(a), kb = Object.keys(b); if (ka.length !== kb.length) return false; for (const k of ka) if (!U.deepEqual(a[k], b[k])) return false; return true }
    return false
  };
  U.deepMerge = (t, s) => {
    if (!isObj(t) || !isObj(s)) return s;
    const o = { ...t };
    for (const k of Object.keys(s)) o[k] = isObj(s[k]) && isObj(t[k]) ? U.deepMerge(t[k], s[k]) : s[k];
    return o
  };
  U.pick = (obj, keys) => { const o = {}; for (const k of keys) if (k in obj) o[k] = obj[k]; return o };
  U.omit = (obj, keys) => { const s = new Set(keys); const o = {}; for (const k in obj) if (!s.has(k)) o[k] = obj[k]; return o };
  U.getPath = (obj, path, def) => { const ks = String(path).split('.'); let cur = obj; for (const k of ks) { if (cur && typeof cur === 'object' && k in cur) cur = cur[k]; else return def } return cur };
  U.setPath = (obj, path, val) => { const ks = String(path).split('.'); let cur = obj; for (let i = 0; i < ks.length - 1; i++) { const k = ks[i]; if (!isObj(cur[k])) cur[k] = {}; cur = cur[k] } cur[ks[ks.length - 1]] = val; return obj };
  U.stableStringify = (obj) => { const seen = new WeakSet(); const f = x => { if (x && typeof x === 'object') { if (seen.has(x)) return '"[Circular]"'; seen.add(x); if (Array.isArray(x)) return '[' + x.map(f).join(',') + ']'; const keys = Object.keys(x).sort(); return '{' + keys.map(k => JSON.stringify(k) + ':' + f(x[k])).join(',') + '}' } return JSON.stringify(x) }; return f(obj) };

  U.toCamel = s => String(s).replace(/[-_](\w)/g, (_, c) => c.toUpperCase());
  U.toKebab = s => String(s).replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

  U.uniqueBy = (arr, key) => { const set = new Set(); const out = []; for (const it of arr) { const k = isFn(key) ? key(it) : it[key]; if (!set.has(k)) { set.add(k); out.push(it) } } return out };
  U.groupBy = (arr, key) => { const out = {}; for (const it of arr) { const k = isFn(key) ? key(it) : it[key]; (out[k] || (out[k] = [])).push(it) } return out };
  U.sortBy = (arr, key, dir = 'asc') => { const a = arr.slice(); const g = isFn(key) ? key : (x => x[key]); a.sort((x, y) => { const dx = g(x), dy = g(y); if (dx < dy) return dir === 'asc' ? -1 : 1; if (dx > dy) return dir === 'asc' ? 1 : -1; return 0 }); return a };
  U.range = (n, s = 0) => Array.from({ length: n }, (_, i) => i + s);
  U.chunk = (arr, size) => { const out = []; for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size)); return out };
  U.sum = arr => arr.reduce((a, b) => a + b, 0);
  U.avg = arr => arr.length ? U.sum(arr) / arr.length : 0;

  U.randomInt = (min, max) => Math.floor(min + Math.random() * (max - min + 1));
  U.randomChoice = arr => arr[Math.floor(Math.random() * arr.length)];

  U.html = (str) => { const t = document.createElement('template'); t.innerHTML = String(str).trim(); return t.content };

  U.raf = (fn) => { let id = 0, active = true; const loop = (t) => { if (!active) return; fn(t); id = requestAnimationFrame(loop) }; id = requestAnimationFrame(loop); return () => { active = false; cancelAnimationFrame(id) } };

  window.Mishkah = window.Mishkah || {};
  window.Mishkah.utils = U;
  const Adapters = { ThemeAdapter, BootstrapAdapter, TailwindAdapter };

  window.Mishkah.adapters = Adapters;
  window.__MISHKAH_UTILS_ADAPTERS__ = { U, Adapters };
})(window);


//utils-indexeddb.js

(function(window){
  "use strict";
  const M = window.Mishkah || (window.Mishkah = {});
  const U = M.utils || (M.utils = {});
  const g = window;
  const isFn = v=> typeof v === 'function';
  const isArr = Array.isArray;
  const isObj = v=> v && typeof v === 'object' && !Array.isArray(v);
  const toArr = v=> v==null? [] : (isArr(v)? v : [v]);
  const now = ()=> Date.now();

  class DBError extends Error { constructor(message, meta){ super(message); this.name = 'DBError'; if(meta) Object.assign(this, meta); } }

  const reqp = (req)=> new Promise((res, rej)=>{ req.onsuccess = e=> res(e.target.result); req.onerror = e=> rej(wrapErr(e.target.error || e)); });
  const wrapErr = (e)=>{ if(e instanceof DBError) return e; const name = (e && e.name) || 'IDBError'; const msg = (e && e.message) || String(e); return new DBError(msg, { code:name, cause:e }); };

  const canListDbs = !!(window.indexedDB && window.indexedDB.databases);
  const sleep = (ms)=> new Promise(r=> setTimeout(r, ms));

  const keyRange = (o)=>{
    if(!o) return null;
    if('only' in o) return IDBKeyRange.only(o.only);
    const lo = ('lower' in o)? o.lower : undefined;
    const hi = ('upper' in o)? o.upper : undefined;
    const loOpen = !!o.lowerOpen; const hiOpen = !!o.upperOpen;
    if(lo==null && hi==null) return null;
    if(lo!=null && hi!=null) return IDBKeyRange.bound(lo, hi, loOpen, hiOpen);
    if(lo!=null) return IDBKeyRange.lowerBound(lo, loOpen);
    if(hi!=null) return IDBKeyRange.upperBound(hi, hiOpen);
    return null;
  };

  class TxWrap {
    constructor(tx){ this.tx = tx; this.done = new Promise((res,rej)=>{ tx.oncomplete = ()=>res(true); tx.onabort = ()=>rej(wrapErr(tx.error||new Error('Abort'))); tx.onerror = ()=>rej(wrapErr(tx.error)); }); }
    store(name){ return this.tx.objectStore(name); }
    complete(){ return this.done; }
  }

  function schemaVersionFromMigrations(migs){
    if(!migs) return 1; const keys = Object.keys(migs).map(k=> +k).filter(n=> !Number.isNaN(n)); return keys.length? Math.max(...keys) : 1;
  }

  function computeSchemaDiff(db, schema){
    const dif = { addStores:[], delStores:[], alter:[] };
    const wanted = new Set(Object.keys(schema.stores||{}));
    for(const name of Array.from(db.objectStoreNames||[])) if(!wanted.has(name)) dif.delStores.push(name);
    for(const [name,def] of Object.entries(schema.stores||{})){
      if(!db.objectStoreNames.contains(name)) { dif.addStores.push({ name, def }); continue; }
      const os = db.transaction(name, 'readonly').objectStore(name);
      const idxWanted = new Map((def.indices||[]).map(ix=> [ix.name, ix]));
      const idxExisting = new Set(Array.from(os.indexNames||[]));
      const addIdx=[], delIdx=[];
      for(const nm of idxExisting) if(!idxWanted.has(nm)) delIdx.push(nm);
      for(const [nm,ix] of idxWanted) if(!idxExistinwindow.has(nm)) addIdx.push(ix);
      if(addIdx.length || delIdx.length) dif.alter.push({ name, addIdx, delIdx });
    }
    return dif;
  }

  function applySchema(db, oldVersion, newVersion, schema, migrations){
    const stores = schema && schema.stores ? schema.stores : {};
    for(const [name,def] of Object.entries(stores)){
      const exists = db.objectStoreNames.contains(name);
      if(!exists){ const os = db.createObjectStore(name, { keyPath:def.keyPath, autoIncrement:!!def.autoIncrement }); toArr(def.indices).forEach(ix=>{ if(ix && ix.name) os.createIndex(ix.name, ix.keyPath, Object.assign({ unique:false, multiEntry:false }, ix.options||{})); }); continue; }
      const os = db.transaction.objectStore ? db.transaction.objectStore(name) : null;
      if(os && def.indices){ const existing = new Set(Array.from(os.indexNames||[])); const wanted = new Map(def.indices.map(ix=> [ix.name, ix])); for(const nm of existing){ if(!wanted.has(nm)) os.deleteIndex(nm); } for(const [nm,ix] of wanted){ if(!existinwindow.has(nm)) os.createIndex(ix.name, ix.keyPath, Object.assign({ unique:false, multiEntry:false }, ix.options||{})); }
      }
    }
    if(schema && schema.strict){ for(const name of Array.from(db.objectStoreNames||[])){ if(!stores[name]) db.deleteObjectStore(name); } }
    if(migrations){ const keys = Object.keys(migrations).map(k=> +k).filter(n=> !Number.isNaN(n)).sort((a,b)=> a-b); for(const v of keys){ if(v>oldVersion && v<=newVersion){ const fn = migrations[v]; if(isFn(fn)) fn(db, oldVersion, newVersion, db.transaction); } }
    }
  }

  class IndexedDBX{
    constructor(cfg){
      const o = cfg||{};
      this.name = o.name || o.dbName || 'app-db';
      this.schema = o.schema || { stores:{} };
      this.migrations = o.migrations || {};
      this.initialVersion = o.version || Math.max(1, schemaVersionFromMigrations(this.migrations));
      this.autoBump = o.autoBumpVersion !== false;
      this.strict = !!o.strictSchema;
      this.blockedHandler = o.onBlocked;
      this.onUpgradeStart = o.onUpgradeStart;
      this.onUpgradeEnd = o.onUpgradeEnd;
      this.onVersionChange = o.onVersionChange;
      this.db = null; this.version = this.initialVersion; this.channel = null; this.closed = false;
      this.broadcast = o.broadcast !== false;
      if(this.broadcast && 'BroadcastChannel' in g){ this.channel = new BroadcastChannel('idb:'+this.name); }
      this.listeners = new Map();
    }

    async currentVersion(){
      if(canListDbs){ try{ const list = await window.indexedDB.databases(); const entry = (list||[]).find(d=> d.name===this.name); return entry && entry.version ? entry.version : 0; }catch(_){ return 0; } }
      try{ const db = await new Promise((res, rej)=>{ const r = window.indexedDB.open(this.name); r.onsuccess = e=>{ const d=e.target.result; const v=d.version; d.close(); res(v); }; r.onerror = e=> rej(wrapErr(e.target.error||e)); }); return db||0; }catch(_){ return 0; }
    }

    async open(){
      if(this.db) return this.db;
      let ver = Math.max(this.initialVersion, await this.currentVersion() || 1);
      let attempt = 0;
      while(true){
        attempt++;
        try{ const db = await this._openVersion(ver); this.db = db; this.version = db.version; this.closed = false; return db; }
        catch(err){ const e = wrapErr(err); const code = e.code || e.name;
          if((code==='VersionError' || code==='InvalidStateError') && this.autoBump && attempt<5){ ver = ver + 1; await sleep(30*attempt); continue; }
          if(code==='QuotaExceededError'){ throw new DBError('IndexedDB quota exceeded', { code, hint:'Free storage or reduce data size' }); }
          throw e;
        }
      }
    }

    _openVersion(version){
      return new Promise((resolve,reject)=>{
        const req = window.indexedDB.open(this.name, version);
        req.onblocked = ()=>{ if(isFn(this.blockedHandler)) try{ this.blockedHandler({ reason:'blocked', name:this.name, version }); }catch(_){} };
        req.onupgradeneeded = e=>{
          const db = e.target.result; const oldV = e.oldVersion || 0; const newV = e.newVersion || version;
          if(isFn(this.onUpgradeStart)) try{ this.onUpgradeStart({ db, oldVersion:oldV, newVersion:newV }); }catch(_){ }
          try{ applySchema(db, oldV, newV, Object.assign({}, this.schema, { strict:this.strict }), this.migrations); }
          catch(err){ reject(wrapErr(err)); return; }
          if(isFn(this.onUpgradeEnd)) try{ this.onUpgradeEnd({ db, oldVersion:oldV, newVersion:newV }); }catch(_){ }
        };
        req.onerror = e=> reject(wrapErr(e.target.error||e));
        req.onsuccess = e=>{
          const db = e.target.result;
          db.onversionchange = ()=>{ try{ if(isFn(this.onVersionChange)) this.onVersionChange({ reason:'versionchange' }); }catch(_){} try{ db.close(); this.db=null; this.closed=true; }catch(_){} };
          resolve(db);
        };
      });
    }

    async ensureSchema(){
      const db = await this.open();
      const dif = computeSchemaDiff(db, Object.assign({}, this.schema, { stores: this.schema.stores||{} }));
      const needs = dif.addStores.length || dif.delStores.length || dif.alter.length;
      if(!needs) return false;
      const nextV = db.version + 1;
      db.close(); this.db=null;
      await new Promise((res,rej)=>{
        const req = window.indexedDB.open(this.name, nextV);
        req.onupgradeneeded = e=>{ const updb = e.target.result; const oldV = e.oldVersion || db.version; const newV = e.newVersion || nextV; if(isFn(this.onUpgradeStart)) try{ this.onUpgradeStart({ db:updb, oldVersion:oldV, newVersion:newV }); }catch(_){ }
          try{ applySchema(updb, oldV, newV, Object.assign({}, this.schema, { strict:this.strict }), this.migrations); }catch(err){ rej(wrapErr(err)); return; }
          if(isFn(this.onUpgradeEnd)) try{ this.onUpgradeEnd({ db:updb, oldVersion:oldV, newVersion:newV }); }catch(_){ }
        };
        req.onerror = e=> rej(wrapErr(e.target.error||e));
        req.onsuccess = e=>{ const updb = e.target.result; updb.close(); res(true); };
      });
      return true;
    }

    close(){ if(this.db){ try{ this.db.close(); }catch(_){} this.db=null; this.closed=true; } }
    async destroy(){ this.close(); await new Promise((res,rej)=>{ const del = window.indexedDB.deleteDatabase(this.name); del.onsuccess = ()=> res(true); del.onerror = e=> rej(wrapErr(e.target.error||e)); del.onblocked = ()=> res(true); }); return true; }

    tx(stores, mode='readonly'){ return this.open().then(db=> new TxWrap(db.transaction(toArr(stores), mode))); }

async run(stores, mode, fn){
  let tw;
  try {
    tw = await this.tx(stores, mode);
    const out = await Promise.resolve(fn(tw));
    await tw.complete();
    return out;
  } catch(err){
    try { if (tw && tw.tx) tw.tx.abort(); } catch(_) {}
    throw wrapErr(err);
  }
}


    store(name, mode='readonly'){ return this.tx(name, mode).then(tw=> tw.store(name)); }

   get(store, key){
  return this.run(store, 'readonly', tw => reqp(tw.store(store).get(key)));
}

getAll(store, query, count){
  return this.run(store, 'readonly', tw => {
    const os = tw.store(store);
    const qr = keyRange(query);
    if ('getAll' in os) return reqp(os.getAll(qr, count));
    return new Promise((res, rej) => {
      const out = [];
      const cur = os.openCursor(qr);
      cur.onsuccess = e => { const c = e.target.result; if(c){ out.push(c.value); c.continue(); } else res(out); };
      cur.onerror  = e => rej(wrapErr(e.target.error || e));
    });
  });
}

getAllKeys(store, query, count){
  return this.run(store, 'readonly', tw => {
    const os = tw.store(store);
    const qr = keyRange(query);
    if ('getAllKeys' in os) return reqp(os.getAllKeys(qr, count));
    return new Promise((res, rej) => {
      const out = [];
      const cur = os.openKeyCursor(qr);
      cur.onsuccess = e => { const c = e.target.result; if(c){ out.push(c.primaryKey); c.continue(); } else res(out); };
      cur.onerror  = e => rej(wrapErr(e.target.error || e));
    });
  });
}

count(store, query){
  return this.run(store, 'readonly', tw => reqp(tw.store(store).count(keyRange(query))));
}

add(store, value, key){
  return this.run(store, 'readwrite', tw => reqp(tw.store(store).add(value, key)));
}

put(store, value, key){
  return this.run(store, 'readwrite', tw => reqp(tw.store(store).put(value, key)));
}

upsert(store, key, updater){
  return this.run(store, 'readwrite', async tw => {
    const os = tw.store(store);
    const cur = await reqp(os.get(key));
    const val = typeof updater === 'function' ? await updater(cur || null) : updater;
    return reqp(os.put(val, key));
  });
}

patch(store, key, patch){
  return this.run(store, 'readwrite', async tw => {
    const os = tw.store(store);
    const cur = await reqp(os.get(key));
    const next = Object.assign({}, cur || {}, (typeof patch === 'function' ? patch(cur || {}) : patch) || {});
    return reqp(os.put(next));
  });
}

delete(store, key){
  return this.run(store, 'readwrite', tw => reqp(tw.store(store).delete(key)));
}

clear(store){
  return this.run(store, 'readwrite', tw => reqp(tw.store(store).clear()));
}

bulkAdd(store, values, chunk=500){
  const vs = toArr(values||[]);
  return this.run(store, 'readwrite', async tw => {
    const os = tw.store(store);
    for (let i=0;i<vs.length;i++){ await reqp(os.add(vs[i])); if (i % chunk === 0) await sleep(0); }
    return true;
  });
}

bulkPut(store, values, chunk=500){
  const vs = toArr(values||[]);
  return this.run(store, 'readwrite', async tw => {
    const os = tw.store(store);
    for (let i=0;i<vs.length;i++){ await reqp(os.put(vs[i])); if (i % chunk === 0) await sleep(0); }
    return true;
  });
}

bulkDelete(store, keys, chunk=800){
  const ks = toArr(keys||[]);
  return this.run(store, 'readwrite', async tw => {
    const os = tw.store(store);
    for (let i=0;i<ks.length;i++){ await reqp(os.delete(ks[i])); if (i % chunk === 0) await sleep(0); }
    return true;
  });
}

byIndex(store, index, query, dir='next'){
  return this.run(store, 'readonly', tw => {
    const os = tw.store(store);
    const idx = os.index(index);
    return new Promise((res, rej) => {
      const out = [];
      const cur = idx.openCursor(keyRange(query), dir);
      cur.onsuccess = e => { const c = e.target.result; if(c){ out.push(c.value); c.continue(); } else res(out); };
      cur.onerror  = e => rej(wrapErr(e.target.error || e));
    });
  });
}

firstByIndex(store, index, query, dir='next'){
  return this.run(store, 'readonly', tw => {
    const os = tw.store(store);
    const idx = os.index(index);
    return new Promise((res, rej) => {
      const cur = idx.openCursor(keyRange(query), dir);
      cur.onsuccess = e => { const c = e.target.result; if(c){ res(c.value); } else res(null); };
      cur.onerror  = e => rej(wrapErr(e.target.error || e));
    });
  });
}

query(store){
  const ctx = { store, index:null, range:null, dir:'next', limit:null, map:null, filter:null, offset:0 };
  const api = {
    where(ix, rng){ ctx.index = ix||null; ctx.range = rng||null; return api; },
    direction(d){ ctx.dir = d||'next'; return api; },
    take(n){ ctx.limit = n|0; return api; },
    skip(n){ ctx.offset = n|0; return api; },
    select(fn){ ctx.map = fn; return api; },
    filter(fn){ ctx.filter = fn; return api; },
    async toArray(){ return await (ctx.index ? this._viaIndex() : this._viaStore()); },
    async _viaStore(){ return await U._scan(this, ctx, (tw)=> tw.store(ctx.store).openCursor(keyRange(ctx.range), ctx.dir)); },
    async _viaIndex(){ return await U._scan(this, ctx, (tw)=> tw.store(ctx.store).index(ctx.index).openCursor(keyRange(ctx.range), ctx.dir)); }
  };
  return api;
}


    async exportJSON(stores){ const names = stores && stores.length? stores : Array.from((await this.open()).objectStoreNames||[]); const out={ name:this.name, version:this.version, exportedAt: now(), data:{} }; for(const s of names){ out.data[s] = await this.getAll(s); } return out; }
    async importJSON(payload, mode='upsert'){ const data = (payload&&payload.data)||{}; const names = Object.keys(data); for(const s of names){ const rows = toArr(data[s]); if(mode==='clear') await this.clear(s); await this.bulkPut(s, rows); } return true; }

    on(event, handler){ if(!this.listeners.has(event)) this.listeners.set(event, new Set()); this.listeners.get(event).add(handler); return ()=> this.off(event, handler); }
    off(event, handler){ const set = this.listeners.get(event); if(set){ set.delete(handler); if(!set.size) this.listeners.delete(event); } }
    emit(event, detail){ const set = this.listeners.get(event); if(set){ set.forEach(fn=>{ try{ fn(detail); }catch(_){ } }); } if(this.channel){ try{ this.channel.postMessage({ t:event, d:detail }); }catch(_){ } }
    }

    async instrumentWrites(){ if(this._instrumented) return; this._instrumented=true; const db = await this.open(); db.addEventListener('close', ()=>{ this._instrumented=false; }); }

    watch(store, handler){ const h = (e)=>{ const d = e && e.detail ? e.detail : e; if(!d || d.store!==store) return; handler(d); }; return this.on('change', h); }

    _emitWrite(store, type, key){ this.emit('change', { store, type, key, ts: now() }); }

    async putEmit(store, value, key){ const k = await this.put(store, value, key); this._emitWrite(store, 'put', key||value?.[this.schema?.stores?.[store]?.keyPath||'id']); return k; }
    async addEmit(store, value, key){ const k = await this.add(store, value, key); this._emitWrite(store, 'add', key||value?.[this.schema?.stores?.[store]?.keyPath||'id']); return k; }
    async deleteEmit(store, key){ const k = await this.delete(store, key); this._emitWrite(store, 'delete', key); return k; }

    async putWithTTL(store, value, ttlMs, key){ const v = Object.assign({}, value, { _expiresAt: now()+Math.max(0, ttlMs|0) }); return this.putEmit(store, v, key); }
    async purgeExpired(store){ const ts = now(); const rows = await this.getAll(store); const dead = rows.filter(x=> +x._expiresAt>0 && x._expiresAt<=ts).map(x=> x[this.schema?.stores?.[store]?.keyPath || 'id']); if(dead.length) await this.bulkDelete(store, dead); return dead.length; }
  }
U._scan = async function(self, ctx, cursorFactory){
  return self.run(ctx.store, 'readonly', (tw) => new Promise((res, rej) => {
    const out = []; let skipped = 0;
    let cursor;
    try { cursor = cursorFactory(tw); } catch (e) { rej(wrapErr(e)); return; }
    cursor.onsuccess = (e) => {
      const c = e.target.result;
      if (!c) return res(out);
      const v = c.value;
      if (ctx.filter && !ctx.filter(v)) return c.continue();
      if (skipped < (ctx.offset || 0)) { skipped++; return c.continue(); }
      out.push(ctx.map ? ctx.map(v) : v);
      if (ctx.limit && out.length >= ctx.limit) return res(out);
      c.continue();
    };
    cursor.onerror = (e) => rej(wrapErr(e.target.error || e));
  }));
};

  U.IndexedDBX = IndexedDBX;
  U.IndexedDB = IndexedDBX;
  U.DBError = DBError;
  console.info('[Mishkah.utils] IndexedDBX ready');
})(window);


// utils-websocket.js
(function (window) {
  const M = window.Mishkah = window.Mishkah || {};
  const U = M.utils = M.utils || {};
  const hasIDBX = !!U.IndexedDBX;
  const BC = ('BroadcastChannel' in window) ? window.BroadcastChannel : null;

  class WSXError extends Error {
    constructor(message, code, hint, meta) {
      super(message); this.name = 'WSXError'; this.code = code || 'WSX_ERR'; this.hint = hint || ''; this.meta = meta || {};
    }
  }

  const uuid = () => (U.uuid ? U.uuid() :
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random()*16|0, v = c==='x'? r : (r&0x3|0x8); return v.toString(16);
    })
  );

  const now = () => Date.now();

  const defaultSerialize = {
    encode: (x) => (typeof x === 'string' ? x : JSON.stringify(x)),
    decode: (x) => {
      if (x == null) return x;
      if (typeof x !== 'string') return x;
      try { return JSON.parse(x); } catch (_) { return x; }
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

      this.auth = Object.assign({ token: opt.token, getToken: opt.getToken, param: 'token' }, opt.auth || {});

      this.requestTimeout = opt.requestTimeout || 15000;
      this.pending = new Map(); // id -> {resolve, reject, timeout}

      this.handlers = {};       // event name -> [fn]
      this.topicHandlers = new Map(); // topic -> Set(fn)

      this.ws = null;
      this.state = 'idle';      // idle|connecting|open|closing|closed
      this.lastOpenTs = 0;

      this.clientId = opt.clientId || (localStorage.getItem('wsx_cid') || (localStorage.setItem('wsx_cid', uuid()), localStorage.getItem('wsx_cid')));
      this.seq = 0;             // local sequence
      this.lastServerSeq = 0;   // for resume

      this.queueMode = Object.assign({ persist: 'memory', max: 5000, store: 'ws_outbox' }, opt.queue || {});
      this._queue = [];
      this._outboxDB = null;

      this.bc = (opt.broadcast !== false && BC) ? new BC(opt.broadcastName || 'mishkah-wsx') : null;
      if (this.bc) {
        this.bc.onmessage = (e) => {
          const msg = e.data;
          if (!msg || mswindow.__from === this.clientId) return;
          if (mswindow.type === 'wsx:incoming') this._emit('message', mswindow.data);
          else if (mswindow.type === 'wsx:state') this._emit('state', mswindow.data);
        };
      }

      this.interceptors = { beforeSend: [], onMessage: [] }; // fn(payload) or fn(payload)=>modified
      if (hasIDBX && this.queueMode.persist === 'idb') {
        this._outboxDB = new U.IndexedDBX({
          name: opt.dbName || 'wsx-db',
          autoBumpVersion: true,
          schema: { stores: { [this.queueMode.store]: { keyPath: 'id', indices: [{ name: 'ts', keyPath: 'ts' }] } } }
        });
      }

      this._onlineHandler = () => { if (navigator.onLine && this.state !== 'open') this.connect(); };
      this._offlineHandler = () => { this._emit('state', { state: 'offline' }); };
      window.addEventListener('online', this._onlineHandler);
      window.addEventListener('offline', this._offlineHandler);
    }

    on(ev, fn) { (this.handlers[ev] || (this.handlers[ev] = [])).push(fn); return () => this.off(ev, fn); }
    off(ev, fn) { const a = this.handlers[ev]; if (!a) return; const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); }
    _emit(ev, data) { const a = this.handlers[ev]; if (a) for (const fn of a.slice()) try { fn(data); } catch(e){ console.error('[WSX handler]', e); } }

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
        await this._outboxDB.open(); await this._outboxDB.ensureSchema();
        await this._outboxDB.put(this.queueMode.store, record);
      } else if (this.queueMode.persist === 'local') {
        const key = 'wsx_outbox_' + this.clientId;
        const cur = JSON.parse(localStorage.getItem(key) || '[]');
        cur.push(record); localStorage.setItem(key, JSON.stringify(cur).slice(-500000));
      } else {
        this._queue.push(record);
        if (this._queue.length > this.queueMode.max) this._queue.shift();
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
        localStorage.setItem(key, '[]');
      } else {
        while (this._queue.length) { const r = this._queue.shift(); await sendFn(r.payload); }
      }
      this._emit('drain', true);
    }

    _buildUrl() {
      let u = this.url;
      const needsAuthParam = this.auth && this.auth.param && this.auth.token && u && u.indexOf('ws') === 0;
      if (needsAuthParam) {
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

    async connect() {
      if (this.state === 'open' || this.state === 'connecting') return;
      if (!navigator.onLine) { this._emit('state', { state: 'offline' }); return; }

      this.state = 'connecting'; this._emit('state', { state: 'connecting' });
      let url = this._buildUrl();

      try {
        if (this.auth && this.auth.getToken && !this.auth.token) {
          try { this.auth.token = await this.auth.getToken(); url = this._buildUrl(); }
          catch (e) { console.warn('[WSX] getToken failed', e); }
        }
      } catch (_) {}

      try {
        this.ws = this.protocols ? new WebSocket(url, this.protocols) : new WebSocket(url);
      } catch (err) {
        this._scheduleReconnect('constructor-failed', err);
        return;
      }

      this.ws.onopen = async (e) => {
        this.state = 'open'; this.lastOpenTs = now(); this._attempt = 0; this._emit('open', e); this._emit('state', { state: 'open' });
        if (this.bc) try { this.bc.postMessage({ __from: this.clientId, type: 'wsx:state', data: { state: 'open' } }); } catch(_) {}

        // handshake
        if (this.auth && this.auth.token && !this.auth.sendOnUrl) {
          try { this._rawSend({ type: 'auth', token: this.auth.token, ts: now(), cid: this.clientId }); } catch (_) {}
        }
        if (this.lastServerSeq) {
          try { this._rawSend({ type: 'resume', lastSeq: this.lastServerSeq, ts: now(), cid: this.clientId }); } catch(_) {}
        } else {
          try { this._rawSend({ type: 'hello', ts: now(), cid: this.clientId }); } catch(_) {}
        }

        // drain outbox
        await this._persistDrain(async (payload) => { this._rawSend(payload); });

        // send buffered queue (memory)
        while (this._queue.length) {
          const r = this._queue.shift();
          this._rawSend(r.payload);
        }

        // start heartbeat
        this._startHeartbeat();
      };

      this.ws.onmessage = (e) => {
        const data = this.serializer.decode(e.data);
        this._onIncoming(data);
      };

      this.ws.onerror = (e) => {
        this._emit('error', new WSXError('socket-error', 'WSX_SOCKET', 'Underlying WebSocket error', { event: e }));
      };

      this.ws.onclose = (e) => {
        this._stopHeartbeat();
        this._emit('close', e);
        this.state = 'closed'; this._emit('state', { state: 'closed', reason: e && e.code });
        if (this.autoReconnect) this._scheduleReconnect('socket-close', e);
      };
    }

    _startHeartbeat() {
      if (this.pinwindow.interval <= 0) return;
      clearInterval(this._pingTimer); clearTimeout(this._pongTimer);
      this._pingTimer = setInterval(() => {
        try {
          if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
          this._rawSend(this.pinwindow.send);
          clearTimeout(this._pongTimer);
          this._pongTimer = setTimeout(() => {
            try { this.ws && this.ws.close(); } catch(_) {}
          }, this.pinwindow.timeout);
        } catch (_) {}
      }, this.pinwindow.interval);
    }

    _stopHeartbeat() { clearInterval(this._pingTimer); this._pingTimer = null; clearTimeout(this._pongTimer); this._pongTimer = null; }

    _scheduleReconnect(why, meta) {
      if (!this.autoReconnect) return;
      this._attempt++; const delay = this._delayMs();
      this._emit('backoff', { attempt: this._attempt, delay, why });
      setTimeout(() => this.connect(), delay);
    }

    async _enqueue(payload) {
      const record = { id: uuid(), ts: now(), payload };
      await this._persistEnqueue(record);
    }

    async send(data) {
      const payload = (typeof data === 'string' || data instanceof ArrayBuffer) ? data : Object.assign({ ts: now(), cid: this.clientId }, data);
      for (const fn of this.interceptors.beforeSend) {
        try { const v = fn(payload); if (v !== undefined) Object.assign(payload, v); } catch(_) {}
      }
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try { this._rawSend(payload); }
        catch (_) { await this._enqueue({ payload }); }
      } else {
        await this._enqueue({ payload });
      }
    }

    _rawSend(objOrString) {
      const out = this.serializer.encode(objOrString);
      this.ws.send(out);
    }

    emit(topic, data) {
      return this.send({ type: 'event', topic, payload: data, id: uuid(), seq: ++this.seq });
    }

    request(route, payload, opts = {}) {
      const id = uuid();
      const timeoutMs = Number.isFinite(opts.timeout) ? opts.timeout : this.requestTimeout;
      const message = { type: 'req', route, payload, id, ts: now(), cid: this.clientId, seq: ++this.seq };
      const promise = new Promise((resolve, reject) => {
        const to = setTimeout(() => {
          this.pendinwindow.delete(id);
          reject(new WSXError('request-timeout', 'WSX_TIMEOUT', `No response for route "${route}" within ${timeoutMs}ms`, { route, id }));
        }, timeoutMs);
        this.pendinwindow.set(id, { resolve, reject, timeout: to });
      });
      this.send(message);
      return promise;
    }

    respond(reqId, payload, ok = true) {
      const msg = { type: 'res', ok, id: reqId, payload, ts: now(), cid: this.clientId, seq: ++this.seq };
      return this.send(msg);
    }

    setUrl(url) { this.url = url; if (this.state === 'open') { this.close(); this.connect(); } }
    setToken(token) { this.auth = Object.assign({}, this.auth, { token }); }
    status() { return { state: this.state, attempt: this._attempt, lastOpenTs: this.lastOpenTs }; }

    close(code, reason) {
      this.autoReconnect = false;
      this._stopHeartbeat();
      try { this.ws && this.ws.close(code, reason); } catch(_) {}
    }

    _dispatchTopic(topic, msg) {
      const set = this.topicHandlers.get(topic);
      if (set) for (const fn of set) try { fn(mswindow.payload, msg); } catch(e){ console.error('[WSX topic]', e); }
      this._emit('event', msg);
    }

    _touchPong() { clearTimeout(this._pongTimer); }

    _onIncoming(data) {
      const msg = data;
      if (this.bc) { try { this.bc.postMessage({ __from: this.clientId, type: 'wsx:incoming', data: msg }); } catch(_) {} }

      for (const fn of this.interceptors.onMessage) {
        try { const v = fn(msg); if (v !== undefined) Object.assign(msg, v); } catch(_) {}
      }

      if (msg === this.pinwindow.expect || (msg && mswindow.type === this.pinwindow.expect)) { this._touchPong(); return; }

      if (msg && mswindow.type) {
        if (mswindow.seq && Number.isFinite(mswindow.seq) && mswindow.seq > this.lastServerSeq) this.lastServerSeq = mswindow.seq;

        switch (mswindow.type) {
          case 'event':
            if (mswindow.topic) this._dispatchTopic(mswindow.topic, msg);
            this._emit('message', msg);
            break;
          case 'req':
            this._emit('request', msg);
            break;
          case 'res': {
            const pend = this.pendinwindow.get(mswindow.id);
            if (pend) {
              clearTimeout(pend.timeout);
              this.pendinwindow.delete(mswindow.id);
              mswindow.ok !== false ? pend.resolve(mswindow.payload) :
                pend.reject(new WSXError('request-failed', 'WSX_RESPONSE', 'Server returned an error response', { id: mswindow.id, payload: mswindow.payload }));
            }
            this._emit('message', msg);
            break;
          }
          case 'ack':
          case 'hello':
          case 'resume-ack':
          default:
            this._emit('message', msg);
        }
      } else {
        this._emit('message', msg);
      }
    }
  }

  // Backward alias (drop-in)
  U.WebSocket = WebSocketX;
  U.WebSocketX = WebSocketX;
})(window);



// twcss.js (v5: twcss + TailwindAdapter + JIT runtime)
(function (window) {
  'use strict';

  const cache = new Map();
  const ruleCache = new Map();

  const isStr = v => typeof v === "string";
  const isArr = Array.isArray;
  const isFn  = v => typeof v === "function";
  const isObj = v => v && typeof v === "object" && !isArr(v);
  const cx    = (...xs) => xs.flat(Infinity).filter(Boolean).join(" ").replace(/\s+/g, " ").trim();

  const P = { "h:":"hover:", "f:":"focus:", "a:":"active:", "d:":"dark:", "sm:":"sm:", "md:":"md:", "lg:":"lg:", "xl:":"xl:", "2xl:":"2xl:" };

  const SCREENS = { sm:640, md:768, lg:1024, xl:1280, "2xl":1536 };

  const TOKENS = {
    btn: "inline-flex items-center justify-center rounded-xl font-semibold transition-colors select-none focus:outline-none focus:ring-2 focus:ring-offset-2",
    "btn/primary": "bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500",
    "btn/ghost": "bg-transparent hover:bg-slate-100 text-slate-700",
    card: "bg-white/95 border border-slate-200 rounded-2xl p-5 shadow-lg shadow-slate-900/5 d:bg-slate-900/80 d:border-slate-700 d:shadow-black/30",
    shell: "max-w-5xl mx-auto p-6",
    row: "flex items-center gap-2",
    col: "flex flex-col gap-2",
    center: "items-center justify-center",
    muted: "text-slate-500 d:text-slate-400",
    "bg/ok": "bg-emerald-600 hover:bg-emerald-700 text-white",
    "bg/warn": "bg-amber-500 hover:bg-amber-600 text-white",
    "bg/danger": "bg-rose-600 hover:bg-rose-700 text-white",
    p1: "p-1", p2: "p-2", p3: "p-3", p4: "p-4", p5: "p-5",
    px2: "px-2", px3: "px-3", px4: "px-4", py1: "py-1", py2: "py-2", py3: "py-3",
    mt1: "mt-1", mt2: "mt-2", mb2: "mb-2", gap2: "gap-2",
    "text/sm": "text-sm", "text/md": "text-base", "text/lg": "text-lg", "text/xl": "text-xl"
  };

  const COMPOUND = [];
  function def(map) { Object.assign(TOKENS, map || {}); }
  function defCompound(arr) { if (isArr(arr)) COMPOUND.push(...arr); }

  function envCtx() {
    const root = document.documentElement || document.body;
    const dir   = (root.getAttribute("dir") || "ltr").toLowerCase();
    const theme = (root.classList.contains("dark") || root.getAttribute("data-theme") === "dark") ? "dark" : "light";
    return { dir, theme, isDark: theme === "dark", isRTL: dir === "rtl" };
  }

  function withUnit(v) {
    const s = String(v).trim();
    if (!s) return s;
    if (/^-?\d+(\.\d+)?$/.test(s)) return s + "px";
    return s;
  }

  function arb(tok) {
    const m = tok.match(/^([a-zA-Z-]+)\[(.+)]$/);
    if (!m) return null;
    const raw = m[2];
    const needsUnit = /^\d+(\.\d+)?$/.test(raw) ? raw + "px" : raw;
    return m[1] + "-[" + needsUnit + "]";
  }

  function mapLogical(tok, dir) {
    if (/^m[se]-/.test(tok)) {
      const side = tok[1] === 's' ? (dir === 'rtl' ? 'r' : 'l') : (dir === 'rtl' ? 'l' : 'r');
      return 'm' + side + tok.slice(3);
    }
    if (/^p[se]-/.test(tok)) {
      const side = tok[1] === 's' ? (dir === 'rtl' ? 'r' : 'l') : (dir === 'rtl' ? 'l' : 'r');
      return 'p' + side + tok.slice(3);
    }
    if (/^border-[se](-|$)/.test(tok)) {
      const side = tok[7] === 's' ? (dir === 'rtl' ? 'r' : 'l') : (dir === 'rtl' ? 'l' : 'r');
      return 'border-' + side + tok.slice(8);
    }
    if (/^rounded-[se](-|$)/.test(tok)) {
      const side = tok[8] === 's' ? (dir === 'rtl' ? 'r' : 'l') : (dir === 'rtl' ? 'l' : 'r');
      return 'rounded-' + side + tok.slice(9);
    }
    if (tok === 'text-start') return dir === 'rtl' ? 'text-right' : 'text-left';
    if (tok === 'text-end') return dir === 'rtl' ? 'text-left' : 'text-right';
    return tok;
  }

  function expandBase(tok, ctx) {
    const a = arb(tok); if (a) return a;
    const logical = mapLogical(tok, ctx.dir); if (logical !== tok) return logical;
    if (TOKENS[tok]) return fromAny(TOKENS[tok], ctx);
    return tok;
  }

  function expandPrefix(tok, ctx) {
    for (const p in P) {
      if (tok.startsWith(p)) {
        const rest = tok.slice(p.length);
        const ex = expand(rest, ctx);
        return ex.split(/\s+/).map(c => P[p] + c).join(" ");
      }
    }
    return null;
  }

  function expandOne(tok, ctx) { return expandPrefix(tok, ctx) || expandBase(tok, ctx); }

  function normalizeArbHyphen(s){ return String(s).replace(/--\[/g, '-['); }

  function expand(s, ctx) {
    if (!s) return "";
    s = normalizeArbHyphen(s);
    const key = s + "::" + ctx.dir + "::" + ctx.theme;
    if (cache.has(key)) return cache.get(key);
    const out = String(s).trim()
      .split(/\s+/)
      .map(t => t.split("+").map(x => expandOne(x, ctx)).join(" "))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    cache.set(key, out);
    return out;
  }

  function fromArray(arr, ctx) { return arr.map(x => isStr(x) ? expand(x, ctx) : fromAny(x, ctx)).join(" "); }
  function fromObject(obj, ctx) {
    const out = [];
    for (const k in obj) {
      if (!obj[k]) continue;
      if (k in P) {
        const sub = fromAny(obj[k], ctx);
        out.push(sub.split(/\s+/).map(c => P[k] + c).join(" "));
      } else {
        out.push(expand(k, ctx));
      }
    }
    return out.join(" ");
  }
  function fromAny(v, ctx) {
    if (!v) return "";
    if (isFn(v)) return fromAny(v(ctx), ctx);
    if (isStr(v)) return expand(v, ctx);
    if (isArr(v)) return fromArray(v, ctx);
    if (isObj(v)) return fromObject(v, ctx);
    return String(v);
  }

  function tw(strings, ...vals) {
    const raw = isArr(strings) ? Strinwindow.raw({ raw: strings }, ...vals) : strings;
    const classes = fromAny(raw, envCtx());
    return jitCompile(classes);
  }

  function merge(...xs) { return tw(cx(xs.map(x => fromAny(x, envCtx())))); }

  // ---------- JIT RUNTIME ----------
  let STYLE_EL = null;
  function ensureSheet(){
    if (STYLE_EL) return STYLE_EL.sheet;
    STYLE_EL = document.createElement('style');
    STYLE_EL.id = 'twcss-runtime';
    document.head.appendChild(STYLE_EL);
    return STYLE_EL.sheet;
  }
  function hash(s){ let h=0,i=0; for(;i<s.length;i++){ h=((h<<5)-h)+s.charCodeAt(i); h|=0; } return "tw-"+(h>>>0).toString(36); }

  function decomposeToken(tok){
    const parts = tok.split(":");
    let variants = [], core = parts[parts.length-1];
    if (parts.length>1) variants = parts.slice(0,-1);
    return { variants, core };
  }

  const CORE_MAP = {
    "bg": v => ({ prop:"background-color", val:v }),
    "text": v => ({ prop:"color", val:v }),
    "border": v => ({ prop:"border-color", val:v }),
    "ring": v => ({ prop: "box-shadow", val:`0 0 0 2px ${v}` }),
    "w": v => ({ prop:"width", val:withUnit(v) }),
    "h": v => ({ prop:"height", val:withUnit(v) }),
    "min-w": v => ({ prop:"min-width", val:withUnit(v) }),
    "max-w": v => ({ prop:"max-width", val:withUnit(v) }),
    "min-h": v => ({ prop:"min-height", val:withUnit(v) }),
    "max-h": v => ({ prop:"max-height", val:withUnit(v) }),
    "rounded": v => ({ prop:"border-radius", val:withUnit(v) }),
    "shadow": v => ({ prop:"box-shadow", val:String(v) }),
    "opacity": v => ({ prop:"opacity", val:String(v) }),
    "aspect": v => ({ prop:"aspect-ratio", val:String(v).includes("/")? v.replace(" ", "") : String(v) }),
    "p": v => ({ multi:[["padding",withUnit(v)]] }),
    "px": v => ({ multi:[["padding-left",withUnit(v)],["padding-right",withUnit(v)]] }),
    "py": v => ({ multi:[["padding-top",withUnit(v)],["padding-bottom",withUnit(v)]] }),
    "pt": v => ({ prop:"padding-top", val:withUnit(v) }),
    "pr": v => ({ prop:"padding-right", val:withUnit(v) }),
    "pb": v => ({ prop:"padding-bottom", val:withUnit(v) }),
    "pl": v => ({ prop:"padding-left", val:withUnit(v) }),
    "m": v => ({ multi:[["margin",withUnit(v)]] }),
    "mx": v => ({ multi:[["margin-left",withUnit(v)],["margin-right",withUnit(v)]] }),
    "my": v => ({ multi:[["margin-top",withUnit(v)],["margin-bottom",withUnit(v)]] }),
    "mt": v => ({ prop:"margin-top", val:withUnit(v) }),
    "mr": v => ({ prop:"margin-right", val:withUnit(v) }),
    "mb": v => ({ prop:"margin-bottom", val:withUnit(v) }),
    "ml": v => ({ prop:"margin-left", val:withUnit(v) })
  };

  function cssDecl(entry){
    if (entry.multi) return entry.multi.map(([k,v])=> `${k}:${v};`).join("");
    return `${entry.prop}:${entry.val};`;
  }

  function buildRule(className, variants, decl){
    let selector = `.${className}`;
    let suffix = "";
    let prelude = "";
    variants.forEach(v=>{
      if (v==="hover") suffix += ":hover";
      else if (v==="focus") suffix += ":focus-visible";
      else if (v==="active") suffix += ":active";
      else if (v==="dark") selector = `.dark ${selector}`;
      else if (SCREENS[v]) prelude += `@media (min-width:${SCREENS[v]}px){`;
    });
    const rule = `${prelude}${selector}${suffix}{${decl}}` + ("}".repeat((prelude.match(/@media/g)||[]).length));
    return rule;
  }

  function compileToken(tok){
    if (ruleCache.has(tok)) return ruleCache.get(tok);

    const { variants, core } = decomposeToken(tok);
    const m = core.match(/^([a-z-]+)-\[(.+)\]$/);
    if (!m) return null;

    const key = m[1], raw = m[2];
    const mapFn = CORE_MAP[key];
    if (!mapFn) return null;

    const entry = mapFn(raw);
    const decl = cssDecl(entry);
    const classBase = hash(tok);
    const className = variants.length ? (variants.join(":") + ":" + classBase) : classBase;

    const sheet = ensureSheet();
    try {
      const cssClass = className.replace(/:/g, "\\:");
      const rule = buildRule(cssClass, variants, decl);
      sheet.insertRule(rule, sheet.cssRules.length);
    } catch(_) {}

    ruleCache.set(tok, className);
    return className;
  }

  function jitCompile(classStr){
    if (!classStr) return classStr;
    const parts = classStr.split(/\s+/).filter(Boolean);
    const out = parts.map(tok=>{
      const compiled = compileToken(tok);
      return compiled || tok;
    });
    return out.join(" ");
  }

  // ---------- UI Helpers (Adapter merged) ----------
  const UI = {
    button({ variant = 'primary', size = 'md', disabled } = {}) {
      const sizeCls = size === 'sm' ? 'text/sm px2 py1'
                    : size === 'lg' ? 'text/lg px4 py3'
                    : 'text/md px4 py2';
      return merge('btn', `btn/${variant}`, sizeCls, disabled && 'opacity-60 pointer-events-none');
    },
    field({ invalid } = {}) {
      return tw([
        'rounded-2xl border px-3 py-2',
        invalid ? 'border-rose-500' : 'border-slate-300',
        'bg-white text-slate-900 d:bg-slate-900 d:text-slate-100'
      ]);
    }
  };

  window.Mishkah = window.Mishkah || {};
  window.Mishkah.twcss = { tw, cx, def, defCompound, merge, config: { P, TOKENS, screens: SCREENS }, ui: UI, jit: { compile: jitCompile } };
  window.Mishkah.adapters = Object.assign({}, window.Mishkah.adapters || {}, { TailwindAdapter: { classes: { button: UI.button, field: UI.field } } });

})(window);

