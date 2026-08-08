/* ============================================================
   3. UI SYNCING & MANAGER FUNCTIONS
   ============================================================ */
window.updateCardDisplay = function() {
    window.updateIconImages();
    if (window.syncToAbsLayout) {
        window.syncToAbsLayout();
    }
};

window.applyCardTheme = function(newSuffix) {
    currentType = newSuffix;
    const typeSuffixes = ['agl', 'teq', 'int', 'str', 'phy', 'none'];
    typeSuffixes.forEach(suf => {
        document.querySelectorAll(`.bg-${suf}`).forEach(el => el.classList.replace(`bg-${suf}`, `bg-${newSuffix}`));
        document.querySelectorAll(`.bg-${suf}-2`).forEach(el => el.classList.replace(`bg-${suf}-2`, `bg-${newSuffix}-2`));
        document.querySelectorAll(`.border-${suf}`).forEach(el => el.classList.replace(`border-${suf}`, `border-${newSuffix}`));
    });

    // DYNAMIC DOKKAN TYPE COLOR MAP WITH RICH DARK BACKGROUND TONES
    const themeMap = {
        agl: { main: '#1d4ed8', border: '#3b82f6', header: '#1e40af', text: '#38bdf8', glow: 'rgba(56, 189, 248, 0.6)', bg: '#0f172a', darkBg: '#091328' },
        teq: { main: '#15803d', border: '#22c55e', header: '#166534', text: '#4ade80', glow: 'rgba(74, 222, 128, 0.6)', bg: '#052e16', darkBg: '#021f0e' },
        int: { main: '#7e22ce', border: '#a855f7', header: '#6b21a8', text: '#c084fc', glow: 'rgba(192, 132, 252, 0.6)', bg: '#2e1065', darkBg: '#160533' },
        str: { main: '#b91c1c', border: '#ef4444', header: '#991b1b', text: '#f87171', glow: 'rgba(248, 113, 113, 0.6)', bg: '#450a0a', darkBg: '#260404' },
        phy: { main: '#b45309', border: '#f59e0b', header: '#92400e', text: '#fbbf24', glow: 'rgba(251, 191, 36, 0.6)', bg: '#451a03', darkBg: '#240f02' },
        none: { main: '#3f3f46', border: '#71717a', header: '#27272a', text: '#a1a1aa', glow: 'rgba(113, 113, 122, 0.5)', bg: '#18181b', darkBg: '#09090b' }
    };

    const colors = themeMap[newSuffix] || themeMap.none;
    const root = document.documentElement;
    root.style.setProperty('--type-main', colors.main);
    root.style.setProperty('--type-border', colors.border);
    root.style.setProperty('--type-header', colors.header);
    root.style.setProperty('--type-text', colors.text);
    root.style.setProperty('--type-glow', colors.glow);
    root.style.setProperty('--type-bg', colors.bg);
    root.style.setProperty('--type-dark-bg', colors.darkBg);

    // UPDATE ALL LIGHTNING OVERLAYS (BOTH MAIN & ABS LAYOUT)
    document.querySelectorAll('.lightning-overlay').forEach(lightning => {
        lightning.style.setProperty('--lightning-color', lightningColors[newSuffix]);
    });

    window.updateIconImages();
    window.calcFromMin('hp');
    window.calcFromMin('atk');
    window.calcFromMin('def');
};

window.updateIconImages = function() {
    // Top-left main icon gets Class + Type (e.g. Super AGL / Extreme AGL)
    const mainTypeIcon = document.querySelector('.card-icon-item-type .typing-icon');
    if (mainTypeIcon) mainTypeIcon.src = typeImageMap[currentClass][currentType];

    // TUR bottom row icon gets Class + Type (Super AGL / Extreme AGL)
    document.querySelectorAll('#tur-row .typing-icon').forEach(img => {
        img.src = typeImageMap[currentClass][currentType];
    });

    // SSR bottom row icon gets plain Type ONLY without Class (type_agl.png, type_teq.png, etc.)
    document.querySelectorAll('#ssr-row .typing-icon').forEach(img => {
        img.src = typeImageUrls[currentType];
    });

    document.querySelectorAll(".card-frame").forEach(f => f.src = frameMap[currentType]);

    // Live sync directly to ABS Layout icons
    if (window.syncToAbsLayout) {
        window.syncToAbsLayout();
    }
};

