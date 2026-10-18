import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const source = await fs.readFile(new URL('../js/card-content-client.js', import.meta.url), 'utf8');
const editorExportSource = await fs.readFile(new URL('../js-editor/12-export.js', import.meta.url), 'utf8');
const githubSource = await fs.readFile(new URL('../js-editor/13-github.js', import.meta.url), 'utf8');
function runtime(fetch, extra = {}) {
    const listeners = new Map();
    const context = { URL, URLSearchParams, fetch, structuredClone, crypto: { randomUUID: () => '12345678-1234-1234-1234-123456789abc' },
        location: new URL('http://127.0.0.1:3000/DokkanCustom/editor.html?content=database'),
        document: { currentScript: { src: 'http://127.0.0.1:3000/DokkanCustom/js/card-content-client.js' }, getElementById: () => null, dispatchEvent() {} },
        setTimeout: () => 1, clearTimeout() {}, addEventListener: (type, handler) => listeners.set(type, handler), removeEventListener: type => listeners.delete(type), ...extra };
    context.window = context;
    vm.runInNewContext(source, context);
    return { ...context, listeners };
}
const reply = data => new Response(JSON.stringify({ schemaVersion: 1, ...data }), { status: 200 });

test('catalog paginates summaries without requesting details or accepting a repeated cursor', async () => {
    const requests = [];
    const r = runtime(async (url, options) => { requests.push({ url, options }); return requests.length === 1 ? reply({ cards: [{ id: 'a' }], nextCursor: 'next' }) : reply({ cards: [{ id: 'b' }], nextCursor: null }); });
    assert.deepEqual(Array.from(await r.CardContent.listCards(), c => c.id), ['a', 'b']);
    assert.match(requests[1].url, /cursor=next/);
    assert.equal(requests[0].options.credentials, 'omit');
    assert.equal(requests[0].options.cache, 'no-cache');
    const loop = runtime(async () => reply({ cards: [], nextCursor: 'same' }));
    await assert.rejects(loop.CardContent.listCards(), /pagination/);
});

