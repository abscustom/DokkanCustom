/* ========================================================================== 
   absCustom - Manually-clocked attacker and enemy LWF layers
   ========================================================================== */

import { LwfPackPlayer } from '../js-graphics/lwf-pack.js';

const LOGICAL_STAGE_WIDTH = 852;
const LOGICAL_STAGE_HEIGHT = 1536;

export const ANIME_STEM = {
    0: 'c00_idl_front',
    1: 'c01_idl_side',
    2: 'c02_idl_back',
    3: 'c03_dash',
    4: 'c04_guard',
    5: 'c05_dam_back',
    6: 'c06_dam_side',
    7: 'c07_dam_front',
    8: 'c08_dam_roll',
    9: 'c09_01_atc_punch',
    10: 'c09_02_atc_punch',
    11: 'c09_03_atc_punch',
    12: 'c10_01_atc_kick',
    13: 'c10_02_atc_kick',
    14: 'c10_03_atc_kick',
    15: 'c13_atc_down',
    16: 'c12_atc_front',
    17: 'c15_heapup',
    18: 'c16_heapup_back',
    19: 'c17_atc_energyball',
    30: 'c18_sp_atc_01',
    31: 'c18_sp_atc_02',
};

export function clipForAnime(movieList = [], animeId = 0) {
    const raw = Number(animeId) || 0;
    const normalized = ((raw % 100) + 100) % 100;
    const preferredSide = raw >= 100 ? 'e' : 'p';
    const otherSide = preferredSide === 'e' ? 'p' : 'e';
    const candidates = [];

    if (normalized === 30 || normalized === 31) {
        const number = normalized === 30 ? '01' : '02';
        candidates.push(
            `c18_sp_atc_${preferredSide}_${number}`,
            `c18_sp_atc_${otherSide}_${number}`,
            `c18_sp_atc_${preferredSide}`,
            `c18_sp_atc_${otherSide}`,
        );
    } else if (ANIME_STEM[normalized]) {
        const stem = ANIME_STEM[normalized];
        candidates.push(`${stem}_${preferredSide}`, `${stem}_${otherSide}`, stem);
    }

    return candidates.find((name) => movieList.includes(name))
        || movieList.find((name) => name.includes('idl_front') && name.endsWith(`_${preferredSide}`))
        || movieList.find((name) => name.includes('idl_front'))
        || movieList[0]
        || null;
}

function numeric(value, fallback = 0) {
    const result = Number(value);
    return Number.isFinite(result) ? result : fallback;
}

function sample(keys, frame, fields, fallback) {
    if (!keys?.length) return fallback;
    if (frame <= keys[0].frame) return fields.map((field, index) => numeric(keys[0][field], fallback[index]));
    const last = keys[keys.length - 1];
    if (frame >= last.frame) return fields.map((field, index) => numeric(last[field], fallback[index]));

    let rightIndex = 1;
    while (rightIndex < keys.length && keys[rightIndex].frame < frame) rightIndex += 1;
    const left = keys[rightIndex - 1];
    const right = keys[rightIndex];
    const span = Math.max(1, right.frame - left.frame);
    const ratio = Math.max(0, Math.min(1, (frame - left.frame) / span));
    return fields.map((field, index) => {
        const a = numeric(left[field], fallback[index]);
        const b = numeric(right[field], a);
        return a + ((b - a) * ratio);
    });
}

function startManualMovie(player, clip) {
    if (!player || !clip || !player.setMovie(clip, { play: false })) return false;
    const movie = player.movie;
    if (!movie) return false;
    const root = player.lwf?.rootMovie;
    if (root) {
        // Battle character packs use the root only as a scene container. If
        // its own timeline advances, it can clear the attached pose after the
        // first render, leaving an apparently missing enemy/attacker sprite.
        root.active = true;
        root.playing = false;
        root.visible = true;
        root.setVisible?.(true);
    }
    player.playing = false;
    // Character LWF scenes can be attached with visibility disabled. The
    // official player explicitly enables the scene after every pose change;
    // without this, the rig loads but only flashes at its initial frame.
    movie.visible = true;
    movie.setVisible?.(true);
    movie.active = true;
    movie.playing = true;
    movie.gotoAndPlay?.(1);
    // Draw the attached scene immediately. Waiting until the next animation
    // tick can leave the sprite invisible when the Lua script changes pose and
    // display state in the same frame.
    try {
        player.lwf?.exec?.(0);
        player.lwf?.render?.();
    } catch {}
    return true;
}

