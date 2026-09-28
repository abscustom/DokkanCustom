/* ======================================================================= */
/*    CLICK TO EDIT GUI INTERCEPTOR (FULL CONTROLLER & COMPLETE TOOLKIT)   */
/* ======================================================================= */

function sanitizeLinksAndCategories() {
    const targets = document.querySelectorAll('#card-link-container a, #card-category-container img, #card-category-container div');
    targets.forEach(el => {
        if (el.hasAttribute('onclick')) {
            el.removeAttribute('onclick');
        }
        el.onclick = null;
    });
}

function escapeContextHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function normalizeContextCategoryId(id) {
    const value = String(id ?? '').trim();
    return /^\d{1,4}$/.test(value) ? value.padStart(4, '0') : value;
}

function contextCategorySourceOptions() {
    return Array.from(document.querySelectorAll('#category-options option'))
        .map(option => ({
            id: normalizeContextCategoryId(option.dataset.id || ''),
            name: String(option.value || '').trim()
        }))
        .filter(option => option.id && option.name);
}

function resolveEditorCategoryPickerRecord(source) {
    const isDomNode = Boolean(source && typeof source.getAttribute === 'function');
    const item = isDomNode
        ? (source.matches?.('img') ? source.closest?.('[data-category-id], .editor-category-item') || source : source)
        : null;
    const image = isDomNode
        ? (source.matches?.('img') ? source : source.querySelector?.('img'))
        : null;
    const idCandidates = [];
    const nameCandidates = [];
    const addId = value => {
        if (value === undefined || value === null) return;
        const raw = String(value).trim();
        const imageId = raw.match(/card_category_label_(\d+)_/i)?.[1];
        const candidate = normalizeContextCategoryId(imageId || (/^\d{1,4}$/.test(raw) ? raw : ''));
        if (candidate && !idCandidates.includes(candidate)) idCandidates.push(candidate);
    };
    const addName = value => {
        const name = String(value ?? '').replace(/\s+/g, ' ').trim();
        if (name && !/^category(?:\s+(?:name|#?\d+))?$/i.test(name) && !nameCandidates.includes(name)) {
            nameCandidates.push(name);
        }
    };

    if (isDomNode) {
        addId(item?.dataset?.categoryId || item?.getAttribute?.('data-category-id'));
        addId(image?.getAttribute('src') || image?.currentSrc);
        addName(item?.dataset?.categoryName || item?.getAttribute?.('data-category-name'));
        addName(item?.querySelector?.('.category-name-fallback, .category-name, .abs-category-name')?.textContent);
        addName(image?.getAttribute('alt') || image?.getAttribute('title'));
    } else if (source && typeof source === 'object') {
        addId(source.id ?? source.category_id ?? source.categoryId ?? source.cat_id ?? source.category);
        addId(source.imageSrc ?? source.image ?? source.src);
        addName(source.name ?? source.category_name ?? source.categoryName);
    } else if (source !== undefined && source !== null) {
        const value = String(source).trim();
        addId(value);
        if (!/^\d{1,4}$/.test(value)) addName(value);
    }

    const options = contextCategorySourceOptions();
    const optionById = options.find(option => option.id === idCandidates[0]);
    const optionByName = nameCandidates.length
        ? options.find(option => option.name.toLocaleLowerCase() === nameCandidates[0].toLocaleLowerCase())
        : null;
    let categoryId = optionById?.id || optionByName?.id || idCandidates[0] || '';
    let categoryRecord = null;
    if (categoryId) {
        const categories = window.DB?.categories;
        const values = Array.isArray(categories) ? categories : Object.values(categories || {});
        categoryRecord = values.find(record =>
            normalizeContextCategoryId(record?.id ?? record?.category_id ?? '') === categoryId
        ) || null;
    }
    const name = optionById?.name || optionByName?.name || nameCandidates[0] ||
        String(categoryRecord?.name || '').trim() || (categoryId ? 'Category ' + categoryId : '');
    return { id: categoryId, name };
}

window.resolveEditorCategoryPickerRecord = resolveEditorCategoryPickerRecord;

function renderContextCategoryGroups(options, selectedKeys) {
    const orderedOptions = options
        .map((option, index) => ({ option, index, selected: selectedKeys.has(normalizeContextCategoryId(option.id)) }))
        .sort((left, right) => Number(right.selected) - Number(left.selected) || left.index - right.index)
        .map(entry => entry.option);
    return orderedOptions.map(option => {
        const id = normalizeContextCategoryId(option.id);
        const selected = selectedKeys.has(id);
        const imageSrc = `https://abscustom.github.io/assets/images/card_category_label_${encodeURIComponent(id)}_b_on.png`;
        return `<button type="button" class="context-visual-choice context-category-choice${selected ? ' selected' : ''}" data-visual-choice data-visual-kind="categories" data-visual-id="${escapeContextHtml(id)}" data-visual-name="${escapeContextHtml(option.name)}" aria-label="${escapeContextHtml(option.name)}" aria-pressed="${selected}" title="${escapeContextHtml(option.name)}">
            <img src="${imageSrc}" alt="" loading="lazy" onerror="this.hidden=true">
        </button>`;
    }).join('');
}

function reorderSelectedVisualChoices(grid, selector, revealSelected = false) {
    if (!grid?.querySelectorAll || !grid?.insertBefore) return;
    const choices = Array.from(grid.querySelectorAll(selector));
    if (choices.length < 2) return;
    const activeChoice = choices.includes(document.activeElement) ? document.activeElement : null;
    const scrollTop = grid.scrollTop;
    const orderedChoices = choices.sort((left, right) =>
        Number(right.classList.contains('selected')) - Number(left.classList.contains('selected'))
    );
    orderedChoices.forEach((choice, index) => {
        const current = grid.children[index];
        if (current !== choice) grid.insertBefore(choice, current || null);
    });
    if (activeChoice) activeChoice.focus({ preventScroll: true });
    grid.scrollTop = revealSelected ? 0 : scrollTop;
}

function sortContextCategoryChoices(grid, revealSelected = false) {
    reorderSelectedVisualChoices(grid, '.context-category-choice', revealSelected);
}

function sortContextLinkChoices(grid, revealSelected = false) {
    reorderSelectedVisualChoices(grid, '.context-link-choice', revealSelected);
}

function categoryPickerOptions() {
    const entriesById = new Map(contextCategorySourceOptions().map(option => [option.id, option]));
    const container = document.getElementById('card-category-container');
    const items = window.getEditorCategoryItems?.(container) ||
        Array.from(container?.querySelectorAll?.('.editor-category-item, [data-category-id]') || []);
    items.forEach(item => {
        const option = resolveEditorCategoryPickerRecord(item);
        if (option.id && option.name && !entriesById.has(option.id)) entriesById.set(option.id, option);
    });
    return Array.from(entriesById.values());
}

function currentCategoryPickerSelection() {
    const items = [];
    const seen = new Set();
    const container = document.getElementById('card-category-container');
    const nodes = window.getEditorCategoryItems?.(container) ||
        Array.from(container?.querySelectorAll?.('.editor-category-item, [data-category-id], img') || []);
    nodes.forEach(node => {
        const category = resolveEditorCategoryPickerRecord(node);
        if (!category.id || seen.has(category.id)) return;
        items.push(category);
        seen.add(category.id);
    });
    return items;
}

function currentLinkPickerSelection() {
    return Array.from(document.querySelectorAll('#card-link-container a'))
        .map(link => String(link.textContent || '').trim())
        .filter(Boolean);
}

function linkPickerOptions() {
    const names = [];
    const seen = new Set();
    const addName = value => {
        const name = String(value || '').trim();
        const key = name.toLocaleLowerCase();
        if (!name || seen.has(key)) return;
        names.push(name);
        seen.add(key);
    };

    Array.from(document.querySelectorAll('#link-options option')).forEach(option => addName(option.value));
    const databaseLinks = window.DB?.links;
    if (databaseLinks && typeof databaseLinks === 'object') {
        Object.values(databaseLinks).forEach(link => addName(typeof link === 'string' ? link : link?.name));
    }
    currentLinkPickerSelection().forEach(addName);
    return names;
}

function renderContextVisualPicker(kind) {
    const isCategory = kind === 'categories';
    const selectedItems = window.contextVisualSelection?.type === kind
        ? window.contextVisualSelection.items
        : (isCategory ? currentCategoryPickerSelection() : currentLinkPickerSelection());
    const selectedKeys = new Set(selectedItems.map(item => isCategory
        ? normalizeContextCategoryId(item?.id)
        : String(item).toLocaleLowerCase()));
    const options = isCategory ? categoryPickerOptions() : linkPickerOptions();
    const orderedLinkOptions = isCategory ? [] : options
        .map((option, index) => ({ option, index, selected: selectedKeys.has(String(option).toLocaleLowerCase()) }))
        .sort((left, right) => Number(right.selected) - Number(left.selected) || left.index - right.index)
        .map(entry => entry.option);
    const grid = isCategory
        ? renderContextCategoryGroups(options, selectedKeys)
        : orderedLinkOptions.map(option => {
        const name = String(option);
        const selected = selectedKeys.has(name.toLocaleLowerCase());
        const effect = window.getLinkSkillLevel10Description?.(name) || '';
        return `<button type="button" class="context-visual-choice context-link-choice${selected ? ' selected' : ''}" data-visual-choice data-visual-kind="links" data-visual-name="${escapeContextHtml(name)}" aria-label="${escapeContextHtml(name)}" aria-pressed="${selected}" title="${escapeContextHtml(effect || name)}"><span class="abs-link-name">${escapeContextHtml(name)}</span></button>`;
    }).join('');
    const count = selectedItems.length;
    const label = isCategory ? 'category' : 'Link Skill';

    return `<section class="context-visual-picker" data-visual-picker="${kind}">
        <label class="context-visual-search-label" for="gui-${kind}-search">Search ${isCategory ? 'categories' : 'Link Skills'}</label>
        <input type="search" id="gui-${kind}-search" class="form-control context-visual-search" placeholder="Search ${isCategory ? 'categories' : 'Link Skills'}..." autocomplete="off">
        <div class="context-visual-grid" role="group" aria-label="Choose ${isCategory ? 'categories' : 'Link Skills'}">${grid}</div>
        <div class="context-visual-picker-actions">
            <span class="context-visual-selection-count" aria-live="polite">${count} selected</span>
            <button type="button" class="gui-preset-btn" data-visual-cancel>Cancel</button>
            <button type="button" class="gui-add-btn" data-visual-apply>Apply</button>
        </div>
    </section>`;
}

window.contextVisualSelection = window.contextVisualSelection || { type: '', items: [] };

window.filterContextVisualChoices = function(searchInput) {
    const query = String(searchInput?.value || '').trim().toLocaleLowerCase();
    const picker = searchInput?.closest('.context-visual-picker');
    picker?.querySelectorAll('[data-visual-choice]').forEach(button => {
        button.hidden = !String(button.dataset.visualName || '').toLocaleLowerCase().includes(query);
    });
};

window.toggleContextVisualChoice = function(button) {
    const kind = button?.dataset.visualKind;
    if (!button || !['links', 'categories'].includes(kind)) return;
    const key = kind === 'categories'
        ? normalizeContextCategoryId(button.dataset.visualId || '')
        : String(button.dataset.visualName || '').toLocaleLowerCase();
    const items = window.contextVisualSelection?.type === kind ? window.contextVisualSelection.items : [];
    const index = items.findIndex(item => (kind === 'categories'
        ? normalizeContextCategoryId(item?.id)
        : String(item).toLocaleLowerCase()) === key);
    if (index >= 0) items.splice(index, 1);
    else if (kind === 'categories') items.push({ id: key, name: String(button.dataset.visualName || '') });
    else items.push(String(button.dataset.visualName || ''));
    window.contextVisualSelection = { type: kind, items };
    const selected = index < 0;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
    if (kind === 'categories') {
        sortContextCategoryChoices(button.closest('.context-visual-grid'), selected);
    } else sortContextLinkChoices(button.closest('.context-visual-grid'), selected);
    const count = button.closest('.context-visual-picker')?.querySelector('.context-visual-selection-count');
    if (count) count.textContent = `${items.length} selected`;
};

window.cancelContextVisualSelection = function() {
    window.closeContextGUI?.();
};

window.applyContextVisualSelection = function(kind) {
    const selection = window.contextVisualSelection;
    if (selection?.type !== kind) return;
    if (kind === 'categories') {
        const seen = new Set();
        selection.items = selection.items
            .map(item => resolveEditorCategoryPickerRecord(item))
            .filter(item => item.id && item.name && !seen.has(item.id) && seen.add(item.id));
        const container = document.getElementById('card-category-container');
        if (!container) return;
        container.replaceChildren();
        selection.items.forEach(item => {
            const wrapper = document.createElement('div');
            wrapper.className = 'col-4 d-flex justify-content-center padding-top-bottom-5 editor-category-item';
            wrapper.dataset.categoryId = String(item.id);
            wrapper.dataset.categoryName = String(item.name);
            const image = document.createElement('img');
            image.src = `https://abscustom.github.io/assets/images/card_category_label_${encodeURIComponent(item.id)}_b_on.png`;
            image.alt = String(item.name);
            image.style.width = '210px';
            const fallback = document.createElement('span');
            fallback.className = 'category-name-fallback';
            fallback.textContent = String(item.name);
            fallback.style.display = 'none';
            image.onerror = () => { image.style.display = 'none'; fallback.style.display = 'inline-flex'; };
            wrapper.append(image, fallback);
            container.appendChild(wrapper);
        });
        window.normalizeEditorCategoryItems?.(container);
        if (window.currentCardThemeStyle === 'abs-style') window.syncToAbsLayout?.();
    } else if (kind === 'links') {
        const container = document.getElementById('card-link-container');
        if (!container) return;
        container.replaceChildren();
        const typeName = String(window.currentType || 'none').replace(/[^a-z0-9_-]/gi, '');
        selection.items.forEach(name => {
            const link = document.createElement('a');
            link.className = `col-4 border border-1 border-${typeName} padding-top-bottom-10 text-center`;
            link.textContent = String(name);
            const effect = window.getLinkSkillLevel10Description?.(String(name)) || '';
            if (effect) link.setAttribute('data-tooltip', effect);
            container.appendChild(link);
        });
        if (window.currentCardThemeStyle === 'abs-style') window.syncToAbsLayout?.();
        window.refreshEditorLinkingPartners?.();
    } else {
        return;
    }

    const picker = document.querySelector(`#context-gui [data-visual-picker="${kind}"]`);
    picker?.querySelectorAll('[data-visual-choice]').forEach(button => {
        const selected = selection.items.some(item => kind === 'categories'
            ? normalizeContextCategoryId(item.id) === normalizeContextCategoryId(button.dataset.visualId || '')
            : String(item).toLocaleLowerCase() === String(button.dataset.visualName || '').toLocaleLowerCase());
        button.classList.toggle('selected', selected);
        button.setAttribute('aria-pressed', String(selected));
    });
    if (window.CardHubToast) window.CardHubToast.success(`${kind === 'categories' ? 'Categories' : 'Link Skills'} updated`, { duration: 1600 });
    window.autoSaveToCache?.();
};

function normalizeSAAttackKi(value) {
    const raw = String(value ?? '').trim();
    if (!raw) return '';
    const match = raw.match(/^(\d+(?:\.\d+)?)(?:\s*Ki)?$/i);
    if (!match) return '';
    const numeric = Number(match[1]);
    return Number.isFinite(numeric) && numeric >= 0 ? String(numeric) : '';
}

function defaultSAAttackKi(typeLabel) {
    return /\bultra\b/i.test(String(typeLabel ?? '')) ? '18' : '12';
}

function formatSAAttackKi(value) {
    const numeric = normalizeSAAttackKi(value);
    return numeric ? `${numeric} Ki` : '';
}

function isSAActivationType(typeLabel) {
    return /^(?:ex\s+super\s+attack|unit\s+(?:ultra\s+)?super\s+attack)$/i.test(String(typeLabel ?? '').trim());
}

function getSAActivationSourceText(block) {
    const display = block?.querySelector('.activation-text');
    if (!display) return '';
    const extracted = typeof window.extractCleanConditionText === 'function'
        ? window.extractCleanConditionText(display)
        : '';
    const source = extracted || clickEditorSourceTextFromElement(display);
    return String(source || '')
        .replace(/^activation\s+conditions?(?:\(s\))?[\s:]*/i, '')
        .trim();
}

const CLICK_EDITOR_SYMBOLS = [
    { token: ':up:', label: 'Up arrow', file: 'passive_skill_dialog_arrow01.png' },
    { token: ':down:', label: 'Down arrow', file: 'passive_skill_dialog_arrow02.png' },
    { token: ':ydown:', label: 'Enemy down', file: 'passive_skill_dialog_arrow03.png' },
    { token: ':once:', label: 'Once only', file: 'passive_skill_dialog_icon_01.png' },
    { token: ':inf:', label: 'Infinite (∞)', file: 'passive_skill_dialog_icon_02.png' },
    { token: ':atk_up:', label: 'ATK up', file: 'st_0001.png' },
    { token: ':def_up:', label: 'DEF up', file: 'st_0002.png' },
    { token: ':ki_up:', label: 'Ki up', file: 'st_0003.png' },
    { token: ':atk_down:', label: 'ATK down', file: 'st_0011.png' },
    { token: ':def_down:', label: 'DEF down', file: 'st_0012.png' },
    { token: ':stun:', label: 'Stun', file: 'st_0100.png' },
    { token: ':seal:', label: 'Seal', file: 'st_0102.png' },
    { token: ':break:', label: 'Action break', file: 'st_1009.png' },
    { token: ':crit:', label: 'Critical', file: 'st_critical_up.png' },
    { token: ':add_atk:', label: 'Additional attack', file: 'st_atk_combo.png' },
    { token: ':effective:', label: 'Effective against all types', file: 'st_atk_super.png' },
    { token: ':always_hit:', label: 'Sure hit', file: 'st_always_hit.png' },
    { token: ':guard:', label: 'Guard', file: 'st_sp_guard.png' },
    { token: ':dmg_red:', label: 'Damage reduction', file: 'st_resist_damage_up.png' },
    { token: ':evasion:', label: 'Evasion', file: 'st_evasion.png' },
    { token: ':disable_guard:', label: 'Disable guard', file: 'st_disable_guard.png' },
    { token: ':rainbow_ki:', label: 'Rainbow Ki', file: 'ki_change_rainbow.png' },
    { token: ':heal:', label: 'Recovery', file: 'st_recover.png' },
    { token: ':revive:', label: 'Revive', file: 'st_revive.png' },
    { token: ':survive_ko:', label: 'Survive KO', file: 'st_invalid_ko.png' },
    { token: ':taunt:', label: 'Taunt', file: 'st_target.png' },
    { token: ':counter:', label: 'Counter', file: 'st_counter.png' },
    { token: ':reversible:', label: 'Reversal', file: 'st_reversible.png' }
];

window.contextEditorLastTextTargetId = window.contextEditorLastTextTargetId || '';
window.contextEditorSelectionRanges = window.contextEditorSelectionRanges || new Map();
window.passiveEditorPreviewExpanded = (() => {
    try {
        return localStorage.getItem('passive-editor-preview-expanded-v1') !== 'false';
    } catch (e) {
        return true;
    }
})();

function clickEditorSourceTextFromElement(element) {
    if (!element) return '';
    if (element.hasAttribute('data-click-edit-source-text')) {
        return element.getAttribute('data-click-edit-source-text') || '';
    }

    const clone = element.cloneNode(true);
    clone.querySelectorAll('br').forEach(br => br.replaceWith(document.createTextNode('\n')));
    clone.querySelectorAll('img').forEach(img => {
        const file = (img.getAttribute('src') || '').split(/[?#]/)[0].split('/').pop();
        const symbol = CLICK_EDITOR_SYMBOLS.find(icon => icon.file === file);
        img.replaceWith(document.createTextNode(symbol?.token || img.getAttribute('alt') || ''));
    });
    return clone.textContent || element.innerText || '';
}

window.captureContextEditorCursor = function(field = document.activeElement) {
    const gui = document.getElementById('context-gui');
    if (!gui || !field || !gui.contains(field) || !field.classList?.contains('context-symbol-target')) return;
    if (!Number.isInteger(field.selectionStart) || !Number.isInteger(field.selectionEnd)) return;
    window.contextEditorLastTextTargetId = field.id;
    window.contextEditorSelectionRanges.set(field.id, {
        start: field.selectionStart,
        end: field.selectionEnd
    });
};

['focusin', 'input', 'keyup', 'click', 'select', 'blur'].forEach(eventName => {
    document.addEventListener(eventName, event => {
        if (event.target?.matches?.('#context-gui .context-symbol-target')) {
            window.captureContextEditorCursor(event.target);
        }
    }, true);
});

document.addEventListener('pointerdown', event => {
    if (event.target?.closest?.('.context-editor-symbol-button')) {
        window.captureContextEditorCursor();
    }
}, true);

window.insertContextEditorSymbol = function(token, fallbackTargetId = '') {
    const gui = document.getElementById('context-gui');
    let field = document.getElementById(window.contextEditorLastTextTargetId);
    if (!gui || !field || !gui.contains(field) || !field.classList.contains('context-symbol-target')) {
        field = document.getElementById(fallbackTargetId);
    }
    if (!field || !field.classList.contains('context-symbol-target')) return;

    const value = String(field.value ?? '');
    const remembered = window.contextEditorSelectionRanges.get(field.id);
    const isFocused = document.activeElement === field;
    const start = Math.max(0, Math.min(value.length, isFocused
        ? field.selectionStart
        : (remembered?.start ?? value.length)));
    const end = Math.max(start, Math.min(value.length, isFocused
        ? field.selectionEnd
        : (remembered?.end ?? start)));

    field.focus({ preventScroll: true });
    field.setRangeText(token, start, end, 'end');
    field.dispatchEvent(new Event('input', { bubbles: true }));
    const cursor = start + token.length;
    field.setSelectionRange(cursor, cursor);
    window.captureContextEditorCursor(field);
};

window.renderContextEditorSymbolRail = function(defaultTargetId) {
    const renderChoice = icon => `
        <button type="button" class="context-editor-symbol-button" data-symbol-token="${icon.token}"
            title="${escapeContextHtml(icon.label)}" aria-label="Insert ${escapeContextHtml(icon.label)} (${icon.token})"
            onpointerdown="window.captureContextEditorCursor()"
            onclick="window.insertContextEditorSymbol('${icon.token}', '${defaultTargetId}')">
            <img src="${escapeContextHtml(window.normalizeAssetUrl?.(icon.file) || `https://abscustom.github.io/assets/images/${icon.file}`)}" alt="" draggable="false">
        </button>`;

    return `
        <aside class="context-editor-symbol-rail" aria-label="Text symbols">
            <div class="context-editor-symbol-heading">Quick Picks</div>
            <div class="context-editor-symbol-grid context-editor-symbol-quick-picks" aria-label="Quick Picks">${CLICK_EDITOR_SYMBOLS.slice(0, 5).map(renderChoice).join('')}</div>
            <details class="context-editor-symbol-more">
                <summary>More Symbols</summary>
                <div class="context-editor-symbol-grid context-editor-symbol-more-list" tabindex="0" aria-label="More Symbols">${CLICK_EDITOR_SYMBOLS.slice(5).map(renderChoice).join('')}</div>
            </details>
        </aside>`;
};

window.renderClickEditorShell = function({ defaultTargetId, contentHTML, navigationHTML = '', actionHTML = '', className = '' }) {
    return `
        <div class="click-editor-layout ${className}" data-default-symbol-target="${defaultTargetId}">
            ${window.renderContextEditorSymbolRail(defaultTargetId)}
            <section class="click-editor-fields">
                ${navigationHTML}
                <button type="button" class="click-editor-symbol-toggle" aria-expanded="false" onclick="window.toggleContextSymbolPanel(this)">Symbols</button>
                <div class="click-editor-fields-scroll" tabindex="0" aria-label="Editor fields">${contentHTML}</div>
                ${actionHTML ? `<div class="click-editor-action-bar">${actionHTML}</div>` : ''}
            </section>
        </div>`;
};

window.toggleContextSymbolPanel = function(button) {
    const layout = button?.closest('.click-editor-layout');
    if (!layout) return;
    const isOpen = layout.classList.toggle('symbols-open');
    button.setAttribute('aria-expanded', String(isOpen));
};

window.togglePassiveEditorPreview = function(button) {
    const section = button?.closest('.passive-editor-preview-section');
    const preview = section?.querySelector('.passive-editor-preview');
    if (!section || !preview) return;
    window.passiveEditorPreviewExpanded = !window.passiveEditorPreviewExpanded;
    preview.hidden = !window.passiveEditorPreviewExpanded;
    button.textContent = window.passiveEditorPreviewExpanded ? 'Hide preview' : 'Show preview';
    button.setAttribute('aria-expanded', String(window.passiveEditorPreviewExpanded));
    try {
        localStorage.setItem('passive-editor-preview-expanded-v1', String(window.passiveEditorPreviewExpanded));
    } catch (e) {}
};

document.addEventListener('DOMContentLoaded', () => {
    const observer = new MutationObserver(() => {
        sanitizeLinksAndCategories();
    });

    const linkCont = document.getElementById('card-link-container');
    const catCont = document.getElementById('card-category-container');

    if (linkCont) observer.observe(linkCont, { childList: true, subtree: true });
    if (catCont) observer.observe(catCont, { childList: true, subtree: true });
    
    sanitizeLinksAndCategories();
    syncPublishedEditorLockUi();
});

window.ADMIN_MODE = false;

function isPublishedEditorLocked() {
    return Boolean(window.IS_PUBLISHED && window.ADMIN_MODE !== true);
}

window.isPublishedEditorLocked = isPublishedEditorLocked;

function syncPublishedEditorLockUi() {
    const locked = isPublishedEditorLocked();
    const body = document.body;
    if (!body) return;

    body.classList.toggle('published-editor-locked', locked);

    const topBar = document.getElementById('editor-top-bar');
    const topTrigger = document.getElementById('editor-top-bar-trigger');
    const settingsDrawer = document.getElementById('settingsDrawer');
    const settingsOverlay = document.getElementById('settingsOverlay');
    const settingsButton = document.getElementById('sba-side-settings-button');
    const contextGui = document.getElementById('context-gui');

    if (locked) {
        body.classList.remove('quick-edit-open', 'sba-bottom-nav-visible', 'sba-side-settings-open', 'editor-sidebar-open');
        topBar?.classList.remove('is-revealed');
        topTrigger?.classList.remove('is-revealed');
        settingsDrawer?.classList.remove('open');
        settingsOverlay?.classList.remove('open');
        settingsButton?.setAttribute('aria-expanded', 'false');
        if (contextGui) contextGui.style.display = 'none';
        window.clearCardGlow?.();
    } else if (window.IS_PUBLISHED) {
        // The controls stay hidden until the password is accepted, then the
        // normal editor affordances become available again.
        topBar?.classList.add('is-revealed');
        window.revealToolSbaNav?.();
    }
}

window.syncPublishedEditorLockUi = syncPublishedEditorLockUi;

window.unlockAdminMode = function() {
    if (window.ADMIN_MODE) {
        window.ADMIN_MODE = false;
        document.body.classList.remove('admin-mode-active');
        document.body.classList.remove('quick-edit-open');
        const sidebar = document.getElementById('editor');
        const toggleBtn = document.getElementById('toggleBtn');
        const quickSaveBtn = document.getElementById('admin-quick-save-btn');
        const quickEditBtn = document.getElementById('topbar-quick-edit-btn');
        const uploadDockBtn = document.getElementById('topbar-upload-dock-wrap');

        if (window.IS_PUBLISHED) {
            if (sidebar) sidebar.style.display = 'none';
            if (toggleBtn) toggleBtn.style.display = 'none';
            if (uploadDockBtn) uploadDockBtn.style.setProperty('display', 'none', 'important');
            if (quickEditBtn) quickEditBtn.style.setProperty('display', 'none', 'important');
            window.stopEditorAutosave?.();
        }
        if (quickSaveBtn) quickSaveBtn.style.setProperty('display', 'none', 'important');

        syncPublishedEditorLockUi();
        window.clearCardGlow();
        alert("🔒 Admin Mode Deactivated.");
        return;
    }

    const _adminModal = document.getElementById('glass-admin-unlock-modal');
    if (_adminModal) { _adminModal.classList.remove('is-closing'); _adminModal.style.display = 'flex'; }
    document.getElementById('admin-unlock-pass').value = '';
    document.getElementById('confirm-admin-unlock-btn').disabled = true;
    setTimeout(() => document.getElementById('admin-unlock-pass').focus(), 100);
};

window.closeAdminUnlockModal = function() {
    window.fadeOutModal ? window.fadeOutModal('glass-admin-unlock-modal') : (document.getElementById('glass-admin-unlock-modal').style.display = 'none');
};

window.checkAdminUnlockValidity = function() {
    const pass = document.getElementById('admin-unlock-pass').value;
    const btn = document.getElementById('confirm-admin-unlock-btn');
    btn.disabled = (pass !== "spiderman");
};

window.executeAdminUnlock = function() {
    window.closeAdminUnlockModal();
    window.ADMIN_MODE = true;
    document.body.classList.add('admin-mode-active');

    window.startEditorAutosave?.();
    syncPublishedEditorLockUi();

    if (window.ensureAdminActionsDock) {
        window.ensureAdminActionsDock();
    } else if (window.ensurePublishedCustomCardRuntime) {
        window.ensurePublishedCustomCardRuntime();
    }

    const sidebar = document.getElementById('editor');
    const toggleBtn = document.getElementById('toggleBtn');
    const quickSaveBtn = document.getElementById('admin-quick-save-btn');
    const quickEditBtn = document.getElementById('topbar-quick-edit-btn');
    const uploadDockBtn = document.getElementById('topbar-upload-dock-wrap');

    if (sidebar) sidebar.style.display = 'block';
    if (toggleBtn) toggleBtn.style.display = 'flex';
    if (quickSaveBtn) {
        const canQuickSave = Boolean(window.IS_PUBLISHED && window.PUBLISHED_CARD_SOURCE !== 'official');
        quickSaveBtn.style.setProperty('display', canQuickSave ? 'flex' : 'none', 'important');
    }
    if (uploadDockBtn) uploadDockBtn.style.setProperty('display', 'inline-block', 'important');
    if (quickEditBtn) {
        quickEditBtn.style.setProperty('display', window.IS_PUBLISHED ? 'inline-flex' : 'none', 'important');
    }

    ensureGUIContainerExists();
    makeGUIDraggable();

    if (window.syncToAbsLayout) window.syncToAbsLayout();
};

document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault();
        window.unlockAdminMode();
    }
});

// Click-to-Edit Route Handler
document.addEventListener('click', function(e) {
    if (isPublishedEditorLocked()) return;

    ensureGUIContainerExists();

    if (e.target.closest('#context-gui, #editor, nav, .navbar, #abs-stat-range-slider, .abs-slider-ticks, .glass-modal-overlay')) return;

    let editType = null;
    let target = e.target.closest('[data-edit]');
    const passiveRoot = e.target.closest('[data-edit="passive"], #abs-passive-skill-box');

    if (passiveRoot) {
        if (window.ensurePassiveEditorSections) window.ensurePassiveEditorSections();
        const sideSections = Array.from(document.querySelectorAll('#sidebar-sections-area [id^="side-sec-"]'));
        const cardSection = e.target.closest('#card-passive-container [id^="card-sec-"]');
        let selectedId = cardSection?.id.match(/^card-sec-(\d+)$/)?.[1] || null;

        if (!selectedId) {
            const absContainer = window.getCardLayoutElement?.('abs-passive-container') || e.target.closest('#abs-passive-container');
            const absTitle = e.target.closest('#abs-passive-container .abs-passive-section-title')
                || e.target.closest('.abs-passive-section-title')
                || e.target.closest('.abs-passive-list')?.previousElementSibling;
            if (absContainer && absTitle) {
                const absTitles = Array.from(absContainer.querySelectorAll('.abs-passive-section-title'));
                const index = absTitles.indexOf(absTitle);
                const sideId = sideSections[index]?.id.match(/^side-sec-(\d+)$/)?.[1];
                if (sideId) selectedId = sideId;
            }
        }

        window.passiveEditorView = selectedId ? 'detail' : 'overview';
        window.selectedPassiveSectionId = selectedId ? Number(selectedId) : null;
        editType = 'passive';
        target = passiveRoot;
    }

    // ABS renders SAs in display order (Ki/EX), which can differ from the
    // source .sa-block order. Resolve the rendered card by its explicit
    // source index before opening the editor.
    const resolveRenderedSuperAttack = (rendered) => {
        if (!rendered) return null;
        const infoSource = window.resolveInfoEditorSkillSource?.(rendered);
        if (infoSource?.classList?.contains('sa-block')) return infoSource;
        const sourceIndex = Number.parseInt(rendered.getAttribute('data-sa-source-index'), 10);
        const sourceBlocks = Array.from(document.querySelectorAll('.sa-block'));
        if (Number.isInteger(sourceIndex) && sourceBlocks[sourceIndex]) return sourceBlocks[sourceIndex];
        return null;
    };

    if (passiveRoot) {
        // Passive clicks are handled above so the section id is captured
        // before the enclosing data-edit card can swallow the click.
    } else if (target) {
        editType = target.getAttribute('data-edit');
        if (editType === 'sa') {
            const visibleTarget = target.closest('[data-info-source-skill-id], [data-sa-source-index]') || target;
            currentSuperAttack = resolveRenderedSuperAttack(visibleTarget) || currentSuperAttack || document.querySelector('.sa-block');
            target = visibleTarget || currentSuperAttack || target;
        }
        if (editType === 'active') {
            // Clean mode renders Active Skills/Dokkan Fields in separate
            // containers. Resolve that visual card back to its source block
            // before opening the editor; otherwise the GUI has no editable
            // block after the card has been widened or reparented.
            const renderedActive = target.closest(
                '[data-edit="active"], .abs-clean-active-rendered, .abs-clean-domain-rendered, .abs-clean-standby-rendered, #abs-active-container > .abs-box, #abs-active-container > div, #abs-field-container > .abs-box, #abs-field-container > div, #abs-standby-container > .abs-box, #abs-standby-container > div'
            ) || target;
            const clickedActive = e.target.closest('.active-block');
            currentActiveSkill = window.resolveInfoEditorSkillSource?.(renderedActive) || clickedActive || window.resolveActiveSkillBlock?.(renderedActive) || currentActiveSkill || null;
            target = renderedActive || clickedActive || target;
        }
    } else {
        if (e.target.closest('#char-name, #char-description, #abs-char-title, #abs-char-name, .abs-header-text, #release-dates-container, .abs-awaken-date, #abs-clean-info-bar, .abs-clean-info-box, #abs-clean-identity-icons, .abs-clean-id-badge')) {
            editType = 'identity';
            target = e.target.closest('.abs-clean-id-badge, #abs-clean-identity-icons, .abs-clean-info-box, #abs-clean-info-bar') || document.getElementById('release-dates-container') || e.target.closest('.abs-header-text, .abs-awaken-date') || e.target;
        } else if (e.target.closest('#leader-skill, #abs-leader-skill, #abs-clean-leader-bar, #abs-clean-leader-text, [data-edit="leader"]') || (e.target.closest('.abs-box') && e.target.closest('.abs-box').querySelector('#abs-leader-skill'))) {
            editType = 'leader';
            target = e.target.closest('#abs-clean-leader-bar, #abs-clean-leader-text') || e.target.closest('.abs-box') || e.target;
        } else if (e.target.closest('#card-passive-container, .passive-name-display, #abs-passive-container, #abs-passive-name')) {
            editType = 'passive';
            target = e.target.closest('.abs-box') || e.target;
        } else if (e.target.closest('#card-link-container, #abs-link-container, .abs-links-container, .abs-link-badge')) {
            editType = 'links';
            target = e.target.closest('.abs-box') || e.target;
        } else if (e.target.closest('#card-category-container, #abs-category-container')) {
            editType = 'categories';
            target = e.target.closest('.abs-box') || e.target;
        } else if (e.target.closest('#myOverlayImage, #myOverlayVideo, .card-art-canvas, .abs-art-box, #abs-art-dock-wrapper, #abs-clean-portrait-stage')) {
            editType = 'art';
            target = (window.getCardLayoutElement ? window.getCardLayoutElement('abs-clean-portrait-stage') : document.getElementById('abs-clean-portrait-stage')) || (window.getCardLayoutElement ? window.getCardLayoutElement('abs-art-dock-wrapper') : document.getElementById('abs-art-dock-wrapper')) || e.target;
        } else if (e.target.closest('#forms-container, #abs-transformations-box, #abs-transformations-container, [data-abs-clean-section="forms"], #abs-clean-awakening-forms-forms-slot, [data-edit="forms"], .abs-transform-row')) {
            editType = 'forms';
            target = document.getElementById('forms-container') || (window.getCardLayoutElement ? window.getCardLayoutElement('abs-transformations-box') : document.getElementById('abs-transformations-box')) || e.target.closest('[data-abs-clean-section="forms"], #abs-transformations-box, #abs-clean-awakening-forms-forms-slot') || e.target;
        } else if (e.target.closest('#ssr-row, #tur-row, #img-ssr, #img-tur, #img-lr, .card-icon, #abs-awakenings-box, .abs-awaken-row, .abs-awaken-divider, #abs-composed-icon, #abs-top-rarity-icon, #abs-rarity-icon, #main-rarity-icon, #ssr-rarity-icon, #tur-rarity-icon, #awakening-container, #abs-awakening-img, #abs-clean-awakening-portraits, .abs-clean-awakening-portrait, #abs-clean-ssr-portrait, #abs-clean-tur-portrait') && !e.target.closest('.abs-awaken-date')) {
            editType = 'icons';
            target = e.target.closest('.abs-box, .dokkan-card, #abs-clean-awakening-portraits, .abs-clean-awakening-portrait') || e.target;
        } else if (e.target.closest('table.col, #abs-stats-box, #abs-clean-header-stats, .abs-stat-cards-row, .abs-stat-slider-wrapper, #abs-clean-portrait-callouts, .abs-clean-callout')) {
            editType = 'stats';
            target = e.target.closest('.abs-clean-callout') || (window.getCardLayoutElement ? window.getCardLayoutElement('abs-stats-box') : document.getElementById('abs-stats-box')) || e.target;
        } else if (e.target.closest('.sa-block, #abs-sa-container > div')) {
            editType = 'sa';
            let clickedBlock = e.target.closest('.sa-block');
            if (!clickedBlock) {
                const dbBlock = e.target.closest('#abs-sa-container > div');
                const dbContainer = (window.getCardLayoutElement ? window.getCardLayoutElement('abs-sa-container') : document.getElementById('abs-sa-container'));
                const dbBlocks = Array.from(dbContainer.children);
                clickedBlock = resolveRenderedSuperAttack(dbBlock);
                if (!clickedBlock) {
                    let index = dbBlocks.indexOf(dbBlock);
                    if (index === -1) index = 0;
                    clickedBlock = document.querySelectorAll('.sa-block')[index];
                }
            }
            currentSuperAttack = clickedBlock;
            target = clickedBlock || e.target.closest('#abs-sa-container > div');
        } else if (e.target.closest('.active-block, #abs-active-container > .abs-box, #abs-active-container > div, #abs-field-container > .abs-box, #abs-field-container > div, #abs-standby-container > .abs-box, #abs-standby-container > div')) {
            editType = 'active';
            const clickedActive = e.target.closest('.active-block');
            const renderedActive = e.target.closest(
                '[data-edit="active"], .abs-clean-active-rendered, .abs-clean-domain-rendered, .abs-clean-standby-rendered, #abs-active-container > .abs-box, #abs-active-container > div, #abs-field-container > .abs-box, #abs-field-container > div, #abs-standby-container > .abs-box, #abs-standby-container > div'
            );
            currentActiveSkill = clickedActive || window.resolveActiveSkillBlock?.(renderedActive) || null;
            target = renderedActive || clickedActive || e.target;
        }
        target = target || e.target;
    }

    if (!editType) return;

    e.preventDefault();
    openContextGUI(e.clientX, e.clientY, editType, target);
});

window.passiveUndoStack = [];
window.saUndoStack = [];
window.activeUndoStack = [];
window.formUndoStack = [];
window.guiSelectedSAIcon = "https://abscustom.github.io/assets/images/st_0001.png";
window.collapsedPassiveSections = new Set();
window.passiveEditorView = window.passiveEditorView || 'overview';
window.selectedPassiveSectionId = window.selectedPassiveSectionId ?? null;
window.passiveDeleteToastToken = window.passiveDeleteToastToken || 0;

function getPassiveEditorSectionRecords() {
    if (window.ensurePassiveEditorSections) window.ensurePassiveEditorSections();
    return Array.from(document.querySelectorAll('#sidebar-sections-area [id^="side-sec-"]'))
        .map((element, index) => {
            const match = element.id.match(/^side-sec-(\d+)$/);
            if (!match) return null;
            return {
                id: Number(match[1]),
                index,
                element,
                header: element.querySelector('input[type="text"]')?.value || 'Basic effect(s)',
                text: element.querySelector('textarea')?.value || ''
            };
        })
        .filter(Boolean);
}

window.applyPassiveSectionHighlight = function(id) {
    document.querySelectorAll('.passive-section-edit-selected').forEach(element => {
        element.classList.remove('passive-section-edit-selected');
    });
    document.querySelectorAll('.passive-header-edit-selected').forEach(element => {
        element.classList.remove('passive-header-edit-selected');
    });
    if (id === null || id === undefined || id === '') return;

    const record = getPassiveEditorSectionRecords().find(section => section.id === Number(id));
    if (!record) return;

    if (['abs-style', 'abs-clean', 'sba'].includes(window.currentCardThemeStyle)) {
        const container = (window.getCardLayoutElement ? window.getCardLayoutElement('abs-passive-container') : document.getElementById('abs-passive-container'));
        const title = container?.querySelectorAll('.abs-passive-section-title')[record.index];
        if (!title) return;
        title.classList.add('passive-section-edit-selected');
        const list = title.nextElementSibling;
        if (list?.classList.contains('abs-passive-list')) list.classList.add('passive-section-edit-selected');
        return;
    }

    document.getElementById(`card-sec-${record.id}`)?.classList.add('passive-section-edit-selected');
};

window.applyPassiveHeaderHighlight = function(isSelected) {
    document.querySelectorAll('.passive-header-edit-selected').forEach(element => {
        element.classList.remove('passive-header-edit-selected');
    });
    if (!isSelected) return;

    let preview = ['abs-style', 'abs-clean', 'sba'].includes(window.currentCardThemeStyle)
        ? (window.getCardLayoutElement ? window.getCardLayoutElement('abs-passive-skill-box') : document.getElementById('abs-passive-skill-box'))
        : document.getElementById('card-passive-container');
    if (!preview) preview = document.querySelector('[data-edit="passive"]');
    preview?.classList.add('passive-header-edit-selected');
};

window.watchAbsPassiveSectionRender = function() {
    const container = (window.getCardLayoutElement ? window.getCardLayoutElement('abs-passive-container') : document.getElementById('abs-passive-container'));
    if (!container || window.passiveSectionRenderObserver?.container === container) return;
    const observer = new MutationObserver(records => {
        const needsHighlightRefresh = records.some(record => {
            const target = record.target.nodeType === Node.ELEMENT_NODE
                ? record.target
                : record.target.parentElement;
            return !target?.closest('.abs-passive-name-inside');
        });
        if (!needsHighlightRefresh) return;

        window.requestAnimationFrame(() => {
            const gui = document.getElementById('context-gui');
            if (window.activeContextGUIType === 'passive' && gui && gui.style.display !== 'none') {
                if (window.passiveEditorView === 'detail') {
                    window.applyPassiveSectionHighlight(window.selectedPassiveSectionId);
                } else {
                    window.applyPassiveHeaderHighlight(true);
                }
            }
        });
    });
    observer.observe(container, { childList: true, subtree: true });
    window.passiveSectionRenderObserver = { container, observer };
};

window.updatePassiveEditorPreview = function(id, text) {
    const preview = document.getElementById(`gui-sec-preview-${id}`);
    if (!preview) return;
    const safeText = escapeContextHtml(String(text ?? '')).replace(/\r?\n/g, '<br>');
    preview.innerHTML = typeof window.parsePassiveIcons === 'function'
        ? window.parsePassiveIcons(safeText)
        : safeText;
};

window.positionPassiveEditor = function(gui, id, allowScroll = true, requestToken = null) {
    if (!gui) return;
    const isMobile = window.innerWidth <= 680;
    const record = getPassiveEditorSectionRecords().find(section => section.id === Number(id));
    if (!record) return;

    let anchor = document.getElementById(`card-sec-${record.id}`);
    if (['abs-style', 'abs-clean', 'sba'].includes(window.currentCardThemeStyle)) {
        const container = (window.getCardLayoutElement ? window.getCardLayoutElement('abs-passive-container') : document.getElementById('abs-passive-container'));
        anchor = container?.querySelectorAll('.abs-passive-section-title')[record.index] || anchor;
    }
    if (!anchor) return;

    const rect = anchor.getBoundingClientRect();
    const panel = gui.getBoundingClientRect();
    const topBarClearance = 76;
    const visibleBottom = isMobile ? panel.top - 12 : window.innerHeight - 12;
    const sectionBottom = () => {
        const list = ['abs-style', 'abs-clean', 'sba'].includes(window.currentCardThemeStyle) ? anchor.nextElementSibling : null;
        return list?.classList.contains('abs-passive-list') ? list.getBoundingClientRect().bottom : rect.bottom;
    };
    const isOffscreen = rect.top < topBarClearance || sectionBottom() > visibleBottom;
    if (allowScroll && isOffscreen) {
        const token = ++window.passivePanelPositionToken;
        const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
        const scrollBehavior = reducedMotion ? 'auto' : 'smooth';
        const alignSectionAbovePanel = (currentTop, currentBottom) => {
            const sectionHeight = currentBottom - currentTop;
            const visibleHeight = Math.max(0, visibleBottom - topBarClearance);
            const desiredTop = sectionHeight <= visibleHeight
                ? Math.max(topBarClearance, Math.min(currentTop, visibleBottom - sectionHeight))
                : topBarClearance;
            const delta = currentTop - desiredTop;
            if (Math.abs(delta) > 1) window.scrollBy({ top: delta, behavior: scrollBehavior });
        };

        if (isMobile) {
            alignSectionAbovePanel(rect.top, sectionBottom());
        } else if (anchor.scrollIntoView) {
            anchor.scrollIntoView({ behavior: scrollBehavior, block: 'center', inline: 'nearest' });
        }
        window.setTimeout(() => {
            if (window.passivePanelPositionToken === token && gui.style.display !== 'none') {
                if (isMobile) {
                    const updatedRect = anchor.getBoundingClientRect();
                    const list = ['abs-style', 'abs-clean', 'sba'].includes(window.currentCardThemeStyle) ? anchor.nextElementSibling : null;
                    const updatedBottom = list?.classList.contains('abs-passive-list')
                        ? list.getBoundingClientRect().bottom
                        : updatedRect.bottom;
                    alignSectionAbovePanel(updatedRect.top, updatedBottom);
                }
                window.positionPassiveEditor(gui, id, false, token);
            }
        }, reducedMotion ? 0 : 420);
        return;
    }

    if (requestToken !== null && requestToken !== window.passivePanelPositionToken) return;
    if (isMobile) return;
    const margin = 12;
    const gap = 14;
    const rightSpace = window.innerWidth - rect.right;
    const leftSpace = rect.left;
    let left = rightSpace >= panel.width + gap
        ? rect.right + gap
        : (leftSpace >= panel.width + gap
            ? rect.left - panel.width - gap
            : (rightSpace >= leftSpace ? rect.right + gap : rect.left - panel.width - gap));
    const maxLeft = Math.max(margin, window.innerWidth - panel.width - margin);
    left = Math.min(maxLeft, Math.max(margin, left));

    const maxTop = Math.max(topBarClearance, window.innerHeight - panel.height - margin);
    const top = Math.min(maxTop, Math.max(topBarClearance, rect.top));
    const zoom = window.getContextGUIZoom();
    gui.style.right = 'auto';
    gui.style.bottom = 'auto';
    gui.style.left = `${left / zoom}px`;
    gui.style.top = `${top / zoom}px`;
};
window.passivePanelPositionToken = 0;

function ensureGUIContainerExists() {
    if (!document.getElementById('context-gui')) {
        const isCustomPublished = Boolean(window.IS_PUBLISHED && window.PUBLISHED_CARD_SOURCE !== 'official');
        const showQuickSave = !window.IS_PUBLISHED || isCustomPublished;
        const guiHTML = `
        <div id="context-gui">
            <div class="gui-header">
                <span id="gui-title" class="gui-title">⚙️ Editor</span>
                <div class="gui-header-actions" style="display: flex; align-items: center; gap: 6px;">
                    <button type="button" id="gui-quick-save-btn" class="gui-header-save-btn" onclick="window.saveQuickEditToGitHub?.()" title="Save Quick Edit to GitHub" style="${showQuickSave ? 'display: inline-flex;' : 'display: none;'}">
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" style="display:inline-block; vertical-align:-1px; margin-right:3px;"><path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/></svg>Save
                    </button>
                    <button type="button" class="gui-close" onclick="closeContextGUI()">×</button>
                </div>
            </div>
            <div id="gui-content"></div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', guiHTML);
    }
    makeGUIDraggable();
}

window.closeContextGUI = function() {
    const gui = document.getElementById('context-gui');
    if (gui) gui.style.display = 'none';
    document.body.classList.remove('quick-edit-open');
    if (!window.ADMIN_MODE) {
        const quickSaveBtn = document.getElementById('admin-quick-save-btn');
        if (quickSaveBtn) quickSaveBtn.style.setProperty('display', 'none', 'important');
    }
    window.clearCardGlow();
};

window.highlightCardElement = function(element) {
    window.clearCardGlow();
    if (!element || isPublishedEditorLocked()) return;
    const cleanMainIcon = document.body.classList.contains('theme-abs-clean')
        ? (element.closest('#layout-abs-style #abs-composed-icon') || element.querySelector?.('#abs-composed-icon'))
        : null;
    const outerBox = cleanMainIcon || element.closest('.dokkan-card, .abs-box, .sa-block, .active-block, .abs-header-text, .abs-art-dock-wrapper, #abs-clean-portrait-stage, #abs-clean-leader-bar, #abs-clean-header-stats, #abs-categories-box, #abs-link-skills-box, #abs-stats-box, #abs-passive-skill-box, #abs-leader-skill-box, #abs-sa-container > div, #abs-sa-container, #abs-category-container, [data-edit]') || element;
    if (outerBox) outerBox.classList.add('active-selected-glow');
};

window.clearCardGlow = function() {
    document.querySelectorAll('.active-selected-glow, .passive-section-edit-selected, .passive-header-edit-selected, .active-skill-edit-selected').forEach(el => {
        el.classList.remove('active-selected-glow');
        el.classList.remove('passive-section-edit-selected');
        el.classList.remove('passive-header-edit-selected');
        el.classList.remove('active-skill-edit-selected');
    });
};

window.applyActiveSkillHighlight = function(targetElement = null) {
    document.querySelectorAll('.active-skill-edit-selected').forEach(element => {
        element.classList.remove('active-skill-edit-selected');
    });

    const source = window.resolveActiveSkillBlock?.(currentActiveSkill) || currentActiveSkill;
    if (!source) return;
    currentActiveSkill = source;
    const sourceBlocks = window.getActiveSkillSourceBlocks?.() || Array.from(document.querySelectorAll('.active-block'));
    const sourceIndex = sourceBlocks.indexOf(source);
    const sourceId = source.getAttribute('data-editor-skill-id');
    const targetPreview = targetElement?.closest?.(
        '[data-abs-clean-source-index], .abs-clean-active-rendered, .abs-clean-domain-rendered, .abs-clean-standby-rendered, #abs-active-container > .abs-box, #abs-active-container > div, #abs-field-container > .abs-box, #abs-field-container > div, #abs-standby-container > .abs-box, #abs-standby-container > div, .active-block, [data-edit="active"]'
    );

    let preview = null;
    if (sourceId) {
        preview = Array.from(document.querySelectorAll('[data-info-source-skill-id]'))
            .find(element => element.dataset.infoSourceSkillId === sourceId) || null;
    }
    if (Number.isInteger(sourceIndex) && sourceIndex >= 0) {
        preview = Array.from(document.querySelectorAll('[data-abs-clean-source-index]'))
            .find(element => Number.parseInt(element.dataset.absCleanSourceIndex || '', 10) === sourceIndex) || null;
    }
    if (!preview && targetPreview && targetPreview !== source) preview = targetPreview;
    if (!preview && targetPreview === source) preview = source;
    if (!preview && source.isConnected) preview = source;
    preview?.classList.add('active-skill-edit-selected');
};

window.watchActiveSkillPreviewRender = function() {
    const target = document.body;
    if (!target || window.activeSkillPreviewObserver?.target === target) return;
    window.activeSkillPreviewObserver?.observer?.disconnect();
    const observer = new MutationObserver(() => {
        const gui = document.getElementById('context-gui');
        if (window.activeContextGUIType === 'active' && gui && gui.style.display !== 'none') {
            window.requestAnimationFrame(() => window.applyActiveSkillHighlight());
        }
    });
    observer.observe(target, { childList: true, subtree: true });
    window.activeSkillPreviewObserver = { target, observer };
};

window.getContextGUIZoom = function() {
    const gui = document.getElementById('context-gui');
    if (!gui) return 1;
    const computed = parseFloat(window.getComputedStyle(gui).zoom) || 1;
    return computed > 0 ? computed : 1;
};

function makeGUIDraggable() {
    const gui = document.getElementById('context-gui');
    if (!gui) return;
    const header = gui.querySelector('.gui-header');
    if (!header) return;

    header.style.cursor = 'move';
    let isDragging = false;
    let startX = 0, startY = 0, initialLeft = 0, initialTop = 0;

    header.onmousedown = function(e) {
        if (e.target.closest('.gui-close')) return;
        isDragging = true;
        gui.dataset.isDragged = "true";

        const zoom = window.getContextGUIZoom();
        const rect = gui.getBoundingClientRect();
        startX = e.clientX;
        startY = e.clientY;
        initialLeft = rect.left;
        initialTop = rect.top;

        gui.style.position = 'fixed';
        gui.style.left = `${initialLeft / zoom}px`;
        gui.style.top = `${initialTop / zoom}px`;

        document.onmousemove = function(moveEvent) {
            if (!isDragging) return;
            const currentZoom = window.getContextGUIZoom();
            let newLeft = initialLeft + (moveEvent.clientX - startX);
            let newTop = initialTop + (moveEvent.clientY - startY);

            const rectNow = gui.getBoundingClientRect();
            const minTop = 60;
            const minLeft = 10;
            const maxLeft = Math.max(10, window.innerWidth - rectNow.width - 10);
            const maxTop = Math.max(minTop, window.innerHeight - rectNow.height - 10);

            if (newTop < minTop) newTop = minTop;
            if (newTop > maxTop) newTop = maxTop;
            if (newLeft < minLeft) newLeft = minLeft;
            if (newLeft > maxLeft) newLeft = maxLeft;

            gui.style.left = `${newLeft / currentZoom}px`;
            gui.style.top = `${newTop / currentZoom}px`;
        };

        document.onmouseup = function() {
            isDragging = false;
            document.onmousemove = null;
            document.onmouseup = null;
        };
    };
}

function openContextGUI(mouseX, mouseY, editType, targetElement) {
    if (editType === 'icons') editType = 'art';
    if (isPublishedEditorLocked()) return;
    const gui = document.getElementById('context-gui');
    const titleEl = document.getElementById('gui-title');
    const contentEl = document.getElementById('gui-content');

    if (!gui || !titleEl || !contentEl) return;
    window.activeContextGUIType = editType;
    window.activeContextGUITarget = targetElement || window.activeContextGUITarget || null;
    gui.dataset.contextType = editType;
    if (editType === 'passive') gui.dataset.passiveView = window.passiveEditorView || 'overview';
    else delete gui.dataset.passiveView;
    if (editType === 'active') {
        const activeCandidate = targetElement?.closest?.(
            '.active-block, [data-edit="active"], .abs-clean-active-rendered, .abs-clean-domain-rendered, .abs-clean-standby-rendered, #abs-active-container > .abs-box, #abs-active-container > div, #abs-field-container > .abs-box, #abs-field-container > div, #abs-standby-container > .abs-box, #abs-standby-container > div'
        ) || currentActiveSkill;
        currentActiveSkill = window.resolveActiveSkillBlock?.(activeCandidate) || currentActiveSkill;
    }
    if (editType === 'passive') {
        window.clearCardGlow();
        if (window.passiveEditorView === 'detail') {
            window.applyPassiveSectionHighlight?.(window.selectedPassiveSectionId);
            window.applyPassiveHeaderHighlight?.(false);
        } else {
            window.applyPassiveSectionHighlight?.(null);
            window.applyPassiveHeaderHighlight?.(true);
        }
        window.watchAbsPassiveSectionRender?.();
    } else if (editType === 'active') {
        window.clearCardGlow();
        window.applyPassiveSectionHighlight?.(null);
        window.applyPassiveHeaderHighlight?.(false);
        window.applyActiveSkillHighlight?.(targetElement);
        window.watchActiveSkillPreviewRender?.();
    } else {
        window.highlightCardElement(targetElement);
    }

    let titleHTML = "";
    const cloudSvgIcon = `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" style="display:inline-block; vertical-align:-3px; margin-right:4px;"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/></svg>`;
    const undoSvgIcon = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-right:4px;"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13"/></svg>`;
    const identitySvgIcon = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style="display:inline-block; vertical-align:-2px; margin-right:6px;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>`;
    const crownSvgIcon = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style="display:inline-block; vertical-align:-2px; margin-right:6px;"><path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .55-.45 1-1 1H6c-.55 0-1-.45-1-1v-1h14v1z"/></svg>`;
    const statsSvgIcon = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style="display:inline-block; vertical-align:-2px; margin-right:6px;"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/></svg>`;
    const imageUploadSvgIcon = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style="display:inline-block; vertical-align:-2px; margin-right:6px;"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>`;
    const passiveSvgIcon = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style="display:inline-block; vertical-align:-2px; margin-right:6px;"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>`;
    const activeSkillSvgIcon = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style="display:inline-block; vertical-align:-2px; margin-right:6px;"><path d="M12 2l2.4 7.2h7.6l-6.1 4.5 2.3 7.3-6.2-4.6-6.2 4.6 2.3-7.3-6.1-4.5h7.6z"/></svg>`;
    const paletteSvgIcon = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style="display:inline-block; vertical-align:-2px; margin-right:6px;"><path d="M12 3c-4.97 0-9 4.03-9 9 0 2.12.74 4.07 1.97 5.61L4.35 19.4c-.39.39-.39 1.02 0 1.41.39.39 1.02.39 1.41 0l1.9-1.9C9.28 19.63 10.59 20 12 20c4.97 0 9-4.03 9-9s-4.03-9-9-9zm0 15c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z"/></svg>`;
    const formsSvgIcon = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style="display:inline-block; vertical-align:-2px; margin-right:6px;"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>`;
    const linkSvgIcon = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style="display:inline-block; vertical-align:-2px; margin-right:6px;"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/></svg>`;
    const categorySvgIcon = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style="display:inline-block; vertical-align:-2px; margin-right:6px;"><path d="M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58.55 0 1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41 0-.55-.23-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z"/></svg>`;
    const lightningSvgIcon = `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style="display:inline-block; vertical-align:-1px; margin-right:4px;"><path d="M7 2v11h3v9l7-12h-4l4-8z"/></svg>`;
    const addSvgIcon = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" style="display:inline-block; vertical-align:-1px; margin-right:3px;"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
    const deleteSvgIcon = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" style="display:inline-block; vertical-align:-1px; margin-right:3px;"><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;

    switch(editType) {
        case 'identity':
            titleHTML = `${identitySvgIcon} Character Identity & Options`;
            const identityState = window.getCardIdentityState?.();
            const curRarity = identityState?.rarity || window.currentRarity || currentRarity;
            const curClass = identityState?.cardClass || window.currentClass || currentClass;
            const curType = identityState?.type || window.currentType || currentType;
            const curAwakening = window.currentAwakeningMode || currentAwakeningMode;
            const selGlow = "background:#facc15 !important; color:#000 !important; font-weight:900 !important; border-color:#facc15 !important;";

            bodyHTML = `
                <label class="form-label mb-1">Title</label>
                <textarea id="gui-descInput" class="form-control mb-2" style="height:42px;" oninput="guiUpdateIdentityField('descInput', this.value)">${document.getElementById('descInput')?.value || document.getElementById('char-description')?.textContent || ''}</textarea>
                
                <label class="form-label mb-1">Name</label>
                <input type="text" id="gui-nameInput" class="form-control mb-2" value="${document.getElementById('nameInput')?.value || document.getElementById('char-name')?.textContent || ''}" oninput="guiUpdateIdentityField('nameInput', this.value)">
                
                <label class="form-label mb-1">Release Date</label>
                <input type="text" id="gui-dateInput" class="form-control mb-2" value="${document.getElementById('dateInput')?.value || ''}" placeholder="e.g. 9/14/2026 1:00:00 AM EDT" oninput="guiUpdateIdentityField('dateInput', this.value)">
                
                ${(curAwakening === 'eza' || curAwakening === 'seza') ? `
                    <label class="form-label mb-1">EZA Release Date</label>
                    <input type="text" id="gui-ezaDateInput" class="form-control mb-2" value="${document.getElementById('ezaDateInput')?.value || ''}" placeholder="e.g. 10/1/2026" oninput="guiUpdateIdentityField('ezaDateInput', this.value)">
                ` : ''}

                ${(curAwakening === 'seza') ? `
                    <label class="form-label mb-1">SEZA Release Date</label>
                    <input type="text" id="gui-sezaDateInput" class="form-control mb-2" value="${document.getElementById('sezaDateInput')?.value || ''}" placeholder="e.g. 11/1/2026" oninput="guiUpdateIdentityField('sezaDateInput', this.value)">
                ` : ''}

                <label class="form-label mb-1">Rarity</label>
                <div class="gui-btn-grid mb-2">
                    <button type="button" class="gui-preset-btn" style="${curRarity === 'LR' ? selGlow : ''}" onclick="updateRarityStats('LR'); openContextGUI(0,0,'identity');">LR</button>
                    <button type="button" class="gui-preset-btn" style="${curRarity === 'TUR' ? selGlow : ''}" onclick="updateRarityStats('TUR'); openContextGUI(0,0,'identity');">TUR</button>
                </div>

                <label class="form-label mb-1">Class</label>
                <div class="gui-btn-grid mb-2">
                    <button type="button" class="gui-preset-btn" style="${curClass === 'super' ? selGlow : ''}" onclick="window.setCardClass?.('super'); openContextGUI(0,0,'identity');">Super</button>
                    <button type="button" class="gui-preset-btn" style="${curClass === 'extreme' ? selGlow : ''}" onclick="window.setCardClass?.('extreme'); openContextGUI(0,0,'identity');">Extreme</button>
                </div>

                <label class="form-label mb-1">Typing</label>
                <div class="gui-btn-grid mb-2">
                    <button type="button" class="gui-preset-btn" style="${curType === 'agl' ? selGlow : ''}" onclick="applyCardTheme('agl'); openContextGUI(0,0,'identity');">AGL</button>
                    <button type="button" class="gui-preset-btn" style="${curType === 'teq' ? selGlow : ''}" onclick="applyCardTheme('teq'); openContextGUI(0,0,'identity');">TEQ</button>
                    <button type="button" class="gui-preset-btn" style="${curType === 'int' ? selGlow : ''}" onclick="applyCardTheme('int'); openContextGUI(0,0,'identity');">INT</button>
                    <button type="button" class="gui-preset-btn" style="${curType === 'str' ? selGlow : ''}" onclick="applyCardTheme('str'); openContextGUI(0,0,'identity');">STR</button>
                    <button type="button" class="gui-preset-btn" style="${curType === 'phy' ? selGlow : ''}" onclick="applyCardTheme('phy'); openContextGUI(0,0,'identity');">PHY</button>
                </div>

                <label class="form-label mb-1">Awakening Status</label>
                <div class="gui-btn-grid mb-1">
                    <button type="button" class="gui-preset-btn" style="${curAwakening === 'none' ? selGlow : ''}" onclick="applyAwakening('none'); openContextGUI(0,0,'identity');">None</button>
                    <button type="button" class="gui-preset-btn" style="${curAwakening === 'eza' ? selGlow : ''}" onclick="applyAwakening('eza'); openContextGUI(0,0,'identity');">EZA</button>
                    <button type="button" class="gui-preset-btn" style="${curAwakening === 'seza' ? selGlow : ''}" onclick="applyAwakening('seza'); openContextGUI(0,0,'identity');">SEZA</button>
                </div>
            `;
            break;

        case 'leader':
            titleHTML = `${crownSvgIcon} Leader Skill`;
            bodyHTML = `
                <label class="form-label mb-1">Leader Skill Text</label>
                <textarea id="gui-leaderInput" class="form-control mb-2" style="height:90px;">${document.getElementById('leaderInput')?.value || document.getElementById('leader-skill')?.textContent || ''}</textarea>
                <div class="gui-btn-grid mt-2">
                    <button type="button" class="gui-preset-btn" onclick="applyLeaderPreset('dfe'); syncLeaderGUI();">DFE</button>
                    <button type="button" class="gui-preset-btn" onclick="applyLeaderPreset('carnival'); syncLeaderGUI();">Carnival</button>
                    <button type="button" class="gui-preset-btn" onclick="applyLeaderPreset('lr'); syncLeaderGUI();">Legendary Summon</button>
                </div>
            `;
            break;

        case 'stats':
            titleHTML = `${statsSvgIcon} Base Max Stats`;
            bodyHTML = `
                <label class="form-label mb-1">HP (Base Max)</label>
                <input type="number" id="gui-hp-max" class="form-control mb-2" value="${document.getElementById('input-hp-max')?.value || ''}" oninput="if(document.getElementById('input-hp-max')) document.getElementById('input-hp-max').value=this.value; calcFromMax('hp');">
                <label class="form-label mb-1">ATK (Base Max)</label>
                <input type="number" id="gui-atk-max" class="form-control mb-2" value="${document.getElementById('input-atk-max')?.value || ''}" oninput="if(document.getElementById('input-atk-max')) document.getElementById('input-atk-max').value=this.value; calcFromMax('atk');">
                <label class="form-label mb-1">DEF (Base Max)</label>
                <input type="number" id="gui-def-max" class="form-control mb-2" value="${document.getElementById('input-def-max')?.value || ''}" oninput="if(document.getElementById('input-def-max')) document.getElementById('input-def-max').value=this.value; calcFromMax('def');">
            `;
            break;

        case 'passive': {
            titleHTML = `${passiveSvgIcon} Passive Skill`;
            const passiveEntries = getPassiveEditorSectionRecords();
            let selectedPassive = passiveEntries.find(section => section.id === Number(window.selectedPassiveSectionId));
            if (window.passiveEditorView === 'detail' && !selectedPassive) {
                window.passiveEditorView = 'overview';
                window.selectedPassiveSectionId = null;
            }
            const showPassiveDetail = window.passiveEditorView === 'detail' && Boolean(selectedPassive);
            const isAbsStyleTheme = window.currentCardThemeStyle === 'abs-style';
            const isAbsCleanTheme = window.currentCardThemeStyle === 'abs-clean'
                || document.body?.classList.contains('theme-abs-clean');
            const passiveNameValue = escapeContextHtml(
                document.getElementById('input-passive-name-sidebar')?.value
                || document.querySelector('.passive-name-display')?.innerText
                || ''
            );

            const passiveOverviewHTML = passiveEntries.map((section, index) => {
                const cleanPreview = section.text.replace(/\s+/g, ' ').trim();
                const preview = cleanPreview.length > 150 ? `${cleanPreview.slice(0, 147)}…` : cleanPreview;
                const previewText = escapeContextHtml(preview || 'No effect text yet.');
                const previewHTML = typeof window.parsePassiveIcons === 'function'
                    ? window.parsePassiveIcons(previewText)
                    : previewText;
                return `
                    <article class="passive-overview-row">
                        <button type="button" class="passive-overview-select" onclick="guiSelectPassiveSection(${section.id})">
                            <span class="passive-overview-heading">Section ${index + 1}: ${escapeContextHtml(section.header)}</span>
                            <span class="passive-overview-preview">${previewHTML}</span>
                        </button>
                        <div class="passive-overview-actions">
                            <button type="button" class="gui-minimize-btn" aria-label="Move section up" title="Move up" ${index === 0 ? 'disabled' : ''} onclick="guiMovePassiveSection(${section.id}, -1)">↑</button>
                            <button type="button" class="gui-minimize-btn" aria-label="Move section down" title="Move down" ${index === passiveEntries.length - 1 ? 'disabled' : ''} onclick="guiMovePassiveSection(${section.id}, 1)">↓</button>
                            <button type="button" class="gui-minimize-btn passive-overview-copy-btn" aria-label="Copy section" title="Copy section" onclick="guiDuplicatePassiveSection(${section.id})"><svg aria-hidden="true" viewBox="0 0 24 24" focusable="false"><rect x="8" y="8" width="12" height="12" rx="1.5"></rect><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"></path></svg></button>
                        </div>
                    </article>`;
            }).join('');

            let passiveEditorHTML = '';
            let passiveOverviewListHTML = '';
            let passiveNavigationHTML = '';
            let passivePreviewHTML = '';
            let passiveHeaderEditorHTML = '';
            if (showPassiveDetail) {
                const id = selectedPassive.id;
                const previous = passiveEntries[selectedPassive.index - 1];
                const next = passiveEntries[selectedPassive.index + 1];
                const headerVal = escapeContextHtml(selectedPassive.header);
                const textVal = escapeContextHtml(selectedPassive.text);
                const initialPreviewText = escapeContextHtml(selectedPassive.text).replace(/\r?\n/g, '<br>');
                const initialPreview = typeof window.parsePassiveIcons === 'function'
                    ? window.parsePassiveIcons(initialPreviewText)
                    : initialPreviewText;
                passiveNavigationHTML = `
                    <nav class="passive-editor-navigation" aria-label="Passive section navigation and actions">
                        <div class="passive-editor-nav-row">
                            <button type="button" class="gui-preset-btn passive-editor-nav-button" onclick="guiShowPassiveOverview()">All Sections</button>
                            <button type="button" class="gui-preset-btn passive-editor-nav-button" ${previous ? '' : 'disabled'} onclick="guiStepPassiveSection(-1)">Previous</button>
                            <button type="button" class="gui-preset-btn passive-editor-nav-button" ${next ? '' : 'disabled'} onclick="guiStepPassiveSection(1)">Next</button>
                            <button type="button" class="btn btn-danger btn-sm passive-editor-nav-button" onclick="guiDeleteSpecificPassiveSection(${id})">Delete Section</button>
                        </div>
                        <div class="passive-editor-current-title">
                            <span class="passive-editor-editing-label">Editing</span>
                            <span class="passive-editor-title-divider" aria-hidden="true"></span>
                            <span class="passive-editor-current-title-name">${escapeContextHtml(selectedPassive.header || `Section ${selectedPassive.index + 1}`)}</span>
                        </div>
                    </nav>`;
                passiveEditorHTML = `
                    <section class="passive-editor-section-fields" aria-label="Passive section fields">
                        <label class="form-label mb-1" for="gui-sec-header-${id}">Condition / heading</label>
                        <input type="text" id="gui-sec-header-${id}" class="form-control mb-2 context-symbol-target" value="${headerVal}" oninput="const source=document.getElementById('input-sec-hdr-${id}'); if(source) source.value=this.value; updateHeader(${id}, this.value); const heading=document.querySelector('#context-gui .passive-editor-current-title-name'); if(heading) heading.textContent=this.value.trim() || 'Section ${selectedPassive.index + 1}'">
                        <label class="form-label mb-1" for="gui-sec-text-${id}">Effects</label>
                        <textarea id="gui-sec-text-${id}" class="form-control mb-2 context-symbol-target" style="height:180px;" oninput="const source=document.getElementById('input-sec-${id}'); if(source) source.value=this.value; updateSection(${id}, this.value); window.updatePassiveEditorPreview(${id}, this.value);">${textVal}</textarea>
                    </section>`;
                passivePreviewHTML = `
                    <section class="passive-editor-preview-section" aria-label="Card Preview">
                        <div class="passive-editor-preview-heading">
                            <span class="passive-editor-preview-title">Card Preview</span>
                            <button type="button" class="gui-preset-btn passive-preview-toggle" aria-expanded="${window.passiveEditorPreviewExpanded}" onclick="window.togglePassiveEditorPreview(this)">${window.passiveEditorPreviewExpanded ? 'Hide preview' : 'Show preview'}</button>
                        </div>
                        <div id="gui-sec-preview-${id}" class="passive-editor-preview" ${window.passiveEditorPreviewExpanded ? '' : 'hidden'}>${initialPreview}</div>
                    </section>`;
            } else {
                passiveEditorHTML = `
                    <div class="passive-overview-heading-row">
                        <div class="passive-overview-actions passive-overview-top-actions">
                            <button type="button" class="gui-preset-btn" style="background:#2563eb;" onclick="guiAddAndSelectPassiveSection()">+ Add Section</button>
                        </div>
                    </div>
                    `;
                passiveOverviewListHTML = `<div class="passive-overview-list">${passiveOverviewHTML || '<div class="gui-section-box">No passive sections yet.</div>'}</div>`;
            }

            passiveHeaderEditorHTML = (isAbsStyleTheme || isAbsCleanTheme) ? `
                <div class="gui-section-box mb-2" style="background:#27272a; border:1px solid #3f3f46;">
                    <div class="d-flex justify-content-between align-items-center mb-1">
                        <div class="d-flex align-items-center gap-1">
                            <button type="button" id="gui-header-badges-toggle-btn" class="gui-minimize-btn" onclick="window.togglePassiveBadgesCollapse('gui-passive-badges-toggle-strip', this)">−</button>
                            <label class="form-label m-0 ms-1" style="color:#a1a1aa; font-weight:800; font-size:11px;">HEADER BADGES</label>
                        </div>
                        <button type="button" class="btn-auto-detect" onclick="event.stopPropagation(); window.resetPassiveHeaderIconsToAuto(); openContextGUI(0, 0, 'passive');">Auto-Detect</button>
                    </div>
                    <input type="text" id="gui-passive-name" class="form-control form-control-sm mb-2 context-symbol-target" placeholder="Passive Skill Name" value="${passiveNameValue}">
                    <div id="gui-passive-badges-toggle-strip" class="d-flex flex-wrap gap-1 p-1" style="background:#18181b; border:1px solid #334155; border-radius:6px; min-height:80px; max-height:500px; overflow-y:auto; resize:vertical;"></div>
                </div>` : `
                <div class="gui-section-box mb-2" style="background:#27272a; border:1px solid #3f3f46;">
                    <label class="form-label mb-1" style="font-size:10px;">Passive Skill Name</label>
                    <input type="text" id="gui-passive-name" class="form-control form-control-sm context-symbol-target" placeholder="Passive Skill Name" value="${passiveNameValue}">
                </div>`;
            if (showPassiveDetail) {
                bodyHTML = window.renderClickEditorShell({
                    defaultTargetId: `gui-sec-text-${selectedPassive.id}`,
                    contentHTML: `${passiveEditorHTML}${passivePreviewHTML}`,
                    navigationHTML: passiveNavigationHTML,
                    className: 'click-editor-layout-passive'
                });
            } else if (isAbsCleanTheme) {
                bodyHTML = window.renderClickEditorShell({
                    defaultTargetId: 'gui-passive-name',
                    contentHTML: `${passiveHeaderEditorHTML}${passiveEditorHTML}<div class="section-divider" style="border-top:1px solid rgba(255,255,255,.15); margin:10px 0;"></div>${passiveOverviewListHTML}`,
                    className: 'click-editor-layout-passive click-editor-layout-passive-overview'
                });
            } else {
                bodyHTML = window.renderClickEditorShell({
                    defaultTargetId: 'gui-passive-name',
                    contentHTML: `${passiveEditorHTML}${passiveHeaderEditorHTML}<div class="section-divider" style="border-top:1px solid rgba(255,255,255,.15); margin:10px 0;"></div>${passiveOverviewListHTML}`,
                    className: 'click-editor-layout-passive click-editor-layout-passive-overview'
                });
            }
            break;
        }

        case 'sa': {
            titleHTML = "⚙️ Super Attack Editor";
            const saNameVal = currentSuperAttack?.querySelector('.sa-display-name')?.textContent || '';
            const saTypeVal = currentSuperAttack?.querySelector('.sa-type-label')?.textContent || 'Super Attack';
            const supportedSATypes = ['Super Attack', 'Ultra Super Attack', 'Ex Super Attack', 'Unit Super Attack', 'Unit Ultra Super Attack'];
            const showSAActivation = isSAActivationType(saTypeVal);
            const existingActivationRow = currentSuperAttack?.querySelector('.activation-row');
            if (existingActivationRow) existingActivationRow.classList.toggle('d-none', !showSAActivation);
            const saActivationVal = getSAActivationSourceText(currentSuperAttack);
            const hasSupportedSAType = supportedSATypes.some(type => type.toLowerCase() === saTypeVal.toLowerCase());
            const existingCustomSATypeOption = hasSupportedSAType
                ? ''
                : `<option value="${escapeContextHtml(saTypeVal)}" selected>Current custom type: ${escapeContextHtml(saTypeVal)}</option>`;
            const saIconSrc = currentSuperAttack?.querySelector('.sa-display-icon')?.getAttribute('src') || 'https://abscustom.github.io/assets/images/sp_skill_icon_01.png';
            const storedKiVal = currentSuperAttack?.getAttribute('data-ki') || '';
            const saKiVal = normalizeSAAttackKi(storedKiVal) || defaultSAAttackKi(saTypeVal);
            if (currentSuperAttack && saKiVal && storedKiVal !== saKiVal) {
                currentSuperAttack.setAttribute('data-ki', saKiVal);
            }

            let saEffectsVal = "";
            const effectCols = currentSuperAttack?.querySelectorAll('.sa-display-effects-list .col');
            if (effectCols && effectCols.length > 0) saEffectsVal = Array.from(effectCols).map(c => c.innerText).join('\n');
            const multiplierHTML = window.renderAbsDamageMultiplier?.(saEffectsVal, saTypeVal, false, formatSAAttackKi(saKiVal)) || '';
            const multiplierValue = multiplierHTML.match(/class="pill-val">([^<]+)</i)?.[1] || '—';

            // Render existing stats with number input and delete button
            let saStatsHTML = "";
            if (currentSuperAttack) {
                const statRows = currentSuperAttack.querySelectorAll('.sa-stat-row');
                statRows.forEach((row, sIdx) => {
                    const img = row.querySelector('img')?.getAttribute('src') || '';
                    const txt = row.querySelector('.display-text, span')?.textContent || '';
                    const numVal = txt.replace('%', '').trim();
                    saStatsHTML += `
                    <div class="d-flex justify-content-between align-items-center py-1 px-2 mb-1 gui-item-row" style="background: rgba(0,0,0,0.3); border-radius: 4px;">
                        <div class="d-flex align-items-center gap-2">
                            <img src="${img}" height="22">
                            <input type="number" class="form-control py-0 px-1" style="width: 60px; height: 24px; font-size: 11px;" value="${numVal}" oninput="guiUpdateExistingSAStat(${sIdx}, this.value)">
                            <span style="color:#38bdf8; font-weight:bold;">%</span>
                        </div>
                        <button type="button" class="btn btn-danger btn-sm py-0 px-2" style="font-size:10px; font-weight:bold; height:22px;" onclick="guiDeleteExistingSAStat(${sIdx})">Delete</button>
                    </div>`;
                });
            }

            const saQuickPickHTML = `
                <div class="sa-editor-section-heading"><strong>Stat Effects</strong><span>Quick Picks</span></div>
                <div class="sa-gui-icon-grid sa-editor-quick-picks" role="group" aria-label="Stat effect quick picks">
                    <button type="button" class="sa-gui-icon-opt selected" title="ATK Up" aria-label="ATK Up" onclick="guiSelectSAIcon(this, 'https://abscustom.github.io/assets/images/st_0001.png')"><img src="https://abscustom.github.io/assets/images/st_0001.png" alt=""></button>
                    <button type="button" class="sa-gui-icon-opt" title="DEF Up" aria-label="DEF Up" onclick="guiSelectSAIcon(this, 'https://abscustom.github.io/assets/images/st_0002.png')"><img src="https://abscustom.github.io/assets/images/st_0002.png" alt=""></button>
                    <button type="button" class="sa-gui-icon-opt" title="ATK Down" aria-label="ATK Down" onclick="guiSelectSAIcon(this, 'https://abscustom.github.io/assets/images/st_0011.png')"><img src="https://abscustom.github.io/assets/images/st_0011.png" alt=""></button>
                    <button type="button" class="sa-gui-icon-opt" title="DEF Down" aria-label="DEF Down" onclick="guiSelectSAIcon(this, 'https://abscustom.github.io/assets/images/st_0012.png')"><img src="https://abscustom.github.io/assets/images/st_0012.png" alt=""></button>
                    <button type="button" class="sa-gui-icon-opt" title="Stun" aria-label="Stun" onclick="guiSelectSAIcon(this, 'https://abscustom.github.io/assets/images/st_0100.png')"><img src="https://abscustom.github.io/assets/images/st_0100.png" alt=""></button>
                    <button type="button" class="sa-gui-icon-opt" title="Seal" aria-label="Seal" onclick="guiSelectSAIcon(this, 'https://abscustom.github.io/assets/images/st_0102.png')"><img src="https://abscustom.github.io/assets/images/st_0102.png" alt=""></button>
                    <button type="button" class="sa-gui-icon-opt" title="Action Break" aria-label="Action Break" onclick="guiSelectSAIcon(this, 'https://abscustom.github.io/assets/images/st_1009.png')"><img src="https://abscustom.github.io/assets/images/st_1009.png" alt=""></button>
                    <button type="button" class="sa-gui-icon-opt" title="Type Effective" aria-label="Type Effective" onclick="guiSelectSAIcon(this, 'https://abscustom.github.io/assets/images/st_atk_super.png')"><img src="https://abscustom.github.io/assets/images/st_atk_super.png" alt=""></button>
                    <button type="button" class="sa-gui-icon-opt" title="Critical" aria-label="Critical" onclick="guiSelectSAIcon(this, 'https://abscustom.github.io/assets/images/st_critical_up.png')"><img src="https://abscustom.github.io/assets/images/st_critical_up.png" alt=""></button>
                    <button type="button" class="sa-gui-icon-opt" title="Dodge" aria-label="Dodge" onclick="guiSelectSAIcon(this, 'https://abscustom.github.io/assets/images/st_evasion.png')"><img src="https://abscustom.github.io/assets/images/st_evasion.png" alt=""></button>
                    <button type="button" class="sa-gui-icon-opt" title="Heal" aria-label="Heal" onclick="guiSelectSAIcon(this, 'https://abscustom.github.io/assets/images/st_recover.png')"><img src="https://abscustom.github.io/assets/images/st_recover.png" alt=""></button>
                    <button type="button" class="sa-gui-icon-opt" title="Sacrifice" aria-label="Sacrifice" onclick="guiSelectSAIcon(this, 'https://abscustom.github.io/assets/images/st_recover_minus.png')"><img src="https://abscustom.github.io/assets/images/st_recover_minus.png" alt=""></button>
                </div>`;
            const saPersistentActionsHTML = `
                <div class="gui-btn-grid sa-editor-persistent-actions">
                    <button type="button" class="gui-preset-btn" style="background:#2563eb;" onclick="guiAddSAWithAutoSelect()">${addSvgIcon} Add SA</button>
                    <button type="button" class="gui-preset-btn gui-preset-btn-danger" onclick="guiDeleteSAWithUndo()">${deleteSvgIcon} Delete SA</button>
                </div>`;
            const saAdvancedActionsHTML = `
                <div class="sa-editor-advanced-actions">
                    <div class="sa-editor-section-heading"><strong>Advanced Actions</strong></div>
                    ${saPersistentActionsHTML}
                </div>`;
            const saSourceBlocks = window.getSuperAttackSourceBlocks?.() || Array.from(document.querySelectorAll('.sa-block'));
            const saOrderIndex = saSourceBlocks.indexOf(currentSuperAttack);
            const saReorderControlsHTML = `
                <div class="sa-editor-reorder-controls" role="group" aria-label="Reorder Super Attacks">
                    <span class="sa-editor-reorder-position" data-sa-reorder-position>${saOrderIndex >= 0 ? `Attack ${saOrderIndex + 1} of ${saSourceBlocks.length}` : 'Attack unavailable'}</span>
                    <div class="sa-editor-reorder-buttons">
                        <button type="button" class="sa-editor-reorder-button" data-sa-reorder-direction="-1" aria-label="Move Super Attack up" title="Move up" ${saOrderIndex <= 0 ? 'disabled' : ''} onclick="event.stopPropagation(); window.guiMoveSuperAttack(-1)"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3 3.5 7.5l1.4 1.4L7 6.8V13h2V6.8l2.1 2.1 1.4-1.4L8 3Z"/></svg></button>
                        <button type="button" class="sa-editor-reorder-button" data-sa-reorder-direction="1" aria-label="Move Super Attack down" title="Move down" ${saOrderIndex < 0 || saOrderIndex >= saSourceBlocks.length - 1 ? 'disabled' : ''} onclick="event.stopPropagation(); window.guiMoveSuperAttack(1)"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 13 12.5 8.5l-1.4-1.4L9 9.2V3H7v6.2L4.9 7.1 3.5 8.5 8 13Z"/></svg></button>
                    </div>
                </div>`;
            const saStatValueHTML = `
                <div class="gui-section-box sa-editor-stats sa-editor-stat-values">
                    <div class="sa-editor-section-heading"><strong>Stat Effect Values</strong></div>
                    <div class="sa-editor-stat-value-add">
                        <label class="visually-hidden" for="gui-sa-stat-val">Stat effect percentage</label>
                        <input type="number" id="gui-sa-stat-val" class="form-control" placeholder="Stat %" aria-label="Stat effect percentage" value="30">
                        <button type="button" class="gui-add-btn" onclick="guiAddStatIconToSA()">${addSvgIcon} Add stat</button>
                    </div>
                    <div class="sa-editor-existing-stat-values">${saStatsHTML || '<span class="sa-editor-empty-stats">No stat effects added yet.</span>'}</div>
                </div>`;

            bodyHTML = `
                <div class="sa-editor-layout">
                    <aside class="sa-editor-stat-rail" aria-label="Stat effect controls">
                        ${saReorderControlsHTML}
                        ${saStatValueHTML}
                        ${saQuickPickHTML}
                        <button type="button" class="gui-preset-btn sa-auto-generate-stat-effects" style="background:#2563eb;" onclick="guiAutoApplySAIcons()">${lightningSvgIcon} Auto generate stat effects</button>
                        ${saAdvancedActionsHTML}
                    </aside>
                    <section class="sa-editor-fields-scroll" tabindex="0" aria-label="Super Attack fields">
                <div class="sa-editor-primary-fields">
                    <div>
                        <label class="form-label mb-1" for="gui-sa-type-custom">Attack type</label>
                        <select id="gui-sa-type-custom" class="form-control" aria-label="Attack type" onchange="guiUpdateSAType(this.value); guiUpdateSAMultiplierPreview(document.getElementById('gui-sa-effects')?.value || '')">
                            ${existingCustomSATypeOption}
                            <option value="Super Attack" ${saTypeVal === 'Super Attack' ? 'selected' : ''}>Super Attack</option>
                            <option value="Ultra Super Attack" ${saTypeVal === 'Ultra Super Attack' ? 'selected' : ''}>Ultra Super Attack</option>
                            <option value="Ex Super Attack" ${/^ex super attack$/i.test(saTypeVal) ? 'selected' : ''}>EX Super Attack</option>
                            <option value="Unit Super Attack" ${saTypeVal === 'Unit Super Attack' ? 'selected' : ''}>Unit Super Attack</option>
                            <option value="Unit Ultra Super Attack" ${saTypeVal === 'Unit Ultra Super Attack' ? 'selected' : ''}>Unit Ultra Super Attack</option>
                        </select>
                    </div>
                    <div class="sa-editor-ki-field">
                        <div class="input-group">
                            <input type="number" min="0" step="1" id="gui-sa-ki" class="form-control" aria-label="Ki amount" value="${escapeContextHtml(saKiVal)}" oninput="guiUpdateSAKi(this.value); guiUpdateSAMultiplierPreview(document.getElementById('gui-sa-effects')?.value || '')">
                            <span class="input-group-text" aria-hidden="true">Ki</span>
                        </div>
                    </div>
                    <div class="sa-editor-multiplier-field">
                        <label class="form-label mb-1" for="gui-sa-multiplier-preview">Multiplier</label>
                        <output id="gui-sa-multiplier-preview">${escapeContextHtml(multiplierValue)}</output>
                    </div>
                </div>

                <div class="gui-section-box sa-editor-name-icon">
                    <div>
                        <label class="form-label mb-1" for="gui-sa-name">Attack name</label>
                        <input type="text" id="gui-sa-name" class="form-control" value="${escapeContextHtml(saNameVal)}" oninput="guiUpdateSAName(this.value)">
                    </div>
                    <div>
                        <label class="form-label mb-1">Attack category</label>
                        <div class="sa-editor-category-icons">
                            <button type="button" class="sa-type-icon-opt ${saIconSrc.includes('sp_skill_icon_01') ? 'selected' : ''}" aria-label="Ki Blast" title="Ki Blast" onclick="guiSetSATypeIcon(this, 'https://abscustom.github.io/assets/images/sp_skill_icon_01.png')"><img src="https://abscustom.github.io/assets/images/sp_skill_icon_01.png" alt=""></button>
                            <button type="button" class="sa-type-icon-opt ${saIconSrc.includes('sp_skill_icon_02') ? 'selected' : ''}" aria-label="Unarmed" title="Unarmed" onclick="guiSetSATypeIcon(this, 'https://abscustom.github.io/assets/images/sp_skill_icon_02.png')"><img src="https://abscustom.github.io/assets/images/sp_skill_icon_02.png" alt=""></button>
                            <button type="button" class="sa-type-icon-opt ${saIconSrc.includes('sp_skill_icon_etc') ? 'selected' : ''}" aria-label="Other" title="Other" onclick="guiSetSATypeIcon(this, 'https://abscustom.github.io/assets/images/sp_skill_icon_etc.png')"><img src="https://abscustom.github.io/assets/images/sp_skill_icon_etc.png" alt=""></button>
                            <button type="button" class="sa-type-icon-opt ${saIconSrc.includes('sp_skill_icon_04') ? 'selected' : ''}" aria-label="Physical" title="Physical" onclick="guiSetSATypeIcon(this, 'https://abscustom.github.io/assets/images/sp_skill_icon_04.png')"><img src="https://abscustom.github.io/assets/images/sp_skill_icon_04.png" alt=""></button>
                        </div>
                    </div>
                </div>

                <div id="gui-sa-activation-fields" class="gui-section-box sa-editor-activation" ${showSAActivation ? '' : 'hidden'}>
                    <label class="form-label mb-1" for="gui-sa-activation">Activation Conditions</label>
                    <textarea id="gui-sa-activation" class="form-control" rows="3" oninput="guiUpdateSAActivation(this.value)">${escapeContextHtml(saActivationVal)}</textarea>
                </div>

                <div class="gui-section-box sa-editor-effects">
                    <label class="form-label mb-1" for="gui-sa-effects">Effect text</label>
                    <textarea id="gui-sa-effects" class="form-control mb-2" style="height:210px;" oninput="guiUpdateSAEffects(this.value); guiUpdateSAMultiplierPreview(this.value)">${escapeContextHtml(saEffectsVal)}</textarea>
                </div>

                    </section>
                </div>
            `;
            break;
        }

        case 'active': {
            let actBlock = window.resolveActiveSkillBlock?.(currentActiveSkill) || currentActiveSkill || document.querySelectorAll('.active-block')[0];
            if (actBlock) window.ensureActiveSkillKind?.(actBlock);
            const activeKind = window.getActiveSkillKind?.(actBlock) || 'active';
            const activeKindLabel = window.getActiveSkillKindLabel?.(activeKind) || 'Active Skill';
            const activeTypeVal = activeKind === 'domain'
                ? 'Dokkan Field'
                : (activeKind === 'standby'
                    ? 'Standby'
                    : (actBlock?.querySelector('.active-type-label')?.textContent || 'Active Skill'));
            const activeNameVal = actBlock?.querySelector('.active-display-name')?.textContent || 'Skill Name';
            const activeHeadingVal = window.getActiveSkillEditorHeadingName?.(activeNameVal, actBlock)
                || activeTypeVal || activeKindLabel;
            titleHTML = `${activeSkillSvgIcon} <span class="active-editor-heading" data-active-editor-title>Editing: ${escapeContextHtml(activeHeadingVal)}</span>`;
            const activeEffectVal = clickEditorSourceTextFromElement(actBlock?.querySelector('.active-display-effect'));
            const activeCondVal = clickEditorSourceTextFromElement(actBlock?.querySelector('.active-display-condition'));
            const activeIconSrc = actBlock?.querySelector('.active-display-icon')?.getAttribute('src') ||
                (activeKind === 'domain'
                    ? 'https://abscustom.github.io/assets/images/ing_label_field.png'
                    : 'https://abscustom.github.io/assets/images/sp_skill_icon_04.png');

            const activeEditorContentHTML = `
                <label class="form-label mb-1">Skill type</label>
                <div class="gui-btn-grid mb-2" role="group" aria-label="Skill Type">
                    <button type="button" class="gui-preset-btn ${activeKind === 'active' ? 'active-glow-btn' : ''}" aria-pressed="${activeKind === 'active'}" data-active-kind-option="active" onclick="guiSetActiveKind('active')">Active Skill</button>
                    <button type="button" class="gui-preset-btn ${activeKind === 'domain' ? 'active-glow-btn' : ''}" aria-pressed="${activeKind === 'domain'}" data-active-kind-option="domain" onclick="guiSetActiveKind('domain')">Dokkan Field</button>
                    <button type="button" class="gui-preset-btn ${activeKind === 'standby' ? 'active-glow-btn' : ''}" aria-pressed="${activeKind === 'standby'}" data-active-kind-option="standby" onclick="guiSetActiveKind('standby')">Standby</button>
                </div>

                <div class="gui-section-box active-editor-name-field">
                    <label class="form-label mb-1" for="gui-active-name">Name</label>
                    <input type="text" id="gui-active-name" class="form-control context-symbol-target" value="${escapeContextHtml(activeNameVal)}" oninput="guiUpdateActiveName(this.value)">
                </div>

                <div class="gui-section-box active-editor-condition">
                    <label class="form-label mb-1" for="gui-active-conditions">Activation conditions</label>
                    <textarea id="gui-active-conditions" class="form-control context-symbol-target" style="height:82px;" oninput="guiUpdateActiveCondition(this.value)">${escapeContextHtml(activeCondVal)}</textarea>
                </div>

                <div class="gui-section-box active-editor-effect">
                    <label class="form-label mb-1" for="gui-active-effect">Effects</label>
                    <textarea id="gui-active-effect" class="form-control context-symbol-target" style="height:250px;" oninput="guiUpdateActiveEffect(this.value)">${escapeContextHtml(activeEffectVal)}</textarea>
                </div>

                <details class="gui-advanced-editor">
                    <summary>Advanced settings</summary>
                    <div class="gui-section-box active-editor-media-controls">
                        <label class="form-label mb-1" for="gui-active-type">Type label</label>
                        <input type="text" id="gui-active-type" class="form-control mb-2" value="${escapeContextHtml(activeTypeVal)}" oninput="guiUpdateActiveType(this.value)">
                        <label class="form-label mb-1">${activeKind === 'domain' ? 'Dokkan Field icon' : (activeKind === 'standby' ? 'Standby Skill icon' : 'Active Skill icon')}</label>
                        <div class="d-flex gap-2 justify-content-center align-items-center flex-wrap">
                            <button type="button" class="sa-type-icon-opt ${(!activeIconSrc || activeIconSrc === 'none' || activeIconSrc.includes('none')) ? 'selected' : ''}" style="width:44px; height:44px; font-size:10px; font-weight:800; color:#aaa;" onclick="guiSetActiveTypeIcon(this, 'none')">NONE</button>
                            <button type="button" class="sa-type-icon-opt ${activeIconSrc.includes('ing_label_field') ? 'selected' : ''}" title="Domain / Field" aria-label="Domain or field icon" onclick="guiSetActiveTypeIcon(this, 'https://abscustom.github.io/assets/images/ing_label_field.png')"><img src="https://abscustom.github.io/assets/images/ing_label_field.png" alt=""></button>
                            <button type="button" class="sa-type-icon-opt ${activeIconSrc.includes('sp_skill_icon_01') ? 'selected' : ''}" title="Ki Blast" aria-label="Ki Blast icon" onclick="guiSetActiveTypeIcon(this, 'https://abscustom.github.io/assets/images/sp_skill_icon_01.png')"><img src="https://abscustom.github.io/assets/images/sp_skill_icon_01.png" alt=""></button>
                            <button type="button" class="sa-type-icon-opt ${activeIconSrc.includes('sp_skill_icon_02') ? 'selected' : ''}" title="Unarmed" aria-label="Unarmed icon" onclick="guiSetActiveTypeIcon(this, 'https://abscustom.github.io/assets/images/sp_skill_icon_02.png')"><img src="https://abscustom.github.io/assets/images/sp_skill_icon_02.png" alt=""></button>
                            <button type="button" class="sa-type-icon-opt ${activeIconSrc.includes('sp_skill_icon_etc') ? 'selected' : ''}" title="Other" aria-label="Other skill icon" onclick="guiSetActiveTypeIcon(this, 'https://abscustom.github.io/assets/images/sp_skill_icon_etc.png')"><img src="https://abscustom.github.io/assets/images/sp_skill_icon_etc.png" alt=""></button>
                            <button type="button" class="sa-type-icon-opt ${activeIconSrc.includes('sp_skill_icon_04') ? 'selected' : ''}" title="Physical" aria-label="Physical" onclick="guiSetActiveTypeIcon(this, 'https://abscustom.github.io/assets/images/sp_skill_icon_04.png')"><img src="https://abscustom.github.io/assets/images/sp_skill_icon_04.png" alt=""></button>
                        </div>
                    </div>
                    <small class="d-block mt-2" style="opacity:.75;">Active skills, Dokkan Fields, and Standby skills share this editor and render in their own card sections.</small>
                </details>
            `;
            bodyHTML = window.renderClickEditorShell({
                defaultTargetId: 'gui-active-effect',
                contentHTML: activeEditorContentHTML,
                actionHTML: `
                    <div class="active-editor-action-buttons">
                        <button type="button" class="gui-preset-btn" style="background:#2563eb;" onclick="guiAddActiveWithAutoSelect();">${addSvgIcon} Add skill</button>
                        <button type="button" class="gui-preset-btn gui-preset-btn-danger" onclick="guiDeleteActiveWithUndo();">${deleteSvgIcon} Delete skill</button>
                    </div>`,
                className: 'click-editor-layout-active'
            });
            break;
        }

        case 'art':
            titleHTML = `${imageUploadSvgIcon} Card Art, Icons & Images`;
            const displayedRarity = (window.getDisplayedCardRarity?.() || String(window.currentRarity || currentRarity || '')).toUpperCase();
            const showLr = displayedRarity === 'LR';
            const iconUploadHTML = [
                { id: 'img-ssr', label: 'SSR Icon', selector: '#ssr-row #img-ssr, #img-ssr', show: true },
                { id: 'img-tur', label: 'TUR Icon', selector: '#tur-row #img-tur, #img-tur', show: true },
                { id: 'img-lr', label: 'LR Icon', selector: '#img-lr', show: showLr }
            ].filter(icon => icon.show).map(icon => {
                const image = document.querySelector(icon.selector);
                const src = image?.getAttribute('src') || image?.src || '';
                return `
                    <div class="gui-image-upload-card">
                        <img id="gui-icon-preview-${icon.id}" src="${escapeContextHtml(src)}" alt="${escapeContextHtml(icon.label)} preview" loading="lazy" onerror="this.hidden=true">
                        <div class="gui-image-upload-card-controls">
                            <span class="form-label mb-1">${escapeContextHtml(icon.label)}</span>
                            <label class="uiverse-upload-btn m-0">
                                ${cloudSvgIcon} Upload / Replace
                                <input type="file" hidden accept="image/*" onchange="uploadIcon(event, '${icon.id}')">
                            </label>
                        </div>
                    </div>`;
            }).join('');
            const formImageControlsHTML = Array.from(document.querySelectorAll('#forms-container .dokkan-card')).map((formCard, idx) => {
                const image = formCard.querySelector('.form-image');
                const infoImageSrc = image?.getAttribute('src') || image?.src || 'https://abscustom.github.io/assets/images/default.png';
                const absThumbSrc = formCard.getAttribute('data-thumb-src') || infoImageSrc;
                return `
                    <div class="gui-section-box mb-2">
                        <label class="form-label mb-2">Form ${idx + 1} Images</label>
                        <div class="gui-form-image-grid">
                            <div class="gui-form-image-control">
                                <img id="gui-form-image-preview-${idx}" src="${escapeContextHtml(infoImageSrc)}" alt="Form ${idx + 1} wide image preview" loading="lazy">
                                <label class="uiverse-upload-btn m-0">
                                    ${cloudSvgIcon} Upload / Replace Wide Image
                                    <input type="file" hidden accept="image/*" onchange="guiUploadFormImage(${idx}, this)">
                                </label>
                            </div>
                            <div class="gui-form-image-control">
                                <img id="gui-form-thumb-preview-${idx}" src="${escapeContextHtml(absThumbSrc)}" alt="Form ${idx + 1} thumbnail preview" loading="lazy">
                                <label class="uiverse-upload-btn m-0">
                                    ${cloudSvgIcon} Upload / Replace Thumbnail
                                    <input type="file" hidden accept="image/*" onchange="guiUploadFormThumbnail(${idx}, this)">
                                </label>
                            </div>
                        </div>
                    </div>`;
            }).join('');
            bodyHTML = `
                <div class="gui-section-box mb-3">
                    <label class="form-label mb-2">Card Icons</label>
                    <div class="gui-image-upload-grid">${iconUploadHTML}</div>
                </div>
                <label class="form-label mb-1">Banner Unit Tag (ABS Mode)</label>
                <select id="gui-abs-unit-tag" class="form-control mb-3" onchange="window.setAbsUnitTag?.(this.value); window.syncToAbsLayout?.(); window.autoSaveToCache?.();">
                    <option value="DOKKAN FESTIVAL UNIT" ${window.absUnitTag === 'DOKKAN FESTIVAL UNIT' ? 'selected' : ''}>DOKKAN FESTIVAL UNIT</option>
                    <option value="CARNIVAL UNIT" ${window.absUnitTag === 'CARNIVAL UNIT' ? 'selected' : ''}>CARNIVAL UNIT</option>
                    <option value="LEGENDARY SUMMON UNIT" ${window.absUnitTag === 'LEGENDARY SUMMON UNIT' ? 'selected' : ''}>LEGENDARY SUMMON UNIT</option>
                    <option value="" ${!String(window.absUnitTag || '').trim() ? 'selected' : ''}>Hidden / None</option>
                </select>

                <div class="d-flex gap-2 mb-2">
                    <label class="uiverse-upload-btn m-0" style="flex: 1;">
                        ${cloudSvgIcon} Static Image
                        <input type="file" id="gui-imageUpload" hidden accept="image/*" onchange="document.getElementById('imageUpload').files=this.files; document.getElementById('imageUpload').dispatchEvent(new Event('change'));">
                    </label>
                    <label class="uiverse-upload-btn m-0" style="flex: 1;">
                        ${cloudSvgIcon} Video (.mp4)
                        <input type="file" id="gui-videoUpload" hidden accept="video/mp4" onchange="document.getElementById('videoUpload').files=this.files; document.getElementById('videoUpload').dispatchEvent(new Event('change'));">
                    </label>
                </div>
                ${formImageControlsHTML ? `<div class="gui-section-box mt-3"><label class="form-label mb-2">Transformation Form Images</label>${formImageControlsHTML}</div>` : ''}
            `;
            break;

        case 'forms':
            titleHTML = `${formsSvgIcon} Transformations & Forms`;
            let formsListHTML = "";
            const formCards = document.querySelectorAll('#forms-container .dokkan-card');

            let customCardOptions = "";
            try {
                const cached = localStorage.getItem('hub_cached_custom_only');
                if (cached) {
                    const parsed = JSON.parse(cached);
                    if (Array.isArray(parsed)) {
                        customCardOptions = parsed.map(c => {
                            const cardUrl = c.cardUrl || `https://abscustom.github.io/${c.id}/`;
                            return `<option value="${escapeContextHtml(cardUrl)}">${escapeContextHtml(c.name || c.id)} (${escapeContextHtml(c.id)})</option>`;
                        }).join('');
                    }
                }
            } catch(e) {}

            formCards.forEach((formCard, idx) => {
                const nameEl = formCard.querySelector('.form-name');
                const linkEl = formCard.querySelector('.form-link');
                formsListHTML += `
                <div class="gui-section-box mb-2">
                    <div class="d-flex justify-content-between align-items-center mb-1">
                        <label class="form-label m-0">Form ${idx + 1}</label>
                        <button type="button" class="btn btn-danger btn-sm py-0 px-2" style="font-size:10px;" onclick="guiDeleteSpecificForm(${idx})">Delete</button>
                    </div>
                    <label class="form-label mb-1" style="font-size:10px;">Form Character Name</label>
                    <input type="text" class="form-control mb-2" value="${escapeContextHtml(nameEl?.textContent.trim() || '')}" oninput="guiUpdateFormName(${idx}, this.value)">
                    <label class="form-label mb-1" style="font-size:10px;">Redirect Link <small style="opacity:0.75;">(Choose card or type slug e.g. evil-buu)</small></label>
                    <input type="text" list="custom-cards-form-links" class="form-control" value="${escapeContextHtml(linkEl?.getAttribute('href') || '')}" placeholder="Choose card or enter slug..." oninput="guiUpdateFormLink(${idx}, this.value)">
                </div>`;
            });

            bodyHTML = `
                <datalist id="custom-cards-form-links">
                    ${customCardOptions}
                </datalist>
                <div class="gui-btn-grid mb-3">
                    <button type="button" class="gui-preset-btn" style="background:#2563eb;" onclick="guiAddForm()">${addSvgIcon} Add Form</button>
                </div>
                ${formsListHTML}
            `;
            break;

        case 'links':
            titleHTML = `${linkSvgIcon} Link Skills`;
            window.contextVisualSelection = { type: 'links', items: currentLinkPickerSelection() };
            bodyHTML = renderContextVisualPicker('links');
            break;

        case 'categories':
            titleHTML = `${categorySvgIcon} Categories`;
            window.contextVisualSelection = { type: 'categories', items: currentCategoryPickerSelection() };
            bodyHTML = renderContextVisualPicker('categories');
            break;
    }

    titleEl.innerHTML = titleHTML;
    contentEl.replaceChildren();
    contentEl.innerHTML = bodyHTML;
    bindContextListeners(editType);
    if (editType === 'art') window.syncProgressionDisplayControls?.();
    if (editType === 'passive' && window.renderPassiveHeaderBadgeToggles) {
        window.renderPassiveHeaderBadgeToggles();
    }
    if (editType === 'passive') {
        if (window.passiveEditorView === 'detail') {
            window.applyPassiveSectionHighlight?.(window.selectedPassiveSectionId);
            window.applyPassiveHeaderHighlight?.(false);
        } else {
            window.applyPassiveSectionHighlight?.(null);
            window.applyPassiveHeaderHighlight?.(true);
        }
    } else if (editType === 'active') {
        window.applyActiveSkillHighlight?.(targetElement);
    }
    const wasOpen = (gui.style.display === 'flex' || gui.style.display === 'block');
    gui.style.display = 'flex';

    const isCustomPublished = Boolean(window.IS_PUBLISHED && window.PUBLISHED_CARD_SOURCE !== 'official');
    const showQuickSave = isCustomPublished;
    const guiSaveBtn = document.getElementById('gui-quick-save-btn');
    if (guiSaveBtn) {
        guiSaveBtn.style.display = showQuickSave ? 'inline-flex' : 'none';
    }
    if (showQuickSave) {
        document.body.classList.add('quick-edit-open');
        if (window.ensureAdminActionsDock) window.ensureAdminActionsDock();
        const quickSaveBtn = document.getElementById('admin-quick-save-btn');
        if (quickSaveBtn) quickSaveBtn.style.setProperty('display', 'flex', 'important');
    }

    if (editType === 'passive' && window.passiveEditorView === 'detail') {
        window.positionPassiveEditor?.(gui, window.selectedPassiveSectionId);
        return;
    }

    if (gui.dataset.isDragged === "true") return;

    // If modal was already open and re-rendering via button click (0, 0), keep existing position!
    if (wasOpen && (!mouseX && !mouseY)) {
        return;
    }

    const zoom = window.getContextGUIZoom();

    if (mouseX > 0 || mouseY > 0) {
        let posX = mouseX + 20;
        let posY = mouseY - 20;
        const renderedRect = gui.getBoundingClientRect();
        const renderedWidth = renderedRect.width;
        const renderedHeight = renderedRect.height;
        if (posX + renderedWidth > window.innerWidth) posX = Math.max(10, mouseX - renderedWidth - 20);
        if (posY + renderedHeight > window.innerHeight) posY = Math.max(65, window.innerHeight - renderedHeight - 20);
        if (posY < 65) posY = 65;

        gui.style.left = `${posX / zoom}px`;
        gui.style.top = `${posY / zoom}px`;
    } else if (!gui.style.left || !gui.style.top || gui.style.left === '0px') {
        const renderedWidth = gui.getBoundingClientRect().width;
        gui.style.left = `${Math.max(20, Math.floor((window.innerWidth - renderedWidth) / 2)) / zoom}px`;
        gui.style.top = `${100 / zoom}px`;
    }
}

let skillPreviewFrame = 0;
const pendingSkillPreviews = new Set();
window.scheduleEditorSkillPreview = function(kind) {
    window.markEditorDirty?.();
    pendingSkillPreviews.add(kind);
    if (skillPreviewFrame) return;
    skillPreviewFrame = requestAnimationFrame(() => {
        skillPreviewFrame = 0;
        const kinds = new Set(pendingSkillPreviews);
        pendingSkillPreviews.clear();
        const root = window.getCardLayoutRoot?.();
        if (root?.dataset?.cardLayout === 'dokkaninfo') window.renderEditorSkillsInDokkanInfo?.(root);
        else if (kinds.has('sa')) window.updateAbsStyleSuperAttacks?.();
        else window.updateAbsStyleActiveSkills?.();
    });
};

// GUI HANDLERS FOR SA & ACTIVE
window.guiSetSATypeIcon = function(element, iconSrc) {
    document.querySelectorAll('.sa-type-icon-opt').forEach(img => img.classList.remove('selected'));
    element.classList.add('selected');
    if (currentSuperAttack) {
        const saDisplayIcon = currentSuperAttack.querySelector('.sa-display-icon');
        if (saDisplayIcon) saDisplayIcon.src = iconSrc;
    }
    const radio = document.querySelector(`input[name="sa-icon"][value="${iconSrc}"]`);
    if (radio) radio.checked = true;
    if (window.syncToAbsLayout) window.syncToAbsLayout();
};

window.guiSelectSAIcon = function(element, iconSrc) {
    document.querySelectorAll('.sa-gui-icon-opt').forEach(img => img.classList.remove('selected'));
    element.classList.add('selected');
    window.guiSelectedSAIcon = iconSrc;
};

window.guiAddStatIconToSA = function() {
    if (!currentSuperAttack) return;
    const cont = currentSuperAttack.querySelector('.stats-container');
    if (!cont) return;
    const val = document.getElementById('gui-sa-stat-val')?.value || "30";
    cont.insertAdjacentHTML('beforeend', 
        `<div class="col sa-stat-row"><img class="display-img" width="50" src="${window.guiSelectedSAIcon}"><span class="display-text ms-1">${val}%</span></div>`
    );
    window.refreshStatSidebar();
    if (window.syncToAbsLayout) window.syncToAbsLayout();
    openContextGUI(0, 0, 'sa', currentSuperAttack);
};

window.guiUpdateExistingSAStat = function(idx, newNumber) {
    if (!currentSuperAttack) return;
    const statRows = currentSuperAttack.querySelectorAll('.sa-stat-row');
    if (statRows[idx]) {
        const textSpan = statRows[idx].querySelector('.display-text, span');
        if (textSpan) textSpan.textContent = `${newNumber}%`;
    }
    window.scheduleEditorSkillPreview('sa');
};

window.guiDeleteExistingSAStat = function(idx) {
    if (!currentSuperAttack) return;
    const statRows = currentSuperAttack.querySelectorAll('.sa-stat-row');
    if (statRows[idx]) {
        statRows[idx].remove();
        window.refreshStatSidebar();
        if (window.syncToAbsLayout) window.syncToAbsLayout();
        openContextGUI(0, 0, 'sa', currentSuperAttack);
    }
};

window.guiUpdateSAType = function(val) {
    if (!currentSuperAttack) return;
    const l = currentSuperAttack.querySelector('.sa-type-label');
    if (l) l.textContent = val;
    const showActivation = isSAActivationType(val);
    const editorActivation = document.getElementById('gui-sa-activation-fields');
    if (editorActivation) editorActivation.hidden = !showActivation;
    const activationRow = currentSuperAttack.querySelector('.activation-row');
    if (activationRow) activationRow.classList.toggle('d-none', !showActivation);
    window.scheduleEditorSkillPreview('sa');
};
window.guiUpdateSAName = function(val) {
    if (!currentSuperAttack) return;
    const n = currentSuperAttack.querySelector('.sa-display-name');
    if (n) n.textContent = val;
    window.scheduleEditorSkillPreview('sa');
};
window.guiUpdateSAKi = function(val) {
    if (!currentSuperAttack) return;
    const numericKi = normalizeSAAttackKi(val);
    if (numericKi) currentSuperAttack.setAttribute('data-ki', numericKi);
    else currentSuperAttack.removeAttribute('data-ki');
    window.scheduleEditorSkillPreview('sa');
};
window.guiUpdateSAMultiplierPreview = function(text) {
    const output = document.getElementById('gui-sa-multiplier-preview');
    if (!output) return;
    const typeLabel = currentSuperAttack?.querySelector('.sa-type-label')?.textContent || '';
    const kiText = formatSAAttackKi(currentSuperAttack?.getAttribute('data-ki') || '');
    const multiplierHtml = window.renderAbsDamageMultiplier?.(text || '', typeLabel, false, kiText) || '';
    const value = multiplierHtml.match(/class="pill-val">([^<]+)</i)?.[1];
    output.textContent = value || '—';
};
window.guiUpdateSAEffects = function(val) {
    if (!currentSuperAttack) return;
    const cont = currentSuperAttack.querySelector('.sa-display-effects-list');
    if (cont) {
        const lines = val.split('\n').map(l => l.trim()).filter(Boolean);
        cont.innerHTML = lines.map(l => `<div class="row"><div class="col">${l}</div></div>`).join('');
    }
    window.scheduleEditorSkillPreview('sa');
};
window.guiUpdateSAActivation = function(val) {
    if (!currentSuperAttack) return;
    const act = currentSuperAttack.querySelector('.activation-text');
    const cleanVal = (typeof window.extractCleanConditionText === 'function')
        ? window.extractCleanConditionText(val)
        : (val || "").replace(/^activation\s+conditions?(\(s\))?[\s:]*/i, '').trim();
    if (act) {
        if (cleanVal === "") {
            act.innerHTML = `<strong>Activation Condition</strong>`;
        } else {
            act.innerHTML = `<strong>Activation Condition</strong><br>${cleanVal.replace(/\n/g, '<br>')}`;
        }
    }
    window.scheduleEditorSkillPreview('sa');
};
window.guiAutoApplySAIcons = function() {
    window.autoGenerateSAIcons();
    if (window.syncToAbsLayout) window.syncToAbsLayout();
    if (currentSuperAttack) openContextGUI(0, 0, 'sa', currentSuperAttack);
};
window.toggleSAActivationGUI = function() {
    const actRow = currentSuperAttack?.querySelector('.activation-row');
    const saLv = currentSuperAttack?.querySelector('.sa-lv-container');
    if (actRow) {
        const isOpening = actRow.classList.contains('d-none');
        actRow.classList.toggle('d-none');
        if (saLv) saLv.classList.toggle('d-none');
        if (isOpening) {
            const actTextDisp = currentSuperAttack.querySelector('.activation-text');
            if (actTextDisp) {
                const cleanText = (typeof window.extractCleanConditionText === 'function')
                    ? window.extractCleanConditionText(actTextDisp)
                    : actTextDisp.innerText.replace(/^activation\s+conditions?(\(s\))?[\s:]*/i, '').trim();
                if (cleanText === '') {
                    actTextDisp.innerHTML = `<strong>Activation Condition</strong>`;
                }
            }
        }
    }
    openContextGUI(0, 0, 'sa', currentSuperAttack);
};
window.guiDeleteSAWithUndo = function() {
    const blocks = document.querySelectorAll('.sa-block');
    if (blocks.length > 0) {
        window.saUndoStack.push(blocks[blocks.length - 1].outerHTML);
        blocks[blocks.length - 1].remove();
        window.refreshSADropdown();
        openContextGUI(0, 0, 'sa');
    }
};
window.guiUndoSA = function() {
    if (window.saUndoStack.length === 0) return;
    const html = window.saUndoStack.pop();
    window.ensureEditorSkillSourceHost?.()?.insertAdjacentHTML('beforeend', html);
    window.refreshSADropdown();
    openContextGUI(0, 0, 'sa');
};
window.guiAddSAWithAutoSelect = function() {
    window.addSuperAttackSection();
    const blocks = document.querySelectorAll('.sa-block');
    openContextGUI(0, 0, 'sa', blocks[blocks.length - 1]);
};

window.guiSetActiveTypeIcon = function(element, iconSrc) {
    document.querySelectorAll('#context-gui .sa-type-icon-opt, #context-gui .active-type-icon-opt').forEach(img => img.classList.remove('selected'));
    element.classList.add('selected');
    const act = window.resolveActiveSkillBlock?.(currentActiveSkill) || currentActiveSkill || document.querySelector('.active-block');
    if (act) {
        let activeDisplayIcon = act.querySelector('.active-display-icon');
        if (!activeDisplayIcon) {
            activeDisplayIcon = document.createElement('img');
            activeDisplayIcon.className = 'active-display-icon d-none';
            act.appendChild(activeDisplayIcon);
        }
        activeDisplayIcon.src = (iconSrc === 'none') ? 'none' : iconSrc;
        activeDisplayIcon.dataset.activeKindIconAuto = 'false';
        const resolvedKind = window.syncActiveSkillKindFromAsset?.(act, iconSrc);
        if (resolvedKind === 'domain') {
            const typeInput = document.getElementById('gui-active-type');
            if (typeInput) typeInput.value = 'Dokkan Field';
            const sidebarTypeInput = document.getElementById('input-active-type');
            if (sidebarTypeInput) sidebarTypeInput.value = 'Dokkan Field';
            document.querySelectorAll('#context-gui [data-active-kind-option]').forEach(button => {
                const isSelected = button.dataset.activeKindOption === 'domain';
                button.classList.toggle('active-glow-btn', isSelected);
                button.setAttribute('aria-pressed', String(isSelected));
            });
        }
        currentActiveSkill = act;
    }
    window.updateAbsStyleActiveSkills?.();
    if (window.syncToAbsLayout) window.syncToAbsLayout();
    window.autoSaveToCache?.();
};
window.guiSetActiveKind = function(kind) {
    const act = window.resolveActiveSkillBlock?.(currentActiveSkill) || currentActiveSkill || document.querySelector('.active-block');
    if (!act) return;
    currentActiveSkill = act;
    window.setActiveSkillKind?.(act, kind, { updateLabel: true, updateIcon: true, forceIcon: true });
    window.refreshActiveDropdown?.();
    window.updateAbsStyleActiveSkills?.();
    window.syncToAbsLayout?.();
    openContextGUI(0, 0, 'active', act);
};
window.guiUpdateActiveType = function(val) {
    const act = window.resolveActiveSkillBlock?.(currentActiveSkill) || currentActiveSkill || document.querySelector('.active-block');
    if (act) {
        window.ensureActiveSkillKind?.(act);
        act.querySelector('.active-type-label').textContent = val;
        currentActiveSkill = act;
    }
    window.updateActiveSkillEditorHeading?.(act?.querySelector('.active-display-name')?.textContent || '', act);
    window.scheduleEditorSkillPreview('active');
};
window.getActiveSkillEditorHeadingName = function(name, act = currentActiveSkill) {
    const actualName = String(name ?? '').trim();
    const normalizedName = actualName.replace(/[()[\]]/g, '').trim();
    if (normalizedName && !/^(?:skill\s*name|enter\s+skill\s+name)$/i.test(normalizedName)) {
        return actualName;
    }
    const typeName = act?.querySelector('.active-type-label')?.textContent?.trim();
    const kindLabel = window.getActiveSkillKindLabel?.(window.getActiveSkillKind?.(act)) || 'Active Skill';
    return typeName && typeName.toLowerCase() !== kindLabel.toLowerCase() ? typeName : kindLabel;
};
window.updateActiveSkillEditorHeading = function(name, act = currentActiveSkill) {
    const heading = document.querySelector('#context-gui [data-active-editor-title]');
    if (!heading) return;
    heading.textContent = `Editing: ${window.getActiveSkillEditorHeadingName?.(name, act) || 'Active Skill'}`;
};
window.guiUpdateActiveName = function(val) {
    const act = window.resolveActiveSkillBlock?.(currentActiveSkill) || currentActiveSkill || document.querySelector('.active-block');
    if (act) act.querySelector('.active-display-name').textContent = val;
    window.updateActiveSkillEditorHeading?.(val, act);
    window.scheduleEditorSkillPreview('active');
};
window.guiUpdateActiveEffect = function(val) {
    const act = window.resolveActiveSkillBlock?.(currentActiveSkill) || currentActiveSkill || document.querySelector('.active-block');
    const sourceText = String(val ?? '');
    const effect = act?.querySelector('.active-display-effect');
    if (effect) {
        effect.setAttribute('data-click-edit-source-text', sourceText);
        const escaped = escapeContextHtml(sourceText).replace(/\r?\n/g, '<br>');
        effect.innerHTML = typeof window.parsePassiveIcons === 'function' ? window.parsePassiveIcons(escaped) : escaped;
    }
    window.scheduleEditorSkillPreview('active');
};
window.guiUpdateActiveCondition = function(val) {
    const act = window.resolveActiveSkillBlock?.(currentActiveSkill) || currentActiveSkill || document.querySelector('.active-block');
    const sourceText = String(val ?? '');
    if (act) {
        const condDisp = act.querySelector('.active-display-condition');
        if (condDisp) {
            condDisp.setAttribute('data-click-edit-source-text', sourceText);
            const escaped = escapeContextHtml(sourceText).replace(/\r?\n/g, '<br>');
            condDisp.innerHTML = typeof window.parsePassiveIcons === 'function' ? window.parsePassiveIcons(escaped) : escaped;
        }
        const condRow = act.querySelector('.active-condition-row');
        const divRow = act.querySelector('.active-divider-row');
        if (sourceText.trim() === "") {
            if (condRow) condRow.classList.add('d-none');
            if (divRow) divRow.classList.add('d-none');
        } else {
            if (condRow) condRow.classList.remove('d-none');
            if (divRow) divRow.classList.remove('d-none');
        }
    }
    window.scheduleEditorSkillPreview('active');
};
window.toggleActiveDividerGUI = function() {
    const act = window.resolveActiveSkillBlock?.(currentActiveSkill) || currentActiveSkill || document.querySelector('.active-block');
    if (act) {
        act.querySelector('.active-divider-row')?.classList.toggle('d-none');
        act.querySelector('.active-condition-row')?.classList.toggle('d-none');
        openContextGUI(0, 0, 'active', act);
    }
};
window.guiAddActiveWithAutoSelect = function() {
    const existing = window.resolveActiveSkillBlock?.(currentActiveSkill) || currentActiveSkill || document.querySelector('.active-block');
    const kind = window.getActiveSkillKind?.(existing) || 'active';
    const added = window.addActiveSkillSection?.(kind);
    const blocks = window.getActiveSkillSourceBlocks?.() || Array.from(document.querySelectorAll('.active-block'));
    currentActiveSkill = added || blocks[blocks.length - 1] || null;
    openContextGUI(0, 0, 'active', currentActiveSkill);
};
window.guiDeleteActiveWithUndo = function() {
    const blocks = window.getActiveSkillSourceBlocks?.() || Array.from(document.querySelectorAll('.active-block'));
    const target = window.resolveActiveSkillBlock?.(currentActiveSkill) || blocks[blocks.length - 1];
    if (!target) return;

    const targetIndex = blocks.indexOf(target);
    window.activeUndoStack.push({ html: target.outerHTML, index: targetIndex });
    target.remove();

    const remaining = window.getActiveSkillSourceBlocks?.() || Array.from(document.querySelectorAll('.active-block'));
    currentActiveSkill = remaining[Math.min(Math.max(targetIndex, 0), remaining.length - 1)] || null;
    window.refreshActiveDropdown?.();
    window.updateAbsStyleActiveSkills?.();
    window.syncToAbsLayout?.();
    openContextGUI(0, 0, 'active', currentActiveSkill);
};
window.guiUndoActive = function() {
    if (window.activeUndoStack.length === 0) return;
    const entry = window.activeUndoStack.pop();
    const html = typeof entry === 'string' ? entry : entry?.html;
    if (!html) return;

    const blocks = window.getActiveSkillSourceBlocks?.() || Array.from(document.querySelectorAll('.active-block'));
    const index = Number.isInteger(entry?.index) ? entry.index : blocks.length;
    const sourceHost = window.ensureEditorSkillSourceHost?.();
    if (!sourceHost) return;
    const range = document.createRange();
    const fragment = range.createContextualFragment(html);
    sourceHost.insertBefore(fragment, blocks[index] || null);

    const restored = window.getActiveSkillSourceBlocks?.() || Array.from(document.querySelectorAll('.active-block'));
    currentActiveSkill = restored[Math.min(Math.max(index, 0), restored.length - 1)] || null;
    window.refreshActiveDropdown?.();
    window.updateAbsStyleActiveSkills?.();
    window.syncToAbsLayout?.();
    openContextGUI(0, 0, 'active', currentActiveSkill);
};

window.guiTogglePassiveCollapse = function(id) {
    const body = document.getElementById(`gui-sec-body-${id}`);
    const btn = document.getElementById(`gui-sec-toggle-btn-${id}`);
    if (body) {
        const isHidden = body.style.display === 'none';
        body.style.display = isHidden ? 'block' : 'none';
        if (btn) btn.textContent = isHidden ? '−' : '+';
        if (isHidden) window.collapsedPassiveSections.delete(id);
        else window.collapsedPassiveSections.add(id);
    }
};
window.guiMovePassiveSection = function(id, direction) {
    window.moveSection(id, direction);
    openContextGUI(0, 0, 'passive');
};
window.guiInsertPassiveIcon = function(id, token) {
    window.insertContextEditorSymbol(token, `gui-sec-text-${id}`);
};
window.guiSelectPassiveSection = function(id) {
    const section = getPassiveEditorSectionRecords().find(entry => entry.id === Number(id));
    if (!section) return;
    window.selectedPassiveSectionId = section.id;
    window.passiveEditorView = 'detail';
    openContextGUI(0, 0, 'passive');
};
window.guiShowPassiveOverview = function() {
    window.selectedPassiveSectionId = null;
    window.passiveEditorView = 'overview';
    openContextGUI(0, 0, 'passive');
};
window.guiStepPassiveSection = function(direction) {
    const sections = getPassiveEditorSectionRecords();
    const index = sections.findIndex(entry => entry.id === Number(window.selectedPassiveSectionId));
    if (index < 0) return;
    const next = sections[index + Number(direction)];
    if (next) window.guiSelectPassiveSection(next.id);
};
window.guiAddAndSelectPassiveSection = function() {
    window.addNewSection();
    const sections = getPassiveEditorSectionRecords();
    const added = sections[sections.length - 1];
    if (!added) return;
    window.selectedPassiveSectionId = added.id;
    window.passiveEditorView = 'detail';
    openContextGUI(0, 0, 'passive');
};
window.guiDuplicatePassiveSection = function(id) {
    const sections = getPassiveEditorSectionRecords();
    const source = sections.find(entry => entry.id === Number(id));
    if (!source) return;

    window.addNewSection();
    const afterAdd = getPassiveEditorSectionRecords();
    let added = afterAdd[afterAdd.length - 1];
    if (!added) return;

    const headerInput = added.element.querySelector('input[type="text"]');
    const bodyInput = added.element.querySelector('textarea');
    if (headerInput) headerInput.value = source.header;
    if (bodyInput) bodyInput.value = source.text;
    window.updateHeader(added.id, source.header);
    window.updateSection(added.id, source.text);

    for (let index = added.index; index > source.index + 1; index -= 1) {
        window.moveSection(added.id, -1);
    }
    added = getPassiveEditorSectionRecords().find(entry => entry.id === added.id) || added;
    window.selectedPassiveSectionId = added.id;
    window.passiveEditorView = 'detail';
    openContextGUI(0, 0, 'passive');
};
window.guiAddPassiveSection = function() {
    window.addNewSection();
    openContextGUI(0, 0, 'passive');
};
function showPassiveDeleteUndoToast(record, title, detail) {
    if (!record) return;
    window.clearTimeout(record.expiryTimer);
    record.expiryTimer = window.setTimeout(() => {
        const recordIndex = window.passiveUndoStack.indexOf(record);
        if (recordIndex >= 0 && record.status !== 'restoring') window.passiveUndoStack.splice(recordIndex, 1);
    }, 8000);
    if (!window.CardHubToast?.show) return;
    record.toastId = window.CardHubToast.show(title, {
        detail,
        duration: 8000,
        action: {
            label: 'Undo',
            onClick: () => window.guiUndoPassiveSection(record.token)
        }
    });

    const toast = document.getElementById('cardhub-toast-region')?.lastElementChild;
    const undoButton = toast?.querySelector('.cardhub-toast__action');
    undoButton?.addEventListener('click', () => {
        undoButton.disabled = true;
        undoButton.classList.add('passive-delete-undo-pressed');
    }, { once: true });
}

window.guiDeleteSpecificPassiveSection = function(id) {
    const sec = document.getElementById(`side-sec-${id}`);
    if (sec) {
        const records = getPassiveEditorSectionRecords();
        const section = records.find(entry => entry.id === Number(id));
        const heading = sec.querySelector('input[type="text"]')?.value || 'this section';
        const undoRecord = {
            token: ++window.passiveDeleteToastToken,
            header: sec.querySelector('input[type="text"]')?.value || '',
            text: sec.querySelector('textarea')?.value || '',
            index: section?.index ?? records.length - 1,
            beforeId: records[(section?.index ?? records.length - 1) - 1]?.id ?? null,
            afterId: records[(section?.index ?? records.length - 1) + 1]?.id ?? null,
            toastId: null,
            status: 'pending'
        };
        window.passiveUndoStack.push(undoRecord);
        window.removeThisSection(id);
        window.passiveEditorView = 'overview';
        window.selectedPassiveSectionId = null;
        openContextGUI(0, 0, 'passive');
        showPassiveDeleteUndoToast(
            undoRecord,
            `${heading} deleted`,
            'Undo restores this section in its original position.'
        );
        window.autoSaveToCache?.();
    }
};
window.dismissPassiveDeleteToast = function(token = null) {
    const records = token === null
        ? window.passiveUndoStack
        : window.passiveUndoStack.filter(record => record.token === token);
    records.forEach(record => {
        if (record.toastId !== null && record.toastId !== undefined) {
            window.CardHubToast?.dismiss?.(record.toastId);
            record.toastId = null;
        }
    });
    if (token === null) window.passiveDeleteToastToken += 1;
};
window.guiUndoPassiveSection = function(token = null) {
    const undoIndex = token === null
        ? window.passiveUndoStack.length - 1
        : window.passiveUndoStack.findIndex(record => record.token === token);
    if (undoIndex < 0) return;
    const restored = window.passiveUndoStack[undoIndex];
    if (!restored || restored.status === 'restoring') return false;
    restored.status = 'restoring';
    window.dismissPassiveDeleteToast(restored.token);

    const existingIds = new Set(getPassiveEditorSectionRecords().map(section => section.id));
    window.addNewSection();
    let added = getPassiveEditorSectionRecords().find(section => !existingIds.has(section.id));
    if (added) {
        const id = added.id;
        const h = added.element.querySelector('input[type="text"]');
        const t = added.element.querySelector('textarea');
        if (h) { h.value = restored.header; window.updateHeader(id, restored.header); }
        if (t) { t.value = restored.text; window.updateSection(id, restored.text); }

        const refreshed = getPassiveEditorSectionRecords();
        const nextNeighbor = restored.afterId === null
            ? null
            : refreshed.find(entry => entry.id === Number(restored.afterId));
        const previousNeighbor = restored.beforeId === null
            ? null
            : refreshed.find(entry => entry.id === Number(restored.beforeId));
        const originalIndex = Number.isInteger(restored.index) ? restored.index : added.index;
        const targetIndex = nextNeighbor
            ? nextNeighbor.index
            : (previousNeighbor
                ? previousNeighbor.index + 1
                : Math.max(0, Math.min(originalIndex, added.index)));
        for (let index = added.index; index > targetIndex; index -= 1) window.moveSection(id, -1);

        added = getPassiveEditorSectionRecords().find(section => section.id === id);
        const completed = Boolean(
            added &&
            added.header === restored.header &&
            added.text === restored.text &&
            added.index === targetIndex
        );
        if (completed) {
            const recordIndex = window.passiveUndoStack.indexOf(restored);
            if (recordIndex >= 0) window.passiveUndoStack.splice(recordIndex, 1);
            window.clearTimeout(restored.expiryTimer);
            openContextGUI(0, 0, 'passive');
            window.autoSaveToCache?.();
            window.CardHubToast?.success?.('Section restored.', { duration: 2200 });
            return true;
        }

        window.removeThisSection(id);
    }

    restored.status = 'pending';
    window.openContextGUI?.(0, 0, 'passive');
    window.CardHubToast?.error?.('Section not restored', {
        detail: 'Your section is still available to restore. Try Undo again.',
        duration: 3500
    });
    showPassiveDeleteUndoToast(restored, 'Restore section', 'Try Undo again.');
    return false;
};

window.guiAddForm = function() {
    window.addFormBlock();
    openContextGUI(0, 0, 'forms');
};
window.guiDeleteSpecificForm = function(idx) {
    const formCards = document.querySelectorAll('#forms-container .dokkan-card');
    if (formCards[idx]) {
        window.formUndoStack.push(formCards[idx].outerHTML);
        formCards[idx].remove();
        window.refreshFormList();
        if (window.syncToAbsLayout) window.syncToAbsLayout();
        openContextGUI(0, 0, 'forms');
    }
};
window.guiUndoForm = function() {
    if (window.formUndoStack.length === 0) return;
    const html = window.formUndoStack.pop();
    document.getElementById('forms-container')?.insertAdjacentHTML('beforeend', html);
    window.refreshFormList();
    if (window.syncToAbsLayout) window.syncToAbsLayout();
    openContextGUI(0, 0, 'forms');
};
window.guiUpdateFormName = function(idx, val) {
    const formCards = document.querySelectorAll('#forms-container .dokkan-card');
    if (formCards[idx]) formCards[idx].querySelector('.form-name').textContent = val;
    if (window.syncToAbsLayout) window.syncToAbsLayout();
};
window.guiUploadFormImage = function(idx, input) {
    const file = input?.files?.[0];
    const formCard = document.querySelectorAll('#forms-container .dokkan-card')[idx];
    if (!file || !formCard) return;

    const reader = new FileReader();
    reader.onload = function(event) {
        const image = formCard.querySelector('.form-image');
        if (!image) return;
        if (!formCard.hasAttribute('data-thumb-src')) {
            formCard.setAttribute('data-thumb-src', image.getAttribute('src') || image.src || '');
        }
        image.src = event.target.result;
        image.removeAttribute('data-export-name');
        const guiPreview = document.getElementById(`gui-form-image-preview-${idx}`);
        if (guiPreview) guiPreview.src = event.target.result;
        if (window.refreshFormList) window.refreshFormList();
        if (window.syncToAbsLayout) window.syncToAbsLayout();
    };
    reader.readAsDataURL(file);
};
window.guiUploadFormThumbnail = function(idx, input) {
    const file = input?.files?.[0];
    const formCard = document.querySelectorAll('#forms-container .dokkan-card')[idx];
    if (!file || !formCard) return;

    const reader = new FileReader();
    reader.onload = function(event) {
        formCard.setAttribute('data-thumb-src', event.target.result);
        const guiPreview = document.getElementById(`gui-form-thumb-preview-${idx}`);
        if (guiPreview) guiPreview.src = event.target.result;
        if (window.syncToAbsLayout) window.syncToAbsLayout();
    };
    reader.readAsDataURL(file);
};
window.guiUpdateFormLink = function(idx, val) {
    const formCards = document.querySelectorAll('#forms-container .dokkan-card');
    if (formCards[idx]) {
        let cleanUrl = (val || "").trim();
        if (cleanUrl && !cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://') && !cleanUrl.startsWith('javascript:')) {
            const slug = cleanUrl.replace(/^\/+/, '').replace(/\/+$/, '');
            cleanUrl = `https://abscustom.github.io/${slug}/`;
        }
        formCards[idx].querySelector('.form-link').href = cleanUrl || "javascript:void(0)";
    }
    if (window.syncToAbsLayout) window.syncToAbsLayout();
};

window.guiUpdateIdentityField = function(fieldId, val) {
    const target = document.getElementById(fieldId);
    if (target) target.value = val;
    window.updateIdentity();
    window.markEditorDirty?.();
};

window.removeLinkByIndex = function(idx) {
    const links = document.querySelectorAll('#card-link-container a');
    if (links[idx]) links[idx].remove();
    if (window.syncToAbsLayout) window.syncToAbsLayout();
    openContextGUI(0, 0, 'links');
};
window.removeCategoryByIndex = function(idx) {
    const cats = document.querySelectorAll('#card-category-container img');
    if (cats[idx]) cats[idx].parentElement.remove();
    if (window.syncToAbsLayout) window.syncToAbsLayout();
    openContextGUI(0, 0, 'categories');
};

window.syncLeaderGUI = function() {
    const gl = document.getElementById('gui-leaderInput');
    const l = document.getElementById('leaderInput');
    if (gl && l) gl.value = l.value;
};
window.syncLinkGUI = function() {
    const gl = document.getElementById('gui-link-input');
    const sl = document.getElementById('side-link-input');
    if (gl && sl) {
        sl.value = gl.value;
        window.addLinkSkill();
        gl.value = "";
        openContextGUI(0, 0, 'links');
    }
};
window.syncCategoryGUI = function() {
    const gc = document.getElementById('gui-category-input');
    const sc = document.getElementById('side-category-input');
    if (gc && sc) {
        sc.value = gc.value;
        window.addCategory();
        gc.value = "";
        openContextGUI(0, 0, 'categories');
    }
};

function bindContextListeners(editType) {
    if (editType === 'identity') {
        ['gui-descInput', 'gui-nameInput', 'gui-dateInput', 'gui-ezaDateInput', 'gui-sezaDateInput'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', () => {
                const target = document.getElementById(id.replace('gui-', ''));
                if (target) target.value = el.value;
                window.updateIdentity();
            });
        });
    }
    if (editType === 'leader') {
        const el = document.getElementById('gui-leaderInput');
        if (el) el.addEventListener('input', () => {
            const target = document.getElementById('leaderInput');
            if (target) target.value = el.value;
            window.updateIdentity();
        });
    }
    if (editType === 'passive') {
        const el = document.getElementById('gui-passive-name');
        if (el) el.addEventListener('input', () => {
            window.updatePassiveName(el.value);
        });
    }
    if (editType === 'links' || editType === 'categories') {
        const picker = document.querySelector(`#context-gui [data-visual-picker="${editType}"]`);
        const search = picker?.querySelector('.context-visual-search');
        search?.addEventListener('input', () => window.filterContextVisualChoices(search));
        picker?.addEventListener('click', event => {
            const choice = event.target.closest?.('[data-visual-choice]');
            if (choice) {
                window.toggleContextVisualChoice(choice);
                return;
            }
            if (event.target.closest?.('[data-visual-apply]')) window.applyContextVisualSelection(editType);
            else if (event.target.closest?.('[data-visual-cancel]')) window.cancelContextVisualSelection();
        });
    }
}

window.openContextGUI = openContextGUI;
window.openQuickCardEditor = function(type = 'identity') {
    if (isPublishedEditorLocked()) {
        if (window.unlockAdminMode) window.unlockAdminMode();
        return;
    }
    ensureGUIContainerExists();
    openContextGUI(0, 0, type, null);
};
