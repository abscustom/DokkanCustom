/* ==========================================================================
   absCustom Hub - Vertical Timeline & Database Architecture
   ========================================================================== */

const CENTRAL_ASSET_URL = 'https://abscustom.github.io/assets/images/';
// The original ABS dashboard has been retired. The refined SBA implementation
// is now the public ABS theme; its internal key stays "sba" to avoid breaking
// the established CSS and saved asset references.
const HUB_THEME_KEYS = new Set(['sba']);
const CARD_LAYOUT_KEYS = new Set(['dokkan', 'simple']);
const CARD_LAYOUT_SCHEMA = 'simple-default-v2';
let currentHubView = 'home';
if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
if (performance.getEntriesByType('navigation')[0]?.type === 'reload') {
    window.addEventListener('load', () => requestAnimationFrame(() => window.scrollTo(0, 0)), { once: true });
}
let currentAppStyle = HUB_THEME_KEYS.has(localStorage.getItem('hub_selected_style'))
    ? localStorage.getItem('hub_selected_style')
    : 'sba';
// The initial selector briefly defaulted to Dokkan. Treat that old preference
// as unversioned and migrate it once to the intended Simple default.
let currentCardsLayout = localStorage.getItem('hub_cards_layout_schema') === CARD_LAYOUT_SCHEMA &&
    CARD_LAYOUT_KEYS.has(localStorage.getItem('hub_cards_layout'))
    ? localStorage.getItem('hub_cards_layout')
    : 'simple';
let currentFxMode = localStorage.getItem('hub_card_fx_mode') || 'all';
let currentSourceFilter = 'all';
let searchQuery = '';
let requireKoScreen = false;
let selectedCategoryFilters = new Set();
let categoryDefinitions = [];
let koScreenCardIds = new Set();
let koScreenIndexPromise = null;
let allCardItems = [];
let filteredCardItems = [];
let currentPage = 1;
const CARDS_PER_PAGE = 40;
// Keep the SBA Cards panel compact enough to read as a landscape section.
// 40 items cleanly fills 10 columns (4 rows) or 5 columns (8 rows).
const SBA_CARDS_PER_PAGE = 40;
const HOME_LOGO_DEFAULT_SRC = 'https://abscustom.github.io/assets/images/abs_logo_home.png';
const HOME_LOGO_ALT_SRC = 'https://abscustom.github.io/assets/images/abs_logo_other.png';
let sbaBottomNavHideTimer = null;
let hubLightningObserver = null;
let sbaLrLwfObserver = null;

function canPlayHubLightning() {
    return currentFxMode !== 'no-lightning' &&
        currentFxMode !== 'static' &&
        currentAppStyle !== 'sba' &&
        !document.hidden;
}

function chooseHomeLogoVariant() {
    const homeLogo = document.querySelector('.sba-pixel-divider-logo');
    if (!homeLogo) return;

    // The alternate mark is an occasional Home-page variant.
    const useAlternateLogo = Math.random() < 0.30;
    homeLogo.src = useAlternateLogo ? HOME_LOGO_ALT_SRC : HOME_LOGO_DEFAULT_SRC;
    homeLogo.classList.toggle('is-alt-home-logo', useAlternateLogo);
}

function updateHubLightningVideo(video) {
    const shouldPlay = canPlayHubLightning() && video.dataset.hubLightningVisible === 'true';
    if (shouldPlay) {
        video.play().catch(() => {});
    } else {
        video.pause();
    }
}

function ensureHubLightningObserver() {
    if (hubLightningObserver || typeof IntersectionObserver === 'undefined') return;
    hubLightningObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            entry.target.dataset.hubLightningVisible = String(entry.isIntersecting);
            updateHubLightningVideo(entry.target);
        });
    }, { root: null, rootMargin: '80px', threshold: 0.01 });
}

function mountHubLightningVideos(container) {
    if (!container) return;
    ensureHubLightningObserver();

    container.querySelectorAll('.hub-lr-lightning').forEach((video) => {
        video.dataset.hubLightningVisible = 'false';
        if (hubLightningObserver) {
            hubLightningObserver.observe(video);
        } else {
            video.dataset.hubLightningVisible = 'true';
            updateHubLightningVideo(video);
        }
    });
}

function unmountHubLightningVideos(container) {
    if (!container) return;
    container.querySelectorAll('.hub-lr-lightning').forEach((video) => {
        hubLightningObserver?.unobserve(video);
        video.pause();
    });
}

function syncHubLightningPlayback() {
    document.querySelectorAll('.hub-lr-lightning').forEach(updateHubLightningVideo);
}

document.addEventListener('visibilitychange', syncHubLightningPlayback);

function canPlaySbaLrLwf() {
    return currentAppStyle === 'sba' &&
        currentFxMode !== 'no-lightning' &&
        currentFxMode !== 'static' &&
        !document.hidden;
}

function updateSbaLrLwf(canvas) {
    if (!canvas?.isConnected) return;
    const shouldPlay = canPlaySbaLrLwf() && canvas.dataset.sbaLrVisible === 'true';

    if (!shouldPlay) {
        if (canvas.id) window.DokkanLWF?.pause?.(canvas.id);
        return;
    }

    if (canvas.dataset.lwfReady === 'true' && canvas.id) {
        window.DokkanLWF?.play?.(canvas.id);
        return;
    }

    if (typeof window.DokkanLWF?.attachDokkanModeLrEffect !== 'function') {
        setTimeout(() => updateSbaLrLwf(canvas), 120);
        return;
    }

    window.DokkanLWF.attachDokkanModeLrEffect(canvas)
        .then((attached) => {
            if (attached) updateSbaLrLwf(canvas);
        })
        .catch(() => {});
}

function ensureSbaLrLwfObserver() {
    if (sbaLrLwfObserver || typeof IntersectionObserver === 'undefined') return;
    sbaLrLwfObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            entry.target.dataset.sbaLrVisible = String(entry.isIntersecting);
            updateSbaLrLwf(entry.target);
        });
    }, { root: null, rootMargin: '20px', threshold: 0.01 });
}

function mountSbaLrLwfEffects(container = document) {
    ensureSbaLrLwfObserver();
    container.querySelectorAll?.('.sba-lr-lwf-canvas').forEach((canvas) => {
        if (canvas.dataset.sbaLrObserved === 'true') {
            updateSbaLrLwf(canvas);
            return;
        }
        canvas.dataset.sbaLrObserved = 'true';
        canvas.dataset.sbaLrVisible = 'false';
        if (sbaLrLwfObserver) {
            sbaLrLwfObserver.observe(canvas);
        } else {
            canvas.dataset.sbaLrVisible = 'true';
            updateSbaLrLwf(canvas);
        }
    });
}

function unmountSbaLrLwfEffects(container) {
    if (!container) return;
    container.querySelectorAll('.sba-lr-lwf-canvas').forEach((canvas) => {
        sbaLrLwfObserver?.unobserve(canvas);
        if (canvas.id) window.DokkanLWF?.destroy?.(canvas.id);
        delete canvas.dataset.lwfReady;
        delete canvas.dataset.lwfRequest;
        delete canvas.dataset.lwfLoading;
    });
}

function syncSbaLrLwfPlayback() {
    document.querySelectorAll('.sba-lr-lwf-canvas').forEach(updateSbaLrLwf);
}

document.addEventListener('visibilitychange', syncSbaLrLwfPlayback);

function syncFxModeControls(fxMode) {
    document.querySelectorAll('[data-fx-mode]').forEach((button) => {
        const isActive = button.dataset.fxMode === fxMode;
        button.classList.toggle('active', isActive);
        button.setAttribute('aria-pressed', String(isActive));
    });
}

function syncAutoScrollForFxMode() {
    document.querySelectorAll('[data-h-scroll-attached="true"]').forEach((element) => {
        if (element._hAutoScrollId) cancelAnimationFrame(element._hAutoScrollId);
        element._hAutoScrollId = null;

        if (currentFxMode !== 'static' && window.attachSmoothHorizontalScroll) {
            const speed = Number(element.dataset.autoScrollSpeed) || 0.28;
            window.attachSmoothHorizontalScroll(element, speed);
        }
    });
}

window.handleHubThumbError = function(img, folderId, parentFolderId) {
    img.onerror = null;
    img.src = `https://images.weserv.nl/?url=dokkaninfo.com/assets/japan/character/thumb/card_${folderId}_thumb/card_${folderId}_thumb.png`;
    img.onerror = function() {
        this.onerror = null;
        if (parentFolderId && parentFolderId !== folderId) {
            this.src = `https://images.weserv.nl/?url=dokkaninfo.com/assets/japan/character/thumb/card_${parentFolderId}_thumb/card_${parentFolderId}_thumb.png`;
            this.onerror = function() {
                this.onerror = null;
                this.src = `${CENTRAL_ASSET_URL}SSR_Icon.png`;
            };
        } else {
            this.src = `${CENTRAL_ASSET_URL}SSR_Icon.png`;
        }
    };
};

window.handleHubCircleError = function(img, folderId, parentFolderId) {
    img.classList.add('is-fallback-thumb');
    img.onerror = function() {
        window.handleHubThumbError(this, folderId, parentFolderId);
    };
    img.src = `./assets/card-art/thumbnails/card_${folderId}_thumb/card_${folderId}_thumb.png`;
};

function setAppStyle(styleKey) {
    styleKey = HUB_THEME_KEYS.has(styleKey) ? styleKey : 'sba';
    const settingsDrawer = document.getElementById('settingsDrawer');
    const settingsOverlay = document.getElementById('settingsOverlay');
    const keepSettingsOpen = Boolean(
        settingsDrawer?.classList.contains('open') ||
        document.body.classList.contains('sba-side-settings-open')
    );

    document.body.classList.add('hub-style-transitioning');
    currentAppStyle = styleKey;
    localStorage.setItem('hub_selected_style', styleKey);
    localStorage.setItem('hub_theme_schema', 'sba-v1');
    window.updateSiteFavicon?.(styleKey);

    document.documentElement.dataset.hubTheme = styleKey;
    document.querySelectorAll('.abs-hud-theme-btn').forEach((btn) => {
        btn.classList.remove('active');
        btn.setAttribute('aria-pressed', 'false');
    });
    const themeButton = document.getElementById(`theme-btn-${styleKey === 'sba' ? 'abs' : styleKey}`);
    themeButton?.classList.add('active');
    themeButton?.setAttribute('aria-pressed', 'true');

    document.body.classList.remove('theme-abs-style', 'theme-sba', 'theme-placeholder');
    document.body.classList.add(`theme-${styleKey}`);
    syncSbaCardsFilterPlacement();
    // The SBA home ticker and the ABS home news card use different markup.
    // Rebuild it after the body theme changes so ticker elements can never
    // remain behind when the user returns to ABS (or vice versa).
    if (currentHubView === 'home') window.dokkanNews?.renderHomeSnippet?.();
    requestAnimationFrame(() => setTimeout(syncSbaBottomNavVisibility, 40));

    // The SBA rail uses its own compact identity mark. Keep the shared header
    // image in the other themes untouched rather than maintaining duplicate navs.
    const hubLogo = document.getElementById('nav-center-logo');
    if (hubLogo?.dataset.sbaSrc) {
        const defaultSource = 'https://abscustom.github.io/assets/images/abs.custom.png';
        hubLogo.src = styleKey === 'sba' ? hubLogo.dataset.sbaSrc : defaultSource;
    }

    // Settings is the control surface for changing themes. Preserve it across
    // a theme change so the interface does not flash closed and then reopen.
    document.body.classList.remove('sba-side-settings-open', 'sba-side-filters-open');
    document.getElementById('sidebarDrawer')?.classList.remove('open');
    document.getElementById('sidebarOverlay')?.classList.remove('open');

    if (keepSettingsOpen) {
        settingsDrawer?.classList.add('open');
        if (styleKey === 'sba') {
            document.body.classList.add('sba-side-settings-open');
            settingsOverlay?.classList.remove('open');
            document.body.dataset.sbaPanelOpenedAt = String(Date.now());
        } else {
            settingsOverlay?.classList.add('open');
            delete document.body.dataset.sbaPanelOpenedAt;
        }
    } else {
        settingsDrawer?.classList.remove('open');
        settingsOverlay?.classList.remove('open');
        delete document.body.dataset.sbaPanelOpenedAt;
    }

    if (styleKey === 'sba') {
        document.querySelectorAll('.seza-lwf-border-canvas').forEach((canvas) => {
            window.DokkanLWF?.destroy?.(canvas.id);
            canvas.remove();
        });
    } else if (currentFxMode !== 'no-seza' && currentFxMode !== 'static') {
        mountGridSezaFlames();
    }

    syncHubLightningPlayback();
    mountSbaLrLwfEffects();
    syncSbaLrLwfPlayback();
    window.dispatchEvent(new CustomEvent('abs-hub-theme-change', { detail: { style: styleKey } }));
    requestAnimationFrame(() => {
        setTimeout(() => document.body.classList.remove('hub-style-transitioning'), 280);
    });
}

function setCardsLayout(layoutKey) {
    const nextLayout = CARD_LAYOUT_KEYS.has(layoutKey) ? layoutKey : 'simple';
    currentCardsLayout = nextLayout;
    localStorage.setItem('hub_cards_layout', nextLayout);
    localStorage.setItem('hub_cards_layout_schema', CARD_LAYOUT_SCHEMA);
    document.body.classList.remove('cards-layout-dokkan', 'cards-layout-simple');
    document.body.classList.add(`cards-layout-${nextLayout}`);

    document.querySelectorAll('[data-cards-layout]').forEach((button) => {
        const isActive = button.dataset.cardsLayout === nextLayout;
        button.classList.toggle('active', isActive);
        button.setAttribute('aria-pressed', String(isActive));
    });

    // The Dokkan view restores every linked card, whereas Simple can condense
    // related forms. Re-render the active Cards grid when this choice changes.
    if (currentHubView === 'cards' && allCardItems.length) {
        // Start with an empty grid so a previous mode's relationship stacks,
        // alternate portraits, and effects cannot overlap the new mode.
        const cardGrid = document.getElementById('cardGrid');
        if (cardGrid) cardGrid.replaceChildren();
        filterCards(true);
    }
}

function syncSbaCardsFilterPlacement() {
    const filters = document.querySelector('.cards-inline-filter-bar');
    const sbaSlot = document.getElementById('sbaCardFiltersSlot');
    const origin = document.getElementById('cardsInlineFiltersOrigin');
    const categoryFilter = document.getElementById('categoryFilterGroup');
    const categorySlot = document.getElementById('sbaCategoryFilterSlot');
    const categoryOrigin = document.getElementById('sbaCategoryFilterOrigin');
    const advancedFilters = document.querySelector('.advanced-animation-filter-group');
    const advancedSlot = document.getElementById('sbaAdvancedFilterSlot');
    const advancedOrigin = document.getElementById('sbaAdvancedFilterOrigin');
    if (!filters || !sbaSlot || !origin) return;

    if (document.body.classList.contains('theme-sba')) {
        if (filters.parentElement !== sbaSlot) sbaSlot.append(filters);
        if (categoryFilter && categorySlot && categoryFilter.parentElement !== categorySlot) {
            categorySlot.append(categoryFilter);
        }
        if (advancedFilters && advancedSlot && advancedFilters.parentElement !== advancedSlot) {
            advancedSlot.append(advancedFilters);
        }
    } else if (filters.parentElement !== origin.parentElement) {
        origin.insertAdjacentElement('afterend', filters);
        if (categoryFilter && categoryOrigin) categoryOrigin.insertAdjacentElement('afterend', categoryFilter);
        if (advancedFilters && advancedOrigin) advancedOrigin.insertAdjacentElement('afterend', advancedFilters);
    }
}

function getCardsPerPage() {
    return document.body.classList.contains('theme-sba') ? SBA_CARDS_PER_PAGE : CARDS_PER_PAGE;
}

function syncSbaBottomNavVisibility() {
    document.body.classList.remove('sba-bottom-nav-visible');
    if (sbaBottomNavHideTimer) {
        clearTimeout(sbaBottomNavHideTimer);
        sbaBottomNavHideTimer = null;
    }
}

function revealSbaBottomNav() {
    if (!document.body.classList.contains('theme-sba')) return;
    if (sbaBottomNavHideTimer) clearTimeout(sbaBottomNavHideTimer);
    document.body.classList.add('sba-bottom-nav-visible');
}

function scheduleSbaBottomNavHide(delay = 800) {
    if (!document.body.classList.contains('theme-sba')) return;
    if (sbaBottomNavHideTimer) clearTimeout(sbaBottomNavHideTimer);
    sbaBottomNavHideTimer = setTimeout(() => {
        document.body.classList.remove('sba-bottom-nav-visible');
        sbaBottomNavHideTimer = null;
    }, delay);
}

function setFxAnimationMode(fxMode) {
    const allowedModes = new Set(['all', 'no-lightning', 'no-seza', 'static']);
    fxMode = allowedModes.has(fxMode) ? fxMode : 'all';
    currentFxMode = fxMode;
    localStorage.setItem('hub_card_fx_mode', fxMode);

    document.body.classList.remove('fx-no-lightning', 'fx-no-seza', 'fx-static');
    if (fxMode === 'no-lightning') {
        document.body.classList.add('fx-no-lightning');
    } else if (fxMode === 'no-seza') {
        document.body.classList.add('fx-no-seza');
    } else if (fxMode === 'static') {
        document.body.classList.add('fx-static');
    }
    
    if (fxMode === 'no-seza' || fxMode === 'static') {
        document.querySelectorAll('.seza-lwf-border-canvas').forEach((canvas) => {
            window.DokkanLWF?.destroy?.(canvas.id);
            canvas.remove();
        });
    } else {
        mountGridSezaFlames();
    }

    const backgroundVideo = document.getElementById('bg-video');
    if (backgroundVideo) {
        if (fxMode === 'static') {
            backgroundVideo.pause();
        } else if (backgroundVideo.paused) {
            backgroundVideo.play().catch(() => {});
        }
    }

    syncFxModeControls(fxMode);
    syncAutoScrollForFxMode();
    syncHubLightningPlayback();
    mountSbaLrLwfEffects();
    syncSbaLrLwfPlayback();
    if (currentHubView === 'home' && document.body.classList.contains('theme-sba')) {
        renderHomeShowcaseGrid();
    }
    window.dispatchEvent(new CustomEvent('abs-fx-mode-change', { detail: { mode: fxMode } }));
}

