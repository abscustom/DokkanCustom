import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertCardId, canonicalLinkPair, normalizeCardInput, validateAliasPath } from '../src/content-domain.mjs';

export const D1_MAX_SQL_STATEMENT_BYTES = 100_000;
export const SAFE_SQL_STATEMENT_BYTES = 90_000;
export const MAX_D1_FILE_BYTES = 5 * 1024 * 1024 * 1024;
const STAGED_TEXT_LITERAL_BYTES = 32_000;
const SERVICE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const byteLength = value => Buffer.byteLength(value, 'utf8');

function sqlLiteral(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) throw new Error('Only safe integer SQL numeric literals are supported.');
    return String(value);
  }
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (typeof value !== 'string') throw new Error('SQL literals must be strings, numbers, booleans, or null.');
  return `CAST(X'${Buffer.from(value, 'utf8').toString('hex')}' AS TEXT)`;
}

function ident(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function jsonText(value, label) {
  const text = JSON.stringify(value);
  if (typeof text !== 'string') throw new Error(`${label} is not serializable JSON.`);
  return text;
}

const sqlExpression = value => ({ __contentSqlExpression: true, value });
const renderSqlValue = value => value && typeof value === 'object' && value.__contentSqlExpression === true
  ? value.value
  : sqlLiteral(value);

function bundleTime(bundle, override) {
  const value = override ?? bundle.generatedAt;
  const milliseconds = typeof value === 'number' ? value : Date.parse(value);
  if (!Number.isFinite(milliseconds)) throw new Error('Bundle generatedAt must be a valid ISO timestamp, or pass --created-at.');
  const seconds = Math.floor(milliseconds > 10_000_000_000 ? milliseconds / 1000 : milliseconds);
  if (!Number.isSafeInteger(seconds) || seconds < 0) throw new Error('Import timestamp is out of range.');
  return seconds;
}

function validatedBundle(source) {
  if (!source || source.schemaVersion !== 1 || source.kind !== 'dokkan-custom-card-content-import' || source.status !== 'ready' ||
      !Array.isArray(source.cards) || !Array.isArray(source.aliases) || !Array.isArray(source.edges)) {
    throw new Error('A ready version-1 card content import bundle is required.');
  }
  if (source.report?.blockers?.length) throw new Error('The import bundle contains blockers.');
  if (typeof source.runId !== 'string' || source.runId.length > 96 || !/^[A-Za-z0-9._-]+$/.test(source.runId) ||
      typeof source.sourceChecksum !== 'string' || !/^[a-f0-9]{64}$/i.test(source.sourceChecksum)) {
    throw new Error('The import bundle run ID or source checksum is invalid.');
  }
  if (!source.cards.length) throw new Error('Refusing to generate an empty content import.');

  const cards = source.cards.map(item => {
    assertCardId(item?.id);
    if (typeof item.sourceChecksum !== 'string' || !/^[a-f0-9]{64}$/i.test(item.sourceChecksum)) {
      throw new Error(`Card ${item.id} has no valid source checksum.`);
    }
    const card = normalizeCardInput(item.id, item);
    card.sourceChecksum = item.sourceChecksum;
    card.sourcePath = typeof item.sourcePath === 'string' && item.sourcePath.length <= 512
      ? item.sourcePath
      : `Custom Cards/${item.id}/card.json`;
    return card;
  }).sort((a, b) => a.id.localeCompare(b.id));
  const cardIds = new Set(cards.map(card => card.id));
  if (cardIds.size !== cards.length) throw new Error('The import bundle contains duplicate card IDs.');

  const aliasOwners = new Map();
  const aliases = source.aliases.map(alias => {
    const path = validateAliasPath(alias?.path);
    const cardId = assertCardId(alias?.cardId);
    const provenance = String(alias?.provenance || 'imported');
    if (provenance.length > 80 || !cardIds.has(cardId)) throw new Error(`Alias ${path} does not resolve to an imported card.`);
    const existing = aliasOwners.get(path);
    if (existing && existing !== cardId) throw new Error(`Alias ${path} resolves to multiple cards.`);
    aliasOwners.set(path, cardId);
    return { path, cardId, provenance };
  }).sort((a, b) => a.path.localeCompare(b.path));
  if (new Set(aliases.map(alias => alias.path)).size !== aliases.length) throw new Error('The import bundle contains a duplicate alias path.');

  const edges = source.edges.map(edge => {
    const [leftId, rightId] = canonicalLinkPair(edge?.leftId, edge?.rightId);
    if (leftId !== edge.leftId || rightId !== edge.rightId || !cardIds.has(leftId) || !cardIds.has(rightId)) {
      throw new Error('Every seed edge must be canonical and point to two imported cards.');
    }
    return { leftId, rightId };
  }).sort((a, b) => a.leftId.localeCompare(b.leftId) || a.rightId.localeCompare(b.rightId));
  if (new Set(edges.map(edge => `${edge.leftId}\u0000${edge.rightId}`)).size !== edges.length) {
    throw new Error('The import bundle contains a duplicate direct edge.');
  }

  for (const card of cards) {
    for (const form of card.builtinForms) {
      if (!form.targetId) continue;
      let pathname;
      try { pathname = new URL(form.link).pathname; }
      catch { throw new Error(`Card ${card.id} contains an invalid authored link.`); }
      if (!cardIds.has(form.targetId)) throw new Error(`Card ${card.id} references a target outside the reviewed import.`);
      if (aliasOwners.get(pathname) !== form.targetId) throw new Error(`Card ${card.id} authored link ${pathname} does not match its stored alias.`);
    }
  }
  if (cards.some(card => card.status !== 'published' && card.status !== 'draft')) {
    throw new Error('The source bundle contains a non-importable card state.');
  }
  return { cards, aliases, edges };
}

function textChunks(value) {
  const characters = Array.from(value);
  if (!characters.length) return [''];
  const chunks = [];
  let current = '';
  let currentBytes = 0;
  for (const character of characters) {
    const nextBytes = byteLength(character);
    if (current && currentBytes + nextBytes > STAGED_TEXT_LITERAL_BYTES) {
      chunks.push(current);
      current = '';
      currentBytes = 0;
    }
    current += character;
    currentBytes += nextBytes;
  }
  if (current) chunks.push(current);
  return chunks;
}

function buildFinalReport(bundle, cards, aliases) {
  const cardResults = cards.map(card => ({
    sourcePath: card.sourcePath,
    cardId: card.id,
    sourceChecksum: card.sourceChecksum,
    result: 'inserted'
  }));
  return {
    ...(bundle.report || {}),
    cardResults,
    skippedEdges: [],
    aliasesAddedOrConfirmed: aliases.length,
    sourceChecksum: bundle.sourceChecksum
  };
}

export function buildContentSqlArtifact(bundle, { createdAt = undefined } = {}) {
  const { cards, aliases, edges } = validatedBundle(bundle);
  const timestamp = bundleTime(bundle, createdAt);
  const finalReport = buildFinalReport(bundle, cards, aliases);
  const reportJson = jsonText(finalReport, 'Import report');
  const stageName = `__abs_seed_${bundle.sourceChecksum.slice(0, 16)}`;
  const guardName = `__abs_guard_${bundle.sourceChecksum.slice(0, 16)}`;
  const statements = [];
  const stagedTextCount = { value: 0 };
  const push = statement => {
    const text = statement.trim().replace(/;?\s*$/, ';');
    const bytes = byteLength(text);
    if (bytes > SAFE_SQL_STATEMENT_BYTES) {
      throw new Error(`Generated SQL statement is ${bytes} bytes; safety limit is ${SAFE_SQL_STATEMENT_BYTES} bytes (D1 limit ${D1_MAX_SQL_STATEMENT_BYTES}).`);
    }
    statements.push(text);
  };
  const stageText = (ownerId, fieldName, value) => {
    const chunks = textChunks(value);
    chunks.forEach((chunk, partIndex) => {
      push(`INSERT INTO ${ident(stageName)} (owner_id,field_name,part_index,chunk_text) VALUES (${sqlLiteral(ownerId)},${sqlLiteral(fieldName)},${partIndex},${sqlLiteral(chunk)})`);
      stagedTextCount.value += 1;
    });
  };
  const fieldSql = (ownerId, fieldName) => sqlExpression(`(SELECT group_concat(chunk_text,'') FROM (SELECT chunk_text FROM ${ident(stageName)} WHERE owner_id=${sqlLiteral(ownerId)} AND field_name=${sqlLiteral(fieldName)} ORDER BY part_index))`);
  const runId = bundle.runId;
  const sourceChecksum = bundle.sourceChecksum.toLowerCase();

  const header = [
    '-- Generated from a reviewed Dokkan Custom Cards import bundle.',
    `-- Run: ${runId}`,
    `-- Source SHA-256: ${sourceChecksum}`,
    '-- Use Wrangler d1 execute --remote --file. D1 imports this complete file atomically; do not add BEGIN/COMMIT.',
    '-- Inserts never update existing content. The guard permits an empty target or a byte-for-byte matching prior seed.'
  ].join('\n');
  push(`CREATE TABLE ${ident(stageName)} (owner_id TEXT NOT NULL,field_name TEXT NOT NULL,part_index INTEGER NOT NULL,chunk_text TEXT NOT NULL,PRIMARY KEY(owner_id,field_name,part_index))`);

  for (const card of cards) {
    stageText(card.id, 'category_names_json', jsonText(card.categoryNames || [], `Card ${card.id} categories`));
    stageText(card.id, 'payload_json', jsonText(card.payload, `Card ${card.id} payload`));
    stageText(card.id, 'builtin_forms_json', jsonText(card.builtinForms || [], `Card ${card.id} built-in forms`));
  }
  stageText(runId, 'report_json', reportJson);

  push(`CREATE TABLE ${ident(guardName)} (ok INTEGER NOT NULL CHECK(ok=1))`);
  const allEmpty = ['cards', 'card_aliases', 'card_form_links', 'card_revisions', 'card_import_runs', 'card_import_items']
    .map(table => `(SELECT COUNT(*) FROM ${ident(table)})=0`).join(' AND ');
  const expectedIds = cards.map(card => sqlLiteral(card.id)).join(',');
  const expectedCardSources = cards.map(card => `(id=${sqlLiteral(card.id)} AND source_checksum=${sqlLiteral(card.sourceChecksum)} AND revision=1)`).join(' OR ');
  const exactSeedSignature = [
    `(SELECT COUNT(*) FROM cards)=${cards.length}`,
    `(SELECT COUNT(*) FROM cards WHERE NOT (${expectedCardSources}))=0`,
    `(SELECT COUNT(*) FROM cards WHERE id NOT IN (${expectedIds}))=0`,
    `(SELECT COUNT(*) FROM card_aliases)=${aliases.length}`,
    `(SELECT COUNT(*) FROM card_form_links)=${edges.length}`,
    '(SELECT COUNT(*) FROM card_revisions)=0',
    '(SELECT COUNT(*) FROM card_import_runs)=1',
    `(SELECT COUNT(*) FROM card_import_runs WHERE run_id=${sqlLiteral(runId)} AND source_checksum=${sqlLiteral(sourceChecksum)} AND status='applied')=1`,
    `(SELECT COUNT(*) FROM card_import_items)=${cards.length}`
  ].join(' AND ');
  push(`INSERT INTO ${ident(guardName)} (ok) SELECT CASE WHEN (${allEmpty}) OR (${exactSeedSignature}) THEN 1 ELSE 0 END`);

  for (const card of cards) {
    const values = [
      card.id, card.slug, card.schemaVersion, card.status, card.name, card.title, card.type, card.rarity,
      card.cardClass || null, card.releaseDate || null, fieldSql(card.id, 'category_names_json'),
      card.cardArtImageUrl || null, card.cardArtVideoUrl || null, card.unitTag || null, card.awakeningMode || null,
      card.thumb || null, card.repoPath, card.assetBase, fieldSql(card.id, 'payload_json'),
      fieldSql(card.id, 'builtin_forms_json'), 1, card.sourceChecksum, timestamp, timestamp
    ].map(renderSqlValue);
    push(`INSERT OR IGNORE INTO cards (id,slug,schema_version,status,name,title,type,rarity,card_class,release_date,category_names_json,card_art_image_url,card_art_video_url,unit_tag,awakening_mode,thumb,repo_path,asset_base,payload_json,builtin_forms_json,revision,source_checksum,created_at,updated_at) VALUES (${values.join(',')})`);
  }

  if (aliases.length) {
    const rows = aliases.map(alias => `(${sqlLiteral(alias.path)},${sqlLiteral(alias.cardId)},${sqlLiteral(alias.provenance)},${timestamp})`);
    push(`INSERT OR IGNORE INTO card_aliases (path,card_id,provenance,created_at) VALUES ${rows.join(',')}`);
  }
  if (edges.length) {
    const rows = edges.map(edge => `(${sqlLiteral(edge.leftId)},${sqlLiteral(edge.rightId)},${timestamp})`);
    push(`INSERT OR IGNORE INTO card_form_links (left_id,right_id,created_at) VALUES ${rows.join(',')}`);
  }

  push(`INSERT OR IGNORE INTO card_import_runs (run_id,source_checksum,status,started_at,finished_at,report_json) VALUES (${sqlLiteral(runId)},${sqlLiteral(sourceChecksum)},'applied',${timestamp},${timestamp},${renderSqlValue(fieldSql(runId, 'report_json'))})`);
  const reportItems = cards.map(card => `(${sqlLiteral(runId)},${sqlLiteral(card.sourcePath)},${sqlLiteral(card.id)},${sqlLiteral(card.sourceChecksum)},'inserted','{}')`);
  push(`INSERT OR IGNORE INTO card_import_items (run_id,source_path,card_id,source_checksum,result,details_json) VALUES ${reportItems.join(',')}`);

  const allCountsMatch = [
    `(SELECT COUNT(*) FROM cards)=${cards.length}`,
    `(SELECT COUNT(*) FROM card_aliases)=${aliases.length}`,
    `(SELECT COUNT(*) FROM card_form_links)=${edges.length}`,
    '(SELECT COUNT(*) FROM card_revisions)=0',
    '(SELECT COUNT(*) FROM card_import_runs)=1',
    `(SELECT COUNT(*) FROM card_import_items)=${cards.length}`
  ].join(' AND ');
  push(`INSERT INTO ${ident(guardName)} (ok) SELECT CASE WHEN ${allCountsMatch} THEN 1 ELSE 0 END`);

  for (const card of cards) {
    const pairs = [
      ['id', card.id], ['slug', card.slug], ['schema_version', card.schemaVersion], ['status', card.status],
      ['name', card.name], ['title', card.title], ['type', card.type], ['rarity', card.rarity],
      ['card_class', card.cardClass || null], ['release_date', card.releaseDate || null],
      ['category_names_json', fieldSql(card.id, 'category_names_json')],
      ['card_art_image_url', card.cardArtImageUrl || null], ['card_art_video_url', card.cardArtVideoUrl || null],
      ['unit_tag', card.unitTag || null], ['awakening_mode', card.awakeningMode || null], ['thumb', card.thumb || null],
      ['repo_path', card.repoPath], ['asset_base', card.assetBase], ['payload_json', fieldSql(card.id, 'payload_json')],
      ['builtin_forms_json', fieldSql(card.id, 'builtin_forms_json')], ['revision', 1],
      ['source_checksum', card.sourceChecksum], ['created_at', timestamp], ['updated_at', timestamp]
    ];
    const expected = pairs.map(([column, value]) => `c.${column} IS ${renderSqlValue(value)}`).join(' AND ');
    push(`INSERT INTO ${ident(guardName)} (ok) SELECT CASE WHEN EXISTS (SELECT 1 FROM cards AS c WHERE ${expected}) THEN 1 ELSE 0 END`);
  }
  for (const alias of aliases) {
    push(`INSERT INTO ${ident(guardName)} (ok) SELECT CASE WHEN EXISTS (SELECT 1 FROM card_aliases WHERE path=${sqlLiteral(alias.path)} AND card_id=${sqlLiteral(alias.cardId)} AND provenance=${sqlLiteral(alias.provenance)} AND created_at=${timestamp}) THEN 1 ELSE 0 END`);
  }
  for (const edge of edges) {
    push(`INSERT INTO ${ident(guardName)} (ok) SELECT CASE WHEN EXISTS (SELECT 1 FROM card_form_links WHERE left_id=${sqlLiteral(edge.leftId)} AND right_id=${sqlLiteral(edge.rightId)} AND created_at=${timestamp}) THEN 1 ELSE 0 END`);
  }
  push(`INSERT INTO ${ident(guardName)} (ok) SELECT CASE WHEN EXISTS (SELECT 1 FROM card_import_runs WHERE run_id=${sqlLiteral(runId)} AND source_checksum=${sqlLiteral(sourceChecksum)} AND status='applied' AND started_at=${timestamp} AND finished_at=${timestamp} AND report_json IS ${renderSqlValue(fieldSql(runId, 'report_json'))}) THEN 1 ELSE 0 END`);
  for (const card of cards) {
    push(`INSERT INTO ${ident(guardName)} (ok) SELECT CASE WHEN EXISTS (SELECT 1 FROM card_import_items WHERE run_id=${sqlLiteral(runId)} AND source_path=${sqlLiteral(card.sourcePath)} AND card_id=${sqlLiteral(card.id)} AND source_checksum=${sqlLiteral(card.sourceChecksum)} AND result='inserted' AND details_json='{}') THEN 1 ELSE 0 END`);
  }
  push(`DROP TABLE ${ident(guardName)}`);
  push(`DROP TABLE ${ident(stageName)}`);

  const sql = `${header}\n\n${statements.join('\n\n')}\n`;
  const sqlBytes = byteLength(sql);
  if (sqlBytes > MAX_D1_FILE_BYTES) throw new Error(`Generated SQL file exceeds D1's ${MAX_D1_FILE_BYTES}-byte import limit.`);
  const manifest = {
    schemaVersion: 1,
    kind: 'dokkan-custom-card-content-d1-seed-artifact',
    runId,
    sourceChecksum,
    importTimestampUtc: new Date(timestamp * 1000).toISOString(),
    targetPolicy: 'Fresh content database or exact unchanged seed from the same import run only.',
    conflictPolicy: 'INSERT OR IGNORE plus post-import assertions; existing rows are never updated. Edited or mismatched targets abort the atomic file import.',
    counts: { cards: cards.length, aliases: aliases.length, directEdges: edges.length, builtinForms: cards.reduce((sum, card) => sum + card.builtinForms.length, 0), revisions: 0, importItems: cards.length },
    limits: {
      maxSqlStatementBytes: Math.max(...statements.map(statement => byteLength(statement))),
      safeStatementBytes: SAFE_SQL_STATEMENT_BYTES,
      d1MaxSqlStatementBytes: D1_MAX_SQL_STATEMENT_BYTES,
      maxBoundParameters: 0,
      stagedTextChunks: stagedTextCount.value,
      sqlFileBytes: sqlBytes,
      d1MaxSqlFileBytes: MAX_D1_FILE_BYTES
    },
    transaction: 'Wrangler D1 SQL-file import; no explicit BEGIN/COMMIT statements.'
  };
  return { sql, manifest, statements: statements.length };
}

function parseArguments(argv) {
  const options = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (key === '--help' || key === '-h') return { help: true, options };
    if (!['--bundle', '--output', '--manifest', '--created-at'].includes(key)) throw new Error(`Unknown argument: ${key}`);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value after ${key}`);
    options.set(key.slice(2), value);
    index += 1;
  }
  return { help: false, options };
}

function required(options, key) {
  const value = options.get(key);
  if (!value) throw new Error(`Missing --${key}`);
  return path.resolve(SERVICE_DIR, value);
}

function writeNewFile(filePath, text) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, text, { flag: 'wx' });
}

async function main() {
  const { help, options } = parseArguments(process.argv.slice(2));
  if (help) {
    process.stdout.write('Generate a guarded, idempotent SQL file for a fresh Cloudflare D1 content database.\n\nUsage:\n  node tools/content-sql-artifact.mjs --bundle FILE --output FILE.sql --manifest FILE.json [--created-at ISO]\n');
    return;
  }
  const bundlePath = required(options, 'bundle');
  const outputPath = required(options, 'output');
  const manifestPath = required(options, 'manifest');
  if (outputPath === manifestPath) throw new Error('SQL output and manifest paths must differ.');
  if (fs.existsSync(outputPath) || fs.existsSync(manifestPath)) throw new Error('Refusing to overwrite an existing SQL artifact or manifest.');
  const bundle = JSON.parse(fs.readFileSync(bundlePath, 'utf8'));
  const artifact = buildContentSqlArtifact(bundle, { createdAt: options.get('created-at') });
  artifact.manifest.artifact = { path: path.relative(process.cwd(), outputPath), sha256: sha256(artifact.sql), bytes: byteLength(artifact.sql), statements: artifact.statements };
  let outputCreated = false;
  let manifestCreated = false;
  try {
    writeNewFile(outputPath, artifact.sql);
    outputCreated = true;
    writeNewFile(manifestPath, `${JSON.stringify(artifact.manifest, null, 2)}\n`);
    manifestCreated = true;
  } catch (error) {
    if (outputCreated && !manifestCreated) fs.unlinkSync(outputPath);
    throw error;
  }
  process.stdout.write(`${JSON.stringify({ generated: true, output: outputPath, manifest: manifestPath, ...artifact.manifest }, null, 2)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    process.stderr.write(`${error?.message || 'D1 content SQL generation failed.'}\n`);
    process.exitCode = 1;
  });
}
