

/* ============================================================
   SUPER ATTACK ENGINE LOGIC
   ============================================================ */

window.addSuperAttackSection = function() {
    const template = document.getElementById('sa-template');
    const spot = document.getElementById('sa-insert-spot');
    if (!template || !spot) return;
    
    const clone = document.importNode(template.content, true);
    spot.parentNode.insertBefore(clone, spot);
    if (window.applyCardTheme) window.applyCardTheme(currentType);
    window.refreshSADropdown();

    if (typeof currentAwakeningMode !== 'undefined' && currentAwakeningMode !== 'none' && window.updateSANamesWithExtreme) {
        window.updateSANamesWithExtreme(true);
    }
    if (window.updateAbsStyleSuperAttacks) window.updateAbsStyleSuperAttacks();
};

window.removeSuperAttackSection = function() {
    const blocks = document.querySelectorAll('.sa-block');
    if (blocks.length > 0) {
        blocks[blocks.length - 1].remove();
        window.refreshSADropdown();
    }
    if (window.updateAbsStyleSuperAttacks) window.updateAbsStyleSuperAttacks();
};

window.moveSection = function(id, direction) {
    const sideSec = document.getElementById("side-sec-" + id);
    const cardSec = document.getElementById("card-sec-" + id);
    if (!sideSec || !cardSec) return;

    if (direction === -1) { 
        const prevSide = sideSec.previousElementSibling;
        const prevCard = cardSec.previousElementSibling;
        if (prevSide && prevCard) {
            sideSec.parentNode.insertBefore(sideSec, prevSide);
            cardSec.parentNode.insertBefore(cardSec, prevCard);
        }
    } else if (direction === 1) { 
        const nextSide = sideSec.nextElementSibling;
        const nextCard = cardSec.nextElementSibling;
        if (nextSide && nextCard) {
            sideSec.parentNode.insertBefore(nextSide, sideSec);
            cardSec.parentNode.insertBefore(nextCard, cardSec);
        }
    }
    if (window.reindexSections) window.reindexSections(); 
};

window.refreshSADropdown = function() {
    const sel = document.getElementById('sa-selector');
    const all = document.querySelectorAll('.sa-block');
    const detailsContainer = document.getElementById('sa-editor-details'); 
    
    if (all.length === 0) {
        if (detailsContainer) detailsContainer.style.display = 'none'; 
        currentSuperAttack = null; 
        if (document.getElementById('input-sa-name')) document.getElementById('input-sa-name').value = '';
        if (document.getElementById('input-sa-type-label')) document.getElementById('input-sa-type-label').value = '';
        if (document.getElementById('input-sa-effects')) document.getElementById('input-sa-effects').value = '';
        if (document.getElementById('input-activation')) document.getElementById('input-activation').value = '';
        if (document.getElementById('statList')) document.getElementById('statList').innerHTML = '';
        if (window.updateAbsStyleSuperAttacks) window.updateAbsStyleSuperAttacks();
        return; 
    }

    if (detailsContainer) detailsContainer.style.display = 'block'; 
    if (sel) {
        sel.innerHTML = '';
        all.forEach((b, i) => {
            const nameEl = b.querySelector('.sa-display-name') || b.querySelector('.sa-name');
            const name = nameEl ? nameEl.textContent : "Super Attack";
            sel.insertAdjacentHTML('beforeend', `<option value="${i}">${i+1}: ${name}</option>`);
        });
        
        if (!currentSuperAttack || Array.from(all).indexOf(currentSuperAttack) === -1) {
            sel.value = "0";
            window.handleSASelection();
        } else {
            sel.value = Array.from(all).indexOf(currentSuperAttack).toString();
        }
    }
    if (window.updateAbsStyleSuperAttacks) window.updateAbsStyleSuperAttacks();
};

window.handleSATypeChange = function(val) {
    const customContainer = document.getElementById('custom-sa-label-container');
    const customInput = document.getElementById('input-sa-type-label');
    if (val === 'custom') {
        if (customContainer) customContainer.style.display = 'block';
    } else {
        if (customContainer) customContainer.style.display = 'none';
        if (customInput) customInput.value = val; 
        window.syncSuperAttack(); 
    }
};

