(function (global, factory) {
  if (typeof define === 'function' && define.amd) {
    define(function () {
      return factory(global);
    });
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(global);
  } else {
    factory(global);
  }
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : typeof global !== 'undefined' ? global : this, function (global) {
  'use strict';

  var FNV_PRIME = 16777619;
  var OFFSET_BASIS = 2166136261;

  function stableHash(input) {
    var str = String(input == null ? '' : input);
    var hash = OFFSET_BASIS;
    for (var i = 0; i < str.length; i += 1) {
      hash ^= str.charCodeAt(i) & 255;
      hash = Math.imul(hash, FNV_PRIME);
      hash >>>= 0;
    }
    return hash.toString(16).padStart(8, '0');
  }

  function ensureMishkah() {
    var host = global || {};
    host.Mishkah = host.Mishkah || {};
    return host.Mishkah;
  }

  function ensureHtmlx() {
    var M = ensureMishkah();
    if (!M.HTMLx || typeof M.HTMLx.compileAllTemplates !== 'function') {
      throw new Error('Mishkah HTMLx runtime is missing. تأكد من تحميل dist/htmlx.umd.js.');
    }
    return M.HTMLx;
  }

  function ContextAdapter(context) {
    return {
      get: function (path) {
        var state = (context && typeof context.getState === 'function' ? context.getState() : {}) || {};
        if (!path) return state;
        var segments = String(path).split('.');
        var ptr = state;
        for (var i = 0; i < segments.length; i += 1) {
          if (ptr == null) return undefined;
          ptr = ptr[segments[i]];
        }
        return ptr;
      },
      set: function (path, value) {
        if (!context || typeof context.setState !== 'function') return;
        context.setState(function (prev) {
          var root = Object.assign({}, prev || {});
          var segments = String(path).split('.');
          if (!segments.length) return root;
          var cursor = root;
          for (var i = 0; i < segments.length - 1; i += 1) {
            var key = segments[i];
            var nextVal = cursor[key];
            if (Array.isArray(nextVal)) {
              cursor[key] = nextVal.slice();
            } else if (nextVal && typeof nextVal === 'object') {
              cursor[key] = Object.assign({}, nextVal);
            } else {
              cursor[key] = {};
            }
            cursor = cursor[key];
          }
          cursor[segments[segments.length - 1]] = value;
          return root;
        });
      },
      rebuild: function () {
        if (context && typeof context.rebuild === 'function') {
          context.rebuild();
        }
      }
    };
  }

  function decodeEntities(input) {
    if (typeof input !== 'string' || !input) return input;
    return input
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }

  function extendScope(scope, additions) {
    var nextLocals = Object.assign({}, scope.locals || {}, additions || {});
    return {
      state: scope.state,
      db: scope.db,
      ctx: scope.ctx,
      M: scope.M,
      UI: scope.UI,
      D: scope.D,
      locals: nextLocals
    };
  }

  function normalizeIterable(collection) {
    if (!collection) return [];
    if (Array.isArray(collection)) return collection;
    if (typeof collection === 'number') {
      var length = Math.max(0, collection);
      var range = [];
      for (var i = 0; i < length; i += 1) range.push(i);
      return range;
    }
    if (typeof collection === 'object') return Object.values(collection);
    return [];
  }

  function compactChildren(children) {
    var flat = [];
    for (var i = 0; i < children.length; i += 1) {
      var value = children[i];
      if (value == null || value === false) continue;
      if (Array.isArray(value)) {
        for (var j = 0; j < value.length; j += 1) {
          if (value[j] != null && value[j] !== false) flat.push(value[j]);
        }
      } else {
        flat.push(value);
      }
    }
    return flat;
  }

  function adaptAttrs(raw, key) {
    var attrs = {};
    if (raw) {
      for (var name in raw) {
        if (!Object.prototype.hasOwnProperty.call(raw, name)) continue;
        var value = raw[name];
        if (value == null || value === false) continue;
        if (name === 'data-m-gkey') {
          attrs.gkey = value;
        } else {
          attrs[name] = value;
        }
      }
    }
    if (key) attrs.key = key;
    return attrs;
  }

  function createExpressionEvaluator() {
    var cache = {};
    return function evaluate(code, scope) {
      var source = decodeEntities(String(code));
      if (!cache[source]) {
        cache[source] = new Function(
          'state',
          'ctx',
          'db',
          'M',
          'UI',
          'D',
          'locals',
          '__code',
          'with (locals || Object.create(null)) { return eval(__code); }'
        );
      }
      try {
        return cache[source](
          scope.state,
          scope.ctx,
          scope.db,
          scope.M,
          scope.UI,
          scope.D,
          scope.locals,
          source
        );
      } catch (error) {
        console.error('HTMLx expression failed:', source, error);
        return undefined;
      }
    };
  }

  function compileAttrValue(evalExpr, value) {
    if (typeof value === 'string') {
      var literal = value;
      return function () {
        return literal;
      };
    }
    if (Array.isArray(value)) {
      var parts = value.map(function (chunk) {
        if (chunk.type === 'text') {
          var text = chunk.value;
          return function () {
            return text;
          };
        }
        var code = chunk.code;
        return function (scope) {
          return evalExpr(code, scope);
        };
      });
      return function (scope) {
        var buffer = '';
        for (var i = 0; i < parts.length; i += 1) {
          var piece = parts[i](scope);
          if (piece == null) continue;
          buffer += piece;
        }
        return buffer;
      };
    }
    return function () {
      return value;
    };
  }

  function compileNode(evalExpr, node) {
    if (node == null) {
      return function () {
        return null;
      };
    }
    if (typeof node === 'string') {
      var str = node;
      return function () {
        return str;
      };
    }
    if (Array.isArray(node)) {
      var list = node.map(function (child) {
        return compileNode(evalExpr, child);
      });
      return function (scope) {
        var out = [];
        for (var i = 0; i < list.length; i += 1) {
          out.push(list[i](scope));
        }
        return compactChildren(out);
      };
    }
    if (node.expr) {
      var exprCode = node.expr;
      return function (scope) {
        var evaluated = evalExpr(exprCode, scope);
        if (evaluated == null) return '';
        return evaluated;
      };
    }
    if (node.kind === 'text') {
      var textValue = node.value;
      return function () {
        return textValue;
      };
    }
    if (node.kind === 'if') {
      var testFn = evalExpr.bind(null, node.test);
      var thenFn = node.consequent ? compileNode(evalExpr, node.consequent) : function () {
        return null;
      };
      var elseFn = node.alternate ? compileNode(evalExpr, node.alternate) : function () {
        return null;
      };
      return function (scope) {
        return testFn(scope) ? thenFn(scope) : elseFn(scope);
      };
    }
    if (node.kind === 'for') {
      var collectionFn = evalExpr.bind(null, node.collection);
      var bodyFn = compileNode(evalExpr, node.body);
      return function (scope) {
        var collection = normalizeIterable(collectionFn(scope));
        var rendered = [];
        for (var i = 0; i < collection.length; i += 1) {
          var locals = {};
          locals[node.item] = collection[i];
          if (node.index) locals[node.index] = i;
          rendered.push(bodyFn(extendScope(scope, locals)));
        }
        return compactChildren(rendered);
      };
    }
    if (node.kind === 'element') {
      var attrEntries = [];
      for (var name in node.attrs) {
        if (!Object.prototype.hasOwnProperty.call(node.attrs, name)) continue;
        attrEntries.push({ name: name, fn: compileAttrValue(evalExpr, node.attrs[name]) });
      }
      var childFns = node.children.map(function (child) {
        return compileNode(evalExpr, child);
      });
      var family = node.nodeType === 'atom' && node.atom ? node.atom.family : null;
      var atomName = node.nodeType === 'atom' && node.atom ? node.atom.name : null;
      var componentName = node.nodeType === 'component' ? node.componentRef : null;
      var key = node.key;
      var tagName = node.tag;
      return function (scope) {
        var computedAttrs = {};
        for (var i = 0; i < attrEntries.length; i += 1) {
          var entry = attrEntries[i];
          computedAttrs[entry.name] = entry.fn(scope);
        }
        var children = [];
        for (var j = 0; j < childFns.length; j += 1) {
          children.push(childFns[j](scope));
        }
        var normalizedChildren = compactChildren(children);
        var attrs = adaptAttrs(computedAttrs, key);
        if (family && atomName) {
          var category = scope.D && scope.D[family];
          var atom = category && category[atomName];
          if (!atom) {
            console.warn('Missing Mishkah atom for HTMLx element:', family + '.' + atomName);
            return null;
          }
          return atom({ attrs: attrs }, normalizedChildren);
        }
        if (componentName) {
          var ui = scope.UI || {};
          var component = ui[componentName];
          if (typeof component === 'function') {
            var props = { attrs: attrs, children: normalizedChildren };
            if (normalizedChildren.length === 1) {
              props.content = normalizedChildren[0];
            } else if (normalizedChildren.length > 1) {
              props.content = normalizedChildren;
            }
            return component(props);
          }
          var fallback = scope.D && scope.D.Containers && scope.D.Containers.Div;
          if (fallback) {
            var fallbackAttrs = Object.assign({ 'data-m-component': componentName, 'data-m-origin-tag': tagName }, attrs);
            return fallback({ attrs: fallbackAttrs }, normalizedChildren);
          }
          return null;
        }
        return null;
      };
    }
    return function () {
      return null;
    };
  }

  function createRendererFromTemplate(template) {
    var treeFactory = typeof template.component === 'function' ? template.component : function () {
      return template.component;
    };
    var tree = treeFactory();
    var evalExpr = createExpressionEvaluator();
    var renderNode = compileNode(evalExpr, tree);
    return {
      namespace: template.namespace,
      mount: template.mount,
      render: function (scope) {
        return renderNode(scope);
      }
    };
  }

  function wrapForMount(mount, D, children) {
    if (!children || !children.length) return null;
    if (!mount || mount === '#app') {
      return children.length === 1 ? children[0] : D.Containers.Div({ attrs: { class: 'grid gap-10' } }, children);
    }
    var attrs = {};
    if (mount.charAt(0) === '#') {
      attrs.id = mount.slice(1);
    } else if (mount.charAt(0) === '.') {
      attrs.class = mount.slice(1);
    } else {
      attrs['data-mount'] = mount;
    }
    return D.Containers.Div({ attrs: attrs }, children);
  }

  function mergeStyles(base, compiled) {
    var styleAccumulator = Array.isArray(base) ? base.slice() : [];
    var seen = {};
    for (var i = 0; i < styleAccumulator.length; i += 1) {
      if (styleAccumulator[i] && styleAccumulator[i].id) {
        seen[styleAccumulator[i].id] = true;
      }
    }
    for (var c = 0; c < compiled.length; c += 1) {
      var styles = (((compiled[c] || {}).databasePatch || {}).head || {}).styles || [];
      for (var si = 0; si < styles.length; si += 1) {
        var entry = styles[si];
        if (!entry) continue;
        var id = entry.id;
        if (id && seen[id]) continue;
        if (id) seen[id] = true;
        styleAccumulator.push(entry);
      }
    }
    return styleAccumulator;
  }

  function parseProvidedGkeys(value) {
    if (typeof value === 'string') {
      return value.split(/\s+/).filter(Boolean);
    }
    return [];
  }

  function stringifyHandlerArg(arg) {
    if (!arg) return '';
    switch (arg.kind) {
      case 'event':
        return 'event';
      case 'context':
        return 'ctx';
      case 'number':
        return String(arg.value);
      case 'expr':
        return arg.code;
      case 'literal': {
        var val = arg.value;
        if (typeof val !== 'string') return String(val);
        if (/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/.test(val)) {
          return val;
        }
        return "'" + val.replace(/'/g, "\\'") + "'";
      }
      default:
        return '';
    }
  }

  function buildRawExpression(name, args) {
    if (!args || !args.length) return name;
    return name + '(' + args.join(', ') + ')';
  }

  function extractActionName(name) {
    if (!name) return '';
    var parts = String(name).split('.');
    return parts[parts.length - 1] || '';
  }

  function reserveOrderKey(registry, namespace, actionName, seed) {
    var ns = namespace || 'auto';
    var used = registry[ns] || (registry[ns] = {});
    if (actionName) {
      if (!used[actionName]) {
        used[actionName] = true;
        return ns + ':' + actionName;
      }
    }
    return 'auto:' + stableHash(seed || ns + '|' + actionName);
  }

  function transformTree(node, irNode, eventsByPath) {
    if (!irNode) return node;
    if (irNode.kind === 'element') {
      if (!node || typeof node !== 'object') return node;
      var clone = Array.isArray(node) ? node.slice() : Object.assign({}, node);
      var attrs = Object.assign({}, clone.attrs || {});
      attrs['data-m-key'] = irNode.key;
      var eventInfos = eventsByPath[irNode.path] || [];
      if (eventInfos.length) {
        attrs['data-m-gkey'] = eventInfos.map(function (ev) {
          return ev.gkey;
        }).join(' ');
      }
      clone.attrs = attrs;
      if (clone.children && irNode.children) {
        var nextChildren = [];
        for (var i = 0; i < clone.children.length; i += 1) {
          var nextIr = irNode.children[i] || null;
          nextChildren.push(transformTree(clone.children[i], nextIr, eventsByPath));
        }
        clone.children = nextChildren;
      }
      return clone;
    }
    if (irNode.kind === 'if') {
      var ifClone = Object.assign({}, node || irNode);
      ifClone.consequent = irNode.consequent ? transformTree(ifClone.consequent, irNode.consequent, eventsByPath) : null;
      ifClone.alternate = irNode.alternate ? transformTree(ifClone.alternate, irNode.alternate, eventsByPath) : null;
      return ifClone;
    }
    if (irNode.kind === 'for') {
      var forClone = Object.assign({}, node || irNode);
      forClone.body = irNode.body ? transformTree(forClone.body, irNode.body, eventsByPath) : null;
      return forClone;
    }
    return node;
  }

  function collectEvents(irNode, ctx, out, eventsByPath) {
    if (!irNode) return;
    if (irNode.kind === 'element') {
      var providedGkeys = parseProvidedGkeys(irNode.attrs && irNode.attrs['data-m-gkey']);
      for (var i = 0; i < irNode.events.length; i += 1) {
        var event = irNode.events[i];
        var argsList = event.handler.args.map(stringifyHandlerArg);
        var rawExpr = buildRawExpression(event.handler.name, argsList);
        var actionName = extractActionName(event.handler.name);
        var seed = ctx.namespace + '|' + irNode.path + '|' + event.type + '|' + rawExpr;
        var orderKey = providedGkeys[i] || reserveOrderKey(ctx.registry, ctx.namespace, actionName, seed);
        var gkey = orderKey;
        var info = {
          nodePath: irNode.path,
          nodeKey: irNode.key,
          event: event.type,
          rawExpr: rawExpr,
          orderKey: orderKey,
          gkey: gkey,
          args: argsList,
          handlerName: event.handler.name,
          argNodes: event.handler.args,
          oldGkey: event.gkey,
          sourceOrder: ctx.sourceOrders ? ctx.sourceOrders[event.gkey] : null
        };
        if (!eventsByPath[irNode.path]) eventsByPath[irNode.path] = [];
        eventsByPath[irNode.path].push(info);
        out.push(info);
      }
      for (var j = 0; j < irNode.children.length; j += 1) {
        collectEvents(irNode.children[j], ctx, out, eventsByPath);
      }
      return;
    }
    if (irNode.kind === 'if') {
      if (irNode.consequent) collectEvents(irNode.consequent, ctx, out, eventsByPath);
      if (irNode.alternate) collectEvents(irNode.alternate, ctx, out, eventsByPath);
      return;
    }
    if (irNode.kind === 'for') {
      if (irNode.body) collectEvents(irNode.body, ctx, out, eventsByPath);
    }
  }

  function buildCompileResult(compiled) {
    var templates = [];
    var registry = {};
    for (var i = 0; i < compiled.length; i += 1) {
      var entry = compiled[i] || {};
      var namespace = entry.namespace || 'auto';
      var mount = entry.mount || '#app';
      var irRoot = entry.meta && entry.meta.ir;
      var sourceOrders = entry.orders || {};
      var events = [];
      var eventsByPath = {};
      collectEvents(
        irRoot,
        { namespace: namespace, registry: registry, sourceOrders: sourceOrders },
        events,
        eventsByPath
      );
      var factory = (function (component, ir, pathMap) {
        return function () {
          var baseTree = typeof component === 'function' ? component() : component;
          return transformTree(baseTree, ir, pathMap);
        };
      })(entry.component, irRoot, eventsByPath);
      templates.push({
        namespace: namespace,
        mount: mount,
        component: factory,
        events: events,
        original: entry
      });
    }
    return { templates: templates, original: compiled };
  }

  function resolveUserFunction(name) {
    if (!name) return null;
    var host = global || {};
    var target = host;
    var segments = String(name).split('.');
    for (var i = 0; i < segments.length; i += 1) {
      if (target == null) return null;
      target = target[segments[i]];
    }
    return typeof target === 'function' ? target : null;
  }

  function evaluateArgNode(argNode, event, ctx) {
    if (!argNode) return undefined;
    switch (argNode.kind) {
      case 'event':
        return event;
      case 'context':
        return ctx;
      case 'number':
        return argNode.value;
      case 'expr':
        try {
          var fn = new Function('event', 'ctx', 'state', 'with (state || {}) { return ' + argNode.code + '; }');
          return fn(event, ctx, ctx && typeof ctx.get === 'function' ? ctx.get() : {});
        } catch (_err) {
          return undefined;
        }
      case 'literal':
        return argNode.value;
      default:
        return undefined;
    }
  }

  function createOrderHandler(eventInfo, ContextAdapterImpl) {
    var base = eventInfo && eventInfo.sourceOrder;
    if (base && typeof base.handler === 'function') {
      var wrappedBase = base.handler;
      return function (event, context) {
        if (event && typeof event.preventDefault === 'function' && event.type === 'submit') {
          event.preventDefault();
        }
        var adapted = ContextAdapterImpl ? ContextAdapterImpl(context) : context;
        var result;
        try {
          result = wrappedBase(event, adapted);
        } catch (error) {
          console.error('[Mishkah.HTMLxAgent] Order handler failed:', eventInfo.orderKey, error);
          result = undefined;
        }
        var finalize = function () {
          if (context && typeof context.rebuild === 'function') {
            context.rebuild();
          }
        };
        if (result && typeof result.then === 'function') {
          return result.then(finalize, function (err) {
            console.error('[Mishkah.HTMLxAgent] Async handler rejected:', eventInfo.orderKey, err);
            finalize();
          });
        }
        finalize();
        return result;
      };
    }
    return function (event, context) {
      if (event && typeof event.preventDefault === 'function' && event.type === 'submit') {
        event.preventDefault();
      }
      var adapted = ContextAdapterImpl ? ContextAdapterImpl(context) : context;
      var fn = resolveUserFunction(eventInfo && eventInfo.handlerName);
      if (fn) {
        var args = (eventInfo.argNodes || []).map(function (node) {
          return evaluateArgNode(node, event, adapted);
        });
        try {
          var result = fn.apply(global, args);
          if (result && typeof result.then === 'function') {
            return result.finally(function () {
              if (context && typeof context.rebuild === 'function') context.rebuild();
            });
          }
        } catch (error) {
          console.error('[Mishkah.HTMLxAgent] Failed to invoke handler', eventInfo.handlerName, error);
        }
      } else {
        console.warn('[Mishkah.HTMLxAgent] Missing handler for expression:', eventInfo && eventInfo.rawExpr);
      }
      if (context && typeof context.rebuild === 'function') context.rebuild();
      return undefined;
    };
  }

  var OrdersSynthesizer = {
    fromCompiled: function (result, deps) {
      var orders = {};
      if (!result || !Array.isArray(result.templates)) {
        return orders;
      }
      for (var i = 0; i < result.templates.length; i += 1) {
        var tpl = result.templates[i];
        var events = tpl.events || [];
        for (var j = 0; j < events.length; j += 1) {
          var ev = events[j];
          var key = ev.orderKey;
          if (!orders[key]) {
            orders[key] = {
              on: [],
              gkeys: [],
              handler: createOrderHandler(ev, deps && deps.ContextAdapter)
            };
          }
          var orderEntry = orders[key];
          if (orderEntry.on.indexOf(ev.event) === -1) orderEntry.on.push(ev.event);
          if (orderEntry.gkeys.indexOf(ev.gkey) === -1) orderEntry.gkeys.push(ev.gkey);
        }
      }
      return orders;
    }
  };

  function createScope(state, M) {
    return {
      state: state,
      db: state,
      ctx: null,
      M: M,
      UI: M.UI || {},
      D: M.DSL || {},
      locals: {}
    };
  }

  function removeTemplates() {
    if (!global || !global.document) return;
    var list = global.document.querySelectorAll('template[data-namespace], template[id]');
    for (var i = 0; i < list.length; i += 1) {
      var node = list[i];
      if (node && node.parentNode) {
        node.parentNode.removeChild(node);
      }
    }
  }

  async function boot(database, options) {
    if (!database || typeof database !== 'object') {
      throw new Error('Mishkah.HTMLxAgent.boot يتطلب كائن قاعدة بيانات صالح.');
    }
    var M = ensureMishkah();
    if (!M.app || typeof M.app.createApp !== 'function' || typeof M.app.setBody !== 'function') {
      throw new Error('Mishkah core is not available.');
    }
    var app = M.app.createApp(database, {});
    var twcss = (global.U && global.U.twcss) || (M.utils && M.utils.twcss);
    var shouldInitEnv = !(database && database.env && database.env.twcss === false);
    var twx = null;
    if (shouldInitEnv && twcss && typeof twcss.auto === 'function') {
      twx = await twcss.auto(database, app, { pageScaffold: true });
    }
    var htmlx = ensureHtmlx();
    var root = (options && options.root) || (global && global.document);
    if (!root || !root.querySelectorAll) {
      throw new Error('HTML document context is required to compile templates.');
    }
    var compiled = htmlx.compileAllTemplates(root, options && options.compileOptions);
    var prepared = buildCompileResult(compiled);
    var renderers = prepared.templates.map(createRendererFromTemplate);
    database.head = database.head || {};
    database.head.styles = mergeStyles(database.head.styles, compiled);
    M.app.setBody(function (state, D) {
      var scope = createScope(state, M);
      scope.ctx = app;
      var fragments = [];
      for (var i = 0; i < renderers.length; i += 1) {
        var piece = renderers[i].render(scope);
        var children = compactChildren([piece]);
        if (!children.length) continue;
        var wrapped = wrapForMount(renderers[i].mount, D, children);
        if (wrapped == null) continue;
        fragments.push(wrapped);
      }
      if (!fragments.length) {
        return D.Containers.Div({ attrs: { class: 'p-6 text-center text-slate-500' } }, ['HTMLx template لم تُنتج محتوى.']);
      }
      if (fragments.length === 1) return fragments[0];
      return D.Containers.Div({ attrs: { class: 'grid gap-10' } }, fragments);
    });
    var generatedOrders = OrdersSynthesizer.fromCompiled(prepared, { ContextAdapter: ContextAdapter });
    var mergedOrders = Object.assign(
      {},
      (twx && twx.orders) || {},
      (global.UI && global.UI.orders) || (M.UI && M.UI.orders) || {},
      generatedOrders
    );
    app.setOrders(mergedOrders);
    app.mount((options && options.mount) || '#app');
    removeTemplates();
    return {
      app: app,
      orders: mergedOrders,
      compiled: prepared
    };
  }

  var API = {
    boot: boot,
    ContextAdapter: ContextAdapter,
    OrdersSynthesizer: OrdersSynthesizer,
    buildCompileResult: buildCompileResult
  };

  var M = ensureMishkah();
  M.HTMLxAgent = API;
  return API;
});
