import { describe, expect, it } from 'vitest';
import { extractTemplates } from '../../src/mishkah.htmlx/template';

const sampleHtml = `
<template id="counter">
  <style>:host { display: grid; }</style>
  <div>
    <button onclick="inc(event, ctx)">+1</button>
    <p>{state.data.count}</p>
  </div>
  <script>
    function inc(event, ctx) {
      ctx.set('data.count', ctx.get('data.count') + 1);
    }
  </script>
</template>
`;

describe('extractTemplates', () => {
  it('discovers templates and derives namespace/mount', () => {
    const [template] = extractTemplates(sampleHtml);
    expect(template.namespace).toBe('counter');
    expect(template.mount).toBe('#app');
    expect(template.style?.trim()).toContain(':host');
    expect(template.script?.trim()).toContain('function inc');
    expect(template.content).toContain('<div>');
    expect(template.content).not.toContain('<style>');
    expect(template.content).not.toContain('<script>');
  });
});
