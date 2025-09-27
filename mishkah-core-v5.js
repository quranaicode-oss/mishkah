(function (window) {
  'use strict';

  const perf = (typeof performance !== "undefined" && performance) || { now: Date.now, mark() {}, measure() {} };
  const now = () => perf.now();
  const asArray = v => (v == null ? [] : Array.isArray(v) ? v : String(v).split(",").map(s => s.trim()).filter(Boolean));

  function createRing(cap = 500) {
    let capacity = cap;
    const b = [];
    return {
      push(x) { if (b.length === capacity) b.shift(); b.push(x); },
      tail(n = capacity) { return b.slice(-n); },
      size() { return b.length; },
      setCapacity(c) { capacity = Math.max(50, (c|0) || 50); if (b.length > capacity) b.splice(0, b.length - capacity); }
    };
  }

  function deepFreeze(obj, seen = new WeakSet()) {
    if (!obj || typeof obj !== 'object' || seen.has(obj)) return obj;
    seen.add(obj);
    Object.freeze(obj);
    for (const k of Object.keys(obj)) deepFreeze(obj[k], seen);
    return obj;
  }

  function cloneDeepJSON(x){ return (typeof structuredClone === 'function') ? structuredClone(x) : JSON.parse(JSON.stringify(x)); }

  function setPathShallow(base, path, value) {
    const ks = String(path).split('.');
    const next = { ...base };
    let curPrev = base;
    let curNext = next;
    for (let i = 0; i < ks.length - 1; i++) {
      const k = ks[i];
      const prevVal = curPrev && typeof curPrev === 'object' ? curPrev[k] : undefined;
      const cloned = Array.isArray(prevVal) ? prevVal.slice() : (prevVal && typeof prevVal === 'object' ? { ...prevVal } : {});
      curNext[k] = cloned;
      curPrev = prevVal;
      curNext = curNext[k];
    }
    curNext[ks[ks.length - 1]] = value;
    return next;
  }

  function getPath(obj, path) { return String(path).split('.').reduce((acc, p) => (acc == null ? acc : acc[p]), obj); }

  function createTruth(initial, options = {}) {
    let state = initial;
    const subs = new Set();
    let batching = 0, scheduled = false;
    const dirty = new Map();
    const frozen = new Set();
    let keysProvider = () => ({ keys: [], groups: {} });
    const strictState = !!options.strictState;
    const devFreeze = !!options.devFreeze;

    function get() { return state }

    function set(p) {
      const next = typeof p === "function" ? p(state) : p;
      if (strictState && (next === undefined || next === null || typeof next !== 'object')) {
        throw new Error(`[Mishkah] truth.set() updater must return a state object in strictState mode.`);
      }
      if (next !== state) {
        state = devFreeze ? deepFreeze(next) : next;
        if (!batching) schedule();
      }
    }

    function produce(mutator) {
      const base = cloneDeepJSON(state);
      mutator(base);
      set(base);
    }

    function setPath(path, value) {
      const next = setPathShallow(state, path, value);
      set(next);
    }

    function updatePath(path, fn) {
      const cur = getPath(state, path);
      setPath(path, fn(cur));
    }

    function produceLite(mutator) {
      const api = { get, setPath, updatePath };
      const maybeNext = mutator(api);
      if (maybeNext && typeof maybeNext === 'object') set(maybeNext);
    }

    function mark(selectors) {
      const selectorsToMark = asArray(selectors);
      const registry = keysProvider();
      for (const selector of selectorsToMark) {
        if (String(selector).startsWith('.')) {
          const groupName = selector.slice(1);
          const keysInGroup = registry.groups[groupName] || [];
          for (const k of keysInGroup) {
            if (k && !frozen.has(k)) dirty.set(k, "patch");
          }
        } else {
          const keyName = String(selector).startsWith('#') ? selector.slice(1) : selector;
          if (keyName && !frozen.has(keyName)) dirty.set(keyName, "patch");
        }
      }
      if (!batching) schedule();
    }

    function rebuild(selectors) {
      const selectorsToRebuild = asArray(selectors);
      const registry = keysProvider();
      for (const selector of selectorsToRebuild) {
        if (String(selector).startsWith('.')) {
          const groupName = selector.slice(1);
          const keysInGroup = registry.groups[groupName] || [];
          for (const k of keysInGroup) {
            if (k && !frozen.has(k)) dirty.set(k, "rebuild");
          }
        } else {
          const keyName = String(selector).startsWith('#') ? selector.slice(1) : selector;
          if (keyName && !frozen.has(keyName)) dirty.set(keyName, "rebuild");
        }
      }
      if (!batching) schedule();
    }

    function rebuildAll(arg) {
      if (arg && typeof arg === 'object' && 'except' in arg) {
        const registry = keysProvider();
        const excludedKeys = new Set();
        asArray(arg.except).forEach(selector => {
          if (String(selector).startsWith('.')) {
            const groupName = selector.slice(1);
            const keysInGroup = registry.groups[groupName] || [];
            keysInGroup.forEach(k => excludedKeys.add(k));
          } else {
            const keyName = String(selector).startsWith('#') ? selector.slice(1) : selector;
            excludedKeys.add(keyName);
          }
        });
        const all = registry.keys || [];
        for (const k of all) {
          if (!frozen.has(k) && !excludedKeys.has(k)) dirty.set(k, "rebuild");
        }
        if (!batching) schedule();
        return;
      }
      if (typeof arg === 'function') {
        const all = keysProvider().keys || [];
        for (const k of all) {
          if (!frozen.has(k) && arg(k)) dirty.set(k, "rebuild");
        }
        if (!batching) schedule();
        return;
      }
      const all = keysProvider().keys || [];
      for (const k of all) {
        if (!frozen.has(k)) dirty.set(k, "rebuild");
      }
      if (!batching) schedule();
    }

    function rebuildAllExcept(excepts) { rebuildAll({ except: excepts }); }

    function batch(fn) {
      batching++;
      try { fn(); } finally { batching--; if (!batching) schedule(); }
    }

    function schedule() {
      if (scheduled) return;
      scheduled = true;
      queueMicrotask(() => {
        scheduled = false;
        const d = new Map(dirty);
        dirty.clear();
        for (const s of subs) s({ state, dirty: d, frozen: new Set(frozen) });
      });
    }

    function subscribe(fn) { subs.add(fn); fn({ state, dirty: new Map(), frozen: new Set(frozen) }); return () => subs.delete(fn); }
    function freeze(k) { asArray(k).forEach(key => frozen.add(String(key).startsWith('#') ? key.slice(1) : key)); }
    function unfreeze(k) { asArray(k).forEach(key => frozen.delete(String(key).startsWith('#') ? key.slice(1) : key)); }
    function bindKeysProvider(fn) { keysProvider = fn || (() => ({ keys: [], groups: {} })); }

    return { get, set, produce, produceLite, setPath, updatePath, mark, rebuild, rebuildAll, rebuildAllExcept, batch, freeze, unfreeze, subscribe, bindKeysProvider };
  }

  function createGuardian() {
    const rules = [];
    let mode = "warn";
    function addRule(n, fn) { rules.push({ name: n, fn }); }
    function setMode(m) { mode = m === "strict" ? "strict" : "warn"; }
    function validate(entry) {
      const errs = [];
      for (const r of rules) {
        try {
          const res = r.fn(entry);
          if (res === true) continue;
          if (res === false) errs.push({ rule: r.name, msg: "violation" });
          else if (res && res.violation) errs.push({ rule: r.name, msg: res.msg || "violation", meta: res.meta });
        } catch (e) { errs.push({ rule: r.name, msg: String(e) }); }
      }
      if (mode === "strict" && errs.length) throw Object.assign(new Error("policy violation"), { violations: errs });
      return errs;
    }
    return { addRule, validate, setMode };
  }

  function addPerformancePolicy(g, defaults = {}) {
    const DEF = { maxMs: 32 };
    const conf = { ...DEF, ...defaults };
    g.addRule('max-commit-ms', (entry) => {
      const last = +(entry.metrics?.lastMs || 0);
      const budget = entry.budget || {};
      const maxMs = budget.maxMs ?? conf.maxMs;
      if (last > maxMs) {
        return { violation: true, msg: 'commit too slow', meta: { key: entry.key, lastMs: last, budget: { maxMs } } };
      }
      return true;
    });
  }

  function createFocusManager() {
    let globalFocusInfo = null;
    let capturedForCommit = false;
    function captureFocusOnce() {
      if (capturedForCommit) return globalFocusInfo;
      const active = document.activeElement;
      if (!active || active === document.body) {
        globalFocusInfo = null;
      } else {
        globalFocusInfo = {
          element: active,
          id: active.id || null,
          name: active.getAttribute ? active.getAttribute('name') : null,
          tagName: active.tagName ? active.tagName.toLowerCase() : null,
          selStart: ("selectionStart" in active) ? active.selectionStart : null,
          selEnd: ("selectionEnd" in active) ? active.selectionEnd : null,
          value: ('value' in active) ? active.value : null
        };
      }
      capturedForCommit = true;
      return globalFocusInfo;
    }
    function findFocusTarget(root, info) {
      if (!root || !info) return null;
      let target = null;
      if (info.id) {
        target = root.querySelector(`#${CSS.escape(info.id)}`);
        if (target) return target;
      }
      if (info.name) {
        target = root.querySelector(`[name="${CSS.escape(info.name)}"]`);
        if (target) return target;
      }
      if (info.value && (info.tagName === 'input' || info.tagName === 'textarea')) {
        const candidates = root.querySelectorAll(info.tagName);
        for (const candidate of candidates) {
          if (candidate.value === info.value) {
            return candidate;
          }
        }
      }
      return null;
    }
    function restoreFocus(root, info) {
      const target = findFocusTarget(root, info);
      if (!target) return false;
      try {
        target.focus();
        if (info.selStart !== null && "setSelectionRange" in target) {
          setTimeout(() => { try { target.setSelectionRange(info.selStart, info.selEnd); } catch (_) {} }, 0);
        }
        return true;
      } catch (_) { return false; }
    }
    function resetForNextCommit() { globalFocusInfo = null; capturedForCommit = false; }
    return { captureFocusOnce, findFocusTarget, restoreFocus, resetForNextCommit };
  }

  function postSync(root) {
    if (!root) return;
    root.querySelectorAll("select").forEach(sel => {
      const raw = sel.getAttribute("data-value") ?? sel.getAttribute("value");
      if (raw == null) return;
      sel.value = raw;
    });
  }

  function createAuditor(logCapacity = 1500, maxStats = 2000) {
    const log = createRing(logCapacity);
    const stats = new Map();
    function ensure(k) {
      if (!stats.has(k)) {
        if (stats.size >= maxStats) stats.delete(stats.keys().next().value);
        stats.set(k, { commits: 0, lastMs: 0, avgMs: 0, slowCount: 0, errors: 0, violations: 0 });
      }
      return stats.get(k);
    }
    function onCommit(k, ms, budget) {
      const st = ensure(k);
      st.commits++;
      st.lastMs = ms;
      st.avgMs = st.avgMs ? (st.avgMs * 0.9 + ms * 0.1) : ms;
      const max = (budget && budget.maxMs) || 32;
      if (ms > max) st.slowCount++;
      log.push({ t: Date.now(), key: k, ms });
    }
    function onViolation(k, n = 1) { ensure(k).violations += n; }
    function onError(k) { ensure(k).errors++; }
    function getSnapshot() {
      const out = { instances: {}, log: log.tail(300) };
      for (const [k, v] of stats) out.instances[k] = { ...v };
      return out;
    }
    return { onCommit, onViolation, onError, getSnapshot, stats, log };
  }

  function createAttrDelegator() {
    const MAP = [
      ["click", "onclick"],
      ["change", "onchange"],
      ["input", "oninput"],
      ["submit", "onsubmit", true],
      ["keydown", "onkeydown"],
      ["pointerdown", "onpointerdown"]
    ];
    return function attach(root, dispatch, options = {}) {
      const prefix = options.attrPrefix || "data-";
      const offs = [];
      for (const [type, attr, prevent] of MAP) {
        const handler = (e) => {
          const sel = `[${prefix}${attr}]`;
          let el = e.target && (e.target.closest ? e.target.closest(sel) : null);
          if (!el || !root.contains(el)) return;
          const name = el.getAttribute(prefix + attr);
          if (!name) return;
          if (prevent) e.preventDefault();
          dispatch(name, e, el);
        };
        root.addEventListener(type, handler, true);
        offs.push(() => root.removeEventListener(type, handler, true));
      }
      return () => { for (const off of offs) off(); };
    };
  }

  function createEnv(opts = {}) {
    const rtl = new Set(["ar", "fa", "he", "ur"]);
    const persist = !!opts.persistEnv;
    const storeKey = "mishkah.env";
    const dictionaries = opts.dictionaries || {};
    function load() { try { return persist ? JSON.parse(localStorage.getItem(storeKey)) : null } catch (e) { return null } }
    let state = { locale: opts.locale || "en", dir: opts.dir || "auto", theme: opts.theme || "auto", ...load() };
    const listeners = new Set();
    function resolvedDir() { return state.dir === "auto" ? (rtl.has((state.locale || "").split("-")[0]) ? "rtl" : "ltr") : state.dir }
    function resolvedTheme() { if (state.theme !== "auto") return state.theme; return (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light" }
    function applyToDOM() {
      const root = document.documentElement;
      if (!root) return;
      const d = resolvedDir(), th = resolvedTheme();
      root.setAttribute("dir", d);
      root.setAttribute("lang", state.locale);
      root.setAttribute("data-theme", th);
      root.classList.toggle('dark', th === 'dark');
    }
    function persistNow() { if (persist) try { localStorage.setItem(storeKey, JSON.stringify(state)) } catch (e) {} }
    function notify() { listeners.forEach(fn => fn(get())) }
    function get() { return { ...state, resolved: { dir: resolvedDir(), theme: resolvedTheme() } } }
    function setLocale(loc) { state.locale = loc; persistNow(); applyToDOM(); notify(); }
    function setTheme(t) { state.theme = t; persistNow(); applyToDOM(); notify(); }
    function toggleTheme() { setTheme(resolvedTheme() === 'dark' ? 'light' : 'dark'); }
    function subscribe(cb) { listeners.add(cb); return () => listeners.delete(cb) }
    function getPathDict(obj, path) { return String(path).split(".").reduce((acc, part) => acc && acc[part], obj); }
    function interpolate(s, vars) { if (!vars) return s; return String(s).replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`)); }
    function translate(key, vars) {
      const keyTranslations = getPathDict(dictionaries, key);
      const langChain = Array.from(new Set([state.locale, (state.locale || '').split('-')[0], 'en']));
      if (keyTranslations !== undefined && typeof keyTranslations === 'object') {
        for (const lang of langChain) {
          if (typeof keyTranslations[lang] === 'string') {
            return interpolate(keyTranslations[lang], vars);
          }
        }
      }
      const fallbackText = String(key).replace(/_/g, ' ');
      return interpolate(fallbackText, vars);
    }
    applyToDOM();
    if (window.matchMedia) {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const onChange = () => { if (state.theme === "auto") { applyToDOM(); notify(); } };
      if (mq.addEventListener) mq.addEventListener("change", onChange);
      else if (mq.addListener) mq.addListener(onChange);
    }
    const i18n = { t: translate };
    return { get, setLocale, setTheme, toggleTheme, subscribe, i18n };
  }

  function createEngine(truth, guardian, auditor) {
    const instances = new Map();
    const groups = new Map();
    const toNode = window.Mishkah && window.Mishkah.Atoms && window.Mishkah.Atoms.toNode;
    const focusManager = createFocusManager();

    function addToGroups(key, props) {
      const groupKeys = asArray(props && props.groupKey);
      for (const gk of groupKeys) {
        if (!groups.has(gk)) groups.set(gk, new Set());
        groups.get(gk).add(key);
      }
    }
    function removeFromGroups(key, props) {
      const groupKeys = asArray(props && props.groupKey);
      for (const gk of groupKeys) {
        const set = groups.get(gk);
        if (set) {
          set.delete(key);
          if (set.size === 0) groups.delete(gk);
        }
      }
    }

    function registerInstance(key, instanceData) {
      instances.set(key, instanceData);
      addToGroups(key, instanceData.props);
    }

    function unregisterInstance(key) {
      const instance = instances.get(key);
      if (!instance) return;
      removeFromGroups(key, instance.props);
      if (instance.domElement && instance.domElement.parentNode) {
        instance.domElement.parentNode.removeChild(instance.domElement);
      }
      instances.delete(key);
      auditor.stats.delete(key);
    }

    function updateInstanceProps(key, newProps, newSlots) {
      const inst = instances.get(key);
      if (!inst) return;
      removeFromGroups(key, inst.props);
      inst.props = newProps || inst.props;
      inst.slots = newSlots || inst.slots;
      addToGroups(key, inst.props);
    }

    function getKeys() {
      const keys = Array.from(instances.keys());
      const groupMap = {};
      for (const [gk, set] of groups.entries()) groupMap[gk] = Array.from(set);
      return { keys, groups: groupMap };
    }

    const qPatch = new Set();
    const qRebuild = new Set();
    let scheduledPatch = false;
    let scheduledRebuild = false;

    function flushQueue(setOfKeys, mode, state, focusInfo, focusedKey) {
      for (const key of setOfKeys) {
        const instance = instances.get(key);
        if (!instance || !instance.domElement || !toNode) continue;
        const t0 = now();
        try {
          const newSpec = instance.buildFn(state, { uKey: key });
          const newNode = toNode(newSpec);
          instance.domElement.replaceChildren(newNode);
          postSync(instance.domElement);
          if (focusedKey === key && focusInfo) {
            focusManager.restoreFocus(instance.domElement, focusInfo);
          }
          const ms = now() - t0;
          auditor.onCommit(key, ms, instance.props.budget);
          const vs = guardian.validate({ key, metrics: { lastMs: ms }, budget: instance.props.budget });
          if (vs.length) auditor.onViolation(key, vs.length);
        } catch (err) {
          auditor.onError(key);
          instance.domElement.innerHTML = `<div style="color:red;border:1px solid red;padding:8px;font-family:monospace;">Error in entity "${key}": ${err.message}</div>`;
        }
      }
      setOfKeys.clear();
      if (qPatch.size === 0 && qRebuild.size === 0) {
        focusManager.resetForNextCommit();
      }
    }

    function commit(state, dirtyMap) {
      if (!dirtyMap || dirtyMap.size === 0 || !toNode) return;
      const entries = Array.from(dirtyMap);
      const focusInfo = focusManager.captureFocusOnce();
      let focusedInstanceKey = null;
      if (focusInfo && focusInfo.element) {
        for (const [key] of entries) {
          const inst = instances.get(key);
          if (inst && inst.domElement && inst.domElement.contains(focusInfo.element)) { focusedInstanceKey = key; break; }
        }
      }
      for (const [key, mode] of entries) {
        if (mode === 'rebuild') qRebuild.add(key); else qPatch.add(key);
      }
      if (qPatch.size && !scheduledPatch) {
        scheduledPatch = true;
        queueMicrotask(() => {
          scheduledPatch = false;
          flushQueue(qPatch, 'patch', state, focusInfo, focusedInstanceKey);
        });
      }
      if (qRebuild.size && !scheduledRebuild) {
        scheduledRebuild = true;
        const run = () => { scheduledRebuild = false; flushQueue(qRebuild, 'rebuild', state, focusInfo, focusedInstanceKey); };
        if ('requestIdleCallback' in window) requestIdleCallback(run, { timeout: 90 }); else requestAnimationFrame(run);
      }
    }

    return { registerInstance, unregisterInstance, updateInstanceProps, commit, getKeys, instances };
  }

  function Emitter() {
    const m = new Map();
    return {
      on(e, f) { (m.get(e) || m.set(e, new Set()).get(e)).add(f); return () => this.off(e, f); },
      off(e, f) { const s = m.get(e); if (s) s.delete(f); },
      emit(e, p) { const s = m.get(e); if (s) s.forEach(f => { try { f(p); } catch (err) { console.error('[Mishkah.lifecycle] listener error', err); } }); }
    };
  }

  function createMessenger(truth, app) {
    const reg = new WeakMap();
    function use(el, cfg = {}) {
      const ctx = { value: undefined };
      if (typeof cfg.setup === 'function') ctx.value = cfg.setup(el, app) || undefined;
      if (typeof cfg.effect === 'function') cfg.effect(el, truth.get(), app, { ctx, init: true });
      const off = truth.subscribe(({ state, dirty }) => {
        if (!el.isConnected) {
          off(); reg.delete(el); if (typeof cfg.teardown === 'function') cfg.teardown(el, app, { ctx }); return;
        }
        if (!cfg.filter || cfg.filter({ state, dirty, app })) {
          if (typeof cfg.effect === 'function') cfg.effect(el, state, app, { ctx });
        }
      });
      reg.set(el, off);
      return () => { const f = reg.get(el); if (f) f(); reg.delete(el); if (typeof cfg.teardown === 'function') cfg.teardown(el, app, { ctx }); };
    }
    return { use };
  }

  function escapeSanitize(html) {
    const t = document.createElement('div');
    t.textContent = html == null ? '' : String(html);
    return t.innerHTML;
  }

  function basicSanitize(html, policy = {}) {
    if (html == null) return '';
    const allowedTags = new Set((policy.allowedTags || [
      'a','abbr','b','bdi','bdo','br','cite','code','data','dfn','em','i','kbd','mark','q','rp','rt','ruby','s','samp','small','span','strong','sub','sup','time','u','var','wbr',
      'p','div','pre','blockquote','hr',
      'h1','h2','h3','h4','h5','h6',
      'ul','ol','li','dl','dt','dd',
      'table','thead','tbody','tfoot','tr','th','td','colgroup','col','caption',
      'img','figure','figcaption','picture','source',
      'label','input','select','option','optgroup','textarea','button'
    ]).map(String));
    const allowedAttrs = new Set((policy.allowedAttrs || [
      'id','class','dir','lang','title','role','tabindex',
      'name','value','type','placeholder','checked','disabled','readonly','multiple','maxlength','minlength','min','max','step','pattern','size','for',
      'href','target','rel','download','src','srcset','sizes','alt','width','height','loading','decoding','referrerpolicy','poster','preload','controls','loop','muted','playsinline'
    ]).map(String));
    const allowDataUri = !!policy.allowDataUri;
    const root = document.createElement('div');
    root.innerHTML = String(html);
    const isJSProtocol = (v) => String(v || '').trim().toLowerCase().startsWith('javascript:');
    const isRelativeURL = (v) => /^(#|\?|\/|\.\.?\/)/.test(String(v || ''));
    const isMailOrTel = (v) => /^(mailto:|tel:)/i.test(String(v || ''));
    const isSafeURL = (v) => {
      if (!v) return false;
      if (isJSProtocol(v)) return false;
      if (isRelativeURL(v) || isMailOrTel(v)) return true;
      try {
        const u = new URL(v, window.location.origin);
        if (u.protocol === 'http:' || u.protocol === 'https:') return true;
        if (allowDataUri && u.protocol === 'data:') return true;
        return false;
      } catch { return false; }
    };
    function scrubSrcset(value) {
      if (!value) return '';
      const parts = String(value).split(',');
      const kept = [];
      for (const part of parts) {
        const segs = part.trim().split(/\s+/);
        const url = segs[0];
        if (isSafeURL(url)) kept.push(part.trim());
      }
      return kept.join(', ');
    }
    (function walk(node){
      const children = Array.from(node.childNodes);
      for (const n of children) {
        if (n.nodeType === 1) {
          const tag = n.tagName.toLowerCase();
          if (!allowedTags.has(tag)) { n.remove(); continue; }
          for (const attr of Array.from(n.attributes)) {
            const name = attr.name.toLowerCase();
            const value = attr.value;
            if (name.startsWith('on')) { n.removeAttribute(attr.name); continue; }
            if (name.startsWith('aria-') || name.startsWith('data-')) { continue; }
            if (!allowedAttrs.has(name)) { n.removeAttribute(attr.name); continue; }
            if (name === 'href' || name === 'src') {
              if (!isSafeURL(value)) { n.removeAttribute(attr.name); continue; }
            }
            if (name === 'srcset') {
              const clean = scrubSrcset(value);
              if (clean) n.setAttribute('srcset', clean); else n.removeAttribute('srcset');
            }
            if (name === 'target') {
              if (String(value).toLowerCase() === '_blank') {
                const curRel = n.getAttribute('rel') || '';
                const set = new Set(curRel.split(/\s+/).filter(Boolean));
                set.add('noopener'); set.add('noreferrer');
                n.setAttribute('rel', Array.from(set).join(' '));
              }
            }
            if (name === 'style') {
              n.removeAttribute('style');
            }
          }
          walk(n);
        } else if (n.nodeType === 3) {
        } else {
          n.remove();
        }
      }
    })(root);
    return root.innerHTML;
  }

  function createApp(opts = {}) {
    const A = window.Mishkah && window.Mishkah.Atoms;
    const truth = createTruth(opts.initial || {}, { strictState: !!opts.strictState, devFreeze: !!opts.devFreeze });
    const guardian = createGuardian();
    const auditor = createAuditor(opts.logCapacity || 1500, opts.maxStats || 2000);
    const engine = createEngine(truth, guardian, auditor);
    const env = createEnv(opts);
    const life = Emitter();
    let sanitizeHTML;
    if (typeof opts.sanitizeHTML === 'function') { sanitizeHTML = opts.sanitizeHTML; }
    else if (opts.sanitizeMode === 'basic') { sanitizeHTML = (html) => basicSanitize(html, opts.sanitizePolicy); }
    else { sanitizeHTML = escapeSanitize; }
    const origSet = truth.set;
    truth.set = (p) => { life.emit('plan', { prev: truth.get(), updater: p }); return origSet(p); };
    if (opts.perfPolicy) addPerformancePolicy(guardian, opts.perfPolicy);
    truth.bindKeysProvider(engine.getKeys);
    let helpersRef = opts.helpers || {};
    const coreContext = { truth, guardian, auditor, engine, env, A, i18n: env.i18n, helpers: helpersRef, sanitizeHTML };
    const commands = opts.commands || {};
    function dispatch(name, e, el) {
      const cmd = commands[name];
      if (cmd) { try { cmd({ ...coreContext, call: enhancedCall, dispatch }, e, el); } catch (err) { console.error(`[Mishkah] Command error in "${name}":`, err); } }
    }
    function enhancedCall(name, props = {}, slots = {}) {
      const C = window.Mishkah && window.Mishkah.Comp;
      if (!C || !C.define) throw new Error("Mishkah.Comp is not available.");
      const componentFn = C.registry[name];
      if (!componentFn) return A.h('div', {}, `Component ${name} not found`);
      const key = props.uniqueKey;
      if (key) {
        let instance = engine.instances.get(key);
        const buildFn = (state, ctx) => componentFn(A, state, { ...coreContext, call: enhancedCall, dispatch }, props, slots);
        if (!instance) {
          instance = { buildFn, props, slots, domElement: null };
          engine.registerInstance(key, instance);
        } else {
          instance.buildFn = buildFn;
          engine.updateInstanceProps(key, props, slots);
        }
        const dataAttrs = {};
        dataAttrs['data-m-k'] = key;
        if (props.groupKey) dataAttrs['data-m-g'] = asArray(props.groupKey).join(' ');
        return A.Div({
          ...dataAttrs,
          onMounted: (el) => {
            const i = engine.instances.get(key);
            if (!i) return;
            i.domElement = el;
            const initialSpec = i.buildFn(truth.get(), { uKey: key });
            const initialNode = A.toNode(initialSpec);
            el.replaceChildren(initialNode);
            postSync(el);
          },
          onUnmounted: () => {
            const i = engine.instances.get(key);
            if (i) i.domElement = null;
          }
        }, { default: [] });
      } else {
        return componentFn(A, truth.get(), { ...coreContext, call: enhancedCall, dispatch }, props, slots);
      }
    }
    coreContext.call = enhancedCall;
    coreContext.dispatch = dispatch;
    const messenger = createMessenger(truth, { ...coreContext, call: enhancedCall, dispatch });
    let detachDelegation = null;
    if (opts.mount) {
      const mountEl = typeof opts.mount === 'string' ? document.querySelector(opts.mount) : opts.mount;
      if (mountEl) {
        if (opts.rootComponent) {
          const rootSpec = enhancedCall(opts.rootComponent, { uniqueKey: 'app-root' });
          const rootNode = A.toNode(rootSpec);
          if (rootNode) mountEl.appendChild(rootNode);
        }
        const delegator = createAttrDelegator(window.Mishkah && window.Mishkah.utils);
        detachDelegation = delegator(mountEl, dispatch);
      }
    }
    truth.subscribe(({ state, dirty }) => engine.commit(state, dirty));
    env.subscribe(() => truth.rebuildAll());
    const finalAppObject = {
      truth,
      engine,
      env,
      i18n: env.i18n,
      lifecycle: { on: life.on, off: life.off, emit: life.emit },
      devtools: {
        getSnapshot: auditor.getSnapshot,
        printSummary: () => {
          const s = auditor.getSnapshot();
          const rows = Object.entries(s.instances).map(([k, v]) => ({ key: k, commits: v.commits, avgMs: +(v.avgMs || 0).toFixed(2), lastMs: +(v.lastMs || 0).toFixed(2), slow: v.slowCount, errors: v.errors, viol: v.violations }));
          console.table(rows);
        }
      },
      destroy: () => {
        if (detachDelegation) detachDelegation();
        Array.from(engine.instances.keys()).forEach(key => engine.unregisterInstance(key));
        const mountEl = typeof opts.mount === 'string' ? document.querySelector(opts.mount) : opts.mount;
        if (mountEl) mountEl.innerHTML = '';
      },
      messenger,
      call: enhancedCall,
      dispatch,
      helpers: opts.helpers || {},
      sanitizeHTML
    };
    Object.defineProperty(finalAppObject, 'helpers', {
      get() { return helpersRef },
      set(v) { helpersRef = v || {}; coreContext.helpers = helpersRef; },
      enumerable: true
    });
    return finalAppObject;
  }

  window.Mishkah = window.Mishkah || {};
  window.Mishkah.Core = {
    createApp,
    createTruth,
    createGuardian,
    createAuditor,
    createEnv,
    addPerformancePolicy,
    createMessenger,
    utils: { now, asArray, createRing, basicSanitize }
  };
})(window);
