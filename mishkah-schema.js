(function(window){
  'use strict';

  const root = window.Mishkah = window.Mishkah || {};
  const U = root.utils || {};

  class SchemaError extends Error {
    constructor(message, detail){
      super(message);
      this.name = 'SchemaError';
      if(detail) this.detail = detail;
    }
  }

  const TYPE_CONFIG = {
    string:{
      sql:(field)=> field.maxLength ? `varchar(${field.maxLength})` : 'varchar(255)',
      normalize(value){ return value == null ? value : String(value); }
    },
    text:{ sql:()=> 'text', normalize(value){ return value == null ? value : String(value); } },
    integer:{
      sql:()=> 'integer',
      normalize(value){
        if(value == null || value === '') return value == null ? null : Number.parseInt(value, 10);
        const parsed = Number.parseInt(value, 10);
        if(Number.isNaN(parsed)) throw new SchemaError('Value must be an integer');
        return parsed;
      }
    },
    number:{
      sql:(field)=> field.precision ? `numeric(${field.precision}${field.scale != null ? `,${field.scale}` : ''})` : 'numeric',
      normalize(value){
        if(value == null || value === '') return value == null ? null : Number(value);
        const parsed = Number(value);
        if(Number.isNaN(parsed)) throw new SchemaError('Value must be numeric');
        return parsed;
      }
    },
    decimal:{
      sql:(field)=> field.precision ? `numeric(${field.precision}${field.scale != null ? `,${field.scale}` : ''})` : 'numeric',
      normalize(value){
        if(value == null || value === '') return value == null ? null : Number(value);
        const parsed = Number(value);
        if(Number.isNaN(parsed)) throw new SchemaError('Value must be numeric');
        return parsed;
      }
    },
    float:{
      sql:()=> 'double precision',
      normalize(value){
        if(value == null || value === '') return value == null ? null : Number(value);
        const parsed = Number(value);
        if(Number.isNaN(parsed)) throw new SchemaError('Value must be numeric');
        return parsed;
      }
    },
    boolean:{
      sql:()=> 'boolean',
      normalize(value){
        if(value === '' || value == null) return value == null ? null : false;
        if(typeof value === 'boolean') return value;
        if(typeof value === 'number') return value === 1;
        const normalized = String(value).toLowerCase();
        if(['true','1','yes','y','on'].includes(normalized)) return true;
        if(['false','0','no','n','off'].includes(normalized)) return false;
        throw new SchemaError('Value must be boolean');
      }
    },
    date:{
      sql:()=> 'date',
      normalize(value){
        if(!value) return value == null ? null : null;
        const date = new Date(value);
        if(Number.isNaN(date.getTime())) throw new SchemaError('Invalid date value');
        return date.toISOString().slice(0,10);
      }
    },
    datetime:{
      sql:()=> 'timestamp without time zone',
      normalize(value){
        if(!value) return value == null ? null : null;
        const date = new Date(value);
        if(Number.isNaN(date.getTime())) throw new SchemaError('Invalid datetime value');
        return date.toISOString();
      }
    },
    timestamp:{
      sql:()=> 'timestamp with time zone',
      normalize(value){
        if(!value) return value == null ? null : null;
        const date = new Date(value);
        if(Number.isNaN(date.getTime())) throw new SchemaError('Invalid timestamp value');
        return date.toISOString();
      }
    },
    json:{
      sql:()=> 'jsonb',
      normalize(value){
        if(value == null) return null;
        if(typeof value === 'string'){ try { return JSON.parse(value); } catch(_){ throw new SchemaError('Invalid JSON'); } }
        return value;
      }
    },
    uuid:{
      sql:()=> 'uuid',
      normalize(value){
        if(value == null || value === '') return value == null ? null : String(value);
        const str = String(value);
        const pattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
        if(!pattern.test(str)) throw new SchemaError('Value must be a UUID');
        return str.toLowerCase();
      }
    }
  };

  function toSnakeCase(value){
    if(!value) return value;
    return String(value)
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .replace(/[-\s]+/g, '_')
      .toLowerCase();
  }

  function clone(value){
    if(typeof structuredClone === 'function') return structuredClone(value);
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function ensureArray(value){
    if(!value) return [];
    return Array.isArray(value) ? value : [value];
  }

  class FieldDefinition {
    constructor(config){
      if(!config || !config.name) throw new SchemaError('Field requires a name');
      this.name = String(config.name);
      this.columnName = config.columnName ? String(config.columnName) : toSnakeCase(this.name);
      this.type = config.type || 'string';
      this.nullable = config.nullable !== false;
      this.defaultValue = config.defaultValue;
      this.maxLength = config.maxLength;
      this.precision = config.precision;
      this.scale = config.scale;
      this.primaryKey = !!config.primaryKey;
      this.unique = !!config.unique;
      this.index = !!config.index;
      this.enum = Array.isArray(config.enum) ? config.enum.slice() : null;
      this.references = config.references ? {
        table: config.references.table,
        column: config.references.column || toSnakeCase(config.references.field || 'id'),
        onDelete: config.references.onDelete || config.references.on_delete || 'NO ACTION',
        onUpdate: config.references.onUpdate || config.references.on_update || 'NO ACTION'
      } : null;
      this.comment = config.comment || '';
      this.notes = config.notes || '';
      if(!TYPE_CONFIG[this.type]) throw new SchemaError(`Unsupported field type: ${this.type}`);
    }

    copy(overrides){
      return new FieldDefinition(Object.assign({}, this.toJSON(), overrides || {}));
    }

    applyDefault(){
      if(typeof this.defaultValue === 'function'){
        return this.defaultValue();
      }
      if(this.defaultValue != null) return clone(this.defaultValue);
      if(this.nullable) return null;
      switch(this.type){
        case 'integer':
        case 'number':
        case 'decimal':
        case 'float':
          return 0;
        case 'boolean':
          return false;
        case 'json':
          return {};
        default:
          return '';
      }
    }

    normalize(value, { allowNull=true }={}){
      let current = value;
      if(current == null || current === ''){
        if(!allowNull && !this.nullable) return this.applyDefault();
        if(this.nullable) return null;
        if(this.defaultValue !== undefined) return this.applyDefault();
        throw new SchemaError(`Field "${this.name}" is required`);
      }
      const handler = TYPE_CONFIG[this.type];
      if(!handler) return current;
      const normalized = handler.normalize.call(this, current);
      if(this.enum && normalized != null && !this.enum.includes(normalized)){
        throw new SchemaError(`Field "${this.name}" must be one of: ${this.enum.join(', ')}`);
      }
      return normalized;
    }

    sqlType(){
      const handler = TYPE_CONFIG[this.type];
      if(!handler) return 'text';
      return typeof handler.sql === 'function' ? handler.sql(this) : handler.sql;
    }

    columnSQL(){
      const parts = [`"${this.columnName}"`, this.sqlType()];
      if(!this.nullable) parts.push('NOT NULL');
      if(this.unique && !this.primaryKey) parts.push('UNIQUE');
      if(this.defaultValue != null && typeof this.defaultValue !== 'function'){
        const val = this.defaultValue;
        if(typeof val === 'string' && /^\w+\(.*\)$/.test(val)){
          parts.push(`DEFAULT ${val}`);
        } else if(typeof val === 'string'){
          parts.push(`DEFAULT '${val.replace(/'/g, "''")}'`);
        } else if(typeof val === 'number' || typeof val === 'boolean'){
          parts.push(`DEFAULT ${val}`);
        } else if(val === null){
          parts.push('DEFAULT NULL');
        }
      }
      return parts.join(' ');
    }

    toJSON(){
      const json = {
        name: this.name,
        columnName: this.columnName,
        type: this.type,
        nullable: this.nullable,
        defaultValue: this.defaultValue,
        maxLength: this.maxLength,
        precision: this.precision,
        scale: this.scale,
        primaryKey: this.primaryKey,
        unique: this.unique,
        index: this.index,
        comment: this.comment,
        notes: this.notes
      };
      if(this.enum) json.enum = this.enum.slice();
      if(this.references){
        json.references = {
          table: this.references.table,
          column: this.references.column,
          onDelete: this.references.onDelete,
          onUpdate: this.references.onUpdate
        };
      }
      return json;
    }
  }

  class TableDefinition {
    constructor(config){
      if(!config || !config.name) throw new SchemaError('Table requires a name');
      this.name = String(config.name);
      this.label = config.label || this.name;
      this.comment = config.comment || '';
      this.sqlName = config.sqlName || toSnakeCase(this.name);
      this.layout = Object.assign({ x:0, y:0 }, config.layout || {});
      this.classCode = config.classCode || config.class || '';
      const fields = ensureArray(config.fields).map(field => field instanceof FieldDefinition ? field : new FieldDefinition(field));
      this.fields = fields;
      this.indexes = ensureArray(config.indexes).map(idx => Object.assign({}, idx));
      this.ensurePrimaryKey();
    }

    ensurePrimaryKey(){
      const primary = this.fields.filter(field => field.primaryKey);
      if(primary.length === 0 && this.fields.length){
        this.fields[0] = this.fields[0].copy({ primaryKey:true, nullable:false });
      }
    }

    setLayout(layout){
      if(!layout) return;
      if(typeof layout.x === 'number') this.layout.x = layout.x;
      if(typeof layout.y === 'number') this.layout.y = layout.y;
    }

    getField(name){
      return this.fields.find(field => field.name === name) || null;
    }

    addField(config){
      const field = config instanceof FieldDefinition ? config : new FieldDefinition(config);
      if(this.getField(field.name)) throw new SchemaError(`Field ${field.name} already exists in ${this.name}`);
      this.fields.push(field);
      return field;
    }

    updateField(name, patch){
      const field = this.getField(name);
      if(!field) throw new SchemaError(`Field ${name} not found in ${this.name}`);
      const idx = this.fields.indexOf(field);
      const updated = field.copy(patch);
      this.fields[idx] = updated;
      return updated;
    }

    removeField(name){
      const idx = this.fields.findIndex(field => field.name === name);
      if(idx === -1) return false;
      this.fields.splice(idx, 1);
      return true;
    }

    createRecord(data){
      const record = {};
      for(const field of this.fields){
        const value = data && (data[field.name] !== undefined ? data[field.name] : data[field.columnName]);
        record[field.name] = field.normalize(value, { allowNull: field.nullable });
      }
      return record;
    }

    updateRecord(current, patch){
      if(!current || typeof current !== 'object') throw new SchemaError('Current record must be provided for update');
      const next = Object.assign({}, current);
      for(const field of this.fields){
        if(patch && Object.prototype.hasOwnProperty.call(patch, field.name)){
          next[field.name] = field.normalize(patch[field.name], { allowNull:field.nullable });
        }
      }
      return next;
    }

    primaryColumns(){
      return this.fields.filter(field => field.primaryKey);
    }

    references(){
      return this.fields.filter(field => field.references);
    }

    toJSON(){
      return {
        name: this.name,
        label: this.label,
        comment: this.comment,
        sqlName: this.sqlName,
        layout: Object.assign({}, this.layout),
        classCode: this.classCode || '',
        fields: this.fields.map(field => field.toJSON()),
        indexes: this.indexes.map(idx => Object.assign({}, idx))
      };
    }

    toSQL(options){
      const opts = options || {};
      const schemaName = opts.schemaName ? String(opts.schemaName) : null;
      const qualifiedName = schemaName ? `"${schemaName}"."${this.sqlName}"` : `"${this.sqlName}"`;
      const lines = this.fields.map(field => `  ${field.columnSQL()}`);
      const primary = this.primaryColumns();
      if(primary.length){
        const cols = primary.map(field => `"${field.columnName}"`).join(', ');
        lines.push(`  PRIMARY KEY (${cols})`);
      }
      for(const field of this.references()){
        const ref = field.references;
        lines.push(`  FOREIGN KEY ("${field.columnName}") REFERENCES "${ref.table}" ("${ref.column}") ON DELETE ${ref.onDelete} ON UPDATE ${ref.onUpdate}`);
      }
      const statement = [`CREATE TABLE IF NOT EXISTS ${qualifiedName} (`, lines.join(',\n'), ');'];
      if(this.comment){
        statement.push(`COMMENT ON TABLE ${qualifiedName} IS '${this.comment.replace(/'/g, "''")}';`);
      }
      for(const field of this.fields){
        if(field.comment){
          const columnRef = `${qualifiedName}."${field.columnName}"`;
          statement.push(`COMMENT ON COLUMN ${columnRef} IS '${field.comment.replace(/'/g, "''")}';`);
        }
      }
      return statement.join('\n');
    }

    indexStatements(options){
      const opts = options || {};
      const schemaName = opts.schemaName ? String(opts.schemaName) : null;
      const qualifiedTable = schemaName ? `"${schemaName}"."${this.sqlName}"` : `"${this.sqlName}"`;
      const statements = [];
      for(const index of this.indexes){
        if(!index || !index.columns || !index.columns.length) continue;
        const name = index.name || `${this.sqlName}_${index.columns.join('_')}_idx`;
        const cols = index.columns.map(col => `"${col}"`).join(', ');
        const method = index.method ? ` USING ${index.method}` : '';
        const unique = index.unique ? 'UNIQUE ' : '';
        const where = index.where ? ` WHERE ${index.where}` : '';
        statements.push(`CREATE ${unique}INDEX IF NOT EXISTS "${name}" ON ${qualifiedTable}${method} (${cols})${where};`);
      }
      return statements;
    }
  }

  class SchemaRegistry {
    constructor(config){
      this.tables = new Map();
      if(config && Array.isArray(config.tables)){
        config.tables.forEach(table => this.register(table instanceof TableDefinition ? table : new TableDefinition(table)));
      }
    }

    register(table){
      const instance = table instanceof TableDefinition ? table : new TableDefinition(table);
      this.tables.set(instance.name, instance);
      return instance;
    }

    unregister(name){
      this.tables.delete(name);
    }

    get(name){
      return this.tables.get(name) || null;
    }

    list(){
      return Array.from(this.tables.values());
    }

    createRecord(tableName, data){
      const table = this.get(tableName);
      if(!table) throw new SchemaError(`Unknown table: ${tableName}`);
      return table.createRecord(data || {});
    }

    updateRecord(tableName, current, patch){
      const table = this.get(tableName);
      if(!table) throw new SchemaError(`Unknown table: ${tableName}`);
      return table.updateRecord(current, patch || {});
    }

    toJSON(){
      return { tables: this.list().map(table => table.toJSON()) };
    }

    generateSQL(options){
      const opts = options || {};
      const includeIndexes = opts.includeIndexes !== false;
      const statements = [];
      const sorted = this.topologicallySorted();
      sorted.forEach(table => { statements.push(table.toSQL(opts)); });
      if(includeIndexes){
        sorted.forEach(table => {
          const indexes = table.indexStatements(opts);
          indexes.forEach(stmt => statements.push(stmt));
        });
      }
      return statements.filter(Boolean).join('\n\n');
    }

    topologicallySorted(){
      const tables = this.list();
      const visited = new Set();
      const visiting = new Set();
      const sorted = [];
      const visit = (table)=>{
        if(visited.has(table.name)) return;
        if(visiting.has(table.name)) return;
        visiting.add(table.name);
        table.references().forEach(field => {
          const refTable = this.get(field.references.table);
          if(refTable) visit(refTable);
        });
        visiting.delete(table.name);
        visited.add(table.name);
        sorted.push(table);
      };
      tables.forEach(table => visit(table));
      return sorted;
    }

    static fromJSON(json){
      return new SchemaRegistry(json || {});
    }
  }

  function defineTable(config){
    return new TableDefinition(config || {});
  }

  const Schema = {
    Error: SchemaError,
    Field: FieldDefinition,
    Table: TableDefinition,
    Registry: SchemaRegistry,
    defineTable,
    utils:{ toSnakeCase, clone }
  };


  const CANONICAL_SCHEMAS = {
    pos: {
  "name": "mishkah_pos",
  "version": 1,
  "tables": [
    {
      "name": "pos_terminal",
      "label": "POS Terminal",
      "sqlName": "pos_terminal",
      "comment": "Registered POS terminals with physical location metadata.",
      "layout": {
        "x": 80,
        "y": 40
      },
      "fields": [
        {
          "name": "id",
          "columnName": "terminal_id",
          "type": "string",
          "primaryKey": true,
          "nullable": false,
          "maxLength": 64
        },
        {
          "name": "code",
          "columnName": "terminal_code",
          "type": "string",
          "nullable": false,
          "unique": true,
          "maxLength": 32
        },
        {
          "name": "label",
          "columnName": "terminal_label",
          "type": "string",
          "nullable": false,
          "maxLength": 96
        },
        {
          "name": "number",
          "columnName": "terminal_number",
          "type": "integer",
          "nullable": false
        },
        {
          "name": "locationId",
          "columnName": "location_id",
          "type": "string",
          "nullable": true,
          "maxLength": 64
        },
        {
          "name": "zone",
          "columnName": "zone",
          "type": "string",
          "nullable": true,
          "maxLength": 32
        },
        {
          "name": "status",
          "columnName": "status",
          "type": "string",
          "nullable": false,
          "defaultValue": "active"
        },
        {
          "name": "timezone",
          "columnName": "timezone",
          "type": "string",
          "nullable": true,
          "maxLength": 64
        },
        {
          "name": "lastOnlineAt",
          "columnName": "last_online_at",
          "type": "timestamp",
          "nullable": true
        },
        {
          "name": "createdAt",
          "columnName": "created_at",
          "type": "timestamp",
          "nullable": false
        },
        {
          "name": "updatedAt",
          "columnName": "updated_at",
          "type": "timestamp",
          "nullable": false
        }
      ],
      "indexes": [
        {
          "name": "idx_pos_terminal_code",
          "columns": [
            "terminal_code"
          ],
          "unique": true
        },
        {
          "name": "idx_pos_terminal_status",
          "columns": [
            "status"
          ]
        }
      ]
    },
    {
      "name": "employee",
      "label": "Employee",
      "sqlName": "employee",
      "comment": "Employees and roles that can access the POS.",
      "layout": {
        "x": 200,
        "y": 40
      },
      "fields": [
        {
          "name": "id",
          "columnName": "employee_id",
          "type": "string",
          "primaryKey": true,
          "nullable": false,
          "maxLength": 64
        },
        {
          "name": "fullName",
          "columnName": "full_name",
          "type": "string",
          "nullable": false,
          "maxLength": 128
        },
        {
          "name": "role",
          "columnName": "role",
          "type": "string",
          "nullable": false,
          "defaultValue": "staff"
        },
        {
          "name": "pinCode",
          "columnName": "pin_code",
          "type": "string",
          "nullable": false,
          "maxLength": 16
        },
        {
          "name": "allowedDiscountRate",
          "columnName": "allowed_discount_rate",
          "type": "decimal",
          "precision": 5,
          "scale": 4,
          "nullable": false,
          "defaultValue": 0
        },
        {
          "name": "phone",
          "columnName": "phone",
          "type": "string",
          "nullable": true,
          "maxLength": 32
        },
        {
          "name": "email",
          "columnName": "email",
          "type": "string",
          "nullable": true,
          "maxLength": 96
        },
        {
          "name": "status",
          "columnName": "status",
          "type": "string",
          "nullable": false,
          "defaultValue": "active"
        },
        {
          "name": "hiredAt",
          "columnName": "hired_at",
          "type": "timestamp",
          "nullable": true
        },
        {
          "name": "createdAt",
          "columnName": "created_at",
          "type": "timestamp",
          "nullable": false
        },
        {
          "name": "updatedAt",
          "columnName": "updated_at",
          "type": "timestamp",
          "nullable": false
        }
      ],
      "indexes": [
        {
          "name": "idx_employee_role",
          "columns": [
            "role"
          ]
        },
        {
          "name": "idx_employee_status",
          "columns": [
            "status"
          ]
        }
      ]
    },
    {
      "name": "pos_shift",
      "label": "POS Shift",
      "sqlName": "pos_shift",
      "comment": "Lifecycle of a cashier shift per terminal.",
      "layout": {
        "x": 320,
        "y": 60
      },
      "fields": [
        {
          "name": "id",
          "columnName": "shift_id",
          "type": "string",
          "primaryKey": true,
          "nullable": false,
          "maxLength": 64
        },
        {
          "name": "posId",
          "columnName": "pos_id",
          "type": "string",
          "nullable": false,
          "references": {
            "table": "pos_terminal",
            "column": "terminal_id",
            "onDelete": "RESTRICT",
            "onUpdate": "CASCADE"
          }
        },
        {
          "name": "posLabel",
          "columnName": "pos_label",
          "type": "string",
          "nullable": false,
          "maxLength": 96
        },
        {
          "name": "posNumber",
          "columnName": "pos_number",
          "type": "integer",
          "nullable": false
        },
        {
          "name": "openedAt",
          "columnName": "opened_at",
          "type": "timestamp",
          "nullable": false
        },
        {
          "name": "closedAt",
          "columnName": "closed_at",
          "type": "timestamp",
          "nullable": true
        },
        {
          "name": "openingFloat",
          "columnName": "opening_float",
          "type": "decimal",
          "precision": 12,
          "scale": 2,
          "nullable": false,
          "defaultValue": 0
        },
        {
          "name": "closingCash",
          "columnName": "closing_cash",
          "type": "decimal",
          "precision": 12,
          "scale": 2,
          "nullable": true
        },
        {
          "name": "cashierId",
          "columnName": "cashier_id",
          "type": "string",
          "nullable": false,
          "references": {
            "table": "employee",
            "column": "employee_id",
            "onDelete": "RESTRICT",
            "onUpdate": "CASCADE"
          }
        },
        {
          "name": "cashierName",
          "columnName": "cashier_name",
          "type": "string",
          "nullable": false,
          "maxLength": 128
        },
        {
          "name": "cashierRole",
          "columnName": "cashier_role",
          "type": "string",
          "nullable": false,
          "defaultValue": "cashier"
        },
        {
          "name": "employeeId",
          "columnName": "employee_id",
          "type": "string",
          "nullable": false,
          "references": {
            "table": "employee",
            "column": "employee_id",
            "onDelete": "RESTRICT",
            "onUpdate": "CASCADE"
          }
        },
        {
          "name": "status",
          "columnName": "status",
          "type": "string",
          "nullable": false,
          "defaultValue": "open"
        },
        {
          "name": "isClosed",
          "columnName": "is_closed",
          "type": "boolean",
          "nullable": false,
          "defaultValue": false
        },
        {
          "name": "totalsByType",
          "columnName": "totals_by_type",
          "type": "json",
          "nullable": false,
          "defaultValue": {}
        },
        {
          "name": "paymentsByMethod",
          "columnName": "payments_by_method",
          "type": "json",
          "nullable": false,
          "defaultValue": {}
        },
        {
          "name": "countsByType",
          "columnName": "counts_by_type",
          "type": "json",
          "nullable": false,
          "defaultValue": {}
        },
        {
          "name": "ordersCount",
          "columnName": "orders_count",
          "type": "integer",
          "nullable": false,
          "defaultValue": 0
        },
        {
          "name": "orders",
          "columnName": "orders_payload",
          "type": "json",
          "nullable": false,
          "defaultValue": []
        },
        {
          "name": "totalSales",
          "columnName": "total_sales",
          "type": "decimal",
          "precision": 14,
          "scale": 2,
          "nullable": false,
          "defaultValue": 0
        },
        {
          "name": "createdAt",
          "columnName": "created_at",
          "type": "timestamp",
          "nullable": false
        },
        {
          "name": "updatedAt",
          "columnName": "updated_at",
          "type": "timestamp",
          "nullable": false
        }
      ],
      "indexes": [
        {
          "name": "idx_pos_shift_pos_status",
          "columns": [
            "pos_id",
            "is_closed",
            "opened_at"
          ]
        },
        {
          "name": "idx_pos_shift_opened_at",
          "columns": [
            "opened_at"
          ]
        }
      ]
    },
    {
      "name": "shift_cash_audit",
      "label": "Shift Cash Audit",
      "sqlName": "shift_cash_audit",
      "comment": "Cash denomination counts captured when closing a shift.",
      "layout": {
        "x": 560,
        "y": 40
      },
      "fields": [
        {
          "name": "id",
          "columnName": "audit_id",
          "type": "string",
          "primaryKey": true,
          "nullable": false,
          "maxLength": 64
        },
        {
          "name": "shiftId",
          "columnName": "shift_id",
          "type": "string",
          "nullable": false,
          "references": {
            "table": "pos_shift",
            "column": "shift_id",
            "onDelete": "CASCADE",
            "onUpdate": "CASCADE"
          }
        },
        {
          "name": "denomination",
          "columnName": "denomination",
          "type": "decimal",
          "precision": 8,
          "scale": 2,
          "nullable": false
        },
        {
          "name": "count",
          "columnName": "count",
          "type": "integer",
          "nullable": false,
          "defaultValue": 0
        },
        {
          "name": "amount",
          "columnName": "amount",
          "type": "decimal",
          "precision": 12,
          "scale": 2,
          "nullable": false
        },
        {
          "name": "capturedAt",
          "columnName": "captured_at",
          "type": "timestamp",
          "nullable": false
        }
      ],
      "indexes": [
        {
          "name": "idx_shift_cash_audit_shift",
          "columns": [
            "shift_id"
          ]
        }
      ]
    },
    {
      "name": "shift_payment_summary",
      "label": "Shift Payment Summary",
      "sqlName": "shift_payment_summary",
      "comment": "Aggregated totals per payment method for a shift.",
      "layout": {
        "x": 560,
        "y": 140
      },
      "fields": [
        {
          "name": "id",
          "columnName": "summary_id",
          "type": "string",
          "primaryKey": true,
          "nullable": false,
          "maxLength": 64
        },
        {
          "name": "shiftId",
          "columnName": "shift_id",
          "type": "string",
          "nullable": false,
          "references": {
            "table": "pos_shift",
            "column": "shift_id",
            "onDelete": "CASCADE",
            "onUpdate": "CASCADE"
          }
        },
        {
          "name": "paymentMethodId",
          "columnName": "payment_method_id",
          "type": "string",
          "nullable": false,
          "references": {
            "table": "payment_method",
            "column": "payment_method_id",
            "onDelete": "RESTRICT",
            "onUpdate": "CASCADE"
          }
        },
        {
          "name": "paymentsCount",
          "columnName": "payments_count",
          "type": "integer",
          "nullable": false,
          "defaultValue": 0
        },
        {
          "name": "totalAmount",
          "columnName": "total_amount",
          "type": "decimal",
          "precision": 14,
          "scale": 2,
          "nullable": false,
          "defaultValue": 0
        }
      ],
      "indexes": [
        {
          "name": "idx_shift_payment_summary_shift",
          "columns": [
            "shift_id"
          ]
        }
      ]
    },
    {
      "name": "order_type",
      "label": "Order Type",
      "sqlName": "order_type",
      "comment": "Supported POS order types and workflows.",
      "layout": {
        "x": 80,
        "y": 160
      },
      "fields": [
        {
          "name": "id",
          "columnName": "order_type_id",
          "type": "string",
          "primaryKey": true,
          "nullable": false,
          "maxLength": 32
        },
        {
          "name": "nameAr",
          "columnName": "name_ar",
          "type": "string",
          "nullable": false,
          "maxLength": 64
        },
        {
          "name": "nameEn",
          "columnName": "name_en",
          "type": "string",
          "nullable": false,
          "maxLength": 64
        },
        {
          "name": "workflow",
          "columnName": "workflow",
          "type": "string",
          "nullable": false,
          "defaultValue": "single-step"
        },
        {
          "name": "allowsSave",
          "columnName": "allows_save",
          "type": "boolean",
          "nullable": false,
          "defaultValue": true
        },
        {
          "name": "allowsFinalizeLater",
          "columnName": "allows_finalize_later",
          "type": "boolean",
          "nullable": false,
          "defaultValue": false
        },
        {
          "name": "allowsLineAdditions",
          "columnName": "allows_line_additions",
          "type": "boolean",
          "nullable": false,
          "defaultValue": false
        },
        {
          "name": "allowsReturns",
          "columnName": "allows_returns",
          "type": "boolean",
          "nullable": false,
          "defaultValue": false
        },
        {
          "name": "sequence",
          "columnName": "sequence",
          "type": "integer",
          "nullable": false,
          "defaultValue": 0
        }
      ],
      "indexes": [
        {
          "name": "idx_order_type_sequence",
          "columns": [
            "sequence"
          ]
        }
      ]
    },
    {
      "name": "order_status",
      "label": "Order Status",
      "sqlName": "order_status",
      "comment": "High level status codes for orders.",
      "layout": {
        "x": 200,
        "y": 160
      },
      "fields": [
        {
          "name": "id",
          "columnName": "status_id",
          "type": "string",
          "primaryKey": true,
          "nullable": false,
          "maxLength": 32
        },
        {
          "name": "nameAr",
          "columnName": "name_ar",
          "type": "string",
          "nullable": false,
          "maxLength": 64
        },
        {
          "name": "nameEn",
          "columnName": "name_en",
          "type": "string",
          "nullable": false,
          "maxLength": 64
        },
        {
          "name": "sequence",
          "columnName": "sequence",
          "type": "integer",
          "nullable": false,
          "defaultValue": 0
        }
      ]
    },
    {
      "name": "order_stage",
      "label": "Order Fulfilment Stage",
      "sqlName": "order_stage",
      "comment": "Lifecycle stages for kitchen and delivery workflows.",
      "layout": {
        "x": 320,
        "y": 160
      },
      "fields": [
        {
          "name": "id",
          "columnName": "stage_id",
          "type": "string",
          "primaryKey": true,
          "nullable": false,
          "maxLength": 32
        },
        {
          "name": "nameAr",
          "columnName": "name_ar",
          "type": "string",
          "nullable": false,
          "maxLength": 64
        },
        {
          "name": "nameEn",
          "columnName": "name_en",
          "type": "string",
          "nullable": false,
          "maxLength": 64
        },
        {
          "name": "descriptionAr",
          "columnName": "description_ar",
          "type": "text",
          "nullable": true
        },
        {
          "name": "descriptionEn",
          "columnName": "description_en",
          "type": "text",
          "nullable": true
        },
        {
          "name": "sequence",
          "columnName": "sequence",
          "type": "integer",
          "nullable": false,
          "defaultValue": 0
        },
        {
          "name": "lockLineEdits",
          "columnName": "lock_line_edits",
          "type": "boolean",
          "nullable": false,
          "defaultValue": false
        }
      ],
      "indexes": [
        {
          "name": "idx_order_stage_sequence",
          "columns": [
            "sequence"
          ]
        }
      ]
    },
    {
      "name": "order_payment_state",
      "label": "Order Payment State",
      "sqlName": "order_payment_state",
      "comment": "Possible payment states for orders.",
      "layout": {
        "x": 440,
        "y": 160
      },
      "fields": [
        {
          "name": "id",
          "columnName": "payment_state_id",
          "type": "string",
          "primaryKey": true,
          "nullable": false,
          "maxLength": 32
        },
        {
          "name": "nameAr",
          "columnName": "name_ar",
          "type": "string",
          "nullable": false,
          "maxLength": 64
        },
        {
          "name": "nameEn",
          "columnName": "name_en",
          "type": "string",
          "nullable": false,
          "maxLength": 64
        }
      ]
    },
    {
      "name": "order_line_status",
      "label": "Order Line Status",
      "sqlName": "order_line_status",
      "comment": "State machine for individual order lines.",
      "layout": {
        "x": 560,
        "y": 160
      },
      "fields": [
        {
          "name": "id",
          "columnName": "line_status_id",
          "type": "string",
          "primaryKey": true,
          "nullable": false,
          "maxLength": 32
        },
        {
          "name": "nameAr",
          "columnName": "name_ar",
          "type": "string",
          "nullable": false,
          "maxLength": 64
        },
        {
          "name": "nameEn",
          "columnName": "name_en",
          "type": "string",
          "nullable": false,
          "maxLength": 64
        },
        {
          "name": "sequence",
          "columnName": "sequence",
          "type": "integer",
          "nullable": false,
          "defaultValue": 0
        }
      ]
    },
    {
      "name": "payment_method",
      "label": "Payment Method",
      "sqlName": "payment_method",
      "comment": "Configured payment methods offered by the venue.",
      "layout": {
        "x": 680,
        "y": 160
      },
      "fields": [
        {
          "name": "id",
          "columnName": "payment_method_id",
          "type": "string",
          "primaryKey": true,
          "nullable": false,
          "maxLength": 32
        },
        {
          "name": "nameAr",
          "columnName": "name_ar",
          "type": "string",
          "nullable": false,
          "maxLength": 64
        },
        {
          "name": "nameEn",
          "columnName": "name_en",
          "type": "string",
          "nullable": false,
          "maxLength": 64
        },
        {
          "name": "type",
          "columnName": "method_type",
          "type": "string",
          "nullable": false,
          "defaultValue": "cash"
        },
        {
          "name": "icon",
          "columnName": "icon",
          "type": "string",
          "nullable": true,
          "maxLength": 32
        },
        {
          "name": "requiresReference",
          "columnName": "requires_reference",
          "type": "boolean",
          "nullable": false,
          "defaultValue": false
        },
        {
          "name": "isActive",
          "columnName": "is_active",
          "type": "boolean",
          "nullable": false,
          "defaultValue": true
        }
      ]
    },
    {
      "name": "kitchen_section",
      "label": "Kitchen Section",
      "sqlName": "kitchen_section",
      "comment": "Production areas used for routing kitchen tickets.",
      "layout": {
        "x": 800,
        "y": 60
      },
      "fields": [
        {
          "name": "id",
          "columnName": "section_id",
          "type": "string",
          "primaryKey": true,
          "nullable": false,
          "maxLength": 64
        },
        {
          "name": "nameAr",
          "columnName": "name_ar",
          "type": "string",
          "nullable": false,
          "maxLength": 64
        },
        {
          "name": "nameEn",
          "columnName": "name_en",
          "type": "string",
          "nullable": false,
          "maxLength": 64
        },
        {
          "name": "descriptionAr",
          "columnName": "description_ar",
          "type": "text",
          "nullable": true
        },
        {
          "name": "descriptionEn",
          "columnName": "description_en",
          "type": "text",
          "nullable": true
        },
        {
          "name": "sortOrder",
          "columnName": "sort_order",
          "type": "integer",
          "nullable": false,
          "defaultValue": 0
        }
      ]
    },
    {
      "name": "menu_category",
      "label": "Menu Category",
      "sqlName": "menu_category",
      "comment": "Menu taxonomy categories.",
      "layout": {
        "x": 800,
        "y": 160
      },
      "fields": [
        {
          "name": "id",
          "columnName": "category_id",
          "type": "string",
          "primaryKey": true,
          "nullable": false,
          "maxLength": 64
        },
        {
          "name": "nameAr",
          "columnName": "name_ar",
          "type": "string",
          "nullable": false,
          "maxLength": 64
        },
        {
          "name": "nameEn",
          "columnName": "name_en",
          "type": "string",
          "nullable": false,
          "maxLength": 64
        },
        {
          "name": "sectionId",
          "columnName": "section_id",
          "type": "string",
          "nullable": true,
          "references": {
            "table": "kitchen_section",
            "column": "section_id",
            "onDelete": "SET NULL",
            "onUpdate": "CASCADE"
          }
        },
        {
          "name": "sortOrder",
          "columnName": "sort_order",
          "type": "integer",
          "nullable": false,
          "defaultValue": 0
        },
        {
          "name": "isActive",
          "columnName": "is_active",
          "type": "boolean",
          "nullable": false,
          "defaultValue": true
        }
      ]
    },
    {
      "name": "category_section",
      "label": "Category Section Map",
      "sqlName": "category_section",
      "comment": "Bridge between menu categories and kitchen sections.",
      "layout": {
        "x": 920,
        "y": 160
      },
      "fields": [
        {
          "name": "categoryId",
          "columnName": "category_id",
          "type": "string",
          "nullable": false,
          "references": {
            "table": "menu_category",
            "column": "category_id",
            "onDelete": "CASCADE",
            "onUpdate": "CASCADE"
          }
        },
        {
          "name": "sectionId",
          "columnName": "section_id",
          "type": "string",
          "nullable": false,
          "references": {
            "table": "kitchen_section",
            "column": "section_id",
            "onDelete": "CASCADE",
            "onUpdate": "CASCADE"
          }
        }
      ],
      "indexes": [
        {
          "name": "idx_category_section_unique",
          "columns": [
            "category_id",
            "section_id"
          ],
          "unique": true
        }
      ]
    },
    {
      "name": "menu_item",
      "label": "Menu Item",
      "sqlName": "menu_item",
      "comment": "Sellable menu items with pricing metadata.",
      "layout": {
        "x": 800,
        "y": 260
      },
      "fields": [
        {
          "name": "id",
          "columnName": "item_id",
          "type": "integer",
          "primaryKey": true,
          "nullable": false
        },
        {
          "name": "sku",
          "columnName": "sku",
          "type": "string",
          "nullable": true,
          "maxLength": 64
        },
        {
          "name": "categoryId",
          "columnName": "category_id",
          "type": "string",
          "nullable": false,
          "references": {
            "table": "menu_category",
            "column": "category_id",
            "onDelete": "RESTRICT",
            "onUpdate": "CASCADE"
          }
        },
        {
          "name": "kitchenSectionId",
          "columnName": "kitchen_section_id",
          "type": "string",
          "nullable": false,
          "references": {
            "table": "kitchen_section",
            "column": "section_id",
            "onDelete": "RESTRICT",
            "onUpdate": "CASCADE"
          }
        },
        {
          "name": "nameAr",
          "columnName": "name_ar",
          "type": "string",
          "nullable": false,
          "maxLength": 128
        },
        {
          "name": "nameEn",
          "columnName": "name_en",
          "type": "string",
          "nullable": false,
          "maxLength": 128
        },
        {
          "name": "descriptionAr",
          "columnName": "description_ar",
          "type": "text",
          "nullable": true
        },
        {
          "name": "descriptionEn",
          "columnName": "description_en",
          "type": "text",
          "nullable": true
        },
        {
          "name": "basePrice",
          "columnName": "base_price",
          "type": "decimal",
          "precision": 12,
          "scale": 2,
          "nullable": false
        },
        {
          "name": "taxGroupId",
          "columnName": "tax_group_id",
          "type": "string",
          "nullable": true,
          "maxLength": 32
        },
        {
          "name": "isCombo",
          "columnName": "is_combo",
          "type": "boolean",
          "nullable": false,
          "defaultValue": false
        },
        {
          "name": "isActive",
          "columnName": "is_active",
          "type": "boolean",
          "nullable": false,
          "defaultValue": true
        },
        {
          "name": "favoriteRank",
          "columnName": "favorite_rank",
          "type": "integer",
          "nullable": true
        },
        {
          "name": "createdAt",
          "columnName": "created_at",
          "type": "timestamp",
          "nullable": false
        },
        {
          "name": "updatedAt",
          "columnName": "updated_at",
          "type": "timestamp",
          "nullable": false
        }
      ],
      "indexes": [
        {
          "name": "idx_menu_item_category",
          "columns": [
            "category_id"
          ]
        },
        {
          "name": "idx_menu_item_active",
          "columns": [
            "is_active"
          ]
        }
      ]
    },
    {
      "name": "menu_item_price",
      "label": "Menu Item Price",
      "sqlName": "menu_item_price",
      "comment": "Alternate price points for menu items (sizes, combos).",
      "layout": {
        "x": 1000,
        "y": 260
      },
      "fields": [
        {
          "name": "id",
          "columnName": "price_id",
          "type": "string",
          "primaryKey": true,
          "nullable": false,
          "maxLength": 64
        },
        {
          "name": "itemId",
          "columnName": "item_id",
          "type": "integer",
          "nullable": false,
          "references": {
            "table": "menu_item",
            "column": "item_id",
            "onDelete": "CASCADE",
            "onUpdate": "CASCADE"
          }
        },
        {
          "name": "priceType",
          "columnName": "price_type",
          "type": "string",
          "nullable": false,
          "defaultValue": "base"
        },
        {
          "name": "label",
          "columnName": "label",
          "type": "string",
          "nullable": true,
          "maxLength": 64
        },
        {
          "name": "amount",
          "columnName": "amount",
          "type": "decimal",
          "precision": 12,
          "scale": 2,
          "nullable": false
        },
        {
          "name": "currency",
          "columnName": "currency",
          "type": "string",
          "nullable": false,
          "defaultValue": "EGP"
        },
        {
          "name": "isDefault",
          "columnName": "is_default",
          "type": "boolean",
          "nullable": false,
          "defaultValue": false
        }
      ],
      "indexes": [
        {
          "name": "idx_menu_item_price_item",
          "columns": [
            "item_id"
          ]
        }
      ]
    },
    {
      "name": "menu_item_media",
      "label": "Menu Item Media",
      "sqlName": "menu_item_media",
      "comment": "Rich media assets associated with menu items.",
      "layout": {
        "x": 920,
        "y": 340
      },
      "fields": [
        {
          "name": "id",
          "columnName": "media_id",
          "type": "string",
          "primaryKey": true,
          "nullable": false,
          "maxLength": 64
        },
        {
          "name": "itemId",
          "columnName": "item_id",
          "type": "integer",
          "nullable": false,
          "references": {
            "table": "menu_item",
            "column": "item_id",
            "onDelete": "CASCADE",
            "onUpdate": "CASCADE"
          }
        },
        {
          "name": "type",
          "columnName": "media_type",
          "type": "string",
          "nullable": false,
          "defaultValue": "image"
        },
        {
          "name": "url",
          "columnName": "url",
          "type": "string",
          "nullable": false
        },
        {
          "name": "isPrimary",
          "columnName": "is_primary",
          "type": "boolean",
          "nullable": false,
          "defaultValue": false
        },
        {
          "name": "createdAt",
          "columnName": "created_at",
          "type": "timestamp",
          "nullable": false
        }
      ],
      "indexes": [
        {
          "name": "idx_menu_item_media_item",
          "columns": [
            "item_id"
          ]
        }
      ]
    },
    {
      "name": "menu_modifier",
      "label": "Menu Modifier",
      "sqlName": "menu_modifier",
      "comment": "Configurable add-ons and removals.",
      "layout": {
        "x": 800,
        "y": 360
      },
      "fields": [
        {
          "name": "id",
          "columnName": "modifier_id",
          "type": "integer",
          "primaryKey": true,
          "nullable": false
        },
        {
          "name": "nameAr",
          "columnName": "name_ar",
          "type": "string",
          "nullable": false,
          "maxLength": 128
        },
        {
          "name": "nameEn",
          "columnName": "name_en",
          "type": "string",
          "nullable": false,
          "maxLength": 128
        },
        {
          "name": "modifierType",
          "columnName": "modifier_type",
          "type": "string",
          "nullable": false,
          "defaultValue": "add_on"
        },
        {
          "name": "priceChange",
          "columnName": "price_change",
          "type": "decimal",
          "precision": 12,
          "scale": 2,
          "nullable": false,
          "defaultValue": 0
        },
        {
          "name": "isActive",
          "columnName": "is_active",
          "type": "boolean",
          "nullable": false,
          "defaultValue": true
        }
      ]
    },
    {
      "name": "menu_item_modifier",
      "label": "Menu Item Modifier",
      "sqlName": "menu_item_modifier",
      "comment": "Bridge table connecting menu items to modifiers.",
      "layout": {
        "x": 920,
        "y": 420
      },
      "fields": [
        {
          "name": "itemId",
          "columnName": "item_id",
          "type": "integer",
          "nullable": false,
          "references": {
            "table": "menu_item",
            "column": "item_id",
            "onDelete": "CASCADE",
            "onUpdate": "CASCADE"
          }
        },
        {
          "name": "modifierId",
          "columnName": "modifier_id",
          "type": "integer",
          "nullable": false,
          "references": {
            "table": "menu_modifier",
            "column": "modifier_id",
            "onDelete": "CASCADE",
            "onUpdate": "CASCADE"
          }
        },
        {
          "name": "isDefault",
          "columnName": "is_default",
          "type": "boolean",
          "nullable": false,
          "defaultValue": false
        },
        {
          "name": "maxQuantity",
          "columnName": "max_quantity",
          "type": "integer",
          "nullable": true
        }
      ],
      "indexes": [
        {
          "name": "idx_menu_item_modifier_unique",
          "columns": [
            "item_id",
            "modifier_id"
          ],
          "unique": true
        }
      ]
    },
    {
      "name": "customer_profile",
      "label": "Customer Profile",
      "sqlName": "customer_profile",
      "comment": "Customers interacting with the POS.",
      "layout": {
        "x": 80,
        "y": 260
      },
      "fields": [
        {
          "name": "id",
          "columnName": "customer_id",
          "type": "string",
          "primaryKey": true,
          "nullable": false,
          "maxLength": 64
        },
        {
          "name": "name",
          "columnName": "customer_name",
          "type": "string",
          "nullable": false,
          "maxLength": 128
        },
        {
          "name": "phone",
          "columnName": "phone",
          "type": "string",
          "nullable": true,
          "maxLength": 32
        },
        {
          "name": "email",
          "columnName": "email",
          "type": "string",
          "nullable": true,
          "maxLength": 96
        },
        {
          "name": "preferredLanguage",
          "columnName": "preferred_language",
          "type": "string",
          "nullable": true,
          "maxLength": 8
        },
        {
          "name": "notes",
          "columnName": "notes",
          "type": "text",
          "nullable": true
        },
        {
          "name": "createdAt",
          "columnName": "created_at",
          "type": "timestamp",
          "nullable": false
        },
        {
          "name": "updatedAt",
          "columnName": "updated_at",
          "type": "timestamp",
          "nullable": false
        }
      ],
      "indexes": [
        {
          "name": "idx_customer_phone",
          "columns": [
            "phone"
          ]
        }
      ]
    },
    {
      "name": "customer_address",
      "label": "Customer Address",
      "sqlName": "customer_address",
      "comment": "Saved addresses for delivery orders.",
      "layout": {
        "x": 80,
        "y": 360
      },
      "fields": [
        {
          "name": "id",
          "columnName": "address_id",
          "type": "string",
          "primaryKey": true,
          "nullable": false,
          "maxLength": 64
        },
        {
          "name": "customerId",
          "columnName": "customer_id",
          "type": "string",
          "nullable": false,
          "references": {
            "table": "customer_profile",
            "column": "customer_id",
            "onDelete": "CASCADE",
            "onUpdate": "CASCADE"
          }
        },
        {
          "name": "label",
          "columnName": "label",
          "type": "string",
          "nullable": true,
          "maxLength": 64
        },
        {
          "name": "areaId",
          "columnName": "area_id",
          "type": "string",
          "nullable": true,
          "maxLength": 64
        },
        {
          "name": "street",
          "columnName": "street",
          "type": "string",
          "nullable": true,
          "maxLength": 128
        },
        {
          "name": "building",
          "columnName": "building",
          "type": "string",
          "nullable": true,
          "maxLength": 64
        },
        {
          "name": "floor",
          "columnName": "floor",
          "type": "string",
          "nullable": true,
          "maxLength": 16
        },
        {
          "name": "apartment",
          "columnName": "apartment",
          "type": "string",
          "nullable": true,
          "maxLength": 16
        },
        {
          "name": "notes",
          "columnName": "notes",
          "type": "text",
          "nullable": true
        },
        {
          "name": "isPrimary",
          "columnName": "is_primary",
          "type": "boolean",
          "nullable": false,
          "defaultValue": false
        }
      ],
      "indexes": [
        {
          "name": "idx_customer_address_customer",
          "columns": [
            "customer_id"
          ]
        }
      ]
    },
    {
      "name": "dining_table",
      "label": "Dining Table",
      "sqlName": "dining_table",
      "comment": "Physical tables available inside the venue.",
      "layout": {
        "x": 80,
        "y": 460
      },
      "fields": [
        {
          "name": "id",
          "columnName": "table_id",
          "type": "string",
          "primaryKey": true,
          "nullable": false,
          "maxLength": 32
        },
        {
          "name": "name",
          "columnName": "table_name",
          "type": "string",
          "nullable": false,
          "maxLength": 64
        },
        {
          "name": "seats",
          "columnName": "seats",
          "type": "integer",
          "nullable": false,
          "defaultValue": 2
        },
        {
          "name": "zone",
          "columnName": "zone",
          "type": "string",
          "nullable": true,
          "maxLength": 32
        },
        {
          "name": "state",
          "columnName": "state",
          "type": "string",
          "nullable": false,
          "defaultValue": "active"
        },
        {
          "name": "displayOrder",
          "columnName": "display_order",
          "type": "integer",
          "nullable": false,
          "defaultValue": 0
        },
        {
          "name": "note",
          "columnName": "note",
          "type": "text",
          "nullable": true
        }
      ],
      "indexes": [
        {
          "name": "idx_dining_table_zone",
          "columns": [
            "zone"
          ]
        }
      ]
    },
    {
      "name": "table_lock",
      "label": "Table Lock",
      "sqlName": "table_lock",
      "comment": "Active locks preventing concurrent seating.",
      "layout": {
        "x": 80,
        "y": 560
      },
      "fields": [
        {
          "name": "id",
          "columnName": "lock_id",
          "type": "string",
          "primaryKey": true,
          "nullable": false,
          "maxLength": 64
        },
        {
          "name": "tableId",
          "columnName": "table_id",
          "type": "string",
          "nullable": false,
          "references": {
            "table": "dining_table",
            "column": "table_id",
            "onDelete": "CASCADE",
            "onUpdate": "CASCADE"
          }
        },
        {
          "name": "lockedBy",
          "columnName": "locked_by",
          "type": "string",
          "nullable": true,
          "references": {
            "table": "employee",
            "column": "employee_id",
            "onDelete": "SET NULL",
            "onUpdate": "CASCADE"
          }
        },
        {
          "name": "reason",
          "columnName": "reason",
          "type": "string",
          "nullable": true,
          "maxLength": 128
        },
        {
          "name": "lockedAt",
          "columnName": "locked_at",
          "type": "timestamp",
          "nullable": false
        },
        {
          "name": "expiresAt",
          "columnName": "expires_at",
          "type": "timestamp",
          "nullable": true
        }
      ],
      "indexes": [
        {
          "name": "idx_table_lock_table",
          "columns": [
            "table_id"
          ]
        }
      ]
    },
    {
      "name": "reservation",
      "label": "Reservation",
      "sqlName": "reservation",
      "comment": "Reservations captured for future seating.",
      "layout": {
        "x": 80,
        "y": 660
      },
      "fields": [
        {
          "name": "id",
          "columnName": "reservation_id",
          "type": "string",
          "primaryKey": true,
          "nullable": false,
          "maxLength": 64
        },
        {
          "name": "customerName",
          "columnName": "customer_name",
          "type": "string",
          "nullable": false,
          "maxLength": 128
        },
        {
          "name": "phone",
          "columnName": "phone",
          "type": "string",
          "nullable": false,
          "maxLength": 32
        },
        {
          "name": "partySize",
          "columnName": "party_size",
          "type": "integer",
          "nullable": false
        },
        {
          "name": "scheduledAt",
          "columnName": "scheduled_at",
          "type": "timestamp",
          "nullable": false
        },
        {
          "name": "holdUntil",
          "columnName": "hold_until",
          "type": "timestamp",
          "nullable": true
        },
        {
          "name": "status",
          "columnName": "status",
          "type": "string",
          "nullable": false,
          "defaultValue": "booked"
        },
        {
          "name": "note",
          "columnName": "note",
          "type": "text",
          "nullable": true
        }
      ]
    },
    {
      "name": "reservation_table",
      "label": "Reservation Table Link",
      "sqlName": "reservation_table",
      "comment": "Bridge for many-to-many reservations and tables.",
      "layout": {
        "x": 220,
        "y": 660
      },
      "fields": [
        {
          "name": "reservationId",
          "columnName": "reservation_id",
          "type": "string",
          "nullable": false,
          "references": {
            "table": "reservation",
            "column": "reservation_id",
            "onDelete": "CASCADE",
            "onUpdate": "CASCADE"
          }
        },
        {
          "name": "tableId",
          "columnName": "table_id",
          "type": "string",
          "nullable": false,
          "references": {
            "table": "dining_table",
            "column": "table_id",
            "onDelete": "CASCADE",
            "onUpdate": "CASCADE"
          }
        }
      ],
      "indexes": [
        {
          "name": "idx_reservation_table_unique",
          "columns": [
            "reservation_id",
            "table_id"
          ],
          "unique": true
        }
      ]
    },
    {
      "name": "delivery_driver",
      "label": "Delivery Driver",
      "sqlName": "delivery_driver",
      "comment": "Delivery staff responsible for orders.",
      "layout": {
        "x": 200,
        "y": 520
      },
      "fields": [
        {
          "name": "id",
          "columnName": "driver_id",
          "type": "integer",
          "primaryKey": true,
          "nullable": false
        },
        {
          "name": "name",
          "columnName": "driver_name",
          "type": "string",
          "nullable": false,
          "maxLength": 128
        },
        {
          "name": "phone",
          "columnName": "phone",
          "type": "string",
          "nullable": true,
          "maxLength": 32
        },
        {
          "name": "vehicleId",
          "columnName": "vehicle_id",
          "type": "string",
          "nullable": true,
          "maxLength": 128
        },
        {
          "name": "isActive",
          "columnName": "is_active",
          "type": "boolean",
          "nullable": false,
          "defaultValue": true
        }
      ]
    },
    {
      "name": "order_header",
      "label": "Order Header",
      "sqlName": "order_header",
      "comment": "Primary sales order header tied to shifts and tables.",
      "layout": {
        "x": 320,
        "y": 260
      },
      "fields": [
        {
          "name": "id",
          "columnName": "order_id",
          "type": "string",
          "primaryKey": true,
          "nullable": false,
          "maxLength": 64
        },
        {
          "name": "shiftId",
          "columnName": "shift_id",
          "type": "string",
          "nullable": false,
          "references": {
            "table": "pos_shift",
            "column": "shift_id",
            "onDelete": "RESTRICT",
            "onUpdate": "CASCADE"
          }
        },
        {
          "name": "posId",
          "columnName": "pos_id",
          "type": "string",
          "nullable": false,
          "references": {
            "table": "pos_terminal",
            "column": "terminal_id",
            "onDelete": "RESTRICT",
            "onUpdate": "CASCADE"
          }
        },
        {
          "name": "posNumber",
          "columnName": "pos_number",
          "type": "integer",
          "nullable": false
        },
        {
          "name": "orderTypeId",
          "columnName": "order_type_id",
          "type": "string",
          "nullable": false,
          "references": {
            "table": "order_type",
            "column": "order_type_id",
            "onDelete": "RESTRICT",
            "onUpdate": "CASCADE"
          }
        },
        {
          "name": "statusId",
          "columnName": "status_id",
          "type": "string",
          "nullable": false,
          "references": {
            "table": "order_status",
            "column": "status_id",
            "onDelete": "RESTRICT",
            "onUpdate": "CASCADE"
          }
        },
        {
          "name": "stageId",
          "columnName": "stage_id",
          "type": "string",
          "nullable": false,
          "references": {
            "table": "order_stage",
            "column": "stage_id",
            "onDelete": "RESTRICT",
            "onUpdate": "CASCADE"
          }
        },
        {
          "name": "paymentStateId",
          "columnName": "payment_state_id",
          "type": "string",
          "nullable": false,
          "references": {
            "table": "order_payment_state",
            "column": "payment_state_id",
            "onDelete": "RESTRICT",
            "onUpdate": "CASCADE"
          }
        },
        {
          "name": "tableId",
          "columnName": "table_id",
          "type": "string",
          "nullable": true,
          "references": {
            "table": "dining_table",
            "column": "table_id",
            "onDelete": "SET NULL",
            "onUpdate": "CASCADE"
          }
        },
        {
          "name": "customerId",
          "columnName": "customer_id",
          "type": "string",
          "nullable": true,
          "references": {
            "table": "customer_profile",
            "column": "customer_id",
            "onDelete": "SET NULL",
            "onUpdate": "CASCADE"
          }
        },
        {
          "name": "customerAddressId",
          "columnName": "customer_address_id",
          "type": "string",
          "nullable": true,
          "references": {
            "table": "customer_address",
            "column": "address_id",
            "onDelete": "SET NULL",
            "onUpdate": "CASCADE"
          }
        },
        {
          "name": "driverId",
          "columnName": "driver_id",
          "type": "integer",
          "nullable": true,
          "references": {
            "table": "delivery_driver",
            "column": "driver_id",
            "onDelete": "SET NULL",
            "onUpdate": "CASCADE"
          }
        },
        {
          "name": "openedBy",
          "columnName": "opened_by",
          "type": "string",
          "nullable": false,
          "references": {
            "table": "employee",
            "column": "employee_id",
            "onDelete": "RESTRICT",
            "onUpdate": "CASCADE"
          }
        },
        {
          "name": "closedBy",
          "columnName": "closed_by",
          "type": "string",
          "nullable": true,
          "references": {
            "table": "employee",
            "column": "employee_id",
            "onDelete": "SET NULL",
            "onUpdate": "CASCADE"
          }
        },
        {
          "name": "openedAt",
          "columnName": "opened_at",
          "type": "timestamp",
          "nullable": false
        },
        {
          "name": "closedAt",
          "columnName": "closed_at",
          "type": "timestamp",
          "nullable": true
        },
        {
          "name": "guests",
          "columnName": "guests",
          "type": "integer",
          "nullable": false,
          "defaultValue": 1
        },
        {
          "name": "notes",
          "columnName": "notes",
          "type": "json",
          "nullable": false,
          "defaultValue": []
        },
        {
          "name": "subtotal",
          "columnName": "subtotal",
          "type": "decimal",
          "precision": 14,
          "scale": 2,
          "nullable": false,
          "defaultValue": 0
        },
        {
          "name": "discount",
          "columnName": "discount_amount",
          "type": "decimal",
          "precision": 14,
          "scale": 2,
          "nullable": false,
          "defaultValue": 0
        },
        {
          "name": "service",
          "columnName": "service_amount",
          "type": "decimal",
          "precision": 14,
          "scale": 2,
          "nullable": false,
          "defaultValue": 0
        },
        {
          "name": "tax",
          "columnName": "tax_amount",
          "type": "decimal",
          "precision": 14,
          "scale": 2,
          "nullable": false,
          "defaultValue": 0
        },
        {
          "name": "deliveryFee",
          "columnName": "delivery_fee",
          "type": "decimal",
          "precision": 12,
          "scale": 2,
          "nullable": false,
          "defaultValue": 0
        },
        {
          "name": "totalDue",
          "columnName": "total_due",
          "type": "decimal",
          "precision": 14,
          "scale": 2,
          "nullable": false,
          "defaultValue": 0
        },
        {
          "name": "totalPaid",
          "columnName": "total_paid",
          "type": "decimal",
          "precision": 14,
          "scale": 2,
          "nullable": false,
          "defaultValue": 0
        },
        {
          "name": "metadata",
          "columnName": "metadata",
          "type": "json",
          "nullable": false,
          "defaultValue": {}
        }
      ],
      "indexes": [
        {
          "name": "idx_order_header_shift",
          "columns": [
            "shift_id",
            "opened_at"
          ]
        },
        {
          "name": "idx_order_header_customer",
          "columns": [
            "customer_id"
          ]
        }
      ]
    },
    {
      "name": "order_line",
      "label": "Order Line",
      "sqlName": "order_line",
      "comment": "Line items included in orders.",
      "layout": {
        "x": 560,
        "y": 260
      },
      "fields": [
        {
          "name": "id",
          "columnName": "line_id",
          "type": "string",
          "primaryKey": true,
          "nullable": false,
          "maxLength": 64
        },
        {
          "name": "orderId",
          "columnName": "order_id",
          "type": "string",
          "nullable": false,
          "references": {
            "table": "order_header",
            "column": "order_id",
            "onDelete": "CASCADE",
            "onUpdate": "CASCADE"
          }
        },
        {
          "name": "parentLineId",
          "columnName": "parent_line_id",
          "type": "string",
          "nullable": true,
          "references": {
            "table": "order_line",
            "column": "line_id",
            "onDelete": "CASCADE",
            "onUpdate": "CASCADE"
          }
        },
        {
          "name": "itemId",
          "columnName": "item_id",
          "type": "integer",
          "nullable": false,
          "references": {
            "table": "menu_item",
            "column": "item_id",
            "onDelete": "RESTRICT",
            "onUpdate": "CASCADE"
          }
        },
        {
          "name": "kitchenSectionId",
          "columnName": "kitchen_section_id",
          "type": "string",
          "nullable": true,
          "references": {
            "table": "kitchen_section",
            "column": "section_id",
            "onDelete": "SET NULL",
            "onUpdate": "CASCADE"
          }
        },
        {
          "name": "statusId",
          "columnName": "status_id",
          "type": "string",
          "nullable": false,
          "references": {
            "table": "order_line_status",
            "column": "line_status_id",
            "onDelete": "RESTRICT",
            "onUpdate": "CASCADE"
          }
        },
        {
          "name": "quantity",
          "columnName": "quantity",
          "type": "decimal",
          "precision": 10,
          "scale": 3,
          "nullable": false,
          "defaultValue": 1
        },
        {
          "name": "unitPrice",
          "columnName": "unit_price",
          "type": "decimal",
          "precision": 12,
          "scale": 2,
          "nullable": false
        },
        {
          "name": "total",
          "columnName": "total",
          "type": "decimal",
          "precision": 14,
          "scale": 2,
          "nullable": false
        },
        {
          "name": "notes",
          "columnName": "notes",
          "type": "text",
          "nullable": true
        },
        {
          "name": "metadata",
          "columnName": "metadata",
          "type": "json",
          "nullable": false,
          "defaultValue": {}
        }
      ],
      "indexes": [
        {
          "name": "idx_order_line_order",
          "columns": [
            "order_id"
          ]
        }
      ]
    },
    {
      "name": "order_status_log",
      "label": "Order Status Log",
      "sqlName": "order_status_log",
      "comment": "Immutable log of order status transitions.",
      "layout": {
        "x": 440,
        "y": 260
      },
      "fields": [
        {
          "name": "id",
          "columnName": "status_log_id",
          "type": "string",
          "primaryKey": true,
          "nullable": false,
          "maxLength": 96
        },
        {
          "name": "orderId",
          "columnName": "order_id",
          "type": "string",
          "nullable": false,
          "references": {
            "table": "order_header",
            "column": "order_id",
            "onDelete": "CASCADE",
            "onUpdate": "CASCADE"
          }
        },
        {
          "name": "statusId",
          "columnName": "status_id",
          "type": "string",
          "nullable": false,
          "references": {
            "table": "order_status",
            "column": "status_id",
            "onDelete": "RESTRICT",
            "onUpdate": "CASCADE"
          }
        },
        {
          "name": "stageId",
          "columnName": "stage_id",
          "type": "string",
          "nullable": true,
          "references": {
            "table": "order_stage",
            "column": "stage_id",
            "onDelete": "SET NULL",
            "onUpdate": "CASCADE"
          }
        },
        {
          "name": "paymentStateId",
          "columnName": "payment_state_id",
          "type": "string",
          "nullable": true,
          "references": {
            "table": "order_payment_state",
            "column": "payment_state_id",
            "onDelete": "SET NULL",
            "onUpdate": "CASCADE"
          }
        },
        {
          "name": "actorId",
          "columnName": "actor_id",
          "type": "string",
          "nullable": true,
          "references": {
            "table": "employee",
            "column": "employee_id",
            "onDelete": "SET NULL",
            "onUpdate": "CASCADE"
          }
        },
        {
          "name": "source",
          "columnName": "source",
          "type": "string",
          "nullable": true,
          "maxLength": 64
        },
        {
          "name": "reason",
          "columnName": "reason",
          "type": "text",
          "nullable": true
        },
        {
          "name": "metadata",
          "columnName": "metadata",
          "type": "json",
          "nullable": false,
          "defaultValue": {}
        },
        {
          "name": "changedAt",
          "columnName": "changed_at",
          "type": "timestamp",
          "nullable": false
        }
      ],
      "indexes": [
        {
          "name": "idx_order_status_log_order",
          "columns": [
            "order_id",
            "changed_at"
          ]
        },
        {
          "name": "idx_order_status_log_actor",
          "columns": [
            "actor_id",
            "changed_at"
          ]
        }
      ]
    },
    {
      "name": "order_line_status_log",
      "label": "Order Line Status Log",
      "sqlName": "order_line_status_log",
      "comment": "Immutable log of order line transitions.",
      "layout": {
        "x": 680,
        "y": 260
      },
      "fields": [
        {
          "name": "id",
          "columnName": "line_status_log_id",
          "type": "string",
          "primaryKey": true,
          "nullable": false,
          "maxLength": 96
        },
        {
          "name": "orderId",
          "columnName": "order_id",
          "type": "string",
          "nullable": false,
          "references": {
            "table": "order_header",
            "column": "order_id",
            "onDelete": "CASCADE",
            "onUpdate": "CASCADE"
          }
        },
        {
          "name": "orderLineId",
          "columnName": "order_line_id",
          "type": "string",
          "nullable": false,
          "references": {
            "table": "order_line",
            "column": "line_id",
            "onDelete": "CASCADE",
            "onUpdate": "CASCADE"
          }
        },
        {
          "name": "statusId",
          "columnName": "status_id",
          "type": "string",
          "nullable": false,
          "references": {
            "table": "order_line_status",
            "column": "line_status_id",
            "onDelete": "RESTRICT",
            "onUpdate": "CASCADE"
          }
        },
        {
          "name": "stationId",
          "columnName": "station_id",
          "type": "string",
          "nullable": true,
          "references": {
            "table": "kitchen_section",
            "column": "section_id",
            "onDelete": "SET NULL",
            "onUpdate": "CASCADE"
          }
        },
        {
          "name": "actorId",
          "columnName": "actor_id",
          "type": "string",
          "nullable": true,
          "references": {
            "table": "employee",
            "column": "employee_id",
            "onDelete": "SET NULL",
            "onUpdate": "CASCADE"
          }
        },
        {
          "name": "source",
          "columnName": "source",
          "type": "string",
          "nullable": true,
          "maxLength": 64
        },
        {
          "name": "metadata",
          "columnName": "metadata",
          "type": "json",
          "nullable": false,
          "defaultValue": {}
        },
        {
          "name": "changedAt",
          "columnName": "changed_at",
          "type": "timestamp",
          "nullable": false
        }
      ],
      "indexes": [
        {
          "name": "idx_order_line_status_log_line",
          "columns": [
            "order_line_id",
            "changed_at"
          ]
        },
        {
          "name": "idx_order_line_status_log_order",
          "columns": [
            "order_id",
            "changed_at"
          ]
        }
      ]
    },
    {
      "name": "order_line_modifier",
      "label": "Order Line Modifier",
      "sqlName": "order_line_modifier",
      "comment": "Captured modifiers applied to an order line.",
      "layout": {
        "x": 800,
        "y": 420
      },
      "fields": [
        {
          "name": "id",
          "columnName": "line_modifier_id",
          "type": "string",
          "primaryKey": true,
          "nullable": false,
          "maxLength": 64
        },
        {
          "name": "lineId",
          "columnName": "line_id",
          "type": "string",
          "nullable": false,
          "references": {
            "table": "order_line",
            "column": "line_id",
            "onDelete": "CASCADE",
            "onUpdate": "CASCADE"
          }
        },
        {
          "name": "modifierId",
          "columnName": "modifier_id",
          "type": "integer",
          "nullable": false,
          "references": {
            "table": "menu_modifier",
            "column": "modifier_id",
            "onDelete": "RESTRICT",
            "onUpdate": "CASCADE"
          }
        },
        {
          "name": "modifierType",
          "columnName": "modifier_type",
          "type": "string",
          "nullable": false,
          "defaultValue": "add_on"
        },
        {
          "name": "priceChange",
          "columnName": "price_change",
          "type": "decimal",
          "precision": 12,
          "scale": 2,
          "nullable": false,
          "defaultValue": 0
        }
      ],
      "indexes": [
        {
          "name": "idx_order_line_modifier_line",
          "columns": [
            "line_id"
          ]
        }
      ]
    },
    {
      "name": "order_payment",
      "label": "Order Payment",
      "sqlName": "order_payment",
      "comment": "Captured payments for orders.",
      "layout": {
        "x": 320,
        "y": 420
      },
      "fields": [
        {
          "name": "id",
          "columnName": "payment_id",
          "type": "string",
          "primaryKey": true,
          "nullable": false,
          "maxLength": 64
        },
        {
          "name": "orderId",
          "columnName": "order_id",
          "type": "string",
          "nullable": false,
          "references": {
            "table": "order_header",
            "column": "order_id",
            "onDelete": "CASCADE",
            "onUpdate": "CASCADE"
          }
        },
        {
          "name": "shiftId",
          "columnName": "shift_id",
          "type": "string",
          "nullable": false,
          "references": {
            "table": "pos_shift",
            "column": "shift_id",
            "onDelete": "RESTRICT",
            "onUpdate": "CASCADE"
          }
        },
        {
          "name": "paymentMethodId",
          "columnName": "payment_method_id",
          "type": "string",
          "nullable": false,
          "references": {
            "table": "payment_method",
            "column": "payment_method_id",
            "onDelete": "RESTRICT",
            "onUpdate": "CASCADE"
          }
        },
        {
          "name": "amount",
          "columnName": "amount",
          "type": "decimal",
          "precision": 12,
          "scale": 2,
          "nullable": false,
          "defaultValue": 0
        },
        {
          "name": "capturedAt",
          "columnName": "captured_at",
          "type": "timestamp",
          "nullable": false
        },
        {
          "name": "reference",
          "columnName": "reference",
          "type": "string",
          "nullable": true,
          "maxLength": 96
        }
      ],
      "indexes": [
        {
          "name": "idx_order_payment_order",
          "columns": [
            "order_id"
          ]
        },
        {
          "name": "idx_order_payment_shift",
          "columns": [
            "shift_id"
          ]
        }
      ]
    },
    {
      "name": "order_refund",
      "label": "Order Refund",
      "sqlName": "order_refund",
      "comment": "Refunded amounts linked back to original payments.",
      "layout": {
        "x": 560,
        "y": 420
      },
      "fields": [
        {
          "name": "id",
          "columnName": "refund_id",
          "type": "string",
          "primaryKey": true,
          "nullable": false,
          "maxLength": 64
        },
        {
          "name": "paymentId",
          "columnName": "payment_id",
          "type": "string",
          "nullable": false,
          "references": {
            "table": "order_payment",
            "column": "payment_id",
            "onDelete": "CASCADE",
            "onUpdate": "CASCADE"
          }
        },
        {
          "name": "shiftId",
          "columnName": "shift_id",
          "type": "string",
          "nullable": false,
          "references": {
            "table": "pos_shift",
            "column": "shift_id",
            "onDelete": "RESTRICT",
            "onUpdate": "CASCADE"
          }
        },
        {
          "name": "amount",
          "columnName": "amount",
          "type": "decimal",
          "precision": 12,
          "scale": 2,
          "nullable": false,
          "defaultValue": 0
        },
        {
          "name": "reason",
          "columnName": "reason",
          "type": "string",
          "nullable": true,
          "maxLength": 256
        },
        {
          "name": "refundedAt",
          "columnName": "refunded_at",
          "type": "timestamp",
          "nullable": false
        }
      ],
      "indexes": [
        {
          "name": "idx_order_refund_payment",
          "columns": [
            "payment_id"
          ]
        }
      ]
    },
    {
      "name": "order_delivery",
      "label": "Order Delivery",
      "sqlName": "order_delivery",
      "comment": "Delivery routing and status for delivery orders.",
      "layout": {
        "x": 560,
        "y": 520
      },
      "fields": [
        {
          "name": "orderId",
          "columnName": "order_id",
          "type": "string",
          "primaryKey": true,
          "nullable": false,
          "references": {
            "table": "order_header",
            "column": "order_id",
            "onDelete": "CASCADE",
            "onUpdate": "CASCADE"
          }
        },
        {
          "name": "driverId",
          "columnName": "driver_id",
          "type": "integer",
          "nullable": true,
          "references": {
            "table": "delivery_driver",
            "column": "driver_id",
            "onDelete": "SET NULL",
            "onUpdate": "CASCADE"
          }
        },
        {
          "name": "dispatchedAt",
          "columnName": "dispatched_at",
          "type": "timestamp",
          "nullable": true
        },
        {
          "name": "deliveredAt",
          "columnName": "delivered_at",
          "type": "timestamp",
          "nullable": true
        },
        {
          "name": "status",
          "columnName": "status",
          "type": "string",
          "nullable": false,
          "defaultValue": "pending"
        },
        {
          "name": "notes",
          "columnName": "notes",
          "type": "text",
          "nullable": true
        }
      ]
    },
    {
      "name": "audit_event",
      "label": "Audit Event",
      "sqlName": "audit_event",
      "comment": "Actions performed within the POS for traceability.",
      "layout": {
        "x": 320,
        "y": 520
      },
      "fields": [
        {
          "name": "id",
          "columnName": "event_id",
          "type": "string",
          "primaryKey": true,
          "nullable": false,
          "maxLength": 64
        },
        {
          "name": "userId",
          "columnName": "user_id",
          "type": "string",
          "nullable": false,
          "references": {
            "table": "employee",
            "column": "employee_id",
            "onDelete": "SET NULL",
            "onUpdate": "CASCADE"
          }
        },
        {
          "name": "action",
          "columnName": "action",
          "type": "string",
          "nullable": false,
          "maxLength": 96
        },
        {
          "name": "refType",
          "columnName": "ref_type",
          "type": "string",
          "nullable": false,
          "maxLength": 64
        },
        {
          "name": "refId",
          "columnName": "ref_id",
          "type": "string",
          "nullable": true,
          "maxLength": 64
        },
        {
          "name": "occurredAt",
          "columnName": "occurred_at",
          "type": "timestamp",
          "nullable": false
        },
        {
          "name": "meta",
          "columnName": "meta",
          "type": "json",
          "nullable": false,
          "defaultValue": {}
        }
      ]
    }
  ]
},
    kds: {
  "name": "mishkah_kds",
  "version": 1,
  "tables": [
    {
      "name": "kds_station",
      "label": "Kitchen Display Station",
      "sqlName": "kds_station",
      "comment": "Registered KDS stations including prep lines and expo pass.",
      "layout": {
        "x": 80,
        "y": 40
      },
      "fields": [
        {
          "name": "id",
          "columnName": "station_id",
          "type": "string",
          "primaryKey": true,
          "nullable": false,
          "maxLength": 48
        },
        {
          "name": "code",
          "columnName": "station_code",
          "type": "string",
          "nullable": false,
          "unique": true,
          "maxLength": 32
        },
        {
          "name": "nameAr",
          "columnName": "name_ar",
          "type": "string",
          "nullable": false,
          "maxLength": 96
        },
        {
          "name": "nameEn",
          "columnName": "name_en",
          "type": "string",
          "nullable": false,
          "maxLength": 96
        },
        {
          "name": "stationType",
          "columnName": "station_type",
          "type": "string",
          "nullable": false,
          "defaultValue": "prep"
        },
        {
          "name": "isExpo",
          "columnName": "is_expo",
          "type": "boolean",
          "nullable": false,
          "defaultValue": false
        },
        {
          "name": "sequence",
          "columnName": "sequence",
          "type": "integer",
          "nullable": false,
          "defaultValue": 0
        },
        {
          "name": "themeColor",
          "columnName": "theme_color",
          "type": "string",
          "nullable": true,
          "maxLength": 16
        },
        {
          "name": "autoRouteRules",
          "columnName": "auto_route_rules",
          "type": "json",
          "nullable": false,
          "defaultValue": []
        },
        {
          "name": "displayConfig",
          "columnName": "display_config",
          "type": "json",
          "nullable": false,
          "defaultValue": {}
        },
        {
          "name": "createdAt",
          "columnName": "created_at",
          "type": "timestamp",
          "nullable": false
        },
        {
          "name": "updatedAt",
          "columnName": "updated_at",
          "type": "timestamp",
          "nullable": false
        }
      ],
      "indexes": [
        {
          "name": "idx_kds_station_type",
          "columns": [
            "station_type",
            "sequence"
          ]
        }
      ]
    },
    {
      "name": "station_category_route",
      "label": "Station Category Route",
      "sqlName": "station_category_route",
      "comment": "Routing map that assigns menu categories to a specific KDS station.",
      "layout": {
        "x": 240,
        "y": 40
      },
      "fields": [
        {
          "name": "id",
          "columnName": "route_id",
          "type": "string",
          "primaryKey": true,
          "nullable": false,
          "maxLength": 64
        },
        {
          "name": "categoryId",
          "columnName": "category_id",
          "type": "string",
          "nullable": false,
          "maxLength": 64
        },
        {
          "name": "stationId",
          "columnName": "station_id",
          "type": "string",
          "nullable": false,
          "references": {
            "table": "kds_station",
            "column": "station_id",
            "onDelete": "CASCADE",
            "onUpdate": "CASCADE"
          }
        },
        {
          "name": "priority",
          "columnName": "priority",
          "type": "integer",
          "nullable": false,
          "defaultValue": 0
        },
        {
          "name": "isActive",
          "columnName": "is_active",
          "type": "boolean",
          "nullable": false,
          "defaultValue": true
        },
        {
          "name": "createdAt",
          "columnName": "created_at",
          "type": "timestamp",
          "nullable": false
        },
        {
          "name": "updatedAt",
          "columnName": "updated_at",
          "type": "timestamp",
          "nullable": false
        }
      ],
      "indexes": [
        {
          "name": "idx_station_category_route_station",
          "columns": [
            "station_id",
            "is_active"
          ]
        },
        {
          "name": "idx_station_category_route_category",
          "columns": [
            "category_id",
            "priority"
          ]
        }
      ]
    },
    {
      "name": "job_order_header",
      "label": "Job Order Header",
      "sqlName": "job_order_header",
      "comment": "High level ticket per station that is produced by splitting a POS order.",
      "layout": {
        "x": 80,
        "y": 220
      },
      "fields": [
        {
          "name": "id",
          "columnName": "job_order_id",
          "type": "string",
          "primaryKey": true,
          "nullable": false,
          "maxLength": 64
        },
        {
          "name": "orderId",
          "columnName": "order_id",
          "type": "string",
          "nullable": false,
          "maxLength": 64
        },
        {
          "name": "orderNumber",
          "columnName": "order_number",
          "type": "string",
          "nullable": false,
          "maxLength": 32
        },
        {
          "name": "posRevision",
          "columnName": "pos_revision",
          "type": "string",
          "nullable": false,
          "maxLength": 64
        },
        {
          "name": "orderTypeId",
          "columnName": "order_type_id",
          "type": "string",
          "nullable": false,
          "maxLength": 32
        },
        {
          "name": "serviceMode",
          "columnName": "service_mode",
          "type": "string",
          "nullable": false,
          "maxLength": 32
        },
        {
          "name": "stationId",
          "columnName": "station_id",
          "type": "string",
          "nullable": false,
          "references": {
            "table": "kds_station",
            "column": "station_id",
            "onDelete": "RESTRICT",
            "onUpdate": "CASCADE"
          }
        },
        {
          "name": "stationCode",
          "columnName": "station_code",
          "type": "string",
          "nullable": false,
          "maxLength": 32
        },
        {
          "name": "status",
          "columnName": "status",
          "type": "string",
          "nullable": false,
          "defaultValue": "queued"
        },
        {
          "name": "progressState",
          "columnName": "progress_state",
          "type": "string",
          "nullable": false,
          "defaultValue": "awaiting"
        },
        {
          "name": "totalItems",
          "columnName": "total_items",
          "type": "integer",
          "nullable": false,
          "defaultValue": 0
        },
        {
          "name": "completedItems",
          "columnName": "completed_items",
          "type": "integer",
          "nullable": false,
          "defaultValue": 0
        },
        {
          "name": "remainingItems",
          "columnName": "remaining_items",
          "type": "integer",
          "nullable": false,
          "defaultValue": 0
        },
        {
          "name": "hasAlerts",
          "columnName": "has_alerts",
          "type": "boolean",
          "nullable": false,
          "defaultValue": false
        },
        {
          "name": "isExpedite",
          "columnName": "is_expedite",
          "type": "boolean",
          "nullable": false,
          "defaultValue": false
        },
        {
          "name": "tableLabel",
          "columnName": "table_label",
          "type": "string",
          "nullable": true,
          "maxLength": 32
        },
        {
          "name": "customerName",
          "columnName": "customer_name",
          "type": "string",
          "nullable": true,
          "maxLength": 96
        },
        {
          "name": "dueAt",
          "columnName": "due_at",
          "type": "timestamp",
          "nullable": true
        },
        {
          "name": "acceptedAt",
          "columnName": "accepted_at",
          "type": "timestamp",
          "nullable": true
        },
        {
          "name": "startedAt",
          "columnName": "started_at",
          "type": "timestamp",
          "nullable": true
        },
        {
          "name": "readyAt",
          "columnName": "ready_at",
          "type": "timestamp",
          "nullable": true
        },
        {
          "name": "completedAt",
          "columnName": "completed_at",
          "type": "timestamp",
          "nullable": true
        },
        {
          "name": "expoAt",
          "columnName": "expo_at",
          "type": "timestamp",
          "nullable": true
        },
        {
          "name": "syncChecksum",
          "columnName": "sync_checksum",
          "type": "string",
          "nullable": true,
          "maxLength": 96
        },
        {
          "name": "notes",
          "columnName": "notes",
          "type": "text",
          "nullable": true
        },
        {
          "name": "meta",
          "columnName": "meta",
          "type": "json",
          "nullable": false,
          "defaultValue": {}
        },
        {
          "name": "createdAt",
          "columnName": "created_at",
          "type": "timestamp",
          "nullable": false
        },
        {
          "name": "updatedAt",
          "columnName": "updated_at",
          "type": "timestamp",
          "nullable": false
        }
      ],
      "indexes": [
        {
          "name": "idx_job_order_header_station_status",
          "columns": [
            "station_id",
            "status",
            "created_at"
          ]
        },
        {
          "name": "idx_job_order_header_order",
          "columns": [
            "order_id",
            "station_id"
          ]
        }
      ]
    },
    {
      "name": "job_order_detail",
      "label": "Job Order Detail",
      "sqlName": "job_order_detail",
      "comment": "Individual prep lines and items that belong to a station job order.",
      "layout": {
        "x": 320,
        "y": 220
      },
      "fields": [
        {
          "name": "id",
          "columnName": "detail_id",
          "type": "string",
          "primaryKey": true,
          "nullable": false,
          "maxLength": 64
        },
        {
          "name": "jobOrderId",
          "columnName": "job_order_id",
          "type": "string",
          "nullable": false,
          "references": {
            "table": "job_order_header",
            "column": "job_order_id",
            "onDelete": "CASCADE",
            "onUpdate": "CASCADE"
          }
        },
        {
          "name": "orderLineId",
          "columnName": "order_line_id",
          "type": "string",
          "nullable": false,
          "maxLength": 64
        },
        {
          "name": "posLineRevision",
          "columnName": "pos_line_revision",
          "type": "string",
          "nullable": false,
          "maxLength": 64
        },
        {
          "name": "itemId",
          "columnName": "item_id",
          "type": "string",
          "nullable": false,
          "maxLength": 64
        },
        {
          "name": "itemSku",
          "columnName": "item_sku",
          "type": "string",
          "nullable": true,
          "maxLength": 48
        },
        {
          "name": "itemNameAr",
          "columnName": "item_name_ar",
          "type": "string",
          "nullable": false,
          "maxLength": 128
        },
        {
          "name": "itemNameEn",
          "columnName": "item_name_en",
          "type": "string",
          "nullable": false,
          "maxLength": 128
        },
        {
          "name": "categoryId",
          "columnName": "category_id",
          "type": "string",
          "nullable": false,
          "maxLength": 64
        },
        {
          "name": "quantity",
          "columnName": "quantity",
          "type": "decimal",
          "precision": 10,
          "scale": 2,
          "nullable": false,
          "defaultValue": 1
        },
        {
          "name": "unit",
          "columnName": "unit",
          "type": "string",
          "nullable": true,
          "maxLength": 16
        },
        {
          "name": "status",
          "columnName": "status",
          "type": "string",
          "nullable": false,
          "defaultValue": "queued"
        },
        {
          "name": "priority",
          "columnName": "priority",
          "type": "integer",
          "nullable": false,
          "defaultValue": 0
        },
        {
          "name": "prepNotes",
          "columnName": "prep_notes",
          "type": "text",
          "nullable": true
        },
        {
          "name": "allergens",
          "columnName": "allergens",
          "type": "json",
          "nullable": false,
          "defaultValue": []
        },
        {
          "name": "startAt",
          "columnName": "start_at",
          "type": "timestamp",
          "nullable": true
        },
        {
          "name": "finishAt",
          "columnName": "finish_at",
          "type": "timestamp",
          "nullable": true
        },
        {
          "name": "lastActionBy",
          "columnName": "last_action_by",
          "type": "string",
          "nullable": true,
          "maxLength": 64
        },
        {
          "name": "meta",
          "columnName": "meta",
          "type": "json",
          "nullable": false,
          "defaultValue": {}
        },
        {
          "name": "createdAt",
          "columnName": "created_at",
          "type": "timestamp",
          "nullable": false
        },
        {
          "name": "updatedAt",
          "columnName": "updated_at",
          "type": "timestamp",
          "nullable": false
        }
      ],
      "indexes": [
        {
          "name": "idx_job_order_detail_job",
          "columns": [
            "job_order_id",
            "status"
          ]
        },
        {
          "name": "idx_job_order_detail_item",
          "columns": [
            "item_id"
          ]
        }
      ]
    },
    {
      "name": "job_order_detail_modifier",
      "label": "Job Order Detail Modifier",
      "sqlName": "job_order_detail_modifier",
      "comment": "Add-ons, removals and cooking instructions attached to a job order detail line.",
      "layout": {
        "x": 520,
        "y": 220
      },
      "fields": [
        {
          "name": "id",
          "columnName": "modifier_id",
          "type": "string",
          "primaryKey": true,
          "nullable": false,
          "maxLength": 64
        },
        {
          "name": "detailId",
          "columnName": "detail_id",
          "type": "string",
          "nullable": false,
          "references": {
            "table": "job_order_detail",
            "column": "detail_id",
            "onDelete": "CASCADE",
            "onUpdate": "CASCADE"
          }
        },
        {
          "name": "modifierType",
          "columnName": "modifier_type",
          "type": "string",
          "nullable": false,
          "maxLength": 32
        },
        {
          "name": "nameAr",
          "columnName": "name_ar",
          "type": "string",
          "nullable": false,
          "maxLength": 128
        },
        {
          "name": "nameEn",
          "columnName": "name_en",
          "type": "string",
          "nullable": false,
          "maxLength": 128
        },
        {
          "name": "quantity",
          "columnName": "quantity",
          "type": "decimal",
          "precision": 10,
          "scale": 2,
          "nullable": false,
          "defaultValue": 1
        },
        {
          "name": "isRequired",
          "columnName": "is_required",
          "type": "boolean",
          "nullable": false,
          "defaultValue": false
        },
        {
          "name": "notes",
          "columnName": "notes",
          "type": "text",
          "nullable": true
        },
        {
          "name": "meta",
          "columnName": "meta",
          "type": "json",
          "nullable": false,
          "defaultValue": {}
        },
        {
          "name": "createdAt",
          "columnName": "created_at",
          "type": "timestamp",
          "nullable": false
        }
      ],
      "indexes": [
        {
          "name": "idx_job_order_detail_modifier_detail",
          "columns": [
            "detail_id"
          ]
        }
      ]
    },
    {
      "name": "job_order_status_history",
      "label": "Job Order Status History",
      "sqlName": "job_order_status_history",
      "comment": "Chronological history of job order header status transitions.",
      "layout": {
        "x": 80,
        "y": 420
      },
      "fields": [
        {
          "name": "id",
          "columnName": "history_id",
          "type": "string",
          "primaryKey": true,
          "nullable": false,
          "maxLength": 64
        },
        {
          "name": "jobOrderId",
          "columnName": "job_order_id",
          "type": "string",
          "nullable": false,
          "references": {
            "table": "job_order_header",
            "column": "job_order_id",
            "onDelete": "CASCADE",
            "onUpdate": "CASCADE"
          }
        },
        {
          "name": "status",
          "columnName": "status",
          "type": "string",
          "nullable": false,
          "maxLength": 32
        },
        {
          "name": "reason",
          "columnName": "reason",
          "type": "string",
          "nullable": true,
          "maxLength": 256
        },
        {
          "name": "actorId",
          "columnName": "actor_id",
          "type": "string",
          "nullable": true,
          "maxLength": 64
        },
        {
          "name": "actorName",
          "columnName": "actor_name",
          "type": "string",
          "nullable": true,
          "maxLength": 96
        },
        {
          "name": "actorRole",
          "columnName": "actor_role",
          "type": "string",
          "nullable": true,
          "maxLength": 64
        },
        {
          "name": "changedAt",
          "columnName": "changed_at",
          "type": "timestamp",
          "nullable": false
        },
        {
          "name": "meta",
          "columnName": "meta",
          "type": "json",
          "nullable": false,
          "defaultValue": {}
        }
      ],
      "indexes": [
        {
          "name": "idx_job_order_status_history_job",
          "columns": [
            "job_order_id",
            "changed_at"
          ]
        }
      ]
    },
    {
      "name": "expo_pass_ticket",
      "label": "Expo Pass Ticket",
      "sqlName": "expo_pass_ticket",
      "comment": "Aggregate of job orders used by the expeditor hand-off screen.",
      "layout": {
        "x": 320,
        "y": 420
      },
      "fields": [
        {
          "name": "id",
          "columnName": "expo_ticket_id",
          "type": "string",
          "primaryKey": true,
          "nullable": false,
          "maxLength": 64
        },
        {
          "name": "orderId",
          "columnName": "order_id",
          "type": "string",
          "nullable": false,
          "maxLength": 64
        },
        {
          "name": "orderNumber",
          "columnName": "order_number",
          "type": "string",
          "nullable": false,
          "maxLength": 32
        },
        {
          "name": "jobOrderIds",
          "columnName": "job_order_ids",
          "type": "json",
          "nullable": false,
          "defaultValue": []
        },
        {
          "name": "status",
          "columnName": "status",
          "type": "string",
          "nullable": false,
          "defaultValue": "awaiting"
        },
        {
          "name": "readyItems",
          "columnName": "ready_items",
          "type": "integer",
          "nullable": false,
          "defaultValue": 0
        },
        {
          "name": "totalItems",
          "columnName": "total_items",
          "type": "integer",
          "nullable": false,
          "defaultValue": 0
        },
        {
          "name": "holdReason",
          "columnName": "hold_reason",
          "type": "string",
          "nullable": true,
          "maxLength": 256
        },
        {
          "name": "runnerId",
          "columnName": "runner_id",
          "type": "string",
          "nullable": true,
          "maxLength": 64
        },
        {
          "name": "runnerName",
          "columnName": "runner_name",
          "type": "string",
          "nullable": true,
          "maxLength": 96
        },
        {
          "name": "callAt",
          "columnName": "call_at",
          "type": "timestamp",
          "nullable": true
        },
        {
          "name": "deliveredAt",
          "columnName": "delivered_at",
          "type": "timestamp",
          "nullable": true
        },
        {
          "name": "meta",
          "columnName": "meta",
          "type": "json",
          "nullable": false,
          "defaultValue": {}
        },
        {
          "name": "createdAt",
          "columnName": "created_at",
          "type": "timestamp",
          "nullable": false
        },
        {
          "name": "updatedAt",
          "columnName": "updated_at",
          "type": "timestamp",
          "nullable": false
        }
      ],
      "indexes": [
        {
          "name": "idx_expo_pass_ticket_status",
          "columns": [
            "status",
            "created_at"
          ]
        }
      ]
    }
  ]
}
  };

  function createRecordClass(table){
    const parts = String(table.name || '').split(/[_\s-]+/);
    const className = parts.filter(Boolean).map((part)=> part.charAt(0).toUpperCase() + part.slice(1)).join('') || 'SchemaRecord';
    const TableRef = table;
    const DynamicRecord = class {
      constructor(input){
        const record = TableRef.createRecord(input || {});
        Object.assign(this, record);
      }
      static get table(){ return TableRef; }
      static create(input){ return new DynamicRecord(input); }
      update(patch){
        const updated = TableRef.updateRecord(this, patch || {});
        Object.assign(this, updated);
        return this;
      }
      toJSON(){
        const payload = {};
        TableRef.fields.forEach((field)=>{ payload[field.name] = this[field.name]; });
        return payload;
      }
    };
    Object.defineProperty(DynamicRecord, 'name', { value: className });
    return DynamicRecord;
  }

  function buildFieldMetadata(table){
    const metadata = {};
    table.fields.forEach((field)=>{
      metadata[field.name] = {
        columnName: field.columnName,
        type: field.type,
        nullable: field.nullable,
        defaultValue: clone(field.defaultValue),
        maxLength: field.maxLength,
        precision: field.precision,
        scale: field.scale,
        primaryKey: field.primaryKey,
        unique: field.unique,
        index: field.index,
        enum: field.enum ? field.enum.slice() : undefined,
        references: field.references ? {
          table: field.references.table,
          column: field.references.column,
          onDelete: field.references.onDelete,
          onUpdate: field.references.onUpdate
        } : null,
        comment: field.comment || '',
        notes: field.notes || ''
      };
    });
    return metadata;
  }

  function buildSchemaArtifacts(source){
    const registry = source instanceof SchemaRegistry ? source : SchemaRegistry.fromJSON(source || { tables: [] });
    const tables = registry.list();
    const fields = {};
    const factories = {};
    const classes = {};
    tables.forEach((table)=>{
      fields[table.name] = buildFieldMetadata(table);
      const RecordClass = createRecordClass(table);
      classes[table.name] = RecordClass;
      factories[table.name] = {
        table,
        create(data){ return table.createRecord(data || {}); },
        update(current, patch){ return table.updateRecord(current, patch || {}); },
        Class: RecordClass
      };
    });
    return {
      registry,
      definition: registry.toJSON(),
      fields,
      factories,
      classes
    };
  }

  const canonicalSources = {};
  const manifest = {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    schemas: {}
  };

  Object.entries(CANONICAL_SCHEMAS).forEach(([key, definition])=>{
    const artifacts = buildSchemaArtifacts(definition);
    const registry = artifacts.registry;
    const definitionJSON = artifacts.definition;
    const tables = registry.list();
    const canonicalName = definition && definition.name ? definition.name : (definitionJSON.name || key);
    const canonicalVersion = definition && Object.prototype.hasOwnProperty.call(definition, 'version')
      ? definition.version
      : (Object.prototype.hasOwnProperty.call(definitionJSON, 'version') ? definitionJSON.version : null);
    if(!definitionJSON.name && canonicalName){
      definitionJSON.name = canonicalName;
    }
    if(!Object.prototype.hasOwnProperty.call(definitionJSON, 'version')){
      definitionJSON.version = canonicalVersion;
    }
    canonicalSources[key] = {
      id: key,
      name: canonicalName,
      version: canonicalVersion,
      registry,
      definition: definitionJSON,
      artifacts
    };
    manifest.schemas[key] = {
      name: canonicalName,
      version: canonicalVersion,
      tableCount: tables.length,
      tables: tables.map((table)=> table.sqlName || table.name)
    };
  });

  Schema.sources = canonicalSources;
  Schema.manifest = manifest;
  Schema.generateArtifacts = buildSchemaArtifacts;
  Schema.getArtifacts = function(key){
    const entry = canonicalSources[key];
    return entry ? entry.artifacts : null;
  };


  root.schema = Schema;
  const globalTarget = (typeof window !== 'undefined' && window)
    || (typeof globalThis !== 'undefined' && globalThis)
    || this;
  if(globalTarget){
    if(canonicalSources.pos){
      globalTarget.MishkahPOSSchema = canonicalSources.pos.definition;
    }
    if(canonicalSources.kds){
      globalTarget.MishkahKDSSchema = canonicalSources.kds.definition;
    }
    globalTarget.MishkahSchemaManifest = manifest;
    globalTarget.MishkahSchemaManifestPromise = Promise.resolve(manifest);
  }
})(typeof window !== 'undefined' ? window : this);
