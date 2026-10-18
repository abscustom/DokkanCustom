import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await fs.readFile(new URL('../js/manager-auth-client.js', import.meta.url), 'utf8');
const workerOrigin = 'https://abs-manager-auth.trashullu.workers.dev';

function createBrowser({ origin = workerOrigin, search = '', config = { workerOrigin, pagesOrigin: 'https://abscustom.github.io' }, cardContentConfig = { enabled: false }, responses = {}, sessionStorageValues = {} } = {}) {
    const elementIds = [
        'card-admin-auth', 'card-admin-session', 'card-admin-account', 'card-admin-tools',
        'card-admin-github-signin', 'card-admin-status', 'card-admin-auth-form',
        'card-admin-signout', 'card-admin-delete-filter', 'card-admin-delete-confirm-button',
        'manager-content-mode', 'card-admin-delete-heading', 'card-admin-delete-description', 'card-admin-delete-confirm-label'
    ];
    const elements = new Map(elementIds.map(id => [id, {
        id,
        hidden: false,
        disabled: false,
        textContent: '',
        style: {},
        listeners: new Map(),
        classList: { toggle() {} },
        addEventListener(type, callback) { this.listeners.set(type, callback); }
    }]));
    const statusUpdates = [];
    const statusElement = elements.get('card-admin-status');
    let statusText = '';
    Object.defineProperty(statusElement, 'textContent', {
        get() { return statusText; },
        set(value) { statusText = String(value); statusUpdates.push(statusText); }
    });
    const parsedOrigin = new URL(origin);
    const storedValues = new Map(Object.entries(sessionStorageValues));
    const calls = [];
    const navigations = [];
    const adapterCalls = [];
    const historyChanges = [];
    const document = {
        readyState: 'complete',
        getElementById(id) { return elements.get(id) || null; }
    };
    const location = {
        origin: parsedOrigin.origin,
        hostname: parsedOrigin.hostname,
        protocol: parsedOrigin.protocol,
        pathname: parsedOrigin.pathname,
        hash: parsedOrigin.hash,
        search: search || parsedOrigin.search,
        assign(value) { navigations.push({ kind: 'assign', value }); },
        replace(value) { navigations.push({ kind: 'replace', value }); }
    };
    const sessionStorage = {
        getItem(key) { return storedValues.get(key) ?? null; },
        setItem(key, value) { storedValues.set(key, String(value)); },
        removeItem(key) { storedValues.delete(key); }
    };
    const history = {
        replaceState(_state, _title, value) {
            historyChanges.push(String(value));
            const next = new URL(String(value), location.origin);
            location.pathname = next.pathname;
            location.search = next.search;
            location.hash = next.hash;
        }
    };
    const window = {
        MANAGER_AUTH_CONFIG: config,
        CARD_CONTENT_CONFIG: cardContentConfig,
        sessionStorage,
        history,
        CardAdminServer: {
            setSession(session, cards) { adapterCalls.push({ kind: 'set', session, cards }); },
            clearSession() { adapterCalls.push({ kind: 'clear' }); }
        },
        filterCardAdminDeleteCards() {},
        deleteSelectedCustomCard() {}
    };
    const fetch = async (url, options) => {
        calls.push({ url: String(url), options });
        const key = `${options.method} ${new URL(String(url)).pathname}`;
        const configured = responses[key];
        const value = Array.isArray(configured)
            ? configured.shift() ?? { status: 200, payload: {} }
            : configured ?? { status: 200, payload: {} };
        const status = value.status ?? 200;
        return {
            ok: status >= 200 && status < 300,
            status,
            json: async () => value.payload
        };
    };
    vm.runInNewContext(source, {
        window, document, location, fetch, URL, Map, Set, String, Object, Error, Promise,
        URLSearchParams, AbortController, Date, setTimeout, clearTimeout
    });
    return { window, document, elements, calls, navigations, adapterCalls, statusUpdates, sessionStorage, historyChanges };
}

