import postcss, { AtRule, Rule } from 'postcss';
import selectorParser from 'postcss-selector-parser';
import { CssScopeResult } from './types';

const EXEMPT_AT_RULES = new Set(['keyframes', 'font-face']);

export function scopeCss(css: string, scopeId: string): CssScopeResult {
  if (!css.trim()) {
    return { css: '', scopeId };
  }
  const selector = `[data-m-scope="${scopeId}"]`;
  const root = postcss.parse(css);
  root.walk((node) => {
    if (node.type === 'rule') {
      const rule = node as Rule;
      if (rule.selectors) {
        rule.selectors = rule.selectors.map((sel) => transformSelector(sel, selector));
      }
    }
    if (node.type === 'atrule') {
      const atrule = node as AtRule;
      if (EXEMPT_AT_RULES.has(atrule.name)) {
        return;
      }
      if (atrule.name === 'media' || atrule.name === 'supports') {
        atrule.walkRules((rule) => {
          if (rule.selectors) {
            rule.selectors = rule.selectors.map((sel) => transformSelector(sel, selector));
          }
        });
      }
    }
  });
  return { css: root.toString(), scopeId };
}

function transformSelector(input: string, scoped: string): string {
  const scopeValue = scoped.slice(scoped.indexOf('"') + 1, scoped.lastIndexOf('"'));
  return selectorParser((selectors) => {
    selectors.each((sel) => {
      let hasHost = false;
      sel.walkPseudos((pseudo) => {
        if (pseudo.value === ':host') {
          hasHost = true;
          pseudo.replaceWith(
            selectorParser.attribute({
              attribute: 'data-m-scope',
              operator: '=',
              value: scopeValue,
              quoteMark: '"',
              raws: {}
            })
          );
        }
      });
      if (!hasHost) {
        sel.prepend(
          selectorParser.attribute({
            attribute: 'data-m-scope',
            operator: '=',
            value: scopeValue,
            quoteMark: '"',
            raws: {}
          })
        );
      }
    });
  }).processSync(input);
}
