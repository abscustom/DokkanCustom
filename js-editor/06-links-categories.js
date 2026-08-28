
/* ============================================================
   CATEGORY AND LINK SKILL ENGINE (NO AUTO-DELETE ON CLICK)
   ============================================================ */
window.addLinkSkill = function() {
    const input = document.getElementById('side-link-input');
    const linkName = input.value.trim();
    if (linkName === "") return;

    // NO inline onclick="this.remove()" - WILL NEVER AUTO-DELETE
    const html = `<a class="col-4 border border-1 border-${currentType} padding-top-bottom-10 text-center">${linkName}</a>`;
    document.getElementById('card-link-container').insertAdjacentHTML('beforeend', html);

    if (window.currentCardThemeStyle === 'abs-style') {
        window.syncToAbsLayout();
    }
    if (window.refreshEditorLinkingPartners) window.refreshEditorLinkingPartners();
    input.value = ""; 
    input.focus();
};

window.refreshEditorLinkingPartners = function() {
    const partnersBox = document.getElementById('abs-partners-box');
    const partnersContainer = document.getElementById('abs-partners-container');
    if (!partnersBox || !partnersContainer) return;

    const links = Array.from(document.querySelectorAll('#card-link-container a'))
        .map(link => link.textContent.trim())
        .filter(Boolean);

    if (!links.length || !window.DB || !Array.isArray(window.DB.cards) || typeof renderLinkingPartners !== 'function') {
        partnersBox.style.display = 'none';
        partnersContainer.innerHTML = '';
        return;
    }

    const importedId = Number(window.editorPartnerCardId || document.getElementById('upload-folder-id')?.value);
    renderLinkingPartners({
        id: Number.isFinite(importedId) && importedId > 0 ? importedId : 999999999,
        name: document.getElementById('nameInput')?.value || 'Custom Character',
        rarity: window.currentRarity === 'SSR' ? 3 : 4,
        links,
        release_date: document.getElementById('dateInput')?.value || ''
    });
};

window.addCategory = function() {
    const input = document.getElementById('side-category-input');
    const val = input.value.trim();
    const option = Array.from(document.getElementById('category-options').options).find(opt => opt.value === val);
    if (!option) { alert("Please select a category from the dropdown list."); return; }
    const catId = option.getAttribute('data-id');
    
    // NO inline onclick="this.remove()" - WILL NEVER AUTO-DELETE
    const html = `<div class="col-4 d-flex justify-content-center padding-top-bottom-5 editor-category-item" data-category-name="${val}"><img src="https://abscustom.github.io/assets/images/card_category_label_${catId}_b_on.png" style="width:210px;" alt="${val}" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-flex';"><span class="category-name-fallback" style="display:none;">${val}</span></div>`;
    document.getElementById('card-category-container').insertAdjacentHTML('beforeend', html);
    
    if (window.currentCardThemeStyle === 'abs-style') {
        window.syncToAbsLayout();
    }
    input.value = ""; 
    input.focus();
};

// --- GLOBAL KEYWORD PARSER ---
window.parseDokkanKeywords = function(text) {
    if (!text) return "";
    const iconMapping = {
        ':up:': 'https://abscustom.github.io/assets/images/passive_skill_dialog_arrow01.png',
        ':down:': 'https://abscustom.github.io/assets/images/passive_skill_dialog_arrow02.png',
        ':ydown:': 'https://abscustom.github.io/assets/images/passive_skill_dialog_arrow03.png',
        ':once:': 'https://abscustom.github.io/assets/images/passive_skill_dialog_icon_01.png',
        ':inf:': 'https://abscustom.github.io/assets/images/passive_skill_dialog_icon_02.png'
    };
    let parsed = text;
    for (const [key, path] of Object.entries(iconMapping)) {
        const imgTag = `<img src="${path}" style="height:15px; vertical-align:middle; margin: 0 2px;">`;
        parsed = parsed.replace(new RegExp(key, 'g'), imgTag);
    }
    return parsed;
};


