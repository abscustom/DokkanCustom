/* ==========================================================================
   absCustom - Dokkan Stat Calculator: Interactive Passive Parser
   ========================================================================== */

window.DAMAGE_DEALT_SVG = window.DAMAGE_DEALT_SVG || `<svg class="dmg-dealt-icon-svg" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M24.6977 16.1325L18.2502 13.75L15.8752 7.2975C15.7346 6.91541 15.4801 6.58566 15.1461 6.35273C14.8122 6.11981 14.4149 5.99492 14.0077 5.99492C13.6005 5.99492 13.2032 6.11981 12.8692 6.35273C12.5353 6.58566 12.2808 6.91541 12.1402 7.2975L9.7502 13.75L3.2977 16.125C2.91561 16.2656 2.58586 16.5201 2.35293 16.854C2.12001 17.188 1.99512 17.5853 1.99512 17.9925C1.99512 18.3997 2.12001 18.797 2.35293 19.131C2.58586 19.4649 2.91561 19.7194 3.2977 19.86L9.7502 22.25L12.1252 28.7025C12.2658 29.0846 12.5203 29.4143 12.8542 29.6473C13.1882 29.8802 13.5855 30.0051 13.9927 30.0051C14.3999 30.0051 14.7972 29.8802 15.1311 29.6473C15.4651 29.4143 15.7196 29.0846 15.8602 28.7025L18.2502 22.25L24.7027 19.875C25.0848 19.7344 25.4145 19.4799 25.6475 19.146C25.8804 18.812 26.0053 18.4147 26.0053 18.0075C26.0053 17.6003 25.8804 17.203 25.6475 16.869C25.4145 16.5351 25.0848 16.2806 24.7027 16.14L24.6977 16.1325ZM17.1252 20.5275C16.9895 20.5775 16.8662 20.6564 16.7639 20.7587C16.6616 20.861 16.5827 20.9843 16.5327 21.12L14.0002 27.9813L11.4727 21.125C11.4228 20.9878 11.3434 20.8633 11.2402 20.76C11.1369 20.6568 11.0124 20.5774 10.8752 20.5275L4.01895 18L10.8752 15.4725C11.0124 15.4226 11.1369 15.3432 11.2402 15.24C11.3434 15.1367 11.4228 15.0122 11.4727 14.875L14.0002 8.01875L16.5277 14.875C16.5777 15.0107 16.6566 15.134 16.7589 15.2363C16.8612 15.3386 16.9845 15.4175 17.1202 15.4675L23.9814 18L17.1252 20.5275ZM18.0002 5C18.0002 4.73478 18.1056 4.48043 18.2931 4.29289C18.4806 4.10536 18.735 4 19.0002 4H21.0002V2C21.0002 1.73478 21.1056 1.48043 21.2931 1.29289C21.4806 1.10536 21.735 1 22.0002 1C22.2654 1 22.5198 1.10536 22.7073 1.29289C22.8948 1.48043 23.0002 1.73478 23.0002 2V4H25.0002C25.2654 4 25.5198 4.10536 25.7073 4.29289C25.8948 4.48043 26.0002 4.73478 26.0002 5C26.0002 5.26522 25.8948 5.51957 25.7073 5.70711C25.5198 5.89464 25.2654 6 25.0002 6H23.0002V8C23.0002 8.26522 22.8948 8.51957 22.7073 8.70711C22.5198 8.89464 22.2654 9 22.0002 9C21.735 9 21.4806 8.89464 21.2931 8.70711C21.1056 8.51957 21.0002 8.26522 21.0002 8V6H19.0002C18.735 6 18.4806 5.89464 18.2931 5.70711C18.1056 5.51957 18.0002 5.26522 18.0002 5ZM31.0002 11C31.0002 11.2652 30.8948 11.5196 30.7073 11.7071C30.5198 11.8946 30.2654 12 30.0002 12H29.0002V13C29.0002 13.2652 28.8948 13.5196 28.7073 13.7071C28.5198 13.8946 28.2654 14 28.0002 14C27.735 14 27.4806 13.8946 27.2931 13.7071C27.1056 13.5196 27.0002 13.2652 27.0002 13V12H26.0002C25.735 12 25.4806 11.8946 25.2931 11.7071C25.1056 11.5196 25.0002 11.2652 25.0002 11C25.0002 10.7348 25.1056 10.4804 25.2931 10.2929C25.4806 10.1054 25.735 10 26.0002 10H27.0002V9C27.0002 8.73478 27.1056 8.48043 27.2931 8.29289C27.4806 8.10536 27.735 8 28.0002 8C28.2654 8 28.5198 8.10536 28.7073 8.29289C28.8948 8.48043 29.0002 8.73478 29.0002 9V10H30.0002C30.2654 10 30.5198 10.1054 30.7073 10.2929C30.8948 10.4804 31.0002 10.7348 31.0002 11Z" fill="#f87171"/></svg>`;

