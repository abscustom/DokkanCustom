import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import https from 'node:https';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

function extractSheetNames(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let ascii = '';
  for (let i = 0; i < u8.length; i++) {
    const c = u8[i];
    ascii += c >= 0x20 && c <= 0x7e ? String.fromCharCode(c) : '\0';
  }
  const found = ascii.match(/[\w./\\-]+\.(?:png|jpe?g|webp|gif)/gi) || [];
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

const DEFAULT_CARDHUB_ROOT = 'C:/Users/Ruffy/Desktop/cardhub v2';
const cardhubRoot = path.resolve(process.env.DOKKAN_LOCAL_ROOT || DEFAULT_CARDHUB_ROOT);
const assetsRoot = path.resolve(process.env.DOKKAN_ASSETS_ROOT || path.join(cardhubRoot, 'assets'));
// Dot-character LWF assets live in the CardHub Console staging folder.
// Override with DOKKAN_DOT_CHARACTER_ROOT if they're located elsewhere.
const DEFAULT_DOT_CHARACTER_ROOT = 'C:/Users/Ruffy/Desktop/CardHub Console/staging/assets/dot_character';
const dotCharacterRoot = path.resolve(
  process.env.DOKKAN_DOT_CHARACTER_ROOT ||
  (fs.existsSync(path.join(assetsRoot, 'dot_character')) ? path.join(assetsRoot, 'dot_character') : DEFAULT_DOT_CHARACTER_ROOT)
);
// Remote fallback files are playback cache, not game assets. Keeping them in
// one dedicated folder prevents failed CDN probes from leaving empty package
// directories throughout the real asset tree.
const temporaryAssetRoot = path.resolve(process.env.DOKKAN_TEMP_ASSETS || path.join(assetsRoot, '_temp'));
const scriptsRoot = path.resolve(process.env.DOKKAN_LUA_ROOT || path.join(assetsRoot, 'lua', 'ab_script'));
const databasePath = path.resolve(
  process.env.DOKKAN_DATABASE || path.join(cardhubRoot, 'tools', 'database_decrypted.db'),
);
const port = Number(process.env.DOKKAN_ANIMATION_PORT || 3137);
const host = process.env.DOKKAN_ANIMATION_HOST || '0.0.0.0';
const audioRoot = path.resolve(process.env.DOKKAN_AUDIO_ROOT || path.join(assetsRoot, 'se'));
const audioCacheRoot = path.resolve(process.env.DOKKAN_AUDIO_CACHE || path.join(cardhubRoot, '.audio-cache', 'se'));
// Increment whenever cue-to-subsong indexing or decode behavior changes. This
// prevents a correctly named cue from reusing a WAV produced by an older,
// incompatible mapper.
const soundCacheVersion = 'cue-index-v2';
const voiceRoot = path.resolve(process.env.DOKKAN_VOICE_ROOT || path.join(assetsRoot, 'voice'));
const voiceLanguage = String(process.env.DOKKAN_VOICE_LANGUAGE || 'en').trim().toLowerCase();
const voiceCacheRoot = path.resolve(process.env.DOKKAN_VOICE_CACHE || path.join(cardhubRoot, '.audio-cache', 'voice'));
const movieCacheRoot = path.resolve(process.env.DOKKAN_MOVIE_CACHE || path.join(cardhubRoot, '.movie-cache'));
const vgmstreamPath = path.resolve(
  process.env.DOKKAN_VGMSTREAM || path.join(cardhubRoot, 'tools', 'vgmstream-win64', 'vgmstream-cli.exe'),
);
const soundDecodeJobs = new Map();
let soundCueIndex = null;
let soundCueIndexJob = null;
const voiceDecodeJobs = new Map();
const movieConvertJobs = new Map();
let voiceCueIndex = null;
let voiceCueIndexJob = null;

for (const required of [assetsRoot, scriptsRoot, databasePath]) {
  if (!fs.existsSync(required)) throw new Error(`Required local Dokkan path was not found: ${required}`);
}

const db = new DatabaseSync(databasePath, { readOnly: true });
const effectById = db.prepare(`
  SELECT id, category, name, pack_name, scene_name, red, green, blue, alpha
  FROM effect_packs
  WHERE id = ?
`);

const cardById = db.prepare(`
  SELECT c.id, c.name, c.character_id, c.special_motion, c.resource_id, c.aura_id, c.aura_scale,
         c.aura_offset_x, c.aura_offset_y, c.is_aura_front, c.bg_effect_id, ch.size AS character_size
  FROM cards c
  LEFT JOIN characters ch ON c.character_id = ch.id
  WHERE c.id = ?
`);

const levelBgById = db.prepare('SELECT * FROM level_bgs WHERE id = ?');

const scriptIndex = new Map();
const packDirectoryCache = new Map();
const counterScriptCards = new Map();

function walkScripts(folder) {
  for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    const fullPath = path.join(folder, entry.name);
    if (entry.isDirectory()) walkScripts(fullPath);
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.lua')) {
      scriptIndex.set(path.basename(entry.name, '.lua').toLowerCase(), fullPath);
    }
  }
}

walkScripts(scriptsRoot);

// Counter Lua files are not represented by special_views.  Newer cards expose
// their c#### number through passive efficacy type 120, while many older Lua
// files document the owning card in a header comment.  Index the latter once
// so both official sources can be returned through one API.
for (const [scriptName, scriptPath] of scriptIndex) {
  if (!/[/\\]attack_counter[/\\]/i.test(scriptPath)) continue;
  const header = fs.readFileSync(scriptPath, 'utf8').slice(0, 1200);
  const cardIds = [...header.matchAll(/--\s*(\d{7,8})\s*[:：]/g)]
    .map((match) => Number(match[1]))
    .filter((id) => Number.isInteger(id) && id > 0);
  if (cardIds.length) counterScriptCards.set(scriptName, cardIds);
}

