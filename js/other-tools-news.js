(() => {
    'use strict';

    if (!document.body.classList.contains('other-tool-body')) return;

    function openNewsView(articleId = '', source = 'game') {
        const params = new URLSearchParams({ view: 'news' });
        if (source === 'discord') params.set('source', 'discord');
        if (articleId) params.set('article', String(articleId));
        window.location.assign(`index.html?${params.toString()}`);
    }

    // These standalone tool pages reuse the Home/Cards news renderer but do
    // not mount the hub's in-page view switcher or article panel.
    window.switchHubView = (view, source = 'game') => {
        if (view === 'news') openNewsView('', source);
    };

    window.openDokkanNewsArticle = (articleId, source = 'game') => {
        openNewsView(articleId, source);
    };
})();
