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

function getModeSpecificDatabaseSuperAttacks(card, mode = currentEzaMode) {
    const rawCardId = String(card?.id || '');
    const baseCardId = rawCardId.length >= 8 ? rawCardId.substring(0, 7) : rawCardId;
    const cardRows = DB?.cardSpecialsByCard?.[baseCardId];
    const specialSets = DB?.specialSets;
    if (!Array.isArray(cardRows) || !cardRows.length || !specialSets) return [];

    const buckets = { base: [], eza: [], seza: [] };
    const isLR = typeof isCardLR === 'function'
        ? isCardLR(card)
        : Number(card?.rarity) === 5;
    const isEzaMode = mode === 'eza' || mode === 'seza';
    const maxLevel = isLR ? (isEzaMode ? 25 : 20) : (isEzaMode ? 15 : 10);

    cardRows.forEach((row) => {
        const set = specialSets[String(row?.special_set_id || '')];
        if (!set?.name) return;
        const name = String(set.name || '');
        const levelStart = Number(row?.lv_start || 0);
        const isSuperEza = /\(super extreme\)|super extreme z-awakened/i.test(name);
        // LR EZA rows start at SA level 24. They are regular EZA rows, not
        // SEZA rows. The older exporter classified every level 20+ row as
        // SEZA, which silently made the viewer fall back to the base attack.
        const isEza = !isSuperEza && (/\(extreme\)|extreme z-awakened/i.test(name) || levelStart >= 14);
        const bucket = isSuperEza ? buckets.seza : (isEza ? buckets.eza : buckets.base);
        const increaseRate = Number(set.increase_rate || 0);
        const levelBonus = Number(set.lv_bonus || 0);
        const lrBonus = isLR && (increaseRate === 100 || increaseRate === 200)
            ? (increaseRate === 100 ? 30 : 80)
            : 0;
        const exactMultiplier = increaseRate > 0
            ? 100 + increaseRate + ((maxLevel - 1) * levelBonus) + lrBonus
            : 0;
        const style = String(row?.style || '');
        const view = DB?.specialViews?.[String(row?.view_id || row?.special_view_id || '')];
        bucket.push({
            id: Number(row?.special_set_id || row?.id || 0),
            special_set_id: Number(row?.special_set_id || 0),
            special_view_id: Number(row?.view_id || row?.special_view_id || 0),
            special_category_id: Number(view?.special_category_id || 4),
            eball_num_start: Number(row?.eball_num_start || 0),
            eball_num_end: Number(row?.eball_num_end || 0),
            lv_start: levelStart,
            priority: Number(row?.priority || 0),
            is_eza: isEza,
            name,
            description: String(set.description || ''),
            condition: String(set.causality_description || ''),
            causality_description: String(set.causality_description || ''),
            is_ex: /extra|ex|firstattack|additionalattack/i.test(style),
            style,
            increase_rate: increaseRate,
            lv_bonus: levelBonus,
            exact_multiplier: exactMultiplier,
        });
    });

    if (mode === 'seza') return buckets.seza.length ? buckets.seza : (buckets.eza.length ? buckets.eza : buckets.base);
    if (mode === 'eza') return buckets.eza.length ? buckets.eza : buckets.base;
    return buckets.base.length ? buckets.base : (buckets.eza.length ? buckets.eza : buckets.seza);
}

