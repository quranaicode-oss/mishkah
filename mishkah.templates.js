/*
 * Mishkah Templates 2.0 — Ready-to-ship layouts with zero friction
 * -----------------------------------------------------------------
 * يوفر هذا النظام ثلاث تصاميم احترافية (Aurora / Atlas / Zen) يمكن تشغيلها خلال ثوانٍ.
 * يكفي تمرير نسخة copy بسيطة أو حقن أي container عبر sections لتخصيص الصفحة.
 * كل شيء مبني على DSL الرسمية لمشكاة مع أوامر عامة للتحكم في القالب.
 */
(function (window) {
  'use strict';

  const M = window.Mishkah = window.Mishkah || {};
  const U = M.utils = M.utils || {};
  const D = M.DSL;
  const UI = M.UI;
  const { tw, token, cx } = U.twcss;
  const mergeDeep = (U.Data && typeof U.Data.deepMerge === 'function')
    ? U.Data.deepMerge
    : function mergeFallback(target, source) {
        if (!target || typeof target !== 'object') target = {};
        if (!source || typeof source !== 'object') return Object.assign({}, target);
        const out = Object.assign({}, target);
        Object.keys(source).forEach((key) => {
          const val = source[key];
          if (val && typeof val === 'object' && !Array.isArray(val) && out[key] && typeof out[key] === 'object' && !Array.isArray(out[key])) {
            out[key] = mergeFallback(out[key], val);
          } else {
            out[key] = val;
          }
        });
        return out;
      };
  const cloneNode = (U.JSON && typeof U.JSON.clone === 'function')
    ? (value) => U.JSON.clone(value)
    : (value) => JSON.parse(JSON.stringify(value));

  const isObj = (value) => value && typeof value === 'object' && !Array.isArray(value);
  const toArr = (value) => (Array.isArray(value) ? value.filter(Boolean) : (value == null ? [] : [value]));
  const ensureDict = (value) => (isObj(value) ? value : {});

  const helperBag = { D, UI, tw, token, cx, toArr, ensureDict, clone: cloneNode };

  const DEFAULT_OPTIONS = {
    layout: 'aurora',
    mount: '#app',
    theme: 'light',
    lang: 'ar',
    scaffold: true
  };

  const DEFAULT_COPY = {
    brand: {
      name: 'Mishkah Studio',
      tagline: 'منصة تصميم التطبيقات العربية'
    },
    header: {
      links: [
        { id: 'features', label: 'المميزات' },
        { id: 'workflow', label: 'آلية العمل' },
        { id: 'pricing', label: 'الباقات' }
      ],
      cta: { label: 'اطلب استشارة', gkey: 'templates:cta:header' }
    },
    hero: {
      eyebrow: 'قوالب جاهزة',
      title: 'ابنِ لوحة تحكم فاخرة خلال دقائق',
      description: 'نظام القوالب في مشكاة يمنحك صفحات جاهزة ومرنة مع دعم كامل للثيمات والأوامر.',
      bullets: [
        { id: 'arabic', icon: '🌍', text: 'تصميم متوازن يدعم العربية والإنجليزية بشكل كامل.' },
        { id: 'atoms', icon: '🧱', text: 'كل قسم مبني على الذرات الرسمية لـ Mishkah (DSL).' },
        { id: 'orders', icon: '⚡', text: 'أوامر جاهزة لتبديل الثيم واللغة والتنقل بين الأقسام.' }
      ],
      mediaTitle: 'Plug & Play',
      mediaDescription: 'حقن المكوّنات الخاصة بك في أي منطقة خلال ثوانٍ.',
      primary: { label: 'ابدأ البناء الآن', gkey: 'templates:cta:primary' },
      secondary: { label: 'شاهد جولة سريعة', gkey: 'templates:cta:secondary' }
    },
    stats: [
      { id: 'templates', label: 'قوالب جاهزة', value: '12+' },
      { id: 'components', label: 'مكونات UI جاهزة', value: '80+' },
      { id: 'teams', label: 'فرق تستخدم مشكاة', value: '45' }
    ],
    features: [
      { id: 'dsl', icon: '🧬', title: 'DSL صارم', description: 'نلتزم بالتصنيف الرسمي للذرات لتبقى مشاريعك متسقة وآمنة.' },
      { id: 'theme', icon: '🎨', title: 'ثيمات حية', description: 'مبدلات الثيم واللغة تعمل مباشرة دون أي إعداد إضافي.' },
      { id: 'sections', icon: '🧩', title: 'مناطق قابلة للحقن', description: 'كل جزء من القالب يمكن استبداله بمكوّناتك الخاصة بسهولة.' }
    ],
    timeline: {
      title: 'خارطة التنفيذ',
      subtitle: 'ثلاث خطوات فقط تفصل مشروعك عن الإطلاق.',
      items: [
        { id: 'plan', title: 'اليوم ١ — التخطيط', description: 'تحديد قاعدة البيانات وتوزيع الذرات ومناطق الحقن.' },
        { id: 'build', title: 'اليوم ٢ — البناء', description: 'توليد الواجهات وإسناد الأوامر وربط المصادر.' },
        { id: 'launch', title: 'اليوم ٣ — الإطلاق', description: 'اختبارات الجودة والنشر مع توثيق كامل للمكوّنات.' }
      ]
    },
    cards: [
      { id: 'academy', title: 'أكاديمية مشكاة', description: 'مواد مرئية تشرح بناء التطبيقات خطوة بخطوة.' },
      { id: 'workspace', title: 'Workspace', description: 'مساحات عمل مشتركة للفرق مع مشاركة فورية للحالة.' },
      { id: 'community', title: 'مجتمع المطورين', description: 'قنوات تواصل مباشرة مع خبراء مشكاة ودعم مستمر.' }
    ],
    cta: {
      title: 'جاهز للانطلاق؟',
      description: 'اختر القالب المناسب وخصصه خلال دقائق عبر أوامر Mishkah.',
      primary: { label: 'ابدأ النسخة التجريبية', gkey: 'templates:cta:primary' },
      secondary: { label: 'تحدث مع فريقنا', gkey: 'templates:cta:secondary' }
    },
    footer: {
      text: 'مشكاة — بناء المنتجات يبدأ من هنا.',
      links: [
        { id: 'docs', label: 'التوثيق', href: '#' },
        { id: 'support', label: 'الدعم', href: '#' },
        { id: 'blog', label: 'المدونة', href: '#' }
      ]
    }
  };

  function injectBaseStyles() {
    if (typeof document === 'undefined') return;
    const id = 'mishkah-templates-base';
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = `
.mishkah-template {
  position: relative;
  min-height: 100vh;
  isolation: isolate;
  color: var(--foreground);
  background: linear-gradient(155deg, color-mix(in oklab, var(--background) 94%, transparent) 0%, color-mix(in oklab, var(--surface-1) 88%, transparent) 100%);
}
.dark .mishkah-template {
  background: linear-gradient(155deg, color-mix(in oklab, var(--background) 95%, black) 0%, color-mix(in oklab, var(--surface-2) 92%, transparent) 100%);
}
.mishkah-template::before,
.mishkah-template::after {
  content: '';
  position: fixed;
  inset: auto;
  width: 420px;
  height: 420px;
  border-radius: 50%;
  pointer-events: none;
  opacity: 0.55;
  z-index: 0;
  filter: blur(0);
}
.mishkah-template-aurora::before { top: -140px; left: -80px; background: radial-gradient(circle at top left, rgba(59,130,246,0.18), transparent 70%); }
.mishkah-template-aurora::after { bottom: -180px; right: -60px; background: radial-gradient(circle at bottom right, rgba(16,185,129,0.22), transparent 70%); }
.dark .mishkah-template-aurora::before { background: radial-gradient(circle at top left, rgba(129,140,248,0.35), transparent 70%); }
.dark .mishkah-template-aurora::after { background: radial-gradient(circle at bottom right, rgba(45,212,191,0.28), transparent 70%); }
.mishkah-template-atlas {
  background: radial-gradient(circle at top right, rgba(59,130,246,0.12), transparent 55%), color-mix(in oklab, var(--background) 95%, transparent);
}
.dark .mishkah-template-atlas {
  background: radial-gradient(circle at 15% 25%, rgba(129,140,248,0.25), transparent 65%), color-mix(in oklab, var(--background) 96%, black);
}
.mishkah-template-zen {
  background: linear-gradient(180deg, color-mix(in oklab, var(--background) 96%, transparent) 0%, color-mix(in oklab, var(--surface-1) 86%, transparent) 100%);
}
.mishkah-template .template-glass {
  background: color-mix(in oklab, var(--surface-1) 88%, transparent);
  border: 1px solid color-mix(in oklab, var(--border) 55%, transparent);
  box-shadow: 0 32px 80px -42px rgba(15, 23, 42, 0.35);
  backdrop-filter: blur(28px);
}
.dark .mishkah-template .template-glass {
  background: color-mix(in oklab, var(--surface-2) 92%, transparent);
  border-color: color-mix(in oklab, var(--border) 55%, transparent);
  box-shadow: 0 32px 80px -40px rgba(15, 23, 42, 0.55);
}
.template-header { z-index: 2; }
.template-brand-block { display: flex; flex-direction: column; gap: 0.2rem; }
.template-brand-tagline { font-size: 0.72rem; letter-spacing: 0.35em; text-transform: uppercase; color: color-mix(in oklab, var(--muted-foreground) 88%, transparent); }
.template-brand-name { font-size: 1.2rem; font-weight: 700; }
.template-link { position: relative; color: color-mix(in oklab, var(--muted-foreground) 92%, transparent); font-weight: 500; }
.template-link::after { content: ''; position: absolute; inset-inline: 0; bottom: -0.35rem; height: 2px; background: color-mix(in oklab, var(--primary) 82%, transparent); transform: scaleX(0); transform-origin: center; transition: transform 0.25s ease; }
.template-link:hover { color: var(--foreground); }
.template-link:hover::after { transform: scaleX(1); }
.template-hero { overflow: hidden; }
.template-hero__title { font-size: clamp(2.2rem, 4vw, 3.2rem); font-weight: 800; line-height: 1.1; }
.template-hero__desc { font-size: 1.05rem; color: color-mix(in oklab, var(--muted-foreground) 88%, transparent); max-width: 52ch; }
.mishkah-template-zen .template-hero__desc { margin-inline: auto; }
.template-hero-bullets { display: grid; gap: 0.75rem; padding: 0; margin: 0; list-style: none; }
.template-bullet { display: flex; align-items: center; gap: 0.75rem; font-size: 0.95rem; color: color-mix(in oklab, var(--foreground) 92%, transparent); }
.template-bullet__icon { width: 2.25rem; height: 2.25rem; display: grid; place-items: center; border-radius: 1rem; background: color-mix(in oklab, var(--accent) 85%, transparent); box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--border) 60%, transparent); }
.template-actions { display: flex; flex-wrap: wrap; gap: 0.75rem; }
.template-hero-visual { position: relative; border-radius: 1.75rem; padding: 2.5rem; background: linear-gradient(150deg, rgba(59,130,246,0.22), rgba(16,185,129,0.18)); color: rgba(15,23,42,0.92); overflow: hidden; box-shadow: 0 26px 70px -40px rgba(37,99,235,0.55); }
.dark .template-hero-visual { color: rgba(226,232,240,0.95); }
.template-hero-visual::after { content: ''; position: absolute; inset: 18% 18% auto; height: 200%; border-radius: 999px; background: radial-gradient(circle, rgba(255,255,255,0.45), transparent 65%); opacity: 0.45; }
.template-hero-visual__label { font-size: 0.82rem; letter-spacing: 0.35em; text-transform: uppercase; display: block; margin-bottom: 0.8rem; color: rgba(15,23,42,0.65); }
.dark .template-hero-visual__label { color: rgba(226,232,240,0.7); }
.template-hero-visual__title { font-size: 1.8rem; font-weight: 700; }
.template-hero-visual__desc { font-size: 0.95rem; margin-top: 0.5rem; max-width: 26ch; }
.mishkah-template-zen .template-hero { text-align: center; }
.mishkah-template-zen .template-actions { justify-content: center; }
.template-stats .template-stat-grid { display: grid; gap: 1.5rem; }
@media (min-width: 768px) { .template-stats .template-stat-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
.template-stat { display: flex; flex-direction: column; gap: 0.35rem; }
.template-stat__value { font-size: 1.8rem; font-weight: 700; color: var(--primary); }
.template-stat__label { font-size: 0.9rem; color: color-mix(in oklab, var(--muted-foreground) 90%, transparent); }
.template-feature-card { position: relative; overflow: hidden; }
.template-feature-card .feature-icon { font-size: 1.4rem; }
.template-timeline { display: flex; flex-direction: column; gap: 1.1rem; margin: 0; padding: 0; list-style: none; }
.template-timeline__item { display: flex; gap: 1rem; align-items: flex-start; padding: 0.75rem 0; }
.template-timeline__marker { width: 2.5rem; height: 2.5rem; border-radius: 999px; display: grid; place-items: center; background: color-mix(in oklab, var(--accent) 88%, transparent); font-weight: 600; }
.template-timeline__title { font-weight: 600; margin-bottom: 0.25rem; }
.template-timeline__desc { font-size: 0.9rem; color: color-mix(in oklab, var(--muted-foreground) 92%, transparent); }
.template-cards-grid { display: grid; gap: 1.1rem; }
@media (min-width: 768px) { .template-cards-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
.template-cta { text-align: start; }
.mishkah-template-zen .template-cta { text-align: center; }
.template-cta__title { font-size: 1.5rem; font-weight: 700; }
.template-cta__desc { color: color-mix(in oklab, var(--muted-foreground) 90%, transparent); margin: 0.75rem 0 1.25rem; }
.template-footer { display: flex; flex-direction: column; gap: 1rem; border-top: 1px solid color-mix(in oklab, var(--border) 55%, transparent); padding-top: 1.5rem; margin-top: 3rem; }
.mishkah-template-zen .template-footer { align-items: center; }
.template-footer__links { display: flex; flex-wrap: wrap; gap: 0.75rem 1.25rem; }
.template-footer__link { color: color-mix(in oklab, var(--muted-foreground) 92%, transparent); font-size: 0.95rem; }
.template-footer__link:hover { color: var(--foreground); }
.template-atlas-sidebar { background: color-mix(in oklab, var(--surface-2) 92%, transparent); backdrop-filter: blur(28px); border-inline-end: 1px solid color-mix(in oklab, var(--border) 55%, transparent); }
.dark .template-atlas-sidebar { background: color-mix(in oklab, var(--surface-2) 96%, transparent); }
.template-atlas-sidebar .template-timeline__item { border-bottom: 1px solid color-mix(in oklab, var(--border) 50%, transparent); padding-bottom: 1.25rem; }
.template-atlas-sidebar .template-timeline__item:last-child { border-bottom: none; }
.template-sidebar__subtitle { color: color-mix(in oklab, var(--muted-foreground) 92%, transparent); font-size: 0.92rem; }
.template-card-highlight { position: relative; overflow: hidden; }
.template-card-highlight::after { content: ''; position: absolute; inset: 30% -30% auto; height: 120%; border-radius: 999px; background: radial-gradient(circle, rgba(59,130,246,0.25), transparent 70%); opacity: 0.45; }
.template-theme-toggle { font-size: 1.1rem; }
@media (max-width: 768px) {
  .template-header { padding-inline: 1.1rem; border-radius: 1.5rem; }
  .template-hero__desc { max-width: none; }
}
`;
    document.head.appendChild(style);
  }

  const DefaultSections = {
    header: (ctx) => {
      const { D, UI, tw, cx, ensureDict, toArr } = ctx.helpers;
      const headerCopy = ensureDict(ctx.copy.header);
      const brand = ensureDict(ctx.copy.brand);
      const navLinks = toArr(headerCopy.links);
      const action = ensureDict(headerCopy.cta);

      const nav = navLinks.length ? D.Containers.Nav({ attrs: { class: tw`hidden items-center gap-4 text-sm md:flex` } },
        navLinks.map((link, idx) => D.Text.A({
          attrs: {
            key: `nav-${link.id || idx}`,
            href: link.href || '#',
            class: 'template-link',
            gkey: link.gkey || 'templates:nav:link',
            'data-link-id': link.id ? String(link.id) : `link-${idx}`,
            'data-href': link.href || '#'
          }
        }, [link.label || `Link ${idx + 1}`]))
      ) : null;

      const actions = D.Containers.Div({ attrs: { class: tw`flex items-center gap-2` } }, [
        UI.Button({ attrs: { gkey: 'ui:theme-toggle', class: 'template-theme-toggle' }, variant: 'ghost', size: 'sm' }, ['🌓']),
        action.label ? UI.Button({ attrs: { gkey: action.gkey || 'templates:cta:primary' }, variant: 'solid', size: 'sm' }, [action.label]) : null,
        navLinks.length ? UI.Button({ attrs: { class: tw`md:hidden`, gkey: 'templates:sidebar:toggle' }, variant: 'ghost', size: 'sm' }, ['☰']) : null
      ].filter(Boolean));

      return D.Containers.Header({ attrs: { class: cx('template-glass template-header', tw`flex items-center justify-between gap-6 rounded-full px-5 py-3`) } }, [
        D.Containers.Div({ attrs: { class: 'template-brand-block' } }, [
          brand.tagline ? D.Text.Span({ attrs: { class: 'template-brand-tagline' } }, [brand.tagline]) : null,
          D.Text.Strong({ attrs: { class: 'template-brand-name' } }, [brand.name || 'Mishkah Studio'])
        ].filter(Boolean)),
        nav,
        actions
      ].filter(Boolean));
    },

    hero: (ctx) => {
      const { D, UI, tw, cx, ensureDict, toArr } = ctx.helpers;
      const hero = ensureDict(ctx.copy.hero);
      const bullets = toArr(hero.bullets);
      const primary = ensureDict(hero.primary);
      const secondary = ensureDict(hero.secondary);

      const bulletList = bullets.length
        ? D.Lists.Ul({ attrs: { class: 'template-hero-bullets' } }, bullets.map((item, idx) => D.Lists.Li({
            attrs: { key: `hero-bullet-${item.id || idx}`, class: 'template-bullet' }
          }, [
            item.icon ? D.Text.Span({ attrs: { class: 'template-bullet__icon' } }, [item.icon]) : null,
            item.text ? D.Text.Span({ attrs: { class: 'template-bullet__text' } }, [item.text]) : null
          ].filter(Boolean)))
        ) : null;

      const actions = (primary.label || secondary.label)
        ? D.Containers.Div({ attrs: { class: 'template-actions' } }, [
            primary.label ? UI.Button({ attrs: { gkey: primary.gkey || 'templates:cta:primary' }, variant: 'solid', size: 'md' }, [primary.label]) : null,
            secondary.label ? UI.Button({ attrs: { gkey: secondary.gkey || 'templates:cta:secondary' }, variant: 'ghost', size: 'md' }, [secondary.label]) : null
          ].filter(Boolean))
        : null;

      const visual = D.Containers.Div({ attrs: { class: 'template-hero-visual' } }, [
        D.Text.Span({ attrs: { class: 'template-hero-visual__label' } }, ['Live Preview']),
        D.Text.Strong({ attrs: { class: 'template-hero-visual__title' } }, [hero.mediaTitle || 'Plug & Play']),
        hero.mediaDescription ? D.Text.P({ attrs: { class: 'template-hero-visual__desc' } }, [hero.mediaDescription]) : null
      ].filter(Boolean));

      return D.Containers.Section({ attrs: { class: cx('template-glass template-hero', tw`grid gap-10 rounded-[32px] border px-8 py-10 lg:grid-cols-[1.6fr_1fr]`) } }, [
        D.Containers.Div({ attrs: { class: tw`space-y-6 text-start` } }, [
          hero.eyebrow ? UI.Badge({ variant: 'badge/ghost', text: hero.eyebrow }) : null,
          hero.title ? D.Text.H1({ attrs: { class: 'template-hero__title' } }, [hero.title]) : null,
          hero.description ? D.Text.P({ attrs: { class: 'template-hero__desc' } }, [hero.description]) : null,
          bulletList,
          actions
        ].filter(Boolean)),
        visual
      ]);
    },

    stats: (ctx) => {
      const { D, cx, tw, toArr } = ctx.helpers;
      const stats = toArr(ctx.copy.stats);
      if (!stats.length) return null;
      const cards = stats.map((stat, idx) => D.Containers.Div({
        attrs: { key: `stat-${stat.id || idx}`, class: 'template-stat' }
      }, [
        stat.value ? D.Text.Span({ attrs: { class: 'template-stat__value' } }, [stat.value]) : null,
        stat.label ? D.Text.Span({ attrs: { class: 'template-stat__label' } }, [stat.label]) : null
      ].filter(Boolean)));

      return D.Containers.Section({ attrs: { class: cx('template-glass template-stats', tw`rounded-[28px] border px-6 py-6`) } }, [
        D.Containers.Div({ attrs: { class: 'template-stat-grid' } }, cards)
      ]);
    },

    main: (ctx) => {
      const { UI, tw, cx, toArr, ensureDict } = ctx.helpers;
      const features = toArr(ctx.copy.features);
      if (!features.length) return null;
      const cards = features.map((feature, idx) => {
        const item = ensureDict(feature);
        const icon = item.icon ? D.Text.Span({ attrs: { class: 'feature-icon' } }, [item.icon]) : null;
        const content = icon ? D.Containers.Div({ attrs: { class: tw`space-y-2` } }, [icon]) : null;
        return UI.Card({
          attrs: { key: `feature-${item.id || idx}`, class: cx('template-card-highlight template-feature-card', tw`h-full`) },
          title: item.title,
          description: item.description,
          content
        });
      });
      return D.Containers.Section({ attrs: { class: cx('template-glass template-main', tw`rounded-[28px] border px-6 py-8`) } }, [
        D.Containers.Div({ attrs: { class: tw`grid gap-6 md:grid-cols-2` } }, cards)
      ]);
    },

    sidebar: (ctx) => {
      const { D, UI, tw, cx, ensureDict, toArr } = ctx.helpers;
      const timeline = ensureDict(ctx.copy.timeline);
      const items = toArr(timeline.items);
      if (!items.length) return null;
      const list = items.map((item, idx) => D.Lists.Li({
        attrs: { key: `timeline-${item.id || idx}`, class: 'template-timeline__item' }
      }, [
        D.Containers.Div({ attrs: { class: 'template-timeline__marker' } }, [String(idx + 1).padStart(2, '0')]),
        D.Containers.Div({}, [
          item.title ? D.Text.Span({ attrs: { class: 'template-timeline__title' } }, [item.title]) : null,
          item.description ? D.Text.Span({ attrs: { class: 'template-timeline__desc' } }, [item.description]) : null
        ].filter(Boolean))
      ]));

      return D.Containers.Section({ attrs: { class: cx('template-glass template-sidebar', tw`rounded-[28px] border px-6 py-8 space-y-6`) } }, [
        timeline.title ? D.Text.H3({}, [timeline.title]) : null,
        timeline.subtitle ? D.Text.P({ attrs: { class: 'template-sidebar__subtitle' } }, [timeline.subtitle]) : null,
        D.Lists.Ol({ attrs: { class: 'template-timeline' } }, list)
      ].filter(Boolean));
    },

    cards: (ctx) => {
      const { UI, tw, cx, toArr, ensureDict } = ctx.helpers;
      const cards = toArr(ctx.copy.cards);
      if (!cards.length) return null;
      const list = cards.map((card, idx) => {
        const item = ensureDict(card);
        return UI.Card({
          attrs: { key: `card-${item.id || idx}`, class: cx('template-feature-card', tw`h-full`) },
          title: item.title,
          description: item.description
        });
      });
      return D.Containers.Section({ attrs: { class: cx('template-glass template-cards', tw`rounded-[28px] border px-6 py-8`) } }, [
        D.Containers.Div({ attrs: { class: 'template-cards-grid' } }, list)
      ]);
    },

    cta: (ctx) => {
      const { D, UI, tw, cx, ensureDict } = ctx.helpers;
      const cta = ensureDict(ctx.copy.cta);
      if (!cta.title && !cta.description) return null;
      const primary = ensureDict(cta.primary);
      const secondary = ensureDict(cta.secondary);
      const actions = (primary.label || secondary.label)
        ? D.Containers.Div({ attrs: { class: 'template-actions' } }, [
            primary.label ? UI.Button({ attrs: { gkey: primary.gkey || 'templates:cta:primary' }, variant: 'solid', size: 'md' }, [primary.label]) : null,
            secondary.label ? UI.Button({ attrs: { gkey: secondary.gkey || 'templates:cta:secondary' }, variant: 'ghost', size: 'md' }, [secondary.label]) : null
          ].filter(Boolean))
        : null;
      return D.Containers.Section({ attrs: { class: cx('template-glass template-cta', tw`rounded-[28px] border px-6 py-8`) } }, [
        cta.title ? D.Text.H2({ attrs: { class: 'template-cta__title' } }, [cta.title]) : null,
        cta.description ? D.Text.P({ attrs: { class: 'template-cta__desc' } }, [cta.description]) : null,
        actions
      ].filter(Boolean));
    },

    footer: (ctx) => {
      const { D, tw, toArr, ensureDict } = ctx.helpers;
      const footer = ensureDict(ctx.copy.footer);
      const links = toArr(footer.links);
      const nav = links.length
        ? D.Containers.Nav({ attrs: { class: 'template-footer__links' } },
            links.map((link, idx) => D.Text.A({
              attrs: {
                key: `footer-${link.id || idx}`,
                href: link.href || '#',
                class: 'template-footer__link',
                gkey: link.gkey || 'templates:nav:link',
                'data-link-id': link.id ? String(link.id) : `footer-${idx}`,
                'data-href': link.href || '#'
              }
            }, [link.label || `Link ${idx + 1}`]))
          )
        : null;

      return D.Containers.Div({ attrs: { class: 'template-footer' } }, [
        footer.text ? D.Text.Span({ attrs: { class: tw`text-sm` } }, [footer.text]) : null,
        nav
      ].filter(Boolean));
    }
  };

  function LayoutAurora(ctx) {
    const { D, tw, cx } = ctx.helpers;
    const header = ctx.render('header');
    const hero = ctx.render('hero');
    const stats = ctx.render('stats');
    const main = ctx.render('main');
    const cards = ctx.render('cards');
    const sidebar = ctx.render('sidebar');
    const cta = ctx.render('cta');
    const footer = ctx.render('footer');

    const leftColumn = [stats, main, cards, cta].filter(Boolean);
    const rightColumn = sidebar ? [sidebar] : [];

    const grid = (leftColumn.length || rightColumn.length)
      ? D.Containers.Div({ attrs: { class: tw`grid gap-6 lg:grid-cols-[2fr_1fr]` } }, [
          leftColumn.length ? D.Containers.Div({ attrs: { class: tw`space-y-6` } }, leftColumn) : null,
          rightColumn.length ? D.Containers.Div({ attrs: { class: tw`space-y-6` } }, rightColumn) : null
        ].filter(Boolean))
      : null;

    return D.Containers.Div({ attrs: { class: cx('mishkah-template mishkah-template-aurora', tw`flex min-h-screen flex-col`) } }, [
      D.Containers.Main({ attrs: { class: tw`relative z-[1] mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-6 py-10 lg:px-10` } }, [
        header,
        hero,
        grid
      ].filter(Boolean)),
      footer ? D.Containers.Footer({ attrs: { class: tw`relative z-[1] mx-auto w-full max-w-6xl px-6 pb-10 lg:px-10` } }, [footer]) : null
    ].filter(Boolean));
  }

  function LayoutAtlas(ctx) {
    const { D, UI, tw, cx } = ctx.helpers;
    const header = ctx.render('header');
    const hero = ctx.render('hero');
    const stats = ctx.render('stats');
    const main = ctx.render('main');
    const cards = ctx.render('cards');
    const cta = ctx.render('cta');
    const footer = ctx.render('footer');
    const sidebarContent = ctx.render('sidebar');

    const columnMain = [header, hero, stats, main, cards, cta].filter(Boolean);
    const isSidebarOpen = !!(ctx.db.ui && ctx.db.ui.sidebarOpen);

    const overlay = sidebarContent && isSidebarOpen
      ? D.Containers.Div({ attrs: { class: tw`fixed inset-0 z-30 bg-slate-950/60 backdrop-blur-sm lg:hidden`, gkey: 'templates:sidebar:close' } })
      : null;

    const sidebarPanel = sidebarContent
      ? D.Containers.Aside({ attrs: { class: cx('template-atlas-sidebar', tw`fixed inset-y-0 start-0 z-40 w-[84vw] max-w-sm overflow-y-auto px-6 py-10 transition-transform duration-300 ease-out`, isSidebarOpen ? tw`translate-x-0` : tw`-translate-x-full`, tw`lg:static lg:z-auto lg:h-[calc(100vh-8rem)] lg:w-[320px] lg:translate-x-0 lg:overflow-y-visible lg:rounded-[32px]`) } }, [
          D.Containers.Div({ attrs: { class: tw`space-y-6` } }, [
            D.Containers.Div({ attrs: { class: tw`flex items-center justify-between lg:hidden` } }, [
              D.Text.Strong({ attrs: { class: tw`text-base` } }, [ctx.copy.brand && ctx.copy.brand.name ? ctx.copy.brand.name : 'القائمة']),
              UI.Button({ attrs: { gkey: 'templates:sidebar:close' }, variant: 'ghost', size: 'sm' }, ['✕'])
            ]),
            sidebarContent
          ].filter(Boolean))
        ])
      : null;

    const content = D.Containers.Main({ attrs: { class: tw`relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-12 lg:ms-[340px] lg:px-16` } }, columnMain);
    const footerNode = footer ? D.Containers.Footer({ attrs: { class: tw`relative z-10 mx-auto w-full max-w-5xl px-6 pb-10 lg:ms-[340px] lg:px-16` } }, [footer]) : null;

    return D.Containers.Div({ attrs: { class: cx('mishkah-template mishkah-template-atlas', tw`relative flex min-h-screen flex-col`) } }, [
      overlay,
      sidebarPanel,
      content,
      footerNode
    ].filter(Boolean));
  }

  function LayoutZen(ctx) {
    const { D, tw, cx } = ctx.helpers;
    const header = ctx.render('header');
    const hero = ctx.render('hero');
    const stats = ctx.render('stats');
    const cards = ctx.render('cards');
    const main = ctx.render('main');
    const cta = ctx.render('cta');
    const footer = ctx.render('footer');

    return D.Containers.Div({ attrs: { class: cx('mishkah-template mishkah-template-zen', tw`flex min-h-screen flex-col`) } }, [
      D.Containers.Main({ attrs: { class: tw`relative z-10 mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-6 py-14 text-center` } }, [
        header ? D.Containers.Div({ attrs: { class: tw`mx-auto max-w-3xl` } }, [header]) : null,
        hero,
        stats ? D.Containers.Div({ attrs: { class: tw`mx-auto max-w-3xl` } }, [stats]) : null,
        cards,
        main,
        cta
      ].filter(Boolean)),
      footer ? D.Containers.Footer({ attrs: { class: tw`relative z-10 mx-auto w-full max-w-4xl px-6 pb-12 text-center` } }, [footer]) : null
    ].filter(Boolean));
  }

  const Layouts = {
    aurora: LayoutAurora,
    atlas: LayoutAtlas,
    zen: LayoutZen
  };

  function dispatchTemplateEvent(type, detail) {
    if (typeof window === 'undefined') return;
    try {
      window.dispatchEvent(new CustomEvent('mishkah:template', { detail: { type, payload: detail || {} } }));
    } catch (_) { /* ignore */ }
  }

  const TemplateOrders = {
    'templates.sidebar.toggle': {
      on: ['click'], gkeys: ['templates:sidebar:toggle'],
      handler: (_event, ctx) => {
        ctx.setState((state) => ({
          ...state,
          ui: { ...(state.ui || {}), sidebarOpen: !state.ui?.sidebarOpen }
        }));
        ctx.rebuild();
      }
    },
    'templates.sidebar.close': {
      on: ['click'], gkeys: ['templates:sidebar:close'],
      handler: (_event, ctx) => {
        ctx.setState((state) => ({
          ...state,
          ui: { ...(state.ui || {}), sidebarOpen: false }
        }));
        ctx.rebuild();
      }
    },
    'templates.nav.link': {
      on: ['click'], gkeys: ['templates:nav:link'],
      handler: (event) => {
        const el = event.target.closest('[data-link-id]');
        if (!el) return;
        dispatchTemplateEvent('nav:link', {
          id: el.getAttribute('data-link-id') || '',
          href: el.getAttribute('data-href') || ''
        });
      }
    },
    'templates.cta.primary': {
      on: ['click'], gkeys: ['templates:cta:primary'],
      handler: (event) => {
        const target = event.target.closest('[data-link-id]');
        dispatchTemplateEvent('cta:primary', target ? {
          id: target.getAttribute('data-link-id') || ''
        } : {});
      }
    },
    'templates.cta.secondary': {
      on: ['click'], gkeys: ['templates:cta:secondary'],
      handler: (event) => {
        const target = event.target.closest('[data-link-id]');
        dispatchTemplateEvent('cta:secondary', target ? {
          id: target.getAttribute('data-link-id') || ''
        } : {});
      }
    }
  };

  function toFactory(entry) {
    if (typeof entry === 'function') return entry;
    if (entry == null) return () => null;
    if (Array.isArray(entry)) {
      const clone = entry.slice();
      return () => D.Containers.Div({}, clone.map((item) => (isObj(item) ? cloneNode(item) : D.Text.Span({}, [String(item)]))));
    }
    if (typeof entry === 'string' || typeof entry === 'number') {
      const text = String(entry);
      return () => D.Text.P({}, [text]);
    }
    if (isObj(entry)) {
      const snapshot = cloneNode(entry);
      return () => cloneNode(snapshot);
    }
    return () => null;
  }

  function normalizeSections(overrides) {
    const defaults = {};
    const normalized = {};
    Object.keys(DefaultSections).forEach((key) => {
      const fn = toFactory(DefaultSections[key]);
      defaults[key] = fn;
      normalized[key] = fn;
    });
    const custom = ensureDict(overrides);
    Object.keys(custom).forEach((key) => {
      normalized[key] = toFactory(custom[key]);
    });
    return { normalized, defaults };
  }

  function resolveLayout(name) {
    const key = String(name || 'aurora').toLowerCase();
    return { key, render: Layouts[key] || Layouts.aurora };
  }

  function buildDefaultDB(cfg) {
    const lang = cfg.lang || 'ar';
    const theme = cfg.theme || 'light';
    const dir = cfg.dir || (lang === 'ar' ? 'rtl' : 'ltr');
    return {
      head: { title: cfg.title || 'Mishkah Template' },
      env: { theme, lang, dir },
      i18n: { lang, fallback: 'en', dict: {} },
      data: {},
      ui: { sidebarOpen: false }
    };
  }

  function buildRenderer(cfg, copy, sections, defaults) {
    const { key, render: layout } = resolveLayout(cfg.layout);
    return function TemplateBody(db) {
      const context = {
        db,
        cfg,
        copy,
        layout: key,
        sections,
        defaults,
        helpers: helperBag,
        render: null
      };
      context.render = function renderSlot(name, fallback) {
        const factory = sections[name];
        let node = null;
        if (typeof factory === 'function') {
          node = factory(context);
        }
        if (!node && typeof fallback === 'function') {
          return fallback(context);
        }
        return node || null;
      };
      return layout(context);
    };
  }

  function createTemplateApp(options) {
    const cfg = Object.assign({}, DEFAULT_OPTIONS, ensureDict(options));
    const copy = mergeDeep(DEFAULT_COPY, ensureDict(cfg.copy));
    const { normalized: sections, defaults } = normalizeSections(cfg.sections);
    const renderer = buildRenderer(cfg, copy, sections, defaults);
    injectBaseStyles();

    const database = isObj(cfg.database)
      ? mergeDeep(buildDefaultDB(cfg), cfg.database)
      : buildDefaultDB(cfg);

    M.app.setBody(renderer);
    const orders = Object.assign({}, TemplateOrders, ensureDict(cfg.orders));
    const app = M.app.createApp(database, orders);
    const auto = U.twcss.auto(database, app, { pageScaffold: cfg.scaffold !== false, fonts: cfg.fonts });
    app.setOrders(Object.assign({}, UI.orders, auto.orders, orders));
    app.mount(cfg.mount || '#app');
    return app;
  }

  function AppPage(config) {
    const cfg = Object.assign({}, DEFAULT_OPTIONS, ensureDict(config));
    const copy = mergeDeep(DEFAULT_COPY, ensureDict(cfg.copy));
    const { normalized: sections, defaults } = normalizeSections(cfg.sections);
    injectBaseStyles();
    return buildRenderer(cfg, copy, sections, defaults);
  }

  injectBaseStyles();

  M.Templates = Object.assign(M.Templates || {}, {
    layouts: Layouts,
    sections: DefaultSections,
    orders: TemplateOrders,
    defaultCopy: DEFAULT_COPY,
    create: createTemplateApp,
    bootstrap: createTemplateApp,
    AppPage,
    buildDB: buildDefaultDB
  });

})(typeof window !== 'undefined' ? window : this);