function defaultBridgeUrl() {
    if (typeof window !== 'undefined') {
        const isLocal = window.location.protocol === 'file:'
            || window.location.hostname === 'localhost'
            || window.location.hostname === '127.0.0.1'
            || !window.location.hostname;
        if (isLocal) return 'http://127.0.0.1:3137';
    }
    return 'https://raw.githubusercontent.com/abscustom/DokkanCustom-animation-index/main';
}

export class CharaLayer {
    constructor({ stageStack, serverUrl = defaultBridgeUrl(), log = console.log }) {
        this.stageStack = stageStack;
        this.serverUrl = String(serverUrl).replace(/\/$/, '');
        this.log = log;
        this.characters = new Map();
        this.keyTracks = new Map();
    }

    setStage(stageStack) {
        this.stageStack = stageStack;
        for (const state of this.characters.values()) {
            if (stageStack && state.wrap.parentElement !== stageStack) stageStack.appendChild(state.wrap);
        }
    }

    setServerUrl(url) {
        this.serverUrl = String(url || defaultBridgeUrl()).replace(/\/$/, '');
    }

    clear() {
        for (const state of this.characters.values()) {
            try { state.battlePlayer?.clear?.(); } catch {}
            try { state.spPlayer?.clear?.(); } catch {}
            state.wrap?.remove?.();
        }
        this.characters.clear();
        this.keyTracks.clear();
    }

    resetPlayback() {
        for (const state of this.characters.values()) {
            state.x = -5000;
            state.y = 0;
            state.z = 0;
            state.sx = 1;
            state.sy = 1;
            state.rotation = 0;
            state.alpha = 1;
            // Dokkan starts the attacking side on screen. Older Super scripts
            // only hide the enemy at frame 0 and rely on this default, so
            // resetting both sides hidden makes their moving attacker invisible.
            state.disp = state.id === 0 ? 1 : 0;
            state.drawFront = false;
            state.loopAnime = true;
            state.stopAtEnd = false;
            state.lastClipFrame = null;
            state.wrap.style.display = state.disp ? 'block' : 'none';
            state.wrap.style.visibility = state.disp ? 'visible' : 'hidden';
            state.wrap.style.opacity = '1';
            this.applyPose(state, state.id === 0 ? 0 : 100);
            this.updateTransform(state);
        }
    }

    ensure(id) {
        const charaId = Number(id) || 0;
        if (this.characters.has(charaId)) return this.characters.get(charaId);

        const wrap = document.createElement('div');
        wrap.className = 'abs-chara-wrap';
        wrap.dataset.chara = String(charaId);
        wrap.style.position = 'absolute';
        wrap.style.left = '0';
        wrap.style.top = '0';
        wrap.style.width = '0';
        wrap.style.height = '0';
        wrap.style.pointerEvents = 'none';
        wrap.style.transformOrigin = 'center center';
        wrap.style.zIndex = String(charaId === 0 ? 202 : 200);
        this.stageStack?.appendChild(wrap);

        const auraCanvas = document.createElement('canvas');
        auraCanvas.className = 'abs-animation-layer-canvas abs-chara-canvas abs-chara-aura';
        auraCanvas.style.display = 'none';

        const battleCanvas = document.createElement('canvas');
        battleCanvas.className = 'abs-animation-layer-canvas abs-chara-canvas abs-chara-battle';
        battleCanvas.style.zIndex = '1';
        const spCanvas = document.createElement('canvas');
        spCanvas.className = 'abs-animation-layer-canvas abs-chara-canvas abs-chara-sp';
        spCanvas.style.display = 'none';
        spCanvas.style.zIndex = '2';
        wrap.append(auraCanvas, battleCanvas, spCanvas);

        const state = {
            id: charaId,
            wrap,
            auraCanvas,
            battleCanvas,
            spCanvas,
            cardData: null,
            auraPlayer: null,
            auraMovies: [],
            auraEnabled: false,
            auraScale: 1,
            auraOffsetX: 0,
            auraOffsetY: 0,
            auraIsFront: false,
            battlePlayer: null,
            battleMovies: [],
            spPlayer: null,
            spMovies: [],
            activePlayer: null,
            activeCanvas: null,
            activeClip: null,
            anime: charaId === 0 ? 0 : 100,
            x: -5000,
            y: 0,
            z: 0,
            sx: 1,
            sy: 1,
            rotation: 0,
            alpha: 1,
            disp: 0,
            drawFront: false,
            loopAnime: true,
            stopAtEnd: false,
            lastClipFrame: null,
        };
        this.characters.set(charaId, state);
        return state;
    }

