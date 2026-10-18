/* ============================================================
   DYNAMIC CUSTOM CARD BOOTSTRAPPER (DokkanCustom)
   Loads the latest shared viewer shell, CSS, and scripts
   while populating the card dynamically from card.json.
   ============================================================ */
(async function initCustomCardBootstrapper() {
    'use strict';

    document.title = '';

    // Resolve card-owned data before <base> redirects shared application assets.
    let cardFolderUrl = new URL('./', window.location.href).href;
    const runtimeVersion = '20260928-custom-no-motion-v1';
    const cleanPresentationVersion = '20261008-abs-clean-refresh-v2';
    const cleanLayoutRuntimeVersion = '40C02AFAED7EF69DB6C6B20B8503CF68C3542AF54E1754646CAF414ABF85D6E5';
    const viewerSettingsVersion = '20260927-clean-floating-motion-v11';

    // Older published cards were generated before the shared loader stylesheet
    // was emitted in their <head>.  Apply the small, first-paint contract before
    // any fetches so their raw logo never lays out in a document corner and then
    // jumps when loading-screen.css arrives.  New exports include the full sheet
    // directly in <head>; this is intentionally only a backwards-compatible
    // fallback for cards already on the site.
    function installCriticalLoaderStyles() {
        // The bootstrap can execute before body markup exists. Install the
        // complete canonical first-paint contract without querying that body.
        if (document.getElementById('abs-loader-critical-styles')) return;
        const style = document.createElement('style');
        style.id = 'abs-loader-critical-styles';
        style.dataset.loaderVersion = '20261007-stable-ring-v1';
        style.textContent = "/* One opaque cover, the existing ABS logo and a circular ring. */\n#abs-loading-screen {\n    position: fixed;\n    inset: 0;\n    z-index: 2147483647;\n    display: grid;\n    place-items: center;\n    overflow: hidden;\n    color: #fff;\n    background: #08090b;\n    opacity: 1;\n    visibility: visible;\n    pointer-events: auto;\n    transition: opacity 0.18s ease-out;\n}\n\nhtml.abs-page-loading,\nhtml.abs-page-loading body { overflow: hidden; }\nhtml { scrollbar-gutter: stable; }\n\n#abs-loading-screen.is-entering {\n    opacity: 0;\n    pointer-events: none;\n}\n#abs-loading-screen.is-navigating {\n    opacity: 1;\n    transition: none;\n}\n#abs-loading-screen.is-exiting {\n    opacity: 0;\n    pointer-events: none !important;\n    animation: abs-loader-exit-dissolve 0.18s cubic-bezier(0.22, 1, 0.36, 1) forwards !important;\n    transform: none !important;\n    filter: none !important;\n}\n#abs-loading-screen.is-hidden {\n    opacity: 0 !important;\n    visibility: hidden !important;\n    pointer-events: none !important;\n    display: none !important;\n}\n\n/* Already-published cards retain old decorative markup. Hide it from the\n   first CSS paint, before legacy restoration scripts can insert artwork. */\n#abs-loading-screen .abs-loader-bg-art,\n#abs-loading-screen .abs-loader-art-backdrop,\n#abs-loading-screen .abs-loader-bg-stars,\n#abs-loading-screen .abs-loader-bg-grid,\n#abs-loading-screen .abs-loader-bg-glass,\n#abs-loading-screen .abs-loader-art,\n#abs-loading-screen .abs-loader-percent,\n#abs-loading-screen .abs-loader-sub { display: none !important; }\n\n#abs-loading-screen .abs-loader-stage {\n    position: relative;\n    top: clamp(8px, 2vh, 20px);\n    width: clamp(152px, 22vw, 204px);\n    aspect-ratio: 1;\n    display: flex;\n    flex-direction: column;\n    align-items: center;\n    justify-content: center;\n    pointer-events: none;\n}\n#abs-loading-screen .abs-loader-stage::before {\n    content: '';\n    position: absolute;\n    inset: 0;\n    border: 2px solid rgba(255, 255, 255, 0.16);\n    border-top-color: rgba(255, 255, 255, 0.88);\n    border-right-color: rgba(255, 255, 255, 0.5);\n    border-radius: 50%;\n    box-sizing: border-box;\n    animation: abs-loader-ring-turn 1.1s linear infinite;\n    pointer-events: none;\n}\n#abs-loading-screen .abs-loader-logo {\n    display: block;\n    width: clamp(120px, 18vw, 170px);\n    height: clamp(120px, 18vw, 170px);\n    aspect-ratio: 1;\n    flex: none;\n    object-fit: contain;\n    margin: 0;\n    user-select: none;\n    -webkit-user-drag: none;\n    pointer-events: none;\n}\n#abs-loading-screen .abs-loader-status {\n    position: absolute;\n    width: 1px;\n    height: 1px;\n    padding: 0;\n    margin: -1px;\n    overflow: hidden;\n    clip-path: inset(50%);\n    white-space: nowrap;\n    border: 0;\n}\n#abs-loading-screen[data-loader-error=\"true\"] .abs-loader-stage {\n    width: min(90vw, 560px);\n    aspect-ratio: auto;\n    top: 0;\n    text-align: center;\n}\n#abs-loading-screen[data-loader-error=\"true\"] .abs-loader-stage::before { display: none; }\n\n@keyframes abs-loader-ring-turn { to { transform: rotate(360deg); } }\n@keyframes abs-loader-exit-dissolve { from { opacity: 1; } to { opacity: 0; } }\n@media (prefers-reduced-motion: reduce) {\n    #abs-loading-screen,\n    #abs-loading-screen *,\n    #abs-loading-screen *::before {\n        animation: none !important;\n        transition: none !important;\n    }\n}";
        document.head.prepend(style);
    }

    installCriticalLoaderStyles();

    // 1. Resolve DokkanCustom repo root
    function resolveRepoRoot() {
        const origin = window.location.origin;
        const pathname = decodeURIComponent(window.location.pathname);
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

        if (isLocal) {
            const dokkanIndex = pathname.indexOf('/DokkanCustom');
            if (dokkanIndex !== -1) {
                return origin + pathname.slice(0, dokkanIndex) + '/DokkanCustom/';
            }
            // Check if served from workspace root containing both abscustom and DokkanCustom
            const absIndex = pathname.indexOf('/abscustom');
            if (absIndex !== -1) {
                return origin + pathname.slice(0, absIndex) + '/DokkanCustom/';
            }
            // Check relative path fallback based on folder nesting depth
            const isGrouped = pathname.includes('/Custom Cards/') || pathname.includes('/Custom%20Cards/');
            return isGrouped ? '../../../DokkanCustom/' : '../../DokkanCustom/';
        }
        return 'https://abscustom.github.io/DokkanCustom/';
    }

    const repoRoot = resolveRepoRoot();

    // 2. Set Base URL for all relative assets
    if (!document.querySelector('base[data-published-repo-root]')) {
        const baseEl = document.createElement('base');
        baseEl.setAttribute('data-published-repo-root', 'true');
        baseEl.href = repoRoot;
        document.head.prepend(baseEl);
    }

    // 3. Inject Stylesheets
    const styles = [
        'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css',
        `${repoRoot}css/style.css?v=20260914-abs-clean-filters-settings-v1`,
        `${repoRoot}css/ui-toast.css?v=20261008-abs-ui-v2`,
        `${repoRoot}css/dokkan-info.css?v=${runtimeVersion}`,
        // Keep the shared and clean layout sheets on the same cache revision.
        // Older card pages can already have one of these filenames in their
        // head; ensureStylesheet below upgrades that link instead of treating
        // any version as current.
        `${repoRoot}css/abs-style-layout.css?v=20261008-style-header-fit-v2`,
        `${repoRoot}css/editor-ui.css?v=20261014-viewer-hover-edit-boundary-v1`,
        `${repoRoot}css/card-inspector.css?v=20261013-info-viewport-background-v1`,
        `${repoRoot}css/lwf.css`,
        `${repoRoot}css/abs-clean.css?v=20260925-clean-layout-v25`,
        `${repoRoot}css/abs-clean-presentation.css?v=${cleanPresentationVersion}`,
        `${repoRoot}css/phantom-presentation.css?v=${cleanLayoutRuntimeVersion}`,
        `${repoRoot}css/loading-screen.css?v=20261007-stable-ring-v1`,
        `${repoRoot}css/card-admin.css?v=20261008-abs-ui-v2`,
        `${repoRoot}css/sba-side-dock.css`,
        `${repoRoot}css/sba-bottom-nav.css`,
        `${repoRoot}css/tool-sba-nav.css?v=20260914-abs-clean-filters-settings-v1`,
        `${repoRoot}css/card-viewer-settings.css?v=${viewerSettingsVersion}`,
        `${repoRoot}css/viewer-card-picker.css?v=20261012-viewer-picker-animation-v1`,
        `${repoRoot}css/abs-navigation.css?v=20261017-editor-four-themes-v1`,
        `${repoRoot}css/sidebar-streamers.css?v=20261008-sidebar-live-indicator-v1`,
        `${repoRoot}css/unit-picker.css?v=20261007-abs-selector-shell-v2`
    ];

    function ensureStylesheet(href) {
        const expectedUrl = new URL(href, document.baseURI);
        const fileName = expectedUrl.pathname.split('/').pop();
        const candidates = Array.from(document.querySelectorAll('link[rel~="stylesheet"][href]'))
            .filter(link => {
                try {
                    const path = new URL(link.href, document.baseURI).pathname;
                    return path.endsWith(`/css/${fileName}`);
                } catch (error) {
                    return false;
                }
            });

        const primary = candidates.shift();
        if (primary) {
            // Matching by filename alone used to leave whichever historical
            // stylesheet happened to be present in a saved card. Upgrade that
            // link to the canonical URL so theme switches always use one CSS
            // revision, regardless of the card's age or browser cache.
            if (primary.href !== expectedUrl.href) primary.href = expectedUrl.href;
            primary.dataset.absSharedStylesheet = runtimeVersion;
            candidates.forEach(link => link.remove());
            return primary;
        }

        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = expectedUrl.href;
        link.dataset.absSharedStylesheet = runtimeVersion;
        document.head.appendChild(link);
        return link;
    }

    // Resolve errors as values until the gate is awaited below, so an early
    // CSS failure cannot become an unhandled rejection during script startup.
    const stylesReady = Promise.all(styles.map(href => {
        const link = ensureStylesheet(href);
        if (link.sheet) return Promise.resolve(null);
        return new Promise(resolve => {
            const finish = error => {
                window.clearTimeout(timer);
                link.removeEventListener('load', onLoad);
                link.removeEventListener('error', onError);
                resolve(error);
            };
            const onLoad = () => finish(null);
            const onError = () => finish(new Error(`A required card stylesheet failed to load: ${href}`));
            const timer = window.setTimeout(onError, 8000);
            link.addEventListener('load', onLoad, { once: true });
            link.addEventListener('error', onError, { once: true });
        });
    }));

    // 4. Load either the explicit shared database viewer or a legacy card folder.
    // Database failures remain visible; they never fall back to stale card.json.
    let cardData = null;
    let databaseCard = null;
    const viewerParams = new URLSearchParams(window.location.search);
    if (!window.CARD_CONTENT_CONFIG) {
        await loadScript(`${repoRoot}js/card-content-config.js?v=20261017-card-content-config-v1`);
    }
    if (!window.CardContent) {
        await loadScript(`${repoRoot}js/card-content-client.js?v=20261017-card-content-client-v1`);
    }
    const isSharedDatabaseViewer = /(?:^|\/)custom-card\.html$/i.test(window.location.pathname)
        || viewerParams.get('content') === 'database'
        || window.CARD_CONTENT_CONFIG?.enabled === true;
    if (isSharedDatabaseViewer) {
        if (!window.CardContentRenderer) {
            await loadScript(`${repoRoot}js/card-content-renderer.js?v=20261017-card-content-renderer-v1`);
        }
        if (!window.CardContent) {
            await loadScript(`${repoRoot}js/card-content-client.js?v=20261017-card-content-client-v1`);
        }
        const requestedId = String(viewerParams.get('id') || '').trim();
        const requestedPath = String(viewerParams.get('path') || '').trim();
        let resolvedId = requestedId;
        if (!resolvedId) {
            const aliasPath = requestedPath || (viewerParams.get('content') === 'database' || window.CARD_CONTENT_CONFIG?.enabled === true
                ? window.location.pathname
                : '');
            if (!aliasPath) throw new Error('Open a card using its ID or exact historic path.');
            const resolved = await window.CardContent.resolve(aliasPath);
            resolvedId = String(resolved?.id || '').trim();
            if (!resolvedId) throw new Error('This historic card URL is not registered.');
        }
        databaseCard = await window.CardContent.getCard(resolvedId);
        if (!window.CardContentRenderer || !window.CardContent?.toProject) {
            throw new Error('The safe card renderer is unavailable. Reload and retry.');
        }
        cardData = window.CardContent.toProject(databaseCard);
        cardFolderUrl = databaseCard.assetBase;
    } else {
        try {
            const res = await fetch(new URL('card.json', cardFolderUrl).href, { cache: 'no-cache' });
            if (res.ok) {
                cardData = await res.json();
            }
        } catch (e) {
            console.warn('[Custom Bootstrapper] Direct fetch of card.json failed, falling back to embedded data:', e);
        }

        if (!cardData) {
            const embedded = document.getElementById('card-data');
            if (embedded && embedded.textContent) {
                try { cardData = JSON.parse(embedded.textContent); } catch (e) {}
            }
        }

        if (!cardData) {
            throw new Error('Unable to load card data for this card.');
        }
    }

    // 5. Fetch and inject custom-card-shell.html
    let shellHtml = '';
    try {
        const shellRes = await fetch(`${repoRoot}custom-card-shell.html`, { cache: 'no-cache' });
        if (shellRes.ok) shellHtml = await shellRes.text();
    } catch (e) {
        console.warn('[Custom Bootstrapper] Could not load shell from repoRoot, trying CDN fallback:', e);
        try {
            const fallbackRes = await fetch('https://abscustom.github.io/DokkanCustom/custom-card-shell.html');
            if (fallbackRes.ok) shellHtml = await fallbackRes.text();
        } catch (e2) {}
    }

    if (!shellHtml) throw new Error('Unable to load the shared card viewer.');
    if (shellHtml) {
        // Retain loading screen if already present on body, otherwise insert shell
        const existingLoader = document.getElementById('abs-loading-screen');
        const container = document.createElement('div');
        container.innerHTML = shellHtml;
        container.querySelectorAll("[data-manager-tool]").forEach(button => {
            const managerUrl = new URL("manager.html", repoRoot);
            managerUrl.searchParams.set("tool", button.dataset.managerTool);
            button.dataset.managerUrl = managerUrl.href;
        });

        // If page already has loading screen, remove the duplicate from shell
        if (existingLoader) {
            existingLoader.dataset.loaderShellReadyEvent = 'abs-shell-ready';
            existingLoader.dataset.loaderShellReadyFlag = 'absShellReady';
            const shellLoader = container.querySelector('#abs-loading-screen');
            if (shellLoader) shellLoader.remove();
        } else {
            // Dynamic viewers use the same readiness contract as card.html.
            // The shell is also used by the editor, whose legacy event would
            // otherwise leave this loader mounted until its safety timeout.
            const shellLoader = container.querySelector('#abs-loading-screen');
            if (shellLoader) {
                shellLoader.dataset.loaderReadyEvent = 'abs-card-content-ready';
                shellLoader.dataset.loaderReadyFlag = 'absCardContentReady';
            }
        }

        while (container.firstChild) {
            document.body.appendChild(container.firstChild);
        }
    }

    // 6. Set Global Markers
    window.IS_PUBLISHED = true;
    window.__absIsDynamicViewer = true;
    window.__absDynamicBootstrapping = true;

    const pathString = decodeURIComponent(window.location.pathname);
    const folderMatch = pathString.match(/Custom(?:%20| )Cards\/[^/]+/i) || pathString.match(/[^/]+(?=\/$|$)/);
    window.PUBLISHED_SITE_FOLDER = databaseCard
        ? String(databaseCard.repoPath || databaseCard.slug || databaseCard.id || '')
        : (folderMatch ? folderMatch[0] : '');
    window.PUBLISHED_CARD_SOURCE = 'custom';
    window.absUnitTag = cardData.absUnitTag || '';

    // 7. Script Loader Helper
    function loadScript(src, isModule = false, options = {}) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            if (isModule) script.type = 'module';
            script.src = src;
            script.onload = () => resolve();
            script.onerror = (err) => {
                console.warn(`[Custom Bootstrapper] Failed to load ${src}:`, err);
                if (options.optional) {
                    resolve(false);
                    return;
                }
                reject(new Error(`A required card script failed to load: ${src}`));
            };
            document.body.appendChild(script);
        });
    }

    // 8. Download shared scripts together; execute them in their established
    // order because the editor modules share global state and render helpers.
    const scripts = [
        'js/card-content-renderer.js',
        'js/published-card-guards.js',
        'js-card-details/card-image-interceptor.js',
        'js-card-details/card-layout-roots.js',
        'js-card-details/card-helpers.js',
        'js-card-details/abs-category-art-toggle.js',
        'js-card-details/card-formatters.js',
        'js-card-details/card-renderers.js',
        'js-card-details/card-partners.js',
        'js-editor/01-state.js',
        'js-editor/02-icon-picker.js',
        'js-editor/03-core.js',
        'js-editor/04-stats.js',
        'js-editor/05-passive.js',
        'js-editor/06-links-categories.js',
        'js-editor/07-ui-sync.js',
        'js-editor/08-forms.js',
        'js-editor/09-super-attacks.js',
        'js-editor/10-awakening.js',
        'js-editor/11-active-skills.js',
        'js-editor/12-export.js',
        'js-editor/13-github.js',
        'js-editor/14-assets.js',
        'js-editor/15-parser.js',
        'js-editor/16-cache.js',
        'js-editor/17-theme.js',
        'js-editor/18-init.js',
        'js-editor/19-click-to-edit.js',
        'js/custom-card-media.js',
        'js-editor/20-card-importer.js',
        'js-graphics/lwf.js',
        'js/ui-toast.js',
        'js/sba-ring-effects.js',
        'js/tool-sba-nav.js',
        'js/other-nav.js',
        'js/sidebar-streamers.js',
        'js/sidebar-streamers-feed.js',
        'js/abs-navigation.js',
        'js/unit-picker.js',
        'js/stars-pingpong.js',
        'js-card-details/viewer-card-picker.js'
    ];

    const scriptUrls = scripts.map(s => {
        const scriptVersion = s === 'js/published-card-guards.js'
            ? '20260928-loader-guard-v1'
            : s === 'js/card-content-renderer.js'
                ? '20261017-card-content-renderer-v1'
            : s === 'js/other-nav.js'
                ? '20261016-profile-gate-v1'
            : s === 'js-card-details/card-helpers.js'
                ? cleanLayoutRuntimeVersion
            : s === 'js-card-details/card-layout-roots.js' ? '20261010-phantom-foundation-v7'
            : s === 'js/abs-navigation.js' ? '20261016-profile-ui-v1'
            : s === 'js-editor/07-ui-sync.js' ? '20261010-viewer-character-title-v1'
            : s === 'js-editor/17-theme.js' ? '20261010-phantom-foundation-v7'
            : s === 'js/sidebar-streamers.js' ? '20261008-sidebar-live-indicator-v1'
            : s === 'js/sidebar-streamers-feed.js' ? '20261007-sidebar-status-v1'
            : ['js-editor/12-export.js', 'js-editor/13-github.js', 'js-editor/20-card-importer.js', 'js-editor/21-card-admin.js', 'js-card-details/viewer-card-picker.js'].includes(s) ? '20261017-card-content-v1'
            : s === 'js/unit-picker.js' ? '20261012-viewer-picker-animation-v1'
            : s === 'js/custom-card-media.js' ? '20261008-shared-media-v1'
            : s === 'js/ui-toast.js' ? '20261008-abs-ui-v1'
            : s === 'js/stars-pingpong.js' ? '20260914-seamless-v3'
            : s === 'js/tool-sba-nav.js' ? '20261008-abs-sidebar-v1'
                : runtimeVersion;
        return `${repoRoot}${s}?v=${scriptVersion}`;
    });
    scriptUrls.push(`${repoRoot}js-card-details/abs-clean-presentation.js?v=${cleanPresentationVersion}`);
    scriptUrls.push(`${repoRoot}js-card-details/phantom-presentation.js?v=${cleanLayoutRuntimeVersion}`);
    scriptUrls.forEach(src => {
        const preload = document.createElement('link');
        preload.rel = 'preload';
        preload.as = 'script';
        preload.href = src;
        document.head.appendChild(preload);
    });

    // This standalone controller needs only the loader DOM. Start its watchdog
    // before optional vendor downloads and the ordered application scripts.
    if (!window.absLoadingScreen) await loadScript(`${repoRoot}js/loading-screen.js?v=20261007-stable-ring-v1`);
    if (!window.JSZip) {
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js', false, { optional: true });
    }
    for (const src of scriptUrls) await loadScript(src);
    const styleErrors = await stylesReady;
    const styleError = styleErrors.find(Boolean);
    if (styleError) throw styleError;

    // 10. Configure Published Card Runtime and Viewport
    document.body.classList.add('is-published', 'card-viewer-page');
    window.ensurePublishedCustomCardRuntime?.();

    const sidebar = document.getElementById('editor');
    const toggleBtn = document.getElementById('toggleBtn');
    const scouterMenuBtn = document.querySelector('.scouter-menu-btn');
    if (sidebar) sidebar.style.display = 'none';
    if (toggleBtn) toggleBtn.style.display = 'none';
    if (scouterMenuBtn) scouterMenuBtn.style.display = 'none';

    // Ensure Viewer tab is active and Editor tab is inactive
    const viewerNav = document.getElementById('nav-btn-viewer');
    const editorNav = document.querySelector('.apple-hud-bar a[href*="editor.html"], .hud-nav-group a[href*="editor.html"]');
    if (viewerNav) viewerNav.classList.add('active');
    if (editorNav) editorNav.classList.remove('active');

    const preferredTheme = localStorage.getItem('dokkan_published_card_theme') || cardData.themeVariant || cardData.themeStyle || 'abs-style';
    // Apply Phantom before card data hydration so imported autoplay media starts
    // in the static state when Phantom is the saved published-card view.
    if (String(preferredTheme).toLowerCase() === 'phantom') {
        window.switchCardTheme?.('phantom');
    }

    // 11. Populate the Card with Project Data
    if (typeof window.loadProjectData === 'function') {
        window.loadProjectData(cardData, cardFolderUrl, true);
        // loadProjectData intentionally clears the previous database record;
        // restore this record only after its own data hydrated successfully.
        if (databaseCard) window.currentContentCard = databaseCard;
    } else if (databaseCard) {
        throw new Error('The shared card renderer did not finish loading.');
    }
    const folderCardId = String(window.PUBLISHED_SITE_FOLDER || '').match(/(\d{7,10})(?=-|$)/)?.[1] || '';
    const motionCardId = String(cardData.officialCardId || cardData.cardId || (databaseCard && folderCardId) || cardData.id || folderCardId).trim();
    if (motionCardId) {
        const characterId = Number(cardData.character_id || cardData.characterId || 0);
        window.__absViewerCard = {
            ...(window.__absViewerCard || {}),
            id: motionCardId,
            ...(characterId ? { character_id: characterId } : {})
        };
    }
    if (window.PUBLISHED_CARD_SOURCE === 'custom') {
        window.renderCustomEditorSkillsInDokkanInfo?.();
    }
    window.__absDynamicBootstrapping = false;

    // 12. Switch to Preferred / Published Theme
    if (typeof window.switchCardTheme === 'function') {
        if (String(preferredTheme).toLowerCase() !== 'phantom') window.switchCardTheme(preferredTheme);
    } else if (typeof window.toggleCardTheme === 'function') {
        window.toggleCardTheme(preferredTheme === 'abs-style');
    }

    // 13. Compose the selected style before revealing essential card content.
    if (window.syncToAbsLayout) window.syncToAbsLayout();
    if (window.updateAbsStyleSuperAttacks) window.updateAbsStyleSuperAttacks();
    if (!window.absCardContentReady) {
        window.absCardContentReady = true;
        window.dispatchEvent(new Event('abs-card-content-ready'));
    }
    setTimeout(() => {
        window.refreshEditorLinkingPartners?.();
        window.scheduleEditorLwfHydration?.();
    }, 150);

    console.log('[Custom Bootstrapper] Dynamic card loaded successfully! Press Ctrl+Shift+A to unlock Admin Mode.');
})().catch((error) => {
    console.error('[Custom Bootstrapper] Card startup failed:', error);
    window.dispatchEvent(new CustomEvent('abs-card-bootstrap-error', {
        detail: { message: String(error?.message || error) }
    }));
});
