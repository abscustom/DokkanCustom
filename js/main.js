/* ==========================================================================
   absCustom Hub - Vertical Timeline & Database Architecture
   ========================================================================== */

const CENTRAL_ASSET_URL = 'https://abscustom.github.io/assets/images/';
let currentHubView = 'home';
let currentAppStyle = localStorage.getItem('hub_selected_style') || 'abs-style';
let currentFxMode = localStorage.getItem('hub_card_fx_mode') || 'all';
let currentSourceFilter = 'all';
let searchQuery = '';
let allCardItems = [];
let filteredCardItems = [];
let currentPage = 1;
const CARDS_PER_PAGE = 60;

window.handleHubThumbError = function(img, folderId, parentFolderId) {
    img.onerror = null;
    img.src = `https://images.weserv.nl/?url=dokkaninfo.com/assets/japan/character/thumb/card_${folderId}_thumb/card_${folderId}_thumb.png`;
    img.onerror = function() {
        this.onerror = null;
        if (parentFolderId && parentFolderId !== folderId) {
            this.src = `https://images.weserv.nl/?url=dokkaninfo.com/assets/japan/character/thumb/card_${parentFolderId}_thumb/card_${parentFolderId}_thumb.png`;
            this.onerror = function() {
                this.onerror = null;
                this.src = `${CENTRAL_ASSET_URL}SSR_Icon.png`;
            };
        } else {
            this.src = `${CENTRAL_ASSET_URL}SSR_Icon.png`;
        }
    };
};

function setAppStyle(styleKey) {
    currentAppStyle = styleKey;
    localStorage.setItem('hub_selected_style', styleKey);
    window.updateSiteFavicon?.(styleKey);

    document.querySelectorAll('.abs-hud-theme-btn').forEach(btn => btn.classList.remove('active'));
    if (styleKey === 'abs-style') {
        document.getElementById('theme-btn-abs')?.classList.add('active');
        document.body.classList.remove('theme-placeholder');
        document.body.classList.add('theme-abs-style');
    } else {
        document.getElementById('theme-btn-placeholder')?.classList.add('active');
        document.body.classList.remove('theme-abs-style');
        document.body.classList.add('theme-placeholder');
    }
}

function setFxAnimationMode(fxMode) {
    currentFxMode = fxMode;
    localStorage.setItem('hub_card_fx_mode', fxMode);

    document.body.classList.remove('fx-no-lightning', 'fx-no-seza', 'fx-static');
    if (fxMode === 'no-lightning') {
        document.body.classList.add('fx-no-lightning');
    } else if (fxMode === 'no-seza') {
        document.body.classList.add('fx-no-seza');
    } else if (fxMode === 'static') {
        document.body.classList.add('fx-static');
    }
    
    if (fxMode === 'no-seza' || fxMode === 'static') {
        document.querySelectorAll('.seza-lwf-border-canvas').forEach(c => c.style.display = 'none');
    } else {
        document.querySelectorAll('.seza-lwf-border-canvas').forEach(c => c.style.display = 'block');
        mountGridSezaFlames();
    }
}

function handleSourceChange(source) {
    currentSourceFilter = source;
    filterCards(true);
}

function toggleSettingsDrawer() {
    const drawer = document.getElementById('settingsDrawer');
    const overlay = document.getElementById('settingsOverlay');
    if (drawer && overlay) {
        const isOpen = drawer.classList.contains('open');
        if (isOpen) {
            drawer.classList.remove('open');
            overlay.classList.remove('open');
        } else {
            drawer.classList.add('open');
            overlay.classList.add('open');
        }
    }
}

function toggleSidebar() {
    const drawer = document.getElementById('sidebarDrawer');
    const overlay = document.getElementById('sidebarOverlay');
    if (drawer && overlay) {
        const isOpen = drawer.classList.contains('open');
        if (isOpen) {
            drawer.classList.remove('open');
            overlay.classList.remove('open');
        } else {
            drawer.classList.add('open');
            overlay.classList.add('open');
        }
    }
}

function switchHubView(viewKey, sourceKey = null) {
    currentHubView = viewKey;
    currentPage = 1;

    if (sourceKey) {
        currentSourceFilter = sourceKey;
        const sourceGroup = document.querySelector('.cards-inline-filter-bar .source-pill-group');
        if (sourceGroup) {
            sourceGroup.querySelectorAll('.filter-pill-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.value === sourceKey);
            });
        }
    }

    // Synchronize browser URL bar so reloads accurately reflect the current view
    try {
        if (viewKey === 'home') {
            window.history.replaceState({}, document.title, window.location.pathname);
        } else if (viewKey === 'news') {
            window.history.replaceState({}, document.title, `${window.location.pathname}?view=news`);
        } else if (viewKey === 'cards') {
            window.history.replaceState({}, document.title, `${window.location.pathname}?view=cards`);
        }
    } catch (e) {}

    document.querySelectorAll('.hud-nav-link, .apple-nav-item').forEach(btn => {
        btn.classList.remove('active');
    });

    const activeBtn = document.getElementById(`nav-btn-${viewKey}`);
    if (activeBtn) activeBtn.classList.add('active');

    const homeSection = document.getElementById('hubHomeSection');
    const cardsSection = document.getElementById('hubCardsSection');
    const newsSection = document.getElementById('hubNewsSection');
    const cardsTitle = document.getElementById('cardsViewTitle');
    const cardsSubtitle = document.getElementById('cardsViewSubtitle');

    if (viewKey === 'home') {
        if (homeSection) homeSection.style.display = 'block';
        if (cardsSection) cardsSection.style.display = 'none';
        if (newsSection) newsSection.style.display = 'none';
        renderTimelineView();
        renderHomeShowcaseGrid();
        if (window.dokkanNews) window.dokkanNews.renderHomeSnippet();
    } else if (viewKey === 'cards') {
        if (homeSection) homeSection.style.display = 'none';
        if (cardsSection) cardsSection.style.display = 'block';
        if (newsSection) newsSection.style.display = 'none';

        if (cardsTitle && cardsSubtitle) {
            if (currentSourceFilter === 'official') {
                cardsTitle.textContent = 'Official Dokkan Database';
                cardsSubtitle.textContent = 'Complete official archive of characters and awakenings';
            } else if (currentSourceFilter === 'custom') {
                cardsTitle.textContent = 'Custom Dokkan Cards';
                cardsSubtitle.textContent = 'Exclusive community and fan-made Dokkan creations';
            } else {
                cardsTitle.textContent = 'Complete Dokkan Database';
                cardsSubtitle.textContent = 'Search and filter across official and custom creations';
            }
        }

        filterCards(true);
    } else if (viewKey === 'news') {
        if (homeSection) homeSection.style.display = 'none';
        if (cardsSection) cardsSection.style.display = 'none';
        if (newsSection) newsSection.style.display = 'block';

        if (window.dokkanNews) {
            window.dokkanNews.renderNewsSection();
            if (sourceKey === 'discord' || sourceKey === 'game') {
                window.dokkanNews.setNewsSource(sourceKey);
            }
        }
    }
}