window.setFxAnimationMode = setFxAnimationMode;

// Background-shader settings are deliberately separate from Card FX. Keep the
// persisted choice as a body class so every page can restore its own original
// background immediately when the shader is switched off.
function setFlutedGlassEnabled(value) {
    const enabled = value === true || value === 'on';
    localStorage.setItem('fluted_glass_enabled', enabled ? 'on' : 'off');
    document.body.classList.toggle('fluted-glass-disabled', !enabled);
    document.querySelectorAll('[data-fluted-glass-mode]').forEach((button) => {
        const isActive = (button.dataset.flutedGlassMode === 'on') === enabled;
        button.classList.toggle('active', isActive);
        button.setAttribute('aria-pressed', String(isActive));
    });
}

window.setFlutedGlassEnabled = setFlutedGlassEnabled;
document.addEventListener('click', (event) => {
    const button = event.target.closest?.('[data-fluted-glass-mode]');
    if (!button) return;
    event.preventDefault();
    setFlutedGlassEnabled(button.dataset.flutedGlassMode);
});

function handleSourceChange(source) {
    currentSourceFilter = source;
    filterCards(true);
}

function positionSettingsMiniGui() {
    const drawer = document.getElementById('settingsDrawer');
    const btn = document.getElementById('sba-side-settings-button') || document.querySelector('.hud-nav-link[aria-label="Settings"]');
    if (!drawer || !btn) return;
    const btnRect = btn.getBoundingClientRect();
    const drawerWidth = Math.min(290, window.innerWidth - 24);

    // Position horizontally centered above the Settings button (or clamped to screen edge)
    let left = btnRect.left + (btnRect.width / 2) - (drawerWidth / 2);
    left = Math.max(12, Math.min(window.innerWidth - drawerWidth - 12, left));

    const bottom = Math.max(16, window.innerHeight - btnRect.top + 10);
    drawer.style.setProperty('position', 'fixed', 'important');
    drawer.style.setProperty('left', `${Math.round(left)}px`, 'important');
    drawer.style.setProperty('bottom', `${Math.round(bottom)}px`, 'important');
    drawer.style.setProperty('top', 'auto', 'important');
    drawer.style.setProperty('right', 'auto', 'important');
    drawer.style.setProperty('width', `${drawerWidth}px`, 'important');
    drawer.style.setProperty('height', 'auto', 'important');
    drawer.style.setProperty('max-height', `${Math.round(window.innerHeight - bottom - 16)}px`, 'important');
}

function toggleSettingsDrawer() {
    const drawer = document.getElementById('settingsDrawer');
    const overlay = document.getElementById('settingsOverlay');
    if (drawer && overlay) {
        if (document.body.classList.contains('theme-sba')) {
            const isOpen = document.body.classList.contains('sba-side-settings-open');
            const willOpen = !isOpen;
            document.body.classList.toggle('sba-side-settings-open', willOpen);
            document.body.classList.remove('sba-side-filters-open');
            drawer.classList.toggle('open', willOpen);
            document.getElementById('sidebarDrawer')?.classList.remove('open');
            overlay.classList.remove('open');
            document.getElementById('sidebarOverlay')?.classList.remove('open');
            document.getElementById('sba-side-settings-button')?.setAttribute('aria-expanded', String(willOpen));
            document.getElementById('sba-side-filter-button')?.setAttribute('aria-expanded', 'false');
            if (willOpen) {
                document.body.dataset.sbaPanelOpenedAt = String(Date.now());
                positionSettingsMiniGui();
            }
            return;
        }
        const isOpen = drawer.classList.contains('open');
        if (isOpen) {
            drawer.classList.remove('open');
            overlay.classList.remove('open');
        } else {
            drawer.classList.add('open');
            overlay.classList.add('open');
        }
    }
}

function toggleSidebar() {
    const drawer = document.getElementById('sidebarDrawer');
    const overlay = document.getElementById('sidebarOverlay');
    if (drawer && overlay) {
        if (document.body.classList.contains('theme-sba')) {
            const popover = document.getElementById('sbaCardsFilterPopover');
            const isOpen = popover?.classList.contains('is-open');
            popover?.classList.toggle('is-open', !isOpen);
            popover?.setAttribute('aria-hidden', String(isOpen));
            document.body.classList.remove('sba-side-filters-open');
            document.body.classList.remove('sba-side-settings-open');
            drawer.classList.remove('open');
            document.getElementById('settingsDrawer')?.classList.remove('open');
            overlay.classList.remove('open');
            document.getElementById('settingsOverlay')?.classList.remove('open');
            document.getElementById('sba-side-filter-button')?.setAttribute('aria-expanded', String(!isOpen));
            document.getElementById('sba-side-settings-button')?.setAttribute('aria-expanded', 'false');
            document.getElementById('cardsAdvancedFilterBtn')?.setAttribute('aria-expanded', String(!isOpen));
            return;
        }
        const isOpen = drawer.classList.contains('open');
        if (isOpen) {
            drawer.classList.remove('open');
            overlay.classList.remove('open');
        } else {
            drawer.classList.add('open');
            overlay.classList.add('open');
        }
        document.getElementById('cardsAdvancedFilterBtn')?.setAttribute('aria-expanded', String(!isOpen));
    }
}

// The Filters button is declared in the page markup, so expose its handler
// explicitly even when this script is evaluated in an isolated scope.
window.toggleSidebar = toggleSidebar;

function switchHubView(viewKey, sourceKey = null) {
    // A click on the already-open workspace does not rebuild anything.  In
    // particular, do not create another loading-screen transition for it.
    if (currentHubView === viewKey && (!sourceKey || sourceKey === currentSourceFilter)) {
        requestAnimationFrame(() => setTimeout(syncSbaBottomNavVisibility, 40));
        return;
    }
    // Tab content is already rendered in the DOM; switching is an instant
    // display toggle. No full-screen loader - keeps Home/Cards/News snappy.
    currentHubView = viewKey;
    currentPage = 1;
    document.body.classList.toggle('hub-cards-nav-static', viewKey === 'cards');
    document.body.classList.toggle('hub-news-active', viewKey === 'news');
    // SBA's Filters entry belongs to the Cards workspace, not the Home dock.
    document.body.classList.toggle('hub-cards-active', viewKey === 'cards');
    syncSbaCardsFilterPlacement();

    if (sourceKey) {
        currentSourceFilter = sourceKey;
        const sourceGroup = document.querySelector('.cards-inline-filter-bar .source-pill-group');
        if (sourceGroup) {
            sourceGroup.querySelectorAll('.filter-pill-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.value === sourceKey);
            });
        }
    }

    // Synchronize browser URL bar so reloads accurately reflect the current view
    try {
        if (viewKey === 'home') {
            window.history.replaceState({}, document.title, window.location.pathname);
        } else if (viewKey === 'news') {
            window.history.replaceState({}, document.title, `${window.location.pathname}?view=news`);
        } else if (viewKey === 'cards') {
            window.history.replaceState({}, document.title, `${window.location.pathname}?view=cards`);
        }
    } catch (e) {}

    document.querySelectorAll('.hud-nav-link, .apple-nav-item').forEach(btn => {
        btn.classList.remove('active');
    });

    const activeBtn = document.getElementById(`nav-btn-${viewKey}`);
    if (activeBtn) activeBtn.classList.add('active');

    const homeSection = document.getElementById('hubHomeSection');
    const cardsSection = document.getElementById('hubCardsSection');
    const newsSection = document.getElementById('hubNewsSection');
    const cardsTitle = document.getElementById('cardsViewTitle');
    const cardsSubtitle = document.getElementById('cardsViewSubtitle');

    if (viewKey === 'home') {
        // Removing the temporary display:none lets SBA's responsive flex home
        // layout take control again. Restoring it as display:block was the
        // cause of the misplaced Timeline/showcase until a page refresh.
        if (homeSection) homeSection.style.removeProperty('display');
        if (cardsSection) cardsSection.style.display = 'none';
        if (newsSection) newsSection.style.display = 'none';
        renderTimelineView();
        renderHomeShowcaseGrid();
        if (window.dokkanNews) window.dokkanNews.renderHomeSnippet();
    } else if (viewKey === 'cards') {
        if (homeSection) homeSection.style.display = 'none';
        if (cardsSection) cardsSection.style.display = 'block';
        if (newsSection) newsSection.style.display = 'none';

        if (cardsTitle && cardsSubtitle) {
            if (currentSourceFilter === 'official') {
                cardsTitle.textContent = 'Cards';
                cardsSubtitle.textContent = 'Official characters and awakenings';
            } else if (currentSourceFilter === 'custom') {
                cardsTitle.textContent = 'Cards';
                cardsSubtitle.textContent = 'Custom community creations';
            } else {
                cardsTitle.textContent = 'Cards';
                cardsSubtitle.textContent = 'Official and custom characters';
            }
        }

        filterCards(true);
    } else if (viewKey === 'news') {
        if (homeSection) homeSection.style.display = 'none';
        if (cardsSection) cardsSection.style.display = 'none';
        if (newsSection) newsSection.style.display = 'block';

        if (window.dokkanNews) {
            window.dokkanNews.renderNewsSection();
            if (sourceKey === 'discord' || sourceKey === 'game') {
                window.dokkanNews.setNewsSource(sourceKey);
            }
        }
    }

    requestAnimationFrame(() => setTimeout(syncSbaBottomNavVisibility, 40));
}

function handleSearchInput(val) {
    searchQuery = (val || '').trim().toLowerCase();
    filterCards(true);
}

function getCardFolderId(cardId) {
    let rawId = typeof cardId === 'number' ? cardId : parseInt(cardId, 10) || 0;
    if (rawId > 10000000) rawId = Math.floor(rawId / 10);
    return Math.floor(rawId / 10) * 10;
}

function getCardParentId(cardId) {
    let rawId = typeof cardId === 'number' ? cardId : parseInt(cardId, 10) || 0;
    if (rawId > 10000000) rawId = Math.floor(rawId / 10);
    let str = String(rawId);
    if (str.length === 7 && str.startsWith('4')) {
        return parseInt('1' + str.substring(1), 10);
    }
    return rawId;
}

function getCardClassAndType(elementId) {
    const alignment = Math.floor((elementId || 0) / 10);
    const typeIndex = (elementId || 0) % 10;
    const types = { 0: "agl", 1: "teq", 2: "int", 3: "str", 4: "phy" };
    return { 
        cardClass: alignment === 2 ? "extreme" : "super", 
        cardType: types[typeIndex] || "agl" 
    };
}

function normalizeCustomCardReference(reference) {
    const raw = String(reference || '').trim();
    if (!raw || raw === '#' || /^javascript:/i.test(raw)) return '';

    try {
        const parsed = new URL(raw, window.location.href);
        if (/card\.html$/i.test(parsed.pathname)) return '';
        return decodeURIComponent(parsed.pathname).replace(/^\/+|\/+$/g, '').toLowerCase();
    } catch (e) {
        return raw.replace(/^\/+|\/+$/g, '').toLowerCase();
    }
}

function getCustomCardReferenceKeys(card) {
    const keys = new Set();
    const add = (value) => {
        const key = normalizeCustomCardReference(value);
        if (key) keys.add(key);
    };

    add(card?.repoPath);
    add(card?.id);
    if (card?.id) add(`Custom Cards/${card.id}`);
    return keys;
}

const HUB_CARD_TYPE_COLORS = {
    agl: '#36a8ff',
    teq: '#46db72',
    int: '#a86cff',
    str: '#ff5364',
    phy: '#f4cf3f'
};

function customCardReferencesTarget(fromCard, targetCard) {
    const targetKeys = getCustomCardReferenceKeys(targetCard);
    return (fromCard?.linkedCardReferences || []).some((reference) => {
        const normalizedReference = normalizeCustomCardReference(reference);
        return normalizedReference && [...targetKeys].some((key) => (
            normalizedReference === key || normalizedReference.endsWith(`/${key}`) || key.endsWith(`/${normalizedReference}`)
        ));
    });
}

