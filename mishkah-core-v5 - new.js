/*!
 * بسم الله الرحمن الرحيم
 * Mishkah Core - v5R UMD (Single-file, 9 logical modules)
 * - Fully backward compatible: exports under window.Mishkah.Core
 * - Can be split later into files: truth, guardian, auditor, env, dom, vdom, engine, app, extras
 */

/* ==========================================================================
   Module 0: shared utilities (used by multiple modules)
   ========================================================================== */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) { define([], function(){ return factory(root); }); }
  else if (typeof module === 'object' && module.exports) { module.exports = factory(root); }
  else { factory(root); }
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';
  var M = root.Mishkah = root.Mishkah || {};
  var Core = M.Core = M.Core || {};
  var U = Core._util = Core._util || {};

  U.perf = (typeof root.performance !== "undefined" && root.performance) || { now: Date.now, mark: function(){}, measure: function(){} };
  U.now = function(){ return U.perf.now(); };
  U.asArray = function(v){ return v == null ? [] : Array.isArray(v) ? v : String(v).split(',').map(function(s){return s.trim();}).filter(Boolean); };
  U.createRing = function(cap){
    var a = []; cap = cap || 500;
    return {
      push: function(x){ if (a.length === cap) a.shift(); a.push(x); },
      tail: function(n){ n = n || cap; return a.slice(-n); },
      size: function(){ return a.length; }
    };
  };
  U.assign = function(t){ for (var i=1;i<arguments.length;i++){ var s=arguments[i]||{}; for (var k in s){ if (Object.prototype.hasOwnProperty.call(s,k)) t[k]=s[k]; } } return t; };
  U.clone = function(obj){
    try { if (typeof structuredClone === 'function') return structuredClone(obj); } catch(_){}
    try { return JSON.parse(JSON.stringify(obj)); } catch(_){}
    return obj;
  };
  return Core._util;
});

/* ==========================================================================
   Module 0b: Unified Component Registry Shim (back-compat for M.Comp / M.Components)
   ========================================================================== */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) { define([], function(){ return factory(root); }); }
  else if (typeof module === 'object' && module.exports) { module.exports = factory(root); }
  else { factory(root); }
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';
  var M = root.Mishkah = root.Mishkah || {};
  var Core = M.Core = M.Core || {};

  function createComponentRegistry(){
    var reg = Object.create(null);
    function define(name, fn){ reg[name] = fn; return function(){ delete reg[name]; }; }
    function get(name){ return reg[name]; }
    function list(){ return Object.keys(reg); }
    return { reg: reg, define: define, get: get, list: list };
  }

  var _registry = Core._compRegistry || createComponentRegistry();
  Core._compRegistry = _registry;

  // Merge any pre-existing registries (from old builds)
  try {
    if (M.Comp && M.Comp.registry) { for (var k in M.Comp.registry){ _registry.reg[k] = M.Comp.registry[k]; } }
    if (M.Components && M.Components.registry) { for (var k2 in M.Components.registry){ _registry.reg[k2] = M.Components.registry[k2]; } }
  } catch(_){}

  function makeFacade(existing){
    var target = existing || {};
    try { Object.defineProperty(target, 'registry', { configurable:true, get: function(){ return _registry.reg; } }); }
    catch(_){ target.registry = _registry.reg; }
    target.define = function(name, fn){ return _registry.define(name, fn); };
    // 'call' is attached later by createApp
    return target;
  }

  try {
    var _compFacade = makeFacade(M.Comp);
    var _componentsFacade = makeFacade(M.Components);

    Object.defineProperty(M, 'Comp', {
      configurable: true,
      get: function(){ return _compFacade; },
      set: function(v){
        try {
          if (v && v.registry) { for (var k in v.registry){ _registry.reg[k] = v.registry[k]; } }
        } catch(_){}
        _compFacade = makeFacade(v);
        if (Core._enhancedCall) _compFacade.call = Core._enhancedCall;
      }
    });
    Object.defineProperty(M, 'Components', {
      configurable: true,
      get: function(){ return _componentsFacade; },
      set: function(v){
        try {
          if (v && v.registry) { for (var k in v.registry){ _registry.reg[k] = v.registry[k]; } }
        } catch(_){}
        _componentsFacade = makeFacade(v);
        if (Core._enhancedCall) _componentsFacade.call = Core._enhancedCall;
      }
    });

    // Initialize both aliases
    M.Comp = _compFacade;
    M.Components = _componentsFacade;
  } catch(e){
    // Very old browsers fallback
    M.Comp = makeFacade(M.Comp || {});
    M.Components = M.Comp;
  }
});

