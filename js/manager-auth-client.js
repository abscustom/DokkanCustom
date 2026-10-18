/* Manager's same-origin GitHub session client. It never handles provider tokens. */
(function () {
    const config = window.MANAGER_AUTH_CONFIG || {};
    const allowedRoutes = new Map([
        ['/api/session', new Set(['GET'])],
        ['/api/cards', new Set(['GET'])],
        ['/api/links/apply', new Set(['POST'])],
        ['/api/cards/delete', new Set(['POST'])],
        ['/api/session/logout', new Set(['POST'])]
    ]);
    const workerOrigin = normalizeWorkerOrigin(config.workerOrigin);
    const pagesOrigin = normalizePagesOrigin(config.pagesOrigin);
    const localPreview = isLocalPreview();
    const databaseContentMode = isDatabaseContentMode();
    const pendingContentModeKey = 'manager-content-mode-after-auth';
    const localWorkerOrigin = localPreview ? normalizeLocalWorkerOrigin(config.localWorkerOrigin) : '';
    const managerOrigin = localWorkerOrigin || workerOrigin;
    const isWorkerOrigin = Boolean((workerOrigin && location.origin === workerOrigin)
        || (localWorkerOrigin && location.origin === localWorkerOrigin));
    const apiOrigin = isWorkerOrigin ? location.origin : managerOrigin;
    const cardListMaxAttempts = 60;
    const cardListTimeoutMs = 30000;
    let csrfToken = '';
    let initPromise = null;

    function normalizeWorkerOrigin(value) {
        if (typeof value !== 'string' || !value.trim()) return '';
        try {
            const url = new URL(value);
            if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') return '';
            if (!url.hostname.startsWith('abs-manager-auth.') || !url.hostname.endsWith('.workers.dev')) return '';
            return url.origin;
        } catch {
            return '';
        }
    }

    function isLoopbackHost(value) {
        const hostname = String(value || '').toLowerCase().replace(/^\[|\]$/g, '');
        return ['localhost', '127.0.0.1', '::1'].includes(hostname);
    }

    function isLocalPreview() {
        return location.protocol === 'file:' || isLoopbackHost(location.hostname);
    }

    function isDatabaseContentMode() {
        const values = new URLSearchParams(String(location.search || '')).getAll('content');
        if (values.length === 1 && values[0] === 'database') {
            try { window.sessionStorage?.removeItem('manager-content-mode-after-auth'); } catch {}
            return true;
        }
        if (window.CARD_CONTENT_CONFIG?.enabled === true) {
            try { window.sessionStorage?.removeItem('manager-content-mode-after-auth'); } catch {}
            return true;
        }
        try {
            if (window.sessionStorage?.getItem('manager-content-mode-after-auth') !== 'database') return false;
            const params = new URLSearchParams(String(location.search || ''));
            params.set('content', 'database');
            const query = params.toString();
            const path = `${location.pathname || ''}${query ? `?${query}` : ''}${location.hash || ''}`;
            window.history?.replaceState(null, '', path);
            window.sessionStorage.removeItem('manager-content-mode-after-auth');
            return true;
        } catch {
            return false;
        }
    }

    function normalizeLocalWorkerOrigin(value) {
        if (typeof value !== 'string' || !value.trim()) return '';
        try {
            const url = new URL(value);
            if (!['http:', 'https:'].includes(url.protocol) || !isLoopbackHost(url.hostname)
                || url.username || url.password || url.search || url.hash || url.pathname !== '/') return '';
            return url.origin;
        } catch {
            return '';
        }
    }

    function managerDeepLinkSearch() {
        const params = new URLSearchParams(String(location.search || ''));
        const tools = params.getAll('tool');
        if (tools.length !== 1 || !/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(tools[0])) return '';
        return `?tool=${encodeURIComponent(tools[0])}`;
    }

    function managerContentDeepLinkSearch() {
        const params = new URLSearchParams();
        const tools = new URLSearchParams(String(location.search || '')).getAll('tool');
        if (tools.length === 1 && /^[a-z0-9][a-z0-9_-]{0,63}$/i.test(tools[0])) {
            params.set('tool', tools[0]);
        }
        params.set('content', 'database');
        return `?${params.toString()}`;
    }

    function normalizePagesOrigin(value) {
        if (typeof value !== 'string' || !value.trim()) return '';
        try {
            const url = new URL(value);
            if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') return '';
            return url.origin;
        } catch {
            return '';
        }
    }

    function setStatus(message, type = '') {
        const status = document.getElementById('card-admin-status');
        if (!status) return;
        status.textContent = String(message || '');
        status.hidden = !message;
        status.classList.toggle('is-error', type === 'error');
        status.classList.toggle('is-success', type === 'success');
    }

    function setAuthSurface({ authenticated = false, login = '', disabled = false } = {}) {
        const authPanel = document.getElementById('card-admin-auth');
        const sessionBar = document.getElementById('card-admin-session');
        const account = document.getElementById('card-admin-account');
        const tools = document.getElementById('card-admin-tools');
        const button = document.getElementById('card-admin-github-signin');
        if (authPanel) authPanel.hidden = Boolean(authenticated);
        if (sessionBar) sessionBar.hidden = !authenticated;
        if (account) account.textContent = authenticated ? String(login || '') : '';
        if (tools) tools.style.display = authenticated ? 'block' : 'none';
        if (button) button.disabled = Boolean(disabled || authenticated);
    }

    function setContentModeSurface() {
        const badge = document.getElementById('manager-content-mode');
        if (badge) {
            badge.hidden = !databaseContentMode;
            badge.textContent = databaseContentMode ? 'Database pilot' : '';
        }
        if (!databaseContentMode) return;

        const heading = document.getElementById('card-admin-delete-heading');
        const description = document.getElementById('card-admin-delete-description');
        const confirmation = document.getElementById('card-admin-delete-confirm-label');
        const button = document.getElementById('card-admin-delete-confirm-button');
        if (heading) heading.textContent = 'Card Archive';
        if (description) description.textContent = 'Archiving hides this card from public pages and form navigation while keeping its record and recovery data.';
        if (confirmation) confirmation.textContent = 'Type the folder name to confirm archiving';
        if (button) button.textContent = 'Archive From Catalog';
    }

    function friendlyError(error) {
        if (error?.code === 'CONFIG_REQUIRED') return 'Manager sign-in is not configured yet. Finish the setup steps to continue.';
        if (error?.code === 'AUTH_REQUIRED' || error?.status === 401) return 'Sign in with GitHub to manage cards.';
        if (error?.status === 403) return 'This GitHub account is not authorized to manage these cards.';
        return error?.message || 'Manager could not connect. Try again in a moment.';
    }

    function makeError(response, payload) {
        const message = typeof payload?.error?.message === 'string'
            ? payload.error.message.slice(0, 220)
            : 'Manager request failed. Try again in a moment.';
        const error = new Error(message);
        error.status = response.status;
        error.code = typeof payload?.error?.code === 'string' ? payload.error.code.slice(0, 64) : '';
        return error;
    }

    function cardListTimeoutError() {
        return Object.assign(new Error('Loading the card list timed out. Try refreshing Manager.'), { code: 'CARD_LIST_TIMEOUT' });
    }

    function invalidCardListProgressError() {
        return Object.assign(new Error('Manager returned invalid card loading progress.'), { code: 'INVALID_RESPONSE' });
    }

    async function request(path, options = {}) {
        if (localPreview && new URLSearchParams(location.search).get('preview') === '1') {
            throw new Error('Local design preview: remote actions are disabled.');
        }
        const route = allowedRoutes.get(path);
        const method = String(options.method || 'GET').toUpperCase();
        if (!isWorkerOrigin || !apiOrigin) throw Object.assign(new Error('Manager sign-in is not configured yet.'), { code: 'CONFIG_REQUIRED' });
        if (!route || !route.has(method)) throw new Error('This Manager request is not available.');

        const url = new URL(path, apiOrigin);
        if (url.origin !== apiOrigin || url.pathname !== path) throw new Error('Invalid Manager API route.');

        const pollCardList = path === '/api/cards' && method === 'GET';
        const deadline = pollCardList ? Date.now() + cardListTimeoutMs : 0;
        let attempts = 0;

        while (true) {
            const headers = { Accept: 'application/json' };
            const init = {
                method,
                credentials: 'same-origin',
                mode: 'same-origin',
                cache: 'no-store',
                redirect: 'error',
                headers
            };
            if (method !== 'GET') {
                if (!csrfToken) throw Object.assign(new Error('Your Manager session expired. Sign in again.'), { code: 'AUTH_REQUIRED', status: 401 });
                headers['Content-Type'] = 'application/json';
                headers['X-CSRF-Token'] = csrfToken;
                init.body = JSON.stringify(options.body ?? {});
            }

            let controller = null;
            let timeoutId = null;
            if (pollCardList) {
                const remaining = deadline - Date.now();
                if (remaining <= 0) throw cardListTimeoutError();
                controller = new AbortController();
                init.signal = controller.signal;
                timeoutId = setTimeout(() => controller.abort(), remaining);
            }

            let response;
            let payload = null;
            try {
                response = await fetch(url.href, init);
                try { payload = await response.json(); } catch {}
            } catch (error) {
                if (controller?.signal.aborted) throw cardListTimeoutError();
                throw error;
            } finally {
                if (timeoutId !== null) clearTimeout(timeoutId);
            }

            if (!response.ok) {
                const error = makeError(response, payload);
                if (response.status === 401) {
                    csrfToken = '';
                    window.CardAdminServer?.clearSession?.();
                    setAuthSurface({ disabled: false });
                }
                throw error;
            }

            if (pollCardList && response.status === 202) {
                const processed = payload?.processed;
                const total = payload?.total;
                const retryAfterMs = payload?.retryAfterMs;
                if (payload?.pending !== true
                    || !Number.isInteger(processed) || processed < 0
                    || !Number.isInteger(total) || total < 1 || processed >= total
                    || !Number.isFinite(retryAfterMs) || retryAfterMs < 0) {
                    throw invalidCardListProgressError();
                }
                attempts += 1;
                if (attempts >= cardListMaxAttempts || Date.now() >= deadline) throw cardListTimeoutError();

                setStatus(`Loading cards ${processed}/${total}…`);
                const delay = Math.min(1000, Math.max(50, retryAfterMs));
                await new Promise(resolve => setTimeout(resolve, Math.min(delay, Math.max(0, deadline - Date.now()))));
                continue;
            }

            return payload;
        }
    }

    function contentCardSummary(value) {
        const outer = value && typeof value === 'object' && !Array.isArray(value) ? value : null;
        const nested = outer?.card && typeof outer.card === 'object' && !Array.isArray(outer.card) ? outer.card : null;
        const source = nested ? { ...outer, ...nested } : outer;
        if (!source) throw Object.assign(new Error('Manager returned an invalid card summary.'), { code: 'INVALID_RESPONSE' });

        const id = typeof source.id === 'string' ? source.id : '';
        const slug = typeof source.slug === 'string' ? source.slug : id;
        const revision = source.revision;
        const status = source.status;
        if (!id || id.length > 160 || /[\/\\\u0000-\u001f]/.test(id) || id === '.' || id === '..'
            || slug !== id || !Number.isInteger(revision) || revision < 1
            || !['published', 'draft', 'archived'].includes(status)
            || !Array.isArray(source.linkedSlugs)
            || source.linkedSlugs.some(value => typeof value !== 'string')) {
            throw Object.assign(new Error('Manager returned an invalid card summary.'), { code: 'INVALID_RESPONSE' });
        }

        const linkedSlugs = [...new Set(source.linkedSlugs)].filter(value => value !== id);
        return {
            id,
            slug,
            revision,
            status,
            name: typeof source.name === 'string' && source.name ? source.name : slug,
            title: typeof source.title === 'string' ? source.title : '',
            type: typeof source.type === 'string' ? source.type : 'none',
            rarity: typeof source.rarity === 'string' || typeof source.rarity === 'number' ? source.rarity : '',
            thumb: typeof source.thumb === 'string' ? source.thumb : '',
            repoPath: typeof source.repoPath === 'string' ? source.repoPath : '',
            assetBase: typeof source.assetBase === 'string' ? source.assetBase : '',
            linkedSlugs
        };
    }

    function contentRouteAllowed(url, method) {
        if (method === 'GET' && url.pathname === '/api/content/cards' && !url.hash) {
            const keys = [...url.searchParams.keys()];
            if (keys.some(key => !['limit', 'cursor'].includes(key)) || new Set(keys).size !== keys.length) return false;
            const limit = url.searchParams.get('limit');
            if (limit !== null && (!/^\d+$/.test(limit) || Number(limit) < 1 || Number(limit) > 100)) return false;
            const cursor = url.searchParams.get('cursor');
            return cursor === null || (cursor.length > 0 && cursor.length <= 1024);
        }
        if (method === 'POST' && url.pathname === '/api/content/links/apply' && !url.search && !url.hash) return true;
        if (method !== 'POST' || url.search || url.hash) return false;

        const match = url.pathname.match(/^\/api\/content\/cards\/([^/]+)\/archive$/);
        if (!match) return false;
        try {
            const id = decodeURIComponent(match[1]);
            return Boolean(id && id !== '.' && id !== '..' && !/[\/\\\u0000-\u001f]/.test(id)
                && encodeURIComponent(id).toUpperCase() === match[1].toUpperCase());
        } catch {
            return false;
        }
    }

    async function contentRequest(path, options = {}) {
        if (!databaseContentMode) throw Object.assign(new Error('Database content mode is not enabled.'), { code: 'CONTENT_MODE_DISABLED' });
        if (localPreview && new URLSearchParams(location.search).get('preview') === '1') {
            throw new Error('Local design preview: remote actions are disabled.');
        }

        const method = String(options.method || 'GET').toUpperCase();
        if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) {
            throw new Error('This Manager content request is not available.');
        }
        if (!isWorkerOrigin || !apiOrigin) throw Object.assign(new Error('Manager sign-in is not configured yet.'), { code: 'CONFIG_REQUIRED' });

        let url;
        try { url = new URL(path, apiOrigin); }
        catch { throw new Error('Invalid Manager content API route.'); }
        const rawPath = path.split(/[?#]/, 1)[0];
        if (url.origin !== apiOrigin || url.pathname !== rawPath || !contentRouteAllowed(url, method)) {
            throw new Error('This Manager content request is not available.');
        }

        const headers = { Accept: 'application/json' };
        const init = {
            method,
            credentials: 'same-origin',
            mode: 'same-origin',
            cache: 'no-store',
            redirect: 'error',
            headers
        };
        if (method !== 'GET') {
            if (!csrfToken) throw Object.assign(new Error('Your Manager session expired. Sign in again.'), { code: 'AUTH_REQUIRED', status: 401 });
            headers['Content-Type'] = 'application/json';
            headers['X-CSRF-Token'] = csrfToken;
            init.body = JSON.stringify(options.body ?? {});
        }

        let response;
        let payload = null;
        try {
            response = await fetch(url.href, init);
            try { payload = await response.json(); } catch {}
        } catch (error) {
            throw error;
        }

        if (!response.ok) {
            const error = makeError(response, payload);
            if (response.status === 401) {
                csrfToken = '';
                window.CardAdminServer?.clearSession?.();
                setAuthSurface({ disabled: false });
            }
            throw error;
        }
        if (response.status === 202) {
            throw Object.assign(new Error('Manager returned an unexpected pending content response.'), { code: 'INVALID_RESPONSE', status: 202 });
        }
        return payload;
    }

    async function loadContentCatalog() {
        if (!databaseContentMode) throw Object.assign(new Error('Database content mode is not enabled.'), { code: 'CONTENT_MODE_DISABLED' });
        const cards = [];
        const ids = new Set();
        const cursors = new Set();
        let cursor = null;

        for (let page = 0; page < 250; page += 1) {
            const query = new URLSearchParams({ limit: '100' });
            if (cursor !== null) query.set('cursor', cursor);
            const result = await contentRequest(`/api/content/cards?${query.toString()}`);
            if (result?.schemaVersion !== 1 || !Array.isArray(result.cards) || result.cards.length > 100
                || !(result.nextCursor === null || typeof result.nextCursor === 'string')) {
                throw Object.assign(new Error('Manager returned an invalid database card catalog.'), { code: 'INVALID_RESPONSE' });
            }
            for (const value of result.cards) {
                const card = contentCardSummary(value);
                if (ids.has(card.id)) throw Object.assign(new Error('Manager returned a duplicate card in the database catalog.'), { code: 'INVALID_RESPONSE' });
                ids.add(card.id);
                if (card.status !== 'archived') cards.push(card);
            }

            if (result.nextCursor === null) return cards.sort((a, b) => a.name.localeCompare(b.name));
            if (!result.nextCursor || result.nextCursor.length > 1024 || cursors.has(result.nextCursor)) {
                throw Object.assign(new Error('Manager returned an invalid database catalog cursor.'), { code: 'INVALID_RESPONSE' });
            }
            cursors.add(result.nextCursor);
            cursor = result.nextCursor;
        }

        throw Object.assign(new Error('The database card catalog exceeded its page limit.'), { code: 'INVALID_RESPONSE' });
    }

    async function init() {
        if (initPromise) return initPromise;
        initPromise = (async () => {
            if (localPreview && new URLSearchParams(location.search).get('preview') === '1') {
                const thumb = '/abscustom/Custom%20Cards/9071718/images/asset-5c792d971cb75ad3f4aa31a21cd3caeb804269ff0e3178e071b91e78e301c776.png';
                const cards = ['SSR example','TUR example','LR example','Alternate form','Unlinked example','Second example'].map((name,index) => {
                    const slug = `preview-${index}`;
                    return {
                        id: slug, slug, revision: 1, status: 'published', name, title: 'Local design sample', type: 'phy', thumb,
                        repoPath: `Custom Cards/${slug}`, assetBase: `https://abscustom.github.io/Custom%20Cards/${slug}/`,
                        linkedSlugs: index < 3 ? [0,1,2].filter(other=>other!==index).map(other=>`preview-${other}`) : []
                    };
                });
                window.CardAdminServer.setSession({login:'Local design preview',capabilities:{link:false,delete:false}},cards);
                setAuthSurface({authenticated:true,login:'Local design preview — no remote saves'});
                setStatus('Sample cards only. Select, drag and stage links freely; saving and deletion are disabled.');
                return {authenticated:false,preview:true};
            }
            if (!isWorkerOrigin) {
                const onConfiguredPagesOrigin = pagesOrigin && location.origin === pagesOrigin;
                const onGitHubPages = location.hostname.endsWith('.github.io');
                if (managerOrigin && (onConfiguredPagesOrigin || onGitHubPages || localPreview)) {
                    location.replace(`${managerOrigin}/manager.html${managerDeepLinkSearch()}`);
                    return { authenticated: false, redirecting: true };
                }
                setAuthSurface({ disabled: true });
                setStatus('Manager sign-in is not configured yet. Finish the setup steps to continue.', 'error');
                return { authenticated: false, configRequired: true };
            }

            try {
                const session = await request('/api/session');
                if (!session || typeof session.login !== 'string' || !session.login.trim()
                    || typeof session.csrfToken !== 'string' || session.csrfToken.length < 16 || session.csrfToken.length > 256) {
                    throw new Error('Manager returned an invalid session response.');
                }
                csrfToken = session.csrfToken;
                const result = await request('/api/cards');
                if (!Array.isArray(result?.cards)) throw new Error('Manager returned an invalid card list.');
                if (typeof window.CardAdminServer?.setSession !== 'function') {
                    throw Object.assign(new Error('Manager workspace is not ready. Reload the page.'), { code: 'CLIENT_UNAVAILABLE' });
                }
                window.CardAdminServer.setSession(session, result.cards);
                setAuthSurface({ authenticated: true, login: session.login });
                setStatus('');
                return { authenticated: true, session, cards: result.cards };
            } catch (error) {
                csrfToken = '';
                if (error?.code === 'AUTH_REQUIRED' || error?.status === 401) {
                    window.CardAdminServer?.clearSession?.();
                    setAuthSurface({ disabled: false });
                } else {
                    setAuthSurface({ disabled: error?.code === 'CONFIG_REQUIRED' });
                }
                setStatus(friendlyError(error), error?.code === 'AUTH_REQUIRED' || error?.status === 401 ? '' : 'error');
                return { authenticated: false, error };
            } finally {
                initPromise = null;
            }
        })();
        return initPromise;
    }

    async function initDatabaseContent() {
        setContentModeSurface();
        if (localPreview && new URLSearchParams(location.search).get('preview') === '1') return init();
        if (initPromise) return initPromise;
        initPromise = (async () => {
            if (!isWorkerOrigin) {
                const onConfiguredPagesOrigin = pagesOrigin && location.origin === pagesOrigin;
                const onGitHubPages = location.hostname.endsWith('.github.io');
                if (managerOrigin && (onConfiguredPagesOrigin || onGitHubPages || localPreview)) {
                    location.replace(`${managerOrigin}/manager.html${managerContentDeepLinkSearch()}`);
                    return { authenticated: false, redirecting: true, contentMode: 'database' };
                }
                setAuthSurface({ disabled: true });
                setStatus('Database Manager is not configured for this origin.', 'error');
                return { authenticated: false, configRequired: true, contentMode: 'database' };
            }

            try {
                const session = await request('/api/session');
                if (!session || typeof session.login !== 'string' || !session.login.trim()
                    || typeof session.csrfToken !== 'string' || session.csrfToken.length < 16 || session.csrfToken.length > 256) {
                    throw new Error('Manager returned an invalid session response.');
                }
                csrfToken = session.csrfToken;
                const cards = await loadContentCatalog();
                if (typeof window.CardAdminServer?.setSession !== 'function') {
                    throw Object.assign(new Error('Manager workspace is not ready. Reload the page.'), { code: 'CLIENT_UNAVAILABLE' });
                }
                window.CardAdminServer.setSession(session, cards);
                setAuthSurface({ authenticated: true, login: session.login });
                setStatus('Database content pilot is active. Manager changes use the card database.');
                return { authenticated: true, session, cards, contentMode: 'database' };
            } catch (error) {
                csrfToken = '';
                if (error?.code === 'AUTH_REQUIRED' || error?.status === 401) {
                    window.CardAdminServer?.clearSession?.();
                    setAuthSurface({ disabled: false });
                } else {
                    setAuthSurface({ disabled: error?.code === 'CONFIG_REQUIRED' });
                }
                setStatus(friendlyError(error), error?.code === 'AUTH_REQUIRED' || error?.status === 401 ? '' : 'error');
                return { authenticated: false, error, contentMode: 'database' };
            } finally {
                initPromise = null;
            }
        })();
        return initPromise;
    }

    function startLogin() {
        if (!managerOrigin) {
            setAuthSurface({ disabled: true });
            setStatus('Manager sign-in is not configured yet. Finish the setup steps to continue.', 'error');
            return;
        }
        const targetOrigin = isWorkerOrigin ? location.origin : managerOrigin;
        const button = document.getElementById('card-admin-github-signin');
        if (button) { button.disabled = true; button.textContent = 'Connecting to GitHub…'; }
        if (databaseContentMode) {
            try { window.sessionStorage?.setItem(pendingContentModeKey, 'database'); } catch {}
        }
        setStatus('Connecting to GitHub…');
        location.assign(`${targetOrigin}/auth/start`);
    }

    async function logout() {
        const button = document.getElementById('card-admin-signout');
        if (button) button.disabled = true;
        setStatus('Signing out…');
        try {
            await request('/api/session/logout', { method: 'POST' });
            csrfToken = '';
            window.CardAdminServer?.clearSession?.();
            setAuthSurface({ disabled: false });
            setStatus('Signed out.', 'success');
        } catch (error) {
            if (error?.status === 401 || error?.code === 'AUTH_REQUIRED') {
                csrfToken = '';
                window.CardAdminServer?.clearSession?.();
                setAuthSurface({ disabled: false });
                setStatus('Signed out.', 'success');
                return;
            }
            setStatus(friendlyError(error), 'error');
        } finally {
            if (button) button.disabled = false;
        }
    }

    function bindControls() {
        const form = document.getElementById('card-admin-auth-form');
        if (form) form.addEventListener('submit', event => {
            event.preventDefault();
            startLogin();
        });

        const signOut = document.getElementById('card-admin-signout');
        if (signOut) signOut.addEventListener('click', () => { void logout(); });

        const deleteFilter = document.getElementById('card-admin-delete-filter');
        if (deleteFilter) deleteFilter.addEventListener('input', event => {
            window.filterCardAdminDeleteCards?.(event.currentTarget.value);
        });

        const deleteButton = document.getElementById('card-admin-delete-confirm-button');
        if (deleteButton) deleteButton.addEventListener('click', () => {
            window.deleteSelectedCustomCard?.();
        });

        if (!workerOrigin) {
            setAuthSurface({ disabled: true });
            setStatus('Manager sign-in is not configured yet. Finish the setup steps to continue.', 'error');
        }
    }

    function isLegacyContentRoute(path) {
        try {
            const pathname = new URL(String(path), apiOrigin || location.origin).pathname;
            return ['/api/cards', '/api/links/apply', '/api/cards/delete'].includes(pathname);
        } catch {
            return false;
        }
    }

    window.ManagerAuth = Object.freeze({
        enabled: isWorkerOrigin || (localPreview && new URLSearchParams(location.search).get('preview') === '1'),
        databaseMode: databaseContentMode,
        init: () => {
            setContentModeSurface();
            return databaseContentMode ? initDatabaseContent() : init();
        },
        request: (path, options = {}) => {
            if (databaseContentMode && isLegacyContentRoute(path)) {
                return Promise.reject(Object.assign(new Error('Legacy card APIs are disabled while database content mode is active.'), { code: 'LEGACY_CONTENT_DISABLED' }));
            }
            return request(path, options);
        },
        contentRequest,
        loadContentCatalog,
        startLogin,
        logout
    });

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindControls, { once: true });
    else bindControls();
})();
