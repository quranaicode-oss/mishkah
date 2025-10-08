(function (window) {
  'use strict';

  const M = window.Mishkah = window.Mishkah || {};
  const Templates = M.templates = M.templates || {};
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
  const cx = helpers.cx || ((...args) => args.filter(Boolean).join(' '));

  function localizeText(entry, lang, fallback) {
    if (!entry) return '';
    if (typeof entry === 'string') return entry;
    const dict = ensureDict(entry);
    return dict[lang] || dict[fallback] || dict.en || dict.ar || Object.values(dict)[0] || '';
  }

  function firstPageFromNode(node) {
    const pages = collectPages(node, true);
    return pages.length ? pages[0] : null;
  }

  function PagesTopNavRender(db) {
    const lang = db?.env?.lang || db?.i18n?.lang || 'ar';
    const fallback = lang === 'ar' ? 'en' : 'ar';
    const registry = ensureDict(db?.registry);

    const pages = getPages(db);
    const classes = getClasses(db);
    const classTree = buildClassTree(classes);
    attachPagesToTree(classTree, pages);

    const activeKey = db?.data?.active || (pages[0] && pages[0].key) || null;
    const activePage = getActivePage(pages, activeKey);
    const activeClassKey = activePage && activePage.classKey;
    const activeClassNode = activeClassKey && classTree.map ? classTree.map[activeClassKey] : null;

    const classButtons = ensureArray(classTree.roots).map((node) => {
      const firstPage = firstPageFromNode(node);
      if (!firstPage) return null;
      const isActive = collectPages(node, true).some((page) => page && page.key === activeKey);
      const label = `${node.icon ? `${node.icon} ` : ''}${localizeText(node.label, lang, fallback)}`;
      return UI.Button({
        attrs: {
          gkey: 'index:class:activate',
          'data-class-key': node.key,
          'data-class-first': firstPage.key,
          class: tw`rounded-full`
        },
        variant: isActive ? 'solid' : 'soft',
        size: 'sm'
      }, [label]);
    }).filter(Boolean);

    const pageSourceNode = activeClassNode || classTree.roots.find((node) => collectPages(node, true).length) || null;
    const displayPages = pageSourceNode ? collectPages(pageSourceNode, true) : pages;

    const pageButtons = ensureArray(displayPages).map((page) => {
      if (!page || !page.key) return null;
      const isActive = page.key === activeKey;
      const label = `${page.icon ? `${page.icon} ` : ''}${localizeText(page.label, lang, fallback)}`;
      return UI.Button({
        attrs: {
          gkey: `pages:go:${page.key}`,
          'data-pagekey': page.key,
          class: tw`rounded-full`
        },
        variant: isActive ? 'solid' : 'ghost',
        size: 'sm'
      }, [label]);
    }).filter(Boolean);

    const activeTitle = localizeText(activePage?.label, lang, fallback) || (activePage?.key || '');
    const activeDesc = localizeText(activePage?.desc, lang, fallback);
    const contentBody = callPageComponent(registry, activePage, db) || UI.EmptyState?.({ icon: '📄', title: activeTitle }) || null;

    const navSection = D.Containers.Div({
      attrs: { class: tw`space-y-3` }
    }, [
      classButtons.length ? D.Containers.Div({ attrs: { class: tw`flex flex-wrap items-center gap-2` } }, classButtons) : null,
      pageButtons.length ? D.Containers.Div({ attrs: { class: tw`flex flex-wrap items-center gap-2` } }, pageButtons) : null
    ].filter(Boolean));

    const contentSection = D.Containers.Section({
      attrs: {
        class: tw`rounded-3xl border border-[color-mix(in_oklab,var(--border)55%,transparent)] bg-[color-mix(in_oklab,var(--surface-1)95%,transparent)] p-6 shadow-[0_20px_48px_-28px_rgba(15,23,42,0.4)]`
      }
    }, [
      D.Containers.Div({ attrs: { class: tw`space-y-2` } }, [
        D.Text.H2({ attrs: { class: tw`text-2xl font-semibold` } }, [activeTitle]),
        activeDesc ? D.Text.P({ attrs: { class: tw`text-sm text-[var(--muted-foreground)]` } }, [activeDesc]) : null
      ].filter(Boolean)),
      D.Containers.Div({ attrs: { class: tw`mt-4` } }, [contentBody])
    ]);

    return D.Containers.Main({
      attrs: { class: tw`mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6` }
    }, [navSection, contentSection]);
  }

  const BaseShell = Templates.PagesShell;

  const PagesTopNav = {
    meta: {
      icon: '🧭',
      label: { ar: 'قائمة علوية', en: 'Top navigation' },
      title: 'Top navigation shell'
    },
    render: PagesTopNavRender,
    createOrders(database) {
      if (BaseShell && typeof BaseShell.createOrders === 'function') {
        return BaseShell.createOrders(database);
      }
      return {};
    }
  };

  Templates.PagesTopNav = PagesTopNav;
}(typeof window !== 'undefined' ? window : this));
