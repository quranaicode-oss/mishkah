# Mishkah HTMLx Compiler

This module implements the production-grade HTMLx compilation pipeline specified for Mishkah.js. It exposes a single high-level API for converting author-facing HTMLx documents into Mishkah DSL components, scoped styles, and normalized orders metadata.

## Usage

```ts
import { compileHTMLx } from '../src';

const atoms = {/* D.* families */};
const components = {/* UI component map */};

const result = compileHTMLx({
  source: htmlxSource,
  namespace: 'card',
  atoms,
  components
});

// scoped CSS patch for Mishkah database
applyPatch(database, result.databasePatch);

// VDOM component
const vdom = result.component(runtime);

// Orders ready to merge with Mishkah app
app.setOrders({ ...result.orders });
```

### Returned structure

- `databasePatch` – ready-to-apply diff with scoped `<style>` entries.
- `orders` – normalized object keyed by `gkey`, each entry containing `on`, `gkeys`, and `handler`.
- `component(runtime)` – function producing Mishkah DSL nodes when provided with a `RuntimeContext` capable of evaluating expressions.
- `meta` – diagnostics that include the parsed AST, normalized IR, emitted `gkeys`, and the generated CSS scope identifier.

## Modules

- `parser.ts` – streaming HTMLx parser with source locations and error reporting.
- `normalizer.ts` – semantic analysis, component resolution, directive handling, key generation, and event bookkeeping.
- `css-scope.ts` – selector rewriting with `[data-m-scope]` prefixes and `:host` handling.
- `codegen.ts` – IR-to-DSL instantiation wired to Mishkah atoms/components.
- `api.ts` – orchestration (`compileHTMLx`) plus orders extraction, hashing, and integration helpers.

See the tests under `tests/htmlx/` for end-to-end fixtures and unit coverage of each stage.
