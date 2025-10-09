"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scopeCss = scopeCss;
const postcss_1 = __importDefault(require("postcss"));
const postcss_selector_parser_1 = __importDefault(require("postcss-selector-parser"));
const EXEMPT_AT_RULES = new Set(['keyframes', 'font-face']);
function scopeCss(css, scopeId) {
    if (!css.trim()) {
        return { css: '', scopeId };
    }
    const selector = `[data-m-scope="${scopeId}"]`;
    const root = postcss_1.default.parse(css);
    root.walk((node) => {
        if (node.type === 'rule') {
            const rule = node;
            if (rule.selectors) {
                rule.selectors = rule.selectors.map((sel) => transformSelector(sel, selector));
            }
        }
        if (node.type === 'atrule') {
            const atrule = node;
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
function transformSelector(input, scoped) {
    const scopeValue = scoped.slice(scoped.indexOf('"') + 1, scoped.lastIndexOf('"'));
    return (0, postcss_selector_parser_1.default)((selectors) => {
        selectors.each((sel) => {
            let hasHost = false;
            sel.walkPseudos((pseudo) => {
                if (pseudo.value === ':host') {
                    hasHost = true;
                    pseudo.replaceWith(postcss_selector_parser_1.default.attribute({
                        attribute: 'data-m-scope',
                        operator: '=',
                        value: scopeValue,
                        quoteMark: '"',
                        raws: {}
                    }));
                }
            });
            if (!hasHost) {
                sel.prepend(postcss_selector_parser_1.default.attribute({
                    attribute: 'data-m-scope',
                    operator: '=',
                    value: scopeValue,
                    quoteMark: '"',
                    raws: {}
                }));
            }
        });
    }).processSync(input);
}
