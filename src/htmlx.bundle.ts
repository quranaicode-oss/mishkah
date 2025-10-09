import { compileHTMLx } from './mishkah.htmlx/api';
import type { CompileHTMLxOptions, CompileResult, TemplateDescriptor } from './mishkah.htmlx/types';

type GlobalMishkah = {
  DSL?: Record<string, Record<string, unknown>>;
  UI?: Record<string, unknown>;
  HTMLx?: Record<string, unknown>;
};

type CompileTemplateOptions = Partial<Omit<CompileHTMLxOptions, 'template'>> & {
  namespace?: string;
  mount?: string;
};

function getGlobal(): Record<string, unknown> {
  if (typeof globalThis !== 'undefined') return globalThis as unknown as Record<string, unknown>;
  if (typeof window !== 'undefined') return window as unknown as Record<string, unknown>;
  if (typeof self !== 'undefined') return self as unknown as Record<string, unknown>;
  return Function('return this')() as Record<string, unknown>;
}

function ensureMishkah(): GlobalMishkah {
  const globalObj = getGlobal();
  if (!globalObj.Mishkah) {
    globalObj.Mishkah = {};
  }
  return globalObj.Mishkah as GlobalMishkah;
}

function createTemplateDescriptor(element: Element, options: CompileTemplateOptions = {}): TemplateDescriptor {
  const tpl = element as HTMLTemplateElement;
  const dataset = (tpl as HTMLElement).dataset || {};
  const namespace = options.namespace || dataset.namespace || tpl.id || `tpl-${Date.now()}`;
  const mount = options.mount || dataset.mount || '#app';
  const fragment = (tpl.content ? tpl.content.cloneNode(true) : document.createDocumentFragment()) as DocumentFragment;

  const styles: string[] = [];
  const scripts: string[] = [];
  fragment.querySelectorAll('style').forEach((node: Element) => {
    styles.push(node.textContent || '');
    node.remove();
  });
  fragment.querySelectorAll('script').forEach((node: Element) => {
    scripts.push(node.textContent || '');
    node.remove();
  });

  const wrapper = document.createElement('div');
  wrapper.appendChild(fragment as Node);
  const content = wrapper.innerHTML.trim();

  return {
    namespace,
    mount,
    id: tpl.id || undefined,
    content,
    style: styles.length ? styles.join('\n').trim() : undefined,
    script: scripts.length ? scripts.join('\n').trim() : undefined
  };
}

function pickAtoms(mishkah: GlobalMishkah): Record<string, Record<string, unknown>> {
  const atoms: Record<string, Record<string, unknown>> = {};
  const dsl = mishkah.DSL || {};
  const families = [
    'Containers',
    'Text',
    'Lists',
    'Forms',
    'Inputs',
    'Media',
    'Tables',
    'SVG',
    'Semantic',
    'Embedded',
    'Misc'
  ];
  for (const family of families) {
    const ref = dsl[family];
    if (ref && typeof ref === 'object') {
      atoms[family] = ref as Record<string, unknown>;
    }
  }
  return atoms;
}

function compileTemplateElement(
  element: Element,
  options: CompileTemplateOptions = {}
): CompileResult {
  const mishkah = ensureMishkah();
  const descriptor = createTemplateDescriptor(element, options);
  const atoms = options.atoms ?? pickAtoms(mishkah);
  const components = options.components ?? (mishkah.UI as Record<string, unknown> | undefined);
  const compileOptions: CompileHTMLxOptions = {
    template: descriptor,
    atoms: atoms as Record<string, Record<string, any>>,
    components: components as Record<string, unknown> | undefined,
    hash: options.hash
  };
  return compileHTMLx(compileOptions);
}

function compileAllTemplates(root: ParentNode = document, options?: CompileTemplateOptions): CompileResult[] {
  const templates = Array.from(root.querySelectorAll('template'));
  return templates.map((tpl) => compileTemplateElement(tpl, options));
}

const mishkah = ensureMishkah();
const htmlx = mishkah.HTMLx || {};

Object.defineProperties(htmlx, {
  version: {
    value: '0.1.0',
    writable: false,
    configurable: false,
    enumerable: true
  },
  compile: {
    value: compileHTMLx,
    writable: false,
    configurable: true,
    enumerable: true
  },
  compileTemplateElement: {
    value: compileTemplateElement,
    writable: false,
    configurable: true,
    enumerable: true
  },
  compileAllTemplates: {
    value: compileAllTemplates,
    writable: false,
    configurable: true,
    enumerable: true
  }
});

mishkah.HTMLx = htmlx;

export { compileHTMLx };
