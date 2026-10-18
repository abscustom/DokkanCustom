(function () {
    'use strict';
    const params = new URLSearchParams(location.search), origin = params.get('origin'), nonce = params.get('nonce');
    const allowed = new Set(['https://abscustom.github.io', 'http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:4173', 'http://127.0.0.1:4173']);
    const status = document.getElementById('status'), save = document.getElementById('save');
    let draft = null, csrf = '', busy = false;
    document.getElementById('sign-in').href = '/auth/start';
    if (!window.opener || !allowed.has(origin) || !/^[a-f0-9-]{36}$/.test(nonce || '')) { status.textContent = 'Open this publisher from your card editor.'; return; }
    async function request(path, options = {}) {
        const response = await fetch(path, { ...options, credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf } : {}) } });
        const result = await response.json();
        if (!response.ok) throw Object.assign(new Error(result.error?.message || 'The card could not be saved.'), { status: response.status });
        return result;
    }
    async function checkSession() {
        try {
            const session = await request('/api/session'); csrf = session.csrfToken || '';
            status.textContent = draft ? 'Ready to save. Review the card and revision below.' : 'Signed in. Waiting for the editor…';
        } catch { csrf = ''; status.textContent = 'Sign in to Manager in the new tab, then choose Check sign-in.'; }
        save.disabled = busy || !draft || !csrf;
    }
    window.addEventListener('message', event => {
        if (busy || draft || event.origin !== origin || event.source !== window.opener || event.data?.type !== 'card-publisher-draft' || event.data?.nonce !== nonce) return;
        const incoming = event.data;
        if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(incoming.id || '') || !incoming.request?.card || !Number.isSafeInteger(incoming.request.expectedRevision)) return;
        if (JSON.stringify(incoming.request).length > 1500000) { status.textContent = 'This card is too large. Export a backup and reduce its embedded content.'; return; }
        draft = { id: incoming.id, request: incoming.request };
        document.getElementById('name').textContent = draft.request.card.name;
        document.getElementById('card-id').textContent = draft.id;
        document.getElementById('revision').textContent = draft.request.expectedRevision || 'New card';
        checkSession();
    });
    document.getElementById('retry').addEventListener('click', checkSession);
    save.addEventListener('click', async () => {
        if (busy || !draft || !csrf) return;
        busy = true; save.disabled = true; status.textContent = 'Saving…';
        try {
            const result = await request('/api/content/cards/' + encodeURIComponent(draft.id), { method: 'PUT', body: JSON.stringify(draft.request) });
            if (!Number.isSafeInteger(result.card?.revision)) throw new Error('Save response was incomplete. Check the latest card before retrying.');
            draft.request.expectedRevision = result.card.revision;
            document.getElementById('revision').textContent = result.card.revision;
            status.textContent = 'Card saved. You can return to the editor.';
            window.opener.postMessage({ type: 'card-publisher-saved', nonce, id: draft.id, revision: result.card.revision }, origin);
            draft = null;
        } catch (error) {
            status.textContent = error.status === 409 ? 'A newer revision exists. Your changes remain in the editor. Export them, then reload the latest card before applying them again.' : error.message;
            if (error.status === 409) draft = null;
        } finally { busy = false; save.disabled = !draft || !csrf; }
    });
    window.opener.postMessage({ type: 'card-publisher-ready', nonce }, origin);
    checkSession();
})();
