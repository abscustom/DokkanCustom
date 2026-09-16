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
    101862, 101865, // 5th Anniv AGL Gogeta & STR Vegito
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

function hasCuratedDfeLrStem(stem) {
    const manifestStems = window.DB?.unitProvenance?.dfe_lr_stems;
    return DFE_LR_STEMS.has(stem)
        || (Array.isArray(manifestStems) && manifestStems.includes(stem));
}

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
    let desc = (linkObj ? (linkObj.levels?.['10'] || linkObj.description || linkObj.level_10_description || linkObj.effect || '') : '').toLowerCase();
    let buffs = { atk: 0, def: 0, ki: 0, hp: 0, enemyDef: 0 };
    if (!desc) return buffs;

    // Support both separate clauses ("ATK +15% and DEF +15%") and the
    // compact shared form ("ATK & DEF +15%").
    const sharedStatMatch = desc.match(/\b(?:atk|def)\b\s*(?:&|and)\s*\b(?:atk|def)\b\s*\+?\s*(\d+(?:\.\d+)?)%/i);
    const atkM = desc.match(/\batk\b\s*\+?\s*(\d+(?:\.\d+)?)%/i) || sharedStatMatch;
    const defM = desc.match(/\bdef\b\s*\+?\s*(\d+(?:\.\d+)?)%/i) || sharedStatMatch;
    if (atkM) buffs.atk = parseFloat(atkM[1]);
    if (defM) buffs.def = parseFloat(defM[1]);
    let kiM = desc.match(/ki\s*\+?\s*(\d+)/i);
    if (kiM) buffs.ki = parseInt(kiM[1], 10);
    let hpM = desc.match(/hp\s*(?:recovers?|recovery|\+)?\s*(\d+)%/i) || desc.match(/recovers?\s*(\d+)%\s*hp/i);
    if (hpM) buffs.hp = parseInt(hpM[1], 10);

    return buffs;
}

// Small clean-mode effect chips shown at the end of each Link Skill row.
// Keep this helper limited to ATK/DEF because those are the two requested
// stat boxes; other link effects remain available through the hover tooltip.
window.renderAbsCleanLinkEffectBadges = function(linkBuffs = {}) {
    const effects = [
        { key: 'atk', label: 'ATK', className: 'atk' },
        { key: 'def', label: 'DEF', className: 'def' }
    ].map(({ key, label, className }) => {
        const amount = Number(linkBuffs[key]);
        if (!Number.isFinite(amount) || amount <= 0) return '';
        const formatted = Number.isInteger(amount) ? String(amount) : String(amount).replace(/(\.\d*?[1-9])0+$/, '$1');
        return `<span class="abs-link-effect-badge ${className}"><span class="abs-link-effect-label">${label}</span><strong class="abs-link-effect-value">+${formatted}%</strong></span>`;
    }).filter(Boolean);

    return effects.length
        ? `<span class="abs-link-effect-badges" aria-label="Link Skill effects">${effects.join('')}</span>`
        : '';
};

