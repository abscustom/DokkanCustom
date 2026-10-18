import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { buildContentImportBundle, DEFAULT_SOURCE_ROOT } from '../src/content-import.mjs';
import { applyImportBundle, archiveCard, applyLinkOperations, publicCardDetail, publicCatalog, saveCard } from '../src/content-store.mjs';
import { normalizeCardInput } from '../src/content-domain.mjs';
import { createLocalSqliteBinding, localSqliteStorageBytes } from '../src/local-sqlite-binding.mjs';

const SERVICE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATION_PATH = path.join(SERVICE_DIR, 'content-migrations', '0001_card_content.sql');
const METRIC_KEYS = ['statementsExecuted', 'returnedRows', 'changedRows', 'sqlParameterBytes', 'sqlResultBytes', 'maxBoundParameters', 'maxJsonObjectArguments'];

function resetMetrics(metrics) {
  for (const key of METRIC_KEYS) metrics[key] = 0;
}

function byteLength(value) {
  return Buffer.byteLength(JSON.stringify(value));
}

function revisionsFor(sql, ids) {
  return Object.fromEntries(ids.map(id => [id, Number(sql.prepare('SELECT revision FROM cards WHERE id=?').get(id).revision)]));
}

function findUnlinkedPair(bundle) {
  const ids = bundle.cards.map(card => card.id).sort();
  const linked = new Set(bundle.edges.map(edge => `${edge.leftId}\u0000${edge.rightId}`));
  for (let leftIndex = 0; leftIndex < ids.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < ids.length; rightIndex += 1) {
      if (!linked.has(`${ids[leftIndex]}\u0000${ids[rightIndex]}`)) return [ids[leftIndex], ids[rightIndex]];
    }
  }
  throw new Error('The imported source has no unlinked card pair for the local diagnostic.');
}

