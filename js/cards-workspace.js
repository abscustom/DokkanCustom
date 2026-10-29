/* Cards presentation adapter: keep the existing renderer and live filter controls. */
(() => {
    'use strict';
    function getPageCapacity(base = 40) {
        const grid = document.getElementById('cardGrid');
        if (!grid?.getClientRects().length) return base;
        const columns = getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/).length;
        // Count the same display units as the renderer, keeping linked groups intact.
        return columns > 0 ? (Math.ceil(base / columns) + 2) * columns : base;
    }
    window.CardsWorkspace = Object.freeze({getPageCapacity});
    function mount() {
        const section = document.getElementById('hubCardsSection');
        const trigger = document.getElementById('cardsAdvancedFilterBtn');
        const dialog = document.getElementById('sbaCardsFilterPopover');
        const input = document.getElementById('cardSearchInput');
        if (!section || !trigger || !dialog || !input || !window.DokkanUnitPicker) return;
        section.querySelector('.cards-workspace-title-icon')?.remove();
        section.querySelector('.cards-layout-switcher > span')?.remove();

        // Reuse the actual search input, including its existing search callback.
        const search = document.createElement('div');
        search.className = 'picker-search-wrapper cards-workspace-search';
        search.setAttribute('role', 'search');
        search.setAttribute('aria-label', 'Search characters');
        input.type = 'search';
        input.autocomplete = 'off';
        input.setAttribute('aria-label', 'Search characters');
        input.setAttribute('aria-controls', 'cardGrid');
        input.placeholder = 'Search characters…';
        const oldSearch = input.closest('.liquid-search-border-container');
        search.append(trigger, input);
        oldSearch?.replaceWith(search);

        // Enhance existing DOM with the shared modal lifecycle, not a second filter engine.
        const root = document.createElement('div');
        root.id = 'cardsFilterModal';
        root.className = 'calc-unit-picker-backdrop cards-filter-modal';
        root.hidden = true;
        const header = dialog.querySelector('.sba-cards-filter-popover-header');
        header.className = 'calc-picker-header';
        const title = header.querySelector('span');
        title.className = 'calc-picker-title-text';
        title.textContent = 'Filter characters';
        title.classList.add('visually-hidden');
        header.classList.add('cards-filter-accessible-header');
        const reset = header.querySelector('button');
        reset.className = 'picker-source-tab cards-filter-reset';
        reset.textContent = 'Reset all';
        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'calc-picker-close-btn';
        close.textContent = '×';
        // Backdrop click and Escape dismiss the drawer.
        dialog.className = 'calc-unit-picker-dialog cards-filter-dialog';
        const columns = document.createElement('div');
        columns.className = 'cards-filter-columns';
        const controls = document.createElement('div');
        controls.className = 'picker-controls-row cards-filter-controls';
        controls.append(document.getElementById('sbaCardFiltersSlot'), document.getElementById('sbaAdvancedFilterSlot'));
        const categories = document.getElementById('sbaCategoryFilterSlot');
        categories.className = 'cards-filter-categories';
        const categoryDropdown = document.createElement('details');
        categoryDropdown.className = 'cards-filter-dropdown';
        const categorySummary = document.createElement('summary');
        categorySummary.textContent = 'Categories';
        categoryDropdown.append(categorySummary, categories);
        columns.append(reset, controls, categoryDropdown);
        const count = document.createElement('p');
        count.className = 'lc-unit-picker-count';
        count.setAttribute('role', 'status');
        count.setAttribute('aria-live', 'polite');
        dialog.append(columns);
        window.CardSearchFilters?.mount(controls);
        root.append(dialog);
        document.body.append(root);
        trigger.setAttribute('aria-controls', root.id);
        trigger.setAttribute('aria-haspopup', 'dialog');
        trigger.setAttribute('aria-label', 'Filter characters');
        document.querySelector('.cards-reset-toolbar')?.remove();
        // Legacy select nodes remain hidden because existing callbacks synchronize them.
        document.getElementById('sidebarDrawer')?.setAttribute('hidden', '');
        document.getElementById('sidebarOverlay')?.setAttribute('hidden', '');

        const syncCount = () => {
            const total = typeof filteredCardItems !== 'undefined' ? filteredCardItems.length : section.querySelectorAll('#cardGrid .char-box').length;
            count.textContent = `${total.toLocaleString()} matching characters`;
            dialog.querySelectorAll('.filter-pill-btn').forEach(button => button.setAttribute('aria-pressed', String(button.classList.contains('active'))));
        };
        dialog.querySelectorAll('.filter-pill-group').forEach(group => {
            group.setAttribute('role', 'group');
            group.setAttribute('aria-label', group.querySelector('.filter-group-label')?.textContent.replace(':', '') || 'Character filters');
        });
        window.DokkanUnitPicker.enhance(root, {
            title: 'Filter characters', closeLabel: 'Close character filters',
            searchLabel: dialog.querySelector('input[type="search"]')?.getAttribute('aria-label') || 'Search character categories',
            onClose() {
                dialog.classList.remove('is-open');
                dialog.setAttribute('aria-hidden', 'true');
                trigger.setAttribute('aria-expanded', 'false');
            }
        });
        trigger.addEventListener('click', event => {
            event.preventDefault();
            event.stopImmediatePropagation();
            if (window.DokkanUnitPicker.isOpen(root.id)) window.DokkanUnitPicker.close(root.id);
            else {
                syncSbaCardsFilterPlacement();
                syncCount();
                dialog.classList.add('is-open');
                dialog.removeAttribute('aria-hidden');
                trigger.setAttribute('aria-expanded', 'true');
                window.DokkanUnitPicker.openEnhanced(root.id);
                reset.focus({preventScroll:true});
            }
        }, true);
        // Existing outside-click/Escape/navigation paths can still dismiss the live control.
        new MutationObserver(() => {
            if (!dialog.classList.contains('is-open') && window.DokkanUnitPicker.isOpen(root.id)) window.DokkanUnitPicker.close(root.id);
        }).observe(dialog, {attributes: true, attributeFilter: ['class']});
        new MutationObserver(syncCount).observe(document.getElementById('cardGrid'), {childList: true});
        new MutationObserver(() => {
            if (!document.body.classList.contains('hub-cards-active')) window.DokkanUnitPicker.close(root.id, {restoreFocus: false});
        }).observe(document.body, {attributes: true, attributeFilter: ['class']});
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, {once: true});
    else mount();
})();
