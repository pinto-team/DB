const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const schemasDir = path.join(__dirname, '..', 'schemas');
const outputFile = path.join(__dirname, '..', 'data', 'data.json');

function loadSchemaFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...loadSchemaFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      files.push(fullPath);
    }
  }
  return files;
}

function resolveType(schema) {
  if (!schema || schema.type === undefined) {
    return undefined;
  }
  const { type } = schema;
  if (Array.isArray(type)) {
    return type.find((value) => value !== 'null') || type[0];
  }
  return type;
}

function sampleUuid(tableName, propertyName) {
  const hash = crypto.createHash('md5').update(`${tableName}.${propertyName}`).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

function clampString(value, schema) {
  let result = value;
  if (schema.maxLength && result.length > schema.maxLength) {
    result = result.slice(0, schema.maxLength);
  }
  if (schema.minLength && result.length < schema.minLength) {
    result = result.padEnd(schema.minLength, 'x');
  }
  return result;
}

function sampleString(tableName, propertyName, schema = {}) {
  if (schema.default && typeof schema.default === 'string') {
    return schema.default;
  }
  if (schema.const && typeof schema.const === 'string') {
    return schema.const;
  }
  if (Array.isArray(schema.enum)) {
    const candidate = schema.enum.find((value) => value !== null && value !== undefined);
    if (candidate !== undefined) {
      return candidate;
    }
    return schema.enum[0];
  }

  if (schema.pattern) {
    if (/\^[A-Z]{3}\$/.test(schema.pattern)) {
      return 'USD';
    }
    if (/\^[A-Z]{2}\$/.test(schema.pattern)) {
      return 'US';
    }
    if (/slug/.test(propertyName)) {
      return 'sample-slug';
    }
  }

  if (/timezone/.test(propertyName)) {
    return 'Asia/Tehran';
  }

  switch (schema.format) {
    case 'uuid':
      return sampleUuid(tableName, propertyName);
    case 'email':
      return 'sample@example.com';
    case 'uri':
    case 'url':
      return 'https://example.com';
    case 'date-time':
      return '2024-01-01T00:00:00Z';
    case 'date':
      return '2024-01-01';
    case 'time':
      return '12:00:00';
    case 'phone':
      return '+989121234567';
    default:
      break;
  }

  if (propertyName.endsWith('_id')) {
    return sampleUuid(tableName, propertyName);
  }

  if (/currency/i.test(propertyName)) {
    return 'IRR';
  }
  if (/country_code/.test(propertyName)) {
    return 'IR';
  }

  const base = propertyName
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
  const value = `${base} Sample`;
  return clampString(value, schema);
}

function sampleNumber(schema = {}) {
  if (schema.default && typeof schema.default === 'number') {
    return schema.default;
  }
  if (schema.minimum !== undefined && schema.maximum !== undefined) {
    return (schema.minimum + schema.maximum) / 2;
  }
  if (schema.minimum !== undefined) {
    return schema.minimum;
  }
  if (schema.exclusiveMinimum !== undefined) {
    return schema.exclusiveMinimum + 1;
  }
  if (schema.maximum !== undefined) {
    return schema.maximum;
  }
  return 1;
}

function sampleInteger(schema = {}) {
  if (schema.default && Number.isInteger(schema.default)) {
    return schema.default;
  }
  if (schema.minimum !== undefined && schema.maximum !== undefined) {
    return Math.round((schema.minimum + schema.maximum) / 2);
  }
  if (schema.minimum !== undefined) {
    return Math.ceil(schema.minimum);
  }
  if (schema.exclusiveMinimum !== undefined) {
    return Math.ceil(schema.exclusiveMinimum + 1);
  }
  if (schema.maximum !== undefined) {
    return Math.floor(schema.maximum);
  }
  return 1;
}

function sampleBoolean(schema = {}) {
  if (typeof schema.default === 'boolean') {
    return schema.default;
  }
  return true;
}

function sampleArray(tableName, propertyName, schema = {}) {
  const itemsSchema = Array.isArray(schema.items) ? schema.items[0] : schema.items;
  if (!itemsSchema) {
    return [];
  }
  const itemValue = generateSampleValue(tableName, `${propertyName}_item`, itemsSchema);
  const minItems = schema.minItems || 0;
  const length = Math.max(1, minItems);
  return Array.from({ length }, () => (itemValue && typeof itemValue === 'object' ? JSON.parse(JSON.stringify(itemValue)) : itemValue));
}

function sampleAdditionalProperty(tableName, propertyName, schema) {
  if (!schema) {
    return 'sample';
  }
  return generateSampleValue(tableName, `${propertyName}_value`, schema);
}

function sampleObject(tableName, propertyName, schema = {}) {
  const result = {};
  if (schema.properties) {
    for (const [key, valueSchema] of Object.entries(schema.properties)) {
      result[key] = generateSampleValue(tableName, key, valueSchema);
    }
  }
  if (schema.additionalProperties) {
    result.additional_example = sampleAdditionalProperty(
      tableName,
      propertyName,
      schema.additionalProperties
    );
  }
  return result;
}

function generateSampleValue(tableName, propertyName, schema = {}) {
  if (!schema) {
    return null;
  }
  if (schema.example !== undefined) {
    return schema.example;
  }
  const resolvedType = resolveType(schema);
  switch (resolvedType) {
    case 'string':
      return sampleString(tableName, propertyName, schema);
    case 'integer':
      return sampleInteger(schema);
    case 'number':
      return sampleNumber(schema);
    case 'boolean':
      return sampleBoolean(schema);
    case 'array':
      return sampleArray(tableName, propertyName, schema);
    case 'object':
      return sampleObject(tableName, propertyName, schema);
    case 'null':
      return null;
    default:
      if (Array.isArray(schema.enum)) {
        return schema.enum[0];
      }
      return null;
  }
}

function buildSampleRow(tableName, schema) {
  const result = {};
  const properties = schema.properties || {};
  for (const [propertyName, propertySchema] of Object.entries(properties)) {
    result[propertyName] = generateSampleValue(tableName, propertyName, propertySchema);
  }
  return result;
}

function main() {
  const schemaFiles = loadSchemaFiles(schemasDir);
  const tableSamples = {};

  for (const file of schemaFiles) {
    const raw = fs.readFileSync(file, 'utf8');
    const schema = JSON.parse(raw);
    const tableName = schema?.['x-pg']?.table;
    if (!tableName) {
      continue;
    }
    tableSamples[tableName] = [buildSampleRow(tableName, schema)];
  }

  const sortedEntries = Object.entries(tableSamples).sort(([a], [b]) => a.localeCompare(b));
  const sortedObject = Object.fromEntries(sortedEntries);

  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, `${JSON.stringify(sortedObject, null, 2)}\n`);
  console.log(`Generated sample data for ${sortedEntries.length} tables at ${path.relative(process.cwd(), outputFile)}`);
}

main();
