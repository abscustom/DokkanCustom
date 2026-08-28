/* ============================================================
   3. UI SYNCING & MANAGER FUNCTIONS
   ============================================================ */
window.updateCardDisplay = function() {
    window.updateIconImages();
    if (window.syncToAbsLayout) {
        window.syncToAbsLayout();
    }
};

window.applyCardTheme = function(newSuffix) {
    currentType = newSuffix;
    const typeSuffixes = ['agl', 'teq', 'int', 'str', 'phy', 'none'];
    typeSuffixes.forEach(suf => {
        document.querySelectorAll(`.bg-${suf}`).forEach(el => el.classList.replace(`bg-${suf}`, `bg-${newSuffix}`));
        document.querySelectorAll(`.bg-${suf}-2`).forEach(el => el.classList.replace(`bg-${suf}-2`, `bg-${newSuffix}-2`));
        document.querySelectorAll(`.border-${suf}`).forEach(el => el.classList.replace(`border-${suf}`, `border-${newSuffix}`));
    });

    const themeColors = { 
        agl: { main: '#1d4ed8', border: '#3b82f6', header: '#1e40af', bgHigh: '#132448', bgLow: '#080e1c', text: '#38bdf8', glow: 'rgba(56, 189, 248, 0.45)' }, 
        teq: { main: '#15803d', border: '#22c55e', header: '#166534', bgHigh: '#0e341f', bgLow: '#06160d', text: '#4ade80', glow: 'rgba(74, 222, 128, 0.45)' }, 
        int: { main: '#7e22ce', border: '#a855f7', header: '#6b21a8', bgHigh: '#321654', bgLow: '#150924', text: '#c084fc', glow: 'rgba(192, 132, 252, 0.45)' }, 
        str: { main: '#b91c1c', border: '#ef4444', header: '#991b1b', bgHigh: '#441616', bgLow: '#1c0909', text: '#f87171', glow: 'rgba(248, 113, 113, 0.45)' }, 
        phy: { main: '#ca8a04', border: '#eab308', header: '#a16207', bgHigh: '#3c290f', bgLow: '#181005', text: '#fde047', glow: 'rgba(234, 179, 8, 0.45)' }, 
        none: { main: '#3f3f46', border: '#71717a', header: '#27272a', bgHigh: '#1f2533', bgLow: '#0d1017', text: '#38bdf8', glow: 'rgba(56, 189, 248, 0.35)' } 
    };

    const colors = themeColors[newSuffix] || themeColors.none;
    const targets = [document.documentElement, document.body, document.getElementById('layout-abs-style')];
    
    targets.forEach(el => {
        if (!el) return;
        el.style.setProperty('--theme-main', colors.main);
        el.style.setProperty('--theme-border', colors.border);
        el.style.setProperty('--theme-header', colors.header);
        el.style.setProperty('--theme-bg-high', colors.bgHigh);
        el.style.setProperty('--theme-bg-low', colors.bgLow);
        el.style.setProperty('--theme-text', colors.text);
        el.style.setProperty('--theme-glow', colors.glow);

        el.style.setProperty('--type-main', colors.main);
        el.style.setProperty('--type-border', colors.border);
        el.style.setProperty('--type-header', colors.header);
        el.style.setProperty('--type-text', colors.text);
        el.style.setProperty('--type-glow', colors.glow);
        el.style.setProperty('--type-bg', colors.bgHigh);
        el.style.setProperty('--type-dark-bg', colors.bgLow);
    });

    document.querySelectorAll('.lightning-overlay').forEach(lightning => {
        lightning.style.setProperty('--lightning-color', lightningColors[newSuffix]);
    });

    window.updateIconImages();
    window.calcFromMin('hp');
    window.calcFromMin('atk');
    window.calcFromMin('def');
};

window.updateIconImages = function() {
    const mainTypeIcon = document.querySelector('.card-icon-item-type .typing-icon');
    if (mainTypeIcon) mainTypeIcon.src = typeImageMap[currentClass][currentType];

    document.querySelectorAll('#tur-row .typing-icon').forEach(img => {
        img.src = typeImageMap[currentClass][currentType];
    });

    document.querySelectorAll('#ssr-row .typing-icon').forEach(img => {
        img.src = typeImageUrls[currentType];
    });

    document.querySelectorAll(".card-frame").forEach(f => f.src = frameMap[currentType]);

    if (window.syncToAbsLayout) {
        window.syncToAbsLayout();
    }
};