    async loadPlayer(canvas, pack, fallbackName, loopMovie) {
        if (!pack?.url) return { player: null, movies: [] };
        const files = [];
        const lwfResponse = await fetch(pack.url);
        if (!lwfResponse.ok) throw new Error(`Missing ${fallbackName}`);
        files.push(new File([await lwfResponse.blob()], fallbackName));

        for (const file of pack.files || []) {
            if (!/\.(?:png|jpe?g|webp)$/i.test(file.name || '')) continue;
            const response = await fetch(file.url);
            if (!response.ok) continue;
            files.push(new File([await response.blob()], file.name));
        }

        const player = new LwfPackPlayer(canvas, () => {});
        player.loopMovie = loopMovie;
        const ingested = player.ingestFiles(files);
        if (!ingested.lwfFile) throw new Error(`No LWF file in ${fallbackName}`);
        const prepared = await player.prepare(ingested.lwfFile);
        if (prepared.missing?.length) {
            throw new Error(`Missing character atlas: ${prepared.missing.join(', ')}`);
        }
        const movies = await player.load();
        // Attack poses extend beyond the pack's small header rectangle. Add
        // transparent raster margins, preserving the original world-space scale.
        const padX = canvas.width;
        const padY = canvas.height;
        canvas.width += padX * 2;
        canvas.height += padY * 2;
        const property = player.lwf?.property;
        if (typeof property?.moveTo === 'function') property.moveTo(padX, padY);
        else if (property) { property.x = padX; property.y = padY; }
        this.centerCanvas(canvas);
        return { player, movies };
    }

    centerCanvas(canvas) {
        if (!canvas) return;
        const width = canvas.width || 1;
        const height = canvas.height || 1;
        canvas.style.position = 'absolute';
        canvas.style.left = '0';
        canvas.style.top = '0';
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        // fitNative() constrains generic effect canvases to their parent.
        // Character canvases intentionally live inside a zero-size anchor,
        // so retaining max-width/max-height:100% collapses them to 0x0.
        canvas.style.maxWidth = 'none';
        canvas.style.maxHeight = 'none';
        canvas.style.marginLeft = `${-width / 2}px`;
        canvas.style.marginTop = `${-height / 2}px`;
        canvas.style.transform = 'none';
    }

    async preloadCharacter(id, cardId) {
        const headers = this.serverUrl && false
            ? { 'ngrok-skip-browser-warning': 'true' }
            : {};
        const isStatic = !/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::|\/|$)/i.test(this.serverUrl);
        const ext = isStatic ? '.json' : '';
        const response = await fetch(`${this.serverUrl}/api/card/${Number(cardId) || 0}${ext}`, {
            cache: 'no-store',
            ...(Object.keys(headers).length ? { headers } : {})
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.found) {
            throw new Error(payload.error || `Character metadata for card ${cardId} was not found.`);
        }

        const state = this.ensure(id);
        state.cardData = payload;
        const padded = String(payload.character_id || 1).padStart(5, '0');
        const promises = [
            this.loadPlayer(state.battleCanvas, payload.battle, `battle_character_${padded}.lwf`, true),
            this.loadPlayer(state.spCanvas, payload.sp, `sp_character_${padded}_${String(payload.special_motion || 1).padStart(2, '0')}.lwf`, false),
        ];

        if (payload.aura?.effect?.files?.length) {
            const auraPack = {
                url: payload.aura.effect.files.find((f) => f.name.endsWith('.lwf'))?.url,
                files: payload.aura.effect.files,
            };
            promises.push(this.loadPlayer(state.auraCanvas, auraPack, `${payload.aura.effect.pack_name}.lwf`, true));
        }

        const results = await Promise.allSettled(promises);

        if (results[0].status === 'fulfilled') {
            state.battlePlayer = results[0].value.player;
            state.battleMovies = results[0].value.movies;
        } else {
            this.log(`Card ${cardId} battle rig: ${results[0].reason?.message || results[0].reason}`);
        }
        if (results[1].status === 'fulfilled') {
            state.spPlayer = results[1].value.player;
            state.spMovies = results[1].value.movies;
        } else {
            this.log(`Card ${cardId} SP rig: ${results[1].reason?.message || results[1].reason}`);
        }
        if (results[2]?.status === 'fulfilled') {
            state.auraPlayer = results[2].value.player;
            state.auraMovies = results[2].value.movies;
            state.auraScale = payload.aura.scale || 1;
            state.auraOffsetX = payload.aura.offset_x || 0;
            state.auraOffsetY = payload.aura.offset_y || 0;
            state.auraIsFront = Boolean(payload.aura.is_front);
            if (state.auraPlayer && state.auraMovies.length) {
                startManualMovie(state.auraPlayer, state.auraMovies[0]);
            }
            if (state.auraIsFront) {
                state.wrap.appendChild(state.auraCanvas);
            }
        }

        if (!state.battlePlayer && !state.spPlayer) {
            throw new Error(`No playable character LWF could be loaded for card ${cardId}.`);
        }
        this.applyPose(state, state.anime);
        this.log(`Character ${id} ready for card ${cardId}: battle clips=${state.battleMovies.length}, SP clips=${state.spMovies.length}.`);
        return state;
    }

