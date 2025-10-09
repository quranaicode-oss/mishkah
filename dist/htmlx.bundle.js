"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compileHTMLx = void 0;
const api_1 = require("./mishkah.htmlx/api");
Object.defineProperty(exports, "compileHTMLx", { enumerable: true, get: function () { return api_1.compileHTMLx; } });
function getGlobal() {
    if (typeof globalThis !== 'undefined')
        return globalThis;
    if (typeof window !== 'undefined')
        return window;
    if (typeof self !== 'undefined')
        return self;
    return Function('return this')();
}
function ensureMishkah() {
    const globalObj = getGlobal();
    if (!globalObj.Mishkah) {
        globalObj.Mishkah = {};
    }
    return globalObj.Mishkah;
}
function createTemplateDescriptor(element, options = {}) {
    const tpl = element;
    const dataset = tpl.dataset || {};
    const namespace = options.namespace || dataset.namespace || tpl.id || `tpl-${Date.now()}`;
    const mount = options.mount || dataset.mount || '#app';
    const fragment = (tpl.content ? tpl.content.cloneNode(true) : document.createDocumentFragment());
    const styles = [];
    const scripts = [];
    fragment.querySelectorAll('style').forEach((node) => {
        styles.push(node.textContent || '');
        node.remove();
    });
    fragment.querySelectorAll('script').forEach((node) => {
        scripts.push(node.textContent || '');
        node.remove();
    });
    const wrapper = document.createElement('div');
    wrapper.appendChild(fragment);
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
function pickAtoms(mishkah) {
    const atoms = {};
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
            atoms[family] = ref;
        }
    }
    return atoms;
}
function compileTemplateElement(element, options = {}) {
    const mishkah = ensureMishkah();
    const descriptor = createTemplateDescriptor(element, options);
    const atoms = options.atoms ?? pickAtoms(mishkah);
    const components = options.components ?? mishkah.UI;
    const compileOptions = {
        template: descriptor,
        atoms: atoms,
        components: components,
        hash: options.hash
    };
    return (0, api_1.compileHTMLx)(compileOptions);
}
function compileAllTemplates(root = document, options) {
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
        value: api_1.compileHTMLx,
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
