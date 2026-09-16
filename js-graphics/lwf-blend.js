/* Canvas blend-mode support for official Dokkan LWF effects. */

const CANVAS_BLEND_MODES = Object.freeze({
    add: 'lighter',
    normal: 'source-over',
    'destination-over': 'destination-over',
    multiply: 'multiply',
    screen: 'screen',
    subtract: 'difference',
});

function runtimeNumber(name, fallback, min = -Infinity, max = Infinity) {
    const value = Number(globalThis?.[name]);
    if (!Number.isFinite(value)) return fallback;
    return Math.min(max, Math.max(min, value));
}

function additiveLumaEnabled(factory = null) {
    const value = globalThis?.LWF_FIX_ADDITIVE_LUMA_ALPHA;
    // The reference player enables its additive reduction path by default and
    // exposes disableAdditiveReduction as the opt-out. Apply that behavior to
    // additive draws only; normal character layers keep their authored RGBA.
    if (value !== undefined) return Boolean(value);
    return factory?.disableAdditiveReduction !== true;
}

function additiveAlphaFactor(alpha) {
    const value = Number(alpha);
    if (!Number.isFinite(value)) return 1;

    // DokkanDB softens only the brightest additive layers. This keeps the
    // normal character and aura motion intact while preventing full-strength
    // light plates from flashing when their authored frame changes.
    const kneeStart = runtimeNumber('LWF_ADDITIVE_SOFT_KNEE_START', 0.98, 0, 0.98);
    if (value <= kneeStart) return 1;
    const strength = runtimeNumber('LWF_ADDITIVE_SOFT_KNEE_STRENGTH', 0.9, 0, 1);
    const remaining = 1 - kneeStart;
    if (remaining <= 0) return 1 - strength;
    const progress = Math.min(1, Math.max(0, (value - kneeStart) / remaining));
    const smooth = progress * progress * (3 - (2 * progress));
    return 1 - (strength * smooth);
}

function additiveAlphaScale(factory) {
    // Keep the authored additive layer shape and timing, but use one stable
    // opacity for the aura pass. A fixed scale prevents a full-bright plate
    // from jumping to a different luminance simply because its next frame has
    // more additive pixels.
    const scoped = Number(factory?.absAdditiveAlphaScale);
    if (Number.isFinite(scoped)) return Math.min(1, Math.max(0, scoped));
    return runtimeNumber('LWF_ADDITIVE_ALPHA_SCALE', 1, 0, 1);
}

function sampleSourceRegion(image, sourceX, sourceY, sourceWidth, sourceHeight) {
    if (!image || typeof document === 'undefined') return null;
    const width = Math.max(1, Math.round(Number(sourceWidth) || 0));
    const height = Math.max(1, Math.round(Number(sourceHeight) || 0));
    if (!width || !height) return null;
    try {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) return null;
        context.clearRect(0, 0, width, height);
        context.drawImage(
            image,
            Number(sourceX) || 0,
            Number(sourceY) || 0,
            width,
            height,
            0,
            0,
            width,
            height,
        );
        const pixels = context.getImageData(0, 0, width, height).data;
        let alphaPixels = 0;
        let brightPixels = 0;
        let coloredPixels = 0;
        let maxLuma = 0;
        for (let index = 0; index < pixels.length; index += 4) {
            const alpha = pixels[index + 3];
            if (alpha > 8) alphaPixels += 1;
            const red = pixels[index];
            const green = pixels[index + 1];
            const blue = pixels[index + 2];
            const luma = Math.max(red, green, blue);
            maxLuma = Math.max(maxLuma, luma);
            if (alpha > 8 && luma >= 80) brightPixels += 1;
            if (alpha > 8 && Math.max(red, green, blue) - Math.min(red, green, blue) >= 24) {
                coloredPixels += 1;
            }
        }
        return { alphaPixels, brightPixels, coloredPixels, maxLuma };
    } catch {
        return null;
    }
}