function handleSearchInput(val) {
    searchQuery = (val || '').trim().toLowerCase();
    filterCards(true);
}

function getCardFolderId(cardId) {
    let rawId = typeof cardId === 'number' ? cardId : parseInt(cardId, 10) || 0;
    if (rawId > 10000000) rawId = Math.floor(rawId / 10);
    return Math.floor(rawId / 10) * 10;
}

function getCardParentId(cardId) {
    let rawId = typeof cardId === 'number' ? cardId : parseInt(cardId, 10) || 0;
    if (rawId > 10000000) rawId = Math.floor(rawId / 10);
    let str = String(rawId);
    if (str.length === 7 && str.startsWith('4')) {
        return parseInt('1' + str.substring(1), 10);
    }
    return rawId;
}

function getCardClassAndType(elementId) {
    const alignment = Math.floor((elementId || 0) / 10);
    const typeIndex = (elementId || 0) % 10;
    const types = { 0: "agl", 1: "teq", 2: "int", 3: "str", 4: "phy" };
    return { 
        cardClass: alignment === 2 ? "extreme" : "super", 
        cardType: types[typeIndex] || "agl" 
    };
}

function generateCardHtml(c) {
    const folderId = getCardFolderId(c.id);
    const parentFolderId = Math.floor(getCardParentId(c.id) / 10) * 10;
    const { cardClass } = getCardClassAndType(c.element !== undefined ? c.element : 0);
    const cardType = c.type || "agl";
    const isLR = (c.rarity === 5 || c.rarity === 'lr');
    const isSeza = !!c.isSeza;
    const isEza = !!c.isEza && !isSeza;
    const rarityKey = isLR ? 'LR' : ((c.rarity === 4 || c.rarity === 'tur') ? 'TUR' : 'SSR');
    
    const rarityFilename = rarityKey === 'SSR' ? 'rarity_ssr.png' : `rarity_${rarityKey}.png`;
    const raritySrc = `${CENTRAL_ASSET_URL}${rarityFilename}`;
    const frameSrc = `${CENTRAL_ASSET_URL}frame_${cardType}.png`;
    const typeSrc = (rarityKey === 'SSR') ? `${CENTRAL_ASSET_URL}type_${cardType}.png` : `${CENTRAL_ASSET_URL}${cardClass}_type_${cardType}.png`;

    const thumbUrl = c.thumbUrl || `./assets/thumb/card_${folderId}_thumb/card_${folderId}_thumb.png`;

    let lrOverlayHtml = '';
    if (isLR) {
        lrOverlayHtml = `<img class="lr-dial" src="${CENTRAL_ASSET_URL}lr_spin_dial.png" loading="lazy">`;
    }

    let awakeningBadgeHtml = '';
    if (isSeza) {
        awakeningBadgeHtml = `<img class="hub-eza-badge" src="${CENTRAL_ASSET_URL}superza_abs.png">`;
    } else if (isEza) {
        awakeningBadgeHtml = `<img class="hub-eza-badge" src="${CENTRAL_ASSET_URL}eza_abs.png">`;
    }

    const sezaGlowClass = isSeza ? 'seza-glow-card' : '';
    const targetUrl = c.source === 'custom' ? c.cardUrl : `card.html?id=${c.id}`;
    const targetAttr = c.source === 'custom' ? 'target="_blank"' : '';

    return `
<a href="${targetUrl}" ${targetAttr} class="char-box" data-source="${c.source}" data-tag="${c.tag || 'a'}" data-type="${cardType}" data-seza="${isSeza ? 'true' : 'false'}" data-rarity="${rarityKey.toLowerCase()}">
    <div class="card-icon ${sezaGlowClass}">
        <img class="frame" src="${frameSrc}" loading="lazy">
        ${lrOverlayHtml}
        <img class="char-img" src="${thumbUrl}" loading="lazy" onerror="window.handleHubThumbError(this, '${folderId}', '${parentFolderId}')">
        <img class="rarity" src="${raritySrc}" loading="lazy">
        <img class="type" src="${typeSrc}" loading="lazy">
        ${awakeningBadgeHtml}
    </div>
    <div class="name-container">
        <div class="char-name-wrapper">
            <span class="char-name">${c.name}</span>
        </div>
    </div>
</a>`;
}

function generateTimelineRowHtml(c) {
    const folderId = getCardFolderId(c.id);
    const parentFolderId = Math.floor(getCardParentId(c.id) / 10) * 10;
    const { cardClass } = getCardClassAndType(c.element !== undefined ? c.element : 0);
    const cardType = c.type || "agl";
    const isLR = (c.rarity === 5 || c.rarity === 'lr');
    const isSeza = !!c.isSeza;
    const isEza = !!c.isEza && !isSeza;
    const rarityKey = isLR ? 'LR' : ((c.rarity === 4 || c.rarity === 'tur') ? 'TUR' : 'SSR');
    
    const rarityFilename = rarityKey === 'SSR' ? 'rarity_ssr.png' : `rarity_${rarityKey}.png`;
    const raritySrc = `${CENTRAL_ASSET_URL}${rarityFilename}`;
    const frameSrc = `${CENTRAL_ASSET_URL}frame_${cardType}.png`;
    const typeSrc = (rarityKey === 'SSR') ? `${CENTRAL_ASSET_URL}type_${cardType}.png` : `${CENTRAL_ASSET_URL}${cardClass}_type_${cardType}.png`;

    const thumbUrl = c.thumbUrl || `./assets/thumb/card_${folderId}_thumb/card_${folderId}_thumb.png`;

    let lrOverlayHtml = '';
    if (isLR) {
        lrOverlayHtml = `<img class="tl-lr-dial" src="${CENTRAL_ASSET_URL}lr_spin_dial.png" loading="lazy">`;
    }

    let awakeningBadgeHtml = '';
    if (isSeza) {
        awakeningBadgeHtml = `<img class="tl-eza-badge" src="${CENTRAL_ASSET_URL}superza_abs.png">`;
    } else if (isEza) {
        awakeningBadgeHtml = `<img class="tl-eza-badge" src="${CENTRAL_ASSET_URL}eza_abs.png">`;
    }

    const targetUrl = c.source === 'custom' ? c.cardUrl : `card.html?id=${c.id}`;
    const targetAttr = c.source === 'custom' ? 'target="_blank"' : '';

    return `
    <a href="${targetUrl}" ${targetAttr} class="timeline-entry-row">
        <div class="timeline-composed-icon">
            <img class="tl-frame" src="${frameSrc}" loading="lazy">
            ${lrOverlayHtml}
            <img class="tl-char-img" src="${thumbUrl}" loading="lazy" onerror="window.handleHubThumbError(this, '${folderId}', '${parentFolderId}')">
            <img class="tl-rarity" src="${raritySrc}" loading="lazy">
            <img class="tl-type" src="${typeSrc}" loading="lazy">
            ${awakeningBadgeHtml}
        </div>
        <div class="timeline-row-name-box">
            <span class="timeline-row-name">${c.name}</span>
            <span class="timeline-row-sub">${rarityKey} • ${cardType.toUpperCase()} ${isSeza ? '• SUPER EZA' : (isEza ? '• EZA' : '')}</span>
        </div>
    </a>`;
}

