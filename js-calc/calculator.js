/*==========================================================================
   absCustom - Dokkan Stat Calculator Engine
   ========================================================================== */

const DOKKAN_LINKS_LV10 = {
    "fierce battle": { atk: 20, def: 0 },
    "super saiyan": { atk: 15, def: 0 },
    "prepared for battle": { atk: 5, def: 5 },
    "big bad bosses": { atk: 25, def: 25 },
    "over 9000": { atk: 15, def: 15 },
    "shocking speed": { atk: 0, def: 7 },
    "cold judgment": { atk: 0, def: 25 },
    "all in the family": { atk: 0, def: 20 },
    "prodigies": { atk: 15, def: 0 },
    "saiyan pride": { atk: 20, def: 0 },
    "berserker": { atk: 30, def: 0 },
    "saiyan warrior race": { atk: 10, def: 0 },
    "the saiyan lineage": { atk: 5, def: 5 },
    "royal lineage": { atk: 5, def: 0 },
    "thirst for conquest": { atk: 15, def: 15 },
    "infighter": { atk: 15, def: 0 },
    "master and student": { atk: 0, def: 20 },
    "hero of justice": { atk: 25, def: 0 },
    "tournament of power": { atk: 7, def: 7 },
    "warriors of universe 6": { atk: 10, def: 10 },
    "the first awakened": { atk: 25, def: 10 },
    "limit-breaking form": { atk: 10, def: 0 },
    "saiyan roar": { atk: 25, def: 10 },
    "dismal future": { atk: 0, def: 5 },
    "formidable enemy": { atk: 15, def: 0 },
    "fused fighter": { atk: 5, def: 5 },
    "fusion": { atk: 10, def: 10 },
    "nightmare": { atk: 15, def: 0 },
    "godly power": { atk: 15, def: 5 },
    "warrior gods": { atk: 15, def: 0 },
    "super-god combat": { atk: 15, def: 0 },
    "power bestowed by god": { atk: 10, def: 10 },
    "majin": { atk: 15, def: 15 },
    "metamorphosis": { atk: 10, def: 10 },
    "android assault": { atk: 0, def: 20 },
    "gt": { atk: 10, def: 10 },
    "courage": { atk: 10, def: 0 },
    "messenger from the future": { atk: 15, def: 0 },
    "z fighters": { atk: 20, def: 0 },
    "turtle school": { atk: 20, def: 20 },
    "crane school": { atk: 15, def: 0 },
    "the innocents": { atk: 15, def: 0 },
    "brains and brawn": { atk: 10, def: 10 },
    "solid support": { atk: 10, def: 10 },
    "more than meets the eye": { atk: 10, def: 10 },
    "guidance of the dragon balls": { atk: 20, def: 0 },
    "the incredible adventure": { atk: 7, def: 7 },
    "world tournament reborn": { atk: 15, def: 15 },
    "champion's belt": { atk: 15, def: 15 },
    "supreme power": { atk: 10, def: 10 },
    "soul vs soul": { atk: 5, def: 5 },
    "golden z-fighter": { atk: 10, def: 10 },
    "hero": { atk: 20, def: 0 },
    "evil autocrats": { atk: 15, def: 0 },
    "brutal beatdown": { atk: 15, def: 0 },
    "tough as nails": { atk: 0, def: 20 },
    "bombardment": { atk: 15, def: 0 },
    "universe's most malevolent": { atk: 20, def: 0 },
    "strongest clan in space": { atk: 0, def: 0 },
    "the hera clan": { atk: 10, def: 10 },
    "galactic warriors": { atk: 15, def: 15 },
    "over in a flash": { atk: 7, def: 0 },
    "shattering the limit": { atk: 5, def: 5 },
    "legendary power": { atk: 15, def: 0 },
    "kamehameha": { atk: 10, def: 0 },
    "battlefield diva": { atk: 0, def: 7 },
    "team bardock": { atk: 10, def: 10 },
    "the ginyu force": { atk: 15, def: 15 },
    "frieza's minion": { atk: 10, def: 0 },
    "frieza's army": { atk: 10, def: 10 },
    "revival": { atk: 0, def: 5 },
    "master of magic": { atk: 15, def: 10 },
    "demonic power": { atk: 15, def: 10 },
    "demon": { atk: 15, def: 15 },
    "demon duo": { atk: 15, def: 15 },
    "experienced fighters": { atk: 15, def: 0 },
    "gaze of respect": { atk: 10, def: 10 },
    "patrol": { atk: 10, def: 10 },
    "brainiacs": { atk: 15, def: 15 },
    "wall standing tall": { atk: 20, def: 0 },
    "auto regeneration": { atk: 0, def: 5 },
    "fear and faith": { atk: 0, def: 0 },
    "coward": { atk: 0, def: 5 },
    "speedy retribution": { atk: 10, def: 10 },
    "telekinesis": { atk: 0, def: 20 },
    "teleportation": { atk: 10, def: 10 },
    "dodonpa": { atk: 15, def: 0 },
    "evil dragons": { atk: 20, def: 20 },
    "shadow dragons": { atk: 20, def: 20 },
    "new frieza army": { atk: 20, def: 20 },
    "resurrection 'f'": { atk: 10, def: 10 },
    "destroyer of the universe": { atk: 25, def: 15 }
};

let activeCharacterLinks = [];
let cardParsedStats = {
    baseMax: { atk: 14595, def: 9869 },
    hipo55: { atk: 16595, def: 11869 },
    rainbow100: { atk: 19995, def: 14869 },
    passiveAdditionals: 0
};
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


// Helper to inject inline Dokkan Images
function parseDokkanIcons(text) {
    if (!text) return '';
    return text
        .replace(/:up:/g, '<img src="assets/up.png" class="dokkan-icon" alt="up">')
        .replace(/:down:/g, '<img src="assets/down.png" class="dokkan-icon" alt="down">')
        .replace(/:ydown:/g, '<img src="assets/ydown.png" class="dokkan-icon" alt="ydown">')
        .replace(/:once:/g, '<img src="assets/once.png" class="dokkan-icon" alt="once">')
        .replace(/:inf:/g, '<img src="assets/inf.png" class="dokkan-icon" alt="inf">');
}

function setCalcTab(tab) {
    window.currentCalcTab = tab;
    const atkBtn = document.getElementById('btn-tab-atk');
    const defBtn = document.getElementById('btn-tab-def');
    if (atkBtn) atkBtn.classList.toggle('active', tab === 'atk');
    if (defBtn) defBtn.classList.toggle('active', tab === 'def');

    const atkViews = document.querySelectorAll('.view-atk-only');
    const defViews = document.querySelectorAll('.view-def-only');

    atkViews.forEach(el => el.style.display = (tab === 'atk') ? '' : 'none');
    defViews.forEach(el => el.style.display = (tab === 'def') ? '' : 'none');

    renderPassiveLinesByCurrentViewMode();
    calculateDokkanStats();
}

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

