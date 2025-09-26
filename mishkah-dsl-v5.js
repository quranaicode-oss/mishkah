//mishkah-dsl-v5.js
// Atoms
(function (window) {
  "use strict";

  const Arr = Array.isArray;
  const Fn  = v => typeof v === "function";
  const Str = v => typeof v === "string" || typeof v === "number";
  const Obj = v => v && typeof v === "object" && !Arr(v);
  const toArr = v => v == null ? [] : Arr(v) ? v : [v];
  const j = (...xs) => xs.flat(Infinity).filter(Boolean).join(" ").replace(/\s+/g, " ").trim();

  // ---- slots packer ---------------------------------------------------------
  const pack = (s) => {
    try {
      if (s == null) return { default: [] };
      if (Arr(s))   return { default: s };
      if (Str(s))   return { default: [String(s)] };
      if (Obj(s)) {
        const o = {};
        o.default = ('default' in s) ? toArr(s.default) : [];
        for (const k in s) if (k !== "default") o[k] = toArr(s[k]);
        return o;
      }
      return { default: [s] };
    } catch (err) {
      console.error('🚨 Mishkah Pack Error:', err);
      console.error('Input that caused error:', s);
      console.error('Stack:', err.stack);
      return { default: [`[Pack Error: ${err.message}]`] };
    }
  };

  // ---- twcss bridge (rtl/ltr + dark/light) ---------------------------------
  const withTw = (value) => {
    const mod = (window.Mishkah && window.Mishkah.twcss) || null;
    if (!mod) return String(value);
    return mod.tw(value);
  };

  // ---- props normalizer -----------------------------------------------------


const norm = (p) => {
  const out = { ...p };
  if (out.className && !out.class) { out.class = out.className; delete out.className; }
  if ("tw" in out) {
    const v = typeof out.tw === "function" ? out.tw() : out.tw;
    const cls = withTw(v);
    out.class = out.class ? j(out.class, cls) : cls;
    delete out.tw;
  }
  if ("c" in out) {
    const v = typeof out.c === "function" ? out.c() : out.c;
    out.class = out.class ? j(out.class, v) : v;
    delete out.c;
  }
  return out;
};

  // ---- helpers to set attributes -------------------------------------------
  const setDataset = (el, data) => { if (!data) return; for (const k in data) el.dataset[k] = String(data[k]); };
  const setAria    = (el, aria) => { if (!aria) return; for (const k in aria) el.setAttribute("aria-" + k, String(aria[k])); };

  // CSS styles: support cssText, object props, and CSS variables
  const setStyle = (el, style) => {
    if (!style) return;
    if (typeof style === "string") { el.style.cssText = style; return; }
    if (!Obj(style)) return;
    for (const k in style) {
      const v = style[k];
      if (k.startsWith("--") || k.includes("-")) el.style.setProperty(k, v);
      else el.style[k] = v;
    }
  };

  // ---- lightweight lifecycle (onMounted / onUnmounted) ---------------------
  // ملاحظة: خفيفة وآمنة. بنستعمل MutationObserver فقط وقت الحاجة.
  function attachLifecycle(el, onMnt, onUnmnt) {
    if (!Fn(onMnt) && !Fn(onUnmnt)) return;

    let mounted = false;
    let lastConnected = el.isConnected;

    const tryMount = () => {
      if (!mounted && el.isConnected) {
        mounted = true;
        try { onMnt && onMnt(el); } catch(_) {}
      }
    };
    const tryUnmount = () => {
      if (mounted && !el.isConnected) {
        mounted = false;
        try { onUnmnt && onUnmnt(el); } catch(_) {}
        // بعد الـ unmount مش بنحتاج observer
        obs.disconnect();
      }
    };

    // حالة تم إضافتها فورًا
    queueMicrotask(tryMount);

    const obs = new MutationObserver(() => {
      const now = el.isConnected;
      if (now !== lastConnected) {
        lastConnected = now;
        if (now) tryMount(); else tryUnmount();
      }
    });

    // نراقب document.body (مرّة لكل عنصر له lifecycle، وهذا مقبول)
    if (document.body) {
      obs.observe(document.body, { childList: true, subtree: true });
    } else {
      // fallback بدائي لو body لسه مش جاهز
      const id = setInterval(() => {
        if (document.body) {
          clearInterval(id);
          obs.observe(document.body, { childList: true, subtree: true });
          tryMount();
        }
      }, 16);
    }
  }

const toNode = (spec) => {
  try {
    if (spec == null || spec === false) return document.createComment("NULL_SPEC");
    if (spec instanceof Node) return spec;
    if (typeof spec === 'string' || typeof spec === 'number') return document.createTextNode(String(spec));

    if (Array.isArray(spec)) {
      const fragment = document.createDocumentFragment();
      for (let i = 0; i < spec.length; i++) {
        fragment.appendChild(toNode(spec[i]));
      }
      return fragment;
    }

    if (typeof spec === 'object' && spec.__A) {
      if (spec.tag === "#fragment") {
        const fragment = document.createDocumentFragment();
        const children = spec.slots?.default || [];
        for (let i = 0; i < children.length; i++) {
          fragment.appendChild(toNode(children[i]));
        }
        return fragment;
      }

      const ns = (spec.tag === "svg" || spec.props?.ns === "svg" || spec.props?.xmlns)
        ? "http://www.w3.org/2000/svg"
        : null;

      const el = ns ? document.createElementNS(ns, spec.tag) : document.createElement(spec.tag);
      const p = spec.props || {};

      if (p.class != null) el.className = p.class;
      if (p.style) setStyle(el, p.style);
      if (p.data && typeof p.data === 'object') setDataset(el, p.data);
      if (p.aria && typeof p.aria === 'object') setAria(el, p.aria);

      const htmlPayload = p.html ?? p.dangerouslySetInnerHTML;
      if (htmlPayload != null) {
        if (htmlPayload && typeof htmlPayload === 'object' && "__html" in htmlPayload) {
          el.innerHTML = String(htmlPayload.__html);
        } else {
          el.innerHTML = String(htmlPayload);
        }
      }

      let onMounted = null;
      let onUnmounted = null;

      for (const k in p) {
        if (/^\d/.test(k)) {
			
			console.log(spec);
          console.warn(`[Mishkah.Atoms] Invalid attribute name "${k}" "${p[k]}" ignored. htmlPayload: ${htmlPayload}`);
          continue;
        }

        const v = p[k];

        if (k === "class" || k === "className" || k === "style" || k === "children" || k === "data" || k === "aria" || k === "html" || k === "dangerouslySetInnerHTML") {
          continue;
        }
        
        if (k === "onMounted") { if (typeof v === 'function') onMounted = v; continue; }
        if (k === "onUnmounted") { if (typeof v === 'function') onUnmounted = v; continue; }

        if (k.startsWith("on") && k.length > 2 && k[2] === k[2].toUpperCase()) {
          if (typeof v === 'function') {
            el.addEventListener(k.slice(2).toLowerCase(), v);
          } else if (v != null) {
            el.dataset[k.toLowerCase()] = String(v);
          }
          continue;
        }

        if (k === "ref") {
          if (typeof v === 'function') v(el);
          else if (v && typeof v === 'object' && "current" in v) v.current = el;
          continue;
        }
        
        if (k.startsWith("bind:")) {
          const bk = k.slice(5);
          if (bk === "value") {
            el.value = v;
            el.setAttribute("data-value", String(v));
          } else if (bk === "checked" && "checked" in el) {
            el.checked = !!v;
            if (v) el.setAttribute("checked", "");
          }
          continue;
        }
        
        if (k === "dir" || k === "lang" || k === "role" || k.startsWith("aria-") || k.startsWith("data-")) {
          el.setAttribute(k, String(v));
          continue;
        }

        if ((k === "checked" || k === "selected" || k === "disabled" || k === "multiple") && (k in el)) {
          el[k] = !!v;
          if (v) el.setAttribute(k, "");
          continue;
        }

        if (k === "value" && "value" in el) {
          el.value = v;
          el.setAttribute("data-value", String(v));
          continue;
        }

        if (k in el) {
          try {
            el[k] = v;
          } catch {
            el.setAttribute(k, String(v));
          }
        } else {
          el.setAttribute(k, String(v));
        }
      }

      if (htmlPayload == null) {
        const children = spec.slots?.default || [];
        for (let i = 0; i < children.length; i++) {
          el.appendChild(toNode(children[i]));
        }
      }
      
      if (onMounted || onUnmounted) attachLifecycle(el, onMounted, onUnmounted);
      return el;
    }

    return document.createTextNode(String(spec));

  } catch (err) {
    console.error('🚨 Mishkah DOM Build Error:', err);
    console.error('Spec that caused error:', spec);
    console.error('Stack:', err.stack);
    
    const errorEl = document.createElement('div');
    errorEl.style.cssText = 'color:#b91c1c;background:#fee2e2;padding:8px;border-radius:4px;border:1px solid #dc2626;margin:2px;font-family:monospace;font-size:12px';
    errorEl.innerHTML = `<strong>DOM Build Error:</strong> ${err.message}<br><small>Check console for details</small>`;
    return errorEl;
  }
};
  
// ---- factory / proxy API --------------------------------------------------
function create() {
  const h = (tag, props = {}, slots = {}) => ({ __A: 1, tag: String(tag), props: norm(props), slots: pack(slots) });
  const make = t => (p = {}, s = {}) => h(t, p, s);

  const HTML = ["div","span","p","a","button","input","select","option","optgroup","textarea","label","form","fieldset","legend","ul","ol","li","dl","dt","dd","nav","header","footer","main","section","article","aside","details","summary","img","picture","source","video","audio","track","canvas","iframe","table","thead","tbody","tfoot","tr","td","th","colgroup","col","caption","h1","h2","h3","h4","h5","h6","small","strong","em","i","b","u","code","pre","blockquote","hr","br","sup","sub","time","progress","meter","dialog","template","slot"];
  const SVG  = ["svg","g","path","rect","circle","ellipse","line","polyline","polygon","text","defs","use","symbol","clipPath","mask","pattern","linearGradient","radialGradient","stop","filter","feGaussianBlur","feOffset","feMerge","feColorMatrix"];

  const api = {};
  for (const t of [...HTML, ...SVG]) {
    const U = t.charAt(0).toUpperCase() + t.slice(1);
    api[t] = make(t);
    api[U] = api[t];
  }

  // region mount bridge مع النواة
  const mountRegion = (app, uKey, mount, build, parent = null, opt = {}) => {
    app.registerRegion(uKey, mount, (state, ctx) => {
      const spec = build(state, ctx);
      if (spec == null) return "";
      if (spec instanceof Node)    return spec;
      if (Str(spec) || Arr(spec))  return spec;
      if (Obj(spec) && spec.__A)   return toNode(spec);
      return "";
    }, parent, opt);
    return app;
  };

  const proxy = new Proxy(api, {
    get(target, key) {
      // --- ✅ START: التصحيح ---
      // 1. تحقق من الأدوات والوظائف الخاصة أولاً
      if (key === 'toNode') return toNode;
      if (key === 'mountRegion') return mountRegion;
      if (key === 'h') return h;
      if (key === 'Fragment') return (p = {}, s = {}) => ({ __A: 1, tag: "#fragment", props: p, slots: pack(s) });
      if (key === 'component') return (fn) => (p = {}, s = {}) => fn(p, pack(s));
      if (key === 'cx') return j;
      if (key === 'defineTags') return arr => {
        if (!arr) return;
        for (const raw of toArr(arr)) {
          const t = String(raw).trim(); if (!t) continue;
          const U = t.charAt(0).toUpperCase() + t.slice(1);
          proxy[t] = make(t); proxy[U] = proxy[t];
        }
      };
      if (key === 'if')   return (cond, truthy, falsy = null) => cond ? truthy : falsy;
      if (key === 'show') return (cond, node) => cond ? node : null;
      if (key === 'each') return (list, map, keyFn) => {
        const arr = toArr(Fn(list) ? list() : list);
        const res = [];
        for (let i = 0; i < arr.length; i++) {
          const it = arr[i];
          const child = map(it, i);
          if (child && Obj(child) && child.__A && keyFn) {
            const kx = Fn(keyFn) ? keyFn(it, i) : (it && it[keyFn]);
            child.props = child.props || {};
            if (kx != null && child.props.key == null) child.props.key = String(kx);
          }
          res.push(child);
        }
        return res;
      };
      if (key === 't') return (ctx, i18nKey, vars) => (ctx && ctx.i18n && ctx.i18n.t) ? ctx.i18n.t(i18nKey, vars) : String(i18nKey);
      
      // 2. تحقق من وسوم HTML/SVG المعرفة مسبقًا
      if (key in target) {
        return target[key];
      }

      // 3. إذا لم يكن أي مما سبق، افترض أنه مكون مخصص (السلوك الافتراضي)
      return make(String(key));
      // --- ✅ END: التصحيح ---
    }
  });

  return Object.assign(proxy, { toNode, mountRegion });
}
  window.Mishkah = window.Mishkah || {};
  window.Mishkah.Atoms = create();
  window.Mishkah.Atoms.create = create;

})(window);

