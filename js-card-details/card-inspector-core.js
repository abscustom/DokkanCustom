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

    if (slider && idx !== -1) {
        slider.value = idx;
        slider.style.setProperty('--abs-stat-progress', `${(idx / (STAT_MILESTONES.length - 1)) * 100}%`);
    }
    document.querySelectorAll('.abs-slider-ticks span').forEach((tick, tickIndex) => {
        tick.classList.toggle('is-active', tickIndex === idx);
    });
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

        const newUrl = `card.html?viewer=1&id=${base7Id}&mode=${mode}`;
        window.history.replaceState({ cardId: selectedCard.id, mode }, '', newUrl);
        window.persistViewerSelection?.(base7Id, mode);
        window.renderViewerCardPicker?.();

        renderCardDetails(selectedCard, mode);
        updateToggleBarActiveButtons(mode);
    }
}





/* ==========================================================================
   DEDICATED TRANSFORMATIONS RESOLVER (CARDS 4000000..4999999)
   ========================================================================== */
const TRANSFORMATION_NAME_NOISE = new Set([
    'super', 'saiyan', 'god', 'full', 'power', 'form', 'the', 'and',
    'with', 'from', 'teen', 'youth', 'angel', 'giant', 'great',
]);
const VERIFIED_TRANSFORM_PARENT_CACHE = new Map();

