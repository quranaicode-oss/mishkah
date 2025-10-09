import {
  AttrChunk,
  CodegenOptions,
  CodegenOutput,
  EventBinding,
  HandlerArgument,
  NormalizedElement,
  NormalizedNode,
  OrderDefinition
} from './types';

export function generateCode(root: NormalizedNode, options: CodegenOptions): CodegenOutput {
  const orders = buildOrders(root, options);
  const component = () => renderNode(root, options.scopeId, true);
  return { component, orders };
}

function renderNode(node: NormalizedNode, scopeId: string, isRoot = false): any {
  if (node.kind === 'text') {
    return node.value;
  }
  if (node.kind === 'expr') {
    return { expr: node.code };
  }
  if (node.kind === 'if') {
    return {
      kind: 'if',
      test: node.test,
      consequent: node.consequent ? renderNode(node.consequent, scopeId) : null,
      alternate: node.alternate ? renderNode(node.alternate, scopeId) : null
    };
  }
  if (node.kind === 'for') {
    return {
      kind: 'for',
      item: node.item,
      index: node.index,
      collection: node.collection,
      body: renderNode(node.body, scopeId)
    };
  }
  return renderElement(node, scopeId, isRoot);
}

function renderElement(element: NormalizedElement, scopeId: string, isRoot: boolean): any {
  const attrs: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(element.attrs)) {
    attrs[name] = normalizeAttrValue(value);
  }
  if (isRoot) {
    attrs['data-m-scope'] = scopeId;
  }
  const eventTypes = element.events.map((event) => event.type);
  const gkeys = element.events.map((event) => event.gkey);
  if (gkeys.length) {
    attrs['data-m-gkey'] = gkeys.join(' ');
  }
  return {
    kind: 'element',
    tag: element.tagName,
    key: element.key,
    nodeType: element.nodeType,
    atom: element.atom,
    component: element.componentRef,
    attrs,
    events: element.events,
    children: element.children.map((child) => renderNode(child, scopeId))
  };
}

function normalizeAttrValue(value: string | AttrChunk[]): unknown {
  if (typeof value === 'string') return value;
  if (value.length === 1 && value[0].type === 'text') {
    return value[0].value;
  }
  return value.map((chunk) => (chunk.type === 'text' ? chunk.value : { expr: chunk.code }));
}

function buildOrders(root: NormalizedNode, options: CodegenOptions): Record<string, OrderDefinition> {
  const bindings = collectBindings(root);
  const orders: Record<string, OrderDefinition> = {};
  for (const binding of bindings) {
    const handler = options.handlers[binding.handler.name];
    if (!handler) {
      throw new Error(`Handler ${binding.handler.name} is not defined in script`);
    }
    orders[binding.gkey] = {
      on: [binding.type],
      gkeys: [binding.gkey],
      handler: createOrderWrapper(handler, binding.handler.args)
    };
  }
  return orders;
}

function createOrderWrapper(fn: Function, args: HandlerArgument[]): Function {
  return function orderHandler(event: unknown, ctx: any) {
    const mapped = args.map((arg) => {
      switch (arg.kind) {
        case 'event':
          return event;
        case 'context':
          return ctx;
        case 'literal':
          return arg.value;
        case 'number':
          return arg.value;
        case 'expr':
          return typeof ctx?.evaluate === 'function' ? ctx.evaluate(arg.code) : undefined;
        default:
          return undefined;
      }
    });
    return fn(...mapped);
  };
}

function collectBindings(node: NormalizedNode): EventBinding[] {
  if (node.kind === 'element') {
    return [...node.events, ...node.children.flatMap(collectBindings)];
  }
  if (node.kind === 'if') {
    const thenBindings = node.consequent ? collectBindings(node.consequent) : [];
    const elseBindings = node.alternate ? collectBindings(node.alternate) : [];
    return [...thenBindings, ...elseBindings];
  }
  if (node.kind === 'for') {
    return collectBindings(node.body);
  }
  return [];
}
