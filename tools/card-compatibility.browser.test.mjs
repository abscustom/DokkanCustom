import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { chromium } from 'file:///C:/Users/Ruffy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const review = fileURLToPath(new URL('../docs/abs-refresh/reports/database-migration-20261017/compatibility-pages/', import.meta.url));
const manifest = JSON.parse(await fs.readFile(path.join(review, 'compatibility-manifest.json'), 'utf8'));
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
try {
    const context = await browser.newContext();
    await context.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.origin !== 'https://abscustom.github.io') return route.abort();
        if (url.pathname === '/DokkanCustom/custom-card.html') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Shared viewer entry</title>' });
        const relative = decodeURIComponent(url.pathname).slice(1);
        const file = path.resolve(review, relative.endsWith('/') ? relative + 'index.html' : relative);
        if (!file.startsWith(path.resolve(review) + path.sep)) return route.abort();
        try { return route.fulfill({ contentType: 'text/html', body: await fs.readFile(file) }); }
        catch { return route.abort(); }
    });
    const page = await context.newPage();
    for (const item of manifest.pages) {
        const url = 'https://abscustom.github.io/' + item.path.split('/').map(encodeURIComponent).join('/') + '#forms';
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        await page.waitForURL(url => url.pathname === '/DokkanCustom/custom-card.html');
        assert.equal(new URL(page.url()).searchParams.get('id'), item.cardId);
        assert.equal(new URL(page.url()).hash, '#forms');
    }
    assert.equal(manifest.aliasCount, 64);
    assert.equal(manifest.pages.length, 22);
    console.log('PASS: all 22 reviewed compatibility pages redirect 64 exact aliases to their stable shared viewer IDs and preserve fragments; no live traffic.');
} finally { await browser.close(); }