window.updateRarityStats = function(rarityName) {
    currentRarity = rarityName;
    window.currentRarity = rarityName;

    const mainIcon = document.getElementById('main-rarity-icon');
    const ssrIcon = document.getElementById('ssr-rarity-icon');
    const turIcon = document.getElementById('tur-rarity-icon');

    if (mainIcon) mainIcon.src = `https://abscustom.github.io/assets/images/rarity_${rarityName}.png`;
    
    if (rarityName === "none") {
        if (ssrIcon) ssrIcon.src = "https://abscustom.github.io/assets/images/rarity_none.png";
        if (turIcon) turIcon.src = "https://abscustom.github.io/assets/images/rarity_none.png";
    } else {
        if (ssrIcon) ssrIcon.src = "https://abscustom.github.io/assets/images/rarity_ssr.png";
        if (turIcon) turIcon.src = "https://abscustom.github.io/assets/images/rarity_TUR.png";
    }

    const lightning = document.querySelector('.lightning-overlay');
    const spinDial = document.querySelector('.lr-spin-dial');
    const turRow = document.getElementById('tur-row');
    const ssrRow = document.getElementById('ssr-row');
    const awkWrapper = document.getElementById('awakening-progression-wrapper');

    const ssrSrc = document.getElementById('img-ssr')?.getAttribute('src') || document.getElementById('img-ssr')?.src || "";
    const turSrc = document.getElementById('img-tur')?.getAttribute('src') || document.getElementById('img-tur')?.src || "";
    const hasCustomSsr = ssrSrc && !ssrSrc.endsWith('SSR_Icon.png') && !ssrSrc.endsWith('none.png') && !ssrSrc.endsWith('default.png') && !ssrSrc.endsWith('editor.html');
    const hasCustomTur = turSrc && !turSrc.endsWith('TUR_Icon.png') && !turSrc.endsWith('none.png') && !turSrc.endsWith('default.png') && !turSrc.endsWith('editor.html');

    const hasAwakeningProgression = rarityName !== 'none' && rarityName !== 'SSR' && (hasCustomSsr || hasCustomTur || (rarityName === 'LR' && (hasCustomSsr || hasCustomTur)));

    if (rarityName === "LR") {
        if(lightning) lightning.style.display = 'block';
        if(spinDial) spinDial.style.display = 'block';
        document.querySelectorAll('.sa-20-bonus').forEach(el => el.style.display = 'block');
    } else {
        if(lightning) lightning.style.display = 'none';
        if(spinDial) spinDial.style.display = 'none';
        document.querySelectorAll('.sa-20-bonus').forEach(el => el.style.display = 'none');
    }

    if (!hasAwakeningProgression || rarityName === 'none' || rarityName === 'SSR') {
        if (awkWrapper) awkWrapper.style.display = 'none';
    } else {
        if (awkWrapper) awkWrapper.style.display = 'flex';
        if (rarityName === "LR") {
            if (ssrRow && ssrRow.closest('.col')) ssrRow.closest('.col').style.display = 'block';
            if (turRow) turRow.style.display = 'block';
        } else if (rarityName === "TUR") {
            if (ssrRow && ssrRow.closest('.col')) ssrRow.closest('.col').style.display = 'block';
            if (turRow) turRow.style.display = 'none';
        }
    }
    
    const stats = rarityStats[rarityName];
    if (stats) {
        document.getElementById("max-lv").textContent = stats.max;
        document.getElementById("sa-lv").textContent = stats.sa;
        document.getElementById("cost").textContent = stats.cost;
    }

    if (window.syncToAbsLayout) {
        window.syncToAbsLayout();
    }
};

window.applyLeaderPreset = function(type) {
    const leaderInput = document.getElementById("leaderInput");
    if (!leaderInput) return;
    let presetText = "";
    switch(type) {
        case 'dfe': presetText = '"Category 1", "Category 2" or "Category 3" Category Ki +3, HP +200% and ATK & DEF +170%, plus an additional HP, ATK & DEF +50% for characters who also belong to the "Category 4" or "Category 5" Category'; break;
        case 'carnival': presetText = '"Category 1" Category Ki +4 and HP, ATK & DEF +220%'; break;
        case 'lr': presetText = '"Category 1" or "Category 2" Category Ki +3 and HP, ATK & DEF +200%'; break;
    }
    leaderInput.value = presetText;
    window.updateIdentity();
};

/* ============================================================
   SMART SUPER ATTACK STAT DETECTOR (WORKS IN SIDEBAR & GUI)
   ============================================================ */
window.autoGenerateSAIcons = function(targetBlock = null) {
    const blocks = targetBlock ? [targetBlock] : (currentSuperAttack ? [currentSuperAttack] : document.querySelectorAll('.sa-block'));
    if (!blocks || blocks.length === 0) return;

    blocks.forEach(saBlock => {
        const effectsEl = saBlock.querySelector('.sa-display-effects-list');
        const guiText = document.getElementById("gui-sa-effects")?.value;
        const sidebarText = document.getElementById("input-sa-effects")?.value;
        const text = (saBlock === currentSuperAttack && (guiText || sidebarText)) ? (guiText || sidebarText) : (effectsEl ? effectsEl.innerText : "");
        
        const nameEl = saBlock.querySelector('.sa-display-name');
        const saName = nameEl ? nameEl.innerText : "";
        const container = saBlock.querySelector('.stats-container');
        if (!container) return;

        container.innerHTML = "";
        const stats = (typeof window.autoDetectSAStats === 'function') ? window.autoDetectSAStats(text, saName) : [];
        let htmlBuffer = "";
        stats.forEach(st => {
            const valStr = st.value ? `${st.value}%` : '';
            htmlBuffer += `<div class="col sa-stat-row" data-target="${st.target || 'self'}" data-turns="${st.turns || '1 turn'}"><img class="display-img" width="50" src="${st.icon}"><span class="display-text ms-1">${valStr}</span></div>`;
        });
        container.innerHTML = htmlBuffer;
    });

    if (window.refreshStatSidebar) window.refreshStatSidebar();
    if (window.updateAbsStyleSuperAttacks) window.updateAbsStyleSuperAttacks();
    if (window.syncToAbsLayout) window.syncToAbsLayout();
};

