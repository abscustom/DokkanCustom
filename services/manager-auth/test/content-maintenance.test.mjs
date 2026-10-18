import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { DEFAULT_SOURCE_ROOT } from '../src/content-import.mjs';
import { createLocalSqliteBinding } from '../src/local-sqlite-binding.mjs';

const SERVICE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI_PATH = path.join(SERVICE_ROOT, 'tools', 'content-maintenance.mjs');

function runCli(args) {
  const result = spawnSync(process.execPath, [CLI_PATH, ...args], { cwd: SERVICE_ROOT, encoding: 'utf8' });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

test('local SQLite D1 adapter awaits each batch statement and rolls back an intermediate failure', async t => {
  const sql = new DatabaseSync(':memory:');
  t.after(() => sql.close());
  const metrics = {};
  const db = createLocalSqliteBinding(sql, { metrics });
  await db.prepare('CREATE TABLE batch_probe(id INTEGER PRIMARY KEY)').run();
  for (const key of Object.keys(metrics)) metrics[key] = 0;

  await assert.rejects(db.batch([
    db.prepare('INSERT INTO batch_probe(id) VALUES(?)').bind(1),
    db.prepare('INSERT INTO batch_probe(id) VALUES(?)').bind(1),
    db.prepare('INSERT INTO batch_probe(id) VALUES(?)').bind(2)
  ]), /UNIQUE constraint failed/);

  assert.equal(metrics.statementsExecuted, 2, 'the third statement must not execute after the constraint failure');
  assert.equal(metrics.changedRows, 1, 'the first write was attempted before rollback');
  assert.deepEqual((await db.prepare('SELECT id FROM batch_probe ORDER BY id').all()).results, []);
});

test('local maintenance CLI imports, exports, materializes a file fallback and applies rollback', { timeout: 30000 }, t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'card-content-maintenance-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const bundlePath = path.join(root, 'bundle.json');
  const backupPath = path.join(root, 'source-backup');
  const dbPath = path.join(root, 'content.sqlite');
  const exportPath = path.join(root, 'recovery.json');
  const currentSnapshotPath = path.join(root, 'current.json');
  const materializedPath = path.join(root, 'compatibility-recovery');

  const dryRun = runCli(['dry-run', '--source', DEFAULT_SOURCE_ROOT, '--bundle', bundlePath, '--backup-dir', backupPath]);
  assert.equal(dryRun.status, 'ready');
  assert.equal(dryRun.cardCount, 14);
  assert.equal(fs.existsSync(bundlePath), true);
  const firstCardId = JSON.parse(fs.readFileSync(bundlePath, 'utf8')).cards[0].id;
  const sourceJson = fs.readFileSync(path.join(DEFAULT_SOURCE_ROOT, firstCardId, 'card.json'));
  const backupJson = fs.readFileSync(path.join(backupPath, 'Custom Cards', firstCardId, 'card.json'));
  assert.deepEqual(backupJson, sourceJson);
  assert.equal(fs.existsSync(path.join(backupPath, 'source-manifest.json')), true);

  const applied = runCli(['apply', '--db', dbPath, '--bundle', bundlePath]);
  assert.equal(applied.status, 'applied');
  assert.equal(applied.cardResults.length, 14);
  const exported = runCli(['export', '--db', dbPath, '--output', exportPath]);
  assert.equal(exported.exported, true);
  assert.equal(exported.cards, 14);
  const baseline = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
  const edge = baseline.edges.find(item => baseline.cards.some(card => card.id === item.leftId && card.status === 'published') &&
    baseline.cards.some(card => card.id === item.rightId && card.status === 'published'));
  assert.ok(edge, 'fixture should include at least one canonical direct edge');
  const excludedFromEdge = new Set([edge.leftId, edge.rightId]);
  const hiddenCards = baseline.cards.filter(card => !excludedFromEdge.has(card.id)).slice(0, 2);
  assert.equal(hiddenCards.length, 2);

  const sql = new DatabaseSync(dbPath);
  const latestPayload = JSON.parse(sql.prepare('SELECT payload_json FROM cards WHERE id=?').get(edge.leftId).payload_json);
  latestPayload.futureBackupField = { retained: true, revisionNote: 'latest content snapshot' };
  sql.prepare('UPDATE cards SET name=?,payload_json=? WHERE id=?').run('Latest Editor Name', JSON.stringify(latestPayload), edge.leftId);
  sql.prepare("UPDATE cards SET status='archived' WHERE id=?").run(hiddenCards[0].id);
  sql.prepare("UPDATE cards SET status='draft' WHERE id=?").run(hiddenCards[1].id);
  sql.close();

  const latestExport = runCli(['export', '--db', dbPath, '--output', currentSnapshotPath]);
  assert.equal(latestExport.cards, 14);
  const current = JSON.parse(fs.readFileSync(currentSnapshotPath, 'utf8'));
  const materialized = runCli(['materialize', '--snapshot', currentSnapshotPath, '--output-dir', materializedPath]);
  assert.equal(materialized.materialized, true);
  assert.equal(materialized.publishedCards, 12);
  assert.equal(materialized.unavailableCards, 2);
  assert.equal(materialized.aliasCount, current.aliases.length);
  const materializationManifest = JSON.parse(fs.readFileSync(materialized.manifest, 'utf8'));
  assert.deepEqual(materializationManifest.publishedIds, current.cards.filter(card => card.status === 'published').map(card => card.id).sort());
  assert.deepEqual(materializationManifest.unavailableIds, hiddenCards.map(card => card.id).sort());

  const legacyCardPath = path.join(materializedPath, 'Custom Cards', edge.leftId, 'card.json');
  const legacyCard = JSON.parse(fs.readFileSync(legacyCardPath, 'utf8'));
  assert.equal(legacyCard.inputs.nameInput, 'Latest Editor Name');
  assert.deepEqual(legacyCard.futureBackupField, { retained: true, revisionNote: 'latest content snapshot' });
  assert.equal(legacyCard.formsData.filter(form => form.adminLinkedSlug === edge.rightId).length, 1);
  assert.equal(legacyCard.formsData.find(form => form.adminLinkedSlug === edge.rightId).link,
    baseline.cards.find(card => card.id === edge.rightId).assetBase);
  assert.doesNotMatch(JSON.stringify(legacyCard), /data:image\//i);
  const availableIndex = fs.readFileSync(path.join(materializedPath, 'Custom Cards', edge.leftId, 'index.html'), 'utf8');
  assert.match(availableIndex, /\/DokkanCustom\/js\/custom-card-bootstrapper\.js/);
  for (const hidden of hiddenCards) {
    const hiddenPath = path.join(materializedPath, 'Custom Cards', hidden.id);
    const tombstone = JSON.parse(fs.readFileSync(path.join(hiddenPath, 'card.json'), 'utf8'));
    assert.equal(tombstone.status, hidden.id === hiddenCards[0].id ? 'archived' : 'draft');
    assert.equal(tombstone.unavailable, true);
    const unavailableIndex = fs.readFileSync(path.join(hiddenPath, 'index.html'), 'utf8');
    assert.match(unavailableIndex, /Card unavailable/);
    assert.match(unavailableIndex, new RegExp(`<meta name="abs-card-state" content="${tombstone.status}">`));
    assert.doesNotMatch(unavailableIndex, /custom-card-bootstrapper/);
  }
  const historicAlias = current.aliases.find(alias => !alias.path.startsWith('/Custom%20Cards/'));
  assert.ok(historicAlias, 'fixture should include a historic root alias');
  const decodedAlias = decodeURIComponent(historicAlias.path).replace(/^\//, '').replace(/\/$/, '');
  const aliasPieces = decodedAlias.split('/').filter(Boolean);
  if (aliasPieces.at(-1) === 'index.html') aliasPieces.pop();
  const historicPage = path.join(materializedPath, ...aliasPieces, 'index.html');
  assert.equal(fs.existsSync(historicPage), true);

  const repeatedMaterialize = spawnSync(process.execPath, [CLI_PATH, 'materialize', '--snapshot', currentSnapshotPath, '--output-dir', materializedPath], { cwd: SERVICE_ROOT, encoding: 'utf8' });
  assert.equal(repeatedMaterialize.status, 1);
  assert.match(repeatedMaterialize.stderr, /already exists/);

  const preview = runCli(['rollback', '--db', dbPath, '--snapshot', exportPath]);
  assert.equal(preview.preview, true);
  assert.equal(preview.applyFlagRequired, true);
  const rollback = runCli(['rollback', '--db', dbPath, '--snapshot', exportPath, '--apply']);
  assert.equal(rollback.restored, true);
  const check = new DatabaseSync(dbPath);
  assert.notEqual(check.prepare('SELECT name FROM cards WHERE id=?').get(firstCardId).name, 'local-change');
  check.close();
});