function normalizeRelationshipName(name) {
    return String(name || '')
        .replace(/\s*\(EZA\)\s*$/i, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

function isTemporaryReturningRelationship(firstCard, secondCard) {
    const firstName = normalizeRelationshipName(firstCard?.name);
    const secondName = normalizeRelationshipName(secondCard?.name);
    if (!firstName || !secondName) return false;

    const advancesAfterTemporaryForm = firstCard.transformsAfterTemporaryEnds || secondCard.transformsAfterTemporaryEnds;
    return !advancesAfterTemporaryForm && (
        firstCard.isTemporaryTransformation || secondCard.isTemporaryTransformation ||
        /\b(?:giant form|giant ape|great ape|rage mode)\b/i.test(`${firstName} ${secondName}`)
    );
}

function isReversibleExchangeRelationship(firstCard, secondCard) {
    const firstName = normalizeRelationshipName(firstCard?.name);
    const secondName = normalizeRelationshipName(secondCard?.name);
    if (!firstName || !secondName) return false;

    // Only an actual reversible exchange receives the custom reversible logo.
    // Temporary standby/rage/giant states are handled separately so they keep
    // the normal pair of directional arrows.
    if (firstCard.isReversibleExchange && secondCard.isReversibleExchange) return true;

    // Custom cards may predate the saved passive metadata. Their reversed
    // A + B / B + A names remain a safe compatibility fallback.
    if (firstCard.source !== 'custom' || secondCard.source !== 'custom') return false;
    const firstParts = firstName.split(/\s+\+\s+/).map(part => part.trim()).filter(Boolean);
    const secondParts = secondName.split(/\s+\+\s+/).map(part => part.trim()).filter(Boolean);
    return firstParts.length > 1 && firstParts.length === secondParts.length &&
        firstParts.every((part, index) => part === secondParts[secondParts.length - 1 - index]);
}

function getAdjacentCardRelationship(firstCard, secondCard) {
    if (!firstCard || !secondCard || firstCard === secondCard) return null;

    if (firstCard.source === 'official' && secondCard.source === 'official') {
        const firstParent = Number(firstCard.parentId || getCardParentId(firstCard.id));
        const secondParent = Number(secondCard.parentId || getCardParentId(secondCard.id));
        if (!firstParent || firstParent !== secondParent || String(firstCard.id) === String(secondCard.id)) return null;

        if (isReversibleExchangeRelationship(firstCard, secondCard)) {
            return { direction: 'both', connector: 'reversible' };
        }
        if (isTemporaryReturningRelationship(firstCard, secondCard)) {
            return { direction: 'both', connector: 'standard' };
        }

        const firstId = Number(firstCard.id);
        const secondId = Number(secondCard.id);
        const firstIsTransformation = firstId >= 4000000 && firstId < 5000000;
        const secondIsTransformation = secondId >= 4000000 && secondId < 5000000;
        return { direction: firstIsTransformation && !secondIsTransformation ? 'backward' : 'forward' };
    }

    if (firstCard.source !== 'custom' || secondCard.source !== 'custom') return null;
    const pointsForward = customCardReferencesTarget(firstCard, secondCard);
    const pointsBackward = customCardReferencesTarget(secondCard, firstCard);
    if (!pointsForward && !pointsBackward) return null;

    if (isReversibleExchangeRelationship(firstCard, secondCard)) {
        return { direction: 'both', connector: 'reversible' };
    }
    if (isTemporaryReturningRelationship(firstCard, secondCard)) {
        return { direction: 'both', connector: 'standard' };
    }
    if (pointsBackward && !pointsForward) return { direction: 'backward' };
    return { direction: 'forward' };
}

function arrangeLinkedCardsForDisplay(cards) {
    const list = Array.from(cards || []);
    const customCards = list.filter(card => card?.source === 'custom');
    if (customCards.length < 2) return list;

    const originalIndex = new Map(list.map((card, index) => [card, index]));
    const neighbors = new Map(customCards.map(card => [card, new Set()]));

    for (let firstIndex = 0; firstIndex < customCards.length - 1; firstIndex += 1) {
        for (let secondIndex = firstIndex + 1; secondIndex < customCards.length; secondIndex += 1) {
            const firstCard = customCards[firstIndex];
            const secondCard = customCards[secondIndex];
            if (!getAdjacentCardRelationship(firstCard, secondCard)) continue;
            neighbors.get(firstCard).add(secondCard);
            neighbors.get(secondCard).add(firstCard);
        }
    }

    const componentByCard = new Map();
    const orderedComponentByCard = new Map();
    const visited = new Set();

    customCards.forEach(startCard => {
        if (visited.has(startCard) || neighbors.get(startCard).size === 0) return;
        const component = [];
        const queue = [startCard];
        visited.add(startCard);
        while (queue.length) {
            const card = queue.shift();
            component.push(card);
            neighbors.get(card).forEach(neighbor => {
                if (visited.has(neighbor)) return;
                visited.add(neighbor);
                queue.push(neighbor);
            });
        }

        const remaining = new Set(component);
        const ordered = [];
        let current = component.slice().sort((first, second) => (
            neighbors.get(first).size - neighbors.get(second).size ||
            originalIndex.get(first) - originalIndex.get(second)
        ))[0];

        while (remaining.size) {
            ordered.push(current);
            remaining.delete(current);
            const linkedChoices = Array.from(neighbors.get(current)).filter(card => remaining.has(card));
            if (linkedChoices.length) {
                current = linkedChoices.sort((first, second) => (
                    Array.from(neighbors.get(second)).filter(card => remaining.has(card)).length -
                    Array.from(neighbors.get(first)).filter(card => remaining.has(card)).length ||
                    originalIndex.get(first) - originalIndex.get(second)
                ))[0];
            } else if (remaining.size) {
                current = Array.from(remaining).sort((first, second) => (
                    neighbors.get(first).size - neighbors.get(second).size ||
                    originalIndex.get(first) - originalIndex.get(second)
                ))[0];
            }
        }

        component.forEach(card => {
            componentByCard.set(card, component);
            orderedComponentByCard.set(card, ordered);
        });
    });

    const emitted = new Set();
    const arranged = [];
    list.forEach(card => {
        const component = componentByCard.get(card);
        if (!component) {
            arranged.push(card);
            return;
        }
        if (emitted.has(component)) return;
        emitted.add(component);
        arranged.push(...orderedComponentByCard.get(card));
    });
    return arranged;
}

function isLinkedPairInsideVisibleRow(container, firstElement, secondElement) {
    const containerRect = container.getBoundingClientRect();
    const firstRect = firstElement.getBoundingClientRect();
    const secondRect = secondElement.getBoundingClientRect();
    const rowTolerance = Math.max(8, Math.min(firstRect.height, secondRect.height) * 0.2);
    const sameRow = Math.abs(firstRect.top - secondRect.top) <= rowTolerance;
    const secondIsToTheRight = secondRect.left > firstRect.right;
    const edgePadding = 6;
    const bothFullyVisible = firstRect.left >= containerRect.left + edgePadding &&
        secondRect.right <= containerRect.right - edgePadding;

    return sameRow && secondIsToTheRight && bothFullyVisible;
}

function refreshLinkedCardEffects(container) {
    const renderedCards = container?._linkedCardItems || [];
    const cardElements = Array.from(container?.querySelectorAll(':scope > .char-box') || []);
    cardElements.forEach(cardElement => {
        cardElement.classList.remove(
            'has-linked-neighbor',
            'linked-from-previous',
            'link-direction-forward',
            'link-direction-backward',
            'link-direction-reversible'
        );
        cardElement.style.removeProperty('--linked-from-color');
        cardElement.style.removeProperty('--linked-to-color');
        cardElement.style.removeProperty('--linked-glow-color');
    });

    for (let index = 0; index < cardElements.length - 1; index += 1) {
        const relationship = getAdjacentCardRelationship(renderedCards[index], renderedCards[index + 1]);
        if (!relationship || !isLinkedPairInsideVisibleRow(container, cardElements[index], cardElements[index + 1])) continue;

        const firstColor = HUB_CARD_TYPE_COLORS[renderedCards[index]?.type] || '#7dd3fc';
        const secondColor = HUB_CARD_TYPE_COLORS[renderedCards[index + 1]?.type] || '#7dd3fc';
        const cardElement = cardElements[index];
        cardElement.classList.add('has-linked-neighbor');
        if (relationship.direction === 'forward') cardElement.classList.add('link-direction-forward');
        if (relationship.direction === 'backward') cardElement.classList.add('link-direction-backward');
        if (relationship.connector === 'reversible') cardElement.classList.add('link-direction-reversible');
        cardElements[index + 1].classList.add('linked-from-previous');
        cardElement.style.setProperty('--linked-from-color', firstColor);
        cardElement.style.setProperty('--linked-to-color', secondColor);
        cardElement.style.setProperty('--linked-glow-color', secondColor);
    }
}

function clearSbaLinkedCardPresentation(container) {
    const cardElements = Array.from(container?.querySelectorAll(':scope > .char-box') || []);
    cardElements.forEach((cardElement) => {
        cardElement.classList.remove(
            'sba-linked-primary',
            'sba-linked-secondary',
            'sba-reversible-stack',
            'sba-custom-reversible-stack',
            'sba-transform-cycle',
            'sba-special-count-1',
            'sba-special-count-2'
        );
        Array.from(cardElement.classList).forEach((className) => {
            if (className.startsWith('sba-cycle-count-')) cardElement.classList.remove(className);
        });
        cardElement.style.removeProperty('--sba-linked-type');
        cardElement.removeAttribute('data-sba-form-count');
        cardElement.querySelectorAll('.sba-generated-portrait').forEach((portrait) => portrait.remove());
        cardElement.querySelectorAll('.sba-generated-status-badge').forEach((badge) => badge.remove());

        const basePortrait = cardElement.querySelector('.hub-circle-img:not(.sba-generated-portrait)');
        if (basePortrait) {
            Array.from(basePortrait.classList).forEach((className) => {
                if (className.startsWith('sba-cycle-index-')) basePortrait.classList.remove(className);
            });
            basePortrait.classList.remove('sba-cycle-portrait');
        }
    });
}

function getSummonBrand(unitTag) {
    const normalizedTag = String(unitTag || '').toUpperCase();
    if (normalizedTag.includes('CARNIVAL')) return 'carnival';
    if (normalizedTag.includes('DOKKAN FESTIVAL') || normalizedTag.includes('DOKKAN FEST')) return 'festival';
    return '';
}

function applySbaLinkedCardPresentation(container, renderedCards) {
    if (!container) return;
    clearSbaLinkedCardPresentation(container);

    const cardElements = Array.from(container.querySelectorAll(':scope > .char-box'));
    const cards = Array.from(renderedCards || []);
    let groupStart = 0;

    while (groupStart < Math.min(cards.length, cardElements.length)) {
        const groupEdges = [];
        let groupEnd = groupStart;
        while (groupEnd + 1 < cards.length && groupEnd + 1 < cardElements.length) {
            const relationship = getAdjacentCardRelationship(cards[groupEnd], cards[groupEnd + 1]);
            if (!relationship) break;
            groupEdges.push({ from: groupEnd, to: groupEnd + 1, relationship });
            groupEnd += 1;
        }

        if (!groupEdges.length) {
            groupStart += 1;
            continue;
        }

        const groupIndices = Array.from(
            { length: groupEnd - groupStart + 1 },
            (_, offset) => groupStart + offset
        );
        const officialBaseIndex = groupIndices.find((index) => {
            if (cards[index]?.source !== 'official') return false;
            const cardId = Number(cards[index]?.id);
            return !(cardId >= 4000000 && cardId < 5000000);
        });
        const primaryIndex = officialBaseIndex ?? groupStart;
        const reversibleEdge = groupEdges.find(({ relationship }) => relationship.connector === 'reversible');
        let reversibleIndex = -1;
        if (reversibleEdge) {
            reversibleIndex = reversibleEdge.from === primaryIndex
                ? reversibleEdge.to
                : (reversibleEdge.to === primaryIndex ? reversibleEdge.from : reversibleEdge.to);
        }

        const primaryElement = cardElements[primaryIndex];
        const primaryIcon = primaryElement?.querySelector('.card-icon');
        const primaryPortrait = primaryIcon?.querySelector('.hub-circle-img:not(.sba-generated-portrait)');
        if (!primaryElement || !primaryIcon || !primaryPortrait) {
            groupStart = groupEnd + 1;
            continue;
        }

        primaryElement.classList.add('sba-linked-primary');
        groupIndices.forEach((index) => {
            if (index !== primaryIndex) cardElements[index]?.classList.add('sba-linked-secondary');
        });

        let reversibleMiniGrid = null;
        const addReversibleMini = (cardIndex, kind) => {
            const sourceElement = cardElements[cardIndex];
            const sourcePortrait = sourceElement?.querySelector('.hub-circle-img');
            if (!sourceElement || !sourcePortrait) return false;

            if (!reversibleMiniGrid) {
                reversibleMiniGrid = document.createElement('span');
                reversibleMiniGrid.className = 'sba-generated-portrait sba-reversible-mini-grid';
                reversibleMiniGrid.setAttribute('aria-hidden', 'true');
                primaryIcon.appendChild(reversibleMiniGrid);
            }

            const isCustom = cards[cardIndex]?.source === 'custom';
            const mini = document.createElement('span');
            mini.className = `sba-reversible-mini sba-reversible-mini--${kind}${isCustom ? ' sba-custom-reversible-mini' : ''}`;
            mini.style.setProperty(
                '--sba-mini-ring-color',
                HUB_CARD_TYPE_COLORS[cards[cardIndex]?.type] || '#7dd3fc'
            );
            const portraitClone = sourcePortrait.cloneNode(true);
            portraitClone.classList.add('sba-reversible-portrait');
            portraitClone.removeAttribute('loading');
            portraitClone.alt = '';
            portraitClone.setAttribute('aria-hidden', 'true');
            mini.appendChild(portraitClone);
            reversibleMiniGrid.appendChild(mini);
            return true;
        };

        if (reversibleIndex >= 0 && addReversibleMini(reversibleIndex, 'partner')) {
            primaryElement.classList.add('sba-reversible-stack');
            if (cards[primaryIndex]?.source === 'custom') primaryElement.classList.add('sba-custom-reversible-stack');
        }

        const cyclingIndices = groupIndices.filter((index) => index !== reversibleIndex);
        const statusBadges = [];
        if (cyclingIndices.length > 1) {
            const orderedCycleIndices = [primaryIndex, ...cyclingIndices.filter((index) => index !== primaryIndex)];
            if (reversibleMiniGrid) {
                // A reversible exchange uses its compact left-side grid for one
                // additional form, instead of layering that form over the main unit.
                orderedCycleIndices.slice(1, 2).forEach((cardIndex) => addReversibleMini(cardIndex, 'form'));
            } else {
                const cycleCount = Math.min(orderedCycleIndices.length, 6);
                primaryElement.classList.add('sba-transform-cycle', `sba-cycle-count-${cycleCount}`);
                primaryElement.dataset.sbaFormCount = String(cycleCount);
                primaryPortrait.classList.add('sba-cycle-portrait', 'sba-cycle-index-0');

                orderedCycleIndices.slice(1, cycleCount).forEach((cardIndex, cycleIndex) => {
                    const sourcePortrait = cardElements[cardIndex]?.querySelector('.hub-circle-img');
                    if (!sourcePortrait) return;
                    const portraitClone = sourcePortrait.cloneNode(true);
                    portraitClone.classList.add(
                        'sba-generated-portrait',
                        'sba-cycle-portrait',
                        `sba-cycle-index-${cycleIndex + 1}`
                    );
                    portraitClone.setAttribute('aria-hidden', 'true');
                    primaryIcon.appendChild(portraitClone);
                });
            }
        }

        if (statusBadges.length) {
            const badgeCount = Math.min(statusBadges.length, 2);
            primaryElement.classList.add(`sba-special-count-${badgeCount}`);
            statusBadges.slice(0, badgeCount).forEach((badge, badgeIndex) => {
                const badgeImage = document.createElement('img');
                badgeImage.className = `sba-generated-status-badge sba-status-badge sba-status-badge-${badgeIndex + 1}`;
                badgeImage.src = `${CENTRAL_ASSET_URL}${badge.file}`;
                badgeImage.alt = '';
                badgeImage.title = badge.label;
                badgeImage.setAttribute('aria-hidden', 'true');
                badgeImage.dataset.sbaStatus = badge.label.toLowerCase().replaceAll(' ', '-');
                primaryIcon.appendChild(badgeImage);
            });
        }

        groupStart = groupEnd + 1;
    }
}

function applyLinkedCardEffects(container, renderedCards) {
    if (!container) return;
    container._linkedCardItems = renderedCards;
    container._refreshLinkedCardEffects = () => refreshLinkedCardEffects(container);
    const isDokkanCardsView = container.id === 'cardGrid' && currentCardsLayout === 'dokkan';
    if (currentAppStyle === 'sba' && !isDokkanCardsView) {
        applySbaLinkedCardPresentation(container, renderedCards);
    } else {
        clearSbaLinkedCardPresentation(container);
    }

    if (!container.dataset.linkedCardFxBound) {
        container.dataset.linkedCardFxBound = 'true';
        let animationFrame = 0;
        const scheduleRefresh = () => {
            cancelAnimationFrame(animationFrame);
            animationFrame = requestAnimationFrame(() => container._refreshLinkedCardEffects?.());
        };
        container.addEventListener('scroll', scheduleRefresh, { passive: true });
        window.addEventListener('resize', scheduleRefresh, { passive: true });
    }

    refreshLinkedCardEffects(container);
    requestAnimationFrame(() => refreshLinkedCardEffects(container));
}

// Carry an awakening-marked official card's highest available state into the
// viewer. Hub items use the base seven-digit id, so the viewer needs the mode
// query to select the EZA/SEZA record instead of defaulting to BASE.
function getCardViewerUrl(card) {
    if (!card || card.source === 'custom') return card?.cardUrl || '#';

    const mode = card.isSeza ? 'seza' : (card.isEza ? 'eza' : '');
    const id = encodeURIComponent(String(card.id));
    return mode ? `card.html?viewer=1&id=${id}&mode=${mode}` : `card.html?viewer=1&id=${id}`;
}

function generateCardHtml(c, useCssBadges = false) {
    const folderId = getCardFolderId(c.id);
    const parentFolderId = Math.floor(getCardParentId(c.id) / 10) * 10;
    const { cardClass } = getCardClassAndType(c.element !== undefined ? c.element : 0);
    const cardType = c.type || "agl";
    const isLR = (c.rarity === 5 || c.rarity === 'lr');
    const isSeza = !!c.isSeza;
    const isEza = !!c.isEza && !isSeza;
    const rarityKey = isLR ? 'LR' : ((c.rarity === 4 || c.rarity === 'tur') ? 'TUR' : 'SSR');
    
    const rarityFilename = rarityKey === 'SSR' ? 'rarity_ssr.png' : `rarity_${rarityKey}.png`;
    const raritySrc = `${CENTRAL_ASSET_URL}${rarityFilename}`;
    const frameSrc = `${CENTRAL_ASSET_URL}frame_${cardType}.png`;
    const typeSrc = rarityKey === 'SSR'
        ? `${CENTRAL_ASSET_URL}type_${cardType}.png`
        : `${CENTRAL_ASSET_URL}${cardClass}_type_${cardType}.png`;
    const rarityBadgeHtml = useCssBadges
        ? `<span class="custom-badge rarity-badge" data-rarity="${rarityKey.toLowerCase()}" aria-label="${rarityKey} rarity"><span class="custom-badge-text">${rarityKey}</span></span>`
        : `<img class="rarity" src="${raritySrc}" loading="lazy">`;
    const typeBadgeHtml = useCssBadges
        ? `<span class="custom-badge type-badge" data-type="${cardType}" data-card-class="${cardClass}" aria-label="${cardClass} ${cardType.toUpperCase()} type"><span class="custom-badge-text">${cardType.toUpperCase()}</span></span>`
        : `<img class="type" src="${typeSrc}" loading="lazy">`;

    const thumbUrl = c.thumbUrl || `./assets/card-art/thumbnails/card_${folderId}_thumb/card_${folderId}_thumb.png`;
    const circleUrl = c.source === 'custom'
        ? thumbUrl
        : `./assets/card-art/cards/${folderId}/card_${folderId}_circle.png`;
    const circleError = c.source === 'custom'
        ? `window.handleHubThumbError(this, '${folderId}', '${parentFolderId}')`
        : `window.handleHubCircleError(this, '${folderId}', '${parentFolderId}')`;
    let lrOverlayHtml = '';
    if (isLR) {
        lrOverlayHtml = `
            <img class="lr-dial" src="${CENTRAL_ASSET_URL}lr_spin_dial.png" loading="lazy">`;
    }

    let awakeningBadgeHtml = '';
    if (isSeza) {
        awakeningBadgeHtml = useCssBadges
            ? `<span class="hub-eza-badge custom-awakening-badge hub-eza-badge--seza" data-awakening="seza" aria-label="Super EZA"><span class="hub-eza-badge-text">SEZA</span></span>`
            : `<img class="hub-eza-badge" src="${CENTRAL_ASSET_URL}superza_abs.png">`;
    } else if (isEza) {
        awakeningBadgeHtml = useCssBadges
            ? `<span class="hub-eza-badge custom-awakening-badge hub-eza-badge--eza" data-awakening="eza" aria-label="Extreme Z-Awaken"><span class="hub-eza-badge-text">EZA</span></span>`
            : `<img class="hub-eza-badge" src="${CENTRAL_ASSET_URL}eza_abs.png">`;
    }

    const awakeningLabel = isSeza ? 'SEZA' : (isEza ? 'EZA' : '');
    const arcLabel = [rarityKey, cardType.toUpperCase(), awakeningLabel].filter(Boolean).join(' • ');
    const arcId = `hub-card-meta-arc-${String(c.source || 'official').replace(/[^a-z0-9_-]/gi, '')}-${String(c.id).replace(/[^a-z0-9_-]/gi, '')}`;
    const cardBadgeHtml = useCssBadges
        ? `<svg class="hub-card-meta-arc" viewBox="0 0 150 48" role="img" aria-label="${arcLabel}">
            <defs><path id="${arcId}" d="M 18 38 A 80 80 0 0 1 132 38" /></defs>
            <text><textPath href="#${arcId}" startOffset="50%" text-anchor="middle">${arcLabel}</textPath></text>
        </svg>`
        : `${rarityBadgeHtml}${typeBadgeHtml}${awakeningBadgeHtml}`;

    const awakeningFxMode = isSeza ? 'seza' : (isEza ? 'eza' : '');
    const sbaRingEffectsHtml = `
        ${isLR ? '<canvas class="sba-lr-lwf-canvas sba-lr-lwf-aura-canvas" width="640" height="1136" aria-hidden="true"></canvas>' : ''}
        ${isLR ? '<canvas class="sba-lr-lwf-canvas sba-lr-lwf-lightning-canvas" data-lwf-pack="lightning" width="640" height="1136" aria-hidden="true"></canvas>' : ''}
        ${awakeningFxMode ? `<canvas class="sba-ring-effect sba-${awakeningFxMode}-ring-effect" data-awakening-fx="${awakeningFxMode}" width="180" height="180" aria-hidden="true"></canvas>` : ''}`;

    const sezaGlowClass = isSeza ? 'seza-glow-card' : '';
    const targetUrl = getCardViewerUrl(c);
    const targetAttr = c.source === 'custom' ? 'target="_blank"' : '';

    return `
<a href="${targetUrl}" ${targetAttr} class="char-box" data-source="${c.source}" data-class="${cardClass}" data-type="${cardType}" data-seza="${isSeza ? 'true' : 'false'}" data-rarity="${rarityKey.toLowerCase()}">
    <div class="card-icon ${sezaGlowClass}">
        <img class="frame" src="${frameSrc}" loading="lazy">
        ${lrOverlayHtml}
        <img class="char-img" src="${thumbUrl}" loading="lazy" onerror="window.handleHubThumbError(this, '${folderId}', '${parentFolderId}')">
        <img class="hub-circle-img${c.source === 'custom' ? ' is-fallback-thumb' : ''}" src="${circleUrl}" loading="lazy" onerror="${circleError}">
        ${sbaRingEffectsHtml}
        ${cardBadgeHtml}
    </div>
    <div class="name-container">
        <div class="char-name-wrapper">
            <span class="char-name">${c.name}</span>
        </div>
    </div>
</a>`;
}

function generateTimelineRowHtml(c) {
    const folderId = getCardFolderId(c.id);
    const parentFolderId = Math.floor(getCardParentId(c.id) / 10) * 10;
    const { cardClass } = getCardClassAndType(c.element !== undefined ? c.element : 0);
    const cardType = c.type || "agl";
    const isLR = (c.rarity === 5 || c.rarity === 'lr');
    const isSeza = !!c.isSeza;
    const isEza = !!c.isEza && !isSeza;
    const rarityKey = isLR ? 'LR' : ((c.rarity === 4 || c.rarity === 'tur') ? 'TUR' : 'SSR');
    
    const rarityFilename = rarityKey === 'SSR' ? 'rarity_ssr.png' : `rarity_${rarityKey}.png`;
    const raritySrc = `${CENTRAL_ASSET_URL}${rarityFilename}`;
    const frameSrc = `${CENTRAL_ASSET_URL}frame_${cardType}.png`;
    const typeSrc = (rarityKey === 'SSR') ? `${CENTRAL_ASSET_URL}type_${cardType}.png` : `${CENTRAL_ASSET_URL}${cardClass}_type_${cardType}.png`;

    const thumbUrl = c.thumbUrl || `./assets/card-art/thumbnails/card_${folderId}_thumb/card_${folderId}_thumb.png`;
    const circleUrl = c.source === 'custom'
        ? thumbUrl
        : `./assets/card-art/cards/${folderId}/card_${folderId}_circle.png`;
    const circleError = c.source === 'custom'
        ? `window.handleHubThumbError(this, '${folderId}', '${parentFolderId}')`
        : `window.handleHubCircleError(this, '${folderId}', '${parentFolderId}')`;

    let lrOverlayHtml = '';
    if (isLR) {
        lrOverlayHtml = `<img class="tl-lr-dial" src="${CENTRAL_ASSET_URL}lr_spin_dial.png" loading="lazy">`;
    }

    let awakeningBadgeHtml = '';
    if (isSeza) {
        awakeningBadgeHtml = `<img class="tl-eza-badge" src="${CENTRAL_ASSET_URL}superza_abs.png">`;
    } else if (isEza) {
        awakeningBadgeHtml = `<img class="tl-eza-badge" src="${CENTRAL_ASSET_URL}eza_abs.png">`;
    }

    const targetUrl = getCardViewerUrl(c);
    const targetAttr = c.source === 'custom' ? 'target="_blank"' : '';
    // The row color communicates why this exact card is on the timeline.
    // Awakening states win over its source so a custom EZA/SEZA stays clear.
    const timelineStatus = isSeza
        ? 'seza'
        : (isEza ? 'eza' : (c.source === 'custom' ? 'custom' : 'new'));
    const timelineStatusLabel = timelineStatus === 'seza'
        ? 'SEZA'
        : (timelineStatus === 'eza' ? 'EZA' : (timelineStatus === 'custom' ? 'NEW CUSTOM' : 'NEW'));

    return `
    <a href="${targetUrl}" ${targetAttr} class="timeline-entry-row timeline-entry-row--${timelineStatus}" data-timeline-status="${timelineStatus}" data-timeline-type="${cardType}" data-timeline-name="${c.name}" title="${c.name}">
        <div class="timeline-composed-icon">
            <img class="tl-frame" src="${frameSrc}" loading="lazy">
            ${lrOverlayHtml}
            <img class="tl-char-img${c.source === 'custom' ? ' is-custom-timeline-portrait' : ''}" src="${circleUrl}" loading="lazy" onerror="${circleError}">
            <img class="tl-rarity" src="${raritySrc}" loading="lazy">
            <img class="tl-type" src="${typeSrc}" loading="lazy">
            ${awakeningBadgeHtml}
        </div>
        <span class="timeline-entry-status">${timelineStatusLabel}</span>
        <div class="timeline-row-name-box">
            <span class="timeline-row-name">${c.name}</span>
            <span class="timeline-row-sub">${rarityKey} • ${cardType.toUpperCase()} ${isSeza ? '• SUPER EZA' : (isEza ? '• EZA' : '')}</span>
        </div>
    </a>`;
}

function mountGridSezaFlames() {
    if (currentAppStyle === 'sba' || currentFxMode === 'no-seza' || currentFxMode === 'static') return;
    if (typeof window.DokkanLWF === 'undefined' || !window.DokkanLWF.attachSezaFlameBorder) {
        setTimeout(mountGridSezaFlames, 120);
        return;
    }

    document.querySelectorAll('.char-box[data-seza="true"]').forEach(box => {
        const iconContainer = box.querySelector('.card-icon');
        const cardType = box.getAttribute('data-type') || 'agl';
        if (iconContainer && !iconContainer.querySelector('.seza-lwf-border-canvas')) {
            window.DokkanLWF.attachSezaFlameBorder(iconContainer, cardType);
        }
    });
}

function checkAndEnableTextScrolling() {
    document.querySelectorAll('.char-box').forEach(box => {
        const container = box.querySelector('.name-container');
        const wrapper = box.querySelector('.char-name-wrapper');
        const textSpan = box.querySelector('.char-name');

        if (container && wrapper && textSpan) {
            if (textSpan.scrollWidth > container.clientWidth - 4) {
                if (!wrapper.classList.contains('marquee-active')) {
                    wrapper.classList.add('marquee-active');
                    const rawName = textSpan.textContent;
                    wrapper.innerHTML = `
                        <div class="marquee-track">
                            <span class="char-name">${rawName}</span>
                            <span class="marquee-spacer">✦</span>
                            <span class="char-name">${rawName}</span>
                        </div>
                    `;
                }
            }
        }
    });
}

function formatTimelineDateTime(timestamp) {
    if (!timestamp || timestamp === 0) return null;
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return null;

    const datePart = d.toLocaleDateString("en-US", { 
        timeZone: "America/New_York", 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });

    const timePart = d.toLocaleTimeString("en-US", { 
        timeZone: "America/New_York", 
        hour: '2-digit', 
        minute: '2-digit', 
        hour12: false 
    }) + " EST";

    return {
        fullLabel: `${datePart} • ${timePart}`,
        dateOnly: datePart,
        timeOnly: timePart
    };
}

function formatTimelineCountdown(timestamp) {
    const remaining = Number(timestamp) - Date.now();
    if (!Number.isFinite(remaining) || remaining <= 0) return '';
    const totalMinutes = Math.ceil(remaining / 60000);
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;
    const seconds = Math.max(0, Math.ceil(remaining / 1000) % 60);
    if (days > 0) return `${days}d ${hours}h ${minutes}m ${seconds}s`;
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    return `${Math.max(1, minutes)}m ${seconds}s`;
}

function refreshTimelineCountdowns() {
    document.querySelectorAll('.timeline-node-countdown[data-release-at]').forEach((node) => {
        const countdown = formatTimelineCountdown(Number(node.dataset.releaseAt));
        if (!countdown) {
            node.remove();
            return;
        }
        node.textContent = `IN ${countdown}`;
        node.setAttribute('aria-label', `Releases in ${countdown}`);
    });
}

function bindTimelineCarouselControls() {
    const track = document.getElementById('timelineScrollTrack');
    const previous = document.getElementById('timelinePrevBtn');
    const next = document.getElementById('timelineNextBtn');
    if (!track || !previous || !next || track.dataset.carouselBound === 'true') return;
    track.dataset.carouselBound = 'true';
    const move = (direction) => track.scrollBy({ left: direction * Math.max(260, Math.round(track.clientWidth * 0.72)), behavior: 'smooth' });
    previous.addEventListener('click', () => move(-1));
    next.addEventListener('click', () => move(1));
}

function getTimelineBaseCards(cards) {
    const baseByFamily = new Map();
    cards.forEach(card => {
        // Official transformation forms are stored as 4xxxxxx IDs. Keep the
        // release's normal/base member when its family is also present. Custom
        // cards remain independent because their uploaded forms are explicit.
        const numericId = Number(card.id) || 0;
        const isTransformationForm = card.source === 'official' && numericId >= 4000000 && numericId < 10000000;
        const familyKey = card.source === 'official'
            ? `official:${card.parentId || getCardParentId(card.id)}`
            : `custom:${card.id}`;
        const existing = baseByFamily.get(familyKey);
        if (!existing) {
            baseByFamily.set(familyKey, card);
            return;
        }
        const existingId = Number(existing.id) || 0;
        const existingIsTransformation = existing.source === 'official' && existingId >= 4000000 && existingId < 10000000;
        if ((existingIsTransformation && !isTransformationForm) ||
            (existingIsTransformation === isTransformationForm && numericId < existingId)) {
            baseByFamily.set(familyKey, card);
        }
    });
    return Array.from(baseByFamily.values());
}

function bindSbaTimelineHoverTooltips(timelineStream) {
    if (!timelineStream || timelineStream.dataset.sbaTooltipBound === 'true') return;
    timelineStream.dataset.sbaTooltipBound = 'true';

    let tooltip = document.getElementById('sbaTimelineFloatingTooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'sbaTimelineFloatingTooltip';
        tooltip.className = 'sba-timeline-floating-tooltip';
        tooltip.setAttribute('role', 'tooltip');
        document.body.appendChild(tooltip);
    }

    const hideTooltip = () => {
        tooltip.classList.remove('is-visible');
    };

    const placeTooltip = (event) => {
        if (!tooltip.classList.contains('is-visible')) return;
        const margin = 12;
        const bounds = tooltip.getBoundingClientRect();
        let left = event.clientX - bounds.width - margin;
        if (left < margin) left = Math.min(window.innerWidth - bounds.width - margin, event.clientX + margin);
        const top = Math.max(margin, Math.min(window.innerHeight - bounds.height - margin, event.clientY - (bounds.height / 2)));
        tooltip.style.left = `${Math.round(left)}px`;
        tooltip.style.top = `${Math.round(top)}px`;
    };

    timelineStream.addEventListener('pointerover', (event) => {
        const row = event.target.closest('.timeline-entry-row');
        if (!row || !timelineStream.contains(row) || !document.body.classList.contains('theme-sba')) return;
        tooltip.textContent = row.dataset.timelineName || row.textContent.trim();
        tooltip.classList.add('is-visible');
        placeTooltip(event);
    });

    timelineStream.addEventListener('pointermove', (event) => {
        if (event.target.closest('.timeline-entry-row')) placeTooltip(event);
    });

    timelineStream.addEventListener('pointerout', (event) => {
        const row = event.target.closest('.timeline-entry-row');
        if (row && !row.contains(event.relatedTarget)) hideTooltip();
    });
}

function renderTimelineView() {
    const timelineStream = document.getElementById('timelineNodesStream');
    if (!timelineStream) return;

    const sourceList = (allCardItems && allCardItems.length > 0) 
        ? allCardItems 
        : (window.rawCustomCards || []);

    const dokkanMinTime = new Date("2015-01-30T00:00:00Z").getTime();

    // On Home view, timeline shows all official and custom releases chronologically
    const validCards = sourceList.filter(item => {
        // SBA's release rail is the official Dokkan timeline. Community cards
        // stay in the showcase rather than being mixed into release batches.
        if (document.body.classList.contains('theme-sba') && item.source === 'custom') return false;
        if (!item.sortTime || item.sortTime < dokkanMinTime) return false;
        return true;
    });

    if (validCards.length === 0) {
        timelineStream.innerHTML = `<div style="padding: 30px; text-align: center; color: #94a3b8; font-weight: 700; font-size: 13px;">Loading release timeline...</div>`;
        return;
    }

    const groupsMap = new Map();

    validCards.forEach(c => {
        const dtInfo = formatTimelineDateTime(c.sortTime);
        if (!dtInfo) return;

        const dateKey = dtInfo.fullLabel;
        if (!groupsMap.has(dateKey)) {
            groupsMap.set(dateKey, {
                dateLabel: dtInfo.fullLabel,
                sortTime: c.sortTime,
                cards: []
            });
        }
        groupsMap.get(dateKey).cards.push(c);
    });

    const timelineGroups = Array.from(groupsMap.values()).sort((a, b) => b.sortTime - a.sortTime);
    // Keep the entire current year visible on the Home timeline. If that is
    // shorter than 60 release batches, continue into the previous year so the
    // panel still feels populated.
    const currentYearStart = new Date(new Date().getFullYear(), 0, 1).getTime();
    const currentYearBatchCount = timelineGroups.filter(batch => batch.sortTime >= currentYearStart).length;
    const minimumBatchCount = Math.max(60, currentYearBatchCount);
    // A custom card should remain visible at its entered release date even
    // when that date falls before the normal recent-release window.
    const renderBatches = timelineGroups.filter((batch, index) => (
        index < minimumBatchCount || batch.cards.some(card => card.source === 'custom')
    ));

    let timelineHtml = '';

    renderBatches.forEach(batch => {
        const baseCards = getTimelineBaseCards(batch.cards);
        const hasCustom = baseCards.some(c => c.source === 'custom');
        const hasSeza = baseCards.some(c => c.isSeza);
        const hasEza = baseCards.some(c => c.isEza && !c.isSeza);
        const hasNew = baseCards.some(c => !c.isEza && !c.isSeza);

        let badgesHtml = '';
        if (hasCustom) badgesHtml += `<span class="timeline-tag tag-new-cc">NEW CUSTOM</span>`;
        if (hasSeza) badgesHtml += `<span class="timeline-tag tag-seza">SEZA</span>`;
        if (hasEza) badgesHtml += `<span class="timeline-tag tag-eza">EZA</span>`;
        if (hasNew) badgesHtml += `<span class="timeline-tag tag-new">NEW</span>`;

        const entriesHtml = baseCards.map(c => generateTimelineRowHtml(c)).join('\n');

        const countdown = formatTimelineCountdown(batch.sortTime);
        timelineHtml += `
        <div class="timeline-node-item">
            <div class="timeline-node-marker"></div>
            <div class="timeline-node-card">
                <div class="timeline-node-header">
                    <span class="timeline-node-date">${batch.dateLabel}</span>
                    ${countdown ? `<span class="timeline-node-countdown" data-release-at="${batch.sortTime}" aria-label="Releases in ${countdown}">IN ${countdown}</span>` : ''}
                    <div class="timeline-node-tags">${badgesHtml}</div>
                </div>
                <div class="timeline-entries-list">
                    ${entriesHtml}
                </div>
            </div>
        </div>`;
    });

    timelineStream.innerHTML = timelineHtml;
    bindSbaTimelineHoverTooltips(timelineStream);
    bindTimelineCarouselControls();
    refreshTimelineCountdowns();
}

window.attachSmoothHorizontalScroll = function(el, autoScrollSpeed = 0.28) {
    if (!el) return;
    el.dataset.autoScrollSpeed = String(autoScrollSpeed);
    
    // Stop any existing animation on this element
    if (el._hAutoScrollId) {
        cancelAnimationFrame(el._hAutoScrollId);
        el._hAutoScrollId = null;
    }

    if (!el.dataset.hScrollAttached) {
        el.dataset.hScrollAttached = "true";

        let isDown = false;
        let startX = 0;
        let scrollStart = 0;
        let hasMoved = false;
        let isUserInteracting = false;
        let resumeTimer = null;

        const pauseTemporarily = (duration = 2000) => {
            isUserInteracting = true;
            clearTimeout(resumeTimer);
            resumeTimer = setTimeout(() => {
                isUserInteracting = false;
            }, duration);
        };

        // Mouse Wheel horizontal scrolling
        el.addEventListener('wheel', (e) => {
            if (e.deltaY !== 0) {
                e.preventDefault();
                el.scrollLeft += e.deltaY;
                pauseTemporarily(2000);
            }
        }, { passive: false });

        // Hover movement pause
        el.addEventListener('mousemove', (e) => {
            if (isDown) {
                const x = e.pageX - el.offsetLeft;
                const walk = (x - startX) * 1.5;
                if (Math.abs(walk) > 4) {
                    hasMoved = true;
                }
                el.scrollLeft = scrollStart - walk;
            }
            pauseTemporarily(2500);
        });

        el.addEventListener('mouseleave', () => { 
            if (!isDown) {
                isUserInteracting = false;
                clearTimeout(resumeTimer);
            }
        });

        // Touch support
        el.addEventListener('touchstart', () => { pauseTemporarily(3000); }, { passive: true });
        el.addEventListener('touchmove', () => { pauseTemporarily(3000); }, { passive: true });
        el.addEventListener('touchend', () => { pauseTemporarily(1500); }, { passive: true });

        // Mouse Drag to scroll
        el.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            isDown = true;
            isUserInteracting = true;
            hasMoved = false;
            startX = e.pageX - el.offsetLeft;
            scrollStart = el.scrollLeft;
        });

        window.addEventListener('mouseup', () => {
            if (isDown) {
                isDown = false;
                pauseTemporarily(1200);
            }
        });

        window.addEventListener('blur', () => {
            isDown = false;
            isUserInteracting = false;
        });

        el.addEventListener('click', (e) => {
            if (hasMoved) {
                e.preventDefault();
                e.stopPropagation();
                hasMoved = false;
            }
        }, true);

        el._checkInteracting = () => isUserInteracting;
    }

    // Continuous Smooth Infinite Auto-Scroll Loop
    let subPixelAcc = 0;
    function autoScrollTick() {
        if (currentFxMode === 'static' || document.body.classList.contains('fx-static')) {
            el._hAutoScrollId = null;
            return;
        }

        const isPaused = el._checkInteracting ? el._checkInteracting() : false;
        const maxScroll = el.scrollWidth - el.clientWidth;

        if (!isPaused && maxScroll > 5) {
            subPixelAcc += autoScrollSpeed;
            if (subPixelAcc >= 1) {
                const px = Math.floor(subPixelAcc);
                subPixelAcc -= px;
                el.scrollLeft += px;

                // Dynamically measure singleSetWidth with exact screen coordinate precision
                let singleSetWidth = parseFloat(el.dataset.singleSetWidth);
                if (!singleSetWidth) {
                    const firstChild = el.firstElementChild;
                    const setLen = parseInt(el.dataset.setLength, 10);
                    if (firstChild && setLen && el.children[setLen]) {
                        const r0 = firstChild.getBoundingClientRect();
                        const rN = el.children[setLen].getBoundingClientRect();
                        singleSetWidth = Math.round(rN.left - r0.left);
                        if (singleSetWidth > 50) el.dataset.singleSetWidth = String(singleSetWidth);
                    }
                }

                // Seamless infinite marquee wrap (imperceptible zero-jump loop)
                if (singleSetWidth > 0 && el.scrollLeft >= singleSetWidth) {
                    el.scrollLeft -= singleSetWidth;
                } else if (el.scrollLeft >= maxScroll - 2) {
                    el.scrollLeft = 0;
                }
            }
        }
        el._hAutoScrollId = requestAnimationFrame(autoScrollTick);
    }
    if (currentFxMode !== 'static' && !document.body.classList.contains('fx-static')) {
        el._hAutoScrollId = requestAnimationFrame(autoScrollTick);
    }
};

