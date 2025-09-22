
// mishkah-core-v5-1.js
(function (window) {
  const perf = (typeof performance !== "undefined" && performance) || { now: Date.now, mark() {}, measure() {} };
  const now = () => perf.now();
  const asArray = v => v == null ? [] : Array.isArray(v) ? v : String(v).split(",").map(s => s.trim()).filter(Boolean);

  function createRing(cap = 500) {
    const b = [];
    return { push(x){ if(b.length===cap) b.shift(); b.push(x) }, tail(n=cap){ return b.slice(-n) }, size(){ return b.length } };
  }

  function createTruth(initial) {
    let state = initial;
    const subs = new Set();
    let batching = 0, scheduled = false;
    const dirty = new Map();
    const frozen = new Set();
    let keys = () => [];
    function get(){ return state }
    function set(p){ const next = typeof p==="function" ? p(state) : p; if(next!==state){ state=next; if(!batching) schedule() } }
    function mark(k){ if(!k||frozen.has(k)) return; const cur=dirty.get(k); dirty.set(k, cur==="rebuild"?"rebuild":"patch"); if(!batching) schedule() }
    function rebuild(k){ if(!k||frozen.has(k)) return; dirty.set(k,"rebuild"); if(!batching) schedule() }
    function rebuildAll(f=(k)=>true){ for(const k of keys()) if(!frozen.has(k)&&f(k)) dirty.set(k,"rebuild"); if(!batching) schedule() }
    function rebuildAllExcept(excepts){ const s=new Set(asArray(excepts)); rebuildAll(k=>!s.has(k)) }
    function batch(fn){ batching++; try{ fn() } finally{ batching--; if(!batching) schedule() } }
    function freeze(k){ if(k) frozen.add(k) }
    function unfreeze(k){ if(k) frozen.delete(k) }
    function subscribe(fn){ subs.add(fn); fn({ state, dirty:new Map(), frozen:new Set(frozen) }); return ()=>subs.delete(fn) }
    function takeDirty(){ const m=new Map(dirty); dirty.clear(); return m }
    function schedule(){ if(scheduled) return; scheduled=true; queueMicrotask(()=>{ scheduled=false; const d=takeDirty(); for(const s of subs) s({ state, dirty:d, frozen:new Set(frozen) }) }) }
    function bindKeysProvider(fn){ keys = fn || (()=>[]) }
    return { get,set,mark,rebuild,rebuildAll,rebuildAllExcept,batch,freeze,unfreeze,subscribe,bindKeysProvider,takeDirty };
  }

  function createRegistry(){
    const components=new Map(), vbook=new Map(); let uid=0;
    function id(){ return "__c_"+(++uid) }
    function registerComponent(name,factory,opt={}){ if(components.has(name)) throw new Error("component already registered: "+name); components.set(name,{ factory, schema:opt.schema||{}, defaults:opt.defaults||{} }) }
    function createVNode(name,props={},parent=null){
      if(!components.has(name)) throw new Error("component not registered: "+name);
      const meta=components.get(name); const vid=id();
      vbook.set(vid,{ id:vid,name, props:Object.assign({},meta.defaults,props), parent, children:[], lifecycle:"declared", createdAt:now(), updatedAt:now(), metrics:{ renders:0,lastRender:0,totalRenderMs:0,rebuilds:0,violations:0 }, logs:createRing(200) });
      return vid;
    }
    function attachChild(p,c){ const P=vbook.get(p), C=vbook.get(c); if(!P||!C) return; P.children.push(c); C.parent=p }
    function getVNode(id){ return vbook.get(id) }
    function allKeys(){ return Array.from(vbook.keys()) }
    return { registerComponent, createVNode, attachChild, getVNode, allKeys, vbook };
  }

  const LIFECYCLE=["declared","molecular","tissue","assemble","born","child","adult","retire","dead"];
  function createLifecycle(){
    function toNext(e){ const i=LIFECYCLE.indexOf(e.lifecycle); if(i<0||i>=LIFECYCLE.length-1) return e.lifecycle; e.lifecycle=LIFECYCLE[i+1]; e.updatedAt=now(); e.logs.push({ ts:now(), ev:"lifecycle", to:e.lifecycle }); return e.lifecycle }
    function set(e,s){ if(LIFECYCLE.indexOf(s)<0) throw new Error("bad lifecycle state"); e.lifecycle=s; e.updatedAt=now(); e.logs.push({ ts:now(), ev:"lifecycle", to:s }) }
    return { toNext,set,LIFECYCLE };
  }

  function createGuardian(){
    const rules=[]; let mode="warn";
    function addRule(n,fn){ rules.push({ name:n, fn }) }
    function setMode(m){ mode = m==="strict" ? "strict" : "warn" }
    function validate(entry){
      const errs=[];
      for(const r of rules){
        try{
          const res=r.fn(entry);
          if(res===true) continue;
          if(res===false) errs.push({ rule:r.name, msg:"violation" });
          else if(res&&res.violation) errs.push({ rule:r.name, msg:res.msg||"violation", meta:res.meta });
        }catch(e){ errs.push({ rule:r.name, msg:String(e) }) }
      }
      if(mode==="strict" && errs.length) throw Object.assign(new Error("policy violation"),{ violations:errs });
      return errs;
    }
    return { addRule, validate, setMode, getMode:()=>mode };
  }

  function defaultRules(g){
    g.addRule("select-max-options",(e)=>{
      if(e.name==="Select"||e.props?.component==="Select"){ const max=e.props?.maxOptions??200; const n=e.props?.options?e.props.options.length:0; if(n>max) return { violation:true, msg:`too many options ${n}>${max}`, meta:{ opts:n, max } } }
      return true;
    });
    g.addRule("input-maxlength",(e)=>{
      if(e.name==="Input"||e.props?.component==="Input"){ const limit=e.props?.maxlength??1000; const found=e.props?.maxLength; if(found&&found>limit) return { violation:true, msg:"maxlength too large", meta:{ found, limit } } }
      return true;
    });
  }


function addPerformancePolicy(g, defaults = {}) {
  const DEF = { maxMs: 32, avgMs: null, mode: 'last' }; // 'last' | 'avg' | 'either'
  const conf = Object.assign({}, DEF, defaults || {});

  g.addRule('max-commit-ms', (entry) => {
    const m = entry.metrics || {};
    const last = +m.lastMs || 0;
    const avg  = +m.avgMs  || 0;
    const budget = m.budget || {};
    const maxMs = Number.isFinite(budget.maxMs) ? budget.maxMs :
                  Number.isFinite(conf.maxMs)   ? conf.maxMs   : null;
    const avgMs = Number.isFinite(budget.avgMs) ? budget.avgMs :
                  Number.isFinite(conf.avgMs)   ? conf.avgMs   : null;
    const mode = (budget.mode || conf.mode || 'last');

    let bad = false, reason = '';
    if (mode === 'last' && maxMs != null) {
      bad = last > maxMs; if (bad) reason = `last ${last.toFixed(2)}ms > ${maxMs}ms`;
    } else if (mode === 'avg' && avgMs != null) {
      bad = avg > avgMs;  if (bad) reason = `avg ${avg.toFixed(2)}ms > ${avgMs}ms`;
    } else if (mode === 'either') {
      const badLast = maxMs != null && last > maxMs;
      const badAvg  = avgMs != null && avg  > avgMs;
      bad = badLast || badAvg;
      if (bad) reason = `last ${last.toFixed(2)}ms/${maxMs}ms, avg ${avg.toFixed(2)}ms/${avgMs}ms`;
    }

    if (bad) {
      return {
        violation: true,
        msg: 'commit too slow',
        meta: { region: entry.name, lastMs: last, avgMs: avg, budget: { maxMs, avgMs, mode } }
      };
    }
    return true;
  });
}

  function preserveFocus(root){
    const ae=document.activeElement; if(!ae||!root.contains(ae)) return ()=>{};
    const info={ id:ae.id||null, name:ae.getAttribute("name")||null, selStart:("selectionStart" in ae)?ae.selectionStart:null, selEnd:("selectionEnd" in ae)?ae.selectionEnd:null };
    return ()=>{
      let t=null;
      if(info.id) t=root.querySelector("#"+(CSS&&CSS.escape?CSS.escape(info.id):info.id));
      if(!t&&info.name) t=root.querySelector(`[name="${(CSS&&CSS.escape?CSS.escape(info.name):info.name)}"]`);
      if(t){ try{ t.focus(); if(info.selStart!=null&&info.selEnd!=null&&"setSelectionRange" in t) t.setSelectionRange(info.selStart, info.selEnd) }catch(_){} }
    };
  }

  function postSync(root){
    root.querySelectorAll("select").forEach(sel=>{
      const raw=sel.getAttribute("data-value")??sel.getAttribute("value");
      if(raw==null) return;
      if(sel.multiple){
        const arr=Array.isArray(raw)?raw:String(raw).split(",").map(s=>s.trim());
        const set=new Set(arr.map(String)); Array.from(sel.options).forEach(o=>o.selected=set.has(o.value));
      }else{
        sel.value=raw;
        if(sel.value!==String(raw)){ const opt=Array.from(sel.options).find(o=>o.value===String(raw)); if(opt) sel.value=opt.value; }
      }
    });

 root.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = cb.hasAttribute('checked'));
 root.querySelectorAll('input[type="radio"]').forEach(r => r.checked = r.hasAttribute('checked'));

  }

  function createAuditor(){
    const log=createRing(1500), regionStats=new Map();
    function ensure(k){ if(!regionStats.has(k)) regionStats.set(k,{ commits:0,lastMs:0,avgMs:0,slowCount:0,errors:0,violations:0,priority:"normal",frozen:false }); return regionStats.get(k) }
    function logLocal(entry,msg,meta){ const rec={ ts:now(), id:entry.id||entry.uKey||"region", name:entry.name||entry.uKey||"region", msg, meta }; if(entry.logs&&entry.logs.push) entry.logs.push(rec); log.push(rec) }
    function onCommit(k,ms,p){ const st=ensure(k); st.commits++; st.lastMs=ms; st.avgMs=st.avgMs?(st.avgMs*0.9+ms*0.1):ms;
 const globalMax = 32; // fallback
const budgetMax = (window.__MISHKAH_PERF_MAX__ || globalMax);
 if (ms > budgetMax) st.slowCount++;

	
	if(p) st.priority=p }
    function onViolation(k,n=1){ ensure(k).violations+=n }
    function onError(k){ ensure(k).errors++ }
    function snapshot(){ const out={ regions:{}, log:log.tail(300) }; for(const [k,v] of regionStats) out.regions[k]=Object.assign({},v); return out }
    return { logLocal,onCommit,onViolation,onError,snapshot,regionStats };
  }

  function createAttrDelegator(U){
    const toArr=v=>v==null?[]:Array.isArray(v)?v:String(v).trim().split(/\s+/).filter(Boolean);
    const EVT=[
      ['click','onclick',{}],
      ['change','onchange',{}],
      ['input','oninput',{}],
      ['submit','onsubmit',{ preventDefault:true }],
      ['keydown','onkeydown',{}],
      ['keyup','onkeyup',{}],
      ['pointerdown','onpointerdown',{}],
      ['pointerup','onpointerup',{}],
      ['focus','onfocus',{ capture:true }],
      ['blur','onblur',{ capture:true }]
    ];
    function useUtilsDelegate(root,type,sel,handler,extra){
      return U&&U.delegate ? U.delegate(root,type,sel,(e,el)=>handler(e,el),{ capture:!!extra.capture, passive:!!extra.passive, prevent:!!extra.preventDefault }) : null;
    }
    function useFallback(root,type,sel,handler,extra){
      const listener=(e)=>{ const el=e.target&&e.target.closest?e.target.closest(sel):null; if(!el||!root.contains(el)) return; if(extra.preventDefault) e.preventDefault(); handler(e,el) };
      root.addEventListener(type,listener,{ capture:!!extra.capture, passive:!!extra.passive });
      return ()=>root.removeEventListener(type,listener,{ capture:!!extra.capture });
    }
    return function attach(root,dispatch,options={}){
      const attrPrefix=options.attrPrefix||'data-';
      const only=toArr(options.only);
      const offs=[];
      const events=only.length?EVT.filter(([t])=>only.includes(t)):EVT;
      for(const [type,attr,extra] of events){
        const dataAttr=`${attrPrefix}${attr}`;
        const sel=`[${dataAttr}]`;
        const handler=(e,el)=>{ const name=el.getAttribute(dataAttr); if(!name) return; dispatch(name,e,el) };
        const off = useUtilsDelegate(root,type,sel,handler,extra) || useFallback(root,type,sel,handler,extra);
        offs.push(off);
      }
      return ()=>{ for(const off of offs) try{ off&&off() }catch(_){} };
    };
  }

  function createEnv(opts={}){
    const rtl=new Set(["ar","fa","he","ur","ps","sd","ug"]);
    const persist=!!opts.persist; const storeKey=opts.storeKey||"mishkah.env"; const tokens=opts.tokens||{}; const dictionaries=opts.dictionaries||{};
    function load(){ try{ const raw=localStorage.getItem(storeKey); return raw?JSON.parse(raw):null }catch(_){ return null } }
    const saved=persist?load():null;
    let state={ locale:opts.locale||"en", dir:opts.dir||"auto", theme:opts.theme||"auto" };
    if(saved) state=Object.assign(state,saved);
    let styleEl=null, media=null; const listeners=new Set();
    function isRTLForLocale(loc){ const code=String(loc||"").toLowerCase(); const base=code.split("-")[0]; return rtl.has(base) }
    function resolvedDir(){ return state.dir==="auto" ? (isRTLForLocale(state.locale)?"rtl":"ltr") : state.dir }
    function resolvedTheme(){ if(state.theme!=="auto") return state.theme; if(typeof matchMedia==="undefined") return "light"; return matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light" }
    function tokensCSS(){ const make=(sel,obj)=> sel+"{"+Object.entries(obj||{}).map(([k,v])=>`${k}:${String(v)};`).join("")+"}"; const l=tokens.light||tokens.default||{}; const d=tokens.dark||{}; return [make(':root[data-theme="light"]',l), make(':root[data-theme="dark"]',d)].join("") }
    function applyTokens(){ if(!tokens||!Object.keys(tokens).length) return; if(!styleEl){ styleEl=document.getElementById("mishkah-theme"); if(!styleEl){ styleEl=document.createElement("style"); styleEl.id="mishkah-theme"; document.head.appendChild(styleEl) } } styleEl.textContent=tokensCSS() }
    function applyToDOM(){
      const root=document.documentElement; if(!root) return;
      const d=resolvedDir(), th=resolvedTheme();
      root.setAttribute("dir",d); root.setAttribute("lang",state.locale); root.setAttribute("data-theme",th);
      root.classList.toggle("dark", th==="dark");
      root.classList.toggle("rtl", d==="rtl"); root.classList.toggle("ltr", d==="ltr");
      root.classList.toggle("theme-dark", th==="dark"); root.classList.toggle("theme-light", th==="light");
      applyTokens();
    }
    function mediaListener(){ applyToDOM(); notify() }
    function setupMedia(){ if(typeof matchMedia==="undefined") return; if(media){ try{ media.removeEventListener("change",mediaListener) }catch(_){} } if(state.theme==="auto"){ media=matchMedia("(prefers-color-scheme: dark)"); try{ media.addEventListener("change",mediaListener) }catch(_){} } else { media=null } }
    function persistNow(){ if(!persist) return; try{ localStorage.setItem(storeKey, JSON.stringify(state)) }catch(_){} }
    function notify(){ listeners.forEach(fn=>fn(get())) }
    function get(){ return { ...state, resolved:{ dir:resolvedDir(), theme:resolvedTheme() } } }
    function setLocale(loc){ state.locale=loc; persistNow(); applyToDOM(); notify() }
    function setDir(d){ state.dir=d; persistNow(); applyToDOM(); notify() }
    function setTheme(t){ state.theme=t; setupMedia(); persistNow(); applyToDOM(); notify() }
    function toggleTheme(){ setTheme(resolvedTheme()==="dark"?"light":"dark") }
    function toggleDir(){ setDir(resolvedDir()==="rtl"?"ltr":"rtl") }
    function subscribe(cb){ listeners.add(cb); return ()=>listeners.delete(cb) }
    const prCache=new Map();
    function pickPlural(loc,n){ const key=String(loc||"en"); let pr=prCache.get(key); if(!pr){ pr=new Intl.PluralRules(key); prCache.set(key,pr) } return pr.select(n) }
    function getChain(loc){ const base=String(loc||"en").split("-")[0]; const chain=[loc,base,"en"]; return Array.from(new Set(chain)) }
    function pickDict(chain){ for(const l of chain) if(dictionaries[l]) return { lang:l, dict:dictionaries[l] }; const first=Object.keys(dictionaries)[0]; return { lang:first, dict:(dictionaries[first]||{}) } }
    function getPath(obj,path){ const ks=String(path).split("."); let cur=obj; for(const k of ks){ if(cur&&typeof cur==="object"&&k in cur) cur=cur[k]; else return undefined } return cur }
    function interpolate(s,vars){ if(vars==null) return s; return String(s).replace(/\{(\w+)\}/g,(_,k)=>(k in vars?String(vars[k]):`{${k}}`)) }
    function translate(key,vars){
      const chain=getChain(state.locale); const { lang, dict }=pickDict(chain); const count=vars && typeof vars.count==="number" ? vars.count : null;
      if(count!=null){ const rule=pickPlural(lang,count); const base=getPath(dict,key); if(base&&typeof base==="object"){ const form=base[rule]??base.other; if(form!=null) return interpolate(form,vars) } }
      const val=getPath(dict,key); if(val==null) return String(key); if(typeof val==="string") return interpolate(val,vars); return String(key);
    }
    function fmtNumber(n,options){ return new Intl.NumberFormat(state.locale,options).format(n) }
    function fmtCurrency(n,currency="USD",options={}){ return new Intl.NumberFormat(state.locale,{ style:"currency", currency, ...options }).format(n) }
    function fmtDate(d,options){ const dt=d instanceof Date?d:new Date(d); return new Intl.DateTimeFormat(state.locale,options).format(dt) }
    function fmtTime(d,options){ const dt=d instanceof Date?d:new Date(d); return new Intl.DateTimeFormat(state.locale,{ hour:"numeric", minute:"numeric", ...options }).format(dt) }
    applyToDOM(); setupMedia();
    return { get,setLocale,setDir,setTheme,toggleTheme,toggleDir,subscribe, isDark:()=>resolvedTheme()==="dark", isRTL:()=>resolvedDir()==="rtl", resolvedDir,resolvedTheme, tokens, i18n:{ t:translate, fmt:{ number:fmtNumber, currency:fmtCurrency, date:fmtDate, time:fmtTime } } };
  }

  function createEngine(registry,guardian,lifecycle,auditor,truth){
    const mounts=new Map(), regionBook=new Map(), mountedOnce=new Set();
    function mountOf(h){ return typeof h==="string" ? document.querySelector(h) : h }
    function registerRegion(uKey,mount,buildFn,parentKey=null,options={}){
	  
	  mounts.set(uKey, {
   mount, buildFn, parent: parentKey,
   priority: options.priority || "normal",
   budget: options.budget || null, // 👈 ميزانية أداء اختيارية لكل منطقة
   hooks: {
     onMounted: options.onMounted || null,
     onUnmounted: options.onUnmounted || null,
    onBeforeUpdate: options.onBeforeUpdate || null,
     onAfterUpdate: options.onAfterUpdate || null
   }
 });
      if(!regionBook.has(uKey)) regionBook.set(uKey, createRing(300));
    }
    function unregisterRegion(uKey,{ callHook=true, detach=false }={}){
      const meta=mounts.get(uKey); if(!meta) return false;
      const slot=mountOf(meta.mount);
      if(callHook && meta.hooks?.onUnmounted && slot){ try{ meta.hooks.onUnmounted({ uKey, el:slot }) }catch(e){ auditor.logLocal({ uKey,name:uKey,logs:regionBook.get(uKey) },"hook:onUnmounted:error",{ error:String(e) }) } }
      if(detach && slot){ slot.replaceChildren() }
      mounts.delete(uKey); regionBook.delete(uKey); mountedOnce.delete(uKey); return true;
    }
    function subtreeKeys(rootKey){
      const out=new Set([rootKey]); let changed=true;
      while(changed){ changed=false; for(const [k,r] of mounts){ if(out.has(r.parent)&&!out.has(k)){ out.add(k); changed=true } } }
      return out;
    }
    function unregisterSubtree(rootKey,opts){ const keys=Array.from(subtreeKeys(rootKey)); for(const k of keys) unregisterRegion(k,opts) }
    function remountRegion(uKey){ if(!mounts.has(uKey)) return false; mountedOnce.delete(uKey); truth.mark(uKey); return true }
    function pWeight(p){ if(typeof p==="number") return p; if(p==="high") return 3; if(p==="low") return 1; return 2 }
    function commit(state,dirtyMap,frozenSet){
      if(!dirtyMap||dirtyMap.size===0) return;
      const items=[];
      for(const [uKey,mode] of dirtyMap){ const meta=mounts.get(uKey); if(!meta) continue; if(frozenSet&&frozenSet.has(uKey)) continue; items.push({ uKey, mode, meta }) }
      items.sort((a,b)=> pWeight(b.meta.priority)-pWeight(a.meta.priority));
      for(const it of items){
        const { uKey, meta, mode } = it; const slot=mountOf(meta.mount); if(!slot) continue;
        const restore=preserveFocus(slot); const hooks=meta.hooks||{}; const first=!mountedOnce.has(uKey); const isUpdate=mountedOnce.has(uKey); const mA="mark-"+uKey, mB="measure-"+uKey;
        try{ perf.mark&&perf.mark(mA) }catch(_){}
        try{
          if(isUpdate && typeof hooks.onBeforeUpdate==="function"){ try{ hooks.onBeforeUpdate({ uKey, state }) }catch(e){ auditor.logLocal({ uKey,name:uKey,logs:regionBook.get(uKey) },"hook:onBeforeUpdate:error",{ error:String(e) }) } }
          let out;
          try{ out = meta.buildFn(state,{ registry,guardian,lifecycle,auditor,truth,uKey }) }catch(err){
            auditor.onError(uKey); auditor.logLocal({ uKey,name:uKey,logs:regionBook.get(uKey) },"build:error",{ error:String(err.stack||err) });
            
            // Enhanced error message with stack trace and context
            const errorMsg = err.message || String(err);
            const stackTrace = err.stack || '';
            const lineMatch = stackTrace.match(/at.*:(\d+):(\d+)/);
            const location = lineMatch ? ` (Line: ${lineMatch[1]})` : '';
            
            console.group(`🚨 Mishkah Region Build Error: "${uKey}"`);
            console.error('Error Message:', errorMsg);
            console.error('Stack Trace:', stackTrace);
            console.error('Region State:', state);
            console.error('Build Function:', meta.buildFn.toString().substring(0, 200) + '...');
            console.groupEnd();
            
            out = `<div class="mishkah-error" style="color:#b91c1c;background:#fee2e2;padding:12px;border-radius:8px;font-family:monospace;border:2px solid #dc2626;margin:4px">
              <div style="font-weight:bold;margin-bottom:8px">🚨 Region "${uKey}" build failed${location}</div>
              <div style="font-size:14px;margin-bottom:4px;color:#7f1d1d">Error: ${errorMsg}</div>
              <details style="margin-top:8px">
                <summary style="cursor:pointer;color:#991b1b">Stack Trace (click to expand)</summary>
                <pre style="background:#fef2f2;padding:8px;border-radius:4px;overflow-x:auto;font-size:12px;margin:4px 0">${stackTrace}</pre>
              </details>
            </div>`;
          }
          const t0=now();
          if(typeof out==="string") slot.innerHTML=out;
          else if(out instanceof Node) slot.replaceChildren(out);
          
          // ✅ الإضافة الجديدة: التحقق من كائن Atoms وتحويله تلقائيًا
          else if (out && typeof out === 'object' && out.__A && window.Mishkah.Atoms.toNode) {
            slot.replaceChildren(window.Mishkah.Atoms.toNode(out));
          }
          
          else if(Array.isArray(out)){ const f=document.createDocumentFragment(); out.forEach(n=>f.appendChild(n instanceof Node ? n : document.createTextNode(String(n)))); slot.replaceChildren(f) }
          else slot.innerHTML="";
          postSync(slot);
          const ms=now()-t0; auditor.onCommit(uKey,ms,meta.priority); regionBook.get(uKey).push({ ts:now(), ev:"commit", uKey, ms, mode });
          if(first){ mountedOnce.add(uKey); if(typeof hooks.onMounted==="function"){ try{ hooks.onMounted({ uKey,state,el:slot }) }catch(e){ auditor.logLocal({ uKey,name:uKey,logs:regionBook.get(uKey) },"hook:onMounted:error",{ error:String(e) }) } } }
          else { if(typeof hooks.onAfterUpdate==="function"){ try{ hooks.onAfterUpdate({ uKey,state,el:slot }) }catch(e){ auditor.logLocal({ uKey,name:uKey,logs:regionBook.get(uKey) },"hook:onAfterUpdate:error",{ error:String(e) }) } } }
          try{
 const st = auditor.regionStats.get(uKey);
 const vs = guardian.validate({
   name: uKey,
   props: {},
   logs: regionBook.get(uKey),
   metrics: {
     lastMs: ms,
     avgMs:  st?.avgMs     || 0,
     commits: st?.commits  || 0,
     slowCount: st?.slowCount || 0,
     budget: meta.budget || {} // 👈 ميزانية المنطقة (إن وُجدت)
  }
 });            if(vs.length){ auditor.onViolation(uKey,vs.length); vs.forEach(v=>regionBook.get(uKey).push({ ts:now(), ev:"policy", uKey, v })) }
          }catch(e){ auditor.logLocal({ uKey,name:uKey,logs:regionBook.get(uKey) },"policy:strict:error",{ error:String(e) }) }
          restore();
        } finally { try{ perf.mark&&perf.mark(mB); perf.measure&&perf.measure("commit:"+uKey,mA,mB) }catch(_){} }
      }
    }
    return { registerRegion, unregisterRegion, unregisterSubtree, remountRegion, commit, mounts, subtreeKeys, regionBook };
  }

  function createApp(opts={}){
    const root=opts.root, initial=opts.initial||{}, commands=opts.commands||{}, register=opts.register;
    const guardianMode=opts.guardianMode, autoFirstRender=opts.autoFirstRender!==false;
    const truth=createTruth(initial), registry=createRegistry(), guardian=createGuardian(), lifecycle=createLifecycle(), auditor=createAuditor();
    defaultRules(guardian); if(guardianMode) guardian.setMode(guardianMode);
	// Policy أداء عامة (يمكن تخصيصها من خيارات createApp)
 addPerformancePolicy(guardian, opts.perfPolicy || {
   maxMs: (opts.maxCommitMs ?? 32),
  avgMs: opts.avgCommitMs,
  mode:  opts.perfMode || 'last'
 });
 window.__MISHKAH_PERF_MAX__ = (opts?.perfPolicy?.maxMs ?? opts?.maxCommitMs ?? 32);

    const env=createEnv({ locale:opts.locale, dir:opts.dir, theme:opts.theme, tokens:opts.themeTokens, dictionaries:opts.dictionaries, persist:!!opts.persistEnv });
    const engine=createEngine(registry,guardian,lifecycle,auditor,truth);

    function registerRegion(uKey,mount,buildFn,parentKey=null,options={}){
      engine.registerRegion(uKey,mount,(state,ctx)=>buildFn(state,{ ...ctx, env, i18n:env.i18n }),parentKey,options);
      if(autoFirstRender) truth.mark(uKey);
    }
    function registerRegionAndMark(uKey,mount,buildFn,parentKey=null,options={}){
      engine.registerRegion(uKey,mount,(state,ctx)=>buildFn(state,{ ...ctx, env, i18n:env.i18n }),parentKey,options);
      truth.mark(uKey);
    }
    function registerComponent(name,factory,opts2){ registry.registerComponent(name,factory,opts2) }

    truth.bindKeysProvider(()=>Array.from(engine.mounts.keys()));

    function dispatch(name,e,...args){
      const cmd=commands[name]; if(!cmd) return;
      try{ cmd({ truth,registry,guardian,lifecycle,auditor,engine,registerRegion,registerComponent,dispatch,env,i18n:env.i18n }, e, ...args) }
      catch(err){ auditor.logLocal({ uKey:name, logs:createRing(1) },"cmd:error",{ error:String(err) }) }
    }

    const U=(window.Mishkah&&window.Mishkah.utils)||{};
    const attachDelegation=createAttrDelegator(U);
    let detachDelegation=null;
    if(root){ const el=typeof root==="string" ? document.querySelector(root) : root; if(el) detachDelegation=attachDelegation(el,dispatch,opts.delegation||{}) }

    truth.subscribe(({ state,dirty,frozen })=>{ engine.commit(state,dirty,frozen) });
    env.subscribe(()=>{ truth.rebuildAll(()=>true) });

    function rebuildAll(opts2={}){
      const expects=opts2.expects||opts2.expect||opts2.except||[];
      const protect=opts2.protect!==false; const markExpected=opts2.markExpected!==false;
      const expected=new Set(); asArray(expects).forEach(k=>engine.subtreeKeys(k).forEach(x=>expected.add(x)));
      if(protect) expected.forEach(k=>truth.freeze(k));
      truth.rebuildAll(k=>!expected.has(k));
      if(protect){ expected.forEach(k=>truth.unfreeze(k)); if(markExpected) expected.forEach(k=>truth.mark(k)) }
    }
    function rebuildAllExcept(expects){ rebuildAll({ expects }) }

    const Devtools={
      getSnapshot:()=>auditor.snapshot(),
      printSummary(){ const s=auditor.snapshot(); const rows=Object.entries(s.regions).map(([k,v])=>({ region:k, commits:v.commits, avgMs:+(v.avgMs||0).toFixed(2), lastMs:+(v.lastMs||0).toFixed(2), slow:v.slowCount, errors:v.errors, viol:v.violations, pr:v.priority })); console.table(rows); console.log("Recent logs:", s.log); return rows }
    };
    window.MishkahDevtools=Devtools;

    if(typeof register==="function"){ truth.batch(()=>{ register({ truth,registry,guardian,lifecycle,auditor,engine,registerRegion,registerRegionAndMark,registerComponent,dispatch,env,i18n:env.i18n }) }) }

    return {
      truth, registry, guardian, lifecycle, auditor, engine, env, i18n: env.i18n,
      registerRegion, registerRegionAndMark, registerComponent, dispatch,
      helpers:{ mark:truth.mark, rebuild:truth.rebuild, rebuildAll, rebuildAllExcept, batch:truth.batch, freeze:truth.freeze, unfreeze:truth.unfreeze },
      devtools:Devtools,
      offDelegation:()=>{ if(detachDelegation) detachDelegation() }
    };
  }

  window.Mishkah = window.Mishkah || {};
  window.Mishkah.Core = { createApp, createTruth, createRegistry, createGuardian, createLifecycle, createAuditor, createEnv };
})(window);


