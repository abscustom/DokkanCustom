/* ============================================================
   ACTIVE / STANDBY SKILL ENGINE
   ============================================================ */
const ACTIVE_SKILL_KIND = Object.freeze({
    ACTIVE: 'active',
    DOMAIN: 'domain',
    STANDBY: 'standby'
});
const ACTIVE_SKILL_DEFAULT_ICON = 'https://abscustom.github.io/assets/images/sp_skill_icon_04.png';
const DOMAIN_SKILL_DEFAULT_ICON = 'https://abscustom.github.io/assets/images/ing_label_field.png';
const STANDBY_SKILL_DEFAULT_ICON = 'https://abscustom.github.io/assets/images/sp_skill_icon_04.png';

window.ACTIVE_SKILL_KIND = ACTIVE_SKILL_KIND;

const normalizeActiveSkillKind = value => {
    const normalized = String(value || '').trim().toLowerCase().replace(/[_-]+/g, ' ');
    if (!normalized) return null;
    if (/\b(standby|stand\s*by)\s*(skill|mode)?\b/i.test(normalized)) {
        return ACTIVE_SKILL_KIND.STANDBY;
    }
    return /\b(domain|dokkan\s+field|field)\b/i.test(normalized)
        ? ACTIVE_SKILL_KIND.DOMAIN
        : ACTIVE_SKILL_KIND.ACTIVE;
};

const inferActiveSkillKind = block => {
    const typeLabel = block?.querySelector?.('.active-type-label')?.textContent || '';
    return normalizeActiveSkillKind(typeLabel) || ACTIVE_SKILL_KIND.ACTIVE;
};

const getActiveSkillKind = block => {
    if (!block) return ACTIVE_SKILL_KIND.ACTIVE;
    const explicitKind = block.dataset?.activeKind ||
        block.getAttribute?.('data-active-kind') ||
        block.dataset?.skillKind ||
        block.getAttribute?.('data-skill-kind');
    return normalizeActiveSkillKind(explicitKind) || inferActiveSkillKind(block);
};

window.getActiveSkillKind = getActiveSkillKind;
window.normalizeActiveSkillKind = value => normalizeActiveSkillKind(value) || ACTIVE_SKILL_KIND.ACTIVE;

window.setActiveSkillKind = function(block, kind, options = {}) {
    if (!block) return ACTIVE_SKILL_KIND.ACTIVE;

    const normalizedKind = normalizeActiveSkillKind(kind) || ACTIVE_SKILL_KIND.ACTIVE;
    const isDomain = normalizedKind === ACTIVE_SKILL_KIND.DOMAIN;
    const isStandby = normalizedKind === ACTIVE_SKILL_KIND.STANDBY;
    block.dataset.activeKind = normalizedKind;
    // Keep the generic alias for older integrations and exported cards.
    block.dataset.skillKind = normalizedKind;
    block.classList.toggle('active-kind-domain', isDomain);
    block.classList.toggle('active-kind-standby', isStandby);
    block.classList.toggle('active-kind-active', !isDomain && !isStandby);

    const typeLabel = block.querySelector?.('.active-type-label');
    if (typeLabel && options.updateLabel !== false) {
        typeLabel.textContent = isDomain ? 'Dokkan Field' : (isStandby ? 'Standby' : 'Active Skill');
    }

    let icon = block.querySelector?.('.active-display-icon');
    if (!icon && options.ensureIcon !== false) {
        icon = document.createElement('img');
        icon.className = 'active-display-icon d-none';
        block.appendChild(icon);
    }
    if (icon) {
        const isAutomaticIcon = icon.dataset.activeKindIconAuto === 'true' || !icon.getAttribute('src');
        if (options.updateIcon !== false && (options.forceIcon === true || isAutomaticIcon)) {
            icon.src = isDomain
                ? DOMAIN_SKILL_DEFAULT_ICON
                : (isStandby ? STANDBY_SKILL_DEFAULT_ICON : ACTIVE_SKILL_DEFAULT_ICON);
            icon.dataset.activeKindIconAuto = 'true';
        }
        icon.classList.toggle('active-domain-icon', isDomain);
        icon.classList.toggle('active-standby-icon', isStandby);
    }

    return normalizedKind;
};

