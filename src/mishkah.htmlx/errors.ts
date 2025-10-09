import type { SnippetOptions, SourceLocation } from './types';

export interface SourceMapSnippet {
  lines: string[];
  pointer: string;
}

export class HtmlxError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly loc: SourceLocation,
    public readonly snippet?: SourceMapSnippet
  ) {
    super(`${code}(${loc.start.line}:${loc.start.column}): ${message}`);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function createError(code: string, message: string, loc: SourceLocation, source: string): HtmlxError {
  return new HtmlxError(code, message, loc, buildSnippet({ source, loc }));
}

export function buildSnippet({ source, loc }: SnippetOptions): SourceMapSnippet {
  const lines = source.split(/\r?\n/);
  const before: string[] = [];
  const after: string[] = [];
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

export function invariant(condition: unknown, build: () => HtmlxError): asserts condition {
  if (!condition) {
    throw build();
  }
}