function mountGridSezaFlames() {
    if (currentFxMode === 'no-seza' || currentFxMode === 'static') return;
    if (typeof window.DokkanLWF === 'undefined' || !window.DokkanLWF.attachSezaFlameBorder) {
        setTimeout(mountGridSezaFlames, 120);
        return;
    }

    document.querySelectorAll('.char-box[data-seza="true"]').forEach(box => {
        const iconContainer = box.querySelector('.card-icon');
        const cardType = box.getAttribute('data-type') || 'agl';
        if (iconContainer && !iconContainer.querySelector('.seza-lwf-border-canvas')) {
            window.DokkanLWF.attachSezaFlameBorder(iconContainer, cardType);
        }
    });
}

function checkAndEnableTextScrolling() {
    document.querySelectorAll('.char-box').forEach(box => {
        const container = box.querySelector('.name-container');
        const wrapper = box.querySelector('.char-name-wrapper');
        const textSpan = box.querySelector('.char-name');

        if (container && wrapper && textSpan) {
            if (textSpan.scrollWidth > container.clientWidth - 4) {
                if (!wrapper.classList.contains('marquee-active')) {
                    wrapper.classList.add('marquee-active');
                    const rawName = textSpan.textContent;
                    wrapper.innerHTML = `
                        <div class="marquee-track">
                            <span class="char-name">${rawName}</span>
                            <span class="marquee-spacer">✦</span>
                            <span class="char-name">${rawName}</span>
                        </div>
                    `;
                }
            }
        }
    });
}

function formatTimelineDateTime(timestamp) {
    if (!timestamp || timestamp === 0) return null;
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return null;

    const datePart = d.toLocaleDateString("en-US", { 
        timeZone: "America/New_York", 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });

    const timePart = d.toLocaleTimeString("en-US", { 
        timeZone: "America/New_York", 
        hour: '2-digit', 
        minute: '2-digit', 
        hour12: false 
    }) + " EST";

    return {
        fullLabel: `${datePart} • ${timePart}`,
        dateOnly: datePart,
        timeOnly: timePart
    };
}

function renderTimelineView() {
    const timelineStream = document.getElementById('timelineNodesStream');
    if (!timelineStream) return;

    const sourceList = (allCardItems && allCardItems.length > 0) 
        ? allCardItems 
        : (window.rawCustomCards || []);

    const dokkanMinTime = new Date("2015-01-30T00:00:00Z").getTime();

    // On Home view, timeline shows all official and custom releases chronologically
    const validCards = sourceList.filter(item => {
        if (!item.sortTime || item.sortTime < dokkanMinTime) return false;
        return true;
    });

    if (validCards.length === 0) {
        timelineStream.innerHTML = `<div style="padding: 30px; text-align: center; color: #94a3b8; font-weight: 700; font-size: 13px;">Loading release timeline...</div>`;
        return;
    }

    const groupsMap = new Map();

    validCards.forEach(c => {
        const dtInfo = formatTimelineDateTime(c.sortTime);
        if (!dtInfo) return;

        const dateKey = dtInfo.fullLabel;
        if (!groupsMap.has(dateKey)) {
            groupsMap.set(dateKey, {
                dateLabel: dtInfo.fullLabel,
                sortTime: c.sortTime,
                cards: []
            });
        }
        groupsMap.get(dateKey).cards.push(c);
    });

    const timelineGroups = Array.from(groupsMap.values()).sort((a, b) => b.sortTime - a.sortTime);
    const renderBatches = timelineGroups.slice(0, 35);

    let timelineHtml = '';

    renderBatches.forEach(batch => {
        const hasCustom = batch.cards.some(c => c.source === 'custom');
        const hasSeza = batch.cards.some(c => c.isSeza);
        const hasEza = batch.cards.some(c => c.isEza && !c.isSeza);
        const hasNew = batch.cards.some(c => !c.isEza && !c.isSeza);

        let badgesHtml = '';
        if (hasCustom) badgesHtml += `<span class="timeline-tag tag-custom">CUSTOM</span>`;
        if (hasSeza) badgesHtml += `<span class="timeline-tag tag-seza">SEZA</span>`;
        if (hasEza) badgesHtml += `<span class="timeline-tag tag-eza">EZA</span>`;
        if (hasNew) badgesHtml += `<span class="timeline-tag tag-new">NEW</span>`;

        const entriesHtml = batch.cards.map(c => generateTimelineRowHtml(c)).join('\n');

        timelineHtml += `
        <div class="timeline-node-item">
            <div class="timeline-node-marker"></div>
            <div class="timeline-node-card">
                <div class="timeline-node-header">
                    <span class="timeline-node-date">${batch.dateLabel}</span>
                    <div class="timeline-node-tags">${badgesHtml}</div>
                </div>
                <div class="timeline-entries-list">
                    ${entriesHtml}
                </div>
            </div>
        </div>`;
    });

    timelineStream.innerHTML = timelineHtml;
}

