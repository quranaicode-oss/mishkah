/* global window, database */
(function (window) {
  'use strict';

  const M = window.Mishkah || {};
  const Core = M.Core;
  const POSC = window.POSC || {};
  if (!Core || !POSC) {
    console.warn('[POS] Mishkah core or POS components missing.');
    return;
  }

  const data = window.database || {};
  const toArr = (v) => (Array.isArray(v) ? v : v == null ? [] : [v]);

  const buildInitialOrder = () => ({
    id: `ord-${Date.now()}`,
    type: 'dine_in',
    status: 'new',
    table_ids: [],
    lines: [],
    discount_total: 0,
    service: 0,
    delivery_fee: 0,
    vat: 0,
    subtotal: 0,
    grand_total: 0
  });

  const initialState = () => ({
    settings: Object.assign({}, data.settings || {}),
    catalog: {
      categories: toArr(data.categories),
      items: toArr(data.items)
    },
    employees: toArr(data.employees),
    tables: toArr(data.tables),
    session: {
      cashier: toArr(data.employees)[0] || null,
      shift: { id: 'S-' + new Date().toISOString().slice(11, 19).replace(/:/g, '') }
    },
    order: buildInitialOrder(),
    ui: {
      menu: { category: 'all', query: '' },
      modal: { active: null, payload: null },
      toasts: []
    }
  });

  function computeTotals(order, settings) {
    const subtotal = toArr(order.lines).reduce((sum, line) => sum + (line.qty * line.price) + (line.modDelta || 0), 0);
    const serviceRate = settings?.service_charge_rate || 0;
    const taxRate = settings?.tax_rate || 0;
    const service = +(subtotal * serviceRate).toFixed(2);
    const taxable = subtotal + service - (order.discount_total || 0);
    const vat = +(taxable * taxRate).toFixed(2);
    const grand_total = +(subtotal + service + (order.delivery_fee || 0) + vat - (order.discount_total || 0)).toFixed(2);
    return Object.assign({}, order, {
      subtotal: +subtotal.toFixed(2),
      service,
      vat,
      grand_total
    });
  }

  function itemTitle(item, locale) {
    const translations = item?.translations || {};
    return translations[locale]?.name || translations.en?.name || item?.name || `#${item?.id}`;
  }

  function pushToast(state, toast) {
    const next = Object.assign({}, state);
    const list = toArr(next.ui?.toasts).slice();
    list.push(Object.assign({ id: `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` }, toast));
    next.ui = Object.assign({}, next.ui, { toasts: list });
    return next;
  }

  const commands = {
    boot({ truth }) {
      truth.batch(() => {
        truth.mark('pos-header');
        truth.mark('menu-panel');
        truth.mark('order-panel');
        truth.mark('footer-bar');
        truth.mark('modals-root');
        truth.mark('toasts-root');
      });
    },

    setMenuQuery({ truth }, event) {
      const value = event?.target?.value || '';
      truth.set((state) => {
        const nextMenu = Object.assign({}, state.ui.menu, { query: value });
        return Object.assign({}, state, { ui: Object.assign({}, state.ui, { menu: nextMenu }) });
      });
      truth.mark('menu-panel');
    },

    setCategory({ truth }, event) {
      const id = event?.currentTarget?.dataset?.tab || event?.currentTarget?.dataset?.category || 'all';
      truth.set((state) => {
        const nextMenu = Object.assign({}, state.ui.menu, { category: id });
        return Object.assign({}, state, { ui: Object.assign({}, state.ui, { menu: nextMenu }) });
      });
      truth.mark('menu-panel');
    },

    setOrderType({ truth }, event) {
      const type = event?.currentTarget?.dataset?.type || 'dine_in';
      truth.set((state) => Object.assign({}, state, { order: Object.assign({}, state.order, { type }) }));
      truth.mark('pos-header');
      truth.mark('footer-bar');
    },

    toggleTheme({ env }) {
      env?.toggleTheme && env.toggleTheme();
    },

    toggleLocale({ env }) {
      const current = env?.get?.().locale || 'en';
      const next = current.startsWith('ar') ? 'en' : 'ar';
      env?.setLocale && env.setLocale(next);
    },

    addItemToOrder({ truth, env }, event) {
      const itemId = Number(event?.currentTarget?.dataset?.itemId);
      if (!itemId) return;
      truth.batch(() => {
        truth.set((state) => {
          const locale = env?.get?.().locale || 'en';
          const item = toArr(state.catalog.items).find((it) => Number(it.id) === itemId);
          if (!item) return state;
          const existing = state.order.lines.find((line) => Number(line.item_id) === itemId);
          let lines;
          if (existing) {
            lines = state.order.lines.map((line) => (Number(line.item_id) === itemId ? Object.assign({}, line, { qty: line.qty + 1 }) : line));
          } else {
            lines = state.order.lines.concat([{
              id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              item_id: item.id,
              title: itemTitle(item, locale),
              qty: 1,
              price: item.price,
              modDelta: 0,
              mods: { addons: [], removals: [] },
              notes: ''
            }]);
          }
          const nextOrder = computeTotals(Object.assign({}, state.order, { lines }), state.settings);
          return Object.assign({}, state, { order: nextOrder });
        });
        truth.mark('order-panel');
        truth.mark('footer-bar');
      });
    },

    incrementLineQty({ truth }, event) {
      const lineId = event?.currentTarget?.dataset?.lineId;
      if (!lineId) return;
      truth.batch(() => {
        truth.set((state) => {
          const lines = state.order.lines.map((line) => (line.id === lineId ? Object.assign({}, line, { qty: line.qty + 1 }) : line));
          const nextOrder = computeTotals(Object.assign({}, state.order, { lines }), state.settings);
          return Object.assign({}, state, { order: nextOrder });
        });
        truth.mark('order-panel');
        truth.mark('footer-bar');
      });
    },

    decrementLineQty({ truth }, event) {
      const lineId = event?.currentTarget?.dataset?.lineId;
      if (!lineId) return;
      truth.batch(() => {
        truth.set((state) => {
          const lines = state.order.lines
            .map((line) => (line.id === lineId ? Object.assign({}, line, { qty: Math.max(0, line.qty - 1) }) : line))
            .filter((line) => line.qty > 0);
          const nextOrder = computeTotals(Object.assign({}, state.order, { lines }), state.settings);
          return Object.assign({}, state, { order: nextOrder });
        });
        truth.mark('order-panel');
        truth.mark('footer-bar');
      });
    },

    removeLine({ truth }, event) {
      const lineId = event?.currentTarget?.dataset?.lineId;
      if (!lineId) return;
      truth.batch(() => {
        truth.set((state) => {
          const lines = state.order.lines.filter((line) => line.id !== lineId);
          const nextOrder = computeTotals(Object.assign({}, state.order, { lines }), state.settings);
          return Object.assign({}, state, { order: nextOrder });
        });
        truth.mark('order-panel');
        truth.mark('footer-bar');
      });
    },

    openNumpadModal({ truth }, event) {
      const lineId = event?.currentTarget?.dataset?.lineId;
      if (!lineId) return;
      truth.set((state) => {
        const line = state.order.lines.find((l) => l.id === lineId);
        if (!line) return state;
        const modal = { active: 'numpad', payload: { lineId, buffer: String(line.qty) } };
        return Object.assign({}, state, { ui: Object.assign({}, state.ui, { modal }) });
      });
      truth.mark('modals-root');
    },

    closeModal({ truth }) {
      truth.set((state) => Object.assign({}, state, { ui: Object.assign({}, state.ui, { modal: { active: null, payload: null } }) }));
      truth.mark('modals-root');
    },

    numpadInput({ truth }, value) {
      truth.set((state) => {
        const modal = Object.assign({}, state.ui.modal, { payload: Object.assign({}, state.ui.modal.payload, { buffer: String(value || '') }) });
        return Object.assign({}, state, { ui: Object.assign({}, state.ui, { modal }) });
      });
      truth.mark('modals-root');
    },

    numpadConfirm({ truth }, value) {
      truth.batch(() => {
        truth.set((state) => {
          const modal = state.ui.modal || {};
          const lineId = modal.payload?.lineId;
          const qty = Math.max(0, parseInt(value, 10) || 0);
          const lines = state.order.lines
            .map((line) => (line.id === lineId ? Object.assign({}, line, { qty }) : line))
            .filter((line) => line.qty > 0);
          const nextOrder = computeTotals(Object.assign({}, state.order, { lines }), state.settings);
          const nextUI = Object.assign({}, state.ui, { modal: { active: null, payload: null } });
          return Object.assign({}, state, { order: nextOrder, ui: nextUI });
        });
        truth.mark('order-panel');
        truth.mark('footer-bar');
        truth.mark('modals-root');
      });
    },

    openLineActions({ truth }, event) {
      const lineId = event?.currentTarget?.dataset?.lineId;
      if (!lineId) return;
      truth.set((state) => {
        const modal = { active: 'numpad', payload: { lineId, buffer: String(state.order.lines.find((l) => l.id === lineId)?.qty || 1) } };
        return Object.assign({}, state, { ui: Object.assign({}, state.ui, { modal }) });
      });
      truth.mark('modals-root');
    },

    finalizeOrder({ truth, env }) {
      truth.batch(() => {
        truth.set((state) => {
          const toast = {
            intent: 'success',
            title: env?.get?.().locale === 'ar' ? 'تم التحصيل' : 'Payment complete',
            message: env?.get?.().locale === 'ar' ? 'تم إغلاق الطلب وطباعته.' : 'Order settled and printed.'
          };
          const cleared = buildInitialOrder();
          cleared.type = state.order.type;
          return pushToast(Object.assign({}, state, { order: computeTotals(cleared, state.settings) }), toast);
        });
        truth.mark('toasts-root');
        truth.mark('order-panel');
        truth.mark('footer-bar');
      });
    },

    dismissToast({ truth }, event) {
      const id = event?.currentTarget?.dataset?.toastId || event?.currentTarget?.dataset?.id || event?.detail?.id;
      truth.set((state) => {
        const list = toArr(state.ui.toasts).filter((toast) => toast.id !== id);
        return Object.assign({}, state, { ui: Object.assign({}, state.ui, { toasts: list }) });
      });
      truth.mark('toasts-root');
    }
  };

  const app = Core.createApp({
    root: '#app',
    initial: initialState(),
    commands,
    register({ registerRegion, env, i18n, truth }) {
      const makeCtx = (ctx) => Object.assign({}, ctx, { env, i18n, dispatch: app.dispatch.bind(app) });
      registerRegion('pos-header', '#pos-header', (state, ctx) => POSC.HeaderRegion(state, makeCtx(ctx)), null, { priority: 'high', budget: { maxMs: 8 } });
      registerRegion('menu-panel', '#menu-panel', (state, ctx) => POSC.MenuRegion(state, makeCtx(ctx)), null, { priority: 'high', budget: { maxMs: 12 } });
      registerRegion('order-panel', '#order-panel', (state, ctx) => POSC.OrderRegion(state, makeCtx(ctx)), null, { priority: 'high', budget: { maxMs: 12 } });
      registerRegion('footer-bar', '#footer-bar', (state, ctx) => POSC.FooterRegion(state, makeCtx(ctx)), null, { priority: 'high', budget: { maxMs: 6 } });
      registerRegion('modals-root', '#modals-root', (state, ctx) => POSC.ModalsRegion(state, makeCtx(ctx)), null, { priority: 'normal', budget: { maxMs: 8 } });
      registerRegion('toasts-root', '#toasts-root', (state, ctx) => POSC.ToastsRegion(state, makeCtx(ctx)), null, { priority: 'low', budget: { maxMs: 4 } });
    }
  });

  window.app = app;
  app.dispatch('boot');
})(window);
