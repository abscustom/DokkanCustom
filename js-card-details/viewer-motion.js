// Localtunnel CORS bypass
if (!window._locaLtPatched) {
    window._locaLtPatched = true;
    
    // Patch fetch
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        let [resource, config] = args;
        const urlStr = typeof resource === 'string' ? resource : (resource?.url || '');
        if (urlStr.includes('loca.lt')) {
            config = config || {};
            config.headers = config.headers || {};
            if (config.headers instanceof Headers) {
                config.headers.set('Bypass-Tunnel-Reminder', 'true');
            } else {
                config.headers['Bypass-Tunnel-Reminder'] = 'true';
            }
            if (resource instanceof Request) {
                resource = new Request(resource, config);
            }
        }
        return originalFetch(resource, config);
    };

    // Patch XHR
    const originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
        this._reqUrl = url;
        return originalOpen.call(this, method, url, ...rest);
    };
    const originalSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function(...args) {
        if (this._reqUrl && this._reqUrl.includes('loca.lt')) {
            this.setRequestHeader('Bypass-Tunnel-Reminder', 'true');
        }
        return originalSend.apply(this, args);
    };
}

/* ==========================================================================
   Published viewer character idle motion

   The animation bridge resolves a card's character_id and returns the matching
   character idle-folder LWF package. Basic rigs loop their authored idle clip;
   rich rigs play entry, power-up, then loop their final idle linkage. This
   surface does not share editor state or controls.
   ========================================================================== */
