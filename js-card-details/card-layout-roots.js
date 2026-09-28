/*
 * Independent presentation roots shared by the editor and card viewers.
 * ABS.Clean starts from the common card-shell markup, then receives its own
 * ID namespace and stable data roles. Rendering always resolves elements
 * against the active root; card state remains owned by the shared engine.
 */
(() => {
    'use strict';

    const ROOT_IDS = {
        'abs-clean': 'layout-abs-clean',
        'abs-style': 'layout-abs-style',
        dokkaninfo: 'layout-dokkaninfo'
    };
    const CLEAN_ID_PREFIX = 'clean-';
    const ID_REFERENCE_ATTRIBUTES = [
        'for', 'aria-labelledby', 'aria-describedby', 'aria-controls', 'aria-owns',
        'aria-flowto', 'headers', 'list', 'form'
    ];
    const INFO_ELEMENT_SELECTORS = {
        'abs-char-title': '#char-description',
        'abs-char-name': '#char-name',
        'abs-leader-skill': '#leader-skill',
        'abs-passive-name': '.passive-name-display',
        'abs-passive-skill-box': '[data-edit="passive"]',
        'abs-passive-container': '#card-passive-container',
        'abs-sa-container': '#sa-insert-spot',
        'abs-active-container': '#active-skill-insert-spot',
        'abs-field-container': '#info-field-skill-container',
        'abs-standby-container': '#info-standby-skill-container',
        'abs-finish-container': '#info-finish-skill-container',
        'abs-link-container': '#card-link-container',
        'abs-category-container': '#card-category-container',
        'abs-awakenings-container': '#info-awakenings-container',
        'abs-transformations-box': '#info-transformations-box',
        'abs-transformations-container': '#info-transformations-container',
        'abs-art-char': '#myOverlayImage',
        'abs-art-video': '#myOverlayVideo',
        'abs-card-bg-lwf-canvas': '#info-card-bg-lwf-canvas',
        'abs-thumb-img': '#img-lr',
        'abs-top-rarity-icon': '#main-rarity-icon',
        'abs-top-type-icon': '.typing-icon',
        'abs-frame-img': '.card-frame',
        'abs-spin-dial': '.lr-spin-dial',
        'abs-lightning': '.lightning-overlay',
        'abs-awakening-img': '#awakening-img',
        'abs-stat-hp-val': '#stat-hp-100',
        'abs-stat-atk-val': '#stat-atk-100',
        'abs-stat-def-val': '#stat-def-100',
        'abs-categories-box': '[data-edit="categories"]'
    };
    const layoutElementIds = new Set();

    function normalizeThemeRootName(theme) {
        const normalized = normalizeCardPresentationTheme(theme, '');
        return ROOT_IDS[normalized] ? normalized : '';
    }

    function rootFor(theme) {
        const id = ROOT_IDS[String(theme || '').toLowerCase()];
        return id ? document.getElementById(id) : null;
    }

    function normalizeCardPresentationTheme(themeName, fallback = 'abs-clean') {
        const value = String(themeName || '').trim().toLowerCase();
        if (['sba', 'abs.clean', 'abs-clean', 'clean'].includes(value)) return 'abs-clean';
        if (['abs', 'abs.style', 'abs-style', 'style'].includes(value)) return 'abs-style';
        if (['dokkan-info', 'dokkan.info', 'dokkaninfo', 'info'].includes(value)) return 'dokkaninfo';
        return ROOT_IDS[value] ? value : fallback;
    }

    function rewriteCleanReferences(root) {
        const descendants = Array.from(root.querySelectorAll('[id]'));
        const idMap = new Map();
        descendants.forEach((element) => {
            const originalId = element.id;
            idMap.set(originalId, `${CLEAN_ID_PREFIX}${originalId}`);
            element.dataset.cardElement = originalId;
        });

        descendants.forEach((element) => {
            element.id = idMap.get(element.id);
            ID_REFERENCE_ATTRIBUTES.forEach((attribute) => {
                const value = element.getAttribute(attribute);
                if (!value) return;
                element.setAttribute(attribute, value.split(/\s+/).map(id => idMap.get(id) || id).join(' '));
            });
            ['href', 'data-bs-target', 'data-target'].forEach((attribute) => {
                const value = element.getAttribute(attribute);
                if (!value?.startsWith('#')) return;
                const replacement = idMap.get(value.slice(1));
                if (replacement) element.setAttribute(attribute, `#${replacement}`);
            });
        });
    }

    function ensureCardLayoutRoots() {
        const styleRoot = document.getElementById(ROOT_IDS['abs-style']);
        if (!styleRoot) return null;
        styleRoot.dataset.cardLayout ||= 'abs-style';
        styleRoot.querySelectorAll('[id]').forEach((element) => {
            element.dataset.cardElement ||= element.id;
            layoutElementIds.add(element.id);
        });

        let cleanRoot = document.getElementById(ROOT_IDS['abs-clean']);
        if (!cleanRoot) {
            cleanRoot = styleRoot.cloneNode(true);
            cleanRoot.id = ROOT_IDS['abs-clean'];
            cleanRoot.dataset.cardLayout = 'abs-clean';
            cleanRoot.classList.add('card-layout-root', 'card-layout-root-clean');
            rewriteCleanReferences(cleanRoot);
            styleRoot.insertAdjacentElement('afterend', cleanRoot);
        }
        cleanRoot.dataset.cardLayout = 'abs-clean';
        styleRoot.classList.add('card-layout-root', 'card-layout-root-style');

        const infoRoot = document.getElementById(ROOT_IDS.dokkaninfo);
        if (infoRoot) {
            infoRoot.dataset.cardLayout = 'dokkaninfo';
            infoRoot.classList.add('card-layout-root', 'card-layout-root-info');
            const releaseDate = infoRoot.querySelector('#release-dates-container');
            if (!infoRoot.querySelector('#info-awakenings-container')) {
                const awakenings = document.createElement('div');
                awakenings.id = 'info-awakenings-container';
                awakenings.className = 'info-rendered-awakenings';
                if (releaseDate) releaseDate.insertAdjacentElement('afterend', awakenings);
                else infoRoot.appendChild(awakenings);
            }
            let infoTransformations = infoRoot.querySelector('#info-transformations-box');
            if (!infoTransformations) {
                infoTransformations = document.createElement('section');
                infoTransformations.id = 'info-transformations-box';
                infoTransformations.className = 'info-rendered-transformations d-none';
                infoTransformations.innerHTML = '<div id="info-transformations-container"></div>';
                const skillSlots = infoRoot.querySelector('#info-rendered-skills');
                (skillSlots || infoRoot).appendChild(infoTransformations);
            }
            let infoSkillSlots = infoRoot.querySelector('#info-rendered-skills');
            if (!infoSkillSlots) {
                infoSkillSlots = document.createElement('div');
                infoSkillSlots.id = 'info-rendered-skills';
                infoSkillSlots.className = 'info-rendered-skills';
                infoRoot.appendChild(infoSkillSlots);
            }
            [
                ['info-field-skill-container', 'abs-field-container'],
                ['info-standby-skill-container', 'abs-standby-container'],
                ['info-finish-skill-container', 'abs-finish-container']
            ].forEach(([id, className]) => {
                if (infoRoot.querySelector(`#${id}`)) return;
                const slot = document.createElement('div');
                slot.id = id;
                slot.className = `info-rendered-skill-slot ${className}`;
                infoSkillSlots.appendChild(slot);
            });
            const nativeForms = infoRoot.querySelector('#forms-card-wrapper');
            if (infoTransformations && nativeForms?.parentElement) {
                nativeForms.insertAdjacentElement('afterend', infoTransformations);
            } else if (infoTransformations && infoSkillSlots && infoTransformations.parentElement !== infoSkillSlots) {
                infoSkillSlots.appendChild(infoTransformations);
            }
        }
        return { 'abs-clean': cleanRoot, 'abs-style': styleRoot, dokkaninfo: infoRoot };
    }

    function getCardLayoutRoot(theme = null) {
        const roots = ensureCardLayoutRoots();
        if (!roots) return null;
        if (theme) return roots[normalizeThemeRootName(theme)] || null;

        const activeName = document.documentElement.dataset.activeCardLayout ||
            document.body?.dataset.activeCardLayout;
        if (activeName && roots[activeName]) return roots[activeName];
        if (document.body?.classList.contains('theme-dokkaninfo')) return roots.dokkaninfo || roots['abs-style'];
        if (document.body?.classList.contains('theme-abs-clean') || document.body?.classList.contains('theme-sba')) {
            return roots['abs-clean'];
        }
        const remembered = window.activeCardLayoutRoot;
        if (remembered?.isConnected) return remembered;
        return roots['abs-style'];
    }

    function belongsToAnotherPresentationRoot(element, targetRoot, roots = ensureCardLayoutRoots()) {
        if (!element || !targetRoot || !roots) return false;
        return Object.values(roots).some(root => root && root !== targetRoot && root.contains(element));
    }

    function getCardLayoutElement(id, root = null) {
        const value = String(id || '');
        if (!value) return null;
        if (ROOT_IDS[value]) return rootFor(value);
        if (value === 'layout-abs-style' && !root) {
            const activeRoot = getCardLayoutRoot();
            return activeRoot?.dataset.cardLayout === 'dokkaninfo' ? rootFor('abs-style') : activeRoot;
        }
        if (value === 'layout-abs-clean' || value === 'layout-abs-style' || value === 'layout-dokkaninfo') {
            const theme = value === 'layout-abs-clean' ? 'abs-clean' : value === 'layout-abs-style' ? 'abs-style' : 'dokkaninfo';
            return rootFor(theme);
        }

        let targetRoot = root || getCardLayoutRoot();
        const rootName = targetRoot?.dataset?.cardLayout;
        if (rootName === 'dokkaninfo') {
            const infoSelector = INFO_ELEMENT_SELECTORS[value];
            const infoElement = infoSelector ? targetRoot.querySelector(infoSelector) : null;
            if (infoElement) return infoElement;
        }
        let element = null;
        if (targetRoot?.dataset.cardLayout === 'abs-clean') {
            element = targetRoot.querySelector(`[data-card-element="${value}"]`) ||
                (/^[\w-]+$/.test(value) ? targetRoot.querySelector(`#${value}`) : null);
        } else if (/^[\w-]+$/.test(value)) {
            element = targetRoot?.querySelector(`#${value}`) || null;
        }
        if (element) return element;
        const globalElement = document.getElementById(value);
        if (belongsToAnotherPresentationRoot(globalElement, targetRoot)) return null;
        if (targetRoot?.dataset?.cardLayout && layoutElementIds.has(value)) return null;
        return globalElement;
    }

    function queryCardLayout(selector, root = null) {
        const originalSelector = String(selector || '');
        if (!originalSelector) return null;
        const targetsAbsLayout = originalSelector.startsWith('#layout-abs-style');
        let targetRoot = root || getCardLayoutRoot();
        if (targetRoot?.dataset.cardLayout === 'dokkaninfo' && originalSelector.startsWith('#layout-abs-style')) {
            targetRoot = rootFor('abs-style');
        }
        let scopedSelector = originalSelector;
        if (scopedSelector.startsWith('#layout-abs-style')) {
            scopedSelector = scopedSelector.slice('#layout-abs-style'.length).trim() || ':scope';
        }
        if (targetRoot?.dataset.cardLayout === 'abs-clean') {
            scopedSelector = scopedSelector.replace(/#([\w-]+)/g, (token, id) =>
                layoutElementIds.has(id) ? `[data-card-element="${id}"]` : token
            );
        }
        const match = targetRoot?.querySelector(scopedSelector);
        if (match) return match;
        if (targetsAbsLayout && targetRoot?.dataset.cardLayout !== 'dokkaninfo') return null;
        const globalMatch = document.querySelector(originalSelector);
        if (belongsToAnotherPresentationRoot(globalMatch, targetRoot)) return null;
        return globalMatch;
    }

    function setActiveCardLayout(theme, { show = true } = {}) {
        const roots = ensureCardLayoutRoots();
        if (!roots) return null;
        const themeName = normalizeThemeRootName(theme);
        const selected = roots[themeName];
        if (!selected) return null;

        Object.entries(roots).forEach(([name, root]) => {
            if (!root) return;
            const active = root === selected && show;
            root.hidden = !active;
            root.style.display = active ? '' : 'none';
            root.toggleAttribute('aria-hidden', !active);
            root.dataset.activeCardLayout = String(active);
        });
        document.documentElement.dataset.activeCardLayout = themeName;
        if (document.body) document.body.dataset.activeCardLayout = themeName;
        window.activeCardLayoutRoot = selected;
        window.dispatchEvent(new CustomEvent('card-layout-root-change', { detail: { theme: themeName, root: selected } }));
        return selected;
    }

    window.ensureCardLayoutRoots = ensureCardLayoutRoots;
    window.getCardLayoutRoot = getCardLayoutRoot;
    window.getCardLayoutElement = getCardLayoutElement;
    window.queryCardLayout = queryCardLayout;
    window.setActiveCardLayout = setActiveCardLayout;
    window.normalizeCardPresentationTheme = normalizeCardPresentationTheme;

    const initialize = () => {
        const roots = ensureCardLayoutRoots();
        if (!roots) return;
        const body = document.body;
        const initialTheme = body?.classList.contains('theme-dokkaninfo')
            ? 'dokkaninfo'
            : (body?.classList.contains('theme-abs-style') ? 'abs-style' : 'abs-clean');
        setActiveCardLayout(initialTheme);
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize, { once: true });
    } else {
        initialize();
    }
})();