function sampleCanvasOutput(canvas) {
    if (!canvas || typeof document === 'undefined') return null;
    try {
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context || !canvas.width || !canvas.height) return null;
        const width = Math.min(128, canvas.width);
        const height = Math.min(128, canvas.height);
        const sample = document.createElement('canvas');
        sample.width = width;
        sample.height = height;
        const sampleContext = sample.getContext('2d', { willReadFrequently: true });
        if (!sampleContext) return null;
        sampleContext.clearRect(0, 0, width, height);
        sampleContext.drawImage(canvas, 0, 0, width, height);
        const pixels = sampleContext.getImageData(0, 0, width, height).data;
        let alphaPixels = 0;
        let brightPixels = 0;
        let coloredPixels = 0;
        let maxLuma = 0;
        for (let index = 0; index < pixels.length; index += 4) {
            const alpha = pixels[index + 3];
            if (alpha > 8) alphaPixels += 1;
            const red = pixels[index];
            const green = pixels[index + 1];
            const blue = pixels[index + 2];
            const luma = Math.max(red, green, blue);
            maxLuma = Math.max(maxLuma, luma);
            if (alpha > 8 && luma >= 80) brightPixels += 1;
            if (alpha > 8 && luma - Math.min(red, green, blue) >= 24) coloredPixels += 1;
        }
        return { alphaPixels, brightPixels, coloredPixels, maxLuma };
    } catch {
        return null;
    }
}

function recordBlendCommand(factory, command) {
    if (globalThis?.LWF_BLEND_DEBUG !== true || !factory || !command) return;
    const stats = factory.__absBlendStats || {
        calls: 0,
        modes: {},
        additive: 0,
        reduced: 0,
        samples: [],
    };
    stats.calls += 1;
    stats.normalOverride = String(globalThis?.LWF_NORMAL_BLEND_OVERRIDE || '');
    const mode = String(command.blendMode || '');
    stats.modes[mode] = (stats.modes[mode] || 0) + 1;
    if (mode === 'add') stats.additive += 1;
    if (stats.samples.length < 64) {
        const sourceImage = command.z$Ha || command.image;
        const sample = {
            mode,
            zMode: command.z$s,
            depth: command.z$M,
            generation: command.z$aa,
            maskMode: command.maskMode,
            alpha: command.alpha,
            imageWidth: command.z$Ha?.width || command.image?.width || 0,
            imageHeight: command.z$Ha?.height || command.image?.height || 0,
            sourceWidth: command.z$q,
            sourceHeight: command.z$k,
            sourceX: command.z$R,
            sourceY: command.z$S,
            sourcePixels: sampleSourceRegion(
                sourceImage,
                command.z$R ?? command.u,
                command.z$S ?? command.v,
                command.z$q ?? command.w,
                command.z$k ?? command.h,
            ),
            matrix: command.z$c ? {
                scaleX: command.z$c.scaleX,
                scaleY: command.z$c.scaleY,
                skew0: command.z$c.skew0,
                skew1: command.z$c.skew1,
                translateX: command.z$c.translateX,
                translateY: command.z$c.translateY,
            } : null,
            rendererStateBefore: {
                blendCache: factory.z$gd,
                maskMode: factory.z$ba,
                hasMask: factory.z$Ca,
            },
        };
        stats.samples.push(sample);
        factory.__absLastBlendSample = sample;
    }
    factory.__absBlendStats = stats;
}

