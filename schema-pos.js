(function(global){
  if(!global) return;
  const root = global.Mishkah || {};
  const schemaModule = root.schema || {};
  const sources = schemaModule.sources || {};
  const utils = schemaModule.utils || {};
  const clone = typeof utils.clone === 'function'
    ? utils.clone
    : (value)=> (value == null ? value : JSON.parse(JSON.stringify(value)));
  const source = sources.pos || null;
  if(source && source.definition){
    global.MishkahPOSSchema = clone(source.definition);
    return;
  }
  if(global.console && typeof global.console.warn === 'function'){
    global.console.warn('[Mishkah][schema-pos] POS schema source unavailable.');
  }
  global.MishkahPOSSchema = { tables: [] };
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