const counterPassiveScripts = db.prepare(`
  SELECT ps.eff_value3 AS script_no
  FROM passive_skills ps
  INNER JOIN passive_skill_set_relations relation
    ON relation.passive_skill_id = ps.id
  WHERE relation.passive_skill_set_id = ?
    AND ps.efficacy_type IN (120, 128)
    AND ps.eff_value3 > 0
`);

// A pure nullification has no return attack and therefore does not use the
// c#### counter bank. Efficacy type 119 instead stores an ab_sys/as####
// cinematic number in eff_value3 (for example as0012 / as0032).
const nullificationPassiveScripts = db.prepare(`
  SELECT ps.eff_value3 AS script_no
  FROM passive_skills ps
  INNER JOIN passive_skill_set_relations relation
    ON relation.passive_skill_id = ps.id
  WHERE relation.passive_skill_set_id = ?
    AND ps.efficacy_type = 119
    AND ps.eff_value3 > 0
`);

function counterCardCandidates(rawCardId) {
  const raw = Number(rawCardId);
  if (!Number.isInteger(raw) || raw <= 0) return [];
  const candidates = new Set([raw]);
  // Site IDs commonly use a visible trailing 1, while game Lua comments use
  // the asset record ending in 0. EZA/SEZA IDs append a final 8/9.
  if (raw % 10 === 1) candidates.add(raw - 1);
  if (raw >= 10_000_000) {
    const base = Math.floor(raw / 10);
    candidates.add(base);
    candidates.add(base - 1);
  }
  return [...candidates].filter((id) => id > 0);
}

function counterPayload(cardId) {
  const candidates = counterCardCandidates(cardId);
  if (!candidates.length) return null;

  const records = [];
  const seen = new Set();
  const add = (scriptName, source, kind = 'counter') => {
    const normalized = String(scriptName || '').toLowerCase();
    if (!/^(?:c|as)\d{4}$/i.test(normalized) || !scriptIndex.has(normalized) || seen.has(normalized)) return;
    seen.add(normalized);
    records.push({ script_name: normalized, source, kind });
  };

  // Explicit card IDs written in the official counter Lua headers.
  for (const [scriptName, scriptedCards] of counterScriptCards) {
    if (scriptedCards.some((id) => candidates.includes(id))) add(scriptName, 'lua-card-header', 'counter');
  }

  // Authoritative current-game mapping: efficacy type 120 (and type 128 for
  // dodge-triggered counters) stores the c#### suffix in eff_value3
  // (e.g. 36 -> c0036 for Beast Gohan).
  const cardPlaceholders = candidates.map(() => '?').join(', ');
  const cards = db.prepare(`
    SELECT DISTINCT id, passive_skill_set_id
    FROM cards
    WHERE id IN (${cardPlaceholders}) OR resource_id IN (${cardPlaceholders})
  `).all(...candidates, ...candidates);
  for (const card of cards) {
    for (const row of counterPassiveScripts.all(Number(card.passive_skill_set_id) || 0)) {
      const suffix = Number(row.script_no);
      if (Number.isInteger(suffix) && suffix > 0) add(`c${String(suffix).padStart(4, '0')}`, 'passive-effect', 'counter');
    }
    for (const row of nullificationPassiveScripts.all(Number(card.passive_skill_set_id) || 0)) {
      const suffix = Number(row.script_no);
      if (Number.isInteger(suffix) && suffix > 0) add(`as${String(suffix).padStart(4, '0')}`, 'passive-nullification', 'nullification');
    }
  }

  return { card_id: Number(cardId), scripts: records };
}

function safeJson(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, ngrok-skip-browser-warning, *',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Private-Network': 'true',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function normalizeSoundCueId(rawCueId) {
  const cueId = Number(rawCueId);
  if (!Number.isInteger(cueId) || cueId < 0 || cueId > 99999) return null;
  return cueId;
}

function runVgmstream(args, label, { captureOutput = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(vgmstreamPath, args, { windowsHide: true });
    let stdout = '';
    let stderr = '';
    if (captureOutput) child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (error) => reject(new Error(`${label} could not start: ${error.message}`)));
    child.on('close', (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`${label} failed with exit code ${code}${stderr.trim() ? `: ${stderr.trim()}` : ''}`));
    });
  });
}

async function buildSoundCueIndex() {
  if (soundCueIndex) return soundCueIndex;
  if (soundCueIndexJob) return soundCueIndexJob;
  soundCueIndexJob = (async () => {
    if (!fs.existsSync(audioRoot)) throw new Error(`Sound-bank folder was not found at ${audioRoot}`);
    if (!fs.existsSync(vgmstreamPath)) throw new Error(`vgmstream was not found at ${vgmstreamPath}`);
    const banks = fs.readdirSync(audioRoot)
      .filter((name) => /^se\d+\.acb$/i.test(name))
      .sort((left, right) => left.localeCompare(right));
    if (!banks.length) throw new Error('No local ACB sound banks were found. Run the Nox audio pull first.');

    const index = new Map();
    for (const bankFile of banks) {
      const bankPath = path.join(audioRoot, bankFile);
      const output = await runVgmstream(['-m', '-s', '1', '-S', '0', bankPath], `Reading ${bankFile}`, { captureOutput: true });
      let streamIndex = null;
      for (const line of output.split(/\r?\n/)) {
        const indexMatch = line.match(/^stream index:\s*(\d+)\s*$/i);
        if (indexMatch) {
          streamIndex = Number(indexMatch[1]);
          continue;
        }
        const nameMatch = line.match(/^stream name:\s*(\d+)_/i);
        if (nameMatch && Number.isInteger(streamIndex)) {
          const cueId = Number(nameMatch[1]);
          // Prefer the first matching bank consistently. Duplicate cue names
          // are rare legacy variants and need a set ID to disambiguate.
          if (!index.has(cueId)) index.set(cueId, { cueId, bankFile, streamIndex });
          streamIndex = null;
        }
      }
    }
    soundCueIndex = index;
    return index;
  })();
  try {
    return await soundCueIndexJob;
  } finally {
    soundCueIndexJob = null;
  }
}

async function soundCueInfo(rawCueId) {
  const cueId = normalizeSoundCueId(rawCueId);
  if (cueId == null) return null;
  const index = await buildSoundCueIndex();
  return index.get(cueId) || null;
}

