/* ==========================================================================
   absCustom - Dokkan Lua API Binders for ActionBank Runner
   ========================================================================== */

import { getFengari, num, str } from './lua-host.js';

export const BIND_COMMAND_NAMES = [
    'changeBgm',
    'setEnvZoomEnable',
    'setMoveKey',
    'setScaleKey',
    'setRotateKey',
    'setLastPosKey',
    'setGaussBlurKey',
    'setDisp',
    'setDrawFront',
    'setEnableAura',
    'changeAnime',
    'setAnimeLoop',
    'changeAnimeAndStop',
    'setDamage',
    'setShakeChara',
    'setZanzou',
    'setZanzouSpeed',
    'setZanzouColor',
    'setBlendColor',
    'setAlphaKey',
    'entryCharaView',
    'entryEffect',
    'entryEffectUnpausable',
    'entryEffectLife',
    'entryEffectTraining',
    'entryEffectAwaken',
    'setEffReplaceTexture',
    'setEffReplaceTextureByCardId',
    'setEffReplaceTextureByFilename',
    'setEnableAutoXFlip',
    'setEffMoveKey',
    'setEffScaleKey',
    'setEffRotateKey',
    'setEffColorKey',
    'setEffAlphaKey',
    'setEffShake',
    'removeAllEffect',
    'setEffBlendColor',
    'getEfficacyCutInCount',
    'getEfficacyCutInPath',
    'getEfficacyCutInFramePath',
    'HIDE_EFFECT_PHRASE_TEXTURES',
    'entryKakimoji',
    'setupMovie',
    'stopMovie',
    'pauseMovie',
    'visibleMovie',
    'scaleMovie',
    'setPhase',
    'endPhase',
    'gotoPhase',
    'pauseChara',
    'delayChara',
    'pauseAll',
    'delayAll',
    'dealDamage',
    'recover',
    'setVisibleUI',
    'setTriggerGaugeVisible',
    'showCountdownLabel',
    'hideCountdownLabel',
    'showMessageLabel',
    'showMessageLabelFlexible',
    'hideMessageLabel',
    'showEfficacyCutinLabel',
    'hideEfficacyCutinLabel',
    'adjustAttackerLabel',
    'adjustEnemyLabel',
    'hideKoScreen',
    'fadeKoLabel',
    'skipFrame',
    'flipAttackerSide',
    'showAttackBreakEffects',
    'entryFlash',
    'entryFlashBg',
    'entryFade',
    'entryFadeBg',
    'removeAllFade',
    'removeAllFadeBg',
    'playSe',
    'playSeLife',
    'playSeVer2',
    'stopSe',
    'stopSeQueueId',
    'stopSeIfDoubleSpeed',
    'setSeVolume',
    'setSeVolumeByWorkId',
    'setStartTimeMs',
    'setTimeStretch',
    'setPitch',
    'setBandpassFilter',
    'ENABLE_AUTO_TIME_STRETCH',
    'playVoice',
    'stopVoice',
    'setVoiceVolume',
    'DISABLE_VOICE_IF_DOUBLE_SPEED',
    'wipeIn',
    'wipeOut',
    'wipeInOut',
];

export const EXTRA_BG_COMMAND_NAMES = [
    'setBgBlendColor',
    'setBgMoveKey',
    'setBgRotateKey',
    'setBgScaleKey',
    'setBgScroll',
    'setQuake',
    'setScreenOffset',
    'setShake',
    'setShakeXY',
    'setShakeKey',
    'startBgScroll',
    'stopBgScroll',
];

function collectArgs(L) {
    const fg = getFengari();
    if (!fg) return [];
    const { lua } = fg;
    const n = lua.lua_gettop(L);
    const args = [];
    for (let i = 1; i <= n; i++) {
        if (lua.lua_isnumber(L, i)) args.push(num(L, i));
        else if (lua.lua_isstring(L, i)) args.push(str(L, i));
        else if (lua.lua_isboolean(L, i)) args.push(lua.lua_toboolean(L, i) ? 1 : 0);
        else if (lua.lua_isnil(L, i) || lua.lua_isnone(L, i)) args.push(null);
        else args.push(null);
    }
    return args;
}

