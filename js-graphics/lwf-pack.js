import { ensureLwfCanvasBlendModes } from './lwf-blend.js?v=20260915-additive-reduction-v19';

const TEX_RE = /[\w./\\-]+\.(?:png|jpe?g|webp|gif)/gi;

export function readLwfHeader(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (u8.length < 16 || String.fromCharCode(u8[0], u8[1], u8[2]) !== 'LWF') {
    throw new Error('Not an LWF file (missing LWF magic)');
  }
  const view = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  return {
    width: view.getUint32(8, true),
    height: view.getUint32(12, true),
    frameRate: u8.length >= 20 ? view.getUint32(16, true) : 30,
  };
}

function scrapePngNames(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let ascii = '';
  for (let i = 0; i < u8.length; i++) {
    const c = u8[i];
    ascii += c >= 0x20 && c <= 0x7e ? String.fromCharCode(c) : '\0';
  }
  const found = ascii.match(TEX_RE) || [];
  const names = [];
  const seen = new Set();
  for (const raw of found) {
    let key = raw.replace(/\\/g, '/');
    while (key.startsWith('./')) key = key.slice(2);
    const base = key.split('/').pop();
    if (!base || seen.has(base.toLowerCase())) continue;
    if (/^(http|https|data):/i.test(key)) continue;
    seen.add(base.toLowerCase());
    names.push(base);
  }
  return names;
}

export function isLibraryTextureName(name) {
  return /^Images_/i.test(String(name || ''));
}

export function looksLikeAtlasSheetName(name) {
  const base = String(name || '')
    .replace(/\.[^.]+$/, '')
    .replace(/\\/g, '/')
    .split('/')
    .pop();
  if (!base) return false;
  if (/^lwf_image\d+$/i.test(base)) return true;
  if (/^card_\d+_\d+$/i.test(base)) return true;
  if (/^sp_effect_/i.test(base) && /_\d+$/.test(base)) return true;
  if (/_\d+$/.test(base)) {
    const stem = base.replace(/_\d+$/, '');
    if (/\d{3,}/.test(stem)) return true;
  }
  return false;
}

export function looksLikeFragmentSplitName(name) {
  if (looksLikeAtlasSheetName(name)) return false;
  const base = String(name || '')
    .replace(/\.[^.]+$/, '')
    .replace(/\\/g, '/')
    .split('/')
    .pop();
  if (!base) return false;
  const parts = base.split('_');
  if (parts.length < 4) return false;
  const middle = parts.slice(1, -1);
  return middle.some(
    (p) => /[a-z]/i.test(p) && !/^\d+$/.test(p) && !/^image\d*$/i.test(p),
  );
}

export function extractSheetNames(bytes) {
  const fromTable = parseLwfTextures(bytes)
    .map((t) => t.filename)
    .filter(Boolean);
  if (fromTable.length) {
    const seen = new Set();
    const out = [];
    for (const n of fromTable) {
      const k = n.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(n);
    }
    if (out.length) return out;
  }

  const names = scrapePngNames(bytes);
  const lwfImages = names
    .filter((n) => /^lwf_image\d+\./i.test(n))
    .sort((a, b) => {
      const na = Number((a.match(/\d+/) || [0])[0]);
      const nb = Number((b.match(/\d+/) || [0])[0]);
      return na - nb;
    });
  if (lwfImages.length) return lwfImages;

  const sheets = names
    .filter((n) => !isLibraryTextureName(n))
    .filter((n) => !looksLikeFragmentSplitName(n))
    .filter(
      (n) =>
        /^card_\d+_\d+\./i.test(n) ||
        /_\d+\.(?:png|jpe?g|webp|gif)$/i.test(n) ||
        /^lwf_/i.test(n),
    )
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return sheets;
}

export function sheetsFromLwf(lwf) {
  const list = lwf?.data?.textures;
  if (!Array.isArray(list)) return [];
  const out = [];
  const seen = new Set();
  for (const tex of list) {
    const fn = String(tex?.filename || '')
      .replace(/\\/g, '/')
      .split('/')
      .pop();
    if (!fn || seen.has(fn.toLowerCase())) continue;
    if (isLibraryTextureName(fn)) continue;
    seen.add(fn.toLowerCase());
    out.push(fn);
  }
  return out;
}

export function isPlayableMovieName(name) {
  if (typeof name !== 'string' || !name || name === '_root') return false;
  if (/^symbol_/i.test(name)) return false;
  if (/_empty/i.test(name)) return false;
  return true;
}

export function extractSceneNames(lwf) {
  if (!lwf?.data?.movieLinkages || !lwf?.data?.strings) return [];
  return lwf.data.movieLinkages
    .map((link) => lwf.data.strings[link.stringId])
    .filter(isPlayableMovieName);
}