window.normalizeLinkSkillName = function(linkName, loose = false) {
    let normalized = String(linkName || '')
        .normalize('NFKD')
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .replace(/[‘’`´]/g, "'")
        .replace(/[‐‑‒–—―]/g, '-')
        .replace(/&amp;/gi, '&')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();

    // Older card exports sometimes differ only by punctuation (for example,
    // “Z-Fighters” vs “Z Fighters”). Keep this as a fallback after the
    // normal name match so every official link can still resolve its effect.
    if (loose) normalized = normalized.replace(/[^\p{L}\p{N}]+/gu, '');
    return normalized;
};

window.getLinkSkillLevel10Description = function(linkName, linkItem = null) {
    const normalizedName = window.normalizeLinkSkillName(linkName);
    const looseName = window.normalizeLinkSkillName(linkName, true);
    let linkObj = typeof linkItem === 'object' && linkItem !== null ? linkItem : null;
    if (!linkObj && window.DB?.links) {
        const links = Object.values(window.DB.links);
        linkObj = window.DB.links[String(linkName)] ||
            links.find(link => window.normalizeLinkSkillName(link?.name) === normalizedName) ||
            links.find(link => window.normalizeLinkSkillName(link?.name, true) === looseName) ||
            null;
    }
    return String(
        linkObj?.levels?.['10'] ||
        linkObj?.level_10_description ||
        linkObj?.description ||
        linkObj?.effect ||
        ''
    ).trim();
};

window.escapeLinkTooltipAttribute = function(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
};

window.DOKKAN_CATEGORY_COLORS = {
    // Saiyans & Lineage (Gold / Amber / Orange)
    "Pure Saiyans": "#eab308",
    "Super Saiyans": "#f59e0b",
    "Super Saiyan 2": "#eab308",
    "Super Saiyan 3": "#ca8a04",
    "Power Beyond Super Saiyan": "#eab308",
    "Saiyan Saga": "#ca8a04",
    "Goku's Family": "#f97316",
    "Vegeta's Family": "#3b82f6",
    "Hybrid Saiyans": "#ea580c",
    "Team Bardock": "#b45309",
    "Low-Class Warrior": "#b45309",
    "Giant Ape Power": "#b45309",
    "Giant Form": "#92400e",

    // Gods, Universes & Dimensions (Cyan / Sky / Royal Blue / Indigo)
    "Realm of Gods": "#06b6d4",
    "Universe Survival Saga": "#6366f1",
    "Representatives of Universe 7": "#3b82f6",
    "Universe 6": "#8b5cf6",
    "Universe 11": "#ef4444",
    "Space-Traveling Warriors": "#6366f1",
    "Otherworld Warriors": "#06b6d4",

    // Time & Future (Sky Blue / Azure)
    "Future Saga": "#0284c7",
    "Time Travelers": "#0284c7",
    "Time Limit": "#0284c7",
    "Connected Hope": "#0ea5e9",
    "Entrusted Will": "#059669",
    "Accelerated Battle": "#0ea5e9",

    // Iconic Moves & Schools (Cyan / Blue / Orange)
    "Kamehameha": "#38bdf8",
    "Turtle School": "#ea580c",

    // Fusion & Potara (Gold / Violet / Indigo)
    "Fusion": "#f59e0b",
    "Potara": "#8b5cf6",
    "Fused Fighters": "#a855f7",
    "Final Trump Card": "#e11d48",

    // Movie Arcs (Sky Blue / Violet / Rose)
    "Movie Heroes": "#0ea5e9",
    "Movie Bosses": "#9333ea",
    "Super Heroes": "#06b6d4",

    // Majin & Special (Hot Pink / Magenta / Rose)
    "Majin Buu Saga": "#ec4899",
    "Majin Power": "#db2777",
    "Power Absorption": "#db2777",
    "Special Pose": "#ec4899",
    "Peppy Gals": "#f43f5e",

    // Villains & Conquerors (Crimson / Deep Purple / Dark Red)
    "Wicked Bloodline": "#a855f7",
    "Terrifying Conquerors": "#b91c1c",
    "Inhuman Deeds": "#7f1d1d",
    "Planetary Destruction": "#991b1b",
    "Worldwide Chaos": "#831843",
    "Sworn Enemies": "#991b1b",
    "Revenge": "#991b1b",
    "Exploding Rage": "#dc2626",
    "Corroded Body and Mind": "#701a75",
    "GT Bosses": "#7e22ce",

    // Androids & Artificial (Emerald / Mint / Teal)
    "Androids": "#10b981",
    "Androids/Cell Saga": "#059669",
    "Artificial Life Forms": "#0d9488",
    "Target: Goku": "#047857",

    // Namek & Earth (Green / Forest / Amber)
    "Planet Namek Saga": "#059669",
    "Namekians": "#16a34a",
    "Earthlings": "#16a34a",
    "Earth-Bred Fighters": "#15803d",
    "DB Saga": "#ca8a04",
    "World Tournament": "#ca8a04",
    "Dragon Ball Seekers": "#eab308",
    "Youth": "#10b981",

    // Bonds & Family (Warm Amber / Coral / Teal)
    "Siblings' Bond": "#f97316",
    "Bond of Parent and Child": "#f97316",
    "Bond of Master and Disciple": "#0d9488",
    "Bond of Friendship": "#06b6d4",
    "Worthy Rivals": "#3b82f6",
    "Defenders of Justice": "#059669",

    // Power, Evolution & Battle (Ruby / Amber / Gold / Teal)
    "Full Power": "#e11d48",
    "All-Out Struggle": "#e11d48",
    "Battle of Fate": "#e11d48",
    "Battle of Wits": "#0d9488",
    "Mastered Evolution": "#2563eb",
    "Transformation Boost": "#8b5cf6",
    "Rapid Growth": "#10b981",
    "Powerful Comeback": "#f59e0b",
    "Gifted Warriors": "#a855f7",
    "Legendary Existence": "#d97706",
    "Miraculous Awakening": "#38bdf8",
    "Power of Wishes": "#f59e0b",
    "Saviors": "#0284c7",
    "Storied Figures": "#ca8a04",
    "Heavenly Events": "#06b6d4",
    "Joined Forces": "#10b981",
    "Resurrected Warriors": "#64748b",
    "Shadow Dragon Saga": "#0284c7",
    "GT Heroes": "#0284c7",
    "Dragon Ball Heroes": "#dc2626",
    "Crossover": "#7c3aed"
};

window.getDokkanCategoryColor = function(name) {
    if (!name) return '#38bdf8';
    const clean = String(name).trim();
    if (window.DOKKAN_CATEGORY_COLORS[clean]) return window.DOKKAN_CATEGORY_COLORS[clean];
    const lower = clean.toLowerCase();
    for (const [k, v] of Object.entries(window.DOKKAN_CATEGORY_COLORS)) {
        if (k.toLowerCase() === lower) return v;
    }
    const palette = ['#38bdf8', '#eab308', '#f97316', '#10b981', '#a855f7', '#ec4899', '#06b6d4', '#ef4444', '#14b8a6', '#f59e0b'];
    let hash = 0;
    for (let i = 0; i < clean.length; i++) hash = (hash * 31 + clean.charCodeAt(i)) >>> 0;
    return palette[hash % palette.length];
};

// Hex (any case, 3 or 6 digit) to HSL so categories group by visual hue
// instead of raw hex-string order (which scatters golds among pinks, etc.).
window.dokkanHexToHsl = function(hex) {
    let clean = String(hex || '').trim().replace(/^#/, '');
    if (/^[0-9a-fA-F]{3}$/.test(clean)) clean = clean.split('').map(c => c + c).join('');
    if (!/^[0-9a-fA-F]{6}$/.test(clean)) return { h: 0, s: 0, l: 0.5 };
    const r = parseInt(clean.slice(0, 2), 16) / 255;
    const g = parseInt(clean.slice(2, 4), 16) / 255;
    const b = parseInt(clean.slice(4, 6), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min) return { h: 0, s: 0, l };
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h = 0;
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (max === g) h = ((b - r) / d + 2) * 60;
    else h = ((r - g) / d + 4) * 60;
    return { h, s, l };
};

// Comparator: same visual color family sits together, then lightness, then name.
window.compareDokkanCategoryColors = function(aColor, aName, bColor, bName) {
    const A = String(aColor || '#38bdf8').toLowerCase();
    const B = String(bColor || '#38bdf8').toLowerCase();
    if (A === B) return String(aName || '').localeCompare(String(bName || ''));
    const ha = window.dokkanHexToHsl(A), hb = window.dokkanHexToHsl(B);
    // Near-grays carry no family hue; park them after chromatic colors by lightness.
    const ea = ha.s < 0.12 ? 1000 + ha.l : ha.h;
    const eb = hb.s < 0.12 ? 1000 + hb.l : hb.h;
    if (Math.abs(ea - eb) > 0.5) return ea - eb;
    if (ha.l !== hb.l) return ha.l - hb.l;
    if (ha.s !== hb.s) return ha.s - hb.s;
    return String(aName || '').localeCompare(String(bName || ''));
};

// Category labels in older custom-card exports are not consistent: some keep
// the real name in data-category-name, some keep it in a hidden fallback span,
// and some only preserve the numeric label image. Keep all of those formats
// on the same binding path so a generic image alt such as "Category" cannot
// replace the imported name in the clean frontend.
function normalizeDokkanCategoryText(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function isGenericDokkanCategoryText(value) {
    const text = normalizeDokkanCategoryText(value);
    return !text || /^category(?:\s+(?:name|#?\d+))?$/i.test(text);
}

function readDokkanCategoryId(value) {
    if (value === undefined || value === null) return '';
    if (typeof value === 'object') {
        return readDokkanCategoryId(
            value.id ?? value.category_id ?? value.categoryId ?? value.cat_id ?? value.category
        );
    }

    const text = String(value).trim();
    if (!text) return '';
    const labelMatch = text.match(/card_category_label_(\d+)_/i);
    const placeholderMatch = text.match(/^category\s+#?(\d+)$/i);
    const numericValue = labelMatch
        ? labelMatch[1]
        : (placeholderMatch ? placeholderMatch[1] : (/^\d+$/.test(text) ? text : ''));
    if (!numericValue) return '';

    const parsed = parseInt(numericValue, 10);
    return Number.isFinite(parsed) && parsed > 0 ? String(parsed) : '';
}

function findDokkanCategoryRecord(categoryId) {
    if (!categoryId) return null;
    const categories = window.DB?.categories;
    if (!categories) return null;
    if (Array.isArray(categories)) {
        return categories.find(category => String(category?.id ?? '') === String(categoryId)) || null;
    }
    return categories[String(categoryId)] || categories[categoryId] ||
        Object.values(categories).find(category => String(category?.id ?? '') === String(categoryId)) || null;
}

function resolveDokkanCategoryDisplay(source) {
    const isDomNode = source && typeof source.getAttribute === 'function';
    const image = isDomNode
        ? (source.matches?.('img') ? source : source.querySelector?.('img'))
        : null;

    const nameCandidates = [];
    const idCandidates = [];
    const addName = value => {
        const text = normalizeDokkanCategoryText(value);
        if (text && !nameCandidates.includes(text)) nameCandidates.push(text);
    };
    const addId = value => {
        const id = readDokkanCategoryId(value);
        if (id && !idCandidates.includes(id)) idCandidates.push(id);
    };

    if (source && typeof source === 'object' && !isDomNode) {
        addName(source.name);
        addName(source.category_name);
        addName(source.categoryName);
        addId(source.id ?? source.category_id ?? source.categoryId ?? source.cat_id ?? source.category);
        addId(source.imageSrc ?? source.image ?? source.src);
    } else if (!isDomNode) {
        // Published card data commonly stores categories as numeric IDs or
        // numeric strings rather than objects.
        addId(source);
        if (!readDokkanCategoryId(source)) addName(source);
    }

    if (isDomNode) {
        addName(source.dataset?.categoryName);
        addName(source.getAttribute('data-category-name'));
        addName(source.getAttribute('data-name'));
        addName(source.getAttribute('aria-label'));

        ['data-category-id', 'data-id', 'data-cat-id', 'data-category'].forEach(attribute => {
            addId(source.getAttribute(attribute));
        });

        const fallback = source.querySelector?.('.category-name-fallback');
        const namedElement = source.querySelector?.('.category-name, .abs-category-name');
        addName(fallback?.textContent);
        addName(namedElement?.textContent);

        // A few hand-authored cards use a plain text span instead of the
        // editor's fallback class. Read direct text children, but still reject
        // generic labels and controls through the normal candidate filter.
        source.querySelectorAll?.(':scope > span, :scope > a').forEach(element => {
            addName(element.textContent);
        });

        addId(image?.dataset?.categoryId);
        addId(image?.getAttribute('data-category-id'));
        addId(image?.getAttribute('data-id'));
        addId(image?.getAttribute('src'));
        addId(image?.currentSrc);
        addName(image?.dataset?.categoryName);
        addName(image?.getAttribute('data-category-name'));
        addName(image?.getAttribute('alt'));
        addName(image?.getAttribute('title'));
    }

    let categoryId = idCandidates[0] || '';
    let categoryRecord = findDokkanCategoryRecord(categoryId);
    const importedName = nameCandidates.find(name => !isGenericDokkanCategoryText(name)) || '';

    // Some published JSON stores the category name directly. Resolve that
    // name back to its record when possible so the label image can still use
    // the correct numeric ID.
    if (!categoryRecord && importedName) {
        const categories = window.DB?.categories;
        const categoryValues = Array.isArray(categories) ? categories : Object.values(categories || {});
        categoryRecord = categoryValues.find(category =>
            normalizeDokkanCategoryText(category?.name).toLocaleLowerCase() === importedName.toLocaleLowerCase()
        ) || null;
        if (categoryRecord) categoryId = readDokkanCategoryId(categoryRecord.id);
    }
    const databaseName = normalizeDokkanCategoryText(categoryRecord?.name);
    const categoryName = importedName || databaseName || (categoryId ? `Category ${categoryId}` : '');
    const categorySource = isDomNode
        ? (image?.getAttribute('src') || image?.currentSrc || '')
        : normalizeDokkanCategoryText(source?.imageSrc ?? source?.image ?? source?.src);

    return {
        id: categoryId,
        name: categoryName,
        source: categorySource,
        hasResolvedName: Boolean(categoryName && !isGenericDokkanCategoryText(categoryName))
    };
}

function getEditorCategoryItems(container) {
    if (!container) return [];

    let items = Array.from(container.querySelectorAll?.('.editor-category-item') || []);
    if (!items.length) {
        // Imported markup may omit the editor class. Each category label is
        // represented by one image, so its nearest parent is the safest item
        // boundary even when an export added an extra wrapper.
        items = Array.from(container.querySelectorAll?.('img') || [])
            .map(image => image.closest?.('.editor-category-item') || image.parentElement)
            .filter(Boolean);
    }
    if (!items.length) {
        items = Array.from(container.children || [])
            .filter(item => item.dataset?.categoryName || item.querySelector?.('.category-name-fallback'));
    }

    return Array.from(new Set(items));
}

window.resolveDokkanCategoryDisplay = resolveDokkanCategoryDisplay;
window.getEditorCategoryItems = getEditorCategoryItems;

// Count unique characters represented by a category. Official card data uses
// numeric category IDs, while custom/imported data may carry category names;
// support both forms and de-duplicate transformed cards by character_id (or
// the safest available parent/card identity).
window.getDokkanCategoryCharacterCount = function(categoryId, categoryName) {
    const hubCount = window.getCardHubCategoryCharacterCount?.(categoryId, categoryName);
    if (Number.isFinite(hubCount)) return hubCount;

    const rawCards = window.DB?.cards;
    const cards = Array.isArray(rawCards) ? rawCards : Object.values(rawCards || {});
    if (!cards.length) return 0;

    const targetId = readDokkanCategoryId(categoryId);
    const targetName = normalizeDokkanCategoryText(categoryName).toLocaleLowerCase();
    const asArray = value => Array.isArray(value)
        ? value
        : (value === undefined || value === null || value === '' ? [] : [value]);
    const sameName = value => normalizeDokkanCategoryText(
        typeof value === 'object'
            ? (value?.name ?? value?.category_name ?? value?.categoryName ?? '')
            : value
    ).toLocaleLowerCase() === targetName;
    const matchingCharacters = new Set();

    cards.forEach(card => {
        if (!card) return;
        const categoryValues = [
            ...asArray(card.categories),
            ...asArray(card.category_ids),
            ...asArray(card.categoryIds)
        ];
        const categoryNames = [
            ...asArray(card.category_names),
            ...asArray(card.categoryNames)
        ];
        const matchesId = targetId && categoryValues.some(value => readDokkanCategoryId(value) === targetId);
        const matchesName = targetName && (
            categoryValues.some(sameName) || categoryNames.some(sameName)
        );
        if (!matchesId && !matchesName) return;

        const identity = card.character_id ?? card.characterId ?? card.characterID ??
            card.parent_id ?? card.parentId ?? card.id;
        if (identity !== undefined && identity !== null && String(identity).trim()) {
            matchingCharacters.add(String(identity));
        }
    });

    return matchingCharacters.size;
};

window.normalizeEditorCategoryItems = function(container = document.getElementById('card-category-container')) {
    getEditorCategoryItems(container).forEach(item => {
        const resolved = resolveDokkanCategoryDisplay(item);
        if (!resolved.name) return;

        item.classList.add('editor-category-item');
        if (resolved.id) item.dataset.categoryId = resolved.id;
        item.dataset.categoryName = resolved.name;

        const image = item.querySelector?.('img');
        if (image) image.alt = resolved.name;

        let fallback = item.querySelector?.('.category-name-fallback');
        if (!fallback) {
            fallback = document.createElement('span');
            fallback.className = 'category-name-fallback';
            fallback.style.display = 'none';
            item.appendChild(fallback);
        }
        fallback.textContent = resolved.name;
    });
};

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

    const basePrefix = './';

    return {
        bgUrl: `${basePrefix}assets/card-art/cards/${bgFolderId}/card_${bgFolderId}_bg.png`,
        charUrl: `${basePrefix}assets/card-art/cards/${folderId}/card_${folderId}_character.png`,
        effectUrl: `${basePrefix}assets/card-art/cards/${folderId}/card_${folderId}_effect.png`,
        thumbUrl: `${basePrefix}assets/card-art/thumbnails/card_${folderId}_thumb/card_${folderId}_thumb.png`,
        parentThumbUrl: `${basePrefix}assets/card-art/thumbnails/card_${parentFolderId}_thumb/card_${parentFolderId}_thumb.png`,
        artUrl: `${basePrefix}assets/card-art/cards/${folderId}/card_${folderId}_character.png`
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

// Banner provenance belongs to an entire physical awakening route, not to a
// single rarity within it. The game stores SSR -> TUR -> LR as separate card
// IDs, so looking only at an SSR can otherwise label a Dokkan Festival unit as
// free-to-play. Transformed forms are deliberately excluded because they can
// have their own provenance.
const AWAKENING_FAMILY_TAG_PRIORITY = [
    'DOKKAN FESTIVAL EXCLUSIVE',
    'PRIME BATTLE (F2P LR)',
    'LEGENDARY SUMMON CARNIVAL',
    'GENERAL POOL (BANNER UNIT)',
    'FREE TO PLAY (LR)',
    'FREE TO PLAY'
];

let awakeningFamilyTagCache = null;

function normalizeCardIdForFamily(cardId) {
    const parsed = parseInt(cardId || 0, 10);
    return parsed > 10000000 ? Math.floor(parsed / 10) : parsed;
}

function isTransformCardId(cardId) {
    const normalizedId = normalizeCardIdForFamily(cardId);
    return normalizedId >= 4000000 && normalizedId < 5000000;
}

function isFamilyLrCard(card) {
    return parseInt(card?.rarity || 0, 10) === 5
        || parseInt(card?.max_level || 0, 10) >= 150
        || [77, 99].includes(parseInt(card?.cost || 0, 10));
}

function getLeaderCategoryCount(card) {
    const leaderId = parseInt(card?.lead_id || card?.leader_skill_set_id || 0, 10);
    const leader = leaderId && DB.leaders ? (DB.leaders[String(leaderId)] || DB.leaders[leaderId]) : null;
    const description = String(leader?.description || leader?.effect || '').replace(/\s+/g, ' ');
    const beforeStatClause = description.split(/\bcategory\s+ki\b/i)[0];
    const categoryNames = beforeStatClause.match(/"[^"]+"/g) || [];
    return new Set(categoryNames.map(name => name.toLowerCase())).size;
}

function getAwakeningFamilyTag(card) {
    if (!card || !window.DB || !Array.isArray(DB.cards) || !Array.isArray(DB.awakeningRoutes)) return '';

    const startId = normalizeCardIdForFamily(card.id);
    if (!startId || isTransformCardId(startId)) return '';

    if (!awakeningFamilyTagCache) {
        const adjacent = new Map();
        const addEdge = (left, right) => {
            if (!left || !right || left === right || isTransformCardId(left) || isTransformCardId(right)) return;
            if (!adjacent.has(left)) adjacent.set(left, new Set());
            if (!adjacent.has(right)) adjacent.set(right, new Set());
            adjacent.get(left).add(right);
            adjacent.get(right).add(left);
        };

        DB.awakeningRoutes.forEach(route => {
            addEdge(
                normalizeCardIdForFamily(route.card_id),
                normalizeCardIdForFamily(route.awaked_card_id)
            );
        });

        const cardTags = new Map();
        const cardData = new Map();
        DB.cards.forEach(candidate => {
            const candidateId = normalizeCardIdForFamily(candidate.id);
            if (!candidateId || isTransformCardId(candidateId)) return;
            const tag = String(candidate.tag || '').trim().toUpperCase();
            if (AWAKENING_FAMILY_TAG_PRIORITY.includes(tag)) {
                if (!cardTags.has(candidateId)) cardTags.set(candidateId, new Set());
                cardTags.get(candidateId).add(tag);
            }
            if (!cardData.has(candidateId)) cardData.set(candidateId, []);
            cardData.get(candidateId).push(candidate);
        });

        awakeningFamilyTagCache = { adjacent, cardTags, cardData, resolved: new Map() };
    }

    const cached = awakeningFamilyTagCache.resolved.get(startId);
    if (cached !== undefined) return cached;

    const visited = new Set([startId]);
    const pending = [startId];
    const tags = new Set();
    const familyCards = [];
    while (pending.length) {
        const current = pending.pop();
        const currentTags = awakeningFamilyTagCache.cardTags.get(current);
        if (currentTags) currentTags.forEach(tag => tags.add(tag));
        const currentCards = awakeningFamilyTagCache.cardData.get(current);
        if (currentCards) familyCards.push(...currentCards);
        const neighbors = awakeningFamilyTagCache.adjacent.get(current);
        if (!neighbors) continue;
        neighbors.forEach(neighbor => {
            if (!visited.has(neighbor)) {
                visited.add(neighbor);
                pending.push(neighbor);
            }
        });
    }

    const lrCards = familyCards.filter(isFamilyLrCard);
    const lrTags = new Set(lrCards.map(candidate => String(candidate.tag || '').trim().toUpperCase()));
    let resolvedTag = '';

    if (lrCards.length) {
        // Cost alone marks many pre-LR SSR/TUR cards as DFE in an older export.
        // For a route that reaches LR, use the final LR evidence instead. A
        // three-category leader is an extra DFE signal; Yellow Coin/Carnival
        // LRs never use that three-category leader format.
        const hasDfeLrEvidence = lrCards.some(candidate => {
            const stem = Math.floor(normalizeCardIdForFamily(candidate.id) / 10);
            return String(candidate.tag || '').trim().toUpperCase() === 'DOKKAN FESTIVAL EXCLUSIVE'
                || hasCuratedDfeLrStem(stem)
                || getLeaderCategoryCount(candidate) >= 3;
        });
        if (hasDfeLrEvidence) resolvedTag = 'DOKKAN FESTIVAL EXCLUSIVE';
        else resolvedTag = AWAKENING_FAMILY_TAG_PRIORITY.find(tag => lrTags.has(tag)) || '';
    }

    if (!resolvedTag) resolvedTag = AWAKENING_FAMILY_TAG_PRIORITY.find(tag => tags.has(tag)) || '';
    // Cache each member of this connected awakening route for later cards.
    visited.forEach(cardId => awakeningFamilyTagCache.resolved.set(cardId, resolvedTag));
    return resolvedTag;
}

function getCardUnitTag(card) {
    if (!card) return "CHARACTER DETAILS";

    const cardId = parseInt(card.id || 0, 10);
    const normalizedCardId = cardId > 10000000 ? Math.floor(cardId / 10) : cardId;
    // A transformed form can have its own banner classification.  Following
    // parent_id here incorrectly replaces that classification with the unit
    // which happens to own the transform (for example, SSB Vegito inherited
    // Super Saiyan Vegeta's general-pool tag).
    const rootId = normalizedCardId >= 4000000 && normalizedCardId < 5000000
        ? normalizedCardId
        : getRootParentId(card);
    const rootCard = (window.DB && Array.isArray(DB.cards)) 
        ? (DB.cards.find(c => parseInt(c.id, 10) === rootId) || card) 
        : card;

    // The game database does not preserve historical banner provenance. Keep
    // only confirmed exceptions here; this corrects data exported before the
    // extractor's expanded DFE-LR stem list is run again.
    const confirmedTagByStem = {
        101862: 'DOKKAN FESTIVAL EXCLUSIVE', // 5th Anniversary AGL Gogeta
        101865: 'DOKKAN FESTIVAL EXCLUSIVE', // 5th Anniversary STR Vegito
    };
    const exactStem = Math.floor(normalizedCardId / 10);
    const physicalStem = Math.floor(rootId / 10);
    // transform_parent_id is written only after strict identity validation by
    // the extractor. Unlike the older generic parent_id, it is safe to use
    // for a confirmed banner-provenance override on an alternate form.
    const transformParentId = parseInt(card.transform_parent_id || 0, 10);
    const normalizedTransformParentId = transformParentId > 10000000
        ? Math.floor(transformParentId / 10)
        : transformParentId;
    const transformStem = Math.floor(normalizedTransformParentId / 10);
    const confirmedTag = confirmedTagByStem[exactStem]
        || confirmedTagByStem[physicalStem]
        || confirmedTagByStem[transformStem];
    if (confirmedTag) return confirmedTag;

    const awakeningFamilyTag = getAwakeningFamilyTag(card);
    if (awakeningFamilyTag) return awakeningFamilyTag;

    if (rootCard && rootCard.tag && typeof rootCard.tag === 'string' && rootCard.tag.trim() && rootCard.tag !== 'CHARACTER DETAILS') {
        const t = rootCard.tag.trim();
        const leader = findLeaderObj(rootCard, 'base');
        const leaderText = String(leader?.description || leader?.effect || rootCard.leader_skill || '').toLowerCase();
        const staleF2pClassification = /free to play/i.test(t)
            && isCardLR(rootCard)
            // A full 200% category leader is a summonable LR.  This catches
            // corrupt hand-maintained stem lists without downgrading genuine
            // event LRs with low-percentage leaders.
            && /\b(?:170|180|200)%/.test(leaderText);
        if (t !== 'SUMMONABLE UNIT' && !staleF2pClassification) return t;
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

        if (hasCuratedDfeLrStem(stemCurrent) || hasCuratedDfeLrStem(stemParent) || isDfeLead) {
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

    const fallback = card.release_date || card.open_at;
    if (fallback && typeof fallback === 'string' && fallback !== 'TBD' && !fallback.startsWith('2010') && !fallback.startsWith('1970')) {
        return fallback;
    }

    return "TBD";
}

function formatESTDateWithTime(utcDateStr) {
    if (!utcDateStr || utcDateStr === 'TBD' || utcDateStr.trim() === '') return "TBD";
    try {
        const raw = String(utcDateStr).trim();
        if (/EST|EDT/i.test(raw)) return raw;
        const cleanedStr = raw.replace(" ", "T") + (raw.includes("Z") ? "" : "Z");
        let date = new Date(cleanedStr);
        if (isNaN(date.getTime())) {
            date = new Date(raw);
        }
        if (isNaN(date.getTime())) return raw;
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
        return String(utcDateStr || "TBD"); 
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

    // The inspected form is authoritative.  A transformed card can be an LR
    // even when the physical unit referenced by parent_id is only a TUR (for
    // example the anniversary Blue Vegito/Gogeta transformations).  Looking
    // at the parent first made those real LRs fall into the TUR sticker path.
    const maxLvl = parseInt(card.max_level || card.lv_max || card.max_lv || 0, 10);
    const cost = parseInt(card.cost || 0, 10);
    const rarityStr = String(card.rarity || '').toUpperCase();
    if (rarityStr === 'LR' || maxLvl >= 150 || cost === 77 || cost === 99) {
        return true;
    }

    // Some older exports omit the transformed form's final rarity data.  Only
    // then use its parent as a conservative fallback.
    if (normId >= 4000000 && normId < 5000000) {
        const rootId = getRootParentId(card);
        if (rootId && window.DB && Array.isArray(DB.cards)) {
            const parent = DB.cards.find(c => parseInt(c.id, 10) === rootId);
            if (parent) {
                return parent.max_level >= 150 || parent.cost === 77 || parent.cost === 99 || parent.rarity === 'LR';
            }
        }
    }

    return false;
}

function buildComposedIcon(c, usePlainType = false, forceAwakenedMode = null, extraClass = '') {
    const { thumbUrl } = resolveCardAssets(c);
    const { cardClass: cClass, cardType: cType } = getCardClassAndType(c.element !== undefined ? c.element : c.attribute);
    
    const exactRarity = getCardExactRarity(c);
    const isLR = exactRarity === 'LR';
    const isTUR = exactRarity === 'TUR';
    let raritySrc = `${CENTRAL_ASSET_URL}rarity_ssr_abs.png`;
    if (isLR) raritySrc = `${CENTRAL_ASSET_URL}rarity_lr_abs.png`;
    else if (isTUR) raritySrc = `${CENTRAL_ASSET_URL}rarity_TUR_abs.png`;
    const typeSrc = (exactRarity === 'SSR' || usePlainType)
        ? `${CENTRAL_ASSET_URL}type_${cType}.png`
        : `${CENTRAL_ASSET_URL}${cClass}_type_${cType}.png`;
    const frameSrc = `${CENTRAL_ASSET_URL}frame_${cType}.png`;

    const isSEZA = forceAwakenedMode === 'seza' || (forceAwakenedMode === null && isSezaCard(c));
    const isEZA = isSEZA || forceAwakenedMode === 'eza' || (forceAwakenedMode === null && isEzaCard(c));

    const isCleanForm = Boolean(extraClass && extraClass.includes('abs-clean-form-icon'));
    const lrSpinHtml = (!isCleanForm && isLR) ? `<img src="${CENTRAL_ASSET_URL}lr_spin_dial.png" class="lr-spin-dial">` : '';
    
    const lrLightningHtml = (!isCleanForm && isLR) ? `
        <video class="lightning-overlay" autoplay muted loop playsinline style="--lightning-color: ${lightningColors[cType] || 'rgb(0, 150, 255)'};">
            <source src="${CENTRAL_ASSET_URL}lightningfx.webm" type="video/webm">
        </video>` : '';

    const ezaIconSrc = isSEZA
        ? `${CENTRAL_ASSET_URL}superza_abs.png`
        : (isEZA && forceAwakenedMode !== 'base' ? `${CENTRAL_ASSET_URL}eza_abs.png` : '');
    const ezaHtml = (ezaIconSrc && isEZA && forceAwakenedMode !== 'base')
        ? `<img src="${ezaIconSrc}" class="eza-icon" alt="${isSEZA ? 'SUPER EZA' : 'EZA'}">`
        : '';
    const sezaGlowClass = isSEZA ? 'seza-glow-card' : '';
    const sezaFlameCanvasHtml = isSEZA ? `<canvas class="seza-lwf-border-canvas" data-seza-type="${cType}"></canvas>` : '';

    const iconClassName = ['abs-composed-icon', sezaGlowClass, extraClass]
        .filter(Boolean)
        .join(' ');

    return `
        <div class="${iconClassName}" data-card-type="${cType}" ${isSEZA ? `data-seza="true" data-type="${cType}"` : ''}>
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

function getAbsCleanPassiveTotals(rawText) {
    const totals = {
        atk: 0,
        def: 0,
        damageReduction: 0,
        evasion: 0,
        critical: 0
    };
    const explicit = new Set();
    const chanceMaximums = { evasion: 0, critical: 0 };
    const source = String(rawText ?? '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\{[^}]*\}/g, ' ')
        .replace(/\u00a0/g, ' ');
    const lines = source.split(/\r?\n/)
        .map(line => line.replace(/\s+/g, ' ').trim())
        .filter(Boolean);

    const rateKeys = new Set(['damageReduction', 'evasion', 'critical']);
    const add = (key, value, markExplicit = true) => {
        const numericValue = Number.parseFloat(String(value).replace(/,/g, ''));
        if (!Number.isFinite(numericValue) || numericValue < 0) return;
        totals[key] += numericValue;
        if (markExplicit) explicit.add(key);
    };

    const targetsFor = (context) => {
        const lower = String(context || '').toLowerCase();
        const targets = [];
        if (/\batk\b/.test(lower)) targets.push('atk');
        if (/\bdef\b/.test(lower)) targets.push('def');
        if (
            /damage\s+reduction(?:\s+rate)?/.test(lower) ||
            /reduces?\s+(?:damage|damage\s+received)/.test(lower) ||
            /damage\s+(?:received|taken)\s+(?:is\s+)?(?:reduced|decreased)/.test(lower) ||
            /(?:receives?|takes?)\s+.*?\bless\s+damage\b/.test(lower)
        ) {
            targets.push('damageReduction');
        }
        if (/evad|dodg/.test(lower)) targets.push('evasion');
        if (/\bcritical\b|\bcrit\b/.test(lower)) targets.push('critical');
        return targets;
    };

    const contextBefore = (line, index) => {
        const prefix = line.slice(0, index);
        const delimiters = [...prefix.matchAll(/[,;]|\b(?:and|plus|also|or|as well as)\b/gi)];
        const last = delimiters[delimiters.length - 1];
        return last ? prefix.slice(last.index + last[0].length) : prefix;
    };

    const contextAfter = (line, index) => {
        const suffix = line.slice(index);
        const nextDelimiter = suffix.search(/[,;]|\b(?:and|plus|also|or|as well as)\b/i);
        return nextDelimiter >= 0 ? suffix.slice(0, nextDelimiter) : suffix;
    };

    const addTargets = (line, match, targets, lastAddByKey) => {
        const numericValue = Number.parseFloat(String(match[1]).replace(/,/g, ''));
        if (!Number.isFinite(numericValue) || numericValue < 0 || !targets.length) return;

        // “ATK 10% (up to 50%)” describes a 50% maximum, not 10% + 50%.
        // Replace only the immediately preceding value for the same stat on
        // this line; independent clauses remain additive.
        const isUpperBound = /\bup\s+to\s*$/i.test(line.slice(0, match.index).trim());
        targets.forEach(key => {
            if (isUpperBound) {
                const previous = lastAddByKey.get(key);
                if (previous && match.index - previous.index <= 120) totals[key] -= previous.value;
            }
            add(key, numericValue);
            lastAddByKey.set(key, { index: match.index, value: numericValue });
        });
    };

    const percentPattern = /([+-]?\d+(?:,\d{3})*(?:\.\d+)?)\s*%/g;
    lines.forEach(line => {
        const matches = [...line.matchAll(percentPattern)];
        let previousTargets = [];
        const lastAddByKey = new Map();
        matches.forEach(match => {
            const before = contextBefore(line, match.index);
            const after = contextAfter(line, match.index + match[0].length);
            let targets = targetsFor(before);

            // “50% chance to evade” puts the target after the percentage. Only
            // special rates use this suffix form so condition percentages such
            // as “HP is 50% or less, ATK 200%” cannot become ATK 50%.
            targetsFor(after)
                .filter(key => rateKeys.has(key))
                .forEach(key => {
                    if (!targets.includes(key)) targets.push(key);
                });

            // When one percentage follows a coordinated list, that one value
            // belongs to each listed special rate: “critical, evasion & damage
            // reduction rate 25%”. Do not apply this broad rule to a line with
            // multiple percentages, where each clause has its own value.
            if (matches.length === 1) {
                targetsFor(line).filter(key => rateKeys.has(key)).forEach(key => {
                    if (!targets.includes(key)) targets.push(key);
                });
            }

            // Preserve the previous target for abbreviated clauses such as
            // “ATK & DEF +15% and an additional +10%”.
            if (!targets.length && /additional|another|further|more/i.test(before)) {
                targets = previousTargets.slice();
            }

            addTargets(line, match, targets, lastAddByKey);
            if (targets.length) previousTargets = targets;
        });
    });

    const chanceValue = (line, key) => {
        const lower = line.toLowerCase();
        if (key === 'critical') {
            if (/all\s+attacks?\s+(?:become|are)\s+critical|performs?\s+(?:a\s+)?critical\s+hit/.test(lower)) return 100;
            if (!/critical|crit/.test(lower)) return 0;
        } else {
            if (/guaranteed\s+to\s+(?:evade|dodge)|evades?\s+(?:the\s+)?enemy/.test(lower)) return 100;
            if (!/evad|dodg/.test(lower)) return 0;
        }
        if (/great\s+chance/.test(lower)) return 70;
        if (/high\s+chance/.test(lower)) return 50;
        if (/medium\s+chance/.test(lower)) return 30;
        if (/low\s+chance/.test(lower)) return 20;
        if (/rare\s+chance/.test(lower)) return 10;
        return /\bchance\b/.test(lower) ? 30 : 0;
    };

    // Chance-based effects are alternatives, not percentages to multiply or
    // blindly add once for every repeated phrase. Keep the strongest chance
    // descriptor and let explicit numeric rates remain additive below.
    lines.forEach(line => {
        chanceMaximums.critical = Math.max(chanceMaximums.critical, chanceValue(line, 'critical'));
        chanceMaximums.evasion = Math.max(chanceMaximums.evasion, chanceValue(line, 'evasion'));
    });
    // An explicit numeric rate is authoritative. A plain “chance” phrase is
    // only a fallback when that stat has no numeric percentage of its own.
    totals.critical = Math.min(100, explicit.has('critical')
        ? totals.critical
        : Math.max(totals.critical, chanceMaximums.critical));
    totals.evasion = Math.min(100, explicit.has('evasion')
        ? totals.evasion
        : Math.max(totals.evasion, chanceMaximums.evasion));
    totals.damageReduction = Math.min(100, totals.damageReduction);

    return totals;
}

// Read the editor's effect text instead of parsing the rendered card markup.
// This prevents summary totals from counting decorative headers, hidden copies,
// or duplicated DOM fragments created while switching card themes.
window.getAbsCleanPassiveSource = function() {
    const sidebar = document.getElementById('sidebar-sections-area');
    const editorBodies = Array.from(sidebar?.querySelectorAll('textarea[id^="input-sec-"]') || [])
        .map(textarea => String(textarea.value || textarea.textContent || textarea.getAttribute('value') || '').trim())
        .filter(value => value && !/^-\s*new effect\.\.\.$/i.test(value));
    if (editorBodies.length) return editorBodies.join('\n');

    const listText = container => Array.from(container?.querySelectorAll('li') || [])
        .map(item => String(item.textContent || '').replace(/\s+/g, ' ').trim())
        .filter(Boolean);
    const renderedItems = listText(document.getElementById('abs-passive-container'));
    if (renderedItems.length) return renderedItems.join('\n');

    const legacyItems = listText(document.getElementById('card-passive-container'));
    if (legacyItems.length) return legacyItems.join('\n');

    return document.getElementById('abs-passive-container')?.innerText ||
        document.getElementById('card-passive-container')?.innerText || '';
};

function renderAbsCleanPassiveSummary(rawText) {
    const text = String(rawText ?? '').trim();
    if (!text) return '';

    const totals = getAbsCleanPassiveTotals(text);
    const items = [
        ['ATK', totals.atk, true],
        ['DEF', totals.def, true],
        ['DMG RED', totals.damageReduction, false],
        ['DODGE', totals.evasion, false],
        ['CRIT', totals.critical, false]
    ];

    return `
        <div class="abs-passive-summary-grid">
            ${items.map(([label, value, signed]) => `
                <div class="abs-passive-summary-item" data-stat="${label.toLowerCase().replace(/\s+/g, '-')}">
                    <span>${label}</span>
                    <strong>${signed ? '+' : ''}${Math.round(value)}%</strong>
                </div>
            `).join('')}
        </div>
    `;
}

window.syncAbsCleanPassiveSummary = function(rawText = null) {
    const summary = document.getElementById('abs-passive-summary');
    if (!summary) return;

    const isClean = document.body?.classList.contains('theme-abs-clean');
    const fallback = window.getAbsCleanPassiveSource?.() || '';
    const source = rawText === null || rawText === undefined ? fallback : rawText;
    const html = isClean ? renderAbsCleanPassiveSummary(source) : '';
    summary.innerHTML = html;
    summary.hidden = !html;
    window.syncAbsCleanAbilityDockPlacement?.();
};

(function setupGlobalFloatingTooltip() {
    if (typeof document === 'undefined') return;
    let tooltipEl = null;

    function getOrCreateTooltip() {
        if (!tooltipEl) {
            tooltipEl = document.getElementById('abs-global-floating-tooltip');
            if (!tooltipEl) {
                tooltipEl = document.createElement('div');
                tooltipEl.id = 'abs-global-floating-tooltip';
                document.body.appendChild(tooltipEl);
            }
        }
        return tooltipEl;
    }

    document.addEventListener('mouseover', function(e) {
        const badge = e.target.closest('[data-tooltip]');
        if (!badge) return;

        const text = badge.getAttribute('data-tooltip');
        if (!text) return;

        const tip = getOrCreateTooltip();
        tip.classList.toggle('info-link-tooltip', Boolean(badge.closest('#card-link-container a')));
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
        if (e.relatedTarget && badge.contains(e.relatedTarget)) return;
        if (tooltipEl) {
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

// Keep the live HP/ATK/DEF summary outside the clean card-art container as its
// own side-column surface. In clean mode it follows the complete art dock so
// the Stats panel is visibly below the artwork while the Card Art/Animation
// controls remain owned by the dock itself.
window.syncAbsCleanStatsAndArtPlacement = function() {
    const statsBox = document.getElementById('abs-stats-box');
    const sideCol = document.querySelector('#layout-abs-style .abs-side-col');
    const categoryLinksColumn = document.getElementById('abs-clean-category-links-column');
    const categoryBox = document.getElementById('abs-category-container')?.closest('.abs-box');
    const artDock = sideCol?.querySelector(':scope > #abs-art-dock-wrapper') ||
        document.getElementById('abs-art-dock-wrapper');
    const isClean = document.body?.classList.contains('theme-abs-clean');

    if (!statsBox || !sideCol) return;

    // Card view does not run the editor's header-composition pass, so keep a
    // safe native home here as well. This lets the stats shell move into the
    // clean utility column and return without ever creating a DOM cycle.
    if (!window.__absCleanStatsHome && !window.__absCleanStatsPlacementHome) {
        const nativeParent = statsBox.parentElement;
        if (nativeParent && nativeParent !== statsBox && !statsBox.contains(nativeParent)) {
            window.__absCleanStatsPlacementHome = {
                parent: nativeParent,
                next: statsBox.nextElementSibling
            };
        }
    }

    if (!isClean) {
        statsBox.classList.remove('abs-clean-stats-above-art', 'abs-clean-stats-under-art');
        statsBox.classList.remove('abs-clean-stats-above-categories');
        const savedHome = window.__absCleanStatsHome || window.__absCleanStatsPlacementHome;
        const restoreParent = savedHome?.parent?.isConnected ? savedHome.parent : sideCol;
        if (restoreParent && restoreParent !== statsBox && !statsBox.contains(restoreParent) && statsBox.parentElement !== restoreParent) {
            const restoreAnchor = savedHome?.next &&
                savedHome.next !== statsBox &&
                savedHome.next.parentElement === restoreParent &&
                !statsBox.contains(savedHome.next)
                ? savedHome.next
                : null;
            try { restoreParent.insertBefore(statsBox, restoreAnchor); }
            catch (error) { try { restoreParent.appendChild(statsBox); } catch (fallbackError) {} }
        }
        sideCol.style.removeProperty('--abs-clean-art-flow-offset-y');
        artDock?.style.removeProperty('--abs-clean-stats-dock-height');
        return;
    }

    // A stale cached layout can briefly leave the art dock nested inside the
    // old Stats shell or portrait stage. Detach that invalid shape before
    // moving Stats, otherwise the art is not a real sibling and the panel can
    // never land directly below it. The guard also prevents inserting an
    // ancestor into its own descendant during hot reloads.
    if (artDock && artDock.parentElement !== sideCol && !artDock.contains(sideCol)) {
        sideCol.appendChild(artDock);
    }

    // The clean utility column owns Stats, Categories, and Links. Put Stats
    // directly above Categories once that column exists; Links remains in
    // its established section below Categories.
    if (categoryLinksColumn && categoryBox && categoryBox.parentElement === categoryLinksColumn &&
        !statsBox.contains(categoryLinksColumn)) {
        if (statsBox.parentElement !== categoryLinksColumn) {
            categoryLinksColumn.insertBefore(statsBox, categoryBox);
        } else if (statsBox.nextElementSibling !== categoryBox) {
            categoryLinksColumn.insertBefore(statsBox, categoryBox);
        }
        statsBox.hidden = false;
        statsBox.classList.remove('abs-clean-stats-under-art', 'abs-clean-stats-above-art');
        statsBox.classList.add('abs-clean-stats-above-categories');
        sideCol.style.removeProperty('--abs-clean-art-flow-offset-y');
        artDock?.style.removeProperty('--abs-clean-stats-dock-height');
        return;
    }

    // Stats is a direct sibling of the art dock. Put it immediately after the
    // dock when that anchor is available; this keeps the DOM order explicit
    // without ever inserting an ancestor into its own descendant.
    const artAnchor = artDock?.parentElement === sideCol ? artDock : null;
    const nextAfterArt = artAnchor?.nextElementSibling || null;
    const safeNextAfterArt = nextAfterArt &&
        nextAfterArt !== statsBox &&
        nextAfterArt.parentElement === sideCol &&
        !statsBox.contains(nextAfterArt)
        ? nextAfterArt
        : null;
    if (statsBox.parentElement !== sideCol) {
        if (artAnchor && !statsBox.contains(artAnchor)) sideCol.insertBefore(statsBox, safeNextAfterArt);
        else sideCol.appendChild(statsBox);
    } else if (artAnchor && statsBox !== nextAfterArt) {
        sideCol.insertBefore(statsBox, safeNextAfterArt);
    }

    statsBox.classList.remove('abs-clean-stats-under-art');
    statsBox.classList.remove('abs-clean-stats-above-categories');
    statsBox.classList.add('abs-clean-stats-above-art');

    // Stats has its own side-column footprint; it must not offset or resize the
    // art surface inside the card container.
    sideCol.style.removeProperty('--abs-clean-art-flow-offset-y');
    artDock?.style.removeProperty('--abs-clean-stats-dock-height');
};

// Resolve the clean-only homes for the live passive utility pieces. In abs.clean
// both the ability badges and the percentage totals sit in the top utility row
// of the Passive Skill box, outside the title header. Keeping the native homes
// lets the editor and published card layouts converge on the same DOM shape
// without changing the other themes.
window.ensureAbsCleanHeaderBadgeRail = function() {
    const abilityDocks = document.getElementById('abs-clean-ability-docks');
    const passiveSummary = document.getElementById('abs-passive-summary');
    const passiveBox = document.getElementById('abs-passive-skill-box');
    const passiveName = passiveBox?.querySelector(':scope > #abs-passive-name') ||
        document.getElementById('abs-passive-name');
    if (!passiveBox || !passiveName) return null;

    const legacyRail = document.getElementById('abs-clean-header-badges-rail');
    if (abilityDocks && !window.__absCleanAbilityDocksHome) {
        const currentParent = abilityDocks.parentElement;
        const wasCleanMoved = currentParent === legacyRail ||
            currentParent === passiveName ||
            currentParent === passiveBox;
        const nativeParent = wasCleanMoved
            ? (document.querySelector('#layout-abs-style .abs-header-left') ||
                document.querySelector('#layout-abs-style .abs-side-col'))
            : currentParent;
        if (nativeParent && nativeParent !== passiveBox && !abilityDocks.contains(nativeParent)) {
            const nativeNext = wasCleanMoved
                ? (nativeParent.classList.contains('abs-header-left')
                    ? nativeParent.firstElementChild
                    : nativeParent.querySelector(':scope > #abs-stats-box'))
                : abilityDocks.nextElementSibling;
            window.__absCleanAbilityDocksHome = {
                parent: nativeParent,
                next: nativeNext
            };
        }
    }

    // The totals start in the Passive box in the native markup. Remember that
    // home before moving them into the clean utility row, including the
    // original header as the restore anchor.
    if (passiveSummary && !window.__absCleanPassiveSummaryHome) {
        const currentParent = passiveSummary.parentElement;
        const wasCleanMoved = currentParent === passiveName;
        const nativeParent = wasCleanMoved ? passiveBox : currentParent;
        if (nativeParent && nativeParent !== passiveName && !passiveSummary.contains(nativeParent)) {
            window.__absCleanPassiveSummaryHome = {
                parent: nativeParent,
                next: wasCleanMoved ? passiveName : passiveSummary.nextElementSibling
            };
        }
    }

    if (!document.body?.classList.contains('theme-abs-clean')) return passiveName;

    const moveIntoPassiveTop = (node, anchor = passiveName) => {
        if (!node || node === passiveName || node.contains(passiveBox)) return;
        const safeAnchor = anchor && anchor.parentElement === passiveBox &&
            anchor !== node && !node.contains(anchor)
            ? anchor
            : passiveName;
        try {
            passiveBox.insertBefore(node, safeAnchor);
        } catch (error) {
            try { passiveBox.appendChild(node); } catch (fallbackError) {}
        }
    };

    // Keep the utility row above the title. The renderer can call this while
    // either node is still in the old header, so insert the badge dock first,
    // then put the totals immediately before the title, and finally repair the
    // left-to-right order if both nodes were already direct children.
    moveIntoPassiveTop(abilityDocks, passiveSummary?.parentElement === passiveBox
        ? passiveSummary
        : passiveName);
    moveIntoPassiveTop(passiveSummary, passiveName);
    if (abilityDocks?.parentElement === passiveBox && passiveSummary?.parentElement === passiveBox) {
        try { passiveBox.insertBefore(abilityDocks, passiveSummary); } catch (error) {}
    }

    // Remove the obsolete middle-column shell after its live child has been
    // safely relocated. This is also safe for stale cached clean markup.
    legacyRail?.remove();
    abilityDocks?.querySelectorAll(':scope > .abs-clean-header-badges-label')
        .forEach(label => label.remove());
    return passiveName;
};

// Keep both passive utility pieces as direct children at the top of the actual
// Passive Skill box after every clean-mode layout pass. Several renderers update
// Forms, Partners, or Stats independently, so one shared placement guard keeps
// the top row out of the title header, art column, and obsolete rail.
window.syncAbsCleanAbilityDockPlacement = function() {
    const abilityDocks = document.getElementById('abs-clean-ability-docks');
    const passiveSummary = document.getElementById('abs-passive-summary');
    const mainCol = document.querySelector('#layout-abs-style .abs-main-col');
    const passiveBox = document.getElementById('abs-passive-skill-box');
    if (!document.body?.classList.contains('theme-abs-clean')) {
        const home = window.__absCleanAbilityDocksHome;
        if (abilityDocks && home?.parent?.isConnected && abilityDocks.parentElement !== home.parent && !abilityDocks.contains(home.parent)) {
            const anchor = home.next &&
                home.next !== abilityDocks &&
                home.next.parentElement === home.parent &&
                !abilityDocks.contains(home.next)
                ? home.next
                : null;
            try { home.parent.insertBefore(abilityDocks, anchor); }
            catch (error) { try { home.parent.appendChild(abilityDocks); } catch (fallbackError) {} }
        }
        const summaryHome = window.__absCleanPassiveSummaryHome || {
            parent: passiveBox,
            next: passiveBox?.querySelector(':scope > #abs-passive-name')
        };
        if (passiveSummary && summaryHome?.parent?.isConnected &&
            passiveSummary.parentElement !== summaryHome.parent &&
            summaryHome.parent !== passiveSummary &&
            !passiveSummary.contains(summaryHome.parent)) {
            const anchor = summaryHome.next &&
                summaryHome.next !== passiveSummary &&
                summaryHome.next.parentElement === summaryHome.parent &&
                !passiveSummary.contains(summaryHome.next)
                ? summaryHome.next
                : null;
            try { summaryHome.parent.insertBefore(passiveSummary, anchor); }
            catch (error) { try { summaryHome.parent.appendChild(passiveSummary); } catch (fallbackError) {} }
        }
        if (passiveSummary) {
            passiveSummary.innerHTML = '';
            passiveSummary.hidden = true;
        }
        const timeline = document.getElementById('abs-clean-bottom-timeline');
        if (timeline) {
            timeline.hidden = true;
        }
        document.getElementById('abs-clean-header-badges-rail')?.remove();
        abilityDocks?.classList.remove('abs-clean-ability-docks-under-passive');
        window.syncAbsCleanStatsAndArtPlacement?.();
        return;
    }

    const timeline = document.getElementById('abs-clean-bottom-timeline');
    if (timeline) {
        timeline.hidden = false;
    }

    const passiveUtilityHost = window.ensureAbsCleanHeaderBadgeRail?.();

    // Clear inline geometry left by the short-lived nested-badge experiment if
    // the page was updated without a full reload. The stable clean contract is
    // the actual Passive Skill box with a top utility row, not a second grid
    // template or a rail nested inside the title header.
    if (mainCol?.dataset.absCleanPassiveUtilityInline === 'true') {
        ['grid-template-columns', 'grid-template-areas', 'justify-content', 'column-gap', 'row-gap']
            .forEach(prop => mainCol.style.removeProperty(prop));
        delete mainCol.dataset.absCleanPassiveUtilityInline;
    }
    if (passiveBox?.dataset.absCleanPassiveUtilityInline === 'true') {
        ['grid-area', 'grid-column', 'grid-row'].forEach(prop => passiveBox.style.removeProperty(prop));
        delete passiveBox.dataset.absCleanPassiveUtilityInline;
    }
    const utilityColumn = document.getElementById('abs-clean-category-links-column');
    if (utilityColumn?.dataset.absCleanPassiveUtilityInline === 'true') {
        ['grid-area', 'grid-column', 'grid-row', 'justify-self', 'width', 'min-width', 'max-width']
            .forEach(prop => utilityColumn.style.removeProperty(prop));
        delete utilityColumn.dataset.absCleanPassiveUtilityInline;
    }

    // Stats keeps its own explicit position below the art, even while the
    // badge rail is being created or refreshed.
    window.syncAbsCleanStatsAndArtPlacement?.();

    // The clean theme owns the actual Passive Skill box. The placement helper
    // moves both live nodes into its top row and keeps their render/editor state.
    if (passiveUtilityHost) {
        abilityDocks?.classList.remove('abs-clean-ability-docks-under-art');
        abilityDocks?.classList.remove('abs-clean-ability-docks-under-passive');
        passiveSummary?.classList.remove('abs-clean-passive-summary-under-passive');
    }
};

// abs.clean promotes the existing Awakening and Transformation render targets
// into one panel under the card-art rail. The source boxes stay in their native
// side-column homes, so switching away from abs.clean restores every other
// theme without recreating or duplicating any card data.
window.syncAbsCleanAwakeningFormsPlacement = function() {
    const mainCol = document.querySelector('#layout-abs-style .abs-main-col');
    const sideCol = document.querySelector('#layout-abs-style .abs-side-col');
    const headerLeft = document.querySelector('#layout-abs-style .abs-header-left');
    const categoryContainer = document.getElementById('abs-category-container');
    const categoryBox = categoryContainer?.closest('.abs-box') || null;
    const awakeningContainer = document.getElementById('abs-awakenings-container');
    const transformationsContainer = document.getElementById('abs-transformations-container');
    const headerAwakeningPortraits = document.getElementById('abs-clean-awakening-portraits');
    if (!mainCol || !categoryBox || (!awakeningContainer && !transformationsContainer)) return;

    const isClean = document.body.classList.contains('theme-abs-clean');
    const awakeningsBox = document.getElementById('abs-awakenings-box');
    const transformationsBox = document.getElementById('abs-transformations-box');
    const oldSplitRow = document.getElementById('abs-clean-category-awakenings-row');
    const categoryLinksColumn = document.getElementById('abs-clean-category-links-column');

    if (!window.__absCleanAwakeningFormsHome) window.__absCleanAwakeningFormsHome = {};
    const home = window.__absCleanAwakeningFormsHome;
    const rememberHome = (key, node, nativeParent = null) => {
        if (!node) return;
        // A previous helper revision could have recorded the node itself (or
        // one of its descendants) as the parent. Discard that unsafe record
        // so a hot reload can repair the in-memory home without a page reset.
        // When the native source box is known, it is the only valid home for
        // that live content container.
        const savedParent = home[key]?.parent;
        const savedParentIsSafe = savedParent &&
            savedParent !== node &&
            !node.contains(savedParent) &&
            (!nativeParent || savedParent === nativeParent);
        if (savedParentIsSafe) return;
        if (home[key]) delete home[key];
        const parent = nativeParent || node.parentElement;
        if (!parent || parent === node || node.contains(parent)) return;
        home[key] = { parent, next: parent === node.parentElement ? node.nextElementSibling : null };
    };

    // Always remember the original source-box parents. This also repairs a
    // page that still has the previous clean-only split row in the DOM.
    // The live containers are themselves `.abs-content` elements. Their
    // native restore parents are the surrounding source boxes, not a query
    // for a descendant `.abs-content` node.
    rememberHome('awakening', awakeningContainer, awakeningsBox);
    rememberHome('forms', transformationsContainer, transformationsBox);
    // The SSR/TUR portrait rail starts in the shared header, but abs.clean
    // owns it in the Awakening surface. Remember that real header home before
    // moving it so theme switches never try to insert a node into its former
    // descendant (the source of the old HierarchyRequestError).
    rememberHome('awakeningPortraits', headerAwakeningPortraits, headerLeft);
    if (headerAwakeningPortraits && !Object.prototype.hasOwnProperty.call(home, 'awakeningPortraitsInitiallyHidden')) {
        home.awakeningPortraitsInitiallyHidden = headerAwakeningPortraits.hidden;
    }
    if (!isClean && categoryBox.parentElement !== oldSplitRow) rememberHome('categories', categoryBox);

    const restoreHome = (node, record, fallbackParent, fallbackAnchor = null) => {
        if (!node) return;
        const parent = record?.parent;
        if (parent?.isConnected && parent !== node && !node.contains(parent)) {
            const anchor = record.next &&
                record.next !== node &&
                record.next.parentElement === parent &&
                !node.contains(record.next)
                ? record.next
                : null;
            parent.insertBefore(node, anchor);
            return;
        }
        if (fallbackParent?.isConnected && fallbackParent !== node && !node.contains(fallbackParent)) {
            const anchor = fallbackAnchor &&
                fallbackAnchor !== node &&
                fallbackAnchor.parentElement === fallbackParent &&
                !node.contains(fallbackAnchor)
                ? fallbackAnchor
                : null;
            fallbackParent.insertBefore(node, anchor);
        }
    };

    let panel = document.getElementById('abs-clean-awakening-forms-box');

    if (!isClean) {
        // Links/Categories may have been wrapped by the clean-only utility
        // column. Unwrap that column before restoring the native theme homes.
        window.restoreAbsCleanCategoryLinksColumn?.();
        const splitCategoryBox = oldSplitRow?.querySelector?.('.abs-clean-category-box, .abs-box:has(#abs-category-container)') || categoryBox;
        restoreHome(awakeningContainer, home.awakening, awakeningsBox);
        restoreHome(transformationsContainer, home.forms, transformationsBox);
        restoreHome(headerAwakeningPortraits, home.awakeningPortraits, headerLeft);
        if (awakeningsBox) {
            awakeningsBox.style.display = '';
            awakeningsBox.classList.remove('d-none');
            awakeningsBox.hidden = false;
        }
        if (headerAwakeningPortraits) {
            headerAwakeningPortraits.classList.remove('abs-clean-awakening-box-portraits');
            headerAwakeningPortraits.hidden = home.awakeningPortraitsInitiallyHidden !== false;
        }
        awakeningContainer?.classList.remove('abs-clean-legacy-awakening-source');
        if (splitCategoryBox?.parentElement === oldSplitRow) {
            restoreHome(splitCategoryBox, home.categories, mainCol, oldSplitRow);
        }
        panel?.remove?.();
        oldSplitRow?.remove?.();
        categoryBox.classList.remove('abs-clean-category-box');
        return;
    }

    if (!panel) {
        panel = document.createElement('section');
        panel.id = 'abs-clean-awakening-forms-box';
    }

    // Replace any older combined-panel markup once.  The live awakening/forms
    // containers are held by local references above, so rebuilding this shell
    // cannot duplicate data or leave the legacy abs.style panel visible.
    const cleanFormsLayoutVersion = 'circles-v3';
    const needsCleanFormsShell = panel.dataset.absCleanFormsLayout !== cleanFormsLayoutVersion
        || !panel.querySelector('#abs-clean-awakening-forms-awakenings-slot')
        || !panel.querySelector('#abs-clean-awakening-forms-forms-slot')
        || !panel.querySelector('.abs-clean-awakening-forms-section-container');
    if (needsCleanFormsShell) {
        panel.className = 'abs-clean-awakening-forms-box';
        panel.dataset.absCleanFormsLayout = cleanFormsLayoutVersion;
        panel.innerHTML = `
            <div class="abs-clean-awakening-forms-content">
                <section class="abs-clean-awakening-forms-section" data-abs-clean-section="awakenings">
                    <div class="abs-clean-awakening-forms-section-title">Awakenings</div>
                    <div class="abs-clean-awakening-forms-section-container">
                        <div id="abs-clean-awakening-forms-awakenings-slot"></div>
                    </div>
                </section>
                <section class="abs-clean-awakening-forms-section" data-abs-clean-section="forms" data-edit="forms">
                    <div class="abs-clean-awakening-forms-section-title">Forms</div>
                    <div class="abs-clean-awakening-forms-section-container">
                        <div id="abs-clean-awakening-forms-forms-slot"></div>
                    </div>
                </section>
                <p class="abs-clean-awakening-forms-empty">No awakening path or alternate forms.</p>
            </div>
        `;
    }

    const awakeningSlot = panel.querySelector('#abs-clean-awakening-forms-awakenings-slot');
    const formsSlot = panel.querySelector('#abs-clean-awakening-forms-forms-slot');
    const emptyState = panel.querySelector('.abs-clean-awakening-forms-empty');

    // Put the combined panel immediately below the complete layered art.
    // In the editor the dock overlays the fixed portrait stage; in card view
    // the dock is the art surface itself. If the dock is temporarily nested
    // during an animation preview, fall back to the direct stage anchor.
    const portraitStage = sideCol?.querySelector('#abs-clean-portrait-stage');
    const artDock = sideCol?.querySelector('#abs-art-dock-wrapper');
    const artAnchor = artDock?.parentElement === sideCol ? artDock : portraitStage;
    if (sideCol) {
        const directArtAnchor = artAnchor?.parentElement === sideCol ? artAnchor : null;
        if (panel.parentElement !== sideCol) {
            if (directArtAnchor) directArtAnchor.insertAdjacentElement('afterend', panel);
            else sideCol.appendChild(panel);
        } else if (directArtAnchor && panel !== directArtAnchor.nextElementSibling) {
            directArtAnchor.insertAdjacentElement('afterend', panel);
        }
    } else if (panel.parentElement !== mainCol) {
        mainCol.appendChild(panel);
    }

    // The Forms/Awakenings panel is inserted after the art anchor on every
    // clean-layout pass. Keep the passive ability badges in their one stable
    // home as well: the dedicated top row of the Passive Skill box. Without
    // this second authoritative sync, a later Forms pass can move the live
    // node back to an obsolete art-side rail.
    if (isClean) window.syncAbsCleanAbilityDockPlacement?.();

    // Categories is a direct main-grid sibling of Passive, using the narrow
    // second track. The old lower split row is removed after both live nodes leave.
    const passiveBox = document.getElementById('abs-passive-skill-box');
    categoryBox.classList.add('abs-clean-category-box');
    const categoryIsInUtilityColumn = categoryBox.parentElement === categoryLinksColumn ||
        categoryBox.closest('#abs-clean-category-links-column') === categoryLinksColumn;
    if (passiveBox?.parentElement === mainCol && !categoryIsInUtilityColumn) {
        if (categoryBox.parentElement !== mainCol) passiveBox.insertAdjacentElement('afterend', categoryBox);
        else if (passiveBox.nextElementSibling !== categoryBox) passiveBox.insertAdjacentElement('afterend', categoryBox);
    } else if (!categoryIsInUtilityColumn && categoryBox.parentElement !== mainCol) {
        mainCol.appendChild(categoryBox);
    }

    if (awakeningContainer && awakeningSlot && awakeningContainer.parentElement !== awakeningSlot && !awakeningContainer.contains(awakeningSlot)) {
        awakeningSlot.appendChild(awakeningContainer);
    }
    if (transformationsContainer && formsSlot && transformationsContainer.parentElement !== formsSlot && !transformationsContainer.contains(formsSlot)) {
        formsSlot.appendChild(transformationsContainer);
    }

    if (transformationsContainer) {
        transformationsContainer.querySelectorAll('.abs-transform-row').forEach(row => {
            if (isClean) {
                if (!row.hasAttribute('data-tooltip')) {
                    const nameEl = row.querySelector('.abs-transform-name');
                    const text = nameEl?.textContent?.trim() || '';
                    if (text) row.setAttribute('data-tooltip', text);
                }
            } else {
                row.removeAttribute('data-tooltip');
            }
        });
    }

    // Replace the tall legacy Awakening rows with the compact SSR/TUR art that
    // was previously floating in the header. The legacy renderer remains in
    // the DOM as a fallback for cards that have no usable progression art,
    // but it cannot compete with the clean portrait surface when art exists.
    let headerPortraitsVisible = false;
    if (headerAwakeningPortraits && awakeningSlot) {
        headerAwakeningPortraits.classList.add('abs-clean-awakening-box-portraits');
        headerPortraitsVisible = Boolean(headerAwakeningPortraits.querySelector('.abs-clean-awakening-portrait:not([hidden])'));
        headerAwakeningPortraits.hidden = !headerPortraitsVisible;
        if (headerAwakeningPortraits.parentElement !== awakeningSlot && !headerAwakeningPortraits.contains(awakeningSlot)) {
            awakeningSlot.prepend(headerAwakeningPortraits);
        }
    }
    if (awakeningContainer) {
        awakeningContainer.classList.toggle('abs-clean-legacy-awakening-source', headerPortraitsVisible);
    }

    if (oldSplitRow && !oldSplitRow.contains(panel) && !oldSplitRow.contains(categoryBox)) oldSplitRow.remove();

    const legacyAwakeningsVisible = Boolean(awakeningContainer?.children.length) &&
        !awakeningsBox?.hidden &&
        awakeningsBox?.style.display !== 'none' &&
        !awakeningsBox?.classList.contains('d-none');
    const awakeningsVisible = headerPortraitsVisible || (legacyAwakeningsVisible && !awakeningContainer?.classList.contains('abs-clean-legacy-awakening-source'));
    // The native Forms host is intentionally hidden in abs.clean after its
    // live content is moved into the dedicated Forms section. Its old
    // d-none/display state must therefore never decide whether the moved
    // content is visible.
    // Keep the dedicated Forms surface present in clean mode even before the
    // first form is added. The moved container, rather than the hidden native
    // host or its current child count, is the source of truth here.
    const formsVisible = Boolean(transformationsContainer);

    const setSectionVisibility = (slot, visible) => {
        const section = slot?.closest('.abs-clean-awakening-forms-section');
        if (section) section.hidden = !visible;
        else if (slot?.parentElement) slot.parentElement.hidden = !visible;
    };
    setSectionVisibility(awakeningSlot, awakeningsVisible);
    setSectionVisibility(formsSlot, formsVisible);
    if (emptyState) emptyState.hidden = awakeningsVisible || formsVisible;
    panel.classList.toggle('has-awakenings', awakeningsVisible);
    panel.classList.toggle('has-forms', formsVisible);
};

// abs.clean gives Active and Domain a real wrapper in the live DOM. This
// prevents either container from ever becoming a descendant of the
// Categories box while leaving the native theme structure untouched.
window.syncAbsCleanRightRail = function() {
    const mainCol = document.querySelector('#layout-abs-style .abs-main-col');
    const ids = ['abs-active-container', 'abs-standby-container', 'abs-finish-container', 'abs-field-container'];
    const found = ids.map(id => document.getElementById(id)).filter(Boolean);
    if (!mainCol || !found.length) return;

    const cleanInlineProps = [
        'display', 'flex-direction', 'align-items', 'align-self', 'gap', 'column-gap', 'row-gap', 'grid-template-columns',
        'grid-column', 'grid-row', 'position', 'top', 'left', 'width', 'min-width', 'height', 'margin', 'padding'
    ];
    const clearCleanInlineLayout = (node) => {
        if (!node?.dataset?.absCleanInlineLayout) return;
        cleanInlineProps.forEach(prop => node.style.removeProperty(prop));
        delete node.dataset.absCleanInlineLayout;
    };
    const setCleanInlineLayout = (node, prop, value) => {
        if (!node?.style) return;
        node.style.setProperty(prop, value, 'important');
        node.dataset.absCleanInlineLayout = 'true';
    };

    const activeContainer = document.getElementById('abs-active-container');
    const standbyContainer = document.getElementById('abs-standby-container');
    const fieldContainer = document.getElementById('abs-field-container');
    const ordered = found.slice().sort((a, b) => {
        const pos = a.compareDocumentPosition(b);
        if (pos & 4) return -1;
        if (pos & 2) return 1;
        return 0;
    });

    if (!window.__absCleanRailHome) {
        window.__absCleanRailHome = {
            parent: mainCol,
            nodes: ordered.slice(),
            anchor: ordered[ordered.length - 1].nextElementSibling
        };
    }

    const home = window.__absCleanRailHome;
    const isClean = document.body.classList.contains('theme-abs-clean');
    const isNarrow = Boolean(window.matchMedia?.('(max-width: 680px)')?.matches);
    const categoryBox = document.getElementById('abs-category-container')?.closest('.abs-box') ||
        Array.from(mainCol.children).find(child => child.querySelector?.('#abs-category-container')) || null;
    let rail = document.getElementById('abs-clean-right-rail');
    let pairRow = document.getElementById('abs-clean-active-domain-row');
    const categoryAwakeningsRow = document.getElementById('abs-clean-category-awakenings-row');
    const categoryIsInAwakeningsRow = categoryBox?.parentElement === categoryAwakeningsRow;
    const categoryLinksColumn = document.getElementById('abs-clean-category-links-column');
    const categoryIsInUtilityColumn = categoryBox?.parentElement === categoryLinksColumn;

    if (!isClean) {
        mainCol.classList.remove('abs-clean-has-active-domain');
        mainCol.classList.remove('abs-clean-has-standby');
        categoryBox?.classList.remove('abs-clean-category-box');
        [activeContainer, fieldContainer, standbyContainer, pairRow].forEach(clearCleanInlineLayout);

        // Unwrap the clean-only row so the other themes receive their native
        // direct-child containers and cannot inherit clean layout structure.
        const restoreAnchor = home?.parent && home.anchor?.parentElement === home.parent
            ? home.anchor
            : null;
        [activeContainer, fieldContainer, standbyContainer].filter(Boolean).forEach(node => {
            if (home?.parent && node.parentElement !== home.parent) home.parent.insertBefore(node, restoreAnchor);
        });
        pairRow?.remove?.();

        if (home?.parent) {
            home.nodes.forEach(node => {
                if (node.parentElement !== home.parent) home.parent.insertBefore(node, restoreAnchor);
            });
        }
        if (rail?.parentElement) rail.parentElement.removeChild(rail);
        return;
    }

    const passiveBox = document.getElementById('abs-passive-skill-box');
    categoryBox?.classList.add('abs-clean-category-box');
    const fallbackAnchor = Array.from(mainCol.children).find(child =>
        child !== activeContainer &&
        child !== fieldContainer &&
        child !== standbyContainer &&
        child !== categoryBox &&
        child !== categoryAwakeningsRow &&
        child.id === 'abs-partners-box'
    ) || null;

    if (!pairRow) {
        pairRow = document.createElement('div');
        pairRow.id = 'abs-clean-active-domain-row';
        pairRow.className = 'abs-clean-active-domain-row';
    }
    pairRow.setAttribute('aria-label', 'Active Skills, Dokkan Fields, and Standby Skills');

    // Put the wrapper directly in the main ABS Clean column before moving any
    // content into it. If an older pass nested one of these nodes in
    // Categories, this extracts the wrapper and the containers together.
    if (pairRow.parentElement !== mainCol) {
        const categoryAnchor = categoryBox?.parentElement === mainCol
            ? categoryBox
            : (categoryAwakeningsRow?.parentElement === mainCol ? categoryAwakeningsRow : null);
        const anchor = categoryAnchor ||
            (fallbackAnchor?.parentElement === mainCol ? fallbackAnchor : null);
        if (anchor && anchor !== pairRow) mainCol.insertBefore(pairRow, anchor);
        else mainCol.appendChild(pairRow);
    }

    // Normalize stale renderer output before applying the clean wrapper. Each
    // skill kind has one deterministic home, even if a previous render pass
    // left a box in a different generated container.
    const skillContainers = [activeContainer, fieldContainer, standbyContainer].filter(Boolean);
    const classifySkillNode = (node) => {
        if (node.matches?.('[data-active-kind="domain"], .abs-clean-domain-rendered')) return 'domain';
        if (node.matches?.('[data-active-kind="standby"], .abs-clean-standby-rendered, .abs-standby-rendered')) return 'standby';
        return 'active';
    };
    const skillHomes = {
        active: activeContainer,
        domain: fieldContainer,
        standby: standbyContainer
    };
    skillContainers.forEach(source => {
        Array.from(source.children).forEach(node => {
            const target = skillHomes[classifySkillNode(node)];
            if (target && target !== source) target.appendChild(node);
        });
    });

    skillContainers.forEach(node => {
        if (node.parentElement !== pairRow) pairRow.appendChild(node);
    });
    [activeContainer, fieldContainer, standbyContainer].filter(Boolean).forEach((node, index, nodes) => {
        if (node.parentElement !== pairRow) pairRow.appendChild(node);
        const previous = nodes[index - 1];
        if (previous && previous.nextElementSibling !== node) pairRow.insertBefore(node, previous.nextElementSibling);
    });

    // Categories must never be a parent or child of either ability container.
    // Its own clean-only Categories/Awakening row is the one intentional
    // nested home, and must be preserved during subsequent sync passes.
    if (categoryBox && categoryBox.parentElement !== mainCol &&
        !categoryIsInAwakeningsRow && !categoryIsInUtilityColumn) {
        mainCol.insertBefore(categoryBox, pairRow);
    } else if (categoryBox && categoryBox !== pairRow && pairRow.parentElement === mainCol) {
        const categoryAnchor = categoryIsInAwakeningsRow
            ? categoryAwakeningsRow
            : (categoryIsInUtilityColumn ? categoryLinksColumn : categoryBox);
        if (categoryAnchor?.parentElement === mainCol) mainCol.insertBefore(pairRow, categoryAnchor);
    }

    const railNodes = ordered.filter(node => !skillContainers.includes(node));
    if (railNodes.length) {
        if (!rail) {
            rail = document.createElement('div');
            rail.id = 'abs-clean-right-rail';
            rail.setAttribute('aria-label', 'Skills');
        }
        if (rail.parentElement !== mainCol) {
            if (passiveBox && passiveBox.parentElement === mainCol) passiveBox.insertAdjacentElement('afterend', rail);
            else mainCol.appendChild(rail);
        }
        railNodes.forEach(node => { if (node.parentElement !== rail) rail.appendChild(node); });
    } else if (rail?.parentElement) {
        rail.remove();
    }

    const hasActive = Boolean(activeContainer?.children.length);
    const hasDomain = Boolean(fieldContainer?.children.length);
    const hasStandby = Boolean(standbyContainer?.children.length);
    const hasActiveDomainContent = hasActive || hasDomain || hasStandby;
    const hasTwoColumnSkillRow = hasActive && hasDomain && !hasStandby && !isNarrow;
    pairRow.classList.toggle('has-active', hasActive);
    pairRow.classList.toggle('has-domain', hasDomain);
    pairRow.classList.toggle('has-standby', hasStandby);
    pairRow.classList.toggle('has-both', hasActive && hasDomain);
    pairRow.classList.toggle('has-active-domain-standby', hasActive && hasDomain && hasStandby);
    pairRow.classList.toggle('has-content', hasActiveDomainContent);
    mainCol.classList.toggle('abs-clean-has-active-domain', hasActive && hasDomain);
    mainCol.classList.toggle('abs-clean-has-standby', hasStandby);
    mainCol.classList.toggle('abs-clean-no-active-domain', !hasActiveDomainContent);

    // Inline geometry is a deliberate clean-mode guardrail. It prevents a
    // late-loaded legacy rule from moving Domain to the next grid row between
    // the renderer pass and the final stylesheet pass.
    // Keep the named grid area as a stable insertion anchor, but do not let an
    // empty Active/Domain wrapper reserve a visible row between Super Attack
    // and Passive.  The next render can switch it back to grid as soon as a
    // real Active Skill or Domain is moved into the wrapper.
    setCleanInlineLayout(pairRow, 'display', hasActiveDomainContent ? 'grid' : 'none');
    setCleanInlineLayout(pairRow, 'grid-template-columns', hasTwoColumnSkillRow ? 'minmax(0, 1fr) minmax(0, 1fr)' : 'minmax(0, 1fr)');
    setCleanInlineLayout(pairRow, 'column-gap', '14px');
    setCleanInlineLayout(pairRow, 'row-gap', '14px');
    setCleanInlineLayout(pairRow, 'align-items', 'stretch');
    const populatedSkillContainers = skillContainers.filter(node => node.children.length);
    skillContainers.forEach(node => {
        const isPopulated = node.children.length > 0;
        const populatedIndex = populatedSkillContainers.indexOf(node);
        setCleanInlineLayout(node, 'display', isPopulated ? 'flex' : 'none');
        setCleanInlineLayout(node, 'flex-direction', 'column');
        setCleanInlineLayout(node, 'align-items', 'stretch');
        setCleanInlineLayout(node, 'align-self', 'stretch');
        setCleanInlineLayout(node, 'gap', '14px');
        setCleanInlineLayout(node, 'grid-row', hasTwoColumnSkillRow ? '1' : String(Math.max(1, populatedIndex + 1)));
        setCleanInlineLayout(node, 'grid-column', hasTwoColumnSkillRow && node === fieldContainer ? '2' : '1');
        setCleanInlineLayout(node, 'position', 'relative');
        setCleanInlineLayout(node, 'top', '0');
        setCleanInlineLayout(node, 'left', '0');
        setCleanInlineLayout(node, 'width', '100%');
        setCleanInlineLayout(node, 'min-width', '0');
        setCleanInlineLayout(node, 'height', hasTwoColumnSkillRow ? '100%' : 'auto');
        setCleanInlineLayout(node, 'margin', '0');
        setCleanInlineLayout(node, 'padding', '0');
    });

    if (!window.__absCleanRailResizeBound) {
        window.__absCleanRailResizeBound = true;
        window.addEventListener('resize', () => window.syncAbsCleanRightRail?.(), { passive: true });
    }

    window.syncAbsCleanAbilityDockPlacement?.();
};

// Super Attacks get their own full-width row directly beneath the Leader
// Skill in abs.clean. The original position is restored for every other theme.
window.syncAbsCleanSuperAttackPlacement = function() {
    const mainCol = document.querySelector('#layout-abs-style .abs-main-col');
    const saContainer = document.getElementById('abs-sa-container');
    const passiveBox = document.getElementById('abs-passive-skill-box');
    const activeContainer = document.getElementById('abs-active-container');
    const activeDomainRow = document.getElementById('abs-clean-active-domain-row');
    if (!mainCol || !saContainer) return;

    if (!window.__absCleanSuperAttackHome) {
        window.__absCleanSuperAttackHome = {
            parent: saContainer.parentElement,
            anchor: saContainer.nextElementSibling
        };
    }

    if (!document.body.classList.contains('theme-abs-clean')) {
        const home = window.__absCleanSuperAttackHome;
        if (home?.parent && saContainer.parentElement !== home.parent) {
            const anchor = home.anchor?.parentElement === home.parent ? home.anchor : null;
            home.parent.insertBefore(saContainer, anchor);
        }
        // Native ABS Style order is Passive → Super Attack. Do not depend on
        // an old clean-mode anchor, which may have been recorded mid-move.
        if (passiveBox?.parentElement && passiveBox.parentElement === saContainer.parentElement && passiveBox.nextElementSibling !== saContainer) {
            passiveBox.insertAdjacentElement('afterend', saContainer);
        }
        return;
    }

    const cleanAnchor = activeDomainRow?.parentElement === mainCol
        ? activeDomainRow
        : (activeContainer?.parentElement === mainCol ? activeContainer : passiveBox);
    if (saContainer.parentElement !== mainCol || saContainer.nextElementSibling !== cleanAnchor) {
        mainCol.insertBefore(saContainer, cleanAnchor || mainCol.firstChild);
    }
};