function getTransformationNameTokens(card) {
    return new Set(
        String(card?.name || '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, ' ')
            .split(/\s+/)
            .filter((token) => token.length >= 3 && !TRANSFORMATION_NAME_NOISE.has(token)),
    );
}

function findVerifiedTransformationParentId(transformRecord) {
    const transformId = normalizeViewerCardId(transformRecord);
    if (transformId < 4000000 || transformId >= 5000000 || !Array.isArray(DB?.cards)) return 0;
    if (VERIFIED_TRANSFORM_PARENT_CACHE.has(transformId)) {
        return VERIFIED_TRANSFORM_PARENT_CACHE.get(transformId);
    }

    const transform = DB.cards.find((card) => parseInt(card.id, 10) === transformId) || transformRecord;
    const transformTokens = getTransformationNameTokens(transform);
    const transformLeadId = Number(transform?.lead_id || transform?.leader_skill_set_id || 0);
    const transformGrowth = Number(transform?.optimal_awakening_grow_type || 0);
    const transformParentId = normalizeViewerCardId(transform?.parent_id || 0);
    const transformIsLR = isCardLR(transform);
    const transformCharacterId = Number(transform?.character_id || 0);
    const transformUniqueInfoId = Number(transform?.card_unique_info_id || 0);
    const candidates = [];

    DB.cards.forEach((candidate) => {
        const candidateId = normalizeViewerCardId(candidate);
        const candidateTextId = String(candidate?.id || '');
        if (!candidateId || candidateId === transformId || candidateId >= 4000000) return;
        if (candidateTextId.length >= 8 && /[89]$/.test(candidateTextId)) return;

        const candidateTokens = getTransformationNameTokens(candidate);
        const sharesName = [...transformTokens].some((token) => candidateTokens.has(token));
        const sharesIdentity =
            (transformCharacterId > 0 && Number(candidate?.character_id || 0) === transformCharacterId)
            || (transformUniqueInfoId > 0 && Number(candidate?.card_unique_info_id || 0) === transformUniqueInfoId);
        const sameLeader = transformLeadId > 0 && Number(candidate?.lead_id || candidate?.leader_skill_set_id || 0) === transformLeadId;
        const isTrustedDirectParent = candidateId === transformParentId && (sharesName || sharesIdentity);

        // A name overlap by itself is not safe (there are many Vegetas and
        // Gokus). A transform requires either its shared leader family or a
        // direct parent whose character/name identity independently agrees.
        if ((!sameLeader && !isTrustedDirectParent) || (!sharesName && !sharesIdentity)) return;

        let score = 0;
        if (sameLeader) score += 90;
        if (isTrustedDirectParent) score += 80;
        if (sharesName) score += 35;
        if (sharesIdentity) score += 30;
        if (isCardLR(candidate) === transformIsLR) score += 20;
        if (Number(candidate?.cost || 0) === Number(transform?.cost || 0)) score += 10;
        if (Number(candidate?.max_level || candidate?.lv_max || 0) === Number(transform?.max_level || transform?.lv_max || 0)) score += 10;

        const candidateGrowth = Number(candidate?.optimal_awakening_grow_type || 0);
        if (transformGrowth > 0 && candidateGrowth > 0 && Math.abs(transformGrowth - candidateGrowth) === 1) score += 25;
        candidates.push({ id: candidateId, score });
    });

    candidates.sort((left, right) => right.score - left.score || right.id - left.id);
    const best = candidates[0];
    const runnerUp = candidates[1];
    // Require a strong, unambiguous match. If the exported database cannot
    // prove a relation, returning 0 is safer than showing a wrong form.
    const verifiedId = best && best.score >= 135 && (!runnerUp || best.score - runnerUp.score >= 18)
        ? best.id
        : 0;
    VERIFIED_TRANSFORM_PARENT_CACHE.set(transformId, verifiedId);
    return verifiedId;
}

function getUnitTransformations(targetCard, parentMax) {
    if (!DB || !DB.cards || !targetCard) return [];

    const targetId = parseInt(targetCard.id, 10);
    const normTargetId = targetId > 10000000 ? Math.floor(targetId / 10) : targetId;
    const viewingTransformedForm = normTargetId >= 4000000 && normTargetId < 5000000;

    // A transformed form is already the destination form.  The exporter used
    // to give several unrelated celebration transforms the same guessed
    // parent_id, so walking back through that field makes a transformed
    // Vegito/Gogeta show a random card's other transform.  Leave the form's
    // own presentation alone; its verified base/awakening data is handled by
    // getFullUnitNetwork instead.
    if (viewingTransformedForm) return [];

    const rootBaseId = normTargetId;

    const baseCard = DB.cards.find(c => parseInt(c.id, 10) === rootBaseId) || targetCard;
    const baseNormId = parseInt(baseCard.id, 10) > 10000000 ? Math.floor(parseInt(baseCard.id, 10) / 10) : parseInt(baseCard.id, 10);
    const baseStem6 = Math.floor(baseNormId / 10); // e.g. 101825 for Cooler
    const targetCharId = parseInt(baseCard.character_id || targetCard.character_id || 0, 10);
    const targetUniqueInfoId = parseInt(baseCard.card_unique_info_id || targetCard.card_unique_info_id || 0, 10);
    const significantNameTokens = getTransformationNameTokens(baseCard || targetCard);

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
        const cNameTokens = String(c.name || '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, ' ')
            .split(/\s+/)
            .filter(Boolean);
        const sharesIdentity =
            (targetCharId > 0 && cCharId === targetCharId)
            || (targetUniqueInfoId > 0 && cUniqueInfoId === targetUniqueInfoId)
            || cNameTokens.some((token) => significantNameTokens.has(token));
        const verifiedParentId = findVerifiedTransformationParentId(c);
        const isVerifiedPair = verifiedParentId === baseNormId;

        // Transformation match conditions
        const isMatch = isVerifiedPair || (cBaseStem6 === baseStem6) ||
                        // parent_id is useful only when the actual character
                        // identity agrees.  It is not an authoritative
                        // transform relation in older exported JSON.
                        (sharesIdentity && cParentId > 0 && (cParentId === baseNormId || cParentId === targetId || Math.floor(cParentId / 10) === baseStem6)) ||
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

/* ===========================================================================
   ROUTE-BASED AWAKENING RESOLVER

   Card IDs are not a lineage.  SSR/TUR/LR stages are often hundreds of IDs
   apart, while a transformation's synthetic parent can point at a different
   physical unit entirely.  The database's card_awakening_routes export is the
   authoritative relationship, so use that graph rather than stem proximity.
   =========================================================================== */
function normalizeViewerCardId(cardOrId) {
    const raw = typeof cardOrId === 'object'
        ? parseInt(cardOrId?.id, 10)
        : parseInt(cardOrId, 10);
    if (!Number.isFinite(raw) || raw <= 0) return 0;
    return raw > 10000000 ? Math.floor(raw / 10) : raw;
}

function getAwakeningRouteFamilyIds(cardId) {
    const start = normalizeViewerCardId(cardId);
    const family = new Set(start ? [start] : []);
    const routes = Array.isArray(DB?.awakeningRoutes) ? DB.awakeningRoutes : [];
    if (!start || !routes.length) return family;

    const neighbors = new Map();
    const add = (from, to) => {
        if (!from || !to || from === to) return;
        if (!neighbors.has(from)) neighbors.set(from, new Set());
        neighbors.get(from).add(to);
    };

    routes.forEach(route => {
        const from = normalizeViewerCardId(route?.card_id);
        const to = normalizeViewerCardId(route?.awaked_card_id);
        add(from, to);
        add(to, from);
    });

    const queue = [...family];
    while (queue.length) {
        const current = queue.shift();
        for (const next of neighbors.get(current) || []) {
            if (family.has(next)) continue;
            family.add(next);
            queue.push(next);
        }
    }
    return family;
}

function getFullUnitNetwork(targetCard) {
    if (!DB || !DB.cards || !targetCard) return { baseProgression: [], transformations: [], ezas: [], sezas: [] };

    const normTargetId = normalizeViewerCardId(targetCard);
    const isTransformedForm = normTargetId >= 4000000 && normTargetId < 5000000;
    // A transformed card keeps its own displayed data, but its awakening
    // panel belongs to the physical unit that produced it. Resolve that
    // physical parent using the same strict verifier used for transformation
    // links. This lets an EZA/SEZA transform show the base SSR → TUR → LR
    // route and its sibling transformations, without trusting a stale guessed
    // parent_id or borrowing the transformed card's leader/passive/tag.
    const physicalBaseId = isTransformedForm
        ? (findVerifiedTransformationParentId(targetCard) || normTargetId)
        : normTargetId;
    const familyIds = getAwakeningRouteFamilyIds(physicalBaseId);
    const baseCard = DB.cards.find(c => normalizeViewerCardId(c) === physicalBaseId) || targetCard;

    const baseProgression = [];
    const ezas = [];
    const sezas = [];
    DB.cards.forEach(c => {
        const cardId = parseInt(c.id, 10);
        const normalizedId = normalizeViewerCardId(c);
        if (!familyIds.has(normalizedId)) return;
        // Transformations are shown separately below. The route tree itself
        // must only contain the actual awakening stages of the base unit.
        if (normalizedId >= 4000000 && normalizedId < 5000000) {
            return;
        }

        const idText = String(cardId);
        const isEza = Boolean(c.is_eza) || (idText.length >= 8 && idText.endsWith('8'));
        const isSeza = Boolean(c.is_seza) || (idText.length >= 8 && idText.endsWith('9'));
        const collection = isSeza ? sezas : (isEza ? ezas : baseProgression);
        if (!collection.some(existing => parseInt(existing.id, 10) === cardId)) collection.push(c);
    });

    if (!baseProgression.some(c => normalizeViewerCardId(c) === physicalBaseId)) {
        baseProgression.push(baseCard);
    }
    baseProgression.sort((a, b) => getCardPowerRank(a) - getCardPowerRank(b) || a.id - b.id);

    // Keep one card per actual rarity tier, retaining the highest-stat record
    // when data contains parallel versions of that tier.
    const distinctProgression = [];
    const seenTiers = new Set();
    for (let index = baseProgression.length - 1; index >= 0; index -= 1) {
        const item = baseProgression[index];
        const rarity = getCardExactRarity(item);
        if (seenTiers.has(rarity)) continue;
        seenTiers.add(rarity);
        distinctProgression.unshift(item);
    }

    const finalProgression = distinctProgression.length ? distinctProgression : [baseCard];
    const parentMax = finalProgression[finalProgression.length - 1];
    const transformations = getUnitTransformations(baseCard, parentMax);
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

    // `optimal_awakening_growths` is keyed by a growth-group id, not by a
    // card id or the numeric EZA/SEZA mode. It therefore cannot by itself tell
    // us that a toggle card exists. Use the actual card rows as the source of
    // truth so a base card does not grow a phantom EZA/SEZA button.
    const familyRootId = normalizeViewerCardId(base || card);
    const familyRows = DB.cards.filter(candidate => {
        const candidateId = normalizeViewerCardId(candidate);
        const candidateParentId = normalizeViewerCardId(candidate?.parent_id);
        return candidateId === familyRootId
            || candidateParentId === familyRootId
            || normalizeViewerCardId(getRootParentId(candidate)) === familyRootId;
    });
    const isViewerEzaRow = candidate => {
        const candidateId = String(candidate?.id || '');
        return Boolean(candidate?.is_eza || candidate?.is_eza_awakened || candidate?.eza_type === 1)
            || (candidateId.length >= 8 && candidateId.endsWith('8'));
    };
    const isViewerSezaRow = candidate => {
        const candidateId = String(candidate?.id || '');
        return Boolean(candidate?.is_seza || candidate?.is_super_eza || candidate?.eza_type === 2)
            || (candidateId.length >= 8 && candidateId.endsWith('9'));
    };
    const familyHasSeza = Boolean(seza)
        || network.sezas.some(Boolean)
        || familyRows.some(isViewerSezaRow);
    const familyHasEza = Boolean(eza)
        || network.ezas.some(Boolean)
        || familyRows.some(isViewerEzaRow)
        || familyHasSeza;

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

    const activeTip = document.getElementById('card-info-tooltip');
    if (activeTip) {
        activeTip.style.opacity = '0';
        activeTip.style.display = 'none';
    }

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
    window.updateViewerMotion?.(selectedCard);

    const cardIdToUrl = isTransformedCard(selectedCard) ? (String(selectedCard.id).length >= 8 ? String(selectedCard.id).substring(0, 7) : selectedCard.id) : (selectedCard.id);
    const newUrl = `card.html?viewer=1&id=${cardIdToUrl}&mode=${mode}`;
    window.history.replaceState({ cardId: selectedCard.id, mode }, '', newUrl);
    window.persistViewerSelection?.(cardIdToUrl, mode);
    window.renderViewerCardPicker?.();

    // =========================================================================
    // 1. COMPLETE DYNAMIC AWAKENINGS TREE (SHARED ACROSS ALL FORMS)
    // =========================================================================
    renderAwakeningAndTransformationTrees(mode);

    window.syncAbsCleanAwakeningFormsPlacement?.();
    updateToggleBarActiveButtons(mode);
}

function renderAwakeningAndTransformationTrees(mode = currentEzaMode) {
    if (!selectedCard) return;
    const siblings = getCardSiblings(selectedCard);
    const network = getFullUnitNetwork(selectedCard);
    const awakenCont = document.getElementById('abs-awakenings-container');
    let awHTML = '';

    const buildStepDivider = (imgName, fallbackText) => {
        if (document.body.classList.contains('theme-abs-clean')) {
            return '<div class="abs-awaken-divider"></div>';
        }
        return `
            <div class="abs-awaken-divider">
                <img src="${CENTRAL_ASSET_URL}${imgName}" onerror="this.outerHTML='<span class=\\'abs-awaken-divider-text\\'>${fallbackText}</span>'">
            </div>
        `;
    };

    const buildNodeRow = (c, customLabel = "Release Date:", nodeMode = 'base') => {
        const trueDate = getCardExactReleaseDate(c, nodeMode);
        const exactRar = (typeof getCardExactRarity === 'function') ? getCardExactRarity(c) : 'SSR';
        const isSelected = (parseInt(c.id, 10) === parseInt(selectedCard.id, 10));
        const isClean = document.body.classList.contains('theme-abs-clean');
        const candidateDate = (trueDate && trueDate !== 'TBD')
            ? trueDate
            : (c.release_date || c.open_at || selectedCard?.release_date || selectedCard?.open_at || 'TBD');
        const formattedDate = formatESTDateWithTime(candidateDate);
        const dateMarkup = isClean
            ? ''
            : `<div class="abs-awaken-date">
                ${customLabel}<br>
                <span style="color: #a1a1aa; font-weight: normal; font-size: 12px;">${formattedDate}</span>
            </div>`;
        const { title: nodeTitle, name: nodeName } = (typeof parseTitleAndName === 'function')
            ? parseTitleAndName(c)
            : { title: '', name: c.name };
        const nodeDisplayLabel = nodeTitle ? `[${nodeTitle}] ${nodeName}` : (c.name || exactRar);
        const safeTooltip = window.escapeLinkTooltipAttribute?.(nodeDisplayLabel) || String(nodeDisplayLabel).replace(/"/g, '&quot;');
        const tooltipAttr = isClean ? ` data-tooltip="${safeTooltip}"` : '';
        
        return `
        <div class="abs-awaken-row cursor-pointer ${isSelected ? 'is-active selected-form-glow' : ''}"${tooltipAttr} onclick="selectCard(${c.id}, false, '${nodeMode}')">
            ${buildComposedIcon(c, exactRar === 'SSR', nodeMode)}
            ${dateMarkup}
        </div>
        `;
    };

    // 1. Render all Base Evolution Steps in Progression Order (SSR -> TUR -> LR)
    const progression = network.baseProgression || [siblings.base || selectedCard];
    const selectedExactRarity = (typeof getCardExactRarity === 'function')
        ? getCardExactRarity(selectedCard)
        : '';

    progression.forEach((progCard, pIdx) => {
        if (pIdx > 0) {
            const currRar = (typeof getCardExactRarity === 'function') ? getCardExactRarity(progCard) : 'TUR';

            const isFirstBaseArrow = pIdx === 1;
            const isDokkanStep = !isFirstBaseArrow || selectedExactRarity === 'TUR';
            const logoName = isDokkanStep ? 'dokkan-awaken.png' : 'z-awaken.png';
            const fallbackText = currRar === 'LR' && isDokkanStep
                ? 'LEGENDARY AWAKEN'
                : (isDokkanStep ? 'DOKKAN AWAKEN' : 'Z-AWAKEN');
            awHTML += buildStepDivider(logoName, fallbackText);
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

    const isAbsCleanTheme = document.body.classList.contains('theme-abs-clean') || document.getElementById('app')?.classList.contains('theme-abs-clean');
    const formsForRender = isAbsCleanTheme
        ? [selectedCard, ...otherFamilyForms].filter(Boolean)
        : otherFamilyForms;

    if (formsForRender.length > 0 && (isAbsCleanTheme || (otherFamilyForms.length > 0 && allFamilyForms.length > 1))) {
        if (transBox) transBox.classList.remove('d-none');
        let trHTML = '';
        formsForRender.forEach((tc, idx) => {
            if (idx > 0) trHTML += `<div class="abs-transform-divider"></div>`;
            const tcId = parseInt(tc.id, 10);
            let targetNavId = tcId;
            if (mode === 'seza' && siblings.hasSeza) targetNavId = parseInt(String(tcId).substring(0, 7) + '9', 10);
            else if ((mode === 'eza' || mode === 'seza') && siblings.hasEza) targetNavId = parseInt(String(tcId).substring(0, 7) + '8', 10);

            const { title: tcTitle, name: tcName } = parseTitleAndName(tc);
            const displayLabel = tcTitle ? `[${tcTitle}] ${tcName}` : tc.name;
            const fId = parseInt(tc.id, 10);
            const normFId = fId > 10000000 ? Math.floor(fId / 10) : fId;
            const isActiveForm = isAbsCleanTheme && normFId === normCurrentId;
            const safeTooltip = window.escapeLinkTooltipAttribute?.(displayLabel) || String(displayLabel).replace(/"/g, '&quot;');
            const tooltipAttr = isAbsCleanTheme ? ` data-tooltip="${safeTooltip}"` : '';

            trHTML += `
                <div class="abs-transform-row cursor-pointer${isActiveForm ? ' is-active' : ''}"${tooltipAttr} onclick="selectCard(${targetNavId}, false, '${mode}')">
                    <div style="display:flex; align-items:center; width:100%;">
                        ${buildComposedIcon(tc, false, mode, isAbsCleanTheme ? 'abs-clean-form-icon' : '')}
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
}
window.renderAwakeningAndTransformationTrees = renderAwakeningAndTransformationTrees;

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
function getViewerLeaderRecords() {
    if (!DB?.leaders) return [];
    return Array.isArray(DB.leaders) ? DB.leaders : Object.values(DB.leaders);
}

function lookupViewerLeader(leaderId) {
    const numericId = Number(leaderId);
    if (!Number.isFinite(numericId) || numericId <= 0 || !DB?.leaders) return null;

    const keyed = DB.leaders[String(numericId)] || DB.leaders[numericId];
    if (keyed && typeof keyed === 'object') return keyed;

    return getViewerLeaderRecords().find((leader) => Number(
        leader?.id ?? leader?.leader_skill_set_id ?? leader?.set_id ?? 0
    ) === numericId) || null;
}

function getViewerLeaderFamilyName(name) {
    return String(name || '')
        .replace(/\s*\(Super Extreme.*?\)$/i, '')
        .replace(/\s*\(Extreme.*?\)$/i, '')
        .trim()
        .toLowerCase();
}

function getViewerOptimalLeader(card, mode) {
    if (!card || !Array.isArray(DB?.optimalAwakeningGrowths) || mode === 'base') return null;

    const siblings = typeof getCardSiblings === 'function' ? getCardSiblings(card) : null;
    const modeCard = mode === 'seza' ? (siblings?.seza || card) : (siblings?.eza || card);
    const modeCardId = String(modeCard?.id || '');
    const isModeCard = mode === 'seza'
        ? Boolean(modeCard?.is_seza || modeCard?.is_super_eza || modeCard?.eza_type === 2 || modeCardId.endsWith('9'))
        : Boolean(modeCard?.is_eza || modeCard?.is_eza_awakened || modeCard?.eza_type === 1 || modeCardId.endsWith('8'));
    if (!isModeCard) return null;
    const groupId = Number(
        modeCard?.optimal_awakening_grow_type
        || card?.optimal_awakening_grow_type
        || 0
    );
    if (!Number.isFinite(groupId) || groupId <= 0) return null;

    const growths = DB.optimalAwakeningGrowths
        .filter((growth) => Number(growth?.optimal_awakening_grow_type) === groupId && growth?.leader_skill_set_id)
        .sort((left, right) => Number(left?.step || 0) - Number(right?.step || 0));
    const finalGrowth = growths[growths.length - 1];
    return finalGrowth ? lookupViewerLeader(finalGrowth.leader_skill_set_id) : null;
}

function findLeaderObj(card, mode = currentEzaMode) {
    if (!DB || !DB.leaders || !card) return null;

    const cardId = Number(card.id || 0);
    const idStr = String(card.id || '');
    const normalizedId = cardId > 10000000 ? Math.floor(cardId / 10) : cardId;
    const baseFormId = idStr.length >= 8 ? Number(idStr.substring(0, 7)) : normalizedId;
    const exactBaseForm = Number.isFinite(baseFormId) && Array.isArray(DB.cards)
        ? DB.cards.find((candidate) => Number(candidate?.id) === baseFormId)
        : null;
    const isTransformedForm = normalizedId >= 4000000 && normalizedId < 5000000;

    // The optimal-awakening export contains the final EZA/SEZA leader id even
    // when the card row still points at the pre-awakening leader id. Prefer it
    // for those modes, then fall back to the selected card's direct id.
    const optimalLeader = getViewerOptimalLeader(card, mode);
    if (optimalLeader) return optimalLeader;

    // The selected card already carries the correct leader id for most rows.
    // Check it first, including string-keyed and array-shaped leader exports.
    // Transformed EZA/SEZA exports can inherit the physical parent's id, so
    // prefer the exact transformed base row when that mismatch is present.
    const borrowedTransformLeader = isTransformedForm && (mode === 'eza' || mode === 'seza') &&
        exactBaseForm?.lead_id && Number(card.lead_id) !== Number(exactBaseForm.lead_id);
    const directCandidates = borrowedTransformLeader
        ? [exactBaseForm, card]
        : [card];
    const directLeader = directCandidates
        .map((candidate) => lookupViewerLeader(
            candidate?.lead_id ?? candidate?.leader_skill_set_id ?? candidate?.leader_skill_id
        ))
        .find(Boolean);
    if (directLeader) return directLeader;

    const siblings = typeof getCardSiblings === 'function' ? getCardSiblings(card) : null;
    const modeCard = mode === 'seza' ? siblings?.seza : (mode === 'eza' ? siblings?.eza : siblings?.base);
    const fallbackCard = modeCard || (borrowedTransformLeader ? exactBaseForm : card);
    const fallbackLeader = lookupViewerLeader(
        fallbackCard?.lead_id ?? fallbackCard?.leader_skill_set_id ?? fallbackCard?.leader_skill_id
    );
    let leadObj = fallbackLeader;

    if (leadObj) {
        const rootName = getViewerLeaderFamilyName(leadObj.name);

        const allLeaders = getViewerLeaderRecords();
        const family = allLeaders.filter(l => {
            if (!l || !l.name) return false;
            return getViewerLeaderFamilyName(l.name) === rootName;
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
window.findLeaderObj = findLeaderObj;

function getViewerCleanRarityAsset(rarity) {
    if (rarity === 'LR') return `${CENTRAL_ASSET_URL}rarity_lr_abs.png`;
    if (rarity === 'TUR') return `${CENTRAL_ASSET_URL}rarity_TUR_abs.png`;
    return `${CENTRAL_ASSET_URL}rarity_ssr_abs.png`;
}

function formatViewerCleanDate(value) {
    const raw = String(value || '').trim();
    if (!raw || raw === 'TBD') return 'TBD';
    const iso = raw.replace(' ', 'T') + (raw.includes('Z') ? '' : 'Z');
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return raw;
    return date.toLocaleDateString('en-US', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric'
    });
}

function normalizeViewerProgressionRarity(card) {
    const exact = String(getCardExactRarity(card) || 'SSR').toUpperCase();
    if (exact === 'LR') return 'LR';
    if (exact === 'TUR') return 'TUR';
    return 'SSR';
}

function getViewerCircleAsset(card) {
    if (!card) return { circleUrl: '', fallbackUrl: '' };
    const assets = resolveCardAssets(card) || {};
    const fallbackUrl = assets.thumbUrl || assets.artUrl || '';
    const folderId = typeof getCardFolderId === 'function' ? getCardFolderId(card) : 0;
    const circleUrl = folderId
        ? `${card.folder ? `./${card.folder}` : './assets/card-art/cards/' + folderId}/card_${folderId}_circle.png`
        : '';
    return { circleUrl, fallbackUrl };
}

function syncAbsCleanViewerLeaderPlacement() {
    const leaderBox = document.getElementById('abs-leader-skill-box');
    const cleanSlot = document.getElementById('abs-clean-leader-banner-slot');
    const legacySlot = document.getElementById('abs-leader-skill-legacy-slot');
    if (!leaderBox || !cleanSlot || !legacySlot) return;

    const isClean = document.body?.classList.contains('theme-abs-clean');
    const destination = isClean ? cleanSlot : legacySlot;
    if (leaderBox.parentElement !== destination) destination.appendChild(leaderBox);

    cleanSlot.hidden = !isClean;
    cleanSlot.setAttribute('aria-hidden', String(!isClean));
    legacySlot.setAttribute('aria-hidden', String(isClean));
}
window.syncAbsCleanLeaderPlacement = syncAbsCleanViewerLeaderPlacement;

// The published viewer starts with the identity rail in the portrait stage so
// the legacy ABS DOM remains intact. ABS.CLEAN uses the same header placement
// as the editor, but keeps the move reversible when the visitor selects
// abs.style from the viewer settings drawer.
function syncAbsCleanViewerIdentityPlacement() {
    const identity = document.getElementById('abs-clean-identity-icons');
    const portraitStage = document.getElementById('abs-clean-portrait-stage');
    const header = document.querySelector('#layout-abs-style .abs-top-header');
    if (!identity || !portraitStage || !header) return;

    if (!window.__absCleanViewerIdentityHome) {
        window.__absCleanViewerIdentityHome = {
            parent: identity.parentElement,
            next: identity.nextElementSibling
        };
    }

    const isClean = document.body?.classList.contains('theme-abs-clean');
    if (isClean) {
        identity.hidden = false;
        identity.classList.add('abs-clean-header-identity');
        if (identity.parentElement !== header || header.firstElementChild !== identity) {
            header.prepend(identity);
        }
        return;
    }

    identity.classList.remove('abs-clean-header-identity');
    identity.hidden = true;
    const home = window.__absCleanViewerIdentityHome;
    if (home?.parent && identity.parentElement !== home.parent) {
        if (home.next && home.next.parentElement === home.parent) home.parent.insertBefore(identity, home.next);
        else home.parent.appendChild(identity);
    }
}
window.syncAbsCleanViewerIdentityPlacement = syncAbsCleanViewerIdentityPlacement;

function setAbsCleanViewerEffectDisplay(element, visible) {
    if (!element) return;
    element.style.setProperty('display', visible ? 'block' : 'none', 'important');
}

function syncAbsCleanViewerEffects(nextState = null) {
    if (nextState) {
        window.__absCleanViewerEffectsState = {
            isLR: Boolean(nextState.isLR),
            isEZA: Boolean(nextState.isEZA || nextState.isSEZA),
            isSEZA: Boolean(nextState.isSEZA),
            cardType: String(nextState.cardType || 'none').toLowerCase()
        };
    }

    const state = window.__absCleanViewerEffectsState || {};
    const isClean = document.body?.classList.contains('theme-abs-clean');
    const isLR = Boolean(state.isLR);
    const isEZA = Boolean(state.isEZA);
    const isSEZA = Boolean(state.isSEZA);
    const cardType = String(state.cardType || 'none').toLowerCase();
    const layout = document.getElementById('layout-abs-style');
    const composed = document.getElementById('abs-composed-icon');
    const aura = document.getElementById('abs-clean-lr-aura');
    const lightning = document.getElementById('abs-clean-lr-lightning');
    const ring = document.getElementById('abs-clean-ring-effect');
    const legacyLightning = document.getElementById('abs-lightning');
    const legacyDial = document.getElementById('abs-spin-dial');
    const hueByType = { agl: '165deg', teq: '75deg', int: '225deg', str: '312deg', phy: '0deg' };

    if (layout) layout.dataset.cardType = cardType;
    if (composed) {
        composed.dataset.cardType = cardType;
        composed.style.setProperty('--sba-lr-fx-hue', hueByType[cardType] || '0deg');
        composed.style.setProperty('--sba-lr-aura-opacity', '0.92');
        composed.style.setProperty('--sba-lr-lightning-opacity', '1');
    }

    if (!isClean) {
        setAbsCleanViewerEffectDisplay(aura, false);
        setAbsCleanViewerEffectDisplay(lightning, false);
        setAbsCleanViewerEffectDisplay(ring, false);
        ring?.classList.remove('sba-eza-ring-effect', 'sba-seza-ring-effect');
        ring?.removeAttribute('data-awakening-fx');
        window.DokkanLWF?.pause?.(aura?.id || '');
        window.DokkanLWF?.pause?.(lightning?.id || '');
        return;
    }

    document.body.dataset.absCleanType = cardType;
    layout?.setAttribute('data-card-type', cardType);
    setAbsCleanViewerEffectDisplay(aura, isLR);
    setAbsCleanViewerEffectDisplay(lightning, isLR);
    setAbsCleanViewerEffectDisplay(ring, isEZA);

    if (isLR) {
        [aura, lightning].forEach((canvas) => {
            if (!canvas || typeof window.DokkanLWF?.attachDokkanModeLrEffect !== 'function') return;
            const result = window.DokkanLWF.attachDokkanModeLrEffect(canvas);
            result?.catch?.(() => {});
        });
        if (legacyLightning) legacyLightning.style.display = 'none';
        if (legacyDial) legacyDial.style.display = 'none';
    }

    if (ring) {
        ring.classList.toggle('sba-eza-ring-effect', isEZA && !isSEZA);
        ring.classList.toggle('sba-seza-ring-effect', isSEZA);
        if (isEZA) ring.dataset.awakeningFx = isSEZA ? 'seza' : 'eza';
        else ring.removeAttribute('data-awakening-fx');
        window.scanSbaRingEffects?.();
    }
}
window.syncAbsCleanViewerEffects = syncAbsCleanViewerEffects;

window.addEventListener('dokkan-lwf-ready', () => {
    window.requestAnimationFrame(() => window.syncAbsCleanViewerEffects?.());
});

function syncAbsCleanViewerSurfaces(card, mode, cardClass, cardType, rarity, unitTag) {
    const isClean = document.body?.classList.contains('theme-abs-clean');
    const releaseDate = document.getElementById('abs-clean-release-date');
    const nameBadges = document.getElementById('abs-clean-name-badges');
    const nameRarity = document.getElementById('abs-clean-name-rarity');
    const nameType = document.getElementById('abs-clean-name-type');
    const portraitStage = document.getElementById('abs-clean-portrait-stage');
    const identity = document.getElementById('abs-clean-identity-icons');
    const portraits = document.getElementById('abs-clean-awakening-portraits');
    const timeline = document.getElementById('abs-clean-bottom-timeline');
    syncAbsCleanViewerIdentityPlacement();

    if (!isClean) {
        [releaseDate, nameBadges, portraitStage, identity, portraits, timeline]
            .filter(Boolean)
            .forEach(element => {
                element.hidden = true;
            });
        if (releaseDate) releaseDate.innerHTML = '';
        return;
    }

    if (releaseDate) {
        const siblings = getCardSiblings(card);
        const releaseItems = [];
        const addReleaseItem = (label, stageCard, stageMode) => {
            if (!stageCard) return;
            releaseItems.push({
                label,
                value: formatViewerCleanDate(getCardExactReleaseDate(stageCard, stageMode))
            });
        };

        addReleaseItem('Release Date:', siblings?.base || card, 'base');
        if (siblings?.eza) addReleaseItem('EZA:', siblings.eza, 'eza');
        if (siblings?.seza) addReleaseItem('SEZA:', siblings.seza, 'seza');

        releaseDate.innerHTML = releaseItems.map(item => `
            <span class="abs-clean-date-item">
                <span class="abs-clean-date-label">${item.label}</span>
                <span class="abs-clean-date-val">${item.value}</span>
            </span>
        `.trim()).join('<span class="abs-clean-date-sep">•</span>');
        releaseDate.hidden = false;
    }

    if (nameBadges) nameBadges.hidden = false;
    if (nameRarity) {
        nameRarity.src = getViewerCleanRarityAsset(rarity);
        nameRarity.alt = `${rarity} rarity`;
    }
    if (nameType) {
        nameType.src = `${CENTRAL_ASSET_URL}${cardClass}_type_${cardType}.png`;
        nameType.alt = `${cardClass} ${cardType} type`;
    }

    if (portraitStage) portraitStage.hidden = false;
    if (identity) {
        identity.hidden = false;
        const setIdentityValue = (valueId, badgeId, value, hidden = false) => {
            const valueEl = document.getElementById(valueId);
            const badgeEl = document.getElementById(badgeId);
            if (valueEl) valueEl.textContent = value || '';
            if (badgeEl) badgeEl.hidden = hidden;
        };
        setIdentityValue('abs-clean-val-rarity', 'abs-clean-badge-rarity', rarity);
        setIdentityValue('abs-clean-val-class', 'abs-clean-badge-class', String(cardClass || '').toUpperCase(), !cardClass || cardClass === 'none');
        setIdentityValue('abs-clean-val-type', 'abs-clean-badge-type', String(cardType || '').toUpperCase());
        setIdentityValue('abs-clean-val-tag', 'abs-clean-badge-tag', unitTag, !unitTag);
        const awakening = mode === 'seza' ? 'SEZA' : (mode === 'eza' ? 'EZA' : '');
        setIdentityValue('abs-clean-val-awakening', 'abs-clean-badge-awakening', awakening, !awakening);

        const badgeRarity = document.getElementById('abs-clean-badge-rarity');
        const badgeClass = document.getElementById('abs-clean-badge-class');
        const badgeType = document.getElementById('abs-clean-badge-type');
        const badgeTag = document.getElementById('abs-clean-badge-tag');
        const badgeAwakening = document.getElementById('abs-clean-badge-awakening');
        if (badgeRarity && badgeType) {
            identity.appendChild(badgeRarity);
            if (badgeClass) identity.appendChild(badgeClass);
            identity.appendChild(badgeType);
            if (badgeTag && unitTag) identity.appendChild(badgeTag);
            if (badgeAwakening) identity.appendChild(badgeAwakening);
        }
    }

    const network = typeof getFullUnitNetwork === 'function'
        ? getFullUnitNetwork(card)
        : { baseProgression: [] };
    const siblings = (typeof getCardSiblings === 'function') ? getCardSiblings(card) : {};
    const progression = (Array.isArray(network?.baseProgression) && network.baseProgression.length > 0)
        ? network.baseProgression
        : [siblings.base || card].filter(Boolean);
    const progressionByRarity = new Map();
    progression.forEach(stageCard => {
        const stageRarity = normalizeViewerProgressionRarity(stageCard);
        // The route is sorted from the lowest to highest power. Retain the
        // last row when an export contains duplicate records for a tier.
        progressionByRarity.set(stageRarity, stageCard);
    });

    if (portraits) {
        const portraitStages = [
            ['SSR', 'abs-clean-awakening-portrait--ssr', 'abs-clean-ssr-portrait'],
            ['TUR', 'abs-clean-awakening-portrait--tur', 'abs-clean-tur-portrait'],
            ['LR', 'abs-clean-awakening-portrait--lr', 'abs-clean-lr-portrait']
        ];
        let visiblePortraitCount = 0;
        portraitStages.forEach(([stageRarity, wrapperClass, imageId]) => {
            const wrapper = portraits.querySelector(`.${wrapperClass}`);
            const image = document.getElementById(imageId);
            const stageCard = progressionByRarity.get(stageRarity);
            if (!wrapper || !image || !stageCard) {
                if (wrapper) {
                    wrapper.hidden = true;
                    wrapper.onclick = null;
                }
                return;
            }

            const { circleUrl, fallbackUrl } = getViewerCircleAsset(stageCard);
            wrapper.hidden = false;
            wrapper.classList.toggle('is-active', stageRarity === rarity);
            image.alt = `${stageRarity} ${card.name || 'card'} portrait`;
            image.onerror = null;
            if (circleUrl && fallbackUrl && circleUrl !== fallbackUrl) {
                image.onerror = function() {
                    this.onerror = null;
                    this.src = fallbackUrl;
                };
                image.src = circleUrl;
            } else {
                image.src = circleUrl || fallbackUrl;
            }

            // Enable redirect / card selection when clicking SSR, TUR, or LR in abs.clean:
            const stageCardId = parseInt(stageCard.id, 10);
            const { title: stageTitle, name: stageName } = (typeof parseTitleAndName === 'function')
                ? parseTitleAndName(stageCard)
                : { title: '', name: stageCard.name };
            const stageDisplayLabel = stageTitle ? `[${stageTitle}] ${stageName}` : (stageCard.name || stageRarity);
            const safeTooltip = window.escapeLinkTooltipAttribute?.(stageDisplayLabel) || String(stageDisplayLabel).replace(/"/g, '&quot;');

            wrapper.setAttribute('data-tooltip', safeTooltip);
            wrapper.setAttribute('title', stageDisplayLabel);
            wrapper.style.cursor = 'pointer';
            wrapper.onclick = (e) => {
                e.preventDefault();
                if (typeof selectCard === 'function') {
                    selectCard(stageCardId, false, 'base');
                }
            };
            image.style.cursor = 'pointer';

            visiblePortraitCount += 1;
        });

        // Published ABS.CLEAN uses an explicit arrow lane between every pair
        // of visible awakening portraits. Rebuild only the viewer-owned
        // decorative nodes so repeated card/mode renders never duplicate it
        // and the editor's legacy awakening markup remains untouched.
        if (document.body?.classList.contains('card-viewer-page')) {
            portraits.querySelectorAll(':scope > .abs-clean-awakening-arrow').forEach(arrow => arrow.remove());
            const visiblePortraits = Array.from(
                portraits.querySelectorAll(':scope > .abs-clean-awakening-portrait:not([hidden])')
            );
            visiblePortraits.slice(1).forEach(portrait => {
                const arrow = document.createElement('span');
                arrow.className = 'abs-clean-awakening-arrow';
                arrow.setAttribute('aria-hidden', 'true');
                portrait.before(arrow);
            });
        }
        portraits.hidden = visiblePortraitCount === 0;
    }

    if (timeline) {
        const timelineStages = [
            ['SSR', 'abs-clean-timeline-ssr'],
            ['TUR', 'abs-clean-timeline-tur'],
            ['LR', 'abs-clean-timeline-lr']
        ];
        const currentIndex = timelineStages.findIndex(([stage]) => stage === rarity);
        timelineStages.forEach(([stage, id], index) => {
            const segment = document.getElementById(id);
            if (!segment) return;
            const available = progressionByRarity.has(stage);
            const stageCard = progressionByRarity.get(stage);
            segment.hidden = !available;
            segment.classList.toggle('active', available && (currentIndex < 0 || index <= currentIndex));
            segment.classList.toggle('current', available && stage === rarity);
            if (stageCard && available) {
                segment.style.cursor = 'pointer';
                segment.onclick = (e) => {
                    e.preventDefault();
                    if (typeof selectCard === 'function') {
                        selectCard(stageCard.id, false, 'base');
                    }
                };
            } else {
                segment.onclick = null;
                segment.style.cursor = '';
            }
        });
        const timelineRarity = document.getElementById('abs-clean-timeline-rarity');
        if (timelineRarity) timelineRarity.textContent = rarity;
        timeline.hidden = progressionByRarity.size === 0;
    }
}


function renderCardDetails(card, mode = currentEzaMode) {
    if (!card) return;

    // Animation buttons are rendered in several independent sections. Keep the
    // currently viewed official card available to all of them without relying
    // on a block-scoped loader variable.
    window.__absCurrentAnimationCardId = Number(card.id) || 0;
    window.__absViewerCard = card;
    window.__absViewerMode = mode;

    try {
        const { cardClass, cardType } = getCardClassAndType(card.element !== undefined ? card.element : card.attribute);
        const exactRarity = (typeof getCardExactRarity === 'function') ? getCardExactRarity(card) : (isCardLR(card) ? 'LR' : (card.rarity === 4 ? 'TUR' : 'SSR'));
        const isLR = exactRarity === 'LR';
        const rarity = isLR ? 'LR' : (exactRarity === 'TUR' ? 'TUR' : 'SSR');
        const isSEZA = mode === 'seza';
        const isEZA = mode === 'eza' || mode === 'seza';
        const isAbsCleanTheme = document.body.classList.contains('theme-abs-clean');
        window.__absCleanViewerEffectsState = { isLR, isEZA, isSEZA, cardType };
        if (document.body) document.body.dataset.absCleanType = cardType;

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
        syncAbsCleanViewerSurfaces(card, mode, cardClass, cardType, rarity, unitTag);

        const { bgUrl, charUrl, effectUrl, thumbUrl } = resolveCardAssets(card);

        const fullCardTitle = title ? `[${title}] ${name}` : (name || "Character Inspector");
        document.title = `${fullCardTitle} | absCustom`;

        // Carry this exact card and its currently selected awakening state into
        // the calculator instead of making the visitor pick it a second time.
        const calculatorLink = document.getElementById('card-calculator-link');
        if (calculatorLink) {
            const calculatorParams = new URLSearchParams({ card: String(card.id) });
            if (mode === 'eza' || mode === 'seza') calculatorParams.set('mode', mode);
            calculatorLink.href = `calculator.html?${calculatorParams.toString()}`;
        }

        // The viewer follows the currently selected character, while the
        // calculator keeps its dedicated cards favicon.
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
        syncAbsCleanViewerLeaderPlacement();

        // Passive Skill
        const passiveObj = getCardPassiveObject(card, mode);
        let pName = passiveObj.name || "Passive Skill";
        pName = pName.replace(/\s*\(Extreme.*?\)$/i, '').replace(/\s*\(Super Extreme.*?\)$/i, '').trim();

        if (isSEZA) pName += " (Super Extreme)";
        else if (isEZA) pName += " (Extreme)";

        const passText = passiveObj.itemized_description || passiveObj.description || "";
        const passiveIconsStripHtml = renderPassiveIconsStrip(passText, card);
        const cleanPassiveIcons = document.getElementById('abs-clean-passive-icons');
        const cleanAbilityDocks = document.getElementById('abs-clean-ability-docks');
        if (cleanPassiveIcons) {
            cleanPassiveIcons.innerHTML = isAbsCleanTheme ? passiveIconsStripHtml : '';
            cleanPassiveIcons.hidden = !isAbsCleanTheme || !passiveIconsStripHtml;
        }
        if (cleanAbilityDocks) cleanAbilityDocks.hidden = !isAbsCleanTheme || !passiveIconsStripHtml;
        const passiveAnimationScript = window.DokkanAnimation?.resolvePassive(card) || '';
        const passiveAnimationButton = window.DokkanAnimation?.buttonHtml(passiveAnimationScript, 'Play Intro Animation', 'passive') || '';

        const absPassiveName = document.getElementById("abs-passive-name");
        const absPassiveBox = document.getElementById("abs-passive-skill-box");
        const passiveSummary = document.getElementById('abs-passive-summary');
        // The clean layout keeps both live utility panels in the Passive box,
        // outside the title header. Save them in that surrounding box before
        // rebuilding the title so innerHTML cannot detach them from the document.
        [cleanAbilityDocks, passiveSummary]
            .filter(node => node?.parentElement === absPassiveName)
            .forEach(node => {
                if (absPassiveBox && !node.contains(absPassiveBox)) absPassiveBox.appendChild(node);
                else node.remove();
            });
        if (absPassiveName) {
            // In abs.clean the label/actions are a small, plain heading above
            // the panel.  The actual passive name belongs to the panel body so
            // it never inherits the old typed/blue header treatment.
            absPassiveName.innerHTML = isAbsCleanTheme
                ? `<div class="abs-passive-external-header">
                    <span class="abs-passive-external-label">Passive Skill</span>
                    <span class="abs-passive-header-actions">${passiveAnimationButton}</span>
                </div>`
                : `<div class="abs-passive-header-title">
                    <span>Passive Skill</span>
                    <span class="mx-1">&ndash;</span>
                    <i>${pName}</i>
                    ${passiveAnimationButton}
                </div>`;
        }
        // Reattach/restore both live nodes through the shared clean-only
        // placement guard after the header has been rebuilt.
        window.syncAbsCleanAbilityDockPlacement?.();
        window.DokkanAnimation?.mountCounterControls(
            card,
            passiveObj,
            absPassiveName
        );
        const passiveContainer = document.getElementById("abs-passive-container");
        if (passiveContainer) {
            passiveContainer.innerHTML = isAbsCleanTheme
                ? `<div class="abs-passive-name-inside">${pName}</div>${parsePassiveSections(passText)}`
                : parsePassiveSections(passText);
        }
        window.syncAbsCleanPassiveSummary?.(passText);

        renderSuperAttacks(card, isEZA, mode);
        renderActiveSkills(card);
        renderDokkanFields(card);
        renderStandbySkills(card);
        renderFinishSkills(card);

        // Links are displayed shortest-to-longest without changing the source
        // order used by the card data or any editor/export operation.
        const linkEntries = (card.links || card.link_skill_ids || []).map((linkItem, sourceIndex) => {
            let linkName = typeof linkItem === 'object' ? linkItem.name : (DB.links && DB.links[linkItem] ? DB.links[linkItem].name : "Link");
            linkName = String(linkName || '').trim() || 'Link';
            return { linkName, sourceIndex };
        });
        linkEntries.sort((a, b) => {
            const lengthDiff = a.linkName.length - b.linkName.length;
            return lengthDiff !== 0 ? lengthDiff : a.sourceIndex - b.sourceIndex;
        });
        const linksHtml = linkEntries.map(({ linkName }) => {
            let linkObj = DB.links ? Object.values(DB.links).find(l => l.name === linkName) : null;
            let lv10Desc = window.getLinkSkillLevel10Description?.(linkName, linkObj) || '';
            let tooltip = window.escapeLinkTooltipAttribute?.(lv10Desc) || lv10Desc;
            let tooltipAttr = lv10Desc ? ` data-tooltip="${tooltip}"` : '';
            let effectHtml = lv10Desc ? `<div class="abs-link-effect">${tooltip}</div>` : '';
            let safeLinkName = window.escapeLinkTooltipAttribute?.(linkName) || linkName;
            return `
                <div class="abs-link-badge"${tooltipAttr}>
                    <div class="abs-link-lv">
                        <span class="lv-text">Lv</span>
                        <span class="num-text">10</span>
                    </div>
                    <div class="abs-link-name">${safeLinkName}</div>
                    ${effectHtml}
                </div>
            `;
        }).join('');
        document.getElementById("abs-link-container").innerHTML = linksHtml;

        // Categories are displayed shortest-to-longest without changing the source order.
        const catEntries = (card.categories || card.category_ids || []).map(categoryValue => {
            const resolved = window.resolveDokkanCategoryDisplay?.(categoryValue) || {};
            const categoryId = resolved.id || String(
                typeof categoryValue === 'object'
                    ? (categoryValue.id || categoryValue.category_id || '')
                    : (categoryValue || '')
            );
            const numericId = parseInt(categoryId, 10);
            if (!Number.isFinite(numericId) || numericId <= 0) return null;
            const padId = String(numericId).padStart(4, '0');
            const catName = resolved.name || '';
            if (!catName) return null;
            const catColor = window.getDokkanCategoryColor?.(catName) || '#38bdf8';
            const categoryCount = window.getDokkanCategoryCharacterCount?.(categoryId, catName) ?? 0;
            return { padId, catName, catColor, categoryCount };
        }).filter(Boolean);
        catEntries.sort((a, b) => {
            const lengthDiff = String(a.catName || '').trim().length - String(b.catName || '').trim().length;
            if (lengthDiff !== 0) return lengthDiff;
            if (window.compareDokkanCategoryColors) return window.compareDokkanCategoryColors(a.catColor, a.catName, b.catColor, b.catName);
            if (a.catColor < b.catColor) return -1;
            if (a.catColor > b.catColor) return 1;
            return String(a.catName).localeCompare(String(b.catName));
        });
        const catsHtml = catEntries.map(({ padId, catName, catColor, categoryCount }) => {
            const safeCatName = window.escapeLinkTooltipAttribute?.(catName) || catName;
            return `
                <span class="abs-category-entry">
                    <img src="${CENTRAL_ASSET_URL}card_category_label_${padId}_b_on.png" alt="${safeCatName}">
                    <span class="abs-category-badge" data-category="${safeCatName}" style="--cat-color: ${catColor};">
                        <span class="abs-category-dot"></span>
                        <span class="abs-category-name">${safeCatName}</span>
                        <span class="abs-category-count" aria-label="${categoryCount} characters">
                            <span class="abs-category-count-label">SUM</span>
                            <span class="abs-category-count-value">${categoryCount}</span>
                        </span>
                    </span>
                    <span class="category-name-fallback" style="display:none;">${safeCatName}</span>
                </span>
            `;
        }).join('');
        document.getElementById("abs-category-container").innerHTML = catsHtml;
        window.syncAbsCleanCardLinkCategoryPlacement?.();
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
            const isAbsClean = document.body.classList.contains('theme-abs-clean');
            const { circleUrl } = (typeof getViewerCircleAsset === 'function') ? getViewerCircleAsset(card) : { circleUrl: '' };
            thumbImgEl.onerror = null;
            if (isAbsClean && circleUrl) {
                thumbImgEl.src = circleUrl;
                thumbImgEl.onerror = function() {
                    this.onerror = null;
                    this.src = thumbUrl;
                };
            } else {
                thumbImgEl.src = thumbUrl; 
            }
        }

        const frameEl = document.getElementById("abs-frame-img");
        if (frameEl) frameEl.src = `${CENTRAL_ASSET_URL}frame_${cardType}.png`;

        const topTypeEl = document.getElementById("abs-top-type-icon");
        if (topTypeEl) {
            topTypeEl.src = `${CENTRAL_ASSET_URL}${cardClass}_type_${cardType}.png`;
            if (typeof window.DokkanLWF !== 'undefined' && window.DokkanLWF.attachTypeArrowEffect) {
                const parentComposed = topTypeEl.closest('#abs-composed-icon') || topTypeEl.parentElement;
                if (parentComposed) {
                    window.DokkanLWF.attachTypeArrowEffect(parentComposed, cardType, true);
                }
            }
        }

        const rarityImg = isLR ? `${CENTRAL_ASSET_URL}rarity_lr_abs.png` : (rarity === 'TUR' ? `${CENTRAL_ASSET_URL}rarity_TUR_abs.png` : `${CENTRAL_ASSET_URL}rarity_ssr_abs.png`);
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

        const absAwakeningSrc = isSEZA ? `${CENTRAL_ASSET_URL}superza_abs.png` : (isEZA ? `${CENTRAL_ASSET_URL}eza_abs.png` : '');
        const dbEzaImg = document.getElementById('abs-awakening-img');
        const dbEzaBadge = document.getElementById('abs-awakening-badge');

        if (absAwakeningSrc && isEZA) {
            if (dbEzaImg) {
                dbEzaImg.src = absAwakeningSrc;
                dbEzaImg.alt = isSEZA ? 'SUPER EZA' : 'EZA';
                dbEzaImg.style.display = 'block';
            }
            if (dbEzaBadge) {
                dbEzaBadge.style.display = 'none';
            }
        } else {
            if (dbEzaImg) dbEzaImg.style.display = 'none';
            if (dbEzaBadge) {
                dbEzaBadge.style.display = 'none';
            }
        }

        const spinDial = document.getElementById('abs-spin-dial');
        if (spinDial) spinDial.style.display = isLR ? 'block' : 'none';
        syncAbsCleanViewerEffects({ isLR, isEZA, isSEZA, cardType });

        renderLinkingPartners(card);
        updateToggleBarActiveButtons(mode); 

        updateCardArtAnimation(card);

        // Keep the live passive badge dock in the Passive name row after all
        // card-view rendering has finished. This also covers the published
        // card page, which does not load the editor theme synchronizer.
        syncAbsCleanViewerLeaderPlacement();
        syncAbsCleanViewerIdentityPlacement();
        syncAbsCleanViewerEffects();
        window.syncAbsCleanAbilityDockPlacement?.();

        if (typeof window.DokkanLWF !== 'undefined' && window.DokkanLWF.setupDomainCardArtHover) {
            window.DokkanLWF.setupDomainCardArtHover(card);
        }
        
    } catch (err) {
        console.error("Error in renderCardDetails:", err);
    }
}

// Viewer settings can change presentation classes without changing the
// selected unit. Re-render the existing card so clean-only markup and the
// shared placement helpers immediately follow the selected style.
window.refreshAbsCardViewer = function() {
    if (!selectedCard) return false;
    renderCardDetails(selectedCard, currentEzaMode);
    renderAwakeningAndTransformationTrees(currentEzaMode);
    syncAbsCleanViewerLeaderPlacement();
    syncAbsCleanViewerIdentityPlacement();
    syncAbsCleanViewerEffects();
    window.syncAbsCleanCardLinkCategoryPlacement?.();
    window.syncAbsCleanRightRail?.();
    window.syncAbsCleanSuperAttackPlacement?.();
    window.syncAbsCleanAwakeningFormsPlacement?.();
    window.syncAbsCleanAbilityDockPlacement?.();
    window.syncAbsCleanLinkPartnersPlacement?.();
    return true;
};

window.switchCardArtMode = function(mode) {
    currentCardArtMode = mode;
    if (document.body.classList.contains('theme-abs-clean')) window.syncAbsCleanArtMediaMode?.(mode);
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
    window.syncAbsCleanCategoryArtModeButtons?.(mode);
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

    // Stickers are a TUR/UR presentation effect.  An LR without a locally
    // available card-background LWF should remain static; it must not render
    // a TUR sticker just because its LWF asset has not been pulled yet.
    if (!hasAnimated && !isLR && stickerCanvas && window.DokkanStickerRunner) {
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
        toggleBar.setAttribute('aria-hidden', hasAnimated ? 'false' : 'true');
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
        let storedSelection = null;
        try {
            storedSelection = JSON.parse(localStorage.getItem('abs_viewer_selection') || 'null');
        } catch (error) {}
        const cardIdParam = parseInt(urlParams.get('id') || urlParams.get('card') || storedSelection?.id || '1032881', 10);
        const modeParam = urlParams.get('mode') || storedSelection?.mode || null;
        
        selectCard(cardIdParam, false, modeParam);
        window.initializeViewerCardPicker?.();
        window.renderViewerCardPicker?.();
    } catch(e) {
        console.error("Error starting viewer:", e);
    } finally {
        window.absCardContentReady = true;
        window.dispatchEvent(new Event('abs-card-content-ready'));
    }
}

// abs.clean places Categories in the left half of its lower progression row.
// Other themes keep every box in its original location untouched.
window.syncAbsCleanCardLinkCategoryPlacement = function() {
    const linkContainer = document.getElementById('abs-link-container');
    const catContainer = document.getElementById('abs-category-container');
    const linkBox = linkContainer?.closest('.abs-box') || null;
    const catBox = catContainer?.closest('.abs-box') || null;
    const categoryLinksColumn = document.getElementById('abs-clean-category-links-column');
    if (!linkBox || !catBox) return;

    if (!window.__absCleanCardHome) {
        window.__absCleanCardHome = {
            linkParent: linkBox.parentElement,
            linkNext: linkBox.nextElementSibling,
            catParent: catBox.parentElement,
            catNext: catBox.nextElementSibling
        };
    }

    const isClean = document.body.classList.contains('theme-abs-clean');
    if (!isClean) {
        linkBox.style.order = '';
        catBox.style.order = '';
        const home = window.__absCleanCardHome;
        if (home.linkParent && linkBox.parentElement !== home.linkParent) {
            if (home.linkNext && home.linkNext.parentElement === home.linkParent) home.linkParent.insertBefore(linkBox, home.linkNext);
            else home.linkParent.appendChild(linkBox);
        }
        if (home.catParent && catBox.parentElement !== home.catParent) {
            if (home.catNext && home.catNext.parentElement === home.catParent) home.catParent.insertBefore(catBox, home.catNext);
            else home.catParent.appendChild(catBox);
        }
        document.getElementById('abs-clean-side-duo-slot')?.remove?.();
        window.restoreAbsCleanCategoryArt?.();
        window.syncAbsCleanRightRail?.();
        window.syncAbsCleanAwakeningFormsPlacement?.();
        window.syncAbsCleanLinkPartnersPlacement?.();
        return;
    }

    const mainCol = document.querySelector('#layout-abs-style .abs-main-col');
    const passiveBox = document.getElementById('abs-passive-skill-box');
    if (!mainCol || !passiveBox) return;
    const categoryAwakeningsRow = document.getElementById('abs-clean-category-awakenings-row');
    const categoryIsInCleanSplit = catBox.parentElement === categoryAwakeningsRow;
    const categoryIsInUtilityColumn = catBox.parentElement === categoryLinksColumn;
    if (!categoryIsInCleanSplit && !categoryIsInUtilityColumn &&
        (catBox.parentElement !== mainCol || passiveBox.nextElementSibling !== catBox)) {
        passiveBox.insertAdjacentElement('afterend', catBox);
    }
    catBox.hidden = false;
    catContainer.hidden = false;
    catBox.removeAttribute('hidden');
    catContainer.removeAttribute('hidden');
    catBox.style.order = '';
    linkBox.style.order = '';
    document.getElementById('abs-clean-side-duo-slot')?.remove?.();
    window.restoreAbsCleanCategoryArt?.();
    window.syncAbsCleanRightRail?.();
    window.syncAbsCleanAwakeningFormsPlacement?.();
    window.syncAbsCleanLinkPartnersPlacement?.();
};

document.addEventListener('DOMContentLoaded', startViewer);
document.addEventListener('DOMContentLoaded', () => {
    try {
        window.syncAbsCleanCardLinkCategoryPlacement?.();
        window.syncAbsCleanRightRail?.();
        window.syncAbsCleanSuperAttackPlacement?.();
        window.syncAbsCleanAwakeningFormsPlacement?.();
        window.syncAbsCleanAbilityDockPlacement?.();
        window.syncAbsCleanViewerIdentityPlacement?.();
        window.syncAbsCleanViewerEffects?.();
        const themeObserver = new MutationObserver(() => {
            window.syncAbsCleanCardLinkCategoryPlacement?.();
            window.syncAbsCleanRightRail?.();
            window.syncAbsCleanSuperAttackPlacement?.();
            window.syncAbsCleanAwakeningFormsPlacement?.();
            window.syncAbsCleanAbilityDockPlacement?.();
            window.syncAbsCleanViewerIdentityPlacement?.();
            window.syncAbsCleanViewerEffects?.();
        });
        themeObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    } catch (e) {}
});