test('Manager restores a server session and sends CSRF only on its allowlisted mutation routes', async () => {
    const session = {
        login: 'test-user',
        csrfToken: 'synthetic-csrf-token-value-0123456789',
        expiresAt: '2030-01-01T00:00:00Z',
        capabilities: { link: true, delete: true }
    };
    const cards = [{ slug: 'card-one', name: 'Card One', linkedSlugs: [], folderPath: 'Custom Cards/card-one' }];
    const browser = createBrowser({ responses: {
        'GET /api/session': { payload: session },
        'GET /api/cards': { payload: { cards } },
        'POST /api/links/apply': { payload: { ok: true } },
        'POST /api/session/logout': { payload: { ok: true } }
    } });

    const result = await browser.window.ManagerAuth.init();
    assert.equal(result.authenticated, true);
    assert.deepEqual(browser.adapterCalls[0], { kind: 'set', session, cards });
    assert.equal(browser.elements.get('card-admin-auth').hidden, true);
    assert.equal(browser.elements.get('card-admin-session').hidden, false);
    assert.equal(browser.elements.get('card-admin-account').textContent, 'test-user');

    await browser.window.ManagerAuth.request('/api/links/apply', {
        method: 'POST',
        body: { operations: [{ action: 'link', sourceSlug: 'card-one', targetSlug: 'card-two' }] }
    });
    const mutation = browser.calls.at(-1).options;
    assert.equal(mutation.credentials, 'same-origin');
    assert.equal(mutation.headers['X-CSRF-Token'], session.csrfToken);
    assert.equal(JSON.parse(mutation.body).operations[0].action, 'link');

    await assert.rejects(browser.window.ManagerAuth.request('/api/anything'), /not available/);
    await assert.rejects(browser.window.ManagerAuth.request('/api/links/apply'), /not available/);

    await browser.window.ManagerAuth.logout();
    assert.equal(browser.calls.at(-1).options.headers['X-CSRF-Token'], session.csrfToken);
    assert.equal(browser.adapterCalls.at(-1).kind, 'clear');
    assert.equal(browser.elements.get('card-admin-session').hidden, true);
});

test('Pages routes to the configured Worker without sending credentials from the Pages origin', async () => {
    const browser = createBrowser({ origin: 'https://abscustom.github.io' });
    const result = await browser.window.ManagerAuth.init();
    assert.equal(result.redirecting, true);
    assert.deepEqual(browser.navigations, [{ kind: 'replace', value: `${workerOrigin}/manager.html` }]);
    assert.equal(browser.calls.length, 0);
});

test('static localhost preview routes to hosted Manager, not local auth, and keeps only a safe tool query', async () => {
    const browser = createBrowser({
        origin: 'http://127.0.0.1:3000/DokkanCustom/manager.html',
        search: '?tool=linker&returnTo=https%3A%2F%2Fevil.example%2Fsteal'
    });
    const result = await browser.window.ManagerAuth.init();
    assert.equal(result.redirecting, true);
    assert.deepEqual(browser.navigations, [{ kind: 'replace', value: `${workerOrigin}/manager.html?tool=linker` }]);
    assert.equal(browser.window.ManagerAuth.enabled, false);
    assert.equal(browser.calls.length, 0);

    browser.window.ManagerAuth.startLogin();
    assert.deepEqual(browser.navigations.at(-1), { kind: 'assign', value: `${workerOrigin}/auth/start` });
    assert.equal(browser.calls.length, 0);
});

test('file previews route to the configured Manager without carrying return URLs', async () => {
    const browser = createBrowser({
        origin: 'file:///G:/GitHub/DokkanCustom/manager.html?tool=delete&returnTo=https%3A%2F%2Fevil.example'
    });
    const result = await browser.window.ManagerAuth.init();
    assert.equal(result.redirecting, true);
    assert.deepEqual(browser.navigations, [{ kind: 'replace', value: `${workerOrigin}/manager.html?tool=delete` }]);
    assert.equal(browser.calls.length, 0);
});

test('an explicit loopback Worker origin enables same-origin local integration', async () => {
    const localWorkerOrigin = 'http://127.0.0.1:8787';
    const config = { workerOrigin, pagesOrigin: 'https://abscustom.github.io', localWorkerOrigin };
    const session = {
        login: 'local-user',
        csrfToken: 'synthetic-csrf-token-value-0123456789',
        expiresAt: '2030-01-01T00:00:00Z',
        capabilities: { link: true, delete: true }
    };
    const browser = createBrowser({ origin: `${localWorkerOrigin}/manager.html`, config, responses: {
        'GET /api/session': { payload: session },
        'GET /api/cards': { payload: { cards: [] } }
    } });

    const result = await browser.window.ManagerAuth.init();
    assert.equal(result.authenticated, true);
    assert.equal(browser.window.ManagerAuth.enabled, true);
    assert.equal(browser.navigations.length, 0);
    assert.ok(browser.calls.every(call => new URL(call.url).origin === localWorkerOrigin));

    const loginBrowser = createBrowser({ origin: `${localWorkerOrigin}/manager.html`, config });
    loginBrowser.window.ManagerAuth.startLogin();
    assert.deepEqual(loginBrowser.navigations, [{ kind: 'assign', value: `${localWorkerOrigin}/auth/start` }]);
    assert.equal(loginBrowser.calls.length, 0);
});

