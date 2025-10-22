#!/usr/bin/env node
import { readFile } from 'fs/promises';
import path from 'path';
import process from 'process';
import { fileURLToPath } from 'url';

import { loadLegacySchemas } from '../src/schema/legacy-loader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MANIFEST_PATH = path.resolve(REPO_ROOT, 'schema-manifest.json');
const EXPECTED_MANIFEST_VERSION = '1.0.0';

function summarizeSchema(schema) {
  const tables = Array.isArray(schema.tables)
    ? schema.tables
        .map((entry) => (typeof entry === 'string' ? entry : entry?.name || null))
        .filter(Boolean)
    : [];
  return {
    name: schema.name || null,
    version: schema.version ?? null,
    tables: tables.slice().sort(),
    tableCount: schema.tableCount ?? tables.length
  };
}

function summarizeManifest(manifest) {
  const entries = {};
  const schemas = manifest?.schemas || {};
  for (const [key, schema] of Object.entries(schemas)) {
    entries[key] = summarizeSchema(schema || {});
  }
  return entries;
}

async function readManifest(filePath) {
  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

function diffManifests(expected, actual) {
  const differences = [];
  const expectedKeys = Object.keys(expected).sort();
  const actualKeys = Object.keys(actual).sort();

  for (const key of new Set([...expectedKeys, ...actualKeys])) {
    if (!expected[key]) {
      differences.push({ type: 'unexpected-schema', schema: key });
      continue;
    }
    if (!actual[key]) {
      differences.push({ type: 'missing-schema', schema: key });
      continue;
    }
    const exp = expected[key];
    const act = actual[key];
    if (exp.version !== act.version) {
      differences.push({ type: 'version-mismatch', schema: key, expected: exp.version, actual: act.version });
    }
    const expTables = exp.tables;
    const actTables = Array.isArray(act.tables) ? act.tables.slice().sort() : [];
    if (expTables.length !== actTables.length) {
      differences.push({
        type: 'table-count',
        schema: key,
        expected: expTables.length,
        actual: actTables.length
      });
    }
    for (const table of new Set([...expTables, ...actTables])) {
      if (!expTables.includes(table)) {
        differences.push({ type: 'unexpected-table', schema: key, table });
      } else if (!actTables.includes(table)) {
        differences.push({ type: 'missing-table', schema: key, table });
      }
    }
  }

  return differences;
}

async function main() {
  try {
    const [legacySchemas, manifest] = await Promise.all([
      loadLegacySchemas(),
      readManifest(MANIFEST_PATH)
    ]);
    const expectedSummary = {};
    for (const [key, schema] of Object.entries(legacySchemas)) {
      expectedSummary[key] = summarizeSchema(schema);
    }
    const actualSummary = summarizeManifest(manifest);

    const differences = diffManifests(expectedSummary, actualSummary);
    if (manifest.version !== EXPECTED_MANIFEST_VERSION) {
      differences.push({
        type: 'manifest-version',
        expected: EXPECTED_MANIFEST_VERSION,
        actual: manifest.version
      });
    }
    if (differences.length === 0) {
      console.log('\u2705 schema-manifest.json is in sync with legacy schema sources.');
      process.exit(0);
    }
    console.error('\u274c schema-manifest.json is out of sync:');
    for (const diff of differences) {
      console.error(' -', diff);
    }
    process.exit(1);
  } catch (error) {
    console.error('\u274c failed to verify schema manifest:', error);
    process.exit(1);
  }
}

main();
