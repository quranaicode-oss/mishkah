"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HtmlxError = void 0;
exports.createError = createError;
exports.buildSnippet = buildSnippet;
exports.invariant = invariant;
class HtmlxError extends Error {
    constructor(code, message, loc, snippet) {
        super(`${code}(${loc.start.line}:${loc.start.column}): ${message}`);
        this.code = code;
        this.loc = loc;
        this.snippet = snippet;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
exports.HtmlxError = HtmlxError;
function createError(code, message, loc, source) {
    return new HtmlxError(code, message, loc, buildSnippet({ source, loc }));
}
function buildSnippet({ source, loc }) {
    const lines = source.split(/\r?\n/);
    const before = [];
    const after = [];
    const currentLine = lines[loc.start.line - 1] ?? '';
    for (let i = Math.max(0, loc.start.line - 3); i < loc.start.line - 1; i += 1) {
        before.push(lines[i] ?? '');
    }
    for (let i = loc.start.line; i < Math.min(lines.length, loc.start.line + 2); i += 1) {
        after.push(lines[i] ?? '');
    }
    const pointer = `${' '.repeat(loc.start.column)}^`;
    return { lines: [...before, currentLine, ...after], pointer };
}
function invariant(condition, build) {
    if (!condition) {
        throw build();
    }
}