// utils
(function (window) {
  'use strict';
  const U = {};

  const isArr = Array.isArray;
  const isObj = v => v != null && typeof v === 'object' && !Array.isArray(v);
  const isStr = v => typeof v === 'string';
  const isFn = v => typeof v === 'function';
  const isNum = v => typeof v === 'number' && !Number.isNaN(v);
  const noop = () => {};
  const identity = x => x;

  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const between = (v, min, max) => v >= min && v <= max;
  const once = fn => { let c = false, val; return (...a) => { if (!c) { c = true; val = fn(...a) } return val } };
  
 
  const nextTick = fn => Promise.resolve().then(fn);
  const withTimeout = (p, ms, msg = 'Timeout') => new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error(msg)), ms);
    Promise.resolve(p).then(v => { clearTimeout(t); res(v) }, e => { clearTimeout(t); rej(e) })
  });
  U.once = once;
  U.nextTick = nextTick;
  U.withTimeout = withTimeout;
  U.$ = (sel, root = document) => root.querySelector(sel);
  U.$$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  U.ajax = async (url, opt = {}) => {
    const { method = 'GET', headers = {}, query = null, body, timeout = 0, responseType = null, withCredentials = false } = opt;
    const q = !query ? '' : '?' + Object.entries(query).map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&');
    const full = url + q;
    const ctrl = timeout ? new AbortController() : null;
    const id = timeout ? setTimeout(() => ctrl.abort(), timeout) : null;
    try {
      const wantJSON = isObj(body) && !headers['Content-Type'] && !headers['content-type'];
      const h = wantJSON ? { 'Content-Type': 'application/json', Accept: 'application/json, text/plain, */*', ...headers } : { Accept: 'application/json, text/plain, */*', ...headers };
      const b = isObj(body) && h['Content-Type'] === 'application/json' ? JSON.stringify(body) : body;
      const res = await fetch(full, { method, headers: h, body: b, credentials: withCredentials ? 'include' : 'same-origin', signal: ctrl ? ctrl.signal : undefined });
      if (id) clearTimeout(id);
      if (!res.ok) {
        let msg = res.statusText;
        try { const j = await res.clone().json(); msg = j?.message || msg } catch (_) {}
        const e = new Error(`HTTP ${res.status} ${msg}`); e.status = res.status; e.response = res; throw e
      }
      if (responseType) {
        if (responseType === 'json') return res.json();
        if (responseType === 'text') return res.text();
        if (responseType === 'blob') return res.blob();
        if (responseType === 'arrayBuffer') return res.arrayBuffer();
        if (responseType === 'formData') return res.formData();
      }
      const ct = (res.headers.get('content-type') || '').toLowerCase();
      if (ct.includes('application/json')) return res.json();
      if (ct.includes('text/')) return res.text();
      if (ct.includes('application/octet-stream')) return res.arrayBuffer();
      if (ct.includes('multipart/') || ct.includes('form-data')) return res.formData();
      return res.blob()
    } catch (e) { if (id) clearTimeout(id); throw e }
  };

  const createNamespacedStorage = (storage, ns = 'mishkah') => {
    const K = k => `${ns}:${k}`;
    const set = (k, v, ttlMs = null) => { const item = { v, t: Date.now(), e: ttlMs ? Date.now() + ttlMs : null }; try { storage.setItem(K(k), JSON.stringify(item)) } catch (_) {} };
    const get = (k, def = null) => { try { const raw = storage.getItem(K(k)); if (!raw) return def; const item = JSON.parse(raw); if (item.e && Date.now() > item.e) { storage.removeItem(K(k)); return def } return item.v } catch (_) { return def } };
    const remove = k => { try { storage.removeItem(K(k)) } catch (_) {} };
    const clearNS = () => { try { const keys = []; for (let i = 0; i < storage.length; i++) { const key = storage.key(i); if (key && key.startsWith(ns + ':')) keys.push(key) } for (const k of keys) storage.removeItem(k) } catch (_) {} };
    return { set, get, remove, clear: clearNS }
  };
  U.localStorage = createNamespacedStorage(window.localStorage, 'mishkah');
  U.sessionStorage = createNamespacedStorage(window.sessionStorage, 'mishkah:session');

  class IndexedDBManager {
    constructor(dbName, version = 1, upgrade) { this.dbName = dbName; this.version = version; this.upgrade = upgrade; this.db = null }
    open() {
      if (this.db) return Promise.resolve(this.db);
      return new Promise((resolve, reject) => {
        const req = indexedDB.open(this.dbName, this.version);
        req.onerror = e => reject(e.target.error || e);
        req.onupgradeneeded = e => { if (this.upgrade) this.upgrade(e.target.result, e.oldVersion, e.newVersion) };
        req.onsuccess = e => { this.db = e.target.result; resolve(this.db) }
      })
    }
    _tx(store, mode = 'readonly') { return this.open().then(db => db.transaction(store, mode).objectStore(store)) }
    get(store, key) { return this._tx(store, 'readonly').then(os => new Promise((res, rej) => { const r = os.get(key); r.onsuccess = () => res(r.result); r.onerror = e => rej(e.target.error) })) }
    getAll(store, query, count) {
      return this._tx(store, 'readonly').then(os => new Promise((res, rej) => {
        const r = ('getAll' in os) ? os.getAll(query, count) : os.openCursor(query);
        if (r instanceof IDBRequest) { r.onsuccess = () => res(r.result); r.onerror = e => rej(e.target.error) }
        else {
          const out = [];
          r.onsuccess = e => { const cur = e.target.result; if (cur) { out.push(cur.value); cur.continue() } else res(out) };
          r.onerror = e => rej(e.target.error)
        }
      }))
    }
    put(store, value, key) { return this._tx(store, 'readwrite').then(os => new Promise((res, rej) => { const r = key != null ? os.put(value, key) : os.put(value); r.onsuccess = () => res(true); r.onerror = e => rej(e.target.error) })) }
    bulkPut(store, values) {
      return this._tx(store, 'readwrite').then(os => new Promise((res, rej) => {
        let i = 0;
        const next = () => { if (i >= values.length) { res(true); return } const v = values[i++]; const r = os.put(v); r.onsuccess = next; r.onerror = e => rej(e.target.error) };
        next()
      }))
    }
    delete(store, key) { return this._tx(store, 'readwrite').then(os => new Promise((res, rej) => { const r = os.delete(key); r.onsuccess = () => res(true); r.onerror = e => rej(e.target.error) })) }
    clear(store) { return this._tx(store, 'readwrite').then(os => new Promise((res, rej) => { const r = os.clear(); r.onsuccess = () => res(true); r.onerror = e => rej(e.target.error) })) }
    indexGetAll(store, indexName, query) { return this._tx(store, 'readonly').then(os => new Promise((res, rej) => { const idx = os.index(indexName); const r = idx.getAll(query); r.onsuccess = () => res(r.result); r.onerror = e => rej(e.target.error) })) }
  }
  U.IndexedDB = IndexedDBManager;

  class WebSocketManager {
    constructor(url, opt = {}) { this.url = url; this.ws = null; this.handlers = {}; this.autoReconnect = opt.autoReconnect !== false; this.min = opt.minReconnect || 1000; this.max = opt.maxReconnect || 15000; this._timer = null; this._queue = []; this.protocols = opt.protocols; this.pingInterval = opt.pingInterval || 0; this._pingT = null }
    _jitter(n) { return Math.min(this.max, Math.floor(n * (1.2 - Math.random() * 0.4))) }
    _scheduleReconnect(delay) { if (!this.autoReconnect) return; clearTimeout(this._timer); this._timer = setTimeout(() => this.connect(), this._jitter(delay || this.min)) }
    connect() {
      try { this.ws = this.protocols ? new WebSocket(this.url, this.protocols) : new WebSocket(this.url) }
      catch (_) { this._scheduleReconnect(this.min); return }
      this.ws.onopen = e => {
        this._emit('open', e);
        while (this._queue.length) { this.send(this._queue.shift()) }
        if (this.pingInterval > 0) { clearInterval(this._pingT); this._pingT = setInterval(() => { try { this.ws?.send('ping') } catch (_) {} }, this.pingInterval) }
      };
      this.ws.onmessage = e => { let d = e.data; try { d = JSON.parse(d) } catch (_) {} this._emit('message', d) };
      this.ws.onerror = e => this._emit('error', e);
      this.ws.onclose = e => { this._emit('close', e); clearInterval(this._pingT); if (this.autoReconnect) this._scheduleReconnect(this.min) }
    }
    on(ev, fn) { (this.handlers[ev] || (this.handlers[ev] = [])).push(fn); return () => { this.off(ev, fn) } }
    off(ev, fn) { const a = this.handlers[ev]; if (!a) return; const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1) }
    _emit(ev, data) { const a = this.handlers[ev]; if (a) for (const fn of a.slice()) try { fn(data) } catch (_) {} }
    send(data) { const payload = typeof data === 'string' ? data : JSON.stringify(data); if (this.ws && this.ws.readyState === WebSocket.OPEN) { try { this.ws.send(payload) } catch (_) { this._queue.push(data) } } else { this._queue.push(data) } }
    close() { this.autoReconnect = false; try { this.ws?.close() } catch (_) {} }
  }
  U.WebSocket = WebSocketManager;

  const Evt = () => {
    const m = new Map();
    const on = (t, fn) => { const a = m.get(t) || []; a.push(fn); m.set(t, a); return () => off(t, fn) };
    const onceEvt = (t, fn) => on(t, (...args) => { off(t, fn); fn(...args) });
    const off = (t, fn) => { const a = m.get(t); if (!a) return; const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1) };
    const emit = (t, ...args) => { const a = m.get(t) || []; for (const fn of a.slice()) try { fn(...args) } catch (_) {} };
    return { on, once: onceEvt, off, emit }
  };
  U.EventBus = Evt;

  class Broadcast {
    constructor(name) { this.name = name; this.bc = null; this.bus = Evt(); try { this.bc = new BroadcastChannel(name); this.bc.onmessage = e => this.bus.emit('message', e.data) } catch (_) { window.addEventListener('storage', e => { if (e.key === `bc:${name}` && e.newValue) { try { const d = JSON.parse(e.newValue); this.bus.emit('message', d) } catch (_) {} } }) } }
    post(data) { try { if (this.bc) {this.bc.postMessage(data);} 
	else 
{
  const k = `bc:${this.name}`; 
  localStorage.setItem(k, JSON.stringify(data));
   // تنظيف فوري
   setTimeout(() => { try { localStorage.removeItem(k) } catch(_){} }, 0);
 }

	} catch (_) {} }
    on(fn) { return this.bus.on('message', fn) }
    close() { try { this.bc?.close() } catch (_) {} }
  }
  U.Broadcast = Broadcast;

  U.debounce = (fn, wait = 250) => { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait) } };
  U.throttle = (fn, wait = 250) => {
    let last = 0, pend = null, timer = null;
    const run = (args) => { last = Date.now(); pend = null; fn(...args) };
    return (...args) => {
      const now = Date.now(), rem = wait - (now - last);
      if (rem <= 0) run(args);
      else { pend = args; clearTimeout(timer); timer = setTimeout(() => run(pend), rem) }
    }
  };
  U.sleep = ms => new Promise(r => setTimeout(r, ms));
  U.retry = async (fn, { tries = 3, base = 300, factor = 2, jitter = true } = {}) => { let a = 0, d = base; for (;;) { try { return await fn() } catch (e) { a++; if (a >= tries) throw e; const j = jitter ? Math.floor(d * (0.8 + Math.random() * 0.4)) : d; await U.sleep(j); d *= factor } } };

  U.qs = {
    parse(s) { const out = {}; if (!s) return out; s = s.replace(/^\?/, ''); for (const part of s.split('&')) { if (!part) continue; const [k, v = ''] = part.split('='); const key = decodeURIComponent(k.replace(/\+/g, ' ')); const val = decodeURIComponent(v.replace(/\+/g, ' ')); if (key in out) { const cur = out[key]; out[key] = Array.isArray(cur) ? cur.concat(val) : [cur, val] } else out[key] = val } return out },
    stringify(obj) { const enc = x => encodeURIComponent(String(x)); const parts = []; for (const k in obj) { const v = obj[k]; if (v == null) continue; if (Array.isArray(v)) { for (const it of v) parts.push(`${enc(k)}=${enc(it)}`) } else parts.push(`${enc(k)}=${enc(v)}`) } return parts.length ? `?${parts.join('&')}` : '' }
  };

  U.uuid = () => { const b = new Uint8Array(16); crypto.getRandomValues(b); b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80; const h = [...b].map(x => x.toString(16).padStart(2, '0')); return `${h[0]}${h[1]}${h[2]}${h[3]}-${h[4]}${h[5]}-${h[6]}${h[7]}-${h[8]}${h[9]}-${h[10]}${h[11]}${h[12]}${h[13]}${h[14]}${h[15]}` };
  U.uid = (prefix = 'id') => `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
  U.cx = (...xs) => xs.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  U.sha256 = async s => { const enc = new TextEncoder().encode(String(s)); const buf = await crypto.subtle.digest('SHA-256', enc); return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('') };
  U.base64 = {
    encode(s) { const bytes = new TextEncoder().encode(String(s)); let bin = ''; for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]); return btoa(bin) },
    decode(s) { const bin = atob(String(s)); const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i); return new TextDecoder().decode(bytes) }
  };

  U.cache = {
    async get(name, req, fetcher) { const c = await caches.open(name); const key = typeof req === 'string' ? new Request(req) : req; const hit = await c.match(key); if (hit) return hit.clone(); const res = fetcher ? await fetcher(key) : await fetch(key); if (res && res.ok) await c.put(key, res.clone()); return res.clone() },
    async put(name, req, res) { const c = await caches.open(name); await c.put(req, res); return true },
    async del(name, req) { const c = await caches.open(name); return c.delete(req) },
    async clear(name) { const keys = await caches.keys(); for (const k of keys) { if (!name || k === name) await caches.delete(k) } }
  };

  U.TaskQueue = class {
    constructor(concurrency = 4) { this.c = concurrency; this.q = []; this.r = 0 }
    _next() { if (this.r >= this.c) return; const it = this.q.shift(); if (!it) return; this.r++; Promise.resolve().then(it.fn).then(it.res, it.rej).finally(() => { this.r--; this._next() }) }
    add(fn) { return new Promise((res, rej) => { this.q.push({ fn, res, rej }); this._next() }) }
  };

  U.Time = { now: () => Date.now(), ts: () => new Date().toISOString(), fmt: (d, opts) => new Intl.DateTimeFormat(undefined, opts || { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(d instanceof Date ? d : new Date(d)) };

  U.on = (el, ev, fn, opts) => { el && el.addEventListener(ev, fn, opts); return () => U.off(el, ev, fn, opts) };
  U.off = (el, ev, fn, opts) => { el && el.removeEventListener(ev, fn, opts) };
U.delegate = (root, types, selectorOrFilter, handler, options = {}) => {
  const tlist = Array.isArray(types) ? types : String(types).trim().split(/\s+/).filter(Boolean);
  const opt = options || {};
  const isFn = v => typeof v === 'function';
  const isStr = v => typeof v === 'string';
  const maxDepth = Number.isFinite(opt.maxDepth) ? opt.maxDepth : Infinity;
  const withinSel = opt.within && isStr(opt.within) ? opt.within : null;

  const match = (el, e) => isFn(selectorOrFilter) ? !!selectorOrFilter(el, e) : !!(el && el.matches && el.matches(selectorOrFilter));
  const reject = (el, e) => {
    if (!opt.not) return false;
    if (isFn(opt.not)) return !!opt.not(el, e);
    if (isStr(opt.not) && el.matches) return el.matches(opt.not);
    return false;
  };
  const inWithin = (el) => !withinSel ? true : !!(el.closest && el.closest(withinSel));

  const listener = (e) => {
    let target = null;

    if (opt.path !== false && e.composedPath) {
      let depth = 0;
      for (const node of e.composedPath()) {
        if (depth++ > maxDepth) break;
        if (!(node instanceof Element)) continue;
        if (!root.contains(node)) continue;
        if (!inWithin(node)) continue;
        if (reject(node, e)) continue;
        if (match(node, e)) { target = node; break; }
      }
    }

    if (!target) {
      let cur = e.target, depth = 0;
      while (cur && depth++ <= maxDepth && cur !== document) {
        if (!root.contains(cur)) break;
        if (inWithin(cur) && !reject(cur, e) && match(cur, e)) { target = cur; break; }
        cur = cur.parentNode || cur.host || null;
      }
    }

    if (!target) return;
    if (opt.self && e.target !== target) return;
    if (opt.when && isFn(opt.when) && !opt.when(e, target)) return;
    if (opt.prevent) e.preventDefault();
    if (opt.immediate) e.stopImmediatePropagation();
    else if (opt.stop) e.stopPropagation();
    if (opt.once) offAll();
    return handler.call(target, e, target);
  };

  const offs = tlist.map(t => U.on(root, t, listener, { capture: !!opt.capture, passive: !!opt.passive }));
  function offAll(){ for (const off of offs) try{ off && off(); } catch(_){} }
  return offAll;
};

U.delegateOnce = (root, types, selectorOrFilter, handler, options = {}) =>
  U.delegate(root, types, selectorOrFilter, handler, { ...options, once: true });

U.delegateMap = (root, types, mapOrArray, sharedOptions = {}) => {
  const entries = Array.isArray(mapOrArray)
    ? mapOrArray
    : Object.entries(mapOrArray || {}).map(([selectorOrFilter, handler]) => ({ selectorOrFilter, handler, options: {} }));

  const disposers = [];
  for (const ent of entries) {
    const selOrFilter = ent.selectorOrFilter ?? ent.selector ?? ent.filter;
    const handler = ent.handler;
    const options = { ...sharedOptions, ...(ent.options || {}) };
    disposers.push(U.delegate(root, types, selOrFilter, handler, options));
  }
  return () => { for (const d of disposers) try{ d && d(); }catch(_){} };
};

  U.setVar = (el, name, value) => { if (el) el.style.setProperty(name, value) };
  U.getVar = (el, name) => el ? getComputedStyle(el).getPropertyValue(name) : '';
  U.setStyles = (el, styles = {}) => { if (!el || !styles) return; for (const k in styles) el.style[k] = styles[k] };

  const Keys = { Enter: 'Enter', Escape: 'Escape', Space: ' ', Tab: 'Tab', ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight', Home: 'Home', End: 'End', PageUp: 'PageUp', PageDown: 'PageDown' };
  U.Keys = Keys;

  const focusableSelector = ['a[href]', 'button:not([disabled])', 'input:not([disabled])', 'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])', '[contenteditable="true"]'].join(',');
  U.getFocusables = root => U.$$(focusableSelector, root).filter(el => el.offsetParent !== null || getComputedStyle(el).position === 'fixed');
  U.focusFirst = root => { const f = U.getFocusables(root)[0]; if (f) f.focus(); return !!f };
  U.focusNext = (root, current) => { const a = U.getFocusables(root); const i = Math.max(0, a.indexOf(current)) + 1; const t = a[i] || a[0]; t && t.focus() };
  U.focusPrev = (root, current) => { const a = U.getFocusables(root); const i = Math.max(0, a.indexOf(current)) - 1; const t = a[i] || a[a.length - 1]; t && t.focus() };
  U.trapFocus = root => { const handler = e => { if (e.key !== Keys.Tab) return; const f = U.getFocusables(root); if (!f.length) return; const first = f[0], last = f[f.length - 1]; if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() } }; const off = U.on(root, 'keydown', handler); return () => off() };
  U.onOutsideClick = (root, cb) => { const h = e => { if (!root.contains(e.target)) cb(e) }; const off1 = U.on(document, 'mousedown', h, true); const off2 = U.on(document, 'touchstart', h, true); return () => { off1(); off2() } };
  U.onEscape = cb => U.on(document, 'keydown', e => { if (e.key === Keys.Escape) cb(e) });

  U.getRect = el => el && el.getBoundingClientRect ? el.getBoundingClientRect() : { left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0 };
  U.computePlacement = (anchor, content, opt = {}) => {
    const p = opt.placement || 'bottom';
    const align = opt.align || 'start';
    const offset = opt.offset == null ? 6 : opt.offset;
    const margin = opt.boundaryMargin == null ? 8 : opt.boundaryMargin;
    const flip = opt.flip !== false;
    const ar = U.getRect(anchor);
    const cr = U.getRect(content);
    const vw = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
    const vh = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
    let top = 0, left = 0, place = p;
    const calc = (pl) => {
      let t = 0, l = 0;
      if (pl === 'top') { t = ar.top - cr.height - offset; if (align === 'start') l = ar.left; else if (align === 'end') l = ar.right - cr.width; else l = ar.left + (ar.width - cr.width) / 2 }
      else if (pl === 'bottom') { t = ar.bottom + offset; if (align === 'start') l = ar.left; else if (align === 'end') l = ar.right - cr.width; else l = ar.left + (ar.width - cr.width) / 2 }
      else if (pl === 'left') { l = ar.left - cr.width - offset; if (align === 'start') t = ar.top; else if (align === 'end') t = ar.bottom - cr.height; else t = ar.top + (ar.height - cr.height) / 2 }
      else if (pl === 'right') { l = ar.right + offset; if (align === 'start') t = ar.top; else if (align === 'end') t = ar.bottom - cr.height; else t = ar.top + (ar.height - cr.height) / 2 }
      return { t, l }
    };
    ({ t: top, l: left } = calc(place));
    const overflow = () => left < margin || top < margin || left + cr.width > vw - margin || top + cr.height > vh - margin;
    if (flip && overflow()) {
      const alt = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' }[place] || place;
      ({ t: top, l: left } = calc(alt));
      if (!overflow()) place = alt
    }
    left = clamp(left, margin, vw - cr.width - margin);
    top = clamp(top, margin, vh - cr.height - margin);
    return { left, top, placement: place, style: { position: 'fixed', top: `${top}px`, left: `${left}px` } }
  };

  U.isRTL = l => { const s = (l || '').toLowerCase(); return s === 'rtl' || s === 'ar' || s.startsWith('fa') || s.startsWith('ur') || s.startsWith('he') };
  U.dirFrom = l => U.isRTL(l) ? 'rtl' : 'ltr';

  U.setData = (el, map = {}) => { if (!el || !isObj(map)) return; for (const k in map) { el.dataset[k] = String(map[k]) } };
  U.getData = (el, key, def = null) => { if (!el) return def; const v = el.dataset[key]; return v == null ? def : v };

  U.Escaper = {
    html: s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'),
    attr: s => String(s ?? '').replace(/"/g, '&quot;')
  };

  U.copyText = async (text) => { try { await navigator.clipboard.writeText(String(text)); return true } catch (_) { const ta = document.createElement('textarea'); ta.value = String(text); ta.style.position = 'fixed'; ta.style.top = '-1000px'; document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand('copy') } catch (_) { ok = false } document.body.removeChild(ta); return ok } };
  U.download = (data, filename = 'file.txt', mime = 'application/octet-stream') => { const blob = data instanceof Blob ? data : new Blob([data], { type: mime }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url) };

  U.setCookie = (name, value, days = 7, path = "/") => { const d = new Date(); d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000); document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)};expires=${d.toUTCString()};path=${path}` };
  U.getCookie = (name) => { const m = document.cookie.match(new RegExp("(^| )" + encodeURIComponent(name) + "=([^;]+)")); return m ? decodeURIComponent(m[2]) : null };
  U.getParam = (key, url = window.location.href) => { const u = new URL(url); return u.searchParams.get(key) };

  const ThemeAdapter = { classes: { button({ variant = 'default', size = 'md', disabled }) { const V = variant === 'primary' ? 'ui-btn ui-btn--primary' : variant === 'ghost' ? 'ui-btn ui-btn--ghost' : 'ui-btn'; const S = size === 'sm' ? 'ui-btn--sm' : size === 'lg' ? 'ui-btn--lg' : 'ui-btn--md'; return U.cx(V, S, disabled && 'is-disabled') }, field({ invalid }) { return U.cx('ui-field__input', invalid && 'is-invalid') } } };
  const BootstrapAdapter = { classes: { button({ variant = 'primary', size = 'md', disabled }) { const V = { primary: 'btn btn-primary', ghost: 'btn btn-outline-primary', default: 'btn btn-secondary' }[variant] || 'btn btn-secondary'; const S = { sm: 'btn-sm', md: '', lg: 'btn-lg' }[size] || ''; return U.cx(V, S, disabled && 'disabled') }, field({ invalid }) { return U.cx('form-control', invalid && 'is-invalid') } } };
  const TailwindAdapter = { classes: { button({ variant = 'primary', size = 'md', disabled }) { const base = 'inline-flex items-center justify-center rounded-2xl shadow-sm'; const V = { primary: 'bg-blue-600 text-white hover:bg-blue-700', ghost: 'border border-gray-300 text-gray-800 hover:bg-gray-50', default: 'bg-gray-100 text-gray-900 hover:bg-gray-200' }[variant] || 'bg-gray-100 text-gray-900 hover:bg-gray-200'; const S = { sm: 'text-sm px-3 py-1.5', md: 'text-base px-4 py-2', lg: 'text-lg px-5 py-2.5' }[size] || 'text-base px-4 py-2'; return U.cx(base, V, S, disabled && 'opacity-60 pointer-events-none') }, field({ invalid }) { const base = 'rounded-2xl border px-3 py-2 bg-white text-gray-900'; const err = invalid ? 'border-red-500' : 'border-gray-300'; return U.cx(base, err) } } };

  const a11y = {
    warnMissingKeys(nodes) { if (!Array.isArray(nodes)) return; const noKey = nodes.some(n => n && typeof n === 'object' && n.key == null); if (noKey && typeof console !== 'undefined') console.warn('[A11y] list items should have stable keys') },
    ensureRole(el, role) { if (!el) return; const curr = el.getAttribute('role'); if (curr !== role) { el.setAttribute('role', role); if (typeof console !== 'undefined') console.warn('[A11y] role adjusted to', role) } },
    warnIfNoLabel(input) { if (!input) return; const id = input.getAttribute('id'); if (!id) return; const hasLabel = !!document.querySelector(`label[for="${id}"]`); if (!hasLabel && typeof console !== 'undefined') console.warn('[A11y] input without label', id) }
  };
  U.a11y = a11y;

  U.memoize = fn => { const m = new Map(); return (...args) => { const k = JSON.stringify(args); if (m.has(k)) return m.get(k); const v = fn(...args); m.set(k, v); return v } };
  U.deepEqual = (a, b) => {
    if (a === b) return true;
    if (typeof a !== typeof b) return false;
    if (isArr(a) && isArr(b)) { if (a.length !== b.length) return false; for (let i = 0; i < a.length; i++) if (!U.deepEqual(a[i], b[i])) return false; return true }
    if (isObj(a) && isObj(b)) { const ka = Object.keys(a), kb = Object.keys(b); if (ka.length !== kb.length) return false; for (const k of ka) if (!U.deepEqual(a[k], b[k])) return false; return true }
    return false
  };
  U.deepMerge = (t, s) => {
    if (!isObj(t) || !isObj(s)) return s;
    const o = { ...t };
    for (const k of Object.keys(s)) o[k] = isObj(s[k]) && isObj(t[k]) ? U.deepMerge(t[k], s[k]) : s[k];
    return o
  };
  U.pick = (obj, keys) => { const o = {}; for (const k of keys) if (k in obj) o[k] = obj[k]; return o };
  U.omit = (obj, keys) => { const s = new Set(keys); const o = {}; for (const k in obj) if (!s.has(k)) o[k] = obj[k]; return o };
  U.getPath = (obj, path, def) => { const ks = String(path).split('.'); let cur = obj; for (const k of ks) { if (cur && typeof cur === 'object' && k in cur) cur = cur[k]; else return def } return cur };
  U.setPath = (obj, path, val) => { const ks = String(path).split('.'); let cur = obj; for (let i = 0; i < ks.length - 1; i++) { const k = ks[i]; if (!isObj(cur[k])) cur[k] = {}; cur = cur[k] } cur[ks[ks.length - 1]] = val; return obj };
  U.stableStringify = (obj) => { const seen = new WeakSet(); const f = x => { if (x && typeof x === 'object') { if (seen.has(x)) return '"[Circular]"'; seen.add(x); if (Array.isArray(x)) return '[' + x.map(f).join(',') + ']'; const keys = Object.keys(x).sort(); return '{' + keys.map(k => JSON.stringify(k) + ':' + f(x[k])).join(',') + '}' } return JSON.stringify(x) }; return f(obj) };

  U.toCamel = s => String(s).replace(/[-_](\w)/g, (_, c) => c.toUpperCase());
  U.toKebab = s => String(s).replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

  U.uniqueBy = (arr, key) => { const set = new Set(); const out = []; for (const it of arr) { const k = isFn(key) ? key(it) : it[key]; if (!set.has(k)) { set.add(k); out.push(it) } } return out };
  U.groupBy = (arr, key) => { const out = {}; for (const it of arr) { const k = isFn(key) ? key(it) : it[key]; (out[k] || (out[k] = [])).push(it) } return out };
  U.sortBy = (arr, key, dir = 'asc') => { const a = arr.slice(); const g = isFn(key) ? key : (x => x[key]); a.sort((x, y) => { const dx = g(x), dy = g(y); if (dx < dy) return dir === 'asc' ? -1 : 1; if (dx > dy) return dir === 'asc' ? 1 : -1; return 0 }); return a };
  U.range = (n, s = 0) => Array.from({ length: n }, (_, i) => i + s);
  U.chunk = (arr, size) => { const out = []; for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size)); return out };
  U.sum = arr => arr.reduce((a, b) => a + b, 0);
  U.avg = arr => arr.length ? U.sum(arr) / arr.length : 0;

  U.randomInt = (min, max) => Math.floor(min + Math.random() * (max - min + 1));
  U.randomChoice = arr => arr[Math.floor(Math.random() * arr.length)];

  U.html = (str) => { const t = document.createElement('template'); t.innerHTML = String(str).trim(); return t.content };

  U.raf = (fn) => { let id = 0, active = true; const loop = (t) => { if (!active) return; fn(t); id = requestAnimationFrame(loop) }; id = requestAnimationFrame(loop); return () => { active = false; cancelAnimationFrame(id) } };

  window.Mishkah = window.Mishkah || {};
  window.Mishkah.utils = U;
  const Adapters = { ThemeAdapter, BootstrapAdapter, TailwindAdapter };

  window.Mishkah.adapters = Adapters;
  window.__MISHKAH_UTILS_ADAPTERS__ = { U, Adapters };
})(window);



