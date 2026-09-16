import { LwfPackPlayer } from './lwf-pack.js';

const assetNames = [
    'dokkan_mode.lwf',
    'dokkan_mode-1.png',
    'dokkan_mode-2.png',
    'dokkan_mode-3.png',
    'mask_bk.png'
];

const canvas = document.getElementById('auraCanvas');
const stage = document.getElementById('previewStage');
const loopStartInput = document.getElementById('loopStart');
const loopEndInput = document.getElementById('loopEnd');
const speedInput = document.getElementById('speed');
const speedValue = document.getElementById('speedValue');
const frameScrub = document.getElementById('frameScrub');
const frameValue = document.getElementById('frameValue');
const playPauseButton = document.getElementById('playPause');
const restartButton = document.getElementById('restart');
const currentPresetButton = document.getElementById('currentPreset');
const fullPresetButton = document.getElementById('fullPreset');
const viewMode = document.getElementById('viewMode');
const previewZoom = document.getElementById('previewZoom');
const zoomValue = document.getElementById('zoomValue');
const status = document.getElementById('status');

let player = null;
let totalFrames = 60;
let draggingFrame = false;

async function makeBlackTransparent(imageBlob) {
    const image = await new Promise((resolve, reject) => {
        const element = new Image();
        const imageUrl = URL.createObjectURL(imageBlob);
        element.onload = () => {
            URL.revokeObjectURL(imageUrl);
            resolve(element);
        };
        element.onerror = (error) => {
            URL.revokeObjectURL(imageUrl);
            reject(error);
        };
        element.src = imageUrl;
    });
    const output = document.createElement('canvas');
    output.width = image.naturalWidth || image.width;
    output.height = image.naturalHeight || image.height;
    const context = output.getContext('2d');
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, output.width, output.height);
    for (let index = 0; index < pixels.data.length; index += 4) {
        pixels.data[index + 3] = Math.max(
            pixels.data[index],
            pixels.data[index + 1],
            pixels.data[index + 2]
        );
    }
    context.putImageData(pixels, 0, 0);
    return new Promise((resolve) => output.toBlob(resolve, 'image/png'));
}

function clampLoopInputs() {
    const start = Math.max(1, Math.min(totalFrames - 1, Number(loopStartInput.value) || 1));
    const end = Math.max(start + 1, Math.min(totalFrames, Number(loopEndInput.value) || totalFrames));
    loopStartInput.value = String(start);
    loopEndInput.value = String(end);
    return { start, end };
}

function updateStatus(frameState = player?.getFrameState?.()) {
    const frame = Math.max(1, Math.floor(Number(frameState?.current) || 1));
    if (!draggingFrame) frameScrub.value = String(Math.min(totalFrames, frame));
    frameValue.value = String(frame);
    speedValue.value = `${Number(speedInput.value).toFixed(2)}×`;
    status.textContent = player
        ? `Movie: ef_002\nMovie scale: 2.60×\nFrame: ${frame} / ${totalFrames}\nLoop: ${player.loopStartFrame}–${player.loopEndFrame}\nSpeed: ${player.playbackRate.toFixed(2)}×\nState: ${player.playing ? 'playing' : 'paused'}`
        : 'Loading LWF pack…';
    playPauseButton.textContent = player?.playing ? 'Pause' : 'Play';
}

function applyLoop({ restart = true } = {}) {
    if (!player) return;
    const { start, end } = clampLoopInputs();
    player.loopStartFrame = start;
    player.loopEndFrame = end;
    if (restart) player.seekFrame(start, { play: player.playing });
    updateStatus();
}

loopStartInput.addEventListener('change', () => applyLoop());
loopEndInput.addEventListener('change', () => applyLoop());

speedInput.addEventListener('input', () => {
    if (player) player.playbackRate = Number(speedInput.value);
    updateStatus();
});

frameScrub.addEventListener('pointerdown', () => { draggingFrame = true; });
window.addEventListener('pointerup', () => { draggingFrame = false; });
frameScrub.addEventListener('input', () => {
    if (!player) return;
    const wasPlaying = player.playing;
    player.seekFrame(Number(frameScrub.value), { play: false });
    if (wasPlaying) player.pause();
    updateStatus();
});

playPauseButton.addEventListener('click', () => {
    if (!player) return;
    if (player.playing) player.pause();
    else player.play();
    updateStatus();
});

restartButton.addEventListener('click', () => {
    if (!player) return;
    const { start } = clampLoopInputs();
    player.seekFrame(start, { play: true });
    updateStatus();
});

currentPresetButton.addEventListener('click', () => {
    loopStartInput.value = '22';
    loopEndInput.value = String(Math.min(50, totalFrames));
    speedInput.value = '0.55';
    player.playbackRate = 0.55;
    applyLoop();
});

fullPresetButton.addEventListener('click', () => {
    loopStartInput.value = '1';
    loopEndInput.value = String(totalFrames);
    speedInput.value = '1';
    player.playbackRate = 1;
    applyLoop();
});

viewMode.addEventListener('change', () => {
    stage.classList.toggle('card-mask', viewMode.value === 'card');
});

previewZoom.addEventListener('input', () => {
    stage.style.setProperty('--preview-zoom', previewZoom.value);
    zoomValue.value = `${Number(previewZoom.value).toFixed(2)}×`;
});

stage.style.setProperty('--preview-zoom', previewZoom.value);

async function loadPreview() {
    try {
        const responses = await Promise.all(assetNames.map((name) => fetch(`assets/effects/dokkan-mode/${name}`)));
        const missing = responses.findIndex((response) => !response.ok);
        if (missing >= 0) throw new Error(`Missing assets/effects/dokkan-mode/${assetNames[missing]}`);
        const blobs = await Promise.all(responses.map((response) => response.blob()));
        const preparedBlobs = await Promise.all(blobs.map((blob, index) => (
            assetNames[index] === 'mask_bk.png' ? makeBlackTransparent(blob) : blob
        )));
        const files = preparedBlobs.map((blob, index) => new File([blob], assetNames[index]));

        player = new LwfPackPlayer(canvas, () => {}, { resourceKey: 'dokkan-mode-ef-002-preview' });
        player.loopMovie = true;
        player.loopStartFrame = 22;
        player.loopEndFrame = 50;
        player.playbackRate = 0.55;
        player.waitForNestedMoviesAtEnd = true;
        player.onFrame = updateStatus;

        const ingested = player.ingestFiles(files);
        if (!ingested.lwfFile) throw new Error('dokkan_mode.lwf could not be read');
        const check = await player.prepare(ingested.lwfFile);
        if (!check.ok) throw new Error(`Missing texture sheets: ${check.missing.join(', ')}`);
        await player.load();
        if (player.lwf?.rendererFactory) player.lwf.rendererFactory.clearColor = null;
        if (!player.setMovie('ef_002', { play: true })) throw new Error('Movie ef_002 is not in the pack');
        player.movie?.scaleTo?.(2.6, 2.6);

        totalFrames = Math.max(50, player.getRecordFrameCount());
        loopStartInput.max = String(totalFrames - 1);
        loopEndInput.max = String(totalFrames);
        frameScrub.max = String(totalFrames);
        player.seekFrame(22, { play: true });
        updateStatus();
    } catch (error) {
        console.error('Aura preview failed:', error);
        status.textContent = `Could not load preview:\n${error.message}`;
    }
}

loadPreview();
