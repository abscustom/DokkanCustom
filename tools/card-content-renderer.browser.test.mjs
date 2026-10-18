import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildContentImportBundle, DEFAULT_SOURCE_ROOT } from '../services/manager-auth/src/content-import.mjs';

const playwrightPath = process.env.PLAYWRIGHT_MODULE_PATH
    || 'C:/Users/Ruffy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const { chromium } = await import(pathToFileURL(playwrightPath).href);
const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const workspaceRoot = path.dirname(repoRoot);
const publishedRoot = path.join(workspaceRoot, 'abscustom');
const cardsRoot = path.join(publishedRoot, 'Custom Cards');
const rollbackRoot = path.join(repoRoot, 'docs', 'abs-refresh', 'reports', 'database-migration-20261017', 'rollback-pages');
const fallbackImage = 'https://abscustom.github.io/assets/images/abs.style.png';
const fallbackImagePath = path.join(publishedRoot, 'assets', 'images', 'abs.style.png');
const viewerStyles = ['dokkaninfo', 'abs-style', 'abs-clean', 'phantom'];
const cardArtNetworkTraces = new WeakMap();

function instrumentLoadingScreenSource(source) {
    if (process.env.CARD_CONTENT_TEST_LIFECYCLE_PROBE !== '1') return source;
    let result = String(source);
    const replaceOnce = (needle, replacement, label) => {
        const first = result.indexOf(needle);
        if (first < 0 || result.indexOf(needle, first + needle.length) >= 0) {
            throw new Error(`Could not install unique loading-screen probe at ${label}`);
        }
        result = result.slice(0, first) + replacement + result.slice(first + needle.length);
    };
    replaceOnce(
        'const images = getEssentialImages(contentRoot);',
        `const images = getEssentialImages(contentRoot);
        window.__loaderLifecycle?.push({ at: Math.round(performance.now()), event: 'essential-images-selected', images: images.map(image => ({ id: image.id, src: image.getAttribute('src') || '', currentSrc: image.currentSrc || '', complete: image.complete, naturalWidth: image.naturalWidth })) });`,
        'essential image selection'
    );
    replaceOnce(
        'const finish = result => {',
        `const finish = result => {
                    window.__loaderLifecycle?.push({ at: Math.round(performance.now()), event: 'essential-image-settled', result, id: image.id, src: image.currentSrc || image.src || '', complete: image.complete, naturalWidth: image.naturalWidth });`,
        'essential image settle'
    );
    replaceOnce(
        'const timer = window.setTimeout(() => finish(false), 8000);',
        `const timer = window.setTimeout(() => {
                    window.__loaderLifecycle?.push({ at: Math.round(performance.now()), event: 'essential-image-timeout', id: image.id, src: image.currentSrc || image.src || '' });
                    finish(false);
                }, 8000);`,
        'essential image deadline'
    );
    replaceOnce(
        'const [, imagesReady] = await Promise.all([',
        `const imageGateStartedAt = performance.now();
        window.__loaderLifecycle?.push({ at: Math.round(imageGateStartedAt), event: 'essential-image-gate-start' });
        const [, imagesReady] = await Promise.all([`,
        'image gate start'
    );
    replaceOnce(
        'if (!imagesReady) {',
        `window.__loaderLifecycle?.push({ at: Math.round(performance.now()), event: 'essential-image-gate-settled', imagesReady, elapsedMs: Math.round(performance.now() - imageGateStartedAt) });
        if (!imagesReady) {`,
        'image gate result'
    );
    return result;
}

