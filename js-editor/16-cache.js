

window.IS_RESETTING = false;

const EDITOR_AUTOSAVE_DB_NAME = 'dokkan-editor-autosave';
const EDITOR_AUTOSAVE_DB_VERSION = 1;
const EDITOR_AUTOSAVE_STORE_NAME = 'snapshots';
const EDITOR_AUTOSAVE_RECORD_KEY = 'current';
const EDITOR_AUTOSAVE_LOCAL_KEY = 'dokkan_autosave';
let editorAutosaveWriteQueue = Promise.resolve();
let editorAutosaveRevision = 0;

function openEditorAutosaveDatabase() {
    if (!window.indexedDB) return Promise.reject(new Error('IndexedDB is not available in this browser.'));
    return new Promise((resolve, reject) => {
        let request;
        try {
            request = window.indexedDB.open(EDITOR_AUTOSAVE_DB_NAME, EDITOR_AUTOSAVE_DB_VERSION);
        } catch (error) {
            reject(error);
            return;
        }
        request.onupgradeneeded = () => {
            const database = request.result;
            if (!database.objectStoreNames.contains(EDITOR_AUTOSAVE_STORE_NAME)) {
                database.createObjectStore(EDITOR_AUTOSAVE_STORE_NAME, { keyPath: 'key' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('Could not open autosave storage.'));
        request.onblocked = () => reject(new Error('Autosave storage is blocked by another page.'));
    });
}

async function readIndexedAutosaveRecord() {
    const database = await openEditorAutosaveDatabase();
    return new Promise((resolve, reject) => {
        let transaction;
        try {
            transaction = database.transaction(EDITOR_AUTOSAVE_STORE_NAME, 'readonly');
            const request = transaction.objectStore(EDITOR_AUTOSAVE_STORE_NAME).get(EDITOR_AUTOSAVE_RECORD_KEY);
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error || new Error('Could not read the saved card.'));
            transaction.onabort = () => reject(transaction.error || new Error('Autosave read was interrupted.'));
        } catch (error) {
            reject(error);
        } finally {
            database.close();
        }
    });
}

async function writeIndexedAutosaveRecord(payload, savedAt) {
    const database = await openEditorAutosaveDatabase();
    return new Promise((resolve, reject) => {
        let transaction;
        try {
            transaction = database.transaction(EDITOR_AUTOSAVE_STORE_NAME, 'readwrite');
            transaction.objectStore(EDITOR_AUTOSAVE_STORE_NAME).put({
                key: EDITOR_AUTOSAVE_RECORD_KEY,
                payload,
                savedAt
            });
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error || new Error('Could not save the card to browser storage.'));
            transaction.onabort = () => reject(transaction.error || new Error('Autosave was interrupted.'));
        } catch (error) {
            reject(error);
        } finally {
            database.close();
        }
    });
}

function readLocalAutosaveRecord() {
    try {
        const payload = localStorage.getItem(EDITOR_AUTOSAVE_LOCAL_KEY);
        if (!payload) return null;
        let savedAt = 0;
        try { savedAt = Number(JSON.parse(payload)?._autosaveSavedAt) || 0; } catch (e) {}
        return { payload, savedAt, storage: 'localStorage' };
    } catch (error) {
        return { error };
    }
}

window.EditorAutosaveStore = {
    async readLatest() {
        const localRecord = readLocalAutosaveRecord();
        let indexedRecord = null;
        let indexedError = null;
        try { indexedRecord = await readIndexedAutosaveRecord(); }
        catch (error) { indexedError = error; }

        const local = localRecord && !localRecord.error ? localRecord : null;
        const indexed = indexedRecord?.payload
            ? { payload: indexedRecord.payload, savedAt: Number(indexedRecord.savedAt) || 0, storage: 'IndexedDB' }
            : null;
        if (indexed && (!local || indexed.savedAt >= local.savedAt)) return indexed;
        if (local) return local;
        if (indexedError && localRecord?.error) throw indexedError;
        return null;
    },

    async save(payload, savedAt = Date.now()) {
        try {
            await writeIndexedAutosaveRecord(payload, savedAt);
            return { storage: 'IndexedDB' };
        } catch (indexedError) {
            // Keep compatibility with older browsers and private modes. The
            // old autosave is replaced only if this complete payload fits.
            try {
                localStorage.setItem(EDITOR_AUTOSAVE_LOCAL_KEY, payload);
                return { storage: 'localStorage', warning: indexedError };
            } catch (localError) {
                localError.indexedDBError = indexedError;
                throw localError;
            }
        }
    },

    async clear() {
        if (!window.indexedDB) return;
        const database = await openEditorAutosaveDatabase();
        return new Promise((resolve, reject) => {
            let transaction;
            try {
                transaction = database.transaction(EDITOR_AUTOSAVE_STORE_NAME, 'readwrite');
                transaction.objectStore(EDITOR_AUTOSAVE_STORE_NAME).delete(EDITOR_AUTOSAVE_RECORD_KEY);
                transaction.oncomplete = () => resolve();
                transaction.onerror = () => reject(transaction.error || new Error('Could not clear the saved card.'));
                transaction.onabort = () => reject(transaction.error || new Error('Autosave clear was interrupted.'));
            } catch (error) {
                reject(error);
            } finally {
                database.close();
            }
        });
    }
};

function autosaveByteLength(value) {
    if (typeof TextEncoder === 'function') return new TextEncoder().encode(value).length;
    return value.length * 2;
}

async function inspectAutosaveStorage(payload, projectData) {
    let originUsageBytes = null;
    let originQuotaBytes = null;
    try {
        const estimate = await window.navigator?.storage?.estimate?.();
        if (Number.isFinite(estimate?.usage)) originUsageBytes = estimate.usage;
        if (Number.isFinite(estimate?.quota)) originQuotaBytes = estimate.quota;
    } catch (error) {}

    let localStorageBytes = null;
    try {
        let used = 0;
        for (let index = 0; index < localStorage.length; index += 1) {
            const key = localStorage.key(index) || '';
            used += (key.length + String(localStorage.getItem(key) || '').length) * 2;
        }
        localStorageBytes = used;
    } catch (error) {}

    const topLevelBytes = {};
    for (const [key, value] of Object.entries(projectData || {})) {
        try { topLevelBytes[key] = autosaveByteLength(JSON.stringify(value)); }
        catch (error) { topLevelBytes[key] = null; }
    }
    const imageSources = Array.from(String(payload || '').matchAll(/data:image\/[^;,]+(?:;[^,]*)?,[^"\s<>]*/g), match => match[0]);
    const uniqueImageSources = new Set(imageSources);
    return {
        autosaveBytes: autosaveByteLength(String(payload || '')),
        localStorageBytes,
        originUsageBytes,
        originQuotaBytes,
        embeddedImageSourceCount: imageSources.length,
        duplicateEmbeddedImageSourceCount: imageSources.length - uniqueImageSources.size,
        topLevelBytes
    };
}

async function blobUrlToDataUrl(url) {
    if (!url) return "";
    if (url.startsWith('data:') || url.startsWith('http')) {
        return url;
    }
    if (url.startsWith('blob:')) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status} while reading a temporary image.`);
            const blob = await response.blob();
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = () => reject(reader.error || new Error('Could not read a temporary image.'));
                reader.readAsDataURL(blob);
            });
        } catch (e) {
            throw new Error('Could not prepare an uploaded image for autosave.', { cause: e });
        }
    }
    return url;
}

window.autoSaveToCache = async function(options = {}) {
    if (window.IS_RESETTING) return;

    // A published upload is read-only until the admin keybind + password
    // unlocks it.  This keeps the published page from creating or overwriting
    // a local editor autosave while it is being viewed.
    if (window.IS_PUBLISHED && window.ADMIN_MODE !== true) return false;

    const saveRevision = ++editorAutosaveRevision;
    const changeRevision = window.editorAutosaveChangeRevision;
    const historyCapture = window.EditorSessionHistory?.beginCapture?.(options.historyDescription) || null;
    let projectData = null;
    let serializedPayload = '';
    try {
        let inputData = {};
        if (typeof savedInputs !== 'undefined') {
            savedInputs.forEach(id => { 
                const el = document.getElementById(id); 
                if (el) inputData[id] = el.value; 
            });
        }

        window.normalizeActiveSkillBlocks?.();
        window.ensureEditorSkillSourceIds?.();
        const saHTMLBlocks = (window.getSuperAttackSourceBlocks?.() || Array.from(document.querySelectorAll(".sa-block"))).map(b => b.outerHTML);
        const activeHTMLBlocks = (window.getActiveSkillSourceBlocks?.() || Array.from(document.querySelectorAll(".active-block"))).map(b => b.outerHTML);

        document.querySelectorAll('#sidebar-sections-area input').forEach(input => {
            if (input.getAttribute('value') !== input.value) input.setAttribute('value', input.value);
        });
        document.querySelectorAll('#sidebar-sections-area textarea').forEach(ta => {
            if (ta.textContent !== ta.value) ta.textContent = ta.value;
        });

        // Snapshot uploaded form artwork into the saved markup itself. The
        // previous payload stored the same image data URLs a second time in
        // formsData, which could nearly double large custom-card autosaves.
        const formsContainer = document.getElementById('forms-container');
        const formsSnapshot = formsContainer?.cloneNode(true) || null;
        const formElements = Array.from(document.querySelectorAll("#forms-container .dokkan-card"));
        const snapshotForms = formsSnapshot ? Array.from(formsSnapshot.querySelectorAll('.dokkan-card')) : [];
        for (let index = 0; index < formElements.length; index += 1) {
            const formEl = formElements[index];
            const img = formEl.querySelector('.form-image');
            const thumbSrc = formEl.getAttribute('data-thumb-src') || "";
            const imageSrc = img?.src ? await blobUrlToDataUrl(img.src) : "";
            const savedThumbSrc = thumbSrc ? await blobUrlToDataUrl(thumbSrc) : "";
            const snapshotForm = snapshotForms[index];
            const snapshotImage = snapshotForm?.querySelector('.form-image');
            if (snapshotImage && imageSrc) snapshotImage.setAttribute('src', imageSrc);
            if (snapshotForm && savedThumbSrc) snapshotForm.setAttribute('data-thumb-src', savedThumbSrc);
        }
        const formsHTML = formsSnapshot?.innerHTML || '';

        const passiveName = document.getElementById('input-passive-name-sidebar')?.value || "";
        const vidOverlayEl = document.getElementById("myOverlayVideo");
        const isVideoActive = vidOverlayEl && vidOverlayEl.style.display !== 'none';
        const cardArtVideo = (vidOverlayEl?.querySelector('source')?.getAttribute('src') || vidOverlayEl?.getAttribute('src') || "").trim();
        const cardArtImage = document.getElementById("myOverlayImage");
        const cardArtImageSrc = cardArtImage?.src && !window.isPlaceholderCardArtUrl?.(cardArtImage.src)
            ? await blobUrlToDataUrl(cardArtImage.src)
            : "";
        // Layered official art (bg/character/effect) must be persisted too:
        // only the flat overlay above is restored otherwise, so after a
        // reload the static guards see empty layers and the bg + effect
        // stay hidden. Remote CDN URLs are stored as-is (tiny strings);
        // blob:/data: sources cannot survive a reload and are skipped.
        // Layered art belongs to the ABS.Clean presentation. The three roots
        // intentionally contain their own IDs, so querying the document can
        // silently save a hidden ABS.Style layer instead of Clean's art.
        const cleanArtRoot = window.getCardLayoutRoot?.('abs-clean');
        const layerEntry = id => {
            const el = cleanArtRoot
                ? (window.getCardLayoutElement?.(id, cleanArtRoot) || cleanArtRoot.querySelector(`[data-card-element="${id}"]`))
                : document.getElementById(id);
            const rawSrc = el?.getAttribute('src') || '';
            if (!rawSrc || /^(blob:|data:)/i.test(rawSrc) || /placeholder|none\.png$/i.test(rawSrc)) return null;
            return { src: el.src, official: el.dataset.officialCardArt === 'true' };
        };

        const lrEl = document.getElementById("img-lr");
        const turEl = document.getElementById("img-tur");
        const ssrEl = document.getElementById("img-ssr");
        const mainRarityEl = document.getElementById("main-rarity-icon");

        const lrIconSrc = lrEl?.src ? await blobUrlToDataUrl(lrEl.src) : "";
        const turIconSrc = turEl?.src ? await blobUrlToDataUrl(turEl.src) : "";
        const ssrIconSrc = ssrEl?.src ? await blobUrlToDataUrl(ssrEl.src) : "";
        const mainRarityIconSrc = mainRarityEl?.src ? await blobUrlToDataUrl(mainRarityEl.src) : "";

        const identity = window.getCardIdentityState?.() || {
            type: typeof currentType !== 'undefined' ? currentType : 'agl',
            cardClass: typeof currentClass !== 'undefined' ? currentClass : 'super',
            rarity: typeof currentRarity !== 'undefined' ? currentRarity : 'LR'
        };
        const savedAt = Date.now();
        projectData = {
            _autosaveSavedAt: savedAt,
            currentType: identity.type,
            currentClass: identity.cardClass,
            currentRarity: identity.rarity,
            currentAwakeningMode: typeof currentAwakeningMode !== 'undefined' ? currentAwakeningMode : "none",
            counters: { sIdx: typeof sIdx !== 'undefined' ? sIdx : 0, lIdx: typeof lIdx !== 'undefined' ? lIdx : 0 }, 
            inputs: inputData,
            activeBlocksHTML: activeHTMLBlocks, 
            saBlocksHTML: saHTMLBlocks,         
            containers: {
                passiveCard: document.getElementById("card-passive-container")?.innerHTML || "",
                passiveSidebar: document.getElementById("sidebar-sections-area")?.innerHTML || "",
                links: document.getElementById("card-link-container")?.innerHTML || "",
                categories: document.getElementById("card-category-container")?.innerHTML || "",
                forms: formsHTML
            },
            icons: {
                lrIcon: lrIconSrc,
                turIcon: turIconSrc,
                ssrIcon: ssrIconSrc,
                mainRarityIcon: mainRarityIconSrc
            },
            passiveName: passiveName,
            passiveHeaderIconsOverride: window.passiveHeaderIconsOverride || null,
            absUnitTag: window.absUnitTag ?? '',
            showAwakeningProgression: window.showAwakeningProgression !== false,
            showSsrProgression: window.showSsrProgression !== false,
            showTurProgression: window.showTurProgression !== false,
            isVideoActive: isVideoActive,
            cardArtImage: cardArtImageSrc,
            cardArtVideo: cardArtVideo,
            layerArt: {
                bg: layerEntry("abs-art-bg"),
                char: layerEntry("abs-art-char"),
                effect: layerEntry("abs-art-effect")
            },
            editorArtMode: window.currentEditorArtMode || (isVideoActive ? 'animated' : 'static'),
            themeStyle: window.currentCardThemeStyle,
            themeVariant: window.currentCardThemeVariant || window.currentCardThemeStyle || 'dokkaninfo',
            // LWF players are in-memory objects, so retain the official card
            // identity needed to rebuild them after a browser refresh.
            cardSource: window.currentCardSource === 'official' ? 'official' : 'custom',
            customAssetBaseUrl: window.currentCustomCardAssetBaseUrl || '',
            officialCardId: window.currentCardSource === 'official'
                ? (window.currentOfficialCardId || window.editorPartnerCardId || '')
                : '',
            officialCardAwakeningMode: window.currentCardSource === 'official'
                ? (window.currentOfficialCardAwakeningMode || window.currentAwakeningMode || '')
                : ''
        };

        serializedPayload = JSON.stringify(projectData);
        const queuedSave = editorAutosaveWriteQueue.catch(() => {}).then(async () => {
            if (saveRevision !== editorAutosaveRevision || window.IS_RESETTING) return { skipped: true };
            return window.EditorAutosaveStore.save(serializedPayload, savedAt);
        });
        editorAutosaveWriteQueue = queuedSave.catch(() => {});
        const saveResult = await queuedSave;
        if (saveResult?.skipped || saveRevision !== editorAutosaveRevision || window.IS_RESETTING) return true;
        // Only acknowledge the revision captured by this save. Edits made
        // while IndexedDB is writing stay dirty for the next five-second tick.
        window.editorAutosaveSavedRevision = changeRevision;

        try { window.EditorSessionHistory?.record?.(serializedPayload, historyCapture); }
        catch (historyError) { console.warn('Editor history snapshot skipped:', historyError); }

        if (window.CardHubToast && !options.silent) {
            const detail = saveResult?.storage === 'localStorage'
                ? 'Saved using the local fallback.'
                : 'Saved on this device.';
            window.CardHubToast.success('Autosaved', { detail, duration: 2000 });
        } else if (!options.silent) {
            const mainIndicator = document.getElementById('main-autosave-indicator');
            if (mainIndicator) {
                mainIndicator.textContent = 'Autosaved';
                mainIndicator.classList.remove('autosave-failed');
                mainIndicator.classList.add('show');
                setTimeout(() => { mainIndicator.classList.remove('show'); }, 2000);
            }
        }
        return true;
    } catch (e) { 
        if (saveRevision !== editorAutosaveRevision || window.IS_RESETTING) return false;
        let diagnostics = null;
        try { diagnostics = await inspectAutosaveStorage(serializedPayload, projectData); } catch (diagnosticError) {}
        console.warn("Autosave Failed:", e, diagnostics || undefined);
        if (window.CardHubToast) {
            window.CardHubToast.error('Autosave failed', {
                detail: 'Your latest edits could not be saved. Keep this tab open and retry.',
                duration: 8000
            });
        } else {
            const mainIndicator = document.getElementById('main-autosave-indicator');
            if (mainIndicator) {
                mainIndicator.textContent = 'Autosave failed — keep this tab open and retry.';
                mainIndicator.classList.add('autosave-failed', 'show');
            }
        }
        return false;
    }
};

window.loadFromCache = async function() {
    if (window.location.search.includes('reset=')) {
        return false;
    }

    try {
        const cachedRecord = await window.EditorAutosaveStore.readLatest();
        const cacheData = cachedRecord?.payload || null;
        if (!cacheData) return; 

        const data = JSON.parse(cacheData);

        const cachedImageInput = String(data.inputs?.imageInput || '');
        const cachedOfficialArt = /(?:dokkaninfo\.com|images\.weserv\.nl).*\/character\/card\/\d+/i.test(cachedImageInput);
        window.currentCardSource = data.cardSource === 'official' || (!data.cardSource && cachedOfficialArt) ? 'official' : 'custom';
        window.currentOfficialCardId = window.currentCardSource === 'official' && data.officialCardId
            ? String(data.officialCardId)
            : '';
        window.currentOfficialCardAwakeningMode = window.currentCardSource === 'official'
            ? (data.officialCardAwakeningMode || data.currentAwakeningMode || '')
            : '';
        const cachedCustomFolderId = String(data.inputs?.['upload-folder-id'] || '').trim();
        const inferCustomFolderBase = value => {
            const source = String(value || '');
            const match = source.match(/^(https?:\/\/[^/]+\/(?:.*\/)?Custom(?:%20| )Cards\/[^/?#]+\/)/i);
            return match?.[1] || '';
        };
        window.currentCustomCardAssetBaseUrl = window.currentCardSource === 'custom'
            ? (data.customAssetBaseUrl || (cachedCustomFolderId
                ? `https://abscustom.github.io/Custom%20Cards/${encodeURIComponent(cachedCustomFolderId)}/`
                : (inferCustomFolderBase(data.cardArtImage) || inferCustomFolderBase(cachedImageInput))))
            : '';
        if (window.currentOfficialCardId) window.editorPartnerCardId = window.currentOfficialCardId;
        // Prefer the theme stored with this project.  Only fall back to the
        // site-wide preference for legacy caches that have no theme metadata;
        // otherwise a stale SBA preference could silently change an ABS
        // project while it is being rehydrated.
        window.currentCardThemeVariant = data.themeVariant || data.themeStyle || (localStorage.getItem('dokkan_selected_theme') === 'sba' ? 'sba' : 'dokkaninfo');

        currentType = data.currentType || "agl"; 
        currentClass = data.currentClass || "super";
        currentRarity = data.currentRarity || "LR";
        window.currentType = currentType;
        window.currentClass = currentClass;
        window.currentRarity = currentRarity;
        currentAwakeningMode = data.currentAwakeningMode || "none";
        const legacyProgressionVisibility = data.showAwakeningProgression !== false;
        window.showSsrProgression = data.showSsrProgression !== undefined ? data.showSsrProgression !== false : legacyProgressionVisibility;
        window.showTurProgression = data.showTurProgression !== undefined ? data.showTurProgression !== false : legacyProgressionVisibility;
        window.showAwakeningProgression = window.showSsrProgression || window.showTurProgression;
        if (data.absUnitTag !== undefined) {
            if (typeof window.setAbsUnitTag === 'function') window.setAbsUnitTag(data.absUnitTag);
            else window.absUnitTag = data.absUnitTag;
        }

        window.updateRarityStats(currentRarity); 

        if(data.counters) { sIdx = data.counters.sIdx; lIdx = data.counters.lIdx; }

        const norm = (s) => {
            let markup = window.normalizeAssetUrl ? window.normalizeAssetUrl(s) : (s || '');
            if (window.rewriteImportedAssetUrls) {
                markup = window.rewriteImportedAssetUrls(markup, '', window.currentCustomCardAssetBaseUrl);
            }
            return markup;
        };
        if (data.containers) {
            if (data.containers.passiveCard) document.getElementById("card-passive-container").innerHTML = norm(data.containers.passiveCard);
            if (data.containers.passiveSidebar) document.getElementById("sidebar-sections-area").innerHTML = norm(data.containers.passiveSidebar);
            if (data.containers.links) document.getElementById("card-link-container").innerHTML = norm(data.containers.links);
            if (data.containers.categories) {
                document.getElementById("card-category-container").innerHTML = norm(data.containers.categories);
                window.normalizeEditorCategoryItems?.(document.getElementById("card-category-container"));
            }
            if (data.containers.forms) document.getElementById("forms-container").innerHTML = norm(data.containers.forms);
        }

        window.clearEditorSkillSources?.();
        document.querySelectorAll(".active-block, .sa-block").forEach(el => el.remove()); 

        if (data.activeBlocksHTML) {
            const actSpot = window.ensureEditorSkillSourceHost?.();
            if (actSpot) data.activeBlocksHTML.forEach(html => actSpot.insertAdjacentHTML('beforeend', norm(html)));
        }
        window.normalizeActiveSkillBlocks?.();

        if (data.saBlocksHTML) {
            const saSpot = window.ensureEditorSkillSourceHost?.();
            if (saSpot) data.saBlocksHTML.forEach(html => saSpot.insertAdjacentHTML('beforeend', norm(html)));
        }
        window.applyCardTheme(currentType); 
        window.applyAwakening(currentAwakeningMode);

        if (data.inputs) {
            savedInputs.forEach(id => {
                const el = document.getElementById(id);
                if (el && data.inputs[id] !== undefined) { el.value = data.inputs[id]; }
            });
        }

        if (data.icons) {
            if(data.icons.lrIcon && document.getElementById("img-lr")) document.getElementById("img-lr").src = data.icons.lrIcon;
            if(data.icons.turIcon && document.getElementById("img-tur")) document.getElementById("img-tur").src = data.icons.turIcon;
            if(data.icons.ssrIcon && document.getElementById("img-ssr")) document.getElementById("img-ssr").src = data.icons.ssrIcon;
            if(data.icons.mainRarityIcon && document.getElementById("main-rarity-icon")) {
                let mIcon = data.icons.mainRarityIcon.replace('rarity_lr.png', 'rarity_LR.png').replace('rarity_tur.png', 'rarity_TUR.png').replace('rarity_SSR.png', 'rarity_ssr.png');
                document.getElementById("main-rarity-icon").src = mIcon;
            }
        }

        const vidOverlay = document.getElementById("myOverlayVideo");
        const artImg = document.getElementById("myOverlayImage");
        const preferredArtMode = data.editorArtMode === 'animated' || (!data.editorArtMode && data.isVideoActive)
            ? 'animated'
            : 'static';

        const cachedStaticArt = window.isPlaceholderCardArtUrl?.(data.cardArtImage) ? '' : data.cardArtImage;
        if (cachedStaticArt && artImg) {
            artImg.src = cachedStaticArt;
            const dbArtImg = (window.getCardLayoutElement ? window.getCardLayoutElement("abs-art-img") : document.getElementById("abs-art-img"));
            if (dbArtImg) dbArtImg.src = cachedStaticArt;
        }
        if (data.cardArtVideo && !data.cardArtVideo.startsWith('blob:')) {
            const vidSource = vidOverlay?.querySelector('source');
            if (vidSource) vidSource.src = data.cardArtVideo;
            if (vidOverlay) {
                vidOverlay.removeAttribute('src');
                vidOverlay.load();
            }
            const dbArtVideo = (window.getCardLayoutElement ? window.getCardLayoutElement('abs-art-video') : document.getElementById('abs-art-video'));
            if (dbArtVideo) dbArtVideo.src = data.cardArtVideo;
        }
        if (artImg) artImg.style.display = preferredArtMode === 'static' && cachedStaticArt ? 'block' : 'none';
        // Rebuild the layered art BEFORE switchEditorArtMode runs: its
        // guards decide flat vs layered purely from these sources.
        const cleanArtRoot = window.getCardLayoutRoot?.('abs-clean');
        const layeredArtRoots = ['abs-style', 'abs-clean']
            .map(theme => window.getCardLayoutRoot?.(theme))
            .filter(Boolean);
        const cleanArtElement = id => cleanArtRoot
            ? (window.getCardLayoutElement?.(id, cleanArtRoot) || cleanArtRoot.querySelector(`[data-card-element="${id}"]`))
            : document.getElementById(id);
        const applyLayerArt = (id, entry) => {
            if (!entry?.src) return;
            const el = cleanArtElement(id);
            if (!el) return;
            delete el.dataset.failed;
            const src = window.resolveImportedAssetUrl
                ? window.resolveImportedAssetUrl(entry.src, '', window.currentCustomCardAssetBaseUrl)
                : entry.src;
            el.src = src;
            if (entry.official) el.dataset.officialCardArt = 'true';
        };
        const savedLayers = data.layerArt || null;
        const officialCharacterId = value => {
            const source = String(value || '');
            const match = source.match(/(?:dokkaninfo\.com\/assets\/japan\/character\/card\/|\/card\/)(\d+)\/card_\1_character\.png/i);
            return match?.[1] || '';
        };
        const generatedBackgroundId = value => {
            const source = String(value || '');
            const match = source.match(/(?:^|\/)assets\/card-art\/backgrounds\/(\d+)\/card_bg_\1\.png(?:[?#]|$)/i);
            return match?.[1] || '';
        };
        const savedCharacterId = officialCharacterId(savedLayers?.char?.src);
        const savedBackgroundId = generatedBackgroundId(savedLayers?.bg?.src);
        const flatOfficialCharacterId = officialCharacterId(cachedStaticArt);
        // Earlier builds read duplicate art IDs with document.getElementById,
        // so a custom card could inherit an unrelated hidden official layer
        // set. Recognize that legacy signature and allow the custom flat art
        // to render instead of requesting the missing generated background.
        const staleForeignOfficialLayers = window.currentCardSource === 'custom'
            && savedCharacterId
            && savedCharacterId === savedBackgroundId
            && savedCharacterId !== flatOfficialCharacterId
            && savedLayers?.char?.official !== true
            && savedLayers?.bg?.official !== true
            && !String(savedLayers?.bg?.src || '').startsWith(window.currentCustomCardAssetBaseUrl || '\u0000');
        const layersToRestore = staleForeignOfficialLayers ? null : savedLayers;
        // Layered art is an ABS.Clean-only presentation detail. Clear both
        // ABS roots so a legacy snapshot cannot retain a hidden foreign layer
        // after rehydration; the selected theme receives its flat art below.
        layeredArtRoots.forEach(root => {
            ['abs-art-bg', 'abs-art-char', 'abs-art-effect'].forEach(id => {
                const el = window.getCardLayoutElement?.(id, root) || root.querySelector(`[data-card-element="${id}"]`);
                if (!el) return;
                el.removeAttribute('src');
                el.removeAttribute('data-failed');
                el.removeAttribute('data-official-card-art');
                el.style.display = 'none';
            });
        });
        if (layersToRestore && (layersToRestore.bg || layersToRestore.char || layersToRestore.effect)) {
            applyLayerArt('abs-art-bg', layersToRestore.bg);
            applyLayerArt('abs-art-char', layersToRestore.char);
            applyLayerArt('abs-art-effect', layersToRestore.effect);
        } else if (window.currentCardSource === 'official' && cachedStaticArt && /^https?:/i.test(cachedStaticArt) && /(?:_character|character\.png)/i.test(cachedStaticArt)) {
            // Legacy autosaves predate layerArt: derive the siblings from the
            // flat character URL (same pattern the importer uses). The bg
            // guess only holds for non-transfer cards, so it is skipped for
            // transfer folders; a wrong guess would just mark that layer
            // failed while character + effect still restore.
            const folderMatch = cachedStaticArt.match(/\/card\/(\d+)\//i);
            const folderNumber = folderMatch ? Number(folderMatch[1]) : 0;
            if (folderNumber > 0) {
                const folder = String(folderMatch[1]);
                const base = cachedStaticArt.slice(0, cachedStaticArt.lastIndexOf('/') + 1);
                const isTransferFolder = folderNumber >= 4000000 && folderNumber < 5000000;
                applyLayerArt('abs-art-char', { src: cachedStaticArt, official: true });
                applyLayerArt('abs-art-effect', { src: `${base}card_${folder}_effect.png`, official: true });
                if (!isTransferFolder) applyLayerArt('abs-art-bg', { src: `${base}card_${folder}_bg.png`, official: true });
            }
        }
        if (vidOverlay) {
            vidOverlay.style.display = preferredArtMode === 'animated' && data.cardArtVideo ? 'block' : 'none';
            if (vidOverlay.style.display === 'block') vidOverlay.play().catch(() => {});
            else vidOverlay.pause();
        }

        if (data.formsData) {
            const formElements = document.querySelectorAll("#forms-container .dokkan-card");
            window.extractedCutins = [];
            
            formElements.forEach((formEl, idx) => {
                if (data.formsData[idx]) {
                    const img = formEl.querySelector('.form-image');
                    if (img && data.formsData[idx].imageSrc) {
                        img.src = data.formsData[idx].imageSrc;
                        if (data.formsData[idx].imageExportName) { img.setAttribute('data-export-name', data.formsData[idx].imageExportName); }
                    }
                    if (data.formsData[idx].thumbSrc) {
                        formEl.setAttribute('data-thumb-src', data.formsData[idx].thumbSrc);
                    }
                    const nameSpan = formEl.querySelector('.form-name-display');
                    if (nameSpan && data.formsData[idx].name) {
                        nameSpan.innerText = data.formsData[idx].name;
                        nameSpan.style.fontWeight = "normal";
                    }
                }
            });
        }

        if (data.passiveName) {
            const passiveInput = document.getElementById('input-passive-name-sidebar');
            if (passiveInput) passiveInput.value = data.passiveName;
            
            const passiveDisplay = document.querySelector('.passive-name-display');
            if (passiveDisplay) passiveDisplay.innerText = data.passiveName;
        }

        if (data.passiveHeaderIconsOverride !== undefined) {
            window.passiveHeaderIconsOverride = data.passiveHeaderIconsOverride;
        }

        // Restore the actual theme (including abs.clean/SBA).  Calling only
        // toggleCardTheme for abs.clean leaves its LWF type glow unmounted on
        // reload because the clean-theme class is applied afterwards.
        if (window.currentCardThemeVariant === 'sba' || window.currentCardThemeVariant === 'abs.clean' || window.currentCardThemeVariant === 'abs-clean') {
            window.switchCardTheme?.('sba');
        } else if (data.themeStyle === 'abs-style') {
            window.toggleCardTheme(true);
        } else {
            window.toggleCardTheme(false);
        }

        window.updateIdentity(); 
        window.calcFromMin('hp'); 
        window.calcFromMin('atk'); 
        window.calcFromMin('def');

        window.refreshSADropdown();
        window.refreshActiveDropdown(); 

        if (document.querySelectorAll('.sa-block').length > 0) {
            const sel = document.getElementById('sa-selector');
            if (sel) sel.value = "0";
            if (window.handleSASelection) window.handleSASelection();
        }

        window.refreshFormList();
        window.updateCardDisplay(); 
        window.renderEditorSkillsInDokkanInfo?.();
        window.switchEditorArtMode?.(preferredArtMode);
        // Rebuild imported card-background LWFs after the cached artwork and
        // theme have been restored.  The player cannot survive a page reload.
        window.scheduleEditorLwfHydration?.();

        return true;
    } catch (err) {
        console.error("Cache restoration failed:", err);
        return false;
    }
};


