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
})(
  typeof window !== 'undefined'
    ? window
    : typeof globalThis !== 'undefined'
    ? globalThis
    : typeof global !== 'undefined'
    ? global
    : this,
  function (global) {
    'use strict';

    var FNV_PRIME = 16777619;
    var OFFSET_BASIS = 2166136261;

    function stableHash(input) {
      var source = String(input == null ? '' : input);
      var hash = OFFSET_BASIS;
      for (var i = 0; i < source.length; i += 1) {
        hash ^= source.charCodeAt(i) & 255;
        hash = Math.imul(hash, FNV_PRIME);
        hash >>>= 0;
      }
      return hash.toString(16).padStart(8, '0');
    }

    function ensureMishkah() {
      var host = global || {};
      if (!host.Mishkah) host.Mishkah = {};
      host.Mishkah.app = host.Mishkah.app || {};
      host.Mishkah.utils = host.Mishkah.utils || {};
      host.Mishkah.UI = host.Mishkah.UI || {};
      host.Mishkah.DSL = host.Mishkah.DSL || {};
      return host.Mishkah;
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
      var locals = Object.assign({}, scope.locals || {}, additions || {});
      return {
        state: scope.state,
        db: scope.db,
        ctx: scope.ctx,
        M: scope.M,
        UI: scope.UI,
        D: scope.D,
        locals: locals
      };
    }

    function normalizeIterable(collection) {
      if (!collection) return [];
      if (Array.isArray(collection)) return collection;
      if (typeof collection === 'number') {
        var length = Math.max(0, collection);
        var values = [];
        for (var i = 0; i < length; i += 1) values.push(i);
        return values;
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
      if (!node) {
        return function () {
          return null;
        };
      }
      if (node.kind === 'text') {
        var textValue = node.value;
        return function () {
          return textValue;
        };
      }
      if (node.kind === 'expr') {
        var code = node.code;
        return function (scope) {
          return evalExpr(code, scope);
        };
      }
      if (node.kind === 'if') {
        var testFn = evalExpr.bind(null, node.test);
        var thenFn = node.consequent ? compileNode(evalExpr, node.consequent) : function () { return null; };
        var elseFn = node.alternate ? compileNode(evalExpr, node.alternate) : function () { return null; };
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
        var childFns = node.children.map(function (child) { return compileNode(evalExpr, child); });
        var family = node.nodeType === 'atom' && node.atom ? node.atom.family : null;
        var atomName = node.nodeType === 'atom' && node.atom ? node.atom.name : null;
        var componentName = node.nodeType === 'component' ? node.componentRef : null;
        var key = node.key;
        var tagName = node.tagName;

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

    function createRenderer(result) {
      var treeFactory = typeof result.component === 'function' ? result.component : function () { return result.component; };
      var tree = treeFactory();
      var evalExpr = createExpressionEvaluator();
      var renderNode = compileNode(evalExpr, tree);
      return {
        namespace: result.namespace,
        mount: result.mount,
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

    function mergeOrders(sources) {
      var merged = {};
      for (var i = 0; i < sources.length; i += 1) {
        var orders = sources[i] || {};
        for (var key in orders) {
          if (!Object.prototype.hasOwnProperty.call(orders, key)) continue;
          merged[key] = orders[key];
        }
      }
      return merged;
    }

    function mergeStyles(base, compiled) {
      var accumulator = Array.isArray(base) ? base.slice() : [];
      var seen = {};
      for (var i = 0; i < accumulator.length; i += 1) {
        if (accumulator[i] && accumulator[i].id) {
          seen[accumulator[i].id] = true;
        }
      }
      for (var j = 0; j < compiled.length; j += 1) {
        var styles = (((compiled[j] || {}).databasePatch || {}).head || {}).styles || [];
        for (var s = 0; s < styles.length; s += 1) {
          var entry = styles[s];
          if (!entry) continue;
          var id = entry.id;
          if (id && seen[id]) continue;
          if (id) seen[id] = true;
          accumulator.push(entry);
        }
      }
      return accumulator;
    }

    function getByPath(state, path) {
      if (!path) return state;
      var segments = String(path).split('.');
      var cursor = state;
      for (var i = 0; i < segments.length; i += 1) {
        if (cursor == null) return undefined;
        cursor = cursor[segments[i]];
      }
      return cursor;
    }

    function cloneBranch(value) {
      if (Array.isArray(value)) return value.slice();
      if (value && typeof value === 'object') return Object.assign({}, value);
      return {};
    }

    function setByPathImmutable(state, path, value) {
      var base = state == null ? {} : state;
      var segments = String(path).split('.');
      if (!segments.length) return value;
      var root = cloneBranch(base);
      var cursor = root;
      for (var i = 0; i < segments.length - 1; i += 1) {
        var key = segments[i];
        var next = cursor[key];
        cursor[key] = cloneBranch(next);
        cursor = cursor[key];
      }
      cursor[segments[segments.length - 1]] = value;
      return root;
    }

    function createContextBridge(context, M) {
      var base = context || {};
      var evaluator = createExpressionEvaluator();
      var bridge = Object.create(base);

      bridge.getState = function () {
        if (base && typeof base.getState === 'function') {
          return base.getState();
        }
        return base.state || {};
      };

      bridge.setState = function (updater) {
        if (!base || typeof base.setState !== 'function') return;
        if (typeof updater === 'function') {
          base.setState(updater);
        } else {
          base.setState(function () {
            return updater;
          });
        }
      };

      bridge.get = function (path) {
        return getByPath(bridge.getState(), path);
      };

      bridge.set = function (path, value) {
        var current = bridge.getState();
        var next = setByPathImmutable(current, path, value);
        bridge.setState(function () {
          return next;
        });
      };

      bridge.evaluate = function (code, locals) {
        var state = bridge.getState();
        return evaluator(code, {
          state: state,
          db: state,
          ctx: bridge,
          M: M,
          UI: M.UI || {},
          D: M.DSL || {},
          locals: locals || {}
        });
      };

      bridge.flush = base && typeof base.flush === 'function' ? base.flush.bind(base) : function () {};
      bridge.rebuild = base && typeof base.rebuild === 'function' ? base.rebuild.bind(base) : function () {};
      bridge.batch = base && typeof base.batch === 'function' ? base.batch.bind(base) : function (fn) {
        if (typeof fn === 'function') fn();
      };

      return bridge;
    }

    function wrapOrderHandlers(orders, M) {
      var wrapped = {};
      for (var key in orders) {
        if (!Object.prototype.hasOwnProperty.call(orders, key)) continue;
        (function (k) {
          var order = orders[k];
          var handler = typeof order.handler === 'function' ? order.handler : function () {};
          wrapped[k] = {
            on: Array.isArray(order.on) ? order.on.slice() : [],
            gkeys: Array.isArray(order.gkeys) ? order.gkeys.slice() : [],
            handler: function (event, ctx) {
              var base = ctx || {};
              var bridge = createContextBridge(base, M);
              return handler(event, bridge);
            }
          };
        })(key);
      }
      return wrapped;
    }

    function deriveNamespace(template) {
      if (!template) return 'ns-' + stableHash(String(Math.random()));
      var dataset = template.dataset || {};
      if (dataset.namespace) return dataset.namespace;
      if (template.id) return template.id;
      var html = template.innerHTML || template.textContent || '';
      return 'ns-' + stableHash(html);
    }

    function ensureMount(template, namespace, registry) {
      var dataset = template.dataset || {};
      var mount = dataset.mount || template.getAttribute('data-mount');
      var doc = template.ownerDocument || global.document;
      registry = registry || { claimedApp: false, created: [] };

      if (mount) {
        return mount;
      }

      var appEl = doc ? doc.getElementById('app') : null;
      if (appEl && !registry.claimedApp) {
        registry.claimedApp = true;
        return '#app';
      }

      var containerId = 'm-' + namespace;
      var container = doc ? doc.getElementById(containerId) : null;
      if (!container && doc) {
        container = doc.createElement('div');
        container.id = containerId;
        if (template.parentNode) {
          template.parentNode.insertBefore(container, template.nextSibling);
        } else {
          doc.body.appendChild(container);
        }
        registry.created.push(container);
      }
      return '#' + containerId;
    }

    function prepareTemplates(root) {
      var list = [];
      if (!root || !root.querySelectorAll) return list;
      var registry = { claimedApp: false, created: [] };
      var templates = Array.from(root.querySelectorAll('template'));
      for (var i = 0; i < templates.length; i += 1) {
        var tpl = templates[i];
        var namespace = deriveNamespace(tpl);
        var mount = ensureMount(tpl, namespace, registry);
        tpl.dataset.namespace = namespace;
        tpl.setAttribute('data-namespace', namespace);
        tpl.dataset.mount = mount;
        tpl.setAttribute('data-mount', mount);
        list.push({ element: tpl, namespace: namespace, mount: mount });
      }
      return list;
    }

    function compileTemplates(items, options) {
      var M = ensureMishkah();
      if (!M.HTMLx || typeof M.HTMLx.compileTemplateElement !== 'function') {
        throw new Error('Mishkah HTMLx compiler is missing. تأكد من تحميل dist/htmlx.umd.js.');
      }
      var results = [];
      for (var i = 0; i < items.length; i += 1) {
        var item = items[i];
        var result = M.HTMLx.compileTemplateElement(item.element, {
          namespace: item.namespace,
          mount: item.mount,
          hash: stableHash,
          atoms: options && options.atoms,
          components: options && options.components
        });
        results.push(result);
      }
      return results;
    }

    function cleanupTemplates(items) {
      for (var i = 0; i < items.length; i += 1) {
        var tpl = items[i].element;
        if (tpl && tpl.parentNode) {
          tpl.parentNode.removeChild(tpl);
        }
      }
    }

    function createRenderScope(state, ctxBridge, M) {
      return {
        state: state,
        db: state,
        ctx: ctxBridge,
        M: M,
        UI: M.UI || {},
        D: M.DSL || {},
        locals: {}
      };
    }

    function makeBodyRenderer(renderers, app, M) {
      return function (state, D) {
        var ctxBridge = createContextBridge(app, M);
        var scope = createRenderScope(state, ctxBridge, M);
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
      };
    }

    async function boot(database, options) {
      if (!database || typeof database !== 'object') {
        throw new Error('Mishkah.app.make يتطلب كائن قاعدة بيانات صالح.');
      }

      var M = ensureMishkah();
      if (!M.app || typeof M.app.createApp !== 'function' || typeof M.app.setBody !== 'function') {
        throw new Error('Mishkah core is not available.');
      }

      var root = (options && options.root) || global.document || null;
      if (!root || !root.querySelectorAll) {
        throw new Error('HTML document context is required to compile templates.');
      }

      var prepared = prepareTemplates(root);
      var compiled = compileTemplates(prepared, options && options.compileOptions);
      var renderers = compiled.map(createRenderer);

      database.head = database.head || {};
      database.head.styles = mergeStyles(database.head.styles, compiled);

      var app = M.app.createApp(database, {});

      var shouldInitEnv = !(database && database.env && database.env.twcss === false);
      var U = M.utils || {};
      var twcss = (U && U.twcss) || (M.utils && M.utils.twcss) || null;
      var twx = null;
      if (shouldInitEnv && twcss && typeof twcss.auto === 'function') {
        try {
          twx = await Promise.resolve(twcss.auto(database, app, { pageScaffold: true }));
        } catch (error) {
          console.warn('twcss.auto فشل:', error);
          twx = null;
        }
      }

      var htmlxOrders = mergeOrders(compiled.map(function (entry) { return wrapOrderHandlers(entry.orders || {}, M); }));
      var envOrders = twx && twx.orders ? twx.orders : {};
      var uiOrders = (M.UI && M.UI.orders) || {};
      var combinedOrders = mergeOrders([uiOrders, envOrders, htmlxOrders]);
      app.setOrders(combinedOrders);

      M.app.setBody(makeBodyRenderer(renderers, app, M));

      var mountTarget = (options && options.mount) || '#app';
      app.mount(mountTarget);

      cleanupTemplates(prepared);

      return app;
    }

    var agent = {
      version: '1.0.0',
      stableHash: stableHash,
      prepareTemplates: prepareTemplates,
      compileTemplates: compileTemplates,
      boot: boot
    };

    var M = ensureMishkah();
    M.HTMLxAgent = agent;
    M.app.make = function (db, options) {
      return boot(db, options || {});
    };

    return agent;
  }
);