/* ==========================================================================
   Module 1: Truth (state & invalidation)
   ========================================================================== */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) { define(['mishkah-core-util'], function(){ return factory(root); }); }
  else if (typeof module === 'object' && module.exports) { module.exports = factory(root); }
  else { factory(root); }
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';
  var M = root.Mishkah = root.Mishkah || {};
  var Core = M.Core = M.Core || {};
  var U = Core._util;

  function createTruth(initial, options){
    options = options || {};
    var state = initial || {};
    var subs = new Set();
    var dirty = new Map();          // key -> 'patch' | 'rebuild'
    var frozen = new Set();
    var keysProvider = function(){ return {keys:[], groups:{}}; };
    var batching = 0, scheduled = false;
    var strict = !!options.strictState;

    function get(){ return state; }
    function set(p){
      var next = (typeof p === 'function') ? p(state) : p;
      if (strict && (next===undefined || next===null || typeof next!=='object')) {
        throw new Error('[Mishkah] truth.set() strictState expects an object.');
      }
      if (next !== state){
        if (strict) state = next;
        else state = U.assign({}, state, next);
        schedule();
      }
    }
    function produce(mutator){
      var base = U.clone(state);
      mutator && mutator(base);
      set(base);
    }
    function _resolve(selectors){
      var reg = keysProvider();
      var all = new Set(reg.keys || []);
      var out = new Set();
      U.asArray(selectors).forEach(function(sel){
        if (!sel) return;
        sel = String(sel);
        if (sel === 'all'){ (reg.keys||[]).forEach(function(k){ out.add(k); }); return; }
        if (sel[0]==='.') (reg.groups[sel.slice(1)]||[]).forEach(function(k){ out.add(k); });
        else out.add(sel[0]==='#' ? sel.slice(1) : sel);
      });
      return { out: out, all: all };
    }
    function mark(selectors, options){
      options = options || {};
      var T = _resolve(selectors);
      var E = _resolve(options.except);
      Array.from(T.out).forEach(function(k){
        if (!E.out.has(k) && !frozen.has(k)) dirty.set(k, 'patch');
      });
      if (!batching) schedule();
    }
    function rebuild(selectors, options){
      options = options || {};
      var T = _resolve(selectors);
      var E = _resolve(options.except);
      Array.from(T.out).forEach(function(k){
        if (!E.out.has(k) && !frozen.has(k)) dirty.set(k, 'rebuild');
      });
      if (!batching) schedule();
    }
    function rebuildAll(filter){
      filter = filter || function(){ return true; };
      (keysProvider().keys||[]).forEach(function(k){ if (!frozen.has(k) && filter(k)) dirty.set(k,'rebuild'); });
      if (!batching) schedule();
    }
    function rebuildAllExcept(excepts){
      var E = _resolve(excepts);
      rebuildAll(function(k){ return !E.out.has(k); });
    }
    function freeze(k){ U.asArray(k).forEach(function(x){ frozen.add(String(x)[0]==='#'?String(x).slice(1):String(x)); }); }
    function unfreeze(k){ U.asArray(k).forEach(function(x){ frozen.delete(String(x)[0]==='#'?String(x).slice(1):String(x)); }); }
    function batch(fn){ batching++; try{ fn && fn(); } finally { batching--; if (!batching) schedule(); } }
    function bindKeysProvider(fn){ keysProvider = fn || function(){ return {keys:[],groups:{}}; }; }
    function schedule(){
      if (scheduled) return;
      scheduled = true;
      queueMicrotask(function(){
        scheduled = false;
        var d = new Map(dirty); dirty.clear();
        subs.forEach(function(s){ try{ s({state: state, dirty: d, frozen: new Set(frozen) }); }catch(e){ console.error('[Mishkah] Truth subscriber error', e);} });
      });
    }
    function subscribe(fn){ subs.add(fn); try{ fn({state:state, dirty:new Map(), frozen:new Set(frozen)});}catch(_){} return function(){ subs.delete(fn); }; }

    return { get:get, set:set, produce:produce, mark:mark, rebuild:rebuild, rebuildAll:rebuildAll, rebuildAllExcept:rebuildAllExcept, batch:batch, freeze:freeze, unfreeze:unfreeze, subscribe:subscribe, bindKeysProvider:bindKeysProvider };
  }

  Core.createTruth = createTruth;
  return createTruth;
});

/* ==========================================================================
   Module 2: Guardian (+ performance policy)
   ========================================================================== */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) { define([], function(){ return factory(root); }); }
  else if (typeof module === 'object' && module.exports) { module.exports = factory(root); }
  else { factory(root); }
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';
  var M = root.Mishkah = root.Mishkah || {};
  var Core = M.Core = M.Core || {};

  function createGuardian(){
    var rules = []; var mode = 'warn';
    function addRule(name, fn){ rules.push({name:name, fn:fn}); }
    function setMode(m){ mode = (m==='strict') ? 'strict' : 'warn'; }
    function validate(entry){
      var errs = [];
      for (var i=0;i<rules.length;i++){
        var r = rules[i];
        try{
          var res = r.fn(entry);
          if (res === true) continue;
          if (res === false) errs.push({ rule:r.name, msg:'violation' });
          else if (res && res.violation) errs.push({ rule:r.name, msg: res.msg||'violation', meta: res.meta });
        }catch(e){ errs.push({ rule:r.name, msg:String(e) }); }
      }
      if (mode==='strict' && errs.length) { var err=new Error('policy violation'); err.violations=errs; throw err; }
      return errs;
    }
    return { addRule: addRule, setMode: setMode, validate: validate };
  }
  function addPerformancePolicy(guardian, defaults){
    defaults = defaults || {}; var maxMsDefault = (defaults.maxMs == null ? 32 : +defaults.maxMs);
    guardian.addRule('max-commit-ms', function(entry){
      var last = +(entry.metrics && entry.metrics.lastMs || 0);
      var budget = entry.budget || {};
      var maxMs = (budget.maxMs != null) ? budget.maxMs : maxMsDefault;
      if (last > maxMs) return { violation:true, msg:'commit too slow', meta:{ key:entry.key, lastMs:last, budget:{ maxMs:maxMs } } };
      return true;
    });
  }

  Core.createGuardian = createGuardian;
  Core.addPerformancePolicy = addPerformancePolicy;
  return { createGuardian:createGuardian, addPerformancePolicy:addPerformancePolicy };
});

/* ==========================================================================
   Module 3: Auditor (metrics + log)
   ========================================================================== */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) { define([], function(){ return factory(root); }); }
  else if (typeof module === 'object' && module.exports) { module.exports = factory(root); }
  else { factory(root); }
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';
  var M = root.Mishkah = root.Mishkah || {};
  var Core = M.Core = M.Core || {};
  var U = Core._util;

  function createAuditor(){
    var log = U.createRing(1500), stats = new Map();
    function ensure(k){ if(!stats.has(k)) stats.set(k, { commits:0, lastMs:0, avgMs:0, slowCount:0, errors:0, violations:0 }); return stats.get(k); }
    function onCommit(k, ms, budget){ var st=ensure(k); st.commits++; st.lastMs=ms; st.avgMs=st.avgMs?(st.avgMs*0.9+ms*0.1):ms; var max=(budget&&budget.maxMs)||32; if(ms>max) st.slowCount++; }
    function onViolation(k,n){ ensure(k).violations += (n||1); }
    function onError(k){ ensure(k).errors++; }
    function getSnapshot(){ var out={ instances:{}, log: log.tail(300) }; stats.forEach(function(v,k){ out.instances[k] = { commits:v.commits, lastMs:v.lastMs, avgMs:v.avgMs, slowCount:v.slowCount, errors:v.errors, violations:v.violations }; }); return out; }
    return { onCommit:onCommit, onViolation:onViolation, onError:onError, getSnapshot:getSnapshot, stats:stats, log:log };
  }

  Core.createAuditor = createAuditor;
  return createAuditor;
});

