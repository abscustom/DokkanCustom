/* ==========================================================================
   absCustom - Dokkan LWF Pack Bridge (SEZA Flames, Domains & Card Backgrounds)
   ========================================================================== */

import { LwfPackPlayer, extractSheetNames, parseLwfTextures } from './lwf-pack.js';

// GLOBAL ENGINE PATCH: PERMANENTLY PREVENT LWF FROM INJECTING BLACK BACKGROUNDS
if (typeof window !== 'undefined' && window.LWF) {
    if (window.LWF.CanvasRendererFactory) {
        window.LWF.CanvasRendererFactory.prototype.setBackgroundColor = function() {
            this.clearColor = null;
            if (this.stage) {
                this.stage.style.setProperty('background', 'transparent', 'important');
                this.stage.style.setProperty('background-color', 'transparent', 'important');
            }
        };
        window.LWF.CanvasRendererFactory.prototype.z$Hc = function() {
            this.clearColor = null;
            if (this.stage) {
                this.stage.style.setProperty('background', 'transparent', 'important');
                this.stage.style.setProperty('background-color', 'transparent', 'important');
            }
        };
    }
    if (window.LWF.WebkitCSSRendererFactory) {
        window.LWF.WebkitCSSRendererFactory.prototype.setBackgroundColor = function() {
            if (this.stage) {
                this.stage.style.setProperty('background', 'transparent', 'important');
                this.stage.style.setProperty('background-color', 'transparent', 'important');
            }
        };
        window.LWF.WebkitCSSRendererFactory.prototype.z$Hc = function() {
            if (this.stage) {
                this.stage.style.setProperty('background', 'transparent', 'important');
                this.stage.style.setProperty('background-color', 'transparent', 'important');
            }
        };
    }
    if (window.LWF.LWF) {
        window.LWF.LWF.prototype.setBackgroundColor = function() {};
        window.LWF.LWF.prototype.z$Hc = function() {};
    }
}

const DOKKAN_SEZA_MOVIES = {
    'agl': 'ef_001',
    'teq': 'ef_002',
    'int': 'ef_003',
    'str': 'ef_004',
    'phy': 'ef_005'
};

const activePlayers = new Map();
let cachedSezaFiles = null;
let cachedDokkanModeFiles = null;
let cachedDokkanModeLightningFiles = null;
let cachedTypeArrowFiles = null;

