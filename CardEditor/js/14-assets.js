

// =====================================================================
// --- ASSET FETCHER (HANDLES ALL IMAGE LOGIC) ---
// =====================================================================

async function fetchImageBlob(targetUrl) {
    const sanitizeUrl = (url) => {
        if (!url) return "";
        let u = String(url).trim();
        u = u.replace(/[)\],'"`]+$/g, '');
        return u;
    };

    const stripProtocolForWeserv = (url) => {
        try {
            const u = new URL(url);
            return `${u.host}${u.pathname}${u.search}`;
        } catch {
            return url.replace(/^https?:\/\//i, '');
        }
    };

    targetUrl = sanitizeUrl(targetUrl);
    if (!targetUrl) return null;

    const cacheBust = Date.now();
    const proxies = [
        `https://images.weserv.nl/?url=${encodeURIComponent(stripProtocolForWeserv(targetUrl))}&n=-1&nocache=${cacheBust}`,
        `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`
    ];

    for (let proxy of proxies) {
        try {
            let res = await fetch(proxy, { cache: 'no-store' });
            if (res.ok) {
                let blob = await res.blob();
                if (blob.type.startsWith('image/')) return blob;
            }
        } catch (e) {
            console.error("Proxy failed:", proxy);
        }
    }
    return null;
}

async function fetchPageHtmlViaMirror(pageUrl) {
    const normalized = pageUrl.startsWith('http') ? pageUrl : `https://${pageUrl}`;
    const mirror = `https://r.jina.ai/${normalized}`;
    try {
        const res = await fetch(mirror, { cache: 'no-store' });
        if (!res.ok) return "";
        return await res.text();
    } catch (e) {
        console.warn("Could not fetch card page HTML via mirror.", e);
        return "";
    }
}

function extractCutinUrlsFromHtml(htmlSource) {
    if (!htmlSource) return [];

    try {
        let urls = [];
        if (htmlSource.includes('<')) {
            const doc = new DOMParser().parseFromString(htmlSource, 'text/html');
            urls = Array.from(doc.querySelectorAll('img')).flatMap(img => {
                return [
                    img.getAttribute('src'),
                    img.getAttribute('data-src'),
                    img.getAttribute('data-original'),
                    img.getAttribute('data-lazy-src')
                ].filter(Boolean);
            });
        }

        const rawMatches = htmlSource.match(/https?:\/\/[^\s"'<>]+/gi) || [];
        const protoRelativeMatches = htmlSource.match(/\/\/[^\s"'<>]+/gi) || [];

        const candidates = [
            ...urls,
            ...rawMatches,
            ...protoRelativeMatches
        ]
            .map(u => String(u).trim())
            .map(u => (u.startsWith('//') ? `https:${u}` : u))
            .map(u => u.replace(/&amp;/g, '&'))
            .map(u => u.replace(/[)\],'"`]+$/g, ''));

        const formCutinRx = /card_[0-9]{7}_(?:sp_)?cutin(?:_[0-9]+)?\.(png|webp)(\?.*)?$/i;
        const cutins = candidates.filter(u => formCutinRx.test(u));
        return [...new Set(cutins)];
    } catch (e) {
        console.warn("Could not parse cutin URLs from pasted HTML.", e);
        return [];
    }
}

function extractThumbUrlsFromHtml(htmlSource) {
    if (!htmlSource) return [];

    const normalize = (u) => {
        if (!u) return "";
        let url = String(u).trim();
        url = url.replace(/&amp;/g, '&').replace(/[)\],'"`]+$/g, '');
        if (url.startsWith('//')) url = `https:${url}`;
        if (url.startsWith('/')) url = `https://dokkaninfo.com${url}`;
        return url;
    };

    try {
        let urls = [];
        if (htmlSource.includes('<')) {
            const doc = new DOMParser().parseFromString(htmlSource, 'text/html');
            urls = Array.from(doc.querySelectorAll('img')).flatMap(img => {
                return [
                    img.getAttribute('src'),
                    img.getAttribute('data-src'),
                    img.getAttribute('data-original'),
                    img.getAttribute('data-lazy-src')
                ].filter(Boolean);
            });
        }

        const rawMatches = htmlSource.match(/https?:\/\/[^\s"'<>]+/gi) || [];
        const protoRelativeMatches = htmlSource.match(/\/\/[^\s"'<>]+/gi) || [];
        const rootRelativeMatches = htmlSource.match(/\/assets\/[^\s"'<>]+/gi) || [];

        const candidates = [
            ...urls,
            ...rawMatches,
            ...protoRelativeMatches,
            ...rootRelativeMatches
        ].map(normalize).filter(Boolean);

        const thumbRx = /card_[0-9]{7}_thumb(?:\/card_[0-9]{7}_thumb)?\.(png|webp)(\?.*)?$/i;
        const filtered = candidates.filter(u => thumbRx.test(u));
        return [...new Set(filtered)];
    } catch (e) {
        console.warn("Could not parse thumb URLs from fetched HTML.", e);
        return [];
    }
}

function extractCardNameMapFromHtml(htmlSource) {
    const map = {};
    if (!htmlSource) return map;

    try {
        const decoded = String(htmlSource).replace(/&amp;/g, '&');

        const mdRx = /\[([^\]\n]{2,120})\]\((https?:\/\/dokkaninfo\.com\/cards\/(\d{7})[^\)]*)\)/gi;
        let mm;
        while ((mm = mdRx.exec(decoded)) !== null) {
            const name = (mm[1] || "").trim();
            const id = mm[3];
            if (name && id && !map[id]) map[id] = name;
        }

        const aRx = /<a[^>]+href=["'][^"']*\/cards\/(\d{7})[^"']*["'][^>]*>([^<]{2,120})<\/a>/gi;
        let am;
        while ((am = aRx.exec(decoded)) !== null) {
            const id = am[1];
            const name = (am[2] || "").trim();
            if (name && id && !map[id]) map[id] = name;
        }
    } catch (e) {}

    return map;
}

function extractCardIdFromCutinUrl(url) {
    if (!url) return null;
    const m = String(url).match(/card_(\d{7})_(?:sp_)?cutin/i);
    return m ? m[1] : null;
}

function generateCandidateThumbUrls(baseIdNum, root) {
    const candidates = new Set();

    const addForId = (idNum) => {
        if (!Number.isFinite(idNum) || idNum <= 0) return;
        const id = Math.floor(idNum);
        candidates.add(`${root}/thumb/card_${id}_thumb/card_${id}_thumb.png`);
        candidates.add(`${root}/thumb/card_${id}_thumb.png`);
        candidates.add(`${root}/thumb/card_${id}_thumb/card_${id}_thumb.webp`);
        candidates.add(`${root}/thumb/card_${id}_thumb.webp`);
    };

    addForId(baseIdNum - 20);
    addForId(baseIdNum - 10);
    addForId(baseIdNum);

    for (let delta = -200; delta <= 200; delta += 10) {
        addForId(baseIdNum + delta);
    }

    return Array.from(candidates);
}

function generateCandidateCutinUrls(baseIdNum, root, seedIds = [], pastedIdNum = null, thumbIds = []) {
    const ids = [];
    const seenIds = new Set();
    const candidates = new Set();

    const pushId = (idNum) => {
        if (!Number.isFinite(idNum) || idNum <= 0) return;
        const id = Math.floor(idNum);
        if (seenIds.has(id)) return;
        seenIds.add(id);
        ids.push(id);
    };

    if (Number.isFinite(pastedIdNum)) {
        pushId(pastedIdNum);
        pushId(pastedIdNum + 1);
        pushId(pastedIdNum + 2);
        pushId(pastedIdNum + 3);
        pushId(pastedIdNum - 1);
        pushId(pastedIdNum - 2);
        pushId(pastedIdNum - 3);
        for (let delta = 0; delta <= 30; delta += 1) {
            pushId(pastedIdNum + delta);
            if (delta !== 0) pushId(pastedIdNum - delta);
        }
    }

    for (let delta = 0; delta <= 30; delta += 1) {
        pushId(baseIdNum + delta);
        if (delta !== 0) pushId(baseIdNum - delta);
    }

    const cleanSeeds = [...new Set((seedIds || []).filter(id => Number.isFinite(id) && id > 0))];
    cleanSeeds.forEach((seed) => {
        for (let delta = 0; delta <= 30; delta += 1) {
            pushId(seed + delta);
            if (delta !== 0) pushId(seed - delta);
        }
    });

    const addPatternsForId = (id) => {
        candidates.add(`${root}/card/${id}/card_${id}_cutin.png`);
        candidates.add(`${root}/card/${id}/card_${id}_cutin_1.png`);
        candidates.add(`${root}/card/${id}/card_${id}_cutin_2.png`);
        candidates.add(`${root}/card/${id}/card_${id}_cutin_3.png`);
        candidates.add(`${root}/card/${id}/card_${id}_cutin_4.png`);
        candidates.add(`${root}/card/${id}/card_${id}_sp_cutin_1.png`);
        candidates.add(`${root}/card/${id}/card_${id}_sp_cutin_2.png`);
        candidates.add(`${root}/card/${id}/card_${id}_sp_cutin_3.png`);
        candidates.add(`${root}/card/${id}/card_${id}_sp_cutin_4.png`);
    };

    ids.forEach(addPatternsForId);
    return Array.from(candidates);
}

async function checkImageReachable(url) {
    const previewUrl = `https://images.weserv.nl/?url=${encodeURIComponent(String(url).replace(/^https?:\/\//i, ''))}&w=100&output=jpg`;
    return await new Promise((resolve) => {
        const img = new Image();
        let done = false;
        const finish = (ok) => {
            if (done) return;
            done = true;
            resolve(ok);
        };
        img.onload = () => finish(true);
        img.onerror = () => finish(false);
        setTimeout(() => finish(false), 3500);
        img.src = previewUrl;
    });
}

async function filterReachableUrls(urls, maxToProbe = 120) {
    if (!Array.isArray(urls) || urls.length === 0) return [];
    const shortlist = [...new Set(urls)].slice(0, maxToProbe);
    const ok = await Promise.all(shortlist.map(u => checkImageReachable(u)));
    return shortlist.filter((_, idx) => ok[idx]);
}

async function resolveCardIconIdsFromInput(pastedIdNum, root) {
    const seed = Math.floor(pastedIdNum / 10) * 10;
    const probeIds = [];
    for (let delta = -60; delta <= 60; delta += 10) {
        const id = seed + delta;
        if (id > 0) probeIds.push(id);
    }

    const checks = await Promise.all(probeIds.map(async (id) => {
        const url = `${root}/thumb/card_${id}_thumb/card_${id}_thumb.png`;
        return (await checkImageReachable(url)) ? id : null;
    }));
    const reachable = checks.filter(Boolean).sort((a, b) => a - b);
    if (reachable.length === 0) return [];

    return reachable;
}

function applyFetchedCutinsToExistingForms() {
    const extractedCutins = Array.isArray(window.extractedCutins) ? window.extractedCutins : [];
    if (extractedCutins.length === 0) return;

    const ensureFormCount = (targetCount) => {
        const cap = 8; 
        const desired = Math.min(Math.max(targetCount, 0), cap);
        while (document.querySelectorAll("#forms-container .dokkan-card").length < desired) {
            window.addFormBlock();
        }
    };

    ensureFormCount(extractedCutins.length);
    const forms = Array.from(document.querySelectorAll("#forms-container .dokkan-card"));
    if (forms.length === 0) return;

    const setFormImg = (formEl, cutinData, idx) => {
        if (!formEl) return;
        const img = formEl.querySelector('.form-image');
        if (cutinData) {
            if (img && cutinData.blobUrl) img.src = cutinData.blobUrl;
            if (img && cutinData.exportName) img.setAttribute('data-export-name', cutinData.exportName);
            if (cutinData.thumbBlobUrl) formEl.setAttribute('data-thumb-src', cutinData.thumbBlobUrl);
        }
        if (!formEl.hasAttribute('data-thumb-src')) {
            const thumbBlob = window.scrapedAssets ? window.scrapedAssets[`Form_ABS_Thumb_${idx + 1}.png`] : null;
            if (thumbBlob) {
                formEl.setAttribute('data-thumb-src', URL.createObjectURL(thumbBlob));
            }
        }
    };

    const setFormName = (formEl, fallbackLabel, cutinData) => {
        if (!formEl) return;
        const nameEl = formEl.querySelector('.form-name');
        if (!nameEl) return;

        const id = extractCardIdFromCutinUrl(cutinData?.sourceUrl || "");
        const nameMap = window._lastDokkanCardNameMap || {};
        const mapped = id ? nameMap[id] : "";
        nameEl.textContent = mapped || fallbackLabel;
    };

    const buildFallbackLabel = (idx) => {
        const mainName = (document.getElementById('nameInput')?.value || '').trim();
        if (idx === 0) return mainName || "Form 1";

        if (idx === 1) {
            if (mainName.includes('+')) {
                const parts = mainName.split('+').map(p => p.trim()).filter(Boolean);
                if (parts.length === 2) return `${parts[1]} + ${parts[0]}`;
            }
            if (mainName.includes('&')) {
                const parts = mainName.split('&').map(p => p.trim()).filter(Boolean);
                if (parts.length === 2) return `${parts[1]} & ${parts[0]}`;
            }
            if (mainName) return mainName;
        }

        return `Form ${idx + 1}`;
    };

    forms.forEach((formEl, idx) => {
        const cutin = extractedCutins[idx] || null; 
        setFormImg(formEl, cutin, idx);
        const fallback = buildFallbackLabel(idx);
        setFormName(formEl, fallback, cutin);
    });

    try { window.refreshFormList(); } catch (e) {}
}

async function processAssets(textToSearch, htmlSource = "", options = {}) {
    const showSAIconPopup = options.showSAIconPopup !== false;
    const urlMatch = textToSearch.match(/dokkaninfo\.com\/cards\/(\d{7})/);
    if (!urlMatch) return false;
    const pastedId = parseInt(urlMatch[1]);
    const baseIdNum = Math.floor(pastedId / 10) * 10;
    const root = "https://dokkaninfo.com/assets/global/en/character";
    window._lastDokkanCardNameMap = extractCardNameMapFromHtml(htmlSource);
    
    let isLR = (textToSearch + " " + htmlSource).toLowerCase().includes('rarity_lr') || htmlSource.includes('150');
    const resolvedIconIds = await resolveCardIconIdsFromInput(pastedId, root);
    
    let uniqueThumbs = extractThumbUrlsFromHtml(htmlSource);
    if (!uniqueThumbs || uniqueThumbs.length === 0) {
        uniqueThumbs = generateCandidateThumbUrls(baseIdNum, root);
    }
    if (uniqueThumbs.length > 0) uniqueThumbs = await filterReachableUrls(uniqueThumbs, 90);

    // Phase 1: Card Icons Picker UI
    const chosenIconsData = await new Promise((resolve) => {
        if (!uniqueThumbs || uniqueThumbs.length === 0) { resolve(null); return; }
        const modal = document.getElementById('icon-picker-modal');
        const grid = document.getElementById('icon-picker-grid');
        const instr = document.getElementById('icon-picker-instruction');
        const header = modal.querySelector('h2');
        const skipBtn = modal.querySelector('button');

        let selections = [];
        let manualLR = isLR;

        const refreshIconPickerUI = () => {
            grid.innerHTML = "";
            let stepName = selections.length === 0 ? "SSR" : (selections.length === 1 ? "TUR" : "LR");

            header.innerHTML = `Select Card Icons <span style="font-size:12px; color:#3b82f6; border:1px solid #3b82f6; padding:2px 6px; border-radius:4px; margin-left:10px;">MODE: ${manualLR ? 'LR' : 'TUR'}</span>`;
            instr.innerHTML = `Please click the <b>${stepName}</b> Icon<br><button id="rarity-override-btn" style="margin-top:10px; background:#3f3f46; color:#fff; border:1px solid #555; padding:4px 10px; font-size:11px; cursor:pointer; border-radius:4px;">Wrong Rarity? Switch to ${manualLR ? 'TUR' : 'LR'}</button>`;
            
            setTimeout(() => {
                const btn = document.getElementById('rarity-override-btn');
                if (btn) btn.onclick = (e) => {
                    e.preventDefault(); e.stopPropagation();
                    manualLR = !manualLR;
                    if (!manualLR && selections.length >= 2) {
                        modal.style.display = "none";
                        resolve({icons: selections.slice(0,2), isLR: false});
                    } else { refreshIconPickerUI(); }
                };
            }, 0);

            uniqueThumbs.forEach(url => {
                const img = document.createElement('img');
                img.src = `https://images.weserv.nl/?url=${encodeURIComponent(url.replace(/^https?:\/\//i, ''))}&w=100`;
                img.style.cssText = "width: 80px; height: 80px; cursor: pointer; border: 2px solid #444; border-radius: 8px;";
                if (selections.includes(url)) { img.style.borderColor = "#10b981"; img.style.opacity = "0.3"; }

                img.onclick = () => {
                    if (selections.includes(url)) return;
                    selections.push(url);
                    if (selections.length >= (manualLR ? 3 : 2)) {
                        modal.style.display = "none";
                        resolve({icons: selections, isLR: manualLR});
                    } else { refreshIconPickerUI(); }
                };
                grid.appendChild(img);
            });
        };
        modal.style.display = "flex";
        refreshIconPickerUI();
        skipBtn.onclick = () => { modal.style.display = "none"; resolve(null); };
    });

    let ssrUrl, turUrl, lrUrl;
    if (chosenIconsData) {
        isLR = chosenIconsData.isLR;
        currentRarity = isLR ? "LR" : "TUR";
        window.updateRarityStats(currentRarity);
        ssrUrl = chosenIconsData.icons[0];
        turUrl = chosenIconsData.icons[1];
        lrUrl = isLR ? chosenIconsData.icons[2] : null;
    } else {
        const iconTierIds = isLR ? [baseIdNum - 20, baseIdNum - 10, baseIdNum] : [baseIdNum - 20, baseIdNum - 10];
        ssrUrl = `${root}/thumb/card_${iconTierIds[0]}_thumb/card_${iconTierIds[0]}_thumb.png`;
        turUrl = `${root}/thumb/card_${iconTierIds[1]}_thumb/card_${iconTierIds[1]}_thumb.png`;
        lrUrl = isLR ? `${root}/thumb/card_${iconTierIds[2]}_thumb/card_${iconTierIds[2]}_thumb.png` : null;
    }

    window.scrapedAssets = {};
    window.extractedCutins = [];
    const hdArtUrl = `${root}/card/${baseIdNum}/${baseIdNum}.png`;
    const files = [
        { name: "SSR_Icon.png", url: ssrUrl, uiId: 'img-ssr' },
        { name: "TUR_Icon.png", url: turUrl, uiId: 'img-tur' },
        { name: `${baseIdNum}.png`, url: hdArtUrl, uiId: 'myOverlayImage' }
    ];
    if (isLR && lrUrl) files.push({ name: "LR_Icon.png", url: lrUrl, uiId: 'img-lr' });

    // Phase 2: Form Cutins
    const htmlCutins = extractCutinUrlsFromHtml(htmlSource);
    const guessedCutins = generateCandidateCutinUrls(baseIdNum, root, [...resolvedIconIds], pastedId);
    const cutinCandidateUrls = [...new Set([...htmlCutins, ...guessedCutins])];

    let allFormOptions = cutinCandidateUrls.slice(0, 60).map((url) => ({
        url, blob: null, blobUrl: `https://images.weserv.nl/?url=${encodeURIComponent(url.replace(/^https?:\/\//i, ''))}&w=200`
    }));

    const finalCutinAssets = await new Promise((resolve) => {
        const modal = document.getElementById('icon-picker-modal');
        const grid = document.getElementById('icon-picker-grid');
        const instr = document.getElementById('icon-picker-instruction');
        const header = modal ? modal.querySelector('h2') : null;
        const skipBtn = modal ? modal.querySelector('button') : null;

        if (!modal || !grid || !instr || !header || !skipBtn || !skipBtn.parentNode) {
            resolve([]);
            return;
        }

        header.innerText = "Select Form Images (Cutins)";
        instr.innerHTML = `Select all form images in order. Click <b>Done</b> when finished.`;
        grid.innerHTML = "";

        let picks = [];
        allFormOptions.forEach((asset) => {
            const img = document.createElement('img');
            img.src = asset.blobUrl;
            img.style.cssText = "height: 80px; width: auto; max-width: 200px; cursor: pointer; border: 2px solid #444; border-radius: 8px; background: #000;";
            img.onerror = () => img.remove();
            img.onclick = () => {
                if (picks.includes(asset)) {
                    picks = picks.filter(p => p !== asset);
                    img.style.borderColor = "#444"; img.style.opacity = "1";
                } else {
                    picks.push(asset);
                    img.style.borderColor = "#10b981"; img.style.opacity = "0.4";
                }
                instr.innerHTML = `Picks: <b>${picks.length}</b>. Click <b>Done</b> when finished.`;
            };
            grid.appendChild(img);
        });

        const originalBtnText = skipBtn.innerText;
        const originalSkipClick = skipBtn.onclick;
        const originalSkipAttr = skipBtn.getAttribute('onclick');
        skipBtn.innerText = "Skip / Use Auto-Guesses";
        skipBtn.onclick = () => {
            modal.style.display = "none";
            doneBtn.remove();
            skipBtn.innerText = originalBtnText;
            skipBtn.onclick = originalSkipClick;
            if (originalSkipAttr !== null) skipBtn.setAttribute('onclick', originalSkipAttr);
            else skipBtn.removeAttribute('onclick');
            resolve([]);
        };

        const doneBtn = document.createElement('button');
        doneBtn.type = 'button';
        doneBtn.className = 'btn btn-success mt-2 w-100 fw-bold';
        doneBtn.textContent = 'Done / Use Selected';
        doneBtn.onclick = () => {
            modal.style.display = "none";
            doneBtn.remove();
            skipBtn.innerText = originalBtnText;
            skipBtn.onclick = originalSkipClick;
            if (originalSkipAttr !== null) skipBtn.setAttribute('onclick', originalSkipAttr);
            else skipBtn.removeAttribute('onclick');
            resolve(picks.length > 0 ? picks : []);
        };
        const buttonHost = skipBtn.parentElement || modal.querySelector('.icon-picker-content') || modal;
        if (buttonHost) {
            if (skipBtn.parentElement === buttonHost && skipBtn.parentElement) {
                buttonHost.insertBefore(doneBtn, skipBtn);
            } else {
                buttonHost.appendChild(doneBtn);
            }
        }
        modal.style.display = "flex";
    });

    // Phase 3: ABS Transformation Card Icons
    let finalDbFormThumbs = [];

    if (uniqueThumbs && uniqueThumbs.length > 0) {
        finalDbFormThumbs = await new Promise((resolve) => {
            const modal = document.getElementById('icon-picker-modal');
            const grid = document.getElementById('icon-picker-grid');
            const instr = document.getElementById('icon-picker-instruction');
            const header = modal ? modal.querySelector('h2') : null;
            const skipBtn = modal ? modal.querySelector('button') : null;

            if (!modal || !grid || !instr || !header || !skipBtn || !skipBtn.parentNode) {
                resolve([]);
                return;
            }

            header.innerText = "Select Transformation Card Icons (ABS Mode)";
            instr.innerHTML = "Select square card icons for transformations in order (Form 2, Form 3, etc.). Click <b>Done</b> when finished.";
            grid.innerHTML = "";

            let customBar = modal.querySelector('.custom-icon-url-bar');
            if (!customBar) {
                customBar = document.createElement('div');
                customBar.className = 'custom-icon-url-bar';
                customBar.style.cssText = 'display:flex; gap:8px; margin: 12px 0 6px 0; width: 100%;';
                customBar.innerHTML = `
                    <input type="text" id="custom-picker-url-input" placeholder="Paste custom icon URL or Card ID (e.g. 1025732)..." style="flex:1; background:#111; color:#fff; border:1px solid #10b981; padding:6px 10px; border-radius:4px; font-size:12px;">
                    <button type="button" id="custom-picker-url-btn" style="background:#10b981; color:#fff; border:none; padding:6px 14px; font-weight:bold; border-radius:4px; font-size:12px; cursor:pointer;">Load Icon</button>
                `;
                instr.parentNode.insertBefore(customBar, grid);
            } else {
                customBar.style.display = 'flex';
            }

            const customInput = customBar.querySelector('#custom-picker-url-input');
            const customBtn = customBar.querySelector('#custom-picker-url-btn');
            if (customInput) customInput.value = '';

            let picks = [];

            const loadCustomUrl = async () => {
                let rawVal = (customInput?.value || '').trim();
                if (!rawVal) return;

                const origBtnText = customBtn ? customBtn.innerText : 'Load Icon';
                if (customBtn) {
                    customBtn.disabled = true;
                    customBtn.innerText = 'Loading...';
                }

                try {
                    let newUrls = [];

                    if (/^\d{7}$/.test(rawVal)) {
                        const idNum = parseInt(rawVal, 10);
                        const candidates = generateCandidateThumbUrls(idNum, root);
                        candidates.unshift(`${root}/thumb/card_${idNum}_thumb/card_${idNum}_thumb.png`);
                        newUrls = candidates;
                    } 
                    else if (rawVal.includes('dokkaninfo.com/cards/')) {
                        const cardIdMatch = rawVal.match(/cards\/(\d{7})/);
                        const pageHtml = await fetchPageHtmlViaMirror(rawVal);
                        let extracted = extractThumbUrlsFromHtml(pageHtml);
                        
                        if (cardIdMatch) {
                            const idNum = parseInt(cardIdMatch[1], 10);
                            const candidates = generateCandidateThumbUrls(idNum, root);
                            extracted = [...extracted, ...candidates];
                        }
                        newUrls = extracted;
                    }
                    else {
                        if (!rawVal.startsWith('http')) rawVal = 'https://' + rawVal;
                        newUrls = [rawVal];
                    }

                    const existingUrlsSet = new Set(uniqueThumbs.map(u => u.toLowerCase()));
                    const existingGridSrcs = Array.from(grid.querySelectorAll('img')).map(img => img.src.toLowerCase());

                    const filteredNewUrls = [...new Set(newUrls)].filter(url => {
                        const low = url.toLowerCase();
                        if (existingUrlsSet.has(low)) return false;
                        const weservMatch = encodeURIComponent(url.replace(/^https?:\/\//i, '')).toLowerCase();
                        if (existingGridSrcs.some(s => s.includes(weservMatch))) return false;
                        return true;
                    });

                    if (filteredNewUrls.length === 0) {
                        alert("No new icon found or icon is already in the list!");
                        return;
                    }

                    const reachableNew = await filterReachableUrls(filteredNewUrls, 30);

                    if (reachableNew.length === 0) {
                        alert("Could not load image from the pasted URL.");
                        return;
                    }

                    reachableNew.forEach(url => {
                        uniqueThumbs.push(url);
                        existingUrlsSet.add(url.toLowerCase());

                        const img = document.createElement('img');
                        img.src = `https://images.weserv.nl/?url=${encodeURIComponent(url.replace(/^https?:\/\//i, ''))}&w=100`;
                        img.style.cssText = "width: 80px; height: 80px; cursor: pointer; border: 2px solid #10b981; border-radius: 8px; background: #000;";
                        img.title = "Loaded Icon";
                        img.onerror = () => img.remove();

                        img.onclick = () => {
                            if (picks.includes(url)) {
                                picks = picks.filter(p => p !== url);
                                img.style.borderColor = "#444"; img.style.opacity = "1";
                            } else {
                                picks.push(url);
                                img.style.borderColor = "#10b981"; img.style.opacity = "0.4";
                            }
                            instr.innerHTML = `Picks: <b>${picks.length}</b>. Click <b>Done</b> when finished.`;
                        };

                        grid.insertBefore(img, grid.firstChild);
                    });

                    if (customInput) customInput.value = '';
                } catch (e) {
                    console.error(e);
                    alert("Failed to load icon from pasted URL.");
                } finally {
                    if (customBtn) {
                        customBtn.disabled = false;
                        customBtn.innerText = origBtnText;
                    }
                }
            };

            if (customBtn) customBtn.onclick = loadCustomUrl;
            if (customInput) {
                customInput.onkeydown = (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        loadCustomUrl();
                    }
                };
            }

            uniqueThumbs.forEach((url) => {
                const img = document.createElement('img');
                img.src = `https://images.weserv.nl/?url=${encodeURIComponent(url.replace(/^https?:\/\//i, ''))}&w=100`;
                img.style.cssText = "width: 80px; height: 80px; cursor: pointer; border: 2px solid #444; border-radius: 8px; background: #000;";
                img.onerror = () => img.remove();
                
                img.onclick = () => {
                    if (picks.includes(url)) {
                        picks = picks.filter(p => p !== url);
                        img.style.borderColor = "#444"; img.style.opacity = "1";
                    } else {
                        picks.push(url);
                        img.style.borderColor = "#10b981"; img.style.opacity = "0.4";
                    }
                    instr.innerHTML = `Picks: <b>${picks.length}</b>. Click <b>Done</b> when finished.`;
                };
                grid.appendChild(img);
            });

            const originalBtnText = skipBtn.innerText;
            const originalSkipClick = skipBtn.onclick;
            const originalSkipAttr = skipBtn.getAttribute('onclick');

            const doneBtn = document.createElement('button');
            doneBtn.type = 'button';
            doneBtn.className = 'btn btn-success mt-2 w-100 fw-bold';
            doneBtn.textContent = 'Done / Use Selected';

            const cleanUpModal = () => {
                modal.style.display = "none";
                if (customBar) customBar.style.display = 'none';
                doneBtn.remove();
                skipBtn.innerText = originalBtnText;
                skipBtn.onclick = originalSkipClick;
                if (originalSkipAttr !== null) skipBtn.setAttribute('onclick', originalSkipAttr);
                else skipBtn.removeAttribute('onclick');
            };

            skipBtn.innerText = "Skip Transformation Icons";
            skipBtn.onclick = () => {
                cleanUpModal();
                resolve([]);
            };

            doneBtn.onclick = () => {
                cleanUpModal();
                resolve(picks);
            };

            const buttonHost = skipBtn.parentElement || modal.querySelector('.icon-picker-content') || modal;
            if (buttonHost) {
                if (skipBtn.parentElement === buttonHost && skipBtn.parentElement) {
                    buttonHost.insertBefore(doneBtn, skipBtn);
                } else {
                    buttonHost.appendChild(doneBtn);
                }
            }
            modal.style.display = "flex";
        });
    }

    finalCutinAssets.forEach((asset, i) => {
        files.push({ name: `Form_Cutin_${i + 1}.png`, url: asset.url, isCutin: true });

        const thumbUrl = asset.url.replace(/_(?:sp_)?cutin(?:_\d+)?\.(png|webp)/i, '_thumb.png');
        files.push({ name: `Form_Thumb_${i + 1}.png`, url: thumbUrl, isFormThumb: true, formIdx: i });
    });

    finalDbFormThumbs.forEach((url, i) => {
        files.push({ name: `Form_ABS_Thumb_${i + 2}.png`, url: url, isDbFormThumb: true, formIndex: i + 1 });
    });

    const fetchResults = await Promise.all(files.map(async (file) => {
        let blob = await fetchImageBlob(file.url);
        if (blob) { return { ...file, blob, blobUrl: URL.createObjectURL(blob) }; }
        return null;
    }));

    fetchResults.filter(Boolean).forEach(res => {
        window.scrapedAssets[res.name] = res.blob;
        if (res.isCutin) {
            window.extractedCutins.push({ blobUrl: res.blobUrl, exportName: `images/${res.name}`, sourceUrl: res.url });
        } else if (res.isFormThumb) {
            if (window.extractedCutins[res.formIdx]) {
                window.extractedCutins[res.formIdx].thumbBlobUrl = res.blobUrl;
            }
        } else if (res.isDbFormThumb) {
            if (window.extractedCutins[res.formIndex]) {
                window.extractedCutins[res.formIndex].thumbBlobUrl = res.blobUrl;
            }
        } else {
            let el = document.getElementById(res.uiId);
            if (el) { el.src = res.blobUrl; el.setAttribute('data-export-name', `images/${res.name}`); }
            if (!isLR && res.uiId === 'img-tur') {
                let main = document.getElementById('img-lr');
                if (main) { main.src = res.blobUrl; main.setAttribute('data-export-name', `images/${res.name}`); }
            }
        }
    });

    document.getElementById('imageInput').value = `images/${baseIdNum}.png`;
    applyFetchedCutinsToExistingForms();
    if (showSAIconPopup) await promptSAIconSelectionFromBlocks();
    return true;
}

async function promptSAIconSelectionFromBlocks() {
    const saBlocks = Array.from(document.querySelectorAll('.sa-block'));
    if (saBlocks.length === 0) return;

    const iconInputs = Array.from(document.querySelectorAll('#sa-icon-picker input[name="sa-icon"]'));
    if (iconInputs.length === 0) return;

    const iconChoices = iconInputs.map((input) => {
        const label = input.closest('label');
        const preview = label ? label.querySelector('img') : null;
        return {
            value: input.value,
            previewSrc: preview ? preview.getAttribute('src') : input.value,
            title: (preview?.getAttribute('alt') || '').trim() || 'SA Icon'
        };
    });

    await new Promise((resolve) => {
        const modal = document.getElementById('icon-picker-modal');
        const grid = document.getElementById('icon-picker-grid');
        const instr = document.getElementById('icon-picker-instruction');
        const header = modal?.querySelector('h2');
        const skipBtn = modal?.querySelector('button');

        if (!modal || !grid || !instr || !header || !skipBtn) {
            resolve();
            return;
        }

        const originalHeader = header.innerText;
        const originalInstr = instr.innerHTML;
        const originalSkipText = skipBtn.innerText;
        const originalSkipClick = skipBtn.onclick;
        const originalSkipAttr = skipBtn.getAttribute('onclick');

        let saIndex = 0;
        const closeAndResolve = () => {
            modal.style.display = 'none';
            header.innerText = originalHeader;
            instr.innerHTML = originalInstr;
            skipBtn.innerText = originalSkipText;
            skipBtn.onclick = originalSkipClick;
            if (originalSkipAttr !== null) skipBtn.setAttribute('onclick', originalSkipAttr);
            else skipBtn.removeAttribute('onclick');
            resolve();
        };

        const applyIconToCurrentSA = (iconPath) => {
            const block = saBlocks[saIndex];
            if (!block) return;
            const iconEl = block.querySelector('.sa-display-icon');
            if (iconEl) iconEl.src = iconPath;
        };

        const updateInstruction = () => {
            const block = saBlocks[saIndex];
            const name = block?.querySelector('.sa-display-name')?.textContent?.trim() || `SA ${saIndex + 1}`;
            instr.innerHTML = `Pick icon for <b>SA ${saIndex + 1}</b>: ${name}`;
        };

        const renderChoices = () => {
            grid.innerHTML = '';
            iconChoices.forEach((choice) => {
                const wrap = document.createElement('div');
                wrap.style.cssText = 'display:flex; flex-direction:column; align-items:center; gap:6px; width:94px;';

                const img = document.createElement('img');
                img.src = choice.previewSrc;
                img.style.cssText = 'width:70px; height:70px; cursor:pointer; border:2px solid #444; border-radius:8px; background:#111; padding:4px;';
                img.title = choice.title;
                img.onclick = () => {
                    applyIconToCurrentSA(choice.value);
                    saIndex += 1;
                    if (saIndex >= saBlocks.length) {
                        closeAndResolve();
                        return;
                    }
                    updateInstruction();
                };

                const text = document.createElement('div');
                text.textContent = choice.title;
                text.style.cssText = 'font-size:10px; color:#ddd; line-height:1.2; text-align:center;';

                wrap.appendChild(img);
                wrap.appendChild(text);
                grid.appendChild(wrap);
            });
        };

        header.innerText = 'Select SA Icons';
        skipBtn.innerText = 'Skip / Keep Current SA Icons';
        skipBtn.onclick = closeAndResolve;
        skipBtn.removeAttribute('onclick');

        renderChoices();
        updateInstruction();
        modal.style.display = 'flex';
    });
}
window.promptSAIconSelectionFromBlocks = promptSAIconSelectionFromBlocks;

window.fetchAssetsOnly = async function() {
    const urlInput = document.getElementById('asset-url-input');
    if (!urlInput || !urlInput.value.trim()) {
        alert("Please paste a DokkanInfo URL in the box above first!");
        return;
    }

    const btn = event.target;
    const origText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = "Fetching Images...";

    try {
        const pageHtml = await fetchPageHtmlViaMirror(urlInput.value.trim());
        await processAssets(urlInput.value, pageHtml, { showSAIconPopup: true });
        
        if (window.currentCardThemeStyle === 'abs-style') {
            window.syncToAbsLayout();
        }
        
        alert("Assets Updated successfully!");
        urlInput.value = '';
    } catch (e) {
        console.error(e);
        alert("Failed to fetch assets. Check console.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = origText;
    }
};