/* ==========================================================================
   Module 4: Env + i18n
   ========================================================================== */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) { define([], function(){ return factory(root); }); }
  else if (typeof module === 'object' && module.exports) { module.exports = factory(root); }
  else { factory(root); }
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';
  var M = root.Mishkah = root.Mishkah || {};
  var Core = M.Core = M.Core || {};

  function createEnv(opts){
    opts = opts || {};
    var rtl = new Set(['ar','fa','he','ur']);
    var persist = !!opts.persistEnv;
    var storeKey = 'mishkah.env';
    var dictionaries = opts.dictionaries || {};

    function load(){ try{ return persist ? JSON.parse(localStorage.getItem(storeKey)) : null }catch(_){ return null; } }

    var state = Object.assign({ locale: opts.locale || 'en', dir: opts.dir || 'auto', theme: opts.theme || 'auto' }, load()||{});
    var listeners = new Set();

    function resolvedDir(){ return state.dir==='auto' ? (rtl.has((state.locale||'').split('-')[0]) ? 'rtl' : 'ltr') : state.dir; }
    function resolvedTheme(){ if (state.theme!=='auto') return state.theme; return (root.matchMedia && root.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light'; }

    function applyToDOM(){
      var doc=root.document; if(!doc||!doc.documentElement) return;
      var r=doc.documentElement, d=resolvedDir(), th=resolvedTheme();
      r.setAttribute('dir', d); r.setAttribute('lang', state.locale); r.setAttribute('data-theme', th);
      r.classList.toggle('dark', th==='dark');
    }
    function persistNow(){ if (persist) try{ localStorage.setItem(storeKey, JSON.stringify(state)); }catch(_){ } }
    function notify(){ listeners.forEach(function(fn){ try{ fn(get()); }catch(_){ } }); }

    function get(){ return Object.assign({}, state, { resolved:{ dir:resolvedDir(), theme:resolvedTheme() } }); }
    function setLocale(loc){ state.locale=loc; persistNow(); applyToDOM(); notify(); }
    function setTheme(t){ state.theme=t; persistNow(); applyToDOM(); notify(); }
    function toggleTheme(){ setTheme(resolvedTheme()==='dark'?'light':'dark'); }
    function subscribe(cb){ listeners.add(cb); return function(){ listeners.delete(cb); }; }

    function getPath(obj, path){ return String(path).split('.').reduce(function(acc,p){ return acc && acc[p]; }, obj); }
    function interpolate(s,vars){ if(!vars) return s; return String(s).replace(/\{(\w+)\}/g, function(_,k){ return (k in vars)? String(vars[k]) : '{'+k+'}'; }); }
    function translate(key,vars){
      var map = getPath(dictionaries, key); var chain = Array.from(new Set([state.locale, (state.locale||'').split('-')[0], 'en']));
      if (map && typeof map === 'object'){ for (var i=0;i<chain.length;i++){ var lang=chain[i]; if (typeof map[lang]==='string') return interpolate(map[lang], vars); } }
      var fallback = String(key).replace(/_/g,' ');
      return interpolate(fallback, vars);
    }

    applyToDOM();
    if (root.matchMedia){
      try{
        var mq=root.matchMedia('(prefers-color-scheme: dark)');
        var onChange=function(){ if (state.theme==='auto'){ applyToDOM(); notify(); } };
        if (mq.addEventListener) mq.addEventListener('change', onChange);
        else if (mq.addListener) mq.addListener(onChange);
      }catch(_){}
    }

    var i18n = { t: translate };
    return { get:get, setLocale:setLocale, setTheme:setTheme, toggleTheme:toggleTheme, subscribe:subscribe, i18n:i18n };
  }

  Core.createEnv = createEnv;
  return createEnv;
});

/* ==========================================================================
   Module 5: DOM helpers (focus/postSync/delegation)
   ========================================================================== */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) { define([], function(){ return factory(root); }); }
  else if (typeof module === 'object' && module.exports) { module.exports = factory(root); }
  else { factory(root); }
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';
  var M = root.Mishkah = root.Mishkah || {};
  var Core = M.Core = M.Core || {};

  function preserveFocus(rootEl){
    var ae = root.document && root.document.activeElement;
    if (!ae || !rootEl || !rootEl.contains || !rootEl.contains(ae)) return function(){};
    var info = { id: ae.id || null, name: ae.getAttribute && ae.getAttribute('name') || null,
      selStart: ('selectionStart' in ae) ? ae.selectionStart : null, selEnd: ('selectionEnd' in ae) ? ae.selectionEnd : null };
    return function(){
      if (!rootEl) return;
      var target = null;
      if (info.id)   target = rootEl.querySelector && rootEl.querySelector('[id="'+CSS.escape(info.id)+'"]');
      if (!target && info.name) target = rootEl.querySelector && rootEl.querySelector('[name="'+CSS.escape(info.name)+'"]');
      if (target && target.focus){ try{ target.focus(); if (info.selStart!=null && target.setSelectionRange) target.setSelectionRange(info.selStart, info.selEnd); }catch(_){ } }
    };
  }
  function postSync(rootEl){
    if (!rootEl || !rootEl.querySelectorAll) return;
    rootEl.querySelectorAll('select').forEach(function(sel){
      var raw = sel.getAttribute('data-value') || sel.getAttribute('value');
      if (raw != null) sel.value = raw;
    });
  }
  function createAttrDelegator(U){
    var EVT=[['click','onclick'],['change','onchange'],['input','oninput'],['submit','onsubmit',{preventDefault:true}],['keydown','onkeydown']];
    return function attach(rootEl, dispatch, options){
      options = options || {}; var prefix = options.attrPrefix || 'data-'; var offs = [];
      EVT.forEach(function(item){
        var type=item[0], attr=item[1], extra=item[2];
        var dataAttr = prefix + attr; var sel = '['+dataAttr+']';
        var handler = function(e, el){
          var name = el.getAttribute && el.getAttribute(dataAttr);
          if (typeof name === 'string' && name) dispatch(name, e, el);
        };
        var off = (U && U.delegate) ? U.delegate(rootEl, type, sel, handler, extra) : function(){};
        offs.push(off);
      });
      return function(){ offs.forEach(function(off){ try{ off && off(); }catch(_){ } }); };
    };
  }

  Core._dom = { preserveFocus:preserveFocus, postSync:postSync, createAttrDelegator:createAttrDelegator };
  return Core._dom;
});

