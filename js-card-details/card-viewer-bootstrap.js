/*
 * Published card viewer bootstrap.
 *
 * The editor has a larger theme controller, but the published viewer only
 * needs presentation classes, the shared bottom site navigation, and a small
 * viewer-safe settings popover. Keep this file independent from editor
 * controls, import/export actions, and editor cache state.
 */
(() => {
    'use strict';

    const VIEWER_THEME_KEY = 'card_viewer_theme';
    const BACKGROUND_MODE_KEY = 'abs_clean_bg_mode';
    const CLEAN_THEME = 'sba';
    const LEGACY_PRESENTATION_CLASSES = ['theme-abs-style', 'theme-dokkaninfo', 'theme-placeholder', 'theme-abs-clean'];
    const ALL_VIEWER_THEME_CLASSES = ['theme-sba', ...LEGACY_PRESENTATION_CLASSES];
    // Published cards expose only the two viewer presentations. Dokkan Info
    // remains an editor concern and old stored values fall back to clean.
    const SUPPORTED_THEMES = new Set(['abs-style', CLEAN_THEME]);
    let hideTimer = null;
    let settingsReturnFocus = null;

    function isViewerReady() {
        return Boolean(document.body?.classList.contains('card-viewer-page'));
    }

    function readStoredValue(key, fallback = '') {
        try {
            return localStorage.getItem(key) || fallback;
        } catch (error) {
            return fallback;
        }
    }

    function writeStoredValue(key, value) {
        try {
            localStorage.setItem(key, value);
        } catch (error) {
            // Storage can be unavailable in private or embedded contexts. The
            // viewer remains fully usable for the current page in that case.
        }
    }

    function normalizeViewerTheme(themeName) {
        const value = String(themeName || '').trim().toLowerCase();
        if (value === 'abs.clean' || value === 'abs-clean') return CLEAN_THEME;
        return SUPPORTED_THEMES.has(value) ? value : CLEAN_THEME;
    }

    function updateViewerThemeButtons(themeName) {
        const activeTheme = normalizeViewerTheme(themeName);
        document.querySelectorAll('[data-viewer-theme]').forEach((button) => {
            const isActive = normalizeViewerTheme(button.dataset.viewerTheme) === activeTheme;
            button.classList.toggle('active', isActive);
            button.setAttribute('aria-pressed', String(isActive));
        });
    }

    function applyViewerThemeClasses(themeName) {
        const theme = normalizeViewerTheme(themeName);
        const body = document.body;
        const app = document.getElementById('app');

        if (body) {
            // Keep the SBA shell on the body so the global bottom HUD stays the
            // same even when a viewer presentation option is selected.
            body.classList.remove(...LEGACY_PRESENTATION_CLASSES);
            body.classList.add('theme-sba');
        }

        if (app) {
            app.classList.remove(...ALL_VIEWER_THEME_CLASSES);
            if (theme === CLEAN_THEME) {
                app.classList.add('theme-sba', 'theme-abs-clean');
            } else {
                app.classList.add('theme-abs-style');
            }
        }

        if (body) {
            if (theme === CLEAN_THEME) body.classList.add('theme-abs-clean');
            else body.classList.add('theme-abs-style');
            body.dataset.cardViewerTheme = theme;
        }
        document.documentElement.dataset.cardViewerTheme = theme;

        // Keep clean-only mode state out of the legacy presentation. When a
        // visitor switches back, restore the persisted clean mode so the next
        // clean render is deterministic without leaking clean selectors into
        // abs.style.
        if (theme === CLEAN_THEME) {
            setAbsCleanBackgroundMode('dark');
        } else {
            [document.documentElement, body].forEach((target) => {
                if (!target) return;
                target.classList.remove('theme-abs-clean-dark');
                delete target.dataset.absCleanMode;
            });
            document.documentElement.style.colorScheme = '';
        }
        return theme;
    }

    function refreshViewerAfterThemeChange() {
        if (typeof window.refreshAbsCardViewer === 'function') {
            window.refreshAbsCardViewer();
            return;
        }

        // The core script is intentionally loaded after this bootstrap. This
        // fallback keeps placement helpers in sync if a theme is changed by a
        // host integration during that short loading window.
        window.syncAbsCleanLeaderPlacement?.();
        window.syncAbsCleanCardLinkCategoryPlacement?.();
        window.syncAbsCleanRightRail?.();
        window.syncAbsCleanSuperAttackPlacement?.();
        window.syncAbsCleanAwakeningFormsPlacement?.();
        window.syncAbsCleanAbilityDockPlacement?.();
    }

    function applyViewerTheme(themeName, { persist = true, refresh = true } = {}) {
        const theme = applyViewerThemeClasses(themeName);
        if (persist) {
            writeStoredValue(VIEWER_THEME_KEY, theme);
            // Keep the legacy published-card preference synchronized so the
            // editor, exported cards, and viewer all reopen on the same style.
            writeStoredValue('dokkan_published_card_theme', theme === CLEAN_THEME ? 'sba' : theme);
        }
        updateViewerThemeButtons(theme);
        window.cardViewerTheme = theme;
        window.updateSiteFavicon?.(theme);
        window.dispatchEvent(new CustomEvent('card-viewer-theme-change', { detail: { theme } }));
        if (theme === CLEAN_THEME) window.dispatchEvent(new Event('abs-clean-theme-visible'));

        if (refresh) {
            window.requestAnimationFrame(() => refreshViewerAfterThemeChange());
        }
        return theme;
    }

    function enableAbsCleanViewer() {
        applyViewerThemeClasses(CLEAN_THEME);
        updateViewerThemeButtons(CLEAN_THEME);
    }

    function initializeViewerTheme() {
        // Keep the published viewer in sync with the theme preference used by
        // the editor/exported card. Older cards do not have card_viewer_theme
        // yet, so falling back to the published/selected theme prevents an
        // ABS.STYLE card from silently reopening as ABS.CLEAN.
        const savedTheme = normalizeViewerTheme(
            readStoredValue(
                VIEWER_THEME_KEY,
                readStoredValue(
                    'dokkan_published_card_theme',
                    readStoredValue('dokkan_selected_theme', CLEAN_THEME)
                )
            )
        );
        applyViewerTheme(savedTheme, { persist: false, refresh: false });
    }

    function setAbsCleanBackgroundMode(mode) {
        // abs.clean uses one dark presentation in the published viewer.
        // Retain this function for integrations that still call it directly.
        const finalMode = 'dark';
        writeStoredValue(BACKGROUND_MODE_KEY, finalMode);

        [document.documentElement, document.body].forEach((target) => {
            if (!target) return;
            target.classList.toggle('theme-abs-clean-dark', finalMode === 'dark');
            target.dataset.absCleanMode = finalMode;
        });
        document.documentElement.style.colorScheme = finalMode;

        const lightButton = document.getElementById('abs-clean-mode-light');
        const darkButton = document.getElementById('abs-clean-mode-dark');
        if (lightButton) {
            lightButton.classList.toggle('active', finalMode === 'light');
            lightButton.setAttribute('aria-pressed', String(finalMode === 'light'));
        }
        if (darkButton) {
            darkButton.classList.toggle('active', finalMode === 'dark');
            darkButton.setAttribute('aria-pressed', String(finalMode === 'dark'));
        }
        return finalMode;
    }

    function initAbsCleanBackgroundMode() {
        setAbsCleanBackgroundMode('dark');
    }

    function isSettingsOpen() {
        const drawer = document.getElementById('settingsDrawer');
        return Boolean(drawer?.classList.contains('open') || document.body?.classList.contains('sba-side-settings-open'));
    }

    function setCardViewerSettingsOpen(shouldOpen) {
        const drawer = document.getElementById('settingsDrawer');
        const overlay = document.getElementById('settingsOverlay');
        const button = document.getElementById('sba-side-settings-button');
        if (!drawer) return false;

        const open = Boolean(shouldOpen);
        if (open) {
            const activeElement = document.activeElement;
            settingsReturnFocus = activeElement instanceof HTMLElement ? activeElement : null;
        }

        drawer.classList.toggle('open', open);
        overlay?.classList.toggle('open', open);
        overlay?.setAttribute('aria-hidden', String(!open));
        document.body?.classList.toggle('sba-side-settings-open', open);
        drawer.setAttribute('aria-hidden', String(!open));
        button?.setAttribute('aria-expanded', String(open));
        button?.classList.toggle('active', open);

        if (open) {
            revealViewerNav();
            window.setTimeout(() => {
                drawer.querySelector('.sba-settings-close-btn')?.focus({ preventScroll: true });
            }, 0);
        } else {
            const focusTarget = settingsReturnFocus;
            settingsReturnFocus = null;
            if (focusTarget && document.contains(focusTarget)) {
                focusTarget.focus({ preventScroll: true });
            } else {
                scheduleViewerNavHide();
            }
        }
        return open;
    }

    function toggleCardViewerSettings(force) {
        const nextState = typeof force === 'boolean' ? force : !isSettingsOpen();
        return setCardViewerSettingsOpen(nextState);
    }

    function revealViewerNav() {
        if (!isViewerReady()) return;
        if (hideTimer) {
            clearTimeout(hideTimer);
            hideTimer = null;
        }
        document.body.classList.add('sba-bottom-nav-visible');
    }

    function scheduleViewerNavHide(delay = 800) {
        if (!isViewerReady() || isSettingsOpen()) return;
        if (hideTimer) clearTimeout(hideTimer);
        hideTimer = window.setTimeout(() => {
            if (!isSettingsOpen()) document.body.classList.remove('sba-bottom-nav-visible');
            hideTimer = null;
        }, delay);
    }

    function clampPercent(value) {
        return `${Math.max(0, Math.min(100, value))}%`;
    }

    function initializeLiquidGlassLens() {
        const displacementImage = document.getElementById('sba-liquid-displacement-map');
        if (!displacementImage) return;

        const size = 128;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext('2d', { willReadFrequently: false });
        const pixels = context?.createImageData(size, size);
        if (!context || !pixels) return;

        for (let y = 0; y < size; y += 1) {
            for (let x = 0; x < size; x += 1) {
                const nx = ((x + 0.5) / size - 0.5) * 2;
                const ny = ((y + 0.5) / size - 0.5) * 2;
                const radius = Math.min(1, Math.hypot(nx, ny));
                const edge = Math.max(0, Math.min(1, (radius - 0.38) / 0.62));
                const easedEdge = edge * edge * (3 - (2 * edge));
                const inverseRadius = radius > 0.0001 ? 1 / radius : 0;
                const offset = (y * size + x) * 4;
                pixels.data[offset] = Math.round(128 - (nx * inverseRadius * easedEdge * 112));
                pixels.data[offset + 1] = Math.round(128 - (ny * inverseRadius * easedEdge * 112));
                pixels.data[offset + 2] = 128;
                pixels.data[offset + 3] = 255;
            }
        }

        context.putImageData(pixels, 0, 0);
        displacementImage.setAttribute('href', canvas.toDataURL('image/png'));
    }

    function attachLiquidGlassHighlights() {
        document.querySelectorAll('.card-viewer-site-nav .hud-nav-link').forEach((control) => {
            if (control.dataset.glassHighlightAttached) return;
            control.dataset.glassHighlightAttached = 'true';
            control.addEventListener('pointermove', (event) => {
                if (!isViewerReady()) return;
                const bounds = control.getBoundingClientRect();
                if (!bounds.width || !bounds.height) return;
                control.style.setProperty('--sba-glass-x', clampPercent(((event.clientX - bounds.left) / bounds.width) * 100));
                control.style.setProperty('--sba-glass-y', clampPercent(((event.clientY - bounds.top) / bounds.height) * 100));
            });
            control.addEventListener('pointerleave', () => {
                control.style.removeProperty('--sba-glass-x');
                control.style.removeProperty('--sba-glass-y');
            });
        });

        document.querySelectorAll('.card-viewer-site-nav .hud-nav-group').forEach((dock) => {
            if (dock.dataset.highlightAttached) return;
            dock.dataset.highlightAttached = 'true';
            dock.addEventListener('pointermove', (event) => {
                if (!isViewerReady()) return;
                const bounds = dock.getBoundingClientRect();
                if (!bounds.width || !bounds.height) return;
                dock.style.setProperty('--sba-dock-x', clampPercent(((event.clientX - bounds.left) / bounds.width) * 100));
                dock.style.setProperty('--sba-dock-y', clampPercent(((event.clientY - bounds.top) / bounds.height) * 100));
            });
            dock.addEventListener('pointerleave', () => {
                dock.style.removeProperty('--sba-dock-x');
                dock.style.removeProperty('--sba-dock-y');
            });
        });
    }

    function attachViewerSettingsControls() {
        document.querySelectorAll('[data-viewer-theme]').forEach((button) => {
            if (button.dataset.viewerThemeAttached) return;
            button.dataset.viewerThemeAttached = 'true';
            button.addEventListener('click', () => {
                applyViewerTheme(button.dataset.viewerTheme);
                revealViewerNav();
            });
        });

        document.addEventListener('pointerdown', (event) => {
            if (!isSettingsOpen()) return;
            const drawer = document.getElementById('settingsDrawer');
            const button = document.getElementById('sba-side-settings-button');
            if (!drawer?.contains(event.target) && !button?.contains(event.target)) {
                setCardViewerSettingsOpen(false);
            }
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && isSettingsOpen()) {
                event.preventDefault();
                setCardViewerSettingsOpen(false);
            }
        });
    }

    // This executes before card-inspector-core.js registers renderCardDetails.
    enableAbsCleanViewer();

    document.addEventListener('pointermove', (event) => {
        if (!isViewerReady()) return;
        if (isSettingsOpen()) {
            revealViewerNav();
            return;
        }
        const nav = document.querySelector('.card-viewer-site-nav .hud-nav-group');
        const isInsideNav = Boolean(nav?.contains(event.target));
        const isNearBottom = event.clientY >= window.innerHeight - 112;
        if (isNearBottom || isInsideNav) revealViewerNav();
        else scheduleViewerNavHide();
    }, { passive: true });

    document.addEventListener('focusin', (event) => {
        const nav = document.querySelector('.card-viewer-site-nav .hud-nav-group');
        const drawer = document.getElementById('settingsDrawer');
        if (nav?.contains(event.target) || drawer?.contains(event.target)) revealViewerNav();
    });

    window.addEventListener('resize', () => {
        if (!isViewerReady()) return;
        if (isSettingsOpen()) revealViewerNav();
        else document.body.classList.remove('sba-bottom-nav-visible');
    }, { passive: true });

    const initialize = () => {
        initializeViewerTheme();
        initAbsCleanBackgroundMode();
        initializeLiquidGlassLens();
        attachLiquidGlassHighlights();
        attachViewerSettingsControls();
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize, { once: true });
    } else {
        initialize();
    }

    window.enableAbsCleanViewer = enableAbsCleanViewer;
    window.switchCardViewerTheme = (themeName) => applyViewerTheme(themeName);
    window.setAbsCleanBackgroundMode = setAbsCleanBackgroundMode;
    window.initAbsCleanBackgroundMode = initAbsCleanBackgroundMode;
    window.toggleCardViewerSettings = toggleCardViewerSettings;
    window.revealCardViewerNav = revealViewerNav;
    window.scheduleCardViewerNavHide = scheduleViewerNavHide;
})();
