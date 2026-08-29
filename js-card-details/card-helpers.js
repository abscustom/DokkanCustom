window.CENTRAL_ASSET_URL = window.CENTRAL_ASSET_URL || 'https://abscustom.github.io/assets/images/';
var CENTRAL_ASSET_URL = window.CENTRAL_ASSET_URL;

window.lightningColors = window.lightningColors || {
    agl: 'rgb(0, 150, 255)',
    teq: 'rgb(0, 255, 50)',
    int: 'rgb(210, 0, 255)',
    str: 'rgb(255, 0, 0)',
    phy: 'rgb(255, 230, 0)',
    none: 'rgb(0, 150, 255)'
};
var lightningColors = window.lightningColors;

// Exact 6-digit stems for DFE LRs (card_id // 10)
const DFE_LR_STEMS = new Set([
    101215, 101216, // 3rd Anniv Vegito & Gogeta
    101589, 101590, // 4th Anniv SS4 Goku & Vegeta
    101737, 101738, // 300M AGL Gohan & INT Cell
    101889, 101890, // 5th Anniv STR Gogeta & TEQ Vegito
    102005, 102006, // 350M STR Vegito & PHY Buutenks
    102179, 102180, // 6th Anniv AGL MUI & INT SSBE
    102262, 102263, // 2021 WWC INT SS Goku & AGL FP Frieza
    102384, 102385, // 7th Anniv SS4s & Gods
    102450,         // Tanabata INT Vegeta & Trunks
    102488, 102489, // 2022 WWC STR Cooler & AGL Goku/Vegeta
    102601, 102602, // 8th Anniv PHY Z Boys & STR GT Duo
    102758, 102759, // 2023 WWC AGL Blue Boys & TEQ Zamasu
    102829,         // 9th Anniv AGL Broly (DFE)
    102831,         // 9th Anniv PHY Beast Gohan (DFE)
    102941,         // 2024 WWC INT Vegito (DFE)
    102943          // 2024 WWC STR Broly (DFE)
]);

// Verified Exact 6-digit stems for F2P LRs
const F2P_LR_STEMS = new Set([
    100840, // Prime Battle Goku (TEQ)
    100936, // Friend Summon Androids 17 & 18 (AGL)
    100984, // Prime Battle Frieza (STR)
    101016, // Hercule (AGL)
    100923, // Piccolo (INT WT)
    101214, // SBR Kid Gohan (PHY)
    101375, // Prime Battle Trunks (AGL)
    101228, // 1000 Days Goku (STR)
    101269, // Tien & Chiaotzu (AGL WT)
    101438, // Prime Battle Vegeta (INT)
    101460, // Great Saiyaman 1 & 2 (PHY)
    101519, // Yamcha & Puar (PHY WT)
    101540, // Goku & Arale (AGL)
    101542, // Goku Jr. & Vegeta Jr. (STR)
    101655, // Uub (TEQ Battlefield)
    101768, // Mecha Frieza & King Cold (STR Battlefield)
    101777, // Prime Battle Cell (INT)
    101831, // Demon King Piccolo (STR WT)
    101861, // Team Bardock (PHY)
    101968, // Zamasu Goku (STR)
    101980, // Prime Battle Krillin (PHY)
    102046, // Ginyu Force (TEQ)
    102100, // Master Roshi (PHY)
    102213, // Tao Pai Pai (STR WT)
    102277, // Babidi & Dabura (AGL Battlefield)
    102359, // Gohan & Trunks (AGL SBR)
    102498, // Metal Cooler Army (INT Battlefield)
    102613, // Hatchiyack (STR Story)
    102636, // Babidi (AGL Story Event LR)
    102685, // Bulma & Goku (STR WT)
    102715, // King Cold & Frieza (PHY)
    102798, // Ribrianne, Kakunsa, Rozie (STR Story)
    102871, // Ginyu Force (PHY)
    102980  // Bio-Broly (TEQ Story Event LR)
]);

var LINK_SKILL_LV10_BUFFS = {
    "Super Saiyan": { atk: 15 },
    "Prepared for Battle": { ki: 2, def: 5 },
    "Fierce Battle": { atk: 20 },
    "Legendary Power": { atk: 15 },
    "Kamehameha": { atk: 10 },
    "Saiyan Roar": { atk: 25, def: 10 },
    "Shocking Speed": { ki: 2, def: 5 },
    "Over in a Flash": { ki: 3, atk: 7 },
    "Big Bad Bosses": { atk: 25, def: 25 },
    "Warrior Gods": { atk: 12, def: 5 },
    "Royal Lineage": { ki: 2, atk: 5 },
    "Saiyan Warrior Race": { atk: 10, def: 5 },
    "The First Awakened": { atk: 25, def: 10 },
    "Golden Warrior": { ki: 1, def: -10, enemyDef: -10 },
    "All in the Family": { def: 20 },
    "Experienced Fighters": { atk: 15, def: 10 },
    "Z-Fighters": { atk: 20 },
    "Infighter": { atk: 15, enemyDef: -15 },
    "Fear and Faith": { ki: 2, enemyDef: -10 },
    "Strongest Clan in Space": { ki: 2, def: 10 },
    "Thirst for Conquest": { atk: 15, def: 15 },
    "Nightmare": { atk: 15, def: 5 },
    "Metamorphosis": { hp: 5, atk: 10, def: 10 },
    "Brutal Beatdown": { atk: 15, def: 5 },
    "Wall Standing Tall": { atk: 20 },
    "More Than Meets the Eye": { atk: 10, def: 10 },
    "Auto Regeneration": { hp: 5, def: 5 },
    "Tournament of Power": { ki: 3, atk: 7, def: 7 },
    "Universe's Most Malevolent": { atk: 20 },
    "Cold Judgment": { def: 25 },
    "Brainiacs": { atk: 15, def: 15 },
    "Gaze of Respect": { ki: 2, atk: 5, def: 5 },
    "Fused Fighter": { ki: 2, def: 5 },
    "Majin": { ki: 2, atk: 15, def: 15 },
    "Android Assault": { def: 20, ki: 2 },
    "GT": { ki: 2, atk: 10, def: 10 },
    "Solid Support": { ki: 1, atk: 10, def: 10 },
    "Patrol": { ki: 2, def: 10 },
    "Hero of Justice": { atk: 25 },
    "Godly Power": { atk: 15 },
    "Prodigies": { atk: 15, def: 10 },
    "Supreme Power": { atk: 10, def: 10 },
    "Shattering the Limit": { ki: 2, atk: 5, def: 5 },
    "Hardened Grudge": { ki: 2, def: 10 }
};

