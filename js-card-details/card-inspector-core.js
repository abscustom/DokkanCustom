/* ==========================================================================
   absCustom - Inspector Core Viewer Controller & State Engine
   ========================================================================== */

let selectedCard = null;
let currentPartnerLimit = 9;
let currentEzaMode = 'base';
let currentCardArtMode = 'animated';
let currentCardAnimType = null;
let activeStickerRunner = null;
let calculatedStats = { hp: {}, atk: {}, def: {} };
let currentStatPercent = '100%';


/* ==========================================================================
   POWER RANK & EXACT RARITY CLASSIFIERS
   ========================================================================== */
function getCardPowerRank(c) {
    if (!c) return 0;
    let score = 0;
    const maxLvl = parseInt(c.max_level || c.lv_max || c.max_lv || 0, 10);
    const cost = parseInt(c.cost || 0, 10);
    const hp = parseInt(c.hp || c.stat_hp_max || 0, 10);
    const atk = parseInt(c.atk || c.stat_atk_max || 0, 10);
    const isLR = (typeof isCardLR === 'function' && isCardLR(c)) || maxLvl >= 150 || cost === 77 || cost === 99;

    if (isLR) score += 1000000;
    else if (maxLvl >= 120) score += 500000;
    else score += 100000;

    score += (cost * 1000) + (maxLvl * 100) + (hp + atk);
    return score;
}
window.getCardPowerRank = getCardPowerRank;

function getCardExactRarity(c) {
    if (!c) return 'SSR';
    const maxLvl = parseInt(c.max_level || c.lv_max || c.max_lv || 0, 10);
    const cost = parseInt(c.cost || 0, 10);
    const rarityStr = String(c.rarity || '').toUpperCase();

    if (rarityStr === 'LR' || maxLvl >= 150 || cost === 77 || cost === 99 || (typeof isCardLR === 'function' && isCardLR(c))) {
        return 'LR';
    }
    if (rarityStr === 'TUR' || maxLvl >= 120) {
        return 'TUR';
    }
    return 'SSR';
}
window.getCardExactRarity = getCardExactRarity;

function applyThemeColors(cardType) {
    const themeColors = { 
        agl: { main: '#1d4ed8', border: '#3b82f6', header: '#1e40af', bgHigh: '#132448', bgLow: '#080e1c', text: '#38bdf8', glow: 'rgba(56, 189, 248, 0.45)' }, 
        teq: { main: '#15803d', border: '#22c55e', header: '#166534', bgHigh: '#0e341f', bgLow: '#06160d', text: '#4ade80', glow: 'rgba(74, 222, 128, 0.45)' }, 
        int: { main: '#7e22ce', border: '#a855f7', header: '#6b21a8', bgHigh: '#321654', bgLow: '#150924', text: '#c084fc', glow: 'rgba(192, 132, 252, 0.45)' }, 
        str: { main: '#b91c1c', border: '#ef4444', header: '#991b1b', bgHigh: '#441616', bgLow: '#1c0909', text: '#f87171', glow: 'rgba(248, 113, 113, 0.45)' }, 
        phy: { main: '#ca8a04', border: '#eab308', header: '#a16207', bgHigh: '#3c290f', bgLow: '#181005', text: '#fde047', glow: 'rgba(234, 179, 8, 0.45)' }, 
        none: { main: '#3f3f46', border: '#71717a', header: '#27272a', bgHigh: '#1f2533', bgLow: '#0d1017', text: '#38bdf8', glow: 'rgba(56, 189, 248, 0.35)' } 
    };
    const c = themeColors[cardType] || themeColors.agl;
    
    [document.documentElement, document.body, document.getElementById('layout-abs-style')].forEach(el => {
        if (el) {
            el.style.setProperty('--theme-main', c.main);
            el.style.setProperty('--theme-border', c.border);
            el.style.setProperty('--theme-header', c.header);
            el.style.setProperty('--theme-bg-high', c.bgHigh);
            el.style.setProperty('--theme-bg-low', c.bgLow);
            el.style.setProperty('--theme-text', c.text);
            el.style.setProperty('--theme-glow', c.glow);
        }
    });
}

function calculateStats(hp, atk, def, type, isEzaActive = false) {
    const rainbowBonus = {
        agl: { hp: 4600, atk: 5000, def: 5400 },
        teq: { hp: 4600, atk: 5400, def: 5000 },
        int: { hp: 5000, atk: 5000, def: 5000 },
        str: { hp: 5000, atk: 5400, def: 4600 },
        phy: { hp: 5400, atk: 5000, def: 4600 }
    }[type] || { hp: 5000, atk: 5000, def: 5000 };

    let hpVal = parseInt(hp || 0, 10);
    let atkVal = parseInt(atk || 0, 10);
    let defVal = parseInt(def || 0, 10);

    const isLR = isCardLR(selectedCard);

    if (isEzaActive && !isLR && selectedCard && !String(selectedCard.id).endsWith('8') && !String(selectedCard.id).endsWith('9')) {
        hpVal = Math.round(hpVal * 1.348);
        atkVal = Math.round(atkVal * 1.348);
        defVal = Math.round(defVal * 1.348);
    }

    const freePathBonus = 2000;
    const dupeBonusHp = Math.max(0, rainbowBonus.hp - freePathBonus);
    const dupeBonusAtk = Math.max(0, rainbowBonus.atk - freePathBonus);
    const dupeBonusDef = Math.max(0, rainbowBonus.def - freePathBonus);

    calculatedStats = {
        hp: {
            '0%': hpVal,
            '55%': hpVal + freePathBonus,
            '69%': hpVal + freePathBonus + Math.round(dupeBonusHp * 0.45),
            '79%': hpVal + freePathBonus + Math.round(dupeBonusHp * 0.70),
            '90%': hpVal + freePathBonus + Math.round(dupeBonusHp * 0.85),
            '100%': hpVal + rainbowBonus.hp
        },
        atk: {
            '0%': atkVal,
            '55%': atkVal + freePathBonus,
            '69%': atkVal + freePathBonus + Math.round(dupeBonusAtk * 0.45),
            '79%': atkVal + freePathBonus + Math.round(dupeBonusAtk * 0.70),
            '90%': atkVal + freePathBonus + Math.round(dupeBonusAtk * 0.85),
            '100%': atkVal + rainbowBonus.atk
        },
        def: {
            '0%': defVal,
            '55%': defVal + freePathBonus,
            '69%': defVal + freePathBonus + Math.round(dupeBonusDef * 0.45),
            '79%': defVal + freePathBonus + Math.round(dupeBonusDef * 0.70),
            '90%': defVal + freePathBonus + Math.round(dupeBonusDef * 0.85),
            '100%': defVal + rainbowBonus.def
        }
    };
    
    updateAbsStatDisplay(currentStatPercent);
}

