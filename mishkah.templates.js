/*
 * Mishkah Templates — Universal App Page (AppShell)
 * -------------------------------------------------
 * هدف الملف: تيمبلِت جاهز لبناء صفحة تطبيق كاملة بضغطة واحدة:
 *  - هيدر + سايدبار + ناف + فوتر
 *  - مبدّل ثيمات + مبدّل لغات (يدعم أي مجموعة لغات)
 *  - مُخصِّص متغيرات الثيم (Drawer) للألوان والحجم…
 *  - راوتر بسيط (route) عام وقابل للتوسعة
 *  - نقطة تزامن WebSocket اختيارية لمشاركة الحالة بين الصفحات (One DB / Multi Pages)
 *
 * ملاحظة مهمة:
 * - هذا مكوّن عام «UI» ويُفضّل وضعه لاحقًا داخل mishkah-ui.js (الشجرة المباركة).
 * - هنا نضعه تحت مساحة أسماء جديدة: Mishkah.Templates
 */
(function (window) {
  'use strict';

  const M = window.Mishkah = window.Mishkah || {};
  const U = M.utils = M.utils || {};
  const D = M.DSL;                 // DSL/Atoms (نلتزم بالتصنيف الصارم)
  const UI = M.UI;                 // مكتبة UI الجاهزة
  const { tw, token, cx, setTheme, setDir } = U.twcss;

  //------------------------------------------------------------------------------
  // أدوات صغيرة
  //------------------------------------------------------------------------------
  const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
  const toArr = v => v == null ? [] : (Array.isArray(v) ? v : [v]);

  function ensureDict(dict){ return isObj(dict) ? dict : {}; }

  // تطبيق تفضيلات ثيم بسيطة (ألوان/خط)
  function applyThemePrefsSimple(prefs, activeTheme){
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const entry = (prefs && prefs[activeTheme]) || {};
    const colors = ensureDict(entry.colors);
    const fonts = ensureDict(entry.fonts);
    Object.keys(colors).forEach((cssVar)=>{
      try { root.style.setProperty(cssVar, String(colors[cssVar])); } catch(_){ }
    });
    if (fonts.base){ try { root.style.setProperty('--font-size-base', String(fonts.base)); } catch(_){ }
  }
  }

  //------------------------------------------------------------------------------
  // i18n — جدول نصوص صغير افتراضي (يمكن حقنه عبر config.i18nDict)
  //------------------------------------------------------------------------------
  function defaultI18nDict(){
    return {
      appName: { ar:'اسم التطبيق', en:'App Name' },
      ui: {
        theme:   { ar:'الثيم', en:'Theme' },
        language:{ ar:'اللغة', en:'Language' },
        customize:{ ar:'تخصيص', en:'Customize' },
        close:   { ar:'إغلاق', en:'Close' },
        menu:    { ar:'القائمة', en:'Menu' },
        status_online:  { ar:'متصل',  en:'Online' },
        status_offline: { ar:'غير متصل', en:'Offline' },
        status_idle:    { ar:'خامل', en:'Idle' },
        primaryColor:   { ar:'اللون الأساسي', en:'Primary color' },
        radius:         { ar:'تدوير الحواف', en:'Border radius' },
        fontSize:       { ar:'حجم الخط', en:'Font size' }
      }
    };
  }

  function makeLangLookup(db){
    const { TL } = (U.lang && U.lang.makeLangLookup ? U.lang.makeLangLookup(db) : { TL:(k)=> String(k) });
    return { TL };
  }

  //------------------------------------------------------------------------------
  // AppShell Factory
  //------------------------------------------------------------------------------
  function AppHeader(db, cfg){
    const { TL } = makeLangLookup(db);
    const themes = toArr(cfg.themes).filter(Boolean);
    const langs  = toArr(cfg.languages).filter(Boolean);

    // Theme switcher (عام: ui:theme:set)
    const themeSeg = themes.length ? UI.Segmented({
      items: themes.map(id=>({ id:String(id), label: (id==='dark'?'🌙 ':'☀️ ')+String(id), attrs:{ gkey:'ui:theme:set', 'data-theme':String(id) } })),
      activeId: db.env.theme || themes[0]
    }) : null;

    // Language switcher (عام: ui:lang:set)
    const langSeg = langs.length ? UI.Segmented({
      items: langs.map(id=>({ id:String(id), label:String(id).toUpperCase(), attrs:{ gkey:'ui:lang:set', 'data-lang':String(id) } })),
      activeId: db.env.lang || langs[0]
    }) : null;

    const customizeBtn = cfg.allowThemeCustomize !== false
      ? UI.Button({ attrs:{ gkey:'ui:palette:open' }, variant:'ghost', size:'sm' }, ['🎛️ ', TL('ui.customize')])
      : null;

    const left = D.Containers.Div({ attrs:{ class: tw`flex items-center gap-3` }}, [
      D.Text.Strong({ attrs:{ class: tw`text-base sm:text-lg` }}, [ cfg.appName || TL('appName') ])
    ]);
    const center = null; // مساحة حالة أو breadcrumbs لاحقًا
    const right = D.Containers.Div({ attrs:{ class: tw`flex items-center gap-2` }}, [ themeSeg, langSeg, customizeBtn ].filter(Boolean));

    return D.Containers.Header({ attrs:{ class: tw`px-5 pt-3 pb-3` }}, [
      D.Containers.Div({ attrs:{ class: tw`mx-auto w-full max-w-[1600px]` }}, [
        D.Containers.Div({ attrs:{ class: `${tw`rounded-2xl px-4 py-3`} glass-panel glow-outline` }}, [
          D.Containers.Div({ attrs:{ class: tw`flex items-center justify-between gap-3` }}, [left, center, right].filter(Boolean))
        ])
      ])
    ]);
  }

  function AppSidebar(db, cfg){
    const { TL } = makeLangLookup(db);
    if (typeof cfg.Sidebar === 'function') return cfg.Sidebar(db);

    const items = toArr(cfg.sidebarItems);
    const active = (db.ui && db.ui.route) || (items[0] && items[0].id) || 'home';

    const NavBtn = (it)=> UI.Button({
      attrs:{ gkey:'router:navigate', 'data-route': String(it.id), class: `${tw`w-full justify-start text-start rounded-2xl`} glass-panel ${active===it.id?'glow-outline':''}` },
      variant:'ghost', size:'sm'
    }, [ (it.icon ? (it.icon+' ') : ''), (it.label && isObj(it.label) ? (it.label[db.env.lang] || it.label.ar || it.label.en || String(it.id)) : (it.label || String(it.id))) ]);

    return D.Containers.Div({ attrs:{ class: tw`space-y-4 p-3` }}, [
      D.Text.Span({ attrs:{ class: tw`text-xs uppercase tracking-[0.3em] ${token('muted')}` }}, [TL('ui.menu')]),
      D.Containers.Nav({ attrs:{ class: tw`space-y-2` }}, items.map(NavBtn))
    ]);
  }

  function ThemeCustomizerDrawer(db, cfg){
    const { TL } = makeLangLookup(db);
    if (cfg.allowThemeCustomize === false) return D.Containers.Div({ attrs:{ class: tw`hidden` }});

    const active = (db.ui && db.ui.activeTheme) || db.env.theme || 'light';
    const prefs = db.data && db.data.themePrefs || {};
    const entry = prefs[active] || { colors:{}, fonts:{} };

    const radius = D.Containers.Div({ attrs:{ class: tw`space-y-1` }}, [
      D.Text.Span({ attrs:{ class: tw`text-xs ${token('muted')}` }}, [TL('ui.radius')]),
      D.Inputs.Input({ attrs:{ type:'range', min:'2', max:'24', step:'1', value: String(parseInt((entry.fonts && entry.fonts.radius) || '12', 10) || 12), 'data-css-var':'--radius', gkey:'ui:palette:set-color' } })
    ]);

    const primary = D.Containers.Div({ attrs:{ class: tw`space-y-1` }}, [
      D.Text.Span({ attrs:{ class: tw`text-xs ${token('muted')}` }}, [TL('ui.primaryColor')]),
      D.Inputs.Input({ attrs:{ type:'color', value: entry.colors && entry.colors['--primary'] || '#22c55e', 'data-css-var':'--primary', gkey:'ui:palette:set-color' } })
    ]);

    const fontSize = D.Containers.Div({ attrs:{ class: tw`space-y-1` }}, [
      D.Text.Span({ attrs:{ class: tw`text-xs ${token('muted')}` }}, [TL('ui.fontSize')]),
      D.Inputs.Input({ attrs:{ type:'range', min:'12', max:'20', step:'1', value: String(parseInt((entry.fonts && entry.fonts.base) || '14', 10) || 14), 'data-css-font':'--font-size-base', gkey:'ui:palette:set-font' } })
    ]);

    return UI.Drawer({
      open: !!(db.ui && db.ui.paletteOpen),
      side:'end',
      header: D.Containers.Div({ attrs:{ class: tw`flex items-center justify-between` }}, [
        D.Text.Strong({}, ['🎛️ ', TL('ui.customize')]),
        UI.Button({ attrs:{ gkey:'ui:palette:close' }, variant:'ghost', size:'sm' }, [TL('ui.close')])
      ]),
      content: D.Containers.Div({ attrs:{ class: tw`space-y-4` }}, [ primary, radius, fontSize ])
    });
  }

  function AppContent(db, cfg){
    const Content = typeof cfg.Content === 'function' ? cfg.Content : ( ()=> D.Text.P({}, ['⚠️ No content']) );
    return Content(db);
  }

  function AppFooter(db, cfg){
    const { TL } = makeLangLookup(db);
    const status = (db.data && db.data.status && db.data.status.ws) || 'idle';
    const tone = status==='online' ? 'status/online' : status==='offline' ? 'status/offline' : 'status/idle';
    const label = status==='online' ? TL('ui.status_online') : status==='offline' ? TL('ui.status_offline') : TL('ui.status_idle');
    const badge = UI.Badge({ variant:'badge/status', attrs:{ class: tw`${token(tone)} text-xs` }, leading: status==='online'?'●':(status==='offline'?'✖':'…'), text: label });

    return D.Containers.Footer({ attrs:{ class: tw`px-5 py-3` }}, [
      D.Containers.Div({ attrs:{ class: tw`mx-auto max-w-[1600px]` }}, [
        D.Containers.Div({ attrs:{ class: `${tw`rounded-2xl px-4 py-3 flex items-center justify-between`} glass-panel` }}, [
          D.Text.Span({ attrs:{ class: tw`text-xs ${token('muted')}` }}, [cfg.appName || 'Mishkah App']),
          D.Containers.Div({}, [ badge ])
        ])
      ])
    ]);
  }

  function AppPageFactory(config){
    const cfg = Object.assign({
      appName:'Mishkah App',
      languages:['ar','en'],
      themes:['light','dark'],
      sidebarItems:[ { id:'home', label:{ ar:'الرئيسية', en:'Home' }, icon:'🏠' } ],
      allowThemeCustomize:true
    }, config||{});

    return function AppPage(db){
      const header   = AppHeader(db, cfg);
      const sidebar  = AppSidebar(db, cfg);
      const content  = AppContent(db, cfg);
      const footer   = AppFooter(db, cfg);
      const drawer   = ThemeCustomizerDrawer(db, cfg);

      return D.Containers.Div({}, [
        UI.AppShell({ header, sidebar, content, footer }),
        drawer
      ]);
    };
  }

  //------------------------------------------------------------------------------
  // Orders — عامة وبسيطة (تحترم قواعد Mishkah)
  //------------------------------------------------------------------------------
  const TemplateOrders = {
    // ثيم محدد
    'ui.theme.set': {
      on:['click'], gkeys:['ui:theme:set'],
      handler:(e,ctx)=>{
        const btn = e.target.closest('[data-theme]'); if(!btn) return;
        const theme = btn.getAttribute('data-theme') || 'light';
        setTheme(theme);
        ctx.setState(s=> ({ ...s, env:{ ...(s.env||{}), theme } }));
        ctx.rebuild();
      }
    },

    // فتح/إغلاق مخصص الثيم
    'ui.palette.open': { on:['click'], gkeys:['ui:palette:open'], handler:(_e,ctx)=>{ ctx.setState(s=>({ ...s, ui:{ ...(s.ui||{}), paletteOpen:true } })); ctx.rebuild(); } },
    'ui.palette.close':{ on:['click'], gkeys:['ui:palette:close','ui:drawer:close'], handler:(_e,ctx)=>{ ctx.setState(s=>({ ...s, ui:{ ...(s.ui||{}), paletteOpen:false } })); ctx.rebuild(); } },

    // ضبط ألوان/فونت (CSS Vars)
    'ui.palette.set-color': {
      on:['input','change'], gkeys:['ui:palette:set-color'],
      handler:(e,ctx)=>{
        const input = e.target; if(!input) return;
        const cssVar = input.getAttribute('data-css-var'); if(!cssVar) return;
        const value = input.value || '';
        const state = ctx.getState();
        const themeKey = state.env?.theme || 'light';
        ctx.setState(s=>{
          const prefs = Object.assign({}, s.data?.themePrefs || {});
          const entry = Object.assign({ colors:{}, fonts:{} }, prefs[themeKey] || {});
          entry.colors = Object.assign({}, entry.colors, { [cssVar]: value });
          prefs[themeKey] = entry;
          return { ...s, data:{ ...(s.data||{}), themePrefs: prefs } };
        });
        applyThemePrefsSimple(ctx.getState().data.themePrefs, themeKey);
        ctx.rebuild();
      }
    },
    'ui.palette.set-font': {
      on:['input','change'], gkeys:['ui:palette:set-font'],
      handler:(e,ctx)=>{
        const input = e.target; if(!input) return;
        const cssVar = input.getAttribute('data-css-font') || '--font-size-base';
        const value = input.value || '';
        const state = ctx.getState();
        const themeKey = state.env?.theme || 'light';
        ctx.setState(s=>{
          const prefs = Object.assign({}, s.data?.themePrefs || {});
          const entry = Object.assign({ colors:{}, fonts:{} }, prefs[themeKey] || {});
          entry.fonts = Object.assign({}, entry.fonts, { base: String(value) });
          prefs[themeKey] = entry;
          return { ...s, data:{ ...(s.data||{}), themePrefs: prefs } };
        });
        applyThemePrefsSimple(ctx.getState().data.themePrefs, themeKey);
        ctx.rebuild();
      }
    },

    // لغة عامة (أي كود لغة)
    'ui.lang.set': {
      on:['click'], gkeys:['ui:lang:set'],
      handler:(e,ctx)=>{
        const btn = e.target.closest('[data-lang]'); if(!btn) return;
        const lang = btn.getAttribute('data-lang'); if(!lang) return;
        const dir = (lang==='ar' || lang==='fa' || lang==='ur') ? 'rtl' : 'ltr';
        setDir(dir);
        ctx.setState(s=> ({ ...s, env:{ ...(s.env||{}), lang, dir }, i18n:{ ...(s.i18n||{}), lang } }));
        ctx.rebuild();
      }
    },

    // راوتر عام
    'router.navigate': {
      on:['click'], gkeys:['router:navigate'],
      handler:(e,ctx)=>{
        const btn = e.target.closest('[data-route]'); if(!btn) return;
        const route = btn.getAttribute('data-route'); if(!route) return;
        ctx.setState(s=> ({ ...s, ui:{ ...(s.ui||{}), route } }));
        ctx.rebuild();
      }
    }
  };

  //------------------------------------------------------------------------------
  // Bootstrap — توليد التطبيق في 4 خطوات (DNA → VDOM → Orders → Mount)
  //------------------------------------------------------------------------------
  function buildDefaultDB(cfg){
    const startLang = toArr(cfg.languages)[0] || 'ar';
    const startTheme = toArr(cfg.themes)[0] || 'light';
    const dict = Object.assign({}, defaultI18nDict(), ensureDict(cfg.i18nDict));
    return {
      head:{ title: cfg.appName || 'Mishkah App' },
      env:{ theme:startTheme, lang:startLang, dir: (startLang==='ar'?'rtl':'ltr') },
      i18n:{ lang:startLang, fallback:'en', dict },
      data:{ themePrefs:{}, status:{ ws:'idle' } },
      ui:{ route: (toArr(cfg.sidebarItems)[0]||{}).id || 'home', paletteOpen:false }
    };
  }

  function bootstrap(options){
    const cfg = Object.assign({}, options||{});
    const database = isObj(cfg.database) ? cfg.database : buildDefaultDB(cfg);

    // 1) بناء الجسد: مكوّن الصفحة الكامل
    const Body = AppPageFactory(cfg);
    M.app.setBody(Body);

    // 2) الروح: أوامر التفاعل
    const orders = Object.assign({}, TemplateOrders, (cfg.orders||{}));

    // 3) خلق التطبيق + إعداد البيئة (Tailwind/Theme/Dir/Auto Orders)
    const app = M.app.createApp(database, orders);
    const auto = U.twcss.auto(database, app, { pageScaffold:true });

    // 4) دمج الأوامر ثم Mount
    app.setOrders(Object.assign({}, UI.orders, auto.orders, orders));
    app.mount(cfg.mount || '#app');

    // 5) (اختياري) تزامن WebSocket مشترك
    if (cfg.ws && cfg.ws.url){
      const ws = new (U.WebSocketX || U.WebSocket)(cfg.ws.url, Object.assign({ autoReconnect:true }, cfg.ws.options||{}));
      if (cfg.ws.topic){
        ws.subscribe(cfg.ws.topic, (payload)=>{
          // نتوقع payload = { data: { ... } } أو { patch: {...} }
          app.setState(s=>{
            const next = Object.assign({}, s);
            if (payload && isObj(payload.data)){
              next.data = Object.assign({}, s.data||{}, payload.data);
            }
            if (payload && isObj(payload.env)){
              next.env = Object.assign({}, s.env||{}, payload.env);
              if (payload.env.theme) setTheme(String(payload.env.theme));
              if (payload.env.dir) setDir(String(payload.env.dir));
            }
            return next;
          });
          app.rebuild();
        });
      }
      ws.on('state', (st)=>{
        app.setState(s=> ({ ...s, data:{ ...(s.data||{}), status:{ ...(s.data?.status||{}), ws: st && st.state || 'idle' } } }));
        app.rebuild();
      });
      ws.connect({ waitOpen:false });
      app._ws = ws; // للإشارة فقط للمطور
    }

    return app;
  }

  //------------------------------------------------------------------------------
  // التسجيل تحت مساحة الأسماء العامة
  //------------------------------------------------------------------------------
  M.Templates = M.Templates || {};
  M.Templates.AppPage = AppPageFactory;
  M.Templates.orders  = TemplateOrders;
  M.Templates.bootstrap = bootstrap;

  //------------------------------------------------------------------------------
  // مثال سريع (معلّق):
  //------------------------------------------------------------------------------
  /*
  // usage:
  Mishkah.Templates.bootstrap({
    appName:'Universal App',
    languages:['ar','en'],
    themes:['light','dark'],
    sidebarItems:[
      { id:'home', label:{ ar:'الرئيسية', en:'Home' }, icon:'🏠' },
      { id:'about', label:{ ar:'عن التطبيق', en:'About' }, icon:'ℹ️' }
    ],
    Content:(db)=> UI.Card({ title:'👋', content: D.Text.P({}, ['ضع محتواك هنا']) }),
    ws:{ url:'wss://example.com/app', topic:'app:state' }
  });
  */

})(typeof window !== 'undefined' ? window : this);
