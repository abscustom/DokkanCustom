/* ==========================================================================
   20-card-importer.js - Comprehensive Official & Custom Dokkan Card Importer
   ========================================================================== */

let allImporterCards = [];
let filteredImporterCards = [];
let currentImporterSource = 'all';
let currentImporterType = 'all';
let currentImporterRarity = 'all';
let importerSearchQuery = '';
let isImporterDbLoaded = false;

window.CENTRAL_ASSET_URL = window.CENTRAL_ASSET_URL || 'https://abscustom.github.io/assets/images/';

/**
 * Fetch and safely parse local or CDN JSON
 */
async function fetchJsonSafely(filename) {
    const paths = [`json/${filename}`, filename, `./json/${filename}`, `./${filename}`];
    for (const p of paths) {
        try {
            const res = await fetch(p);
            if (res.ok) return await res.json();
        } catch (e) {}
    }
    return null;
}

/**
 * Loads the core Dokkan JSON database into window.DB
 */
async function ensureDokkanDatabase() {
    if (window.DB && window.DB.cards && window.DB.cards.length > 0 && window.DB.fields && Object.keys(window.DB.fields).length > 0) {
        return window.DB;
    }

    window.DB = window.DB || {};
    window.DB.cards = window.DB.cards || [];
    window.DB.leaders = window.DB.leaders || {};
    window.DB.passives = window.DB.passives || {};
    window.DB.actives = window.DB.actives || {};
    window.DB.standbys = window.DB.standbys || {};
    window.DB.finishes = window.DB.finishes || {};
    window.DB.fields = window.DB.fields || {};
    window.DB.links = window.DB.links || {};
    window.DB.categories = window.DB.categories || {};
    window.DB.awakeningRoutes = window.DB.awakeningRoutes || [];
    window.DB.optimalAwakeningGrowths = window.DB.optimalAwakeningGrowths || [];
    window.DB.cardSpecials = window.DB.cardSpecials || {};
    window.DB.specials = window.DB.specials || {};
    window.DB.specialViews = window.DB.specialViews || {};
    window.DB.specialCategories = window.DB.specialCategories || {};

    try {
        const [
            cards, leaders, passives, actives, standbys, finishes, fields,
            links, categories, routes, optimalGrowths, cardSpecials, specials, specialViews, specialCategories
        ] = await Promise.all([
            fetchJsonSafely('cards.json'),
            fetchJsonSafely('leader_skills.json'),
            fetchJsonSafely('passive_skills.json'),
            fetchJsonSafely('active_skills.json'),
            fetchJsonSafely('standby_skills.json'),
            fetchJsonSafely('finish_skills.json'),
            fetchJsonSafely('dokkan_fields.json'),
            fetchJsonSafely('link_skills.json'),
            fetchJsonSafely('card_categories.json'),
            fetchJsonSafely('awakening_routes.json'),
            fetchJsonSafely('optimal_awakening_growths.json'),
            fetchJsonSafely('card_specials.json'),
            fetchJsonSafely('specials.json'),
            fetchJsonSafely('special_views.json'),
            fetchJsonSafely('special_categories.json')
        ]);

        if (cards) window.DB.cards = Array.isArray(cards) ? cards : Object.values(cards);
        if (routes) window.DB.awakeningRoutes = Array.isArray(routes) ? routes : Object.values(routes);
        if (optimalGrowths) window.DB.optimalAwakeningGrowths = Array.isArray(optimalGrowths) ? optimalGrowths : Object.values(optimalGrowths);

        if (leaders) {
            window.DB.leaders = {};
            (Array.isArray(leaders) ? leaders : Object.values(leaders)).forEach(l => { if (l && l.id) window.DB.leaders[String(l.id)] = l; });
        }
        if (passives) {
            window.DB.passives = {};
            (Array.isArray(passives) ? passives : Object.values(passives)).forEach(p => { if (p && p.id) window.DB.passives[String(p.id)] = p; });
        }
        if (actives) {
            window.DB.actives = {};
            (Array.isArray(actives) ? actives : Object.values(actives)).forEach(a => { if (a && a.id) window.DB.actives[String(a.id)] = a; });
        }
        if (standbys) {
            window.DB.standbys = {};
            (Array.isArray(standbys) ? standbys : Object.values(standbys)).forEach(s => { if (s && s.id) window.DB.standbys[String(s.id)] = s; });
        }
        if (finishes) {
            window.DB.finishes = {};
            (Array.isArray(finishes) ? finishes : Object.values(finishes)).forEach(f => { if (f && f.id) window.DB.finishes[String(f.id)] = f; });
        }
        if (fields) {
            window.DB.fields = {};
            (Array.isArray(fields) ? fields : Object.values(fields)).forEach(f => { if (f && f.id) window.DB.fields[String(f.id)] = f; });
        }
        if (links) {
            window.DB.links = {};
            (Array.isArray(links) ? links : Object.values(links)).forEach(l => { if (l && l.id) window.DB.links[String(l.id)] = l; });
        }
        if (categories) {
            window.DB.categories = {};
            (Array.isArray(categories) ? categories : Object.values(categories)).forEach(c => { if (c && c.id) window.DB.categories[String(c.id)] = c; });
        }
        if (cardSpecials) {
            window.DB.cardSpecials = Array.isArray(cardSpecials) ? cardSpecials : Object.values(cardSpecials);
        }
        if (specials) {
            window.DB.specials = {};
            (Array.isArray(specials) ? specials : Object.values(specials)).forEach(s => { if (s && s.id) window.DB.specials[String(s.id)] = s; });
        }
        if (specialViews) {
            window.DB.specialViews = {};
            (Array.isArray(specialViews) ? specialViews : Object.values(specialViews)).forEach(sv => { if (sv && sv.id) window.DB.specialViews[String(sv.id)] = sv; });
        }

        return window.DB;
    } catch (err) {
        console.warn("Could not load Dokkan JSON database:", err);
        return window.DB;
    }
}

/**
 * Helper to get class (super/extreme) and type (agl/teq/int/str/phy) from element ID
 */
function parseElement(elem) {
    const el = parseInt(elem, 10);
    if (isNaN(el)) return { cardClass: 'super', cardType: 'agl' };
    const classNum = Math.floor(el / 10);
    const typeNum = el % 10;
    const types = ['agl', 'teq', 'int', 'str', 'phy'];
    const cardType = types[typeNum] || 'agl';
    const cardClass = classNum === 1 ? 'extreme' : 'super';
    return { cardClass, cardType };
}

/**
 * Extracts title and name from raw card string e.g. "【Title】Name" or leader skill name
 */
function parseTitleAndName(card) {
    if (!card) return { title: "", name: "" };
    const rawName = card.name || "";
    const titleMatch = rawName.match(/[【\[](.*?)[】\]]/);
    let title = titleMatch ? titleMatch[1].trim() : (card.title || "");
    let cleanName = rawName.replace(/[【\[].*?[】\]]/g, '').trim();

    if (!title) {
        const leadId = card.lead_id || card.leader_skill_set_id || card.leader_skill_id || card.leader_id;
        if (leadId && window.DB && window.DB.leaders) {
            const lObj = window.DB.leaders[String(leadId)] || window.DB.leaders[leadId];
            if (lObj && lObj.name && lObj.name !== 'None') {
                title = lObj.name;
            }
        }
        if (!title && typeof findLeaderObj === 'function') {
            const lObj = findLeaderObj(card);
            if (lObj && lObj.name && lObj.name !== 'None') {
                title = lObj.name;
            }
        }
    }
    return { title: title || "", name: cleanName || rawName };
}

// Exchange forms do not always follow the simple 4xxxxxx -> 1xxxxxx ID
// pattern. Their database parent is the reliable source for shared art.
function getOfficialParentFolderId(card) {
    const rawId = parseInt(card?.id, 10) || 0;
    const ownFolderId = Math.floor(rawId / 10) * 10;
    const isTransformed = rawId >= 4000000 && rawId < 5000000;
    if (!isTransformed) return ownFolderId;

    const parentId = parseInt(card?.parent_id, 10) || 0;
    if (parentId > 0 && parentId !== rawId) return Math.floor(parentId / 10) * 10;

    // Kept only for older/incomplete database entries that do not provide a parent.
    return Math.floor((1000000 + (rawId % 1000000)) / 10) * 10;
}

/**
 * Fetch custom cards from ABS GitHub repository with caching
 */
async function fetchCustomCardsList() {
    const cached = localStorage.getItem('hub_cached_custom_only');
    let customCards = [];
    if (cached) {
        try { customCards = JSON.parse(cached); } catch (e) {}
    }

    try {
        const repoRes = await fetch('https://api.github.com/repos/abscustom/abscustom.github.io/contents/');
        if (!repoRes.ok) return customCards;

        const contents = await repoRes.json();
        const ignored = ['DokkanCustom', 'CardEditor', 'images', 'css', 'js', 'js2', 'assets', 'json', '.github', 'js-calc', 'js3'];
        const cardFolders = contents.filter(item => item.type === 'dir' && !ignored.includes(item.name) && !item.name.startsWith('.'));

        const freshCards = [];
        for (const folder of cardFolders) {
            try {
                const folderName = folder.name;
                const cardUrl = `https://abscustom.github.io/${folderName}/`;
                const rawUrl = `https://raw.githubusercontent.com/abscustom/abscustom.github.io/main/${folderName}/index.html`;

                const indexRes = await fetch(rawUrl);
                if (!indexRes.ok) continue;

                const htmlText = await indexRes.text();
                const doc = new DOMParser().parseFromString(htmlText, 'text/html');

                let charName = doc.querySelector('#char-name, #abs-char-name')?.textContent?.trim() || '';
                if (!charName) {
                    const rawTitle = doc.querySelector('title')?.textContent || folderName;
                    charName = rawTitle.replace(/^\[.*?\]\s*/, '').trim();
                }
                const charTitle = doc.querySelector('#char-description, #abs-char-title')?.textContent?.trim() || '';

                const frameAttr = doc.querySelector('.card-frame, #abs-frame-img')?.getAttribute('src') || 'frame_agl.png';
                let cardType = 'agl';
                if (frameAttr.includes('teq')) cardType = 'teq';
                else if (frameAttr.includes('int')) cardType = 'int';
                else if (frameAttr.includes('str')) cardType = 'str';
                else if (frameAttr.includes('phy')) cardType = 'phy';

                const lrIcon = doc.querySelector('#img-lr');
                const isLR = !!lrIcon || htmlText.toLowerCase().includes('rarity_lr');
                const rarity = isLR ? 'LR' : 'TUR';

                const iconEl = doc.querySelector(isLR ? '#img-lr' : '#img-tur') || doc.querySelector('#abs-thumb-img, .thumb-img');
                const fixUrl = (src) => src?.startsWith('http') ? src : `${cardUrl}${src?.replace(/^\.\//, '')}`;
                const thumbUrl = fixUrl(iconEl?.getAttribute('src'));

                freshCards.push({
                    id: folderName,
                    name: charName,
                    title: charTitle,
                    source: 'custom',
                    cardUrl: cardUrl,
                    thumbUrl: thumbUrl,
                    type: cardType,
                    rarity: rarity,
                    cardClass: 'super',
                    sortTime: Date.now(),
                    htmlText: htmlText
                });
            } catch (e) {}
        }

        if (freshCards.length > 0) {
            try { localStorage.setItem('hub_cached_custom_only', JSON.stringify(freshCards)); } catch(e) {}
            return freshCards;
        }
        return customCards;
    } catch (e) {
        return customCards;
    }
}

