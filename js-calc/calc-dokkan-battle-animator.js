/* ==========================================================================
   absCustom - Dokkan Super Attack Banner Engine (Direct Command Resolver)
   ========================================================================== */

import { LwfPackPlayer } from '../js-graphics/lwf-pack.js';

const DUMMY_PNG_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

// Manifest for battle_140000 (Super Attack Banners)
const MANIFEST_140000 = [
    'battle_140000_0.png',
    'battle_140000_1.png',
    'Images_ex_kakutei.png',
    'Images_ex_kakutei_blur.png',
    'Images_ing_dokkan_kakutei-1.png',
    'Images_sp2_atk_str-1.png',
    'Images_sp_atk_str-1.png',
    'Images_sp_atk_str_blur.png',
    'Images_thumb_meter_lr_0.png'
];

// Exact in-game movies
const EXACT_MOVIES = {
    regular: 'ef_014', // Regular Super Attack (SUPER ATK)
    ultra: 'ef_021',   // Ultra Super Attack (U. Super ATK)
    ex: 'ef_022'       // EX Super Attack (EX Super ATK)
};

class DokkanBattleAnimator {
    constructor() {
        this.bannerPlayer = null;
        this.additionalPlayers = new Map();
        this.bannerFiles = null;
        this.isLoaded = false;
        this.activeBannerMovie = '';
        this.playbackSpeed = 0.65;
    }

