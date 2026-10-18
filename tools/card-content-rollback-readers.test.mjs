import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { parse } from '../services/manager-auth/node_modules/acorn/dist/acorn.mjs';
import { DOMParser } from '../services/manager-auth/src/html-dom.mjs';

for (const [file, name] of [['js/main.js', 'loadCustomCards'], ['js-editor/20-card-importer.js', 'fetchCustomCardsList'], ['js-calc/calc-card-loader.js', 'loadCustomCardsForCalculator']]) {
    test(`${name} respects rollback tombstones and clears stale cached archives`, async () => {
        const source = await fs.readFile(new URL('../' + file, import.meta.url), 'utf8');
        const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'script' });
        const node = ast.body.find(node => node.type === 'FunctionDeclaration' && node.id.name === name);
        assert.ok(node);
        let cached = JSON.stringify([{ id: 'archived', name: 'Stale archive', source: 'custom' }]);
        const requests = [];
        const runtime = { DOMParser, console, window: { CardContent: { enabled: () => false } },
            localStorage: { getItem: () => cached, setItem: (key, value) => { cached = value; } },
            fetch: async url => {
                requests.push(url);
                if (url === 'https://api.github.com/repos/abscustom/abscustom.github.io/contents/') return new Response(JSON.stringify([{ type: 'dir', name: 'archived' }]));
                assert.match(url, /\/archived\/index\.html$/);
                return new Response('<!doctype html><html><head><meta name="abs-card-state" content="archived"><title>Card unavailable</title></head><body>Unavailable</body></html>');
            } };
        const result = await vm.runInNewContext('(' + source.slice(node.start, node.end) + ')()', runtime);
        assert.equal(result.length, 0);
        assert.equal(JSON.parse(cached).length, 0, 'An all-archived catalog must not fall back to pre-archive cache');
        assert.equal(requests.length, 2, 'Tombstone stops before reading stale payload/media');
    });
}