/**
 * Initializes the list of searchable cards
 */
async function initImporterDatabase() {
    await ensureDokkanDatabase();

    const officialCards = [];
    const rawCards = window.DB.cards || [];

    const excludedNames = ["則巻アラレ", "arale norimaki", "illustration"];
    
    const ezaMap = new Set();
    const sezaMap = new Set();

    if (Array.isArray(window.DB.optimalAwakeningGrowths)) {
        window.DB.optimalAwakeningGrowths.forEach(g => {
            const cid = parseInt(g.card_id, 10);
            if (g.optimal_awakening_grow_type === 1) ezaMap.add(cid);
            if (g.optimal_awakening_grow_type === 2) { sezaMap.add(cid); ezaMap.add(cid); }
        });
    }

    if (Array.isArray(window.DB.awakeningRoutes)) {
        window.DB.awakeningRoutes.forEach(r => {
            const cid = parseInt(r.card_id, 10);
            if (r.optimal_awakening_type === 1 || String(r.type || '').includes('Optimal')) ezaMap.add(cid);
            if (r.optimal_awakening_type === 2) { sezaMap.add(cid); ezaMap.add(cid); }
        });
    }

    rawCards.forEach(c => {
        const rawId = parseInt(c.id, 10);
        if (String(rawId).length >= 8) return;

        const cName = (c.name || '').toLowerCase();
        if (excludedNames.some(ex => cName.includes(ex))) return;

        const isTrans = rawId >= 4000000 && rawId < 5000000;
        const parentId = c.parent_id || (isTrans ? (1000000 + (rawId % 1000000)) : rawId);
        const { cardClass, cardType } = parseElement(c.element !== undefined ? c.element : c.attribute);
        const titleObj = parseTitleAndName(c);

        const isLR = (c.rarity === 5 || c.rarity === 'lr' || c.max_level === 150 || c.cost === 77 || c.cost === 99);
        const isTUR = !isLR && (c.rarity === 4 || c.max_level >= 120 || c.cost >= 40);
        const rarityKey = isLR ? 'LR' : (isTUR ? 'TUR' : 'SSR');

        const hasSeza = sezaMap.has(rawId) || sezaMap.has(parentId) || c.is_seza === true;
        const hasEza = ezaMap.has(rawId) || ezaMap.has(parentId) || hasSeza || c.is_eza === true;

        officialCards.push({
            id: c.id,
            parentId: parentId,
            name: titleObj.name || (isTrans ? "(Transformed)" : "Dokkan Unit"),
            title: titleObj.title || "",
            source: 'official',
            type: cardType,
            rarity: rarityKey,
            cardClass: cardClass,
            sortTime: parseInt(parentId, 10) || parseInt(c.id, 10) || 0,
            isTransformed: isTrans,
            isEza: hasEza,
            isSeza: hasSeza,
            rawCard: c
        });
    });

    const customCards = await fetchCustomCardsList();
    const merged = [...customCards, ...officialCards];

    merged.sort((a, b) => {
        if (a.source === 'custom' && b.source !== 'custom') return -1;
        if (b.source === 'custom' && a.source !== 'custom') return 1;
        return (parseInt(b.parentId || b.id, 10) || 0) - (parseInt(a.parentId || a.id, 10) || 0);
    });

    allImporterCards = merged;
    filteredImporterCards = merged;
    isImporterDbLoaded = true;
}

/**
 * Open Character Importer Modal
 */
window.openCharacterImporterModal = async function() {
    const modal = document.getElementById('character-importer-modal');
    if (!modal) return;

    modal.style.display = 'flex';
    const grid = document.getElementById('importerGrid');
    if (grid && allImporterCards.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1/-1; padding: 40px; color: #38bdf8; font-weight: 800; text-align: center;"><svg class="spinner-svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" style="display:inline-block; vertical-align:-3px; margin-right:6px; animation: spin 1s linear infinite;"><circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle><path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"></path></svg>Ingesting Dokkan Database...</div>`;
    }

    if (!isImporterDbLoaded) {
        await initImporterDatabase();
    }
    window.filterImporterCards();
};

/**
 * Close Character Importer Modal
 */
window.closeCharacterImporterModal = function(e) {
    if (e && e.target && e.target.closest('.calc-unit-picker-dialog') && !e.target.closest('.calc-picker-close-btn')) {
        return;
    }
    const modal = document.getElementById('character-importer-modal');
    if (modal) modal.style.display = 'none';
};

window.closeImporterVariantModal = function(e) {
    if (e && e.target && e.target.closest('.calc-unit-picker-dialog') && !e.target.closest('.calc-picker-close-btn')) {
        return;
    }
    const modal = document.getElementById('importer-variant-modal');
    if (modal) modal.style.display = 'none';
};

/**
 * Source filter: all, official, custom
 */
window.setImporterSource = function(src) {
    currentImporterSource = src;
    ['all', 'official', 'custom'].forEach(s => {
        const btn = document.getElementById(`importer-src-${s}`);
        if (btn) btn.classList.toggle('active', s === src);
    });
    window.filterImporterCards();
};

/**
 * Typing filter: all, agl, teq, int, str, phy
 */
window.setImporterType = function(type) {
    currentImporterType = type;
    ['all', 'agl', 'teq', 'int', 'str', 'phy'].forEach(t => {
        const btn = document.getElementById(`importer-type-${t}`);
        if (btn) btn.classList.toggle('active', t === type);
    });
    window.filterImporterCards();
};

/**
 * Rarity filter: all, LR, TUR, SSR
 */
window.setImporterRarity = function(rarity) {
    currentImporterRarity = rarity;
    ['all', 'lr', 'tur', 'ssr'].forEach(r => {
        const btn = document.getElementById(`importer-rarity-${r}`);
        if (btn) btn.classList.toggle('active', r.toLowerCase() === rarity.toLowerCase());
    });
    window.filterImporterCards();
};

/**
 * Search query handler
 */
window.handleImporterSearch = function(val) {
    importerSearchQuery = (val || '').trim().toLowerCase();
    window.filterImporterCards();
};

/**
 * Global thumb error fallback (loop-protected)
 */
window.handleHubThumbError = function(img, folderId, parentFolderId) {
    if (!img) return;
    img.onerror = null;
    const cleanFolder = Math.floor(parseInt(folderId || '0', 10) / 10) * 10;
    if (cleanFolder > 0) {
        img.src = `https://images.weserv.nl/?url=dokkaninfo.com/assets/japan/character/thumb/card_${cleanFolder}_thumb/card_${cleanFolder}_thumb.png`;
        img.onerror = function() {
            this.onerror = null;
            if (parentFolderId && String(parentFolderId) !== String(folderId)) {
                const cleanParent = Math.floor(parseInt(parentFolderId, 10) / 10) * 10;
                this.src = `https://images.weserv.nl/?url=dokkaninfo.com/assets/japan/character/thumb/card_${cleanParent}_thumb/card_${cleanParent}_thumb.png`;
                this.onerror = function() {
                    this.onerror = null;
                    this.src = `${window.CENTRAL_ASSET_URL}SSR_Icon.png`;
                };
            } else {
                this.src = `${window.CENTRAL_ASSET_URL}SSR_Icon.png`;
            }
        };
    } else {
        img.src = `${window.CENTRAL_ASSET_URL}SSR_Icon.png`;
    }
};

window.currentEditorArtMode = 'animated';

/**
 * Toggle between Static/Simple art and FX/Animated layered art
 */
window.switchEditorArtMode = function(mode) {
    window.currentEditorArtMode = mode;
    const isAnim = (mode === 'animated');

    const btnStatic = document.getElementById('art-toggle-static');
    const btnAnim = document.getElementById('art-toggle-animated');
    if (btnStatic) btnStatic.classList.toggle('active', !isAnim);
    if (btnAnim) btnAnim.classList.toggle('active', isAnim);

    const artBox = document.getElementById('abs-art-layers-container');
    if (artBox) {
        artBox.classList.toggle('static-mode', !isAnim);
        artBox.classList.toggle('animated-mode', isAnim);
    }

    const bgEl = document.getElementById('abs-art-bg');
    const charEl = document.getElementById('abs-art-char');
    const effEl = document.getElementById('abs-art-effect');
    const singleArtEl = document.getElementById('abs-art-img');
    const singleVidEl = document.getElementById('abs-art-video');
    const mainVid = document.getElementById('myOverlayVideo');
    const lwfCanvas = document.getElementById('abs-card-bg-lwf-canvas');
    const stickerCanvas = document.getElementById('abs-tur-sticker-canvas');

    const hasMultiLayer = (bgEl && bgEl.src && !bgEl.src.endsWith('none') && !bgEl.src.endsWith('/') && !bgEl.src.endsWith('editor.html') && !bgEl.dataset.failed) ||
                          (charEl && charEl.src && !charEl.src.endsWith('none') && !charEl.src.endsWith('/') && !charEl.src.endsWith('editor.html') && !charEl.dataset.failed);

    const hasVideo = singleVidEl && singleVidEl.src && !singleVidEl.src.endsWith('/') && !singleVidEl.src.endsWith('editor.html') && singleVidEl.src !== window.location.href;

    if (isAnim) {
        if (hasMultiLayer) {
            if (bgEl && bgEl.src && !bgEl.src.endsWith('/') && !bgEl.dataset.failed) bgEl.style.display = 'block';
            if (charEl && charEl.src && !charEl.src.endsWith('/') && !charEl.dataset.failed) charEl.style.display = 'block';
            if (effEl && effEl.src && !effEl.src.endsWith('/') && !effEl.dataset.failed) effEl.style.display = 'block';
            if (lwfCanvas && lwfCanvas.classList.contains('lwf-active')) lwfCanvas.style.display = 'block';
            if (stickerCanvas && stickerCanvas.classList.contains('sticker-active')) stickerCanvas.style.display = 'block';
            if (singleArtEl) singleArtEl.style.display = 'none';
            if (singleVidEl) singleVidEl.style.display = 'none';
        } else if (hasVideo) {
            if (bgEl) bgEl.style.display = 'none';
            if (charEl) charEl.style.display = 'none';
            if (effEl) effEl.style.display = 'none';
            if (singleArtEl) singleArtEl.style.display = 'none';
            if (singleVidEl) {
                singleVidEl.style.display = 'block';
                singleVidEl.play().catch(()=>{});
            }
            if (mainVid && mainVid.querySelector('source')?.src) {
                mainVid.play().catch(()=>{});
            }
        } else {
            if (bgEl) bgEl.style.display = 'none';
            if (charEl) charEl.style.display = 'none';
            if (effEl) effEl.style.display = 'none';
            if (singleVidEl) singleVidEl.style.display = 'none';
            if (singleArtEl) singleArtEl.style.display = 'block';
        }
    } else {
        // STATIC / SIMPLE MODE: Freeze video to first frame, or show character layer
        if (hasMultiLayer) {
            if (bgEl) bgEl.style.display = 'none';
            if (effEl) effEl.style.display = 'none';
            if (lwfCanvas) lwfCanvas.style.display = 'none';
            if (stickerCanvas) stickerCanvas.style.display = 'none';
            if (charEl && charEl.src && !charEl.src.endsWith('/') && !charEl.dataset.failed) {
                charEl.style.display = 'block';
            }
            if (singleArtEl) singleArtEl.style.display = 'none';
            if (singleVidEl) singleVidEl.style.display = 'none';
        } else if (hasVideo) {
            if (bgEl) bgEl.style.display = 'none';
            if (charEl) charEl.style.display = 'none';
            if (effEl) effEl.style.display = 'none';
            if (singleArtEl) singleArtEl.style.display = 'none';
            if (singleVidEl) {
                singleVidEl.style.display = 'block';
                singleVidEl.currentTime = 0;
                singleVidEl.pause();
            }
            if (mainVid && mainVid.querySelector('source')?.src) {
                mainVid.currentTime = 0;
                mainVid.pause();
            }
        } else {
            if (bgEl) bgEl.style.display = 'none';
            if (charEl) charEl.style.display = 'none';
            if (effEl) effEl.style.display = 'none';
            if (singleVidEl) singleVidEl.style.display = 'none';
            if (singleArtEl) singleArtEl.style.display = 'block';
        }
    }
};


