import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { buildContentSqlArtifact, SAFE_SQL_STATEMENT_BYTES } from '../tools/content-sql-artifact.mjs';

const SERVICE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROJECT_ROOT = path.resolve(SERVICE_ROOT, '../..');
const BUNDLE_PATH = path.join(PROJECT_ROOT, 'docs/abs-refresh/reports/database-migration-20261017/import-bundle.json');
const MIGRATION_PATH = path.join(SERVICE_ROOT, 'content-migrations/0001_card_content.sql');

function reviewedBundle() {
  return JSON.parse(fs.readFileSync(BUNDLE_PATH, 'utf8'));
}

function createContentDb() {
  const sql = new DatabaseSync(':memory:');
  sql.exec(fs.readFileSync(MIGRATION_PATH, 'utf8'));
  return sql;
}

function applySqlAtomically(sql, contents) {
  sql.exec('BEGIN IMMEDIATE');
  try {
    sql.exec(contents);
    sql.exec('COMMIT');
  } catch (error) {
    sql.exec('ROLLBACK');
    throw error;
  }
}

function databaseRows(sql) {
  return {
    cards: sql.prepare('SELECT * FROM cards ORDER BY id').all(),
    aliases: sql.prepare('SELECT * FROM card_aliases ORDER BY path').all(),
    edges: sql.prepare('SELECT * FROM card_form_links ORDER BY left_id,right_id').all(),
    revisions: sql.prepare('SELECT * FROM card_revisions ORDER BY card_id,revision').all(),
    importRuns: sql.prepare('SELECT * FROM card_import_runs ORDER BY run_id').all(),
    importItems: sql.prepare('SELECT * FROM card_import_items ORDER BY run_id,source_path').all()
  };
}

test('reviewed bundle emits deterministic guarded D1 SQL under per-statement limits', () => {
  const bundle = reviewedBundle();
  const first = buildContentSqlArtifact(bundle);
  const second = buildContentSqlArtifact(bundle);

  assert.equal(first.sql, second.sql);
  assert.deepEqual(first.manifest, second.manifest);
  assert.equal(first.manifest.counts.cards, 14);
  assert.equal(first.manifest.counts.aliases, 64);
  assert.equal(first.manifest.counts.directEdges, 4);
  assert.ok(first.manifest.limits.maxSqlStatementBytes <= SAFE_SQL_STATEMENT_BYTES);
  assert.ok(first.manifest.limits.stagedTextChunks > 0, 'large JSON fields must be staged in bounded literal chunks');
  assert.doesNotMatch(first.sql, /\bBEGIN\s+TRANSACTION\b|\bCOMMIT\s*;/i);
  assert.match(first.sql, /INSERT OR IGNORE INTO cards/);
  assert.doesNotMatch(first.sql, /UPDATE\s+cards\s+SET/i);
});

test('generated SQL imports exact rows, survives an identical rerun, and journals the source run', t => {
  const sql = createContentDb();
  t.after(() => sql.close());
  const bundle = reviewedBundle();
  const artifact = buildContentSqlArtifact(bundle);

  applySqlAtomically(sql, artifact.sql);
  const initial = databaseRows(sql);
  assert.equal(initial.cards.length, bundle.cards.length);
  assert.equal(initial.aliases.length, bundle.aliases.length);
  assert.equal(initial.edges.length, bundle.edges.length);
  assert.equal(initial.revisions.length, 0);
  assert.equal(initial.importRuns.length, 1);
  assert.equal(initial.importRuns[0].run_id, bundle.runId);
  assert.equal(initial.importRuns[0].source_checksum, bundle.sourceChecksum);
  assert.equal(initial.importRuns[0].status, 'applied');
  assert.equal(initial.importItems.length, bundle.cards.length);
  assert.ok(initial.cards.every(card => card.revision === 1));
  for (const source of bundle.cards) {
    const row = initial.cards.find(card => card.id === source.id);
    assert.equal(row.source_checksum, source.sourceChecksum);
    assert.deepEqual(JSON.parse(row.payload_json), source.payload);
    assert.deepEqual(JSON.parse(row.builtin_forms_json), source.builtinForms);
  }

  applySqlAtomically(sql, artifact.sql);
  assert.deepEqual(databaseRows(sql), initial, 'the identical rerun must perform no changes');
});

test('generated SQL preserves SQL-special payload text and refuses an edited target without changing it', t => {
  const sql = createContentDb();
  t.after(() => sql.close());
  const bundle = structuredClone(reviewedBundle());
  const card = bundle.cards[0];
  card.payload.artifactSqlProbe = "(SELECT group_concat( ); -- O'Reilly; semicolon \\ snowman ☃";
  const artifact = buildContentSqlArtifact(bundle);

  applySqlAtomically(sql, artifact.sql);
  const probe = sql.prepare('SELECT payload_json FROM cards WHERE id=?').get(card.id);
  assert.equal(JSON.parse(probe.payload_json).artifactSqlProbe, card.payload.artifactSqlProbe);

  const editedId = card.id;
  sql.prepare('UPDATE cards SET name=? WHERE id=?').run('Direct field edit survives', editedId);
  const beforeRetry = databaseRows(sql);
  assert.throws(() => applySqlAtomically(sql, artifact.sql), /CHECK constraint failed/);
  assert.deepEqual(databaseRows(sql), beforeRetry, 'a rejected rerun must leave all existing rows untouched');
  assert.equal(sql.prepare('SELECT name FROM cards WHERE id=?').get(editedId).name, 'Direct field edit survives');

  sql.prepare('UPDATE cards SET revision=revision+1 WHERE id=?').run(editedId);
  const afterRevisionEdit = databaseRows(sql);
  assert.throws(() => applySqlAtomically(sql, artifact.sql), /CHECK constraint failed/);
  assert.deepEqual(databaseRows(sql), afterRevisionEdit, 'a target with a newer revision must also remain untouched');
});