function getLinkSkillBuffs(linkName, linkObj) {
    if (LINK_SKILL_LV10_BUFFS[linkName]) return LINK_SKILL_LV10_BUFFS[linkName];
    let desc = (linkObj ? (linkObj.description || linkObj.level_10_description || linkObj.effect || '') : '').toLowerCase();
    let buffs = { atk: 0, def: 0, ki: 0, hp: 0, enemyDef: 0 };
    if (!desc) return buffs;

    let atkM = desc.match(/atk\s*\+?\s*(\d+)%/i);
    if (atkM) buffs.atk = parseInt(atkM[1], 10);
    let defM = desc.match(/def\s*\+?\s*(\d+)%/i);
    if (defM) buffs.def = parseInt(defM[1], 10);
    let kiM = desc.match(/ki\s*\+?\s*(\d+)/i);
    if (kiM) buffs.ki = parseInt(kiM[1], 10);
    let hpM = desc.match(/hp\s*(?:recovers?|recovery|\+)?\s*(\d+)%/i) || desc.match(/recovers?\s*(\d+)%\s*hp/i);
    if (hpM) buffs.hp = parseInt(hpM[1], 10);

    return buffs;
}

function getCardFolderId(card) {
    if (!card) return 0;
    let rawId = typeof card === 'number' ? card : parseInt(card.id, 10) || 0;
    if (rawId > 10000000) rawId = Math.floor(rawId / 10);
    return Math.floor(rawId / 10) * 10;
}

function getRootParentId(card) {
    if (!card) return 0;
    const cid = typeof card === 'number' ? card : parseInt(card.id || 0, 10);
    if (!cid) return 0;

    const normId = cid > 10000000 ? Math.floor(cid / 10) : cid;

    // Transformed forms (4xxxxxx) -> resolve parent card
    if (normId >= 4000000 && normId < 5000000) {
        if (typeof card === 'object' && card.parent_id) {
            const pid = parseInt(card.parent_id, 10);
            if (pid > 0 && pid < 4000000) return getRootParentId(pid);
        }
        if (window.DB && Array.isArray(DB.cards)) {
            const found = DB.cards.find(c => parseInt(c.id, 10) === normId);
            if (found && found.parent_id) {
                const pid = parseInt(found.parent_id, 10);
                if (pid > 0 && pid < 4000000) return getRootParentId(pid);
            }
        }
    }

    if (typeof card === 'object' && card.parent_id) {
        const pid = parseInt(card.parent_id, 10);
        if (pid > 0 && pid !== cid && pid !== normId) {
            return getRootParentId(pid);
        }
        if (pid > 0) return pid > 10000000 ? Math.floor(pid / 10) : pid;
    }

    if (window.DB && Array.isArray(DB.cards)) {
        const found = DB.cards.find(c => parseInt(c.id, 10) === normId || parseInt(c.id, 10) === cid);
        if (found && found.parent_id) {
            const pid = parseInt(found.parent_id, 10);
            if (pid > 0 && pid !== cid && pid !== normId) {
                return getRootParentId(pid);
            }
            if (pid > 0) return pid > 10000000 ? Math.floor(pid / 10) : pid;
        }
    }

    let str = String(normId);
    if (str.length === 7 && str.startsWith('4')) {
        const baseCandidate = parseInt('1' + str.substring(1), 10);
        return getRootParentId(baseCandidate);
    }
    return normId;
}

function getCardParentId(card) {
    return getRootParentId(card);
}



function isSezaCard(c) {
    if (!c) return false;
    const cidStr = String(c.id || '');
    if (cidStr.length >= 8 && cidStr.endsWith('9')) return true;
    if (c.is_seza === true || c.is_super_eza === true || c.eza_type === 2 || c.optimal_awakening_grow_type === 2) return true;

    if (window.DB && DB.awakeningRoutes && Array.isArray(DB.awakeningRoutes)) {
        const cid = parseInt(c.id, 10);
        const rootId = getRootParentId(cid);
        return DB.awakeningRoutes.some(r => {
            const rCid = parseInt(r.card_id, 10);
            const rAwid = parseInt(r.awaked_card_id, 10);
            return (rCid === rootId || rAwid === rootId || rCid === cid || rAwid === cid) && r.optimal_awakening_type === 2;
        });
    }
    return false;
}

function isEzaCard(c) {
    if (!c) return false;
    if (isSezaCard(c)) return true;

    const cidStr = String(c.id || '');
    if (cidStr.length >= 8 && cidStr.endsWith('8')) return true;
    if (c.is_eza === true || c.is_eza === 1 || c.is_eza_awakened === true || c.eza_type === 1 || c.optimal_awakening_grow_type === 1) return true;

    const name = String(c.name || '');
    if (/\(extreme\)$/i.test(name.trim()) || /\b(eza|extreme\s+z-awakened)\b/i.test(name)) return true;

    if (window.DB && DB.awakeningRoutes && Array.isArray(DB.awakeningRoutes)) {
        const cid = parseInt(c.id, 10);
        const rootId = getRootParentId(cid);
        return DB.awakeningRoutes.some(r => {
            const rCid = parseInt(r.card_id, 10);
            const rAwid = parseInt(r.awaked_card_id, 10);
            return (rCid === rootId || rAwid === rootId || rCid === cid || rAwid === cid) && 
                   (r.optimal_awakening_type === 1 || String(r.type || '').includes('Optimal'));
        });
    }
    return false;
}