async function decodeSoundCue(rawCueId) {
  const info = await soundCueInfo(rawCueId);
  if (!info) throw new Error('Invalid sound-effect cue.');

  const bankPath = path.join(audioRoot, info.bankFile);
  if (!fs.existsSync(bankPath)) throw new Error(`Sound bank is not available locally: ${info.bankFile}`);
  const cachePath = path.join(audioCacheRoot, soundCacheVersion, `se_${info.cueId}.wav`);
  // ACB filenames are stable across Dokkan updates even when their embedded
  // cues change. Never keep serving a WAV decoded from an older bank after a
  // full Nox sync replaces that ACB.
  if (fs.existsSync(cachePath)) {
    const cacheStat = fs.statSync(cachePath);
    const bankStat = fs.statSync(bankPath);
    if (cacheStat.size > 44 && cacheStat.mtimeMs >= bankStat.mtimeMs) return cachePath;
  }
  if (soundDecodeJobs.has(info.cueId)) return soundDecodeJobs.get(info.cueId);

  const job = (async () => {
    fs.mkdirSync(path.dirname(cachePath), { recursive: true });
    const partialPath = `${cachePath}.${process.pid}.part.wav`;
    try {
      await runVgmstream(['-o', partialPath, '-i', '-s', String(info.streamIndex), bankPath], `Decoding SE ${info.cueId}`);
      if (!fs.existsSync(partialPath) || fs.statSync(partialPath).size <= 44) {
        throw new Error(`vgmstream did not produce audio for cue ${info.cueId}.`);
      }
      fs.renameSync(partialPath, cachePath);
      return cachePath;
    } finally {
      try { fs.rmSync(partialPath, { force: true }); } catch {}
      soundDecodeJobs.delete(info.cueId);
    }
  })();
  soundDecodeJobs.set(info.cueId, job);
  return job;
}

function walkAudioBanks(root, preferred = false) {
  if (!fs.existsSync(root)) return [];
  const files = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(fullPath);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith('.awb')) {
        files.push({ fullPath, relativePath: path.relative(voiceRoot, fullPath).replace(/\\/g, '/'), preferred });
      }
    }
  };
  visit(root);
  return files;
}

async function buildVoiceCueIndex() {
  if (voiceCueIndex) return voiceCueIndex;
  if (voiceCueIndexJob) return voiceCueIndexJob;
  voiceCueIndexJob = (async () => {
    if (!fs.existsSync(voiceRoot)) throw new Error(`Voice-bank folder was not found at ${voiceRoot}`);
    if (!fs.existsSync(vgmstreamPath)) throw new Error(`vgmstream was not found at ${vgmstreamPath}`);

    const preferredRoot = path.join(voiceRoot, voiceLanguage);
    const candidates = [
      ...walkAudioBanks(preferredRoot, true),
      ...walkAudioBanks(voiceRoot, false),
    ];
    const seen = new Set();
    const banks = candidates.filter((bank) => {
      const key = bank.fullPath.toLowerCase();
      if (seen.has(key)) return false;
      // When a localized bank exists, do not let a different localized tree
      // outrank it. Root-level Japanese banks remain the final fallback.
      const relative = bank.relativePath.toLowerCase();
      if (!bank.preferred && relative.includes('/') && /^[a-z]{2}\//.test(relative)) return false;
      seen.add(key);
      return true;
    });
    if (!banks.length) throw new Error('No local AWB voice banks were found. Run the Nox audio pull first.');

    const index = new Map();
    for (const bank of banks) {
      const output = await runVgmstream(
        ['-m', '-s', '1', '-S', '0', bank.fullPath],
        `Reading ${bank.relativePath}`,
        { captureOutput: true },
      );
      let streamIndex = null;
      for (const line of output.split(/\r?\n/)) {
        const indexMatch = line.match(/^stream index:\s*(\d+)\s*$/i);
        if (indexMatch) {
          streamIndex = Number(indexMatch[1]);
          continue;
        }
        const nameMatch = line.match(/^stream name:\s*0*(\d+)(?:_|\s|$)/i);
        if (!nameMatch || !Number.isInteger(streamIndex)) continue;
        const cueId = Number(nameMatch[1]);
        const entries = index.get(cueId) || [];
        entries.push({ cueId, streamIndex, ...bank });
        index.set(cueId, entries);
        streamIndex = null;
      }
    }
    voiceCueIndex = index;
    return index;
  })();
  try {
    return await voiceCueIndexJob;
  } finally {
    voiceCueIndexJob = null;
  }
}

async function voiceCueInfo(rawCueId, packageHint = '') {
  const cueId = normalizeSoundCueId(rawCueId);
  if (cueId == null) return null;
  const entries = (await buildVoiceCueIndex()).get(cueId) || [];
  const hint = String(packageHint || '').trim().toLowerCase().replace(/\.(?:acb|awb)$/i, '');
  if (hint) {
    const matched = entries.find((entry) => entry.relativePath.toLowerCase().includes(hint));
    if (matched) return matched;
  }
  return entries.find((entry) => entry.preferred) || entries[0] || null;
}

async function decodeVoiceCue(rawCueId, packageHint = '') {
  const info = await voiceCueInfo(rawCueId, packageHint);
  if (!info) throw new Error('Invalid or unavailable voice cue.');
  const cacheKey = `${voiceLanguage}:${info.cueId}:${info.relativePath}:${info.streamIndex}`;
  const safeBank = path.basename(info.relativePath, path.extname(info.relativePath)).replace(/[^a-z0-9_-]+/gi, '_');
  const cachePath = path.join(voiceCacheRoot, `${voiceLanguage}_${safeBank}_${info.cueId}.wav`);
  if (fs.existsSync(cachePath) && fs.statSync(cachePath).size > 44) return cachePath;
  if (voiceDecodeJobs.has(cacheKey)) return voiceDecodeJobs.get(cacheKey);

  const job = (async () => {
    fs.mkdirSync(voiceCacheRoot, { recursive: true });
    const partialPath = `${cachePath}.${process.pid}.part.wav`;
    try {
      await runVgmstream(
        ['-o', partialPath, '-i', '-s', String(info.streamIndex), info.fullPath],
        `Decoding voice ${info.cueId}`,
      );
      if (!fs.existsSync(partialPath) || fs.statSync(partialPath).size <= 44) {
        throw new Error(`vgmstream did not produce audio for voice cue ${info.cueId}.`);
      }
      fs.renameSync(partialPath, cachePath);
      return cachePath;
    } finally {
      try { fs.rmSync(partialPath, { force: true }); } catch {}
      voiceDecodeJobs.delete(cacheKey);
    }
  })();
  voiceDecodeJobs.set(cacheKey, job);
  return job;
}

function scriptTypeFromPath(scriptPath) {
  return path.basename(path.dirname(scriptPath)).replaceAll('_', ' ');
}

function findPackDirectory(packName) {
  if (packDirectoryCache.has(packName)) return packDirectoryCache.get(packName);
  const candidates = [
    path.join(assetsRoot, 'ingame', 'battle', 'sp_effect', packName, 'en'),
    path.join(assetsRoot, 'ingame', 'battle', 'sp_effect', packName),
    path.join(assetsRoot, 'ingame', 'battle', 'effect', packName, 'en'),
    path.join(assetsRoot, 'ingame', 'battle', 'effect', packName),
    path.join(assetsRoot, 'battle', packName),
  ];
  const found = candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) || null;
  if (found) packDirectoryCache.set(packName, found);
  return found;
}