window.updateRarityStats = function(rarityName) {
    currentRarity = rarityName;
    window.currentRarity = rarityName; // Synchronize window property

    const mainIcon = document.getElementById('main-rarity-icon');
    const ssrIcon = document.getElementById('ssr-rarity-icon');
    const turIcon = document.getElementById('tur-rarity-icon');

    if (mainIcon) mainIcon.src = `./images/rarity_${rarityName}.png`;
    
    // Handle bottom preview rows
    if (rarityName === "none") {
        if (ssrIcon) ssrIcon.src = "./images/rarity_none.png";
        if (turIcon) turIcon.src = "./images/rarity_none.png";
    } else {
        if (ssrIcon) ssrIcon.src = "./images/rarity_ssr.png";
        if (turIcon) turIcon.src = "./images/rarity_TUR.png";
    }

    const lightning = document.querySelector('.lightning-overlay');
    const spinDial = document.querySelector('.lr-spin-dial');
    const turRow = document.getElementById('tur-row');

    if (rarityName === "LR") {
        if(lightning) lightning.style.display = 'block';
        if(spinDial) spinDial.style.display = 'block';
        if(turRow) turRow.style.display = 'block';
        document.querySelectorAll('.sa-20-bonus').forEach(el => el.style.display = 'block');
    } else if (rarityName === "none") {
        if(lightning) lightning.style.display = 'none';
        if(spinDial) spinDial.style.display = 'none';
        if(turRow) turRow.style.display = 'block';
        document.querySelectorAll('.sa-20-bonus').forEach(el => el.style.display = 'block');
    } else {
        if(lightning) lightning.style.display = 'none';
        if(spinDial) spinDial.style.display = 'none';
        if(turRow) turRow.style.display = 'none';
        document.querySelectorAll('.sa-20-bonus').forEach(el => el.style.display = 'none');
    }
    
    const stats = rarityStats[rarityName];
    if (stats) {
        document.getElementById("max-lv").textContent = stats.max;
        document.getElementById("sa-lv").textContent = stats.sa;
        document.getElementById("cost").textContent = stats.cost;
    }

    // Live sync directly to ABS Layout
    if (window.syncToAbsLayout) {
        window.syncToAbsLayout();
    }
};


window.applyLeaderPreset = function(type) {
    const leaderInput = document.getElementById("leaderInput");
    if (!leaderInput) return;
    let presetText = "";
    switch(type) {
        case 'dfe': presetText = '"Category 1", "Category 2" or "Category 3" Category Ki +3, HP +200% and ATK & DEF +170%, plus an additional HP, ATK & DEF +50% for characters who also belong to the "Category 4" or "Category" 5 Category'; break;
        case 'carnival': presetText = '"Category 1" Category Ki +4 and HP, ATK & DEF +220%'; break;
        case 'lr': presetText = '"Category 1" or "Category 2" Category Ki +3 and HP, ATK & DEF +200%'; break;
    }
    leaderInput.value = presetText;
    window.updateIdentity();
};

window.applySAPreset = function(val) {
    if (!val) return;
    const effectInput = document.getElementById("input-sa-effects");
    let presetText = "";
    switch(val) {
        case 'raise': presetText = "Raises ATK & DEF for 1 turn\nand causes supreme damage to enemy"; break;
        case 'greatly': presetText = "Greatly raises ATK & DEF for 1 turn\nand causes supreme damage to enemy"; break;
        case 'massively': presetText = "Massively raises ATK & DEF for 1 turn\nand causes supreme damage to enemy"; break;
        case 'raise_stack': presetText = "Raises ATK & DEF\nand causes supreme damage to enemy"; break;
        case 'lower': presetText = "Causes supreme damage to enemy and lowers ATK & DEF"; break;
        case 'greatly_lower': presetText = "Causes supreme damage to enemy and greatly lowers ATK & DEF"; break;
        case 'lower_def': presetText = "Causes supreme damage to enemy and lowers DEF"; break;
        case 'stun': presetText = "Causes supreme damage to enemy with a medium chance of stunning"; break;
        case 'stun_high': presetText = "Causes supreme damage to enemy with a high chance of stunning"; break;
        case 'seal': presetText = "Causes supreme damage to enemy and seals Super Attack"; break;
        case 'break': presetText = "Causes supreme damage to enemy and disables enemy's action once within the turn"; break;
    }
    effectInput.value = presetText;
    window.syncSuperAttack();
    window.autoGenerateSAIcons();
    document.getElementById("sa-preset-dropdown").value = "";
};

