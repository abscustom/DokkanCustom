

// =====================================================================
// --- TEXT PARSER (DIRECT DOM UPDATER & KIT EXTRACTOR) ---
// =====================================================================

window.analyzePastedText = async function() {
    const inputDiv = document.getElementById('raw-paste-input');

    if (!inputDiv || !inputDiv.innerHTML.trim()) { 
        alert("Please paste the kit text first!"); 
        return; 
    }

    const btn = inputDiv.nextElementSibling;
    const originalBtnText = btn ? btn.innerHTML : "Extract Data";
    if (btn) btn.innerHTML = "Structuring Kit...";

    try {
        const fullText = inputDiv.innerText;
        const rawHtml = inputDiv.innerHTML;

        window.extractedCutins = [];
        window.scrapedAssets = {};
        selectedForm = null;
        document.querySelectorAll("#forms-container .dokkan-card").forEach(f => f.remove());
        if (document.getElementById('formList')) document.getElementById('formList').innerHTML = ""; 

        const urlMatch = fullText.match(/dokkaninfo\.com\/cards\/(\d{7})/);
        const cardUrl = urlMatch ? `https://dokkaninfo.com/cards/${urlMatch[1]}` : "";
        const pageHtml = cardUrl ? await fetchPageHtmlViaMirror(cardUrl) : "";

        await processAssets(fullText, pageHtml || rawHtml, { showSAIconPopup: false });
        window._lastHtmlSource = pageHtml || rawHtml;

        inputDiv.querySelectorAll('img').forEach(img => {
            let src = (img.src || '').toLowerCase();
            let alt = (img.alt || '').trim();
            let lowerAlt = alt.toLowerCase();
            let marker = alt ? ` ${alt} ` : ' ';
            if      (src.includes('icon_01') || lowerAlt === 'once')                               marker = '@@ONCE@@';
            else if (src.includes('icon_02') || lowerAlt === 'forever' || lowerAlt === 'inf')      marker = '@@INF@@';
            else if (src.includes('arrow01') || lowerAlt === 'up')                                 marker = '@@UP@@';
            else if (src.includes('arrow02') || lowerAlt === 'down' || lowerAlt.includes('red'))   marker = '@@DOWN@@';
            else if (src.includes('arrow03') || lowerAlt.includes('yellow'))                       marker = '@@YDOWN@@';
            img.parentNode.insertBefore(document.createTextNode(marker), img);
            img.remove();
        });

        const rawText = inputDiv.innerText;
        const boldElements = Array.from(inputDiv.querySelectorAll('b, strong, [style*="700"], [style*="bold"]'));
        const boldTexts = boldElements.map(el => el.innerText.trim().toLowerCase()).filter(t => t.length > 1);
        const rawLines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        let linesData = rawLines.map(line => {
            let isBold = boldTexts.some(bt => bt === line.toLowerCase()) ||
                         (line.length > 4 && line === line.toUpperCase() && !line.includes('%'));
            return { text: line, bold: isBold };
        });

        let parsed = {
            title: "", name: "", release: "", leader: [],
            sa: [], passiveName: "", passiveSections: [],
            actives: [], linksRaw: [], categoriesRaw: [],
            stats: { hp: "", atk: "", def: "" }
        };

        let currentState = "NONE";
        let currentSA = null;
        let saTarget = 'name';
        let currentPassiveSec = null;
        let currentActive = null;
        let activeTarget = 'name';

        const cleanText = (t, context = 'general') => {
            let res = t.replace(/\[\d+\]/g, '').replace(/\s{2,}/g, ' ').trim();
            if (context === 'passive') {
                const protectedBlocks = [];
                res = res.replace(/\([^)]*\)/g, (match) => { protectedBlocks.push(match); return `__PROTECTED_${protectedBlocks.length - 1}__`; });
                res = res.replace(/@@UP@@/gi, ':up:').replace(/@@DOWN@@/gi, ':down:').replace(/@@YDOWN@@/gi, ':ydown:').replace(/@@ONCE@@|\bonce\b/gi, ':once:').replace(/@@INF@@|\bforever\b|\binf\b/gi, ':inf:');
                res = res.replace(/(\d+%)(?!\s*:(up|down|ydown):)/gi, (match, pct, offset) => {
                    const textBefore = res.substring(Math.max(0, offset - 15), offset).toLowerCase();
                    const textAfter  = res.substring(offset + match.length, offset + match.length + 15).toLowerCase();
                    const isHP    = textBefore.includes("hp");
                    const isLimit = textAfter.includes("or more") || textAfter.includes("or less");
                    if (isHP || isLimit) return pct;
                    return pct + ':up:';
                });
                res = res.replace(/__PROTECTED_(\d+)__/g, (match, index) => protectedBlocks[index]);
                res = res.replace(/\s*(:(up|down|ydown|once|inf):)/g, '$1');
                res = res.replace(/(:(up|down|ydown|once|inf):)\s+(?=(:(up|down|ydown|once|inf):))/g, '$1');
                res = res.replace(/(:(up|down|ydown):)([a-zA-Z])/g, '$1 $3');
            } else {
                res = res.replace(/@@ONCE@@|@@INF@@|@@UP@@|@@DOWN@@|@@YDOWN@@/gi, '');
            }
            return res.trim();
        };

        const isGarbageLine = (l) => {
            if (!l || l.length < 2) return true;
            const low = l.toLowerCase().trim();

            if (/^step:\s*\d+/i.test(low) || low.startsWith('step:')) return true;
            if (/^pre-eza/i.test(low) || /^post-eza/i.test(low)) return true;
            if (/^extreme z-awakening/i.test(low) || /^extreme z-awakened/i.test(low)) return true;
            if (/^super extreme z-awakening/i.test(low) || /^super extreme z-awakened/i.test(low)) return true;
            if (/^super eza/i.test(low) || /^seza$/i.test(low) || low === 'eza') return true;
            if (/^links:\s*\d+/i.test(low) || /^categories:\s*\d+/i.test(low)) return true;
            if (/^max lv:/i.test(low) || /^cost:/i.test(low) || /^sa lv:/i.test(low) || /^rarity:/i.test(low)) return true;

            const garbagePhrases = [
                'dokkan info logo', 'dokkaninfo logo', 'dokkaninfo', 'baba\'s shop',
                '200%+ leaders', 'featured banners', 'card assets', 'extreme z battle',
                'extra info', 'sa_raw_attribute', 'summonable',
                'privacy policy', 'cookie policy', 'terms of use', 'venatus', 'venatus media',
                'all rights reserved', 'copyright', 'target character url', 'quick kit extractor',
                'upload card', 'update box', 'autosave', 'news', 'banners', 'cards', 'events',
                'items', 'missions', 'tools', 'users', 'user', 'other', 'login', 'register',
                'search', 'account', 'settings', 'similar links', 'show more', 'super attack+',
                'card art', 'dokkan card', 'editor', 'dokkan db', 'info', 'db'
            ];
            if (garbagePhrases.includes(low)) return true;
            return garbagePhrases.some(g => low === g || low.startsWith(g + ' ') || low.endsWith(' ' + g));
        };

        // 1. DYNAMIC CLASS (SUPER/EXTREME) AND TYPE DETECTION WITH LIVE UPDATE
        let detectedClass = null;
        let detectedType = null;

        const combinedHtml = (pageHtml + "\n" + rawHtml + "\n" + fullText).toLowerCase();

        if (/\bextreme\s+(agl|teq|int|str|phy)\b/i.test(combinedHtml) || 
            combinedHtml.includes('extreme_type_') || 
            combinedHtml.includes('type_extreme') || 
            combinedHtml.includes('extreme_class') ||
            /\bclass:\s*extreme\b/i.test(combinedHtml)) {
            detectedClass = 'extreme';
        } else if (/\bsuper\s+(agl|teq|int|str|phy)\b/i.test(combinedHtml) || 
                   combinedHtml.includes('super_type_') || 
                   combinedHtml.includes('type_super') || 
                   combinedHtml.includes('super_class') ||
                   /\bclass:\s*super\b/i.test(combinedHtml)) {
            detectedClass = 'super';
        }

        const classTypeMatch = fullText.match(/\b(super|extreme)\s+(agl|teq|int|str|phy)\b/i) ||
                               fullText.match(/\b(super|extreme)\s+class\b/i) ||
                               fullText.match(/\bclass:\s*(super|extreme)\b/i);
        if (classTypeMatch) {
            detectedClass = classTypeMatch[1].toLowerCase();
            if (classTypeMatch[2]) detectedType = classTypeMatch[2].toLowerCase();
        }

        if (!detectedClass || !detectedType) {
            const typeKeywords = ['agl', 'teq', 'int', 'str', 'phy'];
            for (let k = 0; k < Math.min(linesData.length, 25); k++) {
                let l = linesData[k].text.toLowerCase();
                if (!detectedClass) {
                    if (/\bsuper\s+(agl|teq|int|str|phy)\b/i.test(l) || /\bsuper\s+class\b/i.test(l)) detectedClass = 'super';
                    else if (/\bextreme\s+(agl|teq|int|str|phy)\b/i.test(l) || /\bextreme\s+class\b/i.test(l)) detectedClass = 'extreme';
                }
                if (!detectedType) {
                    typeKeywords.forEach(t => { 
                        if (new RegExp(`\\b${t}\\b`).test(l)) detectedType = t; 
                    });
                }
            }
        }

        if (detectedClass) { currentClass = detectedClass; }
        if (detectedType)  { currentType = detectedType; }

        window.applyCardTheme(currentType);
        window.updateIconImages();

        // 2. AWAKENING MODE DETECTION (BASE vs EZA vs SUPER EZA)
        const lowFull = fullText.toLowerCase();
        let hasSEZA = false;
        let hasEZA = false;

        if (lowFull.includes('seza release date') || 
            lowFull.includes('super extreme z-awakening') || 
            lowFull.includes('super extreme z-awakened') || 
            lowFull.includes('super eza') || 
            /\bseza\b/.test(lowFull) ||
            /step:\s*(8|9|10|11|12|13|14|15)/.test(lowFull)) {
            hasSEZA = true;
        } else if (lowFull.includes('eza release date') || 
                   lowFull.includes('extreme z-awakening') || 
                   lowFull.includes('extreme z-awakened') || 
                   /\beza\b/.test(lowFull) || 
                   lowFull.includes('step: 7') || 
                   lowFull.includes('(extreme)')) {
            hasEZA = true;
        }

        if (hasSEZA) {
            window.applyAwakening('seza');
        } else if (hasEZA) {
            window.applyAwakening('eza');
        } else {
            window.applyAwakening('none');
        }

        // 3. DIRECT BRACKET TITLE & NAME MATCH
        const bracketMatch = (fullText + "\n" + rawHtml + "\n" + pageHtml).match(/\[([^\]\n]{2,120})\]\s*([^\n\r<]{2,100})/);

        if (bracketMatch) {
            parsed.title = bracketMatch[1].trim();
            parsed.name = bracketMatch[2].replace(/https?:\/\/[^\s]+/g, '').replace(/<[^>]*>/g, '').trim();
        } else {
            let releaseIdx = -1;
            for (let idx = 0; idx < linesData.length; idx++) {
                let l = linesData[idx].text.toLowerCase().trim();
                if (l.startsWith('release date') || l.startsWith('eza release date') || l.startsWith('seza release date')) {
                    releaseIdx = idx;
                    if (l.startsWith('release date')) break;
                }
            }

            if (releaseIdx >= 1) {
                let candidates = [];
                for (let k = releaseIdx - 1; k >= 0 && candidates.length < 2; k--) {
                    let candidateText = linesData[k].text.trim();
                    let candidateLow = candidateText.toLowerCase();
                    if (!isGarbageLine(candidateLow) && candidateText.length > 1) {
                        candidates.unshift(candidateText);
                    }
                }
                if (candidates.length === 2) {
                    parsed.title = candidates[0].replace(/[\[\]]/g, '').trim();
                    parsed.name = candidates[1].trim();
                } else if (candidates.length === 1) {
                    parsed.name = candidates[0].trim();
                }
            }
        }

        for (let i = 0; i < linesData.length; i++) {
            let { text: line, bold: isBold } = linesData[i];
            let lowLine = line.toLowerCase().trim();
            
            if (lowLine.match(/^(st_|pot_skill_).*?\.png/i) || lowLine.match(/^\d+%\s*$/)) continue;

            if (lowLine.startsWith('seza release date')) { 
                let sameLineVal = line.replace(/^seza release date[:\s]*/i, '').trim();
                if (sameLineVal.length > 3 && /\d/.test(sameLineVal)) {
                    if (document.getElementById('sezaDateInput')) document.getElementById('sezaDateInput').value = sameLineVal;
                    currentState = 'NONE';
                } else {
                    currentState = 'SEZA_RELEASE';
                }
                continue; 
            }

            if (lowLine.startsWith('eza release date')) { 
                let sameLineVal = line.replace(/^eza release date[:\s]*/i, '').trim();
                if (sameLineVal.length > 3 && /\d/.test(sameLineVal)) {
                    if (document.getElementById('ezaDateInput')) document.getElementById('ezaDateInput').value = sameLineVal;
                    currentState = 'NONE';
                } else {
                    currentState = 'EZA_RELEASE';
                }
                continue; 
            }

            if (lowLine.startsWith('release date')) { 
                let sameLineVal = line.replace(/^release date[:\s]*/i, '').trim();
                if (sameLineVal.length > 3 && /\d/.test(sameLineVal)) {
                    parsed.release = sameLineVal;
                    currentState = 'NONE';
                } else {
                    currentState = 'RELEASE';
                }
                continue; 
            }

            if (lowLine.startsWith('leader skill'))      { currentState = 'LEADER';         continue; }
            if (lowLine.startsWith('passive skill'))     { currentState = 'PASSIVE'; currentSA = null; continue; }
            if (lowLine.startsWith('link skill'))        { currentState = 'LINKS';          continue; }
            if (lowLine.startsWith('categor'))           { currentState = 'CATEGORIES';     continue; }

            if (isGarbageLine(lowLine)) continue;

            if (lowLine.startsWith('release date'))      { currentState = 'RELEASE';        continue; }
            if (lowLine.startsWith('eza release date'))  { currentState = 'EZA_RELEASE';    continue; }
            if (lowLine.startsWith('seza release date')) { currentState = 'SEZA_RELEASE';   continue; }
            if (lowLine.startsWith('leader skill'))      { currentState = 'LEADER';         continue; }
            if (lowLine.startsWith('passive skill'))     { currentState = 'PASSIVE'; currentSA = null; continue; }
            if (lowLine.startsWith('link skill'))        { currentState = 'LINKS';          continue; }
            if (lowLine.startsWith('categor'))           { currentState = 'CATEGORIES';     continue; }

            const isSAHeader = /^(super attack|ultra super attack|unit super attack|unit ultra super attack|ex super attack)/i.test(lowLine) && !lowLine.includes('|');
            if (isSAHeader) {
                currentState = 'SA';
                let saLabel = "Super Attack";
                if (lowLine.includes('unit ultra'))      saLabel = "Unit Ultra Super Attack";
                else if (lowLine.includes('ultra super')) saLabel = "Ultra Super Attack";
                else if (lowLine.includes('unit super'))  saLabel = "Unit Super Attack";
                else if (lowLine.includes('ex super'))    saLabel = "Ex Super Attack";

                currentSA = { type: saLabel, name: "", effect: [], condition: [] };
                saTarget = 'name';
                parsed.sa.push(currentSA);
                continue;
            }
            
            const isExchangeHeader = /^(reversible exchange|exchange skill|exchange)/i.test(lowLine);
            const isActiveHeader = /^(active skill|standby skill|domain skill|domain effect|domain|finish skill|finish effect)/i.test(lowLine) || isExchangeHeader;

            if (isActiveHeader) {
                currentState = 'ACTIVE';
                let typeLabel = line;
                if (lowLine.includes('domain')) typeLabel = 'Domain Effect(s)';
                if (lowLine.includes('finish')) typeLabel = 'Finish Skill';
                if (isExchangeHeader) typeLabel = 'Reversible Exchange';

                currentActive = { 
                    type: typeLabel, 
                    name: isExchangeHeader ? "Reversible Exchange" : "", 
                    effect: [], 
                    condition: [] 
                };
                activeTarget = isExchangeHeader ? 'effect' : 'name';
                parsed.actives.push(currentActive);
                continue;
            }

            if (currentState === 'ACTIVE' && currentActive) {
                if (isGarbageLine(lowLine)) continue;

                const isConditionHeader = /^activation\s+conditions?(\(s\))?/i.test(lowLine) || /^conditions?(\(s\))?/i.test(lowLine);
                
                if (isConditionHeader) {
                    activeTarget = 'condition';
                    continue; 
                }

                if (!isExchangeHeader && activeTarget === 'effect' && (lowLine.startsWith('can be activated') || lowLine.startsWith('activated when'))) {
                    activeTarget = 'condition';
                    currentActive.condition.push(line);
                    continue;
                }

                if (activeTarget === 'name' && currentActive.name === "") { 
                    currentActive.name = line; 
                    activeTarget = 'effect'; 
                }
                else if (activeTarget === 'effect') { 
                    currentActive.effect.push(line); 
                }
                else { 
                    currentActive.condition.push(line); 
                }
                continue;
            }

            if (lowLine.startsWith('stats\t') || lowLine.startsWith('stats base min')) { currentState = 'STATS'; continue; }

            if (currentState === 'RELEASE')       { parsed.release = line; currentState = 'NONE'; continue; }
            if (currentState === 'EZA_RELEASE')   { if(document.getElementById('ezaDateInput')) document.getElementById('ezaDateInput').value = line; currentState = 'NONE'; continue; }
            if (currentState === 'SEZA_RELEASE')  { if(document.getElementById('sezaDateInput')) document.getElementById('sezaDateInput').value = line; currentState = 'NONE'; continue; }

            if (currentState === 'LEADER') { parsed.leader.push(line); continue; }

            if (currentState === 'SA' && currentSA) {
                if (lowLine.includes('sa lv') || isGarbageLine(lowLine)) continue;
                
                if (lowLine === 'activation condition' || lowLine === 'condition' || lowLine === 'activation conditions') { 
                    saTarget = 'condition'; 
                    continue; 
                }
                
                if (lowLine.startsWith('activated when') || lowLine.includes('condition:')) { 
                    saTarget = 'condition'; 
                    currentSA.condition.push(line); 
                    continue; 
                }

                if (saTarget === 'name' && currentSA.name === "") {
                    let strippedName = line.replace(/@@(ONCE|INF|UP|DOWN|YDOWN)@@/gi, '').trim();
                    strippedName = strippedName.replace(/\(extreme\)/ig, '').trim();
                    if (strippedName === "" || isGarbageLine(strippedName.toLowerCase())) continue;
                    currentSA.name = strippedName; saTarget = 'effect';
                } else if (saTarget === 'effect') {
                    currentSA.effect.push(line);
                } else if (saTarget === 'condition') {
                    if (lowLine !== currentSA.name.toLowerCase()) {
                        currentSA.condition.push(line);
                    }
                }
                continue;
            }

            if (currentState === 'PASSIVE') {
                if (!parsed.passiveName) { parsed.passiveName = line; continue; }
                if (isBold) {
                    currentPassiveSec = { header: line.replace(/:$/, ''), lines: [] };
                    parsed.passiveSections.push(currentPassiveSec);
                } else {
                    if (!currentPassiveSec) {
                        currentPassiveSec = { header: "Basic effect(s)", lines: [] };
                        parsed.passiveSections.push(currentPassiveSec);
                    }
                    currentPassiveSec.lines.push(line);
                }
                continue;
            }

            if (currentState === 'LINKS')      { parsed.linksRaw.push(line); continue; }
            if (currentState === 'CATEGORIES') { parsed.categoriesRaw.push(line); continue; }

            if (currentState === 'STATS') {
                let p = line.split(/\s+/).map(val => val.replace(/,/g, ''));
                if (lowLine.startsWith('hp'))  { parsed.stats.hp  = p[1]; parsed.stats.hp_max  = p[2]; parsed.stats.hp_100  = p[4]; }
                if (lowLine.startsWith('atk')) { parsed.stats.atk = p[1]; parsed.stats.atk_max = p[2]; parsed.stats.atk_100 = p[4]; }
                if (lowLine.startsWith('def')) { parsed.stats.def = p[1]; parsed.stats.def_max = p[2]; parsed.stats.def_100 = p[4]; }
            }
        }

        const cardIdMatch = fullText.match(/cards\/(\d{7})/);
        const cardId = cardIdMatch ? cardIdMatch[1] : null;

        const titleNameMatch = (pageHtml + "\n" + rawHtml + "\n" + fullText).match(/\[([^\]\n]{2,120})\]\s*([^\n\r<]{2,100})/);

        if (titleNameMatch) {
            const extractedTitle = titleNameMatch[1].trim();
            const extractedName = titleNameMatch[2].replace(/https?:\/\/[^\s]+/g, '').replace(/<[^>]*>/g, '').trim();
            
            if (extractedTitle && (!parsed.title || isGarbageLine(parsed.title.toLowerCase()))) {
                parsed.title = extractedTitle;
            }
            if (extractedName && (!parsed.name || isGarbageLine(parsed.name.toLowerCase()))) {
                parsed.name = extractedName;
            }
        }

        if ((!parsed.name || isGarbageLine(parsed.name.toLowerCase())) && cardId && window._lastDokkanCardNameMap && window._lastDokkanCardNameMap[cardId]) {
            parsed.name = window._lastDokkanCardNameMap[cardId];
        }

        let detectedRarity = null;
        for (let i = 0; i < linesData.length; i++) {
            let lowLine = linesData[i].text.toLowerCase();
            
            const saMatch = lowLine.match(/sa lv[.:]?\s*(\d+)/);
            if (saMatch) {
                let saLv = parseInt(saMatch[1]);
                if (saLv >= 20) detectedRarity = "LR";
                if (saLv <= 15) detectedRarity = "TUR";
            }
            
            if (lowLine.includes('max lv:')) {
                let lv = parseInt(lowLine.replace('max lv:', '').trim());
                if (lv === 150)             detectedRarity = "LR";
                if (lv === 120 || lv === 140) detectedRarity = "TUR";
            }
            if (lowLine.includes('cost:')) {
                let cost = parseInt(lowLine.replace('cost:', '').trim());
                if (cost === 77 || cost === 99) detectedRarity = "LR";
                if (cost === 58 || cost <= 42)  detectedRarity = "TUR";
            }
            if (lowLine.includes('colossal damage'))                                        detectedRarity = "LR";
            if (lowLine.includes('immense damage') || lowLine.includes('supreme damage'))   detectedRarity = "TUR";
        }

        if (detectedRarity) {
            currentRarity = detectedRarity;
            window.updateRarityStats(detectedRarity);
        }

        let detectedTypeFromStats = null;
        if (parsed.stats.hp_max && parsed.stats.hp_100) {
            const hDiff = parseInt(parsed.stats.hp_100)  - parseInt(parsed.stats.hp_max);
            const aDiff = parseInt(parsed.stats.atk_100) - parseInt(parsed.stats.atk_max);
            const dDiff = parseInt(parsed.stats.def_100) - parseInt(parsed.stats.def_max);
            if      (hDiff === 4600 && dDiff === 5400)                   detectedTypeFromStats = 'agl';
            else if (hDiff === 4600 && aDiff === 5400)                   detectedTypeFromStats = 'teq';
            else if (hDiff === 5000 && aDiff === 5000 && dDiff === 5000) detectedTypeFromStats = 'int';
            else if (hDiff === 5000 && aDiff === 5400)                   detectedTypeFromStats = 'str';
            else if (hDiff === 5400 && aDiff === 5000)                   detectedTypeFromStats = 'phy';
        }
        if (detectedTypeFromStats) window.applyCardTheme(detectedTypeFromStats);
        else if (detectedType)     window.applyCardTheme(detectedType);

        if (!parsed.release) {
            const dateMatch = fullText.match(/\b(release date|released?)\s*[:\t]?\s*(\d{4}[\/.-]\d{1,2}[\/.-]\d{1,2}|\w+\s+\d{1,2},\s*\d{4})/i);
            if (dateMatch) parsed.release = dateMatch[2];
        }
        if (document.getElementById('ezaDateInput') && !document.getElementById('ezaDateInput').value) {
            const ezaDateMatch = fullText.match(/\beza\s+release date\s*[:\t]?\s*(\d{4}[\/.-]\d{1,2}[\/.-]\d{1,2}|\w+\s+\d{1,2},\s*\d{4})/i);
            if (ezaDateMatch) document.getElementById('ezaDateInput').value = ezaDateMatch[1];
        }
        if (document.getElementById('sezaDateInput') && !document.getElementById('sezaDateInput').value) {
            const sezaDateMatch = fullText.match(/\bseza\s+release date\s*[:\t]?\s*(\d{4}[\/.-]\d{1,2}[\/.-]\d{1,2}|\w+\s+\d{1,2},\s*\d{4})/i);
            if (sezaDateMatch) document.getElementById('sezaDateInput').value = sezaDateMatch[1];
        }

        try {
            if (document.getElementById('descInput'))   document.getElementById('descInput').value   = parsed.title;
            if (document.getElementById('nameInput'))   document.getElementById('nameInput').value   = parsed.name;
            if (document.getElementById('dateInput'))   document.getElementById('dateInput').value   = parsed.release;
            if (document.getElementById('leaderInput')) document.getElementById('leaderInput').value = cleanText(parsed.leader.join('\n'), 'general');

            if (parsed.stats.hp_max && document.getElementById('input-hp-max')) { 
                document.getElementById('input-hp-max').value = parsed.stats.hp_max; 
                window.calcFromMax('hp', parseInt(parsed.stats.hp)); 
            }
            if (parsed.stats.atk_max && document.getElementById('input-atk-max')) { 
                document.getElementById('input-atk-max').value = parsed.stats.atk_max; 
                window.calcFromMax('atk', parseInt(parsed.stats.atk)); 
            }
            if (parsed.stats.def_max && document.getElementById('input-def-max')) { 
                document.getElementById('input-def-max').value = parsed.stats.def_max; 
                window.calcFromMax('def', parseInt(parsed.stats.def)); 
            }
        } catch (e) { console.error("Error setting base stats/identity", e); }

        try {
            document.getElementById('card-passive-container').innerHTML = "";
            document.getElementById('sidebar-sections-area').innerHTML = "";
            sIdx = 0;
            parsed.passiveSections.forEach(sec => {
                if (sec.lines.length === 0 && sec.header === "Basic effect(s)") return;
                window.addNewSection();
                const currentBox         = document.getElementById(`input-sec-${sIdx}`);
                const currentHeaderInput = document.querySelector(`#side-content-${sIdx} input[type="text"]`);
                let fx = sec.lines.map(l => cleanText(l, 'passive')).join('\n');
                if (currentHeaderInput) { currentHeaderInput.value = sec.header; window.updateHeader(sIdx, sec.header); }
                if (currentBox)         { currentBox.value = fx; window.updateSection(sIdx, fx); }
            });
            
            if (parsed.passiveName) {
                if (document.getElementById('input-passive-name-sidebar')) document.getElementById('input-passive-name-sidebar').value = parsed.passiveName;
                const cardPassName = document.querySelector('.passive-name-display');
                if (cardPassName) cardPassName.innerText = parsed.passiveName;
            }
        } catch (e) { console.error("Error setting Passives", e); }

        parsed.sa = parsed.sa.filter(sa => sa.name && sa.name.trim() !== "|" && sa.name.trim() !== "-" && sa.name.length > 1 && !isGarbageLine(sa.name.toLowerCase()));

        try {
            document.querySelectorAll(".sa-block").forEach(b => b.remove());
            parsed.sa.forEach((attack, index) => {
                window.addSuperAttackSection();
                const saBlocks = document.querySelectorAll('.sa-block');
                const currentBlock = saBlocks[index];
                if (!currentBlock) return;

                const nameDisp = currentBlock.querySelector('.sa-display-name');
                if (nameDisp) nameDisp.textContent = attack.name || "Super Attack";

                const typeLabel = currentBlock.querySelector('.sa-type-label');
                if (typeLabel) typeLabel.textContent = attack.type || "Super Attack";

                const effectsContainer = currentBlock.querySelector('.sa-display-effects-list');
                if (effectsContainer) {
                    const lines = attack.effect.map(l => cleanText(l, 'general')).filter(Boolean);
                    effectsContainer.innerHTML = lines.map(l => `<div class="row"><div class="col">${l}</div></div>`).join('');
                }

                const rawCondition = attack.condition.map(l => cleanText(l, 'general')).join('\n').trim();
                const cleanCond = (typeof window.extractCleanConditionText === 'function')
                    ? window.extractCleanConditionText(rawCondition)
                    : rawCondition.replace(/^activation\s+conditions?(\(s\))?[\s:]*/i, '').trim();
                const isSpecialType = attack.type.toLowerCase().includes('unit') || attack.type.toLowerCase().includes('ex');

                if (cleanCond || isSpecialType) {
                    const actRow = currentBlock.querySelector('.activation-row');
                    const saLvArea = currentBlock.querySelector('.sa-lv-container');
                    const actTextDisp = currentBlock.querySelector('.activation-text');
                    
                    if (actRow) actRow.classList.remove('d-none');
                    if (saLvArea) saLvArea.classList.add('d-none');
                    
                    if (actTextDisp) {
                        const header = "<strong>Activation Condition</strong>";
                        if (cleanCond !== "") {
                            actTextDisp.innerHTML = `${header}<br>${cleanCond.replace(/\n/g, '<br>')}`;
                        } else {
                            actTextDisp.innerHTML = header;
                        }
                    }
                }

                currentSuperAttack = currentBlock;
                
                const inputName = document.getElementById('input-sa-name');
                if (inputName) inputName.value = attack.name || "";
                const inputEffects = document.getElementById('input-sa-effects');
                if (inputEffects) inputEffects.value = attack.effect.map(l => cleanText(l, 'general')).join('\n');
                const inputAct = document.getElementById('input-activation');
                if (inputAct) inputAct.value = cleanCond;

                try { window.autoGenerateSAIcons(); } catch (e) { }
            });

            if (document.querySelectorAll('.sa-block').length > 0) {
                currentSuperAttack = document.querySelectorAll('.sa-block')[0];
                window.refreshSADropdown();
            }
        } catch (e) { console.error("Error setting Super Attacks", e); }

        try {
            document.querySelectorAll(".active-block").forEach(b => b.remove());
            if (parsed.actives.length > 0) {
                parsed.actives.forEach((act, index) => {
                    window.addActiveSkillSection();
                    const activeBlocks = document.querySelectorAll('.active-block');
                    const currentBlock = activeBlocks[index];
                    if (!currentBlock) return;

                    const typeDisp = currentBlock.querySelector('.active-type-label');
                    if (typeDisp) typeDisp.textContent = act.type || "Active Skill";

                    const nameDisp = currentBlock.querySelector('.active-display-name');
                    if (nameDisp) nameDisp.textContent = act.name || "Skill Name";

                    const effDisp = currentBlock.querySelector('.active-display-effect');
                    if (effDisp) effDisp.innerHTML = act.effect.map(l => cleanText(l, 'active')).join('<br>');

                    const condTitleDisp = currentBlock.querySelector('.active-display-condition-title');
                    if (condTitleDisp) condTitleDisp.textContent = act.conditionTitle || "Activation Condition(s)";

                    const condDisp = currentBlock.querySelector('.active-display-condition');
                    const condText = act.condition.map(l => cleanText(l, 'active')).join('<br>');
                    if (condDisp) condDisp.innerHTML = condText;

                    const divRow = currentBlock.querySelector('.active-divider-row');
                    const condRow = currentBlock.querySelector('.active-condition-row');

                    if (act.condition.length === 0 && !condText) {
                        if (divRow) divRow.classList.add('d-none');
                        if (condRow) condRow.classList.add('d-none');
                    } else {
                        if (divRow) divRow.classList.remove('d-none');
                        if (condRow) condRow.classList.remove('d-none');
                    }

                    currentActiveSkill = currentBlock;
                });

                if (document.querySelectorAll('.active-block').length > 0) {
                    currentActiveSkill = document.querySelectorAll('.active-block')[0];
                    window.refreshActiveDropdown();
                }
            }
        } catch (e) { console.error("Error setting Active Skills", e); }

        try {
            document.getElementById('card-link-container').innerHTML = "";
            let extractedLinks = [];
            parsed.linksRaw.forEach(line => {
                let parts = line.split(/,|\t|\u2022|\||\n/).map(p => p.trim()).filter(p => p.length > 1);
                extractedLinks.push(...parts);
            });
            [...new Set(extractedLinks)].forEach(link => {
                if (!/^link skill/i.test(link) && link.length < 50 && !isGarbageLine(link.toLowerCase())) {
                    const html = `<a class="col-4 border border-1 border-${currentType} padding-top-bottom-10 text-center">${link}</a>`;
                    document.getElementById('card-link-container').insertAdjacentHTML('beforeend', html);
                }
            });
        } catch (e) { console.error("Error setting Links", e); }

        try {
            document.getElementById('card-category-container').innerHTML = "";
            const catOptions = Array.from(document.querySelectorAll('#category-options option'));
            let catPool = (parsed.categoriesRaw.join(' ') + ' ' + rawText).toLowerCase();
            catOptions.forEach(opt => {
                let catName = opt.value;
                if (!catName) return;
                let rx = new RegExp(`(^|[^a-zA-Z0-9])${catName.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-zA-Z0-9]|$)`, 'i');
                if (rx.test(catPool)) {
                    const catId = opt.getAttribute('data-id');
                    if (catId && !document.querySelector(`#card-category-container img[src*="label_${catId}_b_on"]`)) {
                        const html = `<div class="col-4 d-flex justify-content-center padding-top-bottom-5"><img src="https://abscustom.github.io/assets/images/card_category_label_${catId}_b_on.png" style="width:210px;"></div>`;
                        document.getElementById('card-category-container').insertAdjacentHTML('beforeend', html);
                    }
                }
            });
        } catch (e) { console.error("Error setting Categories", e); }

        window.updateIdentity();

        try {
            document.querySelectorAll("#forms-container .dokkan-card").forEach(f => f.remove());

            let extractedCutins = window.extractedCutins || [];
            if (extractedCutins.length === 0 && window.scrapedAssets) {
                extractedCutins = Object.keys(window.scrapedAssets)
                    .filter(name => /^Form_Cutin_\d+\.png$/i.test(name))
                    .sort((a, b) => {
                        const ai = parseInt((a.match(/(\d+)\.png$/) || [0, 0])[1], 10);
                        const bi = parseInt((b.match(/(\d+)\.png$/) || [0, 0])[1], 10);
                        return ai - bi;
                    })
                    .map(name => ({
                        blobUrl: URL.createObjectURL(window.scrapedAssets[name]),
                        exportName: `images/${name}`
                    }));
            }
            const mainCharName = parsed.name || "Unknown Character";
            const isGiant = rawText.toLowerCase().includes('giant form') || rawText.toLowerCase().includes('giant ape');

            let nameParts = [];
            if (mainCharName.includes('+')) nameParts = mainCharName.split('+').map(p => p.trim());
            else if (mainCharName.includes('&')) nameParts = mainCharName.split('&').map(p => p.trim());

            if (nameParts.length === 2 && extractedCutins.length >= 2) {
                window.addFormBlock(`${nameParts[0]} & ${nameParts[1]}`, extractedCutins[0].blobUrl, extractedCutins[0].exportName);
                window.addFormBlock(`${nameParts[1]} & ${nameParts[0]}`, extractedCutins[1].blobUrl, extractedCutins[1].exportName);
            } 
            else if (isGiant && extractedCutins.length >= 2) {
                window.addFormBlock(mainCharName, extractedCutins[0].blobUrl, extractedCutins[0].exportName);
                window.addFormBlock(`${mainCharName} (Giant Form)`, extractedCutins[1].blobUrl, extractedCutins[1].exportName);
            } 
            else if (extractedCutins.length > 0) {
                extractedCutins.forEach((c, idx) => {
                    let label = mainCharName;
                    if (idx > 0) {
                        if (idx === 1 && mainCharName.includes('+')) {
                            const parts = mainCharName.split('+').map(p => p.trim()).filter(Boolean);
                            label = parts.length === 2 ? `${parts[1]} + ${parts[0]}` : mainCharName;
                        } else if (idx === 1 && mainCharName.includes('&')) {
                            const parts = mainCharName.split('&').map(p => p.trim()).filter(Boolean);
                            label = parts.length === 2 ? `${parts[1]} + ${parts[0]}` : mainCharName;
                        } else if (idx > 1) {
                            label = `Form ${idx + 1}`;
                        }
                    }
                    window.addFormBlock(label, c.blobUrl, c.exportName);
                });
            } 
            else {
                window.addFormBlock(mainCharName, "", "");
            }

            window.refreshFormList();
        } catch (e) { console.error("Error setting Forms", e); }

        window.updateIdentity();
        window.updateIconImages();

        if (window.syncToAbsLayout) {
            window.syncToAbsLayout();
        }

        inputDiv.innerHTML = '';

    } catch (e) { 
        console.error(e); 
        alert("Extraction failed."); 
    } finally { 
        if (btn) btn.innerHTML = originalBtnText; 
    }
};


