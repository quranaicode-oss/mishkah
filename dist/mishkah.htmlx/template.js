"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractTemplates = extractTemplates;
const parse5_1 = require("parse5");
const hash_1 = require("./hash");
function extractTemplates(html, options = {}) {
    const hashFn = options.hash ?? hash_1.stableHash;
    const document = (0, parse5_1.parse)(html, { sourceCodeLocationInfo: true });
    const templates = [];
    traverse(document, (node) => {
        if (node.nodeName === 'template') {
            const element = node;
            const templateNode = node;
            const contentFragment = templateNode.content.childNodes ?? [];
            const styleNode = contentFragment.find((child) => child.tagName === 'style');
            const scriptNode = contentFragment.find((child) => child.tagName === 'script');
            const styleContent = styleNode ? getInnerHtml(styleNode) : undefined;
            const scriptContent = scriptNode ? getInnerHtml(scriptNode) : undefined;
            const templateContent = contentFragment
                .filter((child) => child !== styleNode && child !== scriptNode)
                .map((child) => serialize(child))
                .join('');
            const attrs = attributeMap(element);
            const namespace = attrs['data-namespace'] || attrs.id || `ns-${hashFn(templateContent)}`;
            const mount = attrs['data-mount'] || '#app';
            templates.push({
                namespace,
                mount,
                id: attrs.id,
                content: templateContent,
                style: styleContent,
                script: scriptContent
            });
        }
    });
    return templates;
}
function traverse(node, visitor) {
    if (node.tagName) {
        visitor(node);
    }
    if (node.childNodes) {
        for (const child of node.childNodes) {
            traverse(child, visitor);
        }
    }
    if (node.content && node.content.childNodes) {
        for (const child of node.content.childNodes) {
            traverse(child, visitor);
        }
    }
}
function attributeMap(node) {
    const map = {};
    for (const attr of node.attrs ?? []) {
        map[attr.name] = attr.value;
    }
    return map;
}
function getInnerHtml(node) {
    return node.childNodes?.map((child) => serialize(child)).join('') ?? '';
}
function serialize(node) {
    if (node.nodeName === '#text') {
        return node.value ?? '';
    }
    if (!node.tagName)
        return '';
    const attrs = (node.attrs ?? []).map((attr) => `${attr.name}="${attr.value}"`).join(' ');
    const inner = (node.childNodes ?? []).map((child) => serialize(child)).join('');
    if (node.tagName === 'style' || node.tagName === 'script') {
        return '';
    }
    return `<${node.tagName}${attrs ? ' ' + attrs : ''}>${inner}</${node.tagName}>`;
}
