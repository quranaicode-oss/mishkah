
// mishkah-engines-v5.js

// mishkah-json-engine.js

// jsonToView.js
// محول JSON → Atoms-spec مع ذكاء توجيهات (directives) ودعم i18n/RTL/Dark/twcss.
// الهدف: كتابة واجهات ب JSON بسيط ثم تحويله إلى شجرة DOM فعّالة عبر Atoms.

(function (window) {
  "use strict";

  const A = window.Mishkah && window.Mishkah.Atoms;
  const U = window.Mishkah && window.Mishkah.utils;
  const twcss = window.Mishkah && window.Mishkah.twcss;
  if (!A || !U) return;

  // ===== Helpers =====
  const Arr = Array.isArray;
  const Fn = v => typeof v === "function";
  const Str = v => typeof v === "string" || typeof v === "number";
  const Obj = v => v && typeof v === "object" && !Arr(v);

  const toArr = v => (v == null ? [] : Arr(v) ? v : [v]);
  const j = (...xs) => xs.flat(Infinity).filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  const get = (o, p) => !p ? o : String(p).split(".").reduce((a, k) => (a && k in a) ? a[k] : undefined, o);
  const set = (o, p, v) => { const ks = String(p).split("."); let t = o; for (let i = 0; i < ks.length - 1; i++) { const k = ks[i]; if (!Obj(t[k])) t[k] = {}; t = t[k] } t[ks[ks.length - 1]] = v; return o };

  const asTw = (value) => (twcss && twcss.tw) ? twcss.tw(value) : String(value);

  const normProps = (p) => {
    if (!p) return {};
    const out = {};
    for (const k in p) {
      const v = p[k];
      if (v == null) continue;
      if (k === "className") out.class = v;
      else out[k] = v;
    }
    return out;
  };

  // ========= directive runtime =========
  function pHandler(app, aid) {
    return e => {
      if (!app || !app.truth) return;
      const act = (app._rawActions && app._rawActions[aid]) || app._actions?.[aid] || app.actions?.[aid];
      if (Fn(act)) {
        app.truth.set(s => {
          const r = act(s, e);
          return r === undefined ? s : r;
        });
      }
    };
  }

  function bindValue(app, path, kind = "text") {
    const getter = (s) => {
      const cur = get(s, path);
      if (kind === "checked") return !!cur;
      if (kind === "number") return cur ?? 0;
      return cur ?? "";
    };
    const onInput = (e) => {
      if (!app || !app.truth) return;
      app.truth.set(s => {
        let val;
        if (kind === "checked") val = !!e.target.checked;
        else if (kind === "number") val = (e.target.value === "" ? 0 : +e.target.value);
        else val = e.target.value;
        set(s, path, val);
        return { ...s };
      });
    };
    return { value: getter, onInput };
  }

  // ========= Slots =========
  function slotsFrom(x, state, app) {
    if (x == null) return { default: [] };
    if (Arr(x)) return { default: x.map(n => fromJSON(n, state, app)) };
    if (Obj(x)) {
      const o = {};
      if ("default" in x) o.default = toArr(x.default).map(n => fromJSON(n, state, app));
      else o.default = [];
      for (const k in x) if (k !== "default") o[k] = toArr(x[k]).map(n => fromJSON(n, state, app));
      return o;
    }
    return { default: [fromJSON(x, state, app)] };
  }

  // ========= Transform directives on a tag =========
  function transformDirectives(tag, props, slots, state, app) {
    if (!props) return A.h(tag, {}, slots);

    const p = { ...props };
    const out = {};
    const i18n = app && app.i18n;

    // events: on:click="action" | on:input=fn
    for (const k in p) {
      if (k.startsWith("on:")) {
        const ev = k.slice(3);
        const cap = ev[0].toUpperCase() + ev.slice(1);
        const v = p[k];
        out["on" + cap] = Str(v) ? pHandler(app, String(v)) : (Fn(v) ? v : undefined);
      }
    }

    // model / bind:value / model:number / model:checked
    for (const k in p) {
      if (k === "bind:value" || k === "model" || k.startsWith("model:")) {
        const kind = (k === "bind:value" || k === "model") ? "text" : k.slice(6);
        const path = String(p[k]);
        const w = bindValue(app, path, kind);
        out.value = w.value(state);
        if (kind === "checked") out.checked = !!out.value;
        out.onInput = w.onInput;
      }
    }

    // class:active / class:foo
    for (const k in p) {
      if (k.startsWith("class:")) {
        const cn = k.slice(6);
        if (p[k]) out.class = out.class ? j(out.class, cn) : cn;
      }
    }

    // style:prop="val"
    for (const k in p) {
      if (k.startsWith("style:")) {
        const prop = k.slice(6);
        out.style = out.style || {};
        out.style[prop] = p[k];
      }
    }

    // tw="..." -> merge to class
    if ("tw" in p) {
      const v = Fn(p.tw) ? p.tw(state, app) : p.tw;
      const cls = asTw(v);
      out.class = out.class ? j(out.class, cls) : cls;
    }

    // c (plain class concat)
    if ("c" in p) {
      const v = Fn(p.c) ? p.c(state, app) : p.c;
      out.class = out.class ? j(out.class, v) : String(v);
    }

    // i18n: t="key" / t:key, t:vars
    if ("t" in p || "t:key" in p) {
      const key = p["t:key"] || p.t;
      const vars = p["t:vars"];
      let text = String(key);
      if (i18n && i18n.t) { try { text = i18n.t(String(key), vars) } catch (_) { text = String(key) } }
      const hasContent = toArr(slots?.default || []).length > 0;
      if (!hasContent) slots = Object.assign({}, slots || {}, { default: [text] });
    }

    // if/show
    if ("if" in p) { const cond = Fn(p.if) ? p.if(state, app) : p.if; if (!cond) return null; }
    if ("show" in p) { const cond = Fn(p.show) ? p.show(state, app) : p.show; if (!cond) return null; }

    // html (innerHTML)
    if ("html" in p) { const raw = p.html; out.html = raw && Obj(raw) && "__html" in raw ? raw : { __html: String(raw ?? "") } }

    // for/each → "item in path" أو path مباشرة
    if ("for" in p || "each" in p) {
      const spec = String(p["for"] ?? p["each"]);
      const m = spec.match(/^(\w+)\s+in\s+(.+)$/);
      const list = m ? (get(state, m[2]) || []) : (get(state, spec) || []);
      const varName = m ? m[1] : "item";

      const body = toArr(slots?.default || []);
      const rendered = toArr(list).map((item, idx) => {
        const kids = body.map(ch => (Fn(ch) ? ch({ [varName]: item, index: idx }, state, app) : ch));
        return A.h(tag, out, { default: kids });
      });
      return A.h("#fragment", {}, { default: rendered });
    }

    // await / await:of + pending/then/catch
    if ("await" in p || "await:of" in p) {
      const src = p["await:of"] ?? p["await"];
      const pending = p["await:pending"];
      const thenSlot = p["await:then"];
      const catchSlot = p["await:catch"];

      const prom = Str(src) ? get(state, String(src)) : src;
      if (!prom || !Fn(prom.then)) return null;

      const key = Symbol("await_key");
      app.__awaitKeys = app.__awaitKeys || new Set();
      app.__awaitKeys.add(key);
      prom.then(v => {
        if (app.__awaitKeys && app.__awaitKeys.has(key)) {
          app.truth && app.truth.set(s => s);
          app.__awaitLast = { v };
        }
      }).catch(e => {
        if (app.__awaitKeys && app.__awaitKeys.has(key)) {
          app.truth && app.truth.set(s => s);
          app.__awaitLast = { e };
        }
      });

      if (app.__awaitLast && "v" in app.__awaitLast && thenSlot) {
        const n = Fn(thenSlot) ? thenSlot(app.__awaitLast.v, state, app) : thenSlot;
        return Obj(n) && n.__A ? n : n;
      }
      if (app.__awaitLast && "e" in app.__awaitLast && catchSlot) {
        const n = Fn(catchSlot) ? catchSlot(app.__awaitLast.e, state, app) : catchSlot;
        return Obj(n) && n.__A ? n : n;
      }
      // pending
      if (pending != null) return Obj(pending) && pending.__A ? pending : (Str(pending) || Arr(pending) ? pending : A.h("div", {}, { default: [pending] }));
      return null;
    }

    // animate:in/out/toggle  (hooks)
    for (const k in p) {
      if (!k.startsWith("animate:")) continue;
      const t = k.split(":")[1];
      const v = p[k];
      if (t === "in") {
        const clsIn = String(v);
        const prev = out.onMounted;
        out.onMounted = (el) => { if (prev) prev(el); el.classList.add(clsIn); requestAnimationFrame(() => el.classList.remove(clsIn)) };
      } else if (t === "out") {
        const clsOut = String(v);
        const prev = out.onUnmounted;
        out.onUnmounted = (el) => { if (prev) prev(el); el.classList.add(clsOut) };
      } else if (t === "toggle") {
        out["data-animate-toggle"] = String(v);
      }
    }

    // fetch:of/src into=path on=mounted|click
    if ("fetch" in p || "fetch:of" in p || "fetch:src" in p) {
      const src = p["fetch:of"] ?? p["fetch:src"] ?? p["fetch"];
      const into = p["fetch:into"];
      const onEv = p["fetch:on"] || "mounted";
      const doFetch = (u) => Promise.resolve(Fn(u) ? u(state, app) : u)
        .then(x => fetch(x)).then(r => r.json())
        .then(data => { if (into && app && app.truth) app.truth.set(st => { set(st, String(into), data); return { ...st } }) });
      if (onEv === "mounted") {
        const prev = out.onMounted;
        out.onMounted = (el) => { if (prev) prev(el); doFetch(src) };
      } else if (onEv === "click") {
        const prev = out.onClick;
        out.onClick = (e) => { if (prev) prev(e); doFetch(src) };
      }
    }

    // use:* enhancers
    for (const k in p) {
      if (!k.startsWith("use:")) continue;
      const name = k.slice(4);
      const enhancer = U && get(window, "Mishkah.behaviors." + name);
      if (Fn(enhancer)) {
        const args = p[k];
        const prevMounted = out.onMounted;
        const prevUnmounted = out.onUnmounted;
        out.onMounted = (el) => {
          if (prevMounted) prevMounted(el);
          try {
            const dispose = enhancer(el, args, { state, app });
            if (Fn(dispose)) {
              el.__disposeEnhancers = el.__disposeEnhancers || [];
              el.__disposeEnhancers.push(dispose);
            }
          } catch (_) { }
        };
        out.onUnmounted = (el) => {
          if (prevUnmounted) prevUnmounted(el);
          (el.__disposeEnhancers || []).forEach(fn => { try { fn() } catch (_) { } });
        };
      }
    }

    // routing helpers
    if ("go:to" in p) {
      const to = String(p["go:to"]);
      const prev = out.onClick;
      out.onClick = (e) => { if (prev) prev(e); e && e.preventDefault && e.preventDefault(); if (app && app.router && app.router.navigate) app.router.navigate(to) };
    }
    if ("match:path" in p) {
      const re = new RegExp(String(p["match:path"]));
      if (!(app && re.test(app.router?.path || ""))) return null;
    }
    if ("if:route" in p) {
      const name = String(p["if:route"]);
      if ((app && app.router && app.router.name) !== name) return null;
    }

    // copy the rest (attributes not handled above)
    for (const k in p) {
      if (k.startsWith("on:") || k === "bind:value" || k === "model" || k.startsWith("model:") || k.startsWith("class:") || k.startsWith("style:")
        || k === "tw" || k === "c" || k === "t" || k === "t:key" || k === "t:vars" || k === "if" || k === "show" || k === "html"
        || k === "for" || k === "each" || k === "await" || k === "await:of" || k === "await:pending" || k === "await:then" || k === "await:catch"
        || k.startsWith("animate:") || k === "fetch" || k === "fetch:of" || k === "fetch:src" || k === "fetch:into" || k === "fetch:on"
        || k.startsWith("use:") || k === "go:to" || k === "match:path" || k === "if:route") continue;

      // keep everything else
      out[k] = p[k];
    }

    // toggle animation class if requested
    if (out["data-animate-toggle"]) {
      const [onCls, offCls] = String(out["data-animate-toggle"]).split("|");
      if (props["class:active"]) {
        out.class = out.class ? j(out.class, (props["class:active"] ? onCls : (offCls || ""))) : (props["class:active"] ? onCls : (offCls || ""));
      }
      delete out["data-animate-toggle"];
    }

    // children
    const s = slots || { default: [] };
    const def = toArr(s.default || []).map(x => (Str(x) || Arr(x)) ? x : fromJSON(x, state, app)).filter(Boolean);
    const rest = {};
    for (const sk in s) {
      if (sk === "default") continue;
      rest[sk] = toArr(s[sk] || []).map(x => (Str(x) || Arr(x)) ? x : fromJSON(x, state, app)).filter(Boolean);
    }

    return A.h(tag, out, Object.assign({ default: def }, rest));
  }

  // ========= JSON shapes =========
  function fromArray(node, state, app) {
    const t = node[0];
    if (!t) return null;
    let i = 1, p = {}, kids = [];
    if (Obj(node[1])) { p = node[1] || {}; i = 2 }
    for (let k = i; k < node.length; k++) kids.push(fromJSON(node[k], state, app));
    const props = normProps(p);
    const slots = { default: kids };
    return transformDirectives(t, props, slots, state, app);
  }

  function fromObject(node, state, app) {
    const tag = node.tag || node.t || node.element || node.e || "div";
    const p = normProps(node.props || node.p || {});
    if (node.key != null) p.key = node.key;
    if (node.as != null) p.as = node.as;
    if (node.tw != null) p.tw = node.tw;
    if (node.c != null && !p.c) p.c = node.c;

    const s = node.slots || node.s;
    const c = node.children || node.c2 || node.content; // دعم أسماء بديلة
    const slots = s ? slotsFrom(s, state, app) : slotsFrom(c, state, app);
    return transformDirectives(tag, p, slots, state, app);
  }

  function fromJSON(node, state, app) {
    if (node == null || node === false) return null;
    if (Str(node)) return String(node);
    if (Arr(node)) return fromArray(node, state, app);
    if (Obj(node)) return fromObject(node, state, app);
    return String(node);
  }

  // ========= Public API =========
  function create() {
    let _app = null;

    function setApp(app) { _app = app; return api }

    function toSpec(json, state) {
      return fromJSON(json, state, _app || {});
    }

    function render(json, state) {
      const sp = toSpec(json, state);
      return A.toNode(sp);
    }

    function mountRegion(app, uKey, mount, build, parent = null, opt = {}) {
      A.mountRegion(app, uKey, mount, (s, ctx) => {
        const jv = build(s, ctx);
        if (jv == null) return "";
        const sp = fromJSON(jv, s, Object.assign({ i18n: app.i18n, router: app.router }, app));
        return A.toNode(sp);
      }, parent, opt);
    }

    // compile(json) → (state, app) => spec  (تحويل مسبق لتحسين الأداء)
    function compile(json) {
      // بسيط: يغلّف الاستدعاء الحالي. لاحقًا يمكن توليد كود أسرع.
      return (state, app) => fromJSON(json, state, app);
    }

    const api = { setApp, toSpec, render, mountRegion, compile };
    return api;
  }

  window.Mishkah = window.Mishkah || {};
  window.Mishkah.JSONView = create();
})(window);


