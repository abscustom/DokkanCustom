/* ============================================================
   THEME MANAGER & ABS LAYOUT SYNCHRONIZER
   ============================================================ */

window.toggleCardTheme = function(isDbTheme) {
    const appEl = document.getElementById('app');
    const layoutInfo = document.getElementById('layout-dokkaninfo');
    const layoutDb = document.getElementById('layout-abs-style');
    
    const btnInfo = document.getElementById('theme-btn-info');
    const btnDb = document.getElementById('theme-btn-abs');
    
    window.currentCardThemeStyle = isDbTheme ? 'abs-style' : 'dokkaninfo';
    localStorage.setItem('dokkan_selected_theme', window.currentCardThemeStyle); 
    window.updateSiteFavicon?.(window.currentCardThemeStyle);

    if (isDbTheme && window.syncToAbsLayout) {
        window.syncToAbsLayout();
    }

    if (layoutInfo && layoutDb) {
        if (isDbTheme) {
            layoutInfo.style.display = 'none';
            layoutDb.style.display = 'block';
        } else {
            layoutDb.style.display = 'none';
            layoutInfo.style.display = 'block';
        }
    }
    
    if (isDbTheme) {
        if (appEl) {
            appEl.classList.add('theme-abs-style');
            appEl.classList.remove('theme-dokkaninfo');
        }
        document.body.classList.add('theme-abs-style');
        document.body.classList.remove('theme-dokkaninfo');

        if (btnInfo) btnInfo.classList.remove('active');
        if (btnDb) btnDb.classList.add('active');
    } else {
        if (appEl) {
            appEl.classList.remove('theme-abs-style');
            appEl.classList.add('theme-dokkaninfo');
        }
        document.body.classList.remove('theme-abs-style');
        document.body.classList.add('theme-dokkaninfo');

        if (btnInfo) btnInfo.classList.add('active');
        if (btnDb) btnDb.classList.remove('active');
    }
};

window.switchCardTheme = function(themeName) {
    const isDbTheme = (themeName === 'abs-style');
    window.toggleCardTheme(isDbTheme);
};

window.restoreThemeOnLoad = function() {
    if (window.IS_PUBLISHED && window.currentCardThemeStyle) {
        window.toggleCardTheme(window.currentCardThemeStyle === 'abs-style');
    }
};