/* ==========================================================================
   Module 6: VDOM (keyed diff, onMounted/onUnmounted)
   ========================================================================== */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) { define([], function(){ return factory(root); }); }
  else if (typeof module === 'object' && module.exports) { module.exports = factory(root); }
  else { factory(root); }
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';
  var M = root.Mishkah = root.Mishkah || {};
  var Core = M.Core = M.Core || {};

  var ELEMENT_NODE   = Symbol('mishkah.element');
  var TEXT_NODE      = Symbol('mishkah.text');
  var FRAGMENT_NODE  = Symbol('mishkah.fragment');
  var COMPONENT_NODE = Symbol('mishkah.component');
  var NULL_NODE      = Symbol('mishkah.null');

  function h(tag, props){
    props = props || {};
    var children = Array.prototype.slice.call(arguments,2).flat();
    if (typeof tag === 'function') return { type: COMPONENT_NODE, tag: tag, props: props, children: children, key: props.key };
    if (tag === FRAGMENT_NODE) return { type: FRAGMENT_NODE, tag: 'FRAGMENT', props: {}, children: children, key: props.key };
    var normalized = children.map(function(child){
      if (child == null || child === false) return { type: NULL_NODE, tag: 'NULL' };
      if (typeof child === 'string' || typeof child === 'number') return { type: TEXT_NODE, tag: 'TEXT', props:{ nodeValue:String(child) } };
      return child;
    });
    return { type: ELEMENT_NODE, tag: tag, props: props, children: normalized, key: props.key };
  }
  var Fragment = FRAGMENT_NODE;

  function updateProps($el, nProps, oProps){
    var all = Object.assign({}, oProps||{}, nProps||{});
    for (var key in all){
      if (key === 'children' || key==='key') continue;
      var nVal = nProps[key], oVal = oProps[key];
      if (nVal === oVal) continue;
      if (key.slice(0,2) === 'on'){
        var ev = key.slice(2).toLowerCase();
        if (oVal) $el.removeEventListener(ev, oVal);
        if (nVal) $el.addEventListener(ev, nVal);
      } else if (nVal == null || nVal === false){
        $el.removeAttribute(key);
      } else {
        $el.setAttribute(key, nVal);
      }
    }
  }

  function render(vNode){
    var $el;
    switch (vNode.type){
      case NULL_NODE: $el = document.createComment('NULL'); break;
      case TEXT_NODE: $el = document.createTextNode(vNode.props.nodeValue); break;
      case FRAGMENT_NODE:
        $el = document.createDocumentFragment();
        vNode.children.forEach(function(c){ $el.appendChild(render(c)); });
        break;
      case COMPONENT_NODE: {
        var sub = vNode.tag(Object.assign({}, vNode.props, { children: vNode.children }));
        $el = render(sub); vNode._renderedVNode = sub; break;
      }
      case ELEMENT_NODE:
        $el = document.createElement(vNode.tag);
        updateProps($el, vNode.props, {});
        vNode.children.forEach(function(c){ $el.appendChild(render(c)); });
        if (vNode.props && typeof vNode.props.onMounted === 'function') { try{ vNode.props.onMounted($el); }catch(_){ } }
        break;
      default: throw new Error('VDOM render: unknown node');
    }
    vNode._dom = ($el.nodeType === Node.DOCUMENT_FRAGMENT_NODE) ? Array.from($el.childNodes) : $el;
    return $el;
  }

  function patchChildren($parent, nChildren, oChildren){
    var oldStartIdx=0, newStartIdx=0;
    var oldEndIdx=oChildren.length-1, newEndIdx=nChildren.length-1;
    var oldStartVNode=oChildren[0], newStartVNode=nChildren[0];
    var oldEndVNode=oChildren[oldEndIdx], newEndVNode=nChildren[newEndIdx];
    var oldKeyToIdx;

    while (oldStartIdx<=oldEndIdx && newStartIdx<=newEndIdx){
      if (oldStartVNode === undefined){ oldStartVNode = oChildren[++oldStartIdx]; }
      else if (oldEndVNode === undefined){ oldEndVNode = oChildren[--oldEndIdx]; }
      else if (oldStartVNode.key === newStartVNode.key){
        patch($parent, newStartVNode, oldStartVNode, oldStartIdx);
        oldStartVNode = oChildren[++oldStartIdx]; newStartVNode = nChildren[++newStartIdx];
      } else if (oldEndVNode.key === newEndVNode.key){
        patch($parent, newEndVNode, oldEndVNode, oldEndIdx);
        oldEndVNode = oChildren[--oldEndIdx]; newEndVNode = nChildren[--newEndIdx];
      } else if (oldStartVNode.key === newEndVNode.key){
        patch($parent, newEndVNode, oldStartVNode, oldStartIdx);
        $parent.insertBefore(Array.isArray(oldStartVNode._dom)?oldStartVNode._dom[0]:oldStartVNode._dom, Array.isArray(oldEndVNode._dom)?oldEndVNode._dom[0].nextSibling:oldEndVNode._dom.nextSibling);
        oldStartVNode = oChildren[++oldStartIdx]; newEndVNode = nChildren[--newEndIdx];
      } else if (oldEndVNode.key === newStartVNode.key){
        patch($parent, newStartVNode, oldEndVNode, oldEndIdx);
        $parent.insertBefore(Array.isArray(oldEndVNode._dom)?oldEndVNode._dom[0]:oldEndVNode._dom, Array.isArray(oldStartVNode._dom)?oldStartVNode._dom[0]:oldStartVNode._dom);
        oldEndVNode = oChildren[--oldEndIdx]; newStartVNode = nChildren[++newStartIdx];
      } else {
        if (oldKeyToIdx === undefined){
          oldKeyToIdx = oChildren.reduce(function(acc,v,i){ if(v && v.key) acc[v.key]=i; return acc; }, Object.create(null));
        }
        var idxInOld = oldKeyToIdx[newStartVNode.key];
        if (idxInOld === undefined){
          $parent.insertBefore(render(newStartVNode), Array.isArray(oldStartVNode._dom)?oldStartVNode._dom[0]:oldStartVNode._dom);
        } else {
          var vnodeToMove = oChildren[idxInOld];
          patch($parent, newStartVNode, vnodeToMove, idxInOld);
          $parent.insertBefore(Array.isArray(vnodeToMove._dom)?vnodeToMove._dom[0]:vnodeToMove._dom, Array.isArray(oldStartVNode._dom)?oldStartVNode._dom[0]:oldStartVNode._dom);
          oChildren[idxInOld] = undefined;
        }
        newStartVNode = nChildren[++newStartIdx];
      }
    }
    if (oldStartIdx > oldEndIdx){
      var refNode = nChildren[newEndIdx+1] ? (Array.isArray(nChildren[newEndIdx+1]._dom)?nChildren[newEndIdx+1]._dom[0]:nChildren[newEndIdx+1]._dom) : null;
      for (var i=newStartIdx;i<=newEndIdx;i++) $parent.insertBefore(render(nChildren[i]), refNode);
    } else if (newStartIdx > newEndIdx){
      for (var j=oldStartIdx;j<=oldEndIdx;j++){
        if (oChildren[j]){
          var first = Array.isArray(oChildren[j]._dom) ? oChildren[j]._dom[0] : oChildren[j]._dom;
          if (oChildren[j].props && typeof oChildren[j].props.onUnmounted === 'function'){ try{ oChildren[j].props.onUnmounted(first); }catch(_){ } }
          var domToRemove = Array.isArray(oChildren[j]._dom) ? oChildren[j]._dom : [oChildren[j]._dom];
          domToRemove.forEach(function(n){ try{ n && n.remove && n.remove(); }catch(_){ } });
        }
      }
    }
  }

  function patch($parent, nVNode, oVNode){
    if (oVNode === undefined || oVNode.type === NULL_NODE) return $parent.appendChild(render(nVNode));
    var $real = Array.isArray(oVNode._dom) ? oVNode._dom[0] : oVNode._dom;

    if (nVNode === undefined || nVNode.type === NULL_NODE){
      if (oVNode.props && typeof oVNode.props.onUnmounted === 'function'){ try{ oVNode.props.onUnmounted($real); }catch(_){ } }
      var nodesToRemove = Array.isArray(oVNode._dom) ? oVNode._dom : [$real];
      nodesToRemove.forEach(function(node){ try{ node.remove(); }catch(_){ } });
      return;
    }
    if (nVNode.tag !== oVNode.tag || nVNode.type !== oVNode.type){
      if (oVNode.props && typeof oVNode.props.onUnmounted === 'function'){ try{ oVNode.props.onUnmounted($real); }catch(_){ } }
      var $new = render(nVNode);
      var toRemove = Array.isArray(oVNode._dom) ? oVNode._dom : [$real];
      $parent.replaceChild($new, toRemove[0]);
      toRemove.slice(1).forEach(function(n){ try{ n.remove(); }catch(_){ } });
      return;
    }
    nVNode._dom = oVNode._dom;
    if (nVNode.type === COMPONENT_NODE){
      var sub = nVNode.tag(Object.assign({}, nVNode.props, { children: nVNode.children }));
      patch($parent, sub, oVNode._renderedVNode);
      nVNode._renderedVNode = sub;
      return;
    }
    if (nVNode.type === TEXT_NODE){
      if (nVNode.props.nodeValue !== oVNode.props.nodeValue) $real.nodeValue = nVNode.props.nodeValue;
      return;
    }
    if (nVNode.type === ELEMENT_NODE){
      updateProps($real, nVNode.props, oVNode.props);
      patchChildren($real, nVNode.children, oVNode.children);
    }
  }

  Core._vdom = { h:h, Fragment:Fragment, render:render, patch:patch };
  return Core._vdom;
});

