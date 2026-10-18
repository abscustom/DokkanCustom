import test from 'node:test';
import assert from 'node:assert/strict';
import { contentFixture } from './content-fixture.mjs';
import { buildContentImportBundle } from '../src/content-import.mjs';
import { applyImportBundle, publicCardDetail } from '../src/content-store.mjs';

test('real content namespace enforces origin, CSRF, current admin, writer gate and ETag revalidation', async () => {
    const f = contentFixture(), previousFetch = globalThis.fetch;
    globalThis.fetch = f.provider;
    try {
        const bundle = await buildContentImportBundle();
        await applyImportBundle(f.env.CONTENT_DB, bundle);
        const id = bundle.cards[0].id;
        const detailPath = '/api/public/cards/' + id;
        const published = await f.request(detailPath, { originHeader: 'https://abscustom.github.io' });
        assert.equal(published.status, 200);
        const etag = published.headers.get('ETag');
        assert.ok(etag);
        const unchanged = await f.request(detailPath, { originHeader: 'https://abscustom.github.io', headers: { 'If-None-Match': etag } });
        assert.equal(unchanged.status, 304);
        assert.equal(await unchanged.text(), '');
        const blockedPublic = await f.request(detailPath, { originHeader: 'https://evil.example' });
        assert.equal(blockedPublic.status, 403);
        const publicWrite = await f.request(detailPath, { method: 'POST', originHeader: 'https://abscustom.github.io', payload: {} });
        assert.equal(publicWrite.status, 405);
        assert.equal((await f.request('/api/content/export')).status, 401);

        const active = await f.login();
        const detail = (await publicCardDetail(f.env.CONTENT_DB, id)).card;
        const payload = { expectedRevision: detail.revision, card: { ...detail, payload: { ...detail.payload, inputs: { ...detail.payload.inputs, nameInput: detail.name + ' edited' } }, name: detail.name + ' edited' } };
        const admin = (path, { method = 'PUT', csrf = active.csrfToken, origin = f.env.MANAGER_ORIGIN, body = payload } = {}) => f.request(path, {
            method, cookie: active.cookie, csrf, payload: body, originHeader: origin,
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf }
        });
        const writePath = '/api/content/cards/' + id;
        assert.equal((await admin(writePath, { csrf: 'invalid-csrf' })).status, 403);
        assert.equal((await admin(writePath, { origin: 'https://abscustom.github.io' })).status, 403);
        assert.equal((await publicCardDetail(f.env.CONTENT_DB, id)).card.revision, detail.revision);
        f.push = false;
        assert.equal((await admin(writePath)).status, 403, 'Revoked repository permission blocks an existing session');
        f.push = true;
        f.env.CONTENT_WRITES_ENABLED = 'false';
        const disabled = await admin(writePath);
        assert.equal(disabled.status, 503);
        assert.equal((await disabled.json()).error.code, 'CONTENT_WRITES_DISABLED');
        f.env.CONTENT_WRITES_ENABLED = 'true';
        const saved = await admin(writePath);
        assert.equal(saved.status, 200, await saved.clone().text());
        const revalidated = await f.request(detailPath, { originHeader: 'https://abscustom.github.io', headers: { 'If-None-Match': etag } });
        assert.equal(revalidated.status, 200);
        assert.notEqual(revalidated.headers.get('ETag'), etag);
        assert.equal((await revalidated.json()).card.revision, detail.revision + 1);
        const catalog = await (await f.request('/api/public/cards')).json();
        assert.ok(catalog.cards.every(card => !Object.hasOwn(card, 'payload') && !Object.hasOwn(card, 'sourceChecksum') && !Object.hasOwn(card, 'actor')));
        assert.equal(f.writes.length, 0);
    } finally { globalThis.fetch = previousFetch; f.contentSql.close(); f.sql.close(); }
});