    loadKeysFromCommands(commands = []) {
        this.keyTracks.clear();
        const ensureTrack = (chara) => {
            const id = Number(chara) || 0;
            if (!this.keyTracks.has(id)) {
                this.keyTracks.set(id, { move: [], scale: [], rotate: [], alpha: [] });
            }
            return this.keyTracks.get(id);
        };

        for (const command of commands) {
            const frame = numeric(command.frame);
            if (command.type === 'setMoveKey') ensureTrack(command.chara).move.push({ frame, x: command.x, y: command.y, z: command.z });
            else if (command.type === 'setScaleKey') ensureTrack(command.chara).scale.push({ frame, sx: command.sx, sy: command.sy });
            else if (command.type === 'setRotateKey') ensureTrack(command.chara).rotate.push({ frame, rotation: command.rot });
            else if (command.type === 'setAlphaKey') ensureTrack(command.chara).alpha.push({ frame, alpha: command.alpha });
        }
        for (const tracks of this.keyTracks.values()) {
            for (const keys of Object.values(tracks)) keys.sort((a, b) => a.frame - b.frame);
        }
    }

    evalAllAtFrame(frame) {
        for (const [id, tracks] of this.keyTracks.entries()) {
            const state = this.ensure(id);
            [state.x, state.y, state.z] = sample(tracks.move, frame, ['x', 'y', 'z'], [state.x, state.y, state.z]);
            [state.sx, state.sy] = sample(tracks.scale, frame, ['sx', 'sy'], [state.sx, state.sy]);
            [state.rotation] = sample(tracks.rotate, frame, ['rotation'], [state.rotation]);
            const [alpha] = sample(tracks.alpha, frame, ['alpha'], [state.alpha * 255]);
            state.alpha = Math.max(0, Math.min(1, alpha / 255));
            this.updateTransform(state);
        }
    }

    applyPose(state, animeId, stopAtEnd = false) {
        state.anime = Number(animeId) || 0;
        state.stopAtEnd = Boolean(stopAtEnd);
        state.lastClipFrame = null;
        const normalized = ((state.anime % 100) + 100) % 100;
        const useSp = (normalized === 30 || normalized === 31) && state.spPlayer;
        state.activePlayer = useSp ? state.spPlayer : state.battlePlayer;
        state.activeCanvas = useSp ? state.spCanvas : state.battleCanvas;
        state.battleCanvas.style.display = useSp ? 'none' : 'block';
        state.spCanvas.style.display = useSp ? 'block' : 'none';
        const movies = useSp ? state.spMovies : state.battleMovies;
        const clip = clipForAnime(movies, state.anime);
        const previousClip = state.activeClip;
        state.activeClip = clip;
        if (clip) {
            startManualMovie(state.activePlayer, clip);
            if (clip !== previousClip) this.log(`Character ${state.id} pose ${clip} (anime ${state.anime}).`);
        }
    }

    changeAnime(id, animeId, stopAtEnd = false) {
        this.applyPose(this.ensure(id), animeId, stopAtEnd);
    }