let currentInlineType = 'all';
let currentInlineRarity = 'all';

function normalizeCategoryNames(values) {
    return (Array.isArray(values) ? values : [])
        .map(value => String(value || '').trim().toLocaleLowerCase())
        .filter(Boolean);
}

// Keep category counts in lockstep with the Cards view's filter source. The
// detail/editor pages use their own database fallback, but the hub already
// has the merged official + custom card index that its category filters read.
window.getCardHubCategoryCharacterCount = function(categoryId, categoryName) {
    if (!Array.isArray(allCardItems) || !allCardItems.length) return null;

    const targetId = String(categoryId ?? '').trim();
    const targetName = String(categoryName ?? '').trim().toLocaleLowerCase();
    const matchingCharacters = new Set();

    allCardItems.forEach(item => {
        if (!item) return;

        const itemCategoryIds = (Array.isArray(item.categoryIds) ? item.categoryIds : []).map(String);
        const itemCategoryNames = normalizeCategoryNames(item.categoryNames);
        const matchesId = targetId && itemCategoryIds.includes(targetId);
        const matchesName = targetName && itemCategoryNames.includes(targetName);
        if (!matchesId && !matchesName) return;

        // A single character can have multiple indexed states. Prefer the
        // parent identity so the badge reports characters, not variants.
        const identity = item.characterId ?? item.parentId ?? item.id;
        if (identity !== undefined && identity !== null && String(identity).trim()) {
            matchingCharacters.add(String(identity));
        }
    });

    return matchingCharacters.size;
};

