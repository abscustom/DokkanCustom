/* ==========================================================================
   absCustom - Dokkan Stat Calculator: UI Controls & Dynamic Handlers
   ========================================================================== */

function setCalcTab(tab) {
    window.currentCalcTab = tab;
    const atkBtn = document.getElementById('btn-tab-atk');
    const defBtn = document.getElementById('btn-tab-def');
    if (atkBtn) atkBtn.classList.toggle('active', tab === 'atk');
    if (defBtn) defBtn.classList.toggle('active', tab === 'def');

    // Dynamically tag cards
    const sotDefCard = document.getElementById('res-sot-def')?.closest('.ds-dash-card');
    const postDefCard = document.getElementById('res-post-def')?.closest('.ds-dash-card');
    const dmgTakenCard = document.getElementById('res-damage-taken')?.closest('.ds-dash-card');
    if (sotDefCard) sotDefCard.classList.add('view-def-only');
    if (postDefCard) postDefCard.classList.add('view-def-only');
    if (dmgTakenCard) dmgTakenCard.classList.add('view-def-only');

    const mainSaCard = document.getElementById('res-main-sa-card') || document.getElementById('res-final-atk')?.closest('.ds-dash-card');
    if (mainSaCard) mainSaCard.classList.add('view-atk-only');

    const atkViews = document.querySelectorAll('.view-atk-only');
    const defViews = document.querySelectorAll('.view-def-only');

    atkViews.forEach(el => el.style.setProperty('display', (tab === 'atk') ? '' : 'none', 'important'));
    defViews.forEach(el => el.style.setProperty('display', (tab === 'def') ? '' : 'none', 'important'));

    if (typeof renderPassiveLinesByCurrentViewMode === 'function') {
        renderPassiveLinesByCurrentViewMode();
    }
    calculateDokkanStats();
}

function setLeaderPreset(leadVal) {
    const leadInput = document.getElementById('calc-lead');
    if (leadInput) leadInput.value = leadVal;
    syncLeaderPillsFromInput();
    calculateDokkanStats();
}

function syncLeaderPillsFromInput() {
    const leadVal = parseFloat(document.getElementById('calc-lead')?.value) || 0;
    document.querySelectorAll('[id^="lead-pill-"]').forEach(btn => btn.classList.remove('active'));

    if (leadVal === 340) document.getElementById('lead-pill-170')?.classList.add('active');
    else if (leadVal === 400) document.getElementById('lead-pill-200')?.classList.add('active');
    else if (leadVal === 440) document.getElementById('lead-pill-220')?.classList.add('active');
}

function setHipoPreset(presetKey) {
    currentHipoPreset = presetKey;
    document.querySelectorAll('[id^="hipo-pill-"]').forEach(btn => btn.classList.remove('active'));
    const pill = document.getElementById(`hipo-pill-${presetKey}`);
    if (pill) pill.classList.add('active');

    applyHipoPreset(presetKey);
    calculateDokkanStats();
}