function hasKoMarker(value) {
  const text = String(value || '').replace(/[‐‑‒–—]/g, '-');
  return /(?:^|[^A-Za-z0-9])K\s*[._-]?\s*O\.?\s*(?:$|[^A-Za-z0-9])|Ｋ\s*[．._-]?\s*[ＯO]|KOScreen|K\.O\.演出|KO演出/iu.test(text);
}

function extractEffectReferences(source) {
  const candidates = new Map();
  const assignments = new Map();
  // Dokkan Lua uses both `NAME = 123; -- comment` and
  // `NAME = 123 -- comment` forms. Keep the trailing comment available for
  // KO markers in either form.
  const assignmentPattern = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(\d+)\s*;?\s*([^\r\n]*)\r?$/gm;
  for (const match of source.matchAll(assignmentPattern)) {
    const id = Number(match[2]);
    assignments.set(match[1], {
      id,
      isKo: hasKoMarker(match[1]) || hasKoMarker(match[3]),
    });
  }

  const effectCallPattern = /\b(setupMovie|entryEffect(?:Life|Unpausable|Attach|Sub)?)\s*\(([^)]*)\)/g;
  for (const match of source.matchAll(effectCallPattern)) {
    const tokens = match[2].split(',').map((token) => token.trim());
    const token = tokens[1];
    const assignment = assignments.get(token);
    const id = /^\d+$/.test(token || '') ? Number(token) : assignment?.id;
    if (!id) continue;
    const nearbySource = source.slice(Math.max(0, match.index - 180), match.index);
    const isKo = Boolean(assignment?.isKo || hasKoMarker(token) || hasKoMarker(nearbySource));
    const existing = candidates.get(id) || {
      id,
      firstIndex: match.index,
      names: new Set(),
      callScore: 0,
      isKo: false,
    };
    existing.firstIndex = Math.min(existing.firstIndex ?? match.index, match.index);
    existing.callScore += match[1] === 'setupMovie' ? 70 : 35;
    existing.isKo ||= isKo;
    if (assignment) existing.names.add(token);
    candidates.set(id, existing);
  }

  const effects = [];
  for (const candidate of candidates.values()) {
    const row = effectById.get(candidate.id);
    if (!row?.pack_name || !row?.scene_name) continue;
    const names = [...candidate.names];
    const isPrimaryVariable = names.some((name) => /^SP(?:_|\d)/i.test(name));
    const score = candidate.callScore
      + (isPrimaryVariable ? 100 : 0)
      + (row.category === 5 ? 30 : 0)
      + (/^sp_effect_/i.test(row.pack_name) ? 20 : 0);
    effects.push({
      ...row,
      score,
      source_names: names,
      source_index: candidate.firstIndex || 0,
      ko_screen: Boolean(candidate.isKo),
    });
  }

  effects.sort((a, b) => b.score - a.score || a.source_index - b.source_index || a.id - b.id);
  return effects;
}

function findMovieRelativePath(packName) {
  const candidates = [
    path.join('movie', 'en', 'ingame', 'battle', 'sp_effect', `${packName}.usm`),
    path.join('movie', 'en', 'ingame', 'battle', 'sp_effect', packName, `${packName}.usm`),
    path.join('movie', 'en', 'ingame', 'battle', 'effect', `${packName}.usm`),
    path.join('movie', 'en', 'ingame', 'battle', 'effect', packName, `${packName}.usm`),
    path.join('movie', 'ingame', 'battle', 'sp_effect', `${packName}.usm`),
    path.join('movie', 'ingame', 'battle', 'sp_effect', packName, `${packName}.usm`),
    path.join('movie', 'ingame', 'battle', 'effect', `${packName}.usm`),
    path.join('movie', 'ingame', 'battle', 'effect', packName, `${packName}.usm`),
  ];
  for (const rel of candidates) {
    const full = path.join(assetsRoot, rel);
    if (fs.existsSync(full)) return rel;
  }
  return path.join('movie', 'en', 'ingame', 'battle', 'sp_effect', `${packName}.usm`);
}

function listPackFiles(packName, origin) {
  const directory = findPackDirectory(packName);
  if (!directory) return { available: false, files: [] };
  const files = fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(?:lwf|png|jpe?g|webp)$/i.test(entry.name))
    .map((entry) => ({
      name: entry.name,
      url: `${origin}/assets/${encodeURIComponent(packName)}/${encodeURIComponent(entry.name)}`,
    }))
    .sort((a, b) => Number(!a.name.toLowerCase().endsWith('.lwf')) - Number(!b.name.toLowerCase().endsWith('.lwf')) || a.name.localeCompare(b.name));
  return { available: files.some((file) => file.name.toLowerCase().endsWith('.lwf')), files };
}

