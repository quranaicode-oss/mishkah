(function (window) {
  'use strict';

  const M = window.Mishkah = window.Mishkah || {};
  const Templates = M.templates = M.templates || {};
  const U = M.utils = M.utils || {};
  const twApi = U.twcss || {};
  const tw = typeof twApi.tw === 'function' ? twApi.tw : (value) => value;
  const cx = typeof twApi.cx === 'function' ? twApi.cx : (...args) => args.filter(Boolean).join(' ');

  const ensureDict = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : {});
  const ensureArray = (value) => (Array.isArray(value) ? value : []);

  function getPages(db) {
    return ensureArray(db?.data?.pages || db?.pages || []).slice().sort((a, b) => {
      const orderA = Number.isFinite(a?.order) ? a.order : 0;
      const orderB = Number.isFinite(b?.order) ? b.order : 0;
      return orderA - orderB;
    });
  }

  function getClasses(db) {
    return ensureArray(db?.data?.pageClasses || []).slice().sort((a, b) => {
      const orderA = Number.isFinite(a?.sort) ? a.sort : 0;
      const orderB = Number.isFinite(b?.sort) ? b.sort : 0;
      return orderA - orderB;
    });
  }

  function buildClassTree(classList) {
    const map = {};
    const roots = [];
    ensureArray(classList).forEach((entry) => {
      if (!entry || !entry.key) return;
      const node = Object.assign({}, entry, { children: [], pages: [] });
      map[entry.key] = node;
    });
    Object.keys(map).forEach((key) => {
      const node = map[key];
      const parentKey = node.parent || node.parentKey || node.parent_id || null;
      if (parentKey && map[parentKey]) {
        node.parentKey = parentKey;
        map[parentKey].children.push(node);
      } else {
        node.parentKey = null;
        roots.push(node);
      }
    });
    return { roots, map };
  }

  function attachPagesToTree(tree, pages) {
    const list = ensureArray(pages);
    list.forEach((page) => {
      if (!page || !page.key || !page.classKey) return;
      const node = tree.map[page.classKey];
      if (node) {
        node.pages = node.pages || [];
        node.pages.push(page);
      }
    });
  }

  function collectPages(node, includeChildren) {
    if (!node) return [];
    const items = [];
    if (Array.isArray(node.pages)) {
      items.push(...node.pages);
    }
    if (includeChildren && Array.isArray(node.children)) {
      node.children.forEach((child) => {
        items.push(...collectPages(child, true));
      });
    }
    return items;
  }

  function getActivePage(pages, activeKey) {
    if (!Array.isArray(pages) || !pages.length) return null;
    return pages.find((page) => page && page.key === activeKey) || pages[0];
  }

  function callPageComponent(registry, page, db) {
    if (!page) return null;
    if (typeof page.dsl === 'function') {
      return page.dsl(db);
    }
    const compName = page.comp || page.component;
    if (!compName) return null;
    const comp = registry && registry[compName];
    if (typeof comp === 'function') {
      return comp(db, { tw, cx }) || null;
    }
    return null;
  }

  Templates.__pagesHelpers = {
    ensureArray,
    ensureDict,
    getPages,
    getClasses,
    buildClassTree,
    attachPagesToTree,
    collectPages,
    getActivePage,
    callPageComponent,
    tw,
    cx
  };
}(typeof window !== 'undefined' ? window : this));
