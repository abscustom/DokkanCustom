/* ==========================================================================
   absCustom - Linking Partners Calculation & Filtering Engine
   ========================================================================== */

const ABS_CLEAN_PARTNER_PREVIEW_LIMIT = 5;

// Clean partner portraits must resolve from the partner card itself. The old
// renderer asked the generic art resolver for a thumbnail first, which can
// point at the active card's shared/fallback art on imported snapshots. Use
// the card's circle export as the primary source and only fall back to that
// same partner's thumbnail when a circle file is unavailable.
function getAbsCleanPartnerAssetPrefix() {
    return './';
}

function getAbsCleanPartnerCircleUrl(card) {
    const explicit = [
        card?.circle_url,
        card?.circleUrl,
        card?.circle_art_url,
        card?.circleArtUrl,
        card?.circle_thumb_url,
        card?.circleThumbUrl,
        card?.portrait_url,
        card?.portraitUrl,
        card?.images?.circle,
        card?.assets?.circle
    ].find(value => String(value || '').trim());
    if (explicit) return String(explicit).trim();

    let rawId = Number.parseInt(card?.id, 10) || 0;
    if (rawId > 10000000) rawId = Math.floor(rawId / 10);
    const folderId = Math.floor(rawId / 10) * 10;
    if (!folderId) return '';

    if (card?.folder) {
        const folder = String(card.folder).replace(/^\.\//, '').replace(/\/+$/, '');
        return `./${folder}/card_${folderId}_circle.png`;
    }
    return `${getAbsCleanPartnerAssetPrefix()}assets/card-art/cards/${folderId}/card_${folderId}_circle.png`;
}

function getAbsCleanPartnerThumbUrl(card) {
    const explicit = [card?.thumb_url, card?.thumbnail_url, card?.thumbUrl]
        .find(value => String(value || '').trim());
    if (explicit) return String(explicit).trim();
    try {
        return window.resolveCardAssets?.(card)?.thumbUrl || '';
    } catch (error) {
        return '';
    }
}

function attachAbsCleanPartnerPortraitFallbacks(container) {
    if (!container) return;
    const defaultSrc = `${window.CENTRAL_ASSET_URL || 'https://abscustom.github.io/assets/images/'}SSR_Icon.png`;
    container.querySelectorAll('.abs-clean-partner-portrait > img, .abs-clean-partner-browser-art > img').forEach(img => {
        if (img.dataset.absPartnerFallbackBound === 'true') return;
        img.dataset.absPartnerFallbackBound = 'true';
        img.addEventListener('error', () => {
            const partnerFallback = img.dataset.absFallbackSrc || '';
            if (partnerFallback && img.dataset.absFallbackUsed !== 'true') {
                img.dataset.absFallbackUsed = 'true';
                img.src = partnerFallback;
                return;
            }
            if (img.dataset.absDefaultFallbackUsed !== 'true' && img.src !== defaultSrc) {
                img.dataset.absDefaultFallbackUsed = 'true';
                img.src = defaultSrc;
            }
        });
    });
}

// Manual connector control: increase/decrease this value to move the
// vertical leg farther away from the card-art edge. The route itself is
// built below in showAbsCleanLinkFx().
const ABS_CLEAN_LINK_STEM_PX = 36;
// Keep the vertical leg in the page gutter instead of letting it hug the
// viewport edge on narrow layouts. This is intentionally separate from the
// card-art offset above so the two route controls can be tuned independently.
const ABS_CLEAN_LINK_EDGE_INSET_PX = 24;

function getAbsCleanRenderedLinkCount() {
    const container = document.getElementById('abs-link-container');
    if (!container) return 0;
    const badges = container.querySelectorAll('.abs-link-badge').length;
    return badges || container.children.length;
}

function getAbsCleanPartnerPreviewLimit() {
    const linkCount = getAbsCleanRenderedLinkCount();
    return Math.min(
        ABS_CLEAN_PARTNER_PREVIEW_LIMIT,
        Math.max(1, linkCount || ABS_CLEAN_PARTNER_PREVIEW_LIMIT)
    );
}

function renderLinkingPartners(card) {
    const partnersBox = document.getElementById("abs-partners-box");
    const partnersContainer = document.getElementById("abs-partners-container");
    if (!partnersBox || !partnersContainer || !DB.cards) return;

    const normalizeLinkName = value => String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
    const cardLinks = (card.links || card.link_skill_ids || []).map(l => {
        if (typeof l === 'object') return l.name;
        if (DB.links && DB.links[l]) return DB.links[l].name;
        return l;
    }).map(link => String(link || '').trim()).filter(Boolean);
    const cardLinksByKey = new Map(cardLinks.map(link => [normalizeLinkName(link), link]));

    if (!cardLinks || cardLinks.length === 0) {
        partnersBox.style.display = "none";
        if (typeof window.syncAbsCleanHeaderPartners === 'function') window.syncAbsCleanHeaderPartners();
        return;
    }

    const cardFolder = getCardFolderId(card);
    const bestPartnerByCharacter = new Map();
    const mainCardName = (card.name || '').trim().toLowerCase();

    DB.cards.forEach(otherCard => {
        if (otherCard.id === card.id || Number(otherCard.rarity) === 3) return;

        const otherCardName = (otherCard.name || '').trim().toLowerCase();
        if (mainCardName && otherCardName && mainCardName === otherCardName) return;

        const otherFolder = getCardFolderId(otherCard);
        if (otherFolder === cardFolder) return;

        const otherLinks = (otherCard.links || otherCard.link_skill_ids || []).map(l => {
            if (typeof l === 'object') return l.name;
            if (DB.links && DB.links[l]) return DB.links[l].name;
            return l;
        }).map(link => normalizeLinkName(link)).filter(Boolean);
        const otherLinkKeys = new Set(otherLinks);

        if (!otherLinks || otherLinks.length === 0) return;

        const sharedLinks = [];
        cardLinksByKey.forEach((displayName, key) => {
            if (otherLinkKeys.has(key)) sharedLinks.push(displayName);
        });

        if (sharedLinks.length >= 4) {
            let totalBuffs = { atk: 0, def: 0, ki: 0, hp: 0, enemyDef: 0 };
            sharedLinks.forEach(linkName => {
                let linkObj = DB.links ? Object.values(DB.links).find(l => l.name === linkName) : null;
                let b = getLinkSkillBuffs(linkName, linkObj);
                if (b.atk) totalBuffs.atk += b.atk;
                if (b.def) totalBuffs.def += b.def;
                if (b.ki) totalBuffs.ki += b.ki;
                if (b.hp) totalBuffs.hp += b.hp;
                if (b.enemyDef) totalBuffs.enemyDef += b.enemyDef;
            });

            const releaseTime = new Date((otherCard.open_at || otherCard.release_date || '').replace(" ", "T") + "Z").getTime() || otherCard.id;
            const isTransformation = typeof isTransformedCard === 'function'
                ? isTransformedCard(otherCard)
                : otherCard.is_transform === true;
            const characterId = parseInt(otherCard.character_id || otherCard.characterId, 10) || 0;

            // Character IDs identify the same character/form across different releases.
            // Keep transformed versions separate so a base card and its form can both appear.
            const partnerKey = characterId
                ? `character-${characterId}-${isTransformation ? 'transformed' : 'base'}`
                : `family-${otherFolder}`;
            const candidate = {
                card: otherCard, 
                sharedCount: sharedLinks.length, 
                sharedLinks, 
                buffs: totalBuffs,
                releaseTime
            };
            const existing = bestPartnerByCharacter.get(partnerKey);
            const candidateRarity = parseInt(otherCard.rarity, 10) || 0;
            const existingRarity = existing ? (parseInt(existing.card.rarity, 10) || 0) : -1;
            const candidateUpgradeRank = otherCard.is_seza ? 2 : (otherCard.is_eza ? 1 : 0);
            const existingUpgradeRank = existing
                ? (existing.card.is_seza ? 2 : (existing.card.is_eza ? 1 : 0))
                : -1;

            // Only one release of the same character/form is shown: highest rarity
            // first, then its strongest upgrade (SEZA/EZA), then the newest release.
            if (!existing ||
                candidateRarity > existingRarity ||
                (candidateRarity === existingRarity && candidateUpgradeRank > existingUpgradeRank) ||
                (candidateRarity === existingRarity && candidateUpgradeRank === existingUpgradeRank && releaseTime > existing.releaseTime)) {
                bestPartnerByCharacter.set(partnerKey, candidate);
            }
        }
    });

    const partnerScores = [...bestPartnerByCharacter.values()];
    partnerScores.sort((a, b) => b.sharedCount - a.sharedCount || b.releaseTime - a.releaseTime);

    window.allPartnerScores = partnerScores;
    filterLinkingPartners();
}

function filterLinkingPartners() {
    const partnersBox = document.getElementById("abs-partners-box");
    const partnersContainer = document.getElementById("abs-partners-container");

    // Uploaded cards are standalone HTML snapshots. Upgrade the old button
    // markup at runtime so existing cards adopt the 9-card row increments
    // without needing to be uploaded again.
    const partnerLimitButtons = Array.from(document.querySelectorAll('.partner-limit-btn'));
    const oldLimits = [10, 20, 30, 40, 50];
    const rowLimits = [9, 18, 27, 36, 45];
    const hasLegacyLimits = partnerLimitButtons.length === oldLimits.length &&
        partnerLimitButtons.every((button, index) => Number(button.textContent.trim()) === oldLimits[index]);
    if (hasLegacyLimits) {
        partnerLimitButtons.forEach((button, index) => {
            const limit = rowLimits[index];
            button.textContent = String(limit);
            button.setAttribute('onclick', `setPartnerLimit(${limit}, this)`);
        });
    }

    // The active button is the source of truth for the initial view. This
    // keeps older published pages from rendering the former default of 10
    // when their first visible choice is now 9.
    const activeLimitButton = document.querySelector('.partner-limit-btn.active');
    const activeLimit = Number(activeLimitButton?.textContent?.trim());
    if (Number.isFinite(activeLimit) && activeLimit > 0) {
        currentPartnerLimit = activeLimit;
    }

    if (!window.allPartnerScores || window.allPartnerScores.length === 0) {
        if (partnersBox) partnersBox.style.display = "none";
        if (typeof window.syncAbsCleanHeaderPartners === 'function') window.syncAbsCleanHeaderPartners();
        return;
    }

    // The clean theme renders partners in its dedicated side-by-side panel.
    // Show the full bounded clean set there; other themes keep their existing
    // pagination limit and layout.
    const isAbsClean = document.body?.classList.contains('theme-abs-clean');
    // Keep the clean panel compact. Its preview tracks the number of rendered
    // link rows, capped at five; View More still exposes the full searchable
    // partner set in the existing browser.
    const displayLimit = isAbsClean ? getAbsCleanPartnerPreviewLimit() : currentPartnerLimit;
    const displayList = window.allPartnerScores.slice(0, displayLimit);
    const escapeHtml = value => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    partnersBox.style.display = "block";
    partnersContainer.innerHTML = displayList.map(({ card: pCard, sharedCount, buffs }) => {
        let pillsHtml = [];

        const partnerName = String(pCard?.name || 'Link Partner');
        const partnerTypeKeys = ['agl', 'teq', 'int', 'str', 'phy'];
        const partnerElement = Number.parseInt(pCard?.element ?? pCard?.attribute, 10);
        const partnerType = Number.isFinite(partnerElement)
            ? (partnerTypeKeys[((partnerElement % 10) + 10) % 10] || '')
            : '';
        const partnerCircle = isAbsClean ? getAbsCleanPartnerCircleUrl(pCard) : '';
        const partnerThumb = isAbsClean ? getAbsCleanPartnerThumbUrl(pCard) : '';
        const partnerPortraitSrc = partnerCircle || partnerThumb || `${CENTRAL_ASSET_URL}SSR_Icon.png`;
        const partnerPortraitFallback = partnerThumb && partnerThumb !== partnerPortraitSrc ? partnerThumb : '';

        if (buffs.atk > 0) {
            pillsHtml.push(`<span class="partner-stat-pill pill-red"><img src="${CENTRAL_ASSET_URL}st_0001.png"> +${buffs.atk}%</span>`);
        }
        if (buffs.def > 0) {
            pillsHtml.push(`<span class="partner-stat-pill pill-blue"><img src="${CENTRAL_ASSET_URL}st_0002.png"> +${buffs.def}%</span>`);
        }

        let subRowPills = [];
        if (buffs.ki > 0) {
            subRowPills.push(`<span class="partner-stat-pill pill-yellow"><img src="${CENTRAL_ASSET_URL}st_0003.png"> +${buffs.ki}</span>`);
        }
        if (buffs.hp > 0) {
            subRowPills.push(`<span class="partner-stat-pill pill-green"><img src="${CENTRAL_ASSET_URL}st_recover.png"> +${buffs.hp}%</span>`);
        }
        if (buffs.enemyDef < 0) {
            subRowPills.push(`<span class="partner-stat-pill pill-orange"><img src="${CENTRAL_ASSET_URL}st_0012.png"> ${buffs.enemyDef}%</span>`);
        }

        const partnerCountMarkup = isAbsClean
            ? `<span class="abs-clean-partner-link-total" aria-label="${sharedCount} shared links">${sharedCount}</span>`
            : `<span class="partner-links-count-tag">${sharedCount} Links</span>`;

        const partnerPortraitMarkup = isAbsClean
            ? `<span class="abs-clean-partner-portrait" data-partner-card-id="${escapeHtml(pCard?.id || '')}" data-partner-type="${escapeHtml(partnerType)}"><img src="${escapeHtml(partnerPortraitSrc)}" data-abs-fallback-src="${escapeHtml(partnerPortraitFallback)}" alt="${escapeHtml(partnerName)}" loading="lazy"></span>`
            : buildComposedIcon(pCard, pCard.rarity === 3, 'base');

        return `
            <a href="card.html?id=${encodeURIComponent(pCard?.id || '')}" class="partner-card-wrapper" title="${escapeHtml(partnerName)}" data-partner-card-id="${escapeHtml(pCard?.id || '')}" data-partner-type="${escapeHtml(partnerType)}">
                <div class="partner-icon-relative">
                    ${partnerPortraitMarkup}
                    ${partnerCountMarkup}
                </div>
                <div class="partner-pills-container">
                    ${isAbsClean ? `<span class="abs-clean-partner-card-name">${escapeHtml(partnerName)}</span>` : ''}
                    ${pillsHtml.length > 0 ? `<div class="partner-pill-row">${pillsHtml.join('')}</div>` : ''}
                    ${subRowPills.length > 0 ? `<div class="partner-pill-row">${subRowPills.join('')}</div>` : ''}
                </div>
            </a>
        `;
    }).join('');
    if (isAbsClean) {
        attachAbsCleanPartnerPortraitFallbacks(partnersContainer);
        [...partnersContainer.querySelectorAll('.partner-card-wrapper')].forEach((partner, index) => {
            const sharedLinks = displayList[index]?.sharedLinks || [];
            const portrait = partner.querySelector('.abs-clean-partner-portrait');
            if (!portrait) return;
            // Clean mode keeps the connector/count interaction, but no longer
            // opens the old hover showcase or applies a hover card treatment.
            // The connector is deliberately portrait-only: moving across the
            // partner name/stat surface must not activate the line.
            portrait.addEventListener('pointerenter', () => showAbsCleanLinkFx(partner, sharedLinks));
            portrait.addEventListener('pointerleave', scheduleAbsCleanLinkFxHide);
        });
    }
    if (typeof window.syncAbsCleanLinkPartnersPlacement === 'function') {
        window.syncAbsCleanLinkPartnersPlacement();
    }
    if (typeof window.syncAbsCleanHeaderPartners === 'function') window.syncAbsCleanHeaderPartners();
}

function setPartnerLimit(limit, btnEl) {
    currentPartnerLimit = limit;
    document.querySelectorAll('.partner-limit-btn').forEach(btn => btn.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');
    filterLinkingPartners();
}

/* ===========================================================================
   abs.clean shared-link beam FX.
   The supplied AnimatedBeam reference is reproduced with native SVG so this
   vanilla-JS project needs no React or animation dependency.  A hovered
   partner fans one animated lane per shared link into the main header icon.
   ========================================================================== */
let absCleanLinkFxState = null;
let absCleanLinkFxHideTimer = null;
let absCleanSelectedPartnerKey = null;
const absCleanLinkFxModeByPartner = new Map();
const absCleanLinkFxCurvesByPartner = new Map();

function getAbsCleanLinkFxPartnerKey(source) {
    return source?.dataset?.cardUrl || source?.getAttribute('href') || source?.querySelector('img')?.alt || '';
}

function getAbsCleanTypingColor(element, fallback = '#38bdf8') {
    const typeColors = {
        agl: '#38bdf8', teq: '#22c55e', int: '#a855f7', str: '#ef4444', phy: '#eab308'
    };
    const host = element?.closest?.('#abs-composed-icon') || element;
    const type = String(host?.dataset?.cardType || host?.dataset?.type || host?.dataset?.partnerType || '').toLowerCase();
    if (typeColors[type]) return typeColors[type];
    const styles = host ? window.getComputedStyle(host) : null;
    return styles?.getPropertyValue('--ptype').trim() ||
        styles?.getPropertyValue('--abs-clean-ring-color').trim() ||
        styles?.getPropertyValue('--theme-border').trim() || fallback;
}

function getAbsCleanCardTypingColor(target, fallback = '#38bdf8') {
    // The artwork surface is deliberately outside the header portrait in the
    // clean layout, so it does not inherit the portrait's data-card-type
    // attribute. Resolve the active unit type from that portrait first, then
    // fall back to the artwork surface's inherited CSS variables.
    const source = document.querySelector(
        '#layout-abs-style .abs-top-header #abs-composed-icon'
    ) || target;
    return getAbsCleanTypingColor(source, getAbsCleanTypingColor(target, fallback));
}

function getAbsCleanLinkFxCurveSettings(partnerKey) {
    if (!absCleanLinkFxCurvesByPartner.has(partnerKey)) {
        absCleanLinkFxCurvesByPartner.set(partnerKey, new Map());
    }
    return absCleanLinkFxCurvesByPartner.get(partnerKey);
}

function getAbsCleanLinkFxObstacles(source) {
    return [...document.querySelectorAll(
        '#abs-clean-header-partners .abs-clean-partner, #abs-clean-link-partners-row .partner-card-wrapper'
    )]
        .filter(partner => partner !== source)
        .map(partner => {
            const rect = partner.getBoundingClientRect();
            // Keep the protected area tight. The beam has its own glow, so a
            // large invisible buffer made otherwise valid drags feel boxed in.
            const padding = 7;
            return {
                left: rect.left - padding,
                right: rect.right + padding,
                top: rect.top - padding,
                bottom: rect.bottom + padding
            };
        });
}

function getAbsCleanLinkFxTextObstacles() {
    const header = document.querySelector('#layout-abs-style .abs-top-header');
    if (!header) return [];
    return [...header.querySelectorAll('*')].filter(element => {
        const text = element.textContent?.trim();
        const style = window.getComputedStyle(element);
        return Boolean(text) && element.children.length === 0 &&
            style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0;
    }).map(element => {
        const rect = element.getBoundingClientRect();
        const padding = 8;
        return rect.width && rect.height ? {
            left: rect.left - padding,
            right: rect.right + padding,
            top: rect.top - padding,
            bottom: rect.bottom + padding
        } : null;
    }).filter(Boolean);
}

function getAbsCleanQuadraticPoint(startX, startY, controlX, controlY, endX, endY, t) {
    const inverse = 1 - t;
    return {
        x: (inverse * inverse * startX) + (2 * inverse * t * controlX) + (t * t * endX),
        y: (inverse * inverse * startY) + (2 * inverse * t * controlY) + (t * t * endY)
    };
}

// Keep the link effect on the same concave coordinate field as the Dokkan
// background grid in 17-theme.js.  These values deliberately mirror that
// renderer, so a connector bends with the backdrop instead of looking like a
// flat overlay floating above it.
const ABS_CLEAN_BACKGROUND_GRID_STEP = 36;

function getAbsCleanBackgroundGridProjection(x, y, width = window.innerWidth, height = window.innerHeight) {
    const nx = (x - (width / 2)) / Math.max(width / 2, 1);
    const ny = (y - (height / 2)) / Math.max(height / 2, 1);
    const bow = 18 * nx * (1 - (ny * ny * 0.45));
    const sag = 20 * (1 - (nx * nx)) * (0.65 + (0.35 * (y / Math.max(1, height))));
    return { x: x + bow, y: y + sag };
}

function getAbsCleanNearestBackgroundGridPoint(point, bounds = null) {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const baseColumn = Math.round(point.x / ABS_CLEAN_BACKGROUND_GRID_STEP);
    const baseRow = Math.round(point.y / ABS_CLEAN_BACKGROUND_GRID_STEP);
    let nearest = null;

    // Projection bows the grid a little, so inspect the neighboring lattice
    // points too rather than snapping against an unprojected 36px square.
    for (let column = baseColumn - 2; column <= baseColumn + 2; column += 1) {
        for (let row = baseRow - 2; row <= baseRow + 2; row += 1) {
            const candidate = getAbsCleanBackgroundGridProjection(
                column * ABS_CLEAN_BACKGROUND_GRID_STEP,
                row * ABS_CLEAN_BACKGROUND_GRID_STEP,
                width,
                height
            );
            if (bounds && (candidate.x < bounds.left || candidate.x > bounds.right ||
                candidate.y < bounds.top || candidate.y > bounds.bottom)) continue;
            const distance = Math.hypot(candidate.x - point.x, candidate.y - point.y);
            if (!nearest || distance < nearest.distance) nearest = { ...candidate, distance };
        }
    }
    return nearest ? { x: nearest.x, y: nearest.y } : getAbsCleanClampedPoint(point, bounds);
}

function absCleanPolylineIsClear(points, obstacles, bounds) {
    for (let index = 1; index < points.length; index += 1) {
        const from = points[index - 1];
        const to = points[index];
        // Short, dense samples reliably protect character names/tags without
        // introducing a more complicated pathfinding model.
        for (let step = 0; step <= 24; step += 1) {
            const t = step / 24;
            const point = { x: from.x + ((to.x - from.x) * t), y: from.y + ((to.y - from.y) * t) };
            if (bounds && (point.x < bounds.left || point.x > bounds.right || point.y < bounds.top || point.y > bounds.bottom)) return false;
            if (obstacles.some(obstacle => point.x > obstacle.left && point.x < obstacle.right && point.y > obstacle.top && point.y < obstacle.bottom)) return false;
        }
    }
    return true;
}

function getAbsCleanGridAlignedPathData(startX, startY, controlX, controlY, endX, endY, obstacles = [], bounds = null) {
    const rawMidpoint = getAbsCleanQuadraticPoint(startX, startY, controlX, controlY, endX, endY, 0.5);
    const baseRow = Math.round(rawMidpoint.y / ABS_CLEAN_BACKGROUND_GRID_STEP);
    const rowOffsets = [0, -1, 1, -2, 2, -3, 3, -4, 4];
    const gridStartX = Math.round(startX / ABS_CLEAN_BACKGROUND_GRID_STEP) * ABS_CLEAN_BACKGROUND_GRID_STEP;
    const gridMiddleX = Math.round(((startX + endX) / 2) / ABS_CLEAN_BACKGROUND_GRID_STEP) * ABS_CLEAN_BACKGROUND_GRID_STEP;
    const gridEndX = Math.round(endX / ABS_CLEAN_BACKGROUND_GRID_STEP) * ABS_CLEAN_BACKGROUND_GRID_STEP;
    let selectedPoints = null;

    for (const rowOffset of rowOffsets) {
        const gridRow = (baseRow + rowOffset) * ABS_CLEAN_BACKGROUND_GRID_STEP;
        const projectGridPoint = x => getAbsCleanClampedPoint(
            getAbsCleanBackgroundGridProjection(x, gridRow), bounds
        );
        // Three projected grid nodes give the central lane a deliberately
        // polygonal shape with only the two essential entry/exit turns.
        const points = [
            { x: startX, y: startY },
            projectGridPoint(gridStartX),
            projectGridPoint(gridMiddleX),
            projectGridPoint(gridEndX),
            { x: endX, y: endY }
        ];
        if (absCleanPolylineIsClear(points, obstacles, bounds)) {
            selectedPoints = points;
            break;
        }
    }

    // A packed custom header can block every grid row. Preserve a concise,
    // predictable three-segment fallback rather than reintroducing a curve.
    const points = selectedPoints || [
        { x: startX, y: startY },
        { x: controlX, y: controlY },
        { x: endX, y: endY }
    ];
    return {
        pathData: points.map((point, index) => `${index ? 'L' : 'M'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ')
    };
}

function getAbsCleanCardAttachmentPoint(rect, towardX, towardY, overlap = 1.5) {
    const centerX = rect.left + (rect.width / 2);
    const centerY = rect.top + (rect.height / 2);
    const deltaX = towardX - centerX;
    const deltaY = towardY - centerY;
    if (!deltaX && !deltaY) return { x: centerX, y: centerY };
    const horizontalScale = (rect.width / 2) / Math.max(Math.abs(deltaX), 0.001);
    const verticalScale = (rect.height / 2) / Math.max(Math.abs(deltaY), 0.001);
    const scale = Math.min(horizontalScale, verticalScale);
    const length = Math.hypot(deltaX, deltaY) || 1;
    // Use the actual rectangle intersection, then apply the caller's small
    // directional overlap. The former scale adjustment was proportional to
    // the whole card distance, which could leave a visible gap (or overshoot)
    // on wide docks. The round SVG cap needs that overlap to read as one
    // continuous connection with the card frame rather than a detached end.
    return {
        x: centerX + (deltaX * scale) + ((deltaX / length) * overlap),
        y: centerY + (deltaY * scale) + ((deltaY / length) * overlap)
    };
}

function getAbsCleanLinkFxTarget() {
    // Attach the connector to the real card-art surface. The header portrait
    // remains the identity thumbnail, not the destination for partner links.
    const art = document.querySelector('#layout-abs-style #abs-art-layers-container');
    if (art) return art;
    return document.querySelector('#layout-abs-style .abs-side-col > #abs-art-dock-wrapper') ||
        document.querySelector('#layout-abs-style .abs-top-header #abs-composed-icon') ||
        document.querySelector('#layout-abs-style .abs-top-header #abs-thumb-img');
}

function getAbsCleanTopCardAttachmentPoint(rect) {
    // Partner beams intentionally leave from one consistent visual port: the
    // middle of the portrait's top edge, with a tiny overlap into its frame.
    return {
        x: rect.left + (rect.width / 2),
        y: rect.top - 1.5
    };
}

function getAbsCleanSideCardAttachmentPoint(rect, towardX) {
    const centerX = rect.left + (rect.width / 2);
    const centerY = rect.top + (rect.height / 2);
    const edgeX = towardX < centerX ? rect.left - 1.5 : rect.right + 1.5;
    return { x: edgeX, y: centerY };
}

function getAbsCleanPartnerLinkCountPoint(source, towardX) {
    const count = source?.querySelector('.abs-clean-partner-link-total');
    const countRect = count?.getBoundingClientRect?.();
    if (countRect?.width && countRect?.height) {
        return {
            x: countRect.left + (countRect.width / 2),
            y: countRect.top + (countRect.height / 2)
        };
    }
    const sourceRect = source?.getBoundingClientRect?.();
    return sourceRect?.width
        ? getAbsCleanSideCardAttachmentPoint(sourceRect, towardX)
        : { x: 0, y: 0 };
}

function getAbsCleanLeftGridStemX(targetRect, bounds, sourceX = null) {
    const targetLeft = targetRect.left;
    const targetOffset = Math.max(12, ABS_CLEAN_LINK_STEM_PX);
    // Keep the vertical leg to the left of both endpoints. Without the
    // source-side constraint, a left-hand partner could make the first leg
    // travel right before turning upward.
    const sourceLimit = Number.isFinite(sourceX) ? sourceX - targetOffset : Number.POSITIVE_INFINITY;
    const desiredX = Math.min(targetLeft - targetOffset, sourceLimit);
    const gridX = Math.round(desiredX / ABS_CLEAN_BACKGROUND_GRID_STEP) * ABS_CLEAN_BACKGROUND_GRID_STEP;
    const edgeInset = Math.max(16, ABS_CLEAN_LINK_EDGE_INSET_PX);
    const minX = bounds.left + Math.min(edgeInset, Math.max(4, (bounds.right - bounds.left) / 2));
    const maxX = bounds.right - Math.min(edgeInset, Math.max(4, (bounds.right - bounds.left) / 2));
    return Math.max(minX, Math.min(maxX, gridX));
}

function getAbsCleanColorChannels(color) {
    const value = String(color || '').trim();
    const shortHex = /^#([\da-f])([\da-f])([\da-f])$/i.exec(value);
    if (shortHex) return shortHex.slice(1).map(part => parseInt(part + part, 16));
    const longHex = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(value);
    if (longHex) return longHex.slice(1).map(part => parseInt(part, 16));
    const rgb = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i.exec(value);
    return rgb ? rgb.slice(1, 4).map(Number) : null;
}

function getAbsCleanMixedColor(fromColor, toColor, amount) {
    const from = getAbsCleanColorChannels(fromColor);
    const to = getAbsCleanColorChannels(toColor);
    if (!from || !to) return amount < 0.5 ? fromColor : toColor;
    const mix = index => Math.round(from[index] + ((to[index] - from[index]) * amount));
    return `rgb(${mix(0)}, ${mix(1)}, ${mix(2)})`;
}

function getAbsCleanBackgroundAwarePipeColor(surface) {
    for (const element of [surface, document.body]) {
        const color = window.getComputedStyle(element).backgroundColor;
        const alphaMatch = /^rgba\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*,\s*([\d.]+)\s*\)$/i.exec(color);
        if (!color || color === 'transparent' || (alphaMatch && Number(alphaMatch[1]) < 0.08)) continue;
        const channels = getAbsCleanColorChannels(color);
        if (!channels) continue;
        const luminance = ((channels[0] * 0.2126) + (channels[1] * 0.7152) + (channels[2] * 0.0722)) / 255;
        // A softly contrasting pipe remains legible while inheriting the
        // light/dark character of whichever header backdrop is active.
        return luminance > 0.52 ? 'rgba(15, 23, 42, 0.68)' : 'rgba(203, 213, 225, 0.50)';
    }
    return document.body.classList.contains('theme-abs-clean-dark')
        ? 'rgba(203, 213, 225, 0.50)'
        : 'rgba(15, 23, 42, 0.68)';
}

function createAbsCleanShootingPoint(svg, motionPath, centerColor, partnerColor, phaseOffset = 0) {
    const point = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    point.setAttribute('class', 'abs-clean-link-fx-shooting-point');
    point.setAttribute('r', '4');
    point.setAttribute('aria-hidden', 'true');
    svg.appendChild(point);
    const cycleMs = 7200;
    const render = timestamp => {
        if (!point.isConnected || !motionPath.isConnected) return;
        try {
            const length = motionPath.getTotalLength();
            const phase = ((timestamp + (phaseOffset * cycleMs)) % cycleMs) / cycleMs;
            // A cosine loop never teleports back to its starting point. It
            // feels like the continuously floating particles in the backdrop.
            const travel = 0.5 - (0.5 * Math.cos(phase * Math.PI * 2));
            const position = motionPath.getPointAtLength(length * (1 - travel));
            const color = getAbsCleanMixedColor(centerColor, partnerColor, travel);
            point.setAttribute('cx', position.x.toFixed(1));
            point.setAttribute('cy', position.y.toFixed(1));
            point.setAttribute('fill', color);
            point.style.color = color;
        } catch (error) {
            // A detached or temporarily invalid SVG path simply resumes next
            // time its selected partner rebuilds the link layer.
        }
        window.requestAnimationFrame(render);
    };
    window.requestAnimationFrame(render);
    return point;
}

function createAbsCleanPartnerCountTraveler(source, motionPath, layer, total, onComplete = null) {
    const portraitTotal = source.querySelector('.abs-clean-partner-link-total');
    if (!portraitTotal) {
        onComplete?.();
        return;
    }
    const traveler = document.createElement('span');
    traveler.className = 'abs-clean-link-fx-count-traveler';
    traveler.textContent = String(total);
    layer.appendChild(traveler);
    const duration = 620;
    const render = startedAt => timestamp => {
        if (!traveler.isConnected || !motionPath.isConnected) return;
        try {
            const progress = Math.min(1, (timestamp - startedAt) / duration);
            const eased = 1 - Math.pow(1 - progress, 2);
            // The count travels from the portrait to the central total badge,
            // then fades away instead of leaving a duplicate number behind.
            const point = motionPath.getPointAtLength(motionPath.getTotalLength() * (eased * 0.5));
            traveler.style.opacity = String(progress < 0.8 ? 1 : (1 - progress) / 0.2);
            traveler.style.transform = `translate3d(${Math.round(point.x)}px, ${Math.round(point.y)}px, 0) translate(-50%, -50%) scale(${1 - (progress * 0.16)})`;
            if (progress >= 1) {
                traveler.remove();
                onComplete?.();
                return;
            }
        } catch (error) {
            traveler.remove();
            onComplete?.();
            return;
        }
        window.requestAnimationFrame(render(startedAt));
    };
    window.requestAnimationFrame(timestamp => render(timestamp)(timestamp));
}

function createAbsCleanPartnerCountReturnTraveler(motionPath, layer, total, onComplete = null) {
    const traveler = document.createElement('span');
    traveler.className = 'abs-clean-link-fx-count-traveler is-returning';
    traveler.textContent = String(total);
    layer.appendChild(traveler);
    const duration = 360;
    const render = startedAt => timestamp => {
        if (!traveler.isConnected || !motionPath.isConnected) return;
        try {
            const progress = Math.min(1, (timestamp - startedAt) / duration);
            const eased = progress * progress;
            // The total starts at the same midpoint it reached on entry, then
            // is pulled back into the source portrait as the line retracts.
            const point = motionPath.getPointAtLength(motionPath.getTotalLength() * (0.5 * (1 - eased)));
            traveler.style.opacity = String(progress < 0.78 ? 1 : (1 - progress) / 0.22);
            traveler.style.transform = `translate3d(${Math.round(point.x)}px, ${Math.round(point.y)}px, 0) translate(-50%, -50%) scale(${1 - (progress * 0.34)})`;
            if (progress >= 1) {
                traveler.remove();
                onComplete?.();
                return;
            }
        } catch (error) {
            traveler.remove();
            onComplete?.();
            return;
        }
        window.requestAnimationFrame(render(startedAt));
    };
    window.requestAnimationFrame(timestamp => render(timestamp)(timestamp));
}

function absCleanPathHitsObstacle(startX, startY, controlX, controlY, endX, endY, obstacles) {
    return obstacles.some(obstacle => {
        // Dense sampling catches a curve that only grazes a narrow title or
        // label; the old sparse check could step straight over text.
        for (let step = 1; step < 96; step += 1) {
            const point = getAbsCleanQuadraticPoint(startX, startY, controlX, controlY, endX, endY, step / 96);
            if (point.x > obstacle.left && point.x < obstacle.right && point.y > obstacle.top && point.y < obstacle.bottom) return true;
        }
        return false;
    });
}

function getAbsCleanClampedPoint(point, bounds) {
    if (!bounds) return point;
    return {
        x: Math.max(bounds.left, Math.min(bounds.right, point.x)),
        y: Math.max(bounds.top, Math.min(bounds.bottom, point.y))
    };
}

function absCleanPathLeavesBounds(startX, startY, controlX, controlY, endX, endY, bounds) {
    if (!bounds) return false;
    for (let step = 0; step <= 96; step += 1) {
        const point = getAbsCleanQuadraticPoint(startX, startY, controlX, controlY, endX, endY, step / 96);
        if (point.x < bounds.left || point.x > bounds.right || point.y < bounds.top || point.y > bounds.bottom) return true;
    }
    return false;
}

function isAbsCleanCurveClear(startX, startY, controlX, controlY, endX, endY, obstacles, bounds) {
    return !absCleanPathHitsObstacle(startX, startY, controlX, controlY, endX, endY, obstacles) &&
        !absCleanPathLeavesBounds(startX, startY, controlX, controlY, endX, endY, bounds);
}

function getAbsCleanExpandedObstacles(obstacles, padding) {
    return obstacles.map(obstacle => ({
        left: obstacle.left - padding,
        right: obstacle.right + padding,
        top: obstacle.top - padding,
        bottom: obstacle.bottom + padding
    }));
}

function getAbsCleanSafeControlPoint(startX, startY, endX, endY, preferredX, preferredY, obstacles, routeState = null, bounds = null) {
    const preferred = getAbsCleanClampedPoint({ x: preferredX, y: preferredY }, bounds);
    // A little extra clearance is used only while deciding whether to leave a
    // detour. That hysteresis stops a line from flapping between a direct path
    // and an obstacle route at the exact collision boundary.
    const clearanceObstacles = getAbsCleanExpandedObstacles(obstacles, 5);
    const preferredClear = isAbsCleanCurveClear(
        startX, startY, preferred.x, preferred.y, endX, endY, clearanceObstacles, bounds
    );
    const current = routeState?.control;
    const currentClear = current && isAbsCleanCurveClear(
        startX, startY, current.x, current.y, endX, endY, obstacles, bounds
    );

    if (preferredClear) {
        if (!routeState) return preferred;
        if (!routeState.isDetour || !currentClear) {
            routeState.control = preferred;
            routeState.isDetour = false;
            return preferred;
        }
        // Ease out of a detour rather than suddenly snapping back to the
        // direct curve. Keep the current route if the in-between path clips.
        const eased = {
            x: current.x + ((preferred.x - current.x) * 0.2),
            y: current.y + ((preferred.y - current.y) * 0.2)
        };
        if (isAbsCleanCurveClear(startX, startY, eased.x, eased.y, endX, endY, clearanceObstacles, bounds)) {
            routeState.control = eased;
            if (Math.hypot(preferred.x - eased.x, preferred.y - eased.y) < 1) {
                routeState.control = preferred;
                routeState.isDetour = false;
            }
        }
        return routeState.control;
    }

    const midpointX = (startX + endX) / 2;
    const midpointY = (startY + endY) / 2;
    // Route far enough above/below the protected header copy to leave the
    // curve's stroke and glow clear of it. Top candidates are deliberately
    // plentiful so a partner can rise out of its card before heading inward.
    const topRoute = Math.max(bounds?.top ?? -Infinity, Math.min(...obstacles.map(obstacle => obstacle.top), preferred.y) - 30);
    const bottomRoute = Math.min(bounds?.bottom ?? Infinity, Math.max(...obstacles.map(obstacle => obstacle.bottom), preferred.y) + 30);
    const leftRoute = Math.max(bounds?.left ?? -Infinity, Math.min(...obstacles.map(obstacle => obstacle.left), preferred.x) - 20);
    const rightRoute = Math.min(bounds?.right ?? Infinity, Math.max(...obstacles.map(obstacle => obstacle.right), preferred.x) + 20);
    const candidates = [
        { x: midpointX, y: topRoute },
        { x: midpointX, y: topRoute - 48 },
        { x: midpointX, y: topRoute - 112 },
        { x: midpointX, y: bottomRoute },
        { x: midpointX, y: bottomRoute + 48 },
        { x: midpointX, y: bottomRoute + 112 },
        { x: leftRoute, y: midpointY },
        { x: rightRoute, y: midpointY },
        { x: leftRoute - 38, y: midpointY },
        { x: rightRoute + 38, y: midpointY }
    ].map(candidate => getAbsCleanClampedPoint(candidate, bounds));
    const validCandidates = candidates.filter(candidate => isAbsCleanCurveClear(
        startX, startY, candidate.x, candidate.y, endX, endY, obstacles, bounds
    ));
    const scoreCandidate = candidate => Math.hypot(candidate.x - preferred.x, candidate.y - preferred.y) +
        (current ? Math.hypot(candidate.x - current.x, candidate.y - current.y) * 0.18 : 0);
    // If an extremely dense custom header blocks every nearby option, the
    // highest top arc is the predictable escape route rather than allowing a
    // collision-prone direct line through text.
    const desired = validCandidates.sort((a, b) => scoreCandidate(a) - scoreCandidate(b))[0] || getAbsCleanClampedPoint({
        x: midpointX,
        y: topRoute - 220
    }, bounds);

    if (!routeState) return desired;
    if (!currentClear) {
        routeState.control = desired;
        routeState.isDetour = true;
        return desired;
    }
    // Preserve a valid detour while the user drags. When the preferred route
    // changes, gently pursue the nearest safe alternative instead of jumping
    // to a differently-routed candidate on the next pointer event.
    const eased = getAbsCleanClampedPoint({
        x: current.x + ((desired.x - current.x) * 0.26),
        y: current.y + ((desired.y - current.y) * 0.26)
    }, bounds);
    if (isAbsCleanCurveClear(startX, startY, eased.x, eased.y, endX, endY, obstacles, bounds)) {
        routeState.control = eased;
    }
    routeState.isDetour = true;
    return routeState.control;
}

function absCleanEscapeText(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));
}

function getAbsCleanLinkEffect(linkName) {
    const linkObj = Object.values(window.DB?.links || {}).find(link => link?.name === linkName);
    const fullDescription = window.getLinkSkillLevel10Description?.(linkName, linkObj);
    if (fullDescription) return String(fullDescription).replace(/\s+/g, ' ').trim();

    try {
        const buffs = window.getLinkSkillBuffs?.(linkName, linkObj) || {};
        const parts = [];
        if (buffs.atk) parts.push(`ATK +${buffs.atk}%`);
        if (buffs.def) parts.push(`DEF +${buffs.def}%`);
        if (buffs.ki) parts.push(`Ki +${buffs.ki}`);
        if (buffs.hp) parts.push(`HP +${buffs.hp}%`);
        if (buffs.enemyDef) parts.push(`Enemy DEF ${buffs.enemyDef}%`);
        return parts.join(' · ');
    } catch (error) {
        return '';
    }
}

function clearAbsCleanLinkFx() {
    clearTimeout(absCleanLinkFxHideTimer);
    absCleanLinkFxHideTimer = null;
    if (!absCleanLinkFxState) return;
    absCleanLinkFxState.source?.classList.remove('is-link-fx-source');
    absCleanLinkFxState.layer?.remove();
    absCleanLinkFxState.viewer?.remove();
    absCleanLinkFxState.activeLinks?.remove();
    absCleanLinkFxState.statOutput?.remove();
    const reposition = absCleanLinkFxState.reposition || absCleanLinkFxState.dismiss;
    window.removeEventListener('resize', reposition);
    window.removeEventListener('scroll', reposition, true);
    absCleanLinkFxState = null;
}

function scheduleAbsCleanLinkFxHide() {
    clearTimeout(absCleanLinkFxHideTimer);
    // A selected partner owns the beam layer. Leaving a lane only dismisses
    // its reader; the selectable partner keeps the FX visible.
    if (absCleanSelectedPartnerKey) {
        return;
    }
    const state = absCleanLinkFxState;
    if (!state?.layer) return;
    if (state.isDismissing) return;
    // Let the pointer cross onto the line, then retract its far endpoint back
    // toward the partner before the temporary layer is finally removed.
    absCleanLinkFxHideTimer = window.setTimeout(() => {
        if (absCleanLinkFxState !== state) return;
        state.isDismissing = true;
        state.returnCount?.();
        state.layer.classList.add('is-dismissing');
        state.activeLinks && (state.activeLinks.hidden = true);
        state.statOutput?.classList.add('is-dismissing');
        absCleanLinkFxHideTimer = window.setTimeout(() => {
            if (absCleanLinkFxState === state) clearAbsCleanLinkFx();
        }, 410);
    }, 600);
}

function keepAbsCleanLinkFxOpen() {
    clearTimeout(absCleanLinkFxHideTimer);
    if (absCleanLinkFxState?.isDismissing) {
        absCleanLinkFxState.isDismissing = false;
        absCleanLinkFxState.layer?.classList.remove('is-dismissing');
        absCleanLinkFxState.statOutput?.classList.remove('is-dismissing');
    }
}

function showAbsCleanLinkViewer(viewer, entries, activeName, pointX, pointY) {
    viewer.classList.add('abs-clean-link-reader');
    viewer.replaceChildren(createAbsCleanLinkReaderList(entries, activeName));
    viewer.hidden = false;

    const margin = 12;
    const width = viewer.offsetWidth;
    const height = viewer.offsetHeight;
    const left = Math.max(margin, Math.min(window.innerWidth - width - margin, pointX - (width / 2)));
    const top = Math.max(margin, Math.min(window.innerHeight - height - margin, pointY + 14));
    viewer.style.left = `${Math.round(left)}px`;
    viewer.style.top = `${Math.round(top)}px`;
}

function createAbsCleanLinkReaderList(entries, activeName = '') {
    const list = document.createElement('div');
    list.className = 'abs-clean-link-reader-list';
    list.setAttribute('role', 'list');
    entries.forEach(entry => {
        const item = document.createElement('div');
        item.className = 'abs-clean-link-reader-row';
        item.setAttribute('role', 'listitem');
        if (entry.name === activeName) item.classList.add('is-active');
        item.title = entry.effect || entry.name;

        const name = document.createElement('div');
        name.className = 'abs-clean-link-reader-name';
        name.textContent = entry.name;
        item.appendChild(name);

        if (entry.effect) {
            const effect = document.createElement('div');
            effect.className = 'abs-clean-link-reader-effect';
            effect.textContent = entry.effect;
            item.appendChild(effect);
        }

        list.appendChild(item);
    });
    return list;
}

function getAbsCleanSharedLinkTotals(entries) {
    const totals = { atk: 0, def: 0, hp: 0, ki: 0, enemyDef: 0 };
    entries.forEach(entry => {
        const linkObj = Object.values(window.DB?.links || {}).find(link => link?.name === entry.name);
        try {
            const buffs = window.getLinkSkillBuffs?.(entry.name, linkObj) || {};
            Object.keys(totals).forEach(key => { totals[key] += Number(buffs[key]) || 0; });
        } catch (error) {}
    });
    const items = [];
    if (totals.atk) items.push({ label: 'ATK', value: `+${totals.atk}%`, icon: 'st_0001.png', tone: 'atk' });
    if (totals.def) items.push({ label: 'DEF', value: `+${totals.def}%`, icon: 'st_0002.png', tone: 'def' });
    if (totals.ki) items.push({ label: 'Ki', value: `+${totals.ki}`, icon: 'st_0003.png', tone: 'ki' });
    if (totals.hp) items.push({ label: 'HP', value: `+${totals.hp}%`, icon: 'st_recover.png', tone: 'hp' });
    if (totals.enemyDef) items.push({ label: 'Enemy DEF', value: `${totals.enemyDef}%`, icon: 'st_0012.png', tone: 'enemy-def' });
    return items;
}

function createAbsCleanActiveLinks(source, entries, centerTypingColor) {
    const panel = document.createElement('aside');
    panel.id = 'abs-clean-active-links';
    panel.className = 'abs-clean-link-reader';
    panel.setAttribute('aria-label', 'Active shared links');
    panel.style.setProperty('--abs-clean-active-link-color', centerTypingColor);
    // The total stat output is deliberately kept at the partner portrait. The
    // central link-total circle opens this panel solely for the named skills
    // and their individual descriptions.
    panel.appendChild(createAbsCleanLinkReaderList(entries));
    panel.hidden = true;
    document.body.appendChild(panel);
    const rect = source.getBoundingClientRect();
    panel.style.left = `${Math.round(rect.left)}px`;
    panel.style.top = `${Math.round(rect.bottom + 8)}px`;
    return panel;
}

function createAbsCleanPartnerStatOutput(source, entries, centerTypingColor) {
    const totals = getAbsCleanSharedLinkTotals(entries);
    if (!totals.length) return null;

    const output = document.createElement('div');
    output.id = 'abs-clean-partner-link-stats';
    output.style.setProperty('--abs-clean-active-link-color', centerTypingColor);
    const assetRoot = window.CENTRAL_ASSET_URL || 'https://abscustom.github.io/assets/images/';
    totals.forEach(stat => {
        const pill = document.createElement('span');
        pill.className = `abs-clean-active-stat-pill is-${stat.tone}`;
        pill.title = `${stat.label} ${stat.value}`;
        const icon = document.createElement('img');
        icon.src = `${assetRoot}${stat.icon}`;
        icon.alt = stat.label;
        icon.onerror = () => { icon.style.display = 'none'; };
        const value = document.createElement('span');
        value.textContent = stat.value;
        pill.append(icon, value);
        output.appendChild(pill);
    });
    document.body.appendChild(output);
    const rect = source.getBoundingClientRect();
    const width = output.offsetWidth;
    const left = Math.max(6, Math.min(window.innerWidth - width - 6, rect.left + (rect.width / 2) - (width / 2)));
    output.style.left = `${Math.round(left)}px`;
    output.style.top = `${Math.round(rect.top - output.offsetHeight - 7)}px`;
    return output;
}

/* One selected/hovered partner owns exactly one curved connection. The count
   badge replaces the former fan of per-link paths, while per-link dots retain
   the link-count information in the animation itself. */
function showAbsCleanLinkFx(source, sharedLinks) {
    if (!document.body.classList.contains('theme-abs-clean') || !source || !sharedLinks?.length) {
        clearAbsCleanLinkFx();
        return;
    }
    const partnerKey = getAbsCleanLinkFxPartnerKey(source);
    const target = getAbsCleanLinkFxTarget();
    if (!target) return;

    clearAbsCleanLinkFx();
    let sourceRect = source.getBoundingClientRect();
    let targetRect = target.getBoundingClientRect();
    // The art surface is no longer a child of the header, but the page header
    // is still the correct background reference for the fallback pipe color.
    const header = target.closest('.abs-top-header') ||
        document.querySelector('#layout-abs-style .abs-top-header');
    const headerRect = header?.getBoundingClientRect();
    if (!sourceRect.width || !targetRect.width) return;

    let targetX = targetRect.left + (targetRect.width / 2);
    let targetY = targetRect.top + (targetRect.height / 2);
    // This connector intentionally travels through the open page gutter. A
    // viewport-sized route prevents a header-only clip from shortening the
    // vertical leg between the partner panel and the card portrait.
    const routeBounds = {
        left: 0,
        right: window.innerWidth,
        top: 0,
        bottom: window.innerHeight
    };
    const centerTypingColor = getAbsCleanCardTypingColor(target, '#38bdf8');
    const partnerTypingColor = getAbsCleanTypingColor(source, '#ffe17d');
    const entries = sharedLinks.map(name => ({ name, effect: getAbsCleanLinkEffect(name) }));
    const activeLinks = createAbsCleanActiveLinks(source, entries, centerTypingColor);
    // The stat totals now live in the partner card itself. Do not create the
    // former floating stat showcase when a partner is hovered.
    const statOutput = null;
    const layer = document.createElement('div');
    layer.id = 'abs-clean-link-fx-layer';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${window.innerWidth} ${window.innerHeight}`);
    svg.setAttribute('width', String(window.innerWidth));
    svg.setAttribute('height', String(window.innerHeight));
    svg.setAttribute('aria-hidden', 'true');
    layer.appendChild(svg);
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const typeGradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    const typeGradientId = `abs-clean-link-type-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    typeGradient.setAttribute('id', typeGradientId);
    typeGradient.setAttribute('gradientUnits', 'userSpaceOnUse');
    const partnerStop = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    partnerStop.setAttribute('offset', '0%');
    partnerStop.setAttribute('stop-color', partnerTypingColor);
    const centerStop = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    centerStop.setAttribute('offset', '100%');
    centerStop.setAttribute('stop-color', centerTypingColor);
    typeGradient.append(partnerStop, centerStop);
    defs.appendChild(typeGradient);
    const clipPath = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
    const clipPathId = `abs-clean-link-single-clip-${Date.now()}`;
    clipPath.setAttribute('id', clipPathId);
    const clipRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    clipRect.setAttribute('x', routeBounds.left.toFixed(1));
    clipRect.setAttribute('y', routeBounds.top.toFixed(1));
    clipRect.setAttribute('width', Math.max(0, routeBounds.right - routeBounds.left).toFixed(1));
    clipRect.setAttribute('height', Math.max(0, routeBounds.bottom - routeBounds.top).toFixed(1));
    clipPath.appendChild(clipRect);
    defs.appendChild(clipPath);
    svg.appendChild(defs);
    svg.setAttribute('clip-path', `url(#${clipPathId})`);
    document.body.appendChild(layer);
    layer.style.setProperty('--abs-clean-link-pipe-color', getAbsCleanBackgroundAwarePipeColor(header));

    const getGeometry = () => {
        // Start at the visible number circle, then step out of the partner
        // card before making the long vertical run through the page gutter.
        // This makes the count visibly travel into the connector instead of
        // appearing at an unrelated point on the card edge.
        const start = getAbsCleanClampedPoint(getAbsCleanPartnerLinkCountPoint(source, targetX), routeBounds);
        // Anchor the vertical leg to the nearest left-side background-grid
        // column immediately before the main portrait. This keeps the stem
        // in the open page gutter and makes the final horizontal segment enter
        // the portrait's left edge rather than arriving from above.
        const stemX = getAbsCleanLeftGridStemX(targetRect, routeBounds, start.x);
        const end = getAbsCleanClampedPoint(
            // The connector must enter from the portrait's left edge. Using
            // the explicit side attachment avoids the old top/right arrival
            // when the target is a circular or square header portrait.
            getAbsCleanSideCardAttachmentPoint(targetRect, stemX), routeBounds
        );
        const elbow = { x: stemX, y: end.y };
        return {
            startX: start.x,
            startY: start.y,
            endX: end.x,
            endY: end.y,
            pathData: `M ${start.x.toFixed(1)} ${start.y.toFixed(1)} L ${stemX.toFixed(1)} ${start.y.toFixed(1)} L ${elbow.x.toFixed(1)} ${elbow.y.toFixed(1)} L ${end.x.toFixed(1)} ${end.y.toFixed(1)}`
        };
    };

    let geometry = getGeometry();
    const track = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    track.setAttribute('class', 'abs-clean-link-fx-track is-summary has-type-gradient');
    track.setAttribute('pathLength', '1');
    track.setAttribute('d', geometry.pathData);
    track.style.setProperty('--abs-clean-link-type-gradient', `url(#${typeGradientId})`);
    svg.appendChild(track);
    const updateTypeGradient = nextGeometry => {
        typeGradient.setAttribute('x1', nextGeometry.startX.toFixed(1));
        typeGradient.setAttribute('y1', nextGeometry.startY.toFixed(1));
        typeGradient.setAttribute('x2', nextGeometry.endX.toFixed(1));
        typeGradient.setAttribute('y2', nextGeometry.endY.toFixed(1));
    };
    updateTypeGradient(geometry);
    source.classList.add('is-link-fx-source');
    const dots = entries.map((entry, index) => createAbsCleanShootingPoint(
        svg, track, centerTypingColor, partnerTypingColor, index / Math.max(entries.length, 1)
    ));
    const countLabel = document.createElement('button');
    countLabel.type = 'button';
    countLabel.className = 'abs-clean-link-fx-label is-summary is-awaiting-arrival';
    countLabel.style.setProperty('--abs-clean-link-total-color', partnerTypingColor);
    countLabel.textContent = String(entries.length);
    countLabel.setAttribute('aria-label', `${entries.length} shared links. Click to view them.`);
    countLabel.setAttribute('aria-controls', activeLinks.id);
    countLabel.setAttribute('aria-expanded', 'false');
    countLabel.title = 'View shared links';
    const positionCountLabel = () => {
        try {
            const midpoint = track.getPointAtLength(track.getTotalLength() / 2);
            countLabel.style.setProperty('--abs-clean-link-label-x', `${Math.round(midpoint.x)}px`);
            countLabel.style.setProperty('--abs-clean-link-label-y', `${Math.round(midpoint.y)}px`);
        } catch (error) {}
    };
    positionCountLabel();
    layer.appendChild(countLabel);
    createAbsCleanPartnerCountTraveler(source, track, layer, entries.length, () => {
        if (countLabel.isConnected) countLabel.classList.remove('is-awaiting-arrival');
    });
    const returnCountToPartner = () => {
        if (!countLabel.isConnected || countLabel.classList.contains('is-awaiting-arrival')) return;
        createAbsCleanPartnerCountReturnTraveler(track, layer, entries.length, () => {
            if (absCleanLinkFxState?.source === source) source.classList.remove('is-link-fx-source');
        });
    };

    const positionActiveLinks = () => {
        const badgeRect = countLabel.getBoundingClientRect();
        const panelWidth = activeLinks.offsetWidth || 190;
        const panelHeight = activeLinks.offsetHeight || 0;
        const margin = 8;
        const left = Math.max(margin, Math.min(window.innerWidth - panelWidth - margin,
            badgeRect.left + (badgeRect.width / 2) - (panelWidth / 2)));
        const top = Math.min(window.innerHeight - panelHeight - margin, badgeRect.bottom + 8);
        activeLinks.style.left = `${Math.round(left)}px`;
        activeLinks.style.top = `${Math.round(top)}px`;
        activeLinks.style.setProperty('--abs-clean-active-link-arrow-x', `${Math.round(
            Math.max(12, Math.min(panelWidth - 12, badgeRect.left + (badgeRect.width / 2) - left))
        )}px`);
    };
    let reflowFrame = 0;
    const refreshGeometry = () => {
        reflowFrame = 0;
        if (!source.isConnected || !target.isConnected || !layer.isConnected) return;
        const nextSourceRect = source.getBoundingClientRect();
        const nextTargetRect = target.getBoundingClientRect();
        if (!nextSourceRect.width || !nextTargetRect.width) return;
        sourceRect = nextSourceRect;
        targetRect = nextTargetRect;
        targetX = targetRect.left + (targetRect.width / 2);
        targetY = targetRect.top + (targetRect.height / 2);
        geometry = getGeometry();
        track.setAttribute('d', geometry.pathData);
        updateTypeGradient(geometry);
        positionCountLabel();
        if (!activeLinks.hidden) positionActiveLinks();
    };
    const scheduleReflow = () => {
        if (reflowFrame) return;
        reflowFrame = window.requestAnimationFrame(refreshGeometry);
    };
    const setActiveLinksOpen = open => {
        activeLinks.hidden = !open;
        countLabel.classList.toggle('is-closing', !open);
        countLabel.classList.toggle('is-viewing-links', open);
        countLabel.setAttribute('aria-expanded', String(open));
        if (open) window.requestAnimationFrame(positionActiveLinks);
    };
    countLabel.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        keepAbsCleanLinkFxOpen();
        if (activeLinks.hidden) {
            absCleanSelectedPartnerKey = partnerKey;
            setActiveLinksOpen(true);
        } else {
            absCleanSelectedPartnerKey = null;
            setActiveLinksOpen(false);
            scheduleAbsCleanLinkFxHide();
        }
    });
    countLabel.addEventListener('pointerenter', keepAbsCleanLinkFxOpen);
    countLabel.addEventListener('pointerleave', scheduleAbsCleanLinkFxHide);
    activeLinks.addEventListener('pointerenter', keepAbsCleanLinkFxOpen);
    activeLinks.addEventListener('pointerleave', scheduleAbsCleanLinkFxHide);
    absCleanLinkFxState = {
        source,
        layer,
        activeLinks,
        statOutput,
        returnCount: returnCountToPartner,
        dismiss: clearAbsCleanLinkFx,
        reposition: scheduleReflow
    };
    window.addEventListener('resize', scheduleReflow);
    window.addEventListener('scroll', scheduleReflow, true);
}

function showAbsCleanLegacyMultiLinkFx(source, sharedLinks, mode = null) {
    if (!document.body.classList.contains('theme-abs-clean') || !source || !sharedLinks?.length) return;
    const partnerKey = getAbsCleanLinkFxPartnerKey(source);
    mode = mode || absCleanLinkFxModeByPartner.get(partnerKey) || 'fan';
    // Use the actual central card art as the endpoint, not the larger frame
    // wrapper that surrounds it.
    const target = getAbsCleanLinkFxTarget();
    if (!target) return;

    clearAbsCleanLinkFx();
    const sourceRect = source.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const header = target.closest('.abs-top-header') ||
        document.querySelector('#layout-abs-style .abs-top-header');
    const headerRect = header?.getBoundingClientRect();
    if (!sourceRect.width || !targetRect.width || !headerRect?.width || !headerRect?.height) return;
    // Include the source card as well as the header so this legacy route also
    // remains usable if an older partner node is still present below it.
    const routeInset = 4;
    const routeBounds = {
        left: Math.max(0, Math.min(headerRect.left, sourceRect.left, targetRect.left) - routeInset),
        right: Math.min(window.innerWidth, Math.max(headerRect.right, sourceRect.right, targetRect.right) + routeInset),
        top: Math.max(0, Math.min(headerRect.top, sourceRect.top, targetRect.top) - routeInset),
        bottom: Math.min(window.innerHeight, Math.max(headerRect.bottom, sourceRect.bottom, targetRect.bottom) + routeInset)
    };

    const centerTypingColor = getAbsCleanTypingColor(target, '#38bdf8');
    const partnerTypingColor = getAbsCleanTypingColor(source, '#ffe17d');
    const sourceX = sourceRect.left + (sourceRect.width / 2);
    const sourceY = sourceRect.top + (sourceRect.height / 2);
    const targetX = targetRect.left + (targetRect.width / 2);
    const targetY = targetRect.top + (targetRect.height / 2);
    const entries = sharedLinks.map(name => ({ name, effect: getAbsCleanLinkEffect(name) }));
    // Use the card boundary facing the route. This can be its top, side, or
    // bottom rather than forcing every connector through a horizontal edge.
    const initialSourcePoint = getAbsCleanCardAttachmentPoint(sourceRect, targetX, targetY);
    const baseStartX = initialSourcePoint.x;
    const baseStartY = initialSourcePoint.y;
    const mergeTargetX = baseStartX + ((targetX - baseStartX) * 0.5);
    const mergeTargetY = baseStartY + ((targetY - baseStartY) * 0.5);
    // Cards and visible header copy both reserve space. This includes titles,
    // stat labels, and the partner dock's own heading.
    const obstacles = [
        ...getAbsCleanLinkFxObstacles(source),
        ...getAbsCleanLinkFxTextObstacles()
    ];
    const curveSettings = getAbsCleanLinkFxCurveSettings(partnerKey);

    const layer = document.createElement('div');
    layer.id = 'abs-clean-link-fx-layer';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${window.innerWidth} ${window.innerHeight}`);
    svg.setAttribute('width', String(window.innerWidth));
    svg.setAttribute('height', String(window.innerHeight));
    svg.setAttribute('aria-hidden', 'true');
    layer.appendChild(svg);
    // The route solver stays inside these bounds and the clip is a final
    // rendering guard: neither line nor luminous point can escape the header.
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const clipPath = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
    const clipPathId = `abs-clean-link-header-clip-${Date.now()}`;
    clipPath.setAttribute('id', clipPathId);
    const clipRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    clipRect.setAttribute('x', routeBounds.left.toFixed(1));
    clipRect.setAttribute('y', routeBounds.top.toFixed(1));
    clipRect.setAttribute('width', Math.max(0, routeBounds.right - routeBounds.left).toFixed(1));
    clipRect.setAttribute('height', Math.max(0, routeBounds.bottom - routeBounds.top).toFixed(1));
    clipPath.appendChild(clipRect);
    defs.appendChild(clipPath);
    svg.appendChild(defs);
    svg.setAttribute('clip-path', `url(#${clipPathId})`);

    const viewer = document.createElement('aside');
    viewer.id = 'abs-clean-link-fx-viewer';
    viewer.className = 'abs-clean-link-reader';
    viewer.style.setProperty('--abs-clean-active-link-color', centerTypingColor);
    viewer.hidden = true;
    viewer.setAttribute('aria-label', 'Shared links');
    document.body.appendChild(layer);
    document.body.appendChild(viewer);

    const showViewer = (pointX, pointY) => {
        keepAbsCleanLinkFxOpen();
        showAbsCleanLinkViewer(viewer, entries, '', pointX, pointY);
    };

    const spacing = 22;
    if (mode === 'fan') entries.forEach((entry, index) => {
        const offset = (index - ((entries.length - 1) / 2)) * spacing;
        const savedCurve = curveSettings.get(entry.name) || { x: 0, y: 0 };
        let isConnectingToCenter = false;
        const routeState = { control: null, isDetour: false };
        const getGeometry = () => {
            const provisionalStartX = baseStartX;
            const provisionalStartY = baseStartY + (offset * 0.18);
            const provisionalEndX = isConnectingToCenter ? targetX : targetRect.left + (targetRect.width / 2);
            const provisionalEndY = isConnectingToCenter ? targetY : targetRect.top + (targetRect.height / 2);
            const preferredPoint = {
                x: ((provisionalStartX + provisionalEndX) / 2) + savedCurve.x,
                y: ((provisionalStartY + provisionalEndY) / 2) + offset + savedCurve.y
            };
            let start = getAbsCleanClampedPoint(getAbsCleanTopCardAttachmentPoint(sourceRect), routeBounds);
            let end = isConnectingToCenter
                ? getAbsCleanClampedPoint({ x: targetX, y: targetY }, routeBounds)
                : getAbsCleanClampedPoint(getAbsCleanCardAttachmentPoint(targetRect, preferredPoint.x, preferredPoint.y), routeBounds);
            let control = getAbsCleanSafeControlPoint(
                start.x, start.y, end.x, end.y, preferredPoint.x, preferredPoint.y, obstacles, routeState, routeBounds
            );
            // Re-anchor against the chosen detour. A high control point exits
            // from the top edge naturally instead of forcing a side stem.
            start = getAbsCleanClampedPoint(getAbsCleanTopCardAttachmentPoint(sourceRect), routeBounds);
            end = isConnectingToCenter
                ? getAbsCleanClampedPoint({ x: targetX, y: targetY }, routeBounds)
                : getAbsCleanClampedPoint(getAbsCleanCardAttachmentPoint(targetRect, control.x, control.y), routeBounds);
            control = getAbsCleanSafeControlPoint(
                start.x, start.y, end.x, end.y, control.x, control.y, obstacles, routeState, routeBounds
            );
            // Resolve the final edge point from the final curve direction so
            // the stroke arrives flush at the image boundary.
            start = getAbsCleanClampedPoint(getAbsCleanTopCardAttachmentPoint(sourceRect), routeBounds);
            end = isConnectingToCenter
                ? getAbsCleanClampedPoint({ x: targetX, y: targetY }, routeBounds)
                : getAbsCleanClampedPoint(getAbsCleanCardAttachmentPoint(targetRect, control.x, control.y), routeBounds);
            const midPoint = getAbsCleanQuadraticPoint(
                start.x, start.y, control.x, control.y, end.x, end.y, 0.5
            );
            return {
                startX: start.x,
                startY: start.y,
                endX: end.x,
                endY: end.y,
                midX: midPoint.x,
                midY: midPoint.y,
                pathData: `M ${start.x.toFixed(1)} ${start.y.toFixed(1)} Q ${control.x.toFixed(1)} ${control.y.toFixed(1)} ${end.x.toFixed(1)} ${end.y.toFixed(1)}`
            };
        };
        let geometry = getGeometry();
        let { midX, midY, pathData } = geometry;

    const track = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    track.setAttribute('class', 'abs-clean-link-fx-track');
    track.setAttribute('pathLength', '1');
        track.setAttribute('d', pathData);
        svg.appendChild(track);
        const shootingPoint = createAbsCleanShootingPoint(
            svg,
            track,
            centerTypingColor,
            partnerTypingColor,
            index
        );
        const hitArea = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        hitArea.setAttribute('class', 'abs-clean-link-fx-hit');
        hitArea.setAttribute('d', pathData);
        hitArea.setAttribute('tabindex', '0');
        hitArea.setAttribute('role', 'button');
        hitArea.setAttribute('aria-label', `${entry.name}${entry.effect ? `: ${entry.effect}` : ''}`);
        const setActive = active => {
            track.classList.toggle('is-active', active);
            shootingPoint.classList.toggle('is-active', active);
            label.classList.toggle('is-active', active);
        };
        const fanPhysics = {
            targetX: savedCurve.x,
            targetY: savedCurve.y,
            velocityX: 0,
            velocityY: 0,
            frame: 0
        };
        const renderFanCurve = () => {
            geometry = getGeometry();
            midX = geometry.midX;
            midY = geometry.midY;
            pathData = geometry.pathData;
            track.setAttribute('d', pathData);
            hitArea.setAttribute('d', pathData);
            label.style.setProperty('--abs-clean-link-label-x', `${Math.round(midX)}px`);
            label.style.setProperty('--abs-clean-link-label-y', `${Math.round(midY)}px`);
        };
        const springFanCurve = () => {
            fanPhysics.velocityX = (fanPhysics.velocityX + ((fanPhysics.targetX - savedCurve.x) * 0.24)) * 0.74;
            fanPhysics.velocityY = (fanPhysics.velocityY + ((fanPhysics.targetY - savedCurve.y) * 0.24)) * 0.74;
            savedCurve.x += fanPhysics.velocityX;
            savedCurve.y += fanPhysics.velocityY;
            curveSettings.set(entry.name, savedCurve);
            renderFanCurve();
            const unsettled = Math.abs(fanPhysics.targetX - savedCurve.x) + Math.abs(fanPhysics.targetY - savedCurve.y) +
                Math.abs(fanPhysics.velocityX) + Math.abs(fanPhysics.velocityY) > 0.2;
            fanPhysics.frame = unsettled ? window.requestAnimationFrame(springFanCurve) : 0;
        };
        hitArea.addEventListener('pointerenter', () => {
            keepAbsCleanLinkFxOpen();
            setActive(true);
        });
        hitArea.addEventListener('pointerleave', () => {
            setActive(false);
            scheduleAbsCleanLinkFxHide();
        });
        hitArea.addEventListener('focus', () => setActive(true));
        hitArea.addEventListener('blur', () => {
            setActive(false);
            scheduleAbsCleanLinkFxHide();
        });
        let fanDragStart = null;
        let fanDragReady = false;
        hitArea.addEventListener('pointerdown', event => {
            fanDragStart = {
                x: event.clientX,
                y: event.clientY,
                curveX: savedCurve.x,
                curveY: savedCurve.y
            };
            fanDragReady = false;
            fanPhysics.targetX = savedCurve.x;
            fanPhysics.targetY = savedCurve.y;
            hitArea.setPointerCapture?.(event.pointerId);
        });
        hitArea.addEventListener('pointermove', event => {
            if (!fanDragStart) return;
            const moved = Math.hypot(event.clientX - fanDragStart.x, event.clientY - fanDragStart.y);
            const startDistance = Math.hypot(fanDragStart.x - mergeTargetX, fanDragStart.y - mergeTargetY);
            const currentDistance = Math.hypot(event.clientX - mergeTargetX, event.clientY - mergeTargetY);
            // The centre thumbnail is reached only during an intentional
            // inward drag. At rest, every fan beam lands on the card edge.
            isConnectingToCenter = moved > 12 && currentDistance < Math.max(26, startDistance - 10);
            fanDragReady = isConnectingToCenter;
            layer.classList.toggle('is-merging', isConnectingToCenter);
            fanPhysics.targetX = fanDragStart.curveX + (event.clientX - fanDragStart.x);
            fanPhysics.targetY = fanDragStart.curveY + (event.clientY - fanDragStart.y);
            if (!fanPhysics.frame) fanPhysics.frame = window.requestAnimationFrame(springFanCurve);
        });
        hitArea.addEventListener('pointerup', () => {
            fanDragStart = null;
            if (!fanDragReady) return;
            absCleanLinkFxModeByPartner.set(partnerKey, 'summary');
            showAbsCleanLinkFx(source, sharedLinks, 'summary');
        });
        hitArea.addEventListener('pointercancel', () => {
            fanDragStart = null;
            fanDragReady = false;
            layer.classList.remove('is-merging');
        });
        svg.appendChild(hitArea);

        const label = document.createElement('button');
        label.type = 'button';
        label.className = 'abs-clean-link-fx-label';
        label.style.setProperty('--abs-clean-link-label-x', `${Math.round(midX)}px`);
        label.style.setProperty('--abs-clean-link-label-y', `${Math.round(midY)}px`);
        label.textContent = `${entry.name}${entry.effect ? ` · ${entry.effect}` : ''}`;
        label.setAttribute('aria-label', hitArea.getAttribute('aria-label'));
        label.tabIndex = -1;
        layer.appendChild(label);
    });

    if (mode === 'summary') {
    // This mode contains only one count-beam: source portrait to main image.
    const summaryCurve = curveSettings.get('__summary__') || { x: 0, y: 0 };
    const summaryRouteState = { control: null, isDetour: false };
    const getSummaryGeometry = () => {
        const preferredPoint = {
            x: ((sourceX + targetX) / 2) + summaryCurve.x,
            y: ((sourceY + targetY) / 2) + 4 + summaryCurve.y
        };
        let start = getAbsCleanClampedPoint(getAbsCleanTopCardAttachmentPoint(sourceRect), routeBounds);
        const summaryEnd = getAbsCleanClampedPoint({ x: targetX, y: targetY }, routeBounds);
        let control = getAbsCleanSafeControlPoint(
            start.x, start.y, summaryEnd.x, summaryEnd.y, preferredPoint.x, preferredPoint.y, obstacles, summaryRouteState, routeBounds
        );
        start = getAbsCleanClampedPoint(getAbsCleanTopCardAttachmentPoint(sourceRect), routeBounds);
        control = getAbsCleanSafeControlPoint(
            start.x, start.y, summaryEnd.x, summaryEnd.y, control.x, control.y, obstacles, summaryRouteState, routeBounds
        );
        start = getAbsCleanClampedPoint(getAbsCleanTopCardAttachmentPoint(sourceRect), routeBounds);
        const midPoint = getAbsCleanQuadraticPoint(start.x, start.y, control.x, control.y, summaryEnd.x, summaryEnd.y, 0.5);
        return {
            startX: start.x,
            startY: start.y,
            midX: midPoint.x,
            midY: midPoint.y,
            pathData: `M ${start.x.toFixed(1)} ${start.y.toFixed(1)} Q ${control.x.toFixed(1)} ${control.y.toFixed(1)} ${summaryEnd.x.toFixed(1)} ${summaryEnd.y.toFixed(1)}`
        };
    };
    let summaryGeometry = getSummaryGeometry();
    let summaryMidX = summaryGeometry.midX;
    let summaryMidY = summaryGeometry.midY;
    let summaryPathData = summaryGeometry.pathData;
    const summaryTrack = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    summaryTrack.setAttribute('class', 'abs-clean-link-fx-track is-summary');
    summaryTrack.setAttribute('pathLength', '1');
    summaryTrack.setAttribute('d', summaryPathData);
    svg.appendChild(summaryTrack);
    const summaryShootingPoint = createAbsCleanShootingPoint(
        svg,
        summaryTrack,
        centerTypingColor,
        partnerTypingColor,
        7
    );
    const summaryHitArea = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    summaryHitArea.setAttribute('class', 'abs-clean-link-fx-hit is-summary');
    summaryHitArea.setAttribute('d', summaryPathData);
    summaryHitArea.setAttribute('tabindex', '0');
    summaryHitArea.setAttribute('role', 'button');
    summaryHitArea.setAttribute('aria-label', `${entries.length} shared links`);
    const summaryLabel = document.createElement('button');
    summaryLabel.type = 'button';
    summaryLabel.className = 'abs-clean-link-fx-label is-summary';
    summaryLabel.style.setProperty('--abs-clean-link-label-x', `${Math.round(summaryMidX)}px`);
    summaryLabel.style.setProperty('--abs-clean-link-label-y', `${Math.round(summaryMidY)}px`);
    summaryLabel.textContent = String(entries.length);
    summaryLabel.setAttribute('aria-label', summaryHitArea.getAttribute('aria-label'));
    const setSummaryActive = active => {
        summaryTrack.classList.toggle('is-active', active);
        summaryShootingPoint.classList.toggle('is-active', active);
        summaryLabel.classList.toggle('is-active', active);
    };
    const summaryPhysics = {
        targetX: summaryCurve.x,
        targetY: summaryCurve.y,
        velocityX: 0,
        velocityY: 0,
        frame: 0
    };
    const renderSummaryCurve = () => {
        summaryGeometry = getSummaryGeometry();
        summaryMidX = summaryGeometry.midX;
        summaryMidY = summaryGeometry.midY;
        summaryPathData = summaryGeometry.pathData;
        summaryTrack.setAttribute('d', summaryPathData);
        summaryHitArea.setAttribute('d', summaryPathData);
        summaryLabel.style.setProperty('--abs-clean-link-label-x', `${Math.round(summaryMidX)}px`);
        summaryLabel.style.setProperty('--abs-clean-link-label-y', `${Math.round(summaryMidY)}px`);
    };
    const springSummaryCurve = () => {
        summaryPhysics.velocityX = (summaryPhysics.velocityX + ((summaryPhysics.targetX - summaryCurve.x) * 0.24)) * 0.74;
        summaryPhysics.velocityY = (summaryPhysics.velocityY + ((summaryPhysics.targetY - summaryCurve.y) * 0.24)) * 0.74;
        summaryCurve.x += summaryPhysics.velocityX;
        summaryCurve.y += summaryPhysics.velocityY;
        curveSettings.set('__summary__', summaryCurve);
        renderSummaryCurve();
        const unsettled = Math.abs(summaryPhysics.targetX - summaryCurve.x) + Math.abs(summaryPhysics.targetY - summaryCurve.y) +
            Math.abs(summaryPhysics.velocityX) + Math.abs(summaryPhysics.velocityY) > 0.2;
        summaryPhysics.frame = unsettled ? window.requestAnimationFrame(springSummaryCurve) : 0;
    };
    const openSummaryViewer = () => {
        setSummaryActive(true);
        showViewer(summaryMidX, summaryMidY);
    };
    const closeSummaryViewer = () => {
        setSummaryActive(false);
        scheduleAbsCleanLinkFxHide();
    };
    summaryHitArea.addEventListener('pointerenter', openSummaryViewer);
    summaryHitArea.addEventListener('pointerleave', closeSummaryViewer);
    summaryHitArea.addEventListener('focus', openSummaryViewer);
    summaryHitArea.addEventListener('blur', closeSummaryViewer);
    summaryLabel.addEventListener('pointerenter', openSummaryViewer);
    summaryLabel.addEventListener('pointerleave', closeSummaryViewer);
    summaryLabel.addEventListener('focus', openSummaryViewer);
    summaryLabel.addEventListener('blur', closeSummaryViewer);
    // Drag the line itself to reshape its slight curve; its position persists.
    let summaryLineDragStart = null;
    summaryHitArea.addEventListener('pointerdown', event => {
        summaryLineDragStart = {
            x: event.clientX,
            y: event.clientY,
            curveX: summaryCurve.x,
            curveY: summaryCurve.y
        };
        summaryPhysics.targetX = summaryCurve.x;
        summaryPhysics.targetY = summaryCurve.y;
        summaryHitArea.setPointerCapture?.(event.pointerId);
    });
    summaryHitArea.addEventListener('pointermove', event => {
        if (!summaryLineDragStart) return;
        summaryPhysics.targetX = summaryLineDragStart.curveX + (event.clientX - summaryLineDragStart.x);
        summaryPhysics.targetY = summaryLineDragStart.curveY + (event.clientY - summaryLineDragStart.y);
        if (!summaryPhysics.frame) summaryPhysics.frame = window.requestAnimationFrame(springSummaryCurve);
    });
    summaryHitArea.addEventListener('pointerup', () => { summaryLineDragStart = null; });
    summaryHitArea.addEventListener('pointercancel', () => { summaryLineDragStart = null; });

    // The numbered handle remains the deliberate gesture for splitting the
    // summary back into the separate curved-link mode.
    let summaryHandleDragStart = null;
    let summaryHandleDragReady = false;
    summaryLabel.addEventListener('pointerdown', event => {
        summaryHandleDragStart = { x: event.clientX, y: event.clientY };
        summaryHandleDragReady = false;
        summaryLabel.setPointerCapture?.(event.pointerId);
    });
    summaryLabel.addEventListener('pointermove', event => {
        if (!summaryHandleDragStart) return;
        if (Math.hypot(event.clientX - summaryHandleDragStart.x, event.clientY - summaryHandleDragStart.y) > 12) {
            summaryHandleDragReady = true;
            layer.classList.add('is-splitting');
        }
    });
    summaryLabel.addEventListener('pointerup', () => {
        summaryHandleDragStart = null;
        if (!summaryHandleDragReady) return;
        absCleanLinkFxModeByPartner.set(partnerKey, 'fan');
        showAbsCleanLinkFx(source, sharedLinks, 'fan');
    });
    summaryLabel.addEventListener('pointercancel', () => {
        summaryHandleDragStart = null;
        summaryHandleDragReady = false;
        layer.classList.remove('is-splitting');
    });
    svg.appendChild(summaryHitArea);
    layer.appendChild(summaryLabel);
    }

    layer.addEventListener('pointerenter', keepAbsCleanLinkFxOpen);
    layer.addEventListener('pointerleave', scheduleAbsCleanLinkFxHide);
    viewer.addEventListener('pointerenter', keepAbsCleanLinkFxOpen);
    viewer.addEventListener('pointerleave', scheduleAbsCleanLinkFxHide);
    source.classList.add('is-link-fx-source');
    absCleanLinkFxState = {
        source,
        layer,
        viewer,
        dismiss: clearAbsCleanLinkFx
    };
    window.addEventListener('resize', absCleanLinkFxState.dismiss);
    window.addEventListener('scroll', absCleanLinkFxState.dismiss, true);
}

/* ==========================================================================
   abs.clean header-right partners dock.
   Shows the first 5 partners as circular portraits. Hovering previews the
   shared-link FX and clicking opens that partner's detailed card. Clean-only;
   other themes keep the original box.
   ========================================================================== */
function openAbsCleanPartnerBrowser(scores, trigger) {
    document.getElementById('abs-clean-partner-browser')?._absCleanClose?.();

    const partnerScores = Array.isArray(scores) ? scores : [];
    const maxBrowserPartners = 27;
    const esc = value => String(value ?? '')
        .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const assetRoot = window.CENTRAL_ASSET_URL || 'https://abscustom.github.io/assets/images/';
    const typeKeys = ['agl', 'teq', 'int', 'str', 'phy'];
    const buildPartnerCard = ({ card: pCard, sharedCount, buffs = {} } = {}) => {
        if (!pCard) return '';
        const circle = getAbsCleanPartnerCircleUrl(pCard);
        const thumb = getAbsCleanPartnerThumbUrl(pCard);
        const portraitSrc = circle || thumb || `${assetRoot}SSR_Icon.png`;
        const portraitFallback = thumb && thumb !== portraitSrc ? thumb : '';
        const elNum = parseInt(pCard.element ?? pCard.attribute, 10);
        const type = Number.isFinite(elNum) ? (typeKeys[((elNum % 10) + 10) % 10] || 'agl') : 'agl';
        const exactRarity = String(window.getCardExactRarity?.(pCard) || '').toUpperCase();
        const rarity = exactRarity || ((Number(pCard.rarity) === 5 || Number(pCard.max_level) >= 150 || Number(pCard.cost) >= 77)
            ? 'LR' : (Number(pCard.rarity) === 4 || Number(pCard.max_level) >= 120 ? 'TUR' : 'SSR'));
        const name = pCard.name || 'Linking partner';
        const statPills = [
            [Number(buffs.atk), 'st_0001.png', value => `+${value}%`, 'atk'],
            [Number(buffs.def), 'st_0002.png', value => `+${value}%`, 'def'],
            [Number(buffs.ki), 'st_0003.png', value => `+${value}`, 'ki'],
            [Number(buffs.hp), 'st_recover.png', value => `+${value}%`, 'hp'],
            [Number(buffs.enemyDef), 'st_0012.png', value => `${value}%`, 'enemy-def']
        ].filter(([value, , , kind]) => (kind === 'enemy-def' ? value < 0 : value > 0))
            .map(([value, icon, format, kind]) => `<span class="abs-clean-partner-browser-stat is-${kind}"><img src="${assetRoot}${icon}" alt="">${format(value)}</span>`)
            .join('');
        const stats = statPills ? `<span class="abs-clean-partner-browser-stats">${statPills}</span>` : '';
        return `<button type="button" class="abs-clean-partner-browser-card" data-type="${type}" data-card-url="card.html?id=${encodeURIComponent(pCard.id)}" aria-label="Open ${esc(name)}"><span class="abs-clean-partner-browser-art"><img src="${esc(portraitSrc)}" data-abs-fallback-src="${esc(portraitFallback)}" alt="${esc(name)}" loading="lazy"></span><span class="abs-clean-partner-browser-copy"><strong>${esc(name)}</strong><span class="abs-clean-partner-browser-meta"><span class="is-rarity is-${rarity.toLowerCase()}">${rarity}</span><span class="is-type">${type.toUpperCase()}</span><span class="abs-clean-partner-browser-links">${sharedCount} link${sharedCount === 1 ? '' : 's'}</span></span>${stats}</span></button>`;
    };

    const modal = document.createElement('div');
    modal.id = 'abs-clean-partner-browser';
    modal.className = 'abs-clean-partner-browser';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'link partners');
    modal.innerHTML = `<section class="abs-clean-partner-browser-panel"><header><div class="abs-clean-partner-browser-heading"><span class="abs-clean-partner-browser-kicker">link partners</span><span class="abs-clean-partner-browser-total">${partnerScores.length}</span></div></header><label class="abs-clean-partner-browser-search"><span class="abs-clean-partner-browser-search-label">Search</span><input type="search" class="abs-clean-partner-browser-search-input" placeholder="Search partners or shared links" autocomplete="off"></label><div class="abs-clean-partner-browser-list"></div><div class="abs-clean-partner-browser-empty" hidden>No matching link partners.</div></section>`;

    const list = modal.querySelector('.abs-clean-partner-browser-list');
    const empty = modal.querySelector('.abs-clean-partner-browser-empty');
    const searchInput = modal.querySelector('.abs-clean-partner-browser-search-input');
    const normalizeSearch = value => String(value ?? '').trim().toLocaleLowerCase();
    const getSearchValues = score => [
        score?.card?.name || '',
        ...(Array.isArray(score?.sharedLinks) ? score.sharedLinks : [])
    ].map(normalizeSearch).filter(Boolean);
    const renderPartnerCards = query => {
        const needle = normalizeSearch(query);
        const visibleScores = partnerScores
            .filter(score => !needle || getSearchValues(score).some(value => value.includes(needle)))
            .slice(0, maxBrowserPartners);
        list.innerHTML = visibleScores.map(buildPartnerCard).join('');
        attachAbsCleanPartnerPortraitFallbacks(list);
        empty.hidden = visibleScores.length > 0;
        empty.textContent = needle ? 'No matching link partners.' : 'No link partners found.';
    };
    renderPartnerCards('');

    const close = () => {
        document.removeEventListener('keydown', onKeyDown);
        trigger?.setAttribute('aria-expanded', 'false');
        modal.remove();
    };
    const onKeyDown = event => {
        if (event.key === 'Escape') close();
    };
    modal._absCleanClose = close;
    modal.addEventListener('pointerdown', event => {
        if (event.target === modal) close();
    });
    searchInput.addEventListener('input', () => renderPartnerCards(searchInput.value));
    list.addEventListener('click', event => {
        const card = event.target.closest('.abs-clean-partner-browser-card');
        const url = card?.dataset?.cardUrl;
        if (url) window.location.assign(url);
    });
    document.body.appendChild(modal);
    document.addEventListener('keydown', onKeyDown);
    requestAnimationFrame(() => modal.classList.add('is-open'));
    searchInput.focus();
}

/* ===========================================================================
   abs.clean Links + Partners placement.
   The clean theme owns one bounded row containing the normal Links panel and
   the partner panel. Every move is guarded so theme toggles cannot create a
   DOM cycle or call insertBefore with an invalid anchor.
   =========================================================================== */
function absCleanSafeMove(parent, node, anchor = null) {
    if (!parent || !node || parent === node || node.contains(parent)) return false;
    const safeAnchor = anchor && anchor.parentElement === parent && anchor !== node && !node.contains(anchor)
        ? anchor
        : null;
    try {
        parent.insertBefore(node, safeAnchor);
        return true;
    } catch (error) {
        try {
            parent.appendChild(node);
            return true;
        } catch (fallbackError) {
            return false;
        }
    }
}

function absCleanGetCategoryBox() {
    return document.getElementById('abs-category-container')?.closest('.abs-box') || null;
}

/* Categories, Links, and Stats share the right-hand utility track, but they
   must not share the main grid's row height. A small clean-only wrapper keeps
   the utility panels in their own content-sized stack, independent of the
   full-width Leader/Super Attack rows. */
function absCleanEnsureCategoryLinksColumn(mainCol, categoryBox, linkSlot) {
    if (!mainCol || !categoryBox || !linkSlot) return null;

    if (!window.__absCleanCategoryLinksHome && categoryBox.parentElement === mainCol) {
        window.__absCleanCategoryLinksHome = {
            parent: mainCol,
            next: categoryBox.nextElementSibling
        };
    }

    let column = document.getElementById('abs-clean-category-links-column');
    if (!column) {
        column = document.createElement('div');
        column.id = 'abs-clean-category-links-column';
        column.className = 'abs-clean-category-links-column';
        column.setAttribute('aria-label', 'Stats, Categories, and Links');
    }

    if (column.parentElement !== mainCol) {
        const anchor = categoryBox.parentElement === mainCol ? categoryBox : null;
        absCleanSafeMove(mainCol, column, anchor);
    }

    if (categoryBox.parentElement !== column) absCleanSafeMove(column, categoryBox);
    if (linkSlot.parentElement !== column) absCleanSafeMove(column, linkSlot);

    // Preserve the established Categories -> Links order. Stats is inserted
    // immediately before Categories by its own placement helper, so Links
    // remains the final section in this utility stack.
    if (categoryBox.nextElementSibling !== linkSlot) {
        absCleanSafeMove(column, linkSlot);
    }

    column.style.setProperty('grid-area', 'utility', 'important');
    // Grid placement is owned by the clean stylesheet so the utility column
    // can remain content-sized on desktop and collapse cleanly on mobile.
    column.style.removeProperty('grid-column');
    column.style.removeProperty('grid-row');
    return column;
}

window.restoreAbsCleanCategoryLinksColumn = function() {
    const column = document.getElementById('abs-clean-category-links-column');
    const categoryBox = absCleanGetCategoryBox();
    if (categoryBox && column && categoryBox.parentElement === column) {
        const home = window.__absCleanCategoryLinksHome;
        const parent = home?.parent?.isConnected
            ? home.parent
            : document.querySelector('#layout-abs-style .abs-main-col');
        const anchor = home?.next?.parentElement === parent ? home.next : null;
        if (parent) absCleanSafeMove(parent, categoryBox, anchor);
    }
    if (column && !column.children.length) column.remove();
};

function absCleanFindLinkSkillsBox() {
    return document.getElementById('abs-link-skills-box') ||
        document.querySelector('#layout-abs-style .abs-main-col > .abs-box:has(> .abs-content > #abs-link-container)');
}

function absCleanEnsurePartnerPanelAction(partnersBox) {
    if (!partnersBox) return;

    // Older exported cards can omit the partner header entirely. Recreate the
    // small structural header here so clean mode never depends on stale HTML
    // from a previous layout revision.
    let header = partnersBox.querySelector(':scope > .abs-header');
    if (!header) {
        header = document.createElement('div');
        header.className = 'abs-header';
        const content = partnersBox.querySelector(':scope > .abs-content');
        if (content) partnersBox.insertBefore(header, content);
        else partnersBox.prepend(header);
    }

    header.hidden = false;
    header.removeAttribute('hidden');

    let title = header.querySelector(':scope > span') || header.querySelector('span');
    if (!title) {
        title = document.createElement('span');
        title.textContent = header.textContent.trim() || 'Partners';
        header.replaceChildren(title);
    }
    if (!title.dataset.absCleanOriginalTitle) title.dataset.absCleanOriginalTitle = title.textContent;
    title.textContent = 'Partners';

    const renderedPartners = partnersBox.querySelector('#abs-partners-container')?.children.length || 0;
    const hasPartners = Boolean((window.allPartnerScores?.length || 0) || renderedPartners);
    const row = document.getElementById('abs-clean-link-partners-row');
    const isCleanPartnerRow = Boolean(
        document.body?.classList.contains('theme-abs-clean') &&
        row &&
        partnersBox.parentElement === row
    );
    let action = header.querySelector('.abs-clean-partner-panel-action') ||
        row?.querySelector(':scope > .abs-clean-partners-caption > .abs-clean-partner-panel-action');
    if (!action) {
        action = document.createElement('button');
        action.type = 'button';
        action.className = 'abs-clean-partner-panel-action';
        action.textContent = 'View More';
        action.setAttribute('aria-haspopup', 'dialog');
        action.setAttribute('aria-expanded', 'false');
        action.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            action.setAttribute('aria-expanded', 'true');
            openAbsCleanPartnerBrowser(window.allPartnerScores || [], action);
        });
        header.appendChild(action);
    }
    // Keep the action available even when the preview already contains every
    // partner: it still opens the searchable full partner browser.
    action.hidden = !hasPartners;
    action.setAttribute('aria-hidden', String(!hasPartners));

    if (isCleanPartnerRow) {
        // Clean mode owns a real caption row above the panel. Moving the same
        // button node preserves its click handler while removing the legacy
        // in-box header from the visual layout.
        let caption = row.querySelector(':scope > .abs-clean-partners-caption');
        if (!caption) {
            caption = document.createElement('div');
            caption.className = 'abs-clean-partners-caption';
            caption.innerHTML = '<span class="abs-clean-partners-caption-label">Partners</span>';
            row.insertBefore(caption, partnersBox);
        }
        // Repair captions left in an old location by a cached layout revision.
        // The label/action must remain a sibling immediately before the panel,
        // otherwise flex ordering can place them underneath the partner cards.
        if (caption.parentElement !== row || caption.nextElementSibling !== partnersBox || caption !== row.firstElementChild) {
            const firstOtherChild = row.firstElementChild && row.firstElementChild !== caption
                ? row.firstElementChild
                : partnersBox;
            absCleanSafeMove(row, caption, firstOtherChild);
        }
        let captionLabel = caption.querySelector(':scope > .abs-clean-partners-caption-label');
        if (!captionLabel) {
            captionLabel = document.createElement('span');
            captionLabel.className = 'abs-clean-partners-caption-label';
            caption.prepend(captionLabel);
        }
        captionLabel.textContent = 'Partners';
        caption.appendChild(action);

        header.hidden = true;
        header.setAttribute('aria-hidden', 'true');
        header.style.setProperty('display', 'none', 'important');
        action.hidden = !hasPartners;
        action.setAttribute('aria-hidden', String(!hasPartners));
    } else {
        row?.querySelector(':scope > .abs-clean-partners-caption')?.remove();
        if (action && !header.contains(action)) header.appendChild(action);
        header.hidden = false;
        header.removeAttribute('hidden');
        header.removeAttribute('aria-hidden');
        header.style.removeProperty('display');
    }
}

