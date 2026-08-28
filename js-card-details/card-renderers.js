/* ==========================================================================
   absCustom - Card Skill Block Renderers (SA, Active, Field, Standby, Finish)
   ========================================================================== */


   /* ==========================================================================
   absCustom - Card Skill Block Renderers (SA, Active, Field, Standby, Finish)
   ========================================================================== */

function hasValidDisplayText(str) {
    if (!str) return false;
    const clean = String(str).trim().toLowerCase();
    return clean !== '' && clean !== 'none' && clean !== '-' && clean !== 'null' && clean !== 'undefined' && clean !== 'なし';
}

function renderSuperAttacks(card, isEZA = false, mode = currentEzaMode) {
    const saContainer = document.getElementById("abs-sa-container");
    if (!saContainer) return;
    saContainer.innerHTML = "";

    const siblings = (typeof getCardSiblings === 'function') ? getCardSiblings(card) : null;
    const isModeEza = isEZA || mode === 'eza' || mode === 'seza';
    const isModeSeza = (mode === 'seza');

    // 1. Pick the correct super_attacks array for the current active mode
    let saList = [];
    if (isModeSeza && siblings?.seza && Array.isArray(siblings.seza.super_attacks) && siblings.seza.super_attacks.length > 0) {
        saList = siblings.seza.super_attacks;
    } else if (isModeEza && siblings?.eza && Array.isArray(siblings.eza.super_attacks) && siblings.eza.super_attacks.length > 0) {
        saList = siblings.eza.super_attacks;
    } else if (!isModeEza && siblings?.base && Array.isArray(siblings.base.super_attacks) && siblings.base.super_attacks.length > 0) {
        saList = siblings.base.super_attacks;
    } else if (Array.isArray(card.super_attacks) && card.super_attacks.length > 0) {
        saList = card.super_attacks;
    }

    if (!saList || saList.length === 0) return;

    // 2. Sort by Ki requirement
    const sortedSpecials = [...saList].sort((a, b) => (a.eball_num_start || 0) - (b.eball_num_start || 0));

    // 3. Render each Super Attack box in authentic abs.style layout
    sortedSpecials.forEach((specObj, idx) => {
        let saName = specObj.name || specObj.special_name || specObj.title || "Super Attack";
        saName = saName.replace(/\s*\((?:super )?extreme.*?\)/ig, '').trim();
        if (isModeSeza) saName += " (Super Extreme)";
        else if (isModeEza) saName += " (Extreme)";

        const rawDesc = specObj.description || specObj.itemized_description || specObj.effect || specObj.details || "";
        const formattedEffects = formatOfficialText(rawDesc, true).replace(/\n/g, ' ').trim();
        
        let rawSaCond = specObj.condition || specObj.activation_condition || specObj.causality_description || "";
        if (rawSaCond.toLowerCase().includes("power will be increased") || rawSaCond.toLowerCase().includes("sa lv")) {
            rawSaCond = "";
        }
        const formattedSaCond = formatOfficialText(rawSaCond, true).replace(/\n/g, ' ').trim();

        let typeLabel = specObj.type_label || specObj.category || specObj.type || "";
        const saNameLow = (specObj.name || '').toLowerCase();
        const saDescLow = (rawDesc + ' ' + rawSaCond).toLowerCase();
        const saTypeLow = String(typeLabel).toLowerCase();

        const startKi = specObj.eball_num_start || specObj.need_ki || 0;
        const endKi = specObj.eball_num_end || 0;
        const isLR = (card.rarity === 5 || card.rarity === 'lr');

        // Strict Unit SA detection
        const isUnitSa = specObj.is_unit_sa === true || 
                         (typeof isStrictUnitSuperAttack === 'function' ? isStrictUnitSuperAttack(specObj) : false) ||
                         saTypeLow.includes("unit") || 
                         saNameLow.includes("unit") || 
                         /whose\s+name\s+includes|when\s+an?\s+ally/i.test(rawSaCond);

        if (specObj.is_ex || saTypeLow.includes("ex") || saNameLow.includes("ex super") || saDescLow.includes("ex super")) {
            typeLabel = '<span class="abs-ex-prefix">EX</span> Super Attack';
        } else if (isUnitSa && (startKi >= 18 || (isLR && idx >= 1))) {
            typeLabel = "Unit Ultra Super Attack";
        } else if (isUnitSa) {
            typeLabel = "Unit Super Attack";
        } else if (!typeLabel) {
            typeLabel = isLR ? (idx === 0 ? "Super Attack" : "Ultra Super Attack") : "Super Attack";
        }

        const saIcon = getSaIconUrl(specObj, card);
        const autoStats = autoDetectSAStats(rawDesc, saName, specObj);
        const specialEffectsHtml = renderAbsSpecialEffects(autoStats);

        let kiText = "";
        if (startKi > 0) {
            if (endKi > 0 && endKi < 24 && endKi !== startKi) {
                kiText = `${startKi}~${endKi} Ki`;
            } else {
                kiText = `${startKi} Ki`;
            }
        } else {
            const combinedKiSearch = (rawSaCond + " " + rawDesc).toLowerCase();
            const kiMatch = combinedKiSearch.match(/(\d+(?:[–\-~]\d+)?)\s*ki\b/i) || 
                            combinedKiSearch.match(/ki\s*(?:is\s*)?(\d+(?:[–\-~]\d+)?)/i);
            if (kiMatch) {
                kiText = `${kiMatch[1]} Ki`;
            } else {
                kiText = (isLR && idx >= 1) ? '18 Ki' : '12 Ki';
            }
        }

        const damageMultiplierHtml = renderAbsDamageMultiplier(rawDesc, typeLabel, false, kiText);
        const saCategoryName = getSaCategoryName(specObj);
        
        const html = `
            <div class="abs-box mb-3">
                <div class="abs-header">
                    <div class="abs-sa-header-title">
                        <img src="${saIcon}" class="abs-sa-icon-left" data-tooltip="${saCategoryName}" alt="${saCategoryName}">
                        <span class="abs-sa-title-text">${typeLabel} | <em class="abs-sa-name-glow">${saName}</em></span>
                    </div>
                </div>
                <div class="abs-content text-start">
                    ${formattedSaCond ? `
                        <div class="abs-skill-label text-warning mb-1">Condition:</div>
                        <div class="mb-3">${formattedSaCond}</div>
                    ` : ''}
                    <div class="abs-skill-label text-warning mb-1">Effect:</div>
                    <div>${formattedEffects}</div>
                    ${specialEffectsHtml}
                    ${damageMultiplierHtml}
                </div>
            </div>
        `;
        saContainer.insertAdjacentHTML('beforeend', html);
    });
}

