(() => {
    'use strict';

    const ROUTES = [
        { id: 'support-memory', href: 'support-memory.html', label: 'Support Memory', icon: '<path d="M12 21s-7-4.35-9.33-8.2C.35 9.05 2.2 5 6.2 5c2.3 0 3.9 1.3 5.8 3.5C13.9 6.3 15.5 5 17.8 5c4 0 5.85 4.05 3.53 7.8C19 16.65 12 21 12 21Z"/>' },
        { id: 'leader-compatibility', href: 'leader-compatibility.html', label: 'Leader Compatibility', icon: '<circle cx="12" cy="7" r="3"/><path d="M5 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2M4 8H2m20 0h-2M5 12l-2 1m18-1 2 1"/>' },
        { id: 'damage-received', href: 'damage-received.html', label: 'Damage Received', icon: '<path d="M12 3 5 6v5c0 4.7 2.8 8 7 10 4.2-2 7-5.3 7-10V6l-7-3Z"/><path d="M12 7v7m0 3h.01"/>' },
        { id: 'manager', href: 'manager.html', label: 'Manager', icon: '<circle cx="12" cy="12" r="8"/><path d="M12 8v8m-4-4h8"/>' }
    ];
    const ROUTE_ATTRIBUTE = 'data-abs-main-destination';
    const normalizePath = pathname => pathname.replace(/\/+$/, '').toLowerCase() || '/';
    const scriptUrl = document.currentScript?.src || new URL('js/other-nav.js', document.baseURI).href;

    function baseUrl() {
        const sharedBase = window.absNavigation?.getBaseUrl?.();
        if (sharedBase) return new URL(sharedBase);
        const config = window.MANAGER_AUTH_CONFIG || {};
        try {
            const managerOrigins = [config.workerOrigin, config.localWorkerOrigin].filter(value => typeof value === 'string').map(value => {
                try { return new URL(value).origin; } catch { return ''; }
            }).filter(Boolean);
            if (managerOrigins.includes(location.origin)) {
                const pages = new URL(config.pagesOrigin);
                if (pages.protocol === 'https:' && pages.pathname === '/') return new URL(config.siteBasePath || '/DokkanCustom/', pages.origin);
            }
        } catch {}
        return new URL('../', scriptUrl);
    }

    function makeDestination(route) {
        const link = document.createElement('a');
        link.id = `nav-link-${route.id}`;
        link.className = 'hud-nav-link sba-main-destination';
        link.dataset.absMainDestination = route.id;
        link.href = new URL(route.href, baseUrl()).href;
        link.setAttribute('aria-label', route.label);
        link.title = route.label;

        const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        icon.setAttribute('class', 'hud-nav-svg');
        icon.setAttribute('viewBox', '0 0 24 24');
        icon.setAttribute('fill', 'none');
        icon.setAttribute('stroke', 'currentColor');
        icon.setAttribute('stroke-width', '2');
        icon.setAttribute('stroke-linecap', 'round');
        icon.setAttribute('stroke-linejoin', 'round');
        icon.setAttribute('aria-hidden', 'true');
        icon.innerHTML = route.icon;

        const label = document.createElement('span');
        label.textContent = route.label;
        link.append(icon, label);
        return link;
    }

    function removeRetiredOther(group) {
        let changed = false;
        group.querySelectorAll(':scope > .sba-other-nav-button').forEach(button => {
            button.remove();
            changed = true;
        });
        const menu = document.getElementById('sba-other-destinations-menu');
        if (menu) {
            menu.remove();
            changed = true;
        }
        document.querySelectorAll('link[data-other-nav-styles]').forEach(link => {
            link.remove();
            changed = true;
        });
        document.body.classList.remove('sba-other-menu-open');
        return changed;
    }

    function syncCurrentDestination(group) {
        const currentPath = normalizePath(window.location.pathname);
        group.querySelectorAll(`:scope > [${ROUTE_ATTRIBUTE}]`).forEach(link => {
            const isCurrent = normalizePath(new URL(link.href, baseUrl()).pathname) === currentPath;
            link.classList.toggle('active', isCurrent);
            if (isCurrent) link.setAttribute('aria-current', 'page');
            else link.removeAttribute('aria-current');
        });
    }

    function managerIsAvailable() {
        const current = window.absProfile?.getState?.();
        return current?.status === 'signed-in'
            && current.profile?.role === 'admin'
            && current.managerAccess?.status === 'ready';
    }

    function installDirectDestinations() {
        const groups = Array.from(document.querySelectorAll('.hud-nav-group'))
            .filter(group => !group.classList.contains('editor-top-hud-group'));
        let changed = false;

        groups.forEach(group => {
            changed = removeRetiredOther(group) || changed;
            const settings = group.querySelector(':scope > .sba-side-settings-button, :scope > [aria-label="Settings"]');
            let anchor = settings || null;
            const routes = ROUTES.filter(route => route.id !== 'manager' || managerIsAvailable());
            group.querySelectorAll(`:scope > [${ROUTE_ATTRIBUTE}="manager"]`).forEach(link => {
                if (!managerIsAvailable()) {
                    link.remove();
                    changed = true;
                }
            });
            [...routes].reverse().forEach(route => {
                let link = group.querySelector(`:scope > [${ROUTE_ATTRIBUTE}="${route.id}"]`);
                if (!link) {
                    link = makeDestination(route);
                    changed = true;
                }
                link.href = new URL(route.href, baseUrl()).href;
                link.setAttribute('aria-label', route.label);
                link.title = route.label;
                const label = link.querySelector(':scope > span');
                if (label) label.textContent = route.label;
                if (link.parentElement !== group || link.nextElementSibling !== anchor) group.insertBefore(link, anchor);
                anchor = link;
            });
            syncCurrentDestination(group);
        });

        if (changed) window.absNavigation?.refresh();
    }

    function start() {
        installDirectDestinations();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
        start();
    }
    window.addEventListener('abs-profile-change', installDirectDestinations);
})();
