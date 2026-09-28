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
// Official imports need a stable identifier so their animated card-background
// LWF can be reattached after a full page reload.  The player itself lives in
// memory and is intentionally recreated on each document load.
window.currentCardSource = window.currentCardSource || 'custom';
window.currentOfficialCardId = window.currentOfficialCardId || '';
window.currentOfficialCardAwakeningMode = window.currentOfficialCardAwakeningMode || '';
window.currentCustomCardAssetBaseUrl = window.currentCustomCardAssetBaseUrl || '';
window.currentCardThemeVariant = window.currentCardThemeVariant || '';
window.currentPartnerLimit = window.currentPartnerLimit || 9;
// Individual progression controls replace the old all-or-nothing switch.
// Keep the old value as a fallback for already-published cards and old backups.
const legacyAwakeningVisibility = window.showAwakeningProgression;
window.showSsrProgression = window.showSsrProgression !== false && legacyAwakeningVisibility !== false;
window.showTurProgression = window.showTurProgression !== false && legacyAwakeningVisibility !== false;
window.showAwakeningProgression = window.showSsrProgression || window.showTurProgression;

// Keep the ABS banner unit tag independent from the initial HTML fallback.
// Published cards set this value in their page marker before the editor scripts
// load, while local cards restore it from the autosave afterwards. A dedicated
// setter means either path updates the visible header immediately instead of a
// later refresh reading the default "DOKKAN FESTIVAL UNIT" markup again.
(() => {
    let absUnitTagValue = window.absUnitTag;

    const renderAbsUnitTag = () => {
        const header = (window.getCardLayoutElement ? window.getCardLayoutElement('abs-art-header-text') : document.getElementById('abs-art-header-text'));
        if (!header || absUnitTagValue === undefined) return;
        header.dataset.unitTag = absUnitTagValue;
        header.textContent = absUnitTagValue;
        header.style.display = absUnitTagValue ? 'block' : 'none';
    };

    Object.defineProperty(window, 'absUnitTag', {
        configurable: true,
        get: () => absUnitTagValue,
        set: (value) => {
            absUnitTagValue = value === undefined || value === null ? value : String(value);
            renderAbsUnitTag();
        }
    });

    window.setAbsUnitTag = (value) => { window.absUnitTag = value; };
    renderAbsUnitTag();
})();

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

// Super Attack and Active Skill blocks are editor data, not part of any card
// presentation. Keep one canonical store outside the three theme roots so a
// native Dokkan Info renderer can never display editor-source markup by
// accident. The migration also repairs older autosaves that placed source
// blocks beside the Dokkan Info insert markers.
window.ensureEditorSkillSourceHost = function() {
    let host = document.getElementById('editor-skill-source-host');
    if (!host && document.body) {
        host = document.createElement('div');
        host.id = 'editor-skill-source-host';
        host.hidden = true;
        host.setAttribute('aria-hidden', 'true');
        host.style.display = 'none';
        document.body.appendChild(host);
    }
    if (!host) return null;

    ['.sa-block', '.active-block'].forEach(selector => {
        Array.from(document.querySelectorAll(selector))
            .filter(block => block !== host && !host.contains(block))
            .filter(block => block.closest('[data-card-layout]'))
            .forEach(block => host.appendChild(block));
    });
    return host;
};
window.getSuperAttackSourceBlocks = function() {
    const host = window.ensureEditorSkillSourceHost?.();
    return Array.from((host || document).querySelectorAll(':scope > .sa-block'));
};
window.getActiveSkillSourceBlocks = function() {
    const host = window.ensureEditorSkillSourceHost?.();
    return Array.from((host || document).querySelectorAll(':scope > .active-block'));
};
window.clearEditorSkillSources = function() {
    window.ensureEditorSkillSourceHost?.()?.replaceChildren();
};
window.ensureEditorSkillSourceHost();

