import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { applyImportBundle, exportContentSnapshot, restoreContentSnapshot } from '../src/content-store.mjs';
import { materializeContentSnapshot } from '../src/content-materialize.mjs';
import { buildContentImportBundle, copySourceBackups, DEFAULT_SOURCE_ROOT } from '../src/content-import.mjs';
import { createLocalSqliteBinding } from '../src/local-sqlite-binding.mjs';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const MIGRATION_PATH = path.resolve(MODULE_DIR, '../content-migrations/0001_card_content.sql');

function usage() {
  return `Local card-content maintenance (SQLite only; no Cloudflare/D1 connection)

Commands:
  dry-run [--source DIR] [--bundle FILE] [--backup-dir DIR]
  apply --db FILE --bundle FILE
  export --db FILE --output FILE
  materialize --snapshot FILE --output-dir NEW_DIR
  rollback --db FILE --snapshot FILE [--apply]

The dry-run is read-only unless --bundle or --backup-dir is supplied. Apply,
export, and rollback operate only on the local SQLite file passed with --db.
Rollback previews the replacement counts by default; --apply restores the
complete exported content snapshot in one SQLite transaction. Materialize
writes a file-reader-compatible snapshot into a new local directory and never
overwrites an existing directory.
`;
}

function argumentsFrom(argv) {
  const [command, ...rest] = argv;
  const options = new Map();
  for (let index = 0; index < rest.length; index += 1) {
    const key = rest[index];
    if (key === '--help' || key === '-h') return { command: 'help', options };
    if (!key.startsWith('--')) throw new Error(`Unexpected argument: ${key}`);
    if (key === '--apply') { options.set('apply', true); continue; }
    const value = rest[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value after ${key}`);
    options.set(key.slice(2), value);
    index += 1;
  }
  return { command, options };
}

function required(options, key) {
  const value = options.get(key);
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Missing --${key}`);
  return path.resolve(value);
}

function writeNewJson(filePath, value) {
  const absolute = path.resolve(filePath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
  return absolute;
}

function openLocalContentDb(filePath, { initialize = true } = {}) {
  const absolute = path.resolve(filePath);
  if (!initialize && !fs.existsSync(absolute)) throw new Error(`Local content database not found: ${absolute}`);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  const sql = new DatabaseSync(absolute);
  if (initialize) sql.exec(fs.readFileSync(MIGRATION_PATH, 'utf8'));
  else if (!sql.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='cards'").get()) {
    sql.close();
    throw new Error(`The SQLite file does not contain a card-content schema: ${absolute}`);
  }
  return { sql, db: createLocalSqliteBinding(sql), path: absolute };
}

async function main() {
  const { command, options } = argumentsFrom(process.argv.slice(2));
  if (!command || command === 'help') { process.stdout.write(usage()); return; }

  if (command === 'dry-run') {
    const sourceRoot = options.has('source') ? path.resolve(options.get('source')) : DEFAULT_SOURCE_ROOT;
    const bundle = await buildContentImportBundle({ sourceRoot });
    if (options.has('bundle')) writeNewJson(options.get('bundle'), bundle);
    const backupDirectory = options.has('backup-dir')
      ? copySourceBackups(bundle, sourceRoot, options.get('backup-dir'))
      : null;
    const summary = {
      kind: bundle.kind,
      runId: bundle.runId,
      sourceRoot: bundle.sourceRoot,
      sourceChecksum: bundle.sourceChecksum,
      status: bundle.status,
      cardCount: bundle.report.cardCount,
      importableCount: bundle.report.importableCount,
      aliasCount: bundle.report.aliasCount,
      directEdgeCount: bundle.report.directEdgeCount,
      builtinFormCount: bundle.report.builtinFormCount,
      media: bundle.report.media,
      unresolvedReferences: bundle.report.unresolvedReferences,
      unresolvedAliases: bundle.report.unresolvedAliases,
      asymmetricEdges: bundle.report.asymmetricEdges,
      blockers: bundle.report.blockers,
      warnings: bundle.report.warnings,
      sourceBackupDirectory: backupDirectory,
      bundleFile: options.has('bundle') ? path.resolve(options.get('bundle')) : null
    };
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    if (bundle.status !== 'ready') process.exitCode = 2;
    return;
  }

  if (command === 'apply') {
    const dbFile = required(options, 'db');
    const bundleFile = required(options, 'bundle');
    const bundle = JSON.parse(fs.readFileSync(bundleFile, 'utf8'));
    const local = openLocalContentDb(dbFile);
    try {
      process.stdout.write(`${JSON.stringify(await applyImportBundle(local.db, bundle), null, 2)}\n`);
    } finally { local.sql.close(); }
    return;
  }

  if (command === 'export') {
    const local = openLocalContentDb(required(options, 'db'), { initialize: false });
    try {
      const snapshot = await exportContentSnapshot(local.db);
      const output = writeNewJson(required(options, 'output'), snapshot);
      process.stdout.write(`${JSON.stringify({ exported: true, output, cards: snapshot.cards.length, aliases: snapshot.aliases.length, edges: snapshot.edges.length }, null, 2)}\n`);
    } finally { local.sql.close(); }
    return;
  }

  if (command === 'materialize') {
    const snapshot = JSON.parse(fs.readFileSync(required(options, 'snapshot'), 'utf8'));
    const result = materializeContentSnapshot(snapshot, required(options, 'output-dir'));
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  if (command === 'rollback') {
    const dbFile = required(options, 'db');
    const snapshotFile = required(options, 'snapshot');
    const snapshot = JSON.parse(fs.readFileSync(snapshotFile, 'utf8'));
    const local = openLocalContentDb(dbFile, { initialize: false });
    try {
      if (!options.has('apply')) {
        const current = await exportContentSnapshot(local.db);
        process.stdout.write(`${JSON.stringify({
          preview: true,
          current: { cards: current.cards.length, aliases: current.aliases.length, edges: current.edges.length },
          restore: { cards: snapshot.cards?.length || 0, aliases: snapshot.aliases?.length || 0, edges: snapshot.edges?.length || 0 },
          snapshot: path.resolve(snapshotFile),
          database: local.path,
          applyFlagRequired: true
        }, null, 2)}\n`);
        return;
      }
      process.stdout.write(`${JSON.stringify(await restoreContentSnapshot(local.db, snapshot), null, 2)}\n`);
    } finally { local.sql.close(); }
    return;
  }

  throw new Error(`Unknown command: ${command}\n\n${usage()}`);
}

main().catch(error => {
  process.stderr.write(`${error?.message || 'Card-content maintenance failed.'}\n`);
  process.exitCode = 1;
});
