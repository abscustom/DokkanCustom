/* ==========================================================================
   absCustom - Dokkan Stat Calculator: Core Calculation Engine
   ========================================================================== */

window.DAMAGE_DEALT_SVG = window.DAMAGE_DEALT_SVG || `<svg class="dmg-dealt-icon-svg" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M24.6977 16.1325L18.2502 13.75L15.8752 7.2975C15.7346 6.91541 15.4801 6.58566 15.1461 6.35273C14.8122 6.11981 14.4149 5.99492 14.0077 5.99492C13.6005 5.99492 13.2032 6.11981 12.8692 6.35273C12.5353 6.58566 12.2808 6.91541 12.1402 7.2975L9.7502 13.75L3.2977 16.125C2.91561 16.2656 2.58586 16.5201 2.35293 16.854C2.12001 17.188 1.99512 17.5853 1.99512 17.9925C1.99512 18.3997 2.12001 18.797 2.35293 19.131C2.58586 19.4649 2.91561 19.7194 3.2977 19.86L9.7502 22.25L12.1252 28.7025C12.2658 29.0846 12.5203 29.4143 12.8542 29.6473C13.1882 29.8802 13.5855 30.0051 13.9927 30.0051C14.3999 30.0051 14.7972 29.8802 15.1311 29.6473C15.4651 29.4143 15.7196 29.0846 15.8602 28.7025L18.2502 22.25L24.7027 19.875C25.0848 19.7344 25.4145 19.4799 25.6475 19.146C25.8804 18.812 26.0053 18.4147 26.0053 18.0075C26.0053 17.6003 25.8804 17.203 25.6475 16.869C25.4145 16.5351 25.0848 16.2806 24.7027 16.14L24.6977 16.1325ZM17.1252 20.5275C16.9895 20.5775 16.8662 20.6564 16.7639 20.7587C16.6616 20.861 16.5827 20.9843 16.5327 21.12L14.0002 27.9813L11.4727 21.125C11.4228 20.9878 11.3434 20.8633 11.2402 20.76C11.1369 20.6568 11.0124 20.5774 10.8752 20.5275L4.01895 18L10.8752 15.4725C11.0124 15.4226 11.1369 15.3432 11.2402 15.24C11.3434 15.1367 11.4228 15.0122 11.4727 14.875L14.0002 8.01875L16.5277 14.875C16.5777 15.0107 16.6566 15.134 16.7589 15.2363C16.8612 15.3386 16.9845 15.4175 17.1202 15.4675L23.9814 18L17.1252 20.5275ZM18.0002 5C18.0002 4.73478 18.1056 4.48043 18.2931 4.29289C18.4806 4.10536 18.735 4 19.0002 4H21.0002V2C21.0002 1.73478 21.1056 1.48043 21.2931 1.29289C21.4806 1.10536 21.735 1 22.0002 1C22.2654 1 22.5198 1.10536 22.7073 1.29289C22.8948 1.48043 23.0002 1.73478 23.0002 2V4H25.0002C25.2654 4 25.5198 4.10536 25.7073 4.29289C25.8948 4.48043 26.0002 4.73478 26.0002 5C26.0002 5.26522 25.8948 5.51957 25.7073 5.70711C25.5198 5.89464 25.2654 6 25.0002 6H23.0002V8C23.0002 8.26522 22.8948 8.51957 22.7073 8.70711C22.5198 8.89464 22.2654 9 22.0002 9C21.735 9 21.4806 8.89464 21.2931 8.70711C21.1056 8.51957 21.0002 8.26522 21.0002 8V6H19.0002C18.735 6 18.4806 5.89464 18.2931 5.70711C18.1056 5.51957 18.0002 5.26522 18.0002 5ZM31.0002 11C31.0002 11.2652 30.8948 11.5196 30.7073 11.7071C30.5198 11.8946 30.2654 12 30.0002 12H29.0002V13C29.0002 13.2652 28.8948 13.5196 28.7073 13.7071C28.5198 13.8946 28.2654 14 28.0002 14C27.735 14 27.4806 13.8946 27.2931 13.7071C27.1056 13.5196 27.0002 13.2652 27.0002 13V12H26.0002C25.735 12 25.4806 11.8946 25.2931 11.7071C25.1056 11.5196 25.0002 11.2652 25.0002 11C25.0002 10.7348 25.1056 10.4804 25.2931 10.2929C25.4806 10.1054 25.735 10 26.0002 10H27.0002V9C27.0002 8.73478 27.1056 8.48043 27.2931 8.29289C27.4806 8.10536 27.735 8 28.0002 8C28.2654 8 28.5198 8.10536 28.7073 8.29289C28.8948 8.48043 29.0002 8.73478 29.0002 9V10H30.0002C30.2654 10 30.5198 10.1054 30.7073 10.2929C30.8948 10.4804 31.0002 10.7348 31.0002 11Z" fill="#f87171"/></svg>`;

window.activeUnitSaBlockIdx = null;

function getHighestEligibleSaIndex(saBlocksData, currentKi, isLR) {
    if (!saBlocksData || saBlocksData.length === 0) return 0;
    
    // Check non-EX standard blocks first
    const standardBlocks = [];
    saBlocksData.forEach((sa, idx) => {
        if (!sa.is_ex && !sa.is_unit_sa) {
            standardBlocks.push({ sa, idx });
        }
    });

    if (isLR && standardBlocks.length >= 2) {
        return (currentKi >= 18) ? standardBlocks[1].idx : standardBlocks[0].idx;
    }

    if (standardBlocks.length > 0) {
        let bestIdx = standardBlocks[0].idx;
        let highestKi = -1;
        standardBlocks.forEach(item => {
            const reqKi = item.sa.startKi || item.sa.eball_num_start || (item.idx === 0 ? 12 : 18);
            if (currentKi >= reqKi && reqKi > highestKi) {
                highestKi = reqKi;
                bestIdx = item.idx;
            }
        });
        return bestIdx;
    }

    return (isLR && saBlocksData.length >= 2) ? ((currentKi >= 18) ? 1 : 0) : 0;
}

function getLowestKiSaIndex(saBlocksData) {
    if (!saBlocksData || saBlocksData.length === 0) return 0;
    let lowestIdx = 0;
    let lowestKi = 999;
    saBlocksData.forEach((sa, idx) => {
        if (sa.is_ex || sa.is_unit_sa) return;
        const reqKi = sa.startKi || sa.eball_num_start || (idx === 0 ? 12 : 18);
        if (reqKi < lowestKi) {
            lowestKi = reqKi;
            lowestIdx = idx;
        }
    });
    return lowestIdx;
}
window.getLowestKiSaIndex = getLowestKiSaIndex;

function detectExCapabilities() {
    let hasExMain = false;
    let hasExAdd = false;
    let exSaBlockIdx = -1;
    let mainExBlockIdx = -1;
    let addExBlockIdx = -1;

    const saBlocks = window.lastParsedSaBlocksData || [];

    saBlocks.forEach((sa, idx) => {
        const label = String(sa.typeLabel || '').toLowerCase();
        const name = String(sa.saName || '').toLowerCase();
        const full = String(sa.fullText || '').toLowerCase();
        const act = String(sa.activationText || sa.causality_description || sa.condition || '').toLowerCase();
        const exType = String(sa.ex_type || '').toLowerCase();

        const isExBlock = sa.is_ex === true ||
                          String(sa.style || '').toLowerCase() === 'extra' ||
                          /\bex\b/i.test(label) ||
                          /\bex\b/i.test(name) ||
                          /\bex\s+super\b/i.test(full);

        if (isExBlock) {
            sa.is_ex = true;
            if (exSaBlockIdx === -1) exSaBlockIdx = idx;

            const combinedText = (label + ' ' + name + ' ' + act + ' ' + full).toLowerCase();
            const startKi = parseInt(sa.startKi || sa.eball_num_start || 0, 10);

            const mentionsMain = exType === 'first_attack' ||
                                 startKi >= 18 ||
                                 /1st attack|first attack|24 ki|ultra super|when ki is 24|1st super attack/i.test(combinedText);

            const mentionsAdd = exType === 'additional_attack' ||
                                (startKi > 0 && startKi <= 12 && !mentionsMain) ||
                                /additional|launches an additional|when performing an additional|as an additional/i.test(combinedText);

            if (mentionsMain) {
                hasExMain = true;
                if (mainExBlockIdx === -1) mainExBlockIdx = idx;
            }
            if (mentionsAdd) {
                hasExAdd = true;
                if (addExBlockIdx === -1) addExBlockIdx = idx;
            }

            if (!mentionsMain && !mentionsAdd) {
                if (startKi >= 18 || idx === 0) {
                    hasExMain = true;
                    if (mainExBlockIdx === -1) mainExBlockIdx = idx;
                } else {
                    hasExAdd = true;
                    if (addExBlockIdx === -1) addExBlockIdx = idx;
                }
            }
        }
    });

    if (window.interactivePassiveLines && Array.isArray(window.interactivePassiveLines)) {
        window.interactivePassiveLines.forEach(line => {
            const txt = String(line.text || '').toLowerCase();
            const hdr = String(line.sectionHeader || '').toLowerCase();
            const combined = hdr + ' ' + txt;

            if (/\bex\s+super\s+attack\b|\bex\s+sa\b|\bex\b/i.test(combined)) {
                const mentionsMain = /1st attack|first attack|24 ki|12 or more ki|ultra super|when ki is 24|1st super attack/i.test(combined);
                const mentionsAdd = /additional|launches an additional|when performing an additional|as an additional/i.test(combined);

                if (mentionsMain) hasExMain = true;
                if (mentionsAdd) hasExAdd = true;

                if (!mentionsMain && !mentionsAdd) {
                    hasExAdd = true;
                }
            }
        });
    }

    if (mainExBlockIdx === -1 && hasExMain && exSaBlockIdx !== -1) mainExBlockIdx = exSaBlockIdx;
    if (addExBlockIdx === -1 && hasExAdd && exSaBlockIdx !== -1) addExBlockIdx = exSaBlockIdx;

    return { 
        hasExMain: hasExMain || mainExBlockIdx !== -1, 
        hasExAdd: hasExAdd || addExBlockIdx !== -1, 
        hasAnyEx: (hasExMain || hasExAdd || exSaBlockIdx !== -1),
        exSaBlockIdx,
        mainExBlockIdx,
        addExBlockIdx
    };
}