window.attachSmoothHorizontalScroll = function(el, autoScrollSpeed = 0.28) {
    if (!el) return;
    
    // Stop any existing animation on this element
    if (el._hAutoScrollId) {
        cancelAnimationFrame(el._hAutoScrollId);
        el._hAutoScrollId = null;
    }

    if (!el.dataset.hScrollAttached) {
        el.dataset.hScrollAttached = "true";

        let isDown = false;
        let startX = 0;
        let scrollStart = 0;
        let hasMoved = false;
        let isUserInteracting = false;
        let resumeTimer = null;

        const pauseTemporarily = (duration = 2000) => {
            isUserInteracting = true;
            clearTimeout(resumeTimer);
            resumeTimer = setTimeout(() => {
                isUserInteracting = false;
            }, duration);
        };

        // Mouse Wheel horizontal scrolling
        el.addEventListener('wheel', (e) => {
            if (e.deltaY !== 0) {
                e.preventDefault();
                el.scrollLeft += e.deltaY;
                pauseTemporarily(2000);
            }
        }, { passive: false });

        // Hover movement pause
        el.addEventListener('mousemove', (e) => {
            if (isDown) {
                const x = e.pageX - el.offsetLeft;
                const walk = (x - startX) * 1.5;
                if (Math.abs(walk) > 4) {
                    hasMoved = true;
                }
                el.scrollLeft = scrollStart - walk;
            }
            pauseTemporarily(2500);
        });

        el.addEventListener('mouseleave', () => { 
            if (!isDown) {
                isUserInteracting = false;
                clearTimeout(resumeTimer);
            }
        });

        // Touch support
        el.addEventListener('touchstart', () => { pauseTemporarily(3000); }, { passive: true });
        el.addEventListener('touchmove', () => { pauseTemporarily(3000); }, { passive: true });
        el.addEventListener('touchend', () => { pauseTemporarily(1500); }, { passive: true });

        // Mouse Drag to scroll
        el.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            isDown = true;
            isUserInteracting = true;
            hasMoved = false;
            startX = e.pageX - el.offsetLeft;
            scrollStart = el.scrollLeft;
        });

        window.addEventListener('mouseup', () => {
            if (isDown) {
                isDown = false;
                pauseTemporarily(1200);
            }
        });

        window.addEventListener('blur', () => {
            isDown = false;
            isUserInteracting = false;
        });

        el.addEventListener('click', (e) => {
            if (hasMoved) {
                e.preventDefault();
                e.stopPropagation();
                hasMoved = false;
            }
        }, true);

        el._checkInteracting = () => isUserInteracting;
    }

    // Continuous Smooth Infinite Auto-Scroll Loop
    let subPixelAcc = 0;
    function autoScrollTick() {
        const isPaused = el._checkInteracting ? el._checkInteracting() : false;
        const maxScroll = el.scrollWidth - el.clientWidth;

        if (!isPaused && maxScroll > 5) {
            subPixelAcc += autoScrollSpeed;
            if (subPixelAcc >= 1) {
                const px = Math.floor(subPixelAcc);
                subPixelAcc -= px;
                el.scrollLeft += px;

                // Dynamically measure singleSetWidth with exact screen coordinate precision
                let singleSetWidth = parseFloat(el.dataset.singleSetWidth);
                if (!singleSetWidth) {
                    const firstChild = el.firstElementChild;
                    const setLen = parseInt(el.dataset.setLength, 10);
                    if (firstChild && setLen && el.children[setLen]) {
                        const r0 = firstChild.getBoundingClientRect();
                        const rN = el.children[setLen].getBoundingClientRect();
                        singleSetWidth = Math.round(rN.left - r0.left);
                        if (singleSetWidth > 50) el.dataset.singleSetWidth = String(singleSetWidth);
                    }
                }

                // Seamless infinite marquee wrap (imperceptible zero-jump loop)
                if (singleSetWidth > 0 && el.scrollLeft >= singleSetWidth) {
                    el.scrollLeft -= singleSetWidth;
                } else if (el.scrollLeft >= maxScroll - 2) {
                    el.scrollLeft = 0;
                }
            }
        }
        el._hAutoScrollId = requestAnimationFrame(autoScrollTick);
    }
    el._hAutoScrollId = requestAnimationFrame(autoScrollTick);
};

let currentInlineType = 'all';
let currentInlineRarity = 'all';

function setInlineSourceFilter(sourceVal, btnEl) {
    currentSourceFilter = sourceVal;
    if (btnEl && btnEl.parentElement) {
        btnEl.parentElement.querySelectorAll('.filter-pill-btn').forEach(b => b.classList.remove('active'));
        btnEl.classList.add('active');
    }
    filterCards(true);
}

function setInlineTypeFilter(typeVal, btnEl) {
    currentInlineType = typeVal;
    const typeSelect = document.getElementById('typeFilter');
    if (typeSelect) typeSelect.value = typeVal;
    if (btnEl && btnEl.parentElement) {
        btnEl.parentElement.querySelectorAll('.filter-pill-btn').forEach(b => b.classList.remove('active'));
        btnEl.classList.add('active');
    }
    filterCards(true);
}

function setInlineRarityFilter(rarityVal, btnEl) {
    currentInlineRarity = rarityVal;
    const rarSelect = document.getElementById('rarityFilter');
    if (rarSelect) rarSelect.value = rarityVal;
    if (btnEl && btnEl.parentElement) {
        btnEl.parentElement.querySelectorAll('.filter-pill-btn').forEach(b => b.classList.remove('active'));
        btnEl.classList.add('active');
    }
    filterCards(true);
}

function resetAllInlineFilters() {
    currentSourceFilter = 'all';
    currentInlineType = 'all';
    currentInlineRarity = 'all';
    searchQuery = '';

    const searchInput = document.getElementById('cardSearchInput');
    if (searchInput) searchInput.value = '';

    const typeSelect = document.getElementById('typeFilter');
    if (typeSelect) typeSelect.value = 'all';

    const rarSelect = document.getElementById('rarityFilter');
    if (rarSelect) rarSelect.value = 'all';

    const formSelect = document.getElementById('formFilter');
    if (formSelect) formSelect.value = 'all';

    document.querySelectorAll('.cards-inline-filter-bar .filter-pill-group').forEach(group => {
        group.querySelectorAll('.filter-pill-btn').forEach(btn => {
            if (btn.dataset.value === 'all') btn.classList.add('active');
            else btn.classList.remove('active');
        });
    });

    filterCards(true);
}

function renderHomeShowcaseGrid() {
    const homeGrid = document.getElementById('homeCardGrid');
    if (!homeGrid) return;

    const customOnly = allCardItems.filter(c => c.source === 'custom');
    const baseList = customOnly.length > 0 ? customOnly : allCardItems.slice(0, 48);

    // Quadruple cards for an expansive buffer and seamless infinite loop
    const displayList = [...baseList, ...baseList, ...baseList, ...baseList];

    homeGrid.innerHTML = displayList.map(item => generateCardHtml(item)).join('\n');
    homeGrid.dataset.setLength = String(baseList.length);

    const measureAndAttach = () => {
        const cards = homeGrid.querySelectorAll('.char-box');
        if (cards.length >= baseList.length * 2 && cards[baseList.length]) {
            const r0 = cards[0].getBoundingClientRect();
            const rN = cards[baseList.length].getBoundingClientRect();
            const trueDistance = Math.round(rN.left - r0.left);
            if (trueDistance > 50) {
                homeGrid.dataset.singleSetWidth = String(trueDistance);
            }
        }
        if (window.attachSmoothHorizontalScroll) {
            window.attachSmoothHorizontalScroll(homeGrid, 0.28);
        }
    };
    setTimeout(measureAndAttach, 60);
    setTimeout(measureAndAttach, 300);
}

