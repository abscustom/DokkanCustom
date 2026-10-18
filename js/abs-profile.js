/* Website profile handle UI. Roles are rendered only from a fresh server response. */
(() => {
    'use strict';
    if (window.absProfile) return;

    const config = window.ABS_PROFILE_CONFIG || window.MANAGER_AUTH_CONFIG || {};
    const TOKEN_KEY = 'abs_profile_handle_v1';
    const FLOW_KEY = 'abs_profile_flow_v1';
    const allowedOrigins = new Set(Array.isArray(config.allowedOrigins) ? config.allowedOrigins : []);
    const profileWorkerOrigin = normalizeProfileWorkerOrigin(config.workerOrigin);
    const pagesOrigin = normalizeOrigin(config.pagesOrigin);
    const siteBasePath = normalizeSiteBasePath(config.siteBasePath || '/DokkanCustom/');
    const workerOrigin = normalizeOrigin(window.MANAGER_AUTH_CONFIG?.workerOrigin || config.workerOrigin);
    const isManagerHost = Boolean((workerOrigin && location.origin === workerOrigin) || window.ManagerAuth?.enabled);
    let state = {status:'checking', profile:null, managerAccess:null, message:'Checking your account…', error:false};
    let panel = null;
    let trigger = null;
    let signInButton = null;
    let signOutButton = null;
    let managerLink = null;
    let messageNode = null;
    let displayNode = null;
    let loginNode = null;
    let badgeNode = null;
    let avatarNode = null;
    let avatarFallback = null;
    let profileToken = '';
    let managerInitPromise = null;
    let managerObserver = null;
    let storageAvailable = false;

    function normalizeOrigin(value) {
        if (typeof value !== 'string' || !value.trim()) return '';
        try {
            const url = new URL(value);
            if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password
                || url.pathname !== '/' || url.search || url.hash) return '';
            return url.origin;
        } catch { return ''; }
    }

    function normalizeProfileWorkerOrigin(value) {
        const origin = normalizeOrigin(value);
        if (!origin) return '';
        try {
            const url = new URL(origin);
            return url.protocol === 'https:' && url.hostname === 'abs-manager-auth.trashullu.workers.dev' ? origin : '';
        } catch { return ''; }
    }

    function normalizeSiteBasePath(value) {
        if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/DokkanCustom/';
        const normalized = value.replace(/\/{2,}/g, '/');
        return normalized.endsWith('/') ? normalized : `${normalized}/`;
    }

    function checkStorage() {
        try {
            const key = `__abs_profile_probe_${Date.now()}`;
            sessionStorage.setItem(key, '1');
            sessionStorage.removeItem(key);
            storageAvailable = true;
        } catch {
            storageAvailable = false;
        }
        return storageAvailable;
    }

    function safeStorageGet(key) {
        try { return sessionStorage.getItem(key); } catch { return null; }
    }

    function safeStorageSet(key, value) {
        try { sessionStorage.setItem(key, value); return true; } catch { return false; }
    }

    function safeStorageRemove(key) {
        try { sessionStorage.removeItem(key); } catch {}
    }

    function snapshot() {
        return {
            status:state.status,
            profile:state.profile ? {...state.profile} : null,
            managerAccess:state.managerAccess ? {...state.managerAccess} : null,
            message:state.message,
            error:state.error
        };
    }

    function setState(next) {
        state = {
            status:next.status,
            profile:next.profile ? {...next.profile} : null,
            managerAccess:next.managerAccess ? {...next.managerAccess} : null,
            message:String(next.message || ''),
            error:Boolean(next.error)
        };
        render();
        window.dispatchEvent(new CustomEvent('abs-profile-change', {detail:snapshot()}));
    }

    function setUnavailable(message = 'Profile verification is temporarily unavailable. Try again.') {
        profileToken = '';
        setState({status:'unavailable', profile:null, managerAccess:null, message, error:true});
    }

    function siteBase() {
        if (isManagerHost && pagesOrigin) return new URL(siteBasePath, pagesOrigin);
        try { return new URL(window.absNavigation?.getBaseUrl?.() || siteBasePath, location.origin); }
        catch { return new URL(siteBasePath, location.origin); }
    }

    function makeButton(label, className) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `abs-profile-action ${className}`;
        button.textContent = label;
        return button;
    }

    function mount() {
        const sidebar = document.getElementById('abs-main-sidebar');
        if (!sidebar) return false;
        let area = sidebar.querySelector('.abs-profile-area');
        if (area) return true;
        area = document.createElement('section');
        area.className = 'abs-profile-area';
        area.setAttribute('aria-label', 'Account');

        trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'abs-profile-trigger';
        trigger.setAttribute('aria-haspopup', 'dialog');
        trigger.setAttribute('aria-expanded', 'false');
        trigger.setAttribute('aria-label', 'Profile');
        trigger.title = 'Profile';

        avatarNode = document.createElement('img');
        avatarNode.className = 'abs-profile-avatar';
        avatarNode.alt = '';
        avatarNode.width = 30;
        avatarNode.height = 30;
        avatarNode.decoding = 'async';
        avatarNode.referrerPolicy = 'no-referrer';
        avatarNode.hidden = true;
        avatarFallback = document.createElement('span');
        avatarFallback.className = 'abs-profile-avatar-fallback';
        avatarFallback.setAttribute('aria-hidden', 'true');
        avatarFallback.textContent = 'P';
        const triggerLabel = document.createElement('span');
        triggerLabel.className = 'abs-profile-trigger-label';
        triggerLabel.textContent = 'Profile';
        trigger.append(avatarNode, avatarFallback, triggerLabel);

        panel = document.createElement('div');
        panel.className = 'abs-profile-panel';
        panel.id = 'abs-profile-panel';
        panel.hidden = true;
        panel.tabIndex = -1;
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-label', 'Profile menu');

        const identity = document.createElement('div');
        identity.className = 'abs-profile-identity';
        const identityAvatar = document.createElement('img');
        identityAvatar.className = 'abs-profile-avatar';
        identityAvatar.alt = '';
        identityAvatar.width = 40;
        identityAvatar.height = 40;
        identityAvatar.decoding = 'async';
        identityAvatar.referrerPolicy = 'no-referrer';
        identityAvatar.hidden = true;
        avatarNode.dataset.identityPeer = 'trigger';
        identityAvatar.dataset.identityPeer = 'panel';
        const identityFallback = document.createElement('span');
        identityFallback.className = 'abs-profile-avatar-fallback';
        identityFallback.setAttribute('aria-hidden', 'true');
        identityFallback.textContent = 'P';
        identityFallback.dataset.identityFallback = 'panel';
        const copy = document.createElement('div');
        copy.className = 'abs-profile-identity-copy';
        displayNode = document.createElement('div');
        displayNode.className = 'abs-profile-display-name';
        loginNode = document.createElement('div');
        loginNode.className = 'abs-profile-login';
        copy.append(displayNode, loginNode);
        identity.append(identityAvatar, identityFallback, copy);

        badgeNode = document.createElement('span');
        badgeNode.className = 'abs-profile-badge';
        badgeNode.hidden = true;
        const message = document.createElement('p');
        message.className = 'abs-profile-message';
        messageNode = message;
        const actions = document.createElement('div');
        actions.className = 'abs-profile-actions';
        managerLink = document.createElement('a');
        managerLink.className = 'abs-profile-action abs-profile-manager-link';
        managerLink.href = new URL('manager.html', siteBase()).href;
        managerLink.textContent = 'Manager';
        managerLink.hidden = true;
        signInButton = makeButton('Sign in with GitHub', 'abs-profile-signin');
        signOutButton = makeButton('Sign out', 'abs-profile-signout');
        signOutButton.hidden = true;
        actions.append(managerLink, signInButton, signOutButton);
        panel.append(identity, badgeNode, message, actions);
        area.append(trigger, panel);
        const footer = sidebar.querySelector('.abs-sidebar-footer');
        if (footer) sidebar.insertBefore(area, footer);
        else sidebar.append(area);

        trigger.addEventListener('click', () => setPanelOpen(panel.hidden));
        signInButton.addEventListener('click', () => { void signIn(); });
        signOutButton.addEventListener('click', () => { void signOut(); });
        panel.addEventListener('keydown', event => {
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                setPanelOpen(false, true);
            }
        });
        document.addEventListener('pointerdown', event => {
            if (!panel.hidden && !area.contains(event.target)) setPanelOpen(false);
        }, true);
        window.addEventListener('resize', positionPanel, {passive:true});
        window.addEventListener('scroll', positionPanel, {passive:true, capture:true});
        window.addEventListener('abs-shell-layout-change', positionPanel);
        return true;
    }

    function setPanelOpen(open, restoreFocus = false) {
        if (!panel || !trigger) return;
        panel.hidden = !open;
        trigger.setAttribute('aria-expanded', String(open));
        if (open) {
            positionPanel();
            panel.querySelector('a:not([hidden]),button:not([hidden]):not([disabled])')?.focus();
        } else if (restoreFocus) trigger.focus();
    }

    function positionPanel() {
        if (!panel || panel.hidden) return;
        window.absNavigation?.positionPopover?.(panel, trigger);
    }

    function initials(profile) {
        const text = String(profile?.displayName || profile?.login || 'P').trim();
        const parts = text.split(/[\s._-]+/).filter(Boolean);
        return (parts.length > 1 ? parts[0][0] + parts.at(-1)[0] : text.slice(0,2)).toUpperCase();
    }

    function validatedAvatar(value) {
        if (value === null || value === '') return '';
        if (typeof value !== 'string' || value.length > 500) throw new Error('Invalid avatar URL.');
        const url = new URL(value);
        if (url.protocol !== 'https:' || url.hostname !== 'avatars.githubusercontent.com'
            || url.port || url.username || url.password || url.hash) throw new Error('Invalid avatar URL.');
        return url.href;
    }

    function parseProfileResponse(payload) {
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Invalid profile response.');
        const expiresAt = typeof payload.expiresAt === 'number' && Number.isSafeInteger(payload.expiresAt)
            ? payload.expiresAt * 1000
            : typeof payload.expiresAt === 'string' ? Date.parse(payload.expiresAt) : NaN;
        if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) throw new Error('Expired profile response.');
        const source = payload.profile;
        if (!source || typeof source !== 'object' || Array.isArray(source)) throw new Error('Invalid profile data.');
        if (typeof source.login !== 'string' || !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(source.login)) throw new Error('Invalid profile login.');
        if (source.displayName !== null && (typeof source.displayName !== 'string' || source.displayName.length > 120)) throw new Error('Invalid profile name.');
        if (!['member','admin'].includes(source.role)) throw new Error('Invalid profile role.');
        const access = payload.managerAccess;
        if (!access || typeof access !== 'object' || !['ready','not_admin','restricted','unavailable'].includes(access.status)) throw new Error('Invalid Manager access status.');
        if (access.code !== undefined && (typeof access.code !== 'string' || !/^[A-Z0-9_]{1,64}$/.test(access.code))) throw new Error('Invalid Manager access code.');
        if ((source.role === 'member' && access.status !== 'not_admin') || (source.role === 'admin' && access.status === 'not_admin')) throw new Error('Inconsistent profile authorization.');
        return {
            expiresAt,
            profile:{login:source.login,displayName:source.displayName,avatarUrl:validatedAvatar(source.avatarUrl),role:source.role},
            managerAccess:{status:access.status, ...(access.code ? {code:access.code} : {})}
        };
    }

    async function requestProfile(path, token, method = 'GET', body = undefined) {
        if (!profileWorkerOrigin || !allowedOrigins.has(location.origin)) throw new Error('Profile is unavailable on this origin.');
        const url = new URL(path, profileWorkerOrigin);
        if (url.origin !== profileWorkerOrigin || url.pathname !== path) throw new Error('Invalid profile API route.');
        const headers = {Accept:'application/json',Authorization:`Bearer ${token}`};
        const init = {method,mode:'cors',credentials:'omit',cache:'no-store',redirect:'error',headers};
        if (body !== undefined) {
            headers['Content-Type'] = 'application/json';
            init.body = JSON.stringify(body);
        }
        const response = await fetch(url.href, init);
        let payload = null;
        try { payload = await response.json(); } catch {}
        if (!response.ok) throw Object.assign(new Error('Profile request failed.'), {status:response.status});
        return payload;
    }

    function render() {
        if (!trigger) return;
        const triggerLabel = trigger.querySelector('.abs-profile-trigger-label');
        const profile = state.profile;
        const authenticated = state.status === 'signed-in';
        const label = authenticated ? (profile.displayName || profile.login) : state.status === 'guest' ? 'Sign in' : 'Profile';
        triggerLabel.textContent = label;
        trigger.setAttribute('aria-label', authenticated ? `Profile: ${profile.login}` : state.status === 'guest' ? 'Sign in or view profile' : 'Profile');
        trigger.title = authenticated ? `${profile.displayName || profile.login} (@${profile.login})` : label;
        displayNode.textContent = profile ? (profile.displayName || profile.login) : 'Your ABS profile';
        loginNode.textContent = profile ? `@${profile.login}` : (state.status === 'guest' ? 'Sign in to connect your GitHub account' : '');
        badgeNode.hidden = !profile;
        badgeNode.dataset.role = profile?.role || '';
        badgeNode.textContent = profile?.role === 'admin' ? 'Admin' : 'Member';
        const avatar = profile?.avatarUrl || '';
        avatarNode.hidden = !avatar;
        avatarFallback.hidden = Boolean(avatar);
        avatarFallback.textContent = profile ? initials(profile) : 'P';
        const panelAvatar = panel?.querySelector('img[data-identity-peer="panel"]');
        const panelFallback = panel?.querySelector('[data-identity-fallback="panel"]');
        if (panelAvatar) {
            panelAvatar.hidden = !avatar;
            panelAvatar.src = avatar || '';
            panelAvatar.onerror = () => { panelAvatar.hidden = true; if (panelFallback) panelFallback.hidden = false; };
        }
        if (panelFallback) { panelFallback.hidden = Boolean(avatar); panelFallback.textContent = profile ? initials(profile) : 'P'; }
        if (avatar) {
            avatarNode.src = avatar;
            avatarNode.onerror = () => { avatarNode.hidden = true; avatarFallback.hidden = false; };
        } else avatarNode.removeAttribute('src');
        managerLink.hidden = !(authenticated && profile.role === 'admin' && state.managerAccess?.status === 'ready');
        signInButton.hidden = authenticated || state.status === 'checking' || state.status === 'signing-in' || state.status === 'signing-out'
            || !storageAvailable || (!isManagerHost && !allowedOrigins.has(location.origin));
        signInButton.textContent = isManagerHost ? 'Sign in to Manager' : 'Sign in with GitHub';
        signInButton.disabled = state.status === 'signing-in';
        signOutButton.hidden = !authenticated || isManagerHost;
        if (isManagerHost && authenticated) {
            signOutButton.hidden = false;
            signOutButton.textContent = 'Sign out of Manager';
        }
        messageNode.textContent = state.message;
        messageNode.hidden = !state.message;
        messageNode.dataset.error = String(state.error);
    }

    function clearStoredHandle() {
        profileToken = '';
        safeStorageRemove(TOKEN_KEY);
    }

    async function verifySiteHandle() {
        if (!checkStorage()) {
            setUnavailable('This browser is blocking tab storage. Enable session storage and reload to use profiles.');
            return;
        }
        if (!allowedOrigins.has(location.origin)) {
            setState({status:'guest',profile:null,managerAccess:null,message:'Sign in is available on the ABS site and supported local previews.'});
            return;
        }
        const token = safeStorageGet(TOKEN_KEY);
        if (!token) {
            profileToken = '';
            setState({status:'guest',profile:null,managerAccess:null,message:''});
            return;
        }
        if (!isPlausibleToken(token)) {
            clearStoredHandle();
            setState({status:'guest',profile:null,managerAccess:null,message:'Your profile session expired. Sign in again.'});
            return;
        }
        profileToken = token;
        setState({status:'checking',profile:null,managerAccess:null,message:'Verifying your profile…'});
        try {
            const payload = await requestProfile('/profile/me', token);
            const verified = parseProfileResponse(payload);
            setState({status:'signed-in',profile:verified.profile,managerAccess:verified.managerAccess,message:accessMessage(verified),error:false});
        } catch (error) {
            if (error?.status === 401 || error?.status === 403) {
                clearStoredHandle();
                setState({status:'guest',profile:null,managerAccess:null,message:'Your profile session expired. Sign in again.'});
            } else {
                setUnavailable('Could not verify your profile. Check your connection and retry.');
            }
        }
    }

    function accessMessage(verified) {
        if (verified.profile.role !== 'admin') return '';
        if (verified.managerAccess.status === 'restricted') return 'Admin account verified. Manager access is restricted.';
        if (verified.managerAccess.status === 'unavailable') return 'Admin account verified. Manager access is unavailable right now.';
        return '';
    }

    function isPlausibleToken(token) {
        return typeof token === 'string' && token.length >= 20 && token.length <= 2048 && /^[A-Za-z0-9._~-]+$/.test(token);
    }

    function randomToken(bytes = 32) {
        const values = new Uint8Array(bytes);
        crypto.getRandomValues(values);
        let binary = '';
        values.forEach(value => { binary += String.fromCharCode(value); });
        return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    }

    async function createChallenge(verifier) {
        const bytes = new TextEncoder().encode(verifier);
        const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
        let binary = '';
        digest.forEach(value => { binary += String.fromCharCode(value); });
        return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    }

    function safeReturnPath(value) {
        if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return null;
        try {
            const url = new URL(value, location.origin);
            if (url.origin !== location.origin || /\/profile-callback\.html$/i.test(url.pathname)) return null;
            if (location.origin === pagesOrigin && url.pathname !== siteBasePath.slice(0, -1)
                && !url.pathname.startsWith(siteBasePath)) return null;
            return `${url.pathname}${url.search}${url.hash}`;
        } catch { return null; }
    }

    function callbackKind() {
        if (location.origin === pagesOrigin) return 'project';
        return location.pathname.toLowerCase().startsWith(siteBasePath.toLowerCase()) ? 'project' : 'root';
    }

    async function signIn() {
        if (isManagerHost) {
            window.ManagerAuth?.startLogin?.();
            return;
        }
        if (!checkStorage()) {
            setUnavailable('This browser is blocking tab storage. Enable session storage and try again.');
            render();
            return;
        }
        if (!allowedOrigins.has(location.origin) || !profileWorkerOrigin || !crypto?.subtle) {
            setUnavailable('Profile sign-in is unavailable on this origin.');
            return;
        }
        const returnTo = safeReturnPath(`${location.pathname}${location.search}${location.hash}`);
        if (!returnTo) {
            setUnavailable('This page cannot be used as a profile return location.');
            return;
        }
        setState({status:'signing-in',profile:null,managerAccess:null,message:'Connecting to GitHub…'});
        try {
            const verifier = randomToken(32);
            const challenge = await createChallenge(verifier);
            const nonce = randomToken(32);
            const flow = {verifier,nonce,returnTo,createdAt:Date.now()};
            if (!safeStorageSet(FLOW_KEY, JSON.stringify(flow))) throw new Error('Could not save this tab’s secure sign-in state.');
            const params = new URLSearchParams({origin:location.origin,challenge,nonce,callback:callbackKind()});
            const start = new URL('/profile/start', profileWorkerOrigin);
            start.search = params.toString();
            location.assign(start.href);
        } catch {
            safeStorageRemove(FLOW_KEY);
            setState({status:'guest',profile:null,managerAccess:null,message:'Could not start sign-in. Enable secure browser storage and try again.',error:true});
        }
    }

    async function signOut() {
        if (isManagerHost) {
            if (!window.ManagerAuth?.logout) return;
            signOutButton.disabled = true;
            setState({status:'signing-out',profile:null,managerAccess:null,message:'Signing out of Manager…'});
            try {
                await window.ManagerAuth.logout();
                const session = await window.ManagerAuth.request('/api/session');
                const verified = managerProfileFromSession(session);
                setState({status:'signed-in',profile:verified,message:'Could not sign out of Manager. Try again.',error:true,managerAccess:{status:'ready'}});
            } catch (error) {
                if (error?.status === 401 || error?.status === 403) {
                    clearStoredHandle();
                    setState({status:'guest',profile:null,managerAccess:null,message:'Signed out of Manager.'});
                } else {
                    setUnavailable('Could not confirm sign-out. Reload Manager to check your session.');
                }
            } finally {
                if (signOutButton) signOutButton.disabled = false;
            }
            return;
        }
        if (!profileToken) { setState({status:'guest',profile:null,managerAccess:null,message:''}); return; }
        const token = profileToken;
        signOutButton.disabled = true;
        setState({status:'signing-out',profile:null,managerAccess:null,message:'Signing out…'});
        try {
            await requestProfile('/profile/logout', token, 'POST', {});
            clearStoredHandle();
            setState({status:'guest',profile:null,managerAccess:null,message:'Signed out.'});
        } catch (error) {
            if (error?.status === 401 || error?.status === 403) {
                clearStoredHandle();
                setState({status:'guest',profile:null,managerAccess:null,message:'Signed out.'});
            } else {
                try {
                    const payload=await requestProfile('/profile/me',token);
                    const verified=parseProfileResponse(payload);
                    setState({status:'signed-in',profile:verified.profile,managerAccess:verified.managerAccess,message:'Could not sign out. Check your connection and retry.',error:true});
                } catch (verifyError) {
                    if (verifyError?.status===401 || verifyError?.status===403) {
                        clearStoredHandle();
                        setState({status:'guest',profile:null,managerAccess:null,message:'Signed out.'});
                    } else setUnavailable('Could not confirm sign-out. Check your connection and reload.');
                }
            }
        } finally {
            if (signOutButton) signOutButton.disabled = false;
        }
    }

    function managerProfileFromSession(session) {
        const expiresAt=typeof session?.expiresAt==='number' && Number.isSafeInteger(session.expiresAt)
            ? session.expiresAt * 1000
            : typeof session?.expiresAt==='string' ? Date.parse(session.expiresAt) : NaN;
        if (!session || typeof session.login !== 'string' || !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(session.login)
            || !Number.isFinite(expiresAt) || expiresAt <= Date.now()
            || !session.profile || session.profile.role !== 'admin' || session.profile.login !== session.login
            || (session.profile.displayName !== null && (typeof session.profile.displayName !== 'string' || session.profile.displayName.length > 120))) {
            throw new Error('Manager returned invalid verified profile details.');
        }
        return {
            login:session.login,
            displayName:typeof session.profile.displayName === 'string' ? session.profile.displayName : null,
            avatarUrl:validatedAvatar(session.profile.avatarUrl ?? null),
            role:'admin'
        };
    }

    async function initializeManagerHost() {
        checkStorage();
        safeStorageRemove(TOKEN_KEY);
        profileToken = '';
        if (!window.ManagerAuth?.request) {
            setUnavailable('Manager sign-in is unavailable. Reload the Manager page to retry.');
            return;
        }
        if (managerInitPromise) return managerInitPromise;
        managerInitPromise = Promise.resolve(window.ManagerAuth.request('/api/session')).then(session => {
            const profile = managerProfileFromSession(session);
            setState({status:'signed-in',profile,managerAccess:{status:'ready'},message:''});
        }).catch(error => {
            if (error?.status === 401) setState({status:'guest',profile:null,managerAccess:null,message:'Sign in to Manager to view your verified profile.'});
            else if (error?.status === 403) setState({status:'guest',profile:null,managerAccess:null,message:'This account does not have Manager access.'});
            else setUnavailable('Could not verify your Manager session. Try reloading.');
        })
            .finally(() => { managerInitPromise = null; });
        return managerInitPromise;
    }

    function observeManagerSession() {
        const sessionBar = document.getElementById('card-admin-session');
        if (!sessionBar || managerObserver) return;
        managerObserver = new MutationObserver(() => {
            if (sessionBar.hidden) {
                safeStorageRemove(TOKEN_KEY);
                profileToken = '';
                setState({status:'guest',profile:null,managerAccess:null,message:'Signed out of Manager.'});
            } else if (state.status !== 'signed-in') {
                void initializeManagerHost();
            }
        });
        managerObserver.observe(sessionBar, {attributes:true,attributeFilter:['hidden']});
    }

    async function start() {
        if (!mount()) {
            const observer = new MutationObserver(() => {
                if (!mount()) return;
                observer.disconnect();
                startAfterMount();
            });
            observer.observe(document.documentElement, {childList:true,subtree:true});
            return;
        }
        startAfterMount();
    }

    function startAfterMount() {
        render();
        if (isManagerHost) {
            observeManagerSession();
            void initializeManagerHost();
        } else {
            void verifySiteHandle();
        }
    }

    window.absProfile = Object.freeze({getState:snapshot,signIn,signOut});
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { void start(); }, {once:true});
    else void start();
})();
