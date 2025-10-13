(function(){
  const M = window.Mishkah;
  if(!M || !M.utils || !M.DSL) return;

  const UI = M.UI || {};
  const U = M.utils;
  const D = M.DSL;
  const { tw, cx } = U.twcss;

  const hasStructuredClone = typeof structuredClone === 'function';
  const JSONX = U.JSON || {};
  const isPlainObject = value => value && typeof value === 'object' && !Array.isArray(value);
  const cloneDeep = (value)=>{
    if(value == null) return value;
    if(JSONX && typeof JSONX.clone === 'function') return JSONX.clone(value);
    if(hasStructuredClone){
      try{ return structuredClone(value); } catch(_err){}
    }
    try{ return JSON.parse(JSON.stringify(value)); } catch(_err){
      if(Array.isArray(value)) return value.map(entry=> cloneDeep(entry));
      if(isPlainObject(value)) return Object.keys(value).reduce((acc,key)=>{ acc[key] = cloneDeep(value[key]); return acc; }, {});
      return value;
    }
  };

  const TEXTS = {
    ar:{
      title:'مشكاة — شاشة المطبخ',
      subtitle:'إدارة التحضير والتسليم لحظيًا',
      status:{ online:'🟢 متصل', offline:'🔴 غير متصل', syncing:'🔄 مزامنة' },
      stats:{ total:'إجمالي الأوامر', expedite:'أوامر عاجلة', alerts:'تنبيهات', ready:'جاهز', pending:'قيد التحضير' },
      tabs:{ prep:'كل الأقسام', expo:'شاشة التجميع', delivery:'تسليم الدليفري', pendingDelivery:'معلقات الدليفري' },
      empty:{
        prep:'لا توجد طلبات محفوظة بعد.',
        station:'لا توجد أوامر لهذا القسم حاليًا.',
        expo:'لا توجد تذاكر تجميع حالية.',
        delivery:'لا توجد طلبات دليفري حالية.',
        pending:'لا توجد طلبات دليفري معلقة للتحصيل.'
      },
      actions:{
        start:'بدء التجهيز',
        finish:'تم التجهيز',
        assignDriver:'تعيين السائق',
        delivered:'تم التسليم',
        settle:'تسوية التحصيل'
      },
      labels:{
        order:'طلب',
        table:'طاولة',
        customer:'عميل',
        due:'الاستحقاق',
        timer:'المدة',
        driver:'السائق',
        driverPhone:'رقم السائق',
        notAssigned:'لم يتم التعيين بعد',
        serviceMode:{ dine_in:'صالة', delivery:'دليفري', takeaway:'تيك أواي', pickup:'استلام' },
        jobStatus:{ queued:'بانتظار', awaiting:'بانتظار', accepted:'تم القبول', in_progress:'قيد التحضير', cooking:'قيد التحضير', ready:'جاهز', completed:'مكتمل', cancelled:'ملغي', paused:'متوقف' },
        deliveryStatus:{ pending:'بانتظار التسليم', assigned:'تم تعيين السائق', onRoute:'في الطريق', delivered:'تم التسليم', settled:'تم التحصيل' },
        expoReady:'جاهز للتسليم',
        expoPending:'بانتظار الأقسام'
      },
      modal:{
        driverTitle:'اختر السائق المناسب',
        driverDescription:'حدد السائق المسؤول عن الطلب، وسيتم إعلام نقطة البيع فورًا.',
        close:'إغلاق'
      }
    },
    en:{
      title:'Mishkah — Kitchen display',
      subtitle:'Live preparation and dispatch management',
      status:{ online:'🟢 Online', offline:'🔴 Offline', syncing:'🔄 Syncing' },
      stats:{ total:'Total jobs', expedite:'Expedite', alerts:'Alerts', ready:'Ready', pending:'In progress' },
      tabs:{ prep:'All stations', expo:'Expo pass', delivery:'Delivery handoff', pendingDelivery:'Delivery settlements' },
      empty:{
        prep:'No orders have been saved yet.',
        station:'No active tickets for this station.',
        expo:'No expo tickets at the moment.',
        delivery:'No delivery orders right now.',
        pending:'No outstanding delivery settlements.'
      },
      actions:{
        start:'Start prep',
        finish:'Mark ready',
        assignDriver:'Assign driver',
        delivered:'Delivered',
        settle:'Settle payment'
      },
      labels:{
        order:'Order',
        table:'Table',
        customer:'Guest',
        due:'Due at',
        timer:'Duration',
        driver:'Driver',
        driverPhone:'Driver phone',
        notAssigned:'Not assigned yet',
        serviceMode:{ dine_in:'Dine-in', delivery:'Delivery', takeaway:'Takeaway', pickup:'Pickup' },
        jobStatus:{ queued:'Queued', awaiting:'Awaiting', accepted:'Accepted', in_progress:'Preparing', cooking:'Preparing', ready:'Ready', completed:'Completed', cancelled:'Cancelled', paused:'Paused' },
        deliveryStatus:{ pending:'Pending dispatch', assigned:'Driver assigned', onRoute:'On the way', delivered:'Delivered', settled:'Settled' },
        expoReady:'Ready to handoff',
        expoPending:'Waiting for stations'
      },
      modal:{
        driverTitle:'Select a driver',
        driverDescription:'Choose who will handle the delivery. POS will be notified instantly.',
        close:'Close'
      }
    }
  };

  const STATUS_PRIORITY = { ready:4, completed:4, in_progress:3, cooking:3, accepted:2, queued:1, awaiting:1, paused:0, cancelled:-1 };
  const STATUS_CLASS = {
    queued: tw`border-amber-300/40 bg-amber-400/10 text-amber-100`,
    awaiting: tw`border-amber-300/40 bg-amber-400/10 text-amber-100`,
    accepted: tw`border-sky-300/40 bg-sky-400/10 text-sky-100`,
    in_progress: tw`border-sky-300/50 bg-sky-500/10 text-sky-50`,
    cooking: tw`border-sky-300/50 bg-sky-500/10 text-sky-50`,
    ready: tw`border-emerald-300/50 bg-emerald-500/10 text-emerald-50`,
    completed: tw`border-emerald-400/60 bg-emerald-500/20 text-emerald-50`,
    paused: tw`border-slate-400/50 bg-slate-500/10 text-slate-200`,
    cancelled: tw`border-rose-400/60 bg-rose-500/15 text-rose-100`
  };

  const DELIVERY_STATUS_CLASS = {
    pending: tw`border-amber-300/40 bg-amber-400/10 text-amber-100`,
    assigned: tw`border-sky-300/50 bg-sky-500/10 text-sky-50`,
    onRoute: tw`border-sky-300/50 bg-sky-500/10 text-sky-50`,
    delivered: tw`border-emerald-300/50 bg-emerald-500/10 text-emerald-50`,
    settled: tw`border-emerald-400/60 bg-emerald-500/20 text-emerald-50`
  };

  const SERVICE_ICONS = { dine_in:'🍽️', delivery:'🚚', takeaway:'🧾', pickup:'🛍️' };

  const parseTime = (value)=>{
    if(!value) return null;
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? ms : null;
  };

  const formatClock = (value, lang)=>{
    const ms = typeof value === 'number' ? value : parseTime(value);
    if(!ms) return '—';
    const locale = lang === 'ar' ? 'ar-EG' : 'en-US';
    return new Date(ms).toLocaleTimeString(locale, { hour:'2-digit', minute:'2-digit' });
  };

  const formatDuration = (elapsedMs)=>{
    if(!elapsedMs || elapsedMs < 0) return '00:00';
    const totalSeconds = Math.floor(elapsedMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const pad = (value)=> value < 10 ? `0${value}` : String(value);
    return `${pad(minutes)}:${pad(seconds)}`;
  };

  const sum = (list, selector)=> list.reduce((acc, item)=> acc + (Number(selector(item)) || 0), 0);

  const cloneJob = (job)=>({
    ...job,
    details: Array.isArray(job.details) ? job.details.map(detail=>({
      ...detail,
      modifiers: Array.isArray(detail.modifiers) ? detail.modifiers.map(mod=>({ ...mod })) : []
    })) : [],
    history: Array.isArray(job.history) ? job.history.map(entry=>({ ...entry })) : []
  });

  const buildJobRecords = (jobOrders)=>{
    if(!jobOrders) return [];
    const headers = Array.isArray(jobOrders.headers) ? jobOrders.headers : [];
    const details = Array.isArray(jobOrders.details) ? jobOrders.details : [];
    const modifiers = Array.isArray(jobOrders.modifiers) ? jobOrders.modifiers : [];
    const history = Array.isArray(jobOrders.statusHistory) ? jobOrders.statusHistory : [];

    const modifiersByDetail = modifiers.reduce((acc, mod)=>{
      const bucket = acc[mod.detailId] || (acc[mod.detailId] = []);
      bucket.push({ ...mod });
      return acc;
    }, {});

    const detailsByJob = details.reduce((acc, detail)=>{
      const enriched = {
        ...detail,
        modifiers: modifiersByDetail[detail.id] ? modifiersByDetail[detail.id].map(item=>({ ...item })) : []
      };
      const bucket = acc[detail.jobOrderId] || (acc[detail.jobOrderId] = []);
      bucket.push(enriched);
      return acc;
    }, {});

    const historyByJob = history.reduce((acc, record)=>{
      const bucket = acc[record.jobOrderId] || (acc[record.jobOrderId] = []);
      bucket.push({ ...record });
      return acc;
    }, {});

    return headers.map(header=>{
      const cloned = { ...header };
      cloned.details = (detailsByJob[header.id] || []).sort((a, b)=>{
        const aMs = parseTime(a.startAt) || parseTime(a.createdAt) || 0;
        const bMs = parseTime(b.startAt) || parseTime(b.createdAt) || 0;
        return aMs - bMs;
      });
      cloned.history = (historyByJob[header.id] || []).sort((a, b)=>{
        const aMs = parseTime(a.changedAt) || 0;
        const bMs = parseTime(b.changedAt) || 0;
        return aMs - bMs;
      });
      cloned.createdMs = parseTime(cloned.createdAt);
      cloned.acceptedMs = parseTime(cloned.acceptedAt);
      cloned.startMs = parseTime(cloned.startedAt);
      cloned.readyMs = parseTime(cloned.readyAt);
      cloned.completedMs = parseTime(cloned.completedAt);
      cloned.updatedMs = parseTime(cloned.updatedAt);
      cloned.dueMs = parseTime(cloned.dueAt);
      return cloned;
    });
  };

  const indexJobs = (jobsList)=>{
    const list = Array.isArray(jobsList) ? jobsList.slice() : [];
    list.sort((a, b)=>{
      const aKey = a.acceptedMs ?? a.createdMs ?? 0;
      const bKey = b.acceptedMs ?? b.createdMs ?? 0;
      if(aKey === bKey){
        const aPriority = STATUS_PRIORITY[a.status] ?? 0;
        const bPriority = STATUS_PRIORITY[b.status] ?? 0;
        return bPriority - aPriority;
      }
      return aKey - bKey;
    });

    const byStation = {};
    const byService = {};
    const orderMap = new Map();
    const stats = { total:list.length, expedite:0, alerts:0, ready:0, pending:0 };

    list.forEach(job=>{
      const stationId = job.stationId || 'general';
      (byStation[stationId] || (byStation[stationId] = [])).push(job);
      const service = job.serviceMode || job.orderTypeId || 'dine_in';
      (byService[service] || (byService[service] = [])).push(job);
      const orderKey = job.orderId || job.orderNumber || job.id;
      if(!orderMap.has(orderKey)){
        orderMap.set(orderKey, {
          orderId: job.orderId || orderKey,
          orderNumber: job.orderNumber || orderKey,
          serviceMode: service,
          tableLabel: job.tableLabel || null,
          customerName: job.customerName || null,
          createdAt: job.createdAt || job.acceptedAt || job.startedAt,
          createdMs: job.createdMs || job.acceptedMs || job.startMs,
          jobs: []
        });
      }
      orderMap.get(orderKey).jobs.push(job);
      if(job.isExpedite) stats.expedite += 1;
      if(job.hasAlerts) stats.alerts += 1;
      if(job.status === 'ready' || job.status === 'completed') stats.ready += 1; else stats.pending += 1;
    });

    const orders = Array.from(orderMap.values()).map(order=>{
      order.jobs.sort((a, b)=>{
        if(a.stationId === b.stationId) return (a.startMs || a.acceptedMs || 0) - (b.startMs || b.acceptedMs || 0);
        return (a.stationId || '').localeCompare(b.stationId || '');
      });
      return order;
    });
    orders.sort((a, b)=> (a.createdMs || 0) - (b.createdMs || 0));

    return { list, byStation, byService, orders, stats };
  };

  const buildExpoTickets = (expoSource, jobsIndex)=>{
    const source = Array.isArray(expoSource) ? expoSource : [];
    const jobMap = new Map((jobsIndex.list || []).map(job=> [job.id, job]));
    return source.map(ticket=>{
      const jobOrderIds = Array.isArray(ticket.jobOrderIds) ? ticket.jobOrderIds : [];
      const jobs = jobOrderIds.map(id=> jobMap.get(id)).filter(Boolean);
      const readyItems = jobs.length ? sum(jobs, job=> job.completedItems || 0) : (ticket.readyItems || 0);
      const totalItems = jobs.length ? sum(jobs, job=> job.totalItems || (job.details ? job.details.length : 0)) : (ticket.totalItems || 0);
      const status = ticket.status || (totalItems > 0 && readyItems >= totalItems ? 'ready' : 'awaiting');
      return { ...ticket, jobs, readyItems, totalItems, status };
    });
  };

  const buildStations = (database, kdsSource)=>{
    const stations = Array.isArray(kdsSource?.stations) && kdsSource.stations.length
      ? kdsSource.stations.map(station=>({ ...station }))
      : [];
    if(stations.length) return stations;
    const sections = Array.isArray(database?.kitchen_sections) ? database.kitchen_sections : [];
    return sections.map((section, idx)=>({
      id: section.id,
      code: section.id?.toUpperCase?.() || section.id,
      nameAr: section.section_name?.ar || section.id,
      nameEn: section.section_name?.en || section.id,
      stationType: section.id === 'expo' ? 'expo' : 'prep',
      isExpo: section.id === 'expo',
      sequence: idx + 1,
      themeColor: null,
      displayConfig: { layout:'grid', columns:2 },
      autoRouteRules: [],
      createdAt: null,
      updatedAt: null
    }));
  };

  const buildTabs = (db, t)=>{
    const tabs = [];
    const { filters, jobs, expoTickets } = db.data;
    const locked = filters.lockedSection;
    if(!locked){
      tabs.push({ id:'prep', label:t.tabs.prep, count: jobs.orders.length });
    }
    const stationOrder = (db.data.stations || []).slice().sort((a, b)=> (a.sequence || 0) - (b.sequence || 0));
    stationOrder.forEach(station=>{
      if(locked && station.id !== filters.activeTab) return;
      tabs.push({
        id: station.id,
        label: db.env.lang === 'ar' ? (station.nameAr || station.nameEn || station.id) : (station.nameEn || station.nameAr || station.id),
        count: (jobs.byStation[station.id] || []).length,
        color: station.themeColor || null
      });
    });
    if(!locked){
      tabs.push({ id:'expo', label:t.tabs.expo, count: expoTickets.length });
      const deliveryCount = (jobs.byService.delivery || []).length;
      tabs.push({ id:'delivery', label:t.tabs.delivery, count: deliveryCount });
      const pendingCount = getPendingDeliveryOrders(db).length;
      tabs.push({ id:'delivery-pending', label:t.tabs.pendingDelivery, count: pendingCount });
    }
    return tabs;
  };

  const getDeliveryOrders = (db)=>{
    const deliveriesState = db.data.deliveries || {};
    const assignments = deliveriesState.assignments || {};
    const settlements = deliveriesState.settlements || {};
    return (db.data.jobs.orders || [])
      .filter(order=> (order.serviceMode || 'dine_in') === 'delivery')
      .map(order=> ({
        ...order,
        assignment: assignments[order.orderId] || null,
        settlement: settlements[order.orderId] || null
      }));
  };

  const getPendingDeliveryOrders = (db)=> getDeliveryOrders(db)
    .filter(order=>{
      const settlement = order.settlement;
      const assigned = order.assignment;
      if(!assigned || assigned.status !== 'delivered') return false;
      if(!settlement) return true;
      return settlement.status !== 'settled';
    });

  const createBadge = (text, className)=> D.Text.Span({ attrs:{ class: cx(tw`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold`, className) } }, [text]);

  const renderEmpty = (message)=> D.Containers.Div({ attrs:{ class: tw`flex min-h-[240px] w-full flex-col items-center justify-center gap-3 rounded-3xl border border-slate-800/60 bg-slate-900/60 text-center text-slate-300` }}, [
    D.Text.Span({ attrs:{ class: tw`text-3xl` }}, ['🍽️']),
    D.Text.P({ attrs:{ class: tw`max-w-md text-sm leading-relaxed text-slate-400` }}, [message])
  ]);

  const renderHeader = (db, t)=>{
    const stats = db.data.jobs.stats || { total:0, expedite:0, alerts:0, ready:0, pending:0 };
    const lang = db.env.lang || 'ar';
    const now = db.data.now || Date.now();
    const statusState = db.data.sync?.state || 'online';
    const statusLabel = t.status[statusState] || t.status.online;
    return D.Containers.Header({ attrs:{ class: tw`px-6 pt-6 pb-4` }}, [
      D.Containers.Div({ attrs:{ class: tw`flex flex-col gap-5 rounded-3xl border border-slate-800/70 bg-slate-900/80 p-6 shadow-xl shadow-slate-950/40 backdrop-blur` }}, [
        D.Containers.Div({ attrs:{ class: tw`flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between` }}, [
          D.Containers.Div({ attrs:{ class: tw`flex flex-col gap-1` }}, [
            D.Text.H1({ attrs:{ class: tw`text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl` }}, [t.title]),
            D.Text.P({ attrs:{ class: tw`text-sm text-slate-300` }}, [t.subtitle])
          ]),
          D.Containers.Div({ attrs:{ class: tw`flex flex-wrap items-center gap-3` }}, [
            createBadge(statusLabel, tw`border-sky-400/40 bg-sky-500/10 text-sky-100`),
            createBadge(formatClock(now, lang), tw`border-slate-500/40 bg-slate-800/60 text-slate-100`),
            createBadge(`${t.stats.total}: ${stats.total}`, tw`border-slate-600/40 bg-slate-800/70 text-slate-100`)
          ])
        ]),
        D.Containers.Div({ attrs:{ class: tw`grid gap-3 sm:grid-cols-2 xl:grid-cols-4` }}, [
          D.Containers.Div({ attrs:{ class: tw`rounded-2xl border border-slate-800/50 bg-slate-900/70 p-4` }}, [
            D.Text.Span({ attrs:{ class: tw`text-xs uppercase tracking-wide text-slate-400` }}, [t.stats.expedite]),
            D.Text.Span({ attrs:{ class: tw`mt-1 text-2xl font-bold text-sky-200` }}, [String(stats.expedite || 0)])
          ]),
          D.Containers.Div({ attrs:{ class: tw`rounded-2xl border border-slate-800/50 bg-slate-900/70 p-4` }}, [
            D.Text.Span({ attrs:{ class: tw`text-xs uppercase tracking-wide text-slate-400` }}, [t.stats.alerts]),
            D.Text.Span({ attrs:{ class: tw`mt-1 text-2xl font-bold text-amber-200` }}, [String(stats.alerts || 0)])
          ]),
          D.Containers.Div({ attrs:{ class: tw`rounded-2xl border border-slate-800/50 bg-slate-900/70 p-4` }}, [
            D.Text.Span({ attrs:{ class: tw`text-xs uppercase tracking-wide text-slate-400` }}, [t.stats.ready]),
            D.Text.Span({ attrs:{ class: tw`mt-1 text-2xl font-bold text-emerald-200` }}, [String(stats.ready || 0)])
          ]),
          D.Containers.Div({ attrs:{ class: tw`rounded-2xl border border-slate-800/50 bg-slate-900/70 p-4` }}, [
            D.Text.Span({ attrs:{ class: tw`text-xs uppercase tracking-wide text-slate-400` }}, [t.stats.pending]),
            D.Text.Span({ attrs:{ class: tw`mt-1 text-2xl font-bold text-slate-200` }}, [String(stats.pending || 0)])
          ])
        ])
      ])
    ]);
  };

  const renderTabs = (db, t)=>{
    const tabs = buildTabs(db, t);
    const active = db.data.filters.activeTab;
    if(!tabs.length) return null;
    return D.Containers.Nav({ attrs:{ class: tw`mb-5 flex flex-wrap gap-3` }}, [
      ...tabs.map(tab=> D.Forms.Button({
        attrs:{
          type:'button',
          'data-m-gkey':'kds:tab:switch',
          'data-section-id': tab.id,
          class: cx(
            tw`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition`,
            tab.id === active
              ? tw`border-sky-400/60 bg-sky-500/20 text-sky-50 shadow-lg shadow-sky-900/40`
              : tw`border-slate-700/70 bg-slate-900/60 text-slate-300 hover:text-slate-100`
          )
        }
      }, [
        D.Text.Span(null, [tab.label]),
        typeof tab.count === 'number' ? D.Text.Span({ attrs:{ class: tw`inline-flex min-w-[2rem] justify-center rounded-full bg-slate-800/70 px-2 py-0.5 text-xs font-bold text-slate-200` }}, [String(tab.count)]) : null
      ].filter(Boolean)))
    ]);
  };

  const renderJobBadges = (job, t, lang)=>{
    const badges = [];
    const service = job.serviceMode || job.orderTypeId || 'dine_in';
    const serviceLabel = t.labels.serviceMode[service] || service;
    badges.push(createBadge(`${SERVICE_ICONS[service] || '🧾'} ${serviceLabel}`, tw`border-slate-500/40 bg-slate-800/60 text-slate-100`));
    if(job.tableLabel) badges.push(createBadge(`${t.labels.table} ${job.tableLabel}`, tw`border-slate-500/40 bg-slate-800/60 text-slate-100`));
    if(job.customerName && !job.tableLabel) badges.push(createBadge(`${t.labels.customer}: ${job.customerName}`, tw`border-slate-500/40 bg-slate-800/60 text-slate-100`));
    if(job.isExpedite) badges.push(createBadge('⚡ expedite', tw`border-amber-300/50 bg-amber-500/20 text-amber-50`));
    if(job.hasAlerts) badges.push(createBadge('🚨 alert', tw`border-rose-400/60 bg-rose-500/20 text-rose-100`));
    if(job.dueAt) badges.push(createBadge(`${t.labels.due}: ${formatClock(job.dueAt, lang)}`, tw`border-slate-500/40 bg-slate-800/60 text-slate-100`));
    return badges;
  };

  const renderDetailRow = (detail, t, lang)=>{
    const statusLabel = t.labels.jobStatus[detail.status] || detail.status;
    return D.Containers.Div({ attrs:{ class: tw`flex flex-col gap-2 rounded-2xl border border-slate-800/60 bg-slate-900/60 p-3` }}, [
      D.Containers.Div({ attrs:{ class: tw`flex items-start justify-between gap-3` }}, [
        D.Text.Strong({ attrs:{ class: tw`text-sm text-slate-100` }}, [`${detail.quantity}× ${lang === 'ar' ? (detail.itemNameAr || detail.itemNameEn || detail.itemId) : (detail.itemNameEn || detail.itemNameAr || detail.itemId)}`]),
        createBadge(statusLabel, STATUS_CLASS[detail.status] || tw`border-slate-600/40 bg-slate-800/70 text-slate-100`)
      ]),
      detail.prepNotes ? D.Text.P({ attrs:{ class: tw`text-xs text-slate-300` }}, [`📝 ${detail.prepNotes}`]) : null,
      detail.modifiers && detail.modifiers.length ? D.Containers.Div({ attrs:{ class: tw`flex flex-wrap gap-2` }}, detail.modifiers.map(mod=>{
        const typeText = mod.modifierType === 'remove'
          ? (lang === 'ar' ? 'بدون' : 'No')
          : mod.modifierType === 'add'
            ? (lang === 'ar' ? 'إضافة' : 'Add')
            : mod.modifierType;
        return D.Text.Span({ attrs:{ class: tw`inline-flex items-center rounded-full bg-indigo-500/20 px-2 py-0.5 text-[11px] text-indigo-100` }}, [`${typeText}: ${lang === 'ar' ? (mod.nameAr || mod.nameEn) : (mod.nameEn || mod.nameAr)}`]);
      })) : null
    ].filter(Boolean));
  };

  const renderHistory = (job, t, lang)=>{
    if(!job.history || !job.history.length) return null;
    const lastEntries = job.history.slice(-2);
    const heading = lang === 'ar' ? '⏱️ آخر الحالات' : '⏱️ Recent updates';
    return D.Containers.Div({ attrs:{ class: tw`flex flex-col gap-1 rounded-2xl border border-slate-800/60 bg-slate-900/60 p-3` }}, [
      D.Text.Span({ attrs:{ class: tw`text-xs font-semibold uppercase tracking-wide text-slate-400` }}, [heading]),
      ...lastEntries.map(entry=> D.Text.Span({ attrs:{ class: tw`text-xs text-slate-300` }}, [`${formatClock(entry.changedAt, lang)} · ${t.labels.jobStatus[entry.status] || entry.status}${entry.actorName ? ` — ${entry.actorName}` : ''}`]))
    ]);
  };

  const startJob = (job, nowIso, nowMs)=>{
    if(job.status === 'ready' || job.status === 'completed') return {
      ...job,
      startedAt: job.startedAt || nowIso,
      startMs: job.startMs || nowMs,
      updatedAt: nowIso,
      updatedMs: nowMs
    };
    const details = job.details.map(detail=>{
      if(detail.status === 'ready' || detail.status === 'completed') return detail;
      return {
        ...detail,
        status: 'in_progress',
        startAt: detail.startAt || nowIso,
        updatedAt: nowIso
      };
    });
    const remaining = details.filter(detail=> detail.status !== 'ready' && detail.status !== 'completed').length;
    const completed = details.length - remaining;
    return {
      ...job,
      status: 'in_progress',
      progressState: 'cooking',
      acceptedAt: job.acceptedAt || nowIso,
      acceptedMs: job.acceptedMs || nowMs,
      startedAt: job.startedAt || nowIso,
      startMs: job.startMs || nowMs,
      updatedAt: nowIso,
      updatedMs: nowMs,
      remainingItems: remaining,
      completedItems: completed,
      details,
      history: job.history.concat([{ id:`HIS-${job.id}-${nowMs}`, jobOrderId: job.id, status:'in_progress', actorId:'kds-station', actorName:'KDS Station', actorRole:'station', changedAt: nowIso, meta:{ source:'kds' } }])
    };
  };

  const finishJob = (job, nowIso, nowMs)=>{
    const details = job.details.map(detail=> ({
      ...detail,
      status: 'ready',
      finishAt: detail.finishAt || nowIso,
      updatedAt: nowIso
    }));
    return {
      ...job,
      status: 'ready',
      progressState: 'completed',
      readyAt: job.readyAt || nowIso,
      readyMs: job.readyMs || nowMs,
      completedAt: job.completedAt || nowIso,
      completedMs: job.completedMs || nowMs,
      updatedAt: nowIso,
      updatedMs: nowMs,
      remainingItems: 0,
      completedItems: job.totalItems || details.length,
      details,
      history: job.history.concat([{ id:`HIS-${job.id}-ready-${nowMs}`, jobOrderId: job.id, status:'ready', actorId:'kds-station', actorName:'KDS Station', actorRole:'station', changedAt: nowIso, meta:{ source:'kds' } }])
    };
  };

  const applyJobsUpdate = (state, transform)=>{
    const list = state.data.jobs.list.map(cloneJob);
    const nextList = transform(list) || list;
    const jobs = indexJobs(nextList);
    const expoTickets = buildExpoTickets(state.data.expoSource, jobs);
    return {
      ...state,
      data:{
        ...state.data,
        jobs,
        expoTickets
      }
    };
  };

  const renderJobCard = (job, station, t, lang, now)=>{
    const statusLabel = t.labels.jobStatus[job.status] || job.status;
    const elapsed = job.startMs ? now - job.startMs : 0;
    const duration = job.startMs ? formatDuration(elapsed) : '00:00';
    const stationColor = station?.themeColor || '#38bdf8';
    const headerBadges = renderJobBadges(job, t, lang);
    return D.Containers.Article({ attrs:{ class: tw`relative flex flex-col gap-4 rounded-3xl border border-slate-800/60 bg-slate-950/80 p-5 shadow-xl shadow-slate-950/40` }}, [
      D.Containers.Div({ attrs:{ class: tw`absolute inset-y-0 end-0 w-1 rounded-e-3xl`, style:`background: ${stationColor}; opacity:0.35;` }}, []),
      D.Containers.Div({ attrs:{ class: tw`flex items-start justify-between gap-3` }}, [
        D.Text.H3({ attrs:{ class: tw`text-lg font-semibold text-slate-50` }}, [`${t.labels.order} ${job.orderNumber || job.orderId}`]),
        createBadge(statusLabel, STATUS_CLASS[job.status] || tw`border-slate-600/40 bg-slate-800/70 text-slate-100`)
      ]),
      headerBadges.length ? D.Containers.Div({ attrs:{ class: tw`flex flex-wrap gap-2` }}, headerBadges) : null,
      D.Containers.Div({ attrs:{ class: tw`grid gap-2 rounded-2xl border border-slate-800/60 bg-slate-900/60 p-3 text-xs text-slate-300 sm:grid-cols-2` }}, [
        D.Text.Span(null, [`${t.labels.timer}: ${duration}`]),
        D.Text.Span(null, [`${t.labels.due}: ${formatClock(job.dueAt || job.readyAt || job.completedAt || job.startedAt, lang)}`]),
        D.Text.Span(null, [`${t.stats.pending}: ${job.remainingItems ?? Math.max(0, (job.totalItems || job.details.length) - (job.completedItems || 0))}`]),
        D.Text.Span(null, [`${t.stats.ready}: ${job.completedItems || 0}`])
      ]),
      job.notes ? D.Text.P({ attrs:{ class: tw`text-sm text-amber-200` }}, [`🧾 ${job.notes}`]) : null,
      job.details && job.details.length ? D.Containers.Div({ attrs:{ class: tw`flex flex-col gap-2` }}, job.details.map(detail=> renderDetailRow(detail, t, lang))) : null,
      renderHistory(job, t, lang),
      D.Containers.Div({ attrs:{ class: tw`flex flex-wrap gap-2 pt-2` }}, [
        job.status !== 'ready' && job.status !== 'completed'
          ? D.Forms.Button({ attrs:{ type:'button', 'data-m-gkey':'kds:job:start', 'data-job-id':job.id, class: tw`flex-1 rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-sky-900/50 transition hover:bg-sky-400` }}, [t.actions.start])
          : null,
        job.status !== 'ready'
          ? D.Forms.Button({ attrs:{ type:'button', 'data-m-gkey':'kds:job:finish', 'data-job-id':job.id, class: tw`flex-1 rounded-full border border-emerald-400/50 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/20` }}, [t.actions.finish])
          : createBadge(t.labels.jobStatus.ready, STATUS_CLASS.ready)
      ].filter(Boolean))
    ].filter(Boolean));
  };

  const renderPrepPanel = (db, t, lang, now)=>{
    const orders = db.data.jobs.orders || [];
    if(!orders.length) return renderEmpty(t.empty.prep);
    const stationMap = db.data.stationMap || {};
    return D.Containers.Section({ attrs:{ class: tw`grid gap-4 lg:grid-cols-2 xl:grid-cols-3` }}, orders.map(order=> D.Containers.Article({ attrs:{ class: tw`flex flex-col gap-4 rounded-3xl border border-slate-800/60 bg-slate-950/80 p-5 shadow-xl shadow-slate-950/40` }}, [
      D.Containers.Div({ attrs:{ class: tw`flex items-start justify-between gap-3` }}, [
        D.Text.H3({ attrs:{ class: tw`text-lg font-semibold text-slate-50` }}, [`${t.labels.order} ${order.orderNumber}`]),
        createBadge(`${SERVICE_ICONS[order.serviceMode] || '🧾'} ${t.labels.serviceMode[order.serviceMode] || order.serviceMode}`, tw`border-slate-500/40 bg-slate-800/60 text-slate-100`)
      ]),
      order.tableLabel ? createBadge(`${t.labels.table} ${order.tableLabel}`, tw`border-slate-500/40 bg-slate-800/60 text-slate-100`) : null,
      order.customerName ? D.Text.P({ attrs:{ class: tw`text-sm text-slate-300` }}, [`${t.labels.customer}: ${order.customerName}`]) : null,
      D.Containers.Div({ attrs:{ class: tw`flex flex-col gap-2` }}, order.jobs.map(job=> D.Containers.Div({ attrs:{ class: tw`flex flex-col gap-1 rounded-2xl border border-slate-800/60 bg-slate-900/60 p-3` }}, [
        D.Containers.Div({ attrs:{ class: tw`flex items-center justify-between gap-3` }}, [
          D.Text.Span({ attrs:{ class: tw`text-sm font-semibold text-slate-100` }}, [stationMap[job.stationId] ? (lang === 'ar' ? (stationMap[job.stationId].nameAr || stationMap[job.stationId].nameEn) : (stationMap[job.stationId].nameEn || stationMap[job.stationId].nameAr)) : job.stationCode || job.stationId]),
          createBadge(t.labels.jobStatus[job.status] || job.status, STATUS_CLASS[job.status] || tw`border-slate-600/40 bg-slate-800/70 text-slate-100`)
        ]),
        D.Text.Span({ attrs:{ class: tw`text-xs text-slate-400` }}, [`${t.labels.timer}: ${job.startMs ? formatDuration(now - job.startMs) : '00:00'}`])
      ])))
    ].filter(Boolean))));
  };

  const renderStationPanel = (db, stationId, t, lang, now)=>{
    const jobs = db.data.jobs.byStation[stationId] || [];
    const station = db.data.stationMap?.[stationId];
    if(!jobs.length) return renderEmpty(t.empty.station);
    return D.Containers.Section({ attrs:{ class: tw`grid gap-4 lg:grid-cols-2 xl:grid-cols-3` }}, jobs.map(job=> renderJobCard(job, station, t, lang, now)));
  };

  const renderExpoPanel = (db, t, lang)=>{
    const tickets = db.data.expoTickets || [];
    if(!tickets.length) return renderEmpty(t.empty.expo);
    return D.Containers.Section({ attrs:{ class: tw`grid gap-4 lg:grid-cols-2 xl:grid-cols-3` }}, tickets.map(ticket=>{
      const ready = ticket.readyItems || 0;
      const total = ticket.totalItems || 0;
      const progress = total > 0 ? Math.min(100, Math.round((ready / total) * 100)) : 0;
      const statusLabel = ready >= total && total > 0 ? t.labels.expoReady : t.labels.expoPending;
      return D.Containers.Article({ attrs:{ class: tw`flex flex-col gap-4 rounded-3xl border border-slate-800/60 bg-slate-950/80 p-5 shadow-xl shadow-slate-950/40` }}, [
        D.Containers.Div({ attrs:{ class: tw`flex items-start justify-between gap-3` }}, [
          D.Text.H3({ attrs:{ class: tw`text-lg font-semibold text-slate-50` }}, [`${t.labels.order} ${ticket.orderNumber}`]),
          createBadge(statusLabel, ready >= total && total > 0 ? STATUS_CLASS.ready : STATUS_CLASS.in_progress)
        ]),
        D.Containers.Div({ attrs:{ class: tw`flex flex-col gap-2 text-sm text-slate-300` }}, [
          D.Text.Span(null, [`${t.stats.ready}: ${ready} / ${total}`]),
          D.Text.Span(null, [`${t.labels.timer}: ${formatClock(ticket.callAt || ticket.createdAt, lang)}`])
        ]),
        D.Containers.Div({ attrs:{ class: tw`h-2 rounded-full bg-slate-800/70` }}, [
          D.Containers.Div({ attrs:{ class: tw`h-full rounded-full bg-sky-500`, style:`width:${progress}%` }}, [])
        ]),
        ticket.jobs && ticket.jobs.length ? D.Containers.Div({ attrs:{ class: tw`flex flex-col gap-2` }}, ticket.jobs.map(job=> D.Text.Span({ attrs:{ class: tw`text-xs text-slate-300` }}, [`${job.stationCode || job.stationId}: ${t.labels.jobStatus[job.status] || job.status}`]))) : null
      ].filter(Boolean));
    }));
  };

  const renderDeliveryCard = (order, t, lang, options={})=>{
    const assignment = order.assignment || null;
    const settlement = order.settlement || null;
    const statusKey = settlement?.status === 'settled' ? 'settled' : (assignment?.status || 'pending');
    const statusLabel = t.labels.deliveryStatus[statusKey] || statusKey;
    const driverName = assignment?.driverName || t.labels.notAssigned;
    const driverPhone = assignment?.driverPhone || '—';
    return D.Containers.Article({ attrs:{ class: tw`flex flex-col gap-4 rounded-3xl border border-slate-800/60 bg-slate-950/80 p-5 shadow-xl shadow-slate-950/40` }}, [
      D.Containers.Div({ attrs:{ class: tw`flex items-start justify-between gap-3` }}, [
        D.Text.H3({ attrs:{ class: tw`text-lg font-semibold text-slate-50` }}, [`${t.labels.order} ${order.orderNumber}`]),
        createBadge(statusLabel, DELIVERY_STATUS_CLASS[statusKey] || tw`border-slate-600/40 bg-slate-800/70 text-slate-100`)
      ]),
      order.tableLabel ? D.Text.P({ attrs:{ class: tw`text-sm text-slate-300` }}, [`${t.labels.table}: ${order.tableLabel}`]) : null,
      D.Containers.Div({ attrs:{ class: tw`flex flex-col gap-2 rounded-2xl border border-slate-800/60 bg-slate-900/60 p-3 text-sm text-slate-300` }}, [
        D.Text.Span(null, [`${t.labels.driver}: ${driverName}`]),
        D.Text.Span(null, [`${t.labels.driverPhone}: ${driverPhone}`]),
        assignment?.vehicleId ? D.Text.Span(null, [`🚗 ${assignment.vehicleId}`]) : null
      ].filter(Boolean)),
      D.Containers.Div({ attrs:{ class: tw`flex flex-wrap gap-2` }}, order.jobs.map(job=> createBadge(`${job.stationCode || job.stationId}: ${t.labels.jobStatus[job.status] || job.status}`, STATUS_CLASS[job.status] || tw`border-slate-600/40 bg-slate-800/70 text-slate-100`))),
      D.Containers.Div({ attrs:{ class: tw`flex flex-wrap gap-2 pt-2` }}, [
        D.Forms.Button({ attrs:{ type:'button', 'data-m-gkey':'kds:delivery:assign', 'data-order-id':order.orderId, class: tw`flex-1 rounded-full border border-sky-400/60 bg-sky-500/10 px-4 py-2 text-sm font-semibold text-sky-100 hover:bg-sky-500/20` }}, [t.actions.assignDriver]),
        statusKey !== 'delivered' && statusKey !== 'settled'
          ? D.Forms.Button({ attrs:{ type:'button', 'data-m-gkey':'kds:delivery:complete', 'data-order-id':order.orderId, class: tw`flex-1 rounded-full border border-emerald-400/60 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/20` }}, [t.actions.delivered])
          : null,
        statusKey === 'delivered' || options.focusSettlement
          ? D.Forms.Button({ attrs:{ type:'button', 'data-m-gkey':'kds:delivery:settle', 'data-order-id':order.orderId, class: tw`flex-1 rounded-full border border-amber-400/60 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-500/20` }}, [t.actions.settle])
          : null
      ].filter(Boolean))
    ].filter(Boolean));
  };

  const renderDeliveryPanel = (db, t, lang)=>{
    const orders = getDeliveryOrders(db);
    if(!orders.length) return renderEmpty(t.empty.delivery);
    return D.Containers.Section({ attrs:{ class: tw`grid gap-4 lg:grid-cols-2` }}, orders.map(order=> renderDeliveryCard(order, t, lang)));
  };

  const renderPendingDeliveryPanel = (db, t, lang)=>{
    const orders = getPendingDeliveryOrders(db);
    if(!orders.length) return renderEmpty(t.empty.pending);
    return D.Containers.Section({ attrs:{ class: tw`grid gap-4 lg:grid-cols-2` }}, orders.map(order=> renderDeliveryCard(order, t, lang, { focusSettlement:true })));
  };

  const DriverModal = (db, t, lang)=>{
    const open = db.ui?.modals?.driver || false;
    if(!open) return null;
    const assignment = db.ui?.deliveryAssignment || {};
    const orderId = assignment.orderId;
    const drivers = Array.isArray(db.data.drivers) ? db.data.drivers : [];
    const order = (db.data.jobs.orders || []).find(o=> o.orderId === orderId);
    const subtitle = order ? `${t.labels.order} ${order.orderNumber}` : '';
    return UI.Modal({
      open,
      title: t.modal.driverTitle,
      description: subtitle || t.modal.driverDescription,
      content: D.Containers.Div({ attrs:{ class: tw`flex flex-col gap-3` }}, [
        D.Text.P({ attrs:{ class: tw`text-sm text-slate-300` }}, [t.modal.driverDescription]),
        D.Containers.Div({ attrs:{ class: tw`flex flex-col gap-2` }}, drivers.map(driver=> D.Forms.Button({ attrs:{
          type:'button',
          'data-m-gkey':'kds:delivery:select-driver',
          'data-order-id': orderId,
          'data-driver-id': String(driver.id),
          class: tw`flex items-center justify-between rounded-xl border border-slate-700/60 bg-slate-900/70 px-4 py-3 text-start text-sm text-slate-100 hover:border-sky-400/60 hover:bg-sky-500/10`
        }}, [
          D.Containers.Div({ attrs:{ class: tw`flex flex-col` }}, [
            D.Text.Strong({ attrs:{ class: tw`text-sm` }}, [driver.name || driver.id]),
            driver.phone ? D.Text.Span({ attrs:{ class: tw`text-xs text-slate-300` }}, [driver.phone]) : null
          ].filter(Boolean)),
          D.Text.Span({ attrs:{ class: tw`text-base` }}, ['🚚'])
        ])))
      ]),
      actions:[
        {
          label: t.modal.close,
          gkey:'ui:modal:close',
          variant:'secondary'
        }
      ]
    });
  };

  const renderActivePanel = (db, t, lang, now)=>{
    const active = db.data.filters.activeTab;
    if(active === 'prep') return renderPrepPanel(db, t, lang, now);
    if(active === 'expo') return renderExpoPanel(db, t, lang);
    if(active === 'delivery') return renderDeliveryPanel(db, t, lang);
    if(active === 'delivery-pending') return renderPendingDeliveryPanel(db, t, lang);
    return renderStationPanel(db, active, t, lang, now);
  };

  const AppView = (db)=>{
    const lang = db.env.lang || 'ar';
    const t = TEXTS[lang] || TEXTS.ar;
    const now = db.data.now || Date.now();
    return UI.AppRoot({
      shell: D.Containers.Div({ attrs:{ class: tw`flex min-h-screen w-full flex-col bg-slate-950/95 text-slate-100` }}, [
        renderHeader(db, t),
        D.Containers.Main({ attrs:{ class: tw`flex-1 min-h-0 w-full px-6 pb-6` }}, [
          db.data.filters.lockedSection ? null : renderTabs(db, t),
          renderActivePanel(db, t, lang, now)
        ].filter(Boolean))
      ]),
      overlays:[ DriverModal(db, t, lang) ].filter(Boolean)
    });
  };

  Mishkah.app.setBody(AppView);

  const database = typeof window !== 'undefined' ? (window.database || {}) : {};
  const kdsSource = database.kds || (typeof window !== 'undefined' ? window.kdsDatabase : null) || {};
  const stations = buildStations(database, kdsSource);
  const stationMap = stations.reduce((acc, station)=>{
    acc[station.id] = station;
    return acc;
  }, {});
  const rawJobOrders = cloneDeep(kdsSource.jobOrders || {});
  const jobRecords = buildJobRecords(rawJobOrders);
  const jobsIndexed = indexJobs(jobRecords);
  const expoSource = Array.isArray(rawJobOrders.expoPassTickets) ? rawJobOrders.expoPassTickets.map(ticket=>({ ...ticket })) : [];
  const expoTickets = buildExpoTickets(expoSource, jobsIndexed);

  const urlParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const sectionParam = urlParams.get('section_id');
  const lockedSection = !!sectionParam;
  const firstStationId = stations.length ? stations[0].id : 'prep';
  const defaultTab = lockedSection ? (stationMap[sectionParam] ? sectionParam : firstStationId) : 'prep';

  const initialState = {
    head:{ title: TEXTS.ar.title },
    env:{ theme:'dark', lang:'ar', dir:'rtl' },
    data:{
      meta: kdsSource.metadata || {},
      sync:{ state:'online', lastMessage:null },
      stations,
      stationMap,
      jobs: jobsIndexed,
      expoSource,
      expoTickets,
      jobOrders: rawJobOrders,
      filters:{ activeTab: defaultTab, lockedSection },
      deliveries:{ assignments:{}, settlements:{} },
      drivers: Array.isArray(database.drivers) ? database.drivers.map(driver=>({ ...driver })) : [],
      now: Date.now()
    },
    ui:{
      modals:{ driver:false },
      modalOpen:false,
      deliveryAssignment:null
    }
  };

  const app = M.app.createApp(initialState, {});
  const auto = U.twcss.auto(initialState, app, { pageScaffold:true });

  let broadcastChannel = null;
  if(typeof BroadcastChannel !== 'undefined'){
    try{
      broadcastChannel = new BroadcastChannel('mishkah-pos-kds-sync');
      broadcastChannel.onmessage = (event)=>{
        const msg = event?.data;
        if(!msg || !msg.type) return;
        if(msg.type === 'job:update' && msg.jobId){
          const payload = msg.payload || {};
          app.setState(state=> applyJobsUpdate(state, list=> list.map(job=> job.id === msg.jobId ? ({
            ...job,
            status: payload.status || job.status,
            progressState: payload.progressState || job.progressState,
            readyAt: payload.readyAt || job.readyAt,
            readyMs: parseTime(payload.readyAt) || job.readyMs,
            completedAt: payload.completedAt || job.completedAt,
            completedMs: parseTime(payload.completedAt) || job.completedMs,
            updatedAt: payload.updatedAt || job.updatedAt,
            updatedMs: parseTime(payload.updatedAt) || job.updatedMs
          }) : job)));
        }
        if(msg.type === 'delivery:update' && msg.orderId){
          const payload = msg.payload || {};
          app.setState(state=>{
            const deliveries = state.data.deliveries || { assignments:{}, settlements:{} };
            const assignments = { ...(deliveries.assignments || {}) };
            const settlements = { ...(deliveries.settlements || {}) };
            if(payload.assignment){
              assignments[msg.orderId] = { ...(assignments[msg.orderId] || {}), ...payload.assignment };
            }
            if(payload.settlement){
              settlements[msg.orderId] = { ...(settlements[msg.orderId] || {}), ...payload.settlement };
            }
            return {
              ...state,
              data:{
                ...state.data,
                deliveries:{ assignments, settlements }
              }
            };
          });
        }
      };
    } catch(_err) {
      broadcastChannel = null;
    }
  }

  const emitSync = (message)=>{
    if(!broadcastChannel) return;
    try{ broadcastChannel.postMessage(message); } catch(_err){}
  };

  const kdsOrders = {
    'kds.tab.switch':{
      on:['click'],
      gkeys:['kds:tab:switch'],
      handler:(event, ctx)=>{
        const target = event?.currentTarget;
        const sectionId = target?.dataset?.sectionId;
        if(!sectionId) return;
        ctx.setState(state=>({
          ...state,
          data:{
            ...state.data,
            filters:{ ...state.data.filters, activeTab: sectionId }
          }
        }));
      }
    },
    'kds.job.start':{
      on:['click'],
      gkeys:['kds:job:start'],
      handler:(event, ctx)=>{
        const jobId = event?.currentTarget?.dataset?.jobId;
        if(!jobId) return;
        const nowIso = new Date().toISOString();
        const nowMs = Date.parse(nowIso);
        ctx.setState(state=> applyJobsUpdate(state, list=> list.map(job=> job.id === jobId ? startJob(job, nowIso, nowMs) : job)));
        emitSync({ type:'job:update', jobId, payload:{ status:'in_progress', progressState:'cooking', startedAt: nowIso, updatedAt: nowIso } });
      }
    },
    'kds.job.finish':{
      on:['click'],
      gkeys:['kds:job:finish'],
      handler:(event, ctx)=>{
        const jobId = event?.currentTarget?.dataset?.jobId;
        if(!jobId) return;
        const nowIso = new Date().toISOString();
        const nowMs = Date.parse(nowIso);
        ctx.setState(state=> applyJobsUpdate(state, list=> list.map(job=> job.id === jobId ? finishJob(job, nowIso, nowMs) : job)));
        emitSync({ type:'job:update', jobId, payload:{ status:'ready', progressState:'completed', readyAt: nowIso, completedAt: nowIso, updatedAt: nowIso } });
      }
    },
    'kds.delivery.assign':{
      on:['click'],
      gkeys:['kds:delivery:assign'],
      handler:(event, ctx)=>{
        const orderId = event?.currentTarget?.dataset?.orderId;
        if(!orderId) return;
        ctx.setState(state=>({
          ...state,
          ui:{
            ...(state.ui || {}),
            modalOpen:true,
            modals:{ ...(state.ui?.modals || {}), driver:true },
            deliveryAssignment:{ orderId }
          }
        }));
      }
    },
    'kds.delivery.selectDriver':{
      on:['click'],
      gkeys:['kds:delivery:select-driver'],
      handler:(event, ctx)=>{
        const dataset = event?.currentTarget?.dataset || {};
        const orderId = dataset.orderId;
        const driverId = dataset.driverId;
        if(!orderId || !driverId) return;
        const nowIso = new Date().toISOString();
        ctx.setState(state=>{
          const deliveries = state.data.deliveries || { assignments:{}, settlements:{} };
          const assignments = { ...(deliveries.assignments || {}) };
          const driver = (state.data.drivers || []).find(d=> String(d.id) === driverId) || {};
          assignments[orderId] = {
            ...(assignments[orderId] || {}),
            driverId,
            driverName: driver.name || driverId,
            driverPhone: driver.phone || '',
            vehicleId: driver.vehicle_id || driver.vehicleId || '',
            status: 'assigned',
            assignedAt: assignments[orderId]?.assignedAt || nowIso
          };
          emitSync({ type:'delivery:update', orderId, payload:{ assignment: assignments[orderId] } });
          return {
            ...state,
            data:{
              ...state.data,
              deliveries:{ assignments, settlements: { ...(deliveries.settlements || {}) } }
            },
            ui:{
              ...(state.ui || {}),
              modalOpen:false,
              modals:{ ...(state.ui?.modals || {}), driver:false },
              deliveryAssignment:null
            }
          };
        });
      }
    },
    'kds.delivery.complete':{
      on:['click'],
      gkeys:['kds:delivery:complete'],
      handler:(event, ctx)=>{
        const orderId = event?.currentTarget?.dataset?.orderId;
        if(!orderId) return;
        const nowIso = new Date().toISOString();
        ctx.setState(state=>{
          const deliveries = state.data.deliveries || { assignments:{}, settlements:{} };
          const assignments = { ...(deliveries.assignments || {}) };
          const settlements = { ...(deliveries.settlements || {}) };
          assignments[orderId] = {
            ...(assignments[orderId] || {}),
            status:'delivered',
            deliveredAt: nowIso
          };
          settlements[orderId] = settlements[orderId] || { status:'pending', updatedAt: nowIso };
          emitSync({ type:'delivery:update', orderId, payload:{ assignment: assignments[orderId] } });
          return {
            ...state,
            data:{
              ...state.data,
              deliveries:{ assignments, settlements }
            }
          };
        });
      }
    },
    'kds.delivery.settle':{
      on:['click'],
      gkeys:['kds:delivery:settle'],
      handler:(event, ctx)=>{
        const orderId = event?.currentTarget?.dataset?.orderId;
        if(!orderId) return;
        const nowIso = new Date().toISOString();
        ctx.setState(state=>{
          const deliveries = state.data.deliveries || { assignments:{}, settlements:{} };
          const settlements = { ...(deliveries.settlements || {}) };
          settlements[orderId] = { ...(settlements[orderId] || {}), status:'settled', settledAt: nowIso };
          emitSync({ type:'delivery:update', orderId, payload:{ settlement: settlements[orderId] } });
          return {
            ...state,
            data:{
              ...state.data,
              deliveries:{ assignments: { ...(deliveries.assignments || {}) }, settlements }
            }
          };
        });
      }
    },
    'ui.modal.close':{
      on:['click'],
      gkeys:['ui:modal:close'],
      handler:(event, ctx)=>{
        event?.preventDefault();
        ctx.setState(state=>({
          ...state,
          ui:{
            ...(state.ui || {}),
            modalOpen:false,
            modals:{ ...(state.ui?.modals || {}), driver:false },
            deliveryAssignment:null
          }
        }));
      }
    }
  };

  app.setOrders(Object.assign({}, UI.orders || {}, auto.orders || {}, kdsOrders));
  app.mount('#app');

  const tick = setInterval(()=>{
    app.setState(state=>({
      ...state,
      data:{
        ...state.data,
        now: Date.now()
      }
    }));
  }, 1000);

  if(typeof window !== 'undefined'){
    window.addEventListener('beforeunload', ()=> clearInterval(tick));
  }
})();
