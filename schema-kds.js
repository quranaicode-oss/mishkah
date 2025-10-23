(function(global){
  if(!global) return;
  const root = global.Mishkah || {};
  const schemaModule = root.schema || {};
  const sources = schemaModule.sources || {};
  const utils = schemaModule.utils || {};
  const clone = typeof utils.clone === 'function'
    ? utils.clone
    : (value)=> (value == null ? value : JSON.parse(JSON.stringify(value)));
  const source = sources.kds || null;
  if(source && source.definition){
    global.MishkahKDSSchema = clone(source.definition);
    return;
  }
  if(global.console && typeof global.console.warn === 'function'){
    global.console.warn('[Mishkah][schema-kds] KDS schema source unavailable.');
  }
  global.MishkahKDSSchema = { tables: [] };
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
