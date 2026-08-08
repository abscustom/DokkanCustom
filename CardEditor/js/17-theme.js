/* ============================================================
   THEME MANAGER & ABS LAYOUT SYNCRONIZER
   ============================================================ */

window.toggleCardTheme = function(isDbTheme) {
    const appEl = document.getElementById('app');
    const layoutInfo = document.getElementById('layout-dokkaninfo');
    const layoutDb = document.getElementById('layout-abs-style');
    
    const btnInfo = document.getElementById('theme-btn-info');
    const btnDb = document.getElementById('theme-btn-abs');
    
    window.currentCardThemeStyle = isDbTheme ? 'abs-style' : 'dokkaninfo';
    localStorage.setItem('dokkan_selected_theme', window.currentCardThemeStyle); 

    if (isDbTheme && window.syncToAbsLayout) {
        window.syncToAbsLayout();
    }

    if (layoutInfo && layoutDb) {
        if (isDbTheme) {
            layoutInfo.style.display = 'none';
            layoutDb.style.display = 'block';
            layoutDb.style.opacity = '1';
            layoutDb.style.transform = 'none';
        } else {
            layoutDb.style.display = 'none';
            layoutInfo.style.display = 'block';
            layoutInfo.style.opacity = '1';
            layoutInfo.style.transform = 'none';
        }
    }
    
    if (isDbTheme) {
        if (appEl) {
            appEl.classList.add('theme-abs-style');
            appEl.classList.remove('theme-dokkaninfo');
        }
        document.body.classList.add('theme-abs-style');
        document.body.classList.remove('theme-dokkaninfo');

        if (btnInfo) btnInfo.classList.remove('active');
        if (btnDb) btnDb.classList.add('active');
    } else {
        if (appEl) {
            appEl.classList.remove('theme-abs-style');
            appEl.classList.add('theme-dokkaninfo');
        }
        document.body.classList.remove('theme-abs-style');
        document.body.classList.add('theme-dokkaninfo');

        if (btnInfo) btnInfo.classList.add('active');
        if (btnDb) btnDb.classList.remove('active');
    }
};

window.switchCardTheme = function(themeName) {
    const isDbTheme = (themeName === 'abs-style');
    window.toggleCardTheme(isDbTheme);
};

window.restoreThemeOnLoad = function() {
    if (window.IS_PUBLISHED && window.currentCardThemeStyle) {
        window.toggleCardTheme(window.currentCardThemeStyle === 'abs-style');
    }
};

