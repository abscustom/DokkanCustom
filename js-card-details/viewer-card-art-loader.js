/* Latest-selection-wins loader for the published card viewer's layered art. */
(function attachViewerCardArtLoader(global) {
    'use strict';

    function createLoader(ImageConstructor = global.Image) {
        let generation = 0;
        const active = new Set();

        function cancelActive() {
            for (const request of [...active]) request.cancel();
            active.clear();
        }

        function preload(url) {
            if (!url || typeof ImageConstructor !== 'function') return Promise.resolve({ url: '', loaded: false });
            return new Promise(resolve => {
                const image = new ImageConstructor();
                let settled = false;
                const request = {
                    cancel() {
                        if (settled) return;
                        settled = true;
                        image.onload = null;
                        image.onerror = null;
                        try { image.src = ''; } catch (error) {}
                        active.delete(request);
                        resolve({ url: '', loaded: false, cancelled: true });
                    }
                };
                const finish = loaded => {
                    if (settled) return;
                    settled = true;
                    image.onload = null;
                    image.onerror = null;
                    active.delete(request);
                    resolve({ url: loaded ? url : '', loaded });
                };
                image.onload = () => finish(true);
                image.onerror = () => finish(false);
                active.add(request);
                image.src = url;
                if (image.complete) finish(Boolean(image.naturalWidth));
            });
        }

        async function load(assetUrls) {
            const requestGeneration = ++generation;
            cancelActive();
            const entries = Object.entries(assetUrls || {});
            const candidates = entries.map(([key, value]) => ({
                key,
                urls: (Array.isArray(value) ? value : [value]).filter(url => typeof url === 'string' && url.trim())
            }));
            const loadedCandidates = await Promise.all(candidates.map(async candidate => ({
                key: candidate.key,
                results: await Promise.all(candidate.urls.map(preload))
            })));
            if (requestGeneration !== generation) return { stale: true, assets: {} };

            const assets = {};
            for (const candidate of loadedCandidates) {
                assets[candidate.key] = candidate.results.find(result => result.loaded)?.url || '';
            }
            return { stale: false, assets };
        }

        function invalidate() {
            generation++;
            cancelActive();
        }

        return { load, invalidate };
    }

    global.ViewerCardArtLoader = {
        createLoader,
        shared: createLoader()
    };
})(window);