window.ensureActiveSkillKind = function(block) {
    if (!block) return ACTIVE_SKILL_KIND.ACTIVE;
    return window.setActiveSkillKind(block, getActiveSkillKind(block), {
        updateLabel: false,
        updateIcon: true
    });
};

window.normalizeActiveSkillBlocks = function(blocks = null) {
    const sourceBlocks = blocks || Array.from(document.querySelectorAll('.active-block'));
    sourceBlocks.forEach(block => window.ensureActiveSkillKind(block));
    return sourceBlocks;
};

const isDomainActiveSkillBlock = block => getActiveSkillKind(block) === ACTIVE_SKILL_KIND.DOMAIN;
window.isDomainActiveSkillBlock = isDomainActiveSkillBlock;
const isStandbyActiveSkillBlock = block => getActiveSkillKind(block) === ACTIVE_SKILL_KIND.STANDBY;
window.isStandbyActiveSkillBlock = isStandbyActiveSkillBlock;
window.getActiveSkillKindLabel = function(blockOrKind) {
    const kind = typeof blockOrKind === 'string'
        ? (normalizeActiveSkillKind(blockOrKind) || ACTIVE_SKILL_KIND.ACTIVE)
        : getActiveSkillKind(blockOrKind);
    if (kind === ACTIVE_SKILL_KIND.DOMAIN) return 'Dokkan Field';
    if (kind === ACTIVE_SKILL_KIND.STANDBY) return 'Standby';
    return 'Active Skill';
};
window.getActiveSkillSourceBlocks = function() {
    return Array.from(document.querySelectorAll('.active-block'));
};

/* Resolve a rendered abs.clean card back to its editable source block. The
   clean renderer separates normal Active Skills and Domains into two visual
   containers, so DOM position alone is not a reliable source index. */
window.resolveActiveSkillBlock = function(candidate) {
    const blocks = window.getActiveSkillSourceBlocks();
    if (!blocks.length) return null;
    if (candidate && blocks.includes(candidate)) return candidate;

    const rendered = candidate?.closest?.(
        '[data-abs-clean-source-index], .abs-clean-active-rendered, .abs-clean-domain-rendered, .abs-clean-standby-rendered, #abs-active-container > .abs-box, #abs-field-container > .abs-box, #abs-standby-container > .abs-box'
    );
    if (rendered) {
        const sourceIndex = Number.parseInt(rendered.dataset.absCleanSourceIndex || '', 10);
        if (Number.isInteger(sourceIndex) && blocks[sourceIndex]) return blocks[sourceIndex];

        const parent = rendered.parentElement;
        const renderedBlocks = parent
            ? Array.from(parent.children).filter(child => child.classList.contains('abs-box'))
            : [];
        const renderedIndex = renderedBlocks.indexOf(rendered);
        const parentKind = parent?.id === 'abs-field-container'
            ? ACTIVE_SKILL_KIND.DOMAIN
            : (parent?.id === 'abs-standby-container' ? ACTIVE_SKILL_KIND.STANDBY : ACTIVE_SKILL_KIND.ACTIVE);
        const matchingBlocks = blocks.filter(block => getActiveSkillKind(block) === parentKind);
        if (renderedIndex >= 0 && matchingBlocks[renderedIndex]) return matchingBlocks[renderedIndex];
    }

    return blocks[blocks.length - 1];
};

window.addActiveSkillSection = function(kind = ACTIVE_SKILL_KIND.ACTIVE) {
    const template = document.getElementById('active-template');
    const spot = document.getElementById('active-skill-insert-spot');
    if (!template || !spot) return;
    
    const clone = document.importNode(template.content, true);
    spot.parentNode.insertBefore(clone, spot);
    const blocks = window.getActiveSkillSourceBlocks();
    currentActiveSkill = blocks[blocks.length - 1] || null;
    window.setActiveSkillKind(currentActiveSkill, kind, { updateLabel: true, updateIcon: true });
    window.applyCardTheme(currentType); 
    window.refreshActiveDropdown(); 
    return currentActiveSkill;
};

