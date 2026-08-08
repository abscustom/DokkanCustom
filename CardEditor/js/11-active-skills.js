/* ============================================================
   ACTIVE / STANDBY SKILL ENGINE
   ============================================================ */
window.addActiveSkillSection = function() {
    const template = document.getElementById('active-template');
    const spot = document.getElementById('active-skill-insert-spot');
    if (!template || !spot) return;
    
    const clone = document.importNode(template.content, true);
    spot.parentNode.insertBefore(clone, spot);
    window.applyCardTheme(currentType); 
    window.refreshActiveDropdown(); 
};

window.moveActiveSkill = function(direction) {
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
    const blocks = document.querySelectorAll('.active-block');
    if (blocks.length > 0) {
        blocks[blocks.length - 1].remove(); 
        window.refreshActiveDropdown();
    }
};

window.refreshActiveDropdown = function() {
    const sel = document.getElementById('active-selector');
    const all = document.querySelectorAll('.active-block');
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
            sel.insertAdjacentHTML('beforeend', `<option value="${i}">${i+1}: ${name}</option>`);
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
    const blocks = document.querySelectorAll('.active-block');
    currentActiveSkill = blocks[idx];
    if(!currentActiveSkill) return;
    isSwitchingActive = true; 
    
    const typeEl = currentActiveSkill.querySelector('.active-type-label');
    const inputType = document.getElementById('input-active-type');
    if (inputType) inputType.value = typeEl ? typeEl.textContent : "Active Skill";
    
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
    if (!currentActiveSkill || isSwitchingActive) return;
    
    const typeStr = document.getElementById('input-active-type')?.value || "Active Skill";
    const nameStr = document.getElementById('input-active-name')?.value || "Skill";
    const effStr = (document.getElementById('input-active-effect')?.value || "").replace(/\n/g, '<br>');
    const condTitleStr = document.getElementById('input-active-condition-title')?.value || "Condition";
    const condStr = (document.getElementById('input-active-conditions')?.value || "").replace(/\n/g, '<br>');
    
    const typeDisp = currentActiveSkill.querySelector('.active-type-label');
    if(typeDisp) typeDisp.textContent = typeStr;
    const nameDisp = currentActiveSkill.querySelector('.active-display-name');
    if(nameDisp) nameDisp.textContent = nameStr;
    const effDisp = currentActiveSkill.querySelector('.active-display-effect');
    if(effDisp) effDisp.innerHTML = effStr;
    const condTitleDisp = currentActiveSkill.querySelector('.active-display-condition-title');
    if(condTitleDisp) condTitleDisp.textContent = condTitleStr;
    const condDisp = currentActiveSkill.querySelector('.active-display-condition');
    if(condDisp) condDisp.innerHTML = condStr;
    
    const sel = document.getElementById('active-selector');
    if (sel && sel.options[sel.selectedIndex]) {
        sel.options[sel.selectedIndex].text = `${parseInt(sel.value) + 1}: ${nameStr}`;
    }
};