window.syncToAbsLayout = function() {
    try {
        const themeColors = { 
            agl: { main: '#1d4ed8', border: '#3b82f6', header: '#1e40af', boxBg: '#0f172a', text: '#38bdf8', glow: 'rgba(56, 189, 248, 0.6)' }, 
            teq: { main: '#15803d', border: '#22c55e', header: '#166534', boxBg: '#052e16', text: '#4ade80', glow: 'rgba(74, 222, 128, 0.6)' }, 
            int: { main: '#7e22ce', border: '#a855f7', header: '#6b21a8', boxBg: '#2e1065', text: '#c084fc', glow: 'rgba(192, 132, 252, 0.6)' }, 
            str: { main: '#b91c1c', border: '#ef4444', header: '#991b1b', boxBg: '#450a0a', text: '#f87171', glow: 'rgba(248, 113, 113, 0.6)' }, 
            phy: { main: '#ca8a04', border: '#eab308', header: '#a16207', boxBg: '#342103', text: '#fde047', glow: 'rgba(234, 179, 8, 0.65)' }, 
            none: { main: '#3f3f46', border: '#71717a', header: '#27272a', boxBg: '#18181b', text: '#38bdf8', glow: 'rgba(56, 189, 248, 0.6)' } 
        };
        const colors = themeColors[window.currentType || currentType] || themeColors.none;
        const dbLayout = document.getElementById('layout-abs-style');
        if (dbLayout) {
            dbLayout.style.setProperty('--theme-main', colors.main);
            dbLayout.style.setProperty('--theme-border', colors.border);
            dbLayout.style.setProperty('--theme-header', colors.header);
            dbLayout.style.setProperty('--theme-box-bg', colors.boxBg);
            dbLayout.style.setProperty('--theme-text', colors.text);
            dbLayout.style.setProperty('--theme-glow', colors.glow);
        }

        document.querySelectorAll('.lightning-overlay').forEach(lightning => {
            lightning.style.setProperty('--lightning-color', lightningColors[window.currentType || currentType] || 'rgb(0, 150, 255)');
        });
    } catch(e) {}

    try {
        const artHeader = document.getElementById('abs-art-header-text');
        if (artHeader) {
            if (window.absUnitTag === undefined) {
                window.absUnitTag = "DOKKAN FESTIVAL UNIT";
            }
            
            if (window.absUnitTag === "") {
                artHeader.innerText = "";
                artHeader.style.display = 'none';
            } else {
                artHeader.innerText = window.absUnitTag;
                artHeader.style.display = 'flex';
            }
        }
    } catch(e) {}

    try {
        const rawTitle = document.getElementById('descInput')?.value || document.getElementById('char-description')?.innerText || "Character Title";
        const rawName = document.getElementById('nameInput')?.value || document.getElementById('char-name')?.innerText || "Character Name";
        const dbTitle = document.getElementById('abs-char-title');
        const dbName = document.getElementById('abs-char-name');
        
        if (dbTitle) dbTitle.innerText = rawTitle.replace(/[\[\]]/g, '').trim();
        if (dbName) dbName.innerText = rawName;
    } catch(e) {}

    try {
        const leaderText = document.getElementById('leaderInput')?.value || document.getElementById('leader-skill')?.innerText || "";
        const dbLeaderEl = document.getElementById('abs-leader-skill');
        if (dbLeaderEl) {
            const formattedLeader = window.formatCategoryQuotes ? window.formatCategoryQuotes(leaderText).replace(/\n/g, '<br>') : leaderText.replace(/\n/g, '<br>');
            dbLeaderEl.innerHTML = formattedLeader;
        }
    } catch(e) {}

    try {
        const activeRarity = window.currentRarity || currentRarity;
        const activeAwakening = window.currentAwakeningMode || currentAwakeningMode;
        
        const isLR = activeRarity === 'LR';
        const isSEZA = activeAwakening === 'seza';
        
        const lrThumb = document.getElementById('img-lr');
        const turThumb = document.getElementById('img-tur');
        const thumbImg = isLR ? (lrThumb ? lrThumb.src : '') : (turThumb ? turThumb.src : '');
        const dbThumbImg = document.getElementById('abs-thumb-img');
        if (dbThumbImg && thumbImg) dbThumbImg.src = thumbImg;

        const frameImg = document.querySelector('.card-frame');
        const dbFrameImg = document.getElementById('abs-frame-img');
        if (frameImg && dbFrameImg) dbFrameImg.src = frameImg.src;

        let absRarityImgSrc = './images/rarity_none.png';
        if (activeRarity === 'LR') absRarityImgSrc = './images/rarity_lr_abs.png';
        else if (activeRarity === 'TUR') absRarityImgSrc = './images/rarity_TUR_abs.png';
        else if (activeRarity !== 'none') absRarityImgSrc = './images/rarity_ssr_abs.png';

        const dbTopRarity = document.getElementById('abs-top-rarity-icon');
        if (dbTopRarity) dbTopRarity.src = absRarityImgSrc;
        
        const typeIcon = document.querySelector('.typing-icon');
        const dbTopType = document.getElementById('abs-top-type-icon');
        if (typeIcon && dbTopType) dbTopType.src = typeIcon.src;

        const topLightning = document.getElementById('abs-lightning');
        if (topLightning) {
            if (isLR || isSEZA) {
                topLightning.style.display = 'block';
                if (isSEZA && !isLR) {
                    topLightning.style.setProperty('--lightning-color', 'rgb(255, 30, 80)');
                } else {
                    topLightning.style.setProperty('--lightning-color', lightningColors[window.currentType || currentType] || 'rgb(0, 150, 255)');
                }
            } else {
                topLightning.style.display = 'none';
            }
        }

        const spinDial = document.getElementById('abs-spin-dial');
        if (spinDial) spinDial.style.display = isLR ? 'block' : 'none';

        const topComposedIcon = document.getElementById('abs-composed-icon');
        if (topComposedIcon) {
            if (isSEZA) {
                topComposedIcon.classList.add('seza-glow-card');
            } else {
                topComposedIcon.classList.remove('seza-glow-card');
            }
        }

        let absAwakeningSrc = null;
        if (activeAwakening === 'eza') absAwakeningSrc = './images/eza_abs.png';
        if (activeAwakening === 'seza') absAwakeningSrc = './images/superza_abs.png';

        const ezaContainer = document.getElementById('awakening-container');
        const dbEzaImg = document.getElementById('abs-awakening-img');
        const dbTopEzaImg = document.getElementById('abs-top-awakening-img');
        
        if (ezaContainer && ezaContainer.style.display !== 'none' && absAwakeningSrc) {
            if (dbEzaImg) { dbEzaImg.src = absAwakeningSrc; dbEzaImg.style.display = 'block'; }
            if (dbTopEzaImg) { dbTopEzaImg.src = absAwakeningSrc; dbTopEzaImg.style.display = 'block'; }
        } else {
            if (dbEzaImg) dbEzaImg.style.display = 'none';
            if (dbTopEzaImg) dbTopEzaImg.style.display = 'none';
        }

        const dbRarityIconRight = document.getElementById('abs-rarity-icon');
        if (dbRarityIconRight) dbRarityIconRight.src = absRarityImgSrc;
        
        const dbTypeIconRight = document.getElementById('abs-type-icon');
        if (dbTypeIconRight && typeIcon) dbTypeIconRight.src = typeIcon.src;
        
        const myOverlay = document.getElementById('myOverlayImage');
        const dbArtImg = document.getElementById('abs-art-img');
        if (myOverlay && dbArtImg) dbArtImg.src = myOverlay.src;
    } catch(e) {}

    try {
        const passiveNameInput = document.getElementById('input-passive-name-sidebar');
        const passiveDisplay = document.querySelector('.passive-name-display');
        const passiveName = passiveNameInput?.value || passiveDisplay?.innerText || "Passive Skill";
        
        const dbPassiveName = document.getElementById('abs-passive-name');
        if (dbPassiveName) dbPassiveName.innerHTML = "<span>Passive Skill - <i>" + passiveName + "</i></span>";
        
        const dbPassiveCont = document.getElementById('abs-passive-container');
        const mainPassiveCont = document.getElementById('card-passive-container');
        if (dbPassiveCont && mainPassiveCont) {
            dbPassiveCont.innerHTML = mainPassiveCont.innerHTML;
        }
    } catch(e) {}

    try {
        if (window.updateAbsStyleSuperAttacks) {
            window.updateAbsStyleSuperAttacks();
        }
    } catch(e) {}

    try {
        const dbLinkCont = document.getElementById('abs-link-container');
        if (dbLinkCont) {
            dbLinkCont.innerHTML = "";
            document.querySelectorAll('#card-link-container a').forEach(a => {
                const linkName = a.innerText.trim();
                if (linkName) {
                    dbLinkCont.insertAdjacentHTML('beforeend', `
                    <div class="abs-link-badge">
                        <div class="abs-link-lv">
                            <span class="lv-text">Lv</span>
                            <span class="num-text">10</span>
                        </div>
                        <div class="abs-link-name">${linkName}</div>
                    </div>`);
                }
            });
        }
    } catch(e) {}

    try {
        const dbCatCont = document.getElementById('abs-category-container');
        if (dbCatCont) {
            dbCatCont.innerHTML = "";
            document.querySelectorAll('#card-category-container img').forEach(img => {
                dbCatCont.insertAdjacentHTML('beforeend', `<img src="${img.src}">`);
            });
        }
    } catch(e) {}

    try {
        if (window.updateAbsStatDisplay) window.updateAbsStatDisplay();
    } catch(e) {}

    try {
        const baseDate = document.getElementById('dateInput')?.value || "TBD";
        const ezaDate = document.getElementById('ezaDateInput')?.value || "TBD";
        const sezaDate = document.getElementById('sezaDateInput')?.value || "TBD";
        
        const activeType = window.currentType || currentType;
        const activeClass = window.currentClass || currentClass;
        const activeRarity = window.currentRarity || currentRarity;
        const activeAwakening = window.currentAwakeningMode || currentAwakeningMode;
        
        const baseTypeSrc = typeImageUrls[activeType] || "./images/type_none.png";
        const classTypeSrc = typeImageMap[activeClass][activeType] || "./images/type_none.png";
        const frameSrc = document.getElementById('abs-frame-img')?.src || "./images/frame_none.png";

        const buildDbCardIcon = (thumbSrc, raritySrc, usePlainType = false, ezaIconSrc = null, isSEZA = false) => {
            const tSrc = usePlainType ? baseTypeSrc : classTypeSrc;
            const isLR = raritySrc.includes('lr_abs') || raritySrc.includes('LR');
            const showLightning = isLR || isSEZA;
            const sezaLightningStyle = isSEZA && !isLR ? 'style="--lightning-color: rgb(255, 30, 80);"' : '';
            
            const lrSpinHtml = isLR ? `<img src="./images/lr_spin_dial.png" class="lr-spin-dial">` : '';
            
            const lrLightningHtml = showLightning ? `
                <video class="lightning-overlay" autoplay muted loop playsinline ${sezaLightningStyle}>
                    <source src="./images/lightningfx.webm" type="video/webm">
                </video>` : '';
                
            const ezaHtml = ezaIconSrc ? `<img src="${ezaIconSrc}" class="eza-icon">` : '';

            const sezaGlowClass = isSEZA ? 'seza-glow-card' : '';

            return `
                <div class="abs-composed-icon ${sezaGlowClass}">
                    <img class="card-frame" src="${frameSrc}">
                    ${lrSpinHtml}
                    ${lrLightningHtml}
                    <div class="thumb-box">
                        <img class="thumb-img" src="${thumbSrc}">
                    </div>
                    <img class="rarity-icon" src="${raritySrc}">
                    <img class="type-icon" src="${tSrc}">
                    ${ezaHtml}
                </div>
            `;
        };

        const awakenCont = document.getElementById('abs-awakenings-container');
        if (awakenCont) {
            let awHTML = '';
            
            const buildStepDivider = (imgSrc, fallbackText) => `
                <div class="abs-awaken-divider">
                    <img src="${imgSrc}" onerror="this.outerHTML='<span class=\\'abs-awaken-divider-text\\'>${fallbackText}</span>'">
                </div>
            `;

            const ssrSrc = document.getElementById('img-ssr')?.src || "./images/SSR_Icon.png";
            awHTML += `
                <div class="abs-awaken-row">
                    ${buildDbCardIcon(ssrSrc, './images/rarity_ssr_abs.png', true)}
                    <div class="abs-awaken-date" style="font-size: 15px; font-weight: bold; text-align: center; flex: 1;">Release Date:<br><span style="font-weight: normal; font-size: 13.5px;">${baseDate}</span></div>
                </div>
            `;
            
            if (activeRarity === 'TUR' || activeRarity === 'LR') {
                const turSrc = document.getElementById('img-tur')?.src || "./images/TUR_Icon.png";
                awHTML += `
                    ${buildStepDivider('./images/z-awaken.png', 'Z-AWAKEN')}
                    <div class="abs-awaken-row">
                        ${buildDbCardIcon(turSrc, './images/rarity_TUR_abs.png', false)}
                        <div class="abs-awaken-date" style="font-size: 15px; font-weight: bold; text-align: center; flex: 1;">Release Date:<br><span style="font-weight: normal; font-size: 13.5px;">${baseDate}</span></div>
                    </div>
                `;
            }

            if (activeRarity === 'LR') {
                const lrSrc = document.getElementById('img-lr')?.src || "./images/LR_Icon.png";
                awHTML += `
                    ${buildStepDivider('./images/dokkan-awaken.png', 'DOKKAN AWAKEN')}
                    <div class="abs-awaken-row">
                        ${buildDbCardIcon(lrSrc, './images/rarity_lr_abs.png', false)}
                        <div class="abs-awaken-date" style="font-size: 15px; font-weight: bold; text-align: center; flex: 1;">Release Date:<br><span style="font-weight: normal; font-size: 13.5px;">${baseDate}</span></div>
                    </div>
                `;
            }

            if (activeAwakening === 'eza' || activeAwakening === 'seza') {
                const maxThumb = activeRarity === 'LR' ? (document.getElementById('img-lr')?.src || "./images/LR_Icon.png") : (document.getElementById('img-tur')?.src || "./images/TUR_Icon.png");
                const maxRar = activeRarity === 'LR' ? './images/rarity_lr_abs.png' : './images/rarity_TUR_abs.png';
                awHTML += `
                    ${buildStepDivider('./images/eza_abs.png', 'EXTREME Z-AWAKEN')}
                    <div class="abs-awaken-row">
                        ${buildDbCardIcon(maxThumb, maxRar, false, './images/eza_abs.png')}
                        <div class="abs-awaken-date" style="font-size: 15px; font-weight: bold; text-align: center; flex: 1;">EZA Release Date:<br><span style="color: #facc15; font-size: 13.5px;">${ezaDate}</span></div>
                    </div>
                `;
            }

            if (activeAwakening === 'seza') {
                const maxThumb = activeRarity === 'LR' ? (document.getElementById('img-lr')?.src || "./images/LR_Icon.png") : (document.getElementById('img-tur')?.src || "./images/TUR_Icon.png");
                const maxRar = activeRarity === 'LR' ? './images/rarity_lr_abs.png' : './images/rarity_TUR_abs.png';
                awHTML += `
                    ${buildStepDivider('./images/superza_abs.png', 'SUPER EZA')}
                    <div class="abs-awaken-row">
                        ${buildDbCardIcon(maxThumb, maxRar, false, './images/superza_abs.png', true)}
                        <div class="abs-awaken-date" style="font-size: 15px; font-weight: bold; text-align: center; flex: 1;">SEZA Release Date:<br><span style="color: #facc15; font-size: 13.5px;">${sezaDate}</span></div>
                    </div>
                `;
            }

            awakenCont.innerHTML = awHTML;
        }

        const transBox = document.getElementById('abs-transformations-box');
const transCont = document.getElementById('abs-transformations-container');
const forms = document.querySelectorAll('#forms-container .dokkan-card');

if (transBox && transCont) {
    if (forms.length > 1) {
        transBox.classList.remove('d-none');
        let trHTML = '';
        forms.forEach((f, idx) => {
            if (idx === 0) return; // Skip base form
            
            const fImg = f.getAttribute('data-thumb-src') || f.querySelector('.form-image')?.src || "./images/default.png";
            const fName = f.querySelector('.form-name-display')?.innerText || "Form";
            const fLinkAnchor = f.querySelector('.form-link');
            let fLink = fLinkAnchor ? fLinkAnchor.getAttribute('href') : "javascript:void(0)";
            if (!fLink || fLink === "#") fLink = "javascript:void(0)";

            if (trHTML !== '') {
                trHTML += `<div class="abs-transform-divider"></div>`;
            }

            trHTML += `
                <div class="abs-transform-row">
                    <a href="${fLink}" class="abs-transform-link" target="_blank" style="text-decoration:none; color:inherit; display:flex; align-items:center; width:100%;">
                        ${buildDbCardIcon(fImg, activeRarity === 'LR' ? './images/rarity_lr_abs.png' : './images/rarity_TUR_abs.png', false)}
                        <div class="abs-transform-name" style="flex: 1; text-align: center; font-size: 15px; font-weight: bold;">${fName}</div>
                    </a>
                </div>
            `;
        });
        transCont.innerHTML = trHTML;
    } else {
        transBox.classList.add('d-none');
        transCont.innerHTML = '';
    }
}
    } catch(e) { console.error("Awakenings/Transformations Sync Error", e); }
};