function filterCards(resetPage = true) {
    if (currentHubView === 'home') {
        renderTimelineView();
        renderHomeShowcaseGrid();
        return;
    }

    if (resetPage) currentPage = 1;

    const selectedType = document.getElementById('typeFilter')?.value || currentInlineType || 'all';
    const selectedForm = document.getElementById('formFilter')?.value || 'all';
    const selectedRarity = document.getElementById('rarityFilter')?.value || currentInlineRarity || 'all';

    filteredCardItems = allCardItems.filter(item => {
        const matchesSource = (currentSourceFilter === 'all' || item.source === currentSourceFilter);
        const matchesType = (selectedType === 'all' || item.type === selectedType);
        const matchesForm = (selectedForm === 'all' || item.tag === selectedForm);
        const matchesRarity = (selectedRarity === 'all' || item.rarity === selectedRarity);

        let matchesSearch = true;
        if (searchQuery.length > 0) {
            const nameMatch = (item.name || '').toLowerCase().includes(searchQuery);
            const idMatch = String(item.id || '').toLowerCase().includes(searchQuery);
            matchesSearch = nameMatch || idMatch;
        }

        return matchesSource && matchesType && matchesForm && matchesRarity && matchesSearch;
    });

    renderCurrentPage();
}

function renderCurrentPage() {
    const totalPages = Math.max(1, Math.ceil(filteredCardItems.length / CARDS_PER_PAGE));
    if (currentPage > totalPages) currentPage = totalPages;

    const startIndex = (currentPage - 1) * CARDS_PER_PAGE;
    const endIndex = startIndex + CARDS_PER_PAGE;
    const pageSlice = filteredCardItems.slice(startIndex, endIndex);

    const grid = document.getElementById('cardGrid');
    if (!grid) return;

    if (pageSlice.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1/-1; padding: 50px 20px; color: #94a3b8; font-weight: 800; font-size: 15px;">No cards found matching your search.</div>`;
    } else {
        grid.innerHTML = pageSlice.map(item => generateCardHtml(item)).join('\n');
        mountGridSezaFlames();
        checkAndEnableTextScrolling();
    }

    renderPaginationControls(totalPages);
}

function renderPaginationControls(totalPages) {
    const topContainer = document.getElementById('paginationTop');
    const bottomContainer = document.getElementById('paginationBottom');

    if (filteredCardItems.length <= CARDS_PER_PAGE) {
        if (topContainer) topContainer.innerHTML = '';
        if (bottomContainer) bottomContainer.innerHTML = '';
        return;
    }

    const html = `
    <div class="hub-pagination-control">
        <button type="button" aria-label="prev" class="hub-page-nav-btn" onclick="changePage(-1)" ${currentPage <= 1 ? 'disabled' : ''}>
            <svg width="22" height="22" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.499 12.85a.9.9 0 0 1 .57.205l.067.06a.9.9 0 0 1 .06 1.206l-.06.066-5.585 5.586-.028.027.028.027 5.585 5.587a.9.9 0 0 1 .06 1.207l-.06.066a.9.9 0 0 1-1.207.06l-.066-.06-6.25-6.25a1 1 0 0 1-.158-.212l-.038-.08a.9.9 0 0 1-.03-.606l.03-.083a1 1 0 0 1 .137-.226l.06-.066 6.25-6.25a.9.9 0 0 1 .635-.263Z" fill="currentColor" stroke="currentColor" stroke-width=".078"/>
            </svg>
        </button>

        <span class="hub-page-status">Page ${currentPage} of ${totalPages} (${filteredCardItems.length} Cards)</span>

        <button type="button" aria-label="next" class="hub-page-nav-btn" onclick="changePage(1)" ${currentPage >= totalPages ? 'disabled' : ''}>
            <svg class="flip-right" width="22" height="22" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.499 12.85a.9.9 0 0 1 .57.205l.067.06a.9.9 0 0 1 .06 1.206l-.06.066-5.585 5.586-.028.027.028.027 5.585 5.587a.9.9 0 0 1 .06 1.207l-.06.066a.9.9 0 0 1-1.207.06l-.066-.06-6.25-6.25a1 1 0 0 1-.158-.212l-.038-.08a.9.9 0 0 1-.03-.606l.03-.083a1 1 0 0 1 .137-.226l.06-.066 6.25-6.25a.9.9 0 0 1 .635-.263Z" fill="currentColor" stroke="currentColor" stroke-width=".078"/>
            </svg>
        </button>
    </div>`;

    if (topContainer) topContainer.innerHTML = html;
    if (bottomContainer) bottomContainer.innerHTML = html;
}

