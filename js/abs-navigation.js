/* Shared ABS application shell. Existing destination controls stay live. */
(() => {
    'use strict';
    if (window.absNavigation) { window.absNavigation.refresh(); return; }
    const script = document.currentScript;
    const assetBase = new URL('../', script?.src || new URL('js/abs-navigation.js', document.baseURI));
    const managerConfig = window.MANAGER_AUTH_CONFIG || {};
    const managerWorkerOrigins = [managerConfig.workerOrigin, managerConfig.localWorkerOrigin].map(value => {
        try { return new URL(value).origin; } catch { return ''; }
    }).filter(Boolean);
    const pagesOrigin = (() => {
        try { return new URL(managerConfig.pagesOrigin).origin; } catch { return ''; }
    })();
    const base = managerWorkerOrigins.includes(location.origin) && pagesOrigin
        ? new URL(managerConfig.siteBasePath || '/DokkanCustom/', pagesOrigin)
        : assetBase;
    const mobile = window.matchMedia('(max-width: 900px)');
    const focusable = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
    let activeDrawer = null;
    let previousFocus = null;
    let restoring = false;
    let initialized = false;
    let activePopover = null;
    let popoverReturnFocus = null;
    let mainPinned = false;
    let contextPinned = false;
    let contextPointerInside = false;
    let contextFocusInside = false;
    let contextPanelRequest = false;
    let lastContextState = '';
    let pointerInside = false;
    let keyboardMode = false;
    let keyboardInside = false;
    let viewerPickerState = 'closed';
    let profileAssetsPromise = null;
    const colors = { cards: '45,169,211', viewer: '84,180,152', calculator: '204,169,53', editor: '162,101,218', news: '208,115,151', settings: '131,151,180' };
    const iconFiles = {
        cards: 'equ_icon_same_chara.png', viewer: 'equ_icon_specific_chara.png',
        calculator: 'sugoroku_jewel_small_0072.png', editor: 'support_memory_enh_lv_base.png',
        news: 'myp_icon_campaign.png', settings: 'equ_icon_category.png',
        support: '200254.png', leader: 'thumb_support_item_01910.png', damage: 'thumb_support_item_90001.png',
        manager: 'myp_dragon_radar.png'
    };
    const readPreference = (key) => { try { return localStorage.getItem(key) === 'true'; } catch { return false; } };
    const readOptionalPreference = (key) => { try { const value = localStorage.getItem(key); return value === null ? null : value === 'true'; } catch { return null; } };
    const writePreference = (key, value) => { try { localStorage.setItem(key, String(value)); } catch {} };
    const layoutChange = () => window.dispatchEvent(new CustomEvent('abs-shell-layout-change', { detail: { mobile: mobile.matches, drawer: activeDrawer?.id || null } }));

    function relatedContextPanelOpen() {
        // Floating editors do not own the action rail's expanded state.
        return Boolean(contextPanelRequest);
    }

    function syncContextRail() {
        const context = document.getElementById('abs-context-sidebar');
        if (!context) return;
        const root = document.documentElement;
        const panelOpen = relatedContextPanelOpen();
        const expanded = contextPinned || contextPointerInside || contextFocusInside || panelOpen || (mobile.matches && activeDrawer === context);
        root.dataset.absContextPinned = String(contextPinned);
        root.dataset.absContextPanelOpen = String(panelOpen);
        root.dataset.absContextExpanded = String(expanded);
        root.dataset.absContextCollapsed = String(!expanded);
        const button = context.querySelector('[data-abs-context-pin]');
        if (button) {
            const label = contextPinned ? 'Unpin editor actions' : 'Pin editor actions';
            button.setAttribute('aria-pressed', String(contextPinned));
            button.setAttribute('aria-label', label);
            button.title = label;
            const visibleLabel = button.querySelector('.abs-context-pin-label');
            if (visibleLabel) visibleLabel.textContent = label;
        }
        const state = `${contextPinned}:${panelOpen}:${expanded}`;
        if (state !== lastContextState) {
            lastContextState = state;
            layoutChange();
        }
    }

    function setContextPinned(pinned, { persist = true } = {}) {
        contextPinned = Boolean(pinned);
        if (persist) {
            writePreference('abs_context_pinned', contextPinned);
            // Keep the previous preference in sync for older shell consumers.
            writePreference('abs_context_collapsed', !contextPinned);
        }
        syncContextRail();
    }

    function setCollapsed(kind, collapsed) {
        if (kind === 'context') {
            setContextPinned(!collapsed);
            return;
        }
        const key = kind === 'main' ? 'absNavCollapsed' : 'absContextCollapsed';
        const changed = document.documentElement.dataset[key] !== String(collapsed);
        document.documentElement.dataset[key] = String(collapsed);
        const button = document.querySelector(kind === 'main' ? '[data-abs-nav-collapse]' : '[data-abs-context-collapse]');
        if (button) {
            button.setAttribute('aria-expanded', String(!collapsed));
            button.setAttribute('aria-label', `${mainPinned ? 'Unpin' : 'Pin'} navigation`);
            button.title = button.getAttribute('aria-label');
        }
        const slot = document.querySelector('.abs-sidebar-style-slot');
        if (slot && kind === 'main') slot.inert = collapsed && !mobile.matches;
        if (changed) layoutChange();
    }

    function syncMainExpansion() {
        const panelOpen = Boolean(activePopover) || Boolean(document.querySelector('#abs-profile-panel:not([hidden])'));
        document.documentElement.dataset.absNavPinned = String(mainPinned);
        document.querySelector('[data-abs-nav-pin]')?.setAttribute('aria-pressed', String(mainPinned));
        const label = document.querySelector('.abs-nav-pin-label');
        if (label) label.textContent = mainPinned ? 'Unpin navigation' : 'Pin navigation';
        setCollapsed('main', !(mobile.matches || mainPinned || pointerInside || keyboardInside || panelOpen || viewerPickerState !== 'closed'));
    }

    function setViewerPickerState(state) {
        viewerPickerState = state === 'open' || state === 'closing' ? state : 'closed';
        if (mobile.matches && activeDrawer?.id === 'abs-main-sidebar' && activeDrawer.classList.contains('abs-drawer-open')) {
            if (viewerPickerState === 'open') activeDrawer.removeAttribute('aria-modal');
            else activeDrawer.setAttribute('aria-modal', 'true');
        }
        const sidebar = document.getElementById('abs-main-sidebar');
        const stabilizeOverlayAnchor = viewerPickerState === 'open' && !mobile.matches && !mainPinned && sidebar;
        const previousTransition = stabilizeOverlayAnchor ? sidebar.style.getPropertyValue('transition') : '';
        const previousPriority = stabilizeOverlayAnchor ? sidebar.style.getPropertyPriority('transition') : '';
        if (stabilizeOverlayAnchor) sidebar.style.setProperty('transition','none','important');
        syncMainExpansion();
        if (stabilizeOverlayAnchor) {
            sidebar.getBoundingClientRect();
            if (previousTransition) sidebar.style.setProperty('transition',previousTransition,previousPriority);
            else sidebar.style.removeProperty('transition');
        }
    }

    function mountStyleControl(sidebar) {
        // Cards keeps its live layout choices in the page toolbar. Restore an
        // already-mounted group without replacing its nodes or handlers.
        const cardsControl = document.querySelector('.cards-layout-switcher');
        if (cardsControl?.closest('#abs-main-sidebar')) {
            const actions = document.querySelector('#hubCardsSection .cards-workspace-actions');
            if (actions) actions.insertBefore(cardsControl, actions.querySelector('.cards-reset-toolbar'));
        }
        const control = document.querySelector('#abs-style-dock .hud-theme-stack') || sidebar.querySelector('.abs-sidebar-style-slot > :not(.cards-layout-switcher)') || document.querySelector('#settingsDrawer .hud-theme-stack');
        if (!control) {
            const emptySlot = sidebar.querySelector('.abs-sidebar-style-slot');
            if (emptySlot) emptySlot.hidden = true;
            return;
        }
        let slot = document.getElementById('abs-style-dock');
        if (!slot) {
            slot = document.createElement('nav');
            slot.id = 'abs-style-dock';
            slot.setAttribute('aria-label', 'Page style');
            document.body.append(slot);
        }
        if (control.parentElement !== slot) slot.append(control);
        const oldSlot = sidebar.querySelector('.abs-sidebar-style-slot');
        if (oldSlot) oldSlot.hidden = true;
        slot.hidden = false;
    }

    function loadProfileAssets() {
        if (profileAssetsPromise) return profileAssetsPromise;
        const loadStyles = () => new Promise((resolve, reject) => {
            const href = new URL('css/abs-profile.css?v=20261018-profile-edit-v1', assetBase).href;
            let link = [...document.querySelectorAll('link[rel~="stylesheet"]')].find(item => {
                try { return new URL(item.href, document.baseURI).pathname.endsWith('/css/abs-profile.css'); }
                catch { return false; }
            });
            if (link?.dataset.absProfileLoaded === 'true') { resolve(); return; }
            if (!link) {
                link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = href;
                link.dataset.absProfileAsset = 'styles';
                document.head.append(link);
            }
            link.addEventListener('load', () => { link.dataset.absProfileLoaded = 'true'; resolve(); }, {once:true});
            link.addEventListener('error', () => reject(new Error('Profile styles could not be loaded.')), {once:true});
            if (link.sheet) { link.dataset.absProfileLoaded = 'true'; resolve(); }
        });
        const loadScript = (file, marker) => new Promise((resolve, reject) => {
            const existing = document.querySelector(`script[data-abs-profile-asset="${marker}"]`);
            if (existing?.dataset.loaded === 'true') { resolve(); return; }
            const scriptNode = existing || document.createElement('script');
            scriptNode.async = false;
            scriptNode.src = new URL(`js/${file}?v=20261018-profile-edit-v1`, assetBase).href;
            scriptNode.dataset.absProfileAsset = marker;
            scriptNode.addEventListener('load', () => { scriptNode.dataset.loaded = 'true'; resolve(); }, {once:true});
            scriptNode.addEventListener('error', () => reject(new Error(`Profile ${file} could not be loaded.`)), {once:true});
            if (!existing) document.head.append(scriptNode);
        });
        profileAssetsPromise = loadStyles()
            .then(() => loadScript('abs-profile-config.js', 'config'))
            .then(() => loadScript('abs-profile.js', 'module'))
            .catch(error => {
                profileAssetsPromise = null;
                window.dispatchEvent(new CustomEvent('abs-profile-change', {detail:{status:'unavailable',role:null,managerAccess:null,error:'Profile UI could not be loaded.'}}));
                console.warn('[ABS profile] UI assets unavailable.', error);
            });
        return profileAssetsPromise;
    }

    function visibleControls(root) {
        return [...root.querySelectorAll(focusable)].filter(node => node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden');
    }

    function closeDrawers({ restoreFocus = true } = {}) {
        const drawer = activeDrawer;
        if (!drawer) return;
        drawer.removeAttribute('role');
        drawer.removeAttribute('aria-modal');
        drawer.classList.remove('abs-drawer-open');
        if (mobile.matches) drawer.inert = true;
        document.getElementById('abs-shell-backdrop')?.setAttribute('hidden', '');
        document.querySelectorAll('[data-abs-drawer]').forEach(button => button.setAttribute('aria-expanded', 'false'));
        document.body.classList.remove('abs-shell-drawer-open');
        activeDrawer = null;
        if (restoreFocus && previousFocus?.isConnected) previousFocus.focus();
        previousFocus = null;
        layoutChange();
    }

    function openDrawer(drawer, trigger) {
        if (!drawer || !mobile.matches) return;
        if (activeDrawer === drawer) { closeDrawers(); return; }
        closeDrawers({ restoreFocus: false });
        previousFocus = trigger || document.activeElement;
        activeDrawer = drawer;
        drawer.inert = false;
        drawer.setAttribute('role', 'dialog');
        drawer.setAttribute('aria-modal', 'true');
        drawer.classList.add('abs-drawer-open');
        document.body.classList.add('abs-shell-drawer-open');
        document.getElementById('abs-shell-backdrop')?.removeAttribute('hidden');
        trigger?.setAttribute('aria-expanded', 'true');
        visibleControls(drawer)[0]?.focus();
        layoutChange();
    }

    function positionPopover(panel, trigger) {
        if (!panel || !trigger || panel.hidden) return;
        const pad = 12;
        const bounds = trigger.getBoundingClientRect();
        const viewportWidth = document.documentElement.clientWidth;
        const width = Math.min(panel.id === 'settingsDrawer' ? 420 : 280, viewportWidth - pad * 2);
        const height = Math.min(panel.scrollHeight || 400, window.innerHeight - pad * 2);
        let left = bounds.right + 12;
        if (mobile.matches || left + width > viewportWidth - pad) left = Math.max(pad, Math.min(bounds.left - width - 12, viewportWidth - width - pad));
        const top = Math.max(pad, Math.min(bounds.top, window.innerHeight - height - pad));
        const rules = {position:'fixed',left:`${Math.round(left)}px`,right:'auto',top:`${Math.round(top)}px`,bottom:'auto',width:`${Math.round(width)}px`,height:'auto','max-height':`${window.innerHeight - pad * 2}px`,'z-index':'1200'};
        for (const [name, value] of Object.entries(rules)) {
            if (panel.style.getPropertyValue(name) !== value || panel.style.getPropertyPriority(name) !== 'important') panel.style.setProperty(name, value, 'important');
        }
    }

    function syncSettingsFocus() {
        const settings = document.getElementById('settingsDrawer');
        const open = Boolean(settings?.classList.contains('open') || document.body.classList.contains('sba-side-settings-open'));
        if (open && activePopover !== settings) {
            activePopover = settings;
            popoverReturnFocus = document.getElementById('sba-side-settings-button') || document.querySelector('#abs-main-sidebar [aria-label="Settings"]');
            activeDrawer?.removeAttribute('aria-modal');
            settings.setAttribute('role', 'dialog');
            settings.setAttribute('aria-modal', 'true');
            const enterFocus = () => {
                if (activePopover !== settings || settings.contains(document.activeElement)) return;
                if (getComputedStyle(settings).visibility === 'hidden') { requestAnimationFrame(enterFocus); return; }
                settings.tabIndex = -1;
                (visibleControls(settings)[0] || settings).focus();
            };
            enterFocus();
        } else if (!open && activePopover) {
            const trigger = popoverReturnFocus;
            activePopover = null;
            popoverReturnFocus = null;
            if (activeDrawer) activeDrawer.setAttribute('aria-modal', 'true');
            if (trigger?.isConnected && getComputedStyle(trigger).visibility !== 'hidden') trigger.focus();
        }
        syncMainExpansion();
    }

    function positionOpenPanels() {
        const settings = document.getElementById('settingsDrawer');
        if (settings?.classList.contains('open') || document.body.classList.contains('sba-side-settings-open')) positionPopover(settings, document.getElementById('sba-side-settings-button') || document.querySelector('#abs-main-sidebar [aria-label="Settings"]'));
        syncSettingsFocus();
        syncMainExpansion();
        syncContextRail();
    }

    function decorateControls(group) {
        if (!group) return;
        group.querySelectorAll('.hud-nav-link').forEach(control => {
            const text = control.querySelector('span')?.textContent.trim() || control.getAttribute('aria-label') || control.title;
            if (!control.title) control.title = text;
            const name = text.toLowerCase().split(' ')[0];
            control.style.setProperty('--abs-icon-rgb', colors[name] || '147,151,160');
            const iconFile = iconFiles[(control.getAttribute('aria-label') || text).toLowerCase().split(' ')[0]];
            if (iconFile && !control.dataset.absIconMounted && !control.closest('#abs-context-sidebar')) {
                control.dataset.absIconMounted = 'true';
                const original = control.querySelector('svg');
                const picture = document.createElement('img');
                picture.className = 'abs-nav-icon';
                picture.setAttribute('aria-hidden', 'true');
                picture.src = new URL(`assets/navigation/sidebar/${iconFile}`, assetBase).href;
                picture.alt = '';
                picture.decoding = 'async';
                picture.addEventListener('error', () => {
                    control.dataset.absIconFallback = 'true';
                    if (original) picture.replaceWith(original);
                    else picture.remove();
                }, {once:true});
                if (original) original.replaceWith(picture);
                else control.prepend(picture);
            }
            const label = control.querySelector(':scope > span');
            if (label && !label.classList.contains('abs-nav-label')) label.classList.add('abs-nav-label');
            control.querySelector('svg')?.setAttribute('aria-hidden', 'true');
            if (!control.closest('#abs-context-sidebar')) {
                if (control.classList.contains('active') && !control.hasAttribute('aria-haspopup') && !control.classList.contains('sba-side-settings-button')) control.setAttribute('aria-current', 'page');
                else control.removeAttribute('aria-current');
            }
        });
    }

    function refresh() {
        const sidebar = document.getElementById('abs-main-sidebar');
        const context = document.getElementById('abs-context-sidebar');
        if (!sidebar) return;
        document.body.classList.add('abs-shell');
        document.body.classList.toggle('abs-context-page', Boolean(context));
        syncContextRail();
        sidebar.setAttribute('data-abs-selector-anchor', '');
        mountStyleControl(sidebar);
        loadProfileAssets();
        decorateControls(sidebar.querySelector('.hud-nav-group'));
        decorateControls(context?.querySelector('.hud-nav-group'));
        const logo = sidebar.querySelector('.abs-sidebar-brand');
        if (logo) {
            logo.href = new URL('index.html', base).href;
            if (!new URLSearchParams(location.search).get('view') && document.getElementById('hubHomeSection')) logo.setAttribute('aria-current', 'page');
            else logo.removeAttribute('aria-current');
        }
        document.querySelectorAll('.abs-mobile-brand,.sba-settings-brand .nav-center-link').forEach(link => { link.href = new URL('index.html', base).href; link.setAttribute('aria-label', 'ABS — Home'); });
        const path = window.location.pathname.toLowerCase();
        const hub = path.endsWith('/index.html') || path === base.pathname.toLowerCase();
        sidebar.querySelectorAll('a.hud-nav-link').forEach(link => {
            const raw = link.getAttribute('href');
            if (raw && !/^(?:https?:|#|javascript:)/i.test(raw)) link.href = new URL(raw, base).href;
        });
        if (hub && logo && !logo.dataset.absHomeBound) {
            logo.dataset.absHomeBound = 'true';
            logo.addEventListener('click', event => {
                if (event.defaultPrevented) { queueMicrotask(refresh); return; }
                if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || typeof window.switchHubView !== 'function') return;
                event.preventDefault();
                window.switchHubView('home');
                closeDrawers({ restoreFocus: false });
                refresh();
            });
        }
        if (!mobile.matches) { sidebar.inert = false; if (context) context.inert = false; }
        else {
            sidebar.inert = activeDrawer !== sidebar;
            if (context) context.inert = activeDrawer !== context;
        }
        positionOpenPanels();
    }

    function initialize() {
        const sidebar = document.getElementById('abs-main-sidebar');
        if (!sidebar || initialized) return; initialized = true;
        mainPinned = readPreference('abs_navigation_pinned');
        // A new context pin is opt-in. The older collapsed preference remains
        // mirrored after the first explicit pin/unpin action.
        contextPinned = readOptionalPreference('abs_context_pinned') === true;
        refresh();
        const pin = document.querySelector('[data-abs-nav-collapse]');
        if (pin) {
            const footer = document.createElement('div');
            footer.className = 'abs-sidebar-footer';
            pin.dataset.absNavPin = '';
            const label = document.createElement('span');
            label.className = 'abs-nav-pin-label';
            label.textContent = 'Pin navigation';
            pin.append(label);
            footer.append(pin);
            sidebar.append(footer);
            pin.addEventListener('click', () => {
                if (mobile.matches) return;
                mainPinned = !mainPinned;
                writePreference('abs_navigation_pinned', mainPinned);
                label.textContent = mainPinned ? 'Unpin navigation' : 'Pin navigation';
                syncMainExpansion();
            });
        }
        syncMainExpansion();
        sidebar.addEventListener('pointerenter', () => { pointerInside = true; syncMainExpansion(); });
        sidebar.addEventListener('pointerleave', () => { pointerInside = false; syncMainExpansion(); });
        window.addEventListener('abs-profile-panel-change', syncMainExpansion);
        sidebar.addEventListener('transitionend', event => {
            if (event.target === sidebar && event.propertyName === 'width') positionOpenPanels();
        });
        document.addEventListener('pointerdown', () => { keyboardMode = false; keyboardInside = false; syncMainExpansion(); }, true);
        document.addEventListener('keydown', event => { if (event.key === 'Tab' || event.key.startsWith('Arrow')) keyboardMode = true; }, true);
        document.addEventListener('focusin', event => {
            keyboardInside = keyboardMode && sidebar.contains(event.target);
            syncMainExpansion();
        });
        document.addEventListener('focusout', () => queueMicrotask(() => {
            keyboardInside = keyboardMode && sidebar.contains(document.activeElement);
            syncMainExpansion();
        }));
        document.querySelector('[data-abs-context-collapse]')?.addEventListener('click', () => {
            if (mobile.matches) closeDrawers();
        });
        document.querySelector('[data-abs-context-pin]')?.addEventListener('click', () => setContextPinned(!contextPinned));
        const context = document.getElementById('abs-context-sidebar');
        if (context) {
            context.addEventListener('pointerenter', () => { contextPointerInside = true; syncContextRail(); });
            context.addEventListener('pointerleave', () => { contextPointerInside = false; syncContextRail(); });
            context.addEventListener('focusin', () => { contextFocusInside = true; syncContextRail(); });
            context.addEventListener('focusout', () => queueMicrotask(() => {
                contextFocusInside = context.contains(document.activeElement);
                syncContextRail();
            }));
            context.addEventListener('transitionend', event => {
                if (event.target === context && event.propertyName === 'width') positionOpenPanels();
            });
        }
        document.querySelectorAll('[data-abs-drawer]').forEach(button => button.addEventListener('click', () => openDrawer(document.getElementById(button.dataset.absDrawer), button)));
        document.getElementById('abs-shell-backdrop')?.addEventListener('click', () => closeDrawers());
        document.addEventListener('keydown', event => {
            if (event.defaultPrevented) return;
            if (viewerPickerState === 'closing' && mobile.matches && event.key === 'Escape') { event.preventDefault(); return; }
            const modal = event.target.closest?.('[role="dialog"][aria-modal="true"]');
            if (modal && modal !== activeDrawer && modal !== activePopover) return;
            if (event.key === 'Escape' && activePopover) {
                event.preventDefault();
                event.stopImmediatePropagation();
                const settings = activePopover;
                const open = settings.classList.contains('open') || document.body.classList.contains('sba-side-settings-open');
                if (open) popoverReturnFocus?.click();
                syncSettingsFocus();
                return;
            }
            const root = activePopover || activeDrawer;
            if (!root) return;
            if (event.key === 'Escape') { event.preventDefault(); closeDrawers(); return; }
            if (event.key !== 'Tab') return;
            const controls = visibleControls(root);
            const first = controls[0], last = controls.at(-1);
            if (event.shiftKey && (document.activeElement === root || document.activeElement === first || !root.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
            else if (!event.shiftKey && (document.activeElement === root || document.activeElement === last || !root.contains(document.activeElement))) { event.preventDefault(); first?.focus(); }
        }, true);
        sidebar.addEventListener('click', event => {
            const destination = event.target.closest('.hud-nav-link');
            if (destination && !destination.hasAttribute('aria-haspopup') && !destination.classList.contains('sba-side-settings-button')) {
                if (mobile.matches) closeDrawers({ restoreFocus: false });
                queueMicrotask(refresh);
            }
            queueMicrotask(positionOpenPanels);
        });
        const tooltip = document.createElement('div');
        tooltip.id = 'abs-navigation-tooltip';
        tooltip.setAttribute('role', 'tooltip');
        tooltip.hidden = true;
        document.body.append(tooltip);
        let tooltipTrigger = null;
        const hideTooltip = () => {
            tooltip.hidden = true;
            tooltipTrigger?.removeAttribute('aria-describedby');
            tooltipTrigger = null;
        };
        const showTooltip = control => {
            const contextControl = Boolean(control.closest('#abs-context-sidebar'));
            const collapsed = document.documentElement.dataset[contextControl ? 'absContextCollapsed' : 'absNavCollapsed'] === 'true';
            if (!collapsed || mobile.matches) { hideTooltip(); return; }
            hideTooltip();
            tooltipTrigger = control;
            tooltip.textContent = control.getAttribute('aria-label') || control.querySelector('span')?.textContent.trim() || control.title;
            control.setAttribute('aria-describedby', tooltip.id);
            tooltip.hidden = false;
            const bounds = control.getBoundingClientRect();
            const width = tooltip.getBoundingClientRect().width;
            tooltip.style.left = `${Math.max(8, Math.min(contextControl ? bounds.left - width - 12 : bounds.right + 12, innerWidth - width - 8))}px`;
            tooltip.style.top = `${Math.max(8, Math.min(bounds.top + bounds.height / 2 - tooltip.offsetHeight / 2, innerHeight - tooltip.offsetHeight - 8))}px`;
        };
        for (const rail of [sidebar, document.getElementById('abs-context-sidebar')].filter(Boolean)) {
            rail.addEventListener('pointerover', event => { const control = event.target.closest('.hud-nav-link'); if (control && control !== tooltipTrigger) showTooltip(control); });
            rail.addEventListener('pointerleave', hideTooltip);
            rail.addEventListener('focusin', event => { const control = event.target.closest('.hud-nav-link'); if (control) showTooltip(control); });
            rail.addEventListener('focusout', hideTooltip);
            rail.addEventListener('click', hideTooltip);
        }
        window.addEventListener('abs-shell-layout-change', hideTooltip);
        const panels = new MutationObserver(() => { if (!restoring) { restoring = true; positionOpenPanels(); restoring = false; } });
        panels.observe(document.body, {attributes:true,attributeFilter:['class']});
        const styles = new MutationObserver(() => mountStyleControl(sidebar));
        styles.observe(document.body, {attributes:true,attributeFilter:['class']});
        for (const id of ['settingsDrawer']) {
            const panel = document.getElementById(id);
            if (panel) panels.observe(panel, {attributes:true,attributeFilter:['class','hidden','style']});
        }
        const observedContextPanels = new WeakSet();
        const contextPanelObserver = new MutationObserver(() => syncContextRail());
        const observeContextPanels = () => {
            for (const id of ['context-gui', 'editor-history-dialog']) {
                const panel = document.getElementById(id);
                if (!panel || observedContextPanels.has(panel)) continue;
                observedContextPanels.add(panel);
                contextPanelObserver.observe(panel, {attributes:true,attributeFilter:['class','hidden','open','style']});
            }
        };
        observeContextPanels();
        const contextPanelMountObserver = new MutationObserver(records => {
            const addedContextPanel = records.some(record => [...record.addedNodes].some(node =>
                node.nodeType === Node.ELEMENT_NODE &&
                (node.matches?.('#context-gui, #editor-history-dialog') || node.querySelector?.('#context-gui, #editor-history-dialog'))
            ));
            if (!addedContextPanel) return;
            observeContextPanels();
            syncContextRail();
        });
        contextPanelMountObserver.observe(document.body, {childList:true});
        const controls = new MutationObserver(() => {
            decorateControls(sidebar.querySelector('.hud-nav-group'));
        });
        controls.observe(sidebar.querySelector('.hud-nav-group'), {childList:true,subtree:true,attributes:true,attributeFilter:['class']});
        const resized = () => { pointerInside = false; keyboardInside = false; closeDrawers(); refresh(); syncMainExpansion(); layoutChange(); };
        mobile.addEventListener('change', resized);
        window.addEventListener('resize', positionOpenPanels, {passive:true});
        window.addEventListener('abs-shell-layout-change', positionOpenPanels);
        window.addEventListener('popstate', refresh);
        window.absShellReady = true;
        window.dispatchEvent(new CustomEvent('abs-shell-ready'));
    }
    window.absNavigation = { refresh, closeDrawers, setContextOpen(open) { const drawer = document.getElementById('abs-context-sidebar'); if (mobile.matches) { if (open) openDrawer(drawer, document.querySelector('[data-abs-drawer="abs-context-sidebar"]')); else closeDrawers(); } else { contextPanelRequest = Boolean(open); syncContextRail(); } }, setViewerPickerState, getBaseUrl: () => base.href, positionPopover };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, {once:true});
    else initialize();
    if (!document.getElementById('abs-main-sidebar')) {
        const lateMount = new MutationObserver(() => { if (document.getElementById('abs-main-sidebar')) { lateMount.disconnect(); initialize(); } });
        lateMount.observe(document.documentElement, {childList:true,subtree:true});
    }
})();
