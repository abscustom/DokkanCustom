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

export class LwfPackPlayer {
  constructor(canvas, log = () => {}) {
    this.canvas = canvas;
    this.log = log;
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
    this.autoProgress = false;
    this._raf = null;
    this._lastTs = null;
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
    this._lwfBytes = null;
    this._atlasFits = 0;
    this._requested.clear();
    this._misses.clear();
    revokeMap(this.blobUrls);
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

    return {
      ok,
      missing,
      present,
      header: this.header,
      requiredTextures: this.requiredTextures,
      libraryLabels: this.libraryLabels,
      providedImages: providedImageNames(this.filesByName),
      atlasFits: this._atlasFits,
    };
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

    let cache;
    try {
      cache = new window.LWF.ResourceCache();
    } catch {
      cache = window.LWF.ResourceCache.get();
    }

    const lwf = await this._loadOnce(cache);

    if (lwf.rendererFactory) {
      lwf.rendererFactory.clearColor = null;
      lwf.rendererFactory.z$Hc = function() { this.clearColor = null; };
      lwf.rendererFactory.setBackgroundColor = function() { this.clearColor = null; };
    }
    if (lwf.setBackgroundColor) {
      lwf.setBackgroundColor = function() {};
    }

    fitNative(lwf, this.canvas);
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

    try {
      lwf.rootMovie.detachMovie?.(this._attachName);
    } catch {}

    lwf.rootMovie.active = true;
    lwf.rootMovie.playing = true;

    const movie = lwf.rootMovie.attachMovie(name, this._attachName);
    if (!movie) {
      return false;
    }
    centerMovie(lwf, movie);
    movie.active = true;
    this.movie = movie;
    this.clip = name;
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

  getFrameState() {
    const m = this.movie;
    if (!m) {
      return { current: 0, total: 0, name: this.clip || '', fps: this.fps() };
    }
    const attached = Math.max(0, Number(m.totalFrames) || 0);
    return {
      current: Math.max(0, Number(m.currentFrame) || 0),
      total: Math.max(attached, this.getRecordFrameCount()),
      name: this.clip || '',
      fps: this.fps(),
    };
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

  play() {
    if (!this.movie || !this.lwf) return;
    this.movie.active = true;
    this.movie.playing = true;
    if (typeof this.movie.gotoAndPlay === 'function') {
      const cur = Number(this.movie.currentFrame);
      if (!Number.isFinite(cur) || cur < 1) this.movie.gotoAndPlay(1);
      else this.movie.gotoAndPlay(cur);
    }
    this.playing = true;
    this._emitFrame();
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
    try {
      this.lwf?.render?.();
    } catch {}
    this._emitFrame();
  }

  _kickLoop() {
    if (this._raf) return;
    this._lastTs = null;
    const tick = (ts) => {
      if (!this.playing || !this.lwf) {
        this._raf = null;
        return;
      }
      if (this._lastTs == null) this._lastTs = ts;
      let dt = (ts - this._lastTs) / 1000;
      this._lastTs = ts;
      const fps = this.fps();
      if (!(dt > 0) || dt > 0.1) dt = 1 / fps;

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

        this.lwf.exec?.(dt);
        this.lwf.render?.();
      } catch (e) {
        this.pause();
        return;
      }

      this._emitFrame();
      this._checkEnd();
      this._raf = requestAnimationFrame(tick);
    };
    this._raf = requestAnimationFrame(tick);
  }

  _checkEnd() {
    const m = this.movie;
    if (!m || this._advancing) return;
    const total = Number(m.totalFrames);
    const cur = Number(m.currentFrame);
    if (!(total > 1) || !Number.isFinite(cur)) return;

    const atEnd = cur >= total || (m.playing === false && cur >= total - 1);
    if (!atEnd) return;

    if (this.loopMovie) {
      m.playing = true;
      m.gotoAndPlay?.(1);
      return;
    }
    m.playing = false;
    m.gotoAndStop?.(total);
    this.playing = false;
    this.onEnded?.('stop');
  }
}