import type { SnippetOptions, SourceLocation } from './types';
export interface SourceMapSnippet {
    lines: string[];
    pointer: string;
}
export declare class HtmlxError extends Error {
    readonly code: string;
    readonly loc: SourceLocation;
    readonly snippet?: SourceMapSnippet | undefined;
    constructor(code: string, message: string, loc: SourceLocation, snippet?: SourceMapSnippet | undefined);
}
export declare function createError(code: string, message: string, loc: SourceLocation, source: string): HtmlxError;
export declare function buildSnippet({ source, loc }: SnippetOptions): SourceMapSnippet;
export declare function invariant(condition: unknown, build: () => HtmlxError): asserts condition;