function renderDokkanFields(card) {
    const fieldContainer = document.getElementById("abs-field-container");
    if (!fieldContainer) return;
    fieldContainer.innerHTML = "";

    let resolvedFields = [];
    const cidStr = String(card.id);
    const folderIdStr = String(getCardFolderId(card));

    function addField(f) {
        if (f && typeof f === 'object' && !resolvedFields.some(x => x.id === f.id && x.name === f.name)) {
            resolvedFields.push(f);
        }
    }

    if (card.field_id && DB && DB.fields) {
        let found = DB.fields[card.field_id] || DB.fields[String(card.field_id)];
        if (found) addField(found);
    }

    if (resolvedFields.length === 0 && DB && DB.fields) {
        const allFields = Array.isArray(DB.fields) ? DB.fields : Object.values(DB.fields);
        allFields.forEach(f => {
            if (!f) return;
            const fId = String(f.id || '');
            const cId = String(f.card_id || f.character_id || '');
            if (cId === cidStr || fId === cidStr || (fId.length >= 7 && fId.startsWith(cidStr)) || (fId.length >= 7 && fId.startsWith(folderIdStr)) || (card.character_id && f.character_id === card.character_id)) {
                addField(f);
            }
        });
    }

    if (resolvedFields.length === 0 && DB && DB.actives) {
        const allActives = Array.isArray(DB.actives) ? DB.actives : Object.values(DB.actives);
        const act = allActives.find(a => {
            if (!a) return false;
            const aId = String(a.id || '');
            const cId = String(a.card_id || a.character_id || '');
            return cId === cidStr || aId === cidStr || (aId.length >= 7 && aId.startsWith(cidStr)) || (aId.length >= 7 && aId.startsWith(folderIdStr));
        });
        if (act) {
            const actEff = act.effect_description || act.description || act.effect || "";
            const dMatch = actEff.match(/creates the Domain\s*["“]([^"”]+)["”]/i);
            if (dMatch && DB.fields) {
                const cleanDName = dMatch[1].toLowerCase().trim();
                const allFields = Array.isArray(DB.fields) ? DB.fields : Object.values(DB.fields);
                const foundF = allFields.find(f => f && f.name && (f.name.toLowerCase().includes(cleanDName) || cleanDName.includes(f.name.toLowerCase().replace(/^dokkan field\s*[-–—:]?\s*/i, '').trim())));
                if (foundF) addField(foundF);
                else addField({ name: dMatch[1], description: "Domain Effect active while Domain is in play." });
            }
        }
    }

    resolvedFields = resolvedFields.filter(f => {
        if (!f) return false;
        return hasValidDisplayText(f.name) || hasValidDisplayText(f.description) || hasValidDisplayText(f.effect);
    });

    if (resolvedFields.length === 0) return;

    resolvedFields.forEach(fieldObj => {
        let fieldName = (fieldObj.name || "Dokkan Field").replace(/^dokkan field\s*[-–—:]?\s*/i, '').trim();
        const rawEffect = fieldObj.description || fieldObj.itemized_description || fieldObj.effect || "";
        const formattedEffect = formatOfficialText(String(rawEffect), true).replace(/[\r\n]+/g, ' ').trim();
        const rawCond = fieldObj.condition || fieldObj.activation_condition || "";
        const formattedCond = formatOfficialText(String(rawCond), true).replace(/[\r\n]+/g, ' ').trim();

        const fieldId = fieldObj.background_id || fieldObj.id || card.field_id;

        const html = `
            <div class="abs-box mb-3">
                <div class="abs-header">
                    <div class="abs-sa-header-title">
                        ${fieldId ? `
                            <img src="https://abscustom.github.io/assets/images/ing_label_field.png" 
                                 class="abs-sa-icon-left abs-domain-header-icon" 
                                 data-tooltip="Play Domain Animation" 
                                 alt="Play Domain Animation"
                                 onclick="openDomainModal('${fieldId}', '${fieldName.replace(/'/g, "\\'")}')">
                        ` : ''}
                        <span class="abs-sa-title-text">Dokkan Field | <em class="abs-sa-name-glow">${fieldName}</em></span>
                    </div>
                </div>
                <div class="abs-content text-start">
                    ${formattedCond ? `
                        <div class="abs-skill-label text-warning mb-1">Condition:</div>
                        <div class="mb-3">${formattedCond}</div>
                    ` : ''}
                    <div class="abs-skill-label text-warning mb-1">Effect:</div>
                    <div>${formattedEffect || "Dokkan Field effect details unavailable."}</div>
                </div>
            </div>
        `;
        fieldContainer.insertAdjacentHTML('beforeend', html);
    });
}

