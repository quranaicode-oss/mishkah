import { describe, expect, it } from 'vitest';
import { compileHTMLx } from '../../src/mishkah.htmlx/api';
import { TemplateDescriptor } from '../../src/mishkah.htmlx/types';

const template: TemplateDescriptor = {
  namespace: 'counter',
  mount: '#app',
  content: `
    <div>
      <button onclick="inc(event, ctx)">+1</button>
      <p>{state.data.count}</p>
    </div>
  `,
  style: ':host { display: grid; }',
  script: `
    function inc(event, ctx) {
      return ctx;
    }
  `
};

describe('compileHTMLx', () => {
  it('produces component, orders, and scoped css', () => {
    const result = compileHTMLx({
      template,
      atoms: { Containers: { Div: () => undefined }, Forms: { Button: () => undefined }, Text: { P: () => undefined } },
      components: {}
    });
    expect(result.namespace).toBe('counter');
    expect(result.scopeId).toMatch(/^counter-/);
    expect(Object.keys(result.orders)).toHaveLength(1);
    expect(result.databasePatch.head.styles[0].content).toContain('[data-m-scope');
    expect(result.component()).toMatchObject({ kind: 'element' });
  });
});
