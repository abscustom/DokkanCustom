// Validates the generated seed SQL on local workerd/Miniflare D1 only.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { buildContentSqlArtifact } from '../tools/content-sql-artifact.mjs';

const SERVICE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROJECT_ROOT = path.resolve(SERVICE_ROOT, '../..');
const bundle = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'docs/abs-refresh/reports/database-migration-20261017/import-bundle.json'), 'utf8'));
const artifact = buildContentSqlArtifact(bundle);
const executableSql = artifact.sql.slice(artifact.sql.indexOf('CREATE TABLE'));
const schema = fs.readFileSync(path.join(SERVICE_ROOT, 'content-migrations/0001_card_content.sql'), 'utf8')
    .replace(/^\s*PRAGMA\s+foreign_keys\s*=\s*ON\s*;\s*/gim, '')
    .replace(/--[^\n]*/g, '')
    .replace(/\s+/g, ' ');
const mf = new Miniflare(convertV4MiniflareOptions({
    workers: [{
        name: 'content-sql-artifact-proof',
        modules: true,
        script: 'export default { fetch() { return new Response("ok"); } };',
        compatibilityDate: '2026-10-16',
        d1Databases: ['CONTENT_DB']
    }]
}));

try {
    const db = await mf.getD1Database('CONTENT_DB');
    await db.exec(schema);
    await db.exec(executableSql);

    const cards = await db.prepare('SELECT id,revision,source_checksum,payload_json FROM cards ORDER BY id').all();
    const aliases = await db.prepare('SELECT COUNT(*) AS count FROM card_aliases').first();
    const edges = await db.prepare('SELECT COUNT(*) AS count FROM card_form_links').first();
    const run = await db.prepare('SELECT run_id,source_checksum,status FROM card_import_runs').first();
    const items = await db.prepare('SELECT COUNT(*) AS count FROM card_import_items').first();
    assert.equal(cards.results.length, bundle.cards.length);
    assert.equal(aliases.count, bundle.aliases.length);
    assert.equal(edges.count, bundle.edges.length);
    assert.equal(items.count, bundle.cards.length);
    assert.equal(run.run_id, bundle.runId);
    assert.equal(run.source_checksum, bundle.sourceChecksum);
    assert.equal(run.status, 'applied');
    assert.ok(cards.results.every(row => row.revision === 1));

    await db.exec(executableSql);
    await db.prepare('UPDATE cards SET name=?,revision=revision+1 WHERE id=?').bind('edited', cards.results[0].id).run();
    const editedBeforeRetry = await db.prepare('SELECT name,revision FROM cards WHERE id=?').bind(cards.results[0].id).first();
    await assert.rejects(db.exec(executableSql), /CHECK constraint failed/i);
    const editedAfterRetry = await db.prepare('SELECT name,revision FROM cards WHERE id=?').bind(cards.results[0].id).first();
    assert.deepEqual(editedAfterRetry, editedBeforeRetry);

    console.log(JSON.stringify({
        runtime: 'local workerd/Miniflare D1',
        artifactStatements: artifact.statements,
        maxStatementBytes: artifact.manifest.limits.maxSqlStatementBytes,
        maxBoundParameters: artifact.manifest.limits.maxBoundParameters,
        importedCards: cards.results.length,
        aliases: aliases.count,
        directEdges: edges.count,
        exactRerun: true,
        editedTargetRefusedWithoutOverwrite: true,
        deployment: false,
        externalRequests: 0
    }, null, 2));
} finally {
    await mf.dispose();
}
