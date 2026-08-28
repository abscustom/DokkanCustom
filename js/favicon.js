/* Keep the browser-tab icon in sync with the selected home-site style. */
(() => {
    const ICONS = {
        'abs-style': 'https://abscustom.github.io/assets/images/abs.style.png',
        dokkaninfo: 'https://abscustom.github.io/assets/images/dokkan-info-logo.png',
        placeholder: 'https://abscustom.github.io/assets/images/abs.custom.png'
    };

    function getStyle() {
        const editorStyle = localStorage.getItem('dokkan_selected_theme');
        const hubStyle = localStorage.getItem('hub_selected_style');

        if (document.body?.classList.contains('theme-dokkaninfo')) return editorStyle || 'dokkaninfo';
        if (document.body?.classList.contains('theme-abs-style')) return 'abs-style';
        return hubStyle || editorStyle || 'abs-style';
    }

    window.updateSiteFavicon = function(style = getStyle()) {
        const icon = ICONS[style] || ICONS['abs-style'];
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
