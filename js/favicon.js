/* Keep the browser-tab icon in sync with the selected home-site style. */
(() => {
    const ABS_LOGO = 'https://abscustom.github.io/assets/images/abs_logo.png';
    const CARD_FAVICON = new URL('assets/ui/images/cards-favicon.png', document.baseURI).href;
    const ICONS = {
        'abs-style': ABS_LOGO,
        dokkaninfo: ABS_LOGO,
        placeholder: ABS_LOGO,
        sba: ABS_LOGO
    };

    function getStyle() {
        const editorStyle = localStorage.getItem('dokkan_selected_theme');
        const hubStyle = localStorage.getItem('hub_selected_style');

        if (document.body?.classList.contains('theme-dokkaninfo')) return editorStyle || 'dokkaninfo';
        if (document.body?.classList.contains('theme-abs-style')) return 'abs-style';
        return hubStyle || editorStyle || 'abs-style';
    }

    window.updateSiteFavicon = function(style = getStyle()) {
        const isCalculator = /(?:^|\/)calculator\.html$/i.test(window.location.pathname);
        const icon = isCalculator ? CARD_FAVICON : (ICONS[style] || ICONS['abs-style']);
        let link = document.querySelector('link[rel~="icon"]');

        if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            link.type = 'image/png';
            document.head.append(link);
        }

        link.href = icon;
    };

    window.updateSiteFavicon();
})();
