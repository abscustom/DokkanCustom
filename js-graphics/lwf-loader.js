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

// Helper: Converts pure black RGB into transparent alpha
async function makeSheetTransparent(imageBlob) {
    const img = await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = URL.createObjectURL(imageBlob);
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

    const folder = 'assets/super_eza/effect/super_optimal_eff/';
    
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

const DokkanLWF = {
    pause(canvasId) {
        if (activePlayers.has(canvasId)) {
            const player = activePlayers.get(canvasId);
            try { player.pause(); } catch(e) {}
        }
    },

    play(canvasId) {
        if (activePlayers.has(canvasId)) {
            const player = activePlayers.get(canvasId);
            try { player.play(); } catch(e) {}
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

    destroy(canvasId) {
        if (activePlayers.has(canvasId)) {
            const player = activePlayers.get(canvasId);
            try {
                player.pause();
                player.clear();
            } catch(e) {}
            activePlayers.delete(canvasId);
        }
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

        this.destroy(canvasId);

        const files = await fetchSezaPackFiles();
        if (!files) return;

        try {
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
                activePlayers.set(canvasId, player);
            }
        } catch (err) {
            console.error("Dokkan SEZA LWF Player Error:", err);
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
            `assets/dokkan_field/lwf_bg/${fieldId}/`,
            `assets/dokkan_field/lwf_bg/${numId}/`,
            `./assets/dokkan_field/lwf_bg/${fieldId}/`,
            `./assets/dokkan_field/lwf_bg/${numId}/`
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
            candidateFolders.push(`assets/card_bg/${id}/`);
            candidateFolders.push(`./assets/card_bg/${id}/`);
            candidateFolders.push(`assets/card/${id}/`);
            candidateFolders.push(`./assets/card/${id}/`);
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
                textureNames = [1, 2, 3, 4, 5, 6, 7, 8].map(i => `card_bg_${matchedId}-${i}.png`);
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