
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

    input.value = ""; 
    input.focus();
};

window.addCategory = function() {
    const input = document.getElementById('side-category-input');
    const val = input.value.trim();
    const option = Array.from(document.getElementById('category-options').options).find(opt => opt.value === val);
    if (!option) { alert("Please select a category from the dropdown list."); return; }
    const catId = option.getAttribute('data-id');
    
    // NO inline onclick="this.remove()" - WILL NEVER AUTO-DELETE
    const html = `<div class="col-4 d-flex justify-content-center padding-top-bottom-5"><img src="images/card_category_label_${catId}_b_on.png" style="width:210px;"></div>`;
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
        ':up:': './images/passive_skill_dialog_arrow01.png',
        ':down:': './images/passive_skill_dialog_arrow02.png',
        ':ydown:': './images/passive_skill_dialog_arrow03.png',
        ':once:': './images/passive_skill_dialog_icon_01.png',
        ':inf:': './images/passive_skill_dialog_icon_02.png'
    };
    let parsed = text;
    for (const [key, path] of Object.entries(iconMapping)) {
        const imgTag = `<img src="${path}" style="height:15px; vertical-align:middle; margin: 0 2px;">`;
        parsed = parsed.replace(new RegExp(key, 'g'), imgTag);
    }
    return parsed;
};