function coerceFrameCount(v) {
  if (typeof v === 'number' && Number.isFinite(v) && v > 0) return Math.floor(v);
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function maxNestedMovieFrames(movie, depth = 0, seen = null) {
  if (!movie || depth > 32) return 0;
  const bag = seen || new Set();
  if (bag.has(movie)) return 0;
  bag.add(movie);
  let max = Math.max(
    coerceFrameCount(movie.totalFrames),
    coerceFrameCount(movie.data?.frames),
  );

  for (let h = movie.z$ja; h; h = h.z$sa) {
    if (h.isMovie || h.totalFrames != null || h.data?.frames != null) {
      max = Math.max(max, maxNestedMovieFrames(h, depth + 1, bag));
    }
  }
  const depthList = movie.z$2;
  if (Array.isArray(depthList)) {
    for (const h of depthList) {
      if (h && (h.isMovie || h.totalFrames != null || h.data?.frames != null)) {
        max = Math.max(max, maxNestedMovieFrames(h, depth + 1, bag));
      }
    }
  }
  return max;
}

// LWF scenes often split one visible timeline across a short parent and one
// or more longer child movies. Seeking only the parent makes those children
// restart out of phase, so bounded loops seek every live movie to the matching
// logical frame in its own timeline.
function seekMovieTree(movie, logicalFrame, play = true, depth = 0, seen = null) {
  if (!movie || depth > 32) return;
  const bag = seen || new Set();
  if (bag.has(movie)) return;
  bag.add(movie);

  const total = Math.max(
    coerceFrameCount(movie.totalFrames),
    coerceFrameCount(movie.data?.frames),
  );
  if (total > 0) {
    const target = ((Math.max(1, Math.floor(logicalFrame)) - 1) % total) + 1;
    if (play) movie.gotoAndPlay?.(target);
    else movie.gotoAndStop?.(target);
    movie.playing = play;
    movie.active = true;
  }

  const children = [];
  for (let child = movie.z$ja; child; child = child.z$sa) children.push(child);
  if (Array.isArray(movie.z$2)) children.push(...movie.z$2);
  children.forEach((child) => {
    if (child && (child.isMovie || child.totalFrames != null || child.data?.frames != null)) {
      seekMovieTree(child, logicalFrame, play, depth + 1, bag);
    }
  });
}

// An attached LWF scene is often only a short container whose visible art
// continues in child movies. Most previews wait for those children. Callers
// such as the standalone KO viewer can opt out when ambient child loops would
// otherwise prevent a non-looping root scene from ever reaching its final hold.
function hasUnfinishedNestedMovie(movie, depth = 0, seen = null) {
  if (!movie || depth > 32) return false;
  const bag = seen || new Set();
  if (bag.has(movie)) return false;
  bag.add(movie);

  const children = [];
  for (let child = movie.z$ja; child; child = child.z$sa) children.push(child);
  if (Array.isArray(movie.z$2)) children.push(...movie.z$2);

  for (const child of children) {
    if (!child || bag.has(child)) continue;
    const isMovie = child.isMovie || child.totalFrames != null || child.data?.frames != null;
    if (isMovie) {
      const total = Math.max(coerceFrameCount(child.totalFrames), coerceFrameCount(child.data?.frames));
      const current = Math.max(0, Number(child.currentFrame) || 0);
      // A child which is still playing may contain its own authored loop. In
      // that case leave it alone indefinitely; that loop is more accurate than
      // seeking its parent to an arbitrary frame.
      if (total > 1 && child.playing !== false && current < total - 1) return true;
      if (hasUnfinishedNestedMovie(child, depth + 1, bag)) return true;
    }
  }
  return false;
}

// Downsample a rendered LWF canvas to a tiny RGBA signature. This lets the
// standalone KO viewer distinguish a real looping clip from a transition that
// reaches a held final frame without reading millions of pixels every tick.
function sampleCanvasSignature(canvas, sampleCanvas = null) {
  if (!canvas || typeof document === 'undefined') return null;
  const size = 16;
  const target = sampleCanvas || document.createElement('canvas');
  if (target.width !== size) target.width = size;
  if (target.height !== size) target.height = size;
  const ctx = target.getContext?.('2d', { willReadFrequently: true });
  if (!ctx) return null;
  try {
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(canvas, 0, 0, size, size);
    return ctx.getImageData(0, 0, size, size).data;
  } catch {
    return null;
  }
}

function canvasSignatureDifference(previous, next) {
  if (!previous || !next || previous.length !== next.length) return Infinity;
  let total = 0;
  for (let i = 0; i < next.length; i++) total += Math.abs(next[i] - previous[i]);
  return total / Math.max(1, next.length);
}

export function centerMovie(lwf, movie) {
  if (!lwf || !movie) return;
  if (movie.x === 0 && movie.y === 0 && lwf.width && lwf.height) {
    const cx = (lwf.width || 0) / 2;
    const cy = (lwf.height || 0) / 2;
    if (cx > 0 && cy > 0) {
      movie.x = cx;
      movie.y = cy;
    }
  }
}

export function fitNative(lwf, canvas) {
  const w = Math.max(1, Math.round(lwf.width || 426));
  const h = Math.max(1, Math.round(lwf.height || 568));
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;

  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.maxWidth = '100%';
  canvas.style.maxHeight = '100%';
  if (lwf.stage) {
    lwf.stage.width = w;
    lwf.stage.height = h;
  }
  const prop = lwf.property;
  if (prop) {
    if (typeof prop.scaleTo === 'function') prop.scaleTo(1, 1);
    else {
      prop.scaleX = 1;
      prop.scaleY = 1;
    }
    if (typeof prop.moveTo === 'function') prop.moveTo(0, 0);
    else {
      prop.x = 0;
      prop.y = 0;
    }
  }
  return { w, h };
}

export function parseLwfTextures(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (u8.length < 324 || String.fromCharCode(u8[0], u8[1], u8[2]) !== 'LWF') {
    return [];
  }
  const view = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const formatVersion = (u8[4] << 16) | (u8[5] << 8) | u8[6];

  const hasMcb = formatVersion >= 0x141211;
  const nItems = hasMcb ? 37 : 36;
  const itemBase = 32;
  const item = (i) => ({
    offset: view.getInt32(itemBase + i * 8, true),
    length: view.getInt32(itemBase + i * 8 + 4, true),
  });
  const stringBytes = item(0);
  const texture = item(8);
  const stringData = item(nItems - 1);
  if (
    texture.length < 1 ||
    texture.offset < 0 ||
    stringBytes.offset < 0 ||
    stringData.offset < 0
  ) {
    return [];
  }
  const stringBlob = u8.subarray(
    stringBytes.offset,
    stringBytes.offset + stringBytes.length,
  );
  const strings = [];
  for (let i = 0; i < stringData.length; i++) {
    const soff = view.getInt32(stringData.offset + i * 8, true);
    const slen = view.getInt32(stringData.offset + i * 8 + 4, true);
    let s = '';
    for (let j = 0; j < slen; j++) s += String.fromCharCode(stringBlob[soff + j] || 0);
    strings.push(s);
  }
  const out = [];
  for (let i = 0; i < texture.length; i++) {
    const base = texture.offset + i * 20;
    const stringId = view.getInt32(base, true);
    const width = view.getInt32(base + 8, true);
    const height = view.getInt32(base + 12, true);
    const scale = view.getFloat32(base + 16, true);
    const filename = String(strings[stringId] || '')
      .replace(/\\/g, '/')
      .split('/')
      .pop();
    if (!filename || isLibraryTextureName(filename)) continue;
    out.push({ filename, width, height, scale });
  }
  return out;
}

export async function fitSheetBlobToTextureSize(sourceUrl, wantW, wantH) {
  const w = Math.max(1, wantW | 0);
  const h = Math.max(1, wantH | 0);
  const img = await new Promise((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () =>
      reject(new Error(`failed to decode sheet for fit ${w}x${h}`));
    el.src = sourceUrl;
  });
  const sw = img.naturalWidth;
  const sh = img.naturalHeight;
  if (sw === w && sh === h) {
    return { url: sourceUrl, fitted: false, mode: 'match', fromW: sw, fromH: sh };
  }
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  let mode = 'stretch';
  if (sw === h && sh === w && w !== h) {
    mode = 'rotate90';
    ctx.translate(w / 2, h / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.drawImage(img, -sw / 2, -sh / 2);
  } else {
    ctx.drawImage(img, 0, 0, w, h);
  }
  const blob = await new Promise((resolve) => c.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('canvas.toBlob failed while fitting atlas');
  return {
    url: URL.createObjectURL(blob),
    fitted: true,
    mode,
    fromW: sw,
    fromH: sh,
  };
}

function revokeMap(map) {
  for (const url of map.values()) {
    try {
      URL.revokeObjectURL(url);
    } catch {}
  }
  map.clear();
}

function providedImageNames(filesByName) {
  return [...filesByName.keys()]
    .filter((k) => /\.(png|jpe?g|webp|gif)$/i.test(k))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

// ActionBank scripts frequently open several scenes from the same LWF pack at
// once (a character plate, background plate, and foreground effects). Keeping
// a prepared URL/atlas set per logical pack prevents every scene from decoding
// dozens of identical 1024px sheets again. Different texture-injection variants
// receive different resource keys from the caller, so cut-ins remain isolated.
const sharedPreparedPacks = new Map();

export class LwfPackPlayer {
  constructor(canvas, log = () => {}, options = {}) {
    this.canvas = canvas;
    this.log = log;
    this.resourceKey = String(options?.resourceKey || '');
    this.blobUrls = new Map();
    this.filesByName = new Map();
    this.lwf = null;
    this.movie = null;
    this.clip = null;
    this.movies = [];
    this.requiredTextures = [];
    this.libraryLabels = [];
    this.header = null;
    this.lwfName = '';
    this.textureMeta = [];
    this._lwfBytes = null;
    this._atlasFits = 0;
    this.playing = false;
    this.loopMovie = true;
    // Optional per-player opacity for additive decorative layers. The normal
    // LWF path stays at 1; the viewer motion player opts into a darker aura.
    this.additiveAlphaScale = 1;
    // Idle viewer scenes should wrap through the authored movie timeline as a
    // unit. Recursive child seeking is still useful for bounded effect clips,
    // but it can expose a one-frame child reset on character idle loops.
    this.seamlessLoop = false;
    this.loopStartFrame = 0;
    this.loopEndFrame = 0;
    this.loopTailFrames = 0;
    this.freezeOnStaticTail = false;
    this.staticTailMinFrames = 18;
    this.staticTailDifferenceThreshold = 2.5;
    this._sampleCanvas = null;
    this._lastVisualSignature = null;
    this._lastVisualFrame = 0;
    this._staticTailFrames = 0;
    this._sawVisualMotion = false;
    this._frozenAtEnd = false;
    this.playbackRate = 1;
    // Match the battle-motion player clock: advance authored LWF timelines from
    // a bounded external 60 FPS clock, then render at that cadence. The LWF
    // runtime still performs its own frame skipping against the authored FPS.
    this.maxFps = Math.max(1, Number(options?.maxFps) || 60);
    this.maxDt = 0.25;
    this.maxSubSteps = 6;
    this.maxAccumulatedTime = 0.1;
    this._accumulator = 0;
    // The reference battle-motion player owns one rAF clock for all of its
    // LWF layers and calls advance()/renderFrame() on each child. Keep that
    // mode opt-in so the existing standalone previews remain self-running.
    this.useExternalClock = options?.useExternalClock === true;
    this.preferExistingMovie = options?.preferExistingMovie === true;
    // Character idle linkages are attached to a one-frame root scene. Keep
    // that root paused before attachment so its setup pass cannot clear the
    // newly attached character body.
    this.freezeRootMovie = options?.freezeRootMovie === true;
    this.frameSkip = options?.frameSkip !== false;
    this.premultipliedAlpha = options?.premultipliedAlpha !== false;
    this.forceTexturePremultiply = options?.forceTexturePremultiply !== false;
    this.additiveBlendScale = Number.isFinite(Number(options?.additiveBlendScale))
      ? Math.max(0, Number(options.additiveBlendScale))
      : 1;
    this.disableAdditiveReduction = options?.disableAdditiveReduction === true;
    this.patchCanvasBlendModes = options?.patchCanvasBlendModes !== false;
    this.commandQueue = options?.commandQueue === true;
    // Composite battle-motion timelines may keep a short entry linkage alive
    // while a second linkage becomes visible. In that mode the primary movie
    // is not the lifetime of the player, so do not let its local end stop the
    // shared clock.
    this.ignoreMovieEnd = options?.ignoreMovieEnd === true;
    this._logicalFrame = 1;
    this.waitForNestedMoviesAtEnd = true;
    this.autoProgress = false;
    this._raf = null;
    this._lastTs = null;
    this._lastError = '';
    this._attachName = 'mc_preview';
    this._advancing = false;
    this._requested = new Set();
    this._misses = new Set();
    this.onMovieChange = null;
    this.onEnded = null;
    this.onFrame = null;
  }

  clear() {
    this.pause();
    try {
      this.lwf?.destroy?.();
    } catch {}
    this.lwf = null;
    this.movie = null;
    this.clip = null;
    this.movies = [];
    this.requiredTextures = [];
    this.libraryLabels = [];
    this.header = null;
    this.lwfName = '';
    this.textureMeta = [];
    this.ignoreMovieEnd = false;
    this._lwfBytes = null;
    this._atlasFits = 0;
    this._requested.clear();
    this._misses.clear();
    this._logicalFrame = 1;
    this._lastVisualSignature = null;
    this._lastVisualFrame = 0;
    this._staticTailFrames = 0;
    this._sawVisualMotion = false;
    this._frozenAtEnd = false;
    this._accumulator = 0;
    if (!this.resourceKey) revokeMap(this.blobUrls);
    else this.blobUrls.clear();
    this.filesByName.clear();
    const ctx = this.canvas.getContext('2d');
    ctx?.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  ingestFiles(files) {
    this.clear();
    const list = [...files].filter(Boolean);
    for (const f of list) {
      const base = (f.name || '').split(/[/\\]/).pop();
      if (!base) continue;
      this.filesByName.set(base.toLowerCase(), f);
      const rel = f.webkitRelativePath || '';
      if (rel) {
        const leaf = rel.split('/').pop();
        if (leaf) this.filesByName.set(leaf.toLowerCase(), f);
      }
    }

    const lwfFile =
      list.find((f) => /\.lwf$/i.test(f.name)) ||
      [...this.filesByName.values()].find((f) => /\.lwf$/i.test(f.name)) ||
      null;

    if (!lwfFile) {
      return { ok: false, missing: ['*.lwf'], present: [], lwfFile: null };
    }

    this.lwfName = lwfFile.name;
    return {
      ok: true,
      missing: [],
      present: providedImageNames(this.filesByName),
      lwfFile,
    };
  }

  async prepare(lwfFile) {
    const bytes = new Uint8Array(await lwfFile.arrayBuffer());
    this._lwfBytes = bytes;
    this.header = readLwfHeader(bytes);

    const shared = this.resourceKey ? sharedPreparedPacks.get(this.resourceKey) : null;
    if (shared) {
      this.header = { ...shared.header };
      this.libraryLabels = [...shared.libraryLabels];
      this.textureMeta = shared.textureMeta.map((entry) => ({ ...entry }));
      this.requiredTextures = [...shared.requiredTextures];
      this.blobUrls = new Map(shared.blobUrls);
      this._atlasFits = shared.atlasFits;
      return {
        ...shared.result,
        header: this.header,
        requiredTextures: [...this.requiredTextures],
        libraryLabels: [...this.libraryLabels],
        providedImages: providedImageNames(this.filesByName),
      };
    }

    const allNames = scrapePngNames(bytes);
    this.libraryLabels = allNames.filter(isLibraryTextureName);
    this.textureMeta = parseLwfTextures(bytes);
    this.requiredTextures = extractSheetNames(bytes);

    const present = [];
    const missing = [];
    for (const name of this.requiredTextures) {
      if (this.filesByName.has(name.toLowerCase())) present.push(name);
      else missing.push(name);
    }

    if (!this.requiredTextures.length) {
      const imgs = providedImageNames(this.filesByName).filter(
        (k) => !looksLikeFragmentSplitName(this.filesByName.get(k)?.name || k),
      );
      this.requiredTextures = imgs.map((k) => this.filesByName.get(k)?.name || k);
      for (const k of imgs) present.push(this.filesByName.get(k)?.name || k);
    }

    const lwfUrl = URL.createObjectURL(
      new Blob([bytes], { type: 'application/octet-stream' }),
    );
    this.blobUrls.set('__lwf__', lwfUrl);

    for (const [key, file] of this.filesByName) {
      if (/\.lwf$/i.test(key)) continue;
      if (this.blobUrls.has(key)) continue;
      this.blobUrls.set(key, URL.createObjectURL(file));
    }
    this._atlasFits = 0;
    for (const tex of this.textureMeta) {
      const fn = tex.filename;
      const key = fn.toLowerCase();
      const src = this.blobUrls.get(key);
      if (!src || tex.width < 2 || tex.height < 2) continue;
      try {
        const result = await fitSheetBlobToTextureSize(src, tex.width, tex.height);
        if (result.fitted) {
          for (const [k, url] of this.blobUrls) {
            if (url === src) this.blobUrls.set(k, result.url);
          }
          this.blobUrls.set(key, result.url);
          try {
            URL.revokeObjectURL(src);
          } catch {}
          this._atlasFits += 1;
        }
      } catch (e) {}
    }

    const ok =
      missing.length === 0 &&
      (this.requiredTextures.length > 0 || present.length > 0);

    const result = {
      ok,
      missing,
      present,
      header: this.header,
      requiredTextures: this.requiredTextures,
      libraryLabels: this.libraryLabels,
      providedImages: providedImageNames(this.filesByName),
      atlasFits: this._atlasFits,
    };
    if (this.resourceKey) {
      sharedPreparedPacks.set(this.resourceKey, {
        header: { ...this.header },
        libraryLabels: [...this.libraryLabels],
        textureMeta: this.textureMeta.map((entry) => ({ ...entry })),
        requiredTextures: [...this.requiredTextures],
        blobUrls: new Map(this.blobUrls),
        atlasFits: this._atlasFits,
        result: {
          ok,
          missing: [...missing],
          present: [...present],
          atlasFits: this._atlasFits,
        },
      });
    }
    return result;
  }

  _resolveImage(name) {
    let key = String(name || '').replace(/\\/g, '/');
    while (key.startsWith('./')) key = key.slice(2);
    while (key.startsWith('../')) key = key.slice(3);
    while (key.startsWith('/')) key = key.slice(1);
    const base = key.split('/').pop() || key;
    this._requested.add(base);

    const tryKeys = [base.toLowerCase(), key.toLowerCase()];
    if (!/\.(png|jpe?g|webp|gif)$/i.test(base)) {
      tryKeys.push(`${base.toLowerCase()}.png`);
    } else {
      tryKeys.push(base.replace(/\.(png|jpe?g|webp|gif)$/i, '').toLowerCase());
    }
    for (const k of tryKeys) {
      const url = this.blobUrls.get(k);
      if (url) return url;
    }

    if (isLibraryTextureName(base)) {
      return '';
    }

    this._misses.add(base);
    return '';
  }

  async _loadOnce(cache) {
    const lwfUrl = this.blobUrls.get('__lwf__');
    if (!lwfUrl) throw new Error('No LWF blob — call prepare() first');

    const canvas = this.canvas;
    const w = this.header?.width || 550;
    const h = this.header?.height || 400;
    canvas.width = w;
    canvas.height = h;

    this._requested.clear();
    this._misses.clear();
    const self = this;

    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          reject(new Error('LWF load timeout'));
        }
      }, 30000);

      cache.loadLWF({
        lwf: lwfUrl,
        prefix: '',
        stage: canvas,
        worker: false,
        useBackgroundColor: false,
        imageMap: (name) => self._resolveImage(name),
        onload(instance) {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          if (!instance) {
            reject(new Error('LWF load failed'));
            return;
          }
          resolve(instance);
        },
      });
    });
  }

  async load() {
    if (typeof window.LWF === 'undefined') {
      throw new Error('LWF.js not loaded');
    }
    if (typeof window.LWF.useCanvasRenderer === 'function') {
      window.LWF.useCanvasRenderer();
    }
    // Patch before ResourceCache creates its renderer factory. Some official
    // effects use screen/multiply/subtract blend modes for background plates.
    // The viewer can opt out when comparing the stock Canvas compositor to a
    // reference player that already provides its own blend implementation.
    if (this.patchCanvasBlendModes) ensureLwfCanvasBlendModes();

    // Keep a renderer cache per player. ResourceCache also retains live LWF
    // instances, so sharing it between simultaneous scenes from one pack can
    // bind later scenes to the first canvas. The prepared blob URLs above are
    // still shared, which lets the browser reuse the decoded image resources.
    let cache;
    try {
      cache = new window.LWF.ResourceCache();
    } catch {
      cache = window.LWF.ResourceCache.get();
    }

    const lwf = await this._loadOnce(cache);

    if (lwf.rendererFactory) {
      lwf.rendererFactory.clearColor = null;
      lwf.rendererFactory.absAdditiveAlphaScale = this.additiveAlphaScale;
      lwf.rendererFactory.absAdditiveBlendScale = this.additiveBlendScale;
      lwf.rendererFactory.disableAdditiveReduction = this.disableAdditiveReduction;
      lwf.rendererFactory.premultipliedAlpha = this.premultipliedAlpha;
      lwf.rendererFactory.forceTexturePremultiply = this.forceTexturePremultiply;
      lwf.rendererFactory.absCommandQueue = this.commandQueue;
      lwf.rendererFactory.z$Hc = function() { this.clearColor = null; };
      lwf.rendererFactory.setBackgroundColor = function() { this.clearColor = null; };
    }
    if (lwf.setBackgroundColor) {
      lwf.setBackgroundColor = function() {};
    }

    fitNative(lwf, this.canvas);
    // These are the same authored-runtime defaults used by the reference
    // battle-motion player. Keep the root on its own timeline and let the
    // external clock supply elapsed time instead of seeking child movies.
    lwf.frameSkip = this.frameSkip;
    lwf.z$Hk?.(this.frameSkip);
    lwf.fastForward = false;
    lwf.z$Gk?.(false);
    lwf.active = true;
    if (lwf.rootMovie) {
      lwf.rootMovie.active = true;
      lwf.rootMovie.playing = true;
    }

    this.lwf = lwf;
    const runtimeSheets = sheetsFromLwf(lwf);
    if (runtimeSheets.length) this.requiredTextures = runtimeSheets;
    this.movies = extractSceneNames(lwf);

    return this.movies;
  }

  setMovie(name, { play = false } = {}) {
    const lwf = this.lwf;
    if (!lwf?.rootMovie || !name) return false;

    const root = lwf.rootMovie;
    const previous = this.movie;
    // The official battle-motion player loads `movieName` as a fresh authored
    // linkage on each LWF layer. Do the same here instead of searching the
    // current scene graph first: `searchMovieInstance()` looks for an already
    // instantiated child by string id and can resolve a different character
    // or effect when several linkages share the same pack. Reusing that child
    // was the source of the wrong-clip/partial-composition behavior in the
    // viewer tester.
    try {
      root.detachMovie?.(this._attachName);
    } catch {}
    const movie = this.preferExistingMovie
      ? (root.searchMovieInstance?.(name) || root.attachMovie(name, this._attachName))
      : root.attachMovie(name, this._attachName);
    if (!movie) {
      return false;
    }
    if (previous && previous !== movie) {
      previous.playing = false;
      previous.active = false;
      previous.visible = false;
    }

    root.active = true;
    // Effects need the root timeline live, while character idle packages use
    // it only as an attachment container. Pausing it before the first render
    // preserves the authored body layer instead of leaving just the aura.
    root.playing = !this.freezeRootMovie;
    centerMovie(lwf, movie);
    movie.active = true;
    movie.visible = true;
    this.movie = movie;
    this.clip = name;
    this._logicalFrame = 1;
    this._accumulator = 0;
    this.onMovieChange?.(name);

    if (play) {
      movie.playing = true;
      if (typeof movie.gotoAndPlay === 'function') movie.gotoAndPlay(1);
      else if (typeof movie.gotoFrame === 'function') movie.gotoFrame(1);
      this.playing = true;
      this._emitFrame();
      this._kickLoop();
    } else {
      movie.playing = false;
      if (typeof movie.gotoAndStop === 'function') movie.gotoAndStop(1);
      else if (typeof movie.gotoFrame === 'function') movie.gotoFrame(1);
      this.playing = false;
      this._renderStill();
      this._emitFrame();
    }
    return true;
  }

  // Attach another authored linkage without replacing the current movie.
  // DokkanDB's rich character idle uses two LWF layers from the same pack on
  // one shared clock, so a serial setMovie() hand-off cannot preserve the
  // character/aura phase relationship.
  attachMovieLayer(name, {
    attachName = `mc_layer_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    depth = null,
    play = false,
    active = true,
    visible = true,
  } = {}) {
    const lwf = this.lwf;
    const root = lwf?.rootMovie;
    if (!root || !name) return null;

    const options = Number.isFinite(Number(depth))
      ? { depth: Math.floor(Number(depth)) }
      : undefined;
    let movie = null;
    try {
      movie = root.attachMovie(name, attachName, options);
    } catch {}
    if (!movie) return null;

    root.active = true;
    root.playing = !this.freezeRootMovie;
    centerMovie(lwf, movie);
    movie.active = Boolean(active);
    movie.visible = Boolean(visible);
    movie.playing = Boolean(play);
    if (play) {
      movie.gotoAndPlay?.(1);
    } else {
      movie.gotoAndStop?.(1);
    }
    return movie;
  }

  // Return the authored frame span for the currently attached scene,
  // including nested movies that carry the visible part of the animation.
  // KO screens and similar cutscenes often have a one-frame root container,
  // so using only movie.totalFrames would make their loop restart too early.
  getMovieFrameCount() {
    const count = Math.max(
      coerceFrameCount(this.movie?.totalFrames),
      maxNestedMovieFrames(this.movie),
    );
    return Math.min(Math.max(1, count), 3600);
  }

  getFrameState() {
    const m = this.movie;
    if (!m) {
      return { current: 0, total: 0, name: this.clip || '', fps: this.fps() };
    }
    const attached = Math.max(0, Number(m.totalFrames) || 0);
    const boundedCurrent = Number(this.loopEndFrame) > 0
      ? Math.max(1, Math.floor(Number(this._logicalFrame) || 1))
      : Math.max(0, Number(m.currentFrame) || 0);
    return {
      current: boundedCurrent,
      total: Math.max(attached, this.getRecordFrameCount()),
      name: this.clip || '',
      fps: this.fps(),
    };
  }

  seekFrame(frame, { play = true } = {}) {
    if (!this.movie) return false;
    const target = Math.max(1, Math.floor(Number(frame) || 1));
    seekMovieTree(this.movie, target, play);
    this._logicalFrame = target;
    this.playing = play;
    this._emitFrame();
    return true;
  }

  // Advance an attached scene through its authored timeline without rendering
  // intermediate frames.  This is deliberately different from seekFrame:
  // complex Dokkan effects often contain children with unrelated local frame
  // counts, so forcing every child to a matching absolute frame can produce a
  // blank composition. Natural execution preserves their parent-driven state.
  fastForwardToFrame(frame, { play = true } = {}) {
    if (!this.movie || !this.lwf) return false;
    const target = Math.max(1, Math.min(3600, Math.floor(Number(frame) || 1)));
    // Reset every live child to frame one *and let it play*.  Calling this
    // with `false` looks tempting, but it freezes the nested movies which
    // carry the visible art in many Dokkan KO effects.  The parent then moves
    // forward by itself and the result is an empty / half-composed canvas.
    // Starting all clips together and advancing LWF naturally preserves the
    // authored parent-child timing.
    seekMovieTree(this.movie, 1, true);
    this._logicalFrame = 1;
    this._lastTs = null;
    this._frozenAtEnd = false;
    this.movie.active = true;
    this.movie.playing = true;
    if (this.lwf.rootMovie) {
      this.lwf.rootMovie.active = true;
      this.lwf.rootMovie.playing = true;
    }

    const dt = 1 / this.fps();
    for (let current = 1; current < target; current += 1) {
      try {
        this.lwf.exec?.(dt);
      } catch {
        return false;
      }
    }
    this._logicalFrame = target;
    this.movie.playing = play;
    this.playing = play;
    if (play) this._kickLoop();
    else this._renderStill();
    this._emitFrame();
    return true;
  }

  fps() {
    const n = Number(this.header?.frameRate || this.lwf?.frameRate || 30);
    return Number.isFinite(n) && n > 0 ? n : 30;
  }

  getRecordFrameCount() {
    const attached = coerceFrameCount(this.movie?.totalFrames);
    let max = Math.max(
      attached,
      maxNestedMovieFrames(this.movie),
      maxNestedMovieFrames(this.lwf?.rootMovie),
    );

    const movies = this.lwf?.data?.movies;
    const len = movies && typeof movies.length === 'number' ? movies.length : 0;
    for (let i = 0; i < len; i++) {
      max = Math.max(max, coerceFrameCount(movies[i]?.frames));
    }

    if (max <= 1) {
      max = Math.max(1, Math.round(this.fps() * 3));
    }
    return Math.min(Math.max(1, max), 3600);
  }

  _emitFrame() {
    const state = this.getFrameState();
    this.onFrame?.(state);
    return state;
  }

  _observeVisualFrame() {
    if (!this.freezeOnStaticTail || this._frozenAtEnd) return;
    const signature = sampleCanvasSignature(this.canvas, this._sampleCanvas);
    if (!signature) return;
    if (!this._sampleCanvas && typeof document !== 'undefined') {
      // sampleCanvasSignature creates the canvas when one is not supplied. A
      // retained canvas avoids allocating a new tiny buffer every frame.
      this._sampleCanvas = document.createElement('canvas');
    }

    const frame = Number(this.loopEndFrame) > 0
      ? Number(this._logicalFrame) || 1
      : Number(this.movie?.currentFrame) || 1;
    const difference = canvasSignatureDifference(this._lastVisualSignature, signature);
    if (Number.isFinite(difference)) {
      const changed = difference > Math.max(0, Number(this.staticTailDifferenceThreshold) || 0);
      if (changed) {
        this._sawVisualMotion = true;
        this._staticTailFrames = 0;
      } else if (this._sawVisualMotion) {
        const loopEnd = Math.max(1, Number(this.loopEndFrame) || 0);
        const tailWindow = Math.max(30, (Number(this.staticTailMinFrames) || 18) * 3);
        if (!loopEnd || frame >= loopEnd - tailWindow) {
          const previousFrame = Number(this._lastVisualFrame) || frame - 1;
          this._staticTailFrames += Math.max(1, frame - previousFrame);
        }
      }
    }
    this._lastVisualSignature = signature;
    this._lastVisualFrame = frame;
  }

  _holdAtEnd(requestedLoopEnd, total) {
    const m = this.movie;
    if (!m) return;
    if (requestedLoopEnd > 0) {
      // The scene reached this point through normal LWF execution. Preserve
      // that composed image exactly as it is: recursively seeking every child
      // to the same frame number can map a short child past its real ending
      // and erase otherwise valid KO artwork.
      this._logicalFrame = Math.min(requestedLoopEnd, Number(this._logicalFrame) || requestedLoopEnd);
      m.playing = false;
    } else {
      m.playing = false;
      m.gotoAndStop?.(total);
    }
    this.playing = false;
    this._frozenAtEnd = true;
    this._lastTs = null;
    this.onEnded?.('freeze');
  }

  _renderStill() {
    try {
      const ctx = this.canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      }
      if (this.lwf?.rendererFactory) {
        this.lwf.rendererFactory.clearColor = null;
      }
      this.lwf?.exec?.(0);
      this.lwf?.render?.();
    } catch {}
  }

  play(startFrame = null) {
    if (!this.movie || !this.lwf) return;
    if (this._frozenAtEnd) {
      const requestedLoopStart = Math.floor(Number(this.loopStartFrame) || 0);
      const restartFrame = requestedLoopStart > 0 ? requestedLoopStart : 1;
      this._frozenAtEnd = false;
      this._lastVisualSignature = null;
      this._lastVisualFrame = 0;
      this._staticTailFrames = 0;
      this._sawVisualMotion = false;
      this._accumulator = 0;
      if (Number(this.loopEndFrame) > 0) {
        this.fastForwardToFrame(restartFrame, { play: true });
        return;
      }
    }
    this.movie.active = true;
    this.movie.playing = true;
    if (typeof this.movie.gotoAndPlay === 'function') {
      const requestedFrame = Math.floor(Number(startFrame));
      const cur = Number(this.movie.currentFrame);
      const targetFrame = Number.isFinite(requestedFrame) && requestedFrame > 0
        ? requestedFrame
        : ((!Number.isFinite(cur) || cur < 1) ? 1 : cur);
      this.movie.gotoAndPlay(targetFrame);
    }
    this.playing = true;
    this._accumulator = 0;
    this._emitFrame();
    if (this.useExternalClock) {
      this.renderFrame(false);
      return;
    }
    this._kickLoop();
  }

  pause() {
    this.playing = false;
    if (this.movie) this.movie.playing = false;
    if (this._raf) {
      cancelAnimationFrame(this._raf);
      this._raf = null;
    }
    this._lastTs = null;
    this._accumulator = 0;
    try {
      this.lwf?.render?.();
    } catch {}
    this._emitFrame();
  }

  _kickLoop() {
    if (this.useExternalClock) return;
    if (this._raf) return;
    this._lastTs = null;
    const tick = (ts) => {
      if (!this.playing || !this.lwf) {
        this._raf = null;
        return;
      }
      if (this._lastTs == null) this._lastTs = ts;
      const elapsed = (ts - this._lastTs) / 1000;
      this._lastTs = ts;
      const dt = Math.min(Math.max(elapsed, 0), this.maxDt);
      const playbackRate = Math.max(0.05, Number(this.playbackRate) || 1);
      const clockStep = 1 / Math.max(1, Number(this.maxFps) || 60);
      this._accumulator = Math.min(
        this.maxAccumulatedTime,
        this._accumulator + (dt * playbackRate),
      );
      let advancedSeconds = 0;
      let steps = 0;

      try {
        // 1. Explicitly clear the 2D canvas buffer on every tick
        const ctx = this.canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }

        // 2. Prevent LWF from filling with background color
        if (this.lwf.rendererFactory) {
          this.lwf.rendererFactory.clearColor = null;
        }

        while (this._accumulator >= clockStep && steps < this.maxSubSteps) {
          // A few character linkages contain an authored stop command on their
          // attachment frame. The public player still treats that linkage as
          // the live idle clock, so re-arm the selected movie before each
          // natural LWF step without seeking it back to frame one.
          this.movie?.play?.();
          this.lwf.exec?.(clockStep);
          this._accumulator -= clockStep;
          advancedSeconds += clockStep;
          steps += 1;
        }
        // Preserve sub-frame timing just like the reference external clock.
        // LWF keeps its own fractional remainder until an authored frame is
        // ready, so this does not force a child movie to jump to a frame.
        if (steps === 0 && this._accumulator > 0) {
          const remainder = this._accumulator;
          this.movie?.play?.();
          this.lwf.exec?.(remainder);
          advancedSeconds += remainder;
          this._accumulator = 0;
        } else if (steps >= this.maxSubSteps) {
          this._accumulator = Math.min(this._accumulator, clockStep);
        }
        if (Number(this.loopEndFrame) > 0) {
          this._logicalFrame = (Number(this._logicalFrame) || 1) + advancedSeconds * this.fps();
        }
        this.lwf.render?.();
        this._observeVisualFrame();
      } catch (e) {
        this._lastError = String(e?.stack || e?.message || e || 'LWF clock error');
        this.pause();
        return;
      }

      this._emitFrame();
      this._checkEnd();
      this._raf = requestAnimationFrame(tick);
    };
    this._raf = requestAnimationFrame(tick);
  }

  // Advance one child from a shared battle-motion clock. The reference
  // component passes seconds here (delta frames / its fixed FPS) and renders
  // all children afterwards. Do not seek the movie tree: nested LWF movies
  // have their own authored clocks and must be allowed to advance naturally.
  advance(seconds, paused = false) {
    if (!this.lwf || !this.movie || paused || !this.playing) return false;
    const value = Number(seconds);
    if (!Number.isFinite(value) || value <= 0) return false;
    try {
      // Keep an authored idle linkage alive when its frame-one setup command
      // stops the attachment after the first scene pass. This resumes the
      // current frame only; it never performs a synthetic seek/reset.
      this.movie.play?.();
      this.lwf.exec?.(value * Math.max(0.05, Number(this.playbackRate) || 1));
      if (Number(this.loopEndFrame) > 0) {
        this._logicalFrame = (Number(this._logicalFrame) || 1) + value * this.fps();
      }
      this._observeVisualFrame();
      this._checkEnd();
      this._emitFrame();
      return true;
    } catch (e) {
      this._lastError = String(e?.stack || e?.message || e || 'LWF advance error');
      this.playing = false;
      return false;
    }
  }

  // Render one already-advanced child. Keeping clear and render separate is
  // important when several LWF layers share a parent clock; clearing each
  // child's private canvas cannot flash the other layers.
  renderFrame(paused = false) {
    if (!this.lwf) return false;
    try {
      const ctx = this.canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      if (this.lwf.rendererFactory) this.lwf.rendererFactory.clearColor = null;
      this.lwf.render?.(paused);
      this._observeVisualFrame();
      return true;
    } catch {
      return false;
    }
  }

  _checkEnd() {
    if (this.ignoreMovieEnd) return;
    const m = this.movie;
    if (!m || this._advancing) return;
    const requestedLoopEnd = Math.floor(Number(this.loopEndFrame) || 0);
    const total = requestedLoopEnd > 0
      ? Math.max(requestedLoopEnd, this.getRecordFrameCount())
      : Number(m.totalFrames);
    const cur = requestedLoopEnd > 0
      ? Number(this._logicalFrame)
      : Number(m.currentFrame);
    if (!(total > 1) || !Number.isFinite(cur)) return;

    const loopEnd = requestedLoopEnd > 0
      ? Math.max(1, requestedLoopEnd)
      : total;
    const atEnd = cur >= loopEnd || (m.playing === false && cur >= loopEnd - 1);
    if (!atEnd) return;

    // A deliberately bounded loop is allowed to interrupt nested clips at its
    // chosen end frame. Full-movie playback still waits for nested animation.
    if (requestedLoopEnd <= 0 && this.waitForNestedMoviesAtEnd && hasUnfinishedNestedMovie(m)) return;

    // Some KO LWFs are transition clips: they animate into a final KO frame
    // and intentionally hold it. Replaying those clips creates a visible jump,
    // so freeze only after observing a meaningful motion followed by a stable
    // tail. Seamless KO loops continue through the normal loop branch below.
    if (
      this.freezeOnStaticTail
      && this._sawVisualMotion
      && this._staticTailFrames >= Math.max(1, Number(this.staticTailMinFrames) || 18)
    ) {
      this._holdAtEnd(requestedLoopEnd, total);
      return;
    }

    if (this.loopMovie) {
      m.playing = true;
      const tailFrames = Math.max(0, Math.floor(Number(this.loopTailFrames) || 0));
      const requestedLoopStart = Math.floor(Number(this.loopStartFrame) || 0);
      const loopStart = requestedLoopStart > 0
        ? Math.min(loopEnd, Math.max(1, requestedLoopStart))
        : (tailFrames > 0 ? Math.max(1, total - tailFrames) : 1);
      // A bounded idle loop must restart through the authored timeline.  A
      // direct recursive seek maps the same frame number to children with
      // unrelated durations, which is what made certain final idle clips
      // jump to a blank frame on their second pass.
      if (requestedLoopEnd > 0 && this.seamlessLoop) {
        this._logicalFrame = loopStart;
        this._lastTs = null;
        m.gotoAndPlay?.(loopStart);
      } else if (requestedLoopEnd > 0) {
        this.fastForwardToFrame(loopStart, { play: true });
      } else {
        m.gotoAndPlay?.(loopStart);
      }
      return;
    }
    if (requestedLoopEnd > 0) {
      // Rich idle sequences end on their authored third scene. Preserve the
      // composed final frame instead of seeking the parent back to frame one;
      // that reset is the bright/dark flash visible on Trunks.
      this._holdAtEnd(requestedLoopEnd, total);
      return;
    }
    m.playing = false;
    m.gotoAndStop?.(total);
    this.playing = false;
    this.onEnded?.('stop');
  }
}
