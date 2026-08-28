/* ============================================================
   1. GLOBAL STATE & MAPS
   ============================================================ */
window.currentClass = window.currentClass || "none"; 
window.currentRarity = window.currentRarity || "none";
window.currentType = window.currentType || "none"; 
window.sIdx = window.sIdx || 0; 
window.lIdx = window.lIdx || 0; 
window.selectedForm = window.selectedForm || null;        
window.currentSuperAttack = window.currentSuperAttack || null;  
window.selectedStat = window.selectedStat || null;
window.selectedListItem = window.selectedListItem || null;
window.currentActiveSkill = window.currentActiveSkill || null;
window.isSwitchingActive = window.isSwitchingActive || false;
window.currentAwakeningMode = window.currentAwakeningMode || 'none';
window.currentPartnerLimit = window.currentPartnerLimit || 10;

var currentClass = window.currentClass;
var currentRarity = window.currentRarity;
var currentType = window.currentType;
var sIdx = window.sIdx;
var lIdx = window.lIdx;
var selectedForm = window.selectedForm;
var currentSuperAttack = window.currentSuperAttack;
var selectedStat = window.selectedStat;
var selectedListItem = window.selectedListItem;
var currentActiveSkill = window.currentActiveSkill;
var isSwitchingActive = window.isSwitchingActive;
var currentAwakeningMode = window.currentAwakeningMode;
var currentPartnerLimit = window.currentPartnerLimit;

// Separate variables for frame and type
var defaultTypeImg = "https://abscustom.github.io/assets/images/type_none.png";
var defaultFrameImg = "https://abscustom.github.io/assets/images/frame_none.png";

window.lightningColors = window.lightningColors || {
    agl: 'rgb(0, 150, 255)', teq: 'rgb(0, 255, 50)', int: 'rgb(210, 0, 255)', 
    str: 'rgb(255, 0, 0)', phy: 'rgb(255, 230, 0)', none: 'rgba(0,0,0,0)'
};
var lightningColors = window.lightningColors;

window.typeImageMap = window.typeImageMap || {
    super: { agl: 'https://abscustom.github.io/assets/images/super_type_agl.png', teq: 'https://abscustom.github.io/assets/images/super_type_teq.png', int: 'https://abscustom.github.io/assets/images/super_type_int.png', str: 'https://abscustom.github.io/assets/images/super_type_str.png', phy: 'https://abscustom.github.io/assets/images/super_type_phy.png', none: defaultTypeImg },
    extreme: { agl: 'https://abscustom.github.io/assets/images/extreme_type_agl.png', teq: 'https://abscustom.github.io/assets/images/extreme_type_teq.png', int: 'https://abscustom.github.io/assets/images/extreme_type_int.png', str: 'https://abscustom.github.io/assets/images/extreme_type_str.png', phy: 'https://abscustom.github.io/assets/images/extreme_type_phy.png', none: defaultTypeImg },
    none: { agl: 'https://abscustom.github.io/assets/images/type_agl.png', teq: 'https://abscustom.github.io/assets/images/type_teq.png', int: 'https://abscustom.github.io/assets/images/type_int.png', str: 'https://abscustom.github.io/assets/images/type_str.png', phy: 'https://abscustom.github.io/assets/images/type_phy.png', none: defaultTypeImg }
};
var typeImageMap = window.typeImageMap;

window.typeImageUrls = window.typeImageUrls || { 'agl': 'https://abscustom.github.io/assets/images/type_agl.png', 'teq': 'https://abscustom.github.io/assets/images/type_teq.png', 'int': 'https://abscustom.github.io/assets/images/type_int.png', 'str': 'https://abscustom.github.io/assets/images/type_str.png', 'phy': 'https://abscustom.github.io/assets/images/type_phy.png', 'none': defaultTypeImg };
var typeImageUrls = window.typeImageUrls;

window.frameMap = window.frameMap || { agl: 'https://abscustom.github.io/assets/images/frame_agl.png', teq: 'https://abscustom.github.io/assets/images/frame_teq.png', int: 'https://abscustom.github.io/assets/images/frame_int.png', str: 'https://abscustom.github.io/assets/images/frame_str.png', phy: 'https://abscustom.github.io/assets/images/frame_phy.png', none: defaultFrameImg };
var frameMap = window.frameMap;

window.rarityStats = window.rarityStats || { LR: { max: 150, sa: 20, cost: 77 }, TUR: { max: 120, sa: 10, cost: 58 }, none: { max: 0, sa: 0, cost: 0 } };
var rarityStats = window.rarityStats;

window.savedInputs = window.savedInputs || [
    "descInput", "nameInput", "dateInput", "ezaDateInput", "sezaDateInput", "leaderInput", "imageInput",
    "input-hp-max", "input-atk-max", "input-def-max", "input-passive-name-sidebar",
    "input-active-type", "input-active-name", "input-active-effect", "input-active-condition-title", "input-active-conditions",
    "formNameInput", "formLinkInput", "input-folder-id"
];
var savedInputs = window.savedInputs;

window.normalizeAssetUrl = function(str) {
    if (!str || typeof str !== 'string') return str || "";
    const repoBase = "https://abscustom.github.io/assets/images/";
    
    // 1. Rewrite explicit images/ and ./images/
    let out = str.replace(/(?:src|href)=["'](?:\.\/)?images\/([^"']+)["']/gi, `src="${repoBase}$1"`);
    
    // 2. Rewrite common bare asset filenames
    out = out.replace(/(?:src|href)=["'](card_category_label_[^"']+\.png)["']/gi, `src="${repoBase}$1"`);
    out = out.replace(/(?:src|href)=["'](sp_skill_icon_[^"']+\.png)["']/gi, `src="${repoBase}$1"`);
    out = out.replace(/(?:src|href)=["'](st_[^"']+\.png)["']/gi, `src="${repoBase}$1"`);
    out = out.replace(/(?:src|href)=["'](pot_skill_[^"']+\.png)["']/gi, `src="${repoBase}$1"`);
    out = out.replace(/(?:src|href)=["'](passive_skill_dialog_[^"']+\.png)["']/gi, `src="${repoBase}$1"`);
    out = out.replace(/(?:src|href)=["'](default\.png|SSR_Icon\.png|TUR_Icon\.png|LR_Icon\.png|frame_none\.png|type_none\.png|rarity_none\.png|superza_abs\.png)["']/gi, `src="${repoBase}$1"`);

    // 3. Direct bare filename strings
    if (!out.includes('<') && !out.includes('http') && !out.includes('data:') && !out.includes('blob:')) {
        if (/^(?:(?:\.\/)?images\/)?(card_category_label_|sp_skill_icon_|st_|pot_skill_|passive_skill_dialog_|SSR_Icon|TUR_Icon|LR_Icon|frame_none|type_none|rarity_none|superza_abs|default|Card Art Template)/i.test(out)) {
            const cleanName = out.replace(/^(?:\.\/)?images\//i, '');
            return `${repoBase}${cleanName}`;
        }
    }

    return out;
};