/**
 * Filter cards based on source, typing, rarity, and search text
 */
window.filterImporterCards = function() {
    filteredImporterCards = allImporterCards.filter(c => {
        if (currentImporterSource !== 'all' && c.source !== currentImporterSource) return false;
        if (currentImporterType !== 'all' && (c.type || '').toLowerCase() !== currentImporterType.toLowerCase()) return false;
        if (currentImporterRarity !== 'all' && (c.rarity || '').toUpperCase() !== currentImporterRarity.toUpperCase()) return false;

        if (importerSearchQuery) {
            const matchName = (c.name || '').toLowerCase().includes(importerSearchQuery);
            const matchTitle = (c.title || '').toLowerCase().includes(importerSearchQuery);
            const matchId = String(c.id || '').toLowerCase().includes(importerSearchQuery);
            if (!matchName && !matchTitle && !matchId) return false;
        }

        return true;
    });

    window.renderImporterGrid();
};

/**
 * Render card grid in modal
 */
window.renderImporterGrid = function() {
    const grid = document.getElementById('importerGrid');
    if (!grid) return;

    if (filteredImporterCards.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1/-1; padding: 40px; color: #94a3b8; font-weight: 800; text-align: center;">No characters found matching criteria.</div>`;
        return;
    }

    const renderList = filteredImporterCards.slice(0, 250);

    grid.innerHTML = renderList.map((c, i) => {
        const rawId = parseInt(c.id, 10);
        const folderId = Math.floor(rawId / 10) * 10;
        const isTrans = rawId >= 4000000 && rawId < 5000000;
        const parentFolderId = getOfficialParentFolderId(c.rawCard || c);

        const frameSrc = `${window.CENTRAL_ASSET_URL}frame_${c.type || 'agl'}.png`;
        const thumbUrl = c.thumbUrl || `https://images.weserv.nl/?url=dokkaninfo.com/assets/japan/character/thumb/card_${folderId}_thumb/card_${folderId}_thumb.png`;

        const transBadge = c.isTransformed ? `<span style="position: absolute; top: -3px; left: -3px; background: linear-gradient(135deg, #a855f7 0%, #7e22ce 100%); color: #fff; font-size: 7.5px; font-weight: 900; padding: 1px 4px; border-radius: 3px; z-index: 10;">FORM</span>` : '';
        const customBadge = c.source === 'custom' ? `<span style="position: absolute; bottom: -3px; left: -3px; background: linear-gradient(135deg, #0ea5e9 0%, #0369a1 100%); color: #fff; font-size: 7px; font-weight: 900; padding: 1px 4px; border-radius: 3px; z-index: 10;">CUSTOM</span>` : '';
        const sezaBadge = c.isSeza ? `<span style="position: absolute; top: -3px; right: -3px; background: linear-gradient(135deg, #f43f5e 0%, #e11d48 100%); color: #fff; font-size: 7px; font-weight: 900; padding: 1px 4px; border-radius: 3px; z-index: 10;">SEZA</span>` : (c.isEza ? `<span style="position: absolute; top: -3px; right: -3px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #fff; font-size: 7px; font-weight: 900; padding: 1px 4px; border-radius: 3px; z-index: 10;">EZA</span>` : '');

        const typeKey = (c.type || 'agl').toLowerCase();
        const typeClass = `picker-type-${typeKey}`;

        return `
        <div class="picker-unit-card ${typeClass}" data-type="${typeKey}" onclick="window.selectUnitForImport(${i})">
            <div class="picker-thumb-wrapper">
                ${transBadge}
                ${customBadge}
                ${sezaBadge}
                <img class="picker-frame" src="${frameSrc}" loading="lazy">
                <img class="picker-thumb" src="${thumbUrl}" loading="lazy" onerror="window.handleHubThumbError(this, '${folderId}', '${parentFolderId}')">
            </div>
            <span class="picker-name" title="${c.name}">${c.name}</span>
            <span class="picker-sub">${c.rarity} • ${typeKey.toUpperCase()}</span>
        </div>`;
    }).join('\n');
};

/**
 * Trigger sync of database
 */
window.syncImporterDatabase = async function() {
    const icon = document.getElementById('importer-sync-icon');
    const text = document.getElementById('importer-sync-text');
    if (icon) icon.style.animation = 'spin 1s linear infinite';
    if (text) text.innerText = 'Syncing...';

    try {
        localStorage.removeItem('hub_cached_custom_only');
        isImporterDbLoaded = false;
        await initImporterDatabase();
        window.filterImporterCards();
    } catch (e) {
        console.error("Importer sync failed:", e);
    } finally {
        if (icon) icon.style.animation = 'none';
        if (text) text.innerText = 'Sync';
    }
};

/**
 * When a user selects a card from the grid
 */
window.selectUnitForImport = function(index) {
    const cardItem = filteredImporterCards[index];
    if (!cardItem) return;

    if (cardItem.source === 'custom') {
        window.closeCharacterImporterModal();
        window.executeCustomCardImport(cardItem);
        return;
    }

    const hasVariants = cardItem.isEza || cardItem.isSeza;

    if (hasVariants) {
        window.openVariantSelectionModal(cardItem);
    } else {
        window.closeCharacterImporterModal();
        window.executeOfficialCardImport(cardItem, 'none');
    }
};

/**
 * Open variant modal (Base vs EZA vs SEZA)
 */
window.openVariantSelectionModal = function(cardItem) {
    const modal = document.getElementById('importer-variant-modal');
    const titleEl = document.getElementById('importer-variant-title');
    const optionsCont = document.getElementById('importerVariantOptions');
    if (!modal || !optionsCont || !cardItem) return;

    window.currentVariantSelectedCard = cardItem;

    if (titleEl) titleEl.textContent = `Import Options: ${cardItem.name}`;

    let html = `
        <button type="button" class="importer-variant-btn" onclick="window.closeImporterVariantModal(); window.closeCharacterImporterModal(); window.executeOfficialCardImport(window.currentVariantSelectedCard, 'none');">
            <div>
                <strong style="color: #38bdf8; font-size: 13px;"><svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style="display:inline-block; vertical-align:-2px; margin-right:4px;"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>Standard Base Kit</strong>
                <div style="font-size: 11px; color: #94a3b8;">Original card stats, leader, passive, and Super Attacks.</div>
            </div>
            <span style="font-size: 18px;">➔</span>
        </button>
    `;

    if (cardItem.isEza) {
        html += `
            <button type="button" class="importer-variant-btn" style="border-color: rgba(245, 158, 11, 0.5);" onclick="window.closeImporterVariantModal(); window.closeCharacterImporterModal(); window.executeOfficialCardImport(window.currentVariantSelectedCard, 'eza');">
                <div>
                    <strong style="color: #facc15; font-size: 13px;"><svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style="display:inline-block; vertical-align:-2px; margin-right:4px;"><path d="M19.48 12.35c-1.57-.56-2.83-1.62-3.32-3.08-.24-.71-.34-1.44-.34-2.17 0-.58.07-1.15.2-1.7-.84.28-1.58.78-2.18 1.44-1.28 1.42-1.74 3.42-1.18 5.25.04.14.07.28.09.42-1.39-1.26-1.92-3.21-1.3-5.02.04-.12.08-.23.12-.35-.74.37-1.39.91-1.89 1.57C8.16 11.69 8 13.33 8.23 15c.34 2.5 2.11 4.54 4.54 5.23 3.65 1.04 7.23-1.34 7.23-4.88 0-1.1-.38-2.12-1.02-2.93l.5-.07z"/></svg>Extreme Z-Awakened (EZA)</strong>
                    <div style="font-size: 11px; color: #94a3b8;">Extreme Z-Awakened stats, Extreme passive, and Extreme SA.</div>
                </div>
                <span style="font-size: 18px;">➔</span>
            </button>
        `;
    }

    if (cardItem.isSeza) {
        html += `
            <button type="button" class="importer-variant-btn" style="border-color: rgba(244, 63, 94, 0.5);" onclick="window.closeImporterVariantModal(); window.closeCharacterImporterModal(); window.executeOfficialCardImport(window.currentVariantSelectedCard, 'seza');">
                <div>
                    <strong style="color: #f43f5e; font-size: 13px;"><svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style="display:inline-block; vertical-align:-2px; margin-right:4px;"><path d="M7 2v11h3v9l7-12h-4l4-8z"/></svg>Super Extreme Z-Awakened (SEZA)</strong>
                    <div style="font-size: 11px; color: #94a3b8;">Super Extreme Z-Awakened stats, Super Extreme passive, and Super EZA laser.</div>
                </div>
                <span style="font-size: 18px;">➔</span>
            </button>
        `;
    }

    optionsCont.innerHTML = html;
    modal.style.display = 'flex';
};

/**
 * Execute Official Card Ingestion into Editor (No manual icon popup gimmick)
 */