    setAnimeLoop(id, enabled) {
        const state = this.ensure(id);
        state.loopAnime = Boolean(Number(enabled));
        if (!state.loopAnime) state.stopAtEnd = true;
    }

    setDisp(id, display) {
        const state = this.ensure(id);
        state.disp = Number(display) ? 1 : 0;
        state.wrap.style.display = state.disp ? 'block' : 'none';
        state.wrap.style.visibility = state.disp ? 'visible' : 'hidden';
    }

    setDrawFront(id, enabled) {
        const state = this.ensure(id);
        state.drawFront = Boolean(Number(enabled));
        state.wrap.style.zIndex = String(state.drawFront ? 360 : (state.id === 0 ? 202 : 200));
    }

    setEnableAura(id, enabled) {
        const state = this.ensure(id);
        state.auraEnabled = Boolean(Number(enabled));
        if (state.auraCanvas) {
            state.auraCanvas.style.display = state.auraEnabled && state.disp ? 'block' : 'none';
        }
    }

    setLogicalHeight(height = LOGICAL_STAGE_HEIGHT) {
        // Character coordinates follow the active stage height so characters
        // and effects share the same viewport scale on cropped stages.
        const nextHeight = Number(height);
        this.logicalHeight = Number.isFinite(nextHeight) && nextHeight > 0
            ? nextHeight
            : LOGICAL_STAGE_HEIGHT;
    }

    stageScale() {
        const width = this.stageStack?.clientWidth || LOGICAL_STAGE_WIDTH;
        const height = this.stageStack?.clientHeight || LOGICAL_STAGE_HEIGHT;
        return Math.min(width / LOGICAL_STAGE_WIDTH, height / (this.logicalHeight || LOGICAL_STAGE_HEIGHT)) || 1;
    }

    updateTransform(state) {
        const scale = this.stageScale();
        if (state.auraCanvas) {
            const auraScale = state.auraScale || 1;
            const offX = state.auraOffsetX || 0;
            const offY = -state.auraOffsetY || 0;
            state.auraCanvas.style.transform = `translate(${offX.toFixed(2)}px, ${offY.toFixed(2)}px) scale(${auraScale})`;
        }
        const stageWidth = this.stageStack?.clientWidth || LOGICAL_STAGE_WIDTH;
        const stageHeight = this.stageStack?.clientHeight || LOGICAL_STAGE_HEIGHT;
        const centerX = (stageWidth / 2) + (state.x * scale);
        const centerY = (stageHeight / 2) - (state.y * scale);
        state.wrap.style.opacity = String(state.alpha);
        state.wrap.style.transform = `translate(${centerX.toFixed(2)}px, ${centerY.toFixed(2)}px) scale(${(state.sx * scale).toFixed(4)}, ${(state.sy * scale).toFixed(4)}) rotate(${state.rotation}deg)`;
    }

    tick(dtSeconds = 1 / 30) {
        for (const state of this.characters.values()) {
            if (!state.disp || state.alpha <= 0) continue;

            // Render Aura if enabled
            if (state.auraEnabled && state.auraPlayer?.lwf && state.auraCanvas) {
                try {
                    state.auraPlayer.lwf.exec(dtSeconds);
                    state.auraPlayer.lwf.render();
                } catch (error) {
                    this.log(`Character ${state.id} aura render failed: ${error.message}`);
                }
            }

            if (!state.activePlayer?.lwf || !state.activeCanvas) continue;
            try {
                state.activePlayer.lwf.exec(dtSeconds);
                const movie = state.activePlayer.movie;
                const total = Number(movie?.totalFrames);
                const current = Number(movie?.currentFrame);
                if (movie && total > 1 && Number.isFinite(current)) {
                    const wrapped = state.lastClipFrame != null
                        && state.lastClipFrame >= total - 1
                        && current <= 1
                        && movie.playing;
                    if (state.stopAtEnd || !state.loopAnime) {
                        if (current >= total || wrapped) {
                            movie.playing = false;
                            movie.gotoAndStop?.(total);
                        }
                    } else if (current >= total || (movie.playing === false && current >= total - 1)) {
                        movie.playing = true;
                        movie.gotoAndPlay?.(1);
                    }
                    state.lastClipFrame = Number(movie.currentFrame);
                }
                state.activePlayer.lwf.render();
            } catch (error) {
                this.log(`Character ${state.id} render failed: ${error.message}`);
            }
        }
    }
}
