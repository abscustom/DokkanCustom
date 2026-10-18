/* Cards-only original LR effect. One authored 30 FPS timeline, copied to visible cards. */
(() => {
    'use strict';
    const selector = '#cardGrid .sba-lr-lwf-lightning-canvas';
    const surfaceSize = 160;
    const targets = new Map();
    const surface = document.createElement('canvas');
    surface.width = surface.height = surfaceSize;
    const context = surface.getContext('2d');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let player = null, loading = false, epoch = 0, raf = 0, last = 0, failed = false, loadTimer = 0, failure = '';
    const counters = {loads: 0, renders: 0, copies: 0, renderMs: 0, destroys: 0};
    const owns = canvas => canvas?.matches?.('.sba-lr-lwf-lightning-canvas') && !!canvas.closest('#cardGrid');
    const enabled = () => document.body.classList.contains('hub-cards-active') &&
        document.body.classList.contains('theme-sba') &&
        document.body.classList.contains('cards-layout-dokkan') &&
        !document.body.classList.contains('fx-no-lightning') &&
        !document.body.classList.contains('fx-static') && !document.hidden;
    const visible = () => enabled() ? [...targets].filter(([canvas, state]) => state.visible && canvas.isConnected && canvas.getClientRects().length).map(([canvas]) => canvas) : [];
    function stop() {
        cancelAnimationFrame(raf);
        raf = 0;
        last = 0;
    }
    function clearTargets() {
        for (const [canvas, state] of targets) {
            state.context?.clearRect(0, 0, canvas.width, canvas.height);
            delete canvas.dataset.cardsLrReady;
        }
    }
    function paint(cards, dt) {
        const start = performance.now();
        context.clearRect(0, 0, surfaceSize, surfaceSize);
        player.exec(dt);
        player.render();
        counters.renders++;
        for (const canvas of cards) {
            const ctx = targets.get(canvas)?.context;
            if (!ctx) continue;
            ctx.clearRect(0, 0, 160, 160);
            ctx.drawImage(surface, 0, 0);
            canvas.dataset.cardsLrReady = 'true';
            counters.copies++;
        }
        counters.renderMs += performance.now() - start;
    }
    function tick(now) {
        raf = 0;
        const cards = visible();
        if (!player || !cards.length || reduced.matches) { last = 0; return; }
        if (!last || now - last >= 1000 / 30) {
            paint(cards, last ? Math.min((now - last) / 1000, 0.1) : 1 / 30);
            last = now;
        }
        raf = requestAnimationFrame(tick);
    }
    function load() {
        if (loading || player || failed || !window.LWF) return;
        loading = true;
        const generation = epoch;
        counters.loads++;
        // Use the Canvas cache explicitly: other effect loaders share the LWF library.
        let settled = false;
        const finish = (error, loaded) => {
            if (settled) { loaded?.destroy?.(); return; }
            settled = true;
            clearTimeout(loadTimer);
            loadTimer = 0;
            if (generation !== epoch) { loaded?.destroy?.(); return; }
            loading = false;
            if (error || !loaded) {
                failed = true;
                failure = String(error?.message || 'LWF load failed');
                context.clearRect(0, 0, surfaceSize, surfaceSize);
                clearTargets();
                return;
            }
            try {
                player = loaded;
                player.rendererFactory.clearColor = null;
                player.exec(0);
                player.rootMovie.stop();
                const movie = player.rootMovie.attachMovie('ef_001', 'ef_001');
                if (!movie) throw new Error('LWF movie ef_001 unavailable');
                movie.moveTo(80, 80);
                movie.play();
                // Parent totalFrames is 1; nested authored timelines keep running.
                const cards = visible();
                if (cards.length) paint(cards, 1 / 30);
                sync();
            } catch (setupError) {
                if (player === loaded) player = null;
                loaded.destroy?.();
                failed = true;
                failure = String(setupError?.message || 'LWF setup failed');
                context.clearRect(0, 0, surfaceSize, surfaceSize);
                clearTargets();
            }
        };
        loadTimer = window.setTimeout(() => finish(new Error('LWF load timeout')), 30000);
        try {
            LWF.useCanvasRenderer();
            LWF.ResourceCache.get().loadLWF({
                lwf: 'icon_rare_20000.lwf', prefix: 'assets/effects/lr-lightning/', stage: surface,
                worker: false, useBackgroundColor: false,
                onload(loaded) { finish(loaded ? null : new Error('LWF load failed'), loaded); },
                onerror(error) { finish(error || new Error('LWF load failed')); }
            });
        } catch (error) {
            finish(error);
        }
    }
    function sync() {
        prune();
        const cards = visible();
        if (!cards.length) { stop(); return; }
        if (!player) { load(); return; }
        if (reduced.matches) {
            stop();
            // Copy the frozen frame to newly visible targets without advancing it.
            for (const canvas of cards) if (canvas.dataset.cardsLrReady !== 'true') {
                const ctx = targets.get(canvas).context;
                ctx.clearRect(0, 0, surfaceSize, surfaceSize); ctx.drawImage(surface, 0, 0);
                canvas.dataset.cardsLrReady = 'true'; counters.copies++;
            }
        } else if (!raf) raf = requestAnimationFrame(tick);
    }
    const observer = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
        for (const entry of entries) { const state = targets.get(entry.target); if (state) state.visible = entry.isIntersecting; }
        sync();
    }, {threshold: 0.01}) : null;
    function mount(container = document) {
        prune();
        container.querySelectorAll?.(selector).forEach(canvas => {
            if (targets.has(canvas)) return;
            canvas.classList.add('cards-lr-original-canvas');
            canvas.width = canvas.height = 160;
            targets.set(canvas, {context: canvas.getContext('2d'), visible: !observer});
            observer?.observe(canvas);
        });
        sync();
    }
    function unmount(container) {
        for (const canvas of targets.keys()) if (!canvas.isConnected || container?.contains(canvas)) {
            observer?.unobserve(canvas);
            targets.get(canvas)?.context?.clearRect(0, 0, canvas.width, canvas.height);
            targets.delete(canvas);
            delete canvas.dataset.cardsLrReady;
        }
        if (!targets.size) {
            stop(); epoch++; clearTimeout(loadTimer); loadTimer = 0; loading = false; failed = false; failure = '';
            if (player) { player.destroy(); counters.destroys++; player = null; }
            context.clearRect(0, 0, surfaceSize, surfaceSize);
        } else sync();
    }
    function prune() {
        for (const canvas of targets.keys()) if (!canvas.isConnected) {
            observer?.unobserve(canvas); targets.delete(canvas);
        }
        if (!targets.size && (player || loading)) {
            stop(); epoch++; clearTimeout(loadTimer); loadTimer = 0; loading = false; failed = false; failure = '';
            if (player) { player.destroy(); counters.destroys++; player = null; }
            context.clearRect(0, 0, surfaceSize, surfaceSize);
        }
    }
    document.addEventListener('visibilitychange', sync);
    reduced.addEventListener('change', sync);
    new MutationObserver(sync).observe(document.body, {attributes: true, attributeFilter: ['class']});
    window.addEventListener('pagehide', () => unmount(document.getElementById('cardGrid')));
    window.addEventListener('pageshow', () => mount(document.getElementById('cardGrid') || document));
    window.CardsLRLightning = Object.freeze({owns, mount, unmount, sync,
        stats: () => ({...counters, targets: targets.size, visible: visible().length,
            players: Number(!!player), loading, running: !!raf, reducedMotion: reduced.matches, failed, error: failure})});
})();