const STAT_MILESTONES = ['0%', '55%', '69%', '79%', '90%', '100%'];

function handleStatSliderChange(stepIndex) {
    const idx = parseInt(stepIndex, 10);
    const pct = STAT_MILESTONES[idx] || '100%';
    currentStatPercent = pct;
    updateAbsStatDisplay(pct);
}

function setStatSliderIndex(idx) {
    const slider = document.getElementById('abs-stat-range-slider');
    if (slider) {
        slider.value = idx;
        handleStatSliderChange(idx);
    }
}

function updateAbsStatDisplay(pct) {
    if (pct) currentStatPercent = pct.trim();

    const slider = document.getElementById('abs-stat-range-slider');
    const displayLabel = document.getElementById('abs-slider-percent-display');
    const idx = STAT_MILESTONES.indexOf(currentStatPercent);

    if (slider && idx !== -1) slider.value = idx;
    if (displayLabel) displayLabel.textContent = currentStatPercent;

    const hpEl = document.getElementById('abs-stat-hp-val');
    const atkEl = document.getElementById('abs-stat-atk-val');
    const defEl = document.getElementById('abs-stat-def-val');

    if (hpEl) hpEl.innerText = (calculatedStats.hp[currentStatPercent] || 0).toLocaleString();
    if (atkEl) atkEl.innerText = (calculatedStats.atk[currentStatPercent] || 0).toLocaleString();
    if (defEl) defEl.innerText = (calculatedStats.def[currentStatPercent] || 0).toLocaleString();
}

function updateToggleBarActiveButtons(mode) {
    const baseBtn = document.getElementById('eza-toggle-base');
    const ezaBtn = document.getElementById('eza-toggle-eza');
    const sezaBtn = document.getElementById('eza-toggle-seza');

    if (baseBtn) baseBtn.classList.toggle('active', mode === 'base');
    if (ezaBtn) ezaBtn.classList.toggle('active', mode === 'eza');
    if (sezaBtn) sezaBtn.classList.toggle('active', mode === 'seza');
}

/* ==========================================================================
   INSTANT EZA / SEZA FORM SWITCHER
   ========================================================================== */
function switchEzaForm(mode) {
    if (!selectedCard) return;
    currentEzaMode = mode;

    const idStr = String(selectedCard.id);
    const base7Id = idStr.length >= 8 ? idStr.substring(0, 7) : idStr;
    const baseNormId = parseInt(base7Id, 10);

    let targetCard = null;

    if (mode === 'seza') {
        const seza8Id = parseInt(base7Id + '9', 10);
        targetCard = DB.cards.find(c => parseInt(c.id, 10) === seza8Id) || selectedCard;
    } else if (mode === 'eza') {
        const eza8Id = parseInt(base7Id + '8', 10);
        targetCard = DB.cards.find(c => parseInt(c.id, 10) === eza8Id) || selectedCard;
    } else {
        targetCard = DB.cards.find(c => parseInt(c.id, 10) === baseNormId) || selectedCard;
    }

    if (targetCard) {
        selectedCard = targetCard;

        const newUrl = `card.html?id=${base7Id}&mode=${mode}`;
        window.history.replaceState({ cardId: selectedCard.id, mode }, '', newUrl);

        renderCardDetails(selectedCard, mode);
        updateToggleBarActiveButtons(mode);
    }
}





/* ==========================================================================
   DEDICATED TRANSFORMATIONS RESOLVER (CARDS 4000000..4999999)
   ========================================================================== */
function getUnitTransformations(targetCard, parentMax) {
    if (!DB || !DB.cards || !targetCard) return [];

    const targetId = parseInt(targetCard.id, 10);
    const normTargetId = targetId > 10000000 ? Math.floor(targetId / 10) : targetId;
    
    // Resolve base 7-digit ID for transformed units (e.g. 4018251 -> 1018251)
    let rootBaseId = normTargetId;
    if (normTargetId >= 4000000 && normTargetId < 5000000) {
        if (targetCard.parent_id && parseInt(targetCard.parent_id, 10) < 4000000) {
            rootBaseId = parseInt(targetCard.parent_id, 10);
        } else {
            rootBaseId = 1000000 + (normTargetId % 1000000);
        }
    }

    const baseCard = DB.cards.find(c => parseInt(c.id, 10) === rootBaseId) || targetCard;
    const baseNormId = parseInt(baseCard.id, 10) > 10000000 ? Math.floor(parseInt(baseCard.id, 10) / 10) : parseInt(baseCard.id, 10);
    const baseStem6 = Math.floor(baseNormId / 10); // e.g. 101825 for Cooler
    const targetCharId = parseInt(baseCard.character_id || targetCard.character_id || 0, 10);
    const targetUniqueInfoId = parseInt(baseCard.card_unique_info_id || targetCard.card_unique_info_id || 0, 10);

    const parentIsLR = isCardLR(parentMax) || isCardLR(baseCard) || isCardLR(targetCard);
    const transformations = [];
    const seenIds = new Set();

    DB.cards.forEach(c => {
        const cId = parseInt(c.id, 10);
        const normCId = cId > 10000000 ? Math.floor(cId / 10) : cId;

        // ONLY in-battle transformation IDs (4000000..4999999)
        if (normCId < 4000000 || normCId >= 5000000 || normCId === 4024881) return;

        // Turn transformed ID into its 6-digit base stem (e.g. 4018251 -> 101825)
        const cBaseEquivalentId = 1000000 + (normCId % 1000000);
        const cBaseStem6 = Math.floor(cBaseEquivalentId / 10);
        const cStemDiff = Math.abs(cBaseStem6 - baseStem6);

        const cCharId = parseInt(c.character_id || 0, 10);
        const cUniqueInfoId = parseInt(c.card_unique_info_id || 0, 10);
        const cParentId = parseInt(c.parent_id || 0, 10);

        // Transformation match conditions
        const isMatch = (cBaseStem6 === baseStem6) ||
                        (cParentId > 0 && (cParentId === baseNormId || cParentId === targetId || Math.floor(cParentId / 10) === baseStem6)) ||
                        (cStemDiff <= 2 && ((targetCharId > 0 && cCharId === targetCharId) || (targetUniqueInfoId > 0 && cUniqueInfoId === targetUniqueInfoId)));

        if (!isMatch) return;

        // Ignore EZA sub-rows (ending with 8 or 9) from the base transformations list
        const idStr = String(cId);
        if (idStr.length >= 8 && (idStr.endsWith('8') || idStr.endsWith('9'))) return;

        if (!seenIds.has(normCId)) {
            seenIds.add(normCId);
            transformations.push({
                ...c,
                rarity: parentIsLR ? 5 : (parentMax?.rarity || 4),
                max_level: parentIsLR ? 150 : (parentMax?.max_level || 120),
                element: (c.element !== undefined) ? c.element : baseCard.element
            });
        }
    });

    transformations.sort((a, b) => a.id - b.id);
    return transformations;
}