function applyHipoPreset(presetKey) {
    let atk = cardParsedStats.rainbow100.atk;
    let def = cardParsedStats.rainbow100.def;
    
    const hipoBoostInput = document.getElementById('calc-sa-hipo-boost');
    if (hipoBoostInput) {
        if (presetKey === '0') {
            hipoBoostInput.value = 0;
        } else if (presetKey === '55') {
            hipoBoostInput.value = 30;
        } else if (presetKey === '100' || presetKey === '90' || presetKey === '79' || presetKey === '69') {
            hipoBoostInput.value = 75;
        }
    }

    if (presetKey === '0') {
        atk = cardParsedStats.baseMax ? cardParsedStats.baseMax.atk : (cardParsedStats.hipo55.atk - 2000);
        def = cardParsedStats.baseMax ? cardParsedStats.baseMax.def : (cardParsedStats.hipo55.def - 2000);
    } else if (presetKey === '55') {
        atk = cardParsedStats.hipo55.atk;
        def = cardParsedStats.hipo55.def;
    } else if (presetKey === '69') {
        atk = Math.floor(cardParsedStats.hipo55.atk + (cardParsedStats.rainbow100.atk - cardParsedStats.hipo55.atk) * 0.3);
        def = Math.floor(cardParsedStats.hipo55.def + (cardParsedStats.rainbow100.def - cardParsedStats.hipo55.def) * 0.3);
    } else if (presetKey === '79') {
        atk = Math.floor(cardParsedStats.hipo55.atk + (cardParsedStats.rainbow100.atk - cardParsedStats.hipo55.atk) * 0.5);
        def = Math.floor(cardParsedStats.hipo55.def + (cardParsedStats.rainbow100.def - cardParsedStats.hipo55.def) * 0.5);
    } else if (presetKey === '90') {
        atk = Math.floor(cardParsedStats.hipo55.atk + (cardParsedStats.rainbow100.atk - cardParsedStats.hipo55.atk) * 0.75);
        def = Math.floor(cardParsedStats.hipo55.def + (cardParsedStats.rainbow100.def - cardParsedStats.hipo55.def) * 0.75);
    }

    const baseAtkInput = document.getElementById('calc-base-atk');
    const baseDefInput = document.getElementById('calc-base-def');
    if (baseAtkInput) baseAtkInput.value = atk;
    if (baseDefInput) baseDefInput.value = def;
}

function updateKiSliderDisplay() {
    const slider = document.getElementById('calc-ki-slider');
    const valText = document.getElementById('calc-ki-val');
    const rangeEl = document.getElementById('calc-ki-slider-range');
    const thumbEl = document.getElementById('calc-ki-slider-thumb');
    const hintText = document.getElementById('calc-ki-range-hint');

    if (!slider || !valText) return;

    const isLR = (window.currentCalcRarity === 'LR');
    if (isLR) {
        slider.min = "12";
        slider.max = "24";
        if (hintText) hintText.innerText = "(12-24)";
    } else {
        slider.min = "1";
        slider.max = "12";
        if (hintText) hintText.innerText = "(1-12)";
    }

    const ki = parseInt(slider.value, 10) || (isLR ? 24 : 12);
    valText.innerText = ki;

    const min = parseInt(slider.min, 10) || (isLR ? 12 : 1);
    const max = parseInt(slider.max, 10) || (isLR ? 24 : 12);
    const pct = Math.max(0, Math.min(100, ((ki - min) / (max - min)) * 100));

    let activeColor = '#facc15';
    if (ki <= 2) activeColor = '#22c55e';
    else if (ki <= 12) activeColor = '#facc15';
    else if (ki < 18) activeColor = '#ea580c';
    else activeColor = '#ef4444';

    if (rangeEl) {
        rangeEl.style.width = `${pct}%`;
        rangeEl.style.backgroundColor = activeColor;
    }
    if (thumbEl) {
        thumbEl.style.left = `${pct}%`;
        thumbEl.style.boxShadow = `0 0 10px ${activeColor}, 0 2px 8px rgba(0,0,0,0.7)`;
    }
    valText.style.color = activeColor;
}

function toggleCalcRarity(rarity, skipRecalc = false) {
    window.currentCalcRarity = rarity;
    const turBtn = document.getElementById('calc-rarity-btn-tur');
    const lrBtn = document.getElementById('calc-rarity-btn-lr');
    if (turBtn) turBtn.classList.toggle('active', rarity === 'TUR');
    if (lrBtn) lrBtn.classList.toggle('active', rarity === 'LR');

    const kiSlider = document.getElementById('calc-ki-slider');
    const kiBaseInput = document.getElementById('calc-ki-mult-base');
    const kiAddInput = document.getElementById('calc-ki-mult-add');

    if (rarity === 'LR') {
        if (kiBaseInput) kiBaseInput.value = 200;
        if (kiAddInput) kiAddInput.value = 150;
        if (kiSlider) {
            kiSlider.min = "12";
            kiSlider.max = "24";
            kiSlider.value = "24";
        }
    } else {
        if (kiBaseInput) kiBaseInput.value = 150;
        if (kiAddInput) kiAddInput.value = 140;
        if (kiSlider) {
            kiSlider.min = "1";
            kiSlider.max = "12";
            kiSlider.value = "12";
        }
    }

    updateKiSliderDisplay();

    if (!skipRecalc) {
        refreshDynamicSaRowsForCurrentState();
        calculateDokkanStats();
    }
}

