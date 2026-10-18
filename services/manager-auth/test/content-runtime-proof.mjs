// Cloudflare workerd, isolated D1 bindings, imported card content, and store mutations only.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { buildContentImportBundle, DEFAULT_SOURCE_ROOT } from '../src/content-import.mjs';
import {
    applyImportBundle,
    applyLinkOperations,
    archiveCard,
    saveCard
} from '../src/content-store.mjs';

const workerOrigin = 'https://abs-manager-auth.trashullu.workers.dev';
const siteOrigin = 'https://abscustom.github.io';
const workerEntry = new URL('../src/worker.mjs', import.meta.url).pathname.replace(/^\/(?=[A-Z]:)/, '');
const bundled = await build({
    entryPoints: [workerEntry],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'neutral',
    mainFields: ['module', 'main'],
    target: 'es2022',
    external: ['node:buffer']
});

const blockedOutboundRequests = [];
const mf = new Miniflare(convertV4MiniflareOptions({
    workers: [{
        name: 'manager-content-runtime',
        modules: true,
        script: bundled.outputFiles[0].text,
        compatibilityDate: '2026-10-16',
        compatibilityFlags: ['nodejs_compat'],
        d1Databases: ['DB', 'CONTENT_DB'],
        durableObjects: { MANAGER_SERVICE: { className: 'ManagerService', useSQLite: true } },
        bindings: {
            MANAGER_ORIGIN: workerOrigin,
            GITHUB_CLIENT_ID: 'fixture-app',
            GITHUB_CLIENT_SECRET: 'synthetic-client-secret',
            GITHUB_REPOSITORY_ID: '123',
            ADMIN_USER_IDS: '7',
            DELETE_USER_IDS: '7',
            CONTENT_WRITES_ENABLED: 'true'
        },
        outboundService(request) {
            blockedOutboundRequests.push(request?.url || 'unknown');
            throw new Error('External requests are forbidden in this runtime proof');
        }
    }]
}));

async function migration(database, filename) {
    const source = await fs.readFile(new URL(`../${filename}`, import.meta.url), 'utf8');
    const sql = source
        .replace(/^\s*PRAGMA\s+foreign_keys\s*=\s*ON\s*;\s*/gim, '')
        .replace(/--[^\n]*/g, '')
        .replace(/\s+/g, ' ');
    await database.exec(sql);
}

async function publicCatalog(limit = 100) {
    const response = await mf.dispatchFetch(`${workerOrigin}/api/public/cards?limit=${limit}`, {
        headers: { Origin: siteOrigin }
    });
    assert.equal(response.status, 200, await response.clone().text());
    return await response.json();
}

async function publicDetail(id) {
    const response = await mf.dispatchFetch(`${workerOrigin}/api/public/cards/${encodeURIComponent(id)}`, {
        headers: { Origin: siteOrigin }
    });
    assert.equal(response.status, 200, await response.clone().text());
    const result = await response.json();
    assert.equal(result.schemaVersion, 1);
    assert.equal(result.card.id, id);
    return result.card;
}

const edgeKey = (left, right) => left < right ? `${left}\u0000${right}` : `${right}\u0000${left}`;