function changePage(delta) {
    const totalPages = Math.ceil(filteredCardItems.length / CARDS_PER_PAGE);
    const newPage = currentPage + delta;

    if (newPage >= 1 && newPage <= totalPages) {
        currentPage = newPage;
        renderCurrentPage();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function resetFilters() {
    if (document.getElementById('typeFilter')) document.getElementById('typeFilter').value = 'all';
    if (document.getElementById('formFilter')) document.getElementById('formFilter').value = 'all';
    if (document.getElementById('rarityFilter')) document.getElementById('rarityFilter').value = 'all';
    if (document.getElementById('cardSearchInput')) document.getElementById('cardSearchInput').value = '';
    searchQuery = '';
    handleSourceChange('all');
}

function parseReleaseTime(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return 0;
    if (dateStr.includes('2015-10-30') || dateStr.startsWith('2010') || dateStr.startsWith('1970') || dateStr === 'TBD') return 0;
    try {
        const iso = dateStr.replace(" ", "T") + (dateStr.includes("Z") ? "" : "Z");
        const t = new Date(iso).getTime();
        const dokkanMinEpoch = new Date("2015-01-30T00:00:00Z").getTime();
        return (!isNaN(t) && t >= dokkanMinEpoch) ? t : 0;
    } catch(e) {
        return 0;
    }
}

async function fetchJsonWithFallback(filename) {
    const paths = [`json/${filename}`, filename, `./json/${filename}`, `./${filename}`];
    for (const p of paths) {
        try {
            const res = await fetch(p);
            if (res.ok) return await res.json();
        } catch (e) {}
    }
    return null;
}

async function loadOfficialDatabaseCards() {
    try {
        const [rawCards, rawRoutes] = await Promise.all([
            fetchJsonWithFallback('cards.json'),
            fetchJsonWithFallback('awakening_routes.json')
        ]);

        if (!rawCards) return [];

        const unawakenedSourceCardIds = new Set();
        const cardEzaRouteDates = new Map();
        const cardSezaRouteDates = new Map();
        const cardDokkanRouteDates = new Map();

        if (rawRoutes && Array.isArray(rawRoutes)) {
            rawRoutes.forEach(r => {
                const srcId = parseInt(r.card_id, 10);
                const targetId = parseInt(r.awaked_card_id, 10);
                const rType = String(r.type || '');
                const optType = r.optimal_awakening_type;
                const dt = r.open_at || r.start_at;
                const parsedT = parseReleaseTime(dt);

                if (srcId && targetId && srcId !== targetId && (rType.includes('Dokkan') || rType.includes('Zet'))) {
                    unawakenedSourceCardIds.add(srcId);
                }

                if (parsedT > 0) {
                    const normSrc = srcId > 10000000 ? Math.floor(srcId / 10) : srcId;
                    const normTgt = targetId > 10000000 ? Math.floor(targetId / 10) : targetId;

                    if (optType === 2) {
                        cardSezaRouteDates.set(normSrc, Math.max(cardSezaRouteDates.get(normSrc) || 0, parsedT));
                        cardSezaRouteDates.set(normTgt, Math.max(cardSezaRouteDates.get(normTgt) || 0, parsedT));
                    } else if (optType === 1 || rType.includes('Optimal')) {
                        cardEzaRouteDates.set(normSrc, Math.max(cardEzaRouteDates.get(normSrc) || 0, parsedT));
                        cardEzaRouteDates.set(normTgt, Math.max(cardEzaRouteDates.get(normTgt) || 0, parsedT));
                    } else {
                        cardDokkanRouteDates.set(normTgt, Math.max(cardDokkanRouteDates.get(normTgt) || 0, parsedT));
                    }
                }
            });
        }

        const ezaMap = new Map();
        const sezaMap = new Map();

        rawCards.forEach(c => {
            const cid = parseInt(c.id, 10);
            if (c.is_seza || (String(cid).length >= 8 && String(cid).endsWith('9'))) {
                const pId = c.parent_id || Math.floor(cid / 10);
                sezaMap.set(pId, c);
                sezaMap.set(cid, c);
                sezaMap.set(Math.floor(cid / 10), c);
            } else if (c.is_eza || (String(cid).length >= 8 && String(cid).endsWith('8'))) {
                const pId = c.parent_id || Math.floor(cid / 10);
                ezaMap.set(pId, c);
                ezaMap.set(cid, c);
                ezaMap.set(Math.floor(cid / 10), c);
            }
        });

        const hubCards = rawCards.filter(c => {
            const rawId = parseInt(c.id, 10);
            if (String(rawId).length >= 8) return false;
            if (rawId < 4000000 && unawakenedSourceCardIds.has(rawId)) return false;
            return true;
        });

        const nowPlus30Days = Date.now() + (30 * 24 * 60 * 60 * 1000);

        return hubCards.map(c => {
            const rawId = parseInt(c.id, 10);
            const isTrans = rawId >= 4000000 && rawId < 5000000;
            const parentId = c.parent_id || getCardParentId(rawId);
            const parentCard = rawCards.find(p => parseInt(p.id, 10) === parentId);
            const { cardClass, cardType } = getCardClassAndType(c.element !== undefined ? c.element : 0);

            let rarityKey = 'tur';
            if (c.rarity === 5 || c.max_level === 150 || (parentCard && parentCard.rarity === 5)) {
                rarityKey = 'lr';
            } else if (c.rarity === 3) {
                rarityKey = 'ssr';
            }

            let baseTime = cardDokkanRouteDates.get(parentId) || cardDokkanRouteDates.get(rawId) || parseReleaseTime(c.open_at || c.start_at || c.release_date);
            const ezaCard = ezaMap.get(parentId) || ezaMap.get(rawId) || ezaMap.get(rawId * 10 + 8);
            let ezaTime = cardEzaRouteDates.get(parentId) || cardEzaRouteDates.get(rawId) || (ezaCard ? parseReleaseTime(ezaCard.open_at || ezaCard.start_at) : 0);
            const sezaCard = sezaMap.get(parentId) || sezaMap.get(rawId) || sezaMap.get(rawId * 10 + 9);
            let sezaTime = cardSezaRouteDates.get(parentId) || cardSezaRouteDates.get(rawId) || (sezaCard ? parseReleaseTime(sezaCard.open_at || sezaCard.start_at) : 0);

            const hasSeza = !!sezaCard || sezaTime > 0 || c.is_seza === true;
            const hasEza = !!ezaCard || ezaTime > 0 || hasSeza || c.is_eza === true;
            const isFuture = (baseTime > nowPlus30Days || ezaTime > nowPlus30Days || sezaTime > nowPlus30Days);

            let effectiveTime = Math.max(
                baseTime < nowPlus30Days ? baseTime : 0,
                ezaTime < nowPlus30Days ? ezaTime : 0,
                sezaTime < nowPlus30Days ? sezaTime : 0
            );

            if (effectiveTime === 0 && !isFuture) effectiveTime = parentId;

            return {
                id: c.id,
                parentId: parentId,
                name: c.name,
                source: 'official',
                tag: isTrans ? 'b' : 'a',
                type: cardType,
                rarity: rarityKey,
                element: c.element,
                cardClass: cardClass,
                sortTime: effectiveTime,
                isFuture: isFuture,
                isEza: hasEza,
                isSeza: hasSeza
            };
        });
    } catch (err) {
        console.warn("Could not load cards.json:", err);
        return [];
    }
}

async function loadCustomCards() {
    const cachedCustom = localStorage.getItem('hub_cached_custom_only');
    let customCardsArray = [];
    if (cachedCustom) {
        try { customCardsArray = JSON.parse(cachedCustom); } catch(e) {}
    }

    try {
        const repoRes = await fetch('https://api.github.com/repos/abscustom/abscustom.github.io/contents/');
        if (!repoRes.ok) return customCardsArray;

        const contents = await repoRes.json();
        const ignored = ['DokkanCustom', 'CardEditor', 'images', 'css', 'js', 'js2', 'assets', 'json', '.github'];
        const cardFolders = contents.filter(item => 
            item.type === 'dir' && !ignored.includes(item.name) && !item.name.startsWith('.')
        );

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

                const tag = doc.querySelector('meta[name="hub-id"]')?.getAttribute('content') || 'a';
                let charName = doc.querySelector('#char-name')?.textContent?.trim() || '';
                if (!charName) {
                    const rawTitle = doc.querySelector('title')?.textContent || folderName;
                    charName = rawTitle.replace(/^\[.*?\]\s*/, '').trim();
                }

                const fixUrl = (src, fallback) => {
                    if (!src) return fallback;
                    if (src.startsWith('http')) return src;
                    return `${cardUrl}${src.replace(/^\.\//, '')}`;
                };

                const rarityAttr = doc.querySelector('#main-rarity-icon')?.getAttribute('src') || 'rarity_LR.png';
                const isLR = rarityAttr.toLowerCase().includes('lr');
                const isSSR = rarityAttr.toLowerCase().includes('ssr');
                const rarityKey = isLR ? 'lr' : (isSSR ? 'ssr' : 'tur');

                const iconEl = doc.querySelector(isLR ? '#img-lr' : (isSSR ? '#img-ssr' : '#img-tur')) || doc.querySelector('#abs-thumb-img');
                const charImgSrc = fixUrl(iconEl?.getAttribute('src'), `${CENTRAL_ASSET_URL}SSR_Icon.png`);

                const frameAttr = doc.querySelector('.card-frame')?.getAttribute('src') || 'frame_agl.png';
                const typeImgAttr = doc.querySelector('.typing-icon')?.getAttribute('src') || 'super_type_agl.png';
                
                let cardClass = typeImgAttr.includes('extreme') ? 'extreme' : 'super';
                let cardType = 'agl';
                if (frameAttr.includes('teq')) cardType = 'teq';
                else if (frameAttr.includes('int')) cardType = 'int';
                else if (frameAttr.includes('str')) cardType = 'str';
                else if (frameAttr.includes('phy')) cardType = 'phy';

                const dateText = doc.querySelector('#dateInput')?.getAttribute('value') || doc.querySelector('#dateInput')?.value || '';
                const parsedTime = parseReleaseTime(dateText);

                const isEzaCustom = htmlText.includes('eza_abs.png') || htmlText.includes('eza_img.png');
                const isSezaCustom = htmlText.includes('superza_abs.png') || htmlText.includes('supereza_img.png');

                freshCards.push({
                    id: folderName,
                    name: charName,
                    source: 'custom',
                    tag: tag,
                    type: cardType,
                    rarity: rarityKey,
                    cardUrl: cardUrl,
                    thumbUrl: charImgSrc,
                    cardClass: cardClass,
                    sortTime: parsedTime,
                    isFuture: false,
                    isEza: isEzaCustom,
                    isSeza: isSezaCustom
                });
            } catch (e) {}
        }

        if (freshCards.length > 0) {
            customCardsArray = freshCards;
            try { localStorage.setItem('hub_cached_custom_only', JSON.stringify(freshCards)); } catch(e) {}
        }

        return customCardsArray;
    } catch (e) {
        return customCardsArray;
    }
}