function absCleanRestorePartnerPanelHeader(partnersBox) {
    const header = partnersBox?.querySelector(':scope > .abs-header') || partnersBox?.querySelector('.abs-header');
    const row = document.getElementById('abs-clean-link-partners-row');
    const caption = row?.querySelector(':scope > .abs-clean-partners-caption');
    const captionAction = caption?.querySelector('.abs-clean-partner-panel-action');
    if (header && captionAction && !header.contains(captionAction)) header.appendChild(captionAction);
    caption?.remove();
    if (header) {
        header.hidden = false;
        header.removeAttribute('hidden');
        header.removeAttribute('aria-hidden');
        header.style.removeProperty('display');
    }
    const title = header?.querySelector('span');
    if (title) {
        const orig = title.dataset?.absCleanOriginalTitle;
        title.textContent = (orig && orig !== 'Partners') ? orig : 'Linking Partners';
    }
    header?.querySelector('.abs-clean-partner-panel-action')?.remove();
}

window.syncAbsCleanLinkPartnersPlacement = function() {
    const linkSkillsBox = absCleanFindLinkSkillsBox();
    const partnersBox = document.getElementById('abs-partners-box');
    const partnersContainer = document.getElementById('abs-partners-container');
    const mainCol = document.querySelector('#layout-abs-style .abs-main-col');
    if (!linkSkillsBox || !partnersBox || !mainCol) return;

    const isClean = document.body?.classList.contains('theme-abs-clean');
    let row = document.getElementById('abs-clean-link-partners-row');
    const isSafeHomeParent = (node, parent) => Boolean(
        parent &&
        parent !== node &&
        parent.id !== 'abs-clean-link-partners-row' &&
        parent.id !== 'abs-clean-links-under-categories-slot' &&
        !node.contains(parent)
    );
    const savedHome = window.__absCleanLinkPartnersHome;
    const savedHomeIsSafe = isSafeHomeParent(linkSkillsBox, savedHome?.link?.parent) &&
        isSafeHomeParent(partnersBox, savedHome?.partners?.parent);
    const legacyLinkSlot = document.getElementById('abs-link-skills-legacy-slot');
    if (!savedHomeIsSafe) {
        const linkParent = legacyLinkSlot ||
            (isSafeHomeParent(linkSkillsBox, linkSkillsBox.parentElement) ? linkSkillsBox.parentElement : mainCol);
        const partnerParent = isSafeHomeParent(partnersBox, partnersBox.parentElement)
            ? partnersBox.parentElement
            : mainCol;
        window.__absCleanLinkPartnersHome = {
            link: {
                parent: linkParent,
                next: linkSkillsBox.parentElement === linkParent ? linkSkillsBox.nextElementSibling : null
            },
            partners: { parent: partnerParent, next: partnersBox.nextElementSibling }
        };
    }

    if (!isClean) {
        const home = window.__absCleanLinkPartnersHome || {};
        const linkHome = home.link || {};
        const partnerHome = home.partners || {};

        // A clean-only Links slot may now own the link box, while the
        // Partners row remains in its original host. Restore each live box
        // independently so theme switches never rely on a shared wrapper.
        if (linkHome.parent && linkSkillsBox.parentElement !== linkHome.parent) {
            absCleanSafeMove(linkHome.parent, linkSkillsBox, linkHome.next);
        }

        // In abs-style, partnersBox lives in the main column immediately after Categories
        const catBox = document.getElementById('abs-category-container')?.closest('.abs-box');
        if (catBox && catBox.parentElement === mainCol) {
            if (catBox.nextElementSibling !== partnersBox) {
                catBox.insertAdjacentElement('afterend', partnersBox);
            }
        } else if (partnerHome.parent && partnersBox.parentElement !== partnerHome.parent) {
            absCleanSafeMove(partnerHome.parent, partnersBox, partnerHome.next);
        } else if (partnersBox.parentElement !== mainCol) {
            mainCol.appendChild(partnersBox);
        }

        if (row && !row.contains(linkSkillsBox) && !row.contains(partnersBox)) {
            row.remove();
        } else if (row) {
            row.remove();
        }
        document.getElementById('abs-clean-links-under-categories-slot')?.remove?.();

        linkSkillsBox.classList.remove('abs-clean-link-partners-box');
        partnersBox.classList.remove('abs-clean-link-partners-box');
        partnersBox.hidden = false;
        partnersBox.style.removeProperty('display');
        const hasPartners = Boolean(
            (window.allPartnerScores && window.allPartnerScores.length > 0) ||
            (partnersContainer && partnersContainer.children.length > 0)
        );
        partnersBox.style.display = hasPartners ? 'block' : 'none';
        absCleanRestorePartnerPanelHeader(partnersBox);
        window.restoreAbsCleanCategoryLinksColumn?.();
        window.syncAbsCleanAbilityDockPlacement?.();
        return;
    }

    // Links live directly below Categories in the main grid. Partners stay in
    // the clean side/art column so the relationship rail remains beside the
    // card presentation instead of becoming another main-content row.
    let linkSlot = document.getElementById('abs-clean-links-under-categories-slot');
    const categoryBox = document.getElementById('abs-category-container')?.closest('.abs-box');
    if (!linkSlot) {
        linkSlot = document.createElement('div');
        linkSlot.id = 'abs-clean-links-under-categories-slot';
        linkSlot.setAttribute('aria-label', 'Links');
    }

    if (categoryBox?.parentElement === mainCol) {
        const alreadyAfterCategories = categoryBox.nextElementSibling === linkSlot;
        if (!alreadyAfterCategories) {
            absCleanSafeMove(mainCol, linkSlot, categoryBox.nextElementSibling);
        }
    } else if (linkSlot.parentElement !== mainCol) {
        absCleanSafeMove(mainCol, linkSlot);
    }

    if (linkSkillsBox.parentElement !== linkSlot && !linkSkillsBox.contains(linkSlot)) {
        absCleanSafeMove(linkSlot, linkSkillsBox);
    }

    const categoryLinksColumn = absCleanEnsureCategoryLinksColumn(mainCol, categoryBox, linkSlot);
    if (categoryLinksColumn) {
        categoryLinksColumn.style.setProperty('grid-area', 'utility', 'important');
        categoryLinksColumn.style.removeProperty('grid-column');
        categoryLinksColumn.style.removeProperty('grid-row');
    }

    const sideCol = document.querySelector('#layout-abs-style .abs-side-col');
    const partnerHost = sideCol || mainCol;
    if (!row) {
        row = document.createElement('div');
        row.id = 'abs-clean-link-partners-row';
        row.className = 'abs-clean-link-partners-row';
        absCleanSafeMove(partnerHost, row);
    }
    row.setAttribute('aria-label', 'Partners');

    // Repair rows created by the previous full-width implementation. Keep the
    // row in the side/art column, but make it span that column's full width.
    if (row.parentElement !== partnerHost) {
        absCleanSafeMove(partnerHost, row);
    }
    if (row.contains(linkSkillsBox)) absCleanSafeMove(linkSlot, linkSkillsBox);
    if (partnersBox.parentElement !== row && !partnersBox.contains(row)) {
        absCleanSafeMove(row, partnersBox);
    }

    // Clear stale inline sizing left by older clean revisions. The current
    // layout is content-sized, so links and partners must be free to grow.
    [linkSkillsBox, partnersBox, partnersContainer].forEach(node => {
        if (!node?.style) return;
        node.style.removeProperty('height');
        node.style.removeProperty('max-height');
        node.style.removeProperty('overflow');
    });

    linkSkillsBox.classList.add('abs-clean-link-partners-box');
    partnersBox.classList.add('abs-clean-link-partners-box');
    const hasPartners = Boolean(
        (window.allPartnerScores?.length || 0) || (partnersContainer?.children.length || 0)
    );
    row.classList.toggle('has-partners', hasPartners);
    row.classList.toggle('partner-only', !row.contains(linkSkillsBox));
    partnersBox.hidden = !hasPartners;
    partnersBox.style.setProperty('display', hasPartners ? 'flex' : 'none', 'important');
    // Run after the actual row state is applied. This keeps the caption and
    // button visible even when this function follows a render-time move.
    absCleanEnsurePartnerPanelAction(partnersBox);
    window.syncAbsCleanAbilityDockPlacement?.();
};

/* The old header-right dock is retired. Keep this function as a compatibility
   hook for existing render calls, but route clean placement to the new row. */
window.syncAbsCleanHeaderPartners = function() {
    const dock = document.getElementById('abs-clean-header-partners');
    if (dock) {
        dock.hidden = true;
        dock.replaceChildren();
    }
    if (document.body?.classList.contains('theme-abs-clean')) {
        window.syncAbsCleanLinkPartnersPlacement?.();
    }
};