(() => {
    'use strict';

    const LOCAL_SERVER = 'http://127.0.0.1:3137';
    const REMOTE_SERVER = 'https://abscustom-dokkan.loca.lt';
    // Card rendering normalizes the viewer URL with replaceState. Capture
    // motion-only debug overrides before that happens so a selected authored
    // movie can still be tested without changing the published URL format.
    const initialMotionParams = new URLSearchParams(
        window.__absMotionQuery || window.location.search,
    );
    const serverOverride = initialMotionParams.get('animationServer');
    const useLegacyMotionMatte = initialMotionParams.get('motionMatte') === '1';
    const requestedMotionClip = initialMotionParams.get('motionClip') || '';
    const requestedMotionFrameParam = initialMotionParams.get('motionFrame');
    const requestedMotionFrameValue = requestedMotionFrameParam === null
        ? Number.NaN
        : Number(requestedMotionFrameParam);
    const requestedMotionFrame = Number.isFinite(requestedMotionFrameValue)
        ? Math.max(1, Math.floor(requestedMotionFrameValue))
        : null;
    // Match DokkanDB's battle-motion defaults. Its Canvas player keeps
    // premultiplied texture handling enabled and runs the additive reduction
    // path; `motionBlend=native` remains available for renderer diagnostics.
    const useNativeMotionBlend = initialMotionParams.get('motionBlend') === 'native';
    const playMotionRoot = initialMotionParams.get('motionRoot') === 'live';
    const motionDebugEnabled = initialMotionParams.get('motionDebug') === '1';
    if (motionDebugEnabled) globalThis.LWF_BLEND_DEBUG = true;
    const motionNormalBlendOverride = initialMotionParams.get('motionNormalBlend');
    if (motionNormalBlendOverride) globalThis.LWF_NORMAL_BLEND_OVERRIDE = motionNormalBlendOverride;
    const motionDarkBlendOverride = initialMotionParams.get('motionDarkBlend');
    if (motionDarkBlendOverride) globalThis.LWF_DARK_BLEND_OVERRIDE = motionDarkBlendOverride;
    if (initialMotionParams.get('motionSkipDark') === '1') globalThis.LWF_SKIP_DARK_ATLAS = true;
    // Hold the last complete idle output by default. Pass motionFallback=0
    // when inspecting raw authored visibility changes in the motion tester.
    const motionFallbackEnabled = initialMotionParams.get('motionFallback') !== '0';
    const preferExistingMotionMovie = initialMotionParams.get('motionLinkage') === 'search';
    // The split entry/idle compositor is retained for diagnostics, but the
    // default viewer plays the authored entry/power-up/idle sequence.
    const useRichIdleComposite = initialMotionParams.get('motionRich') === '1';
    const motionAlphaOverride = Number(initialMotionParams.get('motionAlpha'));
    const stableMotionAlphaScale = Number.isFinite(motionAlphaOverride)
        ? Math.min(1, Math.max(0, motionAlphaOverride))
        : 1;
    const referenceMotionAdditiveScale = Number.isFinite(Number(initialMotionParams.get('motionAdditiveScale')))
        ? Math.min(1, Math.max(0, Number(initialMotionParams.get('motionAdditiveScale'))))
        : 0.1;
    let playerModulePromise = null;
    let activePlayer = null;
    let motionClockRaf = 0;
    let motionClockLastTs = 0;
    let motionClockAccumulator = 0;
    const motionClockFps = 60;
    const motionClockMaxDt = 0.25;
    const motionClockMaxSubSteps = 6;
    const motionClockMaxAccumulatedTime = 0.1;
    const BRIDGE_REQUEST_TIMEOUT_MS = 5000;
    let loadToken = 0;
    let sequenceRunId = 0;
    let motionVisibilityToken = 0;
    let activeCardId = 0;
    let loadingCardId = 0;
    let headerAxisObserver = null;
    let headerAxisFrame = 0;

    // A few authored idle scenes contain short aura-only frames while their
    // character layer is being switched. Keep the last complete character
    // frame on the same canvas so those frames cannot expose an empty viewer
    // or a bright aura by itself. This is a display safety net, not a second
    // animation: normal frames still come directly from the LWF renderer.
    const motionFallbackMinimumSubjectPixels = 30;

    function isLocalEnvironment() {
        return window.location.protocol === 'file:'
            || window.location.hostname === 'localhost'
            || window.location.hostname === '127.0.0.1'
            || !window.location.hostname;
    }

    function normalizeServer(value) {
        return String(value || '').trim().replace(/\/$/, '');
    }

    function getPreferredServer() {
        if (serverOverride) return normalizeServer(serverOverride);
        try {
            const saved = localStorage.getItem('absDokkanAnimationServer');
            if (saved) {
                const normalized = normalizeServer(saved);
                // A setting saved while previewing from the local checkout can
                // otherwise make a deployed page probe a user's loopback
                // machine. Public pages use the published bridge unless the
                // URL explicitly supplies an animationServer override.
                if (!isLocalEnvironment() && /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::|\/|$)/i.test(normalized)) {
                    return REMOTE_SERVER;
                }
                if (!(isLocalEnvironment() && normalized.includes('ngrok'))) {
                    return normalized;
                }
            }
        } catch {}
        return isLocalEnvironment() ? LOCAL_SERVER : REMOTE_SERVER;
    }

    function getServerCandidates() {
        const preferred = getPreferredServer();
        if (!isLocalEnvironment()) return [preferred].filter(Boolean);
        const fallback = preferred === LOCAL_SERVER ? REMOTE_SERVER : LOCAL_SERVER;
        return [...new Set([preferred, fallback].filter(Boolean))];
    }

    function bridgeHeaders(server) {
        return server.includes('ngrok') ? { 'ngrok-skip-browser-warning': 'true' } : {};
    }

    async function fetchWithTimeout(url, options = {}, timeoutMs = BRIDGE_REQUEST_TIMEOUT_MS) {
        if (typeof AbortController !== 'function') return fetch(url, options);
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            return await fetch(url, { ...options, signal: controller.signal });
        } finally {
            clearTimeout(timer);
        }
    }

    function resolveBridgeMediaUrl(value, server) {
        const raw = String(value || '');
        if (!raw || !server || /^(?:data|blob):/i.test(raw)) return value;
        try {
            const resolved = new URL(raw, server);
            if (!/^https?:$/i.test(resolved.protocol) || !/^\/(?:assets|api)\//i.test(resolved.pathname)) {
                return value;
            }
            const origin = new URL(server).origin;
            return `${origin}${resolved.pathname}${resolved.search}${resolved.hash}`;
        } catch {
            return value;
        }
    }

    function normalizeMotionPayload(payload, server) {
        const idle = payload?.idle;
        if (!idle || !server) return payload;
        idle.url = resolveBridgeMediaUrl(idle.url, server);
        if (Array.isArray(idle.files)) {
            idle.files = idle.files.map((file) => ({
                ...file,
                url: resolveBridgeMediaUrl(file?.url, server),
            }));
        }
        return payload;
    }

    async function fetchFromBridge(endpoint) {
        let lastError = null;
        let lastResponse = null;
        let lastServer = '';
        for (const server of getServerCandidates()) {
            try {
                const response = await fetchWithTimeout(server + endpoint, {
                    cache: 'no-store',
                    headers: bridgeHeaders(server)
                });
                if (response.ok) return { response, server };
                lastResponse = response;
                lastServer = server;
                lastError = new Error('Animation bridge returned ' + response.status);
            } catch (error) {
                lastError = error;
            }
        }
        if (lastResponse) return { response: lastResponse, server: lastServer };
        throw lastError || new Error('No animation bridge is available.');
    }

    function setStatus(text, state = '') {
        const status = document.getElementById('abs-motion-status');
        if (!status) return;
        status.textContent = text;
        status.dataset.state = state;
    }

    function setMotionAvailability(available, state = '') {
        const box = document.getElementById('abs-motion-box');
        const layout = document.getElementById('layout-abs-style');
        const visible = Boolean(available);
        if (box) {
            box.hidden = !visible;
            box.dataset.motionAvailable = visible ? 'true' : 'false';
            box.dataset.motionState = String(state || '');
            box.setAttribute('aria-hidden', visible ? 'false' : 'true');
            box.classList.toggle('is-unavailable', !visible);
            if (visible) delete box.dataset.motionUnavailableReason;
            else box.dataset.motionUnavailableReason = String(state || 'unavailable');
        }
        if (layout) {
            layout.dataset.motionAvailable = visible ? 'true' : 'false';
            layout.classList.toggle('abs-motion-unavailable', !visible);
        }
        document.body?.classList.toggle('abs-motion-unavailable', !visible);
        syncViewerHeaderAxis();
        scheduleViewerHeaderAxisSync();
        window.dispatchEvent(new CustomEvent('abs-motion-availability', {
            detail: { available: visible, state: String(state || '') },
        }));
    }

    function syncViewerHeaderAxis() {
        const motionBox = document.getElementById('abs-motion-box');
        const sideCol = document.querySelector('#layout-abs-style .abs-side-col');
        const motionStyle = motionBox ? getComputedStyle(motionBox) : null;
        const motionVisible = Boolean(
            motionBox
            && motionBox.dataset.motionAvailable === 'true'
            && !motionBox.hidden
            && motionStyle?.display !== 'none'
            && (motionBox.offsetHeight > 0 || motionBox.getBoundingClientRect().height > 0),
        );
        if (sideCol) {
            if (motionVisible) {
                const motionHeight = Math.round(
                    motionBox.getBoundingClientRect().height || motionBox.offsetHeight || 0,
                );
                if (motionHeight > 0) {
                    sideCol.style.setProperty('--abs-viewer-motion-height', `${motionHeight}px`);
                    sideCol.style.setProperty('--abs-viewer-motion-margin-bottom', '16px');
                    sideCol.style.removeProperty('--abs-clean-motion-rail-top');
                    sideCol.style.setProperty('--abs-clean-motion-rail-height', 'calc(var(--abs-viewer-motion-height) + var(--abs-viewer-motion-margin-bottom))', 'important');
                }
            } else {
                sideCol.style.setProperty('--abs-viewer-motion-height', '0px');
                sideCol.style.setProperty('--abs-viewer-motion-margin-top', '0px');
                sideCol.style.setProperty('--abs-viewer-motion-margin-bottom', '0px');
                sideCol.style.setProperty('--abs-clean-motion-rail-top', '0px', 'important');
                sideCol.style.setProperty('--abs-clean-motion-rail-height', '0px', 'important');
            }
        }

        if (!document.body?.classList.contains('theme-abs-clean')) return;
        const header = document.querySelector('#layout-abs-style > .abs-top-header');
        const passive = document.getElementById('abs-passive-skill-box');
        const anchor = document.getElementById('abs-composed-icon')
            || document.getElementById('abs-art-dock-wrapper')
            || document.getElementById('abs-clean-portrait-stage');
        const identity = document.getElementById('abs-clean-identity-icons');
        if (!header) return;

        const headerRect = header.getBoundingClientRect();
        if (!(headerRect.width > 0)) return;

        if (passive) {
            const passiveRect = passive.getBoundingClientRect();
            if (passiveRect.width > 0) {
                const leftPercent = ((passiveRect.left - headerRect.left) / headerRect.width) * 100;
                const widthPercent = (passiveRect.width / headerRect.width) * 100;
                header.style.setProperty('--abs-clean-viewer-axis-left', `${leftPercent}%`);
                header.style.setProperty('--abs-clean-viewer-axis-width', `${widthPercent}%`);
            }
        }

        // The identity/tag rail is rendered in the header DOM for clean-mode
        // lifecycle compatibility. Its visual anchor is the centered card
        // circle, not the large art panel in the side column. Measure that
        // circle so the rail stays centered when the viewport, zoom, or card
        // layout changes.
        if (anchor) {
            const anchorRect = anchor.getBoundingClientRect();
            if (anchorRect.width > 0 && anchorRect.height > 0) {
                const anchorCenter = anchorRect.left + (anchorRect.width / 2);
                const identityLeftPercent = ((anchorCenter - headerRect.left) / headerRect.width) * 100;
                header.style.setProperty('--abs-clean-viewer-identity-left', `${identityLeftPercent}%`);
            }
        }
    }

    function scheduleViewerHeaderAxisSync() {
        if (headerAxisFrame) return;
        headerAxisFrame = window.requestAnimationFrame(() => {
            headerAxisFrame = 0;
            syncViewerHeaderAxis();
        });
    }

    function initViewerHeaderAxisSync() {
        if (headerAxisObserver || !document.body?.classList.contains('theme-abs-clean')) return;
        scheduleViewerHeaderAxisSync();
        window.addEventListener('resize', scheduleViewerHeaderAxisSync, { passive: true });
        window.addEventListener('abs-card-content-ready', scheduleViewerHeaderAxisSync);
        if (document.fonts?.ready) document.fonts.ready.then(() => scheduleViewerHeaderAxisSync()).catch(() => {});
        if (document.readyState === 'complete') scheduleViewerHeaderAxisSync();
        else window.addEventListener('load', scheduleViewerHeaderAxisSync, { once: true });
        if (typeof ResizeObserver === 'function') {
            headerAxisObserver = new ResizeObserver(scheduleViewerHeaderAxisSync);
            [
                document.querySelector('#layout-abs-style > .abs-top-header'),
                // The rail itself: badge population changes its height after
                // the first sync, which previously left it stranded forever.
                document.getElementById('abs-clean-identity-icons'),
                document.getElementById('abs-passive-skill-box'),
                document.getElementById('abs-composed-icon'),
                document.getElementById('abs-art-dock-wrapper'),
                document.getElementById('abs-clean-portrait-stage')
            ].filter(Boolean).forEach((element) => headerAxisObserver.observe(element));
        } else {
            window.setTimeout(scheduleViewerHeaderAxisSync, 250);
            window.setTimeout(scheduleViewerHeaderAxisSync, 1000);
        }
    }

    function isPlayableMotionMovie(name) {
        const value = String(name || '').trim();
        return Boolean(value) && !/^empty(?:_|$)/i.test(value) && !/_empty/i.test(value);
    }

    function updateMotionClipDisplay(name) {
        const value = String(name || '');
        const canvas = document.getElementById('abs-motion-canvas');
        if (canvas && value) canvas.dataset.motionClip = value;
    }

    function describeMotionMovie(movie, depth = 0, seen = new Set()) {
        if (!movie || depth > 8 || seen.has(movie)) return null;
        seen.add(movie);
        const children = [];
        if (Array.isArray(movie.z$2)) children.push(...movie.z$2);
        for (let child = movie.z$ja; child; child = child.z$sa) children.push(child);
        return {
            name: String(movie.name || ''),
            total: Number(movie.totalFrames || movie.data?.frames || 0),
            current: Number(movie.currentFrame || 0),
            playing: movie.playing !== false,
            active: movie.active !== false,
            visible: movie.visible !== false,
            children: children
                .filter((child) => child && (child.totalFrames != null || child.data?.frames != null))
                .map((child) => describeMotionMovie(child, depth + 1, seen))
                .filter(Boolean),
        };
    }

    // Some idle packages expose transition linkages that are valid LWF movies
    // but contain no visible pixels when attached on their own. If one of
    // those linkages replaces the character movie, the viewer looks empty for
    // a cycle even though the LWF is still advancing. Measure the rendered
    // canvas once after each hand-off and skip only a genuinely empty clip.
    function measureMotionVisibility(canvas) {
        if (!canvas || typeof canvas.getContext !== 'function' || !canvas.width || !canvas.height) {
            return {
                pixels: 0,
                centerPixels: 0,
                brightPixels: 0,
                centerBrightPixels: 0,
                subjectPixels: 0,
                centerSubjectPixels: 0,
            };
        }
        try {
            const context = canvas.getContext('2d', { willReadFrequently: true });
            if (!context) {
                return {
                    pixels: 0,
                    centerPixels: 0,
                    brightPixels: 0,
                    centerBrightPixels: 0,
                    subjectPixels: 0,
                    centerSubjectPixels: 0,
                };
            }
            const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
            const centerLeft = canvas.width * 0.16;
            const centerRight = canvas.width * 0.84;
            const centerTop = canvas.height * 0.08;
            const centerBottom = canvas.height * 0.92;
            const step = 8;
            let visible = 0;
            let centerVisible = 0;
            let bright = 0;
            let centerBright = 0;
            let subject = 0;
            let centerSubject = 0;
            for (let y = 0; y < canvas.height; y += step) {
                for (let x = 0; x < canvas.width; x += step) {
                    const index = ((y * canvas.width) + x) * 4;
                    const alpha = pixels[index + 3];
                    if (alpha <= 8) continue;
                    const red = pixels[index];
                    const green = pixels[index + 1];
                    const blue = pixels[index + 2];
                    const luma = Math.max(red, green, blue);
                    const inCenter = x >= centerLeft && x <= centerRight && y >= centerTop && y <= centerBottom;
                    visible += 1;
                    if (inCenter) centerVisible += 1;
                    if (luma > 22) {
                        bright += 1;
                        if (inCenter) centerBright += 1;
                    }
                    // Aura plates are predominantly warm yellow/orange. A
                    // complete character frame contributes cooler armor,
                    // skin, hair shadows, or neutral linework as well. Keep a
                    // small subject score so an aura-only frame cannot become
                    // the fallback or pass the visibility guard.
                    const warmAura = red > blue * 1.25
                        && green > blue * 1.08
                        && red > 45
                        && green > 45;
                    const chroma = luma - Math.min(red, green, blue);
                    const coolSubject = luma > 22 && blue > red * 0.9 && !warmAura;
                    const neutralSubject = luma > 55 && chroma < 28;
                    const subjectPixel = coolSubject || neutralSubject;
                    if (subjectPixel) {
                        subject += 1;
                        if (inCenter) centerSubject += 1;
                    }
                }
            }
            return {
                pixels: visible,
                centerPixels: centerVisible,
                brightPixels: bright,
                centerBrightPixels: centerBright,
                subjectPixels: subject,
                centerSubjectPixels: centerSubject,
            };
        } catch {
            return {
                pixels: 0,
                centerPixels: 0,
                brightPixels: 0,
                centerBrightPixels: 0,
                subjectPixels: 0,
                centerSubjectPixels: 0,
            };
        }
    }

    function exposeMotionDebug(player) {
        if (!motionDebugEnabled || !player) return;
        const canvas = document.getElementById('abs-motion-canvas');
        if (!canvas) return;
        const rendererFactory = player.lwf?.rendererFactory;
        canvas.dataset.motionBlendStats = JSON.stringify(rendererFactory?.__absBlendStats || null);
        if (Array.isArray(player.__absMotionLayerPlayers)) {
            canvas.dataset.motionLayerBlendStats = JSON.stringify(
                player.__absMotionLayerPlayers.map((layer) => ({
                    clip: layer.clip || '',
                    movie: describeMotionMovie(layer.movie),
                    stats: layer.lwf?.rendererFactory?.__absBlendStats || null,
                })),
            );
        }
        canvas.dataset.motionRendererState = JSON.stringify(
            (Array.isArray(player.__absMotionLayerPlayers)
                ? player.__absMotionLayerPlayers
                : [player]).map((layer) => {
                const factory = layer.lwf?.rendererFactory;
                return {
                    clip: layer.clip || '',
                    renderCount: Number(layer.lwf?.z$aa) || 0,
                    commandCount: Number(factory?.z$9i) || 0,
                    commands: Array.isArray(factory?.z$8a)
                        ? factory.z$8a.map((command, index) => command ? {
                            index,
                            depth: command.z$M,
                            generation: command.z$aa,
                            mode: command.blendMode,
                            sourceX: command.z$R,
                            sourceY: command.z$S,
                            sourceWidth: command.z$q,
                            sourceHeight: command.z$k,
                        } : null).filter(Boolean)
                        : [],
                    movieChildren: layer.movie?.z$2?.map((child, index) => ({
                        index,
                        type: child?.type,
                        isMovie: Boolean(child?.isMovie),
                        active: child?.active,
                        visible: child?.visible,
                        playing: child?.playing,
                        childFrame: child?.currentFrame,
                        resource: child?.z$ca ? {
                            sourceX: child.z$ca.z$R,
                            sourceY: child.z$ca.z$S,
                            sourceWidth: child.z$ca.z$q,
                            sourceHeight: child.z$ca.z$k,
                        } : null,
                    })) || [],
                };
            }),
        );
        const data = player.lwf?.data;
        if (!data) return;
        const simplify = (value) => {
            if (!value || typeof value !== 'object') return value;
            const out = {};
            for (const [key, item] of Object.entries(value)) {
                if (typeof item === 'function') continue;
                if (item && typeof item === 'object') {
                    if (Array.isArray(item)) out[key] = `[array:${item.length}]`;
                    else if (item.constructor === Object) out[key] = `[object]`;
                    else out[key] = String(item);
                } else {
                    out[key] = item;
                }
            }
            return out;
        };
        canvas.dataset.motionDataSummary = JSON.stringify({
            textures: (data.textures || []).map((item, index) => ({ index, ...simplify(item) })),
            textureFragments: (data.textureFragments || []).map((item, index) => ({ index, ...simplify(item) })),
            bitmaps: (data.bitmaps || []).map((item, index) => ({ index, ...simplify(item) })),
            bitmapExs: (data.bitmapExs || []).map((item, index) => ({ index, ...simplify(item) })),
            frames: (data.frames || []).map((item, index) => ({ index, ...simplify(item) })),
        });
    }

    function syncMotionCanvasSize(target, source) {
        if (!target || !source?.width || !source?.height) return false;
        if (target.width !== source.width) target.width = source.width;
        if (target.height !== source.height) target.height = source.height;
        return true;
    }

    function renderMotionFrame(player) {
        if (!player) return false;
        const displayCanvas = document.getElementById('abs-motion-canvas');
        const layerPlayers = Array.isArray(player.__absMotionLayerPlayers)
            ? player.__absMotionLayerPlayers.filter(Boolean)
            : null;
        let rendered = false;
        let outputCanvas = player.canvas;

        if (layerPlayers?.length > 1) {
            // DokkanDB renders the entry and idle effects in separate
            // app-lightning-lwf canvases and composites them after both have
            // advanced on the shared clock. Render into a private composition
            // canvas first so a sparse/empty authored frame can never clear
            // the visible viewer surface.
            for (const layer of layerPlayers) {
                rendered = layer.renderFrame?.(false) || rendered;
            }
            const sources = layerPlayers.map((layer) => layer.canvas)
                .filter((source) => source?.width && source?.height);
            const firstSource = sources[0];
            if (firstSource) {
                let compositionCanvas = player.__absMotionCompositeCanvas;
                if (!compositionCanvas) {
                    compositionCanvas = document.createElement('canvas');
                    player.__absMotionCompositeCanvas = compositionCanvas;
                }
                compositionCanvas.width = firstSource.width;
                compositionCanvas.height = firstSource.height;
                const context = compositionCanvas.getContext('2d');
                if (context) {
                    context.save();
                    context.setTransform(1, 0, 0, 1, 0, 0);
                    context.globalAlpha = 1;
                    context.globalCompositeOperation = 'source-over';
                    context.clearRect(0, 0, compositionCanvas.width, compositionCanvas.height);
                    for (const source of sources) {
                        context.drawImage(
                            source,
                            0,
                            0,
                            compositionCanvas.width,
                            compositionCanvas.height,
                        );
                    }
                    context.restore();
                    outputCanvas = compositionCanvas;
                }
            }
        } else {
            rendered = player.renderFrame?.(false);
        }

        if (!displayCanvas || !outputCanvas?.width || !outputCanvas?.height) {
            exposeMotionDebug(player);
            return rendered;
        }
        syncMotionCanvasSize(displayCanvas, outputCanvas);

        const visibility = measureMotionVisibility(outputCanvas);
        const hasPixels = visibility.pixels >= 4;
        const hasSubject = visibility.subjectPixels >= motionFallbackMinimumSubjectPixels
            || visibility.centerSubjectPixels >= 12;
        if (hasSubject) player.__absMotionVisibleClip = player.clip;
        // Power-up linkages can end with a body-less effect tail. Holding the
        // previous bitmap for that tail looks like a pause between scenes.
        // Only hand off after this clip has shown its body and passed halfway;
        // setup frames, standalone previews and the final loop stay untouched.
        if (!hasSubject
            && player.__absMotionVisibleClip === player.clip
            && /c16_heapup_back_p$/i.test(String(player.clip))
            && !player.loopMovie
            && typeof player.onEnded === 'function'
            && Number(player.movie?.currentFrame) > Number(player.movie?.totalFrames) / 2) {
            const onEnded = player.onEnded;
            player.onEnded = null;
            onEnded();
            return rendered;
        }
        let shouldDisplay = true;

        if (motionFallbackEnabled) {
            // Idle rigs occasionally render an authored light plate without
            // the body for one or more frames. Keep the last complete output
            // on the display canvas while the private LWF canvas continues to
            // advance. This preserves the body/effect phase and prevents the
            // visible black flash without pausing the animation clock.
            if (hasSubject) player.__absMotionHasCompleteFrame = true;
            if (!hasPixels || (player.__absMotionHasCompleteFrame && !hasSubject)) {
                shouldDisplay = false;
            }
        }

        if (shouldDisplay) {
            const context = displayCanvas.getContext('2d');
            if (context) {
                context.save();
                context.setTransform(1, 0, 0, 1, 0, 0);
                context.globalAlpha = 1;
                context.globalCompositeOperation = 'source-over';
                context.clearRect(0, 0, displayCanvas.width, displayCanvas.height);
                context.drawImage(
                    outputCanvas,
                    0,
                    0,
                    displayCanvas.width,
                    displayCanvas.height,
                );
                context.restore();
            }
        }

        exposeMotionDebug(player);
        if (motionFallbackEnabled && (!shouldDisplay || motionDebugEnabled)) {
            displayCanvas.dataset.motionFallback = shouldDisplay ? 'live' : 'held';
            displayCanvas.dataset.motionVisibility = JSON.stringify({
                clip: player.clip || '',
                ...visibility,
                restored: !shouldDisplay,
            });
        }
        return rendered;
    }

    function scheduleMotionVisibilityGuard(player, clip, onInvisible) {
        const canvas = document.getElementById('abs-motion-canvas');
        const token = ++motionVisibilityToken;
        let attempts = 0;
        const check = () => {
            if (token !== motionVisibilityToken || activePlayer !== player || player.clip !== clip) return;
            const visibility = measureMotionVisibility(canvas);
            if (canvas) {
                canvas.dataset.motionVisibility = JSON.stringify({ clip, ...visibility });
            }
            // Give the LWF a short grace period for its first texture upload
            // before deciding that the selected linkage is empty.
            if (visibility.pixels >= 4 && visibility.brightPixels >= 2) {
                player.__absLastVisibleMotionClip = clip;
                return;
            }
            attempts += 1;
            if (attempts < 6) {
                window.setTimeout(check, 50);
                return;
            }
            onInvisible?.();
        };
        window.setTimeout(check, 80);
    }

    // Kept as an opt-in compatibility helper for older externally supplied
    // atlases. Official idle LWFs must keep their original RGBA pixels: the
    // runtime's nested layers and blend modes already describe how the aura is
    // supposed to be composed.
    async function removeMotionBlackMatte(blob) {
        // The bridge may label atlas responses as application/octet-stream;
        // the caller has already restricted this path to image extensions.
        if (!blob || (blob.type && !/^image\//i.test(blob.type))) return blob;
        let objectUrl = '';
        try {
            objectUrl = URL.createObjectURL(blob);
            const image = await new Promise((resolve, reject) => {
                const element = new Image();
                element.onload = () => resolve(element);
                element.onerror = reject;
                element.src = objectUrl;
            });
            const canvas = document.createElement('canvas');
            canvas.width = image.naturalWidth || image.width;
            canvas.height = image.naturalHeight || image.height;
            const context = canvas.getContext('2d', { willReadFrequently: true });
            if (!context || !canvas.width || !canvas.height) return blob;
            context.clearRect(0, 0, canvas.width, canvas.height);
            context.drawImage(image, 0, 0);
            const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
            const pixels = imageData.data;
            const blackCutoff = 10;
            const blackFeatherEnd = 42;
            for (let index = 0; index < pixels.length; index += 4) {
                const brightness = Math.max(pixels[index], pixels[index + 1], pixels[index + 2]);
                const originalAlpha = pixels[index + 3];
                if (brightness <= blackCutoff) {
                    pixels[index + 3] = 0;
                } else if (brightness < blackFeatherEnd) {
                    const matteAlpha = Math.round(((brightness - blackCutoff) / (blackFeatherEnd - blackCutoff)) * 255);
                    pixels[index + 3] = Math.min(originalAlpha, matteAlpha);
                }
            }
            context.putImageData(imageData, 0, 0);
            const output = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
            return output || blob;
        } catch {
            return blob;
        } finally {
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        }
    }

    function clearActivePlayer() {
        sequenceRunId += 1;
        motionVisibilityToken += 1;
        if (motionClockRaf) {
            cancelAnimationFrame(motionClockRaf);
            motionClockRaf = 0;
        }
        motionClockLastTs = 0;
        motionClockAccumulator = 0;
        const displayCanvas = document.getElementById('abs-motion-canvas');
        if (displayCanvas) {
            try {
                displayCanvas.getContext('2d')?.clearRect(
                    0,
                    0,
                    displayCanvas.width,
                    displayCanvas.height,
                );
            } catch {}
            displayCanvas.dataset.motionFallback = '';
            displayCanvas.dataset.motionVisibility = '';
        }
        if (!activePlayer) return;
        activePlayer.__absMotionComposite = null;
        activePlayer.__absMotionCompositeCanvas = null;
        activePlayer.__absMotionHasCompleteFrame = false;
        activePlayer.onEnded = null;
        activePlayer.onFrame = null;
        const layerPlayers = Array.isArray(activePlayer.__absMotionLayerPlayers)
            ? activePlayer.__absMotionLayerPlayers
            : [activePlayer];
        for (const layer of layerPlayers) {
            try { layer.clear?.(); } catch {}
        }
        activePlayer = null;
    }

    // Match the reference battle-motion clock: one bounded 60 FPS clock
    // advances the loaded LWF, then renders it. This avoids a scene-owned rAF
    // racing the authored loop boundary and flashing the first light plate.
    function startMotionClock(player) {
        if (!player) return;
        // A character linkage may have been stopped by its frame-one setup
        // command while the pack was being attached. The viewer clock owns
        // the idle lifecycle, so re-arm the player before scheduling it.
        player.playing = true;
        if (player.movie) {
            player.movie.active = true;
            player.movie.visible = true;
            player.movie.playing = true;
        }
        if (motionClockRaf) cancelAnimationFrame(motionClockRaf);
        motionClockRaf = 0;
        motionClockLastTs = 0;
        motionClockAccumulator = 0;
        const fixedStep = 1 / motionClockFps;
        const tick = (timestamp) => {
            if (activePlayer !== player || !player.lwf || !player.playing) {
                motionClockRaf = 0;
                return;
            }
            if (!motionClockLastTs) motionClockLastTs = timestamp;
            const elapsed = Math.min(
                Math.max((timestamp - motionClockLastTs) / 1000, 0),
                motionClockMaxDt,
            );
            motionClockLastTs = timestamp;
            motionClockAccumulator = Math.min(
                motionClockMaxAccumulatedTime,
                motionClockAccumulator + elapsed,
            );

            let steps = 0;
            while (motionClockAccumulator >= fixedStep && steps < motionClockMaxSubSteps) {
                advanceMotionClockStep(player, fixedStep);
                motionClockAccumulator -= fixedStep;
                steps += 1;
            }
            if (steps === 0 && motionClockAccumulator > 0) {
                advanceMotionClockStep(player, motionClockAccumulator);
                motionClockAccumulator = 0;
            } else if (steps >= motionClockMaxSubSteps) {
                motionClockAccumulator = Math.min(motionClockAccumulator, fixedStep);
            }
            renderMotionFrame(player);
            motionClockRaf = requestAnimationFrame(tick);
        };
        motionClockRaf = requestAnimationFrame(tick);
    }

    function advanceMotionClockStep(player, seconds) {
        if (player) {
            player.playing = true;
            if (player.movie) player.movie.playing = true;
        }
        const composite = player.__absMotionComposite;
        const layerPlayers = Array.isArray(composite?.layerPlayers)
            ? composite.layerPlayers.filter(Boolean)
            : null;
        let advanced = false;
        if (layerPlayers?.length > 1) {
            for (const layer of layerPlayers) {
                if (layer === composite.idlePlayer && !composite.idleStarted) continue;
                advanced = layer.advance?.(seconds, false) || advanced;
            }
        } else {
            advanced = player.advance?.(seconds, false);
        }
        if (!advanced || !composite) return advanced;

        composite.clockFrame = (Number(composite.clockFrame) || 1)
            + (Number(seconds) || 0) * motionClockFps;

        if (!composite.idleStarted && composite.clockFrame >= composite.startAtFrame) {
            const idleMovie = composite.idleMovie;
            if (idleMovie) {
                idleMovie.active = true;
                idleMovie.visible = true;
                idleMovie.playing = true;
                // `start_at_frame` is both the visibility gate and the frame
                // passed to app-lightning-lwf's `startFrame` input. Starting
                // this linkage at frame 1 would put the aura/character 49
                // authored frames behind the reference player.
                idleMovie.gotoAndPlay?.(Math.max(1, Math.floor(composite.startAtFrame)));
                if (composite.idlePlayer) {
                    composite.idlePlayer.playing = true;
                    composite.idlePlayer._emitFrame?.();
                }
                composite.idleStarted = true;
            }
        }

        // The reference player removes a stop-at-end entry layer after its
        // authored timeline finishes. Let the idle layer continue underneath
        // it during the intentional overlap, then hide only the completed
        // entry linkage.
        if (
            !composite.entryEnded
            && composite.entryStarted
            && (
                composite.entryMovie?.playing === false
                || composite.clockFrame >= composite.entryEndAtFrame
            )
        ) {
            composite.entryMovie.visible = false;
            composite.entryMovie.active = false;
            composite.entryEnded = true;
        }

        // stop_at_end=false on the reference idle layer means that the layer
        // remains part of the ambient viewer. If an authored LWF reaches its
        // final frame, restart that layer alone; the shared clock and entry
        // phase are never reset.
        if (
            composite.idleStarted
            && composite.idleMovie?.playing === false
        ) {
            composite.idleMovie.active = true;
            composite.idleMovie.visible = true;
            composite.idleMovie.playing = true;
            composite.idleMovie.gotoAndPlay?.(1);
            if (composite.idlePlayer) composite.idlePlayer.playing = true;
        }
        return advanced;
    }

    function idleSequence(movies = []) {
        const names = [...new Set(movies.filter(isPlayableMotionMovie).map(String))];
        const entry = names.find((name) => /c21_rich_entry_back_p$/i.test(name));
        const powerUp = names.find((name) => /c16_heapup_back_p$/i.test(name));
        const idle = names.find((name) => /c22_rich_idl_back_p$/i.test(name));
        // These are exported linkages inside the idle-folder LWF, not three
        // separate files. Basic packs retain their single-clip fallback.
        return entry && idle ? [entry, powerUp, idle].filter(Boolean) : [];
    }

    function richIdleLayers(movies = []) {
        const names = [...new Set((Array.isArray(movies) ? movies : [])
            .filter(isPlayableMotionMovie)
            .map((name) => String(name)))];
        const entry = names.find((name) => /c21_rich_entry_back_p$/i.test(name)) || null;
        const idle = names.find((name) => /c22_rich_idl_back_p$/i.test(name)) || null;
        return entry && idle
            ? { entry, idle, startAtFrame: 50 }
            : null;
    }

    function startRichIdleComposite(player, layers, idlePlayer = null) {
        if (!player || !idlePlayer || !layers?.entry || !layers?.idle) return false;

        const entryStarted = player.setMovie?.(layers.entry, { play: false });
        const idleStarted = idlePlayer.setMovie?.(layers.idle, { play: false });
        const entryMovie = entryStarted ? player.movie : null;
        const idleMovie = idleStarted ? idlePlayer.movie : null;
        if (!entryMovie || !idleMovie) return false;

        const root = player.lwf?.rootMovie;
        const idleRoot = idlePlayer.lwf?.rootMovie;
        for (const layerRoot of [root, idleRoot]) {
            if (!layerRoot) continue;
            layerRoot.active = true;
            layerRoot.visible = true;
            layerRoot.playing = false;
        }
        entryMovie.active = true;
        entryMovie.visible = true;
        entryMovie.playing = true;
        entryMovie.gotoAndPlay?.(1);
        idleMovie.active = false;
        idleMovie.visible = false;
        idleMovie.playing = false;

        player.movie = entryMovie;
        player.clip = layers.entry;
        player.playing = true;
        player.loopMovie = false;
        player.ignoreMovieEnd = true;
        player.waitForNestedMoviesAtEnd = false;
        idlePlayer.playing = false;
        idlePlayer.loopMovie = true;
        idlePlayer.ignoreMovieEnd = true;
        idlePlayer.waitForNestedMoviesAtEnd = false;
        player.__absMotionLayerPlayers = [player, idlePlayer];
        player.__absMotionComposite = {
            entryMovie,
            idleMovie,
            entryPlayer: player,
            idlePlayer,
            layerPlayers: [player, idlePlayer],
            entryStarted: true,
            entryEnded: false,
            idleStarted: false,
            startAtFrame: Math.max(1, Number(layers.startAtFrame) || 50),
            clockFrame: 1,
            // The shared reference clock runs at 60 FPS while the LWF pack
            // is authored at its 30 FPS frame rate. Stop-at-end therefore
            // occurs after this many shared-clock frames, not after the raw
            // linkage's frame number is reached twice as fast.
            entryEndAtFrame: Math.max(
                1,
                (Math.max(1, Number(entryMovie.totalFrames) || 1)
                    * motionClockFps
                    / Math.max(1, Number(player.fps?.()) || 30)) + 1,
            ),
        };
        player.onEnded = null;

        updateMotionClipDisplay(layers.entry);
        const canvas = document.getElementById('abs-motion-canvas');
        if (canvas) {
            canvas.dataset.motionLayers = JSON.stringify({
                entry: layers.entry,
                idle: layers.idle,
                idleStartFrame: Math.max(1, Number(layers.startAtFrame) || 50),
                entryDepth: 1,
                idleDepth: 0,
            });
        }

        player.play();
        try {
            player.lwf?.exec?.(0);
            idlePlayer.lwf?.exec?.(0);
            renderMotionFrame(player);
        } catch {}
        return true;
    }

    function idleClip(movies = []) {
        const names = movies.filter(isPlayableMotionMovie);
        const idleNames = names.filter((name) => /idl/i.test(String(name)));
        const preferred = idleNames.find((name) => /c00_idl_front_p$/i.test(String(name)))
            || idleNames.find((name) => /c00_idl_front_e$/i.test(String(name)))
            || idleNames.find((name) => /c00_idl_front/i.test(String(name)))
            || idleNames.find((name) => /idl_front/i.test(String(name)));
        const richIdle = names.find((name) => /c16_heapup_back_p$/i.test(String(name)))
            || idleNames.find((name) => /c22_rich_idl_back_p$/i.test(String(name)));
        return preferred || richIdle || idleNames[0] || names[0] || null;
    }

    // Characters without an authored idle clip still get motion: play the
    // pack's first movie (movie 0) instead of leaving the viewer blank.
    function firstMotionMovie(movies = [], availableMovies = []) {
        const seen = new Set();
        for (const source of [movies, availableMovies]) {
            if (!Array.isArray(source)) continue;
            for (const entry of source) {
                const value = String(entry || '').trim();
                if (!value || seen.has(value)) continue;
                seen.add(value);
                return value;
            }
        }
        return null;
    }

    function startIdleMovie(player, clip, {
        loop = true,
        onEnded = null,
    } = {}) {
        if (!player || !clip || !player.setMovie(clip, { play: false })) return false;

        // Character packs use the root as an attachment container. Keep it
        // active but paused; the shared viewer clock advances the selected
        // authored linkage without letting the root's setup frame reset it.
        const root = player.lwf?.rootMovie;
        if (root) {
            root.active = true;
            root.playing = !player.freezeRootMovie;
            root.visible = true;
        }

        const movie = player.movie;
        if (!movie) return false;
        movie.visible = true;
        movie.active = true;
        movie.playing = true;
        // The rich idle linkages reserve frame 1 for their setup/stop marker.
        // Starting on frame 2 keeps the authored body layer alive while the
        // normal clock advances the remaining nested movies.
        const startFrame = /(?:c16_heapup_back_p|c22_rich_idl_back_p)$/i.test(String(clip))
            ? 2
            : 1;
        // Only the first two scenes need a bounded hand-off to the next
        // authored movie. The final scene is allowed to use each nested
        // movie's own LWF timeline, which avoids restarting every child at a
        // synthetic global frame and causing the aura to flash.
        const totalFrames = Math.max(
            0,
            Number(player.getMovieFrameCount?.() || player.movie?.totalFrames) || 0
        );
        player.waitForNestedMoviesAtEnd = !loop;
        player.seamlessLoop = false;
        player.loopStartFrame = 0;
        player.loopEndFrame = loop ? 0 : (totalFrames > 1 ? Math.floor(totalFrames) : 0);
        player.loopTailFrames = 0;
        player.loopMovie = Boolean(loop);
        player.onEnded = typeof onEnded === 'function' ? onEnded : null;
        // Pass the authored start frame through the player. Calling play()
        // without it would seek the linkage back to frame 1 immediately
        // after the setup above, leaving the idle body parked there.
        player.play(startFrame);
        try {
            // Re-run the zero-time scene step after the attached movie is
            // switched from stopped to playing. The character's bitmap child
            // is created by that authored step; rendering without it can
            // leave only the additive aura visible.
            player.lwf?.exec?.(0);
            renderMotionFrame(player);
        } catch {}
        scheduleMotionVisibilityGuard(player, clip, () => {
            if (activePlayer !== player || player.clip !== clip) return;
            const fallback = player.__absLastVisibleMotionClip;
            if (typeof onEnded === 'function') {
                try { player.pause?.(); } catch {}
                onEnded();
            } else if (fallback && fallback !== clip) {
                startIdleMovie(player, fallback, { loop: true });
            }
        });
        return true;
    }

    function startIdleSequence(player, sequence) {
        if (!player || !sequence?.length) return false;
        const runId = ++sequenceRunId;
        const playAt = (index) => {
            if (runId !== sequenceRunId || player !== activePlayer) return false;
            const clip = sequence[index];
            if (!clip) return false;
            const isFinal = index >= sequence.length - 1;
            const started = startIdleMovie(player, clip, {
                // Advance through the introduction once, then keep the last
                // scene animated using the normal idle looping path.
                loop: isFinal,
                onEnded: isFinal ? null : () => playAt(index + 1),
            });
            if (!started && !isFinal) return playAt(index + 1);
            if (started) {
                updateMotionClipDisplay(clip);
                setStatus('', 'ready');
            }
            return started;
        };
        return playAt(0);
    }

    async function loadIdlePack(pack, fallbackName, canvas) {
        if (!pack?.url) throw new Error('The animation bridge did not return an idle package.');

        const files = [];
        const lwfResponse = await fetchWithTimeout(pack.url, {
            cache: 'no-store',
            headers: pack.url.includes('ngrok') ? { 'ngrok-skip-browser-warning': 'true' } : {}
        });
        if (!lwfResponse.ok) throw new Error('Missing ' + fallbackName);
        files.push(new File([await lwfResponse.blob()], fallbackName));

        await Promise.all((pack.files || [])
            .filter((file) => /\.(?:png|jpe?g|webp)$/i.test(file.name || ''))
            .map(async (file) => {
                try {
                    const response = await fetchWithTimeout(file.url, {
                        cache: 'no-store',
                        headers: file.url.includes('ngrok') ? { 'ngrok-skip-browser-warning': 'true' } : {}
                    });
                    if (response.ok) {
                        const rawBlob = await response.blob();
                        // The authored battle-motion loader keeps the source
                        // atlas RGBA data intact. Re-keying black pixels here
                        // breaks premultiplied aura edges and is the source of
                        // the bright/dark pulse on some characters. Keep the
                        // old matte conversion only as an explicit fallback
                        // for legacy externally supplied packs.
                        const motionBlob = useLegacyMotionMatte
                            ? await removeMotionBlackMatte(rawBlob)
                            : rawBlob;
                        files.push(new File([motionBlob], file.name, {
                            type: motionBlob.type || rawBlob.type || 'image/png'
                        }));
                    }
                } catch {}
            }));

        if (!playerModulePromise) {
            playerModulePromise = import('../js-graphics/lwf-pack.js?v=20260915-reference-loader-v47');
        }
        const { LwfPackPlayer } = await playerModulePromise;
        // Use the same shared external clock as the reference animation
        // player for every idle clip. Rich packs and simple character packs
        // both rely on it to keep nested body and aura movies synchronized.
        const playerOptions = {
            maxFps: 60,
            frameSkip: true,
            useExternalClock: true,
            preferExistingMovie: preferExistingMotionMovie,
            // The root is an attachment container for character idles. Keep
            // it frozen unless explicitly requested for runtime diagnostics;
            // the attached linkage is advanced by the shared clock below.
            freezeRootMovie: !playMotionRoot,
            // These match the reference app-sa-animation-player inputs.
            premultipliedAlpha: true,
            forceTexturePremultiply: true,
            additiveBlendScale: useNativeMotionBlend ? 1 : referenceMotionAdditiveScale,
            disableAdditiveReduction: useNativeMotionBlend,
            patchCanvasBlendModes: !useNativeMotionBlend,
            commandQueue: true,
        };
        // Render the LWF into a private canvas. The visible canvas is updated
        // only after a complete character frame is available, so an authored
        // light/clear command cannot flash the viewer black between frames.
        const renderCanvas = document.createElement('canvas');
        const player = new LwfPackPlayer(renderCanvas, () => {}, playerOptions);
        // Expose the current player for the existing motion tester/debug
        // workflow. It contains no UI and is only a reference to the active
        // viewer instance, so normal pages are unaffected.
        window.__absLastMotionPlayer = player;
        // The local Canvas patch exposes the reference blend scale through its
        // alpha hook, while native mode can still be tuned explicitly.
        if (useRichIdleComposite) {
            player.additiveAlphaScale = useNativeMotionBlend
                ? stableMotionAlphaScale
                : referenceMotionAdditiveScale;
        }
        player.loopMovie = true;
        const ingested = player.ingestFiles(files);
        if (!ingested.lwfFile) throw new Error('No LWF file in ' + fallbackName);

        const prepared = await player.prepare(ingested.lwfFile);
        if (prepared.missing?.length) {
            throw new Error('Missing idle atlas: ' + prepared.missing.join(', '));
        }

        const movies = await player.load();
        syncMotionCanvasSize(canvas, player.canvas);
        const linkageNames = (player.lwf?.data?.movieLinkages || [])
            .map((link) => player.lwf?.data?.strings?.[link?.stringId] || '')
            .filter((name) => name && name !== '_root' && !/^empty(?:_|$)/i.test(name));
        const availableMovies = [...new Set([...movies, ...linkageNames])];
        canvas.dataset.motionMovies = JSON.stringify(availableMovies);
        // Keep the authored linkage table visible to the motion tester. The
        // LWF has more record movies than it exposes as playable linkages, so
        // this helps verify which names the reference `movieName` input can
        // actually resolve.
        try {
            const strings = player.lwf?.data?.strings || [];
            const linkages = player.lwf?.data?.movieLinkages || [];
            canvas.dataset.motionLinkages = JSON.stringify(linkages.map((link) => ({
                fields: { ...link },
                stringId: link?.stringId,
                name: strings[link?.stringId] || '',
            })));
            const records = player.lwf?.data?.movies;
            if (Array.isArray(records)) {
                canvas.dataset.motionMovieRecords = JSON.stringify(records.map((record, index) => ({
                    index,
                    fields: { ...record },
                    name: strings[record?.nameId] || strings[record?.stringId] || '',
                    frames: record?.frames,
                })));
            }
        } catch {}
        const requestedClip = requestedMotionClip && availableMovies.includes(requestedMotionClip)
            ? requestedMotionClip
            : '';
        const richLayers = richIdleLayers(availableMovies);
        const composite = requestedClip || !useRichIdleComposite ? null : richLayers;
        let idleLayerPlayer = null;
        if (composite) {
            // The reference player creates one app-lightning-lwf instance per
            // effect layer. Give the idle linkage its own LWF root and
            // offscreen canvas, then composite both canvases after the shared
            // clock advances them.
            const layerCanvas = document.createElement('canvas');
            idleLayerPlayer = new LwfPackPlayer(layerCanvas, () => {}, playerOptions);
            const layerIngested = idleLayerPlayer.ingestFiles(files);
            const layerPrepared = await idleLayerPlayer.prepare(layerIngested.lwfFile);
            if (!layerIngested.lwfFile || layerPrepared.missing?.length) {
                idleLayerPlayer.clear?.();
                idleLayerPlayer = null;
            } else {
                await idleLayerPlayer.load();
            }
        }
        // Explicit clip/compositor diagnostics override the normal sequence.
        // The package was already resolved from the dedicated idle folder, so
        // a playable movie in that package is sufficient even when the older
        // linkage table does not label it with "idl".
        const clip = requestedClip
            || (useRichIdleComposite ? composite?.entry : idleClip(availableMovies))
            || idleClip(movies)
            || firstMotionMovie(movies, availableMovies);
        const sequence = requestedClip || composite ? [] : idleSequence(availableMovies);
        if (!clip) {
            player.clear?.();
            throw new Error('The idle package did not expose a playable idle clip.');
        }
        return {
            player,
            idleLayerPlayer,
            clip,
            movies: availableMovies,
            sequence,
            composite: idleLayerPlayer ? composite : null,
        };
    }

    async function updateViewerMotion(card) {
        const canvas = document.getElementById('abs-motion-canvas');
        const box = document.getElementById('abs-motion-box');
        if (!canvas || !box) return;
        initViewerHeaderAxisSync();

        const cardId = Number(card?.id || window.__absCurrentAnimationCardId || 0);
        if (!cardId) {
            activeCardId = 0;
            loadingCardId = 0;
            clearActivePlayer();
            setStatus('');
            setMotionAvailability(false, 'no-card');
            return;
        }

        // Card rendering can call this hook more than once during startup.
        // Do not restart the same idle chain and make movie 01 play twice.
        if (activePlayer && activeCardId === cardId) return;
        if (loadingCardId === cardId) return;

        loadingCardId = cardId;
        activeCardId = 0;
        const token = ++loadToken;
        clearActivePlayer();
        setMotionAvailability(false, 'loading');

        box.dataset.cardId = String(cardId);
        box.dataset.characterId = '';
        setStatus('', 'loading');

        try {
            let result = await fetchFromBridge('/api/card/' + encodeURIComponent(String(cardId)));
            let payload = await result.response.json().catch(() => ({}));
            payload = normalizeMotionPayload(payload, result.server);

            // EZA/SEZA site IDs can be represented as an 8-digit ID. If the
            // bridge only has the seven-digit base row, retry that row so the
            // character_id lookup still resolves the correct idle rig.
            if (!result.response.ok && String(cardId).length >= 8) {
                const baseId = String(cardId).slice(0, 7);
                result = await fetchFromBridge('/api/card/' + encodeURIComponent(baseId));
                payload = await result.response.json().catch(() => ({}));
                payload = normalizeMotionPayload(payload, result.server);
            }
            if (!result.response.ok || !payload.found) {
                throw new Error(payload.error || ('Character data for card ' + cardId + ' was not found.'));
            }

            const characterId = String(payload.character_id || '').padStart(5, '0');
            // The idle folder is a separate authored package. Battle assets
            // are not a valid idle fallback: when the dedicated package is
            // missing, remove the idle surface instead of showing the wrong
            // animation or an empty canvas.
            const idle = payload.idle;
            const idleFileName = 'idle_character_' + characterId + '.lwf';
            if (!characterId || !idle?.url) {
                throw new Error('No idle character package was returned for this card.');
            }

            box.dataset.characterId = characterId;
            const motionFolder = idle.rel || ('ingame/battle/character/' + characterId + '/idle');
            box.dataset.motionPath = motionFolder;
            const loaded = await loadIdlePack(idle, idleFileName, canvas);
            if (token !== loadToken) {
                loaded.player.clear?.();
                loaded.idleLayerPlayer?.clear?.();
                return;
            }

            activePlayer = loaded.player;
            const started = loaded.composite
                ? startRichIdleComposite(activePlayer, loaded.composite, loaded.idleLayerPlayer)
                : loaded.sequence?.length
                ? startIdleSequence(activePlayer, loaded.sequence)
                : startIdleMovie(activePlayer, loaded.clip, { loop: true });
            if (!started) {
                activePlayer.clear?.();
                activePlayer = null;
                throw new Error('The idle package did not expose a playable idle movie.');
            }
            if (requestedMotionFrame !== null && !loaded.composite) {
                activePlayer.fastForwardToFrame?.(requestedMotionFrame, { play: false });
                renderMotionFrame(activePlayer);
            } else if (activePlayer) {
                startMotionClock(activePlayer);
            }
            activeCardId = cardId;
            loadingCardId = 0;
            setMotionAvailability(true, 'ready');
            scheduleViewerHeaderAxisSync();
            setStatus('', 'ready');
        } catch (error) {
            if (token !== loadToken) return;
            if (loadingCardId === cardId) loadingCardId = 0;
            activeCardId = 0;
            setMotionAvailability(false, 'unavailable');
            setStatus('idle animation unavailable', 'error');
            console.warn('[viewer-motion]', error);
        }
    }

    window.updateViewerMotion = updateViewerMotion;
    const bootViewerMotion = () => {
        const card = window.__absViewerCard;
        if (card) updateViewerMotion(card);
    };
    window.addEventListener('abs-card-content-ready', bootViewerMotion);
    if (window.__absViewerCard) window.queueMicrotask?.(bootViewerMotion);
    window.stopViewerMotion = () => {
        ++loadToken;
        activeCardId = 0;
        loadingCardId = 0;
        clearActivePlayer();
        setMotionAvailability(false, 'stopped');
    };
})();
