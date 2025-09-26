(function (window) {
  "use strict";

  const M = window.Mishkah || {};
  const Core = M.Core;
  const utils = M.utils || {};
  if (!Core) return;

  const db = window.database || {};
  const clone = (value) => (value ? JSON.parse(JSON.stringify(value)) : value);
  const round = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  const nextId = (prefix) => (utils.uid ? utils.uid(prefix) : `${prefix}-${Math.random().toString(36).slice(2, 9)}`);

  const baseSettings = clone(db.settings) || {
    tax_rate: 0.14,
    service_charge_rate: 0.12,
    currency: { ar: "ج.م", en: "EGP" }
  };

  function translateItem(item, locale) {
    if (!item) return { name: "—", description: "" };
    const byLocale = (item.translations && (item.translations[locale] || item.translations.en)) || {};
    return { name: byLocale.name || item.name || String(item.id), description: byLocale.description || "" };
  }

  function createOrder(type = "dine_in") {
    return {
      id: nextId("ord"),
      type,
      status: "draft",
      createdAt: new Date().toISOString(),
      tableIds: [],
      guestCount: 1,
      lines: [],
      totals: { subtotal: 0, service: 0, vat: 0, total: 0 },
      payments: []
    };
  }

  function computeTotals(lines, settings) {
    const subtotal = round((lines || []).reduce((acc, line) => acc + round((line.price || 0) * (line.qty || 0)), 0));
    const serviceRate = settings.service_charge_rate || 0;
    const taxRate = settings.tax_rate || 0;
    const service = round(subtotal * serviceRate);
    const vat = round((subtotal + service) * taxRate);
    const total = round(subtotal + service + vat);
    return { subtotal, service, vat, total };
  }

  function ensureOrder(state, type) {
    if (!state.order) {
      state.order = createOrder(type || "dine_in");
    }
    return state.order;
  }

  function getDue(state) {
    if (!state.order) return 0;
    const total = state.order.totals.total || 0;
    const paid = (state.payments.splits || []).reduce((sum, split) => sum + (split.amount || 0), 0);
    return round(Math.max(0, total - paid));
  }

  function translateKey(key, locale) {
    const section = dictionaries.ui || {};
    const entry = section[key];
    if (!entry) return key;
    return entry[locale] || entry.en || Object.values(entry)[0] || key;
  }

  function pushToast(truth, payload) {
    const id = nextId("toast");
    truth.produce((state) => {
      state.ui.toasts = state.ui.toasts || [];
      state.ui.toasts.push({ id, timeout: 3200, intent: "primary", ...payload });
    });
    truth.mark("toasts-root");
    const timeout = (payload && payload.timeout) || 3200;
    setTimeout(() => {
      truth.produce((state) => {
        const list = state.ui.toasts || [];
        const idx = list.findIndex((t) => t.id === id);
        if (idx >= 0) list.splice(idx, 1);
      });
      truth.mark("toasts-root");
    }, timeout);
  }

  function notify(truth, key, intent = "primary") {
    const locale = truth.get().env.locale || "ar";
    pushToast(truth, { title: "POS", message: translateKey(key, locale), intent });
  }

  const initialState = {
    env: {
      locale: "ar",
      dir: "rtl",
      theme: "light"
    },
    ui: {
      stage: "login",
      login: { pin: "", error: null },
      shift: { openingFloat: "" },
      menu: { category: "all", search: "" },
      overlays: { active: null, payload: null },
      toasts: []
    },
    session: {
      cashier: null,
      shift: null
    },
    settings: baseSettings,
    catalog: {
      categories: clone(db.categories) || [{ id: "all", translations: { ar: "الكل", en: "All" } }],
      items: clone(db.items) || []
    },
    modifiers: clone(db.modifiers) || {},
    tables: clone(db.tables) || [],
    drivers: clone(db.drivers) || [],
    reservations: clone(db.reservations) || [],
    order: null,
    parkedOrders: [],
    completedOrders: [],
    payments: {
      method: "cash",
      buffer: "0",
      splits: []
    }
  };

  const dictionaries = {
    ui: {
      welcome: { ar: "مرحباً بك", en: "Welcome" },
      enter_pin: { ar: "أدخل رقم التعريف الشخصي", en: "Enter access PIN" },
      login: { ar: "تسجيل الدخول", en: "Login" },
      confirm: { ar: "تأكيد", en: "Confirm" },
      clear: { ar: "مسح", en: "Clear" },
      open_shift: { ar: "فتح الوردية", en: "Open shift" },
      cashier: { ar: "الكاشير", en: "Cashier" },
      opening_float: { ar: "الرصيد الافتتاحي", en: "Opening float" },
      shift: { ar: "الوردية", en: "Shift" },
      no_shift: { ar: "لا توجد وردية مفتوحة", en: "No active shift" },
      tables: { ar: "الطاولات", en: "Tables" },
      reports: { ar: "التقارير", en: "Reports" },
      theme: { ar: "الثيم", en: "Theme" },
      language: { ar: "اللغة", en: "Language" },
      logout: { ar: "تسجيل الخروج", en: "Logout" },
      search_placeholder: { ar: "ابحث عن صنف…", en: "Search items…" },
      empty_menu_title: { ar: "لا توجد أصناف", en: "No items" },
      empty_menu_hint: { ar: "غيّر التصنيف أو كلمات البحث.", en: "Try adjusting category or search query." },
      no_active_order: { ar: "لا يوجد طلب نشط", en: "No active order" },
      current_order: { ar: "الطلب الحالي", en: "Current order" },
      table: { ar: "الطاولة", en: "Table" },
      dine_in: { ar: "صالة", en: "Dine-in" },
      takeaway: { ar: "تيك أواي", en: "Takeaway" },
      delivery: { ar: "توصيل", en: "Delivery" },
      empty_order: { ar: "السلة فارغة", en: "Cart is empty" },
      empty_order_hint: { ar: "أضف أصنافاً من القائمة لبدء الطلب.", en: "Add items from the menu to start an order." },
      subtotal: { ar: "الإجمالي", en: "Subtotal" },
      service: { ar: "الخدمة", en: "Service" },
      vat: { ar: "القيمة المضافة", en: "VAT" },
      total: { ar: "الإجمالي النهائي", en: "Grand total" },
      remaining: { ar: "المتبقي", en: "Remaining" },
      clear_order: { ar: "إلغاء الطلب", en: "Clear order" },
      park_order: { ar: "تعليق الطلب", en: "Park order" },
      settle_pay: { ar: "تحصيل الدفع", en: "Settle payment" },
      remove: { ar: "حذف", en: "Remove" },
      seats: { ar: "مقاعد", en: "Seats" },
      table_status_available: { ar: "متاحة", en: "Available" },
      table_status_occupied: { ar: "مشغولة", en: "Occupied" },
      table_status_reserved: { ar: "محجوزة", en: "Reserved" },
      table_status_offline: { ar: "خارج الخدمة", en: "Out of service" },
      paid_in_full: { ar: "تم السداد بالكامل", en: "Paid in full" },
      splits: { ar: "دفعات جزئية", en: "Splits" },
      pay_method_cash: { ar: "نقدي", en: "Cash" },
      pay_method_card: { ar: "بطاقة", en: "Card" },
      pay_method_wallet: { ar: "محفظة", en: "Wallet" },
      cash: { ar: "نقدي", en: "Cash" },
      card: { ar: "بطاقة", en: "Card" },
      wallet: { ar: "محفظة", en: "Wallet" },
      add_split: { ar: "إضافة دفعة", en: "Add split" },
      complete_payment: { ar: "إتمام الدفع", en: "Complete payment" },
      shift_summary: { ar: "ملخص الوردية", en: "Shift summary" },
      start_time: { ar: "وقت البدء", en: "Start time" },
      orders_count: { ar: "عدد الطلبات", en: "Orders count" },
      close_shift: { ar: "إغلاق الوردية", en: "Close shift" },
      reports_placeholder: { ar: "التقارير قريباً", en: "Reports coming soon" },
      reports_placeholder_hint: { ar: "سيتم إطلاق لوحة التقارير في الإصدارات المقبلة.", en: "A detailed reporting workspace will arrive soon." },
      payment_completed: { ar: "تم إغلاق الطلب", en: "Order settled" },
      payment_pending: { ar: "أكمل المبلغ المتبقي", en: "Complete the remaining amount" },
      tables_attached: { ar: "تم ربط الطاولة", en: "Table linked" },
      payment_added: { ar: "تمت إضافة الدفعة", en: "Split added" },
      payment_removed: { ar: "تم حذف الدفعة", en: "Split removed" }
    }
  };

  const commands = {
    "auth.pinKey": ({ truth }, event, el) => {
      const key = el.getAttribute("data-key");
      truth.produce((state) => {
        if (state.ui.stage !== "login") return;
        const pin = state.ui.login.pin || "";
        if (key === "⌫") {
          state.ui.login.pin = pin.slice(0, -1);
        } else if (/^\d$/.test(key) && pin.length < 4) {
          state.ui.login.pin = pin + key;
        }
      });
      truth.mark("login-screen");
    },
    "auth.pinClear": ({ truth }) => {
      truth.produce((state) => {
        if (state.ui.stage !== "login") return;
        state.ui.login.pin = "";
        state.ui.login.error = null;
      });
      truth.mark("login-screen");
    },
    "auth.pinSubmit": ({ truth }) => {
      truth.produce((state) => {
        if (state.ui.stage !== "login") return;
        const pin = state.ui.login.pin || "";
        const employee = (db.employees || []).find((emp) => emp.pin_code === pin);
        if (!employee) {
          state.ui.login.error = "PIN غير صحيح";
          state.ui.login.pin = "";
          return;
        }
        state.session.cashier = clone(employee);
        state.ui.login.pin = "";
        state.ui.login.error = null;
        state.ui.stage = "shift-setup";
        state.order = null;
        state.payments.splits = [];
        state.payments.buffer = "0";
      });
      truth.mark("app-root");
    },
    "shift.updateOpeningFloat": ({ truth }, event) => {
      const value = event && event.target ? event.target.value : "";
      truth.produce((state) => {
        state.ui.shift.openingFloat = value;
      });
    },
    "shift.open": ({ truth }) => {
      truth.produce((state) => {
        const openingFloat = Number.parseFloat(state.ui.shift.openingFloat || "0") || 0;
        state.session.shift = {
          id: new Date().toISOString().slice(11, 19).replace(/[:.]/g, ""),
          startedAt: new Date().toISOString(),
          openingFloat: round(openingFloat),
          orderIds: []
        };
        state.ui.stage = "pos";
        state.ui.overlays.active = null;
        state.order = createOrder("dine_in");
        state.payments.splits = [];
        state.payments.buffer = "0";
      });
      truth.rebuildAll();
    },
    "shift.close": ({ truth }) => {
      truth.produce((state) => {
        if (state.session.shift) {
          state.completedOrders = state.completedOrders || [];
          state.session.shift.closedAt = new Date().toISOString();
        }
        state.session.shift = null;
        state.order = null;
        state.ui.stage = "shift-setup";
        state.ui.overlays.active = null;
        state.payments.splits = [];
        state.payments.buffer = "0";
      });
      truth.mark("app-root");
    },
    "env.toggleTheme": ({ env, truth }) => {
      env.toggleTheme();
      truth.produce((state) => {
        const envState = env.get();
        state.env.theme = envState.resolved.theme;
      });
      truth.mark("pos-header");
    },
    "env.toggleLocale": ({ env, truth }) => {
      let next;
      let nextDir;
      truth.produce((state) => {
        next = state.env.locale === "ar" ? "en" : "ar";
        nextDir = next === "ar" ? "rtl" : "ltr";
        state.env.locale = next;
        state.env.dir = nextDir;
        env.setLocale(next);
      });
      if (typeof document !== "undefined") {
        document.documentElement.setAttribute("dir", nextDir);
        document.documentElement.setAttribute("lang", next);
      }
      truth.rebuildAll();
    },
    "session.logout": ({ truth }) => {
      truth.produce((state) => {
        state.ui.stage = "login";
        state.session.cashier = null;
        state.session.shift = null;
        state.order = null;
        state.payments.splits = [];
        state.payments.buffer = "0";
        state.ui.login.pin = "";
        state.ui.login.error = null;
      });
      truth.rebuildAll();
    },
    "view.showTables": ({ truth }) => {
      truth.produce((state) => {
        if (state.ui.stage !== "pos") return;
        ensureOrder(state);
        state.ui.overlays.active = "tables";
      });
      truth.mark("modals-root");
    },
    "view.showReports": ({ truth }) => {
      truth.produce((state) => {
        if (state.ui.stage !== "pos") return;
        state.ui.overlays.active = "reports";
      });
      truth.mark("modals-root");
    },
    "view.closeOverlay": ({ truth }) => {
      truth.produce((state) => {
        state.ui.overlays.active = null;
        state.ui.overlays.payload = null;
      });
      truth.mark("modals-root");
    },
    "menu.search": ({ truth }, event) => {
      const value = event && event.target ? event.target.value : "";
      truth.produce((state) => {
        state.ui.menu.search = value;
      });
      truth.mark("menu-panel");
    },
    "menu.clearSearch": ({ truth }) => {
      truth.produce((state) => {
        state.ui.menu.search = "";
      });
      truth.mark("menu-panel");
    },
    "menu.selectCategory": ({ truth }, event, el) => {
      const categoryId = el.getAttribute("data-category-id") || "all";
      truth.produce((state) => {
        state.ui.menu.category = categoryId;
      });
      truth.mark("menu-panel");
    },
    "order.addItem": ({ truth }, event, el) => {
      const target = el || (event && event.target && event.target.closest && event.target.closest("[data-item-id]"));
      if (!target) return;
      const itemId = target.getAttribute("data-item-id");
      truth.produce((state) => {
        if (state.ui.stage !== "pos") return;
        const order = ensureOrder(state);
        const item = (state.catalog.items || []).find((it) => String(it.id) === String(itemId));
        if (!item) return;
        const locale = state.env.locale || "ar";
        const existing = order.lines.find((line) => !line.modifiers?.length && String(line.itemId) === String(item.id));
        if (existing) {
          existing.qty += 1;
          existing.total = round(existing.price * existing.qty);
        } else {
          const translation = translateItem(item, locale);
          order.lines.push({
            id: nextId("line"),
            itemId: item.id,
            name: translation.name,
            qty: 1,
            price: item.price,
            total: round(item.price),
            modifiers: [],
            notes: ""
          });
        }
        order.totals = computeTotals(order.lines, state.settings);
      });
      truth.mark(["order-panel", "footer-bar"]);
    },
    "order.incrementLine": ({ truth }, event, el) => {
      const lineId = el.getAttribute("data-line-id");
      truth.produce((state) => {
        if (!lineId || !state.order) return;
        const line = state.order.lines.find((ln) => ln.id === lineId);
        if (!line) return;
        line.qty += 1;
        line.total = round(line.price * line.qty);
        state.order.totals = computeTotals(state.order.lines, state.settings);
      });
      truth.mark(["order-panel", "footer-bar"]);
    },
    "order.decrementLine": ({ truth }, event, el) => {
      const lineId = el.getAttribute("data-line-id");
      truth.produce((state) => {
        if (!lineId || !state.order) return;
        const lines = state.order.lines;
        const index = lines.findIndex((ln) => ln.id === lineId);
        if (index < 0) return;
        const line = lines[index];
        line.qty = Math.max(0, line.qty - 1);
        if (line.qty === 0) {
          lines.splice(index, 1);
        } else {
          line.total = round(line.price * line.qty);
        }
        state.order.totals = computeTotals(lines, state.settings);
      });
      truth.mark(["order-panel", "footer-bar"]);
    },
    "order.removeLine": ({ truth }, event, el) => {
      const lineId = el.getAttribute("data-line-id");
      truth.produce((state) => {
        if (!lineId || !state.order) return;
        const lines = state.order.lines || [];
        const index = lines.findIndex((ln) => ln.id === lineId);
        if (index >= 0) {
          lines.splice(index, 1);
          state.order.totals = computeTotals(lines, state.settings);
        }
      });
      truth.mark(["order-panel", "footer-bar"]);
    },
    "order.setType": ({ truth }, event, el) => {
      const type = el.getAttribute("data-type") || "dine_in";
      truth.produce((state) => {
        if (!state.order) return;
        state.order.type = type;
        if (type !== "dine_in") {
          state.order.tableIds = [];
        }
      });
      truth.mark("order-panel");
    },
    "order.clear": ({ truth }) => {
      truth.produce((state) => {
        if (!state.order) return;
        const type = state.order.type;
        state.order = createOrder(type);
        state.payments.splits = [];
        state.payments.buffer = "0";
      });
      truth.mark(["order-panel", "footer-bar", "modals-root"]);
    },
    "order.park": ({ truth }) => {
      truth.produce((state) => {
        if (!state.order || !state.order.lines.length) return;
        const snapshot = clone(state.order);
        state.parkedOrders = state.parkedOrders || [];
        state.parkedOrders.push(snapshot);
        const type = state.order.type;
        state.order = createOrder(type);
        state.payments.splits = [];
        state.payments.buffer = "0";
      });
      truth.mark(["order-panel", "footer-bar"]);
    },
    "tables.attach": ({ truth }, event, el) => {
      const tableId = el.getAttribute("data-table-id");
      truth.produce((state) => {
        if (!tableId) return;
        const order = ensureOrder(state);
        if (!order.tableIds) order.tableIds = [];
        if (order.tableIds.includes(tableId)) {
          order.tableIds = order.tableIds.filter((id) => id !== tableId);
        } else {
          order.tableIds.push(tableId);
        }
        state.ui.overlays.active = null;
      });
      truth.mark(["order-panel", "modals-root"]);
      notify(truth, "tables_attached", "success");
    },
    "payments.open": ({ truth }) => {
      truth.produce((state) => {
        if (!state.order || !state.order.lines.length) return;
        state.ui.overlays.active = "payments";
        state.payments.buffer = getDue(state).toFixed(2);
      });
      truth.mark("modals-root");
    },
    "payments.close": ({ truth }) => {
      truth.produce((state) => {
        state.ui.overlays.active = null;
      });
      truth.mark("modals-root");
    },
    "payments.key": ({ truth }, event, el) => {
      const key = el.getAttribute("data-key");
      truth.produce((state) => {
        let buffer = state.payments.buffer || "0";
        if (key === "⌫") {
          buffer = buffer.length > 1 ? buffer.slice(0, -1) : "0";
        } else if (key === ".") {
          if (!buffer.includes(".")) buffer += ".";
        } else if (/^\d$/.test(key)) {
          buffer = buffer === "0" ? key : buffer + key;
        }
        state.payments.buffer = buffer;
      });
      truth.mark("modals-root");
    },
    "payments.clearBuffer": ({ truth }) => {
      truth.produce((state) => {
        state.payments.buffer = "0";
      });
      truth.mark("modals-root");
    },
    "payments.addSplit": ({ truth }) => {
      truth.produce((state) => {
        if (!state.order) return;
        const buffer = state.payments.buffer || "0";
        const amount = round(Number.parseFloat(buffer.replace(/,/g, ".")) || 0);
        const due = getDue(state);
        if (due <= 0) {
          state.payments.buffer = "0.00";
          return;
        }
        if (amount <= 0) {
          state.payments.buffer = due.toFixed(2);
          return;
        }
        const applied = Math.min(due, amount);
        state.payments.splits = state.payments.splits || [];
        state.payments.splits.push({
          id: nextId("split"),
          method: state.payments.method || "cash",
          amount: applied
        });
        state.payments.buffer = getDue(state).toFixed(2);
      });
      truth.mark(["footer-bar", "modals-root"]);
      notify(truth, "payment_added", "success");
    },
    "payments.removeSplit": ({ truth }, event, el) => {
      const splitId = el.getAttribute("data-split-id");
      truth.produce((state) => {
        if (!splitId) return;
        state.payments.splits = (state.payments.splits || []).filter((split) => split.id !== splitId);
        state.payments.buffer = getDue(state).toFixed(2);
      });
      truth.mark(["footer-bar", "modals-root"]);
      notify(truth, "payment_removed", "primary");
    },
    "payments.setMethod": ({ truth }, event, el) => {
      const method = el.getAttribute("data-method") || "cash";
      truth.produce((state) => {
        state.payments.method = method;
      });
      truth.mark("modals-root");
    },
    "payments.complete": ({ truth }) => {
      let insufficient = false;
      let completed = false;
      truth.produce((state) => {
        if (!state.order) return;
        const due = getDue(state);
        if (due > 0.009) {
          state.payments.buffer = due.toFixed(2);
          state.ui.overlays.active = "payments";
          state.ui.overlays.payload = { error: "due" };
          insufficient = true;
          return;
        }
        const snapshot = clone(state.order);
        snapshot.payments = clone(state.payments.splits || []);
        snapshot.status = "settled";
        snapshot.closedAt = new Date().toISOString();
        state.completedOrders = state.completedOrders || [];
        state.completedOrders.push(snapshot);
        if (state.session.shift) {
          state.session.shift.orderIds = state.session.shift.orderIds || [];
          state.session.shift.orderIds.push(snapshot.id);
        }
        state.order = createOrder();
        state.payments.splits = [];
        state.payments.buffer = "0";
        state.ui.overlays.active = null;
        completed = true;
      });
      truth.mark(["order-panel", "footer-bar", "modals-root"]);
      if (insufficient) {
        notify(truth, "payment_pending", "danger");
      } else if (completed) {
        notify(truth, "payment_completed", "success");
      }
    },
    "ui.dismissToast": ({ truth }, event, el) => {
      const toastId = el.getAttribute("data-toast-id");
      truth.produce((state) => {
        if (!toastId) return;
        state.ui.toasts = (state.ui.toasts || []).filter((toast) => toast.id !== toastId);
      });
      truth.mark("toasts-root");
    }
  };

  const app = Core.createApp({
    mount: "#app",
    rootComponent: "POSRoot",
    initial: initialState,
    commands,
    locale: initialState.env.locale,
    dir: initialState.env.dir,
    theme: initialState.env.theme,
    dictionaries,
    persistEnv: true,
    helpers: {}
  });

  app.helpers = {
    formatCurrency(value) {
      const amount = Number(value) || 0;
      const state = app.truth.get();
      const symbol = (state.settings.currency && state.settings.currency[state.env.locale]) || state.settings.currency?.en || "EGP";
      return `${symbol} ${amount.toFixed(2)}`.trim();
    }
  };

})(window);
