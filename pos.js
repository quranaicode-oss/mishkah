

(async function(){
  

    const M = Mishkah;
    const UI = M.UI;
    const U = M.utils;
    const D = M.DSL;
    const Schema = M.schema;
    const { tw, token } = U.twcss;
    const BASE_PALETTE = U.twcss?.PALETTE || {};

    const JSONX = U.JSON || {};
    const hasStructuredClone = typeof structuredClone === 'function';
    const isPlainObject = value => value && typeof value === 'object' && !Array.isArray(value);
    const cloneDeep = (value)=>{
      if(value == null) return value;
      if(JSONX && typeof JSONX.clone === 'function') return JSONX.clone(value);
      if(hasStructuredClone){
        try{ return structuredClone(value); } catch(_err){}
      }
      try{ return JSON.parse(JSON.stringify(value)); } catch(_err){
        if(Array.isArray(value)) return value.slice();
        if(isPlainObject(value)) return { ...value };
        return value;
      }
    };
    const mergePreferRemote = (base, patch)=>{
      if(patch === undefined) return cloneDeep(base);
      if(patch === null) return null;
      if(Array.isArray(patch)) return patch.map(entry=> cloneDeep(entry));
      if(isPlainObject(patch)){
        const baseObj = isPlainObject(base) ? base : {};
        const target = cloneDeep(baseObj);
        Object.keys(patch).forEach(key=>{
          target[key] = mergePreferRemote(baseObj[key], patch[key]);
        });
        return target;
      }
      return cloneDeep(patch);
    };
    const JSONISH_FIX_KEYS = /([,{]\s*)([A-Za-z0-9_]+)\s*:/g;
    const JSON_PARSE_FAIL = Symbol('json:fail');
    const tryParseJson = (value)=>{
      if(typeof value !== 'string') return JSON_PARSE_FAIL;
      if(JSONX && typeof JSONX.parseSafe === 'function'){
        return JSONX.parseSafe(value, JSON_PARSE_FAIL);
      }
      try{ return JSON.parse(value); } catch(_err){ return JSON_PARSE_FAIL; }
    };
    const parseMaybeJSONish = (value)=>{
      if(typeof value !== 'string') return value;
      const trimmed = value.trim();
      if(!trimmed) return value;
      const candidates = [trimmed];
      if(trimmed[0] !== '{' && trimmed[0] !== '[' && trimmed.includes(':')){
        let normalized = trimmed;
        if(!normalized.startsWith('{')) normalized = `{${normalized}`;
        if(!normalized.endsWith('}') && normalized.includes(':')) normalized = `${normalized}}`;
        candidates.push(normalized);
      }
      for(const candidate of candidates){
        const direct = tryParseJson(candidate);
        if(direct !== JSON_PARSE_FAIL) return direct;
        const first = candidate[0];
        const last = candidate[candidate.length - 1];
        const looksStructured = (first === '{' && last === '}') || (first === '[' && last === ']');
        if(!looksStructured) continue;
        const sanitized = candidate
          .replace(JSONISH_FIX_KEYS, '$1"$2":')
          .replace(/'/g, '"')
          .replace(/,(\s*[}\]])/g, '$1');
        const parsed = tryParseJson(sanitized);
        if(parsed !== JSON_PARSE_FAIL) return parsed;
      }
      return value;
    };
    const ensureLocaleObject = (value, fallback)=>{
      const parsed = parseMaybeJSONish(value);
      const locale = {};
      if(parsed && typeof parsed === 'object' && !Array.isArray(parsed)){
        Object.keys(parsed).forEach(key=>{
          const rawKey = key.toLowerCase();
          const normalizedKey = rawKey.startsWith('ar') ? 'ar'
            : rawKey.startsWith('en') ? 'en'
              : rawKey;
          const entryValue = parsed[key];
          if(entryValue == null) return;
          locale[normalizedKey] = typeof entryValue === 'string' ? entryValue : String(entryValue);
        });
      } else if(typeof parsed === 'string' && parsed.trim()){
        const text = parsed.trim();
        locale.ar = text;
        locale.en = text;
      }
      if(!locale.en && locale.ar) locale.en = locale.ar;
      if(!locale.ar && locale.en) locale.ar = locale.en;
      if(Object.keys(locale).length) return locale;
      if(!fallback) return {};
      const clonedFallback = {};
      Object.keys(fallback).forEach(key=>{
        if(fallback[key] == null) return;
        clonedFallback[key] = typeof fallback[key] === 'string' ? fallback[key] : String(fallback[key]);
      });
      if(!clonedFallback.en && clonedFallback.ar) clonedFallback.en = clonedFallback.ar;
      if(!clonedFallback.ar && clonedFallback.en) clonedFallback.ar = clonedFallback.en;
      return clonedFallback;
    };
    const ensurePlainObject = (value)=>{
      const parsed = parseMaybeJSONish(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    };
    const firstDefined = (...values)=>{
      for(let i = 0; i < values.length; i += 1){
        if(values[i] !== undefined) return values[i];
      }
      return undefined;
    };
    const ensureBoolean = (value, fallback=false)=>{
      if(value === undefined || value === null) return fallback;
      if(typeof value === 'boolean') return value;
      if(typeof value === 'number') return value !== 0;
      if(typeof value === 'string'){
        const normalized = value.trim().toLowerCase();
        if(!normalized) return fallback;
        if(['1', 'true', 'yes', 'y', 'on', 'enable', 'enabled'].includes(normalized)) return true;
        if(['0', 'false', 'no', 'n', 'off', 'disable', 'disabled'].includes(normalized)) return false;
      }
      return fallback;
    };

    function createDiagnosticsStore(limit=200){
      let entries = [];
      const subscribers = new Set();
      const notify = ()=>{
        const snapshot = entries.slice();
        subscribers.forEach(fn=>{
          try { fn(snapshot); } catch(_err){}
        });
      };
      return {
        push(entry={}){
          const record = {
            id: entry.id || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
            ts: entry.ts || Date.now(),
            level: entry.level || 'info',
            source: entry.source || 'central-sync',
            event: entry.event || 'unknown',
            message: entry.message || '',
            data: entry.data || {},
            status: entry.status || null
          };
          entries = [...entries.slice(Math.max(0, entries.length - (limit - 1))), record];
          notify();
          return record;
        },
        clear(){
          entries = [];
          notify();
        },
        getEntries(){
          return entries.slice();
        },
        subscribe(fn){
          if(typeof fn !== 'function') return ()=>{};
          subscribers.add(fn);
          return ()=> subscribers.delete(fn);
        }
      };
    }

    const centralDiagnosticsStore = createDiagnosticsStore(250);

    const pushCentralDiagnostic = (entry)=>{
      const level = typeof entry?.level === 'string' ? entry.level.toLowerCase() : 'info';
      if(level !== 'warn' && level !== 'error') return null;
      return centralDiagnosticsStore.push({
        ...entry,
        source: entry?.source || 'central-sync'
      });
    };

    const clearCentralDiagnostics = ()=> centralDiagnosticsStore.clear();
    const normalizeEndpointString = (value)=>{
      if(typeof value !== 'string') return null;
      const trimmed = value.trim();
      return trimmed ? trimmed : null;
    };
    const isSameOriginEndpoint = (endpoint)=>{
      if(typeof endpoint !== 'string') return false;
      const trimmed = endpoint.trim();
      if(!trimmed) return false;
      if(typeof globalThis === 'undefined' || !globalThis.location) return false;
      try {
        const resolved = new URL(trimmed, globalThis.location.origin);
        return resolved.origin === globalThis.location.origin;
      } catch(_err){
        return false;
      }
    };
    const normalizeChannelName = (value, fallback='default')=>{
      const base = value == null ? '' : String(value).trim();
      const raw = base || fallback || 'default';
      return raw.replace(/[^A-Za-z0-9:_-]+/g, '-').toLowerCase();
    };
    const DEFAULT_PAYMENT_METHODS_SOURCE = [
      { id:'cash', icon:'💵', name:{ ar:'نقدي', en:'Cash' }, type:'cash' },
      { id:'card', icon:'💳', name:{ ar:'بطاقة', en:'Card' }, type:'card' }
    ];
    const sanitizePaymentMethod = (method={})=>{
      const fallbackName = method.name || method.label || {};
      const idSource = method.id || method.code || fallbackName?.en || fallbackName?.ar || method.type || 'cash';
      const id = String(idSource || 'cash').trim() || 'cash';
      const label = ensureLocaleObject(method.name || method.label, { ar:id, en:id });
      return {
        ...method,
        id,
        code: method.code || id,
        icon: method.icon || '💳',
        type: method.type || method.payment_type || 'other',
        label,
        name: label
      };
    };
    const derivePaymentMethods = (source)=>{
      const list = Array.isArray(source?.payment_methods) && source.payment_methods.length
        ? source.payment_methods
        : DEFAULT_PAYMENT_METHODS_SOURCE;
      return list.map(sanitizePaymentMethod);
    };
    const isStaticDemoEnvironment = (()=>{
      if(typeof globalThis === 'undefined') return false;
      const { location } = globalThis;
      if(!location) return false;
      const protocol = String(location.protocol || '').toLowerCase();
      const hostname = String(location.hostname || '').toLowerCase();
      if(!hostname && protocol === 'file:') return true;
      if(!hostname) return false;
      if(hostname === 'localhost' || hostname === '127.0.0.1') return false;
      if(protocol === 'file:') return true;
      return hostname.endsWith('.github.io');
    })();
    const BRANCH_PARAM = (typeof window !== 'undefined' && window.POS_BRANCH_PARAM)
      ? String(window.POS_BRANCH_PARAM).trim()
      : '';
    const CANONICAL_BRANCH_ID = BRANCH_PARAM || 'dar';
    const BRANCH_ROUTE_SEGMENT = encodeURIComponent(CANONICAL_BRANCH_ID);
    const BRANCH_MODULE_ROUTE = `/api/branches/${BRANCH_ROUTE_SEGMENT}/modules/pos`;
    const BRANCH_EVENTS_ROUTE = `${BRANCH_MODULE_ROUTE}/events`;
    const REMOTE_CONFIG = { endpoint: BRANCH_MODULE_ROUTE, payload:null, timeout:12000 };
    const extractRemotePayload = (response)=>{
      if(!response || typeof response !== 'object') return null;
      if(response.result && typeof response.result === 'object') return response.result;
      if(response.payload && typeof response.payload === 'object') return response.payload;
      if(response.data && typeof response.data === 'object' && !Array.isArray(response.data)) return response.data;
      if(response.tables && response.tables.pos_database){
        const entries = Array.isArray(response.tables.pos_database) ? response.tables.pos_database : [];
        const latest = entries.length ? entries[entries.length - 1] : null;
        if(latest){
          if(latest.payload && typeof latest.payload === 'object') return latest.payload;
          if(latest.data && typeof latest.data === 'object') return latest.data;
        }
      }
      if(response.snapshot && typeof response.snapshot === 'object'){
        return extractRemotePayload(response.snapshot);
      }
      let pure = null;
      try{
        const helpers = Mishkah && Mishkah.utils && Mishkah.utils.helpers;
        if(helpers && typeof helpers.getPureJson === 'function'){
          pure = helpers.getPureJson(response);
        }
      } catch(error){
        console.warn('[Mishkah][POS] Failed to normalize remote payload into pure JSON.', error);
        pushCentralDiagnostic({
          level:'warn',
          source:'central-sync',
          event:'remote:payload:normalize-failed',
          message:'تعذر تحويل الاستجابة إلى JSON نقي بسبب حقول للقراءة فقط.',
          data:{ message: error?.message || null }
        });
        try{
          pure = JSON.parse(JSON.stringify(response));
        } catch(innerError){
          console.warn('[Mishkah][POS] Failed to clone remote payload after JSON normalization error.', innerError);
          pushCentralDiagnostic({
            level:'warn',
            source:'central-sync',
            event:'remote:payload:clone-failed',
            message:'فشل استنساخ الاستجابة بعد تعذر التطبيع الأولي.',
            data:{ message: innerError?.message || null }
          });
          pure = null;
        }
      }
      if(!pure) return null;
      let payload = pure;
      if(Array.isArray(pure)){
        payload = pure.find(entry=> entry && typeof entry === 'object' && !Array.isArray(entry)) || null;
      }
      if(payload && typeof payload === 'object' && !Array.isArray(payload)){
        return payload;
      }
      return null;
    };
    const snapshotRemoteStatus = (status)=>({
      status: status?.status || 'idle',
      error: status?.error ? (status.error.message || String(status.error)) : null,
      startedAt: status?.startedAt || null,
      finishedAt: status?.finishedAt || null,
      keys: Array.isArray(status?.keys) ? status.keys.slice() : [],
      method: status?.method || null,
      usedFallback: !!status?.usedFallback
    });
    function createRemoteHydrator(options={}){
      const status = { status:'idle', error:null, startedAt:null, finishedAt:null, keys:[], method:'POST', usedFallback:false };
      const { Net } = U;
      const shouldSkip = options.skip ?? isStaticDemoEnvironment;
      if(shouldSkip){
        status.status = 'skipped';
        status.method = 'skip';
        status.startedAt = Date.now();
        status.finishedAt = status.startedAt;
        status.error = null;
        const promise = Promise.resolve({ data:null, status });
        return { status, promise };
      }
      const promise = (async()=>{
        status.status = 'loading';
        status.startedAt = Date.now();
        try{
          if(typeof fetch !== 'function'){
            throw new Error('Fetch API unavailable');
          }
          const response = await fetch(REMOTE_CONFIG.endpoint, { cache:'no-store' });
          if(!response.ok){
            const err = new Error(`HTTP ${response.status}`);
            err.status = response.status;
            throw err;
          }
          const payload = await response.json();
          const data = extractRemotePayload(payload);
          status.finishedAt = Date.now();
          status.method = 'GET';
          if(data && typeof data === 'object'){
            status.status = 'ready';
            status.keys = Object.keys(data);
            return { data, status };
          }
          status.status = 'ready';
          return { data:null, status };
        } catch(error){
          status.status = 'error';
          status.error = error;
          status.finishedAt = Date.now();
          status.method = 'GET';
          return { data:null, error, status };
        }
      })();
      return { status, promise };
    }
    const dataSource = typeof window !== 'undefined' ? window.__MISHKAH_POS_DATA_SOURCE__ : null;
    async function fetchServerSnapshot(){
      if(typeof window === 'undefined') return null;
      if(!BRANCH_MODULE_ROUTE) return null;
      try{
        const response = await fetch(BRANCH_MODULE_ROUTE, { cache:'no-store' });
        if(!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
      } catch(error){
        console.error('[Mishkah][POS] Failed to fetch branch snapshot.', { branch: CANONICAL_BRANCH_ID, error });
        return null;
      }
    }

    function extractDatasetFromSnapshot(snapshot){
      if(!snapshot || typeof snapshot !== 'object') return null;
      const payload = extractRemotePayload(snapshot);
      if(payload && typeof payload === 'object') return payload;
      return null;
    }

    async function loadInitialDataset(){

      if(typeof window === 'undefined') return {};
      if(dataSource){
        try {
          if(typeof dataSource.whenReady === 'function'){
            return await dataSource.whenReady();
          }
          if(dataSource.ready && typeof dataSource.ready.then === 'function'){
            return await dataSource.ready;
          }
        } catch(error){
          console.warn('[Mishkah][POS] Failed to resolve WS2 dataset promise.', error);
        }
      }
      const serverState = await fetchServerSnapshot();
      const dataset = extractDatasetFromSnapshot(serverState);
      if(dataset){
        const bootstrap = { branch: CANONICAL_BRANCH_ID, module:'pos', snapshot: dataset, source:'branch-api' };
        window.__WS2_SERVER_BOOTSTRAP__ = bootstrap;
        window.database = dataset;
        return dataset;
      }
      const fallback = window.database && typeof window.database === 'object' ? window.database : {};
      return fallback || {};
    }
    const initialDataset = await loadInitialDataset();
    let MOCK_BASE = cloneDeep(initialDataset);
    let MOCK = cloneDeep(MOCK_BASE);
    let PAYMENT_METHODS = derivePaymentMethods(MOCK);
    let appRef = null;
    const settings = MOCK.settings || {};
    const currencyConfig = settings.currency || {};
    const rawPosConfig = settings.pos || settings.pos_info || settings.posInfo || {};
    const fallbackPosId = typeof rawPosConfig.id === 'string' ? rawPosConfig.id
      : typeof rawPosConfig.code === 'string' ? rawPosConfig.code
      : typeof rawPosConfig.prefix === 'string' ? rawPosConfig.prefix
      : 'P001';
    const posId = String(fallbackPosId || 'P001').toUpperCase();
    const posNumberRaw = rawPosConfig.number ?? rawPosConfig.index ?? 1;
    const posNumber = Number.isFinite(Number(posNumberRaw)) ? Number(posNumberRaw) : 1;
    const posLabel = rawPosConfig.label || rawPosConfig.name || `POS ${posNumber}`;
    const posPrefix = rawPosConfig.prefix || posId;
    const POS_INFO = { id: posId, number: posNumber, label: posLabel, prefix: String(posPrefix || posId) };
    const SHIFT_TABLE = Schema.defineTable({
      name:'pos_shift',
      label:'POS Shift Session',
      comment:'Lifecycle of a POS cashier shift bound to orders and payments.',
      fields:[
        { name:'id', columnName:'shift_id', type:'string', primaryKey:true, nullable:false, maxLength:64, comment:'Unique shift identifier composed of POS id and encoded timestamp.' },
        { name:'posId', columnName:'pos_id', type:'string', nullable:false, maxLength:32, comment:'Terminal identifier hosting the shift.' },
        { name:'posLabel', columnName:'pos_label', type:'string', nullable:false, maxLength:96, comment:'Friendly terminal label for reports.' },
        { name:'posNumber', columnName:'pos_number', type:'integer', nullable:false, comment:'Numeric terminal number for invoice sequencing.' },
        { name:'openedAt', columnName:'opened_at', type:'timestamp', nullable:false, comment:'Shift opening timestamp.' },
        { name:'closedAt', columnName:'closed_at', type:'timestamp', nullable:true, comment:'Shift closing timestamp.' },
        { name:'openingFloat', columnName:'opening_float', type:'decimal', precision:12, scale:2, nullable:false, defaultValue:0, comment:'Opening cash float captured when the shift starts.' },
        { name:'closingCash', columnName:'closing_cash', type:'decimal', precision:12, scale:2, nullable:true, comment:'Closing cash drawer balance.' },
        { name:'cashierId', columnName:'cashier_id', type:'string', nullable:false, maxLength:64, comment:'Employee identifier operating the shift.' },
        { name:'cashierName', columnName:'cashier_name', type:'string', nullable:false, maxLength:128, comment:'Display name of the cashier.' },
        { name:'cashierRole', columnName:'cashier_role', type:'string', nullable:false, defaultValue:'cashier', comment:'Role assigned to the cashier during the shift.' },
        { name:'employeeId', columnName:'employee_id', type:'string', nullable:false, maxLength:64, comment:'Employee id linked to payroll records.' },
        { name:'status', columnName:'status', type:'string', nullable:false, defaultValue:'open', comment:'Shift lifecycle state.' },
        { name:'isClosed', columnName:'is_closed', type:'boolean', nullable:false, defaultValue:false, comment:'Flag signalling whether the shift is closed.' },
        { name:'totalsByType', columnName:'totals_by_type', type:'json', nullable:false, defaultValue:()=>({}), comment:'Aggregated sales totals grouped by order type.' },
        { name:'paymentsByMethod', columnName:'payments_by_method', type:'json', nullable:false, defaultValue:()=>({}), comment:'Aggregated payments grouped by method.' },
        { name:'countsByType', columnName:'counts_by_type', type:'json', nullable:false, defaultValue:()=>({}), comment:'Order counts grouped by type.' },
        { name:'ordersCount', columnName:'orders_count', type:'integer', nullable:false, defaultValue:0, comment:'Number of orders captured during the shift.' },
        { name:'orders', columnName:'orders_payload', type:'json', nullable:false, defaultValue:()=>([]), comment:'Optional persisted snapshot for audit or offline sync.' },
        { name:'totalSales', columnName:'total_sales', type:'decimal', precision:14, scale:2, nullable:false, defaultValue:0, comment:'Total sales amount for the shift.' }
      ],
      indexes:[
        { name:'idx_pos_shift_pos_status', columns:['pos_id','is_closed','opened_at'] },
        { name:'idx_pos_shift_opened_at', columns:['opened_at'] }
      ]
    });
    const SHIFT_SCHEMA_REGISTRY = new Schema.Registry({ tables:[SHIFT_TABLE] });
    const POS_SCHEMA_SOURCE = (typeof window !== 'undefined' && window.MishkahPOSSchema)
      ? window.MishkahPOSSchema
      : SHIFT_SCHEMA_REGISTRY.toJSON();
    const POS_SCHEMA_REGISTRY = Schema.Registry.fromJSON(POS_SCHEMA_SOURCE);
    const FALLBACK_CURRENCY = 'EGP';
    const normalizeCurrencyCode = (value)=>{
      if(typeof value !== 'string') return null;
      const upper = value.trim().toUpperCase();
      return /^[A-Z]{3}$/.test(upper) ? upper : null;
    };
    const currencyCode = normalizeCurrencyCode(currencyConfig.code)
      || normalizeCurrencyCode(currencyConfig.default)
      || FALLBACK_CURRENCY;
    const baseSymbols = typeof currencyConfig.symbols === 'object' && currencyConfig.symbols ? currencyConfig.symbols : {};
    const currencySymbols = {
      ar: currencyConfig.ar || baseSymbols.ar || baseSymbols['ar-EG'] || 'ج.م',
      en: currencyConfig.en || baseSymbols.en || baseSymbols['en-GB'] || 'E£',
      ...baseSymbols
    };
    if(!currencySymbols.en) currencySymbols.en = currencyCode;
    if(!currencySymbols.ar) currencySymbols.ar = currencySymbols.en;
    const currencyDisplayMode = currencyConfig.display || 'symbol';
    const syncSettings = ensurePlainObject(settings.sync);
    const staticRealtimeOverrideSource = firstDefined(
      MOCK_BASE?.sync?.allow_static_sync,
      MOCK_BASE?.sync?.allowStaticSync,
      MOCK_BASE?.sync?.enable_static_sync,
      MOCK_BASE?.sync?.enableStaticSync,
      syncSettings.allow_static_sync,
      syncSettings.allowStaticSync,
      syncSettings.enable_static_sync,
      syncSettings.enableStaticSync,
      syncSettings.force_static_sync,
      syncSettings.forceStaticSync
    );
    const allowStaticRealtime = ensureBoolean(staticRealtimeOverrideSource, true);
    const disableRealtimeInStaticDemo = isStaticDemoEnvironment && !allowStaticRealtime;
    if(disableRealtimeInStaticDemo){
      const hostname = typeof globalThis !== 'undefined' && globalThis.location ? globalThis.location.hostname : null;
    }
    const remoteHydrator = createRemoteHydrator({ skip: disableRealtimeInStaticDemo || !BRANCH_MODULE_ROUTE });
    const remoteStatus = remoteHydrator.status;
    const initialRemoteSnapshot = snapshotRemoteStatus(remoteStatus);
    const branchSettings = ensurePlainObject(settings.branch);
    const DEFAULT_BRANCH_CHANNEL = CANONICAL_BRANCH_ID || 'branch-main'; // غيّر هذه القيمة لتبديل قناة POS وKDS معًا.
    const branchChannelSource = syncSettings.channel
      || syncSettings.branch_channel
      || syncSettings.branchChannel
      || branchSettings.channel
      || branchSettings.branchChannel
      || DEFAULT_BRANCH_CHANNEL;
    const BRANCH_CHANNEL = normalizeChannelName(branchChannelSource, DEFAULT_BRANCH_CHANNEL);
    if(typeof window !== 'undefined'){
      window.MishkahBranchChannel = BRANCH_CHANNEL;
    }

    const ORDER_TYPE_ICON_MAP = { dine_in:'🍽️', delivery:'🚚', takeaway:'🧾', cash:'🧾' };
    const rawOrderTypes = Array.isArray(MOCK.order_types) && MOCK.order_types.length ? MOCK.order_types : [
      { id:'dine_in', type_name:{ ar:'صالة', en:'Dine-in' }, allows_save:true, allows_finalize_later:true, allows_line_additions:true, allows_returns:true, workflow:'multi-step' },
      { id:'delivery', type_name:{ ar:'دليفري', en:'Delivery' }, allows_save:false, allows_finalize_later:false, allows_line_additions:false, allows_returns:false, workflow:'single-step' },
      { id:'takeaway', type_name:{ ar:'تيك أواي', en:'Takeaway' }, allows_save:false, allows_finalize_later:false, allows_line_additions:false, allows_returns:false, workflow:'single-step' }
    ];
    const ORDER_TYPES = rawOrderTypes.map(type=>({
      id: type.id,
      icon: ORDER_TYPE_ICON_MAP[type.id] || '🧾',
      workflow: type.workflow || 'single-step',
      allowsSave: type.allows_save !== false,
      allowsFinalizeLater: !!type.allows_finalize_later,
      allowsLineAdditions: !!type.allows_line_additions,
      allowsReturns: !!type.allows_returns,
      label:{
        ar: type.type_name?.ar || type.id,
        en: type.type_name?.en || type.id
      }
    }));
    const ORDER_TYPE_IDS = new Set(ORDER_TYPES.map(type=> type.id));

    const clonePaymentMethods = (methods)=> cloneDeep(methods || []);

    const CAIRO_DISTRICTS = [
      { id:'heliopolis', ar:'هليوبوليس', en:'Heliopolis' },
      { id:'nasr_city', ar:'مدينة نصر', en:'Nasr City' },
      { id:'maadi', ar:'المعادي', en:'Maadi' },
      { id:'zamalek', ar:'الزمالك', en:'Zamalek' },
      { id:'dokki', ar:'الدقي', en:'Dokki' },
      { id:'mohandeseen', ar:'المهندسين', en:'Mohandeseen' },
      { id:'garden_city', ar:'جاردن سيتي', en:'Garden City' },
      { id:'shoubra', ar:'شبرا', en:'Shoubra' },
      { id:'rehab', ar:'الرحاب', en:'Al Rehab' },
      { id:'fifth_settlement', ar:'التجمع الخامس', en:'Fifth Settlement' },
      { id:'october', ar:'٦ أكتوبر', en:'6th of October' }
    ];

    const SHIFT_SETTINGS = typeof MOCK.shift_settings === 'object' && MOCK.shift_settings ? MOCK.shift_settings : {};
    const SHIFT_PIN_FALLBACK = typeof SHIFT_SETTINGS.pin === 'string'
      ? SHIFT_SETTINGS.pin
      : (typeof SHIFT_SETTINGS.default_pin === 'string' ? SHIFT_SETTINGS.default_pin : '');
    let SHIFT_PIN_LENGTH = Number(SHIFT_SETTINGS.pin_length || SHIFT_SETTINGS.pinLength || (SHIFT_PIN_FALLBACK ? SHIFT_PIN_FALLBACK.length : 0)) || 0;
    if(!SHIFT_PIN_LENGTH || SHIFT_PIN_LENGTH < 4) SHIFT_PIN_LENGTH = 4;
    const SHIFT_OPEN_FLOAT_DEFAULT = Number(SHIFT_SETTINGS.opening_float ?? SHIFT_SETTINGS.openingFloat ?? 0);
    const posModuleScope = {
      M,
      UI,
      U,
      D,
      Schema,
      tw,
      token,
      BASE_PALETTE,
      JSONX,
      cloneDeep,
      mergePreferRemote,
      parseMaybeJSONish,
      ensureLocaleObject,
      ensurePlainObject,
      firstDefined,
      ensureBoolean,
      createDiagnosticsStore,
      centralDiagnosticsStore,
      pushCentralDiagnostic,
      clearCentralDiagnostics,
      normalizeEndpointString,
      isSameOriginEndpoint,
      normalizeChannelName,
      DEFAULT_PAYMENT_METHODS_SOURCE,
      sanitizePaymentMethod,
      derivePaymentMethods,
      PAYMENT_METHODS,
      isStaticDemoEnvironment,
      BRANCH_PARAM,
      CANONICAL_BRANCH_ID,
      BRANCH_ROUTE_SEGMENT,
      BRANCH_MODULE_ROUTE,
      BRANCH_EVENTS_ROUTE,
      REMOTE_CONFIG,
      extractRemotePayload,
      snapshotRemoteStatus,
      createRemoteHydrator,
      ORDER_TYPES,
      CAIRO_DISTRICTS,
      POS_INFO,
      SHIFT_SETTINGS,
      SHIFT_PIN_FALLBACK,
      SHIFT_PIN_LENGTH,
      SHIFT_OPEN_FLOAT_DEFAULT
    };

    const TEXTS = {
      ar:{
        ui:{
          shift:'الوردية', cashier:'الكاشير', dine_in:'صالة', delivery:'توصيل', takeaway:'تيك أواي', cashier_mode:'كاشير',
          search:'ابحث في المنيو', favorites:'المفضلة', favorites_only:'المفضلة فقط', categories:'التصنيفات', load_more:'عرض المزيد',
          menu_loading:'جاري تحميل القائمة الحية…', menu_loading_hint:'نقوم بجلب الأصناف من النظام المركزي. يمكنك الاستمرار بالبيانات الحالية مؤقتًا.',
          menu_load_error:'تعذر تحديث القائمة الحية، يتم استخدام البيانات المخزنة.', menu_load_error_short:'تعذر التحديث',
          menu_live_badge:'القائمة الحية', menu_last_updated:'آخر تحديث', menu_load_success:'تم تحديث القائمة بنجاح.',
          indexeddb:'مخزن البيانات', central_sync:'المزامنة المركزية', last_sync:'آخر مزامنة', never_synced:'لم تتم', sync_now:'مزامنة الآن',
          central_diag_title:'تشخيص الاتصال المركزي',
          central_diag_description:'راقب دورة حياة الاتصال بالمخدم المركزي وتحقق من رسائل الأخطاء مباشرة.',
          central_diag_empty:'لم يتم تسجيل أي أحداث بعد.',
          central_diag_wait:'بمجرد محاولة الاتصال سنعرض التفاصيل هنا.',
          central_diag_clear:'مسح السجل',
          central_diag_cleared:'تم مسح سجل المزامنة.',
          central_diag_status:'حالة الاتصال',
          central_diag_details:'تفاصيل إضافية',
          central_diag_levels:{ info:'معلومة', warn:'تحذير', error:'خطأ', debug:'تفاصيل' },
          central_diag_events:{
            'config:init':'تهيئة الإعدادات',
            'config:disable':'تم تعطيل المزامنة',
            'connect:skipped':'تخطي الاتصال',
            'connect:start':'بدء الاتصال',
            'ws:open':'تم فتح قناة الويب سوكيت',
            'ws:auth:sent':'إرسال بيانات التوثيق',
            'ws:auth:missing':'لم يتم توفير رمز التوثيق',
            'ws:auth:ack':'توثيق ناجح',
            'ws:subscribe':'الاشتراك في القناة',
            'ws:close':'انتهاء الاتصال',
            'ws:error':'خطأ في القناة',
            'ws:error:frame':'رسالة خطأ من الخادم',
            'ws:message':'رسالة واردة',
            'sync:status':'تحديث الحالة',
            'sync:queue:flush':'إرسال الرسائل المؤجلة',
            'http:fetch:start':'بدء جلب HTTP',
            'http:fetch:success':'تم جلب نسخة HTTP',
            'http:fetch:error':'فشل جلب HTTP',
            'http:fetch:unauthorized':'رفض التوثيق عبر HTTP',
            'sync:initial:start':'بدء المزامنة الأولية',
            'sync:initial:success':'اكتملت المزامنة الأولية',
            'sync:initial:error':'خطأ في المزامنة الأولية',
            'mutation:publish':'إرسال تحديث',
            'mutation:ack':'تأكيد التحديث',
            'mutation:timeout':'انتهاء مهلة التحديث',
            'sync:disable':'إيقاف المزامنة'
          },
          subtotal:'الإجمالي الفرعي', service:'خدمة', vat:'ضريبة', discount:'خصم', delivery_fee:'رسوم التوصيل', total:'الإجمالي المستحق',
          cart_empty:'لم يتم إضافة أصناف بعد', choose_items:'اختر صنفًا من القائمة لإضافته إلى الطلب.', tables:'الطاولات',
          select_table:'اختر طاولة لإسناد الطلب', table_status:'حالة الطاولة', table_available:'متاحة', table_occupied:'مشغولة',
          table_reserved:'محجوزة', table_maintenance:'صيانة', payments:'المدفوعات', split_payments:'تقسيم الدفعات', paid:'المدفوع',
          remaining:'المتبقي', open_payments:'تسجيل دفعة', open_reports:'فتح التقارير', reports:'التقارير', orders_count:'عدد الطلبات',
          shift_open:'فتح وردية', shift_close:'إغلاق الوردية', shift_summary:'ملخص الوردية', shift_open_prompt:'أدخل الرقم السري لفتح الوردية',
          shift_cash_start:'رصيد أول المدة', shift_cash_end:'رصيد آخر المدة', shift_total_sales:'إجمالي المبيعات',
          shift_total_dine_in:'إجمالي طلبات الصالة', shift_total_takeaway:'إجمالي طلبات التيك أواي', shift_total_delivery:'إجمالي طلبات التوصيل',
          shift_payments:'تحصيلات الوردية', shift_history:'سجل الورديات', shift_history_empty:'لا يوجد سجل ورديات بعد',
          shift_close_confirm:'إنهاء وإغلاق الوردية', shift_current:'الوردية الحالية', shift_select_history:'اختيار وردية سابقة',
          shift_open_button:'🔓 فتح وردية', shift_close_button:'🔒 إغلاق وردية', shift_orders_count:'عدد الطلبات في الوردية',
          shift_cash_summary:'ملخص النقدية', shift_cash_collected:'إجمالي النقدي خلال الوردية',
          settings_center:'إعدادات الواجهة', settings_theme:'تخصيص الثيم', settings_light:'وضع نهاري', settings_dark:'وضع ليلي',
          settings_colors:'لوحة الألوان', settings_fonts:'الخطوط', settings_color_background:'لون الخلفية', settings_color_foreground:'لون النص',
          settings_color_primary:'اللون الرئيسي', settings_color_accent:'لون التمييز', settings_color_muted:'لون ثانوي',
          settings_font_base:'حجم الخط الأساسي', settings_reset:'إعادة الضبط الافتراضي',
          refunds:'رد المدفوعات', returns:'المرتجعات',
          order_nav_label:'التنقل بين الفواتير', order_nav_open:'اذهب إلى فاتورة', order_nav_placeholder:'رقم الفاتورة أو الترتيب',
          order_nav_total:'إجمالي الفواتير', order_nav_no_history:'لا توجد فواتير محفوظة بعد',
          customer_center:'مركز العملاء', customer_search:'ابحث عن عميل', customer_search_placeholder:'الاسم أو رقم الهاتف',
          customer_tab_search:'بحث', customer_tab_create:'تكويد جديد', customer_new:'عميل جديد', customer_name:'اسم العميل',
          customer_phones:'أرقام الهاتف', customer_add_phone:'إضافة رقم', customer_remove_phone:'حذف', customer_addresses:'عناوين العميل',
          customer_add_address:'إضافة عنوان', customer_address_title:'وصف العنوان', customer_address_line:'تفاصيل العنوان',
          customer_address_notes:'ملاحظات', customer_area:'المنطقة السكنية', customer_attach:'ربط بالطلب', customer_create:'حفظ العميل',
          customer_no_results:'لا يوجد عملاء مطابقون', customer_multi_phone_hint:'يمكنك إضافة أكثر من رقم هاتف',
          customer_multi_address_hint:'يمكنك إضافة أكثر من عنوان لنفس العميل', customer_keypad:'لوحة الأرقام',
          customer_select_address:'اختر العنوان', customer_required_delivery:'مطلوب لطلبات التوصيل', customer_delivery_required:'يرجى ربط طلب التوصيل بعميل وعنوان',
          customer_edit_action:'تعديل البيانات', customer_use_existing:'اختر من العملاء', customer_form_reset:'إعادة تعيين',
          customer_edit:'تعديل العميل', customer_remove_address:'حذف العنوان',
          avg_ticket:'متوسط الفاتورة', top_selling:'الأكثر مبيعًا', sales_today:'مبيعات اليوم', save_order:'حفظ الطلب',
          settle_and_print:'تحصيل وطباعة', finish_order:'إنهاء الطلب', finish_and_print:'إنهاء وطباعة', print:'طباعة فقط', notes:'ملاحظات', discount_action:'خصم', clear:'مسح', new_order:'طلب جديد',
          balance_due:'المتبقي غير المسدد', exchange_due:'باقي الفكة',
          line_modifiers:'الإضافات والمنزوعات', line_modifiers_title:'تعديل الإضافات والمنزوعات', line_modifiers_addons:'الإضافات', line_modifiers_removals:'المنزوعات', line_modifiers_apply:'تطبيق التعديلات', line_modifiers_empty:'لا توجد خيارات متاحة', line_modifiers_free:'بدون رسوم', line_modifiers_missing:'السطر غير متاح', line_modifiers_unit:'السعر للوحدة',
          amount:'قيمة الدفعة', capture_payment:'تأكيد الدفع', close:'إغلاق', theme:'الثيم', light:'نهاري', dark:'ليلي', language:'اللغة',
          arabic:'عربي', english:'English', service_type:'نوع الطلب', guests:'عدد الأفراد', kds:'نظام المطبخ (KDS)',
          status_online:'متصل', status_offline:'غير متصل', status_idle:'انتظار', order_id:'طلب', order_id_pending:'مسودة', last_orders:'الطلبات الأخيرة',
          connect_kds:'اتصال', reconnect:'إعادة الاتصال', print_size:'مقاس الطباعة', thermal_80:'حرارية 80مم', a5:'A5', a4:'A4',
          tables_manage:'إدارة الطاولات', tables_assign:'تخصيص الطاولات', table_lock:'قفل الطاولة', table_unlock:'فك القفل',
          table_locked:'مقفلة', table_sessions:'طلبات مرتبطة', table_no_sessions:'لا توجد طلبات', table_add:'إضافة طاولة',
          table_rename:'تعديل الاسم', table_delete:'حذف الطاولة', table_status_change:'تغيير الحالة', table_status_inactive:'معطلة',
          table_status_active:'متاحة', table_status_reserved:'محجوزة', table_status_maintenance:'صيانة', table_manage_hint:'اضغط على أي طاولة للإسناد أو استخدم أدوات الإدارة.',
          table_multi_orders:'طلبات متعددة', print_profile:'ملف الطباعة', table_confirm_unlock:'هل تريد فك قفل الطاولة؟',
          table_confirm_remove:'هل تريد حذف هذه الطاولة؟', table_confirm_release:'هل تريد فك ارتباط الطلب بالطاولة؟',
          tables_filter_all:'الكل', tables_filter_free:'متاحة', tables_filter_single:'مقفلة (طلب واحد)', tables_filter_multi:'مقفلة (متعددة)',
          tables_filter_maintenance:'صيانة', tables_search_placeholder:'ابحث باسم أو رقم الطاولة', tables_details:'تفاصيل الطاولة',
          tables_zone:'منطقة', tables_capacity:'سعة', tables_state_active:'متاحة', tables_state_disactive:'معطلة',
          tables_state_maintenance:'صيانة', tables_state_free:'حرة', tables_state_single:'طلب واحد', tables_state_multi:'طلبات متعددة',
          tables_unlock_all:'فك الجميع', tables_unlock_single:'فك عن هذا الطلب', tables_assign_to_order:'إسناد للطلب الحالي',
          tables_remove_from_order:'إزالة من الطلب الحالي', tables_orders_badge:'طلبات', tables_reservations_badge:'حجوزات',
          tables_actions:'إجراءات الطاولة', tables_longpress_hint:'اضغط مطولًا لعرض التفاصيل', tables_count_label:'إجمالي الطاولات',
          reservations:'الحجوزات', reservations_manage:'إدارة الحجوزات', reservations_filter_all:'الكل', reservations_filter_booked:'محجوز',
          reservations_filter_seated:'تم الجلوس', reservations_filter_completed:'منتهٍ', reservations_filter_cancelled:'ملغي',
          reservations_filter_noshow:'لم يحضر', reservations_new:'حجز جديد', reservations_edit:'تعديل الحجز', reservations_customer:'اسم العميل',
          reservations_phone:'الهاتف', reservations_party_size:'عدد الأفراد', reservations_time:'وقت الحجز', reservations_hold_until:'الانتظار حتى',
          reservations_tables:'الطاولات المرتبطة', reservations_note:'ملاحظات', reservations_status:'الحالة',
          reservations_status_booked:'محجوز', reservations_status_seated:'تم الجلوس', reservations_status_no_show:'لم يحضر',
          reservations_status_cancelled:'ملغي', reservations_status_completed:'مكتمل', reservations_convert:'وصل العميل',
          reservations_no_show:'لم يحضر', reservations_cancel_action:'إلغاء', reservations_save:'حفظ الحجز',
          reservations_conflict:'يوجد تعارض في الوقت المحدد مع طاولة أخرى.', reservations_conflict_maintenance:'أحد الطاولات في صيانة، يرجى اختيار طاولة مختلفة.',
          reservations_conflict_lock:'الطاولة مرتبطة بطلب آخر.', reservations_tables_required:'اختر طاولة واحدة على الأقل',
          reservations_list_empty:'لا توجد حجوزات في هذا النطاق الزمني.', reservations_hold_label:'سيتم الاحتفاظ حتى',
          tables_manage_log:'سجل التعديلات', print_doc_customer:'إيصال عميل', print_doc_summary:'ملخص الطلب', print_doc_kitchen:'إرسال للمطبخ',
          print_preview:'معاينة', print_preview_expand:'تكبير المعاينة', print_preview_collapse:'تصغير المعاينة', print_send:'إرسال للطابعة', print_save_profile:'حفظ الإعدادات', print_header_store:'اسم المتجر',
          print_header_address:'العنوان', print_header_phone:'الهاتف', print_footer_thanks:'شكرًا لزيارتكم!',
          print_footer_policy:'سياسة الاستبدال خلال 24 ساعة مع الإيصال.', print_footer_feedback:'شاركنا رأيك',
          print_payments:'المدفوعات', print_change_due:'المتبقي للعميل', print_size_label:'مقاس الطباعة',
          print_printer_default:'الطابعة الافتراضية', print_printer_inside:'طابعة الصالة / الداخل', print_printer_outside:'طابعة التوصيل / الخارج',
          print_printer_placeholder:'اكتب اسم الطابعة', print_printer_hint:'يمكنك كتابة اسم الطابعة تمامًا كما يظهر في النظام.',
          print_printers_info:'لا يستطيع المتصفح مشاركة أسماء الطابعات تلقائيًا بدون حوار الطباعة، لذا اختر الطابعة يدويًا لكل ملف.',
          print_copies:'عدد النسخ', print_duplicate_inside:'نسخة للداخل', print_duplicate_outside:'نسخة للخارج',
          print_auto_send:'إرسال مباشر للطابعة الحرارية', print_show_preview:'عرض المعاينة قبل الطباعة',
          print_show_advanced:'إظهار الإعدادات المتقدمة', print_hide_advanced:'إخفاء الإعدادات المتقدمة',
          print_manage_printers:'إدارة الطابعات', print_manage_hide:'إخفاء إدارة الطابعات', print_manage_title:'قائمة الطابعات المحفوظة',
          print_manage_add:'إضافة طابعة', print_manage_placeholder:'أدخل اسم الطابعة كما يظهر في النظام',
          print_manage_empty:'لا توجد طابعات محفوظة بعد', print_browser_preview:'طباعة عبر المتصفح',
          print_printer_select:'اختر الطابعة للطباعة السريعة', print_printers_manage_hint:'حدث قائمة الطابعات لتسهيل الوصول السريع.',
          receipt_15:'رول ‎15 سم‎', export_pdf:'تصدير PDF',
          orders_queue:'الطلبات المفتوحة', orders_queue_hint:'الطلبات المعلقة/المفتوحة', orders_queue_empty:'لا توجد طلبات في الانتظار.',
          orders_queue_open:'فتح الطلب', orders_queue_status_open:'مفتوح', orders_queue_status_held:'معلّق',
          orders_view_jobs:'تفاصيل التحضير', orders_jobs_title:'حالة الطلب في المطبخ', orders_jobs_description:'عرض حالة الأصناف والمحطات المرتبطة بالطلب.',
          orders_jobs_empty:'لا توجد بيانات تحضير بعد', orders_jobs_station:'قسم المطبخ', orders_jobs_status:'الحالة', orders_jobs_items:'الأصناف', orders_jobs_updated:'آخر تحديث',
          orders_tab_all:'كل الطلبات', orders_tab_dine_in:'طلبات الصالة', orders_tab_delivery:'طلبات الدليفري', orders_tab_takeaway:'طلبات التيك أواي',
          orders_stage:'المرحلة', orders_status:'الحالة', orders_type:'نوع الطلب', orders_total:'الإجمالي', orders_updated:'آخر تحديث',
          orders_payment:'حالة الدفع', orders_line_count:'عدد الأصناف', orders_notes:'ملاحظات', orders_search_placeholder:'ابحث برقم الطلب أو الطاولة أو القسم',
          orders_refresh:'تحديث القائمة', orders_no_results:'لا توجد طلبات متاحة في هذه القائمة.',
          tables_bulk_activate:'تفعيل', tables_bulk_maintenance:'وضع صيانة'
        },
        toast:{
          item_added:'تمت إضافة الصنف', quantity_updated:'تم تحديث الكمية', cart_cleared:'تم مسح الطلب',
          order_saved:'تم حفظ الطلب محليًا', order_finalized:'تم إنهاء الطلب', sync_complete:'تم تحديث المزامنة', payment_recorded:'تم تسجيل الدفعة',
          amount_required:'من فضلك أدخل قيمة صحيحة', indexeddb_missing:'مخزن البيانات غير متاح في هذا المتصفح',
          indexeddb_error:'تعذر حفظ البيانات في المخزن', print_stub:'سيتم التكامل مع الطابعة لاحقًا',
          discount_stub:'سيتم تفعيل الخصومات لاحقًا', notes_updated:'تم تحديث الملاحظات', add_note:'أدخل ملاحظة ترسل للمطبخ',
          set_qty:'أدخل الكمية الجديدة', line_actions:'سيتم فتح إجراءات السطر لاحقًا', line_modifiers_applied:'تم تحديث الإضافات والمنزوعات', confirm_clear:'هل تريد مسح الطلب الحالي؟',
          order_locked:'لا يمكن تعديل هذا الطلب بعد حفظه', line_locked:'لا يمكن تعديل هذا السطر بعد حفظه',
          order_additions_blocked:'لا يمكن إضافة أصناف جديدة لهذا النوع من الطلبات بعد الحفظ',
          order_stage_locked:'لا يمكن تعديل الأصناف في هذه المرحلة', orders_loaded:'تم تحديث قائمة الطلبات',
          orders_failed:'تعذر تحميل الطلبات',
          central_sync_blocked:'تعذر حفظ الطلب', central_sync_offline:'الخادم المركزي غير متصل. يرجى التحقق من الاتصال.',
          customer_saved:'تم حفظ بيانات العميل', customer_attach_success:'تم ربط العميل بالطلب',
          customer_missing_selection:'اختر عميلًا أولًا', customer_missing_address:'اختر عنوانًا لهذا العميل', customer_form_invalid:'أكمل الاسم ورقم الهاتف',
          new_order:'تم إنشاء طلب جديد', order_type_changed:'تم تغيير نوع الطلب', table_assigned:'تم اختيار الطاولة',
          merge_stub:'قريبًا دمج الطاولات', load_more_stub:'سيتم تحميل المزيد من الأصناف لاحقًا', indexeddb_syncing:'جاري تحديث مخزن البيانات',
          theme_switched:'تم تغيير الثيم', lang_switched:'تم تغيير اللغة', logout_stub:'تم إنهاء الوردية افتراضيًا',
          kdsConnected:'تم الاتصال بالمطبخ', kdsClosed:'تم إغلاق الاتصال بالمطبخ', kdsFailed:'فشل الاتصال بالمطبخ',
          kdsUnavailable:'متصفحك لا يدعم WebSocket', kdsPong:'تم استقبال إشارة من المطبخ',
          table_locked_other:'الطاولة مقفلة لطلب آخر', table_locked_now:'تم قفل الطاولة على الطلب الحالي',
          table_unlocked:'تم فك قفل الطاولة', table_updated:'تم تحديث بيانات الطاولة', table_removed:'تم حذف الطاولة',
          table_added:'تم إنشاء طاولة جديدة', table_inactive_assign:'لا يمكن اختيار طاولة معطلة',
          table_sessions_cleared:'تم فك ارتباط الطلب بالطاولة', print_size_switched:'تم تحديث مقاس الطباعة',
          table_type_required:'يرجى اختيار نوع الطلب طاولة قبل فتح إدارة الطاولات',
          table_invalid_seats:'رجاء إدخال عدد مقاعد صالح', table_name_required:'يجب إدخال اسم للطاولة',
          table_has_sessions:'لا يمكن حذف طاولة عليها طلبات', table_state_updated:'تم تحديث حالة الطاولة',
          table_unlock_partial:'تم فك قفل الطاولة للطلب المحدد', reservation_created:'تم إنشاء الحجز', reservation_updated:'تم تحديث الحجز',
          reservation_cancelled:'تم إلغاء الحجز', reservation_converted:'تم تحويل الحجز إلى طلب', reservation_no_show:'تم وسم الحجز بعدم الحضور',
          print_profile_saved:'تم حفظ إعدادات الطباعة', print_sent:'تم إرسال أمر الطباعة', pdf_exported:'تم تجهيز نسخة PDF للحفظ',
          printer_added:'تمت إضافة الطابعة', printer_removed:'تمت إزالة الطابعة', printer_exists:'الطابعة موجودة بالفعل',
          printer_name_required:'يرجى إدخال اسم الطابعة', browser_popup_blocked:'يرجى السماح بالنوافذ المنبثقة لإتمام التصدير',
          browser_print_opened:'تم فتح أداة الطباعة في المتصفح', shift_open_success:'تم فتح الوردية بنجاح',
          shift_close_success:'تم إغلاق الوردية بنجاح', shift_pin_invalid:'الرقم السري غير صحيح',
          shift_required:'يجب فتح الوردية قبل حفظ الطلب', order_nav_not_found:'لم يتم العثور على فاتورة بهذا الرقم',
          enter_order_discount:'أدخل قيمة الخصم على الطلب (مثال: 10 أو 5%)',
          enter_line_discount:'أدخل خصم هذا البند (مثال: 10 أو 5%)',
          discount_applied:'تم تطبيق الخصم',
          discount_removed:'تمت إزالة الخصم',
          discount_invalid:'قيمة خصم غير صالحة',
          discount_limit:'الحد الأقصى للخصم هو %limit%%'
        }
      },
      en:{
        ui:{
          shift:'Shift', cashier:'Cashier', dine_in:'Dine-in', delivery:'Delivery', takeaway:'Takeaway', cashier_mode:'Counter',
          search:'Search menu', favorites:'Favorites', favorites_only:'Only favorites', categories:'Categories', load_more:'Load more',
          menu_loading:'Loading live menu…', menu_loading_hint:'Fetching the latest catalog from the central system. You can continue working with local data.',
          menu_load_error:'Live menu refresh failed, using cached data instead.', menu_load_error_short:'Update failed',
          menu_live_badge:'Live menu', menu_last_updated:'Last updated', menu_load_success:'Live menu updated.',
          indexeddb:'POS storage', central_sync:'Central sync', last_sync:'Last sync', never_synced:'Never', sync_now:'Sync now', subtotal:'Subtotal',
          central_diag_title:'Central sync diagnostics',
          central_diag_description:'Inspect the live connection lifecycle with the central server and surface any transport errors.',
          central_diag_empty:'No events captured yet.',
          central_diag_wait:'As soon as the POS tries to connect we will list the trace here.',
          central_diag_clear:'Clear log',
          central_diag_cleared:'Central sync log cleared.',
          central_diag_status:'Connection snapshot',
          central_diag_details:'Details',
          central_diag_levels:{ info:'Info', warn:'Warn', error:'Error', debug:'Debug' },
          central_diag_events:{
            'config:init':'Configuration loaded',
            'config:disable':'Sync disabled',
            'connect:skipped':'Connection skipped',
            'connect:start':'Connecting to WebSocket',
            'ws:open':'WebSocket opened',
            'ws:auth:sent':'Auth payload sent',
            'ws:auth:missing':'Missing auth token',
            'ws:auth:ack':'Authentication acknowledged',
            'ws:subscribe':'Subscribed to topic',
            'ws:close':'WebSocket closed',
            'ws:error':'WebSocket error',
            'ws:error:frame':'Server error frame',
            'ws:message':'Message received',
            'sync:status':'Status updated',
            'sync:queue:flush':'Flushed pending frames',
            'http:fetch:start':'Fetching HTTP snapshot',
            'http:fetch:success':'HTTP snapshot received',
            'http:fetch:error':'HTTP fetch failed',
            'http:fetch:unauthorized':'HTTP auth rejected',
            'sync:initial:start':'Initial sync started',
            'sync:initial:success':'Initial sync complete',
            'sync:initial:error':'Initial sync error',
            'mutation:publish':'Publishing payload',
            'mutation:ack':'Update acknowledged',
            'mutation:timeout':'Update timed out',
            'sync:disable':'Sync disabled'
          },
          service:'Service', vat:'VAT', discount:'Discount', delivery_fee:'Delivery fee', total:'Amount due',
          cart_empty:'No items added yet', choose_items:'Pick an item from the menu to start the order.', tables:'Tables',
          select_table:'Select a table for this order', table_status:'Table status', table_available:'Available', table_occupied:'Occupied',
          table_reserved:'Reserved', table_maintenance:'Maintenance', payments:'Payments', split_payments:'Split payments', paid:'Paid',
          remaining:'Remaining', open_payments:'Add payment', open_reports:'Open reports', reports:'Reports', orders_count:'Orders',
          shift_open:'Open shift', shift_close:'Close shift', shift_summary:'Shift summary', shift_open_prompt:'Enter the PIN to open the shift',
          shift_cash_start:'Opening cash', shift_cash_end:'Closing cash', shift_total_sales:'Total sales',
          shift_total_dine_in:'Dine-in total', shift_total_takeaway:'Takeaway total', shift_total_delivery:'Delivery total',
          shift_payments:'Shift payments', shift_history:'Shift history', shift_history_empty:'No shift history yet',
          shift_close_confirm:'Finish and close shift', shift_current:'Active shift', shift_select_history:'Select a previous shift',
          shift_open_button:'🔓 Open shift', shift_close_button:'🔒 Close shift', shift_orders_count:'Orders this shift',
          shift_cash_summary:'Cash drawer summary', shift_cash_collected:'Cash collected',
          settings_center:'Settings', settings_theme:'Theme customization', settings_light:'Light mode', settings_dark:'Dark mode',
          settings_colors:'Colors', settings_fonts:'Typography', settings_color_background:'Background', settings_color_foreground:'Foreground',
          settings_color_primary:'Primary color', settings_color_accent:'Accent color', settings_color_muted:'Muted tone',
          settings_font_base:'Base font size', settings_reset:'Reset to defaults',
          refunds:'Refunds', returns:'Returns',
          order_nav_label:'Invoice navigator', order_nav_open:'Go to invoice', order_nav_placeholder:'Invoice number or index',
          order_nav_total:'Total invoices', order_nav_no_history:'No saved invoices yet',
          customer_center:'Customer hub', customer_search:'Search customers', customer_search_placeholder:'Name or phone number',
          customer_tab_search:'Search', customer_tab_create:'New customer', customer_new:'New customer', customer_name:'Customer name',
          customer_phones:'Phone numbers', customer_add_phone:'Add phone', customer_remove_phone:'Remove', customer_addresses:'Customer addresses',
          customer_add_address:'Add address', customer_address_title:'Address label', customer_address_line:'Address details',
          customer_address_notes:'Notes', customer_area:'Area', customer_attach:'Link to order', customer_create:'Save customer',
          customer_no_results:'No matching customers', customer_multi_phone_hint:'Store more than one phone per customer',
          customer_multi_address_hint:'Store multiple delivery addresses per customer', customer_keypad:'Keypad',
          customer_select_address:'Select address', customer_required_delivery:'Required for delivery orders', customer_delivery_required:'Please link delivery orders to a customer and address',
          customer_edit_action:'Edit details', customer_use_existing:'Choose an existing customer', customer_form_reset:'Reset form',
          customer_edit:'Edit customer', customer_remove_address:'Remove address',
          avg_ticket:'Average ticket', top_selling:'Top seller', sales_today:'Sales today', save_order:'Save order',
          settle_and_print:'Settle & print', finish_order:'Finish order', finish_and_print:'Finish & print', print:'Print only', notes:'Notes', discount_action:'Discount', clear:'Clear',
          new_order:'New order', balance_due:'Outstanding balance', exchange_due:'Change due', line_modifiers:'Add-ons & removals', line_modifiers_title:'Customize add-ons & removals', line_modifiers_addons:'Add-ons', line_modifiers_removals:'Removals', line_modifiers_apply:'Apply changes', line_modifiers_empty:'No options available', line_modifiers_free:'No charge', line_modifiers_missing:'Line is no longer available', line_modifiers_unit:'Unit price', amount:'Payment amount', capture_payment:'Capture payment', close:'Close', theme:'Theme',
          light:'Light', dark:'Dark', language:'Language', arabic:'Arabic', english:'English', service_type:'Service type',
          guests:'Guests', kds:'Kitchen display', status_online:'Online', status_offline:'Offline', status_idle:'Idle',
          order_id:'Order', order_id_pending:'Draft', last_orders:'Recent orders', connect_kds:'Connect', reconnect:'Reconnect', print_size:'Print size',
          thermal_80:'Thermal 80mm', a5:'A5', a4:'A4', tables_manage:'Table management', tables_assign:'Assign tables',
          table_lock:'Lock table', table_unlock:'Unlock table', table_locked:'Locked', table_sessions:'Linked orders',
          table_no_sessions:'No orders yet', table_add:'Add table', table_rename:'Rename table', table_delete:'Remove table',
          table_status_change:'Change status', table_status_inactive:'Inactive', table_status_active:'Available',
          table_status_reserved:'Reserved', table_status_maintenance:'Maintenance', table_manage_hint:'Tap a table to assign it or use the tools below.',
          table_multi_orders:'Multi orders', print_profile:'Print profile', table_confirm_unlock:'Unlock this table?',
          table_confirm_remove:'Remove this table?', table_confirm_release:'Unlink the order from the table?',
          tables_filter_all:'All', tables_filter_free:'Free', tables_filter_single:'Locked (single)', tables_filter_multi:'Locked (multi)',
          tables_filter_maintenance:'Maintenance', tables_search_placeholder:'Search by table name or number', tables_details:'Table details',
          tables_zone:'Zone', tables_capacity:'Capacity', tables_state_active:'Active', tables_state_disactive:'Inactive',
          tables_state_maintenance:'Maintenance', tables_state_free:'Free', tables_state_single:'Single lock', tables_state_multi:'Multi lock',
          tables_unlock_all:'Unlock all', tables_unlock_single:'Unlock current order', tables_assign_to_order:'Assign to current order',
          tables_remove_from_order:'Remove from this order', tables_orders_badge:'Orders', tables_reservations_badge:'Reservations',
          tables_actions:'Table actions', tables_longpress_hint:'Long press to view details', tables_count_label:'Total tables',
          reservations:'Reservations', reservations_manage:'Manage reservations', reservations_filter_all:'All', reservations_filter_booked:'Booked',
          reservations_filter_seated:'Seated', reservations_filter_completed:'Completed', reservations_filter_cancelled:'Cancelled',
          reservations_filter_noshow:'No-show', reservations_new:'New reservation', reservations_edit:'Edit reservation', reservations_customer:'Customer name',
          reservations_phone:'Phone', reservations_party_size:'Party size', reservations_time:'Reservation time', reservations_hold_until:'Hold until',
          reservations_tables:'Linked tables', reservations_note:'Notes', reservations_status:'Status',
          reservations_status_booked:'Booked', reservations_status_seated:'Seated', reservations_status_no_show:'No-show',
          reservations_status_cancelled:'Cancelled', reservations_status_completed:'Completed', reservations_convert:'Guest arrived',
          reservations_no_show:'Mark no-show', reservations_cancel_action:'Cancel', reservations_save:'Save reservation',
          reservations_conflict:'Conflict detected with selected tables.', reservations_conflict_maintenance:'One of the tables is under maintenance.',
          reservations_conflict_lock:'Table currently locked by another order.', reservations_tables_required:'Select at least one table',
          reservations_list_empty:'No reservations for this time range.', reservations_hold_label:'Hold until',
          tables_manage_log:'Audit trail', print_doc_customer:'Customer receipt', print_doc_summary:'Order summary', print_doc_kitchen:'Kitchen chit',
          print_preview:'Preview', print_preview_expand:'Expand preview', print_preview_collapse:'Collapse preview', print_send:'Send to printer', print_save_profile:'Save settings', print_header_store:'Store name',
          print_header_address:'Address', print_header_phone:'Phone', print_footer_thanks:'Thanks for visiting!',
          print_footer_policy:'Exchange within 24h with receipt.', print_footer_feedback:'Share your feedback',
          print_payments:'Payments', print_change_due:'Change due', print_size_label:'Print size',
          print_printer_default:'Default printer', print_printer_inside:'Inside / dining printer', print_printer_outside:'Delivery / outside printer',
          print_printer_placeholder:'Type printer name', print_printer_hint:'Type the printer name exactly as it appears on the system.',
          print_printers_info:'Browsers only expose printer names through the print dialog. Configure the matching printer manually for each profile.',
          print_copies:'Copies', print_duplicate_inside:'Duplicate for inside', print_duplicate_outside:'Duplicate for outside',
          print_auto_send:'Auto send to thermal printer', print_show_preview:'Show preview before printing',
          print_show_advanced:'Show advanced settings', print_hide_advanced:'Hide advanced settings',
          print_manage_printers:'Manage printers', print_manage_hide:'Hide printer manager', print_manage_title:'Saved printers',
          print_manage_add:'Add printer', print_manage_placeholder:'Enter the printer name exactly as the OS shows it',
          print_manage_empty:'No saved printers yet', print_browser_preview:'Browser print dialog',
          print_printer_select:'Pick the printer for quick printing', print_printers_manage_hint:'Maintain the printer names you rely on here.',
          receipt_15:'15 cm roll', export_pdf:'Export PDF',
          orders_queue:'Open orders', orders_queue_hint:'Held / open orders in progress', orders_queue_empty:'No orders waiting.',
          orders_queue_open:'Open order', orders_queue_status_open:'Open', orders_queue_status_held:'Held',
          orders_view_jobs:'Kitchen status', orders_jobs_title:'Kitchen production status', orders_jobs_description:'Review item progress across kitchen stations.',
          orders_jobs_empty:'No prep data yet', orders_jobs_station:'Station', orders_jobs_status:'Status', orders_jobs_items:'Items', orders_jobs_updated:'Updated at',
          orders_tab_all:'All orders', orders_tab_dine_in:'Dining room', orders_tab_delivery:'Delivery', orders_tab_takeaway:'Takeaway',
          orders_stage:'Stage', orders_status:'Status', orders_type:'Order type', orders_total:'Total due', orders_updated:'Last update',
          orders_payment:'Payment state', orders_line_count:'Line items', orders_notes:'Notes', orders_search_placeholder:'Search by order, table or section',
          orders_refresh:'Refresh list', orders_no_results:'No orders match the current filters.',
          tables_bulk_activate:'Activate', tables_bulk_maintenance:'Mark maintenance'
        },
        toast:{
          item_added:'Item added to cart', quantity_updated:'Quantity updated', cart_cleared:'Cart cleared',
          order_saved:'Order stored locally', order_finalized:'Order finalized', sync_complete:'Sync completed', payment_recorded:'Payment recorded',
          amount_required:'Enter a valid amount', indexeddb_missing:'Data store is not available in this browser',
          indexeddb_error:'Failed to persist to the data store', print_stub:'Printer integration coming soon',
          discount_stub:'Discount workflow coming soon', notes_updated:'Notes updated', add_note:'Add a note for the kitchen',
          set_qty:'Enter the new quantity', line_actions:'Line actions coming soon', line_modifiers_applied:'Line modifiers updated', confirm_clear:'Clear the current order?',
          order_locked:'This order is locked after saving', line_locked:'This line can no longer be modified',
          order_additions_blocked:'Cannot add new items to this order type after saving',
          order_stage_locked:'Items cannot be modified at this stage', orders_loaded:'Orders list refreshed',
          orders_failed:'Failed to load orders', central_sync_blocked:'Unable to save order', central_sync_offline:'Central server unreachable. Please restore the connection.',
          customer_saved:'Customer saved successfully', customer_attach_success:'Customer linked to order',
          customer_missing_selection:'Select a customer first', customer_missing_address:'Select an address for this customer', customer_form_invalid:'Please enter name and phone number',
          new_order:'New order created', order_type_changed:'Order type changed', table_assigned:'Table assigned',
          merge_stub:'Table merge coming soon', load_more_stub:'Menu pagination coming soon', indexeddb_syncing:'Updating data store…',
          theme_switched:'Theme updated', lang_switched:'Language updated', logout_stub:'Session ended (stub)',
          kdsConnected:'Connected to kitchen', kdsClosed:'Kitchen connection closed', kdsFailed:'Kitchen connection failed',
          kdsUnavailable:'WebSocket not supported', kdsPong:'KDS heartbeat received',
          table_locked_other:'Table is locked by another order', table_locked_now:'Table locked for this order',
          table_unlocked:'Table unlocked', table_updated:'Table details updated', table_removed:'Table removed',
          table_added:'New table added', table_inactive_assign:'Inactive tables cannot be assigned',
          table_sessions_cleared:'Order unlinked from table', print_size_switched:'Print size updated',
          table_type_required:'Please select the dine-in service type before opening the tables panel',
          table_invalid_seats:'Please enter a valid seat count', table_name_required:'Table name is required',
          table_has_sessions:'Cannot remove a table with linked orders', table_state_updated:'Table state updated',
          table_unlock_partial:'Table unlocked for the selected order', reservation_created:'Reservation created', reservation_updated:'Reservation updated',
          reservation_cancelled:'Reservation cancelled', reservation_converted:'Reservation converted to order', reservation_no_show:'Reservation marked as no-show',
          print_profile_saved:'Print profile saved', print_sent:'Print job sent', pdf_exported:'PDF export is ready',
          printer_added:'Printer added', printer_removed:'Printer removed', printer_exists:'Printer already exists',
          printer_name_required:'Please enter a printer name', browser_popup_blocked:'Allow pop-ups to finish the export',
          browser_print_opened:'Browser print dialog opened', shift_open_success:'Shift opened successfully', shift_close_success:'Shift closed successfully',
          shift_pin_invalid:'Invalid PIN', shift_required:'Please open a shift before saving the order', order_nav_not_found:'No invoice matches that number',
          enter_order_discount:'Enter order discount (e.g. 10 or 5%)',
          enter_line_discount:'Enter line discount (e.g. 10 or 5%)',
          discount_applied:'Discount updated',
          discount_removed:'Discount cleared',
          discount_invalid:'Invalid discount value',
          discount_limit:'Discount cannot exceed %limit%%'
        }
      }
    };

    function getTexts(db){
      return TEXTS[db.env.lang] || TEXTS.ar;
    }

    function localize(value, lang){
      if(value == null) return '';
      if(typeof value === 'string') return value;
      if(typeof value === 'object'){
        return value[lang] || value.ar || value.en || Object.values(value)[0] || '';
      }
      return String(value);
    }

    function escapeHTML(value){
      if(value == null) return '';
      const map = {
        '&':'&amp;',
        '<':'&lt;',
        '>':'&gt;'
      };
      map['"'] = '&quot;';
      map['\''] = '&#39;';
      return String(value).replace(/[&<>"']/g, ch=> map[ch]);
    }

    function getCurrency(db){
      return currencyCode;
    }

    function getCurrencySymbol(db){
      const lang = db.env?.lang || (db.env && db.env.lang) || document.documentElement.lang || 'ar';
      return currencySymbols[lang] || currencySymbols.en || currencyCode;
    }

    function getLocale(db){
      return db.env.lang === 'ar' ? 'ar-EG' : 'en-US';
    }

    function formatCurrencyValue(db, amount){
      try{
        return new Intl.NumberFormat(getLocale(db), { style:'currency', currency:getCurrency(db) }).format(Number(amount)||0);
      } catch(_){
        const numeric = (Number(amount)||0).toFixed(2);
        return `${numeric} ${getCurrencySymbol(db)}`;
      }
    }

    function round(value){
      return Math.round((Number(value) || 0) * 100) / 100;
    }

    function getLineUnitPrice(line){
      if(!line) return 0;
      const base = Number(line.basePrice != null ? line.basePrice : line.price) || 0;
      const modifiers = Array.isArray(line.modifiers) ? line.modifiers : [];
      const modifierDelta = modifiers.reduce((sum, mod)=> sum + (Number(mod.priceChange ?? mod.price_change ?? 0) || 0), 0);
      return round(base + modifierDelta);
    }

    function normalizeDiscount(discount){
      if(!discount || typeof discount !== 'object') return null;
      const type = discount.type === 'percent' ? 'percent' : (discount.type === 'amount' ? 'amount' : null);
      const rawValue = Number(discount.value);
      const value = Number.isFinite(rawValue) ? Math.max(0, rawValue) : 0;
      if(!type || value <= 0) return null;
      if(type === 'percent'){
        return { type, value: Math.min(100, value) };
      }
      return { type, value };
    }

    function parseDiscountInput(raw, baseAmount, maxPercent){
      if(raw == null) return { discount:null };
      const text = String(raw).trim();
      if(!text) return { discount:null };
      const normalizedMax = Number.isFinite(maxPercent) && maxPercent > 0 ? maxPercent : null;
      const sanitized = text.replace(',', '.');
      if(sanitized.endsWith('%')){
        const percentValue = parseFloat(sanitized.slice(0, -1));
        if(!Number.isFinite(percentValue) || percentValue <= 0) return { error:'invalid' };
        const percent = Math.min(100, Math.max(0, percentValue));
        if(normalizedMax != null && percent > normalizedMax) return { error:'limit', limit: normalizedMax };
        return { discount:{ type:'percent', value: percent } };
      }
      const amountValue = parseFloat(sanitized);
      if(!Number.isFinite(amountValue) || amountValue <= 0) return { error:'invalid' };
      if(normalizedMax != null && baseAmount > 0){
        const percentEquivalent = (amountValue / baseAmount) * 100;
        if(percentEquivalent > normalizedMax + 0.0001) return { error:'limit', limit: normalizedMax };
      }
      return { discount:{ type:'amount', value: amountValue } };
    }

    function computeLineDiscountAmount(line, grossTotal){
      if(!line) return 0;
      const discount = normalizeDiscount(line.discount);
      if(!discount) return 0;
      if(discount.type === 'percent'){
        return round(grossTotal * (discount.value / 100));
      }
      return round(Math.min(discount.value, grossTotal));
    }

    function applyLinePricing(line){
      if(!line) return line;
      const unitPrice = getLineUnitPrice(line);
      const qty = Number(line.qty) || 0;
      const base = Number(line.basePrice != null ? line.basePrice : line.price) || 0;
      const grossTotal = round(unitPrice * qty);
      const discountAmount = computeLineDiscountAmount(line, grossTotal);
      const netTotal = Math.max(0, grossTotal - discountAmount);
      return {
        ...line,
        basePrice: round(base),
        price: unitPrice,
        total: netTotal
      };
    }

    function updateLineWithPricing(line, updates){
      if(!line) return line;
      return applyLinePricing({ ...line, ...(updates || {}) });
    }

    function calculateTotals(lines, cfg, type, options={}){
      let grossSubtotal = 0;
      let netSubtotal = 0;
      let lineDiscountTotal = 0;
      (lines || []).forEach(line=>{
        if(!line) return;
        const qty = Number(line.qty) || 0;
        const unit = getLineUnitPrice(line);
        const gross = round(qty * unit);
        const fallbackTotal = Number(line.total);
        const net = Number.isFinite(fallbackTotal) ? fallbackTotal : gross;
        grossSubtotal += gross;
        netSubtotal += net;
        lineDiscountTotal += Math.max(0, gross - net);
      });
      const normalizedOrderDiscount = normalizeDiscount(options.orderDiscount);
      const orderDiscountBase = netSubtotal;
      const orderDiscountAmount = normalizedOrderDiscount
        ? normalizedOrderDiscount.type === 'percent'
          ? round(orderDiscountBase * (normalizedOrderDiscount.value / 100))
          : round(Math.min(normalizedOrderDiscount.value, orderDiscountBase))
        : 0;
      const subtotalAfterDiscount = Math.max(0, netSubtotal - orderDiscountAmount);
      const serviceRate = type === 'dine_in' ? (cfg.service_charge_rate || 0) : 0;
      const service = subtotalAfterDiscount * serviceRate;
      const vatBase = subtotalAfterDiscount + service;
      const vat = vatBase * (cfg.tax_rate || 0);
      const deliveryFee = type === 'delivery' ? (cfg.default_delivery_fee || 0) : 0;
      const discount = lineDiscountTotal + orderDiscountAmount;
      const due = subtotalAfterDiscount + service + vat + deliveryFee;
      return {
        subtotal: round(netSubtotal),
        service: round(service),
        vat: round(vat),
        discount: round(discount),
        deliveryFee: round(deliveryFee),
        due: round(due)
      };
    }

    function getActivePaymentEntries(order, paymentsState){
      const split = Array.isArray(paymentsState?.split) ? paymentsState.split.filter(entry=> entry && Number(entry.amount) > 0) : [];
      if(split.length) return split;
      return Array.isArray(order?.payments) ? order.payments.filter(entry=> entry && Number(entry.amount) > 0) : [];
    }

    function summarizePayments(totals, entries){
      const due = round(Number(totals?.due || 0));
      const paid = round((entries || []).reduce((sum, entry)=> sum + (Number(entry.amount) || 0), 0));
      const remaining = Math.max(0, round(due - paid));
      let state = 'unpaid';
      if(paid > 0 && remaining > 0) state = 'partial';
      if(paid >= due && due > 0) state = 'paid';
      if(due === 0 && paid === 0) state = 'unpaid';
      return { due, paid, remaining, state };
    }

    function notesToText(notes, separator=' • '){
      if(!notes) return '';
      const entries = Array.isArray(notes) ? notes : [notes];
      return entries
        .map(entry=>{
          if(!entry) return '';
          if(typeof entry === 'string') return entry.trim();
          if(typeof entry === 'object' && entry.message) return String(entry.message).trim();
          return '';
        })
        .filter(Boolean)
        .join(separator);
    }

    function normalizeOrderTypeId(value){
      if(!value) return 'dine_in';
      const normalized = String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
      return ORDER_TYPE_IDS.has(normalized) ? normalized : normalized || 'dine_in';
    }

    function summarizeShiftOrders(history, shift){
      if(!shift) return { totalsByType:{}, paymentsByMethod:{}, totalSales:0, orders:[], ordersCount:0, countsByType:{} };
      const shiftId = shift.id;
      const historyList = Array.isArray(history)
        ? history.filter(entry=> entry && entry.isPersisted !== false && entry.dirty !== true && entry.status !== 'draft')
        : [];
      const orders = [];
      const totalsAccumulator = {};
      const paymentsAccumulator = {};
      const paymentEntries = [];
      const countsAccumulator = {};
      if(shiftId){
        historyList.forEach(order=>{
          if(!order || order.shiftId !== shiftId) return;
          const total = round(order?.totals?.due || 0);
          const typeKey = normalizeOrderTypeId(order?.type || order?.header?.type_id || 'dine_in');
          totalsAccumulator[typeKey] = round((totalsAccumulator[typeKey] || 0) + total);
          countsAccumulator[typeKey] = (countsAccumulator[typeKey] || 0) + 1;
          const payments = Array.isArray(order?.payments) ? order.payments : [];
          payments.forEach(payment=>{
            if(!payment) return;
            const methodKey = String(payment.method || payment.id || 'cash');
            const amount = round(payment.amount || 0);
            paymentsAccumulator[methodKey] = round((paymentsAccumulator[methodKey] || 0) + amount);
            paymentEntries.push({
              id: payment.id || `${order.id}-${methodKey}-${paymentEntries.length+1}`,
              method: methodKey,
              amount,
              orderId: order.id,
              capturedAt: order.savedAt || order.updatedAt || order.createdAt || Date.now()
            });
          });
          orders.push({
            id: order.id,
            total,
            savedAt: order.savedAt || order.updatedAt || order.createdAt || Date.now(),
            type: typeKey
          });
        });
      }
      if(!orders.length && Array.isArray(shift.orders) && shift.orders.length){
        shift.orders.forEach((entry, idx)=>{
          if(!entry) return;
          if(entry.isPersisted === false || entry.dirty === true || entry.status === 'draft') return;
          if(typeof entry === 'string'){
            const typeKey = 'dine_in';
            countsAccumulator[typeKey] = (countsAccumulator[typeKey] || 0) + 1;
            orders.push({
              id: entry,
              total: 0,
              savedAt: shift.closedAt || shift.openedAt || Date.now(),
              type: typeKey
            });
          } else {
            const typeKey = normalizeOrderTypeId(entry.type || entry.orderType || entry.type_id || 'dine_in');
            const total = round(entry.total || entry.amount || 0);
            totalsAccumulator[typeKey] = round((totalsAccumulator[typeKey] || 0) + total);
            countsAccumulator[typeKey] = (countsAccumulator[typeKey] || 0) + 1;
            orders.push({
              id: entry.id || entry.orderId || `order-${idx+1}`,
              total,
              savedAt: entry.savedAt || entry.updatedAt || shift.closedAt || shift.openedAt || Date.now(),
              type: typeKey
            });
          }
        });
      }
      const totalsKeys = new Set([
        ...Object.keys(shift.totalsByType || {}),
        ...Object.keys(totalsAccumulator)
      ]);
      const totalsByType = {};
      if(totalsKeys.size === 0){
        ORDER_TYPES.forEach(type=>{ totalsByType[type.id] = 0; });
      } else {
        totalsKeys.forEach(key=>{
          const typeKey = normalizeOrderTypeId(key);
          const computed = totalsAccumulator[typeKey];
          const fallback = shift.totalsByType?.[typeKey];
          if(computed != null){
            totalsByType[typeKey] = round(computed);
          } else if(fallback != null){
            totalsByType[typeKey] = round(fallback);
          }
        });
      }
      const paymentKeys = new Set([
        ...Object.keys(shift.paymentsByMethod || {}),
        ...Object.keys(paymentsAccumulator)
      ]);
      const paymentsByMethod = {};
      paymentKeys.forEach(key=>{
        const computed = paymentsAccumulator[key];
        const fallback = shift.paymentsByMethod?.[key];
        if(computed != null){
          paymentsByMethod[key] = round(computed);
        } else if(fallback != null){
          paymentsByMethod[key] = round(fallback);
        }
      });
      const countKeys = new Set([
        ...Object.keys(shift.countsByType || {}),
        ...Object.keys(countsAccumulator)
      ]);
      const countsByType = {};
      countKeys.forEach(key=>{
        const typeKey = normalizeOrderTypeId(key);
        if(countsAccumulator[typeKey] != null){
          countsByType[typeKey] = countsAccumulator[typeKey];
        } else if(shift.countsByType && shift.countsByType[typeKey] != null){
          countsByType[typeKey] = shift.countsByType[typeKey];
        }
      });
      const totalSales = orders.length
        ? round(orders.reduce((sum, entry)=> sum + (Number(entry.total)||0), 0))
        : round(shift.totalSales || 0);
      const ordersCount = orders.length
        ? orders.length
        : (typeof shift.ordersCount === 'number'
            ? shift.ordersCount
            : (Array.isArray(shift.orders) ? shift.orders.length : 0));
      const ordersList = orders.length
        ? orders
        : (Array.isArray(shift.orders)
            ? shift.orders.map(entry=> typeof entry === 'object' ? { ...entry } : { id: entry, total: 0, savedAt: shift.closedAt || shift.openedAt || Date.now(), type:'dine_in' })
            : []);
      return {
        totalsByType,
        paymentsByMethod,
        totalSales,
        orders: ordersList,
        ordersCount,
        countsByType,
        payments: paymentEntries,
        refunds: Array.isArray(shift.refunds) ? shift.refunds.map(item=> ({ ...item })) : [],
        returns: Array.isArray(shift.returns) ? shift.returns.map(item=> ({ ...item })) : []
      };
    }

    function computeRealtimeReports(db){
      const history = (Array.isArray(db.data.ordersHistory) ? db.data.ordersHistory : [])
        .filter(order=> order && order.isPersisted !== false && order.dirty !== true && order.status !== 'draft');
      const now = Date.now();
      const start = new Date(now);
      start.setHours(0,0,0,0);
      const startTs = start.getTime();
      const endTs = startTs + 24 * 60 * 60 * 1000;
      let salesToday = 0;
      let ordersCount = 0;
      const itemCounter = new Map();
      history.forEach(order=>{
        if(!order) return;
        const savedAt = order.savedAt || order.updatedAt || order.createdAt;
        if(savedAt == null) return;
        if(savedAt < startTs || savedAt >= endTs) return;
        const amount = Number(order?.totals?.due || order.total || 0);
        if(Number.isFinite(amount)){
          salesToday += amount;
        }
        ordersCount += 1;
        const lines = Array.isArray(order.lines) ? order.lines : [];
        lines.forEach(line=>{
          if(!line) return;
          const key = line.itemId || line.name?.en || line.name?.ar || line.name;
          if(!key) return;
          const qty = Number(line.qty) || 0;
          itemCounter.set(key, (itemCounter.get(key) || 0) + qty);
        });
      });
      let topItemId = null;
      let maxQty = 0;
      itemCounter.forEach((qty, key)=>{
        if(qty > maxQty){
          maxQty = qty;
          topItemId = key;
        }
      });
      const avgTicket = ordersCount ? salesToday / ordersCount : 0;
      return {
        salesToday: round(salesToday),
        ordersCount,
        avgTicket: round(avgTicket),
        topItemId
      };
    }

    function createOrderLine(item, qty, overrides){
      const quantity = qty || 1;
      const price = Number(item.price) || 0;
      const now = Date.now();
      const uniqueId = overrides?.id || `ln-${item.id}-${now.toString(36)}-${Math.random().toString(16).slice(2,6)}`;
      const baseLine = {
        id: uniqueId,
        itemId: item.id,
        name: item.name,
        description: item.description,
        price,
        basePrice: price,
        qty: quantity,
        total: round(price * quantity),
        modifiers: overrides?.modifiers || [],
        notes: overrides?.notes || [],
        discount: normalizeDiscount(overrides?.discount),
        status: overrides?.status || 'draft',
        stage: overrides?.stage || 'new',
        kitchenSection: overrides?.kitchenSection || item.kitchenSection || null,
        locked: overrides?.locked || false,
        createdAt: overrides?.createdAt || now,
        updatedAt: overrides?.updatedAt || now
      };
      return applyLinePricing(baseLine);
    }

    function filterMenu(menu, lang){
      const term = (menu.search || '').trim().toLowerCase();
      const favorites = new Set((menu.favorites || []).map(String));
      return (menu.items || []).filter(item=>{
        if(menu.showFavoritesOnly && !favorites.has(String(item.id))) return false;
        const inCategory = menu.category === 'all' || item.category === menu.category;
        if(!inCategory) return false;
        if(!term) return true;
        const name = localize(item.name, lang).toLowerCase();
        const desc = localize(item.description, lang).toLowerCase();
        return name.includes(term) || desc.includes(term);
      });
    }

    function formatSync(ts, lang){
      if(!ts) return null;
      try{
        const formatter = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-GB', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
        return formatter.format(new Date(ts));
      } catch(_){
        return new Date(ts).toLocaleTimeString();
      }
    }

    function formatDateTime(ts, lang, options){
      if(!ts) return '';
      try{
        const locale = lang === 'ar' ? 'ar-EG' : 'en-GB';
        const formatter = new Intl.DateTimeFormat(locale, options || { hour:'2-digit', minute:'2-digit' });
        return formatter.format(new Date(ts));
      } catch(_){
        return new Date(ts).toLocaleString();
      }
    }

    function renderPrintableHTML(db, docType, size){
      const t = getTexts(db);
      const order = db.data.order || {};
      const lang = db.env.lang;
      const tablesNames = (order.tableIds || []).map(id=>{
        const table = (db.data.tables || []).find(tbl=> tbl.id === id);
        return table?.name || id;
      });
      const printableOrderId = getDisplayOrderId(order, t);
      const splitState = Array.isArray(db.data.payments?.split) ? db.data.payments.split : [];
      const orderPayments = Array.isArray(order.payments) ? order.payments : [];
      const payments = splitState.length ? splitState : orderPayments;
      const methodsCatalog = (db.data.payments?.methods && db.data.payments.methods.length)
        ? db.data.payments.methods
        : PAYMENT_METHODS;
      const methodsMap = new Map(methodsCatalog.map(method=> [method.id, method]));
      const totalPaid = payments.reduce((sum, entry)=> sum + (Number(entry.amount)||0), 0);
      const due = order.totals?.due || 0;
      const changeDue = Math.max(0, round(totalPaid - due));
      const totalsRows = [
        { label:t.ui.subtotal, value: order.totals?.subtotal || 0 },
        order.totals?.service ? { label:t.ui.service, value: order.totals.service } : null,
        { label:t.ui.vat, value: order.totals?.vat || 0 },
        order.totals?.deliveryFee ? { label:t.ui.delivery_fee, value: order.totals.deliveryFee } : null,
        order.totals?.discount ? { label:t.ui.discount, value: order.totals.discount } : null
      ].filter(Boolean);
      const docLabels = {
        customer: t.ui.print_doc_customer,
        summary: t.ui.print_doc_summary,
        kitchen: t.ui.print_doc_kitchen
      };
      const currentDocLabel = docLabels[docType] || t.ui.print_doc_customer;
      const lineItems = (order.lines || []).map(line=>{
        const name = `${escapeHTML(localize(line.name, lang))} × ${Number(line.qty)||0}`;
        const price = formatCurrencyValue(db, line.total);
        const modifiers = Array.isArray(line.modifiers) ? line.modifiers : [];
        const modifiersHtml = modifiers.map(mod=>{
          const delta = Number(mod.priceChange || 0) || 0;
          const priceLabel = delta ? `${delta > 0 ? '+' : '−'} ${formatCurrencyValue(db, Math.abs(delta))}` : escapeHTML(t.ui.line_modifiers_free);
          return `<div class="row sub"><span>${escapeHTML(localize(mod.label, lang))}</span><span>${priceLabel}</span></div>`;
        }).join('');
        const notes = Array.isArray(line.notes) ? line.notes.filter(Boolean).join(' • ') : (line.notes || '');
        const notesHtml = notes ? `<div class="row note"><span>📝 ${escapeHTML(notes)}</span><span></span></div>` : '';
        return `<div class="row"><span>${name}</span><span>${price}</span></div>${modifiersHtml}${notesHtml}`;
      }).join('');
      const totalsHtml = totalsRows.map(row=> {
        const price = formatCurrencyValue(db, row.value);
        return `<div class="row"><span>${escapeHTML(row.label)}</span><span>${price}</span></div>`;
      }).join('');
      const paymentsHtml = payments.map(entry=>{
        const method = methodsMap.get(entry.method);
        const label = method ? `${escapeHTML(localize(method.label, lang))}` : escapeHTML(entry.method || '');
        const price = formatCurrencyValue(db, entry.amount);
        return `<div class="row"><span>${label}</span><span>${price}</span></div>`;
      }).join('');
      const sizePresets = {
        thermal_80:{ width:'72mm', maxWidth:'72mm', padding:'18px 16px', fontSize:'13px', heading:'20px', meta:'12px', total:'16px', bodyBg:'#f4f7fb', border:'1px solid #dbeafe', radius:'20px', shadow:'0 18px 40px rgba(15,23,42,0.12)', page:'@page { size: 80mm auto; margin:4mm; }', bodyPadding:'18px' },
        receipt_15:{ width:'150mm', maxWidth:'150mm', padding:'24px 20px', fontSize:'13px', heading:'22px', meta:'13px', total:'18px', bodyBg:'#f5f8ff', border:'1px dashed #cbd5f5', radius:'28px', shadow:'0 22px 50px rgba(15,23,42,0.14)', page:'@page { size: 150mm auto; margin:6mm; }', bodyPadding:'24px' },
        a5:{ width:'100%', maxWidth:'720px', padding:'28px 32px', fontSize:'15px', heading:'26px', meta:'15px', total:'20px', bodyBg:'#f8fafc', border:'1px solid #dbe4f3', radius:'32px', shadow:'0 26px 64px rgba(15,23,42,0.18)', page:'@page { size: A5 landscape; margin:12mm; }', bodyPadding:'36px' },
        a4:{ width:'100%', maxWidth:'860px', padding:'32px 40px', fontSize:'16px', heading:'28px', meta:'16px', total:'22px', bodyBg:'#ffffff', border:'1px solid #d0dae8', radius:'36px', shadow:'0 30px 70px rgba(15,23,42,0.2)', page:'@page { size: A4 portrait; margin:18mm; }', bodyPadding:'48px' }
      };
      const preset = sizePresets[size] || sizePresets.thermal_80;
      const dirAttr = db.env.dir || (lang === 'ar' ? 'rtl' : 'ltr');
      const tablesLine = tablesNames.length ? `${escapeHTML(t.ui.tables)}: ${escapeHTML(tablesNames.join(', '))}` : '';
      const guestLine = order.type === 'dine_in' && (order.guests || 0) > 0
        ? `${escapeHTML(t.ui.guests)}: ${order.guests}`
        : '';
      const orderMeta = [
        `${escapeHTML(t.ui.order_id)} ${escapeHTML(printableOrderId)}`,
        guestLine,
        tablesLine,
        formatDateTime(order.updatedAt || Date.now(), lang, { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })
      ].filter(Boolean).map(val=> `<p class="meta">${escapeHTML(val)}</p>`).join('');
      const noItems = `<p class="muted">${escapeHTML(t.ui.cart_empty)}</p>`;
      const changeRow = payments.length ? `<div class="row"><span>${escapeHTML(t.ui.print_change_due)}</span><span>${formatCurrencyValue(db, changeDue)}</span></div>` : '';
      const paidRow = payments.length ? `<div class="row"><span>${escapeHTML(t.ui.paid)}</span><span>${formatCurrencyValue(db, totalPaid)}</span></div>` : '';
      const html = `<!DOCTYPE html>
<html lang="${lang}" dir="${dirAttr}">
  <head>
    <meta charset="utf-8"/>
    <title>${escapeHTML(currentDocLabel)}</title>
    <style>
      :root { color-scheme: light; font-family: 'Tajawal', 'Cairo', system-ui, sans-serif; }
      ${preset.page || ''}
      body { margin:0; background:${preset.bodyBg || '#f8fafc'}; color:#0f172a; display:flex; justify-content:center; padding:${preset.bodyPadding || '32px'}; direction:${dirAttr}; }
      .receipt { width:${preset.width}; max-width:${preset.maxWidth || preset.width}; padding:${preset.padding}; font-size:${preset.fontSize}; background:#ffffff; border:${preset.border || '1px solid #dbe4f3'}; border-radius:${preset.radius || '24px'}; box-shadow:${preset.shadow || '0 24px 60px rgba(15,23,42,0.16)'}; }
      .receipt header { text-align:center; margin-bottom:16px; }
      .receipt h1 { margin:0; font-size:${preset.heading}; font-weight:700; }
      .receipt .meta { margin:4px 0; color:#64748b; font-size:${preset.meta}; }
      .receipt .rows { margin:16px 0; }
      .receipt .row { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; margin:8px 0; font-size:${preset.fontSize}; }
      .receipt .row.sub { font-size:${preset.meta}; color:#64748b; padding-inline-start:16px; }
      .receipt .row.note { font-size:${preset.meta}; color:#94a3b8; padding-inline-start:16px; }
      .receipt .row span:last-child { font-weight:600; }
      .receipt .separator { height:1px; background:#e2e8f0; margin:16px 0; }
      .receipt .muted { text-align:center; color:#cbd5f5; margin:24px 0; }
      .receipt .totals strong { display:flex; justify-content:space-between; margin-top:12px; font-size:${preset.total}; }
      footer { margin-top:24px; text-align:center; color:#94a3b8; font-size:${preset.meta}; }
    </style>
    ${ "<"  +"script>"}
      window.addEventListener('load', function(){
        window.focus();
        setTimeout(function(){ try{ window.print(); } catch(_){} }, 200);
      });
    ${ "</"  +"script>"}
  </head>
  <body>
    <article class="receipt">
      <header>
        <h1>Mishkah Restaurant</h1>
        <p class="meta">${escapeHTML(t.ui.print_header_address)}: 12 Nile Street</p>
        <p class="meta">${escapeHTML(t.ui.print_header_phone)}: 0100000000</p>
        <p class="meta">${escapeHTML(currentDocLabel)}</p>
      </header>
      <section>
        ${orderMeta}
      </section>
      <div class="separator"></div>
      <section class="rows">
        ${lineItems || noItems}
      </section>
      <div class="separator"></div>
      <section class="rows totals">
        ${totalsHtml}
        <strong><span>${escapeHTML(t.ui.total)}</span><span>${formatCurrencyValue(db, due)}</span></strong>
        ${paidRow}
        ${changeRow}
        ${paymentsHtml}
      </section>
      <footer>
        <p>${escapeHTML(t.ui.print_footer_thanks)}</p>
        <p>${escapeHTML(t.ui.print_footer_policy)}</p>
        <p>${escapeHTML(t.ui.print_footer_feedback)} • QR</p>
      </footer>
    </article>
  </body>
</html>`;
      return html;
    }

    function toInputDateTime(ts){
      if(!ts) return '';
      const date = new Date(ts);
      const pad = (v)=> String(v).padStart(2, '0');
      const year = date.getFullYear();
      const month = pad(date.getMonth() + 1);
      const day = pad(date.getDate());
      const hours = pad(date.getHours());
      const minutes = pad(date.getMinutes());
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    }


    function createIndexedDBAdapter(name, version){
      const SHIFT_STORE = 'shifts';
      const META_STORE = 'posMeta';
      const TEMP_STORE = 'order_temp';

      const storeMaps = {
        orders: new Map(),
        orderLines: new Map(),
        orderNotes: new Map(),
        orderStatusLogs: new Map(),
        [SHIFT_STORE]: new Map(),
        [META_STORE]: new Map(),
        [TEMP_STORE]: new Map(),
        syncLog: new Map()
      };

      const tempStorageKey = `${name || 'mishkah-pos'}:${TEMP_STORE}`;
      const canUseLocalStorage = (()=>{
        if(typeof window === 'undefined' || !window.localStorage) return false;
        try {
          const probeKey = `${tempStorageKey}:probe`;
          window.localStorage.setItem(probeKey, '1');
          window.localStorage.removeItem(probeKey);
          return true;
        } catch(_err){
          return false;
        }
      })();
      let tempStoreHydrated = false;
      const hydrateTempStoreFromStorage = ()=>{
        if(tempStoreHydrated) return;
        tempStoreHydrated = true;
        if(!canUseLocalStorage) return;
        try {
          const raw = window.localStorage.getItem(tempStorageKey);
          if(!raw) return;
          const parsed = JSON.parse(raw);
          const entries = Array.isArray(parsed)
            ? parsed
            : (parsed && typeof parsed === 'object' ? Object.values(parsed) : []);
          storeMaps[TEMP_STORE].clear();
          entries.forEach(entry=>{
            if(!entry || !entry.id) return;
            storeMaps[TEMP_STORE].set(entry.id, cloneRecord(entry));
          });
        } catch(error){
          console.warn('[Mishkah][POS] Failed to hydrate temp orders storage.', error);
        }
      };
      const persistTempStoreToStorage = ()=>{
        if(!canUseLocalStorage) return;
        try {
          const payload = Array.from(storeMaps[TEMP_STORE].values()).map(cloneRecord);
          window.localStorage.setItem(tempStorageKey, JSON.stringify(payload));
        } catch(error){
          console.warn('[Mishkah][POS] Failed to persist temp orders storage.', error);
        }
      };
      const clearTempStoreFromStorage = ()=>{
        if(!canUseLocalStorage) return;
        try { window.localStorage.removeItem(tempStorageKey); } catch(_err){}
      };
      hydrateTempStoreFromStorage();

      const db = {
        schema:{
          stores:{
            orders:{
              keyPath:'id',
              indices:[
                { name:'by_status', keyPath:'status' },
                { name:'by_stage', keyPath:'fulfillmentStage' },
                { name:'by_type', keyPath:'type' }
              ]
            },
            orderLines:{ keyPath:'uid', indices:[{ name:'by_order', keyPath:'orderId' }] },
            orderNotes:{ keyPath:'id', indices:[{ name:'by_order', keyPath:'orderId' }] },
            orderStatusLogs:{ keyPath:'id', indices:[{ name:'by_order', keyPath:'orderId' }] },
            [SHIFT_STORE]:{
              keyPath:'id',
              indices:[
                { name:'by_pos', keyPath:['posId','openedAt'] },
                { name:'by_pos_status', keyPath:['posId','isClosed'] }
              ]
            },
            [META_STORE]:{ keyPath:'id' },
            [TEMP_STORE]:{
              keyPath:'id',
              indices:[{ name:'by_updated', keyPath:'updatedAt' }]
            },
            syncLog:{ keyPath:'ts' }
          }
        },
        version: Math.max(1, version|0) || 1,
        name: name || 'mishkah-pos'
      };

      const ensureArray = (value)=> Array.isArray(value) ? value : [];
      const cloneRecord = (value)=> value == null ? value : cloneDeep(value);
      let mirrorOnly = false;

      const isMirrorMutation = (options)=>{
        if(!options) return false;
        if(options.mirror === true) return true;
        const origin = typeof options.origin === 'string' ? options.origin.toLowerCase() : null;
        const source = typeof options.source === 'string' ? options.source.toLowerCase() : null;
        const tag = origin || source || null;
        if(!tag) return false;
        return ['remote', 'mirror', 'server', 'snapshot', 'bootstrap', 'ws2-event', 'central-sync'].includes(tag);
      };

      const ensureMetaRecord = (key, defaults={})=>{
        const safeKey = key || 'default';
        const existing = storeMaps[META_STORE].get(safeKey);
        if(existing){
          if(defaults && typeof defaults === 'object'){
            let mutated = false;
            Object.keys(defaults).forEach(prop=>{
              if(prop === 'id') return;
              if(existing[prop] === undefined){
                existing[prop] = cloneDeep(defaults[prop]);
                mutated = true;
              }
            });
            if(mutated) storeMaps[META_STORE].set(safeKey, existing);
          }
          return existing;
        }
        const created = { id: safeKey };
        if(defaults && typeof defaults === 'object'){
          Object.keys(defaults).forEach(prop=>{
            if(prop === 'id') return;
            created[prop] = cloneDeep(defaults[prop]);
          });
        }
        storeMaps[META_STORE].set(safeKey, created);
        return created;
      };

      const removeByOrderId = (storeName, orderId)=>{
        const store = storeMaps[storeName];
        for(const [key, record] of store.entries()){
          if(record.orderId === orderId){
            store.delete(key);
          }
        }
      };

      const markSyncLog = (ts)=>{
        storeMaps.syncLog.set(ts, { ts });
        if(storeMaps.syncLog.size > 500){
          const oldestKey = storeMaps.syncLog.keys().next().value;
          if(oldestKey !== undefined) storeMaps.syncLog.delete(oldestKey);
        }
      };

      function toTimestamp(value){
        if(value == null) return Date.now();
        if(typeof value === 'number') return value;
        const parsed = new Date(value).getTime();
        return Number.isFinite(parsed) ? parsed : Date.now();
      }

      function normalizeShiftRecord(record){
        if(!record) return null;
        const base = { ...record };
        base.id = base.id || `shift-${Math.random().toString(16).slice(2,10)}`;
        base.isClosed = base.isClosed === 1 || base.isClosed === true;
        base.openedAt = base.openedAt || Date.now();
        base.closedAt = base.closedAt || null;
        base.employeeId = base.employeeId || base.cashierId || null;
        if(base.posNumber != null){
          const numericPos = Number(base.posNumber);
          base.posNumber = Number.isFinite(numericPos) ? numericPos : base.posNumber;
        }
        return base;
      }

      async function getActiveShift(posId){
        if(!posId) return null;
        const matches = [];
        for(const shift of storeMaps[SHIFT_STORE].values()){
          if(shift.posId === posId && !shift.isClosed){
            matches.push(shift);
          }
        }
        if(!matches.length) return null;
        matches.sort((a,b)=> (b.openedAt || 0) - (a.openedAt || 0));
        return cloneRecord(normalizeShiftRecord(matches[0]));
      }

      async function listShifts({ posId, limit=50 }={}){
        const all = [];
        for(const shift of storeMaps[SHIFT_STORE].values()){
          if(posId && shift.posId !== posId) continue;
          all.push(cloneRecord(normalizeShiftRecord(shift)));
        }
        all.sort((a,b)=> (b.openedAt || 0) - (a.openedAt || 0));
        return all.slice(0, limit);
      }

      async function writeShift(record){
        const normalized = normalizeShiftRecord(record);
        if(!normalized.posId) throw new Error('Shift payload requires posId');
        storeMaps[SHIFT_STORE].set(normalized.id, normalized);
        return cloneRecord(normalized);
      }

      async function openShiftRecord(record){
        if(!record || !record.posId) throw new Error('Shift payload requires posId');
        const active = await getActiveShift(record.posId);
        if(active) return active;
        return writeShift({ ...record, isClosed:false, closedAt:null });
      }

      async function closeShiftRecord(id, patch={}){
        if(!id) throw new Error('Shift id is required');
        const current = storeMaps[SHIFT_STORE].get(id);
        if(!current) return null;
        const payload = normalizeShiftRecord({
          ...current,
          ...patch,
          isClosed:true,
          closedAt: patch.closedAt || Date.now()
        });
        storeMaps[SHIFT_STORE].set(payload.id, payload);
        return cloneRecord(payload);
      }

      async function nextInvoiceNumber(posId, prefix){
        if(!posId) throw new Error('posId required for invoice sequence');
        const meta = { ...ensureMetaRecord(posId, { invoiceCounter:0 }) };
        const nextValue = Number(meta.invoiceCounter || 0) + 1;
        meta.invoiceCounter = nextValue;
        storeMaps[META_STORE].set(posId, meta);
        const safePrefix = prefix || posId;
        return { value: nextValue, id: `${safePrefix}-${nextValue}` };
      }

      async function peekInvoiceCounter(posId){
        const meta = ensureMetaRecord(posId, { invoiceCounter:0 });
        return Number(meta.invoiceCounter || 0);
      }

      async function getSyncMetadata(scope='default'){
        const key = scope ? `sync:${scope}` : 'sync:default';
        const record = ensureMetaRecord(key, {
          appliedEventId:null,
          branchSnapshotVersion:null,
          syncUpdatedAt:null
        });
        return {
          appliedEventId: record.appliedEventId ?? null,
          branchSnapshotVersion: record.branchSnapshotVersion ?? null,
          updatedAt: record.syncUpdatedAt ?? null
        };
      }

      async function updateSyncMetadata(scope='default', patch={}){
        const key = scope ? `sync:${scope}` : 'sync:default';
        const base = { ...ensureMetaRecord(key, {
          appliedEventId:null,
          branchSnapshotVersion:null,
          syncUpdatedAt:null
        }) };
        let changed = false;
        if(Object.prototype.hasOwnProperty.call(patch, 'appliedEventId') && patch.appliedEventId !== base.appliedEventId){
          base.appliedEventId = patch.appliedEventId;
          changed = true;
        }
        if(Object.prototype.hasOwnProperty.call(patch, 'branchSnapshotVersion') && patch.branchSnapshotVersion !== base.branchSnapshotVersion){
          base.branchSnapshotVersion = patch.branchSnapshotVersion;
          changed = true;
        }
        const hasUpdatedAt = Object.prototype.hasOwnProperty.call(patch, 'updatedAt');
        const resolvedUpdatedAt = hasUpdatedAt ? patch.updatedAt : Date.now();
        if(resolvedUpdatedAt !== base.syncUpdatedAt){
          base.syncUpdatedAt = resolvedUpdatedAt;
          changed = true;
        }
        if(changed){
          storeMaps[META_STORE].set(key, base);
        }
        return {
          appliedEventId: base.appliedEventId ?? null,
          branchSnapshotVersion: base.branchSnapshotVersion ?? null,
          updatedAt: base.syncUpdatedAt ?? null
        };
      }

      async function resetAll(){
        Object.values(storeMaps).forEach(map=> map.clear());
        return true;
      }

      function normalizeLineRecord(orderId, line, defaults){
        const uid = line.uid || line.storageId || `${orderId}::${line.id || line.itemId || Math.random().toString(16).slice(2,8)}`;
        const id = line.id || `${orderId}::${line.itemId || Math.random().toString(16).slice(2,8)}`;
        const qty = Number(line.qty) || 0;
        const price = Number(line.price) || 0;
        const baseStatus = line.status || defaults.status || 'draft';
        const baseStage = line.stage || defaults.stage;
        const kitchenSection = line.kitchenSection || null;
        const createdAt = toTimestamp(line.createdAt || defaults.createdAt);
        const updatedAt = toTimestamp(line.updatedAt || defaults.updatedAt);
        const logContext = {
          orderId,
          lineId: id,
          statusId: baseStatus,
          kitchenSection,
          actorId: defaults.actorId || null,
          updatedAt
        };
        const statusLogSources = [
          line.statusLogs,
          line.status_logs,
          line.statusHistory,
          line.status_history,
          line.events
        ];
        const statusLogs = [];
        const seen = new Set();
        statusLogSources.forEach(source=>{
          if(!Array.isArray(source)) return;
          source.forEach(entry=>{
            const normalized = normalizeOrderLineStatusLogEntry(entry, logContext);
            if(normalized && normalized.id && !seen.has(normalized.id)){
              seen.add(normalized.id);
              statusLogs.push(normalized);
            }
          });
        });
        if(!statusLogs.length){
          const fallback = normalizeOrderLineStatusLogEntry({
            status: baseStatus,
            stationId: kitchenSection,
            changedAt: updatedAt,
            actorId: logContext.actorId
          }, logContext);
          if(fallback) statusLogs.push(fallback);
        }
        statusLogs.sort((a,b)=> (a.changedAt || 0) - (b.changedAt || 0));
        const latestLog = statusLogs[statusLogs.length - 1] || null;
        const resolvedStatus = latestLog?.status || baseStatus;
        return {
          uid,
          id,
          orderId,
          itemId: line.itemId,
          name: line.name || null,
          description: line.description || null,
          qty,
          price,
          total: Number(line.total) || qty * price,
          status: resolvedStatus,
          stage: baseStage,
          kitchenSection,
          locked: line.locked !== undefined ? !!line.locked : defaults.lockLineEdits,
          notes: Array.isArray(line.notes) ? line.notes.slice() : (line.notes ? [line.notes] : []),
          discount: normalizeDiscount(line.discount),
          createdAt,
          updatedAt,
          statusLogs
        };
      }

      function normalizeNoteRecord(order, note){
        const id = note.id || `${order.id}::note::${toTimestamp(note.createdAt)}`;
        return {
          id,
          orderId: order.id,
          message: note.message || '',
          authorId: note.authorId || 'system',
          authorName: note.authorName || '',
          createdAt: toTimestamp(note.createdAt)
        };
      }

      function normalizeOrder(order){
        if(!order || !order.id) throw new Error('Order payload requires an id');
        if(!order.shiftId) throw new Error('Order payload requires an active shift');
        const now = Date.now();
        const normalizedPosId = order.posId || order.metadata?.posId || null;
        const normalizedPosLabel = order.posLabel || order.metadata?.posLabel || null;
        const normalizedPosNumber = Number.isFinite(order.posNumber)
          ? Number(order.posNumber)
          : (Number.isFinite(order.metadata?.posNumber) ? Number(order.metadata.posNumber) : null);
        const normalizedDiscount = normalizeDiscount(order.discount);
        const normalizedPayments = Array.isArray(order.payments)
          ? order.payments.map(pay=> ({ ...pay, amount: Number(pay.amount) || 0 }))
          : [];
        const fallbackStatus = order.status || order.statusId || order.header?.status || 'open';
        const fallbackStage = order.fulfillmentStage || order.stage || order.header?.stage || 'new';
        const fallbackPaymentState = order.paymentState || order.payment_state || order.header?.paymentState || 'unpaid';
        const updatedBy = order.updatedBy || order.authorId || order.actorId || null;
        const logContext = {
          orderId: order.id,
          statusId: fallbackStatus,
          stageId: fallbackStage,
          paymentStateId: fallbackPaymentState,
          actorId: updatedBy || 'pos',
          updatedAt: order.updatedAt || now
        };
        const statusLogSources = [
          order.statusLogs,
          order.status_logs,
          order.statusHistory,
          order.status_history,
          order.events,
          order.header?.statusLogs,
          order.header?.status_history,
          order.header?.events
        ];
        const statusLogs = [];
        const seenLogIds = new Set();
        statusLogSources.forEach(source=>{
          if(!Array.isArray(source)) return;
          source.forEach(entry=>{
            const normalized = normalizeOrderStatusLogEntry(entry, logContext);
            if(normalized && normalized.id && !seenLogIds.has(normalized.id)){
              seenLogIds.add(normalized.id);
              statusLogs.push(normalized);
            }
          });
        });
        if(!statusLogs.length){
          const fallbackLog = normalizeOrderStatusLogEntry({
            status: fallbackStatus,
            stage: fallbackStage,
            paymentState: fallbackPaymentState,
            changedAt: logContext.updatedAt,
            actorId: logContext.actorId
          }, logContext);
          if(fallbackLog) statusLogs.push(fallbackLog);
        }
        statusLogs.sort((a,b)=> (a.changedAt || 0) - (b.changedAt || 0));
        const latestStatusLog = statusLogs[statusLogs.length - 1] || {};
        const resolvedStatus = latestStatusLog.status || fallbackStatus;
        const resolvedStage = latestStatusLog.stage || fallbackStage;
        const resolvedPaymentState = latestStatusLog.paymentState || fallbackPaymentState;
        const header = {
          id: order.id,
          type: order.type || 'dine_in',
          status: resolvedStatus,
          fulfillmentStage: resolvedStage,
          paymentState: resolvedPaymentState,
          tableIds: Array.isArray(order.tableIds) ? order.tableIds.slice() : [],
          guests: Number.isFinite(order.guests) ? Number(order.guests) : 0,
          totals: order.totals && typeof order.totals === 'object' ? { ...order.totals } : {},
          discount: normalizedDiscount,
          createdAt: order.createdAt || now,
          updatedAt: order.updatedAt || now,
          savedAt: order.savedAt || now,
          allowAdditions: order.allowAdditions !== undefined ? !!order.allowAdditions : true,
          lockLineEdits: order.lockLineEdits !== undefined ? !!order.lockLineEdits : true,
          isPersisted: order.isPersisted !== undefined ? !!order.isPersisted : true,
          origin: order.origin || 'pos',
          shiftId: order.shiftId,
          posId: normalizedPosId,
          posLabel: normalizedPosLabel,
          posNumber: normalizedPosNumber,
          metadata:{
            version:2,
            linesCount: Array.isArray(order.lines) ? order.lines.length : 0,
            notesCount: Array.isArray(order.notes) ? order.notes.length : 0,
            posId: normalizedPosId,
            posLabel: normalizedPosLabel,
            posNumber: normalizedPosNumber,
            discount: normalizedDiscount
          },
          payments: normalizedPayments,
          customerId: order.customerId || null,
          customerAddressId: order.customerAddressId || null,
          customerName: order.customerName || '',
          customerPhone: order.customerPhone || '',
          customerAddress: order.customerAddress || '',
          customerAreaId: order.customerAreaId || null
        };
        const defaults = {
          stage: header.fulfillmentStage,
          lockLineEdits: header.lockLineEdits,
          createdAt: header.createdAt,
          updatedAt: header.updatedAt,
          actorId: logContext.actorId,
          status: header.status
        };
        const lines = ensureArray(order.lines).map(line=> normalizeLineRecord(order.id, line, defaults));
        const notes = ensureArray(order.notes).map(note=> normalizeNoteRecord(order, note));
        return { header, lines, notes, statusLogs };
      }

      function hydrateLine(record){
        return {
          id: record.id,
          itemId: record.itemId,
          name: record.name,
          description: record.description,
          qty: record.qty,
          price: record.price,
          total: record.total,
          status: record.status,
          stage: record.stage,
          kitchenSection: record.kitchenSection,
          locked: !!record.locked,
          notes: Array.isArray(record.notes) ? record.notes : [],
          discount: normalizeDiscount(record.discount),
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
          statusLogs: Array.isArray(record.statusLogs)
            ? record.statusLogs.map(log=> ({ ...log }))
            : []
        };
      }

      function hydrateOrder(header){
        const base = cloneRecord(header);
        const linesRaw = [];
        for(const line of storeMaps.orderLines.values()){
          if(line.orderId === base.id){
            linesRaw.push(line);
          }
        }
        linesRaw.sort((a,b)=> (a.createdAt || 0) - (b.createdAt || 0));
        const notesRaw = [];
        for(const note of storeMaps.orderNotes.values()){
          if(note.orderId === base.id){
            notesRaw.push(note);
          }
        }
        notesRaw.sort((a,b)=> (a.createdAt || 0) - (b.createdAt || 0));
        const eventsRaw = [];
        for(const evt of storeMaps.orderStatusLogs.values()){
          if(evt.orderId === base.id){
            eventsRaw.push(evt);
          }
        }
        eventsRaw.sort((a,b)=> (a.changedAt || a.at || 0) - (b.changedAt || b.at || 0));
        return {
          ...base,
          lines: linesRaw.map(hydrateLine),
          notes: notesRaw.map(note=>({
            id: note.id,
            message: note.message,
            authorId: note.authorId,
            authorName: note.authorName,
            createdAt: note.createdAt
          })),
          payments: Array.isArray(base.payments) ? base.payments.map(pay=> ({ ...pay })) : [],
          discount: normalizeDiscount(base.discount),
          dirty:false,
          statusLogs: eventsRaw.map(evt=>({
            id: evt.id,
            status: evt.status,
            stage: evt.stage,
            paymentState: evt.paymentState,
            actorId: evt.actorId,
            source: evt.source,
            reason: evt.reason,
            metadata: evt.metadata,
            changedAt: evt.changedAt || evt.at
          }))
        };
      }

      async function saveOrder(order, options={}){
        if(mirrorOnly && !isMirrorMutation(options)){
          const error = new Error('POS IndexedDB mirror is read-only.');
          error.code = 'POS_DB_MIRROR_ONLY';
          throw error;
        }
        const normalized = normalizeOrder(order);
        const orderId = normalized.header.id;
        storeMaps.orders.set(orderId, normalized.header);
        removeByOrderId('orderLines', orderId);
        removeByOrderId('orderNotes', orderId);
        removeByOrderId('orderStatusLogs', orderId);
        normalized.lines.forEach(line=> storeMaps.orderLines.set(line.uid, line));
        normalized.notes.forEach(note=> storeMaps.orderNotes.set(note.id, note));
        normalized.statusLogs.forEach(evt=> storeMaps.orderStatusLogs.set(evt.id, evt));
        markSyncLog(Date.now());
        return true;
      }

      function sanitizeTempOrder(order){
        if(!order || !order.id) return null;
        const now = Date.now();
        const type = order.type || 'dine_in';
        const normalizedDiscount = normalizeDiscount(order.discount);
        const normalizedLines = Array.isArray(order.lines)
          ? order.lines.map(line=> ({
              ...line,
              discount: normalizeDiscount(line.discount)
            }))
          : [];
        const normalizedNotes = Array.isArray(order.notes)
          ? order.notes.map(note=> ({ ...note }))
          : [];
        const normalizedPayments = Array.isArray(order.payments)
          ? order.payments.map(pay=> ({ ...pay, amount: Number(pay.amount) || 0 }))
          : [];
        const payload = {
          ...order,
          id: order.id,
          type,
          status: order.status || 'open',
          fulfillmentStage: order.fulfillmentStage || order.stage || 'new',
          paymentState: order.paymentState || 'unpaid',
          tableIds: Array.isArray(order.tableIds) ? order.tableIds.slice() : [],
          guests: Number.isFinite(order.guests) ? Number(order.guests) : 0,
          totals: order.totals && typeof order.totals === 'object' ? { ...order.totals } : {},
          discount: normalizedDiscount,
          notes: normalizedNotes,
          lines: normalizedLines,
          payments: normalizedPayments,
          customerId: order.customerId || null,
          customerAddressId: order.customerAddressId || null,
          customerName: order.customerName || '',
          customerPhone: order.customerPhone || '',
          customerAddress: order.customerAddress || '',
          customerAreaId: order.customerAreaId || null,
          createdAt: order.createdAt || now,
          updatedAt: order.updatedAt || now,
          savedAt: order.savedAt || now,
          isPersisted:false,
          dirty:true,
          allowAdditions: order.allowAdditions !== undefined ? !!order.allowAdditions : true,
          lockLineEdits: order.lockLineEdits !== undefined ? !!order.lockLineEdits : false,
          posId: order.posId || order.metadata?.posId || null,
          posLabel: order.posLabel || order.metadata?.posLabel || null,
          posNumber: Number.isFinite(order.posNumber)
            ? Number(order.posNumber)
            : (Number.isFinite(order.metadata?.posNumber) ? Number(order.metadata.posNumber) : null)
        };
        const tempStatusLogs = [];
        const tempLogContext = {
          orderId: payload.id,
          statusId: payload.status,
          stageId: payload.fulfillmentStage,
          paymentStateId: payload.paymentState,
          actorId: order.updatedBy || order.authorId || null,
          updatedAt: payload.updatedAt
        };
        const tempLogSources = [
          order.statusLogs,
          order.status_logs,
          order.statusHistory,
          order.status_history,
          order.events
        ];
        const seenLogs = new Set();
        tempLogSources.forEach(source=>{
          if(!Array.isArray(source)) return;
          source.forEach(entry=>{
            const normalized = normalizeOrderStatusLogEntry(entry, tempLogContext);
            if(normalized && normalized.id && !seenLogs.has(normalized.id)){
              seenLogs.add(normalized.id);
              tempStatusLogs.push(normalized);
            }
          });
        });
        if(!tempStatusLogs.length){
          const fallbackLog = normalizeOrderStatusLogEntry({
            status: payload.status,
            stage: payload.fulfillmentStage,
            paymentState: payload.paymentState,
            changedAt: payload.updatedAt,
            actorId: tempLogContext.actorId
          }, tempLogContext);
          if(fallbackLog) tempStatusLogs.push(fallbackLog);
        }
        tempStatusLogs.sort((a,b)=> (a.changedAt || 0) - (b.changedAt || 0));
        payload.statusLogs = tempStatusLogs;
        return {
          id: payload.id,
          payload,
          createdAt: payload.createdAt,
          updatedAt: payload.updatedAt
        };
      }

      function hydrateTempRecord(record){
        if(!record) return null;
        const payload = record.payload || record.data || null;
        if(!payload) return null;
        return {
          ...payload,
          id: record.id,
          createdAt: payload.createdAt || record.createdAt || Date.now(),
          updatedAt: payload.updatedAt || record.updatedAt || Date.now(),
          savedAt: payload.savedAt || record.updatedAt || Date.now(),
          isPersisted:false,
          dirty:true
        };
      }

      async function saveTempOrder(order){
        hydrateTempStoreFromStorage();
        const record = sanitizeTempOrder(order);
        if(!record) return false;
        storeMaps[TEMP_STORE].set(record.id, record);
        persistTempStoreToStorage();
        return true;
      }

      async function getTempOrder(orderId){
        if(!orderId) return null;
        hydrateTempStoreFromStorage();
        const record = storeMaps[TEMP_STORE].get(orderId);
        if(!record) return null;
        return hydrateTempRecord(cloneRecord(record));
      }

      async function listTempOrders(){
        hydrateTempStoreFromStorage();
        return Array.from(storeMaps[TEMP_STORE].values()).map(rec=> hydrateTempRecord(cloneRecord(rec))).filter(Boolean);
      }

      async function deleteTempOrder(orderId){
        if(!orderId) return false;
        hydrateTempStoreFromStorage();
        const deleted = storeMaps[TEMP_STORE].delete(orderId);
        if(deleted){
          if(storeMaps[TEMP_STORE].size){
            persistTempStoreToStorage();
          } else {
            clearTempStoreFromStorage();
          }
        }
        return deleted;
      }

      async function clearTempOrder(){
        hydrateTempStoreFromStorage();
        storeMaps[TEMP_STORE].clear();
        clearTempStoreFromStorage();
        return true;
      }

      async function listOrders(options={}){
        const onlyActive = options.onlyActive !== false;
        const typeFilter = options.type;
        const stageFilter = options.stage;
        const idFilter = options.ids;
        const orders = [];
        for(const header of storeMaps.orders.values()){
          const status = header.status || 'open';
          if(onlyActive && status === 'closed') continue;
          const typeId = header.type || 'dine_in';
          if(typeFilter){
            if(Array.isArray(typeFilter)){
              if(!typeFilter.includes(typeId)) continue;
            } else if(typeId !== typeFilter) continue;
          }
          const stageId = header.fulfillmentStage || 'new';
          if(stageFilter){
            if(Array.isArray(stageFilter)){
              if(!stageFilter.includes(stageId)) continue;
            } else if(stageId !== stageFilter) continue;
          }
          if(idFilter && !idFilter.includes(header.id)) continue;
          orders.push(hydrateOrder(header));
        }
        orders.sort((a,b)=> (b.updatedAt || 0) - (a.updatedAt || 0));
        return orders;
      }

      async function getOrder(orderId){
        if(!orderId) return null;
        const header = storeMaps.orders.get(orderId);
        if(!header) return null;
        return hydrateOrder(header);
      }

      async function markSync(){
        markSyncLog(Date.now());
        return true;
      }

      async function bootstrap(initialOrders){
        if(!Array.isArray(initialOrders) || !initialOrders.length) return false;
        if(storeMaps.orders.size) return false;
        for(const order of initialOrders){
          try { await saveOrder(order, { mirror:true, origin:'bootstrap' }); } catch(_err){ }
        }
        return true;
      }

      async function exportSnapshot(){
        return {
          stores:{
            orders: Array.from(storeMaps.orders.values()).map(cloneRecord),
            orderLines: Array.from(storeMaps.orderLines.values()).map(cloneRecord),
            orderNotes: Array.from(storeMaps.orderNotes.values()).map(cloneRecord),
            orderStatusLogs: Array.from(storeMaps.orderStatusLogs.values()).map(cloneRecord),
            [SHIFT_STORE]: Array.from(storeMaps[SHIFT_STORE].values()).map(cloneRecord),
            [META_STORE]: Array.from(storeMaps[META_STORE].values()).map(cloneRecord),
            syncLog: Array.from(storeMaps.syncLog.values()).map(cloneRecord)
          },
          meta:{
            exportedAt: Date.now(),
            dbVersion: db.version,
            adapter:'memory'
          }
        };
      }

      async function importSnapshot(snapshot){
        if(!snapshot || typeof snapshot !== 'object') return false;
        const stores = snapshot.stores && typeof snapshot.stores === 'object' ? snapshot.stores : {};
        const previousStores = Object.keys(storeMaps).reduce((acc, name)=>{
          acc[name] = Array.from(storeMaps[name].values()).map(cloneRecord);
          return acc;
        }, {});
        Object.entries(storeMaps).forEach(([name, map])=>{
          if(name === TEMP_STORE) return;
          map.clear();
        });
        const hasStore = (name)=> Object.prototype.hasOwnProperty.call(stores, name);
        const resolveStoreList = (name)=>{
          if(hasStore(name)){
            const value = stores[name];
            return Array.isArray(value) ? value : [];
          }
          if(name === TEMP_STORE){
            return Array.from(storeMaps[TEMP_STORE].values()).map(cloneRecord);
          }
          const fallback = previousStores[name] || [];
          if(fallback.length){
            console.warn('[Mishkah][POS] Remote snapshot missing store — preserving local data.', { store:name, count:fallback.length });
          }
          return fallback;
        };
        const ordersList = resolveStoreList('orders');
        ordersList.forEach(header=>{
          if(!header || !header.id) return;
          const normalized = {
            ...header,
            metadata: header.metadata && typeof header.metadata === 'object'
              ? { ...header.metadata }
              : { version:2, linesCount:0, notesCount:0 }
          };
          storeMaps.orders.set(normalized.id, normalized);
        });
        const lineList = resolveStoreList('orderLines');
        lineList.forEach(line=>{
          if(!line || !line.orderId) return;
          const uid = line.uid || `${line.orderId}::${line.id || Math.random().toString(16).slice(2,8)}`;
          storeMaps.orderLines.set(uid, { ...line, uid });
        });
        const noteList = resolveStoreList('orderNotes');
        noteList.forEach(note=>{
          if(!note || !note.id) return;
          storeMaps.orderNotes.set(note.id, { ...note });
        });
        const eventList = resolveStoreList('orderStatusLogs');
        eventList.forEach(evt=>{
          if(!evt || !evt.id) return;
          storeMaps.orderStatusLogs.set(evt.id, { ...evt });
        });
        if(hasStore(TEMP_STORE)){
          const tempList = resolveStoreList(TEMP_STORE);
          storeMaps[TEMP_STORE].clear();
          tempList.forEach(record=>{
            if(!record || !record.id) return;
            storeMaps[TEMP_STORE].set(record.id, { ...record });
          });
          tempStoreHydrated = true;
          if(tempList.length){
            persistTempStoreToStorage();
          } else {
            clearTempStoreFromStorage();
          }
        } else {
          hydrateTempStoreFromStorage();
        }
        const shiftList = resolveStoreList(SHIFT_STORE);
        shiftList.forEach(shift=>{
          const normalized = normalizeShiftRecord(shift);
          storeMaps[SHIFT_STORE].set(normalized.id, normalized);
        });
        const metaList = resolveStoreList(META_STORE);
        metaList.forEach(meta=>{
          if(!meta || typeof meta !== 'object') return;
          const id = meta.id || meta.posId || 'default';
          const record = { id, invoiceCounter: Number(meta.invoiceCounter || 0) };
          if(Object.prototype.hasOwnProperty.call(meta, 'appliedEventId')){
            record.appliedEventId = meta.appliedEventId;
          }
          if(Object.prototype.hasOwnProperty.call(meta, 'branchSnapshotVersion')){
            record.branchSnapshotVersion = meta.branchSnapshotVersion;
          }
          if(Object.prototype.hasOwnProperty.call(meta, 'syncUpdatedAt')){
            record.syncUpdatedAt = meta.syncUpdatedAt;
          }
          storeMaps[META_STORE].set(id, record);
        });
        const syncList = resolveStoreList('syncLog');
        syncList.forEach(entry=>{
          const ts = toTimestamp(entry.ts);
          storeMaps.syncLog.set(ts, { ts });
        });
        if(!ordersList.length && Array.isArray(snapshot.orders) && snapshot.orders.length){
          for(const order of snapshot.orders){
            try { await saveOrder(order, { mirror:true, origin:'snapshot' }); } catch(_err){ }
          }
        }
        return true;
      }

      function setMirrorMode(value){
        mirrorOnly = !!value;
      }

      return {
        available:true,
        saveOrder,
        saveTempOrder,
        listOrders,
        getOrder,
        getTempOrder,
        listTempOrders,
        deleteTempOrder,
        clearTempOrder,
        markSync,
        bootstrap,
        getActiveShift,
        listShifts,
        openShiftRecord,
        closeShiftRecord,
        nextInvoiceNumber,
        peekInvoiceCounter,
        resetAll,
        exportSnapshot,
        importSnapshot,
        getSyncMetadata,
        updateSyncMetadata,
        setMirrorMode
      };
    }
    function createKDSBridge(url){
      let socket = null;
      return {
        connect(ctx){
          const state = ctx.getState();
          const t = getTexts(state);
          if(socket){
            try { socket.close(); } catch(_){ }
          }
          if(!('WebSocket' in window)){
            UI.pushToast(ctx, { title:t.toast.kdsUnavailable, icon:'⚠️' });
            return;
          }
          ctx.setState(s=>({
            ...s,
            data:{
              ...s.data,
              status:{
                ...s.data.status,
                kds:{ ...(s.data.status?.kds || {}), state:'idle' }
              }
            }
          }));
          try{
            socket = new WebSocket(url);
          } catch(error){
            UI.pushToast(ctx, { title:t.toast.kdsFailed, message:String(error), icon:'🛑' });
            ctx.setState(s=>({
              ...s,
              data:{
                ...s.data,
                status:{ ...s.data.status, kds:{ ...(s.data.status?.kds || {}), state:'offline' } }
              }
            }));
            return;
          }
          socket.onopen = ()=>{
            UI.pushToast(ctx, { title:t.toast.kdsConnected, icon:'✅' });
            ctx.setState(s=>({
              ...s,
              data:{
                ...s.data,
                status:{ ...s.data.status, kds:{ ...(s.data.status?.kds || {}), state:'online' } }
              }
            }));
          };
          socket.onclose = ()=>{
            UI.pushToast(ctx, { title:t.toast.kdsClosed, icon:'ℹ️' });
            ctx.setState(s=>({
              ...s,
              data:{
                ...s.data,
                status:{ ...s.data.status, kds:{ ...(s.data.status?.kds || {}), state:'offline' } }
              }
            }));
          };
          socket.onerror = ()=>{
            UI.pushToast(ctx, { title:t.toast.kdsFailed, icon:'🛑' });
            ctx.setState(s=>({
              ...s,
              data:{
                ...s.data,
                status:{ ...s.data.status, kds:{ ...(s.data.status?.kds || {}), state:'offline' } }
              }
            }));
          };
          socket.onmessage = (event)=>{
            try{
              const payload = JSON.parse(event.data);
              if(payload && payload.type === 'pong'){
                UI.pushToast(ctx, { title:'KDS', message:t.toast.kdsPong, icon:'🍳', ttl:1600 });
              }
            } catch(_){ }
          };
        }
      };
    }

    const ensureList = (U.Data && typeof U.Data.ensureArray === 'function')
      ? U.Data.ensureArray
      : (value)=> Array.isArray(value) ? value : value == null ? [] : [value];

    const coalesce = (U.Data && typeof U.Data.coalesce === 'function')
      ? U.Data.coalesce
      : (...values)=>{
        for(const value of values){
          if(value !== undefined && value !== null && value !== ''){
            return value;
          }
        }
        return null;
      };

    function toIdentifier(...candidates){
      for(const candidate of candidates){
        if(candidate == null) continue;
        const str = String(candidate).trim();
        if(str) return str;
      }
      return '';
    }

    function toLocaleObject(ar, en){
      if(!ar && !en) return null;
      return {
        ar: ar || en || '',
        en: en || ar || ''
      };
    }

    function pickLocalizedText(...candidates){
      for(const candidate of candidates){
        if(candidate == null) continue;
        if(typeof candidate === 'string'){
          const trimmed = candidate.trim();
          if(trimmed) return trimmed;
        } else if(typeof candidate === 'object'){
          if(candidate.ar || candidate.en){
            return {
              ar: candidate.ar || candidate.en || '',
              en: candidate.en || candidate.ar || ''
            };
          }
          if(candidate.name || candidate.label){
            const nested = pickLocalizedText(candidate.name, candidate.label);
            if(nested) return nested;
          }
        }
      }
      return null;
    }

    function localizeValue(value, lang, fallback=''){
      if(value == null) return fallback;
      if(typeof value === 'string') return value;
      if(typeof value === 'object'){
        if(lang === 'ar') return value.ar || value.en || fallback;
        return value.en || value.ar || fallback;
      }
      return fallback;
    }

    function normalizeIso(value){
      if(!value && value !== 0) return new Date().toISOString();
      try {
        const date = typeof value === 'number' ? new Date(value) : new Date(value);
        return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
      } catch(_err){
        return new Date().toISOString();
      }
    }

    function deriveTableLabel(order, state){
      const tableIds = Array.isArray(order.tableIds) ? order.tableIds : [];
      if(!tableIds.length) return null;
      const tables = Array.isArray(state.data?.tables) ? state.data.tables : [];
      const table = tables.find(tbl=> String(tbl.id) === String(tableIds[0]));
      return table ? (table.name || table.label || table.id) : tableIds[0];
    }

    function serializeOrderForKDS(order, state){
      if(!order || !order.id) return null;
      const createdIso = normalizeIso(order.createdAt || order.savedAt || Date.now());
      const updatedIso = normalizeIso(order.updatedAt || order.savedAt || Date.now());
      const serviceMode = order.type || 'dine_in';
      const tableLabel = deriveTableLabel(order, state);
      const customerName = order.customerName || order.customer?.name || '';
      const linesRaw = Array.isArray(order.lines) ? order.lines : [];
      const lines = linesRaw.filter(Boolean);
      if(!lines.length) return null;
      const kitchenSections = Array.isArray(state.data?.kitchenSections) ? state.data.kitchenSections : [];
      const sectionMap = new Map(kitchenSections.map(section=> [section.id, section]));
      const jobsMap = new Map();
      const jobDetails = [];
      const jobModifiers = [];
      const historyEntries = [];
      lines.forEach((line, index)=>{
        const lineIndex = index + 1;
        const resolvedStation = toIdentifier(line.kitchenSection);
        const stationId = resolvedStation || 'expo';
        const jobId = `${order.id}-${stationId}`;
        const section = sectionMap.get(stationId) || {};
        const stationCode = section.code || (stationId ? String(stationId).toUpperCase() : 'KDS');
        const existing = jobsMap.get(jobId) || {
          id: jobId,
          orderId: order.id,
          orderNumber: order.orderNumber || order.invoiceId || order.id,
          posRevision: `${order.id}@${order.updatedAt || Date.now()}`,
          orderTypeId: serviceMode,
          serviceMode,
          stationId,
          stationCode,
          status:'queued',
          progressState:'awaiting',
          totalItems:0,
          completedItems:0,
          readyItems:0,
          inProgressItems:0,
          queuedItems:0,
          remainingItems:0,
          hasAlerts:false,
          isExpedite:false,
          tableLabel: tableLabel || null,
          customerName: customerName || null,
          dueAt: order.dueAt ? normalizeIso(order.dueAt) : null,
          acceptedAt:null,
          startedAt:null,
          readyAt:null,
          completedAt:null,
          expoAt:null,
          lastStatusChangedAt:null,
          lastReadyAt:null,
          lastCompletedAt:null,
          syncChecksum:`${order.id}-${stationId}`,
          notes: notesToText(line.notes, '; '),
          meta:{ orderSource:'pos', kdsTab: stationId },
          createdAt: createdIso,
          updatedAt: updatedIso
        };
        const quantityValue = coalesce(line.qty, line.quantity, line.count, 1);
        let quantity = Number(quantityValue);
        if(!Number.isFinite(quantity) || quantity <= 0){
          quantity = 1;
        }
        existing.totalItems += quantity;
        jobsMap.set(jobId, existing);
        const baseLineId = toIdentifier(line.id, line.uid, line.storageId, `${order.id}-line-${lineIndex}`) || `${order.id}-line-${lineIndex}`;
        const detailId = `${jobId}-detail-${baseLineId}`;
        const itemIdentifier = toIdentifier(line.itemId, line.productId, line.menuItemId, line.sku, baseLineId) || baseLineId;
        const displayIdentifier = itemIdentifier && itemIdentifier !== baseLineId ? itemIdentifier : '';
        const nameSource = pickLocalizedText(
          line.name,
          line.displayName,
          line.label,
          toLocaleObject(line.nameAr, line.nameEn),
          toLocaleObject(line.itemNameAr, line.itemNameEn),
          line.productName,
          line.product?.name,
          line.product?.title,
          line.menuItem?.name,
          line.menuItem?.title,
          line.menuItem?.displayName
        ) || (displayIdentifier ? displayIdentifier : null);
        const fallbackNameAr = displayIdentifier || `عنصر ${lineIndex}`;
        const fallbackNameEn = displayIdentifier || `Item ${lineIndex}`;
        const detail = {
          id: detailId,
          jobOrderId: jobId,
          itemId: itemIdentifier,
          itemCode: itemIdentifier,
          quantity,
          status:'queued',
          startAt:null,
          finishAt:null,
          createdAt: createdIso,
          updatedAt: updatedIso,
          itemNameAr: localizeValue(nameSource, 'ar', fallbackNameAr),
          itemNameEn: localizeValue(nameSource, 'en', fallbackNameEn),
          prepNotes: notesToText(line.notes, '; ')
        };
        jobDetails.push(detail);
        const modifiers = ensureList(line.modifiers).filter(Boolean);
        modifiers.forEach((mod, idx)=>{
          const modIndex = idx + 1;
          const baseModId = toIdentifier(mod.id, mod.uid, `${detailId}-mod-${modIndex}`);
          const modId = baseModId || `${detailId}-mod-${modIndex}`;
          const modDisplayId = baseModId && baseModId !== `${detailId}-mod-${modIndex}` ? baseModId : '';
          const modNameSource = pickLocalizedText(
            mod.name,
            mod.label,
            toLocaleObject(mod.nameAr, mod.nameEn),
            toLocaleObject(mod.labelAr, mod.labelEn),
            mod.productName,
            mod.product?.name,
            mod.item?.name
          ) || (modDisplayId ? modDisplayId : null);
          const modFallbackAr = `إضافة ${modIndex}`;
          const modFallbackEn = `Modifier ${modIndex}`;
          const priceCandidate = coalesce(mod.priceChange, mod.amount, mod.price, 0);
          let priceChange = Number(priceCandidate);
          if(!Number.isFinite(priceChange)) priceChange = 0;
          const modifierType = mod.modifierType || mod.type || (priceChange < 0 ? 'remove' : 'add');
          jobModifiers.push({
            id: modId,
            jobOrderId: jobId,
            detailId,
            nameAr: localizeValue(modNameSource, 'ar', modFallbackAr),
            nameEn: localizeValue(modNameSource, 'en', modFallbackEn),
            modifierType,
            priceChange
          });
        });
        const lineLogsRaw = Array.isArray(line.statusLogs) ? line.statusLogs.slice() : [];
        if(!lineLogsRaw.length){
          lineLogsRaw.push({
            id: `${detailId}::log::${detail.createdAt}`,
            status: line.status || 'queued',
            changedAt: line.updatedAt || updatedIso,
            actorId: order.updatedBy || 'pos',
            source: 'pos'
          });
        }
        lineLogsRaw.sort((a,b)=> (a.changedAt || 0) - (b.changedAt || 0));
        const resolvedLineStatus = lineLogsRaw[lineLogsRaw.length - 1]?.status || line.status || 'queued';
        detail.status = resolvedLineStatus;
        detail.updatedAt = normalizeIso(lineLogsRaw[lineLogsRaw.length - 1]?.changedAt || detail.updatedAt);
        lineLogsRaw.forEach((log, logIndex)=>{
          const changedIso = normalizeIso(log.changedAt || detail.updatedAt);
          if(['preparing','in_progress','cooking'].includes(log.status || '')){
            if(!existing.startedAt) existing.startedAt = changedIso;
            if(!detail.startAt) detail.startAt = changedIso;
            existing.progressState = 'cooking';
          }
          if(['ready'].includes(log.status || '')){
            if(!existing.readyAt) existing.readyAt = changedIso;
            if(!detail.finishAt) detail.finishAt = changedIso;
            existing.lastReadyAt = changedIso;
          }
          if(['served','completed'].includes(log.status || '')){
            if(!existing.completedAt) existing.completedAt = changedIso;
            if(!detail.finishAt) detail.finishAt = changedIso;
            existing.lastCompletedAt = changedIso;
          }
          existing.lastStatusChangedAt = changedIso;
          existing.updatedAt = changedIso;
          historyEntries.push({
            id:`HIS-${detailId}-${logIndex}`,
            jobOrderId: jobId,
            status: log.status || resolvedLineStatus,
            actorId: log.actorId || 'pos',
            actorName: log.actorId || 'POS',
            actorRole: log.source || 'pos',
            changedAt: changedIso,
            meta:{ source: log.source || 'pos', lineId: line.id || baseLineId }
          });
        });
        if(['served','completed'].includes(resolvedLineStatus)){
          existing.completedItems += quantity;
        } else if(['ready'].includes(resolvedLineStatus)){
          existing.readyItems += quantity;
        } else if(['preparing','in_progress','cooking'].includes(resolvedLineStatus)){
          existing.inProgressItems += quantity;
        } else {
          existing.queuedItems += quantity;
        }
      });
      jobsMap.forEach(job=>{
        const total = job.totalItems || 0;
        const completed = job.completedItems || 0;
        const ready = job.readyItems || 0;
        const inProgress = job.inProgressItems || 0;
        const queued = job.queuedItems || 0;
        job.remainingItems = Math.max(0, total - completed);
        if(job.lastStatusChangedAt){
          job.updatedAt = normalizeIso(job.lastStatusChangedAt);
        }
        if(total <= 0) return;
        if(completed >= total){
          job.status = 'completed';
          job.progressState = 'completed';
          if(job.lastCompletedAt) job.completedAt = job.completedAt || normalizeIso(job.lastCompletedAt);
        } else if((ready + completed) >= total){
          job.status = 'ready';
          job.progressState = 'ready';
          if(job.lastReadyAt) job.readyAt = job.readyAt || normalizeIso(job.lastReadyAt);
        } else if(inProgress > 0){
          job.status = 'in_progress';
          job.progressState = 'cooking';
        } else if(queued > 0){
          job.status = 'queued';
          job.progressState = 'awaiting';
        }
      });
      const headers = Array.from(jobsMap.values());
      if(!headers.length) return null;
      const jobOrders = {
        headers,
        details: jobDetails,
        modifiers: jobModifiers,
        statusHistory: historyEntries
      };
      const orderSummary = {
        orderId: order.id,
        orderNumber: order.orderNumber || order.invoiceId || order.id,
        serviceMode,
        tableLabel: tableLabel || null,
        customerName: customerName || null,
        createdAt: createdIso
      };
      const kdsState = state?.data?.kds || {};
      const masterSnapshot = {
        channel: kdsState.channel || BRANCH_CHANNEL,
        stations: Array.isArray(kdsState.stations) ? kdsState.stations.map(station=> ({ ...station })) : [],
        stationCategoryRoutes: Array.isArray(kdsState.stationCategoryRoutes)
          ? kdsState.stationCategoryRoutes.map(route=> ({ ...route }))
          : [],
        metadata:{ ...(kdsState.metadata || {}) },
        sync:{ ...(kdsState.sync || {}), channel: kdsState.channel || BRANCH_CHANNEL },
        drivers: Array.isArray(kdsState.drivers) ? kdsState.drivers.map(driver=> ({ ...driver })) : [],
        kitchenSections: Array.isArray(state?.data?.kitchenSections)
          ? state.data.kitchenSections.map(section=> ({ ...section }))
          : [],
        categorySections: Array.isArray(state?.data?.categorySections)
          ? state.data.categorySections.map(entry=> ({ ...entry }))
          : [],
        categories: Array.isArray(state?.data?.menu?.categories)
          ? state.data.menu.categories.map(category=> ({ ...category }))
          : [],
        items: Array.isArray(state?.data?.menu?.items)
          ? state.data.menu.items.map(item=> ({ ...item }))
          : []
      };
      const deliveriesSnapshot = {
        assignments:{ ...(kdsState.deliveries?.assignments || {}) },
        settlements:{ ...(kdsState.deliveries?.settlements || {}) }
      };
      const handoffSnapshot = { ...(kdsState.handoff || {}) };
      return {
        order: orderSummary,
        jobOrders,
        master: masterSnapshot,
        deliveries: deliveriesSnapshot,
        handoff: handoffSnapshot,
        drivers: masterSnapshot.drivers,
        meta:{ channel: masterSnapshot.channel, branch: BRANCH_CHANNEL, posId: POS_INFO.id, emittedAt: new Date().toISOString() }
      };
    }

    const buildOrderEnvelope = (orderPayload, state)=>{
      const payload = serializeOrderForKDS(orderPayload, state);
      if(!payload) return null;
      const nowIso = new Date().toISOString();
      const baseHandoff = (payload.handoff && typeof payload.handoff === 'object') ? { ...payload.handoff } : {};
      if(orderPayload && orderPayload.id){
        baseHandoff[orderPayload.id] = {
          ...(baseHandoff[orderPayload.id] || {}),
          status:'pending',
          updatedAt: nowIso
        };
      }
      payload.handoff = baseHandoff;
      payload.meta = { ...(payload.meta || {}), publishedAt: nowIso };
      const channel = payload.meta?.channel || BRANCH_CHANNEL;
      return { payload, channel, publishedAt: nowIso };
    };


    posModuleScope.BRANCH_CHANNEL = BRANCH_CHANNEL;
    if(globalThis.MishkahPOSChunks?.ws){
      globalThis.MishkahPOSChunks.ws(posModuleScope);
    }
    const posWs = posModuleScope.ws || {};
    const { createKDSSync, createCentralPosSync, createEventReplicator, applyWs2EventToPos } = posWs;
    const kdsSettings = ensurePlainObject(settings.kds);
    const kdsSyncSettings = ensurePlainObject(kdsSettings.sync);
    const rawKdsEndpointSetting = normalizeEndpointString(firstDefined(
      syncSettings.ws_endpoint,
      syncSettings.wsEndpoint,
      syncSettings.kds_ws_endpoint,
      syncSettings.kdsWsEndpoint
    ));
    const kdsEndpointSetting = disableRealtimeInStaticDemo ? null : rawKdsEndpointSetting;
    const DEFAULT_KDS_ENDPOINT = kdsEndpointSetting || (disableRealtimeInStaticDemo ? null : 'wss://ws.mas.com.eg/ws');
    const mockEndpoint = normalizeEndpointString(firstDefined(
      MOCK_BASE?.kds?.endpoint,
      MOCK_BASE?.kds?.wsEndpoint
    ));
    const kdsEndpoint = disableRealtimeInStaticDemo ? (mockEndpoint || null) : (mockEndpoint || DEFAULT_KDS_ENDPOINT);
    const resolveStoredKdsToken = ()=>{
      if(typeof window === 'undefined') return null;
      const candidates = [];
      try {
        if(window.localStorage){
          candidates.push(window.localStorage.getItem('mishkah:kds:token'));
          candidates.push(window.localStorage.getItem('pos.kds.token'));
        }
      } catch(_err){}
      try {
        if(window.sessionStorage){
          candidates.push(window.sessionStorage.getItem('mishkah:kds:token'));
          candidates.push(window.sessionStorage.getItem('pos.kds.token'));
        }
      } catch(_err){}
      for(let i = 0; i < candidates.length; i += 1){
        const value = candidates[i];
        if(typeof value === 'string' && value.trim()) return value.trim();
      }
      return null;
    };
    const kdsTokenSource = firstDefined(
      kdsSyncSettings.token,
      kdsSyncSettings.ws_token,
      kdsSyncSettings.wsToken,
      kdsSyncSettings.auth_token,
      kdsSyncSettings.authToken,
      kdsSettings.token,
      kdsSettings.auth_token,
      kdsSettings.authToken,
      syncSettings.kds_token,
      syncSettings.kdsToken,
      syncSettings.kds_auth_token,
      syncSettings.kdsAuthToken,
      syncSettings.kds_ws_token,
      syncSettings.kdsWsToken,
      syncSettings.ws_token,
      syncSettings.wsToken,
      MOCK_BASE?.kds?.sync?.token,
      MOCK_BASE?.kds?.sync?.authToken,
      MOCK_BASE?.kds?.sync?.auth_token,
      MOCK_BASE?.kds?.token,
      MOCK_BASE?.kds?.authToken,
      MOCK_BASE?.kds?.auth_token,
      resolveStoredKdsToken()
    );
    const kdsToken = typeof kdsTokenSource === 'string' && kdsTokenSource.trim() ? kdsTokenSource.trim() : null;
    const mockSyncHttpBase = normalizeEndpointString(firstDefined(
      MOCK_BASE?.sync?.httpEndpoint,
      MOCK_BASE?.sync?.http_endpoint
    ));
    const configuredSyncHttpBase = normalizeEndpointString(firstDefined(
      syncSettings.http_endpoint,
      syncSettings.httpEndpoint
    ));
    let posSyncHttpBase = BRANCH_EVENTS_ROUTE || mockSyncHttpBase;
    if(disableRealtimeInStaticDemo && posSyncHttpBase && isSameOriginEndpoint(posSyncHttpBase)){
      posSyncHttpBase = null;
    }
    if(!posSyncHttpBase){
      const fallbackHttp = BRANCH_EVENTS_ROUTE || configuredSyncHttpBase || null;
      posSyncHttpBase = disableRealtimeInStaticDemo ? null : fallbackHttp;
    }
    if(!posSyncHttpBase && !disableRealtimeInStaticDemo){
      posSyncHttpBase = BRANCH_EVENTS_ROUTE || '/api/pos-sync';
    }
    const mockSyncWsEndpoint = normalizeEndpointString(firstDefined(
      MOCK_BASE?.sync?.wsEndpoint,
      MOCK_BASE?.sync?.ws_endpoint
    ));
    const configuredSyncWsEndpoint = normalizeEndpointString(firstDefined(
      syncSettings.pos_ws_endpoint,
      syncSettings.posWsEndpoint,
      syncSettings.ws_endpoint,
      syncSettings.wsEndpoint
    ));
    let posSyncWsEndpoint = disableRealtimeInStaticDemo
      ? (mockSyncWsEndpoint && !isSameOriginEndpoint(mockSyncWsEndpoint) ? mockSyncWsEndpoint : null)
      : (mockSyncWsEndpoint || configuredSyncWsEndpoint || kdsEndpoint);
    const posSyncToken = (MOCK_BASE?.sync?.token)
      || syncSettings.pos_token
      || syncSettings.posToken
      || syncSettings.token
      || null;
    const posAuthRuntime = (typeof window !== 'undefined' && window.MishkahPosSyncAuth)
      ? window.MishkahPosSyncAuth
      : {};
    const posSyncAuthOffSource = firstDefined(
      posAuthRuntime.authOff,
      posAuthRuntime.auth_off,
      posAuthRuntime.authoff,
      posAuthRuntime.authBypass,
      posAuthRuntime.auth_bypass,
      syncSettings.auth_off,
      syncSettings.authOff,
      syncSettings.authoff,
      syncSettings.auth_bypass,
      syncSettings.authBypass,
      syncSettings.disable_auth,
      syncSettings.disableAuth
    );
    const posSyncAuthOff = ensureBoolean(posSyncAuthOffSource, false);
    if(posSyncAuthOff){
      console.warn('[Mishkah][POS] Central sync auth bypass enabled via frontend settings.', {
        source: posAuthRuntime.authOffSource || (posSyncAuthOffSource != null ? 'settings.sync.*' : 'default')
      });
    }
    const centralSyncMeta = ensurePlainObject(MOCK_BASE?.meta?.centralSync);
    const centralSyncDisabled = ensureBoolean(centralSyncMeta.disabled, false);
    if(centralSyncDisabled){
      console.warn('[Mishkah][POS] Central sync disabled via dataset meta.', {
        reason: centralSyncMeta.reason || null,
        mode: centralSyncMeta.mode || 'ws2-only'
      });
      posSyncHttpBase = null;
      posSyncWsEndpoint = null;
    }
    const centralOnlyOverrideSource = firstDefined(
      MOCK_BASE?.sync?.central_only,
      MOCK_BASE?.sync?.centralOnly,
      MOCK_BASE?.sync?.disable_indexeddb,
      MOCK_BASE?.sync?.disableIndexeddb,
      MOCK_BASE?.sync?.disableIndexedDb,
      syncSettings.central_only,
      syncSettings.centralOnly,
      syncSettings.disable_indexeddb,
      syncSettings.disableIndexeddb,
      syncSettings.disableIndexedDb
    );
    const allowFallbackOverrideSource = firstDefined(
      MOCK_BASE?.sync?.allow_indexeddb_fallback,
      MOCK_BASE?.sync?.allowIndexeddbFallback,
      MOCK_BASE?.sync?.allowIndexedDbFallback,
      syncSettings.allow_indexeddb_fallback,
      syncSettings.allowIndexeddbFallback,
      syncSettings.allowIndexedDbFallback
    );
    let enforceCentralOnly = ensureBoolean(centralOnlyOverrideSource, !isStaticDemoEnvironment);
    let allowIndexedDbFallback = ensureBoolean(allowFallbackOverrideSource, isStaticDemoEnvironment);
    if(centralSyncDisabled){
      enforceCentralOnly = false;
      allowIndexedDbFallback = true;
    }
    const initialCentralMode = centralSyncMeta.mode || (enforceCentralOnly ? (allowIndexedDbFallback ? 'hybrid' : 'central-only') : 'permissive');
    let centralSyncStatus = {
      state: posSyncWsEndpoint ? 'offline' : 'disabled',
      version: 0,
      lastSync: null,
      endpoint: posSyncWsEndpoint || null,
      mode: initialCentralMode,
      requireOnline: enforceCentralOnly,
      allowLocalFallback: allowIndexedDbFallback
    };
    let centralStatusHandler = null;
    const handleCentralStatus = (nextStatus={})=>{
      centralSyncStatus = { ...centralSyncStatus, ...nextStatus };
      if(typeof centralStatusHandler === 'function'){
        try { centralStatusHandler({ ...centralSyncStatus }); } catch(handlerError){ console.warn('[Mishkah][POS] Failed to propagate central sync status', handlerError); }
      }
    };

    const posDB = createIndexedDBAdapter('mishkah-pos', 4);
    if(posDB && typeof posDB === 'object'){
      if(typeof posDB.setMirrorMode === 'function') posDB.setMirrorMode(true);
      posDB.centralMode = enforceCentralOnly ? (allowIndexedDbFallback ? 'hybrid' : 'central-only') : 'permissive';
      posDB.allowLocalFallback = allowIndexedDbFallback;
      posDB.mirrorMode = 'mirror-only';
    }

    if(posDB && typeof posDB.saveOrder === 'function'){
      try{
        const existingOrders = await posDB.listOrders({ onlyActive:false });
        const bootstrap = typeof window !== 'undefined' ? window.__WS2_SERVER_BOOTSTRAP__ : null;
        const bootstrapOrders = bootstrap && Array.isArray(bootstrap.snapshot?.orders) ? bootstrap.snapshot.orders : [];
        if(!existingOrders.length && bootstrapOrders.length){
          for(const order of bootstrapOrders){
            const normalized = {
              ...cloneDeep(order),
              isPersisted:true,
              dirty:false,
              updatedAt: order.updatedAt || Date.now(),
              savedAt: order.savedAt || Date.now()
            };
            await posDB.saveOrder(normalized, { mirror:true, origin:'bootstrap' });
          }
          if(typeof posDB.markSync === 'function') await posDB.markSync();
          await refreshPersistentSnapshot({ focusCurrent:false, syncOrders:true }).catch((err)=>{
            console.warn('[Mishkah][POS] Failed to refresh snapshot after bootstrap orders', err);
          });
        }
      } catch(seedError){
        console.warn('[Mishkah][POS] Failed to seed orders from server snapshot.', seedError);
      }
    }

    const runtimeIdentifiers = (typeof window !== 'undefined' && window.POS_WS2_IDENTIFIERS)
      ? window.POS_WS2_IDENTIFIERS
      : {};
    const centralSyncStub = {
      async ensureInitialSync(){ return false; },
      connect(){},
      async run(_label, _meta, executor){ return typeof executor === 'function' ? executor() : null; },
      async destroy(){ return undefined; },
      isOnline(){ return false; },
      getStatus(){ return { state:'disabled', mode:'ws2-only' }; }
    };

    const centralSync = centralSyncDisabled
      ? centralSyncStub
      : createCentralPosSync({
          adapter: posDB,
          branch: BRANCH_CHANNEL,
          wsEndpoint: posSyncWsEndpoint,
          httpEndpoint: posSyncHttpBase,
          token: posSyncToken,
          authOff: posSyncAuthOff,
          requireOnline: enforceCentralOnly,
          allowLocalFallback: allowIndexedDbFallback,
          posId: POS_INFO.id,
          userId: runtimeIdentifiers.userId || (typeof window !== 'undefined' && window.UserUniid) || null,
          onStatus: handleCentralStatus,
          onDiagnostic: pushCentralDiagnostic
        });

    if(!centralSyncDisabled){
      centralSync.connect();
      centralSync.ensureInitialSync().catch(err=>{
        console.warn('[Mishkah][POS] Central sync bootstrap failed.', err);
      });
    } else {
      handleCentralStatus({
        state:'disabled',
        endpoint:null,
        mode:'ws2-only',
        lastError: centralSyncMeta.reason || 'Central sync disabled via dataset meta.'
      });
    }

    const ws2EventsEndpoint = normalizeEndpointString(firstDefined(
      syncSettings.events_endpoint,
      syncSettings.eventsEndpoint,
      syncSettings.ws2_events_endpoint,
      syncSettings.ws2EventsEndpoint,
      BRANCH_EVENTS_ROUTE
    ));
    const ws2PollInterval = Number(syncSettings.events_poll_interval
      ?? syncSettings.eventsPollInterval
      ?? syncSettings.ws2_poll_interval
      ?? syncSettings.ws2PollInterval
      ?? 0);
    const ws2EventReplicator = createEventReplicator({
      adapter: posDB,
      branch: BRANCH_CHANNEL,
      endpoint: ws2EventsEndpoint,
      interval: Math.max(12000, Number.isFinite(ws2PollInterval) ? ws2PollInterval : 0),
      applyEvent: (event)=> applyWs2EventToPos(event, posDB),
      onBatchApplied: async (result={})=>{
        if(!result || !result.appliedCount) return;
        try { await posDB.markSync(); } catch(_err){}
        try {
          await refreshPersistentSnapshot({ focusCurrent:false, syncOrders:true });
        } catch(error){
          console.warn('[Mishkah][POS] WS2 event replicator refresh failed.', error);
        }
      },
      onError: (error)=>{
        console.warn('[Mishkah][POS] WS2 event replicator error.', error);
      }
    });
    ws2EventReplicator.start();

    const wrapDbMutation = (methodName, metaResolver)=>{
      const original = posDB && typeof posDB[methodName] === 'function' ? posDB[methodName].bind(posDB) : null;
      if(!original) return;
      posDB[methodName] = async function wrappedMutation(...args){
        if(!centralSync || typeof centralSync.run !== 'function'){
          return original(...args);
        }
        const resolved = typeof metaResolver === 'function' ? metaResolver(...args) || {} : {};
        const reason = resolved.reason || methodName;
        const meta = resolved.meta || {};
        return centralSync.run(reason, meta, ()=> original(...args));
      };
    };

    wrapDbMutation('openShiftRecord', (record)=>({ reason:'shift:open', meta:{ shiftId: record?.id || null } }));
    wrapDbMutation('closeShiftRecord', (id)=>({ reason:'shift:close', meta:{ shiftId: id || null } }));
    wrapDbMutation('nextInvoiceNumber', (posId)=>({ reason:'invoice:next', meta:{ posId: posId || POS_INFO.id } }));

    if(posDB && typeof posDB.resetAll === 'function'){
      const originalResetAll = posDB.resetAll.bind(posDB);
      posDB.resetAll = async function resetAllWithCentral(...args){
        if(centralSync && typeof centralSync.destroy === 'function'){
          try {
            await centralSync.ensureInitialSync();
            await centralSync.destroy('reset');
          } catch(err){
            console.warn('[Mishkah][POS] Central reset broadcast failed.', err);
            throw err;
          }
        }
        return originalResetAll(...args);
      };
    }

    const pendingKdsMessages = [];

    const mergeJobOrderCollections = (current={}, patch={})=>{
      const mergeList = (base=[], updates=[], key='id')=>{
        const map = new Map();
        (Array.isArray(base) ? base : []).forEach(item=>{
          if(!item || item[key] == null) return;
          map.set(String(item[key]), { ...item });
        });
        (Array.isArray(updates) ? updates : []).forEach(item=>{
          if(!item || item[key] == null) return;
          const id = String(item[key]);
          map.set(id, Object.assign({}, map.get(id) || {}, item));
        });
        return Array.from(map.values());
      };
      return {
        headers: mergeList(current.headers, patch.headers),
        details: mergeList(current.details, patch.details),
        modifiers: mergeList(current.modifiers, patch.modifiers),
        statusHistory: mergeList(current.statusHistory, patch.statusHistory)
      };
    };

    function mergeHandoffRecord(base, patch){
      const source = base && typeof base === 'object' ? base : {};
      const target = { ...source };
      let changed = false;
      Object.keys(patch || {}).forEach(key=>{
        const value = patch[key];
        if(target[key] !== value){
          target[key] = value;
          changed = true;
        }
      });
      return { next: target, changed };
    }

    function applyKdsOrderSnapshotNow(payload={}, meta={}){
      if(!payload || !payload.jobOrders) return;
      const normalizedOrders = normalizeJobOrdersSnapshot(payload.jobOrders);
      const deliveriesPatch = payload.deliveries || {};
      const handoffPatch = payload.handoff || {};
      const driversPatch = Array.isArray(payload.drivers) ? payload.drivers : [];
      const master = payload.master || {};
      const updateState = (state)=>{
        const data = state.data || {};
        const currentKds = data.kds || {};
        const mergedOrders = mergeJobOrderCollections(currentKds.jobOrders || {}, normalizedOrders);
        const assignmentsBase = currentKds.deliveries?.assignments || {};
        const settlementsBase = currentKds.deliveries?.settlements || {};
        const assignments = { ...assignmentsBase };
        Object.keys(deliveriesPatch.assignments || {}).forEach(orderId=>{
          assignments[orderId] = { ...(assignments[orderId] || {}), ...deliveriesPatch.assignments[orderId] };
        });
        const settlements = { ...settlementsBase };
        Object.keys(deliveriesPatch.settlements || {}).forEach(orderId=>{
          settlements[orderId] = { ...(settlements[orderId] || {}), ...deliveriesPatch.settlements[orderId] };
        });
        const mergedDrivers = mergeDriversLists(currentKds.drivers || [], driversPatch);
        const nextKds = {
          ...currentKds,
          jobOrders: mergedOrders,
          deliveries:{ assignments, settlements },
          handoff:{ ...(currentKds.handoff || {}), ...handoffPatch },
          drivers: mergedDrivers,
          metadata:{ ...(currentKds.metadata || {}), ...(payload.metadata || {}) },
          sync:{ ...(currentKds.sync || {}), ...(payload.sync || {}) },
          lastSyncMeta:{ ...(currentKds.lastSyncMeta || {}), ...meta }
        };
        if(master.channel){
          nextKds.channel = master.channel;
          nextKds.sync = { ...(nextKds.sync || {}), channel: master.channel };
        }
        if(master.stations){
          nextKds.stations = master.stations.map(station=> ({ ...station }));
        }
        if(master.stationCategoryRoutes){
          nextKds.stationCategoryRoutes = master.stationCategoryRoutes.map(route=> ({ ...route }));
        }
        if(master.metadata){
          nextKds.metadata = { ...(nextKds.metadata || {}), ...master.metadata };
        }
        if(master.sync){
          nextKds.sync = { ...(nextKds.sync || {}), ...master.sync };
          if(master.sync.channel){
            nextKds.channel = master.sync.channel;
          }
        }
        if(master.drivers){
          nextKds.drivers = mergeDriversLists(nextKds.drivers || [], master.drivers);
        }
        const nextData = { ...data, kds: nextKds };
        if(master.kitchenSections){
          nextData.kitchenSections = master.kitchenSections.map(section=> ({ ...section }));
        }
        if(master.categorySections){
          nextData.categorySections = master.categorySections.map(entry=> ({ ...entry }));
        }
        if(master.categories || master.items){
          const menuState = nextData.menu || data.menu || {};
          nextData.menu = {
            ...menuState,
            categories: master.categories ? master.categories.map(cat=> ({ ...cat })) : menuState.categories,
            items: master.items ? master.items.map(item=> ({ ...item })) : menuState.items
          };
        }
        return { ...state, data: nextData };
      };
      if(appRef && typeof appRef.setState === 'function'){
        appRef.setState(updateState);
      } else {
        enqueueKdsMessage({ type:'orders', payload, meta });
      }
    }

    function applyKdsJobUpdateNow(jobId, payload={}, meta={}){
      const normalizedId = jobId != null ? String(jobId) : '';
      if(!normalizedId) return;
      const patch = {
        headers:[{ id: normalizedId, ...payload }]
      };
      if(Array.isArray(payload.details)) patch.details = payload.details;
      if(Array.isArray(payload.modifiers)) patch.modifiers = payload.modifiers;
      if(Array.isArray(payload.statusHistory)) patch.statusHistory = payload.statusHistory;
      const updater = (state)=>{
        const data = state.data || {};
        const currentKds = data.kds || {};
        const merged = mergeJobOrderCollections(currentKds.jobOrders || {}, patch);
        return {
          ...state,
          data:{
            ...data,
            kds:{
              ...currentKds,
              jobOrders: merged,
              lastSyncMeta:{ ...(currentKds.lastSyncMeta || {}), ...meta }
            }
          }
        };
      };
      if(appRef && typeof appRef.setState === 'function'){
        appRef.setState(updater);
      } else {
        enqueueKdsMessage({ type:'job', jobId: normalizedId, payload, meta });
      }
    }

    function applyKdsDeliveryUpdateNow(orderId, payload={}, meta={}){
      const normalizedId = orderId != null ? String(orderId) : '';
      if(!normalizedId) return;
      const updater = (state)=>{
        const data = state.data || {};
        const currentKds = data.kds || {};
        const deliveries = currentKds.deliveries || { assignments:{}, settlements:{} };
        const assignments = { ...(deliveries.assignments || {}) };
        const settlements = { ...(deliveries.settlements || {}) };
        if(payload.assignment){
          assignments[normalizedId] = { ...(assignments[normalizedId] || {}), ...payload.assignment };
        }
        if(payload.settlement){
          settlements[normalizedId] = { ...(settlements[normalizedId] || {}), ...payload.settlement };
        }
        return {
          ...state,
          data:{
            ...data,
            kds:{
              ...currentKds,
              deliveries:{ assignments, settlements },
              lastSyncMeta:{ ...(currentKds.lastSyncMeta || {}), ...meta }
            }
          }
        };
      };
      if(appRef && typeof appRef.setState === 'function'){
        appRef.setState(updater);
      } else {
        enqueueKdsMessage({ type:'delivery', orderId: normalizedId, payload, meta });
      }
    }

    function applyHandoffUpdateNow(orderId, payload={}, meta={}){
      const normalizedId = orderId != null ? String(orderId) : '';
      if(!normalizedId){
        return;
      }
      const patch = { ...(payload || {}) };
      if(!patch.updatedAt && meta && meta.ts){
        patch.updatedAt = meta.ts;
      }
      const updateEntry = (entry)=>{
        if(!entry || String(entry.id) !== normalizedId){
          return { value: entry, changed:false };
        }
        const { next: merged, changed: handoffChanged } = mergeHandoffRecord(entry.handoff, patch);
        const statusCandidate = patch.status !== undefined
          ? patch.status
          : (merged.status !== undefined ? merged.status : entry.handoffStatus);
        const updatedAtChanged = patch.updatedAt && patch.updatedAt !== entry.updatedAt;
        let needsUpdate = handoffChanged || updatedAtChanged;
        if(statusCandidate !== undefined && statusCandidate !== entry.handoffStatus){
          needsUpdate = true;
        }
        if(!needsUpdate){
          return { value: entry, changed:false };
        }
        const nextEntry = {
          ...entry,
          handoff: merged
        };
        if(statusCandidate !== undefined){
          nextEntry.handoffStatus = statusCandidate;
        }
        if(patch.updatedAt){
          nextEntry.updatedAt = patch.updatedAt;
        }
        if(statusCandidate === 'served'){
          if(nextEntry.status !== 'finalized') nextEntry.status = 'finalized';
          nextEntry.fulfillmentStage = 'delivered';
          const finishAt = patch.servedAt || patch.updatedAt;
          if(finishAt){
            nextEntry.finishedAt = finishAt;
          }
        } else if(statusCandidate === 'assembled' && nextEntry.fulfillmentStage !== 'delivered' && nextEntry.fulfillmentStage !== 'ready'){
          nextEntry.fulfillmentStage = 'ready';
        }
        return { value: nextEntry, changed:true };
      };
      if(appRef && typeof appRef.setState === 'function'){
        appRef.setState((state)=>{
          const data = state.data || {};
          const reconcileList = (list)=>{
            if(!Array.isArray(list) || !list.length){
              return { value:list, changed:false };
            }
            let changed = false;
            let hasCandidate = false;
            const nextList = list.map(item=>{
              if(item && String(item.id) === normalizedId){
                hasCandidate = true;
                const result = updateEntry(item);
                if(result.changed) changed = true;
                return result.value;
              }
              return item;
            });
            if(!hasCandidate || !changed){
              return { value:list, changed:false };
            }
            return { value: nextList, changed:true };
          };
          const { value: queueNext, changed: queueChanged } = reconcileList(data.ordersQueue);
          const { value: historyNext, changed: historyChanged } = reconcileList(data.ordersHistory);
          const currentOrder = data.order && String(data.order.id) === normalizedId
            ? updateEntry(data.order)
            : { value:data.order, changed:false };
          const currentKds = data.kds || {};
          const currentHandoffEntry = currentKds.handoff?.[normalizedId];
          const { next: kdsHandoffEntry, changed: kdsHandoffChanged } = mergeHandoffRecord(currentHandoffEntry, patch);
          if(!queueChanged && !historyChanged && !currentOrder.changed && !kdsHandoffChanged){
            return state;
          }
          return {
            ...state,
            data:{
              ...data,
              order: currentOrder.value,
              ordersQueue: queueChanged ? queueNext : data.ordersQueue,
              ordersHistory: historyChanged ? historyNext : data.ordersHistory,
              kds:{
                ...currentKds,
                handoff:{
                  ...(currentKds.handoff || {}),
                  [normalizedId]: kdsHandoffEntry
                }
              }
            }
          };
        });
      }
      if(posDB && posDB.available && typeof posDB.getOrder === 'function' && typeof posDB.saveOrder === 'function'){
        Promise.resolve(posDB.getOrder(normalizedId))
          .then((record)=>{
            if(!record) return null;
            const { next: merged, changed: handoffChanged } = mergeHandoffRecord(record.handoff, patch);
            const statusCandidate = patch.status !== undefined
              ? patch.status
              : (merged.status !== undefined ? merged.status : record.handoffStatus);
            let changed = handoffChanged;
            if(statusCandidate !== undefined && statusCandidate !== record.handoffStatus){
              changed = true;
            }
            const updatedAtChanged = patch.updatedAt && patch.updatedAt !== record.updatedAt;
            if(updatedAtChanged) changed = true;
            if(!changed){
              return null;
            }
            const nextRecord = {
              ...record,
              handoff: merged
            };
            if(statusCandidate !== undefined){
              nextRecord.handoffStatus = statusCandidate;
            }
            if(patch.updatedAt){
              nextRecord.updatedAt = patch.updatedAt;
            }
            if(statusCandidate === 'served'){
              if(nextRecord.status !== 'finalized') nextRecord.status = 'finalized';
              nextRecord.fulfillmentStage = 'delivered';
              const finishAt = patch.servedAt || patch.updatedAt;
              if(finishAt){
                nextRecord.finishedAt = finishAt;
              }
            } else if(statusCandidate === 'assembled' && nextRecord.fulfillmentStage !== 'delivered' && nextRecord.fulfillmentStage !== 'ready'){
              nextRecord.fulfillmentStage = 'ready';
            }
            return posDB.saveOrder(nextRecord, { mirror:true, origin:'central-sync' });
          })
          .catch(err=> console.warn('[Mishkah][POS][KDS] Failed to persist handoff update.', err));
      }
    }

    function enqueueKdsMessage(entry){
      pendingKdsMessages.push(entry);
    }

    function flushPendingKdsMessages(){
      if(!appRef || typeof appRef.setState !== 'function') return;
      if(!pendingKdsMessages.length) return;
      const backlog = pendingKdsMessages.splice(0, pendingKdsMessages.length);
      backlog.forEach(entry=>{
        if(entry && entry.type === 'handoff'){
          applyHandoffUpdateNow(entry.orderId, entry.payload, entry.meta);
        } else if(entry && entry.type === 'orders'){
          applyKdsOrderSnapshotNow(entry.payload, entry.meta || {});
        } else if(entry && entry.type === 'job'){
          applyKdsJobUpdateNow(entry.jobId, entry.payload, entry.meta || {});
        } else if(entry && entry.type === 'delivery'){
          applyKdsDeliveryUpdateNow(entry.orderId, entry.payload, entry.meta || {});
        }
      });
    }

    function handleKdsHandoffUpdate(message={}, meta={}){
      const orderId = message.orderId || message.id;
      if(orderId == null){
        return;
      }
      const payload = message.payload && typeof message.payload === 'object' ? message.payload : {};
      if(!appRef || typeof appRef.setState !== 'function'){
        enqueueKdsMessage({ type:'handoff', orderId: String(orderId), payload, meta });
        return;
      }
      applyHandoffUpdateNow(orderId, payload, meta);
    }

    function handleKdsOrderPayload(message={}, meta={}){
      if(!message || !message.jobOrders) return;
      if(!appRef || typeof appRef.setState !== 'function'){
        enqueueKdsMessage({ type:'orders', payload: message, meta });
        return;
      }
      applyKdsOrderSnapshotNow(message, meta);
    }

    function handleKdsJobUpdate(message={}, meta={}){
      const jobId = message.jobId || message.id;
      if(!jobId) return;
      const payload = message.payload && typeof message.payload === 'object' ? message.payload : {};
      if(!appRef || typeof appRef.setState !== 'function'){
        enqueueKdsMessage({ type:'job', jobId: String(jobId), payload, meta });
        return;
      }
      applyKdsJobUpdateNow(jobId, payload, meta);
    }

    function handleKdsDeliveryUpdate(message={}, meta={}){
      const orderId = message.orderId || message.id;
      if(!orderId) return;
      const payload = message.payload && typeof message.payload === 'object' ? message.payload : {};
      if(!appRef || typeof appRef.setState !== 'function'){
        enqueueKdsMessage({ type:'delivery', orderId: String(orderId), payload, meta });
        return;
      }
      applyKdsDeliveryUpdateNow(orderId, payload, meta);
    }

    function installTempOrderWatcher(){
      if(!posDB.available) return;
      if(!M || !M.Guardian || typeof M.Guardian.runPreflight !== 'function') return;
      if(M.Guardian.runPreflight.__posTempWatcher) return;
      const originalRunPreflight = M.Guardian.runPreflight.bind(M.Guardian);
      const signatureCache = new Map();

      const computeSignature = (order, paymentsState)=>{
        if(!order) return '';
        const totals = order.totals || {};
        const discount = normalizeDiscount(order.discount);
        const resolvedPayments = Array.isArray(paymentsState?.split) && paymentsState.split.length
          ? paymentsState.split
          : (Array.isArray(order.payments) ? order.payments : []);
        const lines = Array.isArray(order.lines)
          ? order.lines.map(line=> [
              line.id || line.itemId || '',
              Number(line.qty) || 0,
              Number(line.total) || 0,
              Number(line.updatedAt) || 0
            ].join(':')).join('|')
          : '';
        const payments = resolvedPayments
          .map(pay=> [pay.method || pay.id || '', Number(pay.amount) || 0].join(':'))
          .join('|');
        const notes = Array.isArray(order.notes)
          ? order.notes.map(note=> note.id || note.message || '').join('|')
          : '';
        const tableIds = Array.isArray(order.tableIds) ? order.tableIds.join(',') : '';
        return [
          order.id || '',
          Number(order.updatedAt) || 0,
          order.status || '',
          order.fulfillmentStage || '',
          order.paymentState || '',
          discount ? `${discount.type}:${discount.value}` : 'null',
          `${Number(totals.subtotal)||0}:${Number(totals.due)||0}:${Number(totals.total)||0}`,
          lines,
          payments,
          notes,
          tableIds,
          Number(order.guests) || 0
        ].join('#');
      };

      const persistTempOrder = (order, paymentsState)=>{
        if(!order || !order.id) return;
        const payments = Array.isArray(paymentsState?.split) && paymentsState.split.length
          ? paymentsState.split
          : (Array.isArray(order.payments) ? order.payments : []);
        const payload = { ...order, payments };
        const signature = computeSignature(payload, paymentsState);
        if(signatureCache.get(order.id) === signature) return;
        signatureCache.set(order.id, signature);
        Promise.resolve(posDB.saveTempOrder(payload))
          .catch(err=> console.warn('[Mishkah][POS] temp order persist failed', err));
      };

      const cleanupTempOrder = (orderId)=>{
        if(!orderId) return;
        signatureCache.delete(orderId);
        Promise.resolve(posDB.deleteTempOrder(orderId))
          .catch(err=> console.warn('[Mishkah][POS] temp order cleanup failed', err));
      };

      M.Guardian.runPreflight = function(stage, payload, ctx){
        if(stage === 'state' && payload && typeof payload === 'object'){
          try {
            const nextState = payload.next || null;
            const prevState = payload.prev || null;
            const nextOrder = nextState?.data?.order || null;
            const prevOrder = prevState?.data?.order || null;
            const paymentsState = nextState?.data?.payments || null;
            const prevPaymentsState = prevState?.data?.payments || null;
            const sameOrder = nextOrder && prevOrder && nextOrder.id && prevOrder.id && nextOrder.id === prevOrder.id;
            let nextSignature = null;
            let prevSignature = null;
            if(nextOrder){
              nextSignature = computeSignature(nextOrder, paymentsState);
            }
            if(prevOrder){
              prevSignature = computeSignature(prevOrder, prevPaymentsState);
            }
            const orderMutated = sameOrder && nextSignature !== prevSignature;
            if(orderMutated && nextOrder){
              if(nextState?.data?.order && typeof nextState.data.order === 'object'){
                nextState.data.order.isPersisted = false;
                nextState.data.order.dirty = true;
                nextState.data.order.savedAt = null;
              }
              if(Array.isArray(nextState?.data?.ordersHistory)){
                const historyIndex = nextState.data.ordersHistory.findIndex(entry=> entry && entry.id === nextOrder.id);
                if(historyIndex >= 0){
                  const updatedHistory = nextState.data.ordersHistory.slice();
                  const currentEntry = { ...updatedHistory[historyIndex], isPersisted:false, dirty:true, savedAt:null };
                  updatedHistory[historyIndex] = currentEntry;
                  nextState.data.ordersHistory = updatedHistory;
                }
              }
            }
            if(prevOrder && prevOrder.id){
              if(!nextOrder || nextOrder.id !== prevOrder.id || nextOrder.isPersisted){
                cleanupTempOrder(prevOrder.id);
              }
            }
            if(nextOrder && nextOrder.id){
              if(nextOrder.isPersisted){
                cleanupTempOrder(nextOrder.id);
              } else {
                persistTempOrder(nextOrder, paymentsState);
              }
            }
          } catch(err){
            console.warn('[Mishkah][POS] temp order watcher failed', err);
          }
        }
        return originalRunPreflight(stage, payload, ctx);
      };
      M.Guardian.runPreflight.__posTempWatcher = true;
    }

    installTempOrderWatcher();
    const preferencesStore = U.Storage && U.Storage.local ? U.Storage.local('mishkah-pos') : null;
    const savedModalSizes = preferencesStore ? (preferencesStore.get('modalSizes', {}) || {}) : {};
    const savedThemePrefs = preferencesStore ? (preferencesStore.get('themePrefs', {}) || {}) : {};
    let invoiceSequence = 0;
    if(posDB.available){
      try {
        invoiceSequence = await posDB.peekInvoiceCounter(POS_INFO.id);
      } catch(error){
        console.warn('[Mishkah][POS] invoice peek failed', error);
        invoiceSequence = 0;
      }
    }

    async function allocateInvoiceId(){
      if(posDB.available){
        try{
          const next = await posDB.nextInvoiceNumber(POS_INFO.id, POS_INFO.prefix);
          invoiceSequence = next.value;
          return next.id;
        } catch(error){
          console.warn('[Mishkah][POS] invoice allocation failed', error);
          const requiresCentral = error && typeof error.code === 'string' && error.code.startsWith('POS_SYNC');
          if(requiresCentral && centralSyncDisabled){
          } else if(requiresCentral && !allowIndexedDbFallback){
            throw error;
          }
        }
      }
      invoiceSequence += 1;
      return `${POS_INFO.prefix}-${invoiceSequence}`;
    }

    function applyThemePreferenceStyles(prefs){
      const styleId = 'pos-theme-prefs';
      let styleEl = document.getElementById(styleId);
      if(!styleEl){
        styleEl = document.createElement('style');
        styleEl.id = styleId;
        document.head.appendChild(styleEl);
      }
      if(!prefs || (Object.keys(prefs.light||{}).length === 0 && Object.keys(prefs.dark||{}).length === 0)){
        styleEl.textContent = '';
        return;
      }
      const segments = [];
      const light = prefs.light || {};
      const dark = prefs.dark || {};
      const makeRule = (selector, conf)=>{
        const colors = conf.colors || {};
        const fonts = conf.fonts || {};
        const declarations = [];
        Object.entries(colors).forEach(([prop,value])=>{ if(value) declarations.push(`${prop}:${value}`); });
        if(fonts.base) declarations.push(`font-size:${fonts.base}`);
        if(declarations.length) segments.push(`${selector}{${declarations.join(';')}}`);
      };
      makeRule(':root', light);
      makeRule(':root.dark', dark);
      styleEl.textContent = segments.join('\n');
    }

    applyThemePreferenceStyles(savedThemePrefs);
    const kdsBridge = createKDSBridge(kdsEndpoint);
    const LOCAL_SYNC_CHANNEL_NAME = 'mishkah-pos-kds-sync';
    const localKdsChannel = typeof BroadcastChannel !== 'undefined'
      ? new BroadcastChannel(LOCAL_SYNC_CHANNEL_NAME)
      : null;
    const emitLocalKdsMessage = (message)=>{
      if(!localKdsChannel || !message) return;
      try { localKdsChannel.postMessage({ origin:'pos', ...message }); } catch(_err){}
    };
    if(localKdsChannel){
      localKdsChannel.onmessage = (event)=>{
        const msg = event?.data;
        if(!msg || !msg.type || msg.origin === 'pos') return;
        const meta = msg.meta || {};
        if(msg.type === 'orders:payload' && msg.payload){
          handleKdsOrderPayload(msg.payload, meta);
          return;
        }
        if(msg.type === 'job:update' && msg.jobId){
          handleKdsJobUpdate({ jobId: msg.jobId, payload: msg.payload || {} }, meta);
        }
        if(msg.type === 'delivery:update' && msg.orderId){
          handleKdsDeliveryUpdate({ orderId: msg.orderId, payload: msg.payload || {} }, meta);
        }
        if(msg.type === 'handoff:update' && msg.orderId){
          handleKdsHandoffUpdate({ orderId: msg.orderId, payload: msg.payload || {} }, meta);
        }
      };
    }
    const kdsSyncHandlers = {
      onOrders: handleKdsOrderPayload,
      onJobUpdate: handleKdsJobUpdate,
      onDeliveryUpdate: handleKdsDeliveryUpdate,
      onHandoffUpdate: handleKdsHandoffUpdate
    };
    const kdsSync = createKDSSync({ endpoint: kdsEndpoint, token: kdsToken, handlers: kdsSyncHandlers, channel: BRANCH_CHANNEL, localEmitter: emitLocalKdsMessage });
    if(kdsSync && typeof kdsSync.connect === 'function'){
      kdsSync.connect();
    }

    let kitchenSections;
    let categorySections;
    let categories;
    let menuItems;
    let menuIndex;
    let modifiersCatalog;
    let kdsConfig;

    function deriveMenuStructures(source){
      const dataset = source || {};
      const sectionsRaw = Array.isArray(dataset.kitchen_sections) ? dataset.kitchen_sections : [];
      const sections = sectionsRaw.map(section=>{
        const name = ensureLocaleObject(section?.section_name, { ar: section?.id || '', en: section?.id || '' });
        const description = ensureLocaleObject(section?.description, {});
        return {
          id: section?.id,
          name,
          description
        };
      });
      const categorySectionsRaw = Array.isArray(dataset.category_sections) ? dataset.category_sections.slice() : [];
      const sectionMap = new Map(categorySectionsRaw.map(entry=> [entry.category_id || entry.categoryId, entry.section_id || entry.sectionId]));
      const rawCategories = Array.isArray(dataset.categories) ? dataset.categories.slice() : [];
      if(!rawCategories.some(cat=> cat && cat.id === 'all')){
        rawCategories.unshift({ id:'all', category_name:{ ar:'الكل', en:'All' }, section_id:'expo' });
      }
      const normalizedCategories = rawCategories.map(cat=>{
        const sectionId = cat?.section_id || sectionMap.get(cat?.id) || null;
        const fallbackLabel = { ar: cat?.id || '', en: cat?.id || '' };
        const label = ensureLocaleObject(cat?.category_name, fallbackLabel);
        return {
          id: cat?.id,
          sectionId,
          label
        };
      });
      const itemsRaw = Array.isArray(dataset.items) ? dataset.items : [];
      const items = itemsRaw.map(item=>{
        const categoryId = item.category_id || item.category || 'all';
        const pricing = ensurePlainObject(item.pricing);
        const priceSource = pricing.base ?? pricing.price ?? pricing.amount ?? pricing.value ?? item.price;
        const price = round(priceSource);
        const kitchenSection = item.kitchen_section_id || sectionMap.get(categoryId) || 'expo';
        const media = ensurePlainObject(item.media);
        const name = ensureLocaleObject(item.item_name || item.name, { ar: String(item.id || ''), en: String(item.id || '') });
        const description = ensureLocaleObject(item.item_description || item.description, { ar:'', en:'' });
        return {
          id: item.id,
          category: categoryId,
          price,
          image: media.image || media.url || media.path || item.image || '',
          kitchenSection,
          name,
          description
        };
      });
      const index = new Map(items.map(entry=> [String(entry.id), entry]));
      const rawModifiers = typeof dataset.modifiers === 'object' && dataset.modifiers ? dataset.modifiers : {};
      const normalizeModifierEntry = (entry, fallbackType)=>{
        if(!entry) return null;
        const id = entry.id ?? entry.code ?? entry.key;
        if(id == null) return null;
        const priceChange = Number(entry.price_change ?? entry.priceChange ?? entry.amount ?? 0) || 0;
        const label = ensureLocaleObject(entry.name || entry.label, { ar: String(id), en: String(id) });
        return {
          id: String(id),
          type: fallbackType,
          label,
          priceChange: round(priceChange)
        };
      };
      const addOns = (Array.isArray(rawModifiers.add_ons) ? rawModifiers.add_ons : rawModifiers.addOns || [])
        .map(entry=> normalizeModifierEntry(entry, 'add_on'))
        .filter(Boolean);
      const removals = (Array.isArray(rawModifiers.removals) ? rawModifiers.removals : rawModifiers.remove || [])
        .map(entry=> normalizeModifierEntry(entry, 'removal'))
        .filter(Boolean);
      return {
        kitchenSections: sections,
        categorySections: categorySectionsRaw,
        categories: normalizedCategories,
        menuItems: items,
        menuIndex: index,
        modifiersCatalog: { addOns, removals }
      };
    }

    const normalizeJobOrdersSnapshot = (source={})=>({
      headers: Array.isArray(source.headers) ? source.headers.map(entry=> ({ ...entry })) : [],
      details: Array.isArray(source.details) ? source.details.map(entry=> ({ ...entry })) : [],
      modifiers: Array.isArray(source.modifiers) ? source.modifiers.map(entry=> ({ ...entry })) : [],
      statusHistory: Array.isArray(source.statusHistory) ? source.statusHistory.map(entry=> ({ ...entry })) : [],
      expoPassTickets: Array.isArray(source.expoPassTickets) ? source.expoPassTickets.map(entry=> ({ ...entry })) : []
    });

    const mergeDriversLists = (primary=[], secondary=[])=>{
      const map = new Map();
      const append = (list)=>{
        list.forEach(driver=>{
          if(!driver) return;
          const id = driver.id != null ? String(driver.id) : null;
          if(id){
            map.set(id, { ...driver });
          } else {
            map.set(`driver-${map.size + 1}`, { ...driver });
          }
        });
      };
      append(Array.isArray(primary) ? primary : []);
      append(Array.isArray(secondary) ? secondary : []);
      return Array.from(map.values());
    };

    function deriveKdsStructures(dataset, menuDerived){
      const data = dataset || {};
      const kdsSource = ensurePlainObject(data.kds);
      const derivedMenu = menuDerived || deriveMenuStructures(data);
      const sections = Array.isArray(derivedMenu.kitchenSections) ? derivedMenu.kitchenSections : [];
      const stationsRaw = Array.isArray(kdsSource.stations) ? kdsSource.stations : [];
      const stations = stationsRaw.length
        ? stationsRaw.map(station=> ({ ...station }))
        : sections.map((section, idx)=>({
            id: section.id,
            code: section.id ? String(section.id).toUpperCase() : `ST-${idx + 1}`,
            nameAr: section.name?.ar || section.id || `Station ${idx + 1}`,
            nameEn: section.name?.en || section.id || `Station ${idx + 1}`,
            stationType: section.id === 'expo' ? 'expo' : 'prep',
            isExpo: section.id === 'expo',
            sequence: idx + 1,
            themeColor: null,
            autoRouteRules: [],
            displayConfig: { layout:'grid', columns:2 },
            createdAt: null,
            updatedAt: null
          }));
      const stationRoutesRaw = Array.isArray(kdsSource.stationCategoryRoutes) ? kdsSource.stationCategoryRoutes : [];
      const fallbackRoutes = Array.isArray(data.category_sections)
        ? data.category_sections.map((entry, idx)=>({
            id: entry.id || `route-${idx + 1}`,
            categoryId: entry.category_id || entry.categoryId,
            stationId: entry.section_id || entry.sectionId,
            priority: entry.priority || 1,
            isActive: entry.is_active !== false && entry.isActive !== false,
            createdAt: entry.created_at || entry.createdAt || null,
            updatedAt: entry.updated_at || entry.updatedAt || null
          }))
        : [];
      const stationCategoryRoutes = (stationRoutesRaw.length ? stationRoutesRaw : fallbackRoutes)
        .map(route=> ({ ...route }));
      const drivers = mergeDriversLists(data.drivers, kdsSource.drivers);
      const metadata = ensurePlainObject(kdsSource.metadata);
      const sync = ensurePlainObject(kdsSource.sync);
      const channel = normalizeChannelName(
        sync.channel || sync.branch_channel || sync.branchChannel || branchChannelSource || BRANCH_CHANNEL,
        BRANCH_CHANNEL
      );
      return {
        stations,
        stationCategoryRoutes,
        jobOrders: normalizeJobOrdersSnapshot(kdsSource.jobOrders),
        deliveries:{ assignments:{}, settlements:{} },
        handoff:{},
        drivers,
        metadata,
        sync:{ ...sync, channel },
        channel
      };
    }

    function applyKdsDataset(source, menuDerived){
      kdsConfig = deriveKdsStructures(source, menuDerived);
      return kdsConfig;
    }

    function cloneKdsDerived(){
      const snapshot = kdsConfig || deriveKdsStructures(MOCK, { kitchenSections, categorySections });
      return {
        stations: Array.isArray(snapshot.stations) ? snapshot.stations.map(station=> ({ ...station })) : [],
        stationCategoryRoutes: Array.isArray(snapshot.stationCategoryRoutes)
          ? snapshot.stationCategoryRoutes.map(route=> ({ ...route }))
          : [],
        jobOrders: normalizeJobOrdersSnapshot(snapshot.jobOrders),
        deliveries:{
          assignments:{ ...(snapshot.deliveries?.assignments || {}) },
          settlements:{ ...(snapshot.deliveries?.settlements || {}) }
        },
        handoff:{ ...(snapshot.handoff || {}) },
        drivers: Array.isArray(snapshot.drivers) ? snapshot.drivers.map(driver=> ({ ...driver })) : [],
        metadata:{ ...(snapshot.metadata || {}) },
        sync:{ ...(snapshot.sync || {}), channel: snapshot.channel || BRANCH_CHANNEL },
        channel: snapshot.channel || BRANCH_CHANNEL
      };
    }

    function applyMenuDataset(source){
      const derived = deriveMenuStructures(source);
      kitchenSections = derived.kitchenSections;
      categorySections = derived.categorySections;
      categories = derived.categories;
      menuItems = derived.menuItems;
      menuIndex = derived.menuIndex;
      modifiersCatalog = derived.modifiersCatalog;
      return derived;
    }

    function cloneMenuDerived(){
      return {
        kitchenSections: cloneDeep(kitchenSections),
        categorySections: cloneDeep(categorySections),
        categories: cloneDeep(categories),
        menuItems: cloneDeep(menuItems),
        modifiersCatalog: cloneDeep(modifiersCatalog),
        paymentMethods: clonePaymentMethods(PAYMENT_METHODS),
        kds: cloneKdsDerived()
      };
    }

    const initialMenuDerived = applyMenuDataset(MOCK);
    applyKdsDataset(MOCK, initialMenuDerived);

    let pendingRemoteResult = null;

    const hasEntries = (list)=> Array.isArray(list) && list.length > 0;
    const isViablePosDataset = (dataset)=>{
      if(!dataset || typeof dataset !== 'object') return false;
      const hasSettings = dataset.settings && typeof dataset.settings === 'object';
      if(!hasSettings) return false;
      const hasMenuItems = hasEntries(dataset.items) || hasEntries(dataset.menuItems) || hasEntries(dataset.menu_items);
      const hasCategories = hasEntries(dataset.categories) || hasEntries(dataset.menu_categories);
      const hasCategorySections = hasEntries(dataset.category_sections);
      const hasOrderTypes = hasEntries(dataset.order_types);
      const hasPaymentMethods = hasEntries(dataset.payment_methods);
      const hasLegacyTableData = hasEntries(dataset.tables?.pos_database);
      return hasMenuItems
        || hasCategories
        || hasCategorySections
        || hasOrderTypes
        || hasPaymentMethods
        || hasLegacyTableData;
    };

    function applyLiveSnapshotFromWs2(snapshot, meta={}){
      if(!snapshot || typeof snapshot !== 'object') return;
      const candidate = extractDatasetFromSnapshot(snapshot) || snapshot;
      const candidateViable = isViablePosDataset(candidate);
      const previousViable = isViablePosDataset(MOCK_BASE);
      if(!candidateViable && previousViable){
        const keys = candidate && typeof candidate === 'object' ? Object.keys(candidate).slice(0, 8) : [];
        pushCentralDiagnostic({
          level:'warn',
          source:'central-sync',
          event:'ws2:snapshot:skipped',
          message:'Ignored live dataset without catalog entries; keeping existing menu.',
          data:{
            keys,
            hasItems: hasEntries(candidate?.items),
            hasCategories: hasEntries(candidate?.categories),
            hasSections: hasEntries(candidate?.category_sections),
            hasLegacyTableData: hasEntries(candidate?.tables?.pos_database)
          }
        });
        pendingRemoteResult = {
          derived: cloneMenuDerived(),
          remote: snapshotRemoteStatus(remoteStatus)
        };
        if(appRef){
          flushRemoteUpdate();
        }
        return;
      }
      MOCK_BASE = cloneDeep(candidate);
      MOCK = cloneDeep(MOCK_BASE);
      PAYMENT_METHODS = derivePaymentMethods(MOCK);
      const menuDerived = applyMenuDataset(MOCK);
      applyKdsDataset(MOCK, menuDerived);
      pendingRemoteResult = {
        derived: cloneMenuDerived(),
        remote: snapshotRemoteStatus(remoteStatus)
      };
      if(meta.reason !== 'subscribe'){
        pushCentralDiagnostic({
          level:'info',
          source:'central-sync',
          event:'ws2:snapshot',
          message:'Received live dataset from WS2 gateway.',
          data:{
            branchId: meta.branchId || syncSettings.branch_id || BRANCH_CHANNEL,
            version: meta.version || null,
            historySize: meta.historySize || null,
            serverId: meta.serverId || null
          }
        });
      }
      if(appRef){
        flushRemoteUpdate();
      }
    }

    if(dataSource && typeof dataSource.subscribe === 'function'){
      dataSource.subscribe(event=>{
        if(event && event.type === 'snapshot' && event.snapshot){
          const meta = { ...(event.meta || {}), branchId: event.connection?.branchId };
          applyLiveSnapshotFromWs2(event.snapshot, meta);
        }
      });
    }
    const assignRemoteData = (currentData, derivedSnapshot, remoteSnapshot)=>{
      const menuState = currentData?.menu || {};
      const paymentsState = currentData?.payments || {};
      const derivedMethods = Array.isArray(derivedSnapshot?.paymentMethods) && derivedSnapshot.paymentMethods.length
        ? clonePaymentMethods(derivedSnapshot.paymentMethods)
        : clonePaymentMethods(PAYMENT_METHODS);
      let activeMethod = paymentsState.activeMethod;
      if(derivedMethods.length){
        const hasActive = activeMethod && derivedMethods.some(method=> method.id === activeMethod);
        activeMethod = hasActive ? activeMethod : derivedMethods[0].id;
      }
      const nextPayments = {
        ...paymentsState,
        methods: derivedMethods,
        activeMethod,
        split: Array.isArray(paymentsState.split) ? paymentsState.split.map(entry=> ({ ...entry })) : []
      };
      const currentKds = currentData?.kds || {};
      const derivedKds = derivedSnapshot.kds || cloneKdsDerived();
      const nextKds = {
        ...currentKds,
        stations: Array.isArray(derivedKds.stations) ? derivedKds.stations.map(station=> ({ ...station })) : [],
        stationCategoryRoutes: Array.isArray(derivedKds.stationCategoryRoutes)
          ? derivedKds.stationCategoryRoutes.map(route=> ({ ...route }))
          : [],
        drivers: Array.isArray(derivedKds.drivers) ? derivedKds.drivers.map(driver=> ({ ...driver })) : [],
        metadata:{ ...(derivedKds.metadata || {}) },
        sync:{ ...(derivedKds.sync || {}) },
        channel: derivedKds.channel || currentKds.channel || BRANCH_CHANNEL
      };
      if(!currentKds.jobOrders){
        nextKds.jobOrders = normalizeJobOrdersSnapshot(derivedKds.jobOrders);
      }
      if(!currentKds.deliveries){
        nextKds.deliveries = {
          assignments:{ ...(derivedKds.deliveries?.assignments || {}) },
          settlements:{ ...(derivedKds.deliveries?.settlements || {}) }
        };
      }
      if(!currentKds.handoff){
        nextKds.handoff = { ...(derivedKds.handoff || {}) };
      }
      return {
        ...(currentData || {}),
        remotes:{
          ...(currentData?.remotes || {}),
          posDatabase: remoteSnapshot
        },
        kitchenSections: derivedSnapshot.kitchenSections,
        categorySections: derivedSnapshot.categorySections,
        menu:{
          ...menuState,
          categories: derivedSnapshot.categories,
          items: derivedSnapshot.menuItems
        },
        modifiers: derivedSnapshot.modifiersCatalog,
        payments: nextPayments,
        kds: nextKds
      };
    };

    remoteHydrator.promise.then(result=>{
      if(result && result.data){
        MOCK = mergePreferRemote(MOCK_BASE, result.data);
        PAYMENT_METHODS = derivePaymentMethods(MOCK);
        const menuDerived = applyMenuDataset(MOCK);
        applyKdsDataset(MOCK, menuDerived);
      }
      if(result && result.error){
        console.warn('[Mishkah][POS] remote catalog hydration error', result.error);
      }
      pendingRemoteResult = {
        derived: cloneMenuDerived(),
        remote: snapshotRemoteStatus(remoteStatus)
      };
      if(appRef){
        flushRemoteUpdate();
      }
    }).catch(error=>{
      console.warn('[Mishkah][POS] remote catalog hydration failed', error);
      pendingRemoteResult = {
        derived: cloneMenuDerived(),
        remote: snapshotRemoteStatus(remoteStatus)
      };
      if(appRef){
        flushRemoteUpdate();
      }
    });

    const orderStages = (Array.isArray(MOCK.order_stages) && MOCK.order_stages.length ? MOCK.order_stages : [
      { id:'new', stage_name:{ ar:'جديد', en:'New' }, sequence:1, lock_line_edits:false },
      { id:'preparing', stage_name:{ ar:'جاري التجهيز', en:'Preparing' }, sequence:2, lock_line_edits:true },
      { id:'prepared', stage_name:{ ar:'تم التجهيز', en:'Prepared' }, sequence:3, lock_line_edits:true },
      { id:'delivering', stage_name:{ ar:'جاري التسليم', en:'Delivering' }, sequence:4, lock_line_edits:true },
      { id:'delivered', stage_name:{ ar:'تم التسليم', en:'Delivered' }, sequence:5, lock_line_edits:true },
      { id:'paid', stage_name:{ ar:'تم الدفع', en:'Paid' }, sequence:6, lock_line_edits:true },
      { id:'closed', stage_name:{ ar:'تم الإغلاق', en:'Closed' }, sequence:7, lock_line_edits:true }
    ]).map(stage=>({
      id: stage.id,
      name:{ ar: stage.stage_name?.ar || stage.id, en: stage.stage_name?.en || stage.id },
      sequence: typeof stage.sequence === 'number' ? stage.sequence : 0,
      lockLineEdits: stage.lock_line_edits !== undefined ? !!stage.lock_line_edits : true,
      description: stage.description || {}
    }));
    const orderStageMap = new Map(orderStages.map(stage=> [stage.id, stage]));

    const orderStatuses = (Array.isArray(MOCK.order_statuses) && MOCK.order_statuses.length ? MOCK.order_statuses : [
      { id:'open', status_name:{ ar:'مفتوح', en:'Open' } },
      { id:'held', status_name:{ ar:'معلّق', en:'Held' } },
      { id:'finalized', status_name:{ ar:'منتهي', en:'Finalized' } },
      { id:'closed', status_name:{ ar:'مغلق', en:'Closed' } }
    ]).map(status=>({
      id: status.id,
      name:{ ar: status.status_name?.ar || status.id, en: status.status_name?.en || status.id }
    }));
    const orderStatusMap = new Map(orderStatuses.map(status=> [status.id, status]));

    const orderPaymentStates = (Array.isArray(MOCK.order_payment_states) && MOCK.order_payment_states.length ? MOCK.order_payment_states : [
      { id:'unpaid', payment_name:{ ar:'غير مدفوع', en:'Unpaid' } },
      { id:'partial', payment_name:{ ar:'مدفوع جزئيًا', en:'Partially Paid' } },
      { id:'paid', payment_name:{ ar:'مدفوع', en:'Paid' } }
    ]).map(state=>({
      id: state.id,
      name:{ ar: state.payment_name?.ar || state.id, en: state.payment_name?.en || state.id }
    }));
    const orderPaymentMap = new Map(orderPaymentStates.map(state=> [state.id, state]));

    const orderLineStatuses = (Array.isArray(MOCK.order_line_statuses) && MOCK.order_line_statuses.length ? MOCK.order_line_statuses : [
      { id:'draft', status_name:{ ar:'مسودة', en:'Draft' } },
      { id:'queued', status_name:{ ar:'بانتظار التحضير', en:'Queued' } },
      { id:'preparing', status_name:{ ar:'جاري التحضير', en:'Preparing' } },
      { id:'ready', status_name:{ ar:'جاهز', en:'Ready' } },
      { id:'served', status_name:{ ar:'مقدّم', en:'Served' } }
    ]).map(status=>({
      id: status.id,
      name:{ ar: status.status_name?.ar || status.id, en: status.status_name?.en || status.id }
    }));
    const orderLineStatusMap = new Map(orderLineStatuses.map(status=> [status.id, status]));

    function toMillis(value, fallback){
      if(!value && fallback != null) return fallback;
      if(!value) return Date.now();
      if(typeof value === 'number') return value;
      const parsed = new Date(value).getTime();
      return Number.isFinite(parsed) ? parsed : (fallback != null ? fallback : Date.now());
    }

    function cloneName(value){
      if(!value) return { ar:'', en:'' };
      if(typeof value === 'string') return { ar:value, en:value };
      return {
        ar: value.ar || value.en || '',
        en: value.en || value.ar || ''
      };
    }

    function normalizeNote(raw, fallbackAuthor){
      if(!raw) return null;
      const message = raw.message || raw.text || '';
      if(!message) return null;
      const createdAt = toMillis(raw.created_at || raw.createdAt);
      return {
        id: raw.id || `note-${Math.random().toString(16).slice(2,8)}`,
        message,
        authorId: raw.author_id || raw.authorId || fallbackAuthor || 'system',
        authorName: raw.author_name || raw.authorName || '',
        createdAt
      };
    }

    function normalizeOrderStatusLogEntry(entry, context){
      if(!entry || !context || !context.orderId) return null;
      const changedAt = toMillis(
        entry.changed_at || entry.changedAt || entry.at || entry.timestamp,
        context.updatedAt
      );
      const statusId = entry.status_id || entry.statusId || entry.status || context.statusId || 'open';
      const stageId = entry.stage_id || entry.stageId || entry.stage || context.stageId || null;
      const paymentStateId = entry.payment_state_id || entry.paymentStateId || entry.paymentState || context.paymentStateId || null;
      const actorId = entry.actor_id || entry.actorId || entry.userId || entry.changedBy || context.actorId || null;
      const source = entry.source || entry.channel || entry.origin || null;
      const reason = entry.reason || entry.note || null;
      const metadata = ensurePlainObject(entry.metadata || entry.meta);
      const id = entry.id || `${context.orderId}::status::${changedAt}`;
      return {
        id,
        orderId: context.orderId,
        status: statusId,
        stage: stageId || undefined,
        paymentState: paymentStateId || undefined,
        actorId: actorId || undefined,
        source: source || undefined,
        reason: reason || undefined,
        metadata,
        changedAt
      };
    }

    function normalizeOrderLineStatusLogEntry(entry, context){
      if(!entry || !context || !context.orderId || !context.lineId) return null;
      const changedAt = toMillis(
        entry.changed_at || entry.changedAt || entry.at || entry.timestamp,
        context.updatedAt
      );
      const statusId = entry.status_id || entry.statusId || entry.status || context.statusId || 'draft';
      const stationId = entry.station_id || entry.stationId || entry.section_id || entry.sectionId || entry.kitchen_section_id || entry.kitchenSectionId || context.kitchenSection || null;
      const actorId = entry.actor_id || entry.actorId || entry.userId || entry.changedBy || context.actorId || null;
      const source = entry.source || entry.channel || entry.origin || null;
      const reason = entry.reason || entry.note || null;
      const metadata = ensurePlainObject(entry.metadata || entry.meta);
      const id = entry.id || `${context.lineId}::status::${changedAt}`;
      return {
        id,
        orderId: context.orderId,
        orderLineId: context.lineId,
        status: statusId,
        stationId: stationId || undefined,
        actorId: actorId || undefined,
        source: source || undefined,
        reason: reason || undefined,
        metadata,
        changedAt
      };
    }

    function normalizeOrderLine(raw, context){
      if(!raw) return null;
      const itemId = raw.item_id || raw.itemId;
      const menuItem = menuIndex.get(String(itemId));
      const qty = Math.max(1, Number(raw.qty) || 1);
      const price = raw.price != null ? Number(raw.price) : menuItem?.price || 0;
      const total = raw.total != null ? Number(raw.total) : round(price * qty);
      const stageId = raw.stage_id || raw.stageId || context.stageId || 'new';
      const statusId = raw.status_id || raw.statusId || 'draft';
      const notes = Array.isArray(raw.notes) ? raw.notes.map(note=> normalizeNote(note, context.actorId)).filter(Boolean) : [];
      const discount = normalizeDiscount(raw.discount);
      const kitchenSection = raw.kitchen_section_id || raw.kitchenSectionId || menuItem?.kitchenSection || context.kitchenSection || null;
      const createdAt = toMillis(raw.created_at || raw.createdAt, context.createdAt);
      const updatedAt = toMillis(raw.updated_at || raw.updatedAt, context.updatedAt);
      const lineId = raw.id || `ln-${context.orderId}-${itemId || Math.random().toString(16).slice(2,8)}`;
      const logContext = {
        orderId: context.orderId,
        lineId,
        statusId,
        kitchenSection,
        actorId: context.actorId,
        updatedAt
      };
      const statusLogSources = [
        raw.status_logs,
        raw.statusLogs,
        raw.status_history,
        raw.statusHistory,
        raw.events
      ];
      const lineStatusLogs = [];
      statusLogSources.forEach(source=>{
        if(!Array.isArray(source)) return;
        source.forEach(entry=>{
          const normalized = normalizeOrderLineStatusLogEntry(entry, logContext);
          if(normalized && normalized.id){
            lineStatusLogs.push(normalized);
          }
        });
      });
      if(!lineStatusLogs.length){
        const fallback = normalizeOrderLineStatusLogEntry({
          status: statusId,
          stationId: kitchenSection,
          changedAt: updatedAt,
          actorId: logContext.actorId
        }, logContext);
        if(fallback) lineStatusLogs.push(fallback);
      }
      lineStatusLogs.sort((a,b)=> (a.changedAt || 0) - (b.changedAt || 0));
      const latestLineLog = lineStatusLogs[lineStatusLogs.length - 1] || null;
      const resolvedStatusId = latestLineLog?.status || statusId;
      return {
        id: lineId,
        itemId,
        name: menuItem ? menuItem.name : cloneName(raw.name),
        description: menuItem ? menuItem.description : cloneName(raw.description),
        qty,
        price,
        total: round(total),
        status: resolvedStatusId,
        stage: stageId,
        kitchenSection,
        locked: raw.locked !== undefined ? !!raw.locked : (orderStageMap.get(stageId)?.lockLineEdits ?? true),
        notes,
        discount,
        createdAt,
        updatedAt,
        statusLogs: lineStatusLogs
      };
    }

    function normalizeMockOrder(raw){
      if(!raw) return null;
      const header = raw.header || {};
      const id = raw.id || header.id || `ORD-${Date.now()}`;
      const createdAt = toMillis(header.created_at || raw.createdAt);
      const updatedAt = toMillis(header.updated_at || raw.updatedAt, createdAt);
      const typeId = header.type_id || header.typeId || raw.type || 'dine_in';
      const stageId = header.stage_id || header.stageId || raw.fulfillmentStage || 'new';
      const statusId = header.status_id || header.statusId || raw.status || 'open';
      const paymentStateId = header.payment_state_id || header.paymentStateId || raw.payment_state || 'unpaid';
      const tableIds = Array.isArray(header.table_ids) ? header.table_ids.slice() : Array.isArray(raw.tableIds) ? raw.tableIds.slice() : [];
      const guests = header.guests || raw.guests || 0;
      const allowAdditions = header.allow_line_additions !== undefined ? !!header.allow_line_additions : (ORDER_TYPES.find(t=> t.id === typeId)?.allowsLineAdditions ?? (typeId === 'dine_in'));
      const lockLineEdits = header.locked_line_edits !== undefined ? !!header.locked_line_edits : (orderStageMap.get(stageId)?.lockLineEdits ?? true);
      const actorId = raw.updated_by || raw.updatedBy || header.updated_by || header.updatedBy || 'seed';
      const lineContext = { orderId:id, stageId, createdAt, updatedAt, actorId };
      const lines = Array.isArray(raw.lines) ? raw.lines.map(line=> normalizeOrderLine(line, lineContext)).filter(Boolean) : [];
      const discount = normalizeDiscount(raw.discount || header.discount);
      const totals = header.totals || raw.totals || calculateTotals(lines, settings, typeId, { orderDiscount: discount });
      const notes = Array.isArray(raw.notes) ? raw.notes.map(note=> normalizeNote(note, raw.author_id || header.author_id)).filter(Boolean) : [];
      const payments = Array.isArray(raw.payments)
        ? raw.payments.map(entry=>({
            id: entry.id || `pm-${Math.random().toString(36).slice(2,8)}`,
            method: entry.method || entry.method_id || entry.methodId || entry.type || 'cash',
            amount: round(Number(entry.amount) || 0)
          }))
        : [];
      const statusLogs = [];
      const statusLogSources = [
        raw.status_logs,
        raw.statusLogs,
        raw.status_history,
        raw.statusHistory,
        raw.events
      ];
      const logContext = {
        orderId: id,
        statusId,
        stageId,
        paymentStateId,
        actorId,
        updatedAt
      };
      const seenLogs = new Set();
      statusLogSources.forEach(source=>{
        if(!Array.isArray(source)) return;
        source.forEach(entry=>{
          const normalized = normalizeOrderStatusLogEntry(entry, logContext);
          if(normalized && normalized.id && !seenLogs.has(normalized.id)){
            seenLogs.add(normalized.id);
            statusLogs.push(normalized);
          }
        });
      });
      if(!statusLogs.length){
        const fallbackLog = normalizeOrderStatusLogEntry({
          status: statusId,
          stage: stageId,
          paymentState: paymentStateId,
          changedAt: updatedAt,
          actorId
        }, logContext);
        if(fallbackLog) statusLogs.push(fallbackLog);
      }
      statusLogs.sort((a,b)=> (a.changedAt || 0) - (b.changedAt || 0));
      const normalizedTotals = totals && typeof totals === 'object'
        ? totals
        : calculateTotals(lines, settings, typeId, { orderDiscount: discount });
      return {
        id,
        status: statusId,
        fulfillmentStage: stageId,
        paymentState: paymentStateId,
        type: typeId,
        tableIds,
        guests,
        totals: normalizedTotals,
        lines,
        notes,
        discount,
        payments,
        statusLogs,
        createdAt,
        updatedAt,
        savedAt: updatedAt,
        isPersisted:true,
        dirty:false,
        allowAdditions,
        lockLineEdits,
        origin:'seed',
        shiftId: raw.shift_id || header.shift_id || raw.shiftId || null,
        customerId: raw.customer_id || raw.customerId || header.customer_id || header.customerId || null,
        customerAddressId: raw.address_id || raw.addressId || header.address_id || header.addressId || null,
        customerName: raw.customer_name || raw.customerName || header.customer_name || header.customerName || '',
        customerPhone: raw.customer_phone || raw.customerPhone || header.customer_phone || header.customerPhone || '',
        customerAddress: raw.customer_address || raw.customerAddress || header.customer_address || header.customerAddress || '',
        customerAreaId: raw.customer_area_id || raw.customerAreaId || header.customer_area_id || header.customerAreaId || null,
        posId: raw.pos_id || header.pos_id || raw.posId || POS_INFO.id,
        posLabel: raw.pos_label || header.pos_label || raw.posLabel || POS_INFO.label,
        posNumber: (()=>{
          const rawNumber = raw.pos_number ?? header.pos_number ?? raw.posNumber;
          return Number.isFinite(Number(rawNumber)) ? Number(rawNumber) : POS_INFO.number;
        })()
      };
    }

    function normalizeMockShift(raw){
      if(!raw) return null;
      const id = raw.id || `SHIFT-${Math.random().toString(36).slice(2,8).toUpperCase()}`;
      const openedAt = toMillis(raw.opened_at || raw.openedAt);
      const closedAt = toMillis(raw.closed_at || raw.closedAt);
      const openingFloat = Number(raw.opening_float ?? raw.openingFloat ?? 0);
      const closingCashRaw = Number(raw.closing_cash ?? raw.closingCash ?? 0);
      const totals = raw.totals && typeof raw.totals === 'object' ? raw.totals : {};
      const payments = raw.payments && typeof raw.payments === 'object' ? raw.payments : {};
      const posId = raw.pos_id || raw.posId || POS_INFO.id;
      const posLabel = raw.pos_label || raw.posLabel || POS_INFO.label;
      const posNumberRaw = raw.pos_number ?? raw.posNumber;
      const posNumber = Number.isFinite(Number(posNumberRaw)) ? Number(posNumberRaw) : POS_INFO.number;
      const totalsByType = {
        dine_in: round(Number(totals.dine_in) || 0),
        takeaway: round(Number(totals.takeaway) || 0),
        delivery: round(Number(totals.delivery) || 0)
      };
      const paymentsByMethod = PAYMENT_METHODS.reduce((acc, method)=>{
        const lookupKeys = [
          method.id,
          method.code,
          typeof method.name === 'string' ? method.name : null,
          typeof method.name?.en === 'string' ? method.name.en : null,
          typeof method.name?.ar === 'string' ? method.name.ar : null,
          typeof method.label === 'string' ? method.label : null,
          typeof method.label?.en === 'string' ? method.label.en : null,
          typeof method.label?.ar === 'string' ? method.label.ar : null
        ].filter(Boolean);
        let value = 0;
        for(const key of lookupKeys){
          if(key != null && Object.prototype.hasOwnProperty.call(payments, key)){
            value = payments[key];
            break;
          }
        }
        acc[method.id] = round(Number(value) || 0);
        return acc;
      }, {});
      Object.keys(payments).forEach(key=>{
        if(!(key in paymentsByMethod)){
          paymentsByMethod[key] = round(Number(payments[key]) || 0);
        }
      });
      const totalSales = round((totalsByType.dine_in || 0) + (totalsByType.takeaway || 0) + (totalsByType.delivery || 0));
      return {
        id,
        openedAt,
        closedAt,
        openingFloat: round(openingFloat),
        closingCash: closingCashRaw ? round(closingCashRaw) : null,
        totalsByType,
        paymentsByMethod,
        totalSales,
        orders: Array.isArray(raw.orders) ? raw.orders.slice() : [],
        cashierId: raw.cashier_id || raw.cashierId || '',
        cashierName: raw.cashier_name || raw.cashierName || '',
        status: closedAt ? 'closed' : 'open',
        posId,
        posLabel,
        posNumber,
        isClosed: !!closedAt
      };
    }

    function getDistrictLabel(id, lang){
      const district = CAIRO_DISTRICTS.find(area=> area.id === id);
      if(!district) return id || '';
      return lang === 'ar' ? district.ar : district.en;
    }

    function createEmptyCustomerForm(){
      return {
        id:null,
        name:'',
        phones:[''],
        addresses:[{ id:null, title:'', areaId: CAIRO_DISTRICTS[0]?.id || '', line:'', notes:'' }]
      };
    }

    function createInitialCustomers(){
      const now = Date.now().toString(36).toUpperCase();
      return [
        {
          id:`CUST-${now}-A`,
          name:'أحمد خالد',
          phones:['01000011223','01234567890'],
          addresses:[
            { id:`ADDR-${now}-1`, title:'المنزل', areaId:'nasr_city', line:'عمارات الشركة، شارع الطيران، مدينة نصر', notes:'' },
            { id:`ADDR-${now}-2`, title:'العمل', areaId:'heliopolis', line:'شارع عمر بن الخطاب، هليوبوليس', notes:'التسليم عند البوابة' }
          ]
        },
        {
          id:`CUST-${now}-B`,
          name:'سارة مصطفى',
          phones:['01055667788'],
          addresses:[
            { id:`ADDR-${now}-3`, title:'المنزل', areaId:'maadi', line:'شارع 9، المعادي الجديدة', notes:'الطابق الثالث' }
          ]
        },
        {
          id:`CUST-${now}-C`,
          name:'Mohamed Adel',
          phones:['01122334455'],
          addresses:[
            { id:`ADDR-${now}-4`, title:'Home', areaId:'fifth_settlement', line:'بيت الوطن، التجمع الخامس', notes:'' }
          ]
        }
      ];
    }

    function findCustomer(customers, id){
      if(!id) return null;
      return (Array.isArray(customers) ? customers : []).find(customer=> customer.id === id) || null;
    }

    function findCustomerAddress(customer, id){
      if(!customer || !id) return null;
      return (Array.isArray(customer.addresses) ? customer.addresses : []).find(address=> address.id === id) || null;
    }

    const seedOrders = Array.isArray(MOCK.orders) ? MOCK.orders.map(normalizeMockOrder).filter(Boolean) : [];
    const rawShifts = Array.isArray(MOCK.shifts) ? MOCK.shifts.map(normalizeMockShift).filter(Boolean) : [];
    const SHIFT_HISTORY_SEED = rawShifts.filter(shift=> shift.closedAt || shift.status === 'closed');
    const ordersHistorySeed = seedOrders.map((order, idx)=>({
      ...order,
      seq: idx + 1,
      dirty:false,
      lines: Array.isArray(order.lines) ? order.lines.map(line=> ({ ...line })) : [],
      payments: Array.isArray(order.payments) ? order.payments.map(pay=> ({ ...pay })) : []
    }));
    const baseTables = Array.isArray(MOCK.tables) ? MOCK.tables : [];
    const tables = baseTables.map((tbl, idx)=>({
      id: tbl.id || `T${idx+1}`,
      name: tbl.name || `طاولة ${idx+1}`,
      capacity: tbl.seats || tbl.capacity || 4,
      zone: tbl.zone || '',
      displayOrder: typeof tbl.displayOrder === 'number' ? tbl.displayOrder : idx + 1,
      state: tbl.state || (tbl.status === 'inactive' ? 'disactive' : tbl.status === 'maintenance' ? 'maintenance' : 'active'),
      note: tbl.note || tbl.notes || ''
    }));
    while(tables.length < 20){
      const nextIndex = tables.length + 1;
      tables.push({
        id:`T${nextIndex}`,
        name:`طاولة ${nextIndex}`,
        capacity:4,
        zone:'',
        displayOrder: nextIndex,
        state:'active',
        note:''
      });
    }
    tables.sort((a,b)=> (a.displayOrder||0) - (b.displayOrder||0));

    const tableLocks = Array.isArray(MOCK.tableLocks) ? MOCK.tableLocks.map(lock=>({
      id: lock.id || `lock-${Math.random().toString(36).slice(2,8)}`,
      tableId: lock.tableId,
      orderId: lock.orderId || null,
      reservationId: lock.reservationId || null,
      lockedBy: lock.lockedBy || 'system',
      lockedAt: lock.lockedAt ? new Date(lock.lockedAt).getTime() : Date.now(),
      source: lock.source || 'pos',
      active: lock.active !== false
    })) : [];

    const ordersQueue = seedOrders.slice();

    const reservations = Array.isArray(MOCK.reservations) ? MOCK.reservations.map(res=>({
      id: res.id || `res-${Math.random().toString(36).slice(2,6)}`,
      customerName: res.customerName || '',
      phone: res.phone || '',
      partySize: res.partySize || 2,
      scheduledAt: res.scheduledAt ? new Date(res.scheduledAt).getTime() : Date.now(),
      holdUntil: res.holdUntil ? new Date(res.holdUntil).getTime() : null,
      tableIds: Array.isArray(res.tableIds) ? res.tableIds.slice() : [],
      status: res.status || 'booked',
      note: res.note || '',
      createdAt: res.createdAt ? new Date(res.createdAt).getTime() : Date.now()
    })) : [];

    const auditTrail = Array.isArray(MOCK.auditEvents) ? MOCK.auditEvents.map(evt=>({
      id: evt.id || `audit-${Math.random().toString(36).slice(2,8)}`,
      userId: evt.userId || 'system',
      action: evt.action || 'unknown',
      refType: evt.refType || 'table',
      refId: evt.refId || '',
      at: evt.at ? new Date(evt.at).getTime() : Date.now(),
      meta: evt.meta || {}
    })) : [];
    const rawEmployees = Array.isArray(MOCK.employees) ? MOCK.employees : [];
    const employees = rawEmployees.map(emp=>{
      const pinSource = emp.pin_code ?? emp.pin ?? emp.pinCode ?? emp.passcode ?? '';
      const pin = typeof pinSource === 'number' ? String(pinSource).padStart(SHIFT_PIN_LENGTH, '0') : String(pinSource || '').trim();
      return {
        id: emp.id || emp.employee_id || `emp-${Math.random().toString(36).slice(2,8)}`,
        name: emp.full_name || emp.name || emp.display_name || emp.username || 'موظف',
        role: emp.role || 'staff',
        pin: pin.replace(/\D/g,''),
        allowedDiscountRate: typeof emp.allowed_discount_rate === 'number'
          ? emp.allowed_discount_rate
          : (typeof emp.allowedDiscountRate === 'number' ? emp.allowedDiscountRate : 0)
      };
    }).filter(emp=> emp.pin && emp.pin.length);
    const maxEmployeePinLength = employees.reduce((max, emp)=> Math.max(max, emp.pin.length), 0);
    if(maxEmployeePinLength) SHIFT_PIN_LENGTH = Math.max(SHIFT_PIN_LENGTH, maxEmployeePinLength);
    const defaultCashier = employees.find(emp=> emp.role === 'cashier') || employees[0] || {
      id:'cashier-guest',
      name:'أحمد محمود',
      role:'cashier',
      pin: (SHIFT_PIN_FALLBACK || '0000').replace(/\D/g,''),
      allowedDiscountRate:0
    };
    const cashier = defaultCashier;

    function createDraftOrderId(){
      return `draft-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
    }

    async function generateOrderId(){
      return createDraftOrderId();
    }

    const initialTotals = calculateTotals([], settings, 'dine_in', {});
    let tempOrderDraft = null;
    if(posDB.available){
      try {
        const tempOrders = await posDB.listTempOrders();
        if(Array.isArray(tempOrders) && tempOrders.length){
          tempOrders.sort((a,b)=> (b?.updatedAt || 0) - (a?.updatedAt || 0));
          tempOrderDraft = tempOrders[0];
        }
      } catch(error){
        console.warn('[Mishkah][POS] temp order load failed', error);
      }
    }
    const baseOrderType = tempOrderDraft?.type || 'dine_in';
    const initialOrderId = tempOrderDraft?.id || await generateOrderId();
    const initialOrderLines = tempOrderDraft ? cloneDeep(tempOrderDraft.lines || []) : [];
    const initialOrderNotes = tempOrderDraft ? cloneDeep(tempOrderDraft.notes || []) : [];
    const initialOrderPayments = tempOrderDraft ? cloneDeep(tempOrderDraft.payments || []) : [];
    const initialOrderTables = tempOrderDraft && Array.isArray(tempOrderDraft.tableIds)
      ? tempOrderDraft.tableIds.slice()
      : [];
    const initialOrderDiscount = normalizeDiscount(tempOrderDraft?.discount);
    const draftTotalsSource = tempOrderDraft && tempOrderDraft.totals && typeof tempOrderDraft.totals === 'object'
      ? { ...tempOrderDraft.totals }
      : (tempOrderDraft
        ? calculateTotals(initialOrderLines, settings, baseOrderType, { orderDiscount: initialOrderDiscount })
        : initialTotals);
    const draftPaymentSnapshot = summarizePayments(draftTotalsSource, initialOrderPayments);
    let activeShift = null;
    let shiftHistoryFromDb = SHIFT_HISTORY_SEED.slice();
    if(posDB.available){
      try{
        activeShift = await posDB.getActiveShift(POS_INFO.id);
        if(activeShift){
          const seededHistory = ordersHistorySeed || [];
          const summary = summarizeShiftOrders(seededHistory, activeShift);
          activeShift = {
            ...activeShift,
            totalsByType: summary.totalsByType,
            paymentsByMethod: summary.paymentsByMethod,
            totalSales: summary.totalSales,
            countsByType: summary.countsByType,
            ordersCount: summary.ordersCount
          };
        }
        const listed = await posDB.listShifts({ posId: POS_INFO.id, limit: 50 });
        shiftHistoryFromDb = Array.isArray(listed) && listed.length
          ? listed.filter(shift=> !activeShift || shift.id !== activeShift.id)
          : shiftHistoryFromDb;
      } catch(error){
        console.warn('[Mishkah][POS] shift hydration failed', error);
      }
    }

    const initialKdsSnapshot = cloneKdsDerived();
    const initialTheme = 'dark';

    const posState = {
      head:{ title:'نقطة بيع حية' },
      env:{ theme:initialTheme, lang:'ar', dir:'rtl' },
      data:{
        settings,
        remotes:{ posDatabase: initialRemoteSnapshot },
        themePrefs: savedThemePrefs,
        currency:{ code: currencyCode, symbols: currencySymbols, display: currencyDisplayMode },
        pos: POS_INFO,
        user:{
          id: cashier.id || 'cashier-guest',
          name: cashier.name || cashier.full_name || 'أحمد محمود',
          role: cashier.role || 'cashier',
          allowedDiscountRate: typeof cashier.allowedDiscountRate === 'number' ? cashier.allowedDiscountRate : 0,
          shift: activeShift?.id || '—',
          shiftNo: activeShift ? activeShift.id : '#103'
        },
        status:{
          indexeddb:{ state: posDB.available ? 'idle' : 'offline', lastSync: null },
          kds:{ state:'idle', endpoint: DEFAULT_KDS_ENDPOINT },
          central:{
            state: centralSyncStatus.state,
            lastSync: centralSyncStatus.lastSync,
            version: centralSyncStatus.version,
            endpoint: centralSyncStatus.endpoint
          }
        },
        diagnostics:{
          central:{
            entries: centralDiagnosticsStore.getEntries(),
            lastEvent: null
          }
        },
        schema:{
          name: POS_SCHEMA_SOURCE?.name || 'mishkah_pos',
          version: POS_SCHEMA_SOURCE?.version || 1,
          tables: Array.isArray(POS_SCHEMA_SOURCE?.tables) ? POS_SCHEMA_SOURCE.tables : []
        },
        employees,
        menu:{
          search:'',
          category:'all',
          showFavoritesOnly:false,
          favorites:[],
          categories,
          items: menuItems
        },
        order:{
          id: initialOrderId,
          status: tempOrderDraft?.status || 'open',
          fulfillmentStage: tempOrderDraft?.fulfillmentStage || tempOrderDraft?.stage || 'new',
          paymentState: draftPaymentSnapshot.state || 'unpaid',
          type: baseOrderType,
          tableIds: initialOrderTables,
          guests: Number.isFinite(tempOrderDraft?.guests)
            ? Number(tempOrderDraft.guests)
            : (baseOrderType === 'dine_in' ? 0 : (tempOrderDraft?.guests || 0)),
          lines: initialOrderLines,
          notes: initialOrderNotes,
          discount: initialOrderDiscount,
          totals: draftTotalsSource,
          createdAt: tempOrderDraft?.createdAt || Date.now(),
          updatedAt: tempOrderDraft?.updatedAt || Date.now(),
          allowAdditions: tempOrderDraft?.allowAdditions !== undefined ? !!tempOrderDraft.allowAdditions : true,
          lockLineEdits: tempOrderDraft?.lockLineEdits !== undefined ? !!tempOrderDraft.lockLineEdits : false,
          isPersisted:false,
          origin: tempOrderDraft?.origin || 'pos',
          shiftId: tempOrderDraft?.shiftId || activeShift?.id || null,
          posId: tempOrderDraft?.posId || POS_INFO.id,
          posLabel: tempOrderDraft?.posLabel || POS_INFO.label,
          posNumber: Number.isFinite(Number(tempOrderDraft?.posNumber)) ? Number(tempOrderDraft.posNumber) : POS_INFO.number,
          payments: initialOrderPayments,
          customerId: tempOrderDraft?.customerId || null,
          customerAddressId: tempOrderDraft?.customerAddressId || null,
          customerName: tempOrderDraft?.customerName || '',
          customerPhone: tempOrderDraft?.customerPhone || '',
          customerAddress: tempOrderDraft?.customerAddress || '',
          customerAreaId: tempOrderDraft?.customerAreaId || null,
          dirty: tempOrderDraft ? tempOrderDraft.dirty !== false : false
        },
        orderStages,
        orderStatuses,
        orderPaymentStates,
        orderLineStatuses,
        kitchenSections,
        categorySections,
        tables,
        tableLocks,
        reservations,
        kds:{
          channel: initialKdsSnapshot.channel || BRANCH_CHANNEL,
          stations: Array.isArray(initialKdsSnapshot.stations) ? initialKdsSnapshot.stations : [],
          stationCategoryRoutes: Array.isArray(initialKdsSnapshot.stationCategoryRoutes)
            ? initialKdsSnapshot.stationCategoryRoutes
            : [],
          jobOrders: normalizeJobOrdersSnapshot(initialKdsSnapshot.jobOrders),
          deliveries:{
            assignments:{ ...(initialKdsSnapshot.deliveries?.assignments || {}) },
            settlements:{ ...(initialKdsSnapshot.deliveries?.settlements || {}) }
          },
          handoff:{ ...(initialKdsSnapshot.handoff || {}) },
          drivers: Array.isArray(initialKdsSnapshot.drivers) ? initialKdsSnapshot.drivers : [],
          metadata:{ ...(initialKdsSnapshot.metadata || {}) },
          sync:{ ...(initialKdsSnapshot.sync || {}), channel: initialKdsSnapshot.channel || BRANCH_CHANNEL }
        },
        ordersQueue,
        auditTrail,
        payments:{
          methods: clonePaymentMethods(PAYMENT_METHODS),
          activeMethod: (initialOrderPayments.length
            ? (initialOrderPayments[initialOrderPayments.length - 1]?.method || initialOrderPayments[0]?.method)
            : (PAYMENT_METHODS[0] && PAYMENT_METHODS[0].id)) || 'cash',
          split: initialOrderPayments
        },
        customers: createInitialCustomers(),
        customerAreas: CAIRO_DISTRICTS,
        modifiers: modifiersCatalog,
        print:{
          size:'thermal_80',
          docType:'customer',
          availablePrinters:[
            { id:'Thermal-80', label:'Thermal 80mm' },
            { id:'Kitchen-A5', label:'Kitchen A5' },
            { id:'Front-A4', label:'Front Office A4' }
          ],
          profiles:{
            customer:{
              size:'thermal_80',
              defaultPrinter:'Thermal-80',
              insidePrinter:'Thermal-80',
              outsidePrinter:'Front-A4',
              autoSend:true,
              preview:false,
              duplicateInside:false,
              duplicateOutside:true,
              copies:1
            },
            kitchen:{
              size:'a5',
              defaultPrinter:'Kitchen-A5',
              insidePrinter:'Kitchen-A5',
              outsidePrinter:'',
              autoSend:false,
              preview:true,
              duplicateInside:true,
              duplicateOutside:false,
              copies:1
            }
          }
        },
        reports:{ salesToday:0, ordersCount:0, avgTicket:0, topItemId:null },
        ordersHistory: ordersHistorySeed,
        shift:{
          current: activeShift,
          history: shiftHistoryFromDb,
          config:{ pinLength: SHIFT_PIN_LENGTH, openingFloat: SHIFT_OPEN_FLOAT_DEFAULT }
        }
      },
      ui:{
        modals:{ tables:false, payments:false, reports:false, print:false, reservations:false, orders:false, modifiers:false, jobStatus:false, diagnostics:false },
        modalSizes: savedModalSizes,
        drawers:{},
        settings:{ open:false, activeTheme: initialTheme },
        paymentDraft:{ amount:'' },
        tables:{ view:'assign', filter:'all', search:'', details:null },
        reservations:{ filter:'today', status:'all', editing:null, form:null },
        print:{ docType:'customer', size:'thermal_80', showPreview:false, showAdvanced:false, managePrinters:false, newPrinterName:'' },
        orders:{ tab:'all', search:'', sort:{ field:'updatedAt', direction:'desc' } },
        shift:{ showPin:false, pin:'', openingFloat: SHIFT_OPEN_FLOAT_DEFAULT, showSummary:false, viewShiftId:null, activeTab:'summary' },
        customer:{ open:false, mode:'search', search:'', keypad:'', selectedCustomerId:null, selectedAddressId:null, form:createEmptyCustomerForm() },
        orderNav:{ showPad:false, value:'' },
        lineModifiers:{ lineId:null, addOns:[], removals:[] },
        pendingAction:null,
        jobStatus:null
      }
    };

    function flushRemoteUpdate(){
      if(!pendingRemoteResult) return;
      const { derived, remote } = pendingRemoteResult;
      const nextData = assignRemoteData(posState.data, derived, remote);
      posState.data = nextData;
      if(appRef && typeof appRef.setState === 'function'){
        appRef.setState(prev=>({
          ...prev,
          data: assignRemoteData(prev.data, derived, remote)
        }));
      }
      pendingRemoteResult = null;
    }

    async function refreshPersistentSnapshot(options={}){
      if(!posDB.available) return null;
      const { focusCurrent=false, syncOrders=true } = options;
      try{
        const [allOrders, activeShiftRaw, shiftListRaw, activeOrdersOnly] = await Promise.all([
          posDB.listOrders({ onlyActive:false }),
          posDB.getActiveShift(POS_INFO.id),
          posDB.listShifts({ posId: POS_INFO.id, limit: 100 }),
          posDB.listOrders({ onlyActive:true })
        ]);
        const historyOrders = Array.isArray(allOrders)
          ? allOrders
              .filter(order=> order && order.isPersisted !== false && order.dirty !== true && order.status !== 'draft')
              .map((order, idx)=>({
                ...order,
                dirty:false,
                seq: idx + 1,
                payments: Array.isArray(order.payments) ? order.payments.map(payment=> ({ ...payment })) : [],
                lines: Array.isArray(order.lines) ? order.lines.map(line=> ({ ...line })) : []
              }))
          : [];
        const summarySource = historyOrders;
        let currentShift = null;
        if(activeShiftRaw){
          const sanitizedActive = SHIFT_TABLE.createRecord({
            ...activeShiftRaw,
            totalsByType: activeShiftRaw.totalsByType || {},
            paymentsByMethod: activeShiftRaw.paymentsByMethod || {},
            countsByType: activeShiftRaw.countsByType || {},
            orders: Array.isArray(activeShiftRaw.orders) ? activeShiftRaw.orders : []
          });
          const activeSummary = summarizeShiftOrders(summarySource, sanitizedActive);
          currentShift = {
            ...sanitizedActive,
            totalsByType: activeSummary.totalsByType,
            paymentsByMethod: activeSummary.paymentsByMethod,
            totalSales: activeSummary.totalSales,
            orders: activeSummary.orders,
            ordersCount: activeSummary.ordersCount,
            countsByType: activeSummary.countsByType,
            payments: activeSummary.payments,
            refunds: activeSummary.refunds,
            returns: activeSummary.returns
          };
        }
        const history = Array.isArray(shiftListRaw) ? shiftListRaw
          .filter(item=> !currentShift || item.id !== currentShift.id)
          .map(entry=>{
            const sanitized = SHIFT_TABLE.createRecord({
              ...entry,
              totalsByType: entry.totalsByType || {},
              paymentsByMethod: entry.paymentsByMethod || {},
              countsByType: entry.countsByType || {},
              orders: Array.isArray(entry.orders) ? entry.orders : []
            });
            const summary = summarizeShiftOrders(summarySource, sanitized);
            return {
              ...sanitized,
              totalsByType: summary.totalsByType,
              paymentsByMethod: summary.paymentsByMethod,
              totalSales: summary.totalSales,
              orders: summary.orders,
              ordersCount: summary.ordersCount,
              countsByType: summary.countsByType,
              payments: summary.payments,
              refunds: summary.refunds,
              returns: summary.returns
            };
          }) : [];
        const activeOrders = Array.isArray(activeOrdersOnly) ? activeOrdersOnly.slice() : [];
        const stateSource = appRef && typeof appRef.getState === 'function'
          ? appRef.getState()
          : posState;
        const previousData = stateSource?.data || {};
        const nextData = {
          ...previousData,
          ordersQueue: activeOrders,
          ordersHistory: syncOrders ? historyOrders : previousData.ordersHistory,
          shift:{
            ...(previousData.shift || {}),
            current: currentShift,
            history
          },
          user:{
            ...(previousData.user || {}),
            shift: currentShift?.id || '—',
            shiftNo: currentShift?.id || previousData.user?.shiftNo || '—'
          },
          order:{
            ...(previousData.order || {}),
            shiftId: currentShift?.id || null
          },
          status:{
            ...(previousData.status || {}),
            indexeddb:{ state:'online', lastSync: Date.now() }
          }
        };
        const nextUi = {
          ...(stateSource?.ui || {}),
          shift:{
            ...(stateSource?.ui?.shift || {}),
            viewShiftId: focusCurrent && currentShift ? currentShift.id : (stateSource?.ui?.shift?.viewShiftId || currentShift?.id || null)
          }
        };
        posState.data = nextData;
        posState.ui = nextUi;
        if(appRef && typeof appRef.setState === 'function'){
          appRef.setState(prev=>({
            ...prev,
            data: nextData,
            ui: nextUi
          }));
        }
        return { current: currentShift, history, orders: historyOrders };
      } catch(error){
        console.warn('[Mishkah][POS] refreshPersistentSnapshot failed', error);
        return null;
      }
    }

    function getOrderTypeConfig(type){
      return ORDER_TYPES.find(o=> o.id === type) || ORDER_TYPES[0];
    }

    function normalizeSaveMode(value, orderType){
      const base = (value || '').toString().toLowerCase();
      switch(base){
        case 'save-only':
        case 'draft':
        case 'save-draft':
          return 'draft';
        case 'finalize-print':
        case 'finish-print':
          return 'finalize-print';
        case 'finalize':
        case 'finish':
          return 'finalize';
        case 'save-print':
          return orderType === 'dine_in' ? 'draft' : 'finalize-print';
        default:
          return base || 'draft';
      }
    }

    async function persistOrderFlow(ctx, rawMode, options={}){
      const state = ctx.getState();
      const t = getTexts(state);
      if(!posDB.available){
        UI.pushToast(ctx, { title:t.toast.indexeddb_missing, icon:'⚠️' });
        return { status:'error', reason:'indexeddb' };
      }
      const currentShift = state.data.shift?.current;
      if(!currentShift){
        UI.pushToast(ctx, { title:t.toast.shift_required, icon:'🔒' });
        ctx.setState(s=>({
          ...s,
          ui:{ ...(s.ui || {}), shift:{ ...(s.ui?.shift || {}), showPin:true, pin:'' } }
        }));
        return { status:'error', reason:'shift' };
      }
      const order = state.data.order || {};
      const previousOrderId = order.id;
      const orderType = order.type || 'dine_in';
      const mode = normalizeSaveMode(rawMode, orderType);
      const requiresPayment = mode === 'finalize' || mode === 'finalize-print';
      const finalize = requiresPayment;
      const openPrint = mode === 'finalize-print';
      const now = Date.now();
      const safeLines = (order.lines || []).map(line=>({
        ...line,
        locked:true,
        status: line.status || 'draft',
        notes: Array.isArray(line.notes) ? line.notes : (line.notes ? [line.notes] : []),
        discount: normalizeDiscount(line.discount),
        updatedAt: now
      }));
      const totals = calculateTotals(safeLines, state.data.settings || {}, orderType, { orderDiscount: order.discount });
      const paymentSplit = Array.isArray(state.data.payments?.split) ? state.data.payments.split : [];
      const normalizedPayments = paymentSplit.map(entry=>({
        id: entry.id || `pm-${Math.random().toString(36).slice(2,8)}`,
        method: entry.method || entry.id || state.data.payments?.activeMethod || 'cash',
        amount: round(Number(entry.amount) || 0)
      })).filter(entry=> entry.amount > 0);
      const paymentSummary = summarizePayments(totals, normalizedPayments);
      const outstanding = paymentSummary.remaining;
      if(requiresPayment && outstanding > 0 && !options.skipPaymentCheck){
        ctx.setState(s=>({
          ...s,
          ui:{
            ...(s.ui || {}),
            modals:{ ...(s.ui?.modals || {}), payments:true },
            paymentDraft:{ ...(s.ui?.paymentDraft || {}), amount: outstanding ? String(outstanding) : '', method: s.data.payments?.activeMethod || 'cash' },
            pendingAction:{ type:'finalize', mode, orderId: order.id, createdAt: now }
          }
        }));
        UI.pushToast(ctx, { title:t.ui.payments, message:t.ui.balance_due, icon:'💳' });
        return { status:'pending-payment', mode };
      }
      const typeConfig = getOrderTypeConfig(orderType);
      const status = finalize ? 'finalized' : (order.status || 'open');
      const finalizeStage = finalize
        ? (orderType === 'dine_in' ? 'closed' : 'delivered')
        : (order.fulfillmentStage || 'new');
      const allowAdditions = finalize ? false : !!typeConfig.allowsLineAdditions;
      const orderNotes = Array.isArray(order.notes) ? order.notes : (order.notes ? [order.notes] : []);
      let finalOrderId = previousOrderId;
      if(!order.isPersisted){
        try {
          finalOrderId = await allocateInvoiceId();
        } catch(allocError){
          console.warn('[Mishkah][POS] invoice allocation failed during save', allocError);
          UI.pushToast(ctx, { title:t.toast.indexeddb_error, message:String(allocError), icon:'🛑' });
          return { status:'error', reason:'invoice' };
        }
      }
      const idChanged = previousOrderId !== finalOrderId;
      const orderPayload = {
        ...order,
        id: finalOrderId,
        status,
        fulfillmentStage: finalizeStage,
        lines: safeLines,
        notes: orderNotes,
        updatedAt: now,
        savedAt: now,
        totals,
        payments: normalizedPayments,
        discount: normalizeDiscount(order.discount),
        shiftId: currentShift.id,
        posId: order.posId || POS_INFO.id,
        posLabel: order.posLabel || POS_INFO.label,
        posNumber: Number.isFinite(Number(order.posNumber)) ? Number(order.posNumber) : POS_INFO.number,
        isPersisted:true,
        dirty:false,
        paymentState: paymentSummary.state
      };
      if(finalize){
        orderPayload.finalizedAt = now;
        orderPayload.finishedAt = now;
      }
      const isDraftMode = mode === 'draft';
      const centralAvailable = !!(centralSync && typeof centralSync.publishCreateOrder === 'function');
      if(!isDraftMode && !centralAvailable){
        UI.pushToast(ctx, { title:t.toast.central_sync_blocked, message:t.toast.central_sync_offline, icon:'🛑' });
        return { status:'error', reason:'central-sync-unavailable' };
      }
      let orderSavingFlag = false;
      const setOrderSaving = (value)=>{
        ctx.setState(s=>({
          ...s,
          ui:{ ...(s.ui || {}), orderSaving: value }
        }));
      };
      const beginOrderSaving = ()=>{
        if(!orderSavingFlag){
          setOrderSaving(true);
          orderSavingFlag = true;
        }
      };
      const endOrderSaving = ()=>{
        if(orderSavingFlag){
          setOrderSaving(false);
          orderSavingFlag = false;
        }
      };
      beginOrderSaving();
      try{
      if(isDraftMode){
        if(posDB.available && typeof posDB.saveTempOrder === 'function'){
          await posDB.saveTempOrder({ ...orderPayload, isPersisted:false, dirty:true });
        }
        endOrderSaving();
        UI.pushToast(ctx, { title:t.toast.order_saved, icon:'💾' });
        return { status:'saved', mode };
      }

        let confirmedOrder = { ...orderPayload };
        if(centralAvailable){
          try{
            const ack = await centralSync.publishCreateOrder(orderPayload, {
              meta:{ mode, posId: POS_INFO.id, posLabel: POS_INFO.label }
            });
            if(ack && ack.order){
              confirmedOrder = { ...confirmedOrder, ...ack.order };
            }
            if(ack && ack.existing){
              UI.pushToast(ctx, { title:t.toast.order_saved, icon:'ℹ️' });
            }
          } catch(syncErr){
            console.warn('[Mishkah][POS] Failed to publish order to central sync.', syncErr);
            pushCentralDiagnostic({
              event:'sync:order:error',
              level:'error',
              message: syncErr?.message || 'Central sync publish failed.',
              error: syncErr,
              data:{ orderId: orderPayload.id, mode }
            });
            throw syncErr;
          }
        }

        const persistableOrder = { ...confirmedOrder };
        delete persistableOrder.dirty;
        if(posDB.available){
          if(typeof posDB.deleteTempOrder === 'function'){
            try { await posDB.deleteTempOrder(confirmedOrder.id); } catch(_tempErr){ }
            if(idChanged && previousOrderId){
              try { await posDB.deleteTempOrder(previousOrderId); } catch(_tempErr){}
            }
          }
          if(finalize && typeof posDB.clearTempOrder === 'function'){
            try { await posDB.clearTempOrder(); } catch(_tempErr){}
          }
        }
        let latestOrders = [];
        if(posDB.available && typeof posDB.listOrders === 'function'){
          try {
            latestOrders = await posDB.listOrders({ onlyActive:true });
          } catch(listErr){
            console.warn('[Mishkah][POS] Failed to read mirrored orders after publish.', listErr);
          }
        }
        const alreadyMirrored = latestOrders.some(entry=> entry && entry.id === confirmedOrder.id);
        const displayOrder = { ...persistableOrder, dirty:false, isPersisted:true };
        if(!alreadyMirrored){
          latestOrders = [...latestOrders, displayOrder];
        } else {
          latestOrders = latestOrders.map((entry)=> (
            entry && entry.id === displayOrder.id ? { ...entry, ...displayOrder } : entry
          ));
        }
        ctx.setState(s=>{
          const data = s.data || {};
          const history = Array.isArray(data.ordersHistory) ? data.ordersHistory.slice() : [];
          let seqFromDraft = null;
          if(idChanged && previousOrderId){
            const draftIndex = history.findIndex(entry=> entry && entry.id === previousOrderId);
            if(draftIndex >= 0){
              seqFromDraft = history[draftIndex].seq || draftIndex + 1;
              history.splice(draftIndex, 1);
            }
          }
          const historyIndex = history.findIndex(entry=> entry.id === confirmedOrder.id);
          const seq = historyIndex >= 0
            ? (history[historyIndex].seq || historyIndex + 1)
            : (seqFromDraft || history.length + 1);
          const historyEntry = { ...confirmedOrder, seq, payments: confirmedOrder.payments.map(pay=> ({ ...pay })) };
          if(historyIndex >= 0){
            history[historyIndex] = historyEntry;
          } else {
            history.push(historyEntry);
          }
          let nextShift = data.shift?.current ? { ...data.shift.current } : null;
          if(nextShift){
            const summary = summarizeShiftOrders(history, { ...nextShift, orders: Array.isArray(nextShift.orders) ? nextShift.orders.slice() : [] });
            nextShift = {
              ...nextShift,
              totalsByType: summary.totalsByType,
              paymentsByMethod: summary.paymentsByMethod,
              totalSales: summary.totalSales,
              orders: summary.orders,
              countsByType: summary.countsByType,
              ordersCount: summary.ordersCount,
              closingCash: round((nextShift.openingFloat || 0) + (summary.paymentsByMethod.cash || 0))
            };
          }
          const uiBase = s.ui || {};
          const modals = { ...(uiBase.modals || {}) };
          if(openPrint){
            modals.print = true;
          }
          const nextUi = {
            ...uiBase,
            modals,
            paymentDraft:{ ...(uiBase.paymentDraft || {}), amount:'' },
            pendingAction:null
          };
          if(openPrint){
            nextUi.print = { ...(uiBase.print || {}), docType: data.print?.docType || 'customer', size: data.print?.size || 'thermal_80' };
          }
          return {
            ...s,
            data:{
              ...data,
              order:{
                ...confirmedOrder,
                allowAdditions,
                lockLineEdits:true
              },
              tableLocks: idChanged
                ? (data.tableLocks || []).map(lock=> lock.orderId === previousOrderId ? { ...lock, orderId: confirmedOrder.id } : lock)
                : data.tableLocks,
              ordersQueue: latestOrders,
              ordersHistory: history,
              payments:{ ...(data.payments || {}), split:[] },
              shift:{ ...(data.shift || {}), current: nextShift },
              status:{
                ...data.status,
                indexeddb:{ state:'online', lastSync: now }
              }
            },
            ui: nextUi
          };
        });
        await refreshPersistentSnapshot({ focusCurrent:true, syncOrders:true });
        const toastKey = finalize ? 'order_finalized' : 'order_saved';
        UI.pushToast(ctx, { title:t.toast[toastKey], icon: finalize ? '✅' : '💾' });
        return { status:'saved', mode, order: confirmedOrder };
      } catch(error){
        const errorCode = error && typeof error.code === 'string' ? error.code : '';
        if(errorCode && errorCode.startsWith('POS_SYNC')){
          UI.pushToast(ctx, { title:t.toast.central_sync_blocked, message:t.toast.central_sync_offline, icon:'🛑' });
          ctx.setState(s=>({
            ...s,
            data:{
              ...s.data,
              status:{
                ...s.data.status,
                central:{
                  ...(s.data.status?.central || {}),
                  state:'offline',
                  lastSync: s.data.status?.central?.lastSync || null
                }
              }
            }
          }));
          return { status:'error', reason:'central-sync', error };
        }
        UI.pushToast(ctx, { title:t.toast.indexeddb_error, message:String(error), icon:'🛑' });
        ctx.setState(s=>({
          ...s,
          data:{
            ...s.data,
            status:{
              ...s.data.status,
              indexeddb:{ state:'offline', lastSync: s.data.status?.indexeddb?.lastSync || null }
            }
          }
        }));
        return { status:'error', reason:'persist', error };
      } finally {
        endOrderSaving();
      }
    }

    function statusBadge(db, state, label, options={}){
      const t = getTexts(db);
      const tone = state === 'online' ? 'status/online' : state === 'offline' ? 'status/offline' : 'status/idle';
      const stateText = state === 'online' ? t.ui.status_online : state === 'offline' ? t.ui.status_offline : t.ui.status_idle;
      const extraAttrs = options.attrs || {};
      const baseClass = tw`${token(tone)} text-xs`;
      const finalClass = extraAttrs.class ? `${baseClass} ${extraAttrs.class}` : baseClass;
      return UI.Badge({
        variant: options.variant || 'badge/status',
        attrs:{ ...extraAttrs, class: finalClass },
        leading: options.leading !== undefined ? options.leading : (state === 'online' ? '●' : state === 'offline' ? '✖' : '…'),
        text: options.text || `${label} • ${stateText}`,
        trailing: options.trailing
      });
    }


    Object.assign(posModuleScope, {
      getTexts,
      localize,
      getCurrency,
      getCurrencySymbol,
      getLocale,
      formatDateTime,
      calculateTotals,
      createOrderLine,
      filterMenu,
      computeRealtimeReports,
      findCustomer,
      findCustomerAddress,
      createEmptyCustomerForm,
      PAYMENT_METHODS,
      POS_INFO,
      CAIRO_DISTRICTS,
      SHIFT_OPEN_FLOAT_DEFAULT,
      SHIFT_PIN_LENGTH,
      SHIFT_PIN_FALLBACK,
      SHIFT_TABLE
    });
    if(globalThis.MishkahPOSChunks?.components){
      globalThis.MishkahPOSChunks.components(posModuleScope);
    }
    const posComponents = posModuleScope.components || {};
    const {
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
    } = posComponents;
    Mishkah.app.setBody(function(db){
      return UI.AppRoot({
        shell: D.Containers.Div({ attrs:{ class: tw`pos-shell flex h-full min-h-0 flex-col overflow-hidden bg-[var(--background)] text-[var(--foreground)]` }}, [
          Header(db),
          D.Containers.Main({ attrs:{ class: tw`flex-1 min-h-0 w-full grid gap-4 px-4 pb-3 pt-3 lg:grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)] overflow-hidden` }}, [
            MenuColumn(db),
            OrderColumn(db)
          ]),
          FooterBar(db)
        ]),
        overlays:[
          SettingsDrawer(db),
          CustomersModal(db),
          ShiftPinDialog(db),
          ShiftSummaryModal(db),
          TablesModal(db),
          ReservationsModal(db),
          PrintModal(db),
          LineModifiersModal(db),
          PaymentsSheet(db),
          ReportsDrawer(db),
          OrdersQueueModal(db),
          OrdersJobStatusModal(db),
          DiagnosticsModal(db),
          db.ui?.toasts ? UI.ToastHost({ toasts: db.ui.toasts }) : null
        ].filter(Boolean)
      });
    });

    const app = M.app.createApp(posState, {});
    appRef = app;
    flushPendingKdsMessages();
    if(pendingRemoteResult){
      flushRemoteUpdate();
    }
    centralStatusHandler = (status={})=>{
      const patch = {
        state: status.state || 'offline',
        lastSync: status.lastSync || null,
        version: Number(status.version || 0),
        endpoint: status.endpoint || posSyncWsEndpoint || null
      };
      if(app && typeof app.setState === 'function'){
        app.setState(prev=>({
          ...prev,
          data:{
            ...(prev.data || {}),
            status:{
              ...(prev.data?.status || {}),
              central: patch
            }
          }
        }));
      } else {
        posState.data = {
          ...(posState.data || {}),
          status:{
            ...(posState.data?.status || {}),
            central: patch
          }
        };
      }
    };
    centralStatusHandler(centralSyncStatus);
    const syncCentralDiagnostics = ()=>{
      const latest = centralDiagnosticsStore.getEntries();
      const payload = {
        entries: latest,
        lastEvent: latest.length ? latest[latest.length - 1] : null
      };
      if(app && typeof app.setState === 'function'){
        app.setState(prev=>({
          ...prev,
          data:{
            ...(prev.data || {}),
            diagnostics:{
              ...(prev.data?.diagnostics || {}),
              central: payload
            }
          }
        }));
      } else {
        posState.data = {
          ...(posState.data || {}),
          diagnostics:{
            ...(posState.data?.diagnostics || {}),
            central: payload
          }
        };
      }
    };
    syncCentralDiagnostics();
    centralDiagnosticsStore.subscribe(()=>{ syncCentralDiagnostics(); });
    const POS_DEV_TOOLS = {
      async resetIndexedDB(){
        if(!posDB.available || typeof posDB.resetAll !== 'function'){
          return false;
        }
        await posDB.resetAll();
        invoiceSequence = 0;
        await refreshPersistentSnapshot({ focusCurrent:false, syncOrders:true });
        return true;
      },
      async refresh(){
        return refreshPersistentSnapshot({ focusCurrent:true, syncOrders:true });
      },
      schema:{
        registry: POS_SCHEMA_REGISTRY,
        toJSON(){ return POS_SCHEMA_REGISTRY.toJSON(); },
        generateSQL(options){ return POS_SCHEMA_REGISTRY.generateSQL(options || {}); }
      },
      diagnostics:{
        entries(){ return centralDiagnosticsStore.getEntries(); },
        clear(){ clearCentralDiagnostics(); },
        push(entry){ return pushCentralDiagnostic(entry); }
      }
    };
    Object.defineProperty(window, '__MishkahPOSDev__', {
      value: POS_DEV_TOOLS,
      configurable:true,
      enumerable:false,
      writable:false
    });
    const auto = U.twcss.auto(posState, app, { pageScaffold:true });


    Object.assign(posModuleScope, {
      preferencesStore,
      applyThemePreferenceStyles,
      refreshPersistentSnapshot,
      posDB,
      kdsBridge,
      getTexts,
      localize,
      getCurrency,
      getCurrencySymbol,
      getLocale,
      getOrderTypeConfig,
      PAYMENT_METHODS,
      ORDER_TYPES,
      POS_INFO,
      CAIRO_DISTRICTS,
      SHIFT_OPEN_FLOAT_DEFAULT,
      SHIFT_PIN_LENGTH,
      SHIFT_PIN_FALLBACK
    });
    if(globalThis.MishkahPOSChunks?.orders){
      globalThis.MishkahPOSChunks.orders(posModuleScope);
    }
    const posOrders = posModuleScope.orders || {};
    app.setOrders(Object.assign({}, UI.orders, auto.orders, posOrders));
    app.mount('#app');
    if(posDB.available){
      await refreshPersistentSnapshot({ focusCurrent:true, syncOrders:true });
    }
  })();