function additiveLumaImage(factory, image, sourceX, sourceY, sourceWidth, sourceHeight) {
    if (!additiveLumaEnabled(factory) || !image || typeof document === 'undefined') return null;
    if (typeof image !== 'object') return null;

    const width = Math.max(1, Math.round(Number(sourceWidth) || 0));
    const height = Math.max(1, Math.round(Number(sourceHeight) || 0));
    if (!width || !height) return null;

    const threshold = runtimeNumber('LWF_FIX_ADDITIVE_BLACK_THRESHOLD', 40, 0, 255);
    const minimumBlackRatio = runtimeNumber('LWF_FIX_ADDITIVE_MIN_BLACK_RATIO', 0.05, 0, 1);
    const key = [
        Math.round(Number(sourceX) || 0),
        Math.round(Number(sourceY) || 0),
        width,
        height,
        threshold,
        minimumBlackRatio,
    ].join('|');

    let imageCache = factory.__absAdditiveLumaCache;
    if (!imageCache) {
        imageCache = new WeakMap();
        factory.__absAdditiveLumaCache = imageCache;
    }
    let cropCache = imageCache.get(image);
    if (!cropCache) {
        cropCache = new Map();
        imageCache.set(image, cropCache);
    }
    if (cropCache.has(key)) {
        const cached = cropCache.get(key);
        return cached === false ? null : cached;
    }

    const output = document.createElement('canvas');
    output.width = width;
    output.height = height;
    const context = output.getContext('2d', { willReadFrequently: true });
    if (!context) {
        cropCache.set(key, false);
        return null;
    }

    try {
        context.clearRect(0, 0, width, height);
        context.drawImage(
            image,
            Number(sourceX) || 0,
            Number(sourceY) || 0,
            Number(sourceWidth) || width,
            Number(sourceHeight) || height,
            0,
            0,
            width,
            height,
        );
        const imageData = context.getImageData(0, 0, width, height);
        const pixels = imageData.data;
        let blackPixels = 0;
        const totalPixels = width * height;

        for (let index = 0; index < pixels.length; index += 4) {
            const red = pixels[index];
            const green = pixels[index + 1];
            const blue = pixels[index + 2];
            if (pixels[index + 3] > 0 && red <= threshold && green <= threshold && blue <= threshold) {
                blackPixels += 1;
            }
        }

        // Only treat a sheet as an additive light plate when it really has a
        // dark matte. Small black details in ordinary character art should not
        // be converted to alpha.
        if (minimumBlackRatio > 0 && blackPixels / totalPixels < minimumBlackRatio) {
            cropCache.set(key, false);
            return null;
        }

        for (let index = 0; index < pixels.length; index += 4) {
            const red = pixels[index];
            const green = pixels[index + 1];
            const blue = pixels[index + 2];
            const luma = Math.max(red, green, blue);
            const originalAlpha = pixels[index + 3];
            if (luma <= threshold) {
                pixels[index + 3] = 0;
                continue;
            }
            const normalized = Math.min(1, Math.max(0, (luma - threshold) / (255 - threshold)));
            const lumaAlpha = Math.round(Math.pow(normalized, 0.35) * 255);
            pixels[index + 3] = Math.min(originalAlpha, lumaAlpha);
        }

        context.putImageData(imageData, 0, 0);
        cropCache.set(key, output);
        return output;
    } catch {
        cropCache.set(key, false);
        return null;
    }
}