// Helper: Converts pure black RGB into transparent alpha
async function makeSheetTransparent(imageBlob) {
    const img = await new Promise((resolve, reject) => {
        const image = new Image();
        const imageUrl = URL.createObjectURL(imageBlob);
        image.onload = () => {
            URL.revokeObjectURL(imageUrl);
            resolve(image);
        };
        image.onerror = (error) => {
            URL.revokeObjectURL(imageUrl);
            reject(error);
        };
        image.src = imageUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const max = Math.max(r, g, b);
        data[i + 3] = max;
    }

    ctx.putImageData(imgData, 0, 0);
    return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}

async function fetchSezaPackFiles() {
    if (cachedSezaFiles) return cachedSezaFiles;

    const folder = 'assets/effects/super-eza/effect/super_optimal_eff/';
    
    try {
        const [lwfRes, s1Res, s2Res] = await Promise.all([
            fetch(`${folder}super_optimal_eff.lwf`),
            fetch(`${folder}super_optimal_eff-1.png`),
            fetch(`${folder}super_optimal_eff-2.png`)
        ]);

        if (!lwfRes.ok || !s1Res.ok || !s2Res.ok) {
            throw new Error("SEZA LWF pack files not found in " + folder);
        }

        const lwfBlob = await lwfRes.blob();
        const s1BlobRaw = await s1Res.blob();
        const s2BlobRaw = await s2Res.blob();

        const [s1Blob, s2Blob] = await Promise.all([
            makeSheetTransparent(s1BlobRaw),
            makeSheetTransparent(s2BlobRaw)
        ]);

        cachedSezaFiles = [
            new File([lwfBlob], "super_optimal_eff.lwf"),
            new File([s1Blob], "super_optimal_eff-1.png"),
            new File([s2Blob], "super_optimal_eff-2.png")
        ];

        return cachedSezaFiles;
    } catch (e) {
        console.warn("Dokkan SEZA LWF Fetch Error:", e);
        return null;
    }
}

async function fetchDokkanModePackFiles(packType = 'aura') {
    if (packType === 'lightning') {
        if (cachedDokkanModeLightningFiles) return cachedDokkanModeLightningFiles;
        const folder = 'assets/effects/dokkan-mode-lightning/';
        const names = [
            'dokkan_mode.lwf',
            'dokkan_mode-1.png',
            'dokkan_mode-2.png',
            'dokkan_mode-3.png',
            'mask_bk.png'
        ];
        try {
            const responses = await Promise.all(names.map((name) => fetch(`${folder}${name}`)));
            const missingIndex = responses.findIndex((response) => !response.ok);
            if (missingIndex >= 0) {
                throw new Error(`Dokkan Mode Lightning file not found: ${folder}${names[missingIndex]}`);
            }
            const blobs = await Promise.all(responses.map((response) => response.blob()));
            const preparedBlobs = await Promise.all(blobs.map((blob, index) => (
                names[index] === 'mask_bk.png' ? makeSheetTransparent(blob) : blob
            )));
            cachedDokkanModeLightningFiles = preparedBlobs.map((blob, index) => new File([blob], names[index]));
            return cachedDokkanModeLightningFiles;
        } catch (error) {
            console.warn('Dokkan Mode Lightning LWF Fetch Error:', error);
            return null;
        }
    }

    if (cachedDokkanModeFiles) return cachedDokkanModeFiles;

    const folder = 'assets/effects/dokkan-mode/';
    const names = [
        'dokkan_mode.lwf',
        'dokkan_mode-1.png',
        'dokkan_mode-2.png',
        'dokkan_mode-3.png',
        'mask_bk.png'
    ];

    try {
        const responses = await Promise.all(names.map((name) => fetch(`${folder}${name}`)));
        const missingIndex = responses.findIndex((response) => !response.ok);
        if (missingIndex >= 0) {
            throw new Error(`Dokkan Mode file not found: ${folder}${names[missingIndex]}`);
        }

        const blobs = await Promise.all(responses.map((response) => response.blob()));
        const preparedBlobs = await Promise.all(blobs.map((blob, index) => (
            names[index] === 'mask_bk.png' ? makeSheetTransparent(blob) : blob
        )));
        cachedDokkanModeFiles = preparedBlobs.map((blob, index) => new File([blob], names[index]));
        return cachedDokkanModeFiles;
    } catch (error) {
        console.warn('Dokkan Mode LWF Fetch Error:', error);
        return null;
    }
}


async function fetchTypeArrowPackFiles() {
    if (cachedTypeArrowFiles) return cachedTypeArrowFiles;

    const folder = 'assets/ui/type-arrows/';
    const names = [
        'type_arrow_icon.lwf',
        'cha_type_down_icon_ef_01.png',
        'cha_type_icon.png',
        'type_arrow_icon.png',
        'cha_type_up_icon_ef_01.png'
    ];

    try {
        const responses = await Promise.all(names.map((name) => fetch(folder + name)));
        const missingIndex = responses.findIndex((res) => !res.ok);
        if (missingIndex >= 0) {
            throw new Error('Type Arrow file not found: ' + folder + names[missingIndex]);
        }

        const blobs = await Promise.all(responses.map((res) => res.blob()));
        cachedTypeArrowFiles = blobs.map((blob, idx) => new File([blob], names[idx]));
        return cachedTypeArrowFiles;
    } catch (err) {
        console.warn('Type Arrow LWF Fetch Error:', err);
        return null;
    }
}

const DokkanLWF = {

    async attachTypeArrowEffect(targetContainer, cardType = 'agl', isAdvantage = true, options = {}) {
        if (!targetContainer) return;
        const targetMovie = options.movie || 'ef_003';
        const movieScale = Math.max(1, Number(options.scale) || 1);
        const readyClass = String(options.readyClass || '');
        // The game effect has independent back-light and face-highlight clips.
        // Keep their canvases separate so ABS Clean can sandwich the static
        // type emblem between them without changing any other theme.
        const layer = String(options.layer || 'back').toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'back';
        if (readyClass) targetContainer.classList.remove(readyClass);

        let canvas = targetContainer.querySelector(`.type-arrow-lwf-canvas[data-lwf-layer="${layer}"]`);
        // Adopt the single-canvas implementation used before layered effects
        // were introduced, preserving an already decoded LWF on refresh.
        if (!canvas && layer === 'back') {
            canvas = targetContainer.querySelector('.type-arrow-lwf-canvas:not([data-lwf-layer])');
        }
        if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.className = 'type-arrow-lwf-canvas';
            canvas.width = 130;
            canvas.height = 130;
            targetContainer.appendChild(canvas);
        }
        canvas.dataset.lwfLayer = layer;
        canvas.classList.toggle('type-arrow-lwf-front-canvas', layer === 'front');

        const canvasId = canvas.id || ('type_arrow_lwf_' + Math.random().toString(36).substr(2, 9));
        canvas.id = canvasId;

        const playbackRate = options.playbackRate !== undefined
            ? Math.max(0.05, Number(options.playbackRate) || 1)
            : 0.5;

        const attachKey = `type-arrow:${layer}:${String(cardType || 'agl').toLowerCase()}:${targetMovie}:${isAdvantage ? 'adv' : 'dis'}:${movieScale}:${playbackRate}`;
        if (canvas.dataset.lwfLoading === attachKey) return;
        if (canvas.dataset.lwfReady === 'true' && canvas.dataset.lwfKey === attachKey && activePlayers.has(canvasId)) {
            const existingPlayer = activePlayers.get(canvasId);
            if (existingPlayer) existingPlayer.playbackRate = playbackRate;
            if (readyClass) targetContainer.classList.add(readyClass);
            this.play(canvasId);
            return;
        }

        this.destroy(canvasId);
        canvas.dataset.lwfLoading = attachKey;

        try {
            const files = await fetchTypeArrowPackFiles();
            if (!files) return;

            const player = new LwfPackPlayer(canvas, () => {}, { resourceKey: 'dokkan-type-arrow-pack' });
            player.loopMovie = true;
            player.playbackRate = playbackRate;

            const ingested = player.ingestFiles(files);
            if (!ingested.lwfFile) return;

            const check = await player.prepare(ingested.lwfFile);
            if (!check.ok) return;

            await player.load();

            if (player.lwf && player.lwf.rendererFactory) {
                player.lwf.rendererFactory.clearColor = null;
            }

            if (player.movies.includes(targetMovie)) {
                player.setMovie(targetMovie, { play: true });
                player.movie?.scaleTo?.(movieScale, movieScale);
                canvas.dataset.lwfReady = 'true';
                canvas.dataset.lwfKey = attachKey;
                if (readyClass) targetContainer.classList.add(readyClass);
                activePlayers.set(canvasId, player);
            } else if (player.movies.length > 0) {
                const fallbackMovie = player.movies.find(m => m === 'ef_003' || m === 'ef_002') || player.movies[0];
                player.setMovie(fallbackMovie, { play: true });
                player.movie?.scaleTo?.(movieScale, movieScale);
                canvas.dataset.lwfReady = 'true';
                canvas.dataset.lwfKey = attachKey;
                if (readyClass) targetContainer.classList.add(readyClass);
                activePlayers.set(canvasId, player);
            }
        } catch (err) {
            console.error('Dokkan Type Arrow LWF Player Error:', err);
        } finally {
            if (canvas.dataset.lwfLoading === attachKey) delete canvas.dataset.lwfLoading;
        }
    },

    pause(canvasId) {
        if (activePlayers.has(canvasId)) {
            const player = activePlayers.get(canvasId);
            try { player.pause(); } catch(e) {}
            const canvas = document.getElementById(canvasId);
            if (canvas) canvas.dataset.lwfPlaying = 'false';
        }
    },

    play(canvasId) {
        if (activePlayers.has(canvasId)) {
            const player = activePlayers.get(canvasId);
            try { player.play(); } catch(e) {}
            const canvas = document.getElementById(canvasId);
            if (canvas) canvas.dataset.lwfPlaying = 'true';
        }
    },

    restart(canvasId, { play = true } = {}) {
        if (!activePlayers.has(canvasId)) return false;
        const player = activePlayers.get(canvasId);
        try {
            const startFrame = Number(player.loopStartFrame) > 0 ? Number(player.loopStartFrame) : 1;
            if (typeof player.seekFrame === 'function') player.seekFrame(startFrame, { play });
            else if (play) player.play();
            else player.pause();
            const canvas = document.getElementById(canvasId);
            if (canvas) canvas.dataset.lwfPlaying = play ? 'true' : 'false';
            return true;
        } catch(e) {
            return false;
        }
    },

    togglePlay(canvasId) {
        if (activePlayers.has(canvasId)) {
            const player = activePlayers.get(canvasId);
            try {
                if (player.playing) {
                    player.pause();
                    return false;
                } else {
                    player.play();
                    return true;
                }
            } catch(e) {}
        }
        return false;
    },

    isPlaying(canvasId) {
        if (activePlayers.has(canvasId)) {
            const player = activePlayers.get(canvasId);
            return !!(player && player.playing);
        }
        return false;
    },

    getFrameState(canvasId) {
        const player = activePlayers.get(canvasId);
        return player?.getFrameState?.() || null;
    },

    destroy(canvasId) {
        if (activePlayers.has(canvasId)) {
            const player = activePlayers.get(canvasId);
            try {
                player.pause();
                player.clear();
            } catch(e) {}
            activePlayers.delete(canvasId);
        }
        const canvas = document.getElementById(canvasId);
        if (canvas) canvas.dataset.lwfPlaying = 'false';
    },

    async attachSezaFlameBorder(targetContainer, cardType = 'agl') {
        if (!targetContainer) return;

        const cType = (cardType || 'agl').toLowerCase();
        const movieName = DOKKAN_SEZA_MOVIES[cType] || 'ef_001';

        let canvas = targetContainer.querySelector('.seza-lwf-border-canvas');
        if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.className = 'seza-lwf-border-canvas';
            canvas.width = 640;
            canvas.height = 1136;
            canvas.style.setProperty('background', 'transparent', 'important');
            canvas.style.setProperty('background-color', 'transparent', 'important');
            targetContainer.appendChild(canvas);
        }

        const canvasId = canvas.id || `seza_lwf_${Math.random().toString(36).substr(2, 9)}`;
        canvas.id = canvasId;

        const attachKey = `seza:${cType}:${movieName}`;
        if (canvas.dataset.lwfLoading === attachKey) return;
        if (canvas.dataset.lwfReady === 'true' && canvas.dataset.lwfKey === attachKey && activePlayers.has(canvasId)) {
            this.play(canvasId);
            return;
        }

        this.destroy(canvasId);
        canvas.dataset.lwfLoading = attachKey;

        try {
            const files = await fetchSezaPackFiles();
            if (!files) return;

            const player = new LwfPackPlayer(canvas, () => {});
            player.loopMovie = true;

            const ingested = player.ingestFiles(files);
            if (!ingested.lwfFile) return;

            const check = await player.prepare(ingested.lwfFile);
            if (!check.ok) return;

            await player.load();

            if (player.lwf && player.lwf.rendererFactory) {
                player.lwf.rendererFactory.clearColor = null;
            }

            const targetMovieIndex = player.movies.indexOf(movieName);
            if (targetMovieIndex >= 0) {
                player.setMovie(movieName, { play: true });
                canvas.dataset.lwfReady = 'true';
                canvas.dataset.lwfKey = attachKey;
                activePlayers.set(canvasId, player);
            }
        } catch (err) {
            console.error("Dokkan SEZA LWF Player Error:", err);
        } finally {
            if (canvas.dataset.lwfLoading === attachKey) delete canvas.dataset.lwfLoading;
        }
    },

    async attachDokkanModeLrEffect(canvas) {
        if (!canvas || canvas.dataset.lwfLoading === 'true') return false;

        const isLightning = canvas.classList.contains('sba-lr-lwf-lightning-canvas') || canvas.dataset.lwfPack === 'lightning';
        const prefix = isLightning ? 'sba_lr_lightning_' : 'sba_lr_lwf_';
        const canvasId = canvas.id || `${prefix}${Math.random().toString(36).slice(2, 11)}`;
        canvas.id = canvasId;

        if (activePlayers.has(canvasId)) {
            this.play(canvasId);
            return true;
        }

        canvas.dataset.lwfLoading = 'true';
        const requestToken = Math.random().toString(36).slice(2);
        canvas.dataset.lwfRequest = requestToken;

        const files = await fetchDokkanModePackFiles(isLightning ? 'lightning' : 'aura');
        if (!files || !canvas.isConnected || canvas.dataset.lwfRequest !== requestToken) {
            delete canvas.dataset.lwfLoading;
            return false;
        }

        let player = null;
        try {
            player = new LwfPackPlayer(canvas, () => {}, {
                resourceKey: isLightning ? 'dokkan-mode-ef-002-lightning' : 'dokkan-mode-ef-002-aura',
                // Lightning sheets contain their own authored translucent glow.
                // Luma reduction is useful for dark aura plates, but it removes
                // most of the electric layer's low-alpha pixels at card scale.
                disableAdditiveReduction: isLightning
            });
            player.loopMovie = true;
            player.loopStartFrame = 22;
            player.loopEndFrame = 46;
            player.playbackRate = isLightning ? 0.38 : 0.48;
            player.waitForNestedMoviesAtEnd = true;

            const ingested = player.ingestFiles(files);
            if (!ingested.lwfFile) throw new Error('dokkan_mode.lwf was not ingested');

            const check = await player.prepare(ingested.lwfFile);
            if (!check.ok) {
                throw new Error(`Dokkan Mode pack is missing: ${check.missing.join(', ')}`);
            }

            if (!canvas.isConnected || canvas.dataset.lwfRequest !== requestToken) {
                player.clear();
                return false;
            }

            await player.load();
            if (!canvas.isConnected || canvas.dataset.lwfRequest !== requestToken) {
                player.clear();
                return false;
            }

            if (player.lwf?.rendererFactory) player.lwf.rendererFactory.clearColor = null;
            if (!player.setMovie('ef_002', { play: true })) {
                throw new Error('Movie ef_002 is not present in dokkan_mode.lwf');
            }
            player.movie?.scaleTo?.(2.85, 2.85);
            player.seekFrame?.(player.loopStartFrame, { play: true });

            activePlayers.set(canvasId, player);
            canvas.dataset.lwfReady = 'true';
            canvas.dataset.lwfPlaying = 'true';
            canvas.dataset.lwfMovie = 'ef_002';
            canvas.dataset.lwfMovieScale = '2.85';
            canvas.dataset.lwfLoop = '22-46';
            canvas.dataset.lwfSpeed = String(player.playbackRate);
            return true;
        } catch (error) {
            try { player?.clear?.(); } catch (clearError) {}
            console.error('Dokkan Mode LR LWF Player Error:', error);
            return false;
        } finally {
            if (canvas.dataset.lwfRequest === requestToken) {
                delete canvas.dataset.lwfLoading;
            }
        }
    },

    async attachFieldLwf(canvas, rawFieldId) {
        if (!canvas || !rawFieldId) return;

        const numId = parseInt(rawFieldId, 10);
        let fieldId = numId;

        if (numId > 0 && numId < 100) {
            fieldId = 3000 + (numId - 1);
        }

        const canvasId = canvas.id || `field_lwf_${fieldId}`;
        canvas.id = canvasId;

        this.destroy(canvasId);

        const candidateFolders = [
            `assets/effects/domains/lwf_bg/${fieldId}/`,
            `assets/effects/domains/lwf_bg/${numId}/`,
            `./assets/effects/domains/lwf_bg/${fieldId}/`,
            `./assets/effects/domains/lwf_bg/${numId}/`
        ];

        let lwfBlob = null;
        let lwfFileName = "";
        let matchedFolder = "";

        const lwfNamesToTry = [
            `lwf_bg_${fieldId}.lwf`,
            `lwf_bg_${numId}.lwf`,
            `field_bg_${fieldId}.lwf`,
            `field_bg_${numId}.lwf`,
            `bg_${fieldId}.lwf`,
            `bg_${numId}.lwf`,
            `${fieldId}.lwf`,
            `${numId}.lwf`,
            `bg.lwf`
        ];

        for (const folder of candidateFolders) {
            for (const name of lwfNamesToTry) {
                try {
                    const res = await fetch(`${folder}${name}`);
                    if (res.ok) {
                        lwfBlob = await res.blob();
                        lwfFileName = name;
                        matchedFolder = folder;
                        break;
                    }
                } catch(e) {}
            }
            if (lwfBlob) break;
        }

        if (!lwfBlob) return;

        try {
            const lwfBytes = new Uint8Array(await lwfBlob.arrayBuffer());
            let textureNames = extractSheetNames(lwfBytes) || [];
            
            if (!textureNames.length) {
                const parsed = parseLwfTextures(lwfBytes);
                if (parsed && parsed.length) {
                    textureNames = parsed.map(t => t.filename).filter(Boolean);
                }
            }

            if (!textureNames.length) {
                textureNames = [1, 2, 3, 4, 5, 6, 7, 8].map(i => `lwf_bg_${fieldId}-${i}.png`);
            }

            const sheetFiles = [];
            const loadedSet = new Set();

            for (const rawName of textureNames) {
                const baseName = rawName.replace(/\\/g, '/').split('/').pop();
                if (!baseName || loadedSet.has(baseName.toLowerCase())) continue;

                const variants = [
                    baseName,
                    baseName.replace('-', '_'),
                    baseName.replace('_', '-'),
                    `lwf_bg_${fieldId}-${baseName.match(/\d+/)?.[0] || '1'}.png`,
                    `lwf_bg_${fieldId}_${baseName.match(/\d+/)?.[0] || '1'}.png`,
                    `lwf_bg_${numId}-${baseName.match(/\d+/)?.[0] || '1'}.png`,
                    `lwf_bg_${numId}_${baseName.match(/\d+/)?.[0] || '1'}.png`
                ];

                let sheetBlob = null;
                for (const variant of [...new Set(variants)]) {
                    try {
                        const sRes = await fetch(`${matchedFolder}${variant}`);
                        if (sRes.ok) {
                            sheetBlob = await sRes.blob();
                            break;
                        }
                    } catch(e) {}
                }

                if (sheetBlob) {
                    sheetFiles.push(new File([sheetBlob], baseName));
                    loadedSet.add(baseName.toLowerCase());
                }
            }

            const packFiles = [
                new File([lwfBlob], lwfFileName),
                ...sheetFiles
            ];

            const player = new LwfPackPlayer(canvas, () => {});
            player.loopMovie = true;

            const ingested = player.ingestFiles(packFiles);
            if (!ingested.lwfFile) return;

            await player.prepare(ingested.lwfFile);
            await player.load();

            if (player.lwf) {
                canvas.width = player.lwf.width || 640;
                canvas.height = player.lwf.height || 1136;
            }

            if (player.movies.length > 0) {
                let targetMovie = player.movies.length >= 2 ? player.movies[1] : player.movies[0];
                const namedLoop = player.movies.find(m => /loop|field_loop|ef_002|scene_002/i.test(m));
                if (namedLoop) targetMovie = namedLoop;

                player.setMovie(targetMovie, { play: true });
                activePlayers.set(canvasId, player);
            }
        } catch (err) {
            console.warn(`[Dokkan Domain Error] (${rawFieldId}):`, err);
        }
    },

    async attachCardBgLwf(canvas, card) {
        if (!canvas || !card) return false;

        const folderId = (typeof getCardFolderId === 'function') ? getCardFolderId(card) : Math.floor(parseInt(card.id, 10) / 10) * 10;
        const parentId = (typeof getCardParentId === 'function') ? getCardParentId(card) : folderId;
        const parentFolderId = Math.floor(parentId / 10) * 10;

        const canvasId = canvas.id || `card_bg_lwf_${folderId}`;
        canvas.id = canvasId;

        this.destroy(canvasId);

        const targetIds = [...new Set([folderId, parentFolderId])];
        const candidateFolders = [];
        targetIds.forEach(id => {
            candidateFolders.push(`./assets/card-art/backgrounds/${id}/`);
            candidateFolders.push(`./assets/card-art/cards/${id}/`);
        });

        let lwfBlob = null;
        let lwfFileName = "";
        let matchedFolder = "";
        let matchedId = folderId;

        for (const folder of candidateFolders) {
            for (const id of targetIds) {
                const lwfNamesToTry = [
                    `card_bg_${id}.lwf`,
                    `card_${id}_bg.lwf`,
                    `bg_${id}.lwf`,
                    `card_${id}.lwf`,
                    `${id}.lwf`,
                    `bg.lwf`
                ];

                for (const name of lwfNamesToTry) {
                    try {
                        const res = await fetch(`${folder}${name}`);
                        if (res.ok) {
                            lwfBlob = await res.blob();
                            lwfFileName = name;
                            matchedFolder = folder;
                            matchedId = id;
                            break;
                        }
                    } catch(e) {}
                }
                if (lwfBlob) break;
            }
            if (lwfBlob) break;
        }

        if (!lwfBlob) return false;

        try {
            const lwfBytes = new Uint8Array(await lwfBlob.arrayBuffer());
            let textureNames = extractSheetNames(lwfBytes) || [];
            if (!textureNames.length) {
                const parsed = parseLwfTextures(lwfBytes);
                if (parsed && parsed.length) textureNames = parsed.map(t => t.filename).filter(Boolean);
            }
            if (!textureNames.length) {
                textureNames = Array.from({ length: 64 }, (_, i) => `card_${matchedId}_${i}.png`);
            }

            const sheetFiles = [];
            const loadedSet = new Set();

            for (const rawName of textureNames) {
                const baseName = rawName.replace(/\\/g, '/').split('/').pop();
                if (!baseName || loadedSet.has(baseName.toLowerCase())) continue;

                const variants = [
                    baseName,
                    baseName.replace('-', '_'),
                    baseName.replace('_', '-'),
                    `card_bg_${matchedId}-${baseName.match(/\d+/)?.[0] || '1'}.png`,
                    `card_bg_${matchedId}_${baseName.match(/\d+/)?.[0] || '1'}.png`,
                    `card_${matchedId}_bg_${baseName.match(/\d+/)?.[0] || '1'}.png`
                ];

                let sheetBlob = null;
                for (const variant of [...new Set(variants)]) {
                    try {
                        const sRes = await fetch(`${matchedFolder}${variant}`);
                        if (sRes.ok) {
                            sheetBlob = await sRes.blob();
                            break;
                        }
                    } catch(e) {}
                }

                if (sheetBlob) {
                    sheetFiles.push(new File([sheetBlob], baseName));
                    loadedSet.add(baseName.toLowerCase());
                }
            }

            const packFiles = [
                new File([lwfBlob], lwfFileName),
                ...sheetFiles
            ];

            const player = new LwfPackPlayer(canvas, () => {});
            player.loopMovie = true;

            const ingested = player.ingestFiles(packFiles);
            if (!ingested.lwfFile) return false;

            await player.prepare(ingested.lwfFile);
            await player.load();

            if (player.lwf) {
                canvas.width = player.lwf.width || 426;
                canvas.height = player.lwf.height || 568;
            }

            if (player.movies.length > 0) {
                const targetMovie = player.movies.find(m => /loop|bg|main|scene|ef_001/i.test(m)) || player.movies[0];
                player.setMovie(targetMovie, { play: true });
                activePlayers.set(canvasId, player);
                return true;
            }
            return false;
        } catch (err) {
            console.warn(`[Card BG LWF Error] (${matchedId}):`, err);
            return false;
        }
    }
};

