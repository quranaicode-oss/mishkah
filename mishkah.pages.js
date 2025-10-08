(function (window) {
  'use strict';

  const M = window.Mishkah = window.Mishkah || {};
  const Templates = M.templates = M.templates || {};
  const U = M.utils = M.utils || {};
  const D = M.DSL;
  const UI = M.UI || {};
  const twApi = U.twcss || {};
  const tw = typeof twApi.tw === 'function' ? twApi.tw : (value) => value;

  /* ------------------------------------------------------------------ */
  /* Helpers                                                            */
  /* ------------------------------------------------------------------ */
  const isObj = (value) => value && typeof value === 'object' && !Array.isArray(value);
  const toArr = (value) => (value == null ? [] : Array.isArray(value) ? value : [value]);
  const ensureDict = (value) => (isObj(value) ? value : {});

  function normalizeLabel(entry) {
    const src = ensureDict(entry && (entry.label || entry.name || entry.title));
    if (typeof (entry && entry.label) === 'string') {
      return { ar: entry.label, en: entry.label };
    }
    if (typeof src === 'string') {
      return { ar: src, en: src };
    }
    const ar = typeof src.ar === 'string' ? src.ar : (typeof entry?.ar === 'string' ? entry.ar : null);
    const en = typeof src.en === 'string' ? src.en : (typeof entry?.en === 'string' ? entry.en : null);
    const title = typeof src.title === 'string' ? src.title : null;
    return {
      ar: ar || title || en || '',
      en: en || title || ar || ''
    };
  }

  function normalizePages(list) {
    return toArr(list).map((page, index) => {
      const obj = ensureDict(page);
      return {
        key: typeof obj.key === 'string' ? obj.key : (typeof obj.id === 'string' ? obj.id : `page-${index + 1}`),
        order: Number.isFinite(obj.order) ? obj.order : index,
        icon: typeof obj.icon === 'string' ? obj.icon : (typeof obj.emoji === 'string' ? obj.emoji : ''),
        label: normalizeLabel(obj),
        dsl: typeof obj.dsl === 'function' ? obj.dsl : null,
        comp: typeof obj.comp === 'string' ? obj.comp : null,
        orders: ensureDict(obj.orders)
      };
    });
  }

  function detectLang(pages) {
    let arCount = 0;
    let enCount = 0;
    const extra = new Set();
    pages.forEach((page) => {
      const label = ensureDict(page.label);
      Object.keys(label).forEach((key) => {
        if (typeof label[key] === 'string' && label[key].trim()) {
          if (key === 'ar') arCount += 1;
          else if (key === 'en') enCount += 1;
          extra.add(key);
        }
      });
    });
    const lang = arCount >= enCount ? 'ar' : 'en';
    const dir = lang === 'ar' ? 'rtl' : 'ltr';
    const fallback = lang === 'ar' ? 'en' : 'ar';
    const available = Array.from(extra);
    if (!available.includes(lang)) available.unshift(lang);
    if (!available.includes(fallback)) available.push(fallback);
    return { lang, dir, fallback, available: available.filter(Boolean) };
  }

  function mergeOrders() {
    const out = {};
    for (let i = 0; i < arguments.length; i += 1) {
      const source = arguments[i];
      if (!isObj(source)) continue;
      Object.keys(source).forEach((key) => {
        out[key] = source[key];
      });
    }
    return out;
  }

  /* ------------------------------------------------------------------ */
  /* Default header (v1)                                                */
  /* ------------------------------------------------------------------ */
  function DefaultHeader(db) {
    const theme = db?.env?.theme || 'light';
    const lang = db?.env?.lang || 'ar';
    if (UI && typeof UI.Toolbar === 'function') {
      return UI.Toolbar({
        left: [D.Text.Strong({}, [db?.head?.title || 'Mishkah'])],
        right: [
          typeof UI.ThemeToggleIcon === 'function' ? UI.ThemeToggleIcon({ theme }) : null,
          typeof UI.LanguageSwitch === 'function' ? UI.LanguageSwitch({ lang }) : null
        ].filter(Boolean)
      });
    }
    return D.Containers.Header({ attrs: { class: tw`flex items-center justify-between gap-3 p-3` } }, [
      D.Containers.Div({}, [D.Text.Strong({}, [db?.head?.title || 'Mishkah'])]),
      D.Containers.Div({ attrs: { class: tw`flex items-center gap-2` } }, [
        typeof UI.ThemeToggleIcon === 'function' ? UI.ThemeToggleIcon({ theme }) : null,
        typeof UI.LanguageSwitch === 'function' ? UI.LanguageSwitch({ lang }) : null
      ].filter(Boolean))
    ]);
  }
  const __DefaultHeader = DefaultHeader;

  function buildDB(config) {
    const cfg = Object.assign({
      title: null,
      theme: null,
      lang: null,
      dir: null,
      pages: [],
      active: null,
      themeLab: { enabled: true },
      registry: {},
      slots: {},
      env: {}
    }, config || {});

    const pagesNorm = normalizePages(cfg.pages);
    const langInfo = detectLang(pagesNorm);
    const lang = typeof cfg.lang === 'string' ? cfg.lang : (typeof cfg.env?.lang === 'string' ? cfg.env.lang : langInfo.lang);
    const dir = typeof cfg.dir === 'string' ? cfg.dir : (typeof cfg.env?.dir === 'string' ? cfg.env.dir : langInfo.dir);
    const theme = cfg.theme === 'dark' || cfg.env?.theme === 'dark' ? 'dark' : 'light';
    const title = cfg.title || cfg.env?.title || pagesNorm[0]?.label?.[lang] || 'Mishkah App';

    const database = {
      head: { title },
      env: Object.assign({}, cfg.env || {}, { theme, lang, dir }),
      i18n: {
        lang,
        fallback: langInfo.fallback,
        available: langInfo.available.length ? Array.from(new Set(langInfo.available)) : [lang, langInfo.fallback]
      },
      data: {
        pages: pagesNorm,
        active: cfg.active || pagesNorm[0]?.key || null,
        themeOverrides: {},
        themeLab: Object.assign({ enabled: true }, ensureDict(cfg.themeLab)),
        registry: ensureDict(cfg.registry),
        slots: ensureDict(cfg.slots)
      },
      registry: ensureDict(cfg.registry),
      slots: ensureDict(cfg.slots)
    };

    return database;
  }

  /* ------------------------------------------------------------------ */
  /* Public API — V1                                                    */
  /* ------------------------------------------------------------------ */
  function create(options) {
    const cfg = Object.assign({
      template: 'pageshell',
      theme: 'light',
      pages: [],
      active: null,
      title: null,
      themeLab: { enabled: true },
      registry: {},
      slots: {},
      orders: {},
      mount: '#app'
    }, options || {});

    const database = buildDB(cfg);

    if (!database.slots?.header) {
      database.registry = Object.assign({}, database.registry, { __DefaultHeader });
      database.slots = Object.assign({}, database.slots, { header: '__DefaultHeader' });
    }

    const templateModule = Templates.PagesShell;
    if (!templateModule || typeof templateModule.render !== 'function') {
      throw new Error('[Mishkah.Pages] Templates.PagesShell is required. Make sure template/pages-shell.js is loaded.');
    }
    M.app.setBody(templateModule.render);

    const app = M.app.createApp(database, {});
    const auto = typeof twApi.auto === 'function' ? twApi.auto(database, app) : { orders: {} };
    const shellOrders = typeof templateModule.createOrders === 'function' ? templateModule.createOrders(database) : {};
    const pageOrders = normalizePages(cfg.pages).reduce((acc, page) => Object.assign(acc, page.orders || {}), {});
    const uiOrders = ensureDict(UI.orders);
    const extraOrders = ensureDict(cfg.orders);

    app.setOrders(mergeOrders(shellOrders, uiOrders, auto.orders, pageOrders, extraOrders));
    app.mount(cfg.mount);
    return app;
  }

  /* ------------------------------------------------------------------ */
  /* Templates registry helpers                                         */
  /* ------------------------------------------------------------------ */
  function listTemplates() {
    const registry = M.templates || {};
    const names = Object.keys(registry);
    const out = [];
    names.forEach((id) => {
      const mod = registry[id];
      if (!mod || typeof mod.render !== 'function') return;
      const meta = ensureDict(mod.meta);
      out.push({
        id,
        icon: typeof meta.icon === 'string' ? meta.icon : '🧩',
        label: ensureDict(meta.label),
        title: typeof meta.title === 'string' ? meta.title : id
      });
    });
    if (!out.length && Templates.PagesShell && typeof Templates.PagesShell.render === 'function') {
      out.push({ id: 'PagesShell', icon: '🧩', label: { ar: 'PagesShell', en: 'PagesShell' } });
    }
    return out;
  }

  function templateLabel(metaLabel, lang, fallbackId) {
    if (!metaLabel) return fallbackId;
    if (typeof metaLabel === 'string') return metaLabel;
    return metaLabel[lang] || metaLabel.en || metaLabel.ar || fallbackId;
  }

  /* ------------------------------------------------------------------ */
  /* Dynamic render (V2)                                                */
  /* ------------------------------------------------------------------ */
  function DynamicTemplateRender(db) {
    const current = db?.env?.template || 'PagesShell';
    const mod = Templates[current] || Templates[current?.toLowerCase?.()] || Templates.PagesShell;
    if (!mod || typeof mod.render !== 'function') {
      return D.Text.P({}, [`Template not found: ${current}`]);
    }

    const useDefaults = !!db?.ui?.templates?.useDefaultPages;
    const hasPages = Array.isArray(db?.data?.pages) && db.data.pages.length > 0;
    let pages = db?.data?.pages || [];
    let active = db?.data?.active || null;

    if (useDefaults && !hasPages && typeof mod.defaultPages === 'function') {
      const defaults = mod.defaultPages(db) || [];
      if (defaults.length) {
        pages = normalizePages(defaults);
        active = active || pages[0]?.key || null;
      }
    }

    const patchedDb = Object.assign({}, db, {
      data: Object.assign({}, db.data || {}, { pages, active })
    });
    return mod.render(patchedDb);
  }

  /* ------------------------------------------------------------------ */
  /* Auto header (V2)                                                    */
  /* ------------------------------------------------------------------ */
  function AutoHeaderV2(db) {
    const lang = db?.env?.lang || 'ar';
    const theme = db?.env?.theme || 'light';
    const current = db?.env?.template || 'PagesShell';
    const templates = (db?.ui?.templates?.available || listTemplates()).map((entry) =>
      (typeof entry === 'string' ? { id: entry } : entry)
    );

    const switcherItems = templates.map((tpl) => ({
      id: tpl.id,
      label: templateLabel(tpl.label, lang, tpl.id),
      icon: tpl.icon || '🧩'
    }));

    const leftSide = [D.Text.Strong({}, [db?.head?.title || 'Mishkah'])];

    const switcher = (function buildSwitcher() {
      if (typeof UI.Segmented === 'function') {
        return UI.Segmented({
          items: switcherItems.map((tpl) => ({
            id: tpl.id,
            label: `${tpl.icon ? `${tpl.icon} ` : ''}${tpl.label}`,
            gkey: 'ui:template:set',
            attrs: { 'data-template': tpl.id }
          })),
          activeId: current
        });
      }
      if (typeof UI.Tabs === 'function') {
        return UI.Tabs({
          items: switcherItems.map((tpl) => ({
            id: tpl.id,
            label: `${tpl.icon ? `${tpl.icon} ` : ''}${tpl.label}`,
            content: () => D.Containers.Div({ attrs: { class: tw`p-3` } }, [
              D.Text.Span({}, [tpl.label])
            ])
          })),
          activeId: current,
          gkey: 'ui:template:set'
        });
      }
      const buttons = switcherItems.map((tpl) => UI.Button({
        attrs: {
          gkey: 'ui:template:set',
          'data-template': tpl.id,
          class: tw`${tpl.id === current ? 'font-semibold underline' : ''}`
        },
        variant: tpl.id === current ? 'solid' : 'ghost',
        size: 'sm'
      }, [`${tpl.icon ? `${tpl.icon} ` : ''}${tpl.label}`]));
      return D.Containers.Div({ attrs: { class: tw`flex items-center gap-2` } }, buttons);
    }());

    const themeToggle = typeof UI.ThemeToggleIcon === 'function'
      ? UI.ThemeToggleIcon({ theme })
      : D.Text.Span({}, ['theme']);
    const langToggle = typeof UI.LanguageSwitch === 'function'
      ? UI.LanguageSwitch({ lang })
      : D.Text.Span({}, ['lang']);

    const rightSide = [switcher, themeToggle, langToggle].filter(Boolean);

    if (typeof UI.Toolbar === 'function') {
      return UI.Toolbar({ left: leftSide, right: rightSide });
    }
    return D.Containers.Header({ attrs: { class: tw`flex items-center justify-between gap-3 p-3` } }, [
      D.Containers.Div({}, leftSide),
      D.Containers.Div({ attrs: { class: tw`flex items-center gap-2` } }, rightSide)
    ]);
  }
  const __AutoHeaderV2 = AutoHeaderV2;

  /* ------------------------------------------------------------------ */
  /* Orders (V2)                                                         */
  /* ------------------------------------------------------------------ */
  function createSystemOrdersV2() {
    function getAvailable(state) {
      const list = state?.ui?.templates?.available;
      if (Array.isArray(list) && list.length) {
        return list.map((item) => (typeof item === 'string' ? { id: item } : item));
      }
      return listTemplates();
    }

    function findIndex(avail, id) {
      if (!Array.isArray(avail) || !avail.length) return -1;
      return avail.findIndex((entry) => (entry.id || entry) === id);
    }

    function normalizeId(source) {
      if (!source) return null;
      if (typeof source === 'string') return source;
      if (typeof source.value === 'string' && source.value) return source.value;
      if (source.dataset) {
        return source.dataset.template || source.dataset.tabId || source.dataset.segmentId || source.dataset.value || null;
      }
      if (typeof source.getAttribute === 'function') {
        return source.getAttribute('data-template') || source.getAttribute('data-tab-id') || null;
      }
      return null;
    }

    function applyDefaults(nextId, state) {
      if (!state?.ui?.templates?.useDefaultPages) return null;
      const mod = Templates[nextId] || Templates[nextId?.toLowerCase?.()];
      if (mod && typeof mod.defaultPages === 'function') {
        const defs = mod.defaultPages(state) || [];
        return normalizePages(defs);
      }
      return null;
    }

    function setTemplate(ctx, nextId) {
      if (!nextId) return;
      ctx.setState((state) => {
        const defaults = applyDefaults(nextId, state);
        const pages = defaults || state.data?.pages || [];
        const active = defaults && defaults.length ? (defaults[0]?.key || null) : state.data?.active || null;
        return Object.assign({}, state, {
          env: Object.assign({}, state.env || {}, { template: nextId }),
          data: Object.assign({}, state.data || {}, { pages, active })
        });
      });
      ctx.rebuild();
    }

    return {
      'ui:template:set': {
        on: ['click', 'change'],
        gkeys: ['ui:template:set'],
        handler: (event, ctx) => {
          const el = event?.target?.closest ? (event.target.closest('[data-template]') || event.target) : event.target;
          const next = normalizeId(el);
          setTemplate(ctx, next);
        }
      },
      'ui:template:next': {
        on: ['click'],
        gkeys: ['ui:template:next'],
        handler: (_event, ctx) => {
          ctx.setState((state) => {
            const avail = getAvailable(state);
            if (!avail.length) return state;
            const current = state?.env?.template || (avail[0].id || avail[0]);
            const idx = findIndex(avail, current);
            const nextIdx = (idx + 1) % avail.length;
            const nextId = avail[nextIdx].id || avail[nextIdx];
            const defaults = applyDefaults(nextId, state);
            const pages = defaults || state.data?.pages || [];
            const active = defaults && defaults.length ? (defaults[0]?.key || null) : state.data?.active || null;
            return Object.assign({}, state, {
              env: Object.assign({}, state.env || {}, { template: nextId }),
              data: Object.assign({}, state.data || {}, { pages, active })
            });
          });
          ctx.rebuild();
        }
      },
      'ui:template:prev': {
        on: ['click'],
        gkeys: ['ui:template:prev'],
        handler: (_event, ctx) => {
          ctx.setState((state) => {
            const avail = getAvailable(state);
            if (!avail.length) return state;
            const current = state?.env?.template || (avail[0].id || avail[0]);
            const idx = findIndex(avail, current);
            const nextIdx = (idx - 1 + avail.length) % avail.length;
            const nextId = avail[nextIdx].id || avail[nextIdx];
            const defaults = applyDefaults(nextId, state);
            const pages = defaults || state.data?.pages || [];
            const active = defaults && defaults.length ? (defaults[0]?.key || null) : state.data?.active || null;
            return Object.assign({}, state, {
              env: Object.assign({}, state.env || {}, { template: nextId }),
              data: Object.assign({}, state.data || {}, { pages, active })
            });
          });
          ctx.rebuild();
        }
      },
      'templates:defaults:toggle': {
        on: ['click'],
        gkeys: ['templates:defaults:toggle'],
        handler: (_event, ctx) => {
          ctx.setState((state) => {
            const current = state?.ui?.templates?.useDefaultPages;
            const next = !current;
            const uiState = Object.assign({}, state.ui || {}, {
              templates: Object.assign({}, state.ui?.templates || {}, { useDefaultPages: next })
            });
            return Object.assign({}, state, { ui: uiState });
          });
          ctx.rebuild();
        }
      },
      'templates:defaults:apply': {
        on: ['click'],
        gkeys: ['templates:defaults:apply'],
        handler: (_event, ctx) => {
          ctx.setState((state) => {
            const templateId = state?.env?.template || 'PagesShell';
            const mod = Templates[templateId] || Templates[templateId?.toLowerCase?.()];
            if (!mod || typeof mod.defaultPages !== 'function') return state;
            const defs = normalizePages(mod.defaultPages(state) || []);
            if (!defs.length) return state;
            return Object.assign({}, state, {
              data: Object.assign({}, state.data || {}, {
                pages: defs,
                active: defs[0]?.key || state.data?.active || null
              })
            });
          });
          ctx.rebuild();
        }
      }
    };
  }

  /* ------------------------------------------------------------------ */
  /* Public API — V2                                                     */
  /* ------------------------------------------------------------------ */
  function createV2(options) {
    const cfg = Object.assign({
      template: 'PagesShell',
      themes: undefined,
      theme: undefined,
      useDefaultPages: false,
      autoHeader: true,
      mount: '#app'
    }, options || {});

    const database = buildDB(cfg);
    const available = listTemplates();

    database.env = Object.assign({}, database.env || {}, { template: cfg.template || 'PagesShell' });
    database.ui = Object.assign({}, database.ui || {}, {
      templates: {
        available,
        useDefaultPages: !!cfg.useDefaultPages
      }
    });

    if (cfg.autoHeader && !database.slots?.header) {
      database.registry = Object.assign({}, database.registry, { __AutoHeaderV2 });
      database.slots = Object.assign({}, database.slots, { header: '__AutoHeaderV2' });
    }

    M.app.setBody(DynamicTemplateRender);

    const app = M.app.createApp(database, {});
    const auto = typeof twApi.auto === 'function' ? twApi.auto(database, app) : { orders: {} };

    const templateOrders = available.reduce((acc, tpl) => {
      const id = tpl.id || tpl;
      const mod = Templates[id];
      if (mod && typeof mod.createOrders === 'function') {
        Object.assign(acc, mod.createOrders(database) || {});
      }
      return acc;
    }, {});

    const pageOrders = toArr(cfg.pages).reduce((acc, page) => Object.assign(acc, ensureDict(page).orders || {}), {});
    const uiOrders = ensureDict(UI.orders);
    const systemOrders = createSystemOrdersV2();
    const extraOrders = ensureDict(cfg.orders);

    app.setOrders(mergeOrders(auto.orders, templateOrders, uiOrders, pageOrders, systemOrders, extraOrders));
    app.mount(cfg.mount);
    return app;
  }

  M.Pages = Object.assign(M.Pages || {}, { create, createV2, buildDB });
}(typeof window !== 'undefined' ? window : this));