function setCategoryDefinitions(rawCategories) {
    const records = Array.isArray(rawCategories) ? rawCategories : Object.values(rawCategories || {});
    categoryDefinitions = records
        .map(category => ({
            id: String(category?.id ?? '').trim(),
            name: String(category?.name ?? '').trim(),
            priority: Number(category?.priority) || 0
        }))
        .filter(category => category.id && category.name)
        .sort((first, second) => first.name.localeCompare(second.name));
    renderCategoryFilterOptions();
}

function renderCategoryFilterOptions(searchTerm = document.getElementById('categoryFilterSearch')?.value || '') {
    const list = document.getElementById('categoryFilterList');
    const status = document.getElementById('categoryFilterStatus');
    const clearButton = document.getElementById('categoryFilterClear');
    if (!list || !status || !clearButton) return;

    const normalizedSearch = String(searchTerm || '').trim().toLocaleLowerCase();
    const selectedCategories = categoryDefinitions.filter(category => selectedCategoryFilters.has(category.id));
    const visibleCategories = categoryDefinitions.filter(category =>
        !normalizedSearch || category.name.toLocaleLowerCase().includes(normalizedSearch)
    );

    list.replaceChildren();
    clearButton.hidden = selectedCategories.length === 0;
    clearButton.disabled = selectedCategories.length === 0;

    if (!categoryDefinitions.length) {
        status.textContent = 'Categories are loading...';
        return;
    }

    status.textContent = selectedCategories.length
        ? `${selectedCategories.length} selected • ${visibleCategories.length} matching categories`
        : `${visibleCategories.length} of ${categoryDefinitions.length} categories`;

    if (!visibleCategories.length) {
        const empty = document.createElement('p');
        empty.className = 'category-filter-empty';
        empty.textContent = 'No categories match that search.';
        list.append(empty);
        return;
    }

    visibleCategories.forEach(category => {
        const button = document.createElement('button');
        const isSelected = selectedCategoryFilters.has(category.id);
        button.type = 'button';
        button.className = 'category-filter-option';
        button.dataset.categoryId = category.id;
        button.setAttribute('role', 'option');
        button.setAttribute('aria-selected', String(isSelected));
        button.classList.toggle('active', isSelected);
        button.title = category.name;
        button.textContent = category.name;
        button.addEventListener('click', () => setCategoryFilter(category.id));
        list.append(button);
    });
}

function handleCategoryFilterSearch(searchTerm) {
    renderCategoryFilterOptions(searchTerm);
}

function setCategoryFilter(categoryId) {
    if (categoryId === null || categoryId === undefined || categoryId === '') {
        selectedCategoryFilters.clear();
    } else {
        const normalizedCategoryId = String(categoryId);
        if (selectedCategoryFilters.has(normalizedCategoryId)) {
            selectedCategoryFilters.delete(normalizedCategoryId);
        } else {
            selectedCategoryFilters.add(normalizedCategoryId);
        }
    }
    renderCategoryFilterOptions();
    syncAdvancedFilterControls();
    filterCards(true);

    const selectedCategories = categoryDefinitions.filter(category => selectedCategoryFilters.has(category.id));
    window.CardHubToast?.show(selectedCategories.length ? 'Category filters updated' : 'Category filters cleared', {
        detail: selectedCategories.length
            ? `Showing characters in any of ${selectedCategories.length} selected categories`
            : 'Showing every character category',
        duration: 2100
    });
}

window.handleCategoryFilterSearch = handleCategoryFilterSearch;
window.setCategoryFilter = setCategoryFilter;

function syncAdvancedFilterControls() {
    const checkbox = document.getElementById('koScreenFilter');
    if (checkbox) checkbox.checked = requireKoScreen;

    const selectedType = document.getElementById('typeFilter')?.value || currentInlineType || 'all';
    const selectedRarity = document.getElementById('rarityFilter')?.value || currentInlineRarity || 'all';
    const activeCount = (currentSourceFilter === 'all' ? 0 : 1)
        + (selectedType === 'all' ? 0 : 1)
        + (selectedRarity === 'all' ? 0 : 1)
        + (requireKoScreen ? 1 : 0)
        + selectedCategoryFilters.size;
    const button = document.getElementById('cardsAdvancedFilterBtn');
    button?.classList.toggle('active', activeCount > 0);

    const count = document.getElementById('advancedFilterCount');
    if (count) {
        count.textContent = String(activeCount);
        count.hidden = activeCount === 0;
    }
}

async function setKoScreenFilter(enabled) {
    requireKoScreen = Boolean(enabled);
    syncAdvancedFilterControls();
    if (requireKoScreen) {
        const toastId = window.CardHubToast?.loading('Finding KO screens…', {
            detail: 'Checking the local animation index'
        });
        await loadKoScreenIndex();
        if (toastId) {
            window.CardHubToast?.update(toastId, 'KO screen filter ready', {
                type: 'success',
                detail: 'Showing cards with detected KO screens'
            });
        }
    }
    filterCards(true);
}

window.setKoScreenFilter = setKoScreenFilter;

function setInlineSourceFilter(sourceVal, btnEl) {
    // Filter chips are toggles: clicking the active choice again returns to
    // the unfiltered card collection, so an extra "All" chip is unnecessary.
    currentSourceFilter = btnEl && sourceVal === currentSourceFilter ? 'all' : sourceVal;
    if (btnEl && btnEl.parentElement) {
        btnEl.parentElement.querySelectorAll('.filter-pill-btn').forEach((button) => {
            button.classList.toggle('active', button.dataset.value === currentSourceFilter);
        });
    }
    syncAdvancedFilterControls();
    filterCards(true);
    window.CardHubToast?.show('Source filter applied', {
        detail: currentSourceFilter === 'all' ? 'Showing official and custom cards' : `Showing ${currentSourceFilter} cards`,
        duration: 2100
    });
}

function setInlineTypeFilter(typeVal, btnEl) {
    const nextType = btnEl && typeVal === currentInlineType ? 'all' : typeVal;
    currentInlineType = nextType;
    const typeSelect = document.getElementById('typeFilter');
    if (typeSelect) typeSelect.value = nextType;
    const typeGroup = btnEl?.parentElement || document.querySelector('.cards-inline-filter-bar .type-pill-group');
    if (typeGroup) {
        typeGroup.querySelectorAll('.filter-pill-btn').forEach((button) => {
            button.classList.toggle('active', button.dataset.value === nextType);
        });
    }
    syncAdvancedFilterControls();
    filterCards(true);
    window.CardHubToast?.show('Type filter applied', {
        detail: nextType === 'all' ? 'Showing every type' : `${nextType.toUpperCase()} cards`,
        duration: 2100
    });
}

function setInlineRarityFilter(rarityVal, btnEl) {
    const nextRarity = btnEl && rarityVal === currentInlineRarity ? 'all' : rarityVal;
    currentInlineRarity = nextRarity;
    const rarSelect = document.getElementById('rarityFilter');
    if (rarSelect) rarSelect.value = nextRarity;
    const rarityGroup = btnEl?.parentElement || document.querySelector('.cards-inline-filter-bar .rarity-pill-group');
    if (rarityGroup) {
        rarityGroup.querySelectorAll('.filter-pill-btn').forEach((button) => {
            button.classList.toggle('active', button.dataset.value === nextRarity);
        });
    }
    syncAdvancedFilterControls();
    filterCards(true);
    window.CardHubToast?.show('Rarity filter applied', {
        detail: nextRarity === 'all' ? 'Showing every rarity' : `${nextRarity.toUpperCase()} cards`,
        duration: 2100
    });
}

function resetAllInlineFilters() {
    currentSourceFilter = 'all';
    currentInlineType = 'all';
    currentInlineRarity = 'all';
    requireKoScreen = false;
    selectedCategoryFilters.clear();
    searchQuery = '';

    const searchInput = document.getElementById('cardSearchInput');
    if (searchInput) searchInput.value = '';

    const typeSelect = document.getElementById('typeFilter');
    if (typeSelect) typeSelect.value = 'all';

    const rarSelect = document.getElementById('rarityFilter');
    if (rarSelect) rarSelect.value = 'all';

    const categorySearch = document.getElementById('categoryFilterSearch');
    if (categorySearch) categorySearch.value = '';
    renderCategoryFilterOptions('');

    document.querySelectorAll('.cards-inline-filter-bar .filter-pill-group').forEach(group => {
        group.querySelectorAll('.filter-pill-btn').forEach(btn => {
            if (btn.dataset.value === 'all') btn.classList.add('active');
            else btn.classList.remove('active');
        });
    });

    syncAdvancedFilterControls();

    filterCards(true);
    window.CardHubToast?.success('Filters cleared', {
        detail: 'Showing the full card collection',
        duration: 2200
    });
}

function renderHomeShowcaseGrid() {
    const homeGrid = document.getElementById('homeCardGrid');
    if (!homeGrid) return;

    const customOnly = allCardItems.filter(c => c.source === 'custom');
    const rawBaseList = customOnly.length > 0 ? customOnly : allCardItems.slice(0, 48);
    const baseList = arrangeLinkedCardsForDisplay(rawBaseList);
    const escapeShowcaseHtml = (value) => String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);

    // SBA has its own intentional showcase treatment: a small full-art carousel
    // rather than the ABS endless thumbnail rail. The selected card stays sharp
    // and centered while its neighbours become supporting, blurred artwork.
    if (document.body.classList.contains('theme-sba')) {
        unmountHubLightningVideos(homeGrid);
        unmountSbaLrLwfEffects(homeGrid);

        const previousIndex = Number(homeGrid.dataset.sbaShowcaseIndex || 0);
        const activeIndex = baseList.length ? ((previousIndex % baseList.length) + baseList.length) % baseList.length : 0;
        const visibleOffsets = [-2, -1, 0, 1, 2];
        const isStaticFx = currentFxMode === 'static' || document.body.classList.contains('fx-static');
        const activeItem = baseList[activeIndex];
        const activeArtUrl = activeItem ? (activeItem.cardArtImageUrl || activeItem.thumbUrl || `./assets/card-art/thumbnails/card_${getCardFolderId(activeItem.id)}_thumb/card_${getCardFolderId(activeItem.id)}_thumb.png`) : '';
        const hasLongActiveName = String(activeItem?.name || '').length > 28;
        const activeType = String(activeItem?.type || 'AGL').toUpperCase();
        const activeRarity = activeItem?.rarity === 5 || String(activeItem?.rarity).toLowerCase() === 'lr'
            ? 'LR'
            : (activeItem?.rarity === 4 || String(activeItem?.rarity).toLowerCase() === 'tur' ? 'TUR' : 'SSR');
        const activeShowcaseLabel = activeItem?.summonBrand === 'festival'
            ? 'Dokkan Festival Unit'
            : (activeItem?.summonBrand === 'carnival' ? 'Carnival Unit' : 'Custom Card Showcase');
        const formatShowcaseReleaseDate = (value) => {
            const rawDate = String(value || '').trim();
            if (!rawDate) return 'Release date unavailable';
            const numericDate = rawDate.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
            const isoDate = rawDate.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
            const parts = numericDate
                ? [Number(numericDate[3]), Number(numericDate[1]) - 1, Number(numericDate[2])]
                : (isoDate ? [Number(isoDate[1]), Number(isoDate[2]) - 1, Number(isoDate[3])] : null);
            const parsed = parts ? new Date(Date.UTC(...parts)) : new Date(rawDate.replace(' ', 'T'));
            if (Number.isNaN(parsed.getTime())) return rawDate;
            return new Intl.DateTimeFormat('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
                timeZone: 'UTC'
            }).format(parsed);
        };
        const activeReleaseDate = escapeShowcaseHtml(formatShowcaseReleaseDate(activeItem?.releaseDate));
        const slides = baseList.length ? visibleOffsets.map((offset) => {
            const itemIndex = (activeIndex + offset + baseList.length * 3) % baseList.length;
            const item = baseList[itemIndex];
            const folderId = getCardFolderId(item.id);
            const parentFolderId = Math.floor(getCardParentId(item.id) / 10) * 10;
            const iconUrl = item.thumbUrl || `./assets/card-art/thumbnails/card_${folderId}_thumb/card_${folderId}_thumb.png`;
            const artUrl = item.cardArtImageUrl || iconUrl;
            const videoUrl = item.cardArtVideoUrl || '';
            const rarityKey = item.rarity === 5 || String(item.rarity).toLowerCase() === 'lr'
                ? 'LR'
                : (item.rarity === 4 || String(item.rarity).toLowerCase() === 'tur' ? 'TUR' : 'SSR');
            const raritySrc = `${CENTRAL_ASSET_URL}${rarityKey === 'SSR' ? 'rarity_ssr.png' : `rarity_${rarityKey}.png`}`;
            const targetUrl = getCardViewerUrl(item);
            // Focused-card clicks redirect in the same tab to the card's page.
            const targetAttr = '';
            const label = escapeShowcaseHtml(item.name || 'Custom card');
            const isFocused = offset === 0;
            const needsVideoStill = videoUrl && (!item.cardArtImageUrl || (isFocused && !isStaticFx));
            const artMedia = isFocused && !isStaticFx && videoUrl
                ? `<img class="sba-showcase-art-poster" src="${artUrl}" alt="" loading="lazy" onerror="this.style.display='none'">
                   <video class="sba-showcase-art-video" autoplay muted loop playsinline preload="metadata" aria-label="${label}"><source src="${videoUrl}" type="video/mp4"></video>`
                : (needsVideoStill
                    ? `<video class="sba-showcase-art-video is-static-frame" muted playsinline preload="metadata" data-sba-static-frame aria-label="${label}"><source src="${videoUrl}" type="video/mp4"></video>`
                    : `<img class="sba-showcase-art-image" src="${artUrl}" alt="${label}" loading="${offset === 0 ? 'eager' : 'lazy'}" onerror="window.handleHubThumbError(this, '${folderId}', '${parentFolderId}')">`);
            return `<a class="sba-showcase-slide${offset === 0 ? ' is-active' : ''}" href="${targetUrl}"${targetAttr} data-sba-showcase-offset="${offset}" data-sba-type="${String(item.type || 'agl').toLowerCase()}" aria-label="${label}" title="${label}">
                ${artMedia}
                <span class="sba-showcase-rarity"><img src="${raritySrc}" alt="${rarityKey}"></span>
                <span class="sba-showcase-card-label">${label}</span>
                ${isFocused ? `<span class="sba-showcase-active-copy"><strong class="${hasLongActiveName ? 'is-marquee' : ''}"><span class="sba-showcase-name-track"><span>${label}</span>${hasLongActiveName ? `<span aria-hidden="true">${label}</span>` : ''}</span></strong><small>${activeRarity} · ${activeType}</small><span class="sba-showcase-release-date">${activeReleaseDate}</span></span>` : ''}
            </a>`;
        }).join('') : '<p class="sba-showcase-empty">No custom cards have been uploaded yet.</p>';
        const navigationDots = baseList.length ? baseList.map((item, itemIndex) => {
            const isCurrent = itemIndex === activeIndex;
            const itemName = escapeShowcaseHtml(item?.name || 'Custom card');
            return `<button type="button" class="sba-showcase-dot${isCurrent ? ' is-active' : ''}" data-sba-showcase-index="${itemIndex}" aria-label="${isCurrent ? `Current card: ${itemName}` : `View ${itemName}`}"${isCurrent ? ' aria-current="true"' : ''}></button>`;
        }).join('') : '';

        homeGrid.classList.add('sba-showcase-carousel');
        homeGrid.tabIndex = 0;
        homeGrid.dataset.sbaShowcaseIndex = String(activeIndex);
        homeGrid.dataset.setLength = String(baseList.length);
        homeGrid.innerHTML = `
            <div class="sba-showcase-ambience" aria-hidden="true">${activeArtUrl ? `<img src="${activeArtUrl}" alt="">` : ''}</div>
            <div class="sba-showcase-eyebrow" aria-hidden="true"><span></span><strong>${escapeShowcaseHtml(activeShowcaseLabel)}</strong><span></span></div>
            ${slides}
            <div class="sba-showcase-pagination" aria-label="Custom-card carousel navigation">${navigationDots}</div>`;
        // Do not call scrollIntoView here. Re-rendering the carousel (including
        // its automatic card rotation) was pulling the entire document down to
        // the active dot even when the user had not opened the showcase.

        // Side cards remain visual previews. Keeping their videos paused avoids
        // five simultaneous MP4 decoders and makes the centered card the only
        // animated focal point.
        homeGrid.querySelectorAll('.sba-showcase-art-video').forEach((video) => {
            const isFocused = video.closest('.sba-showcase-slide')?.classList.contains('is-active');
            if (isFocused && !isStaticFx) video.play().catch(() => {});
            else video.pause();
        });

        homeGrid.querySelectorAll('video[data-sba-static-frame]').forEach((video) => {
            video.addEventListener('loadedmetadata', () => {
                if (Number.isFinite(video.duration) && video.duration > 0) video.currentTime = video.duration / 2;
            }, { once: true });
        });

        homeGrid._advanceSbaShowcase = (amount) => {
            if (!amount || homeGrid.dataset.sbaShowcaseChanging === 'true') return;
            homeGrid.dataset.sbaShowcaseChanging = 'true';
            const update = () => {
                homeGrid.dataset.sbaShowcaseIndex = String(Number(homeGrid.dataset.sbaShowcaseIndex || 0) + amount);
                renderHomeShowcaseGrid();
            };

            // Animate just the outgoing/incoming focused card. Rebuilding the
            // carousel under a document View Transition snapshots the whole
            // page, which is what made the site blink on every card change.
            const direction = Math.sign(amount) || 1;
            const outgoingSlide = homeGrid.querySelector('.sba-showcase-slide.is-active');
            outgoingSlide?.animate([
                { opacity: 1, transform: 'translateX(-50%) scale(1)' },
                { opacity: 0, transform: `translateX(calc(-50% - ${direction * 18}px)) scale(.975)` }
            ], { duration: 105, easing: 'ease-in', fill: 'both' });
            homeGrid.querySelector('.sba-showcase-active-copy')?.animate([
                { opacity: 1, transform: 'translateY(0)' },
                { opacity: 0, transform: 'translateY(7px)' }
            ], { duration: 95, easing: 'ease-in', fill: 'both' });

            window.setTimeout(() => {
                update();
                const incomingSlide = homeGrid.querySelector('.sba-showcase-slide.is-active');
                incomingSlide?.animate([
                    { opacity: 0, transform: `translateX(calc(-50% + ${direction * 18}px)) scale(.975)` },
                    { opacity: 1, transform: 'translateX(-50%) scale(1)' }
                ], { duration: 300, easing: 'cubic-bezier(.22,.82,.2,1)', fill: 'both' });
                homeGrid.querySelector('.sba-showcase-active-copy')?.animate([
                    { opacity: 0, transform: 'translateY(7px)' },
                    { opacity: 1, transform: 'translateY(0)' }
                ], { duration: 300, delay: 45, easing: 'cubic-bezier(.22,.82,.2,1)', fill: 'both' });
                window.setTimeout(() => {
                    homeGrid.dataset.sbaShowcaseChanging = 'false';
                }, 300);
            }, 105);
        };

        // Bind the preview cards themselves, rather than relying only on the
        // carousel's delegated listener. This keeps their focus action ahead
        // of their anchor navigation and makes a left/right-card click always
        // bring that exact preview to center.
        homeGrid.querySelectorAll('.sba-showcase-slide:not(.is-active)').forEach((slide) => {
            slide.addEventListener('click', (event) => {
                const offset = Number(slide.dataset.sbaShowcaseOffset || 0);
                if (!offset) return;
                event.preventDefault();
                event.stopPropagation();
                homeGrid._advanceSbaShowcase?.(offset);
            });
        });

        // The focused card redirects to its page. Bound directly on the
        // anchor (not only delegated) so the navigation survives overlay
        // or re-render timing edge cases. Re-bound every render because
        // the carousel rebuilds its slides.
        homeGrid.querySelector('.sba-showcase-slide.is-active')?.addEventListener('click', (event) => {
            const anchor = event.currentTarget;
            const destination = anchor?.getAttribute?.('href') || '';
            if (!destination || destination === '#') return;
            event.preventDefault();
            event.stopPropagation();
            window.location.href = anchor.href;
        });

        if (!homeGrid.dataset.sbaShowcaseBound) {
            homeGrid.dataset.sbaShowcaseBound = 'true';
            homeGrid.addEventListener('click', (event) => {
                const dot = event.target.closest('[data-sba-showcase-index]');
                if (dot) {
                    event.preventDefault();
                    const targetIndex = Number(dot.dataset.sbaShowcaseIndex);
                    const currentIndex = Number(homeGrid.dataset.sbaShowcaseIndex || 0);
                    if (Number.isFinite(targetIndex) && targetIndex !== currentIndex) {
                        homeGrid._advanceSbaShowcase?.(targetIndex - currentIndex);
                    }
                    return;
                }
                const slide = event.target.closest('.sba-showcase-slide');
                if (slide && !slide.classList.contains('is-active')) {
                    event.preventDefault();
                    homeGrid._advanceSbaShowcase?.(Number(slide.dataset.sbaShowcaseOffset || 0));
                    return;
                }
                const activeSlide = event.target.closest('.sba-showcase-slide.is-active');
                if (activeSlide) {
                    const destination = activeSlide.getAttribute('href') || '';
                    if (destination && destination !== '#') {
                        event.preventDefault();
                        window.location.href = activeSlide.href;
                    }
                    return;
                }
                const button = event.target.closest('[data-sba-showcase-step]');
                const nextOffset = Number(button?.dataset.sbaShowcaseStep || 0);
                if (nextOffset) {
                    event.preventDefault();
                    homeGrid._advanceSbaShowcase?.(nextOffset);
                }
            });
            homeGrid.addEventListener('mouseenter', () => { homeGrid._sbaShowcasePaused = true; });
            homeGrid.addEventListener('mouseleave', () => { homeGrid._sbaShowcasePaused = false; });
            homeGrid.addEventListener('touchstart', (event) => {
                homeGrid._sbaShowcaseTouchStart = event.touches[0]?.clientX || 0;
                homeGrid._sbaShowcasePaused = true;
            }, { passive: true });
            homeGrid.addEventListener('touchend', (event) => {
                const startX = Number(homeGrid._sbaShowcaseTouchStart || 0);
                const distance = (event.changedTouches[0]?.clientX || startX) - startX;
                homeGrid._sbaShowcasePaused = false;
                if (Math.abs(distance) > 45) homeGrid._advanceSbaShowcase?.(distance < 0 ? 1 : -1);
            }, { passive: true });
            homeGrid.addEventListener('keydown', (event) => {
                if (event.key === 'ArrowLeft') { event.preventDefault(); homeGrid._advanceSbaShowcase?.(-1); }
                if (event.key === 'ArrowRight') { event.preventDefault(); homeGrid._advanceSbaShowcase?.(1); }
            });
        }
        if (!homeGrid._sbaShowcaseAutoTimer) {
            homeGrid._sbaShowcaseAutoTimer = window.setInterval(() => {
                if (!document.hidden && !homeGrid._sbaShowcasePaused && document.body.classList.contains('theme-sba') && currentHubView === 'home') {
                    homeGrid._advanceSbaShowcase?.(1);
                }
            }, 7000);
        }
        return;
    }

    homeGrid.classList.remove('sba-showcase-carousel');

    // Quadruple cards for an expansive buffer and seamless infinite loop
    const displayList = [...baseList, ...baseList, ...baseList, ...baseList];

    unmountHubLightningVideos(homeGrid);
    unmountSbaLrLwfEffects(homeGrid);
    homeGrid.innerHTML = displayList.map(item => generateCardHtml(item, false)).join('\n');
    applyLinkedCardEffects(homeGrid, displayList);
    mountHubLightningVideos(homeGrid);
    mountSbaLrLwfEffects(homeGrid);
    homeGrid.dataset.setLength = String(baseList.length);

    const measureAndAttach = () => {
        const cards = homeGrid.querySelectorAll('.char-box');
        if (cards.length >= baseList.length * 2 && cards[baseList.length]) {
            const r0 = cards[0].getBoundingClientRect();
            const rN = cards[baseList.length].getBoundingClientRect();
            const trueDistance = Math.round(rN.left - r0.left);
            if (trueDistance > 50) {
                homeGrid.dataset.singleSetWidth = String(trueDistance);
            }
        }
        if (window.attachSmoothHorizontalScroll) {
            window.attachSmoothHorizontalScroll(homeGrid, 0.28);
        }
    };
    setTimeout(measureAndAttach, 60);
    setTimeout(measureAndAttach, 300);
}