/* ==========================================================================
   PERFECT AWAKENINGS RESOLVER (PRESERVED & ISOLATED)
   ========================================================================== */
function getFullUnitNetwork(targetCard) {
    if (!DB || !DB.cards || !targetCard) return { baseProgression: [], transformations: [], ezas: [], sezas: [] };

    const targetId = parseInt(targetCard.id, 10);
    const normTargetId = targetId > 10000000 ? Math.floor(targetId / 10) : targetId;
    const isTrans = normTargetId >= 4000000 && normTargetId < 5000000;

    let rootBaseId = normTargetId;
    if (isTrans) {
        if (targetCard.parent_id && parseInt(targetCard.parent_id, 10) < 4000000) {
            rootBaseId = parseInt(targetCard.parent_id, 10);
        } else {
            rootBaseId = 1000000 + (normTargetId % 1000000);
        }
    }

    const baseCard = DB.cards.find(c => parseInt(c.id, 10) === rootBaseId) || targetCard;
    const rootBaseNormId = parseInt(baseCard.id, 10) > 10000000 ? Math.floor(parseInt(baseCard.id, 10) / 10) : parseInt(baseCard.id, 10);

    const targetStem6 = Math.floor(rootBaseNormId / 10);
    const targetType = getCardClassAndType(baseCard.element !== undefined ? baseCard.element : baseCard.attribute).cardType;
    const targetCharId = parseInt(baseCard.character_id || targetCard.character_id || 0, 10);
    const targetUniqueInfoId = parseInt(baseCard.card_unique_info_id || targetCard.card_unique_info_id || 0, 10);
    const targetOpenAt = (baseCard.open_at || targetCard.open_at || '').trim();

    const baseProgression = [];
    const ezas = [];
    const sezas = [];

    // 1. BASE AWAKENINGS PROGRESSION (SSR -> TUR -> LR)
    DB.cards.forEach(c => {
        const cId = parseInt(c.id, 10);
        const normCId = cId > 10000000 ? Math.floor(cId / 10) : cId;
        if (normCId >= 4000000 || normCId >= 7000000) return; // Standard cards only

        const cType = getCardClassAndType(c.element !== undefined ? c.element : c.attribute).cardType;
        if (cType !== targetType) return;

        const cStem6 = Math.floor(normCId / 10);
        const cCharId = parseInt(c.character_id || 0, 10);
        const cUniqueInfoId = parseInt(c.card_unique_info_id || 0, 10);
        const cOpenAt = (c.open_at || '').trim();

        const isStemAdjacent = Math.abs(cStem6 - targetStem6) <= 2;
        const isCharIdMatch = (targetCharId > 0 && cCharId === targetCharId);
        const isUniqueInfoMatch = (targetUniqueInfoId > 0 && cUniqueInfoId === targetUniqueInfoId);
        const isSameReleaseDate = (targetOpenAt && cOpenAt && targetOpenAt === cOpenAt && !targetOpenAt.includes('2015-10-30'));
        const isParentMatch = c.parent_id && (Math.floor(parseInt(c.parent_id, 10) / 10) === targetStem6 || parseInt(c.parent_id, 10) === rootBaseNormId);

        const isFamilyMember = isStemAdjacent && (isCharIdMatch || isUniqueInfoMatch || isSameReleaseDate || isParentMatch);

        if (!isFamilyMember) return;

        const idStr = String(cId);
        const isEza = (idStr.length >= 8 && idStr.endsWith('8')) || c.is_eza;
        const isSeza = (idStr.length >= 8 && idStr.endsWith('9')) || c.is_seza;

        if (isSeza) {
            if (!sezas.some(x => x.id === c.id)) sezas.push(c);
        } else if (isEza) {
            if (!ezas.some(x => x.id === c.id)) ezas.push(c);
        } else {
            if (!baseProgression.some(x => x.id === c.id)) baseProgression.push(c);
        }
    });

    if (baseProgression.length === 0) {
        baseProgression.push(baseCard);
    }

    baseProgression.sort((a, b) => getCardPowerRank(a) - getCardPowerRank(b) || a.id - b.id);

    // Keep only 1 max-stat version per stage (1 SSR, 1 TUR, 1 LR)
    const distinctProgression = [];
    const seenTiers = new Set();
    for (let i = baseProgression.length - 1; i >= 0; i--) {
        const c = baseProgression[i];
        const rar = getCardExactRarity(c);
        if (!seenTiers.has(rar)) {
            seenTiers.add(rar);
            distinctProgression.unshift(c);
        }
    }

    const finalProgression = distinctProgression.length > 0 ? distinctProgression : [baseCard];
    const parentMax = finalProgression[finalProgression.length - 1];

    // 2. TRANSFORMATIONS RESOLUTION (DEDICATED FUNCTION)
    const transformations = getUnitTransformations(targetCard, parentMax);

    return { baseProgression: finalProgression, transformations, ezas, sezas };
}



function getCardSiblings(card) {
    if (!DB || !DB.cards || !card) return { base: card, eza: null, seza: null, hasEza: false, hasSeza: false };

    const network = getFullUnitNetwork(card);
    const idStr = String(card.id);
    const currentForm7DigitId = idStr.length >= 8 ? idStr.substring(0, 7) : idStr;
    const currentNormId = parseInt(currentForm7DigitId, 10);
    
    // The base card for the inspected form is the exact 7-digit form itself
    const base = DB.cards.find(c => parseInt(c.id, 10) === currentNormId) || card;

    const eza8DigitId = currentForm7DigitId + '8';
    const seza8DigitId = currentForm7DigitId + '9';

    let eza = DB.cards.find(c => String(c.id) === eza8DigitId) || network.ezas.find(c => String(c.id).startsWith(currentForm7DigitId)) || null;
    let seza = DB.cards.find(c => String(c.id) === seza8DigitId) || network.sezas.find(c => String(c.id).startsWith(currentForm7DigitId)) || null;

    let hasGrowthEza = false;
    let hasGrowthSeza = false;
    if (window.DB && DB.optimalAwakeningGrowths && Array.isArray(DB.optimalAwakeningGrowths)) {
        hasGrowthEza = DB.optimalAwakeningGrowths.some(g => (parseInt(g.card_id, 10) === currentNormId || parseInt(g.card_id, 10) === getRootParentId(card)) && g.optimal_awakening_grow_type === 1);
        hasGrowthSeza = DB.optimalAwakeningGrowths.some(g => (parseInt(g.card_id, 10) === currentNormId || parseInt(g.card_id, 10) === getRootParentId(card)) && g.optimal_awakening_grow_type === 2);
    }

    const familyHasSeza = seza !== null || hasGrowthSeza || isSezaCard(card) || isSezaCard(base);
    const familyHasEza = eza !== null || hasGrowthEza || isEzaCard(card) || isEzaCard(base) || familyHasSeza;

    return {
        base: base || card,
        eza: eza,
        seza: seza,
        hasEza: familyHasEza,
        hasSeza: familyHasSeza
    };
}