window.handleSASelection = function() {
    const sel = document.getElementById('sa-selector');
    if (!sel) return;
    
    const idx = sel.value;
    const blocks = document.querySelectorAll('.sa-block');
    currentSuperAttack = blocks[idx];
    if(!currentSuperAttack) return;
    
    isSwitching = true; 
    const nameEl = currentSuperAttack.querySelector('.sa-display-name');
    const inputSaName = document.getElementById('input-sa-name');
    if (inputSaName) inputSaName.value = nameEl ? nameEl.textContent.replace(/\s*\(Extreme\)$/i, "") : "";
    
    const labelEl = currentSuperAttack.querySelector('.sa-type-label');
    const currentLabelText = labelEl ? labelEl.textContent : "Super Attack";
    const typeDropdown = document.getElementById('sa-type-dropdown');
    const customContainer = document.getElementById('custom-sa-label-container');
    const customInput = document.getElementById('input-sa-type-label');
    const presets = ["Super Attack", "Ultra Super Attack", "Ex Super Attack", "Unit Super Attack", "Unit Ultra Super Attack"];

    if (presets.includes(currentLabelText)) {
        if (typeDropdown) typeDropdown.value = currentLabelText;
        if (customContainer) customContainer.style.display = 'none';
    } else {
        if (typeDropdown) typeDropdown.value = 'custom';
        if (customContainer) customContainer.style.display = 'block';
        if (customInput) customInput.value = currentLabelText;
    }
    
    const effectsContainer = currentSuperAttack.querySelector('.sa-display-effects-list');
    const inputSaEffects = document.getElementById('input-sa-effects');
    if (effectsContainer && inputSaEffects) {
        const cols = effectsContainer.querySelectorAll('.col');
        const textLines = Array.from(cols).map(c => c.innerText);
        inputSaEffects.value = textLines.join('\n');
    }

    const saIconOnCard = currentSuperAttack.querySelector('.sa-display-icon');
    if (saIconOnCard) {
        const currentSrc = saIconOnCard.getAttribute('src');
        const radioToSelect = document.querySelector(`input[name="sa-icon"][value="${currentSrc}"]`);
        if (radioToSelect) radioToSelect.checked = true;
    }

window.extractCleanConditionText = function(actTextEl) {
    if (!actTextEl) return "";
    let raw = (typeof actTextEl === 'string') ? actTextEl : (actTextEl.innerText || actTextEl.textContent || "");
    let cleaned = raw.replace(/^activation\s+conditions?(\(s\))?[\s:]*/i, '').trim();
    if (/^activation\s+conditions?(\(s\))?$/i.test(cleaned)) {
        return "";
    }
    return cleaned;
};

    const actText = currentSuperAttack.querySelector('.activation-text');
    const inputAct = document.getElementById('input-activation');
    if (actText && inputAct) {
        inputAct.value = window.extractCleanConditionText(actText);
    }

    const actRow = currentSuperAttack.querySelector('.activation-row');
    const sidebarContainer = document.getElementById('activation-sidebar-container');
    if (sidebarContainer && actRow) {
        sidebarContainer.style.display = actRow.classList.contains('d-none') ? 'none' : 'block';
    }
    window.refreshStatSidebar();
    isSwitching = false;
};

