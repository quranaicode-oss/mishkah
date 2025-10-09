import { createError } from './errors';
import {
  AttrChunk,
  AttributeNode,
  AtomDescriptor,
  ElementNode,
  EventBinding,
  EventHandlerSpec,
  HandlerArgument,
  HtmlxAst,
  NormalizedElement,
  NormalizedExpr,
  NormalizedFor,
  NormalizedIf,
  NormalizedNode,
  NormalizedText,
  NormalizerOptions,
  NormalizerOutput
} from './types';

const ATOM_TABLE: Record<string, AtomDescriptor> = {
  div: { family: 'Containers', name: 'Div' },
  section: { family: 'Containers', name: 'Section' },
  article: { family: 'Containers', name: 'Article' },
  header: { family: 'Containers', name: 'Header' },
  footer: { family: 'Containers', name: 'Footer' },
  main: { family: 'Containers', name: 'Main' },
  nav: { family: 'Containers', name: 'Nav' },
  aside: { family: 'Containers', name: 'Aside' },
  span: { family: 'Text', name: 'Span' },
  p: { family: 'Text', name: 'P' },
  h1: { family: 'Text', name: 'H1' },
  h2: { family: 'Text', name: 'H2' },
  h3: { family: 'Text', name: 'H3' },
  h4: { family: 'Text', name: 'H4' },
  h5: { family: 'Text', name: 'H5' },
  h6: { family: 'Text', name: 'H6' },
  strong: { family: 'Text', name: 'Strong' },
  em: { family: 'Text', name: 'Em' },
  code: { family: 'Text', name: 'Code' },
  blockquote: { family: 'Text', name: 'Blockquote' },
  a: { family: 'Text', name: 'A' },
  ul: { family: 'Lists', name: 'Ul' },
  ol: { family: 'Lists', name: 'Ol' },
  li: { family: 'Lists', name: 'Li' },
  dl: { family: 'Lists', name: 'Dl' },
  dt: { family: 'Lists', name: 'Dt' },
  dd: { family: 'Lists', name: 'Dd' },
  form: { family: 'Forms', name: 'Form' },
  label: { family: 'Forms', name: 'Label' },
  button: { family: 'Forms', name: 'Button' },
  fieldset: { family: 'Forms', name: 'Fieldset' },
  legend: { family: 'Forms', name: 'Legend' },
  input: { family: 'Inputs', name: 'Input' },
  textarea: { family: 'Inputs', name: 'Textarea' },
  select: { family: 'Inputs', name: 'Select' },
  option: { family: 'Inputs', name: 'Option' },
  img: { family: 'Media', name: 'Img' },
  video: { family: 'Media', name: 'Video' },
  audio: { family: 'Media', name: 'Audio' },
  picture: { family: 'Media', name: 'Picture' },
  table: { family: 'Tables', name: 'Table' },
  thead: { family: 'Tables', name: 'Thead' },
  tbody: { family: 'Tables', name: 'Tbody' },
  tr: { family: 'Tables', name: 'Tr' },
  th: { family: 'Tables', name: 'Th' },
  td: { family: 'Tables', name: 'Td' },
  svg: { family: 'SVG', name: 'Svg' },
  path: { family: 'SVG', name: 'Path' },
  circle: { family: 'SVG', name: 'Circle' },
  rect: { family: 'SVG', name: 'Rect' }
};

type NormalizeContext = {
  options: NormalizerOptions;
  gkeys: Set<string>;
};

export function normalizeAst(ast: HtmlxAst, options: NormalizerOptions): NormalizerOutput {
  const ctx: NormalizeContext = { options, gkeys: new Set() };
  const node = normalizeElement(ast.root, ctx, '0');
  return { node, gkeys: Array.from(ctx.gkeys) };
}

function normalizeElement(element: ElementNode, ctx: NormalizeContext, path: string): NormalizedNode {
  const directives = collectDirectives(element.attributes);
  if (directives['x-for']) {
    return normalizeFor(element, directives['x-for'], ctx, path);
  }
  const normalizedChildren = normalizeChildren(element.children, ctx, `${path}`);
  return finalizeElement(element, directives, normalizedChildren, ctx, path);
}

