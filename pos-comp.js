(function(w){
  "use strict";
  const M = w.Mishkah; if(!M||!M.Comp||!M.Atoms){ console.error("Mishkah Comp/Atoms required"); return }
  const { Comp, Atoms:A } = M;

  // =============== 1) Base Molecules (reusable) ===============
  // Button
  if(!Comp.mole.Button){
    Comp.mole.define("Button", (A, s, app, p)=> A.Button({
      ...p,
      tw: (p.tw||"") + " btn " + (p.variant==="ghost"?"btn-ghost":"btn-primary")
    }, { default: [p.text||"زر"] }));
  }

  // Badge/Chip
  if(!Comp.mole.Badge){
    Comp.mole.define("Badge", (A, s, app, p)=> A.Span({
      ...p,
      tw: (p.tw||"") + " chip text-sm"
    }, { default: [p.text||"●"] }));
  }

  // DescriptionList
  if(!Comp.mole.DescriptionList){
    Comp.mole.define("DescriptionList", (A, s, app, p)=>{
      const items = p.items||[];
      return A.Dl({ tw:"space-y-2" }, { default: items.flatMap(it=>[
        A.Div({ tw:"flex items-center justify-between text-sm" },{
          default:[ A.Dt({ tw:"text-slate-400" },{default:[it.term||""]}), A.Dd({ tw:"font-semibold" },{default:[it.details||""]}) ]
        })
      ])})
    });
  }

  // Segmented Control (Tabs)
  if(!Comp.mole.Segmented){
    Comp.mole.define("Segmented", (A, s, app, p)=>{
      const { value, options=[], name } = p;
      return A.Div({ tw:"inline-flex bg-[var(--c-soft)] p-1 rounded-xl border border-white/10" },{
        default: options.map(opt => A.Button({
          tw: `px-3 py-1 rounded-lg text-sm font-bold ${value===opt.value? 'bg-[var(--c-primary)] text-white':'text-slate-300'}`,
          "data-onclick": p.onChange, "data-value": opt.value, name
        }, { default:[opt.label] }))
      })
    })
  }

  // Emoji icon helper
  const I = (emoji, tw="") => A.Span({ tw: `select-none ${tw}` }, { default: [emoji] });

  // Currency helper
  const cur = (s,n)=> new Intl.NumberFormat(s.meta?.locale||'ar-EG', { style:'currency', currency:s.meta?.currency||'EGP' }).format(+n||0);
  const langOf = s => String(s.meta?.locale||'ar').toLowerCase().startsWith('ar')? 'ar' : 'en';
  const T = {
    ar:{ search:'ابحث عن صنف...', dine_in:'صالة', takeaway:'سفري', delivery:'توصيل', new_order:'جديد', in_preparation:'تحت التجهيز', prepared:'جاهز', delivered:'تم التسليم', paid:'مدفوع', tables:'الطاولات', reports:'التقارير', startShift:'بدء وردية', endShift:'إنهاء وردية', shift:'وردية', login:'تسجيل دخول', logout:'تسجيل خروج', categories:'التصنيفات', subtotal:'المجموع', discounts:'خصومات', service:'خدمة', deliveryFee:'توصيل', vat:'ضريبة', total:'الإجمالي', save:'حفظ مؤقت', settle:'تحصيل وطباعة', addPayLine:'إضافة دفعة', splitBill:'تقسيم الدفع', modifiers:'التعديلات', qty:'كمية', remove:'حذف', note:'ملاحظة', customer:'العميل', driver:'السائق', billDiscount:'خصم الفاتورة', lock:'حجز', unlock:'فك الحجز', reservation:'حجز', tablesAssign:'ربط الطاولات', pickedTables:'الطاولات المحددة', seats:'مقاعد', capacity:'سعة' },
    en:{ search:'Search item...', dine_in:'Dine‑in', takeaway:'Takeaway', delivery:'Delivery', new_order:'New', in_preparation:'In prep', prepared:'Prepared', delivered:'Delivered', paid:'Paid', tables:'Tables', reports:'Reports', startShift:'Start Shift', endShift:'End Shift', shift:'Shift', login:'Login', logout:'Logout', categories:'Categories', subtotal:'Subtotal', discounts:'Discounts', service:'Service', deliveryFee:'Delivery', vat:'VAT', total:'Grand total', save:'Save', settle:'Settle & Print', addPayLine:'Add Payment', splitBill:'Split bill', modifiers:'Modifiers', qty:'Qty', remove:'Remove', note:'Note', customer:'Customer', driver:'Driver', billDiscount:'Bill discount', lock:'Lock', unlock:'Unlock', reservation:'Reservation', tablesAssign:'Assign Tables', pickedTables:'Picked Tables', seats:'Seats', capacity:'Capacity' }
  };
  const t = (s,k)=> (T[langOf(s)][k]||k);

  // =============== 2) POS reusable blocks ===============
  const POS = M.Comp.mole.POS || (M.Comp.mole.POS = {});

  POS.ItemCard = ({ item, state }) => {
    const name = item.translations?.[langOf(state)]?.name || (`#${item.id}`);
    return A.Button({
      tw:"card h-full text-start p-2 hover:ring-2 ring-emerald-500 transition transform hover:-translate-y-0.5",
      "data-onclick":"addToOrder", "data-id": item.id
    }, { default:[
      A.Div({ tw:"aspect-[4/3] w-full overflow-hidden rounded-xl mb-2 bg-[var(--c-soft)]" }, { default:[
        item.image ? A.Img({ src:item.image, alt:name, tw:"w-full h-full object-cover" }) : I('🍔','text-5xl flex h-full items-center justify-center')
      ]}),
      A.Div({ tw:"font-semibold" }, { default:[ name ] }),
      A.Div({ tw:"text-sm text-slate-400" }, { default:[ cur(state, item.price) ] })
    ]})
  }

  POS.OrderLine = ({ line, state }) => A.Div({
    tw:"py-2 px-2 flex items-center gap-3 border-b border-white/10 hover:bg-white/5 cursor-pointer",
    "data-onclick":"openLineActions", "data-id": line.uid
  }, { default:[
    A.Div({ tw:"flex-1" }, { default:[
      A.Div({ tw:"font-semibold" }, { default:[ line.name ] }),
      ...(line.selectedModifiers||[]).map(m => A.Div({ tw:"text-xs text-emerald-400 ps-2" }, { default:[`+ ${m.name} (${cur(state, m.price||0)})`] })),
      (line.note ? A.Div({ tw:"text-xs text-amber-400 ps-2" }, { default:[`📝 ${line.note}`] }) : null)
    ]}),
    A.Div({ tw:"font-semibold" }, { default:[`× ${line.qty}`] }),
    A.Div({ tw:"w-24 text-right font-bold" }, { default:[ cur(state, line.total) ] }),
    A.Button({ tw:"btn-ghost !p-2 text-red-400", "data-onclick":"confirmDeleteOpen", "data-id":line.uid }, { default:["🗑️"] })
  ]});

  POS.OrderTotals = ({ totals, state }) => A.Div({ tw:"mt-auto space-y-2" }, { default:[
    Comp.call("DescriptionList", { items:[
      { term:t(state,'subtotal'), details:cur(state, totals.subtotal) },
      { term:t(state,'discounts'), details:cur(state, totals.discount) },
      { term:t(state,'service'), details:cur(state, totals.service) },
      { term:t(state,'deliveryFee'), details:cur(state, totals.deliveryFee) },
      { term:t(state,'vat'), details:cur(state, totals.vat) }
    ]}),
    A.Div({ tw:"flex justify-between items-center text-xl font-extrabold border-t border-white/10 pt-3" }, { default:[
      A.Span({}, { default:[ t(state,'total') ] }), A.Span({}, { default:[ cur(state, totals.total) ] })
    ]})
  ]});

  POS.TableCard = ({ tbl, state }) => {
    const badge = tbl.status==='reserved' ? '🟡' : (tbl.status==='occupied'?'🔴':'🟢');
    const pickSet = state.ui?.tablePick instanceof Set ? state.ui.tablePick : new Set(state.ui?.tablePick||[]);
    const tblKey = String(tbl.id);
    const isPicked = pickSet.has(tblKey) || pickSet.has(tbl.id);
    return A.Button({
      tw:`card p-3 text-start hover:ring-2 ring-blue-500 ${isPicked?'!ring-2 !ring-emerald-400 !bg-emerald-500/10':''}`,
      "data-onclick":"pickTableToggle", "data-id": tbl.id
    }, { default:[
      A.Div({ tw:"flex items-center justify-between" }, { default:[
        A.Div({ tw:"font-bold" }, { default:[`#${tbl.number||tbl.id}`] }),
        A.Span({ tw:"text-xl" }, { default:[badge] })
      ]}),
      A.Div({ tw:"text-sm text-slate-400 mt-1" }, { default:[ `${t(state,'capacity')}: ${tbl.capacity||4}` ] }),
      (tbl.activeOrderIds?.length ? A.Div({ tw:"text-xs mt-1 text-emerald-400" }, { default:[`🧾 ${tbl.activeOrderIds.length} orders`] }) : null)
    ]})
  }

  // =============== 3) Regions (pure build) ===============
  const UI = {};

  UI.header = (s) => {
    const emp = s.session.employee, sh = s.session.shift;
    const cats = [{id:'all',name:'الكل'}, ...s.catalog.categories];
    return A.Div({ tw:"card p-3 flex items-center gap-3 justify-between" }, { default:[
      A.Div({ tw:"flex items-center gap-2" }, { default:[
        A.Button({ tw:"btn-ghost", "data-onclick":"toggleTheme" }, { default:["🌓"] }),
        A.Button({ tw:"btn-ghost", "data-onclick":"toggleLang" }, { default:["🌐"] }),
        A.Div({ tw:"chip" }, { default:[ emp? `🪪 ${emp.name}` : 'غير مسجل' ] }),
        A.Div({ tw:"chip" }, { default:[ sh? `⌚ ${new Date(sh.startedAt).toLocaleTimeString()}` : t(s,'startShift') ] })
      ]}),
      A.Div({ tw:"flex-1 flex items-center gap-2" }, { default:[
        A.Input({ id:"search", placeholder:t(s,'search'), value: s.ui.search||'', tw:"w-full px-4 py-2 rounded-xl bg-[var(--c-soft)] border border-white/10", "data-oninput":"onSearch" }),
        A.Div({ tw:"hidden lg:flex items-center gap-2" }, { default: cats.map(c=> A.Button({
          tw:`chip ${s.ui.activeCategory===c.id?'!bg-[var(--c-primary)] !text-white':''}`,
          "data-onclick":"setCategory", "data-id": c.id
        }, { default:[ c.name||c.title || `#${c.id}` ] })) })
      ]}),
      A.Div({ tw:"flex items-center gap-2" }, { default:[
        A.Button({ tw:"btn-ghost", "data-onclick":"openTables" }, { default:["🍽️ ", t(s,'tables')] }),
        A.Button({ tw:"btn-ghost", "data-onclick":"showReports" }, { default:["📊 ", t(s,'reports')] }),
        A.Button({ tw: sh?"btn-danger":"btn-primary", "data-onclick": sh?"endShift":"startShift" }, { default:[ sh? t(s,'endShift') : t(s,'startShift') ] })
      ]})
    ]})
  }

  UI.menu = (s) => {
    const q = (s.ui.search||'').trim().toLowerCase();
    const cat = s.ui.activeCategory||'all';
    const items = (s.catalog.items||[]).filter(it => (cat==='all'||it.categoryId===cat) && (!q || (it.searchText||'').includes(q) || (it.translations?.ar?.name||'').includes(q) || (it.translations?.en?.name||'').toLowerCase().includes(q)));
    return A.Div({ tw:"card h-full p-3 flex flex-col" }, { default:[
      A.Div({ tw:"grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-3 scroll-y" }, { default: items.map(item => POS.ItemCard({ item, state:s })) })
    ]})
  }

  UI.order = (s) => {
    const o = s.order, totals = s.orderTotals;
    return A.Div({ tw:"card h-full p-3 flex flex-col" }, { default:[
      // Order type / customer / tables row
      A.Div({ tw:"flex items-center gap-2 mb-2" }, { default:[
        Comp.call('Segmented', { name:'otype', value:o.type, onChange:'setOrderType', options:[
          { value:'dine_in', label:`🍽️ ${t(s,'dine_in')}` },
          { value:'takeaway', label:`🥡 ${t(s,'takeaway')}` },
          { value:'delivery', label:`🚚 ${t(s,'delivery')}` },
        ]}),
        (o.type==='dine_in' ? A.Button({ tw:"btn-ghost", "data-onclick":"openTablesAssign" }, { default:["🍽️ ", t(s,'tablesAssign')] }) : null),
        (o.type!=='dine_in' ? A.Input({ id:'custName', placeholder:t(s,'customer'), value:o.customer?.name||'', tw:"px-3 py-2 rounded-xl bg-[var(--c-soft)] border border-white/10", "data-onchange":"syncCustomer" }) : null),
        (o.type==='delivery' ? A.Input({ id:'custPhone', placeholder:'📞', value:o.customer?.phone||'', tw:"w-40 px-3 py-2 rounded-xl bg-[var(--c-soft)] border border-white/10", "data-onchange":"syncCustomer" }) : null)
      ]}),

      // Lines
      A.Div({ tw:"flex-1 scroll-y divide-y divide-white/5" }, { default: (o.items||[]).map(li => POS.OrderLine({ line: li, state: s })) }),

      // Totals
      POS.OrderTotals({ totals, state:s }),

      // Actions
      A.Div({ tw:"flex items-center gap-2 pt-3" }, { default:[
        A.Button({ tw:"btn-ghost", "data-onclick":"openBillDiscount" }, { default:["🏷️ ", t(s,'billDiscount')] }),
        A.Div({ tw:"ms-auto" }),
        A.Button({ tw:"btn-ghost", "data-onclick":"saveOrder" }, { default:["💾 ", t(s,'save')] }),
        A.Button({ tw:"btn-primary", "data-onclick":"openSplitPay" }, { default:["💳 ", t(s,'splitBill')] }),
        A.Button({ tw:"btn-primary", "data-onclick":"settleAndPrint" }, { default:["🧾 ", t(s,'settle')] })
      ]})
    ]})
  }

  // =============== 4) Modals region ===============
  UI.modals = (s) => {
    const m = s.ui.modal; if(!m) return A.Fragment();
    const closeBtn = A.Button({ tw:"btn-ghost", "data-onclick":"closeModal" }, { default:["✖"] });

    // Qty modal
    if(m?.type==='qty'){
      const li = m.line;
      return A.Div({ class:"modal-backdrop" }, { default:[
        A.Div({ tw:"card w-[min(420px,92vw)] p-4 space-y-3" }, { default:[
          A.Div({ tw:"flex items-center justify-between" }, { default:[ A.Div({ tw:"font-bold" }, { default:[ t(s,'qty')+': '+li.name ] }), closeBtn ] }),
          A.Input({ id:'qtyInput', type:'number', value: li.qty, min:1, tw:"w-full text-2xl text-center px-3 py-2 rounded-xl bg-[var(--c-soft)] border border-white/10", "data-oninput":"syncQty" }),
          A.Div({ tw:"grid grid-cols-3 gap-2" }, { default:[..."1234567890"].map(ch=> A.Button({ tw:"btn-ghost", "data-onclick":"qtyKey", "data-ch": ch }, { default:[ch] })) })
        ]})
      ]})
    }

    // Modifiers modal
    if(m?.type==='modifiers'){
      const li = m.line, mods = m.mods || [];
      return A.Div({ class:"modal-backdrop" }, { default:[
        A.Div({ tw:"card w-[min(680px,96vw)] p-4 space-y-3" }, { default:[
          A.Div({ tw:"flex items-center justify-between" }, { default:[ A.Div({ tw:"font-bold" }, { default:[`🧩 ${t(s,'modifiers')} — ${li.name}`] }), closeBtn ] }),
          A.Div({ tw:"grid grid-cols-2 md:grid-cols-3 gap-2 max-h-[50vh] scroll-y" }, { default: mods.map(md => A.Button({
            tw:`chip flex items-center justify-between ${li.selectedModifiers?.some(x=>x.id===md.id)?'!bg-emerald-600 !text-white':''}`,
            "data-onclick":"toggleModifier", "data-id": md.id
          }, { default:[ A.Span({}, { default:[ md.name ] }), A.Span({ tw:"text-sm" }, { default:[ cur(s, md.price||0) ] }) ] })) })
        ]})
      ]})
    }

    // Tables assign modal
    if(m?.type==='tables'){
      const picked = new Set(s.ui.tablePick instanceof Set ? s.ui.tablePick : (s.order.tableIds||[]));
      return A.Div({ class:"modal-backdrop" }, { default:[
        A.Div({ tw:"card w-[min(920px,98vw)] p-4 space-y-3" }, { default:[
          A.Div({ tw:"flex items-center justify-between" }, { default:[ A.Div({ tw:"font-bold" }, { default:["🍽️ ", t(s,'tablesAssign')] }), closeBtn ] }),
          A.Div({ tw:"grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-[52vh] scroll-y" }, { default:(s.tables||[]).map(tbl=> POS.TableCard({ tbl, state:s })) }),
          A.Div({ tw:"flex items-center justify-between" }, { default:[
            A.Div({ tw:"text-sm text-slate-400" }, { default:[`${t(s,'pickedTables')}: ${Array.from(picked).join(', ')||'—'}`] }),
            A.Div({ tw:"flex items-center gap-2" }, { default:[
              A.Button({ tw:"btn-ghost", "data-onclick":"createReservationOpen" }, { default:["🔒 ", t(s,'reservation')] }),
              A.Button({ tw:"btn-primary", "data-onclick":"applyTablesAssign" }, { default:["✅ ", t(s,'tablesAssign')] })
            ]})
          ]})
        ]})
      ]})
    }

    // Split payments
    if(m?.type==='split'){
      const pay = m.payments||[];
      return A.Div({ class:"modal-backdrop" }, { default:[
        A.Div({ tw:"card w-[min(620px,96vw)] p-4 space-y-3" }, { default:[
          A.Div({ tw:"flex items-center justify-between" }, { default:[ A.Div({ tw:"font-bold" }, { default:["💳 ", t(s,'splitBill')] }), closeBtn ] }),
          A.Div({ tw:"space-y-2" }, { default:[
            ...pay.map((p,i)=> A.Div({ tw:"flex items-center gap-2" }, { default:[
              A.Select({ "data-onchange":"changePayMethod", "data-i": i, 'data-value': p.method, tw:"px-3 py-2 rounded-xl bg-[var(--c-soft)] border border-white/10" }, { default:[
                A.Option({ value:'cash' }, { default:['💵 Cash'] }),
                A.Option({ value:'card' }, { default:['💳 Card'] }),
                A.Option({ value:'wallet' }, { default:['📱 Wallet'] })
              ]}),
              A.Input({ type:'number', step:'0.01', value:p.amount, 'data-oninput':'changePayAmount', 'data-i':i, tw:"w-36 px-3 py-2 rounded-xl bg-[var(--c-soft)] border border-white/10" })
            ]})),
            A.Button({ tw:"btn-ghost", "data-onclick":"addPayLine" }, { default:["➕ ", t(s,'addPayLine')] })
          ]}),
          A.Div({ tw:"flex items-center justify-end gap-2" }, { default:[
            A.Button({ tw:"btn-primary", "data-onclick":"confirmSplit" }, { default:["✅ ", t(s,'settle')] })
          ]})
        ]})
      ]})
    }

    // Reports (orders list + filters)
    if(m?.type==='reports'){
      const rs = s.reports||{ orders:[], filters:{} };
      return A.Div({ class:"modal-backdrop" }, { default:[
        A.Div({ tw:"card w-[min(1080px,98vw)] p-4 space-y-3" }, { default:[
          A.Div({ tw:"flex items-center justify-between" }, { default:[
            A.Div({ tw:"font-bold" }, { default:["📊 ", t(s,'reports')] }),
            closeBtn
          ]}),
          A.Div({ tw:"flex items-center gap-2" }, { default:[
            A.Select({ 'data-onchange':'setReportStatus', 'data-value': rs.filters?.status||'' , tw:"px-3 py-2 rounded-xl bg-[var(--c-soft)] border border-white/10" },{ default:[
              A.Option({ value:'' },{ default:['🔎 كل الحالات'] }),
              A.Option({ value:'new_order' },{ default:[t(s,'new_order')] }),
              A.Option({ value:'in_preparation' },{ default:[t(s,'in_preparation')] }),
              A.Option({ value:'prepared' },{ default:[t(s,'prepared')] }),
              A.Option({ value:'delivered' },{ default:[t(s,'delivered')] }),
              A.Option({ value:'paid' },{ default:[t(s,'paid')] })
            ]}),
            A.Input({ placeholder:'ابحث برقم/اسم', value:rs.filters?.query||'', 'data-oninput':'setReportQuery', tw:"flex-1 px-3 py-2 rounded-xl bg-[var(--c-soft)] border border-white/10" })
          ]}),
          A.Div({ tw:"max-h-[60vh] scroll-y" }, { default:[
            A.Table({ tw:"w-full text-sm" }, { default:[
              A.Thead({}, { default:[ A.Tr({}, { default:[ 'رقم','النوع','الحالة','الطاولات','العميل','الإجمالي','الكاشير' ].map(h=> A.Th({ tw:"text-start py-2" },{ default:[h] })) ]) ] }),
              A.Tbody({}, { default:(rs.orders||[]).map(o=> A.Tr({ tw:"border-t border-white/10 cursor-pointer hover:bg-white/5", "data-onclick":"openReportOrder", "data-id":o.id }, { default:[
                A.Td({ tw:"py-1" }, { default:[o.id] }),
                A.Td({}, { default:[o.type] }),
                A.Td({}, { default:[o.status] }),
                A.Td({}, { default:[(o.tableIds||[]).join(', ')] }),
                A.Td({}, { default:[ o.type==='delivery' ? (o.customer?.name||'—') : (o.customer?.name||'عميل نقدي') ] }),
                A.Td({}, { default:[ cur(s, o.totals?.total||o.total||0) ] }),
                A.Td({}, { default:[ o.cashierName || '—' ] })
              ]})) })
            ]})
          ]})
        ]})
      ]})
    }

    return A.Fragment();
  }

  // =============== 5) Public API ===============
  w.POS_UI = UI; // expose builders
})();
