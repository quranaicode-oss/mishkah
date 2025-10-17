(function (global) {
  'use strict';

  if (global.MishkahAuto && global.MishkahAuto.__version) {
    return;
  }

  var doc = global.document;
  if (!doc) return;

  var currentScript = doc.currentScript;
  if (!currentScript) {
    var scripts = doc.getElementsByTagName('script');
    for (var i = scripts.length - 1; i >= 0; i -= 1) {
      var candidate = scripts[i];
      if (!candidate || !candidate.src) continue;
      if (candidate.src.indexOf('mishkah.js') !== -1) {
        currentScript = candidate;
        break;
      }
    }
  }

  var baseUrl = '';
  if (currentScript && currentScript.src) {
    var src = currentScript.src;
    var queryIndex = src.indexOf('?');
    if (queryIndex !== -1) src = src.slice(0, queryIndex);
    baseUrl = src.replace(/[^\/]*$/, '');
  }
  global.__MISHKAH_BASE__ = baseUrl;

  function mapCssLibrary(name) {
    if (!name) return null;
    var normalized = String(name).trim().toLowerCase();
    if (normalized === 'mishkah' || normalized === 'mi' || normalized === 'mk' || normalized === 'mishkah-css') return 'mi';
    if (normalized === 'tailwind' || normalized === 'tw' || normalized === 'tailwindcss' || normalized === 'tailwind-css') return 'tw';
    return normalized || null;
  }

  function parseDatasetFlag(value, fallback) {
    if (value == null || value === '') return fallback;
    var normalized = String(value).toLowerCase();
    if (normalized === 'false' || normalized === '0' || normalized === 'off') return false;
    if (normalized === 'true' || normalized === '1' || normalized === 'on') return true;
    return fallback;
  }

  function parseDatasetValue(name, fallback) {
    if (!currentScript) return fallback;
    var data = currentScript.dataset || {};
    if (!Object.prototype.hasOwnProperty.call(data, name)) return fallback;
    var value = data[name];
    if (value == null) return fallback;
    var trimmed = String(value).trim();
    if (!trimmed) return fallback;
    return trimmed;
  }

  var userConfig = global.MishkahAutoConfig || {};
  var autoFlag = parseDatasetFlag(parseDatasetValue('auto', null), undefined);
  var autoEnabled = (typeof autoFlag === 'boolean') ? autoFlag
    : (typeof userConfig.auto === 'boolean' ? userConfig.auto : true);

  var cssOption = parseDatasetValue('css', null);
  if (!cssOption && userConfig.css) cssOption = String(userConfig.css);
  cssOption = cssOption || 'mishkah';
  global.__MISHKAH_DEFAULT_CSS__ = mapCssLibrary(cssOption) || 'mi';
  if (!global.__MISHKAH_ACTIVE_CSS__) {
    global.__MISHKAH_ACTIVE_CSS__ = global.__MISHKAH_DEFAULT_CSS__;
  }

  var tailwindFlag = parseDatasetFlag(parseDatasetValue('tailwind', null), undefined);
  var tailwindEnabled = (typeof tailwindFlag === 'boolean') ? tailwindFlag
    : (typeof userConfig.tailwind === 'boolean' ? userConfig.tailwind : true);

  function joinBase(path, fallback) {
    if (path && /^(https?:)?\/\//i.test(path)) return path;
    if (path && path.charAt(0) === '/') return path;
    return (baseUrl || fallback || '') + (path || '');
  }

  var paths = userConfig.paths || {};
  var resources = [
    {
      id: 'mishkah-utils',
      src: joinBase(paths.utils || 'mishkah-utils.js'),
      test: function () { return global.Mishkah && global.Mishkah.utils; }
    },
    {
      id: 'mishkah-core',
      src: joinBase(paths.core || 'mishkah.core.js'),
      test: function () { return global.Mishkah && global.Mishkah.app; }
    },
    {
      id: 'mishkah-ui',
      src: joinBase(paths.ui || 'mishkah-ui.js'),
      test: function () { return global.Mishkah && global.Mishkah.UI; }
    },
    {
      id: 'mishkah-acorn',
      src: joinBase(paths.acorn || 'https://cdn.jsdelivr.net/npm/acorn@8.15.0/dist/acorn.min.js'),
      test: function () { return !!global.acorn; }
    },
    {
      id: 'mishkah-acorn-walk',
      src: joinBase(paths.acornWalk || 'https://cdn.jsdelivr.net/npm/acorn-walk@8.3.4/dist/walk.min.js'),
      test: function () { return !!(global.acornWalk || (global.acorn && global.acorn.walk)); },
      onLoad: function () {
        if (!global.acornWalk && global.acorn && global.acorn.walk) {
          global.acornWalk = global.acorn.walk;
        }
      }
    },
    {
      id: 'mishkah-htmlx',
      src: joinBase(paths.htmlx || 'mishkah-htmlx.js'),
      test: function () {
        return global.Mishkah && (global.Mishkah.HTMLxAgent || (global.Mishkah.HTMLx && global.Mishkah.HTMLx.Agent));
      }
    }
  ];

  var cssHref = joinBase(paths.css || 'mishkah-css.css');

  function ensureScript(entry) {
    if (!entry || !entry.src) return Promise.resolve(false);
    if (entry.test && entry.test()) {
      if (typeof entry.onLoad === 'function') {
        try { entry.onLoad(); }
        catch (err) { setTimeout(function () { throw err; }, 0); }
      }
      return Promise.resolve(true);
    }
    return new Promise(function (resolve, reject) {
      var existing = entry.id ? doc.getElementById(entry.id) : null;
      if (existing) {
        var readyAttr = existing.getAttribute('data-ready');
        if (readyAttr === '1') {
          if (typeof entry.onLoad === 'function') {
            try { entry.onLoad(); }
            catch (err) { setTimeout(function () { throw err; }, 0); }
          }
          resolve(true);
          return;
        }
        existing.addEventListener('load', function () {
          if (typeof entry.onLoad === 'function') {
            try { entry.onLoad(); }
            catch (err) { setTimeout(function () { throw err; }, 0); }
          }
          resolve(true);
        }, { once: true });
        existing.addEventListener('error', function (event) { reject(new Error('Failed to load script ' + entry.src)); }, { once: true });
        return;
      }
      var script = doc.createElement('script');
      if (entry.id) script.id = entry.id;
      script.src = entry.src;
      script.async = false;
      script.setAttribute('data-mishkah-auto', '1');
      script.addEventListener('load', function () {
        script.setAttribute('data-ready', '1');
        if (typeof entry.onLoad === 'function') {
          try { entry.onLoad(); }
          catch (err) { setTimeout(function () { throw err; }, 0); }
        }
        resolve(true);
      }, { once: true });
      script.addEventListener('error', function (event) {
        reject(new Error('Failed to load script ' + entry.src));
      }, { once: true });
      doc.head.appendChild(script);
    });
  }

  function ensureStyle(href, id) {
    if (!href) return null;
    var existing = id ? doc.getElementById(id) : null;
    if (existing) return existing;
    var link = doc.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    if (id) link.id = id;
    link.setAttribute('data-mishkah-auto', '1');
    doc.head.appendChild(link);
    return link;
  }

  function loadSequential(list, index) {
    if (index === void 0) index = 0;
    if (!list || index >= list.length) return Promise.resolve(true);
    return ensureScript(list[index]).then(function () {
      return loadSequential(list, index + 1);
    });
  }

  function createDeferred() {
    var resolve, reject;
    var promise = new Promise(function (res, rej) {
      resolve = res;
      reject = rej;
    });
    return { promise: promise, resolve: resolve, reject: reject };
  }

  var autoState = {
    __version: '1.0.0',
    config: {
      auto: autoEnabled,
      css: cssOption,
      tailwind: tailwindEnabled,
      baseUrl: baseUrl
    },
    app: null,
    listeners: new Set(),
    pendingOps: [],
    currentState: null,
    readyDeferred: createDeferred(),
    readyResolved: false,
    waitingForMake: false
  };

  var twcssAutoWarned = false;

  function toList(input) {
    if (input == null) return [];
    if (Array.isArray(input)) return input;
    return String(input).split(/[\s,;|]+/).map(function (part) { return part.trim(); }).filter(Boolean);
  }

  var RTL_LANGS = new Set(['ar', 'fa', 'ur', 'he']);
  var LANG_LABELS = Object.assign({
    ar: '\u0627\u0644\u0639\u0631\u0628\u064a\u0629',
    en: 'English',
    fr: 'Français',
    tr: 'Türkçe',
    du: 'Dutch',
    de: 'Deutsch',
    es: 'Español',
    id: 'Bahasa',
    ur: '\u0627\u0631\u062f\u0648',
    fa: '\u0641\u0627\u0631\u0633\u06cc'
  }, userConfig.langLabels || {});

  var THEME_LABELS = Object.assign({
    light: '\u0646\u0647\u0627\u0631\u064a',
    dark: '\u0644\u064a\u0644\u064a',
    dawn: '\u0641\u062c\u0631',
    oasis: '\u0648\u0627\u062d\u0629',
    sunny: 'Sunny',
    dusk: 'Dusk',
    midnight: 'Midnight',
    ping: 'Ping'
  }, userConfig.themeLabels || {});

  function formatLabel(dictionary, key) {
    if (!key) return '';
    var normalized = String(key).toLowerCase();
    if (dictionary[normalized]) return dictionary[normalized];
    return normalized.replace(/(^|[-_\s])([a-z\u0621-\u064a])/gi, function (_, space, char) {
      return (space ? ' ' : '') + char.toUpperCase();
    });
  }

  function broadcast(state) {
    autoState.currentState = state;
    autoState.listeners.forEach(function (listener) {
      try { listener(state); }
      catch (err) {
        if (global.console && console.error) console.error('[MishkahAuto] listener failed', err);
      }
    });
  }

  function runOrQueue(operation) {
    if (autoState.app) {
      operation(autoState.app);
    } else {
      autoState.pendingOps.push(operation);
    }
  }

  function normalizeLang(code) {
    if (!code) return null;
    return String(code).split(/[^a-zA-Z\u0621-\u064a0-9]+/)[0].toLowerCase();
  }

  function setDocumentLang(lang, dir) {
    if (!doc || !doc.documentElement) return;
    if (lang) doc.documentElement.lang = lang;
    if (dir) doc.documentElement.dir = dir;
  }

  function performSetLang(lang) {
    var normalized = normalizeLang(lang);
    if (!normalized) return;
    var dir = RTL_LANGS.has(normalized) ? 'rtl' : 'ltr';
    runOrQueue(function (app) {
      try {
        var M = global.Mishkah;
        if (M && M.utils && M.utils.twcss && typeof M.utils.twcss.setDir === 'function') {
          M.utils.twcss.setDir(dir);
        }
      } catch (err) {
        if (global.console && console.warn) console.warn('[MishkahAuto] setDir failed', err);
      }
      setDocumentLang(normalized, dir);
      app.setState(function (state) {
        var next = Object.assign({}, state || {});
        var env = Object.assign({}, next.env || {});
        env.lang = normalized;
        env.dir = dir;
        next.env = env;
        if (next.i18n) {
          next.i18n = Object.assign({}, next.i18n, { lang: normalized });
        }
        return next;
      });
      broadcast(app.getState());
    });
  }

  function performSetTheme(theme) {
    if (!theme) return;
    var normalized = String(theme).trim();
    if (!normalized) return;
    normalized = normalized.toLowerCase();
    runOrQueue(function (app) {
      try {
        var M = global.Mishkah;
        if (M && M.utils && M.utils.twcss && typeof M.utils.twcss.setTheme === 'function') {
          M.utils.twcss.setTheme(normalized);
        } else if (doc && doc.documentElement) {
          doc.documentElement.setAttribute('data-theme', normalized);
        }
      } catch (err) {
        if (global.console && console.warn) console.warn('[MishkahAuto] setTheme failed', err);
      }
      app.setState(function (state) {
        var next = Object.assign({}, state || {});
        var env = Object.assign({}, next.env || {});
        env.theme = normalized;
        next.env = env;
        return next;
      });
      broadcast(app.getState());
    });
  }

  function attachApp(app) {
    if (!app || autoState.app === app) return;
    autoState.app = app;
    if (!app.__mishkahAutoPatched) {
      var originalSetState = app.setState;
      app.setState = function (updater) {
        var result = originalSetState.call(app, updater);
        try { broadcast(app.getState()); }
        catch (err) {
          if (global.console && console.warn) console.warn('[MishkahAuto] broadcast failed', err);
        }
        return result;
      };
      app.__mishkahAutoPatched = true;
    }
    while (autoState.pendingOps.length) {
      var op = autoState.pendingOps.shift();
      try { op(app); } catch (err) {
        if (global.console && console.error) console.error('[MishkahAuto] pending op failed', err);
      }
    }
    try {
      var initial = app.getState ? app.getState() : null;
      if (initial) broadcast(initial);
    } catch (err) {
      if (global.console && console.warn) console.warn('[MishkahAuto] unable to read initial state', err);
    }
  }

  function onState(listener) {
    if (typeof listener !== 'function') return function () { };
    autoState.listeners.add(listener);
    if (autoState.currentState) {
      try { listener(autoState.currentState); }
      catch (err) {
        if (global.console && console.warn) console.warn('[MishkahAuto] listener immediate run failed', err);
      }
    }
    return function () { autoState.listeners.delete(listener); };
  }

  function ensureComponentStyles() {
    if (doc.getElementById('mishkah-scaffold-styles')) return;
    var style = doc.createElement('style');
    style.id = 'mishkah-scaffold-styles';
    style.setAttribute('data-mishkah-auto', '1');
    style.textContent = "" +
      '.mk-switcher{display:inline-flex;align-items:center;gap:var(--mk-space-1,0.25rem);padding:var(--mk-space-1,0.25rem);' +
      'border:1px solid var(--mk-border,rgba(148,163,184,0.35));border-radius:999px;background:var(--mk-surface-1,rgba(148,163,184,0.12));' +
      'box-shadow:var(--mk-shadow-soft,0 12px 24px rgba(15,23,42,0.12));transition:background 160ms var(--mk-ease,ease-out);}' +
      '.mk-switcher__btn{position:relative;display:inline-flex;align-items:center;justify-content:center;min-width:2.6rem;' +
      'padding:0.35rem 0.85rem;border-radius:999px;font-size:0.85rem;font-weight:600;border:none;background:transparent;' +
      'color:var(--mk-muted,#94a3b8);transition:color 160ms var(--mk-ease,ease-out),background 160ms var(--mk-ease,ease-out),transform 150ms var(--mk-ease,ease-out);}' +
      '.mk-switcher__btn:hover{color:var(--mk-fg,#e2e8f0);}' +
      '.mk-switcher__btn.is-active{background:var(--mk-primary,#2aa5a0);color:var(--mk-primary-contrast,#071314);box-shadow:0 10px 30px rgba(42,165,160,0.35);transform:translateY(-1px);}' +
      '.mk-select{display:inline-flex;align-items:center;gap:var(--mk-space-2,0.5rem);padding:0.45rem 0.75rem;border-radius:var(--mk-radius-md,0.75rem);' +
      'border:1px solid var(--mk-border,rgba(148,163,184,0.35));background:var(--mk-surface-0,rgba(15,23,42,0.55));color:var(--mk-fg,#e2e8f0);' +
      'font-size:0.9rem;min-width:6.5rem;box-shadow:var(--mk-shadow-soft,0 12px 24px rgba(15,23,42,0.12));transition:border 150ms var(--mk-ease,ease-out),box-shadow 150ms var(--mk-ease,ease-out);}' +
      '.mk-select:focus{outline:none;border-color:color-mix(in oklab,var(--mk-primary,#2aa5a0) 60%, transparent);box-shadow:0 0 0 3px color-mix(in oklab,var(--mk-primary,#2aa5a0) 25%, transparent);}' +
      '.mk-label{display:inline-flex;flex-direction:column;gap:var(--mk-space-1,0.25rem);font-size:0.75rem;color:var(--mk-muted,#94a3b8);}' +
      '.mk-switcher__hint{font-size:0.7rem;color:var(--mk-muted,#94a3b8);margin-inline-start:0.35rem;}' +
      '.mk-select option{color:inherit;background:var(--mk-surface-0,#0f172a);}' +
      '.mk-switcher--themes .mk-switcher__btn{min-width:3.1rem;}' +
      '';
    doc.head.appendChild(style);
  }

  function parseLangsAttr(node, limit) {
    var attr = node.getAttribute('langs');
    var list = attr ? toList(attr) : [];
    if (!list.length && Array.isArray(userConfig.defaultLangs)) {
      list = userConfig.defaultLangs.slice();
    }
    if (!list.length) list = ['ar', 'en'];
    var seen = new Set();
    var normalized = [];
    list.forEach(function (lang) {
      var key = normalizeLang(lang);
      if (!key || seen.has(key)) return;
      seen.add(key);
      normalized.push(key);
    });
    if (typeof limit === 'number' && normalized.length > limit) {
      normalized.length = limit;
    }
    return normalized;
  }

  function parseThemesAttr(node, fallback) {
    var attr = node.getAttribute('themes');
    var list = attr ? toList(attr) : [];
    if (!list.length && Array.isArray(userConfig.defaultThemes)) {
      list = userConfig.defaultThemes.slice();
    }
    if (!list.length && Array.isArray(fallback)) list = fallback.slice();
    if (!list.length) list = ['light', 'dark'];
    var seen = new Set();
    var normalized = [];
    list.forEach(function (theme) {
      var key = String(theme || '').toLowerCase();
      if (!key || seen.has(key)) return;
      seen.add(key);
      normalized.push(key);
    });
    return normalized;
  }

  function makeButton(label, value, clickHandler) {
    var btn = doc.createElement('button');
    btn.type = 'button';
    btn.className = 'mk-switcher__btn';
    btn.textContent = label;
    btn.dataset.value = value;
    btn.addEventListener('click', clickHandler);
    return btn;
  }

  function makeSelect(options, valueChange, role) {
    var select = doc.createElement('select');
    select.className = 'mk-select';
    if (role) select.setAttribute('aria-label', role);
    options.forEach(function (entry) {
      var option = doc.createElement('option');
      option.value = entry.value;
      option.textContent = entry.label;
      select.appendChild(option);
    });
    select.addEventListener('change', function (event) {
      valueChange(event.target.value);
    });
    return select;
  }

  function defineComponent(name, ctor) {
    if (!global.customElements || !name) return;
    if (global.customElements.get(name)) return;
    try {
      global.customElements.define(name, ctor);
    } catch (err) {
      if (global.console && console.warn) console.warn('[MishkahAuto] failed to define component', name, err);
    }
  }

  function BaseComponent() {
    var self = Reflect.construct(HTMLElement, [], this.constructor);
    self.__cleanup = null;
    self.__connected = false;
    return self;
  }
  BaseComponent.prototype = Object.create(HTMLElement.prototype);
  BaseComponent.prototype.constructor = BaseComponent;
  BaseComponent.prototype.connectedCallback = function () {
    this.__connected = true;
    ensureComponentStyles();
    this.render();
    var self = this;
    this.__cleanup = onState(function () { self.sync(); });
  };
  BaseComponent.prototype.disconnectedCallback = function () {
    this.__connected = false;
    if (typeof this.__cleanup === 'function') this.__cleanup();
    this.__cleanup = null;
  };
  BaseComponent.prototype.attributeChangedCallback = function () {
    if (!this.__connected) return;
    this.render();
  };
  BaseComponent.prototype.render = function () { };
  BaseComponent.prototype.sync = function () { };

  function LangSwitcher() {
    return BaseComponent.call(this) || this;
  }
  LangSwitcher.prototype = Object.create(BaseComponent.prototype);
  LangSwitcher.prototype.constructor = LangSwitcher;
  LangSwitcher.observedAttributes = ['langs'];
  LangSwitcher.prototype.render = function () {
    var _this = this;
    var languages = parseLangsAttr(this, 2);
    this.innerHTML = '';
    var wrapper = doc.createElement('div');
    wrapper.className = 'mk-switcher mk-switcher--langs';
    this._buttons = [];
    languages.forEach(function (lang) {
      var button = makeButton(formatLabel(LANG_LABELS, lang), lang, function () {
        performSetLang(lang);
      });
      _this._buttons.push(button);
      wrapper.appendChild(button);
    });
    if (!languages.length) {
      var fallback = makeButton('AR', 'ar', function () { performSetLang('ar'); });
      this._buttons.push(fallback);
      wrapper.appendChild(fallback);
    }
    this.appendChild(wrapper);
    this.sync();
  };
  LangSwitcher.prototype.sync = function () {
    var state = autoState.currentState;
    if (!state || !this._buttons) return;
    var current = (state.env && state.env.lang) || (state.i18n && state.i18n.lang) || null;
    this._buttons.forEach(function (button) {
      var active = button.dataset.value === current;
      if (active) button.classList.add('is-active');
      else button.classList.remove('is-active');
    });
  };

  function LangSelect() {
    return BaseComponent.call(this) || this;
  }
  LangSelect.prototype = Object.create(BaseComponent.prototype);
  LangSelect.prototype.constructor = LangSelect;
  LangSelect.observedAttributes = ['langs'];
  LangSelect.prototype.render = function () {
    var languages = parseLangsAttr(this);
    var options = languages.map(function (lang) {
      return { value: lang, label: formatLabel(LANG_LABELS, lang) };
    });
    if (!options.length) {
      options = [
        { value: 'ar', label: formatLabel(LANG_LABELS, 'ar') },
        { value: 'en', label: formatLabel(LANG_LABELS, 'en') }
      ];
    }
    this.innerHTML = '';
    var labelText = this.getAttribute('label') || '';
    var container = doc.createElement('label');
    container.className = labelText ? 'mk-label' : '';
    if (labelText) {
      var title = doc.createElement('span');
      title.textContent = labelText;
      container.appendChild(title);
    }
    var select = makeSelect(options, function (value) {
      performSetLang(value);
    }, labelText || 'Language');
    this._select = select;
    container.appendChild(select);
    this.appendChild(container);
    this.sync();
  };
  LangSelect.prototype.sync = function () {
    if (!this._select) return;
    var state = autoState.currentState;
    if (!state) return;
    var current = (state.env && state.env.lang) || (state.i18n && state.i18n.lang) || '';
    if (current && this._select.value !== current) {
      this._select.value = current;
    }
  };

  function ThemeSwitcher() {
    return BaseComponent.call(this) || this;
  }
  ThemeSwitcher.prototype = Object.create(BaseComponent.prototype);
  ThemeSwitcher.prototype.constructor = ThemeSwitcher;
  ThemeSwitcher.observedAttributes = ['themes'];
  ThemeSwitcher.prototype.render = function () {
    var _this = this;
    var themes = parseThemesAttr(this, ['light', 'dark']);
    this.innerHTML = '';
    var wrapper = doc.createElement('div');
    wrapper.className = 'mk-switcher mk-switcher--themes';
    this._buttons = [];
    themes.forEach(function (theme) {
      var button = makeButton(formatLabel(THEME_LABELS, theme), theme, function () {
        performSetTheme(theme);
      });
      _this._buttons.push(button);
      wrapper.appendChild(button);
    });
    if (!themes.length) {
      var fallback = makeButton(formatLabel(THEME_LABELS, 'light'), 'light', function () { performSetTheme('light'); });
      this._buttons.push(fallback);
      wrapper.appendChild(fallback);
    }
    this.appendChild(wrapper);
    this.sync();
  };
  ThemeSwitcher.prototype.sync = function () {
    var state = autoState.currentState;
    if (!state || !this._buttons) return;
    var current = state.env && state.env.theme;
    this._buttons.forEach(function (button) {
      var active = button.dataset.value === current;
      if (active) button.classList.add('is-active');
      else button.classList.remove('is-active');
    });
  };

  function ThemeSelect() {
    return BaseComponent.call(this) || this;
  }
  ThemeSelect.prototype = Object.create(BaseComponent.prototype);
  ThemeSelect.prototype.constructor = ThemeSelect;
  ThemeSelect.observedAttributes = ['themes'];
  ThemeSelect.prototype.render = function () {
    var themes = parseThemesAttr(this);
    var options = themes.map(function (theme) {
      return { value: theme, label: formatLabel(THEME_LABELS, theme) };
    });
    if (!options.length) {
      options = [
        { value: 'light', label: formatLabel(THEME_LABELS, 'light') },
        { value: 'dark', label: formatLabel(THEME_LABELS, 'dark') }
      ];
    }
    this.innerHTML = '';
    var labelText = this.getAttribute('label') || '';
    var container = doc.createElement('label');
    container.className = labelText ? 'mk-label' : '';
    if (labelText) {
      var title = doc.createElement('span');
      title.textContent = labelText;
      container.appendChild(title);
    }
    var select = makeSelect(options, function (value) {
      performSetTheme(value);
    }, labelText || 'Theme');
    this._select = select;
    container.appendChild(select);
    this.appendChild(container);
    this.sync();
  };
  ThemeSelect.prototype.sync = function () {
    if (!this._select) return;
    var state = autoState.currentState;
    if (!state) return;
    var current = state.env && state.env.theme;
    if (current && this._select.value !== current) {
      this._select.value = current;
    }
  };

  defineComponent('lang-switcher', LangSwitcher);
  defineComponent('lang-select', LangSelect);
  defineComponent('theme-switcher', ThemeSwitcher);
  defineComponent('theme-select', ThemeSelect);

  function mergeOrders(existing, autoOrders) {
    var merged = Object.assign({}, autoOrders || {});
    if (existing && typeof existing === 'object') {
      Object.keys(existing).forEach(function (key) {
        merged[key] = existing[key];
      });
    }
    return merged;
  }

  function buildAutoOrders() {
    return {
      'ui.lang.ar': {
        on: ['click'],
        gkeys: ['ui:lang-ar'],
        handler: function (_, ctx) { performSetLang('ar'); }
      },
      'ui.lang.en': {
        on: ['click'],
        gkeys: ['ui:lang-en'],
        handler: function (_, ctx) { performSetLang('en'); }
      },
      'ui.lang.fr': {
        on: ['click'],
        gkeys: ['ui:lang-fr'],
        handler: function () { performSetLang('fr'); }
      },
      'ui.lang.tr': {
        on: ['click'],
        gkeys: ['ui:lang-tr'],
        handler: function () { performSetLang('tr'); }
      },
      'ui.lang.du': {
        on: ['click'],
        gkeys: ['ui:lang-du'],
        handler: function () { performSetLang('du'); }
      },
      'ui.theme.light': {
        on: ['click'],
        gkeys: ['ui:theme-light'],
        handler: function () { performSetTheme('light'); }
      },
      'ui.theme.dark': {
        on: ['click'],
        gkeys: ['ui:theme-dark'],
        handler: function () { performSetTheme('dark'); }
      },
      'ui.theme.toggle': {
        on: ['click'],
        gkeys: ['ui:theme-toggle'],
        handler: function (_, ctx) {
          var state = ctx && typeof ctx.getState === 'function' ? ctx.getState() : (autoState.currentState || {});
          var currentTheme = state && state.env ? state.env.theme : null;
          performSetTheme(currentTheme === 'dark' ? 'light' : 'dark');
        }
      }
    };
  }

  function patchAppMake(M) {
    if (!M || !M.app || typeof M.app.make !== 'function') return;
    if (M.app.make.__mishkahAutoPatch) return;
    var originalMake = M.app.make;
    function applyTwcssAuto(appInstance, databaseSnapshot) {
      if (!autoEnabled || !appInstance) return;
      try {
        var host = global.Mishkah;
        if (host && host.utils && host.utils.twcss && typeof host.utils.twcss.auto === 'function') {
          host.utils.twcss.auto(databaseSnapshot, appInstance, { tailwind: tailwindEnabled });
        } else if (!twcssAutoWarned) {
          twcssAutoWarned = true;
          if (global.console && console.warn) {
            console.warn('[MishkahAuto] twcss.auto غير متوفر، لن يتم تفعيل توكنز Mishkah تلقائياً.');
          }
        }
      } catch (err) {
        if (global.console && console.warn) console.warn('[MishkahAuto] فشل تفعيل twcss.auto', err);
      }
    }
    M.app.make = function (db, options) {
      var database = db || {};
      if (autoEnabled) {
        database = Object.assign({}, database);
        var cssLibrary = mapCssLibrary(cssOption) || cssOption;
        database.env = Object.assign({ css: cssOption, cssLibrary: cssLibrary, cssEngine: cssLibrary }, database.env || {});
        if (!database.env.theme) database.env.theme = userConfig.defaultTheme || 'light';
        if (!database.env.lang) database.env.lang = (Array.isArray(userConfig.defaultLangs) && userConfig.defaultLangs[0]) || 'ar';
        if (!database.env.dir) database.env.dir = RTL_LANGS.has(database.env.lang) ? 'rtl' : 'ltr';
        setDocumentLang(database.env.lang, database.env.dir);
        if (cssOption === 'mishkah') {
          ensureStyle(cssHref, 'mishkah-css');
        }
      }
      var mergedOptions = options ? Object.assign({}, options) : {};
      if (autoEnabled) {
        mergedOptions.orders = mergeOrders(mergedOptions.orders, buildAutoOrders());
      }
      var result = originalMake.call(M.app, database, mergedOptions);
      var attach = function (app) {
        applyTwcssAuto(app, database);
        attachApp(app);
        return app;
      };
      if (result && typeof result.then === 'function') {
        return result.then(function (app) {
          attach(app);
          return app;
        });
      }
      attach(result);
      return result;
    };
    M.app.make.__mishkahAutoPatch = true;
  }

  function markReady(M) {
    if (autoState.readyResolved) return;
    autoState.readyResolved = true;
    autoState.readyDeferred.resolve(M);
  }

  function watchAppMake(M) {
    if (!M || !M.app || autoState.waitingForMake) return;
    autoState.waitingForMake = true;
    try {
      var descriptor = Object.getOwnPropertyDescriptor(M.app, 'make');
      var current = descriptor && 'value' in descriptor ? descriptor.value : M.app.make;
      Object.defineProperty(M.app, 'make', {
        configurable: true,
        enumerable: true,
        get: function () { return current; },
        set: function (fn) {
          current = fn;
          if (typeof fn === 'function') {
            try {
              Object.defineProperty(M.app, 'make', {
                configurable: true,
                enumerable: true,
                writable: true,
                value: fn
              });
            } catch (_err) {
              if (global.console && console.warn) console.warn('[MishkahAuto] unable to redefine Mishkah.app.make', _err);
            }
            autoState.waitingForMake = false;
            patchAppMake(M);
            markReady(M);
          }
        }
      });
      if (typeof current === 'function') {
        M.app.make = current;
      }
    } catch (err) {
      autoState.waitingForMake = false;
      if (global.console && console.warn) console.warn('[MishkahAuto] failed to observe Mishkah.app.make', err);
    }
  }

  function finalizeSetup() {
    var M = global.Mishkah || global.Mishka;
    if (!M || !M.app) return;
    global.Mishka = global.Mishkah = M;
    if (typeof M.app.make === 'function') {
      patchAppMake(M);
      markReady(M);
      return;
    }
    watchAppMake(M);
  }

  var loadPromise = loadSequential(resources);

  if (autoEnabled && cssOption === 'mishkah') {
    loadPromise = loadPromise.then(function () {
      ensureStyle(cssHref, 'mishkah-css');
      return true;
    });
  }

  loadPromise.then(function () {
    finalizeSetup();
  }).catch(function (error) {
    if (global.console && console.error) console.error('[MishkahAuto] failed to bootstrap', error);
    if (!autoState.readyResolved) {
      autoState.readyResolved = true;
      autoState.readyDeferred.reject(error);
    }
  });

  function clonePlain(value) {
    if (!value || typeof value !== 'object') return {};
    if (Array.isArray(value)) return value.slice();
    return Object.assign({}, value);
  }

  function assignSection(target, key, value) {
    if (value == null) return;
    if (Array.isArray(value)) {
      target[key] = value.slice();
      return;
    }
    if (typeof value === 'object') {
      target[key] = Object.assign({}, value);
      return;
    }
    target[key] = value;
  }

  var api = global.MishkahAuto || {};
  api.__version = autoState.__version;
  api.config = autoState.config;
  api.ready = function (callback) {
    return autoState.readyDeferred.promise.then(function (M) {
      if (typeof callback === 'function') callback(M);
      return M;
    });
  };
  api.whenReady = autoState.readyDeferred.promise;
  api.setLang = performSetLang;
  api.setTheme = performSetTheme;
  api.onState = onState;
  api.attach = attachApp;
  api.formatLang = function (lang) { return formatLabel(LANG_LABELS, normalizeLang(lang)); };
  api.formatTheme = function (theme) { return formatLabel(THEME_LABELS, String(theme || '').toLowerCase()); };

  global.MishkahAuto = api;

  var host = global.Mishkah;
  if (!host || typeof host !== 'object') {
    host = {};
    global.Mishkah = host;
  }
  if (!global.Mishka || typeof global.Mishka !== 'object') {
    global.Mishka = host;
  }

  var autoNamespace = host.auto || {};
  host.auto = autoNamespace;
  autoNamespace.config = api.config;
  autoNamespace.ready = api.ready;
  autoNamespace.whenReady = api.whenReady;
  autoNamespace.onState = api.onState;
  autoNamespace.attach = api.attach;
  autoNamespace.make = function (config) {
    var cfg = (config && typeof config === 'object') ? config : {};
    var promise = api.whenReady.then(function (M) {
      if (!M || !M.app || typeof M.app.make !== 'function') {
        throw new Error('Mishkah.auto.make يتطلب توفر Mishkah.app.make.');
      }
      var dbSource = cfg.db || cfg.database || {};
      var db = clonePlain(dbSource);
      assignSection(db, 'env', cfg.env);
      assignSection(db, 'data', cfg.data);
      assignSection(db, 'i18n', cfg.i18n);
      assignSection(db, 'head', cfg.head);
      if (cfg.templates != null) {
        if (Array.isArray(cfg.templates)) {
          db.templates = cfg.templates.slice();
        } else if (typeof cfg.templates === 'object') {
          db.templates = Object.assign({}, cfg.templates);
        }
      } else if (db.templates && Array.isArray(db.templates)) {
        db.templates = db.templates.slice();
      }
      var options = {};
      if (cfg.options && typeof cfg.options === 'object') {
        options = Object.assign({}, cfg.options);
      }
      var optionKeys = ['mount', 'templateId', 'init', 'orders', 'ajax', 'root'];
      for (var i = 0; i < optionKeys.length; i += 1) {
        var key = optionKeys[i];
        if (cfg[key] != null && options[key] == null) {
          options[key] = cfg[key];
        }
      }
      return M.app.make(db, options);
    }).catch(function (error) {
      if (global.console && console.error) {
        console.error('[MishkahAuto] auto.make failed', error);
      }
      throw error;
    });
    return promise;
  };

  if (doc && typeof doc.dispatchEvent === 'function') {
    api.whenReady.then(function (M) {
      try {
        var readyEvent = null;
        if (typeof global.CustomEvent === 'function') {
          readyEvent = new CustomEvent('mishkah:auto-ready', { detail: { Mishkah: M } });
        } else if (doc.createEvent) {
          readyEvent = doc.createEvent('Event');
          readyEvent.initEvent('mishkah:auto-ready', true, true);
          readyEvent.detail = { Mishkah: M };
        }
        if (readyEvent) {
          doc.dispatchEvent(readyEvent);
        }
      } catch (_err) {}
      return M;
    }).catch(function () {});
  }

  global.Mishka = host;
})(typeof window !== 'undefined' ? window : this);
