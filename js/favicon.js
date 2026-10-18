/* Keep site titles and favicons aligned with the shared sidebar destination. */
(() => {
    'use strict';

    const scriptUrl = document.currentScript?.src || new URL('js/favicon.js', document.baseURI).href;
    const appBase = new URL('../', scriptUrl);
    const homeIcon = 'https://abscustom.github.io/assets/images/abs_logo.png';
    const sidebarIcon = file => new URL(`assets/navigation/sidebar/${file}`, appBase).href;
    const routeIcons = {
        cards: sidebarIcon('equ_icon_same_chara.png'),
        calculator: sidebarIcon('sugoroku_jewel_small_0072.png'),
        editor: sidebarIcon('support_memory_enh_lv_base.png'),
        news: sidebarIcon('myp_icon_campaign.png'),
        memory: sidebarIcon('200254.png'),
        leader: sidebarIcon('thumb_support_item_01910.png'),
        damage: sidebarIcon('thumb_support_item_90001.png'),
        manager: sidebarIcon('myp_dragon_radar.png')
    };
    const normalizePath = value => value.replace(/\/+$/, '').toLowerCase() || '/';
    const basePath = normalizePath(appBase.pathname);

    function currentMetadata() {
        const pathname = normalizePath(window.location.pathname);
        const file = pathname.split('/').pop();

        // Both official and nested custom card viewers own character-specific
        // favicons and titles. Leave their live identity updates untouched.
        if (file === 'card.html' || document.body?.classList.contains('card-viewer-page')) return { viewer: true };

        const isHub = pathname === basePath || pathname === `${basePath}/index.html`;
        if (isHub) {
            const view = new URLSearchParams(window.location.search).get('view')?.toLowerCase() || 'home';
            if (view === 'news') return { title: 'ABS - NEWS', icon: routeIcons.news };
            if (view === 'cards') return { title: 'ABS - Dokkan Hub', icon: routeIcons.cards };
            if (view === 'calculator') return { title: 'ABS - Calculator', icon: routeIcons.calculator };
            if (view === 'editor') return { title: 'ABS - Editor', icon: routeIcons.editor };
            if (view === 'memory' || view === 'support-memory') return { title: 'ABS - Memories', icon: routeIcons.memory };
            if (view === 'leader' || view === 'leader-compatibility') return { title: 'ABS - Leader', icon: routeIcons.leader };
            if (view === 'damage' || view === 'damage-received') return { title: 'ABS - Tanking', icon: routeIcons.damage };
            return { title: 'ABS - Dokkan Hub', icon: homeIcon };
        }

        const pageMetadata = {
            'calculator.html': { title: 'ABS - Calculator', icon: routeIcons.calculator },
            'editor.html': { title: 'ABS - Editor', icon: routeIcons.editor },
            'support-memory.html': { title: 'ABS - Memories', icon: routeIcons.memory },
            'leader-compatibility.html': { title: 'ABS - Leader', icon: routeIcons.leader },
            'damage-received.html': { title: 'ABS - Tanking', icon: routeIcons.damage },
            'manager.html': { title: 'ABS - Manager', icon: routeIcons.manager }
        };
        return pageMetadata[file] || { icon: homeIcon };
    }

    function syncFavicon(iconUrl) {
        const links = [...document.querySelectorAll('link[rel~="icon"], link[rel~="shortcut"]')];
        let link = links.find(item => item.dataset.absPageFavicon === 'true') || links[0];
        if (!link) {
            link = document.createElement('link');
            document.head.appendChild(link);
        }
        link.rel = 'icon';
        link.type = 'image/png';
        link.dataset.absPageFavicon = 'true';
        link.href = iconUrl;
        links.forEach(item => { if (item !== link) item.remove(); });
    }

    function updateSiteMetadata() {
        const metadata = currentMetadata();
        if (!metadata || metadata.viewer) return metadata;
        if (metadata.title) document.title = metadata.title;
        if (metadata.icon) syncFavicon(metadata.icon);
        return metadata;
    }

    // Keep existing theme-change callers working; destination, not style,
    // now determines the non-viewer favicon.
    window.updateSiteFavicon = updateSiteMetadata;
    window.updateSitePageMetadata = updateSiteMetadata;

    for (const method of ['pushState', 'replaceState']) {
        const original = window.history[method];
        if (typeof original !== 'function' || original.__absPageMetadataWrapped) continue;
        const wrapped = function(...args) {
            const result = Reflect.apply(original, this, args);
            queueMicrotask(updateSiteMetadata);
            return result;
        };
        Object.defineProperty(wrapped, '__absPageMetadataWrapped', { value: true });
        window.history[method] = wrapped;
    }

    window.addEventListener('popstate', updateSiteMetadata);
    window.addEventListener('hashchange', updateSiteMetadata);
    window.addEventListener('pageshow', updateSiteMetadata);
    updateSiteMetadata();
})();