window.syncSuperAttack = function() {
    if (!currentSuperAttack || (typeof isSwitching !== 'undefined' && isSwitching)) return;
    
    const typeDropdown = document.getElementById('sa-type-dropdown');
    const customInput = document.getElementById('input-sa-type-label');
    const labelValue = (typeDropdown && typeDropdown.value === 'custom' && customInput) ? customInput.value : (typeDropdown ? typeDropdown.value : 'Super Attack');
    
    const nameInput = document.getElementById('input-sa-name');
    let name = nameInput ? nameInput.value.trim() : "Super Attack";
    
    if (typeof currentAwakeningMode !== 'undefined' && currentAwakeningMode !== 'none') {
        if (!name.toLowerCase().endsWith('(extreme)')) {
            name += " (Extreme)";
        }
    }
    
    const nameDisp = currentSuperAttack.querySelector('.sa-display-name');
    if(nameDisp) nameDisp.textContent = name;
    
    const typeLabel = currentSuperAttack.querySelector('.sa-type-label');
    if(typeLabel) typeLabel.textContent = labelValue;

    const effectsInput = document.getElementById('input-sa-effects');
    const effectsContainer = currentSuperAttack.querySelector('.sa-display-effects-list');
    if (effectsInput && effectsContainer) {
        const lines = effectsInput.value.split('\n'); 
        let htmlBuffer = "";
        lines.forEach(line => {
            if (line.trim() !== "") htmlBuffer += `<div class="row"><div class="col">${line}</div></div>`;
        });
        effectsContainer.innerHTML = htmlBuffer;
    }

    const selectedIconRadio = document.querySelector('input[name="sa-icon"]:checked');
    const saIconOnCard = currentSuperAttack.querySelector('.sa-display-icon');
    if (selectedIconRadio && saIconOnCard) saIconOnCard.src = selectedIconRadio.value;
    
    const sel = document.getElementById('sa-selector');
    if (sel && sel.options[sel.selectedIndex]) {
        sel.options[sel.selectedIndex].text = `${parseInt(sel.value) + 1}: ${name}`;
    }

    if (window.updateAbsStyleSuperAttacks) window.updateAbsStyleSuperAttacks();
};

/* ----- SA STATS EDITOR ----- */
window.refreshStatSidebar = function() {
    const list = document.getElementById("statList");
    if(!list || !currentSuperAttack) return;
    list.innerHTML = "";
    const localStats = currentSuperAttack.querySelectorAll(".sa-stat-row");
    localStats.forEach(statEl => {
        const text = statEl.querySelector(".display-text")?.textContent || "Stat";
        const item = document.createElement("div");
        item.className = "form-list-item";
        item.innerHTML = `<span class="form-list-name">${text}</span>`;
        item.onclick = () => window.selectStat(statEl, item);
        list.appendChild(item);
    });

    selectedStat = null; selectedListItem = null;
    const input = document.getElementById("statValueInput");
    if (input) input.value = "";

    if (window.updateAbsStyleSuperAttacks) window.updateAbsStyleSuperAttacks();
};

window.selectStat = function(statEl, listItemEl) {
    selectedStat = statEl; selectedListItem = listItemEl;
    document.querySelectorAll("#statList .active").forEach(i => i.classList.remove("active"));
    listItemEl.classList.add("active");

    currentSuperAttack.querySelectorAll(".sa-stat-row").forEach(s => s.classList.remove("selected-form"));
    statEl.classList.add("selected-form");

    const input = document.getElementById("statValueInput");
    if(input) {
        const rawText = statEl.querySelector(".display-text")?.textContent || "0%";
        input.value = rawText.replace('%', ''); 
    }
    
    const imgSrc = statEl.querySelector(".display-img")?.getAttribute("src");
    document.querySelectorAll(".sa-icon-option").forEach(icon => {
        icon.classList.toggle("selected-icon-highlight", icon.getAttribute("src") === imgSrc);
    });
};

const saActInput = document.getElementById('input-activation');
if (saActInput) {
    saActInput.oninput = function() {
        if (!currentSuperAttack) return;
        const actTextDisp = currentSuperAttack.querySelector('.activation-text');
        if (actTextDisp) {
            const cleanVal = (typeof window.extractCleanConditionText === 'function')
                ? window.extractCleanConditionText(this.value)
                : this.value.trim().replace(/^activation\s+conditions?(\(s\))?[\s:]*/i, '').trim();
            
            if (cleanVal === "") {
                actTextDisp.innerHTML = `<strong>Activation Condition</strong>`;
            } else {
                actTextDisp.innerHTML = `<strong>Activation Condition</strong><br>${cleanVal.replace(/\n/g, '<br>')}`;
            }
        }
        if (window.updateAbsStyleSuperAttacks) window.updateAbsStyleSuperAttacks();
        if (window.syncToAbsLayout) window.syncToAbsLayout();
    };
}