function formatStatSummaryPills(atk, def, dr, hasGuard) {
    const parts = [];
    if (atk !== 0) {
        const cls = atk < 0 ? 'stat-neg' : 'stat-pos';
        parts.push(`<span class="${cls}">${atk > 0 ? '+' : ''}${atk}% ATK</span>`);
    }
    if (def !== 0) {
        const cls = def < 0 ? 'stat-neg' : 'stat-pos';
        parts.push(`<span class="${cls}">${def > 0 ? '+' : ''}${def}% DEF</span>`);
    }
    if (dr !== 0) {
        const cls = dr < 0 ? 'stat-neg' : 'stat-dr';
        parts.push(`<span class="${cls}">${dr > 0 ? '+' : ''}${dr}% DR</span>`);
    }
    if (hasGuard) {
        parts.push(`<span class="stat-guard">Guard</span>`);
    }
    return parts.join(' <span style="color:rgba(255,255,255,0.25); margin:0 3px;">•</span> ');
}

function setPassiveViewMode(mode) {
    window.currentPassiveViewMode = mode;
    document.querySelectorAll('[id^="pass-mode-"]').forEach(btn => btn.classList.remove('active'));
    const btn = document.getElementById(`pass-mode-${mode}`);
    if (btn) btn.classList.add('active');
    renderPassiveLinesByCurrentViewMode();
}

function refreshPassiveHpYieldsInPlace() {
    const hpVal = window.currentHpPercent || 100;
    if (!window.interactivePassiveLines) return;

    window.interactivePassiveLines.forEach(line => {
        if (!line.isHpInverse && !line.isHpDirect) return;
        const yieldEl = document.getElementById(`calc-pass-yield-${line.idx}`);
        if (!yieldEl) return;

        let hpMult = 1;
        if (line.isHpInverse) hpMult = (100 - hpVal) / 99;
        else if (line.isHpDirect) hpMult = hpVal / 100;

        let totalAtk = Math.round(line.atkStep * (line.isStacking ? line.stackCount : 1) * hpMult);
        let totalDef = Math.round(line.defStep * (line.isStacking ? line.stackCount : 1) * hpMult);
        let totalDr = Math.round((line.drStep || 0) * (line.isStacking ? line.stackCount : 1));

        if (line.maxPctCap && line.maxPctCap > 0) {
            totalAtk = Math.min(line.maxPctCap, totalAtk);
            totalDef = Math.min(line.maxPctCap, totalDef);
            if (totalDr > 0) totalDr = Math.min(line.maxPctCap, totalDr);
        } else if (line.maxPctCap && line.maxPctCap < 0) {
            if (totalDr < 0) totalDr = Math.max(line.maxPctCap, totalDr);
        }

        let stackUnitText = 'attacks';
        if (line.stackType === 'ki_sphere') stackUnitText = 'orbs';
        else if (line.stackType === 'ally') stackUnitText = 'allies';
        else if (line.stackType === 'enemy') stackUnitText = 'enemies';
        else if (line.stackType === 'turns') stackUnitText = (line.stackCount === 1 ? 'turn' : 'turns');

        const summaryHtml = formatStatSummaryPills(totalAtk, totalDef, totalDr, line.hasGuard);
        yieldEl.innerHTML = `${summaryHtml} ${line.isStacking ? `<span style="color: #94a3b8; font-weight:700;">(${line.stackCount} ${stackUnitText})</span>` : ''}`;
    });
}

