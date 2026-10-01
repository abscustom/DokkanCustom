(() => {
    'use strict';

    const MENU_ID = 'sba-other-destinations-menu';
    const ROUTES = [
        { href: 'leader-compatibility.html', label: 'Leader Compatibility' },
        { href: 'support-memory.html', label: 'Support Memory' }
    ];

    const normalizePath = (pathname) => pathname.replace(/\/+$/, '').toLowerCase() || '/';

    function ensureStylesheet() {
        if (document.querySelector('link[data-other-nav-styles]')) return;
        const currentScript = document.currentScript;
        const scriptUrl = currentScript?.src || new URL('js/other-nav.js', document.baseURI).href;
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = new URL('../css/other-nav.css?v=20260929-other-menu-v2', scriptUrl).href;
        link.dataset.otherNavStyles = 'true';
        document.head.appendChild(link);
    }

    function createMenu() {
        let menu = document.getElementById(MENU_ID);
        if (menu) return menu;

        menu = document.createElement('div');
        menu.id = MENU_ID;
        menu.className = 'sba-other-destinations-menu';
        menu.setAttribute('role', 'menu');
        menu.setAttribute('aria-label', 'Other destinations');
        menu.hidden = true;

        ROUTES.forEach(({ href, label }) => {
            const link = document.createElement('a');
            link.className = 'sba-other-destination';
            link.href = new URL(href, document.baseURI).href;
            link.setAttribute('role', 'menuitem');
            link.textContent = label;
            menu.appendChild(link);
        });

        // The menu is portaled to the body so nav overflow and narrow-screen
        // horizontal scrolling cannot clip it.
        menu.addEventListener('pointermove', (event) => {
            event.stopPropagation();
            window.revealToolSbaNav?.();
        });
        document.body.appendChild(menu);
        return menu;
    }

    function setCurrentDestination(menu, buttons) {
        const currentPath = normalizePath(window.location.pathname);
        let hasActiveDestination = false;

        menu.querySelectorAll('.sba-other-destination').forEach((link) => {
            const isCurrent = normalizePath(new URL(link.href, document.baseURI).pathname) === currentPath;
            if (isCurrent) {
                link.setAttribute('aria-current', 'page');
                link.classList.add('is-current');
                hasActiveDestination = true;
            } else {
                link.removeAttribute('aria-current');
                link.classList.remove('is-current');
            }
        });

        buttons.forEach((button) => button.classList.toggle('active', hasActiveDestination));
    }

    function positionMenu(menu, button) {
        const bounds = button.getBoundingClientRect();
        const viewportPadding = 8;
        const viewportWidth = document.documentElement.clientWidth;
        const viewportHeight = window.innerHeight;
        const menuWidth = Math.min(280, Math.max(220, viewportWidth - viewportPadding * 2));
        menu.style.width = `${menuWidth}px`;
        menu.style.maxHeight = `${Math.max(96, viewportHeight - viewportPadding * 2)}px`;

        const menuHeight = menu.getBoundingClientRect().height;
        const centeredLeft = bounds.left + (bounds.width / 2) - (menuWidth / 2);
        const left = Math.max(viewportPadding, Math.min(centeredLeft, viewportWidth - menuWidth - viewportPadding));
        const aboveTop = bounds.top - menuHeight - 10;
        const top = Math.max(viewportPadding, aboveTop);

        menu.style.left = `${left}px`;
        menu.style.top = `${top}px`;
    }

    function installOtherMenus() {
        ensureStylesheet();

        const navGroups = Array.from(document.querySelectorAll('.hud-nav-group'))
            .filter((group) => !group.classList.contains('editor-top-hud-group'));
        if (!navGroups.length) return;

        const menu = createMenu();
        const buttons = [];

        const closeMenu = ({ restoreFocus = false } = {}) => {
            if (menu.hidden) return;
            const previousButton = menu.__activeTrigger;
            menu.hidden = true;
            menu.__activeTrigger = null;
            previousButton?.setAttribute('aria-expanded', 'false');
            document.body.classList.remove('sba-other-menu-open');
            if (restoreFocus) previousButton?.focus();
        };

        const openMenu = (button, focusLast = false) => {
            if (menu.__activeTrigger && menu.__activeTrigger !== button) {
                menu.__activeTrigger.setAttribute('aria-expanded', 'false');
            }
            menu.__activeTrigger = button;
            button.setAttribute('aria-expanded', 'true');
            menu.hidden = false;
            document.body.classList.add('sba-other-menu-open');
            positionMenu(menu, button);
            if (focusLast || button.dataset.focusMenu === 'last') {
                menu.querySelector('.sba-other-destination:last-child')?.focus();
            } else if (button.dataset.focusMenu === 'first') {
                menu.querySelector('.sba-other-destination:first-child')?.focus();
            }
            button.dataset.focusMenu = '';
        };

        navGroups.forEach((group) => {
            let button = group.querySelector(':scope > .sba-other-nav-button');
            if (!button) {
                button = document.createElement('button');
                button.type = 'button';
                button.className = 'hud-nav-link sba-other-nav-button';
                button.setAttribute('aria-label', 'Other destinations');
                button.setAttribute('aria-haspopup', 'menu');
                button.setAttribute('aria-controls', MENU_ID);
                button.setAttribute('aria-expanded', 'false');
                button.title = 'Other destinations';

                const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                icon.setAttribute('class', 'hud-nav-svg');
                icon.setAttribute('viewBox', '0 0 24 24');
                icon.setAttribute('fill', 'none');
                icon.setAttribute('aria-hidden', 'true');
                icon.innerHTML = '<circle cx="5" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="19" cy="12" r="1.5" fill="currentColor"/>';
                button.append(icon);

                const label = document.createElement('span');
                label.textContent = 'Other';
                button.append(label);

                const settings = group.querySelector(':scope > .sba-side-settings-button, :scope > [aria-label="Settings"]');
                group.insertBefore(button, settings || null);
            }

            if (!button.dataset.otherNavBound) {
                button.dataset.otherNavBound = 'true';
                button.addEventListener('click', () => {
                    if (!menu.hidden && menu.__activeTrigger === button) closeMenu();
                    else openMenu(button);
                });
                button.addEventListener('keydown', (event) => {
                    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                        event.preventDefault();
                        button.dataset.focusMenu = event.key === 'ArrowUp' ? 'last' : 'first';
                        openMenu(button, event.key === 'ArrowUp');
                    }
                });
                buttons.push(button);
            } else {
                buttons.push(button);
            }
        });

        setCurrentDestination(menu, buttons);

        if (!menu.dataset.otherNavEventsBound) {
            menu.dataset.otherNavEventsBound = 'true';
            document.addEventListener('pointerdown', (event) => {
                const activeButton = menu.__activeTrigger;
                if (!menu.hidden && !menu.contains(event.target) && !activeButton?.contains(event.target)) {
                    closeMenu();
                }
            }, true);

            document.addEventListener('focusin', (event) => {
                const activeButton = menu.__activeTrigger;
                if (!menu.hidden && !menu.contains(event.target) && !activeButton?.contains(event.target)) {
                    closeMenu();
                }
            });

            document.addEventListener('keydown', (event) => {
                if (menu.hidden) return;
                const items = Array.from(menu.querySelectorAll('.sba-other-destination'));
                const index = items.indexOf(document.activeElement);

                // The trigger handles the key that opens the menu. Do not also
                // advance from the document handler during that same event.
                if (event.target === menu.__activeTrigger && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) return;

                if (event.key === 'Escape') {
                    event.preventDefault();
                    closeMenu({ restoreFocus: true });
                } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                    event.preventDefault();
                    const delta = event.key === 'ArrowDown' ? 1 : -1;
                    const next = index < 0 ? (delta > 0 ? 0 : items.length - 1) : (index + delta + items.length) % items.length;
                    items[next]?.focus();
                } else if (event.key === 'Home') {
                    event.preventDefault();
                    items[0]?.focus();
                } else if (event.key === 'End') {
                    event.preventDefault();
                    items.at(-1)?.focus();
                }
            });

            window.addEventListener('resize', () => {
                if (!menu.hidden && menu.__activeTrigger) positionMenu(menu, menu.__activeTrigger);
            }, { passive: true });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', installOtherMenus, { once: true });
    } else {
        installOtherMenus();
    }
})();