test('an explicitly configured local Worker preview redirects to that Worker origin without cross-origin fetches', async () => {
    const localWorkerOrigin = 'http://localhost:8787';
    const browser = createBrowser({
        origin: 'http://127.0.0.1:3000/DokkanCustom/manager.html',
        search: '?tool=delete&returnTo=https%3A%2F%2Fevil.example',
        config: { workerOrigin, pagesOrigin: 'https://abscustom.github.io', localWorkerOrigin }
    });
    const result = await browser.window.ManagerAuth.init();
    assert.equal(result.redirecting, true);
    assert.deepEqual(browser.navigations, [{ kind: 'replace', value: `${localWorkerOrigin}/manager.html?tool=delete` }]);
    assert.equal(browser.calls.length, 0);
});

test('missing Worker configuration fails closed with a disabled sign-in button', async () => {
    const browser = createBrowser({
        origin: 'https://abscustom.github.io',
        config: { workerOrigin: '', pagesOrigin: 'https://abscustom.github.io' }
    });
    const result = await browser.window.ManagerAuth.init();
    assert.equal(result.configRequired, true);
    assert.equal(browser.elements.get('card-admin-github-signin').disabled, true);
    assert.match(browser.elements.get('card-admin-status').textContent, /not configured/i);
    assert.equal(browser.calls.length, 0);
});

test('sign-in starts only on the configured Worker origin', () => {
    const browser = createBrowser({ origin: 'https://abscustom.github.io' });
    browser.window.ManagerAuth.startLogin();
    assert.deepEqual(browser.navigations, [{ kind: 'assign', value: `${workerOrigin}/auth/start` }]);
    assert.equal(browser.calls.length, 0);
});

test('database pilot keeps its query through the Pages redirect and OAuth return', async () => {
    const localWorkerOrigin = 'http://127.0.0.1:8787';
    const redirect = createBrowser({
        origin: 'https://abscustom.github.io',
        search: '?tool=linker&content=database&returnTo=https%3A%2F%2Fevil.example'
    });
    const redirectResult = await redirect.window.ManagerAuth.init();
    assert.equal(redirectResult.redirecting, true);
    assert.deepEqual(redirect.navigations, [{ kind: 'replace', value: `${workerOrigin}/manager.html?tool=linker&content=database` }]);

    const returned = createBrowser({
        origin: `${localWorkerOrigin}/manager.html`,
        config: { workerOrigin, pagesOrigin: 'https://abscustom.github.io', localWorkerOrigin },
        sessionStorageValues: { 'manager-content-mode-after-auth': 'database' },
        responses: {
            'GET /api/session': { payload: { login: 'local-user', csrfToken: 'synthetic-csrf-token-value-0123456789' } },
            'GET /api/content/cards': { payload: { schemaVersion: 1, cards: [], nextCursor: null } }
        }
    });
    const returnResult = await returned.window.ManagerAuth.init();
    assert.equal(returnResult.contentMode, 'database');
    assert.equal(returned.window.ManagerAuth.databaseMode, true);
    assert.deepEqual(returned.historyChanges, ['/manager.html?content=database']);
    assert.equal(returned.sessionStorage.getItem('manager-content-mode-after-auth'), null);
});

