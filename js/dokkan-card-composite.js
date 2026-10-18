/* Cards-only native PNG target. The live layers stay visible; an invisible real
 * img above them gives the browser a complete
 * static image to save/copy. Nothing intercepts contextmenu or link clicks. */
(() => {
    'use strict';
    const grid = document.getElementById('cardGrid');
    if (!grid) return;
    const selector = '.frame, .lr-dial, .char-img, img.rarity, img.type, img.hub-eza-badge';
    const states = new Map();
    const queue = new Set();
    const images = new Map();
    const composites = new Map();
    let running = 0;
    const isDokkan = () => document.body.classList.contains('cards-layout-dokkan');
    const trim = (cache, limit) => {
        while (cache.size > limit) cache.delete(cache.keys().next().value);
    };
    const memo = (cache, key, create, limit) => {
        if (cache.has(key)) {
            const result = cache.get(key);
            cache.delete(key);
            cache.set(key, result);
            return result;
        }
        const result = create();
        cache.set(key, result);
        trim(cache, limit);
        result.catch(() => { if (cache.get(key) === result) cache.delete(key); });
        return result;
    };
    function loadImage(src) {
        return memo(images, src, () => new Promise((resolve, reject) => {
            const image = new Image();
            // Set BEFORE src: displaying a remote image says nothing about
            // whether it may be read back from a canvas.
            image.crossOrigin = 'anonymous';
            const timeout = setTimeout(() => finish(new Error('Image request timed out')), 15000);
            const finish = (error) => {
                clearTimeout(timeout);
                image.onload = image.onerror = null;
                error ? reject(error) : resolve(image);
            };
            image.onerror = () => finish(new Error('Image unavailable or origin does not permit CORS'));
            image.onload = async () => {
                try {
                    await image.decode();
                    if (!image.naturalWidth) throw new Error('Empty image');
                    finish();
                } catch (error) { finish(error); }
            };
            image.src = src;
        }), 80);
    }
    function describe(icon) {
        const layers = [...icon.querySelectorAll(selector)].filter(image => {
            const style = getComputedStyle(image);
            return style.display !== 'none' && style.visibility !== 'hidden';
        }).map((image, order) => {
            // Wait for the displayed image too: onerror may still be choosing a
            // parent thumbnail or placeholder, which changes both URL and size.
            if (!image.complete) throw new Error('Layers still loading');
            if (!image.naturalWidth) throw new Error('Image failed to load');
            const style = getComputedStyle(image);
            const width = parseFloat(style.width);
            const height = parseFloat(style.height);
            const matrix = new DOMMatrix(style.transform === 'none' ? undefined : style.transform);
            const origin = style.transformOrigin.split(' ').map(parseFloat);
            const x = image.offsetLeft;
            const y = image.offsetTop;
            const corners = [[0, 0], [width, 0], [width, height], [0, height]].map(([px, py]) => {
                const point = new DOMPoint(px - origin[0], py - origin[1]).matrixTransform(matrix);
                return [x + origin[0] + point.x, y + origin[1] + point.y];
            });
            return { src: image.currentSrc || image.src, width, height, x, y,
                matrix: [matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f],
                origin, corners, filter: style.filter, opacity: Number(style.opacity),
                z: Number(style.zIndex) || 0, order };
        }).sort((a, b) => a.z - b.z || a.order - b.order);
        if (!layers.length || !layers.some(layer => layer.order >= 0 && layer.src)) throw new Error('No card layers');
        // Include the existing overhangs (art and badges extend outside 150px),
        // with room for the intrinsic rarity shadow. No text/glow/background.
        const points = layers.flatMap(layer => layer.corners);
        const left = Math.floor(Math.min(0, ...points.map(point => point[0])) - 6);
        const top = Math.floor(Math.min(0, ...points.map(point => point[1])) - 6);
        const right = Math.ceil(Math.max(icon.clientWidth, ...points.map(point => point[0])) + 6);
        const bottom = Math.ceil(Math.max(icon.clientHeight, ...points.map(point => point[1])) + 6);
        const side = Math.max(right - left, bottom - top);
        const bounds = { x: left - (side - (right - left)) / 2, y: top - (side - (bottom - top)) / 2, side };
        const scale = Math.min(3, Math.max(2, window.devicePixelRatio || 1));
        return { layers, bounds, scale };
    }
    async function compose(description) {
        const { layers, bounds, scale } = description;
        const decoded = await Promise.all(layers.map(layer => layer.src ? loadImage(layer.src) : null));
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = Math.ceil(bounds.side * scale);
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Canvas unavailable');
        const ratio = canvas.width / bounds.side;
        context.scale(ratio, ratio);
        context.translate(-bounds.x, -bounds.y);
        layers.forEach((layer, index) => {
            context.save();
            context.translate(layer.x + layer.origin[0], layer.y + layer.origin[1]);
            context.transform(...layer.matrix);
            context.translate(-layer.origin[0], -layer.origin[1]);
            context.filter = layer.filter;
            context.globalAlpha = layer.opacity;
            context.drawImage(decoded[index], 0, 0, layer.width, layer.height);
            context.restore();
        });
        // toBlob is the definitive origin-clean check, even after CORS loading.
        return await new Promise((resolve, reject) => {
            try { canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG encoding failed')), 'image/png'); }
            catch (error) { reject(error); }
        });
    }
    function removeTarget(state) {
        state.target?.remove();
        state.target = null;
        if (state.url) URL.revokeObjectURL(state.url);
        state.url = null;
    }
    function invalidateAsset(src) {
        images.delete(src);
        const encoded = JSON.stringify(src);
        for (const key of composites.keys()) {
            if (key.includes(encoded)) composites.delete(key);
        }
    }
    function invalidate(icon) {
        const state = states.get(icon);
        if (!state) return;
        state.revision += 1;
        state.done = false;
        removeTarget(state);
        delete icon.dataset.compositeState;
        if (state.failureTitle && icon.title === state.failureTitle) icon.title = state.originalTitle;
        state.failureTitle = null;
        if (state.visible) enqueue(icon);
    }
    function enqueue(icon) {
        const state = states.get(icon);
        if (!state || state.done || !state.visible || !isDokkan()) return;
        queue.add(icon);
        pump();
    }
    function pump() {
        while (running < 2 && queue.size) {
            const icon = queue.values().next().value;
            queue.delete(icon);
            const state = states.get(icon);
            if (!state || state.busy || state.done || !state.visible || !icon.isConnected || !isDokkan()) continue;
            state.busy = true;
            running += 1;
            const revision = state.revision;
            (async () => {
                try {
                    const description = describe(icon);
                    // PNG keeps complete static layers, including the LR dial.
                    // Animated LWF canvases remain live overlays and are not captured.
                    const key = JSON.stringify(description);
                    const blob = await memo(composites, key, () => compose(description), 96);
                    if (state.revision !== revision || !icon.isConnected || !isDokkan()) return;
                    const url = URL.createObjectURL(blob);
                    const target = new Image();
                    target.alt = '';
                    target.setAttribute('aria-hidden', 'true');
                    target.className = 'dokkan-card-composite';
                    target.src = url;
                    try { await target.decode(); }
                    catch (error) { URL.revokeObjectURL(url); throw error; }
                    if (state.revision !== revision || !icon.isConnected || !isDokkan()) {
                        URL.revokeObjectURL(url);
                        return;
                    }
                    removeTarget(state);
                    const { x, y, side } = description.bounds;
                    target.style.cssText = `left:${x}px;top:${y}px;width:${side}px;height:${side}px`;
                    state.url = url;
                    state.target = target;
                    icon.appendChild(target);
                    icon.dataset.compositeState = 'ready';
                    state.done = true;
                } catch (error) {
                    if (state.revision !== revision || !icon.isConnected || !isDokkan()) return;
                    if (error.message === 'Layers still loading') return;
                    icon.dataset.compositeState = 'unavailable';
                    state.failureTitle = 'Full card PNG unavailable: an image failed to load or its origin does not permit export.';
                    icon.title = state.failureTitle;
                    state.done = true;
                    console.warn('Dokkan card PNG unavailable', error);
                } finally {
                    state.busy = false;
                    running -= 1;
                    if (state.revision !== revision && state.visible) enqueue(icon);
                    pump();
                }
            })();
        }
    }
    const visibility = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
        for (const entry of entries) {
            const state = states.get(entry.target);
            if (!state) continue;
            state.visible = entry.isIntersecting;
            if (state.visible) enqueue(entry.target);
            else queue.delete(entry.target);
        }
    }, { rootMargin: '100px' }) : null;
    function reconcile() {
        for (const [icon, state] of states) {
            if (!icon.isConnected || !isDokkan()) {
                state.revision += 1;
                removeTarget(state);
                delete icon.dataset.compositeState;
                if (state.failureTitle && icon.title === state.failureTitle) icon.title = state.originalTitle;
                queue.delete(icon);
                visibility?.unobserve(icon);
                states.delete(icon);
            }
        }
        if (!isDokkan()) return;
        for (const icon of grid.querySelectorAll('.card-icon')) {
            if (states.has(icon)) continue;
            delete icon.dataset.compositeState;
            states.set(icon, { revision: 0, visible: !visibility, busy: false, done: false, originalTitle: icon.title });
            visibility ? visibility.observe(icon) : enqueue(icon);
        }
    }
    // Listen in capture mode because image load/error events do not bubble.
    grid.addEventListener('load', event => {
        if (event.target.matches?.(selector)) invalidate(event.target.closest('.card-icon'));
    }, true);
    grid.addEventListener('error', event => {
        if (event.target.matches?.(selector)) invalidate(event.target.closest('.card-icon'));
    }, true);
    const mutations = new MutationObserver(records => {
        for (const record of records) {
            if (record.type === 'attributes' && record.target.matches?.(selector)) {
                // Explicit URL reassignment may reload changed custom art at
                // the same address; do not retain its earlier decoded pixels.
                invalidateAsset(record.target.currentSrc || record.target.src);
                invalidateAsset(record.target.src);
                if (record.attributeName === 'src' && record.oldValue) {
                    invalidateAsset(new URL(record.oldValue, document.baseURI).href);
                }
                invalidate(record.target.closest('.card-icon'));
            }
        }
        reconcile();
    });
    mutations.observe(grid, { childList: true, subtree: true, attributes: true, attributeOldValue: true, attributeFilter: ['src', 'srcset'] });
    let noSeza = document.body.classList.contains('fx-no-seza');
    new MutationObserver(() => {
        const next = document.body.classList.contains('fx-no-seza');
        if (next !== noSeza) { noSeza = next; for (const icon of states.keys()) invalidate(icon); }
        reconcile();
    }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    window.addEventListener('resize', () => { for (const icon of states.keys()) invalidate(icon); });
    reconcile();
})();