function filterCards(resetPage = true) {
    if (currentHubView === 'home') {
        renderTimelineView();
        renderHomeShowcaseGrid();
        return;
    }

    if (resetPage) currentPage = 1;

    const selectedType = document.getElementById('typeFilter')?.value || currentInlineType || 'all';
    const selectedRarity = document.getElementById('rarityFilter')?.value || currentInlineRarity || 'all';
    const selectedCategories = categoryDefinitions.filter(category => selectedCategoryFilters.has(category.id));

    filteredCardItems = allCardItems.filter(item => {
        const matchesSource = (currentSourceFilter === 'all' || item.source === currentSourceFilter);
        const matchesType = (selectedType === 'all' || item.type === selectedType);
        const matchesRarity = (selectedRarity === 'all' || item.rarity === selectedRarity);
        const itemCategoryIds = (Array.isArray(item.categoryIds) ? item.categoryIds : []).map(String);
        const itemCategoryNames = normalizeCategoryNames(item.categoryNames);
        // Multiple category chips use OR matching: a card appears when it
        // belongs to at least one selected category.
        const matchesCategory = selectedCategories.length === 0 || selectedCategories.some(category =>
            itemCategoryIds.includes(category.id) ||
            itemCategoryNames.includes(category.name.toLocaleLowerCase())
        );
        const matchesKoScreen = !requireKoScreen ||
            (item.source === 'official' && koScreenCardIds.has(String(item.id)));

        let matchesSearch = true;
        if (searchQuery.length > 0) {
            const nameMatch = (item.name || '').toLowerCase().includes(searchQuery);
            const idMatch = String(item.id || '').toLowerCase().includes(searchQuery);
            matchesSearch = nameMatch || idMatch;
        }

        return matchesSource && matchesType && matchesRarity && matchesCategory && matchesKoScreen && matchesSearch;
    });
    filteredCardItems = arrangeLinkedCardsForDisplay(filteredCardItems);

    renderCurrentPage();
}

function getCardDisplayUnits(cards) {
    if (!cards || !cards.length) return [];
    const isSbaCollapsed = document.body.classList.contains('theme-sba') && currentCardsLayout !== 'dokkan';
    if (!isSbaCollapsed) {
        return cards.map(c => [c]);
    }

    const units = [];
    let groupStart = 0;
    while (groupStart < cards.length) {
        let groupEnd = groupStart;
        while (groupEnd + 1 < cards.length) {
            const relationship = getAdjacentCardRelationship(cards[groupEnd], cards[groupEnd + 1]);
            if (!relationship) break;
            groupEnd += 1;
        }

        const group = [];
        for (let i = groupStart; i <= groupEnd; i += 1) {
            group.push(cards[i]);
        }
        units.push(group);
        groupStart = groupEnd + 1;
    }
    return units;
}

function renderCurrentPage() {
    const cardsPerPage = getCardsPerPage();
    const displayUnits = getCardDisplayUnits(filteredCardItems);
    const totalPages = Math.max(1, Math.ceil(displayUnits.length / cardsPerPage));
    if (currentPage > totalPages) currentPage = totalPages;

    const startIndex = (currentPage - 1) * cardsPerPage;
    const endIndex = startIndex + cardsPerPage;
    const pageUnits = displayUnits.slice(startIndex, endIndex);
    const pageSlice = pageUnits.flat();

    const grid = document.getElementById('cardGrid');
    if (!grid) return;

    if (pageSlice.length === 0) {
        unmountHubLightningVideos(grid);
        unmountSbaLrLwfEffects(grid);
        grid.innerHTML = `<div style="grid-column: 1/-1; padding: 50px 20px; color: #94a3b8; font-weight: 800; font-size: 15px;">No cards found matching your search.</div>`;
    } else {
        unmountHubLightningVideos(grid);
        unmountSbaLrLwfEffects(grid);
        const useCssBadges = currentCardsLayout !== 'dokkan';
        const cardsHtml = pageSlice.map(item => generateCardHtml(item, useCssBadges)).join('\n');
        grid.innerHTML = cardsHtml;
        applyLinkedCardEffects(grid, pageSlice);
        mountHubLightningVideos(grid);
        mountSbaLrLwfEffects(grid);
        mountGridSezaFlames();
        checkAndEnableTextScrolling();
    }

    renderPaginationControls(totalPages);
    requestAnimationFrame(() => setTimeout(syncSbaBottomNavVisibility, 40));
}

function renderPaginationControls(totalPages) {
    const topContainer = document.getElementById('paginationTop');
    const bottomContainer = document.getElementById('paginationBottom');

    if (bottomContainer) bottomContainer.innerHTML = '';

    if (totalPages <= 1) {
        const singlePageHtml = `
        <div class="hub-pagination-control">
            <span class="hub-page-status">1 of 1</span>
        </div>`;
        if (topContainer) topContainer.innerHTML = singlePageHtml;
        return;
    }

    const html = `
    <div class="hub-pagination-control">
        <button type="button" aria-label="prev" class="hub-page-nav-btn" onclick="changePage(-1)" ${currentPage <= 1 ? 'disabled' : ''}>
            <svg width="22" height="22" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.499 12.85a.9.9 0 0 1 .57.205l.067.06a.9.9 0 0 1 .06 1.206l-.06.066-5.585 5.586-.028.027.028.027 5.585 5.587a.9.9 0 0 1 .06 1.207l-.06.066a.9.9 0 0 1-1.207.06l-.066-.06-6.25-6.25a1 1 0 0 1-.158-.212l-.038-.08a.9.9 0 0 1-.03-.606l.03-.083a1 1 0 0 1 .137-.226l.06-.066 6.25-6.25a.9.9 0 0 1 .635-.263Z" fill="currentColor" stroke="currentColor" stroke-width=".078"/>
            </svg>
        </button>

        <span class="hub-page-status">${currentPage} of ${totalPages}</span>

        <button type="button" aria-label="next" class="hub-page-nav-btn" onclick="changePage(1)" ${currentPage >= totalPages ? 'disabled' : ''}>
            <svg class="flip-right" width="22" height="22" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.499 12.85a.9.9 0 0 1 .57.205l.067.06a.9.9 0 0 1 .06 1.206l-.06.066-5.585 5.586-.028.027.028.027 5.585 5.587a.9.9 0 0 1 .06 1.207l-.06.066a.9.9 0 0 1-1.207.06l-.066-.06-6.25-6.25a1 1 0 0 1-.158-.212l-.038-.08a.9.9 0 0 1-.03-.606l.03-.083a1 1 0 0 1 .137-.226l.06-.066 6.25-6.25a.9.9 0 0 1 .635-.263Z" fill="currentColor" stroke="currentColor" stroke-width=".078"/>
            </svg>
        </button>
    </div>`;

    if (topContainer) topContainer.innerHTML = html;
    if (bottomContainer && !document.body.classList.contains('theme-sba')) {
        bottomContainer.innerHTML = html;
    }
}

function changePage(delta) {
    const displayUnits = getCardDisplayUnits(filteredCardItems);
    const totalPages = Math.max(1, Math.ceil(displayUnits.length / getCardsPerPage()));
    const newPage = currentPage + delta;

    if (newPage >= 1 && newPage <= totalPages) {
        currentPage = newPage;
        renderCurrentPage();
        const cardsTop = document.querySelector('.hub-cards-view')?.offsetTop || 0;
        window.scrollTo({ top: cardsTop - 20, behavior: 'smooth' });
    }
}

function resetFilters() {
    resetAllInlineFilters();
}

function parseReleaseTime(dateValue) {
    // The editor accepts several human-friendly date formats (for example
    // "9/14/2026 1:00:00 AM EDT"), so do not force every value into ISO.
    // Doing that made valid custom-card release dates turn into Invalid Date
    // and caused those cards to be omitted from the timeline.
    const dateStr = String(dateValue || '').replace(/\u00a0/g, ' ').trim();
    if (!dateStr || /^tbd$/i.test(dateStr)) return 0;

    const dokkanMinEpoch = new Date('2015-01-30T00:00:00Z').getTime();
    const isUsable = (time) => Number.isFinite(time) && time >= dokkanMinEpoch;

    const nativeTime = Date.parse(dateStr);
    if (isUsable(nativeTime)) return nativeTime;

    // Saved card markup can contain labels around the date. Extract the two
    // date-only formats the editor and imported cards commonly produce.
    const ymdMatch = dateStr.match(/\b(\d{4})[./-](\d{1,2})[./-](\d{1,2})\b/);
    if (ymdMatch) {
        const [, year, month, day] = ymdMatch;
        const time = Date.UTC(Number(year), Number(month) - 1, Number(day), 12);
        if (isUsable(time)) return time;
    }

    const mdyMatch = dateStr.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/);
    if (mdyMatch) {
        const [, month, day, year] = mdyMatch;
        const time = Date.UTC(Number(year), Number(month) - 1, Number(day), 12);
        if (isUsable(time)) return time;
    }

    return 0;
}

async function fetchJsonWithFallback(filename) {
    const paths = [`json/${filename}`, filename, `./json/${filename}`, `./${filename}`];
    for (const p of paths) {
        try {
            const res = await fetch(p);
            if (res.ok) return await res.json();
        } catch (e) {}
    }
    return null;
}

async function loadKoScreenIndex() {
    if (koScreenIndexPromise) return koScreenIndexPromise;

    koScreenIndexPromise = (async () => {
        const rawIndex = await fetchJsonWithFallback('ko_screen_index.json');
        const cardIds = Array.isArray(rawIndex?.card_ids)
            ? rawIndex.card_ids
            : Object.keys(rawIndex?.cards || {});
        koScreenCardIds = new Set(cardIds.map((cardId) => String(cardId)));
        return koScreenCardIds;
    })().catch((error) => {
        console.warn('Could not load the KO screen filter index:', error);
        koScreenCardIds = new Set();
        return koScreenCardIds;
    });

    return koScreenIndexPromise;
}