try {
    const authDb = await mf.getD1Database('DB');
    const contentDb = await mf.getD1Database('CONTENT_DB');
    for (const filename of ['migrations/0001_sessions.sql', 'migrations/0002_card_metadata.sql', 'migrations/0003_profile_accounts.sql']) {
        await migration(authDb, filename);
    }
    await migration(contentDb, 'content-migrations/0001_card_content.sql');

    const authTables = await authDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    const contentTables = await contentDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    const authTableNames = new Set(authTables.results.map(row => row.name));
    const contentTableNames = new Set(contentTables.results.map(row => row.name));
    assert.ok(authTableNames.has('sessions'));
    assert.equal(authTableNames.has('cards'), false);
    assert.ok(contentTableNames.has('cards'));
    assert.ok(contentTableNames.has('card_form_links'));
    assert.equal(contentTableNames.has('sessions'), false);

    const bundle = await buildContentImportBundle({ sourceRoot: DEFAULT_SOURCE_ROOT });
    assert.equal(bundle.status, 'ready', JSON.stringify(bundle.report.blockers));
    assert.equal(bundle.report.cardCount, 14);
    const imported = await applyImportBundle(contentDb, bundle);
    assert.equal(imported.status, 'applied');
    assert.equal(imported.cardResults.filter(row => row.result === 'inserted').length, 14);

    const initialCatalog = await publicCatalog();
    assert.equal(initialCatalog.schemaVersion, 1);
    assert.equal(initialCatalog.cards.length, bundle.cards.filter(card => card.status === 'published').length);
    assert.equal(initialCatalog.nextCursor, null);

    const saveId = bundle.cards.find(card => card.status === 'published')?.id;
    assert.ok(saveId, 'the real import needs a published card for the save proof');
    const beforeSave = await publicDetail(saveId);
    const nextName = `${beforeSave.name} Runtime`;
    const saveInput = structuredClone(beforeSave);
    saveInput.schemaVersion = 1;
    saveInput.name = nextName;
    saveInput.title = nextName;
    saveInput.payload = structuredClone(beforeSave.payload);
    saveInput.payload.inputs = { ...(saveInput.payload.inputs || {}), nameInput: nextName };
    const saved = await saveCard(contentDb, saveId, beforeSave.revision, saveInput, 'workerd-runtime-proof');
    assert.equal(saved.card.revision, beforeSave.revision + 1);
    const afterSave = await publicDetail(saveId);
    assert.equal(afterSave.revision, beforeSave.revision + 1);
    assert.equal(afterSave.payload.inputs.nameInput, nextName);

    const importedEdges = new Set(bundle.edges.map(edge => edgeKey(edge.leftId, edge.rightId)));
    const publishedIds = bundle.cards.filter(card => card.status === 'published').map(card => card.id);
    let pair = null;
    for (let leftIndex = 0; leftIndex < publishedIds.length && !pair; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < publishedIds.length; rightIndex += 1) {
            const candidate = [publishedIds[leftIndex], publishedIds[rightIndex]];
            if (!importedEdges.has(edgeKey(candidate[0], candidate[1]))) { pair = candidate; break; }
        }
    }
    assert.ok(pair, 'the real import needs an unlinked published pair for the D1 link proof');

    const beforeLeft = await publicDetail(pair[0]);
    const beforeRight = await publicDetail(pair[1]);
    const linkResult = await applyLinkOperations(contentDb, {
        operations: [{ action: 'link', sourceSlug: pair[0], targetSlug: pair[1] }],
        expectedRevisions: { [pair[0]]: beforeLeft.revision, [pair[1]]: beforeRight.revision }
    }, 'workerd-runtime-proof');
    assert.equal(linkResult.cards.length, 2);
    const linkedLeft = linkResult.cards.find(card => card.id === pair[0]);
    const linkedRight = linkResult.cards.find(card => card.id === pair[1]);
    assert.ok(linkedLeft?.linkedSlugs.includes(pair[1]));
    assert.ok(linkedRight?.linkedSlugs.includes(pair[0]));
    assert.equal(linkedLeft.revision, beforeLeft.revision + 1);
    assert.equal(linkedRight.revision, beforeRight.revision + 1);
    assert.ok((await publicDetail(pair[0])).linkedCards.some(card => card.id === pair[1]));
    assert.ok((await publicDetail(pair[1])).linkedCards.some(card => card.id === pair[0]));

    const catalogAfterLink = await publicCatalog();
    assert.ok(catalogAfterLink.cards.find(card => card.id === pair[0])?.linkedSlugs.includes(pair[1]));
    assert.ok(catalogAfterLink.cards.find(card => card.id === pair[1])?.linkedSlugs.includes(pair[0]));

    const beforeArchive = await publicDetail(pair[0]);
    const archiveResult = await archiveCard(contentDb, pair[0], beforeArchive.revision, 'workerd-runtime-proof');
    assert.equal(archiveResult.archivedId, pair[0]);
    assert.ok(archiveResult.cards.find(card => card.id === pair[0] && card.status === 'archived'));
    assert.equal(archiveResult.cards.find(card => card.id === pair[0]).revision, beforeArchive.revision + 1);

    const archivedDetail = await mf.dispatchFetch(`${workerOrigin}/api/public/cards/${encodeURIComponent(pair[0])}`, {
        headers: { Origin: siteOrigin }
    });
    assert.equal(archivedDetail.status, 404);
    const catalogAfterArchive = await publicCatalog();
    assert.equal(catalogAfterArchive.cards.some(card => card.id === pair[0]), false);
    assert.ok(catalogAfterArchive.cards.find(card => card.id === pair[1]));
    assert.deepEqual(blockedOutboundRequests, []);

    console.log(JSON.stringify({
        runtime: 'local workerd/Miniflare D1',
        databaseBindingsSeparate: true,
        importedCards: bundle.report.cardCount,
        publicCatalogAndDetailJsonSql: true,
        saveRevision: [beforeSave.revision, afterSave.revision],
        linkRevisions: {
            [pair[0]]: [beforeLeft.revision, linkedLeft.revision],
            [pair[1]]: [beforeRight.revision, linkedRight.revision]
        },
        archiveRevision: [beforeArchive.revision, archiveResult.cards.find(card => card.id === pair[0]).revision],
        archivedCardHiddenFromPublicApi: true,
        externalRequests: blockedOutboundRequests.length,
        deployment: false
    }, null, 2));
} finally {
    await mf.dispose();
}
