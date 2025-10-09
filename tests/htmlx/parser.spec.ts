import { describe, expect, it } from 'vitest';
import { parseHtmlxTemplate } from '../../src/mishkah.htmlx/parser';
import { TemplateDescriptor } from '../../src/mishkah.htmlx/types';

const template: TemplateDescriptor = {
  namespace: 'counter',
  mount: '#app',
  content: `
    <div>
      <button onclick="inc(event)">+1</button>
      <p>{state.data.count}</p>
    </div>
  `,
  style: ':host { display: grid; }',
  script: 'function inc(event) { return event; }'
};

describe('parseHtmlxTemplate', () => {
  it('creates AST nodes with expressions and attributes', () => {
    const ast = parseHtmlxTemplate(template);
    expect(ast.root.tagName).toBe('div');
    const button = ast.root.children[0] as any;
    expect(button.tagName).toBe('button');
    const clickAttr = button.attributes.find((attr: any) => attr.name === 'onclick');
    expect(clickAttr).toBeDefined();
    const textNode = ast.root.children[1] as any;
    expect(textNode.type).toBe('Element');
    const expr = (textNode.children.find((child: any) => child.type === 'Expr')) as any;
    expect(expr.code).toContain('state.data.count');
    expect(ast.script?.functions[0].name).toBe('inc');
  });
});
