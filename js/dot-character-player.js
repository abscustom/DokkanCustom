/* Small decorative random dot-character player for the Home view. */
(function mountHomeDotCharacter() {
    const SERVER = 'http://127.0.0.1:3137';
    // Local manifest path — served from the project's own assets folder.
    // No animation server required when this file is present.
    const LOCAL_MANIFEST = 'assets/dot_character/manifest.json';
    // The optional Home companion is intentionally capped below full player
    // speed. It remains animated but cannot monopolize the page renderer.
    const DOT_CHARACTER_ENABLED = true;

    // fileSource is either { url } (server mode) or { localPath } (local mode).
    async function fetchFiles(entry) {
        return Promise.all(entry.files.map(async (file) => {
            const url = file.url ?? `assets/dot_character/${file.localPath}`;
            const response = await fetch(url, { cache: 'force-cache' });
            if (!response.ok) throw new Error(`Missing dot-character asset: ${file.name}`);
            return new File([await response.blob()], file.name);
        }));
    }

    // Try loading characters from the local static manifest first.
    // If that fails (file missing or fetch error), fall back to the server.
    async function loadCharacters() {
        try {
            const res = await fetch(LOCAL_MANIFEST, { cache: 'no-store' });
            if (res.ok) {
                const payload = await res.json();
                const characters = Array.isArray(payload?.characters) ? payload.characters : [];
                if (characters.length) return characters;
            }
        } catch { /* fall through to server */ }
        // Server fallback
        const res = await fetch(`${SERVER}/api/dot-characters`, { cache: 'no-store' });
        const payload = await res.json();
        return Array.isArray(payload?.characters) ? payload.characters : [];
    }


    function fitRenderedCharacter(source, target, host) {
        const sourceContext = source.getContext('2d', { willReadFrequently: true });
        const targetContext = target.getContext('2d');
        if (!sourceContext || !targetContext) return () => {};

        let crop = null;
        let cropFitNudge = 1;
        let lastBoundsCheck = 0;
        let stopped = false;

        function refreshCropBounds() {
            const width = source.width;
            const height = source.height;
            let pixels;
            try { pixels = sourceContext.getImageData(0, 0, width, height).data; } catch { return; }
            let left = width, top = height, right = -1, bottom = -1;
            const colorWeights = new Map();
            const opaqueRows = new Uint16Array(Math.ceil(height / 4));
            const opaqueColumns = new Uint16Array(Math.ceil(width / 4));
            // Sampling is enough to find this decorative sprite's occupied
            // region and avoids a full per-frame pixel scan.
            const stride = 4;
            for (let y = 0; y < height; y += stride) {
                for (let x = 0; x < width; x += stride) {
                    const pixelIndex = (y * width + x) * 4;
                    const alpha = pixels[pixelIndex + 3];
                    if (alpha < 18) continue;
                    left = Math.min(left, x);
                    top = Math.min(top, y);
                    right = Math.max(right, x);
                    bottom = Math.max(bottom, y);

                    // A proper battle background has densely opaque rows and
                    // columns. Loose aura particles do not, which lets us
                    // distinguish the real scene frame from its overflow FX.
                    if (alpha >= 224) {
                        opaqueRows[y / stride] += 1;
                        opaqueColumns[x / stride] += 1;
                    }

                    // Quantise vivid visible pixels into colour buckets. The
                    // strongest bucket becomes the divider's live accent.
                    const red = pixels[pixelIndex];
                    const green = pixels[pixelIndex + 1];
                    const blue = pixels[pixelIndex + 2];
                    const highest = Math.max(red, green, blue);
                    const lowest = Math.min(red, green, blue);
                    const saturation = highest ? (highest - lowest) / highest : 0;
                    if (alpha < 96 || saturation < 0.18 || highest < 58) continue;
                    const bucketRed = Math.min(255, Math.round(red / 32) * 32);
                    const bucketGreen = Math.min(255, Math.round(green / 32) * 32);
                    const bucketBlue = Math.min(255, Math.round(blue / 32) * 32);
                    const key = `${bucketRed},${bucketGreen},${bucketBlue}`;
                    const weight = (alpha / 255) * saturation * (0.25 + highest / 255);
                    colorWeights.set(key, (colorWeights.get(key) || 0) + weight);
                }
            }
            if (right < left || bottom < top) return;
            let accent = null;
            let accentWeight = 0;
            colorWeights.forEach((weight, key) => {
                if (weight > accentWeight) {
                    accent = key;
                    accentWeight = weight;
                }
            });
            if (accent) {
                const accentValue = accent.replaceAll(',', ' ');
                const [accentRed, accentGreen, accentBlue] = accent.split(',').map(Number);
                const highest = Math.max(accentRed, accentGreen, accentBlue) / 255;
                const lowest = Math.min(accentRed, accentGreen, accentBlue) / 255;
                const range = highest - lowest;
                let hue = 0;
                if (range) {
                    if (highest === accentRed / 255) hue = ((accentGreen - accentBlue) / 255 / range) % 6;
                    else if (highest === accentGreen / 255) hue = (accentBlue - accentRed) / 255 / range + 2;
                    else hue = (accentRed - accentGreen) / 255 / range + 4;
                    hue = Math.round((hue * 60 + 360) % 360);
                }
                host.style.setProperty('--dot-lwf-accent-rgb', accentValue);
                host.closest('.hub-showcase-divider')?.style.setProperty('--dot-lwf-accent-rgb', accentValue);
                document.body.style.setProperty('--dot-lwf-accent-rgb', accentValue);
                document.body.style.setProperty('--dot-lwf-accent-hue', `${hue}deg`);
            }
            // Set the scene bounds once. Re-fitting them every few frames
            // made a perfectly normal animation appear to breathe or pulse
            // because its scale shifted with each moving effect particle.
            if (!crop) {
                const rowThreshold = Math.max(3, Math.ceil(opaqueColumns.length * 0.36));
                const denseRows = [];
                for (let index = 0; index < opaqueRows.length; index += 1) {
                    if (opaqueRows[index] >= rowThreshold) denseRows.push(index);
                }
                const columnThreshold = Math.max(3, Math.ceil(denseRows.length * 0.45));
                const denseColumns = [];
                for (let index = 0; index < opaqueColumns.length; index += 1) {
                    if (opaqueColumns[index] >= columnThreshold) denseColumns.push(index);
                }

                // Prefer the opaque scene rectangle when it is large enough
                // to be a real background. Character-only LWFs deliberately
                // fall back to their complete animated footprint instead.
                const hasSceneFrame = denseRows.length > 0 && denseColumns.length > 0;
                const frameLeft = hasSceneFrame ? denseColumns[0] * stride : left;
                const frameTop = hasSceneFrame ? denseRows[0] * stride : top;
                const frameRight = hasSceneFrame ? Math.min(width - 1, (denseColumns.at(-1) + 1) * stride - 1) : right;
                const frameBottom = hasSceneFrame ? Math.min(height - 1, (denseRows.at(-1) + 1) * stride - 1) : bottom;
                const frameWidth = frameRight - frameLeft + 1;
                const frameHeight = frameBottom - frameTop + 1;
                const useSceneFrame = hasSceneFrame &&
                    frameWidth >= width * 0.52 && frameHeight >= height * 0.08;
                // A 1% overscan removes sub-pixel seams around true background
                // frames without switching them to a visibly cropped cover fit.
                cropFitNudge = useSceneFrame ? 1.01 : 1;
                const padding = 0;
                crop = {
                    x: Math.max(0, (useSceneFrame ? frameLeft : left) - padding),
                    y: Math.max(0, (useSceneFrame ? frameTop : top) - padding),
                    width: Math.min(width, (useSceneFrame ? frameRight : right) + 1 + padding) - Math.max(0, (useSceneFrame ? frameLeft : left) - padding),
                    height: Math.min(height, (useSceneFrame ? frameBottom : bottom) + 1 + padding) - Math.max(0, (useSceneFrame ? frameTop : top) - padding),
                };
            }
        }

        function paint(now) {
            if (stopped) return;
            const cssWidth = Math.max(1, host.clientWidth);
            const cssHeight = Math.max(1, host.clientHeight);
            const scale = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
            const outputWidth = Math.round(cssWidth * scale);
            const outputHeight = Math.round(cssHeight * scale);
            if (target.width !== outputWidth || target.height !== outputHeight) {
                target.width = outputWidth;
                target.height = outputHeight;
            }
            if (!lastBoundsCheck || now - lastBoundsCheck > 700) {
                refreshCropBounds();
                lastBoundsCheck = now;
            }
            targetContext.clearRect(0, 0, outputWidth, outputHeight);
            if (crop?.width > 0 && crop?.height > 0) {
                // Use one uniform scale factor.  Scaling X and Y separately
                // made the pixel character look stretched; "contain" keeps
                // every authored pixel in proportion and avoids cropping.
                const scale = Math.min(outputWidth / crop.width, outputHeight / crop.height) * cropFitNudge;
                const drawWidth = crop.width * scale;
                const drawHeight = crop.height * scale;

                // The authored scene is portrait, while Home presents it in
                // a wide divider. Paint a soft, cover-fitted echo first so
                // the scene reaches both edges without stretching or cropping
                // the crisp character animation in the foreground.
                const backdropScale = Math.max(outputWidth / crop.width, outputHeight / crop.height);
                const backdropWidth = crop.width * backdropScale;
                const backdropHeight = crop.height * backdropScale;
                targetContext.save();
                targetContext.globalAlpha = 0.30;
                targetContext.filter = `blur(${Math.max(8, Math.round(scale * 7))}px)`;
                targetContext.imageSmoothingEnabled = true;
                targetContext.drawImage(
                    source, crop.x, crop.y, crop.width, crop.height,
                    (outputWidth - backdropWidth) / 2, (outputHeight - backdropHeight) / 2,
                    backdropWidth, backdropHeight
                );
                targetContext.restore();

                targetContext.imageSmoothingEnabled = false;
                targetContext.drawImage(
                    source, crop.x, crop.y, crop.width, crop.height,
                    (outputWidth - drawWidth) / 2, (outputHeight - drawHeight) / 2,
                    drawWidth, drawHeight
                );
            }
            window.setTimeout(() => requestAnimationFrame(paint), 100);
        }

        requestAnimationFrame(paint);
        return () => { stopped = true; };
    }

    // A few dot-character timelines only occupy a tiny part of their portrait
    // stage.  They look like accidental thumbnails in the wide Home divider,
    // so screen them before committing to the once-per-visit companion.
    function measureSceneFill(source, host) {
        const context = source.getContext('2d', { willReadFrequently: true });
        if (!context) return 0;
        const width = source.width;
        const height = source.height;
        try {
            const pixels = context.getImageData(0, 0, width, height).data;
            let left = width, top = height, right = -1, bottom = -1;
            const stride = 4;
            for (let y = 0; y < height; y += stride) {
                for (let x = 0; x < width; x += stride) {
                    if (pixels[(y * width + x) * 4 + 3] < 18) continue;
                    left = Math.min(left, x);
                    top = Math.min(top, y);
                    right = Math.max(right, x);
                    bottom = Math.max(bottom, y);
                }
            }
            if (right < left || bottom < top) return 0;
            const cropWidth = right - left + 1;
            const cropHeight = bottom - top + 1;
            const targetWidth = Math.max(1, host.clientWidth);
            const targetHeight = Math.max(1, host.clientHeight);
            const scale = Math.min(targetWidth / cropWidth, targetHeight / cropHeight);
            return Math.min((cropWidth * scale) / targetWidth, (cropHeight * scale) / targetHeight);
        } catch {
            return 0;
        }
    }

    function shuffled(values) {
        const copy = [...values];
        for (let index = copy.length - 1; index > 0; index -= 1) {
            const swap = Math.floor(Math.random() * (index + 1));
            [copy[index], copy[swap]] = [copy[swap], copy[index]];
        }
        return copy;
    }

    async function mount() {
        const host = document.getElementById('dotCharacterHomePlayer');
        const canvas = host?.querySelector('.dot-character-render-canvas');
        const outputCanvas = host?.querySelector('.dot-character-home-canvas');
        if (!host || !canvas || !outputCanvas) return;
        if (!DOT_CHARACTER_ENABLED) {
            host.hidden = true;
            return;
        }
        // View changes only hide/show Home. Never start a second renderer for
        // the same canvas, because two animation loops can look like a page
        // refresh and needlessly compete for rendering time.
        if (host.dataset.dotCharacterMounted === 'true') return;

        try {
            const characters = await loadCharacters();
            if (!characters.length) return;

            // LwfPackPlayer sizes its renderer from the visible canvas. It
            // cannot initialise correctly while the host has the HTML hidden
            // attribute (which makes every measurement 0×0).
            host.hidden = false;
            await new Promise((resolve) => requestAnimationFrame(resolve));
            // This file is a module on purpose: it executes after the site's
            // LWF loader module, which installs the canvas renderer patches.
            // Dot-character PNGs are texture atlases, never usable fallback
            // images, so only show the actual composed LWF scene.
            for (let attempt = 0; attempt < 40 && typeof window.LWF?.useCanvasRenderer !== 'function'; attempt += 1) {
                await new Promise((resolve) => setTimeout(resolve, 25));
            }
            if (typeof window.LWF?.useCanvasRenderer !== 'function') throw new Error('LWF canvas renderer unavailable');
            const { LwfPackPlayer } = await import('../js-graphics/lwf-pack.js?v=20260905-dot-throttle-v2');
            // Keep the first acceptable random companion.  A candidate that
            // would only fill a sliver of the divider is discarded and a new
            // one is tried without refreshing or remounting the page.
            for (const entry of shuffled(characters).slice(0, 8)) {
                const files = await fetchFiles(entry);
                const player = new LwfPackPlayer(canvas, () => {}, { maxFps: 12 });
                player.loopMovie = true;
                player.freezeOnStaticTail = false;
                player.loopStartFrame = 1;
                const ingested = player.ingestFiles(files);
                if (!ingested.lwfFile) { player.clear(); continue; }
                const prepared = await player.prepare(ingested.lwfFile);
                if (prepared.missing?.length) { player.clear(); continue; }
                const movies = await player.load();
                const movie = movies[0];
                let isPlaying = Boolean(movie && player.setMovie(movie, { play: true }));

                // Most dot-character LWFs animate directly on their root
                // timeline rather than exposing an attachable movie linkage.
                if (!isPlaying && player.lwf?.rootMovie) {
                    player.movie = player.lwf.rootMovie;
                    player.clip = '_root';
                    player.play();
                    isPlaying = true;
                }
                if (!isPlaying) { player.clear(); continue; }

                await new Promise((resolve) => setTimeout(resolve, 360));
                if (measureSceneFill(canvas, host) < 0.30) {
                    player.clear();
                    continue;
                }
                fitRenderedCharacter(canvas, outputCanvas, host);
                host.dataset.dotCharacterMounted = 'true';
                return;
            }
            host.hidden = true;
        } catch (error) {
            // Optional visual: Home remains clean when a local asset is absent.
            host.hidden = true;
            console.debug('Dot-character companion unavailable:', error);
        }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
    else mount();
})();
