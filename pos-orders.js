(function(global){
  global.MishkahPOSChunks = global.MishkahPOSChunks || {};
  global.MishkahPOSChunks.orders = function(scope){
    if(!scope || typeof scope !== 'object') return;
    with(scope){
          function closeActiveModals(ctx){
            const state = ctx.getState();
            const modalsState = state.ui?.modals || {};
            const anyOpen = Object.values(modalsState).some(Boolean) || !!state.ui?.modalOpen;
            if(!anyOpen) return false;
            ctx.setState(s=>{
              const current = { ...(s.ui?.modals || {}) };
              Object.keys(current).forEach(key=>{
                current[key] = false;
              });
              return {
                ...s,
                ui:{ ...(s.ui || {}), modalOpen:false, modals: current, jobStatus:null }
              };
            });
            return true;
          }
      
          const posOrders = {
            'ui.modal.close':{
              on:['click'],
              gkeys:['ui:modal:close'],
              handler:(e,ctx)=>{
                e.preventDefault();
                e.stopPropagation();
                closeActiveModals(ctx);
              }
            },
            'ui.modal.size':{
              on:['click'],
              gkeys:['ui:modal:size'],
              handler:(e,ctx)=>{
                const btn = e.target.closest('[data-modal-size-key]');
                if(!btn) return;
                const key = btn.getAttribute('data-modal-size-key');
                const value = btn.getAttribute('data-modal-size');
                if(!key || !value) return;
                ctx.setState(s=>{
                  const current = s.ui?.modalSizes || {};
                  const next = { ...current, [key]: value };
                  if(preferencesStore){
                    try { preferencesStore.set('modalSizes', next); } catch(err){ console.warn('[Mishkah][POS] modal size persist failed', err); }
                  }
                  return {
                    ...s,
                    ui:{ ...(s.ui || {}), modalSizes: next }
                  };
                });
              }
            },
            'pos.shift.tab':{
              on:['click'],
              gkeys:['pos:shift:tab'],
              handler:(e,ctx)=>{
                const btn = e.target.closest('[data-tab-id]');
                if(!btn) return;
                const tabId = btn.getAttribute('data-tab-id');
                if(!tabId) return;
                ctx.setState(s=>({
                  ...s,
                  ui:{ ...(s.ui || {}), shift:{ ...(s.ui?.shift || {}), activeTab: tabId } }
                }));
              }
            },
            'pos.settings.open':{
              on:['click'],
              gkeys:['pos:settings:open'],
              handler:(e,ctx)=>{
                ctx.setState(s=>({
                  ...s,
                  ui:{ ...(s.ui || {}), settings:{ ...(s.ui?.settings || {}), open:true, activeTheme:(s.ui?.settings?.activeTheme || s.env?.theme || 'dark') } }
                }));
              }
            },
            'pos.settings.close':{
              on:['click'],
              gkeys:['pos:settings:close','ui:drawer:close'],
              handler:(e,ctx)=>{
                ctx.setState(s=>({
                  ...s,
                  ui:{ ...(s.ui || {}), settings:{ ...(s.ui?.settings || {}), open:false } }
                }));
              }
            },
            'pos.settings.theme':{
              on:['click'],
              gkeys:['pos:settings:theme'],
              handler:(e,ctx)=>{
                const btn = e.target.closest('[data-theme]');
                if(!btn) return;
                const theme = btn.getAttribute('data-theme');
                ctx.setState(s=>({
                  ...s,
                  ui:{ ...(s.ui || {}), settings:{ ...(s.ui?.settings || {}), activeTheme: theme || 'light', open:true } }
                }));
              }
            },
            'pos.settings.color':{
              on:['input','change'],
              gkeys:['pos:settings:color'],
              handler:(e,ctx)=>{
                const input = e.target;
                const cssVar = input.getAttribute('data-css-var');
                const value = input.value;
                if(!cssVar) return;
                const state = ctx.getState();
                const themeKey = state.ui?.settings?.activeTheme || state.env?.theme || 'dark';
                ctx.setState(s=>{
                  const prefs = { ...(s.data.themePrefs || {}) };
                  const entry = { colors:{ ...(prefs[themeKey]?.colors || {}) }, fonts:{ ...(prefs[themeKey]?.fonts || {}) } };
                  entry.colors[cssVar] = value;
                  prefs[themeKey] = entry;
                  if(preferencesStore){
                    try { preferencesStore.set('themePrefs', prefs); } catch(err){ console.warn('[Mishkah][POS] theme prefs persist failed', err); }
                  }
                  return { ...s, data:{ ...(s.data || {}), themePrefs: prefs } };
                });
                applyThemePreferenceStyles(ctx.getState().data.themePrefs);
              }
            },
            'pos.settings.font':{
              on:['input','change'],
              gkeys:['pos:settings:font'],
              handler:(e,ctx)=>{
                const value = parseFloat(e.target.value);
                if(!Number.isFinite(value)) return;
                const state = ctx.getState();
                const themeKey = state.ui?.settings?.activeTheme || state.env?.theme || 'dark';
                ctx.setState(s=>{
                  const prefs = { ...(s.data.themePrefs || {}) };
                  const entry = { colors:{ ...(prefs[themeKey]?.colors || {}) }, fonts:{ ...(prefs[themeKey]?.fonts || {}) } };
                  entry.fonts.base = `${value}px`;
                  prefs[themeKey] = entry;
                  if(preferencesStore){
                    try { preferencesStore.set('themePrefs', prefs); } catch(err){ console.warn('[Mishkah][POS] theme prefs persist failed', err); }
                  }
                  return { ...s, data:{ ...(s.data || {}), themePrefs: prefs } };
                });
                applyThemePreferenceStyles(ctx.getState().data.themePrefs);
              }
            },
            'pos.settings.reset':{
              on:['click'],
              gkeys:['pos:settings:reset'],
              handler:(e,ctx)=>{
                const state = ctx.getState();
                const themeKey = state.ui?.settings?.activeTheme || state.env?.theme || 'dark';
                ctx.setState(s=>{
                  const prefs = { ...(s.data.themePrefs || {}) };
                  delete prefs[themeKey];
                  if(preferencesStore){
                    try { preferencesStore.set('themePrefs', prefs); } catch(err){ console.warn('[Mishkah][POS] theme prefs persist failed', err); }
                  }
                  return { ...s, data:{ ...(s.data || {}), themePrefs: prefs } };
                });
                applyThemePreferenceStyles(ctx.getState().data.themePrefs);
              }
            },
            'ui.modal.escape':{
              on:['keydown'],
              handler:(e,ctx)=>{
                if(e.key !== 'Escape') return;
                const closed = closeActiveModals(ctx);
                if(closed){
                  e.preventDefault();
                  e.stopPropagation();
                }
              }
            },
            'pos.menu.search':{
              on:['input','change'],
              gkeys:['pos:menu:search'],
              handler:(e,ctx)=>{
                const value = e.target.value || '';
                ctx.setState(s=>({
                  ...s,
                  data:{
                    ...s.data,
                    menu:{ ...(s.data.menu || {}), search:value }
                  }
                }));
              }
            },
            'pos.menu.category':{
              on:['click'],
              gkeys:['pos:menu:category'],
              handler:(e,ctx)=>{
                const btn = e.target.closest('[data-category-id]');
                if(!btn) return;
                const id = btn.getAttribute('data-category-id') || 'all';
                ctx.setState(s=>({
                  ...s,
                  data:{
                    ...s.data,
                    menu:{ ...(s.data.menu || {}), category:id }
                  }
                }));
              }
            },
            'pos.menu:add':{
              on:['click','keydown'],
              gkeys:['pos:menu:add'],
              handler:(e,ctx)=>{
                if(e.type === 'keydown' && !['Enter',' '].includes(e.key)) return;
                const card = e.target.closest('[data-item-id]');
                if(!card) return;
                const itemId = card.getAttribute('data-item-id');
                const state = ctx.getState();
                const item = (state.data.menu.items || []).find(it=> String(it.id) === String(itemId));
                if(!item) return;
                const t = getTexts(state);
                ctx.setState(s=>{
                  const data = s.data || {};
                  const order = data.order || {};
                  const typeConfig = getOrderTypeConfig(order.type || 'dine_in');
                  const isPersisted = !!order.isPersisted;
                  const allowAdditions = order.allowAdditions !== undefined ? order.allowAdditions : !!typeConfig.allowsLineAdditions;
                  if(isPersisted && !allowAdditions){
                    UI.pushToast(ctx, { title:t.toast.order_additions_blocked, icon:'🚫' });
                    return s;
                  }
                  const lines = (order.lines || []).map(line=> ({ ...line }));
                  const canMerge = !isPersisted;
                  const idx = canMerge ? lines.findIndex(line=> String(line.itemId) === String(item.id)) : -1;
                  if(idx >= 0){
                    const existing = lines[idx];
                    lines[idx] = updateLineWithPricing(existing, { qty: (existing.qty || 0) + 1, updatedAt: Date.now() });
                  } else {
                    lines.push(createOrderLine(item, 1, { kitchenSection: item.kitchenSection }));
                  }
                  const totals = calculateTotals(lines, data.settings || {}, order.type, { orderDiscount: order.discount });
                  const paymentEntries = getActivePaymentEntries({ ...order, lines, totals }, data.payments);
                  const paymentSnapshot = summarizePayments(totals, paymentEntries);
                  return {
                    ...s,
                    data:{
                      ...data,
                      order:{
                        ...order,
                        lines,
                        totals,
                        paymentState: paymentSnapshot.state,
                        updatedAt: Date.now(),
                        allowAdditions: allowAdditions
                      }
                    }
                  };
                });
                UI.pushToast(ctx, { title:t.toast.item_added, icon:'✅' });
              }
            },
            'pos.menu.favorite':{
              on:['click'],
              gkeys:['pos:menu:favorite'],
              handler:(e,ctx)=>{
                e.preventDefault();
                e.stopPropagation();
                const btn = e.target.closest('[data-item-id]');
                if(!btn) return;
                const itemId = String(btn.getAttribute('data-item-id'));
                ctx.setState(s=>{
                  const menu = s.data.menu || {};
                  const favorites = new Set((menu.favorites || []).map(String));
                  if(favorites.has(itemId)) favorites.delete(itemId); else favorites.add(itemId);
                  return {
                    ...s,
                    data:{
                      ...s.data,
                      menu:{ ...menu, favorites:Array.from(favorites) }
                    }
                  };
                });
              }
            },
            'pos.menu.favorites-only':{
              on:['click'],
              gkeys:['pos:menu:favorites-only'],
              handler:(e,ctx)=>{
                ctx.setState(s=>({
                  ...s,
                  data:{
                    ...s.data,
                    menu:{ ...(s.data.menu || {}), showFavoritesOnly: !s.data.menu?.showFavoritesOnly }
                  }
                }));
              }
            },
            'pos.menu.load-more':{
              on:['click'],
              gkeys:['pos:menu:load-more'],
              handler:(e,ctx)=>{
                const scroller = document.querySelector('[data-menu-scroll="true"]');
                if(scroller && typeof scroller.scrollBy === 'function'){
                  scroller.scrollBy({ top: scroller.clientHeight || 400, behavior:'smooth' });
                  return;
                }
                const t = getTexts(ctx.getState());
                UI.pushToast(ctx, { title:t.toast.load_more_stub, icon:'ℹ️' });
              }
            },
            'pos.order.line.inc':{
              on:['click'],
              gkeys:['pos:order:line:inc'],
              handler:(e,ctx)=>{
                const btn = e.target.closest('[data-line-id]');
                if(!btn) return;
                const lineId = btn.getAttribute('data-line-id');
                ctx.setState(s=>{
                  const data = s.data || {};
                  const order = data.order || {};
                  const line = (order.lines || []).find(l=> l.id === lineId);
                  if(!line){
                    return s;
                  }
                  if(line.locked || (order.isPersisted && order.lockLineEdits) || (line.status && line.status !== 'draft')){
                    UI.pushToast(ctx, { title:getTexts(s).toast.line_locked, icon:'🔒' });
                    return s;
                  }
                  const lines = (order.lines || []).map(l=>{
                    if(l.id !== lineId) return l;
                    return updateLineWithPricing(l, { qty: (l.qty || 0) + 1, updatedAt: Date.now() });
                  });
                  const totals = calculateTotals(lines, data.settings || {}, order.type, { orderDiscount: order.discount });
                  const paymentEntries = getActivePaymentEntries({ ...order, lines, totals }, data.payments);
                  const paymentSnapshot = summarizePayments(totals, paymentEntries);
                  return {
                    ...s,
                    data:{
                      ...data,
                      order:{ ...order, lines, totals, paymentState: paymentSnapshot.state, updatedAt: Date.now() }
                    }
                  };
                });
              }
            },
            'pos.order.line.dec':{
              on:['click'],
              gkeys:['pos:order:line:dec'],
              handler:(e,ctx)=>{
                const btn = e.target.closest('[data-line-id]');
                if(!btn) return;
                const lineId = btn.getAttribute('data-line-id');
                ctx.setState(s=>{
                  const data = s.data || {};
                  const order = data.order || {};
                  const target = (order.lines || []).find(l=> l.id === lineId);
                  if(!target){
                    return s;
                  }
                  if(target.locked || (order.isPersisted && order.lockLineEdits) || (target.status && target.status !== 'draft')){
                    UI.pushToast(ctx, { title:getTexts(s).toast.line_locked, icon:'🔒' });
                    return s;
                  }
                  const lines = [];
                  for(const line of (order.lines || [])){
                    if(line.id !== lineId){
                      lines.push(line);
                      continue;
                    }
                    if(line.qty <= 1) continue;
                    lines.push(updateLineWithPricing(line, { qty: line.qty - 1, updatedAt: Date.now() }));
                  }
                  const totals = calculateTotals(lines, data.settings || {}, order.type, { orderDiscount: order.discount });
                  const paymentEntries = getActivePaymentEntries({ ...order, lines, totals }, data.payments);
                  const paymentSnapshot = summarizePayments(totals, paymentEntries);
                  return {
                    ...s,
                    data:{
                      ...data,
                      order:{ ...order, lines, totals, paymentState: paymentSnapshot.state, updatedAt: Date.now() }
                    }
                  };
                });
              }
            },
            'pos.order.line.qty':{
              on:['click'],
              gkeys:['pos:order:line:qty'],
              handler:(e,ctx)=>{
                const btn = e.target.closest('[data-line-id]');
                if(!btn) return;
                const lineId = btn.getAttribute('data-line-id');
                const state = ctx.getState();
                const t = getTexts(state);
                const current = (state.data.order.lines || []).find(line=> line.id === lineId);
                if(current && (current.locked || (state.data.order.isPersisted && state.data.order.lockLineEdits) || (current.status && current.status !== 'draft'))){
                  UI.pushToast(ctx, { title:t.toast.line_locked, icon:'🔒' });
                  return;
                }
                const nextValue = window.prompt(t.toast.set_qty, current ? current.qty : 1);
                if(nextValue == null) return;
                const qty = Math.max(1, parseInt(nextValue, 10) || 1);
                ctx.setState(s=>{
                  const data = s.data || {};
                  const order = data.order || {};
                  const lines = (order.lines || []).map(line=>{
                    if(line.id !== lineId) return line;
                    return updateLineWithPricing(line, { qty, updatedAt: Date.now() });
                  });
                  const totals = calculateTotals(lines, data.settings || {}, order.type, { orderDiscount: order.discount });
                  const paymentEntries = getActivePaymentEntries({ ...order, lines, totals }, data.payments);
                  const paymentSnapshot = summarizePayments(totals, paymentEntries);
                  return {
                    ...s,
                    data:{
                      ...data,
                      order:{ ...order, lines, totals, paymentState: paymentSnapshot.state, updatedAt: Date.now() }
                    }
                  };
                });
              }
            },
            'pos.order.line.modifiers':{
              on:['click'],
              gkeys:['pos:order:line:modifiers'],
              handler:(e,ctx)=>{
                const btn = e.target.closest('[data-line-id]');
                if(!btn) return;
                const lineId = btn.getAttribute('data-line-id');
                if(!lineId) return;
                const state = ctx.getState();
                const t = getTexts(state);
                const order = state.data.order || {};
                const line = (order.lines || []).find(entry=> entry.id === lineId);
                if(!line){
                  UI.pushToast(ctx, { title:t.toast.order_nav_not_found, icon:'❓' });
                  return;
                }
                if(line.locked || (order.isPersisted && order.lockLineEdits) || (line.status && line.status !== 'draft')){
                  UI.pushToast(ctx, { title:t.toast.line_locked, icon:'🔒' });
                  return;
                }
                const selectedAddOns = (Array.isArray(line.modifiers) ? line.modifiers : []).filter(mod=> mod.type === 'add_on').map(mod=> String(mod.id));
                const selectedRemovals = (Array.isArray(line.modifiers) ? line.modifiers : []).filter(mod=> mod.type === 'removal').map(mod=> String(mod.id));
                ctx.setState(s=>({
                  ...s,
                  ui:{
                    ...(s.ui || {}),
                    modals:{ ...(s.ui?.modals || {}), modifiers:true },
                    lineModifiers:{ lineId, addOns:selectedAddOns, removals:selectedRemovals }
                  }
                }));
              }
            },
            'pos.order.line.note':{
              on:['click'],
              gkeys:['pos:order:line:note'],
              handler:(e,ctx)=>{
                const btn = e.target.closest('[data-line-id]');
                if(!btn) return;
                const lineId = btn.getAttribute('data-line-id');
                const state = ctx.getState();
                const t = getTexts(state);
                const order = state.data.order || {};
                const line = (order.lines || []).find(entry=> entry.id === lineId);
                if(!line){
                  UI.pushToast(ctx, { title:t.toast.order_nav_not_found, icon:'❓' });
                  return;
                }
                if(line.locked || (order.isPersisted && order.lockLineEdits) || (line.status && line.status !== 'draft')){
                  UI.pushToast(ctx, { title:t.toast.line_locked, icon:'🔒' });
                  return;
                }
                const currentNote = notesToText(line.notes);
                const input = window.prompt(t.toast.add_note, currentNote);
                if(input == null) return;
                const trimmed = input.trim();
                const now = Date.now();
                const user = state.data.user || {};
                const noteEntry = trimmed
                  ? {
                    id: `note-${now.toString(36)}`,
                    message: trimmed,
                    authorId: user.id || user.role || 'pos',
                    authorName: user.name || '',
                    createdAt: now
                  }
                  : null;
                ctx.setState(s=>{
                  const data = s.data || {};
                  const nextOrder = data.order || {};
                  const lines = (nextOrder.lines || []).map(item=>{
                    if(item.id !== lineId) return item;
                    const baseNotes = Array.isArray(item.notes) ? item.notes.filter(Boolean) : [];
                    const nextNotes = noteEntry ? baseNotes.concat([noteEntry]) : [];
                    return updateLineWithPricing(item, { notes: nextNotes, updatedAt: now });
                  });
                  const totals = calculateTotals(lines, data.settings || {}, nextOrder.type, { orderDiscount: nextOrder.discount });
                  const paymentEntries = getActivePaymentEntries({ ...nextOrder, lines, totals }, data.payments);
                  const paymentSnapshot = summarizePayments(totals, paymentEntries);
                  return {
                    ...s,
                    data:{
                      ...data,
                      order:{
                        ...nextOrder,
                        lines,
                        totals,
                        paymentState: paymentSnapshot.state,
                        updatedAt: now
                      }
                    }
                  };
                });
                UI.pushToast(ctx, { title:t.toast.notes_updated, icon:'📝' });
              }
            },
            'pos.order.line.discount':{
              on:['click'],
              gkeys:['pos:order:line:discount'],
              handler:(e,ctx)=>{
                const btn = e.target.closest('[data-line-id]');
                if(!btn) return;
                const lineId = btn.getAttribute('data-line-id');
                const state = ctx.getState();
                const t = getTexts(state);
                const order = state.data.order || {};
                const line = (order.lines || []).find(entry=> entry.id === lineId);
                if(!line){
                  UI.pushToast(ctx, { title:t.toast.order_nav_not_found, icon:'❓' });
                  return;
                }
                if(line.locked || (order.isPersisted && order.lockLineEdits) || (line.status && line.status !== 'draft')){
                  UI.pushToast(ctx, { title:t.toast.line_locked, icon:'🔒' });
                  return;
                }
                const unitPrice = getLineUnitPrice(line);
                const baseAmount = Math.max(0, round(unitPrice * (Number(line.qty) || 0)));
                const allowedRate = Number(state.data.user?.allowedDiscountRate);
                const currentDiscount = normalizeDiscount(line.discount);
                const defaultValue = currentDiscount
                  ? currentDiscount.type === 'percent'
                    ? `${currentDiscount.value}%`
                    : String(currentDiscount.value)
                  : '';
                const input = window.prompt(t.toast.enter_line_discount, defaultValue);
                if(input == null) return;
                const { discount, error, limit } = parseDiscountInput(input, baseAmount, allowedRate);
                if(error === 'invalid'){
                  UI.pushToast(ctx, { title:t.toast.discount_invalid, icon:'⚠️' });
                  return;
                }
                if(error === 'limit'){
                  const message = t.toast.discount_limit.replace('%limit%', String(Math.round((limit + Number.EPSILON) * 100) / 100));
                  UI.pushToast(ctx, { title:message, icon:'⚠️' });
                  return;
                }
                const now = Date.now();
                ctx.setState(s=>{
                  const data = s.data || {};
                  const nextOrder = data.order || {};
                  const lines = (nextOrder.lines || []).map(item=>{
                    if(item.id !== lineId) return item;
                    return updateLineWithPricing(item, { discount: normalizeDiscount(discount), updatedAt: now });
                  });
                  const totals = calculateTotals(lines, data.settings || {}, nextOrder.type, { orderDiscount: nextOrder.discount });
                  const paymentEntries = getActivePaymentEntries({ ...nextOrder, lines, totals }, data.payments);
                  const paymentSnapshot = summarizePayments(totals, paymentEntries);
                  return {
                    ...s,
                    data:{
                      ...data,
                      order:{
                        ...nextOrder,
                        lines,
                        totals,
                        paymentState: paymentSnapshot.state,
                        updatedAt: now
                      }
                    }
                  };
                });
                UI.pushToast(ctx, { title: discount ? t.toast.discount_applied : t.toast.discount_removed, icon: discount ? '✅' : '♻️' });
              }
            },
            'pos.order.line.modifiers.toggle':{
              on:['click'],
              gkeys:['pos:order:line:modifiers.toggle'],
              handler:(e,ctx)=>{
                const btn = e.target.closest('[data-mod-id]');
                if(!btn) return;
                const lineId = btn.getAttribute('data-line-id');
                const modId = btn.getAttribute('data-mod-id');
                const modType = btn.getAttribute('data-mod-type');
                if(!lineId || !modId) return;
                ctx.setState(s=>{
                  const current = s.ui?.lineModifiers || {};
                  if(current.lineId !== lineId){
                    return {
                      ...s,
                      ui:{
                        ...(s.ui || {}),
                        lineModifiers:{ lineId, addOns: modType === 'removal' ? [] : [modId], removals: modType === 'removal' ? [modId] : [] }
                      }
                    };
                  }
                  const key = modType === 'removal' ? 'removals' : 'addOns';
                  const existing = new Set((current[key] || []).map(String));
                  if(existing.has(modId)) existing.delete(modId); else existing.add(modId);
                  return {
                    ...s,
                    ui:{
                      ...(s.ui || {}),
                      lineModifiers:{
                        ...current,
                        lineId,
                        [key]: Array.from(existing)
                      }
                    }
                  };
                });
              }
            },
            'pos.order.line.modifiers.apply':{
              on:['click'],
              gkeys:['pos:order:line:modifiers.apply'],
              handler:(e,ctx)=>{
                const btn = e.target.closest('[data-line-id]');
                if(!btn) return;
                const lineId = btn.getAttribute('data-line-id');
                if(!lineId) return;
                const state = ctx.getState();
                const t = getTexts(state);
                const order = state.data.order || {};
                const line = (order.lines || []).find(entry=> entry.id === lineId);
                if(!line){
                  UI.pushToast(ctx, { title:t.toast.order_nav_not_found, icon:'❓' });
                  return;
                }
                if(line.locked || (order.isPersisted && order.lockLineEdits) || (line.status && line.status !== 'draft')){
                  UI.pushToast(ctx, { title:t.toast.line_locked, icon:'🔒' });
                  return;
                }
                const catalog = state.data.modifiers || { addOns:[], removals:[] };
                const draft = state.ui?.lineModifiers || {};
                const addOnIds = new Set((draft.addOns || []).map(String));
                const removalIds = new Set((draft.removals || []).map(String));
                const mapModifier = (entry)=> entry ? { id:String(entry.id), type: entry.type, label: entry.label, priceChange: Number(entry.priceChange || 0) } : null;
                const nextModifiers = [
                  ...((catalog.addOns || []).filter(entry=> addOnIds.has(String(entry.id))).map(mapModifier)),
                  ...((catalog.removals || []).filter(entry=> removalIds.has(String(entry.id))).map(mapModifier))
                ].filter(Boolean);
                const lines = (order.lines || []).map(item=>{
                  if(item.id !== lineId) return item;
                  return updateLineWithPricing(item, { modifiers: nextModifiers, updatedAt: Date.now() });
                });
                const totals = calculateTotals(lines, state.data.settings || {}, order.type, { orderDiscount: order.discount });
                const paymentEntries = getActivePaymentEntries({ ...order, lines, totals }, state.data.payments);
                const paymentSnapshot = summarizePayments(totals, paymentEntries);
                ctx.setState(s=>({
                  ...s,
                  data:{
                    ...s.data,
                    order:{ ...order, lines, totals, paymentState: paymentSnapshot.state, updatedAt: Date.now() }
                  },
                  ui:{
                    ...(s.ui || {}),
                    modals:{ ...(s.ui?.modals || {}), modifiers:false },
                    lineModifiers:{ lineId:null, addOns:[], removals:[] }
                  }
                }));
                UI.pushToast(ctx, { title:t.toast.line_modifiers_applied, icon:'✨' });
              }
            },
            'pos.order.line.modifiers.close':{
              on:['click'],
              gkeys:['pos:order:line:modifiers.close'],
              handler:(e,ctx)=>{
                ctx.setState(s=>({
                  ...s,
                  ui:{
                    ...(s.ui || {}),
                    modals:{ ...(s.ui?.modals || {}), modifiers:false },
                    lineModifiers:{ lineId:null, addOns:[], removals:[] }
                  }
                }));
              }
            },
            'pos.order.clear':{
              on:['click'],
              gkeys:['pos:order:clear'],
              handler:(e,ctx)=>{
                const t = getTexts(ctx.getState());
                if(!window.confirm(t.toast.confirm_clear)) return;
                ctx.setState(s=>{
                  const data = s.data || {};
                  const order = data.order || {};
                  const totals = calculateTotals([], data.settings || {}, order.type, { orderDiscount: null });
                  return {
                    ...s,
                    data:{
                      ...data,
                      order:{
                        ...order,
                        lines:[],
                        totals,
                        discount:null,
                        paymentState:'unpaid',
                        updatedAt: Date.now()
                      },
                      payments:{ ...(data.payments || {}), split:[] }
                    }
                  };
                });
                UI.pushToast(ctx, { title:t.toast.cart_cleared, icon:'🧺' });
              }
            },
            'pos.order.new':{
              on:['click'],
              gkeys:['pos:order:new'],
              handler: async (e,ctx)=>{
                const state = ctx.getState();
                const t = getTexts(state);
                const newId = await generateOrderId();
                ctx.setState(s=>{
                  const data = s.data || {};
                  const order = data.order || {};
                  const type = order.type || 'dine_in';
                  const typeConfig = getOrderTypeConfig(type);
                  const totals = calculateTotals([], data.settings || {}, type, { orderDiscount: null });
                  return {
                    ...s,
                    data:{
                      ...data,
                      order:{
                        ...order,
                        id: newId,
                        status:'open',
                        fulfillmentStage:'new',
                        paymentState:'unpaid',
                        type,
                        lines:[],
                        notes:[],
                        discount:null,
                        totals,
                        tableIds:[],
                        guests: type === 'dine_in' ? 0 : order.guests || 0,
                        createdAt: Date.now(),
                        updatedAt: Date.now(),
                        allowAdditions: !!typeConfig.allowsLineAdditions,
                        lockLineEdits:false,
                        isPersisted:false,
                        shiftId: data.shift?.current?.id || null,
                        posId: data.pos?.id || POS_INFO.id,
                        posLabel: data.pos?.label || POS_INFO.label,
                        posNumber: Number.isFinite(Number(data.pos?.number)) ? Number(data.pos.number) : POS_INFO.number,
                        payments:[],
                        customerId:null,
                        customerAddressId:null,
                        customerName:'',
                        customerPhone:'',
                        customerAddress:'',
                        customerAreaId:null,
                        dirty:false
                      },
                      payments:{ ...(data.payments || {}), split:[] },
                      tableLocks: order.isPersisted
                        ? data.tableLocks
                        : (data.tableLocks || []).map(lock=> lock.orderId === order.id ? { ...lock, active:false } : lock)
                    },
                    ui:{
                      ...(s.ui || {}),
                      pendingAction:null
                    }
                  };
                });
                UI.pushToast(ctx, { title:t.toast.new_order, icon:'🆕' });
              }
            },
            'pos.order.discount':{
              on:['click'],
              gkeys:['pos:order:discount'],
              handler:(e,ctx)=>{
                const state = ctx.getState();
                const t = getTexts(state);
                const order = state.data.order || {};
                const lines = order.lines || [];
                const baseTotals = calculateTotals(lines, state.data.settings || {}, order.type || 'dine_in', { orderDiscount: null });
                const baseSubtotal = baseTotals.subtotal || 0;
                const allowedRate = Number(state.data.user?.allowedDiscountRate);
                const currentDiscount = normalizeDiscount(order.discount);
                const defaultValue = currentDiscount
                  ? currentDiscount.type === 'percent'
                    ? `${currentDiscount.value}%`
                    : String(currentDiscount.value)
                  : '';
                const input = window.prompt(t.toast.enter_order_discount, defaultValue);
                if(input == null) return;
                const { discount, error, limit } = parseDiscountInput(input, baseSubtotal, allowedRate);
                if(error === 'invalid'){
                  UI.pushToast(ctx, { title:t.toast.discount_invalid, icon:'⚠️' });
                  return;
                }
                if(error === 'limit'){
                  const message = t.toast.discount_limit.replace('%limit%', String(Math.round((limit + Number.EPSILON) * 100) / 100));
                  UI.pushToast(ctx, { title:message, icon:'⚠️' });
                  return;
                }
                const now = Date.now();
                ctx.setState(s=>{
                  const data = s.data || {};
                  const nextOrder = data.order || {};
                  const totals = calculateTotals(nextOrder.lines || [], data.settings || {}, nextOrder.type || 'dine_in', { orderDiscount: discount });
                  const paymentEntries = getActivePaymentEntries({ ...nextOrder, discount, totals }, data.payments);
                  const paymentSnapshot = summarizePayments(totals, paymentEntries);
                  return {
                    ...s,
                    data:{
                      ...data,
                      order:{
                        ...nextOrder,
                        discount: normalizeDiscount(discount),
                        totals,
                        paymentState: paymentSnapshot.state,
                        updatedAt: now
                      }
                    }
                  };
                });
                UI.pushToast(ctx, { title: discount ? t.toast.discount_applied : t.toast.discount_removed, icon: discount ? '✅' : '♻️' });
              }
            },
            'pos.order.table.remove':{
              on:['click'],
              gkeys:['pos:order:table:remove'],
              handler:(e,ctx)=>{
                const btn = e.target.closest('[data-table-id]');
                if(!btn) return;
                const tableId = btn.getAttribute('data-table-id');
                const state = ctx.getState();
                const t = getTexts(state);
                const order = state.data.order || {};
                if(!window.confirm(t.ui.table_confirm_release)) return;
                ctx.setState(s=>({
                  ...s,
                  data:{
                    ...s.data,
                    order:{ ...(s.data.order || {}), tableIds:(s.data.order?.tableIds || []).filter(id=> id !== tableId), updatedAt: Date.now() },
                    tableLocks:(s.data.tableLocks || []).map(lock=> lock.tableId === tableId && lock.orderId === order.id ? { ...lock, active:false } : lock)
                  }
                }));
                UI.pushToast(ctx, { title:t.toast.table_unlocked, icon:'🔓' });
              }
            },
            'pos.order.note':{
              on:['click'],
              gkeys:['pos:order:note'],
              handler:(e,ctx)=>{
                const state = ctx.getState();
                const t = getTexts(state);
                const note = window.prompt(t.toast.add_note);
                if(note == null) return;
                const trimmed = note.trim();
                if(!trimmed){
                  return;
                }
                const now = Date.now();
                const user = state.data.user || {};
                const noteEntry = {
                  id: `note-${now.toString(36)}`,
                  message: trimmed,
                  authorId: user.id || user.role || 'pos',
                  authorName: user.name || '',
                  createdAt: now
                };
                ctx.setState(s=>{
                  const data = s.data || {};
                  const order = data.order || {};
                  const notes = Array.isArray(order.notes) ? order.notes.concat([noteEntry]) : [noteEntry];
                  return {
                    ...s,
                    data:{
                      ...data,
                      order:{
                        ...order,
                        notes,
                        updatedAt: now
                      }
                    }
                  };
                });
                UI.pushToast(ctx, { title:t.toast.notes_updated, icon:'📝' });
              }
            },
            'pos.order.type':{
              on:['click'],
              gkeys:['pos:order:type'],
              handler:(e,ctx)=>{
                const btn = e.target.closest('[data-order-type]');
                if(!btn) return;
                const type = btn.getAttribute('data-order-type');
                const state = ctx.getState();
                const t = getTexts(state);
                ctx.setState(s=>{
                  const data = s.data || {};
                  const order = data.order || {};
                  const lines = order.lines || [];
                  let tablesState = data.tables || [];
                  const nextOrder = { ...order, type };
                  if(type !== 'dine_in' && order.tableId){
                    const orderId = order.id;
                    const tableId = order.tableId;
                    tablesState = (tablesState || []).map(tbl=>{
                      if(tbl.id !== tableId) return tbl;
                      const nextSessions = (tbl.sessions || []).filter(id=> id !== orderId);
                      const wasLockedByOrder = tbl.lockedBy === orderId;
                      const nextStatus = nextSessions.length ? tbl.status : (tbl.status === 'occupied' ? 'available' : tbl.status);
                      return {
                        ...tbl,
                        sessions: nextSessions,
                        locked: wasLockedByOrder ? false : tbl.locked,
                        lockedBy: wasLockedByOrder ? null : tbl.lockedBy,
                        status: nextStatus
                      };
                    });
                    nextOrder.tableId = null;
                    nextOrder.table = null;
                  }
                  if(type === 'dine_in' && !nextOrder.tableId){
                    nextOrder.table = null;
                  }
                  nextOrder.discount = normalizeDiscount(order.discount);
                  nextOrder.totals = calculateTotals(lines, data.settings || {}, type, { orderDiscount: nextOrder.discount });
                  const paymentEntries = getActivePaymentEntries(nextOrder, data.payments);
                  const paymentSnapshot = summarizePayments(nextOrder.totals, paymentEntries);
                  nextOrder.paymentState = paymentSnapshot.state;
                  nextOrder.guests = type === 'dine_in'
                    ? (nextOrder.guests || computeGuestsForTables(nextOrder.tableIds || [], data.tables || []))
                    : 0;
                  return {
                    ...s,
                    data:{
                      ...data,
                      tables: tablesState,
                      order: nextOrder
                    }
                  };
                });
                UI.pushToast(ctx, { title:t.toast.order_type_changed, icon:'🔄' });
              }
            },
            'pos.order.save':{
              on:['click'],
              gkeys:['pos:order:save'],
              handler: async (e,ctx)=>{
                const trigger = e.target.closest('[data-save-mode]');
                const mode = trigger?.getAttribute('data-save-mode') || 'draft';
                const state = ctx.getState();
                const t = getTexts(state);
                const order = state.data?.order || {};
                const orderType = order.type || 'dine_in';
                if(orderType === 'dine_in'){
                  const tableIds = Array.isArray(order.tableIds)
                    ? order.tableIds.filter(id=> id !== null && id !== undefined && String(id).trim() !== '')
                    : [];
                  if(!tableIds.length){
                    UI.pushToast(ctx, {
                      title: t.toast.table_required || t.ui.select_table,
                      message: t.ui.select_table,
                      icon:'⚠️'
                    });
                    return;
                  }
                }
                if(orderType === 'delivery'){
                  const hasCustomer = !!(order.customerId || (order.customerName && order.customerPhone));
                  const hasAddress = !!(order.customerAddressId || (order.customerAddress && String(order.customerAddress).trim()));
                  if(!hasCustomer || !hasAddress){
                    UI.pushToast(ctx, {
                      title: t.toast.delivery_customer_required || t.toast.customer_missing_selection,
                      message: t.ui.customer_delivery_required || t.toast.customer_missing_selection,
                      icon:'⚠️'
                    });
                    return;
                  }
                }
                await persistOrderFlow(ctx, mode);
              }
            },
            'pos.shift.open':{
              on:['click'],
              gkeys:['pos:shift:open'],
              handler:(e,ctx)=>{
                ctx.setState(s=>({
                  ...s,
                  ui:{ ...(s.ui || {}), shift:{ ...(s.ui?.shift || {}), showPin:true, pin:'', openingFloat: s.ui?.shift?.openingFloat ?? s.data?.shift?.config?.openingFloat ?? SHIFT_OPEN_FLOAT_DEFAULT } }
                }));
              }
            },
            'pos.shift.pin':{
              on:['input','change'],
              gkeys:['pos:shift:pin'],
              handler:(e,ctx)=>{
                const raw = e.target.value || '';
                const state = ctx.getState();
                const maxLength = state.data.shift?.config?.pinLength || SHIFT_PIN_LENGTH;
                const digitsOnly = raw.replace(/\D/g,'');
                const value = maxLength ? digitsOnly.slice(0, maxLength) : digitsOnly;
                ctx.setState(s=>({
                  ...s,
                  ui:{ ...(s.ui || {}), shift:{ ...(s.ui?.shift || {}), pin:value } }
                }));
              }
            },
            'pos.shift.opening-float':{
              on:['input','change'],
              gkeys:['pos:shift:opening-float'],
              handler:(e,ctx)=>{
                const value = parseFloat(e.target.value);
                ctx.setState(s=>({
                  ...s,
                  ui:{ ...(s.ui || {}), shift:{ ...(s.ui?.shift || {}), openingFloat: Number.isFinite(value) ? value : 0 } }
                }));
              }
            },
            'pos.shift.pin.confirm':{
              on:['click'],
              gkeys:['pos:shift:pin:confirm'],
              handler: async (e,ctx)=>{
                const state = ctx.getState();
                const t = getTexts(state);
                const config = state.data.shift?.config || {};
                const rawPin = String(state.ui?.shift?.pin || '').trim();
                const sanitizedPin = rawPin.replace(/\D/g,'');
                const pinForSession = sanitizedPin || (SHIFT_PIN_FALLBACK && SHIFT_PIN_FALLBACK.replace(/\D/g,'')) || '0000';
                const employees = Array.isArray(state.data.employees) ? state.data.employees : [];
                let matchedEmployee = employees.find(emp=> emp.pin === pinForSession);
                if(!matchedEmployee){
                  matchedEmployee = {
                    id: `demo-${pinForSession}`,
                    name: t.ui.shift_demo_cashier || 'Demo Cashier',
                    role: 'cashier',
                    pin: pinForSession,
                    allowedDiscountRate: 100
                  };
                }
                const now = Date.now();
                const openingFloat = Number(state.ui?.shift?.openingFloat ?? config.openingFloat ?? 0);
                const totalsTemplate = ORDER_TYPES.reduce((acc,type)=>{ acc[type.id] = 0; return acc; }, {});
                const paymentsTemplate = (state.data.payments?.methods || PAYMENT_METHODS).reduce((acc, method)=>{
                  acc[method.id] = 0;
                  return acc;
                }, {});
                let persistedShift = null;
                try{
                  const baseShiftInput = {
                    id: `${POS_INFO.id}-S${now.toString(36).toUpperCase()}`,
                    posId: POS_INFO.id,
                    posLabel: POS_INFO.label,
                    posNumber: POS_INFO.number,
                    openedAt: now,
                    openingFloat: round(openingFloat),
                    totalsByType: totalsTemplate,
                    paymentsByMethod: paymentsTemplate,
                    totalSales:0,
                    orders:[],
                    countsByType:{},
                    ordersCount:0,
                    cashierId: matchedEmployee.id,
                    cashierName: matchedEmployee.name,
                    employeeId: matchedEmployee.id,
                    cashierRole: matchedEmployee.role,
                    status:'open',
                    closingCash:null,
                    isClosed:false
                  };
                  const validatedShift = SHIFT_TABLE.createRecord(baseShiftInput);
                  persistedShift = posDB.available
                    ? await posDB.openShiftRecord(validatedShift)
                    : validatedShift;
                } catch(error){
                  console.warn('[Mishkah][POS] shift open failed', error);
                  const errorCode = error && typeof error.code === 'string' ? error.code : '';
                  if(errorCode && errorCode.startsWith('POS_SYNC')){
                    UI.pushToast(ctx, { title:t.toast.central_sync_blocked, message:t.toast.central_sync_offline, icon:'🛑' });
                    return;
                  }
                  UI.pushToast(ctx, { title:t.toast.indexeddb_error, icon:'🛑' });
                  return;
                }
                if(!persistedShift){
                  UI.pushToast(ctx, { title:t.toast.shift_pin_invalid, icon:'⚠️' });
                  return;
                }
                const normalizedShift = SHIFT_TABLE.createRecord({
                  ...persistedShift,
                  totalsByType: persistedShift.totalsByType || {},
                  paymentsByMethod: persistedShift.paymentsByMethod || {},
                  countsByType: persistedShift.countsByType || {},
                  orders: Array.isArray(persistedShift.orders) ? persistedShift.orders : []
                });
                ctx.setState(s=>({
                  ...s,
                  data:{
                    ...s.data,
                    user:{
                      ...(s.data.user || {}),
                      id: matchedEmployee.id,
                      name: matchedEmployee.name,
                      role: matchedEmployee.role,
                      allowedDiscountRate: matchedEmployee.allowedDiscountRate ?? s.data.user?.allowedDiscountRate,
                      shift:normalizedShift.id
                    },
                    order:{ ...(s.data.order || {}), shiftId:normalizedShift.id },
                    shift:{ ...(s.data.shift || {}), current:normalizedShift }
                  },
                  ui:{ ...(s.ui || {}), shift:{ ...(s.ui?.shift || {}), showPin:false, pin:'', showSummary:false, viewShiftId:normalizedShift.id } }
                }));
                await refreshPersistentSnapshot({ focusCurrent:true });
                UI.pushToast(ctx, { title:t.toast.shift_open_success, icon:'✅' });
              }
            },
            'pos.shift.pin.cancel':{
              on:['click'],
              gkeys:['pos:shift:pin:cancel'],
              handler:(e,ctx)=>{
                ctx.setState(s=>({
                  ...s,
                  ui:{ ...(s.ui || {}), shift:{ ...(s.ui?.shift || {}), showPin:false, pin:'' } }
                }));
              }
            },
            'pos.shift.summary':{
              on:['click'],
              gkeys:['pos:shift:summary'],
              handler: async (e,ctx)=>{
                await refreshPersistentSnapshot({ focusCurrent:true, syncOrders:true });
                const state = ctx.getState();
                const current = state.data.shift?.current;
                const history = state.data.shift?.history || [];
                const defaultId = current?.id || (history.length ? history[history.length-1].id : null);
                ctx.setState(s=>({
                  ...s,
                  ui:{ ...(s.ui || {}), shift:{ ...(s.ui?.shift || {}), showSummary:true, viewShiftId: s.ui?.shift?.viewShiftId || defaultId, activeTab:'summary' } }
                }));
              }
            },
            'pos.shift.summary.close':{
              on:['click'],
              gkeys:['pos:shift:summary:close'],
              handler:(e,ctx)=>{
                ctx.setState(s=>({
                  ...s,
                  ui:{ ...(s.ui || {}), shift:{ ...(s.ui?.shift || {}), showSummary:false } }
                }));
              }
            },
            'pos.shift.view':{
              on:['click'],
              gkeys:['pos:shift:view'],
              handler:(e,ctx)=>{
                const btn = e.target.closest('[data-shift-id]');
                if(!btn) return;
                const shiftId = btn.getAttribute('data-shift-id');
                ctx.setState(s=>({
                  ...s,
                  ui:{ ...(s.ui || {}), shift:{ ...(s.ui?.shift || {}), viewShiftId:shiftId } }
                }));
              }
            },
            'pos.shift.close':{
              on:['click'],
              gkeys:['pos:shift:close'],
              handler: async (e,ctx)=>{
                const state = ctx.getState();
                const t = getTexts(state);
                const currentShift = state.data.shift?.current;
                if(!currentShift){
                  ctx.setState(s=>({
                    ...s,
                    ui:{ ...(s.ui || {}), shift:{ ...(s.ui?.shift || {}), showSummary:false } }
                  }));
                  return;
                }
                const sanitizedCurrent = SHIFT_TABLE.createRecord({
                  ...currentShift,
                  totalsByType: currentShift.totalsByType || {},
                  paymentsByMethod: currentShift.paymentsByMethod || {},
                  countsByType: currentShift.countsByType || {},
                  orders: Array.isArray(currentShift.orders) ? currentShift.orders : []
                });
                const summary = summarizeShiftOrders(state.data.ordersHistory, sanitizedCurrent);
                const paymentsByMethod = summary.paymentsByMethod || {};
                const closingCash = currentShift.closingCash != null ? round(currentShift.closingCash) : round((sanitizedCurrent.openingFloat || 0) + (paymentsByMethod.cash || 0));
                const baseClosed = {
                  ...sanitizedCurrent,
                  totalsByType: summary.totalsByType,
                  paymentsByMethod,
                  orders: summary.orders,
                  countsByType: summary.countsByType,
                  ordersCount: summary.ordersCount,
                  totalSales: summary.totalSales,
                  closingCash,
                  closedAt: Date.now(),
                  status:'closed',
                  isClosed:true
                };
                let closedShift = baseClosed;
                if(posDB.available){
                  try{
                    closedShift = await posDB.closeShiftRecord(currentShift.id, baseClosed);
                } catch(error){
                  console.warn('[Mishkah][POS] shift close failed', error);
                  const errorCode = error && typeof error.code === 'string' ? error.code : '';
                  if(errorCode && errorCode.startsWith('POS_SYNC')){
                    UI.pushToast(ctx, { title:t.toast.central_sync_blocked, message:t.toast.central_sync_offline, icon:'🛑' });
                    return;
                  }
                  UI.pushToast(ctx, { title:t.toast.indexeddb_error, icon:'🛑' });
                  return;
                }
                }
                const normalizedClosed = SHIFT_TABLE.createRecord({
                  ...closedShift,
                  totalsByType: closedShift.totalsByType || summary.totalsByType,
                  paymentsByMethod: closedShift.paymentsByMethod || paymentsByMethod,
                  countsByType: closedShift.countsByType || summary.countsByType,
                  orders: Array.isArray(closedShift.orders) ? closedShift.orders : summary.orders
                });
                ctx.setState(s=>({
                  ...s,
                  data:{
                    ...s.data,
                    user:{ ...(s.data.user || {}), shift:'—' },
                    order:{ ...(s.data.order || {}), shiftId:null },
                    shift:{
                      ...(s.data.shift || {}),
                      current:null,
                      history:[ ...(s.data.shift?.history || []), normalizedClosed ]
                    }
                  },
                  ui:{ ...(s.ui || {}), shift:{ ...(s.ui?.shift || {}), showSummary:true, viewShiftId:normalizedClosed.id } }
                }));
                await refreshPersistentSnapshot({ focusCurrent:false, syncOrders:true });
                UI.pushToast(ctx, { title:t.toast.shift_close_success, icon:'✅' });
              }
            },
            'pos.customer.open':{
              on:['click'],
              gkeys:['pos:customer:open'],
              handler:(e,ctx)=>{
                ctx.setState(s=>{
                  const current = s.ui?.customer || {};
                  const order = s.data.order || {};
                  const customers = Array.isArray(s.data.customers) ? s.data.customers : [];
                  const fallbackCustomerId = current.selectedCustomerId || order.customerId || customers[0]?.id || null;
                  const fallbackCustomer = findCustomer(customers, fallbackCustomerId);
                  const fallbackAddressId = current.selectedAddressId || order.customerAddressId || fallbackCustomer?.addresses?.[0]?.id || null;
                  return {
                    ...s,
                    ui:{
                      ...(s.ui || {}),
                      customer:{
                        ...current,
                        open:true,
                        mode:'search',
                        keypad:'',
                        selectedCustomerId: fallbackCustomerId,
                        selectedAddressId: fallbackAddressId
                      }
                    }
                  };
                });
              }
            },
            'pos.customer.close':{
              on:['click'],
              gkeys:['pos:customer:close'],
              handler:(e,ctx)=>{
                ctx.setState(s=>({
                  ...s,
                  ui:{ ...(s.ui || {}), customer:{ ...(s.ui?.customer || {}), open:false } }
                }));
              }
            },
            'pos.customer.mode':{
              on:['click'],
              gkeys:['pos:customer:mode'],
              handler:(e,ctx)=>{
                const btn = e.target.closest('[data-mode]');
                if(!btn) return;
                const mode = btn.getAttribute('data-mode') || 'search';
                ctx.setState(s=>{
                  const current = s.ui?.customer || {};
                  let nextForm = current.form || createEmptyCustomerForm();
                  if(mode === 'create' && (!nextForm || typeof nextForm !== 'object')){
                    nextForm = createEmptyCustomerForm();
                  }
                  return {
                    ...s,
                    ui:{
                      ...(s.ui || {}),
                      customer:{
                        ...current,
                        mode,
                        keypad:'',
                        form: nextForm
                      }
                    }
                  };
                });
              }
            },
            'pos.customer.search':{
              on:['input','change'],
              gkeys:['pos:customer:search'],
              handler:(e,ctx)=>{
                const value = e.target.value || '';
                ctx.setState(s=>{
                  const current = s.ui?.customer || {};
                  const customers = Array.isArray(s.data.customers) ? s.data.customers : [];
                  const normalized = value.trim().toLowerCase();
                  let selectedId = current.selectedCustomerId || s.data.order?.customerId || null;
                  if(normalized){
                    const matches = customers.filter(customer=>{
                      const name = (customer.name || '').toLowerCase();
                      const phoneMatch = (customer.phones || []).some(phone=> String(phone).includes(normalized));
                      return name.includes(normalized) || phoneMatch;
                    }).map(customer=> customer.id);
                    if(matches.length){
                      if(!matches.includes(selectedId)){
                        selectedId = matches[0];
                      }
                    } else {
                      selectedId = null;
                    }
                  }
                  let selectedAddressId = current.selectedAddressId;
                  if(selectedId){
                    const selectedCustomer = findCustomer(customers, selectedId);
                    if(!selectedCustomer){
                      selectedAddressId = null;
                    } else if(!selectedAddressId || !(selectedCustomer.addresses || []).some(address=> address.id === selectedAddressId)){
                      selectedAddressId = selectedCustomer.addresses?.[0]?.id || null;
                    }
                  } else {
                    selectedAddressId = null;
                  }
                  return {
                    ...s,
                    ui:{
                      ...(s.ui || {}),
                      customer:{
                        ...current,
                        search:value,
                        selectedCustomerId:selectedId,
                        selectedAddressId
                      }
                    }
                  };
                });
              }
            },
            'pos.customer.keypad':{
              on:['input','change'],
              gkeys:['pos:customer:keypad'],
              handler:(e,ctx)=>{
                const digits = (e.target.value || '').replace(/[^0-9+]/g,'');
                ctx.setState(s=>({
                  ...s,
                  ui:{ ...(s.ui || {}), customer:{ ...(s.ui?.customer || {}), keypad:digits } }
                }));
              }
            },
            'pos.customer.keypad.confirm':{
              on:['click'],
              gkeys:['pos:customer:keypad:confirm'],
              handler:(e,ctx)=>{
                ctx.setState(s=>{
                  const current = s.ui?.customer || {};
                  const keypad = (current.keypad || '').trim();
                  const customers = Array.isArray(s.data.customers) ? s.data.customers : [];
                  let selectedId = current.selectedCustomerId || s.data.order?.customerId || null;
                  if(keypad){
                    const matches = customers.filter(customer=>{
                      const name = (customer.name || '').toLowerCase();
                      const phoneMatch = (customer.phones || []).some(phone=> String(phone).includes(keypad));
                      return name.includes(keypad.toLowerCase()) || phoneMatch;
                    }).map(customer=> customer.id);
                    if(matches.length){
                      if(!matches.includes(selectedId)){
                        selectedId = matches[0];
                      }
                    } else {
                      selectedId = null;
                    }
                  }
                  let selectedAddressId = current.selectedAddressId;
                  if(selectedId){
                    const selectedCustomer = findCustomer(customers, selectedId);
                    if(!selectedCustomer){
                      selectedAddressId = null;
                    } else if(!selectedAddressId || !(selectedCustomer.addresses || []).some(address=> address.id === selectedAddressId)){
                      selectedAddressId = selectedCustomer.addresses?.[0]?.id || null;
                    }
                  } else {
                    selectedAddressId = null;
                  }
                  return {
                    ...s,
                    ui:{
                      ...(s.ui || {}),
                      customer:{
                        ...current,
                        search: keypad,
                        keypad:'',
                        selectedCustomerId:selectedId,
                        selectedAddressId
                      }
                    }
                  };
                });
              }
            },
            'pos.customer.select':{
              on:['click'],
              gkeys:['pos:customer:select'],
              handler:(e,ctx)=>{
                const btn = e.target.closest('[data-customer-id]');
                if(!btn) return;
                const id = btn.getAttribute('data-customer-id');
                ctx.setState(s=>{
                  const customers = s.data.customers || [];
                  const customer = findCustomer(customers, id);
                  const firstAddress = customer?.addresses?.[0]?.id || null;
                  return {
                    ...s,
                    ui:{
                      ...(s.ui || {}),
                      customer:{
                        ...(s.ui?.customer || {}),
                        selectedCustomerId:id,
                        selectedAddressId: firstAddress || s.ui?.customer?.selectedAddressId || null
                      }
                    }
                  };
                });
              }
            },
            'pos.customer.address.select':{
              on:['click'],
              gkeys:['pos:customer:address:select'],
              handler:(e,ctx)=>{
                const btn = e.target.closest('[data-address-id]');
                if(!btn) return;
                const id = btn.getAttribute('data-address-id');
                ctx.setState(s=>({
                  ...s,
                  ui:{ ...(s.ui || {}), customer:{ ...(s.ui?.customer || {}), selectedAddressId:id } }
                }));
              }
            },
            'pos.customer.attach':{
              on:['click'],
              gkeys:['pos:customer:attach'],
              handler:(e,ctx)=>{
                const state = ctx.getState();
                const t = getTexts(state);
                const customers = state.data.customers || [];
                const customerId = state.ui?.customer?.selectedCustomerId || state.data.order?.customerId;
                const customer = findCustomer(customers, customerId);
                if(!customer){
                  UI.pushToast(ctx, { title:t.toast.customer_missing_selection, icon:'⚠️' });
                  return;
                }
                const addressId = state.ui?.customer?.selectedAddressId || state.data.order?.customerAddressId || null;
                const address = addressId ? findCustomerAddress(customer, addressId) : null;
                if(state.data.order?.type === 'delivery' && !address){
                  UI.pushToast(ctx, { title:t.toast.customer_missing_address, icon:'⚠️' });
                  return;
                }
                ctx.setState(s=>{
                  const order = s.data.order || {};
                  return {
                    ...s,
                    data:{
                      ...s.data,
                      order:{
                        ...order,
                        customerId: customer.id,
                        customerAddressId: address?.id || null,
                        customerName: customer.name,
                        customerPhone: customer.phones?.[0] || '',
                        customerAddress: address?.line || address?.title || '',
                        customerAreaId: address?.areaId || null
                      }
                    },
                    ui:{
                      ...(s.ui || {}),
                      customer:{ ...(s.ui?.customer || {}), open:false }
                    }
                  };
                });
                UI.pushToast(ctx, { title:t.toast.customer_attach_success, icon:'✅' });
              }
            },
            'pos.customer.edit':{
              on:['click'],
              gkeys:['pos:customer:edit'],
              handler:(e,ctx)=>{
                const state = ctx.getState();
                const customers = state.data.customers || [];
                const customerId = state.ui?.customer?.selectedCustomerId || state.data.order?.customerId;
                const customer = findCustomer(customers, customerId);
                if(!customer) return;
                ctx.setState(s=>({
                  ...s,
                  ui:{
                    ...(s.ui || {}),
                    customer:{
                      ...(s.ui?.customer || {}),
                      mode:'create',
                      keypad:'',
                      form:{
                        id: customer.id,
                        name: customer.name,
                        phones: (customer.phones || []).slice(),
                        addresses: (customer.addresses || []).map(address=> ({ ...address }))
                      }
                    }
                  }
                }));
              }
            },
            'pos.customer.form.reset':{
              on:['click'],
              gkeys:['pos:customer:form:reset'],
              handler:(e,ctx)=>{
                ctx.setState(s=>({
                  ...s,
                  ui:{ ...(s.ui || {}), customer:{ ...(s.ui?.customer || {}), form:createEmptyCustomerForm(), keypad:'' } }
                }));
              }
            },
            'pos.customer.form.name':{
              on:['input','change'],
              gkeys:['pos:customer:form:name'],
              handler:(e,ctx)=>{
                const value = e.target.value || '';
                ctx.setState(s=>{
                  const current = s.ui?.customer || {};
                  const form = current.form ? { ...current.form } : createEmptyCustomerForm();
                  form.name = value;
                  return {
                    ...s,
                    ui:{ ...(s.ui || {}), customer:{ ...current, form } }
                  };
                });
              }
            },
            'pos.customer.form.phone':{
              on:['input','change'],
              gkeys:['pos:customer:form:phone'],
              handler:(e,ctx)=>{
                const index = Number(e.target.getAttribute('data-index')||0);
                const value = (e.target.value || '').replace(/[^0-9+]/g,'');
                ctx.setState(s=>{
                  const current = s.ui?.customer || {};
                  const form = current.form ? { ...current.form } : createEmptyCustomerForm();
                  const phones = Array.isArray(form.phones) ? form.phones.slice() : [];
                  while(phones.length <= index) phones.push('');
                  phones[index] = value;
                  form.phones = phones;
                  return {
                    ...s,
                    ui:{ ...(s.ui || {}), customer:{ ...current, form } }
                  };
                });
              }
            },
            'pos.customer.form.phone.add':{
              on:['click'],
              gkeys:['pos:customer:form:phone:add'],
              handler:(e,ctx)=>{
                ctx.setState(s=>{
                  const current = s.ui?.customer || {};
                  const form = current.form ? { ...current.form } : createEmptyCustomerForm();
                  const phones = Array.isArray(form.phones) ? form.phones.slice() : [];
                  phones.push('');
                  form.phones = phones;
                  return {
                    ...s,
                    ui:{ ...(s.ui || {}), customer:{ ...current, form } }
                  };
                });
              }
            },
            'pos.customer.form.phone.remove':{
              on:['click'],
              gkeys:['pos:customer:form:phone:remove'],
              handler:(e,ctx)=>{
                const index = Number(e.target.getAttribute('data-index')||0);
                ctx.setState(s=>{
                  const current = s.ui?.customer || {};
                  const form = current.form ? { ...current.form } : createEmptyCustomerForm();
                  let phones = Array.isArray(form.phones) ? form.phones.slice() : [];
                  if(phones.length <= 1) return s;
                  phones = phones.filter((_,i)=> i !== index);
                  form.phones = phones.length ? phones : [''];
                  return {
                    ...s,
                    ui:{ ...(s.ui || {}), customer:{ ...current, form } }
                  };
                });
              }
            },
            'pos.customer.form.address.add':{
              on:['click'],
              gkeys:['pos:customer:form:address:add'],
              handler:(e,ctx)=>{
                ctx.setState(s=>{
                  const current = s.ui?.customer || {};
                  const form = current.form ? { ...current.form } : createEmptyCustomerForm();
                  const addresses = Array.isArray(form.addresses) ? form.addresses.slice() : [];
                  addresses.push({ id:null, title:'', areaId: CAIRO_DISTRICTS[0]?.id || '', line:'', notes:'' });
                  form.addresses = addresses;
                  return {
                    ...s,
                    ui:{ ...(s.ui || {}), customer:{ ...current, form } }
                  };
                });
              }
            },
            'pos.customer.form.address.remove':{
              on:['click'],
              gkeys:['pos:customer:form:address:remove'],
              handler:(e,ctx)=>{
                const index = Number(e.target.getAttribute('data-index')||0);
                ctx.setState(s=>{
                  const current = s.ui?.customer || {};
                  const form = current.form ? { ...current.form } : createEmptyCustomerForm();
                  let addresses = Array.isArray(form.addresses) ? form.addresses.slice() : [];
                  if(addresses.length <= 1) return s;
                  addresses = addresses.filter((_,i)=> i !== index);
                  form.addresses = addresses.length ? addresses : [{ id:null, title:'', areaId: CAIRO_DISTRICTS[0]?.id || '', line:'', notes:'' }];
                  return {
                    ...s,
                    ui:{ ...(s.ui || {}), customer:{ ...current, form } }
                  };
                });
              }
            },
            'pos.customer.form.address:title':{
              on:['input','change'],
              gkeys:['pos:customer:form:address:title'],
              handler:(e,ctx)=>{
                const index = Number(e.target.getAttribute('data-index')||0);
                const value = e.target.value || '';
                ctx.setState(s=>{
                  const current = s.ui?.customer || {};
                  const form = current.form ? { ...current.form } : createEmptyCustomerForm();
                  const addresses = Array.isArray(form.addresses) ? form.addresses.slice() : [];
                  while(addresses.length <= index) addresses.push({ id:null, title:'', areaId: CAIRO_DISTRICTS[0]?.id || '', line:'', notes:'' });
                  addresses[index] = { ...(addresses[index] || {}), title:value };
                  form.addresses = addresses;
                  return {
                    ...s,
                    ui:{ ...(s.ui || {}), customer:{ ...current, form } }
                  };
                });
              }
            },
            'pos.customer.form.address:area':{
              on:['change'],
              gkeys:['pos:customer:form:address:area'],
              handler:(e,ctx)=>{
                const index = Number(e.target.getAttribute('data-index')||0);
                const value = e.target.value || '';
                ctx.setState(s=>{
                  const current = s.ui?.customer || {};
                  const form = current.form ? { ...current.form } : createEmptyCustomerForm();
                  const addresses = Array.isArray(form.addresses) ? form.addresses.slice() : [];
                  while(addresses.length <= index) addresses.push({ id:null, title:'', areaId: CAIRO_DISTRICTS[0]?.id || '', line:'', notes:'' });
                  addresses[index] = { ...(addresses[index] || {}), areaId:value };
                  form.addresses = addresses;
                  return {
                    ...s,
                    ui:{ ...(s.ui || {}), customer:{ ...current, form } }
                  };
                });
              }
            },
            'pos.customer.form.address:line':{
              on:['input','change'],
              gkeys:['pos:customer:form:address:line'],
              handler:(e,ctx)=>{
                const index = Number(e.target.getAttribute('data-index')||0);
                const value = e.target.value || '';
                ctx.setState(s=>{
                  const current = s.ui?.customer || {};
                  const form = current.form ? { ...current.form } : createEmptyCustomerForm();
                  const addresses = Array.isArray(form.addresses) ? form.addresses.slice() : [];
                  while(addresses.length <= index) addresses.push({ id:null, title:'', areaId: CAIRO_DISTRICTS[0]?.id || '', line:'', notes:'' });
                  addresses[index] = { ...(addresses[index] || {}), line:value };
                  form.addresses = addresses;
                  return {
                    ...s,
                    ui:{ ...(s.ui || {}), customer:{ ...current, form } }
                  };
                });
              }
            },
            'pos.customer.form.address:notes':{
              on:['input','change'],
              gkeys:['pos:customer:form:address:notes'],
              handler:(e,ctx)=>{
                const index = Number(e.target.getAttribute('data-index')||0);
                const value = e.target.value || '';
                ctx.setState(s=>{
                  const current = s.ui?.customer || {};
                  const form = current.form ? { ...current.form } : createEmptyCustomerForm();
                  const addresses = Array.isArray(form.addresses) ? form.addresses.slice() : [];
                  while(addresses.length <= index) addresses.push({ id:null, title:'', areaId: CAIRO_DISTRICTS[0]?.id || '', line:'', notes:'' });
                  addresses[index] = { ...(addresses[index] || {}), notes:value };
                  form.addresses = addresses;
                  return {
                    ...s,
                    ui:{ ...(s.ui || {}), customer:{ ...current, form } }
                  };
                });
              }
            },
            'pos.customer.form.keypad.confirm':{
              on:['click'],
              gkeys:['pos:customer:form:keypad:confirm'],
              handler:(e,ctx)=>{
                ctx.setState(s=>{
                  const current = s.ui?.customer || {};
                  const digits = (current.keypad || '').trim();
                  if(!digits) return s;
                  const form = current.form ? { ...current.form } : createEmptyCustomerForm();
                  const phones = Array.isArray(form.phones) ? form.phones.slice() : [];
                  if(phones.length && !phones[phones.length - 1]){
                    phones[phones.length - 1] = digits;
                  } else {
                    phones.push(digits);
                  }
                  form.phones = phones;
                  return {
                    ...s,
                    ui:{ ...(s.ui || {}), customer:{ ...current, form, keypad:'' } }
                  };
                });
              }
            },
            'pos.customer.save':{
              on:['click'],
              gkeys:['pos:customer:save'],
              handler:(e,ctx)=>{
                const state = ctx.getState();
                const t = getTexts(state);
                const form = state.ui?.customer?.form || createEmptyCustomerForm();
                const name = (form.name || '').trim();
                const phones = (form.phones || []).map(phone=> String(phone || '').trim()).filter(Boolean);
                if(!name || !phones.length){
                  UI.pushToast(ctx, { title:t.toast.customer_form_invalid, icon:'⚠️' });
                  return;
                }
                const addresses = (form.addresses || []).map((address, idx)=>({
                  id: address.id || `ADDR-${Date.now().toString(36)}-${idx}`,
                  title: address.title || '',
                  areaId: address.areaId || CAIRO_DISTRICTS[0]?.id || '',
                  line: address.line || '',
                  notes: address.notes || ''
                }));
                const customerId = form.id || `CUST-${Date.now().toString(36).toUpperCase()}`;
                ctx.setState(s=>{
                  const customers = Array.isArray(s.data.customers) ? s.data.customers.slice() : [];
                  const index = customers.findIndex(customer=> customer.id === customerId);
                  const payload = { id: customerId, name, phones, addresses };
                  if(index >= 0){
                    customers[index] = payload;
                  } else {
                    customers.push(payload);
                  }
                  const currentOrder = s.data.order || {};
                  let nextOrder = currentOrder;
                  if(currentOrder.customerId && currentOrder.customerId === payload.id){
                    const attachedAddress = payload.addresses.find(address=> address.id === currentOrder.customerAddressId) || payload.addresses[0] || null;
                    nextOrder = {
                      ...currentOrder,
                      customerName: payload.name,
                      customerPhone: payload.phones[0] || '',
                      customerAddressId: attachedAddress?.id || null,
                      customerAddress: attachedAddress?.line || attachedAddress?.title || '',
                      customerAreaId: attachedAddress?.areaId || null
                    };
                  }
                  return {
                    ...s,
                    data:{ ...(s.data || {}), customers, order: nextOrder },
                    ui:{
                      ...(s.ui || {}),
                      customer:{
                        ...(s.ui?.customer || {}),
                        mode:'search',
                        form:createEmptyCustomerForm(),
                        keypad:'',
                        selectedCustomerId: payload.id,
                        selectedAddressId: nextOrder.customerAddressId || payload.addresses?.[0]?.id || null
                      }
                    }
                  };
                });
                UI.pushToast(ctx, { title:t.toast.customer_saved, icon:'💾' });
              }
            },
            'pos.order.nav.prev':{
              on:['click'],
              gkeys:['pos:order:nav:prev'],
              handler:(e,ctx)=>{
                const state = ctx.getState();
                const history = state.data.ordersHistory || [];
                if(!history.length) return;
                const currentId = state.data.order?.id;
                const index = history.findIndex(entry=> entry.id === currentId);
                if(index <= 0) return;
                const target = history[index - 1];
                if(target) activateOrder(ctx, target, { hideOrderNavPad:true, resetOrderNavValue:true });
              }
            },
            'pos.order.nav.next':{
              on:['click'],
              gkeys:['pos:order:nav:next'],
              handler:(e,ctx)=>{
                const state = ctx.getState();
                const history = state.data.ordersHistory || [];
                if(!history.length) return;
                const currentId = state.data.order?.id;
                const index = history.findIndex(entry=> entry.id === currentId);
                if(index < 0 || index >= history.length - 1) return;
                const target = history[index + 1];
                if(target) activateOrder(ctx, target, { hideOrderNavPad:true, resetOrderNavValue:true });
              }
            },
            'pos.order.nav.pad':{
              on:['click'],
              gkeys:['pos:order:nav:pad'],
              handler:(e,ctx)=>{
                ctx.setState(s=>({
                  ...s,
                  ui:{ ...(s.ui || {}), orderNav:{ ...(s.ui?.orderNav || {}), showPad:true } }
                }));
              }
            },
            'pos.order.nav.close':{
              on:['click'],
              gkeys:['pos:order:nav:close'],
              handler:(e,ctx)=>{
                ctx.setState(s=>({
                  ...s,
                  ui:{ ...(s.ui || {}), orderNav:{ ...(s.ui?.orderNav || {}), showPad:false } }
                }));
              }
            },
            'pos.order.nav.input':{
              on:['input','change'],
              gkeys:['pos:order:nav:input'],
              handler:(e,ctx)=>{
                const value = e.target.value || '';
                ctx.setState(s=>({
                  ...s,
                  ui:{ ...(s.ui || {}), orderNav:{ ...(s.ui?.orderNav || {}), value } }
                }));
              }
            },
            'pos.order.nav.confirm':{
              on:['click'],
              gkeys:['pos:order:nav:confirm'],
              handler:(e,ctx)=>{
                const state = ctx.getState();
                const t = getTexts(state);
                const value = (state.ui?.orderNav?.value || '').trim();
                const history = state.data.ordersHistory || [];
                if(!value){
                  ctx.setState(s=>({
                    ...s,
                    ui:{ ...(s.ui || {}), orderNav:{ ...(s.ui?.orderNav || {}), showPad:false } }
                  }));
                  return;
                }
                const normalized = value.toLowerCase();
                let target = history.find(entry=> String(entry.id).toLowerCase() === normalized);
                if(!target && value.includes('-')){
                  const lastSegment = value.split('-').pop();
                  const numericPart = parseInt(lastSegment, 10);
                  if(!Number.isNaN(numericPart)){
                    target = history.find(entry=>{
                      const parts = String(entry.id).split('-');
                      const entrySegment = parts[parts.length-1];
                      const entryNumber = parseInt(entrySegment, 10);
                      return entryNumber === numericPart;
                    });
                  }
                }
                if(!target){
                  const seq = parseInt(value, 10);
                  if(!Number.isNaN(seq)){
                    target = history.find(entry=> (entry.seq || history.indexOf(entry) + 1) === seq);
                  }
                }
                if(!target){
                  UI.pushToast(ctx, { title:t.toast.order_nav_not_found, icon:'❓' });
                  return;
                }
                activateOrder(ctx, target, { hideOrderNavPad:true, resetOrderNavValue:true });
              }
            },
            'pos.order.print':{
              on:['click'],
              gkeys:['pos:order:print'],
              handler:(e,ctx)=>{
                ctx.setState(s=>({
                  ...s,
                  ui:{ ...(s.ui || {}), modals:{ ...(s.ui?.modals || {}), print:true }, print:{ ...(s.ui?.print || {}), docType:s.data.print?.docType || 'customer', size:s.data.print?.size || 'thermal_80' } }
                }));
              }
            },
            'pos.order.export':{
              on:['click'],
              gkeys:['pos:order:export'],
              handler:(e,ctx)=>{
                const state = ctx.getState();
                const t = getTexts(state);
                const docType = state.ui?.print?.docType || state.data.print?.docType || 'customer';
                const profile = state.data.print?.profiles?.[docType] || {};
                const size = state.ui?.print?.size || profile.size || state.data.print?.size || 'thermal_80';
                if(typeof window === 'undefined'){
                  UI.pushToast(ctx, { title:t.toast.pdf_exported, icon:'📄' });
                  return;
                }
                const html = renderPrintableHTML(state, docType, size);
                const popup = window.open('', '_blank', 'width=900,height=1200');
                if(!popup){
                  UI.pushToast(ctx, { title:t.toast.browser_popup_blocked, icon:'⚠️' });
                  return;
                }
                try{
                  popup.document.open();
                  popup.document.write(html);
                  popup.document.close();
                  if(typeof popup.focus === 'function') popup.focus();
                } catch(err){
                  console.error('PDF export failed', err);
                }
                UI.pushToast(ctx, { title:t.toast.pdf_exported, icon:'📄' });
              }
            },
            'pos.print.size':{
              on:['click'],
              gkeys:['pos:print:size'],
              handler:(e,ctx)=>{
                const btn = e.target.closest('[data-print-size]');
                if(!btn) return;
                const size = btn.getAttribute('data-print-size') || 'thermal_80';
                const state = ctx.getState();
                const docType = state.ui?.print?.docType || state.data.print?.docType || 'customer';
                ctx.setState(s=>({
                  ...s,
                  data:{
                    ...s.data,
                    print:(()=>{
                      const current = { ...(s.data.print || {}) };
                      current.size = size;
                      const profiles = { ...(current.profiles || {}) };
                      const profile = { ...(profiles[docType] || {}) };
                      profile.size = size;
                      profiles[docType] = profile;
                      current.profiles = profiles;
                      return current;
                    })()
                  },
                  ui:{ ...(s.ui || {}), print:{ ...(s.ui?.print || {}), size } }
                }));
                const t = getTexts(ctx.getState());
                UI.pushToast(ctx, { title:t.toast.print_size_switched, icon:'🖨️' });
              }
            },
            'pos.print.doc':{
              on:['click'],
              gkeys:['pos:print:doc'],
              handler:(e,ctx)=>{
                const btn = e.target.closest('[data-doc-type]');
                if(!btn) return;
                const doc = btn.getAttribute('data-doc-type') || 'customer';
                ctx.setState(s=>({
                  ...s,
                  data:{ ...(s.data || {}), print:{ ...(s.data.print || {}), docType:doc } },
                  ui:{ ...(s.ui || {}), print:{ ...(s.ui?.print || {}), docType:doc } }
                }));
              }
            },
            'pos.print.printer-select':{
              on:['change'],
              gkeys:['pos:print:printer-select'],
              handler:(e,ctx)=>{
                const select = e.target.closest('select');
                if(!select) return;
                const field = select.getAttribute('data-print-field');
                if(!field) return;
                const value = select.value || '';
                const state = ctx.getState();
                const docType = state.ui?.print?.docType || state.data.print?.docType || 'customer';
                ctx.setState(s=>{
                  const printState = { ...(s.data.print || {}) };
                  const profiles = { ...(printState.profiles || {}) };
                  const profile = { ...(profiles[docType] || {}) };
                  profile[field] = value;
                  profiles[docType] = profile;
                  printState.profiles = profiles;
                  return {
                    ...s,
                    data:{ ...(s.data || {}), print: printState }
                  };
                });
              }
            },
            'pos.print.advanced-toggle':{
              on:['click'],
              gkeys:['pos:print:advanced-toggle'],
              handler:(e,ctx)=>{
                ctx.setState(s=>({
                  ...s,
                  ui:{ ...(s.ui || {}), print:{ ...(s.ui?.print || {}), showAdvanced: !s.ui?.print?.showAdvanced } }
                }));
              }
            },
            'pos.print.manage-toggle':{
              on:['click'],
              gkeys:['pos:print:manage-toggle'],
              handler:(e,ctx)=>{
                ctx.setState(s=>({
                  ...s,
                  ui:{ ...(s.ui || {}), print:{ ...(s.ui?.print || {}), managePrinters: !s.ui?.print?.managePrinters } }
                }));
              }
            },
            'pos.print.preview-expand':{
              on:['click'],
              gkeys:['pos:print:preview-expand'],
              handler:(e,ctx)=>{
                ctx.setState(s=>({
                  ...s,
                  ui:{ ...(s.ui || {}), print:{ ...(s.ui?.print || {}), previewExpanded: !s.ui?.print?.previewExpanded } }
                }));
              }
            },
            'pos.print.manage-input':{
              on:['input','change'],
              gkeys:['pos:print:manage-input'],
              handler:(e,ctx)=>{
                const value = e.target.value || '';
                ctx.setState(s=>({
                  ...s,
                  ui:{ ...(s.ui || {}), print:{ ...(s.ui?.print || {}), newPrinterName:value } }
                }));
              }
            },
            'pos.print.manage-add':{
              on:['click'],
              gkeys:['pos:print:manage-add'],
              handler:(e,ctx)=>{
                const state = ctx.getState();
                const t = getTexts(state);
                const rawName = (state.ui?.print?.newPrinterName || '').trim();
                if(!rawName){
                  UI.pushToast(ctx, { title:t.toast.printer_name_required, icon:'⚠️' });
                  return;
                }
                const existing = Array.isArray(state.data.print?.availablePrinters) ? state.data.print.availablePrinters : [];
                const normalized = rawName.toLowerCase();
                if(existing.some(item=> (item.label || item.id || '').toLowerCase() === normalized)){
                  UI.pushToast(ctx, { title:t.toast.printer_exists, icon:'ℹ️' });
                  return;
                }
                const sanitizedIdBase = rawName.replace(/\s+/g, '-').replace(/[^\w\-]/g, '');
                let id = sanitizedIdBase ? sanitizedIdBase.slice(0, 64) : `printer-${Date.now()}`;
                if(existing.some(item=> item.id === id)){
                  id = `${id}-${Date.now()}`;
                }
                ctx.setState(s=>{
                  const printers = Array.isArray(s.data.print?.availablePrinters) ? s.data.print.availablePrinters.slice() : [];
                  printers.push({ id, label: rawName });
                  const printState = { ...(s.data.print || {}), availablePrinters: printers };
                  return {
                    ...s,
                    data:{ ...(s.data || {}), print: printState },
                    ui:{ ...(s.ui || {}), print:{ ...(s.ui?.print || {}), newPrinterName:'' } }
                  };
                });
                UI.pushToast(ctx, { title:t.toast.printer_added, icon:'🖨️' });
              }
            },
            'pos.print.manage-remove':{
              on:['click'],
              gkeys:['pos:print:manage-remove'],
              handler:(e,ctx)=>{
                const btn = e.target.closest('[data-printer-id]');
                if(!btn) return;
                const printerId = btn.getAttribute('data-printer-id');
                ctx.setState(s=>{
                  const current = { ...(s.data.print || {}) };
                  const printers = Array.isArray(current.availablePrinters) ? current.availablePrinters.filter(item=> item.id !== printerId) : [];
                  const profiles = { ...(current.profiles || {}) };
                  Object.keys(profiles).forEach(key=>{
                    const profile = { ...(profiles[key] || {}) };
                    ['defaultPrinter','insidePrinter','outsidePrinter'].forEach(field=>{
                      if(profile[field] === printerId) profile[field] = '';
                    });
                    profiles[key] = profile;
                  });
                  current.availablePrinters = printers;
                  current.profiles = profiles;
                  return {
                    ...s,
                    data:{ ...(s.data || {}), print: current }
                  };
                });
                const t = getTexts(ctx.getState());
                UI.pushToast(ctx, { title:t.toast.printer_removed, icon:'🗑️' });
              }
            },
            'pos.print.profile-field':{
              on:['input','change'],
              gkeys:['pos:print:profile-field'],
              handler:(e,ctx)=>{
                const field = e.target.getAttribute('data-print-field');
                if(!field) return;
                const rawValue = e.target.value || '';
                const state = ctx.getState();
                const docType = state.ui?.print?.docType || state.data.print?.docType || 'customer';
                ctx.setState(s=>{
                  const profiles = { ...(s.data.print?.profiles || {}) };
                  const profile = { ...(profiles[docType] || {}) };
                  if(field === 'copies'){
                    const numeric = parseInt(rawValue, 10);
                    profile[field] = Math.max(1, Number.isFinite(numeric) ? numeric : 1);
                  } else {
                    profile[field] = rawValue;
                  }
                  profiles[docType] = profile;
                  return {
                    ...s,
                    data:{ ...(s.data || {}), print:{ ...(s.data.print || {}), profiles } }
                  };
                });
              }
            },
            'pos.print.toggle':{
              on:['click'],
              gkeys:['pos:print:toggle'],
              handler:(e,ctx)=>{
                const btn = e.target.closest('[data-print-toggle]');
                if(!btn) return;
                const key = btn.getAttribute('data-print-toggle');
                const state = ctx.getState();
                const docType = state.ui?.print?.docType || state.data.print?.docType || 'customer';
                ctx.setState(s=>{
                  const profiles = { ...(s.data.print?.profiles || {}) };
                  const profile = { ...(profiles[docType] || {}) };
                  profile[key] = !profile[key];
                  profiles[docType] = profile;
                  return {
                    ...s,
                    data:{ ...(s.data || {}), print:{ ...(s.data.print || {}), profiles } }
                  };
                });
              }
            },
            'pos.print.save':{
              on:['click'],
              gkeys:['pos:print:save'],
              handler:(e,ctx)=>{
                const t = getTexts(ctx.getState());
                UI.pushToast(ctx, { title:t.toast.print_profile_saved, icon:'💾' });
                ctx.setState(s=>({
                  ...s,
                  ui:{ ...(s.ui || {}), modals:{ ...(s.ui?.modals || {}), print:false } }
                }));
              }
            },
            'pos.print.send':{
              on:['click'],
              gkeys:['pos:print:send'],
              handler:(e,ctx)=>{
                const t = getTexts(ctx.getState());
                UI.pushToast(ctx, { title:t.toast.print_sent, icon:'🖨️' });
                ctx.setState(s=>({
                  ...s,
                  ui:{ ...(s.ui || {}), modals:{ ...(s.ui?.modals || {}), print:false } }
                }));
              }
            },
            'pos.print.browser':{
              on:['click'],
              gkeys:['pos:print:browser'],
              handler:(e,ctx)=>{
                const state = ctx.getState();
                const t = getTexts(state);
                if(typeof window === 'undefined') return;
                const docType = state.ui?.print?.docType || state.data.print?.docType || 'customer';
                const profile = state.data.print?.profiles?.[docType] || {};
                const size = state.ui?.print?.size || profile.size || state.data.print?.size || 'thermal_80';
                const html = renderPrintableHTML(state, docType, size);
                const popup = window.open('', '_blank', 'width=960,height=1200');
                if(!popup){
                  UI.pushToast(ctx, { title:t.toast.browser_popup_blocked, icon:'⚠️' });
                  return;
                }
                try{
                  popup.document.open();
                  popup.document.write(html);
                  popup.document.close();
                  if(typeof popup.focus === 'function') popup.focus();
                } catch(err){
                  console.error('Browser print failed', err);
                }
                UI.pushToast(ctx, { title:t.toast.browser_print_opened, icon:'🖨️' });
              }
            },
            'pos.reservations.open':{
              on:['click'],
              gkeys:['pos:reservations:open'],
              handler:(e,ctx)=>{
                ctx.setState(s=>({
                  ...s,
                  ui:{ ...(s.ui || {}), reservations:{ ...(s.ui?.reservations || {}), editing:null, form:null }, modals:{ ...(s.ui?.modals || {}), reservations:true } }
                }));
              }
            },
            'pos.reservations.new':{
              on:['click'],
              gkeys:['pos:reservations:new'],
              handler:(e,ctx)=>{
                ctx.setState(s=>({
                  ...s,
                  ui:{
                    ...(s.ui || {}),
                    reservations:{
                      ...(s.ui?.reservations || {}),
                      editing:'new',
                      form:{ id:null, customerName:'', phone:'', partySize:2, scheduledAt:Date.now(), holdUntil:Date.now()+3600000, tableIds:[], note:'' }
                    }
                  }
                }));
              }
            },
            'pos.reservations.range':{
              on:['click'],
              gkeys:['pos:reservations:range'],
              handler:(e,ctx)=>{
                const btn = e.target.closest('[data-reservation-range]');
                if(!btn) return;
                const range = btn.getAttribute('data-reservation-range') || 'today';
                ctx.setState(s=>({
                  ...s,
                  ui:{ ...(s.ui || {}), reservations:{ ...(s.ui?.reservations || {}), filter:range } }
                }));
              }
            },
            'pos.reservations.status':{
              on:['click'],
              gkeys:['pos:reservations:status'],
              handler:(e,ctx)=>{
                const btn = e.target.closest('[data-reservation-status]');
                if(!btn) return;
                const status = btn.getAttribute('data-reservation-status') || 'all';
                ctx.setState(s=>({
                  ...s,
                  ui:{ ...(s.ui || {}), reservations:{ ...(s.ui?.reservations || {}), status } }
                }));
              }
            },
            'pos.reservations.form':{
              on:['input','change'],
              gkeys:['pos:reservations:form'],
              handler:(e,ctx)=>{
                const field = e.target.getAttribute('data-field');
                if(!field) return;
                const valueRaw = e.target.value;
                ctx.setState(s=>{
                  const form = { ...(s.ui?.reservations?.form || {}) };
                  let value = valueRaw;
                  if(field === 'partySize') value = parseInt(valueRaw || '0', 10) || 0;
                  if(field === 'scheduledAt' || field === 'holdUntil') value = valueRaw ? new Date(valueRaw).getTime() : null;
                  form[field] = value;
                  return { ...s, ui:{ ...(s.ui || {}), reservations:{ ...(s.ui?.reservations || {}), form } } };
                });
              }
            },
            'pos.reservations.form:table':{
              on:['click'],
              gkeys:['pos:reservations:form:table'],
              handler:(e,ctx)=>{
                const btn = e.target.closest('[data-table-id]');
                if(!btn) return;
                const tableId = btn.getAttribute('data-table-id');
                ctx.setState(s=>{
                  const form = { ...(s.ui?.reservations?.form || { tableIds:[] }) };
                  const set = new Set(form.tableIds || []);
                  if(set.has(tableId)) set.delete(tableId); else set.add(tableId);
                  form.tableIds = Array.from(set);
                  return { ...s, ui:{ ...(s.ui || {}), reservations:{ ...(s.ui?.reservations || {}), form } } };
                });
              }
            },
            'pos.reservations.cancel-edit':{
              on:['click'],
              gkeys:['pos:reservations:cancel-edit'],
              handler:(e,ctx)=>{
                ctx.setState(s=>({
                  ...s,
                  ui:{ ...(s.ui || {}), reservations:{ ...(s.ui?.reservations || {}), editing:null, form:null } }
                }));
              }
            },
            'pos.reservations.save':{
              on:['click'],
              gkeys:['pos:reservations:save'],
              handler:(e,ctx)=>{
                const state = ctx.getState();
                const t = getTexts(state);
                const form = state.ui?.reservations?.form;
                if(!form) return;
                if(!form.tableIds || !form.tableIds.length){
                  UI.pushToast(ctx, { title:t.toast.table_name_required, message:t.ui.reservations_tables_required, icon:'⚠️' });
                  return;
                }
                const tables = state.data.tables || [];
                for(const id of form.tableIds){
                  const table = tables.find(tbl=> tbl.id === id);
                  if(table && table.state === 'maintenance'){
                    UI.pushToast(ctx, { title:t.toast.table_state_updated, message:t.ui.reservations_conflict_maintenance, icon:'🛠️' });
                    return;
                  }
                }
                const reservations = state.data.reservations || [];
                const windowMs = 90 * 60 * 1000;
                const conflicts = reservations.some(res=>{
                  if(res.id === form.id) return false;
                  if(['cancelled','completed','no-show'].includes(res.status)) return false;
                  if(!res.tableIds?.some(id=> form.tableIds.includes(id))) return false;
                  return Math.abs((res.scheduledAt || 0) - (form.scheduledAt || Date.now())) < windowMs;
                });
                if(conflicts){
                  UI.pushToast(ctx, { title:t.toast.table_locked_other, message:t.ui.reservations_conflict, icon:'⚠️' });
                  return;
                }
                const tableLocks = state.data.tableLocks || [];
                const lockConflict = tableLocks.some(lock=> lock.active && form.tableIds.includes(lock.tableId) && lock.orderId && lock.orderId !== state.data.order?.id);
                if(lockConflict){
                  UI.pushToast(ctx, { title:t.toast.table_locked_other, message:t.ui.reservations_conflict_lock, icon:'⚠️' });
                  return;
                }
                ctx.setState(s=>{
                  const reservations = s.data.reservations || [];
                  const isEdit = !!form.id;
                  const reservationId = form.id || `res-${Date.now().toString(36)}`;
                  const payload = { id:reservationId, customerName:form.customerName, phone:form.phone, partySize:form.partySize, scheduledAt:form.scheduledAt || Date.now(), holdUntil:form.holdUntil || null, tableIds:form.tableIds.slice(), status: form.status || 'booked', note:form.note || '', createdAt: form.createdAt || Date.now() };
                  const nextReservations = isEdit ? reservations.map(res=> res.id === reservationId ? payload : res) : reservations.concat(payload);
                  return {
                    ...s,
                    data:{ ...(s.data || {}), reservations: nextReservations },
                    ui:{ ...(s.ui || {}), reservations:{ ...(s.ui?.reservations || {}), editing:null, form:null } }
                  };
                });
                UI.pushToast(ctx, { title: form.id ? t.toast.reservation_updated : t.toast.reservation_created, icon:'📅' });
              }
            },
            'pos.reservations.edit':{
              on:['click'],
              gkeys:['pos:reservations:edit'],
              handler:(e,ctx)=>{
                const btn = e.target.closest('[data-reservation-id]');
                if(!btn) return;
                const resId = btn.getAttribute('data-reservation-id');
                const state = ctx.getState();
                const reservation = (state.data.reservations || []).find(res=> res.id === resId);
                if(!reservation) return;
                ctx.setState(s=>({
                  ...s,
                  ui:{ ...(s.ui || {}), reservations:{ ...(s.ui?.reservations || {}), editing:resId, form:{ ...reservation } } }
                }));
              }
            },
            'pos.reservations.convert':{
              on:['click'],
              gkeys:['pos:reservations:convert'],
              handler: async (e,ctx)=>{
                const btn = e.target.closest('[data-reservation-id]');
                if(!btn) return;
                const resId = btn.getAttribute('data-reservation-id');
                const state = ctx.getState();
                const t = getTexts(state);
                const reservation = (state.data.reservations || []).find(res=> res.id === resId);
                if(!reservation) return;
                const totals = calculateTotals([], state.data.settings || {}, 'dine_in', { orderDiscount: null });
                const dineInConfig = getOrderTypeConfig('dine_in');
                const newId = await generateOrderId();
                const newOrder = {
                  id: newId,
                  status:'open',
                  fulfillmentStage:'new',
                  paymentState:'unpaid',
                  type:'dine_in',
                  tableIds: reservation.tableIds.slice(),
                  guests: reservation.partySize,
                  lines:[],
                  notes:[],
                  totals,
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                  allowAdditions: !!dineInConfig.allowsLineAdditions,
                  lockLineEdits:false,
                  isPersisted:false,
                  dirty:false,
                  shiftId: state.data.shift?.current?.id || null,
                  posId: state.data.pos?.id || POS_INFO.id,
                  posLabel: state.data.pos?.label || POS_INFO.label,
                  posNumber: Number.isFinite(Number(state.data.pos?.number)) ? Number(state.data.pos.number) : POS_INFO.number
                };
                ctx.setState(s=>({
                  ...s,
                  data:{
                    ...s.data,
                    ordersQueue:[ newOrder, ...(s.data.ordersQueue || []) ],
                    reservations:(s.data.reservations || []).map(res=> res.id === resId ? { ...res, status:'seated' } : res),
                    tableLocks:[...(s.data.tableLocks || []), ...reservation.tableIds.map(id=> ({ id:`lock-${Date.now().toString(36)}-${id}`, tableId:id, orderId:newOrder.id, lockedBy:s.data.user?.id || 'pos-user', lockedAt:Date.now(), source:'reservation-convert', active:true }))]
                  }
                }));
                UI.pushToast(ctx, { title:t.toast.reservation_converted, icon:'🍽️' });
              }
            },
            'pos.reservations.noshow':{
              on:['click'],
              gkeys:['pos:reservations:noshow'],
              handler:(e,ctx)=>{
                const btn = e.target.closest('[data-reservation-id]');
                if(!btn) return;
                const resId = btn.getAttribute('data-reservation-id');
                const state = ctx.getState();
                const t = getTexts(state);
                ctx.setState(s=>({
                  ...s,
                  data:{ ...(s.data || {}), reservations:(s.data.reservations || []).map(res=> res.id === resId ? { ...res, status:'no-show' } : res) }
                }));
                UI.pushToast(ctx, { title:t.toast.reservation_no_show, icon:'⏰' });
              }
            },
            'pos.reservations.cancel':{
              on:['click'],
              gkeys:['pos:reservations:cancel'],
              handler:(e,ctx)=>{
                const btn = e.target.closest('[data-reservation-id]');
                if(!btn) return;
                const resId = btn.getAttribute('data-reservation-id');
                const state = ctx.getState();
                const t = getTexts(state);
                ctx.setState(s=>({
                  ...s,
                  data:{ ...(s.data || {}), reservations:(s.data.reservations || []).map(res=> res.id === resId ? { ...res, status:'cancelled' } : res) }
                }));
                UI.pushToast(ctx, { title:t.toast.reservation_cancelled, icon:'🚫' });
              }
            },
            'pos.orders.open':{
              on:['click'],
              gkeys:['pos:orders:open'],
              handler: async (e,ctx)=>{
                const state = ctx.getState();
                const t = getTexts(state);
                const defaultOrdersUi = { tab:'all', search:'', sort:{ field:'updatedAt', direction:'desc' } };
                if(posDB.available){
                  try{
                    const orders = await posDB.listOrders({ onlyActive:true });
                    ctx.setState(s=>({
                      ...s,
                      data:{ ...(s.data || {}), ordersQueue: orders },
                      ui:{ ...(s.ui || {}), orders: defaultOrdersUi, modals:{ ...(s.ui?.modals || {}), orders:true } }
                    }));
                    UI.pushToast(ctx, { title:t.toast.orders_loaded, icon:'📥' });
                    return;
                  } catch(error){
                    UI.pushToast(ctx, { title:t.toast.orders_failed, message:String(error), icon:'🛑' });
                  }
                } else {
                  UI.pushToast(ctx, { title:t.toast.indexeddb_missing, icon:'⚠️' });
                }
                ctx.setState(s=>({
                  ...s,
                  ui:{ ...(s.ui || {}), orders: defaultOrdersUi, modals:{ ...(s.ui?.modals || {}), orders:true } }
                }));
              }
            },
            'pos.orders.toggle':{
              on:['click'],
              gkeys:['pos:orders:toggle'],
              handler:(e,ctx)=>{
                ctx.setState(s=>({
                  ...s,
                  ui:{ ...(s.ui || {}), modals:{ ...(s.ui?.modals || {}), orders:false } }
                }));
              }
            },
            'pos.orders.tab':{
              on:['click'],
              gkeys:['pos:orders:tab'],
              handler:(e,ctx)=>{
                const btn = e.target.closest('[data-tab-id]');
                if(!btn) return;
                const tabId = btn.getAttribute('data-tab-id');
                ctx.setState(s=>({
                  ...s,
                  ui:{ ...(s.ui || {}), orders:{ ...(s.ui?.orders || {}), tab: tabId }, modals:{ ...(s.ui?.modals || {}), orders:true } }
                }));
              }
            },
            'pos.orders.search':{
              on:['input'],
              gkeys:['pos:orders:search'],
              handler:(e,ctx)=>{
                const value = e.target.value || '';
                ctx.setState(s=>({
                  ...s,
                  ui:{ ...(s.ui || {}), orders:{ ...(s.ui?.orders || {}), search:value }, modals:{ ...(s.ui?.modals || {}), orders:true } }
                }));
              }
            },
            'pos.orders.sort':{
              on:['click'],
              gkeys:['pos:orders:sort'],
              handler:(e,ctx)=>{
                const btn = e.target.closest('[data-sort-field]');
                if(!btn) return;
                const field = btn.getAttribute('data-sort-field') || 'updatedAt';
                ctx.setState(s=>{
                  const current = (s.ui?.orders?.sort) || { field:'updatedAt', direction:'desc' };
                  const direction = current.field === field && current.direction === 'desc' ? 'asc' : 'desc';
                  return {
                    ...s,
                    ui:{ ...(s.ui || {}), orders:{ ...(s.ui?.orders || {}), sort:{ field, direction } }, modals:{ ...(s.ui?.modals || {}), orders:true } }
                  };
                });
              }
            },
            'pos.orders.refresh':{
              on:['click'],
              gkeys:['pos:orders:refresh'],
              handler: async (e,ctx)=>{
                const state = ctx.getState();
                const t = getTexts(state);
                if(!posDB.available){
                  UI.pushToast(ctx, { title:t.toast.indexeddb_missing, icon:'⚠️' });
                  return;
                }
                try{
                  const orders = await posDB.listOrders({ onlyActive:true });
                  ctx.setState(s=>({
                    ...s,
                    data:{ ...(s.data || {}), ordersQueue: orders }
                  }));
                  UI.pushToast(ctx, { title:t.toast.orders_loaded, icon:'📥' });
                } catch(error){
                  UI.pushToast(ctx, { title:t.toast.orders_failed, message:String(error), icon:'🛑' });
                }
              }
            },
            'pos.orders.viewJobs':{
              on:['click'],
              gkeys:['pos:orders:view-jobs'],
              handler:(e,ctx)=>{
                const btn = e.target.closest('[data-order-id]');
                if(!btn) return;
                const orderId = btn.getAttribute('data-order-id');
                if(!orderId) return;
                ctx.setState(s=>({
                  ...s,
                  ui:{
                    ...(s.ui || {}),
                    modals:{ ...(s.ui?.modals || {}), jobStatus:true },
                    jobStatus:{ orderId }
                  }
                }));
              }
            },
            'pos.orders.open-order':{
              on:['click'],
              gkeys:['pos:orders:open-order'],
              handler: async (e,ctx)=>{
                const btn = e.target.closest('[data-order-id]');
                if(!btn) return;
                const orderId = btn.getAttribute('data-order-id');
                const state = ctx.getState();
                const t = getTexts(state);
                let order = null;
                if(posDB.available){
                  try{
                    order = await posDB.getOrder(orderId);
                  } catch(error){
                    UI.pushToast(ctx, { title:t.toast.orders_failed, message:String(error), icon:'🛑' });
                  }
                }
                if(!order){
                  order = [state.data.order, ...(state.data.ordersQueue || [])].find(ord=> ord && ord.id === orderId);
                }
                if(!order) return;
                activateOrder(ctx, order, { closeOrdersModal:true, resetOrderNavValue:true });
              }
            },
            'pos.tables.open':{
              on:['click'],
              gkeys:['pos:tables:open'],
              handler:(e,ctx)=>{
                const state = ctx.getState();
                const t = getTexts(state);
                const orderType = state?.data?.order?.type;
                if(orderType !== 'dine_in'){
                  UI.pushToast(ctx, { title:t.toast.table_type_required, icon:'ℹ️' });
                  return;
                }
                ctx.setState(s=>({
                  ...s,
                  ui:{
                    ...(s.ui || {}),
                    tables:{ view:'assign', filter:'all', search:'', details:null },
                    modals:{ ...(s.ui?.modals || {}), tables:true }
                  }
                }));
              }
            },
            'pos.tables.view':{
              on:['click'],
              gkeys:['pos:tables:view'],
              handler:(e,ctx)=>{
                const btn = e.target.closest('[data-tables-view]');
                if(!btn) return;
                const view = btn.getAttribute('data-tables-view') || 'assign';
                ctx.setState(s=>({
                  ...s,
                  ui:{ ...(s.ui || {}), tables:{ ...(s.ui?.tables || {}), view } }
                }));
              }
            },
            'pos.tables.filter':{
              on:['click'],
              gkeys:['pos:tables:filter'],
              handler:(e,ctx)=>{
                const btn = e.target.closest('[data-tables-filter]');
                if(!btn) return;
                const filter = btn.getAttribute('data-tables-filter') || 'all';
                ctx.setState(s=>({
                  ...s,
                  ui:{ ...(s.ui || {}), tables:{ ...(s.ui?.tables || {}), filter } }
                }));
              }
            },
            'pos.tables.search':{
              on:['input','change'],
              gkeys:['pos:tables:search'],
              handler:(e,ctx)=>{
                const value = e.target.value || '';
                ctx.setState(s=>({
                  ...s,
                  ui:{ ...(s.ui || {}), tables:{ ...(s.ui?.tables || {}), search:value } }
                }));
              }
            },
            'pos.tables.details':{
              on:['click'],
              gkeys:['pos:tables:details'],
              handler:(e,ctx)=>{
                const btn = e.target.closest('[data-table-id]');
                if(!btn) return;
                const tableId = btn.getAttribute('data-table-id');
                ctx.setState(s=>({
                  ...s,
                  ui:{ ...(s.ui || {}), tables:{ ...(s.ui?.tables || {}), details:tableId } }
                }));
              }
            },
            'pos.tables.details-close':{
              on:['click'],
              gkeys:['pos:tables:details-close'],
              handler:(e,ctx)=>{
                ctx.setState(s=>({
                  ...s,
                  ui:{ ...(s.ui || {}), tables:{ ...(s.ui?.tables || {}), details:null } }
                }));
              }
            },
            'pos.tables.card.tap':{
              on:['click'],
              gkeys:['pos:tables:card:tap'],
              handler:(e,ctx)=>{
                if(e.target.closest('[data-prevent-select="true"]')) return;
                const btn = e.target.closest('[data-table-id]');
                if(!btn) return;
                const tableId = btn.getAttribute('data-table-id');
                const state = ctx.getState();
                const t = getTexts(state);
                const runtimeTables = computeTableRuntime(state);
                const runtime = runtimeTables.find(tbl=> tbl.id === tableId);
                if(!runtime) return;
                if(runtime.state === 'maintenance'){
                  UI.pushToast(ctx, { title:t.toast.table_locked_other, message:t.ui.table_status_maintenance, icon:'🛠️' });
                  return;
                }
                if(runtime.state === 'disactive'){
                  UI.pushToast(ctx, { title:t.toast.table_inactive_assign, icon:'🚫' });
                  return;
                }
                const order = state.data.order || {};
                if(order.type !== 'dine_in'){
                  UI.pushToast(ctx, { title:t.toast.table_assigned, message:t.ui.service_type, icon:'ℹ️' });
                  return;
                }
                const currentTables = new Set(order.tableIds || []);
                const isAssigned = currentTables.has(tableId);
                if(isAssigned){
                  if(!window.confirm(t.ui.table_confirm_release)) return;
                  ctx.setState(s=>{
                    const data = s.data || {};
                    const currentIds = (data.order?.tableIds || []).filter(id=> id !== tableId);
                    const guests = computeGuestsForTables(currentIds, data.tables || []);
                    return {
                      ...s,
                      data:{
                        ...data,
                        tableLocks:(data.tableLocks || []).map(lock=> lock.tableId === tableId && lock.orderId === order.id ? { ...lock, active:false } : lock),
                        order:{ ...(data.order || {}), tableIds: currentIds, guests, updatedAt: Date.now() }
                      }
                    };
                  });
                  UI.pushToast(ctx, { title:t.toast.table_unlocked, icon:'🔓' });
                  return;
                }
                if(runtime.lockState !== 'free' && !runtime.isCurrentOrder){
                  if(!window.confirm(t.toast.table_locked_other)) return;
                }
                if(currentTables.size && !window.confirm(t.ui.table_multi_orders)) return;
                ctx.setState(s=>{
                  const data = s.data || {};
                  const nextIds = Array.from(new Set([...(data.order?.tableIds || []), tableId]));
                  const guests = computeGuestsForTables(nextIds, data.tables || []);
                  return {
                    ...s,
                    data:{
                      ...data,
                      tableLocks:[...(data.tableLocks || []), { id:`lock-${Date.now().toString(36)}`, tableId, orderId: order.id, lockedBy: data.user?.id || 'pos-user', lockedAt: Date.now(), source:'pos', active:true }],
                      order:{ ...(data.order || {}), tableIds: nextIds, guests, updatedAt: Date.now() }
                    }
                  };
                });
                UI.pushToast(ctx, { title:t.toast.table_locked_now, icon:'🔒' });
              }
            },
            'pos.tables.unlock-order':{
              on:['click'],
              gkeys:['pos:tables:unlock-order'],
              handler:(e,ctx)=>{
                const btn = e.target.closest('[data-table-id]');
                if(!btn) return;
                const tableId = btn.getAttribute('data-table-id');
                const orderId = btn.getAttribute('data-order-id');
                const state = ctx.getState();
                const t = getTexts(state);
                ctx.setState(s=>({
                  ...s,
                  data:{
                    ...s.data,
                    tableLocks:(s.data.tableLocks || []).map(lock=> lock.tableId === tableId && lock.orderId === orderId ? { ...lock, active:false } : lock)
                  }
                }));
                UI.pushToast(ctx, { title:t.toast.table_unlock_partial, icon:'🔓' });
              }
            },
            'pos.tables.unlock-all':{
              on:['click'],
              gkeys:['pos:tables:unlock-all'],
              handler:(e,ctx)=>{
                const btn = e.target.closest('[data-table-id]');
                if(!btn) return;
                const tableId = btn.getAttribute('data-table-id');
                ctx.setState(s=>({
                  ...s,
                  data:{
                    ...s.data,
                    tableLocks:(s.data.tableLocks || []).map(lock=> lock.tableId === tableId ? { ...lock, active:false } : lock)
                  }
                }));
              }
            },
            'pos.tables.add':{
              on:['click'],
              gkeys:['pos:tables:add'],
              handler:(e,ctx)=>{
                const state = ctx.getState();
                const t = getTexts(state);
                const nextIndex = (state.data.tables || []).length + 1;
                const defaultName = `${t.ui.tables} ${nextIndex}`;
                const name = window.prompt(t.ui.table_add, defaultName);
                if(!name){
                  UI.pushToast(ctx, { title:t.toast.table_name_required, icon:'⚠️' });
                  return;
                }
                ctx.setState(s=>({
                  ...s,
                  data:{
                    ...s.data,
                    tables:[...(s.data.tables || []), { id:`T${Date.now().toString(36)}`, name, capacity:4, zone:'', state:'active', displayOrder: nextIndex, note:'' }]
                  }
                }));
                UI.pushToast(ctx, { title:t.toast.table_added, icon:'➕' });
              }
            },
            'pos.tables.rename':{
              on:['click'],
              gkeys:['pos:tables:rename'],
              handler:(e,ctx)=>{
                const btn = e.target.closest('[data-table-id]');
                if(!btn) return;
                const tableId = btn.getAttribute('data-table-id');
                const state = ctx.getState();
                const t = getTexts(state);
                const table = (state.data.tables || []).find(tbl=> tbl.id === tableId);
                if(!table) return;
                const nextName = window.prompt(t.ui.table_rename, table.name || table.id);
                if(!nextName){
                  UI.pushToast(ctx, { title:t.toast.table_name_required, icon:'⚠️' });
                  return;
                }
                ctx.setState(s=>({
                  ...s,
                  data:{
                    ...s.data,
                    tables:(s.data.tables || []).map(tbl=> tbl.id === tableId ? { ...tbl, name: nextName } : tbl),
                    auditTrail:[...(s.data.auditTrail || []), { id:`audit-${Date.now().toString(36)}`, userId:s.data.user?.id || 'pos-user', action:'table.rename', refType:'table', refId:tableId, at:Date.now(), meta:{ name:nextName } }]
                  }
                }));
                UI.pushToast(ctx, { title:t.toast.table_updated, icon:'✏️' });
              }
            },
            'pos.tables.capacity':{
              on:['click'],
              gkeys:['pos:tables:capacity'],
              handler:(e,ctx)=>{
                const btn = e.target.closest('[data-table-id]');
                if(!btn) return;
                const tableId = btn.getAttribute('data-table-id');
                const state = ctx.getState();
                const t = getTexts(state);
                const table = (state.data.tables || []).find(tbl=> tbl.id === tableId);
                if(!table) return;
                const input = window.prompt(t.ui.tables_capacity, String(table.capacity || 4));
                if(input == null) return;
                const capacity = parseInt(input, 10);
                if(!Number.isFinite(capacity) || capacity <= 0){
                  UI.pushToast(ctx, { title:t.toast.table_invalid_seats, icon:'⚠️' });
                  return;
                }
                ctx.setState(s=>({
                  ...s,
                  data:{
                    ...s.data,
                    tables:(s.data.tables || []).map(tbl=> tbl.id === tableId ? { ...tbl, capacity } : tbl)
                  }
                }));
                UI.pushToast(ctx, { title:t.toast.table_updated, icon:'👥' });
              }
            },
            'pos.tables.zone':{
              on:['click'],
              gkeys:['pos:tables:zone'],
              handler:(e,ctx)=>{
                const btn = e.target.closest('[data-table-id]');
                if(!btn) return;
                const tableId = btn.getAttribute('data-table-id');
                const state = ctx.getState();
                const table = (state.data.tables || []).find(tbl=> tbl.id === tableId);
                if(!table) return;
                const zone = window.prompt('Zone', table.zone || '');
                if(zone == null) return;
                ctx.setState(s=>({
                  ...s,
                  data:{
                    ...s.data,
                    tables:(s.data.tables || []).map(tbl=> tbl.id === tableId ? { ...tbl, zone } : tbl)
                  }
                }));
              }
            },
            'pos.tables.state':{
              on:['click'],
              gkeys:['pos:tables:state'],
              handler:(e,ctx)=>{
                const btn = e.target.closest('[data-table-id]');
                if(!btn) return;
                const tableId = btn.getAttribute('data-table-id');
                const state = ctx.getState();
                const t = getTexts(state);
                const orderLocks = (state.data.tableLocks || []).filter(lock=> lock.tableId === tableId && lock.active);
                ctx.setState(s=>({
                  ...s,
                  data:{
                    ...s.data,
                    tables:(s.data.tables || []).map(tbl=>{
                      if(tbl.id !== tableId) return tbl;
                      const cycle = ['active','maintenance','disactive'];
                      const currentIndex = cycle.indexOf(tbl.state || 'active');
                      const nextState = cycle[(currentIndex + 1) % cycle.length];
                      if(nextState !== 'active' && orderLocks.length){
                        return tbl;
                      }
                      return { ...tbl, state: nextState };
                    })
                  }
                }));
                UI.pushToast(ctx, { title:t.toast.table_state_updated, icon:'♻️' });
              }
            },
            'pos.tables.remove':{
              on:['click'],
              gkeys:['pos:tables:remove'],
              handler:(e,ctx)=>{
                const btn = e.target.closest('[data-table-id]');
                if(!btn) return;
                const tableId = btn.getAttribute('data-table-id');
                const state = ctx.getState();
                const t = getTexts(state);
                const locks = (state.data.tableLocks || []).filter(lock=> lock.tableId === tableId && lock.active);
                if(locks.length){
                  UI.pushToast(ctx, { title:t.toast.table_has_sessions, icon:'⚠️' });
                  return;
                }
                if(!window.confirm(t.ui.table_confirm_remove)) return;
                ctx.setState(s=>({
                  ...s,
                  data:{
                    ...s.data,
                    tables:(s.data.tables || []).filter(tbl=> tbl.id !== tableId)
                  }
                }));
                UI.pushToast(ctx, { title:t.toast.table_removed, icon:'🗑️' });
              }
            },
            'pos.tables.bulk':{
              on:['click'],
              gkeys:['pos:tables:bulk'],
              handler:(e,ctx)=>{
                const btn = e.target.closest('[data-bulk-action]');
                if(!btn) return;
                const action = btn.getAttribute('data-bulk-action');
                ctx.setState(s=>{
                  const tables = (s.data.tables || []).map(tbl=>{
                    if(action === 'activate') return { ...tbl, state:'active' };
                    if(action === 'maintenance') return { ...tbl, state:'maintenance' };
                    return tbl;
                  });
                  return { ...s, data:{ ...(s.data || {}), tables } };
                });
              }
            },
            'ui.numpad.decimal.key':{
              on:['click'],
              gkeys:['ui:numpad:decimal:key'],
              handler:(e,ctx)=>{
                const btn = e.target.closest('[data-numpad-key]');
                if(!btn || btn.disabled) return;
                const key = btn.getAttribute('data-numpad-key');
                if(!key) return;
                const container = btn.closest('[data-numpad-root]');
                if(!container) return;
                if(key === '.' && container.hasAttribute('data-numpad-no-decimal')) return;
                const input = container.querySelector('[data-numpad-input]');
                if(!input) return;
                let value = input.value || '';
                if(key === '.' && value.includes('.')) return;
                if(value === '' && key === '.') value = '0.';
                else if(value === '0' && key !== '.') value = key;
                else value = `${value}${key}`;
                input.value = value;
                input.dispatchEvent(new Event('input', { bubbles:true }));
                input.dispatchEvent(new Event('change', { bubbles:true }));
              }
            },
            'ui.numpad.decimal.clear':{
              on:['click'],
              gkeys:['ui:numpad:decimal:clear'],
              handler:(e,ctx)=>{
                const btn = e.target.closest('[data-numpad-clear]');
                if(!btn) return;
                const container = btn.closest('[data-numpad-root]');
                if(!container) return;
                const input = container.querySelector('[data-numpad-input]');
                if(!input) return;
                input.value = '';
                input.dispatchEvent(new Event('input', { bubbles:true }));
                input.dispatchEvent(new Event('change', { bubbles:true }));
              }
            },
            'ui.numpad.decimal.backspace':{
              on:['click'],
              gkeys:['ui:numpad:decimal:backspace'],
              handler:(e,ctx)=>{
                const btn = e.target.closest('[data-numpad-backspace]');
                if(!btn) return;
                const container = btn.closest('[data-numpad-root]');
                if(!container) return;
                const input = container.querySelector('[data-numpad-input]');
                if(!input) return;
                const value = input.value || '';
                input.value = value.length ? value.slice(0, -1) : '';
                input.dispatchEvent(new Event('input', { bubbles:true }));
                input.dispatchEvent(new Event('change', { bubbles:true }));
              }
            },
            'ui.numpad.decimal.confirm':{
              on:['click'],
              gkeys:['ui:numpad:decimal:confirm'],
              handler:(e,ctx)=>{
                const btn = e.target.closest('[data-numpad-confirm]');
                if(!btn) return;
                const container = btn.closest('[data-numpad-root]');
                if(!container) return;
                const input = container.querySelector('[data-numpad-input]');
                if(input){
                  input.dispatchEvent(new Event('change', { bubbles:true }));
                }
              }
            },
            'pos.payments.open':{
              on:['click'],
              gkeys:['pos:payments:open'],
              handler:(e,ctx)=>{
                ctx.setState(s=>({
                  ...s,
                  ui:{
                    ...(s.ui || {}),
                    modals:{ ...(s.ui?.modals || {}), payments:true },
                    paymentDraft:{ amount:'', method: s.data.payments?.activeMethod || 'cash' }
                  }
                }));
              }
            },
            'pos.payments.close':{
              on:['click'],
              gkeys:['pos:payments:close','ui:drawer:close'],
              handler:(e,ctx)=>{
                ctx.setState(s=>({
                  ...s,
                  ui:{ ...(s.ui || {}), modals:{ ...(s.ui?.modals || {}), payments:false } }
                }));
              }
            },
            'pos.payments.method':{
              on:['click'],
              gkeys:['pos:payments:method'],
              handler:(e,ctx)=>{
                const btn = e.target.closest('[data-method-id]');
                if(!btn) return;
                const method = btn.getAttribute('data-method-id');
                ctx.setState(s=>({
                  ...s,
                  data:{ ...(s.data || {}), payments:{ ...(s.data.payments || {}), activeMethod: method } },
                  ui:{ ...(s.ui || {}), paymentDraft:{ ...(s.ui?.paymentDraft || {}), method } }
                }));
              }
            },
            'pos.payments.amount':{
              on:['input','change'],
              gkeys:['pos:payments:amount'],
              handler:(e,ctx)=>{
                const value = e.target.value;
                ctx.setState(s=>({
                  ...s,
                  ui:{ ...(s.ui || {}), paymentDraft:{ ...(s.ui?.paymentDraft || {}), amount:value } }
                }));
              }
            },
            'pos.payments.capture':{
              on:['click'],
              gkeys:['pos:payments:capture'],
              handler: async (e,ctx)=>{
                const state = ctx.getState();
                const t = getTexts(state);
                const amount = parseFloat(state.ui?.paymentDraft?.amount);
                if(!amount || amount <= 0){
                  UI.pushToast(ctx, { title:t.toast.amount_required, icon:'⚠️' });
                  return;
                }
                const method = state.data.payments.activeMethod || 'cash';
                const pending = state.ui?.pendingAction;
                let finalizeMode = null;
                let shouldFinalize = false;
                ctx.setState(s=>{
                  const data = s.data || {};
                  const nextSplit = (data.payments?.split || []).concat([{ id:`pm-${Date.now()}`, method, amount: round(amount) }]);
                  const order = data.order || {};
                  const totals = order.totals || {};
                  const paymentSnapshot = summarizePayments(totals, nextSplit);
                  if(pending && pending.orderId === order.id && paymentSnapshot.remaining <= 0){
                    shouldFinalize = true;
                    finalizeMode = pending.mode || 'finalize';
                  }
                  return {
                    ...s,
                    data:{
                      ...data,
                      payments:{
                        ...(data.payments || {}),
                        split: nextSplit
                      },
                      order:{
                        ...order,
                        paymentState: paymentSnapshot.state
                      }
                    },
                    ui:{
                      ...(s.ui || {}),
                      modals:{ ...(s.ui?.modals || {}), payments:false },
                      paymentDraft:{ amount:'', method },
                      pendingAction: (pending && pending.orderId === order.id && paymentSnapshot.remaining <= 0) ? null : pending
                    }
                  };
                });
                UI.pushToast(ctx, { title:t.toast.payment_recorded, icon:'💰' });
                if(shouldFinalize && finalizeMode){
                  await persistOrderFlow(ctx, finalizeMode, { skipPaymentCheck:true });
                }
              }
            },
            'pos.payments.split':{
              on:['click'],
              gkeys:['pos:payments:split'],
              handler:(e,ctx)=>{
                ctx.setState(s=>({
                  ...s,
                  ui:{ ...(s.ui || {}), modals:{ ...(s.ui?.modals || {}), payments:true } }
                }));
              }
            },
            'pos.reports.toggle':{
              on:['click'],
              gkeys:['pos:reports:toggle'],
              handler:(e,ctx)=>{
                ctx.setState(s=>({
                  ...s,
                  ui:{ ...(s.ui || {}), modals:{ ...(s.ui?.modals || {}), reports: !s.ui?.modals?.reports } }
                }));
              }
            },
            'pos.central.diagnostics.open':{
              on:['click'],
              gkeys:['pos:central:diagnostics'],
              handler:(e,ctx)=>{
                ctx.setState(s=>({
                  ...s,
                  ui:{ ...(s.ui || {}), modals:{ ...(s.ui?.modals || {}), diagnostics:true } }
                }));
              }
            },
            'pos.central.diagnostics.close':{
              on:['click'],
              gkeys:['pos:central:diagnostics:close'],
              handler:(e,ctx)=>{
                ctx.setState(s=>({
                  ...s,
                  ui:{ ...(s.ui || {}), modals:{ ...(s.ui?.modals || {}), diagnostics:false } }
                }));
              }
            },
            'pos.central.diagnostics.clear':{
              on:['click'],
              gkeys:['pos:central:diagnostics:clear'],
              handler:(e,ctx)=>{
                clearCentralDiagnostics();
                const t = getTexts(ctx.getState());
                UI.pushToast(ctx, { title:t.ui.central_diag_cleared, icon:'🧹' });
              }
            },
            'pos.indexeddb.sync':{
              on:['click'],
              gkeys:['pos:indexeddb:sync'],
              handler: async (e,ctx)=>{
                const state = ctx.getState();
                const t = getTexts(state);
                if(!posDB.available){
                  UI.pushToast(ctx, { title:t.toast.indexeddb_missing, icon:'⚠️' });
                  return;
                }
                try{
                  UI.pushToast(ctx, { title:t.toast.indexeddb_syncing, icon:'🔄' });
                  const orders = await posDB.listOrders();
                  await posDB.markSync();
                  ctx.setState(s=>({
                    ...s,
                    data:{
                      ...s.data,
                      status:{ ...s.data.status, indexeddb:{ state:'online', lastSync: Date.now() } },
                      reports:{ ...(s.data.reports || {}), ordersCount: orders.length }
                    }
                  }));
                  UI.pushToast(ctx, { title:t.toast.sync_complete, icon:'✅' });
                } catch(error){
                  UI.pushToast(ctx, { title:t.toast.indexeddb_error, message:String(error), icon:'🛑' });
                  ctx.setState(s=>({
                    ...s,
                    data:{
                      ...s.data,
                      status:{ ...s.data.status, indexeddb:{ state:'offline', lastSync: s.data.status?.indexeddb?.lastSync || null } }
                    }
                  }));
                }
              }
            },
            'pos.kds.connect':{
              on:['click'],
              gkeys:['pos:kds:connect'],
              handler:(e,ctx)=>{
                kdsBridge.connect(ctx);
              }
            },
            'pos.theme.toggle':{
              on:['click'],
              gkeys:['pos:theme:toggle'],
              handler:(e,ctx)=>{
                const btn = e.target.closest('[data-theme]');
                if(!btn) return;
                const theme = btn.getAttribute('data-theme');
                ctx.setState(s=>({
                  ...s,
                  env:{ ...(s.env || {}), theme },
                  ui:{ ...(s.ui || {}), settings:{ ...(s.ui?.settings || {}), activeTheme: theme } }
                }));
                const t = getTexts(ctx.getState());
                UI.pushToast(ctx, { title:t.toast.theme_switched, icon: theme === 'dark' ? '🌙' : '☀️' });
              }
            },
            'pos.lang.switch':{
              on:['click'],
              gkeys:['pos:lang:switch'],
              handler:(e,ctx)=>{
                const btn = e.target.closest('[data-lang]');
                if(!btn) return;
                const lang = btn.getAttribute('data-lang');
                ctx.setState(s=>({
                  ...s,
                  env:{ ...(s.env || {}), lang, dir: lang === 'ar' ? 'rtl' : 'ltr' }
                }));
                const t = getTexts(ctx.getState());
                UI.pushToast(ctx, { title:t.toast.lang_switched, icon:'🌐' });
              }
            },
            'pos.session.logout':{
              on:['click'],
              gkeys:['pos:session:logout'],
              handler:(e,ctx)=>{
                const t = getTexts(ctx.getState());
                UI.pushToast(ctx, { title:t.toast.logout_stub, icon:'👋' });
              }
            }
          };
      scope.orders = posOrders;
    }
  };
})(typeof window !== 'undefined' ? window : this);
