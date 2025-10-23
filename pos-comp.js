(function(global){
  global.MishkahPOSChunks = global.MishkahPOSChunks || {};
  global.MishkahPOSChunks.components = function(scope){
    if(!scope || typeof scope !== 'object') return;
    with(scope){
          function ThemeSwitch(db){
            const t = getTexts(db);
            return UI.Segmented({
              items:[
                { id:'light', label:`☀️ ${t.ui.light}`, attrs:{ gkey:'pos:theme:toggle', 'data-theme':'light' } },
                { id:'dark', label:`🌙 ${t.ui.dark}`, attrs:{ gkey:'pos:theme:toggle', 'data-theme':'dark' } }
              ],
              activeId: db.env.theme,
              attrs:{ class: tw`hidden xl:inline-flex` }
            });
          }
      
          function LangSwitch(db){
            const t = getTexts(db);
            return UI.Segmented({
              items:[
                { id:'ar', label:t.ui.arabic, attrs:{ gkey:'pos:lang:switch', 'data-lang':'ar' } },
                { id:'en', label:t.ui.english, attrs:{ gkey:'pos:lang:switch', 'data-lang':'en' } }
              ],
              activeId: db.env.lang
            });
          }
      
          function ShiftControls(db){
            const t = getTexts(db);
            const shiftState = db.data.shift || {};
            const current = shiftState.current;
            const historyCount = Array.isArray(shiftState.history) ? shiftState.history.length : 0;
            if(current){
              const summaryButton = UI.Button({
                attrs:{ gkey:'pos:shift:summary', class: tw`rounded-full`, title:`${t.ui.shift_current}: ${current.id}` },
                variant:'soft',
                size:'sm'
              }, [t.ui.shift_close_button]);
              const idBadge = UI.Badge({
                text: current.id,
                variant:'badge/ghost',
                attrs:{ class: tw`hidden sm:inline-flex text-xs` }
              });
              return UI.HStack({ attrs:{ class: tw`items-center gap-2` }}, [summaryButton, idBadge]);
            }
            const openButton = UI.Button({ attrs:{ gkey:'pos:shift:open', class: tw`rounded-full` }, variant:'solid', size:'sm' }, [t.ui.shift_open_button]);
            if(historyCount){
              const historyButton = UI.Button({
                attrs:{ gkey:'pos:shift:summary', class: tw`rounded-full`, title:t.ui.shift_history },
                variant:'ghost',
                size:'sm'
              }, [t.ui.shift_history]);
              return UI.HStack({ attrs:{ class: tw`items-center gap-2` }}, [openButton, historyButton]);
            }
            return openButton;
          }
      
          function Header(db){
            const t = getTexts(db);
            const user = db.data.user;
            const orderType = getOrderTypeConfig(db.data.order.type);
            return UI.Toolbar({
              left:[
                D.Text.Span({ attrs:{ class: tw`text-2xl font-black tracking-tight` }}, ['Mishkah POS']),
                UI.Badge({ text:`${orderType.icon} ${localize(orderType.label, db.env.lang)}`, variant:'badge/ghost', attrs:{ class: tw`text-sm` } })
              ],
              right:[
                UI.Button({ attrs:{ gkey:'pos:settings:open', title:t.ui.settings_center }, variant:'ghost', size:'md' }, [D.Text.Span({ attrs:{ class: tw`text-xl sm:text-2xl` }}, ['⚙️'])]),
                ShiftControls(db),
                ThemeSwitch(db),
                LangSwitch(db),
                UI.Button({ attrs:{ gkey:'pos:tables:open', title:t.ui.tables }, variant:'ghost', size:'md' }, [D.Text.Span({ attrs:{ class: tw`text-xl sm:text-2xl` }}, ['🪑'])]),
                UI.Button({ attrs:{ gkey:'pos:reservations:open', title:t.ui.reservations }, variant:'ghost', size:'md' }, [D.Text.Span({ attrs:{ class: tw`text-xl sm:text-2xl` }}, ['📅'])]),
                UI.Button({ attrs:{ gkey:'pos:orders:open', title:t.ui.orders_queue }, variant:'ghost', size:'md' }, [D.Text.Span({ attrs:{ class: tw`text-xl sm:text-2xl` }}, ['🧾'])]),
                UI.Badge({ text:`${t.ui.cashier}: ${user.name}`, leading:'👤', variant:'badge/ghost' }),
                UI.Button({ attrs:{ gkey:'pos:session:logout', title:'Logout' }, variant:'ghost', size:'md' }, [D.Text.Span({ attrs:{ class: tw`text-xl sm:text-2xl` }}, ['🚪'])])
              ]
            });
          }
      
          function MenuItemCard(db, item){
            const lang = db.env.lang;
            const menu = db.data.menu;
            const isFav = (menu.favorites || []).includes(String(item.id));
            return D.Containers.Div({
              attrs:{
                class: tw`relative flex flex-col gap-2 rounded-3xl border border-[var(--border)] bg-[var(--surface-1)] p-3 text-[var(--foreground)] transition hover:border-[var(--primary)] focus-within:ring-2 focus-within:ring-[var(--primary)]`,
                gkey:'pos:menu:add',
                'data-item-id': item.id,
                role:'button',
                tabindex:'0'
              }
            }, [
              UI.Button({
                attrs:{
                  gkey:'pos:menu:favorite',
                  'data-item-id': item.id,
                  class: tw`absolute top-2 ${db.env.dir === 'rtl' ? 'left-2' : 'right-2'} rounded-full`
                },
                variant: isFav ? 'solid' : 'ghost',
                size:'sm'
              }, [isFav ? '★' : '☆']),
              D.Containers.Div({ attrs:{ class: tw`h-24 overflow-hidden rounded-2xl bg-[var(--surface-2)]` }}, [
                item.image
                  ? D.Media.Img({ attrs:{ src:item.image, alt:localize(item.name, lang), class: tw`h-full w-full object-cover scale-[1.05]` }})
                  : D.Containers.Div({ attrs:{ class: tw`grid h-full place-items-center text-3xl` }}, ['🍽️'])
              ]),
              D.Containers.Div({ attrs:{ class: tw`space-y-1` }}, [
                D.Text.Strong({ attrs:{ class: tw`text-sm font-semibold leading-tight` }}, [localize(item.name, lang)]),
                localize(item.description, lang)
                  ? D.Text.P({ attrs:{ class: tw`text-xs ${token('muted')} line-clamp-2` }}, [localize(item.description, lang)])
                  : null
              ].filter(Boolean)),
              D.Containers.Div({ attrs:{ class: tw`mt-auto flex items-center justify-between text-sm` }}, [
                UI.PriceText({ amount:item.price, currency:getCurrency(db), locale:getLocale(db) }),
                D.Text.Span({ attrs:{ class: tw`text-xl font-semibold text-[var(--primary)]` }}, ['+'])
              ])
            ]);
          }
      
          function LoadingSpinner(extraAttrs){
            const extraClass = extraAttrs && extraAttrs.class ? extraAttrs.class : '';
            const attrs = Object.assign({}, extraAttrs || {});
            attrs.class = tw`${extraClass} h-3 w-3 animate-spin rounded-full border-2 border-[color-mix(in_oklab,var(--primary)75%,transparent)] border-t-transparent`;
            attrs['aria-hidden'] = attrs['aria-hidden'] || 'true';
            return D.Containers.Div({ attrs });
          }
      
          function MenuSkeletonGrid(count){
            const total = Number.isFinite(count) && count > 0 ? count : 8;
            const cards = Array.from({ length: total }).map((_, idx)=> D.Containers.Div({
              attrs:{
                key:`menu-skeleton-${idx}`,
                class: tw`flex animate-pulse flex-col gap-2 rounded-3xl border border-dashed border-[color-mix(in_oklab,var(--border)70%,transparent)] bg-[color-mix(in_oklab,var(--surface-1)94%,transparent)] p-3`
              }
            }, [
              D.Containers.Div({ attrs:{ class: tw`h-24 w-full rounded-2xl bg-[color-mix(in_oklab,var(--surface-2)90%,transparent)]` } }),
              D.Containers.Div({ attrs:{ class: tw`space-y-2` } }, [
                D.Containers.Div({ attrs:{ class: tw`h-3 w-3/4 rounded-full bg-[color-mix(in_oklab,var(--surface-2)88%,transparent)]` } }),
                D.Containers.Div({ attrs:{ class: tw`h-3 w-full rounded-full bg-[color-mix(in_oklab,var(--surface-2)82%,transparent)]` } })
              ]),
              D.Containers.Div({ attrs:{ class: tw`mt-auto h-3 w-1/2 rounded-full bg-[color-mix(in_oklab,var(--surface-2)84%,transparent)]` } })
            ]));
            return D.Containers.Div({ attrs:{ class: tw`grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3` } }, cards);
          }
      
          function MenuColumn(db){
            const t = getTexts(db);
            const lang = db.env.lang;
            const menu = db.data.menu;
            const remote = db.data.remotes?.posDatabase || {};
            const remoteStatus = remote.status || 'idle';
            const isLoadingRemote = remoteStatus === 'loading';
            const hasRemoteError = remoteStatus === 'error';
            const remoteUpdatedAt = remote.finishedAt || null;
            const remoteErrorMessage = remote.error || null;
            const filtered = filterMenu(menu, lang);
            const categories = Array.isArray(menu.categories) ? menu.categories : [];
            const seenCategories = new Set();
            const chips = categories.reduce((acc, cat)=>{
              if(!cat || !cat.id || seenCategories.has(cat.id)) return acc;
              seenCategories.add(cat.id);
              acc.push({
                id: cat.id,
                label: localize(cat.label, lang),
                attrs:{ gkey:'pos:menu:category', 'data-category-id':cat.id }
              });
              return acc;
            }, []).sort((a,b)=> (a.id==='all' ? -1 : b.id==='all' ? 1 : 0));
            const remoteStatusText = isLoadingRemote
              ? t.ui.menu_loading_hint
              : hasRemoteError
                ? (remoteErrorMessage ? `${t.ui.menu_load_error}: ${remoteErrorMessage}` : t.ui.menu_load_error)
                : remoteUpdatedAt
                  ? `${t.ui.menu_last_updated}: ${formatSync(remoteUpdatedAt, lang) || '—'}`
                  : t.ui.menu_load_success;
            const lastSyncLabel = `${t.ui.last_sync}: ${formatSync(db.data.status.indexeddb.lastSync, lang) || t.ui.never_synced}`;
            return D.Containers.Section({ attrs:{ class: tw`flex h-full min-h-0 w-full flex-col gap-3 overflow-hidden` }}, [
              UI.Card({
                variant:'card/soft-1',
                content: D.Containers.Div({ attrs:{ class: tw`flex flex-col gap-3` }}, [
                  UI.SearchBar({
                    value: menu.search,
                    placeholder: t.ui.search,
                    onInput:'pos:menu:search',
                    trailing:[
                      UI.Button({
                        attrs:{
                          gkey:'pos:menu:favorites-only',
                          class: tw`rounded-full ${menu.showFavoritesOnly ? 'bg-[var(--primary)] text-white' : ''}`
                        },
                        variant: menu.showFavoritesOnly ? 'solid' : 'ghost',
                        size:'sm'
                      }, ['⭐'])
                    ]
                  }),
                  UI.ChipGroup({ items: chips, activeId: menu.category })
                ])
              }),
              D.Containers.Section({ attrs:{ class: tw`${token('scroll-panel')} flex-1 min-h-0 w-full overflow-hidden` }}, [
                D.Containers.Div({ attrs:{ class: tw`${token('scroll-panel/head')} flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between` }}, [
                  D.Containers.Div({ attrs:{ class: tw`flex items-center gap-2` }}, [
                    D.Text.Strong({}, [t.ui.categories]),
                    isLoadingRemote ? LoadingSpinner({ title: t.ui.menu_loading }) : null,
                    hasRemoteError ? UI.Badge({ variant:'badge/status', attrs:{ class: tw`${token('status/offline')} text-xs` } }, [`⚠️ ${t.ui.menu_load_error_short}`]) : null
                  ].filter(Boolean)),
                  D.Containers.Div({ attrs:{ class: tw`flex items-center gap-2` }}, [
                    UI.Button({ attrs:{ gkey:'pos:menu:load-more' }, variant:'ghost', size:'sm' }, [t.ui.load_more])
                  ])
                ]),
                UI.ScrollArea({
                  attrs:{ class: tw`${token('scroll-panel/body')} h-full w-full px-3 pb-3`, 'data-menu-scroll':'true' },
                  children:[
                    isLoadingRemote
                      ? MenuSkeletonGrid(8)
                      : filtered.length
                        ? D.Containers.Div({ attrs:{ class: tw`grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3` }}, filtered.map(item=> MenuItemCard(db, item)))
                        : UI.EmptyState({ icon:'🍽️', title:t.ui.cart_empty, description:t.ui.choose_items })
                  ]
                }),
                D.Containers.Div({ attrs:{ class: tw`${token('scroll-panel/footer')} flex flex-wrap items-center justify-between gap-3` }}, [
                  D.Containers.Div({ attrs:{ class: tw`flex flex-wrap items-center gap-2` }}, [
                    statusBadge(db, remoteStatus === 'ready' ? 'online' : hasRemoteError ? 'offline' : 'idle', t.ui.menu_live_badge),
                    statusBadge(db, db.data.status.central?.state || 'offline', t.ui.central_sync, {
                      attrs:{ gkey:'pos:central:diagnostics', class: tw`cursor-pointer` }
                    }),
                    statusBadge(db, db.data.status.indexeddb.state, t.ui.indexeddb)
                  ].filter(Boolean)),
                  D.Containers.Div({ attrs:{ class: tw`flex flex-wrap items-center gap-3` }}, [
                    D.Containers.Div({ attrs:{ class: tw`text-xs ${token('muted')} flex flex-col sm:flex-row sm:items-center sm:gap-3` }}, [
                      D.Text.Span({}, [remoteStatusText]),
                      D.Text.Span({}, [lastSyncLabel])
                    ]),
                    UI.Button({ attrs:{ gkey:'pos:indexeddb:sync' }, variant:'ghost', size:'sm' }, [t.ui.sync_now])
                  ])
                ])
              ])
            ]);
          }
      
          function OrderLine(db, line){
            const t = getTexts(db);
            const lang = db.env.lang;
            const modifiers = Array.isArray(line.modifiers) ? line.modifiers : [];
            const notes = notesToText(line.notes);
            const discountInfo = normalizeDiscount(line.discount);
            const discountLabel = discountInfo
              ? (discountInfo.type === 'percent'
                  ? `${discountInfo.value}%`
                  : `− ${formatCurrencyValue(db, discountInfo.value)}`)
              : '';
            const discountRow = discountInfo
              ? D.Text.Span({ attrs:{ class: tw`text-[10px] sm:text-xs ${token('muted')}` }}, [`${t.ui.discount_action}: ${discountLabel}`])
              : null;
            const modifiersRow = modifiers.length
              ? D.Containers.Div({ attrs:{ class: tw`flex flex-wrap gap-2 text-[10px] sm:text-xs text-[var(--muted-foreground)]` }}, modifiers.map(mod=>{
                  const delta = Number(mod.priceChange || mod.price_change || 0) || 0;
                  const priceLabel = delta ? `${delta > 0 ? '+' : '−'} ${formatCurrencyValue(db, Math.abs(delta))}` : '';
                  return D.Containers.Div({ attrs:{ class: tw`rounded-full bg-[color-mix(in oklab,var(--surface-2) 92%, transparent)] px-2 py-1` }}, [
                    `${localize(mod.label, lang)}${priceLabel ? ` (${priceLabel})` : ''}`
                  ]);
                }))
              : null;
            const notesRow = notes
              ? D.Text.Span({ attrs:{ class: tw`text-[10px] sm:text-xs ${token('muted')}` }}, ['📝 ', notes])
              : null;
            return UI.ListItem({
              leading: D.Text.Span({ attrs:{ class: tw`text-lg` }}, ['🍲']),
              content:[
                D.Text.Strong({}, [localize(line.name, lang)]),
                modifiersRow,
                notesRow,
                discountRow
              ].filter(Boolean),
              trailing:[
                UI.QtyStepper({ value: line.qty, gkeyDec:'pos:order:line:dec', gkeyInc:'pos:order:line:inc', gkeyEdit:'pos:order:line:qty', dataId: line.id }),
                UI.PriceText({ amount: line.total, currency:getCurrency(db), locale:getLocale(db) }),
                UI.Button({
                  attrs:{
                    gkey:'pos:order:line:modifiers',
                    'data-line-id':line.id,
                    title: t.ui.line_modifiers
                  },
                  variant:'ghost',
                  size:'sm'
                }, [D.Text.Span({ attrs:{ class: tw`text-lg` }}, ['➕/➖'])]),
                UI.Button({
                  attrs:{
                    gkey:'pos:order:line:note',
                    'data-line-id':line.id,
                    title: t.ui.notes
                  },
                  variant:'ghost',
                  size:'sm'
                }, [D.Text.Span({ attrs:{ class: tw`text-lg` }}, ['📝'])]),
                UI.Button({
                  attrs:{
                    gkey:'pos:order:line:discount',
                    'data-line-id':line.id,
                    title: t.ui.discount_action
                  },
                  variant:'ghost',
                  size:'sm'
                }, [D.Text.Span({ attrs:{ class: tw`text-lg` }}, ['٪'])])
              ]
            });
          }
      
          function TotalsSection(db){
            const t = getTexts(db);
            const totals = db.data.order.totals || {};
            const paymentsEntries = getActivePaymentEntries(db.data.order, db.data.payments);
            const paymentSnapshot = summarizePayments(totals, paymentsEntries);
            const totalPaid = paymentSnapshot.paid;
            const remaining = paymentSnapshot.remaining;
            const rows = [
              { label:t.ui.subtotal, value: totals.subtotal },
              { label:t.ui.service, value: totals.service },
              { label:t.ui.vat, value: totals.vat },
              totals.deliveryFee ? { label:t.ui.delivery_fee, value: totals.deliveryFee } : null,
              totals.discount ? { label:t.ui.discount, value: totals.discount } : null
            ].filter(Boolean);
            const summaryRows = [
              paymentsEntries.length ? UI.HStack({ attrs:{ class: tw`${token('split')} text-sm` }}, [
                D.Text.Span({}, [t.ui.paid]),
                UI.PriceText({ amount: totalPaid, currency:getCurrency(db), locale:getLocale(db) })
              ]) : null,
              UI.HStack({ attrs:{ class: tw`${token('split')} text-sm font-semibold ${remaining > 0 ? 'text-[var(--accent-foreground)]' : ''}` }}, [
                D.Text.Span({}, [t.ui.balance_due]),
                UI.PriceText({ amount: remaining, currency:getCurrency(db), locale:getLocale(db) })
              ])
            ].filter(Boolean);
            return D.Containers.Div({ attrs:{ class: tw`space-y-2` }}, [
              ...rows.map(row=> UI.HStack({ attrs:{ class: tw`${token('split')} text-sm` }}, [
                D.Text.Span({ attrs:{ class: tw`${token('muted')}` }}, [row.label]),
                UI.PriceText({ amount:row.value, currency:getCurrency(db), locale:getLocale(db) })
              ])),
              UI.Divider(),
              UI.HStack({ attrs:{ class: tw`${token('split')} text-lg font-semibold` }}, [
                D.Text.Span({}, [t.ui.total]),
                UI.PriceText({ amount:totals.due, currency:getCurrency(db), locale:getLocale(db) })
              ]),
              ...summaryRows
            ]);
          }
      
          function CartFooter(db){
            const t = getTexts(db);
            return D.Containers.Div({ attrs:{ class: tw`shrink-0 border-t border-[var(--border)] bg-[color-mix(in oklab,var(--surface-1) 90%, transparent)] px-4 py-3 rounded-[var(--radius)] shadow-[var(--shadow)] flex flex-col gap-3` }}, [
              TotalsSection(db),
              UI.HStack({ attrs:{ class: tw`gap-2` }}, [
                UI.Button({ attrs:{ gkey:'pos:order:discount', class: tw`flex-1` }, variant:'ghost', size:'sm' }, [t.ui.discount_action]),
                UI.Button({ attrs:{ gkey:'pos:order:note', class: tw`flex-1` }, variant:'ghost', size:'sm' }, [t.ui.notes])
              ])
            ]);
          }
      
          function computeTableRuntime(db){
            const tables = db.data.tables || [];
            const locks = (db.data.tableLocks || []).filter(lock=> lock.active !== false);
            const reservations = db.data.reservations || [];
            const currentOrderId = db.data.order?.id;
            return tables.map(table=>{
              const activeLocks = locks.filter(lock=> lock.tableId === table.id);
              const orderLocks = activeLocks.filter(lock=> lock.orderId);
              const reservationLocks = activeLocks.filter(lock=> lock.reservationId);
              const lockState = table.state !== 'active'
                ? table.state
                : activeLocks.length === 0
                  ? 'free'
                  : activeLocks.length === 1
                    ? 'single'
                    : 'multi';
              const reservationRefs = reservationLocks.map(lock=> reservations.find(res=> res.id === lock.reservationId)).filter(Boolean);
              return {
                ...table,
                lockState,
                activeLocks,
                orderLocks,
                reservationLocks,
                reservationRefs,
                isCurrentOrder: orderLocks.some(lock=> lock.orderId === currentOrderId)
              };
            });
          }
      
          function computeGuestsForTables(tableIds, tables){
            if(!Array.isArray(tableIds) || !tableIds.length) return 0;
            const lookup = new Map((tables || []).map(table=> [String(table.id), table]));
            return tableIds.reduce((sum, id)=>{
              const table = lookup.get(String(id));
              const capacity = Number(table?.capacity);
              return Number.isFinite(capacity) ? sum + Math.max(0, capacity) : sum;
            }, 0);
          }
      
          function getDisplayOrderId(order, t){
            if(!order || !order.id){
              return t?.ui?.order_id_pending || '—';
            }
            const id = String(order.id);
            if(id.startsWith('draft-')){
              return t?.ui?.order_id_pending || '—';
            }
            return id;
          }
      
          function tableStateLabel(t, runtime){
            if(runtime.state === 'disactive') return t.ui.tables_state_disactive;
            if(runtime.state === 'maintenance') return t.ui.tables_state_maintenance;
            if(runtime.lockState === 'free') return t.ui.tables_state_free;
            if(runtime.lockState === 'single') return t.ui.tables_state_single;
            if(runtime.lockState === 'multi') return t.ui.tables_state_multi;
            return t.ui.tables_state_active;
          }
      
          function tablePalette(runtime){
            if(runtime.state === 'disactive') return 'border-zinc-700 bg-zinc-800/40 text-zinc-400';
            if(runtime.state === 'maintenance') return 'border-amber-500/40 bg-amber-500/10 text-amber-400';
            if(runtime.lockState === 'free') return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400';
            if(runtime.lockState === 'single') return 'border-sky-500/40 bg-sky-500/10 text-sky-400';
            if(runtime.lockState === 'multi') return 'border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-400';
            return 'border-[var(--border)] bg-[var(--surface-1)]';
          }
      
          function PaymentSummary(db){
            const t = getTexts(db);
            const split = getActivePaymentEntries(db.data.order, db.data.payments);
            const methods = (db.data.payments?.methods && db.data.payments.methods.length)
              ? db.data.payments.methods
              : PAYMENT_METHODS;
            const totals = db.data.order.totals || {};
            const snapshot = summarizePayments(totals, split);
            const totalPaid = snapshot.paid;
            const remaining = snapshot.remaining;
            const change = Math.max(0, round(snapshot.paid - snapshot.due));
            const paymentStateId = db.data.order?.paymentState || 'unpaid';
            const paymentState = db.data.orderPaymentStates?.find(state=> state.id === paymentStateId);
            const paymentStateLabel = paymentState ? localize(paymentState.name, db.env.lang) : paymentStateId;
            const balanceSummary = remaining > 0 || change > 0
              ? D.Containers.Div({ attrs:{ class: tw`space-y-2 rounded-[var(--radius)] bg-[color-mix(in oklab,var(--surface-2) 92%, transparent)] px-3 py-2 text-sm` }}, [
                  remaining > 0 ? UI.HStack({ attrs:{ class: tw`${token('split')} font-semibold text-[var(--accent-foreground)]` }}, [
                    D.Text.Span({}, [t.ui.balance_due]),
                    UI.PriceText({ amount: remaining, currency:getCurrency(db), locale:getLocale(db) })
                  ]) : null,
                  change > 0 ? UI.HStack({ attrs:{ class: tw`${token('split')} text-[var(--muted-foreground)]` }}, [
                    D.Text.Span({}, [t.ui.exchange_due]),
                    UI.PriceText({ amount: change, currency:getCurrency(db), locale:getLocale(db) })
                  ]) : null
                ].filter(Boolean))
              : null;
            return UI.Card({
              variant:'card/soft-1',
              title: t.ui.split_payments,
              content: D.Containers.Div({ attrs:{ class: tw`space-y-2` }}, [
                UI.Badge({ text: paymentStateLabel, variant:'badge/ghost' }),
                balanceSummary,
                ...split.map(entry=>{
                  const method = methods.find(m=> m.id === entry.method);
                  const label = method ? `${method.icon} ${localize(method.label, db.env.lang)}` : entry.method;
                  return UI.HStack({ attrs:{ class: tw`${token('split')} text-sm` }}, [
                    D.Text.Span({}, [label]),
                    UI.PriceText({ amount: entry.amount, currency:getCurrency(db), locale:getLocale(db) })
                  ]);
                }),
                split.length ? UI.Divider() : null,
                UI.HStack({ attrs:{ class: tw`${token('split')} text-sm font-semibold` }}, [
                  D.Text.Span({}, [t.ui.paid]),
                  UI.PriceText({ amount: totalPaid, currency:getCurrency(db), locale:getLocale(db) })
                ]),
                UI.Button({ attrs:{ gkey:'pos:payments:open', class: tw`w-full flex items-center justify-center gap-2` }, variant:'soft', size:'sm' }, [
                  D.Text.Span({ attrs:{ class: tw`text-lg` }}, ['💳']),
                  D.Text.Span({ attrs:{ class: tw`text-sm font-semibold` }}, [t.ui.open_payments])
                ])
              ].filter(Boolean))
            });
          }
      
          function OrderNavigator(db){
            const t = getTexts(db);
            const history = Array.isArray(db.data.ordersHistory) ? db.data.ordersHistory : [];
            if(!history.length) return UI.Card({ variant:'card/soft-1', content: UI.EmptyState({ icon:'🧾', title:t.ui.order_nav_label, description:t.ui.order_nav_no_history }) });
            const currentId = db.data.order?.id;
            const currentIndex = history.findIndex(entry=> entry.id === currentId);
            const total = history.length;
            const currentSeq = currentIndex >= 0 ? (history[currentIndex].seq || currentIndex + 1) : null;
            const label = currentSeq ? `#${currentSeq} / ${total}` : `— / ${total}`;
            const disablePrev = currentIndex <= 0;
            const disableNext = currentIndex < 0 || currentIndex >= total - 1;
            const quickActions = UI.HStack({ attrs:{ class: tw`items-center justify-between gap-3` }}, [
              D.Text.Strong({ attrs:{ class: tw`text-sm` }}, [t.ui.order_nav_label]),
              D.Text.Span({ attrs:{ class: tw`text-xs text-[var(--muted-foreground)]` }}, [`${t.ui.order_nav_total}: ${total}`])
            ]);
            const navigatorRow = UI.HStack({ attrs:{ class: tw`flex-wrap items-center justify-between gap-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-1)] px-4 py-3 text-sm` }}, [
              UI.Button({ attrs:{ gkey:'pos:order:new', title:t.ui.new_order, class: tw`h-12 w-12 rounded-full text-xl` }, variant:'soft', size:'md' }, ['🆕']),
              UI.Button({ attrs:{ gkey:'pos:order:nav:prev', disabled:disablePrev, class: tw`h-12 w-12 rounded-full text-lg` }, variant:'soft', size:'md' }, ['⬅️']),
              D.Text.Span({ attrs:{ class: tw`text-base font-semibold` }}, [label]),
              UI.Button({ attrs:{ gkey:'pos:order:nav:pad', class: tw`h-12 w-12 rounded-full text-lg` }, variant:'soft', size:'md' },['🔢']),
              UI.Button({ attrs:{ gkey:'pos:order:nav:next', disabled:disableNext, class: tw`h-12 w-12 rounded-full text-lg` }, variant:'soft', size:'md' }, ['➡️']),
              UI.Button({ attrs:{ gkey:'pos:order:clear', title:t.ui.clear, class: tw`h-12 w-12 rounded-full text-xl` }, variant:'ghost', size:'md' }, ['🧹'])
            ]);
            const padVisible = !!db.ui.orderNav?.showPad;
            const padValue = db.ui.orderNav?.value || '';
            const pad = padVisible
              ? UI.Card({
                  variant:'card/soft-2',
                  title: t.ui.order_nav_open,
                  content: D.Containers.Div({ attrs:{ class: tw`space-y-3` }}, [
                    UI.NumpadDecimal({
                      value: padValue,
                      placeholder: t.ui.order_nav_placeholder,
                      gkey:'pos:order:nav:input',
                      allowDecimal:false,
                      confirmLabel:t.ui.order_nav_open,
                      confirmAttrs:{ gkey:'pos:order:nav:confirm', variant:'solid', size:'sm', class: tw`w-full` }
                    }),
                    UI.Button({ attrs:{ gkey:'pos:order:nav:close', class: tw`w-full` }, variant:'ghost', size:'sm' }, [t.ui.close])
                  ])
                })
              : null;
            return D.Containers.Div({ attrs:{ class: tw`space-y-3` }}, [quickActions, navigatorRow, pad].filter(Boolean));
          }
      
          function OrderCustomerPanel(db){
            const t = getTexts(db);
            const order = db.data.order || {};
            const customers = db.data.customers || [];
            const customer = findCustomer(customers, order.customerId);
            const address = customer ? findCustomerAddress(customer, order.customerAddressId) : null;
            const phone = (order.customerPhone || (customer?.phones?.[0] || '')).trim();
            const areaLabel = address ? getDistrictLabel(address.areaId, db.env.lang) : (order.customerAreaId ? getDistrictLabel(order.customerAreaId, db.env.lang) : '');
            const summaryParts = [];
            if(address?.title) summaryParts.push(address.title);
            if(areaLabel) summaryParts.push(areaLabel);
            if(address?.line) summaryParts.push(address.line);
            const summary = summaryParts.join(' • ');
            const requiresAddress = order.type === 'delivery';
            const missing = requiresAddress && (!customer || !address);
            const nameLabel = order.customerName || customer?.name || t.ui.customer_new;
            return D.Containers.Div({ attrs:{ class: tw`flex flex-col gap-2 rounded-[var(--radius)] border border-[var(--border)] bg-[color-mix(in oklab,var(--surface-1) 92%, transparent)] p-3` }}, [
              D.Containers.Div({ attrs:{ class: tw`flex items-center justify-between gap-2` }}, [
                D.Text.Strong({ attrs:{ class: tw`text-sm` }}, [nameLabel]),
                UI.Button({ attrs:{ gkey:'pos:customer:open', class: tw`h-9 rounded-full px-3 text-sm` }, variant:'soft', size:'sm' }, ['👤 ', t.ui.customer_attach])
              ]),
              phone ? D.Text.Span({ attrs:{ class: tw`text-xs ${token('muted')}` }}, [`📞 ${phone}`]) : null,
              summary ? D.Text.Span({ attrs:{ class: tw`text-xs ${token('muted')}` }}, [`📍 ${summary}`]) : null,
              missing ? UI.Badge({ text:t.ui.customer_required_delivery, variant:'badge' }) : null
            ].filter(Boolean));
          }
      
          function OrderColumn(db){
            const t = getTexts(db);
            const order = db.data.order;
            const orderNumberLabel = getDisplayOrderId(order, t);
            const assignedTables = (order.tableIds || []).map(tableId=>{
              const table = (db.data.tables || []).find(tbl=> tbl.id === tableId);
              return { id: tableId, name: table?.name || tableId };
            });
            const serviceSegments = ORDER_TYPES.map(type=>({
              id: type.id,
              label: `${type.icon} ${localize(type.label, db.env.lang)}`,
              attrs:{ gkey:'pos:order:type', 'data-order-type':type.id }
            }));
            return D.Containers.Section({ attrs:{ class: tw`flex h-full min-h-0 w-full flex-col overflow-hidden` }}, [
              UI.ScrollArea({
                attrs:{ class: tw`flex-1 min-h-0 w-full` },
                children:[
                  D.Containers.Div({ attrs:{ class: tw`flex flex-col gap-3 pe-1 pb-4` }}, [
                    UI.Card({
                      variant:'card/soft-1',
                      content: D.Containers.Div({ attrs:{ class: tw`flex h-full min-h-0 flex-col gap-3` }}, [
                        UI.Segmented({ items: serviceSegments, activeId: order.type }),
                        D.Containers.Div({ attrs:{ class: tw`flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm ${token('muted')}` }}, [
                          D.Text.Span({}, [`${t.ui.order_id} ${orderNumberLabel}`]),
                          order.type === 'dine_in'
                            ? D.Containers.Div({ attrs:{ class: tw`flex flex-1 flex-wrap items-center gap-2` }}, [
                                assignedTables.length
                                  ? D.Containers.Div({ attrs:{ class: tw`flex flex-wrap gap-2` }}, assignedTables.map(table=>
                                      UI.Button({
                                        attrs:{
                                          gkey:'pos:order:table:remove',
                                          'data-table-id':table.id,
                                          class: tw`h-8 rounded-full bg-[var(--accent)] px-3 text-xs sm:text-sm flex items-center gap-2`
                                        },
                                        variant:'ghost',
                                        size:'sm'
                                      }, [`🪑 ${table.name}`, '✕'])
                                    ))
                                  : D.Text.Span({ attrs:{ class: tw`${token('muted')}` }}, [t.ui.select_table]),
                                UI.Button({ attrs:{ gkey:'pos:tables:open', class: tw`h-8 w-8 rounded-full border border-dashed border-[var(--border)]` }, variant:'ghost', size:'sm' }, ['＋'])
                              ])
                            : D.Text.Span({}, [localize(getOrderTypeConfig(order.type).label, db.env.lang)]),
                          order.type === 'dine_in' && (order.guests || 0) > 0
                            ? D.Text.Span({}, [`${t.ui.guests}: ${order.guests}`])
                            : null
                        ]),
                        D.Containers.Div({ attrs:{ class: tw`flex-1 min-h-0 w-full` }}, [
                          UI.ScrollArea({
                            attrs:{ class: tw`h-full min-h-0 w-full flex-1` },
                            children:[
                              order.lines && order.lines.length
                                ? UI.List({ children: order.lines.map(line=> OrderLine(db, line)) })
                                : UI.EmptyState({ icon:'🧺', title:t.ui.cart_empty, description:t.ui.choose_items })
                            ]
                          })
                        ]),
                        CartFooter(db)
                      ])
                    }),
                    PaymentSummary(db),
                    OrderCustomerPanel(db),
                    OrderNavigator(db)
                  ])
                ]
              })
            ]);
          }
      
          function FooterBar(db){
            const t = getTexts(db);
            const reports = computeRealtimeReports(db);
            const salesToday = new Intl.NumberFormat(getLocale(db)).format(reports.salesToday || 0);
            const currencyLabel = getCurrencySymbol(db);
            const order = db.data.order || {};
            const orderType = order.type || 'dine_in';
            const isTakeaway = orderType === 'takeaway';
            const isDelivery = orderType === 'delivery';
            const isFinalized = order.status === 'finalized' || order.status === 'closed';
            const deliveredStage = order.fulfillmentStage === 'delivered' || order.fulfillmentStage === 'closed';
            const canShowSave = !isFinalized && (!isDelivery || !deliveredStage) && (!isTakeaway || !deliveredStage);
            const canShowFinish = !isFinalized && (!isDelivery || !deliveredStage);
            const finishMode = isTakeaway ? 'finalize-print' : 'finalize';
            const finishLabel = isTakeaway ? t.ui.finish_and_print : t.ui.finish_order;
            const showPrintButton = !isTakeaway || isFinalized;
            const saveLabel = t.ui.save_order;
            const isSavingOrder = !!db.ui?.orderSaving;
            const reportsSummary = D.Containers.Div({ attrs:{ class: tw`flex flex-col items-end gap-1 text-xs text-[var(--muted-foreground)]` }}, [
              D.Text.Span({ attrs:{ class: tw`text-sm font-semibold text-[var(--foreground)]` }}, [`${t.ui.sales_today}: ${salesToday} ${currencyLabel}`]),
              D.Containers.Div({ attrs:{ class: tw`flex items-center gap-2` }}, [
                D.Text.Span({}, [`${t.ui.orders_count}: ${reports.ordersCount || 0}`]),
                UI.Button({ attrs:{ gkey:'pos:reports:toggle' }, variant:'ghost', size:'sm' }, [t.ui.open_reports])
              ])
            ]);
            const primaryActions = [];
            primaryActions.push(UI.Button({ attrs:{ gkey:'pos:order:new', class: tw`min-w-[120px] flex items-center justify-center gap-2` }, variant:'ghost', size:'md' }, [
              D.Text.Span({ attrs:{ class: tw`text-lg` }}, ['🆕']),
              D.Text.Span({ attrs:{ class: tw`text-sm font-semibold` }}, [t.ui.new_order])
            ]));
            if(canShowSave){
              const saveButton = UI.Button({
                attrs:{
                  gkey:'pos:order:save',
                  'data-save-mode':'draft',
                  class: tw`min-w-[160px] flex items-center justify-center gap-2`,
                  disabled: isSavingOrder || undefined,
                  'data-loading': isSavingOrder ? 'true' : undefined
                },
                variant:'solid',
                size:'md'
              }, [
                isSavingOrder ? LoadingSpinner({ title: t.ui.saving }) : null,
                D.Text.Span({ attrs:{ class: tw`text-sm font-semibold` }}, [isSavingOrder ? t.ui.saving : saveLabel])
              ].filter(Boolean));
              primaryActions.push(saveButton);
            }
            if(canShowFinish){
              primaryActions.push(UI.Button({
                attrs:{
                  gkey:'pos:order:save',
                  'data-save-mode':finishMode,
                  class: tw`min-w-[180px] flex items-center justify-center gap-2`,
                  disabled: isSavingOrder || undefined,
                  'data-loading': isSavingOrder ? 'true' : undefined
                },
                variant:'solid',
                size:'md'
              }, [
                isSavingOrder ? LoadingSpinner({ title: t.ui.saving }) : null,
                D.Text.Span({ attrs:{ class: tw`text-sm font-semibold` }}, [isSavingOrder ? t.ui.saving : finishLabel])
              ].filter(Boolean)));
            }
            if(showPrintButton){
              primaryActions.push(UI.Button({ attrs:{ gkey:'pos:order:print', class: tw`min-w-[150px] flex items-center justify-center gap-2` }, variant:'soft', size:'md' }, [
                D.Text.Span({ attrs:{ class: tw`text-lg` }}, ['🖨️']),
                D.Text.Span({ attrs:{ class: tw`text-sm font-semibold` }}, [t.ui.print])
              ]));
            }
            return UI.Footerbar({
              left:[
                statusBadge(db, db.data.status.kds.state, t.ui.kds),
                statusBadge(db, db.data.status.central?.state || 'offline', t.ui.central_sync, {
                  attrs:{ gkey:'pos:central:diagnostics', class: tw`cursor-pointer` }
                }),
                statusBadge(db, db.data.status.indexeddb.state, t.ui.indexeddb)
              ],
              right:[
                reportsSummary,
                ...primaryActions
              ]
            });
          }
      
          function TablesModal(db){
            const t = getTexts(db);
            if(!db.ui.modals.tables) return null;
            const runtimeTables = computeTableRuntime(db);
            const tablesUI = db.ui.tables || {};
            const view = tablesUI.view || 'assign';
            const filter = tablesUI.filter || 'all';
            const searchTerm = (tablesUI.search || '').trim().toLowerCase();
      
            const counts = runtimeTables.reduce((acc, table)=>{
              acc.all += table.state === 'disactive' ? 0 : 1;
              if(table.state === 'maintenance') acc.maintenance += 1;
              if(table.state === 'active'){
                if(table.lockState === 'free') acc.free += 1;
                if(table.lockState === 'single') acc.single += 1;
                if(table.lockState === 'multi') acc.multi += 1;
              }
              return acc;
            }, { all:0, free:0, single:0, multi:0, maintenance:0 });
      
            const filterItems = [
              { id:'all', label:`${t.ui.tables_filter_all} (${counts.all})` },
              { id:'free', label:`${t.ui.tables_filter_free} (${counts.free})` },
              { id:'single', label:`${t.ui.tables_filter_single} (${counts.single})` },
              { id:'multi', label:`${t.ui.tables_filter_multi} (${counts.multi})` },
              { id:'maintenance', label:`${t.ui.tables_filter_maintenance} (${counts.maintenance})` }
            ].map(item=> ({
              ...item,
              attrs:{ gkey:'pos:tables:filter', 'data-tables-filter':item.id }
            }));
      
            function createTableCard(runtime){
              const palette = tablePalette(runtime);
              const stateLabel = tableStateLabel(t, runtime);
              const ordersCount = runtime.orderLocks.length;
              const reservationsCount = runtime.reservationRefs.length;
              const chips = [];
              if(ordersCount){ chips.push(UI.Badge({ text:`${ordersCount} ${t.ui.tables_orders_badge}`, variant:'badge/ghost' })); }
              if(reservationsCount){ chips.push(UI.Badge({ text:`${reservationsCount} ${t.ui.tables_reservations_badge}`, variant:'badge/ghost' })); }
              if(runtime.isCurrentOrder){ chips.push(UI.Badge({ text:t.ui.table_locked, variant:'badge' })); }
              return D.Containers.Div({
                attrs:{
                  class: tw`group relative flex min-h-[160px] flex-col justify-between gap-3 rounded-3xl border-2 p-4 transition hover:shadow-[var(--shadow)] ${palette}`,
                  gkey:'pos:tables:card:tap',
                  'data-table-id': runtime.id
                }
              }, [
                D.Containers.Div({ attrs:{ class: tw`flex items-start justify-between gap-2` }}, [
                  D.Containers.Div({ attrs:{ class: tw`space-y-1.5` }}, [
                    D.Text.Strong({ attrs:{ class: tw`text-xl font-semibold` }}, [runtime.name || runtime.id]),
                    D.Text.Span({ attrs:{ class: tw`text-sm opacity-70` }}, [`${t.ui.tables_zone}: ${runtime.zone || '—'}`]),
                    D.Text.Span({ attrs:{ class: tw`text-sm opacity-70` }}, [`${t.ui.tables_capacity}: ${runtime.capacity}`]),
                    D.Text.Span({ attrs:{ class: tw`text-sm font-semibold` }}, [stateLabel])
                  ]),
                  D.Containers.Div({ attrs:{ class: tw`flex flex-col items-end gap-2` }}, [
                    chips.length ? D.Containers.Div({ attrs:{ class: tw`flex flex-wrap justify-end gap-1` }}, chips) : null,
                    UI.Button({ attrs:{ gkey:'pos:tables:details', 'data-table-id':runtime.id, class: tw`rounded-full` }, variant:'ghost', size:'sm' }, ['⋯'])
                  ].filter(Boolean))
                ]),
                runtime.note
                  ? D.Text.Span({ attrs:{ class: tw`text-sm opacity-75` }}, [`📝 ${runtime.note}`])
                  : D.Text.Span({ attrs:{ class: tw`text-sm opacity-60` }}, [t.ui.tables_longpress_hint])
              ]);
            }
      
            function createDetailsPanel(){
              if(!tablesUI.details) return null;
              const runtime = runtimeTables.find(tbl=> tbl.id === tablesUI.details);
              if(!runtime) return null;
              const orderMap = new Map();
              orderMap.set(db.data.order.id, { ...db.data.order });
              (db.data.ordersQueue || []).forEach(ord=> orderMap.set(ord.id, ord));
              const lang = db.env.lang;
              const ordersList = runtime.orderLocks.length
                ? UI.List({
                    children: runtime.orderLocks.map(lock=>{
                      const order = orderMap.get(lock.orderId) || { id: lock.orderId, status:'open' };
                      const orderLabel = getDisplayOrderId(order, t);
                      return UI.ListItem({
                        leading: D.Text.Span({ attrs:{ class: tw`text-xl` }}, ['🧾']),
                        content:[
                          D.Text.Strong({}, [`${t.ui.order_id} ${orderLabel}`]),
                          D.Text.Span({ attrs:{ class: tw`text-xs ${token('muted')}` }}, [formatDateTime(order.updatedAt || lock.lockedAt, lang, { hour:'2-digit', minute:'2-digit' })])
                        ],
                        trailing:[
                          UI.Button({ attrs:{ gkey:'pos:tables:unlock-order', 'data-table-id':runtime.id, 'data-order-id':order.id }, variant:'ghost', size:'sm' }, ['🔓'])
                        ]
                      });
                    })
                  })
                : UI.EmptyState({ icon:'🧾', title:t.ui.table_no_sessions, description:t.ui.table_manage_hint });
      
              const reservationsList = runtime.reservationRefs.length
                ? UI.List({
                    children: runtime.reservationRefs.map(res=> UI.ListItem({
                      leading: D.Text.Span({ attrs:{ class: tw`text-xl` }}, ['📅']),
                      content:[
                        D.Text.Strong({}, [res.customerName || res.id]),
                        D.Text.Span({ attrs:{ class: tw`text-xs ${token('muted')}` }}, [`${formatDateTime(res.scheduledAt, lang, { hour:'2-digit', minute:'2-digit' })} • ${res.partySize} ${t.ui.guests}`])
                      ],
                      trailing:[
                        UI.Badge({ text: localize(t.ui[`reservations_status_${res.status}`] || res.status, lang === 'ar' ? 'ar' : 'en'), variant:'badge/ghost' })
                      ]
                    }))
                  })
                : null;
      
              return UI.Card({
                title: `${t.ui.tables_details} — ${runtime.name || runtime.id}`,
                description: t.ui.tables_actions,
                content: D.Containers.Div({ attrs:{ class: tw`space-y-3` }}, [
                  D.Containers.Div({ attrs:{ class: tw`flex flex-wrap gap-3 text-sm ${token('muted')}` }}, [
                    D.Text.Span({}, [`${t.ui.tables_zone}: ${runtime.zone || '—'}`]),
                    D.Text.Span({}, [`${t.ui.tables_capacity}: ${runtime.capacity}`]),
                    D.Text.Span({}, [tableStateLabel(t, runtime)])
                  ]),
                  ordersList,
                  reservationsList,
                  UI.HStack({ attrs:{ class: tw`justify-end gap-2` }}, [
                    UI.Button({ attrs:{ gkey:'pos:tables:unlock-all', 'data-table-id':runtime.id }, variant:'ghost', size:'sm' }, [t.ui.tables_unlock_all]),
                    UI.Button({ attrs:{ gkey:'pos:tables:details-close' }, variant:'ghost', size:'sm' }, [t.ui.close])
                  ])
                ])
              });
            }
      
            const assignables = runtimeTables
              .filter(table=> table.state !== 'disactive')
              .filter(table=>{
                if(!searchTerm) return true;
                const term = searchTerm.toLowerCase();
                return (table.name || '').toLowerCase().includes(term) || (table.id || '').toLowerCase().includes(term) || (table.zone || '').toLowerCase().includes(term);
              })
              .filter(table=>{
                if(filter === 'free') return table.state === 'active' && table.lockState === 'free';
                if(filter === 'single') return table.lockState === 'single';
                if(filter === 'multi') return table.lockState === 'multi';
                if(filter === 'maintenance') return table.state === 'maintenance';
                return true;
              });
      
            const assignView = D.Containers.Div({ attrs:{ class: tw`space-y-4` }}, [
              UI.SearchBar({
                value: tablesUI.search || '',
                placeholder: t.ui.tables_search_placeholder,
                onInput:'pos:tables:search'
              }),
              UI.ChipGroup({ items: filterItems, activeId: filter }),
              D.Containers.Div({ attrs:{ class: tw`flex flex-wrap gap-2 text-xs ${token('muted')}` }}, [
                D.Text.Span({}, [`${t.ui.tables_count_label}: ${assignables.length}`])
              ]),
              assignables.length
                ? D.Containers.Div({ attrs:{ class: tw`grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3` }}, assignables.map(createTableCard))
                : UI.EmptyState({ icon:'🪑', title:t.ui.table_no_sessions, description:t.ui.table_manage_hint }),
              createDetailsPanel()
            ].filter(Boolean));
      
            const manageRows = runtimeTables
              .slice()
              .sort((a,b)=> (a.displayOrder||0) - (b.displayOrder||0))
              .map(table=> UI.ListItem({
                leading: D.Text.Span({ attrs:{ class: tw`text-lg` }}, ['🪑']),
                content:[
                  D.Text.Strong({}, [table.name || table.id]),
                  D.Text.Span({ attrs:{ class: tw`text-xs ${token('muted')}` }}, [`${t.ui.tables_zone}: ${table.zone || '—'}`]),
                  D.Text.Span({ attrs:{ class: tw`text-xs ${token('muted')}` }}, [`${t.ui.tables_capacity}: ${table.capacity}`]),
                  D.Text.Span({ attrs:{ class: tw`text-xs ${token('muted')}` }}, [tableStateLabel(t, table)])
                ],
                trailing:[
                  UI.Button({ attrs:{ gkey:'pos:tables:rename', 'data-table-id':table.id, 'data-prevent-select':'true' }, variant:'ghost', size:'sm' }, ['✏️']),
                  UI.Button({ attrs:{ gkey:'pos:tables:capacity', 'data-table-id':table.id, 'data-prevent-select':'true' }, variant:'ghost', size:'sm' }, ['👥']),
                  UI.Button({ attrs:{ gkey:'pos:tables:zone', 'data-table-id':table.id, 'data-prevent-select':'true' }, variant:'ghost', size:'sm' }, ['📍']),
                  UI.Button({ attrs:{ gkey:'pos:tables:state', 'data-table-id':table.id, 'data-prevent-select':'true' }, variant:'ghost', size:'sm' }, ['♻️']),
                  UI.Button({ attrs:{ gkey:'pos:tables:remove', 'data-table-id':table.id, 'data-prevent-select':'true' }, variant:'ghost', size:'sm' }, ['🗑️'])
                ],
                attrs:{ class: tw`cursor-default` }
              }));
      
            const auditEntries = (db.data.auditTrail || []).slice().sort((a,b)=> b.at - a.at).slice(0,6).map(entry=>
              UI.ListItem({
                leading: D.Text.Span({ attrs:{ class: tw`text-lg` }}, ['📝']),
                content:[
                  D.Text.Strong({}, [`${entry.action} → ${entry.refId}`]),
                  D.Text.Span({ attrs:{ class: tw`text-xs ${token('muted')}` }}, [formatDateTime(entry.at, db.env.lang, { hour:'2-digit', minute:'2-digit', day:'2-digit', month:'short' })])
                ],
                trailing:[ D.Text.Span({ attrs:{ class: tw`text-xs ${token('muted')}` }}, [entry.userId]) ]
              })
            );
      
            const manageView = D.Containers.Div({ attrs:{ class: tw`space-y-4` }}, [
              UI.HStack({ attrs:{ class: tw`justify-between` }}, [
                UI.Button({ attrs:{ gkey:'pos:tables:add' }, variant:'solid', size:'sm' }, [`＋ ${t.ui.table_add}`]),
                D.Containers.Div({ attrs:{ class: tw`flex gap-2` }}, [
                  UI.Button({ attrs:{ gkey:'pos:tables:bulk', 'data-bulk-action':'activate' }, variant:'ghost', size:'sm' }, [t.ui.tables_bulk_activate]),
                  UI.Button({ attrs:{ gkey:'pos:tables:bulk', 'data-bulk-action':'maintenance' }, variant:'ghost', size:'sm' }, [t.ui.tables_bulk_maintenance])
                ])
              ]),
              UI.ScrollArea({ attrs:{ class: tw`max-h-[40vh] space-y-2` }, children: manageRows }),
              auditEntries.length ? UI.Card({ title:t.ui.tables_manage_log, content: UI.List({ children:auditEntries }) }) : null
            ].filter(Boolean));
      
            const viewSelector = UI.Segmented({
              items:[
                { id:'assign', label:t.ui.tables_assign, attrs:{ gkey:'pos:tables:view', 'data-tables-view':'assign' } },
                { id:'manage', label:t.ui.tables_manage, attrs:{ gkey:'pos:tables:view', 'data-tables-view':'manage' } }
              ],
              activeId:view
            });
      
            return UI.Modal({
              open:true,
              size: db.ui?.modalSizes?.tables || 'full',
              sizeKey:'tables',
              title:t.ui.tables,
              description: view === 'assign' ? t.ui.table_manage_hint : t.ui.tables_manage,
              content: D.Containers.Div({ attrs:{ class: tw`space-y-4` }}, [
                viewSelector,
                view === 'assign' ? assignView : manageView
              ]),
              actions:[
                UI.Button({ attrs:{ gkey:'ui:modal:close', class: tw`w-full` }, variant:'ghost', size:'sm' }, [t.ui.close])
              ]
            });
          }
      
          function PrintModal(db){
            const t = getTexts(db);
            if(!db.ui.modals.print) return null;
            const order = db.data.order || {};
            const uiPrint = db.ui.print || {};
            const docType = uiPrint.docType || db.data.print?.docType || 'customer';
            const profiles = db.data.print?.profiles || {};
            const profile = profiles[docType] || {};
            const selectedSize = uiPrint.size || profile.size || db.data.print?.size || 'thermal_80';
            const showAdvanced = !!uiPrint.showAdvanced;
            const managePrinters = !!uiPrint.managePrinters;
            const previewExpanded = !!uiPrint.previewExpanded;
            const newPrinterName = uiPrint.newPrinterName || '';
            const tablesNames = (order.tableIds || []).map(id=>{
              const table = (db.data.tables || []).find(tbl=> tbl.id === id);
              return table?.name || id;
            });
            const lang = db.env.lang;
            const due = order.totals?.due || 0;
            const subtotal = order.totals?.subtotal || 0;
            const payments = db.data.payments.split || [];
            const totalPaid = payments.reduce((sum, entry)=> sum + (Number(entry.amount)||0), 0);
            const changeDue = Math.max(0, round(totalPaid - due));
            const totalsRows = [
              { label:t.ui.subtotal, value: subtotal },
              order.totals?.service ? { label:t.ui.service, value: order.totals.service } : null,
              { label:t.ui.vat, value: order.totals?.vat || 0 },
              order.totals?.deliveryFee ? { label:t.ui.delivery_fee, value: order.totals.deliveryFee } : null,
              order.totals?.discount ? { label:t.ui.discount, value: order.totals.discount } : null
            ].filter(Boolean);
      
            const docTypes = [
              { id:'customer', label:t.ui.print_doc_customer },
              { id:'summary', label:t.ui.print_doc_summary },
              { id:'kitchen', label:t.ui.print_doc_kitchen }
            ];
      
            const sizeOptions = [
              { id:'thermal_80', label:t.ui.thermal_80 },
              { id:'receipt_15', label:t.ui.receipt_15 },
              { id:'a5', label:t.ui.a5 },
              { id:'a4', label:t.ui.a4 }
            ];
      
            const sizePresets = {
              thermal_80:{ container:'max-w-[360px] px-5 py-6 text-[13px]', expandedContainer:'max-w-[460px] px-6 py-7 text-[13px]', heading:'text-xl', meta:'text-xs', body:'text-[13px]', total:'text-[15px]', frame:'border border-sky-200' },
              receipt_15:{ container:'max-w-[440px] px-6 py-6 text-[13px]', expandedContainer:'max-w-[600px] px-8 py-8 text-[14px]', heading:'text-2xl', meta:'text-sm', body:'text-[14px]', total:'text-[16px]', frame:'border border-dashed border-sky-200' },
              a5:{ container:'max-w-[640px] px-8 py-7 text-[15px]', expandedContainer:'max-w-[860px] px-10 py-9 text-[15px]', heading:'text-2xl', meta:'text-base', body:'text-[15px]', total:'text-[18px]', frame:'border border-neutral-200' },
              a4:{ container:'max-w-[760px] px-10 py-8 text-[16px]', expandedContainer:'max-w-[940px] px-12 py-10 text-[16px]', heading:'text-3xl', meta:'text-lg', body:'text-[16px]', total:'text-[20px]', frame:'border border-neutral-200' }
            };
      
            const previewPreset = sizePresets[selectedSize] || sizePresets.thermal_80;
      
            const previewLineClass = tw`${previewPreset.body} leading-6`;
            const previewLines = (order.lines || []).map(line=>{
              const modifiers = Array.isArray(line.modifiers) ? line.modifiers : [];
              const modifierRows = modifiers.map(mod=>{
                const delta = Number(mod.priceChange || 0) || 0;
                const priceLabel = delta ? `${delta > 0 ? '+' : '−'} ${formatCurrencyValue(db, Math.abs(delta))}` : t.ui.line_modifiers_free;
                return UI.HStack({ attrs:{ class: tw`justify-between ps-6 text-xs text-neutral-500` }}, [
                  D.Text.Span({}, [localize(mod.label, lang)]),
                  D.Text.Span({}, [priceLabel])
                ]);
              });
            const notes = notesToText(line.notes);
              const notesRow = notes
                ? D.Text.Span({ attrs:{ class: tw`block ps-6 text-[11px] text-neutral-400` }}, [`📝 ${notes}`])
                : null;
              return D.Containers.Div({ attrs:{ class: previewLineClass }}, [
                UI.HStack({ attrs:{ class: tw`justify-between` }}, [
                  D.Text.Span({}, [`${localize(line.name, lang)} × ${line.qty}`]),
                  UI.PriceText({ amount: line.total, currency:getCurrency(db), locale:getLocale(db) })
                ]),
                ...modifierRows,
                notesRow
              ].filter(Boolean));
            });
      
            const currentDocLabel = docTypes.find(dt=> dt.id === docType)?.label || t.ui.print_doc_customer;
            const paymentsList = payments.length
              ? D.Containers.Div({ attrs:{ class: tw`space-y-1 ${previewPreset.body} pt-2` }}, payments.map(pay=>{
                  const method = (db.data.payments.methods || []).find(m=> m.id === pay.method);
                  const label = method ? `${method.icon} ${localize(method.label, lang)}` : pay.method;
                  return D.Containers.Div({ attrs:{ class: tw`flex items-center justify-between` }}, [
                    D.Text.Span({}, [label]),
                    UI.PriceText({ amount: pay.amount, currency:getCurrency(db), locale:getLocale(db) })
                  ]);
                }))
              : null;
      
            const previewContainerBase = previewExpanded ? (previewPreset.expandedContainer || previewPreset.container) : previewPreset.container;
            const previewContainerClass = tw`mx-auto w-full ${previewContainerBase} ${previewPreset.frame || 'border border-neutral-200'} rounded-3xl bg-white text-neutral-900 shadow-[0_24px_60px_rgba(15,23,42,0.16)] dark:bg-white dark:text-neutral-900 ${previewExpanded ? 'max-w-none' : ''}`;
            const previewHeadingClass = tw`${previewPreset.heading} font-semibold tracking-wide`;
            const previewMetaClass = tw`${previewPreset.meta} text-neutral-500`;
            const previewDetailsClass = tw`space-y-1 ${previewPreset.body} leading-6`;
            const previewTotalsClass = tw`space-y-2 ${previewPreset.body}`;
            const previewTotalsRowClass = tw`flex items-center justify-between ${previewPreset.body}`;
            const previewTotalsTotalClass = tw`flex items-center justify-between ${previewPreset.total} font-semibold`;
            const previewFooterClass = tw`mt-6 space-y-1 text-center ${previewPreset.meta} text-neutral-500`;
      
            const previewOrderId = getDisplayOrderId(order, t);
            const previewReceipt = D.Containers.Div({ attrs:{ class: previewContainerClass, 'data-print-preview':'receipt' }}, [
              D.Containers.Div({ attrs:{ class: tw`space-y-1 text-center` }}, [
                D.Text.Strong({ attrs:{ class: previewHeadingClass }}, ['Mishkah Restaurant']),
                D.Text.Span({ attrs:{ class: previewMetaClass }}, [`${t.ui.print_header_address}: 12 Nile Street`]),
                D.Text.Span({ attrs:{ class: previewMetaClass }}, [`${t.ui.print_header_phone}: 0100000000`])
              ]),
              D.Containers.Div({ attrs:{ class: tw`mt-4 h-px bg-neutral-200` }}),
              D.Containers.Div({ attrs:{ class: previewDetailsClass }}, [
                D.Text.Span({}, [`${t.ui.order_id} ${previewOrderId}`]),
                (order.type === 'dine_in' && (order.guests || 0) > 0) ? D.Text.Span({}, [`${t.ui.guests}: ${order.guests}`]) : null,
                tablesNames.length ? D.Text.Span({}, [`${t.ui.tables}: ${tablesNames.join(', ')}`]) : null,
                D.Text.Span({}, [formatDateTime(order.updatedAt || Date.now(), lang, { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })])
              ].filter(Boolean)),
              D.Containers.Div({ attrs:{ class: tw`mt-4 h-px bg-neutral-200` }}),
              previewLines.length
                ? D.Containers.Div({ attrs:{ class: tw`space-y-2` }}, previewLines)
                : D.Text.Span({ attrs:{ class: tw`block text-center ${previewPreset.body} text-neutral-400` }}, [t.ui.cart_empty]),
              D.Containers.Div({ attrs:{ class: tw`mt-4 h-px bg-neutral-200` }}),
              D.Containers.Div({ attrs:{ class: previewTotalsClass }}, [
                ...totalsRows.map(row=> D.Containers.Div({ attrs:{ class: previewTotalsRowClass }}, [
                  D.Text.Span({}, [row.label]),
                  UI.PriceText({ amount: row.value, currency:getCurrency(db), locale:getLocale(db) })
                ])),
                D.Containers.Div({ attrs:{ class: previewTotalsTotalClass }}, [
                  D.Text.Span({}, [t.ui.total]),
                  UI.PriceText({ amount: due, currency:getCurrency(db), locale:getLocale(db) })
                ]),
                payments.length ? D.Containers.Div({ attrs:{ class: previewTotalsRowClass }}, [
                  D.Text.Span({}, [t.ui.paid]),
                  UI.PriceText({ amount: totalPaid, currency:getCurrency(db), locale:getLocale(db) })
                ]) : null,
                payments.length ? D.Containers.Div({ attrs:{ class: previewTotalsRowClass }}, [
                  D.Text.Span({}, [t.ui.print_change_due]),
                  UI.PriceText({ amount: changeDue, currency:getCurrency(db), locale:getLocale(db) })
                ]) : null,
                paymentsList
              ].filter(Boolean)),
              D.Containers.Div({ attrs:{ class: previewFooterClass }}, [
                D.Text.Span({}, [t.ui.print_footer_thanks]),
                D.Text.Span({}, [t.ui.print_footer_policy]),
                D.Text.Span({}, [`${t.ui.print_footer_feedback} • QR`])
              ])
            ]);
      
            const availablePrinters = Array.isArray(db.data.print?.availablePrinters) ? db.data.print.availablePrinters : [];
            const printerOptions = [
              { value:'', label:t.ui.print_printer_placeholder },
              ...availablePrinters.map(item=> ({ value:item.id, label:item.label || item.id }))
            ];
            const printerSelectField = (fieldKey, labelText, helperText, currentValue)=>
              UI.Field({
                label: labelText,
                helper: helperText,
                control: UI.Select({
                  attrs:{ value: currentValue || '', gkey:'pos:print:printer-select', 'data-print-field':fieldKey },
                  options: printerOptions
                })
              });
      
            const printerField = printerSelectField('defaultPrinter', t.ui.print_printer_default, t.ui.print_printer_select, profile.defaultPrinter);
      
            const manageControls = managePrinters
              ? UI.Card({
                  variant:'card/soft-2',
                  title: t.ui.print_manage_title,
                  description: t.ui.print_printers_manage_hint,
                  content: D.Containers.Div({ attrs:{ class: tw`space-y-3` }}, [
                    UI.HStack({ attrs:{ class: tw`gap-2` }}, [
                      UI.Input({ attrs:{ value: newPrinterName, placeholder: t.ui.print_manage_placeholder, gkey:'pos:print:manage-input' } }),
                      UI.Button({ attrs:{ gkey:'pos:print:manage-add', class: tw`whitespace-nowrap` }, variant:'solid', size:'sm' }, [t.ui.print_manage_add])
                    ]),
                    availablePrinters.length
                      ? UI.List({ children: availablePrinters.map(item=> UI.ListItem({
                          content: D.Text.Span({}, [item.label || item.id]),
                          trailing: UI.Button({ attrs:{ gkey:'pos:print:manage-remove', 'data-printer-id':item.id }, variant:'ghost', size:'sm' }, ['🗑️'])
                        })) })
                      : UI.EmptyState({ icon:'🖨️', title:t.ui.print_manage_empty, description:'' })
                  ])
                })
              : null;
      
            const advancedControls = showAdvanced
              ? D.Containers.Div({ attrs:{ class: tw`space-y-4 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-2)] p-4` }}, [
                  UI.Segmented({
                    items: sizeOptions.map(opt=>({ id: opt.id, label: opt.label, attrs:{ gkey:'pos:print:size', 'data-print-size':opt.id } })),
                    activeId: selectedSize
                  }),
                  printerSelectField('insidePrinter', t.ui.print_printer_inside, t.ui.print_printer_hint, profile.insidePrinter),
                  printerSelectField('outsidePrinter', t.ui.print_printer_outside, t.ui.print_printer_hint, profile.outsidePrinter),
                  UI.Field({
                    label: t.ui.print_copies,
                    control: UI.NumpadDecimal({
                      value: profile.copies || 1,
                      placeholder:'1',
                      gkey:'pos:print:profile-field',
                      inputAttrs:{ 'data-print-field':'copies' },
                      allowDecimal:false,
                      confirmLabel: t.ui.close,
                      confirmAttrs:{ variant:'soft', size:'sm' }
                    })
                  }),
                  UI.HStack({ attrs:{ class: tw`flex-wrap gap-2 text-xs` }}, [
                    UI.Button({ attrs:{ gkey:'pos:print:toggle', 'data-print-toggle':'autoSend', class: tw`${profile.autoSend ? 'bg-[var(--primary)] text-[var(--foreground)] dark:text-[var(--primary-foreground)]' : ''}` }, variant:'ghost', size:'sm' }, [profile.autoSend ? '✅ ' : '⬜︎ ', t.ui.print_auto_send]),
                    UI.Button({ attrs:{ gkey:'pos:print:toggle', 'data-print-toggle':'preview', class: tw`${profile.preview ? 'bg-[var(--primary)] text-[var(--foreground)] dark:text-[var(--primary-foreground)]' : ''}` }, variant:'ghost', size:'sm' }, [profile.preview ? '✅ ' : '⬜︎ ', t.ui.print_show_preview]),
                    UI.Button({ attrs:{ gkey:'pos:print:toggle', 'data-print-toggle':'duplicateInside', class: tw`${profile.duplicateInside ? 'bg-[var(--primary)] text-[var(--foreground)] dark:text-[var(--primary-foreground)]' : ''}` }, variant:'ghost', size:'sm' }, [profile.duplicateInside ? '✅ ' : '⬜︎ ', t.ui.print_duplicate_inside]),
                    UI.Button({ attrs:{ gkey:'pos:print:toggle', 'data-print-toggle':'duplicateOutside', class: tw`${profile.duplicateOutside ? 'bg-[var(--primary)] text-[var(--foreground)] dark:text-[var(--primary-foreground)]' : ''}` }, variant:'ghost', size:'sm' }, [profile.duplicateOutside ? '✅ ' : '⬜︎ ', t.ui.print_duplicate_outside])
                  ]),
                  D.Containers.Div({ attrs:{ class: tw`flex items-start gap-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-1)] px-4 py-3 text-xs` }}, [
                    D.Text.Span({ attrs:{ class: tw`text-lg` }}, ['ℹ️']),
                    D.Text.Span({ attrs:{ class: tw`leading-relaxed` }}, [t.ui.print_printers_info])
                  ])
                ])
              : null;
      
            const previewCardAttrs = previewExpanded ? { class: tw`w-full` } : {};
            const preview = UI.Card({
              variant:'card/soft-2',
              attrs: previewCardAttrs,
              title: `${t.ui.print_preview} — ${currentDocLabel}`,
              content: previewReceipt
            });
      
            const toggleRow = UI.HStack({ attrs:{ class: tw`flex-wrap gap-2` }}, [
              UI.Button({ attrs:{ gkey:'pos:print:advanced-toggle', class: tw`${showAdvanced ? 'bg-[var(--primary)] text-[var(--foreground)] dark:text-[var(--primary-foreground)]' : ''}` }, variant:'ghost', size:'sm' }, [showAdvanced ? `⬆️ ${t.ui.print_hide_advanced}` : `⚙️ ${t.ui.print_show_advanced}`]),
              UI.Button({ attrs:{ gkey:'pos:print:manage-toggle', class: tw`${managePrinters ? 'bg-[var(--primary)] text-[var(--foreground)] dark:text-[var(--primary-foreground)]' : ''}` }, variant:'ghost', size:'sm' }, [managePrinters ? `⬆️ ${t.ui.print_manage_hide}` : `🖨️ ${t.ui.print_manage_printers}`]),
              UI.Button({ attrs:{ gkey:'pos:print:preview-expand', class: tw`${previewExpanded ? 'bg-[var(--primary)] text-[var(--foreground)] dark:text-[var(--primary-foreground)]' : ''}` }, variant:'ghost', size:'sm' }, [previewExpanded ? `🗕 ${t.ui.print_preview_collapse}` : `🗗 ${t.ui.print_preview_expand}`])
            ]);
      
            const modalContent = D.Containers.Div({ attrs:{ class: tw`space-y-4` }}, [
              UI.Segmented({
                items: docTypes.map(dt=>({ id: dt.id, label: dt.label, attrs:{ gkey:'pos:print:doc', 'data-doc-type':dt.id } })),
                activeId: docType
              }),
              printerField,
              toggleRow,
              manageControls,
              advancedControls,
              preview
            ].filter(Boolean));
      
            return UI.Modal({
              open:true,
              size: db.ui?.modalSizes?.print || 'xl',
              sizeKey:'print',
              title: t.ui.print,
              description: t.ui.print_profile,
              content: modalContent,
              actions:[
                UI.Button({ attrs:{ gkey:'pos:print:send', class: tw`w-full` }, variant:'solid', size:'sm' }, [t.ui.print_send]),
                UI.Button({ attrs:{ gkey:'pos:print:browser', class: tw`w-full` }, variant:'ghost', size:'sm' }, [t.ui.print_browser_preview]),
                UI.Button({ attrs:{ gkey:'pos:order:export', class: tw`w-full` }, variant:'ghost', size:'sm' }, [t.ui.export_pdf]),
                UI.Button({ attrs:{ gkey:'pos:print:save', class: tw`w-full` }, variant:'soft', size:'sm' }, [t.ui.print_save_profile]),
                UI.Button({ attrs:{ gkey:'ui:modal:close', class: tw`w-full` }, variant:'ghost', size:'sm' }, [t.ui.close])
              ]
            });
          }
      
          function ReservationsModal(db){
            const t = getTexts(db);
            if(!db.ui.modals.reservations) return null;
            const reservations = db.data.reservations || [];
            const tables = db.data.tables || [];
            const uiState = db.ui.reservations || {};
            const statusFilter = uiState.status || 'all';
            const rangeFilter = uiState.filter || 'today';
            const formState = uiState.form || null;
            const lang = db.env.lang;
            const now = new Date();
            const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
            const endOfToday = startOfToday + 24 * 60 * 60 * 1000;
      
            function inRange(res){
              if(rangeFilter === 'today') return res.scheduledAt >= startOfToday && res.scheduledAt < endOfToday;
              if(rangeFilter === 'upcoming') return res.scheduledAt >= endOfToday;
              if(rangeFilter === 'past') return res.scheduledAt < startOfToday;
              return true;
            }
      
            const filtered = reservations
              .filter(res=> statusFilter === 'all' ? true : res.status === statusFilter)
              .filter(inRange)
              .sort((a,b)=> a.scheduledAt - b.scheduledAt);
      
            const rangeItems = [
              { id:'today', label:t.ui.reservations_manage },
              { id:'upcoming', label:'⏭️' },
              { id:'all', label:t.ui.reservations_filter_all }
            ].map(item=>({ ...item, attrs:{ gkey:'pos:reservations:range', 'data-reservation-range':item.id } }));
      
            const statusItems = [
              { id:'all', label:t.ui.reservations_filter_all },
              { id:'booked', label:t.ui.reservations_filter_booked },
              { id:'seated', label:t.ui.reservations_filter_seated },
              { id:'completed', label:t.ui.reservations_filter_completed },
              { id:'cancelled', label:t.ui.reservations_filter_cancelled },
              { id:'no-show', label:t.ui.reservations_filter_noshow }
            ].map(item=>({ ...item, attrs:{ gkey:'pos:reservations:status', 'data-reservation-status':item.id } }));
      
            const formTables = tables.filter(tbl=> tbl.state === 'active');
            const selectedTables = new Set(Array.isArray(formState?.tableIds) ? formState.tableIds : []);
      
            const formCard = formState ? UI.Card({
              title: formState.id ? t.ui.reservations_edit : t.ui.reservations_new,
              content: D.Containers.Div({ attrs:{ class: tw`space-y-3` }}, [
                UI.Field({ label:t.ui.reservations_customer, control: UI.Input({ attrs:{ value: formState.customerName || '', gkey:'pos:reservations:form', 'data-field':'customerName', placeholder:t.ui.reservations_customer } }) }),
                UI.Field({ label:t.ui.reservations_phone, control: UI.Input({ attrs:{ value: formState.phone || '', gkey:'pos:reservations:form', 'data-field':'phone', placeholder:'010...' } }) }),
                UI.Field({
                  label:t.ui.reservations_party_size,
                  control: UI.NumpadDecimal({
                    value: formState.partySize || 2,
                    placeholder:'0',
                    gkey:'pos:reservations:form',
                    inputAttrs:{ 'data-field':'partySize' },
                    allowDecimal:false,
                    confirmLabel: t.ui.close,
                    confirmAttrs:{ variant:'soft', size:'sm' }
                  })
                }),
                UI.Field({ label:t.ui.reservations_time, control: UI.Input({ attrs:{ type:'datetime-local', value: toInputDateTime(formState.scheduledAt), gkey:'pos:reservations:form', 'data-field':'scheduledAt' } }) }),
                UI.Field({ label:t.ui.reservations_hold_until, control: UI.Input({ attrs:{ type:'datetime-local', value: toInputDateTime(formState.holdUntil), gkey:'pos:reservations:form', 'data-field':'holdUntil' } }) }),
                D.Containers.Div({ attrs:{ class: tw`space-y-2` }}, [
                  D.Text.Span({ attrs:{ class: tw`text-sm font-medium` }}, [t.ui.reservations_tables]),
                  D.Containers.Div({ attrs:{ class: tw`flex flex-wrap gap-2` }}, formTables.map(tbl=> UI.Button({
                    attrs:{
                      gkey:'pos:reservations:form:table',
                      'data-table-id':tbl.id,
                      class: tw`rounded-full px-3 py-1 text-sm ${selectedTables.has(tbl.id) ? 'bg-[var(--primary)] text-[var(--foreground)] dark:text-[var(--primary-foreground)]' : 'bg-[var(--surface-2)]'}`
                    },
                    variant:'ghost',
                    size:'sm'
                  }, [`🪑 ${tbl.name}`])) )
                ]),
                UI.Field({ label:t.ui.reservations_note, control: UI.Textarea({ attrs:{ value: formState.note || '', rows:'2', gkey:'pos:reservations:form', 'data-field':'note' } }) })
              ]),
              footer: UI.HStack({ attrs:{ class: tw`gap-2` }}, [
                UI.Button({ attrs:{ gkey:'pos:reservations:save', class: tw`flex-1` }, variant:'solid', size:'sm' }, [t.ui.reservations_save]),
                UI.Button({ attrs:{ gkey:'pos:reservations:cancel-edit', class: tw`flex-1` }, variant:'ghost', size:'sm' }, [t.ui.close])
              ])
            }) : null;
      
            const listCards = filtered.length ? filtered.map(res=>{
              const tableBadges = res.tableIds.map(id=>{
                const table = tables.find(tbl=> tbl.id === id);
                return UI.Badge({ text: table?.name || id, variant:'badge/ghost' });
              });
              return UI.Card({
                title: `${res.customerName} — ${res.partySize} ${t.ui.guests}`,
                description: `${formatDateTime(res.scheduledAt, lang, { hour:'2-digit', minute:'2-digit', day:'2-digit', month:'short' })} • ${res.phone || ''}`,
                content: D.Containers.Div({ attrs:{ class: tw`space-y-2 text-sm` }}, [
                  tableBadges.length ? D.Containers.Div({ attrs:{ class: tw`flex flex-wrap gap-1` }}, tableBadges) : null,
                  D.Text.Span({ attrs:{ class: tw`text-xs ${token('muted')}` }}, [`${t.ui.reservations_hold_label}: ${res.holdUntil ? formatDateTime(res.holdUntil, lang, { hour:'2-digit', minute:'2-digit' }) : '—'}`])
                ].filter(Boolean)),
                footer: UI.HStack({ attrs:{ class: tw`flex-wrap gap-2` }}, [
                  UI.Badge({ text: t.ui[`reservations_status_${res.status}`] || res.status, variant:'badge/ghost' }),
                  UI.Button({ attrs:{ gkey:'pos:reservations:edit', 'data-reservation-id':res.id }, variant:'ghost', size:'sm' }, ['✏️']),
                  UI.Button({ attrs:{ gkey:'pos:reservations:convert', 'data-reservation-id':res.id }, variant:'ghost', size:'sm' }, [t.ui.reservations_convert]),
                  UI.Button({ attrs:{ gkey:'pos:reservations:noshow', 'data-reservation-id':res.id }, variant:'ghost', size:'sm' }, [t.ui.reservations_no_show]),
                  UI.Button({ attrs:{ gkey:'pos:reservations:cancel', 'data-reservation-id':res.id }, variant:'ghost', size:'sm' }, [t.ui.reservations_cancel_action])
                ])
              });
            }) : [UI.EmptyState({ icon:'📅', title:t.ui.reservations, description:t.ui.reservations_list_empty })];
      
            return UI.Modal({
              open:true,
              size: db.ui?.modalSizes?.reservations || 'full',
              sizeKey:'reservations',
              title:t.ui.reservations,
              description:t.ui.reservations_manage,
              content: D.Containers.Div({ attrs:{ class: tw`space-y-4` }}, [
                UI.HStack({ attrs:{ class: tw`justify-between` }}, [
                  UI.Segmented({ items: rangeItems, activeId: rangeFilter }),
                  UI.Button({ attrs:{ gkey:'pos:reservations:new' }, variant:'solid', size:'sm' }, [`＋ ${t.ui.reservations_new}`])
                ]),
                UI.ChipGroup({ items: statusItems, activeId: statusFilter }),
                formCard,
                D.Containers.Div({ attrs:{ class: tw`space-y-3 max-h-[60vh] overflow-auto pr-1` }}, listCards)
              ].filter(Boolean)),
              actions:[
                UI.Button({ attrs:{ gkey:'ui:modal:close', class: tw`w-full` }, variant:'ghost', size:'sm' }, [t.ui.close])
              ]
            });
          }
      
          function OrdersQueueModal(db){
            const t = getTexts(db);
            if(!db.ui.modals.orders) return null;
            const tablesIndex = new Map((db.data.tables || []).map(tbl=> [tbl.id, tbl]));
            const ordersState = db.ui.orders || { tab:'all', search:'', sort:{ field:'updatedAt', direction:'desc' } };
            const activeTab = ordersState.tab || 'all';
            const searchTerm = (ordersState.search || '').trim().toLowerCase();
            const sortState = ordersState.sort || { field:'updatedAt', direction:'desc' };
            const mergedOrders = [];
            const seen = new Set();
            const isDraftOrder = (order)=>{
              if(!order) return false;
              const statusCandidates = [
                order.status,
                order.statusId,
                order.state,
                order.orderStatus,
                order.lifecycleStatus,
                order.lifecycle_state,
                order.header?.status,
                order.header?.status_id,
                order.header?.statusId,
                order.header?.order_status,
                order.header?.orderStatus,
                order.header?.state,
                order.header?.lifecycle_state,
                order.header?.lifecycleStatus
              ];
              if(statusCandidates.some(value=>{
                if(value == null) return false;
                const normalized = String(value).trim().toLowerCase();
                if(!normalized) return false;
                return normalized.includes('draft');
              })){
                return true;
              }
              const idSource = order.id || order.header?.id || '';
              const idNormalized = String(idSource).trim().toLowerCase();
              if(idNormalized.startsWith('draft')) return true;
              if(order.isDraft === true || order.header?.is_draft === true || order.header?.isDraft === true) return true;
              return false;
            };
            [db.data.order, ...(db.data.ordersQueue || [])].forEach(order=>{
              if(!order || !order.id || seen.has(order.id)) return;
              if(isDraftOrder(order)) return;
              seen.add(order.id);
              mergedOrders.push(order);
            });
      
            const matchesTab = (order)=>{
              if(activeTab === 'all') return true;
              const typeId = order.type || order.orderType || 'dine_in';
              return typeId === activeTab;
            };
      
            const matchesSearch = (order)=>{
              if(!searchTerm) return true;
              const typeLabel = localize(getOrderTypeConfig(order.type || 'dine_in').label, db.env.lang);
              const stageLabel = localize(orderStageMap.get(order.fulfillmentStage)?.name || { ar: order.fulfillmentStage, en: order.fulfillmentStage }, db.env.lang);
              const statusLabel = localize(orderStatusMap.get(order.status)?.name || { ar: order.status, en: order.status }, db.env.lang);
              const tableNames = (order.tableIds || []).map(id=> tablesIndex.get(id)?.name || id).join(' ');
              const paymentLabel = localize(orderPaymentMap.get(order.paymentState)?.name || { ar: order.paymentState || '', en: order.paymentState || '' }, db.env.lang);
              const haystack = [order.id, typeLabel, stageLabel, statusLabel, paymentLabel, tableNames].join(' ').toLowerCase();
              return haystack.includes(searchTerm);
            };
      
            const filtered = mergedOrders.filter(order=> matchesTab(order) && matchesSearch(order));
      
            const getSortValue = (order, field)=>{
              switch(field){
                case 'order': return order.id;
                case 'type': return order.type || 'dine_in';
                case 'stage': return order.fulfillmentStage || 'new';
                case 'status': return order.status || 'open';
                case 'payment': return order.paymentState || 'unpaid';
                case 'tables': return (order.tableIds || []).join(',');
                case 'guests': return order.guests || 0;
                case 'lines': return order.lines ? order.lines.length : 0;
                case 'notes': return order.notes ? order.notes.length : 0;
                case 'total': {
                  const totals = order.totals && typeof order.totals === 'object'
                    ? order.totals
                    : calculateTotals(order.lines || [], settings, order.type || 'dine_in', { orderDiscount: order.discount });
                  return Number(totals?.due || 0);
                }
                case 'updatedAt':
                default:
                  return order.updatedAt || order.createdAt || 0;
              }
            };
      
            const sorted = filtered.slice().sort((a,b)=>{
              const field = sortState.field || 'updatedAt';
              const direction = sortState.direction === 'asc' ? 1 : -1;
              const av = getSortValue(a, field);
              const bv = getSortValue(b, field);
              if(av == null && bv == null) return 0;
              if(av == null) return -1 * direction;
              if(bv == null) return 1 * direction;
              if(typeof av === 'number' && typeof bv === 'number'){
                if(av === bv) return 0;
                return av > bv ? direction : -direction;
              }
              const as = String(av).toLowerCase();
              const bs = String(bv).toLowerCase();
              if(as === bs) return 0;
              return as > bs ? direction : -direction;
            });
      
            const columns = [
              { id:'order', label:t.ui.order_id, sortable:true },
              { id:'type', label:t.ui.orders_type, sortable:true },
              { id:'stage', label:t.ui.orders_stage, sortable:true },
              { id:'status', label:t.ui.orders_status, sortable:true },
              { id:'payment', label:t.ui.orders_payment, sortable:true },
              { id:'tables', label:t.ui.tables, sortable:false },
              { id:'guests', label:t.ui.guests, sortable:true },
              { id:'lines', label:t.ui.orders_line_count, sortable:true },
              { id:'notes', label:t.ui.orders_notes, sortable:true },
              { id:'total', label:t.ui.orders_total, sortable:true },
              { id:'paid', label:t.ui.paid, sortable:false },
              { id:'remaining', label:t.ui.balance_due, sortable:false },
              { id:'updatedAt', label:t.ui.orders_updated, sortable:true },
              { id:'actions', label:'', sortable:false }
            ];
      
            const headerRow = D.Tables.Tr({}, columns.map(col=>{
              if(!col.sortable){
                return D.Tables.Th({ attrs:{ class: tw`px-3 py-2 text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]` }}, [col.label]);
              }
              const isActive = (sortState.field || 'updatedAt') === col.id;
              const icon = isActive ? (sortState.direction === 'asc' ? '↑' : '↓') : '↕';
              return D.Tables.Th({ attrs:{ class: tw`px-3 py-2 text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]` }}, [
                UI.Button({ attrs:{ gkey:'pos:orders:sort', 'data-sort-field':col.id, class: tw`flex items-center gap-1 text-xs` }, variant:'ghost', size:'sm' }, [col.label, D.Text.Span({ attrs:{ class: tw`text-[var(--muted-foreground)]` }}, [icon])])
              ]);
            }));
      
            const rows = sorted.map(order=>{
              const typeConfig = getOrderTypeConfig(order.type || 'dine_in');
              const stageMeta = orderStageMap.get(order.fulfillmentStage) || null;
              const statusMeta = orderStatusMap.get(order.status) || null;
              const paymentMeta = orderPaymentMap.get(order.paymentState) || null;
              const totals = order.totals && typeof order.totals === 'object'
                ? order.totals
                : calculateTotals(order.lines || [], settings, order.type || 'dine_in', { orderDiscount: order.discount });
              const totalDue = Number(totals?.due || 0);
              const paidAmount = round((Array.isArray(order.payments) ? order.payments : []).reduce((sum, entry)=> sum + (Number(entry.amount) || 0), 0));
              const remainingAmount = Math.max(0, round(totalDue - paidAmount));
              const tableNames = (order.tableIds || []).map(id=> tablesIndex.get(id)?.name || id).join(', ');
              const updatedStamp = order.updatedAt || order.createdAt;
              return D.Tables.Tr({ attrs:{ key:order.id, class: tw`bg-[var(--surface-1)]` }}, [
                D.Tables.Td({ attrs:{ class: tw`px-3 py-2 text-sm font-semibold` }}, [order.id]),
                D.Tables.Td({ attrs:{ class: tw`px-3 py-2 text-sm` }}, [localize(typeConfig.label, db.env.lang)]),
                D.Tables.Td({ attrs:{ class: tw`px-3 py-2 text-sm` }}, [UI.Badge({ text: localize(stageMeta?.name || { ar: order.fulfillmentStage, en: order.fulfillmentStage }, db.env.lang), variant:'badge/ghost' })]),
                D.Tables.Td({ attrs:{ class: tw`px-3 py-2 text-sm` }}, [UI.Badge({ text: localize(statusMeta?.name || { ar: order.status, en: order.status }, db.env.lang), variant:'badge/ghost' })]),
                D.Tables.Td({ attrs:{ class: tw`px-3 py-2 text-sm` }}, [localize(paymentMeta?.name || { ar: order.paymentState || '', en: order.paymentState || '' }, db.env.lang)]),
                D.Tables.Td({ attrs:{ class: tw`px-3 py-2 text-sm` }}, [tableNames || '—']),
                D.Tables.Td({ attrs:{ class: tw`px-3 py-2 text-sm text-center` }}, [order.type === 'dine_in' && (order.guests || 0) > 0 ? String(order.guests) : '—']),
                D.Tables.Td({ attrs:{ class: tw`px-3 py-2 text-sm text-center` }}, [String(order.lines ? order.lines.length : 0)]),
                D.Tables.Td({ attrs:{ class: tw`px-3 py-2 text-sm text-center` }}, [String(order.notes ? order.notes.length : 0)]),
                D.Tables.Td({ attrs:{ class: tw`px-3 py-2 text-sm` }}, [UI.PriceText({ amount: totalDue, currency:getCurrency(db), locale:getLocale(db) })]),
                D.Tables.Td({ attrs:{ class: tw`px-3 py-2 text-sm` }}, [UI.PriceText({ amount: paidAmount, currency:getCurrency(db), locale:getLocale(db) })]),
                D.Tables.Td({ attrs:{ class: tw`px-3 py-2 text-sm` }}, [UI.PriceText({ amount: remainingAmount, currency:getCurrency(db), locale:getLocale(db) })]),
                D.Tables.Td({ attrs:{ class: tw`px-3 py-2 text-xs ${token('muted')}` }}, [formatDateTime(updatedStamp, db.env.lang, { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) || '—']),
                D.Tables.Td({ attrs:{ class: tw`px-3 py-2` }}, [
                  D.Containers.Div({ attrs:{ class: tw`flex items-center justify-end gap-2` }}, [
                    UI.Button({ attrs:{ gkey:'pos:orders:view-jobs', 'data-order-id':order.id }, variant:'ghost', size:'sm' }, [t.ui.orders_view_jobs]),
                    UI.Button({ attrs:{ gkey:'pos:orders:open-order', 'data-order-id':order.id }, variant:'ghost', size:'sm' }, [t.ui.orders_queue_open])
                  ])
                ])
              ]);
            });
      
            const table = sorted.length
              ? D.Tables.Table({ attrs:{ class: tw`w-full border-separate [border-spacing:0_8px] text-sm` }}, [
                  D.Tables.Thead({}, [headerRow]),
                  D.Tables.Tbody({}, rows)
                ])
              : UI.EmptyState({ icon:'🧾', title:t.ui.orders_no_results, description:t.ui.orders_queue_hint });
      
            const tabItems = [
              { id:'all', label:t.ui.orders_tab_all },
              { id:'dine_in', label:t.ui.orders_tab_dine_in },
              { id:'delivery', label:t.ui.orders_tab_delivery },
              { id:'takeaway', label:t.ui.orders_tab_takeaway }
            ];
      
            return UI.Modal({
              open:true,
              size: db.ui?.modalSizes?.orders || 'full',
              sizeKey:'orders',
              title:t.ui.orders_queue,
              description:t.ui.orders_queue_hint,
              content: D.Containers.Div({ attrs:{ class: tw`space-y-4` }}, [
                UI.Tabs({ items: tabItems, activeId: activeTab, gkey:'pos:orders:tab' }),
                D.Containers.Div({ attrs:{ class: tw`flex flex-col gap-2 md:flex-row md:items-center md:justify-between` }}, [
                  UI.Input({ attrs:{ type:'search', value: ordersState.search || '', placeholder:t.ui.orders_search_placeholder, gkey:'pos:orders:search' } }),
                  UI.Button({ attrs:{ gkey:'pos:orders:refresh' }, variant:'ghost', size:'sm' }, ['🔄 ', t.ui.orders_refresh])
                ]),
                table
              ].filter(Boolean)),
              actions:[
                UI.Button({ attrs:{ gkey:'ui:modal:close', class: tw`w-full` }, variant:'ghost', size:'sm' }, [t.ui.close])
              ]
            });
          }
      
          function OrdersJobStatusModal(db){
            const t = getTexts(db);
            if(!db.ui.modals.jobStatus) return null;
            const jobState = db.ui.jobStatus || {};
            const orderId = jobState.orderId;
            if(!orderId) return null;
            const lang = db.env.lang || 'ar';
            const kdsData = db.data.kds || {};
            const jobOrders = kdsData.jobOrders || {};
            const headers = Array.isArray(jobOrders.headers) ? jobOrders.headers.filter(header=> String(header.orderId) === String(orderId)) : [];
            const details = Array.isArray(jobOrders.details) ? jobOrders.details : [];
            const detailMap = new Map();
            details.forEach(detail=>{
              if(!detail || !detail.jobOrderId) return;
              const list = detailMap.get(detail.jobOrderId) || [];
              list.push(detail);
              detailMap.set(detail.jobOrderId, list);
            });
            const stationsIndex = new Map((Array.isArray(kdsData.stations) ? kdsData.stations : []).map(station=> [station.id, station]));
            const sectionIndex = new Map((Array.isArray(db.data.kitchenSections) ? db.data.kitchenSections : []).map(section=> [section.id, section]));
            const findOrder = ()=>{
              const candidates = [db.data.order, ...(db.data.ordersQueue || []), ...(db.data.ordersHistory || [])];
              return candidates.find(entry=> entry && String(entry.id) === String(orderId)) || null;
            };
            const orderRecord = findOrder();
            const summaryRows = [
              { label: t.ui.order_id, value: orderId },
              orderRecord && orderRecord.type ? { label: t.ui.service_type, value: localize(getOrderTypeConfig(orderRecord.type).label, lang) } : null,
              orderRecord && orderRecord.customerName ? { label: t.ui.customer, value: orderRecord.customerName } : null,
              orderRecord && Array.isArray(orderRecord.tableIds) && orderRecord.tableIds.length
                ? { label: t.ui.tables, value: orderRecord.tableIds.join(', ') }
                : null
            ].filter(Boolean);
            const summaryContent = summaryRows.length
              ? D.Containers.Div({ attrs:{ class: tw`grid gap-2 sm:grid-cols-2` }}, summaryRows.map(row=>
                  D.Containers.Div({ attrs:{ class: tw`flex flex-col rounded border border-[var(--muted)] bg-[var(--surface-2)] px-3 py-2` }}, [
                    D.Text.Span({ attrs:{ class: tw`text-xs ${token('muted')}` }}, [row.label]),
                    D.Text.Strong({ attrs:{ class: tw`text-sm` }}, [row.value])
                  ])
                ))
              : null;
            const cards = headers.map(header=>{
              const station = stationsIndex.get(header.stationId) || sectionIndex.get(header.stationId) || {};
              const stationLabel = lang === 'ar'
                ? (station.nameAr || station.section_name?.ar || station.name || header.stationId || '—')
                : (station.nameEn || station.section_name?.en || station.name || header.stationId || '—');
              const statusLabel = header.status || header.progressState || 'queued';
              const progress = `${Number(header.completedItems || 0)} / ${Number(header.totalItems || header.jobs?.length || 0)}`;
              const itemRows = (detailMap.get(header.id) || []).map(detail=>{
                const itemLabel = lang === 'ar'
                  ? (detail.itemNameAr || detail.itemNameEn || detail.itemCode || detail.id)
                  : (detail.itemNameEn || detail.itemNameAr || detail.itemCode || detail.id);
                const detailStatus = detail.status || 'queued';
                return D.Containers.Div({ attrs:{ class: tw`flex items-center justify-between rounded bg-[var(--surface-2)] px-3 py-2 text-sm` }}, [
                  D.Text.Span({}, [`${itemLabel} × ${Number(detail.quantity || 1)}`]),
                  UI.Badge({ text: detailStatus, variant:'badge/ghost' })
                ]);
              });
              return D.Containers.Div({ attrs:{ class: tw`space-y-3 rounded-lg border border-[var(--muted)] bg-[var(--surface-1)] p-4` }}, [
                D.Containers.Div({ attrs:{ class: tw`flex items-center justify-between gap-2` }}, [
                  D.Text.Strong({}, [stationLabel || header.stationId || '—']),
                  UI.Badge({ text: statusLabel, variant:'badge/outline' })
                ]),
                D.Containers.Div({ attrs:{ class: tw`flex items-center justify-between text-xs ${token('muted')}` }}, [
                  D.Text.Span({}, [`${t.ui.orders_jobs_items}: ${progress}`]),
                  header.updatedAt ? D.Text.Span({}, [`${t.ui.orders_jobs_updated}: ${formatDateTime(new Date(header.updatedAt).getTime(), lang, { hour:'2-digit', minute:'2-digit' })}`]) : null
                ].filter(Boolean)),
                itemRows.length ? D.Containers.Div({ attrs:{ class: tw`space-y-2` }}, itemRows) : UI.EmptyState({ icon:'🥘', title:t.ui.orders_jobs_empty })
              ]);
            });
            const content = D.Containers.Div({ attrs:{ class: tw`space-y-4` }}, [
              summaryContent,
              cards.length ? D.Containers.Div({ attrs:{ class: tw`space-y-4` }}, cards) : UI.EmptyState({ icon:'🥘', title:t.ui.orders_jobs_empty })
            ].filter(Boolean));
            return UI.Modal({
              open:true,
              size: db.ui?.modalSizes?.['orders-jobs'] || 'lg',
              sizeKey:'orders-jobs',
              title:`${t.ui.orders_jobs_title} — ${orderId}`,
              description:t.ui.orders_jobs_description,
              content,
              actions:[ UI.Button({ attrs:{ gkey:'ui:modal:close', class: tw`w-full` }, variant:'ghost', size:'sm' }, [t.ui.close]) ]
            });
          }
      
          function DiagnosticsModal(db){
            if(!db.ui.modals.diagnostics) return null;
            const t = getTexts(db);
            const lang = db.env.lang;
            const entries = Array.isArray(db.data.diagnostics?.central?.entries)
              ? db.data.diagnostics.central.entries
              : [];
            const eventLabels = t.ui.central_diag_events || {};
            const levelLabels = t.ui.central_diag_levels || {};
            const levelTone = (level)=> level === 'error'
              ? 'status/offline'
              : level === 'warn'
                ? 'status/idle'
                : level === 'debug'
                  ? 'status/idle'
                  : 'status/online';
            const formatLevel = (level)=> levelLabels[level] || level;
            const formatEvent = (event)=> eventLabels[event] || event;
            const formatJson = (value)=>{
              try { return JSON.stringify(value, null, 2); } catch(_err){ return String(value); }
            };
            const detailCard = (title, payload)=>{
              if(!payload || (typeof payload === 'object' && !Object.keys(payload).length)) return null;
              return D.Containers.Div({ attrs:{ class: tw`space-y-1 rounded-xl bg-[color-mix(in oklab,var(--surface-2) 88%, transparent)] px-3 py-2` }}, [
                D.Text.Span({ attrs:{ class: tw`text-xs font-semibold uppercase ${token('muted')}` }}, [title]),
                D.Text.Pre({ attrs:{ class: tw`whitespace-pre-wrap break-words text-xs font-mono` }}, [formatJson(payload)])
              ]);
            };
            const items = entries.length
              ? entries.slice().reverse().map(entry=>{
                  const timestamp = formatDateTime(entry.ts, lang, { hour:'2-digit', minute:'2-digit', second:'2-digit' });
                  const eventLabel = formatEvent(entry.event);
                  const levelLabel = formatLevel(entry.level);
                  const badgeTone = levelTone(entry.level);
                  const statusBlock = detailCard(t.ui.central_diag_status, entry.status);
                  const dataBlock = detailCard(t.ui.central_diag_details, entry.data);
                  return UI.Card({
                    variant:'card/soft-2',
                    content: D.Containers.Div({ attrs:{ class: tw`space-y-3` }}, [
                      D.Containers.Div({ attrs:{ class: tw`flex items-center justify-between gap-2` }}, [
                        D.Text.Strong({}, [eventLabel]),
                        UI.Badge({
                          variant:'badge/status',
                          attrs:{ class: tw`${token(badgeTone)} text-xs` },
                          text: levelLabel,
                          leading: entry.level === 'error' ? '✖' : entry.level === 'warn' ? '!' : '•'
                        })
                      ]),
                      D.Text.Span({ attrs:{ class: tw`text-xs ${token('muted')}` }}, [timestamp]),
                      entry.message ? D.Text.Span({ attrs:{ class: tw`text-sm` }}, [entry.message]) : null,
                      statusBlock,
                      dataBlock
                    ].filter(Boolean))
                  });
                })
              : [UI.EmptyState({ icon:'🛰️', title:t.ui.central_diag_empty, description:t.ui.central_diag_wait || '' })];
            return UI.Modal({
              open:true,
              size: db.ui?.modalSizes?.['central-diagnostics'] || 'lg',
              sizeKey:'central-diagnostics',
              closeGkey:'pos:central:diagnostics:close',
              title:t.ui.central_diag_title,
              description:t.ui.central_diag_description,
              content: UI.ScrollArea({ attrs:{ class: tw`max-h-[65vh]` }, children:[ D.Containers.Div({ attrs:{ class: tw`space-y-3` }}, items) ] }),
              actions:[
                UI.Button({ attrs:{ gkey:'pos:central:diagnostics:clear', class: tw`w-full` }, variant:'ghost', size:'sm' }, [t.ui.central_diag_clear]),
                UI.Button({ attrs:{ gkey:'pos:central:diagnostics:close', class: tw`w-full` }, variant:'soft', size:'sm' }, [t.ui.close])
              ]
            });
          }
      
          function activateOrder(ctx, order, options={}){
            if(!order) return;
            const typeConfig = getOrderTypeConfig(order.type || 'dine_in');
            const safeOrder = {
              ...order,
              lines: Array.isArray(order.lines) ? order.lines.map(line=> ({ ...line })) : [],
              notes: Array.isArray(order.notes) ? order.notes.map(note=> ({ ...note })) : [],
              payments: Array.isArray(order.payments) ? order.payments.map(pay=> ({ ...pay })) : [],
              dirty:false,
              discount: normalizeDiscount(order.discount)
            };
            ctx.setState(s=>{
              const data = s.data || {};
              const modals = { ...(s.ui?.modals || {}) };
              if(options.closeOrdersModal) modals.orders = false;
              const orderNavState = { ...(s.ui?.orderNav || {}) };
              if(options.hideOrderNavPad !== false) orderNavState.showPad = false;
              if(options.resetOrderNavValue) orderNavState.value = '';
              const paymentsSplit = safeOrder.payments || [];
              const nextPayments = {
                ...(data.payments || {}),
                split: paymentsSplit
              };
              if(!Array.isArray(nextPayments.methods) || !nextPayments.methods.length){
                nextPayments.methods = clonePaymentMethods(PAYMENT_METHODS);
              }
              const totals = safeOrder.totals && typeof safeOrder.totals === 'object'
                ? { ...safeOrder.totals }
                : calculateTotals(safeOrder.lines || [], data.settings || {}, safeOrder.type || 'dine_in', { orderDiscount: safeOrder.discount });
              const paymentEntries = getActivePaymentEntries({ ...safeOrder, totals }, nextPayments);
              const paymentSnapshot = summarizePayments(totals, paymentEntries);
              return {
                ...s,
                data:{
                  ...data,
                  order:{
                    ...(data.order || {}),
                    ...safeOrder,
                    totals,
                    paymentState: paymentSnapshot.state,
                    allowAdditions: safeOrder.allowAdditions !== undefined ? safeOrder.allowAdditions : !!typeConfig.allowsLineAdditions,
                    lockLineEdits: safeOrder.lockLineEdits !== undefined ? safeOrder.lockLineEdits : true,
                    isPersisted: safeOrder.isPersisted !== undefined ? safeOrder.isPersisted : true
                  },
                  payments: nextPayments
                },
                ui:{
                  ...(s.ui || {}),
                  modals,
                  shift:{ ...(s.ui?.shift || {}), showPin:false },
                  orderNav: orderNavState
                }
              };
            });
          }
      
          function PaymentsSheet(db){
            const t = getTexts(db);
            if(!db.ui.modals.payments) return null;
            const methods = (db.data.payments?.methods && db.data.payments.methods.length)
              ? db.data.payments.methods
              : PAYMENT_METHODS;
            return UI.Drawer({
              open:true,
              side:'end',
              closeGkey:'pos:payments:close',
              panelAttrs:{ class: tw`w-[min(420px,92vw)] sm:w-[420px]` },
              header: D.Containers.Div({ attrs:{ class: tw`flex items-center justify-between gap-2` }}, [
                D.Containers.Div({ attrs:{ class: tw`space-y-1` }}, [
                  D.Text.Strong({}, [t.ui.payments]),
                  D.Text.Span({ attrs:{ class: tw`text-xs ${token('muted')}` }}, [t.ui.split_payments])
                ]),
                UI.Button({ attrs:{ gkey:'pos:payments:close' }, variant:'ghost', size:'md' }, [D.Text.Span({ attrs:{ class: tw`text-lg` }}, ['✕'])])
              ]),
              content: D.Containers.Div({ attrs:{ class: tw`space-y-3` }}, [
                UI.ChipGroup({
                  attrs:{ class: tw`text-base sm:text-lg` },
                  items: methods.map(method=>({
                    id: method.id,
                    label: `${method.icon} ${localize(method.label, db.env.lang)}`,
                    attrs:{ gkey:'pos:payments:method', 'data-method-id':method.id }
                  })),
                  activeId: db.data.payments.activeMethod
                }),
                UI.NumpadDecimal({
                  attrs:{ class: tw`w-full` },
                  value: db.ui.paymentDraft?.amount || '',
                  placeholder: t.ui.amount,
                  gkey:'pos:payments:amount',
                  confirmLabel: t.ui.capture_payment,
                  confirmAttrs:{ gkey:'pos:payments:capture', variant:'solid', size:'md', class: tw`w-full` }
                }),
                UI.Button({ attrs:{ gkey:'pos:payments:close', class: tw`w-full` }, variant:'ghost', size:'sm' }, [t.ui.close])
              ])
            });
          }
      
          function LineModifiersModal(db){
            const t = getTexts(db);
            if(!db.ui.modals.modifiers) return null;
            const order = db.data.order || {};
            const state = db.ui.lineModifiers || {};
            const lineId = state.lineId;
            const line = (order.lines || []).find(entry=> entry.id === lineId);
            const lang = db.env.lang;
            const catalog = db.data.modifiers || { addOns:[], removals:[] };
            const selectedAddOns = new Set((state.addOns || []).map(String));
            const selectedRemovals = new Set((state.removals || []).map(String));
            const mapModifier = (entry)=> entry ? { id:String(entry.id), type: entry.type, label: entry.label, priceChange: Number(entry.priceChange ?? entry.price_change ?? 0) } : null;
            const selectedModifiers = [
              ...catalog.addOns.filter(entry=> selectedAddOns.has(String(entry.id))).map(mapModifier),
              ...catalog.removals.filter(entry=> selectedRemovals.has(String(entry.id))).map(mapModifier)
            ].filter(Boolean);
            const previewLine = line ? applyLinePricing({ ...line, modifiers: selectedModifiers }) : null;
      
            const buildModifierButtons = (items, type, selected)=>{
              if(!items.length){
                return UI.EmptyState({ icon:'ℹ️', title:t.ui.line_modifiers_empty });
              }
              return D.Containers.Div({ attrs:{ class: tw`grid grid-cols-1 gap-2 sm:grid-cols-2` }}, items.map(item=>{
                const active = selected.has(String(item.id));
                const delta = Number(item.priceChange ?? item.price_change ?? 0) || 0;
                const price = delta ? `${delta > 0 ? '+' : '−'} ${formatCurrencyValue(db, Math.abs(delta))}` : t.ui.line_modifiers_free;
                return UI.Button({
                  attrs:{
                    gkey:'pos:order:line:modifiers.toggle',
                    'data-line-id': lineId,
                    'data-mod-type':type,
                    'data-mod-id':item.id,
                    class: tw`justify-between`
                  },
                  variant: active ? 'solid' : 'ghost',
                  size:'sm'
                }, [
                  D.Text.Span({ attrs:{ class: tw`text-sm font-semibold` }}, [localize(item.label, lang)]),
                  D.Text.Span({ attrs:{ class: tw`text-xs ${token('muted')}` }}, [price])
                ]);
              }));
            };
      
            const addOnsSection = buildModifierButtons(catalog.addOns || [], 'add_on', selectedAddOns);
            const removalsSection = buildModifierButtons(catalog.removals || [], 'removal', selectedRemovals);
            const summaryRows = line && previewLine
              ? D.Containers.Div({ attrs:{ class: tw`space-y-2 rounded-[var(--radius)] bg-[color-mix(in oklab,var(--surface-2) 90%, transparent)] px-3 py-2 text-sm` }}, [
                  UI.HStack({ attrs:{ class: tw`justify-between` }}, [
                    D.Text.Span({}, [t.ui.line_modifiers_unit]),
                    UI.PriceText({ amount: previewLine.price, currency:getCurrency(db), locale:getLocale(db) })
                  ]),
                  UI.HStack({ attrs:{ class: tw`justify-between` }}, [
                    D.Text.Span({}, [t.ui.total]),
                    UI.PriceText({ amount: previewLine.total, currency:getCurrency(db), locale:getLocale(db) })
                  ])
                ])
              : null;
      
            const description = line
              ? `${localize(line.name, lang)} × ${line.qty}`
              : t.ui.line_modifiers_missing;
      
            return UI.Modal({
              open:true,
              title: t.ui.line_modifiers_title,
              description,
              closeGkey:'pos:order:line:modifiers.close',
              content: D.Containers.Div({ attrs:{ class: tw`space-y-4` }}, [
                D.Containers.Div({ attrs:{ class: tw`space-y-2` }}, [
                  D.Text.Strong({}, [t.ui.line_modifiers_addons]),
                  addOnsSection
                ]),
                D.Containers.Div({ attrs:{ class: tw`space-y-2` }}, [
                  D.Text.Strong({}, [t.ui.line_modifiers_removals]),
                  removalsSection
                ]),
                summaryRows
              ].filter(Boolean)),
              actions:[
                UI.Button({ attrs:{ gkey:'pos:order:line:modifiers.close', class: tw`w-full` }, variant:'ghost', size:'sm' }, [t.ui.close]),
                line ? UI.Button({ attrs:{ gkey:'pos:order:line:modifiers.apply', 'data-line-id':lineId, class: tw`w-full` }, variant:'solid', size:'sm' }, [t.ui.line_modifiers_apply]) : null
              ].filter(Boolean)
            });
          }
      
          function ReportsDrawer(db){
            const t = getTexts(db);
            if(!db.ui.modals.reports) return null;
            const reports = computeRealtimeReports(db);
            const topItem = reports.topItemId ? (db.data.menu.items || []).find(it=> String(it.id) === String(reports.topItemId)) : null;
            return UI.Drawer({
              open:true,
              side:'start',
              header: D.Containers.Div({ attrs:{ class: tw`flex items-center justify-between` }}, [
                D.Text.Strong({}, [t.ui.reports]),
                UI.Button({ attrs:{ gkey:'pos:reports:toggle' }, variant:'ghost', size:'sm' }, ['×'])
              ]),
              content: D.Containers.Div({ attrs:{ class: tw`space-y-3` }}, [
                UI.StatCard({ title: t.ui.sales_today, value: `${new Intl.NumberFormat(getLocale(db)).format(reports.salesToday)} ${getCurrencySymbol(db)}` }),
                UI.StatCard({ title: t.ui.orders_count, value: String(reports.ordersCount) }),
                UI.StatCard({ title: t.ui.avg_ticket, value: `${new Intl.NumberFormat(getLocale(db)).format(reports.avgTicket)} ${getCurrencySymbol(db)}` }),
                topItem ? UI.StatCard({ title: t.ui.top_selling, value: localize(topItem.name, db.env.lang) }) : null
              ].filter(Boolean))
            });
          }
      
          function CustomersModal(db){
            const t = getTexts(db);
            const customerUI = db.ui.customer || {};
            if(!customerUI.open) return null;
            const mode = customerUI.mode || 'search';
            const searchValue = customerUI.search || '';
            const keypadValue = customerUI.keypad || '';
            const customers = Array.isArray(db.data.customers) ? db.data.customers : [];
            const normalizedSearch = searchValue.trim().toLowerCase();
            const filteredCustomers = normalizedSearch
              ? customers.filter(customer=>{
                  const nameMatch = (customer.name || '').toLowerCase().includes(normalizedSearch);
                  const phoneMatch = (customer.phones || []).some(phone=> String(phone).includes(normalizedSearch));
                  return nameMatch || phoneMatch;
                })
              : customers;
            let selectedCustomerId = customerUI.selectedCustomerId || db.data.order.customerId || null;
            if(mode === 'search' && selectedCustomerId && !filteredCustomers.some(customer=> customer.id === selectedCustomerId)){
              selectedCustomerId = null;
            }
            const selectedCustomer = selectedCustomerId ? findCustomer(customers, selectedCustomerId) : null;
            let selectedAddressId = customerUI.selectedAddressId || db.data.order.customerAddressId || null;
            if(mode === 'search' && selectedCustomer){
              if(!selectedAddressId || !(selectedCustomer.addresses || []).some(address=> address.id === selectedAddressId)){
                selectedAddressId = selectedCustomer.addresses?.[0]?.id || selectedAddressId;
              }
            } else if(!selectedCustomer){
              selectedAddressId = null;
            }
            const selectedAddress = selectedCustomer ? findCustomerAddress(selectedCustomer, selectedAddressId) : null;
            const areaOptions = (db.data.customerAreas || CAIRO_DISTRICTS).map(area=> ({ value: area.id, label: db.env.lang === 'ar' ? area.ar : area.en }));
            const tabs = UI.Segmented({
              items:[
                { id:'search', label:`🔎 ${t.ui.customer_tab_search}`, attrs:{ gkey:'pos:customer:mode', 'data-mode':'search' } },
                { id:'create', label:`➕ ${t.ui.customer_tab_create}`, attrs:{ gkey:'pos:customer:mode', 'data-mode':'create' } }
              ],
              activeId: mode
            });
            const customerList = filteredCustomers.length
              ? UI.List({ children: filteredCustomers.map(customer=> UI.ListItem({
                    leading:'👤',
                    content:[
                      D.Text.Strong({ attrs:{ class: tw`text-sm` }}, [customer.name]),
                      D.Text.Span({ attrs:{ class: tw`text-xs ${token('muted')}` }}, [customer.phones.join(' • ')])
                    ],
                    trailing: customer.addresses?.length ? UI.Badge({ text:String(customer.addresses.length), variant:'badge/ghost' }) : null,
                    attrs:{
                      gkey:'pos:customer:select',
                      'data-customer-id': customer.id,
                      class: tw`${customer.id === selectedCustomerId ? 'border-[var(--primary)] bg-[color-mix(in oklab,var(--primary) 10%, var(--surface-1))]' : ''}`
                    }
                  })) })
              : UI.EmptyState({ icon:'🕵️‍♀️', title:t.ui.customer_no_results, description:t.ui.customer_search_placeholder });
            const addressList = selectedCustomer && selectedCustomer.addresses?.length
              ? UI.List({ children: selectedCustomer.addresses.map(address=> UI.ListItem({
                  leading:'📍',
                  content:[
                    D.Text.Strong({ attrs:{ class: tw`text-sm` }}, [address.title || t.ui.customer_address_title]),
                    D.Text.Span({ attrs:{ class: tw`text-xs ${token('muted')}` }}, [
                      `${getDistrictLabel(address.areaId, db.env.lang)}${address.line ? ' • ' + address.line : ''}`
                    ])
                  ],
                  trailing: UI.Button({ attrs:{ gkey:'pos:customer:address:select', 'data-address-id':address.id, class: tw`h-8 rounded-full px-3 text-xs` }, variant:'soft', size:'sm' }, [address.id === selectedAddressId ? '✅' : t.ui.customer_select_address]),
                  attrs:{
                    class: tw`${address.id === selectedAddressId ? 'border-[var(--primary)] bg-[color-mix(in oklab,var(--primary) 12%, var(--surface-1))]' : ''}`
                  }
                })) })
              : UI.EmptyState({ icon:'📭', title:t.ui.customer_addresses, description:t.ui.customer_multi_address_hint });
            const selectedDetails = selectedCustomer
              ? UI.Card({
                  variant:'card/soft-1',
                  title:selectedCustomer.name,
                  content: D.Containers.Div({ attrs:{ class: tw`space-y-3` }}, [
                    D.Text.Span({ attrs:{ class: tw`text-sm` }}, [`${t.ui.customer_phones}: ${selectedCustomer.phones.join(' • ')}`]),
                    addressList,
                    D.Containers.Div({ attrs:{ class: tw`flex flex-wrap gap-2` }}, [
                      UI.Button({ attrs:{ gkey:'pos:customer:attach', class: tw`flex-1` }, variant:'solid', size:'sm' }, ['✅ ', t.ui.customer_attach]),
                      UI.Button({ attrs:{ gkey:'pos:customer:edit', class: tw`flex-1` }, variant:'ghost', size:'sm' }, ['✏️ ', t.ui.customer_edit_action || t.ui.customer_create])
                    ])
                  ])
                })
              : UI.EmptyState({ icon:'👤', title:t.ui.customer_use_existing || t.ui.customer_tab_search, description:t.ui.customer_search_placeholder });
            const searchColumn = UI.Card({
              variant:'card/soft-1',
              title:t.ui.customer_search,
              content: D.Containers.Div({ attrs:{ class: tw`space-y-4` }}, [
                UI.Input({ attrs:{ type:'search', value: searchValue, placeholder:t.ui.customer_search_placeholder, gkey:'pos:customer:search' } }),
                UI.NumpadDecimal({
                  attrs:{ class: tw`w-full` },
                  value: keypadValue,
                  placeholder:t.ui.customer_keypad,
                  gkey:'pos:customer:keypad',
                  allowDecimal:false,
                  confirmLabel:t.ui.customer_search,
                  confirmAttrs:{ gkey:'pos:customer:keypad:confirm', variant:'solid', size:'sm', class: tw`w-full` }
                }),
                customerList
              ])
            });
            const formState = customerUI.form || createEmptyCustomerForm();
            const formPhones = Array.isArray(formState.phones) && formState.phones.length ? formState.phones : [''];
            const formAddresses = Array.isArray(formState.addresses) && formState.addresses.length ? formState.addresses : [createEmptyCustomerForm().addresses[0]];
            const phoneFields = D.Containers.Div({ attrs:{ class: tw`space-y-2` }}, formPhones.map((phone, index)=> UI.HStack({ attrs:{ class: tw`items-center gap-2` }}, [
              UI.Input({ attrs:{ value: phone, placeholder:t.ui.customer_phone, gkey:'pos:customer:form:phone', 'data-index':index, inputmode:'tel' } }),
              formPhones.length > 1 ? UI.Button({ attrs:{ gkey:'pos:customer:form:phone:remove', 'data-index':index, class: tw`h-9 rounded-full px-3 text-xs` }, variant:'ghost', size:'sm' }, ['✕']) : null
            ].filter(Boolean))));
            const addressFields = D.Containers.Div({ attrs:{ class: tw`space-y-3` }}, formAddresses.map((address, index)=> UI.Card({
              variant:'card/soft-2',
              content: D.Containers.Div({ attrs:{ class: tw`space-y-3` }}, [
                UI.Field({ label:t.ui.customer_address_title, control: UI.Input({ attrs:{ value: address.title || '', gkey:'pos:customer:form:address:title', 'data-index':index, placeholder:t.ui.customer_address_title } }) }),
                UI.Field({ label:t.ui.customer_area, control: UI.Select({ attrs:{ value: address.areaId || '', gkey:'pos:customer:form:address:area', 'data-index':index }, options: areaOptions }) }),
                UI.Field({ label:t.ui.customer_address_line, control: UI.Input({ attrs:{ value: address.line || '', gkey:'pos:customer:form:address:line', 'data-index':index, placeholder:t.ui.customer_address_line } }) }),
                UI.Field({ label:t.ui.customer_address_notes, control: UI.Textarea({ attrs:{ value: address.notes || '', gkey:'pos:customer:form:address:notes', 'data-index':index, rows:2, placeholder:t.ui.customer_address_notes } }) }),
                formAddresses.length > 1 ? UI.Button({ attrs:{ gkey:'pos:customer:form:address:remove', 'data-index':index, class: tw`w-full` }, variant:'ghost', size:'sm' }, ['🗑️ ', t.ui.customer_remove_address]) : null
              ].filter(Boolean))
            })));
            const formColumn = UI.Card({
              variant:'card/soft-1',
              title: formState.id ? t.ui.customer_edit : t.ui.customer_new,
              content: D.Containers.Div({ attrs:{ class: tw`space-y-4` }}, [
                UI.Field({ label:t.ui.customer_name, control: UI.Input({ attrs:{ value: formState.name || '', gkey:'pos:customer:form:name', placeholder:t.ui.customer_name } }) }),
                D.Text.Span({ attrs:{ class: tw`text-xs ${token('muted')}` }}, [t.ui.customer_multi_phone_hint]),
                phoneFields,
                UI.Button({ attrs:{ gkey:'pos:customer:form:phone:add', class: tw`w-full` }, variant:'ghost', size:'sm' }, ['➕ ', t.ui.customer_add_phone]),
                UI.NumpadDecimal({
                  attrs:{ class: tw`w-full` },
                  value: keypadValue,
                  placeholder:t.ui.customer_keypad,
                  gkey:'pos:customer:keypad',
                  allowDecimal:false,
                  confirmLabel:t.ui.customer_add_phone,
                  confirmAttrs:{ gkey:'pos:customer:form:keypad:confirm', variant:'solid', size:'sm', class: tw`w-full` }
                }),
                D.Text.Span({ attrs:{ class: tw`text-xs ${token('muted')}` }}, [t.ui.customer_multi_address_hint]),
                addressFields,
                UI.Button({ attrs:{ gkey:'pos:customer:form:address:add', class: tw`w-full` }, variant:'ghost', size:'sm' }, ['➕ ', t.ui.customer_add_address]),
                D.Containers.Div({ attrs:{ class: tw`flex flex-wrap gap-2` }}, [
                  UI.Button({ attrs:{ gkey:'pos:customer:save', class: tw`flex-1` }, variant:'solid', size:'sm' }, ['💾 ', t.ui.customer_create]),
                  UI.Button({ attrs:{ gkey:'pos:customer:form:reset', class: tw`flex-1` }, variant:'ghost', size:'sm' }, ['↺ ', t.ui.customer_form_reset || t.ui.clear])
                ])
              ])
            });
            const bodyContent = mode === 'search'
              ? D.Containers.Div({ attrs:{ class: tw`grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]` }}, [searchColumn, selectedDetails])
              : D.Containers.Div({ attrs:{ class: tw`grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]` }}, [formColumn, D.Containers.Div({ attrs:{ class: tw`space-y-3` }}, [
                  D.Text.Span({ attrs:{ class: tw`text-sm ${token('muted')}` }}, [t.ui.customer_multi_phone_hint]),
                  D.Text.Span({ attrs:{ class: tw`text-sm ${token('muted')}` }}, [t.ui.customer_multi_address_hint])
                ])]);
            return UI.Modal({
              open:true,
              size: db.ui?.modalSizes?.customers || 'full',
              sizeKey:'customers',
              closeGkey:'pos:customer:close',
              title:t.ui.customer_center,
              description: mode === 'search' ? t.ui.customer_use_existing || t.ui.customer_search : t.ui.customer_new,
              content: D.Containers.Div({ attrs:{ class: tw`space-y-4` }}, [tabs, bodyContent]),
              actions:[UI.Button({ attrs:{ gkey:'pos:customer:close', class: tw`w-full` }, variant:'ghost', size:'sm' }, [t.ui.close])]
            });
          }
      
          function SettingsDrawer(db){
            const t = getTexts(db);
            const uiSettings = db.ui.settings || {};
            if(!uiSettings.open) return null;
            const activeTheme = uiSettings.activeTheme || db.env.theme || 'dark';
            const themePrefs = db.data.themePrefs || {};
            const currentPrefs = themePrefs[activeTheme] || {};
            const colorPrefs = currentPrefs.colors || {};
            const fontPrefs = currentPrefs.fonts || {};
            const paletteDefaults = (BASE_PALETTE && BASE_PALETTE[activeTheme]) || {};
      
            const colorFields = [
              { key:'--background', label:t.ui.settings_color_background, fallback: paletteDefaults.background },
              { key:'--foreground', label:t.ui.settings_color_foreground, fallback: paletteDefaults.foreground },
              { key:'--primary', label:t.ui.settings_color_primary, fallback: paletteDefaults.primary },
              { key:'--accent', label:t.ui.settings_color_accent, fallback: paletteDefaults.accent },
              { key:'--muted', label:t.ui.settings_color_muted, fallback: paletteDefaults.muted }
            ];
      
            const themeTabs = UI.Segmented({
              items:[
                { id:'light', label:`☀️ ${t.ui.settings_light}`, attrs:{ gkey:'pos:settings:theme', 'data-theme':'light' } },
                { id:'dark', label:`🌙 ${t.ui.settings_dark}`, attrs:{ gkey:'pos:settings:theme', 'data-theme':'dark' } }
              ],
              activeId: activeTheme
            });
      
            const normalizeColor = (value, fallback)=>{
              const source = value || fallback || '#000000';
              if(!source) return '#000000';
              const trimmed = String(source).trim();
              if(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(trimmed)) return trimmed.length === 4
                ? '#' + trimmed.slice(1).split('').map(ch=> ch+ch).join('')
                : trimmed;
              const nums = trimmed.match(/[-]?[\d\.]+/g);
              if(!nums || nums.length < 3) return '#000000';
              if(trimmed.startsWith('rgb')){
                const [r,g,b] = nums.map(n=> Math.max(0, Math.min(255, Math.round(Number(n)))));
                return '#' + [r,g,b].map(v=> v.toString(16).padStart(2,'0')).join('');
              }
              if(trimmed.startsWith('hsl')){
                const [hRaw,sRaw,lRaw] = nums.map(Number);
                const h = ((hRaw % 360) + 360) % 360;
                const s = (sRaw > 1 ? sRaw / 100 : sRaw);
                const l = (lRaw > 1 ? lRaw / 100 : lRaw);
                const c = (1 - Math.abs(2 * l - 1)) * s;
                const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
                const m = l - c / 2;
                let r=0, g=0, b=0;
                if (h < 60) { r = c; g = x; b = 0; }
                else if (h < 120) { r = x; g = c; b = 0; }
                else if (h < 180) { r = 0; g = c; b = x; }
                else if (h < 240) { r = 0; g = x; b = c; }
                else if (h < 300) { r = x; g = 0; b = c; }
                else { r = c; g = 0; b = x; }
                const toHex = v => Math.round((v + m) * 255).toString(16).padStart(2,'0');
                return '#' + toHex(r) + toHex(g) + toHex(b);
              }
              return '#000000';
            };
      
            const colorControls = D.Containers.Div({ attrs:{ class: tw`space-y-3` }}, colorFields.map(field=>{
              const value = normalizeColor(colorPrefs[field.key], field.fallback);
              return UI.Field({
                label: field.label,
                control: UI.Input({ attrs:{ type:'color', value, gkey:'pos:settings:color', 'data-css-var':field.key } })
              });
            }));
      
            const fontSizeValue = fontPrefs.base || '16px';
            const fontControl = UI.Field({
              label: t.ui.settings_font_base,
              control: UI.Input({ attrs:{ type:'number', min:'12', max:'24', step:'0.5', value: String(parseFloat(fontSizeValue) || 16), gkey:'pos:settings:font' } })
            });
      
            const resetButton = UI.Button({
              attrs:{ gkey:'pos:settings:reset', class: tw`w-full` },
              variant:'ghost',
              size:'sm'
            }, [`↺ ${t.ui.settings_reset}`]);
      
            return UI.Drawer({
              open:true,
              side:'end',
              header: D.Containers.Div({ attrs:{ class: tw`flex items-center justify-between` }}, [
                D.Text.Strong({}, [t.ui.settings_center]),
                UI.Button({ attrs:{ gkey:'pos:settings:close' }, variant:'ghost', size:'sm' }, ['✕'])
              ]),
              content: D.Containers.Div({ attrs:{ class: tw`flex h-full flex-col gap-4` }}, [
                D.Text.Span({ attrs:{ class: tw`text-sm ${token('muted')}` }}, [t.ui.settings_theme]),
                themeTabs,
                UI.Divider(),
                D.Text.Strong({ attrs:{ class: tw`text-sm` }}, [t.ui.settings_colors]),
                colorControls,
                UI.Divider(),
                D.Text.Strong({ attrs:{ class: tw`text-sm` }}, [t.ui.settings_fonts]),
                fontControl,
                resetButton
              ])
            });
          }
      
          function ShiftPinDialog(db){
            const shiftUI = db.ui.shift || {};
            if(!shiftUI.showPin) return null;
            const t = getTexts(db);
            const openingFloat = shiftUI.openingFloat ?? db.data.shift?.config?.openingFloat ?? SHIFT_OPEN_FLOAT_DEFAULT;
            const pinLength = db.data.shift?.config?.pinLength || SHIFT_PIN_LENGTH;
            const pinPlaceholder = '•'.repeat(Math.max(pinLength || 0, 4));
            return UI.Modal({
              open:true,
              size: db.ui?.modalSizes?.['shift-pin'] || 'sm',
              sizeKey:'shift-pin',
              closeGkey:'pos:shift:pin:cancel',
              title:t.ui.shift_open,
              description:t.ui.shift_open_prompt,
              content: D.Containers.Div({ attrs:{ class: tw`space-y-4` }}, [
                UI.NumpadDecimal({
                  value: shiftUI.pin || '',
                  placeholder: pinPlaceholder,
                  gkey:'pos:shift:pin',
                  allowDecimal:false,
                  masked:true,
                  maskLength: pinLength,
                  confirmLabel:t.ui.shift_open,
                  confirmAttrs:{ gkey:'pos:shift:pin:confirm', variant:'solid', size:'sm', class: tw`w-full` }
                }),
                UI.Field({
                  label:t.ui.shift_cash_start,
                  control: UI.Input({ attrs:{ type:'number', step:'0.01', value:String(openingFloat ?? 0), gkey:'pos:shift:opening-float' } })
                })
              ]),
              actions:[
                UI.Button({ attrs:{ gkey:'pos:shift:pin:cancel', class: tw`w-full` }, variant:'ghost', size:'sm' }, [t.ui.close])
              ]
            });
          }
      
          function ShiftSummaryModal(db){
            const t = getTexts(db);
            const shiftUI = db.ui.shift || {};
            if(!shiftUI.showSummary) return null;
            const shiftState = db.data.shift || {};
            const history = Array.isArray(shiftState.history) ? shiftState.history : [];
            const current = shiftState.current || null;
            const defaultViewId = shiftUI.viewShiftId || (current ? current.id : (history[history.length-1]?.id || null));
            let viewingCurrent = false;
            let shift = null;
            if(current && current.id === defaultViewId){
              shift = current;
              viewingCurrent = true;
            } else {
              shift = history.find(item=> item.id === defaultViewId) || (current || history[history.length-1] || null);
              viewingCurrent = !!(shift && current && shift.id === current.id);
            }
            if(!shift){
              return UI.Modal({
                open:true,
                size: db.ui?.modalSizes?.['shift-summary'] || 'md',
                sizeKey:'shift-summary',
                title:t.ui.shift_summary,
                description:t.ui.shift_history_empty,
                actions:[UI.Button({ attrs:{ gkey:'pos:shift:summary:close', class: tw`w-full` }, variant:'ghost', size:'sm' }, [t.ui.close])]
              });
            }
            const lang = db.env.lang;
            const report = summarizeShiftOrders(db.data.ordersHistory, shift);
            const totalsByType = report.totalsByType || {};
            const paymentsByMethod = report.paymentsByMethod || {};
            const countsByType = report.countsByType || {};
            const dineInTotal = round(totalsByType.dine_in || 0);
            const takeawayTotal = round(totalsByType.takeaway || 0);
            const deliveryTotal = round(totalsByType.delivery || 0);
            const totalSales = report.totalSales != null ? round(report.totalSales) : round(dineInTotal + takeawayTotal + deliveryTotal);
            const paymentMethods = Array.isArray(db.data.payments?.methods) && db.data.payments.methods.length ? db.data.payments.methods : PAYMENT_METHODS;
            const paymentRows = paymentMethods.map(method=>{
              const amount = round(paymentsByMethod[method.id] || 0);
              return UI.HStack({ attrs:{ class: tw`${token('split')} text-sm` }}, [
                D.Text.Span({}, [`${method.icon || '💳'} ${localize(method.label, lang)}`]),
                UI.PriceText({ amount, currency:getCurrency(db), locale:getLocale(db) })
              ]);
            });
            Object.keys(paymentsByMethod).forEach(key=>{
              if(paymentMethods.some(method=> method.id === key)) return;
              const amount = round(paymentsByMethod[key] || 0);
              paymentRows.push(UI.HStack({ attrs:{ class: tw`${token('split')} text-sm` }}, [
                D.Text.Span({}, [key]),
                UI.PriceText({ amount, currency:getCurrency(db), locale:getLocale(db) })
              ]));
            });
            const openingFloat = round(shift.openingFloat || 0);
            const cashCollected = round(paymentsByMethod.cash || 0);
            const closingCash = shift.closingCash != null ? round(shift.closingCash) : round(openingFloat + cashCollected);
            const ordersCount = report.ordersCount != null ? report.ordersCount : (Array.isArray(shift.orders) ? shift.orders.length : 0);
            const openedLabel = shift.openedAt ? formatDateTime(shift.openedAt, lang, { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : '—';
            const closedLabel = shift.closedAt ? formatDateTime(shift.closedAt, lang, { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : '—';
            const chipsSection = (()=>{
              const items = [];
              if(current){
                items.push({ id: current.id, label:`${t.ui.shift_current}`, attrs:{ gkey:'pos:shift:view', 'data-shift-id':current.id } });
              }
              history.forEach(item=>{
                const label = item.openedAt ? formatDateTime(item.openedAt, lang, { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : item.id;
                items.push({ id:item.id, label, attrs:{ gkey:'pos:shift:view', 'data-shift-id':item.id } });
              });
              if(!items.length) return null;
              const labelText = viewingCurrent ? t.ui.shift_current : t.ui.shift_select_history;
              return D.Containers.Div({ attrs:{ class: tw`space-y-1` }}, [
                D.Text.Span({ attrs:{ class: tw`text-sm font-medium` }}, [labelText]),
                UI.ChipGroup({ items, activeId: shift.id })
              ]);
            })();
            const renderTypeRow = (typeId, labelText)=>{
              const amount = round(totalsByType[typeId] || 0);
              const count = countsByType[typeId] || 0;
              return UI.HStack({ attrs:{ class: tw`${token('split')} text-sm` }}, [
                D.Containers.Div({ attrs:{ class: tw`flex items-center gap-2` }}, [
                  D.Text.Span({}, [labelText]),
                  count ? UI.Badge({ text:String(count), variant:'badge/ghost', attrs:{ class: tw`text-[0.65rem]` } }) : null
                ].filter(Boolean)),
                UI.PriceText({ amount, currency:getCurrency(db), locale:getLocale(db) })
              ]);
            };
            const baseTypeRows = [
              renderTypeRow('dine_in', t.ui.shift_total_dine_in),
              renderTypeRow('takeaway', t.ui.shift_total_takeaway),
              renderTypeRow('delivery', t.ui.shift_total_delivery)
            ];
            const extraTypeRows = Object.keys(totalsByType)
              .filter(key=> !['dine_in','takeaway','delivery'].includes(key))
              .sort()
              .map(typeId=>{
                const config = ORDER_TYPES.find(type=> type.id === typeId);
                const label = config ? localize(config.label, lang) : typeId;
                return renderTypeRow(typeId, label);
              });
            const totalsCard = UI.Card({
              variant:'card/soft-1',
              title:t.ui.shift_total_sales,
              content: D.Containers.Div({ attrs:{ class: tw`space-y-2` }}, [
                ...baseTypeRows,
                ...extraTypeRows,
                UI.Divider(),
                UI.HStack({ attrs:{ class: tw`${token('split')} text-base font-semibold` }}, [D.Text.Span({}, [t.ui.shift_total_sales]), UI.PriceText({ amount:totalSales, currency:getCurrency(db), locale:getLocale(db) })])
              ])
            });
            const paymentsCard = UI.Card({
              variant:'card/soft-1',
              title:t.ui.shift_payments,
              content: D.Containers.Div({ attrs:{ class: tw`space-y-2` }}, paymentRows)
            });
            const cashCard = UI.Card({
              variant:'card/soft-2',
              title:t.ui.shift_cash_summary,
              content: D.Containers.Div({ attrs:{ class: tw`space-y-2 text-sm` }}, [
                UI.HStack({ attrs:{ class: tw`${token('split')}` }}, [D.Text.Span({}, [t.ui.shift_cash_start]), UI.PriceText({ amount:openingFloat, currency:getCurrency(db), locale:getLocale(db) })]),
                UI.HStack({ attrs:{ class: tw`${token('split')}` }}, [D.Text.Span({}, [t.ui.shift_cash_collected]), UI.PriceText({ amount:cashCollected, currency:getCurrency(db), locale:getLocale(db) })]),
                UI.Divider(),
                UI.HStack({ attrs:{ class: tw`${token('split')} font-semibold` }}, [D.Text.Span({}, [t.ui.shift_cash_end]), UI.PriceText({ amount:closingCash, currency:getCurrency(db), locale:getLocale(db) })])
              ])
            });
            const metaRow = UI.Card({
              variant:'card/soft-2',
              content: D.Containers.Div({ attrs:{ class: tw`space-y-2 text-xs ${token('muted')}` }}, [
                D.Text.Span({}, [`POS: ${shift.posLabel || POS_INFO.label}`]),
                D.Text.Span({}, [`POS ID: ${shift.posId || POS_INFO.id}`]),
                D.Text.Span({}, [`${t.ui.shift}: ${shift.id}`]),
                D.Text.Span({}, [`${t.ui.cashier}: ${shift.cashierName || '—'}`]),
                D.Text.Span({}, [`${t.ui.shift_orders_count}: ${ordersCount}`]),
                D.Text.Span({}, [`${openedLabel} → ${closedLabel}`])
              ])
            });
            const summaryContent = D.Containers.Div({ attrs:{ class: tw`space-y-4` }}, [
              chipsSection,
              totalsCard,
              paymentsCard,
              cashCard,
              metaRow
            ].filter(Boolean));
            const ordersTable = report.orders?.length
              ? UI.Table({
                  columns:[
                    { key:'id', label:t.ui.order_id },
                    { key:'type', label:t.ui.orders_type },
                    { key:'total', label:t.ui.orders_total },
                    { key:'savedAt', label:t.ui.orders_updated }
                  ],
                  rows: report.orders.map(entry=>({
                    id: entry.id,
                    type: localize(getOrderTypeConfig(entry.type || 'dine_in').label, lang),
                    total: new Intl.NumberFormat(getLocale(db), { style:'currency', currency:getCurrency(db) }).format(entry.total || 0),
                    savedAt: formatDateTime(entry.savedAt, lang, { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })
                  }))
                })
              : UI.EmptyState({ icon:'🧾', title:t.ui.orders_no_results, description:t.ui.orders_queue_hint });
            const paymentsTable = report.payments?.length
              ? UI.Table({
                  columns:[
                    { key:'orderId', label:t.ui.order_id },
                    { key:'method', label:t.ui.payments },
                    { key:'amount', label:t.ui.amount },
                    { key:'capturedAt', label:t.ui.orders_updated }
                  ],
                  rows: report.payments.map(entry=>({
                    orderId: entry.orderId,
                    method: entry.method,
                    amount: new Intl.NumberFormat(getLocale(db), { style:'currency', currency:getCurrency(db) }).format(entry.amount || 0),
                    capturedAt: formatDateTime(entry.capturedAt, lang, { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })
                  }))
                })
              : UI.EmptyState({ icon:'💳', title:t.ui.payments, description:t.ui.orders_no_results });
            const refundsContent = report.refunds?.length
              ? UI.List({ children: report.refunds.map(ref=> UI.ListItem({
                    leading:'↩️',
                    content:[
                      D.Text.Strong({}, [ref.id || '—']),
                      D.Text.Span({ attrs:{ class: tw`text-xs ${token('muted')}` }}, [`${t.ui.order_id}: ${ref.orderId || '—'}`])
                    ],
                    trailing: D.Text.Span({}, [new Intl.NumberFormat(getLocale(db), { style:'currency', currency:getCurrency(db) }).format(ref.amount || 0)])
                  })) })
              : UI.EmptyState({ icon:'↩️', title:t.ui.refunds, description:t.ui.orders_no_results });
            const returnsContent = report.returns?.length
              ? UI.List({ children: report.returns.map(ret=> UI.ListItem({
                    leading:'🛒',
                    content:[
                      D.Text.Strong({}, [ret.id || '—']),
                      D.Text.Span({ attrs:{ class: tw`text-xs ${token('muted')}` }}, [`${t.ui.order_id}: ${ret.orderId || '—'}`])
                    ],
                    trailing: D.Text.Span({}, [new Intl.NumberFormat(getLocale(db), { style:'currency', currency:getCurrency(db) }).format(ret.amount || 0)])
                  })) })
              : UI.EmptyState({ icon:'🛒', title:t.ui.returns, description:t.ui.orders_no_results });
            const tabs = UI.Tabs({
              gkey:'pos:shift:tab',
              items:[
                { id:'summary', label:t.ui.shift_summary, content: summaryContent },
                { id:'orders', label:t.ui.orders, content: ordersTable },
                { id:'payments', label:t.ui.payments, content: paymentsTable },
                { id:'refunds', label:t.ui.refunds, content: refundsContent },
                { id:'returns', label:t.ui.returns, content: returnsContent }
              ],
              activeId: shiftUI.activeTab || 'summary'
            });
            const content = D.Containers.Div({ attrs:{ class: tw`space-y-4` }}, [tabs]);
            const actions = [
              viewingCurrent ? UI.Button({ attrs:{ gkey:'pos:shift:close', class: tw`w-full` }, variant:'solid', size:'sm' }, [t.ui.shift_close_confirm]) : null,
              UI.Button({ attrs:{ gkey:'pos:shift:summary:close', class: tw`w-full` }, variant:'ghost', size:'sm' }, [t.ui.close])
            ].filter(Boolean);
            return UI.Modal({
              open:true,
              size: db.ui?.modalSizes?.['shift-summary'] || 'full',
              sizeKey:'shift-summary',
              closeGkey:'pos:shift:summary:close',
              title:t.ui.shift_summary,
              description:viewingCurrent ? t.ui.shift_current : t.ui.shift_history,
              content,
              actions
            });
          }
      scope.components = {
        Header,
        MenuColumn,
        OrderColumn,
        FooterBar,
        TablesModal,
        ReservationsModal,
        PrintModal,
        LineModifiersModal,
        PaymentsSheet,
        ReportsDrawer,
        CustomersModal,
        SettingsDrawer,
        ShiftPinDialog,
        ShiftSummaryModal,
        OrdersQueueModal,
        OrdersJobStatusModal,
        DiagnosticsModal
      };
    }
  };
})(typeof window !== 'undefined' ? window : this);
