/* ==========================================================================
   absCustom - Dokkan Stat Calculator: Unified Database & Custom Card Loader
   ========================================================================== */

let allPickerCards = [];
let filteredPickerCards = [];
let currentPickerSource = 'all';
let pickerSearchQuery = '';

window.currentLoadedCardMeta = null;
window.currentCalcEzaMode = 'base';

/**
 * Active Skills use two separate Dokkan calculation brackets:
 * - "raises ATK temporarily" increases only the Active Skill attack multiplier.
 * - direct ATK/DEF buffs (for a turn, several turns, or in battle) modify stats.
 */
function parseActiveSkillBuffValues(effectText = '') {
    const source = String(effectText || '').replace(/<[^>]*>/g, ' ').replace(/\r/g, ' ').replace(/\s+/g, ' ').trim();
    const lower = source.toLowerCase();
    let tempAtk = 0;

    const numericTempAtk = source.match(/raises?\s+ATK\s+by\s+(\d+)%\s+temporarily/i)
        || source.match(/raises?\s+ATK[^\d%]*(\d+)%\s+temporarily/i);
    if (numericTempAtk) tempAtk = parseInt(numericTempAtk[1], 10) || 0;
    else if (/massively raises?\s+ATK\s+temporarily/i.test(source)) tempAtk = 100;
    else if (/greatly raises?\s+ATK\s+temporarily/i.test(source)) tempAtk = 50;
    else if (/raises?\s+ATK\s+temporarily/i.test(source)) tempAtk = 30;

    // Remove the Active-attack-only raise before looking for lasting stat buffs.
    const lastingSource = source
        .replace(/(?:massively|greatly)?\s*raises?\s+ATK(?:\s+by\s+\d+%)?\s+temporarily/gi, ' ')
        .replace(/\s+/g, ' ');

    let activeAtk = 0;
    let activeDef = 0;
    const clauses = lastingSource.split(/(?:;|,|\.(?:\s|$))/);

    for (const rawClause of clauses) {
        const clause = rawClause.trim();
        if (!clause) continue;
        if (/self excluded/i.test(clause) || /Category allies/i.test(clause)) continue;
        if (/all enemies['’]?\s+(?:ATK|DEF)|(?:attacked\s+)?enemy['’]s\s+(?:ATK|DEF)|lowers?\s+(?:the\s+)?(?:enemy['’]s\s+)?(?:ATK|DEF)/i.test(clause)) continue;

        const combined = clause.match(/ATK\s*&\s*DEF\s*([+-])\s*(\d+)%/i);
        if (combined) {
            const value = (combined[1] === '-' ? -1 : 1) * parseInt(combined[2], 10);
            if (activeAtk === 0) activeAtk = value;
            if (activeDef === 0) activeDef = value;
        }

        const atkMatch = clause.match(/(?:^|[^A-Z])ATK\s*([+-])\s*(\d+)%/i)
            || clause.match(/raises?\s+(?:all\s+allies['’]\s+)?ATK\s+by\s+(\d+)%/i);
        if (atkMatch && activeAtk === 0) {
            const hasSign = atkMatch[2] !== undefined;
            const magnitude = parseInt(hasSign ? atkMatch[2] : atkMatch[1], 10) || 0;
            activeAtk = hasSign && atkMatch[1] === '-' ? -magnitude : magnitude;
        }

        const defMatch = clause.match(/(?:^|[^A-Z])DEF\s*([+-])\s*(\d+)%/i)
            || clause.match(/raises?\s+(?:all\s+allies['’]\s+)?DEF\s+by\s+(\d+)%/i);
        if (defMatch && activeDef === 0) {
            const hasSign = defMatch[2] !== undefined;
            const magnitude = parseInt(hasSign ? defMatch[2] : defMatch[1], 10) || 0;
            activeDef = hasSign && defMatch[1] === '-' ? -magnitude : magnitude;
        }
    }

    return { tempAtk, activeAtk, activeDef, hasTemporaryAttackRaise: lower.includes('temporarily') };
}

window.parseActiveSkillBuffValues = parseActiveSkillBuffValues;

/* NOTE: this restores the STUDIO dock sync button (#update-box-btn), which
   in the original HTML sizes its icon directly on the <svg> itself
   (width="11" height="11") rather than via a .dock-svg-icon wrapper. This
   used to be a copy of the *other* sync button's markup (the "Get Started"
   box one), whose <svg> has no size attributes at all -- that mismatch is
   what made this icon balloon to the browser's default SVG size after every
   sync. Keep this in sync with the button markup at #update-box-btn in
   calculator.html if that ever changes. */
const ORIGINAL_SYNC_BTN_HTML = `
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align: -1px; margin-right: 3px; color: #34d399;">
        <polyline points="23 4 23 10 17 10"></polyline>
        <polyline points="1 20 1 14 7 14"></polyline>
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
    </svg>
    Sync
`;

/**
 * Open Shadcn v-card-14 Style Confirmation Modal
 */
function openSyncModal(count) {
    const backdrop = document.getElementById('calc-sync-modal-backdrop');
    const desc = document.getElementById('vcard-sync-desc');
    if (desc) {
        desc.innerText = `Track and review all ${count} synced units, recent EZA updates, and custom creations in one place.`;
    }
    if (backdrop) backdrop.style.display = 'flex';
}
window.openSyncModal = openSyncModal;

/**
 * Dynamically swaps background theme gradients according to unit typing
 */
function setCalculatorTypeTheme(type) {
    const rawType = (type || 'agl').toLowerCase().trim();
    let normalizedType = 'agl';

    if (rawType.includes('agl')) normalizedType = 'agl';
    else if (rawType.includes('teq')) normalizedType = 'teq';
    else if (rawType.includes('int')) normalizedType = 'int';
    else if (rawType.includes('str')) normalizedType = 'str';
    else if (rawType.includes('phy')) normalizedType = 'phy';

    document.body.classList.remove(
        'type-theme-agl',
        'type-theme-teq',
        'type-theme-int',
        'type-theme-str',
        'type-theme-phy'
    );
    document.body.classList.add(`type-theme-${normalizedType}`);
    window.currentCalcType = normalizedType.toUpperCase();
}
window.setCalculatorTypeTheme = setCalculatorTypeTheme;

window.toggleSettingsDrawer = function() {
    const drawer = document.getElementById('settingsDrawer');
    const overlay = document.getElementById('settingsOverlay');
    if (drawer && overlay) {
        const isOpen = drawer.classList.contains('open');
        if (isOpen) {
            drawer.classList.remove('open');
            overlay.classList.remove('open');
        } else {
            drawer.classList.add('open');
            overlay.classList.add('open');
        }
    }
};

window.syncCalculatorUnits = async function() {
    const btn = document.getElementById('update-box-btn');
    const pickerBtn = document.getElementById('picker-sync-btn');
    const pickerIcon = document.getElementById('picker-sync-icon');
    const pickerText = document.getElementById('picker-sync-text');

    if (btn) {
        btn.innerHTML = `<span class="sync-loader"></span><span class="waffle-btn-label">Syncing...</span>`;
        btn.style.pointerEvents = 'none';
    }
    
    if (pickerBtn && pickerIcon && pickerText) {
        pickerIcon.style.animation = 'spin 1s linear infinite';
        pickerText.innerText = 'Syncing...';
        pickerBtn.style.pointerEvents = 'none';
    }

    try {
        localStorage.removeItem('hub_cached_custom_only');

        if (typeof loadDokkanDatabase === 'function') {
            await loadDokkanDatabase();
        }
        await initUnitPickerDatabase();

        openSyncModal(allPickerCards.length);
    } catch (err) {
        console.error("Sync Error:", err);
    } finally {
        if (btn) {
            btn.innerHTML = ORIGINAL_SYNC_BTN_HTML;
            btn.style.pointerEvents = 'auto';
        }
        if (pickerBtn && pickerIcon && pickerText) {
            pickerIcon.style.animation = 'none';
            pickerText.innerText = 'Sync';
            pickerBtn.style.pointerEvents = 'auto';
        }
    }
};

function getBaseSortId(cardObj) {
    if (cardObj.source === 'custom') return parseInt(cardObj.id, 10) || 0;
    const cid = parseInt(cardObj.id, 10);
    const normCid = cid > 10000000 ? Math.floor(cid / 10) : cid;
    
    if (normCid >= 4000000 && normCid < 5000000) {
        const str = String(normCid);
        if (str.length === 7) return parseInt('1' + str.substring(1), 10);
    }
    
    if (cardObj.rawCard && cardObj.rawCard.parent_id) {
        return parseInt(cardObj.rawCard.parent_id, 10);
    }
    return normCid;
}

function getCardSiblingsForCalc(card) {
    if (!card) return { base: card, eza: null, seza: null, hasEza: false, hasSeza: false };

    const cid = parseInt(card.id, 10);
    const normId = cid > 10000000 ? Math.floor(cid / 10) : cid;
    const strId = String(normId);
    const rootId = (typeof getRootParentId === 'function') ? getRootParentId(card) : normId;
    const baseStem = strId.length >= 8 ? strId.substring(0, 7) : strId;

    let baseCard = card;
    let ezaCard = null;
    let sezaCard = null;
    let hasEza = false;
    let hasSeza = false;

    if (window.DB && Array.isArray(DB.cards)) {
        baseCard = DB.cards.find(c => {
            const cId = parseInt(c.id, 10);
            return cId === rootId || String(cId) === baseStem || (!c.is_eza && !c.is_seza && String(cId).startsWith(baseStem.substring(0, 6)));
        }) || card;

        ezaCard = DB.cards.find(c => {
            const cStr = String(c.id);
            return (cStr.startsWith(baseStem) && cStr.endsWith('8')) || (c.parent_id === rootId && c.is_eza);
        }) || null;

        sezaCard = DB.cards.find(c => {
            const cStr = String(c.id);
            return (cStr.startsWith(baseStem) && cStr.endsWith('9')) || (c.parent_id === rootId && c.is_seza);
        }) || null;
    }

    if (window.DB && Array.isArray(DB.optimalAwakeningGrowths)) {
        if (DB.optimalAwakeningGrowths.some(g => (g.card_id === rootId || g.card_id === normId || g.card_id === cid) && g.optimal_awakening_grow_type === 1)) {
            hasEza = true;
        }
        if (DB.optimalAwakeningGrowths.some(g => (g.card_id === rootId || g.card_id === normId || g.card_id === cid) && g.optimal_awakening_grow_type === 2)) {
            hasSeza = true;
            hasEza = true;
        }
    }

    if (window.DB && Array.isArray(DB.awakeningRoutes)) {
        if (DB.awakeningRoutes.some(r => (r.card_id === rootId || r.card_id === normId) && (r.optimal_awakening_type === 1 || String(r.type || '').includes('Optimal')))) {
            hasEza = true;
        }
        if (DB.awakeningRoutes.some(r => (r.card_id === rootId || r.card_id === normId) && r.optimal_awakening_type === 2)) {
            hasSeza = true;
            hasEza = true;
        }
    }

    if (ezaCard || card.is_eza || String(card.id).endsWith('8')) hasEza = true;
    if (sezaCard || card.is_seza || String(card.id).endsWith('9')) {
        hasSeza = true;
        hasEza = true;
    }

    return {
        base: baseCard,
        eza: ezaCard || baseCard,
        seza: sezaCard || ezaCard || baseCard,
        hasEza,
        hasSeza
    };
}

function getCardPassiveObjectForCalc(card, mode = 'base') {
    if (!window.DB || !DB.passives || !card) return { name: "Passive Skill", itemized_description: "" };

    const cid = parseInt(card.id, 10);
    const normId = cid > 10000000 ? Math.floor(cid / 10) : cid;
    const baseCardId = (normId >= 4000000 && normId < 5000000) ? (typeof getRootParentId === 'function' ? getRootParentId(card) : normId) : normId;

    if (window.DB && Array.isArray(DB.optimalAwakeningGrowths)) {
        const targetGrowType = mode === 'seza' ? 2 : (mode === 'eza' ? 1 : 0);
        if (targetGrowType > 0) {
            const growth = DB.optimalAwakeningGrowths.find(g => 
                (parseInt(g.card_id, 10) === normId || parseInt(g.card_id, 10) === baseCardId || parseInt(g.card_id, 10) === cid) && 
                g.optimal_awakening_grow_type === targetGrowType &&
                g.passive_skill_set_id
            );
            if (growth && DB.passives[String(growth.passive_skill_set_id)]) {
                return DB.passives[String(growth.passive_skill_set_id)];
            }
        }
    }

    const rawPassId = parseInt(card.pass_id || card.passive_skill_set_id || card.passive_id || 0, 10);
    let passObj = rawPassId ? (DB.passives[rawPassId] || DB.passives[String(rawPassId)]) : null;

    if (!passObj) return { name: "Passive Skill", itemized_description: "" };

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

        if (mode === 'seza') passObj = family[family.length - 1];
        else if (mode === 'eza') passObj = family.length >= 3 ? family[1] : family[family.length - 1];
        else passObj = family[0];
    }

    return passObj;
}

function findLeaderObjForCalc(card, mode = 'base') {
    if (!window.DB || !DB.leaders || !card) return null;

    const cid = parseInt(card.id, 10);
    const normId = cid > 10000000 ? Math.floor(cid / 10) : cid;
    const baseCardId = (normId >= 4000000 && normId < 5000000) ? (typeof getRootParentId === 'function' ? getRootParentId(card) : normId) : normId;

    if (window.DB && Array.isArray(DB.optimalAwakeningGrowths)) {
        const targetGrowType = mode === 'seza' ? 2 : (mode === 'eza' ? 1 : 0);
        if (targetGrowType > 0) {
            const growth = DB.optimalAwakeningGrowths.find(g => 
                (parseInt(g.card_id, 10) === baseCardId || parseInt(g.card_id, 10) === normId) && 
                g.optimal_awakening_grow_type === targetGrowType &&
                g.leader_skill_set_id
            );
            if (growth && DB.leaders[String(growth.leader_skill_set_id)]) {
                return DB.leaders[String(growth.leader_skill_set_id)];
            }
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

            if (mode === 'seza') leadObj = family[family.length - 1];
            else if (mode === 'eza') leadObj = family.length >= 3 ? family[1] : family[family.length - 1];
            else leadObj = family[0];
        }
    }
    return leadObj;
}

function parseReleaseTime(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return 0;
    if (dateStr.includes('2015-10-30') || dateStr.startsWith('2010') || dateStr.startsWith('1970') || dateStr === 'TBD') return 0;
    try {
        const iso = dateStr.replace(" ", "T") + (dateStr.includes("Z") ? "" : "Z");
        const t = new Date(iso).getTime();
        const dokkanMinEpoch = new Date("2015-01-30T00:00:00Z").getTime();
        return (!isNaN(t) && t >= dokkanMinEpoch) ? t : 0;
    } catch(e) {
        return 0;
    }
}

/* ==========================================================================
   INITIALIZE UNIT PICKER DATABASE
   ========================================================================== */
async function initUnitPickerDatabase() {
    if (!window.DB || !window.DB.cards || window.DB.cards.length === 0) {
        if (typeof loadDokkanDatabase === 'function') {
            await loadDokkanDatabase();
        }
    }

    const customCards = await loadCustomCardsForCalculator();

    let officialCards = [];
    if (window.DB && DB.cards) {
        const rawCards = DB.cards;
        const rawRoutes = DB.awakeningRoutes || [];
        const rawGrowths = DB.optimalAwakeningGrowths || [];

        const unawakenedSourceCardIds = new Set();
        const cardEzaRouteDates = new Map();
        const cardSezaRouteDates = new Map();
        const cardDokkanRouteDates = new Map();

        if (Array.isArray(rawRoutes)) {
            rawRoutes.forEach(r => {
                const srcId = parseInt(r.card_id, 10);
                const targetId = parseInt(r.awaked_card_id || r.awakened_card_id, 10);
                const rType = String(r.type || '');
                const optType = r.optimal_awakening_type;
                const dt = r.open_at || r.start_at;
                const parsedT = parseReleaseTime(dt);

                if (srcId && targetId && srcId !== targetId && (rType.includes('Dokkan') || rType.includes('Zet') || (!optType || optType === 0))) {
                    unawakenedSourceCardIds.add(srcId);
                }

                if (parsedT > 0) {
                    const normSrc = srcId > 10000000 ? Math.floor(srcId / 10) : srcId;
                    const normTgt = targetId > 10000000 ? Math.floor(targetId / 10) : targetId;

                    if (optType === 2) {
                        cardSezaRouteDates.set(normSrc, Math.max(cardSezaRouteDates.get(normSrc) || 0, parsedT));
                        cardSezaRouteDates.set(normTgt, Math.max(cardSezaRouteDates.get(normTgt) || 0, parsedT));
                    } else if (optType === 1 || rType.includes('Optimal')) {
                        cardEzaRouteDates.set(normSrc, Math.max(cardEzaRouteDates.get(normSrc) || 0, parsedT));
                        cardEzaRouteDates.set(normTgt, Math.max(cardEzaRouteDates.get(normTgt) || 0, parsedT));
                    } else {
                        cardDokkanRouteDates.set(normTgt, Math.max(cardDokkanRouteDates.get(normTgt) || 0, parsedT));
                    }
                }
            });
        }

        if (Array.isArray(rawGrowths)) {
            rawGrowths.forEach(g => {
                const gCid = parseInt(g.card_id, 10);
                const parsedT = parseReleaseTime(g.open_at || g.created_at);
                if (parsedT > 0) {
                    const normG = gCid > 10000000 ? Math.floor(gCid / 10) : gCid;
                    if (g.optimal_awakening_grow_type === 2) {
                        cardSezaRouteDates.set(normG, Math.max(cardSezaRouteDates.get(normG) || 0, parsedT));
                    } else if (g.optimal_awakening_grow_type === 1) {
                        cardEzaRouteDates.set(normG, Math.max(cardEzaRouteDates.get(normG) || 0, parsedT));
                    }
                }
            });
        }

        const excludedNames = ["則巻アラレ", "arale norimaki", "illustration"];

        const hubCards = rawCards.filter(c => {
            const rawId = parseInt(c.id, 10);
            if (String(rawId).length >= 8) return false;
            if (rawId < 4000000 && unawakenedSourceCardIds.has(rawId)) return false;
            const cName = (c.name || '').trim().toLowerCase();
            if (excludedNames.some(ex => cName.includes(ex))) return false;
            return true;
        });

        const nowPlus30Days = Date.now() + (30 * 24 * 60 * 60 * 1000);

        officialCards = hubCards.map(c => {
            const rawId = parseInt(c.id, 10);
            const isTrans = rawId >= 4000000 && rawId < 5000000;
            const parentId = c.parent_id || (typeof getRootParentId === 'function' ? getRootParentId(c) : (isTrans ? (1000000 + (rawId % 1000000)) : rawId));
            const { cardClass, cardType } = getCardClassAndType(c.element !== undefined ? c.element : c.attribute);
            const titleObj = parseTitleAndName(c);

            const isLR = (c.rarity === 5 || c.rarity === 'lr' || c.max_level === 150 || c.cost === 77 || c.cost === 99 || (typeof isCardLR === 'function' && isCardLR(c)));
            const isTUR = !isLR && (c.rarity === 4 || c.max_level >= 120 || c.cost >= 40);
            const rarityKey = isLR ? 'LR' : (isTUR ? 'TUR' : 'SSR');

            let baseTime = cardDokkanRouteDates.get(parentId) || cardDokkanRouteDates.get(rawId) || parseReleaseTime(c.open_at || c.start_at || c.release_date);
            let ezaTime = cardEzaRouteDates.get(parentId) || cardEzaRouteDates.get(rawId) || 0;
            let sezaTime = cardSezaRouteDates.get(parentId) || cardSezaRouteDates.get(rawId) || 0;

            const hasSeza = sezaTime > 0 || c.is_seza === true;
            const hasEza = ezaTime > 0 || hasSeza || c.is_eza === true;
            const isFuture = (baseTime > nowPlus30Days || ezaTime > nowPlus30Days || sezaTime > nowPlus30Days);

            let effectiveTime = Math.max(
                baseTime < nowPlus30Days ? baseTime : 0,
                ezaTime < nowPlus30Days ? ezaTime : 0,
                sezaTime < nowPlus30Days ? sezaTime : 0
            );

            if (effectiveTime === 0 && !isFuture) effectiveTime = parentId;

            return {
                id: c.id,
                parentId: parentId,
                name: titleObj.name || c.name || (isTrans ? "(Transformed)" : "Dokkan Unit"),
                title: titleObj.title || "",
                source: 'official',
                type: cardType,
                rarity: rarityKey,
                cardClass: cardClass,
                sortTime: effectiveTime,
                isTransformed: isTrans,
                isFuture: isFuture,
                isEza: hasEza,
                isSeza: hasSeza,
                rawCard: c
            };
        });
    }

    // (Inside initUnitPickerDatabase, replace the validCustomList mapping at the bottom)
    const validCustomList = (customCards || []).map(c => ({
        ...c,
        isFuture: false,
        isTransformed: c.isTransformed || false
    }));

    const merged = [...validCustomList, ...officialCards];

    merged.sort((a, b) => {
        if (a.isFuture && !b.isFuture) return 1;
        if (!a.isFuture && b.isFuture) return -1;
        if (b.sortTime !== a.sortTime) return b.sortTime - a.sortTime;
        
        const parentA = a.parentId || a.id;
        const parentB = b.parentId || b.id;
        if (parentB !== parentA) {
            const pNumA = parseInt(parentA, 10) || 0;
            const pNumB = parseInt(parentB, 10) || 0;
            if (pNumB !== pNumA) return pNumB - pNumA;
        }

        const isTransA = !!a.isTransformed;
        const isTransB = !!b.isTransformed;
        if (isTransA !== isTransB) return isTransA ? 1 : -1;

        const numA = parseInt(a.id, 10) || 0;
        const numB = parseInt(b.id, 10) || 0;
        if (numA !== numB) return numA - numB;

        return String(a.id).localeCompare(String(b.id), undefined, { numeric: true });
    });

    allPickerCards = merged;
    filteredPickerCards = allPickerCards;
}

function getCustomCardRarityFromDoc(doc, htmlText) {
    if (!doc && !htmlText) return 'TUR';
    const textLow = (htmlText || (doc ? doc.documentElement.innerHTML : '')).toLowerCase();

    const rarityScriptMatch = textLow.match(/window\.currentrarity\s*=\s*["']([^"']+)["']/i);
    if (rarityScriptMatch) {
        const rar = rarityScriptMatch[1].toUpperCase().trim();
        if (rar === 'LR' || rar === 'TUR' || rar === 'SSR') return rar;
    }

    if (doc) {
        // Only inspect the custom unit's own rarity badges. Generic rarity
        // selectors can accidentally pick a linking partner or a hidden LR asset.
        const mainRaritySelectors = ['#main-rarity-icon', '#abs-top-rarity-icon', '#abs-rarity-icon'];
        for (const selector of mainRaritySelectors) {
            const mainRarityImg = doc.querySelector(selector);
            if (!mainRarityImg) continue;
            const src = (mainRarityImg.getAttribute('src') || '').toLowerCase();
            if (src.includes('rarity_lr')) return 'LR';
            if (src.includes('rarity_tur')) return 'TUR';
            if (src.includes('rarity_ssr')) return 'SSR';
        }

        const maxLvEl = doc.querySelector('#max-lv, #abs-max-lv');
        if (maxLvEl) {
            const lv = parseInt(maxLvEl.textContent.trim(), 10);
            if (lv === 150) return 'LR';
            if (lv === 120) return 'TUR';
        }

        const costEl = doc.querySelector('#cost, #abs-cost');
        if (costEl) {
            const cost = parseInt(costEl.textContent.trim(), 10);
            if (cost === 77 || cost === 99) return 'LR';
            if (cost === 58 || cost === 48 || cost === 40) return 'TUR';
        }
    }

    if (textLow.includes('mega-colossal') || textLow.includes('ultra super attack')) {
        return 'LR';
    }
    if (textLow.includes('immense') || textLow.includes('supreme')) {
        return 'TUR';
    }

    return 'TUR';
}

function getCustomCardClassFromDoc(doc, htmlText) {
    const source = htmlText || (doc ? doc.documentElement.innerHTML : '');
    const classScriptMatch = source.match(/window\.currentClass\s*=\s*["'](super|extreme)["']/i);
    if (classScriptMatch) return classScriptMatch[1].toLowerCase();

    if (doc) {
        const typeSelectors = ['#abs-top-type-icon', '#abs-type-icon', '.typing-icon'];
        for (const selector of typeSelectors) {
            const typeImg = doc.querySelector(selector);
            if (!typeImg) continue;
            const src = (typeImg.getAttribute('src') || '').toLowerCase();
            if (src.includes('extreme_type')) return 'extreme';
            if (src.includes('super_type')) return 'super';
        }
    }

    return 'super';
}

async function loadCustomCardsForCalculator() {
    const cachedCustom = localStorage.getItem('hub_cached_custom_only');
    let customCardsArray = [];
    if (cachedCustom) {
        try { customCardsArray = JSON.parse(cachedCustom); } catch(e) {}
    }

    try {
        const repoRes = await fetch('https://api.github.com/repos/abscustom/abscustom.github.io/contents/');
        if (!repoRes.ok) return customCardsArray;

        const contents = await repoRes.json();
        const ignored = ['DokkanCustom', 'CardEditor', 'Custom Cards', 'images', 'css', 'js', 'js2', 'assets', 'json', '.github', 'js-calc', 'js3'];
        const cardFolders = contents.filter(item => 
            item.type === 'dir' && !ignored.includes(item.name) && !item.name.startsWith('.')
        ).map(item => ({ name: item.name, repoPath: item.name }));
        const groupedFolder = contents.find(item => item.type === 'dir' && item.name === 'Custom Cards');
        if (groupedFolder) {
            const groupedRes = await fetch(groupedFolder.url);
            if (groupedRes.ok) {
                const groupedItems = await groupedRes.json();
                groupedItems
                    .filter(item => item.type === 'dir' && !item.name.startsWith('.'))
                    .forEach(item => cardFolders.push({ name: item.name, repoPath: `Custom Cards/${item.name}` }));
            }
        }

        const customCards = [];
        for (const folder of cardFolders) {
            try {
                const folderName = folder.name;
                const encodedPath = folder.repoPath.split('/').map(encodeURIComponent).join('/');
                const cardUrl = `https://abscustom.github.io/${encodedPath}/`;
                const rawUrl = `https://raw.githubusercontent.com/abscustom/abscustom.github.io/main/${encodedPath}/index.html`;

                const indexRes = await fetch(rawUrl);
                if (!indexRes.ok) continue;

                const htmlText = await indexRes.text();
                const doc = new DOMParser().parseFromString(htmlText, 'text/html');

                let charName = doc.querySelector('#char-name, #abs-char-name')?.textContent?.trim() || '';
                if (!charName) {
                    const rawTitle = doc.querySelector('title')?.textContent || folderName;
                    charName = rawTitle.replace(/^\[.*?\]\s*/, '').trim();
                }

                const exactRarity = getCustomCardRarityFromDoc(doc, htmlText);
                const frameAttr = doc.querySelector('.card-frame, #abs-frame-img')?.getAttribute('src') || 'frame_agl.png';
                let cardType = 'agl';
                if (frameAttr.includes('teq')) cardType = 'teq';
                else if (frameAttr.includes('int')) cardType = 'int';
                else if (frameAttr.includes('str')) cardType = 'str';
                else if (frameAttr.includes('phy')) cardType = 'phy';

                const fixUrl = (src) => src?.startsWith('http') ? src : `${cardUrl}${src?.replace(/^\.\//, '')}`;
                const iconEl = doc.querySelector(exactRarity === 'LR' ? '#img-lr' : '#img-tur') || doc.querySelector('#abs-thumb-img, .thumb-img');
                const thumbUrl = fixUrl(iconEl?.getAttribute('src'));

                customCards.push({
                    id: folderName,
                    repoPath: folder.repoPath,
                    name: charName,
                    source: 'custom',
                    cardUrl: cardUrl,
                    thumbUrl: thumbUrl,
                    type: cardType,
                    cardClass: getCustomCardClassFromDoc(doc, htmlText),
                    rarity: exactRarity,
                    sortTime: Date.now(),
                    htmlText: htmlText
                });
            } catch (e) {}
        }

        if (customCards.length > 0) {
            try { localStorage.setItem('hub_cached_custom_only', JSON.stringify(customCards)); } catch(e) {}
            return customCards;
        }
        return customCardsArray;
    } catch (e) {
        return customCardsArray;
    }
}

function openUnitPickerModal() {
    const modal = document.getElementById('unitPickerModal');
    if (modal) {
        modal.style.display = 'flex';
        if (allPickerCards.length === 0) {
            initUnitPickerDatabase().then(() => renderPickerGrid());
        } else {
            renderPickerGrid();
        }
    }
}

function closeUnitPickerModal() {
    const modal = document.getElementById('unitPickerModal');
    if (modal) modal.style.display = 'none';
}

function setPickerSource(src) {
    currentPickerSource = src;
    document.querySelectorAll('.picker-source-tab').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`picker-src-${src}`)?.classList.add('active');
    filterPickerCards();
}

function handlePickerSearch(val) {
    pickerSearchQuery = (val || '').trim().toLowerCase();
    filterPickerCards();
}

function filterPickerCards() {
    filteredPickerCards = allPickerCards.filter(c => {
        const matchesSrc = (currentPickerSource === 'all' || c.source === currentPickerSource);
        let matchesSearch = true;
        if (pickerSearchQuery) {
            matchesSearch = (c.name || '').toLowerCase().includes(pickerSearchQuery) || String(c.id).toLowerCase().includes(pickerSearchQuery);
        }
        return matchesSrc && matchesSearch;
    });
    renderPickerGrid();
}





function renderPickerGrid() {
    const grid = document.getElementById('unitPickerGrid');
    if (!grid) return;

    if (filteredPickerCards.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1/-1; padding: 40px; color: #94a3b8; font-weight: 800;">No units found matching your search.</div>`;
        return;
    }

    grid.innerHTML = filteredPickerCards.map((c, i) => {
        const exactCardId = String(c.id);
        const folderId = exactCardId.length >= 7 ? exactCardId.substring(0, 7) : exactCardId;
        const parentFolderId = (c.source === 'official' && typeof getCardParentId === 'function') ? Math.floor(getCardParentId(c.id) / 10) * 10 : folderId;
        const frameSrc = `${CALC_ASSET_URL}frame_${c.type || 'agl'}.png`;
        const thumbUrl = c.thumbUrl || `https://images.weserv.nl/?url=dokkaninfo.com/assets/japan/character/thumb/card_${folderId}_thumb/card_${folderId}_thumb.png`;

        // Top-Left Purple Form Badge
        const transBadge = c.isTransformed ? `<span style="position: absolute; top: -3px; left: -3px; background: linear-gradient(135deg, #a855f7 0%, #7e22ce 100%); color: #fff; font-size: 7.5px; font-weight: 900; padding: 1px 4px; border-radius: 3px; z-index: 10; box-shadow: 0 1px 3px rgba(0,0,0,0.5);">FORM</span>` : '';
        
        // Bottom-Left Cyan Custom Badge
        const customBadge = c.source === 'custom' ? `<span style="position: absolute; bottom: -3px; left: -3px; background: linear-gradient(135deg, #0ea5e9 0%, #0369a1 100%); color: #fff; font-size: 7px; font-weight: 900; padding: 1px 4px; border-radius: 3px; z-index: 10; box-shadow: 0 1px 3px rgba(0,0,0,0.6); letter-spacing: 0.5px;">CUSTOM</span>` : '';

        const typeKey = (c.type || 'agl').toLowerCase();
        const typeClass = `picker-type-${typeKey}`;

        return `
        <div class="picker-unit-card ${typeClass}" data-type="${typeKey}" onclick="selectUnitFromPicker(${i})">
            <div class="picker-thumb-wrapper">
                ${transBadge}
                ${customBadge}
                <img class="picker-frame" src="${frameSrc}" loading="lazy">
                <img class="picker-thumb" src="${thumbUrl}" loading="lazy" onerror="window.handleHubThumbError(this, '${folderId}', '${parentFolderId}')">
            </div>
            <span class="picker-name">${c.name}</span>
            <span class="picker-sub">${c.rarity} • ${typeKey.toUpperCase()}${c.isTransformed ? ' (Form)' : ''}</span>
        </div>`;
    }).join('\n');
}

function resetCalculatorForNewCharacterSelection() {
    window.currentLoadedCardMeta = null;
    window.currentFamilyForms = [];
    window.currentCalcEzaMode = 'base';
    window.currentCalcEza = false;
    window.currentCalcRarity = 'LR';
    window.currentCalcType = 'AGL';
    window.currentCalcClass = 'Super';
    window.currentCalcTab = 'atk';
    window.currentPassiveViewMode = 'full';
    window.currentHpPercent = 100;
    window.currentLinkLevel = 10;
    window.lastParsedSaBlocksData = null;
    window.lastCalculatedAttacks = [];
    window.activeUnitSaBlockIdx = null;
    window.parsedConditionals = [];
    window.interactivePassiveLines = [];
    window.passiveHasHpScaling = false;
    window.exToggleState = {};
    window.calcCritEnabled = false;
    window.calcAdditionalEnabled = false;
    window.calcSeEnabled = false;
    window.currentCalcAutoSuperEffective = false;

    activeCharacterLinks = [];
    cardParsedStats = JSON.parse(JSON.stringify(DEFAULT_CARD_STATS));
    currentHipoPreset = '100';

    document.querySelectorAll('#calc-studio-main-layout input, #calc-studio-main-layout select, #calc-studio-main-layout textarea').forEach(control => {
        if (control.matches('input[type="checkbox"], input[type="radio"]')) {
            control.checked = control.defaultChecked;
        } else if (control.tagName === 'SELECT') {
            const defaultOption = Array.from(control.options).findIndex(option => option.defaultSelected);
            control.selectedIndex = defaultOption >= 0 ? defaultOption : 0;
        } else {
            control.value = control.defaultValue;
        }
    });

    document.querySelectorAll('[id^="hipo-pill-"]').forEach(button => button.classList.toggle('active', button.id === 'hipo-pill-100'));
    document.querySelectorAll('[id^="lead-pill-"]').forEach(button => button.classList.toggle('active', button.id === 'lead-pill-220'));
    document.querySelectorAll('#calc-crit-toggle, #calc-se-toggle, #calc-additional-toggle').forEach(button => button.classList.remove('active', 'auto-active'));
    document.getElementById('btn-tab-atk')?.classList.add('active');
    document.getElementById('btn-tab-def')?.classList.remove('active');
    document.querySelectorAll('.view-atk-only').forEach(element => element.style.setProperty('display', '', 'important'));
    document.querySelectorAll('.view-def-only').forEach(element => element.style.setProperty('display', 'none', 'important'));
    const linkLevelBadge = document.getElementById('lbl-master-link-level');
    if (linkLevelBadge) {
        linkLevelBadge.textContent = '10';
        linkLevelBadge.className = 'link-level-btn-badge lvl-10';
    }

    const formSwitcher = document.getElementById('deck-form-switcher');
    if (formSwitcher) {
        formSwitcher.innerHTML = '';
        formSwitcher.style.display = 'none';
    }
    const ezaToggleBar = document.getElementById('calc-eza-toggle-bar');
    if (ezaToggleBar) ezaToggleBar.style.display = 'none';
    ['calc-form-btn-base', 'calc-form-btn-eza', 'calc-form-btn-seza'].forEach((id, index) => {
        document.getElementById(id)?.classList.toggle('active', index === 0);
    });

    const charThumb = document.getElementById('calc-char-thumb');
    if (charThumb) {
        charThumb.removeAttribute('src');
        charThumb.removeAttribute('onerror');
        charThumb.classList.remove('is-fallback-thumb');
    }
    const awakeningImage = document.getElementById('calc-awakening-img');
    if (awakeningImage) awakeningImage.style.display = 'none';

    ['calc-active-links-list', 'calc-passive-lines-container', 'calc-dynamic-sa-container',
        'mini-stats-card-character-container', 'stats-card-character-container'].forEach(id => {
        const container = document.getElementById(id);
        if (container) container.innerHTML = '';
    });
    ['mini-stats-card-bg', 'stats-card-bg'].forEach(id => {
        const background = document.getElementById(id);
        if (background) background.style.backgroundImage = '';
    });
    ['panel-active', 'panel-domain', 'acc-active-skill-wrapper', 'acc-domain-wrapper'].forEach(id => {
        const element = document.getElementById(id);
        if (element) element.style.display = 'none';
    });
}

window.resetCalculatorForNewCharacterSelection = resetCalculatorForNewCharacterSelection;


async function selectUnitFromPicker(index) {
    const cardItem = filteredPickerCards[index];
    if (!cardItem) return;

    closeUnitPickerModal();
    await loadPickerCardIntoCalculator(cardItem);
}

async function loadPickerCardIntoCalculator(cardItem, forcedMode = null) {
    if (!cardItem) return;

    resetCalculatorForNewCharacterSelection();

    const initialActionBox = document.getElementById('calc-initial-action-box');
    if (initialActionBox) initialActionBox.style.display = 'none';

    const studioLayout = document.getElementById('calc-studio-main-layout');
    if (studioLayout) studioLayout.style.display = 'grid';

    if (cardItem.source === 'custom') {
        await loadCustomCardDocIntoCalculator(cardItem);
    } else {
        await loadOfficialDokkanCardIntoCalculator(cardItem.id, cardItem.rawCard, cardItem, forcedMode);
    }
}

// Card pages link here with a card id (official) or published folder path
// (custom). Resolve it after the picker database is ready and load it directly.
window.loadCalculatorCardFromUrl = async function() {
    const params = new URLSearchParams(window.location.search);
    const customPath = String(params.get('custom') || '').trim().replace(/^\/+|\/+$/g, '');
    const officialId = String(params.get('card') || params.get('id') || '').trim();
    const requestedMode = String(params.get('mode') || '').toLowerCase();
    const forcedMode = ['base', 'eza', 'seza'].includes(requestedMode) ? requestedMode : null;

    let cardItem = null;
    if (customPath) {
        const normalizedPath = customPath.toLowerCase();
        cardItem = allPickerCards.find(card => card.source === 'custom' && (
            String(card.repoPath || '').replace(/^\/+|\/+$/g, '').toLowerCase() === normalizedPath ||
            String(card.id || '').toLowerCase() === normalizedPath
        ));
    } else if (officialId) {
        cardItem = allPickerCards.find(card => card.source === 'official' && String(card.id) === officialId);
        // Some card-detail links can point to an older/unawakened record that
        // is intentionally hidden from the normal picker. It should still be
        // usable when arriving from that exact card page.
        if (!cardItem && Array.isArray(window.DB?.cards)) {
            const rawCard = window.DB.cards.find(card => String(card.id) === officialId);
            if (rawCard) {
                const typeInfo = getCardClassAndType(rawCard.element !== undefined ? rawCard.element : rawCard.attribute);
                const titleInfo = parseTitleAndName(rawCard);
                cardItem = {
                    id: rawCard.id,
                    name: titleInfo.name || rawCard.name || 'Dokkan Unit',
                    source: 'official',
                    type: typeInfo.cardType,
                    cardClass: typeInfo.cardClass,
                    rarity: isCardLR(rawCard) ? 'LR' : (rawCard.rarity === 4 ? 'TUR' : 'SSR'),
                    rawCard
                };
            }
        }
    }

    if (cardItem) await loadPickerCardIntoCalculator(cardItem, forcedMode);
};

function extractLinkBuffsFromDB(linkName, linkItem = null, targetLevel = (window.currentLinkLevel || 10)) {
    let atkBuff = 0, defBuff = 0, kiBuff = 0;
    let linkObj = typeof linkItem === 'object' && linkItem !== null ? linkItem : null;
    
    if (!linkObj && window.DB && DB.links) {
        linkObj = Object.values(DB.links).find(l => l.name && l.name.toLowerCase() === linkName.toLowerCase());
    }

    if (linkObj) {
        let desc = '';
        if (targetLevel === 1) {
            desc = (linkObj.description || linkObj.level_1_description || linkObj.effect || '').toLowerCase();
        } else {
            desc = (linkObj.level_10_description || linkObj.description || linkObj.effect || '').toLowerCase();
        }

        if (desc) {
            // Joint ATK & DEF
            const jointMatches = [...desc.matchAll(/(?:atk\s*(?:&|and)\s*def|def\s*(?:&|and)\s*atk)\s*\+?\s*(\d+)%/gi)];
            jointMatches.forEach(m => {
                const v = parseInt(m[1], 10);
                atkBuff += v;
                defBuff += v;
            });

            // Standalone ATK
            const atkMatches = [...desc.matchAll(/(?<!(?:&|and)\s*)atk\s*\+?\s*(\d+)%(?!\s*(?:&|and)\s*def)/gi)];
            atkMatches.forEach(m => { atkBuff += parseInt(m[1], 10); });

            // Standalone DEF
            const defMatches = [...desc.matchAll(/(?<!(?:&|and)\s*)def\s*\+?\s*(\d+)%(?!\s*(?:&|and)\s*atk)/gi)];
            defMatches.forEach(m => { defBuff += parseInt(m[1], 10); });

            // Ki
            const kiMatch = desc.match(/ki\s*\+?\s*(\d+)/i);
            if (kiMatch) kiBuff = parseInt(kiMatch[1], 10);
        }
    } else if (typeof DOKKAN_LINKS_LV10 !== 'undefined') {
        const matchedKey = Object.keys(DOKKAN_LINKS_LV10).find(k => k === linkName.toLowerCase() || linkName.toLowerCase().includes(k));
        if (matchedKey) {
            let maxAtk = DOKKAN_LINKS_LV10[matchedKey].atk || 0;
            let maxDef = DOKKAN_LINKS_LV10[matchedKey].def || 0;
            if (targetLevel === 1) {
                atkBuff = maxAtk >= 15 ? maxAtk - 5 : (maxAtk > 0 ? 10 : 0);
                defBuff = maxDef >= 10 ? maxDef - 5 : 0;
            } else {
                atkBuff = maxAtk;
                defBuff = maxDef;
            }
        }
    }
    return { atk: atkBuff, def: defBuff, ki: kiBuff };
}
window.extractLinkBuffsFromDB = extractLinkBuffsFromDB;

window.switchCalcEzaForm = function(mode) {
    if (!window.currentLoadedCardMeta) return;
    const { cardId, rawCard, cardItemMeta } = window.currentLoadedCardMeta;
    loadOfficialDokkanCardIntoCalculator(cardId, rawCard, cardItemMeta, mode);
};

/* ==========================================================================
   OFFICIAL DOKKAN LOADER (CALCULATOR ENGINE)
   ========================================================================== */
async function loadOfficialDokkanCardIntoCalculator(cardId, rawCard, cardItemMeta, forcedMode = null) {
    try {
        const initialActionBox = document.getElementById('calc-initial-action-box');
        if (initialActionBox) initialActionBox.style.display = 'none';

        const studioLayout = document.getElementById('calc-studio-main-layout');
        if (studioLayout) studioLayout.style.display = 'grid';

        const deckSec = document.getElementById('sec-deck');
        if (deckSec) deckSec.classList.remove('unit-unselected');

        const deckPrompt = document.getElementById('calc-deck-select-prompt');
        if (deckPrompt) deckPrompt.style.display = 'none';

        const panelLeader = document.getElementById('panel-leader');
        if (panelLeader) panelLeader.style.display = 'block';

        const deckIconWrapper = document.getElementById('deck-icon-wrapper');
        const badgeGrid = document.getElementById('calc-icon-badge-grid');
        const charThumb = document.getElementById('calc-char-thumb');
        const deckLeaderWrapper = document.getElementById('deck-leader-wrapper');
        const deckControlsWrapper = document.getElementById('deck-controls-wrapper');

        if (deckIconWrapper) deckIconWrapper.style.display = 'flex';
        if (badgeGrid) badgeGrid.style.display = 'inline-flex';
        if (charThumb) charThumb.style.display = 'block';
        if (deckLeaderWrapper) deckLeaderWrapper.style.display = 'inline-flex';
        if (deckControlsWrapper) deckControlsWrapper.style.display = 'flex';

        const cid = parseInt(rawCard.id, 10);
        const isTransformed = cid >= 4000000 || Boolean(rawCard.is_transform || rawCard.is_transformation || rawCard.transform_type);
        const siblings = getCardSiblingsForCalc(rawCard);
        window.currentLoadedCardMeta = { cardId, rawCard, cardItemMeta, siblings };
        let mode = forcedMode;
        if (!mode) {
            if (siblings.hasSeza) mode = 'seza';
            else if (siblings.hasEza) mode = 'eza';
            else mode = 'base';
        }
        window.currentCalcEzaMode = mode;

        let targetCard = rawCard;
        if (!isTransformed) {
            if (mode === 'seza' && siblings.seza) targetCard = siblings.seza;
            else if (mode === 'eza' && siblings.eza) targetCard = siblings.eza;
            else if (siblings.base) targetCard = siblings.base;
        }

        const isLR = isCardLR(targetCard);
        const typeObj = getCardClassAndType(targetCard.element !== undefined ? targetCard.element : targetCard.attribute);
        const cardType = typeObj.cardType;
        const cardClass = typeObj.cardClass;

        window.currentCalcType = cardType.toUpperCase();
        window.currentCalcClass = (cardClass || 'super').toLowerCase() === 'extreme' ? 'Extreme' : 'Super';

        setCalculatorTypeTheme(cardType);
        setupFamilyFormsForDeck(targetCard);

        const ezaToggleBar = document.getElementById('calc-eza-toggle-bar');
        const btnBase = document.getElementById('calc-form-btn-base');
        const btnEza = document.getElementById('calc-form-btn-eza');
        const btnSeza = document.getElementById('calc-form-btn-seza');

        // For transformed cards, check the BASE card's siblings for EZA/SEZA
        let baseSiblings = siblings;
        if (isTransformed && window.DB && Array.isArray(DB.cards)) {
            const rootId = (typeof getRootParentId === 'function') ? getRootParentId(rawCard) : Math.floor(cid / 10) * 10;
            const baseCard = DB.cards.find(c => {
                const bId = parseInt(c.id, 10);
                return bId === rootId && bId < 4000000;
            });
            if (baseCard) baseSiblings = getCardSiblingsForCalc(baseCard);
        }

        if (ezaToggleBar) {
            if (baseSiblings.hasEza || baseSiblings.hasSeza) {
                ezaToggleBar.style.display = 'block';
                if (btnBase) { btnBase.style.display = 'inline-block'; btnBase.classList.toggle('active', mode === 'base'); }
                if (btnEza) { btnEza.style.display = baseSiblings.hasEza ? 'inline-block' : 'none'; btnEza.classList.toggle('active', mode === 'eza'); }
                if (btnSeza) { btnSeza.style.display = baseSiblings.hasSeza ? 'inline-block' : 'none'; btnSeza.classList.toggle('active', mode === 'seza'); }
            } else {
                ezaToggleBar.style.display = 'none';
            }
        }

        toggleCalcRarity(isLR ? 'LR' : 'TUR', true);
        if (typeof updateKiSliderDisplay === 'function') updateKiSliderDisplay();

        const isEZA = (mode === 'eza' || mode === 'seza');
        const isSEZA = (mode === 'seza');
        window.currentCalcEza = isEZA;

        let baseAtk = targetCard.atk || targetCard.stat_atk_max || 10000;
        let baseDef = targetCard.def || targetCard.stat_def_max || 6000;
        
        if (isEZA && !isLR) {
            const mult = isSEZA ? 1.48 : 1.3484;
            baseAtk = Math.round(baseAtk * mult);
            baseDef = Math.round(baseDef * mult);
        }

        const rainbowBonus = {
            agl: { atk: 5000, def: 5400 },
            teq: { atk: 5400, def: 5000 },
            int: { atk: 5000, def: 5000 },
            str: { atk: 5400, def: 4600 },
            phy: { atk: 5000, def: 4600 }
        }[cardType] || { atk: 5000, def: 5000 };

        cardParsedStats.rainbow100.atk = baseAtk + rainbowBonus.atk;
        cardParsedStats.rainbow100.def = baseDef + rainbowBonus.def;
        cardParsedStats.hipo55.atk = baseAtk + 2000;
        cardParsedStats.hipo55.def = baseDef + 2000;

        applyHipoPreset(currentHipoPreset);

        const { title, name } = parseTitleAndName(targetCard);
        const nameEl = document.getElementById('calc-char-name-text');
        const titleEl = document.getElementById('calc-char-title-text');
        if (nameEl) nameEl.innerText = name || "Official Unit";
        if (titleEl) titleEl.innerText = title || targetCard.title || "";

        const exactIdStr = String(targetCard.id);
        const folderId = exactIdStr.length >= 7 ? exactIdStr.substring(0, 7) : exactIdStr;
        const circleCardId = folderId.length > 1 ? `${folderId.slice(0, -1)}0` : folderId;
        const parentFolderId = isTransformed ? folderId : Math.floor(getRootParentId(targetCard) / 10) * 10;
        
        const thumbImg = document.getElementById('calc-char-thumb');
        if (thumbImg) {
            thumbImg.classList.remove('is-fallback-thumb');
            thumbImg.src = `assets/card/${circleCardId}/card_${circleCardId}_circle.png`;
            thumbImg.setAttribute('onerror', `this.onerror=null; this.classList.add('is-fallback-thumb'); this.src='https://images.weserv.nl/?url=dokkaninfo.com/assets/japan/character/thumb/card_${folderId}_thumb/card_${folderId}_thumb.png'`);
        }

        const composedIcon = document.getElementById('calc-composed-card-icon');
        if (composedIcon) composedIcon.dataset.type = cardType;

        const frameImg = document.getElementById('calc-frame-img');
        if (frameImg) frameImg.src = `${CALC_ASSET_URL}frame_${cardType}.png`;
        
        const rarityImg = document.getElementById('calc-rarity-img');
        if (rarityImg) rarityImg.src = `${CALC_ASSET_URL}rarity_${isLR ? 'LR' : 'TUR'}.png`;

        const typeImg = document.getElementById('calc-type-img');
        if (typeImg) typeImg.src = `${CALC_ASSET_URL}${cardClass}_type_${cardType}.png`;

        const awkImg = document.getElementById('calc-awakening-img');
        if (awkImg) {
            if (isSEZA) {
                awkImg.src = `${CALC_ASSET_URL}superza_abs.png`;
                awkImg.style.display = 'block';
            } else if (isEZA) {
                awkImg.src = `${CALC_ASSET_URL}eza_abs.png`;
                awkImg.style.display = 'block';
            } else {
                awkImg.style.display = 'none';
            }
        }

        const leadObj = findLeaderObjForCalc(targetCard, mode);
        let leaderText = leadObj ? (leadObj.description || leadObj.effect || leadObj.details) : (targetCard.leader_skill || "");
        if (leaderText) {
            document.getElementById('calc-lead').value = parseLeaderSkillValue(leaderText);
            let cleanText = typeof formatOfficialText === 'function' ? formatOfficialText(leaderText, false) : leaderText;
            cleanText = cleanText.replace(/<[^>]*>?/gm, '').replace(/(?:\r\n|\r|\n|\\n)/g, ' ').replace(/\s{2,}/g, ' ').trim();
            document.getElementById('calc-char-leader-text').innerText = cleanText;
        } else {
            document.getElementById('calc-char-leader-text').innerText = "Leader Skill Active";
        }
        syncLeaderPillsFromInput();

        activeCharacterLinks = [];
        let rawLinks = targetCard.links || targetCard.link_skill_ids || [];
        rawLinks.forEach(linkItem => {
            let linkName = typeof linkItem === 'object' ? linkItem.name : (DB.links && DB.links[linkItem] ? DB.links[linkItem].name : linkItem);
            if (!linkName) return;
            const buffs = extractLinkBuffsFromDB(linkName, linkItem);

            activeCharacterLinks.push({
                key: linkName.toLowerCase(),
                name: linkName.toUpperCase(),
                active: true,
                rawObj: linkItem,
                atk: buffs.atk,
                def: buffs.def
            });
        });
        renderLinkSkillBadges();

        let passObj = getCardPassiveObjectForCalc(targetCard, mode);
        if (!passObj) {
            passObj = {
                name: targetCard.passive_skill_name || "Passive Skill",
                description: targetCard.passive_skill || targetCard.passive_description || ""
            };
        }

        let rawPassiveName = passObj.name || "Passive Skill";
        rawPassiveName = rawPassiveName.replace(/\s*\(Super Extreme.*?\)$/i, '').replace(/\s*\(Extreme.*?\)$/i, '').trim();

        if (isSEZA) rawPassiveName += " (Super Extreme)";
        else if (isEZA) rawPassiveName += " (Extreme)";

        const passTitleEl = document.getElementById('calc-passive-name-title');
        if (passTitleEl) passTitleEl.innerText = rawPassiveName;

        let rawPassive = passObj?.itemized_description || passObj?.description || targetCard.passive_skill || "";
        if (typeof formatOfficialText === 'function') {
            rawPassive = formatOfficialText(rawPassive, false); 
        }

        if (rawPassive) {
            const tempContainer = document.createElement('div');
            let cleanRaw = rawPassive.replace(/<br\s*\/?>/gi, '\n');
            let parts = cleanRaw.split(/\*([^*]+)\*/g);
            let currentSectionHeader = "Basic effect(s)";
            let currentItems = [];
            
            const buildSection = (header, items) => {
                if (items.length === 0) return '';
                return `<div class="passive-section"><strong class="header">${header}</strong><ul>` + items.map(i => `<li>${i}</li>`).join('') + `</ul></div>`;
            };

            let htmlAccum = "";
            for (let i = 0; i < parts.length; i++) {
                let chunk = parts[i].trim();
                if (!chunk) continue;

                if (i % 2 === 1) { 
                    if (currentItems.length > 0) {
                        htmlAccum += buildSection(currentSectionHeader, currentItems);
                        currentItems = [];
                    }
                    currentSectionHeader = chunk;
                } else { 
                    let lines = chunk.split('\n').map(l => l.trim()).filter(Boolean);
                    lines.forEach(line => {
                        let cleanLine = line.replace(/^-/, '').trim();
                        if (cleanLine) {
                            if (line.startsWith('-')) {
                                currentItems.push(cleanLine);
                            } else if (currentItems.length > 0) {
                                currentItems[currentItems.length - 1] += ' ' + cleanLine; 
                            } else {
                                currentItems.push(cleanLine);
                            }
                        }
                    });
                }
            }
            if (currentItems.length > 0) {
                htmlAccum += buildSection(currentSectionHeader, currentItems);
            }

            tempContainer.innerHTML = htmlAccum;
            parseAndRenderInteractivePassiveCard(tempContainer);
        } else {
            const passiveCard = document.getElementById('calc-passive-toggles-card');
            if (passiveCard) passiveCard.style.display = 'none';
        }

        // --- ACTIVE SKILL AND DOMAIN PARSING (CALCULATOR ENGINE) ---
        const activeWrapper = document.getElementById('acc-active-skill-wrapper');
        const domainWrapper = document.getElementById('acc-domain-wrapper');
        
        let activeObj = null;
        if (targetCard.active_id && window.DB && DB.actives) {
            activeObj = DB.actives[String(targetCard.active_id)] || (Array.isArray(DB.actives) ? DB.actives.find(a => a.id == targetCard.active_id) : null);
        }
        
        const panelActive = document.getElementById('panel-active');
        const panelDomain = document.getElementById('panel-domain');

        if (activeObj && activeWrapper) {
            activeWrapper.style.display = 'block';
            if (panelActive) panelActive.style.display = 'block';
            const titleEl = document.getElementById('calc-active-skill-title');
            const condRow = document.getElementById('calc-active-cond-row');
            const condEl = document.getElementById('calc-active-skill-cond');
            const effectEl = document.getElementById('calc-active-skill-desc');

            const activeTitle = activeObj.name || targetCard.active_skill_name || "Active Skill";
            const activeCond = activeObj.condition || activeObj.conditions || activeObj.condition_description || activeObj.details || targetCard.active_skill_condition || targetCard.active_condition || "";
            const activeEff = activeObj.description || activeObj.itemized_description || activeObj.effect || activeObj.effect_description || targetCard.active_skill || targetCard.active_description || "";

            if (titleEl) titleEl.innerText = activeTitle;
            if (condRow && condEl) {
                if (activeCond) {
                    condRow.style.display = 'flex';
                    condEl.innerHTML = typeof formatOfficialText === 'function' ? formatOfficialText(activeCond, false) : activeCond;
                } else {
                    condRow.style.display = 'none';
                }
            }
            if (effectEl) {
                effectEl.innerHTML = typeof formatOfficialText === 'function' ? formatOfficialText(activeEff, false) : activeEff;
            }
            
            const lowActive = (activeEff + " " + activeCond).toLowerCase();
            const isAttackActive = activeObj.is_attack || /causes\s+(ultimate|mega-colossal|colossal|immense|supreme|extreme)\s+damage/i.test(lowActive) || lowActive.includes('ultimate damage');

            const isAttackChk = document.getElementById('calc-active-is-attack');
            if (isAttackChk) isAttackChk.checked = isAttackActive;

            const parsedActiveBuffs = parseActiveSkillBuffValues(activeEff);
            const tempAtk = parsedActiveBuffs.tempAtk;
            
            const tempAtkInput = document.getElementById('calc-active-temp-atk');
            if (tempAtkInput) tempAtkInput.value = tempAtk;

            const activeSaTypeSel = document.getElementById('calc-active-sa-type');
            if (activeSaTypeSel) {
                if (activeObj.exact_multiplier && isAttackActive) {
                    const exactVal = parseInt(activeObj.exact_multiplier, 10);
                    let opt = activeSaTypeSel.querySelector(`option[value="${exactVal}"]`);
                    if (!opt) {
                        opt = document.createElement('option');
                        opt.value = exactVal;
                        opt.innerText = `Custom (${exactVal}%)`;
                        activeSaTypeSel.appendChild(opt);
                    }
                    activeSaTypeSel.value = exactVal;
                } else {
                    if (lowActive.includes('ultimate damage')) activeSaTypeSel.value = "550";
                    else if (lowActive.includes('mega-colossal')) activeSaTypeSel.value = "495";
                    else if (lowActive.includes('immense')) activeSaTypeSel.value = "430";
                    else activeSaTypeSel.value = "550";
                }
            }

            const activeAtkVal = lowActive.includes('domain') ? 0 : parsedActiveBuffs.activeAtk;
            const activeDefVal = lowActive.includes('domain') ? 0 : parsedActiveBuffs.activeDef;

            const aAtkIn = document.getElementById('calc-active-atk');
            const aDefIn = document.getElementById('calc-active-def');
            if (aAtkIn) aAtkIn.value = activeAtkVal;
            if (aDefIn) aDefIn.value = activeDefVal;
            
            const chk = document.getElementById('calc-active-skill-active');
            if (chk) chk.checked = false;

        } else if (activeWrapper) {
            activeWrapper.style.display = 'none';
            if (panelActive) panelActive.style.display = 'none';
        }

        let fieldObj = null;
        if (targetCard.field_id && window.DB && DB.fields) fieldObj = DB.fields[targetCard.field_id] || DB.fields[String(targetCard.field_id)];
        
        if (fieldObj && domainWrapper) {
            const fName = fieldObj.name || "Dokkan Field";
            const fCond = fieldObj.condition || fieldObj.conditions || fieldObj.details || targetCard.field_condition || "";
            const fDesc = fieldObj.description || fieldObj.itemized_description || fieldObj.effect || targetCard.field_description || "";
            
            domainWrapper.style.display = 'block';
            if (panelDomain) panelDomain.style.display = 'block';
            const dT = document.getElementById('calc-domain-title');
            const dCondRow = document.getElementById('calc-domain-cond-row');
            const dCond = document.getElementById('calc-domain-cond');
            const dD = document.getElementById('calc-domain-desc');
            if (dT) dT.innerText = fName;
            if (dCondRow && dCond) {
                if (fCond) {
                    dCondRow.style.display = 'flex';
                    dCond.innerHTML = typeof formatOfficialText === 'function' ? formatOfficialText(fCond, false) : fCond;
                } else {
                    dCondRow.style.display = 'none';
                }
            }
            if (dD) dD.innerHTML = typeof formatOfficialText === 'function' ? formatOfficialText(fDesc, false) : fDesc;
            
            let domainAtkVal = 0;
            let domainDefVal = 0;
            const plusMatches = [...fDesc.matchAll(/(ATK\s*(?:&|and)\s*DEF|DEF\s*(?:&|and)\s*ATK|ATK|DEF)[^\d%]*\+\s*(\d+)%/gi)];
            plusMatches.forEach(m => {
                const typeStr = m[1].toUpperCase();
                const val = parseInt(m[2], 10);
                if (typeStr.includes('ATK') && typeStr.includes('DEF')) { domainAtkVal += val; domainDefVal += val; }
                else if (typeStr.includes('ATK')) domainAtkVal += val;
                else if (typeStr.includes('DEF')) domainDefVal += val;
            });

            const dAtkIn = document.getElementById('calc-domain-atk');
            const dDefIn = document.getElementById('calc-domain-def');
            if (dAtkIn) dAtkIn.value = domainAtkVal;
            if (dDefIn) dDefIn.value = domainDefVal;
            
            const dChk = document.getElementById('calc-domain-active');
            if (dChk) dChk.checked = false;
        } else if (domainWrapper) {
            domainWrapper.style.display = 'none';
        }

        const tabActive = document.getElementById('tab-btn-active');
        const tabDomain = document.getElementById('tab-btn-domain');
        if (tabActive) tabActive.style.display = (activeObj && activeWrapper) ? 'flex' : 'none';
        if (tabDomain) tabDomain.style.display = (fieldObj && domainWrapper) ? 'flex' : 'none';

        // --- ACCURATE RESOLUTION OF ALL SUPER ATTACKS & UNIT SAs ---
        const rawList = typeof getSuperAttacksForCard === 'function' 
            ? getSuperAttacksForCard(targetCard, mode) 
            : (targetCard.super_attacks || []);

        const saBlocksData = [];
        rawList.forEach((specObj, idx) => {
            let saName = specObj.name || specObj.special_name || specObj.title || "Super Attack";
            let rawDesc = specObj.description || specObj.itemized_description || specObj.effect || "";
            let activationText = specObj.causality_description || specObj.condition || "";

            let isEX = specObj.is_ex === true || 
                       String(specObj.style || '').toLowerCase() === 'extra' ||
                       /\bex\s+super\b|\bex\b/i.test(saName);

            // STRICT UNIT SA DETECTION
            let isUnitSa = false;
            if (typeof isStrictUnitSuperAttack === 'function') {
                isUnitSa = isStrictUnitSuperAttack(specObj);
            } else {
                isUnitSa = specObj.is_unit_sa === true || 
                           (specObj.type_label || '').toLowerCase().includes("unit") || 
                           saName.toLowerCase().includes("unit") || 
                           /whose\s+name\s+includes|when\s+an?\s+ally/i.test(activationText.toLowerCase());
            }

            let startKi = specObj.eball_num_start || specObj.need_ki || 0;
            let endKi = specObj.eball_num_end || 0;
            let isUnitUltra = isUnitSa && (startKi >= 18 || (isLR && idx >= 1));

            let typeLabel = "Super Attack";
            if (isEX) typeLabel = "EX Super Attack";
            else if (isUnitUltra) typeLabel = "Unit Ultra Super Attack";
            else if (isUnitSa) typeLabel = "Unit Super Attack";
            else if (isLR) typeLabel = (idx === 0 ? "Super Attack" : "Ultra Super Attack");

            let kiText = "";
            if (startKi > 0) {
                if (endKi > 0 && endKi < 24 && endKi !== startKi) {
                    kiText = `${startKi}~${endKi} Ki`;
                } else {
                    kiText = `${startKi} Ki`;
                }
            } else {
                startKi = isLR ? (idx === 0 ? 12 : 18) : 12;
                kiText = isLR ? (idx === 0 ? '12 Ki' : '18 Ki') : '12 Ki';
            }

            let calculatedExactMult = specObj.exact_multiplier || specObj.multiplier || specObj.power;
            if (isEX && calculatedExactMult) {
                calculatedExactMult = parseInt(calculatedExactMult, 10);
            } else if (isEX) {
                calculatedExactMult = isLR ? (startKi >= 18 ? 710 : 540) : 690;
            } else if (isUnitSa || isUnitUltra) {
                calculatedExactMult = isLR ? (startKi >= 18 ? 590 : 445) : (isEZA ? 580 : 505);
            } else {
                if (isLR) {
                    calculatedExactMult = (idx === 0) ? (isEZA ? 445 : 395) : (isEZA ? 590 : 540);
                } else {
                    calculatedExactMult = isEZA ? 580 : 505;
                }
            }

            saBlocksData.push({
                typeLabel: typeLabel,
                saName: saName,
                eff: typeof parseSaEffect === 'function' ? parseSaEffect(rawDesc) : { atk: 30, def: 0 },
                fullText: typeof formatOfficialText === 'function' ? formatOfficialText(rawDesc, false) : rawDesc,
                activationText: activationText,
                condition: activationText,
                is_ex: isEX,
                is_unit_sa: isUnitSa,
                is_unit_ultra: isUnitUltra,
                style: specObj.style || (isEX ? "Extra" : ""),
                ex_type: specObj.ex_type || null,
                eball_num_start: startKi,
                eball_num_end: endKi,
                startKi: startKi,
                endKi: endKi,
                kiText: kiText,
                exact_multiplier: calculatedExactMult
            });
        });

        if (saBlocksData.length === 0) {
            saBlocksData.push({ typeLabel: isLR ? "Ultra SA" : "SA", saName: "Super Attack", eff: { atk: 30, def: 0 }, fullText: "", is_ex: false, is_unit_sa: false, style: "", ex_type: null, eball_num_start: isLR ? 18 : 12, startKi: isLR ? 18 : 12, kiText: isLR ? "18 Ki" : "12 Ki", exact_multiplier: isLR ? 540 : 505 });
        }

        window.lastParsedSaBlocksData = saBlocksData;
        window.activeUnitSaBlockIdx = null; 
        renderDynamicSaRows(saBlocksData, isLR, isEZA);

        calculateDokkanStats();

    } catch (e) {
        console.error("Error loading official card into Calculator:", e);
    }
}

/* ==========================================================================
   TRANSFORMATION FORMS DISCOVERY & SWITCHER LOGIC
   ========================================================================== */
function setupFamilyFormsForDeck(targetCard) {
    const formSwitcher = document.getElementById('deck-form-switcher');
    if (!formSwitcher) return;

    window.currentFamilyForms = [];

    if (window.currentLoadedCardMeta?.cardItemMeta?.source === 'custom') {
        formSwitcher.style.display = 'none';
        formSwitcher.innerHTML = '';
        return;
    }

    if (window.DB && Array.isArray(DB.cards)) {
        const targetId = parseInt(targetCard.id, 10);
        const rootId = (typeof getRootParentId === 'function') ? getRootParentId(targetCard) : Math.floor(targetId / 10) * 10;
        const stem = String(targetId).substring(1, 6);

        const familyStandard = DB.cards.filter(c => {
            const cId = parseInt(c.id, 10);
            if (cId >= 4000000 || String(cId).length >= 8) return false;
            const cRoot = (typeof getRootParentId === 'function') ? getRootParentId(c) : Math.floor(cId / 10) * 10;
            return cRoot === rootId || cId === rootId;
        });

        familyStandard.sort((a, b) => {
            const aIsLR = isCardLR(a);
            const bIsLR = isCardLR(b);
            if (aIsLR !== bIsLR) return aIsLR ? -1 : 1;
            const aMax = a.max_level || 100;
            const bMax = b.max_level || 100;
            if (aMax !== bMax) return bMax - aMax;
            return parseInt(b.id, 10) - parseInt(a.id, 10);
        });

        const highestBase = familyStandard[0] || (targetId < 4000000 ? targetCard : null);

        const familyTransforms = DB.cards.filter(c => {
            const cId = parseInt(c.id, 10);
            if (cId < 4000000 || cId >= 5000000) return false;
            const cRoot = (typeof getRootParentId === 'function') ? getRootParentId(c) : 0;
            const cParent = parseInt(c.parent_id || 0, 10);
            const cStem = String(cId).substring(1, 6);
            return (highestBase && cParent === parseInt(highestBase.id, 10)) || 
                   (cRoot !== 0 && cRoot === rootId) || 
                   cParent === rootId || 
                   cStem === stem;
        });

        const allForms = [];
        if (highestBase) allForms.push(highestBase);
        familyTransforms.forEach(tf => {
            if (!allForms.some(f => parseInt(f.id, 10) === parseInt(tf.id, 10))) {
                allForms.push(tf);
            }
        });

        window.currentFamilyForms = allForms;
    }

    if (window.currentFamilyForms && window.currentFamilyForms.length > 1) {
        renderDeckFamilyForms(targetCard, formSwitcher);
    } else {
        formSwitcher.style.display = 'none';
        formSwitcher.innerHTML = '';
    }
}

function renderDeckFamilyForms(targetCard, container) {
    const currentId = parseInt(targetCard.id, 10);
    
    // Check if the current ID is actually in the list. If not, default to the first element (base form)
    const isIdInForms = window.currentFamilyForms.some(f => parseInt(f.id, 10) === currentId);
    
    container.innerHTML = window.currentFamilyForms.map((form, idx) => {
        const id = String(form.id);
        const folderId = id.length >= 7 ? id.substring(0, 7) : id;
        const parentFolderId = Math.floor(getRootParentId(form) / 10) * 10;
        const circleCardId = folderId.length > 1 ? `${folderId.slice(0, -1)}0` : folderId;
        const circleUrl = `assets/card/${circleCardId}/card_${circleCardId}_circle.png`;
        const thumbUrl = `https://images.weserv.nl/?url=dokkaninfo.com/assets/japan/character/thumb/card_${folderId}_thumb/card_${folderId}_thumb.png`;
        
        let isCurrent = false;
        if (isIdInForms) {
            isCurrent = parseInt(form.id, 10) === currentId;
        } else {
            isCurrent = (idx === 0);
        }

        const state = isCurrent ? ' is-active' : '';
        const label = parseTitleAndName(form).name;
        
        let cType = 'agl';
        if (form.type) {
            cType = form.type.toLowerCase();
        } else if (typeof getCardClassAndType === 'function') {
            const typeObj = getCardClassAndType(form.element !== undefined ? form.element : form.attribute);
            cType = typeObj.cardType.toLowerCase();
        }
        
        return `<button type="button" class="deck-form-icon${state}" data-type="${cType}" onclick="window.selectDeckFamilyForm(${form.id})" title="Switch to ${label}" aria-label="Switch to ${label}" ${isCurrent ? 'aria-current="true"' : ''}>
            <img class="deck-form-icon-circle" src="${circleUrl}" loading="lazy" onerror="this.onerror=null; this.src='${thumbUrl}'" alt="">
        </button>`;
    }).join('');
    container.style.display = 'flex';
}

window.selectDeckFamilyForm = function(cardId) {
    const target = window.currentFamilyForms?.find(form => parseInt(form.id, 10) === parseInt(cardId, 10));
    if (target) loadOfficialDokkanCardIntoCalculator(target.id, target, null, window.currentCalcEzaMode || null);
};

window.handleFormSwitchClick = function() {
    if (!window.currentFamilyForms || window.currentFamilyForms.length <= 1) return;
    const currentLoadedId = parseInt(window.currentLoadedCardMeta?.rawCard?.id || 0, 10);

    if (window.currentFamilyForms.length === 2) {
        const nextForm = window.currentFamilyForms.find(f => parseInt(f.id, 10) !== currentLoadedId) || window.currentFamilyForms[0];
        loadOfficialDokkanCardIntoCalculator(nextForm.id, nextForm, null);
        return;
    }

    window.openFormPickerModal();
};

window.openFormPickerModal = function() {
    const modal = document.getElementById('calc-form-picker-modal');
    const grid = document.getElementById('formPickerGrid');
    if (!modal || !grid || !window.currentFamilyForms) return;

    const currentLoadedId = parseInt(window.currentLoadedCardMeta?.rawCard?.id || 0, 10);

    grid.innerHTML = window.currentFamilyForms.map(f => {
        const exactCardId = String(f.id);
        const folderId = exactCardId.length >= 7 ? exactCardId.substring(0, 7) : exactCardId;
        const parentFolderId = Math.floor(getRootParentId(f) / 10) * 10;
        const typeObj = getCardClassAndType(f.element !== undefined ? f.element : f.attribute);
        const titleObj = parseTitleAndName(f);
        const frameSrc = `${CALC_ASSET_URL}frame_${typeObj.cardType || 'agl'}.png`;
        const thumbUrl = `https://images.weserv.nl/?url=dokkaninfo.com/assets/japan/character/thumb/card_${folderId}_thumb/card_${folderId}_thumb.png`;

        const isCurrent = parseInt(f.id, 10) === currentLoadedId;
        const isTransformed = parseInt(f.id, 10) >= 4000000;
        const formTag = isTransformed ? 'FORM' : 'BASE';
        const tagColor = isTransformed ? 'linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)' : 'linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)';

        return `
        <div class="picker-unit-card" style="${isCurrent ? 'border-color: #38bdf8; background: rgba(56, 189, 248, 0.25);' : ''}" onclick="window.selectFormFromPicker(${f.id})">
            <div class="picker-thumb-wrapper">
                <span style="position: absolute; top: -3px; left: -3px; background: ${tagColor}; color: #fff; font-size: 7.5px; font-weight: 900; padding: 1px 4px; border-radius: 3px; z-index: 10; box-shadow: 0 1px 3px rgba(0,0,0,0.5);">${formTag}</span>
                <img class="picker-frame" src="${frameSrc}" loading="lazy">
                <img class="picker-thumb" src="${thumbUrl}" loading="lazy" onerror="window.handleHubThumbError(this, '${folderId}', '${parentFolderId}')">
            </div>
            <span class="picker-name" style="font-size: 9.5px; font-weight: 800;">${titleObj.name}</span>
            <span class="picker-sub" style="color: ${isCurrent ? '#38bdf8' : '#94a3b8'}; font-weight: 800;">${isCurrent ? '● Active' : (isCardLR(f) ? 'LR' : 'TUR')}</span>
        </div>`;
    }).join('\n');

    modal.style.display = 'flex';
};

window.closeFormPickerModal = function() {
    const modal = document.getElementById('calc-form-picker-modal');
    if (modal) modal.style.display = 'none';
};

window.selectFormFromPicker = function(formCardId) {
    window.closeFormPickerModal();
    if (!window.currentFamilyForms) return;
    const target = window.currentFamilyForms.find(f => parseInt(f.id, 10) === parseInt(formCardId, 10));
    if (target) {
        loadOfficialDokkanCardIntoCalculator(target.id, target, null);
    }
};

/* ==========================================================================
   CUSTOM CARD LOADER
   ========================================================================== */
async function loadCustomCardDocIntoCalculator(cardItem) {
    const initialActionBox = document.getElementById('calc-initial-action-box');
    if (initialActionBox) initialActionBox.style.display = 'none';

    const studioLayout = document.getElementById('calc-studio-main-layout');
    if (studioLayout) studioLayout.style.display = 'grid';

    const deckSec = document.getElementById('sec-deck');
    if (deckSec) deckSec.classList.remove('unit-unselected');

    const deckPrompt = document.getElementById('calc-deck-select-prompt');
    if (deckPrompt) deckPrompt.style.display = 'none';

    const panelLeader = document.getElementById('panel-leader');
    if (panelLeader) panelLeader.style.display = 'block';

    const deckIconWrapper = document.getElementById('deck-icon-wrapper');
    const badgeGrid = document.getElementById('calc-icon-badge-grid');
    const charThumb = document.getElementById('calc-char-thumb');
    const deckLeaderWrapper = document.getElementById('deck-leader-wrapper');
    const deckControlsWrapper = document.getElementById('deck-controls-wrapper');

    if (deckIconWrapper) deckIconWrapper.style.display = 'flex';
    if (badgeGrid) badgeGrid.style.display = 'inline-flex';
    if (charThumb) charThumb.style.display = 'block';
    if (deckLeaderWrapper) deckLeaderWrapper.style.display = 'inline-flex';
    if (deckControlsWrapper) deckControlsWrapper.style.display = 'flex';

    let doc = cardItem.doc;
    if (!doc || typeof doc.querySelector !== 'function') {
        if (cardItem.htmlText) {
            doc = new DOMParser().parseFromString(cardItem.htmlText, 'text/html');
            cardItem.doc = doc;
        } else {
            console.error("No valid document found for custom card:", cardItem);
            return;
        }
    }

    let htmlText = cardItem.htmlText || doc.documentElement.innerHTML || '';
    if (!cardItem.cardUrl) {
        const encodedPath = String(cardItem.repoPath || cardItem.id || '')
            .split('/')
            .filter(Boolean)
            .map(encodeURIComponent)
            .join('/');
        cardItem.cardUrl = `https://abscustom.github.io/${encodedPath}/`;
    }
    cardItem.doc = doc;
    window.currentLoadedCardMeta = {
        cardId: cardItem.id,
        rawCard: null,
        cardItemMeta: cardItem,
        siblings: null
    };
    window.currentFamilyForms = [];

    const exactRarity = getCustomCardRarityFromDoc(doc, htmlText);
    const isLR = exactRarity === 'LR';
    cardItem.rarity = exactRarity;

    const kiSlider = document.getElementById('calc-ki-slider');
    if (kiSlider) {
        kiSlider.max = isLR ? "24" : "12";
        kiSlider.min = isLR ? "12" : "1";
    }
    toggleCalcRarity(isLR ? 'LR' : 'TUR', true);
    if (typeof updateKiSliderDisplay === 'function') updateKiSliderDisplay();

    const isEZA = htmlText.includes('eza_abs.png') || htmlText.includes('superza_abs.png') || false;
    const ezaBox = document.getElementById('calc-is-eza');
    if (ezaBox) ezaBox.checked = isEZA;
    window.currentCalcEza = isEZA;

    const ezaToggleBar = document.getElementById('calc-eza-toggle-bar');
    if (ezaToggleBar) ezaToggleBar.style.display = 'none';

    const getNum = (selector) => {
        const el = doc.querySelector(selector);
        if (!el) return 0;
        return parseInt(el.textContent.replace(/[^0-9]/g, ''), 10) || 0;
    };

    let atk100 = getNum('#stat-atk-100') || getNum('#abs-stat-atk-val') || 19995;
    let def100 = getNum('#stat-def-100') || getNum('#abs-stat-def-val') || 14869;
    cardParsedStats.rainbow100.atk = atk100;
    cardParsedStats.rainbow100.def = def100;
    cardParsedStats.hipo55.atk = getNum('#stat-atk-55') || (atk100 - 3400);
    cardParsedStats.hipo55.def = getNum('#stat-def-55') || (def100 - 3000);

    applyHipoPreset(currentHipoPreset);

    const nameEl = document.getElementById('calc-char-name-text');
    const titleEl = document.getElementById('calc-char-title-text');
    if (nameEl) nameEl.innerText = cardItem.name;
    if (titleEl) titleEl.innerText = doc.querySelector('#char-description, #abs-char-title')?.textContent || 'Custom Unit';
    
    const cardType = cardItem.type || 'agl';
    const cardClassKey = cardItem.cardClass || getCustomCardClassFromDoc(doc, htmlText);
    const cardClass = cardClassKey === 'extreme' ? 'Extreme' : 'Super';

    window.currentCalcType = cardType.toUpperCase();
    window.currentCalcClass = cardClass;

    setCalculatorTypeTheme(cardType);

    const composedIcon = document.getElementById('calc-composed-card-icon');
    if (composedIcon) composedIcon.dataset.type = cardType;

    if (cardItem.thumbUrl) {
        const thumbImg = document.getElementById('calc-char-thumb');
        if (thumbImg) {
            thumbImg.removeAttribute('onerror');
            thumbImg.classList.remove('is-fallback-thumb');
            thumbImg.src = cardItem.thumbUrl;
        }
    }
    
    const frameImg = document.getElementById('calc-frame-img');
    if (frameImg) frameImg.src = `${CALC_ASSET_URL}frame_${cardType}.png`;
    
    const rarityImgUi = document.getElementById('calc-rarity-img');
    if (rarityImgUi) rarityImgUi.src = `${CALC_ASSET_URL}rarity_${isLR ? 'LR' : 'TUR'}.png`;

    const typeImg = document.getElementById('calc-type-img');
    if (typeImg) typeImg.src = `${CALC_ASSET_URL}${cardClassKey}_type_${cardType}.png`;

    const awkImg = document.getElementById('calc-awakening-img');
    if (awkImg) awkImg.style.display = isEZA ? 'block' : 'none';

    const leaderText = doc.querySelector('#leader-skill, #abs-leader-skill, #leader-desc')?.textContent || '';
    if (leaderText) {
        document.getElementById('calc-lead').value = parseLeaderSkillValue(leaderText);
        let cleanText = leaderText.replace(/<[^>]*>?/gm, '').replace(/(?:\r\n|\r|\n|\\n)/g, ' ').replace(/\s{2,}/g, ' ').trim();
        document.getElementById('calc-char-leader-text').innerText = cleanText;
    }
    syncLeaderPillsFromInput();

    activeCharacterLinks = [];
    let detectedLinkKeys = new Set();
    const linkNodes = doc.querySelectorAll('.abs-link-name, #card-link-container a, .link-name');
    
    linkNodes.forEach(node => {
        const linkName = node.textContent.trim();
        if (linkName) detectedLinkKeys.add(linkName);
    });

    detectedLinkKeys.forEach(linkName => {
        const buffs = extractLinkBuffsFromDB(linkName, null, window.currentLinkLevel || 10);
        activeCharacterLinks.push({
            key: linkName.toLowerCase(),
            name: linkName.toUpperCase(),
            active: true,
            rawObj: linkName,
            atk: buffs.atk,
            def: buffs.def
        });
    });
    renderLinkSkillBadges();

    let pContainer = doc.querySelector('#card-passive-container, #abs-passive-container, .passive-container-main');
    if (pContainer) {
        parseAndRenderInteractivePassiveCard(pContainer);
    } else {
        const pt = document.getElementById('calc-passive-toggles-card');
        if (pt) pt.style.display = 'none';
    }

    // --- ACTIVE SKILL AND DOMAIN PARSING (CALCULATOR ENGINE) ---
    const activeBlocks = doc.querySelectorAll('.active-block, #card-active-container, #abs-active-container, .active-container, .domain-block, .domain-box, #card-domain-container, #abs-domain-container');
    
    let foundActiveTitle = '';
    let foundActiveCond = '';
    let foundActiveDesc = '';
    let foundDomainTitle = '';
    let foundDomainCond = '';
    let foundDomainDesc = '';

    activeBlocks.forEach(block => {
        const typeLabel = (block.querySelector('.active-type-label, .domain-type-label, b')?.textContent || '').toLowerCase();
        const name = block.querySelector('.active-display-name, .domain-display-name, #abs-active-title, #abs-domain-title, .active-title, .domain-title')?.textContent?.trim() || '';
        let cond = block.querySelector('.active-display-condition, .active-condition, #abs-active-condition, .active-conditions, .domain-condition, #abs-domain-condition')?.textContent?.trim() || '';
        let effect = block.querySelector('.active-display-effect, .domain-display-effect, #abs-active-effect, #abs-domain-effect, .active-effect, .domain-effect')?.textContent?.trim() || '';

        if (!effect) effect = block.textContent?.trim() || '';

        if (typeLabel.includes('domain') || name.toLowerCase().includes('domain') || effect.toLowerCase().includes('domain effect')) {
            foundDomainTitle = name || "Domain Effect";
            foundDomainCond = cond;
            foundDomainDesc = effect;
        } else if (effect && effect.length > 3) {
            if (!foundActiveDesc) {
                foundActiveTitle = name || "Active Skill";
                foundActiveCond = cond;
                foundActiveDesc = effect;
            }
        }
    });

    const activeWrapper = document.getElementById('acc-active-skill-wrapper');
    const domainWrapper = document.getElementById('acc-domain-wrapper');
    const panelActive = document.getElementById('panel-active');

    if (foundActiveDesc && activeWrapper) {
        activeWrapper.style.display = 'block';
        if (panelActive) panelActive.style.display = 'block';
        const titleEl = document.getElementById('calc-active-skill-title');
        const condRow = document.getElementById('calc-active-cond-row');
        const condEl = document.getElementById('calc-active-skill-cond');
        const descEl = document.getElementById('calc-active-skill-desc');

        if (titleEl) titleEl.innerText = foundActiveTitle;
        if (condRow && condEl) {
            if (foundActiveCond) {
                condRow.style.display = 'flex';
                condEl.innerHTML = typeof formatOfficialText === 'function' ? formatOfficialText(foundActiveCond, false) : foundActiveCond;
            } else {
                condRow.style.display = 'none';
            }
        }
        if (descEl) descEl.innerHTML = typeof formatOfficialText === 'function' ? formatOfficialText(foundActiveDesc, false) : foundActiveDesc;

        const lowActive = (foundActiveDesc + " " + foundActiveCond).toLowerCase();
        const isAttackActive = /causes\s+(ultimate|mega-colossal|colossal|immense|supreme|extreme)\s+damage/i.test(lowActive) || lowActive.includes('ultimate damage');

        const isAttackChk = document.getElementById('calc-active-is-attack');
        if (isAttackChk) isAttackChk.checked = isAttackActive;

        const parsedActiveBuffs = parseActiveSkillBuffValues(foundActiveDesc);
        const tempAtk = parsedActiveBuffs.tempAtk;
        
        const tempAtkInput = document.getElementById('calc-active-temp-atk');
        if (tempAtkInput) tempAtkInput.value = tempAtk;

        const activeSaTypeSel = document.getElementById('calc-active-sa-type');
        if (activeSaTypeSel) {
            if (lowActive.includes('ultimate damage')) activeSaTypeSel.value = "550";
            else if (lowActive.includes('mega-colossal')) activeSaTypeSel.value = "495";
            else if (lowActive.includes('immense')) activeSaTypeSel.value = "430";
            else activeSaTypeSel.value = "550";
        }

        const activeAtkVal = lowActive.includes('domain') ? 0 : parsedActiveBuffs.activeAtk;
        const activeDefVal = lowActive.includes('domain') ? 0 : parsedActiveBuffs.activeDef;

        const aAtkIn = document.getElementById('calc-active-atk');
        const aDefIn = document.getElementById('calc-active-def');
        if (aAtkIn) aAtkIn.value = activeAtkVal;
        if (aDefIn) aDefIn.value = activeDefVal;
        
        const chk = document.getElementById('calc-active-skill-active');
        if (chk) chk.checked = false;

    } else if (activeWrapper) {
        activeWrapper.style.display = 'none';
    }

    if (foundDomainDesc && domainWrapper) {
        domainWrapper.style.display = 'block';
        const dT = document.getElementById('calc-domain-title');
        const dCondRow = document.getElementById('calc-domain-cond-row');
        const dCond = document.getElementById('calc-domain-cond');
        const dD = document.getElementById('calc-domain-desc');
        if (dT) dT.innerText = foundDomainTitle;
        if (dCondRow && dCond) {
            if (foundDomainCond) {
                dCondRow.style.display = 'flex';
                dCond.innerHTML = typeof formatOfficialText === 'function' ? formatOfficialText(foundDomainCond, false) : foundDomainCond;
            } else {
                dCondRow.style.display = 'none';
            }
        }
        if (dD) dD.innerHTML = typeof formatOfficialText === 'function' ? formatOfficialText(foundDomainDesc, false) : foundDomainDesc;

        let domainAtkVal = 0;
        let domainDefVal = 0;
        const plusMatches = [...foundDomainDesc.matchAll(/(ATK\s*(?:&|and)\s*DEF|DEF\s*(?:&|and)\s*ATK|ATK|DEF)[^\d%]*\+\s*(\d+)%/gi)];
        plusMatches.forEach(m => {
            const typeStr = m[1].toUpperCase();
            const val = parseInt(m[2], 10);
            if (typeStr.includes('ATK') && typeStr.includes('DEF')) { domainAtkVal += val; domainDefVal += val; }
            else if (typeStr.includes('ATK')) domainAtkVal += val;
            else if (typeStr.includes('DEF')) domainDefVal += val;
        });

        const dAtkIn = document.getElementById('calc-domain-atk');
        const dDefIn = document.getElementById('calc-domain-def');
        if (dAtkIn) dAtkIn.value = domainAtkVal;
        if (dDefIn) dDefIn.value = domainDefVal;
        
        const dChk = document.getElementById('calc-domain-active');
        if (dChk) dChk.checked = false;
    } else if (domainWrapper) {
        domainWrapper.style.display = 'none';
    }

    const tabActive = document.getElementById('tab-btn-active');
    const tabDomain = document.getElementById('tab-btn-domain');
    if (tabActive) tabActive.style.display = (foundActiveDesc && activeWrapper) ? 'flex' : 'none';
    if (tabDomain) tabDomain.style.display = (foundDomainDesc && domainWrapper) ? 'flex' : 'none';


    // Published custom pages contain both their source SA blocks and mirrored
    // display boxes. Read only one representation so each attack appears once.
    let saBlocks = Array.from(doc.querySelectorAll('#layout-dokkaninfo .sa-block'));
    if (saBlocks.length === 0) saBlocks = Array.from(doc.querySelectorAll('.sa-block'));
    if (saBlocks.length === 0) saBlocks = Array.from(doc.querySelectorAll('#abs-sa-container .abs-box'));
    let saBlocksData = [];
    saBlocks.forEach((block, idx) => {
        let textContent = block.textContent || '';
        let typeLabel = block.querySelector('.sa-type-label, .abs-header')?.textContent?.trim() || '';
        let saName = block.querySelector('.sa-display-name, .abs-sa-name-glow, .abs-sa-title-text, .abs-sa-title')?.textContent?.trim() || `Skill ${idx + 1}`;
        
        let isEX = saName.toLowerCase().includes('ex super') || textContent.toLowerCase().includes('ex super') || typeLabel.toLowerCase().includes('ex');
        let isUnitSa = typeLabel.toLowerCase().includes("unit") || saName.toLowerCase().includes("unit");

        if (isEX) {
            typeLabel = "EX Super Attack";
        } else if (isUnitSa) {
            typeLabel = "Unit Super Attack";
        } else if (!typeLabel) {
            typeLabel = isLR ? (idx === 0 ? "Super Attack" : "Ultra Super Attack") : "Super Attack";
        }

        let startKi = 12;
        let kiText = "12 Ki";
        const combinedKiSearch = (textContent + " " + typeLabel).toLowerCase();
        const kiMatch = combinedKiSearch.match(/(\d+(?:[–\-~]\d+)?)\s*ki\b/i);
        if (kiMatch) {
            kiText = `${kiMatch[1]} Ki`;
            startKi = parseInt(kiMatch[1], 10) || 12;
        } else if (isLR) {
            startKi = (idx === 0 ? 12 : 18);
            kiText = (idx === 0 ? "12 Ki" : "18 Ki");
        }

        saBlocksData.push({
            typeLabel: typeLabel,
            saName: saName,
            eff: typeof parseSaEffect === 'function' ? parseSaEffect(textContent) : {atk:30, def:0},
            fullText: typeof formatOfficialText === 'function' ? formatOfficialText(textContent, false) : textContent,
            is_ex: isEX,
            is_unit_sa: isUnitSa,
            style: isEX ? "Extra" : "",
            ex_type: isEX ? (startKi >= 18 ? "first_attack" : "additional_attack") : null,
            eball_num_start: startKi,
            startKi: startKi,
            kiText: kiText,
            causality_description: "",
            exact_multiplier: isEX ? (idx === 0 ? 740 : 540) : (isLR ? (idx === 0 ? 395 : 540) : 505)
        });
    });
    if (saBlocksData.length === 0) {
        saBlocksData = [{ typeLabel: isLR ? "Ultra SA" : "SA", saName: "Super Attack", eff: { atk: 30, def: 0 }, fullText: "", is_ex: false, is_unit_sa: false, style: "", ex_type: null, eball_num_start: isLR ? 18 : 12, startKi: isLR ? 18 : 12, kiText: isLR ? "18 Ki" : "12 Ki", exact_multiplier: isLR ? 540 : 505 }];
    }
    window.lastParsedSaBlocksData = saBlocksData;
    window.activeUnitSaBlockIdx = null;
    renderDynamicSaRows(saBlocksData, isLR, false);

    calculateDokkanStats();
}

function parseLeaderSkillValue(leaderText) {
    if (!leaderText) return 440;
    const options = leaderText.split(/;\s*or\s+|\s+or\s+/i);
    let maxOption = 0;
    options.forEach(opt => {
        let sum = 0;
        const matches = [...opt.matchAll(/(?:ATK\s*&\s*DEF|HP,\s*ATK\s*&\s*DEF|ATK|DEF)\s*\+\s*(\d+)%/gi)];
        matches.forEach(m => {
            const v = parseInt(m[1], 10);
            if (v <= 250) sum += v;
        });
        if (sum > maxOption) maxOption = sum;
    });
    return maxOption > 0 ? maxOption * 2 : 440;
}