function renderStandbySkills(card) {
    const standbyContainer = document.getElementById("abs-standby-container");
    if (!standbyContainer) return;
    standbyContainer.innerHTML = "";

    let resolvedStandbys = [];
    const cidStr = String(card.id);
    const folderIdStr = String(getCardFolderId(card));

    function addStandby(s) {
        if (s && typeof s === 'object' && !resolvedStandbys.some(x => x.id === s.id && x.name === s.name)) {
            resolvedStandbys.push(s);
        }
    }

    if (card.standby_id && DB && DB.standbys) {
        let found = DB.standbys[card.standby_id] || DB.standbys[String(card.standby_id)];
        if (found) addStandby(found);
    }

    if (resolvedStandbys.length === 0 && DB && DB.standbys) {
        const all = Array.isArray(DB.standbys) ? DB.standbys : Object.values(DB.standbys);
        all.forEach(s => {
            if (!s) return;
            const sId = String(s.id || '');
            const cId = String(s.card_id || s.character_id || '');
            if (cId === cidStr || sId === cidStr || (sId.length >= 7 && sId.startsWith(cidStr)) || (sId.length >= 7 && sId.startsWith(folderIdStr))) {
                addStandby(s);
            }
        });
    }

    resolvedStandbys = resolvedStandbys.filter(s => {
        if (!s) return false;
        return hasValidDisplayText(s.name) || hasValidDisplayText(s.description) || hasValidDisplayText(s.effect_description) || hasValidDisplayText(s.effect);
    });

    if (resolvedStandbys.length === 0) return;

    resolvedStandbys.forEach(stObj => {
        const name = stObj.name || "Standby Skill";
        const rawEffect = stObj.description || stObj.effect_description || stObj.effect || "";
        const formattedEffect = formatOfficialText(String(rawEffect), true).replace(/[\r\n]+/g, ' ').trim();
        const rawCond = stObj.condition || stObj.condition_description || "";
        const formattedCond = formatOfficialText(String(rawCond), true).replace(/[\r\n]+/g, ' ').trim();

        const html = `
            <div class="abs-box mb-3">
                <div class="abs-header">
                    <div class="abs-sa-header-title">
                        <span class="abs-sa-title-text">Standby Skill | <em class="abs-sa-name-glow">${name}</em></span>
                    </div>
                </div>
                <div class="abs-content text-start">
                    ${formattedCond ? `
                        <div class="abs-skill-label text-warning mb-1">Condition:</div>
                        <div class="mb-3">${formattedCond}</div>
                    ` : ''}
                    <div class="abs-skill-label text-warning mb-1">Effect:</div>
                    <div>${formattedEffect || "Standby Skill effect details unavailable."}</div>
                </div>
            </div>
        `;
        standbyContainer.innerHTML += html;
    });
}