function renderSuperAttacks(card, isEZA = false, mode = currentEzaMode) {
    const saContainer = document.getElementById("abs-sa-container");
    if (!saContainer) return;
    saContainer.innerHTML = "";

    const siblings = (typeof getCardSiblings === 'function') ? getCardSiblings(card) : null;
    const isModeEza = isEZA || mode === 'eza' || mode === 'seza';
    const isModeSeza = (mode === 'seza');

    const currentIdText = String(card?.id || '');
    const isExactSezaRecord = Boolean(card?.is_seza) || (currentIdText.length >= 8 && currentIdText.endsWith('9'));
    const isExactEzaRecord = Boolean(card?.is_eza) || (currentIdText.length >= 8 && currentIdText.endsWith('8'));

    // 1. Pick the correct super_attacks array for the current active mode.
    // When selectCard has already resolved the exact EZA/SEZA record, that
    // record is authoritative.  Looking up a sibling first could accidentally
    // fall back to the base form when an imported transformation has an
    // imperfect parent relationship.
    let saList = getModeSpecificDatabaseSuperAttacks(card, mode);
    if (saList.length) {
        // Raw card_specials + special_sets are the primary source for official
        // cards. They retain the real EZA effect text instead of a generated
        // base-SA fallback in cards.json.
    } else if (isModeSeza && isExactSezaRecord && Array.isArray(card.super_attacks) && card.super_attacks.length > 0) {
        saList = card.super_attacks;
    } else if (isModeEza && !isModeSeza && isExactEzaRecord && Array.isArray(card.super_attacks) && card.super_attacks.length > 0) {
        saList = card.super_attacks;
    } else if (isModeSeza && siblings?.seza && Array.isArray(siblings.seza.super_attacks) && siblings.seza.super_attacks.length > 0) {
        saList = siblings.seza.super_attacks;
    } else if (isModeEza && siblings?.eza && Array.isArray(siblings.eza.super_attacks) && siblings.eza.super_attacks.length > 0) {
        saList = siblings.eza.super_attacks;
    } else if (isModeEza && siblings?.eza && Array.isArray(siblings.eza.super_attacks) && siblings.eza.super_attacks.length > 0) {
        saList = siblings.eza.super_attacks;
    } else if (!isModeEza && siblings?.base && Array.isArray(siblings.base.super_attacks) && siblings.base.super_attacks.length > 0) {
        saList = siblings.base.super_attacks;
    } else if (Array.isArray(card.super_attacks) && card.super_attacks.length > 0) {
        saList = card.super_attacks;
    }

    if (!saList || saList.length === 0) return;

    // Helper to identify EX Super Attacks
    const checkIsExSuper = (spec) => {
        if (!spec) return false;
        if (spec.is_ex === true || spec.is_ex === 1 || spec.is_ex === 'true') return true;
        const label = String(spec.type_label || spec.category || spec.type || '').trim().toLowerCase();
        if (/\bex\b/.test(label) || /^ex\b/.test(label) || label === 'ex') return true;
        const name = String(spec.name || spec.special_name || spec.title || '').trim().toLowerCase();
        if (/\bex\s*super\b/.test(name) || /\[ex\]/.test(name) || /\(ex\)/.test(name)) return true;
        const desc = String(spec.description || spec.itemized_description || spec.effect || spec.details || '').toLowerCase();
        const cond = String(spec.condition || spec.activation_condition || spec.causality_description || '').toLowerCase();
        return (desc + ' ' + cond).includes('ex super');
    };

    const getSpecialKi = (spec) => {
        let ki = Number(spec.eball_num_start || spec.need_ki || 0);
        if (ki > 0) return ki;
        const typeLabel = String(spec.type_label || spec.category || spec.type || '').toLowerCase();
        if (typeLabel.includes('ultra')) return 18;
        const rawDesc = String(spec.description || spec.itemized_description || spec.effect || spec.details || '');
        const rawCond = String(spec.condition || spec.activation_condition || spec.causality_description || '');
        const combined = (rawCond + ' ' + rawDesc).toLowerCase();
        const kiMatch = combined.match(/(\d+)(?:[–\-~]\d+)?\s*ki\b/i) || combined.match(/ki\s*(?:is\s*)?(\d+)/i);
        if (kiMatch) return Number(kiMatch[1]);
        return 12;
    };

    // Helper to identify Unit Super Attacks
    const checkIsUnitSuper = (spec) => {
        if (!spec) return false;
        if (checkIsExSuper(spec)) return false;
        if (spec.is_unit_sa === true || spec.is_unit_sa === 1 || spec.is_unit_sa === 'true') return true;
        if (typeof isStrictUnitSuperAttack === 'function' && isStrictUnitSuperAttack(spec)) return true;
        const typeLabel = String(spec.type_label || spec.category || spec.type || '').toLowerCase();
        if (typeLabel.includes('unit')) return true;
        const name = String(spec.name || spec.special_name || spec.title || '').toLowerCase();
        if (name.includes('unit')) return true;
        const rawSaCond = String(spec.condition || spec.activation_condition || spec.causality_description || '');
        return /whose\s+name\s+includes|when\s+an?\s+ally/i.test(rawSaCond);
    };

    // 2. Partition specials:
    // Regular Super Attacks take the top row(s),
    // followed by Unit Super Attacks grouped on their own shared row,
    // followed by EX Super Attacks spanning the full width below.
    const exAttacks = [];
    const unitAttacks = [];
    const regularAttacks = [];

    for (const spec of saList) {
        if (checkIsExSuper(spec)) {
            exAttacks.push(spec);
        } else if (checkIsUnitSuper(spec)) {
            unitAttacks.push(spec);
        } else {
            regularAttacks.push(spec);
        }
    }

    const sortByKi = (a, b) => getSpecialKi(a) - getSpecialKi(b);
    regularAttacks.sort(sortByKi);
    unitAttacks.sort(sortByKi);
    exAttacks.sort(sortByKi);

    const sortedSpecials = [...regularAttacks, ...unitAttacks, ...exAttacks];

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
        const startKi = specObj.eball_num_start || specObj.need_ki || 0;
        const endKi = specObj.eball_num_end || 0;
        const isLR = (card.rarity === 5 || card.rarity === 'lr');

        // Strict Unit SA & EX detection
        const isExSuperAttack = checkIsExSuper(specObj);
        const isUnitSa = !isExSuperAttack && checkIsUnitSuper(specObj);

        if (isExSuperAttack) {
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
                kiText = (isLR && idx === 1 && !isExSuperAttack) ? '18 Ki' : '12 Ki';
            }
        }

        const damageMultiplierHtml = renderAbsDamageMultiplier(rawDesc, typeLabel, false, kiText, specObj);
        const headerDamageMultiplier = damageMultiplierHtml.match(/class="pill-val">([^<]+)</)?.[1] || '';
        const saCategoryName = getSaCategoryName(specObj);
        const animationScript = window.DokkanAnimation?.resolveSuperAttack(specObj, card) || '';
        const animationContext = window.DokkanAnimation?.resolveSuperAttackContext(specObj, card, idx)
            || (idx === 0 ? 'sa1' : 'sa2');
        const animationButton = window.DokkanAnimation?.buttonHtml(animationScript, 'Play Super Attack', animationContext) || '';
        const isAbsCleanTheme = document.body?.classList.contains('theme-abs-clean') || document.getElementById('app')?.classList.contains('theme-abs-clean') || document.documentElement?.dataset?.cardViewerTheme === 'clean';
        let cleanTypePills;
        if (isAbsCleanTheme && isExSuperAttack) {
            cleanTypePills = `<span class="abs-sa-ex-pill">EX</span><span class="abs-sa-type-pill">Super Attack</span>`;
        } else if (isAbsCleanTheme && isUnitSa) {
            const unitSubLabel = (startKi >= 18 || (isLR && idx >= 1) || /ultra/i.test(typeLabel))
                ? 'Ultra Super Attack'
                : 'Super Attack';
            cleanTypePills = `<span class="abs-sa-unit-pill">UNIT</span><span class="abs-sa-type-pill">${unitSubLabel}</span>`;
        } else {
            cleanTypePills = `<span class="abs-sa-type-pill">${typeLabel}</span>`;
        }
        const cleanTopStats = '';
        const cleanSaFloatingHeader = isAbsCleanTheme
            ? `<div class="abs-sa-floating-header">
                <span class="abs-sa-pill-actions">${cleanTypePills}${animationButton}</span>
                <div class="abs-sa-header-meta"><span class="abs-sa-ki-pill">${kiText}</span>${headerDamageMultiplier ? `<span class="abs-sa-damage-pill">${headerDamageMultiplier}</span>` : ''}</div>
            </div>`
            : '';
        const cleanSaFloatingFooter = (isAbsCleanTheme && specialEffectsHtml)
            ? `<div class="abs-sa-floating-footer">${specialEffectsHtml}</div>`
            : '';
        const cleanHeaderTitle = isAbsCleanTheme
            ? `<div class="abs-sa-header-title"><span class="abs-sa-title-center"><span class="abs-sa-name-group"><img src="${saIcon}" class="abs-sa-icon-name" data-tooltip="${saCategoryName}" alt="${saCategoryName}"><em class="abs-sa-name-glow">${saName}</em></span></span><span class="abs-sa-effect-inline"><i>◆</i>${formattedEffects}</span></div>`
            : `<div class="abs-sa-header-title"><img src="${saIcon}" class="abs-sa-icon-left" data-tooltip="${saCategoryName}" alt="${saCategoryName}"><span class="abs-sa-title-text">${typeLabel} | <em class="abs-sa-name-glow">${saName}</em></span></div>`;
        const cleanHeaderMeta = isAbsCleanTheme
            ? ''
            : `<div class="abs-sa-header-meta"><span class="abs-sa-ki-pill">${kiText}</span>${headerDamageMultiplier ? `<span class="abs-sa-damage-pill">${headerDamageMultiplier}</span>` : ''}</div>`;
        const cleanExConditionDividerHtml = isAbsCleanTheme && isExSuperAttack && formattedSaCond
            ? '<div class="abs-clean-ex-condition-divider" aria-hidden="true"><hr class="divider"></div>'
            : '';
        const cleanSaContent = isAbsCleanTheme
            ? `<div class="abs-sa-clean-layout"><div class="abs-sa-clean-copy">${formattedSaCond ? `<div class="abs-skill-label text-warning mb-1">Condition:</div><div class="mb-3">${formattedSaCond}</div>${cleanExConditionDividerHtml}` : ''}</div></div>`
            : `${formattedSaCond ? `<div class="abs-skill-label text-warning mb-1">Condition:</div><div class="mb-3">${formattedSaCond}</div>` : ''}<div class="abs-skill-label text-warning mb-1">Effect:</div><div>${formattedEffects}</div>${specialEffectsHtml}${damageMultiplierHtml}`;
        
        // Calculate grid column class
        let colSpanClass = 'abs-sa-col-12';
        if (isExSuperAttack) {
            colSpanClass = 'abs-sa-col-12 abs-clean-ex-super-attack';
        } else if (isUnitSa) {
            if (unitAttacks.length === 1) colSpanClass = 'abs-sa-col-12 abs-clean-unit-super-attack';
            else if (unitAttacks.length === 2) colSpanClass = 'abs-sa-col-6 abs-clean-unit-super-attack';
            else if (unitAttacks.length === 3) colSpanClass = 'abs-sa-col-4 abs-clean-unit-super-attack';
            else colSpanClass = 'abs-sa-col-3 abs-clean-unit-super-attack';
        } else {
            if (regularAttacks.length === 1) colSpanClass = 'abs-sa-col-12 abs-clean-single-standard-super-attack';
            else if (regularAttacks.length === 2) colSpanClass = 'abs-sa-col-6';
            else colSpanClass = 'abs-sa-col-6';
        }

        const html = `
            <div class="abs-box mb-3 ${colSpanClass}${isAbsCleanTheme ? ' abs-clean-header-effects' : ''}${cleanSaFloatingFooter ? ' has-floating-footer' : ''}">
                ${cleanSaFloatingHeader}
                <div class="abs-header">
                    ${cleanHeaderTitle}
                    ${isAbsCleanTheme ? '' : animationButton}
                    ${cleanHeaderMeta}
                </div>
                <div class="abs-content text-start">
                    ${cleanSaContent}
                </div>
                ${cleanSaFloatingFooter}
                ${cleanTopStats}
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
        const effectText = typeof getAbsDokkanFieldEffectText === 'function'
            ? getAbsDokkanFieldEffectText(f)
            : (f.effect_description || f.description || f.itemized_description || f.effect || '');
        return hasValidDisplayText(f.name) || hasValidDisplayText(effectText);
    });

    if (resolvedFields.length === 0) return;

    resolvedFields.forEach(fieldObj => {
        let fieldName = (fieldObj.name || "Dokkan Field").replace(/^dokkan field\s*[-–—:]?\s*/i, '').trim();
        const isAbsCleanTheme = document.body.classList.contains('theme-abs-clean');
        const rawEffect = typeof getAbsDokkanFieldEffectText === 'function'
            ? getAbsDokkanFieldEffectText(fieldObj)
            : (fieldObj.effect_description || fieldObj.description || fieldObj.itemized_description || fieldObj.effect || "");
        const formattedEffect = isAbsCleanTheme && typeof formatAbsCleanDokkanFieldEffect === 'function'
            ? formatAbsCleanDokkanFieldEffect(rawEffect)
            : formatOfficialText(String(rawEffect), true).replace(/[\r\n]+/g, ' ').trim();
        const rawCond = fieldObj.condition || fieldObj.activation_condition || "";
        const formattedCond = formatOfficialText(String(rawCond), true).replace(/[\r\n]+/g, ' ').trim();

        const fieldId = fieldObj.background_id || fieldObj.id || card.field_id;
        const fieldOnClick = fieldId
            ? `onclick="openDomainModal('${fieldId}', '${fieldName.replace(/'/g, "\\'")}')"`
            : '';
        const domainPlayButton = (isAbsCleanTheme && fieldId)
            ? `<span class="abs-animation-header-actions"><button type="button" class="abs-animation-play-btn abs-domain-play-btn" title="Play Dokkan Field Animation" aria-label="Play Dokkan Field Animation" ${fieldOnClick}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.7v12.6c0 .9 1 1.4 1.8.9l9.4-6.3c.7-.4.7-1.4 0-1.8L9.8 4.8C9 4.3 8 4.8 8 5.7Z"></path></svg></button></span>`
            : '';
        const cleanFieldIconHtml = `<img src="https://abscustom.github.io/assets/images/ing_label_field.png" class="abs-sa-icon-name abs-domain-header-icon" data-tooltip="Play Dokkan Field Animation" ${fieldOnClick} alt="Dokkan Field">`;
        const legacyFieldIconHtml = fieldId
            ? `<img src="https://abscustom.github.io/assets/images/ing_label_field.png" class="abs-sa-icon-left abs-domain-header-icon" data-tooltip="Play Domain Animation" alt="Play Domain Animation" ${fieldOnClick}>`
            : '';
        const fieldHeader = isAbsCleanTheme
            ? `<div class="abs-sa-header-title"><span class="abs-sa-pill-actions"><span class="abs-sa-type-pill">Dokkan Field</span>${domainPlayButton}</span><span class="abs-sa-title-center">${cleanFieldIconHtml}<em class="abs-sa-name-glow">${fieldName}</em></span></div>`
            : `<div class="abs-sa-header-title">${legacyFieldIconHtml}<span class="abs-sa-title-text">Dokkan Field | <em class="abs-sa-name-glow">${fieldName}</em></span></div>`;
        const cleanFieldStatBadges = isAbsCleanTheme && typeof window.renderAbsCleanFieldStatBadges === 'function'
            ? window.renderAbsCleanFieldStatBadges(rawEffect, fieldObj)
            : '';
        const cleanFieldDividerHtml = isAbsCleanTheme
            ? '<div class="abs-clean-active-divider abs-clean-field-divider" aria-hidden="true"><hr class="divider py bg-secondary"></div>'
            : '';

        const html = `
            <div class="abs-box mb-3 abs-domain-rendered" data-active-kind="domain">
                <div class="abs-header">
                    ${fieldHeader}
                </div>
                <div class="abs-content text-start">
                    ${formattedCond ? `
                        <div class="abs-skill-label text-warning mb-1">Condition:</div>
                        <div class="mb-3">${formattedCond}</div>
                    ` : ''}
                    <div class="abs-skill-label text-warning mb-1">Dokkan Field Effect:</div>
                    <div class="abs-clean-field-effect-copy">${formattedEffect || "Dokkan Field effect details unavailable."}</div>
                    ${cleanFieldDividerHtml}
                    ${cleanFieldStatBadges}
                </div>
            </div>
        `;
        fieldContainer.insertAdjacentHTML('beforeend', html);
    });
    window.syncAbsCleanRightRail?.();
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

    if (resolvedStandbys.length === 0) {
        window.syncAbsCleanRightRail?.();
        return;
    }

    resolvedStandbys.forEach(stObj => {
        const name = stObj.name || "Standby Skill";
        const rawEffect = stObj.description || stObj.effect_description || stObj.effect || "";
        const formattedEffect = formatOfficialText(String(rawEffect), true).replace(/[\r\n]+/g, ' ').trim();
        const rawCond = stObj.condition || stObj.condition_description || "";
        const formattedCond = formatOfficialText(String(rawCond), true).replace(/[\r\n]+/g, ' ').trim();
        const isAbsCleanTheme = document.body.classList.contains('theme-abs-clean');
        const animationScript = window.DokkanAnimation?.resolveSkill(stObj) || '';
        const animationButton = window.DokkanAnimation?.buttonHtml(animationScript, 'Play Standby Skill', 'standby') || '';
        const headerHtml = isAbsCleanTheme
            ? `<div class="abs-sa-header-title"><span class="abs-sa-pill-actions"><span class="abs-sa-type-pill">Standby</span>${animationButton}</span><span class="abs-sa-title-center"><em class="abs-sa-name-glow">${name}</em></span></div>`
            : `<div class="abs-sa-header-title"><span class="abs-sa-title-text">Standby Skill | <em class="abs-sa-name-glow">${name}</em></span></div>`;
        const cleanClass = isAbsCleanTheme ? ' abs-clean-active-rendered abs-clean-standby-rendered' : '';
        const editAttr = isAbsCleanTheme ? ' data-edit="active"' : '';

        const html = `
            <div class="abs-box mb-3 abs-standby-rendered${cleanClass}" data-active-kind="standby"${editAttr}>
                <div class="abs-header">
                    ${headerHtml}
                    ${isAbsCleanTheme ? '' : animationButton}
                </div>
                <div class="abs-content text-start">
                    ${formattedCond ? `
                        <div class="abs-skill-label text-warning mb-1">Condition:</div>
                        <div class="mb-3">${formattedCond}</div>
                        ${isAbsCleanTheme ? '<div class="abs-clean-active-divider abs-clean-standby-divider" aria-hidden="true"><hr class="divider py bg-secondary"></div>' : ''}
                    ` : ''}
                    <div class="abs-skill-label text-warning mb-1">${isAbsCleanTheme ? 'Standby Skill Effect:' : 'Effect:'}</div>
                    <div class="${isAbsCleanTheme ? 'abs-clean-standby-effect-copy' : ''}">${formattedEffect || "Standby Skill effect details unavailable."}</div>
                </div>
            </div>
        `;
        standbyContainer.innerHTML += html;
    });
    window.syncAbsCleanRightRail?.();
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
        const animationScript = window.DokkanAnimation?.resolveSkill(actObj) || '';
        const animationButton = window.DokkanAnimation?.buttonHtml(animationScript, 'Play Active Skill', 'active') || '';
        const isAbsCleanTheme = document.body.classList.contains('theme-abs-clean');
        const damageMultiplierHtml = renderAbsDamageMultiplier(rawEffect, typeLabel, true, '', actObj);
        const headerDamageMultiplier = damageMultiplierHtml.match(/class="pill-val">([^<]+)</)?.[1] || '';
        const cleanActiveDividerHtml = isAbsCleanTheme
            ? '<div class="abs-clean-active-divider" aria-hidden="true"><hr class="divider py bg-secondary"></div>'
            : '';

        let iconHtml = '';
        if (actObj.special_category_id !== undefined && actObj.special_category_id !== null) {
            const actIcon = getSaIconUrl(actObj, card);
            const actCategoryName = getSaCategoryName(actObj);
            iconHtml = `<img src="${actIcon}" class="${isAbsCleanTheme ? 'abs-sa-icon-name' : 'abs-sa-icon-left'}" data-tooltip="${actCategoryName}" alt="${actCategoryName}">`;
        } else if (actObj.special_view_id) {
            const actIcon = getSaIconUrl(actObj, card);
            const actCategoryName = getSaCategoryName(actObj);
            iconHtml = `<img src="${actIcon}" class="${isAbsCleanTheme ? 'abs-sa-icon-name' : 'abs-sa-icon-left'}" data-tooltip="${actCategoryName}" alt="${actCategoryName}">`;
        }

        const cleanActiveFloatingHeader = isAbsCleanTheme
            ? `<div class="abs-active-floating-header abs-sa-floating-header">
                <span class="abs-sa-pill-actions"><span class="abs-sa-type-pill">${typeLabel}</span>${animationButton}</span>
                <div class="abs-sa-header-meta">${headerDamageMultiplier ? `<span class="abs-sa-damage-pill">${headerDamageMultiplier}</span>` : ''}</div>
            </div>`
            : '';
        const cleanActiveHeader = isAbsCleanTheme
            ? `<div class="abs-sa-header-title"><span class="abs-sa-title-center"><span class="abs-sa-name-group">${iconHtml}<em class="abs-sa-name-glow">${actName}</em></span></span></div>`
            : `<div class="abs-sa-header-title">${iconHtml}<span class="abs-sa-title-text">${typeLabel} | <em class="abs-sa-name-glow">${actName}</em></span></div>`;

        const html = `
            <div class="abs-box mb-3${isAbsCleanTheme ? ' abs-clean-header-effects' : ''}">
                ${cleanActiveFloatingHeader}
                <div class="abs-header">
                    ${cleanActiveHeader}
                    ${isAbsCleanTheme ? '' : animationButton}
                    ${isAbsCleanTheme ? '' : (headerDamageMultiplier ? `<div class="abs-sa-header-meta"><span class="abs-sa-damage-pill">${headerDamageMultiplier}</span></div>` : '')}
                </div>
                <div class="abs-content text-start">
                    ${formattedCond ? `
                        <div class="abs-skill-label text-warning mb-1">Condition:</div>
                        <div class="mb-3">${formattedCond}</div>
                    ` : ''}
                    ${cleanActiveDividerHtml}
                    <div class="abs-skill-label text-warning mb-1">Effect:</div>
                    <div>${formattedEffect || "Effect details unavailable."}</div>
                    ${isAbsCleanTheme ? '' : damageMultiplierHtml}
                </div>
            </div>
        `;
        activeContainer.innerHTML += html;
    });
    window.syncAbsCleanRightRail?.();
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
        const animationScript = window.DokkanAnimation?.resolveSkill(finObj) || '';
        const animationButton = window.DokkanAnimation?.buttonHtml(animationScript, 'Play Finish Skill', 'finish') || '';

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
                    ${animationButton}
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
