(function (window) {
    const perf = (typeof performance !== "undefined" && performance) || { now: Date.now, mark() {}, measure() {} };
    const now = () => perf.now();
    const asArray = v => v == null ? [] : Array.isArray(v) ? v : String(v).split(",").map(s => s.trim()).filter(Boolean);

    function createRing(cap = 500) {
        const b = [];
        return { push(x){ if(b.length===cap) b.shift(); b.push(x) }, tail(n=cap){ return b.slice(-n) }, size(){ return b.length } };
    }

    function createTruth(initial, options = {}) {
        let state = initial;
        const subs = new Set();
        let batching = 0, scheduled = false;
        const dirty = new Map();
        const frozen = new Set();
        let keysProvider = () => ({ keys: [], groups: {} });
        const strictState = !!options.strictState;

        function get(){ return state }

        function set(p){
            const next = typeof p === "function" ? p(state) : p;
            if (strictState && (next === undefined || next === null || typeof next !== 'object')) {
                throw new Error(`[Mishkah] truth.set() updater must return a state object in strictState mode.`);
            }
            if (next !== state) {
                state = next;
                if (!batching) schedule();
            }
        }

        function produce(mutator) {
            const base = (typeof structuredClone === 'function') ? structuredClone(state) : JSON.parse(JSON.stringify(state));
            mutator(base);
            set(base);
        }

        function mark(selectors) {
            const selectorsToMark = asArray(selectors);
            const registry = keysProvider();
            for (const selector of selectorsToMark) {
                if (String(selector).startsWith('.')) {
                    const groupName = selector.slice(1);
                    const keysInGroup = registry.groups[groupName] || [];
                    for (const k of keysInGroup) {
                        if (k && !frozen.has(k)) dirty.set(k, "patch");
                    }
                } else {
                    const keyName = String(selector).startsWith('#') ? selector.slice(1) : selector;
                    if (keyName && !frozen.has(keyName)) dirty.set(keyName, "patch");
                }
            }
            if (!batching) schedule();
        }

        function rebuild(selectors) {
            const selectorsToRebuild = asArray(selectors);
            const registry = keysProvider();
            for (const selector of selectorsToRebuild) {
                if (String(selector).startsWith('.')) {
                    const groupName = selector.slice(1);
                    const keysInGroup = registry.groups[groupName] || [];
                    for (const k of keysInGroup) {
                        if (k && !frozen.has(k)) dirty.set(k, "rebuild");
                    }
                } else {
                    const keyName = String(selector).startsWith('#') ? selector.slice(1) : selector;
                    if (keyName && !frozen.has(keyName)) dirty.set(keyName, "rebuild");
                }
            }
            if (!batching) schedule();
        }

        function rebuildAll(arg) {
            if (arg && typeof arg === 'object' && 'except' in arg) {
                const registry = keysProvider();
                const excludedKeys = new Set();
                asArray(arg.except).forEach(selector => {
                    if (String(selector).startsWith('.')) {
                        const groupName = selector.slice(1);
                        const keysInGroup = registry.groups[groupName] || [];
                        keysInGroup.forEach(k => excludedKeys.add(k));
                    } else {
                        const keyName = String(selector).startsWith('#') ? selector.slice(1) : selector;
                        excludedKeys.add(keyName);
                    }
                });
                const all = registry.keys || [];
                for (const k of all) {
                    if (!frozen.has(k) && !excludedKeys.has(k)) dirty.set(k, "rebuild");
                }
                if (!batching) schedule();
                return;
            }
            if (typeof arg === 'function') {
                const all = keysProvider().keys || [];
                for (const k of all) {
                    if (!frozen.has(k) && arg(k)) dirty.set(k, "rebuild");
                }
                if (!batching) schedule();
                return;
            }
            const all = keysProvider().keys || [];
            for (const k of all) {
                if (!frozen.has(k)) dirty.set(k, "rebuild");
            }
            if (!batching) schedule();
        }

        function rebuildAllExcept(excepts) {
            rebuildAll({ except: excepts });
        }

        function batch(fn) {
            batching++;
            try { fn() }
            finally { batching--; if (!batching) schedule() }
        }

        function schedule() {
            if (scheduled) return;
            scheduled = true;
            queueMicrotask(() => {
                scheduled = false;
                const d = new Map(dirty);
                dirty.clear();
                for (const s of subs) s({ state, dirty: d, frozen: new Set(frozen) });
            });
        }

        function subscribe(fn){ subs.add(fn); fn({ state, dirty: new Map(), frozen: new Set(frozen) }); return ()=>subs.delete(fn) }
        function freeze(k){ asArray(k).forEach(key => frozen.add(String(key).startsWith('#') ? key.slice(1) : key)); }
        function unfreeze(k){ asArray(k).forEach(key => frozen.delete(String(key).startsWith('#') ? key.slice(1) : key)); }
        function bindKeysProvider(fn){ keysProvider = fn || (()=>({keys:[], groups:{}})); }

        return { get, set, produce, mark, rebuild, rebuildAll, rebuildAllExcept, batch, freeze, unfreeze, subscribe, bindKeysProvider };
    }

    function createGuardian() {
        const rules = [];
        let mode = "warn";
        function addRule(n, fn) { rules.push({ name: n, fn }) }
        function setMode(m) { mode = m === "strict" ? "strict" : "warn" }
        function validate(entry) {
            const errs = [];
            for (const r of rules) {
                try {
                    const res = r.fn(entry);
                    if (res === true) continue;
                    if (res === false) errs.push({ rule: r.name, msg: "violation" });
                    else if (res && res.violation) errs.push({ rule: r.name, msg: res.msg || "violation", meta: res.meta });
                } catch (e) { errs.push({ rule: r.name, msg: String(e) }) }
            }
            if (mode === "strict" && errs.length) throw Object.assign(new Error("policy violation"), { violations: errs });
            return errs;
        }
        return { addRule, validate, setMode };
    }

    function addPerformancePolicy(g, defaults = {}) {
        const DEF = { maxMs: 32 };
        const conf = { ...DEF, ...defaults };
        g.addRule('max-commit-ms', (entry) => {
            const last = +(entry.metrics?.lastMs || 0);
            const budget = entry.budget || {};
            const maxMs = budget.maxMs ?? conf.maxMs;
            if (last > maxMs) {
                return { violation: true, msg: 'commit too slow', meta: { key: entry.key, lastMs: last, budget: { maxMs } } };
            }
            return true;
        });
    }

    function preserveFocus(root){
        const ae = document.activeElement;
        if (!ae || !root || !root.contains(ae)) return () => {};
        const info = {
            id: ae.id || null,
            name: ae.getAttribute("name") || null,
            selStart: ("selectionStart" in ae) ? ae.selectionStart : null,
            selEnd: ("selectionEnd" in ae) ? ae.selectionEnd : null
        };
        return () => {
            if (!root) return;
            let target = null;
            if (info.id) target = root.querySelector(`[id="${CSS.escape(info.id)}"]`);
            if (!target && info.name) target = root.querySelector(`[name="${CSS.escape(info.name)}"]`);
            if (target) {
                try {
                    target.focus();
                    if (info.selStart != null && "setSelectionRange" in target) {
                        target.setSelectionRange(info.selStart, info.selEnd);
                    }
                } catch(e) {}
            }
        };
    }

    function postSync(root){
        if (!root) return;
        root.querySelectorAll("select").forEach(sel => {
            const raw = sel.getAttribute("data-value") ?? sel.getAttribute("value");
            if (raw == null) return;
            sel.value = raw;
        });
    }

    function createAuditor() {
        const log = createRing(1500), stats = new Map();
        function ensure(k) { if (!stats.has(k)) stats.set(k, { commits: 0, lastMs: 0, avgMs: 0, slowCount: 0, errors: 0, violations: 0 }); return stats.get(k) }
        function onCommit(k, ms, budget) { const st = ensure(k); st.commits++; st.lastMs = ms; st.avgMs = st.avgMs ? (st.avgMs * 0.9 + ms * 0.1) : ms; const max = (budget && budget.maxMs) || 32; if (ms > max) st.slowCount++ }
        function onViolation(k, n = 1) { ensure(k).violations += n }
        function onError(k) { ensure(k).errors++ }
        function getSnapshot() { const out = { instances: {}, log: log.tail(300) }; for (const [k, v] of stats) out.instances[k] = { ...v }; return out }
        return { onCommit, onViolation, onError, getSnapshot, stats, log };
    }
function createAttrDelegator() {
  const MAP = [
    ["click","onclick"],
    ["change","onchange"],
    ["input","oninput"],
    ["submit","onsubmit", true],
    ["keydown","onkeydown"],
    ["pointerdown","onpointerdown"]
  ];
  return function attach(root, dispatch, options = {}) {
    const prefix = options.attrPrefix || "data-";
    const offs = [];
    for (const [type, attr, prevent] of MAP) {
      const handler = (e) => {
        const sel = `[${prefix}${attr}]`;
        let el = e.target && (e.target.closest ? e.target.closest(sel) : null);
        if (!el || !root.contains(el)) return;
        const name = el.getAttribute(prefix + attr);
        if (!name) return;
        if (prevent) e.preventDefault();
        dispatch(name, e, el);
      };
      root.addEventListener(type, handler, true);
      offs.push(() => root.removeEventListener(type, handler, true));
    }
    return () => { for (const off of offs) off(); };
  };
}


    function createEnv(opts = {}) {
        const rtl = new Set(["ar", "fa", "he", "ur"]);
        const persist = !!opts.persistEnv;
        const storeKey = "mishkah.env";
        const dictionaries = opts.dictionaries || {};

        function load(){ try { return persist ? JSON.parse(localStorage.getItem(storeKey)) : null } catch(e){ return null }}

        let state = { locale: opts.locale || "en", dir: opts.dir || "auto", theme: opts.theme || "auto", ...load() };
        const listeners = new Set();

        function resolvedDir() { return state.dir === "auto" ? (rtl.has((state.locale||"").split("-")[0]) ? "rtl" : "ltr") : state.dir }
        function resolvedTheme() { if (state.theme !== "auto") return state.theme; return (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light" }

        function applyToDOM() {
            const root = document.documentElement;
            if (!root) return;
            const d = resolvedDir(), th = resolvedTheme();
            root.setAttribute("dir", d);
            root.setAttribute("lang", state.locale);
            root.setAttribute("data-theme", th);
            root.classList.toggle('dark', th === 'dark');
        }

        function persistNow() { if(persist) try { localStorage.setItem(storeKey, JSON.stringify(state)) } catch(e){} }
        function notify() { listeners.forEach(fn => fn(get())) }
        function get() { return { ...state, resolved: { dir: resolvedDir(), theme: resolvedTheme() } } }
        function setLocale(loc) { state.locale = loc; persistNow(); applyToDOM(); notify() }
        function setTheme(t) { state.theme = t; persistNow(); applyToDOM(); notify() }
        function toggleTheme() { setTheme(resolvedTheme() === 'dark' ? 'light' : 'dark') }
        function subscribe(cb) { listeners.add(cb); return () => listeners.delete(cb) }

        function getPath(obj, path) { return String(path).split(".").reduce((acc, part) => acc && acc[part], obj); }
        function interpolate(s, vars) { if (!vars) return s; return String(s).replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`)); }

        function translate(key, vars) {
            const keyTranslations = getPath(dictionaries, key);
            const langChain = Array.from(new Set([state.locale, (state.locale||'').split('-')[0], 'en']));
            if (keyTranslations !== undefined && typeof keyTranslations === 'object') {
                for (const lang of langChain) {
                    if (typeof keyTranslations[lang] === 'string') {
                        return interpolate(keyTranslations[lang], vars);
                    }
                }
            }
            const fallbackText = String(key).replace(/_/g, ' ');
            return interpolate(fallbackText, vars);
        }

        applyToDOM();
        if (window.matchMedia) {
            window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
                if (state.theme === "auto") {
                    applyToDOM();
                    notify();
                }
            });
        }

        const i18n = { t: translate };
        return { get, setLocale, setTheme, toggleTheme, subscribe, i18n };
    }

    function createEngine(truth, guardian, auditor) {
        const instances = new Map();
        const groups = new Map();
        const toNode = window.Mishkah && window.Mishkah.Atoms && window.Mishkah.Atoms.toNode;

        function addToGroups(key, props){
            const groupKeys = asArray(props && props.groupKey);
            for (const gk of groupKeys) {
                if (!groups.has(gk)) groups.set(gk, new Set());
                groups.get(gk).add(key);
            }
        }
        function removeFromGroups(key, props){
            const groupKeys = asArray(props && props.groupKey);
            for (const gk of groupKeys) {
                const set = groups.get(gk);
                if (set) {
                    set.delete(key);
                    if (set.size === 0) groups.delete(gk);
                }
            }
        }

        function registerInstance(key, instanceData) {
            instances.set(key, instanceData);
            addToGroups(key, instanceData.props);
        }

        function unregisterInstance(key) {
            const instance = instances.get(key);
            if (!instance) return;
            removeFromGroups(key, instance.props);
            if (instance.domElement && instance.domElement.parentNode) {
                instance.domElement.parentNode.removeChild(instance.domElement);
            }
            instances.delete(key);
            auditor.stats.delete(key);
        }

        function updateInstanceProps(key, newProps, newSlots){
            const inst = instances.get(key);
            if (!inst) return;
            removeFromGroups(key, inst.props);
            inst.props = newProps || inst.props;
            inst.slots = newSlots || inst.slots;
            addToGroups(key, inst.props);
        }

        function getKeys() {
            const keys = Array.from(instances.keys());
            const groupMap = {};
            for(const [gk, set] of groups.entries()) groupMap[gk] = Array.from(set);
            return { keys, groups: groupMap };
        }

        function commit(state, dirtyMap) {
            if (!dirtyMap || dirtyMap.size === 0 || !toNode) return;
            for (const [key] of dirtyMap) {
                const instance = instances.get(key);
                if (!instance || !instance.domElement) continue;
                const restore = preserveFocus(instance.domElement);
                const t0 = now();
                try {
                    const newSpec = instance.buildFn(state, { uKey: key });
                    const newNode = toNode(newSpec);
                    instance.domElement.replaceChildren(newNode);
                    postSync(instance.domElement);
                    const ms = now() - t0;
                    auditor.onCommit(key, ms, instance.props.budget);
                    const vs = guardian.validate({ key, metrics: { lastMs: ms }, budget: instance.props.budget });
                    if (vs.length) auditor.onViolation(key, vs.length);
                } catch (err) {
                    auditor.onError(key);
                    instance.domElement.innerHTML = `<div style="color:red;border:1px solid red;padding:8px;font-family:monospace;">Error in entity "${key}": ${err.message}</div>`;
                }
                restore();
            }
        }

        return { registerInstance, unregisterInstance, updateInstanceProps, commit, getKeys, instances };
    }

    function Emitter() {
        const m = new Map();
        return {
            on(e, f) {
                (m.get(e) || m.set(e, new Set()).get(e)).add(f);
                return () => this.off(e, f);
            },
            off(e, f) {
                const s = m.get(e);
                if (s) s.delete(f);
            },
            emit(e, p) {
                const s = m.get(e);
                if (s) s.forEach(f => { try { f(p); } catch (err) { console.error('[Mishkah.lifecycle] listener error', err); } });
            }
        };
    }

    function createMessenger(truth, app){
        const reg = new WeakMap();
        function use(el, cfg = {}){
            const ctx = { value: undefined };
            if (typeof cfg.setup === 'function') ctx.value = cfg.setup(el, app) || undefined;
            if (typeof cfg.effect === 'function') cfg.effect(el, truth.get(), app, { ctx, init: true });
            const off = truth.subscribe(({ state, dirty }) => {
                if (!el.isConnected) { off(); reg.delete(el); if (typeof cfg.teardown === 'function') cfg.teardown(el, app, { ctx }); return; }
                if (!cfg.filter || cfg.filter({ state, dirty, app })) {
                    if (typeof cfg.effect === 'function') cfg.effect(el, state, app, { ctx });
                }
            });
            reg.set(el, off);
            return () => { const f = reg.get(el); if (f) f(); reg.delete(el); if (typeof cfg.teardown === 'function') cfg.teardown(el, app, { ctx }); };
        }
        return { use };
    }

    function createApp(opts = {}) {
        const A = window.Mishkah && window.Mishkah.Atoms;

        const truth = createTruth(opts.initial || {}, { strictState: !!opts.strictState });
        const guardian = createGuardian();
        const auditor = createAuditor();
        const engine = createEngine(truth, guardian, auditor);
        const env = createEnv(opts);
        const life = Emitter();

        const origSet = truth.set;
        truth.set = (p) => { life.emit('plan', { prev: truth.get(), updater: p }); return origSet(p) };

        if (opts.perfPolicy) addPerformancePolicy(guardian, opts.perfPolicy);
        truth.bindKeysProvider(engine.getKeys);

let helpersRef = opts.helpers || {};
const coreContext = { truth, guardian, auditor, engine, env, A, i18n: env.i18n, helpers: helpersRef };

        const commands = opts.commands || {};
        function dispatch(name, e, el) {
            const cmd = commands[name];
            if (cmd) { try { cmd({ ...coreContext, call: enhancedCall, dispatch }, e, el); } catch(err) { console.error(`[Mishkah] Command error in "${name}":`, err); } }
        }

        function enhancedCall(name, props = {}, slots = {}) {
            const C = window.Mishkah && window.Mishkah.Comp;
            if (!C || !C.define) throw new Error("Mishkah.Comp is not available.");
            const componentFn = C.registry[name];
            if (!componentFn) return A.h('div', {}, `Component ${name} not found`);

            const key = props.uniqueKey;
            if (key) {
                let instance = engine.instances.get(key);
                const buildFn = (state, ctx) => componentFn(A, state, { ...coreContext, call: enhancedCall, dispatch }, props, slots);
                if (!instance) {
                    instance = { buildFn, props, slots, domElement: null };
                    engine.registerInstance(key, instance);
                } else {
                    instance.buildFn = buildFn;
                    engine.updateInstanceProps(key, props, slots);
                }
                const dataAttrs = {};
                dataAttrs['data-m-k'] = key;
                if (props.groupKey) dataAttrs['data-m-g'] = asArray(props.groupKey).join(' ');
                return A.Div({
                    ...dataAttrs,
                    onMounted: (el) => {
                        const i = engine.instances.get(key);
                        if (!i) return;
                        i.domElement = el;
                        const initialSpec = i.buildFn(truth.get(), { uKey: key });
                        const initialNode = A.toNode(initialSpec);
                        el.replaceChildren(initialNode);
                        postSync(el);
                    },
                    onUnmounted: () => {
                        const i = engine.instances.get(key);
                        if (i) i.domElement = null;
                    }
                }, { default: [] });
            } else {
                return componentFn(A, truth.get(), { ...coreContext, call: enhancedCall, dispatch }, props, slots);
            }
        }

        coreContext.call = enhancedCall;
        coreContext.dispatch = dispatch;

        const messenger = createMessenger(truth, { ...coreContext, call: enhancedCall, dispatch });

        let detachDelegation = null;
        if (opts.mount) {
            const mountEl = typeof opts.mount === 'string' ? document.querySelector(opts.mount) : opts.mount;
            if (mountEl) {
                if (opts.rootComponent) {
                    const rootSpec = enhancedCall(opts.rootComponent, { uniqueKey: 'app-root' });
                    const rootNode = A.toNode(rootSpec);
                    if (rootNode) mountEl.appendChild(rootNode);
                }
                const delegator = createAttrDelegator(window.Mishkah.utils);
                detachDelegation = delegator(mountEl, dispatch);
            }
        }

        truth.subscribe(({ state, dirty }) => engine.commit(state, dirty));
        env.subscribe(() => truth.rebuildAll());

        const finalAppObject = {
            truth,
            engine,
            env,
            i18n: env.i18n,
            lifecycle: { on: life.on, off: life.off, emit: life.emit },
            devtools: {
                getSnapshot: auditor.getSnapshot,
                printSummary: () => {
                    const s = auditor.getSnapshot();
                    const rows = Object.entries(s.instances).map(([k,v])=>({ key:k, commits:v.commits, avgMs:+(v.avgMs||0).toFixed(2), lastMs:+(v.lastMs||0).toFixed(2), slow:v.slowCount, errors:v.errors, viol:v.violations }));
                    console.table(rows);
                }
            },
            destroy: () => {
                if(detachDelegation) detachDelegation();
                Array.from(engine.instances.keys()).forEach(key => engine.unregisterInstance(key));
                const mountEl = typeof opts.mount === 'string' ? document.querySelector(opts.mount) : opts.mount;
                if(mountEl) mountEl.innerHTML = '';
            },
            messenger,
            call: enhancedCall,
            dispatch,
			    helpers: opts.helpers || {}

        };
Object.defineProperty(finalAppObject, 'helpers', {
  get(){ return helpersRef },
  set(v){ helpersRef = v || {}; coreContext.helpers = helpersRef; },
  enumerable: true
});

        return finalAppObject;
    }

    window.Mishkah = window.Mishkah || {};
    window.Mishkah.Core = { createApp, createTruth, createGuardian, createAuditor, createEnv, addPerformancePolicy, createMessenger };
})(window);
