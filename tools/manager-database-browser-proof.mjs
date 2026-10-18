// End-to-end Manager pilot proof against the real Worker handlers and an isolated SQLite CONTENT_DB.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'file:///C:/Users/Ruffy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import worker from '../services/manager-auth/src/worker.mjs';
import { contentFixture } from '../services/manager-auth/test/content-fixture.mjs';
import { buildContentImportBundle, DEFAULT_SOURCE_ROOT } from '../services/manager-auth/src/content-import.mjs';
import { applyImportBundle } from '../services/manager-auth/src/content-store.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');

const mime = file => ({
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
    '.ico': 'image/x-icon'
}[path.extname(file)] || 'application/octet-stream');

const f = contentFixture();
const originalFetch = globalThis.fetch;
let browser;
let server;
let active;
let local;
const apiCalls = [];
const bridgeErrors = [];
const pageErrors = [];
const missingFiles = [];

try {
    globalThis.fetch = f.provider;
    const bundle = await buildContentImportBundle({ sourceRoot: DEFAULT_SOURCE_ROOT });
    assert.equal(bundle.status, 'ready', JSON.stringify(bundle.report.blockers));
    assert.equal(bundle.report.cardCount, 14);
    await applyImportBundle(f.env.CONTENT_DB, bundle);

    const existing = new Set(bundle.edges.map(edge => `${edge.leftId}\u0000${edge.rightId}`));
    const isLinked = (left, right) => {
        const [a, b] = [left, right].sort();
        return existing.has(`${a}\u0000${b}`);
    };
    const publishedIds = bundle.cards.filter(card => card.status === 'published').map(card => card.id);
    let trio = null;
    for (let i = 0; i < publishedIds.length && !trio; i += 1) {
        for (let j = i + 1; j < publishedIds.length && !trio; j += 1) {
            for (let k = j + 1; k < publishedIds.length; k += 1) {
                const candidate = [publishedIds[i], publishedIds[j], publishedIds[k]];
                if (!isLinked(candidate[0], candidate[1]) && !isLinked(candidate[1], candidate[2])
                    && !isLinked(candidate[0], candidate[2])) {
                    trio = candidate;
                    break;
                }
            }
        }
    }
    assert.ok(trio, 'the imported catalog needs three mutually unlinked published cards for the browser proof');
    const [alpha, beta, gamma] = trio;
    active = await f.login();

    server = http.createServer(async (req, res) => {
        try {
            const url = new URL(req.url, 'http://manager-fixture');
            if (url.pathname === '/js/manager-auth-config.js') {
                res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
                res.end('window.MANAGER_AUTH_CONFIG = Object.freeze(' + JSON.stringify({
                    workerOrigin: f.env.MANAGER_ORIGIN,
                    pagesOrigin: 'https://abscustom.github.io',
                    localWorkerOrigin: local
                }) + ');');
                return;
            }
            if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) {
                const chunks = [];
                for await (const chunk of req) chunks.push(chunk);
                const body = Buffer.concat(chunks);
                const headers = new Headers(req.headers);
                headers.set('Cookie', active.cookie);
                if (headers.get('Origin') === local) headers.set('Origin', f.env.MANAGER_ORIGIN);
                const method = req.method || 'GET';
                const request = new Request(f.env.MANAGER_ORIGIN + req.url, {
                    method,
                    headers,
                    ...(['GET', 'HEAD'].includes(method) || !body.length ? {} : { body })
                });
                if (url.pathname.startsWith('/api/')) {
                    apiCalls.push({
                        path: url.pathname,
                        method,
                        body: body.length ? JSON.parse(body.toString('utf8')) : null
                    });
                }
                const response = await worker.fetch(request, f.env);
                res.statusCode = response.status;
                for (const [key, value] of response.headers) {
                    if (key.toLowerCase() !== 'set-cookie') res.setHeader(key, value);
                }
                const cookies = response.headers.getSetCookie?.() || [];
                if (cookies.length) res.setHeader('Set-Cookie', cookies);
                res.end(Buffer.from(await response.arrayBuffer()));
                return;
            }

            const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '');
            const file = path.resolve(root, relative);
            if (file !== root && !file.startsWith(root + path.sep)) {
                res.writeHead(403); res.end(); return;
            }
            try {
                res.writeHead(200, { 'Content-Type': mime(file) });
                res.end(await fs.readFile(file));
            } catch {
                if (/\.(?:js|css)$/i.test(file)) missingFiles.push(url.pathname);
                res.writeHead(404); res.end();
            }
        } catch (error) {
            bridgeErrors.push(String(error?.message || error));
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end('{"error":{"code":"FIXTURE_BRIDGE_FAILED"}}');
        }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    local = `http://127.0.0.1:${server.address().port}`;

    browser = await chromium.launch({
        executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
        headless: true
    });
    const context = await browser.newContext({ viewport: { width: 1360, height: 960 } });
    await context.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.origin === local) {
            await route.continue();
            return;
        }
        if (/\.(?:png|webp|jpg|jpeg|gif|ico)(?:\?|$)/i.test(url.href)) {
            await route.fulfill({ status: 200, contentType: 'image/png', body: image });
            return;
        }
        await route.fulfill({ status: 200, contentType: 'text/css', body: '' });
    });

    const page = await context.newPage();
    page.on('pageerror', error => pageErrors.push(error.message));
    page.on('console', message => {
        const text = message.text();
        if (message.type() === 'error' && !/server responded with a status of 409 \(Conflict\)/i.test(text)) {
            pageErrors.push(`console: ${text}`);
        }
    });
    page.on('requestfailed', request => pageErrors.push(`request: ${request.url()} ${request.failure()?.errorText || ''}`));
    page.on('response', response => {
        if (response.url().startsWith(local) && response.status() === 404) missingFiles.push(new URL(response.url()).pathname);
    });
    await page.goto(local + '/manager.html?content=database');
    try {
        await page.waitForFunction(() => window.CardAdminCoins?.getSnapshot().authenticated
            && window.CardAdminCoins.getSnapshot().cards.length === 14, null, { timeout: 12000 });
    } catch (error) {
        console.error(JSON.stringify({
            url: page.url(), body: await page.locator('body').innerText().catch(() => ''),
            auth: await page.evaluate(() => ({
                config: window.MANAGER_AUTH_CONFIG,
                manager: window.ManagerAuth && { enabled: window.ManagerAuth.enabled, databaseMode: window.ManagerAuth.databaseMode },
                state: window.CardAdminCoins?.getSnapshot()
            })).catch(() => null),
            apiCalls, bridgeErrors, pageErrors, missingFiles
        }, null, 2));
        throw error;
    }
    assert.equal(await page.locator('#manager-content-mode').textContent(), 'Database pilot');

    const coin = slug => page.locator(`[data-coin-slug="${slug}"]`);
    await coin(alpha).focus();
    await page.keyboard.press('Enter');
    const accessibleCoin = await page.evaluate(() => {
        const node = document.activeElement;
        const describedBy = node.getAttribute('aria-describedby');
        const description = document.getElementById(describedBy);
        return {
            tagName: node.tagName,
            slug: node.dataset.coinSlug,
            label: node.getAttribute('aria-label'),
            pressed: node.getAttribute('aria-pressed'),
            descriptionRole: description?.getAttribute('role')
        };
    });
    assert.equal(accessibleCoin.tagName, 'BUTTON');
    assert.equal(accessibleCoin.slug, alpha, 'keyboard selection retains focus after the workspace rerenders');
    assert.match(accessibleCoin.label, /selected first card/i);
    assert.equal(accessibleCoin.pressed, 'true');
    assert.equal(accessibleCoin.descriptionRole, 'status');

    const selectPair = async (left, right) => {
        const clearBoth = page.locator('#manager-coin-new-pair');
        if (await clearBoth.isEnabled()) await clearBoth.click();
        await coin(left).click();
        await coin(right).click();
    };
    const linkPosts = () => apiCalls.filter(call => call.path === '/api/content/links/apply' && call.method === 'POST');

    await selectPair(alpha, beta);
    await page.locator('#manager-coin-link-selected').click();
    assert.equal((await page.evaluate(() => window.ManagerLinkerCoins.getState())).staged.length, 1);
    assert.equal(linkPosts().length, 0, 'staging must not submit a write');
    await page.locator('#manager-coin-undo').click();
    assert.equal((await page.evaluate(() => window.ManagerLinkerCoins.getState())).staged.length, 0, 'Undo clears the staged pair');
    await coin(beta).click();
    await page.locator('#manager-coin-link-selected').click();
    assert.equal(linkPosts().length, 0, 'staging again still waits for Apply');
    await page.locator('#manager-coin-apply').click();
    await page.waitForFunction(({ alpha, beta }) => window.CardAdminCoins.getSnapshot().cards
        .find(card => card.slug === alpha)?.links.includes(beta), { alpha, beta });
    assert.deepEqual(linkPosts()[0].body.operations, [{ action: 'link', sourceSlug: alpha, targetSlug: beta }]);
    assert.ok(linkPosts()[0].body.expectedRevisions[alpha] >= 1);
    assert.ok(linkPosts()[0].body.expectedRevisions[beta] >= 1);
    assert.equal(f.writes.length, 0, 'content writes do not create GitHub commits');

    await page.reload();
    await page.waitForFunction(({ alpha, beta }) => window.CardAdminCoins?.getSnapshot().authenticated
        && window.CardAdminCoins.getSnapshot().cards.find(card => card.slug === beta)?.links.includes(alpha), { alpha, beta });

    const beforeConflict = await page.evaluate(() => window.CardAdminCoins.getSnapshot().cards
        .map(card => ({ id: card.id, revision: card.revision })));
    await selectPair(alpha, beta);
    await page.locator('#manager-coin-unlink-selected').click();
    const removalState = await page.evaluate(() => window.ManagerLinkerCoins.getState());
    assert.equal(removalState.staged.length, 1);
    assert.equal(removalState.staged[0][1].value, false);
    assert.ok(removalState.visiblePairs.some(pair => pair.includes(removalState.staged[0][1].baseSlug)
        && pair.includes(removalState.staged[0][1].otherSlug)), 'a pending removal keeps its saved connector visible');
    const preConflictLines = await page.locator('#manager-coin-links line').evaluateAll(lines => lines.map(line => ({
        from: line.dataset.linkFrom, to: line.dataset.linkTo, removing: line.classList.contains('is-removing')
    })));
    assert.ok(preConflictLines.some(line => line.removing
        && [line.from, line.to].includes(alpha) && [line.from, line.to].includes(beta)), 'a pending removal is visibly marked');

    const currentRevision = Object.fromEntries(beforeConflict.map(card => [card.id, card.revision]));
    const raced = await f.request('/api/content/links/apply', {
        method: 'POST', cookie: active.cookie, csrf: active.csrfToken,
        payload: {
            operations: [{ action: 'link', sourceSlug: alpha, targetSlug: gamma }],
            expectedRevisions: { [alpha]: currentRevision[alpha], [gamma]: currentRevision[gamma] }
        }
    });
    assert.equal(raced.status, 200, await raced.clone().text());

    const beforeConflictPosts = linkPosts().length;
    await page.locator('#manager-coin-apply').click();
    await page.waitForFunction(() => document.getElementById('card-admin-status')?.textContent
        .includes('Another Manager edit changed a card'));
    assert.equal(linkPosts().length, beforeConflictPosts + 1, 'conflict is not retried automatically');
    const refreshedConflictState = await page.evaluate(() => window.ManagerLinkerCoins.getState());
    assert.equal(refreshedConflictState.staged.length, 1, 'staged work remains after a revision conflict');
    const conflictStage = refreshedConflictState.staged[0];
    assert.equal(conflictStage[1].value, false, 'the pending removal does not flip into a link after refresh');
    assert.ok(refreshedConflictState.edges.includes(conflictStage[0]), 'the saved edge remains present until the pending removal is explicitly applied');
    assert.ok(refreshedConflictState.visiblePairs.some(pair => pair.join('\u0000') === conflictStage[0]),
        'the refreshed pending removal remains visible in the workspace');
    assert.equal(new Set(refreshedConflictState.staged.map(([edge]) => edge)).size, refreshedConflictState.staged.length,
        'one pair cannot acquire contradictory staged actions after refresh');
    const conflictLines = await page.locator('#manager-coin-links line').evaluateAll(lines => lines.map(line => ({
        from: line.dataset.linkFrom, to: line.dataset.linkTo, removing: line.classList.contains('is-removing')
    })));
    assert.ok(conflictLines.some(line => line.removing
        && [line.from, line.to].includes(alpha) && [line.from, line.to].includes(beta)),
        'the 409 refresh preserves the pending removal marker');
    assert.equal((await page.evaluate(gamma => window.CardAdminCoins.getSnapshot().cards
        .find(card => card.slug === gamma)?.revision, gamma)), currentRevision[gamma] + 1,
        'the catalog refreshes to the conflicting revision');

    await page.locator('#manager-coin-apply').click();
    await page.waitForFunction(({ alpha, beta }) => !window.CardAdminCoins.getSnapshot().cards
        .find(card => card.slug === alpha)?.links.includes(beta), { alpha, beta });
    assert.equal(linkPosts().length, beforeConflictPosts + 2, 'a second request occurs only after explicit Apply');
    assert.deepEqual(linkPosts().at(-1).body.operations, [{ action: 'unlink', sourceSlug: alpha, targetSlug: beta }]);
    assert.equal(linkPosts().at(-1).body.expectedRevisions[alpha], currentRevision[alpha] + 1);
    await page.reload();
    await page.waitForFunction(({ alpha, beta }) => window.CardAdminCoins?.getSnapshot().authenticated
        && !window.CardAdminCoins.getSnapshot().cards.find(card => card.slug === alpha)?.links.includes(beta), { alpha, beta });

    await selectPair(beta, gamma);
    await page.locator('#manager-coin-link-selected').click();
    assert.equal(linkPosts().length, beforeConflictPosts + 2, 'a pending link also waits for explicit Apply');
    await page.locator('#manager-coin-apply').click();
    await page.waitForFunction(({ beta, gamma }) => window.CardAdminCoins.getSnapshot().cards
        .find(card => card.slug === beta)?.links.includes(gamma), { beta, gamma });
    await page.reload();
    await page.waitForFunction(({ beta, gamma }) => window.CardAdminCoins?.getSnapshot().authenticated
        && window.CardAdminCoins.getSnapshot().cards.find(card => card.slug === beta)?.links.includes(gamma), { beta, gamma });
    assert.equal(f.writes.length, 0, 'link, unlink and refresh never write card files to GitHub');

    await page.locator(`[data-card-admin-delete="${gamma}"]`).click();
    await page.locator('#card-admin-delete-confirm').fill(gamma);
    await page.locator('#card-admin-delete-confirm-button').click();
    await page.waitForFunction(gamma => window.CardAdminCoins.getSnapshot().cards.length === 13
        && !window.CardAdminCoins.getSnapshot().cards.some(card => card.slug === gamma), gamma);
    assert.equal(await page.locator('#card-admin-delete-confirm-button').textContent(), 'Archive From Catalog');
    assert.equal(apiCalls.filter(call => call.path === `/api/content/cards/${gamma}/archive` && call.method === 'POST').length, 1);
    assert.equal(apiCalls.some(call => ['/api/cards/delete', '/api/links/apply'].includes(call.path) && call.method === 'POST'), false,
        'database Manager does not call legacy write routes');
    assert.equal((await f.env.CONTENT_DB.prepare('SELECT status FROM cards WHERE id=?').bind(gamma).first())?.status, 'archived');
    assert.ok((await f.env.CONTENT_DB.prepare('SELECT COUNT(*) AS count FROM card_revisions WHERE card_id=?').bind(gamma).first()).count >= 2,
        'archive retains the card revision history');
    const publicCatalog = await f.request('/api/public/cards');
    const publicIdsAfterArchive = await f.env.CONTENT_DB.prepare("SELECT id FROM cards WHERE status='published' ORDER BY id").all();
    assert.deepEqual((await publicCatalog.json()).cards.map(card => card.id), publicIdsAfterArchive.results.map(card => card.id));
    const archivedDetail = await f.request(`/api/public/cards/${encodeURIComponent(gamma)}`);
    assert.equal(archivedDetail.status, 404);
    assert.equal(f.writes.length, 0);
    assert.deepEqual(bridgeErrors, []);
    assert.deepEqual(pageErrors, []);
    assert.deepEqual(missingFiles, []);

    const legacyLinks = await f.request('/api/links/apply', {
        method: 'POST', cookie: active.cookie, csrf: active.csrfToken,
        payload: { operations: [] }
    });
    assert.equal(legacyLinks.status, 503);
    assert.equal((await legacyLinks.json()).error.code, 'CONTENT_WRITES_ACTIVE');
    assert.equal(f.writes.length, 0, 'the Worker legacy GitHub writer stays locked when database ownership is active');

    console.log('PASS: real Manager Worker catalog, explicit Apply, Undo, reciprocal link and unlink persistence, stale-revision staging/retry, archive visibility and retained history; zero GitHub writes.');
    await context.close();
} finally {
    await browser?.close();
    if (server) await new Promise(resolve => server.close(resolve));
    f.contentSql.close();
    f.sql.close();
    globalThis.fetch = originalFetch;
}