function isTransformedCard(c) {
    if (!c) return false;
    if (c.is_transform === true || c.is_transformation === true) return true;
    const rawId = typeof c === 'number' ? c : parseInt(c.id || 0, 10);
    const normalizedId = rawId > 10000000 ? Math.floor(rawId / 10) : rawId;
    return normalizedId >= 4000000 && normalizedId < 5000000;
}

function resolveCardAssets(card) {
    if (!card) return { bgUrl: '', charUrl: '', effectUrl: '', thumbUrl: '', artUrl: '' };

    if (card.art_url && card.thumb_url) {
        return {
            bgUrl: card.bg_url || '',
            charUrl: card.art_url,
            effectUrl: card.effect_url || '',
            thumbUrl: card.thumb_url,
            artUrl: card.art_url
        };
    }

    const folderId = getCardFolderId(card);
    const cardId = typeof card === 'number' ? card : parseInt(card.id, 10) || 0;
    const rootId = getRootParentId(card);
    const parentFolderId = Math.floor(rootId / 10) * 10;

    const bgFolderId = (cardId >= 4000000 && cardId < 5000000) ? parentFolderId : folderId;

    if (card.folder) {
        return {
            bgUrl: `./${card.folder}/card_${bgFolderId}_bg.png`,
            charUrl: `./${card.folder}/card_${folderId}_character.png`,
            effectUrl: `./${card.folder}/card_${folderId}_effect.png`,
            thumbUrl: `./${card.folder}/card_${folderId}_thumb.png`,
            artUrl: `./${card.folder}/card_${folderId}_character.png`
        };
    }

    return {
        bgUrl: `assets/card/${bgFolderId}/card_${bgFolderId}_bg.png`,
        charUrl: `assets/card/${folderId}/card_${folderId}_character.png`,
        effectUrl: `assets/card/${folderId}/card_${folderId}_effect.png`,
        thumbUrl: `assets/thumb/card_${folderId}_thumb/card_${folderId}_thumb.png`,
        parentThumbUrl: `assets/thumb/card_${parentFolderId}_thumb/card_${parentFolderId}_thumb.png`,
        artUrl: `assets/card/${folderId}/card_${folderId}_character.png`
    };
}

function getCardClassAndType(elementId) {
    const alignment = Math.floor((elementId || 0) / 10);
    const typeIndex = (elementId || 0) % 10;
    const types = { 0: "agl", 1: "teq", 2: "int", 3: "str", 4: "phy" };
    return { 
        cardClass: alignment === 2 ? "extreme" : "super", 
        cardType: types[typeIndex] || "agl" 
    };
}

function getCardUnitTag(card) {
    if (!card) return "CHARACTER DETAILS";

    const rootId = getRootParentId(card);
    const rootCard = (window.DB && Array.isArray(DB.cards)) 
        ? (DB.cards.find(c => parseInt(c.id, 10) === rootId) || card) 
        : card;

    if (rootCard && rootCard.tag && typeof rootCard.tag === 'string' && rootCard.tag.trim() && rootCard.tag !== 'CHARACTER DETAILS') {
        const t = rootCard.tag.trim();
        if (t !== 'SUMMONABLE UNIT') return t;
    }

    const isLR = isCardLR(card);
    const cost = parseInt(rootCard.cost || card.cost || 0, 10);
    const rarity = isLR ? 5 : parseInt(rootCard.rarity || card.rarity || 0, 10);
    const cid = parseInt(card.id || 0, 10);
    const normCid = cid > 10000000 ? Math.floor(cid / 10) : cid;
    
    const stemCurrent = Math.floor(normCid / 10);
    const stemParent = Math.floor(rootId / 10);

    let babaPoints = parseInt(rootCard.sell_point || card.sell_point || card.exchange_point || 0, 10);

    const tagRaw = String(rootCard.tag || card.tag || '').toLowerCase();
    const isWT = tagRaw.includes('world tournament') || tagRaw.includes('tenkaichi') || tagRaw.includes('wt');

    // 1. World Tournament
    if (isWT) return "WORLD TOURNAMENT";

    // 2. LR Classifications
    if (rarity === 5 || isLR || cost in [77, 99]) {
        if (cost === 99) return "PRIME BATTLE (F2P LR)";

        const isF2pStem = F2P_LR_STEMS.has(stemCurrent) || F2P_LR_STEMS.has(stemParent);
        const leaderObj = findLeaderObj(rootCard, 'base');
        const rawLeader = (leaderObj ? (leaderObj.description || leaderObj.effect || leaderObj.details) : (rootCard.leader_skill || "")).toLowerCase();
        
        const hasLowF2pLead = rawLeader.includes('80%') || rawLeader.includes('77%') || rawLeader.includes('70%') || rawLeader.includes('50%') || rawLeader.includes('30%');
        const isShattering = Array.isArray(rootCard.links) && rootCard.links.includes(28);

        if (isF2pStem || (hasLowF2pLead && isShattering) || (babaPoints > 0 && babaPoints <= 1000 && cost !== 77)) {
            return "FREE TO PLAY (LR)";
        }

        const isDfeLead = rawLeader.includes('plus an additional') || (rawLeader.includes('170%') && (rawLeader.includes('30%') || rawLeader.includes('50%')));

        if (DFE_LR_STEMS.has(stemCurrent) || DFE_LR_STEMS.has(stemParent) || isDfeLead) {
            return "DOKKAN FESTIVAL EXCLUSIVE";
        }

        return "LEGENDARY SUMMON CARNIVAL";
    }

    // 3. TUR Classifications
    if (rarity === 4 || cost >= 32) {
        if (cost === 58 || cost === 48) return "DOKKAN FESTIVAL EXCLUSIVE";
        if (cost === 40 || cost === 42) return "GENERAL POOL (BANNER UNIT)";
        if (cost >= 43) return "DOKKAN FESTIVAL EXCLUSIVE";
        if (cost in [32, 42] && babaPoints > 0 && babaPoints < 5000) return "SUPER STRIKE (F2P)";
        if (cost <= 36) return "FREE TO PLAY";
        return "GENERAL POOL (BANNER UNIT)";
    }

    // 4. Base SSRs
    if (babaPoints >= 5000) return "GENERAL POOL (BANNER UNIT)";
    return "FREE TO PLAY";
}