export function installBinders(host, bank) {
    let nextWorkId = 1;
    const nextId = () => nextWorkId++;
    const registered = new Set();

    if (bank.phase == null) bank.phase = 0;
    if (!(bank.autoTimeScales instanceof Map)) bank.autoTimeScales = new Map();
    if (!(bank.effectTexRules instanceof Map)) bank.effectTexRules = new Map();

    const push = (cmd) => {
        bank.commands.push(cmd);
        return cmd;
    };

    const mark = (name, fn) => {
        host.register(name, fn);
        registered.add(name);
    };

    const enqueueNamed = (type) => (L) => {
        const args = collectArgs(L);
        push({ type, frame: Number(args[0]) || 0, args });
    };

    mark('setVisibleUI', (L) => {
        push({ type: 'setVisibleUI', frame: num(L, 1), visible: num(L, 2) });
    });

    mark('changeAnime', (L) => {
        push({ type: 'changeAnime', frame: num(L, 1), chara: num(L, 2), anime: num(L, 3) });
    });

    mark('changeAnimeAndStop', (L) => {
        push({
            type: 'changeAnimeAndStop',
            frame: num(L, 1),
            chara: num(L, 2),
            anime: num(L, 3),
            a: num(L, 4),
            b: num(L, 5),
        });
    });

    mark('setAnimeLoop', (L) => {
        push({ type: 'setAnimeLoop', frame: num(L, 1), chara: num(L, 2), loop: num(L, 3) });
    });

    mark('setDisp', (L) => {
        push({ type: 'setDisp', frame: num(L, 1), chara: num(L, 2), disp: num(L, 3) });
    });

    mark('setMoveKey', (L) => {
        push({
            type: 'setMoveKey',
            frame: num(L, 1),
            chara: num(L, 2),
            x: num(L, 3),
            y: num(L, 4),
            z: num(L, 5),
        });
    });

    mark('setScaleKey', (L) => {
        push({
            type: 'setScaleKey',
            frame: num(L, 1),
            chara: num(L, 2),
            sx: num(L, 3),
            sy: num(L, 4),
        });
    });

    mark('setRotateKey', (L) => {
        push({ type: 'setRotateKey', frame: num(L, 1), chara: num(L, 2), rot: num(L, 3) });
    });

    mark('setAlphaKey', (L) => {
        push({ type: 'setAlphaKey', frame: num(L, 1), chara: num(L, 2), alpha: num(L, 3) });
    });

    mark('setBlendColor', (L) => {
        push({
            type: 'setBlendColor',
            frame: num(L, 1),
            chara: num(L, 2),
            mode: num(L, 3),
            r: num(L, 4),
            g: num(L, 5),
            b: num(L, 6),
            a: num(L, 7),
        });
    });

    mark('setLastPosKey', enqueueNamed('setLastPosKey'));
    mark('setGaussBlurKey', enqueueNamed('setGaussBlurKey'));
    mark('setDrawFront', (L) => {
        push({
            type: 'setDrawFront',
            frame: num(L, 1),
            chara: num(L, 2),
            on: num(L, 3),
        });
    });

    mark('setEnableAura', (L) => {
        push({
            type: 'setEnableAura',
            frame: num(L, 1),
            chara: num(L, 2),
            on: num(L, 3),
        });
    });

    mark('setDamage', enqueueNamed('setDamage'));
    mark('setShakeChara', enqueueNamed('setShakeChara'));
    mark('setZanzou', enqueueNamed('setZanzou'));
    mark('setZanzouSpeed', enqueueNamed('setZanzouSpeed'));
    mark('setZanzouColor', enqueueNamed('setZanzouColor'));
    mark('entryCharaView', enqueueNamed('entryCharaView'));

    const normalizeEffAttr = (effectId, attr, { life = 0, zOrder = 0 } = {}) => {
        let a = Number(attr) || 0;
        const lifeN = Number(life) || 0;
        a |= lifeN < 1 ? 0x1 : 0x11;
        const id = Number(effectId) || 0;
        const special =
            (id >= 10000 && id < 10100) ||
            (id >= 1500 && id <= 1510) ||
            (id >= 1120 && id <= 1129);
        if (special) a |= 0x1000;
        if ((Number(zOrder) || 0) !== 0) a |= 0x2000;
        return a >>> 0;
    };

    mark('entryEffect', (L) => {
        const id = nextId();
        const effectId = num(L, 2);
        const zOrder = num(L, 8);
        push({
            type: 'entryEffect',
            frame: num(L, 1),
            effectId,
            attr: normalizeEffAttr(effectId, num(L, 3), { life: 0, zOrder }),
            target: num(L, 4),
            tparam: num(L, 5),
            x: num(L, 6),
            y: num(L, 7),
            zOrder,
            workId: id,
            life: 0,
            lifeLimited: false,
            pausable: true,
        });
        return id;
    });

    mark('entryEffectUnpausable', (L) => {
        const id = nextId();
        const effectId = num(L, 2);
        const zOrder = num(L, 8);
        push({
            type: 'entryEffect',
            frame: num(L, 1),
            effectId,
            attr: normalizeEffAttr(effectId, num(L, 3), { life: 0, zOrder }),
            target: num(L, 4),
            tparam: num(L, 5),
            x: num(L, 6),
            y: num(L, 7),
            zOrder,
            workId: id,
            life: 0,
            lifeLimited: false,
            pausable: false,
        });
        return id;
    });

    mark('entryEffectLife', (L) => {
        const id = nextId();
        const life = num(L, 3);
        const effectId = num(L, 2);
        const zOrder = num(L, 9);
        push({
            type: 'entryEffect',
            frame: num(L, 1),
            effectId,
            life,
            lifeLimited: life >= 1,
            attr: normalizeEffAttr(effectId, num(L, 4), { life, zOrder }),
            target: num(L, 5),
            tparam: num(L, 6),
            x: num(L, 7),
            y: num(L, 8),
            zOrder,
            workId: id,
            pausable: true,
        });
        return id;
    });

    mark('removeAllEffect', (L) => {
        push({ type: 'removeAllEffect', frame: num(L, 1) || 0, args: collectArgs(L) });
    });

    mark('entryEffectAwaken', (L) => {
        const id = nextId();
        push({ type: 'entryEffectAwaken', frame: num(L, 1), args: collectArgs(L), workId: id });
        return id;
    });

    mark('entryEffectTraining', (L) => {
        const id = nextId();
        push({ type: 'entryEffectTraining', frame: num(L, 1), args: collectArgs(L), workId: id });
        return id;
    });

    const effKey = (type) => (L) => {
        push({
            type,
            frame: num(L, 1),
            workId: num(L, 2),
            a: num(L, 3),
            b: num(L, 4),
            c: num(L, 5),
            d: num(L, 6),
            e: num(L, 7),
            args: collectArgs(L),
        });
    };

    mark('setEffMoveKey', effKey('setEffMoveKey'));
    mark('setEffScaleKey', effKey('setEffScaleKey'));
    mark('setEffRotateKey', effKey('setEffRotateKey'));
    mark('setEffColorKey', effKey('setEffColorKey'));
    mark('setEffAlphaKey', effKey('setEffAlphaKey'));
    mark('setEffShake', effKey('setEffShake'));
    mark('setEffBlendColor', effKey('setEffBlendColor'));

    mark('setEffReplaceTexture', (L) => {
        const workId = Number(num(L, 1));
        const slot = num(L, 2);
        const kind = num(L, 3);
        if (!(bank.effectTexRules instanceof Map)) bank.effectTexRules = new Map();
        const list = bank.effectTexRules.get(workId) || [];
        list.push({ slot, kind });
        bank.effectTexRules.set(workId, list);
    });

    mark('setEffReplaceTextureByCardId', (L) => {
        const workId = Number(num(L, 1));
        const slot = num(L, 2);
        const cardId = num(L, 3);
        const kind = num(L, 4);
        if (!(bank.effectTexRules instanceof Map)) bank.effectTexRules = new Map();
        const list = bank.effectTexRules.get(workId) || [];
        list.push({ slot, kind, cardId });
        bank.effectTexRules.set(workId, list);
    });

    mark('setEffReplaceTextureByFilename', (L) => {
        const workId = Number(num(L, 1));
        const slot = num(L, 2);
        const filename = str(L, 3);
        if (!(bank.effectTexRules instanceof Map)) bank.effectTexRules = new Map();
        const list = bank.effectTexRules.get(workId) || [];
        list.push({ slot, filename });
        bank.effectTexRules.set(workId, list);
    });

    mark('setEnableAutoXFlip', enqueueNamed('setEnableAutoXFlip'));
    mark('HIDE_EFFECT_PHRASE_TEXTURES', () => { bank.hideEffectPhraseTextures = true; });
    mark('getEfficacyCutInCount', () => 0);
    mark('getEfficacyCutInPath', () => '');
    mark('getEfficacyCutInFramePath', () => '');

    mark('playSe', (L) => {
        const id = nextId();
        const fg = getFengari();
        const vol = fg?.lua.lua_isnoneornil(L, 4) ? -1 : num(L, 4);
        push({
            type: 'playSe',
            frame: num(L, 1),
            cueId: num(L, 2),
            name: str(L, 3),
            vol,
            workId: id,
        });
        return id;
    });

    mark('playSeLife', (L) => {
        const id = nextId();
        const fg = getFengari();
        const vol = fg?.lua.lua_isnoneornil(L, 5) ? -1 : num(L, 5);
        push({
            type: 'playSeLife',
            frame: num(L, 1),
            cueId: num(L, 2),
            life: num(L, 3),
            name: str(L, 4),
            vol,
            args: collectArgs(L),
            workId: id,
        });
        return id;
    });

    mark('playSeVer2', (L) => {
        const id = nextId();
        const fg = getFengari();
        const vol = fg?.lua.lua_isnoneornil(L, 7) ? -1 : num(L, 7);
        push({
            type: 'playSeVer2',
            frame: num(L, 1),
            cueId: num(L, 2),
            name: str(L, 3),
            endFrame: num(L, 4),
            a: num(L, 5),
            b: num(L, 6),
            vol,
            workId: id,
        });
        return id;
    });

    mark('stopSe', enqueueNamed('stopSe'));
    mark('stopSeQueueId', enqueueNamed('stopSeQueueId'));
    mark('stopSeIfDoubleSpeed', enqueueNamed('stopSeIfDoubleSpeed'));
    mark('setSeVolumeByWorkId', (L) => {
        push({
            type: 'setSeVolumeByWorkId',
            frame: num(L, 1),
            workId: num(L, 2),
            vol: num(L, 3),
        });
    });
    mark('setSeVolume', (L) => {
        push({
            type: 'setSeVolume',
            frame: num(L, 1),
            workId: num(L, 2),
            vol: num(L, 3),
        });
    });
    mark('setStartTimeMs', (L) => {
        push({ type: 'setStartTimeMs', workId: num(L, 1), ms: num(L, 2) });
    });
    mark('setPitch', (L) => {
        const fg = getFengari();
        const n = fg?.lua.lua_gettop(L) || 0;
        if (n >= 3) {
            push({ type: 'setPitch', frame: num(L, 1), workId: num(L, 2), pitch: num(L, 3) });
        } else {
            push({ type: 'setPitch', workId: num(L, 1), pitch: num(L, 2) });
        }
    });

    mark('ENABLE_AUTO_TIME_STRETCH', (L) => {
        const scale = num(L, 1) || 1;
        const phase = bank.phase ?? 0;
        if (!(bank.autoTimeScales instanceof Map)) bank.autoTimeScales = new Map();
        bank.autoTimeScales.set(Number(phase), scale);
        bank.autoTimeStretch = scale;
    });

    mark('setTimeStretch', (L) => {
        push({
            type: 'setTimeStretch',
            workId: num(L, 1),
            stretch: num(L, 2),
            window: num(L, 3),
            quality: num(L, 4),
        });
    });

    mark('setBandpassFilter', enqueueNamed('setBandpassFilter'));

    mark('playVoice', (L) => {
        const id = nextId();
        const cueId = num(L, 2);
        const cueName = str(L, 3);
        push({
            type: 'playVoice',
            frame: num(L, 1),
            cueId,
            category: cueId,
            name: cueName,
            packageHint: cueName || '',
            workId: id,
        });
        return id;
    });

    mark('stopVoice', enqueueNamed('stopVoice'));
    mark('setVoiceVolume', (L) => {
        push({
            type: 'setVoiceVolume',
            frame: num(L, 1),
            cueId: num(L, 2),
            vol: num(L, 3),
        });
    });
    mark('DISABLE_VOICE_IF_DOUBLE_SPEED', () => { bank.disableVoiceIfDoubleSpeed = true; });

    mark('setupMovie', (L) => {
        const atFrame = num(L, 1) || 0;
        const movieFrame = num(L, 3) || 0;
        push({
            type: 'setupMovie',
            contentId: num(L, 2),
            movieFrame,
            flagA: num(L, 4),
            flagB: num(L, 5),
            frame: atFrame,
            args: collectArgs(L),
        });
    });
    mark('playMovie', (L) => {
        const args = collectArgs(L);
        push({
            type: 'playMovie',
            frame: Number(args[0]) || 0,
            contentId: args[1] != null ? Number(args[1]) : null,
            args,
        });
    });
    mark('isPlayMovie', () => true);
    mark('stopMovie', (L) => {
        const args = collectArgs(L);
        push({
            type: 'stopMovie',
            frame: Number(args[0]) || 0,
            contentId: args[1] != null ? Number(args[1]) : null,
            args,
        });
    });
    mark('pauseMovie', (L) => {
        const args = collectArgs(L);
        push({
            type: 'pauseMovie',
            frame: Number(args[0]) || 0,
            contentId: args[1] != null ? Number(args[1]) : null,
            flag: args[1] != null ? Number(args[1]) : 1,
            args,
        });
    });
    mark('visibleMovie', (L) => {
        const args = collectArgs(L);
        push({
            type: 'visibleMovie',
            frame: Number(args[0]) || 0,
            contentId: args[1] != null ? Number(args[1]) : null,
            visible: args[2] != null ? Number(args[2]) : 1,
            args,
        });
    });
    mark('scaleMovie', enqueueNamed('scaleMovie'));

    mark('setPhase', (L) => {
        bank.phase = num(L, 1);
        push({ type: 'setPhase', frame: 0, phase: bank.phase });
    });
    mark('endPhase', (L) => {
        push({ type: 'endPhase', frame: num(L, 1) || 0, args: collectArgs(L) });
    });
    mark('gotoPhase', (L) => {
        push({ type: 'gotoPhase', frame: num(L, 1), phase: num(L, 2), args: collectArgs(L) });
    });
    mark('skipFrame', (L) => {
        push({
            type: 'skipFrame',
            frame: 0,
            phase: num(L, 1) || 0,
            toFrame: num(L, 2) || 0,
            args: collectArgs(L),
        });
    });

    mark('pauseAll', (L) => {
        push({
            type: 'pauseAll',
            frame: num(L, 1) || 0,
            duration: Math.max(0, num(L, 2) || 0),
        });
    });

    mark('delayAll', (L) => {
        push({
            type: 'delayAll',
            frame: num(L, 1) || 0,
            duration: Math.max(0, num(L, 2) || 0),
            flag: num(L, 3) || 0,
        });
    });

    mark('delayChara', (L) => {
        push({
            type: 'delayChara',
            frame: num(L, 1) || 0,
            chara: num(L, 2),
            duration: Math.max(0, num(L, 3) || 0),
        });
    });

    mark('pauseChara', (L) => {
        push({
            type: 'pauseChara',
            frame: num(L, 1) || 0,
            chara: num(L, 2),
            duration: Math.max(0, num(L, 3) || 0),
        });
    });

    mark('entryFade', (L) => {
        push({
            type: 'entryFade',
            frame: num(L, 1) || 0,
            args: collectArgs(L),
        });
    });

    mark('entryFadeBg', (L) => {
        push({
            type: 'entryFadeBg',
            frame: num(L, 1) || 0,
            fadeIn: num(L, 2) || 0,
            hold: num(L, 3) || 0,
            fadeOut: num(L, 4) || 0,
            r: num(L, 5) || 0,
            g: num(L, 6) || 0,
            b: num(L, 7) || 0,
            a: num(L, 8) || 0,
            args: collectArgs(L),
        });
    });

    mark('setBgScroll', (L) => {
        push({
            type: 'setBgScroll',
            frame: num(L, 1) || 0,
            speed: num(L, 2) || 0,
            args: collectArgs(L),
        });
    });

    mark('startBgScroll', (L) => {
        push({
            type: 'startBgScroll',
            frame: num(L, 1) || 0,
            speed: num(L, 2) || 0,
            args: collectArgs(L),
        });
    });

    mark('stopBgScroll', (L) => {
        push({ type: 'stopBgScroll', frame: num(L, 1) || 0, args: collectArgs(L) });
    });

    mark('setBgMoveKey', (L) => {
        push({
            type: 'setBgMoveKey',
            frame: num(L, 1) || 0,
            x: num(L, 2) || 0,
            y: num(L, 3) || 0,
            args: collectArgs(L),
        });
    });

    mark('setBgScaleKey', (L) => {
        push({
            type: 'setBgScaleKey',
            frame: num(L, 1) || 0,
            sx: num(L, 2) || 1,
            sy: num(L, 3) || num(L, 2) || 1,
            args: collectArgs(L),
        });
    });

    mark('setBgRotateKey', (L) => {
        push({
            type: 'setBgRotateKey',
            frame: num(L, 1) || 0,
            rot: num(L, 2) || 0,
            args: collectArgs(L),
        });
    });

    mark('setQuake', (L) => {
        push({
            type: 'setQuake',
            frame: num(L, 1) || 0,
            duration: num(L, 2) || 0,
            power: num(L, 3) || 0,
            args: collectArgs(L),
        });
    });

    mark('setShake', (L) => {
        push({
            type: 'setShake',
            frame: num(L, 1) || 0,
            duration: num(L, 2) || 0,
            power: num(L, 3) || 0,
            args: collectArgs(L),
        });
    });

    mark('entryFlash', enqueueNamed('entryFlash'));
    mark('entryFlashBg', enqueueNamed('entryFlashBg'));
    mark('removeAllFade', enqueueNamed('removeAllFade'));
    mark('removeAllFadeBg', enqueueNamed('removeAllFadeBg'));
    mark('wipeIn', enqueueNamed('wipeIn'));
    mark('wipeOut', enqueueNamed('wipeOut'));
    mark('wipeInOut', enqueueNamed('wipeInOut'));
    mark('changeBgm', enqueueNamed('changeBgm'));
    mark('setEnvZoomEnable', enqueueNamed('setEnvZoomEnable'));
    mark('entryKakimoji', enqueueNamed('entryKakimoji'));

    const sceneStubs = [
        'dealDamage',
        'recover',
        'setTriggerGaugeVisible',
        'showCountdownLabel',
        'hideCountdownLabel',
        'showMessageLabel',
        'showMessageLabelFlexible',
        'hideMessageLabel',
        'showEfficacyCutinLabel',
        'hideEfficacyCutinLabel',
        'adjustAttackerLabel',
        'adjustEnemyLabel',
        'hideKoScreen',
        'fadeKoLabel',
        'flipAttackerSide',
        'showAttackBreakEffects',
    ];
    for (const name of sceneStubs) mark(name, enqueueNamed(name));

    if (!registered.has('setTriggerGaugeVisibie')) {
        mark('setTriggerGaugeVisibie', enqueueNamed('setTriggerGaugeVisible'));
    }

    for (const name of [...BIND_COMMAND_NAMES, ...EXTRA_BG_COMMAND_NAMES]) {
        if (registered.has(name)) continue;
        mark(name, enqueueNamed(name));
    }

    return { nextId, registered: [...registered] };
}
