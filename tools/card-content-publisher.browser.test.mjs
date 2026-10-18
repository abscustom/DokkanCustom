import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { chromium } from 'file:///C:/Users/Ruffy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const root = new URL('../', import.meta.url);
const [client, publisher, pageHtml] = await Promise.all(['js/card-content-client.js', 'js/card-content-publisher.js', 'card-publisher.html'].map(file => fs.readFile(new URL(file, root), 'utf8')));
const worker = 'https://abs-manager-auth.trashullu.workers.dev';
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
try {
    const context = await browser.newContext();
    const writes = [], errors = [];
    let conflict = false;
    context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
    await context.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.pathname === '/editor.html') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body><button id="publish" onclick="CardContent.publishCurrent()">Publish</button><script src="/js/card-content-client.js"></script></body></html>' });
        if (url.pathname === '/js/card-content-client.js') return route.fulfill({ contentType: 'text/javascript', body: client });
        if (url.pathname === '/card-publisher.html') return route.fulfill({ contentType: 'text/html', body: pageHtml });
        if (url.pathname === '/js/card-content-publisher.js') return route.fulfill({ contentType: 'text/javascript', body: publisher });
        if (url.pathname === '/api/session') return route.fulfill({ json: { login: 'admin', csrfToken: 'fixture-csrf-token' } });
        if (url.pathname === '/api/content/cards/a') {
            writes.push({ method: route.request().method(), body: route.request().postDataJSON(), csrf: route.request().headers()['x-csrf-token'] });
            return conflict ? route.fulfill({ status: 409, json: { error: { code: 'REVISION_CONFLICT', message: 'Conflict' } } }) : route.fulfill({ json: { schemaVersion: 1, card: { id: 'a', revision: 8 } } });
        }
        return route.abort();
    });
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:3000/editor.html?content=database');
    await page.evaluate(() => {
        window.currentContentCard = { id: 'a', revision: 7, assetBase: 'https://abscustom.github.io/Custom%20Cards/a/', repoPath: 'Custom Cards/a', linkedCards: [] };
        window.getProjectDataObject = () => ({ cardSource: 'custom', inputs: { nameInput: 'A <safe>' }, containers: { links: '<b>Gameplay</b>', forms: 'stale' }, formsData: [] });
    });
    const popupPromise = page.waitForEvent('popup');
    await page.locator('#publish').click();
    const popup = await popupPromise;
    await popup.locator('#save:not([disabled])').waitFor();
    assert.equal(writes.length, 0, 'Opening the publisher must not save');
    assert.equal(await popup.locator('#name').textContent(), 'A <safe>');
    assert.equal(await popup.locator('#name safe').count(), 0, 'Card metadata must be text');
    await popup.locator('#save').click();
    await popup.getByText('Card saved. You can return to the editor.').waitFor();
    await page.waitForFunction(() => window.currentContentCard.revision === 8);
    assert.equal(writes[0].method, 'PUT');
    assert.equal(writes[0].csrf, 'fixture-csrf-token');
    assert.equal(writes[0].body.expectedRevision, 7);
    assert.equal(writes[0].body.card.payload.containers.forms, undefined);
    assert.equal(await popup.locator('#save').isDisabled(), true);

    conflict = true;
    const conflictPromise = page.waitForEvent('popup');
    await page.locator('#publish').click();
    const conflictPage = await conflictPromise;
    await conflictPage.locator('#save:not([disabled])').waitFor();
    await conflictPage.locator('#save').click();
    await conflictPage.getByText(/A newer revision exists/).waitFor();
    assert.equal(await page.evaluate(() => currentContentCard.revision), 8);
    assert.equal(await conflictPage.locator('#save').isDisabled(), true, 'Conflict cannot be silently retried');
    assert.equal(writes.length, 2);
    assert.deepEqual(errors, []);
    console.log('PASS: real publisher popup, explicit save, CSRF, revision update, safe labels, conflict preservation; no live requests.');
} finally { await browser.close(); }