function getAbsStatIconPath(iconPath) {
    if (!iconPath) return './images/st_0001.png';
    if (iconPath.includes('pot_skill_02_on.png')) {
        return './images/st_critical_up.png';
    }
    return iconPath;
}

function getStatsFromBlock(block) {
    const stats = [];
    const statContainer = block.querySelector('.stats-container');
    if (!statContainer) return stats;

    const statRows = statContainer.querySelectorAll('.sa-stat-row, .col, div');
    const elementsToScan = statRows.length > 0 ? statRows : statContainer.children;
    const effectsText = block.querySelector('.sa-display-effects-list')?.innerText || '';

    const isSelfExcluded = /self excluded|excluding self|self-excluded/i.test(effectsText);
    const clauses = effectsText.split(/,|\;|\band\s+(?=causes|lowers|greatly|massively|seals|stuns|disables|raises)/i);

    const jointAndTurnMatch = effectsText.match(/(ATK|DEF)\b[^\;\,\.]*?\band\b[^\;\,\.]*?\bfor\s+(\d+)\s+turns?/i);
    let jointTurns = null;
    if (jointAndTurnMatch) {
        const num = parseInt(jointAndTurnMatch[2], 10);
        jointTurns = `${num} turn${num > 1 ? 's' : ''}`;
    }

    const assignedTargets = new Set();

    Array.from(elementsToScan).forEach(row => {
        const img = row.tagName === 'IMG' ? row : row.querySelector('img');
        if (!img) return;

        const iconSrc = img.getAttribute('src');
        if (!iconSrc || iconSrc.includes('sp_skill_icon')) return;

        let value = '';
        const textEl = row.querySelector('.display-text, span') || row;
        const rawText = textEl ? textEl.textContent : '';
        const valMatch = rawText.match(/(\d+)\s*%/);
        if (valMatch) {
            value = valMatch[1];
        }

        let target = row.dataset.target;
        if (!target) {
            const isEnemyIcon = 
                iconSrc.includes('st_0011') || 
                iconSrc.includes('st_0012') || 
                iconSrc.includes('st_1009') || 
                iconSrc.includes('st_0100') || 
                iconSrc.includes('st_0102');   

            if (isEnemyIcon || /enemy|debuff|lower|seal|stun|break|disable/i.test(rawText)) {
                target = 'enemy';
            } else if (/ally|allies/i.test(rawText)) {
                target = 'ally';
            } else if (isSelfExcluded && /ally|allies|team|party/i.test(effectsText)) {
                target = 'ally';
            } else {
                let isAtk = iconSrc.includes('st_0001');
                let isDef = iconSrc.includes('st_0002');
                let isCrit = iconSrc.includes('st_critical_up') || iconSrc.includes('pot_skill');
                let isEvade = iconSrc.includes('st_evasion');
                
                let statRegex = isAtk ? /atk/i : (isDef ? /def/i : (isCrit ? /critical|crit/i : (isEvade ? /evade|evasion|dodge/i : /raise|boost/i)));
                
                let hasSelf = clauses.some(c => statRegex.test(c) && !/ally|allies|enemy|lower|debuff/i.test(c));
                let hasAlly = clauses.some(c => statRegex.test(c) && /ally|allies|team|party/i.test(c));

                let exactClause = clauses.find(c => statRegex.test(c) && value && c.includes(value + '%'));
                if (!exactClause && value) {
                    if (value === '100') exactClause = clauses.find(c => statRegex.test(c) && /massively/i.test(c));
                    else if (value === '50') exactClause = clauses.find(c => statRegex.test(c) && /greatly/i.test(c));
                }

                let isAllyExact = exactClause && /ally|allies|team|party/i.test(exactClause);

                if (isAllyExact || isSelfExcluded) {
                    if (hasSelf && assignedTargets.has(`${iconSrc}-ally`) && !isSelfExcluded) target = 'self';
                    else target = 'ally';
                } else if (exactClause && !isAllyExact) {
                    if (hasAlly && assignedTargets.has(`${iconSrc}-self`)) target = 'ally';
                    else target = 'self';
                } else if (hasAlly && !hasSelf) {
                    target = 'ally';
                } else if (hasAlly && hasSelf) {
                    if (!assignedTargets.has(`${iconSrc}-self`) && !isSelfExcluded) target = 'self';
                    else target = 'ally';
                } else {
                    target = 'self';
                }
            }
        }
        
        assignedTargets.add(`${iconSrc}-${target}`);

        let turns = row.dataset.turns;
        if (!turns) {
            let isAtk = iconSrc.includes('st_0001') || /atk/i.test(rawText);
            let isDef = iconSrc.includes('st_0002') || /def/i.test(rawText);
            let isCrit = iconSrc.includes('st_critical_up') || iconSrc.includes('pot_skill') || /critical|crit/i.test(rawText);
            let isEvade = iconSrc.includes('st_evasion') || /evade|evasion|dodge/i.test(rawText);
            
            let isStunOrSeal = iconSrc.includes('st_0100') || iconSrc.includes('st_0102') || /stun|seal/i.test(rawText);
            let isAttackBreak = iconSrc.includes('st_1009') || /disable|break/i.test(rawText);
            let isLowerStat = iconSrc.includes('st_0011') || iconSrc.includes('st_0012') || /lower/i.test(rawText);
            let isRaiseStat = iconSrc.includes('st_0001') || iconSrc.includes('st_0002') || /raise|boost/i.test(rawText);

            if (isAttackBreak) {
                turns = '1 turn';
            } else if (isStunOrSeal) {
                const specificClause = clauses.find(c => /stun|seal/i.test(c)) || effectsText;
                const stunTurnMatch = specificClause.match(/(?:stun|seal)[^\.\;\,]*?for\s+(\d+)\s+turn/i);
                if (stunTurnMatch) {
                    const num = parseInt(stunTurnMatch[1], 10);
                    turns = `${num} turn${num > 1 ? 's' : ''}`;
                } else {
                    turns = '2 turns';
                }
            } else {
                const targetClauses = clauses.filter(c => {
                    const isAllyClause = /ally|allies|team|party/i.test(c);
                    if (isLowerStat && !/lower|down/i.test(c)) return false;
                    if (isRaiseStat && !/raise|boost/i.test(c)) return false;
                    if (isCrit && !/critical|crit/i.test(c)) return false;
                    if (isEvade && !/evade|evasion|dodge/i.test(c)) return false;
                    return target === 'ally' ? isAllyClause : !isAllyClause;
                });

                let specificClause = null;
                if (isAtk && !isDef) specificClause = targetClauses.find(c => /atk/i.test(c) && !/def/i.test(c)) || targetClauses.find(c => /atk/i.test(c));
                else if (isDef && !isAtk) specificClause = targetClauses.find(c => /def/i.test(c) && !/atk/i.test(c)) || targetClauses.find(c => /def/i.test(c));
                else if (isCrit) specificClause = targetClauses.find(c => /critical|crit/i.test(c));
                else if (isEvade) specificClause = targetClauses.find(c => /evade|evasion|dodge/i.test(c));
                
                if (!specificClause) specificClause = targetClauses[0] || effectsText;

                const clauseTurnMatch = specificClause.match(/for\s+(\d+)\s+turn/i);

                if (clauseTurnMatch) {
                    const num = parseInt(clauseTurnMatch[1], 10);
                    turns = `${num} turn${num > 1 ? 's' : ''}`;
                } else if (jointTurns && (isAtk || isDef) && !/ally|allies/i.test(specificClause) && !isLowerStat) {
                    turns = jointTurns;
                } else if (isLowerStat) {
                    turns = '3 turns';
                } else if (/raise|raises|boost/i.test(specificClause)) {
                    turns = '99 turns';
                } else {
                    turns = '1 turn';
                }
            }
        }

        stats.push({
            icon: iconSrc,
            value: value,
            turns: turns,
            target: target
        });
    });

    const uniqueStats = [];
    const seen = new Set();
    stats.forEach(s => {
        const key = `${s.icon}-${s.value}-${s.target}-${s.turns}`;
        if (!seen.has(key)) {
            seen.add(key);
            uniqueStats.push(s);
        }
    });

    return uniqueStats;
}