function renderActiveSkills(card) {
    const activeContainer = document.getElementById("abs-active-container");
    if (!activeContainer) return;
    activeContainer.innerHTML = "";

    let resolvedActives = [];
    const cidStr = String(card.id);
    const folderIdStr = String(getCardFolderId(card));

    function addActive(a) {
        if (a && typeof a === 'object' && !resolvedActives.some(x => x.id === a.id && x.name === a.name)) {
            resolvedActives.push(a);
        }
    }

    if (card.active_id && DB && DB.actives) {
        let found = DB.actives[card.active_id] || DB.actives[String(card.active_id)];
        if (found) addActive(found);
    }

    if (resolvedActives.length === 0 && DB && DB.actives) {
        const allActives = Array.isArray(DB.actives) ? DB.actives : Object.values(DB.actives);
        allActives.forEach(a => {
            if (!a) return;
            const aId = String(a.id || '');
            const cId = String(a.card_id || a.character_id || '');
            if (cId === cidStr || aId === cidStr || (aId.length >= 7 && aId.startsWith(cidStr)) || (aId.length >= 7 && aId.startsWith(folderIdStr))) {
                addActive(a);
            }
        });
    }

    resolvedActives = resolvedActives.filter(a => {
        if (!a) return false;
        return hasValidDisplayText(a.name) || hasValidDisplayText(a.effect_description) || hasValidDisplayText(a.description) || hasValidDisplayText(a.effect);
    });

    if (resolvedActives.length === 0) return;

    resolvedActives.forEach(actObj => {
        const actName = actObj.name || "Active Skill";
        const rawEffect = actObj.effect_description || actObj.description || actObj.effect || "";
        const formattedEffect = formatOfficialText(String(rawEffect), true).replace(/[\r\n]+/g, ' ').trim();
        const rawCond = actObj.condition_description || actObj.condition || "";
        const formattedCond = formatOfficialText(String(rawCond), true).replace(/[\r\n]+/g, ' ').trim();
        const typeLabel = actObj.type_label || "Active Skill";

        let iconHtml = '';
        if (actObj.special_category_id !== undefined && actObj.special_category_id !== null) {
            const actIcon = getSaIconUrl(actObj, card);
            const actCategoryName = getSaCategoryName(actObj);
            iconHtml = `<img src="${actIcon}" class="abs-sa-icon-left" data-tooltip="${actCategoryName}" alt="${actCategoryName}">`;
        } else if (actObj.special_view_id) {
            const actIcon = getSaIconUrl(actObj, card);
            const actCategoryName = getSaCategoryName(actObj);
            iconHtml = `<img src="${actIcon}" class="abs-sa-icon-left" data-tooltip="${actCategoryName}" alt="${actCategoryName}">`;
        }

        const html = `
            <div class="abs-box mb-3">
                <div class="abs-header">
                    <div class="abs-sa-header-title">
                        ${iconHtml}
                        <span class="abs-sa-title-text">${typeLabel} | <em class="abs-sa-name-glow">${actName}</em></span>
                    </div>
                </div>
                <div class="abs-content text-start">
                    ${formattedCond ? `
                        <div class="abs-skill-label text-warning mb-1">Condition:</div>
                        <div class="mb-3">${formattedCond}</div>
                    ` : ''}
                    <div class="abs-skill-label text-warning mb-1">Effect:</div>
                    <div>${formattedEffect || "Effect details unavailable."}</div>
                </div>
            </div>
        `;
        activeContainer.innerHTML += html;
    });
}

