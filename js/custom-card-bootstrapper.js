/* ============================================================
   DYNAMIC CUSTOM CARD BOOTSTRAPPER (DokkanCustom)
   Loads the latest shared viewer shell, CSS, and scripts
   while populating the card dynamically from card.json.
   ============================================================ */
(async function initCustomCardBootstrapper() {
    'use strict';

    // Resolve card-owned data before <base> redirects shared application assets.
    const cardFolderUrl = new URL('./', window.location.href).href;
    const runtimeVersion = '20260926-clean-motion-runtime-v1';
    const cleanPresentationVersion = '20260927-clean-presentation-v53';
    const cleanLayoutRuntimeVersion = '20260927-clean-layout-runtime-v3';
    const viewerSettingsVersion = '20260927-clean-floating-motion-v11';
    const viewerMotionVersion = '20260926-clean-motion-availability-v10';

    // Older published cards were generated before the shared loader stylesheet
    // was emitted in their <head>.  Apply the small, first-paint contract before
    // any fetches so their raw logo never lays out in a document corner and then
    // jumps when loading-screen.css arrives.  New exports include the full sheet
    // directly in <head>; this is intentionally only a backwards-compatible
    // fallback for cards already on the site.
    function installCriticalLoaderStyles() {
        const loader = document.getElementById('abs-loading-screen');
        if (!loader || document.getElementById('abs-loader-critical-styles')) return;
        const style = document.createElement('style');
        style.id = 'abs-loader-critical-styles';
        style.textContent = `
            #abs-loading-screen { position: fixed; inset: 0; z-index: 2147483647; display: grid; place-items: center; overflow: hidden; background: #03060c; color: #fff; opacity: 1; visibility: visible; }
            #abs-loading-screen .abs-loader-stage { position: relative; z-index: 5; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
            #abs-loading-screen .abs-loader-logo { display: block; width: clamp(120px, 18vw, 170px); height: auto; object-fit: contain; }
        `;
        document.head.prepend(style);
    }

    installCriticalLoaderStyles();

    // 1. Resolve DokkanCustom repo root
    function resolveRepoRoot() {
        const origin = window.location.origin;
        const pathname = decodeURIComponent(window.location.pathname);
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

        if (isLocal) {
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
        `${repoRoot}css/style.css`,
        `${repoRoot}css/ui-toast.css`,
        `${repoRoot}css/dokkan-info.css?v=${runtimeVersion}`,
        // Keep the shared and clean layout sheets on the same cache revision.
        // Older card pages can already have one of these filenames in their
        // head; ensureStylesheet below upgrades that link instead of treating
        // any version as current.
        `${repoRoot}css/abs-style-layout.css?v=20260925-passive-header-shadow-v1`,
        `${repoRoot}css/editor-ui.css?v=${runtimeVersion}`,
        `${repoRoot}css/card-inspector.css?v=${runtimeVersion}`,
        `${repoRoot}css/lwf.css`,
        `${repoRoot}css/abs-clean.css?v=20260925-clean-layout-v25`,
        `${repoRoot}css/abs-clean-presentation.css?v=${cleanPresentationVersion}`,
        `${repoRoot}css/loading-screen.css`,
        `${repoRoot}css/card-admin.css`,
        `${repoRoot}css/sba-side-dock.css`,
        `${repoRoot}css/sba-bottom-nav.css`,
        `${repoRoot}css/tool-sba-nav.css`,
        `${repoRoot}css/card-viewer-settings.css?v=${viewerSettingsVersion}`,
        `${repoRoot}css/viewer-card-picker.css`
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

    styles.forEach(ensureStylesheet);

    // 4. Fetch card.json (with fallback to embedded script#card-data)
    let cardData = null;
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
        console.error('[Custom Bootstrapper] Unable to load card data for this card.');
        return;
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

    if (shellHtml) {
        // Retain loading screen if already present on body, otherwise insert shell
        const existingLoader = document.getElementById('abs-loading-screen');
        const container = document.createElement('div');
        container.innerHTML = shellHtml;

        // If page already has loading screen, remove the duplicate from shell
        if (existingLoader) {
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
    window.PUBLISHED_SITE_FOLDER = folderMatch ? folderMatch[0] : '';
    window.PUBLISHED_CARD_SOURCE = 'custom';
    window.absUnitTag = cardData.absUnitTag || '';

    // 7. Script Loader Helper
    function loadScript(src, isModule = false) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            if (isModule) script.type = 'module';
            script.src = src;
            script.onload = () => resolve();
            script.onerror = (err) => {
                console.warn(`[Custom Bootstrapper] Failed to load ${src}:`, err);
                resolve(); // resolve anyway to avoid blocking execution
            };
            document.body.appendChild(script);
        });
    }

    // 8. Load Vendor Dependencies
    if (!window.JSZip) {
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
    }

    // 9. Load DokkanCustom JavaScript Modules in Order
    const scripts = [
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
        'js-editor/20-card-importer.js',
        'js-editor/21-card-admin.js',
        'js-graphics/lwf.js',
        'js/ui-toast.js',
        'js/sba-ring-effects.js',
        'js/tool-sba-nav.js',
        'js/loading-screen.js',
        'js/stars-pingpong.js',
        'js-card-details/viewer-card-picker.js'
    ];

    for (const s of scripts) {
        const scriptVersion = s === 'js-card-details/card-helpers.js'
            ? cleanLayoutRuntimeVersion
            : runtimeVersion;
        await loadScript(`${repoRoot}${s}?v=${scriptVersion}`);
    }

    await loadScript(`${repoRoot}js-card-details/abs-clean-presentation.js?v=${cleanPresentationVersion}`);

    // Load LWF before the viewer motion module so published custom cards can
    // attach the idle renderer after their active presentation root exists.
    await loadScript(`${repoRoot}js-graphics/lwf-loader.js`, true);

    // 10. Configure Published Card Runtime and Viewport
    document.body.classList.add('is-published', 'card-viewer-page');
    window.ensurePublishedCustomCardRuntime?.();
    await loadScript(`${repoRoot}js-card-details/viewer-motion.js?v=${viewerMotionVersion}`, true);

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

    // 11. Populate the Card with Project Data
    if (typeof window.loadProjectData === 'function') {
        window.loadProjectData(cardData, cardFolderUrl, true);
    }
    const folderCardId = String(window.PUBLISHED_SITE_FOLDER || '').match(/(\d{7,10})(?=-|$)/)?.[1] || '';
    const motionCardId = String(cardData.officialCardId || cardData.cardId || cardData.id || folderCardId).trim();
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
    if (!window.absCardContentReady) {
        window.absCardContentReady = true;
        window.dispatchEvent(new Event('abs-card-content-ready'));
    }

    // 12. Switch to Preferred / Published Theme
    const preferredTheme = localStorage.getItem('dokkan_published_card_theme') || cardData.themeVariant || cardData.themeStyle || 'abs-style';
    if (typeof window.switchCardTheme === 'function') {
        window.switchCardTheme(preferredTheme);
    } else if (typeof window.toggleCardTheme === 'function') {
        window.toggleCardTheme(preferredTheme === 'abs-style');
    }

    // 13. Sync SBA Layout and Elements
    setTimeout(() => {
        if (window.syncToAbsLayout) window.syncToAbsLayout();
        if (window.updateAbsStyleSuperAttacks) window.updateAbsStyleSuperAttacks();
        window.refreshEditorLinkingPartners?.();
        window.scheduleEditorLwfHydration?.();
    }, 150);

    console.log('[Custom Bootstrapper] Dynamic card loaded successfully! Press Ctrl+Shift+A to unlock Admin Mode.');
})();
