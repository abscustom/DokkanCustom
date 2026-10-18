/* Phantom card presentation. Shared card data and editor behavior stay in the existing engine. */
(() => {
    'use strict';

    const THEME = 'phantom';
    const ROOT_ID = 'layout-phantom';
    const TYPE_KEYS = new Set(['agl', 'teq', 'int', 'str', 'phy']);
    let observedRoot = null;
    let observer = null;
    let refreshFrame = 0;
    let modeClickRoot = null;
    let phantomModeSessionActive = false;
    let lastObservedTheme = null;
    let portraitRingFrame = 0;
    let portraitRingSequence = 0;
    let portraitRingResizeObserver = null;
    let observedPortraitRingStage = null;
    let artFocusController = null;
    let statCircleController = null;
    let awakeningObserver = null;
    let observedAwakeningRoot = null;
    let observedAwakeningTarget = null;
    let awakeningRootInView = false;
    let partnerBackdropObserver = null;
    let partnerBackdropSequence = 0;
    let partnerBackdropSelection = '';
    let partnerBackdropCandidates = new Map();
    let partnerDetailsPopover = null;
    let partnerDetailsRoot = null;
    let partnerDetailsTrigger = null;
    let partnerDetailsDismissHandlers = null;
    const artFocusNarrowMedia = window.matchMedia?.('(max-width: 760px)') || null;
    const artFocusReducedMotionMedia = window.matchMedia?.('(prefers-reduced-motion: reduce)') || null;
    const portraitAlphaCache = new Map();
    const suppressedVideoAutoplay = new WeakMap();
    const guardedVideos = new WeakSet();

    function getRoot() {
        return window.getCardLayoutRoot?.(THEME) || document.getElementById(ROOT_ID);
    }

    function getElement(root, id) {
        return window.getCardLayoutElement?.(id, root) ||
            root?.querySelector?.(`[data-card-element="${CSS.escape(id)}"]`) ||
            root?.querySelector?.(`#${CSS.escape(id)}`) || null;
    }

    function portraitAlphaBounds(source) {
        if (portraitAlphaCache.has(source)) return portraitAlphaCache.get(source);
        const result = fetch(source, { mode: 'cors', credentials: 'omit' }).then(async response => {
            if (!response.ok || typeof createImageBitmap !== 'function') return null;
            const bitmap = await createImageBitmap(await response.blob());
            const naturalWidth = bitmap.width;
            const naturalHeight = bitmap.height;
            const width = Math.max(1, Math.min(256, naturalWidth));
            const height = Math.max(1, Math.min(256, naturalHeight));
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const context = canvas.getContext('2d', { willReadFrequently: true });
            if (!context) {
                bitmap.close?.();
                return null;
            }
            context.drawImage(bitmap, 0, 0, width, height);
            const pixels = context.getImageData(0, 0, width, height).data;
            bitmap.close?.();
            let minX = width;
            let minY = height;
            let maxX = -1;
            let maxY = -1;
            for (let y = 0; y < height; y += 1) {
                for (let x = 0; x < width; x += 1) {
                    if (pixels[(y * width + x) * 4 + 3] <= 32) continue;
                    minX = Math.min(minX, x);
                    minY = Math.min(minY, y);
                    maxX = Math.max(maxX, x);
                    maxY = Math.max(maxY, y);
                }
            }
            if (maxX < 0) return null;
            return {
                centerX: ((minX + maxX + 1) / 2) * naturalWidth / width,
                centerY: ((minY + maxY + 1) / 2) * naturalHeight / height,
                width: naturalWidth,
                height: naturalHeight
            };
        }).catch(() => null);
        portraitAlphaCache.set(source, result);
        if (portraitAlphaCache.size > 48) portraitAlphaCache.delete(portraitAlphaCache.keys().next().value);
        return result;
    }

    function objectPositionOffset(value, remaining) {
        const token = String(value || '').trim().toLowerCase();
        if (token.endsWith('%')) return remaining * (Number.parseFloat(token) || 0) / 100;
        if (token === 'center') return remaining / 2;
        if (token === 'right' || token === 'bottom') return remaining;
        if (token === 'left' || token === 'top') return 0;
        return Number.parseFloat(token) || 0;
    }

    function syncFallbackPortraitRingCenter(stage) {
        if (!stage) return;
        const ring = getComputedStyle(stage, '::before');
        const read = value => Number.parseFloat(value) || 0;
        const ringHeight = read(ring.height) +
            (ring.boxSizing === 'border-box' ? 0 : read(ring.borderTopWidth) + read(ring.borderBottomWidth));
        const stageWidth = stage.clientWidth || stage.offsetWidth;
        const stageHeight = stage.clientHeight || stage.offsetHeight;
        if (!(stageWidth > 0) || !(stageHeight > 0) || !(ringHeight > 0)) return;
        const bottom = ring.bottom === 'auto' ? 14 : read(ring.bottom);
        stage.style.setProperty('--phantom-ring-center-x', `${stageWidth / 2}px`);
        stage.style.setProperty('--phantom-ring-center-y', `${stageHeight - bottom - ringHeight / 2}px`);
        stage.style.setProperty('--phantom-ring-bottom', 'auto');
        stage.style.setProperty('--phantom-ring-transform', 'translate(-50%, -50%)');
    }

    async function syncPortraitRing(root) {
        const stage = getElement(root, 'abs-art-layers-container');
        const characterArt = getElement(root, 'abs-art-char');
        const imageArt = getElement(root, 'abs-art-img');
        if (!stage) return;
        const isRendered = image => {
            if (!image) return false;
            const style = getComputedStyle(image);
            const rect = image.getBoundingClientRect();
            return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0 &&
                rect.width > 0 && rect.height > 0;
        };
        const portrait = isRendered(characterArt) ? characterArt
            : isRendered(imageArt) ? imageArt
                : null;
        if (!portrait) {
            stage.style.removeProperty('--phantom-ring-center-x');
            stage.style.removeProperty('--phantom-ring-center-y');
            stage.style.removeProperty('--phantom-ring-bottom');
            stage.style.removeProperty('--phantom-ring-transform');
            delete stage.dataset.phantomRingSource;
            root.dataset.phantomRingPosition = 'default';
            syncFallbackPortraitRingCenter(stage);
            refreshStatCircleRingGeometry(root);
            return;
        }
        const source = String(portrait.currentSrc || portrait.getAttribute('src') || '').trim();
        if (!source || !portrait.complete || !portrait.naturalWidth || !portrait.naturalHeight) {
            stage.style.removeProperty('--phantom-ring-center-x');
            stage.style.removeProperty('--phantom-ring-center-y');
            stage.style.removeProperty('--phantom-ring-bottom');
            stage.style.removeProperty('--phantom-ring-transform');
            delete stage.dataset.phantomRingSource;
            root.dataset.phantomRingPosition = 'default';
            syncFallbackPortraitRingCenter(stage);
            refreshStatCircleRingGeometry(root);
            return;
        }
        if (stage.dataset.phantomRingSource !== source) {
            stage.style.removeProperty('--phantom-ring-center-x');
            stage.style.removeProperty('--phantom-ring-center-y');
            stage.style.removeProperty('--phantom-ring-bottom');
            stage.style.removeProperty('--phantom-ring-transform');
            stage.dataset.phantomRingSource = source;
            root.dataset.phantomRingPosition = 'default';
            syncFallbackPortraitRingCenter(stage);
        }
        const portraitStyle = getComputedStyle(portrait);

        const requestSequence = ++portraitRingSequence;
        const alpha = await portraitAlphaBounds(source);
        if (!alpha || requestSequence !== portraitRingSequence || getRoot() !== root ||
            String(portrait.currentSrc || portrait.getAttribute('src') || '').trim() !== source) return;

        const stageRect = stage.getBoundingClientRect();
        let imageRect = portrait.getBoundingClientRect();
        const layoutWidth = portrait.offsetWidth || stage.clientWidth;
        const layoutHeight = portrait.offsetHeight || stage.clientHeight;
        if (!stageRect.width || !stageRect.height || !imageRect.width || !imageRect.height || !layoutWidth || !layoutHeight) return;

        const fit = portraitStyle.objectFit || 'fill';
        const containScale = Math.min(layoutWidth / alpha.width, layoutHeight / alpha.height);
        const coverScale = Math.max(layoutWidth / alpha.width, layoutHeight / alpha.height);
        const uniformScale = fit === 'cover' ? coverScale
            : fit === 'none' ? 1
                : fit === 'scale-down' ? Math.min(1, containScale)
                    : containScale;
        const contentWidth = fit === 'fill' ? layoutWidth : alpha.width * uniformScale;
        const contentHeight = fit === 'fill' ? layoutHeight : alpha.height * uniformScale;
        const contentScaleX = fit === 'fill' ? layoutWidth / alpha.width : uniformScale;
        const contentScaleY = fit === 'fill' ? layoutHeight / alpha.height : uniformScale;
        const position = (portraitStyle.objectPosition || '50% 50%').split(/\s+/);
        const offsetX = objectPositionOffset(position[0], layoutWidth - contentWidth);
        const offsetY = objectPositionOffset(position[1] || position[0], layoutHeight - contentHeight);
        const imageScaleX = imageRect.width / layoutWidth;
        const imageScaleY = imageRect.height / layoutHeight;
        let visibleCenterX = imageRect.left + (offsetX + alpha.centerX * contentScaleX) * imageScaleX;
        const visibleCenterY = imageRect.top + (offsetY + alpha.centerY * contentScaleY) * imageScaleY;
        const stageCenterX = stageRect.left + stageRect.width / 2;
        const centerCorrectionX = stageCenterX - visibleCenterX;
        if (Math.abs(centerCorrectionX) > 0.25) {
            const currentShiftX = Number.parseFloat(portrait.style.getPropertyValue('--phantom-art-visible-center-shift-x')) || 0;
            portrait.style.setProperty('--phantom-art-visible-center-shift-x', `${currentShiftX + centerCorrectionX / imageScaleX}px`);
            imageRect = portrait.getBoundingClientRect();
            visibleCenterX = imageRect.left + (offsetX + alpha.centerX * contentScaleX) * imageScaleX;
        }
        const stageScaleX = stageRect.width / stage.offsetWidth;
        const stageScaleY = stageRect.height / stage.offsetHeight;
        stage.style.setProperty('--phantom-ring-center-x', `${(visibleCenterX - stageRect.left) / stageScaleX}px`);
        stage.style.setProperty('--phantom-ring-center-y', `${(visibleCenterY - stageRect.top) / stageScaleY}px`);
        stage.style.setProperty('--phantom-ring-bottom', 'auto');
        stage.style.setProperty('--phantom-ring-transform', 'translate(-50%, -50%)');
        root.dataset.phantomRingPosition = 'visible-art-center';
        refreshStatCircleRingGeometry(root);
    }

    function schedulePortraitRing(root) {
        if (portraitRingFrame) cancelAnimationFrame(portraitRingFrame);
        portraitRingFrame = requestAnimationFrame(async () => {
            portraitRingFrame = 0;
            await syncPortraitRing(root);
        });
    }

    function observePortraitRingStage(root) {
        const stage = getElement(root, 'abs-art-layers-container');
        if (!stage || stage === observedPortraitRingStage) return;
        portraitRingResizeObserver?.disconnect();
        portraitRingResizeObserver = new ResizeObserver(() => schedulePortraitRing(root));
        portraitRingResizeObserver.observe(stage);
        observedPortraitRingStage = stage;
    }

    function ensureChild(parent, className, key, tagName = 'div') {
        if (!parent) return null;
        let child = parent.querySelector(`:scope > [data-phantom-slot="${key}"]`);
        if (!child) {
            child = document.createElement(tagName);
            child.className = className;
            child.dataset.phantomSlot = key;
            parent.appendChild(child);
        }
        child.classList.add(className);
        return child;
    }

    function ensureStructure(root) {
        const header = root.querySelector('.abs-top-header');
        const content = root.querySelector('.abs-grid-container');
        if (!header || !content) return false;

        header.classList.add('phantom-hero');
        header.classList.add('phantom-presentation-active');
        const artColumn = ensureChild(header, 'phantom-art-column', 'art-column');
        const legacyPortrait = header.querySelector(':scope > [data-phantom-slot="portrait"]');
        if (legacyPortrait && legacyPortrait.parentElement !== artColumn) artColumn.appendChild(legacyPortrait);
        const portrait = ensureChild(artColumn, 'phantom-hero-portrait', 'portrait');
        const identity = ensureChild(header, 'phantom-hero-identity', 'identity');
        identity.querySelector(':scope > [data-phantom-slot="partner-picker"]')?.remove();
        const typeBadge = ensureChild(identity, 'phantom-type-badge', 'type', 'span');
        const classification = ensureChild(identity, 'phantom-summon-classification', 'classification', 'span');
        const classificationStatus = ensureChild(classification, 'phantom-classification-status', 'classification-status', 'span');
        const identityContent = ensureChild(identity, 'phantom-identity-content', 'identity-content');
        const facts = ensureChild(identity, 'phantom-hero-facts', 'facts');
        const summaryPanel = ensureChild(facts, 'phantom-passive-summary-panel', 'passive-summary');
        const partnerBackdrop = root.querySelector('[data-phantom-slot="partner-backdrop"]') ||
            ensureChild(facts, 'phantom-partner-backdrop', 'partner-backdrop');
        partnerBackdrop.classList.add('phantom-partner-backdrop');
        root.querySelectorAll('[data-phantom-slot="partner-backdrop"]')
            .forEach(row => { if (row !== partnerBackdrop) row.remove(); });
        const summaryHeading = ensureChild(summaryPanel, 'phantom-passive-summary-heading', 'passive-summary-heading');
        const summaryLabel = ensureChild(summaryHeading, 'phantom-passive-summary-label', 'passive-summary-label', 'span');
        const prioritySections = root.querySelector('[data-phantom-slot="priority-sections"]') ||
            ensureChild(root, 'phantom-priority-sections', 'priority-sections');
        prioritySections.classList.add('phantom-priority-sections');
        summaryLabel.textContent = 'PASSIVE TOTALS';

        const headerLeft = root.querySelector('.abs-header-left');
        const headerRight = root.querySelector('.abs-header-right');
        const nameLine = headerLeft?.querySelector('.abs-clean-name-line');
        const artControlsRow = ensureChild(nameLine || identityContent, 'phantom-art-controls-row', 'art-controls');
        const characterName = getElement(root, 'abs-char-name');
        const art = getElement(root, 'abs-art-dock-wrapper');
        const artToggleBar = getElement(root, 'abs-art-toggle-bar');
        const awakeningToggleBar = getElement(root, 'abs-eza-toggle-bar');
        const classificationText = getElement(root, 'abs-art-header-text');
        const summary = getElement(root, 'abs-passive-summary');
        const statsChartHost = ensureChild(artColumn, 'phantom-stats-chart-host', 'stats-chart');
        const passiveAbilityDocks = getElement(root, 'abs-clean-ability-docks');
        const leaderSkill = getElement(root, 'abs-leader-skill-box');
        const categories = getElement(root, 'abs-categories-box') || getElement(root, 'abs-category-container')?.closest('.abs-box');
        const stats = getElement(root, 'abs-stats-box');
        const linkSkillsBox = getElement(root, 'abs-link-skills-box');
        const legacyPartners = getElement(root, 'abs-partners-box');
        const phantomThemeActive = document.body?.classList.contains(`theme-${THEME}`) || false;

        if (legacyPartners) {
            legacyPartners.inert = phantomThemeActive;
            if (phantomThemeActive) legacyPartners.setAttribute('aria-hidden', 'true');
            else legacyPartners.removeAttribute('aria-hidden');
        }

        if (headerLeft && headerLeft.parentElement !== identityContent) identityContent.appendChild(headerLeft);
        if (headerRight && headerRight.parentElement !== facts) facts.appendChild(headerRight);
        if (art && art.parentElement !== portrait) portrait.appendChild(art);
        if (artToggleBar && artToggleBar.parentElement !== artControlsRow) artControlsRow.appendChild(artToggleBar);
        if (awakeningToggleBar && awakeningToggleBar.parentElement !== artControlsRow) artControlsRow.appendChild(awakeningToggleBar);
        artControlsRow.setAttribute('role', 'group');
        artControlsRow.setAttribute('aria-label', 'Card artwork, awakening, and battle motion');
        if (characterName && artControlsRow.parentElement === nameLine && characterName.nextElementSibling !== artControlsRow) {
            nameLine.insertBefore(artControlsRow, characterName.nextElementSibling);
        }
        root.querySelectorAll('[data-phantom-slot="art-controls"]')
            .forEach(row => { if (row !== artControlsRow) row.remove(); });
        const artSourceNote = ensureChild(portrait, 'phantom-art-source-note', 'art-source-note', 'span');
        root.querySelectorAll([
            '[data-phantom-slot="awakening-stages"]', '.phantom-awakening-stage-art',
            '.phantom-awakening-connectors', '.phantom-awakening-connector',
            '.phantom-awakening-connector-endpoint', '.phantom-awakening-stage-button',
            '.phantom-awakening-stage-portrait', '.phantom-awakening-stage-image',
            '.phantom-awakening-stage-label'
        ].join(','))
            .forEach(node => node.remove());
        delete root.dataset.phantomAwakeningStages;
        artSourceNote.setAttribute('role', 'status');
        artSourceNote.setAttribute('aria-live', 'polite');
        if (art && art.parentElement === portrait) portrait.insertBefore(art, portrait.firstChild);
        if (artSourceNote.parentElement === portrait) portrait.appendChild(artSourceNote);
        if (classificationText && classificationText.parentElement !== classification) classification.appendChild(classificationText);
        classificationStatus.textContent = 'Summon classification unavailable';
        classificationStatus.setAttribute('role', 'status');
        classificationStatus.setAttribute('aria-live', 'polite');
        if (summary && summary.parentElement !== summaryPanel) summaryPanel.appendChild(summary);
        if (summaryLabel.parentElement !== summaryHeading) summaryHeading.appendChild(summaryLabel);
        if (passiveAbilityDocks && passiveAbilityDocks.parentElement !== summaryHeading) summaryHeading.appendChild(passiveAbilityDocks);
        if (summaryHeading.parentElement !== summaryPanel) summaryPanel.insertBefore(summaryHeading, summary || null);
        else if (summary && summaryHeading.nextElementSibling !== summary) summaryPanel.insertBefore(summaryHeading, summary);
        if (leaderSkill && leaderSkill.parentElement !== prioritySections) prioritySections.appendChild(leaderSkill);
        if (categories && categories.parentElement !== prioritySections) prioritySections.appendChild(categories);
        if (stats && statsChartHost && stats.parentElement !== statsChartHost) statsChartHost.appendChild(stats);
        else if (stats && !statsChartHost && stats.parentElement !== prioritySections) prioritySections.appendChild(stats);
        if (summaryPanel.parentElement !== facts) facts.appendChild(summaryPanel);
        if (statsChartHost.parentElement !== artColumn || statsChartHost.previousElementSibling !== portrait) {
            artColumn.insertBefore(statsChartHost, portrait.nextElementSibling);
        }
        if (prioritySections.parentElement !== root || header.nextElementSibling !== prioritySections ||
            prioritySections.nextElementSibling !== content) {
            root.insertBefore(prioritySections, content);
        }
        Array.from(root.children)
            .filter(child => child !== prioritySections && child.dataset.phantomSlot === 'priority-sections')
            .forEach(child => child.remove());

        [artColumn, identity].forEach((child) => {
            if (child.parentElement !== header) header.appendChild(child);
        });
        partnerBackdrop.removeAttribute('aria-hidden');
        [typeBadge, classification, identityContent, facts].forEach((child) => {
            if (child.parentElement !== identity) identity.appendChild(child);
        });
        [summary].filter(Boolean).forEach((child) => {
            if (child.parentElement !== summaryPanel) summaryPanel.appendChild(child);
        });
        [headerLeft, headerRight].filter(Boolean).forEach((child) => {
            const parent = child === headerLeft ? identityContent : facts;
            if (child.parentElement !== parent) parent.appendChild(child);
        });
        if (linkSkillsBox && (linkSkillsBox.parentElement !== facts || summaryPanel.nextElementSibling !== linkSkillsBox)) {
            facts.insertBefore(linkSkillsBox, summaryPanel.nextElementSibling);
        }
        const partnerBackdropAnchor = linkSkillsBox?.parentElement === facts
            ? linkSkillsBox.nextElementSibling
            : summaryPanel.nextElementSibling;
        if (partnerBackdrop.parentElement !== facts || partnerBackdrop !== partnerBackdropAnchor) {
            facts.insertBefore(partnerBackdrop, partnerBackdropAnchor);
        }
        syncClassification(root);
        syncArtControlVisibility(root);
        syncCategoryPills(root);

        // Keep the original section roots and edit targets. Only move their live presentation nodes.
        root.classList.add('phantom-presentation-active');
        root.dataset.phantomPresentationReady = 'true';
        return true;
    }

    function currentType(root) {
        const icon = getElement(root, 'abs-top-type-icon') || getElement(root, 'abs-type-icon');
        const iconPath = String(icon?.currentSrc || icon?.src || '');
        const iconMatch = iconPath.match(/type_(super|extreme)[_-]?(agl|teq|int|str|phy)/i);
        const type = String(document.body?.dataset?.absCleanType || window.currentType || iconMatch?.[2] || '')
            .trim()
            .toLowerCase();
        return {
            type: TYPE_KEYS.has(type) ? type : '',
            cardClass: iconMatch?.[1]?.toUpperCase() || ''
        };
    }

    function syncPartnerBackdropSelection(root) {
        if (!root) return;
        const partnerBackdrop = root.querySelector('[data-phantom-slot="partner-backdrop"]');
        const selectedId = partnerBackdropSelection;
        root.dataset.phantomPartnerSelectedId = selectedId;
        partnerBackdrop?.querySelectorAll('[data-phantom-partner-id]').forEach(layer => {
            layer.dataset.selected = String(Boolean(selectedId) && layer.dataset.phantomPartnerId === selectedId);
            layer.setAttribute('aria-pressed', String(Boolean(selectedId) && layer.dataset.phantomPartnerId === selectedId));
            layer.setAttribute('aria-expanded', String(Boolean(partnerDetailsPopover &&
                partnerDetailsRoot === root && partnerDetailsTrigger === layer &&
                layer.dataset.phantomPartnerId === selectedId)));
        });
    }

    function partnerCardLinkNames(card) {
        let values = [];
        try {
            values = window.getCardLinkValues?.(card) || card?.links || card?.link_skill_ids || [];
        } catch (error) {
            values = card?.links || card?.link_skill_ids || [];
        }
        if (!Array.isArray(values)) return [];

        const linkTable = window.DB?.links || {};
        const seen = new Set();
        return values.map(value => {
            if (value && typeof value === 'object') {
                const id = String(value.id || value.link_id || value.link_skill_id || '');
                return String(value.name || linkTable[id]?.name || '').trim();
            }
            const raw = String(value || '').trim();
            return String(linkTable[raw]?.name || raw).trim();
        }).filter(name => {
            if (!name) return false;
            const key = name.replace(/\s+/g, ' ').toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    function partnerEffectRows(buffs = {}) {
        const rows = [
            { key: 'atk', label: 'ATK', suffix: '%' },
            { key: 'def', label: 'DEF', suffix: '%' },
            { key: 'ki', label: 'Ki', suffix: '' },
            { key: 'hp', label: 'HP recovery', suffix: '%' },
            { key: 'enemyDef', label: 'Enemy DEF', suffix: '%' }
        ];
        return rows.map(({ key, label, suffix }) => {
            const value = Number(buffs?.[key]);
            if (!Number.isFinite(value) || value === 0) return null;
            const amount = Number.isInteger(value) ? String(Math.abs(value)) : String(Math.abs(value)).replace(/(\.\d*?[1-9])0+$/, '$1');
            const formatted = key === 'enemyDef'
                ? `${value > 0 ? '+' : '−'}${amount}${suffix}`
                : `+${amount}${suffix}`;
            return { label, value: formatted };
        }).filter(Boolean);
    }

    function positionPartnerDetails() {
        if (!partnerDetailsPopover || !partnerDetailsTrigger?.isConnected) return;
        const anchor = partnerDetailsTrigger.getBoundingClientRect();
        const panel = partnerDetailsPopover.getBoundingClientRect();
        const edge = 12;
        const gap = 10;
        const mobile = window.innerWidth <= 620;
        let left;
        if (mobile) {
            left = (anchor.left + anchor.right - panel.width) / 2;
        } else if (window.innerWidth - anchor.right >= panel.width + edge + gap) {
            left = anchor.right + gap;
        } else if (anchor.left >= panel.width + edge + gap) {
            left = anchor.left - panel.width - gap;
        } else {
            left = Math.max(edge, Math.min(anchor.left, window.innerWidth - panel.width - edge));
        }

        const roomBelow = window.innerHeight - anchor.bottom - edge;
        const roomAbove = anchor.top - edge;
        let top = roomBelow >= Math.min(panel.height, 250) || roomBelow >= roomAbove
            ? anchor.bottom + gap
            : anchor.top - panel.height - gap;
        left = Math.max(edge, Math.min(left, window.innerWidth - panel.width - edge));
        top = Math.max(edge, Math.min(top, window.innerHeight - panel.height - edge));
        partnerDetailsPopover.style.left = `${left}px`;
        partnerDetailsPopover.style.top = `${top}px`;
    }

    function closePartnerDetails({ restoreFocus = false } = {}) {
        const popover = partnerDetailsPopover;
        const root = partnerDetailsRoot;
        const trigger = partnerDetailsTrigger;
        const handlers = partnerDetailsDismissHandlers;
        if (handlers) {
            document.removeEventListener('pointerdown', handlers.onPointerDown, true);
            document.removeEventListener('keydown', handlers.onKeyDown, true);
            document.removeEventListener('scroll', handlers.onViewportChange, true);
            window.removeEventListener('resize', handlers.onViewportChange);
        }
        popover?.remove();
        if (root) {
            root.removeAttribute('data-phantom-partner-panel-open');
            partnerBackdropSelection = '';
            syncPartnerBackdropSelection(root);
        }
        if (trigger) trigger.setAttribute('aria-expanded', 'false');
        partnerDetailsPopover = null;
        partnerDetailsRoot = null;
        partnerDetailsTrigger = null;
        partnerDetailsDismissHandlers = null;
        if (restoreFocus && trigger?.isConnected && !trigger.disabled) {
            trigger.focus({ preventScroll: true });
        }
    }

    function openPartnerDetails(root, partnerId, trigger) {
        const candidate = partnerBackdropCandidates.get(String(partnerId || ''));
        if (!root || !candidate || !trigger?.isConnected || root.dataset.phantomArtFocus === 'true') return false;
        closePartnerDetails();
        partnerBackdropSelection = candidate.id;
        syncPartnerBackdropSelection(root);

        const currentCard = window.__absViewerCard || window.currentCard || window.currentCardData || null;
        const currentName = getElement(root, 'abs-char-name')?.textContent?.trim() || 'Current character';
        const currentLinks = partnerCardLinkNames(currentCard);
        const partnerLinks = partnerCardLinkNames(candidate.card);
        const sharedLinks = Array.isArray(candidate.sharedLinks) ? candidate.sharedLinks : [];
        const sharedCount = Number(candidate.sharedCount) || sharedLinks.length;
        const popover = document.createElement('section');
        popover.id = 'phantom-link-partner-details';
        popover.className = 'phantom-link-partner-popover';
        popover.setAttribute('role', 'dialog');
        popover.setAttribute('aria-modal', 'false');
        popover.setAttribute('aria-labelledby', 'phantom-link-partner-details-title');
        popover.setAttribute('tabindex', '-1');
        popover.dataset.partnerId = candidate.id;
        popover.dataset.sharedCount = String(sharedCount);
        popover.dataset.currentLinkCount = String(currentLinks.length);
        popover.dataset.partnerLinkCount = String(partnerLinks.length);
        popover.dataset.linkLevel = '10';

        const header = document.createElement('header');
        header.className = 'phantom-link-partner-popover-header';
        const title = document.createElement('h3');
        title.id = 'phantom-link-partner-details-title';
        title.textContent = candidate.name;
        const closeButton = document.createElement('button');
        closeButton.type = 'button';
        closeButton.className = 'phantom-link-partner-popover-close';
        closeButton.setAttribute('aria-label', 'Close shared link details');
        closeButton.textContent = '×';
        closeButton.addEventListener('click', () => closePartnerDetails({ restoreFocus: true }));
        header.append(title, closeButton);

        const context = document.createElement('p');
        context.className = 'phantom-link-partner-popover-context';
        context.textContent = `Shared with ${currentName}`;
        const count = document.createElement('p');
        count.className = 'phantom-link-partner-popover-count';
        const countFractions = [];
        if (currentLinks.length) countFractions.push(`${sharedCount} / ${currentLinks.length} current links`);
        if (partnerLinks.length) countFractions.push(`${sharedCount} / ${partnerLinks.length} partner links`);
        count.textContent = countFractions.length
            ? countFractions.join(' · ')
            : `${sharedCount} shared link${sharedCount === 1 ? '' : 's'}`;

        const totals = document.createElement('section');
        totals.className = 'phantom-link-partner-popover-totals';
        const totalsHeading = document.createElement('h4');
        totalsHeading.textContent = 'Combined shared-link bonuses · Lv. 10';
        totals.appendChild(totalsHeading);
        const effects = document.createElement('div');
        effects.className = 'phantom-link-partner-popover-effects';
        const effectRows = partnerEffectRows(candidate.buffs);
        if (effectRows.length) {
            effectRows.forEach(({ label, value }) => {
                const badge = document.createElement('span');
                badge.className = 'phantom-link-partner-effect';
                const badgeLabel = document.createElement('span');
                badgeLabel.textContent = label;
                const badgeValue = document.createElement('strong');
                badgeValue.textContent = value;
                badge.append(badgeLabel, badgeValue);
                effects.appendChild(badge);
            });
        } else {
            const empty = document.createElement('p');
            empty.className = 'phantom-link-partner-popover-empty';
            empty.textContent = 'No numeric bonuses in the existing partner preview.';
            effects.appendChild(empty);
        }
        totals.appendChild(effects);

        const linksSection = document.createElement('section');
        linksSection.className = 'phantom-link-partner-popover-links';
        const linksHeading = document.createElement('h4');
        linksHeading.textContent = 'Shared links';
        const linksList = document.createElement('ul');
        sharedLinks.forEach(linkName => {
            const item = document.createElement('li');
            const name = document.createElement('strong');
            name.textContent = String(linkName);
            const description = document.createElement('span');
            description.textContent = String(window.getLinkSkillLevel10Description?.(linkName) || 'Level 10 effect details unavailable.');
            item.append(name, description);
            linksList.appendChild(item);
        });
        linksSection.append(linksHeading, linksList);

        const note = document.createElement('p');
        note.className = 'phantom-link-partner-popover-note';
        note.textContent = 'This uses the existing Level 10 partner preview. It shows link-only effects, not passive or leader totals; per-link text retains conditions.';
        popover.append(header, context, count, totals, linksSection, note);
        document.body.appendChild(popover);

        partnerDetailsPopover = popover;
        partnerDetailsRoot = root;
        partnerDetailsTrigger = trigger;
        root.dataset.phantomPartnerPanelOpen = candidate.id;
        trigger.setAttribute('aria-controls', popover.id);
        trigger.setAttribute('aria-haspopup', 'dialog');
        trigger.setAttribute('aria-expanded', 'true');

        const onPointerDown = event => {
            const target = event.target;
            if (popover.contains(target)) return;
            if (root.contains(target) && target?.closest?.('[data-phantom-partner-id]')) return;
            closePartnerDetails();
        };
        const onKeyDown = event => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            event.stopPropagation();
            closePartnerDetails({ restoreFocus: true });
        };
        const onViewportChange = () => positionPartnerDetails();
        partnerDetailsDismissHandlers = { onPointerDown, onKeyDown, onViewportChange };
        document.addEventListener('pointerdown', onPointerDown, true);
        document.addEventListener('keydown', onKeyDown, true);
        document.addEventListener('scroll', onViewportChange, true);
        window.addEventListener('resize', onViewportChange, { passive: true });
        positionPartnerDetails();
        popover.focus({ preventScroll: true });
        return true;
    }

    function syncPartnerBackdrop(root) {
        const partnerBackdrop = root?.querySelector('[data-phantom-slot="partner-backdrop"]');
        if (!root || !partnerBackdrop) return false;
        if (partnerBackdrop.dataset.phantomPartnerBackdropBound !== 'true') {
            partnerBackdrop.dataset.phantomPartnerBackdropBound = 'true';
            partnerBackdrop.addEventListener('click', event => {
                const button = event.target?.closest?.('button[data-phantom-partner-id]');
                if (!button || !partnerBackdrop.contains(button)) return;
                event.preventDefault();
                event.stopPropagation();
                openPartnerDetails(root, button.dataset.phantomPartnerId || '', button);
            });
        }

        const partnerBox = getElement(root, 'abs-partners-box');
        const partnerResultsAvailable = Boolean(partnerBox && !partnerBox.hidden &&
            getComputedStyle(partnerBox).display !== 'none');
        const currentCard = window.__absViewerCard || window.currentCard || window.currentCardData || null;
        const currentName = getElement(root, 'abs-char-name')?.textContent?.trim() || '';
        const currentCardId = String(currentCard?.id || window.currentCardId || '');
        const currentMode = String(window.__absViewerMode || window.currentAwakeningMode || 'base');
        const currentLinkNames = partnerCardLinkNames(currentCard);
        const firstFive = partnerResultsAvailable && Array.isArray(window.allPartnerScores)
            ? window.allPartnerScores.slice(0, 5)
            : [];
        const candidates = firstFive.map(score => {
            const card = score?.card;
            if (!card?.id || typeof window.resolveCardAssets !== 'function') return null;
            let characterPng = '';
            try {
                characterPng = String(window.resolveCardAssets(card)?.charUrl || '').trim();
            } catch (error) {
                characterPng = '';
            }
            if (!characterPng) return null;
            return {
                id: String(card.id),
                name: String(card.name || 'Link Partner'),
                sharedCount: Number(score.sharedCount) || 0,
                sharedLinks: Array.isArray(score.sharedLinks) ? score.sharedLinks.map(link => String(link || '').trim()).filter(Boolean) : [],
                buffs: score.buffs && typeof score.buffs === 'object' ? { ...score.buffs } : {},
                card,
                partnerLinkCount: partnerCardLinkNames(card).length,
                src: characterPng
            };
        }).filter(Boolean);
        const signature = JSON.stringify({
            cardId: currentCardId,
            name: currentName,
            mode: currentMode,
            currentLinks: currentLinkNames,
            partnerResultsAvailable,
            partners: firstFive.map(score => [
                String(score?.card?.id || ''),
                Number(score?.sharedCount) || 0,
                Array.isArray(score?.sharedLinks) ? score.sharedLinks : [],
                score?.buffs || {}
            ]),
            art: candidates.map(({ id, src }) => [id, src])
        });
        root.dataset.phantomPartnerBackdropRequestCount = String(candidates.length);
        if (partnerBackdrop.dataset.signature === signature) {
            syncPartnerBackdropSelection(root);
            return candidates.length > 0;
        }

        partnerBackdropSequence += 1;
        const sequence = partnerBackdropSequence;
        closePartnerDetails();
        partnerBackdropSelection = '';
        partnerBackdropCandidates = new Map(candidates.map(candidate => [candidate.id, candidate]));
        partnerBackdrop.replaceChildren();
        partnerBackdrop.dataset.signature = signature;
        partnerBackdrop.hidden = !candidates.length;
        root.dataset.phantomPartnerBackdropCount = String(candidates.length);
        root.dataset.phantomPartnerSelectedId = '';
        if (!candidates.length) return false;

        candidates.forEach(candidate => {
            const layer = document.createElement('button');
            layer.type = 'button';
            layer.className = 'phantom-partner-backdrop-item';
            layer.dataset.phantomPartnerId = candidate.id;
            layer.setAttribute('aria-label', `Show ${candidate.name} shared links with ${currentName || 'current character'}`);
            layer.setAttribute('aria-pressed', 'false');
            layer.setAttribute('aria-haspopup', 'dialog');
            layer.setAttribute('aria-expanded', 'false');
            layer.setAttribute('aria-controls', 'phantom-link-partner-details');
            layer.disabled = true;
            const image = document.createElement('img');
            image.alt = '';
            image.setAttribute('aria-hidden', 'true');
            image.decoding = 'async';
            image.loading = 'eager';
            image.draggable = false;
            layer.appendChild(image);
            partnerBackdrop.appendChild(layer);

            image.addEventListener('load', () => {
                if (sequence !== partnerBackdropSequence || getRoot() !== root ||
                    partnerBackdrop.dataset.signature !== signature) {
                    layer.remove();
                    return;
                }
                layer.classList.add('is-loaded');
                layer.disabled = false;
            }, { once: true });
            image.addEventListener('error', () => {
                if (sequence !== partnerBackdropSequence || getRoot() !== root ||
                    partnerBackdrop.dataset.signature !== signature) return;
                if (partnerBackdropSelection === candidate.id) closePartnerDetails();
                layer.remove();
                partnerBackdropCandidates.delete(candidate.id);
                root.dataset.phantomPartnerBackdropCount = String(partnerBackdrop.childElementCount);
                if (partnerBackdropSelection === candidate.id) partnerBackdropSelection = '';
                const hasAvailableArt = partnerBackdrop.childElementCount > 0;
                partnerBackdrop.hidden = !hasAvailableArt;
                if (!hasAvailableArt) {
                    root.dataset.phantomPartnerSelectedId = '';
                }
                syncPartnerBackdropSelection(root);
            }, { once: true });
            image.src = candidate.src;
        });
        syncPartnerBackdropSelection(root);
        return true;
    }

    function syncType(root) {
        const badge = root.querySelector('[data-phantom-slot="type"]');
        if (!badge) return;
        const { type, cardClass } = currentType(root);
        const label = [cardClass, type.toUpperCase()].filter(Boolean).join(' ');
        badge.textContent = label;
        badge.hidden = true;
        badge.setAttribute('aria-label', label ? `Character type ${label}` : 'Character type unavailable');
        badge.dataset.cardType = type;
        const accent = window.lightningColors?.[type] || 'rgb(150, 155, 165)';
        root.style.setProperty('--phantom-type-color', accent);
        syncPortraitTypeDecorations(root);
    }

    function syncPortraitTypeDecorations(root) {
        const editorContext = window.PUBLISHED_CARD_SOURCE === 'custom' ||
            /\/editor\.html$/i.test(location.pathname);
        let rarity = editorContext ? window.currentRarity : window.__absViewerCard?.rarity;
        if (editorContext) {
            try { if (typeof currentRarity !== 'undefined') rarity = currentRarity; } catch {}
        }
        if (rarity === null || rarity === undefined || rarity === '') {
            rarity = window.getDisplayedCardRarity?.();
        }
        const normalized = String(rarity ?? '').trim().toUpperCase();
        root.dataset.phantomRarity = normalized === '5' || normalized === 'LR' ? 'lr'
            : normalized === '4' || normalized === 'TUR' || normalized === 'UR' ? 'tur'
                : 'other';
        const stage = getElement(root, 'abs-art-layers-container');
        stage?.querySelectorAll(':scope > .phantom-typing-markers').forEach(markers => markers.remove());
    }

    function syncClassification(root) {
        const classification = root.querySelector('[data-phantom-slot="classification"]');
        const classificationText = getElement(root, 'abs-art-header-text');
        const status = root.querySelector('[data-phantom-slot="classification-status"]');
        if (!classification || !status) return;
        const hasClassification = Boolean(classificationText?.textContent?.trim());
        classification.hidden = false;
        if (classificationText) classificationText.hidden = !hasClassification;
        status.hidden = hasClassification;
        classification.setAttribute('aria-label', hasClassification
            ? classificationText.textContent.trim()
            : 'Summon classification unavailable');
    }

    function imageHasSource(image) {
        const source = String(image?.currentSrc || image?.getAttribute?.('src') || '').trim();
        if (!source || image?.dataset?.failed === 'true') return false;
        if (/\/editor\.html(?:[?#]|$)|^about:blank$|card(?:%20|\s)art(?:%20|\s)template\.png/i.test(source)) return false;
        if (image?.complete && Number(image.naturalWidth) === 0) return false;
        return true;
    }

    function syncPortraitFallback(root) {
        const charArt = getElement(root, 'abs-art-char');
        const compositeArt = getElement(root, 'abs-art-img');
        const thumbnailArt = getElement(root, 'abs-thumb-img');
        const videoArt = getElement(root, 'abs-art-video');
        const isThumbnailFallback = charArt?.dataset?.phantomThumbnailFallback === 'true' &&
            charArt.getAttribute('src') === charArt.dataset.phantomThumbnailSource;
        const hasCharacter = !isThumbnailFallback && imageHasSource(charArt);
        const hasCompositeImage = imageHasSource(compositeArt);
        const hasThumbnail = imageHasSource(thumbnailArt);

        if (!hasCharacter && !hasCompositeImage && hasThumbnail && charArt) {
            if (!isThumbnailFallback) {
                charArt.dataset.phantomNativeCharacterSrc = charArt.getAttribute('src') || '';
                charArt.dataset.phantomNativeCharacterFailed = charArt.dataset.failed || '';
            }
            const thumbnailSource = thumbnailArt.currentSrc || thumbnailArt.getAttribute('src') || '';
            if (thumbnailSource && charArt.getAttribute('src') !== thumbnailSource) {
                charArt.dataset.phantomThumbnailFallback = 'true';
                charArt.dataset.phantomThumbnailSource = thumbnailSource;
                charArt.removeAttribute('data-failed');
                charArt.setAttribute('src', thumbnailSource);
            }
        } else if (isThumbnailFallback && charArt) {
            charArt.setAttribute('src', charArt.dataset.phantomNativeCharacterSrc || '');
            if (charArt.dataset.phantomNativeCharacterFailed) charArt.dataset.failed = charArt.dataset.phantomNativeCharacterFailed;
            else delete charArt.dataset.failed;
            delete charArt.dataset.phantomThumbnailFallback;
            delete charArt.dataset.phantomThumbnailSource;
            delete charArt.dataset.phantomNativeCharacterSrc;
            delete charArt.dataset.phantomNativeCharacterFailed;
        }

        const showingThumbnailFallback = charArt?.dataset?.phantomThumbnailFallback === 'true';
        const showingCharacter = imageHasSource(charArt);
        const hasVideo = Boolean(videoArt && (videoArt.currentSrc || videoArt.getAttribute('src') || videoArt.querySelector('source')?.getAttribute('src')));
        root.dataset.phantomCharacterArt = showingCharacter ? 'available' : 'unavailable';
        root.dataset.phantomArtSource = showingThumbnailFallback ? 'transparent-thumbnail'
            : hasCharacter ? 'transparent-character'
            : hasCompositeImage ? 'composite-image'
                : hasVideo ? 'video-only'
                    : 'unavailable';
        const sourceNote = root.querySelector('[data-phantom-slot="art-source-note"]');
        if (sourceNote) {
            const notes = {
                'composite-image': 'Composite card art fallback',
                'transparent-thumbnail': 'Character thumbnail fallback',
                'video-only': 'Static card art unavailable · use Animation to play',
                unavailable: 'Card art unavailable'
            };
            sourceNote.textContent = notes[root.dataset.phantomArtSource] || '';
            sourceNote.hidden = !sourceNote.textContent;
        }
    }

    function syncPhantomMotionPlayback(mode = 'static') {
        const root = getRoot();
        const isPhantom = document.body?.classList.contains('theme-phantom');
        const isStatic = mode !== 'animated';
        const activeRoot = window.getCardLayoutRoot?.();
        const mainArtVideo = document.getElementById('myOverlayVideo');
        const videos = Array.from(document.querySelectorAll('.abs-art-dock-wrapper video, .card-art-canvas video'));

        videos.forEach((video) => {
            if (!suppressedVideoAutoplay.has(video)) suppressedVideoAutoplay.set(video, video.hasAttribute('autoplay'));
            if (isPhantom) {
                video.removeAttribute('autoplay');
                if (!guardedVideos.has(video)) {
                    video.addEventListener('play', () => {
                        if (document.body?.classList.contains('theme-phantom') && root?.dataset?.phantomArtMode !== 'animated') {
                            video.pause();
                        }
                    });
                    guardedVideos.add(video);
                }
                if (isStatic) video.pause();
                return;
            }

            const isActivePresentationVideo = activeRoot?.contains(video) || video === mainArtVideo;
            if (!isActivePresentationVideo) return;
            if (suppressedVideoAutoplay.get(video)) video.setAttribute('autoplay', '');
            else video.removeAttribute('autoplay');
            suppressedVideoAutoplay.delete(video);
        });

        if (isPhantom && isStatic) {
            document.querySelectorAll('.abs-art-dock-wrapper .abs-art-bg-lwf-canvas, .abs-art-dock-wrapper .abs-sticker-canvas')
                .forEach((canvas) => {
                    canvas.style.display = 'none';
                    window.DokkanLWF?.pause?.(canvas.id || canvas.dataset.cardElement || '');
                });
        }
    }

    function syncCategoryPills(root) {
        const container = getElement(root, 'abs-category-container');
        if (!container) return;

        container.querySelectorAll('.abs-category-badge').forEach((badge) => {
            const name = badge.querySelector('.abs-category-name')?.textContent?.trim() || badge.dataset.category || '';
            if (name) badge.setAttribute('aria-label', name);
        });

        container.querySelectorAll('img').forEach((image) => {
            const display = window.resolveDokkanCategoryDisplay?.(image) || {};
            const name = String(display.name || image.alt || '').trim();
            if (!name) return;

            const entry = image.closest('a, button, .abs-category-entry, .editor-category-item, .col-4') || image.parentElement;
            if (!entry) return;
            entry.setAttribute('aria-label', name);
            const existingLabel = entry.querySelector('.abs-category-name, .category-name-fallback, .phantom-category-text-pill');
            if (existingLabel) {
                if (existingLabel.classList.contains('category-name-fallback') || existingLabel.classList.contains('phantom-category-text-pill')) {
                    if (existingLabel.textContent.trim() !== name) existingLabel.textContent = name;
                    existingLabel.setAttribute('aria-label', name);
                    existingLabel.dataset.category = name;
                }
                const badge = existingLabel.closest('.abs-category-badge');
                if (badge) badge.setAttribute('aria-label', name);
            } else {
                const pill = document.createElement('span');
                pill.className = 'phantom-category-text-pill';
                pill.textContent = name;
                pill.dataset.category = name;
                pill.setAttribute('aria-label', name);
                entry.appendChild(pill);
                if (entry.matches('a, button')) entry.setAttribute('aria-label', name);
            }
            image.setAttribute('aria-hidden', 'true');
        });
    }

    function observeArtModeControl(root) {
        if (modeClickRoot === root) return;
        root.addEventListener('click', (event) => {
            const awakeningButton = event.target?.closest?.('[data-card-element="abs-eza-toggle-bar"] .abs-stat-tab');
            if (awakeningButton && root.contains(awakeningButton)) closeBattleMotionPanel(artFocusController, false, true);
            const button = event.target?.closest?.('[data-card-element="art-toggle-static"], [data-card-element="art-toggle-animated"], #art-toggle-static, #art-toggle-animated');
            if (!button || !root.contains(button)) return;
            closeBattleMotionPanel(artFocusController, false);
            if (artFocusController?.root === root) resetArtFocusController(artFocusController, true);
            const isAnimated = button.dataset.cardElement === 'art-toggle-animated' || /art-toggle-animated$/.test(button.id);
            const mode = isAnimated ? 'animated' : 'static';
            root.dataset.phantomArtChoice = mode;
            root.dataset.phantomArtMode = mode;
            const switcher = window.switchEditorArtMode || window.switchCardArtMode;
            switcher?.(mode, { remember: false });
            syncPhantomMotionPlayback(mode);
            queueMicrotask(() => syncArtToggleState(root));
        }, true);
        modeClickRoot = root;
    }

    function syncArtToggleState(root) {
        const artBox = getElement(root, 'abs-art-layers-container');
        const mode = artBox ? (artBox.classList.contains('static-mode') ? 'static' : 'animated')
                : root?.dataset.phantomArtMode || 'animated';
        root?.querySelectorAll('[data-card-element="art-toggle-static"], [data-card-element="art-toggle-animated"], #art-toggle-static, #art-toggle-animated')
            .forEach(button => button.setAttribute('aria-pressed', String(
                (button.dataset.cardElement === 'art-toggle-animated' || /art-toggle-animated$/.test(button.id))
                    ? mode === 'animated' : mode === 'static')));
    }

    function syncArtControlVisibility(root) {
        const row = root?.querySelector('[data-phantom-slot="art-controls"]');
        const bar = getElement(root, 'abs-art-toggle-bar');
        if (!row) return;
        row.hidden = !row.querySelector('.phantom-battle-motion-button:not([hidden])') &&
            (!bar || bar.getAttribute('aria-hidden') === 'true' || getComputedStyle(bar).display === 'none');
        syncArtToggleState(root);
        const awakeningBar = getElement(root, 'abs-eza-toggle-bar');
        const siblings = window.__absViewerCard && typeof window.getCardSiblings === 'function'
            ? window.getCardSiblings(window.__absViewerCard) : null;
        if (awakeningBar && siblings) {
            const hasModes = siblings.hasEza || siblings.hasSeza;
            const display = hasModes ? 'block' : 'none';
            if (awakeningBar.style.display !== display) awakeningBar.style.display = display;
            const effectsState = window.__absCleanViewerEffectsState || {};
            const mode = effectsState.isSEZA ? 'seza' : effectsState.isEZA ? 'eza' : 'base';
            awakeningBar.querySelectorAll('.abs-stat-tab').forEach(button => {
                const key = button.dataset.cardElement || button.id;
                const buttonMode = /seza$/.test(key) ? 'seza' : /eza$/.test(key) ? 'eza' : 'base';
                const eligible = buttonMode === 'base' || (buttonMode === 'seza' ? siblings.hasSeza : siblings.hasEza);
                const buttonDisplay = eligible ? '' : 'none';
                if (button.style.display !== buttonDisplay) button.style.display = buttonDisplay;
                button.disabled = !eligible;
                button.classList.toggle('active', buttonMode === mode);
            });
        }
        awakeningBar?.querySelectorAll('.abs-stat-tab').forEach(button => {
            const key = button.dataset.cardElement || button.id;
            const label = /seza$/.test(key) ? 'Super EZA' : /eza$/.test(key) ? 'EZA' : 'Base';
            if (button.textContent !== label) button.textContent = label;
            const selected = button.classList.contains('active');
            if (button.getAttribute('aria-pressed') !== String(selected)) button.setAttribute('aria-pressed', String(selected));
        });
    }

    const phantomSvgNamespace = 'http://www.w3.org/2000/svg';
    const statCircleAnchor = { x: 180, y: 7 };
    const statCircleRadius = 35;
    const statCircleRestScale = 0.68;
    const statCircleHitRadius = 44;
    const statCircleSpecs = [
        { key: 'hp', label: 'HP', color: '#22c55e', x: 54, y: 97 },
        { key: 'atk', label: 'ATK', color: '#ef4444', x: 180, y: 97 },
        { key: 'def', label: 'DEF', color: '#3b82f6', x: 306, y: 97 }
    ];

    function svgElement(name, attributes = {}) {
        const element = document.createElementNS(phantomSvgNamespace, name);
        Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, String(value)));
        return element;
    }

    function statPotentialOptions(root) {
        const slider = getElement(root, 'abs-stat-range-slider');
        const wrapper = slider?.closest('.abs-stat-slider-wrapper');
        const options = [...(wrapper?.querySelectorAll('.abs-slider-ticks span') || [])]
            .map((tick, index) => ({ index, percent: Number.parseFloat(tick.textContent) }))
            .filter(option => Number.isFinite(option.percent) && option.percent >= 0 && option.percent <= 100);
        const selectedIndex = options.findIndex(option => option.index === Number(slider?.value));
        const selected = options[selectedIndex] || null;
        return { slider, wrapper, options, selectedIndex, selected };
    }

    function currentPotentialPercentage(root) {
        const state = statPotentialOptions(root);
        if (state.selected) return state.selected.percent;
        const label = getElement(root, 'abs-slider-percent-display')?.textContent || '';
        const parsed = Number.parseFloat(label);
        return Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) : 100;
    }

    function readRawStatValues(root) {
        return statCircleSpecs.map(spec => {
            const node = getElement(root, 'abs-stat-' + spec.key + '-val');
            const raw = String(node?.textContent || '').replace(/[\s,\u00a0\u202f]/g, '').trim();
            const value = Number(raw);
            return Number.isFinite(value) && value >= 0 ? value : null;
        });
    }

    function statCirclePreviewSourceKey(root) {
        const name = getElement(root, 'abs-char-name')?.textContent?.trim() || '';
        const potential = statPotentialOptions(root).selected?.percent ?? currentPotentialPercentage(root);
        const type = currentType(root).type;
        let awakening = '';
        try { awakening = selectedAwakeningMode(root); } catch { awakening = ''; }
        return [name, readRawStatValues(root).join(','), potential, type, awakening].join('|');
    }

    function calculateStatCirclePreviewValues(root) {
        const potential = statPotentialOptions(root);
        const full = potential.options.find(option => option.percent === 100);
        const mid = potential.options.find(option => option.percent === 55);
        const savedIndex = Number(potential.slider?.value);
        const setIndex = window.setStatSliderIndex;
        let fullValues = null;
        let midValues = null;
        if (typeof setIndex === 'function' && full && mid) {
            try {
                setIndex(full.index);
                fullValues = readRawStatValues(root);
                setIndex(mid.index);
                midValues = readRawStatValues(root);
            } catch {
                fullValues = null;
                midValues = null;
            } finally {
                if (Number.isFinite(savedIndex)) setIndex(savedIndex);
            }
        }
        if (!fullValues?.every(value => value !== null) || !midValues?.every(value => value !== null)) {
            try {
                fullValues = statCircleSpecs.map(spec => Number(calculatedStats?.[spec.key]?.['100%']));
                midValues = statCircleSpecs.map(spec => Number(calculatedStats?.[spec.key]?.['55%']));
            } catch {
                fullValues = readRawStatValues(root);
                midValues = readRawStatValues(root);
            }
        }
        return { full: fullValues, mid: midValues };
    }

    function updateStatCircleNodeValue(state, entry) {
        const mode = entry.node.dataset.cycleState || 'idle';
        const expanded = mode === 'full' || mode === 'mid';
        const selected = mode === 'mid' ? 'mid' : 'full';
        const index = state.nodes.indexOf(entry);
        const value = state.previewValues?.[selected]?.[index];
        const valueText = Number.isFinite(value) ? value.toLocaleString() : '—';
        const number = entry.node.querySelector('[data-stat-value]');
        const percent = entry.node.querySelector('[data-stat-percent]');
        const labelNode = entry.node.querySelector('[data-stat-label]');
        const label = entry.spec.label;
        if (labelNode) labelNode.setAttribute('y', expanded ? '-8' : '0');
        if (number) number.textContent = valueText;
        if (number) number.setAttribute('y', expanded ? '2' : '0');
        if (percent) {
            percent.textContent = selected === 'mid' ? '55%' : '100%';
            percent.setAttribute('y', expanded ? '12' : '0');
        }
        entry.node.setAttribute('aria-pressed', String(mode === 'full' || mode === 'mid'));
        const sharedMode = state.cycleState || 'idle';
        if (sharedMode === 'full') {
            entry.node.setAttribute('aria-label', `${label} at 100% Hidden Potential: ${valueText}. Activate any stat orb for 55%.`);
        } else if (sharedMode === 'mid') {
            entry.node.setAttribute('aria-label', `${label} at 55% Hidden Potential: ${valueText}. Activate any stat orb to close all previews.`);
        } else if (sharedMode === 'closed') {
            entry.node.setAttribute('aria-label', `${label} preview closed. Activate any stat orb to show all stats at 100%.`);
        } else {
            entry.node.setAttribute('aria-label', `${label} stat orb. Activate any stat orb to show all stats at 100%, then 55%, then close.`);
        }
    }

    function refreshStatCirclePreviewValues(state, root) {
        const sourceKey = statCirclePreviewSourceKey(root);
        state.previewValues = calculateStatCirclePreviewValues(root);
        state.previewSourceKey = sourceKey;
        state.nodes.forEach(entry => updateStatCircleNodeValue(state, entry));
    }

    function setStatCircleCycleState(state, _node, mode) {
        if (!state || !['idle', 'full', 'mid', 'closed'].includes(mode)) return;
        state.cycleState = mode;
        state.plot.dataset.sharedCycleState = mode;
        state.nodes.forEach(entry => {
            entry.node.dataset.cycleState = mode;
            updateStatCircleNodeValue(state, entry);
        });
        renderStatCircleMotion(state, performance.now(), state.reducedMotion);
    }

    function advanceStatCircleCycle(state) {
        const mode = state?.cycleState || 'idle';
        const next = mode === 'idle' || mode === 'closed' ? 'full'
            : mode === 'full' ? 'mid' : 'closed';
        setStatCircleCycleState(state, null, next);
    }

    function ensureStatsCircleChart(root) {
        const statsBox = getElement(root, 'abs-stats-box');
        const content = statsBox?.querySelector(':scope > .abs-content');
        if (!statsBox || !content) return null;
        statsBox.classList.add('phantom-stats-circles-widget');
        const potential = statPotentialOptions(root);
        potential.wrapper?.setAttribute('aria-hidden', 'true');
        potential.slider?.setAttribute('aria-hidden', 'true');
        potential.slider?.setAttribute('tabindex', '-1');
        content.querySelector(':scope > .phantom-stats-radar-chart')?.remove();
        let plot = content.querySelector(':scope > .phantom-stat-circles-chart');
        if (plot && plot._phantomCircleElements) return plot;
        plot?.remove();

        plot = document.createElement('div');
        plot.className = 'phantom-stat-circles-chart';
        plot.dataset.phantomStatCirclesChart = 'true';
        const svg = svgElement('svg', {
            viewBox: '0 0 360 136', role: 'group',
            'aria-label': 'HP, ATK, and DEF stat orbs. Activate any orb to show all stats at 100%, then 55%, then close.'
        });
        const defs = svgElement('defs');
        const connectors = svgElement('g', { class: 'phantom-stat-circle-connectors', 'aria-hidden': 'true' });
        const particles = svgElement('g', { class: 'phantom-stat-circle-particles', 'aria-hidden': 'true' });
        const nodes = svgElement('g', { class: 'phantom-stat-circle-nodes' });
        const connectorByStat = new Map();
        const gradientByStat = new Map();
        const particleByStat = new Map();
        const nodeByStat = new Map();
        statCircleSpecs.forEach(spec => {
            const gradientId = 'phantom-stat-circle-gradient-' + spec.key;
            const gradient = svgElement('linearGradient', {
                id: gradientId, gradientUnits: 'userSpaceOnUse',
                x1: statCircleAnchor.x, y1: statCircleAnchor.y,
                x2: statCircleAnchor.x, y2: statCircleAnchor.y
            });
            gradient.append(
                svgElement('stop', { offset: '0%', 'stop-color': spec.color, 'stop-opacity': 0.57 }),
                svgElement('stop', {
                    offset: '100%', 'stop-opacity': 0.57,
                    style: 'stop-color:var(--phantom-type-color, rgb(150, 155, 165))'
                })
            );
            defs.appendChild(gradient);
            const connector = svgElement('path', {
                class: 'phantom-stat-circle-connector',
                'data-stat-connector': spec.key,
                style: '--stat-color:' + spec.color + ';--phantom-connector-gradient:url(#' + gradientId + ')'
            });
            const particle = svgElement('circle', {
                class: 'phantom-stat-circle-particle',
                'data-stat-particle': spec.key,
                'data-direction': 'stat-to-portrait',
                r: 2.2
            });
            const node = svgElement('g', {
                class: 'phantom-stat-circle-node',
                'data-stat-node': spec.key,
                'data-cycle-state': 'idle',
                style: '--stat-color:' + spec.color,
                role: 'button', tabindex: 0, 'aria-pressed': 'false',
                'aria-label': spec.label + ' stat orb. Activate any orb to show all stats at 100%, then 55%, then close.'
            });
            const orb = svgElement('g', { class: 'phantom-stat-circle-content' });
            orb.append(
                svgElement('circle', { class: 'phantom-stat-circle-disc', r: statCircleRadius }),
                svgElement('text', {
                    class: 'phantom-stat-circle-label', x: 0, y: -14,
                    'text-anchor': 'middle', 'dominant-baseline': 'central',
                    'data-stat-label': spec.key, 'aria-hidden': 'true'
                }),
                svgElement('text', {
                    class: 'phantom-stat-circle-value', x: 0, y: 1,
                    'text-anchor': 'middle', 'dominant-baseline': 'central',
                    'data-stat-value': spec.key, 'aria-hidden': 'true'
                }),
                svgElement('text', {
                    class: 'phantom-stat-circle-percent', x: 0, y: 16,
                    'text-anchor': 'middle', 'dominant-baseline': 'central',
                    'data-stat-percent': spec.key, 'aria-hidden': 'true'
                })
            );
            node.append(
                svgElement('circle', { class: 'phantom-stat-circle-hit-area', r: statCircleHitRadius }),
                orb
            );
            connectorByStat.set(spec.key, connector);
            gradientByStat.set(spec.key, gradient);
            particleByStat.set(spec.key, particle);
            nodeByStat.set(spec.key, node);
            connectors.appendChild(connector);
            particles.appendChild(particle);
            nodes.appendChild(node);
        });
        svg.append(defs, connectors, particles, nodes);
        content.insertBefore(plot, content.firstChild);
        plot.appendChild(svg);
        plot._phantomCircleElements = { connectorByStat, gradientByStat, particleByStat, nodeByStat };
        return plot;
    }

    function connectorCurve(spec, offsetX = 0, offsetY = 0, start = statCircleAnchor, circleRadius = statCircleRadius) {
        const centerX = spec.x + offsetX;
        const centerY = spec.y + offsetY;
        const dx = start.x - centerX;
        const dy = start.y - centerY;
        const distance = Math.hypot(dx, dy) || 1;
        const end = {
            x: centerX + dx / distance * circleRadius,
            y: centerY + dy / distance * circleRadius
        };
        const first = { x: start.x + dx * 0.12, y: start.y - dy * 0.34 };
        const second = { x: end.x - dx * 0.05, y: end.y - 28 };
        const d = 'M ' + start.x.toFixed(2) + ' ' + start.y.toFixed(2) +
            ' C ' + first.x.toFixed(2) + ' ' + first.y.toFixed(2) + ', ' +
            second.x.toFixed(2) + ' ' + second.y.toFixed(2) + ', ' +
            end.x.toFixed(2) + ' ' + end.y.toFixed(2);
        return { d, start, first, second, end };
    }

    function svgClientPoint(svg, matrix, x, y) {
        const point = svg.createSVGPoint();
        point.x = x;
        point.y = y;
        return point.matrixTransform(matrix);
    }

    function portraitRingGeometry(root) {
        const stage = getElement(root, 'abs-art-layers-container');
        const artBox = getElement(root, 'abs-art-dock-wrapper')?.querySelector('.abs-art-box');
        if (!stage || !artBox) return null;

        const stageRect = stage.getBoundingClientRect();
        const stageScaleX = stageRect.width / (stage.offsetWidth || stageRect.width || 1);
        const stageScaleY = stageRect.height / (stage.offsetHeight || stageRect.height || 1);
        const stageStyle = getComputedStyle(stage);
        const ringStyle = getComputedStyle(artBox, '::before');
        const ringWidthToken = String(ringStyle.width || '0');
        let ringWidth = Number.parseFloat(ringWidthToken) || 0;
        if (ringWidthToken.trim().endsWith('%')) ringWidth = artBox.clientWidth * ringWidth / 100;
        const borderX = (Number.parseFloat(ringStyle.borderLeftWidth) || 0) +
            (Number.parseFloat(ringStyle.borderRightWidth) || 0);
        if (ringStyle.boxSizing !== 'border-box') ringWidth += borderX;
        const artRect = artBox.getBoundingClientRect();
        const artScaleX = artRect.width / (artBox.offsetWidth || artRect.width || 1);
        const radius = ringWidth * artScaleX / 2;
        if (!(radius > 0) || !(stageRect.width > 0) || !(stageRect.height > 0)) return null;

        const localRingX = String(stage.style.getPropertyValue('--phantom-ring-center-x') || '').trim();
        const localRingY = String(stage.style.getPropertyValue('--phantom-ring-center-y') || '').trim();
        const resolveLocal = (token, length) => {
            if (!token || token === 'auto') return null;
            const value = Number.parseFloat(token);
            if (!Number.isFinite(value)) return null;
            return token.endsWith('%') ? length * value / 100 : value;
        };
        let centerX = resolveLocal(localRingX, stage.offsetWidth);
        let centerY = resolveLocal(localRingY, stage.offsetHeight);
        if (centerX === null) centerX = (artRect.left + artRect.right) / 2;
        else centerX = stageRect.left + centerX * stageScaleX;
        if (centerY === null) centerY = artRect.bottom -
            (Number.parseFloat(ringStyle.bottom) || 14) * artScaleX - radius;
        else centerY = stageRect.top + centerY * stageScaleY;
        return { centerX, centerY, radius, stageRect };
    }

    function statCircleRingGeometry(state) {
        const matrix = state.svg?.getScreenCTM();
        if (!matrix) return null;
        const geometry = portraitRingGeometry(state.root);
        return geometry ? { ...geometry, matrix } : null;
    }

    function ringBoundaryForStat(state, spec, offsetX, offsetY, geometry) {
        if (!geometry) return statCircleAnchor;
        const screenCenter = svgClientPoint(state.svg, geometry.matrix, spec.x + offsetX, spec.y + offsetY);
        const dx = screenCenter.x - geometry.centerX;
        const dy = screenCenter.y - geometry.centerY;
        const distance = Math.hypot(dx, dy) || 1;
        const boundary = svgClientPoint(state.svg, geometry.matrix.inverse(),
            geometry.centerX + dx / distance * geometry.radius,
            geometry.centerY + dy / distance * geometry.radius);
        return { x: boundary.x, y: boundary.y };
    }

    function isStatCircleExpanded(state, entry) {
        const mode = state.cycleState || 'idle';
        return mode === 'full' || mode === 'mid';
    }

    function cubicPoint(curve, t) {
        const u = 1 - t;
        const a = u * u * u;
        const b = 3 * u * u * t;
        const c = 3 * u * t * t;
        const d = t * t * t;
        return {
            x: a * curve.start.x + b * curve.first.x + c * curve.second.x + d * curve.end.x,
            y: a * curve.start.y + b * curve.first.y + c * curve.second.y + d * curve.end.y
        };
    }

    function renderStatCircleMotion(state, timestamp, freeze = false) {
        const duration = 1840;
        const frameScale = state.lastTimestamp
            ? Math.min(2, Math.max(0.5, (timestamp - state.lastTimestamp) / 16.667))
            : 1;
        state.lastTimestamp = timestamp;
        const reduced = freeze || state.reducedMotion;
        const ringGeometry = statCircleRingGeometry(state);
        state.nodes.forEach((entry, index) => {
            let targetX = 0;
            let targetY = 0;
            if (!reduced && state.pointer) {
                const dx = entry.spec.x + entry.offsetX - state.pointer.x;
                const dy = entry.spec.y + entry.offsetY - state.pointer.y;
                const distance = Math.hypot(dx, dy);
                const range = 82;
                if (distance > 0 && distance < range) {
                    const strength = (1 - distance / range) ** 2;
                    targetX = dx / distance * 9 * strength;
                    targetY = dy / distance * 9 * strength;
                }
            }
            entry.velocityX = (entry.velocityX + (targetX - entry.offsetX) * 0.13 * frameScale) * 0.72;
            entry.velocityY = (entry.velocityY + (targetY - entry.offsetY) * 0.13 * frameScale) * 0.72;
            entry.offsetX = Math.max(-9, Math.min(9, entry.offsetX + entry.velocityX * frameScale));
            entry.offsetY = Math.max(-9, Math.min(9, entry.offsetY + entry.velocityY * frameScale));
            entry.node.setAttribute('transform',
                'translate(' + (entry.spec.x + entry.offsetX).toFixed(2) + ' ' +
                (entry.spec.y + entry.offsetY).toFixed(2) + ')');
            const start = ringBoundaryForStat(state, entry.spec, entry.offsetX, entry.offsetY, ringGeometry);
            const visualRadius = statCircleRadius * (isStatCircleExpanded(state, entry) ? 1 : statCircleRestScale);
            const curve = connectorCurve(entry.spec, entry.offsetX, entry.offsetY, start, visualRadius);
            entry.connector.setAttribute('d', curve.d);
            entry.gradient.setAttribute('x1', curve.end.x.toFixed(2));
            entry.gradient.setAttribute('y1', curve.end.y.toFixed(2));
            entry.gradient.setAttribute('x2', curve.start.x.toFixed(2));
            entry.gradient.setAttribute('y2', curve.start.y.toFixed(2));
            if (!reduced) {
                const progress = (timestamp / duration + index / state.nodes.length) % 1;
                const point = cubicPoint(curve, 1 - progress);
                entry.particle.setAttribute('cx', point.x.toFixed(2));
                entry.particle.setAttribute('cy', point.y.toFixed(2));
                entry.particle.dataset.progress = progress.toFixed(3);
            }
        });
        state.plot.dataset.motionState = reduced ? 'static' : 'running';
        state.plot.querySelectorAll('.phantom-stat-circle-particle').forEach(node => {
            node.setAttribute('visibility', reduced ? 'hidden' : 'visible');
        });
    }

    function stopStatCircleMotion(state, reset = false) {
        if (state.raf) cancelAnimationFrame(state.raf);
        state.raf = 0;
        if (reset) {
            state.pointer = null;
            state.nodes.forEach(entry => {
                entry.offsetX = 0;
                entry.offsetY = 0;
                entry.velocityX = 0;
                entry.velocityY = 0;
            });
            renderStatCircleMotion(state, performance.now(), true);
        } else {
            state.plot.dataset.motionState = document.hidden ? 'paused-hidden' : 'paused-offscreen';
        }
    }

    function resetStatCircleInteractions(state) {
        if (!state) return;
        setStatCircleCycleState(state, null, 'idle');
    }

    function refreshStatCircleRingGeometry(root) {
        const state = statCircleController;
        if (state?.root === root) renderStatCircleMotion(state, performance.now(), state.reducedMotion);
    }

    function syncStatCircleMotion(state = statCircleController) {
        if (!state) return;
        const shouldRun = state.inView && !state.reducedMotion && !document.hidden &&
            !state.plot.hidden && document.body?.classList.contains('theme-phantom') && getRoot() === state.root;
        if (!shouldRun) {
            if (state.reducedMotion) stopStatCircleMotion(state, true);
            else stopStatCircleMotion(state);
            return;
        }
        if (state.raf) return;
        state.lastTimestamp = 0;
        const frame = timestamp => {
            state.raf = 0;
            if (state !== statCircleController) return;
            const stillRunning = state.inView && !state.reducedMotion && !document.hidden &&
                !state.plot.hidden && document.body?.classList.contains('theme-phantom') && getRoot() === state.root;
            if (!stillRunning) {
                stopStatCircleMotion(state);
                return;
            }
            renderStatCircleMotion(state, timestamp);
            state.raf = requestAnimationFrame(frame);
        };
        state.raf = requestAnimationFrame(frame);
    }

    function destroyStatCircleController() {
        const state = statCircleController;
        if (!state) return;
        stopStatCircleMotion(state, true);
        state.intersectionObserver?.disconnect();
        state.resizeObserver?.disconnect();
        state.plot.removeEventListener('pointermove', state.onPointerMove);
        state.plot.removeEventListener('pointerleave', state.onPointerLeave);
        state.plot.removeEventListener('pointercancel', state.onPointerLeave);
        state.plot.removeEventListener('pointerdown', state.onValuePointerDown);
        state.plot.removeEventListener('pointerup', state.onValuePointerUp);
        state.plot.removeEventListener('pointercancel', state.onValuePointerCancel);
        state.plot.removeEventListener('click', state.onValueClick);
        state.plot.removeEventListener('keydown', state.onValueKeyDown);
        state.plot.removeEventListener('focusin', state.onValueFocusIn);
        state.plot.removeEventListener('focusout', state.onValueFocusOut);
        window.removeEventListener('resize', state.onGeometryResize);
        window.clearTimeout(state.touchClickTimer);
        resetStatCircleInteractions(state);
        state.root.removeAttribute('data-phantom-stat-values-visible');
        state.slider?.removeEventListener('input', state.onSliderInput);
        document.removeEventListener('visibilitychange', state.onVisibilityChange);
        if (typeof state.motionMedia?.removeEventListener === 'function') {
            state.motionMedia.removeEventListener('change', state.onMotionChange);
        } else {
            state.motionMedia?.removeListener?.(state.onMotionChange);
        }
        statCircleController = null;
    }

    function ensureStatCircleController(root, plot) {
        const svg = plot.querySelector('svg');
        const potential = statPotentialOptions(root);
        if (!svg || !plot._phantomCircleElements) return null;
        if (statCircleController?.root === root && statCircleController.plot === plot) {
            if (statCircleController.previewSourceKey !== statCirclePreviewSourceKey(root)) {
                refreshStatCirclePreviewValues(statCircleController, root);
            }
            return statCircleController;
        }
        destroyStatCircleController();
        const { connectorByStat, gradientByStat, particleByStat, nodeByStat } = plot._phantomCircleElements;
        const state = {
            root, plot, svg,
            portrait: root.querySelector('[data-phantom-slot="portrait"]'),
            slider: potential.slider, pointer: null, raf: 0, lastTimestamp: 0,
            inView: false, reducedMotion: Boolean(artFocusReducedMotionMedia?.matches),
            motionMedia: artFocusReducedMotionMedia,
            cycleState: 'idle',
            previewValues: null, previewSourceKey: '', touchStart: null, ignoreTouchClick: false, touchClickTimer: 0,
            nodes: statCircleSpecs.map(spec => ({
                spec,
                node: nodeByStat.get(spec.key),
                connector: connectorByStat.get(spec.key),
                gradient: gradientByStat.get(spec.key),
                particle: particleByStat.get(spec.key),
                offsetX: 0, offsetY: 0, velocityX: 0, velocityY: 0
            }))
        };
        state.onPointerMove = event => {
            if (!['mouse', 'pen'].includes(event.pointerType || 'mouse')) return;
            const matrix = svg.getScreenCTM();
            if (!matrix) return;
            if (state.reducedMotion) {
                renderStatCircleMotion(state, performance.now(), true);
                return;
            }
            const point = svg.createSVGPoint();
            point.x = event.clientX;
            point.y = event.clientY;
            const local = point.matrixTransform(matrix.inverse());
            state.pointer = { x: local.x, y: local.y };
            syncStatCircleMotion(state);
        };
        state.onPointerLeave = event => {
            if (event.pointerType === 'touch') return;
            state.pointer = null;
            if (state.reducedMotion) renderStatCircleMotion(state, performance.now(), true);
            else syncStatCircleMotion(state);
        };
        state.onValuePointerDown = event => {
            if (event.pointerType !== 'touch') return;
            const node = event.target?.closest?.('[data-stat-node]');
            state.touchStart = node ? { node, x: event.clientX, y: event.clientY } : null;
        };
        state.onValuePointerUp = event => {
            const start = state.touchStart;
            state.touchStart = null;
            if (event.pointerType !== 'touch' || !start || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 12) return;
            const node = event.target?.closest?.('[data-stat-node]');
            if (node === start.node) {
                advanceStatCircleCycle(state);
                state.ignoreTouchClick = true;
                window.clearTimeout(state.touchClickTimer);
                state.touchClickTimer = window.setTimeout(() => { state.ignoreTouchClick = false; }, 500);
            }
        };
        state.onValuePointerCancel = () => { state.touchStart = null; };
        state.onValueClick = event => {
            if (event.detail === 0) return;
            if (state.ignoreTouchClick) {
                state.ignoreTouchClick = false;
                window.clearTimeout(state.touchClickTimer);
                return;
            }
            const node = event.target?.closest?.('[data-stat-node]');
            if (node) advanceStatCircleCycle(state);
        };
        state.onValueKeyDown = event => {
            if (event.key === 'Escape') {
                const node = event.target?.closest?.('[data-stat-node]');
                if (node) setStatCircleCycleState(state, null, 'closed');
                return;
            }
            if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') return;
            const node = event.target?.closest?.('[data-stat-node]');
            if (!node) return;
            event.preventDefault();
            advanceStatCircleCycle(state);
        };
        state.onValueFocusIn = event => {
            const node = event.target?.closest?.('[data-stat-node]');
            if (node) {
                renderStatCircleMotion(state, performance.now(), state.reducedMotion);
            }
        };
        state.onValueFocusOut = event => {
            const node = event.target?.closest?.('[data-stat-node]');
            if (!node) return;
            window.requestAnimationFrame(() => {
                renderStatCircleMotion(state, performance.now(), state.reducedMotion);
            });
        };
        state.onGeometryResize = () => renderStatCircleMotion(state, performance.now(), state.reducedMotion);
        state.onSliderInput = () => syncStatCircles(root);
        state.onVisibilityChange = () => syncStatCircleMotion(state);
        state.onMotionChange = event => {
            state.reducedMotion = Boolean(event.matches);
            if (state.reducedMotion) stopStatCircleMotion(state, true);
            else syncStatCircleMotion(state);
        };
        plot.addEventListener('pointermove', state.onPointerMove, { passive: true });
        plot.addEventListener('pointerleave', state.onPointerLeave, { passive: true });
        plot.addEventListener('pointercancel', state.onPointerLeave, { passive: true });
        plot.addEventListener('pointerdown', state.onValuePointerDown, { passive: true });
        plot.addEventListener('pointerup', state.onValuePointerUp, { passive: true });
        plot.addEventListener('pointercancel', state.onValuePointerCancel, { passive: true });
        plot.addEventListener('click', state.onValueClick);
        plot.addEventListener('keydown', state.onValueKeyDown);
        plot.addEventListener('focusin', state.onValueFocusIn);
        plot.addEventListener('focusout', state.onValueFocusOut);
        window.addEventListener('resize', state.onGeometryResize, { passive: true });
        potential.slider?.addEventListener('input', state.onSliderInput);
        document.addEventListener('visibilitychange', state.onVisibilityChange);
        if (typeof state.motionMedia?.addEventListener === 'function') {
            state.motionMedia.addEventListener('change', state.onMotionChange);
        } else {
            state.motionMedia?.addListener?.(state.onMotionChange);
        }
        if (typeof IntersectionObserver === 'function') {
            state.intersectionObserver = new IntersectionObserver(entries => {
                const entry = entries.find(item => item.target === plot);
                if (!entry) return;
                state.inView = entry.isIntersecting && entry.intersectionRatio > 0;
                syncStatCircleMotion(state);
            }, { threshold: 0.01 });
            state.intersectionObserver.observe(plot);
        } else {
            state.inView = true;
        }
        if (typeof ResizeObserver === 'function') {
            state.resizeObserver = new ResizeObserver(state.onGeometryResize);
            [plot, svg, getElement(root, 'abs-art-layers-container'),
                getElement(root, 'abs-art-dock-wrapper')?.querySelector('.abs-art-box')]
                .filter(Boolean).forEach(node => state.resizeObserver.observe(node));
        }
        statCircleController = state;
        refreshStatCirclePreviewValues(state, root);
        renderStatCircleMotion(state, performance.now(), state.reducedMotion);
        return state;
    }

    function syncStatCircles(root) {
        const plot = ensureStatsCircleChart(root);
        const statsBox = getElement(root, 'abs-stats-box');
        const svg = plot?.querySelector('svg');
        if (!plot || !statsBox || !svg) return false;
        const values = readRawStatValues(root);
        const potential = statPotentialOptions(root);
        const percent = potential.selected?.percent ?? currentPotentialPercentage(root);
        const available = values.every(value => value !== null) && Math.max(...values) > 0 && potential.options.length > 0;
        plot.hidden = !available;
        if (!available && statCircleController?.root === root) {
            resetStatCircleInteractions(statCircleController);
            root.removeAttribute('data-phantom-stat-values-visible');
        }
        if (available) {
            statCircleSpecs.forEach((spec, index) => {
                const node = plot.querySelector('[data-stat-node="' + spec.key + '"]');
                const label = plot.querySelector('[data-stat-label="' + spec.key + '"]');
                if (node) node.setAttribute('transform', 'translate(' + spec.x + ' ' + spec.y + ')');
                if (label) label.textContent = spec.label;
            });
            svg.setAttribute('aria-label',
                'HP, ATK, and DEF stat orbs. Activate any orb to show all stats at 100%, then 55%, then close.');
            plot.dataset.sharedPotentialPercent = String(percent);
            ensureStatCircleController(root, plot);
        }
        syncStatCircleMotion(statCircleController);
        return available;
    }

    function selectedAwakeningMode(root) {
        const isPublishedCustom = window.PUBLISHED_CARD_SOURCE === 'custom';
        let currentMode = window.currentAwakeningMode;
        try {
            if (typeof currentAwakeningMode !== 'undefined') currentMode = currentAwakeningMode;
        } catch {
            currentMode = window.currentAwakeningMode;
        }
        const viewerMode = window.__absViewerMode;
        const mode = String(isPublishedCustom ? (currentMode || 'base') : (viewerMode || currentMode || 'base'))
            .trim().toLowerCase();
        if (mode === 'seza') return 'seza';
        if (mode === 'eza') return 'eza';
        return '';
    }

    function setAwakeningMotionPaused(root) {
        if (!root || !root.dataset.phantomAwakeningFx) return;
        const paused = document.hidden || !awakeningRootInView || Boolean(artFocusReducedMotionMedia?.matches);
        root.dataset.phantomAwakeningMotionPaused = String(paused);
    }

    function syncPortraitAwakeningFx(root) {
        if (!document.body?.classList.contains('theme-phantom') || !root) {
            awakeningObserver?.disconnect();
            awakeningObserver = null;
            observedAwakeningRoot = null;
            observedAwakeningTarget = null;
            awakeningRootInView = false;
            root?.removeAttribute('data-phantom-awakening-fx');
            root?.removeAttribute('data-phantom-awakening-motion-paused');
            return;
        }
        const mode = selectedAwakeningMode(root);
        if (!mode) {
            root.removeAttribute('data-phantom-awakening-fx');
            root.removeAttribute('data-phantom-awakening-motion-paused');
            awakeningObserver?.disconnect();
            awakeningObserver = null;
            observedAwakeningRoot = null;
            observedAwakeningTarget = null;
            awakeningRootInView = false;
            return;
        }
        root.dataset.phantomAwakeningFx = mode;
        if (mode === 'seza') {
            const artBox = getElement(root, 'abs-art-layers-container');
            if (artBox && !artBox.querySelector('.phantom-seza-rings')) {
                const rings = document.createElement('span');
                rings.className = 'phantom-seza-rings';
                rings.setAttribute('aria-hidden', 'true');
                artBox.prepend(rings);
            }
        }
        if (observedAwakeningRoot !== root) {
            awakeningObserver?.disconnect();
            awakeningObserver = null;
            observedAwakeningRoot = root;
            observedAwakeningTarget = getElement(root, 'abs-art-layers-container') ||
                root.querySelector('.phantom-hero-portrait');
            awakeningRootInView = false;
            if (typeof IntersectionObserver === 'function' && observedAwakeningTarget) {
                awakeningObserver = new IntersectionObserver(entries => {
                    const entry = entries.find(item => item.target === observedAwakeningTarget);
                    if (!entry) return;
                    awakeningRootInView = entry.isIntersecting && entry.intersectionRatio > 0;
                    setAwakeningMotionPaused(root);
                }, { threshold: 0.01 });
                awakeningObserver.observe(observedAwakeningTarget);
            } else {
                awakeningRootInView = true;
            }
        }
        setAwakeningMotionPaused(root);
    }

    function syncAwakeningMotion() {
        if (observedAwakeningRoot) setAwakeningMotionPaused(observedAwakeningRoot);
    }

    function hasVisibleTransparentCharacter(root) {
        if (!['transparent-character', 'transparent-thumbnail'].includes(root?.dataset?.phantomArtSource)) return false;
        const image = getElement(root, 'abs-art-char');
        if (!image?.complete || !image.naturalWidth) return false;
        const style = getComputedStyle(image);
        const rect = image.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0 &&
            rect.width > 0 && rect.height > 0;
    }

    function canFocusArt(root) {
        return document.body?.classList.contains('theme-phantom') &&
            (artFocusController?.root === root && artFocusController.active ||
                hasVisibleTransparentCharacter(root));
    }

    function restoreAttribute(element, name, value) {
        if (!element) return;
        if (value === null) element.removeAttribute(name);
        else element.setAttribute(name, value);
    }

    function maxTransitionTime(element) {
        const style = getComputedStyle(element);
        const durationValues = style.transitionDuration.split(',');
        const delayValues = style.transitionDelay.split(',');
        const timeMs = value => {
            const number = Number.parseFloat(value) || 0;
            return String(value).trim().endsWith('ms') ? number : number * 1000;
        };
        return Math.max(0, ...durationValues.map((duration, index) =>
            timeMs(duration) + timeMs(delayValues[index % delayValues.length] || '0s')));
    }

    function effectiveCssZoom(element) {
        let zoom = 1;
        for (let node = element; node; node = node.parentElement) {
            const value = Number.parseFloat(getComputedStyle(node).zoom);
            if (Number.isFinite(value) && value > 0) zoom *= value;
        }
        return zoom;
    }

    function updateArtFocusGeometry(state) {
        const header = state.root.querySelector('.abs-top-header.phantom-hero');
        const portraitRect = state.portrait.getBoundingClientRect();
        const headerRect = header?.getBoundingClientRect();
        if (!headerRect?.width || !portraitRect.width) return false;

        const viewportShiftX = headerRect.left + headerRect.width / 2 - (portraitRect.left + portraitRect.width / 2);
        const zoom = effectiveCssZoom(state.portrait);
        const shiftX = viewportShiftX / zoom;
        state.focusRegion = {
            left: Math.min(portraitRect.left, portraitRect.left + viewportShiftX) - 2,
            top: portraitRect.top - 2,
            right: Math.max(portraitRect.right, portraitRect.right + viewportShiftX) + 2,
            bottom: portraitRect.bottom + 2
        };
        state.portrait.style.setProperty('--phantom-art-focus-x', `${shiftX}px`);
        state.root.style.setProperty('--phantom-art-focus-x', `${shiftX}px`);
        return true;
    }

    function restoreArtFocusInert(state) {
        if (state.identity?.isConnected && state.hasInertSnapshot) {
            state.identity.inert = state.inertBeforeFocus;
        }
        state.hasInertSnapshot = false;
        state.root.style.removeProperty('--phantom-art-focus-x');
        state.root.removeAttribute('data-phantom-art-focus-restoring');
        state.restoreTimer = 0;
    }

    function setArtFocusActive(state, active, immediate = false) {
        if (active) {
            if (!canFocusArt(state.root)) return false;
            if (state.identity.contains(document.activeElement) && document.activeElement !== state.portrait) return false;
            closePartnerDetails();
            if (state.restoreTimer) window.clearTimeout(state.restoreTimer);
            state.restoreTimer = 0;
            state.root.removeAttribute('data-phantom-art-focus-restoring');
            if (!state.active) {
                if (!updateArtFocusGeometry(state)) return false;
                state.inertBeforeFocus = state.identity.inert;
                state.hasInertSnapshot = true;
                state.root.dataset.phantomArtFocus = 'true';
                state.active = true;
            }
            state.identity.inert = true;
            return true;
        }

        if (!state.active) {
            if (immediate) {
                if (state.restoreTimer) window.clearTimeout(state.restoreTimer);
                restoreArtFocusInert(state);
            }
            return false;
        }

        state.active = false;
        state.root.removeAttribute('data-phantom-art-focus');
        if (immediate) {
            restoreArtFocusInert(state);
            return true;
        }
        state.root.dataset.phantomArtFocusRestoring = 'true';
        const delay = artFocusReducedMotionMedia?.matches ? 0 : maxTransitionTime(state.identity) + 40;
        state.restoreTimer = window.setTimeout(() => restoreArtFocusInert(state), delay);
        return true;
    }

    function updateArtFocusState(state) {
        setArtFocusActive(state, state.pointerActive || state.keyboardActive);
    }

    function resetArtFocusController(state = artFocusController, immediate = true) {
        if (!state) return;
        if (state.pointerActive && state.pointerId !== null) state.suppressedPointerId = state.pointerId;
        state.pointerActive = false;
        state.keyboardActive = false;
        setArtFocusActive(state, false, immediate);
    }

    function syncBattleMotionPanel(state) {
        if (!state) return;
        const box = state.motionBox;
        const cardId = Number(window.__absViewerCard?.id || window.__absCurrentAnimationCardId || 0);
        if (state.motionPanelOpen && cardId && cardId !== state.motionCardId) {
            closeBattleMotionPanel(state, false, true);
            return;
        }
        const boxCardId = Number(box?.dataset.cardId || 0);
        const current = !boxCardId || !cardId || boxCardId === cardId;
        const available = box?.dataset.motionAvailable === 'true' && current;
        const loading = current && (box?.dataset.motionAvailable === 'loading' || box?.dataset.motionState === 'loading');
        const status = loading ? 'loading' : available ? 'ready'
            : !box || !window.updateViewerMotion || box.dataset.motionState === 'unavailable' ? 'unavailable' : 'idle';
        const button = state.motionButton;
        button.hidden = status === 'unavailable';
        button.dataset.motionState = status;
        button.setAttribute('aria-pressed', String(state.motionPanelOpen));
        button.setAttribute('aria-expanded', String(state.motionPanelOpen));
        button.setAttribute('aria-busy', String(state.motionPanelOpen && loading));
        const label = loading && state.motionPanelOpen ? 'Battle Motion · Loading'
            : status === 'unavailable' ? 'Battle Motion · Unavailable' : 'Battle Motion';
        if (button.textContent !== label) button.textContent = label;
        button.title = state.motionPanelOpen ? 'Close Battle Motion' : 'Open Battle Motion player';
        if (box) {
            box.hidden = !state.motionPanelOpen || !available;
            box.setAttribute('aria-hidden', state.motionPanelOpen && available ? 'false' : 'true');
        }
        state.motionPanel.dataset.motionState = status;
        state.motionPanel.setAttribute('aria-busy', String(state.motionPanelOpen && loading));
        const message = loading ? 'Loading battle motion…' : available ? ''
            : status === 'unavailable' ? 'Battle motion is unavailable for this card.' : 'Preparing battle motion…';
        if (state.motionStatus.textContent !== message) state.motionStatus.textContent = message;
        state.motionRetry.hidden = loading || available;
    }

    function closeBattleMotionPanel(state = artFocusController, returnFocus = false, immediate = false) {
        if (!state?.motionPanelOpen) return;
        state.motionPanelOpen = false;
        window.stopViewerMotion?.();
        syncBattleMotionPanel(state);
        state.motionPanel.dataset.closing = 'true';
        const finish = () => {
            state.motionCloseTimer = 0;
            if (state.motionPanel.open) state.motionPanel.close();
            delete state.motionPanel.dataset.closing;
            if (returnFocus && state.motionButton.isConnected &&
                document.body.classList.contains('theme-phantom')) state.motionButton.focus({ preventScroll: true });
        };
        if (state.motionCloseTimer) clearTimeout(state.motionCloseTimer);
        if (immediate || artFocusReducedMotionMedia?.matches) finish();
        else state.motionCloseTimer = window.setTimeout(finish, 160);
    }

    function toggleBattleMotionPanel(state) {
        if (!state) return;
        if (state.motionPanelOpen) {
            closeBattleMotionPanel(state, true);
            return;
        }
        resetArtFocusController(state, true);
        if (state.motionCloseTimer) clearTimeout(state.motionCloseTimer);
        state.motionCloseTimer = 0;
        delete state.motionPanel.dataset.closing;
        state.motionPanelOpen = true;
        state.motionCardId = Number(window.__absViewerCard?.id || window.__absCurrentAnimationCardId || 0);
        state.motionPanel.style.setProperty('--phantom-type-accent', getComputedStyle(state.root).getPropertyValue('--phantom-type-accent'));
        if (!state.motionPanel.open) state.motionPanel.showModal();
        state.motionClose.focus({ preventScroll: true });
        if (state.motionBox && window.updateViewerMotion && window.__absViewerCard) {
            window.updateViewerMotion(window.__absViewerCard);
        }
        syncBattleMotionPanel(state);
    }

    function restoreBattleMotionPanel(state) {
        if (!state) return;
        closeBattleMotionPanel(state, false, true);
        if (state.motionCloseTimer) clearTimeout(state.motionCloseTimer);
        if (state.onMotionAvailability) window.removeEventListener('abs-motion-availability', state.onMotionAvailability);
        if (state.onMotionCardReady) window.removeEventListener('abs-card-content-ready', state.onMotionCardReady);
        if (state.onMotionRouteChange) {
            window.removeEventListener('popstate', state.onMotionRouteChange);
            window.removeEventListener('hashchange', state.onMotionRouteChange);
        }
        if (state.motionBox) {
            state.motionBox.classList.remove('phantom-motion-player');
            if (state.motionBoxMarker?.parentNode) {
                state.motionBoxMarker.before(state.motionBox);
                state.motionBoxMarker.remove();
            } else if (state.motionBoxOriginalParent?.isConnected) {
                state.motionBoxOriginalParent.appendChild(state.motionBox);
            }
        }
        state.motionPanel?.remove();
        state.motionButton?.remove();
    }

    function syncArtFocusAvailability(state) {
        if (!state) return;
        const enabled = canFocusArt(state.root);
        if (!enabled) resetArtFocusController(state, true);
        if (enabled) {
            state.portrait.setAttribute('tabindex', '0');
            state.portrait.setAttribute('role', 'img');
            state.portrait.removeAttribute('aria-pressed');
            state.portrait.setAttribute('aria-label', 'Character portrait. Hover or focus to center the art. Press Escape to restore details.');
        } else {
            restoreAttribute(state.portrait, 'tabindex', state.originalTabIndex);
            restoreAttribute(state.portrait, 'role', state.originalRole);
            restoreAttribute(state.portrait, 'aria-label', state.originalAriaLabel);
            restoreAttribute(state.portrait, 'aria-pressed', state.originalAriaPressed);
        }
    }

    function installArtFocusController(root) {
        if (!document.body?.classList.contains('theme-phantom')) {
            destroyArtFocusController();
            return;
        }
        const portrait = root.querySelector('[data-phantom-slot="portrait"]');
        const artDock = getElement(root, 'abs-art-dock-wrapper');
        const identity = root.querySelector('[data-phantom-slot="identity"]');
        const artBox = getElement(root, 'abs-art-layers-container');
        if (!portrait || !artDock || !identity || !artBox) {
            destroyArtFocusController();
            return;
        }
        if (artFocusController?.root === root && artFocusController.portrait === portrait &&
            artFocusController.artDock === artDock && artFocusController.identity === identity) {
            syncArtFocusAvailability(artFocusController);
            syncBattleMotionPanel(artFocusController);
            return;
        }
        destroyArtFocusController();

        const state = {
            root, portrait, artDock, artBox, identity,
            originalTabIndex: portrait.getAttribute('tabindex'),
            originalRole: portrait.getAttribute('role'),
            originalAriaLabel: portrait.getAttribute('aria-label'),
            originalAriaPressed: portrait.getAttribute('aria-pressed'),
            inertBeforeFocus: identity.inert,
            hasInertSnapshot: false,
            active: false,
            pointerActive: false,
            keyboardActive: false,
            pointerId: null,
            suppressedPointerId: null,
            focusRegion: null,
            restoreTimer: 0,
            motionBox: document.getElementById('abs-motion-box'),
            motionPanelOpen: false,
            motionCloseTimer: 0,
            motionStatus: null,
            motionBoxMarker: null,
            motionBoxOriginalParent: null,
            motionCardId: Number(window.__absViewerCard?.id || window.__absCurrentAnimationCardId || 0)
        };

        state.motionPanel = document.createElement('dialog');
        state.motionPanel.id = 'phantom-battle-motion-panel';
        state.motionPanel.className = 'phantom-battle-motion-panel';
        state.motionPanel.setAttribute('aria-labelledby', 'phantom-battle-motion-title');
        state.motionPanel.innerHTML = '<header class="phantom-motion-panel-header"><h2 id="phantom-battle-motion-title">Battle Motion</h2><button type="button" class="phantom-motion-close" aria-label="Close Battle Motion">×</button></header><div class="phantom-motion-panel-stage"></div><footer class="phantom-motion-panel-footer"><span class="phantom-motion-panel-status" role="status" aria-live="polite"></span><button type="button" class="phantom-motion-retry">Retry</button></footer>';
        document.body.appendChild(state.motionPanel);
        state.motionStatus = state.motionPanel.querySelector('.phantom-motion-panel-status');
        state.motionClose = state.motionPanel.querySelector('.phantom-motion-close');
        state.motionRetry = state.motionPanel.querySelector('.phantom-motion-retry');
        state.motionClose.addEventListener('click', () => closeBattleMotionPanel(state, true));
        state.motionPanel.addEventListener('cancel', event => {
            event.preventDefault();
            closeBattleMotionPanel(state, true);
        });
        state.motionPanel.addEventListener('close', () => {
            if (state.motionPanelOpen) closeBattleMotionPanel(state, false, true);
        });
        state.motionPanel.addEventListener('pointerdown', event => {
            const rect = state.motionPanel.getBoundingClientRect();
            state.motionBackdropPressed = event.clientX < rect.left || event.clientX > rect.right ||
                event.clientY < rect.top || event.clientY > rect.bottom;
        });
        state.motionPanel.addEventListener('click', event => {
            const rect = state.motionPanel.getBoundingClientRect();
            const outside = event.clientX < rect.left || event.clientX > rect.right ||
                event.clientY < rect.top || event.clientY > rect.bottom;
            if (state.motionBackdropPressed && outside) closeBattleMotionPanel(state, true);
            state.motionBackdropPressed = false;
        });
        state.motionRetry.addEventListener('click', () => {
            if (state.motionBox && window.updateViewerMotion && window.__absViewerCard) {
                window.stopViewerMotion?.();
                window.updateViewerMotion(window.__absViewerCard);
            }
            syncBattleMotionPanel(state);
        });
        state.motionButton = document.createElement('button');
        state.motionButton.type = 'button';
        state.motionButton.className = 'abs-stat-tab phantom-battle-motion-button';
        state.motionButton.setAttribute('aria-controls', state.motionPanel.id);
        state.motionButton.setAttribute('aria-haspopup', 'dialog');
        state.motionButton.setAttribute('aria-pressed', 'false');
        state.motionButton.setAttribute('aria-expanded', 'false');
        state.motionButton.textContent = 'Battle Motion';
        state.motionButton.addEventListener('click', () => toggleBattleMotionPanel(state));
        root.querySelector('[data-phantom-slot="art-controls"]')?.append(state.motionButton);
        const staticButton = getElement(root, 'art-toggle-static');
        if (staticButton) staticButton.textContent = 'Card Art';
        const animationButton = getElement(root, 'art-toggle-animated');
        if (animationButton) {
            animationButton.textContent = 'Animation';
            animationButton.setAttribute('aria-label', 'Card Animation');
            animationButton.title = 'Show animated card artwork';
        }
        if (state.motionBox?.parentNode) {
            state.motionBoxOriginalParent = state.motionBox.parentNode;
            state.motionBoxMarker = document.createComment('phantom-motion-box-origin');
            state.motionBox.before(state.motionBoxMarker);
            state.motionPanel.querySelector('.phantom-motion-panel-stage').appendChild(state.motionBox);
            state.motionBox.classList.add('phantom-motion-player');
            state.motionBox.hidden = true;
            state.motionBox.setAttribute('aria-hidden', 'true');
        }
        state.onMotionAvailability = () => syncBattleMotionPanel(state);
        state.onMotionCardReady = () => {
            closeBattleMotionPanel(state, false, true);
            state.motionCardId = Number(window.__absViewerCard?.id || window.__absCurrentAnimationCardId || 0);
            syncBattleMotionPanel(state);
        };
        state.onMotionRouteChange = () => closeBattleMotionPanel(state, false, true);
        window.addEventListener('abs-motion-availability', state.onMotionAvailability);
        window.addEventListener('abs-card-content-ready', state.onMotionCardReady);
        window.addEventListener('popstate', state.onMotionRouteChange);
        window.addEventListener('hashchange', state.onMotionRouteChange);
        window.stopViewerMotion?.();

        state.onPointerEnter = event => {
            if (state.motionPanelOpen) return;
            if (!['mouse', 'pen'].includes(event.pointerType) || state.suppressedPointerId === event.pointerId ||
                !canFocusArt(root)) return;
            state.pointerId = event.pointerId;
            state.pointerActive = true;
            updateArtFocusState(state);
        };
        state.onPointerCancel = event => {
            if (!state.pointerActive || state.pointerId !== event.pointerId) return;
            state.pointerActive = false;
            state.suppressedPointerId = event.pointerId;
            updateArtFocusState(state);
        };
        state.onPointerMove = event => {
            if (state.motionPanelOpen) return;
            const circles = state.root.querySelector('.phantom-stat-circles-chart');
            const circlesRect = circles?.getBoundingClientRect();
            const overCircles = circlesRect && event.clientX >= circlesRect.left && event.clientX <= circlesRect.right &&
                event.clientY >= circlesRect.top && event.clientY <= circlesRect.bottom;
            if (overCircles && (state.active || state.restoreTimer || state.identity.inert)) {
                resetArtFocusController(state, true);
                return;
            }
            const region = state.focusRegion;
            if (!region || (state.pointerId !== event.pointerId && state.suppressedPointerId !== event.pointerId)) return;
            const inside = event.clientX >= region.left && event.clientX <= region.right &&
                event.clientY >= region.top && event.clientY <= region.bottom;
            if (state.suppressedPointerId === event.pointerId) {
                if (!inside) state.suppressedPointerId = null;
                return;
            }
            if (state.pointerActive && state.pointerId === event.pointerId && !inside) {
                state.pointerActive = false;
                updateArtFocusState(state);
            }
        };
        state.onFocusIn = event => {
            if (event.target !== portrait || !portrait.matches(':focus-visible') || !canFocusArt(root)) return;
            state.keyboardActive = true;
            updateArtFocusState(state);
        };
        state.onFocusOut = () => window.requestAnimationFrame(() => {
            if (!portrait.contains(document.activeElement)) {
                state.keyboardActive = false;
                updateArtFocusState(state);
            }
        });
        state.onKeyDown = event => {
            if (!state.active) return;
            if (event.key === 'Escape') {
                resetArtFocusController(state, false);
                return;
            }
            if (event.key === 'Tab' && state.keyboardActive) resetArtFocusController(state, true);
        };
        artDock.addEventListener('pointerenter', state.onPointerEnter);
        portrait.addEventListener('pointercancel', state.onPointerCancel);
        portrait.addEventListener('focusin', state.onFocusIn);
        portrait.addEventListener('focusout', state.onFocusOut);
        document.addEventListener('pointermove', state.onPointerMove, { passive: true });
        document.addEventListener('keydown', state.onKeyDown, true);
        artFocusController = state;
        syncArtFocusAvailability(state);
        syncBattleMotionPanel(state);
        syncArtControlVisibility(root);
    }

    function destroyArtFocusController() {
        const state = artFocusController;
        if (!state) return;
        resetArtFocusController(state, true);
        state.artDock.removeEventListener('pointerenter', state.onPointerEnter);
        state.portrait.removeEventListener('pointercancel', state.onPointerCancel);
        state.portrait.removeEventListener('focusin', state.onFocusIn);
        state.portrait.removeEventListener('focusout', state.onFocusOut);
        document.removeEventListener('pointermove', state.onPointerMove);
        document.removeEventListener('keydown', state.onKeyDown, true);
        state.portrait.style.removeProperty('--phantom-art-focus-x');
        restoreAttribute(state.portrait, 'tabindex', state.originalTabIndex);
        restoreAttribute(state.portrait, 'role', state.originalRole);
        restoreAttribute(state.portrait, 'aria-label', state.originalAriaLabel);
        restoreAttribute(state.portrait, 'aria-pressed', state.originalAriaPressed);
        restoreBattleMotionPanel(state);
        artFocusController = null;
    }

    function syncArtMode(root) {
        const theme = document.body?.classList.contains('theme-phantom') ? 'phantom'
            : document.body?.classList.contains('theme-abs-clean') ? 'abs-clean'
                : document.body?.classList.contains('theme-dokkaninfo') ? 'dokkaninfo'
                    : 'abs-style';
        const isPhantom = theme === 'phantom';
        const readPreference = () => window.currentEditorArtMode || window.getCardArtMode?.() || 'animated';
        const readThemeMode = (previousTheme, preference) => {
            if (previousTheme === 'abs-clean') {
                const cleanRoot = window.getCardLayoutRoot?.('abs-clean');
                const cleanCategory = window.getCardLayoutElement?.('abs-category-container', cleanRoot)?.closest('.abs-box');
                const cleanChoice = cleanCategory?.dataset?.absCleanArtMode;
                if (cleanChoice === 'static' || cleanChoice === 'animated') return cleanChoice;
            }
            return preference;
        };
        const switcher = window.switchEditorArtMode || window.switchCardArtMode;

        if (isPhantom) {
            if (!phantomModeSessionActive) {
                const preference = readPreference();
                root.dataset.phantomSavedArtPreference = preference;
                root.dataset.phantomSavedArtMode = readThemeMode(lastObservedTheme, preference);
            }
            const mode = root.dataset.phantomArtChoice === 'animated' ? 'animated' : 'static';
            switcher?.(mode, { remember: false });
            root.dataset.phantomArtMode = mode;
            phantomModeSessionActive = true;
            lastObservedTheme = theme;
            syncPhantomMotionPlayback(mode);
            syncArtToggleState(root);
            return;
        }

        if (phantomModeSessionActive) {
            const savedPreference = root.dataset.phantomSavedArtPreference === 'static' ? 'static' : 'animated';
            const storedThemeMode = root.dataset.phantomSavedArtMode;
            const savedMode = theme === 'abs-clean' && (storedThemeMode === 'static' || storedThemeMode === 'animated')
                ? storedThemeMode
                : savedPreference;
            switcher?.(savedMode, { remember: false });
            if (typeof window.currentEditorArtMode === 'string') window.currentEditorArtMode = savedPreference;
            window.setCardArtModePreference?.(savedPreference);
            delete root.dataset.phantomSavedArtMode;
            delete root.dataset.phantomSavedArtPreference;
            root.dataset.phantomArtMode = savedMode;
            delete root.dataset.phantomArtChoice;
            phantomModeSessionActive = false;
        }
        syncPhantomMotionPlayback(root.dataset.phantomArtMode || 'static');
        lastObservedTheme = theme;
    }

    function passiveSummaryMarkup(totals) {
        const metrics = [
            ['ATK', 'atk', true],
            ['DEF', 'def', true],
            ['DODGE', 'evasion', false],
            ['DMG RED', 'damageReduction', false],
            ['CRIT', 'critical', false]
        ];
        const statLabels = {
            atk: 'ATK',
            def: 'DEF',
            damageReduction: 'Damage reduction',
            evasion: 'Dodge',
            critical: 'Critical hit'
        };
        const targetLabels = {
            self: 'Self',
            allies: 'Allies',
            'allies-except-self': 'Allies (self excluded)',
            'allies-excluding-self': 'Allies (self excluded)',
            enemy: 'Enemy',
            enemies: 'Enemies',
            unknown: 'Target not identified'
        };
        const effects = Array.isArray(totals?.effects) ? totals.effects : [];
        const grid = document.createElement('div');
        grid.className = 'phantom-passive-summary-grid';
        metrics.forEach(([label, key, signed]) => {
            const parsedValue = Number(totals?.[key]);
            const value = Number.isFinite(parsedValue) ? parsedValue : 0;
            const statEffects = effects.filter(effect => effect?.stat === key &&
                (effect?.value === null || effect?.value === undefined ||
                    !Number.isFinite(Number(effect.value)) || Number(effect.value) !== 0));
            if (value === 0 && !statEffects.length) return;

        const describeNoScalar = (statEffects) => {
            if (statEffects.some(effect => effect?.target && effect.target !== 'self')) {
                const targets = [...new Set(statEffects.map(effect => effect?.target).filter(Boolean))];
                return targets.length === 1 ? (targetLabels[targets[0]] || 'Targeted') : 'Targeted';
            }
            if (statEffects.some(effect => effect?.condition || effect?.timing)) return 'Conditional';
            if (statEffects.some(effect => effect?.duration || effect?.stacking || effect?.cap)) return 'Variable';
            const chanceLabels = [...new Set(statEffects.map(effect => effect?.chanceLabel).filter(Boolean))];
            if (chanceLabels.length === 1) return chanceLabels[0];
            return statEffects.length > 1 ? 'Multiple' : 'See details';
        };
        const effectDetails = (effect) => {
            const stat = statLabels[effect?.stat] || String(effect?.stat || 'Effect');
            const numericValue = effect?.value;
            const sign = (effect?.stat === 'atk' || effect?.stat === 'def') && Number(numericValue) > 0 ? '+' : '';
            const amount = numericValue === null || numericValue === undefined
                ? 'rate not specified'
                : `${sign}${numericValue}%`;
            const parts = [`${stat}: ${amount}`];
            const target = effect?.target;
            if (target) parts.push(`Target: ${targetLabels[target] || target}`);
            const knownChanceStat = (effect?.stat === 'evasion' || effect?.stat === 'critical') &&
                effect?.probability !== null && effect?.probability !== undefined;
            const certainty = effect?.certainty === 'probabilistic' ? 'chance' : effect?.certainty;
            if (certainty && !(knownChanceStat && certainty === 'chance')) parts.push(`Certainty: ${certainty}`);
            if (effect?.condition) parts.push(`Condition: ${effect.condition}`);
            if (effect?.timing && effect.timing !== effect.condition) parts.push(`Timing: ${effect.timing}`);
            if (effect?.duration) parts.push(`Duration: ${effect.duration}`);
            if (effect?.stacking) parts.push(`Stacking: ${effect.stacking}`);
            if (effect?.cap) parts.push(`Cap: ${effect.cap}`);
            if (effect?.chanceLabel) {
                const rate = effect.probability === null || effect.probability === undefined
                    ? 'numeric rate unavailable'
                    : `${effect.probability}%${effect.probabilityBasis ? `, ${effect.probabilityBasis}` : ''}`;
                const knownChanceRate = (effect.stat === 'evasion' || effect.stat === 'critical') &&
                    effect.probability !== null && effect.probability !== undefined;
                if (!knownChanceRate) {
                    parts.push(`Chance: ${effect.chanceLabel} (${rate})`);
                }
            } else if (effect?.probability !== null && effect?.probability !== undefined) {
                parts.push(`Trigger probability: ${effect.probability}%${effect.probabilityBasis ? ` (${effect.probabilityBasis})` : ''}`);
            }
            if (effect?.sourceText) parts.push(`Passive text: ${effect.sourceText}`);
            return parts.join(' · ');
        };
            const item = document.createElement('div');
            item.className = 'phantom-passive-summary-item';
            item.dataset.stat = label.toLowerCase().replace(/\s+/g, '-');
            item.dataset.phantomEffectCount = String(statEffects.length);
            const displayValue = value;
            const unscalarized = statEffects.filter(effect => !effect?.includedInScalar);
            const knownUnscalarized = unscalarized.filter(effect => {
                const effectValue = Number(effect?.value);
                return effect?.value !== null && effect?.value !== undefined && Number.isFinite(effectValue);
            });
            const unknownUnscalarized = unscalarized.some(effect =>
                effect?.value === null || effect?.value === undefined || !Number.isFinite(Number(effect.value)));
            const formatEffectRate = effect => {
                const effectValue = Number(effect.value);
                const amount = `${signed && effectValue > 0 ? '+' : ''}${Math.round(effectValue)}%`;
                const triggerRate = effect.probability !== null && effect.probability !== undefined &&
                    key !== 'evasion' && key !== 'critical'
                    ? ` @ ${Math.round(Number(effect.probability))}%`
                    : '';
                return amount + triggerRate;
            };
            const hasUnscalarizedEffects = unscalarized.some(effect =>
                !effect?.target || effect.target === 'self' || effect.target === 'unknown');
            const separatedRates = knownUnscalarized.map(formatEffectRate);
            if (unknownUnscalarized) separatedRates.push('?');
            // ATK/DEF show the arithmetic sum of listed self bonuses, not a
            // battle multiplier. Preserve conditions and unknown values below.
            const listedSelfBonuses = knownUnscalarized.filter(effect => effect.target === 'self');
            const listedSum = displayValue + listedSelfBonuses.reduce((sum, effect) => sum + Number(effect.value), 0);
            const showListedSum = signed && listedSelfBonuses.length > 0;
            const amountText = showListedSum
                ? `${listedSum > 0 ? '+' : ''}${Math.round(listedSum)}%${unknownUnscalarized ? ' + ?' : ''}*`
                : displayValue !== 0
                ? `${signed && displayValue > 0 ? '+' : ''}${Math.round(displayValue)}%${hasUnscalarizedEffects ? '*' : ''}`
                : separatedRates.length
                    ? `${separatedRates.join(' · ')}*`
                    : describeNoScalar(statEffects);

            const name = document.createElement('span');
            name.textContent = label;
            const amount = document.createElement('strong');
            amount.textContent = amountText;
            item.append(name, amount);

            const accessibleDetails = statEffects.map(effectDetails).join('. ');
            if (showListedSum) {
                item.title = `Sum of listed self bonuses; conditions may not apply together. Not the final battle multiplier. ${accessibleDetails}`;
                item.dataset.phantomTotalBasis = 'listed-self-bonuses';
            }
            item.setAttribute('aria-label', accessibleDetails
                ? `${label} passive total ${amountText}. ${accessibleDetails}`
                : `${label} passive total ${amountText}`);
            grid.appendChild(item);
        });
        const visibleMetricCount = grid.childElementCount;
        if (visibleMetricCount) {
            const minItemWidth = visibleMetricCount === 4 ? 73 : visibleMetricCount < 5 ? 70 : 76;
            const gapWidth = visibleMetricCount === 4 ? 6 : 8;
            grid.style.setProperty('--phantom-passive-summary-count', String(visibleMetricCount));
            grid.style.setProperty('--phantom-passive-summary-item-min-width', `${minItemWidth}px`);
            grid.style.setProperty('--phantom-passive-summary-gap', `${gapWidth}px`);
            grid.style.setProperty('--phantom-passive-summary-min-width',
                `${visibleMetricCount * minItemWidth + (visibleMetricCount - 1) * gapWidth}px`);
        }
        return grid;
    }

    function syncPhantomPassiveSummary(rawText = null) {
        const root = getRoot();
        if (!root) return false;
        const summary = getElement(root, 'abs-passive-summary');
        if (!summary) return false;
        const facts = root.querySelector('[data-phantom-slot="facts"]');
        const summaryPanel = root.querySelector('[data-phantom-slot="passive-summary"]');

        const source = rawText === null || rawText === undefined
            ? String(window.getAbsCleanPassiveSource?.() || '')
            : String(rawText || '');
        const calculate = window.getAbsCleanPassiveTotals || globalThis.getAbsCleanPassiveTotals;
        let groups = null;
        if (source.trim() && typeof calculate === 'function') {
            try {
                groups = passiveSummaryMarkup(calculate(source));
            } catch (error) {
                groups = null;
            }
        }

        const chartHost = root.querySelector('[data-phantom-slot="stats-chart"]') ||
            ensureChild(root.querySelector('[data-phantom-slot="art-column"]'), 'phantom-stats-chart-host', 'stats-chart');
        const stats = getElement(root, 'abs-stats-box');
        if (stats && chartHost && stats.parentElement !== chartHost) chartHost.appendChild(stats);
        const hasCircles = syncStatCircles(root);
        if (chartHost) chartHost.hidden = !hasCircles;
        const children = [];
        if (groups?.children.length) children.push(groups);
        summary.replaceChildren(...children);
        const hasTotals = Boolean(groups?.children.length);
        const hasAbilityDocks = Boolean(summaryPanel?.querySelector('.abs-clean-ability-docks')?.children.length);
        summary.hidden = !hasTotals;
        if (summaryPanel) summaryPanel.hidden = !(hasTotals || hasAbilityDocks);
        summary.dataset.phantomSummaryState = hasTotals ? 'ready' : 'empty';
        return hasTotals;
    }

    function syncKiSignatures(root) {
        const attacks = getElement(root, 'abs-sa-container');
        attacks?.querySelectorAll(':scope > .abs-box').forEach(box => {
            const content = box.querySelector(':scope > .abs-content');
            let host = box.querySelector('.phantom-ki-signature');
            const signature = box.querySelector('.abs-damage-multiplier-box .abs-multiplier-ki-tag') ||
                host?.querySelector('.abs-multiplier-ki-tag');
            const kiOnlySection = box.querySelector('[data-phantom-ki-only]');
            if (!signature || !content) {
                host?.remove();
                kiOnlySection?.remove();
                return;
            }
            let section = box.querySelector('.abs-special-effects-section:not([data-phantom-ki-only])') || kiOnlySection;
            if (!section) {
                section = document.createElement('div');
                section.className = 'abs-special-effects-section';
                section.dataset.phantomKiOnly = 'true';
                const multiplier = content.querySelector(':scope > .abs-damage-multiplier-box');
                content.insertBefore(section, multiplier);
            }
            let title = section.querySelector('.abs-special-effects-title');
            if (!title) {
                title = document.createElement('div');
                title.className = 'abs-special-effects-title';
                title.textContent = 'SPECIAL EFFECTS';
                section.prepend(title);
            }
            if (!host) {
                host = document.createElement('div');
                host.className = 'phantom-ki-signature';
            }
            host.querySelectorAll('.phantom-ki-signature-label').forEach(label => label.remove());
            host.querySelectorAll('.abs-multiplier-ki-tag').forEach(previous => {
                if (previous !== signature) previous.remove();
            });
            if (signature.parentElement !== host) host.append(signature);
            if (host.parentElement !== title) title.append(host);
            box.querySelectorAll('.phantom-ki-signature').forEach(previous => {
                if (previous !== host) previous.remove();
            });
            if (kiOnlySection && kiOnlySection !== section) kiOnlySection.remove();
        });
    }

    function observeRoot(root) {
        if (observedRoot === root) return;
        closePartnerDetails();
        partnerBackdropObserver?.disconnect();
        partnerBackdropSequence += 1;
        partnerBackdropSelection = '';
        partnerBackdropCandidates = new Map();
        if (artFocusController?.root !== root) destroyArtFocusController();
        if (statCircleController?.root !== root) destroyStatCircleController();
        observer?.disconnect();
        observer = new MutationObserver((records) => {
            if (records.some(record => record.attributeName === 'src' &&
                [getElement(root, 'abs-art-char'), getElement(root, 'abs-art-img'), getElement(root, 'abs-art-video')].includes(record.target))) {
                closeBattleMotionPanel(artFocusController, false, true);
            }
            const attacks = getElement(root, 'abs-sa-container');
            if (attacks && records.some(record => record.target === attacks || attacks.contains(record.target))) {
                syncKiSignatures(root);
            }
            if (records.some((record) => record.target === document.body && record.attributeName === 'data-abs-clean-type')) {
                syncType(root);
            }
            const statValueNodes = ['abs-stat-hp-val', 'abs-stat-atk-val', 'abs-stat-def-val']
                .map(id => getElement(root, id)).filter(Boolean);
            if (records.some(record => statValueNodes.some(node => node === record.target || node.contains(record.target)))) {
                syncPortraitTypeDecorations(root);
                syncStatCircles(root);
                syncPortraitAwakeningFx(root);
            }
            const awakeningImage = getElement(root, 'abs-awakening-img');
            if (records.some(record => record.target === document.getElementById('main-rarity-icon'))) {
                syncPortraitTypeDecorations(root);
            }
            if (awakeningImage && records.some(record => record.target === awakeningImage &&
                ['src', 'alt', 'style'].includes(record.attributeName))) syncPortraitAwakeningFx(root);
            const artToggleBar = getElement(root, 'abs-art-toggle-bar');
            const awakeningToggleBar = getElement(root, 'abs-eza-toggle-bar');
            if (awakeningToggleBar && records.some(record => awakeningToggleBar.contains(record.target))) {
                syncArtControlVisibility(root);
            }
            if (artToggleBar && records.some(record => record.target === artToggleBar &&
                ['style', 'aria-hidden'].includes(record.attributeName))) {
                syncArtControlVisibility(root);
            }
            if (records.some((record) => record.target === getElement(root, 'abs-art-char'))) {
                if (artFocusController?.root === root) resetArtFocusController(artFocusController, true);
                syncPortraitFallback(root);
                schedulePortraitRing(root);
                if (artFocusController?.root === root) syncArtFocusAvailability(artFocusController);
            }
            if (records.some((record) => record.target === getElement(root, 'abs-art-img') || record.target === getElement(root, 'abs-art-video'))) {
                if (artFocusController?.root === root) resetArtFocusController(artFocusController, true);
                syncPortraitFallback(root);
                schedulePortraitRing(root);
                if (artFocusController?.root === root) syncArtFocusAvailability(artFocusController);
            }
            const categories = getElement(root, 'abs-category-container');
            if (categories && records.some((record) => record.target === categories || categories.contains(record.target))) {
                syncCategoryPills(root);
            }
            const classificationText = getElement(root, 'abs-art-header-text');
            if (classificationText && records.some((record) => record.target === classificationText || classificationText.contains(record.target))) {
                syncClassification(root);
            }
        });
        observer.observe(document.body, { attributes: true, attributeFilter: ['data-abs-clean-type'] });
        const categories = getElement(root, 'abs-category-container');
        if (categories) observer.observe(categories, { childList: true, subtree: true });
        const classificationText = getElement(root, 'abs-art-header-text');
        if (classificationText) observer.observe(classificationText, { childList: true, characterData: true, subtree: true });
        [getElement(root, 'abs-art-char'), getElement(root, 'abs-art-img'), getElement(root, 'abs-art-video'), getElement(root, 'abs-thumb-img')]
            .filter(Boolean)
            .forEach((art) => {
                observer.observe(art, { attributes: true, attributeFilter: ['src', 'style', 'data-failed'] });
                if (art.dataset.phantomStatusObserved === 'true') return;
                art.dataset.phantomStatusObserved = 'true';
                ['load', 'error', 'loadeddata'].forEach((eventName) => {
                    art.addEventListener(eventName, () => {
                        if (artFocusController?.root === root) resetArtFocusController(artFocusController, true);
                        syncPortraitFallback(root);
                        schedulePortraitRing(root);
                        if (artFocusController?.root === root) syncArtFocusAvailability(artFocusController);
                    });
                });
            });
        const artToggleBar = getElement(root, 'abs-art-toggle-bar');
        if (artToggleBar) observer.observe(artToggleBar, { attributes: true, attributeFilter: ['style', 'aria-hidden'] });
        const awakeningToggleBar = getElement(root, 'abs-eza-toggle-bar');
        if (awakeningToggleBar) observer.observe(awakeningToggleBar, {
            childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style']
        });
        ['abs-stat-hp-val', 'abs-stat-atk-val', 'abs-stat-def-val']
            .map(id => getElement(root, id)).filter(Boolean)
            .forEach(node => observer.observe(node, { childList: true, characterData: true, subtree: true }));
        const partnerResultsBox = getElement(root, 'abs-partners-box');
        const partnerResults = getElement(root, 'abs-partners-container');
        if (partnerResultsBox || partnerResults) {
            partnerBackdropObserver = new MutationObserver(() => syncPartnerBackdrop(root));
            if (partnerResultsBox) partnerBackdropObserver.observe(partnerResultsBox, {
                attributes: true, attributeFilter: ['hidden', 'style']
            });
            if (partnerResults) partnerBackdropObserver.observe(partnerResults, {
                childList: true, subtree: true
            });
        }
        const awakeningImage = getElement(root, 'abs-awakening-img');
        if (awakeningImage) observer.observe(awakeningImage, {
            attributes: true, attributeFilter: ['src', 'alt', 'style']
        });
        const awakeningsContainer = getElement(root, 'abs-awakenings-container');
        if (awakeningsContainer) observer.observe(awakeningsContainer, { childList: true, subtree: true });
        const rarityIcon = document.getElementById('main-rarity-icon');
        if (rarityIcon) observer.observe(rarityIcon, { attributes: true, attributeFilter: ['src'] });
        const attacks = getElement(root, 'abs-sa-container');
        if (attacks) observer.observe(attacks, { childList: true, subtree: true });
        observedRoot = root;
    }

    function refresh() {
        const root = getRoot();
        if (!root || !ensureStructure(root)) {
            destroyArtFocusController();
            destroyStatCircleController();
            closePartnerDetails();
            partnerBackdropObserver?.disconnect();
            partnerBackdropObserver = null;
            partnerBackdropSequence += 1;
            partnerBackdropSelection = '';
            partnerBackdropCandidates = new Map();
            syncPortraitAwakeningFx(null);
            return false;
        }
        observeRoot(root);
        observePortraitRingStage(root);
        observeArtModeControl(root);
        syncType(root);
        syncClassification(root);
        syncPortraitFallback(root);
        schedulePortraitRing(root);
        syncArtMode(root);
        syncArtControlVisibility(root);
        syncCategoryPills(root);
        syncKiSignatures(root);
        if (document.body?.classList.contains('theme-phantom')) {
            syncPhantomPassiveSummary();
            syncPartnerBackdrop(root);
            installArtFocusController(root);
        } else {
            closePartnerDetails();
            destroyArtFocusController();
            destroyStatCircleController();
        }
        syncPortraitAwakeningFx(root);
        return true;
    }

    function scheduleRefresh() {
        if (refreshFrame) cancelAnimationFrame(refreshFrame);
        refreshFrame = requestAnimationFrame(() => {
            refreshFrame = 0;
            refresh();
        });
    }

    function handlePresentationContextChange() {
        closeBattleMotionPanel(artFocusController, false, true);
        resetArtFocusController(artFocusController, true);
        scheduleRefresh();
    }

    function handleArtFocusEnvironmentChange() {
        resetArtFocusController(artFocusController, true);
        if (artFocusController) syncArtFocusAvailability(artFocusController);
        syncAwakeningMotion();
    }

    window.syncPhantomPassiveSummary = syncPhantomPassiveSummary;
    window.syncPhantomMotionPlayback = syncPhantomMotionPlayback;
    window.refreshPhantomPresentation = refresh;
    window.isPhantomBattleMotionOpen = () => Boolean(artFocusController?.motionPanelOpen);
    window.addEventListener('card-layout-root-change', handlePresentationContextChange);
    window.addEventListener('card-viewer-theme-change', handlePresentationContextChange);
    window.addEventListener('abs-card-content-ready', handlePresentationContextChange);
    window.addEventListener('abs-shell-layout-change', () => resetArtFocusController(artFocusController, true));
    window.addEventListener('resize', handleArtFocusEnvironmentChange);
    window.addEventListener('blur', () => resetArtFocusController(artFocusController, true));
    window.addEventListener('pagehide', () => {
        closeBattleMotionPanel(artFocusController, false, true);
        resetArtFocusController(artFocusController, true);
        if (observedAwakeningRoot) observedAwakeningRoot.dataset.phantomAwakeningMotionPaused = 'true';
    });
    window.addEventListener('pageshow', () => {
        syncPortraitAwakeningFx(getRoot());
        syncAwakeningMotion();
    });
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') resetArtFocusController(artFocusController, true);
        syncAwakeningMotion();
    });
    [artFocusNarrowMedia, artFocusReducedMotionMedia].filter(Boolean).forEach(media => {
        const handler = handleArtFocusEnvironmentChange;
        if (typeof media.addEventListener === 'function') media.addEventListener('change', handler);
        else media.addListener?.(handler);
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', refresh, { once: true });
    } else {
        refresh();
    }
})();
