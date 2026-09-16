/* Shared abs.clean Categories/Card Art switch for editor and card views.
   The old category-art switch mounted card art inside Categories; art and
   Categories are separate panels now. This module only cleans up leftover
   category picker nodes and guarantees the art layers live in their own dock. */
(function() {
    const getCategoryBox = () => document.getElementById('abs-category-container')?.closest('.abs-box') || null;

    window.syncAbsCleanCategoryArtModeButtons = function(mode) {
        if (!document.body.classList.contains('theme-abs-clean')) return;
        const catBox = getCategoryBox();
        const picker = document.getElementById('abs-category-art-mode-picker');
        if (!picker) return;
        const selectedMode = mode || catBox?.dataset.absCleanArtMode || window.currentEditorArtMode || 'animated';
        picker.querySelectorAll('[data-art-mode]').forEach(button => {
            button.classList.toggle('active', button.dataset.artMode === selectedMode);
        });
    };

    window.getAbsCleanArtMode = function(fallback = 'animated') {
        if (!document.body.classList.contains('theme-abs-clean')) return fallback;
        return getCategoryBox()?.dataset.absCleanArtMode || fallback;
    };

    window.syncAbsCleanArtMediaMode = function(mode) {
        if (!document.body.classList.contains('theme-abs-clean')) return;
        const previousMode = window.__absCleanArtMediaMode;
        if (previousMode === mode) return;
        window.__absCleanArtMediaMode = mode;

        const videos = [
            document.getElementById('abs-art-video'),
            document.getElementById('myOverlayVideo')
        ].filter(Boolean);
        videos.forEach(video => {
            try {
                video.pause();
                video.currentTime = 0;
            } catch (e) {}
        });

        const lwfCanvas = document.getElementById('abs-card-bg-lwf-canvas');
        if (!lwfCanvas) return;
        if (mode === 'animated') {
            window.DokkanLWF?.restart?.(lwfCanvas.id || 'abs-card-bg-lwf-canvas', { play: true });
        } else {
            window.DokkanLWF?.restart?.(lwfCanvas.id || 'abs-card-bg-lwf-canvas', { play: false });
            window.DokkanLWF?.pause?.(lwfCanvas.id || 'abs-card-bg-lwf-canvas');
        }
    };

    const getHeaderTitleNode = header => Array.from(header.childNodes).find(
        node => node.nodeType === Node.TEXT_NODE && node.nodeValue.trim()
    ) || null;

    const setHeaderTitle = (header, title) => {
        if (!header) return;
        if (window.__absCleanCategoryHeaderTitle === undefined) {
            window.__absCleanCategoryHeaderTitle = getHeaderTitleNode(header)?.nodeValue.trim() || 'Categories';
        }
        const titleNode = getHeaderTitleNode(header);
        if (titleNode) titleNode.nodeValue = title;
        else header.prepend(document.createTextNode(title));
    };

    window.restoreAbsCleanCategoryArt = function() {
        const caption = document.getElementById('abs-art-caption');
        if (caption) {
            const isClean = document.body?.classList.contains('theme-abs-clean') === true;
            caption.hidden = !isClean;
            caption.setAttribute('aria-hidden', String(!isClean));
        }

        const artBox = document.getElementById('abs-art-layers-container');
        const dock = document.getElementById('abs-art-dock-wrapper');
        if (artBox && dock && artBox.parentElement !== dock) {
            const toggleBar = document.getElementById('abs-art-toggle-bar');
            if (toggleBar && toggleBar.parentElement === dock) toggleBar.insertAdjacentElement('beforebegin', artBox);
            else dock.appendChild(artBox);
        }

        const header = getCategoryBox()?.querySelector('.abs-header');
        if (header && window.__absCleanCategoryHeaderTitle !== undefined) {
            setHeaderTitle(header, window.__absCleanCategoryHeaderTitle);
            window.__absCleanCategoryHeaderTitle = undefined;
        }

        document.getElementById('abs-clean-category-art-stage')?.remove();
        document.getElementById('abs-category-art-toggle')?.remove();
        document.getElementById('abs-category-art-mode-picker')?.remove();
    };

    window.syncAbsCleanCategoryArt = function() {
        // No toggle: Categories stay a dedicated panel and card art stays in
        // its own dock. Just sweep any leftover toggle nodes on every pass.
        window.restoreAbsCleanCategoryArt();
    };

    const refresh = () => {
        if (document.body.classList.contains('theme-abs-clean')) window.syncAbsCleanCategoryArt();
        else window.restoreAbsCleanCategoryArt();
    };

    const observeTheme = () => {
        if (!document.body || window.__absCleanCategoryArtThemeObserver) return;
        window.__absCleanCategoryArtThemeObserver = new MutationObserver(() => {
            if (window.__absCleanCategoryArtRefreshPending) return;
            window.__absCleanCategoryArtRefreshPending = true;
            requestAnimationFrame(() => {
                window.__absCleanCategoryArtRefreshPending = false;
                refresh();
            });
        });
        window.__absCleanCategoryArtThemeObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    };

    const init = () => {
        observeTheme();
        refresh();
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
    else init();
})();