// DSL
// تبسيط قوي لبناء الواجهات فوق Atoms/Core، مع دعم i18n/RTL/Dark و twcss
(function (window) {
  "use strict";

  const Core = window.Mishkah && window.Mishkah.Core;
  const A = window.Mishkah && window.Mishkah.Atoms;
  const U = window.Mishkah && window.Mishkah.utils;
  const twcss = window.Mishkah && window.Mishkah.twcss;

  if (!Core || !A || !U) return;

  // ======= أدوات صغيرة =======
  const Arr = Array.isArray;
  const Fn = v => typeof v === "function";
  const Str = v => typeof v === "string" || typeof v === "number";
  const Obj = v => v && typeof v === "object" && !Arr(v);

  const toArr = v => v == null ? [] : Arr(v) ? v : [v];
  const j = (...xs) => xs.flat(Infinity).filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  const get = (o, p) => !p ? o : String(p).split(".").reduce((a, k) => (a && a[k] != null) ? a[k] : undefined, o);
  const set = (o, p, v) => { const ks = String(p).split("."); let t = o; for (let i = 0; i < ks.length - 1; i++) { const k = ks[i]; if (!Obj(t[k])) t[k] = {}; t = t[k] } t[ks[ks.length - 1]] = v; return o };
  const pick = (o, paths = []) => { const r = {}; for (const k of paths) r[k] = get(o, k); return r };
  const changedShallow = (a, b) => { const ka = Object.keys(a), kb = Object.keys(b); if (ka.length !== kb.length) return true; for (const k of ka) if (a[k] !== b[k]) return true; return false };

  const asTw = (value) => {
    if (twcss && twcss.tw) return twcss.tw(value);
    return String(value);
  };

  // ======= مفسر التوجيهات/الديركتيف =======
  function transformDirectives(node, state, appCtx) {
    if (!node || !Obj(node) || !node.props) return node;

    const p = node.props;
    const out = { ...p };
    const env = appCtx.env || {};
    const i18n = appCtx.i18n || (env && env.i18n) || null;

    // 1) events on:*  →  onClick / onInput ... أو dispatch بالاسم
    for (const k in p) {
      if (k.startsWith("on:")) {
        const ev = k.slice(3);
        const cap = ev[0].toUpperCase() + ev.slice(1);
        const handler = p[k];
        if (Str(handler)) {
          const actionId = String(handler);
          out["on" + cap] = e => {
            const fn = appCtx.actions && appCtx.actions[actionId];
            if (fn) fn(e); // actions مغلفة بالفعل بالtruth.set
          };
        } else if (Fn(handler)) {
          out["on" + cap] = handler;
        }
        delete out[k];
      }
    }

    // 2) model / bind:value  (مع أنواع)
    //   model="user.name"
    //   model:number="qty"
    //   model:checked="todo.done"
    for (const k in p) {
      if (k === "bind:value" || k === "model" || k.startsWith("model:")) {
        const type = (k === "bind:value" || k === "model") ? "text" : k.slice(6);
        const path = String(p[k]);
        const current = get(state, path);

        // value getter
        if (type === "checked") {
          out.checked = !!current;
        } else if (type === "number") {
          out.value = current ?? 0;
          out.inputMode = out.inputMode || "decimal";
        } else {
          out.value = current ?? "";
        }

        const normalize = (el) => {
          if (type === "checked") return !!el.checked;
          if (type === "number") return (el.value === "" ? 0 : +el.value);
          return el.value;
        };

        const prev = out.onInput;
        out.onInput = (e) => {
          if (prev) prev(e);
          appCtx.truth.set(s => {
            set(s, path, normalize(e.target));
            return { ...s };
          });
        };
        delete out[k];
      }
    }

    // 3) class:active أو class:foo
    for (const k in p) {
      if (k.startsWith("class:")) {
        const cls = k.slice(6);
        if (p[k]) out.class = out.class ? j(out.class, cls) : cls;
        delete out[k];
      }
    }

    // 4) style:prop="value"
    for (const k in p) {
      if (k.startsWith("style:")) {
        const prop = k.slice(6);
        out.style = out.style || {};
        out.style[prop] = p[k];
        delete out[k];
      }
    }

    // 5) tw="..." → دمج مع class
    if ("tw" in out) {
      const twv = Fn(out.tw) ? out.tw(state, appCtx) : out.tw;
      const cls = asTw(twv);
      out.class = out.class ? j(out.class, cls) : cls;
      delete out.tw;
    }

    // 6) t="key" + t:vars={{...}}  (i18n)
    if ("t" in out || "t:key" in out) {
      const key = out["t:key"] || out.t;
      const vars = out["t:vars"] || undefined;
      delete out["t:key"]; delete out["t:vars"]; delete out.t;

      let text = String(key);
      if (i18n && i18n.t) {
        try { text = i18n.t(String(key), vars) } catch (_) { text = String(key) }
      }
      // إن لم يوجد slot افتراضي نضع الترجمة
      const slots = node.slots || {};
      const hasContent = toArr(slots.default || []).length > 0;
      if (!hasContent) {
        return A.h(node.tag, out, { default: [text] });
      }
    }

    // 7) if/show
    if ("if" in out) {
      const cond = Fn(out.if) ? out.if(state, appCtx) : out.if;
      delete out.if;
      if (!cond) return null;
    }
    if ("show" in out) {
      const cond = Fn(out.show) ? out.show(state, appCtx) : out.show;
      delete out.show;
      if (!cond) return null;
    }

    // 8) html=  (يتوافق مع Atoms التي تتعامل مع p.html)
    if ("html" in out) {
      out.html = out.html && Obj(out.html) && "__html" in out.html ? out.html : { __html: String(out.html ?? "") };
    }

    // 9) for / each  → "item in path" أو مصفوفة مباشرة
    if ("for" in p || "each" in p) {
      const spec = String(p["for"] ?? p["each"]);
      const m = spec.match(/^(\w+)\s+in\s+(.+)$/);
      const list = m ? (get(state, m[2]) || []) : (get(state, spec) || []);
      const varName = m ? m[1] : "item";
      const items = toArr(list);
      const slots = node.slots || {};
      const def = toArr(slots.default || []);
      const rendered = items.map((item, idx) => {
        // نحقن {item,index} كمحتوى للـslot
        const kids = def.map(k => (Fn(k) ? k({ [varName]: item, index: idx }, state, appCtx) : k));
        return A.h(node.tag, out, { default: kids });
      });
      return A.Fragment ? A.Fragment({},{ default: rendered }) : { __A: 1, tag: "#fragment", props: {}, slots: { default: rendered } };
    }

    // 10) await:of / await  + pending/then/catch
    if ("await" in p || "await:of" in p) {
      const src = p["await:of"] ?? p["await"];
      const pending = p["await:pending"];
      const thenSlot = p["await:then"];
      const catchSlot = p["await:catch"];
      ["await", "await:of", "await:pending", "await:then", "await:catch"].forEach(k => delete out[k]);

      const prom = Str(src) ? get(state, String(src)) : src;
      if (!prom || !Fn(prom.then)) return null;

      // حالة سهلة: نعرض pending، ثم نعيد بناء المنطقة عند الاكتمال
      const key = Symbol("await_key");
      appCtx.__awaitKeys = appCtx.__awaitKeys || new Set();
      appCtx.__awaitKeys.add(key);
      prom.then(v => {
        if (appCtx.__awaitKeys && appCtx.__awaitKeys.has(key)) {
          appCtx.truth.set(s => s);
          appCtx.__awaitLast = { v };
        }
      }).catch(e => {
        if (appCtx.__awaitKeys && appCtx.__awaitKeys.has(key)) {
          appCtx.truth.set(s => s);
          appCtx.__awaitLast = { e };
        }
      });

      if (appCtx.__awaitLast && "v" in appCtx.__awaitLast && thenSlot) {
        const n = Fn(thenSlot) ? thenSlot(appCtx.__awaitLast.v, state, appCtx) : thenSlot;
        return Obj(n) && n.__A ? n : n;
      }
      if (appCtx.__awaitLast && "e" in appCtx.__awaitLast && catchSlot) {
        const n = Fn(catchSlot) ? catchSlot(appCtx.__awaitLast.e, state, appCtx) : catchSlot;
        return Obj(n) && n.__A ? n : n;
      }
      // pending
      return Obj(pending) && pending.__A ? pending : (Str(pending) || Arr(pending) ? pending : A.h(node.tag, out, { default: [pending] }));
    }

    // 11) fetch:of into=path on=mounted|click
    if ("fetch:of" in p || "fetch:src" in p || "fetch" in p) {
      const src = p["fetch:of"] ?? p["fetch:src"] ?? p["fetch"];
      const into = p["fetch:into"];
      const onEv = p["fetch:on"] || "mounted";
      ["fetch:of", "fetch:src", "fetch", "fetch:into", "fetch:on"].forEach(k => delete out[k]);

      const doFetch = (u) => Promise.resolve(Fn(u) ? u(state, appCtx) : u)
        .then(x => fetch(x)).then(r => r.json())
        .then(data => { if (into) appCtx.truth.set(s => { set(s, String(into), data); return { ...s } }) });

      if (onEv === "mounted") {
        const prev = out.onMounted;
        out.onMounted = (el) => { if (prev) prev(el); doFetch(src) };
      } else if (onEv === "click") {
        const prev = out.onClick;
        out.onClick = (e) => { if (prev) prev(e); doFetch(src) };
      }
    }

    // 12) use:behavior   (enhancers)  use:tip={opts}
    for (const k in p) {
      if (k.startsWith("use:")) {
        const name = k.slice(4);
        const enhancer = get(window, "Mishkah.behaviors." + name);
        if (Fn(enhancer)) {
          const args = p[k];
          const prevMounted = out.onMounted;
          const prevUnmounted = out.onUnmounted;
          out.onMounted = (el) => {
            if (prevMounted) prevMounted(el);
            try {
              const dispose = enhancer(el, args, { state, ctx: appCtx });
              if (Fn(dispose)) {
                el.__disposeEnhancers = el.__disposeEnhancers || [];
                el.__disposeEnhancers.push(dispose);
              }
            } catch (_) {}
          };
          out.onUnmounted = (el) => {
            if (prevUnmounted) prevUnmounted(el);
            (el.__disposeEnhancers || []).forEach(fn => { try { fn() } catch (_) {} });
          };
        }
        delete out[k];
      }
    }

    // 13) router helpers
    if ("go:to" in p) {
      const to = String(p["go:to"]);
      const prev = out.onClick;
      out.onClick = (e) => { if (prev) prev(e); e && e.preventDefault && e.preventDefault(); if (appCtx.router && appCtx.router.navigate) appCtx.router.navigate(to) };
      delete out["go:to"];
    }
    if ("match:path" in p) {
      const re = new RegExp(String(p["match:path"]));
      delete out["match:path"];
      if (!re.test(appCtx.router?.path || "")) return null;
    }
    if ("if:route" in p) {
      const name = String(p["if:route"]);
      delete out["if:route"];
      if ((appCtx.router && appCtx.router.name) !== name) return null;
    }

    // 14) المعالجة التراجعية للأبناء/الفتحات
    const slots = node.slots || {};
    const def = toArr(slots.default || []).map(c => Str(c) || Arr(c) ? c : transformDirectives(c, state, appCtx)).filter(Boolean);
    const rest = {};
    for (const sk in slots) {
      if (sk === "default") continue;
      rest[sk] = toArr(slots[sk] || []).map(c => Str(c) || Arr(c) ? c : transformDirectives(c, state, appCtx)).filter(Boolean);
    }

    return A.h(node.tag, out, Object.assign({ default: def }, rest));
  }

  // ======= واجهة الموديول عالية المستوى =======
  function buildModule(app, name) {
    let _state = {};
    let _actions = {};
    let _selectors = {};
    let _css = "";
    let _html = null; // دالة تبني spec مباشرة
    let _view = null; // دالة إرجاع Atoms-spec
    const _watches = [];

    const selectorsView = (s) => {
      const out = {};
      for (const k in _selectors) out[k] = _selectors[k](s);
      return out;
    };

    const runWatches = (prev, next) => {
      for (const w of _watches) {
        if (w.when && !w.when(next, prev)) continue;
        try { w.run(next, prev) } catch (_) {}
      }
    };

    function buildSpec(s, ctx) {
      if (_html) return _html(s, { a: app.actions, name, ctx });
      const v = _view ? _view(s, app.actions, selectorsView(s), ctx) : null;
      if (!v) return null;
      if (Obj(v) && v.__A) return transformDirectives(v, s, ctx);
      return v;
    }

    // تخزين slice مريح
    function makeStore(ns, init) {
      const key = "mishkah:mod:" + name + ":" + ns;
      try {
        const raw = localStorage.getItem(key);
        if (raw != null) {
          const parsed = JSON.parse(raw);
          if (Obj(parsed)) init = parsed;
        }
      } catch (_) { }
      if (!_state[ns]) _state[ns] = init;

      const path = ns;
      const storeAPI = {
        get: () => get(app.truth.get(), path),
        set: (val) => app.truth.set(s => { set(s, path, Fn(val) ? val(get(s, path)) : val); return { ...s } }),
        bind: (k) => ({
          value: (s) => get(s, path + "." + k),
          onInput: (e) => app.truth.set(s => { set(s, path + "." + k, e.target.value); return { ...s } })
        }),
        subscribe: (fn) => app.truth.subscribe(({ state }) => fn(get(state, path))),
        persist: (storageKey) => {
          const sk = storageKey || key;
          app.truth.subscribe(({ state }) => {
            try { localStorage.setItem(sk, JSON.stringify(get(state, path))) } catch (_) { }
          });
          return storeAPI;
        }
      };
      return storeAPI;
    }

    const api = {
      state(v) { _state = v || {}; return api },
      actions(map) { _actions = map || {}; return api },
      selectors(map) { _selectors = map || {}; return api },
      css(txt) { _css = String(txt || ""); return api },
      html(tpl) { _html = tpl; return api },
      view(fn) { _view = fn; return api },
      watch(when, run) { _watches.push({ when, run }); return api },
      task(fn, deps) {
        let prev = null;
        _watches.push({
          when: (n, p) => {
            const next = pick(n, deps || []);
            const ok = prev == null || changedShallow(prev, next);
            prev = next;
            return ok;
          },
          run: (n, p) => { fn(n, p) }
        });
        return api;
      },
      store: makeStore,
      router(map, opts = {}) {
        const routes = map || {};
        const parse = () => {
          const h = location.hash.replace(/^#/, "") || "/";
          for (const k in routes) {
            const r = routes[k];
            if (r && r.test && r.test(h)) return { name: k, path: h, params: (r.exec(h) || []).groups || {} }
          }
          return { name: null, path: h, params: {} }
        };
        const nav = (to) => { location.hash = to };
        app.router = { ...parse(), navigate: nav };

        const onHash = () => {
          app.router = Object.assign(app.router, parse());
          app.helpers.mark(name);
        };
        window.addEventListener("hashchange", onHash);
        if (opts.init !== false) onHash();
        return api;
      },
      mount(mountSel, parent = null, opt = {}) {
        // 1) اعداد truth/engine من النواة إن لم تُنشأ
        if (!app._core_created) {
          // لو أنشأ المستخدم app عبر Core.createApp فهنستخدمه
          // وإلا ننشئ واحداً بخيارات بيئية معتمدة
          if (!app.truth) {
            const core = Core.createApp({
              root: null,
              initial: _state,
              dictionaries: app.dictionaries,
              locale: app.locale,
              dir: app.dir,
              theme: app.theme,
              persistEnv: true
            });
            Object.assign(app, core);
            app._core_created = true;
          } else {
            // عند وجود truth سابق: دمج حالة الموديول
            app.truth.set(s => Object.assign({}, s, _state));
          }
        } else {
          app.truth.set(s => Object.assign({}, s, _state));
        }

        // 2) تغليف الأوامر لتصبح actions جاهزة للاستدعاء
        app._rawActions = app._rawActions || {};
        app.actions = app.actions || {};
        for (const k in _actions) {
          app._rawActions[name + ":" + k] = _actions[k];
          app.actions[k] = (...args) => app.truth.set(s => {
            const fn = _actions[k];
            const r = fn ? fn(s, ...args) : s;
            return r === undefined ? s : r;
          });
        }

        // 3) حقن CSS نطاقي
        if (_css && mountSel) {
          const id = "mishkah-mod-" + name + "-css";
          let el = document.getElementById(id);
          if (!el) { el = document.createElement("style"); el.id = id; document.head.appendChild(el) }
          // :scope → [data-m="<name>"]
          el.textContent = _css.replace(/:scope/g, '[data-m="' + name + '"]');
        }

        // 4) تسجيل المنطقة عبر Atoms → Engine
        const build = (s, ctx) => {
          // ctx يحتوي env/i18n حسب Core
          return buildSpec(s, Object.assign({ truth: app.truth, actions: app.actions, router: app.router, env: app.env, i18n: app.i18n }, ctx));
        };

        // نغلف الإخراج ليحمل data-m للموديول
        const regionBuild = (s, ctx) => {
          const spec = build(s, ctx);
          if (!spec) return "";
          const n = (Obj(spec) && spec.__A) ? spec : (Str(spec) || Arr(spec) ? A.div({}, { default: toArr(spec) }) : A.div());
          // أضف علامة نطاق CSS
          if (n && n.props) {
            n.props = n.props || {};
            n.props["data-m"] = n.props["data-m"] || name;
          }
          return transformDirectives(n, s, Object.assign({ truth: app.truth, actions: app.actions, router: app.router, env: app.env, i18n: app.i18n }, ctx));
        };

        A.mountRegion(app, name, mountSel, (s, ctx) => regionBuild(s, ctx), parent, opt);

        // 5) مراقبة الحالة لتشغيل watch
        if (app.truth.subscribe) {
          let prev = app.truth.get();
          app.truth.subscribe(({ state }) => { runWatches(prev, state); prev = state });
        }

        // 6) أول رندر
        app.helpers.mark(name);
        return api;
      }
    };

    return api;
  }

  // ======= واجهة تطبيق DSL =======
  const DSLApp = {
    // إنشاء تطبيق Core بالنيابة، أو الربط بتطبيق موجود
    create(opts = {}) {
      const app = Core.createApp({
        root: opts.root || null,
        initial: opts.initial || {},
        commands: opts.commands || {},
        locale: opts.locale || "en",
        dir: opts.dir || "auto",
        theme: opts.theme || "auto",
        dictionaries: opts.dictionaries || {},
        persistEnv: opts.persistEnv !== false
      });
      return app;
    },
    attach(app) { this.__app = app; return this },
    module(name) { return buildModule(this.__app || this.create(), name) },
    // كِتابة DSL مباشرة بدون موديول (للأجزاء الصغيرة)
    h: A.h,
    Fragment: A.Fragment,
    cx: j
  };

  // كشف
  window.Mishkah = window.Mishkah || {};
  window.Mishkah.DSL = DSLApp;

})(window);