function patchAdditiveRenderer(factoryPrototype) {
    if (!factoryPrototype) return false;

    // The stock CanvasRendererFactory inherits its bitmap draw routine from a
    // shared renderer prototype. Looking only at own properties misses that
    // method, leaving additive aura plates on the uncorrected `lighter` path.
    let owner = factoryPrototype;
    let renderName = '';
    while (owner && owner !== Object.prototype && !renderName) {
        if (owner.__absAdditiveLumaPatched) return true;
        renderName = Object.getOwnPropertyNames(owner).find((name) => {
            const candidate = owner[name];
            if (typeof candidate !== 'function') return false;
            try {
                const source = Function.prototype.toString.call(candidate);
                return source.includes('drawImage')
                    && source.includes('blendMode')
                    && (source.includes('globalAlpha') || source.includes('z$Ha'));
            } catch {
                return false;
            }
        }) || '';
        if (!renderName) owner = Object.getPrototypeOf(owner);
    }
    if (!owner || !renderName) return false;

    const original = owner[renderName];
    owner[renderName] = function renderWithAdditiveLumaReduction(context, command) {
        recordBlendCommand(this, command);
        const blendMode = command?.blendMode;
        const normalOverride = globalThis?.LWF_NORMAL_BLEND_OVERRIDE;
        const sourceImage = command?.z$Ha || command?.image;
        const skipDarkAtlas = globalThis?.LWF_SKIP_DARK_ATLAS === true
            && blendMode === 'normal'
            && (
                Number(sourceImage?.width || 0) >= 2048
                    && Number(sourceImage?.height || 0) >= 2048
                    && Number(command?.z$R ?? command?.u) >= 1500
                || Number(sourceImage?.width || 0) === 1024
                    && Number(sourceImage?.height || 0) === 2048
                    && Number(command?.z$R ?? command?.u) >= 500
            );
        const darkAtlas = blendMode === 'normal'
            && (
                Number(sourceImage?.width || 0) >= 2048
                    && Number(sourceImage?.height || 0) >= 2048
                    && Number(command?.z$R ?? command?.u) >= 1500
                || Number(sourceImage?.width || 0) === 1024
                    && Number(sourceImage?.height || 0) === 2048
                    && Number(command?.z$R ?? command?.u) >= 500
            );
        const darkOverride = globalThis?.LWF_DARK_BLEND_OVERRIDE;
        const reduceLuma = additiveLumaEnabled(this);
        const alphaScale = additiveAlphaScale(this);
        const shouldProcessAdditive = blendMode === 'add'
            && sourceImage
            && command?.pattern == null
            && (reduceLuma || alphaScale < 0.999);

        const sourceX = command.z$R ?? command.u;
        const sourceY = command.z$S ?? command.v;
        const sourceWidth = command.z$q ?? command.w;
        const sourceHeight = command.z$k ?? command.h;
        const processedImage = shouldProcessAdditive && reduceLuma
            ? additiveLumaImage(
                this,
                sourceImage,
                sourceX,
                sourceY,
                sourceWidth,
                sourceHeight,
            )
            : null;
        const originalAlpha = command.alpha;
        const originalImage = command.z$Ha;
        const originalU = command.u;
        const originalV = command.v;
        const originalW = command.w;
        const originalH = command.h;
        const originalSourceX = command.z$R;
        const originalSourceY = command.z$S;
        const originalSourceWidth = command.z$q;
        const originalSourceHeight = command.z$k;
        const selectedOverride = darkAtlas && typeof darkOverride === 'string'
            ? darkOverride
            : normalOverride;
        const overriddenBlendMode = blendMode === 'normal'
            && typeof selectedOverride === 'string'
            && ['normal', 'add', 'source-over', 'lighter', 'screen', 'multiply', 'difference', 'destination-over'].includes(selectedOverride)
            ? selectedOverride === 'source-over' ? 'normal' : selectedOverride
            : blendMode;

        if (processedImage) {
            if (globalThis?.LWF_BLEND_DEBUG === true) {
                this.__absBlendStats.reduced += 1;
            }
            if ('z$Ha' in command) command.z$Ha = processedImage;
            if ('u' in command) command.u = 0;
            if ('v' in command) command.v = 0;
            if ('w' in command) command.w = processedImage.width;
            if ('h' in command) command.h = processedImage.height;
            if ('z$R' in command) command.z$R = 0;
            if ('z$S' in command) command.z$S = 0;
            if ('z$q' in command) command.z$q = processedImage.width;
            if ('z$k' in command) command.z$k = processedImage.height;
        }
        if (shouldProcessAdditive && Number.isFinite(Number(originalAlpha))) {
            const lumaScale = reduceLuma ? additiveAlphaFactor(originalAlpha) : 1;
            command.alpha = Number(originalAlpha) * alphaScale * lumaScale;
        }

        try {
            if (skipDarkAtlas) command.alpha = 0;
            if (overriddenBlendMode !== blendMode) command.blendMode = overriddenBlendMode;
            if (globalThis?.LWF_BLEND_DEBUG === true && this.__absLastBlendSample) {
                this.__absLastBlendSample.effectiveMode = command.blendMode;
                this.__absLastBlendSample.contextCompositeBefore = context?.globalCompositeOperation || '';
            }
            const result = original.call(this, context, command);
            if (globalThis?.LWF_BLEND_DEBUG === true && this.__absLastBlendSample) {
                this.__absLastBlendSample.postPixels = sampleCanvasOutput(this.stage);
                this.__absLastBlendSample.contextCompositeAfter = context?.globalCompositeOperation || '';
                this.__absLastBlendSample.rendererStateAfter = {
                    blendCache: this.z$gd,
                    maskMode: this.z$ba,
                    hasMask: this.z$Ca,
                };
            }
            return result;
        } finally {
            if ('z$Ha' in command) command.z$Ha = originalImage;
            if ('u' in command) command.u = originalU;
            if ('v' in command) command.v = originalV;
            if ('w' in command) command.w = originalW;
            if ('h' in command) command.h = originalH;
            if ('z$R' in command) command.z$R = originalSourceX;
            if ('z$S' in command) command.z$S = originalSourceY;
            if ('z$q' in command) command.z$q = originalSourceWidth;
            if ('z$k' in command) command.z$k = originalSourceHeight;
            command.alpha = originalAlpha;
            command.blendMode = blendMode;
        }
    };
    Object.defineProperty(owner, '__absAdditiveLumaPatched', {
        value: true,
        configurable: true,
    });
    return true;
}