function renderFinishSkills(card) {
    const finishContainer = document.getElementById("abs-finish-container");
    if (!finishContainer) return;
    finishContainer.innerHTML = "";

    let resolvedFinishes = [];
    const cidStr = String(card.id);
    const folderIdStr = String(getCardFolderId(card));

    function addFinish(f) {
        if (f && typeof f === 'object' && !resolvedFinishes.some(x => x.id === f.id && x.name === f.name)) {
            resolvedFinishes.push(f);
        }
    }

    if (Array.isArray(card.finish_ids)) {
        card.finish_ids.forEach(fid => {
            if (DB && DB.finishes) {
                let found = DB.finishes[fid] || DB.finishes[String(fid)];
                if (found) addFinish(found);
            }
        });
    }

    if (resolvedFinishes.length === 0 && DB && DB.finishes) {
        const all = Array.isArray(DB.finishes) ? DB.finishes : Object.values(DB.finishes);
        all.forEach(f => {
            if (!f) return;
            const fId = String(f.id || '');
            const cId = String(f.card_id || f.character_id || '');
            if (cId === cidStr || fId === cidStr || (fId.length >= 7 && fId.startsWith(cidStr)) || (fId.length >= 7 && fId.startsWith(folderIdStr))) {
                addFinish(f);
            }
        });
    }

    resolvedFinishes = resolvedFinishes.filter(f => {
        if (!f) return false;
        const name = f.name || f.finish_name || '';
        const effect = f.description || f.effect_description || f.effect || '';
        const cond = f.condition || f.condition_description || '';
        return hasValidDisplayText(name) || hasValidDisplayText(effect) || hasValidDisplayText(cond);
    });

    if (resolvedFinishes.length === 0) return;

    resolvedFinishes.forEach(finObj => {
        const name = finObj.name || "Finish Skill";
        const rawEffect = finObj.description || finObj.effect_description || finObj.effect || "";
        const formattedEffect = formatOfficialText(String(rawEffect), true).replace(/[\r\n]+/g, ' ').trim();
        const rawCond = finObj.condition || finObj.condition_description || "";
        const formattedCond = formatOfficialText(String(rawCond), true).replace(/[\r\n]+/g, ' ').trim();

        let iconHtml = '';
        if (finObj.special_category_id !== undefined || finObj.special_view_id || /\b(causes|damage|ultimate|colossal|mega-colossal)\b/i.test(rawEffect)) {
            const finIcon = getSaIconUrl(finObj, card);
            const finCategoryName = getSaCategoryName(finObj);
            iconHtml = `<img src="${finIcon}" class="abs-sa-icon-left" data-tooltip="${finCategoryName}" alt="${finCategoryName}">`;
        }

        const html = `
            <div class="abs-box mb-3">
                <div class="abs-header">
                    <div class="abs-sa-header-title">
                        ${iconHtml}
                        <span class="abs-sa-title-text">Finish Skill | <em class="abs-sa-name-glow">${name}</em></span>
                    </div>
                </div>
                <div class="abs-content text-start">
                    ${formattedCond ? `
                        <div class="abs-skill-label text-warning mb-1">Condition:</div>
                        <div class="mb-3">${formattedCond}</div>
                    ` : ''}
                    <div class="abs-skill-label text-warning mb-1">Effect:</div>
                    <div>${formattedEffect || "Finish Skill effect details unavailable."}</div>
                </div>
            </div>
        `;
        finishContainer.innerHTML += html;
    });
}

window.renderSuperAttacks = renderSuperAttacks;
window.renderActiveSkills = renderActiveSkills;
window.renderDokkanFields = renderDokkanFields;
window.renderStandbySkills = renderStandbySkills;
window.renderFinishSkills = renderFinishSkills;