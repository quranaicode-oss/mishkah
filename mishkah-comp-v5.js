// mishkah-components-v5.js (Theme-Variables Edition)
// يعتمد على متغيرات CSS من mishkah-theme-v5.css
// متوافق مع Mishkah v5 Core/Atoms/DSL

(function (window) {
  "use strict";

  const M = window.Mishkah || (window.Mishkah = {});
  const Core  = M.Core || null;
  const U     = M.utils || {};
  const twcss = M.twcss || null;
  const A     = M.Atoms || null;
  if (!A) { console.warn("[Mishkah.Comp] Atoms module is required."); return; }

  // -----------------------------
  // Utilities & Helpers
  // -----------------------------
  const isArray = Array.isArray;
  const isObject = v => v && typeof v === "object" && !Array.isArray(v);
  const isFunction = v => typeof v === "function";
  const isStringLike = v => typeof v === "string" || typeof v === "number";
  const toArray = v => v == null ? [] : isArray(v) ? v : [v];

  const join = (...xs) => xs.filter(Boolean).join(" ");
  const asTw = (cls) => ({ tw: cls });
  const t = (k, vars, app) => (app && app.i18n && isFunction(app.i18n.t)) ? app.i18n.t(k, vars) : (vars && vars.fallback) || k;
  const range = (n, start=1) => Array.from({length:n}, (_,i)=> i+start);
  const asSlots = (slots)=> slots && isObject(slots) ? slots : { default: toArray(slots && slots.default ? slots.default : slots) };

  const isArr = isArray;
  const isObj = isObject;
  const isFn = isFunction;
  const isStr = isStringLike;

  // CSS Tokens from Theme (variables)
  // نستخدم var(...) مباشرة لتسهيل التبديل بين الثيمات
  const TOK = {
    fontSans: 'var(--font-sans, system-ui, -apple-system, sans-serif)',

    bgPage: 'var(--bg-page, #f7f7f8)',
    bgSurface: 'var(--bg-surface, #ffffff)',
    bgUI: 'var(--bg-ui, #e5e7eb)',
    bgUIHover: 'var(--bg-ui-hover, #d1d5db)',

    text: 'var(--text-default, #0f172a)',
    subtle: 'var(--text-subtle, #64748b)',
    onPrimary: 'var(--text-on-primary, #ffffff)',

    border: 'var(--border-default, #e5e7eb)',

    primary: 'var(--primary, #6366f1)',
    primaryHover: 'var(--primary-hover, #4f46e5)',
    primarySoft: 'var(--primary-soft, rgba(99,102,241,0.1))',
    ring: 'var(--ring-color, #6366f1)',

    success: 'var(--success, #10b981)',
    successSoft: 'var(--success-soft, rgba(16,185,129,0.1))',

    danger: 'var(--danger, #ef4444)',
    dangerSoft: 'var(--danger-soft, rgba(239,68,68,0.1))',

    shadowMd: 'var(--shadow-md, 0 4px 6px -1px rgba(0,0,0,.1), 0 2px 4px -2px rgba(0,0,0,.1))',

    radiusSm: 'var(--radius-sm, .25rem)',
    radiusMd: 'var(--radius-md, .5rem)',
    radiusLg: 'var(--radius-lg, 1rem)',
    radiusFull: 'var(--radius-full, 9999px)',
    transition: 'var(--transition-default, 150ms cubic-bezier(0.4, 0, 0.2, 1))'
  };

  // Tone helpers
  function intentTones(intent = "primary") {
    switch (intent) {
      case "success":
        return { bg: TOK.success, fg: TOK.onPrimary, border: TOK.success, soft: TOK.successSoft };
      case "danger":
        return { bg: TOK.danger, fg: TOK.onPrimary, border: TOK.danger, soft: TOK.dangerSoft };
      case "warning":
        // لا يوجد warning-soft في الثيم، نستخدم successSoft كـ fallback خفيف
        return { bg: 'hsl(var(--brand-warning-h,45) var(--brand-warning-s,93%) 50%)', fg: TOK.onPrimary, border: 'hsl(var(--brand-warning-h,45) var(--brand-warning-s,93%) 50%)', soft: 'rgba(250, 204, 21, 0.12)' };
      case "neutral":
        return { bg: TOK.text, fg: '#ffffff', border: TOK.text, soft: 'rgba(15,23,42,0.1)' };
      default:
        return { bg: TOK.primary, fg: TOK.onPrimary, border: TOK.primary, soft: TOK.primarySoft };
    }
  }

  // Registry
  const REGISTRY = Object.create(null);
  const UTIL = Object.create(null);

  function define(name, fn) { if (name && isFunction(fn)) REGISTRY[name] = fn; }
  function call(name, p = {}, s = {}, state, app) {
    const fn = REGISTRY[name];
    if (!fn) {
      console.warn(`[Mishkah.Comp] Component "${name}" not found.`);
      return A.Div(asTw("text-[var(--danger,#ef4444)] font-mono"), { default: [`<Comp not found: ${name}>`] });
    }
    return fn(A, state, app, p, s);
  }

  const Comp = {
    define, call, registry: REGISTRY, list: () => Object.keys(REGISTRY)
  };

  function exposeUtil(name, value) {
    if (!name) return;
    UTIL[name] = value;
    Object.defineProperty(Comp, "util", {
      value: { ...(Comp.util || {}), [name]: value },
      writable: true,
      configurable: true
    });
  }

  Comp.util = {
    register: exposeUtil,
    get: (name) => UTIL[name],
    list: () => Object.keys(UTIL)
  };

  // DataSource & Exporter
  const DataSource = {
    async fetch({ url, method = 'GET', query, body, headers, timeout, withCredentials, map }) {
      if (!U.ajax) throw new Error("[Mishkah.Comp] utils.ajax is required for DataSource.");
      const res = await U.ajax(url, { method, headers, query, body, timeout, withCredentials, responseType: 'json' });
      return isFunction(map) ? map(res) : res;
    }
  };

  const Exporter = {
    toCSV(rows, columns) {
      const sep = ",";
      const head = (columns || []).map(c => '"' + String(c.title || c.key).replace(/"/g, '""') + '"').join(sep);
      const body = (rows || []).map(r => (columns || []).map(c => {
        const v = (r || {})[c.key];
        return '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
      }).join(sep)).join("\n");
      return head + "\n" + body;
    },
    csv(rows, cols, filename = "data.csv") { if (U.download) U.download(this.toCSV(rows, cols), filename, "text/csv;charset=utf-8"); },
    xls(rows, cols, filename = "data.xls") { if (U.download) U.download(this.toCSV(rows, cols), filename, "application/vnd.ms-excel"); },
    printHTML(html) {
      const w = window.open("", "_blank");
      if (!w) return;
      w.document.write(String(html));
      w.document.close();
      w.focus();
      w.print();
      w.close();
    }
  };

  // ---------------------------------------------------------
  // Primitives & UI Elements (Token-based, no dark: classes)
  // ---------------------------------------------------------

  Comp.define("Icon", (A, s, app, p = {}, sl = {}) =>
    A.Span(
      {
        role: "img",
        "aria-label": p.label || p.name || "",
        class: join(p.class),
        style: { color: p.color || "inherit" },
        ...asTw(p.tw || "")
      },
      { default: [p.char || "•"] }
    )
  );

  Comp.define("Button", (A, s, app, p = {}, sl = {}) => {
    const intent = p.intent || "primary";
    const variant = p.variant || "solid";
    const size = p.size || "md";
    const loading = !!p.loading;
    const disabled = loading || !!p.disabled;

    const SIZES = {
      sm: { padding: "6px 10px", fontSize: ".75rem" },
      md: { padding: "8px 14px", fontSize: ".875rem" },
      lg: { padding: "12px 18px", fontSize: "1rem" },
      icon: { padding: "10px", fontSize: "1rem" }
    };

    const tone = intentTones(intent);
    const sizeStyle = SIZES[size] || SIZES.md;

    const styleBy =
      variant === "outline"
        ? { background: "transparent", color: tone.bg, border: `1px solid ${tone.border}` }
        : variant === "ghost"
          ? { background: "transparent", color: tone.bg, border: "1px solid transparent" }
          : { background: tone.bg, color: tone.fg, border: `1px solid ${tone.border}` };

    const props = {
      ...p,
      type: p.type || "button",
      class: join("mk-btn", p.class),
      style: {
        borderRadius: `var(--radius-lg, ${TOK.radiusLg})`,
        fontWeight: 600,
        transition: TOK.transition,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        position: "relative",
        ...sizeStyle,
        ...styleBy,
        ...(p.style || {})
      },
      disabled
    };

    ['intent', 'variant', 'size', 'loading', 'text', 'iconLeft', 'iconRight'].forEach(k => delete props[k]);

    const renderIcon = (icon) => typeof icon === 'string' ? call('Icon', { char: icon }) : icon;

    const content = A.Span(
      {
        style: {
          visibility: loading ? 'hidden' : 'visible',
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px"
        }
      },
      {
        default: [
          p.iconLeft ? renderIcon(p.iconLeft) : null,
          (p.text || sl.default) ? A.Span({}, { default: sl.default || [p.text] }) : null,
          p.iconRight ? renderIcon(p.iconRight) : null
        ]
      }
    );

    const spinner = loading
      ? A.Span(
          { style: { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" } },
          { default: [call('Spinner', { size: 20 })] }
        )
      : null;

    return A.Button(props, { default: [content, spinner] });
  });

  Comp.define("Input", (A, s, app, p = {}, sl = {}) => {
    const style = {
      width: "100%",
      borderRadius: `var(--radius-lg, ${TOK.radiusLg})`,
      border: `1px solid ${TOK.border}`,
      background: TOK.bgSurface,
      color: TOK.text,
      padding: "8px 12px",
      outline: "none",
      transition: TOK.transition,
      ...(p.style || {})
    };

    const onFocus = (e) => { e.currentTarget.style.boxShadow = `0 0 0 3px color-mix(in oklab, ${TOK.ring} 35%, transparent)`; };
    const onBlur  = (e) => { e.currentTarget.style.boxShadow = "none"; };

    return A.Input(
      { ...p, class: join("mk-input", p.class), style, onFocus, onBlur, ...asTw(p.tw || "") },
      sl
    );
  });

  Comp.define("SelectBase", (A, s, app, p = {}, sl = {}) => {
    const style = {
      width: "100%",
      borderRadius: `var(--radius-lg, ${TOK.radiusLg})`,
      border: `1px solid ${TOK.border}`,
      background: TOK.bgSurface,
      color: TOK.text,
      padding: "8px 12px",
      outline: "none",
      transition: TOK.transition,
      ...(p.style || {})
    };
    return A.Select({ ...p, class: join("mk-select", p.class), style, ...asTw(p.tw || "") }, sl);
  });

  Comp.define("StatusDot", (A, s, app, p = {}) =>
    A.Span({
      style: {
        display: "inline-block",
        width: (p.size || 10) + "px",
        height: (p.size || 10) + "px",
        borderRadius: TOK.radiusFull,
        background: p.color || TOK.success
      }
    })
  );

  Comp.define("Spinner", (A, s, app, p = {}, sl = {}) => {
    const size = Math.max(8, p.size || 20);
    const style = {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      ...(p.style || {})
    };
    const dotStyle = {
      display: "inline-block",
      width: size + "px",
      height: size + "px",
      borderRadius: TOK.radiusFull,
      border: `2px solid ${TOK.border}`,
      borderTopColor: TOK.primary,
      animation: "mk-spin 0.9s linear infinite"
    };
    const keyframes = A.Style({
      html: `
      @keyframes mk-spin { to { transform: rotate(360deg) } }
    `});
    return A.Div({ class: join("mk-spinner", p.class), style }, { default: [keyframes, A.Span({ style: dotStyle })] });
  });

  Comp.define("Skeleton", (A, s, app, p = {}, sl = {}) =>
    A.Div({
      class: join("mk-skeleton", p.class),
      style: {
        width: p.w || "100%",
        height: p.h || "1rem",
        borderRadius: TOK.radiusMd,
        background: `linear-gradient(90deg, ${TOK.bgUI} 25%, ${TOK.bgUIHover} 37%, ${TOK.bgUI} 63%)`,
        backgroundSize: "400% 100%",
        animation: "mk-skel 1.4s ease infinite"
      }
    }, {
      default: [
        A.Style({
          html: `
          @keyframes mk-skel {
            0% { background-position: 100% 50% }
            100% { background-position: 0% 50% }
          }
        `
        })
      ]
    })
  );

  Comp.define("Textarea", (A, s, app, p = {}, sl = {}) => {
    const style = {
      width: "100%",
      borderRadius: TOK.radiusLg,
      border: `1px solid ${TOK.border}`,
      background: TOK.bgSurface,
      color: TOK.text,
      padding: "8px 12px",
      outline: "none",
      transition: TOK.transition,
      ...(p.style || {})
    };
    return A.Textarea({ rows: p.rows || 3, ...p, class: join("mk-textarea", p.class), style, ...asTw(p.tw || "") }, sl);
  });

  Comp.define("IconEmoji", (A, s, app, p = {}) =>
    A.Span({ role: 'img', 'aria-label': p.label || p.name || 'icon', style: { fontSize: p.size || '1em', lineHeight: 1, ...(p.style || {}) } }, { default: [p.char || '✨'] })
  );

  Comp.define("Badge", (A, s, app, p = {}) =>
    A.Span({
      class: join('mk-badge', p.class),
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '2px 8px',
        borderRadius: TOK.radiusFull,
        fontSize: '.75rem',
        fontWeight: 600,
        background: p.bg || TOK.bgUI,
        color: p.color || TOK.text,
        ...(p.style || {})
      }
    }, { default: toArray(p.children || []) })
  );

  Comp.define("Chip", (A, s, app, p = {}) =>
    A.Button({
      type: 'button',
      class: join('mk-chip', p.class),
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 10px',
        borderRadius: TOK.radiusLg,
        background: p.active ? TOK.primarySoft : TOK.bgUI,
        color: TOK.text,
        border: `1px solid ${TOK.border}`,
        ...(p.style || {})
      },
      onClick: p.onClick
    }, { default: [p.icon ? call('IconEmoji', { char: p.icon }) : null, p.label] })
  );

  Comp.define("Pill", (A, s, app, p = {}, sl = {}) =>
    A.Span({
      class: join("mk-pill", p.class),
      style: {
        display: "inline-flex",
        alignItems: "center",
        borderRadius: TOK.radiusFull,
        padding: "4px 12px",
        fontSize: ".75rem",
        background: TOK.text,
        color: "#fff",
        ...(p.style || {})
      },
      ...asTw(p.tw || "")
    }, sl)
  );

  Comp.define("Avatar", (A, s, app, p = {}, sl = {}) => {
    const size = p.size === 'lg' ? 48 : p.size === 'sm' ? 28 : 36;
    const content = p.src
      ? A.Img({ src: p.src, alt: p.alt || "", style: { width: "100%", height: "100%", borderRadius: TOK.radiusFull, objectFit: "cover" } })
      : (p.initials || (p.name ? String(p.name).trim().slice(0,2).toUpperCase() : "?"));

    return A.Div({
      class: join("mk-avatar overflow-hidden", p.class),
      style: {
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: TOK.radiusFull,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: p.src ? "transparent" : TOK.bgUI,
        color: TOK.text,
        fontWeight: 600,
        ...(p.style || {})
      },
      ...(p.attrs || {})
    }, { default: [content] });
  });

  Comp.define("Kbd", (A, s, app, p = {}, sl = {}) =>
    A.Kbd({
      class: join("mk-kbd", p.class),
      style: {
        borderRadius: TOK.radiusSm,
        border: `1px solid ${TOK.border}`,
        background: TOK.bgUI,
        color: TOK.text,
        padding: "2px 6px",
        fontSize: "11px",
        fontWeight: 700,
        textTransform: "uppercase"
      },
      ...asTw(p.tw || "")
    }, sl)
  );

  Comp.define("Progress", (A, s, app, p = {}, sl = {}) => {
    const value = Math.min(100, Math.max(0, +p.value || 0));
    return A.Div({
      class: join("mk-progress", p.class),
      style: { width: "100%", overflow: "hidden", borderRadius: TOK.radiusFull, background: TOK.bgUI, height: p.height || "8px", ...(p.style || {}) }
    }, { default: [ A.Div({ style: { width: `${value}%`, height: "100%", background: p.color || TOK.primary } }) ] });
  });

  Comp.define("Meter", (A, s, app, p = {}, sl = {}) => {
    const value = Math.min(1, Math.max(0, +p.value || 0)); const pct = Math.round(value * 100);
    return A.Div({ class: join("mk-meter flex items-center gap-2", p.class) }, {
      default: [
        A.Div({ style: { flex: 1, overflow: "hidden", borderRadius: TOK.radiusFull, background: TOK.bgUI, height: p.height || "8px" } }, {
          default: [ A.Div({ style: { width: `${pct}%`, height: "100%", background: p.color || TOK.success } }) ]
        }),
        A.Span({ class: join("text-xs font-semibold", p.labelClass), style: { color: TOK.text } }, { default: [`${pct}%`] })
      ]
    });
  });

  Comp.define("Divider", (A, s, app, p = {}) => {
    const isVertical = p.direction === 'vertical';
    return A.Div({
      role: 'separator',
      style: isVertical
        ? { height: "100%", width: "0px", borderLeft: `1px solid ${TOK.border}` }
        : { width: "100%", height: "0px", borderTop: `1px solid ${TOK.border}` },
      ...asTw(p.tw || "")
    });
  });

  Comp.define("Spacer", (A, s, app, p = {}) => A.Div({ 'aria-hidden': 'true', ...asTw(join('flex-grow', p.tw)) }));

  // ---------------------------------------------------------
  // Form Controls
  // ---------------------------------------------------------

  Comp.define("NumberInput", (A, s, app, p = {}, sl = {}) => {
    const step = +p.step || 1, min = (p.min != null) ? +p.min : null, max = (p.max != null) ? +p.max : null;
    const clamp = (v) => (min != null && v < min) ? min : (max != null && v > max) ? max : v;
    const val = (p.value != null) ? +p.value : 0;
    const set = (v) => p.onChange && p.onChange(clamp(+v));

    const btnStyle = {
      padding: "4px 8px",
      borderRadius: TOK.radiusSm,
      border: `1px solid ${TOK.border}`,
      background: TOK.bgSurface,
      color: TOK.text
    };
    const inputStyle = {
      width: "5.5rem",
      textAlign: "center",
      borderRadius: TOK.radiusSm,
      border: `1px solid ${TOK.border}`,
      background: TOK.bgSurface,
      color: TOK.text,
      padding: "4px 8px"
    };

    return A.Div({ class: join("mk-number-input inline-flex items-center gap-1", p.class) }, {
      default: [
        A.Button({ style: btnStyle, onClick: () => set(val - step) }, { default: ["−"] }),
        A.Input({ type: "number", value: val, onInput: (e) => set(e.target.value), style: inputStyle }),
        A.Button({ style: btnStyle, onClick: () => set(val + step) }, { default: ["+"] })
      ]
    });
  });

  Comp.define("PasswordInput", (A, s, app, p = {}, sl = {}) => {
    let show = false;
    const mark = () => app && app.helpers && app.helpers.mark && app.helpers.mark(p.uKey || "PasswordInput");
    const toggle = () => { show = !show; mark(); };

    const inputStyle = {
      width: "100%",
      borderRadius: TOK.radiusLg,
      border: `1px solid ${TOK.border}`,
      background: TOK.bgSurface,
      color: TOK.text,
      padding: "8px 36px 8px 12px",
      outline: "none"
    };

    return A.Div({ class: join("mk-password-input relative", p.class) }, {
      default: [
        A.Input({ type: show ? "text" : "password", value: p.value || "", onInput: p.onInput, placeholder: p.placeholder, style: inputStyle }),
        A.Button({
          class: "absolute",
          style: { right: "8px", top: "50%", transform: "translateY(-50%)", fontSize: "12px", opacity: .8, background: "transparent", border: "none", color: TOK.subtle },
          onClick: toggle
        }, { default: [ show ? t("ui.hide",{fallback:"Hide"},app): t("ui.show",{fallback:"Show"},app) ] })
      ]
    });
  });

  Comp.define("TagInput", (A, s, app, p = {}, sl = {}) => {
    let tags = isArray(p.value) ? p.value.slice() : [];
    const mark = () => app && app.helpers && app.helpers.mark && app.helpers.mark(p.uKey || "TagInput");

    const add = (txt) => {
      const v = String(txt || "").trim();
      if (!v) return;
      if (!tags.includes(v)) {
        tags = tags.concat([v]);
        p.onChange && p.onChange(tags);
      }
      mark();
    };
    const remove = (i) => { tags = tags.filter((_, idx) => idx !== i); p.onChange && p.onChange(tags); mark(); };
    const key = (e) => {
      if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(e.target.value); e.target.value = ""; }
      else if (e.key === "Backspace" && !e.target.value && tags.length) { remove(tags.length - 1); }
    };

    return A.Div({
      class: join("mk-tag-input flex flex-wrap items-center gap-2", p.class),
      style: { borderRadius: TOK.radiusLg, border: `1px solid ${TOK.border}`, padding: "8px", background: TOK.bgSurface }
    }, {
      default: [
        ...tags.map((txt, i) =>
          A.Span({
            style: { display: "inline-flex", alignItems: "center", gap: "6px", borderRadius: TOK.radiusFull, background: TOK.bgUI, color: TOK.text, padding: "2px 8px", fontSize: ".75rem" }
          }, { default: [txt, A.Button({ style: { color: TOK.subtle, background: "transparent", border: "none" }, onClick: () => remove(i) }, { default: ["×"] })] })
        ),
        A.Input({ class: "min-w-[8rem] flex-1 outline-none", placeholder: p.placeholder || t("ui.addTag", { fallback: "Add tag" }, app), onKeydown: key, style: { background: "transparent", color: TOK.text, border: "none" } })
      ]
    });
  });

  Comp.define("Switch", (A, s, app, p = {}, sl = {}) => {
    const checked = !!p.checked;
    const label = p.label ? A.Span({ class: join("text-sm", p.labelClass), style: { color: TOK.text } }, { default: [p.label] }) : null;
    const toggle = () => { if (isFunction(p.onToggle)) return p.onToggle(!checked); if (isFunction(p.onChange)) return p.onChange(!checked); };

    return A.Label({ class: join("mk-switch inline-flex items-center gap-3 cursor-pointer", p.class), style: { color: TOK.text } }, {
      default: [
        A.Span({ role: "switch", "aria-checked": checked, style: {
          display: "inline-flex",
          width: "44px",
          height: "24px",
          borderRadius: TOK.radiusFull,
          background: checked ? TOK.primary : TOK.bgUI,
          position: "relative",
          transition: TOK.transition
        }, onClick: (e) => { e.preventDefault(); toggle(); } }, {
          default: [
            A.Span({ style: {
              position: "absolute",
              top: "50%",
              transform: `translate(${checked ? "20px" : "4px"}, -50%)`,
              width: "16px",
              height: "16px",
              borderRadius: TOK.radiusFull,
              background: "#fff",
              transition: TOK.transition
            } })
          ]
        }),
        label
      ]
    });
  });

  Comp.define("Checkbox", (A, s, app, p = {}, sl = {}) => {
    const checked = !!p.checked;
    const id = p.id || `chk-${Math.random().toString(36).slice(2,8)}`;
    return A.Label({ class: join("mk-checkbox inline-flex items-center gap-2 cursor-pointer", p.class), for: id, style: { color: TOK.text } }, {
      default: [
        A.Input({
          id, type: "checkbox", checked,
          style: { width: "16px", height: "16px", borderRadius: TOK.radiusSm, border: `1px solid ${TOK.border}`, background: checked ? TOK.primary : TOK.bgSurface, color: "#fff" },
          ...p,
          onChange: (e) => { if (isFunction(p.onInput)) p.onInput(e); if (isFunction(p.onChange)) p.onChange(e.target.checked); }
        }),
        p.label ? A.Span({ class: join("text-sm", p.labelClass), style: { color: TOK.text } }, { default: [p.label] }) : null,
        sl.default || null
      ]
    });
  });

  Comp.define("Radio", (A, s, app, p = {}, sl = {}) => {
    const checked = !!p.checked;
    const id = p.id || `rad-${Math.random().toString(36).slice(2,8)}`;
    return A.Label({ class: join("mk-radio inline-flex items-center gap-2 cursor-pointer", p.class), for: id, style: { color: TOK.text } }, {
      default: [
        A.Input({
          id, type: "radio", checked, name: p.name,
          style: { width: "16px", height: "16px", borderRadius: TOK.radiusFull, border: `1px solid ${TOK.border}`, background: TOK.bgSurface, accentColor: TOK.primary },
          ...p,
          onChange: (e) => { if (isFunction(p.onInput)) p.onInput(e); if (isFunction(p.onChange)) p.onChange(e.target.value ?? true); }
        }),
        p.label ? A.Span({ class: join("text-sm", p.labelClass), style: { color: TOK.text } }, { default: [p.label] }) : null,
        sl.default || null
      ]
    });
  });

  // Currency & Phone utils are registered later but used here
  Comp.define("MoneyInput", (A, s, app, p = {}, sl = {}) => {
    const currencyUtil = Comp.util.get && Comp.util.get("Currency");
    const locale = p.locale || (app?.env?.get?.().locale) || "en";
    const currency = p.currency || p.currencyCode || "USD";
    const digits = Number.isFinite(p.minimumFractionDigits) ? p.minimumFractionDigits : 2;
    const symbol = p.currencySymbol || (currencyUtil && currencyUtil.symbol ? currencyUtil.symbol(currency, locale) : currency);
    const rawValue = p.value == null ? "" : String(p.value);

    const handleInput = (e) => {
      if (isFunction(p.onInput)) return p.onInput(e);
      const val = currencyUtil ? currencyUtil.parse(e.target.value, { locale }) : parseFloat(e.target.value);
      if (isFunction(p.onChange)) p.onChange(Number.isFinite(val) ? val : 0);
    };
    const handleBlur = (e) => {
      if (p.formatOnBlur === false || !currencyUtil) return;
      const parsed = currencyUtil.parse(e.target.value, { locale });
      const formatted = currencyUtil.format(parsed, { currency, locale, minimumFractionDigits: digits, maximumFractionDigits: p.maximumFractionDigits ?? digits });
      e.target.value = formatted;
      if (isFunction(p.onChange)) p.onChange(parsed);
    };

    return A.Div({ class: join("mk-money-input relative", p.class), style: { color: TOK.text } }, {
      default: [
        A.Span({ class: "pointer-events-none", style: { position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", fontSize: ".875rem", color: TOK.subtle } }, { default: [symbol] }),
        A.Input({
          type: "text", inputmode: "decimal", value: rawValue,
          style: {
            width: "100%",
            borderRadius: TOK.radiusLg,
            border: `1px solid ${TOK.border}`,
            background: TOK.bgSurface,
            color: TOK.text,
            padding: "8px 12px 8px 36px",
            outline: "none",
            transition: TOK.transition
          },
          onInput: handleInput, onBlur: handleBlur, ...(p.attrs || {})
        })
      ]
    });
  });

  Comp.define("PhoneInput", (A, s, app, p = {}, sl = {}) => {
    const phoneUtil = Comp.util.get && Comp.util.get("Phone");
    const country = p.country || "EG";

    const handleInput = (e) => {
      if (isFunction(p.onInput)) p.onInput(e);
      if (isFunction(p.onChange)) {
        const normalized = phoneUtil && phoneUtil.normalize ? phoneUtil.normalize(e.target.value) : String(e.target.value || "");
        p.onChange(normalized);
      }
    };
    const handleBlur = (e) => { if (phoneUtil && phoneUtil.format) { e.target.value = phoneUtil.format(e.target.value, { country }); } };

    const inputStyle = {
      width: "100%",
      borderRadius: TOK.radiusLg,
      border: `1px solid ${TOK.border}`,
      background: TOK.bgSurface,
      color: TOK.text,
      padding: p.prefix ? "8px 12px 8px 36px" : "8px 12px",
      outline: "none"
    };

    return A.Div({ class: join("mk-phone-input relative", p.class) }, {
      default: [
        p.prefix ? A.Span({ style: { position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: TOK.subtle, fontSize: ".875rem" } }, { default: [p.prefix] }) : null,
        A.Input({ type: "tel", inputmode: "tel", value: p.value || "", style: inputStyle, onInput: handleInput, onBlur: handleBlur, ...(p.attrs || {}) })
      ]
    });
  });

  Comp.define("TimeInput", (A, s, app, p = {}, sl = {}) =>
    A.Input({
      type: "time", value: p.value || "", step: p.step || 60,
      style: {
        width: "100%",
        borderRadius: TOK.radiusLg,
        border: `1px solid ${TOK.border}`,
        background: TOK.bgSurface,
        color: TOK.text,
        padding: "8px 12px",
        outline: "none"
      },
      onInput: (e) => { if (isFunction(p.onInput)) p.onInput(e); if (isFunction(p.onChange)) p.onChange(e.target.value); },
      ...(p.attrs || {})
    })
  );

  // ---------------------------------------------------------
  // Composite UI & Layouts
  // ---------------------------------------------------------

  Comp.define("InlineAlert", (A, s, app, p = {}, sl = {}) => {
    const tone = p.intent || "info";
    const palette = (tone) => {
      switch (tone) {
        case "success": return { bg: TOK.successSoft, bd: TOK.success, fg: TOK.text };
        case "warning": return { bg: 'rgba(250,204,21,0.12)', bd: 'hsl(45 93% 50%)', fg: TOK.text };
        case "danger":  return { bg: TOK.dangerSoft,  bd: TOK.danger,  fg: TOK.text };
        case "neutral": return { bg: TOK.bgUI,        bd: TOK.border,  fg: TOK.text };
        default:        return { bg: TOK.primarySoft,  bd: TOK.primary, fg: TOK.text };
      }
    };
    const sss = palette(tone);
    return A.Div({
      style: { background: sss.bg, border: `1px solid ${sss.bd}`, color: sss.fg, borderRadius: TOK.radiusLg, padding: "10px 14px", display: "flex", gap: "10px", alignItems: "start" }
    }, { default: [ p.icon ? A.Span({ style: { fontSize: "16px" } }, { default: [p.icon] }) : null, A.Div({}, { default: toArray(sl.default || [p.text || ""]) }) ] });
  });

  Comp.define("Pagination", (A, s, app, p = {}, sl = {}) => {
    const page = +p.page || 1, pages = Math.max(1, +p.pages || 1);
    const canPrev = page > 1, canNext = page < pages;
    const go = (i) => isFunction(p.onPage) && p.onPage(i);

    const btn = (label, disabled, on) =>
      call("Button", {
        disabled,
        intent: "neutral",
        variant: disabled ? "ghost" : "outline",
        text: label,
        style: { padding: "4px 8px" },
        onClick: on
      });

    return A.Div({ class: join("mk-pagination", p.class), style: { display: "flex", alignItems: "center", gap: "6px", ...(p.style || {}) } }, {
      default: [
        btn("«", !canPrev, () => go(1)),
        btn("‹", !canPrev, () => go(page - 1)),
        ...range(Math.min(p.window || 5, pages), Math.max(1, page - Math.floor((p.window || 5) / 2))).map(i =>
          call("Button", {
            intent: i === page ? "primary" : "neutral",
            variant: i === page ? "solid" : "ghost",
            text: String(i),
            style: { padding: "4px 8px" },
            onClick: () => go(i)
          })
        ),
        btn("›", !canNext, () => go(page + 1)),
        btn("»", !canNext, () => go(pages))
      ]
    });
  });

  Comp.define("VirtualList", (A, s, app, p = {}, sl = {}) => {
    const items = toArray(p.items || []);
    const itemH = +p.itemHeight || 56;
    const height = +p.height || 360;
    let scrollTop = 0;

    const mark = () => app && app.helpers && app.helpers.mark && app.helpers.mark(p.uKey || "VirtualList");
    const onScroll = (e) => { scrollTop = e.target.scrollTop; mark(); };

    const totalH = items.length * itemH;
    const start = Math.max(0, Math.floor(scrollTop / itemH) - (+p.overscan || 3));
    const end = Math.min(items.length, start + Math.ceil(height / itemH) + (+p.overscan || 6));
    const visible = items.slice(start, end);

    return A.Div({ style: { position: "relative", height: height + "px", overflowY: "auto", willChange: "transform", background: TOK.bgSurface, color: TOK.text }, onScroll }, {
      default: [
        A.Div({ style: { height: totalH + "px", position: "relative" } }, {
          default: visible.map((it, idx) =>
            A.Div({ style: { position: "absolute", top: ((start + idx) * itemH) + "px", left: 0, right: 0, height: itemH + "px" } },
              { default: [ isFunction(p.render) ? p.render(it, start + idx) : (sl.default ? sl.default : String(it)) ] })
          )
        })
      ]
    });
  });

  Comp.define("DescriptionList", (A, s, app, p = {}, sl = {}) =>
    A.Dl({ class: join("mk-description-list space-y-2", p.class) }, {
      default: (p.items || []).map(item =>
        A.Div({ style: { display: "flex", justifyContent: "space-between", alignItems: "center", color: TOK.text } }, {
          default: [
            A.Dt({ style: { color: TOK.subtle } }, { default: [item.term] }),
            A.Dd({ style: { fontWeight: 600 } }, { default: [item.details] })
          ]
        })
      )
    })
  );

  Comp.define("Toolbar", (A, s, app, p = {}, sl = {}) =>
    A.Div({ class: join('mk-toolbar', p.class), style: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', padding: '8px 10px', background: p.bg || 'transparent', color: TOK.text, ...(p.style || {}) } }, { default: toArray(sl.default) })
  );

  Comp.define("Segmented", (A, s, app, p = {}) => {
    const items = toArray(p.items || []);
    const active = p.activeId;
    return A.Div({
      style: {
        display: 'inline-flex',
        padding: '4px',
        background: TOK.bgUI,
        borderRadius: TOK.radiusFull,
        gap: '4px',
        color: TOK.text
      }
    }, {
      default: items.map(it =>
        A.Button({
          type: 'button',
          style: {
            padding: '6px 12px',
            borderRadius: TOK.radiusFull,
            background: active === it.id ? TOK.text : 'transparent',
            color: active === it.id ? '#fff' : TOK.text,
            border: "none"
          },
          onClick: () => isFunction(p.onChange) && p.onChange(it.id)
        }, { default: [it.label] })
      )
    });
  });

  function cardLikeStyles(kind = "card", p = {}) {
    const radius = kind === "panel" ? TOK.radiusLg : `calc(${TOK.radiusLg} + .25rem)`;
    const border = kind === "panel"
      ? `1px solid ${TOK.border}`
      : `1px solid color-mix(in oklab, ${TOK.border} 80%, transparent)`;

    return {
      base: {
        background: TOK.bgSurface,
        borderRadius: radius,
        border,
        boxShadow: TOK.shadowMd,
        display: "flex",
        flexDirection: "column",
        color: TOK.text,
        ...(p.style || {})
      },
      header: {
        padding: "18px 22px",
        borderBottom: `1px solid color-mix(in oklab, ${TOK.border} 85%, transparent)`,
        fontWeight: 600,
        fontSize: kind === "panel" ? "14px" : "15px",
        color: TOK.text,
        ...(p.headerStyle || {})
      },
      body: {
        padding: "22px",
        flex: "1 1 auto",
        ...(p.bodyStyle || {})
      },
      footer: {
        padding: "18px 22px",
        borderTop: `1px solid color-mix(in oklab, ${TOK.border} 85%, transparent)`,
        display: "flex",
        justifyContent: p.footerAlign || "flex-end",
        gap: "12px",
        ...(p.footerStyle || {})
      }
    };
  }

  Comp.define("Panel", (A, s, app, p = {}, sl = {}) => {
    const slots = asSlots(sl);
    const S = cardLikeStyles("panel", p);
    const segments = [];
    if (slots.header) segments.push(A.Div({ style: S.header }, { default: toArray(slots.header) }));
    segments.push(A.Div({ style: S.body }, { default: toArray(slots.body || slots.default) }));
    if (slots.footer) segments.push(A.Div({ style: S.footer }, { default: toArray(slots.footer) }));
    return A.Div({ class: join("mishkah-panel", p.class), style: S.base }, { default: segments });
  });

  Comp.define("Card", (A, s, app, p = {}, sl = {}) => {
    const slots = asSlots(sl);
    const S = cardLikeStyles("card", p);
    const segments = [];
    if (slots.header) segments.push(A.Div({ style: S.header }, { default: toArray(slots.header) }));
    segments.push(A.Div({ style: S.body }, { default: toArray(slots.body || slots.default) }));
    if (slots.footer) segments.push(A.Div({ style: S.footer }, { default: toArray(slots.footer) }));
    return A.Div({ class: join("mishkah-card", p.class), style: S.base }, { default: segments });
  });

  Comp.define("FormRow", (A, s, app, p = {}, sl = {}) => {
    const slots = asSlots(sl);
    const description = slots.description || p.description;
    const error = slots.error || p.error;
    const aside = slots.aside || null;

    return A.Div({ class: join("mishkah-form-row", p.class), style: { display: "flex", flexDirection: "column", gap: "6px", color: TOK.text, ...(p.style || {}) } }, {
      default: [
        p.label ? A.Label({ for: p.for, class: join("text-sm font-medium", p.labelClass), style: { color: TOK.text, ...(p.labelStyle || {}) } }, { default: [p.label] }) : null,
        A.Div({ style: { display: "flex", alignItems: p.align || "stretch", gap: "12px", ...(p.rowStyle || {}) } }, {
          default: [
            A.Div({ style: { flex: "1 1 auto", display: "flex", flexDirection: "column", gap: "6px", ...(p.controlStyle || {}) } }, { default: toArray(slots.control || slots.default) }),
            aside ? A.Div({ style: { minWidth: "120px", ...(p.asideStyle || {}) } }, { default: toArray(aside) }) : null
          ]
        }),
        description ? A.Span({ class: join("text-xs", p.descriptionClass), style: { color: TOK.subtle, ...(p.descriptionStyle || {}) } }, { default: toArray(description) }) : null,
        error ? A.Span({ class: join("text-xs", p.errorClass), style: { color: TOK.danger, fontWeight: 600, ...(p.errorStyle || {}) } }, { default: toArray(error) }) : null
      ]
    });
  });

  Comp.define("ScrollArea", (A, s, app, p = {}, sl = {}) =>
    A.Div({ class: join("mishkah-scroll-area", p.class), style: { position: "relative", ...(p.style || {}) } }, {
      default: [
        A.Div({
          class: join("mishkah-scroll-area__viewport", p.viewportClass),
          style: {
            overflowY: "auto",
            maxHeight: p.maxHeight || "100%",
            paddingRight: p.paddingRight || "8px",
            ...(p.viewportStyle || {})
          },
          onScroll: p.onScroll
        }, { default: toArray(sl.default || sl.content) })
      ]
    })
  );

  Comp.define("Sidebar", (A, s, app, p = {}, sl = {}) => {
    const isRtl = app?.env?.isRTL();
    const side = p.side === 'end' ? 'end' : 'start';
    const borderStyle = { borderLeft: `1px solid ${TOK.border}`, borderRight: `1px solid ${TOK.border}` };
    const style = { width: p.width || '260px', minWidth: p.width || '260px', background: TOK.bgSurface, color: TOK.text };
    return A.Aside({ style: { ...style, ...(side === 'start' ? (isRtl ? borderStyle : borderStyle) : (isRtl ? borderStyle : borderStyle)) }, ...asTw("h-full overflow-y-auto") }, { default: asSlots(sl).default });
  });

  Comp.define("Grid", (A, s, app, p = {}, sl = {}) => {
    let colsClasses = 'grid-cols-1';
    if (typeof p.cols === 'number') {
      colsClasses = `grid-cols-${p.cols}`;
    } else if (isObject(p.cols)) {
      const parts = [];
      if (p.cols.default) parts.push(`grid-cols-${p.cols.default}`);
      ['sm', 'md', 'lg', 'xl', '2xl'].forEach(bp => { if (p.cols[bp]) parts.push(`${bp}:grid-cols-${p.cols[bp]}`); });
      if (parts.length > 0) colsClasses = parts.join(' ');
    }
    return A.Div({ ...asTw(join('grid', `gap-${p.gap ?? 4}`, colsClasses, p.tw)) }, { default: asSlots(sl).default });
  });

  Comp.define("Stack", (A, s, app, p = {}, sl = {}) => {
    const alignClasses = { start: 'items-start', center: 'items-center', end: 'items-end', stretch: 'items-stretch' };
    const justifyClasses = { start: 'justify-start', center: 'justify-center', end: 'justify-end', between: 'justify-between', around: 'justify-around' };
    return A.Div({ ...asTw(join('flex', p.direction === 'horizontal' ? 'flex-row' : 'flex-col', `gap-${p.gap ?? 4}`, alignClasses[p.align] || 'items-start', justifyClasses[p.justify] || 'justify-start', p.tw)) }, { default: asSlots(sl).default });
  });

  // ---------------------------------------------------------
  // Overlays & Modals (Managed z-index, tokens for colors)
  // ---------------------------------------------------------

  const ModalManager = {
    stack: [],
    add(modal) {
      if (this.stack.length > 0) {
        const prev = this.getTop();
        if (prev && prev.panelEl) {
          prev.panelEl.setAttribute('inert', 'true');
          prev.panelEl.style.pointerEvents = 'none';
        }
      }
      this.stack.push(modal);
      return { zIndex: (modal.baseZIndex || 1100) + (this.stack.length - 1) * 10, isTop: this.stack.length === 1 };
    },
    remove(uid) {
      this.stack = this.stack.filter(m => m.uid !== uid);
      const newTop = this.getTop();
      if (newTop && newTop.panelEl) {
        newTop.panelEl.removeAttribute('inert');
        newTop.panelEl.style.pointerEvents = 'auto';
      }
    },
    getTop() { return this.stack.length > 0 ? this.stack[this.stack.length - 1] : null; },
    hasScrollLock() { return this.stack.length > 0; }
  };
  Comp.util.register('ModalManager', ModalManager);

  Comp.define("Modal", (A, s, app, p = {}, sl = {}) => {
    if (!p.open) return null;
    const slots = asSlots(sl);
    const i18n = (k, fb) => (app && app.i18n && app.i18n.t ? app.i18n.t(k) : fb);

    const manager = Comp.util.get('ModalManager');
    const uid = p.id || U.uid('modal');

    const closeOnOutside = p.closeOnOutside !== false;
    const closeOnEsc = p.closeOnEsc !== false;
    const dismissable = p.dismissable !== false;
    const trapFocus = p.trapFocus !== false;
    const returnFocus = p.returnFocus !== false;

    const backdropKind = p.backdrop || "scrim";
    const size = p.size || 'md';
    const MODAL_WIDTHS = { xs: "min(95vw, 320px)", sm: "min(95vw, 420px)", md: "min(95vw, 560px)", lg: "min(95vw, 720px)", xl: "min(95vw, 960px)", full: "100%" };
    const width = MODAL_WIDTHS[size] || MODAL_WIDTHS.md;
    const baseZIndex = p.zIndex || 1100;

    const animation = { type: 'scale', duration: 160, ...(isObject(p.animation) ? p.animation : (isStringLike(p.animation) ? { type: p.animation } : {})) };
    const idBase = uid;
    const titleId = p.labelId || `${idBase}-title`;
    const descId = p.descId || (p.desc ? `${idBase}-desc` : undefined);

    let prevActive, backdropEl, panelEl, releaseTrap, restoreOverflow;

    const close = (reason) => { if (dismissable === false && reason !== "program") return; if (isFunction(p.onClose)) p.onClose(reason); };

    const onKey = (e) => {
      if (e.key === "Escape" && closeOnEsc) {
        const topModal = manager.getTop();
        if (topModal && topModal.uid === uid) { e.preventDefault(); close("esc"); }
      }
    };

    const getAnimationStyles = (type) => {
      switch (type) {
        case 'slide-in-up': return { initial: { opacity: '0', transform: 'translateY(24px)' }, final: { opacity: '1', transform: 'translateY(0)' }, exit: { opacity: '0', transform: 'translateY(18px)' } };
        case 'slide-in-down': return { initial: { opacity: '0', transform: 'translateY(-24px)' }, final: { opacity: '1', transform: 'translateY(0)' }, exit: { opacity: '0', transform: 'translateY(-18px)' } };
        case 'fade': return { initial: { opacity: '0' }, final: { opacity: '1' }, exit: { opacity: '0' } };
        default: return { initial: { opacity: '0', transform: 'scale(0.98)' }, final: { opacity: '1', transform: 'scale(1)' }, exit: { opacity: '0', transform: 'scale(0.985)' } };
      }
    };

    const animateIn = (backdrop, panel) => {
      const styles = getAnimationStyles(animation.type);
      const duration = animation.duration;
      backdrop.style.opacity = "0";
      Object.assign(panel.style, styles.initial);
      backdrop.offsetHeight;
      backdrop.style.transition = `opacity ${duration}ms ease`;
      panel.style.transition = `opacity ${duration}ms ease, transform ${duration}ms ease`;
      requestAnimationFrame(() => { backdrop.style.opacity = "1"; Object.assign(panel.style, styles.final); });
    };

    const animateOut = (backdrop, panel) => new Promise((resolve) => {
      const styles = getAnimationStyles(animation.type);
      const duration = Math.max(1, animation.duration - 20);
      backdrop.style.transition = `opacity ${duration}ms ease`;
      panel.style.transition = `opacity ${duration}ms ease, transform ${duration}ms ease`;
      backdrop.style.opacity = "0";
      Object.assign(panel.style, styles.exit);
      setTimeout(resolve, duration);
    });

    const isFullScreen = size === 'full';

    const panelBaseStyle = {
      width: "100%",
      maxWidth: width,
      maxHeight: isFullScreen ? "100%" : "90vh",
      background: TOK.bgSurface,
      borderRadius: isFullScreen ? "0" : TOK.radiusLg,
      boxShadow: TOK.shadowMd,
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      outline: "none",
      color: TOK.text
    };

    return A.Div({
      role: "presentation",
      class: join("mishkah-modal-backdrop", backdropKind === "glass" ? "glass" : null, p.backdropClass),
      style: {
        position: "fixed",
        inset: "0",
        padding: isFullScreen ? "0" : "24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: backdropKind === "glass" ? "rgba(15,23,42,0.35)" : "rgba(15,23,42,0.55)"
      },
      onClick: (e) => { if (closeOnOutside && e.target === e.currentTarget) close("outside"); },
      onMounted: (el) => {
        backdropEl = el;
        panelEl = el.querySelector("[data-modal-panel]");
        prevActive = document.activeElement;
        const modalData = { uid, backdropEl, panelEl, baseZIndex, returnFocusTo: prevActive };
        const { zIndex, isTop } = manager.add(modalData);
        el.style.zIndex = zIndex;

        if (isTop) {
          const prevOverflow = document.body.style.overflow;
          document.body.style.overflow = "hidden";
          restoreOverflow = () => (document.body.style.overflow = prevOverflow);
          if (closeOnEsc) document.addEventListener("keydown", onKey);
        }

        if (trapFocus) {
          const FT = Comp.util.get("FocusTrap");
          if (FT && FT.trap) releaseTrap = FT.trap(panelEl, { restoreFocus: false });
        }

        animateIn(backdropEl, panelEl);
        if (isFunction(p.onOpen)) p.onOpen({ el, panel: panelEl });
      },
      onUnmounted: () => {
        manager.remove(uid);
        if (releaseTrap) try { releaseTrap(); } catch (_) {}
        if (!manager.hasScrollLock()) {
          if (restoreOverflow) try { restoreOverflow(); } catch (_) {}
          if (closeOnEsc) document.removeEventListener("keydown", onKey);
        }
        const modalToFocus = manager.getTop();
        if (returnFocus) {
          const target = modalToFocus ? modalToFocus.panelEl : prevActive;
          if (target && isFunction(target.focus)) try { target.focus(); } catch (_) {}
        }
        if (isFunction(p.onAfterClose)) p.onAfterClose();
      }
    }, {
      default: [
        A.Div({
          role: "dialog", "aria-modal": "true",
          "aria-labelledby": p.title ? titleId : undefined,
          "aria-describedby": descId,
          class: join("mishkah-modal-panel", p.class),
          style: { ...panelBaseStyle, ...(p.panelStyle || {}) },
          "data-modal-panel": "",
          tabIndex: -1,
          onClick: (e) => e.stopPropagation(),
          onBeforeUnmount: async () => { if (backdropEl && panelEl) await animateOut(backdropEl, panelEl); }
        }, {
          default: [
            (slots.header || p.title) ? A.Div({
              class: join("mishkah-modal-header", p.headerClass),
              style: {
                padding: "22px 26px",
                borderBottom: `1px solid color-mix(in oklab, ${TOK.border} 85%, transparent)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "16px",
                flexShrink: 0,
                ...(p.headerStyle || {})
              }
            }, {
              default: slots.header ? toArray(slots.header) : [
                p.title ? A.H3({ id: titleId, style: { margin: 0, fontSize: "1.125rem", fontWeight: 700, color: TOK.text, ...(p.titleStyle || {}) } }, { default: [p.title] }) : null,
                dismissable ? A.Button({
                  type: "button",
                  style: { border: "none", background: "transparent", fontSize: "22px", lineHeight: 1, color: TOK.subtle, cursor: "pointer", padding: "2px 6px", borderRadius: TOK.radiusMd, ...(p.closeStyle || {}) },
                  "aria-label": i18n("ui.close", "Close") || "Close",
                  onClick: () => close("close")
                }, { default: ["×"] }) : null
              ]
            }) : null,

            A.Div({
              class: join("mishkah-modal-body", p.bodyClass),
              style: { padding: "26px", overflowY: "auto", flex: "1 1 auto", ...(p.bodyStyle || {}) }
            }, {
              default: [
                p.desc ? A.P({ id: descId, style: { margin: "0 0 12px 0", opacity: 0.8 } }, { default: [p.desc] }) : null,
                ...toArray(slots.body || slots.default)
              ]
            }),

            slots.footer ? A.Div({
              class: join("mishkah-modal-footer", p.footerClass),
              style: { padding: "20px 26px", borderTop: `1px solid color-mix(in oklab, ${TOK.border} 85%, transparent)`, display: "flex", justifyContent: p.footerAlign || "flex-end", gap: "12px", flexShrink: 0, ...(p.footerStyle || {}) }
            }, { default: toArray(slots.footer) }) : null
          ]
        })
      ]
    });
  });

  // FocusTrap / PortalRoot Utils (unchanged in API, adapted when needed)
  const FocusTrap = {
    trap(root, opts = {}) {
      if (!root) return () => {};
      const prev = document.activeElement;
      const getFocusable = () =>
        (U.getFocusables ? U.getFocusables(root)
          : Array.from(root.querySelectorAll('a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter(el => !el.hasAttribute('aria-hidden')));
      const focusables = getFocusable();

      if (opts.initialFocus) {
        const target = typeof opts.initialFocus === 'string' ? root.querySelector(opts.initialFocus) : opts.initialFocus;
        if (target && target.focus) target.focus();
      } else if (focusables.length && focusables[0].focus) {
        focusables[0].focus();
      }

      const handler = (e) => {
        if (e.key !== 'Tab') return;
        const list = getFocusable();
        if (!list.length) return;
        const first = list[0];
        const last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last && last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first && first.focus(); }
      };

      root.addEventListener('keydown', handler);
      return () => {
        root.removeEventListener('keydown', handler);
        if (opts.restoreFocus !== false && prev && prev.focus) try { prev.focus(); } catch (_) {}
      };
    }
  };
  const PortalRoot = {
    ensure(id = 'mishkah-portal-root') { let el = document.getElementById(id); if (!el) { el = document.createElement('div'); el.id = id; el.dataset.portalRoot = 'true'; document.body.appendChild(el); } return el; },
    clear(id) { const el = document.getElementById(id); if (el) el.innerHTML = ''; },
    mount(id, node) { const root = this.ensure(id); if (node) root.appendChild(node); return () => { if (node && node.parentNode === root) root.removeChild(node); }; }
  };
  Comp.util.register('FocusTrap', FocusTrap);
  Comp.util.register('PortalRoot', PortalRoot);

 Comp.define("Sheet", (A, s, app, p = {}, sl = {}) => {
  if (!p.open) return null;

  const slots = asSlots(sl);
  const isRtl = app?.env?.get?.().dir === "rtl";
  const t = (k, fb) => (app?.i18n?.t ? app.i18n.t(k) : fb);

  const side = p.side || "end";
  const horizontal = side === "start" || side === "end";

  const sizeKey = p.size || "md";
  const SHEET_WIDTHS  = { sm: "min(96vw,360px)", md: "min(96vw,420px)", lg: "min(96vw,520px)", xl: "min(96vw,640px)" };
  const SHEET_HEIGHTS = { sm: "45vh",           md: "60vh",           lg: "75vh",           xl: "90vh" };

  const panelWidth  = p.width  || (horizontal ? SHEET_WIDTHS[sizeKey] : "min(720px,96vw)");
  const panelHeight = p.height || (!horizontal ? SHEET_HEIGHTS[sizeKey] : "100%");

  const closeOnOutside = p.closeOnOutside !== false;
  const closeOnEsc     = p.closeOnEsc !== false;
  const dismissable    = p.dismissable !== false;
  const trapFocus      = p.trapFocus !== false;
  const returnFocus    = p.returnFocus !== false;

  const backdropKind   = p.backdrop || "scrim";
  const zIndex         = p.zIndex || 1080;

  const placementStyle =
    side === "start" ? { justifyContent: isRtl ? "flex-end" : "flex-start", alignItems: "stretch" } :
    side === "end"   ? { justifyContent: isRtl ? "flex-start" : "flex-end", alignItems: "stretch" } :
    side === "top"   ? { justifyContent: "center", alignItems: "flex-start" } :
                       { justifyContent: "center", alignItems: "flex-end" };

  const idBase = p.id || "sheet";
  const titleId = p.labelId || `${idBase}-title`;
  const descId  = p.descId || (p.desc ? `${idBase}-desc` : undefined);

  let releaseTrap, restoreOverflow, prevActive, backdropEl, panelEl;

  const close = (reason) => {
    if (dismissable === false && reason !== "program") return;
    if (isFn(p.onClose)) p.onClose(reason);
  };

  const onKey = (e) => {
    if (e.key === "Escape" && closeOnEsc) {
      e.preventDefault();
      close("esc");
    }
  };

  const backdropIn = (backdrop) => {
    backdrop.style.opacity = "0";
    backdrop.offsetHeight;
    backdrop.style.transition = "opacity 160ms cubic-bezier(.22,.65,.32,1)";
    requestAnimationFrame(() => (backdrop.style.opacity = "1"));
  };

  const panelInitialTransform = () => {
    if (side === "start") return `translateX(${isRtl ? "16px" : "-16px"})`;
    if (side === "end")   return `translateX(${isRtl ? "-16px" : "16px"})`;
    if (side === "top")   return "translateY(-24px)";
    return "translateY(24px)";
  };

  const panelEnter = (panel) => {
    panel.style.opacity   = "0";
    panel.style.transform = panelInitialTransform();
    panel.offsetHeight;
    panel.style.transition = "opacity 180ms cubic-bezier(.22,.65,.32,1), transform 200ms cubic-bezier(.22,.65,.32,1)";
    requestAnimationFrame(() => {
      panel.style.opacity = "1";
      panel.style.transform = "translateX(0) translateY(0)";
    });
  };

  const animateOut = (backdrop, panel) => new Promise((resolve) => {
    backdrop.style.transition = "opacity 140ms ease";
    panel.style.transition    = "opacity 140ms ease, transform 160ms ease";
    backdrop.style.opacity    = "0";
    if (side === "start") panel.style.transform = `translateX(${isRtl ? "12px" : "-12px"})`;
    else if (side === "end") panel.style.transform = `translateX(${isRtl ? "-12px" : "12px"})`;
    else if (side === "top") panel.style.transform = "translateY(-18px)";
    else panel.style.transform = "translateY(18px)";
    panel.style.opacity = "0";
    setTimeout(resolve, 170);
  });

  const borderRadius =
    side === "start" ? (isRtl ? "24px 0 0 24px" : "0 24px 24px 0") :
    side === "end"   ? (isRtl ? "0 24px 24px 0" : "24px 0 0 24px") :
    side === "top"   ? "24px 24px 16px 16px" :
                       "16px 16px 24px 24px";

  return A.Div({
    role: "presentation",
    class: C("mishkah-sheet-backdrop", backdropKind === "glass" ? "glass" : null, p.backdropClass),
    style: {
      position: "fixed",
      inset: "0",
      display: "flex",
      padding: "24px",
      paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))",
      // نستخدم متغير اختياري للسكرم مع قيمة احتياطية
      background: backdropKind === "glass"
        ? "var(--overlay-glass, color-mix(in hsl, var(--text-default) 35%, transparent))"
        : "var(--overlay-scrim, color-mix(in hsl, var(--text-default) 45%, transparent))",
      zIndex,
      ...placementStyle,
      ...(p.backdropStyle || {})
    },
    onClick: (e) => {
      if (closeOnOutside && e.target === e.currentTarget) close("outside");
    },
    onMounted: (el) => {
      backdropEl = el;
      prevActive = document.activeElement;
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      restoreOverflow = () => (document.body.style.overflow = prevOverflow);
      if (closeOnEsc) document.addEventListener("keydown", onKey);

      const trap = Comp.util.get && Comp.util.get("FocusTrap");
      panelEl = el.querySelector("[data-sheet-panel]");
      if (trapFocus && panelEl && trap && trap.trap) releaseTrap = trap.trap(panelEl, { restoreFocus: returnFocus !== false });

      backdropIn(el);
      panelEnter(panelEl);
      if (isFn(p.onOpen)) p.onOpen({ el, panel: panelEl });
    },
    onUnmounted: () => {
      if (closeOnEsc) document.removeEventListener("keydown", onKey);
      if (releaseTrap) try { releaseTrap(); } catch (_) {}
      if (restoreOverflow) try { restoreOverflow(); } catch (_) {}
      if (returnFocus && prevActive && prevActive.focus) try { prevActive.focus(); } catch (_) {}
      if (isFn(p.onAfterClose)) p.onAfterClose();
    }
  }, {
    default: [
      A.Div({
        role: "dialog",
        "aria-modal": "true",
        "aria-labelledby": p.title ? titleId : undefined,
        "aria-describedby": descId,
        class: C("mishkah-sheet-panel", p.class),
        style: {
          width:  horizontal ? panelWidth : "min(96vw, 980px)",
          height: horizontal ? "100%" : panelHeight,
          maxWidth:  "96vw",
          maxHeight: "96vh",
          background: "var(--bg-surface)",
          borderRadius,
          // ظل موحد عبر المتغير
          boxShadow: "var(--shadow-md)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          outline: "none",
          transform: "translate3d(0,0,0)",
          ...(p.panelStyle || {})
        },
        "data-sheet-panel": "",
        tabIndex: 0,
        onClick: (e) => e.stopPropagation(),
        onBeforeUnmount: async () => {
          if (backdropEl && panelEl) await animateOut(backdropEl, panelEl);
        }
      }, {
        default: [
          (slots.header || p.title || p.showClose) && A.Div({
            class: C("mishkah-sheet-header", p.headerClass),
            style: {
              padding: "20px 24px",
              borderBottom: "1px solid var(--border-default)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              ...(p.headerStyle || {})
            }
          }, {
            default: slots.header ? toArr(slots.header) : [
              p.title ? A.H3({
                id: titleId,
                style: {
                  margin: 0,
                  fontSize: "1.125rem",
                  fontWeight: 700,
                  color: "var(--text-default)",
                  ...(p.titleStyle || {})
                }
              }, { default: [p.title] }) : null,
              p.showClose !== false && dismissable ? A.Button({
                type: "button",
                style: {
                  border: "none",
                  background: "transparent",
                  fontSize: "22px",
                  lineHeight: 1,
                  color: "var(--text-subtle)",
                  cursor: "pointer",
                  padding: "2px 6px",
                  borderRadius: "12px",
                  ...(p.closeStyle || {})
                },
                "aria-label": t("ui.close", "Close") || "Close",
                onClick: () => close("close")
              }, { default: ["×"] }) : null
            ]
          }),

          A.Div({
            class: C("mishkah-sheet-body", p.bodyClass),
            style: {
              padding: "22px",
              overflowY: "auto",
              flex: "1 1 auto",
              ...(p.bodyStyle || {})
            }
          }, {
            default: [
              p.desc ? A.P({ id: descId, style: { margin: "0 0 12px 0", color: "var(--text-subtle)" } }, { default: [p.desc] }) : null,
              ...toArr(slots.body || slots.default)
            ]
          }),

          slots.footer ? A.Div({
            class: C("mishkah-sheet-footer", p.footerClass),
            style: {
              padding: "20px 24px",
              borderTop: "1px solid var(--border-default)",
              display: "flex",
              justifyContent: p.footerAlign || "flex-end",
              gap: "12px",
              ...(p.footerStyle || {})
            }
          }, { default: toArr(slots.footer) }) : null
        ]
      })
    ]
  });
});

Comp.define("ConfirmDialog", (A, s, app, p = {}, sl = {}) => {
  const body = sl.body || sl.default || [p.message];
  const confirmLabel = p.confirmLabel || t("ui.confirm", { fallback: "Confirm" }, app);
  const cancelLabel  = p.cancelLabel  || t("ui.cancel",  { fallback: "Cancel"  }, app);

  // يعتمد على Modal (الذي يستعمل متغيرات CSS بالفعل)
  return Comp.call("Modal", {
    open: p.open,
    title: p.title || t("ui.confirm", { fallback: "Confirm" }, app),
    size: p.size || "sm",
    closeOnOutside: p.closeOnOutside,
    closeOnEsc: p.closeOnEsc,
    onClose: p.onClose,
    dismissable: p.dismissable,
    bodyClass: C("space-y-3", p.bodyClass)
  }, {
    body,
    footer: [
      Comp.call("Button", { text: cancelLabel, variant: "ghost", ...(p.cancelProps || {}), ...(p.cancelCommand ? { 'data-onclick': p.cancelCommand } : {}), ...(p.onCancel ? { onClick: () => p.onCancel() } : {}) }),
      Comp.call("Button", { text: confirmLabel, ...(p.confirmProps || {}), ...(p.confirmIntent ? { intent: p.confirmIntent } : {}), ...(p.confirmCommand ? { 'data-onclick': p.confirmCommand } : {}), ...(p.onConfirm ? { onClick: () => p.onConfirm() } : {}) })
    ]
  });
});

Comp.define("Toast", (A, s, app, p = {}, sl = {}) => {
  const intent = String(p.intent || "neutral");
  const toneMap = {
    neutral: "var(--text-default)",
    info:    "var(--primary)",
    success: "var(--success)",
    warning: "var(--ring-color)",     // لا يوجد متغير warning مستقل حالياً
    danger:  "var(--danger)"
  };
  const toneBg  = toneMap[intent] || toneMap.neutral;
  const toneFg  = "var(--text-on-primary, #fff)";

  const content = sl.default || (p.message ? [p.message] : []);
  const closeProps = {};
  if (p.dismissCommand) closeProps['data-onclick'] = p.dismissCommand;
  if (p.dismissCommand && p.id != null) closeProps['data-toast-id'] = p.id;
  if (isFn(p.onClose)) closeProps.onClick = (e) => { e.preventDefault(); p.onClose(); };

  return A.Div({
    class: C("mishkah-toast", p.class),
    style: {
      background: toneBg,
      color: toneFg,
      borderRadius: "18px",
      padding: "16px 20px",
      minWidth: "220px",
      maxWidth: "360px",
      boxShadow: "var(--shadow-md)",
      display: "flex",
      alignItems: "flex-start",
      gap: "12px",
      pointerEvents: "auto",
      ...(p.style || {})
    }
  }, {
    default: [
      p.icon ? A.Span({ style: { fontSize: "18px", lineHeight: 1 } }, { default: [p.icon] }) : null,
      A.Div({ style: { flex: "1 1 auto", display: "flex", flexDirection: "column", gap: "4px" } }, {
        default: [
          p.title ? A.Div({ style: { fontWeight: 600, fontSize: "14px" } }, { default: [p.title] }) : null,
          content.length ? A.Div({ style: { fontSize: "13px", lineHeight: 1.45 } }, { default: toArr(content) }) : null
        ]
      }),
      (p.dismissCommand || isFn(p.onClose)) ? A.Button({
        type: "button",
        style: { border: "none", background: "transparent", color: "inherit", fontSize: "16px", cursor: "pointer" },
        'aria-label': t("ui.close", { fallback: "Close" }, app),
        ...closeProps
      }, { default: ["×"] }) : null
    ]
  });
});

Comp.define("ToastStack", (A, s, app, p = {}, sl = {}) => {
  const items = toArr(p.items || []);
  const position = p.position || "top-end";
  const style = {
    position: "fixed",
    zIndex: p.zIndex || 1300,
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    pointerEvents: "none",
    ...( position === "top-start"    ? { top: "24px", left: "24px", alignItems: "flex-start" } :
        position === "bottom-start" ? { bottom: "24px", left: "24px", alignItems: "flex-start" } :
        position === "bottom-end"   ? { bottom: "24px", right: "24px", alignItems: "flex-end" } :
                                      { top: "24px", right: "24px", alignItems: "flex-end" }),
    ...(p.style || {})
  };

  return A.Div({ class: C("mishkah-toast-stack", p.class), style }, {
    default: items.map((toast, idx) => {
      const props = { ...toast, key: toast.id || idx, style: { pointerEvents: "auto", ...(toast.style || {}) } };
      const slots = toast.slots || (toast.description ? { default: [toast.description] } : {});
      return Comp.call("Toast", props, slots);
    })
  });
});

Comp.define("Portal", (A, s, app, p = {}, sl = {}) => {
  const target = p.target || "mishkah-portal-root";
  const mountClass = p.mountClass || p.class || "";
  const slots = asSlots(sl);
  return A.Div({
    style: { display: "contents" },
    onMounted: (placeholder) => {
      const util = Comp.util.get && Comp.util.get("PortalRoot");
      const root = util && util.ensure ? util.ensure(target) : (() => {
        let el = document.getElementById(target);
        if (!el) { el = document.createElement('div'); el.id = target; document.body.appendChild(el); }
        return el;
      })();

      const mount = document.createElement('div');
      if (mountClass) mount.className = mountClass;
      placeholder.__portal_mount = mount;
      root.appendChild(mount);

      const render = () => {
        const frag = document.createDocumentFragment();
        const nodes = toArr(slots.default);
        for (const child of nodes) {
          if (child && typeof child === 'object' && child.__A && window.Mishkah?.Atoms?.toNode)
            frag.appendChild(window.Mishkah.Atoms.toNode(child));
          else
            frag.appendChild(document.createTextNode(child == null ? '' : String(child)));
        }
        mount.replaceChildren(frag);
      };
      render();
    },
    onUnmounted: (placeholder) => {
      const mount = placeholder.__portal_mount;
      if (mount && mount.parentNode) mount.parentNode.removeChild(mount);
    }
  }, { default: [] });
});

Comp.define("Popover", (A, s, app, p = {}, sl = {}) => {
  if (!p.open) return null;
  const slots = asSlots(sl);
  const portalTarget = p.portalTarget || "mishkah-popovers";
  const placement = p.placement || "bottom";
  const align = p.align || "start";
  const closeOnOutside = p.closeOnOutside !== false;
  const close = (reason) => { if (isFn(p.onClose)) p.onClose(reason); };
  const content = slots.default || [];

  return Comp.call("Portal", { target: portalTarget, mountClass: C("mishkah-popover-host", p.hostClass) }, {
    default: [
      A.Div({
        class: C("mishkah-popover", p.class),
        style: {
          position: "fixed",
          minWidth: p.minWidth || "220px",
          background: "var(--bg-surface)",
          borderRadius: "16px",
          border: "1px solid var(--border-default)",
          boxShadow: "var(--shadow-md)",
          padding: "16px",
          zIndex: p.zIndex || 1200,
          ...(p.style || {})
        },
        onMounted: (el) => {
          const anchor = typeof p.anchor === 'string'
            ? document.querySelector(p.anchor)
            : (p.anchor || (p.anchorId ? document.getElementById(p.anchorId) : null));
          if (anchor && U.computePlacement) {
            const pos = U.computePlacement(anchor, el, { placement, align, offset: p.offset });
            if (pos && pos.style) Object.assign(el.style, pos.style);
          }
          if (closeOnOutside) el.__mishkah_offClick = U.onOutsideClick ? U.onOutsideClick(el, () => close("outside")) : null;
        },
        onUnmounted: (el) => { if (el.__mishkah_offClick) el.__mishkah_offClick(); }
      }, { default: toArr(content) })
    ]
  });
});
// ==== PopoverRect (CSS Vars) ====
Comp.define("PopoverRect", (A, s, app, p = {}, sl = {}) => {
  if (!p.open) return null;
  const slots = asSlots(sl);
  const rect = p.anchorRect || { x: 0, y: 0, w: 0, h: 0 };
  const place = p.placement || "bottom-start";

  const x = place.includes("start")
    ? rect.x
    : place.includes("end")
      ? rect.x + rect.w
      : rect.x + rect.w / 2;

  const y = place.startsWith("top")
    ? rect.y
    : place.startsWith("bottom")
      ? rect.y + rect.h
      : rect.y + rect.h / 2;

  const offset = p.offset || 8;
  const positionStyle = {
    position: "fixed",
    left:
      (place.includes("end") ? x + offset : place.includes("start") ? x - offset : x) +
      "px",
    top:
      (place.startsWith("bottom") ? y + offset : place.startsWith("top") ? y - offset : y) +
      "px",
    zIndex: p.zIndex || 1200
  };

  const closeOnOutside = p.closeOnOutside !== false;

  return A.Div(
    {
      role: "presentation",
      style: { position: "fixed", inset: "0" },
      onClick: (e) => {
        if (closeOnOutside && e.target === e.currentTarget && isFn(p.onClose))
          p.onClose("outside");
      }
    },
    {
      default: [
        A.Div(
          {
            role: "dialog",
            class: C("mk-popover", p.class),
            style: {
              position: "fixed",
              background: "var(--bg-surface)",
              color: "var(--text-default)",
              border: "1px solid var(--border-default)",
              borderRadius: "12px",
              boxShadow: "var(--shadow-md)",
              minWidth: p.minWidth || "200px",
              maxWidth: "min(90vw,420px)",
              padding: p.padding || "8px",
              ...positionStyle,
              ...(p.style || {})
            }
          },
          { default: toArr(slots.default) }
        )
      ]
    }
  );
});

// ==== Tooltip (CSS Vars) ====
Comp.define("Tooltip", (A, s, app, p = {}) => {
  if (!p.open) return null;

  const rect = p.anchorRect || { x: 0, y: 0, w: 0, h: 0 };
  const place = p.placement || "top";
  const offset = p.offset || 10;

  const cx = rect.x + rect.w / 2;
  const cy = rect.y + (place === "top" ? 0 : rect.h);
  const left = cx;
  const top = cy + (place === "top" ? -offset : offset);

  return A.Div(
    {
      style: { position: "fixed", inset: "0", zIndex: p.zIndex || 1250 },
      onClick: () => isFn(p.onClose) && p.onClose("outside")
    },
    {
      default: [
        A.Div(
          {
            style: {
              position: "fixed",
              transform: "translate(-50%,-100%)",
              left: left + "px",
              top: top + "px",
              background: "var(--text-default)",
              color: "var(--bg-surface)",
              padding: "6px 10px",
              borderRadius: "8px",
              fontSize: ".75rem",
              whiteSpace: "nowrap",
              pointerEvents: "none",
              boxShadow: "var(--shadow-md)"
            }
          },
          { default: [p.label] }
        )
      ]
    }
  );
});

// ==== AsyncSelect (CSS Vars) ====
Comp.define("AsyncSelect", (A, s, app, p = {}, sl = {}) => {
  let items = isArr(p.options) ? p.options.slice() : [];
  let open = false, q = "", loading = false, error = null;

  const mapOption =
    p.mapOption ||
    ((x) =>
      isObj(x)
        ? { value: x.value ?? x.id, label: x.label ?? x.name ?? String(x) }
        : { value: x, label: String(x) });

  const mark =
    () => app && app.helpers && app.helpers.mark && app.helpers.mark(p.uKey || "AsyncSelect");

  const fetcher =
    U.debounce
      ? U.debounce(async () => {
          if (!p.url) return;
          loading = true; error = null; mark();
          try {
            const query = { ...(p.query || {}), ...(p.queryKey ? { [p.queryKey]: q } : {}) };
            const res = await DataSource.fetch({
              url: p.url,
              method: p.method || "GET",
              query,
              body: p.body,
              map: p.map
            });
            items = isArr(res) ? res : (res.items || res.data || []);
          } catch (e) {
            error = e.message || String(e);
          }
          loading = false; mark();
        }, p.debounce || 250)
      : async () => {};

  const head = A.Div(
    { style: { display: "flex", gap: "8px" } },
    {
      default: [
        A.Input({
          value: q,
          onInput: (e) => {
            q = e.target.value;
            open = true;
            fetcher();
            mark();
          },
          placeholder: p.placeholder || t("ui.search", { fallback: "Search..." }, app),
          style: {
            flex: "1 1 auto",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-lg)",
            padding: "8px 12px",
            background: "var(--bg-surface)",
            color: "var(--text-default)",
            outlineColor: "var(--ring-color)"
          }
        }),
        A.Button(
          {
            style: {
              padding: "0 8px",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-md)",
              background: "var(--bg-surface)",
              color: "var(--text-default)"
            },
            onClick: () => {
              open = !open;
              mark();
            }
          },
          { default: [open ? "▲" : "▼"] }
        )
      ]
    }
  );

  const menu = open
    ? A.Div(
        {
          style: {
            position: "absolute",
            zIndex: 50,
            marginTop: "8px",
            minWidth: "12rem",
            background: "var(--bg-surface)",
            color: "var(--text-default)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-md)",
            padding: "4px"
          }
        },
        {
          default: [
            loading
              ? A.Div({ style: { padding: "8px", color: "var(--text-subtle)" } }, { default: [t("ui.loading", { fallback: "Loading..." }, app)] })
              : null,
            error
              ? A.Div({ style: { padding: "8px", color: "var(--danger)" } }, { default: [String(error)] })
              : null,
            ...items.map((it) => {
              const opt = mapOption(it);
              const sel = String(p.value ?? "") === String(opt.value);
              return A.Div(
                {
                  role: "option",
                  "aria-selected": sel ? "true" : "false",
                  style: {
                    padding: "8px 12px",
                    borderRadius: "10px",
                    cursor: "pointer",
                    background: sel ? "var(--primary-soft)" : "transparent",
                    color: "var(--text-default)"
                  },
                  onClick: () => {
                    p.onSelect && p.onSelect(opt);
                    open = false;
                    mark();
                  }
                },
                { default: [opt.label] }
              );
            })
          ]
        }
      )
    : null;

  return A.Div(
    { class: C("relative", p.class), style: { position: "relative" } },
    { default: [head, menu] }
  );
});

// ==== MultiSelect (CSS Vars) ====
Comp.define("MultiSelect", (A, s, app, p = {}, sl = {}) => {
  let values = isArr(p.values) ? p.values.slice() : [];
  let items = isArr(p.options) ? p.options.slice() : [];
  let q = "", open = false, loading = false, error = null;

  const mapOption =
    p.mapOption ||
    ((x) =>
      isObj(x)
        ? { value: x.value ?? x.id, label: x.label ?? x.name ?? String(x) }
        : { value: x, label: String(x) });

  const isSel = (v) => values.some((x) => String(x) === String(v));

  const toggle = (v) => {
    values = isSel(v) ? values.filter((x) => String(x) !== String(v)) : values.concat([v]);
    p.onChange && p.onChange(values);
    mark();
  };

  const mark =
    () => app && app.helpers && app.helpers.mark && app.helpers.mark(p.uKey || "MultiSelect");

  const pull =
    U.debounce
      ? U.debounce(async () => {
          if (!p.url) return;
          loading = true; error = null; mark();
          try {
            const query = { ...(p.query || {}), ...(p.queryKey ? { [p.queryKey]: q } : {}) };
            const res = await DataSource.fetch({
              url: p.url,
              method: p.method || "GET",
              query,
              body: p.body,
              map: p.map
            });
            items = isArr(res) ? res : (res.items || res.data || []);
          } catch (e) {
            error = e.message || String(e);
          }
          loading = false; mark();
        }, p.debounce || 250)
      : async () => {};

  return A.Div(
    { class: C("relative", p.class), style: { position: "relative" } },
    {
      default: [
        A.Div(
          { style: { display: "flex", gap: "8px" } },
          {
            default: [
              A.Input({
                placeholder: p.placeholder || t("ui.search", { fallback: "Search..." }, app),
                onInput: (e) => {
                  q = e.target.value;
                  open = true;
                  pull();
                  mark();
                },
                style: {
                  flex: "1 1 auto",
                  border: "1px solid var(--border-default)",
                  borderRadius: "var(--radius-lg)",
                  padding: "8px 12px",
                  background: "var(--bg-surface)",
                  color: "var(--text-default)",
                  outlineColor: "var(--ring-color)"
                }
              }),
              A.Button(
                {
                  style: {
                    padding: "0 8px",
                    border: "1px solid var(--border-default)",
                    borderRadius: "var(--radius-md)",
                    background: "var(--bg-surface)",
                    color: "var(--text-default)"
                  },
                  onClick: () => {
                    open = !open;
                    mark();
                  }
                },
                { default: [open ? "▲" : "▼"] }
              )
            ]
          }
        ),
        open
          ? A.Div(
              {
                style: {
                  position: "absolute",
                  zIndex: 50,
                  marginTop: "8px",
                  minWidth: "12rem",
                  background: "var(--bg-surface)",
                  color: "var(--text-default)",
                  border: "1px solid var(--border-default)",
                  borderRadius: "var(--radius-lg)",
                  boxShadow: "var(--shadow-md)",
                  padding: "4px"
                }
              },
              {
                default: [
                  loading
                    ? A.Div({ style: { padding: "8px", color: "var(--text-subtle)" } }, { default: [t("ui.loading", { fallback: "Loading..." }, app)] })
                    : null,
                  error
                    ? A.Div({ style: { padding: "8px", color: "var(--danger)" } }, { default: [String(error)] })
                    : null,
                  ...items
                    .filter(
                      (it) =>
                        !q ||
                        String(mapOption(it).label)
                          .toLowerCase()
                          .includes(String(q).toLowerCase())
                    )
                    .map((it) => {
                      const opt = mapOption(it);
                      const sel = isSel(opt.value);
                      return A.Div(
                        {
                          style: {
                            padding: "8px 12px",
                            borderRadius: "10px",
                            cursor: "pointer",
                            background: sel ? "var(--primary-soft)" : "transparent",
                            color: "var(--text-default)"
                          },
                          onClick: () => toggle(opt.value)
                        },
                        { default: [(sel ? "✓ " : ""), opt.label] }
                      );
                    })
                ]
              }
            )
          : null,
        values.length
          ? A.Div(
              {
                style: {
                  marginTop: "8px",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "8px"
                }
              },
              {
                default: values.map((v) =>
                  A.Span(
                    {
                      style: {
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "2px 8px",
                        borderRadius: "999px",
                        fontSize: "12px",
                        background: "var(--bg-ui)",
                        color: "var(--text-default)",
                        border: "1px solid var(--border-default)"
                      }
                    },
                    {
                      default: [
                        String(v),
                        A.Button(
                          {
                            style: {
                              border: "none",
                              background: "transparent",
                              color: "var(--text-subtle)",
                              cursor: "pointer",
                              padding: "0 4px"
                            },
                            onClick: () => toggle(v)
                          },
                          { default: ["×"] }
                        )
                      ]
                    }
                  )
                )
              }
            )
          : null
      ]
    }
  );
});

// ==== AutocompleteTable (CSS Vars) ====
Comp.define("AutocompleteTable", (A, s, app, p = {}, sl = {}) => {
  let q = "", open = false, rows = [], loading = false, error = null;

  const mark =
    () => app && app.helpers && app.helpers.mark && app.helpers.mark(p.uKey || "AutocompleteTable");

  const hit =
    U.debounce
      ? U.debounce(async () => {
          if (!p.url) return;
          loading = true; error = null; mark();
          try {
            const query = { ...(p.query || {}), [p.queryKey || "q"]: q };
            const res = await DataSource.fetch({
              url: p.url,
              method: p.method || "GET",
              query,
              body: p.body,
              map: p.map
            });
            rows = isArr(res) ? res : (res.items || res.data || []);
          } catch (e) {
            error = e.message || String(e);
          }
          loading = false; mark();
        }, p.debounce || 250)
      : async () => {};

  const table = () =>
    A.Table(
      { style: { width: "100%", fontSize: "0.875rem", border: "1px solid var(--border-default)", borderRadius: "12px", overflow: "hidden" } },
      {
        default: [
          A.Thead(
            {},
            {
              default: [
                A.Tr(
                  {},
                  {
                    default: (p.columns || []).map((c) =>
                      A.Th(
                        { style: { textAlign: "start", padding: "6px 8px", background: "var(--bg-ui)", color: "var(--text-default)", borderBottom: "1px solid var(--border-default)" } },
                        { default: [c.title || c.key] }
                      )
                    )
                  }
                )
              ]
            }
          ),
          A.Tbody(
            {},
            {
              default: rows.map((r) =>
                A.Tr(
                  {
                    style: { cursor: "pointer", background: "transparent" },
                    onClick: () => {
                      p.onPick && p.onPick(r);
                      open = false;
                      mark();
                    }
                  },
                  {
                    default: (p.columns || []).map((c) =>
                      A.Td(
                        { style: { padding: "6px 8px", borderTop: "1px solid var(--border-default)", color: "var(--text-default)" } },
                        { default: [String(r[c.key] ?? "")] }
                      )
                    )
                  }
                )
              )
            }
          )
        ]
      }
    );

  return A.Div(
    { class: C("relative", p.class), style: { position: "relative" } },
    {
      default: [
        p.header
          ? A.Div({ style: { marginBottom: "8px", fontSize: "0.875rem", color: "var(--text-subtle)" } }, { default: [p.header] })
          : null,
        A.Input({
          placeholder: p.placeholder || t("ui.search", { fallback: "Search..." }, app),
          onInput: (e) => {
            q = e.target.value;
            open = true;
            hit();
            mark();
          },
          style: {
            width: "100%",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-lg)",
            padding: "8px 12px",
            background: "var(--bg-surface)",
            color: "var(--text-default)",
            outlineColor: "var(--ring-color)"
          }
        }),
        open
          ? A.Div(
              {
                style: {
                  position: "absolute",
                  zIndex: 50,
                  marginTop: "8px",
                  width: "min(90vw,640px)",
                  background: "var(--bg-surface)",
                  color: "var(--text-default)",
                  border: "1px solid var(--border-default)",
                  borderRadius: "16px",
                  boxShadow: "var(--shadow-md)",
                  padding: "8px"
                }
              },
              {
                default: [
                  loading
                    ? A.Div({ style: { padding: "8px", color: "var(--text-subtle)" } }, { default: [t("ui.loading", { fallback: "Loading..." }, app)] })
                    : null,
                  error
                    ? A.Div({ style: { padding: "8px", color: "var(--danger)" } }, { default: [String(error)] })
                    : null,
                  rows.length
                    ? table()
                    : A.Div({ style: { padding: "8px", color: "var(--text-subtle)" } }, { default: [t("ui.noResults", { fallback: "No results" }, app)] })
                ]
              }
            )
          : null
      ]
    }
  );
});

// ==== DatePicker (CSS Vars) ====
Comp.define("DatePicker", (A, s, app, p = {}, sl = {}) => {
  const toISO = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");
  let view = p.value ? new Date(p.value) : new Date();
  let value = p.value ? new Date(p.value) : null;

  const mark =
    () => app && app.helpers && app.helpers.mark && app.helpers.mark(p.uKey || "DatePicker");

  const daysIn = (y, m) => new Date(y, m + 1, 0).getDate();
  const fmt = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

  function grid() {
    const y = view.getFullYear(),
      m = view.getMonth(),
      first = new Date(y, m, 1),
      off = (first.getDay() + 6) % 7,
      total = daysIn(y, m);
    const cells = [];
    for (let i = 0; i < off; i++) cells.push(null);
    for (let d = 1; d <= total; d++) cells.push(new Date(y, m, d));
    return cells;
  }

  const pick = (d) => {
    value = fmt(d);
    p.onChange && p.onChange(toISO(value));
    mark();
  };

  return A.Div(
    {
      style: {
        display: "inline-block",
        borderRadius: "16px",
        border: "1px solid var(--border-default)",
        padding: "12px",
        background: "var(--bg-surface)",
        color: "var(--text-default)"
      }
    },
    {
      default: [
        A.Div(
          {
            style: {
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "8px"
            }
          },
          {
            default: [
              A.Button(
                {
                  style: {
                    padding: "0 8px",
                    border: "1px solid var(--border-default)",
                    borderRadius: "var(--radius-md)",
                    background: "var(--bg-ui)",
                    color: "var(--text-default)"
                  },
                  onClick: () => {
                    view.setMonth(view.getMonth() - 1);
                    view = new Date(view);
                    mark();
                  }
                },
                { default: ["←"] }
              ),
              A.Div(
                { style: { fontWeight: 600 } },
                {
                  default: [
                    view.toLocaleString(app?.env?.get()?.locale || undefined, {
                      month: "long",
                      year: "numeric"
                    })
                  ]
                }
              ),
              A.Button(
                {
                  style: {
                    padding: "0 8px",
                    border: "1px solid var(--border-default)",
                    borderRadius: "var(--radius-md)",
                    background: "var(--bg-ui)",
                    color: "var(--text-default)"
                  },
                  onClick: () => {
                    view.setMonth(view.getMonth() + 1);
                    view = new Date(view);
                    mark();
                  }
                },
                { default: ["→"] }
              )
            ]
          }
        ),
        A.Div(
          {
            style: {
              display: "grid",
              gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
              gap: "4px",
              textAlign: "center"
            }
          },
          {
            default: [
              ...["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((n) =>
                A.Div(
                  { style: { fontSize: "12px", color: "var(--text-subtle)" } },
                  { default: [n] }
                )
              ),
              ...grid().map((d) =>
                A.Button(
                  {
                    disabled: !d,
                    style: {
                      padding: "4px 0",
                      borderRadius: "8px",
                      border: "1px solid transparent",
                      background:
                        d && value && +fmt(d) === +fmt(value)
                          ? "var(--primary)"
                          : "transparent",
                      color:
                        d && value && +fmt(d) === +fmt(value)
                          ? "var(--text-on-primary)"
                          : "var(--text-default)"
                    },
                    onClick: () => d && pick(d)
                  },
                  { default: [d ? String(d.getDate()) : ""] }
                )
              )
            ]
          }
        )
      ]
    }
  );
});

// ==== DateRange (CSS Vars) ====
Comp.define("DateRange", (A, s, app, p = {}, sl = {}) => {
  let start = p.start ? new Date(p.start) : null;
  let end = p.end ? new Date(p.end) : null;

  const toISO = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");

  const set = (k, v) => {
    if (k === "start") start = v ? new Date(v) : null;
    else end = v ? new Date(v) : null;
    p.onChange && p.onChange({ start: toISO(start), end: toISO(end) });
    mark();
  };

  const mark =
    () => app && app.helpers && app.helpers.mark && app.helpers.mark(p.uKey || "DateRange");

  return A.Div(
    {
      style: {
        display: "grid",
        gridTemplateColumns: "1fr",
        gap: "8px"
      }
    },
    {
      default: [
        Comp.call("DatePicker", { value: start, onChange: (v) => set("start", v) }),
        Comp.call("DatePicker", { value: end, onChange: (v) => set("end", v) })
      ]
    }
  );
});

// ==== FileUpload (CSS Vars) ====
Comp.define("FileUpload", (A, s, app, p = {}, sl = {}) => {
  const field = p.field || "file";

  const up = (files) => {
    isFn(p.onFiles) && p.onFiles(files);
    if (!p.url) return;
    const fd = new FormData();
    [...files].forEach((f) => fd.append(field, f));
    const xhr = new XMLHttpRequest();
    xhr.open("POST", p.url, true);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && p.onProgress) p.onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        p.onDone && p.onDone(xhr.responseText);
      } else {
        p.onError && p.onError(xhr.statusText || "Upload error");
      }
    };
    xhr.onerror = () => p.onError && p.onError("Network error");
    xhr.send(fd);
  };

  const onInput = (e) => up(e.target.files || []);
  const onDrop = (e) => {
    e.preventDefault();
    up(e.dataTransfer.files || []);
  };
  const onDrag = (e) => e.preventDefault();

  return A.Div(
    {
      class: C(p.class),
      onDrop,
      onDragover: onDrag,
      onDragenter: onDrag,
      style: {
        border: "2px dashed var(--border-default)",
        borderRadius: "16px",
        padding: "16px",
        textAlign: "center",
        background: "var(--bg-surface)",
        color: "var(--text-default)"
      }
    },
    {
      default: [
        A.Div(
          { style: { fontSize: "0.875rem", color: "var(--text-subtle)", marginBottom: "8px" } },
          { default: [p.label || t("ui.dropHere", { fallback: "Drop files here or click" }, app)] }
        ),
        A.Input({ type: "file", multiple: !!p.multiple, onChange: onInput, style: { display: "block", margin: "0 auto" } })
      ]
    }
  );
});

// ==== ContextMenu (CSS Vars) ====
Comp.define("ContextMenu", (A, s, app, p = {}, sl = {}) => {
  let show = false, pos = { x: 0, y: 0 };

  const open = (e) => {
    e.preventDefault();
    show = true;
    pos = { x: e.clientX, y: e.clientY };
    mark();
  };

  const close = () => {
    show = false;
    mark();
  };

  const mark =
    () => app && app.helpers && app.helpers.mark && app.helpers.mark(p.uKey || "ContextMenu");

  return A.Div(
    { class: C("relative", p.class), onContextmenu: open, style: { position: "relative" } },
    {
      default: [
        sl.default || null,
        show ? A.Div({ style: { position: "fixed", inset: "0" }, onClick: close }) : null,
        show
          ? A.Ul(
              {
                style: {
                  position: "fixed",
                  zIndex: 50,
                  minWidth: "12rem",
                  left: pos.x + "px",
                  top: pos.y + "px",
                  background: "var(--bg-surface)",
                  color: "var(--text-default)",
                  border: "1px solid var(--border-default)",
                  borderRadius: "12px",
                  boxShadow: "var(--shadow-md)",
                  padding: "4px"
                }
              },
              {
                default: (p.items || []).map((it) =>
                  A.Li(
                    {
                      style: {
                        padding: "8px 12px",
                        borderRadius: "10px",
                        cursor: "pointer"
                      },
                      onClick: () => {
                        close();
                        isFn(it.onClick) && it.onClick();
                      }
                    },
                    {
                      default: [
                        it.icon ? Comp.call("Icon", { char: it.icon }) : null,
                        " ",
                        it.text
                      ]
                    }
                  )
                )
              }
            )
          : null
      ]
    }
  );
});

// ==== SplitterH (CSS Vars) ====
Comp.define("SplitterH", (A, s, app, p = {}, sl = {}) => {
  let w = p.initial || 320;
  let dragging = false, startX = 0, startW = w;

  const mark =
    () => app && app.helpers && app.helpers.mark && app.helpers.mark(p.uKey || "SplitterH");

  const down = (e) => {
    dragging = true;
    startX = e.clientX;
    startW = w;
    add();
  };
  const move = (e) => {
    if (!dragging) return;
    w = Math.max(160, startW + (e.clientX - startX));
    mark();
  };
  const up = () => {
    dragging = false;
    remove();
  };
  const add = () => {
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
  };
  const remove = () => {
    document.removeEventListener("mousemove", move);
    document.removeEventListener("mouseup", up);
  };

  return A.Div(
    { style: { width: "100%", height: "100%", display: "flex" } },
    {
      default: [
        A.Div(
          { style: { width: w + "px", minWidth: "160px", background: "var(--bg-surface)", color: "var(--text-default)" } },
          { default: sl.left || [] }
        ),
        A.Div({
          style: {
            width: "4px",
            cursor: "col-resize",
            background: "var(--bg-ui)"
          },
          onMousedown: down
        }),
        A.Div(
          { style: { flex: "1 1 auto", minWidth: "160px", background: "var(--bg-surface)", color: "var(--text-default)" } },
          { default: sl.right || [] }
        )
      ]
    }
  );
});

// ==== EmptyState (CSS Vars) ====
Comp.define("EmptyState", (A, s, app, p = {}, sl = {}) =>
  A.Div(
    {
      style: {
        borderRadius: "16px",
        border: "1px solid var(--border-default)",
        padding: "24px",
        textAlign: "center",
        background: "var(--bg-surface)",
        color: "var(--text-default)"
      }
    },
    {
      default: [
        p.icon ? Comp.call("Icon", { char: p.icon }) : null,
        A.Div({ style: { fontSize: "1rem", fontWeight: 600, marginTop: "8px" } }, { default: [p.title || t("ui.nothing", { fallback: "Nothing here" }, app)] }),
        p.text
          ? A.Div({ style: { color: "var(--text-subtle)", marginTop: "4px" } }, { default: [p.text] })
          : null,
        sl.actions
          ? A.Div({ style: { marginTop: "12px", display: "flex", justifyContent: "center", gap: "8px" } }, { default: sl.actions })
          : null
      ]
    }
  )
);

// ==== SearchBar (CSS Vars) ====
Comp.define("SearchBar", (A, s, app, p = {}, sl = {}) => {
  const slots = asSlots(sl);
  const value = p.value ?? "";
  const chips = Array.isArray(p.chips) ? p.chips : [];
  const placeholder = p.placeholder || t("ui.search", { fallback: "Search..." }, app);

  return A.Div(
    {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "8px"
      }
    },
    {
      default: [
        A.Div(
          {
            style: {
              display: "flex",
              alignItems: "center",
              gap: "8px",
              borderRadius: "12px",
              border: "1px solid var(--border-default)",
              padding: "8px 12px",
              background: "var(--bg-surface)"
            }
          },
          {
            default: [
              A.Span(
                {
                  style: {
                    fontSize: "16px",
                    color: "var(--text-subtle)"
                  }
                },
                { default: [p.icon || "🔍"] }
              ),
              A.Input({
                type: "search",
                value,
                placeholder,
                "data-oninput": p.onInput || p.onchange || "search.input",
                style: {
                  flex: "1 1 auto",
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  fontSize: "16px",
                  color: "var(--text-default)"
                }
              }),
              value
                ? A.Button({
                    type: "button",
                    variant: "ghost",
                    size: "sm",
                    "data-onclick": p.onClear || "search.clear",
                    style: {
                      padding: "4px",
                      minWidth: "auto"
                    }
                  }, { default: [p.clearLabel || "×"] })
                : null,
              ...(slots.trailing || [])
            ]
          }
        ),
        chips.length
          ? A.Div(
              {
                style: {
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "6px"
                }
              },
              {
                default: chips.map((chip) =>
                  A.Div(
                    {
                      style: {
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        borderRadius: "999px",
                        padding: "4px 10px",
                        background: chip.tone === "neutral" ? "var(--bg-ui)" : "var(--primary-soft)",
                        color: chip.tone === "neutral" ? "var(--text-default)" : "var(--primary)",
                        fontSize: "14px",
                        fontWeight: 500
                      }
                    },
                    {
                      default: [
                        chip.icon ? A.Span({}, { default: [chip.icon] }) : null,
                        A.Span({}, { default: [chip.label || chip.text || ""] }),
                        chip.removable
                          ? A.Button({
                              type: "button",
                              variant: "ghost",
                              size: "sm",
                              "data-onclick": chip.onRemove || p.onRemoveChip || "search.removeChip",
                              "data-chip-id": chip.id,
                              style: {
                                padding: "2px",
                                minWidth: "auto",
                                color: "inherit"
                              }
                            }, { default: [chip.removeLabel || "×"] })
                          : null
                      ]
                    }
                  )
                )
              }
            )
          : null
      ]
    }
  );
});

// ==== NumpadInteger (POS Utility) ====
Comp.define("NumpadInteger", (A, s, app, p = {}, sl = {}) => {
  const slots = asSlots(sl);
  const tLabel = (key, fallback) => t(key, { fallback }, app);
  const min = Number.isFinite(Number(p.min)) ? Number(p.min) : 0;
  const max = Number.isFinite(Number(p.max)) ? Number(p.max) : Number.MAX_SAFE_INTEGER;
  const rawValue = Number(p.value ?? min);
  const value = Math.max(min, Math.min(max, Number.isFinite(rawValue) ? Math.round(rawValue) : min));
  const keys = isArr(p.keys) && p.keys.length ? p.keys : ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];

  const keyButton = (label, extra = {}) =>
    A.Button(
      {
        type: "button",
        style: {
          height: "64px",
          borderRadius: "16px",
          background: "var(--bg-surface)",
          border: "1px solid var(--border-default)",
          fontSize: "24px",
          fontWeight: 600,
          color: "var(--text-default)",
          cursor: "pointer",
          transition: "var(--transition-default)",
          ...extra.style
        },
        ...extra
      },
      { default: [label] }
    );

  return A.Div(
    {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        padding: "20px",
        minWidth: "320px",
        borderRadius: "20px",
        border: "1px solid var(--border-default)",
        background: "var(--bg-surface)"
      }
    },
    {
      default: [
        A.Div(
          {
            style: {
              textAlign: "center",
              fontSize: "18px",
              fontWeight: 600,
              color: "var(--text-default)"
            }
          },
          { default: [p.title || tLabel("ui.enterQuantity", "Enter Quantity")] }
        ),
        A.Div(
          {
            style: {
              textAlign: "center",
              fontSize: "32px",
              fontWeight: 700,
              color: "var(--primary)",
              padding: "16px",
              borderRadius: "12px",
              border: "2px solid var(--primary)",
              background: "var(--bg-page)"
            }
          },
          { default: [String(value)] }
        ),
        A.Div(
          {
            style: {
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "12px"
            }
          },
          {
            default: [
              ...keys.map((key) =>
                keyButton(key, {
                  "data-onclick": p.onInputCommand || "numpad.integer.input",
                  "data-key": key
                })
              ),
              keyButton(p.clearLabel || tLabel("ui.clear", "Clear"), {
                style: { gridColumn: "span 1" },
                "data-onclick": p.onClearCommand || "numpad.integer.clear"
              }),
              keyButton(p.confirmLabel || tLabel("ui.confirm", "OK"), {
                style: { gridColumn: "span 2", background: "var(--primary)", color: "var(--text-on-primary, #ffffff)" },
                "data-onclick": p.onConfirmCommand || "numpad.integer.confirm"
              })
            ]
          }
        ),
        ...(slots.default || [])
      ]
    }
  );
});

// ==== NumpadDecimal (POS Utility) ====
Comp.define("NumpadDecimal", (A, s, app, p = {}, sl = {}) => {
  const slots = asSlots(sl);
  const tLabel = (key, fallback) => t(key, { fallback }, app);
  const min = Number.isFinite(Number(p.min)) ? Number(p.min) : 0;
  const max = Number.isFinite(Number(p.max)) ? Number(p.max) : 999999.99;
  const rawValue = Number(p.value ?? min);
  const decimalsRaw = Number(p.decimals);
  const decimals = Number.isFinite(decimalsRaw) ? Math.max(0, Math.min(4, Math.trunc(decimalsRaw))) : 2;
  const value = Math.max(min, Math.min(max, Number.isFinite(rawValue) ? rawValue : min));
  const keys = isArr(p.keys) && p.keys.length ? p.keys : ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"];

  const keyButton = (label, extra = {}) =>
    A.Button(
      {
        type: "button",
        style: {
          height: "64px",
          borderRadius: "16px",
          background: "var(--bg-surface)",
          border: "1px solid var(--border-default)",
          fontSize: "24px",
          fontWeight: 600,
          color: "var(--text-default)",
          cursor: "pointer",
          transition: "var(--transition-default)",
          ...extra.style
        },
        ...extra
      },
      { default: [label] }
    );

  return A.Div(
    {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        padding: "20px",
        minWidth: "320px",
        borderRadius: "20px",
        border: "1px solid var(--border-default)",
        background: "var(--bg-surface)"
      }
    },
    {
      default: [
        A.Div(
          {
            style: {
              textAlign: "center",
              fontSize: "18px",
              fontWeight: 600,
              color: "var(--text-default)"
            }
          },
          { default: [p.title || tLabel("ui.enterAmount", "Enter Amount")] }
        ),
        A.Div(
          {
            style: {
              textAlign: "center",
              fontSize: "32px",
              fontWeight: 700,
              color: "var(--primary)",
              padding: "16px",
              borderRadius: "12px",
              border: "2px solid var(--primary)",
              background: "var(--bg-page)"
            }
          },
          { default: [value.toFixed(decimals)] }
        ),
        A.Div(
          {
            style: {
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "12px"
            }
          },
          {
            default: [
              ...keys.map((key) =>
                keyButton(key, {
                  "data-onclick": p.onInputCommand || "numpad.decimal.input",
                  "data-key": key
                })
              ),
              keyButton(p.clearLabel || tLabel("ui.clear", "Clear"), {
                style: { gridColumn: "span 1" },
                "data-onclick": p.onClearCommand || "numpad.decimal.clear"
              }),
              keyButton(p.confirmLabel || tLabel("ui.confirm", "OK"), {
                style: { gridColumn: "span 2", background: "var(--primary)", color: "var(--text-on-primary, #ffffff)" },
                "data-onclick": p.onConfirmCommand || "numpad.decimal.confirm"
              })
            ]
          }
        ),
        ...(slots.default || [])
      ]
    }
  );
});

// ==== PinPrompt (POS Utility) ====
Comp.define("PinPrompt", (A, s, app, p = {}, sl = {}) => {
  const slots = asSlots(sl);
  const tLabel = (key, fallback) => t(key, { fallback }, app);
  const reason = p.reason || "general";
  const attempts = Number.isFinite(Number(p.attempts)) ? Number(p.attempts) : 3;
  const currentAttempt = Math.min(Number.isFinite(Number(p.currentAttempt)) ? Number(p.currentAttempt) : 1, attempts);
  const digitsRaw = Number(p.digits ?? p.slots);
  const digits = Number.isFinite(digitsRaw) ? Math.max(1, Math.min(8, Math.trunc(digitsRaw))) : 4;
  const pin = String(p.pin || "").slice(0, digits);
  const error = p.error || null;

  const reasons = {
    delete_line: tLabel("ui.deleteItem", "Delete Item"),
    bill_discount: tLabel("ui.billDiscount", "Bill Discount"),
    returns: tLabel("ui.returns", "Returns"),
    refund: tLabel("ui.refund", "Refund"),
    general: tLabel("ui.enterPin", "Enter PIN")
  };

  return A.Div(
    {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        padding: "20px",
        minWidth: "320px",
        borderRadius: "20px",
        border: "1px solid var(--border-default)",
        background: "var(--bg-surface)"
      }
    },
    {
      default: [
        A.Div(
          {
            style: {
              textAlign: "center",
              fontSize: "18px",
              fontWeight: 600,
              color: "var(--text-default)"
            }
          },
          { default: [reasons[reason] || reasons.general] }
        ),
        A.Div(
          {
            style: {
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: "12px",
              height: "48px"
            }
          },
          {
            default: range(digits, 0).map((idx) =>
              A.Div(
                {
                  style: {
                    width: "40px",
                    height: "48px",
                    borderRadius: "12px",
                    border: "1px solid var(--border-default)",
                    background: "var(--bg-surface)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "24px"
                  }
                },
                { default: [pin.length > idx ? "●" : ""] }
              )
            )
          }
        ),
        error
          ? A.Div(
              {
                style: {
                  borderRadius: "10px",
                  padding: "8px 12px",
                  fontSize: "14px",
                  color: "var(--danger)",
                  background: "var(--danger-soft)",
                  textAlign: "center"
                }
              },
              { default: [error] }
            )
          : null,
        A.Div(
          {
            style: {
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "12px"
            }
          },
          {
            default: [
              ...range(9, 1).map((i) =>
                A.Button({
                  type: "button",
                  "data-onclick": p.onInputCommand || "pin.input",
                  "data-key": String(i),
                  style: {
                    height: "64px",
                    borderRadius: "16px",
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border-default)",
                    fontSize: "24px",
                    fontWeight: 600,
                    color: "var(--text-default)"
                  }
                }, { default: [String(i)] })
              ),
              A.Button({
                type: "button",
                "data-onclick": p.onClearCommand || "pin.clear",
                style: {
                  height: "64px",
                  borderRadius: "16px",
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-default)",
                  fontSize: "18px",
                  fontWeight: 600,
                  color: "var(--text-default)"
                }
              }, { default: [p.clearLabel || tLabel("ui.clear", "Clear")] }),
              A.Button({
                type: "button",
                "data-onclick": p.onInputCommand || "pin.input",
                "data-key": "0",
                style: {
                  height: "64px",
                  borderRadius: "16px",
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-default)",
                  fontSize: "24px",
                  fontWeight: 600,
                  color: "var(--text-default)"
                }
              }, { default: ["0"] }),
              A.Button({
                type: "button",
                intent: "success",
                "data-onclick": p.onConfirmCommand || "pin.confirm",
                style: {
                  height: "64px",
                  borderRadius: "16px",
                  background: "var(--primary)",
                  border: "1px solid var(--primary)",
                  fontSize: "18px",
                  fontWeight: 600,
                  color: "var(--text-on-primary, #ffffff)"
                }
              }, { default: [p.confirmLabel || tLabel("ui.confirm", "OK")] })
            ]
          }
        ),
        slots.footer
          ? A.Div({ style: { marginTop: "4px" } }, { default: slots.footer })
          : null,
        A.Div(
          {
            style: {
              fontSize: "12px",
              color: "var(--text-subtle)",
              textAlign: "center"
            }
          },
          {
            default: [
              t("ui.pin_attempt", { fallback: `Attempt ${currentAttempt}/${attempts}` }, app)
            ]
          }
        )
      ]
    }
  );
});

// ==== PageHeader (CSS Vars) ====
Comp.define("PageHeader", (A, s, app, p = {}, sl = {}) =>
  A.Div(
    {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: "16px",
        color: "var(--text-default)"
      }
    },
    {
      default: [
        A.Div({}, { default: [A.Div({ style: { fontSize: "1.25rem", fontWeight: "bold" } }, { default: [p.title || ""] })] }),
        A.Div({}, { default: sl.actions || [] })
      ]
    }
  )
);

// ==== NavMenu (CSS Vars) ====
Comp.define("NavMenu", (A, s, app, p = {}, sl = {}) =>
  A.Ul(
    { style: { display: "flex", flexDirection: "column", gap: "4px" } },
    {
      default: (p.items || []).map((it) =>
        A.Li(
          {},
          {
            default: [
              A.A(
                {
                  href: it.href || "#",
                  style: {
                    display: "block",
                    padding: "8px 12px",
                    borderRadius: "12px",
                    background: it.active ? "var(--primary-soft)" : "transparent",
                    color: it.active ? "var(--primary)" : "var(--text-default)",
                    textDecoration: "none",
                    border: "1px solid transparent"
                  }
                },
                { default: [it.text] }
              )
            ]
          }
        )
      )
    }
  )
);

// ==== DataTable (CSS Vars) ====
Comp.define("DataTable", (A, s, app, p = {}, sl = {}) => {
  let page = p.page || 1,
    size = p.size || 10;
  let sortKey = p.sortKey || null,
    sortDir = p.sortDir || "asc";
  let filter = p.filter || "";
  let rows = isArr(p.rows) ? p.rows.slice() : [];
  let total = rows.length,
    loading = false,
    error = null;

  const mark =
    () => app && app.helpers && app.helpers.mark && app.helpers.mark(p.uKey || "DataTable");

  async function load() {
    if (!p.ajax || !p.ajax.url) return;
    loading = true;
    error = null;
    mark();
    try {
      const payload = isFn(p.ajax.params)
        ? p.ajax.params({ page, size, sortKey, sortDir, filter })
        : p.ajax.params || { page, size, sortKey, sortDir, filter };
      const res = await DataSource.fetch({
        url: p.ajax.url,
        method: p.ajax.method || "GET",
        query: p.ajax.method === "GET" ? payload : null,
        body: p.ajax.method !== "GET" ? payload : null,
        map: p.ajax.map
      });
      const mapped = isObj(res) && "rows" in res ? res : { rows: res.items || res.data || [], total: res.total || (res.items ? res.items.length : 0) };
      rows = mapped.rows || [];
      total = +mapped.total || rows.length;
    } catch (e) {
      error = e.message || String(e);
    }
    loading = false;
    mark();
  }

  function currentView() {
    let data = rows;
    if (!p.ajax) {
      if (filter)
        data = data.filter((r) =>
          (p.columns || []).some((c) =>
            String(r[c.key] ?? "")
              .toLowerCase()
              .includes(String(filter).toLowerCase())
          )
        );
      if (sortKey)
        data = data.slice().sort((a, b) => {
          const va = a[sortKey],
            vb = b[sortKey];
          if (va == vb) return 0;
          return (va > vb ? 1 : -1) * (sortDir === "asc" ? 1 : -1);
        });
    }
    const pages = Math.max(1, Math.ceil(total / size));
    const start = (page - 1) * size;
    const paged = p.ajax ? data : data.slice(start, start + size);
    return { paged, pages };
  }

  const onSort = (k) => {
    sortDir = sortKey === k && sortDir === "asc" ? "desc" : "asc";
    sortKey = k;
    p.onSort && p.onSort(k, sortDir);
    p.ajax ? load() : mark();
  };

  const onPage = (i) => {
    page = i;
    p.onPage && p.onPage(i);
    p.ajax ? load() : mark();
  };

  const onFilterInput = (e) => {
    filter = e.target.value;
    p.onFilter && p.onFilter(filter);
    p.ajax ? load() : mark();
  };

  const toolsBar =
    p.tools !== false
      ? A.Div(
          {
            style: {
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "8px"
            }
          },
          {
            default: [
              A.Input({
                placeholder: t("ui.search", { fallback: "Search..." }, app),
                value: filter,
                onInput: onFilterInput,
                style: {
                  flex: "1 1 auto",
                  border: "1px solid var(--border-default)",
                  borderRadius: "var(--radius-lg)",
                  padding: "8px 12px",
                  background: "var(--bg-surface)",
                  color: "var(--text-default)"
                }
              }),
              A.Button({ onClick: () => Exporter.csv(rows, p.columns, "table.csv") }, { default: [t("ui.exportCsv", { fallback: "CSV" }, app)] }),
              A.Button({ onClick: () => Exporter.xls(rows, p.columns, "table.xls") }, { default: [t("ui.exportExcel", { fallback: "Excel" }, app)] }),
              A.Button(
                {
                  onClick: () =>
                    Exporter.printHTML(
                      '<html><head><title>Print</title></head><body>' +
                        (function () {
                          const d = document.createElement("div");
                          d.appendChild(A.toNode(table()));
                          return d.innerHTML;
                        })() +
                        "</body></html>"
                    )
                },
                { default: [t("ui.print", { fallback: "Print" }, app)] }
              )
            ]
          }
        )
      : null;

  const header = () =>
    A.Tr(
      {},
      {
        default: (p.columns || []).map((col) =>
          A.Th(
            {
              onClick: () => onSort(col.key),
              style: {
                cursor: "pointer",
                userSelect: "none",
                padding: "6px 8px",
                background: "var(--bg-ui)",
                color: sortKey === col.key ? "var(--primary)" : "var(--text-default)",
                borderBottom: "1px solid var(--border-default)"
              }
            },
            { default: [col.title || col.key] }
          )
        )
      }
    );

  const bodyRows = (data) =>
    data.map((r) =>
      A.Tr(
        {},
        {
          default: (p.columns || []).map((col) =>
            A.Td(
              { style: { padding: "6px 8px", borderTop: "1px solid var(--border-default)", color: "var(--text-default)" } },
              { default: [col.render ? col.render(r[col.key], r) : String(r[col.key] ?? "")] }
            )
          )
        }
      )
    );

  const pager = (pages) =>
    A.Div(
      { style: { display: "flex", alignItems: "center", gap: "8px", marginTop: "8px" } },
      {
        default: range(pages).map((i) =>
          A.Button(
            {
              style: {
                padding: "4px 8px",
                borderRadius: "8px",
                background: i === page ? "var(--primary)" : "var(--bg-ui)",
                color: i === page ? "var(--text-on-primary)" : "var(--text-default)",
                border: "1px solid var(--border-default)"
              },
              onClick: () => onPage(i)
            },
            { default: [String(i)] }
          )
        )
      }
    );

  const table = () =>
    A.Table(
      { style: { width: "100%", fontSize: "0.875rem", border: "1px solid var(--border-default)", borderRadius: "12px", overflow: "hidden", background: "var(--bg-surface)" } },
      {
        default: [A.Thead({}, { default: [header()] }), A.Tbody({}, { default: bodyRows(currentView().paged) })]
      }
    );

  if (p.ajax) load();

  return A.Div(
    { class: C("", p.class), style: { color: "var(--text-default)" } },
    {
      default: [
        toolsBar,
        loading
          ? A.Div({ style: { padding: "8px", color: "var(--text-subtle)" } }, { default: [t("ui.loading", { fallback: "Loading..." }, app)] })
          : error
            ? A.Div({ style: { padding: "8px", color: "var(--danger)" } }, { default: [String(error)] })
            : table(),
        pager(currentView().pages)
      ]
    }
  );
});

// ==== DataTablePro (CSS Vars) ====
Comp.define("DataTablePro", (A, s, app, p = {}, sl = {}) => {
  let page = p.page || 1,
    size = p.size || 10,
    sortKey = p.sortKey || null,
    sortDir = p.sortDir || "asc",
    filter = p.filter || "";

  let rows = isArr(p.rows) ? p.rows.slice() : [],
    total = rows.length,
    loading = false,
    error = null,
    hidden = new Set((p.columns || []).filter((c) => c.hidden).map((c) => c.key));

  let sel = new Set();

  const mark =
    () => app && app.helpers && app.helpers.mark && app.helpers.mark(p.uKey || "DataTablePro");

  async function load() {
    if (!p.ajax || !p.ajax.url) return;
    loading = true;
    error = null;
    mark();
    try {
      const params = isFn(p.ajax.params)
        ? p.ajax.params({ page, size, sortKey, sortDir, filter })
        : { ...(p.ajax.params || {}), page, size, sortKey, sortDir, filter };
      const res = await DataSource.fetch({
        url: p.ajax.url,
        method: p.ajax.method || "GET",
        query: p.ajax.method === "GET" ? params : null,
        body: p.ajax.method !== "GET" ? params : null,
        map: p.ajax.map
      });
      const mapped = isObj(res) && "rows" in res ? res : { rows: res.items || res.data || [], total: res.total || 0 };
      rows = mapped.rows || [];
      total = +mapped.total || rows.length;
    } catch (e) {
      error = e.message || String(e);
    }
    loading = false;
    mark();
  }

  if (p.ajax) load();

  function viewRows() {
    let data = rows.slice();
    if (!p.ajax && filter)
      data = data.filter((r) =>
        (p.columns || []).some((c) =>
          String(r[c.key] ?? "")
            .toLowerCase()
            .includes(filter.toLowerCase())
        )
      );
    if (!p.ajax && sortKey)
      data = data.sort((a, b) => {
        const va = a[sortKey],
          vb = b[sortKey];
        if (va == vb) return 0;
        return (va > vb ? 1 : -1) * (sortDir === "asc" ? 1 : -1);
      });
    const pages = Math.max(1, Math.ceil((p.ajax ? total : data.length) / size));
    const start = (page - 1) * size;
    const paged = p.ajax ? data : data.slice(start, start + size);
    return { data: paged, pages };
  }

  const onSort = (k) => {
    sortDir = sortKey === k && sortDir === "asc" ? "desc" : "asc";
    sortKey = k;
    p.ajax ? load() : mark();
  };

  const onPage = (i) => {
    page = i;
    p.ajax ? load() : mark();
  };

  const onFilter = (e) => {
    filter = e.target.value;
    p.ajax ? load() : mark();
  };

  const toggleCol = (k) => {
    hidden.has(k) ? hidden.delete(k) : hidden.add(k);
    mark();
  };

  const toggleAll = (checked, data) => {
    sel = new Set(checked ? data.map((_, i) => i) : []);
    mark();
  };

  const toggleRow = (i, row, checked) => {
    checked ? sel.add(i) : sel.delete(i);
    isFn(p.onRowSelect) && p.onRowSelect(row, checked);
    mark();
  };

  const cols = (p.columns || []).filter((c) => !hidden.has(c.key));
  const vr = () => viewRows();

  const dataTools = A.Div(
    { style: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" } },
    {
      default: [
        A.Input({
          placeholder: t("ui.search", { fallback: "Search..." }, app),
          value: filter,
          onInput: onFilter,
          style: {
            flex: "1 1 auto",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-lg)",
            padding: "8px 12px",
            background: "var(--bg-surface)",
            color: "var(--text-default)"
          }
        }),
        A.Button({ onClick: () => Exporter.csv(rows, p.columns, "table.csv") }, { default: ["CSV"] }),
        A.Button({ onClick: () => Exporter.xls(rows, p.columns, "table.xls") }, { default: ["Excel"] }),
        A.Button(
          {
            onClick: () =>
              Exporter.printHTML(
                '<html><head><title>Print</title></head><body>' +
                  (function () {
                    const d = document.createElement("div");
                    d.appendChild(A.toNode(table()));
                    return d.innerHTML;
                  })() +
                  "</body></html>"
              )
          },
          { default: [t("ui.print", { fallback: "Print" }, app)] }
        ),
        A.Div(
          { style: { position: "relative" } },
          {
            default: [
              A.Button(
                {
                  style: {
                    padding: "0 8px",
                    border: "1px solid var(--border-default)",
                    borderRadius: "var(--radius-md)",
                    background: "var(--bg-surface)",
                    color: "var(--text-default)"
                  }
                },
                { default: [t("ui.columns", { fallback: "Columns" }, app)] }
              ),
              A.Ul(
                {
                  style: {
                    position: "absolute",
                    right: 0,
                    zIndex: 50,
                    marginTop: "8px",
                    minWidth: "12rem",
                    background: "var(--bg-surface)",
                    color: "var(--text-default)",
                    border: "1px solid var(--border-default)",
                    borderRadius: "12px",
                    boxShadow: "var(--shadow-md)",
                    padding: "4px"
                  }
                },
                {
                  default: (p.columns || []).map((c) =>
                    A.Li(
                      {
                        style: {
                          padding: "8px 12px",
                          borderRadius: "10px",
                          cursor: "pointer"
                        },
                        onClick: () => toggleCol(c.key)
                      },
                      { default: [hidden.has(c.key) ? "☐ " : "☑ ", c.title || c.key] }
                    )
                  )
                }
              )
            ]
          }
        )
      ]
    }
  );

  const header = A.Tr(
    {},
    {
      default: [
        A.Th(
          { style: { padding: "6px 8px", background: "var(--bg-ui)", borderBottom: "1px solid var(--border-default)" } },
          {
            default: [
              A.Input({
                type: "checkbox",
                onChange: (e) => toggleAll(e.target.checked, vr().data)
              })
            ]
          }
        ),
        ...cols.map((c) =>
          A.Th(
            {
              onClick: () => onSort(c.key),
              style: {
                cursor: "pointer",
                userSelect: "none",
                padding: "6px 8px",
                background: "var(--bg-ui)",
                color: sortKey === c.key ? "var(--primary)" : "var(--text-default)",
                borderBottom: "1px solid var(--border-default)"
              }
            },
            { default: [c.title || c.key] }
          )
        )
      ]
    }
  );

  const body = () =>
    vr().data.map((r, i) =>
      A.Tr(
        {},
        {
          default: [
            A.Td(
              { style: { padding: "6px 8px", borderTop: "1px solid var(--border-default)" } },
              {
                default: [
                  A.Input({
                    type: "checkbox",
                    checked: sel.has(i),
                    onChange: (e) => toggleRow(i, r, e.target.checked)
                  })
                ]
              }
            ),
            ...cols.map((c) =>
              A.Td(
                { style: { padding: "6px 8px", borderTop: "1px solid var(--border-default)", color: "var(--text-default)" } },
                { default: [c.render ? c.render(r[c.key], r) : String(r[c.key] ?? "")] }
              )
            )
          ]
        }
      )
    );

  const pager = () =>
    A.Div(
      { style: { display: "flex", alignItems: "center", gap: "8px", marginTop: "8px" } },
      {
        default: range(vr().pages).map((i) =>
          A.Button(
            {
              style: {
                padding: "4px 8px",
                borderRadius: "8px",
                background: i === page ? "var(--primary)" : "var(--bg-ui)",
                color: i === page ? "var(--text-on-primary)" : "var(--text-default)",
                border: "1px solid var(--border-default)"
              },
              onClick: () => onPage(i)
            },
            { default: [String(i)] }
          )
        )
      }
    );

  const table = () =>
    A.Table(
      { style: { width: "100%", fontSize: "0.875rem", border: "1px solid var(--border-default)", borderRadius: "12px", overflow: "hidden", background: "var(--bg-surface)" } },
      {
        default: [A.Thead({}, { default: [header] }), A.Tbody({}, { default: body() })]
      }
    );

  return A.Div(
    { class: C("", p.class), style: { color: "var(--text-default)" } },
    {
      default: [
        dataTools,
        loading
          ? A.Div({ style: { padding: "8px", color: "var(--text-subtle)" } }, { default: [t("ui.loading", { fallback: "Loading..." }, app)] })
          : error
            ? A.Div({ style: { padding: "8px", color: "var(--danger)" } }, { default: [String(error)] })
            : table(),
        pager()
      ]
    }
  );
});

// ==== CommandPalette (CSS Vars) ====
Comp.define("CommandPalette", (A, s, app, p = {}, sl = {}) => {
  let visible = !!p.open, q = "";

  const mark =
    () => app && app.helpers && app.helpers.mark && app.helpers.mark(p.uKey || "CommandPalette");

  const onKey = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      visible = true;
      mark();
    } else if (e.key === "Escape" && visible) {
      visible = false;
      mark();
    }
  };

  const run = (it) => {
    visible = false;
    isFn(it.run) && it.run();
    mark();
  };

  return A.Div(
    {
      onMounted: () => document.addEventListener("keydown", onKey),
      onUnmounted: () => document.removeEventListener("keydown", onKey)
    },
    {
      default: [
        visible
          ? A.Div(
              {
                style: {
                  position: "fixed",
                  inset: "0",
                  zIndex: 1200,
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "center",
                  padding: "32px",
                  background: "rgba(0,0,0,0.3)"
                }
              },
              {
                default: [
                  A.Div(
                    {
                      style: {
                        width: "min(720px,95vw)",
                        borderRadius: "16px",
                        border: "1px solid var(--border-default)",
                        background: "var(--bg-surface)",
                        color: "var(--text-default)",
                        padding: "8px",
                        boxShadow: "var(--shadow-md)"
                      }
                    },
                    {
                      default: [
                        A.Input({
                          placeholder: t("ui.search", { fallback: "Search..." }, app),
                          value: q,
                          onInput: (e) => {
                            q = e.target.value;
                            mark();
                          },
                          style: {
                            width: "100%",
                            border: "1px solid var(--border-default)",
                            borderRadius: "var(--radius-lg)",
                            padding: "8px 12px",
                            background: "var(--bg-surface)",
                            color: "var(--text-default)",
                            marginBottom: "8px"
                          }
                        }),
                        A.Ul(
                          { style: { maxHeight: "50vh", overflow: "auto" } },
                          {
                            default: (p.items || [])
                              .filter((it) => !q || String(it.title).toLowerCase().includes(q.toLowerCase()))
                              .map((it) =>
                                A.Li(
                                  {
                                    style: {
                                      padding: "8px 12px",
                                      borderRadius: "10px",
                                      cursor: "pointer"
                                    },
                                    onClick: () => run(it)
                                  },
                                  {
                                    default: [
                                      it.title,
                                      it.shortcut
                                        ? A.Span(
                                            { style: { float: "right", fontSize: "12px", color: "var(--text-subtle)" } },
                                            { default: [it.shortcut] }
                                          )
                                        : null
                                    ]
                                  }
                                )
                              )
                          }
                        )
                      ]
                    }
                  )
                ]
              }
            )
          : null
      ]
    }
  );
});

// ==== ReportTool (CSS Vars) ====
Comp.define("ReportTool", (A, s, app, p = {}, sl = {}) => {
  let qState = { ...(p.defaultParams || {}) };
  let rows = [], total = 0, chartCfg = null, loading = false, error = null, page = 1, size = p.size || 10, sortKey = null, sortDir = "asc";

  const mark =
    () => app && app.helpers && app.helpers.mark && app.helpers.mark(p.uKey || "ReportTool");

  async function run() {
    loading = true;
    error = null;
    mark();
    try {
      const params = isFn(p.endpoint?.params)
        ? p.endpoint.params({ ...qState, page, size, sortKey, sortDir })
        : { ...qState, page, size, sortKey, sortDir };
      const res = await DataSource.fetch({
        url: p.endpoint.url,
        method: p.endpoint.method || "GET",
        query: p.endpoint.method === "GET" ? params : null,
        body: p.endpoint.method !== "GET" ? params : null
      });
      const mapped = isFn(p.map)
        ? p.map(res)
        : isFn(p.endpoint?.map)
          ? p.endpoint.map(res)
          : { rows: res.items || res.data || [], total: res.total || 0, chart: res.chart || null };
      rows = mapped.rows || [];
      total = +mapped.total || rows.length;
      chartCfg = mapped.chart || null;
    } catch (e) {
      error = e.message || String(e);
    }
    loading = false;
    mark();
  }

  const setParam = (k, v) => {
    qState[k] = v;
  };

  const submit = (e) => {
    e && e.preventDefault && e.preventDefault();
    page = 1;
    run();
  };

  const Params = isFn(p.paramsUI)
    ? p.paramsUI({ state: qState, set: setParam, submit, app })
    : A.Form(
        { onSubmit: submit },
        {
          default: [
            A.Div(
              {
                style: {
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: "12px",
                  maxWidth: "100%"
                }
              },
              {
                default: (p.fields || []).map((f) => {
                  const label = A.Label(
                    { style: { display: "block", fontSize: "0.875rem", marginBottom: "4px", color: "var(--text-default)" } },
                    { default: [f.label || f.key] }
                  );
                  const control =
                    f.type === "date"
                      ? Comp.call("DatePicker", { value: qState[f.key], onChange: (v) => setParam(f.key, v) })
                      : f.type === "select"
                        ? Comp.call("AsyncSelect", {
                            url: f.url,
                            options: f.options,
                            mapOption: f.mapOption,
                            value: qState[f.key],
                            onSelect: (opt) => setParam(f.key, opt.value)
                          })
                        : A.Input({
                            value: qState[f.key] || "",
                            onInput: (e) => setParam(f.key, e.target.value),
                            style: {
                              width: "100%",
                              border: "1px solid var(--border-default)",
                              borderRadius: "var(--radius-lg)",
                              padding: "8px 12px",
                              background: "var(--bg-surface)",
                              color: "var(--text-default)"
                            }
                          });
                  return A.Div(
                    { style: { marginBottom: "8px" } },
                    { default: [label, control] }
                  );
                })
              }
            ),
            A.Div(
              { style: { marginTop: "8px", display: "flex", justifyContent: "flex-end" } },
              { default: [Comp.call("Button", { text: t("ui.run", { fallback: "Run" }, app) })] }
            )
          ]
        }
      );

  const ChartArea = chartCfg
    ? A.Div(
        {
          style: {
            border: "1px solid var(--border-default)",
            borderRadius: "16px",
            padding: "12px",
            background: "var(--bg-surface)"
          }
        },
        {
          default: [
            A.Canvas({
              ref: (el) => {
                try {
                  if (window.Chart) {
                    if (el.__chart) try { el.__chart.destroy(); } catch (_) {}
                    const ctx = el.getContext("2d");
                    el.__chart = new window.Chart(ctx, {
                      type: chartCfg.type || "bar",
                      data: chartCfg.data || {},
                      options: chartCfg.options || {}
                    });
                  } else if (isFn(p.customChartRenderer)) {
                    p.customChartRenderer(el, chartCfg);
                  }
                } catch (_) {}
              }
            })
          ]
        }
      )
    : null;

  const TableArea = Comp.call("DataTablePro", {
    columns: p.columns || [],
    rows,
    size,
    page,
    sortKey,
    sortDir,
    tools: true,
    onPage: (i) => {
      page = i;
      mark();
    },
    onSort: (k, dir) => {
      sortKey = k;
      sortDir = dir;
      mark();
    }
  });

  if (p.autoLoad !== false && p.endpoint?.url) run();

  return A.Div(
    {
      style: {
        display: "grid",
        gap: "16px",
        gridTemplateColumns: "1fr",
      }
    },
    {
      default: [
        A.Div({ style: { gridColumn: "1 / -1" } }, { default: [Params] }),
        A.Div(
          { style: { gridColumn: "1 / -1" } },
          {
            default: [
              loading
                ? A.Div({ style: { padding: "8px", color: "var(--text-subtle)" } }, { default: [t("ui.loading", { fallback: "Loading..." }, app)] })
                : error
                  ? A.Div({ style: { padding: "8px", color: "var(--danger)" } }, { default: [String(error)] })
                  : TableArea
            ]
          }
        ),
        A.Div({ style: { gridColumn: "1 / -1" } }, { default: [ChartArea] })
      ]
    }
  );
});



  const CurrencyUtil = { symbol(currency = 'USD', locale = 'en') { try { const parts = new Intl.NumberFormat(locale, { style: 'currency', currency }).formatToParts(0); const token = parts.find(part => part.type === 'currency'); return token ? token.value : currency; } catch (_) { return currency; } }, format(value, options = {}) { if (value == null || value === '') return ''; const locale = options.locale || 'en'; const currency = options.currency || 'USD'; const minimumFractionDigits = options.minimumFractionDigits != null ? options.minimumFractionDigits : 2; const maximumFractionDigits = options.maximumFractionDigits != null ? options.maximumFractionDigits : minimumFractionDigits; try { return new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits, maximumFractionDigits }).format(value); } catch (_) { const num = Number(value); return Number.isFinite(num) ? num.toFixed(minimumFractionDigits) : String(value); } }, parse(input, options = {}) { if (input == null) return 0; const locale = options.locale || 'en'; const raw = String(input).trim(); if (!raw) return 0; const normalized = raw.replace(/[\s\u00a0]/g, ''); const decimal = locale.startsWith('fr') || locale.startsWith('ar') ? ',' : '.'; let cleaned = normalized.replace(new RegExp(`[^0-9${decimal}-]`, 'g'), ''); if (decimal === ',') cleaned = cleaned.replace(/\./g, '').replace(',', '.'); else cleaned = cleaned.replace(/,/g, ''); const num = parseFloat(cleaned); return Number.isNaN(num) ? 0 : num; } };
  const PhoneUtil = { normalize(value) { return String(value || '').replace(/[^0-9+]/g, ''); }, format(value, { country } = {}) { const raw = this.normalize(value); if (!raw) return ''; if (raw.startsWith('+')) { return raw.replace(/(\+\d{1,3})(\d{3})(\d{3})(\d{0,4})/, (_, c, a, b, rest) => rest ? `${c} ${a} ${b} ${rest}` : `${c} ${a} ${b}`); } if (raw.length === 11) { return raw.replace(/(\d{3})(\d{3})(\d{5})/, '$1 $2 $3'); } if (raw.length === 10) { return raw.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3'); } return raw; } };
  const Hotkeys = (() => { const registry = new Map(); let installed = false; const normalize = combo => String(combo || '').trim().toLowerCase(); const parse = combo => normalize(combo).split('+').map(part => part.trim()).filter(Boolean); function match(e, parts) { let main = null; let needAlt = false, needShift = false, needCtrl = false, needMeta = false, needMod = false; for (const part of parts) { if (part === 'alt') { needAlt = true; continue; } if (part === 'shift') { needShift = true; continue; } if (part === 'ctrl' || part === 'control') { needCtrl = true; continue; } if (part === 'meta' || part === 'cmd' || part === 'command') { needMeta = true; continue; } if (part === 'mod') { needMod = true; continue; } main = part; } const key = (e.key || '').toLowerCase(); const eventKey = key === ' ' ? 'space' : key; if (main && main !== eventKey) return false; if (needAlt && !e.altKey) return false; if (needShift && !e.shiftKey) return false; if (needCtrl && !e.ctrlKey) return false; if (needMeta && !e.metaKey) return false; if (needMod && !(e.metaKey || e.ctrlKey)) return false; if (e.altKey && !needAlt) return false; if (e.shiftKey && !needShift) return false; if (e.ctrlKey && !needCtrl && !needMod) return false; if (e.metaKey && !needMeta && !needMod) return false; return true; } function handle(e) { registry.forEach(set => { set.forEach(entry => { if (match(e, entry.parts)) { if (entry.options.preventDefault !== false) e.preventDefault(); if (entry.options.stopPropagation) e.stopPropagation(); try { entry.handler(e); } catch (err) { console.error('[Mishkah.Hotkeys]', err); } } }); }); } function install() { if (installed) return; installed = true; document.addEventListener('keydown', handle, true); } function uninstallIfIdle() { if (!installed || registry.size > 0) return; document.removeEventListener('keydown', handle, true); installed = false; } function register(combo, handler, options = {}) { if (!combo || !isFn(handler)) return () => {}; const norm = normalize(combo); const entry = { combo: norm, handler, options, parts: parse(combo) }; if (!registry.has(norm)) registry.set(norm, new Set()); registry.get(norm).add(entry); install(); return () => { const set = registry.get(norm); if (set) { set.delete(entry); if (!set.size) registry.delete(norm); } uninstallIfIdle(); }; } function clear() { registry.clear(); uninstallIfIdle(); } return { register, clear, active: () => Array.from(registry.keys()) }; })();

  Comp.util.register('FocusTrap', FocusTrap);
  Comp.util.register('PortalRoot', PortalRoot);
  Comp.util.register('Currency', CurrencyUtil);
  Comp.util.register('Phone', PhoneUtil);
  Comp.util.register('Hotkeys', Hotkeys);
  
  M.Comp = Comp;

})(window);