async function loadOfficialDatabaseCards() {
    try {
        const [rawCards, rawRoutes, rawPassives, rawActiveSkills, unitProvenance, rawCategories] = await Promise.all([
            fetchJsonWithFallback('cards.json'),
            fetchJsonWithFallback('awakening_routes.json'),
            fetchJsonWithFallback('passive_skills.json'),
            fetchJsonWithFallback('active_skills.json'),
            fetchJsonWithFallback('unit-provenance.json'),
            fetchJsonWithFallback('card_categories.json')
        ]);

        if (!rawCards) return [];
        setCategoryDefinitions(rawCategories);

        const unawakenedSourceCardIds = new Set();
        const cardEzaRouteDates = new Map();
        const cardSezaRouteDates = new Map();
        const cardDokkanRouteDates = new Map();

        if (rawRoutes && Array.isArray(rawRoutes)) {
            rawRoutes.forEach(r => {
                const srcId = parseInt(r.card_id, 10);
                const targetId = parseInt(r.awaked_card_id, 10);
                const rType = String(r.type || '');
                const optType = r.optimal_awakening_type;
                const dt = r.open_at || r.start_at;
                const parsedT = parseReleaseTime(dt);

                if (srcId && targetId && srcId !== targetId && (rType.includes('Dokkan') || rType.includes('Zet'))) {
                    unawakenedSourceCardIds.add(srcId);
                }

                if (parsedT > 0) {
                    const normSrc = srcId > 10000000 ? Math.floor(srcId / 10) : srcId;
                    const normTgt = targetId > 10000000 ? Math.floor(targetId / 10) : targetId;

                    if (optType === 2) {
                        cardSezaRouteDates.set(normSrc, Math.max(cardSezaRouteDates.get(normSrc) || 0, parsedT));
                        cardSezaRouteDates.set(normTgt, Math.max(cardSezaRouteDates.get(normTgt) || 0, parsedT));
                    } else if (optType === 1 || rType.includes('Optimal')) {
                        cardEzaRouteDates.set(normSrc, Math.max(cardEzaRouteDates.get(normSrc) || 0, parsedT));
                        cardEzaRouteDates.set(normTgt, Math.max(cardEzaRouteDates.get(normTgt) || 0, parsedT));
                    } else {
                        cardDokkanRouteDates.set(normTgt, Math.max(cardDokkanRouteDates.get(normTgt) || 0, parsedT));
                    }
                }
            });
        }

        const ezaMap = new Map();
        const sezaMap = new Map();
        const curatedDfeLrStems = new Set(
            Array.isArray(unitProvenance?.dfe_lr_stems) ? unitProvenance.dfe_lr_stems : []
        );
        const passiveMap = new Map((Array.isArray(rawPassives) ? rawPassives : Object.values(rawPassives || {}))
            .map(passive => [Number(passive.id), passive]));
        const activeSkillMap = new Map((Array.isArray(rawActiveSkills) ? rawActiveSkills : Object.values(rawActiveSkills || {}))
            .map(activeSkill => [Number(activeSkill.id), activeSkill]));

        rawCards.forEach(c => {
            const cid = parseInt(c.id, 10);
            if (c.is_seza || (String(cid).length >= 8 && String(cid).endsWith('9'))) {
                const pId = c.parent_id || Math.floor(cid / 10);
                sezaMap.set(pId, c);
                sezaMap.set(cid, c);
                sezaMap.set(Math.floor(cid / 10), c);
            } else if (c.is_eza || (String(cid).length >= 8 && String(cid).endsWith('8'))) {
                const pId = c.parent_id || Math.floor(cid / 10);
                ezaMap.set(pId, c);
                ezaMap.set(cid, c);
                ezaMap.set(Math.floor(cid / 10), c);
            }
        });

        const hubCards = rawCards.filter(c => {
            const rawId = parseInt(c.id, 10);
            if (String(rawId).length >= 8) return false;
            if (rawId < 4000000 && unawakenedSourceCardIds.has(rawId)) return false;
            return true;
        });

        const nowPlus30Days = Date.now() + (30 * 24 * 60 * 60 * 1000);

        return hubCards.map(c => {
            const rawId = parseInt(c.id, 10);
            const parentId = c.parent_id || getCardParentId(rawId);
            const parentCard = rawCards.find(p => parseInt(p.id, 10) === parentId);
            const { cardClass, cardType } = getCardClassAndType(c.element !== undefined ? c.element : 0);

            let rarityKey = 'tur';
            if (c.rarity === 5 || c.max_level === 150 || (parentCard && parentCard.rarity === 5)) {
                rarityKey = 'lr';
            } else if (c.rarity === 3) {
                rarityKey = 'ssr';
            }

            let baseTime = cardDokkanRouteDates.get(parentId) || cardDokkanRouteDates.get(rawId) || parseReleaseTime(c.open_at || c.start_at || c.release_date);
            const ezaCard = ezaMap.get(parentId) || ezaMap.get(rawId) || ezaMap.get(rawId * 10 + 8);
            let ezaTime = cardEzaRouteDates.get(parentId) || cardEzaRouteDates.get(rawId) || (ezaCard ? parseReleaseTime(ezaCard.open_at || ezaCard.start_at) : 0);
            const sezaCard = sezaMap.get(parentId) || sezaMap.get(rawId) || sezaMap.get(rawId * 10 + 9);
            let sezaTime = cardSezaRouteDates.get(parentId) || cardSezaRouteDates.get(rawId) || (sezaCard ? parseReleaseTime(sezaCard.open_at || sezaCard.start_at) : 0);

            const hasSeza = !!sezaCard || sezaTime > 0 || c.is_seza === true;
            const hasEza = !!ezaCard || ezaTime > 0 || hasSeza || c.is_eza === true;
            const isFuture = (baseTime > nowPlus30Days || ezaTime > nowPlus30Days || sezaTime > nowPlus30Days);
            const passive = passiveMap.get(Number(c.pass_id));
            const activeSkill = activeSkillMap.get(Number(c.active_id));
            const passiveText = [
                passive?.itemized_description,
                passive?.sougou_only_itemized_description,
                passive?.kobetu_only_itemized_description
            ].filter(Boolean).join(' ');
            const activeText = [activeSkill?.name, activeSkill?.effect_description, activeSkill?.condition_description]
                .filter(Boolean).join(' ');
            const mechanicsText = `${passiveText} ${activeText}`;
            const isReversibleExchange = /reversible exchange/i.test(passiveText);
            const isTemporaryTransformation = Boolean(c.standby_id) ||
                (Array.isArray(c.finish_ids) && c.finish_ids.length > 0) ||
                /\b(?:rages?|turns? into (?:giant form|giant ape)|(?:exchange|switch)(?:s|es)? with.{0,80}for \d+ turns?)\b/i.test(mechanicsText);
            const transformsAfterTemporaryEnds = /\bwhen (?:giant ape|giant form) transformation ends\b[\s\S]{0,240}\btransforms? into\b/i.test(mechanicsText);
            const cardStem = Math.floor((rawId > 10000000 ? Math.floor(rawId / 10) : rawId) / 10);
            const isCuratedDfeLr = rarityKey === 'lr' && curatedDfeLrStems.has(cardStem);

            let effectiveTime = Math.max(
                baseTime < nowPlus30Days ? baseTime : 0,
                ezaTime < nowPlus30Days ? ezaTime : 0,
                sezaTime < nowPlus30Days ? sezaTime : 0
            );

            if (effectiveTime === 0 && !isFuture) effectiveTime = parentId;

            return {
                id: c.id,
                parentId: parentId,
                characterId: c.character_id,
                name: c.name,
                source: 'official',
                type: cardType,
                rarity: rarityKey,
                categoryIds: (Array.isArray(c.categories) ? c.categories : []).map(categoryId => String(categoryId)),
                element: c.element,
                cardClass: cardClass,
                summonBrand: isCuratedDfeLr ? 'festival' : getSummonBrand(c.tag),
                sortTime: effectiveTime,
                isFuture: isFuture,
                isEza: hasEza,
                isSeza: hasSeza,
                isReversibleExchange,
                isTemporaryTransformation,
                transformsAfterTemporaryEnds
            };
        });
    } catch (err) {
        console.warn("Could not load cards.json:", err);
        return [];
    }
}

async function loadCustomCards() {
    const cachedCustom = localStorage.getItem('hub_cached_custom_only');
    let customCardsArray = [];
    if (cachedCustom) {
        try { customCardsArray = JSON.parse(cachedCustom); } catch(e) {}
    }

    try {
        const repoRes = await fetch('https://api.github.com/repos/abscustom/abscustom.github.io/contents/');
        if (!repoRes.ok) return customCardsArray;

        const contents = await repoRes.json();
        const ignored = ['DokkanCustom', 'CardEditor', 'Custom Cards', 'images', 'css', 'js', 'js2', 'assets', 'json', '.github'];
        const cardFolders = contents.filter(item => 
            item.type === 'dir' && !ignored.includes(item.name) && !item.name.startsWith('.')
        ).map(item => ({ name: item.name, repoPath: item.name }));
        const groupedFolder = contents.find(item => item.type === 'dir' && item.name === 'Custom Cards');
        if (groupedFolder) {
            const groupedRes = await fetch(groupedFolder.url);
            if (groupedRes.ok) {
                const groupedItems = await groupedRes.json();
                groupedItems
                    .filter(item => item.type === 'dir' && !item.name.startsWith('.'))
                    .forEach(item => cardFolders.push({ name: item.name, repoPath: `Custom Cards/${item.name}` }));
            }
        }

        const freshCards = [];

        for (const folder of cardFolders) {
            try {
                const folderName = folder.name;
                const encodedPath = folder.repoPath.split('/').map(encodeURIComponent).join('/');
                const cardUrl = `https://abscustom.github.io/${encodedPath}/`;
                const rawUrl = `https://raw.githubusercontent.com/abscustom/abscustom.github.io/main/${encodedPath}/index.html`;
                
                const indexRes = await fetch(rawUrl);
                if (!indexRes.ok) continue;

                const htmlText = await indexRes.text();
                const doc = new DOMParser().parseFromString(htmlText, 'text/html');

                let cardData = null;
                const embeddedJson = doc.querySelector('#card-data')?.textContent;
                if (embeddedJson) {
                    try { cardData = JSON.parse(embeddedJson); } catch (e) {}
                }
                if (!cardData) {
                    try {
                        const cardDataRes = await fetch(`https://raw.githubusercontent.com/abscustom/abscustom.github.io/main/${encodedPath}/card.json`, { cache: 'no-store' });
                        if (cardDataRes.ok) cardData = await cardDataRes.json();
                    } catch (e) {}
                }

                let charName = cardData?.inputs?.nameInput || doc.querySelector('#char-name')?.textContent?.trim() || '';
                if (!charName) {
                    const rawTitle = doc.querySelector('title')?.textContent || folderName;
                    charName = rawTitle.replace(/^\[.*?\]\s*/, '').trim();
                }

                const fixUrl = (src, fallback) => {
                    if (!src) return fallback;
                    if (src.startsWith('http')) return src;
                    return `${cardUrl}${src.replace(/^\.\//, '')}`;
                };

                const rarityAttr = doc.querySelector('#main-rarity-icon')?.getAttribute('src') || '';
                const detectedRarity = cardData?.currentRarity ? cardData.currentRarity.toLowerCase() : (rarityAttr.toLowerCase().includes('lr') ? 'lr' : (rarityAttr.toLowerCase().includes('ssr') ? 'ssr' : 'tur'));
                const rarityKey = detectedRarity || 'tur';
                const isLR = rarityKey === 'lr';
                const isSSR = rarityKey === 'ssr';

                const iconEl = doc.querySelector(isLR ? '#img-lr' : (isSSR ? '#img-ssr' : '#img-tur')) || doc.querySelector('#abs-thumb-img');
                // Filter out default placeholder icons — if the creator didn't upload a custom icon,
                // the stored src is SSR_Icon.png / TUR_Icon.png / LR_Icon.png. Prefer the card-art
                // image as the showcase thumb over a generic placeholder.
                const isPlaceholderSrc = (src) => /\/(SSR|TUR|LR)_Icon\.png/i.test(src || '');
                const rawIconCandidates = [
                    cardData?.thumbMain,
                    isLR ? cardData?.thumbLr : (isSSR ? cardData?.thumbSsr : cardData?.thumbTur),
                    iconEl?.getAttribute('src')
                ];
                const rawIcon = rawIconCandidates.find(s => s && !isPlaceholderSrc(s)) || rawIconCandidates.find(Boolean);
                const charImgSrc = fixUrl(rawIcon, `${CENTRAL_ASSET_URL}SSR_Icon.png`);

                // The SBA showcase is art-led. Read the published art layers
                // rather than using the header thumbnail as its hero image.
                const rawCardArtImage = cardData?.cardArtImage || [
                    doc.querySelector('#myOverlayImage')?.getAttribute('src'),
                    doc.querySelector('#abs-art-img')?.getAttribute('src'),
                    doc.querySelector('.card-art-canvas img')?.getAttribute('src')
                ].find(src => src && !/Card(?:%20| )Art(?:%20| )Template\.png/i.test(src)) || '';
                const rawCardArtVideo = cardData?.cardArtVideo || doc.querySelector('#myOverlayVideo source')?.getAttribute('src') ||
                    doc.querySelector('#myOverlayVideo')?.getAttribute('src') ||
                    doc.querySelector('video.card-art-canvas source')?.getAttribute('src') || '';
                const cardArtImageUrl = rawCardArtImage ? fixUrl(rawCardArtImage, '') : '';
                const cardArtVideoUrl = rawCardArtVideo ? fixUrl(rawCardArtVideo, '') : '';

                const frameAttr = doc.querySelector('.card-frame')?.getAttribute('src') || '';
                const typeImgAttr = doc.querySelector('.typing-icon')?.getAttribute('src') || '';
                
                let cardClass = cardData?.currentClass ? cardData.currentClass.toLowerCase() : (typeImgAttr.includes('extreme') ? 'extreme' : 'super');
                let cardType = cardData?.currentType ? cardData.currentType.toLowerCase() : 'agl';
                if (!cardData?.currentType) {
                    if (frameAttr.includes('teq')) cardType = 'teq';
                    else if (frameAttr.includes('int')) cardType = 'int';
                    else if (frameAttr.includes('str')) cardType = 'str';
                    else if (frameAttr.includes('phy')) cardType = 'phy';
                }

                // card.json contains the exact Release Date entered in the
                // editor. It is the source of truth for a custom card's place
                // on the timeline; a GitHub upload date is never used here.
                let dateText = cardData?.inputs?.dateInput || cardData?.inputs?.releaseDate || cardData?.releaseDate || cardData?.release_date || '';
                let unitTag = cardData?.inputs?.absUnitTag || cardData?.absUnitTag || cardData?.unitTag || '';

                if (!dateText) {
                    dateText = doc.querySelector('#dateInput')?.getAttribute('value') || doc.querySelector('#dateInput')?.value || '';
                }
                if (!unitTag) {
                    unitTag = doc.querySelector('#abs-art-header-text')?.textContent?.trim() || '';
                }
                if (!dateText) {
                    // Keep the whole panel text: parseReleaseTime can extract
                    // a labelled date such as "Release Date 9/14/2026".
                    dateText = doc.querySelector('#release-dates-container')?.textContent || '';
                }
                const parsedTime = parseReleaseTime(String(dateText));
                const linkedCardReferences = Array.from(doc.querySelectorAll(
                    '#forms-container [data-admin-linked-slug], #forms-container .form-link[href], #abs-transformations-container .abs-transform-link[href]'
                )).map(node => (
                    node.getAttribute('data-admin-linked-slug') || node.getAttribute('href') || ''
                )).filter(Boolean);

                const isEzaCustom = htmlText.includes('eza_abs.png') || htmlText.includes('eza_img.png');
                const isSezaCustom = htmlText.includes('superza_abs.png') || htmlText.includes('supereza_img.png');
                const isReversibleExchange = /reversible exchange/i.test(htmlText);
                const isTemporaryTransformation = /\b(?:rages?|turns? into (?:giant form|giant ape)|(?:exchange|switch)(?:s|es)? with.{0,80}for \d+ turns?)\b/i.test(htmlText);
                const transformsAfterTemporaryEnds = /\bwhen (?:giant ape|giant form) transformation ends\b[\s\S]{0,240}\btransforms? into\b/i.test(htmlText);
                const categoryNames = Array.from(doc.querySelectorAll(
                    '#card-category-container [data-category-name], #abs-category-container [data-category-name]'
                )).map(node => node.dataset.categoryName || '').filter(Boolean);

                freshCards.push({
                    id: folderName,
                    repoPath: folder.repoPath,
                    name: charName,
                    source: 'custom',
                    type: cardType,
                    rarity: rarityKey,
                    categoryNames,
                    cardUrl: cardUrl,
                    thumbUrl: charImgSrc,
                    cardArtImageUrl,
                    cardArtVideoUrl,
                    cardClass: cardClass,
                    summonBrand: getSummonBrand(unitTag),
                    sortTime: parsedTime,
                    releaseDate: String(dateText || '').trim(),
                    linkedCardReferences,
                    isFuture: false,
                    isEza: isEzaCustom,
                    isSeza: isSezaCustom,
                    isReversibleExchange,
                    isTemporaryTransformation,
                    transformsAfterTemporaryEnds
                });
            } catch (e) {}
        }

        if (freshCards.length > 0) {
            customCardsArray = freshCards;
            try { localStorage.setItem('hub_cached_custom_only', JSON.stringify(freshCards)); } catch(e) {}
        }

        return customCardsArray;
    } catch (e) {
        return customCardsArray;
    }
}

async function updateCharacterBox() {
    const btn = document.getElementById('update-box-btn');
    const originalText = btn ? btn.innerHTML : "";

    try {
        if (btn) {
            btn.innerHTML = `<span class="spinning">🔄</span> Syncing...`;
            btn.style.pointerEvents = 'none';
        }

        const [officialCards, customCards] = await Promise.all([
            loadOfficialDatabaseCards(),
            loadCustomCards(),
            loadKoScreenIndex()
        ]);

        const merged = [...officialCards, ...customCards];

        merged.sort((a, b) => {
            if (a.isFuture && !b.isFuture) return 1;
            if (!a.isFuture && b.isFuture) return -1;
            if (b.sortTime !== a.sortTime) return b.sortTime - a.sortTime;
            
            const parentA = a.parentId || getCardParentId(a.id);
            const parentB = b.parentId || getCardParentId(b.id);
            if (parentB !== parentA) {
                const pNumA = parseInt(parentA, 10) || 0;
                const pNumB = parseInt(parentB, 10) || 0;
                if (pNumB !== pNumA) return pNumB - pNumA;
            }

            const isTransA = typeof a.id === 'number' && a.id >= 4000000;
            const isTransB = typeof b.id === 'number' && b.id >= 4000000;
            if (isTransA !== isTransB) return isTransA ? 1 : -1;

            const numA = parseInt(a.id, 10) || 0;
            const numB = parseInt(b.id, 10) || 0;
            if (numA !== numB) return numA - numB;

            return String(a.id).localeCompare(String(b.id), undefined, { numeric: true });
        });

        allCardItems = merged;

        if (currentHubView === 'home') {
            renderTimelineView();
            renderHomeShowcaseGrid();
        } else {
            filterCards(true);
        }

    } catch (error) {
        console.error("Update Box Error:", error);
    } finally {
        if (btn) {
            btn.innerHTML = originalText;
            btn.style.pointerEvents = 'auto';
        }
        if (!window.absHomeContentReady) {
            window.absHomeContentReady = true;
            window.dispatchEvent(new Event('abs-home-content-ready'));
        }
    }
}