window.autoGenerateSAIcons = function() {
    if (!currentSuperAttack) return;
    const text = document.getElementById("input-sa-effects").value;
    const container = currentSuperAttack.querySelector('.stats-container');
    if (!container) return;
    
    container.innerHTML = ""; 
    let statsToAdd = [];
    let t = text.toLowerCase();

    const isSupremeOrHigher = /supreme|immense|colossal|ultimate/.test(t);

    // --- 1. SELF BUFFS (ATK & DEF) ---
    const jointSelfMatch = t.match(/(?<!allies'?\s+)(?<!ally'?s\s+)(?:raises?|boosts?)\s+(?:atk\s*&\s*def|def\s*&\s*atk)[^\.\;\,\n]*?(?:by\s+)?(\d+)%/i) ||
                           t.match(/(?:atk\s*&\s*def|def\s*&\s*atk)[^\.\;\,\n]*?\+(?:by\s+)?(\d+)%/i);

    let jointTurns = "99 turns";
    const jointTurnMatch = t.match(/(?:atk\s*&\s*def|def\s*&\s*atk)[^\.\;\,\n]*?for\s+(\d+)\s+turn/i) ||
                           t.match(/for\s+(\d+)\s+turn[^\.\;\,\n]*?(?:atk\s*&\s*def|def\s*&\s*atk)/i);
    if (jointTurnMatch) {
        const num = parseInt(jointTurnMatch[1], 10);
        jointTurns = `${num} turn${num > 1 ? 's' : ''}`;
    } else if (t.includes("for 1 turn") && !t.includes("in battle")) {
        if (!/in battle|rest of battle/i.test(t)) {
            jointTurns = "1 turn";
        }
    }

    if (jointSelfMatch) {
        const val = jointSelfMatch[1] + "%";
        statsToAdd.push({ img: "./images/st_0001.png", val: val, target: "self", turns: jointTurns });
        statsToAdd.push({ img: "./images/st_0002.png", val: val, target: "self", turns: jointTurns });
    } else if (t.includes("massively raises atk & def") || t.includes("massively raises def & atk")) {
        statsToAdd.push({ img: "./images/st_0001.png", val: "100%", target: "self", turns: jointTurns });
        statsToAdd.push({ img: "./images/st_0002.png", val: "100%", target: "self", turns: jointTurns });
    } else if (t.includes("greatly raises atk & def") || t.includes("greatly raises def & atk")) {
        statsToAdd.push({ img: "./images/st_0001.png", val: "50%", target: "self", turns: jointTurns });
        statsToAdd.push({ img: "./images/st_0002.png", val: "50%", target: "self", turns: jointTurns });
    } else if (t.match(/raises atk & def for \d+ turn/) || t.match(/raises def & atk for \d+ turn/)) {
        statsToAdd.push({ img: "./images/st_0001.png", val: "30%", target: "self", turns: jointTurns });
        statsToAdd.push({ img: "./images/st_0002.png", val: "30%", target: "self", turns: jointTurns });
    } else if (t.includes("raises atk & def") || t.includes("raises def & atk")) {
        statsToAdd.push({ img: "./images/st_0001.png", val: "20%", target: "self", turns: jointTurns });
        statsToAdd.push({ img: "./images/st_0002.png", val: "20%", target: "self", turns: jointTurns });
    } else {
        // Separate Self ATK
        const selfAtkMatch = t.match(/(?<!allies'?\s+)(?<!ally'?s\s+)(?:raises?|boosts?)\s+atk[^\.\;\,\n]*?(?:by\s+)?(\d+)%/i);
        let atkTurns = "99 turns";
        const atkTurnMatch = t.match(/(?:raises?|boosts?)\s+atk[^\.\;\,\n]*?for\s+(\d+)\s+turn/i) ||
                               t.match(/atk[^\.\;\,\n]*?for\s+(\d+)\s+turn/i);
        if (atkTurnMatch) {
            const num = parseInt(atkTurnMatch[1], 10);
            atkTurns = `${num} turn${num > 1 ? 's' : ''}`;
        }

        if (selfAtkMatch) {
            statsToAdd.push({ img: "./images/st_0001.png", val: selfAtkMatch[1] + "%", target: "self", turns: atkTurns });
        } else if (t.includes("massively raises atk")) {
            statsToAdd.push({ img: "./images/st_0001.png", val: "100%", target: "self", turns: atkTurns });
        } else if (t.includes("greatly raises atk")) {
            statsToAdd.push({ img: "./images/st_0001.png", val: "50%", target: "self", turns: atkTurns });
        } else if (t.includes("raises atk")) {
            statsToAdd.push({ img: "./images/st_0001.png", val: "30%", target: "self", turns: atkTurns });
        }

        // Separate Self DEF
        const selfDefMatch = t.match(/(?<!allies'?\s+)(?<!ally'?s\s+)(?:raises?|boosts?)\s+def[^\.\;\,\n]*?(?:by\s+)?(\d+)%/i);
        let defTurns = "99 turns";
        const defTurnMatch = t.match(/(?:raises?|boosts?)\s+def[^\.\;\,\n]*?for\s+(\d+)\s+turn/i) ||
                               t.match(/def[^\.\;\,\n]*?for\s+(\d+)\s+turn/i);
        if (defTurnMatch) {
            const num = parseInt(defTurnMatch[1], 10);
            defTurns = `${num} turn${num > 1 ? 's' : ''}`;
        }

        if (selfDefMatch) {
            statsToAdd.push({ img: "./images/st_0002.png", val: selfDefMatch[1] + "%", target: "self", turns: defTurns });
        } else if (t.includes("massively raises def")) {
            statsToAdd.push({ img: "./images/st_0002.png", val: "100%", target: "self", turns: defTurns });
        } else if (t.includes("greatly raises def")) {
            statsToAdd.push({ img: "./images/st_0002.png", val: "50%", target: "self", turns: defTurns });
        } else if (t.includes("raises def")) {
            statsToAdd.push({ img: "./images/st_0002.png", val: "30%", target: "self", turns: defTurns });
        }
    }

    // --- 2. HP RECOVERY & HP SACRIFICE ---
    const hpRecoveryMatch = t.match(/recovers?\s+(\d+)%\s*hp/i);
    if (hpRecoveryMatch) {
        statsToAdd.push({ img: "./images/st_recover.png", val: hpRecoveryMatch[1] + "%", target: "self", turns: "1 turn" });
    } else if (t.includes("recovers hp") || t.includes("recovers health")) {
        statsToAdd.push({ img: "./images/st_recover.png", val: "HP", target: "self", turns: "1 turn" });
    }

    const hpSacrificeMatch = t.match(/sacrifices?\s+(\d+)%\s*hp/i) || t.match(/sacrificing\s+(\d+)%\s*hp/i);
    if (hpSacrificeMatch) {
        statsToAdd.push({ img: "./images/st_recover_minus.png", val: hpSacrificeMatch[1] + "%", target: "self", turns: "1 turn" });
    } else if (t.includes("sacrifices hp") || t.includes("sacrificing hp")) {
        statsToAdd.push({ img: "./images/st_recover_minus.png", val: "HP", target: "self", turns: "1 turn" });
    }


    // --- 3. ALLIES BUFFS ---
    const alliesJointMatch = t.match(/(?:allies'?|all\s+allies'?)\s*(?:atk\s*&\s*def|def\s*&\s*atk)[^\.\;\,\n]*?(\d+)%/i) ||
                            t.match(/(?:raises?|boosts?)\s+allies'?\s+(?:atk\s*&\s*def|def\s*&\s*atk)[^\.\;\,\n]*?(\d+)%/i);
    const alliesAtkMatch = t.match(/(?:allies'?|all\s+allies'?)\s*atk[^\.\;\,\n]*?(\d+)%/i) ||
                           t.match(/(?:raises?|boosts?)\s+allies'?\s+atk[^\.\;\,\n]*?(\d+)%/i);
    const alliesDefMatch = t.match(/(?:allies'?|all\s+allies'?)\s*def[^\.\;\,\n]*?(\d+)%/i) ||
                           t.match(/(?:raises?|boosts?)\s+allies'?\s+def[^\.\;\,\n]*?(\d+)%/i);

    let allyTurns = "1 turn";
    if (t.includes("in battle") || t.includes("rest of battle")) {
        allyTurns = "99 turns";
    } else {
        const allyTurnMatch = t.match(/allies'?[\s\S]{0,40}?for\s+(\d+)\s+turn/i);
        if (allyTurnMatch) {
            const num = parseInt(allyTurnMatch[1], 10);
            allyTurns = `${num} turn${num > 1 ? 's' : ''}`;
        }
    }

    // Check if self is explicitly excluded
    const isSelfExcluded = /self excluded|excluding self|self-excluded/i.test(t);

    if (alliesJointMatch) {
        const val = alliesJointMatch[1] + "%";
        if (!isSelfExcluded) {
            statsToAdd.push({ img: "./images/st_0001.png", val: val, target: "self", turns: allyTurns });
            statsToAdd.push({ img: "./images/st_0002.png", val: val, target: "self", turns: allyTurns });
        }
        statsToAdd.push({ img: "./images/st_0001.png", val: val, target: "ally", turns: allyTurns });
        statsToAdd.push({ img: "./images/st_0002.png", val: val, target: "ally", turns: allyTurns });
    } else {
        if (alliesAtkMatch) {
            const val = alliesAtkMatch[1] + "%";
            if (!isSelfExcluded) {
                statsToAdd.push({ img: "./images/st_0001.png", val: val, target: "self", turns: allyTurns });
            }
            statsToAdd.push({ img: "./images/st_0001.png", val: val, target: "ally", turns: allyTurns });
        }
        if (alliesDefMatch) {
            const val = alliesDefMatch[1] + "%";
            if (!isSelfExcluded) {
                statsToAdd.push({ img: "./images/st_0002.png", val: val, target: "self", turns: allyTurns });
            }
            statsToAdd.push({ img: "./images/st_0002.png", val: val, target: "ally", turns: allyTurns });
        }
    }

    // --- 4. ENEMY DEBUFFS (LOWER ATK & DEF) ---
    let debuffTurns = "3 turns";
    const debuffTurnMatch = t.match(/(?:lowers?|decreases?)[^\.\;\,\n]*?for\s+(\d+)\s+turn/i);
    if (debuffTurnMatch) {
        const num = parseInt(debuffTurnMatch[1], 10);
        debuffTurns = `${num} turn${num > 1 ? 's' : ''}`;
    }

    const lowerJointMatch = t.match(/(?:lowers?|decreases?)\s+(?:enemy's\s+)?(?:atk\s*&\s*def|def\s*&\s*atk)[^\.\;\,\n]*?(?:by\s+)?(\d+)%/i);
    if (lowerJointMatch) {
        const val = lowerJointMatch[1] + "%";
        statsToAdd.push({ img: "./images/st_0011.png", val: val, target: "enemy", turns: debuffTurns });
        statsToAdd.push({ img: "./images/st_0012.png", val: val, target: "enemy", turns: debuffTurns });
    } else if (t.includes("massively lowers atk & def") || t.includes("massively lowers def & atk")) {
        statsToAdd.push({ img: "./images/st_0011.png", val: "80%", target: "enemy", turns: debuffTurns });
        statsToAdd.push({ img: "./images/st_0012.png", val: "80%", target: "enemy", turns: debuffTurns });
    } else if (t.includes("greatly lowers atk & def") || t.includes("greatly lowers def & atk")) {
        statsToAdd.push({ img: "./images/st_0011.png", val: "30%", target: "enemy", turns: debuffTurns });
        statsToAdd.push({ img: "./images/st_0012.png", val: "30%", target: "enemy", turns: debuffTurns });
    } else if (t.includes("lowers atk & def") || t.includes("lowers def & atk")) {
        statsToAdd.push({ img: "./images/st_0011.png", val: "20%", target: "enemy", turns: debuffTurns });
        statsToAdd.push({ img: "./images/st_0012.png", val: isSupremeOrHigher ? "20%" : "10%", target: "enemy", turns: debuffTurns });
    } else {
        const lowerAtkMatch = t.match(/(?:lowers?|decreases?)\s+(?:enemy's\s+)?atk[^\.\;\,\n]*?(?:by\s+)?(\d+)%/i);
        if (lowerAtkMatch) {
            statsToAdd.push({ img: "./images/st_0011.png", val: lowerAtkMatch[1] + "%", target: "enemy", turns: debuffTurns });
        } else if (t.includes("massively lowers atk")) {
            statsToAdd.push({ img: "./images/st_0011.png", val: "80%", target: "enemy", turns: debuffTurns });
        } else if (t.includes("greatly lowers atk")) {
            statsToAdd.push({ img: "./images/st_0011.png", val: "30%", target: "enemy", turns: debuffTurns });
        } else if (t.includes("lowers atk")) {
            statsToAdd.push({ img: "./images/st_0011.png", val: "20%", target: "enemy", turns: debuffTurns });
        }

        const lowerDefMatch = t.match(/(?:lowers?|decreases?)\s+(?:enemy's\s+)?def[^\.\;\,\n]*?(?:by\s+)?(\d+)%/i);
        if (lowerDefMatch) {
            statsToAdd.push({ img: "./images/st_0012.png", val: lowerDefMatch[1] + "%", target: "enemy", turns: debuffTurns });
        } else if (t.includes("massively lowers def")) {
            statsToAdd.push({ img: "./images/st_0012.png", val: "80%", target: "enemy", turns: debuffTurns });
        } else if (t.includes("greatly lowers def")) {
            statsToAdd.push({ img: "./images/st_0012.png", val: "50%", target: "enemy", turns: debuffTurns });
        } else if (t.includes("lowers def")) {
            statsToAdd.push({ img: "./images/st_0012.png", val: isSupremeOrHigher ? "40%" : "20%", target: "enemy", turns: debuffTurns });
        }
    }

    // --- 5. ENEMY STATUS EFFECTS (STUN, SEAL, DISABLE ACTION) ---
    if (t.includes("rare chance of stunning") || t.includes("rare chance to stun")) statsToAdd.push({ img: "./images/st_0100.png", val: "25%", target: "enemy", turns: "2 turns" });
    else if (t.includes("medium chance of stunning") || t.includes("medium chance to stun") || t.includes("sometimes stuns")) statsToAdd.push({ img: "./images/st_0100.png", val: "30%", target: "enemy", turns: "2 turns" });
    else if (t.includes("high chance of stunning") || t.includes("high chance to stun")) statsToAdd.push({ img: "./images/st_0100.png", val: "50%", target: "enemy", turns: "2 turns" });
    else if (t.includes("great chance of stunning") || t.includes("great chance to stun")) statsToAdd.push({ img: "./images/st_0100.png", val: "70%", target: "enemy", turns: "2 turns" });
    else if (t.match(/\bstuns\b/)) statsToAdd.push({ img: "./images/st_0100.png", val: "100%", target: "enemy", turns: "2 turns" });

    if (t.includes("medium chance of sealing") || t.includes("medium chance to seal")) statsToAdd.push({ img: "./images/st_0102.png", val: "30%", target: "enemy", turns: "2 turns" });
    else if (t.includes("high chance of sealing") || t.includes("high chance to seal")) statsToAdd.push({ img: "./images/st_0102.png", val: "50%", target: "enemy", turns: "2 turns" });
    else if (t.match(/\bseals\b/)) statsToAdd.push({ img: "./images/st_0102.png", val: "100%", target: "enemy", turns: "2 turns" });

    if (t.includes("disables") || t.includes("action") || t.includes("break")) {
        statsToAdd.push({ img: "./images/st_1009.png", val: "100%", target: "enemy", turns: "1 turn" });
    }

    // --- 6. CRITICAL HIT & EFFECTIVE AGAINST ALL TYPES ---
    let critTurns = "1 turn";
    const critTurnMatch = t.match(/critical[^\.\;\,\n]*?for\s+(\d+)\s+turn/i);
    if (critTurnMatch) {
        const num = parseInt(critTurnMatch[1], 10);
        critTurns = `${num} turn${num > 1 ? 's' : ''}`;
    }

    let critCustomMatch = t.match(/critical\s+hit[^\d]*?(\d+)%/i);
    if (critCustomMatch) {
        statsToAdd.push({ img: "./images/pot_skill_02_on.png", val: critCustomMatch[1] + "%", target: "self", turns: critTurns });
    } else if (t.includes("all attacks become critical hits")) {
        statsToAdd.push({ img: "./images/pot_skill_02_on.png", val: "100%", target: "self", turns: critTurns });
    } else if (t.includes("great chance of performing a critical hit")) {
        statsToAdd.push({ img: "./images/pot_skill_02_on.png", val: "70%", target: "self", turns: critTurns });
    } else if (t.includes("high chance of performing a critical hit")) {
        statsToAdd.push({ img: "./images/pot_skill_02_on.png", val: "50%", target: "self", turns: critTurns });
    } else if (t.includes("chance of performing a critical hit")) {
        statsToAdd.push({ img: "./images/pot_skill_02_on.png", val: "30%", target: "self", turns: critTurns });
    } else if (t.includes("performs a critical hit")) {
        statsToAdd.push({ img: "./images/pot_skill_02_on.png", val: "100%", target: "self", turns: critTurns });
    }

    if (t.includes("effective against all types")) {
        statsToAdd.push({ img: "./images/st_atk_super.png", val: "100%", target: "self", turns: "1 turn" });
    }

    // --- 7. EVASION & DODGING ---
    let evadeTurns = "1 turn";
    const evadeTurnMatch = t.match(/evading[^\.\;\,\n]*?for\s+(\d+)\s+turn/i) || t.match(/evades[^\.\;\,\n]*?for\s+(\d+)\s+turn/i);
    if (evadeTurnMatch) {
        const num = parseInt(evadeTurnMatch[1], 10);
        evadeTurns = `${num} turn${num > 1 ? 's' : ''}`;
    }

    let evadeCustomMatch = t.match(/evading[^\d]*?(\d+)%/i);
    if (evadeCustomMatch) {
        statsToAdd.push({ img: "./images/st_evasion.png", val: evadeCustomMatch[1] + "%", target: "self", turns: evadeTurns });
    } else if (t.includes("great chance of evading")) {
        statsToAdd.push({ img: "./images/st_evasion.png", val: "70%", target: "self", turns: evadeTurns });
    } else if (t.includes("high chance of evading")) {
        statsToAdd.push({ img: "./images/st_evasion.png", val: "50%", target: "self", turns: evadeTurns });
    } else if (t.includes("medium chance of evading") || t.includes("sometimes evades")) {
        statsToAdd.push({ img: "./images/st_evasion.png", val: "30%", target: "self", turns: evadeTurns });
    } else if (t.includes("rare chance of evading")) {
        statsToAdd.push({ img: "./images/st_evasion.png", val: "25%", target: "self", turns: evadeTurns });
    } else if (t.includes("evades enemy's attack") || t.includes("dodges enemy's attack")) {
        statsToAdd.push({ img: "./images/st_evasion.png", val: "100%", target: "self", turns: evadeTurns });
    }

    // --- 8. RENDER STAT ROWS WITH DATA ATTRIBUTES ---
    let htmlBuffer = "";
    statsToAdd.forEach(stat => { 
        htmlBuffer += `<div class="col sa-stat-row" data-target="${stat.target || 'self'}" data-turns="${stat.turns || '1 turn'}"><img class="display-img" width="50" src="${stat.img}"><span class="display-text ms-1">${stat.val}</span></div>`; 
    });
    container.innerHTML = htmlBuffer;
    
    window.refreshStatSidebar();
};

// HELPER FUNCTION: FORMATS QUOTED CATEGORIES WITH GLOWING SPAN
window.formatCategoryQuotes = function(text) {
    if (!text) return "";
    return text.replace(/["“”]([^"”]+)["”]/g, '<span class="abs-category-quote">"$1"</span>');
};

// ALIAS FOR BACKWARDS COMPATIBILITY
window.formatLeaderSkillQuotes = window.formatCategoryQuotes;

window.updateIdentity = function() {
    const descEl = document.getElementById("descInput");
    const nameEl = document.getElementById("nameInput");
    const leaderEl = document.getElementById("leaderInput");

    const rawDesc = descEl ? descEl.value : (document.getElementById("char-description")?.textContent || "");
    const name = nameEl ? nameEl.value : (document.getElementById("char-name")?.textContent || "");
    const leaderRaw = leaderEl ? leaderEl.value : (document.getElementById("leader-skill")?.innerText || "");

    const cleanTitle = rawDesc.replace(/[\[\]]/g, '').trim();
    const descDisplay = document.getElementById("char-description");
    if (descDisplay && cleanTitle) descDisplay.textContent = cleanTitle;

    const nameDisplay = document.getElementById("char-name");
    if (nameDisplay && name) nameDisplay.textContent = name;

    const leaderDisplay = document.getElementById("leader-skill");
    if (leaderDisplay && leaderRaw) leaderDisplay.innerHTML = leaderRaw.replace(/\n/g, '<br>');

    // SYNC TO ABS LAYOUT WITH GLOWING QUOTES
    const dbDesc = document.getElementById("abs-char-description") || document.getElementById("abs-char-title");
    if (dbDesc && cleanTitle) dbDesc.textContent = cleanTitle;

    const dbName = document.getElementById("abs-char-name");
    if (dbName && name) dbName.textContent = name;

    const dbLeader = document.getElementById("abs-leader-skill");
    if (dbLeader && leaderRaw) dbLeader.innerHTML = window.formatCategoryQuotes(leaderRaw).replace(/\n/g, '<br>');

    const passiveSidebarVal = document.getElementById("input-passive-name-sidebar")?.value;
    const dbPassiveName = document.getElementById("abs-passive-name");
    if (dbPassiveName && passiveSidebarVal) {
        dbPassiveName.textContent = "Passive Skill - " + passiveSidebarVal;
    }

    const container = document.getElementById("release-dates-container");
    const dateEl = document.getElementById("dateInput");
    const ezaDateEl = document.getElementById("ezaDateInput");
    const sezaDateEl = document.getElementById("sezaDateInput");

    let baseDate = dateEl ? dateEl.value.trim() : "";
    let ezaDate = ezaDateEl ? ezaDateEl.value.trim() : "";
    let sezaDate = sezaDateEl ? sezaDateEl.value.trim() : "";

    // SAFEGUARD: Read existing dates from rendered HTML if inputs are detached (e.g. Published / Quick Edit Mode)
    if (!baseDate && container) {
        const cells = container.querySelectorAll('.row.padding-top-bottom-5');
        if (cells.length > 0) {
            baseDate = cells[0].textContent.replace('Release Date', '').trim();
        }
    }
    if (!baseDate) baseDate = "TBD";

    if (!ezaDate && container) {
        const cells = container.querySelectorAll('.row.padding-top-bottom-5');
        if (cells.length > 1) {
            ezaDate = cells[1].textContent.replace('EZA Release Date', '').trim();
        }
    }

    if (!sezaDate && container) {
        const cells = container.querySelectorAll('.row.padding-top-bottom-5');
        if (cells.length > 2) {
            sezaDate = cells[2].textContent.replace('SEZA Release Date', '').trim();
        }
    }

    let html = `
    <div class="row border border-2 border-dark margin-top-bottom-5 border-${currentType} bg-${currentType} dokkan-card">
        <div class="col p-0">
            <div class="row padding-top-bottom-5 bg-${currentType} m-0">
                <div class="col text-center"><b>Release Date</b></div>
            </div>
            <div class="row padding-top-bottom-5 bg-${currentType}-2 m-0">
                <div class="col text-center">${baseDate}</div>
            </div>`;

    if (currentAwakeningMode === 'eza' || currentAwakeningMode === 'seza') {
        html += `
            <div class="row padding-top-bottom-5 bg-${currentType} m-0">
                <div class="col text-center"><b>EZA Release Date</b></div>
            </div>
            <div class="row padding-top-bottom-5 bg-${currentType}-2 m-0">
                <div class="col text-center">${ezaDate || "TBD"}</div>
            </div>`;
    }

    if (currentAwakeningMode === 'seza') {
        html += `
            <div class="row padding-top-bottom-5 bg-${currentType} m-0">
                <div class="col text-center"><b>SEZA Release Date</b></div>
            </div>
            <div class="row padding-top-bottom-5 bg-${currentType}-2 m-0">
                <div class="col text-center">${sezaDate || "TBD"}</div>
            </div>`;
    }

    html += `
        </div>
    </div>`;

    if (container) container.innerHTML = html;
};

window.updateActiveCard = function() {
    const actName = document.getElementById('input-active-name');
    const actEff = document.getElementById('input-active-effect');
    const actCondTitle = document.getElementById('input-active-condition-title');
    const actCond = document.getElementById('input-active-conditions');
    
    if(actName && currentActiveSkill) {
        const nd = currentActiveSkill.querySelector('.active-display-name');
        if (nd) nd.innerText = actName.value;
    }
    if(actEff && currentActiveSkill) {
        const ed = currentActiveSkill.querySelector('.active-display-effect');
        if (ed) ed.innerHTML = actEff.value.replace(/\n/g, '<br>');
    }
    if(actCondTitle && currentActiveSkill) {
        const ctd = currentActiveSkill.querySelector('.active-display-condition-title');
        if (ctd) ctd.innerText = actCondTitle.value;
    }
    if(actCond && currentActiveSkill) {
        const cd = currentActiveSkill.querySelector('.active-display-condition');
        if (cd) cd.innerHTML = actCond.value.replace(/\n/g, '<br>');
    }
};