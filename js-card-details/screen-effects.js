/* ==========================================================================
   absCustom - Screen Effects: Color Fades, Screen Shakes, and Transitions
   ========================================================================== */

export class ScreenFade {
    constructor(stageContainer) {
        this.container = stageContainer;
        this.overlay = null;
        this.activeFade = null;
        this.init();
    }

    init() {
        if (!this.container) return;
        let el = this.container.querySelector('.abs-screen-fade-overlay');
        if (!el) {
            el = document.createElement('div');
            el.className = 'abs-screen-fade-overlay';
            el.style.position = 'absolute';
            el.style.inset = '0';
            el.style.pointerEvents = 'none';
            el.style.zIndex = '300';
            el.style.opacity = '0';
            el.style.backgroundColor = 'transparent';
            el.style.transition = 'none';
            this.container.appendChild(el);
        }
        this.overlay = el;
    }

    entryFade(fadeIn = 10, hold = 0, fadeOut = 10, r = 255, g = 255, b = 255, a = 255) {
        const total = (Number(fadeIn) || 0) + (Number(hold) || 0) + (Number(fadeOut) || 0);
        if (total <= 0) return;
        this.activeFade = {
            frame: 0,
            fadeIn: Number(fadeIn) || 0,
            hold: Number(hold) || 0,
            fadeOut: Number(fadeOut) || 0,
            r: Math.min(255, Math.max(0, Number(r) || 0)),
            g: Math.min(255, Math.max(0, Number(g) || 0)),
            b: Math.min(255, Math.max(0, Number(b) || 0)),
            maxAlpha: (Number(a) || 255) / 255,
        };
        this.render();
    }

    tick(dtFrames = 1) {
        if (!this.activeFade) return;
        this.activeFade.frame += dtFrames;
        const { frame, fadeIn, hold, fadeOut, r, g, b, maxAlpha } = this.activeFade;
        let alpha = 0;

        if (frame <= fadeIn && fadeIn > 0) {
            alpha = (frame / fadeIn) * maxAlpha;
        } else if (frame <= fadeIn + hold) {
            alpha = maxAlpha;
        } else if (frame <= fadeIn + hold + fadeOut && fadeOut > 0) {
            const outFrame = frame - (fadeIn + hold);
            alpha = (1 - (outFrame / fadeOut)) * maxAlpha;
        } else {
            this.clear();
            return;
        }

        if (this.overlay) {
            this.overlay.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
            this.overlay.style.opacity = String(Math.max(0, Math.min(1, alpha)));
        }
    }

    render() {
        this.tick(0);
    }

    clear() {
        this.activeFade = null;
        if (this.overlay) {
            this.overlay.style.opacity = '0';
            this.overlay.style.backgroundColor = 'transparent';
        }
    }
}

export class ScreenShake {
    constructor(stageElement) {
        this.target = stageElement;
        this.activeShake = null;
    }

    setShake(power = 8, duration = 10) {
        this.activeShake = {
            frame: 0,
            duration: Math.max(1, Number(duration) || 10),
            power: Math.max(1, Number(power) || 8),
        };
    }

    tick(dtFrames = 1) {
        if (!this.activeShake || !this.target) return;
        this.activeShake.frame += dtFrames;
        const { frame, duration, power } = this.activeShake;

        if (frame >= duration) {
            this.clear();
            return;
        }

        const decay = 1 - (frame / duration);
        const currentPower = power * decay;
        const offsetX = (Math.random() * 2 - 1) * currentPower;
        const offsetY = (Math.random() * 2 - 1) * currentPower;

        this.target.style.transform = `translate(${offsetX.toFixed(1)}px, ${offsetY.toFixed(1)}px)`;
    }

    clear() {
        this.activeShake = null;
        if (this.target) {
            this.target.style.transform = '';
        }
    }
}