function toggleCalcEza(skipRecalc = false) {
    const ezaBox = document.getElementById('calc-is-eza');
    window.currentCalcEza = ezaBox ? ezaBox.checked : false;

    if (!skipRecalc) {
        refreshDynamicSaRowsForCurrentState();
        calculateDokkanStats();
    }
}

function refreshDynamicSaRowsForCurrentState() {
    if (window.lastParsedSaBlocksData) {
        const isLR = (window.currentCalcRarity === 'LR');
        const isEZA = window.currentCalcEza;
        renderDynamicSaRows(window.lastParsedSaBlocksData, isLR, isEZA);
    }
}

window.currentLinkLevel = 10;

window.toggleLinkLevelMode = function() {
    window.currentLinkLevel = (window.currentLinkLevel === 10) ? 1 : 10;

    const btnBadge = document.getElementById('lbl-master-link-level');
    if (btnBadge) {
        btnBadge.innerText = window.currentLinkLevel;
        if (window.currentLinkLevel === 10) {
            btnBadge.className = 'link-level-btn-badge lvl-10';
        } else {
            btnBadge.className = 'link-level-btn-badge lvl-1';
        }
    }

    if (window.activeCharacterLinks && activeCharacterLinks.length > 0) {
        activeCharacterLinks.forEach(link => {
            if (typeof extractLinkBuffsFromDB === 'function') {
                const buffs = extractLinkBuffsFromDB(link.name, link.rawObj, window.currentLinkLevel);
                link.atk = buffs.atk;
                link.def = buffs.def;
            }
        });
        renderLinkSkillBadges();
        calculateDokkanStats();
    }
};

function renderLinkSkillBadges() {
    const linksContainer = document.getElementById('calc-active-links-list');
    if (!linksContainer) return;

    if (activeCharacterLinks.length === 0) {
        linksContainer.innerHTML = `<div style="font-size: 11px; color: #94a3b8; padding: 8px 4px; text-align: center; width: 100%;">Choose a character to auto-detect links!</div>`;
        recalculateLinkTotals();
        return;
    }

    linksContainer.innerHTML = activeCharacterLinks.map((link, idx) => {
        let statsParts = [];
        if (link.atk > 0) statsParts.push(`<span class="link-pill-atk">+${link.atk}% ATK</span>`);
        if (link.def > 0) statsParts.push(`<span class="link-pill-def">+${link.def}% DEF</span>`);
        if (link.ki > 0) statsParts.push(`<span class="link-pill-ki">+${link.ki} Ki</span>`);
        const statsHtml = statsParts.join(' <span style="color: rgba(255,255,255,0.3); font-weight: 700;">/</span> ');

        return `
            <button type="button" class="dokkan-link-card ${link.active ? 'active' : 'inactive'}" onclick="toggleLinkSkill(${idx})" title="Click to toggle ${link.name}">
                <div class="dokkan-link-card-left">
                    <div class="dokkan-link-gem-wrap">
                        <span class="dokkan-link-gem ${link.active ? 'gem-active' : 'gem-inactive'}"></span>
                    </div>
                    <span class="dokkan-link-name">${link.name}</span>
                </div>
                <div class="dokkan-link-card-right">
                    ${statsParts.length > 0 ? `<div class="dokkan-link-stat-pill">${statsHtml}</div>` : ''}
                    <div class="dokkan-link-lvl-box lvl-10">
                        <span style="font-size: 7.5px; opacity: 0.75;">Lv.</span>
                        <span class="dokkan-link-lvl-num">10</span>
                    </div>
                </div>
            </button>
        `;
    }).join('');

    recalculateLinkTotals();
}