function selectCard(cardId, preserveExactId = false, forcedMode = null) {
    const rawId = parseInt(cardId, 10);
    const idStr = String(rawId);
    const norm7Id = idStr.length >= 8 ? parseInt(idStr.substring(0, 7), 10) : rawId;

    let card = DB.cards.find(c => parseInt(c.id, 10) === rawId) || 
               DB.cards.find(c => parseInt(c.id, 10) === norm7Id);
    if (!card) return;

    const isIdSeza = idStr.length >= 8 && idStr.endsWith('9');
    const isIdEza = idStr.length >= 8 && idStr.endsWith('8');

    const siblings = getCardSiblings(card);
    const network = getFullUnitNetwork(card);
    
    // Determine awakening mode
    let mode = forcedMode;
    if (!mode) {
        if (isIdSeza) mode = 'seza';
        else if (isIdEza) mode = 'eza';
        else mode = 'base';
    }
    currentEzaMode = mode;

    if (mode === 'seza' && siblings.seza) card = siblings.seza;
    else if (mode === 'eza' && siblings.eza) card = siblings.eza;
    else if (mode === 'base' && siblings.base) card = siblings.base;

    selectedCard = card;

    if (siblings.base && siblings.base.tag) {
        selectedCard.tag = siblings.base.tag;
    }

    // Toggle bar updates
    const toggleBar = document.getElementById('abs-eza-toggle-bar');
    const toggleCont = document.getElementById('abs-eza-toggle-container');

    if (toggleBar && toggleCont && (siblings.hasEza || siblings.hasSeza)) {
        toggleBar.style.display = "block";
        let btnHtml = `<button type="button" id="eza-toggle-base" class="abs-stat-tab" style="min-width: 80px;" onclick="switchEzaForm('base')">BASE</button>`;
        if (siblings.hasEza) btnHtml += `<button type="button" id="eza-toggle-eza" class="abs-stat-tab" style="min-width: 80px;" onclick="switchEzaForm('eza')">EZA</button>`;
        if (siblings.hasSeza) btnHtml += `<button type="button" id="eza-toggle-seza" class="abs-stat-tab" style="min-width: 80px;" onclick="switchEzaForm('seza')">SEZA</button>`;
        toggleCont.innerHTML = btnHtml;
        updateToggleBarActiveButtons(mode);
    } else if (toggleBar) {
        toggleBar.style.display = "none";
    }

    renderCardDetails(selectedCard, mode);

    const cardIdToUrl = isTransformedCard(selectedCard) ? (String(selectedCard.id).length >= 8 ? String(selectedCard.id).substring(0, 7) : selectedCard.id) : (selectedCard.id);
    const newUrl = `card.html?id=${cardIdToUrl}&mode=${mode}`;
    window.history.replaceState({ cardId: selectedCard.id, mode }, '', newUrl);

    // =========================================================================
    // 1. COMPLETE DYNAMIC AWAKENINGS TREE (SHARED ACROSS ALL FORMS)
    // =========================================================================
    const awakenCont = document.getElementById('abs-awakenings-container');
    let awHTML = '';

    const buildStepDivider = (imgName, fallbackText) => `
        <div class="abs-awaken-divider">
            <img src="${CENTRAL_ASSET_URL}${imgName}" onerror="this.outerHTML='<span class=\\'abs-awaken-divider-text\\'>${fallbackText}</span>'">
        </div>
    `;

    const buildNodeRow = (c, customLabel = "Release Date:", nodeMode = 'base') => {
        const trueDate = getCardExactReleaseDate(c, nodeMode);
        const exactRar = (typeof getCardExactRarity === 'function') ? getCardExactRarity(c) : 'SSR';
        const isSelected = (parseInt(c.id, 10) === parseInt(selectedCard.id, 10));
        
        return `
        <div class="abs-awaken-row cursor-pointer ${isSelected ? 'selected-form-glow' : ''}" onclick="selectCard(${c.id}, false, '${nodeMode}')">
            ${buildComposedIcon(c, exactRar === 'SSR', nodeMode)}
            <div class="abs-awaken-date">
                ${customLabel}<br>
                <span style="color: #a1a1aa; font-weight: normal; font-size: 12px;">${formatESTDateWithTime(trueDate)}</span>
            </div>
        </div>
        `;
    };

    // 1. Render all Base Evolution Steps in Progression Order (SSR -> TUR -> LR)
    const progression = network.baseProgression || [siblings.base || selectedCard];

    progression.forEach((progCard, pIdx) => {
        if (pIdx > 0) {
            const currRar = (typeof getCardExactRarity === 'function') ? getCardExactRarity(progCard) : 'TUR';

            if (currRar === 'LR') {
                awHTML += buildStepDivider('dokkan-awaken.png', 'LEGENDARY AWAKEN');
            } else if (currRar === 'TUR') {
                awHTML += buildStepDivider('dokkan-awaken.png', 'DOKKAN AWAKEN');
            } else {
                awHTML += buildStepDivider('z-awaken.png', 'Z-AWAKEN');
            }
        }
        awHTML += buildNodeRow(progCard, "Release Date:", "base");
    });

    // 2. Attach EZA Node
    if (siblings.hasEza && siblings.eza) {
        awHTML += buildStepDivider('eza_abs.png', 'EXTREME Z-AWAKEN');
        awHTML += buildNodeRow(siblings.eza, 'EZA Release Date:', 'eza');
    }

    // 3. Attach SEZA Node
    if (siblings.hasSeza && siblings.seza) {
        awHTML += buildStepDivider('superza_abs.png', 'SUPER EZA');
        awHTML += buildNodeRow(siblings.seza, 'SEZA Release Date:', 'seza');
    }

    if (awakenCont) {
        awakenCont.innerHTML = awHTML;
        if (typeof window.DokkanLWF !== 'undefined' && window.DokkanLWF.attachSezaFlameBorder) {
            awakenCont.querySelectorAll('.abs-composed-icon[data-seza="true"]').forEach(iconEl => {
                const cardType = iconEl.getAttribute('data-type') || 'agl';
                window.DokkanLWF.attachSezaFlameBorder(iconEl, cardType);
            });
        }
    }

    // =========================================================================
    // 2. TRANSFORMATIONS BOX (CONNECTED VIA CHARACTER_ID & LINEAGE)
    // =========================================================================
    const transBox = document.getElementById('abs-transformations-box');
    const transCont = document.getElementById('abs-transformations-container');
    
    const baseMaxForm = network.baseProgression.length > 0 ? network.baseProgression[network.baseProgression.length - 1] : siblings.base;
    
    const allFamilyForms = [];
    if (baseMaxForm) allFamilyForms.push(baseMaxForm);
    (network.transformations || []).forEach(tf => {
        if (!allFamilyForms.some(f => String(f.id).substring(0, 7) === String(tf.id).substring(0, 7))) {
            allFamilyForms.push(tf);
        }
    });

    const currentCardId = parseInt(selectedCard.id, 10);
    const normCurrentId = currentCardId > 10000000 ? Math.floor(currentCardId / 10) : currentCardId;

    // Filter out whichever form is currently displayed
    const otherFamilyForms = allFamilyForms.filter(f => {
        const fId = parseInt(f.id, 10);
        const normFId = fId > 10000000 ? Math.floor(fId / 10) : fId;
        return normFId !== normCurrentId;
    });

    if (otherFamilyForms.length > 0 && allFamilyForms.length > 1) {
        if (transBox) transBox.classList.remove('d-none');
        let trHTML = '';
        otherFamilyForms.forEach((tc, idx) => {
            if (idx > 0) trHTML += `<div class="abs-transform-divider"></div>`;
            const tcId = parseInt(tc.id, 10);
            let targetNavId = tcId;
            if (mode === 'seza' && siblings.hasSeza) targetNavId = parseInt(String(tcId).substring(0, 7) + '9', 10);
            else if ((mode === 'eza' || mode === 'seza') && siblings.hasEza) targetNavId = parseInt(String(tcId).substring(0, 7) + '8', 10);

            const { title: tcTitle, name: tcName } = parseTitleAndName(tc);
            const displayLabel = tcTitle ? `[${tcTitle}] ${tcName}` : tc.name;

            trHTML += `
                <div class="abs-transform-row cursor-pointer" onclick="selectCard(${targetNavId}, false, '${mode}')">
                    <div style="display:flex; align-items:center; width:100%;">
                        ${buildComposedIcon(tc, false, mode)}
                        <div class="abs-transform-name">${displayLabel}</div>
                    </div>
                </div>
            `;
        });
        if (transCont) transCont.innerHTML = trHTML;
    } else {
        if (transBox) transBox.classList.add('d-none');
        if (transCont) transCont.innerHTML = '';
    }

    updateToggleBarActiveButtons(mode);
}