function setPassiveViewMode(mode) {
    window.currentPassiveViewMode = mode;
    document.querySelectorAll('[id^="pass-mode-"]').forEach(btn => btn.classList.remove('active'));
    const btn = document.getElementById(`pass-mode-${mode}`);
    if (btn) btn.classList.add('active');
    renderPassiveLinesByCurrentViewMode();
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

function updateKiSliderDisplay() {
    const slider = document.getElementById('calc-ki-slider');
    const valText = document.getElementById('calc-ki-val');
    const hintText = document.getElementById('calc-ki-range-hint');
    const ticksBox = document.getElementById('calc-ki-ticks');

    if (!slider || !valText) return;
    valText.innerText = parseInt(slider.value, 10);

    const isLR = (window.currentCalcRarity === 'LR');
    if (isLR) {
        slider.min = "12"; slider.max = "24";
        if (hintText) hintText.innerText = "(12-17: SA, 18-24: U. SA)";
        if (ticksBox) ticksBox.innerHTML = `<span>12</span><span>15</span><span>18</span><span>21</span><span>24</span>`;
    } else {
        slider.min = "1"; slider.max = "12";
        if (hintText) hintText.innerText = "(1-11: Scaled, 12: Max SA)";
        if (ticksBox) ticksBox.innerHTML = `<span>1</span><span>3</span><span>6</span><span>9</span><span>12</span>`;
    }
}

function updateHitStacksDisplay() {
    const slider = document.getElementById('calc-hit-stacks-slider');
    const text = document.getElementById('calc-hit-stacks-text');
    if (slider && text) text.innerText = `${slider.value} / ${slider.max} Hits`;
}

function updatePassiveHpSlider(val) {
    window.currentHpPercent = parseInt(val, 10) || 100;
    const txt1 = document.getElementById('calc-passive-hp-val');
    if (txt1) txt1.innerText = `${window.currentHpPercent}%`;
    if (typeof refreshPassiveHpYieldsInPlace === 'function') {
        refreshPassiveHpYieldsInPlace();
    }
    calculateDokkanStats();
}

function convertImgTagsToShortcodes(html) {
    if (!html) return '';
    return html
        .replace(/<img[^>]*passive_skill_dialog_arrow01[^>]*>/gi, ' :up:')
        .replace(/<img[^>]*passive_skill_dialog_arrow02[^>]*>/gi, ' :down:')
        .replace(/<img[^>]*passive_skill_dialog_arrow03[^>]*>/gi, ' :ydown:')
        .replace(/<img[^>]*passive_skill_dialog_icon_01[^>]*>/gi, ' :once:')
        .replace(/<img[^>]*passive_skill_dialog_icon_02[^>]*>/gi, ' :inf:')
        .replace(/<img[^>]*st_0011[^>]*>/gi, ' :atk_down:')
        .replace(/<img[^>]*st_0012[^>]*>/gi, ' :def_down:')
        .replace(/<img[^>]*st_0100[^>]*>/gi, ' :stun:')
        .replace(/<img[^>]*st_0102[^>]*>/gi, ' :seal:')
        .replace(/<img[^>]*st_1009[^>]*>/gi, ' :break:');
}

// --- FULL INTERACTIVE PASSIVE SKILL PARSER ---
function parseAndRenderInteractivePassiveCard(pContainer) {
    const cardEl = document.getElementById('calc-passive-toggles-card');
    if (!cardEl || !pContainer) return;

    const charNameEl = document.getElementById('calc-char-name-text');
    const currentCharName = charNameEl ? charNameEl.innerText.toLowerCase() : '';

    window.interactivePassiveLines = [];
    window.passiveHasHpScaling = false;
    const sections = pContainer.querySelectorAll('[id^="card-sec-"], [id^="side-sec-"], .passive-section');

    let globalLineIdx = 0;
    const condRegexFilter = /final blow|facing 2 or more|versus|super class enemy|extreme class enemy|when hp is 30%|when hp is 50%|hp or less|hp or more|nullifies|ko\'d|when the character is ko|targeted by|when receiving/i;

    const parseSections = (sections.length > 0) ? sections : [pContainer];

    parseSections.forEach(sec => {
        const headerEl = sec.querySelector('strong, b, .header, h1, h2, h3, h4');
        const rawHeaderHtml = headerEl ? headerEl.innerHTML : 'Basic Effect(s)';
        const tempHeaderDiv = document.createElement('div');
        tempHeaderDiv.innerHTML = convertImgTagsToShortcodes(rawHeaderHtml);
        const headerText = tempHeaderDiv.textContent.trim() || 'Basic Effect(s)';

        const listItems = sec.querySelectorAll('li, p, div');
        const itemsList = (listItems.length > 0) ? listItems : [sec];

        itemsList.forEach(li => {
            const tempItemDiv = document.createElement('div');
            tempItemDiv.innerHTML = convertImgTagsToShortcodes(li.innerHTML || li.textContent || '');
            const rawText = tempItemDiv.textContent.trim();

            if (!rawText || rawText.length < 3 || rawText.startsWith('▶')) return;

            const clauses = rawText.split(/(?:,\s*plus\s+an\s+additional|;\s*plus\s+an\s+additional|\.\s*plus\s+an\s+additional)/i);

            clauses.forEach((clauseText, cIdx) => {
                const itemText = (cIdx > 0 ? "Plus an additional " : "") + clauseText.trim();
                const itemLower = itemText.toLowerCase();
                const fullContext = (headerText + " " + itemText).toLowerCase();

                // 1. DETECT COUNTERS
                const isSaCounter = /countering with (?:tremendous|extraordinary|supreme|ferocious|enormous) power|counters? with (?:tremendous|extraordinary|supreme|ferocious|enormous) power/i.test(fullContext) &&
                                    (/when receiving (?:an? )?[^,\.]*?super attack/i.test(fullContext) || fullContext.includes('nullifies'));

                const isNormalCounter = !isSaCounter && /counters? with (?:tremendous|extraordinary|supreme|ferocious|enormous) power/i.test(fullContext);

                let counterTempAtk = 0;
                let counterPower = 300;
                let counterPowerName = "Tremendous";
                let counterTriggerCat = "Super Attack";

                if (isSaCounter || isNormalCounter) {
                    if (fullContext.includes('ferocious power')) { counterPower = 400; counterPowerName = "Ferocious"; }
                    else if (fullContext.includes('extraordinary power')) { counterPower = 200; counterPowerName = "Extraordinary"; }
                    else if (fullContext.includes('enormous power')) { counterPower = 150; counterPowerName = "Enormous"; }
                    else if (fullContext.includes('supreme power')) { counterPower = 300; counterPowerName = "Supreme"; }
                    else { counterPower = 300; counterPowerName = "Tremendous"; }

                    if (isSaCounter) {
                        const tempAtkMatch = fullContext.match(/atk[^\d%]*(\d+)%/i) || fullContext.match(/(\d+)%\s*up/i) || fullContext.match(/(\d+)%/i);
                        if (tempAtkMatch) counterTempAtk = parseInt(tempAtkMatch[1], 10);

                        if (fullContext.includes('ki blast super attack') || fullContext.includes('ki blast')) counterTriggerCat = "Ki Blast SA";
                        else if (fullContext.includes('unarmed super attack') || fullContext.includes('unarmed')) counterTriggerCat = "Unarmed SA";
                        else if (fullContext.includes('melee super attack') || fullContext.includes('melee')) counterTriggerCat = "Melee SA";
                        else if (fullContext.includes('weapon super attack') || fullContext.includes('weapon')) counterTriggerCat = "Weapon SA";
                    } else {
                        counterTriggerCat = "Normal Attack";
                    }
                }

                const isEnemyTargeted = !isSaCounter && !isNormalCounter && /attacked enemy|enemies'|enemy's|to the enemy|seals the attacked enemy|lowers enemy|reduces enemy/i.test(fullContext);

                const isHpInverse = /lower the hp|less hp|the lower the hp/i.test(fullContext);
                const isHpDirect = /higher the hp|more hp|hp remaining|the higher the hp/i.test(fullContext);
                if (isHpInverse || isHpDirect) window.passiveHasHpScaling = true;

                const explicitlyExcludesSelf = /\bother allies\b|\bexcluding self\b|\bexcept self\b|\ballies excluding\b/i.test(fullContext);
                const mentionsSelf = /\bincluding self\b|\band self\b|\bself and\b/i.test(itemLower);
                let isAllySupportOnly = explicitlyExcludesSelf;

                if (!isAllySupportOnly) {
                    const isSuperClassSupport = /\bsuper\s+class\s+allies\b/i.test(fullContext) && !/\band\s+extreme\s+class\b/i.test(fullContext);
                    const isExtremeClassSupport = /\bextreme\s+class\s+allies\b/i.test(fullContext) && !/\band\s+super\s+class\b/i.test(fullContext);

                    if (isSuperClassSupport && (window.currentCalcClass || '').toLowerCase() === 'extreme') {
                        isAllySupportOnly = true;
                    }
                    if (isExtremeClassSupport && (window.currentCalcClass || '').toLowerCase() === 'super') {
                        isAllySupportOnly = true;
                    }
                }

                if (!isAllySupportOnly) {
                    const nameMatch = fullContext.match(/allies whose names include ["']?([^"']+)["']?/i);
                    if (nameMatch) {
                        const requiredName = nameMatch[1].toLowerCase();
                        if (!currentCharName.includes(requiredName)) {
                            isAllySupportOnly = true;
                        }
                    } else if (/\ballies\b/i.test(fullContext) && !mentionsSelf && /other allies/i.test(fullContext)) {
                        isAllySupportOnly = true;
                    }
                }

                const isDomainActivePassive = /when the domain|when a domain|while a domain/i.test(fullContext);
                const isOrbThresholdBuff = /\d+\s+or\s+more\s+.*ki\s+spheres?/i.test(fullContext);

                const isMidBattleBuildup = /per attack received|per attack evaded|after receiving|after evading|per attack performed|per attack launched|each attack received|each attack performed|upon receiving|when receiving|for every attack received|for every attack evaded/i.test(fullContext);
                const isOnAttackPhase2 = itemLower.includes('when performing a super attack') || 
                                          itemLower.includes('when performing an ultra super attack') || 
                                          itemLower.includes('when attacking') || 
                                          headerText.toLowerCase().includes('when performing') ||
                                          headerText.toLowerCase().includes('when attacking');

                const isPhase2 = !isAllySupportOnly && !isDomainActivePassive && !isOrbThresholdBuff && (isMidBattleBuildup || isOnAttackPhase2);

                const isConditional = condRegexFilter.test(headerText + " " + itemText);
                const isOneTurn = fullContext.includes('for 1 turn') || fullContext.includes('within the turn') || fullContext.includes('for the turn');

                const isAdditionalUltraSa = !isSaCounter && !isNormalCounter && !isEnemyTargeted && !isAllySupportOnly && (
                    itemLower.includes('additional ultra super attack') || 
                    (itemLower.includes('additional') && itemLower.includes('ultra super attack')) ||
                    itemLower.includes('additional 18 ki')
                );
                const isAdditional12KiSa = !isSaCounter && !isNormalCounter && !isEnemyTargeted && !isAllySupportOnly && !isAdditionalUltraSa && (
                    itemLower.includes('additional super attack') || 
                    (itemLower.includes('additional attack') && itemLower.includes('super attack')) ||
                    itemLower.includes('launches an additional attack') ||
                    itemLower.includes('launches additional attack') ||
                    itemLower.includes('launches 2 additional') ||
                    itemLower.includes('launches 3 additional')
                );
                const isAdditionalSa = isAdditionalUltraSa || isAdditional12KiSa;

                let addSaMax = 1;
                if (isAdditionalSa) {
                    const upToMatch = fullContext.match(/\bup\s+to\s+(\d+|two|three|four|five)\s*(?:times|attacks|super attacks)?\b/i);
                    if (upToMatch) {
                        const valStr = upToMatch[1].toLowerCase();
                        if (valStr === 'two' || valStr === '2') addSaMax = 2;
                        else if (valStr === 'three' || valStr === '3') addSaMax = 3;
                        else if (valStr === 'four' || valStr === '4') addSaMax = 4;
                        else if (valStr === 'five' || valStr === '5') addSaMax = 5;
                        else {
                            const parsed = parseInt(valStr, 10);
                            addSaMax = (!isNaN(parsed) && parsed > 0) ? parsed : 1;
                        }
                    } else {
                        const numMatch = fullContext.match(/launches\s+(?:up\s+to\s+)?(\d+|an?|two|three|four|five)\s+(?:additional\s+)?(?:super\s+)?attacks?/i) ||
                                         fullContext.match(/(\d+|two|three|four|five)\s+additional\s+(?:super\s+)?attacks?/i);
                        if (numMatch) {
                            const valStr = numMatch[1].toLowerCase();
                            if (valStr === 'two' || valStr === '2') addSaMax = 2;
                            else if (valStr === 'three' || valStr === '3') addSaMax = 3;
                            else if (valStr === 'four' || valStr === '4') addSaMax = 4;
                            else if (valStr === 'five' || valStr === '5') addSaMax = 5;
                            else {
                                const parsed = parseInt(valStr, 10);
                                addSaMax = (!isNaN(parsed) && parsed > 0) ? parsed : 1;
                            }
                        }
                    }
                }

                const isProgressiveWithinTurnBuildup = /\b(?:per|each|for\s+every|with\s+each)\s+(?:super\s+)?attacks?\s+(?:performed|launched|made|delivered)?\b.*?\b(?:within\s+the\s+turn|for\s+the\s+turn)\b/i.test(fullContext) ||
                                                      /\b(?:within\s+the\s+turn|for\s+the\s+turn)\b.*?\b(?:per|each|for\s+every|with\s+each)\s+(?:super\s+)?attacks?\b/i.test(fullContext);
                const isOnSaWithinTurn = !isSaCounter && !isNormalCounter && !isEnemyTargeted && !isAllySupportOnly && isProgressiveWithinTurnBuildup;

                let atkVal = 0, defVal = 0;
                if (!isEnemyTargeted && !isSaCounter && !isNormalCounter) {
                    const combinedMatch = itemText.match(/(?:ATK\s*(?:&|and)\s*DEF|DEF\s*(?:&|and)\s*ATK)[^\d%]*(\d+)%/i);
                    const atkMatch = itemText.match(/ATK[^\d%]*(\d+)%/i);
                    const defMatch = itemText.match(/DEF[^\d%]*(\d+)%/i);

                    if (combinedMatch) { atkVal = parseInt(combinedMatch[1], 10); defVal = parseInt(combinedMatch[1], 10); }
                    else {
                        if (atkMatch) atkVal = parseInt(atkMatch[1], 10);
                        if (defMatch) defVal = parseInt(defMatch[1], 10);
                    }

                    const isAtkNeg = /(-\s*\d+%|lowers\s+atk|decreases\s+atk|reduces\s+atk)/i.test(itemText);
                    const isDefNeg = /(-\s*\d+%|lowers\s+def|decreases\s+def|reduces\s+def)/i.test(itemText);
                    if (isAtkNeg) atkVal = -Math.abs(atkVal);
                    if (isDefNeg) defVal = -Math.abs(defVal);
                }

                const stepVal = Math.max(Math.abs(atkVal), Math.abs(defVal));
                const maxPctMatch = fullContext.match(/\bup\s+to\s+(\d+)%/i);
                const maxTimesMatch = fullContext.match(/\bup\s+to\s+(\d+)\s*(?:times|attacks|super attacks|ki|turns|events|triggers|orbs|spheres)\b/i);

                let isStacking = false; let maxSteps = 1; let maxPctCap = 0; let stackType = 'infinite';

                if (!isHpInverse && !isHpDirect && !isEnemyTargeted && !isSaCounter && !isNormalCounter) {
                    if (maxPctMatch && stepVal > 0) {
                        maxPctCap = parseInt(maxPctMatch[1], 10);
                        maxSteps = (maxPctCap >= 9999) ? 99 : Math.max(1, Math.ceil(maxPctCap / stepVal));
                        isStacking = true;
                    } else if (maxTimesMatch) {
                        maxSteps = Math.min(99, parseInt(maxTimesMatch[1], 10));
                        isStacking = true;
                    } else if (!isOneTurn && !isAllySupportOnly) {
                        if (
                            /\b(?:with|for|at|per)\s+(?:each|every)\b/i.test(fullContext) ||
                            /\bstart of each turn\b/i.test(fullContext) ||
                            /\bfor infinite turns\b/i.test(fullContext) ||
                            /\bper attack\b/i.test(fullContext) ||
                            /\bper super attack\b/i.test(fullContext) ||
                            /\bper ki sphere\b/i.test(fullContext) ||
                            /\beach time\b/i.test(fullContext)
                        ) {
                            isStacking = true; maxSteps = 99;
                        }
                    }
                }

                if (/\bki sphere\b|\borbs\b/i.test(fullContext)) stackType = 'ki_sphere';
                else if (/\bcategory ally\b|\bper ally\b|\bon the team\b|\ballies whose names\b/i.test(fullContext) && !isAllySupportOnly) stackType = 'ally';
                else if (/\bper enemy\b|\bfor each enemy\b|\benemies present\b|\bper enemy present\b/i.test(fullContext)) stackType = 'enemy';
                else stackType = 'attack';

                const drMatch = itemText.match(/reduces\s+damage\s+received\s+by\s+(\d+)%/i);
                const drVal = (!isEnemyTargeted && drMatch && !isAllySupportOnly) ? parseInt(drMatch[1], 10) : 0;
                const hasGuard = !isEnemyTargeted && !isAllySupportOnly && /guards\s+all\s+attacks|guard\s+against\s+all\s+attacks/i.test(itemText);
                const hasStatImpact = isSaCounter || isNormalCounter || (!isEnemyTargeted && !isAllySupportOnly && (atkVal !== 0 || defVal !== 0 || drVal > 0 || hasGuard || isAdditionalSa));

                const defaultActive = (!isConditional && !isAllySupportOnly && !isEnemyTargeted && !isSaCounter && !isNormalCounter);
                const initialStackCount = isStacking ? (stackType === 'ally' ? maxSteps : (maxPctCap ? maxSteps : 1)) : 1;

                window.interactivePassiveLines.push({
                    idx: globalLineIdx, sectionHeader: headerText, text: itemText,
                    atkStep: (isAllySupportOnly || isEnemyTargeted || isSaCounter || isNormalCounter) ? 0 : atkVal, 
                    defStep: (isAllySupportOnly || isEnemyTargeted || isSaCounter || isNormalCounter) ? 0 : defVal,
                    isHpInverse, isHpDirect, drVal, hasGuard, isAdditionalSa, isAdditionalUltraSa, addSaMax, addSaCount: addSaMax,
                    isOnSaWithinTurn, hasStatImpact, stackCount: initialStackCount, maxSteps, maxPctCap, stackType, isStacking,
                    phase: isPhase2 ? 'p2' : 'sot', active: defaultActive || (stackType === 'ally'),
                    isConditional, isAllySupportOnly, isEnemyTargeted,
                    isSaCounter, isNormalCounter, counterTempAtk, counterPower, counterPowerName, counterTriggerCat,
                    counterCount: isNormalCounter ? 0 : 1, counterTiming: 'after' // 'before' vs 'after' for SA counter
                });
                globalLineIdx++;
            });
        });
    });

    if (globalLineIdx > 0) {
        cardEl.style.display = 'block';
        renderPassiveLinesByCurrentViewMode();
    } else {
        cardEl.style.display = 'none';
    }
}

function toggleLinePhase(idx) {
    if (window.interactivePassiveLines[idx]) {
        const curPhase = window.interactivePassiveLines[idx].phase;
        window.interactivePassiveLines[idx].phase = (curPhase === 'p1' || curPhase === 'sot') ? 'p2' : 'sot';
        renderPassiveLinesByCurrentViewMode();
        calculateDokkanStats();
    }
}

function toggleSaCounterTiming(idx) {
    if (window.interactivePassiveLines[idx]) {
        const curTiming = window.interactivePassiveLines[idx].counterTiming || 'after';
        window.interactivePassiveLines[idx].counterTiming = (curTiming === 'after') ? 'before' : 'after';
        renderPassiveLinesByCurrentViewMode();
        calculateDokkanStats();
    }
}

function updateNormalCounterCount(idx) {
    const sel = document.getElementById(`calc-pass-counter-${idx}`);
    if (window.interactivePassiveLines[idx] && sel) {
        const cnt = parseInt(sel.value, 10);
        window.interactivePassiveLines[idx].counterCount = cnt;
        window.interactivePassiveLines[idx].active = (cnt > 0);
        renderPassiveLinesByCurrentViewMode();
        calculateDokkanStats();
    }
}

// --- RENDER PASSIVE LINES ACCORDING TO VIEW MODE & CURRENT TAB ---
function renderPassiveLinesByCurrentViewMode() {
    const containerEl = document.getElementById('calc-passive-lines-container');
    if (!containerEl) return;

    const mode = window.currentPassiveViewMode || 'full';
    const tab = window.currentCalcTab || 'atk';
    let htmlBuffer = '';

    if (window.passiveHasHpScaling) {
        htmlBuffer += `
            <div style="background: rgba(4, 20, 15, 0.85); padding: 8px 10px; border-radius: 6px; margin-bottom: 8px; border: 1px solid rgba(250, 204, 21, 0.4);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                    <span style="font-weight: 800; font-size: 10.5px; color: #facc15;">❤️ Current HP % Simulator: <span id="calc-passive-hp-val" style="color: #38bdf8; font-weight: 900;">${window.currentHpPercent}%</span></span>
                </div>
                <input type="range" id="calc-passive-hp-slider" min="1" max="100" value="${window.currentHpPercent}" style="width: 100%; accent-color: #facc15; cursor: pointer;" oninput="updatePassiveHpSlider(this.value)">
            </div>
        `;
    }

    if (mode === 'condensed') {
        let sotAtk = 0, sotDef = 0, p2Atk = 0, p2Def = 0;
        const hpVal = window.currentHpPercent || 100;

        window.interactivePassiveLines.forEach(line => {
            if (line.active) {
                let hpMult = 1;
                if (line.isHpInverse) hpMult = (100 - hpVal) / 99;
                else if (line.isHpDirect) hpMult = hpVal / 100;

                let uncappedAtk = line.atkStep * (line.isStacking ? line.stackCount : 1) * hpMult;
                let uncappedDef = line.defStep * (line.isStacking ? line.stackCount : 1) * hpMult;

                if (line.maxPctCap && line.maxPctCap > 0) {
                    uncappedAtk = Math.min(line.maxPctCap, uncappedAtk);
                    uncappedDef = Math.min(line.maxPctCap, uncappedDef);
                }

                if (line.phase === 'p2') { p2Atk += uncappedAtk; p2Def += uncappedDef; }
                else { sotAtk += uncappedAtk; sotDef += uncappedDef; }
            }
        });

        htmlBuffer += `
            <div style="background: rgba(4, 20, 15, 0.85); padding: 10px; border-radius: 6px; border: 1px solid #10b981;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                    <span style="font-weight: 800; font-size: 11px; color: #38bdf8;">🔷 Start of Turn Total:</span>
                    <span style="font-weight: 900; font-size: 12px; color: #facc15;">+${Math.round(sotAtk)}% ATK / +${Math.round(sotDef)}% DEF</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span style="font-weight: 800; font-size: 11px; color: #34d399;">🟩 Phase 2 (On Attack) Total:</span>
                    <span style="font-weight: 900; font-size: 12px; color: #facc15;">+${Math.round(p2Atk)}% ATK / +${Math.round(p2Def)}% DEF</span>
                </div>
            </div>
        `;
        containerEl.innerHTML = htmlBuffer;
        return;
    }

    let currentHeader = '';
    window.interactivePassiveLines.forEach(line => {
        if (mode === 'effects') {
            if (!line.hasStatImpact) return;
            if (tab === 'atk' && line.atkStep === 0 && !line.isAdditionalSa && !line.isSaCounter && !line.isNormalCounter) return;
            if (tab === 'def' && line.defStep === 0 && line.drVal === 0 && !line.hasGuard) return;
        }

        if (line.sectionHeader !== currentHeader) {
            currentHeader = line.sectionHeader;
            htmlBuffer += `<div class="ds-passive-sec-header">▶ ${parseDokkanIcons(currentHeader)}</div>`;
        }

        const hpVal = window.currentHpPercent || 100;
        let hpMult = 1;
        if (line.isHpInverse) hpMult = (100 - hpVal) / 99;
        else if (line.isHpDirect) hpMult = hpVal / 100;

        let totalAtk = Math.round(line.atkStep * (line.isStacking ? line.stackCount : 1) * hpMult);
        let totalDef = Math.round(line.defStep * (line.isStacking ? line.stackCount : 1) * hpMult);

        if (line.maxPctCap && line.maxPctCap > 0) {
            totalAtk = Math.min(line.maxPctCap, totalAtk);
            totalDef = Math.min(line.maxPctCap, totalDef);
        }

        const phaseBadgeHtml = (line.isAdditionalSa || line.isSaCounter || line.isNormalCounter) ? '' : ((line.phase === 'p2') ? 
            `<button class="phase-badge phase-badge-p2" onclick="toggleLinePhase(${line.idx})" style="cursor:pointer;" title="Click to change to Phase 1">Phase 2 (Mid-Battle)</button>` : 
            `<button class="phase-badge phase-badge-p1" onclick="toggleLinePhase(${line.idx})" style="cursor:pointer;" title="Click to change to Phase 2">Phase 1 (Start of Turn)</button>`);

        let controlWidgetHtml = '';
        const finalLineText = parseDokkanIcons(line.text);

        if (line.isSaCounter) {
            controlWidgetHtml = `<input type="checkbox" id="calc-pass-line-${line.idx}" ${line.active ? 'checked' : ''} onchange="togglePassiveLineTrigger(${line.idx})" style="accent-color: #facc15;">`;
            const timingBtnHtml = (line.counterTiming === 'before') ?
                `<button class="phase-badge phase-badge-p1" onclick="toggleSaCounterTiming(${line.idx})" style="cursor:pointer;" title="Click to change to After SA">Timing: Before SA</button>` :
                `<button class="phase-badge phase-badge-p2" onclick="toggleSaCounterTiming(${line.idx})" style="cursor:pointer;" title="Click to change to Before SA">Timing: After SA</button>`;

            htmlBuffer += `
                <div style="background: rgba(4, 20, 15, 0.85); padding: 5px 8px; border-radius: 6px; margin-bottom: 4px; border: 1px solid rgba(250, 204, 21, 0.4); display: flex; flex-direction: column; gap: 3px;">
                    <div style="display: flex; align-items: flex-start; gap: 6px;">
                        ${controlWidgetHtml}
                        <label for="calc-pass-line-${line.idx}" style="font-size: 11px; font-weight: 700; cursor: pointer; color: #facc15; line-height: 1.3;">
                            ⚡ ${finalLineText}
                        </label>
                    </div>
                    <div style="display: flex; align-items: center; justify-content: space-between; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 2px;">
                        <span style="color: #38bdf8; font-size: 10px; font-weight: 800;">
                            ↳ SA Counter (${line.counterTriggerCat}): +${line.counterTempAtk}% Temp ATK | ${line.counterPower}% Mult (${line.counterPowerName})
                        </span>
                        ${timingBtnHtml}
                    </div>
                </div>
            `;
        } else if (line.isNormalCounter) {
            let optionsHtml = '';
            for (let i = 0; i <= 99; i++) {
                optionsHtml += `<option value="${i}" ${i === line.counterCount ? 'selected' : ''}>${i}</option>`;
            }
            controlWidgetHtml = `<select class="ds-stack-select" id="calc-pass-counter-${line.idx}" onchange="updateNormalCounterCount(${line.idx})">${optionsHtml}</select>`;

            htmlBuffer += `
                <div style="background: rgba(4, 20, 15, 0.85); padding: 5px 8px; border-radius: 6px; margin-bottom: 4px; border: 1px solid rgba(250, 204, 21, 0.4); display: flex; flex-direction: column; gap: 3px;">
                    <div style="display: flex; align-items: flex-start; gap: 6px;">
                        ${controlWidgetHtml}
                        <label style="font-size: 11px; font-weight: 700; color: #facc15; line-height: 1.3;">
                            💥 ${finalLineText}
                        </label>
                    </div>
                    <div style="display: flex; align-items: center; justify-content: space-between; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 2px;">
                        <span style="color: #34d399; font-size: 10px; font-weight: 800;">
                            ↳ Normal Counter: ${line.counterPower}% Mult (${line.counterPowerName}) | Selected: ${line.counterCount} Counter(s)
                        </span>
                    </div>
                </div>
            `;
        } else if (line.isAdditionalSa) {
            let optionsHtml = '';
            for (let i = 0; i <= line.addSaMax; i++) {
                optionsHtml += `<option value="${i}" ${i === line.addSaCount ? 'selected' : ''}>${i}</option>`;
            }
            controlWidgetHtml = `<select class="ds-stack-select" id="calc-pass-addsa-${line.idx}" onchange="updatePassiveAddSaTrigger(${line.idx})">${optionsHtml}</select>`;

            htmlBuffer += `
                <div style="background: rgba(4, 20, 15, 0.8); padding: 5px 8px; border-radius: 6px; margin-bottom: 4px; border: 1px solid rgba(250, 204, 21, 0.3); display: flex; flex-direction: column; gap: 3px;">
                    <div style="display: flex; align-items: flex-start; gap: 6px;">
                        ${controlWidgetHtml}
                        <label style="font-size: 11px; font-weight: 700; color: #facc15; line-height: 1.3;">
                            ⚡ ${finalLineText}
                        </label>
                    </div>
                    <div style="display: flex; align-items: center; justify-content: space-between; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 2px;">
                        <span style="color: #38bdf8; font-size: 10px; font-weight: 800;">
                            ↳ Selected: ${line.addSaCount} / ${line.addSaMax} Additional Attack(s)
                        </span>
                        ${phaseBadgeHtml}
                    </div>
                </div>
            `;
        } else if (line.hasStatImpact) {
            if (line.isStacking) {
                let optionsHtml = '';
                for (let i = 0; i <= line.maxSteps; i++) {
                    optionsHtml += `<option value="${i}" ${i === line.stackCount ? 'selected' : ''}>${i}</option>`;
                }
                controlWidgetHtml = `<select class="ds-stack-select" id="calc-pass-stack-${line.idx}" onchange="updatePassiveStackTrigger(${line.idx})">${optionsHtml}</select>`;
            } else {
                controlWidgetHtml = `<input type="checkbox" id="calc-pass-line-${line.idx}" ${line.active ? 'checked' : ''} onchange="togglePassiveLineTrigger(${line.idx})" style="accent-color: #10b981;">`;
            }

            if (line.isStacking) {
                let stackUnitText = 'attacks';
                if (line.stackType === 'ki_sphere') stackUnitText = 'orbs';
                else if (line.stackType === 'ally') stackUnitText = 'allies';
                else if (line.stackType === 'enemy') stackUnitText = 'enemies';

                htmlBuffer += `
                    <div style="background: rgba(4, 20, 15, 0.8); padding: 5px 8px; border-radius: 6px; margin-bottom: 4px; border: 1px solid rgba(16, 185, 129, 0.2); display: flex; flex-direction: column; gap: 3px;">
                        <div style="display: flex; align-items: flex-start; gap: 6px;">
                            ${controlWidgetHtml}
                            <label for="calc-pass-line-${line.idx}" style="font-size: 11px; font-weight: 700; cursor: pointer; color: #ecfdf5; line-height: 1.3;">
                                ${finalLineText}
                            </label>
                        </div>
                        <div style="display: flex; align-items: center; justify-content: space-between; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 2px;">
                            <span style="color: #34d399; font-size: 10px; font-weight: 800;">
                                ↳ +${totalAtk}% ATK / +${totalDef}% DEF (${line.stackCount} ${stackUnitText})
                            </span>
                            ${phaseBadgeHtml}
                        </div>
                    </div>
                `;
            } else {
                htmlBuffer += `
                    <div style="background: rgba(4, 20, 15, 0.8); padding: 5px 8px; border-radius: 6px; margin-bottom: 4px; border: 1px solid rgba(16, 185, 129, 0.2); display: flex; align-items: center; justify-content: space-between; gap: 6px;">
                        <div style="display: flex; align-items: center; gap: 6px; flex: 1;">
                            ${controlWidgetHtml}
                            <label for="calc-pass-line-${line.idx}" style="font-size: 11px; font-weight: 700; cursor: pointer; color: #ecfdf5; line-height: 1.3;">
                                ${finalLineText}
                            </label>
                        </div>
                        ${phaseBadgeHtml}
                    </div>
                `;
            }
        } else {
            controlWidgetHtml = `<span style="font-size: 10px; color: #64748b;">•</span>`;
            htmlBuffer += `
                <div style="background: rgba(4, 20, 15, 0.8); padding: 5px 8px; border-radius: 6px; margin-bottom: 4px; border: 1px solid rgba(16, 185, 129, 0.2); display: flex; align-items: center; justify-content: space-between; gap: 6px;">
                    <div style="display: flex; align-items: center; gap: 6px; flex: 1;">
                        ${controlWidgetHtml}
                        <label style="font-size: 11px; font-weight: 700; color: #ecfdf5; line-height: 1.3;">
                            ${finalLineText}
                        </label>
                    </div>
                </div>
            `;
        }
    });

    containerEl.innerHTML = htmlBuffer;
}

function togglePassiveLineTrigger(idx) {
    const box = document.getElementById(`calc-pass-line-${idx}`);
    if (window.interactivePassiveLines[idx] && box) {
        window.interactivePassiveLines[idx].active = box.checked;
        calculateDokkanStats();
    }
}

function updatePassiveStackTrigger(idx) {
    const sel = document.getElementById(`calc-pass-stack-${idx}`);
    if (window.interactivePassiveLines[idx] && sel) {
        const cnt = parseInt(sel.value, 10);
        window.interactivePassiveLines[idx].stackCount = cnt;
        window.interactivePassiveLines[idx].active = (cnt > 0);
        renderPassiveLinesByCurrentViewMode();
        calculateDokkanStats();
    }
}

function updatePassiveAddSaTrigger(idx) {
    const sel = document.getElementById(`calc-pass-addsa-${idx}`);
    if (window.interactivePassiveLines[idx] && sel) {
        const cnt = parseInt(sel.value, 10);
        window.interactivePassiveLines[idx].addSaCount = cnt;
        window.interactivePassiveLines[idx].active = (cnt > 0);
        renderPassiveLinesByCurrentViewMode();
        calculateDokkanStats();
    }
}

function toggleCalcRarity(rarity, skipRecalc = false) {
    window.currentCalcRarity = rarity;
    const turBtn = document.getElementById('calc-rarity-btn-tur');
    const lrBtn = document.getElementById('calc-rarity-btn-lr');
    if (turBtn) turBtn.classList.toggle('active', rarity === 'TUR');
    if (lrBtn) lrBtn.classList.toggle('active', rarity === 'LR');

    const kiSlider = document.getElementById('calc-ki-slider');
    if (rarity === 'LR') {
        document.getElementById('calc-ki-mult-base').value = 200;
        document.getElementById('calc-ki-mult-add').value = 160;
        if (kiSlider) kiSlider.value = "24";
    } else {
        document.getElementById('calc-ki-mult-base').value = 150;
        document.getElementById('calc-ki-mult-add').value = 150;
        if (kiSlider) kiSlider.value = "12";
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

function parseSaEffect(text) {
    let a = 0, d = 0;
    if (!text) return { atk: 0, def: 0 };
    const t = text.toLowerCase();

    const combinedNum = t.match(/raises\s+atk\s*(?:&|and)\s*def[^\d%]*(\d+)%/i) || 
                        t.match(/atk\s*(?:&|and)\s*def\s*\+?\s*(\d+)%/i);
    if (combinedNum) {
        a = parseInt(combinedNum[1], 10);
        d = parseInt(combinedNum[1], 10);
        return { atk: a, def: d };
    }

    const atkNum = t.match(/raises\s+atk[^\d%]*(\d+)%/i) || t.match(/atk\s*\+\s*(\d+)%/i);
    const defNum = t.match(/raises\s+def[^\d%]*(\d+)%/i) || t.match(/def\s*\+\s*(\d+)%/i);
    if (atkNum) a = parseInt(atkNum[1], 10);
    if (defNum) d = parseInt(defNum[1], 10);

    if (a > 0 || d > 0) return { atk: a, def: d };

    if (t.includes('atk & def') || t.includes('atk and def')) {
        if (t.includes('massively raises')) { a = 100; d = 100; }
        else if (t.includes('greatly raises')) { a = 50; d = 50; }
        else if (t.includes('raises')) { a = 30; d = 30; }
    } else {
        if (t.includes('massively raises atk')) a = 100;
        else if (t.includes('greatly raises atk')) a = 50;
        else if (t.includes('raises atk')) a = 30;

        if (t.includes('massively raises def')) d = 100;
        else if (t.includes('greatly raises def')) d = 50;
        else if (t.includes('raises def')) d = 30;
    }

    return { atk: a, def: d };
}

function renderDynamicSaRows(saBlocksData, isLR, isEZA) {
    const container = document.getElementById('calc-dynamic-sa-container');
    if (!container) return;

    window.parsedSaBlocksCount = saBlocksData.length;
    let htmlBuffer = '';

    saBlocksData.forEach((sa, idx) => {
        const labelLow = (sa.typeLabel + " " + sa.saName + " " + sa.fullText).toLowerCase();
        let defaultVal = "505";
        let optionsHtml = '';

        if (isLR) {
            if (isEZA) {
                if (labelLow.includes('ex')) defaultVal = "620";
                else if (labelLow.includes('mega')) defaultVal = "620";
                else if (labelLow.includes('colossal')) defaultVal = "475";
                else defaultVal = (idx === 0) ? "475" : "620";

                optionsHtml = `
                    <option value="475" ${defaultVal === "475" ? 'selected' : ''}>EZA Colossal (550% w/ HiPo)</option>
                    <option value="540" ${defaultVal === "540" ? 'selected' : ''}>LR EX Additional (615% w/ HiPo)</option>
                    <option value="620" ${defaultVal === "620" ? 'selected' : ''}>EZA Mega-Colossal / EX (695% w/ HiPo)</option>
                    <option value="790" ${defaultVal === "790" ? 'selected' : ''}>LR EX Ultimate AOE (865% w/ HiPo)</option>
                    <option value="800" ${defaultVal === "800" ? 'selected' : ''}>LR EX Ultimate (875% w/ HiPo)</option>
                    <option value="840" ${defaultVal === "840" ? 'selected' : ''}>LR Ultimate (915% w/ HiPo)</option>
                `;
            } else {
                if (labelLow.includes('ex')) defaultVal = (labelLow.includes('12 ki') || labelLow.includes('additional')) ? "540" : "800";
                else if (labelLow.includes('mega')) defaultVal = "570";
                else if (labelLow.includes('colossal')) defaultVal = "425";
                else defaultVal = (idx === 0) ? "425" : "570";

                optionsHtml = `
                    <option value="425" ${defaultVal === "425" ? 'selected' : ''}>Colossal (500% w/ HiPo)</option>
                    <option value="540" ${defaultVal === "540" ? 'selected' : ''}>LR EX Additional (615% w/ HiPo)</option>
                    <option value="570" ${defaultVal === "570" ? 'selected' : ''}>Mega-Colossal (645% w/ HiPo)</option>
                    <option value="790" ${defaultVal === "790" ? 'selected' : ''}>LR EX Ultimate AOE (865% w/ HiPo)</option>
                    <option value="800" ${defaultVal === "800" ? 'selected' : ''}>LR EX Ultimate (875% w/ HiPo)</option>
                    <option value="840" ${defaultVal === "840" ? 'selected' : ''}>LR Ultimate (915% w/ HiPo)</option>
                `;
            }
        } else {
            if (isEZA) {
                if (labelLow.includes('ex')) defaultVal = "690";
                else if (labelLow.includes('supreme')) defaultVal = "530";
                else defaultVal = "580";

                optionsHtml = `
                    <option value="355">Extreme (430% w/ HiPo)</option>
                    <option value="410" ${defaultVal === "410" ? 'selected' : ''}>TUR EX Additional (485% w/ HiPo)</option>
                    <option value="530" ${defaultVal === "530" ? 'selected' : ''}>EZA Supreme (605% w/ HiPo)</option>
                    <option value="580" ${defaultVal === "580" ? 'selected' : ''}>EZA Immense (655% w/ HiPo)</option>
                    <option value="690" ${defaultVal === "690" ? 'selected' : ''}>TUR EX Ultimate (765% w/ HiPo)</option>
                    <option value="740" ${defaultVal === "740" ? 'selected' : ''}>TUR EX Max (815% w/ HiPo)</option>
                `;
            } else {
                if (labelLow.includes('ex')) defaultVal = labelLow.includes('additional') ? "410" : "740";
                else if (labelLow.includes('supreme')) defaultVal = "430";
                else defaultVal = "505";

                optionsHtml = `
                    <option value="355">Extreme (430% w/ HiPo)</option>
                    <option value="410" ${defaultVal === "410" ? 'selected' : ''}>TUR EX Additional (485% w/ HiPo)</option>
                    <option value="430" ${defaultVal === "430" ? 'selected' : ''}>Supreme (505% w/ HiPo)</option>
                    <option value="505" ${defaultVal === "505" ? 'selected' : ''}>Immense (580% w/ HiPo)</option>
                    <option value="690" ${defaultVal === "690" ? 'selected' : ''}>TUR EX Ultimate (765% w/ HiPo)</option>
                    <option value="740" ${defaultVal === "740" ? 'selected' : ''}>TUR EX Max (815% w/ HiPo)</option>
                `;
            }
        }

        htmlBuffer += `
            <div style="background: rgba(4, 20, 15, 0.8); padding: 6px; border-radius: 6px; margin-bottom: 4px; border: 1px solid rgba(16, 185, 129, 0.2);">
                <div style="font-weight: 800; font-size: 10px; color: #34d399; margin-bottom: 2px;">
                    ⚡ SA #${idx + 1}: ${sa.typeLabel} - ${sa.saName}
                </div>
                <div style="margin-bottom: 2px;">
                    <label style="font-size: 8.5px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin: 0 0 2px 1px;">SA Multiplier</label>
                    <select id="calc-sa-type-${idx}" onchange="calculateDokkanStats()" style="width: 100%; margin-bottom: 4px; font-size: 10px;">
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
                            <input type="number" id="calc-sa-atk-effect-${idx}" value="${sa.eff.atk}" oninput="calculateDokkanStats(); updateSaYields(${idx});">
                            <span class="link-stat-orb-unit">%</span>
                        </div>
                        <div class="orb-yield-text atk" id="sa-atk-eff-yield-${idx}">+${sa.eff.atk}% ATK</div>
                    </div>
                    <!-- SA DEF Effect -->
                    <div class="link-stat-orb-card">
                        <div class="link-stat-orb-header">
                            <span class="link-stat-orb-badge def">DEF EFFECT</span>
                        </div>
                        <div class="link-stat-orb-input-box">
                            <input type="number" id="calc-sa-def-effect-${idx}" value="${sa.eff.def}" oninput="calculateDokkanStats(); updateSaYields(${idx});">
                            <span class="link-stat-orb-unit">%</span>
                        </div>
                        <div class="orb-yield-text def" id="sa-def-eff-yield-${idx}">+${sa.eff.def}% DEF</div>
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
    return parseFloat(sel?.value) || 505;
}

function populateCalcCardSelector() {
    const selectEl = document.getElementById('calc-card-select');
    if (!selectEl) return;

    const currentValue = selectEl.value;
    selectEl.innerHTML = `<option value="">-- Choose Custom Character --</option>`;

    let cardBoxes = document.querySelectorAll('#cardGrid .char-box');

    if (cardBoxes.length === 0) {
        const cachedHtml = localStorage.getItem('hub_cached_cards_html');
        if (cachedHtml) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = cachedHtml;
            cardBoxes = tempDiv.querySelectorAll('.char-box');
        }
    }

    if (cardBoxes.length === 0) return;

    let loadedCount = 0;
    cardBoxes.forEach(box => {
        const url = box.getAttribute('href');
        const name = box.querySelector('.char-name')?.textContent?.trim() || 'Custom Character';
        if (url) {
            const opt = document.createElement('option');
            opt.value = url;
            opt.textContent = name;
            if (url === currentValue) opt.selected = true;
            selectEl.appendChild(opt);
            loadedCount++;
        }
    });

    const statusEl = document.getElementById('calc-auto-status');
    if (statusEl && loadedCount > 0) {
        statusEl.innerText = `📦 ${loadedCount} Cards`;
    }
}

async function loadSelectedCardIntoCalculator() {
    const cardUrl = document.getElementById('calc-card-select').value;
    const statusEl = document.getElementById('calc-auto-status');
    
    if (!cardUrl) {
        if (statusEl) statusEl.innerText = "Manual Mode";
        return;
    }

    try {
        if (statusEl) statusEl.innerText = "⏳ Reading...";

        const res = await fetch(`${cardUrl}index.html?t=${Date.now()}`);
        if (!res.ok) throw new Error("Could not fetch character page.");

        const htmlText = await res.text();
        const doc = new DOMParser().parseFromString(htmlText, 'text/html');

        const getNum = (selector) => {
            const el = doc.querySelector(selector);
            if (!el) return 0;
            const txt = el.textContent || '';
            return parseInt(txt.replace(/[^0-9]/g, ''), 10) || 0;
        };

        let atk100 = getNum('#stat-atk-100');
        let def100 = getNum('#stat-def-100');
        let atk55  = getNum('#stat-atk-55');
        let def55  = getNum('#stat-def-55');

        cardParsedStats.rainbow100.atk = atk100 || 19995;
        cardParsedStats.rainbow100.def = def100 || 14869;
        cardParsedStats.hipo55.atk = atk55 || (cardParsedStats.rainbow100.atk - 3400);
        cardParsedStats.hipo55.def = def55 || (cardParsedStats.rainbow100.def - 3000);

        applyHipoPreset(currentHipoPreset);

        const charName = doc.querySelector('#char-name, #abs-char-name')?.textContent || 'Custom Character';
        const charTitle = doc.querySelector('#char-description, #abs-char-title')?.textContent || '';
        const charLeader = doc.querySelector('#leader-skill, #abs-leader-skill')?.textContent || '';
        const charPassName = doc.querySelector('.passive-name-display, #abs-passive-name')?.textContent?.replace(/^Passive Skill\s*-\s*/i, '') || '';
        
        const isLRHeader = htmlText.toLowerCase().includes('rarity_lr') || htmlText.toLowerCase().includes('mega-colossal');
        const thumbEl = doc.querySelector(isLRHeader ? '#img-lr' : '#img-tur') || doc.querySelector('#img-tur');
        const thumbSrc = thumbEl ? thumbEl.getAttribute('src') : '';

        const profileCard = document.getElementById('calc-char-profile-card');
        if (profileCard) {
            profileCard.style.display = 'block';
            document.getElementById('calc-char-name-text').innerText = charName;
            document.getElementById('calc-char-title-text').innerText = charTitle || 'Custom Character';
            document.getElementById('calc-char-leader-text').innerText = charLeader || 'No Leader Skill';
            if (thumbSrc) {
                const fixUrl = (src) => src.startsWith('http') ? src : `${cardUrl.replace(/\/$/, '')}/${src.replace(/^\.\//, '')}`;
                document.getElementById('calc-char-thumb').src = fixUrl(thumbSrc);
            }
        }

        const passTitleEl = document.getElementById('calc-passive-name-title');
        if (passTitleEl && charPassName) passTitleEl.innerText = charPassName;

        const isLR = htmlText.toLowerCase().includes('mega-colossal');
        toggleCalcRarity(isLR ? 'LR' : 'TUR', true);

        // Leader Skill Auto-Parse
        const leaderText = doc.querySelector('#leader-skill, #leader-desc')?.textContent || '';
        if (leaderText) {
            const dualLeadVal = parseLeaderSkillValue(leaderText);
            document.getElementById('calc-lead').value = dualLeadVal;
        }

        syncLeaderPillsFromInput();

        activeCharacterLinks = [];
        let detectedLinkKeys = new Set();
        const linkNodes = doc.querySelectorAll('#card-link-container a, #abs-link-container .abs-link-name');

        linkNodes.forEach(node => {
            const txt = node.textContent.trim().toLowerCase();
            if (txt && txt.length > 2) {
                Object.keys(DOKKAN_LINKS_LV10).forEach(key => {
                    if (txt === key || txt.includes(key)) detectedLinkKeys.add(key);
                });
            }
        });

        detectedLinkKeys.forEach(key => {
            activeCharacterLinks.push({
                key: key,
                name: key.toUpperCase(),
                active: true,
                atk: DOKKAN_LINKS_LV10[key].atk,
                def: DOKKAN_LINKS_LV10[key].def
            });
        });

        renderLinkSkillBadges();

        const domainWrapper = document.getElementById('acc-domain-wrapper');
        const activeWrapper = document.getElementById('acc-active-skill-wrapper');

        // --- SCAN ALL ACTIVE & DOMAIN BLOCKS ACROSS ALL CARD STYLES ---
        const activeBlocks = doc.querySelectorAll('.active-block, #card-active-container, #abs-active-container, .active-container, .domain-block, .domain-box, #card-domain-container, #abs-domain-container');

        let foundActiveTitle = '';
        let foundActiveDesc = '';
        let foundDomainTitle = '';
        let foundDomainDesc = '';

        activeBlocks.forEach(block => {
            const typeLabel = (block.querySelector('.active-type-label, .domain-type-label, b')?.textContent || '').toLowerCase();
            const name = block.querySelector('.active-display-name, .domain-display-name, #abs-active-title, #abs-domain-title, .active-title, .domain-title')?.textContent?.trim() || '';
            let effect = block.querySelector('.active-display-effect, .domain-display-effect, #abs-active-effect, #abs-domain-effect, .active-effect, .domain-effect')?.textContent?.trim() || '';

            if (!effect) {
                effect = block.textContent?.trim() || '';
            }

            if (typeLabel.includes('domain') || name.toLowerCase().includes('domain') || effect.toLowerCase().includes('domain effect')) {
                foundDomainTitle = name || "Domain Effect";
                foundDomainDesc = effect;
            } else if (effect && effect.length > 3) {
                if (!foundActiveDesc) {
                    foundActiveTitle = name || "Active Skill";
                    foundActiveDesc = effect;
                }
            }
        });

        if (!foundDomainDesc && foundActiveDesc.toLowerCase().includes('domain')) {
            foundDomainDesc = foundActiveDesc;
            foundDomainTitle = `${foundActiveTitle} (Domain Effect)`;
        }

        // 1. Cleanly Populate Domain Accordion
        if (foundDomainDesc) {
            if (domainWrapper) domainWrapper.style.display = 'block';
            
            document.getElementById('calc-domain-title').innerText = foundDomainTitle;
            document.getElementById('calc-domain-desc').innerHTML = parseDokkanIcons(foundDomainDesc);

            let domainAtkVal = 0;
            let domainDefVal = 0;

            const plusMatches = [...foundDomainDesc.matchAll(/(ATK\s*(?:&|and)\s*DEF|DEF\s*(?:&|and)\s*ATK|ATK|DEF)[^\d%]*\+\s*(\d+)%/gi)];
            plusMatches.forEach(m => {
                const typeStr = m[1].toUpperCase();
                const val = parseInt(m[2], 10);
                if (typeStr.includes('ATK') && typeStr.includes('DEF')) {
                    domainAtkVal += val;
                    domainDefVal += val;
                } else if (typeStr.includes('ATK')) {
                    domainAtkVal += val;
                } else if (typeStr.includes('DEF')) {
                    domainDefVal += val;
                }
            });

            document.getElementById('calc-domain-atk').value = domainAtkVal;
            document.getElementById('calc-domain-def').value = domainDefVal;
            document.getElementById('calc-domain-active').checked = false;
        } else if (domainWrapper) {
            document.getElementById('calc-domain-title').innerText = "Domain Effect";
            document.getElementById('calc-domain-desc').innerText = "Manual Domain Buff Input...";
            document.getElementById('calc-domain-atk').value = 0;
            document.getElementById('calc-domain-def').value = 0;
            document.getElementById('calc-domain-active').checked = false;
        }

        // 2. Cleanly Populate Active Skill Accordion
        if (foundActiveDesc && activeWrapper) {
            document.getElementById('calc-active-skill-title').innerText = foundActiveTitle;

            const lowActive = foundActiveDesc.toLowerCase();
            const isAttackActive = /causes\s+(ultimate|mega-colossal|colossal|immense|supreme|extreme)\s+damage/i.test(lowActive) || lowActive.includes('ultimate damage');

            const isAttackChk = document.getElementById('calc-active-is-attack');
            if (isAttackChk) isAttackChk.checked = isAttackActive;

            if (lowActive.includes('domain') && !isAttackActive) {
                document.getElementById('calc-active-skill-desc').innerHTML = parseDokkanIcons(`Activates Domain: <strong>${foundDomainTitle}</strong> (See 🌐 Domain Effect section below for domain buffs).`);
            } else {
                document.getElementById('calc-active-skill-desc').innerHTML = parseDokkanIcons(foundActiveDesc);
            }

            // Detect temporary ATK %
            let tempAtk = 0;
            if (lowActive.includes('massively raises atk temporarily')) tempAtk = 100;
            else if (lowActive.includes('greatly raises atk temporarily')) tempAtk = 50;
            else if (lowActive.includes('raises atk temporarily')) tempAtk = 30;
            else {
                const tempMatch = lowActive.match(/raises\s+atk[^\d%]*(\d+)%\s+temporarily/i);
                if (tempMatch) tempAtk = parseInt(tempMatch[1], 10);
            }
            
            const tempAtkInput = document.getElementById('calc-active-temp-atk');
            if (tempAtkInput) tempAtkInput.value = tempAtk;

            // Detect Active Skill SA Multiplier Type
            const activeSaTypeSel = document.getElementById('calc-active-sa-type');
            if (activeSaTypeSel) {
                if (lowActive.includes('ultimate damage')) activeSaTypeSel.value = "550";
                else if (lowActive.includes('mega-colossal')) activeSaTypeSel.value = "495";
                else if (lowActive.includes('immense')) activeSaTypeSel.value = "430";
                else activeSaTypeSel.value = "550";
            }

            // Multi-turn / Permanent Active Buffs
            let activeAtkVal = 0;
            let activeDefVal = 0;

            if (!lowActive.includes('domain')) {
                const activeAtkMatch = foundActiveDesc.match(/(?:for\s+\d+\s+turns|in\b)[^%\n]*ATK\s*\+\s*(\d+)%/i) || foundActiveDesc.match(/(?:for\s+\d+\s+turns|in\b)[^%\n]*ATK\s*&\s*DEF\s*\+\s*(\d+)%/i);
                const activeDefMatch = foundActiveDesc.match(/(?:for\s+\d+\s+turns|in\b)[^%\n]*DEF\s*\+\s*(\d+)%/i) || foundActiveDesc.match(/(?:for\s+\d+\s+turns|in\b)[^%\n]*ATK\s*&\s*DEF\s*\+\s*(\d+)%/i);
                if (activeAtkMatch) activeAtkVal = parseInt(activeAtkMatch[1], 10);
                if (activeDefMatch) activeDefVal = parseInt(activeDefMatch[1], 10);
            }

            document.getElementById('calc-active-atk').value = activeAtkVal;
            document.getElementById('calc-active-def').value = activeDefVal;
            document.getElementById('calc-active-skill-active').checked = false;

            activeWrapper.style.display = 'block';
        } else if (activeWrapper) {
            activeWrapper.style.display = 'none';
        }

        // Parse Passive Skill
        let pContainer = doc.querySelector('#card-passive-container, #abs-passive-container, .passive-container-main');
        if (pContainer) parseAndRenderInteractivePassiveCard(pContainer);

        let saBlocks = doc.querySelectorAll('#layout-dokkaninfo .sa-block, .sa-block');
        let saBlocksData = [];
        saBlocks.forEach((block, idx) => {
            const typeLabel = block.querySelector('.sa-type-label')?.textContent?.trim() || `SA ${idx + 1}`;
            const saName = block.querySelector('.sa-display-name')?.textContent?.trim() || `Skill ${idx + 1}`;
            const activationText = block.querySelector('.activation-text')?.textContent?.trim() || '';
            saBlocksData.push({ 
                typeLabel, 
                saName, 
                eff: parseSaEffect(block.textContent), 
                fullText: block.textContent,
                activationText 
            });
        });

        if (saBlocksData.length === 0) {
            saBlocksData = [{ typeLabel: isLR ? "Ultra SA" : "SA", saName: "Super Attack", eff: { atk: 30, def: 0 }, fullText: "", activationText: "" }];
        }

        window.lastParsedSaBlocksData = saBlocksData;
        renderDynamicSaRows(saBlocksData, isLR, false);

        if (statusEl) statusEl.innerText = `✅ Loaded 100% Rainbow`;
        calculateDokkanStats();

    } catch (err) {
        console.error("Parse Error:", err);
        if (statusEl) statusEl.innerText = "⚠️ Manual Mode";
    }
}

// --- SMART LEADER SKILL PARSER ---
function parseLeaderSkillValue(leaderText) {
    if (!leaderText) return 440;

    const options = leaderText.split(/;\s*or\s+|\s+or\s+/i);
    let maxOptionSingleLead = 0;

    options.forEach(opt => {
        let currentOptSum = 0;
        const matches = [...opt.matchAll(/(?:ATK\s*&\s*DEF|HP,\s*ATK\s*&\s*DEF|ATK|DEF)\s*\+\s*(\d+)%/gi)];
        matches.forEach(m => {
            const val = parseInt(m[1], 10);
            if (val <= 250) currentOptSum += val;
        });
        if (currentOptSum > maxOptionSingleLead) {
            maxOptionSingleLead = currentOptSum;
        }
    });

    return maxOptionSingleLead > 0 ? maxOptionSingleLead * 2 : 440;
}

// --- SMART EX CONDITION & PLACEMENT DETECTOR ---
function detectExCapabilities() {
    let hasExMain = false;
    let hasExAdd = false;
    let exSaBlockIdx = -1;
    let mainExBlockIdx = -1;
    let addExBlockIdx = -1;

    if (window.lastParsedSaBlocksData) {
        window.lastParsedSaBlocksData.forEach((sa, idx) => {
            const label = (sa.typeLabel || '').toLowerCase();
            const name = (sa.saName || '').toLowerCase();
            const full = (sa.fullText || '').toLowerCase();
            const act = (sa.activationText || '').toLowerCase();

            const isExBlock = /\bex\b/i.test(label) || /\bex\b/i.test(name) || /\bex\s+super\b/i.test(full);

            if (isExBlock) {
                if (exSaBlockIdx === -1) exSaBlockIdx = idx;

                const combinedText = (label + ' ' + name + ' ' + act + ' ' + full).toLowerCase();

                const mentionsMain = /1st attack|first attack|24 ki|12 or more ki|ultra super|when ki is|1st super attack|performs a critical hit|critical hit/i.test(combinedText);
                const mentionsAdd = /additional|launches an additional|when performing an additional|as an additional attack/i.test(combinedText);

                if (mentionsMain) {
                    hasExMain = true;
                    if (mainExBlockIdx === -1) mainExBlockIdx = idx;
                }
                if (mentionsAdd) {
                    hasExAdd = true;
                    if (addExBlockIdx === -1) addExBlockIdx = idx;
                }

                if (!mentionsMain && !mentionsAdd) {
                    hasExAdd = true;
                    if (addExBlockIdx === -1) addExBlockIdx = idx;
                }
            }
        });
    }

    if (window.interactivePassiveLines) {
        window.interactivePassiveLines.forEach(line => {
            const txt = (line.text || '').toLowerCase();
            const hdr = (line.sectionHeader || '').toLowerCase();
            const combined = hdr + ' ' + txt;

            if (/\bex\s+super\s+attack\b|\bex\s+sa\b|\bex\b/i.test(combined)) {
                const mentionsMain = /1st attack|first attack|24 ki|12 or more ki|ultra super|when ki is|1st super attack|critical hit/i.test(combined);
                const mentionsAdd = /additional|launches an additional|when performing an additional|as an additional attack/i.test(combined);

                if (mentionsMain) hasExMain = true;
                if (mentionsAdd) hasExAdd = true;

                if (!mentionsMain && !mentionsAdd && exSaBlockIdx !== -1) {
                    hasExAdd = true;
                }
            }
        });
    }

    if (mainExBlockIdx === -1) mainExBlockIdx = exSaBlockIdx;
    if (addExBlockIdx === -1) addExBlockIdx = exSaBlockIdx;

    return { 
        hasExMain, 
        hasExAdd, 
        hasAnyEx: (hasExMain || hasExAdd || exSaBlockIdx !== -1),
        exSaBlockIdx,
        mainExBlockIdx,
        addExBlockIdx
    };
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
        if (presetKey === '55') {
            hipoBoostInput.value = 30;
        } else if (presetKey === '100' || presetKey === '90' || presetKey === '79' || presetKey === '69') {
            hipoBoostInput.value = 75;
        }
    }

    if (presetKey === '55') {
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

    document.getElementById('calc-base-atk').value = atk;
    document.getElementById('calc-base-def').value = def;
}

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

// Calculates cumulative within-turn on-attack buffs for the N-th attack in the sequence
function getOnSaWithinTurnAtkForSeq(saSeq) {
    let total = 0;
    const attacksPerformedBeforeThis = Math.max(0, saSeq - 1);

    if (window.interactivePassiveLines) {
        window.interactivePassiveLines.forEach(line => {
            if (line.active && line.isOnSaWithinTurn && line.atkStep) {
                let step = line.atkStep * attacksPerformedBeforeThis;
                if (line.maxPctCap && line.maxPctCap > 0) {
                    step = Math.min(line.maxPctCap, step);
                }
                total += step;
            }
        });
    }
    return total;
}

window.togglePerAttackEx = function(idx) {
    window.exToggleState = window.exToggleState || {};
    window.exToggleState[idx] = !window.exToggleState[idx];
    calculateDokkanStats();
};

// --- EXACT DOKKAN STAT CALCULATION ENGINE ---
function calculateDokkanStats() {
    const baseAtkRaw = (parseFloat(document.getElementById('calc-base-atk').value) || 0) + (parseFloat(document.getElementById('calc-orb-atk').value) || 0);
    const baseDefRaw = (parseFloat(document.getElementById('calc-base-def').value) || 0) + (parseFloat(document.getElementById('calc-orb-def').value) || 0);

    const leadMult = 1 + ((parseFloat(document.getElementById('calc-lead').value) || 0) / 100);
    
    let sotAtkBase = parseFloat(document.getElementById('calc-sot-atk').value) || 0;
    let sotDefBase = parseFloat(document.getElementById('calc-sot-def').value) || 0;
    let p2AtkBase = parseFloat(document.getElementById('calc-p2-atk').value) || 0;
    let p2DefBase = parseFloat(document.getElementById('calc-p2-def').value) || 0;
    
    let extraPassiveDr = 0;
    let extraPassiveGuard = false;
    let passiveAdd12KiSaCount = 0;
    let passiveAddUltraSaCount = 0;

    // Active Counters Tracking
    let activeSaCounterLine = null;
    let activeNormalCounterLines = [];

    const hpVal = window.currentHpPercent || 100;

    if (window.interactivePassiveLines && window.interactivePassiveLines.length > 0) {
        window.interactivePassiveLines.forEach(line => {
            if (line.active) {
                if (line.isSaCounter) {
                    activeSaCounterLine = line;
                    return; // Skip adding to general Phase 1/Phase 2
                }
                if (line.isNormalCounter) {
                    if (line.counterCount > 0) activeNormalCounterLines.push(line);
                    return; // Skip adding to general Phase 1/Phase 2
                }

                let hpMult = 1;
                if (line.isHpInverse) hpMult = (100 - hpVal) / 99;
                else if (line.isHpDirect) hpMult = hpVal / 100;

                const count = line.isStacking ? line.stackCount : 1;
                let uncappedAtk = line.atkStep * count * hpMult;
                let uncappedDef = line.defStep * count * hpMult;

                if (line.maxPctCap && line.maxPctCap > 0) {
                    uncappedAtk = Math.min(line.maxPctCap, uncappedAtk);
                    uncappedDef = Math.min(line.maxPctCap, uncappedDef);
                }

                if (line.drVal > 0) extraPassiveDr += (line.drVal * count);
                if (line.hasGuard) extraPassiveGuard = true;

                if (line.isAdditionalUltraSa) passiveAddUltraSaCount += (line.addSaCount !== undefined ? line.addSaCount : count);
                else if (line.isAdditionalSa) passiveAdd12KiSaCount += (line.addSaCount !== undefined ? line.addSaCount : count);

                if (!line.isOnSaWithinTurn) {
                    if (line.phase === 'p2') { p2AtkBase += uncappedAtk; p2DefBase += uncappedDef; }
                    else { sotAtkBase += uncappedAtk; sotDefBase += uncappedDef; }
                }
            }
        });
    }

    const guardBox = document.getElementById('calc-guard');
    if (guardBox && extraPassiveGuard) guardBox.checked = true;

    const drInput = document.getElementById('calc-dr');
    if (drInput && extraPassiveDr > 0) {
        const curDr = parseFloat(drInput.value) || 0;
        if (curDr === 0) drInput.value = extraPassiveDr;
    }

    const hitSlider = document.getElementById('calc-hit-stacks-slider');
    const hitCount = parseFloat(hitSlider?.value) || 0;
    const hitStepAtk = window.parsedHitStackStepAtk || 0;
    const hitStepDef = window.parsedHitStackStepDef || 0;

    // STEP 1: BASE * LEADER
    let atkStep = Math.floor(baseAtkRaw * leadMult);
    let defStep = Math.floor(baseDefRaw * leadMult);

    // STEP 2: PHASE 1 PASSIVE
    const sotAtkMult = 1 + (sotAtkBase / 100);
    const sotDefMult = 1 + (sotDefBase / 100);
    atkStep = Math.floor(atkStep * sotAtkMult);
    defStep = Math.floor(defStep * sotDefMult);

    // STEP 3: DOMAIN BRACKET
    const rawDomainAtk = parseFloat(document.getElementById('calc-domain-atk')?.value) || 0;
    const rawDomainDef = parseFloat(document.getElementById('calc-domain-def')?.value) || 0;
    const domainActive = document.getElementById('calc-domain-active')?.checked || false;
    const domainAtkVal = domainActive ? rawDomainAtk : 0;
    const domainDefVal = domainActive ? rawDomainDef : 0;

    const domainAtkYield = document.getElementById('domain-atk-yield');
    const domainDefYield = document.getElementById('domain-def-yield');
    if (domainAtkYield) domainAtkYield.innerText = `+${rawDomainAtk}% ATK`;
    if (domainDefYield) domainDefYield.innerText = `+${rawDomainDef}% DEF`;

    const domainAtkMult = 1 + (domainAtkVal / 100);
    const domainDefMult = 1 + (domainDefVal / 100);
    atkStep = Math.floor(atkStep * domainAtkMult);
    defStep = Math.floor(defStep * domainDefMult);

    // STEP 4: LINK SKILLS
    const rawLinkAtk = parseFloat(document.getElementById('calc-link-atk')?.value) || 0;
    const rawLinkDef = parseFloat(document.getElementById('calc-link-def')?.value) || 0;
    const linkAtkMult = 1 + (rawLinkAtk / 100);
    const linkDefMult = 1 + (rawLinkDef / 100);

    const linkAtkYield = document.getElementById('link-atk-yield-text');
    const linkDefYield = document.getElementById('link-def-yield-text');
    if (linkAtkYield) linkAtkYield.innerText = `+${rawLinkAtk}% ATK`;
    if (linkDefYield) linkDefYield.innerText = `+${rawLinkDef}% DEF`;
    
    const atkStepBeforeKi = Math.floor(atkStep * linkAtkMult);
    const startOfTurnDef = Math.floor(defStep * linkDefMult);

    // STEP 5: ACTIVE SKILL & HIT STACKS
    const activeSkillActive = document.getElementById('calc-active-skill-active')?.checked || false;
    const activeIsAttack = document.getElementById('calc-active-is-attack')?.checked || false;

    const rawActiveTempAtk = parseFloat(document.getElementById('calc-active-temp-atk')?.value) || 0;
    const rawActiveTempDef = parseFloat(document.getElementById('calc-active-temp-def')?.value) || 0;
    const rawActiveTurnAtk = parseFloat(document.getElementById('calc-active-atk')?.value) || 0;
    const rawActiveTurnDef = parseFloat(document.getElementById('calc-active-def')?.value) || 0;

    const aTempAtkYield = document.getElementById('active-temp-atk-yield');
    const aTempDefYield = document.getElementById('active-temp-def-yield');
    const aTurnAtkYield = document.getElementById('active-turn-atk-yield');
    const aTurnDefYield = document.getElementById('active-turn-def-yield');
    if (aTempAtkYield) aTempAtkYield.innerText = `+${rawActiveTempAtk}% ATK`;
    if (aTempDefYield) aTempDefYield.innerText = `+${rawActiveTempDef}% DEF`;
    if (aTurnAtkYield) aTurnAtkYield.innerText = `+${rawActiveTurnAtk}% ATK`;
    if (aTurnDefYield) aTurnDefYield.innerText = `+${rawActiveTurnDef}% DEF`;

    const activeAtkVal = activeSkillActive ? rawActiveTurnAtk : 0;
    const activeDefVal = activeSkillActive ? rawActiveTurnDef : 0;

    // Sync SA effect yields
    for (let sIdx = 0; sIdx < 6; sIdx++) {
        const sAtkIn = document.getElementById(`calc-sa-atk-effect-${sIdx}`);
        const sDefIn = document.getElementById(`calc-sa-def-effect-${sIdx}`);
        const sAtkYield = document.getElementById(`sa-atk-eff-yield-${sIdx}`);
        const sDefYield = document.getElementById(`sa-def-eff-yield-${sIdx}`);
        if (sAtkIn && sAtkYield) sAtkYield.innerText = `+${parseFloat(sAtkIn.value) || 0}% ATK`;
        if (sDefIn && sDefYield) sDefYield.innerText = `+${parseFloat(sDefIn.value) || 0}% DEF`;
    }

    const totalP2Atk = p2AtkBase + (hitCount * hitStepAtk) + activeAtkVal;
    const totalP2Def = p2DefBase + (hitCount * hitStepDef) + activeDefVal;

    const p2DefMult = 1 + (totalP2Def / 100);

    // --- DEFENSE CALCULATION ---
    const saDefEffect1 = parseFloat(document.getElementById(`calc-sa-def-effect-0`)?.value) || 0;
    const prevSaStacks = parseInt(document.getElementById('calc-prev-sa-stacks')?.value || 0, 10);
    const extraSaDefStackBuff = saDefEffect1 * prevSaStacks;

    const saDefMult = 1 + ((saDefEffect1 + extraSaDefStackBuff) / 100);

    let postSuperDef = Math.floor(startOfTurnDef * p2DefMult);
    postSuperDef = Math.floor(postSuperDef * saDefMult);

    // --- ATTACK CALCULATION ---
    const currentKi = parseFloat(document.getElementById('calc-ki-slider')?.value) || 24;
    const isLR = (window.currentCalcRarity === 'LR');

    const ki24 = parseFloat(document.getElementById('calc-ki-mult-base')?.value) || (isLR ? 200 : 150);
    const ki12 = parseFloat(document.getElementById('calc-ki-mult-add')?.value) || (isLR ? 160 : ki24);

    let activeKiMult1 = 2.0;
    if (isLR) {
        const clampedKi = Math.max(12, Math.min(24, currentKi));
        activeKiMult1 = (ki12 + ((clampedKi - 12) / 12) * (ki24 - ki12)) / 100;
    } else {
        const clampedKi = Math.max(1, Math.min(12, currentKi));
        activeKiMult1 = (100 + ((clampedKi - 1) / 11) * (ki24 - 100)) / 100;
    }

    const saBlocksCount = window.parsedSaBlocksCount || 1;
    let mainSaIdx = 0;
    if (isLR && saBlocksCount >= 2) {
        mainSaIdx = (currentKi >= 18) ? 1 : 0;
    }

    let atkAfterKi = Math.floor(atkStepBeforeKi * activeKiMult1);

    const baseStackEffectAtk = parseFloat(document.getElementById(`calc-sa-atk-effect-0`)?.value) || 0;
    const prevStacksBuffAtk = baseStackEffectAtk * prevSaStacks;
    let currentTurnSaBuffAtk = 0;

    const exCaps = detectExCapabilities();
    const isExMain = window.exToggleState[0] !== undefined ? window.exToggleState[0] : (exCaps.hasExMain);
    const targetMainSaIdx = (isExMain && exCaps.mainExBlockIdx !== -1) ? exCaps.mainExBlockIdx : mainSaIdx;

    const saMult1 = getDynamicSaVal(targetMainSaIdx);
    const saAtkEffect1 = parseFloat(document.getElementById(`calc-sa-atk-effect-${targetMainSaIdx}`)?.value) || 0;
    const hipoBoost = parseFloat(document.getElementById('calc-sa-hipo-boost').value) || 0;

    // ACTIVE SKILL ATTACK OFFSETS TURN SEQUENCE POSITION IF PERFORMED BEFORE SAs
    let currentSaSeq = (activeSkillActive && activeIsAttack) ? 2 : 1;

    // STEP 7: PHASE 2 PASSIVE (1st SA)
    const firstAttackWithinTurnBuff = getOnSaWithinTurnAtkForSeq(currentSaSeq); 
    const firstAttackP2Mult = 1 + ((totalP2Atk + firstAttackWithinTurnBuff) / 100);
    let firstSuperAtk = Math.floor(atkAfterKi * firstAttackP2Mult);

    // STEP 8: SA MULTIPLIER BRACKET (1st SA)
    const totalFirstSaMult = saMult1 + hipoBoost + saAtkEffect1 + prevStacksBuffAtk + currentTurnSaBuffAtk;
    const finalFirstAtk = Math.floor(firstSuperAtk * (totalFirstSaMult / 100));
    currentTurnSaBuffAtk += saAtkEffect1;

    // Additional SA Calculation (2nd SA)
    const isExAdd = window.exToggleState[1] !== undefined ? window.exToggleState[1] : (exCaps.hasExAdd);
    
    const targetAddSaIdx = (isExAdd && exCaps.addExBlockIdx !== -1) ? exCaps.addExBlockIdx : 0;
    const targetAddSaBlock = (window.lastParsedSaBlocksData && targetAddSaIdx !== -1) ? window.lastParsedSaBlocksData[targetAddSaIdx] : null;
    const is24KiExAdd = targetAddSaBlock && (
        (targetAddSaBlock.typeLabel || '').toLowerCase().includes('24 ki') || 
        (targetAddSaBlock.fullText || '').toLowerCase().includes('24 ki')
    );
    
    const kiAddVal = isLR ? ki12 : ki24;
    const kiMultAdd = isExAdd ? (is24KiExAdd ? activeKiMult1 : (kiAddVal / 100)) : (kiAddVal / 100);
    
    const saMultAdd = getDynamicSaVal(targetAddSaIdx);
    const saAtkEffectAdd = parseFloat(document.getElementById(`calc-sa-atk-effect-${targetAddSaIdx}`)?.value) || 0;

    const secondAttackWithinTurnBuff = getOnSaWithinTurnAtkForSeq(currentSaSeq + 1); 
    const p2MultAdd = 1 + ((totalP2Atk + secondAttackWithinTurnBuff) / 100);
    let atkAdd = Math.floor(atkStepBeforeKi * kiMultAdd);
    atkAdd = Math.floor(atkAdd * p2MultAdd);
    
    const totalAddSaMult = saMultAdd + hipoBoost + saAtkEffectAdd + prevStacksBuffAtk + currentTurnSaBuffAtk;
    const finalAddAtkStat = Math.floor(atkAdd * (totalAddSaMult / 100));

    // --- STANDALONE ACTIVE SKILL ATTACK CALCULATION ---
    if (activeSkillActive && activeIsAttack) {
        const tempActiveAtk = parseFloat(document.getElementById('calc-active-temp-atk')?.value) || 0;
        const activeSaBase = parseFloat(document.getElementById('calc-active-sa-type')?.value) || 550;
        
        const activeKiMult = isLR ? (parseFloat(document.getElementById('calc-ki-mult-base')?.value) / 100 || 2.0) : 1.5;
        const activeP2Mult = 1 + ((totalP2Atk + getOnSaWithinTurnAtkForSeq(1)) / 100);
        
        let activeAtkBeforeSa = Math.floor(atkStepBeforeKi * activeKiMult);
        activeAtkBeforeSa = Math.floor(activeAtkBeforeSa * activeP2Mult);
        
        const activeTotalSaMult = activeSaBase + hipoBoost + tempActiveAtk;
        const finalActiveAtkStat = Math.floor(activeAtkBeforeSa * (activeTotalSaMult / 100));

        const activeDashCard = document.getElementById('res-active-skill-dash-card');
        if (activeDashCard) {
            activeDashCard.style.display = '';
            document.getElementById('res-active-atk-val').innerText = finalActiveAtkStat.toLocaleString();
            const multLabel = document.getElementById('res-active-sa-mult-info');
            if (multLabel) multLabel.innerText = `Active Skill | 📊 ${activeTotalSaMult}% Mult`;
        }
    } else {
        const activeDashCard = document.getElementById('res-active-skill-dash-card');
        if (activeDashCard) activeDashCard.style.display = 'none';
    }

    // --- SUPER ATTACK COUNTER CALCULATION (BEFORE VS AFTER SA TIMING) ---
    const isSaCounterTriggered = activeSaCounterLine !== null;
    let finalSaCounterAtkStat = 0;
    let counterTotalSaMult = 300;

    if (isSaCounterTriggered) {
        const counterBasePower = activeSaCounterLine.counterPower || 300;
        const counterTempAtk = activeSaCounterLine.counterTempAtk || 0;
        const triggerLabel = activeSaCounterLine.counterTriggerCat || "Super Attack";
        const timingMode = activeSaCounterLine.counterTiming || "after";

        // Counters use 100% (1.0x) Ki multiplier in Dokkan
        const counterKiMult = 1.0;
        
        // Before SA = Start of Turn (Phase 1) only, no Phase 2 on-attack buffs or within-turn SA buildup!
        // After SA = Gets Phase 2 on-attack buffs + within-turn SA buildup from performed SAs!
        let counterP2Mult = 1.0;
        if (timingMode === 'after') {
            const totalSAsPerformed = 1 + passiveAdd12KiSaCount + passiveAddUltraSaCount + (activeSkillActive && activeIsAttack ? 1 : 0);
            counterP2Mult = 1 + ((totalP2Atk + getOnSaWithinTurnAtkForSeq(totalSAsPerformed + 1)) / 100);
        } else {
            // Before SA Timing: Uses basic Phase 1 SoT without mid-attack Phase 2 buffs
            counterP2Mult = 1.0;
        }

        let counterAtkBeforeMult = Math.floor(atkStepBeforeKi * counterKiMult);
        counterAtkBeforeMult = Math.floor(counterAtkBeforeMult * counterP2Mult);

        counterTotalSaMult = counterBasePower + counterTempAtk;
        finalSaCounterAtkStat = Math.floor(counterAtkBeforeMult * (counterTotalSaMult / 100));

        const counterDashCard = document.getElementById('res-sa-counter-dash-card');
        if (counterDashCard) {
            counterDashCard.style.display = '';
            document.getElementById('res-sa-counter-atk-val').innerText = finalSaCounterAtkStat.toLocaleString();
            const counterMultLabel = document.getElementById('res-sa-counter-mult-info');
            if (counterMultLabel) {
                const timingText = timingMode === 'before' ? 'Before SA' : 'After SA';
                counterMultLabel.innerText = `${triggerLabel} Counter (${timingText}) | 📊 ${counterTotalSaMult}% Mult`;
            }
        }
    } else {
        const counterDashCard = document.getElementById('res-sa-counter-dash-card');
        if (counterDashCard) counterDashCard.style.display = 'none';
    }

    // --- NORMAL ATTACK COUNTERS CALCULATION ---
    const calculatedNormalCounters = [];
    activeNormalCounterLines.forEach(line => {
        if (line.counterCount > 0) {
            const counterKiMult = 1.0;
            const totalSAsPerformed = 1 + passiveAdd12KiSaCount + passiveAddUltraSaCount + (activeSkillActive && activeIsAttack ? 1 : 0);
            const counterP2Mult = 1 + ((totalP2Atk + getOnSaWithinTurnAtkForSeq(totalSAsPerformed + 1)) / 100);

            let counterAtkBeforeMult = Math.floor(atkStepBeforeKi * counterKiMult);
            counterAtkBeforeMult = Math.floor(counterAtkBeforeMult * counterP2Mult);

            const mult = line.counterPower || 300;
            const stat = Math.floor(counterAtkBeforeMult * (mult / 100));

            calculatedNormalCounters.push({
                count: line.counterCount,
                powerName: line.counterPowerName,
                mult: mult,
                stat: stat
            });
        }
    });

    // UI Output
    document.getElementById('res-sot-def').innerText = startOfTurnDef.toLocaleString();
    document.getElementById('res-post-def').innerText = postSuperDef.toLocaleString();
    document.getElementById('res-final-atk').innerText = finalFirstAtk.toLocaleString();

    const totalAdditionalSAs = passiveAdd12KiSaCount + passiveAddUltraSaCount;
    const addSaDashCard = document.getElementById('res-add-sa-dash-card');
    if (addSaDashCard) {
        if (totalAdditionalSAs > 0) {
            addSaDashCard.style.display = '';
            const addAtkValEl = document.getElementById('res-add-atk-val');
            if (addAtkValEl) addAtkValEl.innerText = finalAddAtkStat.toLocaleString();
        } else {
            addSaDashCard.style.display = 'none';
        }
    }

    const mainKiText = isLR ? `${currentKi} Ki` : `${Math.min(12, currentKi)} Ki`;
    const kiLabel = document.getElementById('res-final-ki-info');
    if (kiLabel) kiLabel.innerText = isExMain ? `1st SA (EX - ${mainKiText}) | 📊 ${totalFirstSaMult}% Mult` : `1st SA (${mainKiText}) | 📊 ${totalFirstSaMult}% Mult`;

    const activeIsCrit = window.calcCritEnabled || document.getElementById('calc-is-crit')?.checked || false;
    const activeIsSeat = window.calcSeEnabled || document.getElementById('calc-is-seat')?.checked || false;

    renderMultiAttackDamageDealtTable(
        atkStepBeforeKi, totalP2Atk, mainSaIdx, 0, 
        passiveAdd12KiSaCount, passiveAddUltraSaCount, hipoBoost, activeKiMult1, ki12, currentKi,
        activeIsCrit, 
        activeIsSeat,
        isSaCounterTriggered, finalSaCounterAtkStat, counterTotalSaMult, activeSaCounterLine?.counterTiming || 'after',
        calculatedNormalCounters
    );
    calculateDamageTaken(postSuperDef);
}

// --- RENDER MULTI-ATTACK BOSS DAMAGE TABLE ---
function renderMultiAttackDamageDealtTable(
    atkStepBeforeKi, baseP2Atk, mainSaIdx, addSaIdx, passiveAdd12KiSaCount, passiveAddUltraSaCount, 
    hipoBoost, activeKiMult1, ki12, currentKi, isCrit, isSEAT, 
    saCounterActive = false, saCounterAtkStat = 0, saCounterMult = 300, saCounterTiming = 'after',
    normalCounters = []
) {
    const tableContainer = document.getElementById('calc-boss-damage-rows');
    if (!tableContainer) return;

    const isCritActive = isCrit || window.calcCritEnabled || false;
    const isSeActive = isSEAT || window.calcSeEnabled || false;

    const bossDef = parseFloat(document.getElementById('calc-boss-def')?.value) || 0;
    const bossDrPct = parseFloat(document.getElementById('calc-boss-dr')?.value) || 0;

    const exCaps = detectExCapabilities();

    const bossType = (document.getElementById('calc-boss-type')?.value || 'AGL').toUpperCase();
    const bossClass = (document.getElementById('calc-boss-class')?.value || 'Extreme');
    const cardType = (window.currentCalcType || 'AGL').toUpperCase();
    const cardClass = (window.currentCalcClass || 'Super');

    const modObj = (window.getDokkanTypeAndClassMultiplier ? window.getDokkanTypeAndClassMultiplier(cardType, cardClass, bossType, bossClass, isCritActive, isSeActive) : { typeModifier: 1.0, guardModifier: 1.0, isAdvantage: false });
    let finalTypeMod = modObj.typeModifier;

    const prevSaStacks = parseInt(document.getElementById('calc-prev-sa-stacks')?.value || 0, 10);
    const baseStackEffectAtk = parseFloat(document.getElementById(`calc-sa-atk-effect-0`)?.value) || 0;
    const prevStacksBuffAtk = baseStackEffectAtk * prevSaStacks;
    
    let currentTurnSaBuffAtk = 0; 
    const activeSkillActive = document.getElementById('calc-active-skill-active')?.checked || false;
    const activeIsAttack = document.getElementById('calc-active-is-attack')?.checked || false;

    let currentSaSeq = (activeSkillActive && activeIsAttack) ? 2 : 1;
    let globalAtkIdx = 0;
    const isLR = (window.currentCalcRarity === 'LR');
    const saBlocksCount = window.parsedSaBlocksCount || 1;
    const attacks = [];

    // 1. SA Counter Before SA (if configured for Before SA timing)
    if (saCounterActive && saCounterAtkStat > 0 && saCounterTiming === 'before') {
        const triggerCategory = activeSaCounterLine?.counterTriggerCat || "Super Attack";
        attacks.push({
            idx: -2,
            label: `⚡ SA Counter (${triggerCategory} - Before SA)`,
            atkStat: saCounterAtkStat,
            totalSaMult: saCounterMult,
            canBeEx: false,
            isEx: false,
            count: 1
        });
    }

    // 2. Standalone Active Skill Attack (Position #1 if active)
    if (activeSkillActive && activeIsAttack) {
        const tempActiveAtk = parseFloat(document.getElementById('calc-active-temp-atk')?.value) || 0;
        const activeSaBase = parseFloat(document.getElementById('calc-active-sa-type')?.value) || 550;
        
        const activeKiMult = isLR ? (parseFloat(document.getElementById('calc-ki-mult-base')?.value) / 100 || 2.0) : 1.5;
        const activeP2Mult = 1 + ((baseP2Atk + getOnSaWithinTurnAtkForSeq(1)) / 100);
        
        let activeAtkBeforeSa = Math.floor(atkStepBeforeKi * activeKiMult);
        activeAtkBeforeSa = Math.floor(activeAtkBeforeSa * activeP2Mult);
        
        const activeTotalSaMult = activeSaBase + hipoBoost + tempActiveAtk;
        const finalActiveAtkStat = Math.floor(activeAtkBeforeSa * (activeTotalSaMult / 100));

        attacks.push({
            idx: -1,
            label: `💥 Active Skill Attack`,
            atkStat: finalActiveAtkStat,
            totalSaMult: activeTotalSaMult,
            canBeEx: false,
            isEx: false,
            count: 1
        });
    }

    // 3. 1st Super Attack
    const canBeExMain = exCaps.hasExMain;
    const isExMain = canBeExMain && (window.exToggleState[globalAtkIdx] !== undefined ? window.exToggleState[globalAtkIdx] : true);

    const targetMainSaIdx = isExMain && exCaps.mainExBlockIdx !== -1 ? exCaps.mainExBlockIdx : mainSaIdx;
    const saMult1 = getDynamicSaVal(targetMainSaIdx);
    const saAtkEffect1 = parseFloat(document.getElementById(`calc-sa-atk-effect-${targetMainSaIdx}`)?.value) || 0;

    const p2Buff1 = getOnSaWithinTurnAtkForSeq(currentSaSeq);
    const p2Mult1 = 1 + ((baseP2Atk + p2Buff1) / 100);
    let atk1 = Math.floor(atkStepBeforeKi * activeKiMult1);
    atk1 = Math.floor(atk1 * p2Mult1);
    
    const totalSaMult1 = saMult1 + hipoBoost + saAtkEffect1 + prevStacksBuffAtk + currentTurnSaBuffAtk;
    const atkStat1 = Math.floor(atk1 * (totalSaMult1 / 100));

    currentTurnSaBuffAtk += saAtkEffect1; 

    const mainKiText = isLR ? `${currentKi} Ki` : `${Math.min(12, currentKi)} Ki`;
    attacks.push({
        idx: globalAtkIdx,
        label: isExMain ? `1st SA [EX] (${mainKiText})` : (isLR ? (mainSaIdx === 1 ? `U. SA (${mainKiText})` : `12 Ki SA (${mainKiText})`) : `1st SA (${mainKiText})`),
        atkStat: atkStat1,
        totalSaMult: totalSaMult1,
        canBeEx: canBeExMain,
        isEx: isExMain,
        count: 1
    });

    // 4. Additional Ultra Super Attacks
    const ultraSaIdx = (saBlocksCount >= 2) ? 1 : 0;

    for (let u = 1; u <= passiveAddUltraSaCount; u++) {
        currentSaSeq++;
        globalAtkIdx++;
        
        const canBeExUltra = exCaps.hasExAdd;
        const isExUltra = canBeExUltra && (window.exToggleState[globalAtkIdx] !== undefined ? window.exToggleState[globalAtkIdx] : true);
        
        const targetUltraIdx = isExUltra && exCaps.addExBlockIdx !== -1 ? exCaps.addExBlockIdx : ultraSaIdx;
        const saMultUltra = getDynamicSaVal(targetUltraIdx);
        const saAtkEffectUltra = parseFloat(document.getElementById(`calc-sa-atk-effect-${targetUltraIdx}`)?.value) || 0;

        const p2BuffUltra = getOnSaWithinTurnAtkForSeq(currentSaSeq); 
        const p2MultUltra = 1 + ((baseP2Atk + p2BuffUltra) / 100);
        let atkUltra = Math.floor(atkStepBeforeKi * activeKiMult1);
        atkUltra = Math.floor(atkUltra * p2MultUltra);
        
        const totalSaMultUltra = saMultUltra + hipoBoost + saAtkEffectUltra + prevStacksBuffAtk + currentTurnSaBuffAtk;
        const atkStatUltra = Math.floor(atkUltra * (totalSaMultUltra / 100));
        currentTurnSaBuffAtk += saAtkEffectUltra; 

        attacks.push({
            idx: globalAtkIdx,
            label: isExUltra ? `Add. U. SA #${u} [EX]` : `Add. U. SA #${u}`,
            atkStat: atkStatUltra,
            totalSaMult: totalSaMultUltra,
            canBeEx: canBeExUltra,
            isEx: isExUltra,
            count: 1
        });
    }

    // 5. Additional 12-Ki / Regular SAs
    const saMultAddColossal = getDynamicSaVal(addSaIdx);
    const saAtkEffectAddColossal = parseFloat(document.getElementById(`calc-sa-atk-effect-0`)?.value) || 0;

    for (let i = 1; i <= passiveAdd12KiSaCount; i++) {
        currentSaSeq++;
        globalAtkIdx++;

        const canBeExThisAtk = exCaps.hasExAdd;
        const isExThisAtk = canBeExThisAtk && (window.exToggleState[globalAtkIdx] !== undefined ? window.exToggleState[globalAtkIdx] : true);
        
        const targetExIdx = exCaps.addExBlockIdx !== -1 ? exCaps.addExBlockIdx : ultraSaIdx;
        
        const targetExSaBlock = (window.lastParsedSaBlocksData && targetExIdx !== -1) ? window.lastParsedSaBlocksData[targetExIdx] : null;
        const is24KiExAdd = targetExSaBlock && (
            (targetExSaBlock.typeLabel || '').toLowerCase().includes('24 ki') || 
            (targetExSaBlock.fullText || '').toLowerCase().includes('24 ki')
        );

        const kiAddVal = isLR ? ki12 : ki24;
        const curKiMult = isLR ? (isExThisAtk ? (is24KiExAdd ? activeKiMult1 : (kiAddVal / 100)) : (kiAddVal / 100)) : (ki24 / 100);
        const curSaMult = isExThisAtk ? getDynamicSaVal(targetExIdx) : saMultAddColossal;
        const curSaEffect = isExThisAtk ? (parseFloat(document.getElementById(`calc-sa-atk-effect-${targetExIdx}`)?.value) || 0) : saAtkEffectAddColossal;

        const p2BuffAdd = getOnSaWithinTurnAtkForSeq(currentSaSeq); 
        const p2MultAdd = 1 + ((baseP2Atk + p2BuffAdd) / 100);
        let atkAdd = Math.floor(atkStepBeforeKi * curKiMult);
        atkAdd = Math.floor(atkAdd * p2MultAdd);
        
        const totalSaMultAdd = curSaMult + hipoBoost + curSaEffect + prevStacksBuffAtk + currentTurnSaBuffAtk;
        const atkStatAdd = Math.floor(atkAdd * (totalSaMultAdd / 100));
        currentTurnSaBuffAtk += curSaEffect; 

        const addLabelIndex = i + passiveAddUltraSaCount;
        attacks.push({
            idx: globalAtkIdx,
            label: isExThisAtk ? `Add. SA #${addLabelIndex} [EX]` : `Add. SA #${addLabelIndex}`,
            atkStat: atkStatAdd,
            totalSaMult: totalSaMultAdd,
            canBeEx: canBeExThisAtk,
            isEx: isExThisAtk,
            count: 1
        });
    }

    // 6. SA Counter After SA (if configured for After SA timing)
    if (saCounterActive && saCounterAtkStat > 0 && saCounterTiming === 'after') {
        const triggerCategory = activeSaCounterLine?.counterTriggerCat || "Super Attack";
        attacks.push({
            idx: -2,
            label: `⚡ SA Counter (${triggerCategory} - After SA)`,
            atkStat: saCounterAtkStat,
            totalSaMult: saCounterMult,
            canBeEx: false,
            isEx: false,
            count: 1
        });
    }

    // 7. Normal Attack Counters Rows
    normalCounters.forEach((nc, ncIdx) => {
        attacks.push({
            idx: -10 - ncIdx,
            label: `💥 Normal Counters (${nc.powerName} Power - ${nc.count}x)`,
            atkStat: nc.stat,
            totalSaMult: nc.mult,
            canBeEx: false,
            isEx: false,
            count: nc.count
        });
    });

    let htmlBuffer = '';
    let seqSaCount = 1;

    attacks.forEach((atk, atkIdx) => {
        let singleFinalDmg = window.calcEnemyDamage ? window.calcEnemyDamage(atk.atkStat, isCritActive, isSeActive) : atk.atkStat;
        let totalGroupDmg = singleFinalDmg * (atk.count || 1);

        // Derive clean short label (U. SA, 1 SA, 2 SA, 3 SA, etc.)
        let displayLabel = atk.label;
        const rawLow = atk.label.toLowerCase();
        
        if (atk.idx === 0) {
            if (rawLow.includes('ultra') || (isLR && currentKi >= 18)) {
                displayLabel = 'U. SA';
            } else {
                displayLabel = '1 SA';
                seqSaCount = 2;
            }
        } else if (atk.idx > 0) {
            displayLabel = `${seqSaCount} SA`;
            seqSaCount++;
        } else if (atk.idx === -1) {
            displayLabel = 'Active';
        } else if (atk.idx === -2 || atk.idx === -3) {
            displayLabel = 'SA Counter';
        } else if (atk.idx <= -10) {
            displayLabel = atk.count > 1 ? `Counter (${atk.count}x)` : 'Counter';
        }

        // Status pill with icons - CRIT and SUPER EFF
        let statusPillHtml = '';
        if (isCritActive && isSeActive) {
            statusPillHtml = `
                <div class="boss-status-pills-group">
                    <div class="boss-status-pill crit"><img src="https://abscustom.github.io/assets/images/st_critical_up.png" class="boss-pill-icon" alt="Crit"><span>CRIT</span></div>
                    <div class="boss-status-pill se"><img src="https://abscustom.github.io/assets/images/st_atk_super.png" class="boss-pill-icon" alt="Super Eff"><span>SUPER EFF</span></div>
                </div>
            `;
        } else if (isCritActive) {
            statusPillHtml = `<div class="boss-status-pill crit"><img src="https://abscustom.github.io/assets/images/st_critical_up.png" class="boss-pill-icon" alt="Crit"><span>CRIT</span></div>`;
        } else if (isSeActive || modObj.isAdvantage || modObj.typeModifier >= 1.25) {
            statusPillHtml = `<div class="boss-status-pill se"><img src="https://abscustom.github.io/assets/images/st_atk_super.png" class="boss-pill-icon" alt="Super Eff"><span>SUPER EFF</span></div>`;
        }

        htmlBuffer += `
            <div class="boss-damage-row">
                <div class="boss-row-label">${displayLabel}</div>
                ${statusPillHtml}
                <div class="boss-row-dmg-group">
                    <span class="boss-row-dmg-val">${totalGroupDmg.toLocaleString()} dmg</span>
                </div>
            </div>
        `;
    });

    tableContainer.innerHTML = htmlBuffer;
}

function calculateDamageTaken(playerDef) {
    const enemyAtk = parseFloat(document.getElementById('calc-enemy-atk').value) || 0;
    const drPct = parseFloat(document.getElementById('calc-dr').value) || 0;
    const isGuard = document.getElementById('calc-guard').checked;

    const drMult = 1 - (drPct / 100);
    const guardMult = isGuard ? 0.5 : 1.0;

    const rawDamage = (enemyAtk * drMult) - playerDef;
    const finalDamage = Math.max(0, rawDamage * guardMult);

    const displayEl = document.getElementById('res-damage-taken');
    if (!displayEl) return;

    if (finalDamage <= 0) {
        displayEl.innerText = "< 100";
        displayEl.style.color = "#34d399";
    } else {
        displayEl.innerText = Math.floor(finalDamage).toLocaleString();
        displayEl.style.color = "#f87171";
    }
}

window.addEventListener('DOMContentLoaded', () => {
    syncLeaderPillsFromInput();
    calculateDokkanStats();
});