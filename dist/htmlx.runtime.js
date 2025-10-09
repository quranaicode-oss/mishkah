(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(function () {
      return factory(root);
    });
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(root);
  } else {
    factory(root);
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

  function ensureMishkah() {
    var host = global || {};
    host.Mishkah = host.Mishkah || {};
    host.Mishkah.app = host.Mishkah.app || {};
    return host.Mishkah;
  }

  var M = ensureMishkah();

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
      var list = node.map(function (child) { return compileNode(evalExpr, child); });
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

  function ensureHtmlx() {
    var mishkah = ensureMishkah();
    if (!mishkah.HTMLx || typeof mishkah.HTMLx.compileAllTemplates !== 'function') {
      throw new Error('Mishkah HTMLx runtime is missing. تأكد من تحميل dist/htmlx.bundle.js.');
    }
    return mishkah.HTMLx;
  }

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

  function make(db, options) {
    if (!db || typeof db !== 'object') {
      throw new Error('Mishkah.app.make يتطلب كائن قاعدة بيانات صالح.');
    }
    var M = ensureMishkah();
    if (!M.app || typeof M.app.createApp !== 'function' || typeof M.app.setBody !== 'function') {
      throw new Error('Mishkah core is not available.');
    }
    var htmlx = ensureHtmlx();
    var root = (options && options.root) || global.document || null;
    if (!root || !root.querySelectorAll) {
      throw new Error('HTML document context is required to compile templates.');
    }

    var compiled = htmlx.compileAllTemplates(root, options && options.compileOptions);
    var renderers = compiled.map(createRenderer);

    var aggregatedOrders = mergeOrders(compiled.map(function (entry) { return entry.orders; }));

    db.head = db.head || {};
    db.head.styles = mergeStyles(db.head.styles, compiled);

    var app = M.app.createApp(db, aggregatedOrders);
    var envOrders = {};
    var shouldInitEnv = !(db && db.env && db.env.twcss === false);
    if (shouldInitEnv && M.utils && M.utils.twcss && typeof M.utils.twcss.auto === 'function') {
      envOrders = M.utils.twcss.auto(db, app, { pageScaffold: true }) || {};
    }

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

    var mergedOrders = mergeOrders([aggregatedOrders, envOrders.orders]);
    app.setOrders(mergedOrders);

    var mountTarget = (options && options.mount) || '#app';
    app.mount(mountTarget);

    return { app: app, compiled: compiled, renderers: renderers };
  }

  var runtime = {
    make: make,
    compileRenderers: function (options) {
      var htmlx = ensureHtmlx();
      var root = (options && options.root) || global.document || null;
      if (!root || !root.querySelectorAll) {
        throw new Error('HTML document context is required to compile templates.');
      }
      var compiled = htmlx.compileAllTemplates(root, options && options.compileOptions);
      return compiled.map(createRenderer);
    },
    wrapForMount: wrapForMount,
    compactChildren: compactChildren
  };

  M.HTMLxRuntime = runtime;
  if (!M.app.make) {
    M.app.make = function (db, options) {
      return runtime.make(db, options).app;
    };
  } else {
    M.app.make = make;
  }

  return runtime;
});
