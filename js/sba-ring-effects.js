/* ==========================================================================
   SBA EZA / SEZA ELECTRIC RINGS
   Lightweight canvas rings drawn around awakening-marked card portraits.
   SEZA uses a purple / gold / rainbow spectrum; EZA stays gold and electric.
   ========================================================================== */

(() => {
    'use strict';

    const SIZE = 180;
    // Scaled to 77.5 (~58.5px screen radius on 136px element) so the electric ring precisely matches the bright inner edge band
    const RING_RADIUS = 77.5;
    const canvases = new Set();
    const visible = new WeakMap();
    const prepared = new WeakSet();
    const sezaPalette = [
        [194, 107, 255], // purple
        [255, 202, 66],  // gold
        [94, 223, 255],  // cyan
        [255, 105, 214], // pink
        [138, 255, 135], // green
        [255, 232, 105]  // yellow
    ];
    const ezaPalette = [
        [255, 224, 51],  // bright electric yellow
        [255, 119, 0],   // vibrant flame orange
        [0, 208, 255],   // brilliant neon blue
        [255, 234, 71],  // golden yellow
        [255, 98, 0],    // deep blazing orange
        [0, 191, 255]    // electric sky blue
    ];

    let rafId = 0;
    let lastFrame = 0;

    const observer = typeof IntersectionObserver === 'function'
        ? new IntersectionObserver((entries) => {
            entries.forEach((entry) => visible.set(entry.target, entry.isIntersecting));
            ensureAnimation();
        }, { rootMargin: '20px', threshold: 0.01 })
        : null;

    const rgba = (color, alpha = 1) => `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`;
    const lerp = (a, b, amount) => a + (b - a) * amount;

    function paletteColor(palette, position, time) {
        const offset = ((position + time) % palette.length + palette.length) % palette.length;
        const index = Math.floor(offset);
        const next = (index + 1) % palette.length;
        const amount = offset - index;
        return [
            Math.round(lerp(palette[index][0], palette[next][0], amount)),
            Math.round(lerp(palette[index][1], palette[next][1], amount)),
            Math.round(lerp(palette[index][2], palette[next][2], amount))
        ];
    }

    // Deterministic noise keeps the arcs lively without allocating random data
    // every frame or making the ring jump between redraws.
    function noise(index, time) {
        return Math.sin(index * 12.9898 + time * 1.73) * 0.5 + 0.5;
    }

    function prepareCanvas(canvas) {
        if (!canvas || prepared.has(canvas)) return;
        prepared.add(canvas);
        canvases.add(canvas);
        const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
        canvas.width = Math.round(SIZE * dpr);
        canvas.height = Math.round(SIZE * dpr);
        canvas.dataset.sbaDpr = String(dpr);
        observer?.observe(canvas);
        if (!observer) visible.set(canvas, true);
    }

    function scan(root = document) {
        root.querySelectorAll?.('.sba-ring-effect').forEach(prepareCanvas);
        const cleanRing = document.getElementById('abs-clean-ring-effect');
        if (cleanRing) {
            prepareCanvas(cleanRing);
            if (cleanRing.style.display !== 'none' && !cleanRing.hidden) {
                visible.set(cleanRing, true);
            }
        }
        ensureAnimation();
    }

    function beginFrame(canvas) {
        const ctx = canvas.getContext('2d', { alpha: true });
        if (!ctx) return null;
        const dpr = Number(canvas.dataset.sbaDpr) || 1;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, SIZE, SIZE);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        return ctx;
    }

    function drawJaggedArc(ctx, radius, start, end, color, width, alpha, time, seed) {
        const points = 4;
        ctx.beginPath();
        for (let point = 0; point <= points; point += 1) {
            const amount = point / points;
            const angle = start + (end - start) * amount;
            // Tightly constrained jitter staying within the inside boundary of the border
            const jitter = (noise(seed + point * 2.1, time) * 0.32) * (point === 0 || point === points ? 0.15 : 1.1);
            const currentRadius = radius + jitter + Math.sin(time * 2.2 + seed + point) * 0.2;
            const x = SIZE / 2 + Math.cos(angle) * currentRadius;
            const y = SIZE / 2 + Math.sin(angle) * currentRadius;
            if (point === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Outer soft glow pass - delicate, airy, semi-transparent
        ctx.strokeStyle = rgba(color, alpha * 0.20);
        ctx.lineWidth = width * 1.5;
        ctx.stroke();

        // Core electric stroke - thin, crisp, semi-transparent
        ctx.strokeStyle = rgba(color, alpha * 0.65);
        ctx.lineWidth = width * 0.55;
        ctx.stroke();
    }

    function drawElectricRing(ctx, seconds, isSeza) {
        const palette = isSeza ? sezaPalette : ezaPalette;
        const motion = isSeza ? seconds * 0.24 : seconds * 0.16;
        const segmentCount = isSeza ? 18 : 14;
        const segmentSize = (Math.PI * 2) / segmentCount;

        // Faint, transparent colored under-ring staying inside the border
        ctx.beginPath();
        ctx.arc(SIZE / 2, SIZE / 2, RING_RADIUS, 0, Math.PI * 2);
        ctx.strokeStyle = rgba(isSeza ? [190, 120, 255] : [0, 208, 255], 0.28);
        ctx.lineWidth = 1.2;
        ctx.stroke();

        for (let index = 0; index < segmentCount; index += 1) {
            const start = index * segmentSize - 0.02;
            const end = start + segmentSize + 0.03;
            const color = paletteColor(palette, index * 0.72, motion);
            const pulse = 0.68 + 0.28 * (0.5 + 0.5 * Math.sin(seconds * (isSeza ? 2.3 : 1.9) + index * 1.71));
            drawJaggedArc(ctx, RING_RADIUS, start, end, color, isSeza ? 1.5 : 1.35, pulse * 0.70, seconds, index * 4.7);
        }

        // Offset broken arcs
        const arcCount = isSeza ? 5 : 4;
        for (let index = 0; index < arcCount; index += 1) {
            const angle = index * ((Math.PI * 2) / arcCount) + seconds * (isSeza ? -0.22 : 0.14);
            const length = (isSeza ? 0.20 : 0.24) + noise(index + 44, seconds) * 0.16;
            const color = paletteColor(palette, index * 1.35 + 1.2, motion * 0.7);
            drawJaggedArc(ctx, RING_RADIUS + 0.4, angle, angle + length, color, isSeza ? 1.45 : 1.25, 0.38, seconds + 3, index * 9.1);
        }

        // Short sparks flicking along the inner rim
        const sparkCount = isSeza ? 6 : 5;
        for (let index = 0; index < sparkCount; index += 1) {
            const angle = index * ((Math.PI * 2) / sparkCount) + noise(index + 81, seconds * 0.5) * 0.14;
            const inner = RING_RADIUS + 0.2 + noise(index + 18, seconds) * 0.4;
            const outer = inner + 0.8 + noise(index + 29, seconds * 1.2) * (isSeza ? 1.0 : 0.8);
            const color = paletteColor(palette, index * 0.9 + (isSeza ? 0.7 : 0), motion);
            ctx.beginPath();
            ctx.moveTo(SIZE / 2 + Math.cos(angle) * inner, SIZE / 2 + Math.sin(angle) * inner);
            ctx.lineTo(SIZE / 2 + Math.cos(angle + (noise(index + 42, seconds) - 0.5) * 0.08) * outer, SIZE / 2 + Math.sin(angle + (noise(index + 42, seconds) - 0.5) * 0.08) * outer);
            ctx.strokeStyle = rgba(color, 0.35);
            ctx.lineWidth = 0.8;
            ctx.lineCap = 'round';
            ctx.stroke();
        }
    }

    function shouldDraw(canvas) {
        if (canvas.id === 'abs-clean-ring-effect') {
            if (!canvas.isConnected) return false;
            if (canvas.style.display === 'none' || canvas.hidden) return false;
            const isClean = document.body.classList.contains('theme-abs-clean') || document.body.classList.contains('theme-sba');
            if (!isClean) return false;
            if (document.body.classList.contains('fx-static')) return false;
            if (document.body.classList.contains('fx-no-seza') && (canvas.dataset.awakeningFx === 'seza' || canvas.classList.contains('sba-seza-ring-effect'))) {
                return false;
            }
            return true;
        }
        if (!canvas.isConnected || visible.get(canvas) === false) return false;
        const isSba = document.body.classList.contains('theme-sba');
        const isClean = document.body.classList.contains('theme-abs-clean');
        if (!isSba && !isClean) return false;
        if (isSba && !isClean) {
            if (document.body.classList.contains('cards-layout-dokkan')) return false;
            if (canvas.closest('.cards-layout-dokkan') || canvas.closest('#cardGrid.cards-layout-dokkan')) return false;
        }
        if (document.body.classList.contains('fx-static')) return false;
        if (document.body.classList.contains('fx-no-seza') && (canvas.dataset.awakeningFx === 'seza' || canvas.classList.contains('sba-seza-ring-effect'))) {
            // Preserve the existing switch semantics: No SEZA hides only the
            // Super EZA treatment, while regular EZA electricity remains.
            return false;
        }
        return true;
    }

    function animate(timestamp) {
        rafId = 0;
        if (document.hidden) return;
        if (timestamp - lastFrame < 32) {
            rafId = requestAnimationFrame(animate);
            return;
        }
        lastFrame = timestamp;
        const seconds = timestamp / 1000;
        canvases.forEach((canvas) => {
            if (!canvas.isConnected) {
                canvases.delete(canvas);
                observer?.unobserve(canvas);
                return;
            }
            if (!shouldDraw(canvas)) return;
            const ctx = beginFrame(canvas);
            if (!ctx) return;
            drawElectricRing(ctx, seconds, canvas.dataset.awakeningFx === 'seza' || canvas.classList.contains('sba-seza-ring-effect'));
            ctx.restore();
        });
        if ([...canvases].some(shouldDraw)) rafId = requestAnimationFrame(animate);
    }

    function ensureAnimation() {
        if (!rafId && !document.hidden && [...canvases].some(shouldDraw)) {
            rafId = requestAnimationFrame(animate);
        }
    }

    const mutationObserver = new MutationObserver((records) => {
        records.forEach((record) => record.addedNodes.forEach((node) => {
            if (node.nodeType !== 1) return;
            if (node.matches?.('.sba-ring-effect')) prepareCanvas(node);
            scan(node);
        }));
    });

    window.scanSbaRingEffects = scan;

    document.addEventListener('visibilitychange', ensureAnimation);
    window.addEventListener('abs-fx-mode-change', ensureAnimation);
    window.addEventListener('abs-hub-theme-change', ensureAnimation);
    window.addEventListener('resize', ensureAnimation, { passive: true });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            scan();
            mutationObserver.observe(document.body, { childList: true, subtree: true });
        }, { once: true });
    } else {
        scan();
        mutationObserver.observe(document.body, { childList: true, subtree: true });
    }
})();