function toggleLinkSkill(idx) {
    if (activeCharacterLinks[idx]) {
        activeCharacterLinks[idx].active = !activeCharacterLinks[idx].active;
        renderLinkSkillBadges();
        calculateDokkanStats();
    }
}

function recalculateLinkTotals() {
    let totalAtk = 0, totalDef = 0;
    activeCharacterLinks.forEach(link => {
        if (link.active) { totalAtk += (link.atk || 0); totalDef += (link.def || 0); }
    });
    const linkAtkInput = document.getElementById('calc-link-atk');
    const linkDefInput = document.getElementById('calc-link-def');
    if (linkAtkInput) linkAtkInput.value = totalAtk;
    if (linkDefInput) linkDefInput.value = totalDef;

    const atkYield = document.getElementById('link-atk-yield-text');
    const defYield = document.getElementById('link-def-yield-text');
    if (atkYield) atkYield.innerText = `+${totalAtk}% ATK`;
    if (defYield) defYield.innerText = `+${totalDef}% DEF`;
}

function onManualLinkStatChange() {
    const linkAtkInput = document.getElementById('calc-link-atk');
    const linkDefInput = document.getElementById('calc-link-def');
    const atkVal = parseFloat(linkAtkInput?.value) || 0;
    const defVal = parseFloat(linkDefInput?.value) || 0;

    const atkYield = document.getElementById('link-atk-yield-text');
    const defYield = document.getElementById('link-def-yield-text');
    if (atkYield) atkYield.innerText = `+${atkVal}% ATK`;
    if (defYield) defYield.innerText = `+${defVal}% DEF`;

    calculateDokkanStats();
}

function parseSaEffect(text) {
    let a = 0, d = 0;
    if (!text) return { atk: 0, def: 0 };
    const t = text.toLowerCase();

    const selfBuffPartMatch = t.match(/^(.*?)(?:and\s+causes|causes\s+(?:huge|extreme|supreme|immense|colossal|mega-colossal|ultimate|damage))/i);
    const buffText = selfBuffPartMatch ? selfBuffPartMatch[1] : t;

    // 1. Joint ATK & DEF
    const combinedNum = buffText.match(/raises\s+atk\s*(?:&|and)\s*def[^\d%]*(\d+)%/i) || 
                        buffText.match(/atk\s*(?:&|and)\s*def\s*\+?\s*(\d+)%/i);
    if (combinedNum) {
        a = parseInt(combinedNum[1], 10);
        d = parseInt(combinedNum[1], 10);
        return { atk: a, def: d };
    }

    if (buffText.includes('massively raises atk & def') || buffText.includes('massively raises def & atk')) {
        return { atk: 100, def: 100 };
    }
    if (buffText.includes('greatly raises atk & def') || buffText.includes('greatly raises def & atk')) {
        return { atk: 50, def: 50 };
    }
    if (buffText.includes('raises atk & def') || buffText.includes('raises def & atk')) {
        const val = buffText.includes('for 1 turn') || buffText.includes('for 3 turns') ? 30 : 20;
        return { atk: val, def: val };
    }

    // 2. Separate ATK and DEF
    const hasAtk = /(?:raises?|boosts?)\s+atk/i.test(buffText) || /atk\s*\+\s*(\d+)%/i.test(buffText);
    const hasDef = /(?:raises?|boosts?)\s+def/i.test(buffText) || /def\s*\+\s*(\d+)%/i.test(buffText);

    if (hasAtk) {
        const atkNum = buffText.match(/raises\s+atk[^\d%]*(\d+)%/i) || buffText.match(/atk\s*\+\s*(\d+)%/i);
        if (atkNum) a = parseInt(atkNum[1], 10);
        else if (buffText.includes('massively raises atk')) a = 100;
        else if (buffText.includes('greatly raises atk')) a = 50;
        else if (buffText.includes('raises atk')) a = 30;
    }

    if (hasDef) {
        const defNum = buffText.match(/raises\s+def[^\d%]*(\d+)%/i) || buffText.match(/def\s*\+\s*(\d+)%/i);
        if (defNum) d = parseInt(defNum[1], 10);
        else if (buffText.includes('massively raises def')) d = 100;
        else if (buffText.includes('greatly raises def')) d = 50;
        else if (buffText.includes('raises def')) d = 30;
    }

    return { atk: a, def: d };
}

