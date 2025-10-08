(function (window) {
  'use strict';

  const M = window.Mishkah = window.Mishkah || {};
  const Templates = M.templates = M.templates || {};
  const D = M.DSL;
  const UI = M.UI || {};
  const helpers = Templates.__pagesHelpers || {};

  const ensureArray = helpers.ensureArray || ((value) => (Array.isArray(value) ? value : []));
  const ensureDict = helpers.ensureDict || ((value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : {}));
  const getPages = helpers.getPages || ((db) => ensureArray(db?.data?.pages || db?.pages || []));
  const getClasses = helpers.getClasses || ((db) => ensureArray(db?.data?.pageClasses || []));
  const buildClassTree = helpers.buildClassTree || ((list) => ({ roots: ensureArray(list), map: {} }));
  const attachPagesToTree = helpers.attachPagesToTree || (() => {});
  const collectPages = helpers.collectPages || ((node) => ensureArray(node?.pages));
  const getActivePage = helpers.getActivePage || ((pages, key) => (ensureArray(pages).find((page) => page && page.key === key) || ensureArray(pages)[0] || null));
  const callPageComponent = helpers.callPageComponent || (() => null);
  const tw = helpers.tw || ((value) => value);

  function localizeText(entry, lang, fallback) {
    if (!entry) return '';
    if (typeof entry === 'string') return entry;
    const dict = ensureDict(entry);
    return dict[lang] || dict[fallback] || dict.en || dict.ar || Object.values(dict)[0] || '';
  }

  function buildSdkNav(tree, lang, fallback, activeKey) {
    const sections = [];
    ensureArray(tree.roots).forEach((root) => {
      const pages = collectPages(root, true);
      if (!pages.length) return;
      const groupItems = pages.map((page) => {
        const label = `${page.icon ? `${page.icon} ` : ''}${localizeText(page.label, lang, fallback)}`;
        return D.Lists.Li({ attrs: { class: tw`list-none` } }, [
          UI.Button({
            attrs: {
              gkey: `pages:go:${page.key}`,
              'data-pagekey': page.key,
              class: tw`w-full justify-start`
            },
            variant: page.key === activeKey ? 'solid' : 'ghost',
            size: 'sm'
          }, [label])
        ]);
      });
      sections.push(D.Containers.Section({
        attrs: {
          key: `sdk-nav-${root.key}`,
          class: tw`space-y-3 rounded-2xl border border-[color-mix(in_oklab,var(--border)55%,transparent)] bg-[color-mix(in_oklab,var(--surface-1)94%,transparent)] p-4`
        }
      }, [
        D.Text.H3({ attrs: { class: tw`text-sm font-semibold uppercase tracking-[0.24em] text-[var(--muted-foreground)]` } }, [localizeText(root.label, lang, fallback)]),
        root.desc ? D.Text.P({ attrs: { class: tw`text-xs text-[var(--muted-foreground)]` } }, [localizeText(root.desc, lang, fallback)]) : null,
        D.Lists.Ul({ attrs: { class: tw`space-y-2` } }, groupItems)
      ].filter(Boolean)));
    });
    return sections;
  }

  function buildMetaSection(activePage, lang, fallback, tree) {
    const rows = [];
    if (!activePage) return rows;

    const desc = localizeText(activePage.desc, lang, fallback);
    if (desc) {
      rows.push(D.Containers.Div({ attrs: { class: tw`rounded-2xl bg-[color-mix(in_oklab,var(--surface-2)80%,transparent)] p-4` } }, [
        D.Text.P({ attrs: { class: tw`text-sm leading-relaxed text-[color-mix(in_oklab,var(--foreground)92%,transparent)]` } }, [desc])
      ]));
    }

    const classNode = activePage.classKey && tree.map ? tree.map[activePage.classKey] : null;
    if (classNode) {
      rows.push(D.Containers.Div({ attrs: { class: tw`rounded-2xl border border-[color-mix(in_oklab,var(--border)55%,transparent)] bg-[color-mix(in_oklab,var(--surface-1)96%,transparent)] p-4` } }, [
        D.Text.Strong({ attrs: { class: tw`text-sm text-[var(--muted-foreground)]` } }, [localizeText(classNode.label, lang, fallback)]),
        localizeText(classNode.desc, lang, fallback)
          ? D.Text.P({ attrs: { class: tw`mt-2 text-xs text-[var(--muted-foreground)]` } }, [localizeText(classNode.desc, lang, fallback)])
          : null
      ].filter(Boolean)));
    }

    if (Array.isArray(activePage.keywords) && activePage.keywords.length) {
      rows.push(D.Containers.Div({ attrs: { class: tw`rounded-2xl border border-[color-mix(in_oklab,var(--border)55%,transparent)] bg-[color-mix(in_oklab,var(--surface-1)96%,transparent)] p-4` } }, [
        D.Text.Strong({ attrs: { class: tw`text-xs uppercase tracking-[0.3em] text-[var(--muted-foreground)]` } }, [lang === 'ar' ? 'الكلمات المفتاحية' : 'Keywords']),
        D.Lists.Ul({ attrs: { class: tw`mt-3 flex flex-wrap gap-2` } }, activePage.keywords.map((word, idx) => D.Lists.Li({ attrs: { key: `kw-${idx}`, class: tw`list-none` } }, [
          D.Text.Span({ attrs: { class: tw`rounded-full border border-[color-mix(in_oklab,var(--border)60%,transparent)] bg-[color-mix(in_oklab,var(--surface-1)94%,transparent)] px-3 py-1 text-xs text-[var(--muted-foreground)]` } }, [word])
        ])))
      ]));
    }

    const related = classNode ? collectPages(classNode, false).filter((page) => page && page.key !== activePage.key) : [];
    if (related.length) {
      rows.push(D.Containers.Div({ attrs: { class: tw`rounded-2xl border border-[color-mix(in_oklab,var(--border)55%,transparent)] bg-[color-mix(in_oklab,var(--surface-1)96%,transparent)] p-4` } }, [
        D.Text.Strong({ attrs: { class: tw`text-xs uppercase tracking-[0.3em] text-[var(--muted-foreground)]` } }, [lang === 'ar' ? 'صفحات مرتبطة' : 'Related pages']),
        D.Lists.Ul({ attrs: { class: tw`mt-3 space-y-2` } }, related.map((page) => D.Lists.Li({ attrs: { class: tw`list-none` } }, [
          UI.Button({
            attrs: {
              gkey: `pages:go:${page.key}`,
              'data-pagekey': page.key,
              class: tw`w-full justify-start`
            },
            variant: 'ghost',
            size: 'sm'
          }, [`${page.icon ? `${page.icon} ` : ''}${localizeText(page.label, lang, fallback)}`])
        ])))
      ]));
    }

    return rows;
  }

  function PagesSdkRender(db) {
    const lang = db?.env?.lang || db?.i18n?.lang || 'ar';
    const fallback = lang === 'ar' ? 'en' : 'ar';
    const registry = ensureDict(db?.registry);

    const pages = getPages(db);
    const classes = getClasses(db);
    const classTree = buildClassTree(classes);
    attachPagesToTree(classTree, pages);

    const activeKey = db?.data?.active || (pages[0] && pages[0].key) || null;
    const activePage = getActivePage(pages, activeKey);

    const navSections = buildSdkNav(classTree, lang, fallback, activeKey);

    const activeTitle = localizeText(activePage?.label, lang, fallback) || (activePage?.key || '');
    const activeBody = callPageComponent(registry, activePage, db) || UI.EmptyState?.({ icon: '📘', title: activeTitle }) || null;
    const metaSections = buildMetaSection(activePage, lang, fallback, classTree);

    const contentCard = D.Containers.Section({
      attrs: {
        class: tw`space-y-6 rounded-3xl border border-[color-mix(in_oklab,var(--border)55%,transparent)] bg-[color-mix(in_oklab,var(--surface-1)96%,transparent)] p-6 shadow-[0_24px_56px_-32px_rgba(15,23,42,0.45)]`
      }
    }, [
      D.Containers.Div({ attrs: { class: tw`space-y-3` } }, [
        D.Text.Span({ attrs: { class: tw`text-xs font-semibold uppercase tracking-[0.32em] text-[var(--muted-foreground)]` } }, [lang === 'ar' ? 'مكتبة SDK' : 'SDK Library']),
        D.Text.H1({ attrs: { class: tw`text-3xl font-bold` } }, [activeTitle])
      ]),
      D.Containers.Div({ attrs: { class: tw`prose prose-slate max-w-none dark:prose-invert` } }, [activeBody])
    ]);

    const metaColumn = metaSections.length
      ? D.Containers.Div({ attrs: { class: tw`space-y-4` } }, metaSections)
      : null;

    return D.Containers.Main({
      attrs: { class: tw`mx-auto grid w-full max-w-7xl gap-6 px-4 py-6 xl:grid-cols-[minmax(0,280px)_minmax(0,1fr)_minmax(0,280px)]` }
    }, [
      D.Containers.Aside({ attrs: { class: tw`space-y-4` } }, navSections),
      contentCard,
      metaColumn
    ].filter(Boolean));
  }

  const BaseShell = Templates.PagesShell;

  const PagesSdk = {
    meta: {
      icon: '🧰',
      label: { ar: 'دليل SDK', en: 'SDK Guide' },
      title: 'SDK oriented shell'
    },
    render: PagesSdkRender,
    createOrders(database) {
      if (BaseShell && typeof BaseShell.createOrders === 'function') {
        return BaseShell.createOrders(database);
      }
      return {};
    }
  };

  Templates.PagesSdk = PagesSdk;
}(typeof window !== 'undefined' ? window : this));