/* ==========================================================================
   Module 7: Engine (instances, groups, commit)
   ========================================================================== */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) { define([], function(){ return factory(root); }); }
  else if (typeof module === 'object' && module.exports) { module.exports = factory(root); }
  else { factory(root); }
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';
  var M = root.Mishkah = root.Mishkah || {};
  var Core = M.Core = M.Core || {};
  var U = Core._util, D = Core._dom, V = Core._vdom;

  function createEngine(truth, guardian, auditor){
    var instances = new Map();
    var groups = new Map();
    var toNode = M.Atoms && M.Atoms.toNode;

    // Optional slots adoption (placeholder data-m-slot)
    function collectSlotPlaceholders(root){
      var out=[];
      function add(el){ if(!el) return; if (el.getAttribute && el.hasAttribute('data-m-slot')) out.push(el); if (el.querySelectorAll) el.querySelectorAll('[data-m-slot]').forEach(function(n){ out.push(n); }); }
      if (root && root.nodeType===1) add(root);
      else if (root && root.nodeType===11) root.childNodes.forEach(function(n){ if (n.nodeType===1) add(n); });
      return out;
    }
    function adoptSlots(container){
      var nodes = collectSlotPlaceholders(container);
      nodes.forEach(function(ph){
        var childId = ph.getAttribute('data-m-slot'); if (!childId) return;
        var child = instances.get(childId);
        if (child && child.domElement){ try{ ph.replaceWith(child.domElement); }catch(_){ } }
      });
    }

    function registerInstance(key, data){
      if (instances.has(key)) { /* hot replace allowed */ }
      instances.set(key, data);
      U.asArray(data.props.groupKey).forEach(function(gk){
        if (!groups.has(gk)) groups.set(gk, new Set());
        groups.get(gk).add(key);
      });
    }
    function unregisterInstance(key){
      var inst = instances.get(key); if (!inst) return;
      U.asArray(inst.props.groupKey).forEach(function(gk){
        var set = groups.get(gk); if (set){ set.delete(key); if (!set.size) groups.delete(gk); }
      });
      if (inst.domElement && inst.domElement.parentNode) inst.domElement.parentNode.removeChild(inst.domElement);
      instances.delete(key);
      auditor.stats.delete(key);
    }
    function getKeys(){
      var keys = Array.from(instances.keys()); var groupMap={};
      groups.forEach(function(set,gk){ groupMap[gk] = Array.from(set); });
      return { keys: keys, groups: groupMap };
    }

    function commit(state, dirtyMap){
      if (!dirtyMap || !dirtyMap.size) return;
      dirtyMap.forEach(function(op, key){
        var inst = instances.get(key); if (!inst || !inst.domElement) return;
        var restore = D.preserveFocus(inst.domElement);
        var t0 = U.now();
        try {
          if (inst.mode === 'keyed'){
            var tree = inst.buildVDOM(state, { uKey:key });
            if (!inst._vtree){
              var rootNode = V.render(tree);
              adoptSlots(rootNode);
              inst.domElement.replaceChildren(rootNode);
            } else {
              V.patch(inst.domElement, tree, inst._vtree);
              adoptSlots(inst.domElement);
            }
            inst._vtree = tree;
          } else {
            if (!toNode) return;
            var spec = inst.buildReplace(state, { uKey:key });
            var node = toNode(spec);
            if (inst._transitions){ inst._transitions.replaceChildren(node); }
            else inst.domElement.replaceChildren(node);
            D.postSync(inst.domElement);
          }
          var ms = U.now() - t0;
          auditor.onCommit(key, ms, inst.props && inst.props.budget);
          var vs = guardian.validate({ key:key, metrics:{ lastMs:ms }, budget: inst.props && inst.props.budget });
          if (vs.length) auditor.onViolation(key, vs.length);
        } catch(err){
          auditor.onError(key);
          console.error('[Mishkah] Build error for entity "'+key+'":', err);
          inst.domElement.innerHTML = '<div style="color:red;border:1px solid red;padding:8px;font-family:monospace;">Error in entity "'+key+'": '+(err && err.message || err)+'</div>';
        } finally {
          try{ restore && restore(); }catch(_){}
        }
      });
    }

    return { registerInstance:registerInstance, unregisterInstance:unregisterInstance, getKeys:getKeys, commit:commit, instances:instances, adoptSlots:adoptSlots };
  }

  Core._createEngine = createEngine;
  return createEngine;
});