// ==========================================================================
// DOKKAN STREAMERS: SINGLE SELECTABLE LIVE PREVIEW
// ==========================================================================

const DOKKAN_STREAMER_CHANNELS = [
    { twitch: 'theironcane', youtube: 'ironcane', displayName: 'Iron' },
    { twitch: 'datruthdt', youtube: 'datruthdt', displayName: 'DaTruthDT' },
    { twitch: 'toonrami', youtube: 'ToonRami', displayName: 'Toon' },
    { twitch: 'slaybix', youtube: 'slaybix', displayName: 'Slay' },
    { twitch: 'nanogenix', youtube: 'Nanogenix', displayName: 'Nano' },
    { youtube: 'Goresh', displayName: 'Goresh', youtubeOnly: true },
];

const MAX_SELECTED_STREAMERS = 4;
let selectedStreamerIndexes = [];
let latestStreamerData = DOKKAN_STREAMER_CHANNELS.map((streamer, originalIndex) => ({
    ...streamer,
    originalIndex,
    isLive: false,
    avatar: streamer.youtubeOnly ? `https://unavatar.io/youtube/${streamer.youtube}` : null,
}));

function renderSelectedStreamerPreview() {
    const preview = document.getElementById('streamersLivePreview');
    if (!preview) return;

    document.querySelectorAll('.streamer-card-pill[data-streamer-index]').forEach((pill) => {
        const isSelected = selectedStreamerIndexes.includes(Number(pill.dataset.streamerIndex));
        pill.classList.toggle('is-selected', isSelected);
        pill.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
    });

    const selectedStreamers = selectedStreamerIndexes
        .map((index) => latestStreamerData.find((item) => item.originalIndex === index))
        .filter(Boolean);

    if (selectedStreamers.length === 0) {
        preview.innerHTML = '';
        return;
    }

    const parent = encodeURIComponent(window.location.hostname || 'localhost');
    preview.innerHTML = selectedStreamers.map((streamer) => {
        const twitchUrl = streamer.twitch ? `https://www.twitch.tv/${streamer.twitch}` : '';
        const youtubeUrl = `https://www.youtube.com/@${streamer.youtube}`;
        const channelLinks = `
            <span class="streamer-preview-channel-links">
                ${twitchUrl ? `<a href="${twitchUrl}" target="_blank" rel="noopener noreferrer">Twitch ↗</a>` : ''}
                <a href="${youtubeUrl}" target="_blank" rel="noopener noreferrer">YouTube ↗</a>
            </span>`;

        if (streamer.youtubeOnly) {
            return `
                <article class="streamer-live-preview is-youtube-preview">
                    <div class="streamer-live-preview-heading">
                        <strong>${streamer.displayName}</strong>
                        ${channelLinks}
                    </div>
                    <a class="streamer-youtube-preview-link" href="${youtubeUrl}" target="_blank" rel="noopener noreferrer" aria-label="Open ${streamer.displayName} on YouTube">
                        <img src="${streamer.avatar || ''}" alt="${streamer.displayName}">
                        <span>Open YouTube channel ↗</span>
                    </a>
                </article>`;
        }

        const liveLabel = streamer.isLive
            ? '<span class="streamer-selected-live-label"><span class="live-dot"></span>LIVE NOW</span>'
            : '<span class="streamer-selected-live-label is-offline">OFFLINE</span>';

        return `
            <article class="streamer-live-preview">
                <div class="streamer-live-preview-heading">
                    <strong>${streamer.displayName}</strong>
                    ${liveLabel}
                    ${channelLinks}
                </div>
                <div class="streamer-player-shell">
                    <iframe src="https://player.twitch.tv/?channel=${encodeURIComponent(streamer.twitch)}&parent=${parent}&autoplay=true&muted=true" title="${streamer.displayName} Twitch stream" allow="autoplay; fullscreen" allowfullscreen loading="eager"></iframe>
                </div>
            </article>`;
    }).join('');
}

function toggleStreamerPreview(index) {
    const selectedPosition = selectedStreamerIndexes.indexOf(index);
    if (selectedPosition >= 0) {
        selectedStreamerIndexes.splice(selectedPosition, 1);
    } else {
        if (selectedStreamerIndexes.length >= MAX_SELECTED_STREAMERS) {
            selectedStreamerIndexes.shift();
        }
        selectedStreamerIndexes.push(index);
    }
    renderSelectedStreamerPreview();
}

// SBA uses the compact streamer strip as a direct channel launcher. The
// full ABS Home view keeps its existing selectable multi-player behaviour.
function handleStreamerPillClick(index) {
    if (currentAppStyle !== 'sba') {
        toggleStreamerPreview(index);
        return;
    }

    const streamer = latestStreamerData.find((item) => item.originalIndex === index)
        || DOKKAN_STREAMER_CHANNELS[index];
    if (!streamer) return;

    const channelUrl = streamer.youtubeOnly || !streamer.twitch
        ? `https://www.youtube.com/@${encodeURIComponent(streamer.youtube)}`
        : `https://www.twitch.tv/${encodeURIComponent(streamer.twitch)}`;
    window.open(channelUrl, '_blank', 'noopener,noreferrer');
}

function renderStreamerPills(streamerData) {
    const track = document.getElementById('streamersHorizontalTrack');
    if (!track) return;

    track.innerHTML = streamerData.map((streamer) => {
        const initial = streamer.displayName.charAt(0).toUpperCase();
        const avatarClass = `streamer-avatar-circle${streamer.youtubeOnly ? ' is-yt-avatar' : ''}`;
        const avatarHtml = streamer.avatar
            ? `<img src="${streamer.avatar}" alt="${streamer.displayName}" class="${avatarClass}" style="object-fit: cover;" onerror="this.outerHTML='<span class=\\'${avatarClass}\\'>${initial}</span>';">`
            : `<span class="${avatarClass}">${initial}</span>`;

        const statusBadge = streamer.youtubeOnly
            ? '<span class="streamer-live-status is-youtube">YOUTUBE</span>'
            : streamer.isLive
                ? '<span class="streamer-live-status is-live"><span class="live-dot"></span>LIVE</span>'
                : '<span class="streamer-live-status is-offline">OFFLINE</span>';
        const isSelected = selectedStreamerIndexes.includes(streamer.originalIndex);

        return `
            <button type="button" class="streamer-card-pill ${streamer.youtubeOnly ? 'is-youtube-pill' : ''} ${streamer.isLive ? 'live-pill-glow' : ''} ${isSelected ? 'is-selected' : ''}" data-streamer-index="${streamer.originalIndex}" onclick="handleStreamerPillClick(${streamer.originalIndex})" aria-label="Open ${streamer.displayName}'s ${streamer.youtubeOnly ? 'YouTube' : 'Twitch'} channel" aria-pressed="${isSelected}">
                ${avatarHtml}
                <span class="streamer-pill-name">${streamer.displayName}</span>
                ${statusBadge}
            </button>`;
    }).join('');

    renderSelectedStreamerPreview();
}

window.toggleStreamerPreview = toggleStreamerPreview;
window.handleStreamerPillClick = handleStreamerPillClick;

async function updateTwitchStreamersStatus() {
    const track = document.getElementById('streamersHorizontalTrack');
    if (!track) return;

    renderStreamerPills(latestStreamerData);

    try {
        const results = await Promise.allSettled(
            DOKKAN_STREAMER_CHANNELS.map(async (streamer, originalIndex) => {
                if (streamer.youtubeOnly) {
                    return {
                        ...streamer,
                        originalIndex,
                        isLive: false,
                        avatar: `https://unavatar.io/youtube/${streamer.youtube}`,
                    };
                }

                try {
                    const [uptimeRes, avatarRes] = await Promise.allSettled([
                        fetch(`https://decapi.me/twitch/uptime/${streamer.twitch}`).then((response) => response.text()),
                        fetch(`https://decapi.me/twitch/avatar/${streamer.twitch}`).then((response) => response.text()),
                    ]);

                    const uptimeText = (uptimeRes.status === 'fulfilled' ? uptimeRes.value : '').trim();
                    const avatarUrl = (avatarRes.status === 'fulfilled' ? avatarRes.value : '').trim();
                    const statusText = uptimeText.toLowerCase();
                    const isLive = Boolean(uptimeText)
                        && !statusText.includes('offline')
                        && !statusText.includes('not found')
                        && !statusText.includes('error');

                    return {
                        ...streamer,
                        originalIndex,
                        isLive,
                        uptime: isLive ? uptimeText : null,
                        avatar: avatarUrl.startsWith('http') ? avatarUrl : null,
                    };
                } catch (error) {
                    return { ...streamer, originalIndex, isLive: false, avatar: null };
                }
            }),
        );

        latestStreamerData = results.map((result, index) => result.status === 'fulfilled'
            ? result.value
            : { ...DOKKAN_STREAMER_CHANNELS[index], originalIndex: index, isLive: false, avatar: null });

        latestStreamerData.sort((first, second) => {
            if (first.isLive && !second.isLive) return -1;
            if (!first.isLive && second.isLive) return 1;
            return first.originalIndex - second.originalIndex;
        });

        renderStreamerPills(latestStreamerData);
    } catch (error) {
        console.warn('Streamers status check failed:', error);
    }
}

function initializeSbaLiquidGlass() {
    const displacementImage = document.getElementById('sba-liquid-displacement-map');
    if (displacementImage) {
        const size = 128;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext('2d', { willReadFrequently: false });
        const pixels = context?.createImageData(size, size);

        if (context && pixels) {
            for (let y = 0; y < size; y += 1) {
                for (let x = 0; x < size; x += 1) {
                    const nx = ((x + 0.5) / size - 0.5) * 2;
                    const ny = ((y + 0.5) / size - 0.5) * 2;
                    const radius = Math.min(1, Math.hypot(nx, ny));
                    const edge = Math.max(0, Math.min(1, (radius - 0.38) / 0.62));
                    const easedEdge = edge * edge * (3 - (2 * edge));
                    const inverseRadius = radius > 0.0001 ? 1 / radius : 0;
                    const offset = (y * size + x) * 4;

                    // R/G encode horizontal/vertical refraction. The vector
                    // points inward, producing a convex circular lens bezel.
                    pixels.data[offset] = Math.round(128 - (nx * inverseRadius * easedEdge * 112));
                    pixels.data[offset + 1] = Math.round(128 - (ny * inverseRadius * easedEdge * 112));
                    pixels.data[offset + 2] = 128;
                    pixels.data[offset + 3] = 255;
                }
            }
            context.putImageData(pixels, 0, 0);
            displacementImage.setAttribute('href', canvas.toDataURL('image/png'));
        }
    }

    const glassControls = document.querySelectorAll([
        '.hud-nav-link',
        '#sidebarDrawer .reset-btn',
    ].join(','));

    glassControls.forEach((control) => {
        control.addEventListener('pointermove', (event) => {
            if (!document.body.classList.contains('theme-sba')) return;
            const bounds = control.getBoundingClientRect();
            const x = ((event.clientX - bounds.left) / bounds.width) * 100;
            const y = ((event.clientY - bounds.top) / bounds.height) * 100;
            control.style.setProperty('--sba-glass-x', `${Math.max(0, Math.min(100, x))}%`);
            control.style.setProperty('--sba-glass-y', `${Math.max(0, Math.min(100, y))}%`);
        });

        control.addEventListener('pointerleave', () => {
            control.style.removeProperty('--sba-glass-x');
            control.style.removeProperty('--sba-glass-y');
        });
    });

    // The SBA navigation is one larger piece of glass. Keep its highlight tied
    // to the pointer so the light appears to travel beneath the icon buttons.
    document.querySelectorAll('.hud-nav-group').forEach((dock) => {
        dock.addEventListener('pointermove', (event) => {
            if (!document.body.classList.contains('theme-sba')) return;
            const bounds = dock.getBoundingClientRect();
            const x = ((event.clientX - bounds.left) / bounds.width) * 100;
            const y = ((event.clientY - bounds.top) / bounds.height) * 100;
            dock.style.setProperty('--sba-dock-x', `${Math.max(0, Math.min(100, x))}%`);
            dock.style.setProperty('--sba-dock-y', `${Math.max(0, Math.min(100, y))}%`);
        });

        dock.addEventListener('pointerleave', () => {
            dock.style.removeProperty('--sba-dock-x');
            dock.style.removeProperty('--sba-dock-y');
        });
    });
}

window.addEventListener('DOMContentLoaded', async () => {
    chooseHomeLogoVariant();
    initializeSbaLiquidGlass();
    setAppStyle(currentAppStyle);
    setCardsLayout(currentCardsLayout);
    // Inline handlers can be blocked by a strict page policy, so bind the
    // Cards Filters action directly. This also keeps its SBA popover behavior
    // independent from the legacy sidebar markup.
    document.getElementById('cardsAdvancedFilterBtn')?.addEventListener('click', (event) => {
        event.preventDefault();
        toggleSidebar();
    });
    document.addEventListener('pointerdown', (event) => {
        if (!document.body.classList.contains('theme-sba')) return;
        const popover = document.getElementById('sbaCardsFilterPopover');
        const trigger = document.getElementById('cardsAdvancedFilterBtn');
        if (popover?.classList.contains('is-open')) {
            if (!popover.contains(event.target) && !trigger?.contains(event.target)) {
                popover.classList.remove('is-open');
                popover.setAttribute('aria-hidden', 'true');
                trigger?.setAttribute('aria-expanded', 'false');
            }
        }
        const settingsDrawer = document.getElementById('settingsDrawer');
        const settingsBtn = document.getElementById('sba-side-settings-button');
        if (document.body.classList.contains('sba-side-settings-open') || settingsDrawer?.classList.contains('open')) {
            if (!settingsDrawer?.contains(event.target) && !settingsBtn?.contains(event.target)) {
                toggleSettingsDrawer();
            }
        }
    });
    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        const popover = document.getElementById('sbaCardsFilterPopover');
        if (popover?.classList.contains('is-open')) {
            popover.classList.remove('is-open');
            popover.setAttribute('aria-hidden', 'true');
            document.getElementById('cardsAdvancedFilterBtn')?.setAttribute('aria-expanded', 'false');
        }
        if (document.body.classList.contains('sba-side-settings-open')) {
            toggleSettingsDrawer();
        }
    });
    window.setInterval(refreshTimelineCountdowns, 1000);
    window.addEventListener('resize', () => {
        syncSbaBottomNavVisibility();
        if (document.body.classList.contains('sba-side-settings-open')) {
            positionSettingsMiniGui();
        }
    }, { passive: true });
    let sbaCardsResizeTimer = null;
    window.addEventListener('resize', () => {
        if (currentHubView === 'cards' && document.body.classList.contains('theme-sba')) {
            clearTimeout(sbaCardsResizeTimer);
            sbaCardsResizeTimer = setTimeout(renderCurrentPage, 100);
        }
    }, { passive: true });
    document.addEventListener('pointermove', (event) => {
        if (!document.body.classList.contains('theme-sba')) return;
        const nav = document.querySelector('.hud-nav-group');
        const isInsideNav = Boolean(nav?.contains(event.target));
        const isNearBottom = event.clientY >= window.innerHeight - 112;
        if (isNearBottom || isInsideNav) revealSbaBottomNav();
        else scheduleSbaBottomNavHide();
    }, { passive: true });

    // SBA panels are intentionally transient. Tracking the cursor relative to
    // the panel edge avoids the panel immediately closing during its own slide-in.
    document.addEventListener('mousemove', (event) => {
        if (!document.body.classList.contains('theme-sba')) return;
        const openedAt = Number(document.body.dataset.sbaPanelOpenedAt || 0);
        if (openedAt && Date.now() - openedAt < 350) return;

        const panel = document.body.classList.contains('sba-side-filters-open')
            ? ['sidebarDrawer', 'sba-side-filters-open', 'sba-side-filter-button']
            : null;
        if (!panel) return;

        const [drawerId, openClass, triggerId] = panel;
        const drawer = document.getElementById(drawerId);
        const dock = document.querySelector('.apple-hud-wrapper');
        if (!drawer) return;

        const drawerBounds = drawer.getBoundingClientRect();
        const dockBounds = dock?.getBoundingClientRect();
        const within = (bounds, padding = 0) => bounds
            && event.clientX >= bounds.left - padding
            && event.clientX <= bounds.right + padding
            && event.clientY >= bounds.top - padding
            && event.clientY <= bounds.bottom + padding;
        const inDrawer = within(drawerBounds, 8);
        const inDock = within(dockBounds, 8);
        const inPopoverBridge = dockBounds
            && event.clientX >= Math.min(drawerBounds.left, dockBounds.left) - 8
            && event.clientX <= Math.max(drawerBounds.right, dockBounds.right) + 8
            && event.clientY >= drawerBounds.bottom
            && event.clientY <= dockBounds.top;
        if (inDrawer || inDock || inPopoverBridge) return;

        document.body.classList.remove(openClass);
        delete document.body.dataset.sbaPanelOpenedAt;
        drawer.classList.remove('open');
        document.getElementById(triggerId)?.setAttribute('aria-expanded', 'false');
        if (drawerId === 'sidebarDrawer') {
            document.getElementById('cardsAdvancedFilterBtn')?.setAttribute('aria-expanded', 'false');
        }
    });
    
    setFxAnimationMode(currentFxMode);
    syncAdvancedFilterControls();

    const urlParams = new URLSearchParams(window.location.search);
    const viewParam = urlParams.get('view');
    const subParam = urlParams.get('sub');
    const newsSourceParam = urlParams.get('source');

    if (viewParam === 'news') {
        switchHubView('news', newsSourceParam || subParam || 'all');
    } else if (viewParam === 'cards' || localStorage.getItem('hub_force_cards_view') === 'true') {
        localStorage.removeItem('hub_force_cards_view');
        switchHubView('cards');
    }

    updateTwitchStreamersStatus();
    setInterval(updateTwitchStreamersStatus, 120000); // Auto-refresh live status every 2 minutes

    await updateCharacterBox();
});
