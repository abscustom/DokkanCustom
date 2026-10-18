import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { chromium } from 'file:///C:/Users/Ruffy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { contentFixture } from '../services/manager-auth/test/content-fixture.mjs';
import { buildContentImportBundle } from '../services/manager-auth/src/content-import.mjs';
import { applyImportBundle, publicCardDetail } from '../services/manager-auth/src/content-store.mjs';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const publishing = path.resolve(root, '../abscustom');
const id = '9071718';
const project = JSON.parse(await fs.readFile(path.join(publishing, 'Custom Cards', id, 'card.json'), 'utf8'));
const fixture = contentFixture();
const realFetch = globalThis.fetch;
globalThis.fetch = fixture.provider;
const bundle = await buildContentImportBundle();
assert.equal(bundle.status, 'ready');
await applyImportBundle(fixture.env.CONTENT_DB, bundle);
const active = await fixture.login();
const targetId = '6961700-frieza-full-power';
const alternateId = '6231448-vegeta-ultra-ego';
const current = (await publicCardDetail(fixture.env.CONTENT_DB, id)).card;
const target = (await publicCardDetail(fixture.env.CONTENT_DB, targetId)).card;
const alternate = (await publicCardDetail(fixture.env.CONTENT_DB, alternateId)).card;
const link = await fixture.request('/api/content/links/apply', { method: 'POST', cookie: active.cookie, csrf: active.csrfToken,
    payload: { operations: [{ action: 'link', sourceSlug: id, targetSlug: targetId }, { action: 'link', sourceSlug: id, targetSlug: alternateId }], expectedRevisions: { [id]: current.revision, [targetId]: target.revision, [alternateId]: alternate.revision } } });
