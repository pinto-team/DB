const fs = require('fs');
const path = require('path');

const schemasDir = path.join(__dirname, '..', 'schemas');

function loadSchemas(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      files.push(...loadSchemas(path.join(dir, entry.name)));
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      files.push(path.join(dir, entry.name));
    }
  }
  return files;
}

function normalizeColumnList(columns) {
  if (!Array.isArray(columns)) {
    return [];
  }
  return columns
    .map((entry) => {
      if (typeof entry === 'string') {
        return entry;
      }
      if (entry && typeof entry === 'object' && typeof entry.column === 'string') {
        return entry.column;
      }
      return null;
    })
    .filter((value) => typeof value === 'string');
}

function filterPlainColumns(columns) {
  return normalizeColumnList(columns).filter((column) => /^[a-z_][a-z0-9_]*$/i.test(column));
}

const schemaFiles = loadSchemas(schemasDir);

const tables = new Map();
const errors = [];

for (const file of schemaFiles) {
  let schema;
  try {
    const content = fs.readFileSync(file, 'utf8');
    schema = JSON.parse(content);
  } catch (err) {
    errors.push(`Failed to parse ${path.relative(process.cwd(), file)}: ${err.message}`);
    continue;
  }

  const tableName = schema?.['x-pg']?.table;
  if (!tableName) {
    continue;
  }

  const columns = new Set(Object.keys(schema.properties || {}));
  const info = {
    file,
    schema,
    columns,
    foreignKeys: schema['x-pg']?.foreignKeys || [],
    uniques: schema['x-pg']?.unique || [],
    indexes: schema['x-pg']?.indexes || [],
    primaryKey: schema['x-pg']?.primaryKey || [],
  };

  if (tables.has(tableName)) {
    const existing = tables.get(tableName);
    const currentPath = path.relative(process.cwd(), file);
    const existingPath = path.relative(process.cwd(), existing.file);
    errors.push(`Duplicate table definition for "${tableName}" in ${currentPath} and ${existingPath}`);
  } else {
    tables.set(tableName, info);
  }
}

function ensureColumnsExist(tableInfo, columnList, context) {
  const candidateColumns = filterPlainColumns(columnList);
  const missing = candidateColumns.filter((col) => !tableInfo.columns.has(col));
  if (missing.length > 0) {
    const filePath = path.relative(process.cwd(), tableInfo.file);
    errors.push(`${context}: columns [${missing.join(', ')}] are not defined in ${filePath}`);
  }
}

for (const [tableName, info] of tables) {
  if (info.primaryKey && info.primaryKey.length > 0) {
    ensureColumnsExist(info, info.primaryKey, `Primary key on table ${tableName}`);
  }

  for (const unique of info.uniques) {
    ensureColumnsExist(info, unique.columns, `Unique constraint ${unique.name || ''} on table ${tableName}`);
  }

  for (const index of info.indexes) {
    ensureColumnsExist(info, index.columns, `Index ${index.name || ''} on table ${tableName}`);
  }

  for (const fk of info.foreignKeys) {
    ensureColumnsExist(info, fk.columns, `Foreign key on table ${tableName}`);

    const refTableName = fk.references?.table;
    if (!refTableName) {
      const filePath = path.relative(process.cwd(), info.file);
      errors.push(`Foreign key on table ${tableName} in ${filePath} is missing referenced table`);
      continue;
    }
    const referenced = tables.get(refTableName);
    if (!referenced) {
      const filePath = path.relative(process.cwd(), info.file);
      errors.push(`Foreign key on table ${tableName} in ${filePath} references unknown table "${refTableName}"`);
      continue;
    }

    const refColumns = fk.references?.columns;
    if (!refColumns || refColumns.length === 0) {
      const filePath = path.relative(process.cwd(), info.file);
      errors.push(`Foreign key on table ${tableName} in ${filePath} is missing referenced columns`);
      continue;
    }

    ensureColumnsExist(referenced, refColumns, `Foreign key from ${tableName} to ${refTableName}`);
  }
}

if (errors.length > 0) {
  console.error('Schema validation failed with the following issues:');
  for (const err of errors) {
    console.error(` - ${err}`);
  }
  process.exitCode = 1;
} else {
  console.log('All schemas passed validation.');
}
