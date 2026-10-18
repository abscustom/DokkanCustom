(() => {
    try {
        document.documentElement.dataset.absNavCollapsed = String(localStorage.getItem('abs_navigation_collapsed') === 'true');
        document.documentElement.dataset.absContextCollapsed = String(localStorage.getItem('abs_context_collapsed') === 'true');
    } catch {}
})();