// twcss.js
(function (window) {
  'use strict';

  const cache = new Map();
  const isStr = v => typeof v === "string";
  const isArr = Array.isArray;
  const isFn  = v => typeof v === "function";
  const isObj = v => v && typeof v === "object" && !isArr(v);
  const cx    = (...xs) => xs.flat(Infinity).filter(Boolean).join(" ").replace(/\s+/g, " ").trim();

  // Prefix aliases
  const P = {
    "h:": "hover:",
    "f:": "focus:",
    "a:": "active:",
    "d:": "dark:",
    "sm:": "sm:",
    "md:": "md:",
    "lg:": "lg:",
    "xl:": "xl:",
    "2xl:": "2xl:"
  };

  // Design tokens
  const TOKENS = {
    btn: "inline-flex items-center justify-center rounded-xl font-semibold transition-colors select-none focus:outline-none focus:ring-2 focus:ring-offset-2",
    "btn/primary": "bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500",
    "btn/ghost": "bg-transparent hover:bg-slate-100 text-slate-700",

    card: "bg-white/95 border border-slate-200 rounded-2xl p-5 shadow-lg shadow-slate-900/5 d:bg-slate-900/80 d:border-slate-700 d:shadow-black/30",
    shell: "max-w-5xl mx-auto p-6",

    row: "flex items-center gap-2",
    col: "flex flex-col gap-2",
    center: "items-center justify-center",
    muted: "text-slate-500 d:text-slate-400",

    "bg/ok": "bg-emerald-600 hover:bg-emerald-700 text-white",
    "bg/warn": "bg-amber-500 hover:bg-amber-600 text-white",
    "bg/danger": "bg-rose-600 hover:bg-rose-700 text-white",

    p1: "p-1", p2: "p-2", p3: "p-3", p4: "p-4", p5: "p-5",
    px2: "px-2", px3: "px-3", px4: "px-4", py1: "py-1", py2: "py-2", py3: "py-3",
    mt1: "mt-1", mt2: "mt-2", mb2: "mb-2", gap2: "gap-2",

    "text/sm": "text-sm",
    "text/md": "text-base",
    "text/lg": "text-lg",
    "text/xl": "text-xl"
  };

  const COMPOUND = [];

  // API for tokens
  function def(map) { Object.assign(TOKENS, map || {}); }
  function defCompound(arr) { if (isArr(arr)) COMPOUND.push(...arr); }

  // Context (rtl/ltr + theme)
  function envCtx() {
    const root = document.documentElement || document.body;
    const dir   = (root.getAttribute("dir") || "ltr").toLowerCase();
    const theme = (root.classList.contains("dark") || root.getAttribute("data-theme") === "dark") ? "dark" : "light";
    return { dir, theme, isDark: theme === "dark", isRTL: dir === "rtl" };
  }

  // Arbitrary value handler
  function arb(tok) {
    const m = tok.match(/^([a-zA-Z-]+)\[(.+)]$/);
    if (!m) return null;
    const raw = m[2];
    const needsUnit = /^\d+(\.\d+)?$/.test(raw) ? raw + "px" : raw;
    return m[1] + "-[" + needsUnit + "]";
  }

  // Logical mapping (rtl awareness)
  function mapLogical(tok, dir) {
    if (/^m[se]-/.test(tok)) {
      const side = tok[1] === 's' ? (dir === 'rtl' ? 'r' : 'l') : (dir === 'rtl' ? 'l' : 'r');
      return 'm' + side + tok.slice(3);
    }
    if (/^p[se]-/.test(tok)) {
      const side = tok[1] === 's' ? (dir === 'rtl' ? 'r' : 'l') : (dir === 'rtl' ? 'l' : 'r');
      return 'p' + side + tok.slice(3);
    }
    if (/^border-[se](-|$)/.test(tok)) {
      const side = tok[7] === 's' ? (dir === 'rtl' ? 'r' : 'l') : (dir === 'rtl' ? 'l' : 'r');
      return 'border-' + side + tok.slice(8);
    }
    if (/^rounded-[se](-|$)/.test(tok)) {
      const side = tok[8] === 's' ? (dir === 'rtl' ? 'r' : 'l') : (dir === 'rtl' ? 'l' : 'r');
      return 'rounded-' + side + tok.slice(9);
    }
    if (tok === 'text-start') return dir === 'rtl' ? 'text-right' : 'text-left';
    if (tok === 'text-end') return dir === 'rtl' ? 'text-left' : 'text-right';
    return tok;
  }

  // Core expand
  function expandBase(tok, ctx) {
    const a = arb(tok);
    if (a) return a;

    const logical = mapLogical(tok, ctx.dir);
    if (logical !== tok) return logical;

    if (TOKENS[tok]) return fromAny(TOKENS[tok], ctx);
    return tok;
  }

  function expandPrefix(tok, ctx) {
    for (const p in P) {
      if (tok.startsWith(p)) {
        const rest = tok.slice(p.length);
        const ex = expand(rest, ctx);
        return ex.split(/\s+/).map(c => P[p] + c).join(" ");
      }
    }
    return null;
  }

  function expandOne(tok, ctx) {
    return expandPrefix(tok, ctx) || expandBase(tok, ctx);
  }

  function expand(s, ctx) {
    if (!s) return "";
    const key = s + "::" + ctx.dir + "::" + ctx.theme;
    if (cache.has(key)) return cache.get(key);

    const out = String(s).trim()
      .split(/\s+/)
      .map(t => t.split("+").map(x => expandOne(x, ctx)).join(" "))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    cache.set(key, out);
    return out;
  }

  // Dispatcher
  function fromArray(arr, ctx) { return arr.map(x => isStr(x) ? expand(x, ctx) : fromAny(x, ctx)).join(" "); }
  function fromObject(obj, ctx) {
    const out = [];
    for (const k in obj) {
      if (!obj[k]) continue;
      if (k in P) {
        const sub = fromAny(obj[k], ctx);
        out.push(sub.split(/\s+/).map(c => P[k] + c).join(" "));
      } else {
        out.push(expand(k, ctx));
      }
    }
    return out.join(" ");
  }
  function fromAny(v, ctx) {
    if (!v) return "";
    if (isFn(v)) return fromAny(v(ctx), ctx);
    if (isStr(v)) return expand(v, ctx);
    if (isArr(v)) return fromArray(v, ctx);
    if (isObj(v)) return fromObject(v, ctx);
    return String(v);
  }

  // Public API
  function tw(strings, ...vals) {
    const raw = isArr(strings) ? String.raw({ raw: strings }, ...vals) : strings;
    return fromAny(raw, envCtx());
  }

  function merge(...xs) {
    return tw(cx(xs.map(x => fromAny(x, envCtx()))));
  }

  if (!window.Mishkah) window.Mishkah = {};
  window.Mishkah.twcss = { tw, cx, def, defCompound, merge, config: { P, TOKENS } };

})(window);


// TailwindAdapter (built on twcss)
(function (window) {
  const { tw, merge } = window.Mishkah.twcss;

  const TailwindAdapter = {
    classes: {
      button({ variant = 'primary', size = 'md', disabled }) {
        const sizeCls = size === 'sm' ? 'text/sm px2 py1'
                      : size === 'lg' ? 'text/lg px4 py3'
                      : 'text/md px4 py2';
        return merge('btn', `btn/${variant}`, sizeCls, disabled && 'opacity-60 pointer-events-none');
      },
      field({ invalid }) {
        return tw([
          'rounded-2xl border px-3 py-2',
          invalid ? 'border-rose-500' : 'border-slate-300',
          'bg-white text-slate-900 d:bg-slate-900 d:text-slate-100'
        ]);
      }
    }
  };

  window.Mishkah = window.Mishkah || {};
  window.Mishkah.adapters = Object.assign({}, window.Mishkah.adapters || {}, { TailwindAdapter });

})(window);


// mishkah-history.js
(function (window) {
  const { IndexedDB, debounce, uuid } = window.Mishkah.utils;

  function createHistory({ dbName = "mishkah-trace", keepSessions = 10, flushMs = 1000 } = {}) {
    const db = new IndexedDB(dbName, 1, (db, oldV) => {
      if (oldV < 1) {
        const s = db.createObjectStore("sessions", { keyPath: "id" });
        s.createIndex("startedAt", "startedAt");
        const c = db.createObjectStore("commits", { keyPath: "id" });
        c.createIndex("sessionId", "sessionId");
        const r = db.createObjectStore("regions", { keyPath: ["sessionId", "uKey"] });
        r.createIndex("sessionId", "sessionId");
      }
    });

    let session = null;
    let bufferCommits = [];
    let bufferRegions = new Map();
    let flushing = false;
    let pending = false;

    async function flushBuffers() {
      if (!session) return;
      if (flushing) { pending = true; return; }
      flushing = true;
      try {
        await db.open();
        if (bufferCommits.length) {
          const rows = bufferCommits.map(x => ({ id: x.id, sessionId: session.id, ts: x.ts, uKey: x.uKey, ms: x.ms, mode: x.mode }));
          bufferCommits = [];
          await db.bulkPut("commits", rows);
        }
        if (bufferRegions.size) {
          const rows = [];
          for (const [uKey, v] of bufferRegions) {
            rows.push({
              sessionId: session.id, uKey,
              commits: v.commits | 0, avgMs: v.avgMs || 0, slowCount: v.slowCount | 0,
              errors: v.errors | 0, violations: v.violations | 0, priority: v.priority || "normal"
            });
          }
          bufferRegions.clear();
          await db.bulkPut("regions", rows);
        }
      } finally {
        flushing = false;
        if (pending) { pending = false; await flushBuffers(); }
      }
    }

    const scheduleFlush = debounce(() => { flushBuffers(); }, flushMs);

    async function start(meta = {}) {
      await db.open();
      session = { id: uuid(), startedAt: Date.now(), endedAt: null, meta };
      await db.put("sessions", session);
      await prune();
      return session.id;
    }

    async function stop() {
      if (!session) return;
      session.endedAt = Date.now();
      await db.open();
      await db.put("sessions", session);
      await flushBuffers();
      session = null;
    }

    async function prune() {
      const all = await db.getAll("sessions");
      if (!all || all.length <= keepSessions) return;
      const sorted = all.sort((a, b) => b.startedAt - a.startedAt);
      const toDel = sorted.slice(keepSessions);
      for (const s of toDel) {
        await db.delete("sessions", s.id);
        const commits = await db.indexGetAll("commits", "sessionId", s.id);
        for (const c of commits) await db.delete("commits", c.id);
        const regs = await db.indexGetAll("regions", "sessionId", s.id);
        for (const r of regs) await db.delete("regions", [s.id, r.uKey]);
      }
    }

    function onRegionCommit({ uKey, ms, mode = "patch", priority = "normal" }) {
      if (!session) return;
      bufferCommits.push({ id: uuid(), ts: Date.now(), uKey, ms, mode });
      const r = bufferRegions.get(uKey) || { commits: 0, avgMs: 0, slowCount: 0, errors: 0, violations: 0, priority };
      r.commits++;
      r.avgMs = r.avgMs ? (r.avgMs * 0.9 + ms * 0.1) : ms;
      if (ms > 32) r.slowCount++;
      r.priority = priority;
      bufferRegions.set(uKey, r);
      scheduleFlush();
    }

    function onRegionError(uKey) {
      if (!session) return;
      const r = bufferRegions.get(uKey) || { commits: 0, avgMs: 0, slowCount: 0, errors: 0, violations: 0, priority: "normal" };
      r.errors++;
      bufferRegions.set(uKey, r);
      scheduleFlush();
    }

    function onRegionViolation(uKey, n = 1) {
      if (!session) return;
      const r = bufferRegions.get(uKey) || { commits: 0, avgMs: 0, slowCount: 0, errors: 0, violations: 0, priority: "normal" };
      r.violations += n;
      bufferRegions.set(uKey, r);
      scheduleFlush();
    }

    async function listSessions() {
      await db.open();
      const all = await db.getAll("sessions");
      return all.sort((a, b) => b.startedAt - a.startedAt);
    }
    async function getSessionRegions(sessionId) {
      await db.open();
      return db.indexGetAll("regions", "sessionId", sessionId);
    }
    async function getSessionCommits(sessionId) {
      await db.open();
      return db.indexGetAll("commits", "sessionId", sessionId);
    }
    async function exportSession(sessionId) {
      await db.open();
      const sessions = await db.get("sessions", sessionId);
      if (!sessions) return null;
      const regions = await db.indexGetAll("regions", "sessionId", sessionId);
      const commits = await db.indexGetAll("commits", "sessionId", sessionId);
      return { session: sessions, regions, commits };
    }

    return { start, stop, onRegionCommit, onRegionError, onRegionViolation, listSessions, getSessionRegions, getSessionCommits, exportSession };
  }

  function attach(app, opts) {
    const history = createHistory(opts);
    const startPromise = history.start({ startedBy: "app", at: new Date().toISOString() });

    const auditor = app.auditor;
    const origOnCommit = auditor.onCommit;
    auditor.onCommit = function (uKey, ms, priority) {
      history.onRegionCommit({ uKey, ms, mode: "commit", priority });
      return origOnCommit.call(auditor, uKey, ms, priority);
    };
    const origOnError = auditor.onError;
    auditor.onError = function (uKey) {
      history.onRegionError(uKey);
      return origOnError.call(auditor, uKey);
    };
    const origOnViolation = auditor.onViolation;
    auditor.onViolation = function (uKey, n) {
      history.onRegionViolation(uKey, n);
      return origOnViolation.call(auditor, uKey, n);
    };

    const onHide = () => { history.stop(); };
    window.addEventListener("pagehide", onHide);
    window.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") onHide(); });

    app.history = {
      listSessions: history.listSessions,
      getSessionRegions: history.getSessionRegions,
      getSessionCommits: history.getSessionCommits,
      exportSession: history.exportSession
    };

    return history;
  }

  window.Mishkah = window.Mishkah || {};
  window.Mishkah.History = { createHistory, attach };
})(window);


// Atoms
(function (window) {
  "use strict";

  const Arr = Array.isArray;
  const Fn  = v => typeof v === "function";
  const Str = v => typeof v === "string" || typeof v === "number";
  const Obj = v => v && typeof v === "object" && !Arr(v);
  const toArr = v => v == null ? [] : Arr(v) ? v : [v];
  const j = (...xs) => xs.flat(Infinity).filter(Boolean).join(" ").replace(/\s+/g, " ").trim();

  // ---- slots packer ---------------------------------------------------------
  const pack = (s) => {
    try {
      if (s == null) return { default: [] };
      if (Arr(s))   return { default: s };
      if (Str(s))   return { default: [String(s)] };
      if (Obj(s)) {
        const o = {};
        o.default = ('default' in s) ? toArr(s.default) : [];
        for (const k in s) if (k !== "default") o[k] = toArr(s[k]);
        return o;
      }
      return { default: [s] };
    } catch (err) {
      console.error('🚨 Mishkah Pack Error:', err);
      console.error('Input that caused error:', s);
      console.error('Stack:', err.stack);
      return { default: [`[Pack Error: ${err.message}]`] };
    }
  };

  // ---- twcss bridge (rtl/ltr + dark/light) ---------------------------------
  const withTw = (value) => {
    const mod = (window.Mishkah && window.Mishkah.twcss) || null;
    if (!mod) return String(value);
    return mod.tw(value);
  };

  // ---- props normalizer -----------------------------------------------------
  const norm = (p) => {
    const out = { ...p };

    // alias: className → class
    if (out.className && !out.class) { out.class = out.className; delete out.className; }

    // Tailwind (tw) → class
    if ("tw" in out) {
      const v   = Fn(out.tw) ? out.tw() : out.tw;
      const cls = withTw(v);
      out.class = out.class ? j(out.class, cls) : cls;
      delete out.tw;
    }

    // shorthand: c → class (raw)
    if ("c" in out) {
      const v = Fn(out.c) ? out.c() : out.c;
      out.class = out.class ? j(out.class, v) : v;
      delete out.c;
    }

    return out;
  };

  // ---- helpers to set attributes -------------------------------------------
  const setDataset = (el, data) => { if (!data) return; for (const k in data) el.dataset[k] = String(data[k]); };
  const setAria    = (el, aria) => { if (!aria) return; for (const k in aria) el.setAttribute("aria-" + k, String(aria[k])); };

  // CSS styles: support cssText, object props, and CSS variables
  const setStyle = (el, style) => {
    if (!style) return;
    if (typeof style === "string") { el.style.cssText = style; return; }
    if (!Obj(style)) return;
    for (const k in style) {
      const v = style[k];
      if (k.startsWith("--") || k.includes("-")) el.style.setProperty(k, v);
      else el.style[k] = v;
    }
  };

  // ---- lightweight lifecycle (onMounted / onUnmounted) ---------------------
  // ملاحظة: خفيفة وآمنة. بنستعمل MutationObserver فقط وقت الحاجة.
  function attachLifecycle(el, onMnt, onUnmnt) {
    if (!Fn(onMnt) && !Fn(onUnmnt)) return;

    let mounted = false;
    let lastConnected = el.isConnected;

    const tryMount = () => {
      if (!mounted && el.isConnected) {
        mounted = true;
        try { onMnt && onMnt(el); } catch(_) {}
      }
    };
    const tryUnmount = () => {
      if (mounted && !el.isConnected) {
        mounted = false;
        try { onUnmnt && onUnmnt(el); } catch(_) {}
        // بعد الـ unmount مش بنحتاج observer
        obs.disconnect();
      }
    };

    // حالة تم إضافتها فورًا
    queueMicrotask(tryMount);

    const obs = new MutationObserver(() => {
      const now = el.isConnected;
      if (now !== lastConnected) {
        lastConnected = now;
        if (now) tryMount(); else tryUnmount();
      }
    });

    // نراقب document.body (مرّة لكل عنصر له lifecycle، وهذا مقبول)
    if (document.body) {
      obs.observe(document.body, { childList: true, subtree: true });
    } else {
      // fallback بدائي لو body لسه مش جاهز
      const id = setInterval(() => {
        if (document.body) {
          clearInterval(id);
          obs.observe(document.body, { childList: true, subtree: true });
          tryMount();
        }
      }, 16);
    }
  }

const toNode = (spec) => {
  try {
    if (spec == null || spec === false) return document.createComment("NULL_SPEC");
    if (spec instanceof Node) return spec;
    if (typeof spec === 'string' || typeof spec === 'number') return document.createTextNode(String(spec));

    if (Array.isArray(spec)) {
      const fragment = document.createDocumentFragment();
      for (let i = 0; i < spec.length; i++) {
        fragment.appendChild(toNode(spec[i]));
      }
      return fragment;
    }

    if (typeof spec === 'object' && spec.__A) {
      if (spec.tag === "#fragment") {
        const fragment = document.createDocumentFragment();
        const children = spec.slots?.default || [];
        for (let i = 0; i < children.length; i++) {
          fragment.appendChild(toNode(children[i]));
        }
        return fragment;
      }

      const ns = (spec.tag === "svg" || spec.props?.ns === "svg" || spec.props?.xmlns)
        ? "http://www.w3.org/2000/svg"
        : null;

      const el = ns ? document.createElementNS(ns, spec.tag) : document.createElement(spec.tag);
      const p = spec.props || {};

      if (p.class != null) el.className = p.class;
      if (p.style) setStyle(el, p.style);
      if (p.data && typeof p.data === 'object') setDataset(el, p.data);
      if (p.aria && typeof p.aria === 'object') setAria(el, p.aria);

      const htmlPayload = p.html ?? p.dangerouslySetInnerHTML;
      if (htmlPayload != null) {
        if (htmlPayload && typeof htmlPayload === 'object' && "__html" in htmlPayload) {
          el.innerHTML = String(htmlPayload.__html);
        } else {
          el.innerHTML = String(htmlPayload);
        }
      }

      let onMounted = null;
      let onUnmounted = null;

      for (const k in p) {
        if (/^\d/.test(k)) {
          console.warn(`[Mishkah.Atoms] Invalid attribute name "${k}" ignored.`);
          continue;
        }

        const v = p[k];

        if (k === "class" || k === "className" || k === "style" || k === "children" || k === "data" || k === "aria" || k === "html" || k === "dangerouslySetInnerHTML") {
          continue;
        }
        
        if (k === "onMounted") { if (typeof v === 'function') onMounted = v; continue; }
        if (k === "onUnmounted") { if (typeof v === 'function') onUnmounted = v; continue; }

        if (k.startsWith("on") && k.length > 2 && k[2] === k[2].toUpperCase()) {
          if (typeof v === 'function') {
            el.addEventListener(k.slice(2).toLowerCase(), v);
          } else if (v != null) {
            el.dataset[k.toLowerCase()] = String(v);
          }
          continue;
        }

        if (k === "ref") {
          if (typeof v === 'function') v(el);
          else if (v && typeof v === 'object' && "current" in v) v.current = el;
          continue;
        }
        
        if (k.startsWith("bind:")) {
          const bk = k.slice(5);
          if (bk === "value") {
            el.value = v;
            el.setAttribute("data-value", String(v));
          } else if (bk === "checked" && "checked" in el) {
            el.checked = !!v;
            if (v) el.setAttribute("checked", "");
          }
          continue;
        }
        
        if (k === "dir" || k === "lang" || k === "role" || k.startsWith("aria-") || k.startsWith("data-")) {
          el.setAttribute(k, String(v));
          continue;
        }

        if ((k === "checked" || k === "selected" || k === "disabled" || k === "multiple") && (k in el)) {
          el[k] = !!v;
          if (v) el.setAttribute(k, "");
          continue;
        }

        if (k === "value" && "value" in el) {
          el.value = v;
          el.setAttribute("data-value", String(v));
          continue;
        }

        if (k in el) {
          try {
            el[k] = v;
          } catch {
            el.setAttribute(k, String(v));
          }
        } else {
          el.setAttribute(k, String(v));
        }
      }

      if (htmlPayload == null) {
        const children = spec.slots?.default || [];
        for (let i = 0; i < children.length; i++) {
          el.appendChild(toNode(children[i]));
        }
      }
      
      if (onMounted || onUnmounted) attachLifecycle(el, onMounted, onUnmounted);
      return el;
    }

    return document.createTextNode(String(spec));

  } catch (err) {
    console.error('🚨 Mishkah DOM Build Error:', err);
    console.error('Spec that caused error:', spec);
    console.error('Stack:', err.stack);
    
    const errorEl = document.createElement('div');
    errorEl.style.cssText = 'color:#b91c1c;background:#fee2e2;padding:8px;border-radius:4px;border:1px solid #dc2626;margin:2px;font-family:monospace;font-size:12px';
    errorEl.innerHTML = `<strong>DOM Build Error:</strong> ${err.message}<br><small>Check console for details</small>`;
    return errorEl;
  }
};
  
// ---- factory / proxy API --------------------------------------------------
function create() {
  const h = (tag, props = {}, slots = {}) => ({ __A: 1, tag: String(tag), props: norm(props), slots: pack(slots) });
  const make = t => (p = {}, s = {}) => h(t, p, s);

  const HTML = ["div","span","p","a","button","input","select","option","optgroup","textarea","label","form","fieldset","legend","ul","ol","li","dl","dt","dd","nav","header","footer","main","section","article","aside","details","summary","img","picture","source","video","audio","track","canvas","iframe","table","thead","tbody","tfoot","tr","td","th","colgroup","col","caption","h1","h2","h3","h4","h5","h6","small","strong","em","i","b","u","code","pre","blockquote","hr","br","sup","sub","time","progress","meter","dialog","template","slot"];
  const SVG  = ["svg","g","path","rect","circle","ellipse","line","polyline","polygon","text","defs","use","symbol","clipPath","mask","pattern","linearGradient","radialGradient","stop","filter","feGaussianBlur","feOffset","feMerge","feColorMatrix"];

  const api = {};
  for (const t of [...HTML, ...SVG]) {
    const U = t.charAt(0).toUpperCase() + t.slice(1);
    api[t] = make(t);
    api[U] = api[t];
  }

  // region mount bridge مع النواة
  const mountRegion = (app, uKey, mount, build, parent = null, opt = {}) => {
    app.registerRegion(uKey, mount, (state, ctx) => {
      const spec = build(state, ctx);
      if (spec == null) return "";
      if (spec instanceof Node)    return spec;
      if (Str(spec) || Arr(spec))  return spec;
      if (Obj(spec) && spec.__A)   return toNode(spec);
      return "";
    }, parent, opt);
    return app;
  };

  const proxy = new Proxy(api, {
    get(target, key) {
      // --- ✅ START: التصحيح ---
      // 1. تحقق من الأدوات والوظائف الخاصة أولاً
      if (key === 'toNode') return toNode;
      if (key === 'mountRegion') return mountRegion;
      if (key === 'h') return h;
      if (key === 'Fragment') return (p = {}, s = {}) => ({ __A: 1, tag: "#fragment", props: p, slots: pack(s) });
      if (key === 'component') return (fn) => (p = {}, s = {}) => fn(p, pack(s));
      if (key === 'cx') return j;
      if (key === 'defineTags') return arr => {
        if (!arr) return;
        for (const raw of toArr(arr)) {
          const t = String(raw).trim(); if (!t) continue;
          const U = t.charAt(0).toUpperCase() + t.slice(1);
          proxy[t] = make(t); proxy[U] = proxy[t];
        }
      };
      if (key === 'if')   return (cond, truthy, falsy = null) => cond ? truthy : falsy;
      if (key === 'show') return (cond, node) => cond ? node : null;
      if (key === 'each') return (list, map, keyFn) => {
        const arr = toArr(Fn(list) ? list() : list);
        const res = [];
        for (let i = 0; i < arr.length; i++) {
          const it = arr[i];
          const child = map(it, i);
          if (child && Obj(child) && child.__A && keyFn) {
            const kx = Fn(keyFn) ? keyFn(it, i) : (it && it[keyFn]);
            child.props = child.props || {};
            if (kx != null && child.props.key == null) child.props.key = String(kx);
          }
          res.push(child);
        }
        return res;
      };
      if (key === 't') return (ctx, i18nKey, vars) => (ctx && ctx.i18n && ctx.i18n.t) ? ctx.i18n.t(i18nKey, vars) : String(i18nKey);
      
      // 2. تحقق من وسوم HTML/SVG المعرفة مسبقًا
      if (key in target) {
        return target[key];
      }

      // 3. إذا لم يكن أي مما سبق، افترض أنه مكون مخصص (السلوك الافتراضي)
      return make(String(key));
      // --- ✅ END: التصحيح ---
    }
  });

  return Object.assign(proxy, { toNode, mountRegion });
}
  window.Mishkah = window.Mishkah || {};
  window.Mishkah.Atoms = create();
  window.Mishkah.Atoms.create = create;

})(window);