function renderAbsSpecialEffects(stats) {
    if (!stats || stats.length === 0) return '';

    const selfStats = stats.filter(s => s.target === 'self');
    const allyStats = stats.filter(s => s.target === 'ally' || s.target === 'allies');
    const enemyStats = stats.filter(s => s.target === 'enemy');

    const renderGroup = (label, typeClass, statList) => {
        if (statList.length === 0) return '';
        
        const badgesHtml = statList.map(stat => {
            const iconSrc = getAbsStatIconPath(stat.icon);
            const valText = stat.value ? `${stat.value}%` : '';
            const durationText = stat.turns || '1 turn';

            return `
                <div class="abs-effect-badge">
                    <div class="abs-badge-top">
                        <img src="${iconSrc}" alt="stat">
                        ${valText ? `<span>${valText}</span>` : ''}
                    </div>
                    <div class="abs-badge-bottom">${durationText}</div>
                </div>
            `;
        }).join('');

        return `
            <div class="abs-effect-group ${typeClass}">
                <span class="abs-group-label ${typeClass}">${label}</span>
                ${badgesHtml}
            </div>
        `;
    };

    return `
        <div class="abs-special-effects-section">
            <div class="abs-special-effects-title">SPECIAL EFFECTS</div>
            <div class="abs-special-effects-groups">
                ${renderGroup('SELF', 'self', selfStats)}
                ${renderGroup('ALLIES', 'allies', allyStats)}
                ${renderGroup('ENEMY', 'enemy', enemyStats)}
            </div>
        </div>
    `;
}