assert.equal(link.status, 200, await link.clone().text());
const expectedCard = (await publicCardDetail(fixture.env.CONTENT_DB, id)).card;
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const apiCalls = [], providerWrites = [], contentWrites = [], errors = [];
    context.on('page', page => page.on('pageerror', e => errors.push(e.message)));
    await context.route('**/*', async route => {
        const request = route.request(), url = new URL(request.url());
        if (['cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'fonts.googleapis.com'].includes(url.hostname)) {
            return route.fulfill({ contentType: request.resourceType() === 'script' ? 'text/javascript' : 'text/css', body: '' });
        }
        if (url.hostname === 'abs-manager-auth.trashullu.workers.dev' && (url.pathname === '/api/session' || url.pathname.startsWith('/api/content/'))) {
            const method = request.method();
            if (method !== 'GET') contentWrites.push(request.postDataJSON());
            const response = await fixture.request(url.pathname + url.search, { method, cookie: active.cookie, csrf: active.csrfToken,
                originHeader: method === 'GET' ? '' : fixture.env.MANAGER_ORIGIN,
                payload: method === 'GET' ? undefined : request.postDataJSON(),
                headers: method === 'GET' ? {} : { 'Content-Type': 'application/json', 'X-CSRF-Token': request.headers()['x-csrf-token'] || '' } });
            return route.fulfill({ status: response.status, body: await response.text(), headers: Object.fromEntries(response.headers) });
        }
        if (!['GET', 'HEAD'].includes(request.method())) { providerWrites.push(request.url()); return route.abort(); }
        if (url.hostname === 'abs-manager-auth.trashullu.workers.dev' && url.pathname.startsWith('/api/public/cards')) {
            apiCalls.push(url.pathname);
            const response = await fixture.request(url.pathname + url.search, { originHeader: 'http://127.0.0.1:3000' });
            return route.fulfill({ status: response.status, body: await response.text(), headers: Object.fromEntries(response.headers) });
        }
        let base, relative;
        if (url.hostname === '127.0.0.1' && url.pathname.startsWith('/DokkanCustom/')) { base = root; relative = decodeURIComponent(url.pathname.slice('/DokkanCustom/'.length)); }
        else if (url.hostname === 'abs-manager-auth.trashullu.workers.dev' && (url.pathname === '/card-publisher.html' || url.pathname === '/js/card-content-publisher.js')) { base = root; relative = url.pathname.slice(1); }
        else if (url.hostname === 'abscustom.github.io') {
            if (url.pathname.startsWith('/DokkanCustom/')) { base = root; relative = decodeURIComponent(url.pathname.slice('/DokkanCustom/'.length)); }
            else { base = publishing; relative = decodeURIComponent(url.pathname.slice(1)); }
        } else return route.abort();
        const file = path.resolve(base, relative);
        if (!file.startsWith(base + path.sep)) return route.abort();
        try {
            return route.fulfill({ body: await fs.readFile(file), contentType: ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp4': 'video/mp4' })[path.extname(file)] || 'application/octet-stream' });
        } catch { return route.fulfill({ status: 404, body: '' }); }
    });
    if (!process.argv.includes('--shared-only')) {
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:3000/DokkanCustom/editor.html?content=database', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.executeCustomCardImport === 'function' && typeof window.CardContentRenderer?.toProject === 'function');
    await page.evaluate(async id => {
        const summary = (await CardContent.listCards()).find(item => item.id === id);
        await executeCustomCardImport(CardContent.toCatalogCard(summary));
    }, id);
    assert.equal(await page.locator('#nameInput').inputValue(), project.inputs.nameInput);
    assert.equal(await page.evaluate(() => currentContentCard.revision), expectedCard.revision);
    assert.equal(await page.locator('#forms-container .dokkan-card').count(), 2);
    assert.equal(await page.locator('#forms-container .form-link[href*="id=6961700-frieza-full-power"]').count(), 1);
    const roundtrip = await page.evaluate(() => getProjectDataObject());
    assert.equal(roundtrip.inputs.leaderInput, project.inputs.leaderInput, 'Full leader text survives database editor import');
    assert.equal(roundtrip.stats.atkMax, project.stats.atkMax);
    assert.equal(roundtrip.formsData.find(form => form.adminLinkedSlug === targetId).targetId, targetId);
    assert.equal(roundtrip.formsData.find(form => form.adminLinkedSlug === alternateId).targetId, alternateId);
    const passiveInput = page.locator('#sidebar-sections-area textarea').first();
    assert.ok(await passiveInput.count(), 'Passive editor controls survive safe import');
    await page.evaluate(() => openQuickCardEditor('passive'));
    await page.locator('.passive-overview-select').first().click();
    const visibleInput = page.locator('#context-gui textarea[id^="gui-sec-text-"]');
    await visibleInput.fill('- ATK & DEF +123%');
    await page.waitForFunction(() => document.getElementById('card-passive-container').textContent.includes('123%'));
    const afterEdit = await page.evaluate(() => getProjectDataObject());
    assert.match(afterEdit.containers.passiveCard, /123%/);
    assert.equal(providerWrites.length, 0);
    assert.ok(apiCalls.includes('/api/public/cards/' + id));
    // Switching to an offline project must not inherit this database record's revision.
    await page.evaluate(project => loadProjectData(project, '', true), project);
    assert.equal(await page.evaluate(() => window.currentContentCard), null);

    const authoredId = '3518633-perfected-ultra-instinct-giant';
    const authoredBefore = (await publicCardDetail(fixture.env.CONTENT_DB, authoredId)).card;
    await page.evaluate(async id => {
        await executeCustomCardImport(CardContent.toCatalogCard(await CardContent.getCard(id)));
        const button = document.createElement('button'); button.id = 'test-database-publish'; button.textContent = 'Save database card';
        button.addEventListener('click', () => CardContent.publishCurrent());
        button.style.cssText = 'position:fixed;top:5px;left:5px;z-index:2147483647'; document.body.append(button);
    }, authoredId);
    const popupEvent = page.waitForEvent('popup');
    await page.locator('#test-database-publish').click();
    const publisher = await popupEvent;
    await publisher.locator('#save:not([disabled])').waitFor();
    assert.equal(contentWrites.length, 0);
    await publisher.locator('#save').click();
    await publisher.getByText('Card saved. You can return to the editor.').waitFor();
    const authoredAfter = (await publicCardDetail(fixture.env.CONTENT_DB, authoredId)).card;
    assert.equal(authoredAfter.revision, authoredBefore.revision + 1);
    assert.deepEqual(authoredAfter.builtinForms.map(form => form.targetId), authoredBefore.builtinForms.map(form => form.targetId));
    assert.deepEqual(authoredAfter.linkedCards.map(card => card.id), authoredBefore.linkedCards.map(card => card.id));
    assert.equal(contentWrites.length, 1);
    assert.equal(contentWrites[0].expectedRevision, authoredBefore.revision);
    await publisher.close();
    await page.evaluate(async id => {
        await executeCustomCardImport(CardContent.toCatalogCard(await CardContent.getCard(id)));
        const field = document.querySelector('#sidebar-sections-area textarea');
        if (!field) throw new Error('Saved card lost passive editor controls');
        field.value = '- ATK & DEF +456%';
        field.dispatchEvent(new Event('input', { bubbles: true }));
    }, authoredId);
    await page.waitForFunction(() => document.getElementById('card-passive-container').textContent.includes('456%'));

    const calc = await context.newPage();
    await calc.goto('http://127.0.0.1:3000/DokkanCustom/calculator.html?content=database', { waitUntil: 'domcontentloaded' });
    await calc.waitForFunction(() => typeof loadCustomCardDocIntoCalculator === 'function' && typeof window.CardContentRenderer?.toProject === 'function');
    const calcResult = await calc.evaluate(async id => {
        const cards = await loadCustomCardsForCalculator();
        const summary = cards.find(card => card.id === id);
        if (!summary) throw new Error('Database card missing from calculator catalog');
        await loadCustomCardDocIntoCalculator(summary);
        return { count: cards.length, stats: cardParsedStats.rainbow100, source: currentLoadedCardMeta.cardItemMeta.contentSource };
    }, id);
    assert.equal(calcResult.count, 14);
    assert.equal(calcResult.source, 'database');
    assert.equal(calcResult.stats.atk, project.stats.atk100);
    assert.equal(calcResult.stats.def, project.stats.def100);
    assert.equal(await calc.locator('#calc-char-name-text').textContent(), project.inputs.nameInput);

    const hub = await context.newPage();
    await hub.goto('http://127.0.0.1:3000/DokkanCustom/index.html?content=database', { waitUntil: 'domcontentloaded' });
    await hub.waitForFunction(() => typeof loadCustomCards === 'function');
    const hubCards = await hub.evaluate(async () => (await loadCustomCards()).map(card => ({ id: card.id, source: card.contentSource, url: card.cardUrl })));
    assert.equal(hubCards.length, 14);
    assert.ok(hubCards.every(card => card.source === 'database' && card.url.includes('custom-card.html?id=')));

    const pickerPage = await context.newPage();
    await pickerPage.goto('http://127.0.0.1:3000/DokkanCustom/card.html?id=4031731&style=abs.clean&content=database', { waitUntil: 'domcontentloaded' });
    await pickerPage.waitForFunction(() => typeof window.toggleViewerCardPicker === 'function' && window.DokkanUnitPicker && window.DB?.cards?.length);
    await pickerPage.evaluate(() => {
        localStorage.setItem('hub_cached_custom_only', JSON.stringify([{ id: 'stale-archive', name: 'STALE ARCHIVED CARD', source: 'custom' }]));
        if (!document.body.classList.contains('viewer-picker-open')) toggleViewerCardPicker();
    });
    await pickerPage.locator('.picker-source-tab').filter({ hasText: /^Custom$/ }).click();
    try {
        await pickerPage.waitForFunction(() => document.querySelectorAll('#viewer-card-picker-results .viewer-card-picker-result').length === 14);
    } catch (error) {
        console.error(JSON.stringify(await pickerPage.evaluate(() => ({ count: document.querySelectorAll('#viewer-card-picker-results .viewer-card-picker-result').length, text: document.getElementById('viewer-card-picker')?.textContent?.slice(0,1800), enabled: CardContent.enabled(), ready: document.readyState })), null, 2));
        throw error;
    }
    assert.equal(await pickerPage.getByText('STALE ARCHIVED CARD', { exact: true }).count(), 0);
    const pickerLinks = await pickerPage.locator('#viewer-card-picker-results .viewer-card-picker-result').count();
    assert.equal(pickerLinks, 14);
    }

    const shared = await context.newPage();
    async function ready(view, cardId) {
        try {
            await view.waitForFunction(id => window.absCardContentReady && window.currentContentCard?.id === id, cardId, { timeout: 45000 });
        } catch (error) {
            console.error(JSON.stringify(await view.evaluate(() => ({ url: location.href, ready: window.absCardContentReady, card: window.currentContentCard?.id, error: document.getElementById('abs-loading-screen')?.innerText, body: document.body.innerText.slice(0,700), scripts: [...document.scripts].map(script => script.src).filter(Boolean) })), null, 2));
            throw error;
        }
        await view.evaluate(() => switchCardTheme('abs-clean'));
        await view.waitForFunction(() => !document.getElementById('abs-loading-screen') || document.getElementById('abs-loading-screen').getAttribute('aria-hidden') === 'true', null, { timeout: 20000 });
    }
    await shared.goto('http://127.0.0.1:3000/DokkanCustom/custom-card.html?id=' + id, { waitUntil: 'domcontentloaded' });
    await ready(shared, id);
    for (const destination of [alternateId, targetId]) {
        const link = shared.locator('#layout-abs-clean a.abs-transform-link[href*="custom-card.html?id=' + destination + '"]');
        assert.equal(await link.count(), 1, 'A-B and A-C become visible buttons after a real Worker save');
        const popup = shared.waitForEvent('popup');
        await link.click();
        const targetPage = await popup;
        await ready(targetPage, destination);
        assert.equal(await targetPage.locator('#layout-abs-clean a.abs-transform-link[href*="custom-card.html?id=' + id + '"]').count(), 1, 'Each saved target exposes the reciprocal button');
        await targetPage.close();
    }
    const beforeUnlinkA = (await publicCardDetail(fixture.env.CONTENT_DB, id)).card;
    const beforeUnlinkB = (await publicCardDetail(fixture.env.CONTENT_DB, alternateId)).card;
    assert.equal(beforeUnlinkB.linkedCards.some(card => card.id === targetId), false, 'A-B plus A-C never invents B-C');
    const unlink = await fixture.request('/api/content/links/apply', { method: 'POST', cookie: active.cookie, csrf: active.csrfToken, payload: {
        operations: [{ action: 'unlink', sourceSlug: id, targetSlug: alternateId }], expectedRevisions: { [id]: beforeUnlinkA.revision, [alternateId]: beforeUnlinkB.revision }
    } });
    assert.equal(unlink.status, 200, await unlink.clone().text());
    await shared.reload({ waitUntil: 'domcontentloaded' });
    await ready(shared, id);
    assert.equal(await shared.locator('#layout-abs-clean a.abs-transform-link[href*="id=' + alternateId + '"]').count(), 0);
    assert.equal(await shared.locator('#layout-abs-clean a.abs-transform-link[href*="id=' + targetId + '"]').count(), 1, 'Unlinking A-B preserves A-C');
    const afterUnlinkB = (await publicCardDetail(fixture.env.CONTENT_DB, alternateId)).card;
    assert.deepEqual(afterUnlinkB.builtinForms, beforeUnlinkB.builtinForms, 'Built-in transformations survive unlink');
    assert.equal(afterUnlinkB.payload.containers.links, beforeUnlinkB.payload.containers.links, 'Gameplay link skills survive unlink');
    const beforeArchive = (await publicCardDetail(fixture.env.CONTENT_DB, targetId)).card;
    const archive = await fixture.request('/api/content/cards/' + targetId + '/archive', { method: 'POST', cookie: active.cookie, csrf: active.csrfToken, payload: { expectedRevision: beforeArchive.revision } });
    assert.equal(archive.status, 200);
    await shared.reload({ waitUntil: 'domcontentloaded' });
    await ready(shared, id);
    assert.equal(await shared.locator('#layout-abs-clean a.abs-transform-link[href*="id=' + targetId + '"]').count(), 0, 'Archived target disappears from actual form navigation');
    assert.equal((await fixture.request('/api/public/cards/' + targetId)).status, 404);
    const relevantErrors = errors.filter(message => !/JSZip|LWF|Failed to fetch|NetworkError|fetch/i.test(message));
    assert.deepEqual(relevantErrors, []);
    assert.equal(fixture.writes.length, 0, 'Content writes never reach the GitHub repository');
    console.log('PASS: real Worker/editor/publisher/calculator/hub/picker; shared Gohan-Ultra Ego-Frieza save/reload/click/unlink/archive; built-in/gameplay preservation; zero provider writes.');
} finally { await browser.close(); globalThis.fetch = realFetch; fixture.contentSql.close(); fixture.sql.close(); }