/* ==========================================================================
   EXACT PASSIVE OBJECT RESOLVER (BASE / EZA / SEZA)
   ========================================================================== */
function getCardPassiveObject(card, mode = currentEzaMode) {
    if (!DB || !DB.passives || !card) return { name: "Passive Skill", itemized_description: "" };

    const cid = parseInt(card.id, 10);
    const idStr = String(cid);
    const base7Id = idStr.length >= 8 ? idStr.substring(0, 7) : idStr;
    const normId = parseInt(base7Id, 10);
    const baseCardId = (normId >= 4000000 && normId < 5000000) ? getRootParentId(card) : normId;

    // 1. Direct card.pass_id check if the card is already the EZA/SEZA card (ends in 8 or 9)
    if (mode === 'eza' && idStr.endsWith('8') && card.pass_id && DB.passives[String(card.pass_id)]) {
        return DB.passives[String(card.pass_id)];
    }
    if (mode === 'seza' && idStr.endsWith('9') && card.pass_id && DB.passives[String(card.pass_id)]) {
        return DB.passives[String(card.pass_id)];
    }

    // 2. Direct Optimal Awakening Growth Lookup (checking the final step with passive_skill_set_id)
    if (window.DB && DB.optimalAwakeningGrowths && Array.isArray(DB.optimalAwakeningGrowths)) {
        const targetGrowType = mode === 'seza' ? 2 : (mode === 'eza' ? 1 : 0);
        if (targetGrowType > 0) {
            const growths = DB.optimalAwakeningGrowths.filter(g => 
                (parseInt(g.card_id, 10) === normId || parseInt(g.card_id, 10) === baseCardId || parseInt(g.card_id, 10) === cid) && 
                g.optimal_awakening_grow_type === targetGrowType &&
                g.passive_skill_set_id
            );
            if (growths.length > 0) {
                const finalStep = growths[growths.length - 1];
                if (DB.passives[String(finalStep.passive_skill_set_id)]) {
                    return DB.passives[String(finalStep.passive_skill_set_id)];
                }
            }
        }
    }

    // 3. Find EZA / SEZA card from DB.cards directly
    if (mode === 'eza') {
        const ezaCard = DB.cards.find(c => String(c.id) === base7Id + '8');
        if (ezaCard && ezaCard.pass_id && DB.passives[String(ezaCard.pass_id)]) {
            return DB.passives[String(ezaCard.pass_id)];
        }
    } else if (mode === 'seza') {
        const sezaCard = DB.cards.find(c => String(c.id) === base7Id + '9');
        if (sezaCard && sezaCard.pass_id && DB.passives[String(sezaCard.pass_id)]) {
            return DB.passives[String(sezaCard.pass_id)];
        }
    }

    // 4. Base card pass_id
    const rawPassId = parseInt(card.pass_id || card.passive_skill_set_id || card.passive_id || 0, 10);
    let passObj = rawPassId ? (DB.passives[rawPassId] || DB.passives[String(rawPassId)]) : null;

    if (!passObj && card.passive_name) {
        passObj = { 
            name: card.passive_name, 
            itemized_description: card.passive_description || card.itemized_description || "" 
        };
    }

    if (!passObj) return { name: "Passive Skill", itemized_description: "" };

    // 5. Family matching fallback
    const rootName = (passObj.name || '')
        .replace(/\s*\(Super Extreme.*?\)$/i, '')
        .replace(/\s*\(Extreme.*?\)$/i, '')
        .trim().toLowerCase();

    const allPassives = Array.isArray(DB.passives) ? DB.passives : Object.values(DB.passives);
    const family = allPassives.filter(p => {
        if (!p || !p.name) return false;
        const pRoot = p.name
            .replace(/\s*\(Super Extreme.*?\)$/i, '')
            .replace(/\s*\(Extreme.*?\)$/i, '')
            .trim().toLowerCase();
        return pRoot === rootName;
    });

    if (family.length > 1) {
        family.sort((a, b) => {
            const aTier = /\(Super Extreme/i.test(a.name || '') ? 2 : (/\(Extreme/i.test(a.name || '') ? 1 : 0);
            const bTier = /\(Super Extreme/i.test(b.name || '') ? 2 : (/\(Extreme/i.test(b.name || '') ? 1 : 0);
            if (aTier !== bTier) return aTier - bTier;
            return (a.id || 0) - (b.id || 0);
        });

        if (mode === 'seza') {
            passObj = family[family.length - 1];
        } else if (mode === 'eza') {
            passObj = family.length >= 3 ? family[1] : family[family.length - 1];
        } else {
            passObj = family[0];
        }
    }

    return passObj;
}


/* ==========================================================================
   EXACT LEADER SKILL RESOLVER (BASE / EZA / SEZA)
   ========================================================================== */
function findLeaderObj(card, mode = currentEzaMode) {
    if (!DB || !DB.leaders || !card) return null;

    const cid = parseInt(card.id, 10);
    const idStr = String(cid);
    const base7Id = idStr.length >= 8 ? idStr.substring(0, 7) : idStr;
    const normId = parseInt(base7Id, 10);
    const baseCardId = (normId >= 4000000 && normId < 5000000) ? getRootParentId(card) : normId;

    if (mode === 'eza' && idStr.endsWith('8') && card.lead_id && DB.leaders[String(card.lead_id)]) {
        return DB.leaders[String(card.lead_id)];
    }
    if (mode === 'seza' && idStr.endsWith('9') && card.lead_id && DB.leaders[String(card.lead_id)]) {
        return DB.leaders[String(card.lead_id)];
    }

    if (window.DB && DB.optimalAwakeningGrowths && Array.isArray(DB.optimalAwakeningGrowths)) {
        const targetGrowType = mode === 'seza' ? 2 : (mode === 'eza' ? 1 : 0);
        if (targetGrowType > 0) {
            const growths = DB.optimalAwakeningGrowths.filter(g => 
                (parseInt(g.card_id, 10) === normId || parseInt(g.card_id, 10) === baseCardId || parseInt(g.card_id, 10) === cid) && 
                g.optimal_awakening_grow_type === targetGrowType &&
                g.leader_skill_set_id
            );
            if (growths.length > 0) {
                const finalStep = growths[growths.length - 1];
                if (DB.leaders[String(finalStep.leader_skill_set_id)]) {
                    return DB.leaders[String(finalStep.leader_skill_set_id)];
                }
            }
        }
    }

    if (mode === 'eza') {
        const ezaCard = DB.cards.find(c => String(c.id) === base7Id + '8');
        if (ezaCard && ezaCard.lead_id && DB.leaders[String(ezaCard.lead_id)]) {
            return DB.leaders[String(ezaCard.lead_id)];
        }
    } else if (mode === 'seza') {
        const sezaCard = DB.cards.find(c => String(c.id) === base7Id + '9');
        if (sezaCard && sezaCard.lead_id && DB.leaders[String(sezaCard.lead_id)]) {
            return DB.leaders[String(sezaCard.lead_id)];
        }
    }

    const rawLeadId = parseInt(card.lead_id || card.leader_skill_set_id || card.leader_skill_id || card.id, 10);
    let leadObj = rawLeadId ? (DB.leaders[rawLeadId] || DB.leaders[String(rawLeadId)]) : null;

    if (leadObj) {
        const rootName = (leadObj.name || '')
            .replace(/\s*\(Super Extreme.*?\)$/i, '')
            .replace(/\s*\(Extreme.*?\)$/i, '')
            .trim().toLowerCase();

        const allLeaders = Array.isArray(DB.leaders) ? DB.leaders : Object.values(DB.leaders);
        const family = allLeaders.filter(l => {
            if (!l || !l.name) return false;
            const lRoot = l.name
                .replace(/\s*\(Super Extreme.*?\)$/i, '')
                .replace(/\s*\(Extreme.*?\)$/i, '')
                .trim().toLowerCase();
            return lRoot === rootName;
        });

        if (family.length > 1) {
            family.sort((a, b) => {
                const aTier = /\(Super Extreme/i.test(a.name || '') ? 2 : (/\(Extreme/i.test(a.name || '') ? 1 : 0);
                const bTier = /\(Super Extreme/i.test(b.name || '') ? 2 : (/\(Extreme/i.test(b.name || '') ? 1 : 0);
                if (aTier !== bTier) return aTier - bTier;
                return (a.id || 0) - (b.id || 0);
            });

            if (mode === 'seza') {
                leadObj = family[family.length - 1];
            } else if (mode === 'eza') {
                leadObj = family.length >= 3 ? family[1] : family[family.length - 1];
            } else {
                leadObj = family[0];
            }
        }
    }
    return leadObj;
}


function renderCardDetails(card, mode = currentEzaMode) {
    if (!card) return;

    try {
        const { cardClass, cardType } = getCardClassAndType(card.element !== undefined ? card.element : card.attribute);
        const exactRarity = (typeof getCardExactRarity === 'function') ? getCardExactRarity(card) : (isCardLR(card) ? 'LR' : (card.rarity === 4 ? 'TUR' : 'SSR'));
        const isLR = exactRarity === 'LR';
        const rarity = isLR ? 'LR' : (exactRarity === 'TUR' ? 'TUR' : 'SSR');
        const isSEZA = mode === 'seza';
        const isEZA = mode === 'eza' || mode === 'seza';

        applyThemeColors(cardType);
        calculateStats(card.hp || card.stat_hp_max, card.atk || card.stat_atk_max, card.def || card.stat_def_max, cardType, isEZA);

        const artHeaderEl = document.getElementById("abs-art-header-text");
        const unitTag = getCardUnitTag(card);
        if (artHeaderEl) artHeaderEl.textContent = unitTag;

        const { title, name } = parseTitleAndName(card);
        const titleEl = document.getElementById("abs-char-title");
        const nameEl = document.getElementById("abs-char-name");

        if (titleEl) {
            titleEl.textContent = title || "";
            titleEl.style.display = title ? "block" : "none";
        }
        if (nameEl) nameEl.textContent = name || "Unknown Character";

        const { bgUrl, charUrl, effectUrl, thumbUrl } = resolveCardAssets(card);

        const fullCardTitle = title ? `[${title}] ${name}` : (name || "Character Inspector");
        document.title = `${fullCardTitle} | absCustom`;

        let favicon = document.querySelector("link[rel*='icon']");
        if (!favicon) {
            favicon = document.createElement('link');
            favicon.rel = 'icon';
            document.head.appendChild(favicon);
        }
        if (thumbUrl) favicon.href = thumbUrl;

        // Leader Skill Title with (Extreme) or (Super Extreme)
        const leadTitleEl = document.getElementById("abs-leader-title");
        if (leadTitleEl) {
            let leadTitle = "Leader Skill";
            if (isSEZA) leadTitle += " (Super Extreme)";
            else if (isEZA) leadTitle += " (Extreme)";
            leadTitleEl.textContent = leadTitle;
        }

        // Leader Skill Content
        const leaderObj = findLeaderObj(card, mode);
        const rawLeader = leaderObj ? (leaderObj.description || leaderObj.effect || leaderObj.details) : (card.leader_skill || "");
        const leaderEl = document.getElementById("abs-leader-skill");
        if (leaderEl) leaderEl.innerHTML = formatOfficialText(rawLeader, true).replace(/\n/g, ' ').trim();

        // Passive Skill
        const passiveObj = getCardPassiveObject(card, mode);
        let pName = passiveObj.name || "Passive Skill";
        pName = pName.replace(/\s*\(Extreme.*?\)$/i, '').replace(/\s*\(Super Extreme.*?\)$/i, '').trim();

        if (isSEZA) pName += " (Super Extreme)";
        else if (isEZA) pName += " (Extreme)";

        const passText = passiveObj.itemized_description || passiveObj.description || "";
        const passiveIconsStripHtml = renderPassiveIconsStrip(passText, card);

        document.getElementById("abs-passive-name").innerHTML = `
            <div class="abs-passive-header-title">
                <span>Passive Skill</span>
                <span class="mx-1">&ndash;</span>
                <i>${pName}</i>
            </div>
            ${passiveIconsStripHtml}
        `;
        document.getElementById("abs-passive-container").innerHTML = parsePassiveSections(passText);

        renderSuperAttacks(card, isEZA, mode);
        renderActiveSkills(card);
        renderDokkanFields(card);
        renderStandbySkills(card);
        renderFinishSkills(card);

        // Links
        const linksHtml = (card.links || card.link_skill_ids || []).map(linkItem => {
            let linkName = typeof linkItem === 'object' ? linkItem.name : (DB.links && DB.links[linkItem] ? DB.links[linkItem].name : "Link");
            let linkObj = DB.links ? Object.values(DB.links).find(l => l.name === linkName) : null;
            let lv10Desc = window.getLinkSkillLevel10Description?.(linkName, linkObj) || '';
            let tooltip = window.escapeLinkTooltipAttribute?.(lv10Desc) || lv10Desc;
            let tooltipAttr = lv10Desc ? ` data-tooltip="${tooltip}"` : '';
            return `
                <div class="abs-link-badge"${tooltipAttr}>
                    <div class="abs-link-lv">
                        <span class="lv-text">Lv</span>
                        <span class="num-text">10</span>
                    </div>
                    <div class="abs-link-name">${linkName}</div>
                </div>
            `;
        }).join('');
        document.getElementById("abs-link-container").innerHTML = linksHtml;

        // Categories
        const catsHtml = (card.categories || card.category_ids || []).map(catId => {
            const padId = catId < 10 ? '000' + catId : (catId < 100 ? '00' + catId : catId);
            return `<img src="${CENTRAL_ASSET_URL}card_category_label_${padId}_b_on.png">`;
        }).join('');
        document.getElementById("abs-category-container").innerHTML = catsHtml;

        // Static Layers
        const bgImgEl = document.getElementById("abs-art-bg");
        const charImgEl = document.getElementById("abs-art-char");
        const effectImgEl = document.getElementById("abs-art-effect");
        const thumbImgEl = document.getElementById("abs-thumb-img");

        if (bgImgEl) { 
            delete bgImgEl.dataset.failed; 
            bgImgEl.style.display = 'block'; 
            bgImgEl.src = bgUrl; 
        }
        if (charImgEl) { 
            delete charImgEl.dataset.failed; 
            charImgEl.style.display = 'block'; 
            charImgEl.src = charUrl; 
        }
        if (effectImgEl) { 
            delete effectImgEl.dataset.failed; 
            effectImgEl.style.display = effectUrl ? 'block' : 'none'; 
            effectImgEl.src = effectUrl; 
        }
        if (thumbImgEl) { 
            delete thumbImgEl.dataset.failed; 
            thumbImgEl.src = thumbUrl; 
        }

        const frameEl = document.getElementById("abs-frame-img");
        if (frameEl) frameEl.src = `${CENTRAL_ASSET_URL}frame_${cardType}.png`;

        const topTypeEl = document.getElementById("abs-top-type-icon");
        if (topTypeEl) topTypeEl.src = `${CENTRAL_ASSET_URL}${cardClass}_type_${cardType}.png`;

        const rarityImg = `${CENTRAL_ASSET_URL}rarity_${isLR ? 'lr' : (rarity === 'TUR' ? 'TUR' : 'ssr')}_abs.png`;

        const topRarityEl = document.getElementById("abs-top-rarity-icon");
        if (topRarityEl) topRarityEl.src = rarityImg;

        // SEZA Burning Flame Border
        const topComposedIcon = document.getElementById('abs-composed-icon');
        if (topComposedIcon) {
            topComposedIcon.classList.toggle('seza-glow-card', isSEZA);
            if (isSEZA && typeof window.DokkanLWF !== 'undefined') {
                window.DokkanLWF.attachSezaFlameBorder(topComposedIcon, cardType);
            } else {
                const existingCanvas = topComposedIcon.querySelector('.seza-lwf-border-canvas');
                if (existingCanvas) existingCanvas.remove();
            }
        }

        // Lightning FX
        const topLightning = document.getElementById('abs-lightning');
        if (topLightning) {
            if (isLR) {
                topLightning.style.display = 'block';
                topLightning.style.setProperty('--lightning-color', lightningColors[cardType] || 'rgb(0, 150, 255)');
            } else {
                topLightning.style.display = 'none';
            }
        }

        const absAwakeningSrc = isSEZA ? `${CENTRAL_ASSET_URL}superza_abs.png` : (isEZA ? `${CENTRAL_ASSET_URL}eza_abs.png` : null);
        const dbEzaImg = document.getElementById('abs-awakening-img');

        if (absAwakeningSrc && isEZA) {
            if (dbEzaImg) { dbEzaImg.src = absAwakeningSrc; dbEzaImg.style.display = 'block'; }
        } else {
            if (dbEzaImg) dbEzaImg.style.display = 'none';
        }

        const spinDial = document.getElementById('abs-spin-dial');
        if (spinDial) spinDial.style.display = isLR ? 'block' : 'none';

        renderLinkingPartners(card);
        updateToggleBarActiveButtons(mode); 

        updateCardArtAnimation(card);

        if (typeof window.DokkanLWF !== 'undefined' && window.DokkanLWF.setupDomainCardArtHover) {
            window.DokkanLWF.setupDomainCardArtHover(card);
        }
        
    } catch (err) {
        console.error("Error in renderCardDetails:", err);
    }
}

window.switchCardArtMode = function(mode) {
    currentCardArtMode = mode;
    const artBox = document.getElementById('abs-art-layers-container');
    const staticBtn = document.getElementById('art-toggle-static');
    const animatedBtn = document.getElementById('art-toggle-animated');
    const lwfCanvas = document.getElementById('abs-card-bg-lwf-canvas');
    const stickerCanvas = document.getElementById('abs-tur-sticker-canvas');
    const bgImgEl = document.getElementById('abs-art-bg');
    const charImgEl = document.getElementById('abs-art-char');
    const effectImgEl = document.getElementById('abs-art-effect');

    if (staticBtn) staticBtn.classList.toggle('active', mode === 'static');
    if (animatedBtn) animatedBtn.classList.toggle('active', mode === 'animated');

    if (artBox) {
        if (mode === 'static') {
            artBox.classList.add('static-mode');
            artBox.classList.remove('animated-mode', 'sticker-active', 'is-lr-anim', 'is-sticker-anim');

            if (bgImgEl && bgImgEl.src && !bgImgEl.dataset.failed) bgImgEl.style.display = 'block';
            if (charImgEl) charImgEl.style.display = 'block';
            if (effectImgEl && effectImgEl.src && !effectImgEl.dataset.failed) effectImgEl.style.display = 'block';

            if (lwfCanvas) {
                lwfCanvas.style.display = 'none';
                if (window.DokkanLWF) window.DokkanLWF.pause(lwfCanvas.id || 'abs-card-bg-lwf-canvas');
            }
            if (stickerCanvas) {
                stickerCanvas.style.display = 'none';
                if (activeStickerRunner) activeStickerRunner.pause();
            }
        } else {
            artBox.classList.add('animated-mode');
            artBox.classList.remove('static-mode');

            if (currentCardAnimType === 'lr') {
                artBox.classList.add('is-lr-anim');
                artBox.classList.remove('is-sticker-anim', 'sticker-active');
                if (bgImgEl) bgImgEl.style.display = 'none';
                if (charImgEl) charImgEl.style.display = 'none';
                if (effectImgEl) effectImgEl.style.display = 'none';
                
                if (lwfCanvas) {
                    lwfCanvas.style.display = 'block';
                    if (window.DokkanLWF) window.DokkanLWF.play(lwfCanvas.id || 'abs-card-bg-lwf-canvas');
                }
                if (stickerCanvas) stickerCanvas.style.display = 'none';
            } else {
                artBox.classList.add('sticker-active', 'is-sticker-anim');
                artBox.classList.remove('is-lr-anim');

                if (bgImgEl && bgImgEl.src && !bgImgEl.dataset.failed) bgImgEl.style.display = 'block';
                if (charImgEl) charImgEl.style.display = 'block';
                if (effectImgEl && effectImgEl.src && !effectImgEl.dataset.failed) effectImgEl.style.display = 'block';

                if (stickerCanvas) {
                    stickerCanvas.style.display = 'block';
                    if (activeStickerRunner) activeStickerRunner.play();
                }
                if (lwfCanvas) {
                    lwfCanvas.style.display = 'none';
                    if (window.DokkanLWF) window.DokkanLWF.pause(lwfCanvas.id || 'abs-card-bg-lwf-canvas');
                }
            }
        }
    }
};

async function updateCardArtAnimation(card) {
    const lwfCanvas = document.getElementById('abs-card-bg-lwf-canvas');
    const stickerCanvas = document.getElementById('abs-tur-sticker-canvas');
    const toggleBar = document.getElementById('abs-art-toggle-bar');
    const artBox = document.getElementById('abs-art-layers-container');
    if (!artBox) return;

    if (activeStickerRunner) {
        activeStickerRunner.destroy();
        activeStickerRunner = null;
    }

    if (typeof window.DokkanLWF !== 'undefined' && lwfCanvas) {
        window.DokkanLWF.destroy(lwfCanvas.id || 'abs-card-bg-lwf-canvas');
    }

    const isLR = isCardLR(card);
    const folderId = (typeof getCardFolderId === 'function') ? getCardFolderId(card) : Math.floor(parseInt(card.id, 10) / 10) * 10;
    const rootId = getRootParentId(card);
    const parentFolderId = Math.floor(rootId / 10) * 10;

    let hasAnimated = false;
    currentCardAnimType = null;

    if (isLR && lwfCanvas && typeof window.DokkanLWF !== 'undefined' && window.DokkanLWF.attachCardBgLwf) {
        let ok = await window.DokkanLWF.attachCardBgLwf(lwfCanvas, card);
        if (ok) {
            hasAnimated = true;
            currentCardAnimType = 'lr';
        }
    }

    if (!hasAnimated && stickerCanvas && window.DokkanStickerRunner) {
        try {
            stickerCanvas.width = 426;
            stickerCanvas.height = 568;
            const runner = new window.DokkanStickerRunner(stickerCanvas);
            let ok = await runner.loadConfig(folderId, card);
            if (!ok && parentFolderId !== folderId) {
                ok = await runner.loadConfig(parentFolderId, card);
            }

            if (ok) {
                activeStickerRunner = runner;
                hasAnimated = true;
                currentCardAnimType = 'sticker';
            } else {
                runner.destroy();
            }
        } catch(e) {
            console.warn("[Sticker Runner Error]", e);
        }
    }

    if (toggleBar) {
        toggleBar.style.display = hasAnimated ? 'block' : 'none';
    }

    if (hasAnimated) {
        window.switchCardArtMode(currentCardArtMode || 'animated');
    } else {
        window.switchCardArtMode('static');
    }
}

async function startViewer() {
    try {
        await loadDokkanDatabase();
        if (DB.cards && !Array.isArray(DB.cards)) DB.cards = Object.values(DB.cards);
        
        const urlParams = new URLSearchParams(window.location.search);
        const cardIdParam = parseInt(urlParams.get('id') || urlParams.get('card') || '1032881', 10);
        const modeParam = urlParams.get('mode') || null;
        
        selectCard(cardIdParam, false, modeParam);
    } catch(e) {
        console.error("Error starting viewer:", e);
    }
}

document.addEventListener('DOMContentLoaded', startViewer);