    async ensureLwfLoaded() {
        if (typeof window.LWF !== 'undefined') return true;

        return new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = 'js-graphics/lwf.js';
            script.onload = () => resolve(true);
            script.onerror = () => {
                console.error("Could not load js-graphics/lwf.js");
                resolve(false);
            };
            document.head.appendChild(script);
        });
    }

    async loadPackFiles(folderPath, lwfFileName, manifestList) {
        const basePath = folderPath.endsWith('/') ? folderPath : `${folderPath}/`;
        
        let lwfBlob = null;
        try {
            const res = await fetch(`${basePath}${lwfFileName}`);
            if (res.ok) lwfBlob = await res.blob();
        } catch (e) {}

        if (!lwfBlob) {
            console.warn(`[Dokkan Banner LWF] Could not find ${basePath}${lwfFileName}`);
            return null;
        }

        const sheetFiles = [];
        await Promise.all(manifestList.map(async (fileName) => {
            try {
                const res = await fetch(`${basePath}${fileName}`);
                if (res.ok) {
                    const blob = await res.blob();
                    sheetFiles.push(new File([blob], fileName));
                }
            } catch (e) {}
        }));

        return [
            new File([lwfBlob], lwfFileName),
            ...sheetFiles
        ];
    }

    setupPlayer(canvas) {
        const player = new LwfPackPlayer(canvas, () => {});
        player.loopMovie = true;

        canvas.style.setProperty('width', '420px', 'important');
        canvas.style.setProperty('height', '160px', 'important');
        canvas.style.setProperty('max-width', 'none', 'important');
        canvas.style.setProperty('max-height', 'none', 'important');

        const origKick = player._kickLoop.bind(player);
        player._kickLoop = () => {
            if (player._raf) return;
            player._lastTs = null;
            const tick = (ts) => {
                if (!player.playing || !player.lwf) {
                    player._raf = null;
                    return;
                }
                if (player._lastTs == null) player._lastTs = ts;
                let dt = ((ts - player._lastTs) / 1000) * this.playbackSpeed;
                player._lastTs = ts;

                try {
                    const ctx = player.canvas.getContext('2d');
                    if (ctx) ctx.clearRect(0, 0, player.canvas.width, player.canvas.height);
                    if (player.lwf.rendererFactory) player.lwf.rendererFactory.clearColor = null;

                    player.lwf.exec?.(dt);
                    player.lwf.render?.();
                } catch (e) {
                    player.pause();
                    return;
                }

                player._emitFrame();
                player._checkEnd();
                player._raf = requestAnimationFrame(tick);
            };
            player._raf = requestAnimationFrame(tick);
        };

        player._resolveImage = (rawName) => {
            let key = String(rawName || '').replace(/\\/g, '/');
            while (key.startsWith('./')) key = key.slice(2);
            while (key.startsWith('/')) key = key.slice(1);
            const base = key.split('/').pop() || key;
            const baseLow = base.toLowerCase();

            const candidates = [
                baseLow,
                key.toLowerCase(),
                baseLow.replace(/\.(png|jpe?g|webp|gif)$/i, ''),
                `images_${baseLow}`,
                baseLow.replace(/^images_/, '')
            ];

            for (const k of candidates) {
                if (player.blobUrls.has(k)) return player.blobUrls.get(k);
            }

            return DUMMY_PNG_DATA_URL;
        };

        return player;
    }

    async init() {
        const bannerCanvas = document.getElementById('res-main-sa-lwf-canvas');
        if (!bannerCanvas) return;

        await this.ensureLwfLoaded();
        if (typeof window.LWF === 'undefined') return;

        try {
            this.bannerFiles = await this.loadPackFiles('assets/battle/battle_140000/', 'battle_140000.lwf', MANIFEST_140000);
            if (this.bannerFiles) {
                this.bannerPlayer = this.setupPlayer(bannerCanvas);
                const ingested = this.bannerPlayer.ingestFiles(this.bannerFiles);
                if (ingested.lwfFile) {
                    await this.bannerPlayer.prepare(ingested.lwfFile);
                    await this.bannerPlayer.load();
                }
            }

            this.isLoaded = true;

            // Trigger calc engine recalculation to update banner instantly
            if (typeof calculateDokkanStats === 'function') {
                calculateDokkanStats();
            }

        } catch (err) {
            console.error("❌ [Dokkan Banner Error]:", err);
        }
    }

    findMovie(player, saType) {
        if (!player || !player.movies || !player.movies.length) return null;
        const movies = player.movies;

        if (saType === 'ex') {
            return movies.find(m => m.toLowerCase() === 'ef_022' || m.includes('022')) || 
                   (movies.length > 19 ? movies[19] : movies[movies.length - 1]);
        }

        if (saType === 'ultra') {
            return movies.find(m => m.toLowerCase() === 'ef_021' || m.includes('021')) || 
                   (movies.length > 18 ? movies[18] : movies[movies.length - 2]);
        }

        // Regular Super Attack
        return movies.find(m => m.toLowerCase() === 'ef_014' || m.includes('014')) || 
               (movies.length > 13 ? movies[13] : movies[0]);
    }

    /**
     * Direct Banner Switcher
     * @param {'standard' | 'ultra' | 'ex' | 'unit'} saType 
     */
    playMainBanner(saType = 'standard') {
        const bannerCanvas = document.getElementById('res-main-sa-lwf-canvas');
        const unitImg = document.getElementById('res-main-sa-unit-img');
        const container = document.querySelector('#res-main-sa-card .sa-banner-lwf-container');
        const isStatic = document.body.classList.contains('fx-static');

        // Determine correct static image based on type
        let imgSrc = 'assets/battle/super_atk_static.png';
        if (saType === 'ultra') imgSrc = 'assets/battle/u_super_atk_static.png';
        if (saType === 'ex') imgSrc = 'assets/battle/ex_super_atk_static.png';
        if (saType === 'unit') imgSrc = 'assets/battle/unit_super_atk.png';

        if (isStatic || saType === 'unit') {
            if (bannerCanvas) bannerCanvas.style.setProperty('display', 'none', 'important');
            if (unitImg) {
                if (unitImg.getAttribute('src') !== imgSrc) {
                    unitImg.src = imgSrc;
                }
                unitImg.style.setProperty('display', 'block', 'important');
                unitImg.style.setProperty('visibility', 'visible', 'important');
                unitImg.style.setProperty('opacity', '1', 'important');
            }
            if (this.bannerPlayer) {
                this.bannerPlayer.pause();
            }
            if (container) {
                container.classList.remove('banner-standard', 'banner-ultra', 'banner-ex', 'banner-unit');
                container.classList.add(`banner-${saType}`);
            }
            this.activeBannerMovie = saType;
            return;
        }

        // Standard / Ultra / EX LWF Banners
        if (unitImg) unitImg.style.setProperty('display', 'none', 'important');
        if (bannerCanvas) bannerCanvas.style.setProperty('display', 'block', 'important');

        if (!this.bannerPlayer) return;

        const targetMovie = this.findMovie(this.bannerPlayer, saType);
        if (targetMovie && targetMovie !== this.activeBannerMovie) {
            this.activeBannerMovie = targetMovie;
            this.bannerPlayer.setMovie(targetMovie, { play: true });
            this.bannerPlayer.play();

            if (container) {
                container.classList.remove('banner-standard', 'banner-ultra', 'banner-ex', 'banner-unit');
                container.classList.add(`banner-${saType}`);
            }
        }
    }

    async attachAdditionalBanner(canvasId, saType) {
        const isStatic = document.body.classList.contains('fx-static');
        const canvas = document.getElementById(canvasId);
        const imgId = canvasId.replace('lwf-canvas', 'img');
        const img = document.getElementById(imgId);

        if (isStatic) {
            if (canvas) canvas.style.setProperty('display', 'none', 'important');
            if (img) {
                img.style.setProperty('display', 'block', 'important');
                img.style.setProperty('visibility', 'visible', 'important');
                img.style.setProperty('opacity', '1', 'important');
            }
            return;
        }

        if (!canvas || !this.bannerFiles) return;

        if (img) img.style.setProperty('display', 'none', 'important');
        if (canvas) canvas.style.setProperty('display', 'block', 'important');

        let player = this.additionalPlayers.get(canvasId);

        if (!player || player.canvas !== canvas) {
            if (player) {
                try { player.pause(); player.clear(); } catch(e) {}
            }
            player = this.setupPlayer(canvas);
            const ingested = player.ingestFiles(this.bannerFiles);
            if (ingested.lwfFile) {
                await player.prepare(ingested.lwfFile);
                await player.load();
                this.additionalPlayers.set(canvasId, player);
            }
        }

        const targetMovie = this.findMovie(player, (saType === 'ex' ? 'ex' : 'standard'));
        if (targetMovie && player) {
            player.setMovie(targetMovie, { play: true });
            player.play();
        }
    }

    syncWithCalculator() {
        if (typeof calculateDokkanStats === 'function') {
            calculateDokkanStats();
        }
    }
}

const battleAnimator = new DokkanBattleAnimator();
window.DokkanBattleAnimator = battleAnimator;

window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        battleAnimator.init();
    }, 300);
});