window.moveActiveSkill = function(direction) {
    currentActiveSkill = window.resolveActiveSkillBlock(currentActiveSkill);
    if (!currentActiveSkill) return;
    if (direction === -1) { 
        const prev = currentActiveSkill.previousElementSibling;
        if (prev && prev.classList.contains('active-block')) {
            currentActiveSkill.parentNode.insertBefore(currentActiveSkill, prev);
        }
    } else if (direction === 1) { 
        const next = currentActiveSkill.nextElementSibling;
        if (next && next.classList.contains('active-block')) {
            currentActiveSkill.parentNode.insertBefore(next, currentActiveSkill);
        }
    }
    const nameInput = document.getElementById('input-active-name');
    const currentName = nameInput ? nameInput.value : "";
    window.refreshActiveDropdown();
    
    const sel = document.getElementById('active-selector');
    if (sel && currentName) {
        Array.from(sel.options).forEach((opt, index) => {
            if (opt.text.includes(currentName)) {
                sel.value = index;
                window.handleActiveSelection();
            }
        });
    }
};

window.removeActiveSkillSection = function() {
    const blocks = window.getActiveSkillSourceBlocks();
    const target = window.resolveActiveSkillBlock(currentActiveSkill);
    if (!target) {
        window.refreshActiveDropdown();
        return false;
    }

    const targetIndex = blocks.indexOf(target);
    target.remove();
    const remaining = window.getActiveSkillSourceBlocks();
    currentActiveSkill = remaining[Math.min(Math.max(targetIndex, 0), remaining.length - 1)] || null;
    window.refreshActiveDropdown();
    window.updateAbsStyleActiveSkills?.();
    window.syncToAbsLayout?.();
    return true;
};

window.refreshActiveDropdown = function() {
    const sel = document.getElementById('active-selector');
    const all = window.getActiveSkillSourceBlocks();
    window.normalizeActiveSkillBlocks(all);
    const detailsContainer = document.getElementById('active-editor-details'); 
    
    if (all.length === 0) {
        if (detailsContainer) detailsContainer.style.display = 'none'; 
        currentActiveSkill = null;
        if (document.getElementById('input-active-type')) document.getElementById('input-active-type').value = '';
        if (document.getElementById('input-active-name')) document.getElementById('input-active-name').value = '';
        if (document.getElementById('input-active-effect')) document.getElementById('input-active-effect').value = '';
        if (document.getElementById('input-active-condition-title')) document.getElementById('input-active-condition-title').value = '';
        if (document.getElementById('input-active-conditions')) document.getElementById('input-active-conditions').value = '';
        return;
    }

    if (detailsContainer) detailsContainer.style.display = 'block'; 
    if (sel) {
        sel.innerHTML = '';
        all.forEach((b, i) => {
            const nameEl = b.querySelector('.active-display-name');
            const name = nameEl ? nameEl.textContent : "Skill";
            const option = document.createElement('option');
            const kindLabel = window.getActiveSkillKindLabel?.(b) || 'Active Skill';
            option.value = i.toString();
            option.textContent = `${i + 1}: [${kindLabel}] ${name}`;
            sel.appendChild(option);
        });
        
        if (!currentActiveSkill || Array.from(all).indexOf(currentActiveSkill) === -1) {
            sel.value = (all.length - 1).toString(); 
            window.handleActiveSelection();
        } else {
            sel.value = Array.from(all).indexOf(currentActiveSkill).toString();
        }
    }
};

