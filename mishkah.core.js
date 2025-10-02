/*!
 * mishkah.core.js — Mishkah Pure Core (UMD)
 * Core: VDOM/DSL/i18n/Head/Event Delegation/App + Contracts Stubs
 * 2025-10-02
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], function () { return factory(root, root.Mishkah); });
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(root, root.Mishkah);
  } else {
    root.Mishkah = factory(root, root.Mishkah);
  }
}(typeof window !== 'undefined' ? window : this, function (global, existing) {
  "use strict";

  // -------------------------------------------------------------------
  // Bootstrap
  // -------------------------------------------------------------------
  var M = existing || {};
  M.version = M.version || "core-1.0.0";
  M.utils   = M.utils || {};  // يُفضّل تحميل mishkah-utils.js قبل/بعد النواة — ليس شرطًا

  // -------------------------------------------------------------------
  // Small utils
  // -------------------------------------------------------------------
  function isArr(v){ return Array.isArray(v); }
  function isObj(v){ return v && typeof v === "object" && !Array.isArray(v); }
  function toArr(v){ return v == null ? [] : (isArr(v) ? v : [v]); }
  function assign(target){
    if (!isObj(target)) target = {};
    for (var i=1;i<arguments.length;i++){
      var src = arguments[i]; if (!isObj(src)) continue;
      for (var k in src) target[k] = src[k];
    }
    return target;
  }
  function flat(input){
    if (!isArr(input)) return toArr(input);
    var out = [];
    for (var i=0;i<input.length;i++){
      var x = input[i];
      if (isArr(x)){ var inner = flat(x); for (var j=0;j<inner.length;j++) out.push(inner[j]); }
      else if (x!=null) out.push(x);
    }
    return out;
  }

  // -------------------------------------------------------------------
  // Contracts STUBS (قابلة للاستبدال بملفات كاملة لاحقًا)
  // -------------------------------------------------------------------
  // NOTE: كل استدعاءات النواة تستخدم M.* مباشرة (ديناميكي) لتسمح بالاستبدال بعد التحميل.
  // إن أردت النسخ الكاملة: حمّل mishkah.auditor.js / mishkah.rulecenter.js / mishkah.guardian.js / mishkah.devtools.js

  // Auditor (log/timing/grade) — آمن ومختصر
  if (!M.Auditor) {
    M.Auditor = (function(){
      var LEVELS = { debug:10, info:20, warn:30, error:40, silent:99 };
      var _level = LEVELS.info;
      function log(t, code, msg, ctx){
        if (t === 'silent') return;
        if (typeof console !== 'undefined' && console[t]) {
          try { console[t]((code?code+' ':'')+'[Mishkah] '+msg, ctx||''); } catch(_){}
        }
      }
      var timing = {
        setThresholds: function(){},
        mergeFromDB:   function(){},
        start: function(){ var t0 = (global.performance && performance.now)? performance.now(): Date.now();
          return function(){ return ((global.performance && performance.now)? performance.now(): Date.now()) - t0; };
        },
        record: function(){},
        wrapNetworkingOnce: function(){}
      };
      return {
        setLevel: function(name){ if (LEVELS[name]!=null) _level = LEVELS[name]; },
        debug: function(c,m,x){ log('debug',c,m,x); },
        info:  function(c,m,x){ log('info', c,m,x); },
        warn:  function(c,m,x){ log('warn', c,m,x); },
        error: function(c,m,x){ log('error',c,m,x); },
        grade: function(){ /* no-op in core */ },
        tail:  function(){ return []; },
        timing: timing
      };
    })();
  }

  // RuleCenter — التقييم مركزيًا (stub يرجع ok)
  if (!M.RuleCenter) {
    M.RuleCenter = (function(){
      var _byId = new Map();
      function add(r){ if (!r || !r.id) return null; _byId.set(String(r.id), assign({}, r)); return r.id; }
      return {
        add: add, update: function(){ return false; }, remove: function(id){ return _byId.delete(id); },
        enable: function(){ return true; }, get: function(id){ return _byId.get(id); },
        list: function(){ var out=[]; _byId.forEach(function(r){ out.push(r); }); return out; },
        evaluate: function(stage, payload, ctx){ return { ok:true, failed:[], transformed:null }; }
      };
    })();
  }

  // Guardian — تعقيم/قوانين (stub آمن)
  if (!M.Guardian) {
    M.Guardian = (function(){
      function setConfig(){/* no-op */}
      function checkBuiltIn(){/* no-op */}
      function checkUserLaws(){/* no-op */}
      function registerGuard(){/* no-op */}
      function registerLaw(){/* no-op */}
      function registerPreflight(){/* no-op */}
      function runPreflight(){ /* استدعِ RuleCenter مركزيًا لو وُجد تنفيذ كامل */ 
        if (M.RuleCenter && typeof M.RuleCenter.evaluate === 'function') {
          return M.RuleCenter.evaluate.apply(null, arguments);
        }
        return { ok:true };
      }
      return {
        setConfig:setConfig, getConfig:function(){ return {}; },
        checkBuiltIn:checkBuiltIn, checkUserLaws:checkUserLaws,
        registerGuard:registerGuard, registerLaw:registerLaw, registerPreflight:registerPreflight,
        runPreflight:runPreflight
      };
    })();
  }

  // Devtools — جدولة + تدقيق مفاتيح (stub)
  if (!M.Devtools) {
    M.Devtools = (function(){
      function config(){/* no-op */}
      function scheduleRebuild(ctx, fn){ try { fn(); } catch(e){ M.Auditor && M.Auditor.error('E-SCHED','rebuild failed', e); } }
      function collectDomKeys(root){ 
        var set = new Set(); 
        try { var all = root.querySelectorAll('[data-m-key]');
          for (var i=0;i<all.length;i++){ var raw = all[i].getAttribute('data-m-key')||''; raw.split(/[\s,]+/).forEach(function(k){ if(k) set.add(k); }); }
        } catch(_){} 
        return set; 
      }
      function auditOrdersKeys(root, ordersArr){ /* no-op in pure core */ }
      var HMR = { enabled:false, enable:function(){ this.enabled=true; }, ping:function(){} };
      return { config:config, scheduleRebuild:scheduleRebuild, collectDomKeys:collectDomKeys, auditOrdersKeys:auditOrdersKeys, HMR:HMR, logTail:function(){return [];} };
    })();
  }

  // -------------------------------------------------------------------
  // Environment + i18n
  // -------------------------------------------------------------------
  function dbLang(db){ var i18n=(db&&db.i18n)||{}, env=(db&&db.env)||{}; return env.lang || i18n.lang || i18n.fallback || "en"; }
  function dbDir(db){ var env=(db&&db.env)||{}; if (env.dir) return env.dir; var lang=dbLang(db); var rtl=env.rtlLangs||["ar","fa","he","ur"]; for (var i=0;i<rtl.length;i++) if (rtl[i]===lang) return "rtl"; return "ltr"; }
  function dbTheme(db){ var env=(db&&db.env)||{}; return env.theme || "light"; }
  function applyEnv(db){
    try{
      var root = global.document && global.document.documentElement;
      if (!root) return;
      var lang = dbLang(db), dir = dbDir(db), theme = dbTheme(db);
      root.setAttribute('lang', String(lang));
      root.setAttribute('dir', String(dir));
      root.setAttribute('data-theme', String(theme));
      if (theme === 'dark') root.classList.add('dark'); else root.classList.remove('dark');
    }catch(_){}
  }

  var __i18nCache = new WeakMap();
  function resolveI18nDict(db){
    var i18n = (db && db.i18n) || {};
    var dictRaw = i18n.dict || i18n;
    var out = {};
    if (!dictRaw || typeof dictRaw !== 'object') { return { dict: out, lang: i18n.lang, fallback: i18n.fallback || 'en' }; }
    var keys = Object.keys(dictRaw);
    var looksLangFirst = false;
    if (keys.length){
      var first = dictRaw[keys[0]];
      if (first && typeof first === 'object'){
        var hasAr = Object.prototype.hasOwnProperty.call(first,'ar');
        var hasEn = Object.prototype.hasOwnProperty.call(first,'en');
        if (!hasAr && !hasEn){
          for (var z=0;z<keys.length;z++){
            var L=keys[z]; if (['ar','en','fa','he','ur','fr','de','tr','es','it'].indexOf(L)>=0){ looksLangFirst = true; break; }
          }
        }
      }
    }
    if (!looksLangFirst) { return { dict: dictRaw, lang: i18n.lang, fallback: i18n.fallback || 'en' }; }
    var langs = Object.keys(dictRaw);
    for (var i=0;i<langs.length;i++){
      var Lname = langs[i], table = dictRaw[Lname]; if (!table || typeof table!=='object') continue;
      var ks = Object.keys(table);
      for (var j=0;j<ks.length;j++){ var k=ks[j]; if (!out[k]) out[k]={}; out[k][Lname] = table[k]; }
    }
    return { dict: out, lang: i18n.lang, fallback: i18n.fallback || 'en' };
  }
  function buildLangTables(dict){
    if (!dict || typeof dict!=='object') return {};
    if (__i18nCache.has(dict)) return __i18nCache.get(dict);
    var tables = {}, keys = Object.keys(dict);
    for (var i=0;i<keys.length;i++){
      var key = keys[i], row = dict[key]; if (!row || typeof row!=='object') continue;
      var langs = Object.keys(row);
      for (var j=0;j<langs.length;j++){ var L=langs[j]; if(!tables[L]) tables[L]={}; tables[L][key]=row[L]; }
    }
    __i18nCache.set(dict,tables); return tables;
  }
  function i18nCompatFromDict(db){
    if (!db || !db.i18n) return;
    var info = resolveI18nDict(db), tables = buildLangTables(info.dict);
    if (!db.i18n.ar) db.i18n.ar = tables.ar || {};
    if (!db.i18n.en) db.i18n.en = tables.en || {};
    if (!db.i18n.fallback) db.i18n.fallback = 'en';
  }
  function t(db, key){
    var info = resolveI18nDict(db), lang = dbLang(db), fallback = info.fallback || 'en';
    var dict = info.dict || {}, row = dict[key];
    if (row && typeof row === 'object'){
      var s = row[lang]; if (s==null || s==='') s = row[fallback]; if (s==null || s==='') s = key; return String(s);
    }
    var i18n=(db&&db.i18n)||{}, table = i18n[lang]||{}, fb=i18n[fallback]||{}, v = (table[key]!=null ? table[key] : fb[key]);
    if (v==null || v==='') v = key; return String(v);
  }

  // -------------------------------------------------------------------
  // Head helpers (batch)
  // -------------------------------------------------------------------
  var Head = {
    _upsert: function (tag, keyVal, attrs) {
      var head = global.document && global.document.head; if (!head) return null;
      var sel = tag + '[data-mishkah-id="' + keyVal + '"]';
      var el = head.querySelector(sel);
      if (!el){ el = global.document.createElement(tag); el.setAttribute('data-mishkah-id', keyVal); head.appendChild(el); }
      for (var k in attrs){
        if (k==='textContent') el.textContent = attrs[k];
        else if (attrs[k]==null) el.removeAttribute(k);
        else el.setAttribute(k, String(attrs[k]));
      }
      return el;
    },
    meta: function(m){ var key = m.id || m.name || m.property || m['http-equiv'] || ('meta-'+Math.random().toString(36).slice(2,8)); var attrs={}; for (var k in m) if(k!=='id') attrs[k]=m[k]; return this._upsert('meta',key,attrs); },
    link: function(l){ var key = l.id || ((l.rel||'rel')+':'+(l.href||'href')); var attrs={}; for (var k in l) if(k!=='id') attrs[k]=l[k]; return this._upsert('link',key,attrs); },
    style:function(s){ var key = s.id || ('style-'+(s.key||Math.random().toString(36).slice(2,8))); var attrs={ type:s.type||'text/css', textContent:s.content||s.text||'' }; if (s.nonce) attrs.nonce=s.nonce; return this._upsert('style',key,attrs); },
    script:function(scr){ var key = scr.id || scr.src || ('script-'+Math.random().toString(36).slice(2,8)); var attrs={}; for (var k in scr) if(k!=='id') attrs[k]=scr[k]; if (scr.inline) attrs.textContent = scr.inline; return this._upsert('script',key,attrs); },
    batch: function(spec){
      if (!spec) return;
      if (spec.title != null && global.document) global.document.title = String(spec.title);
      var i, arr;
      arr = toArr(spec.metas);  for (i=0;i<arr.length;i++) this.meta(arr[i]);
      arr = toArr(spec.links);  for (i=0;i<arr.length;i++) this.link(arr[i]);
      arr = toArr(spec.styles); for (i=0;i<arr.length;i++) this.style(arr[i]);
      arr = toArr(spec.scripts);for (i=0;i<arr.length;i++) this.script(arr[i]);
    }
  };

  // -------------------------------------------------------------------
  // twcss adapter (اختياري)
  // -------------------------------------------------------------------
  function adaptClassValue(val){
    try { var tw = M && M.utils && M.utils.twcss && M.utils.twcss.tw; return tw ? tw(val) : val; }
    catch(_){ return val; }
  }

  // -------------------------------------------------------------------
  // DSL (Atoms)
  // -------------------------------------------------------------------
  var SVG_NS = "http://www.w3.org/2000/svg";
  var XLINK_NS = "http://www.w3.org/1999/xlink";
  var XML_NS = "http://www.w3.org/XML/1998/namespace";
  var VOID_TAGS = { "area":1,"base":1,"br":1,"col":1,"embed":1,"hr":1,"img":1,"input":1,"link":1,"meta":1,"param":1,"source":1,"track":1,"wbr":1 };

  function createAtomCategory(category, tags){
    var o = {};
    for (var i=0;i<tags.length;i++){
      (function(tag){
        var C = tag.charAt(0).toUpperCase() + tag.slice(1);
        o[C] = function(config){ var children = []; for (var a=1;a<arguments.length;a++) children.push(arguments[a]); return VDOM.h(tag, category, config, children); };
      })(tags[i]);
    }
    return o;
  }

  var hAtoms = {
    Containers: createAtomCategory("Containers", ["div","section","article","header","footer","main","nav","aside","address"]),
    Text:       createAtomCategory("Text",       ["p","span","h1","h2","h3","h4","h5","h6","strong","em","b","i","small","mark","code","pre","blockquote","time","sup","sub","a"]),
    Lists:      createAtomCategory("Lists",      ["ul","ol","li","dl","dt","dd"]),
    Forms:      createAtomCategory("Forms",      ["form","label","button","fieldset","legend","datalist","output","progress","meter"]),
    Inputs:     createAtomCategory("Inputs",     ["input","textarea","select","option","optgroup"]),
    Media:      createAtomCategory("Media",      ["img","video","audio","source","track","picture","iframe"]),
    Tables:     createAtomCategory("Tables",     ["table","thead","tbody","tfoot","tr","th","td","caption","col","colgroup"]),
    Semantic:   createAtomCategory("Semantic",   ["details","summary","figure","figcaption","template"]),
    Embedded:   createAtomCategory("Embedded",   ["canvas","svg"]),
    SVG:        createAtomCategory("SVG",        ["svg","g","path","circle","ellipse","rect","line","polyline","polygon","text","tspan","defs","use","clipPath","mask","linearGradient","radialGradient","stop","pattern","symbol","marker","filter","feGaussianBlur","feOffset","feBlend","feColorMatrix"]),
    Misc:       createAtomCategory("Misc",       ["hr","br"])
  };

  // -------------------------------------------------------------------
  // VDOM
  // -------------------------------------------------------------------
  var VDOM = (function(){
    var uid = 0;

    function normalizeChildren(children){
      var arr = flat(children), out = [];
      for (var i=0;i<arr.length;i++){
        var c = arr[i];
        if (c==null || c===false) continue;
        if (typeof c === 'string' || typeof c === 'number'){
          out.push({ _type:'text', props:{ nodeValue:String(c) } });
        } else {
          out.push(c);
        }
      }
      return out;
    }

    function h(tag, category, config, children){
      var cfg   = isObj(config) ? config : {};
      var attrs = isObj(cfg.attrs) ? cfg.attrs : {};
      var events= isObj(cfg.events)? cfg.events: {};
      var props = {};
      for (var k in attrs)  props[k] = attrs[k];
      for (var e in events) if (e.indexOf('on')===0) props[e] = events[e];
      return {
        _type:'element',
        tag: String(tag||'').toLowerCase() || 'div',
        category: category || 'Containers',
        props: props,
        key:  (attrs.key!=null)? String(attrs.key) : undefined,
        gkey: (attrs.gkey!=null)? String(attrs.gkey): undefined,
        _uid: 'm-'+(++uid),
        _path: null,
        _dom:  null,
        children: normalizeChildren(children)
      };
    }

    function setStyle(el, style){
      if (!style) return;
      if (isObj(style)){ for (var k in style){ try { el.style[k] = style[k]; } catch(_){ } } }
      else if (typeof style === 'string'){ el.setAttribute('style', style); }
    }

    function setAttributeSmart(el, name, value){
      if (el.namespaceURI === SVG_NS){
        if (name === 'href' && typeof value === 'string' && value){ el.setAttributeNS(XLINK_NS,'xlink:href',value); return; }
        if (name.indexOf(':')> -1){
          var parts = name.split(':'), map = { xlink: XLINK_NS, xml: XML_NS }, uri = map[parts[0]];
          if (uri){ el.setAttributeNS(uri, name, value); return; }
        }
      }
      el.setAttribute(name, String(value));
    }

    function updateInputValue(el, value){
      if (!el) return false;
      var tag = el.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA'){
        var active = (global.document && global.document.activeElement === el);
        if (active && typeof el.selectionStart==='number' && typeof el.selectionEnd==='number'){
          var s=el.selectionStart, e=el.selectionEnd;
          if (el.value !== value) el.value = value;
          try { el.setSelectionRange(s,e); } catch(_){}
        } else {
          if (el.value !== value) el.value = value;
        }
        return true;
      }
      return false;
    }

    function setProp(el, name, value, oldValue, db){
      if (name==='key' || name==='gkey') return;
      if (name==='class' || name==='className'){ el.className = adaptClassValue(value||'') || ''; return; }
      if (name==='style'){ setStyle(el, value); return; }
      if (name.indexOf('on')===0 && typeof value === 'function'){
        var ev = name.slice(2).toLowerCase(); if (oldValue) el.removeEventListener(ev, oldValue); el.addEventListener(ev, value, false); return;
      }
      if (value==null || value===false){ el.removeAttribute(name); return; }
      if (typeof value === 'boolean'){ if (value) el.setAttribute(name,''); else el.removeAttribute(name); return; }
      if (name==='value'){ if (!updateInputValue(el, value)){ if (el.value!==value) el.value=value; } return; }
      if (name==='checked'){ el.checked = !!value; return; }
      setAttributeSmart(el, name, value);
    }

    function applyI18n(el, vnode, db){
      var props = vnode.props || {};
      if (props.t && (!vnode.children || vnode.children.length===0)) el.textContent = t(db, props.t);
      for (var k in props){
        if (k.indexOf('t:')===0){
          var attr = k.slice(2), val = t(db, props[k]);
          setProp(el, attr, val, null, db);
        }
      }
    }

    function updateProps(el, next, prev, db){
      var all = {}, k;
      for (k in prev) all[k] = prev[k];
      for (k in next) all[k] = next[k];
      for (k in all){
        if (k==='key' || k==='gkey' || k==='t' || k.indexOf('t:')===0) continue;
        var n = next[k], p = prev[k]; if (n !== p) setProp(el, k, n, p, db);
      }
      applyI18n(el, { props: next, children: [] }, db);
    }

    function render(vnode, db, parentPath){
      if (parentPath == null) parentPath = "";
      if (!vnode) return global.document.createComment("null");

      // preflight vnode (لا يُحظر افتراضيًا — يعتمد على الحِزم الكاملة إن وُجدت)
      try { M.Guardian.runPreflight('vnode', { vnode:vnode, db:db }, null); } catch (pf){ M.Auditor.error('E-PREFLIGHT','vnode blocked', pf); return global.document.createComment('blocked'); }

      if (vnode._type === 'text'){
        var tn = global.document.createTextNode(vnode && vnode.props ? String(vnode.props.nodeValue==null?'':vnode.props.nodeValue) : '');
        vnode._dom = tn; vnode._path = (parentPath||'') + '/#text'; return tn;
      }

      try { M.Guardian.checkBuiltIn(vnode); } catch(e) { M.Auditor && M.Auditor.warn('W-G-BUILTIN','Guardian.checkBuiltIn', e); }
      try { M.Guardian.checkUserLaws(vnode, db); } catch(e2){ M.Auditor && M.Auditor.warn('W-G-LAWS','Guardian.checkUserLaws', e2); }

      var inSvg = (parentPath && parentPath.lastIndexOf('/svg') === parentPath.length-4) || vnode.tag === 'svg';
      var tagName = vnode.tag === 'svg' ? 'svg' : vnode.tag;
      var el = inSvg ? global.document.createElementNS(SVG_NS, tagName) : global.document.createElement(tagName);

      vnode._path = parentPath + '/' + vnode.tag + (vnode.key?('#'+vnode.key):'');
      if (vnode.key!=null)  el.setAttribute('data-m-key', String(vnode.key));
      if (vnode.gkey!=null) el.setAttribute('data-m-gkey', String(vnode.gkey));
      el.setAttribute('data-m-uid', vnode._uid || '');
      el.setAttribute('data-m-path', vnode._path);

      updateProps(el, vnode.props||{}, {}, db);

      if (!VOID_TAGS[vnode.tag]){
        var kids = isArr(vnode.children) ? vnode.children : [];
        if (kids.length){
          var childPath = inSvg ? '/svg' : vnode._path;
          for (var i=0;i<kids.length;i++){ var c = kids[i]; if (c!=null) el.appendChild(render(c, db, childPath)); }
        }
      }

      vnode._dom = el;
      return el;
    }

    function same(a,b){ return !!(a && b && a._type===b._type && a.tag===b.tag && a.key===b.key); }
    function isKeyed(v){ return v && v.key!=null; }

    function patch(parent, next, prev, db, opts, parentPath){
      if (opts==null) opts = {}; if (parentPath==null) parentPath = "";
      var host = parent._dom || parent;
      var dom = prev ? prev._dom : null;
      if (prev==null){ return host.appendChild(render(next, db, parentPath)); }
      if (next==null){ if (dom && dom.parentNode===host){ try{ host.removeChild(dom); }catch(_){}} return; }
      if (!same(next, prev)){
        var repl = render(next, db, parentPath);
        try{ host.replaceChild(repl, dom); } catch(_){ host.appendChild(repl); }
        return;
      }
      if (next._type === 'text'){
        if (dom && dom.nodeType===3){
          var nv = (next.props && next.props.nodeValue!=null) ? next.props.nodeValue : "";
          var pv = (prev.props && prev.props.nodeValue!=null) ? prev.props.nodeValue : "";
          if (nv!==pv) dom.nodeValue = nv; next._dom = dom;
        } else {
          var n = global.document.createTextNode(String(next.props && next.props.nodeValue!=null ? next.props.nodeValue : ""));
          next._dom = n; if (dom){ try{ host.replaceChild(n, dom); }catch(_){ host.appendChild(n); } } else host.appendChild(n);
        }
        return;
      }
      next._dom = dom;
      next._path = prev._path || (parentPath + '/' + next.tag + (next.key?('#'+next.key):''));
      updateProps(dom, next.props||{}, prev.props||{}, db);
      patchChildren(dom, next.children||[], prev.children||[], db, opts, next._path);
    }

    function patchChildren(parent, nextList, prevList, db, opts, parentPath){
      var i,len, hasKeys=false;
      for (i=0;i<nextList.length && !hasKeys;i++) if (isKeyed(nextList[i])) hasKeys = true;
      for (i=0;i<prevList.length && !hasKeys;i++) if (isKeyed(prevList[i])) hasKeys = true;

      if (!hasKeys){
        len = Math.max(nextList.length, prevList.length);
        for (i=0;i<len;i++) patch(parent, nextList[i], prevList[i], db, opts, parentPath);
        return;
      }

      var oldKeyIndex = new Map();
      for (i=0;i<prevList.length;i++){ var v=prevList[i]; if (v && v.key!=null) oldKeyIndex.set(v.key, i); }

      var newIndexToOld = new Array(nextList.length);
      for (i=0;i<nextList.length;i++) newIndexToOld[i] = -1;
      for (i=0;i<nextList.length;i++){ var n=nextList[i]; if (!n) continue; if (n.key!=null && oldKeyIndex.has(n.key)) newIndexToOld[i] = oldKeyIndex.get(n.key); }

      for (i=0;i<nextList.length;i++){ var oldIdx=newIndexToOld[i]; if (oldIdx>=0) patch(parent, nextList[i], prevList[oldIdx], db, opts, parentPath); else patch(parent, nextList[i], null, db, opts, parentPath); }

      var used = new Set(); for (i=0;i<newIndexToOld.length;i++) if (newIndexToOld[i]>=0) used.add(newIndexToOld[i]);
      for (i=0;i<prevList.length;i++){ if (!used.has(i)){ var pv=prevList[i], el=pv && pv._dom; if (el && el.parentNode===parent){ try{ parent.removeChild(el); }catch(_){}} } }

      function lis(arr){
        var n=arr.length, p=new Array(n), result=[], u,v,c,m;
        for (var i2=0;i2<n;i2++){
          c=arr[i2]; if (c<0) continue;
          u=0; v=result.length-1;
          while (u<=v){ m=(u+v)>>1; if (arr[result[m]]<c) u=m+1; else v=m-1; }
          if (u>=result.length) result.push(i2); else result[u]=i2;
          p[i2] = u>0 ? result[u-1] : -1;
        }
        u=result.length; v=result[result.length-1]; var seq=new Array(u);
        while (u-- > 0){ seq[u]=v; v=p[v]; }
        return seq;
      }

      var seq = lis(newIndexToOld), j = seq.length-1;
      for (i=nextList.length-1; i>=0; i--){
        var ref = parent.childNodes[i+1] || null, el2 = nextList[i] && nextList[i]._dom;
        if (newIndexToOld[i] === -1){ if (el2 && el2 !== ref) parent.insertBefore(el2, ref); }
        else { if (j<0 || i!==seq[j]){ if (el2 && el2 !== ref) parent.insertBefore(el2, ref); } else { j--; } }
      }
    }

    return { h:h, render:render, patch:patch };
  })();

  // -------------------------------------------------------------------
  // Event delegation (pure core) — يستدعي Guardian/RuleCenter/Auditor إن وُجدوا
  // -------------------------------------------------------------------
  function matchesList(expected, candidates){
    var exp=toArr(expected); if (exp.length===0) return true;
    if (!candidates || !candidates.length) return false;
    for (var i=0;i<exp.length;i++){
      var pat = exp[i]; if (pat==null) continue;
      if (pat==='*') return true;
      if (pat instanceof RegExp){ for (var j=0;j<candidates.length;j++) if (pat.test(candidates[j])) return true; continue; }
      if (typeof pat === 'string'){
        if (pat.length && pat.charAt(pat.length-1)==='*'){ var prefix = pat.slice(0,-1); for (var k=0;k<candidates.length;k++) if (String(candidates[k]).indexOf(prefix)===0) return true; continue; }
        if (pat.length && pat.charAt(0)==='*'){ var suffix = pat.slice(1); for (var k2=0;k2<candidates.length;k2++){ var c=String(candidates[k2]); if (c.length>=suffix.length && c.lastIndexOf(suffix)===c.length-suffix.length) return true; } continue; }
        for (var k3=0;k3<candidates.length;k3++) if (candidates[k3]===pat) return true;
      }
    }
    return false;
  }

  function handleEvent(type, e, ctx, orders){
    try{
      var rootEl = ctx.root || global.document;
      var keysPath=[], gkeysPath=[];
      var el = e && e.target && e.target.nodeType===1 ? e.target : null;
      while (el && el.nodeType===1){
        if (el.hasAttribute('data-m-key')){
          var raw = el.getAttribute('data-m-key') || '';
          var parts = raw.split(/[\s,]+/);
          for (var i=0;i<parts.length;i++){ var k=parts[i]; if (k && keysPath.indexOf(k)===-1) keysPath.push(k); }
        }
        if (el.hasAttribute('data-m-gkey')){
          var raw2 = el.getAttribute('data-m-gkey') || '';
          var parts2 = raw2.split(/[\s,]+/);
          for (var j=0;j<parts2.length;j++){ var g=parts2[j]; if (g && gkeysPath.indexOf(g)===-1) gkeysPath.push(g); }
        }
        if (el===rootEl) break;
        el = el.parentElement;
      }

      // preflight (event)
      try { M.Guardian.runPreflight('event', { type:type, event:e, keysPath:keysPath, gkeysPath:gkeysPath }, ctx); }
      catch (prefErr){ M.Auditor.error('E-PREFLIGHT','event blocked', {error:String(prefErr), type:type}); return; }

      var matched=0;
      for (var x=0;x<orders.length;x++){
        var o = orders[x];
        if (!o || o.disabled) continue;
        var onOk = (!o.on || o.on.length===0) ? true : (o.on.indexOf(type)!==-1);
        if (!onOk) continue;
        var keyOk = matchesList(o.keys, keysPath);
        var gOk  = matchesList(o.gkeys, gkeysPath);
        if (keyOk && gOk){
          matched++;
          try{
            var end = (M.Auditor && M.Auditor.timing && M.Auditor.timing.start) ? M.Auditor.timing.start('event:'+ (o.name||type), {type:type, order:o.name, keysPath:keysPath}) : function(){ return 0; };
            o.handler(e, ctx);
            var ms = end(true);
            if (M.Auditor && M.Auditor.timing && M.Auditor.timing.record) M.Auditor.timing.record('event', (o.name||type), ms, { keysPath:keysPath, gkeysPath:gkeysPath });
          } catch (err) {
            M.Auditor.warn('E-HANDLER','handler threw for order: '+(o.name||'order'), { error:String(err && err.message || err) });
          }
        }
      }
      if (matched===0) { M.Auditor.debug('I-NOMATCH','no order matched: '+type, { keysPath:keysPath, gkeysPath:gkeysPath }); }
    } catch (err2){
      M.Auditor.error('E-HANDLE','handleEvent failed', { error:String(err2 && err2.message || err2) });
    }
  }

  function setupDelegation(rootEl, ctx, orders, options){
    var DEFAULT_EVENTS = [
      "click","dblclick","contextmenu",
      "input","change","submit","reset",
      "keydown","keypress","keyup",
      "pointerdown","pointerup","pointermove","pointercancel","pointerover","pointerout","pointerenter","pointerleave",
      "mousedown","mouseup","mousemove","mouseenter","mouseleave","mouseover","mouseout",
      "touchstart","touchend","touchmove","touchcancel",
      "focus","blur","wheel","scroll"
    ];
    var NON_BUBBLE_DEFAULT = new Set(["focus","blur","mouseenter","mouseleave","pointerenter","pointerleave"]);
    var CAPTURE_PREF_DEFAULT= new Set(["focus","blur","scroll","mouseenter","mouseleave","pointerenter","pointerleave"]);

    function defaultEventsFromOrders(orArr){
      var s={}; s.click=1; s.input=1; s.change=1; s.keydown=1; s.keyup=1; s.submit=1;
      for (var i=0;i<orArr.length;i++){ var o=orArr[i], evs=toArr(o.on); for (var j=0;j<evs.length;j++) if (evs[j]) s[String(evs[j]).toLowerCase()] = 1; }
      return Object.keys(s);
    }

    var evs = (options && isArr(options.events) && options.events.length) ? options.events : defaultEventsFromOrders(orders);
    if (!evs.length) evs = DEFAULT_EVENTS.slice();

    var NB = (options && options.nonBubble instanceof Set) ? options.nonBubble : NON_BUBBLE_DEFAULT;
    var CP = (options && options.capturePref instanceof Set) ? options.capturePref : CAPTURE_PREF_DEFAULT;
    var passive = options && typeof options.passive==='boolean' ? options.passive : true;
    var r = rootEl || (ctx && ctx.root) || global.document;

    var bound = new Map();
    function bind(type){
      var useCapture = NB.has(type) || CP.has(type);
      var handler = function(e){ handleEvent(type, e, ctx, orders); };
      r.addEventListener(type, handler, { capture: useCapture, passive: passive });
      bound.set(type, { handler:handler, useCapture:useCapture });
    }
    for (var i=0;i<evs.length;i++) bind(evs[i]);

    return {
      teardown: function (){
        bound.forEach(function(v, type){ r.removeEventListener(type, v.handler, { capture:v.useCapture }); });
        bound.clear();
      }
    };
  }

  // -------------------------------------------------------------------
  // App Core
  // -------------------------------------------------------------------
  var App = (function(){
    var _bodyFn=null, _database={}, _ordersObj={}, _ordersArr=[];
    var _vApp=null, _$root=null, _ctx=null, _delegation=null;

    function setBody(fn){ _bodyFn = fn; }

    function normalizeOrders(obj){
      var arr=[], k, o;
      for (k in (obj||{})){
        o = obj[k] || {};
        arr.push({
          name: k,
          on: toArr(o.on),
          keys:  o.keys==null ? [] : (isArr(o.keys) ? o.keys : [o.keys]),
          gkeys: o.gkeys==null? [] : (isArr(o.gkeys)? o.gkeys: [o.gkeys]),
          disabled: !!o.disabled,
          handler: typeof o.handler==='function' ? o.handler : function(){}
        });
      }
      return arr;
    }

    function createContext(){
      return {
        root: _$root,
        getState: function(){ return _database; },
        setState: function(updater){
          var draft = (typeof updater==='function') ? updater(_database) : updater;
          try { M.Guardian.runPreflight('state', { next:draft, prev:_database }, this); } catch(pf){ M.Auditor.error('E-PREFLIGHT','state blocked', pf); return; }
          if (typeof updater==='function') _database = draft;
          else if (isObj(updater)){
            var next={}, k; for (k in _database) next[k]=_database[k]; for (k in updater) next[k]=updater[k]; _database = next;
          }
        },
        rebuild: function(opts){
          applyEnv(_database);
          var head = _database && _database.head; if (head) Head.batch(head);

          var options = { freeze: new Set(toArr(opts && opts.except)), only: new Set(toArr(opts && opts.buildonly)) };
          var self = this;
          M.Devtools.scheduleRebuild(self, function(){
            var dsl = assign({ h: VDOM.h }, hAtoms);
            var next = _bodyFn(_database, dsl);
            VDOM.patch(_$root, next, _vApp, _database, options, "");
            _vApp = next;
            try { M.RuleCenter && M.RuleCenter.evaluate && M.RuleCenter.evaluate('afterRender', { rootEl:_$root, db:_database }, _ctx); } catch(eAR){ M.Auditor.warn('W-AFTER','afterRender rules error', {error:String(eAR)}); }
            if (M.Devtools && M.Devtools.auditOrdersKeys) M.Devtools.auditOrdersKeys(_$root, _ordersArr);
          });
        },
        batch: function(fn){ if (typeof fn==='function') fn(this); this.rebuild(); }
      };
    }

    function mount(selector){
      _$root = (typeof selector==='string') ? global.document.querySelector(selector) : selector;
      if (!_$root){ M.Auditor.error('E-MOUNT','mount target not found: '+selector); return; }

      i18nCompatFromDict(_database);
      applyEnv(_database);

      _ordersArr = normalizeOrders(_ordersObj);
      _ctx = createContext();

      if (_delegation){ try { _delegation.teardown(); } catch(_){ } }
      _delegation = setupDelegation(_$root, _ctx, _ordersArr, {});

      var dsl = assign({ h: VDOM.h }, hAtoms);
      _vApp = _bodyFn(_database, dsl);
      _$root.innerHTML = "";
      _$root.appendChild(VDOM.render(_vApp, _database));

      if (M.Devtools && M.Devtools.auditOrdersKeys) M.Devtools.auditOrdersKeys(_$root, _ordersArr);
      // يمكن لو أردت: لف الشبكة عند توفر الـAuditor الكامل
      if (M.Auditor && M.Auditor.timing && M.Auditor.timing.wrapNetworkingOnce) {
        try { M.Auditor.timing.wrapNetworkingOnce(_database); } catch(_){}
      }
    }

    function createApp(database, orders){
      _database = database || {};
      _ordersObj = orders || {};
      _ordersArr = normalizeOrders(_ordersObj);
      return {
        mount: mount,
        setOrders: function(next){
          _ordersObj = next || {};
          _ordersArr = normalizeOrders(_ordersObj);
          if (_delegation) _delegation.teardown();
          _delegation = setupDelegation(_$root, _ctx || createContext(), _ordersArr, {});
          if (M.Devtools && M.Devtools.auditOrdersKeys) M.Devtools.auditOrdersKeys(_$root, _ordersArr);
        },
        getOrders: function(){ return _ordersArr.slice(); },
        rebuild: function(){ if (_ctx) _ctx.rebuild(); }
      };
    }

    return { setBody:setBody, createApp:createApp };
  })();

  // -------------------------------------------------------------------
  // Exports
  // -------------------------------------------------------------------
  M.DSL = assign({ h: VDOM.h }, hAtoms);
  M.Head = Head;
  M.app  = App;

  // keep contracts on global M for replacement by full modules
  // (already created above if missing): M.Auditor, M.RuleCenter, M.Guardian, M.Devtools

  M.configure = function(opts){ if (M.Devtools && M.Devtools.config) M.Devtools.config(opts||{}); };
  M.hmr = (M.Devtools && M.Devtools.HMR) ? M.Devtools.HMR : { enabled:false, enable:function(){ this.enabled=true; }, ping:function(){} };

  return M;
}));