function detectUnitSaCapabilities() {
    const saBlocks = window.lastParsedSaBlocksData || [];
    const unitSaBlocks = [];

    saBlocks.forEach((sa, idx) => {
        if (sa.is_unit_sa === true || /unit\s+(?:ultra\s+)?super/i.test(String(sa.typeLabel || '') + ' ' + String(sa.saName || ''))) {
            unitSaBlocks.push({ ...sa, blockIdx: idx });
        }
    });

    return {
        hasUnitSa: unitSaBlocks.length > 0,
        unitSaBlocks: unitSaBlocks,
        count: unitSaBlocks.length
    };
}

window.handleUnitSaToggleClick = function() {
    const unitCaps = detectUnitSaCapabilities();
    if (!unitCaps.hasUnitSa) return;

    if (unitCaps.count === 1) {
        if (window.activeUnitSaBlockIdx !== null) {
            window.activeUnitSaBlockIdx = null;
        } else {
            window.activeUnitSaBlockIdx = unitCaps.unitSaBlocks[0].blockIdx;
        }
        calculateDokkanStats();
        return;
    }

    window.openUnitSaPickerModal();
};

window.openUnitSaPickerModal = function() {
    const modal = document.getElementById('calc-unit-sa-picker-modal');
    const list = document.getElementById('unitSaPickerList');
    if (!modal || !list) return;

    const unitCaps = detectUnitSaCapabilities();
    const currentActiveIdx = window.activeUnitSaBlockIdx;

    let html = `
        <div class="unit-sa-picker-item ${currentActiveIdx === null ? 'active' : ''}" onclick="window.selectUnitSaFromPicker(null)">
            <div class="unit-sa-item-header">
                <div class="unit-sa-item-title-group">
                    <span class="box-badge-standard-off">DEFAULT</span>
                    <strong class="unit-sa-name">Standard 1st Attack (Unit SA Off)</strong>
                </div>
                ${currentActiveIdx === null ? '<span class="unit-sa-status-pill active-pill">● Active</span>' : '<span class="unit-sa-status-pill">Select</span>'}
            </div>
            <div class="unit-sa-desc">Standard Ultra Super Attack or 12-Ki Super Attack without Unit SA activation.</div>
        </div>
    `;

    unitCaps.unitSaBlocks.forEach((usa, i) => {
        const isSelected = (currentActiveIdx === usa.blockIdx);
        html += `
            <div class="unit-sa-picker-item ${isSelected ? 'active' : ''}" onclick="window.selectUnitSaFromPicker(${usa.blockIdx})">
                <div class="unit-sa-item-header">
                    <div class="unit-sa-item-title-group">
                        <span class="box-badge-purple">UNIT SA #${i + 1}</span>
                        <strong class="unit-sa-name">${usa.saName}</strong>
                    </div>
                    ${isSelected ? '<span class="unit-sa-status-pill active-pill">● Selected</span>' : '<span class="unit-sa-status-pill">Select</span>'}
                </div>
                <div class="unit-sa-condition">
                    <span class="condition-label">Condition:</span> ${usa.condition || usa.activationText || "Required ally on team"}
                </div>
                <div class="unit-sa-desc">
                    ${usa.fullText || "Raises stats and causes damage"}
                </div>
            </div>
        `;
    });

    list.innerHTML = html;
    modal.style.display = 'flex';
};

window.closeUnitSaPickerModal = function() {
    const modal = document.getElementById('calc-unit-sa-picker-modal');
    if (modal) modal.style.display = 'none';
};

window.selectUnitSaFromPicker = function(blockIdx) {
    window.closeUnitSaPickerModal();
    window.activeUnitSaBlockIdx = blockIdx;
    calculateDokkanStats();
};

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
    const cur = window.exToggleState[idx] !== undefined ? window.exToggleState[idx] : true;
    window.exToggleState[idx] = !cur;

    // Recalculate stats and trigger banner sync immediately
    if (typeof calculateDokkanStats === 'function') {
        calculateDokkanStats();
    }
    if (window.DokkanBattleAnimator && typeof window.DokkanBattleAnimator.syncWithCalculator === 'function') {
        window.DokkanBattleAnimator.syncWithCalculator();
    }
};

window.calcCritEnabled = false;
window.calcAdditionalEnabled = false;

window.toggleCalcCrit = function() {
    window.calcCritEnabled = !window.calcCritEnabled;
    const btn = document.getElementById('calc-crit-toggle');
    if (btn) btn.classList.toggle('active', window.calcCritEnabled);
    if (typeof calculateDokkanStats === 'function') calculateDokkanStats();
};

window.toggleCalcAdditional = function() {
    window.calcAdditionalEnabled = !window.calcAdditionalEnabled;
    const btn = document.getElementById('calc-additional-toggle');
    if (btn) btn.classList.toggle('active', window.calcAdditionalEnabled);
    if (typeof calculateDokkanStats === 'function') calculateDokkanStats();
};

window.calcSeEnabled = false;
window.toggleCalcSE = function() {
    window.calcSeEnabled = !window.calcSeEnabled;
    const btn = document.getElementById('calc-se-toggle');
    if (btn) btn.classList.toggle('active', window.calcSeEnabled);
    if (typeof calculateDokkanStats === 'function') calculateDokkanStats();
};

window.getDokkanTypeAndClassMultiplier = function(playerType, playerClass, bossType, bossClass, isCrit, isSE) {
    playerType = (playerType || window.currentCalcType || 'AGL').toUpperCase();
    bossType = (bossType || document.getElementById('calc-boss-type')?.value || 'AGL').toUpperCase();
    
    playerClass = (playerClass || window.currentCalcClass || 'Super');
    playerClass = playerClass.toLowerCase() === 'extreme' ? 'Extreme' : 'Super';
    
    bossClass = (bossClass || document.getElementById('calc-boss-class')?.value || 'Extreme');
    bossClass = bossClass.toLowerCase() === 'extreme' ? 'Extreme' : 'Super';

    const isSameClass = (playerClass === bossClass);
    const isOppositeClass = !isSameClass;

    // Dokkan Type Wheel: AGL > STR > PHY > INT > TEQ > AGL
    const advantageMap = {
        'AGL': 'STR',
        'STR': 'PHY',
        'PHY': 'INT',
        'INT': 'TEQ',
        'TEQ': 'AGL'
    };
    const disadvantageMap = {
        'AGL': 'TEQ',
        'TEQ': 'INT',
        'INT': 'PHY',
        'PHY': 'STR',
        'STR': 'AGL'
    };

    const isAdvantage = (advantageMap[playerType] === bossType);
    const isDisadvantage = (disadvantageMap[playerType] === bossType);
    const isNeutral = (!isAdvantage && !isDisadvantage);

    let typeModifier = 1.0;
    let guardModifier = 1.0;

    if (isCrit && isSE) {
        typeModifier = 1.9 * 1.5;
        guardModifier = 1.0;
    } else if (isCrit) {
        typeModifier = 1.9;
        guardModifier = 1.0;
    } else if (isSE) {
        typeModifier = 1.5;
        guardModifier = 1.0;
    } else {
        if (isAdvantage) {
            typeModifier = isSameClass ? 1.25 : 1.50;
            guardModifier = 1.0;
        } else if (isNeutral) {
            typeModifier = isSameClass ? 1.00 : 1.15;
            guardModifier = 1.0;
        } else if (isDisadvantage) {
            typeModifier = isSameClass ? 0.90 : 1.00;
            guardModifier = 0.50;
        }
    }

    return {
        typeModifier,
        guardModifier,
        isAdvantage,
        isDisadvantage,
        isNeutral,
        isSameClass,
        isOppositeClass
    };
};

window.calcEnemyDamage = function(atkStat, isCrit, isSE) {
    const rawDef = parseFloat(document.getElementById('calc-boss-def')?.value) || 0;
    const defMult = parseFloat(document.getElementById('calc-boss-def-mult')?.value) || 0;
    const bossDrPct = parseFloat(document.getElementById('calc-boss-dr')?.value) || 0;
    const bossType = (document.getElementById('calc-boss-type')?.value || 'AGL').toUpperCase();
    const bossClass = (document.getElementById('calc-boss-class')?.value || 'Extreme');

    const cardType = (window.currentCalcType || 'AGL').toUpperCase();
    const cardClass = (window.currentCalcClass || 'Super');

    const bossDef = rawDef * (1 + (defMult / 100));

    const modObj = window.getDokkanTypeAndClassMultiplier(cardType, cardClass, bossType, bossClass, isCrit, isSE);

    let actualBossDef = isCrit ? 0 : bossDef;
    let singleBaseDmg = atkStat * modObj.typeModifier * 1.015;
    let singlePostDef = Math.max(0, singleBaseDmg - actualBossDef);
    let afterGuardDmg = singlePostDef * modObj.guardModifier;
    return Math.floor(afterGuardDmg * (1 - (bossDrPct / 100)));
};

window.openBossPickerModal = function() {
    alert("Select Boss feature is ready for future boss presets!");
};

window.stepOrb = function(type, tier, delta) {
    const inp = document.getElementById(`inp-orb-${type}-${tier}`);
    if (!inp) return;
    let val = parseInt(inp.value) || 0;
    if (delta !== 0) val += delta;
    if (val < 0) val = 0;
    if (val > 20) val = 20;
    inp.value = val;
    
    const lbl = document.getElementById(`lbl-lv-${type}-${tier}`);
    if (lbl) lbl.innerText = val;
    
    const yieldText = document.getElementById(`yield-${type}-${tier}`);
    if (yieldText) yieldText.innerText = `+${val * 100} ${type.toUpperCase()}`;
    
    // Sum total ATK and DEF
    const types = ['atk', 'def'];
    types.forEach(t => {
        const sum = ['bronze', 'silver', 'gold'].reduce((acc, tr) => {
            const el = document.getElementById(`inp-orb-${t}-${tr}`);
            return acc + ((parseInt(el?.value) || 0) * 100);
        }, 0);
        const hidden = document.getElementById(`calc-orb-${t}`);
        if (hidden) hidden.value = sum;
    });
    
    if (typeof calculateDokkanStats === 'function') calculateDokkanStats();
};

/* ==========================================================================
   CORE CALCULATION ENGINE
   ========================================================================== */