// Auto-detect in-game ability strip from passive text (matching Card Viewer 1:1)
function detectPassiveIconsFromText(text) {
    if (!text) return [];
    const t = text.toLowerCase();
    const detected = new Map();

    const registerIcon = (filename, tooltip) => {
        if (!detected.has(filename)) {
            detected.set(filename, { src: `https://abscustom.github.io/assets/images/${filename}`, tooltip: tooltip });
        }
    };

    if (/reversible\s+exchange/i.test(t) || /can\s+switch\s+back/i.test(t) || /exchange\s+with/i.test(t) || /reversible/i.test(t)) {
        registerIcon('st_reversible.png', 'Reversible Exchange');
    }
    if (/transforms?\s+(starting|when|into|upon|after)/i.test(t) || /\btransforms\b/i.test(t) || /transfers?\s+to\s+another/i.test(t) || /switches?\s+(with|to)/i.test(t) || /can\s+switch\s+to/i.test(t)) {
        registerIcon('st_change_form.png', 'Transformation');
    }
    if (/giant\s+form/i.test(t) || /rage\s+(mode|form)/i.test(t) || /turns?\s+into\s+a\s+giant/i.test(t) || /great\s+ape/i.test(t)) {
        registerIcon('st_giant_form_rage.png', 'Giant Form / Rage');
    }
    if (/reviv(e|al|ed|es)/i.test(t) || /when\s+hp\s+is\s+0/i.test(t) || /revived\s+by\s+the\s+power/i.test(t) || /activates?\s+revival/i.test(t)) {
        registerIcon('st_revive.png', 'Revival Skill');
    }
    if (/survives?\s+(a\s+)?k\.?o\.?/i.test(t) || /fatal\s+damage/i.test(t) || /survives?\s+fatal/i.test(t)) {
        registerIcon('st_invalid_ko.png', 'Survives Fatal KO Attack');
    }
    if (/nullif(y|ies)\s+all\s+(negative|abnormal)/i.test(t) || /immune\s+to\s+negative/i.test(t)) {
        registerIcon('nullifies_negative_effects.png', 'Nullifies Negative Effects');
    }
    if (/atk\s*(&\s*def)?\s*(\+?\s*\d+%|up\s+to)/i.test(t) || 
        /(raises?|boosts?)\s+(own\s+)?atk/i.test(t) || 
        /atk\s*\+\d+%/i.test(t) ||
        /\batk\s+\d+%/i.test(t) ||
        (/atk\s*&/i.test(t) && /\d+%/i.test(t))) {
        registerIcon('st_0001.png', 'ATK Boost');
    }
    if (/def\s*(&\s*atk)?\s*(\+?\s*\d+%|up\s+to)/i.test(t) || 
        /(raises?|boosts?)\s+(own\s+)?def/i.test(t) || 
        /def\s*\+\d+%/i.test(t) ||
        /\bdef\s+\d+%/i.test(t) ||
        (/&\s*def/i.test(t) && /\d+%/i.test(t))) {
        registerIcon('st_0002.png', 'DEF Boost');
    }
    if (/ki\s*\+\s*\d+(?!\s+per)/i.test(t) || /plus\s+ki\s*\+\d+/i.test(t) || /ki\s*meter/i.test(t) || /\bki\s*\+\d+\b/i.test(t)) {
        registerIcon('st_0003.png', 'Ki Boost');
    }
    if (/additional\s+(attack|super)/i.test(t) || 
        /launches?\s+.*?\s+additional/i.test(t) || 
        /attacks?\s+twice/i.test(t) || 
        /attacks?\s+become\s+a\s+super/i.test(t)) {
        registerIcon('st_atk_combo.png', 'Additional Attack');
    }
    if (/critical/i.test(t)) {
        registerIcon('st_critical_up.png', 'Critical Hit');
    }
    if (/effective\s+against\s+all\s+types/i.test(t)) {
        registerIcon('st_atk_super.png', 'Effective Against All Types');
    }
    if (/guaranteed\s+to\s+hit/i.test(t) || /attacks?\s+cannot\s+be\s+evaded/i.test(t) || /attacks?\s+cannot\s+be\s+dodged/i.test(t)) {
        registerIcon('st_always_hit.png', 'Attacks Guaranteed to Hit');
    }
    if (/interrupts?\s+(the\s+)?attacked\s+enemy/i.test(t) || 
        /disables?\s+enemy'?s?\s+action/i.test(t) || 
        /action\s+break/i.test(t) || 
        /:break:/i.test(t)) {
        registerIcon('st_1009.png', 'Action Break / Interrupts Enemy');
    }
    if (/guard\s+against\s+all\s+types/i.test(t) || /guards?\s+all\s+attacks/i.test(t) || /guard\s+is\s+activated/i.test(t) || /active\s+guard/i.test(t) || /guard/i.test(t)) {
        registerIcon('st_sp_guard.png', 'Guard Against All Attacks');
    }
    if (/damage\s+reduction/i.test(t) || /reduces?\s+damage/i.test(t) || /damage\s+received/i.test(t)) {
        registerIcon('st_resist_damage_up.png', 'Damage Reduction');
    }
    if (/evad(e|ing|es|ion)/i.test(t) || /dodg(e|ing|es)/i.test(t)) {
        registerIcon('st_evasion.png', 'High Evasion / Dodge');
    }
    if (/disables?\s+(enemy'?s?\s+)?guard/i.test(t) || /guard\s+disabled/i.test(t)) {
        registerIcon('st_disable_guard.png', 'Disables Enemy Guard');
    }
    if (/changes?\s+.*?(ki\s+spheres?|spheres?|balls?)/i.test(t) || /rainbow\s+ki\s+spheres?/i.test(t)) {
        registerIcon('ki_change_rainbow.png', 'Ki Sphere Changer');
    }
    if (/(receives?\s+an?\s+additional\s+ki|plus\s+an?\s+additional\s+ki|additional\s+ki\s*\+\d+|ki\s*\+\d+)\s+per\s+.*?(ki\s+sphere|sphere)/i.test(t) ||
        /plus\s+ki\s*\+\d+\s+per\s+.*?\s+obtained/i.test(t)) {
        registerIcon('additional_ki_obtained.png', 'Additional Ki Per Ki Sphere Obtained');
    }
    if (/recovers?\s+(\d+%\s*hp|\d+%\s*of\s+damage|hp)/i.test(t) || /hp\s+recovery/i.test(t) || /recovers?\s+hp/i.test(t)) {
        registerIcon('st_recover.png', 'HP Recovery');
    }
    if (/sacrific(e|es|ing)\s+(\d+%\s*hp|hp)/i.test(t)) {
        registerIcon('st_recover_minus.png', 'HP Sacrifice');
    }
    if (/(all\s+)?enemies'?\s+atk/i.test(t) || 
        /enemy'?s?\s+atk\s*(&\s*def)?\s*(\d+%\s*|\b(down|lower|decrease))/i.test(t) || 
        /attacked\s+enemy'?s?\s+atk/i.test(t) ||
        /lowers?\s+(the\s+)?(all\s+|attacked\s+)?enemies'?\s+atk/i.test(t) ||
        /lowers?\s+(the\s+)?(all\s+|attacked\s+)?enemy'?s?\s+atk/i.test(t) ||
        /atk\s*(-?\d+%\s*)?(:down:|:ydown:)/i.test(t) ||
        /:atk_down:/i.test(t) ||
        /:ydown:/i.test(t)) {
        registerIcon('st_0011.png', 'Lowers Enemy ATK');
    }
    if (/(all\s+)?enemies'?\s+(atk\s*&\s*)?def/i.test(t) || 
        /enemy'?s?\s+def\s*(&\s*atk)?\s*(\d+%\s*|\b(down|lower|decrease))/i.test(t) || 
        /attacked\s+enemy'?s?\s+(atk\s*&\s*)?def/i.test(t) ||
        /lowers?\s+(the\s+)?(all\s+|attacked\s+)?enemies'?\s+def/i.test(t) ||
        /lowers?\s+(the\s+)?(all\s+|attacked\s+)?enemy'?s?\s+def/i.test(t) ||
        /def\s*(-?\d+%\s*)?(:down:|:ydown:)/i.test(t) ||
        /:def_down:/i.test(t)) {
        registerIcon('st_0012.png', 'Lowers Enemy DEF');
    }
    if (/stun(s|ing)?/i.test(t) || /:stun:/i.test(t)) {
        registerIcon('st_0100.png', 'Stuns Enemy');
    }
    if (/seal(s|ing)?\s+(the\s+)?(attacked\s+)?enemy/i.test(t) || /seals?\s+super\s+attack/i.test(t) || /:seal:/i.test(t)) {
        registerIcon('st_0102.png', 'Seals Enemy Super Attack');
    }
    if (/directs?\s+(all\s+)?enemy'?s?\s+attacks/i.test(t) || /taunt/i.test(t) || /target\s+skill/i.test(t)) {
        registerIcon('st_target.png', 'Directs Enemy Attacks (Taunt)');
    }
    if (/unarmed\s+super\s+attack/i.test(t) || /melee\s+super\s+attack/i.test(t) || /physical\s+super\s+attack/i.test(t) || /(nullif(y|ies)|counter)\s+(unarmed|melee|physical)/i.test(t) || /(nullif(y|ies)|counter)\s+(enemy'?s?\s+)?super/i.test(t)) {
        registerIcon('st_invalid_blow_special.png', 'Counter / Nullify Melee Super');
    }
    if (/ki\s+blast\s+super\s+attack/i.test(t) || /energy\s+super\s+attack/i.test(t) || /(nullif(y|ies)|absorb(s|ing)?)\s+ki\s+blast/i.test(t) || /counter\s+ki\s+blast/i.test(t)) {
        registerIcon('st_invalid_energy_special.png', 'Nullify / Absorb Energy Super');
    }
    if (/counters?\s+with/i.test(t) || /counters?\s+normal\s+attacks?/i.test(t) || /counter\s+attack/i.test(t)) {
        registerIcon('st_counter.png', 'Counter Attack');
    }

    const priorityOrder = [
        'st_reversible.png',
        'st_change_form.png',
        'st_giant_form_rage.png',
        'st_revive.png',
        'st_invalid_ko.png',
        'nullifies_negative_effects.png',
        'st_0001.png',
        'st_0002.png',
        'st_0003.png',
        'additional_ki_obtained.png',
        'st_atk_combo.png',
        'st_critical_up.png',
        'st_atk_super.png',
        'st_always_hit.png',
        'st_1009.png',
        'st_sp_guard.png',
        'st_resist_damage_up.png',
        'st_evasion.png',
        'st_disable_guard.png',
        'ki_change_rainbow.png',
        'st_recover.png',
        'st_recover_minus.png',
        'st_0011.png',
        'st_0012.png',
        'st_0100.png',
        'st_0102.png',
        'st_target.png',
        'st_counter.png',
        'st_invalid_blow_special.png',
        'st_invalid_energy_special.png'
    ];

    const sortedIcons = [];
    priorityOrder.forEach(file => {
        if (detected.has(file)) {
            sortedIcons.push(detected.get(file));
        }
    });

    return sortedIcons;
}

window.passiveHeaderIconsOverride = null;

window.ALL_PASSIVE_HEADER_ICONS = [
    { file: 'st_reversible.png', tooltip: 'Reversible Exchange' },
    { file: 'st_change_form.png', tooltip: 'Transformation' },
    { file: 'st_giant_form_rage.png', tooltip: 'Giant Form / Rage' },
    { file: 'st_revive.png', tooltip: 'Revival Skill' },
    { file: 'st_invalid_ko.png', tooltip: 'Survives KO' },
    { file: 'nullifies_negative_effects.png', tooltip: 'Nullifies Debuffs' },
    { file: 'st_0001.png', tooltip: 'ATK Boost' },
    { file: 'st_0002.png', tooltip: 'DEF Boost' },
    { file: 'st_0003.png', tooltip: 'Ki Boost' },
    { file: 'additional_ki_obtained.png', tooltip: 'Ki Per Sphere' },
    { file: 'st_atk_combo.png', tooltip: 'Additional Attack' },
    { file: 'st_critical_up.png', tooltip: 'Critical Hit' },
    { file: 'st_atk_super.png', tooltip: 'Effective All Types' },
    { file: 'st_always_hit.png', tooltip: 'Guaranteed Hit' },
    { file: 'st_1009.png', tooltip: 'Action Break' },
    { file: 'st_sp_guard.png', tooltip: 'Guard All Attacks' },
    { file: 'st_resist_damage_up.png', tooltip: 'Damage Reduction' },
    { file: 'st_evasion.png', tooltip: 'High Evasion / Dodge' },
    { file: 'st_disable_guard.png', tooltip: 'Disables Guard' },
    { file: 'ki_change_rainbow.png', tooltip: 'Rainbow Ki Changer' },
    { file: 'st_recover.png', tooltip: 'HP Recovery' },
    { file: 'st_recover_minus.png', tooltip: 'HP Sacrifice' },
    { file: 'st_0011.png', tooltip: 'Lowers Enemy ATK' },
    { file: 'st_0012.png', tooltip: 'Lowers Enemy DEF' },
    { file: 'st_0100.png', tooltip: 'Stun' },
    { file: 'st_0102.png', tooltip: 'Seal' },
    { file: 'st_target.png', tooltip: 'Target / Taunt' },
    { file: 'st_counter.png', tooltip: 'Counter Attack' },
    { file: 'st_invalid_blow_special.png', tooltip: 'Nullify Melee Super' },
    { file: 'st_invalid_energy_special.png', tooltip: 'Nullify Energy Super' }
];

window.togglePassiveBadgesCollapse = function(targetId, btnOrIcon) {
    const strip = typeof targetId === 'string' ? document.getElementById(targetId) : targetId;
    let btnEl = typeof btnOrIcon === 'string' ? document.getElementById(btnOrIcon) : btnOrIcon;
    if (!strip) return;
    
    const isHidden = strip.classList.contains('d-none') || strip.style.display === 'none';
    if (isHidden) {
        strip.classList.remove('d-none');
        strip.style.display = 'flex';
        if (btnEl) {
            if (btnEl.innerText === '►' || btnEl.innerText === '▼') btnEl.innerText = '▼';
            else btnEl.innerText = '−';
        }
    } else {
        strip.classList.add('d-none');
        strip.style.display = 'none';
        if (btnEl) {
            if (btnEl.innerText === '▼' || btnEl.innerText === '►') btnEl.innerText = '►';
            else btnEl.innerText = '+';
        }
    }
};

window.getActivePassiveHeaderIcons = function(passiveText) {
    if (Array.isArray(window.passiveHeaderIconsOverride)) {
        return window.passiveHeaderIconsOverride.map(file => {
            const found = window.ALL_PASSIVE_HEADER_ICONS.find(i => i.file === file);
            return {
                src: `https://abscustom.github.io/assets/images/${file}`,
                tooltip: found ? found.tooltip : file,
                file: file
            };
        });
    }
    return detectPassiveIconsFromText(passiveText);
};

window.togglePassiveHeaderIcon = function(filename, tooltip) {
    const mainPassiveCont = document.getElementById('card-passive-container');
    const rawPassiveText = mainPassiveCont ? mainPassiveCont.innerText : "";
    
    if (!Array.isArray(window.passiveHeaderIconsOverride)) {
        const auto = detectPassiveIconsFromText(rawPassiveText);
        window.passiveHeaderIconsOverride = auto.map(a => a.src.split('/').pop());
    }

    const idx = window.passiveHeaderIconsOverride.indexOf(filename);
    if (idx >= 0) {
        window.passiveHeaderIconsOverride.splice(idx, 1);
    } else {
        window.passiveHeaderIconsOverride.push(filename);
    }

    if (window.syncToAbsLayout) window.syncToAbsLayout();
    window.renderPassiveHeaderBadgeToggles();
};

window.resetPassiveHeaderIconsToAuto = function() {
    window.passiveHeaderIconsOverride = null;
    if (window.syncToAbsLayout) window.syncToAbsLayout();
    window.renderPassiveHeaderBadgeToggles();
};

window.renderPassiveHeaderBadgeToggles = function() {
    const mainPassiveCont = document.getElementById('card-passive-container');
    const rawPassiveText = mainPassiveCont ? mainPassiveCont.innerText : "";
    const activeList = window.getActivePassiveHeaderIcons(rawPassiveText);
    const activeFiles = new Set(activeList.map(a => a.src.split('/').pop().split('?')[0]));

    const html = window.ALL_PASSIVE_HEADER_ICONS.map(item => {
        const isActive = activeFiles.has(item.file);
        return `
            <button type="button" class="passive-badge-toggle-btn ${isActive ? 'active' : ''}" 
                    onclick="window.togglePassiveHeaderIcon('${item.file}', '${item.tooltip.replace(/'/g, "\\'")}')" 
                    title="${isActive ? 'Click to Remove: ' : 'Click to Add: '}${item.tooltip}">
                <img src="https://abscustom.github.io/assets/images/${item.file}" alt="${item.tooltip}">
                <span>${item.tooltip}</span>
            </button>
        `;
    }).join('');

    const sidebarStrip = document.getElementById('sidebar-passive-badges-toggle-strip');
    if (sidebarStrip) sidebarStrip.innerHTML = html;

    const guiStrip = document.getElementById('gui-passive-badges-toggle-strip');
    if (guiStrip) guiStrip.innerHTML = html;
};

function renderPassiveIconsStrip(passiveText) {
    const icons = window.getActivePassiveHeaderIcons ? window.getActivePassiveHeaderIcons(passiveText) : detectPassiveIconsFromText(passiveText);
    if (icons.length === 0) return "";

    const iconsHtml = icons.map(icon => `
        <div class="abs-passive-ability-badge" data-tooltip="${icon.tooltip}">
            <img src="${icon.src}" alt="${icon.tooltip}">
        </div>
    `).join('');

    return `
        <div class="abs-passive-icons-strip">
            ${iconsHtml}
        </div>
    `;
}

window.syncToAbsLayout = function() {
    try {
        const themeColors = { 
            agl: { main: '#1d4ed8', border: '#3b82f6', header: '#1e40af', bgHigh: '#132448', bgLow: '#080e1c', text: '#38bdf8', glow: 'rgba(56, 189, 248, 0.45)' }, 
            teq: { main: '#15803d', border: '#22c55e', header: '#166534', bgHigh: '#0e341f', bgLow: '#06160d', text: '#4ade80', glow: 'rgba(74, 222, 128, 0.45)' }, 
            int: { main: '#7e22ce', border: '#a855f7', header: '#6b21a8', bgHigh: '#321654', bgLow: '#150924', text: '#c084fc', glow: 'rgba(192, 132, 252, 0.45)' }, 
            str: { main: '#b91c1c', border: '#ef4444', header: '#991b1b', bgHigh: '#441616', bgLow: '#1c0909', text: '#f87171', glow: 'rgba(248, 113, 113, 0.45)' }, 
            phy: { main: '#ca8a04', border: '#eab308', header: '#a16207', bgHigh: '#3c290f', bgLow: '#181005', text: '#fde047', glow: 'rgba(234, 179, 8, 0.45)' }, 
            none: { main: '#3f3f46', border: '#71717a', header: '#27272a', bgHigh: '#1f2533', bgLow: '#0d1017', text: '#38bdf8', glow: 'rgba(56, 189, 248, 0.35)' } 
        };
        const colors = themeColors[window.currentType || currentType] || themeColors.none;
        const dbLayout = document.getElementById('layout-abs-style');
        if (dbLayout) {
            dbLayout.style.setProperty('--theme-main', colors.main);
            dbLayout.style.setProperty('--theme-border', colors.border);
            dbLayout.style.setProperty('--theme-header', colors.header);
            dbLayout.style.setProperty('--theme-bg-high', colors.bgHigh);
            dbLayout.style.setProperty('--theme-bg-low', colors.bgLow);
            dbLayout.style.setProperty('--theme-text', colors.text);
            dbLayout.style.setProperty('--theme-glow', colors.glow);
        }

        document.querySelectorAll('.lightning-overlay').forEach(lightning => {
            lightning.style.setProperty('--lightning-color', lightningColors[window.currentType || currentType] || 'rgb(0, 150, 255)');
        });
    } catch(e) {}

    try {
        const artHeader = document.getElementById('abs-art-header-text');
        if (artHeader) {
            if (window.absUnitTag === undefined) {
                window.absUnitTag = artHeader.innerText.trim() || "DOKKAN FESTIVAL UNIT";
            }
            artHeader.innerText = window.absUnitTag || "";
            artHeader.style.display = window.absUnitTag ? 'block' : 'none';
        }
    } catch(e) {}

    try {
        const rawTitle = document.getElementById('descInput')?.value || document.getElementById('char-description')?.innerText || "Character Title";
        const rawName = document.getElementById('nameInput')?.value || document.getElementById('char-name')?.innerText || "Character Name";
        const dbTitle = document.getElementById('abs-char-title');
        const dbName = document.getElementById('abs-char-name');
        
        if (dbTitle) dbTitle.innerText = rawTitle.replace(/[\[\]]/g, '').trim();
        if (dbName) dbName.innerText = rawName;
    } catch(e) {}

    try {
        const leaderText = document.getElementById('leaderInput')?.value || document.getElementById('leader-skill')?.innerText || "";
        const dbLeaderEl = document.getElementById('abs-leader-skill');
        if (dbLeaderEl) {
            const cleanLeader = leaderText.replace(/[\r\n]+/g, ' ').trim();
            dbLeaderEl.innerHTML = window.formatOfficialText ? window.formatOfficialText(cleanLeader, true) : (window.formatCategoryQuotes ? window.formatCategoryQuotes(cleanLeader) : cleanLeader);
        }
    } catch(e) {}

    try {
        const activeRarity = window.currentRarity || currentRarity;
        const activeAwakening = window.currentAwakeningMode || currentAwakeningMode;
        
        const isLR = activeRarity === 'LR';
        const isSEZA = activeAwakening === 'seza';
        
        const lrThumb = document.getElementById('img-lr');
        const turThumb = document.getElementById('img-tur');
        const ssrThumb = document.getElementById('img-ssr');
        // Imported exchange forms retain their exact portrait here; the
        // progression thumbnails below intentionally still represent the base route.
        let thumbImg = window.currentCardThumbnail || '';
        if (!thumbImg && isLR) thumbImg = lrThumb ? lrThumb.src : '';
        else if (!thumbImg && activeRarity === 'TUR') thumbImg = turThumb ? turThumb.src : '';
        else if (!thumbImg && activeRarity === 'SSR') thumbImg = ssrThumb ? ssrThumb.src : '';
        else if (!thumbImg) thumbImg = (turThumb ? turThumb.src : '') || (ssrThumb ? ssrThumb.src : '') || (lrThumb ? lrThumb.src : '');
        
        const dbThumbImg = document.getElementById('abs-thumb-img');
        if (dbThumbImg && thumbImg) dbThumbImg.src = thumbImg;

        const frameImg = document.querySelector('.card-frame');
        const dbFrameImg = document.getElementById('abs-frame-img');
        if (frameImg && dbFrameImg) dbFrameImg.src = frameImg.src;

        let absRarityImgSrc = 'https://abscustom.github.io/assets/images/rarity_none.png';
        if (activeRarity === 'LR') absRarityImgSrc = 'https://abscustom.github.io/assets/images/rarity_lr_abs.png';
        else if (activeRarity === 'TUR') absRarityImgSrc = 'https://abscustom.github.io/assets/images/rarity_TUR_abs.png';
        else if (activeRarity !== 'none') absRarityImgSrc = 'https://abscustom.github.io/assets/images/rarity_ssr_abs.png';

        const dbTopRarity = document.getElementById('abs-top-rarity-icon');
        if (dbTopRarity) dbTopRarity.src = absRarityImgSrc;
        
        const typeIcon = document.querySelector('.typing-icon');
        const dbTopType = document.getElementById('abs-top-type-icon');
        if (typeIcon && dbTopType) dbTopType.src = typeIcon.src;

        const topLightning = document.getElementById('abs-lightning');
        if (topLightning) {
            topLightning.style.display = (isLR || isSEZA) ? 'block' : 'none';
            topLightning.style.setProperty('--lightning-color', isSEZA && !isLR ? 'rgb(255, 30, 80)' : (lightningColors[window.currentType || currentType] || 'rgb(0, 150, 255)'));
        }

        const spinDial = document.getElementById('abs-spin-dial');
        if (spinDial) spinDial.style.display = isLR ? 'block' : 'none';

        const topComposedIcon = document.getElementById('abs-composed-icon');
        if (topComposedIcon) {
            topComposedIcon.classList.toggle('seza-glow-card', isSEZA);
            if (isSEZA && typeof window.DokkanLWF !== 'undefined' && window.DokkanLWF.attachSezaFlameBorder) {
                const cardType = (window.currentType || currentType || 'agl').toLowerCase();
                window.DokkanLWF.attachSezaFlameBorder(topComposedIcon, cardType);
            } else {
                const existingCanvas = topComposedIcon.querySelector('.seza-lwf-border-canvas');
                if (existingCanvas) {
                    if (typeof window.DokkanLWF !== 'undefined' && window.DokkanLWF.destroy) {
                        window.DokkanLWF.destroy(existingCanvas.id);
                    }
                    existingCanvas.remove();
                }
            }
        }

        let absAwakeningSrc = null;
        if (activeAwakening === 'eza') absAwakeningSrc = 'https://abscustom.github.io/assets/images/eza_abs.png';
        if (activeAwakening === 'seza') absAwakeningSrc = 'https://abscustom.github.io/assets/images/superza_abs.png';

        const ezaContainer = document.getElementById('awakening-container');
        const dbEzaImg = document.getElementById('abs-awakening-img');
        const dbTopEzaImg = document.getElementById('abs-top-awakening-img');
        
        if (ezaContainer && ezaContainer.style.display !== 'none' && absAwakeningSrc) {
            if (dbEzaImg) { dbEzaImg.src = absAwakeningSrc; dbEzaImg.style.display = 'block'; }
            if (dbTopEzaImg) { dbTopEzaImg.src = absAwakeningSrc; dbTopEzaImg.style.display = 'block'; }
        } else {
            if (dbEzaImg) dbEzaImg.style.display = 'none';
            if (dbTopEzaImg) dbTopEzaImg.style.display = 'none';
        }

        const dbRarityIconRight = document.getElementById('abs-rarity-icon');
        if (dbRarityIconRight) dbRarityIconRight.src = absRarityImgSrc;
        
        const dbTypeIconRight = document.getElementById('abs-type-icon');
        if (dbTypeIconRight && typeIcon) dbTypeIconRight.src = typeIcon.src;
        
        const myOverlay = document.getElementById('myOverlayImage');
        const myOverlayVid = document.getElementById('myOverlayVideo');
        const dbArtImg = document.getElementById('abs-art-img');
        const dbArtVid = document.getElementById('abs-art-video');

        if (myOverlayVid && myOverlayVid.style.display !== 'none' && myOverlayVid.querySelector('source')?.src) {
            if (dbArtVid) {
                dbArtVid.src = myOverlayVid.querySelector('source').src;
                dbArtVid.style.display = 'block';
                dbArtVid.load();
                dbArtVid.play().catch(()=>{});
            }
            if (dbArtImg) dbArtImg.style.display = 'none';
        } else {
            if (dbArtVid) dbArtVid.style.display = 'none';
            if (myOverlay && dbArtImg) {
                dbArtImg.src = myOverlay.src;
                // Don't override display here since switchEditorArtMode will manage visibility between animated layers and flat image
            }
        }
        
        if (window.switchEditorArtMode) window.switchEditorArtMode(window.currentEditorArtMode || 'animated');
    } catch(e) {}

    try {
        const passiveNameInput = document.getElementById('input-passive-name-sidebar');
        const passiveDisplay = document.querySelector('.passive-name-display');
        const passiveName = passiveNameInput?.value || passiveDisplay?.innerText || "Passive Skill";
        
        const mainPassiveCont = document.getElementById('card-passive-container');
        const rawPassiveText = mainPassiveCont ? mainPassiveCont.innerText : "";
        const iconsStripHtml = renderPassiveIconsStrip(rawPassiveText);

        const dbPassiveName = document.getElementById('abs-passive-name');
        if (dbPassiveName) {
            dbPassiveName.innerHTML = `
                <div class="abs-passive-header-title">
                    <span>Passive Skill</span>
                    <span class="mx-1">&ndash;</span>
                    <i>${passiveName}</i>
                </div>
                ${iconsStripHtml}
            `;
        }
        
        const dbPassiveCont = document.getElementById('abs-passive-container');
        if (dbPassiveCont && mainPassiveCont) {
            let passiveHtml = mainPassiveCont.innerHTML || "";
            if (window.normalizeAssetUrl) passiveHtml = window.normalizeAssetUrl(passiveHtml);

            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = passiveHtml;

            let formattedHtml = "";
            const sections = tempDiv.querySelectorAll('strong');
            if (sections.length > 0) {
                sections.forEach((st, idx) => {
                    const titleText = st.innerText.trim();
                    const mt = (idx === 0 || formattedHtml === "") ? "margin-top: 0;" : "margin-top: 14px;";
                    formattedHtml += `<strong class="abs-passive-section-title" style="display:block; ${mt} margin-bottom: 4px; color:var(--theme-text, #38bdf8); font-size: 13.5px; text-shadow: 0 0 8px var(--theme-glow, rgba(56, 189, 248, 0.6)); font-weight: 700;">${window.formatCategoryQuotes ? window.formatCategoryQuotes(titleText) : titleText}</strong>`;
                    
                    let sib = st.nextElementSibling;
                    while (sib && sib.tagName !== 'STRONG') {
                        if (sib.tagName === 'UL') {
                            formattedHtml += '<ul class="abs-passive-list">';
                            sib.querySelectorAll('li').forEach(li => {
                                let liContent = li.innerHTML;
                                if (window.formatOfficialText) liContent = window.formatOfficialText(liContent, false);
                                else if (window.formatCategoryQuotes) liContent = window.formatCategoryQuotes(liContent);
                                formattedHtml += `<li>${liContent}</li>`;
                            });
                            formattedHtml += '</ul>';
                        }
                        sib = sib.nextElementSibling;
                    }
                });
            } else {
                formattedHtml = tempDiv.innerHTML;
                if (window.formatOfficialText) formattedHtml = window.formatOfficialText(formattedHtml, false);
                else if (window.formatCategoryQuotes) formattedHtml = window.formatCategoryQuotes(formattedHtml);
            }

            dbPassiveCont.innerHTML = formattedHtml;
        }
    } catch(e) {}

    try {
        if (window.updateAbsStyleSuperAttacks) window.updateAbsStyleSuperAttacks();
    } catch(e) {}

    try {
        const dbLinkCont = document.getElementById('abs-link-container');
        if (dbLinkCont) {
            dbLinkCont.innerHTML = "";
            document.querySelectorAll('#card-link-container a').forEach(a => {
                const linkName = a.innerText.trim();
                if (linkName) {
                    const level10Effect = window.getLinkSkillLevel10Description?.(linkName) || '';
                    const tooltip = window.escapeLinkTooltipAttribute?.(level10Effect) || level10Effect;
                    const tooltipAttr = level10Effect ? ` data-tooltip="${tooltip}"` : '';
                    if (level10Effect) a.setAttribute('data-tooltip', level10Effect);
                    else a.removeAttribute('data-tooltip');
                    dbLinkCont.insertAdjacentHTML('beforeend', `
                    <div class="abs-link-badge"${tooltipAttr}>
                        <div class="abs-link-lv">
                            <span class="lv-text">Lv</span>
                            <span class="num-text">10</span>
                        </div>
                        <div class="abs-link-name">${linkName}</div>
                    </div>`);
                }
            });
        }
    } catch(e) {}

    try {
        const dbCatCont = document.getElementById('abs-category-container');
        if (dbCatCont) {
            dbCatCont.innerHTML = "";
            const categoryItems = document.querySelectorAll('#card-category-container .editor-category-item');
            const itemsToRender = categoryItems.length ? categoryItems : document.querySelectorAll('#card-category-container > div');
            itemsToRender.forEach(item => {
                const img = item.querySelector('img');
                const categoryName = item.dataset.categoryName || img?.alt || 'Category';
                const source = img?.currentSrc || img?.src || '';
                dbCatCont.insertAdjacentHTML('beforeend', `<span class="abs-category-entry"><img src="${source}" alt="${categoryName}" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-flex';"><span class="category-name-fallback" style="display:none;">${categoryName}</span></span>`);
            });
        }
    } catch(e) {}

    try {
        if (window.updateAbsStatDisplay) window.updateAbsStatDisplay();
    } catch(e) {}

    try {
        const baseDate = (document.getElementById('dateInput')?.value?.trim() || "") || "TBD";
        const ezaDate = (document.getElementById('ezaDateInput')?.value?.trim() || "") || "TBD";
        const sezaDate = (document.getElementById('sezaDateInput')?.value?.trim() || "") || "TBD";
        
        const activeType = window.currentType || currentType;
        const activeClass = window.currentClass || currentClass;
        const activeRarity = window.currentRarity || currentRarity;
        const activeAwakening = window.currentAwakeningMode || currentAwakeningMode;
        
        const baseTypeSrc = typeImageUrls[activeType] || "https://abscustom.github.io/assets/images/type_none.png";
        const classTypeSrc = typeImageMap[activeClass][activeType] || "https://abscustom.github.io/assets/images/type_none.png";
        const frameSrc = document.getElementById('abs-frame-img')?.src || "https://abscustom.github.io/assets/images/frame_none.png";

        const buildDbCardIcon = (thumbSrc, raritySrc, usePlainType = false, ezaIconSrc = null, isSEZA = false) => {
            const tSrc = usePlainType ? baseTypeSrc : classTypeSrc;
            const isLR = raritySrc.includes('lr_abs') || raritySrc.includes('LR');
            const showLightning = isLR || isSEZA;
            const sezaLightningStyle = isSEZA && !isLR ? 'style="--lightning-color: rgb(255, 30, 80);"' : '';
            const lrSpinHtml = isLR ? `<img src="https://abscustom.github.io/assets/images/lr_spin_dial.png" class="lr-spin-dial">` : '';
            const lrLightningHtml = showLightning ? `
                <video class="lightning-overlay" autoplay muted loop playsinline ${sezaLightningStyle}>
                    <source src="https://abscustom.github.io/assets/images/lightningfx.webm" type="video/webm">
                </video>` : '';
            const ezaHtml = ezaIconSrc ? `<img src="${ezaIconSrc}" class="eza-icon">` : '';
            const sezaGlowClass = isSEZA ? 'seza-glow-card' : '';

            return `
                <div class="abs-composed-icon ${sezaGlowClass}">
                    <img class="card-frame" src="${frameSrc}">
                    ${lrSpinHtml}
                    ${lrLightningHtml}
                    <div class="thumb-box">
                        <img class="thumb-img" src="${thumbSrc}">
                    </div>
                    <img class="rarity-icon" src="${raritySrc}">
                    <img class="type-icon" src="${tSrc}">
                    ${ezaHtml}
                </div>
            `;
        };

        const awakenCont = document.getElementById('abs-awakenings-container');
        if (awakenCont) {
            let awHTML = '';
            const buildStepDivider = (imgSrc, fallbackText) => `
                <div class="abs-awaken-divider">
                    <img src="${imgSrc}" onerror="this.outerHTML='<span class=\\'abs-awaken-divider-text\\'>${fallbackText}</span>'">
                </div>
            `;

            const ssrSrc = document.getElementById('img-ssr')?.getAttribute('src') || document.getElementById('img-ssr')?.src || "";
            const turSrc = document.getElementById('img-tur')?.getAttribute('src') || document.getElementById('img-tur')?.src || "";
            const lrSrc = document.getElementById('img-lr')?.getAttribute('src') || document.getElementById('img-lr')?.src || "";
            const mainThumbSrc = document.getElementById('abs-thumb-img')?.getAttribute('src') || document.getElementById('abs-thumb-img')?.src || lrSrc || turSrc || ssrSrc || "https://abscustom.github.io/assets/images/default.png";

            const hasCustomSsr = ssrSrc && !ssrSrc.endsWith('SSR_Icon.png') && !ssrSrc.endsWith('none.png') && !ssrSrc.endsWith('default.png') && !ssrSrc.endsWith('editor.html');
            const hasCustomTur = turSrc && !turSrc.endsWith('TUR_Icon.png') && !turSrc.endsWith('none.png') && !turSrc.endsWith('default.png') && !turSrc.endsWith('editor.html');

            const hasAwakeningProgression = activeRarity !== 'none' && activeRarity !== 'SSR' && (hasCustomSsr || hasCustomTur || (activeRarity === 'LR' && (hasCustomSsr || hasCustomTur)));

            if (!hasAwakeningProgression || activeRarity === 'none') {
                // SINGLE ICON MODE: Standalone card (battlefield unit, skin, event card, single form)
                const currentRaritySrc = activeRarity === 'LR' ? 'https://abscustom.github.io/assets/images/rarity_lr_abs.png' : (activeRarity === 'TUR' ? 'https://abscustom.github.io/assets/images/rarity_TUR_abs.png' : (activeRarity === 'SSR' ? 'https://abscustom.github.io/assets/images/rarity_ssr_abs.png' : 'https://abscustom.github.io/assets/images/rarity_none.png'));
                const isSEZA = activeAwakening === 'seza';
                const ezaIconSrc = (activeAwakening === 'eza' || isSEZA) ? (isSEZA ? 'https://abscustom.github.io/assets/images/superza_abs.png' : 'https://abscustom.github.io/assets/images/eza_abs.png') : null;

                awHTML += `
                    <div class="abs-awaken-row">
                        ${buildDbCardIcon(mainThumbSrc, currentRaritySrc, false, ezaIconSrc, isSEZA)}
                        <div class="abs-awaken-date" style="font-size: 14px; font-weight: bold; text-align: center; flex: 1;">
                            Release Date:<br>
                            <span style="color: #a1a1aa; font-weight: normal; font-size: 12px;">${baseDate}</span>
                        </div>
                    </div>
                `;

                if (activeAwakening === 'eza' || isSEZA) {
                    if (ezaDate && ezaDate !== "TBD" && ezaDate !== baseDate) {
                        awHTML += `
                            ${buildStepDivider(isSEZA ? 'https://abscustom.github.io/assets/images/superza_abs.png' : 'https://abscustom.github.io/assets/images/eza_abs.png', isSEZA ? 'SUPER EZA' : 'EXTREME Z-AWAKEN')}
                            <div class="abs-awaken-row">
                                ${buildDbCardIcon(mainThumbSrc, currentRaritySrc, false, ezaIconSrc, isSEZA)}
                                <div class="abs-awaken-date" style="font-size: 14px; font-weight: bold; text-align: center; flex: 1;">
                                    ${isSEZA ? 'SEZA' : 'EZA'} Release Date:<br>
                                    <span style="color: #a1a1aa; font-weight: normal; font-size: 12px;">${isSEZA ? sezaDate : ezaDate}</span>
                                </div>
                            </div>
                        `;
                    }
                }
            } else {
                // MULTI-STAGE AWAKENING PROGRESSION (SSR -> TUR -> LR)
                const safeSsrSrc = ssrSrc || "https://abscustom.github.io/assets/images/SSR_Icon.png";
                awHTML += `
                    <div class="abs-awaken-row">
                        ${buildDbCardIcon(safeSsrSrc, 'https://abscustom.github.io/assets/images/rarity_ssr_abs.png', true)}
                        <div class="abs-awaken-date" style="font-size: 14px; font-weight: bold; text-align: center; flex: 1;">
                            Release Date:<br>
                            <span style="color: #a1a1aa; font-weight: normal; font-size: 12px;">${baseDate}</span>
                        </div>
                    </div>
                `;
                
                if (activeRarity === 'TUR' || activeRarity === 'LR') {
                    const safeTurSrc = turSrc || "https://abscustom.github.io/assets/images/TUR_Icon.png";
                    awHTML += `
                        ${buildStepDivider('https://abscustom.github.io/assets/images/dokkan-awaken.png', 'DOKKAN AWAKEN')}
                        <div class="abs-awaken-row">
                            ${buildDbCardIcon(safeTurSrc, 'https://abscustom.github.io/assets/images/rarity_TUR_abs.png', false)}
                            <div class="abs-awaken-date" style="font-size: 14px; font-weight: bold; text-align: center; flex: 1;">
                                Release Date:<br>
                                <span style="color: #a1a1aa; font-weight: normal; font-size: 12px;">${baseDate}</span>
                            </div>
                        </div>
                    `;
                }

                if (activeRarity === 'LR') {
                    const safeLrSrc = lrSrc || "https://abscustom.github.io/assets/images/LR_Icon.png";
                    awHTML += `
                        ${buildStepDivider('https://abscustom.github.io/assets/images/dokkan-awaken.png', 'LEGENDARY AWAKEN')}
                        <div class="abs-awaken-row">
                            ${buildDbCardIcon(safeLrSrc, 'https://abscustom.github.io/assets/images/rarity_lr_abs.png', false)}
                            <div class="abs-awaken-date" style="font-size: 14px; font-weight: bold; text-align: center; flex: 1;">
                                Release Date:<br>
                                <span style="color: #a1a1aa; font-weight: normal; font-size: 12px;">${baseDate}</span>
                            </div>
                        </div>
                    `;
                }

                if (activeAwakening === 'eza' || activeAwakening === 'seza') {
                    const maxThumb = activeRarity === 'LR' ? (safeLrSrc) : (safeTurSrc);
                    const maxRar = activeRarity === 'LR' ? 'https://abscustom.github.io/assets/images/rarity_lr_abs.png' : 'https://abscustom.github.io/assets/images/rarity_TUR_abs.png';
                    awHTML += `
                        ${buildStepDivider('https://abscustom.github.io/assets/images/eza_abs.png', 'EXTREME Z-AWAKEN')}
                        <div class="abs-awaken-row">
                            ${buildDbCardIcon(maxThumb, maxRar, false, 'https://abscustom.github.io/assets/images/eza_abs.png')}
                            <div class="abs-awaken-date" style="font-size: 14px; font-weight: bold; text-align: center; flex: 1;">
                                EZA Release Date:<br>
                                <span style="color: #a1a1aa; font-weight: normal; font-size: 12px;">${ezaDate}</span>
                            </div>
                        </div>
                    `;
                }

                if (activeAwakening === 'seza') {
                    const maxThumb = activeRarity === 'LR' ? (safeLrSrc) : (safeTurSrc);
                    const maxRar = activeRarity === 'LR' ? 'https://abscustom.github.io/assets/images/rarity_lr_abs.png' : 'https://abscustom.github.io/assets/images/rarity_TUR_abs.png';
                    awHTML += `
                        ${buildStepDivider('https://abscustom.github.io/assets/images/superza_abs.png', 'SUPER EZA')}
                        <div class="abs-awaken-row">
                            ${buildDbCardIcon(maxThumb, maxRar, false, 'https://abscustom.github.io/assets/images/superza_abs.png', true)}
                            <div class="abs-awaken-date" style="font-size: 14px; font-weight: bold; text-align: center; flex: 1;">
                                SEZA Release Date:<br>
                                <span style="color: #a1a1aa; font-weight: normal; font-size: 12px;">${sezaDate}</span>
                            </div>
                        </div>
                    `;
                }
            }

            awakenCont.innerHTML = awHTML;
            if (typeof window.DokkanLWF !== 'undefined' && window.DokkanLWF.attachSezaFlameBorder) {
                awakenCont.querySelectorAll('.abs-composed-icon[data-seza="true"], .abs-composed-icon.seza-glow-card').forEach(iconEl => {
                    const cardType = (window.currentType || currentType || 'agl').toLowerCase();
                    window.DokkanLWF.attachSezaFlameBorder(iconEl, cardType);
                });
            }
        }

        const transBox = document.getElementById('abs-transformations-box');
        const transCont = document.getElementById('abs-transformations-container');
        const forms = document.querySelectorAll('#forms-container .dokkan-card');

        if (transBox && transCont) {
            if (forms.length > 0) {
                transBox.classList.remove('d-none');
                let trHTML = '';
                forms.forEach((f) => {
                    const fImg = f.getAttribute('data-thumb-src') || f.querySelector('.form-image')?.src || "https://abscustom.github.io/assets/images/default.png";
                    const fName = f.querySelector('.form-name-display')?.innerText || f.querySelector('.form-name')?.innerText || "Form";
                    const fLinkAnchor = f.querySelector('.form-link');
                    let fLink = fLinkAnchor ? fLinkAnchor.getAttribute('href') : "javascript:void(0)";
                    if (!fLink || fLink === "#") fLink = "javascript:void(0)";

                    if (trHTML !== '') {
                        trHTML += `<div class="abs-transform-divider"></div>`;
                    }

                    trHTML += `
                        <div class="abs-transform-row">
                            <a href="${fLink}" class="abs-transform-link" target="_blank" style="text-decoration:none; color:inherit; display:flex; align-items:center; width:100%;">
                                ${buildDbCardIcon(fImg, activeRarity === 'LR' ? 'https://abscustom.github.io/assets/images/rarity_lr_abs.png' : 'https://abscustom.github.io/assets/images/rarity_TUR_abs.png', false)}
                                <div class="abs-transform-name" style="flex: 1; text-align: center; font-size: 15px; font-weight: bold;">${fName}</div>
                            </a>
                        </div>
                    `;
                });
                transCont.innerHTML = trHTML;
            } else {
                transBox.classList.add('d-none');
                transCont.innerHTML = '';
            }
        }
    } catch(e) { console.error("Awakenings/Transformations Sync Error", e); }

    try {
        if (window.renderPassiveHeaderBadgeToggles) window.renderPassiveHeaderBadgeToggles();
    } catch(e) {}
};

function getAbsStatIconPath(iconPath) {
    if (!iconPath) return 'https://abscustom.github.io/assets/images/st_0001.png';
    if (iconPath.includes('pot_skill_02_on.png')) {
        return 'https://abscustom.github.io/assets/images/st_critical_up.png';
    }
    return iconPath;
}

function getStatsFromBlock(block) {
    const stats = [];
    const statContainer = block.querySelector('.stats-container');
    if (!statContainer) return stats;

    const statRows = statContainer.querySelectorAll('.sa-stat-row, .col, div');
    const elementsToScan = statRows.length > 0 ? statRows : statContainer.children;
    const effectsText = block.querySelector('.sa-display-effects-list')?.innerText || '';

    const isSelfExcluded = /self excluded|excluding self|self-excluded/i.test(effectsText);
    const clauses = effectsText.split(/,|\;|\band\s+(?=causes|lowers|greatly|massively|seals|stuns|disables|raises)/i);

    const jointAndTurnMatch = effectsText.match(/(ATK|DEF)\b[^\;\,\.]*?\band\b[^\;\,\.]*?\bfor\s+(\d+)\s+turns?/i);
    let jointTurns = null;
    if (jointAndTurnMatch) {
        const num = parseInt(jointAndTurnMatch[2], 10);
        jointTurns = `${num} turn${num > 1 ? 's' : ''}`;
    }

    const assignedTargets = new Set();

    Array.from(elementsToScan).forEach(row => {
        const img = row.tagName === 'IMG' ? row : row.querySelector('img');
        if (!img) return;

        const iconSrc = img.getAttribute('src');
        if (!iconSrc || iconSrc.includes('sp_skill_icon')) return;

        let value = '';
        const textEl = row.querySelector('.display-text, span') || row;
        const rawText = textEl ? textEl.textContent : '';
        const valMatch = rawText.match(/(\d+)\s*%/);
        if (valMatch) value = valMatch[1];

        let target = row.dataset.target;
        if (!target) {
            const isEnemyIcon = 
                iconSrc.includes('st_0011') || iconSrc.includes('st_0012') || 
                iconSrc.includes('st_1009') || iconSrc.includes('st_0100') || iconSrc.includes('st_0102');   

            if (isEnemyIcon || /enemy|debuff|lower|seal|stun|break|disable/i.test(rawText)) target = 'enemy';
            else if (/ally|allies/i.test(rawText)) target = 'ally';
            else if (isSelfExcluded && /ally|allies|team|party/i.test(effectsText)) target = 'ally';
            else target = 'self';
        }
        
        assignedTargets.add(`${iconSrc}-${target}`);

        let turns = row.dataset.turns;
        if (!turns) {
            let isAttackBreak = iconSrc.includes('st_1009') || /disable|break/i.test(rawText);
            let isStunOrSeal = iconSrc.includes('st_0100') || iconSrc.includes('st_0102') || /stun|seal/i.test(rawText);
            let isLowerStat = iconSrc.includes('st_0011') || iconSrc.includes('st_0012') || /lower/i.test(rawText);

            if (isAttackBreak) turns = '1 turn';
            else if (isStunOrSeal) turns = '2 turns';
            else if (isLowerStat) turns = '3 turns';
            else if (/raise|raises|boost/i.test(effectsText) && !/for\s+\d+\s+turn/i.test(effectsText)) turns = '99 turns';
            else turns = '1 turn';
        }

        stats.push({ icon: iconSrc, value: value, turns: turns, target: target });
    });

    const uniqueStats = [];
    const seen = new Set();
    stats.forEach(s => {
        const key = `${s.icon}-${s.value}-${s.target}-${s.turns}`;
        if (!seen.has(key)) {
            seen.add(key);
            uniqueStats.push(s);
        }
    });

    return uniqueStats;
}

function renderAbsSpecialEffects(stats) {
    if (!stats || stats.length === 0) return '';

    const selfStats = stats.filter(s => s.target === 'self');
    const allyStats = stats.filter(s => s.target === 'ally' || s.target === 'allies');
    const enemyStats = stats.filter(s => s.target === 'enemy');

    const getFloatingTagSvg = (typeClass) => {
        if (typeClass === 'allies') {
            return `
                <div class="abs-floating-target-tag allies" title="Allies (+)">
                    <svg class="abs-target-svg allies" viewBox="0 0 34 24" width="24" height="15" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M2 21v-1c0-1.8 1.3-3.2 3-3.4" stroke-width="1.8" opacity="0.75" />
                        <circle cx="5" cy="11" r="2.2" stroke-width="1.8" opacity="0.75" />
                        <path d="M17 16.6c1.7.2 3 1.6 3 3.4v1" stroke-width="1.8" opacity="0.75" />
                        <circle cx="17" cy="11" r="2.2" stroke-width="1.8" opacity="0.75" />
                        <path d="M6 21v-1c0-2.2 1.8-4 4-4h2c2.2 0 4 1.8 4 4v1" stroke-width="2" />
                        <circle cx="11" cy="10" r="2.8" stroke-width="2" />
                        <path d="M24 6h6" stroke-width="2.5" />
                        <path d="M27 3v6" stroke-width="2.5" />
                    </svg>
                </div>
            `;
        } else if (typeClass === 'enemy') {
            return `
                <div class="abs-floating-target-tag enemy" title="Enemy (-)">
                    <svg class="abs-target-svg enemy" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 21v-1c0-2.21 1.79-4 4-4h4c2.21 0 4 1.79 4 4v1" stroke-width="2" />
                        <circle cx="9" cy="10" r="3" stroke-width="2" />
                        <path d="M16 6h6" stroke-width="2.5" />
                    </svg>
                </div>
            `;
        } else {
            return `
                <div class="abs-floating-target-tag self" title="Self (+)">
                    <svg class="abs-target-svg self" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 21v-1c0-2.21 1.79-4 4-4h4c2.21 0 4 1.79 4 4v1" stroke-width="2" />
                        <circle cx="9" cy="10" r="3" stroke-width="2" />
                        <path d="M16 6h6" stroke-width="2.5" />
                        <path d="M19 3v6" stroke-width="2.5" />
                    </svg>
                </div>
            `;
        }
    };

    const renderGroup = (typeClass, statList) => {
        if (statList.length === 0) return '';

        const badgesHtml = statList.map(stat => {
            const cleanVal = stat.value ? String(stat.value).replace(/%/g, '') : '';
            return `
                <div class="abs-effect-badge">
                    <div class="abs-badge-top">
                        <img src="${getAbsStatIconPath(stat.icon)}" alt="stat">
                        ${cleanVal ? `<span>${cleanVal}%</span>` : ''}
                    </div>
                    <div class="abs-badge-fading-divider"></div>
                    <div class="abs-badge-bottom">${stat.turns || '1 turn'}</div>
                </div>
            `;
        }).join('');

        return `
            <div class="abs-effect-group ${typeClass}">
                ${getFloatingTagSvg(typeClass)}
                <div class="abs-group-badges-row">
                    ${badgesHtml}
                </div>
            </div>
        `;
    };

    return `
        <div class="abs-special-effects-section">
            <div class="abs-special-effects-title">SPECIAL EFFECTS</div>
            <div class="abs-special-effects-groups">
                ${renderGroup('self', selfStats)}
                ${renderGroup('allies', allyStats)}
                ${renderGroup('enemy', enemyStats)}
            </div>
        </div>
    `;
}

window.renderAbsDamageMultiplier = function(text, typeLabel = '', isActive = false, kiText = '') {
    if (!text) return '';
    const low = text.toLowerCase();
    const lowLabel = typeLabel.toLowerCase().trim();

    if (/ex\b|ex\s/i.test(lowLabel) || lowLabel.startsWith('ex')) return '';

    const baseMultipliers = {
        'mega-colossal': { 10: 440, 15: 490, 20: 570, 25: 620 },
        'colossal':      { 10: 345, 15: 370, 20: 425, 25: 450 },
        'ultimate':      { 10: 550, 15: 600, 20: 650, 25: 700 },
        'immense':       { 10: 505, 15: 570, 20: 630, 25: 705 },
        'supreme':       { 10: 430, 15: 530, 20: 580, 25: 630 },
        'destructive':   { 10: 290, 15: 360, 20: 390, 25: 420 },
        'extreme':       { 10: 355, 15: 450, 20: 480, 25: 510 },
        'mass':          { 10: 355, 15: 450, 20: 480, 25: 510 },
        'huge':          { 10: 290, 15: 360, 20: 390, 25: 420 },
        'low':           { 10: 220, 15: 290, 20: 320, 25: 350 }
    };

    let matchedTier = null;
    if (low.includes('mega-colossal')) matchedTier = 'mega-colossal';
    else if (low.includes('colossal')) matchedTier = 'colossal';
    else if (low.includes('ultimate')) matchedTier = 'ultimate';
    else if (low.includes('immense')) matchedTier = 'immense';
    else if (low.includes('supreme')) matchedTier = 'supreme';
    else if (low.includes('destructive')) matchedTier = 'destructive';
    else if (low.includes('extreme')) matchedTier = 'extreme';
    else if (low.includes('mass')) matchedTier = 'mass';
    else if (low.includes('huge')) matchedTier = 'huge';
    else if (low.includes('low')) matchedTier = 'low';

    if (!matchedTier) return '';

    const activeRarity = window.currentRarity || currentRarity;
    const activeAwakening = window.currentAwakeningMode || currentAwakeningMode;
    let maxLv = 10;
    const isLR = activeRarity === 'LR';
    const isEZA = activeAwakening === 'eza' || activeAwakening === 'seza';

    if (isLR) maxLv = isEZA ? 25 : 20;
    else maxLv = isEZA ? 15 : 10;

    const maxVal = (baseMultipliers[matchedTier][maxLv] || baseMultipliers[matchedTier][10] || 430) + '%';
    const cleanKi = kiText ? kiText.replace(/[\(\)]/g, '').trim() : '';

    return `
        <div class="abs-damage-multiplier-box">
            <div class="abs-multiplier-left">
                <span class="abs-multiplier-title">DAMAGE MULTIPLIER</span>
                ${cleanKi ? `<span class="abs-multiplier-ki-tag">${cleanKi}</span>` : ''}
            </div>
            <div class="abs-multiplier-pills">
                <div class="abs-multiplier-pill">
                    <span class="pill-val">${maxVal}</span>
                    <span class="pill-at">at</span>
                    <span class="pill-lv">Lv. ${maxLv}</span>
                </div>
            </div>
        </div>
    `;
};

window.updateAbsStyleSuperAttacks = function() {
    const container = document.getElementById('abs-sa-container');
    if (!container) return;

    const blocks = document.querySelectorAll('.sa-block');
    if (blocks.length === 0) {
        container.innerHTML = '';
        window.updateAbsStyleActiveSkills();
        return;
    }

    let htmlBuffer = '';

    blocks.forEach((block) => {
        let typeLabel = block.querySelector('.sa-type-label')?.textContent || 'Super Attack';
        const saName = block.querySelector('.sa-display-name')?.textContent || 'Super Attack';
        const saIcon = block.querySelector('.sa-display-icon')?.getAttribute('src') || 'https://abscustom.github.io/assets/images/sp_skill_icon_01.png';

        const effectCols = block.querySelectorAll('.sa-display-effects-list .col');
        let lines = [];
        effectCols.forEach(c => {
            const txt = c.innerText.trim();
            if (txt && !lines.includes(txt)) lines.push(txt);
        });
        if (lines.length === 0) {
            const raw = block.querySelector('.sa-display-effects-list')?.innerText || '';
            lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
        }
        let effectsFormatted = lines.join('<br>');

        const actRow = block.querySelector('.activation-row');
        const actText = block.querySelector('.activation-text')?.innerText || '';
        const showAct = actRow && !actRow.classList.contains('d-none') && actText.trim();
        let cleanActText = actText.replace(/^Activation Conditions?\(s\)?\s*/i, '').trim();

        let kiText = block.getAttribute('data-ki') || '';
        if (!kiText) {
            const lowLabel = typeLabel.toLowerCase().trim();
            if (lowLabel.includes('ultra')) kiText = '18 Ki';
            else if (lowLabel.includes('super attack')) kiText = '12 Ki';
        }

        let formattedTypeLabel = typeLabel;
        if (/^ex\b/i.test(typeLabel)) {
            formattedTypeLabel = typeLabel.replace(/^ex\b/i, '<span class="abs-ex-prefix">EX</span>');
        }

        const stats = getStatsFromBlock(block);
        const specialEffectsHtml = renderAbsSpecialEffects(stats);
        const damageMultiplierHtml = window.renderAbsDamageMultiplier(effectsFormatted, typeLabel, false, kiText);

        htmlBuffer += `
            <div class="abs-box mb-3">
                <div class="abs-header">
                    <div class="abs-sa-header-title">
                        <img src="${saIcon}" class="abs-sa-icon-left" alt="SA Icon">
                        <span class="abs-sa-title-text">${formattedTypeLabel} | <em class="abs-sa-name-glow">${saName}</em></span>
                    </div>
                </div>
                <div class="abs-content text-start">
                    ${showAct ? `
                        <div class="abs-skill-label text-warning mb-1">Condition:</div>
                        <div class="mb-3">${cleanActText}</div>
                    ` : ''}
                    <div class="abs-skill-label text-warning mb-1">Effect:</div>
                    <div>${effectsFormatted}</div>
                    ${specialEffectsHtml}
                    ${damageMultiplierHtml}
                </div>
            </div>
        `;
    });

    container.innerHTML = htmlBuffer;
    window.updateAbsStyleActiveSkills();
};

window.updateAbsStyleActiveSkills = function() {
    const container = document.getElementById('abs-active-container') || document.getElementById('abs-sa-container');
    if (!container) return;

    const activeBlocks = document.querySelectorAll('.active-block');
    if (activeBlocks.length === 0) {
        const activeBox = document.getElementById('abs-active-container');
        if (activeBox) activeBox.innerHTML = '';
        return;
    }

    let htmlBuffer ='';

    activeBlocks.forEach((block) => {
        const typeLabel = block.querySelector('.active-type-label')?.textContent || 'Active Skill';
        const name = block.querySelector('.active-display-name')?.textContent || 'Active Skill';
        let effect = block.querySelector('.active-display-effect')?.innerText || '';
        if (window.formatCategoryQuotes) {
            effect = window.formatCategoryQuotes(effect);
        }

        const activeIconAttr = block.querySelector('.active-display-icon')?.getAttribute('src') || '';
        const hasNoIcon = !activeIconAttr || activeIconAttr === 'none' || activeIconAttr.includes('none');
        const activeIconHtml = hasNoIcon ? '' : `<img src="${activeIconAttr}" class="abs-sa-icon-left" alt="Active Icon">`;

        const condRow = block.querySelector('.active-condition-row');
        const condText = block.querySelector('.active-display-condition')?.innerText || '';
        const showCond = condRow && !condRow.classList.contains('d-none') && condText.trim().length > 0;
        let cleanActText = condText.trim();
        if (window.formatCategoryQuotes) {
            cleanActText = window.formatCategoryQuotes(cleanActText);
        }

        const damageMultiplierHtml = window.renderAbsDamageMultiplier(effect, typeLabel, true, '');

        htmlBuffer += `
            <div class="abs-box mb-3">
                <div class="abs-header">
                    <div class="abs-sa-header-title">
                        ${activeIconHtml}
                        <span class="abs-sa-title-text">${typeLabel} | <em class="abs-sa-name-glow">${name}</em></span>
                    </div>
                </div>
                <div class="abs-content text-start">
                    ${showCond ? `
                        <div class="abs-skill-label text-warning mb-1">Condition:</div>
                        <div class="mb-3">${cleanActText}</div>
                    ` : ''}
                    <div class="abs-skill-label text-warning mb-1">Effect:</div>
                    <div>${effect}</div>
                    ${damageMultiplierHtml}
                </div>
            </div>
        `;
    });

    const activeContainer = document.getElementById('abs-active-container');
    if (activeContainer) activeContainer.innerHTML = htmlBuffer;
};

// Global Floating Tooltip Controller for Passive Ability Badges
(function setupGlobalFloatingTooltip() {
    let tooltipEl = null;

    function getOrCreateTooltip() {
        if (!tooltipEl) {
            tooltipEl = document.createElement('div');
            tooltipEl.id = 'abs-global-floating-tooltip';
            document.body.appendChild(tooltipEl);
        }
        return tooltipEl;
    }

    document.addEventListener('mouseover', function(e) {
        const badge = e.target.closest('[data-tooltip]');
        if (!badge) return;

        const text = badge.getAttribute('data-tooltip');
        if (!text) return;

        const tip = getOrCreateTooltip();
        tip.textContent = text;
        tip.style.display = 'block';

        const rect = badge.getBoundingClientRect();
        const tipWidth = tip.offsetWidth;
        const tipHeight = tip.offsetHeight;

        let top = rect.top - tipHeight - 8;
        let left = rect.left + (rect.width / 2) - (tipWidth / 2);

        if (top < 10) top = rect.bottom + 8;
        if (left < 10) left = 10;
        if (left + tipWidth > window.innerWidth - 10) {
            left = window.innerWidth - tipWidth - 10;
        }

        tip.style.top = `${top}px`;
        tip.style.left = `${left}px`;
        tip.style.opacity = '1';
    });

    document.addEventListener('mouseout', function(e) {
        const badge = e.target.closest('[data-tooltip]');
        if (!badge) return;
        if (tooltipEl) {
            tooltipEl.style.opacity = '0';
            tooltipEl.style.display = 'none';
        }
    });
})();

window.currentEditorArtMode = 'animated';

window.switchEditorArtMode = function(mode) {
    window.currentEditorArtMode = mode;
    const isAnim = (mode === 'animated');

    const artBox = document.getElementById('abs-art-layers-container');
    const staticBtn = document.getElementById('art-toggle-static');
    const animatedBtn = document.getElementById('art-toggle-animated');
    const lwfCanvas = document.getElementById('abs-card-bg-lwf-canvas');
    const stickerCanvas = document.getElementById('abs-tur-sticker-canvas');
    const bgImgEl = document.getElementById('abs-art-bg');
    const charImgEl = document.getElementById('abs-art-char');
    const effectImgEl = document.getElementById('abs-art-effect');
    const singleArtImg = document.getElementById('abs-art-img');
    const singleVidEl = document.getElementById('abs-art-video');
    const mainVid = document.getElementById('myOverlayVideo');

    if (staticBtn) staticBtn.classList.toggle('active', !isAnim);
    if (animatedBtn) animatedBtn.classList.toggle('active', isAnim);

    if (artBox) {
        artBox.classList.toggle('static-mode', !isAnim);
        artBox.classList.toggle('animated-mode', isAnim);
    }

    const hasMultiLayer = (bgImgEl && bgImgEl.src && !bgImgEl.src.endsWith('none') && !bgImgEl.src.endsWith('/') && !bgImgEl.src.endsWith('editor.html') && !bgImgEl.dataset.failed) ||
                          (charImgEl && charImgEl.src && !charImgEl.src.endsWith('none') && !charImgEl.src.endsWith('/') && !charImgEl.src.endsWith('editor.html') && !charImgEl.dataset.failed);

    const hasVideo = singleVidEl && singleVidEl.src && !singleVidEl.src.endsWith('/') && !singleVidEl.src.endsWith('editor.html') && singleVidEl.src !== window.location.href;

    if (isAnim) {
        const hasLwfActive = lwfCanvas && lwfCanvas.classList.contains('lwf-active');
        if (hasLwfActive) {
            if (lwfCanvas) {
                lwfCanvas.style.display = 'block';
                if (window.DokkanLWF && window.DokkanLWF.play) window.DokkanLWF.play(lwfCanvas.id || 'abs-card-bg-lwf-canvas');
            }
            if (bgImgEl) bgImgEl.style.display = 'none';
            if (charImgEl) charImgEl.style.display = 'none';
            if (effectImgEl) effectImgEl.style.display = 'none';
            if (singleArtImg) singleArtImg.style.display = 'none';
            if (singleVidEl) singleVidEl.style.display = 'none';
        } else if (hasMultiLayer) {
            if (bgImgEl && !bgImgEl.dataset.failed) bgImgEl.style.display = 'block';
            if (charImgEl) charImgEl.style.display = 'block';
            if (effectImgEl && effectImgEl.src && !effectImgEl.dataset.failed) effectImgEl.style.display = 'block';
            if (singleArtImg) singleArtImg.style.display = 'none';
            if (singleVidEl) singleVidEl.style.display = 'none';
            if (lwfCanvas) lwfCanvas.style.display = 'none';
        } else if (hasVideo) {
            if (bgImgEl) bgImgEl.style.display = 'none';
            if (charImgEl) charImgEl.style.display = 'none';
            if (effectImgEl) effectImgEl.style.display = 'none';
            if (singleArtImg) singleArtImg.style.display = 'none';
            if (singleVidEl) {
                singleVidEl.style.display = 'block';
                singleVidEl.play().catch(()=>{});
            }
            if (mainVid && mainVid.querySelector('source')?.src) {
                mainVid.play().catch(()=>{});
            }
            if (lwfCanvas) lwfCanvas.style.display = 'none';
        } else {
            if (bgImgEl) bgImgEl.style.display = 'none';
            if (charImgEl) charImgEl.style.display = 'none';
            if (effectImgEl) effectImgEl.style.display = 'none';
            if (singleVidEl) singleVidEl.style.display = 'none';
            if (singleArtImg) singleArtImg.style.display = 'block';
            if (lwfCanvas) lwfCanvas.style.display = 'none';
        }
        if (stickerCanvas && stickerCanvas.classList.contains('sticker-active')) stickerCanvas.style.display = 'block';
    } else {
        // STATIC / SIMPLE MODE: Freeze video to first frame, or show static character layer
        if (hasMultiLayer) {
            if (bgImgEl) bgImgEl.style.display = 'none';
            if (effEl => effectImgEl.style.display = 'none');
            if (effectImgEl) effectImgEl.style.display = 'none';
            if (lwfCanvas) {
                lwfCanvas.style.display = 'none';
                if (window.DokkanLWF && window.DokkanLWF.pause) window.DokkanLWF.pause(lwfCanvas.id || 'abs-card-bg-lwf-canvas');
            }
            if (stickerCanvas) stickerCanvas.style.display = 'none';
            if (charImgEl && charImgEl.src && !charImgEl.src.endsWith('/') && !charImgEl.dataset.failed) {
                charImgEl.style.display = 'block';
            }
            if (singleArtImg) singleArtImg.style.display = 'none';
            if (singleVidEl) singleVidEl.style.display = 'none';
        } else if (hasVideo) {
            if (bgImgEl) bgImgEl.style.display = 'none';
            if (charImgEl) charImgEl.style.display = 'none';
            if (effectImgEl) effectImgEl.style.display = 'none';
            if (lwfCanvas) lwfCanvas.style.display = 'none';
            if (stickerCanvas) stickerCanvas.style.display = 'none';
            if (singleArtImg) singleArtImg.style.display = 'none';
            if (singleVidEl) {
                singleVidEl.style.display = 'block';
                singleVidEl.currentTime = 0;
                singleVidEl.pause();
            }
            if (mainVid && mainVid.querySelector('source')?.src) {
                mainVid.currentTime = 0;
                mainVid.pause();
            }
        } else {
            if (bgImgEl) bgImgEl.style.display = 'none';
            if (charImgEl) charImgEl.style.display = 'none';
            if (effectImgEl) effectImgEl.style.display = 'none';
            if (lwfCanvas) lwfCanvas.style.display = 'none';
            if (stickerCanvas) stickerCanvas.style.display = 'none';
            if (singleVidEl) singleVidEl.style.display = 'none';
            if (singleArtImg) singleArtImg.style.display = 'block';
        }
    }
};
