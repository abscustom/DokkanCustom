/* ==========================================================================
   viewer-card-picker.js - Compact card switcher for the published Viewer tab
   ========================================================================== */

(() => {
    'use strict';

    const STORAGE_KEY = 'abs_viewer_selection';
    const MAX_RESULTS = 30;
    const PICKER_CLOSE_DURATION = 320;
    let cardScreenOrderCache = null;
    let initialized = false;
    let pickerIsOpen = false;
    let closeTimer = null;

    function readSelection() {
        try {
            const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
            return stored && stored.id ? stored : null;
        } catch (error) {
            return null;
        }
    }

    function persistSelection(id, mode) {
        if (id === undefined || id === null || id === '') return;
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                id: String(id),
                mode: mode || 'base'
            }));
        } catch (error) {
            // Storage can be unavailable in private browsing; the viewer still works.
        }
    }

    function cardId(card) {
        return String(card?.id ?? '');
    }

    function cardName(card) {
        return String(card?.name || card?.card_name || card?.title || `Card ${cardId(card)}`).trim();
    }

    function cardMode(card) {
        const id = cardId(card);
        if (card?.isSeza || id.length >= 8 && id.endsWith('9')) return 'seza';
        if (card?.isEza || id.length >= 8 && id.endsWith('8')) return 'eza';
        return 'base';
    }

    function cardModeLabel(card) {
        const mode = cardMode(card);
        return mode === 'seza' ? 'SEZA' : mode === 'eza' ? 'EZA' : 'BASE';
    }

    // Keep this parser in lockstep with the Cards screen's release parser.
    // In particular, the database's 2015-10-30 value is a valid chronological
    // value for the Cards screen and must not be treated as missing here.
    function parseCardReleaseTime(value) {
        if (typeof value === 'number' && Number.isFinite(value)) {
            return value > 0 && value < 100000000000 ? value * 1000 : value;
        }

        const dateStr = String(value || '').replace(/\u00a0/g, ' ').trim();
        if (!dateStr || /^tbd$/i.test(dateStr)) return 0;

        const dokkanMinEpoch = new Date('2015-01-30T00:00:00Z').getTime();
        const isUsable = time => Number.isFinite(time) && time >= dokkanMinEpoch;
        const nativeTime = Date.parse(dateStr);
        if (isUsable(nativeTime)) return nativeTime;

        const ymdMatch = dateStr.match(/\b(\d{4})[./-](\d{1,2})[./-](\d{1,2})\b/);
        if (ymdMatch) {
            const [, year, month, day] = ymdMatch;
            const time = Date.UTC(Number(year), Number(month) - 1, Number(day), 12);
            if (isUsable(time)) return time;
        }

        const mdyMatch = dateStr.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/);
        if (mdyMatch) {
            const [, month, day, year] = mdyMatch;
            const time = Date.UTC(Number(year), Number(month) - 1, Number(day), 12);
            if (isUsable(time)) return time;
        }

        return 0;
    }

    function compareCardScreenRecords(first, second) {
        if (first.isFuture && !second.isFuture) return 1;
        if (!first.isFuture && second.isFuture) return -1;
        if (second.sortTime !== first.sortTime) return second.sortTime - first.sortTime;

        if (second.parentId !== first.parentId) {
            if (second.parentId !== first.parentId) return second.parentId - first.parentId;
        }

        const firstId = first.card.id;
        const secondId = second.card.id;
        const firstIsTransformation = typeof firstId === 'number' && firstId >= 4000000;
        const secondIsTransformation = typeof secondId === 'number' && secondId >= 4000000;
        if (firstIsTransformation !== secondIsTransformation) return firstIsTransformation ? 1 : -1;

        const firstNumber = parseInt(firstId, 10) || 0;
        const secondNumber = parseInt(secondId, 10) || 0;
        if (firstNumber !== secondNumber) return firstNumber - secondNumber;

        return String(firstId).localeCompare(String(secondId), undefined, { numeric: true });
    }

    function buildCardScreenOrder() {
        const cards = Array.isArray(window.DB?.cards) ? window.DB.cards : [];
        if (cardScreenOrderCache?.source === cards) return cardScreenOrderCache.records;

        const rawById = new Map(cards.map(card => [parseInt(card?.id, 10), card]));
        const unawakenedSourceCardIds = new Set();
        const cardEzaRouteDates = new Map();
        const cardSezaRouteDates = new Map();
        const cardDokkanRouteDates = new Map();
        const routes = Array.isArray(window.DB?.awakeningRoutes) ? window.DB.awakeningRoutes : [];

        routes.forEach(route => {
            const sourceId = parseInt(route?.card_id, 10);
            const targetId = parseInt(route?.awaked_card_id, 10);
            const routeType = String(route?.type || '');
            const parsedTime = parseCardReleaseTime(route?.open_at || route?.start_at);

            if (sourceId && targetId && sourceId !== targetId && (routeType.includes('Dokkan') || routeType.includes('Zet'))) {
                unawakenedSourceCardIds.add(sourceId);
            }

            if (!parsedTime) return;
            const normalizedSource = sourceId > 10000000 ? Math.floor(sourceId / 10) : sourceId;
            const normalizedTarget = targetId > 10000000 ? Math.floor(targetId / 10) : targetId;
            const setRouteDate = (map, key) => map.set(key, Math.max(map.get(key) || 0, parsedTime));

            if (route?.optimal_awakening_type === 2) {
                setRouteDate(cardSezaRouteDates, normalizedSource);
                setRouteDate(cardSezaRouteDates, normalizedTarget);
            } else if (route?.optimal_awakening_type === 1 || routeType.includes('Optimal')) {
                setRouteDate(cardEzaRouteDates, normalizedSource);
                setRouteDate(cardEzaRouteDates, normalizedTarget);
            } else {
                setRouteDate(cardDokkanRouteDates, normalizedTarget);
            }
        });

        const ezaMap = new Map();
        const sezaMap = new Map();
        cards.forEach(card => {
            const id = parseInt(card?.id, 10);
            const idText = String(id);
            if (card?.is_seza || idText.length >= 8 && idText.endsWith('9')) {
                const parentId = card?.parent_id || Math.floor(id / 10);
                sezaMap.set(parentId, card);
                sezaMap.set(id, card);
                sezaMap.set(Math.floor(id / 10), card);
            } else if (card?.is_eza || idText.length >= 8 && idText.endsWith('8')) {
                const parentId = card?.parent_id || Math.floor(id / 10);
                ezaMap.set(parentId, card);
                ezaMap.set(id, card);
                ezaMap.set(Math.floor(id / 10), card);
            }
        });

        const hubCards = cards.filter(card => {
            const rawId = parseInt(card?.id, 10);
            if (!Number.isFinite(rawId)) return false;
            if (String(rawId).length >= 8) return false;
            if (rawId < 4000000 && unawakenedSourceCardIds.has(rawId)) return false;
            return true;
        });

        const nowPlus30Days = Date.now() + (30 * 24 * 60 * 60 * 1000);
        const records = hubCards.map(card => {
            const rawId = parseInt(card.id, 10);
            const parentId = Number(card.parent_id || (typeof getCardParentId === 'function' ? getCardParentId(rawId) : rawId)) || rawId;
            const ezaCard = ezaMap.get(parentId) || ezaMap.get(rawId) || ezaMap.get(rawId * 10 + 8);
            const sezaCard = sezaMap.get(parentId) || sezaMap.get(rawId) || sezaMap.get(rawId * 10 + 9);
            const baseTime = cardDokkanRouteDates.get(parentId) || cardDokkanRouteDates.get(rawId) || parseCardReleaseTime(card.open_at || card.start_at || card.release_date);
            const ezaTime = cardEzaRouteDates.get(parentId) || cardEzaRouteDates.get(rawId) || (ezaCard ? parseCardReleaseTime(ezaCard.open_at || ezaCard.start_at) : 0);
            const sezaTime = cardSezaRouteDates.get(parentId) || cardSezaRouteDates.get(rawId) || (sezaCard ? parseCardReleaseTime(sezaCard.open_at || sezaCard.start_at) : 0);
            const hasSeza = Boolean(sezaCard) || sezaTime > 0 || card.is_seza === true;
            const hasEza = Boolean(ezaCard) || ezaTime > 0 || hasSeza || card.is_eza === true;
            const isFuture = baseTime > nowPlus30Days || ezaTime > nowPlus30Days || sezaTime > nowPlus30Days;

            let sortTime = Math.max(
                baseTime < nowPlus30Days ? baseTime : 0,
                ezaTime < nowPlus30Days ? ezaTime : 0,
                sezaTime < nowPlus30Days ? sezaTime : 0
            );
            if (sortTime === 0 && !isFuture) sortTime = parentId;

            return {
                card,
                parentId,
                isFuture,
                sortTime,
                releaseTime: Math.max(baseTime, ezaTime, sezaTime),
                hasEza,
                hasSeza
            };
        }).sort(compareCardScreenRecords);

        cardScreenOrderCache = {
            source: cards,
            records,
            byCard: new Map(records.map(record => [record.card, record]))
        };
        return records;
    }

    function cardReleaseTime(card) {
        buildCardScreenOrder();
        const record = cardScreenOrderCache?.byCard.get(card);
        if (record) return record.releaseTime;
        return [card?.release_date, card?.open_at, card?.releaseDate, card?.start_at]
            .map(parseCardReleaseTime)
            .find(time => time > 0) || 0;
    }

    function cardReleaseLabel(card) {
        const time = cardReleaseTime(card);
        if (!time) return 'Release TBD';

        try {
            return new Intl.DateTimeFormat('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                timeZone: 'America/New_York'
            }).format(new Date(time));
        } catch (error) {
            return new Date(time).toISOString().slice(0, 10);
        }
    }

    function positionPickerArrow() {
        const picker = document.getElementById('viewer-card-picker');
        const viewerButton = document.getElementById('nav-btn-viewer');
        if (!picker || !viewerButton || picker.hidden) return;

        const pickerRect = picker.getBoundingClientRect();
        const buttonRect = viewerButton.getBoundingClientRect();
        const buttonCenter = buttonRect.left + (buttonRect.width / 2);
        const arrowLeft = Math.max(18, Math.min(pickerRect.width - 18, buttonCenter - pickerRect.left));
        picker.style.setProperty('--viewer-picker-arrow-left', `${arrowLeft}px`);
    }

    function cardTypeLabel(card) {
        try {
            if (typeof getCardClassAndType === 'function') {
                const type = getCardClassAndType(card?.element ?? card?.attribute ?? 0)?.cardType;
                if (type) return String(type).toUpperCase();
            }
        } catch (error) {}
        return 'CARD';
    }

    function cardRarityLabel(card) {
        try {
            if (typeof getCardExactRarity === 'function') {
                return String(getCardExactRarity(card) || 'SSR').toUpperCase();
            }
        } catch (error) {}
        return String(card?.rarity || 'SSR').toUpperCase();
    }

    function cardImageUrl(card) {
        try {
            if (typeof getViewerCircleAsset === 'function') {
                const asset = getViewerCircleAsset(card) || {};
                return {
                    primary: asset.circleUrl || asset.fallbackUrl || '',
                    fallback: asset.fallbackUrl || ''
                };
            }
            if (typeof resolveCardAssets === 'function') {
                const assets = resolveCardAssets(card) || {};
                return { primary: assets.thumbUrl || assets.artUrl || '', fallback: assets.artUrl || '' };
            }
        } catch (error) {}
        return { primary: '', fallback: '' };
    }

    function getCardPool() {
        return buildCardScreenOrder().map(record => record.card);
    }

    function matchesQuery(card, query) {
        if (!query) return true;
        const searchText = [
            cardName(card),
            cardId(card),
            card?.tag,
            card?.category,
            card?.element,
            card?.attribute
        ].filter(Boolean).join(' ').toLowerCase();
        return searchText.includes(query);
    }

    function createResultButton(card, currentId) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'viewer-card-picker-result';
        button.setAttribute('role', 'option');
        button.setAttribute('aria-selected', String(cardId(card) === currentId));
        button.title = `View ${cardName(card)}`;
        if (cardId(card) === currentId) button.classList.add('is-selected');

        const image = document.createElement('img');
        image.className = 'viewer-card-picker-result-art';
        image.alt = '';
        image.loading = 'lazy';
        image.decoding = 'async';
        const imageUrl = cardImageUrl(card);
        if (imageUrl.primary) image.src = imageUrl.primary;
        if (imageUrl.fallback && imageUrl.fallback !== imageUrl.primary) {
            image.addEventListener('error', () => {
                if (image.src !== imageUrl.fallback) image.src = imageUrl.fallback;
            }, { once: true });
        }

        const copy = document.createElement('span');
        copy.className = 'viewer-card-picker-result-copy';

        const name = document.createElement('span');
        name.className = 'viewer-card-picker-result-name';
        name.textContent = cardName(card);

        const release = document.createElement('span');
        release.className = 'viewer-card-picker-result-date';
        release.textContent = cardReleaseLabel(card);

        const meta = document.createElement('span');
        meta.className = 'viewer-card-picker-result-meta';
        meta.textContent = `${cardTypeLabel(card)} · ${cardRarityLabel(card)} · ${cardModeLabel(card)} · #${cardId(card)}`;

        copy.append(name, release, meta);
        button.append(image, copy);
        button.addEventListener('click', () => selectViewerCard(card));
        return button;
    }

    function renderViewerCardPicker(query = '') {
        const results = document.getElementById('viewer-card-picker-results');
        if (!results) return;

        const normalizedQuery = String(query || '').trim().toLowerCase();
        const selection = readSelection();
        const currentId = selection?.id || '';
        const matchingCards = getCardPool().filter(card => matchesQuery(card, normalizedQuery));

        results.replaceChildren();
        if (!matchingCards.length) {
            const empty = document.createElement('div');
            empty.className = 'viewer-card-picker-empty';
            empty.textContent = normalizedQuery ? 'No cards match that search.' : 'No cards are available yet.';
            results.append(empty);
            return;
        }

        const fragment = document.createDocumentFragment();
        matchingCards.slice(0, MAX_RESULTS).forEach(card => fragment.append(createResultButton(card, currentId)));
        results.append(fragment);
    }

    function selectViewerCard(card) {
        const id = cardId(card);
        if (!id) return;

        const mode = cardMode(card);
        persistSelection(id, mode);
        setPickerOpen(false);

        if (typeof window.selectCard === 'function') {
            window.selectCard(id, false, mode);
        } else if (typeof selectCard === 'function') {
            selectCard(id, false, mode);
        }
    }

    function setPickerOpen(open) {
        const picker = document.getElementById('viewer-card-picker');
        const button = document.getElementById('nav-btn-viewer');
        if (!picker) return;

        pickerIsOpen = Boolean(open);
        window.clearTimeout(closeTimer);

        if (pickerIsOpen) {
            picker.hidden = false;
            picker.setAttribute('aria-hidden', 'false');
            picker.classList.remove('is-closing');
            button?.setAttribute('aria-expanded', 'true');
            renderViewerCardPicker(document.getElementById('viewer-card-picker-input')?.value || '');
            window.requestAnimationFrame(() => {
                picker.classList.add('is-open');
                positionPickerArrow();
            });
            window.setTimeout(() => document.getElementById('viewer-card-picker-input')?.focus(), 0);
        } else {
            picker.classList.add('is-closing');
            picker.classList.remove('is-open');
            picker.setAttribute('aria-hidden', 'true');
            button?.setAttribute('aria-expanded', 'false');
            closeTimer = window.setTimeout(() => {
                if (!pickerIsOpen) picker.hidden = true;
            }, PICKER_CLOSE_DURATION + 24);
        }
    }

    function toggleViewerCardPicker() {
        setPickerOpen(!pickerIsOpen);
    }

    function initializeViewerCardPicker() {
        if (initialized) {
            renderViewerCardPicker(document.getElementById('viewer-card-picker-input')?.value || '');
            return;
        }

        const picker = document.getElementById('viewer-card-picker');
        const input = document.getElementById('viewer-card-picker-input');
        const close = document.getElementById('viewer-card-picker-close');
        if (!picker || !input) return;

        initialized = true;
        picker.hidden = true;
        input.addEventListener('input', () => renderViewerCardPicker(input.value));
        close?.addEventListener('click', () => setPickerOpen(false));

        document.addEventListener('keydown', event => {
            if (event.key === 'Escape' && pickerIsOpen) setPickerOpen(false);
        });

        document.addEventListener('pointerdown', event => {
            if (!pickerIsOpen) return;
            const target = event.target;
            const viewerButton = document.getElementById('nav-btn-viewer');
            if (picker.contains(target) || viewerButton?.contains(target)) return;
            setPickerOpen(false);
        });

        window.addEventListener('resize', () => {
            if (pickerIsOpen) positionPickerArrow();
        }, { passive: true });

        renderViewerCardPicker();
    }

    window.persistViewerSelection = persistSelection;
    window.renderViewerCardPicker = renderViewerCardPicker;
    window.initializeViewerCardPicker = initializeViewerCardPicker;
    window.toggleViewerCardPicker = toggleViewerCardPicker;
    window.closeViewerCardPicker = () => setPickerOpen(false);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeViewerCardPicker, { once: true });
    } else {
        initializeViewerCardPicker();
    }
})();
