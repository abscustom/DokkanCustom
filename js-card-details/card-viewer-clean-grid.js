/* ==========================================================================
   Published ABS.CLEAN grid

   This is the viewer-safe counterpart to the editor's cosmic grid painter.
   It intentionally contains only the presentation canvas; no editor state,
   controls, cache hooks, or import/export behavior are loaded on card.html.
   ========================================================================== */
(() => {
    'use strict';

    let animId = null;
    let canvas = null;
    let ctx = null;
    let baseCanvas = null;
    let baseCtx = null;
    let baseWidth = 0;
    let baseHeight = 0;
    let basePaletteKey = '';
    let lastFrameTime = 0;
    let frameCount = 0;
    const TARGET_FRAME_MS = 1000 / 30;
    const BACKGROUND_MAX_DPR = 1.25;
    const GRID = 36;
    const MAX_PULSES = 2;
    const pulses = [];
    let stars = [];
    let nebulae = [];

    const cosmicPalettes = {
        agl: {
            light: { nebula: 'rgba(37, 99, 235, 0.16)', line: 'rgba(37, 99, 235, 0.24)', pulse: 'rgba(37, 99, 235, 0.86)', halo: 'rgba(59, 130, 246, 0.72)', core: '#2563eb' },
            dark: { nebula: 'rgba(37, 99, 235, 0.20)', line: 'rgba(96, 165, 250, 0.18)', pulse: 'rgba(96, 165, 250, 0.82)', halo: 'rgba(59, 130, 246, 0.62)', core: '#60a5fa' }
        },
        teq: {
            light: { nebula: 'rgba(34, 197, 94, 0.16)', line: 'rgba(22, 163, 74, 0.24)', pulse: 'rgba(22, 163, 74, 0.86)', halo: 'rgba(34, 197, 94, 0.72)', core: '#16a34a' },
            dark: { nebula: 'rgba(34, 197, 94, 0.20)', line: 'rgba(74, 222, 128, 0.18)', pulse: 'rgba(74, 222, 128, 0.82)', halo: 'rgba(34, 197, 94, 0.62)', core: '#4ade80' }
        },
        int: {
            light: { nebula: 'rgba(168, 85, 247, 0.16)', line: 'rgba(126, 34, 206, 0.24)', pulse: 'rgba(126, 34, 206, 0.86)', halo: 'rgba(168, 85, 247, 0.72)', core: '#7e22ce' },
            dark: { nebula: 'rgba(168, 85, 247, 0.20)', line: 'rgba(192, 132, 252, 0.18)', pulse: 'rgba(192, 132, 252, 0.82)', halo: 'rgba(168, 85, 247, 0.62)', core: '#c084fc' }
        },
        str: {
            light: { nebula: 'rgba(239, 68, 68, 0.16)', line: 'rgba(185, 28, 28, 0.24)', pulse: 'rgba(185, 28, 28, 0.86)', halo: 'rgba(239, 68, 68, 0.72)', core: '#b91c1c' },
            dark: { nebula: 'rgba(239, 68, 68, 0.20)', line: 'rgba(248, 113, 113, 0.18)', pulse: 'rgba(248, 113, 113, 0.82)', halo: 'rgba(239, 68, 68, 0.62)', core: '#f87171' }
        },
        phy: {
            light: { nebula: 'rgba(234, 179, 8, 0.16)', line: 'rgba(202, 138, 4, 0.24)', pulse: 'rgba(202, 138, 4, 0.86)', halo: 'rgba(234, 179, 8, 0.72)', core: '#ca8a04' },
            dark: { nebula: 'rgba(234, 179, 8, 0.20)', line: 'rgba(253, 224, 71, 0.18)', pulse: 'rgba(253, 224, 71, 0.82)', halo: 'rgba(234, 179, 8, 0.62)', core: '#fde047' }
        },
        none: {
            light: { nebula: 'rgba(113, 113, 122, 0.14)', line: 'rgba(82, 82, 91, 0.20)', pulse: 'rgba(82, 82, 91, 0.78)', halo: 'rgba(113, 113, 122, 0.58)', core: '#52525b' },
            dark: { nebula: 'rgba(113, 113, 122, 0.16)', line: 'rgba(212, 212, 216, 0.16)', pulse: 'rgba(212, 212, 216, 0.72)', halo: 'rgba(161, 161, 170, 0.52)', core: '#d4d4d8' }
        }
    };

    function activeType() {
        const type = String(document.body?.dataset?.absCleanType || window.currentType || 'none').toLowerCase();
        return cosmicPalettes[type] ? type : 'none';
    }

    function activePalette(isLightMode) {
        return (cosmicPalettes[activeType()] || cosmicPalettes.none)[isLightMode ? 'light' : 'dark'];
    }

    function createRng(seed) {
        let value = seed;
        return () => {
            value = (value * 9301 + 49297) % 233280;
            return value / 233280;
        };
    }

    function initCosmos(width, height) {
        const rng = createRng(198906);
        stars = [];
        for (let index = 0; index < 90; index += 1) {
            stars.push({
                x: rng() * width,
                y: rng() * height,
                r: 0.35 + rng() * 0.65,
                alpha: 0.25 + rng() * 0.65,
                isBlue: rng() > 0.85,
                hasCross: false
            });
        }
        for (let index = 0; index < 22; index += 1) {
            stars.push({
                x: rng() * width,
                y: rng() * height,
                r: 0.8 + rng() * 0.9,
                alpha: 0.45 + rng() * 0.5,
                isBlue: rng() > 0.75,
                hasCross: rng() > 0.80
            });
        }

        nebulae = [
            { x: width * 0.25, y: height * 0.28, r: Math.max(width, height) * 0.25, c: 'rgba(12, 28, 48, 0.12)' },
            { x: width * 0.75, y: height * 0.35, r: Math.max(width, height) * 0.28, c: 'rgba(10, 22, 42, 0.14)' },
            { x: width * 0.45, y: height * 0.72, r: Math.max(width, height) * 0.30, c: 'rgba(14, 25, 45, 0.10)' },
            { x: width * 0.18, y: height * 0.82, r: Math.max(width, height) * 0.22, c: 'rgba(12, 30, 55, 0.08)' },
            { x: width * 0.82, y: height * 0.80, r: Math.max(width, height) * 0.24, c: 'rgba(10, 25, 48, 0.10)' }
        ];
    }

    function project(gridX, gridY, width, height) {
        const nx = (gridX - width / 2) / (width / 2);
        const ny = (gridY - height / 2) / (height / 2);
        const bow = 18 * nx * (1 - ny * ny * 0.45);
        const sag = 20 * (1 - nx * nx) * (0.65 + 0.35 * (gridY / Math.max(1, height)));
        return { x: gridX + bow, y: gridY + sag };
    }

    function paletteKey(isLightMode) {
        return `${isLightMode ? 'light' : 'dark'}:${activeType()}`;
    }

    function resizeCanvas() {
        if (!canvas) return;
        const dpr = Math.min(window.devicePixelRatio || 1, BACKGROUND_MAX_DPR);
        const width = window.innerWidth;
        const height = window.innerHeight;
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
        ctx = canvas.getContext('2d', { alpha: true, desynchronized: true }) || canvas.getContext('2d');
        if (!ctx) return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        if (!baseCanvas) baseCanvas = document.createElement('canvas');
        baseCanvas.width = Math.floor(width * dpr);
        baseCanvas.height = Math.floor(height * dpr);
        baseCtx = baseCanvas.getContext('2d', { alpha: true, desynchronized: true }) || baseCanvas.getContext('2d');
        baseCtx?.setTransform(dpr, 0, 0, dpr, 0, 0);
        baseWidth = width;
        baseHeight = height;
        basePaletteKey = '';
        initCosmos(width, height);
    }

    function renderStaticBase(width, height, isLightMode, palette) {
        if (!baseCtx) return;
        baseCtx.clearRect(0, 0, width, height);

        nebulae.forEach((nebula) => {
            const gradient = baseCtx.createRadialGradient(nebula.x, nebula.y, 0, nebula.x, nebula.y, nebula.r);
            gradient.addColorStop(0, palette.nebula);
            gradient.addColorStop(1, 'transparent');
            baseCtx.fillStyle = gradient;
            baseCtx.beginPath();
            baseCtx.arc(nebula.x, nebula.y, nebula.r, 0, Math.PI * 2);
            baseCtx.fill();
        });

        stars.forEach((star) => {
            const alpha = star.alpha;
            baseCtx.fillStyle = isLightMode
                ? (star.isBlue ? `rgba(15, 23, 42, ${alpha})` : `rgba(0, 0, 0, ${alpha})`)
                : (star.isBlue ? `rgba(224, 242, 254, ${alpha})` : `rgba(255, 255, 255, ${alpha})`);
            baseCtx.beginPath();
            baseCtx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
            baseCtx.fill();

            if (star.hasCross && alpha > 0.65) {
                baseCtx.strokeStyle = isLightMode
                    ? `rgba(15, 23, 42, ${alpha * 0.65})`
                    : `rgba(224, 242, 254, ${alpha * 0.65})`;
                baseCtx.lineWidth = 0.6;
                const arm = star.r * 3.2;
                baseCtx.beginPath();
                baseCtx.moveTo(star.x - arm, star.y);
                baseCtx.lineTo(star.x + arm, star.y);
                baseCtx.moveTo(star.x, star.y - arm);
                baseCtx.lineTo(star.x, star.y + arm);
                baseCtx.stroke();
            }
        });

        baseCtx.save();
        baseCtx.lineWidth = isLightMode ? 1.15 : 0.95;
        baseCtx.strokeStyle = palette.line;

        const rowCount = Math.ceil(height / GRID) + 2;
        for (let row = -1; row <= rowCount; row += 1) {
            const gridY = row * GRID;
            baseCtx.beginPath();
            for (let gridX = -20; gridX <= width + 20; gridX += 18) {
                const point = project(gridX, gridY, width, height);
                if (gridX === -20) baseCtx.moveTo(point.x, point.y);
                else baseCtx.lineTo(point.x, point.y);
            }
            baseCtx.stroke();
        }

        const columnCount = Math.ceil(width / GRID) + 2;
        for (let column = -1; column <= columnCount; column += 1) {
            const gridX = column * GRID;
            baseCtx.beginPath();
            for (let gridY = -20; gridY <= height + 20; gridY += 18) {
                const point = project(gridX, gridY, width, height);
                if (gridY === -20) baseCtx.moveTo(point.x, point.y);
                else baseCtx.lineTo(point.x, point.y);
            }
            baseCtx.stroke();
        }
        baseCtx.restore();
    }

    function createPulse(width, height, isInitial = false) {
        const isHorizontal = Math.random() > 0.4;
        const forward = Math.random() > 0.48;
        const speed = (0.35 + Math.random() * 0.35) * (forward ? 1 : -1);
        const tailLength = 22 + Math.random() * 16;
        if (isHorizontal) {
            const rowCount = Math.max(1, Math.floor(height / GRID));
            const row = Math.floor(Math.random() * (rowCount + 1));
            const gridY = row * GRID;
            const gridX = isInitial ? (0.12 + Math.random() * 0.76) * width : (forward ? -tailLength : width + tailLength);
            return { isHorizontal: true, gx: gridX, gy: gridY, v: speed, tailLength };
        }
        const columnCount = Math.max(1, Math.floor(width / GRID));
        const column = Math.floor(Math.random() * (columnCount + 1));
        const gridX = column * GRID;
        const gridY = isInitial ? (0.12 + Math.random() * 0.76) * height : (forward ? -tailLength : height + tailLength);
        return { isHorizontal: false, gx: gridX, gy: gridY, v: speed, tailLength };
    }

    function clearCanvas() {
        if (!ctx || !canvas) return;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
    }

    function isFxStatic() {
        return Boolean(
            document.body?.classList.contains('fx-static') ||
            (typeof localStorage !== 'undefined' && localStorage.getItem('hub_card_fx_mode') === 'static')
        );
    }

    function step(timestamp = performance.now()) {
        if (!document.body?.classList.contains('theme-abs-clean') || isFxStatic()) {
            animId = null;
            clearCanvas();
            lastFrameTime = 0;
            return;
        }
        if (document.hidden) {
            animId = null;
            lastFrameTime = 0;
            return;
        }

        if (!canvas) {
            canvas = document.getElementById('abs-clean-grid-circuit');
            if (!canvas) {
                animId = requestAnimationFrame(step);
                return;
            }
            resizeCanvas();
            window.addEventListener('resize', resizeCanvas, { passive: true });
        }

        const width = window.innerWidth;
        const height = window.innerHeight;
        if (baseWidth !== width || baseHeight !== height) resizeCanvas();
        const isLightMode = !document.body.classList.contains('theme-abs-clean-dark');
        const palette = activePalette(isLightMode);
        const currentKey = paletteKey(isLightMode);
        if (!baseCtx || basePaletteKey !== currentKey) {
            renderStaticBase(width, height, isLightMode, palette);
            basePaletteKey = currentKey;
        }

        if (!lastFrameTime) lastFrameTime = timestamp - TARGET_FRAME_MS;
        const elapsed = timestamp - lastFrameTime;
        if (elapsed < TARGET_FRAME_MS) {
            animId = requestAnimationFrame(step);
            return;
        }
        lastFrameTime = timestamp;
        const movementScale = Math.min(3, Math.max(0.5, elapsed / (1000 / 60)));
        frameCount += 1;

        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(baseCanvas, 0, 0, width, height);
        while (pulses.length < MAX_PULSES) pulses.push(createPulse(width, height, frameCount <= 3));

        for (let index = pulses.length - 1; index >= 0; index -= 1) {
            const pulse = pulses[index];
            if (pulse.isHorizontal) {
                pulse.gx += pulse.v * movementScale;
                if ((pulse.v > 0 && pulse.gx > width + pulse.tailLength + 30) || (pulse.v < 0 && pulse.gx < -pulse.tailLength - 30)) {
                    pulses.splice(index, 1);
                    continue;
                }
            } else {
                pulse.gy += pulse.v * movementScale;
                if ((pulse.v > 0 && pulse.gy > height + pulse.tailLength + 30) || (pulse.v < 0 && pulse.gy < -pulse.tailLength - 30)) {
                    pulses.splice(index, 1);
                    continue;
                }
            }

            const current = project(pulse.gx, pulse.gy, width, height);
            const tailGx = pulse.isHorizontal ? pulse.gx - Math.sign(pulse.v) * pulse.tailLength : pulse.gx;
            const tailGy = pulse.isHorizontal ? pulse.gy : pulse.gy - Math.sign(pulse.v) * pulse.tailLength;
            const tail = project(tailGx, tailGy, width, height);

            ctx.globalAlpha = 0.76;
            ctx.lineWidth = 1.25;
            ctx.strokeStyle = palette.pulse;
            ctx.beginPath();
            ctx.moveTo(tail.x, tail.y);
            ctx.lineTo(current.x, current.y);
            ctx.stroke();

            ctx.globalAlpha = 0.18;
            ctx.fillStyle = palette.halo;
            ctx.beginPath();
            ctx.arc(current.x, current.y, 11, 0, Math.PI * 2);
            ctx.fill();

            ctx.globalAlpha = 0.92;
            ctx.fillStyle = palette.core;
            ctx.beginPath();
            ctx.arc(current.x, current.y, 3.6, 0, Math.PI * 2);
            ctx.fill();

            ctx.globalAlpha = 0.86;
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(current.x, current.y, 1.7, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.globalAlpha = 1;
        animId = requestAnimationFrame(step);
    }

    window.stopAbsCleanGridCircuit = function stopAbsCleanGridCircuit() {
        if (animId) {
            cancelAnimationFrame(animId);
            animId = null;
        }
        lastFrameTime = 0;
        clearCanvas();
        if (canvas) {
            canvas.style.display = 'none';
        }
    };

    window.startAbsCleanGridCircuit = function startAbsCleanGridCircuit() {
        if (isFxStatic()) {
            window.stopAbsCleanGridCircuit();
            return;
        }
        if (canvas) {
            canvas.style.display = '';
        }
        if (!animId) animId = requestAnimationFrame(step);
    };

    window.addEventListener('abs-fx-mode-change', (event) => {
        if (event.detail?.mode === 'static' || isFxStatic()) {
            window.stopAbsCleanGridCircuit();
        } else {
            window.startAbsCleanGridCircuit();
        }
    });
    window.addEventListener('abs-clean-theme-visible', () => window.startAbsCleanGridCircuit());
    window.addEventListener('card-viewer-theme-change', (event) => {
        if (event.detail?.theme === 'sba') window.startAbsCleanGridCircuit();
    });
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && document.body?.classList.contains('theme-abs-clean')) window.startAbsCleanGridCircuit();
    });

    const start = () => {
        if (isFxStatic()) {
            document.body?.classList.add('fx-static');
            window.stopAbsCleanGridCircuit();
            return;
        }
        if (document.body?.classList.contains('theme-abs-clean')) window.startAbsCleanGridCircuit();
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
    else start();
})();