function normalizeChildren(children: ElementNode['children'], ctx: NormalizeContext, path: string): NormalizedNode[] {
  const result: NormalizedNode[] = [];
  let visualIndex = 0;
  for (let i = 0; i < children.length; i += 1) {
    const child = children[i];
    const childPath = `${path}.${visualIndex}`;
    if ((child as ElementNode).type === 'Element') {
      const element = child as ElementNode;
      const directives = collectDirectives(element.attributes);
      if (directives['x-if']) {
        const { node, consumed } = consumeConditional(children as ElementNode[], i, ctx, childPath);
        result.push(node);
        i = consumed;
        visualIndex += 1;
        continue;
      }
      if (directives['x-for']) {
        const normalized = normalizeFor(element, directives['x-for'], ctx, childPath);
        result.push(normalized);
        visualIndex += 1;
        continue;
      }
      result.push(finalizeElement(element, directives, normalizeChildren(element.children, ctx, childPath), ctx, childPath));
      visualIndex += 1;
      continue;
    }
    if ((child as any).type === 'Text') {
      const text = child as any;
      result.push({ kind: 'text', value: text.value, path: childPath } as NormalizedText);
      visualIndex += 1;
      continue;
    }
    if ((child as any).type === 'Expr') {
      const expr = child as any;
      result.push({ kind: 'expr', code: expr.code, path: childPath } as NormalizedExpr);
      visualIndex += 1;
    }
  }
  return result;
}

function normalizeFor(element: ElementNode, directive: AttributeNode, ctx: NormalizeContext, path: string): NormalizedFor {
  const spec = readDirectiveText(directive);
  const match = /^([\w$]+)(?:\s*,\s*([\w$]+))?\s+in\s+(.+)$/.exec(spec);
  if (!match) {
    throw createError('E_BAD_XFOR', 'Invalid x-for expression', directive.loc, directive.loc.source ?? '');
  }
  const [, item, index, collection] = match;
  const clone: ElementNode = {
    ...element,
    attributes: element.attributes.filter((attr) => attr !== directive)
  };
  const body = finalizeElement(clone, collectDirectives(clone.attributes), normalizeChildren(clone.children, ctx, `${path}.body`), ctx, `${path}.body`);
  return { kind: 'for', item, index: index || undefined, collection: collection.trim(), body, path };
}

function consumeConditional(children: ElementNode['children'], start: number, ctx: NormalizeContext, path: string): { node: NormalizedIf; consumed: number } {
  const chain: { element: ElementNode; directive: AttributeNode; test: string | null }[] = [];
  let index = start;
  while (index < children.length) {
    const current = children[index];
    if (current.type !== 'Element') break;
    const directives = collectDirectives(current.attributes);
    if (index === start) {
      if (!directives['x-if']) break;
      chain.push({ element: current, directive: directives['x-if'], test: readDirectiveText(directives['x-if']) });
    } else if (directives['x-else-if']) {
      chain.push({ element: current, directive: directives['x-else-if'], test: readDirectiveText(directives['x-else-if']) });
    } else if (directives['x-else']) {
      chain.push({ element: current, directive: directives['x-else'], test: null });
      index += 1;
      break;
    } else {
      break;
    }
    index += 1;
  }
  const consumed = index - 1;
  let alternate: NormalizedNode | null = null;
  for (let i = chain.length - 1; i >= 0; i -= 1) {
    const entry = chain[i];
    const elementClone: ElementNode = {
      ...entry.element,
      attributes: entry.element.attributes.filter((attr) => attr !== entry.directive && !isElseDirective(attr.name))
    };
    const normalized = finalizeElement(
      elementClone,
      collectDirectives(elementClone.attributes),
      normalizeChildren(elementClone.children, ctx, `${path}.${i}`),
      ctx,
      `${path}.${i}`
    );
    const node: NormalizedIf = {
      kind: 'if',
      test: entry.test ?? 'true',
      consequent: normalized,
      alternate,
      path: `${path}.${i}`
    };
    alternate = node;
  }
  if (!alternate || alternate.kind !== 'if') {
    throw createError('E_BAD_IF_CHAIN', 'Malformed x-if chain', children[start].loc, children[start].loc.source ?? '');
  }
  return { node: alternate, consumed };
}