window.renderAbsDamageMultiplier = function(text, typeLabel = '', isActive = false, kiText = '') {
    if (!text) return '';
    const low = text.toLowerCase();
    const lowLabel = typeLabel.toLowerCase().trim();

    if (/ex\b|ex\s/i.test(lowLabel) || lowLabel.startsWith('ex')) {
        return '';
    }

    const baseMultipliers = {
        'mega-colossal': { 10: 440, 15: 490, 20: 570, 25: 620 },
        'colossal':      { 10: 345, 15: 370, 20: 425, 25: 450 },
        'ultimate':      { 10: 550, 15: 600, 20: 650, 25: 700 },
        'immense':       { 10: 505, 15: 570, 20: 705, 25: 755 },
        'supreme':       { 10: 430, 15: 530, 20: 630, 25: 680 },
        'destructive':   { 10: 290, 15: 360, 20: 390, 25: 420 },
        'extreme':       { 10: 355, 15: 450, 20: 480, 25: 510 },
        'mass':          { 10: 355, 15: 450, 20: 480, 25: 510 },
        'huge':          { 10: 290, 15: 360, 20: 390, 25: 420 },
        'damage':        { 10: 260, 15: 330, 20: 360, 25: 390 },
        'low':           { 10: 220, 15: 290, 20: 320, 25: 350 }
    };

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

    if (!matchedTier) return '';

    const activeRarity = window.currentRarity || currentRarity;
    const activeAwakening = window.currentAwakeningMode || currentAwakeningMode;
    let maxLv = 10;
    const isLR = activeRarity === 'LR';
    const isEZA = activeAwakening === 'eza' || activeAwakening === 'seza';

    if (isLR) maxLv = isEZA ? 25 : 20;
    else maxLv = isEZA ? 15 : 10;

    const maxVal = (baseMultipliers[matchedTier][maxLv] || baseMultipliers[matchedTier][10] || 430) + '%';
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
};

