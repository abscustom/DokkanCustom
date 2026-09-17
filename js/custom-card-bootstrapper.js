/* ============================================================
   DYNAMIC CUSTOM CARD BOOTSTRAPPER (DokkanCustom)
   Loads the latest shared viewer shell, CSS, and scripts
   while populating the card dynamically from card.json.
   ============================================================ */
(async function initCustomCardBootstrapper() {
    'use strict';

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
        `${repoRoot}css/dokkan-info.css`,
        `${repoRoot}css/abs-style-layout.css`,
        `${repoRoot}css/editor-ui.css`,
        `${repoRoot}css/card-inspector.css`,
        `${repoRoot}css/lwf.css`,
        `${repoRoot}css/abs-clean.css`,
        `${repoRoot}css/loading-screen.css`,
        `${repoRoot}css/card-admin.css`,
        `${repoRoot}css/sba-side-dock.css`,
        `${repoRoot}css/sba-bottom-nav.css`,
        `${repoRoot}css/tool-sba-nav.css`
    ];

    styles.forEach(href => {
        const fileKey = href.split('?')[0].split('/').pop();
        if (!document.querySelector(`link[href*="${fileKey}"]`)) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            document.head.appendChild(link);
        }
    });

    // 4. Fetch card.json (with fallback to embedded script#card-data)
    let cardData = null;
    try {
        const res = await fetch('./card.json', { cache: 'no-cache' });
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
        'js/stars-pingpong.js'
    ];

    for (const s of scripts) {
        await loadScript(`${repoRoot}${s}`);
    }

    // Load LWF module loader
    loadScript(`${repoRoot}js-graphics/lwf-loader.js`, true);

    // 10. Configure Published Card Runtime and Viewport
    document.body.classList.add('is-published');
    window.ensurePublishedCustomCardRuntime?.();

    const sidebar = document.getElementById('editor');
    const toggleBtn = document.getElementById('toggleBtn');
    const scouterMenuBtn = document.querySelector('.scouter-menu-btn');
    if (sidebar) sidebar.style.display = 'none';
    if (toggleBtn) toggleBtn.style.display = 'none';
    if (scouterMenuBtn) scouterMenuBtn.style.display = 'none';

    // 11. Populate the Card with Project Data
    const currentFolderUrl = window.location.href.split('?')[0].split('#')[0];
    if (typeof window.loadProjectData === 'function') {
        window.loadProjectData(cardData, currentFolderUrl, true);
    }
    window.__absDynamicBootstrapping = false;

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

    // 14. Fade out Loading Screen
    setTimeout(() => {
        const loader = document.getElementById('abs-loading-screen');
        if (loader) {
            loader.style.transition = 'opacity 0.4s ease';
            loader.style.opacity = '0';
            setTimeout(() => {
                loader.style.visibility = 'hidden';
                loader.style.display = 'none';
            }, 450);
        }
    }, 350);

    console.log('[Custom Bootstrapper] Dynamic card loaded successfully! Press Ctrl+Shift+A to unlock Admin Mode.');
})();