function renderDynamicSaRows(saBlocksData, isLR, isEZA) {
    const container = document.getElementById('calc-dynamic-sa-container');
    if (!container) return;

    window.parsedSaBlocksCount = saBlocksData.length;
    let htmlBuffer = '';

    saBlocksData.forEach((sa, idx) => {
        let defaultMultiplier = 505;
        if (sa.is_unit_sa || sa.is_unit_ultra) {
            defaultMultiplier = isLR ? (sa.startKi >= 18 ? 590 : 445) : (isEZA ? 580 : 505);
        } else if (isLR) {
            defaultMultiplier = (idx === 0) ? (isEZA ? 445 : 395) : (isEZA ? 590 : 540);
        } else {
            defaultMultiplier = isEZA ? 580 : 505;
        }

        let exactMult = sa.exact_multiplier || defaultMultiplier;
        const kiBadgeText = sa.kiText || (isLR ? (idx === 0 ? '12 Ki' : '18 Ki') : '12 Ki');

        const standardOptions = isLR ? [
            { val: 395, label: 'Colossal (395% Base / 500% w/ HiPo & LR bonus)' },
            { val: 540, label: 'Mega-Colossal (540% Base / 645% w/ HiPo & LR bonus)' },
            { val: 445, label: 'EZA Colossal (445% Base / 550% w/ HiPo & LR bonus)' },
            { val: 590, label: 'EZA Mega-Colossal (590% Base / 695% w/ HiPo & LR bonus)' },
            { val: 710, label: 'LR EX Ultimate (710% Base / 815% w/ HiPo & LR bonus)' }
        ] : [
            { val: 505, label: 'Immense (505% Base / 580% w/ HiPo)' },
            { val: 430, label: 'Supreme (430% Base / 505% w/ HiPo)' },
            { val: 580, label: 'EZA Immense (580% Base / 655% w/ HiPo)' },
            { val: 530, label: 'EZA Supreme (530% Base / 605% w/ HiPo)' },
            { val: 355, label: 'Extreme (355% Base / 430% w/ HiPo)' },
            { val: 740, label: 'TUR EX Max (740% Base / 815% w/ HiPo)' }
        ];

        let optionsHtml = '';
        const isValueCovered = standardOptions.some(opt => opt.val === exactMult);

        if (!isValueCovered) {
            const hipoTotal = exactMult + (isLR ? 105 : 75);
            const exLabel = sa.is_ex 
                ? `EX Super Multiplier (${exactMult}% Base / ${hipoTotal}% w/ HiPo${isLR ? ' & LR bonus' : ''})`
                : `Custom Multiplier (${exactMult}% Base / ${hipoTotal}% w/ HiPo)`;
            optionsHtml += `<option value="${exactMult}" selected>${exLabel}</option>`;
        }

        standardOptions.forEach(opt => {
            const isSelected = isValueCovered && (opt.val === exactMult);
            optionsHtml += `<option value="${opt.val}" ${isSelected ? 'selected' : ''}>${opt.label}</option>`;
        });

        let themeColor = '#eab308'; // Default Yellow
        let themeRgba = '234, 179, 8';
        
        let displayTypeLabel = sa.typeLabel || "Super Attack";
        if (displayTypeLabel === "12 Ki SA") displayTypeLabel = "Super Attack";
        else if (displayTypeLabel === "Ultra SA") displayTypeLabel = "Ultra Super Attack";

        if (displayTypeLabel.includes('Ultra')) {
            themeColor = '#ef4444'; // Red for Ultra
            themeRgba = '239, 68, 68';
        } else if (displayTypeLabel.includes('EX') || sa.is_unit_sa) {
            themeColor = '#c084fc'; // Purple for EX/Unit
            themeRgba = '192, 132, 252';
        }

        const coolerLRBadge = isLR ? `<span style="background: linear-gradient(90deg, rgba(${themeRgba}, 0.2), transparent); border-left: 2px solid ${themeColor}; padding: 2px 6px; border-radius: 4px; color: ${themeColor}; font-size: 8.5px; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase;">LR +30%</span>` : '';
        const kiBadge = `<span style="background: linear-gradient(90deg, rgba(${themeRgba}, 0.2), transparent); border-left: 2px solid ${themeColor}; padding: 2px 6px; border-radius: 4px; color: ${themeColor}; font-size: 8.5px; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase;">${kiBadgeText}</span>`;

        htmlBuffer += `
            <div class="calc-sa-mini-card" style="border-left-color: ${themeColor} !important; box-shadow: 0 4px 14px rgba(${themeRgba}, 0.12) !important;">
                <div style="font-weight: 900; font-size: 9.5px; color: ${themeColor}; display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px; text-transform: uppercase; letter-spacing: 0.5px;">
                    <div style="display: flex; align-items: center; gap: 4px; width: 100%;">
                        <span>${displayTypeLabel}</span>
                        <div style="flex-grow: 1;"></div>
                        ${kiBadge}
                        ${coolerLRBadge}
                    </div>
                </div>
                <div style="font-size: 11px; color: #fff; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                    ${sa.saName}
                </div>
                <div style="margin-bottom: 2px;">
                    <label style="font-size: 8.5px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin: 0 0 2px 1px;">SA Multiplier</label>
                    <select id="calc-sa-type-${idx}" onchange="calculateDokkanStats()" style="width: 100%; font-size: 9.5px; padding: 2px 4px; margin-bottom: 4px; border-color: rgba(${themeRgba}, 0.3);">
                        ${optionsHtml}
                    </select>
                </div>
                <div class="link-stats-orb-flex" style="margin-top: 6px;">
                    <!-- SA ATK Effect -->
                    <div class="link-stat-orb-card">
                        <div class="link-stat-orb-header">
                            <span class="link-stat-orb-badge atk">ATK EFFECT</span>
                        </div>
                        <div class="link-stat-orb-input-box">
                            <input type="number" id="calc-sa-atk-effect-${idx}" value="${sa.eff?.atk || 0}" oninput="calculateDokkanStats(); updateSaYields(${idx});">
                            <span class="link-stat-orb-unit">%</span>
                        </div>
                        <div class="orb-yield-text atk" id="sa-atk-eff-yield-${idx}">+${sa.eff?.atk || 0}% ATK</div>
                    </div>
                    <!-- SA DEF Effect -->
                    <div class="link-stat-orb-card">
                        <div class="link-stat-orb-header">
                            <span class="link-stat-orb-badge def">DEF EFFECT</span>
                        </div>
                        <div class="link-stat-orb-input-box">
                            <input type="number" id="calc-sa-def-effect-${idx}" value="${sa.eff?.def || 0}" oninput="calculateDokkanStats(); updateSaYields(${idx});">
                            <span class="link-stat-orb-unit">%</span>
                        </div>
                        <div class="orb-yield-text def" id="sa-def-eff-yield-${idx}">+${sa.eff?.def || 0}% DEF</div>
                    </div>
                </div>
                ${sa.fullText ? (() => {
                    let cleanCond = (sa.activationText || sa.condition || '').replace(/Super Attack power will be increased even more!?/gi, '').replace(/Super Attack power will be increased!?/gi, '').replace(/Super Attack power is increased even more!?/gi, '').trim();
                    cleanCond = cleanCond.replace(/^[,\s;:\-]+|[,\s;:\-]+$/g, '').trim();

                    return `
                    <button type="button" class="sa-view-effect-btn" id="sa-effect-btn-${idx}" onclick="toggleSaEffectText(${idx})">
                        <span style="display: inline-flex; align-items: center; gap: 5px;">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="flex-shrink: 0;">
                                <path d="M21 12L9 12M21 6L9 6M21 18L9 18M5 12C5 12.5523 4.55228 13 4 13C3.44772 13 3 12.5523 3 12C3 11.4477 3.44772 11 4 11C4.55228 11 5 11.4477 5 12ZM5 6C5 6.55228 4.55228 7 4 7C3.44772 7 3 6.55228 3 6C3 5.44772 3.44772 5 4 5C4.55228 5 5 5.44772 5 6ZM5 18C5 18.5523 4.55228 19 4 19C3.44772 19 3 18.5523 3 18C3 17.4477 3.44772 17 4 17C4.55228 17 5 17.4477 5 18Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                            <span>SA Effect</span>
                        </span>
                        <span class="sa-effect-arrow">▼</span>
                    </button>
                    <div id="sa-effect-text-wrap-${idx}" class="sa-effect-text-drawer" style="display: none;">
                        ${cleanCond ? `
                        <div class="active-detail-row">
                            <div class="active-detail-header-line">
                                <span class="active-bullet condition">•</span>
                                <span class="active-tag condition">CONDITION</span>
                            </div>
                            <div class="active-detail-text bright-text">${cleanCond}</div>
                        </div>
                        <div class="active-detail-separator"></div>
                        ` : ''}
                        <div class="active-detail-row">
                            <div class="active-detail-header-line">
                                <span class="active-bullet effect">•</span>
                                <span class="active-tag effect">EFFECT</span>
                            </div>
                            <div class="active-detail-text bright-text">${sa.fullText}</div>
                        </div>
                    </div>
                    `;
                })() : ''}
            </div>
        `;
    });

    container.innerHTML = htmlBuffer;
}