// SYNCHRONOUS SUPER ATTACK & ACTIVE SKILLS RENDERER (NO ANIMATION FRAME DELAY)
window.updateAbsStyleSuperAttacks = function() {
    const container = document.getElementById('abs-sa-container');
    if (!container) return;

    const blocks = document.querySelectorAll('.sa-block');
    if (blocks.length === 0) {
        container.innerHTML = '';
        window.updateAbsStyleActiveSkills();
        return;
    }

    let htmlBuffer = '';

    blocks.forEach((block) => {
        let typeLabel = block.querySelector('.sa-type-label')?.textContent || 'Super Attack';
        const saName = block.querySelector('.sa-display-name')?.textContent || 'Super Attack';
        const saIcon = block.querySelector('.sa-display-icon')?.getAttribute('src') || './images/sp_skill_icon_01.png';

        const effectCols = block.querySelectorAll('.sa-display-effects-list .col');
        let lines = [];
        effectCols.forEach(c => {
            const txt = c.innerText.trim();
            if (txt && !lines.includes(txt)) lines.push(txt);
        });
        if (lines.length === 0) {
            const raw = block.querySelector('.sa-display-effects-list')?.innerText || '';
            lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
        }
        let effectsFormatted = lines.join('<br>');

        const actRow = block.querySelector('.activation-row');
        const actText = block.querySelector('.activation-text')?.innerText || '';
        const showAct = actRow && !actRow.classList.contains('d-none') && actText.trim();
        let cleanActText = actText.replace(/^Activation Conditions?\s*/i, '').trim();

        let kiText = block.getAttribute('data-ki') || '';
        
        if (!kiText) {
            const combinedText = (cleanActText + ' ' + effectsFormatted).toLowerCase();
            
            const explicitKiMatch = combinedText.match(/(?:performed\s+with|when\s+ki\s+is|at|with)\s+(\d+)\s*ki/i) ||
                                   combinedText.match(/(\d+)\s*ki\s*(?:or\s+more|or\s+higher|required)?/i);

            if (explicitKiMatch) {
                const kiNum = parseInt(explicitKiMatch[1], 10);
                if (kiNum >= 1 && kiNum <= 24) {
                    kiText = `${kiNum} Ki`;
                }
            }

            if (!kiText) {
                const lowLabel = typeLabel.toLowerCase().trim();
                if (lowLabel.includes('ultra')) {
                    kiText = '18 Ki';
                } else if (lowLabel.includes('super attack')) {
                    kiText = '12 Ki';
                }
            }
        }

        let formattedTypeLabel = typeLabel;
        if (/^ex\b/i.test(typeLabel)) {
            formattedTypeLabel = typeLabel.replace(/^ex\b/i, '<span class="abs-ex-prefix">EX</span>');
        }

        const stats = getStatsFromBlock(block);
        const specialEffectsHtml = renderAbsSpecialEffects(stats);
        const damageMultiplierHtml = window.renderAbsDamageMultiplier(effectsFormatted, typeLabel, false, kiText);

        const activeRarity = window.currentRarity || currentRarity;
        const isLR = activeRarity === 'LR';
        let bonusBoxHtml = '';
        if (isLR) {
            bonusBoxHtml = `
                <div class="abs-sa-bonus-box">
                    <div class="abs-bonus-left">
                        <span class="abs-bonus-title">At SA LVL 20: Super Attack +30%</span>
                    </div>
                    <div class="abs-multiplier-pills">
                        <div class="abs-multiplier-pill">
                            <span class="pill-val">+30%</span>
                            <span class="pill-at">at</span>
                            <span class="pill-lv">Lv. 20</span>
                        </div>
                    </div>
                </div>
            `;
        }

        htmlBuffer += `
            <div class="abs-box mb-3">
                <div class="abs-header">
                    <div class="abs-sa-header-title">
                        <img src="${saIcon}" class="abs-sa-icon-left" alt="SA Icon">
                        <span class="abs-sa-title-text">${formattedTypeLabel} | <em class="abs-sa-name-glow">${saName}</em></span>
                    </div>
                </div>
                <div class="abs-content text-start">
                    ${showAct ? `
                        <div class="abs-skill-label text-warning mb-1">Condition:</div>
                        <div class="mb-3">${cleanActText}</div>
                    ` : ''}
                    <div class="abs-skill-label text-warning mb-1">Effect:</div>
                    <div>${effectsFormatted}</div>
                    ${specialEffectsHtml}
                    ${damageMultiplierHtml}
                    ${bonusBoxHtml}
                </div>
            </div>
        `;
    });

    container.innerHTML = htmlBuffer;
    window.updateAbsStyleActiveSkills();
};