// mishkah-html-engine.js
(function (window) {
  "use strict";

  const A   = window.Mishkah && window.Mishkah.Atoms;
  const JV  = window.Mishkah && window.Mishkah.JSONView;
  const U   = window.Mishkah && window.Mishkah.utils;
  if (!A || !JV || !U) return;

  // Registry خفيف للمكوّنات (Functions ترجع Atoms-spec أو JSON-spec)
  const _Components = new Map();
  function registerComponent(name, fn){ _Components.set(String(name), fn); return true }
  function getComponent(name, ctx){
    return (ctx && ctx.components && ctx.components[name])
        || _Components.get(name)
        || (window.Mishkah && window.Mishkah.components && window.Mishkah.components[name]);
  }

  // ===== Helpers =====
  const Arr = Array.isArray;
  const toArr = v => v == null ? [] : Arr(v) ? v : [v];

  function attrsToProps(el){
    const p = {};
    for (const a of el.attributes){
      let k = a.name, v = a.value;
      if (k === "class") p.class = v;
      else if (k === "style") p.style = v;
      else if (k === "is") { p["m:is"] = v; }                 // HTML native -> محركنا
      else if (k.startsWith("m:")) { p[k.slice(2)] = v; }     // m:if -> if, m:for -> for, m:await:of -> await:of ...
      else p[k] = v;                                          // on:click, model:number, t:key, tw, data-*, aria-*
    }
    return p;
  }

  function isComponentTag(tag){
    // اعتبره كمكوّن لو يبدأ بحرف كبير أو فيه Dash أو x-*
    return /[A-Z]/.test(tag[0]) || tag.includes("-") || tag.startsWith("x-");
  }

  // يدعم <template slot="name"> كـ Slots مسماة
  function extractSlots(el){
    const named = {};
    const def = [];
    for (const child of el.childNodes){
      if (child.nodeType === 1 && child.tagName.toLowerCase() === "template" && child.hasAttribute("slot")){
        const name = child.getAttribute("slot");
        const arr = [];
        for (const n of child.content.childNodes){ const v = htmlNodeToJSON(n); if (v != null) arr.push(v); }
        named[name] = arr;
      } else {
        const v = htmlNodeToJSON(child);
        if (v != null) def.push(v);
      }
    }
    return Object.assign({ default: def }, named);
  }

  function htmlNodeToJSON(node){
    if (node.nodeType === 3){ // نص
      const t = node.nodeValue;
      if (!t || !t.trim()) return null;
      return t;
    }
    if (node.nodeType !== 1) return null;
    const tag = node.tagName.toLowerCase();
    const p   = attrsToProps(node);
    const s   = extractSlots(node);
    return { t: tag, p, s };
  }

  // توسيع المكونات قبل تمريرها لـ JSONView (نستدعي دالة المكوّن)
  function expandComponents(spec, ctx){
    if (spec == null) return spec;
    if (Array.isArray(spec)) return spec.map(n => expandComponents(n, ctx));
    if (typeof spec === "string") return spec;
    if (typeof spec !== "object") return spec;

    const tag = spec.t || spec.tag;
    const p   = spec.p || spec.props || {};
    const s   = spec.s || spec.slots || {};
    const compName = p["m:is"] || (isComponentTag(tag) ? tag : null);

    if (compName){
      const fn = getComponent(compName, ctx);
      if (typeof fn === "function"){
        const cleanProps = Object.assign({}, p);
        delete cleanProps["m:is"];
        const expandedSlots = {};
        for (const k in s) expandedSlots[k] = expandComponents(s[k], ctx);
        // fn(props, slots, ctx) => Atoms-spec أو JSON-spec
        return fn(cleanProps, expandedSlots, ctx);
      }
    }

    const out = { t: tag, p, s: {} };
    for (const k in s) out.s[k] = expandComponents(s[k], ctx);
    return out;
  }

  function scopeCSS(name, css){
    if (!css) return "";
    const id = 'mishkah-html-style-'+name;
    if (document.getElementById(id)) return id;
    const tag = document.createElement("style");
    tag.id = id;
    tag.textContent = (U.scopeCSS ? U.scopeCSS(name, css) : css.replace(/:scope/g, '[data-m="'+name+'"]'));
    document.head.appendChild(tag);
    return id;
  }

  // compile: يحوّل HTML إلى ريندرر يرجّع Atoms-spec (يمر على JSONView للتوجيهات)
  function compile(html, options = {}){
    const tpl = document.createElement("template");
    tpl.innerHTML = String(html).trim();

    const roots = Array.from(tpl.content.childNodes)
      .filter(n => n.nodeType === 1 || (n.nodeType === 3 && n.nodeValue.trim() !== ""));

    let json;
    if (roots.length === 1){
      json = htmlNodeToJSON(roots[0]);
    } else {
      json = { t: "div", p: options.name ? { "data-m": options.name } : {}, s: { default: roots.map(htmlNodeToJSON).filter(Boolean) } };
    }

    if (options.name){
      json.p = json.p || {};
      json.p["data-m"] = json.p["data-m"] || options.name;
      if (options.css) scopeCSS(options.name, options.css);
    }

    // يرجّع دالة: (state, ctx) => Atoms-spec
    return (state, ctx = {}) => {
      const ctxAll = Object.assign({}, ctx, { components: options.components || ctx.components });
      const withComps = expandComponents(json, ctxAll);

      // JSONView يتوقع {tag, props, slots}
      function normalize(n){
        if (n == null) return null;
        if (Array.isArray(n)) return n.map(normalize);
        if (typeof n === "string") return n;
        if (typeof n !== "object") return String(n);
        const tag = n.t || n.tag;
        const props = n.p || n.props || {};
        const slotsSrc = n.s || n.slots || {};
        const slots = {};
        for (const k in slotsSrc){
          const v = slotsSrc[k];
          slots[k] = Array.isArray(v) ? v.map(normalize) : normalize(v);
        }
        return { tag, props, slots };
      }
      const norm = normalize(withComps);
      return JV.toSpec(norm, state); // هنا تُطبق كل التوجيهات: if/for/await/on:/model:/tw/t:/...
    };
  }

  // mountRegion: تسهيل تركيب منطقة HTML مباشرة
  function mountRegion(app, uKey, mount, html, parent = null, opt = {}, options = {}){
    const render = compile(html, options);
    A.mountRegion(app, uKey, mount, (s, ctx) => {
      const spec = render(s, Object.assign({ truth: app.truth, actions: app.actions, router: app.router, i18n: app.i18n, env: app.env }, ctx));
      return A.toNode(spec);
    }, parent, opt);
  }

  window.Mishkah = window.Mishkah || {};
  window.Mishkah.HTMLEngine = {
    compile,                   // (html, {name, css, components}) => (state, ctx)=>Atoms-spec
    mountRegion,               // تكامل سريع مع Core/Atoms
    registerComponent,         // تسجيل مكوّنات للفيو HTML
    unregisterComponent: (n)=>{ _Components.delete(String(n)); return true; },
    components: ()=> Array.from(_Components.keys())
  };
})(window);


