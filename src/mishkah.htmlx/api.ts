import { scopeCss } from './css-scope';
import { HtmlxError } from './errors';
import { generateCode } from './codegen';
import { normalizeAst } from './normalizer';
import { parseHtmlxTemplate } from './parser';
import { CompileHTMLxOptions, CompileResult, ScriptModule } from './types';
import { stableHash } from './hash';

export function compileHTMLx(options: CompileHTMLxOptions): CompileResult {
  const hashFn = options.hash ?? defaultHash;
  const ast = parseHtmlxTemplate(options.template);
  const normalized = normalizeAst(ast, {
    namespace: options.template.namespace,
    hash: hashFn,
    atoms: options.atoms,
    components: options.components
  });
  const scopeId = `${options.template.namespace}-${hashFn(`${options.template.content}|${ast.style ?? ''}`)}`;
  const scopedCss = ast.style ? scopeCss(ast.style, scopeId) : { css: '', scopeId };
  const handlers = evaluateScript(ast.script);
  const { component, orders } = generateCode(normalized.node, {
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

function defaultHash(input: string): string {
  return stableHash(input);
}

function evaluateScript(script?: ScriptModule): Record<string, Function> {
  if (!script) return {};
  const names = script.functions.map((fn) => fn.name);
  if (names.length === 0) return {};
  try {
    const factory = new Function(`${script.code}; return { ${names.join(', ')} };`);
    const result = factory();
    return result && typeof result === 'object' ? result : {};
  } catch (error) {
    throw new HtmlxError('E_SCRIPT_EVAL', `Failed to evaluate script: ${String(error)}`, script.functions[0]?.loc ?? {
      start: { line: 1, column: 0, offset: 0 },
      end: { line: 1, column: 0, offset: 0 }
    });
  }
}