function getCardExactReleaseDate(card, mode = 'base') {
    if (!card) return "TBD";
    const cid = parseInt(card.id, 10);
    const parentBaseId = getRootParentId(card);
    const dokkanMinEpoch = new Date("2015-01-30T00:00:00Z").getTime();
    const nowPlus30Days = Date.now() + (30 * 24 * 60 * 60 * 1000);

    const isValidDateStr = (d) => {
        if (!d || typeof d !== 'string') return false;
        if (d.includes('2015-10-30') || d.startsWith('2010') || d.startsWith('1970') || d === 'TBD' || d.trim() === '') return false;
        const iso = d.replace(" ", "T") + (d.includes("Z") ? "" : "Z");
        const t = new Date(iso).getTime();
        return !isNaN(t) && t >= dokkanMinEpoch;
    };

    const getTime = (d) => new Date(d.replace(" ", "T") + (d.includes("Z") ? "" : "Z")).getTime();

    const familyIds = new Set([cid, parentBaseId]);
    let baseDates = [];
    let ezaDates = [];
    let sezaDates = [];

    if (window.DB && DB.awakeningRoutes && Array.isArray(DB.awakeningRoutes)) {
        DB.awakeningRoutes.forEach(r => {
            const rCid = parseInt(r.card_id, 10);
            const rAwid = parseInt(r.awaked_card_id, 10);
            if (familyIds.has(rCid) || familyIds.has(rAwid) || familyIds.has(getRootParentId(rCid)) || familyIds.has(getRootParentId(rAwid))) {
                const dt = r.open_at || r.start_at;
                if (!isValidDateStr(dt)) return;
                const optType = r.optimal_awakening_type;
                const rType = String(r.type || '');

                if (optType === 2 || rType.includes('Super')) {
                    sezaDates.push(dt);
                } else if (optType === 1 || rType.includes('Optimal')) {
                    ezaDates.push(dt);
                } else {
                    baseDates.push(dt);
                }
            }
        });
    }

    if (isValidDateStr(card.open_at || card.release_date)) {
        const directDt = card.open_at || card.release_date;
        if (mode === 'seza' && String(card.id).endsWith('9')) sezaDates.push(directDt);
        else if (mode === 'eza' && String(card.id).endsWith('8')) ezaDates.push(directDt);
        else baseDates.push(directDt);
    }

    if (window.DB && Array.isArray(DB.cards)) {
        DB.cards.forEach(c => {
            const cId = parseInt(c.id, 10);
            if (familyIds.has(cId) || familyIds.has(getRootParentId(cId))) {
                if (isValidDateStr(c.open_at || c.release_date)) {
                    const cDt = c.open_at || c.release_date;
                    if (String(cId).endsWith('9') || c.is_seza) sezaDates.push(cDt);
                    else if (String(cId).endsWith('8') || c.is_eza) ezaDates.push(cDt);
                    else baseDates.push(cDt);
                }
            }
        });
    }

    const validBase = baseDates.filter(d => getTime(d) < nowPlus30Days).sort((a, b) => getTime(a) - getTime(b));
    const validEza = ezaDates.filter(d => getTime(d) < nowPlus30Days).sort((a, b) => getTime(b) - getTime(a));
    const validSeza = sezaDates.filter(d => getTime(d) < nowPlus30Days).sort((a, b) => getTime(b) - getTime(a));

    if (mode === 'seza') {
        if (validSeza.length > 0) return validSeza[0];
        if (validEza.length > 0) return validEza[0];
        if (validBase.length > 0) return validBase[0];
    } else if (mode === 'eza') {
        if (validEza.length > 0) return validEza[0];
        if (validBase.length > 0) return validBase[0];
        if (validSeza.length > 0) return validSeza[0];
    } else {
        if (validBase.length > 0) return validBase[0];
        if (validEza.length > 0) return validEza[validEza.length - 1];
        if (validSeza.length > 0) return validSeza[validSeza.length - 1];
    }

    return "TBD";
}

function formatESTDateWithTime(utcDateStr) {
    if (!utcDateStr || utcDateStr === 'TBD' || utcDateStr.trim() === '') return "TBD";
    try {
        const cleanedStr = utcDateStr.replace(" ", "T") + (utcDateStr.includes("Z") ? "" : "Z");
        const date = new Date(cleanedStr);
        if (isNaN(date.getTime())) return "TBD";
        return date.toLocaleString("en-US", { 
            timeZone: "America/New_York", 
            year: "numeric", 
            month: "numeric", 
            day: "numeric", 
            hour: "2-digit", 
            minute: "2-digit", 
            second: "2-digit", 
            hour12: true 
        }) + " EST";
    } catch (e) { 
        return "TBD"; 
    }
}