function updatePassiveHpSlider(val) {
    window.currentHpPercent = parseInt(val, 10) || 100;
    const txt1 = document.getElementById('calc-passive-hp-val');
    if (txt1) txt1.innerText = `${window.currentHpPercent}%`;
    refreshPassiveHpYieldsInPlace();
    if (typeof calculateDokkanStats === 'function') calculateDokkanStats();
}

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

            const clauses = rawText.split(/(?:,\s*plus\s+an\s+additional|;\s*plus\s+an\s+additional|\.\s*plus\s+an\s+additional|;\s*and\s+plus\s+an\s+additional|;\s*and\s+an\s+additional)/i);

            clauses.forEach((clauseText, cIdx) => {
                const itemText = (cIdx > 0 ? "Plus an additional " : "") + clauseText.trim();
                const itemLower = itemText.toLowerCase();
                const fullContext = (headerText + " " + itemText).toLowerCase();

                const isSaCounter = /countering with (?:tremendous|extraordinary|supreme|ferocious|enormous) power|counters? with (?:tremendous|extraordinary|supreme|ferocious|enormous) power/i.test(fullContext) &&
                                    (/when receiving (?:an? )?[^,\.]*?super attack/i.test(fullContext) || fullContext.includes('nullifies'));

                const isNormalCounter = !isSaCounter && /counters? with (?:tremendous|extraordinary|supreme|ferocious|enormous) power/i.test(fullContext);

                let counterTempAtk = 0;
                let counterPower = 300;
                let counterPowerName = "Tremendous";
                let counterTriggerCat = "Super Attack";

                if (isSaCounter || isNormalCounter) {
                    if (fullContext.includes('ferocious power')) { counterPower = 400; counterPowerName = "Ferocious"; counterTempAtk = 100; }
                    else if (fullContext.includes('extraordinary power')) { counterPower = 200; counterPowerName = "Extraordinary"; }
                    else if (fullContext.includes('enormous power')) { counterPower = 150; counterPowerName = "Enormous"; }
                    else if (fullContext.includes('supreme power')) { counterPower = 300; counterPowerName = "Supreme"; }
                    else { counterPower = 300; counterPowerName = "Tremendous"; }

                    if (isSaCounter) {
                        if (fullContext.includes('massively raises atk')) counterTempAtk = 100;
                        else if (fullContext.includes('greatly raises atk')) counterTempAtk = 50;
                        else if (fullContext.includes('raises atk')) counterTempAtk = 30;
                        else {
                            const tempAtkMatch = fullContext.match(/atk[^\d%]*(\d+)%/i) || fullContext.match(/(\d+)%\s*up/i);
                            if (tempAtkMatch) counterTempAtk = parseInt(tempAtkMatch[1], 10);
                        }

                        if (fullContext.includes('ki blast super attack') || fullContext.includes('ki blast')) counterTriggerCat = "Ki Blast SA";
                        else if (fullContext.includes('unarmed super attack') || fullContext.includes('unarmed')) counterTriggerCat = "Unarmed SA";
                        else if (fullContext.includes('melee super attack') || fullContext.includes('melee')) counterTriggerCat = "Melee SA";
                        else if (fullContext.includes('weapon super attack') || fullContext.includes('weapon')) counterTriggerCat = "Weapon SA";
                    } else {
                        counterTriggerCat = "Normal Attack";
                    }
                }

                const isEnemyDebuff = /lowers?\s+(?:attacked\s+)?enem(?:y|ies)|reduces?\s+(?:attacked\s+)?enem(?:y|ies)|seals?\s+(?:the\s+)?(?:attacked\s+)?enemy|stuns?\s+(?:the\s+)?(?:attacked\s+)?enemy|enem(?:y|ies)'?\s+(?:atk|def)\s*(?:-|down|lower)/i.test(itemLower);
                const isEnemyTargeted = !isSaCounter && !isNormalCounter && isEnemyDebuff && !/evad|dodg|guard|nullif|counter|receiv|reduc.*damage/i.test(itemLower);

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
                        if (!currentCharName.includes(requiredName)) isAllySupportOnly = true;
                    }
                }

                let drVal = 0, drStep = 0;
                let isDrNeg = /damage\s+reduction\s+rate\s*\d+%\s*down|reduces?\s+damage\s+reduction\s+rate|damage\s+reduction.*-\d+%/i.test(fullContext);
                const drMatch = itemText.match(/(?:reduces?\s+damage\s+received\s+by|damage\s+reduction\s+rate\s*(?:\+|by)?|damage\s+reduction\s*(?:\+|by)?)\s*(\d+)%/i);
                if (!isEnemyTargeted && drMatch && !isAllySupportOnly) {
                    drStep = parseInt(drMatch[1], 10);
                    if (isDrNeg) drStep = -Math.abs(drStep);
                    drVal = drStep;
                }

                // --- ACCURATE PER-ALLY vs BINARY ENTRANCE DETECTOR ---
                // Must explicitly contain 'per ... ally' or 'for each ... ally' in the item text itself!
                const isStrictPerAlly = /\b(?:per|for\s+each|for\s+every|with\s+each)\s+.*?(?:category\s+)?all(?:y|ies)\b/i.test(itemText) ||
                                        /\b(?:per|for\s+each|for\s+every)\s+.*?(?:category\s+)?all(?:y|ies)\s+on\s+the\s+team\b/i.test(itemText);
                
                // Binary conditions like "when there is another ... ally on the team upon entry" are NEVER per-ally stacking!
                const isBinaryAllyCondition = /\b(?:when|if)\s+there\s+is\s+(?:another|an?)\b.*?\ball(?:y|ies)\b/i.test(fullContext);

                const isPerAllyTeamBuff = isStrictPerAlly && !isBinaryAllyCondition;

                const isDomainActivePassive = /when the domain|when a domain|while a domain/i.test(fullContext);
                const isOrbThresholdBuff = /\d+\s+or\s+more\s+.*ki\s+spheres?/i.test(fullContext);

                const isMidBattleBuildup = /per attack received|per attack evaded|after receiving|after evading|per attack performed|per attack launched|each attack received|each attack performed|upon receiving|when receiving|for every attack received|for every attack evaded|for every (?:super )?attack (?:the )?enemy (?:launches|performs|makes)|for each (?:super )?attack (?:the )?enemy (?:launches|performs|makes)/i.test(fullContext);
                // Conditions such as "When attacking with 12 or more Ki" are
                // section headers, so every stat line in that section belongs
                // to the attacking (Phase 2) calculation.
                const isAttackTriggered = /\bwhen\s+(?:performing\s+(?:an?\s+)?(?:ultra\s+)?super\s+attack|attacking)\b/i.test(fullContext);
                const isOnAttackPhase2 = !isPerAllyTeamBuff && isAttackTriggered;

                const isPhase2 = !isPerAllyTeamBuff && !isAllySupportOnly && !isDomainActivePassive && !isOrbThresholdBuff && (isMidBattleBuildup || isOnAttackPhase2);
                const isConditional = condRegexFilter.test(headerText + " " + itemText);
                const isOneTurn = fullContext.includes('for 1 turn') || fullContext.includes('within the turn') || fullContext.includes('for the turn');

                // DETECT ADDITIONAL SUPER ATTACKS
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
                    itemLower.includes('attacks an additional time') ||
                    itemLower.includes('performs an additional attack') ||
                    itemLower.includes('launches 2 additional') || 
                    itemLower.includes('launches 3 additional') ||
                    itemLower.includes('launches up to 2 additional') ||
                    itemLower.includes('launches up to 3 additional') ||
                    itemLower.includes('launches up to 4 additional') ||
                    itemLower.includes('additional attack') ||
                    itemLower.includes('additional attacks')
                );
                const isAdditionalSa = isAdditionalUltraSa || isAdditional12KiSa;

                let addSaMax = 1;
                if (isAdditionalSa) {
                    const upToMatch = fullContext.match(/\bup\s+to\s+(\d+|two|three|four|five)\s*(?:times|attacks|super attacks)?\b/i);
                    const launchesMatch = fullContext.match(/launches\s+(?:up\s+to\s+)?(\d+|two|three|four|five)\s+additional\s+attacks?/i) ||
                                          fullContext.match(/(\d+|two|three|four|five)\s+additional\s+(?:super\s+)?attacks?/i);

                    const targetCountMatch = upToMatch || launchesMatch;
                    if (targetCountMatch) {
                        const valStr = targetCountMatch[1].toLowerCase();
                        if (valStr === 'two' || valStr === '2') addSaMax = 2;
                        else if (valStr === 'three' || valStr === '3') addSaMax = 3;
                        else if (valStr === 'four' || valStr === '4') addSaMax = 4;
                        else if (valStr === 'five' || valStr === '5') addSaMax = 5;
                        else addSaMax = parseInt(valStr, 10) || 1;
                    }
                }

                const isProgressiveWithinTurnBuildup = /\b(?:per|each|for\s+every|with\s+each)\s+(?:super\s+)?attacks?\s+(?:performed|launched|made|delivered)?\b.*?\b(?:within\s+the\s+turn|for\s+the\s+turn)\b/i.test(fullContext) ||
                                                      /\b(?:within\s+the\s+turn|for\s+the\s+turn)\b.*?\b(?:per|each|for\s+every|with\s+each)\s+(?:super\s+)?attacks?\b/i.test(fullContext);
                const isOnSaWithinTurn = !isSaCounter && !isNormalCounter && !isEnemyTargeted && !isAllySupportOnly && isProgressiveWithinTurnBuildup;

                // EXTRACT ACCURATE ATK & DEF STAT VALUE
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

                const stepVal = Math.max(Math.abs(atkVal), Math.abs(defVal), Math.abs(drStep));
                const maxPctMatch = fullContext.match(/\bup\s+to\s+([+-]?\d+)%/i) || fullContext.match(/no\s+more\s+than\s+([+-]?\d+)%/i);
                const maxTimesMatch = fullContext.match(/\bup\s+to\s+(\d+)\s*(?:times|attacks|super attacks|ki|turns|events|triggers|orbs|spheres)\b/i);
                // Repeated triggers without a one-time or "up to" limit can stack forever.
                // Check the whole section because Dokkan text commonly puts the trigger in its header
                // and the actual stat increase on the line below it.
                const hasOneTimeLimit = /\b(?:only\s+)?once\b|\b(?:first|one)\s+time\b/i.test(fullContext);
                const hasRepeatableCombatOrTurnTrigger = /\bat\s+(?:the\s+)?start\s+of\s+(?:each|every)\s+turn\b|\b(?:for|with|per)\s+(?:each|every)\s+(?:super\s+)?attack\b|\beach\s+(?:super\s+)?attack\b|\b(?:for|with|per)\s+(?:each|every)\s+turn\b|\beach\s+time\b|\bper\s+(?:super\s+)?attack\b/i.test(fullContext);
                const isUncappedRepeatStack = hasRepeatableCombatOrTurnTrigger && !hasOneTimeLimit;

                let isStacking = false; 
                let maxSteps = 1; 
                let maxPctCap = 0; 
                let stackType = 'turns';

                if (isPerAllyTeamBuff) {
                    isStacking = true;
                    stackType = 'ally';
                    maxSteps = 6;
                    if (maxPctMatch && stepVal > 0) {
                        maxPctCap = parseInt(maxPctMatch[1], 10);
                        maxSteps = Math.max(1, Math.ceil(Math.abs(maxPctCap) / stepVal));
                    }
                } else if (!isHpInverse && !isHpDirect && !isEnemyTargeted && !isSaCounter && !isNormalCounter) {
                    if (maxPctMatch && stepVal > 0) {
                        maxPctCap = parseInt(maxPctMatch[1], 10);
                        maxSteps = Math.max(1, Math.ceil(Math.abs(maxPctCap) / stepVal));
                        isStacking = true;
                    } else if (maxTimesMatch) {
                        maxSteps = Math.min(99, parseInt(maxTimesMatch[1], 10));
                        isStacking = true;
                    } else if (!isOneTurn && !isAllySupportOnly && isUncappedRepeatStack) {
                        // There is no in-game cap to simulate, so provide the same 0-99 selector
                        // used elsewhere in the calculator rather than a binary on/off toggle.
                        isStacking = true;
                        maxSteps = 99;
                    }
                }

                if (!isPerAllyTeamBuff) {
                    if (/\bki sphere\b|\borbs\b/i.test(fullContext)) {
                        stackType = 'ki_sphere';
                    } else if (/\bper enemy\b|\benemies present\b|\bfor each enemy\b/i.test(fullContext)) {
                        stackType = 'enemy';
                    } else if (
                        /\bturn\s+passed\b|\bturns\s+passed\b|\beach\s+turn\b|\bevery\s+turn\b|\bstart\s+of\s+each\s+turn\b|\bstart\s+of\s+every\s+turn\b|\bfor\s+every\s+\d+\s+turns?\b|\bfor\s+every\s+turn\b|\bper\s+turn\b/i.test(fullContext)
                    ) {
                        stackType = 'turns';
                    } else {
                        stackType = 'attacks';
                    }
                }

                const hasGuard = !isEnemyTargeted && !isAllySupportOnly && /guards?\s+all\s+attacks|guard\s+against\s+all\s+attacks/i.test(itemText);
                const hasStatImpact = isSaCounter || isNormalCounter || (!isEnemyTargeted && !isAllySupportOnly && (atkVal !== 0 || defVal !== 0 || drStep !== 0 || hasGuard || isAdditionalSa));

           
                // Additional attacks default to active
                const defaultActive = isAdditionalSa || isPerAllyTeamBuff || isBinaryAllyCondition || (!isConditional && !isAllySupportOnly && !isEnemyTargeted && !isSaCounter && !isNormalCounter);
                const initialStackCount = isStacking ? (stackType === 'ally' ? maxSteps : (maxPctCap ? maxSteps : 1)) : 1;

                window.interactivePassiveLines.push({
                    idx: globalLineIdx, 
                    sectionHeader: headerText, 
                    text: itemText,
                    atkStep: (isAllySupportOnly || isEnemyTargeted || isSaCounter || isNormalCounter) ? 0 : atkVal, 
                    defStep: (isAllySupportOnly || isEnemyTargeted || isSaCounter || isNormalCounter) ? 0 : defVal,
                    drStep: (isAllySupportOnly || isEnemyTargeted) ? 0 : drStep,
                    isHpInverse, isHpDirect, drVal, hasGuard, isAdditionalSa, isAdditionalUltraSa, addSaMax, addSaCount: addSaMax,
                    isOnSaWithinTurn, hasStatImpact, stackCount: initialStackCount, maxSteps, maxPctCap, stackType, isStacking,
                    phase: isPhase2 ? 'p2' : 'sot', active: defaultActive,
                    isConditional, isAllySupportOnly, isEnemyTargeted,
                    isSaCounter, isNormalCounter, counterTempAtk, counterPower, counterPowerName, counterTriggerCat,
                    counterCount: isNormalCounter ? 0 : 1, counterTiming: 'after'
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
        if (typeof calculateDokkanStats === 'function') calculateDokkanStats();
    }
}

