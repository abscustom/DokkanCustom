/* ==========================================================================
   absCustom - Interactive Simplex Noise Wave Background Engine (Clean Waves)
   ========================================================================== */

(function initWavesBackground() {
    const container = document.getElementById('wave-bg-container');
    const svg = document.getElementById('wave-svg');
    if (!container || !svg || typeof SimplexNoise === 'undefined') return;

    const noise = new SimplexNoise();
    let width = window.innerWidth;
    let height = window.innerHeight;
    let paths = [];
    let lines = [];
    let rafId = null;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    function motionDisabled() {
        return reduceMotion.matches || document.body.classList.contains('fx-static');
    }

    const mouse = {
        x: -10, y: 0,
        lx: 0, ly: 0,
        sx: 0, sy: 0,
        v: 0, vs: 0, a: 0,
        set: false
    };

    function setSize() {
        width = window.innerWidth;
        height = window.innerHeight;
        svg.style.width = width + 'px';
        svg.style.height = height + 'px';
        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    }

    function setupLines() {
        lines = [];
        paths.forEach(p => p.remove());
        paths = [];

        const xGap = 16;
        const yGap = 16;
        const oWidth = width + 200;
        const oHeight = height + 40;

        const totalLines = Math.ceil(oWidth / xGap);
        const totalPoints = Math.ceil(oHeight / yGap);

        const xStart = (width - xGap * totalLines) / 2;
        const yStart = (height - yGap * totalPoints) / 2;

        for (let i = 0; i < totalLines; i++) {
            const points = [];
            for (let j = 0; j < totalPoints; j++) {
                points.push({
                    x: xStart + xGap * i,
                    y: yStart + yGap * j,
                    wave: { x: 0, y: 0 },
                    cursor: { x: 0, y: 0, vx: 0, vy: 0 }
                });
            }

            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('fill', 'none');
            path.setAttribute('stroke', 'rgba(255, 255, 255, 0.38)');
            path.setAttribute('stroke-width', '1.2');
            svg.appendChild(path);
            paths.push(path);
            lines.push(points);
        }
    }

    function clearLines() {
        paths.forEach((path) => path.remove());
        paths = [];
        lines = [];
    }

    function onMouseMove(e) {
        if (motionDisabled()) return;
        mouse.x = e.clientX;
        mouse.y = e.clientY;
        if (!mouse.set) {
            mouse.sx = mouse.x;
            mouse.sy = mouse.y;
            mouse.lx = mouse.x;
            mouse.ly = mouse.y;
            mouse.set = true;
        }
    }

    function movePoints(time) {
        lines.forEach(points => {
            points.forEach(p => {
                const move = noise.noise2D(
                    (p.x + time * 0.006) * 0.003,
                    (p.y + time * 0.003) * 0.002
                ) * 8;

                p.wave.x = Math.cos(move) * 14;
                p.wave.y = Math.sin(move) * 8;

                const dx = p.x - mouse.sx;
                const dy = p.y - mouse.sy;
                const d = Math.hypot(dx, dy);
                const l = Math.max(180, mouse.vs);

                if (d < l) {
                    const s = 1 - d / l;
                    const f = Math.cos(d * 0.001) * s;
                    p.cursor.vx += Math.cos(mouse.a) * f * l * mouse.vs * 0.0004;
                    p.cursor.vy += Math.sin(mouse.a) * f * l * mouse.vs * 0.0004;
                }

                p.cursor.vx += (0 - p.cursor.x) * 0.012;
                p.cursor.vy += (0 - p.cursor.y) * 0.012;
                p.cursor.vx *= 0.94;
                p.cursor.vy *= 0.94;

                p.cursor.x += p.cursor.vx;
                p.cursor.y += p.cursor.vy;
            });
        });
    }

    function drawLines() {
        lines.forEach((points, lIndex) => {
            if (points.length < 2 || !paths[lIndex]) return;
            const p0 = points[0];
            let d = `M ${p0.x + p0.wave.x + p0.cursor.x} ${p0.y + p0.wave.y + p0.cursor.y}`;
            for (let i = 1; i < points.length; i++) {
                const p = points[i];
                d += ` L ${p.x + p.wave.x + p.cursor.x} ${p.y + p.wave.y + p.cursor.y}`;
            }
            paths[lIndex].setAttribute('d', d);
        });
    }

    function tick(time) {
        if (motionDisabled()) {
            rafId = null;
            return;
        }

        mouse.sx += (mouse.x - mouse.sx) * 0.12;
        mouse.sy += (mouse.y - mouse.sy) * 0.12;

        const dx = mouse.x - mouse.lx;
        const dy = mouse.y - mouse.ly;
        mouse.v = Math.hypot(dx, dy);
        mouse.vs += (mouse.v - mouse.vs) * 0.1;
        mouse.vs = Math.min(100, mouse.vs);

        mouse.lx = mouse.x;
        mouse.ly = mouse.y;
        mouse.a = Math.atan2(dy, dx);

        movePoints(time);
        drawLines();
        rafId = requestAnimationFrame(tick);
    }

    function syncAnimationState() {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = null;
        if (motionDisabled()) {
            clearLines();
            return;
        }
        if (!lines.length) setupLines();
        rafId = requestAnimationFrame(tick);
    }

    window.addEventListener('resize', () => {
        setSize();
        if (!motionDisabled()) setupLines();
    });
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('abs-fx-mode-change', syncAnimationState);
    reduceMotion.addEventListener('change', syncAnimationState);

    setSize();
    if (!motionDisabled()) setupLines();
    syncAnimationState();
})();