async function updateCharacterBox() {
    const btn = document.getElementById('update-box-btn');
    const originalText = btn ? btn.innerHTML : "";

    try {
        if (btn) {
            btn.innerHTML = `<span class="spinning">🔄</span> Syncing...`;
            btn.style.pointerEvents = 'none';
        }

        const [officialCards, customCards] = await Promise.all([
            loadOfficialDatabaseCards(),
            loadCustomCards()
        ]);

        const merged = [...officialCards, ...customCards];

        merged.sort((a, b) => {
            if (a.isFuture && !b.isFuture) return 1;
            if (!a.isFuture && b.isFuture) return -1;
            if (b.sortTime !== a.sortTime) return b.sortTime - a.sortTime;
            
            const parentA = a.parentId || getCardParentId(a.id);
            const parentB = b.parentId || getCardParentId(b.id);
            if (parentB !== parentA) {
                const pNumA = parseInt(parentA, 10) || 0;
                const pNumB = parseInt(parentB, 10) || 0;
                if (pNumB !== pNumA) return pNumB - pNumA;
            }

            const isTransA = typeof a.id === 'number' && a.id >= 4000000;
            const isTransB = typeof b.id === 'number' && b.id >= 4000000;
            if (isTransA !== isTransB) return isTransA ? 1 : -1;

            const numA = parseInt(a.id, 10) || 0;
            const numB = parseInt(b.id, 10) || 0;
            if (numA !== numB) return numA - numB;

            return String(a.id).localeCompare(String(b.id), undefined, { numeric: true });
        });

        allCardItems = merged;

        if (currentHubView === 'home') {
            renderTimelineView();
            renderHomeShowcaseGrid();
        } else {
            filterCards(true);
        }

    } catch (error) {
        console.error("Update Box Error:", error);
    } finally {
        if (btn) {
            btn.innerHTML = originalText;
            btn.style.pointerEvents = 'auto';
        }
        if (!window.absHomeContentReady) {
            window.absHomeContentReady = true;
            window.dispatchEvent(new Event('abs-home-content-ready'));
        }
    }
}

// ==========================================================================
// DOKKAN STREAMERS: SINGLE SELECTABLE LIVE PREVIEW
// ==========================================================================

const DOKKAN_STREAMER_CHANNELS = [
    { twitch: 'theironcane', youtube: 'ironcane', displayName: 'Iron' },
    { twitch: 'datruthdt', youtube: 'datruthdt', displayName: 'DaTruthDT' },
    { twitch: 'toonrami', youtube: 'ToonRami', displayName: 'Toon' },
    { twitch: 'slaybix', youtube: 'slaybix', displayName: 'Slay' },
    { twitch: 'nanogenix', youtube: 'Nanogenix', displayName: 'Nano' },
    { youtube: 'Goresh', displayName: 'Goresh', youtubeOnly: true },
];

const MAX_SELECTED_STREAMERS = 4;
let selectedStreamerIndexes = [];
let latestStreamerData = DOKKAN_STREAMER_CHANNELS.map((streamer, originalIndex) => ({
    ...streamer,
    originalIndex,
    isLive: false,
    avatar: streamer.youtubeOnly ? `https://unavatar.io/youtube/${streamer.youtube}` : null,
}));

function renderSelectedStreamerPreview() {
    const preview = document.getElementById('streamersLivePreview');
    if (!preview) return;

    document.querySelectorAll('.streamer-card-pill[data-streamer-index]').forEach((pill) => {
        const isSelected = selectedStreamerIndexes.includes(Number(pill.dataset.streamerIndex));
        pill.classList.toggle('is-selected', isSelected);
        pill.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
    });

    const selectedStreamers = selectedStreamerIndexes
        .map((index) => latestStreamerData.find((item) => item.originalIndex === index))
        .filter(Boolean);

    if (selectedStreamers.length === 0) {
        preview.innerHTML = '';
        return;
    }

    const parent = encodeURIComponent(window.location.hostname || 'localhost');
    preview.innerHTML = selectedStreamers.map((streamer) => {
        const twitchUrl = streamer.twitch ? `https://www.twitch.tv/${streamer.twitch}` : '';
        const youtubeUrl = `https://www.youtube.com/@${streamer.youtube}`;
        const channelLinks = `
            <span class="streamer-preview-channel-links">
                ${twitchUrl ? `<a href="${twitchUrl}" target="_blank" rel="noopener noreferrer">Twitch ↗</a>` : ''}
                <a href="${youtubeUrl}" target="_blank" rel="noopener noreferrer">YouTube ↗</a>
            </span>`;

        if (streamer.youtubeOnly) {
            return `
                <article class="streamer-live-preview is-youtube-preview">
                    <div class="streamer-live-preview-heading">
                        <strong>${streamer.displayName}</strong>
                        ${channelLinks}
                    </div>
                    <a class="streamer-youtube-preview-link" href="${youtubeUrl}" target="_blank" rel="noopener noreferrer" aria-label="Open ${streamer.displayName} on YouTube">
                        <img src="${streamer.avatar || ''}" alt="${streamer.displayName}">
                        <span>Open YouTube channel ↗</span>
                    </a>
                </article>`;
        }

        const liveLabel = streamer.isLive
            ? '<span class="streamer-selected-live-label"><span class="live-dot"></span>LIVE NOW</span>'
            : '<span class="streamer-selected-live-label is-offline">OFFLINE</span>';

        return `
            <article class="streamer-live-preview">
                <div class="streamer-live-preview-heading">
                    <strong>${streamer.displayName}</strong>
                    ${liveLabel}
                    ${channelLinks}
                </div>
                <div class="streamer-player-shell">
                    <iframe src="https://player.twitch.tv/?channel=${encodeURIComponent(streamer.twitch)}&parent=${parent}&autoplay=true&muted=true" title="${streamer.displayName} Twitch stream" allow="autoplay; fullscreen" allowfullscreen loading="eager"></iframe>
                </div>
            </article>`;
    }).join('');
}

