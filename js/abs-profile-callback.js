/* Redeems a one-use profile ticket, then returns to its same-origin caller. */
(() => {
    'use strict';
    const CONFIG = window.ABS_PROFILE_CONFIG || {};
    const TOKEN_KEY = 'abs_profile_handle_v1';
    const FLOW_KEY = 'abs_profile_flow_v1';
    const workerOrigin = normalizeOrigin(CONFIG.workerOrigin);
    const allowedOrigins = new Set(Array.isArray(CONFIG.allowedOrigins) ? CONFIG.allowedOrigins : []);
    const status = document.getElementById('profile-callback-message');
    const errorNode = document.getElementById('profile-callback-error');
    const returnLink = document.getElementById('profile-callback-return');
    let returnTo = null;

    function normalizeOrigin(value) {
        if (typeof value !== 'string') return '';
        try {
            const url = new URL(value);
            if (!['https:','http:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) return '';
            return url.origin;
        } catch { return ''; }
    }

    function showError(message) {
        status.textContent = 'Your ABS profile could not be connected.';
        errorNode.textContent = message;
        errorNode.hidden = false;
        if (returnTo) {
            returnLink.href = returnTo;
            returnLink.hidden = false;
        }
    }

    function readFlow() {
        const raw = sessionStorage.getItem(FLOW_KEY);
        if (!raw || raw.length > 4096) throw new Error('This tab has no active sign-in request. Start again from ABS.');
        const flow = JSON.parse(raw);
        if (!flow || typeof flow !== 'object' || typeof flow.verifier !== 'string' || !/^[A-Za-z0-9_-]{40,64}$/.test(flow.verifier)
            || typeof flow.nonce !== 'string' || !/^[A-Za-z0-9_-]{40,64}$/.test(flow.nonce)
            || typeof flow.returnTo !== 'string' || !Number.isFinite(flow.createdAt)
            || Date.now() - flow.createdAt > 10 * 60 * 1000 || flow.createdAt > Date.now() + 30000) {
            throw new Error('This tab’s sign-in request expired. Start again from ABS.');
        }
        const target = new URL(flow.returnTo, location.origin);
        if (!flow.returnTo.startsWith('/') || flow.returnTo.startsWith('//') || flow.returnTo.includes('\\')
            || target.origin !== location.origin || /\/profile-callback\.html$/i.test(target.pathname)) {
            throw new Error('The sign-in return location is not allowed. Start again from ABS.');
        }
        if (location.origin === normalizeOrigin(CONFIG.pagesOrigin)
            && target.pathname !== normalizeBasePath(CONFIG.siteBasePath).slice(0, -1)
            && !target.pathname.startsWith(normalizeBasePath(CONFIG.siteBasePath))) {
            throw new Error('The sign-in return location is not allowed. Start again from ABS.');
        }
        returnTo = `${target.pathname}${target.search}${target.hash}`;
        return flow;
    }

    function normalizeBasePath(value) {
        if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/DokkanCustom/';
        return value.endsWith('/') ? value : `${value}/`;
    }

    function getFragment() {
        const params = new URLSearchParams(String(window.__ABS_PROFILE_CALLBACK_FRAGMENT__ || '').replace(/^#/, ''));
        if (params.getAll('ticket').length !== 1 || params.getAll('nonce').length !== 1) throw new Error('The sign-in response is incomplete. Start again from ABS.');
        const ticket = params.get('ticket');
        const nonce = params.get('nonce');
        if (!/^[A-Za-z0-9_-]{20,512}$/.test(ticket || '') || !/^[A-Za-z0-9_-]{40,64}$/.test(nonce || '')) {
            throw new Error('The sign-in response is invalid. Start again from ABS.');
        }
        return {ticket,nonce};
    }

    function sameSecret(left, right) {
        if (typeof left !== 'string' || typeof right !== 'string' || left.length !== right.length) return false;
        let mismatch = 0;
        for (let i = 0; i < left.length; i += 1) mismatch |= left.charCodeAt(i) ^ right.charCodeAt(i);
        return mismatch === 0;
    }

    function validProfilePayload(payload) {
        const expiresAt = typeof payload?.expiresAt === 'number' && Number.isSafeInteger(payload.expiresAt)
            ? payload.expiresAt * 1000
            : typeof payload?.expiresAt === 'string' ? Date.parse(payload.expiresAt) : NaN;
        if (!payload || typeof payload !== 'object' || typeof payload.token !== 'string'
            || payload.token.length < 20 || payload.token.length > 2048 || !/^[A-Za-z0-9._~-]+$/.test(payload.token)
            || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) return false;
        const profile = payload.profile;
        if (!profile || typeof profile !== 'object' || typeof profile.login !== 'string' || !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(profile.login)
            || (profile.displayName !== null && (typeof profile.displayName !== 'string' || profile.displayName.length > 120))
            || !['member','admin'].includes(profile.role)) return false;
        if (profile.avatarUrl !== null && profile.avatarUrl !== '') {
            if (typeof profile.avatarUrl !== 'string' || profile.avatarUrl.length > 500) return false;
            try {
                const avatar = new URL(profile.avatarUrl);
                if (avatar.protocol !== 'https:' || avatar.hostname !== 'avatars.githubusercontent.com' || avatar.port || avatar.username || avatar.password || avatar.hash) return false;
            } catch { return false; }
        }
        const access = payload.managerAccess;
        if (!access || !['ready','not_admin','restricted','unavailable'].includes(access.status)) return false;
        if ((profile.role === 'member' && access.status !== 'not_admin') || (profile.role === 'admin' && access.status === 'not_admin')) return false;
        if (access.code !== undefined && (typeof access.code !== 'string' || !/^[A-Z0-9_]{1,64}$/.test(access.code))) return false;
        return true;
    }

    async function exchange(ticket, verifier, nonce) {
        if (!workerOrigin || !allowedOrigins.has(location.origin)) throw new Error('Profile sign-in is not available on this origin.');
        const response = await fetch(new URL('/profile/exchange', workerOrigin).href, {
            method:'POST',
            mode:'cors',
            credentials:'omit',
            cache:'no-store',
            redirect:'error',
            headers:{Accept:'application/json','Content-Type':'application/json'},
            body:JSON.stringify({ticket,verifier,nonce})
        });
        let payload = null;
        try { payload = await response.json(); } catch {}
        if (!response.ok || !validProfilePayload(payload)) throw new Error('The sign-in ticket could not be verified. Start again from ABS.');
        return payload;
    }

    async function run() {
        let flow;
        try {
            if (window.__ABS_PROFILE_CALLBACK_SCRUBBED__ !== true) throw new Error('The sign-in response could not be safely cleared from the address bar. Start again from ABS.');
            if (!allowedOrigins.has(location.origin)) throw new Error('Profile sign-in is not available on this origin.');
            const callback = getFragment();
            flow = readFlow();
            sessionStorage.removeItem(FLOW_KEY);
            if (!sameSecret(callback.nonce, flow.nonce)) throw new Error('The sign-in response did not match this tab. Start again from ABS.');
            const payload = await exchange(callback.ticket, flow.verifier, callback.nonce);
            sessionStorage.setItem(TOKEN_KEY, payload.token);
            status.textContent = 'Profile connected. Returning to ABS…';
            location.replace(returnTo);
        } catch (error) {
            try { sessionStorage.removeItem(FLOW_KEY); } catch {}
            showError(error instanceof DOMException && error.name === 'QuotaExceededError'
                ? 'This browser cannot save the profile session. Enable tab storage and try again.'
                : (error?.message || 'Check your connection and try again.'));
        }
    }

    void run();
})();
