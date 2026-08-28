/* ==========================================================================
   absCustom - Dokkan Stat Calculator: Global State & Utilities
   ========================================================================== */

const CALC_ASSET_URL = 'https://abscustom.github.io/assets/images/';

let activeCharacterLinks = [];
let cardParsedStats = JSON.parse(JSON.stringify(DEFAULT_CARD_STATS));
let currentHipoPreset = '100';

window.currentCalcTab = 'atk';
window.currentCalcMode = 'simple';
window.currentPassiveViewMode = 'full';
window.parsedSaBlocksCount = 1;
window.currentCalcRarity = 'LR';
window.currentCalcEza = false;
window.lastParsedSaBlocksData = null;
window.parsedConditionals = [];
window.interactivePassiveLines = [];
window.passiveHasHpScaling = false;
window.currentHpPercent = 100;
window.exToggleState = {};

// Helper to inject inline Dokkan Images sourced from absCustom assets
function parseDokkanIcons(text) {
    if (!text) return '';
    return text
        .replace(/:up:/g, `<img src="${CALC_ASSET_URL}passive_skill_dialog_arrow01.png" onerror="this.onerror=null;this.src='assets/images/passive_skill_dialog_arrow01.png';" class="dokkan-icon" alt="up">`)
        .replace(/:down:/g, `<img src="${CALC_ASSET_URL}passive_skill_dialog_arrow02.png" onerror="this.onerror=null;this.src='assets/images/passive_skill_dialog_arrow02.png';" class="dokkan-icon" alt="down">`)
        .replace(/:ydown:/g, `<img src="${CALC_ASSET_URL}passive_skill_dialog_arrow03.png" onerror="this.onerror=null;this.src='assets/images/passive_skill_dialog_arrow03.png';" class="dokkan-icon" alt="ydown">`)
        .replace(/:once:/g, `<img src="${CALC_ASSET_URL}passive_skill_dialog_icon_01.png" onerror="this.onerror=null;this.src='assets/images/passive_skill_dialog_icon_01.png';" class="dokkan-icon" alt="once">`)
        .replace(/:inf:/g, `<img src="${CALC_ASSET_URL}passive_skill_dialog_icon_02.png" onerror="this.onerror=null;this.src='assets/images/passive_skill_dialog_icon_02.png';" class="dokkan-icon" alt="inf">`)
        .replace(/:atk_down:/g, `<img src="${CALC_ASSET_URL}st_0011.png" onerror="this.onerror=null;this.src='assets/images/st_0011.png';" class="dokkan-icon" alt="atk_down">`)
        .replace(/:def_down:/g, `<img src="${CALC_ASSET_URL}st_0012.png" onerror="this.onerror=null;this.src='assets/images/st_0012.png';" class="dokkan-icon" alt="def_down">`)
        .replace(/:stun:/g, `<img src="${CALC_ASSET_URL}st_0100.png" onerror="this.onerror=null;this.src='assets/images/st_0100.png';" class="dokkan-icon" alt="stun">`)
        .replace(/:seal:/g, `<img src="${CALC_ASSET_URL}st_0102.png" onerror="this.onerror=null;this.src='assets/images/st_0102.png';" class="dokkan-icon" alt="seal">`)
        .replace(/:break:/g, `<img src="${CALC_ASSET_URL}st_1009.png" onerror="this.onerror=null;this.src='assets/images/st_1009.png';" class="dokkan-icon" alt="break">`);
}

// Convert HTML image tags to inline shortcodes for cleaner text processing
function convertImgTagsToShortcodes(html) {
    if (!html) return '';
    return html
        .replace(/<img[^>]*passive_skill_dialog_arrow01[^>]*>/gi, ' :up:')
        .replace(/<img[^>]*passive_skill_dialog_arrow02[^>]*>/gi, ' :down:')
        .replace(/<img[^>]*passive_skill_dialog_arrow03[^>]*>/gi, ' :ydown:')
        .replace(/<img[^>]*passive_skill_dialog_icon_01[^>]*>/gi, ' :once:')
        .replace(/<img[^>]*passive_skill_dialog_icon_02[^>]*>/gi, ' :inf:')
        .replace(/<img[^>]*up\.png[^>]*>/gi, ' :up:')
        .replace(/<img[^>]*down\.png[^>]*>/gi, ' :down:')
        .replace(/<img[^>]*ydown\.png[^>]*>/gi, ' :ydown:')
        .replace(/<img[^>]*once\.png[^>]*>/gi, ' :once:')
        .replace(/<img[^>]*inf\.png[^>]*>/gi, ' :inf:')
        .replace(/<img[^>]*st_0011[^>]*>/gi, ' :atk_down:')
        .replace(/<img[^>]*st_0012[^>]*>/gi, ' :def_down:')
        .replace(/<img[^>]*st_0100[^>]*>/gi, ' :stun:')
        .replace(/<img[^>]*st_0102[^>]*>/gi, ' :seal:')
        .replace(/<img[^>]*st_1009[^>]*>/gi, ' :break:');
}

// UI Accordion Toggle Utility
function toggleAccordion(id) {
    const el = document.getElementById(id);
    const icon = document.getElementById(`${id}-icon`);
    if (!el) return;
    if (el.style.display === 'none' || !el.style.display) {
        el.style.display = 'block';
        if (icon) icon.innerText = '▼';
    } else {
        el.style.display = 'none';
        if (icon) icon.innerText = '▶';
    }
}