window.updateAbsStyleActiveSkills = function() {
    const container = document.getElementById('abs-active-container') || document.getElementById('abs-sa-container');
    if (!container) return;

    const activeBlocks = document.querySelectorAll('.active-block');
    if (activeBlocks.length === 0) {
        const activeBox = document.getElementById('abs-active-container');
        if (activeBox) activeBox.innerHTML = '';
        return;
    }

    let htmlBuffer ='';

    activeBlocks.forEach((block) => {
        const typeLabel = block.querySelector('.active-type-label')?.textContent || 'Active Skill';
        const name = block.querySelector('.active-display-name')?.textContent || 'Active Skill';
        let effect = block.querySelector('.active-display-effect')?.innerText || '';
        if (window.formatCategoryQuotes) {
            effect = window.formatCategoryQuotes(effect);
        }

        const activeIconAttr = block.querySelector('.active-display-icon')?.getAttribute('src') || '';

        const hasNoIcon = !activeIconAttr || activeIconAttr === 'none' || activeIconAttr.includes('none');
        const activeIconHtml = hasNoIcon ? '' : `<img src="${activeIconAttr}" class="abs-sa-icon-left" alt="Active Icon">`;

        const condRow = block.querySelector('.active-condition-row');
        const condText = block.querySelector('.active-display-condition')?.innerText || '';
        const showCond = condRow && !condRow.classList.contains('d-none') && condText.trim().length > 0;
        let cleanActText = condText.trim();
        if (window.formatCategoryQuotes) {
            cleanActText = window.formatCategoryQuotes(cleanActText);
        }

        const damageMultiplierHtml = window.renderAbsDamageMultiplier(effect, typeLabel, true, '');

        htmlBuffer += `
            <div class="abs-box mb-3">
                <div class="abs-header">
                    <div class="abs-sa-header-title">
                        ${activeIconHtml}
                        <span class="abs-sa-title-text">${typeLabel} | <em class="abs-sa-name-glow">${name}</em></span>
                    </div>
                </div>
                <div class="abs-content text-start">
                    ${showCond ? `
                        <div class="abs-skill-label text-warning mb-1">Condition:</div>
                        <div class="mb-3">${cleanActText}</div>
                    ` : ''}
                    <div class="abs-skill-label text-warning mb-1">Effect:</div>
                    <div>${effect}</div>
                    ${damageMultiplierHtml}
                </div>
            </div>
        `;
    });

    const activeContainer = document.getElementById('abs-active-container');
    if (activeContainer) {
        activeContainer.innerHTML = htmlBuffer;
    } else {
        container.insertAdjacentHTML('beforeend', htmlBuffer);
    }
};

document.addEventListener('change', (e) => {
    if (e.target && e.target.id === 'theme-toggle-checkbox') {
        setTimeout(() => { window.updateAbsStyleSuperAttacks(); }, 50);
    }
});

window.addEventListener('pageshow', () => {
    setTimeout(() => { window.updateAbsStyleSuperAttacks(); }, 100);
});

document.addEventListener('visibilitychange', () => {
    if (!document.hidden) window.updateAbsStyleSuperAttacks();
});

window.addEventListener('scroll', () => {
    const topBar = document.querySelector('.scouter-hud-bar');
    if (topBar) {
        if (window.scrollY > 20) {
            topBar.classList.add('scrolled');
        } else {
            topBar.classList.remove('scrolled');
        }
    }
});