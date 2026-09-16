/* ========================================================================== 
   absCustom - Battle background layers for ActionBank playback
   ========================================================================== */

const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0));

function makeLayer(className, zIndex) {
    const element = document.createElement('div');
    element.className = className;
    element.style.position = 'absolute';
    element.style.inset = '0';
    element.style.overflow = 'hidden';
    element.style.pointerEvents = 'none';
    element.style.zIndex = String(zIndex);
    return element;
}

function defaultBridgeUrl() {
    if (typeof window !== 'undefined') {
        const isLocal = window.location.protocol === 'file:'
            || window.location.hostname === 'localhost'
            || window.location.hostname === '127.0.0.1'
            || !window.location.hostname;
        if (isLocal) return 'http://127.0.0.1:3137';
    }
    return 'https://mollusk-fanfare-although.ngrok-free.dev';
}

export class BattleBgLayer {
    constructor({ host, serverUrl = defaultBridgeUrl(), log = console.log }) {
        this.host = host;
        this.serverUrl = String(serverUrl).replace(/\/$/, '');
        this.log = log;
        this.root = null;
        this.fade = null;
        this.layers = [];
        this.meta = null;
        this.loadedId = 0;
        this.scroll = 0;
        this.scrollSpeed = 0;
        this.scrolling = false;
        this.x = 0;
        this.y = 0;
        this.sx = 1;
        this.sy = 1;
        this.rotation = 0;
        this.shakeFrames = 0;
        this.shakePower = 0;
        this.fadeState = null;
    }

    setServerUrl(url) {
        this.serverUrl = String(url || defaultBridgeUrl()).replace(/\/$/, '');
    }

    ensureHost() {
        if (!this.host) return null;
        if (this.root?.isConnected && this.root.parentElement === this.host) return this.root;

        this.root = makeLayer('abs-battle-bg-root', 0);
        this.root.style.transformOrigin = '50% 50%';
        this.host.appendChild(this.root);

        this.fade = makeLayer('abs-battle-bg-fade', 20);
        this.fade.style.opacity = '0';
        this.root.appendChild(this.fade);
        return this.root;
    }

