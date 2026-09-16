/* ========================================================================== 
   absCustom - ActionBank Lua sequence runner
   ========================================================================== */

import { ensureFengari, createLuaHost } from './lua-host.js';
import { installBinders } from './lua-binders.js';
import { ScreenFade, ScreenShake } from './screen-effects.js';
import { BattleBgLayer } from './battle-bg-layer.js';
import { CharaLayer } from './chara-layer.js?v=20260901-complete-effect-layers';
import { LwfPackPlayer } from '../js-graphics/lwf-pack.js?v=20260905-canvas-blend-fix-v1';
import { openUsm } from './usm/pipeline.js';

const FPS = 30;
const VISUAL_SECONDS = 1 / FPS;
const NORMAL_AB_STEP = 2;
const HIGH_SPEED_AB_STEP = 4;
const SE_DEFAULT_VOLUME = 0.35;
const VOICE_DEFAULT_VOLUME = 0.45;
const AUDIO_CACHE_VERSION = 'cue-index-v2';
// Eclipse mixes its ActionBank player through a 0.12 master gain. Keep the
// user-facing 0-100 slider, but make 80% equal that reference level.
const REFERENCE_MASTER_GAIN = 0.15;
// A verified, fully transparent 1×1 PNG. The earlier compact byte sequence
// was malformed; LWF then rejected an entire cut-in pack whenever a name or
// phrase had to be hidden.
const TRANSPARENT_PNG_BYTES = new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,1,0,0,0,1,8,6,0,0,0,31,21,196,137,0,0,0,1,115,82,71,66,0,174,206,28,233,0,0,0,4,103,65,77,65,0,0,177,143,11,252,97,5,0,0,0,9,112,72,89,115,0,0,14,195,0,0,14,195,1,199,111,168,100,0,0,0,13,73,68,65,84,24,87,99,96,96,96,96,0,0,0,5,0,1,138,51,227,0,0,0,0,0,73,69,78,68,174,66,96,130]);
const TEXTURE_CONTEXTS = new Set(['sa1', 'sa2', 'active', 'standby', 'finish', 'passive', 'counter', 'nullification']);

function defaultBridgeUrl() {
    if (typeof window !== 'undefined') {
        const isLocal = window.location.protocol === 'file:'
            || window.location.hostname === 'localhost'
            || window.location.hostname === '127.0.0.1'
            || !window.location.hostname;
        if (isLocal) return 'http://127.0.0.1:3137';
    }
    return 'https://raw.githubusercontent.com/abscustom/DokkanCustom/main/assets';
}

function makeHost(className, zIndex) {
    const host = document.createElement('div');
    host.className = className;
    host.style.position = 'absolute';
    host.style.inset = '0';
    host.style.pointerEvents = 'none';
    host.style.overflow = 'hidden';
    host.style.zIndex = String(zIndex);
    return host;
}