function finalizeElement(
  element: ElementNode,
  directives: Record<string, AttributeNode | undefined>,
  children: NormalizedNode[],
  ctx: NormalizeContext,
  path: string
): NormalizedElement {
  const tag = element.tagName;
  let nodeType: NormalizedElement['nodeType'] = 'atom';
  let atom = ATOM_TABLE[tag.toLowerCase()];
  let componentRef: string | undefined;
  if (/^[A-Z]/.test(tag)) {
    nodeType = 'component';
    componentRef = tag;
  } else if (tag.startsWith('comp-')) {
    nodeType = 'component';
    componentRef = toPascal(tag.slice(5));
  }
  if (nodeType === 'atom' && !atom) {
    throw createError('E_ATOM_MISMATCH', `No atom mapping for <${tag}>`, element.loc, element.loc.source ?? '');
  }
  if (nodeType === 'component' && componentRef && ctx.options.components && !ctx.options.components[componentRef]) {
    throw createError('E_COMPONENT_NOT_FOUND', `Component ${componentRef} not found`, element.loc, element.loc.source ?? '');
  }
  const attrs: Record<string, string | AttrChunk[]> = {};
  for (const attr of element.attributes) {
    if (isDirective(attr.name) || isEvent(attr.name)) continue;
    attrs[attr.name] = attr.chunks.length === 1 && attr.chunks[0].type === 'text' ? attr.chunks[0].value : attr.chunks;
  }
  const events = collectEvents(element.attributes, ctx, path);
  const keyAttr = directives['key'];
  const key = keyAttr ? readDirectiveText(keyAttr) : ctx.options.hash(`${ctx.options.namespace}|${path}|${tag}`);
  return {
    kind: 'element',
    tagName: tag,
    nodeType,
    atom: atom ? { family: atom.family, name: atom.name } : undefined,
    componentRef,
    key,
    attrs,
    events,
    children,
    path
  };
}

function collectEvents(attrs: AttributeNode[], ctx: NormalizeContext, path: string): EventBinding[] {
  const events: EventBinding[] = [];
  for (const attr of attrs) {
    const eventType = resolveEvent(attr.name);
    if (!eventType) continue;
    const handler = parseHandler(attr);
    const gkey = `auto:${ctx.options.hash(`${ctx.options.namespace}|${path}|${eventType}|${handler.name}`)}`;
    ctx.gkeys.add(gkey);
    events.push({ type: eventType, handler, gkey, loc: attr.loc });
  }
  return events;
}

function parseHandler(attr: AttributeNode): EventHandlerSpec {
  const raw = attr.chunks.map((chunk) => (chunk.type === 'text' ? chunk.value : `{${chunk.code}}`)).join('').trim();
  if (!raw) {
    throw createError('E_EVENT_HANDLER', `Missing handler for ${attr.name}`, attr.loc, attr.loc.source ?? '');
  }
  const match = /^([\w$.]+)\s*(?:\((.*)\))?$/.exec(raw);
  if (!match) {
    throw createError('E_EVENT_HANDLER', `Invalid handler expression "${raw}"`, attr.loc, attr.loc.source ?? '');
  }
  const [, name, args = ''] = match;
  const parsedArgs = args
    .split(',')
    .map((arg) => arg.trim())
    .filter(Boolean)
    .map(parseHandlerArgument);
  return { name, args: parsedArgs, loc: attr.loc };
}

function parseHandlerArgument(value: string): HandlerArgument {
  if (value === 'event') return { kind: 'event' };
  if (value === 'ctx' || value === 'context') return { kind: 'context' };
  if (/^\d+(?:\.\d+)?$/.test(value)) return { kind: 'number', value: Number(value) };
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return { kind: 'literal', value: value.slice(1, -1) };
  }
  if (value.startsWith('{') && value.endsWith('}')) {
    return { kind: 'expr', code: value.slice(1, -1).trim() };
  }
  return { kind: 'literal', value };
}

function collectDirectives(attrs: AttributeNode[]): Record<string, AttributeNode | undefined> {
  const map: Record<string, AttributeNode | undefined> = {};
  for (const attr of attrs) {
    if (isDirective(attr.name)) {
      map[attr.name] = attr;
    }
  }
  return map;
}

function readDirectiveText(attr?: AttributeNode): string {
  if (!attr) return '';
  return attr.chunks.map((chunk) => (chunk.type === 'text' ? chunk.value : `{${chunk.code}}`)).join('').trim();
}

function isDirective(name: string): boolean {
  return name.startsWith('x-') || name === 'key';
}

function isElseDirective(name: string): boolean {
  return name === 'x-else' || name === 'x-else-if';
}

function isEvent(name: string): boolean {
  return resolveEvent(name) != null;
}

function resolveEvent(name: string): string | null {
  if (name.startsWith('on:')) return name.slice(3);
  if (name.startsWith('data-m-on-')) return name.slice('data-m-on-'.length);
  if (name.startsWith('on')) return name.slice(2).toLowerCase();
  return null;
}

function toPascal(value: string): string {
  return value
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}