function isLwfCompositeSetter(candidate) {
    if (typeof candidate !== 'function') return false;
    try {
        const source = Function.prototype.toString.call(candidate);
        return source.includes('globalCompositeOperation')
            && (source.includes('lighter') || source.includes('source-over'))
            && !source.includes('destination-in');
    } catch {
        return false;
    }
}

function patchRendererFactory(factoryPrototype) {
    if (!factoryPrototype || factoryPrototype.__absCanvasBlendPatched) return Boolean(factoryPrototype);
    const setterName = Object.getOwnPropertyNames(factoryPrototype).find((name) =>
        isLwfCompositeSetter(factoryPrototype[name]),
    );
    if (!setterName) return false;

    const original = factoryPrototype[setterName];
    let cachedModeField = 'renderBlendMode';
    try {
        const source = Function.prototype.toString.call(original);
        const field = source.match(/this\.(\w+)\s*!==\s*\w+/)?.[1]
            || source.match(/this\.(\w+)\s*=\s*\w+/)?.[1];
        if (field) cachedModeField = field;
    } catch {}

    factoryPrototype[setterName] = function setDokkanCanvasBlendMode(context, blendMode) {
        if (!context || this[cachedModeField] === blendMode) return;
        this[cachedModeField] = blendMode;
        const override = globalThis?.LWF_NORMAL_BLEND_OVERRIDE;
        const cssMode = blendMode === 'normal'
            && typeof override === 'string'
            && ['source-over', 'lighter', 'screen', 'multiply', 'difference', 'destination-over'].includes(override)
            ? override
            : CANVAS_BLEND_MODES[blendMode];
        context.globalCompositeOperation = cssMode || 'source-over';
    };
    factoryPrototype.__absCanvasBlendPatched = true;
    return true;
}

