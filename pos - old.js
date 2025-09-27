(function (window) {
    "use strict";
    const { Core } = window.Mishkah;

    const calculateTotals = (lines, settings) => {
        const subtotal = lines.reduce((acc, line) => acc + (line.total || 0), 0);
        const service = subtotal * (settings.service_charge_rate || 0);
        const vat = (subtotal + service) * (settings.tax_rate || 0);
        const grand = subtotal + service + vat;
        return { subtotal, service, vat, grand };
    };

    const createOrder = (type = 'dine_in') => ({
        id: `ord-${Date.now()}`,
        type,
        lines: [],
        totals: { subtotal: 0, service: 0, vat: 0, grand: 0 },
        tableId: null,
        customerId: null,
        status: 'new'
    });

    const commands = {
        updateLoginPin: ({ truth }, e, el) => {
            const key = el.dataset.key;
            truth.produce(s => {
                if (key === '⌫') {
                    s.ui.loginPin = s.ui.loginPin.slice(0, -1);
                } else if (s.ui.loginPin.length < 4 && key !== '.') {
                    s.ui.loginPin += key;
                }
            });
            truth.mark('#login-screen');
        },
        clearLoginPin: ({ truth }) => {
            truth.produce(s => { s.ui.loginPin = ''; });
            truth.mark('#login-screen');
        },
        attemptLogin: ({ truth }) => {
            truth.produce(s => {
                const employee = s.employees.find(e => e.pin_code === s.ui.loginPin);
                if (employee) {
                    s.session.cashier = employee;
                    s.ui.view = 'shift';
                    s.ui.loginPin = '';
                    s.ui.loginError = null;
                } else {
                    s.ui.loginError = 'PIN غير صحيح';
                    s.ui.loginPin = '';
                }
            });
            truth.rebuildAll();
        },
        logout: ({ truth }) => {
            truth.produce(s => {
                s.session.cashier = null;
                s.session.shift = null;
                s.ui.view = 'login';
            });
            truth.rebuildAll();
        },
        openShift: ({ truth }) => {
            truth.produce(s => {
                s.session.shift = {
                    id: Date.now().toString().slice(-6),
                    startTime: new Date().toISOString(),
                    openingFloat: s.ui.openingFloat || 0,
                    orders: []
                };
                s.order = createOrder();
                s.ui.view = 'pos';
            });
            truth.rebuildAll();
        },
        closeShift: ({ truth }) => {
            truth.produce(s => {
                s.session.cashier = null;
                s.session.shift = null;
                s.ui.view = 'login';
            });
            truth.rebuildAll();
        },
        updateOpeningFloat: ({ truth }, e) => {
            truth.produce(s => { s.ui.openingFloat = parseFloat(e.target.value) || 0; });
            truth.mark('#pos-root');
        },
        selectCategory: ({ truth }, e, el) => {
            const categoryId = el.dataset.id;
            truth.produce(s => { s.env.currentCategory = categoryId; });
            truth.mark('#menu-panel');
        },
        setSearchQuery: ({ truth }, e) => {
            truth.produce(s => { s.env.searchQuery = e.target.value; });
            truth.mark('#menu-panel');
        },
        addToOrder: ({ truth }, e, el) => {
			
            const itemId = el.dataset.itemId;
            truth.produce(s => {
                if (!s.order) s.order = createOrder();
                const itemData = s.catalog.items.find(i => i.id == itemId);
                if (!itemData) return;
                
                const locale = s.env.locale || 'ar';
                const existingLine = s.order.lines.find(line => line.itemId == itemId && !line.mods);
                if (existingLine) {
                    existingLine.qty++;
                    existingLine.total = existingLine.price * existingLine.qty;
                } else {
                    s.order.lines.push({
                        id: `${itemId}-${Date.now()}`,
                        itemId: itemData.id,
                        name: (itemData.translations[locale] || itemData.translations.en).name,
                        qty: 1,
                        price: itemData.price,
                        total: itemData.price,
                        mods: null
                    });
                }
                s.order.totals = calculateTotals(s.order.lines, s.settings);
            });
            truth.mark('#order-panel');
			
			
        },
        removeOrderLine: ({ truth }, e, el) => {
            const index = parseInt(el.dataset.index, 10);
            truth.produce(s => {
                if (!s.order || !s.order.lines[index]) return;
                s.order.lines.splice(index, 1);
                s.order.totals = calculateTotals(s.order.lines, s.settings);
            });
            truth.mark('#order-panel');
        },
        increaseLineQty: ({ truth }, e, el) => {
            const index = parseInt(el.dataset.index, 10);
            truth.produce(s => {
                const line = s.order.lines[index];
                if (line) {
                    line.qty++;
                    line.total = line.price * line.qty;
                    s.order.totals = calculateTotals(s.order.lines, s.settings);
                }
            });
            truth.mark('#order-panel');
        },
        decreaseLineQty: ({ truth }, e, el) => {
            const index = parseInt(el.dataset.index, 10);
            truth.produce(s => {
                const line = s.order.lines[index];
                if (line) {
                    line.qty = Math.max(0, line.qty - 1);
                    if (line.qty === 0) {
                        s.order.lines.splice(index, 1);
                    } else {
                        line.total = line.price * line.qty;
                    }
                    s.order.totals = calculateTotals(s.order.lines, s.settings);
                }
            });
            truth.mark('#order-panel');
        },
        parkOrder: ({ truth }) => {
            truth.produce(s => {
                if (s.order && s.order.lines.length > 0) {
                    s.parkedOrders.push(s.order);
                    s.order = createOrder(s.order.type);
                }
            });
            truth.mark('#order-panel');
        },
        showPosView: ({ truth }) => { 
            truth.produce(s => { s.ui.view = 'pos'; });
            truth.rebuildAll();
        },
        showTables: ({ truth }) => { 
            truth.produce(s => { s.ui.view = 'tables'; });
            truth.rebuildAll();
        },
        showReports: ({ truth }) => { 
            truth.produce(s => { s.ui.view = 'reports'; });
            truth.rebuildAll();
        },
        openSettleSheet: ({ truth }) => { 
            truth.produce(s => { s.ui.view = 'settle'; });
            truth.rebuildAll();
        },
        selectTable: ({ truth }, e, el) => {
            const tableId = el.dataset.id;
            truth.produce(s => {
                if (!s.order) s.order = createOrder();
                s.order.tableId = tableId;
                s.ui.view = 'pos';
            });
            truth.rebuildAll();
        },
        updatePaymentAmount: ({ truth }, e, el) => {
            const key = el.dataset.key;
            truth.produce(s => {
                let current = String(s.ui.payment.amount || '0');
                if (key === '⌫') {
                    current = current.length > 1 ? current.slice(0, -1) : '0';
                } else if (key === '.' && !current.includes('.')) {
                    current += '.';
                } else if (key !== '.') {
                    current = current === '0' ? key : current + key;
                }
                s.ui.payment.amount = parseFloat(current);
            });
            truth.mark('#pos-root');
        },
        clearPaymentAmount: ({ truth }) => {
            truth.produce(s => { s.ui.payment.amount = 0; });
            truth.mark('#pos-root');
        },
        finalizeOrder: ({ truth }) => {
            truth.produce(s => {
                if (s.order && s.order.lines.length > 0) {
                    const finalOrder = {
                        ...s.order,
                        status: 'paid',
                        paidAt: new Date().toISOString(),
                        cashier: s.session.cashier
                    };
                    s.history.closedOrders.push(finalOrder);
                    s.order = createOrder(s.order.type);
                    s.ui.payment.amount = 0;
                    s.ui.view = 'pos';
                }
            });
            truth.rebuildAll();
        },
        toggleTheme: ({ env }) => env.toggleTheme(),
        switchLanguage: ({ env }) => {
             const newLocale = env.get().locale === 'ar' ? 'en' : 'ar';
             env.setLocale(newLocale);
        },
    };

    const app = Core.createApp({
        mount: '#app',
        rootComponent: 'POSRoot',
        locale: 'ar',
        dir: 'auto',
        theme: 'auto',
        persistEnv: true,
        dictionaries: {
            ui: {
                welcome: { en: 'Welcome', ar: 'أهلاً بك' },
                enterPin: { en: 'Enter your PIN to continue', ar: 'أدخل رقم التعريف الشخصي للمتابعة' },
                login: { en: 'Login', ar: 'دخول' },
                logout: { en: 'Logout', ar: 'خروج' },
                tables: { en: 'Tables', ar: 'الطاولات' },
                reports: { en: 'Reports', ar: 'التقارير' },
                shift: { en: 'Shift', ar: 'الوردية' },
                noShift: { en: 'No Active Shift', ar: 'لا توجد وردية نشطة' },
                searchItems: { en: 'Search items...', ar: 'ابحث عن الأصناف...' },
                emptyOrder: { en: 'Empty Order', ar: 'الطلب فارغ' },
                selectItems: { en: 'Select items to start', ar: 'اختر أصنافاً للبدء' },
                dine_in: { en: 'Dine-in', ar: 'صالة' },
                takeaway: { en: 'Takeaway', ar: 'سفري' },
                delivery: { en: 'Delivery', ar: 'توصيل' },
                subtotal: { en: 'Subtotal', ar: 'المجموع الفرعي' },
                service: { en: 'Service', ar: 'خدمة' },
                vat: { en: 'VAT', ar: 'ضريبة القيمة المضافة' },
                grandTotal: { en: 'Total', ar: 'الإجمالي' },
                parkOrder: { en: 'Park Order', ar: 'تعليق الطلب' },
                settle: { en: 'Settle', ar: 'تحصيل' },
                clear: { en: 'C', ar: 'مسح' },
                confirm: { en: 'Confirm', ar: 'تأكيد' },
                select_table: { en: 'Select Table', ar: 'اختر طاولة' },
                seats: { en: 'seats', ar: 'مقاعد' },
                settlePayment: { en: 'Settle Payment', ar: 'تحصيل الدفعة' },
                totalDue: { en: 'Total Due', ar: 'المبلغ المستحق' },
                payCash: { en: 'Pay Cash', ar: 'دفع نقدي' },
                openShift: {en: 'Open Shift', ar: 'فتح وردية'},
                closeShift: {en: 'Close Shift', ar: 'إغلاق وردية'},
                openingFloat: {en: 'Opening Float', ar: 'رصيد الافتتاح'},
                startTime: {en: 'Start Time', ar: 'وقت البدء'},
                cashSales: {en: 'Cash Sales', ar: 'مبيعات نقدية'},
                expectedCash: {en: 'Expected in Drawer', ar: 'المتوقع بالدرج'},
                type: {en: 'Type', ar: 'النوع'},
                total: {en: 'Total', ar: 'المجموع'},
                cashier: {en: 'Cashier', ar: 'الكاشير'},
            }
        },
        initial: {
            settings: window.database.settings,
            catalog: {
                items: window.database.items,
                categories: window.database.categories,
                modifiers: window.database.modifiers
            },
            employees: window.database.employees,
            tables: window.database.tables,
            session: { cashier: null, shift: null },
            order: null,
            parkedOrders: [],
            history: { closedOrders: [] },
            ui: {
                view: 'login',
                loginPin: '',
                loginError: null,
                payment: { amount: 0, method: 'cash' },
                openingFloat: 0
            },
            env: {
                locale: 'ar',
                currentCategory: 'all',
                searchQuery: ''
            }
        },
        commands,helpers: {
            formatCurrency: (amount, locale, currency = 'EGP') => {
                // 'app' غير ضروري هنا لأننا نمرر locale الصحيح
                const loc = locale || 'ar'; // يمكنك وضع قيمة افتراضية
                const val = typeof amount === 'number' ? amount : 0;
                return new Intl.NumberFormat(loc, { style: 'currency', currency, currencyDisplay: 'symbol' }).format(val);
            }
        }
		
    });
 app.helpers = {
        formatCurrency: (amount, locale, currency = 'EGP') => {
            // ✅ الآن 'app' معرف ومتاح للاستخدام
            const loc = locale || app.env.get().locale;
            const val = typeof amount === 'number' ? amount : 0;
            return new Intl.NumberFormat(loc, { style: 'currency', currency, currencyDisplay: 'symbol' }).format(val);
        }
    };

    // --- الخطوة 3: اجعل التطبيق متاحًا بشكل عام ---
    window.app = app;



setTimeout(() => {
    app.truth.mark('pos-root');
}, 100);   


})(window);

