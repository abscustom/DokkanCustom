/* ==========================================================================
   absCustom - Text Parsers, SA Auto-Detectors & Multiplier Engine
   ========================================================================== */

function formatOfficialText(text, highlightQuotes = true) {
    if (!text) return "";
    let formatted = text;

    if (highlightQuotes) {
        formatted = formatted.replace(/["“”]([^"”]+)["”]/g, '<span class="abs-category-quote">"$1"</span>');
    }

    // Default dialog images (base files) for every theme. The abs.clean
    // `_clean` arrow and typed once/inf variants were retired.
    const dialogIcon = (filename) => {
        const style = 'height:14px; vertical-align:middle; margin:0 2px; transform:translateY(-1.5px);';
        return `<img src="${CENTRAL_ASSET_URL}${filename}" style="${style}">`;
    };

    const upArrow = dialogIcon('passive_skill_dialog_arrow01.png');
    const downRed = dialogIcon('passive_skill_dialog_arrow02.png');
    const downYellow = dialogIcon('passive_skill_dialog_arrow03.png');
    const onceIcon = dialogIcon('passive_skill_dialog_icon_01.png');
    const foreverIcon = dialogIcon('passive_skill_dialog_icon_02.png');

    const atkDownIcon = `<img src="${CENTRAL_ASSET_URL}st_0011.png" style="height:17px; vertical-align:middle; margin:0 2px; transform:translateY(-1.5px);">`;
    const defDownIcon = `<img src="${CENTRAL_ASSET_URL}st_0012.png" style="height:17px; vertical-align:middle; margin:0 2px; transform:translateY(-1.5px);">`;
    const stunIcon = `<img src="${CENTRAL_ASSET_URL}st_0100.png" style="height:17px; vertical-align:middle; margin:0 2px; transform:translateY(-1.5px);">`;
    const sealIcon = `<img src="${CENTRAL_ASSET_URL}st_0102.png" style="height:17px; vertical-align:middle; margin:0 2px; transform:translateY(-1.5px);">`;
    const breakIcon = `<img src="${CENTRAL_ASSET_URL}st_1009.png" style="height:17px; vertical-align:middle; margin:0 2px; transform:translateY(-1.5px);">`;

    const atkUpIcon = `<img src="${CENTRAL_ASSET_URL}st_0001.png" style="height:17px; vertical-align:middle; margin:0 2px; transform:translateY(-1.5px);">`;
    const defUpIcon = `<img src="${CENTRAL_ASSET_URL}st_0002.png" style="height:17px; vertical-align:middle; margin:0 2px; transform:translateY(-1.5px);">`;
    const kiUpIcon = `<img src="${CENTRAL_ASSET_URL}st_0003.png" style="height:17px; vertical-align:middle; margin:0 2px; transform:translateY(-1.5px);">`;
    const critIcon = `<img src="${CENTRAL_ASSET_URL}st_critical_up.png" style="height:17px; vertical-align:middle; margin:0 2px; transform:translateY(-1.5px);">`;
    const addAtkIcon = `<img src="${CENTRAL_ASSET_URL}st_atk_combo.png" style="height:17px; vertical-align:middle; margin:0 2px; transform:translateY(-1.5px);">`;
    const effIcon = `<img src="${CENTRAL_ASSET_URL}st_atk_super.png" style="height:17px; vertical-align:middle; margin:0 2px; transform:translateY(-1.5px);">`;
    const alwaysHitIcon = `<img src="${CENTRAL_ASSET_URL}st_always_hit.png" style="height:17px; vertical-align:middle; margin:0 2px; transform:translateY(-1.5px);">`;
    const guardIcon = `<img src="${CENTRAL_ASSET_URL}st_guard_all.png" style="height:17px; vertical-align:middle; margin:0 2px; transform:translateY(-1.5px);">`;
    const dmgRedIcon = `<img src="${CENTRAL_ASSET_URL}st_resist_damage_up.png" style="height:17px; vertical-align:middle; margin:0 2px; transform:translateY(-1.5px);">`;
    const evasionIcon = `<img src="${CENTRAL_ASSET_URL}st_evasion.png" style="height:17px; vertical-align:middle; margin:0 2px; transform:translateY(-1.5px);">`;
    const rainbowKiIcon = `<img src="${CENTRAL_ASSET_URL}ki_change_rainbow.png" style="height:17px; vertical-align:middle; margin:0 2px; transform:translateY(-1.5px);">`;
    const healIcon = `<img src="${CENTRAL_ASSET_URL}st_recover.png" style="height:17px; vertical-align:middle; margin:0 2px; transform:translateY(-1.5px);">`;
    const reviveIcon = `<img src="${CENTRAL_ASSET_URL}st_revive.png" style="height:17px; vertical-align:middle; margin:0 2px; transform:translateY(-1.5px);">`;
    const surviveKoIcon = `<img src="${CENTRAL_ASSET_URL}st_invalid_ko.png" style="height:17px; vertical-align:middle; margin:0 2px; transform:translateY(-1.5px);">`;
    const tauntIcon = `<img src="${CENTRAL_ASSET_URL}st_target.png" style="height:17px; vertical-align:middle; margin:0 2px; transform:translateY(-1.5px);">`;
    const counterIcon = `<img src="${CENTRAL_ASSET_URL}st_counter.png" style="height:17px; vertical-align:middle; margin:0 2px; transform:translateY(-1.5px);">`;
    const reversibleIcon = `<img src="${CENTRAL_ASSET_URL}st_reversible.png" style="height:17px; vertical-align:middle; margin:0 2px; transform:translateY(-1.5px);">`;

    return formatted
        .replace(/\{passiveImg:up_g\}/gi, upArrow)
        .replace(/:up:/gi, upArrow)
        .replace(/\{passiveImg:down_r\}/gi, downRed)
        .replace(/:down:/gi, downRed)
        .replace(/\{passiveImg:down_y\}/gi, downYellow)
        .replace(/:ydown:/gi, downYellow)
        .replace(/\{passiveImg:once\}/gi, onceIcon)
        .replace(/:once:/gi, onceIcon)
        .replace(/\{passiveImg:forever\}/gi, foreverIcon)
        .replace(/\{passiveImg:inf\}/gi, foreverIcon)
        .replace(/:inf:/gi, foreverIcon)
        .replace(/\{passiveImg:atk_down\}/gi, atkDownIcon)
        .replace(/:atk_down:/gi, atkDownIcon)
        .replace(/\{passiveImg:def_down\}/gi, defDownIcon)
        .replace(/:def_down:/gi, defDownIcon)
        .replace(/\{passiveImg:stun\}/gi, stunIcon)
        .replace(/:stun:/gi, stunIcon)
        .replace(/\{passiveImg:astute\}/gi, sealIcon)
        .replace(/\{passiveImg:seal\}/gi, sealIcon)
        .replace(/:seal:/gi, sealIcon)
        .replace(/:astute:/gi, sealIcon)
        .replace(/\{passiveImg:break\}/gi, breakIcon)
        .replace(/:break:/gi, breakIcon)
        .replace(/:atk_up:/gi, atkUpIcon)
        .replace(/:def_up:/gi, defUpIcon)
        .replace(/:ki_up:/gi, kiUpIcon)
        .replace(/:crit:/gi, critIcon)
        .replace(/:add_atk:/gi, addAtkIcon)
        .replace(/:effective:/gi, effIcon)
        .replace(/:always_hit:/gi, alwaysHitIcon)
        .replace(/:guard:/gi, guardIcon)
        .replace(/:dmg_red:/gi, dmgRedIcon)
        .replace(/:evasion:/gi, evasionIcon)
        .replace(/:rainbow_ki:/gi, rainbowKiIcon)
        .replace(/:heal:/gi, healIcon)
        .replace(/:revive:/gi, reviveIcon)
        .replace(/:survive_ko:/gi, surviveKoIcon)
        .replace(/:taunt:/gi, tauntIcon)
        .replace(/:counter:/gi, counterIcon)
        .replace(/:reversible:/gi, reversibleIcon);
}

function parsePassiveSections(rawPass) {
    if (!rawPass) return "";
    
    let parts = rawPass.split(/\*([^*]+)\*/g);
    let sections = [];
    let currentSection = { header: "Basic effect(s)", items: [] };
    sections.push(currentSection);

    for (let i = 0; i < parts.length; i++) {
        let chunk = parts[i].trim();
        if (!chunk) continue;

        if (i % 2 === 1) {
            currentSection = { header: chunk, items: [] };
            sections.push(currentSection);
        } else {
            let lines = chunk.split('\n').map(l => l.trim()).filter(Boolean);
            lines.forEach(line => {
                let cleanLine = line.replace(/^-/, '').trim();
                if (cleanLine) {
                    if (line.startsWith('-')) {
                        currentSection.items.push(cleanLine);
                    } else if (currentSection.items.length > 0) {
                        currentSection.items[currentSection.items.length - 1] += ' ' + cleanLine;
                    } else {
                        currentSection.items.push(cleanLine);
                    }
                }
            });
        }
    }

    let html = "";
    sections.forEach((sec, idx) => {
        if (sec.items.length === 0) return;
        
        const formattedHeader = formatOfficialText(sec.header, true);
        const mt = (idx === 0 || html === "") ? "margin-top: 0;" : "margin-top: 14px;";
        html += `<strong style="display:block; ${mt} margin-bottom: 4px; color:var(--theme-text, #38bdf8); font-size: 13.5px; text-shadow: 0 0 8px var(--theme-glow, rgba(56, 189, 248, 0.6));">${formattedHeader}</strong>`;

        if (sec.items.length > 0) {
            html += "<ul class='abs-passive-list'>";
            sec.items.forEach(item => {
                html += `<li>${formatOfficialText(item, false)}</li>`;
            });
            html += "</ul>";
        }
    });

    return html;
}

function autoDetectSAStats(text, saName = "", specObj = null) {
    if (!text) return [];
    let stats = [];

    // 1. Direct JSON Database Extraction if special rows exist
    if (specObj && Array.isArray(specObj.special_effects) && specObj.special_effects.length > 0) {
        specObj.special_effects.forEach(eff => {
            if (eff.icon && eff.value) {
                stats.push({
                    icon: eff.icon,
                    value: String(eff.value),
                    turns: eff.turn ? (eff.turn >= 99 || eff.turn === 0 ? "99 turns" : `${eff.turn} turn${eff.turn > 1 ? 's' : ''}`) : "1 turn",
                    target: eff.target_type === 3 ? 'enemy' : (eff.target_type === 2 ? 'ally' : 'self')
                });
            }
        });
        if (stats.length > 0) return stats;
    }

    const t = text.toLowerCase();
    const nameLow = (saName || "").toLowerCase();
    const isSupremeOrHigher = /supreme|immense|colossal|mega-colossal|ultimate/i.test(t);
    const isJanemba = nameLow.includes("janemba") || t.includes("wickedness personified");

    const getTurnForClause = (clauseStr, defaultTurns = "1 turn") => {
        if (!clauseStr) return defaultTurns;
        if (clauseStr.includes("in battle") || clauseStr.includes("rest of battle") || clauseStr.includes("duration of battle")) return "99 turns";
        const m = clauseStr.match(/for\s+(\d+)\s+turns?/i);
        if (m) {
            const num = parseInt(m[1], 10);
            return `${num} turn${num > 1 ? 's' : ''}`;
        }
        if (clauseStr.includes("for 1 turn") || clauseStr.includes("for a turn")) return "1 turn";
        if (/raises?\s+(atk|def)/i.test(clauseStr) && !clauseStr.includes("for")) return "99 turns";
        return defaultTurns;
    };

    // Stacking (infinite) defaults to 20%; temporary raises default to 30%
    const getVal = (str, isStacking = false) => {
        const m = str.match(/(\d+)%/);
        if (m) return m[1];
        if (str.includes("massively")) return "100";
        if (str.includes("greatly")) return "50";
        if (str.includes("raises")) return isStacking ? "20" : "30";
        return "20";
    };

    // Split into individual comma or 'and' clauses
    const clauses = t.split(/,|\band\s+(?=(?:massively|greatly|raises|causes|all\s+attacks|lowers|seals|stuns|disables|recovers|chance))/i).map(c => c.trim()).filter(Boolean);

    // 1. ALLIES BUFFS
    const allyClauses = clauses.filter(c => /allies|all\s+allies/i.test(c));
    allyClauses.forEach(c => {
        const turn = getTurnForClause(c, "1 turn");
        const isStacking = (turn === "99 turns");
        const val = getVal(c, isStacking);
        if (/atk\s*(?:&|and)\s*def|def\s*(?:&|and)\s*atk/i.test(c)) {
            stats.push({ icon: `${CENTRAL_ASSET_URL}st_0001.png`, value: val, turns: turn, target: 'ally' });
            stats.push({ icon: `${CENTRAL_ASSET_URL}st_0002.png`, value: val, turns: turn, target: 'ally' });
        } else if (/atk/i.test(c)) {
            stats.push({ icon: `${CENTRAL_ASSET_URL}st_0001.png`, value: val, turns: turn, target: 'ally' });
        } else if (/def/i.test(c)) {
            stats.push({ icon: `${CENTRAL_ASSET_URL}st_0002.png`, value: val, turns: turn, target: 'ally' });
        }
    });

    // 2. SELF BUFFS (ATK & DEF)
    const selfClauses = clauses.filter(c => !/allies|all\s+allies/i.test(c));
    selfClauses.forEach(c => {
        if (!/raise|boost|\+/i.test(c)) return;
        const turn = getTurnForClause(c, "99 turns");
        const isStacking = (turn === "99 turns");

        if (/atk\s*(?:&|and)\s*def|def\s*(?:&|and)\s*atk/i.test(c)) {
            const val = getVal(c, isStacking);
            stats.push({ icon: `${CENTRAL_ASSET_URL}st_0001.png`, value: val, turns: turn, target: 'self' });
            stats.push({ icon: `${CENTRAL_ASSET_URL}st_0002.png`, value: val, turns: turn, target: 'self' });
        } else {
            if (/\batk\b/i.test(c)) {
                stats.push({ icon: `${CENTRAL_ASSET_URL}st_0001.png`, value: getVal(c, isStacking), turns: turn, target: 'self' });
            }
            if (/\bdef\b/i.test(c)) {
                stats.push({ icon: `${CENTRAL_ASSET_URL}st_0002.png`, value: getVal(c, isStacking), turns: turn, target: 'self' });
            }
        }
    });

    // 3. CRITICAL HITS
    const critClause = clauses.find(c => c.includes("critical"));
    if (critClause) {
        let critVal = "30";
        let critDuration = getTurnForClause(critClause, "1 turn");

        if (critClause.includes("all attacks become critical hits") || critClause.includes("performs a critical hit")) {
            critVal = "100";
        } else if (critClause.includes("great chance")) {
            critVal = "70";
        } else if (critClause.includes("high chance")) {
            critVal = "50";
        } else if (critClause.includes("medium chance")) {
            critVal = "30";
        } else {
            const m = critClause.match(/(\d+)%/);
            if (m) critVal = m[1];
        }

        stats.push({ icon: `${CENTRAL_ASSET_URL}st_critical_up.png`, value: critVal, turns: critDuration, target: 'self' });
    }

    // 4. EVASION
    const evadeClause = clauses.find(c => c.includes("evad") || c.includes("dodg"));
    if (evadeClause) {
        let evadeVal = "30";
        let evadeDuration = getTurnForClause(evadeClause, "1 turn");

        if (evadeClause.includes("evades enemy's attack") || evadeClause.includes("guaranteed to evade")) {
            evadeVal = "100";
        } else if (evadeClause.includes("great chance")) {
            evadeVal = "70";
        } else if (evadeClause.includes("high chance")) {
            evadeVal = "50";
        } else if (evadeClause.includes("medium chance")) {
            evadeVal = "30";
        }

        stats.push({ icon: `${CENTRAL_ASSET_URL}st_evasion.png`, value: evadeVal, turns: evadeDuration, target: 'self' });
    }

    // 5. HP RECOVERY
    const hpClause = clauses.find(c => c.includes("recover") && c.includes("hp"));
    if (hpClause) {
        const hpMatch = hpClause.match(/(\d+)%/);
        const val = hpMatch ? hpMatch[1] : "10";
        stats.push({ icon: `${CENTRAL_ASSET_URL}st_recover.png`, value: val, turns: "1 turn", target: 'self' });
    }

    // 6. ENEMY DEBUFFS
    const debuffTurn = "3 turns";
    const debuffClause = clauses.find(c => c.includes("lower") || c.includes("decrease"));
    if (debuffClause) {
        if (/atk\s*(?:&|and)\s*def|def\s*(?:&|and)\s*atk/i.test(debuffClause)) {
            let val = debuffClause.includes("massively") ? "80" : (debuffClause.includes("greatly") ? "30" : "20");
            let defVal = debuffClause.includes("massively") ? "80" : (debuffClause.includes("greatly") ? "30" : (isSupremeOrHigher ? "20" : "10"));
            stats.push({ icon: `${CENTRAL_ASSET_URL}st_0011.png`, value: val, turns: debuffTurn, target: 'enemy' });
            stats.push({ icon: `${CENTRAL_ASSET_URL}st_0012.png`, value: defVal, turns: debuffTurn, target: 'enemy' });
        } else if (/atk/i.test(debuffClause)) {
            let val = debuffClause.includes("massively") ? "80" : (debuffClause.includes("greatly") ? "30" : "20");
            stats.push({ icon: `${CENTRAL_ASSET_URL}st_0011.png`, value: val, turns: debuffTurn, target: 'enemy' });
        } else if (/def/i.test(debuffClause)) {
            let val = debuffClause.includes("massively") ? "80" : (debuffClause.includes("greatly") ? "50" : (isJanemba ? "30" : (!isSupremeOrHigher ? "20" : "40")));
            stats.push({ icon: `${CENTRAL_ASSET_URL}st_0012.png`, value: val, turns: debuffTurn, target: 'enemy' });
        }
    }

    // 7. STATUS EFFECTS
    if (t.includes("stun")) {
        let prob = t.includes("great chance") ? "70" : (t.includes("high chance") ? "50" : (t.includes("medium chance") ? "30" : "100"));
        stats.push({ icon: `${CENTRAL_ASSET_URL}st_0100.png`, value: prob, turns: "2 turns", target: 'enemy' });
    }
    if (t.includes("seal")) {
        stats.push({ icon: `${CENTRAL_ASSET_URL}st_0102.png`, value: "100", turns: "2 turns", target: 'enemy' });
    }
    if (t.includes("disables") || t.includes("action") || t.includes("break")) {
        stats.push({ icon: `${CENTRAL_ASSET_URL}st_1009.png`, value: "100", turns: "1 turn", target: 'enemy' });
    }

    return stats;
}

function renderAbsSpecialEffects(stats) {
    if (!stats || stats.length === 0) return '';
    const isAbsCleanTheme = document.body.classList.contains('theme-abs-clean');

    const selfStats = stats.filter(s => s.target === 'self');
    const allyStats = stats.filter(s => s.target === 'ally' || s.target === 'allies');
    const enemyStats = stats.filter(s => s.target === 'enemy');

    const getFloatingTagSvg = (typeClass) => {
        if (isAbsCleanTheme) {
            return '';
        }
        if (typeClass === 'allies') {
            return `
                <div class="abs-floating-target-tag allies" title="Allies (+)">
                    <svg class="abs-target-svg allies" viewBox="0 0 34 24" width="24" height="15" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M2 21v-1c0-1.8 1.3-3.2 3-3.4" stroke-width="1.8" opacity="0.75" />
                        <circle cx="5" cy="11" r="2.2" stroke-width="1.8" opacity="0.75" />
                        <path d="M17 16.6c1.7.2 3 1.6 3 3.4v1" stroke-width="1.8" opacity="0.75" />
                        <circle cx="17" cy="11" r="2.2" stroke-width="1.8" opacity="0.75" />
                        <path d="M6 21v-1c0-2.2 1.8-4 4-4h2c2.2 0 4 1.8 4 4v1" stroke-width="2" />
                        <circle cx="11" cy="10" r="2.8" stroke-width="2" />
                        <path d="M24 6h6" stroke-width="2.5" />
                        <path d="M27 3v6" stroke-width="2.5" />
                    </svg>
                </div>
            `;
        } else if (typeClass === 'enemy') {
            return `
                <div class="abs-floating-target-tag enemy" title="Enemy (-)">
                    <svg class="abs-target-svg enemy" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 21v-1c0-2.21 1.79-4 4-4h4c2.21 0 4 1.79 4 4v1" stroke-width="2" />
                        <circle cx="9" cy="10" r="3" stroke-width="2" />
                        <path d="M16 6h6" stroke-width="2.5" />
                    </svg>
                </div>
            `;
        } else {
            return `
                <div class="abs-floating-target-tag self" title="Self (+)">
                    <svg class="abs-target-svg self" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 21v-1c0-2.21 1.79-4 4-4h4c2.21 0 4 1.79 4 4v1" stroke-width="2" />
                        <circle cx="9" cy="10" r="3" stroke-width="2" />
                        <path d="M16 6h6" stroke-width="2.5" />
                        <path d="M19 3v6" stroke-width="2.5" />
                    </svg>
                </div>
            `;
        }
    };

    const renderGroup = (typeClass, statList) => {
        if (statList.length === 0) return '';
        const isNegative = typeClass === 'enemy';
        const tooltipTitle = isNegative ? 'Target: Enemy (-)' : (typeClass === 'allies' ? 'Target: Allies (+)' : 'Target: Self (+)');

        const badgesHtml = statList.map(stat => {
            const cleanVal = stat.value ? String(stat.value).replace(/%/g, '').trim() : '';
            const turns = stat.turns || '1 turn';
            if (isAbsCleanTheme) {
                return `
                    <div class="abs-effect-badge">
                        <img src="${stat.icon}" alt="stat">
                        ${cleanVal ? `<span class="abs-badge-val">${cleanVal}%</span>` : ''}
                        ${cleanVal && turns ? `<span class="abs-badge-sep">|</span>` : ''}
                        <span class="abs-badge-turns">${turns}</span>
                    </div>
                `;
            }
            return `
                <div class="abs-effect-badge">
                    <div class="abs-badge-top">
                        <img src="${stat.icon}" alt="stat">
                        ${cleanVal ? `<span>${cleanVal}%</span>` : ''}
                    </div>
                    <div class="abs-badge-fading-divider"></div>
                    <div class="abs-badge-bottom">${turns}</div>
                </div>
            `;
        }).join('');

        if (isAbsCleanTheme) {
            return `
                <div class="abs-effect-group ${typeClass}" data-tooltip="${tooltipTitle}" title="${tooltipTitle}">
                    <div class="abs-group-badges-row">
                        ${badgesHtml}
                    </div>
                </div>
            `;
        }

        return `
            <div class="abs-effect-group ${typeClass}">
                ${getFloatingTagSvg(typeClass)}
                <div class="abs-group-badges-row">
                    ${badgesHtml}
                </div>
            </div>
        `;
    };

    return `
        <div class="abs-special-effects-section">
            <div class="abs-special-effects-title">${isAbsCleanTheme ? 'EFFECTS' : 'SPECIAL EFFECTS'}</div>
            <div class="abs-special-effects-groups">
                ${renderGroup('self', selfStats)}
                ${renderGroup('allies', allyStats)}
                ${renderGroup('enemy', enemyStats)}
            </div>
        </div>
    `;
}

function normalizeAbsDokkanFieldText(value) {
    return String(value || '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(?:p|div|li)>/gi, '\n')
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/\r\n?/g, '\n')
        .replace(/[ \t]*\n[ \t]*/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/* Some field payloads expose a short prefix and the extended effect under
   different keys. Select the longest candidate, then append any meaningful
   non-duplicate fragments so secondary clauses are never discarded. */
function getAbsDokkanFieldEffectText(source, fallback = '') {
    const candidates = [];
    if (source && typeof source === 'object') {
        [
            source.description,
            source.effect_description,
            source.field_effect_description,
            source.field_effect,
            source.effect_text,
            source.itemized_description,
            source.effect
        ].forEach(value => {
            if (value !== null && value !== undefined && value !== '') candidates.push(value);
        });
    }
    if (fallback !== null && fallback !== undefined && fallback !== '') candidates.push(fallback);

    const normalizedCandidates = candidates
        .map(value => ({
            raw: String(value).trim(),
            plain: normalizeAbsDokkanFieldText(value)
        }))
        .filter(candidate => candidate.plain);
    if (!normalizedCandidates.length) return '';

    const best = normalizedCandidates.reduce((winner, candidate) =>
        candidate.plain.length > winner.plain.length ? candidate : winner
    );
    const base = normalizedCandidates.find(candidate =>
        !/^\s*(?:(?:plus|and|also)\s+)?an?\s+additional\b/i.test(candidate.plain)
    ) || best;
    let merged = base.raw;
    let mergedPlain = base.plain;
    normalizedCandidates.forEach(candidate => {
        const candidatePlain = candidate.plain.toLowerCase();
        if (candidatePlain.includes(mergedPlain.toLowerCase())) {
            merged = candidate.raw;
            mergedPlain = candidate.plain;
            return;
        }
        if (mergedPlain.toLowerCase().includes(candidatePlain)) return;
        merged = `${merged}\n${candidate.raw}`;
        mergedPlain = normalizeAbsDokkanFieldText(merged);
    });
    return merged;
}

function formatAbsCleanDokkanFieldEffect(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    return formatOfficialText(raw, true)
        .replace(/\r\n?/g, '\n')
        .replace(/\n+/g, '<br>');
}

/* Build the Self / Enemy stat rail and separate Damage Received badges used by
   Dokkan Fields in abs.clean. The prose effect remains the source of truth;
   explicit percentage fields are supported when a newer payload provides them. */
function renderAbsCleanFieldStatBadges(text, source = null) {
    const normalized = normalizeAbsDokkanFieldText(text);
    if (!normalized && (!source || typeof source !== 'object')) return '';

    const readPercentList = value => {
        if (value === null || value === undefined || value === '') return [];
        const raw = String(value);
        const matches = raw.match(/[+-]?\d+(?:\.\d+)?\s*%/g) ||
            (/^[+-]?\d+(?:\.\d+)?\s*%?$/.test(raw.trim()) ? [raw.trim()] : []);
        return matches.map(token => {
            const numberMatch = token.match(/[+-]?\d+(?:\.\d+)?/);
            if (!numberMatch) return '';
            const number = numberMatch[0].replace(/^[+-]/, '');
            const sign = numberMatch[0].startsWith('-') ? '-' : '+';
            return `${sign}${number}%`;
        }).filter(Boolean);
    };

    const uniquePercentValues = values => Array.from(new Set(
        values.flatMap(value => Array.isArray(value) ? value : readPercentList(value))
    ));
    const formatStatPercentValues = values => values.map((value, index) =>
        index === 0 ? value : value.replace(/^\+/, '')
    ).join(' + ');
    const formatDamagePercentValues = values => {
        const cleanValues = values.map(value => value.replace(/^\+/, ''));
        return cleanValues.join(' + ');
    };

    const readSourcePercents = keys => {
        if (!source || typeof source !== 'object') return [];
        return uniquePercentValues(keys.flatMap(key => readPercentList(source[key])));
    };

    const clauses = normalized
        .split(/\s*;\s*|\s*,\s*(?=(?:plus|increases?|decreases?|lowers?|raises?)\b)/i)
        .map(clause => clause.trim())
        .filter(Boolean);
    const statClauses = [];
    const damageClauses = [];
    let lastEffectFamily = '';
    clauses.forEach(clause => {
        if (/damage\s+received/i.test(clause)) lastEffectFamily = 'damage';
        else if (/\b(?:atk|def)\b/i.test(clause)) lastEffectFamily = 'stat';

        if (!/\d+(?:\.\d+)?\s*%/.test(clause)) return;
        if (lastEffectFamily === 'damage') damageClauses.push(clause);
        else if (lastEffectFamily === 'stat') statClauses.push(clause);
    });
    const statText = statClauses.join(' ');
    const damageText = damageClauses.join(' ');

    const getClauseTargets = clause => {
        const targets = [];
        if (/\b(?:self|ally|allies|allied)\b/i.test(clause)) targets.push('self');
        if (/\b(?:enemy|enemies)\b/i.test(clause)) targets.push('enemy');
        return targets;
    };
    const findTargetPercents = (items, target) => {
        const values = [];
        let inheritedTargets = [];
        items.forEach(item => {
            const explicitTargets = getClauseTargets(item);
            if (explicitTargets.length) inheritedTargets = explicitTargets;
            const clauseTargets = explicitTargets.length
                ? explicitTargets
                : (inheritedTargets.length ? inheritedTargets : ['self', 'enemy']);
            if (clauseTargets.includes(target)) values.push(...readPercentList(item));
        });
        return values;
    };

    const textSelfValues = findTargetPercents(statClauses, 'self');
    const textEnemyValues = findTargetPercents(statClauses, 'enemy');
    const sourceSelfValues = readSourcePercents(['self_percentage', 'self_percent', 'self_value', 'ally_percentage', 'allies_percentage']);
    const sourceEnemyValues = readSourcePercents(['enemy_percentage', 'enemy_percent', 'enemy_value']);
    const selfValues = textSelfValues.length ? textSelfValues : sourceSelfValues;
    const enemyValues = textEnemyValues.length ? textEnemyValues : sourceEnemyValues;
    const selfValue = formatStatPercentValues(selfValues);
    const enemyValue = formatStatPercentValues(enemyValues);

    const statScopeClause = statClauses.find(item => /\d+(?:\.\d+)?\s*%/.test(item)) || statText;
    const statScope = /\batk\b\s*(?:&|and)\s*\bdef\b/i.test(statScopeClause)
        ? 'ATK / DEF'
        : (/\batk\b/i.test(statScopeClause) ? 'ATK' : 'DEF');

    const textDamageSelfValues = findTargetPercents(damageClauses, 'self');
    const textDamageEnemyValues = findTargetPercents(damageClauses, 'enemy');
    const sourceDamageValues = readSourcePercents([
        'damage_received_percentage',
        'damage_received_percent',
        'damage_received_value',
        'damage_percentage',
        'damage_percent'
    ]);
    const damageSelfValues = textDamageSelfValues.length ? textDamageSelfValues : sourceDamageValues;
    const damageEnemyValues = textDamageEnemyValues.length ? textDamageEnemyValues : sourceDamageValues;
    const damageValues = damageSelfValues.length ? damageSelfValues : damageEnemyValues;
    const damageValue = formatDamagePercentValues(damageValues);
    const hasDamageSelfTarget = /\b(?:self|ally|allies|allied)\b/i.test(damageText);
    const hasDamageEnemyTarget = /\b(?:enemy|enemies)\b/i.test(damageText);
    const damageHasExplicitTarget = hasDamageSelfTarget || hasDamageEnemyTarget;
    const damageSelfValue = damageSelfValues.length && (hasDamageSelfTarget || !damageHasExplicitTarget) ? formatDamagePercentValues(damageSelfValues) : '';
    const damageEnemyValue = damageEnemyValues.length && (hasDamageEnemyTarget || !damageHasExplicitTarget) ? formatDamagePercentValues(damageEnemyValues) : '';

    const renderTrendIcon = kind => `<svg class="abs-clean-target-trend-icon${kind === 'enemy' ? ' is-negative' : ''}" width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M17 18L12 13L7 18M17 11L12 6L7 11" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    const renderLabel = (className, kind, label) => {
        const labelText = `<span class="abs-clean-field-label-text">${label}</span>`;
        const trendIcon = renderTrendIcon(kind);
        // Keep the positive/self arrow before its label and put the negative/enemy
        // arrow after its label so both target groups can remain centered.
        return `
            <span class="${className}">${kind === 'enemy' ? `${labelText}${trendIcon}` : `${trendIcon}${labelText}`}</span>
        `;
    };
    const renderStatBadge = (kind, label, value) => `
        <div class="abs-clean-field-stat-badge ${kind}" data-field-target="${kind}">
            ${renderLabel('abs-clean-field-stat-label', kind, label)}
            <strong class="abs-clean-field-stat-value">${value}</strong>
            <span class="abs-clean-field-stat-scope">${statScope}</span>
        </div>
    `;
    const renderDamageBadge = (kind, label, value) => `
        <div class="abs-clean-field-damage-badge ${kind}" data-field-target="${kind}" data-field-stat="damage-received">
            ${renderLabel('abs-clean-field-damage-label', kind, label)}
            <strong class="abs-clean-field-stat-value abs-clean-field-damage-value">${value}</strong>
            <span class="abs-clean-field-stat-scope abs-clean-field-damage-scope">Damage Received</span>
        </div>
    `;

    let statSection = '';
    if ((statText || selfValue || enemyValue) && (selfValue || enemyValue)) {
        statSection = `
            <div class="abs-clean-field-stat-row" role="group" aria-label="Dokkan Field stat badges">
                ${selfValue ? renderStatBadge('self', 'self', selfValue) : ''}
                ${enemyValue ? renderStatBadge('enemy', 'enemy', enemyValue) : ''}
            </div>
        `;
    }
    let damageSection = '';
    if (damageValue && (damageSelfValue || damageEnemyValue)) {
        damageSection = `
            <div class="abs-clean-field-damage-section" role="group" aria-label="Additional stat metrics">
                <div class="abs-clean-field-damage-row">
                    ${damageSelfValue ? renderDamageBadge('self', 'self', damageSelfValue) : ''}
                    ${damageEnemyValue ? renderDamageBadge('enemy', 'enemy', damageEnemyValue) : ''}
                </div>
            </div>
        `;
    }
    if (!statSection && !damageSection) return '';

    return `
        <div class="abs-clean-field-metric-row" role="group" aria-label="Dokkan Field stat metrics">
            ${statSection}
            ${damageSection}
        </div>
    `;
}

function renderAbsDamageMultiplier(text, typeLabel = '', isActive = false, kiText = '', special = null) {
    if (!text) return '';
    const low = text.toLowerCase();
    const lowLabel = typeLabel.toLowerCase().trim();

    if (/ex\b|ex\s/i.test(lowLabel) || lowLabel.startsWith('ex')) return '';

    const baseMultipliers = {
        'mega-colossal': { 10: 440, 15: 490, 20: 570, 25: 620 },
        'colossal':      { 10: 345, 15: 370, 20: 425, 25: 450 },
        'ultimate':      { 10: 550, 15: 600, 20: 650, 25: 700 },
        'immense':       { 10: 505, 15: 570, 20: 630, 25: 705 },
        'supreme':       { 10: 430, 15: 530, 20: 580, 25: 630 },
        'destructive':   { 10: 290, 15: 360, 20: 390, 25: 420 },
        'extreme':       { 10: 355, 15: 450, 20: 480, 25: 510 },
        'mass':          { 10: 355, 15: 450, 20: 480, 25: 510 },
        'huge':          { 10: 290, 15: 360, 20: 390, 25: 420 },
        'low':           { 10: 220, 15: 290, 20: 320, 25: 350 }
    };

    const exactMultiplier = Number(
        special?.exact_multiplier
        ?? special?.damage_multiplier
        ?? special?.multiplier
        ?? 0,
    );

    let matchedTier = null;
    if (low.includes('mega-colossal')) matchedTier = 'mega-colossal';
    else if (low.includes('colossal')) matchedTier = 'colossal';
    else if (low.includes('ultimate')) matchedTier = 'ultimate';
    else if (low.includes('immense')) matchedTier = 'immense';
    else if (low.includes('supreme')) matchedTier = 'supreme';
    else if (low.includes('destructive')) matchedTier = 'destructive';
    else if (low.includes('extreme')) matchedTier = 'extreme';
    else if (low.includes('mass')) matchedTier = 'mass';
    else if (low.includes('huge')) matchedTier = 'huge';
    else if (low.includes('low')) matchedTier = 'low';

    if (!matchedTier && !(Number.isFinite(exactMultiplier) && exactMultiplier > 0)) return '';

    const isEZA = (typeof currentEzaMode !== 'undefined' && (currentEzaMode === 'eza' || currentEzaMode === 'seza')) ||
                  (selectedCard && (selectedCard.is_eza || selectedCard.is_seza));
                  
    const isLR = selectedCard ? (selectedCard.rarity === 5) : false;
    
    let maxLv = 10;
    if (isLR) {
        maxLv = isEZA ? 25 : 20;
    } else {
        maxLv = isEZA ? 15 : 10;
    }

    // card_specials already carries the exact multiplier for this card's
    // current mode.  EZA/SEZA attacks often share the same damage wording as
    // their base version, so deriving the number from "colossal" alone loses
    // the database's real EZA value.  Use the exported value whenever it is
    // available and keep the text formula only as a legacy fallback.
    const maxVal = (Number.isFinite(exactMultiplier) && exactMultiplier > 0
        ? exactMultiplier
        : (baseMultipliers[matchedTier]?.[maxLv] || baseMultipliers[matchedTier]?.[10] || 430)) + '%';
    const cleanKi = kiText ? kiText.replace(/[\(\)]/g, '').trim() : '';

    return `
        <div class="abs-damage-multiplier-box">
            <div class="abs-multiplier-left">
                <span class="abs-multiplier-title">DAMAGE MULTIPLIER</span>
                ${cleanKi ? `<span class="abs-multiplier-ki-tag">${cleanKi}</span>` : ''}
            </div>
            <div class="abs-multiplier-pills">
                <div class="abs-multiplier-pill">
                    <span class="pill-val">${maxVal}</span>
                    <span class="pill-at">at</span>
                    <span class="pill-lv">Lv. ${maxLv}</span>
                </div>
            </div>
        </div>
    `;
}

window.formatOfficialText = formatOfficialText;
window.formatCategoryQuotes = function(t) { return formatOfficialText(t, true); };
window.parsePassiveSections = parsePassiveSections;
window.autoDetectSAStats = autoDetectSAStats;
window.renderAbsSpecialEffects = renderAbsSpecialEffects;
window.getAbsDokkanFieldEffectText = getAbsDokkanFieldEffectText;
window.formatAbsCleanDokkanFieldEffect = formatAbsCleanDokkanFieldEffect;
window.renderAbsCleanFieldStatBadges = renderAbsCleanFieldStatBadges;
window.renderAbsDamageMultiplier = renderAbsDamageMultiplier;