/* ==========================================================================
   Module 8: App (wiring + lifecycle + effects)
   ========================================================================== */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) { define([], function(){ return factory(root); }); }
  else if (typeof module === 'object' && module.exports) { module.exports = factory(root); }
  else { factory(root); }
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';
  var M = root.Mishkah = root.Mishkah || {};
  var Core = M.Core = M.Core || {};
  var U = Core._util, D = Core._dom, V = Core._vdom;
  var createTruth = Core.createTruth, createGuardian = Core.createGuardian, createAuditor = Core.createAuditor, addPerformancePolicy = Core.addPerformancePolicy;
  var createEnv = Core.createEnv, createEngine = Core._createEngine;

  // --- Back-compat shim: ensure Mishkah.Comp exists early ---
  if (!M.Comp) { M.Comp = { registry: {}, define: function(name, fn){ this.registry[name] = fn; } }; }
  else {
    if (!M.Comp.registry) M.Comp.registry = {};
    if (typeof M.Comp.define !== 'function') M.Comp.define = function(name, fn){ this.registry[name] = fn; };
  }

  function Emitter(){
    var map = Object.create(null);
    function on(ev, fn){ (map[ev]||(map[ev]=new Set())).add(fn); return function(){ off(ev, fn); }; }
    function off(ev, fn){ var s = map[ev]; if (s) s.delete(fn); }
    function emit(ev, payload){ var s = map[ev]; if (!s) return; s.forEach(function(fn){ try{ fn(payload); }catch(e){ console.error('[Mishkah.lifecycle] listener error', e); } }); }
    return { on:on, off:off, emit:emit, _map:map };
  }
  function debounce(fn, ms){ var t; return function(){ var args=arguments; clearTimeout(t); t=setTimeout(function(){ fn.apply(null,args); }, ms||0); }; }

  function normalizeEventProps(props){
    if (!props || typeof props!=='object') return props;
    var out = Object.assign({}, props);
    var map = { onClick:'data-onclick', onChange:'data-onchange', onInput:'data-oninput', onSubmit:'data-onsubmit', onKeydown:'data-onkeydown', onKeyDown:'data-onkeydown' };
    Object.keys(map).forEach(function(from){
      var to = map[from];
      if (out[from] && !out[to]){
        if (typeof out[from] === 'function') console.error('[Mishkah] "'+from+'" expects a command name (string), not a function.');
        else out[to] = out[from];
      }
    });
    if (out.events && typeof out.events==='object'){
      var mm = { click:'data-onclick', change:'data-onchange', input:'data-oninput', submit:'data-onsubmit', keydown:'data-onkeydown' };
      Object.keys(out.events).forEach(function(k){
        var to = mm[k], v = out.events[k];
        if (to && v && !out[to]){
          if (typeof v === 'function') console.error('[Mishkah] events.'+k+' expects a command name (string), not a function.');
          else out[to] = v;
        }
      });
    }
    return out;
  }

  function createApp(opts){
    opts = opts || {};
    var truth    = createTruth(opts.initial || {}, { strictState: !!opts.strictState });
    var guardian = createGuardian();
    var auditor  = createAuditor();
    if (opts.perfPolicy) addPerformancePolicy(guardian, opts.perfPolicy);
    var env      = createEnv(opts.env || {});
    var engine   = createEngine(truth, guardian, auditor);

    truth.bindKeysProvider(engine.getKeys);

    // lifecycle bus + effects
    var life = Emitter();
    var effects = []; // {selector, fn, once, debouncedFn}
    var origSet = truth.set.bind(truth);
    truth.set = function(next){ life.emit('plan', { prev: truth.get(), next: next }); return origSet(next); };

    function selectorMatch(selector, key){
      if (!selector) return false;
      if (selector === 'all') return true;
      if (Array.isArray(selector)) return selector.some(function(s){ return selectorMatch(s, key); });
      var s = String(selector);
      if (s[0]==='#') return s.slice(1) === key;
      if (s[0]==='.') { var arr = (engine.getKeys().groups[s.slice(1)] || []); return arr.indexOf(key) !== -1; }
      return s === key;
    }

    truth.effect = function(selector, fn, options){
      options = options || {};
      var entry = { selector:selector, fn:fn, once:!!options.once };
      if (options.debounceMs) entry.debouncedFn = debounce(fn, options.debounceMs);
      effects.push(entry);
      if (options.immediate){ try{ (entry.debouncedFn || entry.fn)({ keys:[], state: truth.get(), groups: engine.getKeys().groups }); }catch(e){ console.error('[Mishkah.effect] immediate error', e); } }
      return function(){ var i=effects.indexOf(entry); if (i>=0) effects.splice(i,1); };
    };
    (function attachEffectAsync(){
      var pending = new Map(); // selector -> AbortController
      truth.effectAsync = function(selector, asyncFn, options){
        options = options || {};
        var cancelPrevious = options.cancelPrevious !== false;
        return truth.effect(selector, function(ctx){
          if (cancelPrevious){ var prev=pending.get(selector); if (prev){ try{ prev.abort(); }catch(_){ } } }
          var ctrl = new AbortController(); pending.set(selector, ctrl);
          Promise.resolve().then(function(){ return asyncFn({ state: ctx.state, keys: ctx.keys, groups: ctx.groups, signal: ctrl.signal }); })
          .catch(function(e){ if (e && e.name==='AbortError') return; console.error('[Mishkah.effectAsync] error:', e); });
        }, { debounceMs: options.debounceMs, immediate: options.immediate });
      };
      life.cancelAsync = function(selector){ var c=pending.get(selector); if (c){ try{ c.abort(); }catch(_){ } pending.delete(selector); } };
    })();

    // Enhanced Comp.call
    var C = M.Comp || M.Components;
    var A = M.Atoms;
    function enhancedCall(name, props, slots){
      props = props || {}; slots = slots || {};
      if (!C || !C.define){ return A && A.h ? A.h('div',{},'Mishkah.Comp not found') : null; }
      var componentFn = C.registry[name];
      if (!componentFn) return A && A.h ? A.h('div',{},'Component '+name+' not found') : null;

      var normalizedProps = normalizeEventProps(props);
      var key = (normalizedProps.id || normalizedProps.uniqueKey);
      var renderer = (normalizedProps.renderer === 'keyed') ? 'keyed' : 'replace';

      function buildReplace(state){ return componentFn(A, state, coreContext, normalizedProps, slots); }
      function buildVDOM(state){ return componentFn(V, state, coreContext, normalizedProps, slots); }

      if (key){
        var inst = engine.instances.get(key);
        if (!inst){
          var domWrapper = document.createElement('div');
          domWrapper.setAttribute('data-m-k', key);
          if (normalizedProps.groupKey) domWrapper.setAttribute('data-m-g', U.asArray(normalizedProps.groupKey).join(' '));
          inst = {
            buildReplace: buildReplace,
            buildVDOM: buildVDOM,
            props: normalizedProps,
            slots: slots,
            domElement: domWrapper,
            mode: renderer
          };
          engine.registerInstance(key, inst);
          if (renderer === 'keyed'){
            var initialTree = buildVDOM(truth.get(), { uKey:key, op:'init' });
            domWrapper.appendChild(V.render(initialTree));
            engine.instances.get(key)._vtree = initialTree;
          } else {
            if (!A || !A.toNode) throw new Error('[Mishkah] Atoms.toNode is required for replace-mode.');
            var initialSpec = buildReplace(truth.get(), { uKey:key, op:'init' });
            domWrapper.appendChild(A.toNode(initialSpec));
          }
          engine.adoptSlots(domWrapper);
          return domWrapper;
        } else {
          inst.props = normalizedProps; inst.slots = slots; inst.mode = renderer;
          return inst.domElement;
        }
      } else {
        // stateless
        if (renderer === 'keyed'){
          var tree = buildVDOM(truth.get(), { uKey:null, op:'adhoc' });
          var host = document.createElement('div'); host.appendChild(V.render(tree)); return host.firstChild;
        } else {
          return buildReplace(truth.get(), { uKey:null, op:'adhoc' });
        }
      }
    }
    // Expose enhancedCall & remember it for late loaders
    Core._enhancedCall = enhancedCall;
    try {
      // Attach to both aliases now
      if (!M.Comp) M.Comp = {};
      if (!M.Components) M.Components = M.Comp;
      M.Comp.call = enhancedCall;
      M.Components.call = enhancedCall;
      // If setters exist from the shim, they will pick up Core._enhancedCall automatically
    } catch(_){ }

    var coreContext = { truth:truth, guardian:guardian, auditor:auditor, engine:engine, env:env, C:C, A:A, i18n: env.i18n, call: enhancedCall };

    // Commands (attribute delegation)
    var commands = opts.commands || {};
    function dispatch(name, e, el){ var cmd = commands[name]; if (cmd){ try{ cmd(Object.assign({}, coreContext, { dispatch:dispatch }), e, el); } catch(err){ console.error('[Mishkah] Command error in "'+name+'":', err); } } }

    // Delegation
    var delegator = D.createAttrDelegator(M.utils);
    var detachDelegation = null;

    // Mount
    if (opts.mount){
      var mountEl = (typeof opts.mount==='string') ? root.document.querySelector(opts.mount) : opts.mount;
      if (mountEl){
        if (opts.rootComponent && C){
          var rootDOM = enhancedCall(opts.rootComponent, { id:'app-root', renderer: opts.rootRenderer || 'replace' });
          mountEl.appendChild(rootDOM);
        }
        detachDelegation = delegator(mountEl, dispatch);
      }
    }

    // truth → engine
    var origCommit = engine.commit.bind(engine);
    engine.commit = function(state, dirtyMap){
      var keys = dirtyMap ? Array.from(dirtyMap.keys()) : [];
      life.emit('commit:will', { state:state, keys:keys, dirty:dirtyMap });
      keys.forEach(function(k){ life.emit('region:willBuild', { key:k, mode: engine.instances.get(k) && engine.instances.get(k).mode || 'replace' }); });
      var t0 = U.now();
      var out = origCommit(state, dirtyMap);
      var dt = U.now() - t0;
      keys.forEach(function(k){
        var st = auditor.stats.get(k);
        life.emit('region:didBuild', { key:k, ms: st && st.lastMs || 0, stats: st||null });
      });
      life.emit('commit:did', { duration:dt, keys:keys });
      if (keys.length){
        var groups = engine.getKeys().groups;
        effects.slice().forEach(function(eff){
          var hit = keys.some(function(k){ return selectorMatch(eff.selector, k); });
          if (hit){
            try{ (eff.debouncedFn || eff.fn)({ keys:keys, state:state, groups:groups }); }catch(e){ console.error('[Mishkah.effect] error', e); }
            if (eff.once){ var i=effects.indexOf(eff); if (i>=0) effects.splice(i,1); }
          }
        });
      }
      return out;
    };

    var app = {
      truth: truth, engine: engine, env: env, i18n: env.i18n,
      VDOM: { h: V.h, Fragment: V.Fragment },
      guardian: guardian, auditor: auditor,
      lifecycle: {
        on: life.on, off: life.off, emit: life.emit,
        onPlan: function(fn){ return life.on('plan', fn); },
        onCommitWill: function(fn){ return life.on('commit:will', fn); },
        onCommitDid: function(fn){ return life.on('commit:did', fn); },
        onRegionWill: function(fn){ return life.on('region:willBuild', fn); },
        onRegionDid: function(fn){ return life.on('region:didBuild', fn); }
      },
      devtools: {
        getSnapshot: auditor.getSnapshot,
        printSummary: function(){
          var s = auditor.getSnapshot();
          var rows = Object.entries(s.instances).map(function(kv){ var k=kv[0],v=kv[1]; return { key:k, commits:v.commits, avgMs:+(+v.avgMs||0).toFixed(2), lastMs:+(+v.lastMs||0).toFixed(2), slow:v.slowCount, errors:v.errors, viol:v.violations }; });
          try{ console.table(rows); }catch(_){ console.log(rows); }
        }
      },
      destroy: function(){
        if (detachDelegation) detachDelegation();
        Array.from(engine.instances.keys()).forEach(function(k){ engine.unregisterInstance(k); });
        if (opts.mount){
          var mountEl = (typeof opts.mount==='string') ? root.document.querySelector(opts.mount) : opts.mount;
          if (mountEl) mountEl.innerHTML='';
        }
      }
    };

    return app;
  }

  Core.createApp = createApp;
  return createApp;
});