function toggleSaCounterTiming(idx) {
    if (window.interactivePassiveLines[idx]) {
        const curTiming = window.interactivePassiveLines[idx].counterTiming || 'after';
        window.interactivePassiveLines[idx].counterTiming = (curTiming === 'after') ? 'before' : 'after';
        renderPassiveLinesByCurrentViewMode();
        if (typeof calculateDokkanStats === 'function') calculateDokkanStats();
    }
}

function updateNormalCounterCount(idx) {
    const sel = document.getElementById(`calc-pass-counter-${idx}`);
    if (window.interactivePassiveLines[idx] && sel) {
        const cnt = parseInt(sel.value, 10);
        window.interactivePassiveLines[idx].counterCount = cnt;
        window.interactivePassiveLines[idx].active = (cnt > 0);
        renderPassiveLinesByCurrentViewMode();
        if (typeof calculateDokkanStats === 'function') calculateDokkanStats();
    }
}

function togglePassiveLineTrigger(idx) {
    const box = document.getElementById(`calc-pass-line-${idx}`);
    if (window.interactivePassiveLines[idx] && box) {
        window.interactivePassiveLines[idx].active = box.checked;
        renderPassiveLinesByCurrentViewMode();
        if (typeof calculateDokkanStats === 'function') calculateDokkanStats();
    }
}