function encodeAssetUrl(origin, relativePath) {
  const encoded = String(relativePath)
    .replaceAll('\\', '/')
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
  return `${origin}/assets/${encoded}`;
}

function dotCharacterPayload(origin) {
  const root = dotCharacterRoot;
  if (!fs.existsSync(root)) return { characters: [] };

  const characters = [];
  const walk = (folder) => {
    const entries = fs.readdirSync(folder, { withFileTypes: true });
    const lwf = entries.find((entry) => entry.isFile() && entry.name.toLowerCase() === 'dot_character.lwf');
    if (lwf) {
      const files = entries
        .filter((entry) => entry.isFile() && /\.(?:lwf|png|jpe?g|webp)$/i.test(entry.name))
        .map((entry) => {
          const fullPath = path.join(folder, entry.name);
          // Build a virtual path relative to the dot_character root so the URL
          // uses the /assets/dot_character/... prefix that the request handler
          // resolves against dotCharacterRoot.
          const relativePath = 'dot_character/' + path.relative(root, fullPath).replaceAll('\\', '/');
          return { name: entry.name, url: encodeAssetUrl(origin, relativePath) };
        })
        .sort((left, right) => Number(!left.name.toLowerCase().endsWith('.lwf')) - Number(!right.name.toLowerCase().endsWith('.lwf')) || left.name.localeCompare(right.name));
      if (files.length >= 2) {
        characters.push({ id: path.relative(root, folder).replaceAll('\\', '/'), files });
      }
    }
    for (const entry of entries) if (entry.isDirectory()) walk(path.join(folder, entry.name));
  };
  walk(root);
  return { characters };
}

async function effectPayload(effectId, origin) {
  const row = effectById.get(Number(effectId));
  if (!row?.pack_name || !row?.scene_name) return null;
  const movieRel = findMovieRelativePath(row.pack_name);
  const movieFullPath = path.join(assetsRoot, movieRel);
  const hasLocalMovie = fs.existsSync(movieFullPath);
  return {
    ...row,
    color: { red: row.red, green: row.green, blue: row.blue, alpha: row.alpha },
    movie_url: encodeAssetUrl(origin, movieRel),
    movie_fallback_url: `${origin}/api/movie/${encodeURIComponent(String(row.id))}`,
    movie_rel: movieRel.replaceAll('\\', '/'),
    has_movie: hasLocalMovie,
    ...listPackFiles(row.pack_name, origin),
  };
}

function findCommonScript() {
  const candidates = [
    path.join(scriptsRoot, 'common', 'common.lua'),
    path.join(scriptsRoot, 'common.lua'),
  ];
  const found = candidates.find((c) => fs.existsSync(c));
  if (found) return fs.readFileSync(found, 'utf8');
  const fromIndex = scriptIndex.get('common');
  if (fromIndex && fs.existsSync(fromIndex)) return fs.readFileSync(fromIndex, 'utf8');
  return '';
}