test('unavailable or archived detail never falls back to legacy JSON', async () => {
    const requests = [];
    const r = runtime(async url => { requests.push(url); return new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Unavailable' } }), { status: 404 }); });
    await assert.rejects(r.CardContent.getCard('archived'), error => error.status === 404);
    assert.equal(requests.length, 1);
    assert.match(requests[0], /\/api\/public\/cards\/archived$/);
});

test('exact alias resolution encodes the entire original path', async () => {
    let requested;
    const r = runtime(async url => { requested = url; return reply({ id: 'a', slug: 'a' }); });
    await r.CardContent.resolve('/Custom Cards/a/index.html');
    assert.equal(new URL(requested).searchParams.get('path'), '/Custom Cards/a/index.html');
});

test('database publication preserves revision and blocks legacy content writes while allowing assets', () => {
    let opened, sent;
    const popup = { postMessage: (data, target) => { sent = { data, target }; } };
    const r = runtime(() => { throw new Error('No network should run in the editor'); }, {
        currentContentCard: { id: 'a', revision: 7, repoPath: 'Custom Cards/a', assetBase: 'https://abscustom.github.io/Custom%20Cards/a/', linkedCards: [{ id: 'b' }] },
        getProjectDataObject: () => ({ cardSource: 'custom', inputs: { nameInput: 'A' }, containers: { forms: 'stale', links: 'gameplay' }, formsData: [{ name: 'Built in', link: '#form' }, { name: 'B', adminLinkedSlug: 'b' }] }),
        open: url => { opened = url; return popup; }
    });
    r.CardContent.publishCurrent();
    assert.equal(new URL(opened).pathname, '/card-publisher.html');
    const receive = r.listeners.get('message');
    receive({ source: popup, origin: 'https://evil.example', data: { type: 'card-publisher-ready', nonce: '12345678-1234-1234-1234-123456789abc' } });
    assert.equal(sent, undefined);
    receive({ source: popup, origin: 'https://abs-manager-auth.trashullu.workers.dev', data: { type: 'card-publisher-ready', nonce: '12345678-1234-1234-1234-123456789abc' } });
    assert.equal(sent.data.request.expectedRevision, 7);
    assert.equal(sent.data.request.card.payload.containers.forms, undefined);
    assert.equal(sent.data.request.card.payload.containers.links, 'gameplay');
    assert.equal(sent.data.request.card.builtinForms.length, 1);
    assert.throws(() => r.CardContent.assertLegacyWriteAllowed([{ path: 'Custom Cards/a/card.json' }]), /database publishing/);
    assert.doesNotThrow(() => r.CardContent.assertLegacyWriteAllowed([{ path: 'Custom Cards/a/card_art.png' }]));
});

test('media and missing safe renderer fail before any publication or hydration', () => {
    const r = runtime(() => {}, { getProjectDataObject: () => ({ cardSource: 'custom', inputs: { nameInput: 'A' }, cardArtImage: 'data:image/png;base64,abcd' }), open: () => { throw new Error('Must not open'); } });
    assert.throws(() => r.CardContent.publishCurrent(), /media assets first/);
    assert.throws(() => r.CardContent.toProject({}), /safe card renderer/);
});

test('legacy pages remain opt-in and content catalog exposes stable viewer URLs', () => {
    const r = runtime(() => {}, { location: new URL('https://abscustom.github.io/DokkanCustom/index.html') });
    assert.equal(r.CardContent.enabled(), false);
    assert.doesNotThrow(() => r.CardContent.assertLegacyWriteAllowed([{ path: 'Custom Cards/a/card.json' }]));
    const card = r.CardContent.toCatalogCard({ id: 'a', name: 'A', rarity: 'lr', type: 'TEQ', revision: 2 });
    assert.equal(card.contentSource, 'database');
    assert.equal(card.rarity, 'LR');
    assert.match(card.cardUrl, /custom-card.html\?id=a$/);
    assert.equal(card.htmlText, undefined);
});

test('database pilot remains active when official card navigation normalizes the URL', () => {
    const r = runtime(() => {});
    assert.equal(r.CardContent.enabled(), true);
    r.location.search = '?viewer=1&id=4031731&mode=base';
    assert.equal(r.CardContent.enabled(), true);
    assert.throws(() => r.CardContent.assertLegacyWriteAllowed([{ path: 'Custom Cards/a/card.json' }]), /database publishing/);
});

test('database mode rejects official GitHub card writes before requests while preserving assets and database publishing', async () => {
    const requests = [];
    const alerts = [];
    const popup = { postMessage() {} };
    const official = runtime(async (url, options = {}) => {
        const request = { url: String(url), method: options.method || 'GET' };
        requests.push(request);
        let payload = {};
        if (request.url.endsWith('/git/ref/heads/main')) payload = { object: { sha: 'parent' } };
        else if (request.url.endsWith('/git/commits/parent')) payload = { tree: { sha: 'base-tree' } };
        else if (request.url.endsWith('/git/blobs')) payload = { sha: 'asset-blob' };
        else if (request.url.endsWith('/git/trees')) payload = { sha: 'new-tree' };
        else if (request.url.endsWith('/git/commits')) payload = { sha: 'new-commit' };
        return {
            ok: request.method === 'PATCH' || request.method === 'POST' || request.method === 'GET',
            status: 200,
            json: async () => payload
        };
    }, {
        currentCardSource: 'official',
        IS_PUBLISHED: true,
        PUBLISHED_CARD_SOURCE: 'custom',
        alert: message => alerts.push(message),
        Blob,
        btoa: value => Buffer.from(value, 'binary').toString('base64')
    });
    vm.runInNewContext(editorExportSource, official);
    vm.runInNewContext(githubSource, official);

    official.window.openUploadModal();
    official.window.openQuickSaveModal();
    await assert.rejects(official.window.executeGitHubUpload(), /Direct GitHub card HTML\/JSON writes are disabled/);
    await assert.rejects(official.window.executeQuickSave(), /Direct GitHub card HTML\/JSON writes are disabled/);
    assert.equal(requests.length, 0, 'official card content actions stop before any GitHub request');
    assert.equal(alerts.length, 2, 'official upload and quick-save modal entry points report the disabled legacy writer');

    assert.throws(() => official.CardContent.assertLegacyWriteAllowed([{ path: 'Custom Cards/a/card.json' }]), /Direct GitHub card HTML\/JSON writes are disabled/);
    assert.doesNotThrow(() => official.CardContent.assertLegacyWriteAllowed([{ path: 'Custom Cards/a/card_art.png' }]));
    assert.equal(await official.uploadBatchToGitHub('token', 'abscustom', 'abscustom.github.io', [
        { path: 'Custom Cards/a/card_art.png', blob: new Blob(['asset']) }
    ], 'Upload asset'), true);
    assert.deepEqual(requests.map(request => request.method), ['GET', 'GET', 'POST', 'POST', 'POST', 'PATCH'], 'asset-only upload still reaches GitHub');
    assert.ok(requests.every(request => !/\/(?:index\.html|card\.json)(?:\?|$)/i.test(request.url)));

    let publisherUrl = '';
    const custom = runtime(async () => { throw new Error('Database publishing must not request GitHub.'); }, {
        currentCardSource: 'custom',
        currentContentCard: { id: 'a', revision: 7, repoPath: 'Custom Cards/a', assetBase: 'https://abscustom.github.io/Custom%20Cards/a/' },
        getProjectDataObject: () => ({ cardSource: 'custom', inputs: { nameInput: 'A' }, formsData: [] }),
        open: url => { publisherUrl = url; return popup; }
    });
    vm.runInNewContext(editorExportSource, custom);
    custom.window.getProjectDataObject = () => ({ cardSource: 'custom', inputs: { nameInput: 'A' }, formsData: [] });
    assert.equal(await custom.window.executeGitHubUpload(), popup);
    assert.equal(new URL(publisherUrl).pathname, '/card-publisher.html', 'custom database card still opens the D1 publisher');
});