function updatePassiveStackTrigger(idx) {
    const sel = document.getElementById(`calc-pass-stack-${idx}`);
    if (window.interactivePassiveLines[idx] && sel) {
        const cnt = parseInt(sel.value, 10);
        window.interactivePassiveLines[idx].stackCount = cnt;
        window.interactivePassiveLines[idx].active = (cnt > 0);
        renderPassiveLinesByCurrentViewMode();
        if (typeof calculateDokkanStats === 'function') calculateDokkanStats();
    }
}

function updatePassiveAddSaTrigger(idx) {
    const sel = document.getElementById(`calc-pass-addsa-${idx}`);
    if (window.interactivePassiveLines[idx] && sel) {
        const cnt = parseInt(sel.value, 10);
        window.interactivePassiveLines[idx].addSaCount = cnt;
        window.interactivePassiveLines[idx].active = (cnt > 0);
        renderPassiveLinesByCurrentViewMode();
        if (typeof calculateDokkanStats === 'function') calculateDokkanStats();
    }
}

function renderPassiveLinesByCurrentViewMode() {
    const containerEl = document.getElementById('calc-passive-lines-container');
    if (!containerEl) return;

    const mode = window.currentPassiveViewMode || 'full';
    const tab = window.currentCalcTab || 'atk';
    let htmlBuffer = '';

    if (window.passiveHasHpScaling) {
        htmlBuffer += `
            <div style="background: rgba(15, 23, 42, 0.65); padding: 10px 14px; border-radius: 12px; margin-bottom: 12px; border: 1px solid rgba(56, 189, 248, 0.35); text-align: left;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <span style="font-weight: 800; font-size: 11px; color: #38bdf8;">HP Scale Simulator: <span id="calc-passive-hp-val" style="color: #ffffff; font-weight: 900;">${window.currentHpPercent}%</span></span>
                </div>
                <input type="range" id="calc-passive-hp-slider" min="1" max="100" value="${window.currentHpPercent}" style="width: 100%; accent-color: #38bdf8; cursor: pointer;" oninput="updatePassiveHpSlider(this.value)">
            </div>
        `;
    }

      if (mode === 'summary') {
        let sotAtk = 0, sotDef = 0, p2Atk = 0, p2Def = 0, totalDr = 0;
        let sotGuard = false, p2Guard = false;
        const hpVal = window.currentHpPercent || 100;

        window.interactivePassiveLines.forEach(line => {
            if (line.active) {
                let hpMult = 1;
                if (line.isHpInverse) hpMult = (100 - hpVal) / 99;
                else if (line.isHpDirect) hpMult = hpVal / 100;

                let uncappedAtk = line.atkStep * (line.isStacking ? line.stackCount : 1) * hpMult;
                let uncappedDef = line.defStep * (line.isStacking ? line.stackCount : 1) * hpMult;
                let uncappedDr = (line.drStep || 0) * (line.isStacking ? line.stackCount : 1);

                if (line.maxPctCap && line.maxPctCap > 0) {
                    uncappedAtk = Math.min(line.maxPctCap, uncappedAtk);
                    uncappedDef = Math.min(line.maxPctCap, uncappedDef);
                    if (uncappedDr > 0) uncappedDr = Math.min(line.maxPctCap, uncappedDr);
                } else if (line.maxPctCap && line.maxPctCap < 0) {
                    if (uncappedDr < 0) uncappedDr = Math.max(line.maxPctCap, uncappedDr);
                }

                if (line.phase === 'p2') { 
                    p2Atk += uncappedAtk; p2Def += uncappedDef; 
                    if (line.hasGuard) p2Guard = true;
                } else { 
                    sotAtk += uncappedAtk; sotDef += uncappedDef; 
                    if (line.hasGuard) sotGuard = true;
                }
                totalDr += uncappedDr;
            }
        });

        htmlBuffer += `
            <div style="background: rgba(10, 16, 30, 0.7); padding: 12px; border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.12); text-align: left;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span style="font-weight: 800; font-size: 11px; color: #38bdf8;">🔷 Phase 1 (Start of Turn):</span>
                    <span style="font-weight: 900; font-size: 11.5px;">${formatStatSummaryPills(Math.round(sotAtk), Math.round(sotDef), totalDr, sotGuard)}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span style="font-weight: 800; font-size: 11px; color: #f87171;">🔴 Phase 2 (Mid-Battle):</span>
                    <span style="font-weight: 900; font-size: 11.5px;">${formatStatSummaryPills(Math.round(p2Atk), Math.round(p2Def), 0, p2Guard)}</span>
                </div>
            </div>
        `;
        containerEl.innerHTML = htmlBuffer;
        return;
    }

  let currentHeader = '';
    window.interactivePassiveLines.forEach(line => {
        // Apply the 'Effects' filter to 'Simple' mode as well
        if (mode === 'effects' || mode === 'simple') {
            if (!line.hasStatImpact) return;
            if (tab === 'atk' && line.atkStep === 0 && !line.isAdditionalSa && !line.isSaCounter && !line.isNormalCounter) return;
            if (tab === 'def' && line.defStep === 0 && (line.drStep || 0) === 0 && !line.hasGuard) return;
        }

        if (line.sectionHeader !== currentHeader) {
            currentHeader = line.sectionHeader;
            if (mode !== 'simple') {
                htmlBuffer += `
                    <div class="ds-passive-sec-header">
                        <span style="color: #38bdf8;">•</span>
                        <span>${parseDokkanIcons(currentHeader)}</span>
                    </div>
                `;
            }
        }

        const hpVal = window.currentHpPercent || 100;
        let hpMult = 1;
        if (line.isHpInverse) hpMult = (100 - hpVal) / 99;
        else if (line.isHpDirect) hpMult = hpVal / 100;

        let totalAtk = Math.round(line.atkStep * (line.isStacking ? line.stackCount : 1) * hpMult);
        let totalDef = Math.round(line.defStep * (line.isStacking ? line.stackCount : 1) * hpMult);
        let totalDr = Math.round((line.drStep || 0) * (line.isStacking ? line.stackCount : 1));

        if (line.maxPctCap && line.maxPctCap > 0) {
            totalAtk = Math.min(line.maxPctCap, totalAtk);
            totalDef = Math.min(line.maxPctCap, totalDef);
            if (totalDr > 0) totalDr = Math.min(line.maxPctCap, totalDr);
        } else if (line.maxPctCap && line.maxPctCap < 0) {
            if (totalDr < 0) totalDr = Math.max(line.maxPctCap, totalDr);
        }

        const phaseBadgeHtml = (line.isAdditionalSa || line.isSaCounter || line.isNormalCounter) ? '' : ((line.phase === 'p2') ? 
            `<button type="button" class="phase-badge phase-badge-p2" onclick="toggleLinePhase(${line.idx})" title="Click to toggle to Phase 1">Phase 2</button>` : 
            `<button type="button" class="phase-badge phase-badge-p1" onclick="toggleLinePhase(${line.idx})" title="Click to toggle to Phase 2">Phase 1</button>`);

        let controlWidgetHtml = '';
        const finalLineText = parseDokkanIcons(line.text);
        const activeClass = line.active ? (line.phase === 'p2' ? 'phase-2-active' : 'phase-1-active') : 'row-inactive';

        let stackUnitText = 'attacks';
        if (line.stackType === 'ki_sphere') stackUnitText = 'orbs';
        else if (line.stackType === 'ally') stackUnitText = 'allies';
        else if (line.stackType === 'enemy') stackUnitText = 'enemies';
        else if (line.stackType === 'turns') stackUnitText = (line.stackCount === 1 ? 'turn' : 'turns');

        if (line.isSaCounter) {
            controlWidgetHtml = `
                <label class="switch">
                    <input type="checkbox" id="calc-pass-line-${line.idx}" class="chk" ${line.active ? 'checked' : ''} onchange="togglePassiveLineTrigger(${line.idx})">
                    <span class="slider"></span>
                </label>
            `;
            const timingBtnHtml = (line.counterTiming === 'before') ?
                `<button type="button" class="phase-badge phase-badge-p1" onclick="toggleSaCounterTiming(${line.idx})" title="Click to toggle timing">Before SA</button>` :
                `<button type="button" class="phase-badge phase-badge-p2" onclick="toggleSaCounterTiming(${line.idx})" title="Click to toggle timing">After SA</button>`;

            htmlBuffer += `
                <div class="ds-passive-line-row ${activeClass}">
                    <div style="display: flex; align-items: flex-start; gap: 8px;">
                        ${controlWidgetHtml}
                        <label for="calc-pass-line-${line.idx}" class="ds-passive-label-text">
                            ${finalLineText}
                        </label>
                    </div>
                    <div style="display: flex; align-items: center; justify-content: space-between; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 6px; margin-top: 4px;">
                        <span style="color: #38bdf8; font-size: 10px; font-weight: 800; display: inline-flex; align-items: center; gap: 6px;">
                            <span style="font-size: 13px; line-height: 1; color: #94a3b8;">↳</span>
                            <span>SA Counter (${line.counterTriggerCat}): +${line.counterTempAtk}% Temp ATK | ${line.counterPower}% Mult (${line.counterPowerName})</span>
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
                <div class="ds-passive-line-row ${activeClass}">
                    <div style="display: flex; align-items: flex-start; gap: 8px;">
                        ${controlWidgetHtml}
                        <label class="ds-passive-label-text">
                            ${finalLineText}
                        </label>
                    </div>
                    <div style="display: flex; align-items: center; justify-content: space-between; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 6px; margin-top: 4px;">
                        <span style="color: #38bdf8; font-size: 10px; font-weight: 800; display: inline-flex; align-items: center; gap: 6px;">
                            <span style="font-size: 13px; line-height: 1; color: #94a3b8;">↳</span>
                            <span>Normal Counter: ${line.counterPower}% Mult | Selected: ${line.counterCount}</span>
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
                <div class="ds-passive-line-row ${activeClass}">
                    <div style="display: flex; align-items: flex-start; gap: 8px;">
                        ${controlWidgetHtml}
                        <label class="ds-passive-label-text">
                            ${finalLineText}
                        </label>
                    </div>
                    <div style="display: flex; align-items: center; justify-content: space-between; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 6px; margin-top: 4px;">
                        <span style="color: #38bdf8; font-size: 10px; font-weight: 800; display: inline-flex; align-items: center; gap: 6px;">
                            <span style="font-size: 13px; line-height: 1; color: #94a3b8;">↳</span>
                            <span>Selected: ${line.addSaCount} / ${line.addSaMax} Add. Attack(s)</span>
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
                controlWidgetHtml = `
                    <label class="switch">
                        <input type="checkbox" id="calc-pass-line-${line.idx}" class="chk" ${line.active ? 'checked' : ''} onchange="togglePassiveLineTrigger(${line.idx})">
                        <span class="slider"></span>
                    </label>
                `;
            }

            const summaryHtml = formatStatSummaryPills(totalAtk, totalDef, totalDr, line.hasGuard);

            htmlBuffer += `
                <div class="ds-passive-line-row ${activeClass}">
                    <div style="display: flex; align-items: flex-start; gap: 8px;">
                        ${controlWidgetHtml}
                        <label for="calc-pass-line-${line.idx}" class="ds-passive-label-text">
                            ${finalLineText}
                        </label>
                    </div>
                    ${summaryHtml ? `
                    <div style="display: flex; align-items: center; justify-content: space-between; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 6px; margin-top: 4px;">
                        <span style="font-size: 10.5px; font-weight: 800; display: inline-flex; align-items: center; gap: 6px;">
                            <span style="font-size: 13px; line-height: 1; color: #94a3b8;">↳</span>
                            <span id="calc-pass-yield-${line.idx}">${summaryHtml} ${line.isStacking ? `<span style="color: #94a3b8; font-weight:700;">(${line.stackCount} ${stackUnitText})</span>` : ''}</span>
                        </span>
                        ${phaseBadgeHtml}
                    </div>
                    ` : ''}
                </div>
            `;
        } else {
            controlWidgetHtml = `<span style="font-size: 10px; color: #64748b;">•</span>`;
            htmlBuffer += `
                <div class="ds-passive-line-row ${activeClass}">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        ${controlWidgetHtml}
                        <label class="ds-passive-label-text" style="font-weight: 600;">
                            ${finalLineText}
                        </label>
                    </div>
                </div>
            `;
        }
    });

    containerEl.innerHTML = htmlBuffer;
}