function finite(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

function scriptVolume(value, fallback = SE_DEFAULT_VOLUME) {
    const volume = Number(value);
    if (!Number.isFinite(volume) || volume < 0) return fallback;
    return volume > 1.5 ? volume / 100 : volume;
}

function clampSoundRate(value) {
    return Math.max(0.35, Math.min(3, Number(value) || 1));
}

function soundRateFromCents(cents) {
    return Math.pow(2, (Number(cents) || 0) / 1200);
}

function sample(keys, frame, fields, fallback) {
    if (!keys?.length) return fallback;
    if (frame <= keys[0].frame) return fields.map((field, index) => finite(keys[0][field], fallback[index]));
    const last = keys[keys.length - 1];
    if (frame >= last.frame) return fields.map((field, index) => finite(last[field], fallback[index]));

    let rightIndex = 1;
    while (rightIndex < keys.length && keys[rightIndex].frame < frame) rightIndex += 1;
    const left = keys[rightIndex - 1];
    const right = keys[rightIndex];
    const span = Math.max(1, right.frame - left.frame);
    const ratio = Math.max(0, Math.min(1, (frame - left.frame) / span));
    return fields.map((field, index) => {
        const from = finite(left[field], fallback[index]);
        const to = finite(right[field], from);
        return from + ((to - from) * ratio);
    });
}

function armManualMovie(player, sceneName) {
    if (!player || !sceneName || !player.setMovie(sceneName, { play: false })) return false;
    const movie = player.movie;
    if (!movie) return false;
    player.playing = false;
    movie.active = true;
    movie.playing = true;
    movie.gotoAndPlay?.(1);
    return true;
}

function normalizeAnimationContext(value) {
    const context = String(value || '').toLowerCase();
    return TEXTURE_CONTEXTS.has(context) ? context : 'sa1';
}

function transparentTexture(name) {
    return new File([TRANSPARENT_PNG_BYTES], name, { type: 'image/png' });
}

function getCardTextureForSlot(textures, slot, animationContext = 'sa1') {
    if (!textures) return null;
    const context = normalizeAnimationContext(animationContext);
    const isName = slot === 'sp_name' || slot === 'sp02_name';
    const isPhrase = slot === 'sp_phrase' || slot === 'sp02_phrase';

    if (isName || isPhrase) {
        const contextualSlot = context === 'sa2'
            ? (isName ? 'sp02_name' : 'sp02_phrase')
            : (isName ? 'sp_name' : 'sp_phrase');
        return textures.get(contextualSlot) || null;
    }

    // Non-text slots must match exactly. Borrowing a nearby card texture can
    // put the wrong cut-in or art layer into an unrelated animation.
    return textures.get(slot) || null;
}

function replacementRuleAllowsSlot(rules, slot, hidePhraseTextures = false) {
    const list = Array.isArray(rules) ? rules : [];
    const isName = slot === 'sp_name' || slot === 'sp02_name';
    const isPhrase = slot === 'sp_phrase' || slot === 'sp02_phrase';
    if (!isName && !isPhrase) return true;
    if (isPhrase && hidePhraseTextures) return false;

    const expectedKind = isPhrase ? 5 : 4;
    return list.some((rule) => {
        if (Number(rule?.kind) === expectedKind) return true;
        const filename = String(rule?.filename || '').toLowerCase();
        return isPhrase
            ? filename.includes('phrase')
            : filename.includes('sp_name') || filename.includes('spname');
    });
}

export class ActionBankRunner {
    constructor({
        stageStack,
        serverUrl = defaultBridgeUrl(),
        log = console.log,
        onStatus = null,
        onFrame = null,
        onDone = null,
    }) {
        this.stageStack = stageStack;
        this.serverUrl = String(serverUrl).replace(/\/$/, '');
        this.log = log;
        this.onStatus = onStatus;
        this.onFrame = onFrame;
        this.onDone = onDone;

        this.layers = {};
        this._ensureStageLayers();
        this.backgroundLayer = new BattleBgLayer({
            host: this.layers.background,
            serverUrl: this.serverUrl,
            log: (message) => this.log(`[Background] ${message}`),
        });
        this.screenFade = new ScreenFade(this.layers.overlay);
        this.screenShake = new ScreenShake(this.stageStack);
        this.charaLayer = new CharaLayer({
            stageStack: this.layers.characters,
            serverUrl: this.serverUrl,
            log: (message) => this.log(`[Characters] ${message}`),
        });

        this.commands = [];
        this.effectTracks = new Map();
        this.effectCatalog = new Map();
        this.effectFileCache = new Map();
        this.preparedEffects = new Map();
        this.activeEffects = new Map();
        this.preparedMovies = new Map();
        this.activeMovies = new Map();
        this.cardTextures = new Map();
        this.autoTimeScales = new Map();
        this.effectTexRules = new Map();
        this.hideEffectPhraseTextures = false;

        this.frame = 0;
        this.maxFrame = 0;
        this.phase = 0;
        this.playing = false;
        this.userPaused = false;
        this.ready = false;
        this.pauseRemain = 0;
        this.highSpeed = false;
        this.step = NORMAL_AB_STEP;
        this.backgroundId = 1;
        this.animationContext = 'sa1';
        this.scriptName = '';
        this.attackerCardId = 1000010;
        this.enemyCardId = 1000020;

        this._cmdIndex = 0;
        this._raf = null;
        this._lastTickMs = null;
        this._accum = 0;
        this.audioContext = null;
        this.audioMaster = null;
        this.audioMasterVolume = 0.8;
        this.soundBuffers = new Map();
        this.activeSounds = new Map();
        this.soundStartOffsets = new Map();
        this.soundPitchCents = new Map();
        this.soundPitchKeys = new Map();
        this.soundTimeStretch = new Map();
        this.soundVolumeKeys = new Map();
        this.voiceVolumes = new Map();
    }

    _ensureStageLayers() {
        if (!this.stageStack) return;
        this.stageStack.style.position = 'relative';
        this.stageStack.style.overflow = 'hidden';

        const definitions = [
            ['background', 'abs-animation-bg-host', 0],
            ['backEffects', 'abs-animation-back-effects', 100],
            ['characters', 'abs-animation-character-host', 200],
            ['frontEffects', 'abs-animation-front-effects', 300],
            ['overlay', 'abs-animation-overlay-host', 450],
        ];
        for (const [key, className, zIndex] of definitions) {
            let host = this.stageStack.querySelector(`:scope > .${className}`);
            if (!host) {
                host = makeHost(className, zIndex);
                this.stageStack.appendChild(host);
            }
            this.layers[key] = host;
        }

        if (this.backgroundLayer) this.backgroundLayer.host = this.layers.background;
        if (this.charaLayer) this.charaLayer.setStage(this.layers.characters);
        if (this.screenFade) {
            this.screenFade.container = this.layers.overlay;
            this.screenFade.init();
        }
        if (this.screenShake) this.screenShake.target = this.stageStack;
    }

    setServerUrl(url) {
        this.serverUrl = String(url || defaultBridgeUrl()).replace(/\/$/, '');
        this.backgroundLayer.setServerUrl(this.serverUrl);
        this.charaLayer.setServerUrl(this.serverUrl);
    }

    _getHeaders() {
        return this.serverUrl && false
            ? { 'ngrok-skip-browser-warning': 'true' }
            : {};
    }

    setHighSpeed(enabled) {
        this.highSpeed = Boolean(enabled);
        this.step = this.highSpeed ? HIGH_SPEED_AB_STEP : NORMAL_AB_STEP;
        const rate = this.highSpeed ? 2 : 1;
        // The stage timeline is manual, but USM video has its own browser
        // clock. Update it immediately so the 1× / 2× control is visible even
        // between ActionBank ticks.
        for (const active of this.activeMovies.values()) {
            const video = active?.movie?.video || active?.video;
            if (video) video.playbackRate = rate;
        }
    }

    setBattleBg(id) {
        this.backgroundId = Math.max(0, Number(id) || 0);
    }

    setCards(attackerId = 1000010, enemyId = 1000020) {
        this.attackerCardId = Number(attackerId) || 1000010;
        this.enemyCardId = Number(enemyId) || 1000020;
    }

    setPayload(payload) {
        this.effectCatalog.clear();
        for (const effect of payload?.effects || []) {
            this.effectCatalog.set(Number(effect.id), effect);
        }
    }

    _haltClock() {
        this.playing = false;
        this.userPaused = false;
        if (this._raf) cancelAnimationFrame(this._raf);
        this._raf = null;
        this._lastTickMs = null;
        this._accum = 0;
    }

    _destroyPreparedEffects() {
        const destroyed = new Set();
        for (const entry of this.preparedEffects.values()) {
            if (destroyed.has(entry.player)) continue;
            destroyed.add(entry.player);
            try { entry.player?.clear?.(); } catch {}
            (entry.wrap || entry.canvas)?.remove?.();
        }
        this.preparedEffects.clear();
        this.activeEffects.clear();
        this.effectFileCache.clear();
    }

    _stopActiveMovies({ exceptContentId = null, remove = true } = {}) {
        for (const [contentId, active] of [...this.activeMovies.entries()]) {
            if (exceptContentId != null && Number(contentId) === Number(exceptContentId)) continue;
            const video = active?.movie?.video || active?.video;
            if (video) {
                try { video.pause(); } catch {}
                video.style.display = 'none';
                if (remove) video.remove();
            }
            this.activeMovies.delete(contentId);
        }
    }

    _destroyPreparedMovies() {
        this._stopActiveMovies();
        for (const entry of this.preparedMovies.values()) {
            const video = entry?.video;
            if (video) {
                try { video.pause(); } catch {}
                video.removeAttribute('src');
                try { video.load(); } catch {}
                video.remove();
            }
            const url = entry?.usmResult?.videoUrl;
            if (url) {
                try { URL.revokeObjectURL(url); } catch {}
            }
        }
        this.preparedMovies.clear();
        this.activeMovies.clear();
    }

    _deactivateEffects() {
        for (const entry of this.activeEffects.values()) {
            entry.canvas.style.display = 'none';
            (entry.wrap || entry.canvas).remove();
            entry.active = false;
        }
        this.activeEffects.clear();
    }

    clearStage() {
        this._stopAllSounds();
        this._destroyPreparedEffects();
        this._destroyPreparedMovies();
        this.cardTextures.clear();
        this.charaLayer.clear();
        this.backgroundLayer.clear();
        this.screenFade.clear();
        this.screenShake.clear();
    }

    _ensureAudioContext() {
        if (!this.audioContext) {
            const AudioCtor = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtor) return null;
            this.audioContext = new AudioCtor();
            this.audioMaster = this.audioContext.createGain();
            this.audioMaster.gain.value = this.audioMasterVolume * REFERENCE_MASTER_GAIN;
            this.audioMaster.connect(this.audioContext.destination);
        }
        return this.audioContext;
    }

    setMasterVolume(value) {
        this.audioMasterVolume = Math.max(0, Math.min(1, Number(value) || 0));
        if (this.audioMaster && this.audioContext) {
            this.audioMaster.gain.setValueAtTime(
                this.audioMasterVolume * REFERENCE_MASTER_GAIN,
                this.audioContext.currentTime,
            );
        }
    }

    _stopAllSounds() {
        this._stopPlayingSounds();
        this.soundStartOffsets.clear();
        this.soundPitchCents.clear();
        this.soundPitchKeys.clear();
        this.soundTimeStretch.clear();
        this.soundVolumeKeys.clear();
        this.voiceVolumes.clear();
    }

    _stopPlayingSounds() {
        for (const sound of this.activeSounds.values()) {
            try { sound.source?.stop(); } catch {}
            try { sound.source?.disconnect(); } catch {}
            try { sound.gain?.disconnect(); } catch {}
        }
        this.activeSounds.clear();
    }

    _stopSound(workId) {
        const sound = this.activeSounds.get(Number(workId));
        if (!sound) return;
        try { sound.source?.stop(); } catch {}
        try { sound.source?.disconnect(); } catch {}
        try { sound.gain?.disconnect(); } catch {}
        this.activeSounds.delete(Number(workId));
    }

    async _loadSound(cueId, kind = 'se', packageHint = '') {
        const id = Number(cueId);
        if (!Number.isInteger(id) || id < 0) return null;
        const cacheKey = `${kind}:${id}:${packageHint || ''}`;
        if (this.soundBuffers.has(cacheKey)) return this.soundBuffers.get(cacheKey);
        const context = this._ensureAudioContext();
        if (!context) return null;
        const params = new URLSearchParams({ cue: String(id), v: AUDIO_CACHE_VERSION });
        if (kind === 'voice' && packageHint) params.set('package', packageHint);
        const headers = this._getHeaders();
        const response = await fetch(`${this.serverUrl}/api/${kind}?${params}`, {
            cache: 'force-cache',
            ...(Object.keys(headers).length ? { headers } : {})
        });
        if (!response.ok) throw new Error(await response.text());
        const buffer = await context.decodeAudioData((await response.arrayBuffer()).slice(0));
        this.soundBuffers.set(cacheKey, buffer);
        return buffer;
    }

    async _preloadSoundEffects() {
        const cueIds = [...new Set(this.commands
            .filter((command) => ['playSe', 'playSeLife', 'playSeVer2'].includes(command.type))
            .map((command) => Number(command.cueId))
            .filter((cueId) => Number.isInteger(cueId) && cueId >= 0))];
        let ready = 0;
        for (const cueId of cueIds) {
            try {
                await this._loadSound(cueId);
                ready += 1;
            } catch (error) {
                this.log(`SE ${cueId} unavailable: ${error.message || error}`);
            }
        }
        if (cueIds.length) this.log(`Preloaded ${ready}/${cueIds.length} local sound effect(s)`);

        const voiceCommands = this.commands.filter((command) => command.type === 'playVoice');
        let voicesReady = 0;
        for (const command of voiceCommands) {
            try {
                await this._loadSound(command.cueId, 'voice', command.packageHint || command.name || '');
                voicesReady += 1;
            } catch (error) {
                this.log(`Voice ${command.cueId} unavailable: ${error.message || error}`);
            }
        }
        if (voiceCommands.length) {
            this.log(`Preloaded ${voicesReady}/${voiceCommands.length} local voice cue(s)`);
        }
    }

    _playSound(command, kind = 'se') {
        const cueId = Number(command.cueId);
        const packageHint = kind === 'voice' ? (command.packageHint || command.name || '') : '';
        const buffer = this.soundBuffers.get(`${kind}:${cueId}:${packageHint}`);
        const context = this._ensureAudioContext();
        if (!context || !buffer) return;
        if (context.state === 'suspended') void context.resume();
        const workId = Number(command.workId);
        this._stopSound(workId);
        const source = context.createBufferSource();
        const gain = context.createGain();
        source.buffer = buffer;
        const stretch = clampSoundRate(this.soundTimeStretch.get(workId) ?? 1);
        let pitch = Number(this.soundPitchCents.get(workId)) || 0;
        for (const key of this.soundPitchKeys.get(workId) || []) {
            if (Number(key.frame) > Number(command.frame)) break;
            pitch = Number(key.pitch) || 0;
        }
        // Match Dokkan/Eclipse: time stretch and pitch combine into the
        // AudioBuffer playback rate. A stretch of 2 is faster, not longer.
        const playbackRate = clampSoundRate(stretch * soundRateFromCents(pitch));
        source.playbackRate.value = playbackRate;
        let bakedVolume = null;
        if (kind === 'se') {
            for (const key of this.soundVolumeKeys.get(workId) || []) {
                if (Number(key.frame) > Number(command.frame)) break;
                bakedVolume = key.volume;
            }
        }
        const defaultVolume = kind === 'voice'
            ? (this.voiceVolumes.get(cueId) ?? VOICE_DEFAULT_VOLUME)
            : SE_DEFAULT_VOLUME;
        gain.gain.value = scriptVolume(command.vol, defaultVolume);
        if (bakedVolume != null) gain.gain.value = scriptVolume(bakedVolume, defaultVolume);
        source.connect(gain);
        gain.connect(this.audioMaster || context.destination);
        const offsetMs = this.soundStartOffsets.get(workId) || 0;
        const offsetSec = Math.max(0, Math.min(buffer.duration - 0.001, offsetMs / 1000));
        const spanFrames = Number(command.endFrame) > Number(command.frame)
            ? Number(command.endFrame) - Number(command.frame)
            : Number(command.life);
        const playSeconds = Number.isFinite(spanFrames) && spanFrames > 0 ? spanFrames / FPS : null;
        const active = { source, gain, playbackRate, cueId, kind };
        this.activeSounds.set(workId, active);
        source.onended = () => {
            if (this.activeSounds.get(workId) === active) this.activeSounds.delete(workId);
        };
        try {
            // AudioBufferSourceNode's duration is measured in buffer seconds.
            // Multiplying by playbackRate keeps the audible cutoff aligned to
            // the Lua endFrame even when the sound is pitch/time stretched.
            const startAt = context.currentTime + 0.01;
            if (playSeconds != null) source.start(startAt, offsetSec, Math.min(playSeconds * playbackRate, buffer.duration - offsetSec));
            else source.start(startAt, offsetSec);
        } catch (error) {
            this.log(`${kind === 'voice' ? 'Voice' : 'SE'} ${cueId} could not play: ${error.message || error}`);
        }
    }

    reset() {
        this._haltClock();
        this.clearStage();
        this.commands = [];
        this.effectTracks.clear();
        this.effectTexRules.clear();
        this.hideEffectPhraseTextures = false;
        this.frame = 0;
        this.maxFrame = 0;
        this.phase = 0;
        this.pauseRemain = 0;
        this._cmdIndex = 0;
        this.ready = false;
        this.onStatus?.('reset', this);
    }

    async loadScript({
        luaSource,
        commonSource,
        scriptName,
        card = null,
        enemyId = 1000020,
        backgroundId = this.backgroundId,
        animationContext = 'sa1',
    }) {
        this.reset();
        this.animationContext = normalizeAnimationContext(animationContext);
        this.scriptName = String(scriptName || '')
            .replace(/\\/g, '/')
            .split('/')
            .pop()
            .replace(/\.lua$/i, '')
            .toLowerCase();
        // Dokkan uses two authored portrait canvases. Match the logical Action
        // Bank stage to the source type so shorter Super/Finish/nullification
        // sequences do not sit inside black 852x1536 letterbox space.
        const activeHasAttack = /\bdealDamage\s*\(/.test(String(luaSource || ''));
        const useTallStage = this.animationContext === 'passive'
            || this.animationContext === 'standby'
            || this.animationContext === 'counter'
            || (this.animationContext === 'active' && !activeHasAttack);
        this.targetWidth = 852;
        this.targetHeight = useTallStage ? 1536 : 1136;
        if (this.stageStack) {
            this.stageStack.style.aspectRatio = `852 / ${this.targetHeight}`;
            this.stageStack.style.overflow = 'hidden';
        }
        if (this.charaLayer?.setLogicalHeight) {
            this.charaLayer.setLogicalHeight(this.targetHeight);
        }
        this._ensureStageLayers();
        this.setBattleBg(backgroundId);
        await ensureFengari();

        const attackerId = Number(card?.id || this.attackerCardId || 1000010);
        const defenderId = Number(enemyId || this.enemyCardId || 1000020);
        this.setCards(attackerId, defenderId);

        const host = createLuaHost();
        installBinders(host, this);
        host.setGlobalNumber('OFFSET_X', 0);
        host.setGlobalNumber('OFFSET_Y', 0);
        host.setGlobalNumber('fcolor_r', 245);
        host.setGlobalNumber('fcolor_g', 245);
        host.setGlobalNumber('fcolor_b', 245);
        host.setGlobalNumber('_IS_SKIP_', 0);
        host.setGlobalNumber('_IS_PLAYER_SIDE_', 1);
        // Multi-target scripts contain a full cinematic for their first enemy
        // and a short follow-up branch for every later enemy.  Lua treats an
        // undefined value as nil (not 0), which previously selected the
        // follow-up branch in previews such as ut0052.  A normal one-enemy
        // card-viewer preview is always the first target.
        host.setGlobalNumber('_IS_SPECIAL_AIM_ALL_', 0);
        host.setGlobalNumber('_IS_DODGE_', 0);
        // Counter Lua files use these battle-result flags just like super
        // attacks. Define their normal-preview values explicitly so Fengari
        // does not take a nil-only branch while previewing a counter.
        host.setGlobalNumber('_IS_CRITICAL_', 0);
        host.setGlobalNumber('_IS_DEAD_', 0);
        host.setGlobalNumber('_IS_GUARD_', 0);
        host.setGlobalNumber('_IS_DEAD_LAST_', 0);
        host.setGlobalNumber('_SPECIAL_ENERGY_COLOR_', 0);
        host.setGlobalNumber('_SPECIAL_SKILL_LEVEL_', 20);
        host.setGlobalNumber('_ATTACKER_CARD_ID_', attackerId);
        host.setGlobalNumber('_DEFENDER_CARD_ID_', defenderId);
        host.setGlobalNumber('_COSTUME_CARD_ID_', 0);

        if (commonSource) {
            try {
                host.run(commonSource, 'common.lua');
            } catch (error) {
                this.log(`common.lua warning: ${error.message}`);
            }
        }
        host.run(luaSource, scriptName || 'super_attack.lua');

        this.prepare();
        const backgroundPromise = this.backgroundId
            ? this.backgroundLayer.loadLevelBg(this.backgroundId).catch((error) => {
                this.log(`Background ${this.backgroundId}: ${error.message}`);
                return null;
            })
            : Promise.resolve(null);
        await Promise.all([backgroundPromise, this.preload()]);
        this.ready = true;
        this.onStatus?.('ready', this);
        return this.commands.length;
    }

    prepare() {
        this.commands = this.commands
            .map((command, index) => ({ ...command, _order: index }))
            .sort((a, b) => finite(a.frame) - finite(b.frame) || a._order - b._order);

        // These sound modifiers are metadata for their work ID. Bake them
        // before playback so same-frame pitch/stretch calls affect the cue at
        // the instant it starts, as they do in Dokkan's ActionBank runner.
        this.soundStartOffsets.clear();
        this.soundPitchCents.clear();
        this.soundPitchKeys.clear();
        this.soundTimeStretch.clear();
        this.soundVolumeKeys.clear();
        for (const command of this.commands) {
            const workId = Number(command.workId);
            if (!Number.isFinite(workId)) continue;
            if (command.type === 'setStartTimeMs') {
                this.soundStartOffsets.set(workId, Math.max(0, Number(command.ms) || 0));
            } else if (command.type === 'setTimeStretch') {
                this.soundTimeStretch.set(workId, clampSoundRate(command.stretch));
            } else if (command.type === 'setPitch') {
                if (command.frame == null || !Number.isFinite(Number(command.frame))) {
                    this.soundPitchCents.set(workId, Number(command.pitch) || 0);
                } else {
                    const keys = this.soundPitchKeys.get(workId) || [];
                    keys.push({ frame: Number(command.frame) || 0, pitch: Number(command.pitch) || 0 });
                    keys.sort((left, right) => left.frame - right.frame);
                    this.soundPitchKeys.set(workId, keys);
                }
            } else if (command.type === 'setSeVolume' || command.type === 'setSeVolumeByWorkId') {
                const keys = this.soundVolumeKeys.get(workId) || [];
                keys.push({ frame: Number(command.frame) || 0, volume: command.vol });
                keys.sort((left, right) => left.frame - right.frame);
                this.soundVolumeKeys.set(workId, keys);
            }
        }

        const phaseEnd = this.commands
            .filter((command) => command.type === 'endPhase')
            .map((command) => finite(command.frame))
            .at(-1);
        const greatestFrame = this.commands.reduce((max, command) => Math.max(max, finite(command.frame)), 0);
        this.maxFrame = Number.isFinite(phaseEnd) ? phaseEnd : Math.max(60, greatestFrame);
        this.commands = this.commands.filter((command) => finite(command.frame) <= this.maxFrame);
        this.charaLayer.loadKeysFromCommands(this.commands);
        this._buildEffectTracks();
        this.log(`ActionBank ${this.scriptName || '(unknown script)'} prepared ${this.commands.length} commands through AB frame ${this.maxFrame}`);
    }

    _buildEffectTracks() {
        this.effectTracks.clear();
        const ensure = (workId) => {
            const id = Number(workId) || 0;
            if (!this.effectTracks.has(id)) {
                this.effectTracks.set(id, { move: [], scale: [], rotate: [], alpha: [] });
            }
            return this.effectTracks.get(id);
        };

        for (const command of this.commands) {
            const frame = finite(command.frame);
            const track = command.workId != null ? ensure(command.workId) : null;
            if (!track) continue;
            if (command.type === 'setEffMoveKey') track.move.push({ frame, x: command.a, y: command.b, z: command.c });
            else if (command.type === 'setEffScaleKey') track.scale.push({ frame, sx: command.a, sy: command.b });
            else if (command.type === 'setEffRotateKey') track.rotate.push({ frame, rotation: command.a });
            else if (command.type === 'setEffAlphaKey') track.alpha.push({ frame, alpha: command.a });
        }
        for (const tracks of this.effectTracks.values()) {
            for (const keys of Object.values(tracks)) keys.sort((a, b) => a.frame - b.frame);
        }
    }

    async _resolveEffect(effectId) {
        const id = Number(effectId);
        let effect = this.effectCatalog.get(id);
        if (effect?.available && effect.files?.length) return effect;
        try {
            const headers = this._getHeaders();
            const response = await fetch(`${this.serverUrl}/api/effect/${id}`, {
                cache: 'no-store',
                ...(Object.keys(headers).length ? { headers } : {})
            });
            const payload = await response.json().catch(() => ({}));
            if (response.ok && payload?.id) {
                effect = payload;
                this.effectCatalog.set(id, effect);
                return effect;
            }
        } catch (error) {
            this.log(`Effect ${id} metadata: ${error.message}`);
        }
        return effect || null;
    }

    async _effectFiles(effect, command) {
        const workId = Number(command?.workId) || 0;
        const replacementRules = this.effectTexRules.get(workId) || [];
        const ruleKey = replacementRules
            .map((rule) => `${Number(rule.from)}>${Number(rule.to)}`)
            .sort()
            .join(',');
        const cacheKey = [
            effect.pack_name || effect.id,
            `rules=${ruleKey || 'none'}`,
            `context=${this.animationContext}`,
            `card=${this.attackerCardId}`,
            `hidePhrase=${this.hideEffectPhraseTextures ? 1 : 0}`,
        ].join('|');
        if (this.effectFileCache.has(cacheKey)) return this.effectFileCache.get(cacheKey);
        const promise = Promise.all((effect.files || []).map(async (file) => {
            const lower = file.name.toLowerCase();
            let slot = null;
            if (lower === 'character.png' || lower.includes('_character.png')) slot = 'character';
            else if (lower.includes('sp02_name') || lower.includes('sp02name')) slot = 'sp02_name';
            else if (lower.includes('sp02_phrase') || lower.includes('sp02phrase')) slot = 'sp02_phrase';
            else if (lower === 'sp_name.png' || lower.includes('_sp_name.png') || lower.includes('spname')) slot = 'sp_name';
            else if (lower === 'sp_phrase.png' || lower.includes('_sp_phrase.png') || lower.includes('spphrase')) slot = 'sp_phrase';
            // Most packs name this card texture "..._sp_cutin_1.png", so
            // matching only "_sp_cutin.png" misses the actual cut-in art and
            // leaves the pack's white/black placeholder visible.
            else if (lower.includes('sp_cutin') || lower.includes('spcutin')) slot = 'sp_cutin';
            else if (lower === 'cutin.png' || lower.includes('_cutin.png')) slot = 'cutin';
            else if (lower === 'bg.png' || lower.includes('_bg.png')) slot = 'bg';
            else if (lower === 'effect.png' || lower.includes('_effect.png')) slot = 'effect';
            else if (lower === 'circle.png' || lower.includes('_circle.png')) slot = 'circle';

            const replacementAllowed = slot
                ? replacementRuleAllowsSlot(replacementRules, slot, this.hideEffectPhraseTextures)
                : false;
            const matchedTex = slot && replacementAllowed
                ? getCardTextureForSlot(this.cardTextures, slot, this.animationContext)
                : null;
            if (matchedTex) {
                // Must preserve the placeholder's original file.name so the LWF binary recognises it!
                return new File([matchedTex], file.name, { type: matchedTex.type || 'image/png' });
            }

            if (slot) {
                // Preserve the placeholder filename but render nothing when the
                // exact contextual slot does not exist. Never borrow SA1 text
                // for SA2/skills (or vice versa).
                return transparentTexture(file.name);
            }

            const response = await fetch(file.url).catch(() => ({ ok: false }));
            if (!response.ok) {
                return transparentTexture(file.name);
            }
            return new File([await response.blob()], file.name);
        }));
        this.effectFileCache.set(cacheKey, promise);
        return promise;
    }

    _effectResourceKey(effect, command) {
        const workId = Number(command?.workId) || 0;
        const rules = (this.effectTexRules.get(workId) || [])
            .map((rule) => `${Number(rule.from)}>${Number(rule.to)}`)
            .sort()
            .join(',');
        return [
            effect.pack_name || effect.id,
            `rules=${rules || 'none'}`,
            `context=${this.animationContext}`,
            `card=${this.attackerCardId}`,
            `hidePhrase=${this.hideEffectPhraseTextures ? 1 : 0}`,
        ].join('|');
    }

    async _prepareEffect(command) {
        const effect = await this._resolveEffect(command.effectId);
        if (!effect?.available || !effect.files?.length) {
            this.log(`Effect ${command.effectId} is unavailable`);
            return null;
        }
        const files = await this._effectFiles(effect, command);
        const canvas = document.createElement('canvas');
        canvas.className = 'abs-animation-layer-canvas abs-sequence-effect-canvas';
        canvas.dataset.workId = String(command.workId);
        canvas.dataset.effectId = String(command.effectId);
        canvas.style.display = 'none';
        const wrap = document.createElement('div');
        wrap.className = 'abs-sequence-effect-wrap';
        wrap.style.position = 'absolute';
        wrap.style.inset = '0';
        wrap.style.display = 'none';
        wrap.style.pointerEvents = 'none';
        wrap.style.transformOrigin = 'center center';
        wrap.appendChild(canvas);

        const player = new LwfPackPlayer(canvas, () => {}, {
            resourceKey: this._effectResourceKey(effect, command),
        });
        player.loopMovie = false;
        const ingested = player.ingestFiles(files);
        if (!ingested.lwfFile) throw new Error(`Effect ${command.effectId} has no LWF file.`);
        const prepared = await player.prepare(ingested.lwfFile);
        const actualMissing = (prepared.missing || []).filter((name) => {
            const lower = name.toLowerCase();
            return !lower.includes('card_') && !lower.includes('cutin') && !lower.includes('character') && !lower.includes('effect') && !lower.includes('sp_name') && !lower.includes('sp_phrase') && !lower.includes('phrase');
        });
        if (actualMissing.length) throw new Error(`Effect ${command.effectId} is missing ${actualMissing.join(', ')}`);
        const movies = await player.load();
        // LwfPackPlayer.load() applies its standalone full-size presentation;
        // replace that here with ActionBank's centered native-size layer.
        const nativeWidth = Number(prepared.header?.width) || 852;
        const nativeHeight = Number(prepared.header?.height) || 1536;
        canvas.style.inset = 'auto';
        canvas.style.left = '50%';
        canvas.style.top = '50%';
        canvas.style.width = `${(nativeWidth / this.targetWidth) * 100}%`;
        canvas.style.height = `${(nativeHeight / this.targetHeight) * 100}%`;
        canvas.style.maxWidth = 'none';
        canvas.style.maxHeight = 'none';
        canvas.style.transformOrigin = 'center center';
        canvas.style.transform = 'translate(-50%, -50%)';
        if (player._misses?.size) {
            this.log(`Effect ${command.effectId} unresolved LWF textures: ${[...player._misses].slice(0, 8).join(', ')}${player._misses.size > 8 ? ` (+${player._misses.size - 8})` : ''}`);
        }
        const scene = movies.includes(effect.scene_name) ? effect.scene_name : movies[0];
        if (!scene || !armManualMovie(player, scene)) {
            throw new Error(`Effect ${command.effectId} scene ${effect.scene_name || '(default)'} was not found.`);
        }

        const entry = {
            command,
            effect,
            player,
            canvas,
            wrap,
            scene,
            active: false,
            ended: false,
            lifeRemaining: 0,
            shakeFrames: 0,
            shakePower: 0,
        };
        this.preparedEffects.set(Number(command.workId), entry);
        return entry;
    }

    async _prepareMovie(command) {
        const contentId = Number(command.contentId);
        if (this.preparedMovies.has(contentId)) return this.preparedMovies.get(contentId);

        const effect = await this._resolveEffect(contentId);
        if (!effect?.movie_url) {
            this.log(`Movie effect ${contentId} has no movie URL.`);
            return null;
        }

        try {
            this.log(`Loading cutscene movie for contentId=${contentId} (${effect.pack_name})...`);
            const res = await fetch(effect.movie_url);
            if (!res.ok) throw new Error(`Failed to fetch USM movie ${effect.movie_url}`);
            const arrayBuffer = await res.arrayBuffer();

            let usmResult;
            try {
                usmResult = await openUsm(arrayBuffer, (msg) => this.log(`[USM] ${msg}`));
            } catch (decodeError) {
                if (!effect.movie_fallback_url || !/not IVF\/VP9/i.test(decodeError.message)) throw decodeError;
                this.log(`[USM] ${decodeError.message}; requesting the codec conversion fallback…`);
                const fallbackResponse = await fetch(effect.movie_fallback_url);
                if (!fallbackResponse.ok) {
                    let detail = '';
                    try { detail = (await fallbackResponse.json())?.error || ''; } catch {}
                    throw new Error(detail || `Movie conversion failed with ${fallbackResponse.status}`);
                }
                const blob = await fallbackResponse.blob();
                if (!blob.type.includes('video/mp4')) throw new Error('Movie conversion did not return an MP4 file');
                usmResult = {
                    blob,
                    videoUrl: URL.createObjectURL(blob),
                    audio: null,
                    meta: { path: 'codec-fallback', probe: 'converted-mp4' },
                };
                this.log('[USM] Loaded browser-compatible converted movie');
            }
            const video = document.createElement('video');
            video.className = 'abs-cutscene-video';
            video.src = usmResult.videoUrl;
            video.playsInline = true;
            video.muted = true;
            video.autoplay = false;
            video.style.display = 'none';

            const entry = {
                contentId,
                effect,
                video,
                usmResult,
                meta: usmResult.meta,
            };
            this.preparedMovies.set(contentId, entry);
            return entry;
        } catch (err) {
            this.log(`Movie ${contentId} (${effect?.pack_name}) prepare failed: ${err.message}`);
            return null;
        }
    }

    async preload() {
        this.onStatus?.('preloading', this);

        // 1. Preload Character Models
        const characterResults = await Promise.allSettled([
            this.charaLayer.preloadCharacter(0, this.attackerCardId),
            this.charaLayer.preloadCharacter(1, this.enemyCardId),
        ]);
        characterResults.forEach((result, index) => {
            if (result.status === 'rejected') {
                this.log(`${index === 0 ? 'Attacker' : 'Enemy'} rig failed: ${result.reason?.message || result.reason}`);
            }
        });

        // 2. Fetch Card Art Textures for Dynamic Injections
        try {
            const headers = this._getHeaders();
            const cardRes = await fetch(`${this.serverUrl}/api/card/${Number(this.attackerCardId) || 0}`, {
                ...(Object.keys(headers).length ? { headers } : {})
            });
            const cardPayload = await cardRes.json();
            if (cardPayload?.textures) {
                for (const [slot, tex] of Object.entries(cardPayload.textures)) {
                    if (tex?.url) {
                        try {
                            const texRes = await fetch(tex.url);
                            if (texRes.ok) {
                                const blob = await texRes.blob();
                                this.cardTextures.set(slot, new File([blob], tex.name));
                            }
                        } catch {}
                    }
                }
            }
        } catch (err) {
            this.log(`Card texture fetch failed: ${err.message}`);
        }

        // 3. Preload USM movies. Their paired LWF still has to remain complete:
        // Dokkan uses it for supplementary animation layers such as splashes,
        // speed lines, flashes, and impact lettering that are absent from the
        // encoded movie plate.
        const movieCommands = this.commands.filter((command) => command.type === 'setupMovie' && Number.isFinite(Number(command.contentId)));
        const movieResults = await Promise.allSettled(movieCommands.map((command) => this._prepareMovie(command)));
        movieResults.forEach((result, index) => {
            if (result.status === 'rejected') {
                this.log(`Movie ${movieCommands[index]?.contentId} preload failed: ${result.reason?.message || result.reason}`);
            }
        });

        // 4. Preload LWF Effect Sequences
        const entries = this.commands.filter((command) => command.type === 'entryEffect' && Number.isFinite(Number(command.effectId)));
        // Multiple cut-in scenes (for example 1505 and 1507) can share one
        // LWF pack. The LWF runtime's global cache is not safe when those
        // scenes initialise concurrently, which made their card art fall back
        // to a white/black placeholder. Prepare them in script order instead.
        const results = [];
        for (const command of entries) {
            try {
                results.push({ status: 'fulfilled', value: await this._prepareEffect(command) });
            } catch (reason) {
                results.push({ status: 'rejected', reason });
            }
        }
        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                this.log(`Effect ${entries[index]?.effectId} preload failed: ${result.reason?.message || result.reason}`);
            }
        });
        this.log(`Preloaded ${this.preparedEffects.size}/${entries.length} scheduled effect instance(s)`);

        // 5. Decode only the SE cues referenced by this Lua sequence. The
        // bridge converts CRI ACB streams to cached WAV files on demand.
        await this._preloadSoundEffects();
    }

    _resetPlaybackVisuals() {
        this._deactivateEffects();
        this._stopActiveMovies();
        this._ensureStageLayers();
        this.charaLayer.resetPlayback();
        this.backgroundLayer.resetPlayback();
        this.screenFade.clear();
        this.screenFade.init();
        this.screenShake.clear();
    }

    play() {
        if (!this.ready || !this.commands.length) {
            this.log('Cannot play: sequence is not ready');
            return false;
        }
        if (this.playing && this.userPaused) {
            this.resume();
            return true;
        }

        this._haltClock();
        // A replay is a fresh ActionBank timeline. Stop any tails left by the
        // prior run, but retain the pitch/stretch/volume metadata prepared
        // from the Lua commands for this sequence.
        this._stopPlayingSounds();
        this._resetPlaybackVisuals();
        this.frame = 0;
        this.phase = 0;
        this.pauseRemain = 0;
        this._cmdIndex = 0;
        this.playing = true;
        this.userPaused = false;
        this._lastTickMs = performance.now();
        this._accum = 0;
        this.onStatus?.('playing', this);
        this._loop();
        return true;
    }

    pause() {
        if (!this.playing || this.userPaused) return;
        this.userPaused = true;
        if (this._raf) cancelAnimationFrame(this._raf);
        this._raf = null;
        // Pausing only the ActionBank clock left the USM cutscene playing,
        // making the UI look like Pause had no effect.
        for (const active of this.activeMovies.values()) {
            const video = active?.movie?.video || active?.video;
            try { video?.pause(); } catch {}
        }
        try { this.audioContext?.suspend?.(); } catch {}
        this.onStatus?.('paused', this);
    }

    resume() {
        if (!this.playing || !this.userPaused) return;
        this.userPaused = false;
        const rate = this.highSpeed ? 2 : 1;
        for (const active of this.activeMovies.values()) {
            const video = active?.movie?.video || active?.video;
            if (!video) continue;
            video.playbackRate = rate;
            if (!video.ended) video.play().catch(() => {});
        }
        try { void this.audioContext?.resume?.(); } catch {}
        this._lastTickMs = performance.now();
        this._accum = 0;
        this.onStatus?.('playing', this);
        this._loop();
    }

    stop() {
        this._haltClock();
        this.clearStage();
        this.ready = false;
        this.onStatus?.('stopped', this);
    }

    _loop() {
        if (!this.playing || this.userPaused || this._raf) return;
        const tick = (now) => {
            this._raf = null;
            if (!this.playing || this.userPaused) return;
            if (this._lastTickMs == null) this._lastTickMs = now;
            let elapsed = (now - this._lastTickMs) / 1000;
            this._lastTickMs = now;
            if (!(elapsed > 0) || elapsed > 0.25) elapsed = VISUAL_SECONDS;
            this._accum += elapsed;

            let catchUp = 0;
            while (this._accum >= VISUAL_SECONDS && this.playing && catchUp < 4) {
                this._accum -= VISUAL_SECONDS;
                const advance = this._advance(this.step);
                this._tickVisual(advance);
                catchUp += 1;
            }
            if (catchUp === 4 && this._accum > VISUAL_SECONDS * 4) this._accum = VISUAL_SECONDS;
            this.onFrame?.(this.frame, this.maxFrame);
            if (this.playing) this._raf = requestAnimationFrame(tick);
        };
        this._raf = requestAnimationFrame(tick);
    }

    _advance(step) {
        let timelineFrames = 0;
        let pausedFrames = 0;
        for (let count = 0; count < step && this.playing; count += 1) {
            if (this.pauseRemain > 0) {
                this.pauseRemain -= 1;
                pausedFrames += 1;
                continue;
            }
            if (this.frame > this.maxFrame) {
                this._finish();
                break;
            }
            this._fireAt(this.frame);
            if (!this.playing) break;
            this.charaLayer.evalAllAtFrame(this.frame);
            this._applyEffectTracks(this.frame);
            this.frame += 1;
            timelineFrames += 1;
        }
        return { timelineFrames, pausedFrames, paused: pausedFrames > 0 && timelineFrames === 0 };
    }

    _tickVisual({ timelineFrames, pausedFrames, paused }) {
        this.screenFade.tick(1);
        this.screenShake.tick(1);
        this.backgroundLayer.tick(1, { paused });
        if (!paused) this.charaLayer.tick(VISUAL_SECONDS);

        for (const [workId, entry] of [...this.activeEffects.entries()]) {
            const canAdvance = !paused || entry.command.pausable === false;
            if (canAdvance && entry.player?.lwf) {
                try {
                    entry.player.lwf.exec(VISUAL_SECONDS);
                    entry.player.lwf.render();
                    entry.player._checkEnd?.();
                } catch (error) {
                    this.log(`Effect ${entry.command.effectId} render failed: ${error.message}`);
                }
            }

            if (entry.ended) {
                this._deactivateEffect(workId);
                continue;
            }

            if (entry.shakeFrames > 0 && canAdvance) {
                entry.shakeFrames = Math.max(0, entry.shakeFrames - this.step);
            }
            if (entry.command.lifeLimited && canAdvance) {
                const consumed = entry.command.pausable === false ? (timelineFrames + pausedFrames) : timelineFrames;
                entry.lifeRemaining -= consumed;
                if (entry.lifeRemaining <= 0) this._deactivateEffect(workId);
            }
        }

        for (const active of this.activeMovies.values()) {
            const video = active.movie.video;
            if (paused) {
                if (!video.paused) video.pause();
            } else {
                const rate = this.highSpeed ? 2 : 1;
                active.elapsedSeconds += VISUAL_SECONDS * rate;
                video.playbackRate = rate;
                const expectedTime = active.baseTime + active.elapsedSeconds;
                if (Number.isFinite(video.duration)) {
                    const boundedTime = Math.min(Math.max(0, expectedTime), Math.max(0, video.duration - 0.001));
                    if (Math.abs(video.currentTime - boundedTime) > 0.16) video.currentTime = boundedTime;
                }
                if (video.paused && !video.ended) video.play().catch(() => {});
            }
        }
    }

    _fireAt(frame) {
        while (this._cmdIndex < this.commands.length) {
            const command = this.commands[this._cmdIndex];
            if (finite(command.frame) > frame) break;
            this._cmdIndex += 1;
            this._exec(command);
            if (!this.playing) return;
        }
    }

    _activateEffect(command) {
        const workId = Number(command.workId);
        const entry = this.preparedEffects.get(workId);

        if (!entry) {
            this.log(`Effect ${command.effectId} was not ready at AB frame ${this.frame}`);
            return;
        }
        entry.ended = false;
        entry.player.onEnded = () => { entry.ended = true; };
        if (!armManualMovie(entry.player, entry.scene)) return;

        const background = (Number(command.attr) & 0x80) !== 0;
        const behindCharacters = background || finite(command.zOrder) < 0;
        const host = behindCharacters ? this.layers.backEffects : this.layers.frontEffects;
        entry.canvas.style.display = 'block';
        entry.wrap.style.display = 'block';
        entry.wrap.style.zIndex = String(1000 + finite(command.zOrder));
        host.appendChild(entry.wrap);
        entry.active = true;
        entry.lifeRemaining = Math.max(0, finite(command.life));
        entry.shakeFrames = 0;
        entry.shakePower = 0;
        this.activeEffects.set(workId, entry);
        this._applyEffectPose(entry, this.frame);
    }

    _deactivateEffect(workId) {
        const id = Number(workId);
        const entry = this.activeEffects.get(id);
        if (!entry) return;
        entry.active = false;
        entry.canvas.style.display = 'none';
        entry.wrap.style.display = 'none';
        entry.wrap.remove();
        this.activeEffects.delete(id);
    }

    _applyEffectTracks(frame) {
        for (const entry of this.activeEffects.values()) this._applyEffectPose(entry, frame);
    }

    _stageScale() {
        const targetW = this.targetWidth || 852;
        const targetH = this.targetHeight || 1536;
        const width = this.stageStack?.clientWidth || targetW;
        const height = this.stageStack?.clientHeight || targetH;
        return Math.min(width / targetW, height / targetH) || 1;
    }

    _applyEffectPose(entry, frame) {
        const command = entry.command;
        const tracks = this.effectTracks.get(Number(command.workId));
        const [x, y] = sample(tracks?.move, frame, ['x', 'y'], [finite(command.x), finite(command.y)]);
        const [sx, sy] = sample(tracks?.scale, frame, ['sx', 'sy'], [1, 1]);
        const [rotation] = sample(tracks?.rotate, frame, ['rotation'], [0]);
        const [alpha] = sample(tracks?.alpha, frame, ['alpha'], [255]);
        const shakeX = entry.shakeFrames > 0 ? (Math.random() * 2 - 1) * entry.shakePower : 0;
        const shakeY = entry.shakeFrames > 0 ? (Math.random() * 2 - 1) * entry.shakePower : 0;
        const stageScale = this._stageScale();
        entry.canvas.style.opacity = String(Math.max(0, Math.min(1, alpha / 255)));
        entry.wrap.style.transform = `translate(${((x + shakeX) * stageScale).toFixed(2)}px, ${((-y + shakeY) * stageScale).toFixed(2)}px) scale(${sx}, ${sy}) rotate(${rotation}deg)`;
    }

    _fadeValues(command) {
        const args = command.args || [];
        return {
            fadeIn: command.fadeIn ?? args[1] ?? 10,
            hold: command.hold ?? args[2] ?? 0,
            fadeOut: command.fadeOut ?? args[3] ?? 10,
            r: command.r ?? args[4] ?? 255,
            g: command.g ?? args[5] ?? 255,
            b: command.b ?? args[6] ?? 255,
            a: command.a ?? args[7] ?? 255,
        };
    }

    _exec(command) {
        switch (command.type) {
            case 'changeAnime':
                this.charaLayer.changeAnime(command.chara, command.anime, false);
                break;
            case 'changeAnimeAndStop':
                this.charaLayer.changeAnime(command.chara, command.anime, true);
                break;
            case 'setAnimeLoop':
                this.charaLayer.setAnimeLoop(command.chara, command.loop);
                break;
            case 'setDisp':
                this.charaLayer.setDisp(command.chara, command.disp);
                break;
            case 'setDrawFront':
                this.charaLayer.setDrawFront(command.chara, command.on);
                break;
            case 'entryEffect':
                this._activateEffect(command);
                break;
            case 'playSe':
            case 'playSeLife':
            case 'playSeVer2':
                this._playSound(command);
                break;
            case 'playVoice':
                this._playSound(command, 'voice');
                break;
            case 'stopVoice':
                for (const [workId, sound] of this.activeSounds) {
                    if (sound.kind === 'voice') this._stopSound(workId);
                }
                break;
            case 'setVoiceVolume': {
                const cueId = Number(command.cueId);
                const volume = scriptVolume(command.vol, VOICE_DEFAULT_VOLUME);
                this.voiceVolumes.set(cueId, volume);
                for (const sound of this.activeSounds.values()) {
                    if (sound.kind === 'voice' && sound.cueId === cueId && sound.gain && this.audioContext) {
                        sound.gain.gain.setValueAtTime(volume, this.audioContext.currentTime);
                    }
                }
                break;
            }
            case 'stopSe':
            case 'stopSeQueueId':
                this._stopSound(command.workId ?? command.args?.[1] ?? command.args?.[0]);
                break;
            case 'stopSeIfDoubleSpeed':
                if (this.highSpeed) this._stopSound(command.workId ?? command.args?.[1] ?? command.args?.[0]);
                break;
            case 'setSeVolume':
            case 'setSeVolumeByWorkId': {
                const sound = this.activeSounds.get(Number(command.workId));
                if (sound?.gain && this.audioContext) {
                    sound.gain.gain.setValueAtTime(scriptVolume(command.vol), this.audioContext.currentTime);
                }
                break;
            }
            case 'setStartTimeMs':
                this.soundStartOffsets.set(Number(command.workId), Math.max(0, Number(command.ms) || 0));
                break;
            case 'setPitch': {
                const workId = Number(command.workId);
                const cents = Number(command.pitch) || 0;
                this.soundPitchCents.set(workId, cents);
                const sound = this.activeSounds.get(workId);
                if (sound?.source) {
                    const stretch = clampSoundRate(this.soundTimeStretch.get(workId) ?? 1);
                    sound.playbackRate = clampSoundRate(stretch * soundRateFromCents(cents));
                    sound.source.playbackRate.value = sound.playbackRate;
                }
                break;
            }
            case 'setTimeStretch': {
                const workId = Number(command.workId);
                const stretch = Math.max(0.05, Number(command.stretch) || 1);
                this.soundTimeStretch.set(workId, stretch);
                const sound = this.activeSounds.get(workId);
                if (sound?.source) {
                    const pitch = Number(this.soundPitchCents.get(workId)) || 0;
                    sound.playbackRate = clampSoundRate(stretch * soundRateFromCents(pitch));
                    sound.source.playbackRate.value = sound.playbackRate;
                }
                break;
            }
            case 'setEffShake': {
                const entry = this.activeEffects.get(Number(command.workId));
                if (entry) {
                    entry.shakeFrames = Math.max(0, finite(command.a));
                    entry.shakePower = Math.abs(finite(command.b, 4));
                }
                break;
            }
            case 'removeAllEffect':
                for (const workId of [...this.activeEffects.keys()]) this._deactivateEffect(workId);
                break;
            case 'pauseAll':
            case 'delayAll':
                this.pauseRemain = Math.max(this.pauseRemain, finite(command.duration));
                break;
            case 'entryFade': {
                const values = this._fadeValues(command);
                this.screenFade.entryFade(values.fadeIn, values.hold, values.fadeOut, values.r, values.g, values.b, values.a);
                break;
            }
            case 'entryFadeBg': {
                const values = this._fadeValues(command);
                this.backgroundLayer.entryFade(values.fadeIn, values.hold, values.fadeOut, values.r, values.g, values.b, values.a);
                break;
            }
            case 'removeAllFade':
                this.screenFade.clear();
                this.screenFade.init();
                break;
            case 'removeAllFadeBg':
                this.backgroundLayer.clearFade();
                break;
            case 'setBgScroll':
                this.backgroundLayer.setScroll(command.speed ?? command.args?.[1]);
                break;
            case 'startBgScroll':
                this.backgroundLayer.startScroll(command.speed ?? command.args?.[1]);
                break;
            case 'stopBgScroll':
                this.backgroundLayer.stopScroll();
                break;
            case 'setBgMoveKey':
                this.backgroundLayer.setMove(command.x, command.y);
                break;
            case 'setBgScaleKey':
                this.backgroundLayer.setScale(command.sx, command.sy);
                break;
            case 'setBgRotateKey':
                this.backgroundLayer.setRotate(command.rot);
                break;
            case 'setQuake':
                this.backgroundLayer.setShake(command.power ?? command.args?.[2], command.duration ?? command.args?.[1]);
                break;
            case 'setShake':
            case 'setShakeKey':
            case 'setShakeXY':
                this.screenShake.setShake(command.power ?? command.args?.[2] ?? 8, command.duration ?? command.args?.[1] ?? 10);
                break;
            case 'setPhase':
            case 'gotoPhase':
                this.phase = Number(command.phase) || 0;
                break;
            case 'skipFrame':
                if (finite(command.toFrame) > this.frame) this.frame = finite(command.toFrame);
                break;
            case 'endPhase':
                this._finish();
                break;
            case 'setEnableAura':
                this.charaLayer.setEnableAura(command.chara, command.on);
                break;
            case 'setupMovie': {
                const contentId = Number(command.contentId);
                const movie = this.preparedMovies.get(contentId);
                if (movie) {
                    this._stopActiveMovies({ exceptContentId: contentId });
                    for (const [workId, effectEntry] of [...this.activeEffects.entries()]) {
                        if (Number(effectEntry.command.effectId) === contentId) this._deactivateEffect(workId);
                    }
                    const video = movie.video;
                    video.style.position = 'absolute';
                    video.style.inset = '0';
                    video.style.width = '100%';
                    video.style.height = '100%';
                    video.style.objectFit = 'contain';
                    video.style.pointerEvents = 'none';
                    video.style.zIndex = String(command.args?.[5] || 41);
                    video.style.opacity = '1';
                    video.style.filter = 'none';
                    video.style.mixBlendMode = 'normal';
                    const baseTime = Math.max(0, (Number(command.movieFrame) || 0) / FPS);
                    video.currentTime = baseTime;
                    video.playbackRate = this.highSpeed ? 2 : 1;
                    if (!video.parentElement) {
                        // The USM is the scene plate. Lua-controlled attacker
                        // and enemy LWF sprites must remain visible above it.
                        this.layers.backEffects.appendChild(video);
                    }
                    video.style.display = 'block';
                    video.play().catch(() => {});
                    const activeMovie = {
                        movie,
                        startFrame: this.frame,
                        baseTime,
                        elapsedSeconds: 0,
                    };
                    video.onended = () => {
                        video.style.display = 'none';
                        video.remove();
                        if (this.activeMovies.get(contentId) === activeMovie) this.activeMovies.delete(contentId);
                    };
                    this.activeMovies.set(contentId, activeMovie);
                }
                break;
            }
            case 'playMovie': {
                const id = Number(command.contentId || command.args?.[1] || 0);
                const active = this.activeMovies.get(id) || this.preparedMovies.get(id);
                const video = active?.video || active?.movie?.video;
                video?.play()?.catch(() => {});
                break;
            }
            case 'pauseMovie': {
                const id = Number(command.contentId || command.args?.[1] || 0);
                const active = this.activeMovies.get(id) || this.preparedMovies.get(id);
                const video = active?.video || active?.movie?.video;
                video?.pause();
                break;
            }
            case 'stopMovie': {
                const id = Number(command.contentId || command.args?.[1] || 0);
                const active = this.activeMovies.get(id);
                if (active) {
                    active.movie.video.pause();
                    active.movie.video.style.display = 'none';
                    active.movie.video.remove();
                    this.activeMovies.delete(id);
                }
                break;
            }
            case 'visibleMovie': {
                const id = Number(command.contentId || command.args?.[1] || 0);
                const active = this.activeMovies.get(id) || this.preparedMovies.get(id);
                const video = active?.video || active?.movie?.video;
                const vis = Number(command.visible ?? command.args?.[2] ?? 1);
                if (video) video.style.display = vis ? 'block' : 'none';
                break;
            }
            default:
                break;
        }
    }

    _finish() {
        if (!this.playing) return;
        this._haltClock();
        this._stopActiveMovies();
        this._stopPlayingSounds();
        this.onStatus?.('done', this);
        this.onDone?.(this);
    }
}
