/*
 * Published card viewer bootstrap.
 *
 * The editor has a larger theme controller, but the published viewer only
 * needs presentation classes, the shared sidebar navigation, and a small
 * viewer-safe settings popover. Keep this file independent from editor
 * controls, import/export actions, and editor cache state.
 */
(() => {
    'use strict';

    const VIEWER_THEME_KEY = 'card_viewer_theme';
    const BACKGROUND_MODE_KEY = 'abs_clean_bg_mode';
    const CLEAN_THEME = 'abs-clean';
    const LEGACY_PRESENTATION_CLASSES = ['theme-abs-style', 'theme-dokkaninfo', 'theme-placeholder', 'theme-abs-clean', 'theme-phantom'];
    const ALL_VIEWER_THEME_CLASSES = ['theme-sba', ...LEGACY_PRESENTATION_CLASSES];
    const SUPPORTED_THEMES = new Set(['abs-style', 'dokkaninfo', CLEAN_THEME, 'phantom']);
    let settingsReturnFocus = null;

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
        if (value === 'sba' || value === 'abs.clean' || value === 'abs-clean') return CLEAN_THEME;
        if (value === 'abs.phantom') return 'phantom';
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
            } else if (theme === 'dokkaninfo') {
                app.classList.add('theme-dokkaninfo');
            } else if (theme === 'phantom') {
                app.classList.add('theme-phantom');
            } else {
                app.classList.add('theme-abs-style');
            }
        }

        if (body) {
            if (theme === CLEAN_THEME) body.classList.add('theme-abs-clean');
            else if (theme === 'dokkaninfo') body.classList.add('theme-dokkaninfo');
            else if (theme === 'phantom') body.classList.add('theme-phantom');
            else body.classList.add('theme-abs-style');
            body.dataset.cardViewerTheme = theme;
        }
        window.setActiveCardLayout?.(theme);
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
            writeStoredValue('dokkan_published_card_theme', theme);
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
        window.setActiveCardLayout?.(CLEAN_THEME);
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

    // Compatibility callbacks now use the shared sidebar; no bottom hover timer.
    function revealViewerNav() { window.absNavigation?.refresh(); }
    function scheduleViewerNavHide() {}

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

    const initialize = () => {
        initializeViewerTheme();
        initAbsCleanBackgroundMode();
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