function patchCanvasCommandQueue(factoryPrototype) {
    if (!factoryPrototype || factoryPrototype.__absCanvasCommandQueuePatched) {
        return Boolean(factoryPrototype?.__absCanvasCommandQueuePatched);
    }
    if (typeof factoryPrototype.z$nb !== 'function' || typeof factoryPrototype.z$qf !== 'function') {
        return false;
    }

    const addCommand = factoryPrototype.z$nb;
    const endRender = factoryPrototype.z$qf;

    // The older Canvas renderer keeps one command per depth in z$8a. The
    // current DokkanDB renderer keeps an append-only list for each render.
    // Preserve every command until the frame is consumed, then feed a dense
    // normalized snapshot to the stock compositor. This is opt-in because
    // masks/layers in older non-motion effects should retain their legacy
    // behavior until they are explicitly migrated.
    factoryPrototype.z$nb = function queueCanvasCommand(index, command) {
        if (this.absCommandQueue && command) {
            const renderId = Number(this.lwf?.z$aa);
            if (!this.__absCanvasCommandQueue
                || this.__absCanvasCommandQueue.renderId !== renderId) {
                this.__absCanvasCommandQueue = { renderId, entries: [] };
            }
            this.__absCanvasCommandQueue.entries.push({ index, command });
        }
        return addCommand.call(this, index, command);
    };

    factoryPrototype.z$qf = function consumeCanvasCommandQueue(lwf) {
        if (!this.absCommandQueue || lwf?.parent != null) {
            return endRender.call(this, lwf);
        }

        const queue = this.__absCanvasCommandQueue;
        const renderId = Number(lwf?.z$aa);
        if (!queue || queue.renderId !== renderId || !queue.entries.length) {
            return endRender.call(this, lwf);
        }

        const snapshot = [];
        for (const entry of queue.entries) {
            const command = entry.command;
            let depth = Number(entry.index);
            if (!Number.isFinite(depth)) depth = Number(command?.z$M);
            // A false value is how the old runtime represents its first
            // rendering slot in a few bitmap paths. It is still depth zero;
            // leaving it boolean makes the stock `=== 0` check discard it.
            if (!Number.isFinite(depth)) depth = entry.index === false ? 0 : 0;
            depth = Math.max(0, Math.floor(depth));
            const normalized = { ...command, z$M: depth, z$aa: renderId };
            snapshot[depth] = normalized;
        }

        const previousCommands = this.z$8a;
        const previousCount = this.z$9i;
        this.z$8a = snapshot;
        this.z$9i = queue.entries.length;
        try {
            return endRender.call(this, lwf);
        } finally {
            this.__absCanvasCommandQueue = null;
            // The stock endRender normally clears these fields through z$sc.
            // Restore only if a future runtime exits before doing so.
            if (this.z$8a == null) this.z$8a = previousCommands;
            if (this.z$9i == null) this.z$9i = previousCount;
        }
    };

    Object.defineProperty(factoryPrototype, '__absCanvasCommandQueuePatched', {
        value: true,
        configurable: true,
    });
    return true;
}

// The stock browser LWF renderer only maps part of Dokkan's blend-mode list.
// Missing mappings make glow/gradient plates look like opaque rectangles.
export function ensureLwfCanvasBlendModes() {
    try {
        const LWF = globalThis.LWF;
        if (!LWF) return false;
        try { LWF.useCanvasRenderer?.(); } catch {}

        let patched = patchRendererFactory(LWF.CanvasRendererFactory?.prototype);
        patched = patchAdditiveRenderer(LWF.CanvasRendererFactory?.prototype) || patched;
        patched = patchCanvasCommandQueue(LWF.CanvasRendererFactory?.prototype) || patched;
        const caches = [LWF.ResourceCache?.get?.()];
        try { caches.push(new LWF.ResourceCache()); } catch {}
        for (const cache of caches) {
            const factoryPrototype = Object.getPrototypeOf(cache?.rendererFactory);
            patched = patchRendererFactory(factoryPrototype) || patched;
            patched = patchAdditiveRenderer(factoryPrototype) || patched;
            patched = patchCanvasCommandQueue(factoryPrototype) || patched;
        }
        return patched;
    } catch {
        return false;
    }
}