// Resolve custom-card image sources without ever appending arbitrary payload
// text to a URL. Older exports sometimes lost the data: prefix from embedded
// images; restore it only when a known image signature proves the format.
window.resolveImportedAssetUrl = function(source, baseUrl = '', fallbackFolder = '') {
    if (source === undefined || source === null) return '';
    const value = String(source).trim();
    if (!value) return '';
    if (/^(?:data:|blob:|https?:)/i.test(value)) return value;
    if (/^\/\//.test(value)) return `${window.location.protocol}${value}`;

    if (value.length > 512 && /^[A-Za-z0-9+/=\s]+$/.test(value)) {
        const compact = value.replace(/\s+/g, '');
        let mime = '';
        if (compact.startsWith('iVBORw0KGgo')) mime = 'image/png';
        else if (compact.startsWith('/9j/')) mime = 'image/jpeg';
        else if (/^R0lGOD(?:dh|lh)/.test(compact)) mime = 'image/gif';
        else if (compact.startsWith('UklGR')) mime = 'image/webp';
        else if (/^AAAA[A-Za-z0-9+/=]{16,}/.test(compact) && /ZnR5cGF2aWY|ZnR5cGF2aXM/.test(compact.slice(0, 96))) mime = 'image/avif';
        if (mime) return `data:${mime};base64,${compact}`;
        throw new Error('An embedded image is missing its data URL prefix and has an unrecognized image format.');
    }

    const fileName = value.split(/[?#]/)[0].split('/').pop();
    const sharedIcon = /^(?:card_category_label_|sp_skill_icon_|st_|pot_skill_|passive_skill_dialog_|ki_change_).+\.(?:png|webp)$/i.test(fileName);
    if (sharedIcon) return `https://abscustom.github.io/assets/images/${fileName}`;

    const commonAssetNames = new Set([
        'frame_agl.png', 'frame_teq.png', 'frame_int.png', 'frame_str.png', 'frame_phy.png', 'frame_none.png',
        'type_agl.png', 'type_teq.png', 'type_int.png', 'type_str.png', 'type_phy.png', 'type_none.png',
        'super_type_agl.png', 'super_type_teq.png', 'super_type_int.png', 'super_type_str.png', 'super_type_phy.png',
        'extreme_type_agl.png', 'extreme_type_teq.png', 'extreme_type_int.png', 'extreme_type_str.png', 'extreme_type_phy.png',
        'rarity_ssr.png', 'rarity_TUR.png', 'rarity_LR.png', 'rarity_none.png', 'rarity_ssr_abs.png', 'rarity_TUR_abs.png', 'rarity_lr_abs.png',
        'eza_abs.png', 'superza_abs.png', 'eza_img.png', 'supereza_img.png', 'z-awaken.png', 'dokkan-awaken.png',
        'lr_spin_dial.png', 'lightningfx.webm', 'SSR_Icon.png', 'TUR_Icon.png', 'LR_Icon.png', 'default.png',
        'abs.custom.png', 'abs.style.png', 'dokkan-info-logo.png'
    ]);
    if (commonAssetNames.has(fileName)) return `https://abscustom.github.io/assets/images/${fileName}`;

    const base = baseUrl || fallbackFolder;
    if (!base) return value;
    try {
        const absoluteBase = new URL(base, window.location.href);
        if (!absoluteBase.pathname.endsWith('/')) {
            const finalSegment = absoluteBase.pathname.slice(absoluteBase.pathname.lastIndexOf('/') + 1);
            if (/\.[a-z0-9]{1,8}$/i.test(finalSegment)) {
                absoluteBase.pathname = absoluteBase.pathname.slice(0, absoluteBase.pathname.lastIndexOf('/') + 1);
            } else {
                absoluteBase.pathname += '/';
            }
        }
        return new URL(value, absoluteBase).href;
    } catch (error) {
        throw new Error(`Could not resolve imported image path "${value}": ${error.message}`);
    }
};

window.rewriteImportedAssetUrls = function(markup, baseUrl = '', fallbackFolder = '') {
    if (typeof markup !== 'string' || !markup.includes('<')) return markup || '';
    const template = document.createElement('template');
    template.innerHTML = markup;
    template.content.querySelectorAll('[src], [poster]').forEach(element => {
        ['src', 'poster'].forEach(attribute => {
            const current = element.getAttribute(attribute);
            if (!current) return;
            const resolved = window.resolveImportedAssetUrl(current, baseUrl, fallbackFolder);
            if (resolved !== current) element.setAttribute(attribute, resolved);
        });
    });
    return template.innerHTML;
};

window.normalizeAssetUrl = function(str) {
    if (!str || typeof str !== 'string') return str || "";
    const repoBase = "https://abscustom.github.io/assets/images/";
    const sharedIconPattern = /^(?:card_category_label_|sp_skill_icon_|st_|pot_skill_|passive_skill_dialog_|ki_change_).+\.(?:png|webp)$/i;
    
    // Leave card-relative images/ paths untouched. Custom card markup is
    // resolved against its own folder by rewriteImportedAssetUrls; treating
    // every local image as a shared asset caused real 404s for card artwork.
    let out = str;
    
    // 2. Rewrite common bare asset filenames
    out = out.replace(/(?:src|href)=["'](card_category_label_[^"']+\.png)["']/gi, `src="${repoBase}$1"`);
    out = out.replace(/(?:src|href)=["'](sp_skill_icon_[^"']+\.png)["']/gi, `src="${repoBase}$1"`);
    out = out.replace(/(?:src|href)=["'](st_[^"']+\.png)["']/gi, `src="${repoBase}$1"`);
    out = out.replace(/(?:src|href)=["'](pot_skill_[^"']+\.png)["']/gi, `src="${repoBase}$1"`);
    out = out.replace(/(?:src|href)=["'](passive_skill_dialog_[^"']+\.png)["']/gi, `src="${repoBase}$1"`);
    out = out.replace(/(?:src|href)=["'](default\.png|SSR_Icon\.png|TUR_Icon\.png|LR_Icon\.png|frame_none\.png|type_none\.png|rarity_none\.png|superza_abs\.png)["']/gi, `src="${repoBase}$1"`);

    // Repair old editor URLs such as DokkanCustom/CardEditor/images/st_0011.png.
    // These interface icons are shared repository assets, not card-local files.
    out = out.replace(/(src|href)=["']([^"']+)["']/gi, (match, attribute, url) => {
        const fileName = String(url).split(/[?#]/)[0].split('/').pop();
        return sharedIconPattern.test(fileName)
            ? `${attribute}="${repoBase}${fileName}"`
            : match;
    });

    // 3. Direct bare filename strings
    if (!out.includes('<') && !out.includes('data:') && !out.includes('blob:')) {
        const directFileName = out.split(/[?#]/)[0].split('/').pop();
        if (sharedIconPattern.test(directFileName)) return `${repoBase}${directFileName}`;
        if (!out.includes('http') && /^(?:(?:\.\/)?images\/)?(card_category_label_|sp_skill_icon_|st_|pot_skill_|passive_skill_dialog_|SSR_Icon|TUR_Icon|LR_Icon|frame_none|type_none|rarity_none|superza_abs|default|Card Art Template)/i.test(out)) {
            const cleanName = out.replace(/^(?:\.\/)?images\//i, '');
            return `${repoBase}${cleanName}`;
        }
    }

    return out;
};

window.repairLegacySharedAssetImage = function(image) {
    if (!(image instanceof HTMLImageElement)) return false;
    const currentSrc = image.getAttribute('src') || '';
    const fileName = currentSrc.split(/[?#]/)[0].split('/').pop();
    const isSharedIcon = /^(?:card_category_label_|sp_skill_icon_|st_|pot_skill_|passive_skill_dialog_|ki_change_).+\.(?:png|webp)$/i.test(fileName);
    if (!isSharedIcon) return false;

    const correctSrc = `https://abscustom.github.io/assets/images/${fileName}`;
    if (currentSrc === correctSrc) return false;
    image.removeAttribute('data-failed');
    image.src = correctSrc;
    return true;
};

// Repair saved/imported markup that still contains the old CardEditor/images path,
// including elements inserted later by the editor GUI.
document.querySelectorAll('img[src]').forEach(window.repairLegacySharedAssetImage);
document.addEventListener('error', event => {
    window.repairLegacySharedAssetImage(event.target);
}, true);
