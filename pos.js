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

  function resolveModifier(modifiers, id, kind) {
    const group = modifiers && (modifiers[kind] || modifiers[kind === "addOns" ? "add-ons" : kind]);
    if (!group) return null;
    return group.find((entry) => String(entry.id) === String(id)) || null;
  }

  function computeLinePricing(line, state) {
    if (!line) return 0;
    const modifiers = state.modifiers || {};
    const addOnIds = line.addOns || [];
    const addOnValue = addOnIds.reduce((sum, id) => {
      const mod = resolveModifier(modifiers, id, "add-ons");
      return sum + (mod ? Number(mod.price_change || 0) : 0);
    }, 0);
    const qty = Math.max(0, Number(line.qty) || 0);
    const baseUnit = Number(line.price || 0) + addOnValue;
    let total = baseUnit * qty;
    if (line.discount && line.discount.type) {
      if (line.discount.type === "percent") {
        const rate = Math.max(0, Number(line.discount.value) || 0);
        total = total - (total * Math.min(rate, 100)) / 100;
      } else if (line.discount.type === "amount") {
        const value = Math.max(0, Number(line.discount.value) || 0);
        total = total - value;
      }
    }
    line.unitPrice = round(baseUnit);
    line.total = round(Math.max(0, total));
    return line.total;
  }

  function computeTotals(lines, settings, state) {
    const subtotal = round((lines || []).reduce((acc, line) => acc + computeLinePricing(line, state), 0));

  function computeTotals(lines, settings) {
    const subtotal = round((lines || []).reduce((acc, line) => acc + round((line.price || 0) * (line.qty || 0)), 0));
    const serviceRate = settings.service_charge_rate || 0;
    const taxRate = settings.tax_rate || 0;
    const service = round(subtotal * serviceRate);
    const vat = round((subtotal + service) * taxRate);
    const total = round(subtotal + service + vat);
    return { subtotal, service, vat, total };
  }

  function recalcOrder(state) {
    if (!state.order) return;
    state.order.lines = state.order.lines || [];
    state.order.lines.forEach((line) => computeLinePricing(line, state));
    state.order.totals = computeTotals(state.order.lines, state.settings, state);
  }

  function openPinPrompt(state, reason, payload, allowedRoles = ["manager"]) {
    state.ui.pinPrompt = {
      reason,
      pin: "",
      error: null,
      attempts: 3,
      currentAttempt: 0,
      allowedRoles,
      payload
    };
    state.ui.overlays.active = "pin";
    state.ui.overlays.payload = null;
  }

  function executeSecuredAction(state, payload) {
    if (!payload) return { marks: [] };
    const marks = ["order-panel", "footer-bar", "modals-root"];
    if (payload.action === "discount") {
      const line = state.order?.lines?.find((ln) => ln.id === payload.lineId);
      if (!line) return { marks: [] };
      line.discount = payload.discount || { type: null, value: 0 };
      computeLinePricing(line, state);
      state.order.totals = computeTotals(state.order.lines, state.settings, state);
      state.ui.forms.discount = { type: "percent", value: "" };
      return { marks, notifyKey: "discount", notifyIntent: "success" };
    }
    if (payload.action === "remove-line") {
      if (!state.order) return { marks: [] };
      const lines = state.order.lines || [];
      const index = lines.findIndex((line) => line.id === payload.lineId);
      if (index >= 0) {
        lines.splice(index, 1);
        state.order.totals = computeTotals(lines, state.settings, state);
      }
      return { marks, notifyKey: "delete_line", notifyIntent: "primary" };
    }
    return { marks: [] };
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
      toasts: [],
      forms: {
        notes: "",
        modifiers: { addOns: [], removals: [] },
        discount: { type: "percent", value: "" },
        numpad: { value: "1" }
      },
      pinPrompt: { reason: null, pin: "", error: null, attempts: 0, allowedRoles: [], payload: null },
      returns: { stage: "list", sourceOrderId: null, items: [] },
      reservations: { stage: "list", form: {} }

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
    reservations: clone(db.reservations) || [
      {
        id: nextId("resv"),
        customerName: "منى حمدي",
        phone: "01000011223",
        partySize: 4,
        startTime: new Date(Date.now() + 3600 * 1000).toISOString(),
        tableIds: ["T5"],
        notes: "عيد ميلاد"
      }
    ],
    order: null,
    parkedOrders: [],
    completedOrders: [],
    returnsHistory: [],

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
      payment_removed: { ar: "تم حذف الدفعة", en: "Split removed" },
      discount: { ar: "خصم", en: "Discount" },
      line_actions: { ar: "إجراءات البند", en: "Line actions" },
      line_modifiers: { ar: "التخصيصات", en: "Modifiers" },
      line_discount: { ar: "خصم البند", en: "Item discount" },
      line_notes: { ar: "ملاحظات البند", en: "Item notes" },
      notes_placeholder: { ar: "أدخل ملاحظة للمطبخ", en: "Add a note for the kitchen" },
      delete_line: { ar: "حذف البند", en: "Delete item" },
      percent: { ar: "نسبة %", en: "Percent" },
      amount: { ar: "قيمة", en: "Amount" },
      value: { ar: "القيمة", en: "Value" },
      apply: { ar: "تطبيق", en: "Apply" },
      cancel: { ar: "إلغاء", en: "Cancel" },
      save: { ar: "حفظ", en: "Save" },
      security_pin: { ar: "تأكيد الصلاحية", en: "Security PIN" },
      available: { ar: "متاح", en: "Available" },
      items: { ar: "أصناف", en: "items" },
      start_return: { ar: "بدء مرتجع", en: "Start return" },
      no_completed_orders: { ar: "لا توجد فواتير مغلقة", en: "No settled orders" },
      no_completed_orders_hint: { ar: "أكمل بعض الطلبات لتتمكن من إنشاء مرتجع.", en: "Settle orders to enable returns." },
      create_return: { ar: "إنشاء مرتجع", en: "Create return" },
      return_created: { ar: "تم إنشاء المرتجع", en: "Return created" },
      return_created_hint: { ar: "تم تحديث الكميات المتاحة لهذا الطلب.", en: "Return has been recorded and quantities updated." },
      done: { ar: "تم", en: "Done" },
      reservations: { ar: "الحجوزات", en: "Reservations" },
      returns: { ar: "المرتجعات", en: "Returns" },
      add_ons: { ar: "إضافات", en: "Add-ons" },
      removals: { ar: "منزوعات", en: "Removals" },
      enterQuantity: { ar: "أدخل الكمية", en: "Enter quantity" },
      notes: { ar: "ملاحظات", en: "Notes" },
      new_reservation: { ar: "حجز جديد", en: "New reservation" },
      cancel_reservation: { ar: "إلغاء الحجز", en: "Cancel reservation" },
      no_reservations: { ar: "لا توجد حجوزات", en: "No reservations" },
      no_reservations_hint: { ar: "ابدأ بإضافة حجز جديد للعملاء.", en: "Create a reservation for upcoming guests." },
      customer_name: { ar: "اسم العميل", en: "Customer name" },
      phone: { ar: "رقم الهاتف", en: "Phone" },
      party_size: { ar: "عدد الأفراد", en: "Party size" },
      start_time: { ar: "وقت البدء", en: "Start time" },
      select_tables: { ar: "اختر الطاولات", en: "Select tables" },
      guests: { ar: "ضيوف", en: "guests" },
      available_tables: { ar: "طاولات متاحة", en: "Available tables" },
      reservation_created: { ar: "تم حفظ الحجز", en: "Reservation saved" }

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

      truth.produce((state) => {
        const next = state.env.locale === "ar" ? "en" : "ar";
        state.env.locale = next;
        state.env.dir = next === "ar" ? "rtl" : "ltr";
        env.setLocale(next);
      });
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
        state.ui.overlays.payload = null;
      });
      truth.mark("modals-root");
    },
    "view.showReservations": ({ truth }) => {
      truth.produce((state) => {
        if (state.ui.stage !== "pos") return;
        state.ui.overlays.active = "reservations";
        state.ui.overlays.payload = null;
        state.ui.reservations.stage = "list";

      });
      truth.mark("modals-root");
    },
    "view.showReports": ({ truth }) => {
      truth.produce((state) => {
        if (state.ui.stage !== "pos") return;
        state.ui.overlays.active = "reports";
        state.ui.overlays.payload = null;

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
        const existing = order.lines.find((line) =>
          !line.modifiers?.length && (!line.addOns || !line.addOns.length) && String(line.itemId) === String(item.id)
        );
        if (existing) {
          existing.qty += 1;
          computeLinePricing(existing, state);
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
            addOns: [],
            removals: [],
            discount: { type: null, value: 0 },
            notes: ""
          });
        }
        recalcOrder(state);

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
        computeLinePricing(line, state);
        state.order.totals = computeTotals(state.order.lines, state.settings, state);

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
          computeLinePricing(line, state);
        }
        state.order.totals = computeTotals(lines, state.settings, state);

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
          state.order.totals = computeTotals(lines, state.settings, state);

      onSearch({ truth }, e){ const v = e.target.value||''; truth.set(s=>({...s, ui:{...s.ui, search:v}})); truth.mark('menu-panel') },
      setCategory({ truth }, e){ const target = e.currentTarget ?? e.target?.closest?.('[data-id]'); const id = target?.getAttribute('data-id'); if(!id) return; truth.set(s=>({...s, ui:{...s.ui, activeCategory:id}})); truth.mark('menu-panel') },

          state.order.totals = computeTotals(lines, state.settings);
        }
      });
      truth.mark(["order-panel", "footer-bar"]);
    },
    "order.requestRemoveLine": ({ truth }, event, el) => {
      const lineId = el.getAttribute("data-line-id");
      truth.produce((state) => {
        if (!lineId || !state.order) return;
        openPinPrompt(state, "delete_line", { action: "remove-line", lineId });
      });
      truth.mark("modals-root");
    },
    "order.openLineActions": ({ truth }, event, el) => {
      const lineId = el.getAttribute("data-line-id");
      truth.produce((state) => {
        if (!lineId || !state.order) return;
        state.ui.overlays.active = "line-actions";
        state.ui.overlays.payload = { lineId };
      });
      truth.mark("modals-root");
    },
    "order.closeLineActions": ({ truth }) => {
      truth.produce((state) => {
        state.ui.overlays.active = null;
        state.ui.overlays.payload = null;
        state.ui.forms.notes = "";
        state.ui.forms.modifiers = { addOns: [], removals: [] };
        state.ui.forms.discount = { type: "percent", value: "" };
      });
      truth.mark("modals-root");
    },
    "order.editNotes": ({ truth }, event, el) => {
      const lineId = el.getAttribute("data-line-id");
      truth.produce((state) => {
        if (!state.order) return;
        const line = state.order.lines.find((ln) => ln.id === lineId);
        if (!line) return;
        state.ui.forms.notes = line.notes || "";
        state.ui.overlays.active = "line-notes";
        state.ui.overlays.payload = { lineId };
      });
      truth.mark("modals-root");
    },
    "order.updateNotesDraft": ({ truth }, event) => {
      const value = event && event.target ? event.target.value : "";
      truth.produce((state) => {
        state.ui.forms.notes = value;
      });
    },
    "order.saveNotes": ({ truth }, event, el) => {
      const lineId = el.getAttribute("data-line-id");
      truth.produce((state) => {
        if (!state.order) return;
        const line = state.order.lines.find((ln) => ln.id === lineId);
        if (!line) return;
        line.notes = state.ui.forms.notes || "";
        state.ui.forms.notes = "";
        state.ui.overlays.active = null;
        state.ui.overlays.payload = null;
      });
      truth.mark(["order-panel", "modals-root"]);
    },
    "order.editModifiers": ({ truth }, event, el) => {
      const lineId = el.getAttribute("data-line-id");
      truth.produce((state) => {
        if (!state.order) return;
        const line = state.order.lines.find((ln) => ln.id === lineId);
        if (!line) return;
        state.ui.forms.modifiers = {
          addOns: clone(line.addOns || []),
          removals: clone(line.removals || [])
        };
        state.ui.overlays.active = "line-modifiers";
        state.ui.overlays.payload = { lineId };
      });
      truth.mark("modals-root");
    },
    "order.toggleModifier": ({ truth }, event, el) => {
      const kind = el.getAttribute("data-kind") || "addOns";
      const modifierId = el.getAttribute("data-modifier-id");
      truth.produce((state) => {
        const form = state.ui.forms.modifiers || { addOns: [], removals: [] };
        const key = kind === "removals" ? "removals" : "addOns";
        const list = new Set((form[key] || []).map((id) => String(id)));
        if (list.has(String(modifierId))) {
          list.delete(String(modifierId));
        } else {
          list.add(String(modifierId));
        }
        form[key] = Array.from(list);
        state.ui.forms.modifiers = form;
      });
      truth.mark("modals-root");
    },
    "order.saveModifiers": ({ truth }, event, el) => {
      const lineId = el.getAttribute("data-line-id");
      truth.produce((state) => {
        if (!state.order) return;
        const line = state.order.lines.find((ln) => ln.id === lineId);
        if (!line) return;
        const locale = state.env.locale || "ar";
        const form = state.ui.forms.modifiers || { addOns: [], removals: [] };
        line.addOns = clone(form.addOns || []);
        line.removals = clone(form.removals || []);
        const modifierNames = [];
        (line.addOns || []).forEach((id) => {
          const mod = resolveModifier(state.modifiers, id, "add-ons");
          if (mod) modifierNames.push(mod.name?.[locale] || mod.name?.en || mod.id);
        });
        (line.removals || []).forEach((id) => {
          const mod = resolveModifier(state.modifiers, id, "removals");
          if (mod) modifierNames.push(mod.name?.[locale] || mod.name?.en || mod.id);
        });
        line.modifiers = modifierNames;
        computeLinePricing(line, state);
        state.order.totals = computeTotals(state.order.lines, state.settings, state);
        state.ui.overlays.active = null;
        state.ui.overlays.payload = null;
        state.ui.forms.modifiers = { addOns: [], removals: [] };
      });
      truth.mark(["order-panel", "footer-bar", "modals-root"]);
    },
    "order.editDiscount": ({ truth }, event, el) => {
      const lineId = el.getAttribute("data-line-id");
      truth.produce((state) => {
        if (!state.order) return;
        const line = state.order.lines.find((ln) => ln.id === lineId);
        if (!line) return;
        const discount = line.discount || { type: "percent", value: 0 };
        state.ui.forms.discount = {
          type: discount.type || "percent",
          value: discount.value != null ? String(discount.value) : ""
        };
        state.ui.overlays.active = "line-discount";
        state.ui.overlays.payload = { lineId };
      });
      truth.mark("modals-root");
    },
    "order.setDiscountType": ({ truth }, event, el) => {
      const type = el.getAttribute("data-type") || "percent";
      truth.produce((state) => {
        state.ui.forms.discount = state.ui.forms.discount || { type: "percent", value: "" };
        state.ui.forms.discount.type = type;
      });
      truth.mark("modals-root");
    },
    "order.updateDiscountValue": ({ truth }, event) => {
      const value = event && event.target ? event.target.value : "";
      truth.produce((state) => {
        state.ui.forms.discount = state.ui.forms.discount || { type: "percent", value: "" };
        state.ui.forms.discount.value = value;
      });
    },
    "order.applyDiscount": ({ truth }, event, el) => {
      const lineId = el.getAttribute("data-line-id");
      truth.produce((state) => {
        if (!state.order) return;
        const form = state.ui.forms.discount || { type: "percent", value: "" };
        const value = Number(form.value);
        if (Number.isNaN(value)) return;
        openPinPrompt(state, "item_discount", {
          action: "discount",
          lineId,
          discount: {
            type:
              form.type === "percent"
                ? value > 0
                  ? "percent"
                  : null
                : value > 0
                ? "amount"
                : null,
            value:
              form.type === "percent"
                ? Math.max(0, Math.min(100, value))
                : Math.max(0, value)
          }
        });
      });
      truth.mark("modals-root");
    },
    "order.openQtyNumpad": ({ truth }, event, el) => {
      const lineId = el.getAttribute("data-line-id");
      truth.produce((state) => {
        if (!state.order) return;
        const line = state.order.lines.find((ln) => ln.id === lineId);
        if (!line) return;
        state.ui.forms.numpad = { value: String(Number(line.qty) || 1) };
        state.ui.overlays.active = "numpad";
        state.ui.overlays.payload = { lineId };
      });
      truth.mark("modals-root");
    },
    "order.numpadInput": ({ truth }, event, el) => {
      const key = el.getAttribute("data-key");
      truth.produce((state) => {
        const form = state.ui.forms.numpad || { value: "1" };
        let buffer = String(form.value ?? "");
        if (key === "⌫") {
          buffer = buffer.slice(0, -1) || "0";
        } else if (/^\d$/.test(key)) {
          buffer = buffer === "0" ? key : (buffer + key).slice(0, 3);
        }
        form.value = buffer.replace(/^0+(?=\d)/, "") || "0";
        state.ui.forms.numpad = form;
      });
      truth.mark("modals-root");
    },
    "order.numpadClear": ({ truth }) => {
      truth.produce((state) => {
        state.ui.forms.numpad = { value: "0" };
      });
      truth.mark("modals-root");
    },
    "order.numpadConfirm": ({ truth }) => {
      truth.produce((state) => {
        const payload = state.ui.overlays.payload || {};
        const lineId = payload.lineId;
        if (!lineId || !state.order) return;
        const line = state.order.lines.find((ln) => ln.id === lineId);
        if (!line) return;
        const raw = state.ui.forms.numpad?.value;
        const value = Math.max(1, Math.min(999, Number(raw) || 1));
        line.qty = value;
        computeLinePricing(line, state);
        state.order.totals = computeTotals(state.order.lines, state.settings, state);
        state.ui.overlays.active = null;
        state.ui.overlays.payload = null;
      });
      truth.mark(["order-panel", "footer-bar", "modals-root"]);
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
    "returns.open": ({ truth }) => {
      truth.produce((state) => {
        state.ui.overlays.active = "returns";
        state.ui.overlays.payload = null;
        state.ui.returns = { stage: "list", sourceOrderId: null, items: [] };
      });
      truth.mark("modals-root");
    },
    "returns.close": ({ truth }) => {
      truth.produce((state) => {
        state.ui.overlays.active = null;
        state.ui.overlays.payload = null;
        state.ui.returns = { stage: "list", sourceOrderId: null, items: [] };
      });
      truth.mark("modals-root");
    },
    "returns.selectOrder": ({ truth }, event, el) => {
      const orderId = el.getAttribute("data-order-id");
      truth.produce((state) => {
        if (!orderId) return;
        const order = (state.completedOrders || []).find((o) => o.id === orderId);
        if (!order) return;
        const items = (order.lines || []).map((line) => {
          const availableQty = Math.max(0, (line.qty || 0) - (line.returnedQty || 0));
          return {
            lineId: line.id,
            name: line.name,
            availableQty,
            selectedQty: 0,
            unitPrice: Number(line.unitPrice || line.price || 0)
          };
        }).filter((item) => item.availableQty > 0);
        state.ui.returns = {
          stage: items.length ? "lines" : "list",
          sourceOrderId: order.id,
          items
        };
      });
      truth.mark("modals-root");
    },
    "returns.adjustQty": ({ truth }, event, el) => {
      const lineId = el.getAttribute("data-item-id");
      const direction = el.getAttribute("data-direction");
      truth.produce((state) => {
        const list = state.ui.returns.items || [];
        const item = list.find((entry) => entry.lineId === lineId);
        if (!item) return;
        if (direction === "inc") {
          item.selectedQty = Math.min(item.availableQty, (item.selectedQty || 0) + 1);
        } else if (direction === "dec") {
          item.selectedQty = Math.max(0, (item.selectedQty || 0) - 1);
        }
      });
      truth.mark("modals-root");
    },
    "returns.submit": ({ truth }) => {
      let success = false;
      truth.produce((state) => {
        const returnsState = state.ui.returns || {};
        const sourceId = returnsState.sourceOrderId;
        if (!sourceId) return;
        const items = (returnsState.items || []).filter((item) => item.selectedQty > 0);
        if (!items.length) return;
        const order = (state.completedOrders || []).find((o) => o.id === sourceId);
        if (!order) return;
        const total = items.reduce((sum, item) => sum + item.selectedQty * item.unitPrice, 0);
        const record = {
          id: nextId("ret"),
          orderId: sourceId,
          createdAt: new Date().toISOString(),
          items: items.map((item) => ({ lineId: item.lineId, qty: item.selectedQty, price: item.unitPrice })),
          total: round(total)
        };
        state.returnsHistory = state.returnsHistory || [];
        state.returnsHistory.push(record);
        (order.lines || []).forEach((line) => {
          const matched = items.find((item) => item.lineId === line.id);
          if (matched) {
            line.returnedQty = (line.returnedQty || 0) + matched.selectedQty;
          }
        });
        state.ui.returns.stage = "summary";
        state.ui.returns.items = [];
        success = true;
      });
      truth.mark("modals-root");
      if (success) {
        notify(truth, "return_created", "success");
      }
    },
    "reservations.startForm": ({ truth }) => {
      truth.produce((state) => {
        const now = new Date(Date.now() + 30 * 60 * 1000);
        const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        state.ui.reservations.stage = "form";
        state.ui.reservations.form = {
          customerName: "",
          phone: "",
          partySize: "",
          startTime: local,
          notes: "",
          tableIds: []
        };
      });
      truth.mark("modals-root");
    },
    "reservations.updateField": ({ truth }, event, el) => {
      const field = el.getAttribute("data-field");
      const value = event && event.target ? event.target.value : "";
      truth.produce((state) => {
        const form = state.ui.reservations.form || {};
        form[field] = value;
        state.ui.reservations.form = form;
      });
    },
    "reservations.toggleTable": ({ truth }, event, el) => {
      const tableId = el.getAttribute("data-table-id");
      truth.produce((state) => {
        if (!tableId) return;
        const form = state.ui.reservations.form || { tableIds: [] };
        const set = new Set((form.tableIds || []).map((id) => String(id)));
        if (set.has(tableId)) {
          set.delete(tableId);
        } else {
          set.add(tableId);
        }
        form.tableIds = Array.from(set);
        state.ui.reservations.form = form;
      });
      truth.mark("modals-root");
    },
    "reservations.submit": ({ truth }) => {
      let success = false;
      truth.produce((state) => {
        const form = state.ui.reservations.form || {};
        const tableIds = form.tableIds || [];
        if (!form.customerName || !form.startTime || !tableIds.length) return;
        const reservation = {
          id: nextId("resv"),
          customerName: form.customerName,
          phone: form.phone,
          partySize: Number(form.partySize) || tableIds.length,
          startTime: form.startTime,
          tableIds: clone(tableIds),
          notes: form.notes || ""
        };
        state.reservations = state.reservations || [];
        state.reservations.push(reservation);
        state.tables = state.tables || [];
        reservation.tableIds.forEach((id) => {
          const table = state.tables.find((t) => t.id === id);
          if (table && table.status === "available") {
            table.status = "reserved";
          }
        });
        state.ui.reservations.stage = "list";
        state.ui.reservations.form = {};
        success = true;
      });
      truth.mark("modals-root");
      if (success) {
        notify(truth, "reservation_created", "success");
      }
    },
    "reservations.cancel": ({ truth }, event, el) => {
      const reservationId = el.getAttribute("data-reservation-id");
      truth.produce((state) => {
        if (!reservationId) return;
        const reservations = state.reservations || [];
        const index = reservations.findIndex((resv) => resv.id === reservationId);
        if (index < 0) return;
        const [removed] = reservations.splice(index, 1);
        state.tables = state.tables || [];
        (removed.tableIds || []).forEach((id) => {
          const stillReserved = reservations.some((resv) => (resv.tableIds || []).includes(id));
          const table = state.tables.find((t) => t.id === id);
          if (table && table.status === "reserved" && !stillReserved) {
            table.status = "available";
          }
        });
      });
      truth.mark("modals-root");
    },
    "reservations.abort": ({ truth }) => {
      truth.produce((state) => {
        state.ui.reservations.stage = "list";
        state.ui.reservations.form = {};
      });
      truth.mark("modals-root");
    },

      addToOrder({ truth, i18n }, e){ const target = e.currentTarget ?? e.target?.closest?.('[data-id]'); const id = target?.getAttribute('data-id'); if(!id) return; truth.batch(()=>{
        truth.set(s=>{
          const it = s.catalog.items.find(x=> String(x.id)===String(id)); if(!it) return s;
          const line = makeLine(it, (s.meta?.locale||'ar').startsWith('ar')?'ar':'en');
          const order = { ...s.order, items:[...s.order.items, line] };
          return { ...s, order, orderTotals: calcOrderTotals(order, s.settings) }
        });
        truth.mark('order-panel');
      }) },

      // ----- Line actions & Qty -----
      openLineActions({ truth }, e){ const target = e.currentTarget ?? e.target?.closest?.('[data-id]'); const uid = target?.getAttribute('data-id'); if(!uid) return; truth.set(s=>({...s, ui:{...s.ui, modal:{ type:'qty', line: (s.order.items||[]).find(x=>x.uid===uid) }}})); truth.mark('modals') },
      syncQty({ truth }, e){ const val = Math.max(1, Math.floor(+e.target.value||1)); truth.batch(()=>{ truth.set(s=>{ const li=s.ui.modal?.line; if(!li) return s; li.qty = val; li.total = calcLineTotal(li); return { ...s, order:{...s.order}, orderTotals: calcOrderTotals(s.order, s.settings) } }); truth.mark('order-panel') }) },
      qtyKey({ truth }, e){ const ch = e.target.getAttribute('data-ch'); const inp = document.querySelector('#qtyInput'); if(!inp) return; if(ch==='C') inp.value=''; else inp.value = (inp.value||'') + ch; inp.dispatchEvent(new Event('input',{ bubbles:true })) },

      // ----- Modifiers -----
      openModifiers({ truth }, e){ const target = e.currentTarget ?? e.target?.closest?.('[data-id]'); const uid = target?.getAttribute('data-id'); if(!uid) return; truth.set(s=>{ const li=(s.order.items||[]).find(x=>x.uid===uid); return { ...s, ui:{...s.ui, modal:{ type:'modifiers', line:li, mods: (li?.modifiers||li?.availableModifiers||s.settings?.modifiers||[]) } } } }); truth.mark('modals') },
      toggleModifier({ truth }, e){ const target = e.currentTarget ?? e.target?.closest?.('[data-id]'); const id = target?.getAttribute('data-id'); if(!id) return; truth.batch(()=>{ truth.set(s=>{ const li=s.ui.modal?.line; if(!li) return s; const has = (li.selectedModifiers||[]).some(m=>String(m.id)===String(id)); const src = s.ui.modal.mods || []; const mod = src.find(m=> String(m.id)===String(id)); const sel = new Set((li.selectedModifiers||[]).map(x=>String(x.id))); if(has) sel.delete(String(id)); else if(mod) sel.add(String(id)); li.selectedModifiers = Array.from(sel).map(x=> src.find(m=>String(m.id)===x)).filter(Boolean); li.total = calcLineTotal(li); return { ...s, order:{...s.order}, orderTotals: calcOrderTotals(s.order, s.settings) } }); truth.mark('order-panel') }) },

      confirmDeleteOpen({ truth }, e){ const target = e.currentTarget ?? e.target?.closest?.('[data-id]'); const uid=target?.getAttribute('data-id'); if(!uid) return; truth.set(s=>({...s, ui:{...s.ui, modal:{ type:'confirmDel', uid } }})); truth.mark('modals') },
      confirmDelete({ truth }){ truth.batch(()=>{ truth.set(s=>{ const uid=s.ui.modal?.uid; const items=(s.order.items||[]).filter(x=>x.uid!==uid); const order={...s.order, items}; return { ...s, order, orderTotals: calcOrderTotals(order, s.settings), ui:{...s.ui, modal:null} } }); truth.mark('order-panel'); truth.mark('modals') }) },

      // ----- Customer -----
      syncCustomer({ truth }, e){ const id=e.target.id, v=e.target.value; truth.batch(()=>{ truth.set(s=>{ const c={ ...(s.order.customer||{}), [id==='custName'?'name':'phone']: v }; return { ...s, order:{ ...s.order, customer:c } } }); truth.mark('order-panel') }) },

      // ----- Tables & Reservations -----
      openTables({ truth }){ truth.set(s=>({...s, ui:{...s.ui, modal:{ type:'tables' }}})); truth.mark('modals') },
      openTablesAssign({ truth }){ truth.set(s=>({...s, ui:{...s.ui, modal:{ type:'tables' }}})); truth.mark('modals') },
      pickTableToggle({ truth }, e){ const target = e.currentTarget ?? e.target?.closest?.('[data-id]'); const id = target?.getAttribute('data-id'); if(!id) return; truth.set(s=>{ const pick=new Set(s.ui.tablePick||new Set()); if(pick.has(id)) pick.delete(id); else pick.add(id); return { ...s, ui:{...s.ui, tablePick:pick} } }); },
      async applyTablesAssign({ truth }){ const pick = (s=> Array.from(s.ui.tablePick||new Set()))(truth.get()); truth.batch(()=>{ truth.set(s=> ({ ...s, order:{...s.order, tableIds: pick }, ui:{...s.ui, tablePick:new Set(), modal:null} })); truth.mark('order-panel'); truth.mark('modals') }) },

      async createReservationOpen({ truth }){ const pick=Array.from((truth.get().ui.tablePick||new Set())); const name=prompt('اسم العميل:'); const phone=prompt('هاتف:'); const at=prompt('موعد (ISO):', new Date(Date.now()+60*60*1000).toISOString()); const pax=+prompt('عدد الأفراد:', '2'); if(!name||!at) return; const resv={ id:genId('resv'), tableId: pick[0]||null, customer:{ name, phone }, pax, dateTime:at, status:'reserved' }; await DB.put('reservations', resv); alert('تم إنشاء الحجز'); },

      // ----- Order save / settle / split -----
      saveOrder({ truth }){ truth.batch(()=>{ truth.set(s=>{ const o={...s.order}; const totals = calcOrderTotals(o, s.settings); o.totals = totals; return { ...s, order:o, orderTotals:totals } }); truth.mark('order-panel') }) },

      openSplitPay({ truth }){ const due = truth.get().orderTotals.total; truth.set(s=>({...s, ui:{...s.ui, modal:{ type:'split', payments:[ { method:'cash', amount:due } ] }}})); truth.mark('modals') },
      addPayLine({ truth }){ truth.set(s=>{ const m=s.ui.modal; if(!m||m.type!=='split') return s; return { ...s, ui:{...s.ui, modal:{ ...m, payments:[...m.payments, { method:'cash', amount:0 }] } } } }); truth.mark('modals') },
      changePayMethod({ truth }, e){ const i=+e.target.getAttribute('data-i'); const v=e.target.value; truth.set(s=>{ const m=s.ui.modal; m.payments[i].method=v; return { ...s, ui:{...s.ui, modal:m } } }); },
      changePayAmount({ truth }, e){ const i=+e.target.getAttribute('data-i'); const v=+e.target.value||0; truth.set(s=>{ const m=s.ui.modal; m.payments[i].amount=v; return { ...s, ui:{...s.ui, modal:m } } }); },
      async confirmSplit({ truth }){
        const s = truth.get(); const o = s.order; const totals = s.orderTotals; const shift = s.session.shift; const payLines = (s.ui.modal?.payments||[]);
        const paidSum = round(payLines.reduce((a,b)=>a+(+b.amount||0),0)); if(paidSum < totals.total){ alert('المبلغ المدفوع غير كافٍ'); return }
        const order = { ...o, status:'paid', paidAt:Date.now(), totals };
        await DB.put('orders', order);
        for(const p of payLines){ await DB.put('payments', { id:genId('pay'), orderId:order.id, shiftId:shift?.id||null, method:p.method, amount:+p.amount||0, at:Date.now() }) }
        // print
        this.printInvoice({ truth }, null, order);
        truth.batch(()=>{ truth.set(st=> ({ ...st, order: makeOrder(st.order.type), orderTotals: calcOrderTotals(makeOrder(st.order.type), st.settings), ui:{...st.ui, modal:null} })); truth.mark('order-panel'); truth.mark('modals') })
      },

      settleAndPrint(ctx){ ctx.dispatch('openSplitPay'); },

      // ----- Reports -----
      async showReports({ truth }){ const all = await DB.getAll('orders'); truth.set(s=> ({ ...s, reports:{ orders: all.sort((a,b)=> b.createdAt-a.createdAt), filters:{ status:'', query:'' } }, ui:{...s.ui, modal:{ type:'reports' }} })); truth.mark('modals') },
      setReportStatus({ truth }, e){ const v=e.target.value; truth.set(s=> ({ ...s, reports:{ ...s.reports, filters:{ ...s.reports.filters, status:v } } })); this.refreshReports({ truth }) },
      setReportQuery({ truth }, e){ const v=e.target.value||''; truth.set(s=> ({ ...s, reports:{ ...s.reports, filters:{ ...s.reports.filters, query:v } } })); this.refreshReports({ truth }) },
      async refreshReports({ truth }){ const s=truth.get(); const all=await DB.getAll('orders'); const f=s.reports.filters||{}; const list=all.filter(o=> (!f.status||o.status===f.status) && (!f.query|| String(o.id).includes(f.query)|| (o.customer?.name||'').includes(f.query)) ).sort((a,b)=>b.createdAt-a.createdAt); truth.set(st=> ({ ...st, reports:{ ...st.reports, orders:list } })); truth.mark('modals') },
      openReportOrder({ truth }, e){ const target = e.currentTarget ?? e.target?.closest?.('[data-id]'); const id = target?.getAttribute('data-id'); if(!id) return; alert('فتح الطلب '+id+' — للتوسعة: تحميله في اللوحة اليمنى لإعادة فتحه/الطباعة/التحصيل'); },

      // ----- Shift -----
      async startShift({ truth }){ const sh={ id:genId('sh'), startedAt:Date.now(), status:'open' }; await DB.put('shifts', sh); truth.set(s=> ({ ...s, session:{ ...s.session, shift: sh } })); truth.mark('hdr') },
      async endShift({ truth }){ const s=truth.get(); if(!s.session.shift) return; const sh = { ...s.session.shift, endedAt:Date.now(), status:'closed' }; await DB.put('shifts', sh); truth.set(st=> ({ ...st, session:{ ...st.session, shift:null } })); truth.rebuildAll() },

      // ----- Misc -----
      closeModal({ truth }){ truth.set(s=> ({ ...s, ui:{ ...s.ui, modal:null } })); truth.mark('modals') },

      // Thermal print: simple template
      printInvoice({ truth }, _e, orderArg){
        const s = truth.get(); const o = orderArg || s.order; const totals = o.totals || s.orderTotals;
        const el = document.getElementById('printer');
        const lines = (o.items||[]).map(li=> `• ${li.name} x${li.qty} — ${round(li.total).toFixed(2)}`).join('<br/>');
        el.innerHTML = `
          <div style="font:14px/1.25 monospace;">
            <div style="text-align:center"><b>فاتورة مبسطة</b></div>
            <div>رقم: ${o.id}</div>
            <div>التاريخ: ${new Date(o.createdAt).toLocaleString()}</div>
            <hr/>
            <div>${lines}</div>
            <hr/>
            <div>إجمالي: ${round(totals.total).toFixed(2)} ${s.meta.currency}</div>
          </div>`;
        w.print();

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
        (snapshot.lines || []).forEach((line) => {
          line.returnedQty = line.returnedQty || 0;
          line.discount = line.discount || { type: null, value: 0 };
          line.addOns = line.addOns || [];
          line.removals = line.removals || [];
          line.unitPrice = line.unitPrice || line.price;
        });

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
    "security.pinKey": ({ truth }, event, el) => {
      const key = el.getAttribute("data-key");
      truth.produce((state) => {
        const prompt = state.ui.pinPrompt;
        if (!prompt) return;
        const current = prompt.pin || "";
        if (key === "⌫") {
          prompt.pin = current.slice(0, -1);
        } else if (/^\d$/.test(key) && current.length < 4) {
          prompt.pin = current + key;
        }
      });
      truth.mark("modals-root");
    },
    "security.pinClear": ({ truth }) => {
      truth.produce((state) => {
        if (!state.ui.pinPrompt) return;
        state.ui.pinPrompt.pin = "";
        state.ui.pinPrompt.error = null;
      });
      truth.mark("modals-root");
    },
    "security.pinConfirm": ({ truth }) => {
      let result = { marks: ["modals-root"] };
      truth.produce((state) => {
        const prompt = state.ui.pinPrompt;
        if (!prompt) return;
        const pin = prompt.pin || "";
        const employee = (db.employees || []).find((emp) => emp.pin_code === pin);
        if (!employee) {
          prompt.error = "PIN غير صحيح";
          prompt.pin = "";
          prompt.currentAttempt = (prompt.currentAttempt || 0) + 1;
          return;
        }
        if ((prompt.allowedRoles || []).length && !prompt.allowedRoles.includes(employee.role)) {
          prompt.error = "غير مصرح بهذا الإجراء";
          prompt.pin = "";
          prompt.currentAttempt = (prompt.currentAttempt || 0) + 1;
          return;
        }
        result = executeSecuredAction(state, prompt.payload) || { marks: ["modals-root"] };
        state.ui.pinPrompt = { reason: null, pin: "", error: null, attempts: 3, currentAttempt: 0, allowedRoles: [], payload: null };
        state.ui.overlays.active = null;
        state.ui.overlays.payload = null;
      });
      truth.mark(result.marks && result.marks.length ? result.marks : ["modals-root"]);
      if (result.notifyKey) {
        notify(truth, result.notifyKey, result.notifyIntent || "primary");
      }
    },
    "security.dismissPin": ({ truth }) => {
      truth.produce((state) => {
        state.ui.pinPrompt = { reason: null, pin: "", error: null, attempts: 3, currentAttempt: 0, allowedRoles: [], payload: null };
        state.ui.overlays.active = null;
        state.ui.overlays.payload = null;
      });
      truth.mark("modals-root");
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
