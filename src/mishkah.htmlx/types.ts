import type { SourceMapSnippet } from './errors';

export interface Position {
  line: number;
  column: number;
  offset: number;
}

export interface SourceLocation {
  start: Position;
  end: Position;
  source?: string;
}

export interface TemplateDescriptor {
  namespace: string;
  mount: string;
  id?: string;
  content: string;
  style?: string;
  script?: string;
}

export type AttrChunk =
  | { type: 'text'; value: string; loc: SourceLocation }
  | { type: 'expr'; code: string; loc: SourceLocation };

export interface AttributeNode {
  name: string;
  chunks: AttrChunk[];
  loc: SourceLocation;
}

export type AstNode = ElementNode | TextNode | ExprNode;

export interface BaseAstNode {
  path: string;
  loc: SourceLocation;
}

export interface ElementNode extends BaseAstNode {
  type: 'Element';
  tagName: string;
  attributes: AttributeNode[];
  children: AstNode[];
}

export interface TextNode extends BaseAstNode {
  type: 'Text';
  value: string;
}

export interface ExprNode extends BaseAstNode {
  type: 'Expr';
  code: string;
}

export interface ScriptFunction {
  name: string;
  params: string[];
  loc: SourceLocation;
  body: string;
}

export interface ScriptModule {
  code: string;
  functions: ScriptFunction[];
}

export interface HtmlxAst {
  root: ElementNode;
  style?: string;
  script?: ScriptModule;
}

export interface CompileHTMLxOptions {
  template: TemplateDescriptor;
  atoms: Record<string, Record<string, AtomFactory>>;
  components?: Record<string, unknown>;
  hash?: (value: string) => string;
}

export interface CompileResult {
  namespace: string;
  mount: string;
  scopeId: string;
  component: ComponentFactory;
  orders: Record<string, OrderDefinition>;
  databasePatch: {
    head: { styles: { id: string; content: string }[] };
  };
  meta: {
    ast: HtmlxAst;
    ir: NormalizedNode;
    gkeys: string[];
    template: TemplateDescriptor;
  };
}

export type ComponentFactory = (runtime: RuntimeContext) => unknown;

export interface RuntimeContext {
  D: Record<string, Record<string, AtomFactory>>;
  UI?: Record<string, (...args: any[]) => unknown>;
}

export interface NormalizerOptions {
  namespace: string;
  hash: (value: string) => string;
  atoms: Record<string, Record<string, AtomFactory>>;
  components?: Record<string, unknown>;
}

export interface NormalizerOutput {
  node: NormalizedNode;
  gkeys: string[];
}

export type NormalizedNode =
  | NormalizedElement
  | NormalizedText
  | NormalizedExpr
  | NormalizedIf
  | NormalizedFor;

export interface NormalizedElement {
  kind: 'element';
  tagName: string;
  nodeType: 'atom' | 'component';
  atom?: AtomDescriptor;
  componentRef?: string;
  key: string;
  attrs: Record<string, AttrValue>;
  events: EventBinding[];
  children: NormalizedNode[];
  path: string;
}

export interface NormalizedText {
  kind: 'text';
  value: string;
  path: string;
}

export interface NormalizedExpr {
  kind: 'expr';
  code: string;
  path: string;
}

export interface NormalizedIf {
  kind: 'if';
  test: string;
  consequent: NormalizedNode | null;
  alternate: NormalizedNode | null;
  path: string;
}

export interface NormalizedFor {
  kind: 'for';
  item: string;
  index?: string;
  collection: string;
  body: NormalizedNode;
  path: string;
}

export type AttrValue = string | AttrChunk[];

export interface EventBinding {
  type: string;
  handler: EventHandlerSpec;
  gkey: string;
  loc: SourceLocation;
}

export interface EventHandlerSpec {
  name: string;
  args: HandlerArgument[];
  loc: SourceLocation;
}

export type HandlerArgument =
  | { kind: 'event' }
  | { kind: 'context' }
  | { kind: 'literal'; value: string }
  | { kind: 'number'; value: number }
  | { kind: 'expr'; code: string };

export interface AtomDescriptor {
  family:
    | 'Containers'
    | 'Text'
    | 'Lists'
    | 'Forms'
    | 'Inputs'
    | 'Media'
    | 'Tables'
    | 'SVG';
  name: string;
}

export type AtomFactory = (props: Record<string, unknown>, children?: unknown[]) => unknown;

export interface OrderDefinition {
  on: string[];
  gkeys: string[];
  handler: Function;
}

export interface CodegenOptions {
  scopeId: string;
  namespace: string;
  atoms: Record<string, Record<string, AtomFactory>>;
  components?: Record<string, unknown>;
  handlers: Record<string, Function>;
}

export interface CodegenOutput {
  component: ComponentFactory;
  orders: Record<string, OrderDefinition>;
}

export interface CssScopeResult {
  css: string;
  scopeId: string;
}

export interface SnippetOptions {
  source: string;
  loc: SourceLocation;
}

export type ErrorWithSnippet = {
  code: string;
  message: string;
  loc: SourceLocation;
  snippet?: SourceMapSnippet;
};