window.handleActiveSelection = function() {
    const sel = document.getElementById('active-selector');
    if (!sel) return;
    
    const idx = sel.value;
    const blocks = window.getActiveSkillSourceBlocks();
    currentActiveSkill = blocks[idx];
    if(!currentActiveSkill) return;
    window.ensureActiveSkillKind(currentActiveSkill);
    const selectedKind = window.getActiveSkillKind?.(currentActiveSkill) || 'active';
    isSwitchingActive = true; 
    
    const typeEl = currentActiveSkill.querySelector('.active-type-label');
    const inputType = document.getElementById('input-active-type');
    if (inputType) inputType.value = selectedKind === 'domain'
        ? 'Dokkan Field'
        : (selectedKind === 'standby'
            ? 'Standby'
            : (typeEl ? typeEl.textContent : "Active Skill"));
    
    const nameEl = currentActiveSkill.querySelector('.active-display-name');
    const inputName = document.getElementById('input-active-name');
    if (inputName) inputName.value = nameEl ? nameEl.textContent : "New Skill";
    
    const effEl = currentActiveSkill.querySelector('.active-display-effect');
    const inputEff = document.getElementById('input-active-effect');
    if (inputEff) inputEff.value = effEl ? effEl.innerHTML.replace(/<br\s*[\/]?>/gi, "\n") : "";
    
    const condTitleEl = currentActiveSkill.querySelector('.active-display-condition-title');
    const inputCondTitle = document.getElementById('input-active-condition-title');
    if (inputCondTitle) inputCondTitle.value = condTitleEl ? condTitleEl.textContent : "Activation Condition(s)";

    const condEl = currentActiveSkill.querySelector('.active-display-condition');
    const inputConds = document.getElementById('input-active-conditions');
    if (inputConds) inputConds.value = condEl ? condEl.innerHTML.replace(/<br\s*[\/]?>/gi, "\n") : "";
    
    const condRow = currentActiveSkill.querySelector('.active-condition-row');
    const sidebarCondField = document.getElementById('active-sidebar-conditions-field');
    if (sidebarCondField && condRow) {
        sidebarCondField.style.display = condRow.classList.contains('d-none') ? 'none' : 'block';
    }

    isSwitchingActive = false;
};

window.syncActiveSkill = function() {
    currentActiveSkill = window.resolveActiveSkillBlock?.(currentActiveSkill) || currentActiveSkill;
    if (!currentActiveSkill || (typeof isSwitchingActive !== 'undefined' && isSwitchingActive)) return;
    window.ensureActiveSkillKind(currentActiveSkill);
    
    const typeStr = document.getElementById('input-active-type')?.value || "Active Skill";
    const nameStr = document.getElementById('input-active-name')?.value || "Skill";
    let effRaw = document.getElementById('input-active-effect')?.value || "";
    let condTitleStr = document.getElementById('input-active-condition-title')?.value || "Condition";
    let condRaw = document.getElementById('input-active-conditions')?.value || "";
    
    const effParsed = (typeof window.parsePassiveIcons === 'function') ? window.parsePassiveIcons(effRaw) : effRaw;
    const condParsed = (typeof window.parsePassiveIcons === 'function') ? window.parsePassiveIcons(condRaw) : condRaw;

    const effHtml = effParsed.replace(/\n/g, '<br>');
    const condHtml = condParsed.replace(/\n/g, '<br>');

    const typeDisp = currentActiveSkill.querySelector('.active-type-label');
    if(typeDisp) typeDisp.textContent = typeStr;
    const nameDisp = currentActiveSkill.querySelector('.active-display-name');
    if(nameDisp) nameDisp.textContent = nameStr;
    const effDisp = currentActiveSkill.querySelector('.active-display-effect');
    if(effDisp) effDisp.innerHTML = effHtml;
    const condTitleDisp = currentActiveSkill.querySelector('.active-display-condition-title');
    if(condTitleDisp) condTitleDisp.textContent = condTitleStr;
    const condDisp = currentActiveSkill.querySelector('.active-display-condition');
    if(condDisp) condDisp.innerHTML = condHtml;

    // Automatically remove divider line and condition row if condition box is empty
    const condRow = currentActiveSkill.querySelector('.active-condition-row');
    const divRow = currentActiveSkill.querySelector('.active-divider-row');
    const hasCondText = condRaw.trim() !== "";

    if (hasCondText) {
        if (condRow) condRow.classList.remove('d-none');
        if (divRow) divRow.classList.remove('d-none');
    } else {
        if (condRow) condRow.classList.add('d-none');
        if (divRow) divRow.classList.add('d-none');
    }
    
    const sel = document.getElementById('active-selector');
    if (sel && sel.options[sel.selectedIndex]) {
        sel.options[sel.selectedIndex].text = `${parseInt(sel.value) + 1}: ${nameStr}`;
    }

    if (window.updateAbsStyleActiveSkills) window.updateAbsStyleActiveSkills();
    if (window.syncToAbsLayout) window.syncToAbsLayout();
};