window.executeOfficialCardImport = async function(cardItem, awakeningMode = 'none') {
    if (!cardItem || !cardItem.rawCard) return;

    // Keep the published-card action appropriate for cards imported from the official database.
    window.currentCardSource = 'official';

    // Reset editor to pristine clean slate
    if (typeof window.clearEditorForCleanImport === 'function') {
        window.clearEditorForCleanImport();
    }

    // Suppress and close any manual icon picker popup
    const iconModal = document.getElementById('icon-picker-modal');
    if (iconModal) iconModal.style.display = 'none';

    const raw = cardItem.rawCard;
    const rawId = parseInt(raw.id, 10);
    const folderId = Math.floor(rawId / 10) * 10;
    const isTrans = rawId >= 4000000 && rawId < 5000000;
    const parentFolderId = getOfficialParentFolderId(raw);
    const bgFolderId = isTrans ? parentFolderId : folderId;

    const isEZA = awakeningMode === 'eza' || awakeningMode === 'seza';
    const isSEZA = awakeningMode === 'seza';

    // 1. IDENTITY & METADATA
    const titleObj = parseTitleAndName(raw);
    const titleInput = document.getElementById('descInput');
    const nameInput = document.getElementById('nameInput');
    const dateInput = document.getElementById('dateInput');
    const ezaDateInput = document.getElementById('ezaDateInput');
    const sezaDateInput = document.getElementById('sezaDateInput');

    if (titleInput) titleInput.value = titleObj.title || "";
    if (nameInput) nameInput.value = titleObj.name || "";
    
    // Resolve exact release dates
    let exactBaseDate = raw.release_date || raw.open_at || "";
    let exactEzaDate = raw.eza_date || "";
    let exactSezaDate = raw.seza_date || "";

    if (typeof getCardExactReleaseDate === 'function') {
        exactBaseDate = getCardExactReleaseDate(raw, 'base');
        exactEzaDate = getCardExactReleaseDate(raw, 'eza');
        exactSezaDate = getCardExactReleaseDate(raw, 'seza');
    }

    if (dateInput) dateInput.value = exactBaseDate || "";
    if (ezaDateInput && isEZA) ezaDateInput.value = exactEzaDate || "";
    if (sezaDateInput && isSEZA) sezaDateInput.value = exactSezaDate || "";

    // Typing, Class, Rarity
    const { cardClass, cardType } = parseElement(raw.element !== undefined ? raw.element : raw.attribute);
    window.currentClass = cardClass;
    window.currentType = cardType;
    window.currentRarity = cardItem.rarity || 'TUR';
    window.currentAwakeningMode = awakeningMode;

    if (window.applyCardTheme) window.applyCardTheme(cardType);
    if (window.updateRarityStats) window.updateRarityStats(window.currentRarity);
    if (window.updateIconImages) window.updateIconImages();
    if (window.applyAwakening) window.applyAwakening(awakeningMode);

    // 2. BASE STATS & EZA/SEZA STATS
    let hpMax = raw.hp || raw.hp_max || raw.stat_hp_max || raw.hp_init || 10000;
    let atkMax = raw.atk || raw.atk_max || raw.stat_atk_max || raw.atk_init || 10000;
    let defMax = raw.def || raw.def_max || raw.stat_def_max || raw.def_init || 5000;

    if (isEZA && window.DB && Array.isArray(window.DB.optimalAwakeningGrowths)) {
        const targetGrowType = isSEZA ? 2 : 1;
        const growth = window.DB.optimalAwakeningGrowths.find(g => (parseInt(g.card_id, 10) === rawId || parseInt(g.card_id, 10) === bgFolderId) && g.optimal_awakening_grow_type === targetGrowType);
        if (growth) {
            if (growth.hp_max) hpMax = growth.hp_max;
            if (growth.atk_max) atkMax = growth.atk_max;
            if (growth.def_max) defMax = growth.def_max;
        }
    }

    const inpHpMax = document.getElementById('input-hp-max');
    const inpAtkMax = document.getElementById('input-atk-max');
    const inpDefMax = document.getElementById('input-def-max');

    if (inpHpMax) inpHpMax.value = hpMax;
    if (inpAtkMax) inpAtkMax.value = atkMax;
    if (inpDefMax) inpDefMax.value = defMax;

    if (window.calcFromMax) {
        window.calcFromMax('hp', raw.hp_init || Math.round(hpMax / 3.3));
        window.calcFromMax('atk', raw.atk_init || Math.round(atkMax / 3.3));
        window.calcFromMax('def', raw.def_init || Math.round(defMax / 3.3));
    }
    if (window.updateAbsStatDisplay) {
        window.updateAbsStatDisplay(window.currentAbsStatPct || '100%');
    }

    // 3. LEADER SKILL (Clean intra-sentence newlines and apply Card Viewer formatting)
    let leaderObj = (typeof findLeaderObj === 'function') ? findLeaderObj(raw, awakeningMode) : null;
    let rawLeader = leaderObj ? (leaderObj.description || leaderObj.effect || leaderObj.itemized_description || leaderObj.details) : (raw.leader_skill || "");
    const cleanLeader = rawLeader.replace(/[\r\n]+/g, ' ').trim();

    const leaderInput = document.getElementById('leaderInput');
    if (leaderInput) leaderInput.value = cleanLeader;
    
    const formattedLeaderInfo = (typeof formatOfficialText === 'function') ? formatOfficialText(cleanLeader, false) : cleanLeader;
    const formattedLeaderAbs = (typeof formatOfficialText === 'function') ? formatOfficialText(cleanLeader, true) : (window.formatCategoryQuotes ? window.formatCategoryQuotes(cleanLeader) : cleanLeader);

    const leaderDisplay = document.getElementById('leader-skill');
    if (leaderDisplay) leaderDisplay.innerHTML = formattedLeaderInfo;
    const absLeader = document.getElementById('abs-leader-skill');
    if (absLeader) absLeader.innerHTML = formattedLeaderAbs;

    // 4. PASSIVE SKILL (Card Viewer parsed sections & official ability strip)
    let passiveObj = (typeof getCardPassiveObject === 'function') ? getCardPassiveObject(raw, awakeningMode) : null;
    let passName = passiveObj ? (passiveObj.name || raw.passive_name || "Passive Skill") : (raw.passive_name || "Passive Skill");
    passName = passName.replace(/\s*\(Super Extreme.*?\)$/i, '').replace(/\s*\(Extreme.*?\)$/i, '').trim();
    if (isSEZA) passName += " (Super Extreme)";
    else if (isEZA) passName += " (Extreme)";

    const passNameInput = document.getElementById('input-passive-name-sidebar');
    if (passNameInput) passNameInput.value = passName;
    const passNameDisp = document.querySelector('.passive-name-display');
    if (passNameDisp) passNameDisp.innerText = passName;

    document.querySelectorAll('#sidebar-sections-area [id^="side-sec-"]').forEach(sec => sec.remove());
    document.querySelectorAll('#card-passive-container [id^="card-sec-"]').forEach(sec => sec.remove());

    let rawPassiveText = passiveObj ? (passiveObj.itemized_description || passiveObj.description || "") : (raw.passive_skill || "");
    
    const cleanForSidebar = (str) => {
        if (!str) return "";
        return str
            .replace(/\{passiveImg:up_g\}/gi, ':up:')
            .replace(/\{passiveImg:down_r\}/gi, ':down:')
            .replace(/\{passiveImg:down_y\}/gi, ':ydown:')
            .replace(/\{passiveImg:once\}/gi, ':once:')
            .replace(/\{passiveImg:forever\}/gi, ':inf:')
            .replace(/\{passiveImg:inf\}/gi, ':inf:')
            .replace(/\{passiveImg:atk_down\}/gi, ':atk_down:')
            .replace(/\{passiveImg:def_down\}/gi, ':def_down:')
            .replace(/\{passiveImg:stun\}/gi, ':stun:')
            .replace(/\{passiveImg:seal\}/gi, ':seal:')
            .replace(/\{passiveImg:astute\}/gi, ':seal:')
            .replace(/\{passiveImg:break\}/gi, ':break:')
            .replace(/▲/g, ':up:')
            .replace(/▼/g, ':down:');
    };

    let cleanRaw = rawPassiveText.replace(/<br\s*\/?>/gi, '\n');
    let parts = cleanRaw.split(/\*([^*]+)\*/g);
    let sectionCount = 0;

    const addSectionToDom = (header, bullets) => {
        if (bullets.length === 0) return;
        if (window.addNewSection) window.addNewSection();
        const secs = document.querySelectorAll('#sidebar-sections-area [id^="side-sec-"]');
        const lastSec = secs[secs.length - 1];
        if (lastSec) {
            const sid = lastSec.id.replace('side-sec-', '');
            const textVal = bullets.map(b => `- ${cleanForSidebar(b)}`).join('\n');
            const cleanHeader = cleanForSidebar(header || "Basic effect(s)");
            if (window.updateHeader) window.updateHeader(sid, cleanHeader);
            if (window.updateSection) window.updateSection(sid, textVal);
            const headInp = lastSec.querySelector('input[type="text"]');
            const bodyTa = lastSec.querySelector('textarea');
            if (headInp) headInp.value = cleanHeader;
            if (bodyTa) bodyTa.value = textVal;
        }
        sectionCount++;
    };

    let curHeader = "Basic effect(s)";
    let curBullets = [];

    for (let i = 0; i < parts.length; i++) {
        let chunk = parts[i].trim();
        if (!chunk) continue;

        if (i % 2 === 1) {
            if (curBullets.length > 0) {
                addSectionToDom(curHeader, curBullets);
                curBullets = [];
            }
            curHeader = chunk;
        } else {
            let lines = chunk.split('\n').map(l => l.trim()).filter(Boolean);
            lines.forEach(line => {
                let cleanLine = line.replace(/^-/, '').trim();
                if (cleanLine) {
                    if (line.startsWith('-')) {
                        curBullets.push(cleanLine);
                    } else if (curBullets.length > 0) {
                        curBullets[curBullets.length - 1] += ' ' + cleanLine;
                    } else {
                        curBullets.push(cleanLine);
                    }
                }
            });
        }
    }
    if (curBullets.length > 0) {
        addSectionToDom(curHeader, curBullets);
    }
    if (sectionCount === 0 && rawPassiveText.trim()) {
        addSectionToDom("Basic effect(s)", [rawPassiveText.trim()]);
    }

    // Render passive skill on ABS side using Card Viewer's parsePassiveSections
    const absPassCont = document.getElementById("abs-passive-container");
    if (absPassCont) {
        if (typeof parsePassiveSections === 'function') {
            absPassCont.innerHTML = parsePassiveSections(rawPassiveText);
        }
    }
    const absPassNameEl = document.getElementById("abs-passive-name");
    if (absPassNameEl) {
        const stripHtml = (typeof renderPassiveIconsStrip === 'function') ? renderPassiveIconsStrip(rawPassiveText, raw) : "";
        absPassNameEl.innerHTML = `
            <div class="abs-passive-header-title">
                <span>Passive Skill</span>
                <span class="mx-1">&ndash;</span>
                <i>${passName}</i>
            </div>
            ${stripHtml}
        `;
    }

    // 5. SUPER ATTACKS (EX Tag, Conditions Row, Multipliers, & Auto-Detected Stat Badges)
    document.querySelectorAll('.sa-block').forEach(b => b.remove());

    const isLRUnit = window.currentRarity === 'LR';
    const saList = Array.isArray(raw.super_attacks) && raw.super_attacks.length > 0 ? raw.super_attacks : [];
    const saCount = isLRUnit ? Math.max(2, saList.length) : Math.max(1, saList.length);

    for (let s = 0; s < saCount; s++) {
        if (window.addSuperAttackSection) window.addSuperAttackSection();
        const blocks = document.querySelectorAll('.sa-block');
        const currentSaBlock = blocks[blocks.length - 1];
        if (currentSaBlock) {
            const isUltra = (s === 1);
            const saItem = saList[s] || {};
            const saNameEl = currentSaBlock.querySelector('.sa-display-name');
            const saTypeEl = currentSaBlock.querySelector('.sa-type-label');
            const saEffectsEl = currentSaBlock.querySelector('.sa-display-effects-list');
            const statCont = currentSaBlock.querySelector('.stats-container');
            const actRow = currentSaBlock.querySelector('.activation-row');
            const actText = currentSaBlock.querySelector('.activation-text');
            const saIconImg = currentSaBlock.querySelector('.sa-display-icon');

            let saName = saItem.name || raw.sa_name || (isUltra ? "Ultra Super Attack" : "Super Attack");
            saName = saName.replace(/\s*\((?:super )?extreme.*?\)/ig, '').trim();
            if (isSEZA) saName += " (Super Extreme)";
            else if (isEZA) saName += " (Extreme)";

            const saKi = isUltra ? "18 Ki" : (saItem.eball_num_start ? `${saItem.eball_num_start} Ki` : "12 Ki");
            const rawDesc = saItem.description || (isUltra ? (raw.ultra_sa_description || raw.sa_description) : raw.sa_description) || "Causes damage to enemy and raises ATK & DEF";
            const cleanDesc = rawDesc.replace(/[\r\n]+/g, ' ').trim();

            let rawCond = saItem.condition || saItem.activation_condition || saItem.causality_description || "";
            if (rawCond.toLowerCase().includes("power will be increased") || rawCond.toLowerCase().includes("sa lv")) {
                rawCond = "";
            }
            const cleanCond = (typeof window.extractCleanConditionText === 'function')
                ? window.extractCleanConditionText(rawCond)
                : rawCond.replace(/^activation\s+conditions?(\(s\))?[\s:]*/i, '').replace(/[\r\n]+/g, ' ').trim();

            let typeLabel = saItem.type_label || saItem.category || saItem.type || "";
            const saNameLow = (saItem.name || '').toLowerCase();
            const saDescLow = (cleanDesc + ' ' + cleanCond).toLowerCase();
            const saTypeLow = String(typeLabel).toLowerCase();

            const isUnitSa = saItem.is_unit_sa === true || saTypeLow.includes("unit") || saNameLow.includes("unit") || /whose\s+name\s+includes|when\s+an?\s+ally/i.test(cleanCond);

            if (saItem.is_ex || saTypeLow.includes("ex") || saNameLow.includes("ex super") || saDescLow.includes("ex super")) {
                typeLabel = "EX Super Attack";
            } else if (isUnitSa && isUltra) {
                typeLabel = "Unit Ultra Super Attack";
            } else if (isUnitSa) {
                typeLabel = "Unit Super Attack";
            } else if (!typeLabel) {
                typeLabel = isUltra ? "Ultra Super Attack" : "Super Attack";
            }

            if (saNameEl) saNameEl.textContent = saName;
            if (saTypeEl) saTypeEl.textContent = typeLabel;
            currentSaBlock.setAttribute('data-ki', saKi);
            
            const saIconUrl = (typeof getSaIconUrl === 'function') ? getSaIconUrl(saItem, raw) : 'https://abscustom.github.io/assets/images/sp_skill_icon_01.png';
            if (saIconImg) saIconImg.src = saIconUrl;

            if (cleanCond && actRow && actText) {
                actRow.classList.remove('d-none');
                actText.innerHTML = `<strong>Activation Condition</strong><br>${cleanCond.replace(/\n/g, '<br>')}`;
            } else if (actRow && actText) {
                actRow.classList.add('d-none');
                actText.innerHTML = `<strong>Activation Condition</strong>`;
            }

            if (saEffectsEl) {
                const formattedEffect = (typeof formatOfficialText === 'function') ? formatOfficialText(cleanDesc, false) : cleanDesc;
                saEffectsEl.innerHTML = `<div class="row"><div class="col">${formattedEffect}</div></div>`;
            }

            // Generate stat effect badges using Card Viewer autoDetectSAStats
            if (statCont) {
                statCont.innerHTML = "";
                const autoStats = (typeof autoDetectSAStats === 'function') ? autoDetectSAStats(cleanDesc, saName, saItem) : [];
                if (autoStats.length > 0) {
                    autoStats.forEach(st => {
                        const badgeRow = document.createElement('div');
                        badgeRow.className = 'col sa-stat-row';
                        badgeRow.dataset.target = st.target || 'self';
                        badgeRow.dataset.turns = st.turns || '1 turn';
                        badgeRow.innerHTML = `
                            <img class="display-img" width="50" src="${st.icon}" alt="stat">
                            <span class="display-text ms-1">${st.value ? st.value + '%' : ''}</span>
                        `;
                        statCont.appendChild(badgeRow);
                    });
                }
            }
        }
    }

    if (window.refreshSADropdown) window.refreshSADropdown();
    if (typeof renderSuperAttacks === 'function') {
        renderSuperAttacks(raw, isEZA, awakeningMode);
    } else if (window.updateAbsStyleSuperAttacks) {
        window.updateAbsStyleSuperAttacks();
    }

    // 6. ACTIVE SKILL & DOMAIN / DOKKAN FIELD
    document.querySelectorAll('.active-block').forEach(a => a.remove());

    let activeObj = null;
    if (raw.active_id && window.DB && window.DB.actives) {
        activeObj = window.DB.actives[String(raw.active_id)] || window.DB.actives[raw.active_id];
    }
    if (!activeObj && window.DB && window.DB.actives) {
        const cidStr = String(raw.id);
        const folderIdStr = String(getCardFolderId(raw));
        const allActives = Array.isArray(window.DB.actives) ? window.DB.actives : Object.values(window.DB.actives);
        activeObj = allActives.find(a => {
            if (!a) return false;
            const aId = String(a.id || '');
            const cId = String(a.card_id || a.character_id || '');
            return cId === cidStr || aId === cidStr || (aId.length >= 7 && aId.startsWith(cidStr)) || (aId.length >= 7 && aId.startsWith(folderIdStr));
        });
    }

    if (activeObj) {
        if (window.addActiveSkillSection) window.addActiveSkillSection();
        const activeBlocks = document.querySelectorAll('.active-block');
        const activeBlock = activeBlocks[activeBlocks.length - 1];
        if (activeBlock) {
            const aType = activeBlock.querySelector('.active-type-label');
            const aName = activeBlock.querySelector('.active-display-name');
            const aCond = activeBlock.querySelector('.active-display-condition');
            const aEff = activeBlock.querySelector('.active-display-effect');
            const aIcon = activeBlock.querySelector('.active-display-icon');
            const condRow = activeBlock.querySelector('.active-condition-row');

            const typeVal = activeObj.type_label || "Active Skill";
            const titleVal = activeObj.name || "Active Skill";
            const rawCond = activeObj.condition_description || activeObj.condition || "";
            const rawEff = activeObj.effect_description || activeObj.description || activeObj.effect || activeObj.itemized_description || "";

            const condVal = String(rawCond).replace(/[\r\n]+/g, ' ').trim();
            const effVal = String(rawEff).replace(/[\r\n]+/g, ' ').trim();

            if (aType) aType.textContent = typeVal;
            if (aName) aName.textContent = titleVal;
            if (aCond) aCond.innerHTML = (typeof formatOfficialText === 'function') ? formatOfficialText(condVal, false) : condVal;
            if (aEff) aEff.innerHTML = (typeof formatOfficialText === 'function') ? formatOfficialText(effVal, false) : effVal;

            const divRow = activeBlock.querySelector('.active-divider-row');
            if (condVal && condRow) {
                condRow.classList.remove('d-none');
                if (divRow) divRow.classList.remove('d-none');
            } else if (condRow) {
                condRow.classList.add('d-none');
                if (divRow) divRow.classList.add('d-none');
            }

            const saIconUrl = (typeof getSaIconUrl === 'function') ? getSaIconUrl(activeObj, raw) : 'https://abscustom.github.io/assets/images/sp_skill_icon_01.png';
            if (aIcon) aIcon.src = saIconUrl;

            const inType = document.getElementById('input-active-type');
            const inName = document.getElementById('input-active-name');
            const inCond = document.getElementById('input-active-conditions');
            const inEff = document.getElementById('input-active-effect');
            if (inType) inType.value = typeVal;
            if (inName) inName.value = titleVal;
            if (inCond) inCond.value = condVal;
            if (inEff) inEff.value = effVal;
        }
    }

    // Resolve Domain / Field
    let fieldObj = null;
    if (raw.field_id && window.DB && window.DB.fields) {
        fieldObj = window.DB.fields[String(raw.field_id)] || window.DB.fields[raw.field_id];
    }
    if (!fieldObj && window.DB && window.DB.fields) {
        const cidStr = String(raw.id);
        const folderIdStr = String(getCardFolderId(raw));
        const allFields = Array.isArray(window.DB.fields) ? window.DB.fields : Object.values(window.DB.fields);
        fieldObj = allFields.find(f => {
            if (!f) return false;
            const fId = String(f.id || '');
            const cId = String(f.card_id || f.character_id || '');
            return cId === cidStr || fId === cidStr || (fId.length >= 7 && fId.startsWith(cidStr)) || (fId.length >= 7 && fId.startsWith(folderIdStr)) || (raw.character_id && f.character_id === raw.character_id);
        });

        // Also check if active skill creates a domain by title matching
        if (!fieldObj && activeObj) {
            const actEff = (activeObj.effect_description || activeObj.description || activeObj.effect || "");
            const domainNameMatch = actEff.match(/creates the Domain\s*["“]([^"”]+)["”]/i);
            if (domainNameMatch) {
                const dNameMatchClean = domainNameMatch[1].toLowerCase().trim();
                fieldObj = allFields.find(f => {
                    if (!f || !f.name) return false;
                    const fNameLow = f.name.toLowerCase();
                    return fNameLow.includes(dNameMatchClean) || dNameMatchClean.includes(fNameLow.replace(/^dokkan field\s*[-–—:]?\s*/i, '').trim());
                });
                if (!fieldObj) {
                    fieldObj = {
                        name: domainNameMatch[1],
                        description: "Domain Effect active while Domain is in play."
                    };
                }
            }
        }
    }

    if (fieldObj) {
        if (window.addActiveSkillSection) window.addActiveSkillSection();
        const activeBlocks = document.querySelectorAll('.active-block');
        const domainBlock = activeBlocks[activeBlocks.length - 1];
        if (domainBlock) {
            const dType = domainBlock.querySelector('.active-type-label');
            const dName = domainBlock.querySelector('.active-display-name');
            const dCond = domainBlock.querySelector('.active-display-condition');
            const dEff = domainBlock.querySelector('.active-display-effect');
            const dIcon = domainBlock.querySelector('.active-display-icon');
            const condRow = domainBlock.querySelector('.active-condition-row');

            let fieldName = (fieldObj.name || "Domain").replace(/^dokkan field\s*[-–—:]?\s*/i, '').trim();
            const rawEff = fieldObj.description || fieldObj.itemized_description || fieldObj.effect || "";
            const effVal = String(rawEff).replace(/[\r\n]+/g, ' ').trim();

            if (dType) dType.textContent = "Domain";
            if (dName) dName.textContent = fieldName;
            if (dCond) dCond.innerHTML = "";
            if (dEff) dEff.innerHTML = (typeof formatOfficialText === 'function') ? formatOfficialText(effVal, false) : effVal;

            const dDivRow = domainBlock.querySelector('.active-divider-row');
            // Hide condition row and divider line for Domain
            if (condRow) condRow.classList.add('d-none');
            if (dDivRow) dDivRow.classList.add('d-none');

            if (dIcon) dIcon.src = 'https://abscustom.github.io/assets/images/ing_label_field.png';
        }
    }

    if (window.refreshActiveDropdown) window.refreshActiveDropdown();
    if (typeof renderActiveSkills === 'function') {
        renderActiveSkills(raw);
    }
    if (window.updateAbsStyleActiveSkills) {
        window.updateAbsStyleActiveSkills();
    }

    // 7. LINK SKILLS
    const linkCont = document.getElementById('card-link-container');
    if (linkCont) {
        linkCont.innerHTML = "";
        let rawLinks = raw.links || raw.link_skill_ids || [];
        rawLinks.forEach(linkItem => {
            let linkName = typeof linkItem === 'object' ? linkItem.name : (window.DB && window.DB.links && window.DB.links[linkItem] ? window.DB.links[linkItem].name : linkItem);
            if (!linkName) return;
            const html = `<a class="col-4 border border-1 border-${cardType} padding-top-bottom-10 text-center">${linkName}</a>`;
            linkCont.insertAdjacentHTML('beforeend', html);
        });
    }
    window.editorPartnerCardId = raw.id;
    if (window.refreshEditorLinkingPartners) window.refreshEditorLinkingPartners();
    // 8. CATEGORIES
    const catCont = document.getElementById('card-category-container');
    if (catCont) {
        catCont.innerHTML = "";
        let rawCats = raw.categories || raw.card_categories || raw.category_ids || [];
        rawCats.forEach(catItem => {
            let catId = typeof catItem === 'object' ? (catItem.id || catItem.category_id) : catItem;
            if (!catId) return;
            let padId = String(catId).padStart(4, '0');
            const categoryObj = typeof catItem === 'object' ? catItem : (window.DB && window.DB.categories ? window.DB.categories[String(catId)] : null);
            const categoryName = categoryObj?.name || `Category ${catId}`;
            const html = `<div class="col-4 d-flex justify-content-center padding-top-bottom-5 editor-category-item" data-category-name="${categoryName}"><img src="https://abscustom.github.io/assets/images/card_category_label_${padId}_b_on.png" style="width:210px;" alt="${categoryName}" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-flex';"><span class="category-name-fallback" style="display:none;">${categoryName}</span></div>`;
            catCont.insertAdjacentHTML('beforeend', html);
        });
    }

    // 9. MULTI-LAYER HIGH-RES CARD ART & BACKGROUND & EFFECT
    const bgUrl = `https://images.weserv.nl/?url=dokkaninfo.com/assets/japan/character/card/${bgFolderId}/card_${bgFolderId}_bg.png`;
    const charUrl = `https://images.weserv.nl/?url=dokkaninfo.com/assets/japan/character/card/${folderId}/card_${folderId}_character.png`;
    const effectUrl = `https://images.weserv.nl/?url=dokkaninfo.com/assets/japan/character/card/${folderId}/card_${folderId}_effect.png`;
    const thumbUrl = `https://images.weserv.nl/?url=dokkaninfo.com/assets/japan/character/thumb/card_${folderId}_thumb/card_${folderId}_thumb.png`;

    // Keep the header portrait tied to this exact card. Exchange cards share
    // an awakening route, whose base thumbnail must not replace this one.
    window.currentCardThumbnail = thumbUrl;

    const imgOverlay = document.getElementById('myOverlayImage');
    const absArt = document.getElementById('abs-art-img');
    const imageInput = document.getElementById('imageInput');

    const absArtBg = document.getElementById('abs-art-bg');
    const absArtChar = document.getElementById('abs-art-char');
    const absArtEffect = document.getElementById('abs-art-effect');

    if (absArtBg) {
        delete absArtBg.dataset.failed;
        absArtBg.src = bgUrl;
        absArtBg.dataset.officialCardArt = 'true';
        absArtBg.style.display = 'block';
    }
    if (absArtChar) {
        delete absArtChar.dataset.failed;
        absArtChar.src = charUrl;
        absArtChar.dataset.officialCardArt = 'true';
        absArtChar.style.display = 'block';
    }
    if (absArtEffect) {
        delete absArtEffect.dataset.failed;
        absArtEffect.src = effectUrl;
        absArtEffect.dataset.officialCardArt = 'true';
        absArtEffect.style.display = 'block';
    }

    if (imgOverlay) {
        imgOverlay.src = charUrl || bgUrl;
        imgOverlay.dataset.officialCardArt = 'true';
    }
    if (absArt) {
        absArt.src = charUrl || bgUrl;
        absArt.dataset.officialCardArt = 'true';
    }
    if (imageInput) imageInput.value = charUrl || bgUrl;

    // 10. SSR, TUR, LR PROGRESSION THUMBNAILS RESOLUTION (Exact Unit Network)
    const imgSsr = document.getElementById('img-ssr');
    const imgTur = document.getElementById('img-tur');
    const imgLr = document.getElementById('img-lr');
    const absThumb = document.getElementById('abs-thumb-img');

    if (absThumb) {
        absThumb.src = thumbUrl;
        absThumb.dataset.officialCardArt = 'true';
    }
    if (imgLr) {
        imgLr.src = thumbUrl;
        imgLr.dataset.officialCardArt = 'true';
    }

    if (typeof getFullUnitNetwork === 'function') {
        const network = getFullUnitNetwork(raw);
        if (network && Array.isArray(network.baseProgression) && network.baseProgression.length > 0) {
            network.baseProgression.forEach((progCard, idx) => {
                const progRar = (typeof getCardExactRarity === 'function') ? getCardExactRarity(progCard) : (progCard.rarity === 5 ? 'LR' : (progCard.rarity === 4 ? 'TUR' : 'SSR'));
                const pFolderId = (typeof getCardFolderId === 'function') ? getCardFolderId(progCard) : Math.floor(parseInt(progCard.id, 10) / 10) * 10;
                const pThumb = `https://images.weserv.nl/?url=dokkaninfo.com/assets/japan/character/thumb/card_${pFolderId}_thumb/card_${pFolderId}_thumb.png`;

                if (progRar === 'SSR' || progRar === 'UR' || (idx === 0 && network.baseProgression.length > 1 && progRar !== 'LR')) {
                    if (imgSsr) imgSsr.src = pThumb;
                }
                if (progRar === 'TUR' || (idx === 1 && network.baseProgression.length >= 2 && progRar !== 'SSR')) {
                    if (imgTur) imgTur.src = pThumb;
                }
                // img-lr is the main header icon, not an awakening-row icon.
                // It was already set to the exact selected card above; replacing
                // it with the base route here breaks reversible-exchange LRs.
            });
        }
    }

    // 11. LWF CARD BACKGROUND & SEZA ATTACHMENT
    const bgCanvas = document.getElementById('abs-card-bg-lwf-canvas');
    const infoCanvas = document.getElementById('info-card-bg-lwf-canvas');

    // Start official imports in static mode. Cards with a valid LWF promote
    // themselves to animated mode once their animation is confirmed available.
    if (window.switchEditorArtMode) window.switchEditorArtMode('static');

    if (typeof window.DokkanLWF !== 'undefined' && typeof window.DokkanLWF.attachCardBgLwf === 'function') {
        if (bgCanvas) {
            window.DokkanLWF.attachCardBgLwf(bgCanvas, raw).then(hasLwf => {
                if (hasLwf) {
                    bgCanvas.classList.add('lwf-active');
                    if (window.switchEditorArtMode) window.switchEditorArtMode('animated');
                    else bgCanvas.style.display = 'block';
                } else {
                    bgCanvas.classList.remove('lwf-active');
                    bgCanvas.style.display = 'none';
                    if (window.switchEditorArtMode) window.switchEditorArtMode('static');
                }
            });
        }
        if (infoCanvas) {
            window.DokkanLWF.attachCardBgLwf(infoCanvas, raw).then(hasLwf => {
                if (hasLwf) {
                    infoCanvas.classList.add('lwf-active');
                    infoCanvas.style.display = 'block';
                    if (window.DokkanLWF.play) window.DokkanLWF.play(infoCanvas.id);
                } else {
                    infoCanvas.classList.remove('lwf-active');
                    infoCanvas.style.display = 'none';
                }
            });
        }
    }

    // 12. ART MODE & LIVE SYNC
    if (window.switchEditorArtMode) window.switchEditorArtMode(window.currentEditorArtMode || 'static');
    window.updateIdentity();
    if (window.syncToAbsLayout) window.syncToAbsLayout();
    if (window.autoSaveToCache) window.autoSaveToCache();

    alert(`✅ Successfully imported [${titleObj.title || 'Official'}] ${titleObj.name || cardItem.name}!`);
};

/**
 * Execute Custom Card Ingestion into Editor
 */
window.executeCustomCardImport = async function(cardItem) {
    if (!cardItem) return;

    // A card imported from the community hub should never inherit the official-card export action.
    window.currentCardSource = 'custom';
    window.currentCardThumbnail = '';

    // Reset editor to pristine clean slate
    if (typeof window.clearEditorForCleanImport === 'function') {
        window.clearEditorForCleanImport();
    }

    // Suppress and close manual icon picker popup
    const iconModal = document.getElementById('icon-picker-modal');
    if (iconModal) iconModal.style.display = 'none';

    const resolveCustomAssetUrl = (src, baseUrl) => {
        if (!src) return "";
        const trimmed = String(src).trim();
        if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return trimmed;
        if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;

        const cleanBase = (baseUrl || `https://abscustom.github.io/${cardItem.id}/`).replace(/\/+$/, '') + '/';
        const cleanSrc = trimmed.replace(/^\.\//, '').replace(/^\//, '');

        const commonAssetNames = [
            'frame_agl.png', 'frame_teq.png', 'frame_int.png', 'frame_str.png', 'frame_phy.png', 'frame_none.png',
            'type_agl.png', 'type_teq.png', 'type_int.png', 'type_str.png', 'type_phy.png', 'type_none.png',
            'super_type_agl.png', 'super_type_teq.png', 'super_type_int.png', 'super_type_str.png', 'super_type_phy.png',
            'extreme_type_agl.png', 'extreme_type_teq.png', 'extreme_type_int.png', 'extreme_type_str.png', 'extreme_type_phy.png',
            'rarity_ssr.png', 'rarity_TUR.png', 'rarity_LR.png', 'rarity_none.png',
            'rarity_ssr_abs.png', 'rarity_TUR_abs.png', 'rarity_lr_abs.png',
            'eza_abs.png', 'superza_abs.png', 'eza_img.png', 'supereza_img.png',
            'z-awaken.png', 'dokkan-awaken.png', 'lr_spin_dial.png', 'lightningfx.webm',
            'SSR_Icon.png', 'TUR_Icon.png', 'LR_Icon.png', 'default.png', 'abs.custom.png', 'abs.style.png',
            'dokkan-info-logo.png'
        ];

        const fileName = cleanSrc.split('/').pop();
        if (commonAssetNames.includes(fileName)) {
            return `https://abscustom.github.io/assets/images/${fileName}`;
        }

        if (cleanBase) {
            return cleanBase + cleanSrc;
        }
        return trimmed;
    };

    // 1. Try importing high-fidelity card.json if available
    try {
        const jsonUrl = `https://raw.githubusercontent.com/abscustom/abscustom.github.io/main/${cardItem.id}/card.json`;
        const jRes = await fetch(jsonUrl);
        if (jRes.ok) {
            const projectData = await jRes.json();
            if (window.loadProjectData) {
                window.loadProjectData(projectData, cardItem.cardUrl);
                window.currentCardSource = 'custom';
                const folderInput = document.getElementById('upload-folder-id');
                if (folderInput) folderInput.value = cardItem.id;
                window.editorPartnerCardId = cardItem.id;
                if (window.refreshEditorLinkingPartners) window.refreshEditorLinkingPartners();
                alert(`✅ Successfully imported Custom Card: [${projectData.inputs?.descInput || cardItem.title || ''}] ${projectData.inputs?.nameInput || cardItem.name}!`);
                return;
            }
        }
    } catch (e) {}

    // 2. Fallback: Parse complete HTML DOM from index.html (Live fetch first)
    let rawHtml = "";
    try {
        const rawUrl = `https://raw.githubusercontent.com/abscustom/abscustom.github.io/main/${cardItem.id}/index.html`;
        const r = await fetch(rawUrl, { cache: "no-store" });
        if (r.ok) rawHtml = await r.text();
    } catch(e) {}
    if (!rawHtml && cardItem.cardUrl) {
        try {
            const r = await fetch(cardItem.cardUrl, { cache: "no-store" });
            if (r.ok) rawHtml = await r.text();
        } catch(e) {}
    }
    // Fallback to cache if live fetch fails
    if (!rawHtml || rawHtml.length < 50) {
        rawHtml = cardItem.htmlText || "";
    }

    if (!rawHtml) {
        alert("Failed to load custom card HTML content.");
        return;
    }

    try {
        const doc = new DOMParser().parseFromString(rawHtml, 'text/html');

        // Check embedded dokkan-project-data script tag
        const backupScript = doc.querySelector('#dokkan-project-data');
        if (backupScript && window.loadProjectData) {
            try {
                const projectData = JSON.parse(backupScript.textContent);
                window.loadProjectData(projectData, cardItem.cardUrl);
                window.currentCardSource = 'custom';
                const folderInput = document.getElementById('upload-folder-id');
                if (folderInput) folderInput.value = cardItem.id;
                window.editorPartnerCardId = cardItem.id;
                if (window.refreshEditorLinkingPartners) window.refreshEditorLinkingPartners();
                alert(`✅ Successfully imported Custom Card: ${cardItem.name}!`);
                return;
            } catch (e) {}
        }

        // 1. Identity & Inputs
        const titleVal = doc.querySelector('#descInput')?.value || doc.querySelector('#descInput')?.getAttribute('value') || doc.querySelector('#char-description')?.textContent?.trim() || doc.querySelector('#abs-char-title')?.textContent?.trim() || cardItem.title || "";
        const nameVal = doc.querySelector('#nameInput')?.value || doc.querySelector('#nameInput')?.getAttribute('value') || doc.querySelector('#char-name')?.textContent?.trim() || doc.querySelector('#abs-char-name')?.textContent?.trim() || cardItem.name || "";
        const leaderVal = doc.querySelector('#leaderInput')?.value || doc.querySelector('#leaderInput')?.getAttribute('value') || doc.querySelector('#leader-skill')?.textContent?.trim() || doc.querySelector('#abs-leader-skill')?.textContent?.trim() || "";

        // Comprehensive Release Date Extraction (Never captures "Release Date" label)
        let dateVal = "";
        let ezaDateVal = "";
        let sezaDateVal = "";

        const checkValidDate = (str) => {
            if (!str) return "";
            const v = String(str).trim();
            if (!v || v === 'TBD' || v.toLowerCase() === 'release date' || v.toLowerCase() === 'eza release date' || v.toLowerCase() === 'seza release date') return "";
            return v;
        };

        // 1. Try direct input fields
        dateVal = checkValidDate(doc.querySelector('#dateInput')?.value || doc.querySelector('#dateInput')?.getAttribute('value') || doc.querySelector('#dateInput')?.textContent);
        ezaDateVal = checkValidDate(doc.querySelector('#ezaDateInput')?.value || doc.querySelector('#ezaDateInput')?.getAttribute('value') || doc.querySelector('#ezaDateInput')?.textContent);
        sezaDateVal = checkValidDate(doc.querySelector('#sezaDateInput')?.value || doc.querySelector('#sezaDateInput')?.getAttribute('value') || doc.querySelector('#sezaDateInput')?.textContent);

        // 2. Extract from DokkanInfo release-dates-container
        if (!dateVal) {
            const relRows = doc.querySelectorAll('#release-dates-container [class*="-2"]');
            const foundDates = [];
            relRows.forEach(r => {
                const txt = checkValidDate(r.textContent.trim());
                if (txt && !foundDates.includes(txt)) foundDates.push(txt);
            });
            if (foundDates.length > 0) dateVal = foundDates[0];
            if (foundDates.length > 1 && !ezaDateVal) ezaDateVal = foundDates[1];
            if (foundDates.length > 2 && !sezaDateVal) sezaDateVal = foundDates[2];
        }

        // 3. Extract from Abs layout .abs-awaken-date
        if (!dateVal) {
            const absSpans = doc.querySelectorAll('.abs-awaken-date span, #abs-awakenings-container .abs-awaken-date span');
            const foundAbsDates = [];
            absSpans.forEach(s => {
                const txt = checkValidDate(s.textContent.replace(/release\s*date:\s*/i, '').trim());
                if (txt && !foundAbsDates.includes(txt)) foundAbsDates.push(txt);
            });
            if (foundAbsDates.length > 0) dateVal = foundAbsDates[0];
            if (foundAbsDates.length > 1 && !ezaDateVal) ezaDateVal = foundAbsDates[1];
            if (foundAbsDates.length > 2 && !sezaDateVal) sezaDateVal = foundAbsDates[2];
        }

        // 4. Extract via Regex on entire raw HTML for explicit date format (e.g. 9/14/2026 1:00:00 AM EDT or Jul 7, 2024)
        if (!dateVal) {
            const dateRegex = /(?:class="[^"]*bg-[a-z0-9]+-2[^"]*"[^>]*>[\s\S]*?<div class="col text-center">|class="abs-awaken-date"[^>]*>[\s\S]*?<span[^>]*>)([^<]+(?:AM|PM|EDT|EST|\d{4})[^<]*)(?:<\/div>|<\/span>)/i;
            const match = rawHtml.match(dateRegex);
            if (match && match[1]) {
                const cleanMatch = checkValidDate(match[1]);
                if (cleanMatch) dateVal = cleanMatch;
            }
        }

        // 5. Metadata fallback from cardItem
        if (!dateVal && (cardItem.releaseDate || cardItem.date || cardItem.release_date)) {
            dateVal = checkValidDate(cardItem.releaseDate || cardItem.date || cardItem.release_date);
        }

        const descInput = document.getElementById('descInput');
        const nameInput = document.getElementById('nameInput');
        const dateInput = document.getElementById('dateInput');
        const ezaDateInput = document.getElementById('ezaDateInput');
        const sezaDateInput = document.getElementById('sezaDateInput');
        const leaderInput = document.getElementById('leaderInput');

        if (descInput) descInput.value = titleVal;
        if (nameInput) nameInput.value = nameVal;
        if (dateInput) dateInput.value = dateVal;
        if (ezaDateInput) ezaDateInput.value = ezaDateVal;
        if (sezaDateInput) sezaDateInput.value = sezaDateVal;
        if (leaderInput) leaderInput.value = leaderVal;

        // 2. Typing, Class, Rarity, Awakening
        let cardType = cardItem.type || 'agl';
        let cardClass = cardItem.cardClass || 'super';
        let cardRarity = cardItem.rarity || 'TUR';
        let awakeningMode = 'none';

        const markerScript = doc.querySelector('#pub-site-marker');
        if (markerScript) {
            const text = markerScript.textContent || "";
            const mType = text.match(/window\.currentType\s*=\s*"([^"]+)"/);
            const mClass = text.match(/window\.currentClass\s*=\s*"([^"]+)"/);
            const mRarity = text.match(/window\.currentRarity\s*=\s*"([^"]+)"/);
            const mAwakening = text.match(/window\.currentAwakeningMode\s*=\s*"([^"]+)"/);
            if (mType) cardType = mType[1];
            if (mClass) cardClass = mClass[1];
            if (mRarity) cardRarity = mRarity[1];
            if (mAwakening) awakeningMode = mAwakening[1];
        }

        window.currentType = cardType;
        window.currentClass = cardClass;
        window.currentRarity = cardRarity;
        window.currentAwakeningMode = awakeningMode;

        if (window.applyCardTheme) window.applyCardTheme(cardType);
        if (window.updateRarityStats) window.updateRarityStats(cardRarity);
        if (window.updateIconImages) window.updateIconImages();
        if (window.applyAwakening) window.applyAwakening(awakeningMode);

        // 3. Stats (Numeric Clean Extraction)
        const parseStatNumber = (val) => {
            if (!val) return 0;
            const cleaned = String(val).replace(/[^\d]/g, '');
            return cleaned ? parseInt(cleaned, 10) : 0;
        };

        const hpMaxVal = parseStatNumber(doc.querySelector('#input-hp-max')?.value) ||
                         parseStatNumber(doc.querySelector('#input-hp-max')?.getAttribute('value')) ||
                         parseStatNumber(doc.querySelector('#stat-hp-max')?.textContent) ||
                         parseStatNumber(doc.querySelector('#abs-stat-hp-val')?.textContent) || 10000;
        const atkMaxVal = parseStatNumber(doc.querySelector('#input-atk-max')?.value) ||
                          parseStatNumber(doc.querySelector('#input-atk-max')?.getAttribute('value')) ||
                          parseStatNumber(doc.querySelector('#stat-atk-max')?.textContent) ||
                          parseStatNumber(doc.querySelector('#abs-stat-atk-val')?.textContent) || 10000;
        const defMaxVal = parseStatNumber(doc.querySelector('#input-def-max')?.value) ||
                          parseStatNumber(doc.querySelector('#input-def-max')?.getAttribute('value')) ||
                          parseStatNumber(doc.querySelector('#stat-def-max')?.textContent) ||
                          parseStatNumber(doc.querySelector('#abs-stat-def-val')?.textContent) || 5000;

        const hpMinVal = parseStatNumber(doc.querySelector('#input-hp-min')?.value) ||
                         parseStatNumber(doc.querySelector('#stat-hp-min')?.textContent) || Math.round(hpMaxVal / 3.3);
        const atkMinVal = parseStatNumber(doc.querySelector('#input-atk-min')?.value) ||
                          parseStatNumber(doc.querySelector('#stat-atk-min')?.textContent) || Math.round(atkMaxVal / 3.3);
        const defMinVal = parseStatNumber(doc.querySelector('#input-def-min')?.value) ||
                          parseStatNumber(doc.querySelector('#stat-def-min')?.textContent) || Math.round(defMaxVal / 3.3);

        const inpHp = document.getElementById('input-hp-max');
        const inpAtk = document.getElementById('input-atk-max');
        const inpDef = document.getElementById('input-def-max');
        if (inpHp) inpHp.value = hpMaxVal;
        if (inpAtk) inpAtk.value = atkMaxVal;
        if (inpDef) inpDef.value = defMaxVal;

        const inpHpMin = document.getElementById('input-hp-min');
        const inpAtkMin = document.getElementById('input-atk-min');
        const inpDefMin = document.getElementById('input-def-min');
        if (inpHpMin) inpHpMin.value = hpMinVal;
        if (inpAtkMin) inpAtkMin.value = atkMinVal;
        if (inpDefMin) inpDefMin.value = defMinVal;

        if (window.calcFromMax) {
            window.calcFromMax('hp', hpMinVal);
            window.calcFromMax('atk', atkMinVal);
            window.calcFromMax('def', defMinVal);
        }

        // 4. Passive Skill
        const passiveTitleVal = doc.querySelector('#input-passive-name-sidebar')?.value || doc.querySelector('#input-passive-name-sidebar')?.getAttribute('value') || doc.querySelector('.passive-name-display')?.textContent?.trim() || doc.querySelector('#abs-passive-name')?.textContent?.trim() || "Passive Skill";
        const passiveTitleInput = document.getElementById('input-passive-name-sidebar');
        const passiveTitleDisplay = document.querySelector('.passive-name-display');
        if (passiveTitleInput) passiveTitleInput.value = passiveTitleVal;
        if (passiveTitleDisplay) passiveTitleDisplay.innerText = passiveTitleVal;

        const docCardPassive = doc.getElementById('card-passive-container');
        const docSidebarPassive = doc.getElementById('sidebar-sections-area');
        if (docCardPassive && document.getElementById('card-passive-container')) {
            let html = docCardPassive.innerHTML;
            html = html.replace(/src="(images\/[^"]+)"/g, (m, p) => `src="${resolveCustomAssetUrl(p, cardItem.cardUrl)}"`);
            html = html.replace(/src="(\.\/images\/[^"]+)"/g, (m, p) => `src="${resolveCustomAssetUrl(p, cardItem.cardUrl)}"`);
            document.getElementById('card-passive-container').innerHTML = html;
        }
        if (docSidebarPassive && document.getElementById('sidebar-sections-area')) {
            let html = docSidebarPassive.innerHTML;
            html = html.replace(/src="(images\/[^"]+)"/g, (m, p) => `src="${resolveCustomAssetUrl(p, cardItem.cardUrl)}"`);
            html = html.replace(/src="(\.\/images\/[^"]+)"/g, (m, p) => `src="${resolveCustomAssetUrl(p, cardItem.cardUrl)}"`);
            document.getElementById('sidebar-sections-area').innerHTML = html;

            document.querySelectorAll('#sidebar-sections-area [id^="side-sec-"]').forEach(sec => {
                const id = sec.id.replace('side-sec-', '');
                const hInput = sec.querySelector('input[type="text"]');
                const ta = sec.querySelector('textarea');
                if (hInput) {
                    const val = hInput.getAttribute('value') || hInput.value;
                    hInput.value = val;
                    if (window.updateHeader) window.updateHeader(id, val);
                }
                if (ta) {
                    const val = ta.textContent || ta.getAttribute('value') || ta.value;
                    ta.value = val;
                    if (window.updateSection) window.updateSection(id, val);
                }
            });
        }

        // 5. Super Attacks
        document.querySelectorAll('.sa-block').forEach(b => b.remove());
        const saBlocks = doc.querySelectorAll('.sa-block');
        const saSpot = document.getElementById('sa-insert-spot');
        if (saBlocks.length > 0 && saSpot) {
            saBlocks.forEach(b => {
                let blockHtml = b.outerHTML;
                blockHtml = blockHtml.replace(/src="(images\/[^"]+)"/g, (m, p) => `src="${resolveCustomAssetUrl(p, cardItem.cardUrl)}"`);
                blockHtml = blockHtml.replace(/src="(\.\/images\/[^"]+)"/g, (m, p) => `src="${resolveCustomAssetUrl(p, cardItem.cardUrl)}"`);
                saSpot.insertAdjacentHTML('beforebegin', blockHtml);
            });
        }

        // 6. Active Skills
        document.querySelectorAll('.active-block').forEach(b => b.remove());
        const actBlocks = doc.querySelectorAll('.active-block');
        const actSpot = document.getElementById('active-skill-insert-spot');
        if (actBlocks.length > 0 && actSpot) {
            actBlocks.forEach(b => {
                let blockHtml = b.outerHTML;
                blockHtml = blockHtml.replace(/src="(images\/[^"]+)"/g, (m, p) => `src="${resolveCustomAssetUrl(p, cardItem.cardUrl)}"`);
                blockHtml = blockHtml.replace(/src="(\.\/images\/[^"]+)"/g, (m, p) => `src="${resolveCustomAssetUrl(p, cardItem.cardUrl)}"`);
                actSpot.insertAdjacentHTML('beforebegin', blockHtml);
            });
        }

        // 7. Links & Categories
        const docLinks = doc.getElementById('card-link-container');
        if (docLinks && document.getElementById('card-link-container')) {
            document.getElementById('card-link-container').innerHTML = docLinks.innerHTML;
        }
        const docCats = doc.getElementById('card-category-container');
        if (docCats && document.getElementById('card-category-container')) {
            let catHtml = docCats.innerHTML;
            catHtml = catHtml.replace(/src="(images\/[^"]+)"/g, (m, p) => `src="${resolveCustomAssetUrl(p, cardItem.cardUrl)}"`);
            catHtml = catHtml.replace(/src="(\.\/images\/[^"]+)"/g, (m, p) => `src="${resolveCustomAssetUrl(p, cardItem.cardUrl)}"`);
            document.getElementById('card-category-container').innerHTML = catHtml;
        }

        // 8. Forms & Evolution Tree (Supports Info Wide Blocks & Abs Transformations)
        const formsContainer = document.getElementById('forms-container');
        if (formsContainer) {
            formsContainer.innerHTML = "";
            const docForms = doc.querySelectorAll('#forms-container .dokkan-card');
            const absTransRows = doc.querySelectorAll('#abs-transformations-container .abs-transform-row');

            if (docForms.length > 0) {
                docForms.forEach((oldCard, idx) => {
                    const oldName = oldCard.querySelector('.form-name-display')?.innerText?.trim() || oldCard.querySelector('.form-name')?.innerText?.trim() || `Form ${idx + 1}`;
                    const rawImg = oldCard.querySelector('.form-image')?.getAttribute('src') || oldCard.querySelector('img.form-image')?.src || oldCard.querySelector('img')?.getAttribute('src') || "";
                    const oldImg = resolveCustomAssetUrl(rawImg, cardItem.cardUrl);
                    const oldExport = oldCard.querySelector('.form-image')?.getAttribute('data-export-name') || "";
                    const oldLink = oldCard.querySelector('.form-link')?.getAttribute('href') || "";
                    const oldLetter = oldCard.getAttribute('data-hub-letter') || String.fromCharCode(97 + idx);
                    
                    if (window.addFormBlock) window.addFormBlock(oldName, oldImg, oldExport, oldLetter);
                    if (oldLink && oldLink !== "javascript:void(0)" && selectedForm) {
                        const anchor = selectedForm.querySelector(".form-link");
                        if (anchor) anchor.href = oldLink;
                    }
                });
            } else if (absTransRows.length > 0) {
                absTransRows.forEach((row, idx) => {
                    const name = row.querySelector('.abs-transform-name')?.innerText?.trim() || `Form ${idx + 1}`;
                    const rawImg = row.querySelector('.thumb-img')?.getAttribute('src') || row.querySelector('.thumb-img')?.src || "";
                    const link = row.querySelector('.abs-transform-link')?.getAttribute('href') || "";
                    const letter = String.fromCharCode(97 + idx);

                    if (window.addFormBlock) window.addFormBlock(name, resolveCustomAssetUrl(rawImg, cardItem.cardUrl), "", letter);
                    if (link && link !== "javascript:void(0)" && selectedForm) {
                        const anchor = selectedForm.querySelector(".form-link");
                        if (anchor) anchor.href = link;
                    }
                });
            }
        }

        // 9. SSR, TUR, LR Thumbnails (Strict selectors to never capture .card-frame)
        const rawSsrThumb = doc.querySelector('#ssr-row .card-info-thumb img, #ssr-row #img-ssr, .abs-awaken-row:nth-child(1) .thumb-img')?.getAttribute('src');
        const rawTurThumb = doc.querySelector('#tur-row .card-info-thumb img, #tur-row #img-tur, .abs-awaken-row:nth-child(2) .thumb-img')?.getAttribute('src');
        const rawLrThumb = doc.querySelector('.card-info-thumb #img-lr, #img-lr')?.getAttribute('src');
        const rawAbsThumb = doc.querySelector('#abs-thumb-img, .abs-composed-icon .thumb-img, .thumb-box .thumb-img')?.getAttribute('src');

        if (rawSsrThumb) {
            const cleanSsr = resolveCustomAssetUrl(rawSsrThumb, cardItem.cardUrl);
            document.querySelectorAll('#img-ssr').forEach(el => el.src = cleanSsr);
        }
        if (rawTurThumb) {
            const cleanTur = resolveCustomAssetUrl(rawTurThumb, cardItem.cardUrl);
            document.querySelectorAll('#img-tur').forEach(el => el.src = cleanTur);
        }
        if (rawLrThumb) {
            const cleanLr = resolveCustomAssetUrl(rawLrThumb, cardItem.cardUrl);
            const elLr = document.getElementById('img-lr');
            if (elLr) elLr.src = cleanLr;
        }
        if (rawAbsThumb) {
            const cleanAbs = resolveCustomAssetUrl(rawAbsThumb, cardItem.cardUrl);
            const elAbs = document.getElementById('abs-thumb-img');
            if (elAbs) elAbs.src = cleanAbs;
        }

        // 10. Card Art Image & Video
        const rawArtImg = doc.querySelector('#myOverlayImage')?.getAttribute('src') || doc.querySelector('#abs-art-img')?.getAttribute('src') || doc.querySelector('.card-art-canvas img')?.getAttribute('src');
        const rawArtVid = doc.querySelector('#myOverlayVideo source')?.getAttribute('src') || doc.querySelector('video.card-art-canvas source')?.getAttribute('src');

        if (rawArtImg) {
            const cleanArt = resolveCustomAssetUrl(rawArtImg, cardItem.cardUrl);
            const artImg = document.getElementById('myOverlayImage');
            if (artImg) {
                artImg.src = cleanArt;
                artImg.style.display = 'block';
            }
            const dbArtImg = document.getElementById('abs-art-img');
            if (dbArtImg) dbArtImg.src = cleanArt;
            const vidOverlay = document.getElementById('myOverlayVideo');
            if (vidOverlay) vidOverlay.style.display = 'none';
        }
        if (rawArtVid) {
            const cleanVid = resolveCustomAssetUrl(rawArtVid, cardItem.cardUrl);
            const vidSource = document.getElementById('myOverlayVideo')?.querySelector('source');
            const vidOverlay = document.getElementById('myOverlayVideo');
            if (vidSource && vidOverlay) {
                vidSource.src = cleanVid;
                vidOverlay.style.display = 'block';
                vidOverlay.load();
                vidOverlay.play().catch(()=>{});
            }
            const artImg = document.getElementById('myOverlayImage');
            if (artImg) artImg.style.display = 'none';
        }

        // 11. Pre-fill folder ID for overwrite
        const folderInput = document.getElementById('upload-folder-id');
        if (folderInput) folderInput.value = cardItem.id;
        window.editorPartnerCardId = cardItem.id;

        // 12. Refresh Editor UI
        window.updateIdentity();
        window.calcFromMin('hp');
        window.calcFromMin('atk');
        window.calcFromMin('def');
        if (window.refreshSADropdown) window.refreshSADropdown();
        if (window.refreshActiveDropdown) window.refreshActiveDropdown();
        if (window.refreshFormList) window.refreshFormList();
        if (typeof window.updateCardDisplay === 'function') window.updateCardDisplay();
        if (window.syncToAbsLayout) window.syncToAbsLayout();
        if (window.updateAbsStyleSuperAttacks) window.updateAbsStyleSuperAttacks();
        if (window.refreshEditorLinkingPartners) window.refreshEditorLinkingPartners();
        if (window.autoSaveToCache) window.autoSaveToCache();

        alert(`✅ Successfully imported Custom Card: [${titleVal}] ${nameVal}!`);
    } catch (e) {
        console.error("Custom card import failed:", e);
        alert("Failed to import custom card. Check console for details.");
    }
};