window.formatCategoryQuotes = function(text) {
    if (!text) return "";
    if (typeof text !== 'string') return text;
    // If the text contains HTML tags, only replace quotes in text portions outside of <...>
    if (text.includes('<') && text.includes('>')) {
        const parts = text.split(/(<[^>]+>)/g);
        for (let i = 0; i < parts.length; i += 2) {
            if (parts[i]) {
                parts[i] = parts[i].replace(/["“”]([^"”]+)["”]/g, '<span class="abs-category-quote">"$1"</span>');
            }
        }
        return parts.join('');
    }
    return text.replace(/["“”]([^"”]+)["”]/g, '<span class="abs-category-quote">"$1"</span>');
};
window.formatLeaderSkillQuotes = window.formatCategoryQuotes;

window.updateIdentity = function() {
    const descEl = document.getElementById("descInput");
    const nameEl = document.getElementById("nameInput");
    const leaderEl = document.getElementById("leaderInput");

    const rawDesc = descEl ? descEl.value : (document.getElementById("char-description")?.textContent || "");
    const name = nameEl ? nameEl.value : (document.getElementById("char-name")?.textContent || "");
    const leaderRaw = leaderEl ? leaderEl.value : (document.getElementById("leader-skill")?.innerText || "");

    const cleanTitle = rawDesc.replace(/[\[\]]/g, '').trim();
    const descDisplay = document.getElementById("char-description");
    if (descDisplay) descDisplay.textContent = cleanTitle;

    const nameDisplay = document.getElementById("char-name");
    if (nameDisplay) nameDisplay.textContent = name;

    const leaderDisplay = document.getElementById("leader-skill");
    if (leaderDisplay) leaderDisplay.innerHTML = leaderRaw.replace(/\n/g, '<br>');

    // ABS Sync
    const dbDesc = document.getElementById("abs-char-title");
    if (dbDesc) dbDesc.textContent = cleanTitle;

    const dbName = document.getElementById("abs-char-name");
    if (dbName) dbName.textContent = name;

    const dbLeader = document.getElementById("abs-leader-skill");
    if (dbLeader) dbLeader.innerHTML = window.formatCategoryQuotes(leaderRaw).replace(/\n/g, '<br>');

    const container = document.getElementById("release-dates-container");
    const dateEl = document.getElementById("dateInput");
    const ezaDateEl = document.getElementById("ezaDateInput");
    const sezaDateEl = document.getElementById("sezaDateInput");

    let baseDate = (dateEl ? dateEl.value.trim() : "") || "TBD";
    let ezaDate = (ezaDateEl ? ezaDateEl.value.trim() : "") || "TBD";
    let sezaDate = (sezaDateEl ? sezaDateEl.value.trim() : "") || "TBD";

    let html = `
    <div class="row border border-2 border-dark margin-top-bottom-5 border-${currentType} bg-${currentType} dokkan-card">
        <div class="col p-0">
            <div class="row padding-top-bottom-5 bg-${currentType} m-0">
                <div class="col text-center"><b>Release Date</b></div>
            </div>
            <div class="row padding-top-bottom-5 bg-${currentType}-2 m-0">
                <div class="col text-center">${baseDate}</div>
            </div>`;

    if (currentAwakeningMode === 'eza' || currentAwakeningMode === 'seza') {
        html += `
            <div class="row padding-top-bottom-5 bg-${currentType} m-0">
                <div class="col text-center"><b>EZA Release Date</b></div>
            </div>
            <div class="row padding-top-bottom-5 bg-${currentType}-2 m-0">
                <div class="col text-center">${ezaDate}</div>
            </div>`;
    }

    if (currentAwakeningMode === 'seza') {
        html += `
            <div class="row padding-top-bottom-5 bg-${currentType} m-0">
                <div class="col text-center"><b>SEZA Release Date</b></div>
            </div>
            <div class="row padding-top-bottom-5 bg-${currentType}-2 m-0">
                <div class="col text-center">${sezaDate}</div>
            </div>`;
    }

    html += `</div></div>`;
    if (container) container.innerHTML = html;

    if (window.syncToAbsLayout) window.syncToAbsLayout();
};