test('database Manager loads every catalog page, uses CSRF for content writes, and blocks legacy content routes', async () => {
    const session = {
        login: 'test-user',
        csrfToken: 'synthetic-csrf-token-value-0123456789',
        expiresAt: '2030-01-01T00:00:00Z',
        capabilities: { link: true, delete: true }
    };
    const alpha = { id: 'alpha', slug: 'alpha', revision: 4, status: 'published', name: 'Alpha', title: '', type: 'phy', rarity: 'SSR', thumb: 'https://abscustom.github.io/alpha.png', repoPath: 'Custom Cards/alpha', assetBase: 'https://abscustom.github.io/Custom%20Cards/alpha/', linkedSlugs: ['beta'] };
    const beta = { id: 'beta', slug: 'beta', revision: 7, status: 'published', name: 'Beta', title: '', type: 'int', rarity: 'LR', thumb: 'https://abscustom.github.io/beta.png', repoPath: 'Custom Cards/beta', assetBase: 'https://abscustom.github.io/Custom%20Cards/beta/', linkedSlugs: ['alpha'] };
    const browser = createBrowser({ search: '?content=database', responses: {
        'GET /api/session': { payload: session },
        'GET /api/content/cards': [
            { payload: { schemaVersion: 1, cards: [alpha], nextCursor: 'page-two' } },
            { payload: { schemaVersion: 1, cards: [beta], nextCursor: null } }
        ],
        'POST /api/content/links/apply': { payload: { schemaVersion: 1, cards: [alpha, beta] } }
    } });

    const result = await browser.window.ManagerAuth.init();
    assert.equal(result.authenticated, true);
    assert.equal(result.contentMode, 'database');
    assert.equal(browser.window.ManagerAuth.databaseMode, true);
    assert.deepEqual(JSON.parse(JSON.stringify(result.cards.map(card => card.slug))), ['alpha', 'beta']);
    assert.equal(new URL(browser.calls.filter(call => new URL(call.url).pathname === '/api/content/cards')[1].url).searchParams.get('cursor'), 'page-two');
    assert.equal(browser.elements.get('manager-content-mode').hidden, false);
    assert.equal(browser.elements.get('card-admin-delete-heading').textContent, 'Card Archive');
    assert.equal(browser.elements.get('card-admin-delete-confirm-button').textContent, 'Archive From Catalog');

    await assert.rejects(browser.window.ManagerAuth.request('/api/cards'), /disabled while database content mode is active/);
    await assert.rejects(browser.window.ManagerAuth.request('/api/links/apply', { method: 'POST' }), /disabled while database content mode is active/);
    assert.equal(browser.calls.some(call => new URL(call.url).pathname === '/api/links/apply'), false);

    await browser.window.ManagerAuth.contentRequest('/api/content/links/apply', {
        method: 'POST',
        body: { operations: [{ action: 'link', sourceSlug: 'alpha', targetSlug: 'beta' }], expectedRevisions: { alpha: 4, beta: 7 } }
    });
    const mutation = browser.calls.at(-1).options;
    assert.equal(mutation.credentials, 'same-origin');
    assert.equal(mutation.headers['X-CSRF-Token'], session.csrfToken);
    assert.equal(JSON.parse(mutation.body).expectedRevisions.alpha, 4);
    await assert.rejects(browser.window.ManagerAuth.contentRequest('/api/cards/delete', { method: 'POST' }), /not available/);
});

test('shared card-content flag activates database Manager mode without a query parameter', async () => {
    const browser = createBrowser({ cardContentConfig: { enabled: true }, responses: {
        'GET /api/session': { payload: {
            login: 'test-user',
            csrfToken: 'synthetic-csrf-token-value-0123456789',
            capabilities: { link: true, delete: true }
        } },
        'GET /api/content/cards': { payload: { schemaVersion: 1, cards: [], nextCursor: null } }
    } });

    const result = await browser.window.ManagerAuth.init();
    assert.equal(result.authenticated, true);
    assert.equal(result.contentMode, 'database');
    assert.equal(browser.window.ManagerAuth.databaseMode, true);
    assert.equal(browser.calls.some(call => new URL(call.url).pathname === '/api/content/cards'), true);
    assert.equal(browser.calls.some(call => new URL(call.url).pathname === '/api/cards'), false);
});

test('card-list GET polls pending progress with bounded delay and returns the final list', async () => {
    const session = {
        login: 'test-user',
        csrfToken: 'synthetic-csrf-token-value-0123456789',
        expiresAt: '2030-01-01T00:00:00Z',
        capabilities: { link: true, delete: true }
    };
    const cards = [{ slug: 'card-one', name: 'Card One', linkedSlugs: [], folderPath: 'Custom Cards/card-one' }];
    const browser = createBrowser({ responses: {
        'GET /api/session': { payload: session },
        'GET /api/cards': [
            { status: 202, payload: { pending: true, processed: 3, total: 14, retryAfterMs: 25 } },
            { payload: { cards } }
        ]
    } });

    const result = await browser.window.ManagerAuth.init();
    assert.equal(result.authenticated, true);
    assert.deepEqual(result.cards, cards);
    assert.equal(browser.calls.filter(call => new URL(call.url).pathname === '/api/cards').length, 2);
    assert.ok(browser.statusUpdates.includes('Loading cards 3/14…'));
    assert.deepEqual(browser.adapterCalls[0], { kind: 'set', session, cards });
});

test('202 responses from mutation routes are never retried', async () => {
    const session = {
        login: 'test-user',
        csrfToken: 'synthetic-csrf-token-value-0123456789',
        expiresAt: '2030-01-01T00:00:00Z',
        capabilities: { link: true, delete: true }
    };
    const browser = createBrowser({ responses: {
        'GET /api/session': { payload: session },
        'GET /api/cards': { payload: { cards: [] } },
        'POST /api/links/apply': { status: 202, payload: { pending: true, processed: 0, total: 1, retryAfterMs: 25 } }
    } });

    await browser.window.ManagerAuth.init();
    const result = await browser.window.ManagerAuth.request('/api/links/apply', { method: 'POST', body: { operations: [] } });
    assert.equal(result.pending, true);
    assert.equal(browser.calls.filter(call => new URL(call.url).pathname === '/api/links/apply').length, 1);
});
