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

  function buildTabItems(pages, lang, fallback, activeKey) {
    return ensureArray(pages).map((page) => {
      const label = localizeText(page.label, lang, fallback) || page.key;
      return {
        id: page.key,
        label,
        icon: page.icon || '',
        active: page.key === activeKey
      };
    });
  }

  function PagesTabsBottomRender(db) {
    const lang = db?.env?.lang || db?.i18n?.lang || 'ar';
    const fallback = lang === 'ar' ? 'en' : 'ar';
    const registry = ensureDict(db?.registry);

    const pages = getPages(db);
    const classes = getClasses(db);
    const classTree = buildClassTree(classes);
    attachPagesToTree(classTree, pages);

    const activeKey = db?.data?.active || (pages[0] && pages[0].key) || null;
    const activePage = getActivePage(pages, activeKey);
    const activeTitle = localizeText(activePage?.label, lang, fallback) || (activePage?.key || '');
    const activeDesc = localizeText(activePage?.desc, lang, fallback);

    const classNode = activePage?.classKey ? classTree.map?.[activePage.classKey] : null;
    const tabSource = classNode ? collectPages(classNode, false) : pages;
    const tabItems = buildTabItems(tabSource.length ? tabSource : pages, lang, fallback, activeKey);

    const navButtons = tabItems.map((item) => {
      const labelText = `${item.icon ? `${item.icon} ` : ''}${item.label}`;
      return UI.Button({
        attrs: {
          gkey: `pages:go:${item.id}`,
          'data-pagekey': item.id,
          class: tw`flex-1 rounded-full`
        },
        variant: item.active ? 'solid' : 'ghost',
        size: 'sm'
      }, [labelText]);
    });

    const navBar = D.Containers.Footer({
      attrs: {
        class: tw`sticky bottom-4 mx-auto flex w-full max-w-3xl items-center gap-2 rounded-full border border-[color-mix(in_oklab,var(--border)50%,transparent)] bg-[color-mix(in_oklab,var(--surface-1)96%,transparent)] p-2 shadow-[0_20px_44px_-30px_rgba(15,23,42,0.45)]`
      }
    }, navButtons);

    const activeBody = callPageComponent(registry, activePage, db) || UI.EmptyState?.({ icon: '📱', title: activeTitle }) || null;

    const contentCard = D.Containers.Section({
      attrs: { class: tw`space-y-4 rounded-3xl border border-[color-mix(in_oklab,var(--border)55%,transparent)] bg-[color-mix(in_oklab,var(--surface-1)96%,transparent)] p-6 shadow-[0_26px_58px_-32px_rgba(15,23,42,0.5)]` }
    }, [
      D.Containers.Div({ attrs: { class: tw`space-y-2 text-center` } }, [
        D.Text.H1({ attrs: { class: tw`text-3xl font-semibold` } }, [activeTitle]),
        activeDesc ? D.Text.P({ attrs: { class: tw`text-sm text-[var(--muted-foreground)]` } }, [activeDesc]) : null
      ].filter(Boolean)),
      D.Containers.Div({ attrs: { class: tw`mt-4` } }, [activeBody])
    ]);

    return D.Containers.Main({
      attrs: { class: tw`relative mx-auto flex min-h-[70vh] w-full max-w-4xl flex-col gap-5 px-4 pb-20 pt-6` }
    }, [contentCard, navBar]);
  }

  const BaseShell = Templates.PagesShell;

  const PagesTabsBottom = {
    meta: {
      icon: '📱',
      label: { ar: 'تبويبات سفلية', en: 'Bottom tabs' },
      title: 'Bottom tabs shell'
    },
    render: PagesTabsBottomRender,
    createOrders(database) {
      if (BaseShell && typeof BaseShell.createOrders === 'function') {
        return BaseShell.createOrders(database);
      }
      return {};
    }
  };

  Templates.PagesTabsBottom = PagesTabsBottom;
}(typeof window !== 'undefined' ? window : this));