function toggleStreamerPreview(index) {
    const selectedPosition = selectedStreamerIndexes.indexOf(index);
    if (selectedPosition >= 0) {
        selectedStreamerIndexes.splice(selectedPosition, 1);
    } else {
        if (selectedStreamerIndexes.length >= MAX_SELECTED_STREAMERS) {
            selectedStreamerIndexes.shift();
        }
        selectedStreamerIndexes.push(index);
    }
    renderSelectedStreamerPreview();
}

function renderStreamerPills(streamerData) {
    const track = document.getElementById('streamersHorizontalTrack');
    if (!track) return;

    track.innerHTML = streamerData.map((streamer) => {
        const initial = streamer.displayName.charAt(0).toUpperCase();
        const avatarClass = `streamer-avatar-circle${streamer.youtubeOnly ? ' is-yt-avatar' : ''}`;
        const avatarHtml = streamer.avatar
            ? `<img src="${streamer.avatar}" alt="${streamer.displayName}" class="${avatarClass}" style="object-fit: cover;" onerror="this.outerHTML='<span class=\\'${avatarClass}\\'>${initial}</span>';">`
            : `<span class="${avatarClass}">${initial}</span>`;

        const statusBadge = streamer.youtubeOnly
            ? '<span class="streamer-live-status is-youtube">YOUTUBE</span>'
            : streamer.isLive
                ? '<span class="streamer-live-status is-live"><span class="live-dot"></span>LIVE</span>'
                : '<span class="streamer-live-status is-offline">OFFLINE</span>';
        const isSelected = selectedStreamerIndexes.includes(streamer.originalIndex);

        return `
            <button type="button" class="streamer-card-pill ${streamer.youtubeOnly ? 'is-youtube-pill' : ''} ${streamer.isLive ? 'live-pill-glow' : ''} ${isSelected ? 'is-selected' : ''}" data-streamer-index="${streamer.originalIndex}" onclick="toggleStreamerPreview(${streamer.originalIndex})" aria-label="${isSelected ? 'Hide' : 'Show'} ${streamer.displayName}'s stream" aria-pressed="${isSelected}">
                ${avatarHtml}
                <span class="streamer-pill-name">${streamer.displayName}</span>
                ${statusBadge}
            </button>`;
    }).join('');

    renderSelectedStreamerPreview();
}

window.toggleStreamerPreview = toggleStreamerPreview;

async function updateTwitchStreamersStatus() {
    const track = document.getElementById('streamersHorizontalTrack');
    if (!track) return;

    renderStreamerPills(latestStreamerData);

    try {
        const results = await Promise.allSettled(
            DOKKAN_STREAMER_CHANNELS.map(async (streamer, originalIndex) => {
                if (streamer.youtubeOnly) {
                    return {
                        ...streamer,
                        originalIndex,
                        isLive: false,
                        avatar: `https://unavatar.io/youtube/${streamer.youtube}`,
                    };
                }

                try {
                    const [uptimeRes, avatarRes] = await Promise.allSettled([
                        fetch(`https://decapi.me/twitch/uptime/${streamer.twitch}`).then((response) => response.text()),
                        fetch(`https://decapi.me/twitch/avatar/${streamer.twitch}`).then((response) => response.text()),
                    ]);

                    const uptimeText = (uptimeRes.status === 'fulfilled' ? uptimeRes.value : '').trim();
                    const avatarUrl = (avatarRes.status === 'fulfilled' ? avatarRes.value : '').trim();
                    const statusText = uptimeText.toLowerCase();
                    const isLive = Boolean(uptimeText)
                        && !statusText.includes('offline')
                        && !statusText.includes('not found')
                        && !statusText.includes('error');

                    return {
                        ...streamer,
                        originalIndex,
                        isLive,
                        uptime: isLive ? uptimeText : null,
                        avatar: avatarUrl.startsWith('http') ? avatarUrl : null,
                    };
                } catch (error) {
                    return { ...streamer, originalIndex, isLive: false, avatar: null };
                }
            }),
        );

        latestStreamerData = results.map((result, index) => result.status === 'fulfilled'
            ? result.value
            : { ...DOKKAN_STREAMER_CHANNELS[index], originalIndex: index, isLive: false, avatar: null });

        latestStreamerData.sort((first, second) => {
            if (first.isLive && !second.isLive) return -1;
            if (!first.isLive && second.isLive) return 1;
            return first.originalIndex - second.originalIndex;
        });

        renderStreamerPills(latestStreamerData);
    } catch (error) {
        console.warn('Streamers status check failed:', error);
    }
}

window.addEventListener('DOMContentLoaded', async () => {
    setAppStyle(currentAppStyle);
    
    const fxSelect = document.getElementById('fxToggleSelect');
    if (fxSelect) fxSelect.value = currentFxMode;
    setFxAnimationMode(currentFxMode);

    const urlParams = new URLSearchParams(window.location.search);
    const viewParam = urlParams.get('view');
    const subParam = urlParams.get('sub');

    if (viewParam === 'news') {
        switchHubView('news', subParam || 'discord');
    } else if (viewParam === 'cards' || localStorage.getItem('hub_force_cards_view') === 'true') {
        localStorage.removeItem('hub_force_cards_view');
        switchHubView('cards');
    }

    updateTwitchStreamersStatus();
    setInterval(updateTwitchStreamersStatus, 120000); // Auto-refresh live status every 2 minutes

    await updateCharacterBox();
});
