(() => {
    'use strict';

    const DATASET_PATH = 'json/support_memories.json';
    const LWF_RUNTIME_PATH = 'js-graphics/lwf.js';
    const PLAYER_SCRIPT_PATH = 'js-card-details/card-animation-player.js?v=20260928-eza-animation-assets-v1';
    const FENGARI_SCRIPT_PATH = 'vendor/fengari-web.min.js';
    const PLAYER_STYLESHEET_PATH = 'css/card-animation-player.css?v=20260918-ko-white-v1';
    const MANIFEST_ROOT = 'https://raw.githubusercontent.com/abscustom/DokkanCustom-animation-index/main/api/animation/';
    const FILM_ORDER = ['Blue', 'Green', 'Red', 'Yellow', 'Orange'];
    const FILM_COLORS = {
        red: '#f15b5b',
        yellow: '#f5d452',
        blue: '#5aa9e8',
        orange: '#ed974a',
        green: '#61bd73'
    };

    const elements = {
        page: document.getElementById('support-memory-page'),
        library: document.getElementById('sm-library'),
        search: document.getElementById('sm-search'),
        filmFilter: document.getElementById('sm-film-filter'),
        libraryStatus: document.getElementById('sm-library-status'),
        memoryGrid: document.getElementById('sm-memory-grid'),
        detailsTemplate: document.getElementById('sm-player-details-template')
    };

    if (Object.values(elements).some((element) => !element)) {
        console.error('[Support Memory] The library page is missing required presentation hooks.');
        return;
    }

    const state = {
        memories: [],
        selectedMemory: null,
        selectedLevelId: '',
        searchText: '',
        filmFilter: 'all',
        statusNote: '',
        playerLoad: null,
        playerObserver: null,
        playerToken: 0,
        playerClosePromise: Promise.resolve(),
        playerClosing: false,
        returnFocus: null,
        dialogWasOpen: false,
        activeTooltipCard: null
    };

    function isObject(value) {
        return value !== null && typeof value === 'object' && !Array.isArray(value);
    }

    function cleanOptionalText(value) {
        return typeof value === 'string' && value.trim() ? value : null;
    }

    function normalizeAssets(value) {
        const assets = isObject(value) ? value : {};
        return {
            filmIcon: cleanOptionalText(assets.filmIcon),
            large: cleanOptionalText(assets.large),
            thumb: cleanOptionalText(assets.thumb)
        };
    }

    function isSupportedManifest(key, value) {
        if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(key) || typeof value !== 'string') return false;
        try {
            const url = new URL(value);
            const expectedPath = `/abscustom/DokkanCustom-animation-index/main/api/animation/${encodeURIComponent(key)}.json`;
            return url.protocol === 'https:'
                && url.hostname === 'raw.githubusercontent.com'
                && url.pathname === expectedPath
                && !url.search
                && !url.hash;
        } catch {
            return false;
        }
    }

    function normalizeUpgradeLevel(level) {
        if (!isObject(level) || typeof level.id !== 'string' || !level.id.trim()) return null;
        const levelNumber = Number(level.level);
        if (!Number.isFinite(levelNumber) || levelNumber < 1) return null;
        return {
            id: level.id.trim(),
            level: levelNumber,
            effect: typeof level.effect === 'string' ? level.effect : '',
            durationText: cleanOptionalText(level.durationText),
            activationCondition: cleanOptionalText(level.activationCondition),
            assets: normalizeAssets(level.assets)
        };
    }

    function normalizeMemory(memory) {
        if (!isObject(memory) || typeof memory.id !== 'string' || !memory.id.trim()) return null;
        if (typeof memory.name !== 'string' || !memory.name.trim()) return null;
        if (!isObject(memory.animation)) return null;

        const id = memory.id.trim();
        const name = memory.name.trim();
        const key = typeof memory.animation.key === 'string' ? memory.animation.key.trim() : '';
        if (!isSupportedManifest(key, memory.animation.manifestUrl)) return null;
        if (memory.upgradeLevels !== undefined && memory.upgradeLevels !== null && !Array.isArray(memory.upgradeLevels)) return null;

        const levels = [];
        let skippedLevels = 0;
        const levelIds = new Set([id]);
        (memory.upgradeLevels || []).forEach((sourceLevel) => {
            const level = normalizeUpgradeLevel(sourceLevel);
            if (!level || levelIds.has(level.id)) {
                skippedLevels += 1;
                return;
            }
            levelIds.add(level.id);
            levels.push(level);
        });
        levels.sort((first, second) => first.level - second.level || first.id.localeCompare(second.id));

        const filmCost = memory.filmCost === null || memory.filmCost === undefined || memory.filmCost === ''
            ? null
            : Number(memory.filmCost);

        return {
            id,
            name,
            effect: typeof memory.effect === 'string' ? memory.effect : '',
            durationText: cleanOptionalText(memory.durationText),
            activationCondition: cleanOptionalText(memory.activationCondition),
            filmType: cleanOptionalText(memory.filmType),
            filmCost: Number.isFinite(filmCost) ? filmCost : null,
            assets: normalizeAssets(memory.assets),
            animation: { key, manifestUrl: memory.animation.manifestUrl },
            upgradeLevels: levels,
            skippedLevels
        };
    }

    function resolveAssetUrl(value) {
        if (typeof value !== 'string' || !value.trim()) return null;
        const path = value.trim();
        try {
            if (/^https?:\/\//i.test(path)) {
                const url = new URL(path);
                return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
            }
            const cleanPath = path.replace(/^\/+/, '');
            if (!cleanPath.startsWith('assets/item/')) return null;
            return new URL(`/${cleanPath}`, window.location.origin).href;
        } catch {
            return null;
        }
    }

    function safeEffectText(value) {
        const decoder = document.createElement('textarea');
        decoder.innerHTML = String(value || '');
        return decoder.value;
    }

    function setLibraryStatus(message, kind = 'info') {
        elements.libraryStatus.textContent = message;
        elements.libraryStatus.dataset.state = kind;
    }

    function makeArtworkPlaceholder(message, className = 'sm-artwork-placeholder', id = '') {
        const placeholder = document.createElement('span');
        placeholder.className = className;
        if (id) placeholder.id = id;
        placeholder.textContent = message;
        return placeholder;
    }

    function renderImage(container, path, {
        alt = '',
        className = '',
        imageId = '',
        placeholderId = '',
        missingPathMessage = 'Artwork path is not present in the dataset.',
        unavailableMessage = 'Artwork file is unavailable.'
    } = {}) {
        container.replaceChildren();
        const url = resolveAssetUrl(path);
        if (!url) {
            container.dataset.assetState = 'missing-metadata';
            container.appendChild(makeArtworkPlaceholder(missingPathMessage, 'sm-artwork-placeholder', placeholderId));
            return;
        }

        container.dataset.assetState = 'loading';
        const image = document.createElement('img');
        image.className = className;
        if (imageId) image.id = imageId;
        image.alt = alt;
        image.loading = 'lazy';
        image.decoding = 'async';
        image.addEventListener('load', () => {
            container.dataset.assetState = 'loaded';
        }, { once: true });
        image.addEventListener('error', () => {
            container.dataset.assetState = 'unavailable';
            image.remove();
            container.appendChild(makeArtworkPlaceholder(unavailableMessage, 'sm-artwork-placeholder', placeholderId));
        }, { once: true });
        image.src = url;
        container.appendChild(image);
    }

    function createMemoryUrl(memoryId, levelId = '') {
        const url = new URL(window.location.href);
        url.searchParams.set('id', memoryId);
        if (levelId) url.searchParams.set('level', levelId);
        else url.searchParams.delete('level');
        return url.href;
    }

    function hideActiveTooltip() {
        const active = state.activeTooltipCard;
        if (!active) return;
        active.tooltip.dataset.visible = 'false';
        active.tooltip.style.left = '';
        active.tooltip.style.top = '';
        active.tooltip.style.width = '';
        active.tooltip.style.maxHeight = '';
        active.tooltip.style.visibility = '';
        active.card.appendChild(active.tooltip);
        state.activeTooltipCard = null;
    }

    function positionActiveTooltip() {
        const active = state.activeTooltipCard;
        if (!active || !active.card.isConnected) {
            hideActiveTooltip();
            return;
        }

        const margin = 12;
        const cardBounds = active.card.getBoundingClientRect();
        active.tooltip.style.maxHeight = `${Math.max(96, window.innerHeight - margin * 2)}px`;
        const tooltipBounds = active.tooltip.getBoundingClientRect();
        const left = Math.max(margin, Math.min(
            cardBounds.left + (cardBounds.width - tooltipBounds.width) / 2,
            window.innerWidth - tooltipBounds.width - margin
        ));
        const below = cardBounds.bottom + 9;
        const top = below + tooltipBounds.height <= window.innerHeight - margin
            ? below
            : Math.max(margin, cardBounds.top - tooltipBounds.height - 9);

        active.tooltip.style.left = `${left}px`;
        active.tooltip.style.top = `${top}px`;
        active.tooltip.style.visibility = 'visible';
    }

    function showMemoryTooltip(card) {
        const tooltip = card._supportMemoryTooltip;
        if (!tooltip) return;
        if (state.activeTooltipCard?.card === card) {
            positionActiveTooltip();
            return;
        }
        hideActiveTooltip();
        document.body.appendChild(tooltip);
        tooltip.dataset.visible = 'true';
        tooltip.style.visibility = 'hidden';
        tooltip.style.left = '0px';
        tooltip.style.top = '0px';
        tooltip.style.width = '';
        state.activeTooltipCard = { card, tooltip };
        positionActiveTooltip();
    }

    function appendTooltipLine(tooltip, className, text, tagName = 'span') {
        if (!text) return;
        const line = document.createElement(tagName);
        line.className = className;
        line.textContent = text;
        tooltip.appendChild(line);
    }

    function createMemoryCard(memory) {
        const link = document.createElement('a');
        link.className = 'sm-memory-card';
        link.href = createMemoryUrl(memory.id);
        link.dataset.memoryId = memory.id;
        link.setAttribute('aria-label', `${memory.name}, ${memory.filmType || 'film type not listed'} film${memory.filmCost === null ? '' : `, cost ${memory.filmCost}`}`);
        const tooltip = document.createElement('span');
        tooltip.id = `sm-memory-tooltip-${encodeURIComponent(memory.id)}`;
        tooltip.className = 'sm-memory-tooltip';
        tooltip.setAttribute('role', 'tooltip');
        appendTooltipLine(tooltip, 'sm-memory-tooltip-title', memory.name, 'strong');

        const metadata = [
            memory.filmType ? `${memory.filmType} film` : 'Film type not listed',
            memory.filmCost === null ? '' : `Cost ${memory.filmCost.toLocaleString()}`,
            memory.upgradeLevels.length ? `${memory.upgradeLevels.length + 1} levels` : ''
        ].filter(Boolean).join(' · ');
        appendTooltipLine(tooltip, 'sm-memory-tooltip-meta', metadata);
        appendTooltipLine(tooltip, 'sm-memory-tooltip-effect', safeEffectText(memory.effect) || 'Effect text is not available.', 'span');
        appendTooltipLine(tooltip, 'sm-memory-tooltip-condition', memory.activationCondition ? `Condition: ${memory.activationCondition}` : '');
        appendTooltipLine(tooltip, 'sm-memory-tooltip-duration', memory.durationText ? `Duration: ${memory.durationText}` : '');
        link._supportMemoryTooltip = tooltip;
        link.setAttribute('aria-describedby', tooltip.id);

        link.addEventListener('pointerenter', (event) => {
            if (event.pointerType !== 'touch') showMemoryTooltip(link);
        });
        link.addEventListener('pointerleave', () => {
            if (document.activeElement !== link) hideActiveTooltip();
        });
        link.addEventListener('focus', () => showMemoryTooltip(link));
        link.addEventListener('blur', () => hideActiveTooltip());
        link.addEventListener('click', (event) => {
            if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            selectMemory(memory.id, { updateUrl: true, returnFocus: link });
        });

        const artwork = document.createElement('div');
        artwork.className = 'sm-memory-card-art';
        renderImage(artwork, memory.assets.thumb, {
            alt: `${memory.name} thumbnail`,
            className: 'sm-memory-thumb',
            missingPathMessage: 'Thumbnail path is not present in the dataset.',
            unavailableMessage: 'Thumbnail file is unavailable.'
        });
        link.appendChild(artwork);
        return link;
    }

    function renderLibrary() {
        hideActiveTooltip();
        const search = state.searchText.trim().toLocaleLowerCase();
        const selectedFilm = state.filmFilter.toLocaleLowerCase();
        const filtered = state.memories.filter((memory) => {
            const matchesName = !search || memory.name.toLocaleLowerCase().includes(search);
            const matchesFilm = selectedFilm === 'all' || (memory.filmType || '').toLocaleLowerCase() === selectedFilm;
            return matchesName && matchesFilm;
        });

        elements.memoryGrid.replaceChildren();
        filtered.forEach((memory) => elements.memoryGrid.appendChild(createMemoryCard(memory)));

        if (!filtered.length) {
            const empty = document.createElement('p');
            empty.className = 'sm-empty-results';
            empty.textContent = state.memories.length
                ? 'No Support Memories match this search and film filter.'
                : 'This valid Support Memory dataset does not contain any records.';
            elements.memoryGrid.appendChild(empty);
        }

        const summary = `${filtered.length.toLocaleString()} of ${state.memories.length.toLocaleString()} Support Memories shown.`;
        setLibraryStatus([summary, state.statusNote].filter(Boolean).join(' '), state.statusNote ? 'warning' : 'ready');
    }

    function buildFilmOptions() {
        const known = new Set(state.memories.map((memory) => memory.filmType).filter(Boolean));
        const ordered = [
            ...FILM_ORDER.filter((film) => known.has(film)),
            ...Array.from(known).filter((film) => !FILM_ORDER.includes(film)).sort((a, b) => a.localeCompare(b))
        ];
        elements.filmFilter.replaceChildren(new Option('All film types', 'all'));
        ordered.forEach((film) => elements.filmFilter.add(new Option(`${film} film`, film)));
    }

    function stopPlayerForSelection() {
        state.playerToken += 1;
        state.playerObserver?.disconnect();
        state.playerObserver = null;
        state.playerClosing = false;
        const modal = document.getElementById('abs-animation-modal');
        if (!modal || modal.hidden || !window.DokkanAnimation?.close) {
            state.dialogWasOpen = false;
            return;
        }

        state.playerClosing = true;
        window.DokkanAnimation.close();
        state.playerClosePromise = new Promise((resolve) => {
            window.setTimeout(() => {
                state.playerClosing = false;
                resolve();
            }, 230);
        });
    }

    function updateAddress(memory, levelId, replace = false) {
        const url = new URL(window.location.href);
        if (memory) {
            url.searchParams.set('id', memory.id);
            if (levelId) url.searchParams.set('level', levelId);
            else url.searchParams.delete('level');
        } else {
            url.searchParams.delete('id');
            url.searchParams.delete('level');
        }
        const method = replace ? 'replaceState' : 'pushState';
        window.history[method]({ supportMemoryId: memory?.id || null, supportMemoryLevel: levelId || '' }, '', url);
    }

    function selectedVariant(memory = state.selectedMemory) {
        return memory?.upgradeLevels.find((level) => level.id === state.selectedLevelId) || memory;
    }

    function renderPlayerDetails() {
        const memory = state.selectedMemory;
        const modal = document.getElementById('abs-animation-modal');
        const details = modal?.querySelector('.sm-player-details');
        if (!memory || !details) return;

        const variant = selectedVariant(memory);
        const film = details.querySelector('#sm-player-film');
        const cost = details.querySelector('#sm-player-cost');
        const effect = details.querySelector('#sm-player-effect');
        const conditionRow = details.querySelector('#sm-player-condition-row');
        const condition = details.querySelector('#sm-player-condition');
        const durationRow = details.querySelector('#sm-player-duration-row');
        const duration = details.querySelector('#sm-player-duration');
        const levelField = details.querySelector('.sm-player-level-field');
        const levelSelect = details.querySelector('#sm-player-level');

        film.textContent = memory.filmType || 'Film type not listed';
        film.style.setProperty('--sm-film-color', FILM_COLORS[(memory.filmType || '').toLowerCase()] || '#b8c7dc');
        cost.hidden = memory.filmCost === null;
        cost.textContent = memory.filmCost === null ? '' : `Cost ${memory.filmCost.toLocaleString()}`;
        details.querySelector('#sm-player-memory-name').textContent = memory.name;
        effect.textContent = safeEffectText(variant.effect) || 'Effect text is not available in the dataset.';
        conditionRow.hidden = !variant.activationCondition;
        condition.textContent = variant.activationCondition || '';
        durationRow.hidden = !variant.durationText;
        duration.textContent = variant.durationText || '';

        levelField.hidden = memory.upgradeLevels.length === 0;
        if (levelSelect.dataset.memoryId !== memory.id) {
            levelSelect.replaceChildren(new Option('Base version', ''));
            memory.upgradeLevels.forEach((level) => levelSelect.add(new Option(`Level ${level.level}`, level.id)));
            levelSelect.dataset.memoryId = memory.id;
        }
        levelSelect.value = state.selectedLevelId;

        modal.querySelector('.abs-animation-stage-column')?.setAttribute('aria-label', `${memory.name} animation preview`);
    }

    function keepFocusInsidePlayer(event) {
        if (event.key !== 'Tab') return;
        const dialog = event.currentTarget;
        const focusable = Array.from(dialog.querySelectorAll('button:not(:disabled), a[href], select:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])'))
            .filter((element) => !element.hidden && element.getClientRects().length > 0);
        if (!focusable.length) {
            event.preventDefault();
            return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
            event.preventDefault();
            first.focus();
        }
    }

    function enhancePlayerDialog() {
        const modal = document.getElementById('abs-animation-modal');
        const dialog = modal?.querySelector('.abs-animation-dialog');
        const body = dialog?.querySelector('.abs-animation-body');
        const stage = body?.querySelector('.abs-animation-stage-wrap');
        if (!modal || !dialog || !body || !stage) return null;

        modal.querySelector('[data-animation-action="speed"]')?.remove();
        dialog.classList.add('sm-memory-player-dialog');
        dialog.setAttribute('aria-labelledby', 'abs-animation-title');
        const title = dialog.querySelector('#abs-animation-title');
        if (title) title.textContent = 'Support Memory';

        let workspace = body.querySelector('.sm-animation-workspace');
        if (!workspace) {
            workspace = document.createElement('div');
            workspace.className = 'sm-animation-workspace';
            const stageColumn = document.createElement('div');
            stageColumn.className = 'sm-animation-stage-column';
            stageColumn.appendChild(stage);

            const details = elements.detailsTemplate.content.firstElementChild.cloneNode(true);
            const sidebar = body.querySelector('.abs-animation-sidebar');
            workspace.append(stageColumn, details);
            if (sidebar) workspace.appendChild(sidebar);
            body.replaceChildren(workspace);
            details.querySelector('#sm-player-level').addEventListener('change', () => {
                if (!state.selectedMemory) return;
                state.selectedLevelId = details.querySelector('#sm-player-level').value;
                renderPlayerDetails();
                updateAddress(state.selectedMemory, state.selectedLevelId, true);
            });
        }

        const status = modal.querySelector('#abs-animation-status');
        status?.setAttribute('role', 'status');
        status?.setAttribute('aria-live', 'polite');
        status?.setAttribute('aria-atomic', 'true');
        const close = modal.querySelector('.abs-animation-close');
        close?.setAttribute('aria-label', 'Close Support Memory preview');
        close?.setAttribute('title', 'Close');
        const replay = modal.querySelector('[data-animation-action="restart"]');
        if (replay) {
            replay.textContent = 'Replay';
            replay.setAttribute('aria-label', 'Replay animation');
        }
        const controls = modal.querySelector('.abs-animation-controls');
        controls?.setAttribute('role', 'group');
        controls?.setAttribute('aria-label', 'Animation controls');
        if (!dialog.dataset.supportMemoryFocusTrap) {
            dialog.addEventListener('keydown', keepFocusInsidePlayer, true);
            dialog.dataset.supportMemoryFocusTrap = 'true';
        }
        renderPlayerDetails();
        return modal;
    }

    function selectMemory(memoryId, { updateUrl = false, levelId = '', returnFocus = null } = {}) {
        const requestedId = String(memoryId || '');
        let memory = state.memories.find((candidate) => candidate.id === requestedId);
        let requestedLevelId = levelId;
        if (!memory) {
            memory = state.memories.find((candidate) => candidate.upgradeLevels.some((level) => level.id === requestedId));
            if (memory) requestedLevelId = requestedId;
        }
        if (!memory) {
            setLibraryStatus(`Support Memory “${requestedId}” was not found in the dataset.`, 'warning');
            return;
        }

        hideActiveTooltip();
        const selectionChanged = state.selectedMemory?.id !== memory.id;
        if (selectionChanged) stopPlayerForSelection();
        if (returnFocus) state.returnFocus = returnFocus;
        state.selectedMemory = memory;
        state.selectedLevelId = memory.upgradeLevels.some((level) => level.id === requestedLevelId) ? requestedLevelId : '';
        if (updateUrl) updateAddress(memory, state.selectedLevelId, false);
        setLibraryStatus(`Opening ${memory.name}…`, 'loading');
        if (selectionChanged || document.getElementById('abs-animation-modal')?.hidden !== false) {
            void playSelectedMemory();
        } else {
            renderPlayerDetails();
        }
    }

    function clearSelection({ updateUrl = false, restoreFocus = true } = {}) {
        const playerWasOpen = document.getElementById('abs-animation-modal')?.hidden === false;
        stopPlayerForSelection();
        state.selectedMemory = null;
        state.selectedLevelId = '';
        if (updateUrl) updateAddress(null, '', true);
        if (restoreFocus) {
            const target = state.returnFocus?.isConnected ? state.returnFocus : elements.search;
            state.returnFocus = null;
            if (playerWasOpen) window.setTimeout(() => target.focus({ preventScroll: true }), 230);
            else target.focus({ preventScroll: true });
        }
    }

    function loadScript(path, key) {
        const url = new URL(path, document.baseURI).href;
        const existing = document.querySelector(`script[data-support-memory-runtime="${key}"]`);
        if (existing?.dataset.loaded === 'true') return Promise.resolve();
        if (existing?.dataset.loading === 'true') {
            return new Promise((resolve, reject) => {
                existing.addEventListener('load', resolve, { once: true });
                existing.addEventListener('error', () => reject(new Error(`Could not load ${path}.`)), { once: true });
            });
        }

        return new Promise((resolve, reject) => {
            const script = existing || document.createElement('script');
            const timeout = window.setTimeout(() => {
                script.remove();
                reject(new Error(`Loading ${path} timed out. Please retry.`));
            }, 15000);
            script.src = url;
            script.async = false;
            script.dataset.supportMemoryRuntime = key;
            script.dataset.loading = 'true';
            script.addEventListener('load', () => {
                window.clearTimeout(timeout);
                script.dataset.loading = 'false';
                script.dataset.loaded = 'true';
                resolve();
            }, { once: true });
            script.addEventListener('error', () => {
                window.clearTimeout(timeout);
                script.remove();
                reject(new Error(`Could not load ${path}. Please retry.`));
            }, { once: true });
            if (!existing) document.body.appendChild(script);
        });
    }

    function loadPlayerStylesheet() {
        if (document.querySelector('link[data-support-memory-player-style]')) return Promise.resolve();
        return new Promise((resolve, reject) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = new URL(PLAYER_STYLESHEET_PATH, document.baseURI).href;
            link.dataset.supportMemoryPlayerStyle = 'true';
            const timeout = window.setTimeout(() => reject(new Error('The animation player styles did not load. Please retry.')), 10000);
            link.addEventListener('load', () => {
                window.clearTimeout(timeout);
                resolve();
            }, { once: true });
            link.addEventListener('error', () => {
                window.clearTimeout(timeout);
                link.remove();
                reject(new Error('The animation player styles could not be loaded.'));
            }, { once: true });
            document.head.appendChild(link);
        });
    }

    function ensurePlaybackRuntime() {
        if (!state.playerLoad) {
            state.playerLoad = (async () => {
                await loadPlayerStylesheet();
                if (!window.LWF) await loadScript(LWF_RUNTIME_PATH, 'lwf-runtime');
                await loadScript(FENGARI_SCRIPT_PATH, 'fengari');
                if (!window.DokkanAnimation?.open || !window.DokkanAnimation?.close) {
                    await loadScript(PLAYER_SCRIPT_PATH, 'dokkan-animation-player');
                }
                if (!window.DokkanAnimation?.open || !window.DokkanAnimation?.close) {
                    throw new Error('The animation player loaded without its playback controls.');
                }
            })().catch((error) => {
                state.playerLoad = null;
                throw error;
            });
        }
        return state.playerLoad;
    }

    function observePlayer(token) {
        state.playerObserver?.disconnect();
        const modal = document.getElementById('abs-animation-modal');
        const status = document.getElementById('abs-animation-status');
        if (!modal || !status) {
            setLibraryStatus('The animation player did not create its playback panel. Select the memory again to retry.', 'error');
            return;
        }

        const finishClose = () => {
            if (!state.dialogWasOpen) return;
            state.dialogWasOpen = false;
            state.playerObserver?.disconnect();
            state.playerObserver = null;
            state.playerToken += 1;
            if (state.selectedMemory) updateAddress(null, '', true);
            state.selectedMemory = null;
            state.selectedLevelId = '';
            setLibraryStatus('Preview closed. Choose a Support Memory to open it again.', 'info');
            const target = state.returnFocus?.isConnected ? state.returnFocus : elements.search;
            state.returnFocus = null;
            target.focus({ preventScroll: true });
        };

        const syncStatus = () => {
            if (token !== state.playerToken) return;
            const isOpen = !modal.hidden;
            if (!isOpen) {
                finishClose();
                return;
            }
            state.dialogWasOpen = true;

            let message = status.textContent.trim();
            if (status.classList.contains('is-error')) {
                let readableMessage = message;
                if (message.includes('start-animation-server.cmd')) {
                    readableMessage = 'The animation source could not be reached. Check the local animation server or published manifest and linked assets, then retry.';
                } else if (/\b(404|not found)\b/i.test(message)) {
                    readableMessage = 'This Support Memory animation or one of its linked assets is unavailable.';
                } else if (!readableMessage) {
                    readableMessage = 'Animation playback failed. Close this preview and select the memory again to retry.';
                }
                if (status.textContent !== readableMessage) status.textContent = readableMessage;
                setLibraryStatus(readableMessage, 'error');
            } else if (message) {
                setLibraryStatus(message, 'loading');
            } else {
                const name = state.selectedMemory?.name || 'Support Memory';
                setLibraryStatus(`${name} animation is ready. Use Pause or Replay in the player controls.`, 'ready');
            }
        };

        state.playerObserver = new MutationObserver(syncStatus);
        state.playerObserver.observe(modal, { attributes: true, childList: true, characterData: true, subtree: true });
        syncStatus();
    }

    async function waitForPlayerClose() {
        await state.playerClosePromise;
        const modal = document.getElementById('abs-animation-modal');
        if (!modal || modal.hidden) return;
        window.DokkanAnimation?.close?.();
        state.playerClosePromise = new Promise((resolve) => window.setTimeout(resolve, 230));
        await state.playerClosePromise;
    }

    async function playSelectedMemory() {
        const memory = state.selectedMemory;
        if (!memory) return;
        const token = ++state.playerToken;
        setLibraryStatus(`Preparing ${memory.name} animation…`, 'loading');

        try {
            await waitForPlayerClose();
            await ensurePlaybackRuntime();
            if (token !== state.playerToken || state.selectedMemory?.id !== memory.id) return;

            const key = memory.animation.key;
            const manifestUrl = new URL(memory.animation.manifestUrl);
            const expectedManifest = `${MANIFEST_ROOT}${encodeURIComponent(key)}.json`;
            if (manifestUrl.href !== expectedManifest) {
                throw new Error('The animation manifest URL no longer matches its script key.');
            }

            setLibraryStatus(`Loading ${memory.name} animation and linked assets…`, 'loading');
            const openResult = window.DokkanAnimation.open(key, `Support Memory: ${memory.name}`, 'active', 'sequence');
            const modal = enhancePlayerDialog();
            if (!modal) throw new Error('The animation player opened without its Support Memory dialog controls.');
            observePlayer(token);
            modal.querySelector('.abs-animation-close')?.focus({ preventScroll: true });
            await Promise.resolve(openResult);
            if (token !== state.playerToken || state.selectedMemory?.id !== memory.id) return;
        } catch (error) {
            if (token !== state.playerToken) return;
            console.error('[Support Memory] Could not start animation playback:', error);
            setLibraryStatus(`${error.message || 'The animation could not be loaded.'} Select the memory again to retry.`, 'error');
        }
    }

    function displayLoadFailure(message, kind = 'error') {
        state.memories = [];
        elements.memoryGrid.replaceChildren();
        const panel = document.createElement('p');
        panel.className = 'sm-empty-results';
        panel.dataset.state = kind;
        panel.textContent = message;
        elements.memoryGrid.appendChild(panel);
        setLibraryStatus(message, kind);
    }

    async function loadDataset() {
        let response;
        try {
            response = await fetch(new URL(DATASET_PATH, document.baseURI), { cache: 'no-store' });
        } catch (error) {
            displayLoadFailure('The Support Memory dataset could not be reached. Check your connection and reload.', 'error');
            return;
        }

        if (response.status === 404) {
            displayLoadFailure('Support Memory data is missing. Generate json/support_memories.json with the Console tool, then reload.', 'missing');
            return;
        }
        if (!response.ok) {
            displayLoadFailure(`The Support Memory dataset returned HTTP ${response.status}. Reload to retry.`, 'error');
            return;
        }

        let dataset;
        try {
            dataset = await response.json();
        } catch {
            displayLoadFailure('The Support Memory dataset is not valid JSON.', 'invalid');
            return;
        }

        if (!isObject(dataset) || !Array.isArray(dataset.memories)) {
            displayLoadFailure('The Support Memory dataset is missing its memories array.', 'invalid');
            return;
        }
        if (dataset.schemaVersion !== 1) {
            displayLoadFailure(`This Support Memory dataset uses unsupported schema version “${String(dataset.schemaVersion ?? 'missing')}”. Expected version 1.`, 'unsupported');
            return;
        }

        const ids = new Set();
        const validMemories = [];
        let skippedRecords = 0;
        let skippedLevels = 0;
        dataset.memories.forEach((sourceMemory) => {
            const memory = normalizeMemory(sourceMemory);
            if (!memory || ids.has(memory.id)) {
                skippedRecords += 1;
                return;
            }
            ids.add(memory.id);
            skippedLevels += memory.skippedLevels;
            validMemories.push(memory);
        });

        if (!validMemories.length) {
            displayLoadFailure('The dataset parsed, but no records have the required name, string ID, and supported animation manifest fields.', 'invalid');
            return;
        }

        const filmRank = (memory) => {
            const index = FILM_ORDER.findIndex((film) => film.toLowerCase() === (memory.filmType || '').toLowerCase());
            return index < 0 ? FILM_ORDER.length : index;
        };
        validMemories.sort((first, second) => filmRank(first) - filmRank(second)
            || first.name.localeCompare(second.name)
            || first.id.localeCompare(second.id, undefined, { numeric: true }));
        state.memories = validMemories;
        const warnings = [];
        if (skippedRecords) warnings.push(`${skippedRecords} invalid record${skippedRecords === 1 ? '' : 's'} skipped`);
        if (skippedLevels) warnings.push(`${skippedLevels} invalid upgrade level${skippedLevels === 1 ? '' : 's'} skipped`);
        state.statusNote = warnings.join('; ');
        buildFilmOptions();
        renderLibrary();

        const params = new URLSearchParams(window.location.search);
        const requestedId = params.get('id');
        if (requestedId) {
            selectMemory(requestedId, { levelId: params.get('level') || '' });
        }
    }

    elements.search.addEventListener('input', () => {
        state.searchText = elements.search.value;
        renderLibrary();
    });
    elements.filmFilter.addEventListener('change', () => {
        state.filmFilter = elements.filmFilter.value;
        renderLibrary();
    });
    window.addEventListener('popstate', () => {
        const params = new URLSearchParams(window.location.search);
        const id = params.get('id');
        if (id) selectMemory(id, { levelId: params.get('level') || '' });
        else clearSelection();
    });
    window.addEventListener('resize', positionActiveTooltip);
    window.addEventListener('scroll', positionActiveTooltip, { capture: true, passive: true });
    window.addEventListener('pagehide', () => {
        hideActiveTooltip();
        state.playerToken += 1;
        state.playerObserver?.disconnect();
        window.DokkanAnimation?.close?.();
    }, { once: true });

    loadDataset();
})();