window.toggleSaEffectText = function(idx) {
    const el = document.getElementById(`sa-effect-text-wrap-${idx}`);
    const btn = document.getElementById(`sa-effect-btn-${idx}`);
    if (!el) return;
    if (el.style.display === 'none' || !el.style.display) {
        el.style.display = 'block';
        if (btn) {
            btn.classList.add('active');
            const arrow = btn.querySelector('.sa-effect-arrow');
            if (arrow) arrow.innerText = '▲';
        }
    } else {
        el.style.display = 'none';
        if (btn) {
            btn.classList.remove('active');
            const arrow = btn.querySelector('.sa-effect-arrow');
            if (arrow) arrow.innerText = '▼';
        }
    }
};

function updateSaYields(idx) {
    const atkIn = document.getElementById(`calc-sa-atk-effect-${idx}`);
    const defIn = document.getElementById(`calc-sa-def-effect-${idx}`);
    const atkYield = document.getElementById(`sa-atk-eff-yield-${idx}`);
    const defYield = document.getElementById(`sa-def-eff-yield-${idx}`);
    if (atkIn && atkYield) atkYield.innerText = `+${parseFloat(atkIn.value) || 0}% ATK`;
    if (defIn && defYield) defYield.innerText = `+${parseFloat(defIn.value) || 0}% DEF`;
}

function getDynamicSaVal(idx) {
    const sel = document.getElementById(`calc-sa-type-${idx}`);
    if (sel && sel.value) {
        return parseFloat(sel.value) || 505;
    }
    if (window.lastParsedSaBlocksData && window.lastParsedSaBlocksData[idx]) {
        return window.lastParsedSaBlocksData[idx].exact_multiplier || (window.currentCalcRarity === 'LR' ? (idx === 0 ? 395 : 540) : 505);
    }
    return 505;
}

window.addEventListener('DOMContentLoaded', () => {
    syncLeaderPillsFromInput();
    setCalcTab(window.currentCalcTab || 'atk');
});