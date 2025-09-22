/* global window */
(function (window) {
  'use strict';

  const M = window.Mishkah || {};
  const Comp = M.Comp;
  const A = M.Atoms;

  if (!Comp || !A) {
    console.warn('[POSC] Mishkah components/atoms are required.');
    return;
  }

  const toArr = (v) => (Array.isArray(v) ? v : v == null ? [] : [v]);
  const asText = (ctx, key, fallback) => (ctx?.i18n?.t ? ctx.i18n.t(key, { fallback }) : (fallback || key));

  function formatCurrency(state, env, amount) {
    const util = Comp.util.get && Comp.util.get('Currency');
    const locale = env?.get?.().locale || 'en';
    const currency = (state?.settings?.currency && (state.settings.currency.code || state.settings.currency.en || state.settings.currency.ar)) || 'USD';
    if (util) {
      return util.format(Number(amount) || 0, { locale, currency });
    }
    const numeric = Number(amount) || 0;
    return `${numeric.toFixed(2)} ${currency}`;
  }

  function itemTitle(item, locale) {
    if (!item) return '';
    const translations = item.translations || {};
    return translations[locale]?.name || translations.en?.name || item.name || `#${item.id}`;
  }

  const POSC = {};

  POSC.Header = (state, ctx) => {
    const env = ctx.env;
    const locale = env?.get?.().locale || 'en';
    const cashier = state.session?.cashier;
    const shift = state.session?.shift;
    const orderType = state.order?.type || 'dine_in';

    return Comp.call('Panel', {
      class: 'pos-header',
      style: { padding: 0 }
    }, {
      header: [
        A.Div({ style: { display: 'flex', alignItems: 'center', gap: '12px' } }, {
          default: [
            Comp.call('Avatar', { name: cashier?.full_name || 'Cashier', initials: cashier?.full_name?.split(' ').map(p => p[0]).join('').slice(0, 2) }),
            A.Div({ style: { display: 'flex', flexDirection: 'column' } }, {
              default: [
                A.Span({ style: { fontWeight: 700, fontSize: '15px', color: '#0f172a' } }, { default: [cashier?.full_name || asText(ctx, 'ui.cashier', 'Cashier')] }),
                shift ? A.Span({ style: { fontSize: '12px', color: '#475569' } }, { default: [`${asText(ctx, 'ui.shift', 'Shift')} #${shift.id}`] }) : null
              ]
            })
          ]
        })
      ],
      body: [
        A.Div({ style: { display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', padding: '16px 22px' } }, {
          default: [
            Comp.call('Chip', {
              class: orderType === 'dine_in' ? 'bg-indigo-600 text-white' : 'bg-slate-200',
              'data-onclick': 'setOrderType',
              'data-type': 'dine_in'
            }, { default: [asText(ctx, 'ui.dine_in', 'Dine-in')] }),
            Comp.call('Chip', {
              class: orderType === 'takeaway' ? 'bg-indigo-600 text-white' : 'bg-slate-200',
              'data-onclick': 'setOrderType',
              'data-type': 'takeaway'
            }, { default: [asText(ctx, 'ui.takeaway', 'Takeaway')] }),
            Comp.call('Chip', {
              class: orderType === 'delivery' ? 'bg-indigo-600 text-white' : 'bg-slate-200',
              'data-onclick': 'setOrderType',
              'data-type': 'delivery'
            }, { default: [asText(ctx, 'ui.delivery', 'Delivery')] }),
            A.Div({ style: { flex: '1 1 auto' } }),
            Comp.call('Button', {
              variant: 'ghost',
              iconLeft: '🌓',
              text: asText(ctx, 'ui.toggle_theme', 'Theme'),
              'data-onclick': 'toggleTheme'
            }),
            Comp.call('Button', {
              variant: 'ghost',
              iconLeft: '🌐',
              text: locale.toUpperCase(),
              'data-onclick': 'toggleLocale'
            })
          ]
        })
      ]
    });
  };

  POSC.CategoryTabs = (state, ctx) => {
    const env = ctx.env;
    const locale = env?.get?.().locale || 'en';
    const categories = [{ id: 'all', title: asText(ctx, 'ui.all', 'All') }].concat(toArr(state.catalog?.categories).map(cat => ({
      id: cat.id,
      title: cat.translations?.[locale]?.name || cat.translations?.en?.name || cat.id
    })));
    return Comp.call('Tabs', {
      items: categories,
      value: state.ui?.menu?.category || 'all',
      command: 'setCategory'
    });
  };

  POSC.MenuGrid = (state, ctx) => {
    const env = ctx.env;
    const locale = env?.get?.().locale || 'en';
    const query = state.ui?.menu?.query || '';
    const category = state.ui?.menu?.category || 'all';
    const items = toArr(state.catalog?.items);
    const filtered = items.filter(item => {
      const matchesCategory = category === 'all' || item.category === category;
      const title = itemTitle(item, locale).toLowerCase();
      const matchesQuery = !query || title.includes(query.toLowerCase());
      return matchesCategory && matchesQuery;
    });

    return Comp.call('Panel', {
      class: 'pos-menu-panel'
    }, {
      header: [
        POSC.CategoryTabs(state, ctx)
      ],
      body: [
        Comp.call('FormRow', {
          label: asText(ctx, 'ui.search', 'Search'),
          description: asText(ctx, 'ui.search_hint', 'Type to filter menu items')
        }, {
          default: [
            Comp.call('Input', {
              value: query,
              placeholder: asText(ctx, 'ui.search_menu', 'Search menu...'),
              'data-oninput': 'setMenuQuery'
            })
          ]
        }),
        A.Div({
          style: {
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '16px',
            marginTop: '12px'
          }
        }, {
          default: filtered.map(item => {
            return Comp.call('Card', {
              class: 'pos-menu-item-card',
              style: { minHeight: '180px' }
            }, {
              header: [
                A.Div({ style: { fontWeight: 600, fontSize: '14px', color: '#0f172a' } }, { default: [itemTitle(item, locale)] })
              ],
              body: [
                A.Div({ style: { fontSize: '13px', color: '#475569', minHeight: '54px' } }, {
                  default: [item.translations?.[locale]?.description || item.translations?.en?.description || '']
                })
              ],
              footer: [
                A.Div({ style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' } }, {
                  default: [
                    A.Span({ style: { fontWeight: 700, color: '#1e293b' } }, { default: [formatCurrency(state, env, item.price)] }),
                    Comp.call('Button', {
                      intent: 'primary',
                      size: 'sm',
                      text: asText(ctx, 'ui.add', 'Add'),
                      'data-onclick': 'addItemToOrder',
                      'data-item-id': item.id
                    })
                  ]
                })
              ]
            });
          })
        })
      ]
    });
  };

  function renderLine(state, ctx, line) {
    const env = ctx.env;
    const locale = env?.get?.().locale || 'en';
    const total = (line.qty * line.price) + (line.modDelta || 0);
    return Comp.call('Card', {
      class: 'pos-line-card',
      style: { paddingBottom: '12px' }
    }, {
      header: [
        A.Div({ style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, {
          default: [
            A.Span({ style: { fontWeight: 600, fontSize: '14px', color: '#0f172a' } }, { default: [line.title || `#${line.item_id}`] }),
            A.Span({ style: { fontWeight: 600, color: '#1e293b' } }, { default: [formatCurrency(state, env, total)] })
          ]
        })
      ],
      body: [
        A.Div({ style: { display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' } }, {
          default: [
            Comp.call('Badge', {
              class: 'bg-indigo-600 text-white px-3 py-1'
            }, { default: [`${line.qty}×`] }),
            A.Div({ style: { display: 'flex', gap: '6px' } }, {
              default: [
                Comp.call('Button', {
                  variant: 'ghost',
                  size: 'sm',
                  text: '−',
                  'data-onclick': 'decrementLineQty',
                  'data-line-id': line.id
                }),
                Comp.call('Button', {
                  variant: 'ghost',
                  size: 'sm',
                  text: '+',
                  'data-onclick': 'incrementLineQty',
                  'data-line-id': line.id
                }),
                Comp.call('Button', {
                  variant: 'ghost',
                  size: 'sm',
                  text: '⋯',
                  'data-onclick': 'openLineActions',
                  'data-line-id': line.id
                })
              ]
            })
          ]
        }),
        line.notes ? A.Div({ style: { marginTop: '6px', fontSize: '12px', color: '#475569' } }, { default: [line.notes] }) : null
      ],
      footer: [
        A.Div({ style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, {
          default: [
            Comp.call('Button', {
              variant: 'ghost',
              size: 'sm',
              text: asText(ctx, 'ui.qty', 'Qty'),
              'data-onclick': 'openNumpadModal',
              'data-line-id': line.id
            }),
            Comp.call('Button', {
              variant: 'ghost',
              size: 'sm',
              text: asText(ctx, 'ui.remove', 'Remove'),
              intent: 'danger',
              'data-onclick': 'removeLine',
              'data-line-id': line.id
            })
          ]
        })
      ]
    });
  }

  POSC.OrderPanel = (state, ctx) => {
    const lines = toArr(state.order?.lines);
    if (!lines.length) {
      return Comp.call('Panel', { class: 'pos-order-panel' }, {
        body: [
          Comp.call('EmptyState', {
            icon: '🛒',
            title: asText(ctx, 'ui.no_items', 'No items yet'),
            text: asText(ctx, 'ui.add_first_item', 'Add menu items to start the order')
          })
        ]
      });
    }

    return Comp.call('Panel', { class: 'pos-order-panel' }, {
      body: [
        A.Div({ style: { display: 'flex', flexDirection: 'column', gap: '12px' } }, {
          default: lines.map(line => renderLine(state, ctx, line))
        })
      ]
    });
  };

  POSC.FooterBar = (state, ctx) => {
    const env = ctx.env;
    const order = state.order || {};
    const summary = [
      { label: asText(ctx, 'ui.subtotal', 'Subtotal'), value: order.subtotal || 0 },
      { label: asText(ctx, 'ui.service', 'Service'), value: order.service || 0 },
      { label: asText(ctx, 'ui.vat', 'VAT'), value: order.vat || 0 }
    ];

    return Comp.call('Panel', { class: 'pos-footer-bar' }, {
      body: [
        A.Div({ style: { display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' } }, {
          default: [
            A.Div({ style: { display: 'flex', gap: '14px', flexWrap: 'wrap' } }, {
              default: summary.map(item => A.Div({ style: { display: 'flex', flexDirection: 'column', minWidth: '120px' } }, {
                default: [
                  A.Span({ style: { fontSize: '12px', color: '#64748b' } }, { default: [item.label] }),
                  A.Span({ style: { fontWeight: 700, color: '#0f172a' } }, { default: [formatCurrency(state, env, item.value)] })
                ]
              }))
            }),
            A.Div({ style: { marginInlineStart: 'auto', display: 'flex', alignItems: 'center', gap: '12px' } }, {
              default: [
                A.Div({ style: { textAlign: 'right' } }, {
                  default: [
                    A.Span({ style: { fontSize: '12px', color: '#64748b' } }, { default: [asText(ctx, 'ui.total', 'Total')] }),
                    A.Div({ style: { fontWeight: 700, fontSize: '18px', color: '#1e293b' } }, { default: [formatCurrency(state, env, order.grand_total || 0)] })
                  ]
                }),
                Comp.call('Button', {
                  intent: 'primary',
                  size: 'lg',
                  text: asText(ctx, 'ui.settle_pay_print', 'Settle & Print'),
                  'data-onclick': 'finalizeOrder'
                })
              ]
            })
          ]
        })
      ]
    });
  };

  POSC.Modals = (state, ctx) => {
    const modal = state.ui?.modal || {};
    if (modal.active === 'numpad') {
      const line = toArr(state.order?.lines).find(l => l.id === modal.payload?.lineId);
      if (!line) return null;
      const buffer = modal.payload?.buffer ?? String(line.qty);
      return Comp.call('Modal', {
        open: true,
        size: 'sm',
        title: asText(ctx, 'ui.qty', 'Quantity'),
        onClose: () => ctx.dispatch('closeModal')
      }, {
        body: [
          A.Div({ style: { marginBottom: '12px', fontWeight: 600, fontSize: '14px' } }, { default: [line.title || `#${line.item_id}`] }),
          Comp.call('NumberPad', {
            value: buffer,
            uKey: 'pos-numpad',
            onChange: (val) => ctx.dispatch('numpadInput', val),
            onSubmit: (val) => ctx.dispatch('numpadConfirm', val),
            showSubmitButton: true,
            submitText: asText(ctx, 'ui.confirm', 'Confirm')
          })
        ]
      });
    }
    return null;
  };

  POSC.ToastStack = (state, ctx) => {
    const items = toArr(state.ui?.toasts).map(toast => ({
      id: toast.id,
      intent: toast.intent || 'neutral',
      title: toast.title,
      message: toast.message,
      dismissCommand: 'dismissToast'
    }));
    if (!items.length) return null;
    return Comp.call('ToastStack', {
      position: 'top-end',
      items
    });
  };

  POSC.HeaderRegion = POSC.Header;
  POSC.MenuRegion = POSC.MenuGrid;
  POSC.OrderRegion = POSC.OrderPanel;
  POSC.FooterRegion = POSC.FooterBar;
  POSC.ModalsRegion = POSC.Modals;
  POSC.ToastsRegion = POSC.ToastStack;

  window.POSC = POSC;
})(window);
