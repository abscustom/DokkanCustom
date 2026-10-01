(() => {
    'use strict';

    const instances = new Map();
    let activePicker = null;

    function makeElement(tagName, className, text) {
        const element = document.createElement(tagName);
        if (className) element.className = className;
        if (text !== undefined) element.textContent = text;
        return element;
    }

    function normalizedSearch(value) {
        return String(value || '').trim().toLocaleLowerCase();
    }

    function buildPicker(id, root, config) {
        root.classList.add('calc-unit-picker-backdrop');
        root.hidden = true;
        root.replaceChildren();

        const dialog = makeElement('section', `calc-unit-picker-dialog liquid-glass-surface ${config.dialogClass || ''}`.trim());
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('aria-labelledby', `${id}-title`);
        dialog.tabIndex = -1;

        const header = makeElement('header', 'calc-picker-header');
        const title = makeElement('h2', 'calc-picker-title-text', config.title || 'Select Unit');
        title.id = `${id}-title`;
        const closeButton = makeElement('button', 'calc-picker-close-btn', '×');
        closeButton.type = 'button';
        closeButton.setAttribute('aria-label', config.closeLabel || 'Close character picker');
        header.append(title, closeButton);

        const toolbar = makeElement('div', 'calc-picker-toolbar');
        const searchLabel = makeElement('label', 'picker-search-wrapper');
        const searchIcon = makeElement('span', 'picker-search-icon', '⌕');
        searchIcon.setAttribute('aria-hidden', 'true');
        const searchInput = makeElement('input');
        searchInput.type = 'search';
        searchInput.autocomplete = 'off';
        searchInput.placeholder = config.searchPlaceholder || 'Search characters…';
        searchInput.setAttribute('aria-label', config.searchLabel || 'Search characters');
        searchInput.setAttribute('aria-controls', config.gridId || `${id}-grid`);
        searchLabel.append(searchIcon, searchInput);
        const count = makeElement('span', 'lc-unit-picker-count');
        count.setAttribute('role', 'status');
        count.setAttribute('aria-live', 'polite');
        toolbar.append(searchLabel, count);

        const viewport = makeElement('div', 'calc-picker-grid-viewport');
        const grid = makeElement('div', 'calc-picker-grid');
        grid.id = config.gridId || `${id}-grid`;
        grid.setAttribute('role', 'group');
        grid.setAttribute('aria-label', config.resultsLabel || 'Character choices');
        viewport.appendChild(grid);

        const footer = makeElement('div', 'lc-unit-picker-footer');
        const loadMore = makeElement('button', 'lc-unit-picker-more', config.moreLabel || 'Show more');
        loadMore.type = 'button';
        loadMore.setAttribute('aria-controls', grid.id);
        footer.appendChild(loadMore);

        dialog.append(header, toolbar, viewport, footer);
        root.appendChild(dialog);

        const state = {
            id,
            root,
            dialog,
            title,
            closeButton,
            searchInput,
            count,
            grid,
            loadMore,
            config,
            filteredItems: [],
            visibleCount: 0,
            previousFocus: null,
            previousOverflow: ''
        };
        instances.set(id, state);

        closeButton.addEventListener('click', () => close(id));
        root.addEventListener('click', (event) => {
            if (event.target === root) close(id);
        });
        dialog.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                close(id);
                return;
            }
            if (event.key !== 'Tab') return;

            const focusable = Array.from(dialog.querySelectorAll('input:not([disabled]), button:not([disabled])'))
                .filter((element) => !element.hidden && element.getAttribute('aria-hidden') !== 'true');
            if (!focusable.length) {
                event.preventDefault();
                dialog.focus();
                return;
            }
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
                event.preventDefault();
                first.focus();
            }
        });
        searchInput.addEventListener('input', () => {
            state.visibleCount = Math.max(1, Number(state.config.pageSize) || 100);
            filterAndRender(state);
        });
        loadMore.addEventListener('click', () => {
            state.visibleCount += Math.max(1, Number(state.config.pageSize) || 100);
            render(state);
        });

        return state;
    }

    function filterAndRender(state) {
        const query = normalizedSearch(state.searchInput.value);
        const getSearchText = state.config.getSearchText || (() => '');
        state.filteredItems = (Array.isArray(state.config.items) ? state.config.items : [])
            .filter((item) => !query || normalizedSearch(getSearchText(item)).includes(query));
        state.visibleCount = Math.max(1, Number(state.config.pageSize) || 100);
        render(state);
    }

    function render(state) {
        state.grid.replaceChildren();
        const items = state.filteredItems;
        const page = items.slice(0, state.visibleCount);
        page.forEach((item, index) => {
            const card = state.config.renderItem(item, index);
            if (!(card instanceof Element)) return;
            card.addEventListener('click', () => {
                const callback = state.config.onSelect;
                close(state.id, { restoreFocus: false, reason: 'select' });
                if (typeof callback === 'function') callback(item);
            });
            if (state.config.isSelected?.(item)) card.classList.add('is-current');
            state.grid.appendChild(card);
        });

        if (!items.length) {
            const empty = makeElement('p', 'lc-unit-picker-empty', state.config.emptyMessage || 'No matching characters were found.');
            empty.setAttribute('role', 'status');
            state.grid.appendChild(empty);
        }

        state.count.textContent = items.length
            ? `Showing ${Math.min(state.visibleCount, items.length).toLocaleString()} of ${items.length.toLocaleString()}`
            : '0 characters';
        state.loadMore.hidden = items.length <= state.visibleCount;
    }

    function open(config) {
        if (!config || !config.id || typeof config.renderItem !== 'function' || typeof config.onSelect !== 'function') {
            throw new TypeError('Unit picker requires an id, renderItem callback, and onSelect callback.');
        }

        if (activePicker && activePicker.id !== config.id) close(activePicker.id);

        let state = instances.get(config.id);
        if (!state) {
            let root = document.getElementById(config.id);
            if (!root) {
                root = makeElement('div');
                root.id = config.id;
                document.body.appendChild(root);
            }
            state = buildPicker(config.id, root, config);
            if (root.parentElement !== document.body) document.body.appendChild(root);
        }

        state.config = config;
        state.title.textContent = config.title || 'Select Unit';
        state.searchInput.placeholder = config.searchPlaceholder || 'Search characters…';
        state.searchInput.setAttribute('aria-label', config.searchLabel || 'Search characters');
        state.grid.setAttribute('aria-label', config.resultsLabel || 'Character choices');
        state.searchInput.value = '';
        state.previousFocus = document.activeElement;
        state.previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        state.root.hidden = false;
        state.root.removeAttribute('aria-hidden');
        state.visibleCount = Math.max(1, Number(config.pageSize) || 100);
        activePicker = state;
        filterAndRender(state);
        state.searchInput.focus();
        return state.root;
    }

    function close(id, { restoreFocus = true, reason = 'dismiss' } = {}) {
        const state = id ? instances.get(id) : activePicker;
        if (!state || state.root.hidden) return false;

        state.root.hidden = true;
        state.root.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = state.previousOverflow;
        if (activePicker === state) activePicker = null;

        if (restoreFocus && state.previousFocus?.isConnected && typeof state.previousFocus.focus === 'function') {
            state.previousFocus.focus();
        }
        if (typeof state.config.onClose === 'function') state.config.onClose({ reason });
        return true;
    }

    window.DokkanUnitPicker = Object.freeze({
        open,
        close,
        isOpen(id) {
            const state = id ? instances.get(id) : activePicker;
            return Boolean(state && !state.root.hidden);
        }
    });
})();