function animationPayload(scriptName, requestOrigin) {
  const scriptPath = scriptIndex.get(scriptName.toLowerCase());
  if (!scriptPath) return null;
  const source = fs.readFileSync(scriptPath, 'utf8');
  const commonSource = findCommonScript();
  const effects = extractEffectReferences(source).map((effect, index) => {
    const movieRel = findMovieRelativePath(effect.pack_name);
    const movieFullPath = path.join(assetsRoot, movieRel);
    const hasLocalMovie = fs.existsSync(movieFullPath);
    return {
      id: effect.id,
      category: effect.category,
      name: effect.name,
      pack_name: effect.pack_name,
      scene_name: effect.scene_name,
      color: { red: effect.red, green: effect.green, blue: effect.blue, alpha: effect.alpha },
      source_names: effect.source_names,
      ko_screen: Boolean(effect.ko_screen),
      primary: index === 0,
      movie_url: encodeAssetUrl(requestOrigin, movieRel),
      movie_fallback_url: `${requestOrigin}/api/movie/${encodeURIComponent(String(effect.id))}`,
      movie_rel: movieRel.replaceAll('\\', '/'),
      has_movie: hasLocalMovie,
      ...listPackFiles(effect.pack_name, requestOrigin),
    };
  });
  const frameValues = [...source.matchAll(/\b(?:MAX_FRAME(?:_\d+)?|endPhase)\s*(?:\([^,]+,)?\s*=*\s*(\d+)/g)]
    .map((match) => Number(match[1]))
    .filter(Number.isFinite);
  return {
    script_name: scriptName,
    script_type: scriptTypeFromPath(scriptPath),
    relative_script_path: path.relative(scriptsRoot, scriptPath).replaceAll('\\', '/'),
    max_frame_hint: frameValues.length ? Math.max(...frameValues) : null,
    lua_source: source,
    common_source: commonSource,
    effects,
  };
}

async function fetchConvertedMovie(effectId) {
  const row = effectById.get(Number(effectId));
  if (!row?.pack_name) throw new Error(`Movie effect was not found: ${effectId}`);

  const movieRel = findMovieRelativePath(row.pack_name);
  const sourcePath = path.join(assetsRoot, movieRel);
  if (!fs.existsSync(sourcePath)) throw new Error(`Local USM movie was not found: ${movieRel}`);

  const safePackName = String(row.pack_name).replace(/[^A-Za-z0-9_.-]/g, '_');
  const cachePath = path.join(movieCacheRoot, `${safePackName}.mp4`);
  if (fs.existsSync(cachePath)) {
    const cacheStat = fs.statSync(cachePath);
    const sourceStat = fs.statSync(sourcePath);
    if (cacheStat.size > 1024 && cacheStat.mtimeMs >= sourceStat.mtimeMs) return cachePath;
  }
  if (movieConvertJobs.has(row.id)) return movieConvertJobs.get(row.id);

  const job = (async () => {
    fs.mkdirSync(movieCacheRoot, { recursive: true });
    const relativeUrl = movieRel.replaceAll('\\', '/');
    const upstreamUrl = `https://dokkan-eclipse.com/api/usm?path=${encodeURIComponent(relativeUrl)}&reencode=1`;
    const response = await fetch(upstreamUrl, { signal: AbortSignal.timeout(120000) });
    if (!response.ok) throw new Error(`USM conversion service returned ${response.status}`);
    const converted = Buffer.from(await response.arrayBuffer());
    if (converted.length < 12 || converted.toString('ascii', 4, 8) !== 'ftyp') {
      throw new Error('USM conversion service did not return an MP4 movie');
    }

    const partialPath = `${cachePath}.${process.pid}.part`;
    try {
      fs.writeFileSync(partialPath, converted);
      fs.renameSync(partialPath, cachePath);
    } finally {
      try { fs.rmSync(partialPath, { force: true }); } catch {}
    }
    return cachePath;
  })();
  movieConvertJobs.set(row.id, job);
  try {
    return await job;
  } finally {
    movieConvertJobs.delete(row.id);
  }
}

async function ensureLocalOrRemoteAsset(localRelativePath) {
  const localFullPath = path.join(assetsRoot, localRelativePath);
  if (fs.existsSync(localFullPath)) return localFullPath;

  const temporaryFullPath = path.resolve(temporaryAssetRoot, String(localRelativePath));
  if (!temporaryFullPath.startsWith(`${temporaryAssetRoot}${path.sep}`)) return null;
  if (fs.existsSync(temporaryFullPath)) return temporaryFullPath;

  // Attempt to fetch from Dokkan Eclipse CDN and cache in assets/_temp.
  const cdnUrl = `https://dokkan-eclipse.com/assets/${localRelativePath.replaceAll('\\', '/')}`;
  try {
    const parent = path.dirname(temporaryFullPath);
    if (!fs.existsSync(parent)) fs.mkdirSync(parent, { recursive: true });

    const res = await fetch(cdnUrl, { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.length > 0) {
        fs.writeFileSync(temporaryFullPath, buffer);
        return temporaryFullPath;
      }
    }
  } catch {}
  return null;
}

async function listCharacterLwfFiles(charaNum, subFolder, origin) {
  const charaIdStr = String(charaNum).padStart(5, '0');
  const relDir = path.join('ingame', 'battle', 'character', charaIdStr, subFolder);

  const lwfFileName = subFolder === 'battle'
    ? `battle_character_${charaIdStr}.lwf`
    : subFolder.startsWith('sp')
      ? `sp_character_${charaIdStr}_${subFolder.slice(2)}.lwf`
      : `idle_character_${charaIdStr}.lwf`;

  const lwfPath = await ensureLocalOrRemoteAsset(path.join(relDir, lwfFileName));
  if (!lwfPath || !fs.existsSync(lwfPath)) return null;

  // Character LWFs do not embed their sprite sheets. Resolve every referenced
  // atlas now so the client receives a complete, deterministic file set.
  let textureNames = [];
  try {
    textureNames = extractSheetNames(new Uint8Array(fs.readFileSync(lwfPath)));
  } catch {}
  await Promise.allSettled(textureNames.map((name) =>
    ensureLocalOrRemoteAsset(path.join(relDir, path.basename(name)))
  ));

  const existing = fs.readdirSync(path.dirname(lwfPath), { withFileTypes: true })
    .filter((e) => e.isFile() && /\.(?:lwf|png)$/i.test(e.name))
    .map((e) => ({
      name: e.name,
      url: `${origin}/assets/${encodeURIComponent(relDir.replaceAll('\\', '/'))}/${encodeURIComponent(e.name)}`,
    }))
    .sort((a, b) => Number(!a.name.endsWith('.lwf')) - Number(!b.name.endsWith('.lwf')) || a.name.localeCompare(b.name));

  return {
    rel: relDir.replaceAll('\\', '/'),
    url: `${origin}/assets/${encodeURIComponent(relDir.replaceAll('\\', '/'))}/${encodeURIComponent(lwfFileName)}`,
    files: existing,
  };
}

async function levelBgPayload(levelBgId, origin) {
  const id = Number(levelBgId);
  if (!id) return null;
  const row = levelBgById.get(id);
  if (!row) return null;

  const padded = String(id).padStart(5, '0');
  const folderName = `battle_bg_${padded}`;
  const relativeFolder = path.join('ingame', 'battle', 'bg', folderName);
  const layers = [];
  for (let index = 1; index <= 4; index += 1) {
    const enabled = Boolean(row[`bg${index}_enable`]);
    const relativePath = path.join(relativeFolder, `${folderName}_${String(index).padStart(2, '0')}.png`);
    layers.push({
      index,
      enabled,
      coef: Number(row[`bg${index}_coef`]) || 0,
      flip_disable: Boolean(row[`bg${index}_flip_disable`]),
      effect_enable: Boolean(row[`bg${index}_effect_enable`]),
      effect_name: row[`bg${index}_effect_name`] && row[`bg${index}_effect_name`] !== '0'
        ? row[`bg${index}_effect_name`]
        : null,
      rel: relativePath.replaceAll('\\', '/'),
      url: enabled ? encodeAssetUrl(origin, relativePath) : null,
    });
  }

  let lwf = null;
  if (layers.some((layer) => layer.effect_enable)) {
    const lwfRelativePath = path.join(relativeFolder, `${folderName}.lwf`);
    const lwfPath = await ensureLocalOrRemoteAsset(lwfRelativePath);
    if (lwfPath && fs.existsSync(lwfPath)) {
      lwf = {
        rel: lwfRelativePath.replaceAll('\\', '/'),
        url: encodeAssetUrl(origin, lwfRelativePath),
        bytes: fs.statSync(lwfPath).size,
      };
    }
  }

  return {
    found: true,
    id,
    name: row.name,
    enable_enemy_effect: Boolean(row.enable_enemy_effect),
    layers,
    lwf,
  };
}

async function cardPayload(cardId, origin) {
  const id = Number(cardId);
  if (!id) return null;
  const row = cardById.get(id);
  if (!row) return null;

  const charaNum = row.character_id || 1;
  const spMotionNum = row.special_motion || 1;
  const spStr = `sp${String(spMotionNum).padStart(2, '0')}`;

  const battle = await listCharacterLwfFiles(charaNum, 'battle', origin);
  const sp = await listCharacterLwfFiles(charaNum, spStr, origin);
  const idle = await listCharacterLwfFiles(charaNum, 'idle', origin);

  // Card textures (cutin, phrase, character, sp_name, sp_phrase)
  const candidateIds = [
    row.resource_id,
    Math.floor(id / 10) * 10,
    id >= 4000000 && id < 5000000 ? Math.floor((1000000 + (id % 1000000)) / 10) * 10 : null,
    id < 4000000 ? Math.floor((4000000 + (id % 1000000)) / 10) * 10 : null,
  ].filter((v) => Number.isFinite(v) && v > 0);
  const artId = candidateIds[0] || Math.floor(id / 10) * 10;

  const textures = {};
  const seenSlots = new Set();

  for (const cId of candidateIds) {
    const cardDir = path.join(assetsRoot, 'card', String(cId));
    if (!fs.existsSync(cardDir)) continue;

    const scanDir = (dirPath, relPrefix = '') => {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          if (entry.name === 'en' || entry.name === 'ja') {
            scanDir(path.join(dirPath, entry.name), `${entry.name}/`);
          }
          continue;
        }
        const f = entry.name;
        if (!f.endsWith('.png')) continue;
        const lower = f.toLowerCase();
        let slot = null;
        if (lower.includes('sp02_name')) slot = 'sp02_name';
        else if (lower.includes('sp02_phrase')) slot = 'sp02_phrase';
        else if (lower.includes('sp_name') || lower.includes('spname')) slot = 'sp_name';
        else if (lower.includes('sp_phrase') || lower.includes('spphrase')) slot = 'sp_phrase';
        else if (lower.includes('sp_cutin') || lower.includes('spcutin')) slot = 'sp_cutin';
        else if (lower.includes('cutin')) slot = 'cutin';
        else if (lower.includes('character')) slot = 'character';
        else if (lower.includes('effect')) slot = 'effect';
        else if (lower.includes('circle')) slot = 'circle';
        else if (lower.includes('bg')) slot = 'bg';

        if (slot && !seenSlots.has(slot)) {
          seenSlots.add(slot);
          textures[slot] = {
            name: f,
            url: `${origin}/assets/card/${cId}/${relPrefix}${encodeURIComponent(f)}`,
          };
        }
      }
    };
    scanDir(cardDir);
  }

  let aura = null;
  if (row.aura_id) {
    const auraEffectId = 349 + row.aura_id;
    const auraEffect = await effectPayload(auraEffectId, origin);
    aura = {
      id: row.aura_id,
      effect_id: auraEffectId,
      scale: row.aura_scale || 1,
      offset_x: row.aura_offset_x || 0,
      offset_y: row.aura_offset_y || 0,
      is_front: Boolean(row.is_aura_front),
      effect: auraEffect,
    };
  }

  return {
    found: true,
    id: row.id,
    name: row.name,
    character_id: charaNum,
    character_size: row.character_size || 4,
    special_motion: spMotionNum,
    art_id: artId,
    aura_id: row.aura_id,
    aura_scale: row.aura_scale || 1,
    aura,
    battle,
    sp,
    idle,
    textures,
  };
}

