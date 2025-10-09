import { describe, expect, it } from 'vitest';
import { parseHtmlxTemplate } from '../../src/mishkah.htmlx/parser';
import { normalizeAst } from '../../src/mishkah.htmlx/normalizer';
import { TemplateDescriptor } from '../../src/mishkah.htmlx/types';

const template: TemplateDescriptor = {
  namespace: 'counter',
  mount: '#app',
  content: `
    <div>
      <button onclick="inc(event, ctx)">+1</button>
      <ul>
        <li x-for="item, idx in items">{item.label}</li>
      </ul>
    </div>
  `,
  script: 'function inc(event, ctx) { return ctx; }'
};

describe('normalizeAst', () => {
  it('maps elements to atoms and generates gkeys', () => {
    const ast = parseHtmlxTemplate(template);
    const normalized = normalizeAst(ast, {
      namespace: 'counter',
      hash: (value) => value.slice(0, 4),
      atoms: { Containers: { Div: () => undefined }, Lists: { Ul: () => undefined, Li: () => undefined }, Forms: { Button: () => undefined } },
      components: {}
    });
    const root = normalized.node as any;
    expect(root.kind).toBe('element');
    expect(root.atom?.name).toBe('Div');
    const button = root.children[0];
    expect((button as any).events[0].gkey).toBeDefined();
    const list = root.children[1];
    expect((list as any).kind).toBe('element');
    const forNode = (list as any).children[0];
    expect(forNode.kind).toBe('for');
  });
});
