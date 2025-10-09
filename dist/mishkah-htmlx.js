(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(function () {
      return factory(root);
    });
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(root);
  } else {
    root.MishkahHTMLx = factory(root);
  }
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this, function (global) {
  'use strict';

  function ensureMishkah() {
    var host = global || {};
    host.Mishkah = host.Mishkah || {};
    host.Mishkah.app = host.Mishkah.app || {};
    host.Mishkah.utils = host.Mishkah.utils || {};
    host.Mishkah.DSL = host.Mishkah.DSL || {};
    host.Mishkah.UI = host.Mishkah.UI || {};
    return host.Mishkah;
  }

  var Mishkah = ensureMishkah();

  function createHash(input) {
    var str = String(input || '');
    var hash = 0;
    for (var i = 0; i < str.length; i += 1) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    var hex = (hash >>> 0).toString(16);
    return hex.length >= 8 ? hex.slice(-8) : ('0000000' + hex).slice(-8);
  }

  function pascalCase(tag) {
    return tag
      .split('-')
      .map(function (segment) {
        if (!segment) return '';
        return segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase();
      })
      .join('');
  }

  var ATOM_FAMILIES = {
    div: ['Containers', 'Div'],
    section: ['Containers', 'Section'],
    article: ['Containers', 'Article'],
    header: ['Containers', 'Header'],
    footer: ['Containers', 'Footer'],
    main: ['Containers', 'Main'],
    nav: ['Containers', 'Nav'],
    aside: ['Containers', 'Aside'],
    span: ['Text', 'Span'],
    p: ['Text', 'P'],
    a: ['Text', 'A'],
    strong: ['Text', 'Strong'],
    em: ['Text', 'Em'],
    h1: ['Text', 'H1'],
    h2: ['Text', 'H2'],
    h3: ['Text', 'H3'],
    h4: ['Text', 'H4'],
    h5: ['Text', 'H5'],
    h6: ['Text', 'H6'],
    ul: ['Lists', 'Ul'],
    ol: ['Lists', 'Ol'],
    li: ['Lists', 'Li'],
    dl: ['Lists', 'Dl'],
    dt: ['Lists', 'Dt'],
    dd: ['Lists', 'Dd'],
    form: ['Forms', 'Form'],
    label: ['Forms', 'Label'],
    button: ['Forms', 'Button'],
    fieldset: ['Forms', 'Fieldset'],
    legend: ['Forms', 'Legend'],
    input: ['Inputs', 'Input'],
    textarea: ['Inputs', 'Textarea'],
    select: ['Inputs', 'Select'],
    option: ['Inputs', 'Option'],
    img: ['Media', 'Img'],
    video: ['Media', 'Video'],
    audio: ['Media', 'Audio'],
    picture: ['Media', 'Picture'],
    table: ['Tables', 'Table'],
    thead: ['Tables', 'Thead'],
    tbody: ['Tables', 'Tbody'],
    tr: ['Tables', 'Tr'],
    th: ['Tables', 'Th'],
    td: ['Tables', 'Td'],
    svg: ['SVG', 'Svg'],
    path: ['SVG', 'Path'],
    circle: ['SVG', 'Circle'],
    rect: ['SVG', 'Rect']
  };

  var EVENT_ATTRIBUTES = ['onclick', 'ondblclick', 'oninput', 'onchange', 'onsubmit', 'onfocus', 'onblur', 'onkeydown', 'onkeyup', 'onkeypress'];

  function ensureArray(value) {
    if (Array.isArray(value)) return value;
    if (value == null) return [];
    return [value];
  }

  function createNodeKey(namespace, path, hint) {
    var ns = namespace ? String(namespace) : 'ns';
    var basis = ns + '|' + String(path || '') + (hint ? '|' + String(hint) : '');
    return createHash(basis);
  }

  function cloneTemplateContent(template) {
    var fragment = template.content ? template.content.cloneNode(true) : null;
    if (!fragment && template.innerHTML) {
      var temp = (template.ownerDocument || document).createElement('div');
      temp.innerHTML = template.innerHTML;
      fragment = document.createDocumentFragment();
      while (temp.firstChild) fragment.appendChild(temp.firstChild);
    }
    return fragment || document.createDocumentFragment();
  }

  function extractTemplateParts(template) {
    var namespace = template.getAttribute('data-namespace') || template.id || 'ns-' + createHash(template.innerHTML || '');
    var mount = template.getAttribute('data-mount') || null;
    var fragment = cloneTemplateContent(template);
    var styles = '';
    var scripts = '';
    var children = [];

    var child = fragment.firstChild;
    while (child) {
      var next = child.nextSibling;
      if (child.nodeType === 1 && child.tagName.toLowerCase() === 'style' && !styles) {
        styles = child.textContent || '';
      } else if (child.nodeType === 1 && child.tagName.toLowerCase() === 'script' && !scripts) {
        scripts = child.textContent || '';
      } else {
        children.push(child);
      }
      child = next;
    }

    var cleanFragment = document.createDocumentFragment();
    for (var i = 0; i < children.length; i += 1) {
      cleanFragment.appendChild(children[i]);
    }

    return {
      namespace: namespace,
      mount: mount,
      fragment: cleanFragment,
      styleSource: styles,
      scriptSource: scripts
    };
  }

  function scopeCss(namespace, css, domSignature) {
    if (!css) return null;
    var scopeId = namespace + '-' + createHash(css + '|' + domSignature);
    var scoped = css
      .replace(/:host\b/g, '[data-m-scope="' + scopeId + '"]')
      .replace(/(^|\}|,)([^@][^{]*?)(?=\{)/g, function (_, prefix, selector) {
        var sel = selector.trim();
        if (!sel || /^@/.test(sel) || sel.startsWith('from') || sel.startsWith('to')) return prefix + selector;
        if (sel.indexOf('[data-m-scope="' + scopeId + '"]') !== -1) return prefix + selector;
        var scopedSelector = sel
          .split(',')
          .map(function (piece) {
            piece = piece.trim();
            if (!piece) return piece;
            if (piece.startsWith('@')) return piece;
            if (piece.startsWith(':root')) return piece;
            return '[data-m-scope="' + scopeId + '"] ' + piece;
          })
          .join(', ');
        return prefix + ' ' + scopedSelector;
      });
    return {
      id: scopeId,
      content: scoped,
      scopeAttr: scopeId
    };
  }

  function createExpressionEvaluator() {
    var cache = Object.create(null);
    return function evaluate(code, scope) {
      var source = String(code || '').trim();
      if (!source) return undefined;
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
          'with (locals || Object.create(null)) { with (state || {}) { return eval(__code); } }'
        );
      }
      try {
        return cache[source](scope.state, scope.ctx, scope.db, scope.M, scope.UI, scope.D, scope.locals, source);
      } catch (error) {
        console.error('HTMLx expression error:', source, error);
        return undefined;
      }
    };
  }

  var evaluateExpression = createExpressionEvaluator();

  function parseMustache(value) {
    var text = String(value || '');
    var parts = [];
    var index = 0;
    while (index < text.length) {
      var open = text.indexOf('{', index);
      if (open === -1) {
        parts.push({ type: 'text', value: text.slice(index) });
        break;
      }
      if (open > index) {
        parts.push({ type: 'text', value: text.slice(index, open) });
      }
      var close = text.indexOf('}', open + 1);
      if (close === -1) {
        parts.push({ type: 'text', value: text.slice(open) });
        break;
      }
      var expr = text.slice(open + 1, close).trim();
      parts.push({ type: 'expr', code: expr });
      index = close + 1;
    }
    return parts;
  }

  function parseEventExpression(raw) {
    if (!raw) return null;
    var trimmed = raw.trim();
    if (!trimmed) return null;
    var nameMatch = trimmed.match(/^[a-zA-Z_$][\w$]*/);
    if (!nameMatch) {
      return {
        handler: null,
        args: [trimmed],
        inline: true,
        source: trimmed
      };
    }
    var handlerName = nameMatch[0];
    var args = [];
    var rest = trimmed.slice(handlerName.length).trim();
    if (rest.startsWith('(') && rest.endsWith(')')) {
      var inner = rest.slice(1, -1);
      if (inner.trim()) {
        args = inner
          .split(',')
          .map(function (part) { return part.trim(); })
          .filter(function (part) { return part.length > 0; });
      }
    }
    return {
      handler: handlerName,
      args: args,
      inline: false,
      source: trimmed
    };
  }

  function parseXFor(value) {
    if (!value) return null;
    var parts = value.split(' in ');
    if (parts.length !== 2) return null;
    var left = parts[0].split(',');
    var item = left[0].trim();
    var index = left[1] ? left[1].trim() : null;
    var expr = parts[1].trim();
    if (!item || !expr) return null;
    return { item: item, index: index, expr: expr };
  }

  function toDatasetName(name) {
    return 'arg' + name.replace(/[^a-zA-Z0-9]+/g, '_');
  }

  function analyzeNode(node, path, namespace, warnings) {
    if (node.nodeType === 3) {
      var content = node.textContent || '';
      var tokens = parseMustache(content);
      if (tokens.length === 1 && tokens[0].type === 'text') {
        return { type: 'text', value: tokens[0].value, path: path };
      }
      return { type: 'dynamic-text', tokens: tokens, path: path };
    }

    if (node.nodeType !== 1) return null;

    var tag = node.tagName.toLowerCase();
    var nextPath = path.length ? path + '.' + tag : tag;

    if (tag === 'template') return null;

    var descriptor;
    if (tag.indexOf('comp-') === 0) {
      descriptor = { type: 'component', component: pascalCase(tag.slice(5)), attrs: {}, events: [], children: [], path: nextPath };
    } else if (ATOM_FAMILIES[tag]) {
      descriptor = { type: 'atom', family: ATOM_FAMILIES[tag][0], atom: ATOM_FAMILIES[tag][1], attrs: {}, events: [], children: [], path: nextPath };
    } else {
      warnings.push('E_ATOM_MISMATCH(' + nextPath + '): عنصر ' + tag + ' غير مصنف. سيتم تجاهله.');
      return null;
    }

    var attrs = node.attributes || [];
    var xIf = null;
    var xFor = null;
    var elseType = null;

    for (var i = 0; i < attrs.length; i += 1) {
      var attr = attrs[i];
      var name = attr.name;
      var value = attr.value;
      if (name === 'x-if') {
        xIf = value;
        continue;
      }
      if (name === 'x-else-if') {
        elseType = 'elseif';
        xIf = value;
        continue;
      }
      if (name === 'x-else') {
        elseType = 'else';
        continue;
      }
      if (name === 'x-for') {
        xFor = parseXFor(value);
        if (!xFor) warnings.push('E_BAD_XFOR(' + nextPath + '): صيغة x-for غير صحيحة.');
        continue;
      }
      if (name.indexOf('x-on:') === 0) {
        descriptor.events.push({ name: name.slice(5), value: value, owner: descriptor });
        continue;
      }
      if (EVENT_ATTRIBUTES.indexOf(name) !== -1) {
        descriptor.events.push({ name: name.slice(2), value: value, owner: descriptor });
        continue;
      }
      if (name.indexOf('data-m-on-') === 0) {
        descriptor.events.push({ name: name.slice(10), value: value, owner: descriptor });
        continue;
      }
      if (name === 'key') {
        descriptor.key = value;
        continue;
      }
      var tokenized = parseMustache(value);
      if (tokenized.length === 1 && tokenized[0].type === 'text') {
        descriptor.attrs[name] = value;
      } else {
        descriptor.attrs[name] = tokenized;
      }
    }

    descriptor.xIf = xIf;
    descriptor.xFor = xFor;
    descriptor.elseType = elseType;

    var childNode = node.firstChild;
    var childIndex = 0;
    while (childNode) {
      var analyzed = analyzeNode(childNode, nextPath + '.' + childIndex, namespace, warnings);
      if (analyzed) descriptor.children.push(analyzed);
      childIndex += 1;
      childNode = childNode.nextSibling;
    }

    if (descriptor.xFor) {
      if (!descriptor.attrs['data-m-key']) {
        if (descriptor.key) {
          descriptor.attrs['data-m-key'] = [{ type: 'expr', code: descriptor.key }];
        } else if (descriptor.xFor.index) {
          descriptor.attrs['data-m-key'] = [{ type: 'expr', code: descriptor.xFor.index }];
        } else {
          var itemName = descriptor.xFor.item || 'item';
          var fallbackExpr = '(' + itemName + ' && (' + itemName + '.id || ' + itemName + '.key || ' + itemName + ')) || __index';
          descriptor.attrs['data-m-key'] = [{ type: 'expr', code: fallbackExpr }];
        }
      }
    } else if (!descriptor.attrs['data-m-key']) {
      descriptor.attrs['data-m-key'] = createNodeKey(namespace, descriptor.path, descriptor.key);
    }

    return descriptor;
  }

  function groupConditionals(children) {
    var grouped = [];
    for (var i = 0; i < children.length; i += 1) {
      var node = children[i];
      if (!node || (node.type !== 'atom' && node.type !== 'component')) {
        grouped.push(node);
        continue;
      }
      if (!node.elseType && !node.xIf) {
        grouped.push(node);
        continue;
      }
      if (node.xIf && !node.elseType) {
        var chain = [{ test: node.xIf, node: node }];
        var j = i + 1;
        while (j < children.length) {
          var sibling = children[j];
          if (!sibling || (sibling.type !== 'atom' && sibling.type !== 'component')) break;
          if (!sibling.elseType) break;
          chain.push({ test: sibling.elseType === 'else' ? null : sibling.xIf, node: sibling });
          i = j;
          j += 1;
          if (sibling.elseType === 'else') break;
        }
        grouped.push({ type: 'if-chain', chain: chain, path: node.path });
      } else if (node.elseType) {
        continue;
      } else {
        grouped.push(node);
      }
    }
    return grouped;
  }

  function compileTextNode(node) {
    if (node.type === 'text') {
      return function () {
        return node.value;
      };
    }
    var parts = node.tokens.map(function (token) {
      if (token.type === 'text') {
        var textValue = token.value;
        return function () {
          return textValue;
        };
      }
      var exprCode = token.code;
      return function (scope) {
        return evaluateExpression(exprCode, scope);
      };
    });
    return function (scope) {
      var buffer = '';
      for (var i = 0; i < parts.length; i += 1) {
        var value = parts[i](scope);
        if (value == null) continue;
        buffer += value;
      }
      return buffer;
    };
  }

  function compileAttrValue(value) {
    if (typeof value === 'string') {
      var literal = value;
      return function () {
        return literal;
      };
    }
    if (Array.isArray(value)) {
      var segments = value.map(function (token) {
        if (token.type === 'text') {
          var text = token.value;
          return function () {
            return text;
          };
        }
        var code = token.code;
        return function (scope) {
          return evaluateExpression(code, scope);
        };
      });
      return function (scope) {
        var joined = '';
        for (var i = 0; i < segments.length; i += 1) {
          var part = segments[i](scope);
          if (part == null) continue;
          joined += part;
        }
        return joined;
      };
    }
    return function () {
      return value;
    };
  }

  function compileAttrs(attrs) {
    var entries = [];
    for (var name in attrs) {
      if (!Object.prototype.hasOwnProperty.call(attrs, name)) continue;
      entries.push({ name: name, fn: compileAttrValue(attrs[name]) });
    }
    return function (scope) {
      var bag = {};
      for (var i = 0; i < entries.length; i += 1) {
        var entry = entries[i];
        var value = entry.fn(scope);
        if (value == null || value === false) continue;
        bag[entry.name] = value;
      }
      return bag;
    };
  }

  function compileChildren(children) {
    var compiled = children.map(function (child) {
      return compileNode(child);
    });
    return function (scope) {
      var rendered = [];
      for (var i = 0; i < compiled.length; i += 1) {
        var out = compiled[i](scope);
        if (Array.isArray(out)) {
          for (var j = 0; j < out.length; j += 1) {
            if (out[j] != null && out[j] !== false) rendered.push(out[j]);
          }
        } else if (out != null && out !== false) {
          rendered.push(out);
        }
      }
      return rendered;
    };
  }

  function createLocalScope(scope, additions) {
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

  function compileNode(node) {
    if (!node) return function () { return null; };
    if (node.type === 'text' || node.type === 'dynamic-text') {
      var textFn = compileTextNode(node);
      return function (scope) {
        return textFn(scope);
      };
    }
    if (node.type === 'if-chain') {
      var compiledChain = node.chain.map(function (entry) {
        return { test: entry.test, render: compileNode(entry.node) };
      });
      return function (scope) {
        for (var i = 0; i < compiledChain.length; i += 1) {
          var branch = compiledChain[i];
          if (branch.test == null || evaluateExpression(branch.test, scope)) {
            return branch.render(scope);
          }
        }
        return null;
      };
    }
    if (node.xFor) {
      var bodyFn = compileNode(Object.assign({}, node, { xFor: null }));
      var loop = node.xFor;
      return function (scope) {
        var list = evaluateExpression(loop.expr, scope);
        if (!list) return null;
        var normalized = Array.isArray(list) ? list : Object.values(list);
        var fragments = [];
        for (var i = 0; i < normalized.length; i += 1) {
          var value = normalized[i];
          var local = {};
          local[loop.item] = value;
          if (loop.index) local[loop.index] = i;
          local.__index = i;
          var scoped = createLocalScope(scope, local);
          fragments.push(bodyFn(scoped));
        }
        return fragments;
      };
    }

    var renderChildren = compileChildren(groupConditionals(node.children));
    var resolveAttrs = compileAttrs(node.attrs);

    return function (scope) {
      var attrs = resolveAttrs(scope) || {};
      var kids = renderChildren(scope);
      if (node.key) attrs.key = node.key;
      if (node.type === 'component') {
        var componentFactory = scope.UI[node.component];
        if (typeof componentFactory !== 'function') {
          console.warn('E_COMPONENT_NOT_FOUND: component', node.component, 'غير متوفر.');
          return null;
        }
        return componentFactory({ attrs: attrs }, kids);
      }
      var family = node.family;
      var atom = node.atom;
      var atoms = scope.D[family] || {};
      var factory = atoms[atom];
      if (typeof factory !== 'function') {
        console.warn('E_ATOM_MISMATCH: atom', family + '.' + atom, 'غير متوفر في DSL.');
        return null;
      }
      return factory({ attrs: attrs }, kids);
    };
  }

  function parseFunctions(source) {
    var map = Object.create(null);
    if (!source) return map;

    var length = source.length;
    var index = 0;

    function isIdentifierPart(ch) {
      return /[\w$]/.test(ch);
    }

    function skipWhitespace(pos) {
      while (pos < length && /\s/.test(source.charAt(pos))) pos += 1;
      return pos;
    }

    function skipLineComment(pos) {
      while (pos < length && source.charAt(pos) !== '\n') pos += 1;
      return pos;
    }

    function skipBlockComment(pos) {
      var next = pos;
      while (next < length - 1) {
        if (source.charAt(next) === '*' && source.charAt(next + 1) === '/') {
          return next + 2;
        }
        next += 1;
      }
      return length;
    }

    function skipString(pos) {
      var quote = source.charAt(pos);
      pos += 1;
      while (pos < length) {
        var ch = source.charAt(pos);
        if (ch === '\\') {
          pos += 2;
          continue;
        }
        if (ch === quote) {
          return pos + 1;
        }
        pos += 1;
      }
      return length;
    }

    function skipTemplateExpression(pos) {
      var depth = 1;
      while (pos < length && depth > 0) {
        var ch = source.charAt(pos);
        if (ch === '\\') {
          pos += 2;
          continue;
        }
        if (ch === '\'' || ch === '"') {
          pos = skipString(pos);
          continue;
        }
        if (ch === '`') {
          pos = skipTemplate(pos);
          continue;
        }
        if (ch === '/' && source.charAt(pos + 1) === '/') {
          pos = skipLineComment(pos + 2);
          continue;
        }
        if (ch === '/' && source.charAt(pos + 1) === '*') {
          pos = skipBlockComment(pos + 2);
          continue;
        }
        if (ch === '{') depth += 1;
        if (ch === '}') depth -= 1;
        pos += 1;
      }
      return pos;
    }

    function skipTemplate(pos) {
      pos += 1;
      while (pos < length) {
        var ch = source.charAt(pos);
        if (ch === '\\') {
          pos += 2;
          continue;
        }
        if (ch === '`') {
          return pos + 1;
        }
        if (ch === '$' && source.charAt(pos + 1) === '{') {
          pos = skipTemplateExpression(pos + 2);
          continue;
        }
        pos += 1;
      }
      return length;
    }

    function skipStringsAndComments(pos) {
      var ch = source.charAt(pos);
      if (ch === '\'' || ch === '"') return skipString(pos);
      if (ch === '`') return skipTemplate(pos);
      if (ch === '/' && source.charAt(pos + 1) === '/') return skipLineComment(pos + 2);
      if (ch === '/' && source.charAt(pos + 1) === '*') return skipBlockComment(pos + 2);
      return pos;
    }

    while (index < length) {
      var ch = source.charAt(index);

      if (ch === '\'' || ch === '"' || ch === '`' || (ch === '/' && (source.charAt(index + 1) === '/' || source.charAt(index + 1) === '*'))
      ) {
        index = skipStringsAndComments(index);
        continue;
      }

      if (ch === 'f' && source.slice(index, index + 8) === 'function') {
        var before = source.charAt(index - 1);
        var after = source.charAt(index + 8);
        if ((index === 0 || !isIdentifierPart(before)) && (!after || !isIdentifierPart(after))) {
          var cursor = skipWhitespace(index + 8);
          var nameStart = cursor;
          while (cursor < length && isIdentifierPart(source.charAt(cursor))) cursor += 1;
          if (cursor === nameStart) {
            index += 8;
            continue;
          }
          var name = source.slice(nameStart, cursor);
          cursor = skipWhitespace(cursor);
          if (source.charAt(cursor) !== '(') {
            index = cursor;
            continue;
          }

          var parenStart = cursor;
          var parenDepth = 0;
          while (cursor < length) {
            var pch = source.charAt(cursor);
            if (pch === '\'' || pch === '"' || pch === '`' || (pch === '/' && (source.charAt(cursor + 1) === '/' || source.charAt(cursor + 1) === '*'))
            ) {
              cursor = skipStringsAndComments(cursor);
              continue;
            }
            if (pch === '(') parenDepth += 1;
            if (pch === ')') {
              parenDepth -= 1;
              if (parenDepth === 0) {
                cursor += 1;
                break;
              }
            }
            cursor += 1;
          }

          var args = source.slice(parenStart + 1, cursor - 1);
          cursor = skipWhitespace(cursor);
          if (source.charAt(cursor) !== '{') {
            index = cursor;
            continue;
          }

          var bodyStart = cursor + 1;
          cursor = bodyStart;
          var braceDepth = 1;
          while (cursor < length && braceDepth > 0) {
            var bch = source.charAt(cursor);
            if (bch === '\'' || bch === '"' || bch === '`' || (bch === '/' && (source.charAt(cursor + 1) === '/' || source.charAt(cursor + 1) === '*'))
            ) {
              cursor = skipStringsAndComments(cursor);
              continue;
            }
            if (bch === '{') {
              braceDepth += 1;
            } else if (bch === '}') {
              braceDepth -= 1;
              if (braceDepth === 0) {
                break;
              }
            }
            cursor += 1;
          }

          var bodyEnd = cursor;
          var body = source.slice(bodyStart, bodyEnd);
          map[name] = { args: args, body: body };

          index = cursor + 1;
          continue;
        }
      }

      index += 1;
    }

    return map;
  }

  function ContextAdapter(context) {
    return {
      getState: function () {
        return typeof context.getState === 'function' ? context.getState() : context.state || {};
      },
      setState: function (updater) {
        if (typeof context.setState === 'function') {
          context.setState(updater);
          return;
        }
        if (typeof updater === 'function') {
          context.state = updater(context.state);
        } else {
          context.state = updater;
        }
      },
      get: function (path) {
        var state = this.getState();
        if (!path) return state;
        var parts = path.split('.');
        var current = state;
        for (var i = 0; i < parts.length; i += 1) {
          if (current == null) return undefined;
          current = current[parts[i]];
        }
        return current;
      },
      set: function (path, value) {
        if (!path) return;
        var parts = path.split('.');
        this.setState(function (prev) {
          var root = Array.isArray(prev) ? prev.slice() : Object.assign({}, prev || {});
          var ptr = root;
          for (var i = 0; i < parts.length - 1; i += 1) {
            var key = parts[i];
            var next = ptr[key];
            if (Array.isArray(next)) {
              ptr[key] = next.slice();
            } else {
              ptr[key] = Object.assign({}, next || {});
            }
            ptr = ptr[key];
          }
          ptr[parts[parts.length - 1]] = value;
          return root;
        });
      },
      rebuild: function () {
        if (typeof context.rebuild === 'function') context.rebuild();
        if (typeof context.flush === 'function') context.flush();
      }
    };
  }

  function createOrderKey(namespace, expr) {
    var eventExpr = parseEventExpression(expr);
    if (!eventExpr || !eventExpr.handler || eventExpr.inline) {
      var basis = (namespace ? namespace + '|' : '') + String(expr || '');
      return 'auto:' + createHash(basis);
    }
    if (!namespace) return 'auto:' + eventExpr.handler;
    return namespace + ':' + eventExpr.handler;
  }

  function synthesizeOrders(namespace, events, scriptFns) {
    var orders = {};
    events.forEach(function (event) {
      var key = createOrderKey(namespace, event.value);
      var parsed = parseEventExpression(event.value);
      var handlerDef = parsed && parsed.handler ? scriptFns[parsed.handler] : null;
      var gkey = key;
      if (!orders[key]) {
        orders[key] = { on: [event.name], gkeys: [gkey], handler: null };
      } else {
        if (orders[key].on.indexOf(event.name) === -1) orders[key].on.push(event.name);
        if (orders[key].gkeys.indexOf(gkey) === -1) orders[key].gkeys.push(gkey);
      }
      orders[key].handler = createOrderHandler(parsed, handlerDef);
      if (event.owner && !event.owner.attrs['data-m-gkey']) {
        event.owner.attrs['data-m-gkey'] = gkey;
      }
    });
    return orders;
  }

  function createOrderHandler(parsed, handlerDef) {
    var compiledFn = null;
    if (handlerDef && handlerDef.body != null) {
      compiledFn = new Function(handlerDef.args || '', handlerDef.body);
    }
    return function (event, context) {
      if (event && typeof event.preventDefault === 'function' && event.type === 'submit') {
        event.preventDefault();
      }
      var ctx = ContextAdapter(context);
      if (parsed && parsed.inline && parsed.args && parsed.args.length) {
        evaluateExpression(parsed.args[0], {
          state: ctx.getState(),
          ctx: ctx,
          db: ctx.getState(),
          M: Mishkah,
          UI: Mishkah.UI,
          D: Mishkah.DSL,
          locals: { event: event, ctx: ctx }
        });
      } else if (parsed && parsed.handler && compiledFn) {
        var args = [];
        var argList = parsed.args || [];
        for (var i = 0; i < argList.length; i += 1) {
          var arg = argList[i];
          if (arg === 'event') {
            args.push(event);
          } else if (arg === 'ctx') {
            args.push(ctx);
          } else {
            args.push(
              evaluateExpression(arg, {
                state: ctx.getState(),
                ctx: ctx,
                db: ctx.getState(),
                M: Mishkah,
                UI: Mishkah.UI,
                D: Mishkah.DSL,
                locals: { event: event, ctx: ctx }
              })
            );
          }
        }
        compiledFn.apply(null, args);
      }
      if (typeof context.flush === 'function') {
        context.flush();
      } else if (typeof context.rebuild === 'function') {
        context.rebuild();
      }
    };
  }

  function collectEvents(node, list) {
    if (!node) return;
    if ((node.type === 'atom' || node.type === 'component') && Array.isArray(node.events)) {
      for (var i = 0; i < node.events.length; i += 1) {
        list.push(node.events[i]);
      }
    }
    if (Array.isArray(node.children)) {
      for (var j = 0; j < node.children.length; j += 1) {
        collectEvents(node.children[j], list);
      }
    }
    if (node.type === 'if-chain') {
      for (var k = 0; k < node.chain.length; k += 1) {
        collectEvents(node.chain[k].node, list);
      }
    }
  }

  function serializeDom(fragment) {
    var div = document.createElement('div');
    div.appendChild(fragment.cloneNode(true));
    return div.innerHTML;
  }

  function compileTemplate(template) {
    var parts = extractTemplateParts(template);
    var warnings = [];
    var children = [];
    var node = parts.fragment.firstChild;
    var index = 0;
    while (node) {
      var analyzed = analyzeNode(node, String(index), parts.namespace, warnings);
      if (analyzed) children.push(analyzed);
      index += 1;
      node = node.nextSibling;
    }
    var grouped = groupConditionals(children);
    var domSignature = serializeDom(parts.fragment);
    var scopedStyle = scopeCss(parts.namespace, parts.styleSource, domSignature);
    if (scopedStyle) {
      for (var si = 0; si < grouped.length; si += 1) {
        var target = grouped[si];
        if (!target) continue;
        if (target.type === 'atom' || target.type === 'component') {
          target.attrs['data-m-scope'] = scopedStyle.scopeAttr;
          break;
        }
        if (target.type === 'if-chain') {
          for (var ci = 0; ci < target.chain.length; ci += 1) {
            var branchNode = target.chain[ci].node;
            if (branchNode && (branchNode.type === 'atom' || branchNode.type === 'component')) {
              branchNode.attrs['data-m-scope'] = scopedStyle.scopeAttr;
              si = grouped.length;
              break;
            }
          }
        }
      }
    }
    var compiledChildren = grouped.map(function (child) { return compileNode(child); });
    var render = function (scope) {
      var pieces = [];
      for (var i = 0; i < compiledChildren.length; i += 1) {
        var out = compiledChildren[i](scope);
        if (Array.isArray(out)) {
          for (var j = 0; j < out.length; j += 1) {
            if (out[j] != null && out[j] !== false) pieces.push(out[j]);
          }
        } else if (out != null && out !== false) {
          pieces.push(out);
        }
      }
      return pieces.length === 1 ? pieces[0] : pieces;
    };

    var events = [];
    grouped.forEach(function (entry) {
      collectEvents(entry, events);
    });
    var scriptFns = parseFunctions(parts.scriptSource || '');
    var orders = synthesizeOrders(parts.namespace, events, scriptFns);

    var databasePatch = null;
    if (scopedStyle) {
      databasePatch = { head: { styles: [scopedStyle] } };
    }

    return {
      namespace: parts.namespace,
      mount: parts.mount,
      render: render,
      orders: orders,
      databasePatch: databasePatch,
      warnings: warnings,
      element: template
    };
  }

  function deriveMounts(compiled, options) {
    var usedMounts = {};
    var defaultMount = '#app';
    var root = (options && options.root) || global.document || null;
    for (var i = 0; i < compiled.length; i += 1) {
      var entry = compiled[i];
      var mount = entry.mount;
      if (mount && root && root.querySelector(mount)) {
        usedMounts[mount] = true;
        entry.mount = mount;
        continue;
      }
      if (root && root.querySelector(defaultMount) && !usedMounts[defaultMount]) {
        entry.mount = defaultMount;
        usedMounts[defaultMount] = true;
        continue;
      }
      if (root) {
        var containerId = 'm-' + entry.namespace;
        var container = root.getElementById(containerId);
        if (!container) {
          container = root.createElement('div');
          container.id = containerId;
          if (entry.element && entry.element.parentNode) {
            entry.element.parentNode.insertBefore(container, entry.element.nextSibling);
          } else {
            root.body && root.body.appendChild(container);
          }
        }
        entry.mount = '#' + containerId;
      } else {
        entry.mount = defaultMount;
      }
      usedMounts[entry.mount] = true;
      if (entry.element) {
        entry.element.setAttribute('data-namespace', entry.namespace);
        entry.element.setAttribute('data-mount', entry.mount);
      }
    }
  }

  function wrapRenderers(compiled) {
    return compiled.map(function (entry) {
      return {
        namespace: entry.namespace,
        mount: entry.mount,
        render: function (scope) {
          var output = entry.render(scope);
          if (Array.isArray(output)) {
            var dsl = scope.D || Mishkah.DSL;
            return dsl.Containers.Div({ attrs: {} }, output);
          }
          return output;
        }
      };
    });
  }

  function createScope(state, app, dsl) {
    return {
      state: state,
      db: state,
      ctx: app,
      M: Mishkah,
      UI: Mishkah.UI || {},
      D: dsl || Mishkah.DSL || {},
      locals: {}
    };
  }

  function mergeOrders(list) {
    var merged = {};
    for (var i = 0; i < list.length; i += 1) {
      var source = list[i] || {};
      for (var key in source) {
        if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
        merged[key] = source[key];
      }
    }
    return merged;
  }

  function mergeStyles(base, compiled) {
    var styles = Array.isArray(base) ? base.slice() : [];
    var seen = {};
    styles.forEach(function (entry) {
      if (entry && entry.id) seen[entry.id] = true;
    });
    compiled.forEach(function (entry) {
      var patch = (entry.databasePatch && entry.databasePatch.head && entry.databasePatch.head.styles) || [];
      for (var i = 0; i < patch.length; i += 1) {
        var style = patch[i];
        if (!style) continue;
        if (style.id && seen[style.id]) continue;
        if (style.id) seen[style.id] = true;
        styles.push(style);
      }
    });
    return styles;
  }

  function renderAll(compiled, state, app, dsl) {
    var scope = createScope(state, app, dsl);
    var fragments = [];
    var activeDsl = scope.D || dsl || Mishkah.DSL;
    for (var i = 0; i < compiled.length; i += 1) {
      var rendered = compiled[i].render(scope);
      if (rendered == null) continue;
      fragments.push(wrapForMount(compiled[i].mount, scope.D, ensureArray(rendered)));
    }
    if (!fragments.length) {
      return activeDsl.Containers.Div({ attrs: { class: 'p-6 text-center text-slate-500' } }, ['لا يوجد محتوى HTMLx']);
    }
    if (fragments.length === 1) return fragments[0];
    return activeDsl.Containers.Div({ attrs: { class: 'grid gap-10' } }, fragments);
  }

  function wrapForMount(target, D, children) {
    var dsl = D || Mishkah.DSL;
    if (!target) return children.length === 1 ? children[0] : dsl.Containers.Div({ attrs: {} }, children);
    return dsl.Containers.Div({ attrs: { 'data-mount': target } }, children);
  }

  async function createApp(db, options) {
    if (!db || typeof db !== 'object') {
      throw new Error('Mishkah.app.make يتطلب كائن قاعدة بيانات صالح.');
    }
    var root = (options && options.root) || global.document || null;
    if (!root || !root.querySelectorAll) {
      throw new Error('HTML document context is required.');
    }
    var templates = Array.from(root.querySelectorAll('template'));
    var compiled = templates.map(compileTemplate);
    deriveMounts(compiled, { root: root });
    var app = Mishkah.app.createApp(db, {});

    db.head = db.head || {};
    db.head.styles = mergeStyles(db.head.styles, compiled);

    var envResult = null;
    var shouldInitEnv = !(db && db.env && db.env.twcss === false);
    if (shouldInitEnv && Mishkah.utils && Mishkah.utils.twcss && typeof Mishkah.utils.twcss.auto === 'function') {
      try {
        envResult = await Promise.resolve(Mishkah.utils.twcss.auto(db, app, { pageScaffold: true }));
      } catch (error) {
        console.warn('twcss.auto فشل:', error);
        envResult = null;
      }
      if (envResult && envResult.databasePatch && envResult.databasePatch.head && Array.isArray(envResult.databasePatch.head.styles)) {
        db.head.styles = mergeStyles(db.head.styles, [{ databasePatch: envResult.databasePatch }]);
      }
    }

    var rendererList = wrapRenderers(compiled);
    Mishkah.app.setBody(function (state, D) {
      return renderAll(rendererList, state, app, D || Mishkah.DSL);
    });

    var generatedOrders = mergeOrders(compiled.map(function (entry) { return entry.orders; }));
    var mergedOrders = mergeOrders([
      generatedOrders,
      (envResult && envResult.orders) || {},
      (Mishkah.UI && Mishkah.UI.orders) || {}
    ]);
    app.setOrders(mergedOrders);

    var mountTarget = (options && options.mount) || '#app';
    app.mount(mountTarget);

    return { app: app, compiled: compiled, renderers: rendererList };
  }

  var agent = {
    version: '1.0.0',
    compileTemplate: compileTemplate,
    createApp: createApp,
    ContextAdapter: ContextAdapter,
    make: async function (db, options) {
      var result = await createApp(db, options);
      return result.app;
    }
  };

  agent.boot = function (db, options) {
    console.warn('M.HTMLxAgent.boot متوقفة، استخدم make بدلاً منها.');
    return agent.make(db, options);
  };

  Mishkah.HTMLx = Mishkah.HTMLx || {};
  Mishkah.HTMLx.Agent = agent;
  Mishkah.HTMLxAgent = agent;

  Mishkah.app.make = agent.make;

  return agent;
});
