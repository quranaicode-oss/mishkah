(function(w){
  const { Core } = w.Mishkah;
  const U = w.Mishkah.utils || {};

  // ====================== 1) IndexedDB (schema v7) ======================
  const DB = new U.IndexedDB('rms-pos', 7, (db, oldV) => {
    if(oldV < 1){ db.createObjectStore('settings',{ keyPath:'id' }) }
    if(oldV < 2){ db.createObjectStore('employees',{ keyPath:'id' }) }
    if(oldV < 3){ db.createObjectStore('tables',{ keyPath:'id' }) }
    if(oldV < 4){ db.createObjectStore('categories',{ keyPath:'id' }); db.createObjectStore('items',{ keyPath:'id' }) }
    if(oldV < 5){ db.createObjectStore('customers',{ keyPath:'phone' }) }
    if(oldV < 6){ const s=db.createObjectStore('shifts',{ keyPath:'id' }); s.createIndex('status','status'); const o=db.createObjectStore('orders',{ keyPath:'id' }); o.createIndex('status','status'); o.createIndex('tableIds','tableIds',{ multiEntry:true }); const p=db.createObjectStore('payments',{ keyPath:'id' }); p.createIndex('orderId','orderId'); p.createIndex('shiftId','shiftId'); const r=db.createObjectStore('reservations',{ keyPath:'id' }); r.createIndex('tableId','tableId'); r.createIndex('dateTime','dateTime'); }
    if(oldV < 7){ if(!db.objectStoreNames.contains('drivers')) db.createObjectStore('drivers',{ keyPath:'id' }) }
  });

  // ====================== 2) Helpers & Models ======================
  const genId = p => `${p}-${Date.now()}-${Math.floor(Math.random()*1e5)}`;
  const round = x => Math.round((+x + Number.EPSILON) * 100) / 100;

  const calcLineTotal = (line) => {
    const base = +line.price || 0;
    const mods = (line.selectedModifiers||[]).reduce((s,m)=> s + (+m.price||0), 0);
    return round((base + mods) * (line.qty||1) * (1 - (+line.discountRate||0)));
  };

  const calcOrderTotals = (o, settings) => {
    const subtotal = round((o.items||[]).reduce((a,b)=> a + (+b.total||0), 0));
    const discount = round(+o.orderDiscount||0);
    const service = o.type==='dine_in' ? round((subtotal - discount) * +(settings.service_charge_rate||0)) : 0;
    const deliveryFee = o.type==='delivery' ? round(o.deliveryFee!=null? +o.deliveryFee : +(settings.default_delivery_fee||0)) : 0;
    const taxable = round(Math.max(0, subtotal - discount + service + deliveryFee));
    const vat = round(taxable * +(settings.tax_rate||0));
    const total = round(taxable + vat);
    return { subtotal, discount, service, deliveryFee, vat, total };
  };

  const makeLine = (it, lang) => {
    const name = it.translations?.[lang]?.name || (`Item #${it.id}`);
    const line = { uid:genId('li'), itemId:it.id, name, price:+it.price, qty:1, selectedModifiers:[], note:'', discountRate:0, total:0 };
    line.total = calcLineTotal(line); return line;
  }

  const makeOrder = (type) => ({ id:genId('ord'), type, items:[], orderDiscount:0, tableIds:[], customer:null, driverId:null, deliveryFee:null, createdAt:Date.now(), status:'new_order' });

  const ensureSearchText = (it) => { if(!it.searchText){ const ar=it.translations?.ar?.name||''; const en=(it.translations?.en?.name||''); it.searchText = (String(ar)+' '+String(en)+' '+String(it.description||'')).toLowerCase(); } return it }

  // ====================== 3) App ======================
  const app = Core.createApp({
    root:'#app', locale:'ar-EG', dir:'auto', theme:'auto', persistEnv:true,
    perfPolicy:{ maxMs:16, mode:'last' }, guardianMode:'warn',
    initial:{
      meta:{ currency:'EGP', locale:'ar-EG', dir:'rtl', theme:'light' },
      settings:{}, catalog:{ categories:[], items:[] },
      employees:[], drivers:[], tables:[], customers:[],
      session:{ employee:null, shift:null },
      order: makeOrder('takeaway'), orderTotals:{ subtotal:0, discount:0, service:0, deliveryFee:0, vat:0, total:0 },
      ui:{ search:'', activeCategory:'all', modal:null, targetLine:null, tempDiscount:'0', tempNote:'', tablePick:new Set(),
           payments:[] },
      reports:{ orders:[], filters:{ status:'', query:'' } },
      lastPrinted:null, lastPrintedTotals:null
    },

    // ---------------- Commands (all business logic) ----------------
    commands:{
      async boot({ truth, env }){
        await DB.open();
        const first = ((await DB.getAll('employees'))||[]).length===0;
        if(first && w.database){
          await DB.put('settings', { id:'default', ...(w.database.settings||{}) });
          await DB.bulkPut('employees', w.database.employees||[]);
          await DB.bulkPut('tables', w.database.tables||[]);
          await DB.bulkPut('drivers', w.database.drivers||[]);
          await DB.bulkPut('categories', w.database.categories||[]);
          await DB.bulkPut('items', (w.database.items||[]).map(ensureSearchText));
          await DB.bulkPut('customers', w.database.customers||[]);
        }
        const settings = (await DB.get('settings','default')) || { tax_rate:.15, service_charge_rate:.1, default_delivery_fee:10 };
        const [employees, drivers, tables, categories, items] = await Promise.all([
          DB.getAll('employees'), DB.getAll('drivers'), DB.getAll('tables'), DB.getAll('categories'), DB.getAll('items')
        ]);
        truth.batch(()=>{
          truth.set(s=> ({...s, settings, employees, drivers, tables, catalog:{ categories, items: items.map(ensureSearchText) }, meta:{...s.meta, currency:(settings.currency?.code||'EGP'), locale:env.get().locale, dir:env.resolvedDir(), theme:env.resolvedTheme()} }));
          truth.rebuildAll();
        })
      },

      toggleTheme:({ env })=> env.toggleTheme(),
      toggleLang:({ env, truth })=>{ const nxt = env.get().locale.startsWith('ar')? 'en-US' : 'ar-EG'; env.setLocale(nxt); truth.set(s=>({...s, meta:{...s.meta, locale:nxt}})); truth.rebuildAll() },

      onSearch({ truth }, e){ const v = e.target.value||''; truth.set(s=>({...s, ui:{...s.ui, search:v}})); truth.mark('menu-panel') },
      setCategory({ truth }, e){ const id = e.target.getAttribute('data-id'); truth.set(s=>({...s, ui:{...s.ui, activeCategory:id}})); truth.mark('menu-panel') },

      setOrderType({ truth }, e){ const t = e.target.getAttribute('data-value'); truth.batch(()=>{ truth.set(s=> ({...s, order:{...s.order, type:t}})); truth.mark('order-panel') }) },

      addToOrder({ truth, i18n }, e){ const id = e.target.getAttribute('data-id'); truth.batch(()=>{
        truth.set(s=>{
          const it = s.catalog.items.find(x=> String(x.id)===String(id)); if(!it) return s;
          const line = makeLine(it, (s.meta?.locale||'ar').startsWith('ar')?'ar':'en');
          const order = { ...s.order, items:[...s.order.items, line] };
          return { ...s, order, orderTotals: calcOrderTotals(order, s.settings) }
        });
        truth.mark('order-panel');
      }) },

      // ----- Line actions & Qty -----
      openLineActions({ truth }, e){ const uid=e.currentTarget?.getAttribute('data-id')||e.target.getAttribute('data-id'); truth.set(s=>({...s, ui:{...s.ui, modal:{ type:'qty', line: (s.order.items||[]).find(x=>x.uid===uid) }}})); truth.mark('modals') },
      syncQty({ truth }, e){ const val = Math.max(1, Math.floor(+e.target.value||1)); truth.batch(()=>{ truth.set(s=>{ const li=s.ui.modal?.line; if(!li) return s; li.qty = val; li.total = calcLineTotal(li); return { ...s, order:{...s.order}, orderTotals: calcOrderTotals(s.order, s.settings) } }); truth.mark('order-panel') }) },
      qtyKey({ truth }, e){ const ch = e.target.getAttribute('data-ch'); const inp = document.querySelector('#qtyInput'); if(!inp) return; if(ch==='C') inp.value=''; else inp.value = (inp.value||'') + ch; inp.dispatchEvent(new Event('input',{ bubbles:true })) },

      // ----- Modifiers -----
      openModifiers({ truth }, e){ const uid = e.target.getAttribute('data-id'); truth.set(s=>{ const li=(s.order.items||[]).find(x=>x.uid===uid); return { ...s, ui:{...s.ui, modal:{ type:'modifiers', line:li, mods: (li?.modifiers||li?.availableModifiers||s.settings?.modifiers||[]) } } } }); truth.mark('modals') },
      toggleModifier({ truth }, e){ const id = e.target.getAttribute('data-id'); truth.batch(()=>{ truth.set(s=>{ const li=s.ui.modal?.line; if(!li) return s; const has = (li.selectedModifiers||[]).some(m=>String(m.id)===String(id)); const src = s.ui.modal.mods || []; const mod = src.find(m=> String(m.id)===String(id)); const sel = new Set((li.selectedModifiers||[]).map(x=>String(x.id))); if(has) sel.delete(String(id)); else if(mod) sel.add(String(id)); li.selectedModifiers = Array.from(sel).map(x=> src.find(m=>String(m.id)===x)).filter(Boolean); li.total = calcLineTotal(li); return { ...s, order:{...s.order}, orderTotals: calcOrderTotals(s.order, s.settings) } }); truth.mark('order-panel') }) },

      confirmDeleteOpen({ truth }, e){ const uid=e.target.getAttribute('data-id'); truth.set(s=>({...s, ui:{...s.ui, modal:{ type:'confirmDel', uid } }})); truth.mark('modals') },
      confirmDelete({ truth }){ truth.batch(()=>{ truth.set(s=>{ const uid=s.ui.modal?.uid; const items=(s.order.items||[]).filter(x=>x.uid!==uid); const order={...s.order, items}; return { ...s, order, orderTotals: calcOrderTotals(order, s.settings), ui:{...s.ui, modal:null} } }); truth.mark('order-panel'); truth.mark('modals') }) },

      // ----- Customer -----
      syncCustomer({ truth }, e){ const id=e.target.id, v=e.target.value; truth.batch(()=>{ truth.set(s=>{ const c={ ...(s.order.customer||{}), [id==='custName'?'name':'phone']: v }; return { ...s, order:{ ...s.order, customer:c } } }); truth.mark('order-panel') }) },

      // ----- Tables & Reservations -----
      openTables({ truth }){
        truth.set(s=>{
          const pick = new Set((s.order?.tableIds)||[]);
          return { ...s, ui:{ ...s.ui, tablePick:pick, modal:{ type:'tables' } } };
        });
        truth.mark('modals');
      },
      openTablesAssign({ truth }){
        truth.set(s=>{
          const pick = new Set((s.order?.tableIds)||[]);
          return { ...s, ui:{ ...s.ui, tablePick:pick, modal:{ type:'tables' } } };
        });
        truth.mark('modals');
      },
      pickTableToggle({ truth }, e){
        let id = e.currentTarget?.getAttribute('data-id');
        if(!id){
          const targetWithId = e.target?.closest?.('[data-id]');
          id = targetWithId?.getAttribute('data-id');
        }
        if(!id) return;
        truth.set(s=>{
          const pick=new Set(s.ui.tablePick||new Set());
          if(pick.has(id)) pick.delete(id); else pick.add(id);
          return { ...s, ui:{...s.ui, tablePick:pick} };
        });
      },
      async applyTablesAssign({ truth }){ const pick = (s=> Array.from(s.ui.tablePick||new Set()))(truth.get()); truth.batch(()=>{ truth.set(s=> ({ ...s, order:{...s.order, tableIds: pick }, ui:{...s.ui, tablePick:new Set(), modal:null} })); truth.mark('order-panel'); truth.mark('modals') }) },

      async createReservationOpen({ truth }){ const pick=Array.from((truth.get().ui.tablePick||new Set())); const name=prompt('اسم العميل:'); const phone=prompt('هاتف:'); const at=prompt('موعد (ISO):', new Date(Date.now()+60*60*1000).toISOString()); const pax=+prompt('عدد الأفراد:', '2'); if(!name||!at) return; const resv={ id:genId('resv'), tableId: pick[0]||null, customer:{ name, phone }, pax, dateTime:at, status:'reserved' }; await DB.put('reservations', resv); alert('تم إنشاء الحجز'); },

      // ----- Order save / settle / split -----
      saveOrder({ truth }){ truth.batch(()=>{ truth.set(s=>{ const o={...s.order}; const totals = calcOrderTotals(o, s.settings); o.totals = totals; return { ...s, order:o, orderTotals:totals } }); truth.mark('order-panel') }) },

      openBillDiscount({ truth }){ truth.set(s=>{ const cur = round(+s.order?.orderDiscount||0); return { ...s, ui:{ ...s.ui, modal:{ type:'billDiscount' }, tempDiscount:String(cur) } } }); truth.mark('modals') },
      syncBillDiscount({ truth }, e){ const v = e?.target?.value ?? ''; truth.set(s=> ({ ...s, ui:{ ...s.ui, tempDiscount: v } })); truth.mark('modals') },
      applyBillDiscount({ truth }){ truth.batch(()=>{ truth.set(s=>{ const raw=s.ui.tempDiscount; const amt=Math.max(0, +raw||0); const baseTotals=calcOrderTotals({ ...s.order, orderDiscount:0 }, s.settings); const discount=round(Math.min(amt, baseTotals.subtotal)); const order={ ...s.order, orderDiscount:discount }; const orderTotals=calcOrderTotals(order, s.settings); return { ...s, order, orderTotals, ui:{ ...s.ui, modal:null, tempDiscount:String(discount) } }; }); truth.mark('order-panel'); truth.mark('modals') }) },

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
      openReportOrder({ truth }, e){ const id=e.currentTarget?.getAttribute('data-id')||e.target.getAttribute('data-id'); alert('فتح الطلب '+id+' — للتوسعة: تحميله في اللوحة اليمنى لإعادة فتحه/الطباعة/التحصيل'); },

      // ----- Shift -----
      async startShift({ truth }){ const sh={ id:genId('sh'), startedAt:Date.now(), status:'open' }; await DB.put('shifts', sh); truth.set(s=> ({ ...s, session:{ ...s.session, shift: sh } })); truth.mark('hdr') },
      async endShift({ truth }){ const s=truth.get(); if(!s.session.shift) return; const sh = { ...s.session.shift, endedAt:Date.now(), status:'closed' }; await DB.put('shifts', sh); truth.set(st=> ({ ...st, session:{ ...st.session, shift:null } })); truth.rebuildAll() },

      // ----- Misc -----
      closeModal({ truth }){
        truth.set(s=>{
          const isTablesModal = s.ui.modal?.type==='tables';
          const nextPick = isTablesModal ? new Set((s.order?.tableIds)||[]) : s.ui.tablePick;
          return { ...s, ui:{ ...s.ui, modal:null, tablePick:nextPick } };
        });
        truth.mark('modals');
      },

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
      }
    },

    // ---------------- Regions (pure views) ----------------
    register({ registerRegion }){
      registerRegion('hdr', '#hdr', (state)=> w.POS_UI.header(state), null, { budget:{ maxMs:12 } });
      registerRegion('menu-panel', '#menu-panel', (state)=> w.POS_UI.menu(state), null, { budget:{ maxMs:12 } });
      registerRegion('order-panel', '#order-panel', (state)=> w.POS_UI.order(state), null, { budget:{ maxMs:12 } });
      registerRegion('modals', '#modals', (state)=> w.POS_UI.modals(state), null, { priority:'high', budget:{ maxMs:8 } });
      registerRegion('printer', '#printer', (_s)=> '', null, { priority:'low' });
    }
  });

  // Bootstrap
  app.dispatch('boot');

  // Devtools helper (optional)
  w.__POS = app; // for console inspection
})();
