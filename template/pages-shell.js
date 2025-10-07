(function (window) {
  'use strict';

  const M = window.Mishkah = window.Mishkah || {};
  const Templates = M.templates = M.templates || {};
  const D = M.DSL;
  const UI = M.UI;
  const U = M.utils = M.utils || {};
  const { tw, cx } = U.twcss;

  const ensureArray = (value) => (Array.isArray(value) ? value.slice() : []);

  const helpers = { tw, cx };

  function callComponent(registry, name, db) {
    if (!name) return null;
    const comp = registry && registry[name];
    if (typeof comp === 'function') {
      return comp(db, helpers) || null;
    }
    return null;
  }

  function renderNavButton(page, activeKey, orientation) {
    const key = page.key;
    const label = page.label || {};
    const icon = page.icon || '';
    const isActive = key === activeKey;
    const baseClasses = orientation === 'mobile'
      ? tw`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition` + ' flex items-center gap-2'
      : tw`w-full justify-start rounded-xl px-4 py-3 font-semibold text-sm transition` + ' flex items-center gap-3';
    const activeClasses = orientation === 'mobile'
      ? tw`bg-[var(--primary)] text-[var(--primary-foreground)] shadow`
      : tw`bg-[color-mix(in_oklab,var(--primary)75%,transparent)] text-[var(--primary-foreground)] shadow`;
    const inactiveClasses = orientation === 'mobile'
      ? tw`bg-[color-mix(in_oklab,var(--surface-1)80%,transparent)] text-[var(--foreground)]`
      : tw`bg-[color-mix(in_oklab,var(--surface-1)85%,transparent)] text-[var(--foreground)] hover:bg-[color-mix(in_oklab,var(--primary)12%,transparent)]`;
    const buttonLabel = label.title || label.ar || label.en || key;

    return UI.Button({
      attrs: {
        gkey: `pages:go:${key}`,
        'data-pagekey': key,
        class: cx(baseClasses, isActive ? activeClasses : inactiveClasses)
      },
      variant: 'ghost',
      size: orientation === 'mobile' ? 'sm' : 'md'
    }, [icon ? `${icon} ${buttonLabel}` : buttonLabel]);
  }

  function renderNavigation(db, pages, activeKey) {
    const mobileNav = D.Containers.Nav({
      attrs: {
        class: tw`md:hidden px-4 pt-4 pb-2 overflow-x-auto`
      }
    }, [
      D.Lists.Ul({
        attrs: {
          class: tw`flex items-center gap-2 min-w-max`
        }
      }, pages.map((page) => D.Lists.Li({ attrs: { key: `m-${page.key}` } }, [
        renderNavButton(page, activeKey, 'mobile')
      ])))
    ]);

    const sideNav = D.Containers.Aside({
      attrs: {
        class: tw`hidden md:flex md:w-[240px] md:flex-col md:border-s md:border-[color-mix(in_oklab,var(--border)60%,transparent)] md:pe-4`
      }
    }, [
      D.Containers.Nav({
        attrs: {
          class: tw`sticky top-24 flex flex-col gap-2`
        }
      }, pages.map((page) => renderNavButton(page, activeKey, 'desktop')))
    ]);

    return { mobileNav, sideNav };
  }

  function renderPage(db, registry, pages, activeKey) {
    const activePage = pages.find((page) => page && page.key === activeKey) || pages[0];
    if (!activePage) {
      return D.Containers.Section({ attrs: { class: tw`p-6` } }, [
        UI.EmptyState({
          icon: '📄',
          title: 'No page',
          message: 'لم يتم تعريف أي صفحة في القالب.'
        })
      ]);
    }

    const body = activePage.dsl && typeof activePage.dsl === 'function'
      ? activePage.dsl(db, helpers)
      : callComponent(registry, activePage.comp, db);

    return D.Containers.Section({
      attrs: {
        class: tw`flex-1`,
        'data-pagekey': activePage.key
      }
    }, [body].filter(Boolean));
  }

  const PagesShell = {
    render(db) {
      const registry = db.registry || (db.data && db.data.registry) || {};
      const slots = db.slots || (db.data && db.data.slots) || {};
      const pages = ensureArray((db.data && db.data.pages) || db.pages).sort((a, b) => {
        const aOrder = typeof a.order === 'number' ? a.order : 0;
        const bOrder = typeof b.order === 'number' ? b.order : 0;
        return aOrder - bOrder;
      });
      const activeKey = (db.data && db.data.active) || (pages[0] && pages[0].key) || null;

      const headerNode = callComponent(registry, slots.header, db);
      const footerNode = callComponent(registry, slots.footer, db);

      const { mobileNav, sideNav } = renderNavigation(db, pages, activeKey);
      const pageNode = renderPage(db, registry, pages, activeKey);

      return D.Containers.Div({
        attrs: {
          class: tw`min-h-screen bg-[color-mix(in_oklab,var(--background)96%,transparent)] text-[var(--foreground)]`
        }
      }, [
        headerNode ? D.Containers.Header({ attrs: { class: tw`shadow-sm` } }, [headerNode]) : null,
        mobileNav,
        D.Containers.Main({
          attrs: {
            class: tw`flex-1` + ' ' + tw`px-4 pb-10`
          }
        }, [
          D.Containers.Div({
            attrs: {
              class: tw`mx-auto flex w-full max-w-6xl flex-col gap-6 md:flex-row`
            }
          }, [
            sideNav,
            D.Containers.Section({
              attrs: {
                class: tw`flex-1`
              }
            }, [
              D.Containers.Div({
                attrs: {
                  class: tw`rounded-3xl border border-[color-mix(in_oklab,var(--border)50%,transparent)] bg-[color-mix(in_oklab,var(--surface-1)90%,transparent)] p-6 shadow-sm`
                }
              }, [pageNode])
            ])
          ])
        ]),
        footerNode ? D.Containers.Footer({ attrs: { class: tw`mt-auto border-t border-[color-mix(in_oklab,var(--border)50%,transparent)] bg-[color-mix(in_oklab,var(--surface-1)92%,transparent)]` } }, [footerNode]) : null
      ].filter(Boolean));
    },

    createNavOrders(pages) {
      const list = ensureArray(pages);
      return list.reduce((acc, page) => {
        if (!page || !page.key) return acc;
        const key = page.key;
        acc[`pages.go.${key}`] = {
          on: ['click'],
          gkeys: [`pages:go:${key}`],
          handler: (event, context) => {
            const state = context.getState();
            context.setState((prev) => ({
              ...prev,
              data: {
                ...prev.data,
                active: key
              }
            }));
            context.rebuild();
          }
        };
        return acc;
      }, {});
    }
  };

  Templates.PagesShell = PagesShell;
})(typeof window !== 'undefined' ? window : this);

