const assert = require('assert');
const acorn = require('acorn');
const acornWalk = require('acorn-walk');

global.acorn = acorn;
global.acornWalk = acornWalk;

delete require.cache[require.resolve('acorn')];
delete require.cache[require.resolve('acorn-walk')];

global.Mishkah = global.Mishkah || {};
const agent = require('../dist/mishkah-htmlx.js');

if (!agent.__internals || typeof agent.__internals.evaluateExpression !== 'function') {
  throw new Error('Secure evaluator is not exposed for testing.');
}

const evaluate = agent.__internals.evaluateExpression;

function createScope(overrides = {}) {
  const state = Object.assign({
    value: 4,
    list: [1, 2, 3],
    user: { name: 'Sara', address: { city: 'Riyadh' } },
    compute: (n) => n * 2
  }, overrides.state || {});

  const locals = Object.assign({ item: 5, event: { type: 'click' } }, overrides.locals || {});

  const ctx = overrides.ctx || {
    getState: () => state
  };

  const db = overrides.db || {
    env: { lang: 'en' },
    i18n: { lang: 'en', fallback: 'en', tables: { en: {} } },
    data: {}
  };

  return Object.assign({
    state,
    ctx,
    db,
    M: global.Mishkah,
    UI: global.Mishkah.UI || {},
    D: global.Mishkah.DSL || {},
    locals
  }, overrides);
}

function assertBlocked(expression, scope) {
  const logs = [];
  const originalError = console.error;
  console.error = (...args) => { logs.push(args); };
  try {
    const result = evaluate(expression, scope || createScope());
    assert.strictEqual(result, undefined, `Expression ${expression} should not evaluate.`);
    assert(logs.length > 0, 'Blocked expression should log an error.');
  } finally {
    console.error = originalError;
  }
}

(function testBasicMath() {
  const scope = createScope();
  assert.strictEqual(evaluate('value + 1', scope), 5);
  assert.strictEqual(evaluate('item * 3', scope), 15);
})();

(function testSafeGlobals() {
  const scope = createScope();
  assert.strictEqual(evaluate('Math.max(value, 10)', scope), 10);
  assert.strictEqual(evaluate('Array.isArray(list)', scope), true);
})();

(function testOptionalChainingAndNullish() {
  const scope = createScope({ state: { user: null } });
  assert.strictEqual(evaluate('user?.name ?? "Guest"', scope), 'Guest');
})();

(function testMemberAccess() {
  const scope = createScope();
  assert.strictEqual(evaluate('user.address.city', scope), 'Riyadh');
  assert.strictEqual(evaluate('ctx.getState().value', scope), 4);
})();

(function testForbiddenGlobals() {
  const scope = createScope();
  assertBlocked('window.location', scope);
  assertBlocked('document.body', scope);
  assertBlocked('globalThis', scope);
})();

(function testForbiddenCalls() {
  const scope = createScope();
  assertBlocked('eval("1+1")', scope);
  assertBlocked('Function("return 1")()', scope);
  assertBlocked('setTimeout(value, 0)', scope);
})();

(function testPrototypeEscapes() {
  const scope = createScope();
  assertBlocked('user.__proto__', scope);
  assertBlocked('Object["constructor"]', scope);
})();

(function testAssignmentsDisallowed() {
  const scope = createScope();
  assertBlocked('value = 10', scope);
  assertBlocked('++value', scope);
})();

(function testTypeofWindowBlocked() {
  global.window = { secret: true };
  try {
    const scope = createScope();
    assertBlocked('typeof window', scope);
  } finally {
    delete global.window;
  }
})();

(function testTranslatorFallback() {
  const scope = createScope({
    db: {
      env: { lang: 'ar' },
      i18n: {
        lang: 'ar',
        fallback: 'en',
        dict: {
          greeting: { ar: 'مرحبا', en: 'Hello' }
        }
      }
    }
  });
  assert.strictEqual(evaluate('trans("greeting")', scope), 'مرحبا');
})();

console.log('✅ Secure evaluator tests passed');