function serveDirectPath(res, filePath) {
  if (!fs.existsSync(filePath)) {
    safeJson(res, 404, { error: 'Asset not found' });
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  const mime = ext === '.png' ? 'image/png'
    : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
    : ext === '.webp' ? 'image/webp'
    : ext === '.webm' ? 'video/webm'
    : ext === '.mp4' ? 'video/mp4'
    : ext === '.wav' ? 'audio/wav'
    : ext === '.usm' ? 'application/octet-stream'
    : 'application/octet-stream';
  const stat = fs.statSync(filePath);
  res.writeHead(200, {
    'Content-Type': mime,
    'Content-Length': stat.size,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, ngrok-skip-browser-warning, *',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Private-Network': 'true',
    'Cache-Control': 'public, max-age=3600',
  });
  fs.createReadStream(filePath).pipe(res);
}

function serveAsset(res, packOrSubpath, fileName) {
  // Check if it is a directory subpath (e.g. ingame/battle/character/...)
  const directPath = path.resolve(assetsRoot, packOrSubpath, fileName);
  if (directPath.startsWith(`${assetsRoot}${path.sep}`) && fs.existsSync(directPath)) {
    serveDirectPath(res, directPath);
    return;
  }

  const directory = findPackDirectory(packOrSubpath);
  if (!directory) {
    safeJson(res, 404, { error: `Effect pack not found: ${packOrSubpath}` });
    return;
  }
  const filePath = path.resolve(directory, fileName);
  if (!filePath.startsWith(`${path.resolve(directory)}${path.sep}`) || !fs.existsSync(filePath)) {
    safeJson(res, 404, { error: `Asset not found: ${fileName}` });
    return;
  }
  serveDirectPath(res, filePath);
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, ngrok-skip-browser-warning, *',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Private-Network': 'true',
    });
    res.end();
    return;
  }

  const requestUrl = new URL(req.url || '/', `http://${req.headers.host || `${host}:${port}`}`);
  const requestOrigin = `http://${req.headers.host || `${host}:${port}`}`;

  if (requestUrl.pathname === '/health') {
    safeJson(res, 200, {
      ok: true,
      scripts: scriptIndex.size,
      assets_root: assetsRoot,
      database: databasePath,
    });
    return;
  }

  if (requestUrl.pathname === '/api/common') {
    const text = findCommonScript();
    safeJson(res, 200, { ok: Boolean(text), text });
    return;
  }

  if (requestUrl.pathname === '/api/se') {
    try {
      const wavPath = await decodeSoundCue(requestUrl.searchParams.get('cue'));
      serveDirectPath(res, wavPath);
    } catch (error) {
      safeJson(res, 404, { error: error.message });
    }
    return;
  }

  if (requestUrl.pathname === '/api/voice') {
    try {
      const wavPath = await decodeVoiceCue(
        requestUrl.searchParams.get('cue'),
        requestUrl.searchParams.get('package'),
      );
      serveDirectPath(res, wavPath);
    } catch (error) {
      safeJson(res, 404, { error: error.message });
    }
    return;
  }

  if (requestUrl.pathname.startsWith('/api/movie/')) {
    const effectId = decodeURIComponent(requestUrl.pathname.slice('/api/movie/'.length));
    try {
      const moviePath = await fetchConvertedMovie(effectId);
      serveDirectPath(res, moviePath);
    } catch (error) {
      safeJson(res, 502, { error: error.message });
    }
    return;
  }

  if (requestUrl.pathname.startsWith('/api/card/')) {
    const cardId = decodeURIComponent(requestUrl.pathname.slice('/api/card/'.length));
    try {
      const data = await cardPayload(cardId, requestOrigin);
      safeJson(res, data ? 200 : 404, data || { error: `Card not found: ${cardId}` });
    } catch (e) {
      safeJson(res, 500, { error: e.message });
    }
    return;
  }

  if (requestUrl.pathname.startsWith('/api/effect/')) {
    const effectId = decodeURIComponent(requestUrl.pathname.slice('/api/effect/'.length));
    try {
      const data = await effectPayload(effectId, requestOrigin);
      safeJson(res, data ? 200 : 404, data || { error: `Effect pack not found: ${effectId}` });
    } catch (e) {
      safeJson(res, 500, { error: e.message });
    }
    return;
  }

  if (requestUrl.pathname.startsWith('/api/level-bg/')) {
    const levelBgId = decodeURIComponent(requestUrl.pathname.slice('/api/level-bg/'.length));
    try {
      const data = await levelBgPayload(levelBgId, requestOrigin);
      safeJson(res, data ? 200 : 404, data || { error: `Battle background not found: ${levelBgId}` });
    } catch (error) {
      safeJson(res, 500, { error: error.message });
    }
    return;
  }

  if (requestUrl.pathname.startsWith('/api/script')) {
    let scriptName = requestUrl.searchParams.get('name') || requestUrl.searchParams.get('path') || '';
    if (!scriptName && requestUrl.pathname.startsWith('/api/script/')) {
      scriptName = decodeURIComponent(requestUrl.pathname.slice('/api/script/'.length));
    }
    const cleanName = path.basename(scriptName, '.lua').toLowerCase();
    const scriptPath = scriptIndex.get(cleanName);
    if (!scriptPath || !fs.existsSync(scriptPath)) {
      safeJson(res, 404, { error: `Lua script not found: ${scriptName}` });
      return;
    }
    const text = fs.readFileSync(scriptPath, 'utf8');
    safeJson(res, 200, {
      ok: true,
      name: scriptName,
      relative_path: path.relative(scriptsRoot, scriptPath).replaceAll('\\', '/'),
      text,
    });
    return;
  }

  if (requestUrl.pathname.startsWith('/api/animation/')) {
    const scriptName = decodeURIComponent(requestUrl.pathname.slice('/api/animation/'.length));
    if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(scriptName)) {
      safeJson(res, 400, { error: 'Invalid animation script name.' });
      return;
    }
    const payload = animationPayload(scriptName, requestOrigin);
    safeJson(res, payload ? 200 : 404, payload || { error: `Lua script not found: ${scriptName}` });
    return;
  }

  if (requestUrl.pathname.startsWith('/api/counters/')) {
    const cardId = decodeURIComponent(requestUrl.pathname.slice('/api/counters/'.length));
    if (!/^\d{6,9}$/.test(cardId)) {
      safeJson(res, 400, { error: 'Invalid card ID.' });
      return;
    }
    const payload = counterPayload(Number(cardId));
    safeJson(res, 200, payload || { card_id: Number(cardId), scripts: [] });
    return;
  }

  if (requestUrl.pathname === '/api/dot-characters') {
    safeJson(res, 200, dotCharacterPayload(requestOrigin));
    return;
  }

  if (requestUrl.pathname.startsWith('/assets/')) {
    const subPath = decodeURIComponent(requestUrl.pathname.slice('/assets/'.length));

    // Dot-character assets are stored outside assetsRoot in dotCharacterRoot.
    // Virtual paths from dotCharacterPayload always begin with "dot_character/".
    if (subPath.startsWith('dot_character/')) {
      const dotSubPath = subPath.slice('dot_character/'.length);
      const dotPath = path.resolve(dotCharacterRoot, dotSubPath);
      if (dotPath.startsWith(`${dotCharacterRoot}${path.sep}`) && fs.existsSync(dotPath) && fs.statSync(dotPath).isFile()) {
        serveDirectPath(res, dotPath);
        return;
      }
    }

    const directPath = path.resolve(assetsRoot, subPath);
    if (directPath.startsWith(`${assetsRoot}${path.sep}`) && fs.existsSync(directPath) && fs.statSync(directPath).isFile()) {
      serveDirectPath(res, directPath);
      return;
    }

    const cachedPath = await ensureLocalOrRemoteAsset(subPath);
    if (cachedPath && fs.existsSync(cachedPath)) {
      serveDirectPath(res, cachedPath);
      return;
    }

    const parts = subPath.split('/');
    if (parts.length === 2) {
      serveAsset(res, parts[0], parts[1]);
      return;
    }

    safeJson(res, 404, { error: `Asset not found: ${subPath}` });
    return;
  }

  safeJson(res, 404, { error: 'Not found.' });
});

server.listen(port, host, () => {
  console.log(`Dokkan animation bridge: http://${host}:${port}`);
  console.log(`Indexed ${scriptIndex.size} Lua scripts from ${scriptsRoot}`);
  console.log('Keep this window open while using animation previews in the card viewer.');
});
