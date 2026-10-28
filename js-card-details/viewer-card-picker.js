/* ==========================================================================
   viewer-card-picker.js - Compact card switcher for the published Viewer tab
   ========================================================================== */

(() => {
    'use strict';

    const STORAGE_KEY = 'abs_viewer_selection';
    const sharedAssetBase = new URL('../', document.currentScript?.src || new URL('js-card-details/viewer-card-picker.js', document.baseURI)).href;
    const MAX_RESULTS = 30;
    let cardScreenOrderCache = null;
    let initialized = false;
    let pickerIsOpen = false;
    let isLoadingCards = false;
    let cardsLoadPromise = null;
    let contentCards = [];
    let contentLoadPromise = null;

    function refreshContentCards() {
        if (!window.CardContent?.enabled() || contentLoadPromise) return contentLoadPromise;
        // Revalidate each opening so archived cards cannot return from legacy storage.
        contentCards = [];
        isLoadingCards = true;
        contentLoadPromise = window.CardContent.listCards().then(cards => {
            contentCards = cards.map(window.CardContent.toCatalogCard);
        }).catch(error => {
            contentCards = [];
            console.warn('[Viewer Card Picker] Card content unavailable:', error);
        }).finally(() => {
            contentLoadPromise = null;
            isLoadingCards = false;
            renderViewerCardPicker();
        });
        return contentLoadPromise;
    }

    async function ensureCardsAvailable() {
        if (Array.isArray(window.DB?.cards) && window.DB.cards.length > 0) return;
        if (cardsLoadPromise) return cardsLoadPromise;

        isLoadingCards = true;
        cardsLoadPromise = (async () => {
            try {
                if (typeof window.ensureDokkanDatabase === 'function') {
                    await window.ensureDokkanDatabase();
                } else if (typeof ensureDokkanDatabase === 'function') {
                    await ensureDokkanDatabase();
                } else {
                    const base = document.baseURI || window.location.href;
                    const res = await fetch(new URL('json/cards.json', base).href);
                    if (res.ok) {
                        const data = await res.json();
                        window.DB = window.DB || {};
                        window.DB.cards = Array.isArray(data) ? data : Object.values(data);
                    }
                }
            } catch (e) {
                console.warn('[Viewer Card Picker] Could not load cards database:', e);
            } finally {
                isLoadingCards = false;
                cardScreenOrderCache = null;
                if (pickerIsOpen) {
                    renderViewerCardPicker(document.getElementById('viewer-card-picker-input')?.value || '');
                }
            }
        })();
        return cardsLoadPromise;
    }

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
        return window.parseReleaseTimestamp?.(value, { zoneLess: 'utc' }) || 0;
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
            // The public English picker must not expose untranslated database rows.
            // Keep them in DB for form/skill resolution, outside the search pool.
            if (/[\u3040-\u30ff\u3400-\u9fff\uff66-\uff9f]/u.test(cardName(card))) return false;
            const rawId = parseInt(card?.id, 10);
            if (!Number.isFinite(rawId)) return false;
            if (String(rawId).length >= 8) return false;
            if (rawId < 4000000 && unawakenedSourceCardIds.has(rawId)) return false;
            return true;
        });

        const nowPlus30Days = Date.now() + (30 * 24 * 60 * 60 * 1000);
        const records = hubCards.map(card => {
            const rawId = parseInt(card.id, 10);
            const parentId = Number(card.parent_id || (typeof getCardParentId === 'function' ? getCardParentId(rawId) : (typeof window.getCardParentId === 'function' ? window.getCardParentId(rawId) : rawId))) || rawId;
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

    function cardTypeLabel(card) {
        if (card?.source === 'custom') return String(card.type || 'agl').toUpperCase();
        try {
            const fn = (typeof getCardClassAndType === 'function') ? getCardClassAndType : window.getCardClassAndType;
            if (typeof fn === 'function') {
                const type = fn(card?.element ?? card?.attribute ?? 0)?.cardType;
                if (type) return String(type).toUpperCase();
            }
        } catch (error) {}
        return 'CARD';
    }

    function cardRarityLabel(card) {
        if (card?.source === 'custom') return String(card.rarity || 'TUR').toUpperCase();
        try {
            const fn = (typeof getCardExactRarity === 'function') ? getCardExactRarity : window.getCardExactRarity;
            if (typeof fn === 'function') {
                return String(fn(card) || 'SSR').toUpperCase();
            }
        } catch (error) {}
        return String(card?.rarity || 'SSR').toUpperCase();
    }

    function cardImageUrl(card) {
        if (card?.source === 'custom') {
            const media = window.DokkanCustomCardMedia;
            return { primary: media?.resolveCustomMediaUrl(card.thumbUrl || card.thumbMain,card.cardUrl) || card.thumbUrl || card.thumbMain || '',
                fallback: media?.resolveCustomMediaUrl(card.thumbFallbacks?.[0],card.cardUrl) || card.thumbFallbacks?.[0] || '' };
        }
        let rawId = Number.parseInt(cardId(card), 10) || 0;
        if (rawId > 10000000) rawId = Math.floor(rawId / 10);
        const folderId = Math.floor(rawId / 10) * 10;

        const explicitCircle = [
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

        let circleUrl = '';
        if (explicitCircle) {
            circleUrl = String(explicitCircle).trim();
        } else if (card?.folder && folderId > 0) {
            const folder = String(card.folder).replace(/^\.\//, '').replace(/\/+$/, '');
            circleUrl = `./${folder}/card_${folderId}_circle.png`;
        } else if (folderId > 0) {
            circleUrl = `./assets/card-art/cards/${folderId}/card_${folderId}_circle.png`;
        }

        // Published editor resolvers may return the active authored portrait.
        // Official choices use their own explicit or canonical asset paths.
        const fallbackUrl = card?.thumb_url || card?.thumbnail_url || (card?.folder
            ? `./${String(card.folder).replace(/^\.\//,'').replace(/\/+$/,'')}/card_${folderId}_thumb.png`
            : `./assets/card-art/thumbnails/card_${folderId}_thumb/card_${folderId}_thumb.png`);
        const absolute = value => value ? new URL(value,sharedAssetBase).href : '';
        return { primary:absolute(circleUrl || fallbackUrl), fallback:absolute(fallbackUrl) };
    }

    function getCardPool() {
        if (window.CardContent?.enabled()) return [...contentCards, ...buildCardScreenOrder().map(record => record.card)];
        let custom = [];
        try {
            const cached = JSON.parse(localStorage.getItem('hub_cached_custom_only') || '[]');
            if (Array.isArray(cached)) custom = cached.map(card => window.DokkanCustomCardMedia?.normalizeCachedCustomCard(card) || card);
        } catch (error) {}
        return [...custom, ...buildCardScreenOrder().map(record => record.card)];
    }

    function createResultButton(card, currentId, bindSelection = true) {
        const image = cardImageUrl(card);
        const button = window.DokkanUnitPicker.portrait({name:cardName(card),type:cardTypeLabel(card).toLowerCase(),rarity:cardRarityLabel(card),image:image.primary,fallback:image.fallback,
            isEza:cardMode(card)==='eza',isSeza:cardMode(card)==='seza',isTransformed:card.isTransformed||card.is_transform,
            frame:'https://abscustom.github.io/assets/images/frame_' + cardTypeLabel(card).toLowerCase() + '.png',custom:card.source==='custom',onSelect:bindSelection?()=>selectViewerCard(card):null});
        button.setAttribute('aria-selected',String(cardId(card)===currentId));
        return button;
    }

    function viewerPickerConfig() {
        const selection = readSelection();
        return {
            id: 'viewer-card-picker',
            gridId: 'viewer-card-picker-results',
            title: 'Select Viewer Card',
            presentation: 'abs-viewer',
            origin: '#nav-btn-viewer',
            animationDuration: 240,
            animateClose: false,
            pageSize: MAX_RESULTS,
            items: getCardPool(),
            loading: isLoadingCards,
            getSearchText: card => [cardName(card),cardId(card),card?.tag,card?.category,card?.element,card?.attribute].filter(Boolean).join(' '),
            renderItem: card => createResultButton(card,selection?.id || '',false),
            isSelected: card => cardId(card)===selection?.id,
            onSelect: selectViewerCard,
            onCloseStart: () => {
                pickerIsOpen = false;
                document.getElementById('nav-btn-viewer')?.setAttribute('aria-expanded','false');
            },
            onClose: () => {
                document.body.classList.remove('viewer-picker-open');
            },
            mountControls(host,api) {
                let sourceChoice='all', extra=()=>true;
                const apply=()=>api.setFilter(card=>(sourceChoice==='all'||(sourceChoice==='custom'?card.source==='custom':card.source!=='custom'))&&extra(card));
                window.DokkanUnitPicker.mountCharacterFilters(host,{items:getCardPool(),typeOf:cardTypeLabel,onChange:predicate=>{extra=predicate;apply();}});
                const group = document.createElement('div');group.className='picker-source-tabs';
                [['all','All'],['official','Official'],['custom','Custom']].forEach(([source,label]) => {
                    const button = document.createElement('button');button.type='button';button.className='picker-source-tab';button.textContent=label;
                    button.classList.toggle('active',source==='all');button.setAttribute('aria-pressed',String(source==='all'));
                    button.addEventListener('click',()=>{
                        group.querySelectorAll('button').forEach(control=>{const selected=control===button;control.classList.toggle('active',selected);control.setAttribute('aria-pressed',String(selected));});
                        sourceChoice=source;apply();
                    });group.append(button);
                });host.append(group);
            },
            emptyMessage: 'No viewer cards match this search.'
        };
    }
    function renderViewerCardPicker(query = '') {
        if (!pickerIsOpen || !window.DokkanUnitPicker) return;
        document.querySelector('#viewer-card-picker [data-shared-character-filters]')?.updateItems?.(getCardPool());
        window.DokkanUnitPicker.update('viewer-card-picker', {
            items: getCardPool(), loading: isLoadingCards
        });
    }
    function selectViewerCard(card) {
        const id = cardId(card);
        if (!id) return;

        const mode = cardMode(card);
        persistSelection(id, mode);
        setPickerOpen(false);

        if (card.source === 'custom' && (card.cardUrl || card.url)) {
            window.location.href = new URL(card.cardUrl || card.url, document.baseURI).href;
            return;
        }
        if (typeof window.selectCard === 'function') {
            window.selectCard(id, false, mode);
        } else if (typeof selectCard === 'function') {
            selectCard(id, false, mode);
        } else {
            const baseUri = document.baseURI || window.location.href;
            if (card?.url) {
                window.location.href = new URL(card.url, baseUri).href;
                return;
            }
            const navViewer = document.getElementById('nav-btn-viewer');
            let viewerBase = 'card.html';
            if (navViewer && navViewer.getAttribute('data-viewer-url')) {
                viewerBase = navViewer.getAttribute('data-viewer-url');
            } else if (navViewer && navViewer.getAttribute('href')) {
                viewerBase = navViewer.getAttribute('href');
            }
            const [viewerPath] = viewerBase.split('?');
            const targetUrl = new URL(`${viewerPath}?viewer=1&id=${encodeURIComponent(id)}&mode=${encodeURIComponent(mode)}`, baseUri).href;
            window.location.href = targetUrl;
        }
    }

    function setPickerOpen(open) {
        const picker = document.getElementById('viewer-card-picker');
        if (!picker || !window.DokkanUnitPicker) return;
        if (!open) { window.DokkanUnitPicker.close('viewer-card-picker'); return; }
        picker.classList.remove('viewer-card-picker','is-open','is-closing');
        pickerIsOpen = true;
        document.body.classList.add('viewer-picker-open');
        document.getElementById('nav-btn-viewer')?.setAttribute('aria-expanded','true');
        refreshContentCards();
        if (!Array.isArray(window.DB?.cards) || !window.DB.cards.length) ensureCardsAvailable();
        window.DokkanUnitPicker.open(viewerPickerConfig());
    }
    function toggleViewerCardPicker() { setPickerOpen(!pickerIsOpen); }
    function initializeViewerCardPicker() {
        if (initialized) { renderViewerCardPicker(); return; }
        const picker = document.getElementById('viewer-card-picker');
        if (!picker) return;
        initialized = true;
        picker.hidden = true;
        // The selected viewer URL/storage is validated by the page workflow;
        // NAV may call the public entry method after restoration completes.
    }
    window.openViewerCardPickerOnEntry = ({key='viewer-entry', hasValidSelection=false}={}) => {
        const picker = document.getElementById('viewer-card-picker');
        if (!picker || !window.DokkanUnitPicker) return false;
        picker.classList.remove('viewer-card-picker','is-open','is-closing');
        if (!hasValidSelection) refreshContentCards();
        if (!hasValidSelection && (!Array.isArray(window.DB?.cards) || !window.DB.cards.length)) ensureCardsAvailable();
        const opened = window.DokkanUnitPicker.openOnEntry(viewerPickerConfig(),{key,hasValidSelection});
        if(opened){pickerIsOpen=true;document.body.classList.add('viewer-picker-open');document.getElementById('nav-btn-viewer')?.setAttribute('aria-expanded','true');}
        return opened;
    };
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
