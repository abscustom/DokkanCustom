import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildCompatibilityPages } from './build-card-compatibility-pages.mjs';

test('review wrappers deduplicate exact encoded aliases and preserve stable ID and asset base', async () => {
    const parent = await fs.mkdtemp(path.join(os.tmpdir(), 'card-compatibility-'));
    const output = path.join(parent, 'review');
    const bundle = { schemaVersion: 1, kind: 'dokkan-custom-card-content-import', status: 'ready', sourceChecksum: 'fixture',
        cards: [{ id: 'nested-card', name: '<Name>', status: 'published', assetBase: 'https://abscustom.github.io/Custom%20Cards/nested-card/' }],
        aliases: ['/Custom%20Cards/nested-card/', '/Custom Cards/nested-card/index.html', '/old-name/'].map(path => ({ path, cardId: 'nested-card' })) };
    const result = await buildCompatibilityPages(bundle, output);
    assert.equal(result.aliasCount, 3);
    assert.equal(result.pages.length, 2);
    assert.equal(result.pages[0].assetBase, bundle.cards[0].assetBase);
    const html = await fs.readFile(path.join(output, 'Custom Cards/nested-card/index.html'), 'utf8');
    assert.match(html, /custom-card\.html\?id=nested-card/);
    assert.match(html, /&lt;Name&gt;/);
    assert.doesNotMatch(html, /<Name>/);
    assert.match(html, /location\.hash/);
    await assert.rejects(buildCompatibilityPages(bundle, output), /EEXIST/);
});

test('unsafe aliases fail before any review files are created', async () => {
    const parent = await fs.mkdtemp(path.join(os.tmpdir(), 'card-compatibility-'));
    const output = path.join(parent, 'review');
    const bundle = { schemaVersion: 1, kind: 'dokkan-custom-card-content-import', status: 'ready', cards: [{ id: 'a', status: 'published' }], aliases: [{ path: '/%2e%2e/escape/', cardId: 'a' }] };
    await assert.rejects(buildCompatibilityPages(bundle, output), /Unsafe/);
    await assert.rejects(fs.stat(output), /ENOENT/);
});
