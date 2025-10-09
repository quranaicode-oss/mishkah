"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compileHTMLx = compileHTMLx;
const css_scope_1 = require("./css-scope");
const errors_1 = require("./errors");
const codegen_1 = require("./codegen");
const normalizer_1 = require("./normalizer");
const parser_1 = require("./parser");
const hash_1 = require("./hash");
function compileHTMLx(options) {
    const hashFn = options.hash ?? defaultHash;
    const ast = (0, parser_1.parseHtmlxTemplate)(options.template);
    const normalized = (0, normalizer_1.normalizeAst)(ast, {
        namespace: options.template.namespace,
        hash: hashFn,
        atoms: options.atoms,
        components: options.components
    });
    const scopeId = `${options.template.namespace}-${hashFn(`${options.template.content}|${ast.style ?? ''}`)}`;
    const scopedCss = ast.style ? (0, css_scope_1.scopeCss)(ast.style, scopeId) : { css: '', scopeId };
    const handlers = evaluateScript(ast.script);
    const { component, orders } = (0, codegen_1.generateCode)(normalized.node, {
        scopeId,
        namespace: options.template.namespace,
        atoms: options.atoms,
        components: options.components,
        handlers
    });
    return {
        namespace: options.template.namespace,
        mount: options.template.mount,
        scopeId,
        component,
        orders,
        databasePatch: {
            head: {
                styles: scopedCss.css ? [{ id: scopeId, content: scopedCss.css }] : []
            }
        },
        meta: {
            ast,
            ir: normalized.node,
            gkeys: normalized.gkeys,
            template: options.template
        }
    };
}
function defaultHash(input) {
    return (0, hash_1.stableHash)(input);
}
function evaluateScript(script) {
    if (!script)
        return {};
    const names = script.functions.map((fn) => fn.name);
    if (names.length === 0)
        return {};
    try {
        const factory = new Function(`${script.code}; return { ${names.join(', ')} };`);
        const result = factory();
        return result && typeof result === 'object' ? result : {};
    }
    catch (error) {
        throw new errors_1.HtmlxError('E_SCRIPT_EVAL', `Failed to evaluate script: ${String(error)}`, script.functions[0]?.loc ?? {
            start: { line: 1, column: 0, offset: 0 },
            end: { line: 1, column: 0, offset: 0 }
        });
    }
}
