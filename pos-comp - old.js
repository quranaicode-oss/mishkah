(function (window) {
    "use strict";
    const { Comp: C, Atoms: A, utils: U } = window.Mishkah;

    C.define('LoginScreen', (A, s, app) => {
        const pin = s.ui.loginPin || '';
        return A.Div({
            uniqueKey: 'login-screen',
            style: {
                position: 'fixed', inset: 0, zIndex: 1000,
                background: 'var(--bg-page)', color: 'var(--text-default)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
            }
        }, {
            default: [
                A.Div({ style: { width: 'min(90vw, 380px)', textAlign: 'center' } }, {
                    default: [
                        A.h1({ style: { fontSize: '2rem', fontWeight: 700, marginBottom: '8px' } }, { default: [app.i18n.t('ui.welcome')] }),
                        A.p({ style: { color: 'var(--text-subtle)', marginBottom: '24px' } }, { default: [app.i18n.t('ui.enterPin')] }),
                        A.Div({
                            style: {
                                display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '24px',
                                direction: 'ltr', height: '48px'
                            }
                        }, {
                            default: U.range(4, 0).map(i =>
                                A.Div({
                                    style: {
                                        width: '40px', height: '48px', borderRadius: '12px',
                                        background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '24px'
                                    }
                                }, { default: [pin.length > i ? '●' : ''] })
                            )
                        }),
                        s.ui.loginError ? app.call('InlineAlert', { intent: 'danger', text: s.ui.loginError }) : null,
                        app.call('Numpad', {
                            onInputCommand: 'updateLoginPin',
                            onConfirmCommand: 'attemptLogin',
                            onClearCommand: 'clearLoginPin',
                            confirmLabel: app.i18n.t('ui.login')
                        })
                    ]
                })
            ]
        });
    });

    C.define('Numpad', (A, s, app, p) => {
        const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'];
        const btnStyle = {
            height: '64px', borderRadius: '16px', background: 'var(--bg-surface)',
            border: '1px solid var(--border-default)', fontSize: '24px', fontWeight: 500,
            color: 'var(--text-default)'
        };

        return A.Div({ style: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', userSelect: 'none' } }, {
            default: [
                ...keys.map(key => app.call('Button', {
                    text: key,
                    style: btnStyle,
                    'data-onclick': p.onInputCommand,
                    'data-key': key
                })),
                p.onClearCommand ? app.call('Button', { text: app.i18n.t('ui.clear'), 'data-onclick': p.onClearCommand, style: { ...btnStyle, gridColumn: 'span 1' } }) : A.Span(),
                p.onConfirmCommand ? app.call('Button', { text: p.confirmLabel || app.i18n.t('ui.confirm'), 'data-onclick': p.onConfirmCommand, intent: 'success', style: { ...btnStyle, gridColumn: 'span 2' } }) : null
            ]
        });
    });

    C.define('POSHeader', (A, s, app) => {
        const session = s.session || {};
        const cashierName = session.cashier ? session.cashier.full_name : '...';
        const shiftInfo = session.shift ? `${app.i18n.t('ui.shift')} #${session.shift.id}` : app.i18n.t('ui.noShift');

        return A.Header({
            style: {
                gridArea: 'header', background: 'var(--bg-surface)', color: 'var(--text-default)',
                borderBottom: '1px solid var(--border-default)', padding: '0 16px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                height: '64px'
            }
        }, {
            default: [
                A.Div({ style: { display: 'flex', alignItems: 'center', gap: '16px' } }, {
                    default: [
                        A.Div({ style: { fontSize: '24px', fontWeight: 700, color: 'var(--primary)' } }, { default: ['Mishkah POS'] }),
                        A.Div({}, {
                            default: [
                                A.Div({ style: { fontWeight: 700 } }, { default: [cashierName] }),
                                A.Div({ style: { fontSize: '12px', color: 'var(--text-subtle)' } }, { default: [shiftInfo] })
                            ]
                        })
                    ]
                }),
                A.Div({ style: { display: 'flex', alignItems: 'center', gap: '8px' } }, {
                    default: [
                        app.call('Button', { 'data-onclick': 'showTables', text: app.i18n.t('ui.tables'), variant: 'outline' }),
                        app.call('Button', { 'data-onclick': 'showReports', text: app.i18n.t('ui.reports'), variant: 'outline' }),
                        app.call('Button', { 'data-onclick': 'toggleTheme', text: '🎨', variant: 'ghost' }),
                        app.call('Button', { 'data-onclick': 'switchLanguage', text: s.env.locale === 'ar' ? 'EN' : 'AR', variant: 'ghost' }),
                        app.call('Button', { 'data-onclick': 'logout', text: app.i18n.t('ui.logout'), intent: 'danger', variant: 'ghost' }),
                    ]
                })
            ]
        });
    });
    
    C.define('MenuPanel', (A, s, app) => {
        const { catalog, env } = s;
        const currentCat = env.currentCategory || 'all';
        const searchQuery = (env.searchQuery || '').toLowerCase();
        
        const filteredItems = catalog.items.filter(item => {
            const inCategory = currentCat === 'all' || item.category === currentCat;
            if (!inCategory) return false;
            if (!searchQuery) return true;
            
            const name = (item.translations[s.env.locale] || item.translations.en).name || '';
            return name.toLowerCase().includes(searchQuery);
        });

        return A.Div({
            style: { gridArea: 'menu', background: 'var(--bg-page)', padding: '16px', display: 'flex', flexDirection: 'column' }
        }, {
            default: [
                A.Div({ style: { display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' } }, {
                    default: catalog.categories.map(cat =>
                        app.call('Chip', {
                            'data-onclick': 'selectCategory',
                            'data-id': cat.id,
                            label: (cat.translations[s.env.locale] || cat.translations.en).name,
                            active: currentCat === cat.id
                        })
                    )
                }),
                A.Div({ style: { marginBottom: '16px' } }, {
                    default: [ app.call('Input', { placeholder: app.i18n.t('ui.searchItems'), value: s.env.searchQuery || '', 'data-oninput': 'setSearchQuery' }) ]
                }),
                A.Div({ class: 'no-scrollbar', style: { flex: '1 1 auto', overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px' } }, {
                    default: filteredItems.map(item => app.call('MenuCard', { item, locale: s.env.locale }))
                })
            ]
        });
    });

    C.define('MenuCard', (A, s, app, p) => {
        const { item, locale } = p;
        const name = (item.translations[locale] || item.translations.en).name;
        return A.Div({
            'data-onclick': 'addToOrder',
            'data-item-id': item.id,
            style: {
                cursor: 'pointer', background: 'var(--bg-surface)', borderRadius: '16px',
                border: '1px solid var(--border-default)', overflow: 'hidden',
                display: 'flex', flexDirection: 'column'
            }
        }, {
            default: [
                A.Img({ src: item.image, alt: name, style: { width: '100%', height: '100px', objectFit: 'cover' } }),
                A.Div({ style: { padding: '8px', flex: '1 1 auto', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } }, {
                    default: [
                        A.Div({ style: { fontSize: '14px', fontWeight: 500, minHeight: '40px' } }, { default: [name] }),
                        A.Div({ style: { fontSize: '16px', fontWeight: 700, color: 'var(--primary)', textAlign: 'end' } }, { default: [app.helpers.formatCurrency(item.price)] })
                    ]
                })
            ]
        });
    });

    C.define('OrderPanel', (A, s, app) => {
        const { order } = s;
        return A.Div({
            style: {
                gridArea: 'order', background: 'var(--bg-surface)', borderLeft: '1px solid var(--border-default)',
                display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)'
            }
        }, {
            default: [
                app.call('OrderHeader', { order }),
                A.Div({ class: 'no-scrollbar', style: { flex: '1 1 auto', overflowY: 'auto', padding: '8px' } }, {
                    default: [
                        (!order || !order.lines.length)
                            ? app.call('EmptyState', { title: app.i18n.t('ui.emptyOrder'), text: app.i18n.t('ui.selectItems') })
                            : order.lines.map((line, index) => app.call('OrderLine', { line, index }))
                    ]
                }),
                order && order.lines.length > 0 ? app.call('OrderTotals', { totals: order.totals }) : null,
                order && order.lines.length > 0 ? app.call('OrderActions') : null,
            ]
        });
    });

    C.define('OrderHeader', (A, s, app, p) => {
        const { order } = p;
        const type = order ? order.type : 'dine_in';
        const table = order && order.tableId ? s.tables.find(t => t.id === order.tableId) : null;
        return A.Div({
            style: { padding: '12px', borderBottom: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }
        }, {
            default: [
                app.call('Segmented', {
                    items: [
                        { id: 'dine_in', label: app.i18n.t('ui.dine_in') },
                        { id: 'takeaway', label: app.i18n.t('ui.takeaway') },
                        { id: 'delivery', label: app.i18n.t('ui.delivery') }
                    ],
                    activeId: type,
                    'data-onchange': 'setOrderType'
                }),
                A.Div({}, { default: [ table ? app.call('Badge', { children: [table.name] }) : null ] })
            ]
        });
    });

    C.define('OrderLine', (A, s, app, p) => {
        const { line, index } = p;
        const btnStyle = { minWidth: '32px', height: '32px', padding: '0 8px', borderRadius: '8px' };
        const inputStyle = { width: '40px', textAlign: 'center', background: 'var(--bg-page)', border: 'none', borderRadius: '8px', height: '32px' };
        return A.Div({
            style: { display: 'flex', alignItems: 'center', padding: '8px', borderRadius: '12px', background: 'var(--bg-ui-hover)' }
        }, {
            default: [
                app.call('Button', { text: '×', 'data-onclick': `removeOrderLine`, 'data-index': index, intent: 'danger', variant: 'ghost', size: 'sm' }),
                A.Div({ style: { flex: '1 1 auto', margin: '0 8px' } }, {
                    default: [
                        A.Div({ style: { fontWeight: 500 } }, { default: [line.name] }),
                        line.modsText ? A.Div({ style: { fontSize: '12px', color: 'var(--text-subtle)' } }, { default: [line.modsText] }) : null,
                    ]
                }),
                A.Div({ style: { display: 'flex', alignItems: 'center', gap: '4px' } }, {
                    default: [
                        app.call('Button', { text: '−', style: btnStyle, 'data-onclick': 'decreaseLineQty', 'data-index': index }),
                        A.Input({ type: 'text', value: line.qty, readonly: true, style: inputStyle }),
                        app.call('Button', { text: '+', style: btnStyle, 'data-onclick': 'increaseLineQty', 'data-index': index })
                    ]
                }),
                A.Div({ style: { width: '80px', textAlign: 'end', fontWeight: 700 } }, { default: [app.helpers.formatCurrency(line.total)] })
            ]
        });
    });

    C.define('OrderTotals', (A, s, app, p) => {
        const { totals } = p;
        const f = app.helpers.formatCurrency;
        return A.Div({ style: { padding: '16px', borderTop: '1px solid var(--border-default)' } }, {
            default: [
                app.call('DescriptionList', {
                    items: [
                        { term: app.i18n.t('ui.subtotal'), details: f(totals.subtotal) },
                        { term: `${app.i18n.t('ui.service')} (${(s.settings.service_charge_rate * 100).toFixed(0)}%)`, details: f(totals.service) },
                        { term: `${app.i18n.t('ui.vat')} (${(s.settings.tax_rate * 100).toFixed(0)}%)`, details: f(totals.vat) },
                    ]
                }),
                A.Div({ style: { marginTop: '12px', paddingTop: '12px', borderTop: '2px solid var(--border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '24px', fontWeight: 700 } }, {
                    default: [
                        A.Span({}, { default: [app.i18n.t('ui.grandTotal')] }),
                        A.Span({}, { default: [f(totals.grand)] }),
                    ]
                })
            ]
        });
    });

    C.define('OrderActions', (A, s, app) => {
        return A.Div({ style: { padding: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' } }, {
            default: [
                app.call('Button', { text: app.i18n.t('ui.parkOrder'), 'data-onclick': 'parkOrder', variant: 'outline', style: {gridColumn: 'span 2'} }),
                app.call('Button', { text: app.i18n.t('ui.settle'), 'data-onclick': 'openSettleSheet', intent: 'success', style: { gridColumn: 'span 2', height: '48px', fontSize: '18px' } }),
            ]
        });
    });
    
    C.define('TablesModal', (A, s, app) => {
        return app.call('Modal', {
            open: s.ui.view === 'tables',
            title: app.i18n.t('ui.select_table'),
            onClose: () => app.dispatch('showPosView'),
            size: 'lg',
        },{
            default: [
                A.Div({ style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '16px' } }, {
                    default: s.tables.map(table => app.call('TableCard', { table }))
                })
            ]
        });
    });

    C.define('TableCard', (A, s, app, p) => {
        const { table } = p;
        const statusColors = {
            available: 'var(--success)',
            occupied: 'var(--danger)',
            reserved: 'var(--brand-warning-h, #f59e0b)',
        };
        return A.Div({
            'data-onclick': 'selectTable',
            'data-id': table.id,
            style: {
                height: '100px',
                border: `2px solid ${statusColors[table.status]}`,
                background: 'var(--bg-surface)',
                borderRadius: '16px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
            }
        }, {
            default: [
                A.Div({ style: { fontSize: '20px', fontWeight: 700 } }, { default: [table.name] }),
                A.Div({ style: { fontSize: '12px', color: 'var(--text-subtle)' } }, { default: [`${table.seats} ${app.i18n.t('ui.seats')}`] })
            ]
        });
    });

    C.define('SettleSheet', (A, s, app) => {
        const { order, ui } = s;
        if (!order) return null;
        const f = app.helpers.formatCurrency;
        const total = order.totals.grand;
        const paid = ui.payment.amount || 0;
        const due = total - paid;
        
        return app.call('Sheet', {
            open: s.ui.view === 'settle',
            onClose: () => app.dispatch('showPosView'),
            title: app.i18n.t('ui.settlePayment'),
            side: 'end',
            size: 'md'
        }, {
            default: [
                A.Div({ style: { display: 'flex', flexDirection: 'column', gap: '16px' } }, {
                    default: [
                        A.Div({ style: { textAlign: 'center' } }, {
                            default: [
                                A.Div({ style: { color: 'var(--text-subtle)', fontSize: '14px' } }, { default: [app.i18n.t('ui.totalDue')] }),
                                A.Div({ style: { fontSize: '48px', fontWeight: 700, color: 'var(--primary)' } }, { default: [f(total)] }),
                                A.Div({ style: { color: due < 0 ? 'var(--success)' : 'var(--text-default)' } }, { default: [ `${due < 0 ? 'Change' : 'Remaining'}: ${f(Math.abs(due))}`] })
                            ]
                        }),
                        app.call('Numpad', {
                            onInputCommand: 'updatePaymentAmount',
                            onClearCommand: 'clearPaymentAmount'
                        }),
                        app.call('Button', { text: app.i18n.t('ui.payCash'), 'data-onclick': 'finalizeOrder', intent: 'success', style: { width: '100%', height: '50px' } })
                    ]
                })
            ]
        });
    });
    
    C.define('ShiftModal', (A, s, app) => {
        const { session, ui } = s;
        const isOpen = ui.view === 'shift';
        if (!isOpen) return null;
        
        const isShiftActive = session && session.shift;
        
        return app.call('Modal', {
            open: isOpen,
            title: isShiftActive ? app.i18n.t('ui.closeShift') : app.i18n.t('ui.openShift'),
            onClose: () => app.dispatch(isShiftActive ? 'showPosView' : 'logout'),
            size: 'sm',
            dismissable: isShiftActive
        }, {
            body: [
                isShiftActive 
                ? app.call('ShiftSummary', {shift: session.shift})
                : app.call('FormRow', {label: app.i18n.t('ui.openingFloat')}, {
                    default: [app.call('Input', {type: 'number', value: ui.openingFloat || '', 'data-oninput': 'updateOpeningFloat'})]
                })
            ],
            footer: [
                isShiftActive 
                ? app.call('Button', {text: app.i18n.t('ui.closeShift'), intent: 'danger', 'data-onclick': 'closeShift'})
                : app.call('Button', {text: app.i18n.t('ui.openShift'), intent: 'success', 'data-onclick': 'openShift'})
            ]
        });
    });
    
    C.define('ShiftSummary', (A,s,app,p) => {
        return app.call('DescriptionList', {
            items: [
                {term: app.i18n.t('ui.startTime'), details: new Date(p.shift.startTime).toLocaleTimeString()},
                {term: app.i18n.t('ui.openingFloat'), details: app.helpers.formatCurrency(p.shift.openingFloat)},
                {term: app.i18n.t('ui.cashSales'), details: app.helpers.formatCurrency(0)},
                {term: app.i18n.t('ui.expectedCash'), details: app.helpers.formatCurrency(p.shift.openingFloat)},
            ]
        })
    })

    C.define('ReportsSheet', (A, s, app) => {
        return app.call('Sheet', {
            open: s.ui.view === 'reports',
            onClose: () => app.dispatch('showPosView'),
            title: app.i18n.t('ui.reports'),
            side: 'start',
            size: 'xl'
        }, {
            default: [ app.call('DataTablePro', {
                columns: [
                    {key: 'id', title: '#'},
                    {key: 'type', title: app.i18n.t('ui.type')},
                    {key: 'grand', title: app.i18n.t('ui.total')},
                    {key: 'cashier', title: app.i18n.t('ui.cashier')},
                ],
                rows: s.history.closedOrders.map(o => ({
                    id: o.id.slice(-4),
                    type: app.i18n.t(`ui.${o.type}`),
                    grand: app.helpers.formatCurrency(o.totals.grand),
                    cashier: o.cashier.full_name,
                })),
                ajax: false
            }) ]
        });
    });
    
    C.define('POSRoot', (A, s, app) => {
        if (!s.session || !s.session.cashier) {
            return app.call('LoginScreen', { uniqueKey: 'login-screen' });
        }
        if (!s.session.shift) {
            return app.call('ShiftModal');
        }

        return A.Div({
            uniqueKey: 'pos-root',
            style: {
                height: '100vh', display: 'grid',
                gridTemplateRows: '64px 1fr',
                gridTemplateColumns: 'auto 420px',
                gridTemplateAreas: '"header header" "menu order"'
            }
        }, {
            default: [
                app.call('POSHeader', { uniqueKey: 'pos-header'}),
                app.call('MenuPanel', { uniqueKey: 'menu-panel'}),
                app.call('OrderPanel', { uniqueKey: 'order-panel'}),
                app.call('TablesModal'),
                app.call('SettleSheet'),
                app.call('ReportsSheet'),
                app.call('ShiftModal')
            ]
        });
    });

})(window);