window.DokkanLWF = DokkanLWF;
// The editor's cache/theme scripts are classic scripts while this bridge is a
// deferred module.  Let them run their reload hydration pass only after the
// player API has been published, avoiding a first-render race.
if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('dokkan-lwf-ready'));
}

/* ==========================================================================
   GLOBAL DOMAIN PREVIEW MODAL CONTROLLER
   ========================================================================== */

window.openDomainModal = function(rawFieldId, title = "Domain Animation") {
    const modal = document.getElementById('abs-domain-modal-overlay');
    const canvas = document.getElementById('abs-art-domain-canvas');
    const titleEl = document.getElementById('abs-domain-modal-title');

    if (!modal || !canvas) return;

    if (titleEl && title) {
        titleEl.textContent = `${title} (Domain Animation)`;
    }

    modal.style.display = 'flex';

    // Attach & start playing LWF inside the popout modal viewport
    DokkanLWF.attachFieldLwf(canvas, rawFieldId).then(() => {
        DokkanLWF.play('abs-art-domain-canvas');
    });
};

window.closeDomainModal = function(e) {
    if (e && e.target && e.target.closest('.abs-domain-modal-dialog') && !e.target.closest('.abs-domain-modal-close')) {
        return;
    }

    const modal = document.getElementById('abs-domain-modal-overlay');
    if (modal) modal.style.display = 'none';

    // Pause player to conserve CPU/GPU
    DokkanLWF.pause('abs-art-domain-canvas');
};
