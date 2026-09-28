/*
 * Dokkan Info editor preview presentation.
 *
 * The hidden source blocks remain the single editable record. This module
 * projects safe display copies of those blocks into Dokkan Info's native
 * Super Attack and Active Skill slots, keeping the original Info template structure and rich effect markup
 * without reusing source-only .sa-block / .active-block classes.
 */
(() => {
    'use strict';

    let generatedId = 0;

    function newSkillId(kind) {
        const uuid = window.crypto?.randomUUID?.();
        generatedId += 1;
        return `${kind}-${uuid || `${Date.now().toString(36)}-${generatedId.toString(36)}`}`;
    }

    function collectSources() {
        return {
            superAttacks: Array.from(window.getSuperAttackSourceBlocks?.() || []),
            activeSkills: Array.from(window.getActiveSkillSourceBlocks?.() || [])
        };
    }

    function ensureStableSourceIds(sources) {
        const used = new Set();
        const entries = [
            ...sources.superAttacks.map(block => ({ block, kind: 'sa' })),
            ...sources.activeSkills.map(block => ({ block, kind: 'active' }))
        ];

        entries.forEach(({ block, kind }) => {
            let id = String(block.getAttribute('data-editor-skill-id') || '').trim();
            if (!id || used.has(id)) {
                id = newSkillId(kind);
                while (used.has(id)) id = newSkillId(kind);
                block.setAttribute('data-editor-skill-id', id);
            }
            used.add(id);
        });
        return sources;
    }

    function safeDisplayClone(source, sourceKind, infoKind, sourceId) {
        const display = source.cloneNode(true);
        display.classList.remove('sa-block', 'active-block');
        display.classList.add('info-rendered-skill', `info-rendered-${infoKind}`);
        display.dataset.infoSkillKind = infoKind;
        display.dataset.infoSourceKind = sourceKind;
        display.dataset.infoSourceSkillId = sourceId;
        display.setAttribute('data-edit', sourceKind === 'super-attack' ? 'sa' : 'active');

        display.querySelectorAll('.sa-block, .active-block').forEach(element => {
            element.classList.remove('sa-block', 'active-block');
        });
        display.querySelectorAll('script, iframe, object, embed, form, input, textarea, select, button').forEach(element => element.remove());
        [display, ...display.querySelectorAll('*')].forEach(element => {
            Array.from(element.attributes).forEach(attribute => {
                const name = attribute.name.toLowerCase();
                if (name === 'id' || name === 'srcdoc' || name === 'href' || name === 'formaction' || name.startsWith('on')) {
                    element.removeAttribute(attribute.name);
                }
            });
            if (element.tagName === 'IMG') {
                const src = String(element.getAttribute('src') || '').trim();
                if (/^javascript:/i.test(src)) element.removeAttribute('src');
            }
        });
        display.querySelectorAll('[data-edit]').forEach(element => element.removeAttribute('data-edit'));
        display.setAttribute('data-edit', sourceKind === 'super-attack' ? 'sa' : 'active');

        return display;
    }

    function selectedSourceIdentity() {
        const gui = document.getElementById('context-gui');
        if (!gui || getComputedStyle(gui).display === 'none') return null;
        const target = window.activeContextGUITarget;
        const id = target?.dataset?.infoSourceSkillId;
        const kind = target?.dataset?.infoSourceKind;
        return id && kind ? { id, kind } : null;
    }

    function appendDisplay(target, source, sourceKind, infoKind, sourceId, selected) {
        if (!target || !source) return null;
        const display = safeDisplayClone(source, sourceKind, infoKind, sourceId);
        const typeSelector = sourceKind === 'super-attack' ? '.sa-type-label' : '.active-type-label';
        const typeLabel = display.querySelector(typeSelector);
        if (typeLabel) {
            typeLabel.classList.remove('sa-type-label', 'active-type-label');
            typeLabel.classList.add('info-skill-type');
        }
        const name = sourceKind === 'super-attack'
            ? source.querySelector('.sa-display-name')?.textContent?.trim()
            : source.querySelector('.active-display-name')?.textContent?.trim();
        display.setAttribute('aria-label', `Edit ${infoKind.replace(/-/g, ' ')}${name ? `: ${name}` : ''}`);

        if (selected) {
            display.classList.add('active-selected-glow');
            if (sourceKind === 'active') display.classList.add('active-skill-edit-selected');
        }
        target.appendChild(display);
        return display;
    }

    window.ensureEditorSkillSourceIds = function() {
        return ensureStableSourceIds(collectSources());
    };

    window.resolveInfoEditorSkillSource = function(candidate) {
        const rendered = candidate?.closest?.('[data-info-source-skill-id][data-info-source-kind]');
        if (!rendered) return null;
        const sources = rendered.dataset.infoSourceKind === 'super-attack'
            ? (window.getSuperAttackSourceBlocks?.() || [])
            : (window.getActiveSkillSourceBlocks?.() || []);
        return Array.from(sources).find(block => block.getAttribute('data-editor-skill-id') === rendered.dataset.infoSourceSkillId) || null;
    };

    window.renderEditorSkillsInDokkanInfo = function(infoRoot = null) {
        const root = infoRoot || window.getCardLayoutRoot?.('dokkaninfo');
        if (!root || root.dataset?.cardLayout !== 'dokkaninfo') return false;

        const targets = {
            superAttack: window.getCardLayoutElement?.('abs-sa-container', root),
            active: window.getCardLayoutElement?.('abs-active-container', root),
            field: window.getCardLayoutElement?.('abs-field-container', root),
            standby: window.getCardLayoutElement?.('abs-standby-container', root),
            finish: window.getCardLayoutElement?.('abs-finish-container', root)
        };
        const requiredTargets = [targets.superAttack, targets.active];
        if (requiredTargets.some(target => !target || !root.contains(target))) {
            console.warn('[Dokkan Info] Skill preview refresh skipped: required Info skill slots are missing.');
            return false;
        }

        const sources = ensureStableSourceIds(collectSources());
        const selected = selectedSourceIdentity();
        Object.values(targets).filter(Boolean).forEach(target => target.replaceChildren());

        sources.superAttacks.forEach(source => {
            const id = source.getAttribute('data-editor-skill-id');
            const isSelected = selected?.kind === 'super-attack' && selected.id === id;
            const display = appendDisplay(targets.superAttack, source, 'super-attack', 'super-attack', id, isSelected);
            if (isSelected) window.activeContextGUITarget = display;
        });

        sources.activeSkills.forEach(source => {
            const kind = window.getActiveSkillKind?.(source) || 'active';
            const infoKind = kind === 'domain' ? 'dokkan-field' : (kind === 'standby' ? 'standby-skill' : 'active-skill');
            // Dokkan Info's editor preview keeps every editable skill in the
            // normal Active Skill slot. The kind only changes its displayed
            // label here; moving field/standby variants to the native viewer
            // sections would relocate the preview card to the bottom of the page.
            const target = targets.active;
            if (!target) return;
            const id = source.getAttribute('data-editor-skill-id');
            const isSelected = selected?.kind === 'active' && selected.id === id;
            const display = appendDisplay(target, source, 'active', infoKind, id, isSelected);
            if (isSelected) {
                window.activeContextGUITarget = display;
                window.applyActiveSkillHighlight?.(display);
            }
        });

        return true;
    };
})();
