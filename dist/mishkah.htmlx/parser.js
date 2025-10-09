"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseHtmlxTemplate = parseHtmlxTemplate;
const parse5_1 = require("parse5");
const acorn = __importStar(require("acorn"));
const errors_1 = require("./errors");
function parseHtmlxTemplate(template) {
    const fragment = parseFragmentWithLocations(template.content);
    const elements = fragment.childNodes.filter(isElement);
    if (elements.length === 0) {
        throw (0, errors_1.createError)('E_NO_ROOT', 'Template must contain at least one root element', buildLoc(1, 1), template.content);
    }
    if (elements.length > 1) {
        const loc = elements[1].sourceCodeLocation?.startTag;
        throw (0, errors_1.createError)('E_MULTIPLE_ROOTS', 'Template must have a single root element', loc ? fromParse5Location(loc, template.content) : buildLoc(1, 1), template.content);
    }
    const root = buildElementNode(elements[0], template.content, '0');
    return {
        root,
        style: template.style,
        script: template.script ? parseScript(template.script) : undefined
    };
}
function parseFragmentWithLocations(source) {
    return (0, parse5_1.parseFragment)(source, { sourceCodeLocationInfo: true });
}
function buildElementNode(node, source, path) {
    const loc = node.sourceCodeLocation?.startTag
        ? fromParse5Location(node.sourceCodeLocation.startTag, source)
        : buildLoc(1, 1);
    const tagName = extractTagName(node, source) ?? node.tagName;
    const attributes = node.attrs.map((attr) => buildAttributeNode(node, attr.name, attr.value, source));
    const children = [];
    let childIndex = 0;
    for (const child of node.childNodes ?? []) {
        if (isElement(child)) {
            children.push(buildElementNode(child, source, `${path}.${childIndex}`));
            childIndex += 1;
        }
        else if (isText(child)) {
            const parsed = buildTextNodes(child, source, `${path}.${childIndex}`);
            children.push(...parsed);
            childIndex += 1;
        }
    }
    return { type: 'Element', tagName, attributes, children: children, path, loc };
}
function buildAttributeNode(node, name, value, source) {
    const attrLoc = node.sourceCodeLocation?.attrs?.[name];
    const raw = attrLoc ? source.slice(attrLoc.startOffset, attrLoc.endOffset) : `${name}="${value}"`;
    const eqIndex = raw.indexOf('=');
    const actualName = eqIndex >= 0 ? raw.slice(0, eqIndex).trim() : name;
    const valueRaw = eqIndex >= 0 ? raw.slice(eqIndex + 1).trim() : '""';
    const cleaned = stripQuotes(valueRaw);
    const chunks = splitAttributeValue(cleaned, attrLoc ? fromParse5Location(attrLoc, source) : buildLoc(1, 1));
    return {
        name: actualName,
        chunks,
        loc: attrLoc ? fromParse5Location(attrLoc, source) : buildLoc(1, 1)
    };
}
function stripQuotes(input) {
    if ((input.startsWith('"') && input.endsWith('"')) || (input.startsWith("'") && input.endsWith("'"))) {
        return input.slice(1, -1);
    }
    return input;
}
function splitAttributeValue(value, loc) {
    if (!value.includes('{')) {
        return value ? [{ type: 'text', value, loc }] : [];
    }
    const chunks = [];
    let buffer = '';
    let depth = 0;
    let expr = '';
    for (let i = 0; i < value.length; i += 1) {
        const ch = value[i];
        if (ch === '{') {
            if (depth === 0 && buffer) {
                chunks.push({ type: 'text', value: buffer, loc });
                buffer = '';
            }
            else if (depth > 0) {
                expr += ch;
            }
            depth += 1;
            continue;
        }
        if (ch === '}') {
            depth -= 1;
            if (depth === 0) {
                chunks.push({ type: 'expr', code: expr.trim(), loc });
                expr = '';
                continue;
            }
            expr += ch;
            continue;
        }
        if (depth > 0) {
            expr += ch;
        }
        else {
            buffer += ch;
        }
    }
    if (buffer) {
        chunks.push({ type: 'text', value: buffer, loc });
    }
    return chunks;
}
function buildTextNodes(node, source, path) {
    const loc = node.sourceCodeLocation ? fromParse5Location(node.sourceCodeLocation, source) : buildLoc(1, 1);
    const value = node.value ?? '';
    if (!value.includes('{')) {
        return value.trim() ? [{ type: 'Text', value, path, loc }] : [];
    }
    const segments = splitAttributeValue(value, loc);
    const nodes = [];
    let index = 0;
    for (const segment of segments) {
        if (segment.type === 'text' && segment.value.trim()) {
            nodes.push({ type: 'Text', value: segment.value, path: `${path}.${index}`, loc: segment.loc });
        }
        if (segment.type === 'expr') {
            nodes.push({ type: 'Expr', code: segment.code, path: `${path}.${index}`, loc: segment.loc });
        }
        index += 1;
    }
    return nodes;
}
function parseScript(code) {
    const ast = acorn.parse(code, {
        ecmaVersion: 'latest',
        locations: true,
        sourceType: 'script'
    });
    const functions = [];
    for (const node of ast.body) {
        const statement = node;
        if (statement.type === 'FunctionDeclaration' && statement.id) {
            functions.push({
                name: statement.id.name,
                params: (statement.params ?? []).map((p) => extractParamName(p)),
                loc: fromAcornLocation(statement.loc),
                body: code.slice(statement.start ?? 0, statement.end ?? code.length)
            });
            continue;
        }
        if (statement.type === 'VariableDeclaration') {
            for (const decl of statement.declarations ?? []) {
                if (decl.id?.type === 'Identifier' &&
                    decl.init &&
                    (decl.init.type === 'FunctionExpression' || decl.init.type === 'ArrowFunctionExpression')) {
                    functions.push({
                        name: decl.id.name,
                        params: (decl.init.params ?? []).map((p) => extractParamName(p)),
                        loc: fromAcornLocation(decl.loc),
                        body: code.slice(decl.init.start ?? 0, decl.init.end ?? code.length)
                    });
                }
            }
        }
    }
    return { code, functions };
}
function extractParamName(param) {
    const node = param;
    if (node.type === 'Identifier')
        return node.name;
    if (node.type === 'AssignmentPattern' && node.left?.type === 'Identifier') {
        return node.left.name;
    }
    return '_';
}
function extractTagName(node, source) {
    const startTag = node.sourceCodeLocation?.startTag;
    if (!startTag)
        return undefined;
    const raw = source.slice(startTag.startOffset, startTag.endOffset);
    const match = /^<\/?\s*([\w:-]+)/.exec(raw);
    return match ? match[1] : undefined;
}
function buildLoc(line, column) {
    return {
        start: { line, column, offset: 0 },
        end: { line, column, offset: 0 }
    };
}
function fromParse5Location(loc, source) {
    const startLine = loc.startLine ?? 1;
    const startCol = (loc.startCol ?? 1) - 1;
    const endLine = loc.endLine ?? startLine;
    const endCol = (loc.endCol ?? startCol + 1) - 1;
    return {
        start: { line: startLine, column: startCol, offset: loc.startOffset ?? 0 },
        end: { line: endLine, column: endCol, offset: loc.endOffset ?? 0 },
        source
    };
}
function fromAcornLocation(loc) {
    if (!loc)
        return buildLoc(1, 0);
    return {
        start: { line: loc.start.line, column: loc.start.column, offset: 0 },
        end: { line: loc.end.line, column: loc.end.column, offset: 0 }
    };
}
function isElement(node) {
    return node.tagName !== undefined;
}
function isText(node) {
    return node.nodeName === '#text';
}