function calculateDokkanStats() {
    const orbsActive = document.getElementById('calc-orbs-master-toggle')?.checked ?? true;
    
    const totalOrbAtk = orbsActive ? (parseFloat(document.getElementById('calc-orb-atk')?.value) || 0) : 0;
    const totalOrbDef = orbsActive ? (parseFloat(document.getElementById('calc-orb-def')?.value) || 0) : 0;

    const baseAtkRaw = (parseFloat(document.getElementById('calc-base-atk')?.value) || 0) + totalOrbAtk;
    const baseDefRaw = (parseFloat(document.getElementById('calc-base-def')?.value) || 0) + totalOrbDef;

    const leadMult = 1 + ((parseFloat(document.getElementById('calc-lead')?.value) || 0) / 100);
    
    let sotAtkBase = parseFloat(document.getElementById('calc-sot-atk')?.value) || 0;
    let sotDefBase = parseFloat(document.getElementById('calc-sot-def')?.value) || 0;
    let p2AtkBase = parseFloat(document.getElementById('calc-p2-atk')?.value) || 0;
    let p2DefBase = parseFloat(document.getElementById('calc-p2-def')?.value) || 0;
    
    let extraPassiveDr = 0;
    let extraPassiveGuard = false;
    let passiveAdd12KiSaCount = window.calcAdditionalEnabled ? 1 : 0;
    let passiveAddUltraSaCount = 0;

    let activeSaCounterLine = null;
    let activeNormalCounterLines = [];

    const hpVal = window.currentHpPercent || 100;

    if (window.interactivePassiveLines && window.interactivePassiveLines.length > 0) {
        window.interactivePassiveLines.forEach(line => {
            if (line.active) {
                if (line.isSaCounter) {
                    activeSaCounterLine = line;
                    return; 
                }
                if (line.isNormalCounter) {
                    if (line.counterCount > 0) activeNormalCounterLines.push(line);
                    return; 
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

                if (line.isAdditionalUltraSa) passiveAddUltraSaCount += (line.addSaCount !== undefined ? line.addSaCount : (line.addSaMax || 1));
                else if (line.isAdditionalSa) passiveAdd12KiSaCount += (line.addSaCount !== undefined ? line.addSaCount : (line.addSaMax || 1));

                if (!line.isOnSaWithinTurn) {
                    if (line.phase === 'p2') { 
                        p2AtkBase += uncappedAtk; 
                        p2DefBase += uncappedDef;
                    } else { 
                        sotAtkBase += uncappedAtk; 
                        sotDefBase += uncappedDef; 
                    }
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

    // STEP 2: PHASE 1 PASSIVE (Start of Turn)
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
    
    atkStep = Math.floor(atkStep * linkAtkMult);
    defStep = Math.floor(defStep * linkDefMult);

    // STEP 5: ACTIVE SKILL MULTIPLIER BRACKET
    const activeSkillActive = document.getElementById('calc-active-skill-active')?.checked || false;
    const activeSaBaseInput = parseFloat(document.getElementById('calc-active-sa-type')?.value) || 0;
    const activeIsAttack = activeSaBaseInput >= 100;
    
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

    const activeAtkMult = 1 + (activeAtkVal / 100);
    const activeDefMult = 1 + (activeDefVal / 100);

    const atkStepBeforeKi = Math.floor(atkStep * activeAtkMult);
    const startOfTurnDef = Math.floor(defStep * activeDefMult);

    // Sync SA effect yields
    for (let sIdx = 0; sIdx < 6; sIdx++) {
        const sAtkIn = document.getElementById(`calc-sa-atk-effect-${sIdx}`);
        const sDefIn = document.getElementById(`calc-sa-def-effect-${sIdx}`);
        const sAtkYield = document.getElementById(`sa-atk-eff-yield-${sIdx}`);
        const sDefYield = document.getElementById(`sa-def-eff-yield-${sIdx}`);
        if (sAtkIn && sAtkYield) sAtkYield.innerText = `+${parseFloat(sAtkIn.value) || 0}% ATK`;
        if (sDefIn && sDefYield) sDefYield.innerText = `+${parseFloat(sDefIn.value) || 0}% DEF`;
    }

    // STEP 6: PHASE 2 (MID-BATTLE BUILDUPS)
    const totalP2Atk = p2AtkBase + (hitCount * hitStepAtk);
    const totalP2Def = p2DefBase + (hitCount * hitStepDef);
    const p2DefMult = 1 + (totalP2Def / 100);

    // --- DEFENSE CALCULATION ---
    const saDefEffect1 = parseFloat(document.getElementById(`calc-sa-def-effect-0`)?.value) || 0;
    const prevSaStacks = parseInt(document.getElementById('calc-prev-sa-stacks')?.value || 0, 10);
    const extraSaDefStackBuff = saDefEffect1 * prevSaStacks;

    const saDefMult = 1 + ((saDefEffect1 + extraSaDefStackBuff) / 100);
    let postSuperDef = Math.floor(startOfTurnDef * p2DefMult);
    postSuperDef = Math.floor(postSuperDef * saDefMult);

    // --- ATTACK CALCULATION ---
    const isLR = (window.currentCalcRarity === 'LR');
    const isEZA = window.currentCalcEza || false;
    const lrBonus = isLR ? 30 : 0; 
    const currentKi = parseFloat(document.getElementById('calc-ki-slider')?.value) || (isLR ? 24 : 12);

    const ki24 = parseFloat(document.getElementById('calc-ki-mult-base')?.value) || (isLR ? 200 : 150);
    const ki12 = parseFloat(document.getElementById('calc-ki-mult-add')?.value) || (isLR ? 150 : ki24);

    let activeKiMult1 = 1.5;
    if (isLR) {
        const clampedKi = Math.max(12, Math.min(24, currentKi));
        activeKiMult1 = (ki12 + ((clampedKi - 12) / 12) * (ki24 - ki12)) / 100;
    } else {
        const clampedKi = Math.max(1, Math.min(12, currentKi));
        activeKiMult1 = (100 + ((clampedKi - 1) / 11) * (ki24 - 100)) / 100;
    }

    const saBlocksData = window.lastParsedSaBlocksData || [];
    const regularMainSaIdx = getHighestEligibleSaIndex(saBlocksData, currentKi, isLR);
    const lowestKiSaIdx = getLowestKiSaIndex(saBlocksData);

    const exCaps = detectExCapabilities();
    const canBeExMain = exCaps.hasExMain;
    const isExMain = canBeExMain && (window.exToggleState[0] !== undefined ? window.exToggleState[0] : true);

    const unitCaps = detectUnitSaCapabilities();
    const isUnitSaActive = window.activeUnitSaBlockIdx !== null;

    let targetMainSaIdx = regularMainSaIdx;
    let saMult1 = getDynamicSaVal(regularMainSaIdx);
    let saAtkEffect1 = parseFloat(document.getElementById(`calc-sa-atk-effect-${regularMainSaIdx}`)?.value) || 0;

    if (isExMain) {
        if (exCaps.mainExBlockIdx !== -1) {
            targetMainSaIdx = exCaps.mainExBlockIdx;
            saMult1 = getDynamicSaVal(targetMainSaIdx);
            saAtkEffect1 = parseFloat(document.getElementById(`calc-sa-atk-effect-${targetMainSaIdx}`)?.value) || 0;
        } else {
            saMult1 = isLR ? (currentKi >= 18 ? 710 : 540) : (isEZA ? 740 : 690);
        }
    } else if (isUnitSaActive && window.activeUnitSaBlockIdx !== null && saBlocksData[window.activeUnitSaBlockIdx]) {
        targetMainSaIdx = window.activeUnitSaBlockIdx;
        saMult1 = getDynamicSaVal(targetMainSaIdx);
        saAtkEffect1 = parseFloat(document.getElementById(`calc-sa-atk-effect-${targetMainSaIdx}`)?.value) || 0;
    }

    const mainSaBlock = saBlocksData[targetMainSaIdx] || null;
    const mainKiBadge = mainSaBlock?.kiText || (isLR ? `${currentKi} Ki` : `${Math.min(12, currentKi)} Ki`);

    let atkAfterKi = Math.floor(atkStepBeforeKi * activeKiMult1);

    const baseStackEffectAtk = parseFloat(document.getElementById(`calc-sa-atk-effect-0`)?.value) || 0;
    const prevStacksBuffAtk = baseStackEffectAtk * prevSaStacks;
    const hipoBoost = parseFloat(document.getElementById('calc-sa-hipo-boost')?.value) || 0;

    let currentTurnSaBuffAtk = saAtkEffect1;
    let currentSaSeq = (activeSkillActive && activeIsAttack) ? 2 : 1;

    // STEP 7: PHASE 2 PASSIVE (1st SA)
    const firstAttackWithinTurnBuff = getOnSaWithinTurnAtkForSeq(currentSaSeq); 
    const firstAttackP2Mult = 1 + ((totalP2Atk + firstAttackWithinTurnBuff) / 100);
    let firstSuperAtk = Math.floor(atkAfterKi * firstAttackP2Mult);

    // STEP 8: SA MULTIPLIER BRACKET (1st SA)
    const totalFirstSaMult = saMult1 + hipoBoost + saAtkEffect1 + prevStacksBuffAtk + lrBonus;
    const finalFirstAtk = Math.floor(firstSuperAtk * (totalFirstSaMult / 100));

    // SEQUENTIAL ADDITIONAL SUPER ATTACKS
    const calculatedAdditionals = [];
    let globalAtkIdx = 0;

    // 1. Additional Ultra SAs
    const ultraSaIdx = (saBlocksData.length >= 2) ? 1 : 0;
    for (let u = 1; u <= passiveAddUltraSaCount; u++) {
        currentSaSeq++;
        globalAtkIdx++;

        const canBeExUltra = exCaps.hasExAdd;
        const isExUltra = canBeExUltra && (window.exToggleState[globalAtkIdx] !== undefined ? window.exToggleState[globalAtkIdx] : true);
        
        let targetUltraIdx = ultraSaIdx;
        let saMultUltra = getDynamicSaVal(ultraSaIdx);
        let saAtkEffectUltra = parseFloat(document.getElementById(`calc-sa-atk-effect-${ultraSaIdx}`)?.value) || 0;

        if (isExUltra) {
            if (exCaps.addExBlockIdx !== -1) {
                targetUltraIdx = exCaps.addExBlockIdx;
                saMultUltra = getDynamicSaVal(targetUltraIdx);
                saAtkEffectUltra = parseFloat(document.getElementById(`calc-sa-atk-effect-${targetUltraIdx}`)?.value) || 0;
            } else {
                saMultUltra = isLR ? 710 : (isEZA ? 740 : 690);
            }
        }

        const p2BuffUltra = getOnSaWithinTurnAtkForSeq(currentSaSeq); 
        const p2MultUltra = 1 + ((totalP2Atk + p2BuffUltra) / 100);
        let atkUltra = Math.floor(atkStepBeforeKi * activeKiMult1);
        atkUltra = Math.floor(atkUltra * p2MultUltra);
        
        const totalSaMultUltra = saMultUltra + hipoBoost + saAtkEffectUltra + prevStacksBuffAtk + currentTurnSaBuffAtk + lrBonus;
        const atkStatUltra = Math.floor(atkUltra * (totalSaMultUltra / 100));
        currentTurnSaBuffAtk += saAtkEffectUltra;

        calculatedAdditionals.push({
            label: isExUltra ? `Add. EX SA #${u}` : `Add. Ultra SA #${u}`,
            stat: atkStatUltra,
            kiBadge: isLR ? '24 Ki' : '18 Ki',
            mult: totalSaMultUltra,
            canBeEx: canBeExUltra,
            isEx: isExUltra,
            isUltra: true,
            isUnit: false,
            addNumber: u,
            idx: globalAtkIdx
        });
    }

    // 2. Additional Regular SAs (Lowest Ki)
    const lowestSaBlock = saBlocksData[lowestKiSaIdx] || null;
    const lowestKiText = lowestSaBlock ? (lowestSaBlock.kiText || (isLR ? '12 Ki' : '11 Ki')) : (isLR ? '12 Ki' : '11 Ki');
    const lowestKiBaseMultiplier = isLR ? (ki12 / 100) : (ki24 / 100);

    for (let a = 1; a <= passiveAdd12KiSaCount; a++) {
        currentSaSeq++;
        globalAtkIdx++;

        const canBeExThisAtk = exCaps.hasExAdd;
        const isExThisAtk = canBeExThisAtk && (window.exToggleState[globalAtkIdx] !== undefined ? window.exToggleState[globalAtkIdx] : true);
        
        let targetExIdx = lowestKiSaIdx;
        let curSaMult = getDynamicSaVal(lowestKiSaIdx);
        let curSaEffect = parseFloat(document.getElementById(`calc-sa-atk-effect-${lowestKiSaIdx}`)?.value) || 0;

        if (isExThisAtk) {
            if (exCaps.addExBlockIdx !== -1) {
                targetExIdx = exCaps.addExBlockIdx;
                curSaMult = getDynamicSaVal(targetExIdx);
                curSaEffect = parseFloat(document.getElementById(`calc-sa-atk-effect-${targetExIdx}`)?.value) || 0;
            } else {
                curSaMult = isLR ? 540 : (isEZA ? 690 : 410);
            }
        }

        const targetExSaBlock = (saBlocksData && targetExIdx !== -1) ? saBlocksData[targetExIdx] : null;
        const is24KiExAdd = targetExSaBlock && (
            targetExSaBlock.eball_num_start >= 18 ||
            (targetExSaBlock.typeLabel || '').toLowerCase().includes('24 ki') || 
            (targetExSaBlock.fullText || '').toLowerCase().includes('24 ki')
        );

        const curKiMult = isExThisAtk ? (is24KiExAdd ? activeKiMult1 : lowestKiBaseMultiplier) : lowestKiBaseMultiplier;
        const p2BuffAdd = getOnSaWithinTurnAtkForSeq(currentSaSeq); 
        const p2MultAdd = 1 + ((totalP2Atk + p2BuffAdd) / 100);
        let atkAdd = Math.floor(atkStepBeforeKi * curKiMult);
        atkAdd = Math.floor(atkAdd * p2MultAdd);
        
        const totalAddSaMult = curSaMult + hipoBoost + curSaEffect + prevStacksBuffAtk + currentTurnSaBuffAtk + lrBonus;
        const atkStatAdd = Math.floor(atkAdd * (totalAddSaMult / 100));
        currentTurnSaBuffAtk += curSaEffect; 

        const addNum = a + passiveAddUltraSaCount;
        calculatedAdditionals.push({
            label: isExThisAtk ? `Add. EX SA #${addNum}` : `Add. SA #${addNum}`,
            stat: atkStatAdd,
            kiBadge: lowestKiText,
            mult: totalAddSaMult,
            canBeEx: canBeExThisAtk,
            isEx: isExThisAtk,
            isUltra: false,
            isUnit: false,
            addNumber: addNum,
            idx: globalAtkIdx
        });
    }

    // SUPER ATTACK COUNTERS
    const isSaCounterTriggered = activeSaCounterLine !== null;
    let finalSaCounterAtkStat = 0;
    let counterTotalSaMult = 300;
    let saCounterTriggerCat = "Super Attack";

    if (isSaCounterTriggered) {
        const counterBasePower = activeSaCounterLine.counterPower || 300; 
        const counterTempAtk = activeSaCounterLine.counterTempAtk || 0;  
        saCounterTriggerCat = activeSaCounterLine.counterTriggerCat || "Super Attack";
        const timingMode = activeSaCounterLine.counterTiming || "after";

        const counterKiMult = isLR ? (ki12 / 100) : (ki12 / 100);
        const counterP2Mult = 1 + ((totalP2Atk + counterTempAtk) / 100);
        
        let preAtkCounterBase = Math.floor(atkStepBeforeKi * counterKiMult);
        preAtkCounterBase = Math.floor(preAtkCounterBase * counterP2Mult);

        if (timingMode === 'after') {
            counterTotalSaMult = counterBasePower + prevStacksBuffAtk + currentTurnSaBuffAtk;
            const postAtkCounterBase = Math.floor(preAtkCounterBase * 1.37096774);
            finalSaCounterAtkStat = Math.floor(postAtkCounterBase * (counterTotalSaMult / 100));
        } else {
            counterTotalSaMult = counterBasePower + prevStacksBuffAtk;
            finalSaCounterAtkStat = Math.floor(preAtkCounterBase * (counterTotalSaMult / 100));
        }
    }

    // NORMAL ATTACK COUNTERS
    const calculatedNormalCounters = [];
    activeNormalCounterLines.forEach(line => {
        if (line.counterCount > 0) {
            const counterKiMult = 1.0;
            const totalSAsPerformed = 1 + passiveAdd12KiSaCount + passiveAddUltraSaCount + (activeSkillActive && activeIsAttack ? 1 : 0);
            const counterP2Mult = 1 + ((totalP2Atk + getOnSaWithinTurnAtkForSeq(totalSAsPerformed + 1)) / 100);

            let counterAtkBeforeMult = Math.floor(atkStepBeforeKi * counterKiMult);
            counterAtkBeforeMult = Math.floor(counterAtkBeforeMult * counterP2Mult);

            const basePower = line.counterPower || 300;
            const totalCounterMult = basePower + prevStacksBuffAtk + currentTurnSaBuffAtk;
            const stat = Math.floor(counterAtkBeforeMult * (totalCounterMult / 100));

            calculatedNormalCounters.push({
                count: line.counterCount,
                powerName: line.counterPowerName,
                mult: totalCounterMult,
                stat: stat
            });
        }
    });

    const sotDefEl = document.getElementById('res-sot-def');
    const postDefEl = document.getElementById('res-post-def');
    const finalAtkEl = document.getElementById('res-final-atk');

    if (sotDefEl) sotDefEl.innerText = startOfTurnDef.toLocaleString();
    if (postDefEl) postDefEl.innerText = postSuperDef.toLocaleString();
    if (finalAtkEl) finalAtkEl.innerText = finalFirstAtk.toLocaleString();

    /* Inside calculateDokkanStats() in calc-engine.js around line ~370-430: */

    // 1st SA DOKKAN TYPOGRAPHY & BANNER COMMAND
    const isUnitSa = (mainSaBlock?.is_unit_sa === true) || (isUnitSaActive) || (mainSaBlock && /unit\s+super/i.test((mainSaBlock.typeLabel || '') + ' ' + (mainSaBlock.saName || '')));
    let mainDokkanTitle = "Super Attack";
    let mainDokkanClass = "dokkan-sa-standard";
    let mainNumClass = "num-standard";
    let mainBannerType = "standard";
    let mainAuraClass = "sa-card-standard";
    let mainColor = '#facc15';

    if (isExMain) {
        mainDokkanTitle = "EX Super Attack";
        mainDokkanClass = "dokkan-sa-ex";
        mainNumClass = "num-ex";
        mainBannerType = "ex";
        mainAuraClass = "sa-card-ex";
        mainColor = '#facc15';
    } else if (isUnitSa) {
        mainDokkanTitle = (isLR && (currentKi >= 18 || mainSaBlock?.is_unit_ultra)) ? "Unit Ultra Super Attack" : "Unit Super Attack";
        mainDokkanClass = "dokkan-sa-unit";
        mainNumClass = "num-unit";
        mainBannerType = "unit";
        mainAuraClass = "sa-card-unit";
        mainColor = '#c084fc';
    } else if (isLR && (currentKi >= 18 || targetMainSaIdx === 1)) {
        mainDokkanTitle = "Ultra Super Attack";
        mainDokkanClass = "dokkan-sa-ultra";
        mainNumClass = "num-ultra";
        mainBannerType = "ultra";
        mainAuraClass = "sa-card-ultra";
        mainColor = '#fb923c';
    }

    // Command LWF Banner
    if (window.DokkanBattleAnimator && typeof window.DokkanBattleAnimator.playMainBanner === 'function') {
        window.DokkanBattleAnimator.playMainBanner(mainBannerType);
    }

    // Apply the active animated aura class cleanly without conflicting inline styles
    const mainSaCard = document.getElementById('res-main-sa-card');
    if (mainSaCard) {
        mainSaCard.style.removeProperty('border-color');
        mainSaCard.style.removeProperty('box-shadow');
        mainSaCard.className = `ds-dash-card liquid-glass-surface view-atk-only ${mainAuraClass}`;
    }

    const finalAtkDisp = document.getElementById('res-final-atk');
    if (finalAtkDisp) {
        finalAtkDisp.className = `ds-dash-value ${mainNumClass}`;
        finalAtkDisp.innerText = finalFirstAtk.toLocaleString();
    }

    const kiLabel = document.getElementById('res-final-ki-info');
    if (kiLabel) {
        kiLabel.innerHTML = `${mainKiBadge} | <span style="background: rgba(0, 0, 0, 0.4); color: ${mainColor}; border: 1px solid currentColor; padding: 1px 5px; border-radius: 4px;">${totalFirstSaMult}% Mult</span>`;
        kiLabel.style.color = mainColor;
    }

    const mainTitleEl = document.getElementById('res-main-sa-title-text');
    if (mainTitleEl) {
        mainTitleEl.className = `dokkan-sa-title ${mainDokkanClass}`;
        mainTitleEl.innerText = mainDokkanTitle;
    }

    // 1. PURPLE UNIT SA BUTTON
    const mainSaUnitWrap = document.getElementById('res-main-sa-unit-btn-wrap');
    if (mainSaUnitWrap) {
        if (unitCaps.hasUnitSa) {
            const isSelected = (window.activeUnitSaBlockIdx !== null);
            const badgeLabel = unitCaps.count > 1 ? `UNIT SA (${unitCaps.count})` : 'UNIT SA';
            mainSaUnitWrap.innerHTML = `
                <button type="button" 
                        onclick="window.handleUnitSaToggleClick()" 
                        class="unit-sa-toggle-badge ${isSelected ? 'active' : 'inactive'}" 
                        title="${unitCaps.count > 1 ? 'Click to select Unit Super Attack' : 'Toggle Unit Super Attack'}">
                    ${isSelected ? '● ' + badgeLabel : badgeLabel}
                </button>
            `;
            mainSaUnitWrap.style.display = 'block';
        } else {
            mainSaUnitWrap.innerHTML = '';
            mainSaUnitWrap.style.display = 'none';
        }
    }

    // 2. GOLDEN EX TOGGLE BUTTON
    const mainSaExWrap = document.getElementById('res-main-sa-ex-btn-wrap');
    if (mainSaExWrap) {
        if (canBeExMain) {
            mainSaExWrap.innerHTML = `
                <button type="button" 
                        onclick="window.togglePerAttackEx(0)" 
                        class="ex-toggle-badge ${isExMain ? 'active' : 'inactive'}" 
                        title="Toggle EX Super Attack">
                    ${isExMain ? 'EX ON' : 'EX OFF'}
                </button>
            `;
            mainSaExWrap.style.display = 'contents';
        } else {
            mainSaExWrap.innerHTML = '';
            mainSaExWrap.style.display = 'none';
        }
    }

    // --- TOP DASHBOARD UI UPDATES & TAB VISIBILITY ENFORCEMENT ---
    const isAtkTab = (window.currentCalcTab === 'atk');
    const isDefTab = (window.currentCalcTab === 'def');

    // Strict tab control for DEF cards
    const sotDefCard = document.getElementById('res-sot-def')?.closest('.ds-dash-card');
    const postDefCard = document.getElementById('res-post-def')?.closest('.ds-dash-card');
    const dmgTakenCard = document.getElementById('res-damage-taken')?.closest('.ds-dash-card');
    if (sotDefCard) {
        sotDefCard.classList.add('view-def-only');
        sotDefCard.style.display = isDefTab ? '' : 'none';
    }
    if (postDefCard) {
        postDefCard.classList.add('view-def-only');
        postDefCard.style.display = isDefTab ? '' : 'none';
    }
    if (dmgTakenCard) {
        dmgTakenCard.classList.add('view-def-only');
        dmgTakenCard.style.display = isDefTab ? '' : 'none';
    }

    if (mainSaCard) {
        mainSaCard.classList.add('view-atk-only');
        mainSaCard.style.display = isAtkTab ? '' : 'none';
    }

    // Clean up any old dynamic cards or dividers
    const dynamicAddContainer = document.getElementById('res-dynamic-additional-sas');
    if (dynamicAddContainer) dynamicAddContainer.innerHTML = '';
    document.querySelectorAll('.dynamic-dash-divider').forEach(el => el.remove());

    const activeDashCard = document.getElementById('res-active-skill-dash-card');
    if (activeDashCard) {
        if (activeSkillActive && activeIsAttack) {
            const tempActiveAtk = parseFloat(document.getElementById('calc-active-temp-atk')?.value) || 0;
            const activeTotalSaMult = activeSaBaseInput + hipoBoost + tempActiveAtk;
            const activeKiMult = isLR ? (parseFloat(document.getElementById('calc-ki-mult-base')?.value) / 100 || 2.0) : 1.5;
            const activeP2Mult = 1 + ((totalP2Atk + getOnSaWithinTurnAtkForSeq(1)) / 100);
            
            let activeAtkBeforeSa = Math.floor(atkStepBeforeKi * activeKiMult);
            activeAtkBeforeSa = Math.floor(activeAtkBeforeSa * activeP2Mult);
            const finalActiveAtkStat = Math.floor(activeAtkBeforeSa * (activeTotalSaMult / 100));

            activeDashCard.style.display = isAtkTab ? '' : 'none';
            
            const actAtkVal = document.getElementById('res-active-atk-val');
            if (actAtkVal) {
                actAtkVal.className = 'ds-dash-value num-active'; // reset base
                actAtkVal.innerText = finalActiveAtkStat.toLocaleString();
                actAtkVal.style.color = '#fb923c';
            }

            const actDmgCol = document.getElementById('res-act-dmg-col');
            const actDmgVal = document.getElementById('res-act-effective-dmg');
            const actDmgLbl = document.getElementById('res-act-dmg-label');
            if (actDmgCol && actDmgVal && actDmgLbl) {
                if (window.calcCritEnabled || window.calcSeEnabled) {
                    actDmgCol.style.display = 'flex';
                    actDmgVal.className = `ds-dash-value num-active ${window.calcCritEnabled ? 'crit-fx' : 'se-fx'}`;
                    actDmgVal.innerText = window.calcEnemyDamage(finalActiveAtkStat, window.calcCritEnabled, window.calcSeEnabled).toLocaleString();
                    if (window.calcCritEnabled && window.calcSeEnabled) {
                        actDmgLbl.innerText = 'CRIT + EFF. DMG';
                        actDmgLbl.style.color = '#facc15';
                    } else if (window.calcCritEnabled) {
                        actDmgLbl.innerText = 'CRIT DMG TO ENEMY';
                        actDmgLbl.style.color = '#facc15';
                    } else {
                        actDmgLbl.innerText = 'EFF. DMG TO ENEMY';
                        actDmgLbl.style.color = '#38bdf8';
                    }
                } else {
                    actDmgCol.style.display = 'none';
                }
            }
            
            const actMultLabel = document.getElementById('res-active-sa-mult-info');
            if (actMultLabel) {
                let dispText = "Ultimate Damage";
                if (tempActiveAtk > 0) dispText += ` (+${tempActiveAtk}% ATK)`;
                actMultLabel.innerHTML = `${dispText} | <span style="background: rgba(234, 88, 12, 0.15); color: #fb923c; border: 1px solid rgba(234, 88, 12, 0.4); padding: 1px 5px; border-radius: 4px;">${activeTotalSaMult}% Mult</span>`;
            }
        } else {
            activeDashCard.style.display = 'none';
        }
    }

    const counterDashCard = document.getElementById('res-sa-counter-dash-card');
    
    if (counterDashCard) {
        if (isSaCounterTriggered) {
            counterDashCard.style.display = isAtkTab ? '' : 'none';
            counterDashCard.style.gridColumn = '1 / -1';
            
            const saCounterAtkVal = document.getElementById('res-sa-counter-atk-val');
            if (saCounterAtkVal) {
                saCounterAtkVal.innerText = finalSaCounterAtkStat.toLocaleString();
                saCounterAtkVal.style.color = '#38bdf8';
            }
            
            const counterMultLabel = document.getElementById('res-sa-counter-mult-info');
            if (counterMultLabel) {
                const timingMode = activeSaCounterLine.counterTiming || "after";
                const timingText = timingMode === 'before' ? 'Before SA' : 'After SA';
                const powerName = activeSaCounterLine.counterPowerName || 'Tremendous';
                counterMultLabel.innerHTML = `SA Counter (${timingText}) | <span style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.4); padding: 1px 5px; border-radius: 4px;">📊 ${counterTotalSaMult}% Mult (${powerName})</span>`;
            }
        } else {
            counterDashCard.style.display = 'none';
        }
    }

    let ncContainer = document.getElementById('res-dynamic-normal-counters');
    if (!ncContainer) {
        if (counterDashCard) {
            ncContainer = document.createElement('div');
            ncContainer.id = 'res-dynamic-normal-counters';
            ncContainer.style.display = 'contents';
            counterDashCard.parentNode.insertBefore(ncContainer, counterDashCard.nextSibling);
        }
    }
    if (ncContainer) {
        let normalCounterHtml = '';
        if (isAtkTab) {
            calculatedNormalCounters.forEach((nc) => {
                normalCounterHtml += `
                    <div class="ds-dash-card liquid-glass-surface view-atk-only sa-card-norm-counter" style="grid-column: 1 / -1; width: 100%;">
                        <div style="margin-bottom: 2px;">
                            <span class="dokkan-sa-title dokkan-sa-counter" style="background-image: linear-gradient(180deg, #ffffff 0%, #d1fae5 25%, #34d399 60%, #059669 100%) !important;">Normal Counter</span>
                        </div>
                        <span class="ds-dash-value num-norm-counter">${nc.stat.toLocaleString()}</span>
                        <div style="font-size: 10px; color: #34d399; font-weight: 800; margin-top: 3px;">
                            ${nc.count}x Counters | <span style="background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.4); padding: 1px 5px; border-radius: 4px;">📊 ${nc.mult}% Mult (${nc.powerName})</span>
                        </div>
                    </div>
                `;
            });
        }
        ncContainer.innerHTML = normalCounterHtml;
    }

    if (dynamicAddContainer) {
        let addCardsHtml = '';
        if (isAtkTab) {
            calculatedAdditionals.forEach((addObj) => {
                let addSaType = 'standard';
                let addNumClass = 'num-standard';
                let addAuraClass = 'sa-card-standard';
                let addColor = '#facc15';

                if (addObj.isEx) {
                    addSaType = 'ex';
                    addNumClass = 'num-ex';
                    addAuraClass = 'sa-card-ex';
                    addColor = '#facc15';
                } else if (addObj.isUltra) {
                    addSaType = 'ultra';
                    addNumClass = 'num-ultra';
                    addAuraClass = 'sa-card-ultra';
                    addColor = '#fb923c';
                }

                const exBtnHtml = addObj.canBeEx ? `
                    <button type="button" 
                            onclick="window.togglePerAttackEx(${addObj.idx})" 
                            class="ex-toggle-badge ${addObj.isEx ? 'active' : 'inactive'}" 
                            title="Toggle EX Super Attack">
                        ${addObj.isEx ? 'EX ON' : 'EX OFF'}
                    </button>
                ` : '';

                const saSeqNum = (addObj.idx || 0) + 1;
                const effDmgHtml = `
                    <div class="stat-dmg-split" style="justify-content: center; margin: 4px 0;">
                        <div class="stat-col" style="text-align: center; width: 100%;">
                            <span class="stat-label-mini">ATK STAT</span>
                            <span class="ds-dash-value ${addNumClass}" style="margin: 0 !important;">${addObj.stat.toLocaleString()}</span>
                        </div>
                    </div>`;

                let imgSrc = 'assets/battle/super_atk_static.png';
                if (addSaType === 'ultra') imgSrc = 'assets/battle/u_super_atk_static.png';
                if (addSaType === 'ex') imgSrc = 'assets/battle/ex_super_atk_static.png';
                if (addSaType === 'unit') imgSrc = 'assets/battle/unit_super_atk.png';

                addCardsHtml += `
                    <div class="ds-dash-card liquid-glass-surface ${addAuraClass} view-atk-only" style="position: relative;">
                        <div class="sa-top-left-seq-badge">${saSeqNum} SA</div>
                        ${exBtnHtml}
                        <div class="sa-banner-lwf-container banner-${addSaType}">
                            <img class="sa-banner-unit-img sa-static-override" src="${imgSrc}" style="display: none;" id="res-add-sa-img-${addObj.idx}">
                            <canvas id="res-add-sa-lwf-canvas-${addObj.idx}" class="sa-banner-lwf-embed"></canvas>
                        </div>
                        ${effDmgHtml}
                        <div style="font-size: 10px; color: ${addColor}; font-weight: 800; margin-top: 3px;">
                            ${addObj.kiBadge} | <span style="background: rgba(0, 0, 0, 0.4); color: ${addColor}; border: 1px solid currentColor; padding: 1px 5px; border-radius: 4px;">${addObj.mult}% Mult</span>
                        </div>
                    </div>
                `;

                setTimeout(() => {
                    if (window.DokkanBattleAnimator && typeof window.DokkanBattleAnimator.attachAdditionalBanner === 'function') {
                        window.DokkanBattleAnimator.attachAdditionalBanner(`res-add-sa-lwf-canvas-${addObj.idx}`, addSaType);
                    }
                }, 50);
            });
        }
        dynamicAddContainer.innerHTML = addCardsHtml;
    }

    const activeIsCrit = window.calcCritEnabled || document.getElementById('calc-is-crit')?.checked || false;
    const activeIsSeat = window.calcSeEnabled || document.getElementById('calc-is-seat')?.checked || false;

    renderMultiAttackDamageDealtTable(
        atkStepBeforeKi, totalP2Atk, targetMainSaIdx, lowestKiSaIdx, 
        calculatedAdditionals, hipoBoost, activeKiMult1, currentKi,
        activeIsCrit, 
        activeIsSeat,
        isSaCounterTriggered, finalSaCounterAtkStat, counterTotalSaMult, activeSaCounterLine?.counterTiming || 'after',
        calculatedNormalCounters,
        saCounterTriggerCat,
        finalFirstAtk,
        totalFirstSaMult,
        isExMain,
        canBeExMain,
        mainDokkanTitle,
        activeSkillActive,
        activeIsAttack,
        activeSaBaseInput
    );
    calculateDamageTaken(postSuperDef);
    
    // Auto-update the Stats Card Preview whenever stats change
    window.renderDokkanStatsCardData();
}

function renderMultiAttackDamageDealtTable(
    atkStepBeforeKi, baseP2Atk, targetMainSaIdx, lowestKiSaIdx, 
    calculatedAdditionals, hipoBoost, activeKiMult1, currentKi, isCrit, isSEAT, 
    saCounterActive = false, saCounterAtkStat = 0, saCounterMult = 300, saCounterTiming = 'after',
    normalCounters = [],
    saCounterTriggerCat = "Super Attack",
    finalFirstAtk = 0,
    totalFirstSaMult = 505,
    isExMain = false,
    canBeExMain = false,
    mainDokkanTitle = "Super Attack",
    activeSkillActive = false,
    activeIsAttack = false,
    activeSaBaseInput = 550
) {
    const tableContainer = document.getElementById('calc-boss-damage-rows');
    if (!tableContainer) return;

    const isCritActive = isCrit || window.calcCritEnabled || false;
    const isSeActive = isSEAT || window.calcSeEnabled || false;

    const bossType = (document.getElementById('calc-boss-type')?.value || 'AGL').toUpperCase();
    const bossClass = (document.getElementById('calc-boss-class')?.value || 'Extreme');
    const cardType = (window.currentCalcType || 'AGL').toUpperCase();
    const cardClass = (window.currentCalcClass || 'Super');

    const modObj = window.getDokkanTypeAndClassMultiplier(cardType, cardClass, bossType, bossClass, isCritActive, isSeActive);
    let finalTypeMod = modObj.typeModifier;

    const isLR = (window.currentCalcRarity === 'LR');
    const saBlocksData = window.lastParsedSaBlocksData || [];
    const mainSaBlock = saBlocksData[targetMainSaIdx] || null;
    const mainKiBadge = mainSaBlock?.kiText || (isLR ? `${currentKi} Ki` : `${Math.min(12, currentKi)} Ki`);

    const allAttacks = [];

    // 1. Standalone Active Skill Attack
    if (activeSkillActive && activeIsAttack) {
        const tempActiveAtk = parseFloat(document.getElementById('calc-active-temp-atk')?.value) || 0;
        const activeKiMult = isLR ? (parseFloat(document.getElementById('calc-ki-mult-base')?.value) / 100 || 2.0) : 1.5;
        const activeP2Mult = 1 + ((baseP2Atk + getOnSaWithinTurnAtkForSeq(1)) / 100);
        
        let activeAtkBeforeSa = Math.floor(atkStepBeforeKi * activeKiMult);
        activeAtkBeforeSa = Math.floor(activeAtkBeforeSa * activeP2Mult);
        
        const activeTotalSaMult = activeSaBaseInput + hipoBoost + tempActiveAtk;
        const finalActiveAtkStat = Math.floor(activeAtkBeforeSa * (activeTotalSaMult / 100));

        const actName = document.getElementById('calc-active-skill-title')?.innerText || "Active Skill";

        allAttacks.push({
            idx: -1,
            label: actName,
            atkStat: finalActiveAtkStat,
            totalSaMult: activeTotalSaMult,
            count: 1,
            color: '#fb923c',
            bg: 'rgba(234, 88, 12, 0.15)',
            border: 'rgba(234, 88, 12, 0.4)'
        });
    }

    // 2. SA Counter Before SA
    if (saCounterActive && saCounterAtkStat > 0 && saCounterTiming === 'before') {
        allAttacks.push({
            idx: -2,
            label: `SA Counter (${saCounterTriggerCat} - Before SA)`,
            atkStat: saCounterAtkStat,
            totalSaMult: saCounterMult,
            count: 1,
            color: '#38bdf8',
            bg: 'rgba(56, 189, 248, 0.15)',
            border: 'rgba(56, 189, 248, 0.4)'
        });
    }

    // 3. 1st Super Attack
    let mainColor = '#facc15';
    let mainBg = 'rgba(250, 204, 21, 0.15)';
    let mainBorder = 'rgba(250, 204, 21, 0.4)';

    if (isExMain) {
        mainColor = '#f87171';
        mainBg = 'rgba(239, 68, 68, 0.15)';
        mainBorder = 'rgba(239, 68, 68, 0.4)';
    } else if (window.activeUnitSaBlockIdx !== null) {
        mainColor = '#c084fc';
        mainBg = 'rgba(192, 132, 252, 0.15)';
        mainBorder = 'rgba(192, 132, 252, 0.4)';
    } else if (isLR && currentKi >= 18) {
        mainColor = '#fb923c';
        mainBg = 'rgba(249, 115, 22, 0.15)';
        mainBorder = 'rgba(249, 115, 22, 0.4)';
    }

    allAttacks.push({
        idx: 0,
        label: `${mainDokkanTitle} (${mainKiBadge})`,
        atkStat: finalFirstAtk,
        totalSaMult: totalFirstSaMult,
        count: 1,
        color: mainColor,
        bg: mainBg,
        border: mainBorder,
        isEx: isExMain,
        isUnit: (window.activeUnitSaBlockIdx !== null)
    });

    // 4. Sequential Additionals
    calculatedAdditionals.forEach((addObj) => {
        let addColor = '#facc15';
        let addBg = 'rgba(250, 204, 21, 0.15)';
        let addBorder = 'rgba(250, 204, 21, 0.4)';

        if (addObj.isEx) {
            addColor = '#f87171';
            addBg = 'rgba(239, 68, 68, 0.15)';
            addBorder = 'rgba(239, 68, 68, 0.4)';
        } else if (addObj.isUnit) {
            addColor = '#c084fc';
            addBg = 'rgba(192, 132, 252, 0.15)';
            addBorder = 'rgba(192, 132, 252, 0.4)';
        }

        allAttacks.push({
            idx: addObj.idx,
            label: `${addObj.label} (${addObj.kiBadge})`,
            atkStat: addObj.stat,
            totalSaMult: addObj.mult,
            count: 1,
            color: addColor,
            bg: addBg,
            border: addBorder
        });
    });

    // 5. SA Counter After SA
    if (saCounterActive && saCounterAtkStat > 0 && saCounterTiming === 'after') {
        allAttacks.push({
            idx: -3,
            label: `SA Counter (${saCounterTriggerCat} - After SA)`,
            atkStat: saCounterAtkStat,
            totalSaMult: saCounterMult,
            count: 1,
            color: '#38bdf8',
            bg: 'rgba(56, 189, 248, 0.15)',
            border: 'rgba(56, 189, 248, 0.4)'
        });
    }

    // 6. Normal Attack Counters
    normalCounters.forEach((nc, ncIdx) => {
        allAttacks.push({
            idx: -10 - ncIdx,
            label: `Normal Counter (${nc.powerName} Power)`,
            atkStat: nc.stat,
            totalSaMult: nc.mult,
            count: nc.count,
            color: '#34d399',
            bg: 'rgba(16, 185, 129, 0.15)',
            border: 'rgba(16, 185, 129, 0.4)'
        });
    });

    let htmlBuffer = '';
    let seqSaCount = 1;

    allAttacks.forEach((atk, atkIdx) => {
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
    window.lastCalculatedAttacks = allAttacks;
}

function calculateDamageTaken(playerDef) {
    const enemyAtk = parseFloat(document.getElementById('calc-enemy-atk')?.value) || 0;
    const drPct = parseFloat(document.getElementById('calc-dr')?.value) || 0;
    const isGuard = document.getElementById('calc-guard')?.checked || false;

    const drMult = 1 - (drPct / 100);
    const guardMult = isGuard ? 0.5 : 1.0;

    const rawDamage = (enemyAtk * drMult) - playerDef;
    const finalDamage = Math.max(0, rawDamage * guardMult);

    const displayEl = document.getElementById('res-damage-taken');
    if (!displayEl) return;

    if (finalDamage <= 0) {
        displayEl.innerText = "< 100";
        displayEl.style.color = "#38bdf8";
    } else {
        displayEl.innerText = Math.floor(finalDamage).toLocaleString();
        displayEl.style.color = "#f87171";
    }
}


/* ==========================================================================
   FINAL CARD OVERLAY (DOKKAN STATS DISPLAY)
   ========================================================================== */

function getCustomCardMediaFromDoc() {
    if (!window.currentLoadedCardMeta || !window.currentLoadedCardMeta.cardItemMeta || !window.currentLoadedCardMeta.cardItemMeta.doc) return null;
    
    const doc = window.currentLoadedCardMeta.cardItemMeta.doc;
    const isLocalCustom = window.currentLoadedCardMeta.cardItemMeta.cardUrl.includes('localhost') || window.currentLoadedCardMeta.cardItemMeta.cardUrl.includes('127.0.0.1');

    // Prioritize videos first
    const videoSource = doc.querySelector('#myOverlayVideo source');
    if (videoSource) {
        let src = videoSource.getAttribute('src');
        if (src) {
            if (!src.startsWith('http')) {
                src = window.currentLoadedCardMeta.cardItemMeta.cardUrl + src.replace(/^\.\//, '');
            }
            return { type: 'video', url: src };
        }
    }

    const imgSource = doc.querySelector('#myOverlayImage');
    if (imgSource) {
        let src = imgSource.getAttribute('src');
        if (src) {
            if (!src.startsWith('http')) {
                src = window.currentLoadedCardMeta.cardItemMeta.cardUrl + src.replace(/^\.\//, '');
            }
            return { type: 'image', url: src };
        }
    }

    return null;
}

window.renderDokkanStatsCardData = function() {
    const isAtk = window.currentCalcTab === 'atk';
    const isCustom = window.currentLoadedCardMeta?.cardItemMeta?.source === 'custom';
    
    let charMediaHtml = '';
    let bgUrl = '';

    if (isCustom) {
        const customMedia = getCustomCardMediaFromDoc();
        if (customMedia) {
            if (customMedia.type === 'video') {
                charMediaHtml = `<video src="${customMedia.url}" muted playsinline loop autoplay></video>`;
            } else {
                charMediaHtml = `<img src="${customMedia.url}">`;
            }
            bgUrl = '#020617';
        } else {
            const thumbImg = document.getElementById('calc-char-thumb');
            if (thumbImg && thumbImg.src) {
                const charUrl = thumbImg.src.replace('_thumb.png', '_character.png').replace('_circle.png', '_character.png');
                bgUrl = `url('${charUrl.replace('_character.png', '_bg.png')}')`;
                charMediaHtml = `<img src="${charUrl}">`;
            }
        }
    } else if (window.currentLoadedCardMeta && window.currentLoadedCardMeta.rawCard) {
        const rawCard = window.currentLoadedCardMeta.rawCard;
        if (typeof resolveCardAssets === 'function') {
            const assets = resolveCardAssets(rawCard);
            const formatUrl = (path) => {
                if (!path) return '';
                if (path.startsWith('http')) return path;
                const cleanPath = path.replace('assets/card/', '');
                return `https://images.weserv.nl/?url=dokkaninfo.com/assets/japan/character/card/${cleanPath}`;
            };
            charMediaHtml = `<img src="${formatUrl(assets.charUrl)}">`;
            
            const folderId = Math.floor(parseInt(rawCard.id, 10) / 10) * 10;
            const isTrans = parseInt(rawCard.id, 10) >= 4000000;
            const parentFolderId = isTrans ? (Math.floor(getRootParentId(rawCard) / 10) * 10) : folderId;
            bgUrl = `url('https://images.weserv.nl/?url=dokkaninfo.com/assets/japan/character/card/${isTrans ? parentFolderId : folderId}/card_${isTrans ? parentFolderId : folderId}_bg.png')`;
            
            const fxUrl = `https://images.weserv.nl/?url=dokkaninfo.com/assets/japan/character/card/${isTrans ? parentFolderId : folderId}/card_${isTrans ? parentFolderId : folderId}_effect.png`;
            charMediaHtml += `<img src="${fxUrl}" class="sc-effect-img" onerror="this.style.display='none'">`;
        }
    }

    // Determine specific link color from theme
    const typeColors = { agl: '#38bdf8', teq: '#4ade80', int: '#c084fc', str: '#f87171', phy: '#fbbf24' };
    const activeColor = typeColors[window.currentType] || '#38bdf8';

    // Top Panel Info
    const hipoVal = currentHipoPreset === '0' ? '0%' : `${currentHipoPreset}%`;
    const leadVal = parseInt(document.getElementById('calc-lead')?.value || 0) / 2;
    const statLbl = isAtk ? 'Unit ATK:' : 'Unit DEF:';
    const statVal = parseInt(document.getElementById(isAtk ? 'calc-base-atk' : 'calc-base-def').value || 0).toLocaleString();
    const statValColor = '#ffffff';
    const statValGlow = 'text-shadow: 0 0 8px rgba(255, 255, 255, 0.4);';
    const lsColor = '#ffffff';
    const lsGlow = 'text-shadow: 0 0 8px rgba(255, 255, 255, 0.4);';

    // Links (show only ATK-boosting links on ATK tab, and DEF-boosting links on DEF tab)
    const filteredLinks = activeCharacterLinks.filter(l => {
        if (!l.active) return false;
        return isAtk ? (l.atk > 0) : (l.def > 0);
    });
    const linkListHtml = filteredLinks.length > 0 
        ? filteredLinks.map(l => `- ${l.name}`).join('<br>')
        : '<span style="color: #cbd5e1; font-size: 9px; font-style: italic;">None</span>';

    const linkTotal = isAtk ? document.getElementById('calc-link-atk').value : document.getElementById('calc-link-def').value;
    const linkTotalText = `${isAtk ? 'ATK' : 'DEF'} +${linkTotal}%`;
    const linksTitleColor = '#ffffff';
    const linksTitleGlow = 'text-shadow: 0 0 8px rgba(255, 255, 255, 0.4);';
    const linkTotalColor = '#ffffff';
    const linkTotalGlow = 'text-shadow: 0 0 8px rgba(255, 255, 255, 0.4);';

    // Base Profile
    const charName = document.getElementById('calc-char-name-text')?.innerText || 'Character';
    const raritySrc = document.getElementById('calc-rarity-img')?.src || '';
    const typeSrc = document.getElementById('calc-type-img')?.src || '';

    // Dynamic Rows
    let rowsHtml = '';
    let totalHtml = '';

    if (isAtk) {
        let totalDmg = 0;
        if (window.lastCalculatedAttacks) {
            window.lastCalculatedAttacks.forEach(atk => {
                if (atk.idx < -1) return; 
                
                const count = atk.count || 1;
                const dmg = window.calcEnemyDamage ? window.calcEnemyDamage(atk.atkStat, window.calcCritEnabled, window.calcSeEnabled) : atk.atkStat;
                totalDmg += (dmg * count);
                
                let cleanLabel = atk.label.replace(/\[.*?\]|\(.*?\)/g, '').trim();
                const rawLow = (atk.label + ' ' + cleanLabel).toLowerCase();
                const isExAtk = Boolean(atk.isEx || /\bex\b/i.test(atk.label) || /\bex\b/i.test(cleanLabel));
                const isUnitAtk = Boolean(atk.isUnit || /\bunit\b/i.test(atk.label) || /\bunit\b/i.test(cleanLabel));

                if (/\bultra\b/i.test(rawLow) || (atk.idx === 0 && /\b(18 ki|24 ki)\b/i.test(atk.label))) {
                    if (isExAtk) cleanLabel = 'EX Ultra';
                    else if (isUnitAtk) cleanLabel = 'Unit Ultra';
                    else cleanLabel = 'Ultra';
                } else if (/\bactive\b/i.test(rawLow) || atk.idx === -1) {
                    cleanLabel = 'Active';
                } else if (/\bsa counter\b/i.test(rawLow)) {
                    cleanLabel = 'SA Counter';
                } else if (/\bnormal counter\b/i.test(rawLow) || /\bcounter\b/i.test(rawLow)) {
                    cleanLabel = 'Normal Counter';
                } else if (/\bsuper attack\b|\b12 ki sa\b/i.test(rawLow) || atk.idx >= 0) {
                    if (isExAtk) cleanLabel = 'EX Super Attack';
                    else if (isUnitAtk) cleanLabel = 'Unit Super Attack';
                    else cleanLabel = 'Super Attack';
                }

                let numClass = 'sc-val-standard';
                if (isExAtk) {
                    numClass = 'sc-val-ex';
                } else if (isUnitAtk) {
                    numClass = 'sc-val-unit';
                } else if (/\bultra\b/i.test(cleanLabel) || /\bultra\b/i.test(atk.label) || /\b(24 ki|18 ki)\b/i.test(atk.label)) {
                    numClass = 'sc-val-ultra';
                } else if (/\bactive\b/i.test(cleanLabel) || /\bactive\b/i.test(atk.label) || atk.idx === -1) {
                    numClass = 'sc-val-active';
                }

                rowsHtml += `
                    <div class="sc-row" style="background: linear-gradient(90deg, rgba(0,0,0,0.8) 0%, rgba(250,204,21,0.05) 100%);">
                        <span class="sc-row-lbl" style="color: #cbd5e1;">${cleanLabel} ${count > 1 ? `(x${count})` : ''}</span>
                        <span class="sc-row-val ${numClass}" style="display: inline-flex; align-items: center;">${atk.atkStat.toLocaleString()}</span>
                    </div>
                `;
            });
        }

        const modBadges = [];
        if (window.calcCritEnabled) modBadges.push('<span style="color:#facc15; font-size:8.5px; font-weight:900; background:rgba(250,204,21,0.15); padding:1px 5px; border-radius:4px; border:1px solid rgba(250,204,21,0.3); display:inline-flex; align-items:center; gap:3px;"><img src="https://abscustom.github.io/assets/images/st_critical_up.png" style="height:10px; width:10px; object-fit:contain;"> CRIT</span>');
        if (window.calcSeEnabled) modBadges.push('<span style="color:#38bdf8; font-size:8.5px; font-weight:900; background:rgba(56,189,248,0.15); padding:1px 5px; border-radius:4px; border:1px solid rgba(56,189,248,0.3); display:inline-flex; align-items:center; gap:3px;"><img src="https://abscustom.github.io/assets/images/st_atk_super.png" style="height:10px; width:10px; object-fit:contain;"> SUPER EFF</span>');
        if (window.calcAdditionalEnabled) modBadges.push('<span style="color:#a78bfa; font-size:8.5px; font-weight:900; background:rgba(167,139,250,0.15); padding:1px 5px; border-radius:4px; border:1px solid rgba(167,139,250,0.3); display:inline-flex; align-items:center; gap:3px;"><img src="https://abscustom.github.io/assets/images/st_atk_combo.png" style="height:10px; width:10px; object-fit:contain;"> COMBO</span>');
        const modifierBadgesHtml = modBadges.length > 0 ? `<div class="stats-modifier-row" style="display:flex; gap:4px; justify-content:center; margin-top:4px; flex-wrap:wrap;">${modBadges.join('')}</div>` : '';

        totalHtml = `
            <div class="stats-total-row" style="display: flex;">
                <span class="total-lbl">EXPECTED TOTAL DAMAGE</span>
                <span class="total-val">${totalDmg.toLocaleString()}</span>
            </div>
            ${modifierBadgesHtml}
        `;
    } else {
        const sotDef = document.getElementById('res-sot-def')?.innerText || '0';
        const postDef = document.getElementById('res-post-def')?.innerText || '0';
        const dmgTaken = document.getElementById('res-damage-taken')?.innerText || '0';
        const drPct = document.getElementById('calc-dr')?.value || '0';
        const enemySa = parseInt(document.getElementById('calc-enemy-atk')?.value || 0).toLocaleString();
        const isGuard = document.getElementById('calc-guard')?.checked ? '<span style="color:#a855f7; margin-left:6px;">[GUARD]</span>' : '';

        rowsHtml = `
            <div class="sc-row" style="background: rgba(56,189,248,0.15); border-color: rgba(56,189,248,0.4);">
                <span class="sc-row-lbl" style="color: #38bdf8;">DR: ${drPct}% ${isGuard}</span>
                <span class="sc-row-lbl" style="color: #f87171;">ENEMY SA: ${enemySa}</span>
            </div>
            <div class="sc-row" style="background: linear-gradient(90deg, rgba(0,0,0,0.8) 0%, rgba(52,211,153,0.05) 100%);">
                <span class="sc-row-lbl" style="color: #cbd5e1;">BASE (SOT DEF)</span>
                <span class="sc-row-val" style="color: #34d399;">${sotDef}</span>
            </div>
            <div class="sc-row" style="background: linear-gradient(90deg, rgba(0,0,0,0.8) 0%, rgba(52,211,153,0.05) 100%);">
                <span class="sc-row-lbl" style="color: #cbd5e1;">POST SA DEF</span>
                <span class="sc-row-val" style="color: #34d399;">${postDef}</span>
            </div>
            <div class="sc-row" style="margin-top: 8px; border-color: #f87171; background: rgba(248,113,113,0.15);">
                <span class="sc-row-lbl" style="color:#f87171;">DAMAGE TAKEN</span>
                <span class="sc-row-val" style="color:#f87171;">${dmgTaken}</span>
            </div>
        `;
    }

   const fullContentHtml = `
        <div class="stats-card-top">
            <div class="stats-info-box">
                <div><span class="lbl">HiPo:</span> <span class="val" style="color: #ffffff; font-weight: 900;">${hipoVal}</span></div>
                <div><span class="lbl">${statLbl}</span> <span class="val" style="color: #ffffff; font-weight: 900; text-shadow: 0 0 8px rgba(255,255,255,0.4);">${statVal}</span></div>
                <div><span class="lbl">Leader Skill:</span> <span class="val" style="color: #ffffff; font-weight: 900;">${leadVal}%</span></div>
                <div><span class="lbl">Friend LS:</span> <span class="val" style="color: #ffffff; font-weight: 900;">${leadVal}%</span></div>
            </div>
            <div class="stats-links-box">
                <div class="links-title" style="color: #ffffff; text-shadow: 0 0 8px rgba(255,255,255,0.4);">LINKS ACTIVE</div>
                <div class="links-list" style="color: #ffffff;">${linkListHtml}</div>
                <div class="links-total" style="color: #ffffff; font-weight: 900; text-shadow: 0 0 8px rgba(255,255,255,0.4);">${linkTotalText}</div>
            </div>
        </div>
        
        <div class="stats-card-spacer"></div>
        
        <div class="stats-card-bottom">
            <div class="stats-name-row">
                <img src="${raritySrc}" class="sc-rarity-img">
                <img src="${typeSrc}" class="sc-type-img">
                <span class="sc-name">${charName}</span>
            </div>
            <div class="stats-rows-container">${rowsHtml}</div>
            ${totalHtml}
        </div>
    `;

    // Apply to Both Mini Preview & Modal
    const miniBg = document.getElementById('mini-stats-card-bg');
    const miniChar = document.getElementById('mini-stats-card-character-container');
    const miniContent = document.getElementById('mini-stats-card-content');
    
    const modalBg = document.getElementById('stats-card-bg');
    const modalChar = document.getElementById('stats-card-character-container');
    const modalContent = document.getElementById('modal-stats-card-content');

    if (bgUrl && bgUrl !== '#020617') {
        if (miniBg) { miniBg.style.background = 'none'; miniBg.style.backgroundImage = bgUrl; }
        if (modalBg) { modalBg.style.background = 'none'; modalBg.style.backgroundImage = bgUrl; }
    } else {
        if (miniBg) { miniBg.style.backgroundImage = 'none'; miniBg.style.background = bgUrl; }
        if (modalBg) { modalBg.style.backgroundImage = 'none'; modalBg.style.background = bgUrl; }
    }

    if (miniChar) miniChar.innerHTML = charMediaHtml;
    if (modalChar) modalChar.innerHTML = charMediaHtml;

    if (miniContent) miniContent.innerHTML = fullContentHtml;
    if (modalContent) modalContent.innerHTML = fullContentHtml;
};

window.openDokkanStatsCard = function() {
    window.renderDokkanStatsCardData();
    const modal = document.getElementById('dokkan-stats-modal');
    if (modal) modal.style.display = 'flex';
};

window.closeDokkanStatsCard = function() {
    const modal = document.getElementById('dokkan-stats-modal');
    if (modal) modal.style.display = 'none';
};

window.downloadDokkanStatsCard = function() {
    if (typeof window.renderDokkanStatsCardData === 'function') {
        window.renderDokkanStatsCardData();
    }

    if (typeof html2canvas === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        script.onload = () => window.downloadDokkanStatsCard();
        document.head.appendChild(script);
        return;
    }
    
    const cloneWrapper = document.createElement('div');
    cloneWrapper.id = 'dokkan-stats-download-wrap';
    cloneWrapper.className = 'dokkan-stats-download-target';
    cloneWrapper.style.position = 'fixed';
    cloneWrapper.style.top = '0';
    cloneWrapper.style.left = '0';
    cloneWrapper.style.width = '440px';
    cloneWrapper.style.height = '750px';
    cloneWrapper.style.zIndex = '-9999';
    cloneWrapper.style.opacity = '1';
    cloneWrapper.style.pointerEvents = 'none';
    document.body.appendChild(cloneWrapper);

    const cloneContent = document.createElement('div');
    cloneContent.className = 'dokkan-stats-card-container';
    cloneContent.style.width = '440px';
    cloneContent.style.height = '750px';
    cloneContent.style.margin = '0';
    cloneContent.style.borderRadius = '12px'; 
    cloneContent.style.border = '2px solid rgba(255, 255, 255, 0.15)';
    cloneContent.style.position = 'relative';
    cloneContent.style.overflow = 'hidden';
    
    const miniBg = document.getElementById('stats-card-bg') || document.getElementById('mini-stats-card-bg');
    const miniChar = document.getElementById('stats-card-character-container') || document.getElementById('mini-stats-card-character-container');
    const modalContentEl = document.getElementById('modal-stats-card-content') || document.getElementById('mini-stats-card-content');
    
    const modalBg = miniBg ? miniBg.outerHTML : '';
    const modalChar = miniChar ? miniChar.outerHTML : '';
    const modalOverlay = '<div class="stats-card-overlay"></div>';
    const modalContent = `<div class="stats-card-content">${modalContentEl ? modalContentEl.innerHTML : ''}</div>`;
    
    cloneContent.innerHTML = modalBg + modalChar + modalOverlay + modalContent;
    cloneWrapper.appendChild(cloneContent);

    // Sanitize gradient text for html2canvas to render crisp glowing numbers without solid rectangular background blocks
    cloneContent.querySelectorAll('.sc-val-standard, .sc-val-ultra, .sc-val-active, .sc-val-ex, .sc-val-unit, .sc-row-val, .total-val').forEach(el => {
        el.style.setProperty('background', 'none', 'important');
        el.style.setProperty('-webkit-background-clip', 'unset', 'important');
        el.style.setProperty('-webkit-text-fill-color', 'unset', 'important');
        el.style.setProperty('color', '#ffffff', 'important');
        el.style.setProperty('text-shadow', '0 2px 4px rgba(0, 0, 0, 0.9)', 'important');
    });
    cloneContent.querySelectorAll('.stats-total-row').forEach(el => {
        el.style.setProperty('background', 'rgba(0,0,0,0.65)', 'important');
        el.style.setProperty('border', '1px solid rgba(255,255,255,0.15)', 'important');
        el.style.setProperty('box-shadow', 'none', 'important');
    });

    // Freeze video into a still frame for Canvas capture
    const videoEl = cloneContent.querySelector('video');
    if (videoEl) {
        const vidCanvas = document.createElement('canvas');
        vidCanvas.width = 440; vidCanvas.height = 750;
        const ctx = vidCanvas.getContext('2d');
        const sourceVideo = document.querySelector('.stats-card-character-container video');
        if (sourceVideo) {
            ctx.drawImage(sourceVideo, 0, 0, vidCanvas.width, vidCanvas.height);
            const dataUrl = vidCanvas.toDataURL();
            const imgRepl = document.createElement('img');
            imgRepl.src = dataUrl;
            videoEl.replaceWith(imgRepl);
        }
    }

    html2canvas(cloneContent, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#020617',
        scale: 2,
        ignoreElements: function(element) {
            if (element.tagName === 'IMG' && !element.closest('.dokkan-stats-download-target')) {
                return true;
            }
            return false;
        },
        onclone: function(clonedDoc) {
            if (clonedDoc.defaultView) {
                clonedDoc.defaultView.handleHubThumbError = function() {};
            }
            clonedDoc.querySelectorAll('.dokkan-stats-download-target img').forEach(img => {
                img.removeAttribute('onerror');
            });
        }
    }).then(canvas => {
        const link = document.createElement('a');
        link.download = `${document.getElementById('calc-char-name-text')?.innerText || 'Dokkan_Stats'}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        if (cloneWrapper.parentNode) document.body.removeChild(cloneWrapper);
    }).catch(err => {
        console.error("Failed to generate image", err);
        if (cloneWrapper.parentNode) document.body.removeChild(cloneWrapper);
        alert("Failed to download image. Some assets might be blocking it (CORS).");
    });
};
