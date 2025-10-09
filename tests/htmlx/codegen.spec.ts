import { describe, expect, it } from 'vitest';
import { generateCode } from '../../src/mishkah.htmlx/codegen';
import { NormalizedNode } from '../../src/mishkah.htmlx/types';

const normalized: NormalizedNode = {
  kind: 'element',
  tagName: 'div',
  nodeType: 'atom',
  atom: { family: 'Containers', name: 'Div' },
  componentRef: undefined,
  key: 'root',
  attrs: {},
  events: [
    {
      type: 'click',
      handler: { name: 'inc', args: [], loc: { start: { line: 1, column: 0, offset: 0 }, end: { line: 1, column: 0, offset: 0 } } },
      gkey: 'auto:abc',
      loc: { start: { line: 1, column: 0, offset: 0 }, end: { line: 1, column: 0, offset: 0 } }
    }
  ],
  children: [
    { kind: 'text', value: 'Hello', path: '0.0' }
  ],
  path: '0'
};

describe('generateCode', () => {
  it('produces component representation and binds orders', () => {
    const { component, orders } = generateCode(normalized, {
      scopeId: 'ns-1234',
      namespace: 'counter',
      atoms: { Containers: { Div: () => undefined } },
      components: {},
      handlers: {
        inc: () => 'ok'
      }
    });
    expect(component()).toMatchObject({
      kind: 'element',
      attrs: { 'data-m-scope': 'ns-1234', 'data-m-gkey': 'auto:abc' }
    });
    expect(orders['auto:abc'].on).toEqual(['click']);
    expect(orders['auto:abc'].handler()).toBe('ok');
  });
});