function parseArguments(args) {
  const options = { sourceRoot: DEFAULT_SOURCE_ROOT, outputPath: '' };
  for (let index = 0; index < args.length; index += 1) {
    const name = args[index];
    const value = args[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value after ${name}`);
    if (name === '--source') options.sourceRoot = path.resolve(value);
    else if (name === '--output') options.outputPath = path.resolve(value);
    else throw new Error(`Unknown argument: ${name}`);
    index += 1;
  }
  return options;
}

async function main() {
  const { sourceRoot, outputPath } = parseArguments(process.argv.slice(2));
  const bundle = await buildContentImportBundle({ sourceRoot });
  if (bundle.status !== 'ready') throw new Error(`Import source is blocked: ${JSON.stringify(bundle.report.blockers)}`);

  const sql = new DatabaseSync(':memory:');
  try {
    sql.exec(fs.readFileSync(MIGRATION_PATH, 'utf8'));
    const metrics = {};
    const db = createLocalSqliteBinding(sql, { metrics });
    await applyImportBundle(db, bundle, 'local-diagnostics-seed');

    const operations = [];
    const measure = async (name, requestPayload, action, resultRows) => {
      resetMetrics(metrics);
      const storageBytesBefore = localSqliteStorageBytes(sql);
      const result = await action();
      const storageBytesAfter = localSqliteStorageBytes(sql);
      operations.push({
        operation: name,
        statementsExecuted: metrics.statementsExecuted,
        returnedRows: metrics.returnedRows,
        changedRows: metrics.changedRows,
        maxBoundParameters: metrics.maxBoundParameters,
        maxJsonObjectArguments: metrics.maxJsonObjectArguments,
        sqlParameterBytes: metrics.sqlParameterBytes,
        sqlResultBytes: metrics.sqlResultBytes,
        requestPayloadBytes: byteLength(requestPayload),
        responsePayloadBytes: byteLength(result),
        responseRows: resultRows(result),
        sqlitePageBytesBefore: storageBytesBefore,
        sqlitePageBytesAfter: storageBytesAfter,
        sqlitePageBytesDelta: storageBytesAfter - storageBytesBefore
      });
      return result;
    };

    await measure('public catalog', { limit: 50 }, () => publicCatalog(db, { limit: 50 }), result => result.cards.length);
    const sourceCard = bundle.cards.find(card => !bundle.edges.some(edge => edge.leftId === card.id || edge.rightId === card.id)) || bundle.cards[0];
    await measure('public detail', { id: sourceCard.id }, () => publicCardDetail(db, sourceCard.id), result => result ? 1 : 0);

    const maxParticipantIds = Array.from({ length: 24 }, (_, index) => `local-budget-${String(index + 1).padStart(2, '0')}`);
    for (const id of maxParticipantIds) {
      const card = normalizeCardInput(id, {
        status: 'published', name: id, title: id, type: 'agl', rarity: 'SSR',
        repoPath: `Custom Cards/${id}`, assetBase: `https://abscustom.github.io/Custom%20Cards/${id}/`,
        payload: {}, builtinForms: []
      });
      await saveCard(db, id, 0, card, 'local-diagnostics-seed');
    }
    const maxLinkRequest = {
      operations: Array.from({ length: 12 }, (_, index) => ({
        action: 'link', sourceSlug: maxParticipantIds[index * 2], targetSlug: maxParticipantIds[index * 2 + 1]
      })),
      expectedRevisions: Object.fromEntries(maxParticipantIds.map(id => [id, 1]))
    };
    await measure('maximum link batch (12 operations / 24 participants)', maxLinkRequest,
      () => applyLinkOperations(db, maxLinkRequest, 'local-diagnostics'), result => result.cards.length);

    const editedName = `${sourceCard.name} [local diagnostic]`;
    const editedPayload = {
      ...sourceCard.payload,
      inputs: { ...(sourceCard.payload.inputs || {}), nameInput: editedName }
    };
    const saveCardInput = normalizeCardInput(sourceCard.id, { ...sourceCard, name: editedName, payload: editedPayload });
    const saveRequest = { expectedRevision: 1, card: saveCardInput };
    const saved = await measure('save card', saveRequest,
      () => saveCard(db, sourceCard.id, 1, saveCardInput, 'local-diagnostics'), () => 1);

    const pair = findUnlinkedPair(bundle);
    const expectedRevisions = revisionsFor(sql, pair);
    const linkRequest = { operations: [{ action: 'link', sourceSlug: pair[0], targetSlug: pair[1] }], expectedRevisions };
    await measure('link cards', linkRequest,
      () => applyLinkOperations(db, linkRequest, 'local-diagnostics'), result => result.cards.length);

    const archiveExpectedRevision = Number(sql.prepare('SELECT revision FROM cards WHERE id=?').get(pair[0]).revision);
    await measure('archive card', { expectedRevision: archiveExpectedRevision },
      () => archiveCard(db, pair[0], archiveExpectedRevision, 'local-diagnostics'), result => result.cards.length);

    const report = {
      kind: 'local-sqlite-content-diagnostics',
      scope: 'Local in-memory SQLite diagnostic only; these counts are not Cloudflare D1 billed rows, CPU usage, or a production estimate.',
      sourceChecksum: bundle.sourceChecksum,
      importedCards: bundle.cards.length,
      operations,
      finalSqlitePageBytes: localSqliteStorageBytes(sql),
      savedCardId: saved.card.id,
      linkedCardIds: pair,
      maximumLinkParticipantIds: maxParticipantIds
    };
    const output = `${JSON.stringify(report, null, 2)}\n`;
    if (outputPath) fs.writeFileSync(outputPath, output, { flag: 'wx' });
    process.stdout.write(output);
  } finally {
    sql.close();
  }
}

main().catch(error => {
  process.stderr.write(`${error?.message || 'Local content diagnostic failed.'}\n`);
  process.exitCode = 1;
});
