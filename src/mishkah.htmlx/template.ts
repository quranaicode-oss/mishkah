import { parse } from 'parse5';
import type { Document, Element, Template } from 'parse5/dist/tree-adapters/default';
import { TemplateDescriptor } from './types';
import { createHash } from 'crypto';

interface TemplateExtractionOptions {
  hash?: (value: string) => string;
}

export function extractTemplates(html: string, options: TemplateExtractionOptions = {}): TemplateDescriptor[] {
  const hashFn = options.hash ?? ((value: string) => createHash('sha1').update(value).digest('hex').slice(0, 8));
  const document = parse(html, { sourceCodeLocationInfo: true }) as Document;
  const templates: TemplateDescriptor[] = [];
  traverse(document, (node) => {
    if (node.nodeName === 'template') {
      const element = node as Element;
      const templateNode = node as Template;
      const contentFragment = templateNode.content.childNodes ?? [];
      const styleNode = contentFragment.find((child: any) => child.tagName === 'style');
      const scriptNode = contentFragment.find((child: any) => child.tagName === 'script');
      const styleContent = styleNode ? getInnerHtml(styleNode) : undefined;
      const scriptContent = scriptNode ? getInnerHtml(scriptNode) : undefined;
      const templateContent = contentFragment
        .filter((child: any) => child !== styleNode && child !== scriptNode)
        .map((child: any) => serialize(child))
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

function traverse(node: any, visitor: (node: Element) => void) {
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

function attributeMap(node: Element): Record<string, string> {
  const map: Record<string, string> = {};
  for (const attr of node.attrs ?? []) {
    map[attr.name] = attr.value;
  }
  return map;
}

function getInnerHtml(node: any): string {
  return node.childNodes?.map((child: any) => serialize(child)).join('') ?? '';
}

function serialize(node: any): string {
  if (node.nodeName === '#text') {
    return node.value ?? '';
  }
  if (!node.tagName) return '';
  const attrs = (node.attrs ?? []).map((attr: any) => `${attr.name}="${attr.value}"`).join(' ');
  const inner = (node.childNodes ?? []).map((child: any) => serialize(child)).join('');
  if (node.tagName === 'style' || node.tagName === 'script') {
    return '';
  }
  return `<${node.tagName}${attrs ? ' ' + attrs : ''}>${inner}</${node.tagName}>`;
}