    async loadLevelBg(bgId = 1) {
        const id = Math.max(0, Number(bgId) || 0);
        this.clear();
        if (!id) return null;

        const headers = this.serverUrl && this.serverUrl.includes('ngrok')
            ? { 'ngrok-skip-browser-warning': 'true' }
            : {};
        const response = await fetch(`${this.serverUrl}/api/level-bg/${id}`, {
            cache: 'no-store',
            ...(Object.keys(headers).length ? { headers } : {})
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.found) {
            throw new Error(payload.error || `Battle background ${id} was not found.`);
        }

        this.meta = payload;
        this.loadedId = id;
        const root = this.ensureHost();
        const waits = [];

        for (const layer of payload.layers || []) {
            if (!layer.enabled || !layer.url) continue;
            const image = document.createElement('img');
            image.className = 'abs-battle-bg-image';
            image.alt = '';
            image.draggable = false;
            image.src = layer.url;
            image.style.position = 'absolute';
            image.style.left = '50%';
            image.style.top = '50%';
            image.style.width = '100%';
            image.style.height = '100%';
            image.style.objectFit = 'cover';
            image.style.pointerEvents = 'none';
            image.style.zIndex = String(Number(layer.index) || 0);
            root.insertBefore(image, this.fade);
            this.layers.push({
                image,
                coefficient: Number(layer.coef) || 0,
            });
            waits.push(new Promise((resolve) => {
                if (image.complete) resolve();
                else {
                    image.addEventListener('load', resolve, { once: true });
                    image.addEventListener('error', resolve, { once: true });
                }
            }));
        }

        await Promise.allSettled(waits);
        this.applyTransform();
        this.log(`Loaded battle background ${id} with ${this.layers.length} layer(s)`);
        return payload;
    }

    resetPlayback() {
        this.scroll = 0;
        this.scrollSpeed = 0;
        this.scrolling = false;
        this.x = 0;
        this.y = 0;
        this.sx = 1;
        this.sy = 1;
        this.rotation = 0;
        this.shakeFrames = 0;
        this.shakePower = 0;
        this.clearFade();
        this.applyTransform();
    }

    clear() {
        this.root?.remove?.();
        this.root = null;
        this.fade = null;
        this.layers = [];
        this.meta = null;
        this.loadedId = 0;
        this.resetPlayback();
    }

    setScroll(speed) {
        this.scrollSpeed = Number(speed) || 0;
    }

    startScroll(speed) {
        if (speed !== undefined) this.setScroll(speed);
        this.scrolling = true;
    }

    stopScroll() {
        this.scrolling = false;
    }

    setMove(x, y) {
        this.x = Number(x) || 0;
        this.y = Number(y) || 0;
        this.applyTransform();
    }

    setScale(sx, sy) {
        this.sx = Number(sx) || 1;
        this.sy = sy === undefined ? this.sx : (Number(sy) || 1);
        this.applyTransform();
    }

    setRotate(rotation) {
        this.rotation = Number(rotation) || 0;
        this.applyTransform();
    }

    setShake(power, duration) {
        this.shakePower = Math.max(this.shakePower, Math.abs(Number(power) || 0));
        this.shakeFrames = Math.max(this.shakeFrames, Number(duration) || 0);
    }

    entryFade(fadeIn, hold, fadeOut, r, g, b, a) {
        this.ensureHost();
        this.fadeState = {
            frame: 0,
            fadeIn: Math.max(0, Number(fadeIn) || 0),
            hold: Math.max(0, Number(hold) || 0),
            fadeOut: Math.max(0, Number(fadeOut) || 0),
            alpha: clamp01((Number(a) || 0) / 255),
        };
        if (this.fade) {
            this.fade.style.backgroundColor = `rgb(${Number(r) || 0}, ${Number(g) || 0}, ${Number(b) || 0})`;
            this.fade.style.opacity = '0';
        }
    }

    clearFade() {
        this.fadeState = null;
        if (this.fade) this.fade.style.opacity = '0';
    }

    tick(frameDelta = 1, { paused = false } = {}) {
        if (!paused && this.scrolling) {
            this.scroll += this.scrollSpeed * frameDelta;
        }
        if (!paused && this.shakeFrames > 0) {
            this.shakeFrames = Math.max(0, this.shakeFrames - frameDelta);
            if (!this.shakeFrames) this.shakePower = 0;
        }
        this.tickFade(frameDelta);
        this.applyTransform();
    }

    tickFade(frameDelta) {
        const state = this.fadeState;
        if (!state || !this.fade) return;
        state.frame += frameDelta;
        const endIn = state.fadeIn;
        const endHold = endIn + state.hold;
        const endOut = endHold + state.fadeOut;
        let opacity = 0;

        if (state.frame < endIn) {
            opacity = endIn ? state.alpha * (state.frame / endIn) : state.alpha;
        } else if (state.frame < endHold) {
            opacity = state.alpha;
        } else if (state.frame < endOut) {
            opacity = state.fadeOut
                ? state.alpha * (1 - ((state.frame - endHold) / state.fadeOut))
                : 0;
        } else {
            this.clearFade();
            return;
        }
        this.fade.style.opacity = String(clamp01(opacity));
    }

    applyTransform() {
        if (!this.root) return;
        const logicalScale = Math.min(
            (this.host?.clientWidth || 852) / 852,
            (this.host?.clientHeight || 1536) / 1536,
        ) || 1;
        const shakeX = this.shakeFrames > 0 ? (Math.random() * 2 - 1) * this.shakePower : 0;
        const shakeY = this.shakeFrames > 0 ? (Math.random() * 2 - 1) * this.shakePower : 0;
        this.root.style.transform = `translate(${((this.x + shakeX) * logicalScale).toFixed(2)}px, ${((-this.y + shakeY) * logicalScale).toFixed(2)}px) scale(${this.sx}, ${this.sy}) rotate(${this.rotation}deg)`;

        for (const layer of this.layers) {
            const offset = this.scroll * (layer.coefficient / 100) * logicalScale;
            layer.image.style.transform = `translate(calc(-50% + ${offset.toFixed(2)}px), -50%)`;
        }
    }
}