function findLeaderObj(card, mode = (typeof currentEzaMode !== 'undefined' ? currentEzaMode : 'base')) {
    if (!DB || !DB.leaders || !card) return null;

    const cid = parseInt(card.id, 10);
    const normId = cid > 10000000 ? Math.floor(cid / 10) : cid;
    const baseCardId = (normId >= 4000000 && normId < 5000000) ? getRootParentId(card) : normId;

    if (window.DB && DB.optimalAwakeningGrowths && Array.isArray(DB.optimalAwakeningGrowths)) {
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

    const siblings = (typeof getCardSiblings === 'function') ? getCardSiblings(card) : null;
    let targetCardForLeader = card;
    if (mode === 'seza' && siblings?.seza) targetCardForLeader = siblings.seza;
    else if (mode === 'eza' && siblings?.eza) targetCardForLeader = siblings.eza;
    else if (mode === 'base' && siblings?.base) targetCardForLeader = siblings.base;

    const rawLeadId = parseInt(targetCardForLeader.lead_id || targetCardForLeader.leader_skill_set_id || targetCardForLeader.leader_skill_id || targetCardForLeader.id, 10);
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

function getCardPassiveObject(card, mode = 'base') {
    if (!window.DB || !window.DB.passives || !card) return { name: "Passive Skill", itemized_description: "" };

    const cid = parseInt(card.id, 10);
    const idStr = String(cid);
    const base7Id = idStr.length >= 8 ? idStr.substring(0, 7) : idStr;
    const normId = parseInt(base7Id, 10);
    const baseCardId = (normId >= 4000000 && normId < 5000000) ? getRootParentId(card) : normId;

    if (mode === 'eza' && idStr.endsWith('8') && card.pass_id && window.DB.passives[String(card.pass_id)]) {
        return window.DB.passives[String(card.pass_id)];
    }
    if (mode === 'seza' && idStr.endsWith('9') && card.pass_id && window.DB.passives[String(card.pass_id)]) {
        return window.DB.passives[String(card.pass_id)];
    }

    if (window.DB && window.DB.optimalAwakeningGrowths && Array.isArray(window.DB.optimalAwakeningGrowths)) {
        const targetGrowType = mode === 'seza' ? 2 : (mode === 'eza' ? 1 : 0);
        if (targetGrowType > 0) {
            const growths = window.DB.optimalAwakeningGrowths.filter(g => 
                (parseInt(g.card_id, 10) === normId || parseInt(g.card_id, 10) === baseCardId || parseInt(g.card_id, 10) === cid) && 
                g.optimal_awakening_grow_type === targetGrowType &&
                g.passive_skill_set_id
            );
            if (growths.length > 0) {
                const finalStep = growths[growths.length - 1];
                if (window.DB.passives[String(finalStep.passive_skill_set_id)]) {
                    return window.DB.passives[String(finalStep.passive_skill_set_id)];
                }
            }
        }
    }

    if (mode === 'eza') {
        const ezaCard = window.DB.cards.find(c => String(c.id) === base7Id + '8');
        if (ezaCard && ezaCard.pass_id && window.DB.passives[String(ezaCard.pass_id)]) {
            return window.DB.passives[String(ezaCard.pass_id)];
        }
    } else if (mode === 'seza') {
        const sezaCard = window.DB.cards.find(c => String(c.id) === base7Id + '9');
        if (sezaCard && sezaCard.pass_id && window.DB.passives[String(sezaCard.pass_id)]) {
            return window.DB.passives[String(sezaCard.pass_id)];
        }
    }

    const rawPassId = parseInt(card.pass_id || card.passive_skill_set_id || card.passive_id || 0, 10);
    let passObj = rawPassId ? (window.DB.passives[rawPassId] || window.DB.passives[String(rawPassId)]) : null;

    if (!passObj && card.passive_name) {
        passObj = { 
            name: card.passive_name, 
            itemized_description: card.passive_description || card.itemized_description || "" 
        };
    }

    if (!passObj) return { name: "Passive Skill", itemized_description: "" };

    const rootName = (passObj.name || '')
        .replace(/\s*\(Super Extreme.*?\)$/i, '')
        .replace(/\s*\(Extreme.*?\)$/i, '')
        .trim().toLowerCase();

    const allPassives = Array.isArray(window.DB.passives) ? window.DB.passives : Object.values(window.DB.passives);
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

function parseTitleAndName(card) {
    if (!card) return { title: "", name: "" };
    const leaderObj = findLeaderObj(card);

    const candidateTitles = [
        card.title, card.subname, card.sub_name, card.second_name,
        card.second_name_en, card.header, card.card_title,
        leaderObj ? leaderObj.name : null
    ];

    let title = "";
    for (let candidate of candidateTitles) {
        if (candidate && typeof candidate === 'string' && candidate.trim().length > 0) {
            let clean = candidate.replace(/[【】\[\]]/g, '').trim();
            if (clean.length > 0 && !['null', 'none'].includes(clean.toLowerCase())) {
                title = clean;
                break;
            }
        }
    }

    let name = card.name || card.character_name || card.card_name || "";
    if (!title && name) {
        const match = name.match(/^[【\[\()](.*?)[】\]\)]\s*(.*)$/);
        if (match) { 
            title = match[1].trim(); 
            name = match[2].trim(); 
        }
    }
    return { title: title.trim(), name: name.trim() };
}



function getCardExactRarity(c) {
    if (!c) return 'SSR';
    const maxLvl = parseInt(c.max_level || c.lv_max || c.max_lv || 0, 10);
    const cost = parseInt(c.cost || 0, 10);
    const rarityStr = String(c.rarity || '').toUpperCase();

    // 1. LR: Level 150 or Cost 77/99
    if (rarityStr === 'LR' || maxLvl >= 150 || cost === 77 || cost === 99) {
        return 'LR';
    }

    // 2. TUR: Level 120 or Cost 40-58
    if (rarityStr === 'TUR' || maxLvl >= 120 || (cost >= 40 && cost < 77)) {
        return 'TUR';
    }

    // 3. UR: Level 100 or Cost 24-36
    if (maxLvl === 100 || (cost >= 24 && cost < 40)) {
        return 'UR';
    }

    // 4. SSR: Level 80 or Cost < 24
    return 'SSR';
}

function isCardLR(card) {
    if (!card) return false;
    const cid = typeof card === 'number' ? card : parseInt(card.id || 0, 10);
    const normId = cid > 10000000 ? Math.floor(cid / 10) : cid;

    // Transformed forms (4000000..4999999): inherit from parent
    if (normId >= 4000000 && normId < 5000000) {
        const rootId = getRootParentId(card);
        if (rootId && window.DB && Array.isArray(DB.cards)) {
            const parent = DB.cards.find(c => parseInt(c.id, 10) === rootId);
            if (parent) {
                return parent.max_level >= 150 || parent.cost === 77 || parent.cost === 99 || parent.rarity === 'LR';
            }
        }
    }

    const maxLvl = parseInt(card.max_level || card.lv_max || card.max_lv || 0, 10);
    const cost = parseInt(card.cost || 0, 10);
    const rarityStr = String(card.rarity || '').toUpperCase();

    // Only this exact card
    return rarityStr === 'LR' || maxLvl >= 150 || cost === 77 || cost === 99;
}

function buildComposedIcon(c, usePlainType = false, forceAwakenedMode = null) {
    const { thumbUrl } = resolveCardAssets(c);
    const { cardClass: cClass, cardType: cType } = getCardClassAndType(c.element !== undefined ? c.element : c.attribute);
    
    const exactRarity = getCardExactRarity(c);
    const isLR = exactRarity === 'LR';
    const isTUR = exactRarity === 'TUR';

    let raritySrc = `${CENTRAL_ASSET_URL}rarity_ssr_abs.png`;
    if (isLR) raritySrc = `${CENTRAL_ASSET_URL}rarity_lr_abs.png`;
    else if (isTUR) raritySrc = `${CENTRAL_ASSET_URL}rarity_TUR_abs.png`;

    const typeSrc = (exactRarity === 'SSR' || usePlainType) ? `${CENTRAL_ASSET_URL}type_${cType}.png` : `${CENTRAL_ASSET_URL}${cClass}_type_${cType}.png`;
    const frameSrc = `${CENTRAL_ASSET_URL}frame_${cType}.png`;

    const isSEZA = forceAwakenedMode === 'seza' || (forceAwakenedMode === null && isSezaCard(c));
    const isEZA = isSEZA || forceAwakenedMode === 'eza' || (forceAwakenedMode === null && isEzaCard(c));

    const lrSpinHtml = isLR ? `<img src="${CENTRAL_ASSET_URL}lr_spin_dial.png" class="lr-spin-dial">` : '';
    
    const lrLightningHtml = isLR ? `
        <video class="lightning-overlay" autoplay muted loop playsinline style="--lightning-color: ${lightningColors[cType] || 'rgb(0, 150, 255)'};">
            <source src="${CENTRAL_ASSET_URL}lightningfx.webm" type="video/webm">
        </video>` : '';

    let ezaIconSrc = isSEZA ? `${CENTRAL_ASSET_URL}superza_abs.png` : (isEZA && forceAwakenedMode !== 'base' ? `${CENTRAL_ASSET_URL}eza_abs.png` : null);
    const ezaHtml = ezaIconSrc ? `<img src="${ezaIconSrc}" class="eza-icon">` : '';
    const sezaGlowClass = isSEZA ? 'seza-glow-card' : '';
    const sezaFlameCanvasHtml = isSEZA ? `<canvas class="seza-lwf-border-canvas" data-seza-type="${cType}"></canvas>` : '';

    return `
        <div class="abs-composed-icon ${sezaGlowClass}" data-card-type="${cType}" ${isSEZA ? `data-seza="true" data-type="${cType}"` : ''}>
            <img class="card-frame" src="${frameSrc}">
            ${lrSpinHtml}
            ${lrLightningHtml}
            <div class="thumb-box">
                <img class="thumb-img" src="${thumbUrl}">
            </div>
            ${sezaFlameCanvasHtml}
            <img class="rarity-icon" src="${raritySrc}">
            <img class="type-icon" src="${typeSrc}">
            ${ezaHtml}
        </div>
    `;
}

function getSaIconUrl(specObj, card = null) {
    if (!specObj) return `${CENTRAL_ASSET_URL}sp_skill_icon_etc.png`;

    if (specObj.icon && typeof specObj.icon === 'string' && specObj.icon !== 'none') {
        if (specObj.icon.startsWith('http')) return specObj.icon;
        const cleanName = specObj.icon.replace(/^.*[\\\/]/, '');
        if (cleanName.includes('sp_skill_icon')) return `${CENTRAL_ASSET_URL}${cleanName}`;
    }

    let catId = specObj.special_category_id;

    if (catId === undefined && window.DB) {
        let viewId = specObj.special_view_id || specObj.view_id;

        if (!viewId && DB.specials) {
            const sid = specObj.special_id || specObj.id;
            const s = DB.specials[String(sid)] || DB.specials[sid];
            if (s) viewId = s.special_view_id || s.view_id;
        }

        if (viewId !== undefined && DB.specialViews) {
            const sv = DB.specialViews[String(viewId)] || DB.specialViews[viewId];
            if (sv) catId = sv.special_category_id;
        }
    }

    const numCatId = parseInt(catId, 10);
    if (numCatId === 1) return `${CENTRAL_ASSET_URL}sp_skill_icon_01.png`;
    if (numCatId === 2) return `${CENTRAL_ASSET_URL}sp_skill_icon_02.png`;
    if (numCatId === 3) return `${CENTRAL_ASSET_URL}sp_skill_icon_04.png`;

    return `${CENTRAL_ASSET_URL}sp_skill_icon_etc.png`;
}

function getSaCategoryName(specObj) {
    if (!specObj) return "Other";
    
    let catId = specObj.special_category_id;

    if (catId === undefined && window.DB) {
        let viewId = specObj.special_view_id || specObj.view_id;
        if (!viewId && DB.specials) {
            const sid = specObj.special_id || specObj.id;
            const s = DB.specials[String(sid)] || DB.specials[sid];
            if (s) viewId = s.special_view_id || s.view_id;
        }
        if (viewId !== undefined && DB.specialViews) {
            const sv = DB.specialViews[String(viewId)] || DB.specialViews[viewId];
            if (sv) catId = sv.special_category_id;
        }
    }

    const numCatId = parseInt(catId, 10);
    if (numCatId === 1) return "Ki Blast";
    if (numCatId === 2) return "Unarmed";
    if (numCatId === 3) return "Physical";
    return "Other";
}

function detectPassiveSkillIcons(text, card = null) {
    if (!text && !card) return [];
    const t = (text || '').toLowerCase();
    const detected = new Map();

    const registerIcon = (filename, tooltip) => {
        if (!detected.has(filename)) {
            detected.set(filename, {
                src: `${CENTRAL_ASSET_URL}${filename}`,
                tooltip: tooltip
            });
        }
    };

    if (/reversible\s+exchange/i.test(t) || /can\s+switch\s+back/i.test(t) || /switches?\s+(back\s+and\s+forth|freely)/i.test(t)) {
        registerIcon('st_reversible.png', 'Reversible Exchange');
    }

    const isReversible = /reversible\s+exchange/i.test(t) || /can\s+switch\s+back/i.test(t);
    const isPassiveTransform = !isReversible && (
        /transforms?\s+(starting|when|into|upon|after)/i.test(t) || 
        /\btransforms\b/i.test(t) ||
        /\bawakens\b/i.test(t) ||
        /transformation\s+takes\s+place/i.test(t) ||
        (card && (
            card.is_transform === true || 
            card.is_passive_transformation === true ||
            (card.transform_card_id && card.transform_card_id > 0 && !card.active_id) ||
            (window.DB && DB.cards && DB.cards.some(c => c.parent_id === card.id && c.is_transform && !card.active_id))
        ))
    );

    if (isPassiveTransform) {
        registerIcon('st_change_form.png', 'Transformation');
    }

    if (/giant\s+form/i.test(t) || /rage\s+(mode|form)/i.test(t) || /calls?\s+in\s+reinforcements/i.test(t) || /reinforcements/i.test(t)) {
        registerIcon('st_giant_form_rage.png', 'Giant Form / Rage / Reinforcements');
    }
    if (/reviv(e|al|ed|es)/i.test(t) || /when\s+hp\s+is\s+0/i.test(t)) {
        registerIcon('st_revive.png', 'Revival Skill');
    }
    if (/survives?\s+(a\s+)?k\.?o\.?/i.test(t) || /survives?\s+fatal\s+damage/i.test(t)) {
        registerIcon('st_invalid_ko.png', 'Survives Fatal KO Attack');
    }
    if (/nullif(ies|y)\s+(all\s+)?(status|negative|debuff)\s+effects?/i.test(t) ||
        /immune\s+to\s+(all\s+)?(status|negative|debuff|stunning|sealing)/i.test(t) ||
        /cannot\s+be\s+(stunned|sealed)/i.test(t) ||
        /cancels?\s+all\s+(status|negative|debuff)/i.test(t)) {
        registerIcon('nullifies_negative_effects.png', 'Nullifies Negative Effects');
    }
    if (/atk\s*(&\s*def)?\s*(\+?\s*\d+%|up\s+to)/i.test(t) || 
        /(raises?|boosts?)\s+(own\s+)?atk/i.test(t) || 
        /atk\s*\+\d+%/i.test(t) ||
        (/atk\s*&/i.test(t) && /\d+%/i.test(t))) {
        registerIcon('st_0001.png', 'ATK Boost');
    }
    if (/def\s*(&\s*atk)?\s*(\+?\s*\d+%|up\s+to)/i.test(t) || 
        /(raises?|boosts?)\s+(own\s+)?def/i.test(t) || 
        /def\s*\+\d+%/i.test(t) ||
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
    if (/guard\s+against\s+all\s+types/i.test(t)) {
        registerIcon('st_guard_all.png', 'Guards Against All Types');
    }
    if (/guards?\s+all\s+attacks/i.test(t) || /guard\s+is\s+activated/i.test(t) || /active\s+guard/i.test(t)) {
        registerIcon('st_sp_guard.png', 'Guard Against All Attacks');
    }
    if (/damage\s+reduction/i.test(t) || /reduces?\s+damage/i.test(t)) {
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
    if (/(nullif(y|ies)|counter)\s+(enemy'?s?\s+)?super/i.test(t)) {
        registerIcon('st_invalid_enemy_special.png', 'Counter / Nullify Enemy Super');
    }
    if (/unarmed\s+super\s+attack/i.test(t) || /melee\s+super\s+attack/i.test(t) || /physical\s+super\s+attack/i.test(t) || /(nullif(y|ies)|counter)\s+(unarmed|melee|physical)/i.test(t)) {
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
        'st_guard_all.png',
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
        'st_invalid_enemy_special.png',
        'st_invalid_blow_special.png',
        'st_invalid_energy_special.png',
        'st_counter.png'
    ];

    const sortedIcons = [];
    priorityOrder.forEach(file => {
        if (detected.has(file)) {
            sortedIcons.push(detected.get(file));
        }
    });

    return sortedIcons;
}

function renderPassiveIconsStrip(passiveText, card = null) {
    const icons = detectPassiveSkillIcons(passiveText, card);
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

(function setupGlobalFloatingTooltip() {
    if (typeof document === 'undefined') return;
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
        if (badge) {
            tooltipEl.style.opacity = '0';
            tooltipEl.style.display = 'none';
        }
    });
})();

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

function getUnitTransformations(targetCard, parentMax) {
    if (!window.DB || !window.DB.cards || !targetCard) return [];

    const targetId = parseInt(targetCard.id, 10);
    const normTargetId = targetId > 10000000 ? Math.floor(targetId / 10) : targetId;
    
    let rootBaseId = normTargetId;
    if (normTargetId >= 4000000 && normTargetId < 5000000) {
        if (targetCard.parent_id && parseInt(targetCard.parent_id, 10) < 4000000) {
            rootBaseId = parseInt(targetCard.parent_id, 10);
        } else {
            rootBaseId = 1000000 + (normTargetId % 1000000);
        }
    }

    const baseCard = window.DB.cards.find(c => parseInt(c.id, 10) === rootBaseId) || targetCard;
    const baseNormId = parseInt(baseCard.id, 10) > 10000000 ? Math.floor(parseInt(baseCard.id, 10) / 10) : parseInt(baseCard.id, 10);
    const baseStem6 = Math.floor(baseNormId / 10);
    const targetCharId = parseInt(baseCard.character_id || targetCard.character_id || 0, 10);
    const targetUniqueInfoId = parseInt(baseCard.card_unique_info_id || targetCard.card_unique_info_id || 0, 10);

    const parentIsLR = isCardLR(parentMax) || isCardLR(baseCard) || isCardLR(targetCard);
    const transformations = [];
    const seenIds = new Set();

    window.DB.cards.forEach(c => {
        const cId = parseInt(c.id, 10);
        const normCId = cId > 10000000 ? Math.floor(cId / 10) : cId;

        if (normCId < 4000000 || normCId >= 5000000 || normCId === 4024881) return;

        const cBaseEquivalentId = 1000000 + (normCId % 1000000);
        const cBaseStem6 = Math.floor(cBaseEquivalentId / 10);
        const cStemDiff = Math.abs(cBaseStem6 - baseStem6);

        const cCharId = parseInt(c.character_id || 0, 10);
        const cUniqueInfoId = parseInt(c.card_unique_info_id || 0, 10);
        const cParentId = parseInt(c.parent_id || 0, 10);

        const isMatch = (cBaseStem6 === baseStem6) ||
                        (cParentId > 0 && (cParentId === baseNormId || cParentId === targetId || Math.floor(cParentId / 10) === baseStem6)) ||
                        (cStemDiff <= 2 && ((targetCharId > 0 && cCharId === targetCharId) || (targetUniqueInfoId > 0 && cUniqueInfoId === targetUniqueInfoId)));

        if (!isMatch) return;

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

function getFullUnitNetwork(targetCard) {
    if (!window.DB || !window.DB.cards || !targetCard) return { baseProgression: [], transformations: [], ezas: [], sezas: [] };

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

    const baseCard = window.DB.cards.find(c => parseInt(c.id, 10) === rootBaseId) || targetCard;
    const rootBaseNormId = parseInt(baseCard.id, 10) > 10000000 ? Math.floor(parseInt(baseCard.id, 10) / 10) : parseInt(baseCard.id, 10);

    const targetStem6 = Math.floor(rootBaseNormId / 10);
    const targetType = getCardClassAndType(baseCard.element !== undefined ? baseCard.element : baseCard.attribute).cardType;
    const targetCharId = parseInt(baseCard.character_id || targetCard.character_id || 0, 10);
    const targetUniqueInfoId = parseInt(baseCard.card_unique_info_id || targetCard.card_unique_info_id || 0, 10);
    const targetOpenAt = (baseCard.open_at || targetCard.open_at || '').trim();

    const baseProgression = [];
    const ezas = [];
    const sezas = [];

    window.DB.cards.forEach(c => {
        const cId = parseInt(c.id, 10);
        const normCId = cId > 10000000 ? Math.floor(cId / 10) : cId;
        if (normCId >= 4000000 || normCId >= 7000000) return;

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

    const transformations = getUnitTransformations(targetCard, parentMax);

    return { baseProgression: finalProgression, transformations, ezas, sezas };
}

function getCardSiblings(card) {
    if (!window.DB || !window.DB.cards || !card) return { base: card, eza: null, seza: null, hasEza: false, hasSeza: false };

    const network = getFullUnitNetwork(card);
    const idStr = String(card.id);
    const currentForm7DigitId = idStr.length >= 8 ? idStr.substring(0, 7) : idStr;
    const currentNormId = parseInt(currentForm7DigitId, 10);
    
    const base = window.DB.cards.find(c => parseInt(c.id, 10) === currentNormId) || card;
    const eza = network.ezas.find(c => String(c.id).startsWith(currentForm7DigitId)) || network.ezas[0] || null;
    const seza = network.sezas.find(c => String(c.id).startsWith(currentForm7DigitId)) || network.sezas[0] || null;

    return {
        base: base,
        eza: eza,
        seza: seza,
        hasEza: Boolean(eza),
        hasSeza: Boolean(seza)
    };
}

window.getCardPowerRank = getCardPowerRank;
window.getUnitTransformations = getUnitTransformations;
window.getFullUnitNetwork = getFullUnitNetwork;
window.getCardSiblings = getCardSiblings;
window.getCardExactRarity = getCardExactRarity;
window.isCardLR = isCardLR;
window.resolveCardAssets = resolveCardAssets;
window.getCardFolderId = getCardFolderId;
window.getRootParentId = getRootParentId;
window.getCardClassAndType = getCardClassAndType;
window.findLeaderObj = findLeaderObj;
window.getCardPassiveObject = getCardPassiveObject;
window.getSaIconUrl = getSaIconUrl;
window.getSaCategoryName = getSaCategoryName;
window.detectPassiveSkillIcons = detectPassiveSkillIcons;
window.renderPassiveIconsStrip = renderPassiveIconsStrip;