/* ==========================================================================
   Module 9: Extras (A–E) transitions/strategy/effects/scroll/integrity
   ========================================================================== */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) { define([], function(){ return factory(root); }); }
  else if (typeof module === 'object' && module.exports) { module.exports = factory(root); }
  else { factory(root); }
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';
  var M = root.Mishkah = root.Mishkah || {};
  var Core = M.Core = M.Core || {};
  var U = Core._util;

  function attachExtras(app, options){
    options = options || {};

    // A) Transitions رحيمة (graceful removal)
    function enableRegionTransitions(key, cfg){
      cfg = Object.assign({ enter:'mx-enter', enterActive:'mx-enter-active', leave:'mx-leave', leaveActive:'mx-leave-active', maxMs:700 }, cfg||{});
      var inst = app.engine.instances.get(key); if (!inst || !inst.domElement) return function(){};
      var el = inst.domElement; if (inst._transitions) return inst._transitions.off;
      var orig = el.replaceChildren.bind(el);
      el.replaceChildren = function(newNode){
        var olds = Array.from(el.childNodes);
        if (newNode){
          var first = (newNode.nodeType===11) ? newNode.firstChild : newNode;
          if (first && first.nodeType===1){
            first.classList.add(cfg.enter);
            orig(newNode);
            requestAnimationFrame(function(){ first.classList.add(cfg.enterActive); first.classList.remove(cfg.enter); });
          } else orig(newNode);
        } else orig();
        olds.forEach(function(n){
          if (!n || !n.parentNode) return;
          if (n.nodeType !== 1){ try{ n.remove(); }catch(_){ } return; }
          n.classList.add(cfg.leave);
          requestAnimationFrame(function(){
            n.classList.add(cfg.leaveActive);
            var called=false; var cap=setTimeout(function(){ if(!called){ called=true; try{ n.remove(); }catch(_){ } } }, cfg.maxMs);
            n.addEventListener('transitionend', function(){ if(called) return; called=true; clearTimeout(cap); try{ n.remove(); }catch(_){ } });
          });
        });
      };
      inst._transitions = { off:function(){ el.replaceChildren = orig; delete inst._transitions; } };
      return inst._transitions.off;
    }

    // B) Smart Strategy (auto switch replace↔keyed when slow)
    function smartStrategy(opts){
      opts = Object.assign({ slowHitsToSwitch:3, windowMs:4000, toMode:'auto', debounceMs:80, regions:[] }, opts||{});
      var watchAll = !opts.regions || !opts.regions.length;
      var hits = new Map(); var debs = new Map();
      var origCommit = app.engine.commit.bind(app.engine);
      app.engine.commit = function(state, dirtyMap){
        var keys = dirtyMap ? Array.from(dirtyMap.keys()) : [];
        var out = origCommit(state, dirtyMap);
        keys.forEach(function(k){
          if (!watchAll && opts.regions.indexOf(k)===-1) return;
          var st = app.auditor.stats.get(k); if (!st) return;
          var max = (app.engine.instances.get(k).props && app.engine.instances.get(k).props.budget && app.engine.instances.get(k).props.budget.maxMs) || 32;
          if (st.lastMs > max){
            var arr = hits.get(k) || []; var t = Date.now(); arr.push(t);
            arr = arr.filter(function(x){ return t-x <= opts.windowMs; }); hits.set(k, arr);
            if (arr.length >= opts.slowHitsToSwitch){
              var inst = app.engine.instances.get(k); if (inst){
                var nextMode = opts.toMode==='auto' ? (inst.mode==='keyed' ? 'replace' : 'keyed') : opts.toMode;
                if (inst.mode !== nextMode){
                  inst.mode = nextMode;
                  if (opts.debounceMs){
                    if (!debs.has(k)){ var T; debs.set(k, function(){ clearTimeout(T); T=setTimeout(function(){ app.truth.mark('#'+k); }, opts.debounceMs); }); }
                    debs.get(k)();
                  } else app.truth.mark('#'+k);
                }
              }
              hits.set(k, []);
            }
          }
        });
        return out;
      };
      return { clear:function(key){ if (key) hits.delete(key); else hits.clear(); } };
    }

    // C) لا حاجة لأن effectAsync أُضيفت في app.truth (مانع سباقات)

    // D) Preserve Scroll
    function preserveScroll(key){ var inst = app.engine.instances.get(key); if (inst) inst._preserveScroll = true; }

    // E) Integrity check (duplicate keys warning) — for keyed components
    function checkDuplicateKeys(tree, regionKey){
      try{
        var dup=new Set();
        (function walk(node){
          if (!node || typeof node!=='object') return;
          if (node.children && node.children.length){
            var seen=new Set();
            for (var i=0;i<node.children.length;i++){
              var c=node.children[i]; var k=c && c.key;
              if (k != null){ if (seen.has(k)) dup.add(String(k)); seen.add(k); }
              walk(c);
            }
          }
        })(tree);
        if (dup.size) console.warn('[Mishkah] Duplicate keys in region "'+(regionKey||'?')+'": '+Array.from(dup).join(', '));
      }catch(e){ console.warn(e && e.message || e); }
    }

    return {
      transitions: { enableRegion: enableRegionTransitions },
      strategy: smartStrategy(options.strategy || {}),
      scroll: { preserve: preserveScroll },
      integrity: { check: checkDuplicateKeys }
    };
  }

  Core._attachExtras = attachExtras;
  return attachExtras;
});

/* ==========================================================================
   Final export facade (keeps backward compatibility)
   ========================================================================== */
(function (root) {
  var M = root.Mishkah = root.Mishkah || {};
  var Core = M.Core = M.Core || {};

  // Facade createApp that wires extras automatically but optional
  var _createApp = Core.createApp;
  var _attachExtras = Core._attachExtras;

  Core.createApp = function(opts){
    var app = _createApp(opts||{});
    // attach extras under app.extras
    app.extras = _attachExtras(app, (opts||{}).extras || {});
    return app;
  };

  // Public surface (explicit list, stable)
  root.Mishkah.Core = {
    createApp: Core.createApp,
    createTruth: Core.createTruth,
    createGuardian: Core.createGuardian,
    addPerformancePolicy: Core.addPerformancePolicy,
    createAuditor: Core.createAuditor,
    createEnv: Core.createEnv,
    // expose VDOM (optional)
    VDOM: Core._vdom,
    // internal (for advanced users)
    _util: Core._util,
    _dom: Core._dom,
    _vdom: Core._vdom,
    _createEngine: Core._createEngine,
    _attachExtras: Core._attachExtras
  };
})(typeof self !== 'undefined' ? self : this);