// DSL
// تبسيط قوي لبناء الواجهات فوق Atoms/Core، مع دعم i18n/RTL/Dark و twcss
(function (window) {
  "use strict";

  const Core = window.Mishkah && window.Mishkah.Core;
  const A = window.Mishkah && window.Mishkah.Atoms;
  const U = window.Mishkah && window.Mishkah.utils;
  const twcss = window.Mishkah && window.Mishkah.twcss;

  if (!Core || !A || !U) return;

  // ======= أدوات صغيرة =======
  const Arr = Array.isArray;
  const Fn = v => typeof v === "function";
  const Str = v => typeof v === "string" || typeof v === "number";
  const Obj = v => v && typeof v === "object" && !Arr(v);

  const toArr = v => v == null ? [] : Arr(v) ? v : [v];
  const j = (...xs) => xs.flat(Infinity).filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  const get = (o, p) => !p ? o : String(p).split(".").reduce((a, k) => (a && a[k] != null) ? a[k] : undefined, o);
  const set = (o, p, v) => { const ks = String(p).split("."); let t = o; for (let i = 0; i < ks.length - 1; i++) { const k = ks[i]; if (!Obj(t[k])) t[k] = {}; t = t[k] } t[ks[ks.length - 1]] = v; return o };
  const pick = (o, paths = []) => { const r = {}; for (const k of paths) r[k] = get(o, k); return r };
  const changedShallow = (a, b) => { const ka = Object.keys(a), kb = Object.keys(b); if (ka.length !== kb.length) return true; for (const k of ka) if (a[k] !== b[k]) return true; return false };

  const asTw = (value) => {
    if (twcss && twcss.tw) return twcss.tw(value);
    return String(value);
  };

  // ======= مفسر التوجيهات/الديركتيف =======
  function transformDirectives(node, state, appCtx) {
    if (!node || !Obj(node) || !node.props) return node;

    const p = node.props;
    const out = { ...p };
    const env = appCtx.env || {};
    const i18n = appCtx.i18n || (env && env.i18n) || null;

    // 1) events on:*  →  onClick / onInput ... أو dispatch بالاسم
    for (const k in p) {
      if (k.startsWith("on:")) {
        const ev = k.slice(3);
        const cap = ev[0].toUpperCase() + ev.slice(1);
        const handler = p[k];
        if (Str(handler)) {
          const actionId = String(handler);
          out["on" + cap] = e => {
            const fn = appCtx.actions && appCtx.actions[actionId];
            if (fn) fn(e); // actions مغلفة بالفعل بالtruth.set
          };
        } else if (Fn(handler)) {
          out["on" + cap] = handler;
        }
        delete out[k];
      }
    }

    // 2) model / bind:value  (مع أنواع)
    //   model="user.name"
    //   model:number="qty"
    //   model:checked="todo.done"
    for (const k in p) {
      if (k === "bind:value" || k === "model" || k.startsWith("model:")) {
        const type = (k === "bind:value" || k === "model") ? "text" : k.slice(6);
        const path = String(p[k]);
        const current = get(state, path);

        // value getter
        if (type === "checked") {
          out.checked = !!current;
        } else if (type === "number") {
          out.value = current ?? 0;
          out.inputMode = out.inputMode || "decimal";
        } else {
          out.value = current ?? "";
        }

        const normalize = (el) => {
          if (type === "checked") return !!el.checked;
          if (type === "number") return (el.value === "" ? 0 : +el.value);
          return el.value;
        };

        const prev = out.onInput;
        out.onInput = (e) => {
          if (prev) prev(e);
          appCtx.truth.set(s => {
            set(s, path, normalize(e.target));
            return { ...s };
          });
        };
        delete out[k];
      }
    }

    // 3) class:active أو class:foo
    for (const k in p) {
      if (k.startsWith("class:")) {
        const cls = k.slice(6);
        if (p[k]) out.class = out.class ? j(out.class, cls) : cls;
        delete out[k];
      }
    }

    // 4) style:prop="value"
    for (const k in p) {
      if (k.startsWith("style:")) {
        const prop = k.slice(6);
        out.style = out.style || {};
        out.style[prop] = p[k];
        delete out[k];
      }
    }

    // 5) tw="..." → دمج مع class
    if ("tw" in out) {
      const twv = Fn(out.tw) ? out.tw(state, appCtx) : out.tw;
      const cls = asTw(twv);
      out.class = out.class ? j(out.class, cls) : cls;
      delete out.tw;
    }

    // 6) t="key" + t:vars={{...}}  (i18n)
    if ("t" in out || "t:key" in out) {
      const key = out["t:key"] || out.t;
      const vars = out["t:vars"] || undefined;
      delete out["t:key"]; delete out["t:vars"]; delete out.t;

      let text = String(key);
      if (i18n && i18n.t) {
        try { text = i18n.t(String(key), vars) } catch (_) { text = String(key) }
      }
      // إن لم يوجد slot افتراضي نضع الترجمة
      const slots = node.slots || {};
      const hasContent = toArr(slots.default || []).length > 0;
      if (!hasContent) {
        return A.h(node.tag, out, { default: [text] });
      }
    }

    // 7) if/show
    if ("if" in out) {
      const cond = Fn(out.if) ? out.if(state, appCtx) : out.if;
      delete out.if;
      if (!cond) return null;
    }
    if ("show" in out) {
      const cond = Fn(out.show) ? out.show(state, appCtx) : out.show;
      delete out.show;
      if (!cond) return null;
    }

    // 8) html=  (يتوافق مع Atoms التي تتعامل مع p.html)
    if ("html" in out) {
      out.html = out.html && Obj(out.html) && "__html" in out.html ? out.html : { __html: String(out.html ?? "") };
    }

    // 9) for / each  → "item in path" أو مصفوفة مباشرة
    if ("for" in p || "each" in p) {
      const spec = String(p["for"] ?? p["each"]);
      const m = spec.match(/^(\w+)\s+in\s+(.+)$/);
      const list = m ? (get(state, m[2]) || []) : (get(state, spec) || []);
      const varName = m ? m[1] : "item";
      const items = toArr(list);
      const slots = node.slots || {};
      const def = toArr(slots.default || []);
      const rendered = items.map((item, idx) => {
        // نحقن {item,index} كمحتوى للـslot
        const kids = def.map(k => (Fn(k) ? k({ [varName]: item, index: idx }, state, appCtx) : k));
        return A.h(node.tag, out, { default: kids });
      });
      return A.Fragment ? A.Fragment({},{ default: rendered }) : { __A: 1, tag: "#fragment", props: {}, slots: { default: rendered } };
    }

    // 10) await:of / await  + pending/then/catch
    if ("await" in p || "await:of" in p) {
      const src = p["await:of"] ?? p["await"];
      const pending = p["await:pending"];
      const thenSlot = p["await:then"];
      const catchSlot = p["await:catch"];
      ["await", "await:of", "await:pending", "await:then", "await:catch"].forEach(k => delete out[k]);

      const prom = Str(src) ? get(state, String(src)) : src;
      if (!prom || !Fn(prom.then)) return null;

      // حالة سهلة: نعرض pending، ثم نعيد بناء المنطقة عند الاكتمال
      const key = Symbol("await_key");
      appCtx.__awaitKeys = appCtx.__awaitKeys || new Set();
      appCtx.__awaitKeys.add(key);
      prom.then(v => {
        if (appCtx.__awaitKeys && appCtx.__awaitKeys.has(key)) {
          appCtx.truth.set(s => s);
          appCtx.__awaitLast = { v };
        }
      }).catch(e => {
        if (appCtx.__awaitKeys && appCtx.__awaitKeys.has(key)) {
          appCtx.truth.set(s => s);
          appCtx.__awaitLast = { e };
        }
      });

      if (appCtx.__awaitLast && "v" in appCtx.__awaitLast && thenSlot) {
        const n = Fn(thenSlot) ? thenSlot(appCtx.__awaitLast.v, state, appCtx) : thenSlot;
        return Obj(n) && n.__A ? n : n;
      }
      if (appCtx.__awaitLast && "e" in appCtx.__awaitLast && catchSlot) {
        const n = Fn(catchSlot) ? catchSlot(appCtx.__awaitLast.e, state, appCtx) : catchSlot;
        return Obj(n) && n.__A ? n : n;
      }
      // pending
      return Obj(pending) && pending.__A ? pending : (Str(pending) || Arr(pending) ? pending : A.h(node.tag, out, { default: [pending] }));
    }

    // 11) fetch:of into=path on=mounted|click
    if ("fetch:of" in p || "fetch:src" in p || "fetch" in p) {
      const src = p["fetch:of"] ?? p["fetch:src"] ?? p["fetch"];
      const into = p["fetch:into"];
      const onEv = p["fetch:on"] || "mounted";
      ["fetch:of", "fetch:src", "fetch", "fetch:into", "fetch:on"].forEach(k => delete out[k]);

      const doFetch = (u) => Promise.resolve(Fn(u) ? u(state, appCtx) : u)
        .then(x => fetch(x)).then(r => r.json())
        .then(data => { if (into) appCtx.truth.set(s => { set(s, String(into), data); return { ...s } }) });

      if (onEv === "mounted") {
        const prev = out.onMounted;
        out.onMounted = (el) => { if (prev) prev(el); doFetch(src) };
      } else if (onEv === "click") {
        const prev = out.onClick;
        out.onClick = (e) => { if (prev) prev(e); doFetch(src) };
      }
    }

    // 12) use:behavior   (enhancers)  use:tip={opts}
    for (const k in p) {
      if (k.startsWith("use:")) {
        const name = k.slice(4);
        const enhancer = get(window, "Mishkah.behaviors." + name);
        if (Fn(enhancer)) {
          const args = p[k];
          const prevMounted = out.onMounted;
          const prevUnmounted = out.onUnmounted;
          out.onMounted = (el) => {
            if (prevMounted) prevMounted(el);
            try {
              const dispose = enhancer(el, args, { state, ctx: appCtx });
              if (Fn(dispose)) {
                el.__disposeEnhancers = el.__disposeEnhancers || [];
                el.__disposeEnhancers.push(dispose);
              }
            } catch (_) {}
          };
          out.onUnmounted = (el) => {
            if (prevUnmounted) prevUnmounted(el);
            (el.__disposeEnhancers || []).forEach(fn => { try { fn() } catch (_) {} });
          };
        }
        delete out[k];
      }
    }

    // 13) router helpers
    if ("go:to" in p) {
      const to = String(p["go:to"]);
      const prev = out.onClick;
      out.onClick = (e) => { if (prev) prev(e); e && e.preventDefault && e.preventDefault(); if (appCtx.router && appCtx.router.navigate) appCtx.router.navigate(to) };
      delete out["go:to"];
    }
    if ("match:path" in p) {
      const re = new RegExp(String(p["match:path"]));
      delete out["match:path"];
      if (!re.test(appCtx.router?.path || "")) return null;
    }
    if ("if:route" in p) {
      const name = String(p["if:route"]);
      delete out["if:route"];
      if ((appCtx.router && appCtx.router.name) !== name) return null;
    }

    // 14) المعالجة التراجعية للأبناء/الفتحات
    const slots = node.slots || {};
    const def = toArr(slots.default || []).map(c => Str(c) || Arr(c) ? c : transformDirectives(c, state, appCtx)).filter(Boolean);
    const rest = {};
    for (const sk in slots) {
      if (sk === "default") continue;
      rest[sk] = toArr(slots[sk] || []).map(c => Str(c) || Arr(c) ? c : transformDirectives(c, state, appCtx)).filter(Boolean);
    }

    return A.h(node.tag, out, Object.assign({ default: def }, rest));
  }

  // ======= واجهة الموديول عالية المستوى =======
  function buildModule(app, name) {
    let _state = {};
    let _actions = {};
    let _selectors = {};
    let _css = "";
    let _html = null; // دالة تبني spec مباشرة
    let _view = null; // دالة إرجاع Atoms-spec
    const _watches = [];

    const selectorsView = (s) => {
      const out = {};
      for (const k in _selectors) out[k] = _selectors[k](s);
      return out;
    };

    const runWatches = (prev, next) => {
      for (const w of _watches) {
        if (w.when && !w.when(next, prev)) continue;
        try { w.run(next, prev) } catch (_) {}
      }
    };

    function buildSpec(s, ctx) {
      if (_html) return _html(s, { a: app.actions, name, ctx });
      const v = _view ? _view(s, app.actions, selectorsView(s), ctx) : null;
      if (!v) return null;
      if (Obj(v) && v.__A) return transformDirectives(v, s, ctx);
      return v;
    }

    // تخزين slice مريح
    function makeStore(ns, init) {
      const key = "mishkah:mod:" + name + ":" + ns;
      try {
        const raw = localStorage.getItem(key);
        if (raw != null) {
          const parsed = JSON.parse(raw);
          if (Obj(parsed)) init = parsed;
        }
      } catch (_) { }
      if (!_state[ns]) _state[ns] = init;

      const path = ns;
      const storeAPI = {
        get: () => get(app.truth.get(), path),
        set: (val) => app.truth.set(s => { set(s, path, Fn(val) ? val(get(s, path)) : val); return { ...s } }),
        bind: (k) => ({
          value: (s) => get(s, path + "." + k),
          onInput: (e) => app.truth.set(s => { set(s, path + "." + k, e.target.value); return { ...s } })
        }),
        subscribe: (fn) => app.truth.subscribe(({ state }) => fn(get(state, path))),
        persist: (storageKey) => {
          const sk = storageKey || key;
          app.truth.subscribe(({ state }) => {
            try { localStorage.setItem(sk, JSON.stringify(get(state, path))) } catch (_) { }
          });
          return storeAPI;
        }
      };
      return storeAPI;
    }

    const api = {
      state(v) { _state = v || {}; return api },
      actions(map) { _actions = map || {}; return api },
      selectors(map) { _selectors = map || {}; return api },
      css(txt) { _css = String(txt || ""); return api },
      html(tpl) { _html = tpl; return api },
      view(fn) { _view = fn; return api },
      watch(when, run) { _watches.push({ when, run }); return api },
      task(fn, deps) {
        let prev = null;
        _watches.push({
          when: (n, p) => {
            const next = pick(n, deps || []);
            const ok = prev == null || changedShallow(prev, next);
            prev = next;
            return ok;
          },
          run: (n, p) => { fn(n, p) }
        });
        return api;
      },
      store: makeStore,
      router(map, opts = {}) {
        const routes = map || {};
        const parse = () => {
          const h = location.hash.replace(/^#/, "") || "/";
          for (const k in routes) {
            const r = routes[k];
            if (r && r.test && r.test(h)) return { name: k, path: h, params: (r.exec(h) || []).groups || {} }
          }
          return { name: null, path: h, params: {} }
        };
        const nav = (to) => { location.hash = to };
        app.router = { ...parse(), navigate: nav };

        const onHash = () => {
          app.router = Object.assign(app.router, parse());
          app.helpers.mark(name);
        };
        window.addEventListener("hashchange", onHash);
        if (opts.init !== false) onHash();
        return api;
      },
      mount(mountSel, parent = null, opt = {}) {
        // 1) اعداد truth/engine من النواة إن لم تُنشأ
        if (!app._core_created) {
          // لو أنشأ المستخدم app عبر Core.createApp فهنستخدمه
          // وإلا ننشئ واحداً بخيارات بيئية معتمدة
          if (!app.truth) {
            const core = Core.createApp({
              root: null,
              initial: _state,
              dictionaries: app.dictionaries,
              locale: app.locale,
              dir: app.dir,
              theme: app.theme,
              persistEnv: true
            });
            Object.assign(app, core);
            app._core_created = true;
          } else {
            // عند وجود truth سابق: دمج حالة الموديول
            app.truth.set(s => Object.assign({}, s, _state));
          }
        } else {
          app.truth.set(s => Object.assign({}, s, _state));
        }

        // 2) تغليف الأوامر لتصبح actions جاهزة للاستدعاء
        app._rawActions = app._rawActions || {};
        app.actions = app.actions || {};
        for (const k in _actions) {
          app._rawActions[name + ":" + k] = _actions[k];
          app.actions[k] = (...args) => app.truth.set(s => {
            const fn = _actions[k];
            const r = fn ? fn(s, ...args) : s;
            return r === undefined ? s : r;
          });
        }

        // 3) حقن CSS نطاقي
        if (_css && mountSel) {
          const id = "mishkah-mod-" + name + "-css";
          let el = document.getElementById(id);
          if (!el) { el = document.createElement("style"); el.id = id; document.head.appendChild(el) }
          // :scope → [data-m="<name>"]
          el.textContent = _css.replace(/:scope/g, '[data-m="' + name + '"]');
        }

        // 4) تسجيل المنطقة عبر Atoms → Engine
        const build = (s, ctx) => {
          // ctx يحتوي env/i18n حسب Core
          return buildSpec(s, Object.assign({ truth: app.truth, actions: app.actions, router: app.router, env: app.env, i18n: app.i18n }, ctx));
        };

        // نغلف الإخراج ليحمل data-m للموديول
        const regionBuild = (s, ctx) => {
          const spec = build(s, ctx);
          if (!spec) return "";
          const n = (Obj(spec) && spec.__A) ? spec : (Str(spec) || Arr(spec) ? A.div({}, { default: toArr(spec) }) : A.div());
          // أضف علامة نطاق CSS
          if (n && n.props) {
            n.props = n.props || {};
            n.props["data-m"] = n.props["data-m"] || name;
          }
          return transformDirectives(n, s, Object.assign({ truth: app.truth, actions: app.actions, router: app.router, env: app.env, i18n: app.i18n }, ctx));
        };

        A.mountRegion(app, name, mountSel, (s, ctx) => regionBuild(s, ctx), parent, opt);

        // 5) مراقبة الحالة لتشغيل watch
        if (app.truth.subscribe) {
          let prev = app.truth.get();
          app.truth.subscribe(({ state }) => { runWatches(prev, state); prev = state });
        }

        // 6) أول رندر
        app.helpers.mark(name);
        return api;
      }
    };

    return api;
  }

  // ======= واجهة تطبيق DSL =======
  const DSLApp = {
    // إنشاء تطبيق Core بالنيابة، أو الربط بتطبيق موجود
    create(opts = {}) {
      const app = Core.createApp({
        root: opts.root || null,
        initial: opts.initial || {},
        commands: opts.commands || {},
        locale: opts.locale || "en",
        dir: opts.dir || "auto",
        theme: opts.theme || "auto",
        dictionaries: opts.dictionaries || {},
        persistEnv: opts.persistEnv !== false
      });
      return app;
    },
    attach(app) { this.__app = app; return this },
    module(name) { return buildModule(this.__app || this.create(), name) },
    // كِتابة DSL مباشرة بدون موديول (للأجزاء الصغيرة)
    h: A.h,
    Fragment: A.Fragment,
    cx: j
  };

  // كشف
  window.Mishkah = window.Mishkah || {};
  window.Mishkah.DSL = DSLApp;

})(window);


// jsonToView.js
// محول JSON → Atoms-spec مع ذكاء توجيهات (directives) ودعم i18n/RTL/Dark/twcss.
// الهدف: كتابة واجهات ب JSON بسيط ثم تحويله إلى شجرة DOM فعّالة عبر Atoms.

(function (window) {
  "use strict";

  const A = window.Mishkah && window.Mishkah.Atoms;
  const U = window.Mishkah && window.Mishkah.utils;
  const twcss = window.Mishkah && window.Mishkah.twcss;
  if (!A || !U) return;

  // ===== Helpers =====
  const Arr = Array.isArray;
  const Fn = v => typeof v === "function";
  const Str = v => typeof v === "string" || typeof v === "number";
  const Obj = v => v && typeof v === "object" && !Arr(v);

  const toArr = v => (v == null ? [] : Arr(v) ? v : [v]);
  const j = (...xs) => xs.flat(Infinity).filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  const get = (o, p) => !p ? o : String(p).split(".").reduce((a, k) => (a && k in a) ? a[k] : undefined, o);
  const set = (o, p, v) => { const ks = String(p).split("."); let t = o; for (let i = 0; i < ks.length - 1; i++) { const k = ks[i]; if (!Obj(t[k])) t[k] = {}; t = t[k] } t[ks[ks.length - 1]] = v; return o };

  const asTw = (value) => (twcss && twcss.tw) ? twcss.tw(value) : String(value);

  const normProps = (p) => {
    if (!p) return {};
    const out = {};
    for (const k in p) {
      const v = p[k];
      if (v == null) continue;
      if (k === "className") out.class = v;
      else out[k] = v;
    }
    return out;
  };

  // ========= directive runtime =========
  function pHandler(app, aid) {
    return e => {
      if (!app || !app.truth) return;
      const act = (app._rawActions && app._rawActions[aid]) || app._actions?.[aid] || app.actions?.[aid];
      if (Fn(act)) {
        app.truth.set(s => {
          const r = act(s, e);
          return r === undefined ? s : r;
        });
      }
    };
  }

  function bindValue(app, path, kind = "text") {
    const getter = (s) => {
      const cur = get(s, path);
      if (kind === "checked") return !!cur;
      if (kind === "number") return cur ?? 0;
      return cur ?? "";
    };
    const onInput = (e) => {
      if (!app || !app.truth) return;
      app.truth.set(s => {
        let val;
        if (kind === "checked") val = !!e.target.checked;
        else if (kind === "number") val = (e.target.value === "" ? 0 : +e.target.value);
        else val = e.target.value;
        set(s, path, val);
        return { ...s };
      });
    };
    return { value: getter, onInput };
  }

  // ========= Slots =========
  function slotsFrom(x, state, app) {
    if (x == null) return { default: [] };
    if (Arr(x)) return { default: x.map(n => fromJSON(n, state, app)) };
    if (Obj(x)) {
      const o = {};
      if ("default" in x) o.default = toArr(x.default).map(n => fromJSON(n, state, app));
      else o.default = [];
      for (const k in x) if (k !== "default") o[k] = toArr(x[k]).map(n => fromJSON(n, state, app));
      return o;
    }
    return { default: [fromJSON(x, state, app)] };
  }

  // ========= Transform directives on a tag =========
  function transformDirectives(tag, props, slots, state, app) {
    if (!props) return A.h(tag, {}, slots);

    const p = { ...props };
    const out = {};
    const i18n = app && app.i18n;

    // events: on:click="action" | on:input=fn
    for (const k in p) {
      if (k.startsWith("on:")) {
        const ev = k.slice(3);
        const cap = ev[0].toUpperCase() + ev.slice(1);
        const v = p[k];
        out["on" + cap] = Str(v) ? pHandler(app, String(v)) : (Fn(v) ? v : undefined);
      }
    }

    // model / bind:value / model:number / model:checked
    for (const k in p) {
      if (k === "bind:value" || k === "model" || k.startsWith("model:")) {
        const kind = (k === "bind:value" || k === "model") ? "text" : k.slice(6);
        const path = String(p[k]);
        const w = bindValue(app, path, kind);
        out.value = w.value(state);
        if (kind === "checked") out.checked = !!out.value;
        out.onInput = w.onInput;
      }
    }

    // class:active / class:foo
    for (const k in p) {
      if (k.startsWith("class:")) {
        const cn = k.slice(6);
        if (p[k]) out.class = out.class ? j(out.class, cn) : cn;
      }
    }

    // style:prop="val"
    for (const k in p) {
      if (k.startsWith("style:")) {
        const prop = k.slice(6);
        out.style = out.style || {};
        out.style[prop] = p[k];
      }
    }

    // tw="..." -> merge to class
    if ("tw" in p) {
      const v = Fn(p.tw) ? p.tw(state, app) : p.tw;
      const cls = asTw(v);
      out.class = out.class ? j(out.class, cls) : cls;
    }

    // c (plain class concat)
    if ("c" in p) {
      const v = Fn(p.c) ? p.c(state, app) : p.c;
      out.class = out.class ? j(out.class, v) : String(v);
    }

    // i18n: t="key" / t:key, t:vars
    if ("t" in p || "t:key" in p) {
      const key = p["t:key"] || p.t;
      const vars = p["t:vars"];
      let text = String(key);
      if (i18n && i18n.t) { try { text = i18n.t(String(key), vars) } catch (_) { text = String(key) } }
      const hasContent = toArr(slots?.default || []).length > 0;
      if (!hasContent) slots = Object.assign({}, slots || {}, { default: [text] });
    }

    // if/show
    if ("if" in p) { const cond = Fn(p.if) ? p.if(state, app) : p.if; if (!cond) return null; }
    if ("show" in p) { const cond = Fn(p.show) ? p.show(state, app) : p.show; if (!cond) return null; }

    // html (innerHTML)
    if ("html" in p) { const raw = p.html; out.html = raw && Obj(raw) && "__html" in raw ? raw : { __html: String(raw ?? "") } }

    // for/each → "item in path" أو path مباشرة
    if ("for" in p || "each" in p) {
      const spec = String(p["for"] ?? p["each"]);
      const m = spec.match(/^(\w+)\s+in\s+(.+)$/);
      const list = m ? (get(state, m[2]) || []) : (get(state, spec) || []);
      const varName = m ? m[1] : "item";

      const body = toArr(slots?.default || []);
      const rendered = toArr(list).map((item, idx) => {
        const kids = body.map(ch => (Fn(ch) ? ch({ [varName]: item, index: idx }, state, app) : ch));
        return A.h(tag, out, { default: kids });
      });
      return A.h("#fragment", {}, { default: rendered });
    }

    // await / await:of + pending/then/catch
    if ("await" in p || "await:of" in p) {
      const src = p["await:of"] ?? p["await"];
      const pending = p["await:pending"];
      const thenSlot = p["await:then"];
      const catchSlot = p["await:catch"];

      const prom = Str(src) ? get(state, String(src)) : src;
      if (!prom || !Fn(prom.then)) return null;

      const key = Symbol("await_key");
      app.__awaitKeys = app.__awaitKeys || new Set();
      app.__awaitKeys.add(key);
      prom.then(v => {
        if (app.__awaitKeys && app.__awaitKeys.has(key)) {
          app.truth && app.truth.set(s => s);
          app.__awaitLast = { v };
        }
      }).catch(e => {
        if (app.__awaitKeys && app.__awaitKeys.has(key)) {
          app.truth && app.truth.set(s => s);
          app.__awaitLast = { e };
        }
      });

      if (app.__awaitLast && "v" in app.__awaitLast && thenSlot) {
        const n = Fn(thenSlot) ? thenSlot(app.__awaitLast.v, state, app) : thenSlot;
        return Obj(n) && n.__A ? n : n;
      }
      if (app.__awaitLast && "e" in app.__awaitLast && catchSlot) {
        const n = Fn(catchSlot) ? catchSlot(app.__awaitLast.e, state, app) : catchSlot;
        return Obj(n) && n.__A ? n : n;
      }
      // pending
      if (pending != null) return Obj(pending) && pending.__A ? pending : (Str(pending) || Arr(pending) ? pending : A.h("div", {}, { default: [pending] }));
      return null;
    }

    // animate:in/out/toggle  (hooks)
    for (const k in p) {
      if (!k.startsWith("animate:")) continue;
      const t = k.split(":")[1];
      const v = p[k];
      if (t === "in") {
        const clsIn = String(v);
        const prev = out.onMounted;
        out.onMounted = (el) => { if (prev) prev(el); el.classList.add(clsIn); requestAnimationFrame(() => el.classList.remove(clsIn)) };
      } else if (t === "out") {
        const clsOut = String(v);
        const prev = out.onUnmounted;
        out.onUnmounted = (el) => { if (prev) prev(el); el.classList.add(clsOut) };
      } else if (t === "toggle") {
        out["data-animate-toggle"] = String(v);
      }
    }

    // fetch:of/src into=path on=mounted|click
    if ("fetch" in p || "fetch:of" in p || "fetch:src" in p) {
      const src = p["fetch:of"] ?? p["fetch:src"] ?? p["fetch"];
      const into = p["fetch:into"];
      const onEv = p["fetch:on"] || "mounted";
      const doFetch = (u) => Promise.resolve(Fn(u) ? u(state, app) : u)
        .then(x => fetch(x)).then(r => r.json())
        .then(data => { if (into && app && app.truth) app.truth.set(st => { set(st, String(into), data); return { ...st } }) });
      if (onEv === "mounted") {
        const prev = out.onMounted;
        out.onMounted = (el) => { if (prev) prev(el); doFetch(src) };
      } else if (onEv === "click") {
        const prev = out.onClick;
        out.onClick = (e) => { if (prev) prev(e); doFetch(src) };
      }
    }

    // use:* enhancers
    for (const k in p) {
      if (!k.startsWith("use:")) continue;
      const name = k.slice(4);
      const enhancer = U && get(window, "Mishkah.behaviors." + name);
      if (Fn(enhancer)) {
        const args = p[k];
        const prevMounted = out.onMounted;
        const prevUnmounted = out.onUnmounted;
        out.onMounted = (el) => {
          if (prevMounted) prevMounted(el);
          try {
            const dispose = enhancer(el, args, { state, app });
            if (Fn(dispose)) {
              el.__disposeEnhancers = el.__disposeEnhancers || [];
              el.__disposeEnhancers.push(dispose);
            }
          } catch (_) { }
        };
        out.onUnmounted = (el) => {
          if (prevUnmounted) prevUnmounted(el);
          (el.__disposeEnhancers || []).forEach(fn => { try { fn() } catch (_) { } });
        };
      }
    }

    // routing helpers
    if ("go:to" in p) {
      const to = String(p["go:to"]);
      const prev = out.onClick;
      out.onClick = (e) => { if (prev) prev(e); e && e.preventDefault && e.preventDefault(); if (app && app.router && app.router.navigate) app.router.navigate(to) };
    }
    if ("match:path" in p) {
      const re = new RegExp(String(p["match:path"]));
      if (!(app && re.test(app.router?.path || ""))) return null;
    }
    if ("if:route" in p) {
      const name = String(p["if:route"]);
      if ((app && app.router && app.router.name) !== name) return null;
    }

    // copy the rest (attributes not handled above)
    for (const k in p) {
      if (k.startsWith("on:") || k === "bind:value" || k === "model" || k.startsWith("model:") || k.startsWith("class:") || k.startsWith("style:")
        || k === "tw" || k === "c" || k === "t" || k === "t:key" || k === "t:vars" || k === "if" || k === "show" || k === "html"
        || k === "for" || k === "each" || k === "await" || k === "await:of" || k === "await:pending" || k === "await:then" || k === "await:catch"
        || k.startsWith("animate:") || k === "fetch" || k === "fetch:of" || k === "fetch:src" || k === "fetch:into" || k === "fetch:on"
        || k.startsWith("use:") || k === "go:to" || k === "match:path" || k === "if:route") continue;

      // keep everything else
      out[k] = p[k];
    }

    // toggle animation class if requested
    if (out["data-animate-toggle"]) {
      const [onCls, offCls] = String(out["data-animate-toggle"]).split("|");
      if (props["class:active"]) {
        out.class = out.class ? j(out.class, (props["class:active"] ? onCls : (offCls || ""))) : (props["class:active"] ? onCls : (offCls || ""));
      }
      delete out["data-animate-toggle"];
    }

    // children
    const s = slots || { default: [] };
    const def = toArr(s.default || []).map(x => (Str(x) || Arr(x)) ? x : fromJSON(x, state, app)).filter(Boolean);
    const rest = {};
    for (const sk in s) {
      if (sk === "default") continue;
      rest[sk] = toArr(s[sk] || []).map(x => (Str(x) || Arr(x)) ? x : fromJSON(x, state, app)).filter(Boolean);
    }

    return A.h(tag, out, Object.assign({ default: def }, rest));
  }

  // ========= JSON shapes =========
  function fromArray(node, state, app) {
    const t = node[0];
    if (!t) return null;
    let i = 1, p = {}, kids = [];
    if (Obj(node[1])) { p = node[1] || {}; i = 2 }
    for (let k = i; k < node.length; k++) kids.push(fromJSON(node[k], state, app));
    const props = normProps(p);
    const slots = { default: kids };
    return transformDirectives(t, props, slots, state, app);
  }

  function fromObject(node, state, app) {
    const tag = node.tag || node.t || node.element || node.e || "div";
    const p = normProps(node.props || node.p || {});
    if (node.key != null) p.key = node.key;
    if (node.as != null) p.as = node.as;
    if (node.tw != null) p.tw = node.tw;
    if (node.c != null && !p.c) p.c = node.c;

    const s = node.slots || node.s;
    const c = node.children || node.c2 || node.content; // دعم أسماء بديلة
    const slots = s ? slotsFrom(s, state, app) : slotsFrom(c, state, app);
    return transformDirectives(tag, p, slots, state, app);
  }

  function fromJSON(node, state, app) {
    if (node == null || node === false) return null;
    if (Str(node)) return String(node);
    if (Arr(node)) return fromArray(node, state, app);
    if (Obj(node)) return fromObject(node, state, app);
    return String(node);
  }

  // ========= Public API =========
  function create() {
    let _app = null;

    function setApp(app) { _app = app; return api }

    function toSpec(json, state) {
      return fromJSON(json, state, _app || {});
    }

    function render(json, state) {
      const sp = toSpec(json, state);
      return A.toNode(sp);
    }

    function mountRegion(app, uKey, mount, build, parent = null, opt = {}) {
      A.mountRegion(app, uKey, mount, (s, ctx) => {
        const jv = build(s, ctx);
        if (jv == null) return "";
        const sp = fromJSON(jv, s, Object.assign({ i18n: app.i18n, router: app.router }, app));
        return A.toNode(sp);
      }, parent, opt);
    }

    // compile(json) → (state, app) => spec  (تحويل مسبق لتحسين الأداء)
    function compile(json) {
      // بسيط: يغلّف الاستدعاء الحالي. لاحقًا يمكن توليد كود أسرع.
      return (state, app) => fromJSON(json, state, app);
    }

    const api = { setApp, toSpec, render, mountRegion, compile };
    return api;
  }

  window.Mishkah = window.Mishkah || {};
  window.Mishkah.JSONView = create();
})(window);


// mishkah-html-engine.js
(function (window) {
  "use strict";

  const A   = window.Mishkah && window.Mishkah.Atoms;
  const JV  = window.Mishkah && window.Mishkah.JSONView;
  const U   = window.Mishkah && window.Mishkah.utils;
  if (!A || !JV || !U) return;

  // Registry خفيف للمكوّنات (Functions ترجع Atoms-spec أو JSON-spec)
  const _Components = new Map();
  function registerComponent(name, fn){ _Components.set(String(name), fn); return true }
  function getComponent(name, ctx){
    return (ctx && ctx.components && ctx.components[name])
        || _Components.get(name)
        || (window.Mishkah && window.Mishkah.components && window.Mishkah.components[name]);
  }

  // ===== Helpers =====
  const Arr = Array.isArray;
  const toArr = v => v == null ? [] : Arr(v) ? v : [v];

  function attrsToProps(el){
    const p = {};
    for (const a of el.attributes){
      let k = a.name, v = a.value;
      if (k === "class") p.class = v;
      else if (k === "style") p.style = v;
      else if (k === "is") { p["m:is"] = v; }                 // HTML native -> محركنا
      else if (k.startsWith("m:")) { p[k.slice(2)] = v; }     // m:if -> if, m:for -> for, m:await:of -> await:of ...
      else p[k] = v;                                          // on:click, model:number, t:key, tw, data-*, aria-*
    }
    return p;
  }

  function isComponentTag(tag){
    // اعتبره كمكوّن لو يبدأ بحرف كبير أو فيه Dash أو x-*
    return /[A-Z]/.test(tag[0]) || tag.includes("-") || tag.startsWith("x-");
  }

  // يدعم <template slot="name"> كـ Slots مسماة
  function extractSlots(el){
    const named = {};
    const def = [];
    for (const child of el.childNodes){
      if (child.nodeType === 1 && child.tagName.toLowerCase() === "template" && child.hasAttribute("slot")){
        const name = child.getAttribute("slot");
        const arr = [];
        for (const n of child.content.childNodes){ const v = htmlNodeToJSON(n); if (v != null) arr.push(v); }
        named[name] = arr;
      } else {
        const v = htmlNodeToJSON(child);
        if (v != null) def.push(v);
      }
    }
    return Object.assign({ default: def }, named);
  }

  function htmlNodeToJSON(node){
    if (node.nodeType === 3){ // نص
      const t = node.nodeValue;
      if (!t || !t.trim()) return null;
      return t;
    }
    if (node.nodeType !== 1) return null;
    const tag = node.tagName.toLowerCase();
    const p   = attrsToProps(node);
    const s   = extractSlots(node);
    return { t: tag, p, s };
  }

  // توسيع المكونات قبل تمريرها لـ JSONView (نستدعي دالة المكوّن)
  function expandComponents(spec, ctx){
    if (spec == null) return spec;
    if (Array.isArray(spec)) return spec.map(n => expandComponents(n, ctx));
    if (typeof spec === "string") return spec;
    if (typeof spec !== "object") return spec;

    const tag = spec.t || spec.tag;
    const p   = spec.p || spec.props || {};
    const s   = spec.s || spec.slots || {};
    const compName = p["m:is"] || (isComponentTag(tag) ? tag : null);

    if (compName){
      const fn = getComponent(compName, ctx);
      if (typeof fn === "function"){
        const cleanProps = Object.assign({}, p);
        delete cleanProps["m:is"];
        const expandedSlots = {};
        for (const k in s) expandedSlots[k] = expandComponents(s[k], ctx);
        // fn(props, slots, ctx) => Atoms-spec أو JSON-spec
        return fn(cleanProps, expandedSlots, ctx);
      }
    }

    const out = { t: tag, p, s: {} };
    for (const k in s) out.s[k] = expandComponents(s[k], ctx);
    return out;
  }

  function scopeCSS(name, css){
    if (!css) return "";
    const id = 'mishkah-html-style-'+name;
    if (document.getElementById(id)) return id;
    const tag = document.createElement("style");
    tag.id = id;
    tag.textContent = (U.scopeCSS ? U.scopeCSS(name, css) : css.replace(/:scope/g, '[data-m="'+name+'"]'));
    document.head.appendChild(tag);
    return id;
  }

  // compile: يحوّل HTML إلى ريندرر يرجّع Atoms-spec (يمر على JSONView للتوجيهات)
  function compile(html, options = {}){
    const tpl = document.createElement("template");
    tpl.innerHTML = String(html).trim();

    const roots = Array.from(tpl.content.childNodes)
      .filter(n => n.nodeType === 1 || (n.nodeType === 3 && n.nodeValue.trim() !== ""));

    let json;
    if (roots.length === 1){
      json = htmlNodeToJSON(roots[0]);
    } else {
      json = { t: "div", p: options.name ? { "data-m": options.name } : {}, s: { default: roots.map(htmlNodeToJSON).filter(Boolean) } };
    }

    if (options.name){
      json.p = json.p || {};
      json.p["data-m"] = json.p["data-m"] || options.name;
      if (options.css) scopeCSS(options.name, options.css);
    }

    // يرجّع دالة: (state, ctx) => Atoms-spec
    return (state, ctx = {}) => {
      const ctxAll = Object.assign({}, ctx, { components: options.components || ctx.components });
      const withComps = expandComponents(json, ctxAll);

      // JSONView يتوقع {tag, props, slots}
      function normalize(n){
        if (n == null) return null;
        if (Array.isArray(n)) return n.map(normalize);
        if (typeof n === "string") return n;
        if (typeof n !== "object") return String(n);
        const tag = n.t || n.tag;
        const props = n.p || n.props || {};
        const slotsSrc = n.s || n.slots || {};
        const slots = {};
        for (const k in slotsSrc){
          const v = slotsSrc[k];
          slots[k] = Array.isArray(v) ? v.map(normalize) : normalize(v);
        }
        return { tag, props, slots };
      }
      const norm = normalize(withComps);
      return JV.toSpec(norm, state); // هنا تُطبق كل التوجيهات: if/for/await/on:/model:/tw/t:/...
    };
  }

  // mountRegion: تسهيل تركيب منطقة HTML مباشرة
  function mountRegion(app, uKey, mount, html, parent = null, opt = {}, options = {}){
    const render = compile(html, options);
    A.mountRegion(app, uKey, mount, (s, ctx) => {
      const spec = render(s, Object.assign({ truth: app.truth, actions: app.actions, router: app.router, i18n: app.i18n, env: app.env }, ctx));
      return A.toNode(spec);
    }, parent, opt);
  }

  window.Mishkah = window.Mishkah || {};
  window.Mishkah.HTMLEngine = {
    compile,                   // (html, {name, css, components}) => (state, ctx)=>Atoms-spec
    mountRegion,               // تكامل سريع مع Core/Atoms
    registerComponent,         // تسجيل مكوّنات للفيو HTML
    unregisterComponent: (n)=>{ _Components.delete(String(n)); return true; },
    components: ()=> Array.from(_Components.keys())
  };
})(window);

// components-v5.js
(function (window) {
  "use strict";

  const M = window.Mishkah || (window.Mishkah = {});
  const Core  = M.Core || null;
  const U     = M.utils || {};
  const twcss = M.twcss || null;
  const A     = M.Atoms || null; // h() + toNode + mountRegion
  if (!A) { console.warn("[Mishkah.Comp] Atoms required."); return; }
  if (!twcss) { console.warn("[Mishkah.Comp] twcss recommended for RTL/Dark/Tokens."); }

  // ========= helpers =========
  const isArr = Array.isArray;
  const isObj = v => v && typeof v === "object" && !Array.isArray(v);
  const isFn  = v => typeof v === "function";
  const isStr = v => typeof v === "string" || typeof v === "number";
  const toArr = v => v == null ? [] : isArr(v) ? v : [v];
  const asSlots = (slots)=> slots && isObj(slots) ? slots : { default: toArr(slots && slots.default ? slots.default : slots) };
  const C     = (...xs)=> xs.filter(Boolean).join(" ");
  const TW    = (cls)=>({ tw: cls }); // tailwind adapter (twcss)
  const t     = (k, vars, app) => (app && app.i18n && isFn(app.i18n.t)) ? app.i18n.t(k, vars) : (vars && vars.fallback) || k;
  const range = (n, start=1) => Array.from({length:n}, (_,i)=> i+start);

  // ========= registry (mole/tissue/organ) =========
  const R = { mole:Object.create(null), tissue:Object.create(null), organ:Object.create(null) };
  const Util = Object.create(null);
  function reg(kind,name,fn){ if(!name||!fn) return; R[kind][name]=fn }
  function get(kind,name){ return R[kind][name] || R.mole[name] || R.tissue[name] || R.organ[name] }
  function call(name,p={},s={},state,app){
    const fn=get("mole",name)||get("tissue",name)||get("organ",name);
    if(!fn){ return A.Div(TW("text-rose-600"), { default:["?", String(name)] }); }
    return fn(A,state,app,p,s);
  }
  const Comp = {
    mole:{ define:(n,fn)=>reg("mole",n,fn), list:()=>Object.keys(R.mole) },
    tissue:{ define:(n,fn)=>reg("tissue",n,fn), list:()=>Object.keys(R.tissue) },
    organ:{ define:(n,fn)=>reg("organ",n,fn), list:()=>Object.keys(R.organ) },
    call, registry:R
  };

  function exposeUtil(name,value){
    if(!name) return;
    Util[name] = value;
    Object.defineProperty(Comp.util, name, {
      configurable:true,
      enumerable:true,
      get:()=>Util[name],
      set:(v)=>{ Util[name] = v; }
    });
  }

  Comp.util = {
    register: exposeUtil,
    get: (name)=>Util[name],
    list: ()=>Object.keys(Util)
  };

  // ========= DataSource: AJAX + mapping =========
  const DataSource = {
    async fetch({ url, method='GET', query, body, headers, timeout, withCredentials, map }) {
      if (!U.ajax) throw new Error("[Mishkah.Comp] utils.ajax required");
      const res = await U.ajax(url, {
        method, headers, query, body, timeout, withCredentials, responseType: 'json'
      });
      return isFn(map) ? map(res) : res;
    }
  };

  // ========= Export helpers =========
  const Exporter = {
    toCSV(rows, columns){
      const sep = ",";
      const head = (columns||[]).map(c=>'"'+String(c.title||c.key).replace(/"/g,'""')+'"').join(sep);
      const body = (rows||[]).map(r=> (columns||[]).map(c=>{
        const v = (r||{})[c.key]; return '"'+String(v==null?"":v).replace(/"/g,'""')+'"';
      }).join(sep)).join("\n");
      return head+"\n"+body;
    },
    csv(rows, cols, filename="data.csv"){ const csv=this.toCSV(rows,cols); U.download && U.download(csv, filename, "text/csv;charset=utf-8"); },
    xls(rows, cols, filename="data.xls"){ const csv=this.toCSV(rows,cols); U.download && U.download(csv, filename, "application/vnd.ms-excel"); },
    printHTML(html){
      const w = window.open("", "_blank"); if(!w) return;
      w.document.write(String(html)); w.document.close(); w.focus(); w.print(); w.close();
    }
  };

  // ============== Mole (Primitives) ==============
  
  
  Comp.mole.define("Icon", (A,s,app,p={},sl={}) =>
    A.Span({ role:"img", "aria-label":p.label||p.name||"", class:C(p.class), ...TW(p.tw||"") }, { default:[ p.char||"•" ] })
  );

  Comp.mole.define("Button", (A,s,app,p={},sl={}) =>
    A.Button(Object.assign({
      type: p.type||"button",
      class: C("inline-flex items-center justify-center rounded-xl font-semibold", p.class)
    }, TW(p.tw || "btn btn/primary px4 py2"), p), sl.default || [p.text||t("ui.button",{fallback:"Button"},app)])
  );

  Comp.mole.define("Input", (A,s,app,p={},sl={}) =>
    A.Input(Object.assign({ class: C("w-full rounded-xl border px-3 py-2", p.class) }, TW(p.tw||"border-slate-300 f:ring-2 f:ring-indigo-500"), p))
  );

  Comp.mole.define("SelectBase", (A,s,app,p={},sl={}) =>
    A.Select(Object.assign({ class: C("w-full rounded-xl border px-3 py-2", p.class) }, TW(p.tw||"border-slate-300 f:ring-2 f:ring-indigo-500"), p), sl)
  );

  Comp.mole.define("Spinner", (A,s,app,p={},sl={}) =>
    A.Div({ class:C("inline-flex items-center justify-center",p.class), ...TW(p.tw||"") }, {
      default:[ A.Span({ class:C("inline-block rounded-full animate-spin", p.dotClass), ...TW(p.dotTw||"w-5 h-5 border-2 border-slate-300 border-t-indigo-600") }) ]
    })
  );

  Comp.mole.define("Skeleton", (A,s,app,p={},sl={}) =>
    A.Div({ class:C("animate-pulse rounded",p.class), style:{width:p.w||"100%",height:p.h||"1rem"}, ...TW(p.tw||"bg-slate-200") })
  );

  Comp.mole.define("NumberInput", (A,s,app,p={},sl={})=>{
    const step=+p.step||1, min=(p.min!=null)?+p.min:null, max=(p.max!=null)?+p.max:null;
    const clamp = (v)=> (min!=null && v<min)?min : (max!=null && v>max)?max : v;
    const val = (p.value!=null)? +p.value : 0;
    const set = (v)=> p.onChange && p.onChange(clamp(+v));
    return A.Div({ class:C("inline-flex items-center gap-1",p.class) }, { default:[
      A.Button({ class:"px-2 py-1 rounded border", onClick:()=>set(val-step) }, { default:["−"] }),
      A.Input({ type:"number", value:val, onInput:(e)=>set(e.target.value), class:C("w-20 text-center rounded border px-2 py-1", p.inputClass), ...TW(p.inputTw||"border-slate-300") }),
      A.Button({ class:"px-2 py-1 rounded border", onClick:()=>set(val+step) }, { default:["+"] })
    ]});
  });

  Comp.mole.define("PasswordInput", (A,s,app,p={},sl={})=>{
    let show=false;
    const mark=()=> app && app.helpers && app.helpers.mark && app.helpers.mark(p.uKey||"PasswordInput");
    const toggle=()=>{ show=!show; mark(); };
    return A.Div({ class:C("relative",p.class) }, { default:[
      A.Input({ type:show?"text":"password", value:p.value||"", onInput:p.onInput, placeholder:p.placeholder, class:C("w-full rounded-xl border px-3 py-2 pr-10",p.inputClass), ...TW(p.inputTw||"border-slate-300 f:ring-2 f:ring-indigo-500") }),
      A.Button({ class:"absolute right-2 top-1/2 -translate-y-1/2 text-xs opacity-70", onClick:toggle }, { default:[ show? t("ui.hide",{fallback:"Hide"},app): t("ui.show",{fallback:"Show"},app) ] })
    ]});
  });

  Comp.mole.define("TagInput", (A,s,app,p={},sl={})=>{
    let tags = isArr(p.value)? p.value.slice(): [];
    const mark=()=> app && app.helpers && app.helpers.mark && app.helpers.mark(p.uKey||"TagInput");
    const add = (txt)=>{ const v=String(txt||"").trim(); if(!v) return; if(!tags.includes(v)){ tags=tags.concat([v]); p.onChange && p.onChange(tags); } mark(); };
    const remove = (i)=>{ tags=tags.filter((_,idx)=>idx!==i); p.onChange && p.onChange(tags); mark(); };
    const key=(e)=>{ if(e.key==="Enter"||e.key===","){ e.preventDefault(); add(e.target.value); e.target.value=""; } else if(e.key==="Backspace" && !e.target.value && tags.length){ remove(tags.length-1); } };
    return A.Div({ class:C("flex flex-wrap items-center gap-2 rounded-xl border px-2 py-2",p.class), ...TW(p.tw||"border-slate-300") }, { default:[
      ...tags.map((t,i)=> A.Span({ class:"inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs" }, { default:[ t, A.Button({ class:"text-slate-500", onClick:()=>remove(i) }, { default:["×"] }) ]})),
      A.Input({ class:"flex-1 min-w-[8rem] outline-none", placeholder:p.placeholder||t("ui.addTag",{fallback:"Add tag"},app), onKeydown:key })
    ]});
  });

  // --- Form & display atoms after TagInput ---

  Comp.mole.define("Textarea", (A,s,app,p={},sl={}) =>
    A.Textarea(Object.assign({
      rows: p.rows || 3,
      class: C("w-full rounded-xl border px-3 py-2", p.class)
    }, TW(p.tw || "border-slate-300 f:ring-2 f:ring-indigo-500"), p))
  );

  Comp.mole.define("Switch", (A,s,app,p={},sl={}) => {
    const checked = !!p.checked;
    const label = p.label ? A.Span({ class: C("text-sm", p.labelClass) }, { default: [p.label] }) : null;
    const toggle = () => {
      if (isFn(p.onToggle)) return p.onToggle(!checked);
      if (isFn(p.onChange)) return p.onChange(!checked);
    };
    return A.Label({ class: C("inline-flex items-center gap-3 cursor-pointer", p.class) }, {
      default: [
        A.Span({
          role: "switch",
          "aria-checked": checked,
          class: C("relative inline-flex h-6 w-11 items-center rounded-full transition-colors", checked ? "bg-indigo-600" : "bg-slate-300"),
          onClick: (e) => { e.preventDefault(); toggle(); },
          ...p
        }, {
          default: [
            A.Span({
              class: C("inline-block h-4 w-4 transform rounded-full bg-white transition", checked ? "translate-x-5" : "translate-x-1")
            })
          ]
        }),
        label
      ]
    });
  });

  Comp.mole.define("Checkbox", (A,s,app,p={},sl={}) => {
    const checked = !!p.checked;
    const id = p.id || `chk-${Math.random().toString(36).slice(2,8)}`;
    return A.Label({ class: C("inline-flex items-center gap-2 cursor-pointer", p.class), for: id }, {
      default: [
        A.Input(Object.assign({
          id,
          type: "checkbox",
          checked,
          class: C("h-4 w-4 rounded border", p.inputClass)
        }, p, {
          onChange: (e) => {
            if (isFn(p.onInput)) p.onInput(e);
            if (isFn(p.onChange)) p.onChange(e.target.checked);
          }
        })),
        p.label ? A.Span({ class: C("text-sm", p.labelClass) }, { default: [p.label] }) : null,
        sl.default || null
      ]
    });
  });

  Comp.mole.define("Radio", (A,s,app,p={},sl={}) => {
    const checked = !!p.checked;
    const id = p.id || `rad-${Math.random().toString(36).slice(2,8)}`;
    return A.Label({ class: C("inline-flex items-center gap-2 cursor-pointer", p.class), for: id }, {
      default: [
        A.Input(Object.assign({
          id,
          type: "radio",
          checked,
          name: p.name,
          class: C("h-4 w-4 rounded-full border", p.inputClass)
        }, p, {
          onChange: (e) => {
            if (isFn(p.onInput)) p.onInput(e);
            if (isFn(p.onChange)) p.onChange(e.target.value ?? true);
          }
        })),
        p.label ? A.Span({ class: C("text-sm", p.labelClass) }, { default: [p.label] }) : null,
        sl.default || null
      ]
    });
  });

  Comp.mole.define("Badge", (A,s,app,p={},sl={}) =>
    A.Span({ class: C("inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold", p.class), ...TW(p.tw||"") }, sl)
  );

  Comp.mole.define("Chip", (A,s,app,p={},sl={}) =>
    A.Span({
      class: C("inline-flex items-center gap-2 rounded-2xl border px-3 py-1 text-sm", p.class),
      ...TW(p.tw || (p.active ? "border-indigo-500 bg-indigo-50" : "border-slate-200"))
    }, sl)
  );

  Comp.mole.define("Pill", (A,s,app,p={},sl={}) =>
    A.Span({ class: C("inline-flex items-center rounded-full px-3 py-1 text-xs", p.class), ...TW(p.tw||"bg-slate-900 text-white") }, sl)
  );

  Comp.mole.define("Avatar", (A,s,app,p={},sl={}) => {
    const size = p.size === 'lg' ? 48 : p.size === 'sm' ? 28 : 36;
    const style = Object.assign({
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: "999px",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      background: p.src ? "transparent" : "#e2e8f0",
      color: "#1e293b",
      fontWeight: 600
    }, p.style || {});
    const content = p.src
      ? A.Img({ src: p.src, alt: p.alt || "", style: { width: "100%", height: "100%", borderRadius: "999px", objectFit: "cover" } })
      : (p.initials ? p.initials : (p.name ? String(p.name).trim().slice(0,2).toUpperCase() : "?"));
    return A.Div(Object.assign({ class: C("overflow-hidden", p.class), style }, p.attrs || {}), { default: [content] });
  });

  Comp.mole.define("Kbd", (A,s,app,p={},sl={}) =>
    A.Kbd({ class: C("rounded-md border border-slate-300 bg-slate-50 px-2 py-1 text-[11px] font-semibold uppercase", p.class), ...TW(p.tw||"") }, sl)
  );

  Comp.mole.define("Progress", (A,s,app,p={},sl={}) => {
    const value = Math.min(100, Math.max(0, +p.value || 0));
    return A.Div({ class: C("w-full overflow-hidden rounded-full bg-slate-200", p.class), style: Object.assign({ height: p.height || "8px" }, p.style || {}) }, {
      default: [
        A.Div({
          style: Object.assign({ width: `${value}%`, height: "100%", background: p.color || "linear-gradient(90deg,#6366f1,#22d3ee)" }, p.barStyle || {})
        })
      ]
    });
  });

  Comp.mole.define("Meter", (A,s,app,p={},sl={}) => {
    const value = Math.min(1, Math.max(0, +p.value || 0));
    const pct = Math.round(value * 100);
    return A.Div({ class: C("flex items-center gap-2", p.class) }, {
      default: [
        A.Div({ class: "flex-1 overflow-hidden rounded-full bg-slate-200", style: { height: p.height || "8px" } }, {
          default: [A.Div({ style: { width: `${pct}%`, height: "100%", background: p.color || "#10b981" } })]
        }),
        A.Span({ class: C("text-xs font-semibold", p.labelClass) }, { default: [`${pct}%`] })
      ]
    });
  });

  Comp.mole.define("MoneyInput", (A,s,app,p={},sl={}) => {
    const currencyUtil = Comp.util.get && Comp.util.get("Currency");
    const locale = p.locale || (app?.env?.get?.().locale) || "en";
    const currency = p.currency || p.currencyCode || "USD";
    const digits = Number.isFinite(p.minimumFractionDigits) ? p.minimumFractionDigits : 2;
    const symbol = p.currencySymbol || (currencyUtil && currencyUtil.symbol ? currencyUtil.symbol(currency, locale) : currency);
    const rawValue = p.value == null ? "" : String(p.value);
    const handleInput = (e) => {
      if (isFn(p.onInput)) return p.onInput(e);
      const val = currencyUtil ? currencyUtil.parse(e.target.value, { locale }) : parseFloat(e.target.value);
      if (isFn(p.onChange)) p.onChange(Number.isFinite(val) ? val : 0);
    };
    const handleBlur = (e) => {
      if (p.formatOnBlur === false) return;
      if (!currencyUtil) return;
      const parsed = currencyUtil.parse(e.target.value, { locale });
      const formatted = currencyUtil.format(parsed, { currency, locale, minimumFractionDigits: digits, maximumFractionDigits: p.maximumFractionDigits ?? digits });
      e.target.value = formatted;
      if (isFn(p.onChange)) p.onChange(parsed);
    };
    return A.Div({ class: C("relative", p.class) }, {
      default: [
        A.Span({ class: "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500" }, { default: [symbol] }),
        A.Input(Object.assign({
          type: "text",
          inputmode: "decimal",
          value: rawValue,
          class: C("w-full rounded-xl border px-3 py-2 pl-9", p.inputClass),
          onInput: handleInput,
          onBlur: handleBlur
        }, TW(p.inputTw || "border-slate-300 f:ring-2 f:ring-indigo-500"), p.attrs || {}))
      ]
    });
  });

  Comp.mole.define("PhoneInput", (A,s,app,p={},sl={}) => {
    const phoneUtil = Comp.util.get && Comp.util.get("Phone");
    const locale = p.locale || (app?.env?.get?.().locale) || "en";
    const country = p.country || "EG";
    const handleInput = (e) => {
      if (isFn(p.onInput)) p.onInput(e);
      if (isFn(p.onChange)) {
        const normalized = phoneUtil && phoneUtil.normalize ? phoneUtil.normalize(e.target.value) : String(e.target.value || "");
        p.onChange(normalized);
      }
    };
    const handleBlur = (e) => {
      if (phoneUtil && phoneUtil.format) {
        e.target.value = phoneUtil.format(e.target.value, { locale, country });
      }
    };
    return A.Div({ class: C("relative", p.class) }, {
      default: [
        p.prefix ? A.Span({ class: "absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500" }, { default: [p.prefix] }) : null,
        A.Input(Object.assign({
          type: "tel",
          inputmode: "tel",
          value: p.value || "",
          class: C("w-full rounded-xl border px-3 py-2", p.prefix ? "pl-10" : "", p.inputClass),
          onInput: handleInput,
          onBlur: handleBlur
        }, TW(p.inputTw || "border-slate-300 f:ring-2 f:ring-indigo-500"), p.attrs || {}))
      ]
    });
  });

  Comp.mole.define("TimeInput", (A,s,app,p={},sl={}) =>
    A.Input(Object.assign({
      type: "time",
      value: p.value || "",
      step: p.step || 60,
      class: C("w-full rounded-xl border px-3 py-2", p.class),
      onInput: (e) => {
        if (isFn(p.onInput)) p.onInput(e);
        if (isFn(p.onChange)) p.onChange(e.target.value);
      }
    }, TW(p.tw || "border-slate-300 f:ring-2 f:ring-indigo-500"), p.attrs || {}))
  );

  // --- بعد تعريف TagInput ---

  Comp.mole.define("DescriptionList", (A,s,app,p={},sl={})=>{
    return A.Dl({ class: C("space-y-2", p.class) }, {
      default: (p.items || []).map(item =>
        A.Div({ tw: "flex justify-between items-center" }, { default: [
          A.Dt({ tw: "text-slate-600 dark:text-slate-400" }, { default: [item.term] }),
          A.Dd({ tw: "font-semibold text-slate-800 dark:text-slate-200" }, { default: [item.details] })
        ]})
      )
    });
  });

  // ============== Layout & overlay surfaces ==============

  Comp.tissue.define("Panel", (A,s,app,p={},sl={})=>{
    const slots = asSlots(sl);
    const segments = [];
    if (slots.header) {
      segments.push(A.Div({ style: Object.assign({ padding: "18px 22px", borderBottom: "1px solid rgba(148,163,184,0.18)", fontWeight: 600, fontSize: "14px", color: "#1e293b" }, p.headerStyle || {}) }, { default: toArr(slots.header) }));
    }
    segments.push(A.Div({ style: Object.assign({ padding: "22px", flex: "1 1 auto" }, p.bodyStyle || {}) }, { default: toArr(slots.body || slots.default) }));
    if (slots.footer) {
      segments.push(A.Div({ style: Object.assign({ padding: "18px 22px", borderTop: "1px solid rgba(148,163,184,0.14)", display: "flex", justifyContent: p.footerAlign || "flex-end", gap: "12px" }, p.footerStyle || {}) }, { default: toArr(slots.footer) }));
    }
    return A.Div({ class: C("mishkah-panel", p.class), style: Object.assign({ background: "#ffffff", borderRadius: "20px", border: "1px solid rgba(148,163,184,0.2)", boxShadow: "0 22px 44px rgba(15,23,42,0.08)", display: "flex", flexDirection: "column" }, p.style || {}) }, { default: segments });
  });

  Comp.tissue.define("Card", (A,s,app,p={},sl={})=>{
    const slots = asSlots(sl);
    const segments = [];
    if (slots.header) {
      segments.push(A.Div({ style: Object.assign({ padding: "18px 22px", borderBottom: "1px solid rgba(148,163,184,0.16)", fontWeight: 600, fontSize: "15px", color: "#0f172a" }, p.headerStyle || {}) }, { default: toArr(slots.header) }));
    }
    segments.push(A.Div({ style: Object.assign({ padding: "22px", flex: "1 1 auto" }, p.bodyStyle || {}) }, { default: toArr(slots.body || slots.default) }));
    if (slots.footer) {
      segments.push(A.Div({ style: Object.assign({ padding: "18px 22px", borderTop: "1px solid rgba(148,163,184,0.12)", display: "flex", justifyContent: p.footerAlign || "flex-end", gap: "12px" }, p.footerStyle || {}) }, { default: toArr(slots.footer) }));
    }
    return A.Div({ class: C("mishkah-card", p.class), style: Object.assign({ background: "#ffffff", borderRadius: "24px", border: "1px solid rgba(226,232,240,0.8)", boxShadow: "0 24px 48px rgba(15,23,42,0.12)", display: "flex", flexDirection: "column" }, p.style || {}) }, { default: segments });
  });

  Comp.tissue.define("FormRow", (A,s,app,p={},sl={})=>{
    const slots = asSlots(sl);
    const description = slots.description || p.description;
    const error = slots.error || p.error;
    const aside = slots.aside || null;
    return A.Div({ class: C("mishkah-form-row", p.class), style: Object.assign({ display: "flex", flexDirection: "column", gap: "6px" }, p.style || {}) }, {
      default: [
        p.label ? A.Label({ for: p.for, class: C("text-sm font-medium", p.labelClass), style: Object.assign({ color: "#1e293b" }, p.labelStyle || {}) }, { default: [p.label] }) : null,
        A.Div({ style: Object.assign({ display: "flex", alignItems: p.align || "stretch", gap: "12px" }, p.rowStyle || {}) }, {
          default: [
            A.Div({ style: Object.assign({ flex: "1 1 auto", display: "flex", flexDirection: "column", gap: "6px" }, p.controlStyle || {}) }, { default: toArr(slots.control || slots.default) }),
            aside ? A.Div({ style: Object.assign({ minWidth: "120px" }, p.asideStyle || {}) }, { default: toArr(aside) }) : null
          ]
        }),
        description ? A.Span({ class: C("text-xs", p.descriptionClass), style: Object.assign({ color: "#64748b" }, p.descriptionStyle || {}) }, { default: toArr(description) }) : null,
        error ? A.Span({ class: C("text-xs", p.errorClass), style: Object.assign({ color: "#dc2626", fontWeight: 600 }, p.errorStyle || {}) }, { default: toArr(error) }) : null
      ]
    });
  });

  Comp.tissue.define("ScrollArea", (A,s,app,p={},sl={})=>{
    return A.Div({ class: C("mishkah-scroll-area", p.class), style: Object.assign({ position: "relative" }, p.style || {}) }, {
      default: [
        A.Div({ class: C("mishkah-scroll-area__viewport", p.viewportClass), style: Object.assign({ overflowY: "auto", maxHeight: p.maxHeight || "100%", paddingRight: p.paddingRight || "8px" }, p.viewportStyle || {}), onScroll: p.onScroll }, { default: toArr(sl.default || sl.content) })
      ]
    });
  });

  Comp.tissue.define("Tabs", (A,s,app,p={},sl={})=>{
    const items = toArr(p.items || []);
    if (!items.length) return A.Div({ class: p.class }, { default: [] });
    const value = p.value != null ? p.value : items[0].id;
    const variant = p.variant || "line";
    const align = p.align || "start";
    const slots = asSlots(sl);
    const headerStyle = Object.assign({ display: "flex", gap: "8px", alignItems: "center", justifyContent: align === "center" ? "center" : align === "end" ? "flex-end" : "flex-start" }, p.headerStyle || {});
    const tabs = items.map((item) => {
      const active = value === item.id;
      const style = Object.assign({
        padding: "10px 18px",
        borderRadius: variant === "line" ? "0" : "999px",
        borderBottom: variant === "line" ? (active ? "2px solid #4f46e5" : "2px solid transparent") : undefined,
        background: variant === "pill" ? (active ? "#4f46e5" : "#e2e8f0") : variant === "contained" ? (active ? "#ffffff" : "#f1f5f9") : "transparent",
        color: active ? (variant === "pill" ? "#ffffff" : "#1e293b") : "#475569",
        fontWeight: 600,
        fontSize: "14px",
        border: variant === "contained" && active ? "1px solid rgba(79,70,229,0.25)" : "1px solid transparent",
        boxShadow: variant === "contained" && active ? "0 16px 32px rgba(79,70,229,0.18)" : "none",
        cursor: "pointer",
        transition: "all 0.18s ease"
      }, item.style || {});
      const props = { type: "button", style, class: C("mishkah-tab-btn", item.class) };
      if (isFn(p.onChange)) {
        props.onClick = () => p.onChange(item.id, item);
      } else if (p.command || p['data-onchange']) {
        props['data-onclick'] = p.command || p['data-onchange'];
        props['data-tab'] = item.id;
      }
      const label = item.title || item.label || item.name || item.id;
      return A.Button(props, { default: [
        item.icon ? A.Span({ style: Object.assign({ marginInlineEnd: "8px", display: "inline-flex", alignItems: "center" }, item.iconStyle || {}) }, { default: [item.icon] }) : null,
        label
      ]});
    });
    const body = slots[value] || slots.default || [];
    return A.Div({ class: C("mishkah-tabs", p.class), style: Object.assign({ display: "flex", flexDirection: "column", gap: "16px" }, p.style || {}) }, {
      default: [
        A.Div({ style: headerStyle }, { default: tabs }),
        A.Div({ class: C("mishkah-tabs__body", p.bodyClass), style: Object.assign({ minHeight: p.minHeight || "auto" }, p.bodyStyle || {}) }, { default: toArr(body) })
      ]
    });
  });

  Comp.tissue.define("Steps", (A,s,app,p={},sl={})=>{
    const steps = toArr(p.items || []);
    const current = Number.isFinite(p.current) ? p.current : 0;
    return A.Div({ class: C("mishkah-steps", p.class), style: Object.assign({ display: "flex", gap: "18px", flexWrap: "wrap" }, p.style || {}) }, {
      default: steps.map((step, idx) => {
        const done = idx < current;
        const active = idx === current;
        const circleStyle = Object.assign({
          width: "34px",
          height: "34px",
          borderRadius: "999px",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 600,
          color: done || active ? "#ffffff" : "#475569",
          background: done ? "#0ea5e9" : active ? "#4f46e5" : "#e2e8f0"
        }, step.circleStyle || {});
        return A.Div({ key: step.id || idx, style: { display: "flex", alignItems: "center", gap: "12px" } }, {
          default: [
            A.Div({ style: circleStyle }, { default: [step.step || idx + 1] }),
            A.Div({ style: { display: "flex", flexDirection: "column", minWidth: "120px" } }, {
              default: [
                A.Span({ style: Object.assign({ fontWeight: 600, fontSize: "14px", color: "#0f172a" }, step.titleStyle || {}) }, { default: [step.title || step.label || `Step ${idx + 1}`] }),
                step.description ? A.Span({ style: Object.assign({ fontSize: "12px", color: "#64748b" }, step.descriptionStyle || {}) }, { default: [step.description] }) : null
              ]
            }),
            idx < steps.length - 1 ? A.Div({ style: { height: "1px", width: p.connectorWidth || "46px", background: "#cbd5f5" } }) : null
          ]
        });
      })
    });
  });

  const MODAL_WIDTHS = { sm: "min(95vw,420px)", md: "min(95vw,560px)", lg: "min(95vw,720px)", xl: "min(95vw,960px)" };

  Comp.tissue.define("Modal", (A,s,app,p={},sl={})=>{
    if (!p.open) return null;
    const slots = asSlots(sl);
    const closeOnOutside = p.closeOnOutside !== false;
    const closeOnEsc = p.closeOnEsc !== false;
    const width = MODAL_WIDTHS[p.size] || MODAL_WIDTHS.md;
    const close = (reason) => { if (isFn(p.onClose)) p.onClose(reason); };
    let releaseTrap = null;
    const onKey = (e) => {
      if (e.key === "Escape" && closeOnEsc) {
        e.preventDefault();
        close("esc");
      }
    };
    return A.Div({
      role: "presentation",
      class: C("mishkah-modal-backdrop", p.backdropClass),
      style: Object.assign({ position: "fixed", inset: "0", padding: "24px", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(15,23,42,0.55)", zIndex: p.zIndex || 1100 }, p.backdropStyle || {}),
      onClick: (e) => { if (closeOnOutside && e.target === e.currentTarget) close("outside"); },
      onMounted: (el) => {
        document.body.classList.add("mishkah-no-scroll");
        if (closeOnEsc) document.addEventListener("keydown", onKey);
        const panel = el.querySelector('[data-modal-panel]');
        const trap = Comp.util.get && Comp.util.get("FocusTrap");
        if (panel && trap && trap.trap) {
          releaseTrap = trap.trap(panel, { restoreFocus: true });
        }
        if (isFn(p.onOpen)) p.onOpen({ el, panel });
      },
      onUnmounted: () => {
        document.body.classList.remove("mishkah-no-scroll");
        if (closeOnEsc) document.removeEventListener("keydown", onKey);
        if (releaseTrap) {
          try { releaseTrap(); } catch (_) {}
          releaseTrap = null;
        }
        if (isFn(p.onAfterClose)) p.onAfterClose();
      }
    }, {
      default: [
        A.Div({
          role: "dialog",
          "aria-modal": "true",
          "aria-labelledby": p.title ? (p.labelId || `${p.id || "modal"}-title`) : undefined,
          class: C("mishkah-modal-panel", p.class),
          style: Object.assign({ width: "100%", maxWidth: width, maxHeight: "90vh", background: "#ffffff", borderRadius: "24px", boxShadow: "0 32px 64px rgba(15,23,42,0.25)", overflow: "hidden", display: "flex", flexDirection: "column" }, p.panelStyle || {}),
          'data-modal-panel': "",
          onClick: (e) => e.stopPropagation()
        }, {
          default: [
            (slots.header || p.title) ? A.Div({ class: C("mishkah-modal-header", p.headerClass), style: Object.assign({ padding: "22px 26px", borderBottom: "1px solid rgba(148,163,184,0.18)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px" }, p.headerStyle || {}) }, {
              default: slots.header ? toArr(slots.header) : [
                A.H3({ id: p.labelId || `${p.id || "modal"}-title`, style: Object.assign({ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "#0f172a" }, p.titleStyle || {}) }, { default: [p.title] }),
                p.dismissable === false ? null : A.Button({ type: "button", style: Object.assign({ border: "none", background: "transparent", fontSize: "24px", lineHeight: 1, color: "#94a3b8", cursor: "pointer" }, p.closeStyle || {}), 'aria-label': t("ui.close", { fallback: "Close" }, app), onClick: () => close("close") }, { default: ["×"] })
              ]
            }) : null,
            A.Div({ class: C("mishkah-modal-body", p.bodyClass), style: Object.assign({ padding: "26px", overflowY: "auto", flex: "1 1 auto" }, p.bodyStyle || {}) }, { default: toArr(slots.body || slots.default) }),
            slots.footer ? A.Div({ class: C("mishkah-modal-footer", p.footerClass), style: Object.assign({ padding: "20px 26px", borderTop: "1px solid rgba(148,163,184,0.16)", display: "flex", justifyContent: p.footerAlign || "flex-end", gap: "12px" }, p.footerStyle || {}) }, { default: toArr(slots.footer) }) : null
          ]
        })
      ]
    });
  });

  Comp.tissue.define("Sheet", (A,s,app,p={},sl={})=>{
    if (!p.open) return null;
    const side = p.side || "end";
    const closeOnOutside = p.closeOnOutside !== false;
    const closeOnEsc = p.closeOnEsc !== false;
    const close = (reason) => { if (isFn(p.onClose)) p.onClose(reason); };
    const isHorizontal = side === "start" || side === "end";
    const size = isHorizontal ? (p.width || "420px") : (p.height || "60vh");
    let releaseTrap = null;
    const onKey = (e) => {
      if (e.key === "Escape" && closeOnEsc) {
        e.preventDefault();
        close("esc");
      }
    };
    const placementStyle = side === "start" ? { justifyContent: "flex-start", alignItems: "stretch" }
      : side === "end" ? { justifyContent: "flex-end", alignItems: "stretch" }
      : side === "top" ? { justifyContent: "center", alignItems: "flex-start" }
      : { justifyContent: "center", alignItems: "flex-end" };
    const slots = asSlots(sl);
    return A.Div({
      role: "presentation",
      style: Object.assign({ position: "fixed", inset: "0", background: "rgba(15,23,42,0.45)", display: "flex", zIndex: p.zIndex || 1080, padding: "24px" }, placementStyle, p.backdropStyle || {}),
      onClick: (e) => { if (closeOnOutside && e.target === e.currentTarget) close("outside"); },
      onMounted: (el) => {
        document.body.classList.add("mishkah-no-scroll");
        if (closeOnEsc) document.addEventListener("keydown", onKey);
        const panel = el.querySelector('[data-sheet-panel]');
        const trap = Comp.util.get && Comp.util.get("FocusTrap");
        if (panel && trap && trap.trap) {
          releaseTrap = trap.trap(panel, { restoreFocus: true });
        }
        if (isFn(p.onOpen)) p.onOpen({ el, panel });
      },
      onUnmounted: () => {
        document.body.classList.remove("mishkah-no-scroll");
        if (closeOnEsc) document.removeEventListener("keydown", onKey);
        if (releaseTrap) { try { releaseTrap(); } catch (_) {} releaseTrap = null; }
        if (isFn(p.onAfterClose)) p.onAfterClose();
      }
    }, {
      default: [
        A.Div({
          role: "dialog",
          class: C("mishkah-sheet-panel", p.class),
          style: Object.assign({
            width: isHorizontal ? size : "min(720px, 96vw)",
            height: isHorizontal ? "100%" : size,
            maxWidth: "96vw",
            maxHeight: "96vh",
            background: "#ffffff",
            borderRadius: side === "start" ? "0 24px 24px 0" : side === "end" ? "24px 0 0 24px" : side === "top" ? "24px 24px 16px 16px" : "16px 16px 24px 24px",
            boxShadow: "0 32px 64px rgba(15,23,42,0.22)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            transform: "translate3d(0,0,0)",
            transition: "transform 0.24s ease"
          }, p.panelStyle || {}),
          'data-sheet-panel': "",
          onClick: (e) => e.stopPropagation()
        }, {
          default: [
            slots.header ? A.Div({ style: Object.assign({ padding: "20px 24px", borderBottom: "1px solid rgba(148,163,184,0.18)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }, p.headerStyle || {}) }, { default: toArr(slots.header) }) : null,
            A.Div({ style: Object.assign({ padding: "22px", overflowY: "auto", flex: "1 1 auto" }, p.bodyStyle || {}) }, { default: toArr(slots.body || slots.default) }),
            slots.footer ? A.Div({ style: Object.assign({ padding: "20px 24px", borderTop: "1px solid rgba(148,163,184,0.14)", display: "flex", justifyContent: p.footerAlign || "flex-end", gap: "12px" }, p.footerStyle || {}) }, { default: toArr(slots.footer) }) : null
          ]
        })
      ]
    });
  });

  Comp.tissue.define("ConfirmDialog", (A,s,app,p={},sl={})=>{
    const body = sl.body || sl.default || [p.message];
    const confirmLabel = p.confirmLabel || t("ui.confirm", { fallback: "Confirm" }, app);
    const cancelLabel = p.cancelLabel || t("ui.cancel", { fallback: "Cancel" }, app);
    return Comp.call("Modal", {
      open: p.open,
      title: p.title || t("ui.confirm", { fallback: "Confirm" }, app),
      size: p.size || "sm",
      closeOnOutside: p.closeOnOutside,
      closeOnEsc: p.closeOnEsc,
      onClose: p.onClose,
      dismissable: p.dismissable,
      bodyClass: C("space-y-3", p.bodyClass)
    }, {
      body,
      footer: [
        Comp.call("Button", Object.assign({ text: cancelLabel, variant: "ghost" }, p.cancelProps || {}, p.cancelCommand ? { 'data-onclick': p.cancelCommand } : {}, p.onCancel ? { onClick: () => p.onCancel() } : {})),
        Comp.call("Button", Object.assign({ text: confirmLabel }, p.confirmProps || {}, p.confirmIntent ? { intent: p.confirmIntent } : {}, p.confirmCommand ? { 'data-onclick': p.confirmCommand } : {}, p.onConfirm ? { onClick: () => p.onConfirm() } : {}))
      ]
    });
  });

  const TOAST_COLORS = { neutral: "#1e293b", info: "#2563eb", success: "#047857", warning: "#b45309", danger: "#b91c1c" };

  Comp.tissue.define("Toast", (A,s,app,p={},sl={})=>{
    const tone = TOAST_COLORS[p.intent || "neutral"] || TOAST_COLORS.neutral;
    const content = sl.default || (p.message ? [p.message] : []);
    const closeProps = {};
    if (p.dismissCommand) closeProps['data-onclick'] = p.dismissCommand;
    if (p.dismissCommand && p.id != null) closeProps['data-toast-id'] = p.id;
    if (isFn(p.onClose)) closeProps.onClick = (e) => { e.preventDefault(); p.onClose(); };
    return A.Div({ class: C("mishkah-toast", p.class), style: Object.assign({ background: tone, color: "#ffffff", borderRadius: "18px", padding: "16px 20px", minWidth: "220px", maxWidth: "360px", boxShadow: "0 24px 48px rgba(15,23,42,0.25)", display: "flex", alignItems: "flex-start", gap: "12px", pointerEvents: "auto" }, p.style || {}) }, {
      default: [
        p.icon ? A.Span({ style: { fontSize: "18px", lineHeight: 1 } }, { default: [p.icon] }) : null,
        A.Div({ style: { flex: "1 1 auto", display: "flex", flexDirection: "column", gap: "4px" } }, {
          default: [
            p.title ? A.Div({ style: { fontWeight: 600, fontSize: "14px" } }, { default: [p.title] }) : null,
            content.length ? A.Div({ style: { fontSize: "13px", lineHeight: 1.45 } }, { default: toArr(content) }) : null
          ]
        }),
        (p.dismissCommand || isFn(p.onClose)) ? A.Button(Object.assign({ type: "button", style: { border: "none", background: "transparent", color: "inherit", fontSize: "16px", cursor: "pointer" }, 'aria-label': t("ui.close", { fallback: "Close" }, app) }, closeProps), { default: ["×"] }) : null
      ]
    });
  });

  Comp.tissue.define("ToastStack", (A,s,app,p={},sl={})=>{
    const items = toArr(p.items || []);
    const position = p.position || "top-end";
    const style = Object.assign({ position: "fixed", zIndex: p.zIndex || 1300, display: "flex", flexDirection: "column", gap: "12px", pointerEvents: "none" },
      position === "top-start" ? { top: "24px", left: "24px", alignItems: "flex-start" }
        : position === "bottom-start" ? { bottom: "24px", left: "24px", alignItems: "flex-start" }
        : position === "bottom-end" ? { bottom: "24px", right: "24px", alignItems: "flex-end" }
        : { top: "24px", right: "24px", alignItems: "flex-end" },
      p.style || {});
    return A.Div({ class: C("mishkah-toast-stack", p.class), style }, {
      default: items.map((toast, idx) => {
        const props = Object.assign({}, toast, { key: toast.id || idx, style: Object.assign({ pointerEvents: "auto" }, toast.style || {}) });
        const slots = toast.slots || (toast.description ? { default: [toast.description] } : {});
        return Comp.call("Toast", props, slots);
      })
    });
  });

  Comp.tissue.define("Portal", (A,s,app,p={},sl={})=>{
    const target = p.target || "mishkah-portal-root";
    const mountClass = p.mountClass || p.class || "";
    const slots = asSlots(sl);
    return A.Div({ style: { display: "contents" }, onMounted: (placeholder) => {
      const util = Comp.util.get && Comp.util.get("PortalRoot");
      const root = util && util.ensure ? util.ensure(target) : (function(){ let el = document.getElementById(target); if(!el){ el=document.createElement('div'); el.id=target; document.body.appendChild(el); } return el; })();
      const mount = document.createElement('div');
      if (mountClass) mount.className = mountClass;
      placeholder.__portal_mount = mount;
      root.appendChild(mount);
      const render = () => {
        const frag = document.createDocumentFragment();
        const nodes = toArr(slots.default);
        for (const child of nodes) {
          if (child && typeof child === 'object' && child.__A && window.Mishkah?.Atoms?.toNode) {
            frag.appendChild(window.Mishkah.Atoms.toNode(child));
          } else {
            frag.appendChild(document.createTextNode(child == null ? '' : String(child)));
          }
        }
        mount.replaceChildren(frag);
      };
      render();
    }, onUnmounted: (placeholder) => {
      const mount = placeholder.__portal_mount;
      if (mount && mount.parentNode) mount.parentNode.removeChild(mount);
      delete placeholder.__portal_mount;
    } }, { default: [] });
  });

  Comp.tissue.define("Popover", (A,s,app,p={},sl={})=>{
    if (!p.open) return null;
    const slots = asSlots(sl);
    const portalTarget = p.portalTarget || "mishkah-popovers";
    const placement = p.placement || "bottom";
    const align = p.align || "start";
    const closeOnOutside = p.closeOnOutside !== false;
    const close = (reason) => { if (isFn(p.onClose)) p.onClose(reason); };
    const content = slots.default || [];
    return Comp.call("Portal", { target: portalTarget, mountClass: C("mishkah-popover-host", p.hostClass) }, {
      default: [
        A.Div({
          class: C("mishkah-popover", p.class),
          style: Object.assign({ position: "fixed", minWidth: p.minWidth || "220px", background: "#ffffff", borderRadius: "16px", boxShadow: "0 20px 40px rgba(15,23,42,0.15)", border: "1px solid rgba(148,163,184,0.2)", padding: "16px", zIndex: p.zIndex || 1200 }, p.style || {}),
          onMounted: (el) => {
            const anchor = typeof p.anchor === 'string' ? document.querySelector(p.anchor) : (p.anchor || (p.anchorId ? document.getElementById(p.anchorId) : null));
            if (anchor && U.computePlacement) {
              const pos = U.computePlacement(anchor, el, { placement, align, offset: p.offset });
              if (pos && pos.style) Object.assign(el.style, pos.style);
            }
            if (closeOnOutside) {
              el.__mishkah_offClick = U.onOutsideClick ? U.onOutsideClick(el, () => close("outside")) : null;
            }
          },
          onUnmounted: (el) => {
            if (el.__mishkah_offClick) el.__mishkah_offClick();
          }
        }, { default: toArr(content) })
      ]
    });
  });

  Comp.tissue.define("Tooltip", (A,s,app,p={},sl={})=>{
    if (!p.open) return null;
    const slots = asSlots(sl);
    return Comp.call("Popover", Object.assign({
      open: true,
      anchor: p.anchor,
      anchorId: p.anchorId,
      placement: p.placement || "top",
      align: p.align || "center",
      closeOnOutside: false,
      portalTarget: p.portalTarget || "mishkah-tooltips",
      style: Object.assign({ background: "#0f172a", color: "#ffffff", fontSize: "12px", padding: "6px 10px", borderRadius: "12px", boxShadow: "0 12px 24px rgba(15,23,42,0.2)" }, p.style || {})
    }, p), { default: slots.default || [p.label || p.text] });
  });
  Comp.mole.define("NumberPad", (A,s,app,p={},sl={})=>{
    let buffer = String(p.value || "");
    const mark = () => app && app.helpers && app.helpers.mark && app.helpers.mark(p.uKey || "NumberPad");
    const onKey = (key) => {
      if (key === '⌫') {
        buffer = buffer.slice(0, -1);
      } else if (key === 'C') {
        buffer = "";
      } else if (key === '✓') {
        isFn(p.onSubmit) && p.onSubmit(buffer);
        return; // Don't trigger onChange
      } else if (buffer.length < (p.maxLength || 12)) {
        buffer += String(key);
      }
      isFn(p.onChange) && p.onChange(buffer);
      mark();
    };

    const keys = p.keys || [1,2,3,4,5,6,7,8,9,'C',0,'⌫'];
    
    return A.Div({ class: p.class }, { default: [
      p.showInput !== false ? A.Input({
        type: p.inputType || "text",
        tw: "w-full text-center text-2xl tracking-widest mb-3 rounded-xl p-3 bg-slate-100",
        value: buffer,
        placeholder: p.placeholder || "••••",
        onInput: (e) => { buffer = e.target.value; isFn(p.onChange) && p.onChange(buffer); mark(); }
      }) : null,
      A.Div({ tw: "grid grid-cols-3 gap-2" }, {
        default: keys.map(k =>
          A.Button({ tw: "btn btn/ghost text-2xl py-4 rounded-xl", onClick: () => onKey(k) }, { default: [String(k)] })
        )
      }),
      p.showSubmitButton ? A.Button({ tw: "btn btn/primary w-full mt-3", onClick: () => onKey('✓') }, { default: [p.submitText || t("ui.submit", {fallback: "Submit"}, app)] }) : null
    ]});
  });

  // ============== Tissue (Controls & Layouts) ==============
  // AsyncSelect (remote search)
  Comp.tissue.define("AsyncSelect", (A,s,app,p={},sl={})=>{
    let items = isArr(p.options)? p.options.slice(): [];
    let open = false, q="", loading=false, error=null;
    const mapOption = p.mapOption || ((x)=> isObj(x)? { value:x.value ?? x.id, label:x.label ?? x.name ?? String(x) } : { value:x, label:String(x) });
    const mark=()=> app && app.helpers && app.helpers.mark && app.helpers.mark(p.uKey||"AsyncSelect");
    const fetcher = (U.debounce? U.debounce(async ()=>{
      if(!p.url) return;
      loading=true; error=null; mark();
      try{
        const query = Object.assign({}, p.query||{}, p.queryKey ? { [p.queryKey]: q } : {});
        const res = await DataSource.fetch({ url:p.url, method:p.method||'GET', query, body:p.body, map:p.map });
        items = isArr(res)? res : (res.items||res.data||[]);
      }catch(e){ error=e.message||String(e); }
      loading=false; mark();
    }, p.debounce||250) : async ()=>{}) ;

    const head = A.Div({ class:"flex gap-2" }, { default:[
      A.Input({ value:q, onInput:e=>{ q=e.target.value; open=true; fetcher(); mark(); }, placeholder:p.placeholder||t("ui.search",{fallback:"Search..."},app), class:"flex-1 rounded-xl border px-3 py-2" }),
      A.Button({ class:"px-2 rounded border", onClick:()=>{ open=!open; mark(); } }, { default:[ open? "▲":"▼" ] })
    ]});

    const menu = open ? A.Div({ class:"absolute z-50 mt-2 min-w-[12rem] rounded-xl border bg-white p-1 shadow" }, {
      default:[
        loading? A.Div({ class:"p-2 text-slate-500" }, { default:[t("ui.loading",{fallback:"Loading..."},app)] }): null,
        error? A.Div({ class:"p-2 text-rose-600" }, { default:[String(error)] }): null,
        ...items.map(it=>{
          const opt=mapOption(it), sel=String(p.value??"")===String(opt.value);
          return A.Div({ role:"option","aria-selected":sel?"true":"false", class:C("px-3 py-2 rounded cursor-pointer hover:bg-slate-100", sel && "bg-indigo-50"), onClick:()=>{ p.onSelect && p.onSelect(opt); open=false; mark(); } }, { default:[opt.label] })
        })
      ]
    }) : null;

    return A.Div({ class:C("relative",p.class) }, { default:[ head, menu ]});
  });

  // MultiSelect (local/remote + search)
  Comp.tissue.define("MultiSelect", (A,s,app,p={},sl={})=>{
    let values = isArr(p.values)? p.values.slice(): [];
    let items  = isArr(p.options)? p.options.slice(): [];
    let q="", open=false, loading=false, error=null;
    const mapOption = p.mapOption || ((x)=> isObj(x)? { value:x.value ?? x.id, label:x.label ?? x.name ?? String(x) } : { value:x, label:String(x) });
    const isSel = (v)=> values.some(x=> String(x)===String(v));
    const toggle= (v)=>{ values = isSel(v)? values.filter(x=>String(x)!==String(v)) : values.concat([v]); p.onChange && p.onChange(values); mark(); };
    const mark=()=> app && app.helpers && app.helpers.mark && app.helpers.mark(p.uKey||"MultiSelect");

    const pull = (U.debounce? U.debounce(async ()=>{
      if(!p.url) return;
      loading=true; error=null; mark();
      try{
        const query = Object.assign({}, p.query||{}, p.queryKey ? { [p.queryKey]: q } : {});
        const res = await DataSource.fetch({ url:p.url, method:p.method||'GET', query, body:p.body, map:p.map });
        items = isArr(res)? res : (res.items||res.data||[]);
      }catch(e){ error=e.message||String(e); }
      loading=false; mark();
    }, p.debounce||250) : async ()=>{}) ;

    return A.Div({ class:C("relative",p.class) }, { default:[
      A.Div({ class:"flex gap-2" }, { default:[
        A.Input({ placeholder:p.placeholder||t("ui.search",{fallback:"Search..."},app), onInput:e=>{ q=e.target.value; open=true; pull(); mark(); }, class:"flex-1 rounded-xl border px-3 py-2" }),
        A.Button({ class:"px-2 rounded border", onClick:()=>{ open=!open; mark(); } }, { default:[open?"▲":"▼"] })
      ]}),
      open? A.Div({ class:"absolute z-50 mt-2 min-w-[12rem] rounded-xl border bg-white p-1 shadow" }, {
        default:[
          loading? A.Div({ class:"p-2 text-slate-500" }, { default:[t("ui.loading",{fallback:"Loading..."},app)] }): null,
          error? A.Div({ class:"p-2 text-rose-600" }, { default:[String(error)] }): null,
          ...items.filter(it=>!q || String(mapOption(it).label).toLowerCase().includes(String(q).toLowerCase()))
                  .map(it=>{ const opt=mapOption(it), sel=isSel(opt.value);
                    return A.Div({ class:C("px-3 py-2 rounded cursor-pointer hover:bg-slate-100", sel&&"bg-indigo-50"), onClick:()=>toggle(opt.value) }, { default:[ (sel?"✓ ":""), opt.label ] })
                  })
        ]
      }) : null,
      values.length? A.Div({ class:"mt-2 flex flex-wrap gap-2" }, { default: values.map(v=> A.Span({ class:"inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs" }, { default:[String(v), A.Button({ class:"text-slate-500", onClick:()=>toggle(v) }, { default:["×"] }) ] })) }): null
    ]});
  });

  // AutocompleteTable (remote search + columns + pick row)
  Comp.tissue.define("AutocompleteTable", (A,s,app,p={},sl={})=>{
    let q="", open=false, rows=[], loading=false, error=null;
    const mark=()=> app && app.helpers && app.helpers.mark && app.helpers.mark(p.uKey||"AutocompleteTable");
    const hit = (U.debounce? U.debounce(async ()=>{
      if(!p.url) return; loading=true; error=null; mark();
      try{
        const query = Object.assign({}, p.query||{}, { [p.queryKey||'q']: q });
        const res = await DataSource.fetch({ url:p.url, method:p.method||'GET', query, body:p.body, map:p.map });
        rows = isArr(res)? res : (res.items||res.data||[]);
      }catch(e){ error=e.message||String(e); }
      loading=false; mark();
    }, p.debounce||250) : async ()=>{}) ;

    const table = ()=> A.Table(TW("w-full text-sm border"),{
      default:[
        A.Thead({}, { default:[ A.Tr({}, { default:(p.columns||[]).map(c=> A.Th({ class:"text-start px-2 py-1" }, { default:[c.title||c.key] })) }) ]}),
        A.Tbody({}, { default: rows.map(r=> A.Tr({ class:"cursor-pointer hover:bg-slate-50", onClick:()=>{ p.onPick && p.onPick(r); open=false; mark(); } }, {
          default:(p.columns||[]).map(c=> A.Td({ class:"px-2 py-1" }, { default:[ String(r[c.key]??"") ] }))
        })) })
      ]
    });

    return A.Div({ class:C("relative",p.class) }, { default:[
      p.header? A.Div(TW("mb-2 text-sm text-slate-500"),{ default:[p.header]}):null,
      A.Input({ placeholder:p.placeholder||t("ui.search",{fallback:"Search..."},app), onInput:(e)=>{ q=e.target.value; open=true; hit(); mark(); }, class:"w-full rounded-xl border px-3 py-2" }),
      open? A.Div(TW("absolute z-50 mt-2 w-[min(90vw,640px)] bg-white border rounded-2xl shadow p-2"),{
        default:[
          loading? A.Div(TW("p-2 text-slate-500"),{default:[t("ui.loading",{fallback:"Loading..."},app)]}):null,
          error? A.Div(TW("p-2 text-rose-600"),{default:[String(error)]}):null,
          rows.length? table(): A.Div(TW("p-2 text-slate-500"),{default:[t("ui.noResults",{fallback:"No results"},app)]})
        ]
      }): null
    ]});
  });

  // DatePicker (single)
  Comp.tissue.define("DatePicker", (A,s,app,p={},sl={})=>{
    const toISO = (d)=> d? new Date(d).toISOString().slice(0,10): "";
    let view = p.value? new Date(p.value): new Date();
    let value = p.value? new Date(p.value): null;
    const mark=()=> app && app.helpers && app.helpers.mark && app.helpers.mark(p.uKey||"DatePicker");
    const daysIn=(y,m)=> new Date(y,m+1,0).getDate();
    const fmt = (d)=> new Date(d.getFullYear(), d.getMonth(), d.getDate());
    function grid(){
      const y=view.getFullYear(), m=view.getMonth(), first=new Date(y,m,1), off=(first.getDay()+6)%7, total=daysIn(y,m);
      const cells=[]; for(let i=0;i<off;i++) cells.push(null); for(let d=1; d<=total; d++) cells.push(new Date(y,m,d));
      return cells;
    }
    const pick=(d)=>{ value=fmt(d); p.onChange && p.onChange(toISO(value)); mark(); };
    return A.Div(TW("inline-block rounded-2xl border p-3 bg-white"),{ default:[
      A.Div(TW("flex items-center justify-between mb-2"),{ default:[
        A.Button({ class:"px-2", onClick:()=>{ view.setMonth(view.getMonth()-1); view=new Date(view); mark(); } }, { default:["←"]}),
        A.Div({ class:"font-semibold" }, { default:[ view.toLocaleString(app?.env?.get()?.locale || undefined, { month:"long", year:"numeric" }) ]}),
        A.Button({ class:"px-2", onClick:()=>{ view.setMonth(view.getMonth()+1); view=new Date(view); mark(); } }, { default:["→"]}),
      ]}),
      A.Div(TW("grid grid-cols-7 gap-1 text-center"),{
        default:[
          ...["Mo","Tu","We","Th","Fr","Sa","Su"].map(n=>A.Div(TW("text-xs text-slate-500"),{default:[n]})),
          ...grid().map(d=> A.Button({
            disabled:!d, class:C("rounded-md px-0 py-1", d && value && +fmt(d)===+fmt(value) ? "bg-indigo-600 text-white":"hover:bg-slate-100"),
            onClick:()=> d && pick(d)
          }, { default:[ d? String(d.getDate()): "" ]}))
        ]
      })
    ]});
  });

  // DateRange (two pickers)
  Comp.tissue.define("DateRange", (A,s,app,p={},sl={})=>{
    let start = p.start? new Date(p.start): null;
    let end   = p.end?   new Date(p.end):   null;
    const toISO=(d)=> d? new Date(d).toISOString().slice(0,10):"";
    const set=(k,v)=>{ if(k==="start") start=v? new Date(v):null; else end=v? new Date(v):null; p.onChange && p.onChange({ start:toISO(start), end:toISO(end) }); mark(); };
    const mark=()=> app && app.helpers && app.helpers.mark && app.helpers.mark(p.uKey||"DateRange");
    return A.Div(TW("grid grid-cols-1 md:grid-cols-2 gap-2"), { default:[
      Comp.call("DatePicker",{ value:start, onChange:(v)=>set("start",v) }),
      Comp.call("DatePicker",{ value:end,   onChange:(v)=>set("end",v) })
    ]});
  });

  // FileUpload / Dropzone
  Comp.tissue.define("FileUpload", (A,s,app,p={},sl={})=>{
    const field = p.field||"file";
    const up = (files)=>{
      isFn(p.onFiles) && p.onFiles(files);
      if (!p.url) return;
      const fd = new FormData();
      [...files].forEach(f=> fd.append(field, f));
      const xhr = new XMLHttpRequest();
      xhr.open("POST", p.url, true);
      xhr.upload.onprogress = (e)=>{ if(e.lengthComputable && p.onProgress) p.onProgress(e.loaded/e.total); };
      xhr.onload = ()=>{ if(xhr.status>=200 && xhr.status<300){ p.onDone && p.onDone(xhr.responseText); } else { p.onError && p.onError(xhr.statusText||"Upload error"); } };
      xhr.onerror = ()=> p.onError && p.onError("Network error");
      xhr.send(fd);
    };
    const onInput = (e)=> up(e.target.files||[]);
    const onDrop  = (e)=>{ e.preventDefault(); up(e.dataTransfer.files||[]); };
    const onDrag  = (e)=> e.preventDefault();
    return A.Div({ class:C("rounded-2xl border border-dashed p-4 text-center",p.class), onDrop, onDragover:onDrag, onDragenter:onDrag }, {
      default:[
        A.Div(TW("text-sm text-slate-500 mb-2"),{ default:[p.label||t("ui.dropHere",{fallback:"Drop files here or click"},app)]}),
        A.Input({ type:"file", multiple:!!p.multiple, onChange:onInput, class:"block mx-auto" })
      ]
    });
  });

  // ContextMenu (Right-Click)
  Comp.tissue.define("ContextMenu", (A,s,app,p={},sl={})=>{
    let show=false, pos={x:0,y:0};
    const open=(e)=>{ e.preventDefault(); show=true; pos={x:e.clientX,y:e.clientY}; mark(); };
    const close=()=>{ show=false; mark(); };
    const mark=()=> app && app.helpers && app.helpers.mark && app.helpers.mark(p.uKey||"ContextMenu");
    return A.Div({ class:C("relative",p.class), onContextmenu:open }, {
      default:[
        sl.default||null,
        show? A.Div({ class:"fixed inset-0", onClick:close }): null,
        show? A.Ul({ class:"fixed z-50 min-w-[12rem] rounded-xl border bg-white p-1 shadow", style:{left:pos.x+"px",top:pos.y+"px"} }, {
          default:(p.items||[]).map(it=> A.Li({ class:"px-3 py-2 rounded hover:bg-slate-100 cursor-pointer", onClick:()=>{ close(); isFn(it.onClick)&&it.onClick(); } }, { default:[ it.icon? (Comp.call("Icon",{char:it.icon})):null, " ", it.text ] }))
        }): null
      ]
    });
  });

  // Splitter (horizontal)
  Comp.tissue.define("SplitterH", (A,s,app,p={},sl={})=>{
    let w = p.initial || 320;
    let dragging=false, startX=0, startW=w;
    const down=(e)=>{ dragging=true; startX=e.clientX; startW=w; add(); };
    const move=(e)=>{ if(!dragging) return; w= Math.max(160, startW + (e.clientX-startX)); mark(); };
    const up=()=>{ dragging=false; remove(); };
    const add=()=>{ document.addEventListener("mousemove",move); document.addEventListener("mouseup",up); };
    const remove=()=>{ document.removeEventListener("mousemove",move); document.removeEventListener("mouseup",up); };
    const mark=()=> app && app.helpers && app.helpers.mark && app.helpers.mark(p.uKey||"SplitterH");
    return A.Div(TW("w-full h-full flex"),{ default:[
      A.Div({ style:{ width:w+"px" }, class:C("min-w-[160px]") }, { default: sl.left||[] }),
      A.Div({ class:"w-1 cursor-col-resize bg-slate-200 hover:bg-slate-300", onMousedown:down }),
      A.Div({ class:"flex-1 min-w-[160px]" }, { default: sl.right||[] })
    ]});
  });

  // EmptyState
  Comp.tissue.define("EmptyState", (A,s,app,p={},sl={})=>
    A.Div(TW("rounded-2xl border p-6 text-center"),{ default:[
      p.icon? Comp.call("Icon",{char:p.icon}):null,
      A.Div(TW("text-lg font-semibold mt-2"),{ default:[p.title||t("ui.nothing",{fallback:"Nothing here"},app)]}),
      p.text? A.Div(TW("text-slate-500 mt-1"),{default:[p.text]}):null,
      sl.actions? A.Div(TW("mt-3 flex justify-center gap-2"),{ default: sl.actions }): null
    ]})
  );

  // PageHeader
  Comp.tissue.define("PageHeader", (A,s,app,p={},sl={})=>
    A.Div(TW("flex items-center justify-between mb-4"),{ default:[
      A.Div({}, { default:[ A.Div(TW("text-xl font-bold"),{default:[p.title||""]}) ]}),
      A.Div({}, { default: sl.actions||[] })
    ]})
  );

  // NavMenu
  Comp.tissue.define("NavMenu", (A,s,app,p={},sl={})=>
    A.Ul(TW("flex flex-col gap-1"),{ default:
      (p.items||[]).map(it=> A.Li({}, { default:[
        A.A({ href:it.href||"#", class:C("block px-3 py-2 rounded", it.active?"bg-indigo-50 text-indigo-700":"hover:bg-slate-100") }, { default:[it.text] })
      ]}))
    })
  );

  // DataTable (بسيطة: عميل/أجاكس اختياري، فرز/تصفية/ترقيم، تصدير/طباعة)
  Comp.tissue.define("DataTable", (A,s,app,p={},sl={})=>{
    let page = p.page||1, size=p.size||10;
    let sortKey=p.sortKey||null, sortDir=p.sortDir||"asc";
    let filter=p.filter||"";
    let rows=isArr(p.rows)? p.rows.slice(): [];
    let total= rows.length, loading=false, error=null;

    async function load(){
      if(!p.ajax || !p.ajax.url) return;
      loading=true; error=null; mark();
      try{
        const payload = isFn(p.ajax.params) ? p.ajax.params({ page,size,sortKey,sortDir,filter }) : (p.ajax.params||{ page,size,sortKey,sortDir,filter });
        const res = await DataSource.fetch({ url:p.ajax.url, method:p.ajax.method||'GET', query: (p.ajax.method==="GET"? payload : null), body:(p.ajax.method!=="GET"? payload : null), map:p.ajax.map });
        const mapped = isObj(res)&&("rows" in res) ? res : { rows: (res.items||res.data||[]), total: (res.total|| (res.items? res.items.length: 0)) };
        rows = mapped.rows||[]; total = +mapped.total||rows.length;
      }catch(e){ error=e.message||String(e); }
      loading=false; mark();
    }

    function currentView(){
      let data = rows;
      if(!p.ajax) {
        if(filter) data = data.filter(r => (p.columns||[]).some(c => String(r[c.key]??"").toLowerCase().includes(String(filter).toLowerCase())));
        if(sortKey) data = data.slice().sort((a,b)=>{ const va=a[sortKey], vb=b[sortKey]; if(va==vb) return 0; return (va>vb?1:-1) * (sortDir==="asc"?1:-1); });
      }
      const pages = Math.max(1, Math.ceil(total/size));
      const start = (page-1)*size;
      const paged = p.ajax? data : data.slice(start, start+size);
      return { paged, pages };
    }

    const onSort=(k)=>{ sortDir = (sortKey===k && sortDir==='asc') ? 'desc':'asc'; sortKey = k; p.onSort && p.onSort(k,sortDir); p.ajax? load(): mark(); };
    const onPage=(i)=>{ page=i; p.onPage && p.onPage(i); p.ajax? load(): mark(); };
    const onFilterInput=(e)=>{ filter=e.target.value; p.onFilter && p.onFilter(filter); p.ajax? load(): mark(); };

    const toolsBar = (p.tools!==false) ? A.Div(TW("flex items-center gap-2 mb-2"),{
      default:[
        A.Input({ placeholder:t("ui.search",{fallback:"Search..."},app), value:filter, onInput:onFilterInput, class:"flex-1 rounded-xl border px-3 py-2" }),
        A.Button({ onClick:()=>Exporter.csv(rows, p.columns, "table.csv") }, { default:[t("ui.exportCsv",{fallback:"CSV"},app)] }),
        A.Button({ onClick:()=>Exporter.xls(rows, p.columns, "table.xls") }, { default:[t("ui.exportExcel",{fallback:"Excel"},app)] }),
        A.Button({ onClick:()=>Exporter.printHTML('<html><head><title>Print</title></head><body>'+ (function(){const d=document.createElement('div'); d.appendChild(A.toNode(table())); return d.innerHTML; })() +'</body></html>') }, { default:[t("ui.print",{fallback:"Print"},app)] })
      ]
    }) : null;

    const header = ()=> A.Tr({}, { default: (p.columns||[]).map(col=> A.Th({
      onClick:()=>onSort(col.key),
      class: C("cursor-pointer select-none px-2 py-1", sortKey===col.key?"text-indigo-600":"")
    }, { default:[ col.title||col.key ] })) });

    const bodyRows = (data)=> data.map(r=> A.Tr({}, { default: (p.columns||[]).map(col=> A.Td({ class:"px-2 py-1" }, { default:[ col.render? col.render(r[col.key], r) : String(r[col.key]??"") ] })) }));

    const pager = (pages)=> A.Div(TW("flex items-center gap-2 mt-2"),{ default: range(pages).map(i=> A.Button({
      class:C("px-2 py-1 rounded", i===page? "bg-indigo-600 text-white":"bg-slate-100"),
      onClick:()=>onPage(i)
    }, { default:[ String(i) ] })) });

    const table = ()=> A.Table(TW("w-full text-sm border"), { default:[ A.Thead({}, { default:[header()] }), A.Tbody({}, { default: bodyRows(currentView().paged) }) ] });

    if(p.ajax) load();

    const mark=()=> app && app.helpers && app.helpers.mark && app.helpers.mark(p.uKey || "DataTable");
    return A.Div(Object.assign({ class:C("",p.class) }, TW(p.tw||"")), { default:[
      toolsBar,
      loading? A.Div(TW("p-2 text-slate-500"),{default:[t("ui.loading",{fallback:"Loading..."},app)]}) :
      error?   A.Div(TW("p-2 text-rose-600"),{default:[String(error)]}) :
               table(),
      pager(currentView().pages)
    ]});
  });

  // DataTablePro (أوسع: إخفاء أعمدة/اختيار صفوف)
  Comp.tissue.define("DataTablePro", (A,s,app,p={},sl={})=>{
    let page=p.page||1, size=p.size||10, sortKey=p.sortKey||null, sortDir=p.sortDir||"asc", filter=p.filter||"";
    let rows=isArr(p.rows)? p.rows.slice():[], total=rows.length, loading=false, error=null, hidden=new Set((p.columns||[]).filter(c=>c.hidden).map(c=>c.key));
    let sel = new Set();
    const mark=()=> app && app.helpers && app.helpers.mark && app.helpers.mark(p.uKey||"DataTablePro");

    async function load(){
      if(!p.ajax || !p.ajax.url) return;
      loading=true; error=null; mark();
      try{
        const params = isFn(p.ajax.params)? p.ajax.params({ page,size,sortKey,sortDir,filter }): Object.assign({}, p.ajax.params||{}, { page,size,sortKey,sortDir,filter });
        const res = await DataSource.fetch({ url:p.ajax.url, method:p.ajax.method||'GET', query:(p.ajax.method==="GET"?params:null), body:(p.ajax.method!=="GET"?params:null), map:p.ajax.map });
        const mapped = isObj(res)&&("rows" in res) ? res : { rows:(res.items||res.data||[]), total:(res.total||0) };
        rows = mapped.rows||[]; total = +mapped.total||rows.length;
      }catch(e){ error=e.message||String(e); }
      loading=false; mark();
    }
    if (p.ajax) load();

    function viewRows(){
      let data = rows.slice();
      if(!p.ajax && filter) data = data.filter(r => (p.columns||[]).some(c => String(r[c.key]??"").toLowerCase().includes(filter.toLowerCase())));
      if(!p.ajax && sortKey) data = data.sort((a,b)=>{ const va=a[sortKey], vb=b[sortKey]; if(va==vb) return 0; return (va>vb?1:-1)*(sortDir==="asc"?1:-1); });
      const pages = Math.max(1, Math.ceil((p.ajax? total:data.length)/size));
      const start=(page-1)*size;
      const paged = p.ajax? data : data.slice(start, start+size);
      return { data:paged, pages };
    }

    const onSort=(k)=>{ sortDir = (sortKey===k && sortDir==='asc')? 'desc':'asc'; sortKey=k; p.ajax? load(): mark(); };
    const onPage=(i)=>{ page=i; p.ajax? load(): mark(); };
    const onFilter=(e)=>{ filter = e.target.value; p.ajax? load(): mark(); };
    const toggleCol=(k)=>{ hidden.has(k)? hidden.delete(k) : hidden.add(k); mark(); };
    const toggleAll=(checked, data)=>{ sel = new Set(checked? data.map((_,i)=>i): []); mark(); };
    const toggleRow=(i, row, checked)=>{ checked? sel.add(i): sel.delete(i); isFn(p.onRowSelect) && p.onRowSelect(row, checked); mark(); };

    const cols = (p.columns||[]).filter(c=> !hidden.has(c.key));
    const vr = ()=> viewRows();
    const dataTools = A.Div(TW("flex items-center gap-2 mb-2"),{ default:[
      A.Input({ placeholder:t("ui.search",{fallback:"Search..."},app), value:filter, onInput:onFilter, class:"flex-1 rounded-xl border px-3 py-2" }),
      A.Button({ onClick:()=>Exporter.csv(rows, p.columns, "table.csv") }, { default:["CSV"] }),
      A.Button({ onClick:()=>Exporter.xls(rows, p.columns, "table.xls") }, { default:["Excel"] }),
      A.Button({ onClick:()=>Exporter.printHTML('<html><head><title>Print</title></head><body>'+ (function(){const d=document.createElement('div'); d.appendChild(A.toNode(table())); return d.innerHTML; })() +'</body></html>') }, { default:[t("ui.print",{fallback:"Print"},app)] }),
      A.Div({ class:"relative" }, { default:[
        A.Button({ class:"px-2 rounded border" }, { default:[t("ui.columns",{fallback:"Columns"},app)] }),
        A.Ul({ class:"absolute right-0 z-50 mt-2 min-w-[12rem] rounded-xl border bg-white p-1 shadow" }, { default:
          (p.columns||[]).map(c=> A.Li({ class:"px-3 py-2 rounded hover:bg-slate-100 cursor-pointer", onClick:()=>toggleCol(c.key) }, { default:[ hidden.has(c.key)?"☐ ":"☑ ", c.title||c.key ] }))
        })
      ]})
    ]});

    const header = A.Tr({}, { default:[
      A.Th({ class:"px-2 py-1" }, { default:[ A.Input({ type:"checkbox", onChange:(e)=>toggleAll(e.target.checked, vr().data) }) ] }),
      ...cols.map(c=> A.Th({ onClick:()=>onSort(c.key), class:C("cursor-pointer select-none px-2 py-1", sortKey===c.key?"text-indigo-600":"") }, { default:[ c.title||c.key ] }))
    ]});

    const body = ()=> vr().data.map((r,i)=> A.Tr({}, { default:[
      A.Td({ class:"px-2 py-1" }, { default:[ A.Input({ type:"checkbox", checked:sel.has(i), onChange:(e)=>toggleRow(i,r,e.target.checked) }) ] }),
      ...cols.map(c=> A.Td({ class:"px-2 py-1" }, { default:[ c.render? c.render(r[c.key], r) : String(r[c.key]??"") ] }))
    ]}));

    const pager = ()=> A.Div(TW("flex items-center gap-2 mt-2"),{ default: range(vr().pages).map(i=> A.Button({
      class:C("px-2 py-1 rounded", i===page?"bg-indigo-600 text-white":"bg-slate-100"), onClick:()=>onPage(i)
    }, { default:[ String(i) ] })) });

    const table = ()=> A.Table(TW("w-full text-sm border"), { default:[ A.Thead({}, { default: [ header ] }), A.Tbody({}, { default: body() }) ] });

    return A.Div({ class:C("",p.class) }, { default:[
      dataTools,
      loading? A.Div(TW("p-2 text-slate-500"),{default:[t("ui.loading",{fallback:"Loading..."},app)]}) :
      error?   A.Div(TW("p-2 text-rose-600"),{default:[String(error)]}) :
               table(),
      pager()
    ]});
  });

  // ============== Organ (Composites/Tools) ==============
  // CommandPalette (Ctrl/Cmd + K)
  Comp.organ.define("CommandPalette", (A,s,app,p={},sl={})=>{
    let visible = !!p.open, q="";
    const mark=()=> app && app.helpers && app.helpers.mark && app.helpers.mark(p.uKey||"CommandPalette");
    const onKey=(e)=>{ if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==="k"){ e.preventDefault(); visible=true; mark(); } else if(e.key==="Escape" && visible){ visible=false; mark(); } };
    const run=(it)=>{ visible=false; isFn(it.run)&&it.run(); mark(); };
    return A.Div({ onMounted:()=>document.addEventListener("keydown",onKey), onUnmounted:()=>document.removeEventListener("keydown",onKey) }, {
      default:[
        visible? A.Div(TW("fixed inset-0 z-[1200] flex items-start justify-center p-8 bg-black/30"),{ default:[
          A.Div(TW("w-[min(720px,95vw)] rounded-2xl border bg-white p-2 shadow-xl"),{ default:[
            A.Input({ placeholder:t("ui.search",{fallback:"Search..."},app), value:q, onInput:e=>{ q=e.target.value; mark(); }, class:"w-full rounded-xl border px-3 py-2 mb-2" }),
            A.Ul({ class:"max-h-[50vh] overflow-auto" }, { default:
              (p.items||[]).filter(it=>!q || String(it.title).toLowerCase().includes(q.toLowerCase()))
              .map(it=> A.Li({ class:"px-3 py-2 rounded hover:bg-slate-100 cursor-pointer", onClick:()=>run(it) }, { default:[it.title, it.shortcut? A.Span(TW("float-right text-xs text-slate-500"),{default:[it.shortcut]}):null]}))
            })
          ]})
        ]}): null
      ]
    });
  });

  // ReportTool: Parameters → AJAX → DataTablePro + Chart
  Comp.organ.define("ReportTool", (A,s,app,p={},sl={})=>{
    // endpoint:{ url, method, params(state)=>{}, map(res)=>{rows,total,chart} }
    let qState = Object.assign({}, p.defaultParams||{});
    let rows=[], total=0, chartCfg=null, loading=false, error=null, page=1, size=p.size||10, sortKey=null, sortDir='asc';
    const mark=()=> app && app.helpers && app.helpers.mark && app.helpers.mark(p.uKey||"ReportTool");

    async function run(){
      loading=true; error=null; mark();
      try{
        const params = isFn(p.endpoint?.params)? p.endpoint.params({ ...qState, page,size,sortKey,sortDir }) : Object.assign({}, qState, { page,size,sortKey,sortDir });
        const res = await DataSource.fetch({ url:p.endpoint.url, method:p.endpoint.method||'GET', query:(p.endpoint.method==="GET"?params:null), body:(p.endpoint.method!=="GET"?params:null) });
        const mapped = isFn(p.map)? p.map(res) : (isFn(p.endpoint?.map)? p.endpoint.map(res) : { rows:(res.items||res.data||[]), total:(res.total||0), chart:(res.chart||null) });
        rows = mapped.rows||[]; total=+mapped.total||rows.length; chartCfg = mapped.chart||null;
      }catch(e){ error=e.message||String(e); }
      loading=false; mark();
    }

    const setParam=(k,v)=>{ qState[k]=v; };
    const submit=(e)=>{ e&&e.preventDefault&&e.preventDefault(); page=1; run(); };

    const Params = isFn(p.paramsUI)? p.paramsUI({ state:qState, set:setParam, submit, app })
    : A.Form({ onSubmit:submit }, { default:[
        A.Div(TW("grid grid-cols-1 md:grid-cols-3 gap-3"), { default:(p.fields||[]).map(f=>{
          const label= A.Label(TW("block text-sm mb-1"),{default:[f.label||f.key]});
          const control = f.type==='date'   ? Comp.call("DatePicker",{ value:qState[f.key], onChange:(v)=>setParam(f.key,v) }) :
                          f.type==='select' ? Comp.call("AsyncSelect",{ url:f.url, options:f.options, mapOption:f.mapOption, value:qState[f.key], onSelect:(opt)=>setParam(f.key,opt.value) }) :
                                              A.Input({ value:qState[f.key]||"", onInput:e=>setParam(f.key,e.target.value), class:"w-full rounded-xl border px-3 py-2" });
          return A.Div(TW("mb-2"),{ default:[ label, control ] });
        })}),
        A.Div(TW("mt-2 flex justify-end"),{ default:[ Comp.call("Button",{ text:t("ui.run",{fallback:"Run"},app) }) ]})
      ]});

    const ChartArea = chartCfg? A.Div(TW("rounded-2xl border p-3"),{ default:[
      A.Canvas({ ref:(el)=>{ try{
        if(window.Chart){ if(el.__chart) try{el.__chart.destroy()}catch(_){}
          const ctx=el.getContext('2d'); el.__chart = new window.Chart(ctx, { type:(chartCfg.type||'bar'), data:(chartCfg.data||{}), options:(chartCfg.options||{}) }); }
        else if (isFn(p.customChartRenderer)) { p.customChartRenderer(el, chartCfg); }
      }catch(_){ } } })
    ]}) : null;

    const TableArea = Comp.call("DataTablePro",{
      columns:p.columns||[], rows, size, page, sortKey, sortDir, tools:true,
      onPage:(i)=>{ page=i; mark(); }, onSort:(k,dir)=>{ sortKey=k; sortDir=dir; mark(); }
    });

    if (p.autoLoad!==false && p.endpoint?.url) run();

    return A.Div(TW("grid gap-4 grid-cols-1 md:grid-cols-3"),{ default:[
      A.Div(TW("md:col-span-3"),{ default:[ Params ]}),
      A.Div(TW("md:col-span-2"),{ default:[ loading? A.Div(TW("p-2 text-slate-500"),{default:[t("ui.loading",{fallback:"Loading..."},app)]}) : error? A.Div(TW("p-2 text-rose-600"),{default:[String(error)]}) : TableArea ]}),
      A.Div(TW("md:col-span-1"),{ default:[ ChartArea ]})
    ]});
  });

  // ========= attach to namespace =========
  M.Comp = Comp;

  // ========= JSONAdv bridge (اختياري) =========
  const JSONAdv = M.JSONAdv;
  if(JSONAdv){
    const oldSet = JSONAdv.setApp && JSONAdv.setApp.bind(JSONAdv);
    JSONAdv.setApp = function(app){ this.__app = app; return this };
    const oldToSpec = JSONAdv.toSpec && JSONAdv.toSpec.bind(JSONAdv);
    JSONAdv.toSpec = function(json, state){
      if (json && isObj(json) && json.comp){
        const n = String(json.comp);
        const p = json.props||json.p||{};
        const s = json.slots||json.s||json.children||{};
        return call(n,p,s,state,this.__app||null);
      }
      return oldToSpec? oldToSpec(json,state): json;
    }
  }

  const FocusTrap = {
    trap(root, opts = {}) {
      if (!root) return () => {};
      const prev = document.activeElement;
      const getFocusable = () => (U.getFocusables ? U.getFocusables(root) : Array.from(root.querySelectorAll('a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter(el => !el.hasAttribute('aria-hidden')));
      const focusables = getFocusable();
      if (opts.initialFocus) {
        const target = typeof opts.initialFocus === 'string' ? root.querySelector(opts.initialFocus) : opts.initialFocus;
        if (target && target.focus) target.focus();
      } else if (focusables.length && focusables[0].focus) {
        focusables[0].focus();
      }
      const handler = (e) => {
        if (e.key !== 'Tab') return;
        const list = getFocusable();
        if (!list.length) return;
        const first = list[0];
        const last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last && last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first && first.focus();
        }
      };
      root.addEventListener('keydown', handler);
      return () => {
        root.removeEventListener('keydown', handler);
        if (opts.restoreFocus !== false && prev && prev.focus) {
          try { prev.focus(); } catch (_) {}
        }
      };
    },
    focusFirst(root) {
      if (!root) return false;
      if (U.focusFirst) return U.focusFirst(root);
      const focusables = Array.from(root.querySelectorAll('a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'));
      if (focusables.length && focusables[0].focus) { focusables[0].focus(); return true; }
      return false;
    },
    onOutsideClick(root, cb) {
      return U.onOutsideClick ? U.onOutsideClick(root, cb) : () => {};
    }
  };

  const PortalRoot = {
    ensure(id = 'mishkah-portal-root') {
      let el = document.getElementById(id);
      if (!el) {
        el = document.createElement('div');
        el.id = id;
        el.dataset.portalRoot = 'true';
        document.body.appendChild(el);
      }
      return el;
    },
    clear(id) {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '';
    },
    mount(id, node) {
      const root = this.ensure(id);
      if (node) root.appendChild(node);
      return () => {
        if (node && node.parentNode === root) root.removeChild(node);
      };
    }
  };

  const CurrencyUtil = {
    symbol(currency = 'USD', locale = 'en') {
      try {
        const parts = new Intl.NumberFormat(locale, { style: 'currency', currency }).formatToParts(0);
        const token = parts.find(part => part.type === 'currency');
        return token ? token.value : currency;
      } catch (_) {
        return currency;
      }
    },
    format(value, options = {}) {
      if (value == null || value === '') return '';
      const locale = options.locale || 'en';
      const currency = options.currency || 'USD';
      const minimumFractionDigits = options.minimumFractionDigits != null ? options.minimumFractionDigits : 2;
      const maximumFractionDigits = options.maximumFractionDigits != null ? options.maximumFractionDigits : minimumFractionDigits;
      try {
        return new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits, maximumFractionDigits }).format(value);
      } catch (_) {
        const num = Number(value);
        return Number.isFinite(num) ? num.toFixed(minimumFractionDigits) : String(value);
      }
    },
    parse(input, options = {}) {
      if (input == null) return 0;
      const locale = options.locale || 'en';
      const raw = String(input).trim();
      if (!raw) return 0;
      const normalized = raw.replace(/[\s\u00a0]/g, '');
      const decimal = locale.startsWith('fr') || locale.startsWith('ar') ? ',' : '.';
      let cleaned = normalized.replace(new RegExp(`[^0-9${decimal}-]`, 'g'), '');
      if (decimal === ',') cleaned = cleaned.replace(/\./g, '').replace(',', '.');
      else cleaned = cleaned.replace(/,/g, '');
      const num = parseFloat(cleaned);
      return Number.isNaN(num) ? 0 : num;
    }
  };

  const PhoneUtil = {
    normalize(value) {
      return String(value || '').replace(/[^0-9+]/g, '');
    },
    format(value, { country } = {}) {
      const raw = this.normalize(value);
      if (!raw) return '';
      if (raw.startsWith('+')) {
        return raw.replace(/(\+\d{1,3})(\d{3})(\d{3})(\d{0,4})/, (_, c, a, b, rest) => rest ? `${c} ${a} ${b} ${rest}` : `${c} ${a} ${b}`);
      }
      if (raw.length === 11) {
        return raw.replace(/(\d{3})(\d{3})(\d{5})/, '$1 $2 $3');
      }
      if (raw.length === 10) {
        return raw.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3');
      }
      return raw;
    }
  };

  const Hotkeys = (() => {
    const registry = new Map();
    let installed = false;
    const normalize = combo => String(combo || '').trim().toLowerCase();
    const parse = combo => normalize(combo).split('+').map(part => part.trim()).filter(Boolean);
    function match(e, parts) {
      let main = null;
      let needAlt = false, needShift = false, needCtrl = false, needMeta = false, needMod = false;
      for (const part of parts) {
        if (part === 'alt') { needAlt = true; continue; }
        if (part === 'shift') { needShift = true; continue; }
        if (part === 'ctrl' || part === 'control') { needCtrl = true; continue; }
        if (part === 'meta' || part === 'cmd' || part === 'command') { needMeta = true; continue; }
        if (part === 'mod') { needMod = true; continue; }
        main = part;
      }
      const key = (e.key || '').toLowerCase();
      const eventKey = key === ' ' ? 'space' : key;
      if (main && main !== eventKey) return false;
      if (needAlt && !e.altKey) return false;
      if (needShift && !e.shiftKey) return false;
      if (needCtrl && !e.ctrlKey) return false;
      if (needMeta && !e.metaKey) return false;
      if (needMod && !(e.metaKey || e.ctrlKey)) return false;
      if (e.altKey && !needAlt) return false;
      if (e.shiftKey && !needShift) return false;
      if (e.ctrlKey && !needCtrl && !needMod) return false;
      if (e.metaKey && !needMeta && !needMod) return false;
      return true;
    }
    function handle(e) {
      registry.forEach(set => {
        set.forEach(entry => {
          if (match(e, entry.parts)) {
            if (entry.options.preventDefault !== false) e.preventDefault();
            if (entry.options.stopPropagation) e.stopPropagation();
            try { entry.handler(e); } catch (err) { console.error('[Mishkah.Hotkeys]', err); }
          }
        });
      });
    }
    function install() {
      if (installed) return;
      installed = true;
      document.addEventListener('keydown', handle, true);
    }
    function uninstallIfIdle() {
      if (!installed) return;
      if (registry.size === 0) {
        document.removeEventListener('keydown', handle, true);
        installed = false;
      }
    }
    function register(combo, handler, options = {}) {
      if (!combo || !isFn(handler)) return () => {};
      const norm = normalize(combo);
      const entry = { combo: norm, handler, options, parts: parse(combo) };
      if (!registry.has(norm)) registry.set(norm, new Set());
      registry.get(norm).add(entry);
      install();
      return () => {
        const set = registry.get(norm);
        if (set) {
          set.delete(entry);
          if (!set.size) registry.delete(norm);
        }
        uninstallIfIdle();
      };
    }
    function clear() {
      registry.clear();
      uninstallIfIdle();
    }
    return { register, clear, active: () => Array.from(registry.keys()) };
  })();

  Comp.util.register('FocusTrap', FocusTrap);
  Comp.util.register('PortalRoot', PortalRoot);
  Comp.util.register('Currency', CurrencyUtil);
  Comp.util.register('Phone', PhoneUtil);
  Comp.util.register('Hotkeys', Hotkeys);

  console.info("[Mishkah.Comp] Loaded components (v5): Icon, Button, Input, SelectBase, Spinner, Skeleton, NumberInput, PasswordInput, TagInput, AsyncSelect, MultiSelect, AutocompleteTable, DatePicker, DateRange, FileUpload, ContextMenu, SplitterH, EmptyState, PageHeader, NavMenu, DataTable, DataTablePro, CommandPalette, ReportTool.");
  M.Comp.mole.POSRest = {}; // Create the namespace
  console.info("[Mishkah.Comp] POSRest namespace created.");

})(window);



function runPOSDiagnostics() {
  console.clear();
  console.log("%c🏪 بدء تشخيص تطبيق POS الشامل 🏪", "color: #dc2626; font-size: 1.4em; font-weight: bold; background: #fef2f2; padding: 8px; border-radius: 4px;");
  
  let diagnosticResults = {
    phase1: false,
    phase2: false, 
    phase3: false,
    phase4: false,
    phase5: false
  };

  // --- المرحلة 1: فحص البيئة الأساسية ---
  console.log("\n%c=== المرحلة 1: فحص البيئة الأساسية ===", "color: #059669; font-weight: bold; font-size: 1.1em;");
  
  const coreChecks = {
    mishkahCore: !!window.Mishkah,
    mishkahAtoms: !!(window.Mishkah?.Atoms),
    mishkahCore_createApp: !!(window.Mishkah?.Core?.createApp),
    mockDatabase: !!window.database,
    posComponents: !!window.POSC,
    appInstance: !!window.app,
    htmlRoot: !!document.querySelector('#app')
  };

  let phase1Success = true;
  for (const [key, value] of Object.entries(coreChecks)) {
    const status = value ? '✅' : '❌';
    const color = value ? 'color: #16a34a' : 'color: #dc2626';
    console.log(`%c${status} ${key.padEnd(20, ' ')}: ${value ? 'متوفر' : 'مفقود'}`, color);
    if (!value) phase1Success = false;
  }
  
  diagnosticResults.phase1 = phase1Success;
  if (!phase1Success) {
    console.error("%c⛔ توقف التشخيص: البيئة الأساسية غير مكتملة!", "color: #dc2626; font-weight: bold; background: #fee2e2; padding: 4px;");
    return diagnosticResults;
  }

  // --- المرحلة 2: فحص البيانات الأولية ---
  console.log("\n%c=== المرحلة 2: فحص البيانات الأولية ===", "color: #059669; font-weight: bold; font-size: 1.1em;");
  
  const dataChecks = {
    categories: (window.database?.categories || []).length,
    items: (window.database?.items || []).length,
    employees: (window.database?.employees || []).length,
    tables: (window.database?.tables || []).length
  };

  let phase2Success = true;
  for (const [key, count] of Object.entries(dataChecks)) {
    const hasData = count > 0;
    const status = hasData ? '✅' : '⚠️';
    const color = hasData ? 'color: #16a34a' : 'color: #f59e0b';
    console.log(`%c${status} ${key.padEnd(15, ' ')}: ${count} عنصر`, color);
    if (!hasData && key === 'categories') phase2Success = false;
  }
  
  diagnosticResults.phase2 = phase2Success;

  // --- المرحلة 3: فحص مكونات POSC ---
  console.log("\n%c=== المرحلة 3: فحص مكونات POSC ===", "color: #059669; font-weight: bold; font-size: 1.1em;");
  
  const poscComponents = ['header', 'menu', 'order', 'modals'];
  let phase3Success = true;
  
  for (const comp of poscComponents) {
    const fn = window.POSC?.[comp];
    const isFunction = typeof fn === 'function';
    const status = isFunction ? '✅' : '❌';
    const color = isFunction ? 'color: #16a34a' : 'color: #dc2626';
    console.log(`%c${status} POSC.${comp.padEnd(10, ' ')}: ${isFunction ? 'دالة صحيحة' : 'مفقودة أو خاطئة'}`, color);
    if (!isFunction) phase3Success = false;
  }
  
  diagnosticResults.phase3 = phase3Success;

  // --- المرحلة 4: فحص تطبيق Mishkah ---
  console.log("\n%c=== المرحلة 4: فحص تطبيق Mishkah ===", "color: #059669; font-weight: bold; font-size: 1.1em;");
  
  try {
    const app = window.app;
    const truth = app?.truth;
    const state = truth?.get();
    
    console.log("%c✅ التطبيق موجود:", "color: #16a34a", app ? 'نعم' : 'لا');
    console.log("%c✅ Truth store موجود:", "color: #16a34a", truth ? 'نعم' : 'لا');
    console.log("%c✅ State متوفر:", "color: #16a34a", state ? 'نعم' : 'لا');
    
    if (state) {
      console.log("📊 محتويات State الحالية:");
      console.log("   - settings:", !!state.settings);
      console.log("   - catalog:", !!state.catalog);
      console.log("   - employees:", Array.isArray(state.employees) ? `${state.employees.length} موظف` : 'غير محدد');
      console.log("   - session:", !!state.session);
      console.log("   - order:", !!state.order);
      console.log("   - ui:", !!state.ui);
    }
    
    diagnosticResults.phase4 = !!(app && truth && state);
  } catch (error) {
    console.error("%c❌ خطأ في فحص التطبيق:", "color: #dc2626", error);
    diagnosticResults.phase4 = false;
  }

  // --- المرحلة 5: محاكاة بناء المكونات ---
  console.log("\n%c=== المرحلة 5: محاكاة بناء المكونات ===", "color: #059669; font-weight: bold; font-size: 1.1em;");
  
  let phase5Success = true;
  const state = window.app?.truth?.get();
  
  for (const compName of poscComponents) {
    try {
      console.log(`\n🔧 اختبار مكون: ${compName}`);
      
      const fn = window.POSC[compName];
      if (typeof fn !== 'function') {
        throw new Error(`${compName} ليس دالة`);
      }
      
      console.log(`   ✅ الدالة متوفرة`);
      
      const result = fn(state);
      console.log(`   ✅ تم تنفيذ الدالة`);
      console.log(`   📦 نوع النتيجة:`, typeof result);
      
      if (result && typeof result === 'object' && result.__A) {
        console.log(`   ✅ النتيجة كائن Atoms صحيح`);
        
        // محاولة تحويل إلى DOM
        const domNode = window.Mishkah.Atoms.toNode(result);
        if (domNode instanceof Node) {
          console.log(`   ✅ تم تحويل إلى DOM بنجاح`);
          console.log(`   🏷️ نوع العقدة:`, domNode.constructor.name);
        } else {
          throw new Error('فشل تحويل إلى DOM');
        }
      } else {
        throw new Error('النتيجة ليست كائن Atoms صحيح');
      }
      
      console.log(`   %c🎉 ${compName} يعمل بنجاح!`, "color: #16a34a; font-weight: bold");
      
    } catch (error) {
      console.error(`   %c💥 فشل ${compName}:`, "color: #dc2626; font-weight: bold", error.message);
      console.error(`   📍 التفاصيل:`, error);
      phase5Success = false;
    }
  }
  
  diagnosticResults.phase5 = phase5Success;

  // --- النتيجة النهائية ---
  console.log("\n%c📋 ملخص التشخيص النهائي 📋", "color: #1e40af; font-size: 1.3em; font-weight: bold; background: #eff6ff; padding: 8px; border-radius: 4px;");
  
  for (const [phase, success] of Object.entries(diagnosticResults)) {
    const status = success ? '✅' : '❌';
    const color = success ? 'color: #16a34a' : 'color: #dc2626';
    console.log(`%c${status} ${phase}: ${success ? 'نجح' : 'فشل'}`, color);
  }
  
  const allSuccess = Object.values(diagnosticResults).every(Boolean);
  
  if (allSuccess) {
    console.log("\n%c🎊 جميع المراحل نجحت! التطبيق يجب أن يعمل الآن. 🎊", "color: #16a34a; font-size: 1.2em; font-weight: bold; background: #f0fdf4; padding: 8px; border-radius: 4px;");
    console.log("\n%c💡 إذا كانت الشاشة لا تزال فارغة، تحقق من:", "color: #f59e0b; font-weight: bold;");
    console.log("   1. هل تم تشغيل app.dispatch('boot')؟");
    console.log("   2. هل تم تسجيل المناطق بشكل صحيح؟");
    console.log("   3. هل هناك أخطاء JavaScript في الكونسول؟");
  } else {
    console.log("\n%c🚨 التشخيص يشير إلى مشاكل في التطبيق! 🚨", "color: #dc2626; font-size: 1.2em; font-weight: bold; background: #fef2f2; padding: 8px; border-radius: 4px;");
    console.log("راجع المراحل التي فشلت أعلاه لحل المشكلة.");
  }
  
  return diagnosticResults;
}

// وظيفة تشخيص مبسطة للاستدعاء السريع
function quickPOSCheck() {
  console.log("%c🔍 فحص سريع لـ POS", "color: #2563eb; font-weight: bold;");
  
  const issues = [];
  
  if (!window.Mishkah) issues.push("❌ Mishkah Core مفقود");
  if (!window.database) issues.push("❌ Mock data مفقود");  
  if (!window.POSC) issues.push("❌ POSC components مفقود");
  if (!window.app) issues.push("❌ App instance مفقود");
  if (!document.querySelector('#app')) issues.push("❌ HTML root مفقود");
  
  if (issues.length === 0) {
    console.log("✅ جميع المكونات الأساسية موجودة");
    console.log("💡 شغل runPOSDiagnostics() للفحص التفصيلي");
  } else {
    console.log("⚠️ مشاكل تم العثور عليها:");
    issues.forEach(issue => console.log(`   ${issue}`));
  }
}

// إضافة للـ window global
window.runPOSDiagnostics = runPOSDiagnostics;
window.quickPOSCheck = quickPOSCheck;