function trackCardArtRequests(page) {
    const events = [];
    const startedAt = new WeakMap();
    const matches = request => /\/card_art\.(?:png|jpe?g|webp|mp4|webm)(?:[?#]|$)/i.test(request.url());
    page.on('request', request => {
        if (!matches(request)) return;
        const started = Date.now();
        startedAt.set(request, started);
        events.push({ event: 'request', at: started, method: request.method(), url: request.url() });
    });
    page.on('response', response => {
        if (!matches(response.request())) return;
        events.push({ event: 'response', at: Date.now(), status: response.status(), url: response.url(), elapsedMs: Date.now() - (startedAt.get(response.request()) || Date.now()) });
    });
    page.on('requestfinished', request => {
        if (!matches(request)) return;
        events.push({ event: 'finished', at: Date.now(), url: request.url(), elapsedMs: Date.now() - (startedAt.get(request) || Date.now()) });
    });
    page.on('requestfailed', request => {
        if (!matches(request)) return;
        events.push({ event: 'failed', at: Date.now(), url: request.url(), error: request.failure()?.errorText || '', elapsedMs: Date.now() - (startedAt.get(request) || Date.now()) });
    });
    cardArtNetworkTraces.set(page, events);
    return events;
}

async function summarizeCardArtTrace(page) {
    const lifecycle = await page.evaluate(() => window.__cardArtLifecycle || []).catch(() => []);
    const byElement = new Map();
    for (const event of lifecycle) {
        if (!/abs-art-/.test(event.id || '') && event.id !== 'myOverlayImage') continue;
        const key = `${event.layout || '(no layout)'}/${event.id || '(no id)'}`;
        const summary = byElement.get(key) || { element: key, srcAssignments: [], loads: [], errors: [] };
        if (event.event === 'attribute:src' || event.event === 'property:src') {
            summary.srcAssignments.push({ at: event.at, src: event.src, currentSrc: event.currentSrc, assignedSrc: event.assignedSrc || '', previousSrc: event.previousSrc || '', previousCurrentSrc: event.previousCurrentSrc || '', complete: event.complete, naturalWidth: event.naturalWidth, connected: event.connected, stack: event.stack || [] });
        } else if (event.event === 'load') {
            summary.loads.push({ at: event.at, src: event.src, currentSrc: event.currentSrc, naturalWidth: event.naturalWidth, connected: event.connected });
        } else if (event.event === 'error') {
            summary.errors.push({ at: event.at, src: event.src, currentSrc: event.currentSrc, naturalWidth: event.naturalWidth, connected: event.connected });
        }
        byElement.set(key, summary);
    }
    const network = cardArtNetworkTraces.get(page) || [];
    const firstAt = network[0]?.at || 0;
    return {
        media: [...byElement.values()].filter(item => item.srcAssignments.length || item.loads.length || item.errors.length),
        decode: lifecycle.filter(event => event.event.startsWith('decode:')),
        loader: await page.evaluate(() => window.__loaderLifecycle || []).catch(() => []),
        fixtures: fixtureAssetEvents.slice(),
        requests: network.map(event => ({ ...event, at: firstAt ? event.at - firstAt : event.at }))
    };
}

async function saveCardArtTrace(page, id, phase, failed = false) {
    if (process.env.CARD_CONTENT_TEST_LIFECYCLE_PROBE !== '1') return;
    const trace = { id, phase, failed, ...(await summarizeCardArtTrace(page)) };
    const tag = process.env.CARD_CONTENT_TEST_PROBE_TAG ? `-${process.env.CARD_CONTENT_TEST_PROBE_TAG}` : '';
    await writeFile(path.join(evidenceDirectory, `cold-phantom-${phase}${tag}.json`), `${JSON.stringify(trace, null, 2)}\n`);
}

async function loadFixtures() {
    assert.equal(path.resolve(DEFAULT_SOURCE_ROOT), path.resolve(cardsRoot), 'the browser fixture uses the importer source directory');
    const bundle = await buildContentImportBundle({ sourceRoot: DEFAULT_SOURCE_ROOT });
    assert.equal(bundle.status, 'ready', 'the actual import bundle is ready for a database read fixture');
    assert.equal(bundle.report.importableCount, 14, 'the importer normalizes all 14 source cards');
    assert.equal(bundle.report.directEdgeCount, 4, 'the importer identifies all four direct card relationships');
    assert.deepEqual(bundle.report.unresolvedReferences, [], 'all managed and authored form references resolve');
    assert.deepEqual(bundle.report.blockers, [], 'all imported media references resolve');

    const cards = new Map(bundle.cards.map(card => [card.id, {
        ...card,
        revision: 1,
        updatedAt: '2026-10-17T00:00:00.000Z',
        linkedCards: []
    }]));
    const directPairs = new Set(bundle.edges.map(edge => [edge.leftId, edge.rightId].sort().join('\n')));
    for (const edge of bundle.edges) {
        const left = cards.get(edge.leftId), right = cards.get(edge.rightId);
        assert.ok(left && right, `both records exist for imported relationship ${edge.leftId} ↔ ${edge.rightId}`);
        const summary = card => ({
            id: card.id, slug: card.slug, revision: card.revision,
            name: card.name, title: card.title, type: card.type, rarity: card.rarity,
            thumb: card.thumb, repoPath: card.repoPath, assetBase: card.assetBase
        });
        left.linkedCards.push(summary(right));
        right.linkedCards.push(summary(left));
    }
    return { cards, aliases: new Map(bundle.aliases.map(alias => [alias.path, alias.cardId])), directPairs, bundle };
}

async function openLegacySnapshotCard(context, id) {
    const sourceDirectory = path.join(rollbackRoot, 'Custom Cards', id);
    const card = JSON.parse(await readFile(path.join(sourceDirectory, 'card.json'), 'utf8'));
    const page = await context.newPage();
    const pageErrors = [];
    const failedRequests = [];
    trackCardArtRequests(page);
    page.setDefaultTimeout(15000);
    page.on('pageerror', error => pageErrors.push(error.message));
    page.on('requestfailed', request => failedRequests.push({ url: request.url(), error: request.failure()?.errorText || '' }));
    page.on('console', message => { if (message.type() === 'error') pageErrors.push(message.text()); });
    await page.goto(`https://abscustom.github.io/Custom%20Cards/${encodeURIComponent(id)}/index.html`, { waitUntil: 'domcontentloaded' });
    try {
        await page.waitForFunction(() => window.absCardContentReady, null, { timeout: 20000 });
    } catch (error) {
        const diagnostic = await page.evaluate(() => ({
            url: location.href, title: document.title, body: document.body?.innerText?.slice(0, 900),
            loader: document.getElementById('abs-loading-screen')?.outerHTML?.slice(0, 1200),
            ready: window.absCardContentReady || false,
            scripts: [...document.scripts].map(script => ({ src: script.src, readyState: script.readyState, loaded: script.dataset.loaded || '' }))
        })).catch(() => null);
        console.error(JSON.stringify({ legacyId: id, diagnostic, pageErrors, cardArtNetwork: cardArtNetworkTraces.get(page) }));
        throw error;
    }
    await page.waitForFunction(() => {
        const loader = document.getElementById('abs-loading-screen');
        return !loader || loader.dataset.loaderError === 'true' || getComputedStyle(loader).display === 'none';
    }, null, { timeout: 20000 });
    const loaderError = await page.locator('#abs-loading-screen').getAttribute('data-loader-error');
    if (loaderError === 'true') {
        const diagnostic = await page.evaluate(() => ({
            body: document.body?.innerText?.slice(0, 900),
            loader: document.getElementById('abs-loading-screen')?.outerHTML?.slice(0, 1400),
            url: location.href,
            currentCard: window.currentContentCard?.id || null,
            contentReady: window.absCardContentReady || false,
            shellReady: window.absShellReady || false,
            navigation: typeof window.absNavigation,
            mainSidebar: Boolean(document.getElementById('abs-main-sidebar')),
            essentialImages: [...document.querySelectorAll('#abs-art-img,[data-card-element="abs-art-img"],#myOverlayImage,#calc-char-thumb,.char-img,.thumb-img,.form-image,.hub-circle-img,.tl-char-img,.sba-showcase-art-poster,[data-loader-essential]')]
                .filter(image => {
                    const style = getComputedStyle(image), rect = image.getBoundingClientRect();
                    return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 && rect.top < innerHeight && rect.left < innerWidth;
                }).map(image => ({ src: image.currentSrc || image.src || '', complete: image.complete, naturalWidth: image.naturalWidth, rect: image.getBoundingClientRect().toJSON() })),
            scripts: [...document.scripts].map(script => ({ src: script.src, loaded: script.dataset.loaded || '' }))
        }));
        console.error(JSON.stringify({ legacyId: id, diagnostic, pageErrors, failedRequests, cardArtNetwork: cardArtNetworkTraces.get(page) }));
    }
    assert.notEqual(loaderError, 'true', `${id}: the materialized legacy card page loads without the startup error overlay`);
    return { page, card };
}

async function assertLoaderReleased(page, id, phase) {
    await page.waitForFunction(() => {
        const loader = document.getElementById('abs-loading-screen');
        return !loader || loader.dataset.loaderError === 'true' || loader.classList.contains('is-hidden') || getComputedStyle(loader).display === 'none';
    }, null, { timeout: 30000 });
    let state = await page.evaluate(() => {
        const loader = document.getElementById('abs-loading-screen');
        return {
            error: loader?.dataset.loaderError === 'true',
            hidden: !loader || loader.classList.contains('is-hidden') || getComputedStyle(loader).display === 'none',
            message: loader?.innerText || '',
            cardArt: {
                id: window.currentContentCard?.id || null,
                assetBase: window.currentContentCard?.assetBase || '',
                imageUrl: window.currentContentCard?.cardArtImageUrl || '',
                videoUrl: window.currentContentCard?.cardArtVideoUrl || '',
                projectImage: document.getElementById('abs-art-img')?.currentSrc || document.getElementById('abs-art-img')?.src || '',
                projectVideo: document.getElementById('abs-art-video')?.currentSrc || document.getElementById('abs-art-video')?.src || ''
            },
            essentialImages: [...document.querySelectorAll('#abs-art-img,[data-card-element="abs-art-img"],#myOverlayImage,#calc-char-thumb,.char-img,.thumb-img,.form-image,.hub-circle-img,.tl-char-img,.sba-showcase-art-poster,[data-loader-essential]')]
                .filter(image => {
                    const style = getComputedStyle(image), rect = image.getBoundingClientRect();
                    return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 && rect.top < innerHeight && rect.left < innerWidth;
                }).map(image => ({ src: image.currentSrc || image.src || '', complete: image.complete, naturalWidth: image.naturalWidth, loading: image.loading, markup: image.outerHTML.slice(0, 500) })),
            cardArtResources: performance.getEntriesByType('resource').filter(entry => entry.name.includes('/6231448-vegeta-ultra-ego/card_art.png'))
                .map(entry => ({ name: entry.name, duration: entry.duration, responseEnd: entry.responseEnd, transferSize: entry.transferSize, decodedBodySize: entry.decodedBodySize }))
        };
    });
    if (state.error) {
        await page.waitForTimeout(process.env.CARD_CONTENT_TEST_LIFECYCLE_PROBE === '1' ? 10000 : 1200);
        state = { ...state, settledAfterError: await page.evaluate(() => [...document.querySelectorAll('#abs-art-img,[data-card-element="abs-art-img"]')]
            .map(image => ({ src: image.currentSrc || image.src || '', complete: image.complete, naturalWidth: image.naturalWidth }))) };
    }
    if (state.error || !state.hidden) {
        state = {
            ...state,
            imageLifecycle: await page.evaluate(() => window.__cardArtLifecycle || []).catch(() => []),
            loaderLifecycle: await page.evaluate(() => window.__loaderLifecycle || []).catch(() => []),
            networkTrace: cardArtNetworkTraces.get(page) || []
        };
        console.error(JSON.stringify({ id, phase, loader: state, failedRequests: requestFailures, cardArtAssetEvents: fixtureAssetEvents }));
        if (phase === 'database viewer startup') await saveCardArtTrace(page, id, 'database-startup', true);
    }
    assert.equal(state.error, false, `${id}: ${phase} must not leave the startup error overlay`);
    assert.equal(state.hidden, true, `${id}: ${phase} must reveal the page before interaction`);
}

async function routeEnabledCardContentConfig(page, apiOrigin) {
    await page.route('**/js/card-content-config.js*', route => route.fulfill({
        status: 200,
        contentType: 'text/javascript',
        body: `window.CARD_CONTENT_CONFIG = Object.freeze({ enabled: true, apiOrigin: ${JSON.stringify(apiOrigin)} });`
    }));
}

const { cards, aliases, directPairs, bundle } = await loadFixtures();
const selectedCardId = process.env.CARD_CONTENT_TEST_ID || process.argv[2] || '';
const initialTheme = process.env.CARD_CONTENT_TEST_THEME || process.argv[3] || '';
const legacyProbeOnly = process.env.CARD_CONTENT_TEST_LEGACY_ONLY === '1';
const startupOnly = process.env.CARD_CONTENT_TEST_STARTUP_ONLY === '1';
const cardsToTest = legacyProbeOnly ? new Map() : selectedCardId
    ? new Map([...cards].filter(([id]) => id === selectedCardId))
    : cards;
assert.ok(legacyProbeOnly || !selectedCardId || cardsToTest.size === 1, `CARD_CONTENT_TEST_ID must match an imported card ID: ${selectedCardId}`);
const mime = {
    '.avif': 'image/avif', '.css': 'text/css', '.gif': 'image/gif', '.html': 'text/html', '.jpeg': 'image/jpeg',
    '.jpg': 'image/jpeg', '.js': 'text/javascript', '.json': 'application/json', '.mjs': 'text/javascript',
    '.mp4': 'video/mp4', '.png': 'image/png', '.svg': 'image/svg+xml',
    '.webm': 'video/webm', '.webp': 'image/webp', '.woff2': 'font/woff2'
};

async function publishedAsset(url) {
    const pathname = decodeURIComponent(url.pathname);
    let base, relative;
    if (pathname === '/DokkanCustom' || pathname.startsWith('/DokkanCustom/')) {
        base = repoRoot;
        relative = pathname.slice('/DokkanCustom'.length).replace(/^\//, '');
    } else if (pathname === '/assets' || pathname.startsWith('/assets/')) {
        base = path.join(publishedRoot, 'assets');
        relative = pathname.slice('/assets'.length).replace(/^\//, '');
    } else if (pathname === '/rollback' || pathname.startsWith('/rollback/')) {
        base = rollbackRoot;
        relative = pathname.slice('/rollback'.length).replace(/^\//, '');
    } else if (pathname === '/Custom Cards' || pathname.startsWith('/Custom Cards/')) {
        const cardPath = pathname.slice('/Custom Cards'.length).replace(/^\//, '');
        const isMedia = /\.(?:avif|gif|jpe?g|png|webp|mp4|webm|svg|woff2)$/i.test(cardPath);
        base = isMedia ? publishedRoot : rollbackRoot;
        relative = path.join('Custom Cards', cardPath);
    } else {
        base = publishedRoot;
        relative = pathname.replace(/^\//, '');
    }
    const resolvedBase = path.resolve(base);
    let file = path.resolve(resolvedBase, relative || 'index.html');
    const relativeFile = path.relative(resolvedBase, file);
    if (relativeFile === '..' || relativeFile.startsWith('..' + path.sep) || path.isAbsolute(relativeFile)) {
        return { status: 404, contentType: 'text/plain', body: '' };
    }
    try {
        if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
        return {
            status: 200,
            contentType: mime[path.extname(file).toLowerCase()] || 'application/octet-stream',
            body: await readFile(file)
        };
    } catch {
        if (/\.(?:avif|gif|jpe?g|png|webp)$/i.test(pathname)) {
            fixtureImageSubstitutions.push(pathname);
            return { status: 200, contentType: 'image/png', body: await readFile(fallbackImagePath) };
        }
        return { status: 404, contentType: 'text/plain', body: '' };
    }
}

const server = createServer(async (request, response) => {
    const requestUrl = new URL(request.url, 'http://127.0.0.1');
    const pathname = decodeURIComponent(requestUrl.pathname);
    if (pathname === '/api/public/cards/resolve') {
        const requested = requestUrl.searchParams.get('path') || '';
        const match = aliases.get(requested) || '';
        response.writeHead(match ? 200 : 404, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        response.end(JSON.stringify(match ? { schemaVersion: 1, id: match, slug: match } : { error: { message: 'Not found' } }));
        return;
    }
    if (pathname.startsWith('/api/public/cards/')) {
        const id = decodeURIComponent(pathname.slice('/api/public/cards/'.length));
        const card = cards.get(id);
        response.writeHead(card ? 200 : 404, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        response.end(JSON.stringify(card ? { schemaVersion: 1, card } : { error: { message: 'Not found' } }));
        return;
    }

    let base, relative;
    if (pathname === '/DokkanCustom' || pathname.startsWith('/DokkanCustom/')) {
        base = repoRoot;
        relative = pathname.slice('/DokkanCustom'.length).replace(/^\//, '');
    } else if (pathname === '/assets' || pathname.startsWith('/assets/')) {
        base = path.join(publishedRoot, 'assets');
        relative = pathname.slice('/assets'.length).replace(/^\//, '');
    } else if (pathname === '/rollback' || pathname.startsWith('/rollback/')) {
        base = rollbackRoot;
        relative = pathname.slice('/rollback'.length).replace(/^\//, '');
    } else if (pathname === '/Custom Cards' || pathname.startsWith('/Custom Cards/')) {
        const cardPath = pathname.slice('/Custom Cards'.length).replace(/^\//, '');
        const isLegacyCardFile = !/\.(?:avif|gif|jpe?g|png|webp|mp4|webm|svg|woff2)$/i.test(cardPath);
        base = isLegacyCardFile ? rollbackRoot : publishedRoot;
        relative = isLegacyCardFile ? path.join('Custom Cards', cardPath) : path.join('Custom Cards', cardPath);
    } else {
        base = publishedRoot;
        relative = pathname.replace(/^\//, '');
    }

    try {
        const resolvedBase = path.resolve(base);
        let file = path.resolve(resolvedBase, relative || 'index.html');
        const relativeFile = path.relative(resolvedBase, file);
        if (relativeFile === '..' || relativeFile.startsWith('..' + path.sep) || path.isAbsolute(relativeFile)) throw new Error('Path escaped fixture root');
        if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
        response.writeHead(200, { 'Content-Type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream' });
        let body = await readFile(file);
        if (pathname.endsWith('/js/loading-screen.js')) body = Buffer.from(instrumentLoadingScreenSource(body.toString('utf8')));
        response.end(body);
    } catch {
        if (/\.(?:avif|gif|jpe?g|png|webp)$/i.test(pathname)) {
            fixtureImageSubstitutions.push(pathname);
            response.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' });
            response.end(await readFile(fallbackImagePath));
            return;
        }
        response.writeHead(404); response.end();
    }
});

await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
});
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
});
const failures = [];
const passingCards = [];
const screenshots = [];
let reciprocalClicks = 0;
let workerFixtureReads = 0;
const workerFixtureRequests = [];
const missingAssets = [];
const fixtureImageSubstitutions = [];
const requestFailures = [];
const fixtureAssetEvents = [];
const evidenceDirectory = path.join(repoRoot, 'docs', 'abs-refresh', 'reports', 'database-migration-20261017', 'viewer');
const evidenceCards = new Map([
    ['9071718', 'gohan'],
    ['6231448-vegeta-ultra-ego', 'ultra-ego'],
    ['6961700-frieza-full-power', 'frieza']
]);
await mkdir(evidenceDirectory, { recursive: true });
try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await context.addInitScript(({ apiOrigin, initialTheme, probeCardArtLifecycle }) => {
        if (['localhost', '127.0.0.1'].includes(window.location.hostname)) window.CARD_CONTENT_CONFIG = { apiOrigin };
        if (initialTheme) localStorage.setItem('dokkan_published_card_theme', initialTheme);

        if (probeCardArtLifecycle) {
        window.__cardArtLifecycle = [];
        window.__loaderLifecycle = [];
        for (const eventName of ['abs-card-content-ready', 'abs-shell-ready', 'abs-loading-complete']) {
            window.addEventListener(eventName, () => window.__loaderLifecycle.push({ at: Math.round(performance.now()), event: `event:${eventName}` }), { once: true });
        }
        const NativeImage = window.Image;
        if (NativeImage) window.Image = new Proxy(NativeImage, {
            construct(target, args) {
                const image = Reflect.construct(target, args, target);
                const creationStack = new Error().stack?.split('\n').slice(2, 7) || [];
                image.addEventListener('load', () => {
                    if (image.src.includes('/Custom%20Cards/6231448-vegeta-ultra-ego/card_art.png')) {
                        window.__loaderLifecycle.push({ at: Math.round(performance.now()), event: 'detached-card-art-image-load', src: image.currentSrc || image.src, complete: image.complete, naturalWidth: image.naturalWidth, connected: image.isConnected, creationStack });
                    }
                });
                return image;
            }
        });
        const isCardArtMedia = element => element instanceof Element && (
            /abs-art-/.test(element.id) || element.id === 'myOverlayImage' || element.dataset.cardElement === 'abs-art-img'
        ) && ['IMG', 'VIDEO'].includes(element.tagName);
        const recordMedia = (element, event, metadata = {}) => {
            if (!isCardArtMedia(element)) return;
            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            const lifecycle = window.__cardArtLifecycle;
            lifecycle.push({
                at: Math.round(performance.now()), event, id: element.id,
                layout: element.closest('[data-card-layout]')?.dataset.cardLayout || '',
                src: element.getAttribute('src') || '', currentSrc: element.currentSrc || '',
                complete: element.tagName === 'IMG' ? element.complete : undefined,
                naturalWidth: element.tagName === 'IMG' ? element.naturalWidth : undefined,
                readyState: element.tagName === 'VIDEO' ? element.readyState : undefined,
                connected: element.isConnected, display: style.display, visibility: style.visibility, opacity: style.opacity,
                rect: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) },
                ...metadata
            });
            if (lifecycle.length > 500) lifecycle.splice(0, lifecycle.length - 500);
        };
        const inspectNode = node => {
            if (!(node instanceof Element)) return;
            recordMedia(node, 'attached');
            node.querySelectorAll?.('img[id*="abs-art-"],video[id*="abs-art-"],img[data-card-element="abs-art-img"],#myOverlayImage').forEach(element => recordMedia(element, 'attached'));
        };
        document.addEventListener('load', event => recordMedia(event.target, 'load'), true);
        document.addEventListener('error', event => recordMedia(event.target, 'error'), true);
        const nativeDecode = HTMLImageElement.prototype.decode;
        if (nativeDecode) HTMLImageElement.prototype.decode = function (...args) {
            const image = this;
            const startedAt = Math.round(performance.now());
            const src = image.currentSrc || image.src;
            const result = nativeDecode.apply(image, args);
            if (isCardArtMedia(image)) {
                window.__cardArtLifecycle.push({ at: startedAt, event: 'decode:start', id: image.id, src });
                result.then(
                    () => window.__cardArtLifecycle.push({ at: Math.round(performance.now()), event: 'decode:resolved', id: image.id, src }),
                    error => window.__cardArtLifecycle.push({ at: Math.round(performance.now()), event: 'decode:rejected', id: image.id, src, error: String(error?.message || error) })
                );
            }
            return result;
        };
        for (const constructor of [window.HTMLImageElement, window.HTMLVideoElement]) {
            const descriptor = Object.getOwnPropertyDescriptor(constructor.prototype, 'src');
            if (!descriptor?.get || !descriptor?.set || !descriptor.configurable) continue;
            Object.defineProperty(constructor.prototype, 'src', {
                configurable: descriptor.configurable,
                enumerable: descriptor.enumerable,
                get: descriptor.get,
                set(value) {
                    const previousSrc = descriptor.get.call(this);
                    const previousCurrentSrc = this.currentSrc || '';
                    descriptor.set.call(this, value);
                    recordMedia(this, 'property:src', {
                        assignedSrc: String(value), previousSrc, previousCurrentSrc,
                        stack: new Error().stack?.split('\n').slice(2, 7) || []
                    });
                }
            });
        }
        const imageObserver = new MutationObserver(records => {
            for (const record of records) {
                if (record.type === 'attributes' && record.target.id === 'abs-loading-screen' && record.attributeName === 'data-loader-error') {
                    window.__loaderLifecycle.push({ at: Math.round(performance.now()), event: 'loader-error', value: record.target.getAttribute('data-loader-error') });
                } else if (record.type === 'attributes' && record.attributeName === 'src') recordMedia(record.target, `attribute:${record.attributeName}`);
                else record.addedNodes.forEach(inspectNode);
            }
        });
        if (document.documentElement) imageObserver.observe(document.documentElement, {
            attributes: true, attributeFilter: ['src', 'data-loader-error'], childList: true, subtree: true
        });
        }
    }, { apiOrigin: origin, initialTheme, probeCardArtLifecycle: process.env.CARD_CONTENT_TEST_LIFECYCLE_PROBE === '1' });
    await context.route('**/*', async route => {
        const requestUrl = new URL(route.request().url());
        if (requestUrl.origin === origin && requestUrl.pathname.endsWith('/js/card-content-config.js')) {
            return route.fulfill({
                status: 200,
                contentType: 'text/javascript',
                body: `window.CARD_CONTENT_CONFIG = Object.freeze({ enabled: false, apiOrigin: ${JSON.stringify(origin)} });`
            });
        }
        if (requestUrl.origin === origin) return route.continue();
        if (requestUrl.origin === 'https://abs-manager-auth.trashullu.workers.dev') {
            workerFixtureReads += 1;
            workerFixtureRequests.push(`${route.request().method()} ${requestUrl.pathname}${requestUrl.search}`);
            const requestPath = requestUrl.pathname;
            if (requestPath === '/api/public/cards/resolve') {
                const match = aliases.get(requestUrl.searchParams.get('path') || '') || '';
                return route.fulfill({ status: match ? 200 : 404, contentType: 'application/json', body: JSON.stringify(match ? { schemaVersion: 1, id: match, slug: match } : { error: { message: 'Not found' } }) });
            }
            if (requestPath.startsWith('/api/public/cards/')) {
                const id = decodeURIComponent(requestPath.slice('/api/public/cards/'.length));
                const card = cards.get(id);
                return route.fulfill({ status: card ? 200 : 404, contentType: 'application/json', body: JSON.stringify(card ? { schemaVersion: 1, card } : { error: { message: 'Not found' } }) });
            }
            return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Not found' } }) });
        }
        if (requestUrl.origin === 'https://abscustom.github.io') {
            const isTargetCardArt = /\/Custom Cards\/6231448-vegeta-ultra-ego\/card_art\.png$/i.test(decodeURIComponent(requestUrl.pathname));
            const routeStartedAt = Date.now();
            let asset = await publishedAsset(requestUrl);
            if (decodeURIComponent(requestUrl.pathname).endsWith('/DokkanCustom/js/loading-screen.js')) {
                asset = { ...asset, body: Buffer.from(instrumentLoadingScreenSource(Buffer.from(asset.body || '').toString('utf8'))) };
            }
            if (isTargetCardArt) {
                fixtureAssetEvents.push({ event: 'asset-ready', url: requestUrl.href, status: asset.status, bytes: asset.body?.length || 0, routeDelayMs: Date.now() - routeStartedAt });
            }
            const result = await route.fulfill(asset);
            if (isTargetCardArt) fixtureAssetEvents.push({ event: 'route-fulfilled', url: requestUrl.href, elapsedMs: Date.now() - routeStartedAt });
            return result;
        }
        if (['https://cdn.jsdelivr.net', 'https://cdnjs.cloudflare.com'].includes(requestUrl.origin)) {
            return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
        }
        return route.fulfill({ status: 204, body: '' });
    });

    const page = await context.newPage();
    trackCardArtRequests(page);
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('requestfailed', request => requestFailures.push({ url: request.url(), error: request.failure()?.errorText || '' }));
    page.on('console', message => {
        if (message.type() === 'error' && !message.text().startsWith('Failed to load resource:')) errors.push(message.text());
    });
    page.on('response', response => {
        if (response.status() < 400) return;
        const failure = { status: response.status(), url: response.url() };
        if (/\.(?:m?js|css|html)(?:[?#]|$)/i.test(response.url()) || response.url().includes('/api/')) errors.push(`HTTP ${failure.status} ${failure.url}`);
        else missingAssets.push(failure);
    });
    for (const [id, card] of cardsToTest) {
        requestFailures.length = 0;
        if (page.url().startsWith(origin)) await page.evaluate(() => localStorage.clear());
        await page.goto(`${origin}/DokkanCustom/custom-card.html?id=${encodeURIComponent(id)}`, { waitUntil: 'domcontentloaded' });
        try {
            await page.waitForFunction(() => window.absCardContentReady && window.currentContentCard?.id, null, { timeout: 45000 });
        } catch (error) {
            const diagnostic = await page.evaluate(() => ({
                url: location.href, title: document.title, body: document.body?.innerText?.slice(0, 900),
                loader: document.getElementById('abs-loading-screen')?.outerHTML?.slice(0, 1200),
                contentCard: window.currentContentCard?.id || null,
                bootstrapError: document.querySelector('[data-loader-error="true"]')?.innerText || '',
                scripts: [...document.scripts].map(script => ({ src: script.src, readyState: script.readyState, loaded: script.dataset.loaded || '' }))
            })).catch(() => null);
            console.error(JSON.stringify({ id, diagnostic, errors }));
            throw error;
        }
        await assertLoaderReleased(page, id, 'database viewer startup');
        await saveCardArtTrace(page, id, 'database-startup');
        if (startupOnly) {
            if (process.env.CARD_CONTENT_TEST_LIFECYCLE_PROBE === '1') {
                const regressionTrace = await page.evaluate(() => {
                    const lifecycle = window.__loaderLifecycle || [];
                    const imageEvents = window.__cardArtLifecycle || [];
                    return {
                        gate: lifecycle.find(event => event.event === 'essential-image-gate-settled') || null,
                        staticProbeLoads: lifecycle.filter(event => event.event === 'detached-card-art-image-load' && event.creationStack?.some(line => line.includes('/12-export.js'))),
                        decodeRejected: imageEvents.filter(event => event.event === 'decode:rejected' && event.id.includes('phantom-abs-art-img')),
                        sameUrlStaticProbeAssignments: imageEvents.filter(event => event.event === 'property:src' && event.assignedSrc === event.previousSrc && event.stack?.some(line => line.includes('staticProbe.onload')))
                    };
                });
                assert.equal(regressionTrace.gate?.imagesReady, true, `${id}: the strict essential image gate succeeds after decode`);
                assert.equal(regressionTrace.decodeRejected.length, 0, `${id}: Phantom image decoding is not aborted by the static probe`);
                assert.ok(regressionTrace.staticProbeLoads.length > 0, `${id}: the delayed static image probe completed during startup`);
                assert.equal(regressionTrace.sameUrlStaticProbeAssignments.length, 0, `${id}: the probe does not reset an already loaded same-URL image`);
            }
            break;
        }
        if (process.env.CARD_CONTENT_TEST_LIFECYCLE_PROBE === '1') {
            console.log(JSON.stringify({ id, lifecyclePhase: 'database-startup', ...await summarizeCardArtTrace(page) }));
        }
        const loaded = await page.evaluate(() => ({
            id: window.currentContentCard?.id,
            name: document.querySelector('#nameInput')?.value || '',
            forms: [...document.querySelectorAll('#forms-container .dokkan-card')].map(row => ({
                id: row.dataset.targetCardId || row.querySelector('a.form-link')?.dataset.targetCardId || '',
                href: row.querySelector('a.form-link')?.href || '',
                text: row.querySelector('.form-name')?.textContent?.trim() || ''
            })),
            unsafe: [...document.querySelectorAll('#forms-container .dokkan-card,#card-passive-container,#card-link-container,.active-block,.sa-block')]
                .flatMap(root => [...root.querySelectorAll('script,[onclick],[oninput],[onerror],iframe')]
                    .map(node => ({ root: root.id, node: node.outerHTML.slice(0, 220) }))),
            passiveActions: document.querySelectorAll('#sidebar-sections-area [data-card-content-action]').length,
            linkSkills: document.querySelector('#card-link-container')?.innerText || '',
            activeSkills: [...document.querySelectorAll('.active-block')].map(node => node.innerText).join('\n'),
            superAttacks: [...document.querySelectorAll('.sa-block')].map(node => node.innerText).join('\n')
        }));
        assert.equal(loaded.id, id, `${id}: the database record loaded`);
        assert.equal(loaded.name, card.name, `${id}: identity was preserved`);
        assert.deepEqual(loaded.unsafe, [], `${id}: no executable saved markup reached the viewer`);
        const imageUrls = [...new Set([
            card.thumb,
            ...card.builtinForms.flatMap(form => [form.imageSrc, form.thumbSrc]),
            ...card.linkedCards.map(link => link.thumb)
        ].filter(value => typeof value === 'string' && value.startsWith('https://')) )];
        const mediaChecks = await page.evaluate(urls => Promise.all(urls.map(url => new Promise(resolve => {
            const image = new Image();
            image.onload = () => resolve({ url, width: image.naturalWidth });
            image.onerror = () => resolve({ url, width: 0 });
            image.src = url;
        }))), imageUrls);
        assert.ok(imageUrls.length > 0, `${id}: the importer supplied card or form image assets`);
        assert.ok(mediaChecks.every(result => result.width > 0), `${id}: imported card/form images load in the browser`);
        for (const imageUrl of imageUrls) {
            assert.ok(!fixtureImageSubstitutions.includes(new URL(imageUrl).pathname), `${id}: image loaded from its mapped asset ${imageUrl}`);
        }
        if (card.payload.containers?.passiveSidebar) {
            assert.ok(loaded.passiveActions > 0, `${id}: validated passive editor actions survived the backend and renderer sanitizers`);
        }
        const renderedProject = await page.evaluate(() => window.CardContent.toProject(window.currentContentCard));
        assert.deepEqual(loaded.forms.map(form => form.text), renderedProject.formsData.map(form => form.name), `${id}: visible rows follow the canonical structured forms`);
        const preservation = await page.evaluate(() => {
            const project = window.CardContent.toProject(window.currentContentCard);
            const textOf = blocks => (blocks || []).map(markup => {
                const parsed = new DOMParser().parseFromString(markup, 'text/html');
                return parsed.body.textContent.replace(/\s+/g, ' ').trim();
            });
            return {
                projectStats: project.stats || {}, sourceStats: window.currentContentCard.payload.stats || {},
                sourceActiveText: textOf(window.currentContentCard.payload.activeBlocksHTML),
                projectActiveText: textOf(project.activeBlocksHTML),
                sourceSaText: textOf(window.currentContentCard.payload.saBlocksHTML),
                projectSaText: textOf(project.saBlocksHTML),
                sourceEffect: window.currentContentCard.payload.inputs?.['input-active-effect'] || '',
                projectEffect: project.inputs?.['input-active-effect'] || ''
            };
        });
        assert.deepEqual(preservation.projectStats, preservation.sourceStats, `${id}: stats survive the viewer adapter`);
        assert.deepEqual(preservation.projectActiveText, preservation.sourceActiveText, `${id}: active-skill text survives sanitization`);
        assert.deepEqual(preservation.projectSaText, preservation.sourceSaText, `${id}: super-attack text survives sanitization`);
        assert.equal(preservation.projectEffect, preservation.sourceEffect, `${id}: active-skill effect text is not truncated`);
        for (const form of renderedProject.formsData.filter(form => form.targetId)) {
            const visible = loaded.forms.find(candidate => candidate.id === form.targetId);
            assert.ok(visible, `${id}: ${form.targetId} has a rendered form button`);
            assert.match(visible.href, /custom-card\.html\?id=/, `${id}: ${form.targetId} navigates through the shared viewer`);
        }
        if (card.payload.inputs?.leaderInput) assert.equal(await page.locator('#leaderInput').inputValue(), card.payload.inputs.leaderInput, `${id}: leader text is preserved`);

        const styleResults = [];
        for (const theme of viewerStyles) {
            await page.evaluate(themeName => window.switchCardTheme(themeName), theme);
            await page.waitForTimeout(100);
            const themeResult = await page.evaluate(() => ({
                theme: window.currentCardThemeStyle || (document.body.classList.contains('theme-phantom') ? 'phantom' : ''),
                loaded: [...document.querySelectorAll('[data-card-layout]')].some(root => getComputedStyle(root).display !== 'none')
            }));
            styleResults.push(themeResult);
            if (evidenceCards.has(id)) {
                for (const [viewportName, viewport] of [
                    ['desktop', { width: 1440, height: 1000 }],
                    ['mobile', { width: 390, height: 844 }]
                ]) {
                    await page.setViewportSize(viewport);
                    await page.waitForTimeout(120);
                    const screenshotPath = path.join(evidenceDirectory, `${evidenceCards.get(id)}-${theme}-${viewportName}.png`);
                    await page.screenshot({ path: screenshotPath, fullPage: true, animations: 'disabled' });
                    screenshots.push(path.relative(repoRoot, screenshotPath).replace(/\\/g, '/'));
                }
                await page.setViewportSize({ width: 1280, height: 900 });
            }
        }
        assert.ok(styleResults.every((result, index) => result.loaded && result.theme === viewerStyles[index]), `${id}: all shared presentations mount`);
        passingCards.push({ id, forms: loaded.forms.length, passiveActions: loaded.passiveActions, styles: styleResults.length, loadedImages: mediaChecks.length });

        if (card.linkedCards.length) {
            await page.evaluate(() => window.switchCardTheme('abs-clean'));
            await page.waitForTimeout(120);
            const overlayError = await page.locator('#abs-loading-screen').getAttribute('data-loader-error');
            if (overlayError) {
                console.error(JSON.stringify({ id, overlay: await page.locator('#abs-loading-screen').innerText(), errors }));
                assert.equal(overlayError, null, `${id}: shared viewer must remain ready before a real form click`);
            }
            const linkedTargets = await page.locator('#layout-abs-clean [data-card-element="abs-transformations-container"] a.abs-transform-link[target="_blank"]').evaluateAll(anchors => anchors
                .filter(anchor => anchor.getClientRects().length && anchor.href.includes('custom-card.html?id='))
                .map(anchor => ({ id: new URL(anchor.href).searchParams.get('id'), href: anchor.href })));
            const expectedTargets = card.linkedCards.map(link => link.id).sort();
            const visibleDirectTargets = linkedTargets.filter(link => expectedTargets.includes(link.id));
            assert.deepEqual(visibleDirectTargets.map(link => link.id).sort(), expectedTargets, `${id}: visible theme buttons include every direct linked card`);
            for (const link of visibleDirectTargets) {
                const [popup] = await Promise.all([
                    context.waitForEvent('page'),
                    page.locator(`#layout-abs-clean [data-card-element="abs-transformations-container"] a.abs-transform-link[href="${link.href}"]`).first().click()
                ]);
                await popup.waitForFunction(() => window.absCardContentReady && window.currentContentCard?.id, null, { timeout: 45000 });
                await assertLoaderReleased(popup, link.id, 'reciprocal database viewer startup');
                assert.equal(await popup.evaluate(() => window.currentContentCard.id), link.id, `${id} -> ${link.id}: reciprocal form click loads the target`);
                reciprocalClicks += 1;
                await popup.close();
            }
        }
        assert.deepEqual(errors, [], `${id}: browser console has no uncaught page errors`);
    }

    if (startupOnly) {
        const tag = process.env.CARD_CONTENT_TEST_PROBE_TAG ? `-${process.env.CARD_CONTENT_TEST_PROBE_TAG}` : '';
        console.log(JSON.stringify({ startupOnly: true, id: selectedCardId, theme: initialTheme, passed: true, trace: `docs/abs-refresh/reports/database-migration-20261017/viewer/cold-phantom-database-startup${tag}.json` }));
    }
    if (!startupOnly) {
    if (!legacyProbeOnly) {
    const aliasPage = await context.newPage();
    await aliasPage.goto(`${origin}/DokkanCustom/custom-card.html?path=${encodeURIComponent('/Custom%20Cards/9071718/')}`, { waitUntil: 'domcontentloaded' });
    await aliasPage.waitForFunction(() => window.absCardContentReady && window.currentContentCard?.id, null, { timeout: 45000 });
    assert.equal(await aliasPage.evaluate(() => window.currentContentCard.id), '9071718', 'an exact nested historic alias resolves to the shared viewer');

    const rolloutViewer = await context.newPage();
    await routeEnabledCardContentConfig(rolloutViewer, origin);
    await rolloutViewer.goto(`${origin}/DokkanCustom/custom-card.html?id=${encodeURIComponent('6231448-vegeta-ultra-ego')}`, { waitUntil: 'domcontentloaded' });
    await rolloutViewer.waitForFunction(() => window.absCardContentReady && window.currentContentCard?.id, null, { timeout: 45000 });
    await assertLoaderReleased(rolloutViewer, '6231448-vegeta-ultra-ego', 'enabled custom-card config startup');
    assert.equal(await rolloutViewer.evaluate(() => window.CARD_CONTENT_CONFIG?.enabled), true, 'custom-card.html loads the rollout config before bootstrap');
    assert.equal(await rolloutViewer.evaluate(() => window.currentContentCard.id), '6231448-vegeta-ultra-ego', 'the enabled custom-card config selects the database record');
    await rolloutViewer.close();

    const rolloutLegacy = await context.newPage();
    await routeEnabledCardContentConfig(rolloutLegacy, origin);
    await rolloutLegacy.goto('https://abscustom.github.io/Custom%20Cards/6231448-vegeta-ultra-ego/', { waitUntil: 'domcontentloaded' });
    try {
        await rolloutLegacy.waitForFunction(() => window.absCardContentReady && window.currentContentCard?.id, null, { timeout: 45000 });
    } catch (error) {
        const diagnostic = await rolloutLegacy.evaluate(() => ({
            url: location.href, config: window.CARD_CONTENT_CONFIG, contentReady: window.absCardContentReady || false,
            currentCard: window.currentContentCard?.id || null,
            loader: document.getElementById('abs-loading-screen')?.outerHTML?.slice(0, 1400),
            body: document.body?.innerText?.slice(0, 500)
        })).catch(() => null);
        console.error(JSON.stringify({ rolloutLegacy: diagnostic, workerFixtureRequests }));
        throw error;
    }
    await assertLoaderReleased(rolloutLegacy, '6231448-vegeta-ultra-ego', 'enabled legacy-path config startup');
    assert.equal(await rolloutLegacy.evaluate(() => window.CARD_CONTENT_CONFIG?.enabled), true, 'the legacy bootstrap loads the rollout config before choosing its content source');
    assert.equal(await rolloutLegacy.evaluate(() => window.currentContentCard.id), '6231448-vegeta-ultra-ego', 'the enabled legacy config resolves its historical path to the database record');
    await rolloutLegacy.close();
    }

    const legacySourceId = '6231448-vegeta-ultra-ego';
    const legacyTargetId = '7497466-goku-ultra-instinct';
    const { page: legacyPage, card: legacyCard } = await openLegacySnapshotCard(context, legacySourceId);
    if (process.env.CARD_CONTENT_TEST_LIFECYCLE_PROBE === '1') {
        console.log(JSON.stringify({ id: legacySourceId, lifecyclePhase: 'legacy-startup', ...await summarizeCardArtTrace(legacyPage) }));
    }
    await saveCardArtTrace(legacyPage, legacySourceId, 'legacy-startup');
    const directForm = legacyCard.formsData.find(form => form.targetId === legacyTargetId);
    assert.ok(directForm, 'the rollback snapshot preserves the direct Ultra Ego ↔ Ultra Instinct relationship');
    const legacyState = await legacyPage.evaluate(sourceCard => {
        const activeLayout = [...document.querySelectorAll('[data-card-layout]')]
            .find(root => getComputedStyle(root).display !== 'none') || document;
        const parse = html => new DOMParser().parseFromString(String(html || ''), 'text/html');
        const normalize = value => String(value || '').replace(/\s+/g, ' ').trim();
        const sourceBlocks = value => Array.isArray(value) ? value : (value ? [value] : []);
        const actualPassive = normalize(document.getElementById('card-passive-container')?.textContent);
        const expectedPassive = normalize(parse(sourceCard.containers?.passiveCard).body.textContent);
        const expectedActive = sourceBlocks(sourceCard.activeBlocksHTML).map(html => parse(html).querySelector('.active-display-name')?.textContent?.trim() || '').filter(Boolean);
        const expectedSuperAttacks = sourceBlocks(sourceCard.saBlocksHTML).map(html => parse(html).querySelector('.sa-display-name')?.textContent?.trim() || '').filter(Boolean);
        return {
            databaseRecord: window.currentContentCard?.id || null,
            name: document.getElementById('nameInput')?.value || '',
            leader: document.getElementById('leaderInput')?.value || '',
            activeName: window.getActiveSkillSourceBlocks?.()[0]?.querySelector('.active-display-name')?.textContent?.trim() || '',
            superAttacks: (window.getSuperAttackSourceBlocks?.() || []).map(block => block.querySelector('.sa-display-name')?.textContent?.trim()).filter(Boolean),
            formLinks: [...document.querySelectorAll('#forms-container .form-link')].map(anchor => ({ href: anchor.href, text: anchor.getAttribute('aria-label') || '' })),
            visibleDirectLinks: [...document.querySelectorAll('a[href]')]
                .filter(anchor => anchor.href.includes('/Custom%20Cards/') || anchor.href.includes('/Custom Cards/'))
                .filter(anchor => anchor.getClientRects().length && getComputedStyle(anchor).visibility !== 'hidden')
                .map(anchor => ({ href: anchor.href, text: anchor.innerText.trim() })),
            actualPassive, expectedPassive, expectedActive, expectedSuperAttacks,
            artwork: [...activeLayout.querySelectorAll('.abs-art-layer')].map(node => ({
                id: node.id, tag: node.tagName.toLowerCase(), src: node.currentSrc || node.src || '',
                ready: node.tagName === 'VIDEO' ? node.readyState : node.complete,
                naturalWidth: node.tagName === 'IMG' ? node.naturalWidth : undefined
            }))
        };
    }, legacyCard);
    assert.equal(legacyState.databaseRecord, null, 'the rollback page continues to use its materialized card.json');
    assert.equal(legacyState.name, legacyCard.inputs.nameInput, 'the legacy bootstrap reads the snapshot identity');
    assert.equal(legacyState.leader, legacyCard.inputs.leaderInput, 'the legacy bootstrap reads the snapshot leader skill');
    assert.equal(legacyState.activeName, legacyCard.inputs['input-active-name'], 'the legacy bootstrap reads the snapshot active skill');
    assert.deepEqual(legacyState.superAttacks, legacyState.expectedSuperAttacks, 'the legacy bootstrap reads snapshot super-attack markup');
    assert.ok(legacyState.actualPassive.includes(legacyState.expectedPassive), 'the legacy bootstrap renders snapshot passive text');
    const directFormLink = legacyState.formLinks.find(form => form.href.includes(legacyTargetId));
    assert.ok(directFormLink, 'the snapshot direct relationship renders a legacy form button');
    const visibleDirectFormLink = legacyState.visibleDirectLinks.find(form => form.href.includes(legacyTargetId));
    assert.ok(visibleDirectFormLink, 'the snapshot direct relationship has a visible button in the active layout');
    const [legacyTargetPage] = await Promise.all([
        context.waitForEvent('page'),
        legacyPage.locator(`a[href*="${legacyTargetId}"]:visible`).first().click()
    ]);
    await legacyTargetPage.waitForFunction(() => window.absCardContentReady && document.getElementById('nameInput')?.value, null, { timeout: 45000 });
    assert.equal(await legacyTargetPage.locator('#nameInput').inputValue(), 'Goku (Ultra Instinct) + Vegeta (Ultra Ego)', 'a snapshot legacy form click opens the linked rollback card');
    assert.equal(await legacyTargetPage.evaluate(() => window.currentContentCard?.id || null), null, 'the snapshot target also stays on the legacy reader');
    await legacyTargetPage.close();
    await legacyPage.close();

    const legacyArtwork = [];
    for (const [id, theme, file] of [
        ['9071718', 'abs-clean', 'gohan-legacy-abs-clean-desktop.png'],
        ['6961700-frieza-full-power', 'phantom', 'frieza-legacy-phantom-desktop.png']
    ]) {
        const { page: legacyArtworkPage, card: sourceCard } = await openLegacySnapshotCard(context, id);
        await legacyArtworkPage.setViewportSize({ width: 1440, height: 1000 });
        await legacyArtworkPage.evaluate(themeName => window.switchCardTheme(themeName), theme);
        await legacyArtworkPage.waitForTimeout(180);
        const artwork = await legacyArtworkPage.evaluate(() => {
            const activeLayout = [...document.querySelectorAll('[data-card-layout]')]
                .find(root => getComputedStyle(root).display !== 'none') || document;
            return [...activeLayout.querySelectorAll('.abs-art-layer')].map(node => ({
                id: node.id, tag: node.tagName.toLowerCase(), src: node.currentSrc || node.src || '',
                ready: node.tagName === 'VIDEO' ? node.readyState : node.complete,
                naturalWidth: node.tagName === 'IMG' ? node.naturalWidth : undefined
            }));
        });
        const screenshotPath = path.join(evidenceDirectory, file);
        await legacyArtworkPage.screenshot({ path: screenshotPath, fullPage: true, animations: 'disabled' });
        screenshots.push(path.relative(repoRoot, screenshotPath).replace(/\\/g, '/'));
        legacyArtwork.push({ id, theme, cardArtImage: sourceCard.cardArtImage, cardArtVideo: sourceCard.cardArtVideo, artwork });
        await legacyArtworkPage.close();
    }
    assert.equal(passingCards.length, cardsToTest.size);
    assert.equal(reciprocalClicks, [...cardsToTest.values()].reduce((count, card) => count + card.linkedCards.length, 0), 'all selected direct-link buttons navigated to a database-backed target');
    const uniqueMissingAssets = [...new Map(missingAssets.map(item => [item.url, item])).values()];
    console.log(JSON.stringify({
        cards: passingCards, reciprocalClicks, workerFixtureReads, workerFixtureRequests, styles: viewerStyles,
        exactAlias: '9071718', legacySnapshotRead: { source: legacySourceId, target: legacyTargetId, artwork: legacyArtwork },
        screenshots, errors: [], missingLocalAssets: uniqueMissingAssets,
        fixtureImageSubstitutions: [...new Set(fixtureImageSubstitutions)]
    }, null, 2));
    }
} finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
}
