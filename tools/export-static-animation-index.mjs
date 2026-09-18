#!/usr/bin/env node

/**
 * Static Animation Index Exporter for DokkanCustom.
 *
 * Generates versioned JSON metadata and manifest routing files for direct
 * static hosting on GitHub Pages / raw.githubusercontent.com.
 *
 * Each JSON response mirrors the payload returned by dokkan-animation-server.mjs,
 * but replaces local/server bridge endpoints with direct, absolute raw GitHub URLs
 * partitioned across:
 *   - DokkanCustom-animation-spfx-a (sp_effect_a0_* through sp_effect_a4_*)
 *   - DokkanCustom-animation-spfx-b (sp_effect_b1_* through sp_effect_b4_*)
 *   - DokkanCustom-animation-core   (sp_effect_a5-a9, effect, character, bg, lua, movie, audio)
 *   - DokkanCustom                  (card-art textures)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));

export const REPO_OWNER = 'abscustom';
export const REPO_INDEX = 'DokkanCustom-animation-index';
export const REPO_SPFX_A = 'DokkanCustom-animation-spfx-a';
export const REPO_SPFX_B = 'DokkanCustom-animation-spfx-b';
export const REPO_CORE = 'DokkanCustom-animation-core';
export const REPO_CARD_ART = 'DokkanCustom';

export const RAW_BASE = `https://raw.githubusercontent.com/${REPO_OWNER}`;
export const URL_INDEX = `${RAW_BASE}/${REPO_INDEX}/main`;
export const URL_SPFX_A = `${RAW_BASE}/${REPO_SPFX_A}/main/assets`;
export const URL_SPFX_B = `${RAW_BASE}/${REPO_SPFX_B}/main/assets`;
export const URL_CORE = `${RAW_BASE}/${REPO_CORE}/main/assets`;
export const URL_CARD_ART = `${RAW_BASE}/${REPO_CARD_ART}/main/assets`;

// Default directories
export const DEFAULT_CARDHUB_ROOT = 'C:\\Users\\Ruffy\\Desktop\\CardHub Console';
export const DEFAULT_INDEX_DIR = 'C:\\Users\\Ruffy\\Documents\\GitHub\\extra';
export const DEFAULT_ASSETS_ROOT = path.join(DEFAULT_CARDHUB_ROOT, 'local-hosting', 'assets');
export const DEFAULT_SCRIPTS_ROOT = path.join(DEFAULT_ASSETS_ROOT, 'lua', 'ab_script');
export const DEFAULT_PUBLIC_ASSETS = path.join(DEFAULT_CARDHUB_ROOT, 'staging', 'assets');
export const DEFAULT_DATABASE_PATH = path.join(DEFAULT_CARDHUB_ROOT, 'tools', 'database_decrypted.db');
export const DEFAULT_VGMSTREAM_PATH = path.join(DEFAULT_CARDHUB_ROOT, 'tools', 'vgmstream-win64', 'vgmstream-cli.exe');

// Routing logic
export function getAssetRepoForPath(relativePath) {
  const norm = relativePath.replaceAll('\\', '/').replace(/^\/+/, '');
  if (norm.startsWith('movie/') || norm.startsWith('lua/') || norm.startsWith('audio/') || norm.startsWith('se/') || norm.startsWith('voice/')) {
    return REPO_CORE;
  }
  const spMatch = norm.match(/(?:^|\/)sp_effect_(a[0-9]|b[1-9])_[^/]+/i);
  if (spMatch) {
    const group = spMatch[1].toLowerCase();
    if (group >= 'a0' && group <= 'a4') return REPO_SPFX_A;
    if (group >= 'b1' && group <= 'b4') return REPO_SPFX_B;
    return REPO_CORE;
  }
  return REPO_CORE;
}

export function routeAssetUrl(relativePath) {
  const norm = relativePath.replaceAll('\\', '/').replace(/^\/+/, '');

  if (norm.startsWith('card/') || norm.startsWith('card-art/')) {
    const sub = norm.startsWith('card/') ? `card-art/cards/${norm.slice(5)}` : norm;
    return `${URL_CARD_ART}/${sub}`;
  }

  if (norm.includes('/character/') && norm.includes('/idle/')) {
    return `${URL_CARD_ART}/${norm}`;
  }

  const repo = getAssetRepoForPath(norm);
  if (repo === REPO_SPFX_A) return `${URL_SPFX_A}/${norm}`;
  if (repo === REPO_SPFX_B) return `${URL_SPFX_B}/${norm}`;
  return `${URL_CORE}/${norm}`;
}

export function extractSheetNames(bytes) {
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

export function hasKoMarker(value) {
  const text = String(value || '').replace(/[‐‑‒–—]/g, '-');
  return /(?:^|[^A-Za-z0-9])K\s*[._-]?\s*O\.?\s*(?:$|[^A-Za-z0-9])|Ｋ\s*[．._-]?\s*[ＯO]|KOScreen|K\.O\.演出|KO演出/iu.test(text);
}

export class StaticAnimationExporter {
  constructor(options = {}) {
    this.outputDir = path.resolve(options.outputDir || DEFAULT_INDEX_DIR);
    this.cardhubRoot = path.resolve(options.cardhubRoot || DEFAULT_CARDHUB_ROOT);
    this.assetsRoot = path.resolve(options.assetsRoot || path.join(this.cardhubRoot, 'local-hosting', 'assets'));
    this.scriptsRoot = path.resolve(options.scriptsRoot || path.join(this.assetsRoot, 'lua', 'ab_script'));
    this.publicAssetsRoot = path.resolve(options.publicAssetsRoot || path.join(this.cardhubRoot, 'staging', 'assets'));
    this.databasePath = path.resolve(options.databasePath || path.join(this.cardhubRoot, 'tools', 'database_decrypted.db'));
    this.vgmstreamPath = path.resolve(options.vgmstreamPath || path.join(this.cardhubRoot, 'tools', 'vgmstream-win64', 'vgmstream-cli.exe'));
    this.dryRun = Boolean(options.dryRun);

    if (!fs.existsSync(this.databasePath)) throw new Error(`Database not found: ${this.databasePath}`);
    if (!fs.existsSync(this.assetsRoot)) throw new Error(`Assets root not found: ${this.assetsRoot}`);
    if (!fs.existsSync(this.scriptsRoot)) throw new Error(`Scripts root not found: ${this.scriptsRoot}`);

    this.db = new DatabaseSync(this.databasePath, { readOnly: true });

    this.effectById = this.db.prepare(`
      SELECT id, category, name, pack_name, scene_name, red, green, blue, alpha
      FROM effect_packs
      WHERE id = ?
    `);

    this.cardById = this.db.prepare(`
      SELECT c.id, c.name, c.character_id, c.special_motion, c.resource_id, c.aura_id, c.aura_scale,
             c.aura_offset_x, c.aura_offset_y, c.is_aura_front, c.bg_effect_id, ch.size AS character_size
      FROM cards c
      LEFT JOIN characters ch ON c.character_id = ch.id
      WHERE c.id = ?
    `);

    this.levelBgById = this.db.prepare('SELECT * FROM level_bgs WHERE id = ?');

    this.counterPassiveScripts = this.db.prepare(`
      SELECT ps.eff_value3 AS script_no
      FROM passive_skills ps
      INNER JOIN passive_skill_set_relations relation
        ON relation.passive_skill_id = ps.id
      WHERE relation.passive_skill_set_id = ?
        AND ps.efficacy_type IN (120, 128)
        AND ps.eff_value3 > 0
    `);

    this.nullificationPassiveScripts = this.db.prepare(`
      SELECT ps.eff_value3 AS script_no
      FROM passive_skills ps
      INNER JOIN passive_skill_set_relations relation
        ON relation.passive_skill_id = ps.id
      WHERE relation.passive_skill_set_id = ?
        AND ps.efficacy_type = 119
        AND ps.eff_value3 > 0
    `);

    this.scriptIndex = new Map();
    this.packDirectoryCache = new Map();
    this.counterScriptCards = new Map();

    this._indexScripts(this.scriptsRoot);
    this._indexCounterHeaders();
  }

  _indexScripts(folder) {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      const fullPath = path.join(folder, entry.name);
      if (entry.isDirectory()) this._indexScripts(fullPath);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith('.lua')) {
        this.scriptIndex.set(path.basename(entry.name, '.lua').toLowerCase(), fullPath);
      }
    }
  }

  _indexCounterHeaders() {
    for (const [scriptName, scriptPath] of this.scriptIndex) {
      if (!/[/\\]attack_counter[/\\]/i.test(scriptPath)) continue;
      const header = fs.readFileSync(scriptPath, 'utf8').slice(0, 1200);
      const cardIds = [...header.matchAll(/--\s*(\d{7,8})\s*[:：]/g)]
        .map((match) => Number(match[1]))
        .filter((id) => Number.isInteger(id) && id > 0);
      if (cardIds.length) this.counterScriptCards.set(scriptName, cardIds);
    }
  }

  findPackDirectory(packName) {
    if (this.packDirectoryCache.has(packName)) return this.packDirectoryCache.get(packName);
    const candidates = [
      path.join(this.assetsRoot, 'ingame', 'battle', 'sp_effect', packName, 'en'),
      path.join(this.assetsRoot, 'ingame', 'battle', 'sp_effect', packName),
      path.join(this.assetsRoot, 'ingame', 'battle', 'effect', packName, 'en'),
      path.join(this.assetsRoot, 'ingame', 'battle', 'effect', packName),
      path.join(this.assetsRoot, 'battle', packName),
    ];
    const found = candidates.find((c) => fs.existsSync(c) && fs.statSync(c).isDirectory()) || null;
    if (found) this.packDirectoryCache.set(packName, found);
    return found;
  }

  findMovieRelativePath(packName) {
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
      const full = path.join(this.assetsRoot, rel);
      if (fs.existsSync(full)) return rel.replaceAll('\\', '/');
    }
    return `movie/en/ingame/battle/sp_effect/${packName}.usm`;
  }

  listPackFiles(packName) {
    const directory = this.findPackDirectory(packName);
    if (!directory) return { available: false, files: [] };
    const relDir = path.relative(this.assetsRoot, directory).replaceAll('\\', '/');
    const files = fs.readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isFile() && /\.(?:lwf|png|jpe?g|webp)$/i.test(entry.name))
      .map((entry) => {
        const fileRel = `${relDir}/${entry.name}`;
        return {
          name: entry.name,
          url: routeAssetUrl(fileRel),
        };
      })
      .sort((a, b) => Number(!a.name.toLowerCase().endsWith('.lwf')) - Number(!b.name.toLowerCase().endsWith('.lwf')) || a.name.localeCompare(b.name));
    return { available: files.some((file) => file.name.toLowerCase().endsWith('.lwf')), files };
  }

  listCharacterLwfFiles(charaNum, subFolder) {
    const charaIdStr = String(charaNum).padStart(5, '0');
    const relDir = `ingame/battle/character/${charaIdStr}/${subFolder}`;
    const fullDir = path.join(this.assetsRoot, relDir);

    const lwfFileName = subFolder === 'battle'
      ? `battle_character_${charaIdStr}.lwf`
      : subFolder.startsWith('sp')
        ? `sp_character_${charaIdStr}_${subFolder.slice(2)}.lwf`
        : `idle_character_${charaIdStr}.lwf`;

    const lwfPath = path.join(fullDir, lwfFileName);
    if (!fs.existsSync(lwfPath)) return null;

    const existing = fs.readdirSync(fullDir, { withFileTypes: true })
      .filter((e) => e.isFile() && /\.(?:lwf|png)$/i.test(e.name))
      .map((e) => ({
        name: e.name,
        url: routeAssetUrl(`${relDir}/${e.name}`),
      }))
      .sort((a, b) => Number(!a.name.endsWith('.lwf')) - Number(!b.name.endsWith('.lwf')) || a.name.localeCompare(b.name));

    return {
      rel: relDir,
      url: routeAssetUrl(`${relDir}/${lwfFileName}`),
      files: existing,
    };
  }

  findCommonScript() {
    const candidates = [
      path.join(this.scriptsRoot, 'common', 'common.lua'),
      path.join(this.scriptsRoot, 'common.lua'),
    ];
    const found = candidates.find((c) => fs.existsSync(c));
    if (found) return fs.readFileSync(found, 'utf8');
    const fromIndex = this.scriptIndex.get('common');
    if (fromIndex && fs.existsSync(fromIndex)) return fs.readFileSync(fromIndex, 'utf8');
    return '';
  }

  extractEffectReferences(source) {
    const candidates = new Map();
    const assignments = new Map();

    const assignmentPattern = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(\d+)\s*;?\s*([^\r\n]*)\r?$/gm;
    for (const match of source.matchAll(assignmentPattern)) {
      assignments.set(match[1], {
        id: Number(match[2]),
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
      const isKo = Boolean(assignment?.isKo || hasKoMarker(token));
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
      const row = this.effectById.get(candidate.id);
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

  effectPayload(effectId) {
    const row = this.effectById.get(Number(effectId));
    if (!row?.pack_name || !row?.scene_name) return null;
    const movieRel = this.findMovieRelativePath(row.pack_name);
    const movieFullPath = path.join(this.assetsRoot, movieRel);
    const hasLocalMovie = fs.existsSync(movieFullPath);
    return {
      ...row,
      color: { red: row.red, green: row.green, blue: row.blue, alpha: row.alpha },
      movie_url: routeAssetUrl(movieRel),
      movie_fallback_url: null,
      movie_rel: movieRel,
      has_movie: hasLocalMovie,
      ...this.listPackFiles(row.pack_name),
    };
  }

  animationPayload(scriptName) {
    const scriptPath = this.scriptIndex.get(scriptName.toLowerCase());
    if (!scriptPath) return null;
    const source = fs.readFileSync(scriptPath, 'utf8');
    const commonSource = this.findCommonScript();
    const relScriptPath = path.relative(this.scriptsRoot, scriptPath).replaceAll('\\', '/');

    const effects = this.extractEffectReferences(source).map((effect, index) => {
      const movieRel = this.findMovieRelativePath(effect.pack_name);
      const movieFullPath = path.join(this.assetsRoot, movieRel);
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
        movie_url: routeAssetUrl(movieRel),
        movie_fallback_url: null,
        movie_rel: movieRel,
        has_movie: hasLocalMovie,
        ...this.listPackFiles(effect.pack_name),
      };
    });

    const frameValues = [...source.matchAll(/\b(?:MAX_FRAME(?:_\d+)?|endPhase)\s*(?:\([^,]+,)?\s*=*\s*(\d+)/g)]
      .map((match) => Number(match[1]))
      .filter(Number.isFinite);

    const audioUrls = {};
    for (const m of source.matchAll(/(?:playSe(?:Life|Ver2)?\s*\(\s*(\d+)|SE_\w+\s*=\s*(\d+))/g)) {
      const cueId = Number(m[1] || m[2]);
      if (Number.isInteger(cueId) && cueId > 0) {
        audioUrls[`se:${cueId}`] = `${URL_CORE}/audio/se/se_${cueId}.wav`;
      }
    }

    return {
      script_name: scriptName,
      script_type: path.basename(path.dirname(scriptPath)).replaceAll('_', ' '),
      relative_script_path: relScriptPath,
      script_url: routeAssetUrl(`lua/ab_script/${relScriptPath}`),
      max_frame_hint: frameValues.length ? Math.max(...frameValues) : null,
      lua_source: source,
      common_source: commonSource,
      effects,
      audio_urls: audioUrls,
    };
  }

  cardPayload(cardId) {
    const id = Number(cardId);
    if (!id) return null;
    const row = this.cardById.get(id);
    if (!row) return null;

    const charaNum = row.character_id || 1;
    const spMotionNum = row.special_motion || 1;
    const spStr = `sp${String(spMotionNum).padStart(2, '0')}`;

    const battle = this.listCharacterLwfFiles(charaNum, 'battle');
    const sp = this.listCharacterLwfFiles(charaNum, spStr);
    const idle = this.listCharacterLwfFiles(charaNum, 'idle');

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
      const cardDir = path.join(this.publicAssetsRoot, 'card', String(cId));
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
              url: `${URL_CARD_ART}/card-art/cards/${cId}/${relPrefix}${encodeURIComponent(f)}`,
            };
          }
        }
      };
      scanDir(cardDir);
    }

    let aura = null;
    if (row.aura_id) {
      const auraEffectId = 349 + row.aura_id;
      const auraEffect = this.effectPayload(auraEffectId);
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
      id,
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

  counterPayload(cardId) {
    const raw = Number(cardId);
    if (!Number.isInteger(raw) || raw <= 0) return null;
    const candidates = new Set([raw]);
    if (raw % 10 === 1) candidates.add(raw - 1);
    if (raw >= 10_000_000) {
      const base = Math.floor(raw / 10);
      candidates.add(base);
      candidates.add(base - 1);
    }
    const candidateList = [...candidates].filter((id) => id > 0);
    if (!candidateList.length) return null;

    const records = [];
    const seen = new Set();
    const add = (scriptName, source, kind = 'counter') => {
      const normalized = String(scriptName || '').toLowerCase();
      if (!/^(?:c|as)\d{4}$/i.test(normalized) || !this.scriptIndex.has(normalized) || seen.has(normalized)) return;
      seen.add(normalized);
      records.push({ script_name: normalized, source, kind });
    };

    for (const [scriptName, scriptedCards] of this.counterScriptCards) {
      if (scriptedCards.some((id) => candidateList.includes(id))) add(scriptName, 'lua-card-header', 'counter');
    }

    const cardPlaceholders = candidateList.map(() => '?').join(', ');
    const cards = this.db.prepare(`
      SELECT DISTINCT id, passive_skill_set_id
      FROM cards
      WHERE id IN (${cardPlaceholders}) OR resource_id IN (${cardPlaceholders})
    `).all(...candidateList, ...candidateList);

    for (const card of cards) {
      for (const row of this.counterPassiveScripts.all(Number(card.passive_skill_set_id) || 0)) {
        const suffix = Number(row.script_no);
        if (Number.isInteger(suffix) && suffix > 0) add(`c${String(suffix).padStart(4, '0')}`, 'passive-effect', 'counter');
      }
      for (const row of this.nullificationPassiveScripts.all(Number(card.passive_skill_set_id) || 0)) {
        const suffix = Number(row.script_no);
        if (Number.isInteger(suffix) && suffix > 0) add(`as${String(suffix).padStart(4, '0')}`, 'passive-nullification', 'nullification');
      }
    }

    return { card_id: Number(cardId), scripts: records };
  }

  levelBgPayload(levelBgId) {
    const id = Number(levelBgId);
    if (!id) return null;
    const row = this.levelBgById.get(id);
    if (!row) return null;

    const padded = String(id).padStart(5, '0');
    const folderName = `battle_bg_${padded}`;
    const relativeFolder = `ingame/battle/bg/${folderName}`;
    const layers = [];
    for (let index = 1; index <= 4; index += 1) {
      const enabled = Boolean(row[`bg${index}_enable`]);
      const relativePath = `${relativeFolder}/${folderName}_${String(index).padStart(2, '0')}.png`;
      layers.push({
        index,
        enabled,
        coef: Number(row[`bg${index}_coef`]) || 0,
        flip_disable: Boolean(row[`bg${index}_flip_disable`]),
        effect_enable: Boolean(row[`bg${index}_effect_enable`]),
        effect_name: row[`bg${index}_effect_name`] && row[`bg${index}_effect_name`] !== '0'
          ? row[`bg${index}_effect_name`]
          : null,
        rel: relativePath,
        url: enabled ? routeAssetUrl(relativePath) : null,
      });
    }

    let lwf = null;
    if (layers.some((layer) => layer.effect_enable)) {
      const lwfRelativePath = `${relativeFolder}/${folderName}.lwf`;
      const lwfFullPath = path.join(this.assetsRoot, lwfRelativePath);
      if (fs.existsSync(lwfFullPath)) {
        lwf = {
          rel: lwfRelativePath,
          url: routeAssetUrl(lwfRelativePath),
          bytes: fs.statSync(lwfFullPath).size,
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

  writeJsonFile(relSubPath, data) {
    const target = path.join(this.outputDir, relSubPath);
    if (this.dryRun) {
      console.log(`[DRY-RUN] Write ${target}`);
      return;
    }
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, JSON.stringify(data, null, 2), 'utf8');
    console.log(`Wrote ${relSubPath}`);
  }

  exportManifests() {
    const assetRoots = {
      version: 1,
      indexBase: URL_INDEX,
      roots: {
        'spfx-a': {
          prefix: 'assets/ingame/battle/sp_effect/sp_effect_a[0-4]_',
          baseUrl: URL_SPFX_A,
        },
        'spfx-b': {
          prefix: 'assets/ingame/battle/sp_effect/sp_effect_b[1-4]_',
          baseUrl: URL_SPFX_B,
        },
        'core': {
          prefix: '*',
          baseUrl: URL_CORE,
        },
        'card-art': {
          prefix: 'assets/card-art/',
          baseUrl: URL_CARD_ART,
        },
      },
    };
    this.writeJsonFile('manifest/asset-roots.json', assetRoots);

    const version = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      assetRoots: 'manifest/asset-roots.json',
      repositories: {
        index: REPO_INDEX,
        spfxA: REPO_SPFX_A,
        spfxB: REPO_SPFX_B,
        core: REPO_CORE,
      },
    };
    this.writeJsonFile('manifest/version.json', version);
  }

  exportScript(scriptName) {
    const payload = this.animationPayload(scriptName);
    if (!payload) {
      console.warn(`Animation script not found: ${scriptName}`);
      return false;
    }
    this.writeJsonFile(`api/animation/${scriptName}.json`, payload);
    for (const effect of payload.effects || []) {
      this.exportEffect(effect.id);
    }
    return true;
  }

  exportEffect(effectId) {
    const effPayload = this.effectPayload(effectId);
    if (!effPayload) return false;
    this.writeJsonFile(`api/effect/${effectId}.json`, effPayload);
    return true;
  }

  exportAllEffects(onlyMissing = false) {
    const rows = this.db.prepare('SELECT id FROM effect_packs').all();
    let count = 0;
    for (const r of rows) {
      if (onlyMissing && fs.existsSync(path.join(this.outputDir, 'api', 'effect', `${r.id}.json`))) {
        continue;
      }
      if (this.exportEffect(r.id)) {
        count++;
      }
    }
    console.log(`Exported ${count} effect packs.`);
    return count;
  }


  exportCard(cardId) {
    const cardData = this.cardPayload(cardId);
    if (!cardData) {
      console.warn(`Card not found: ${cardId}`);
      return false;
    }
    this.writeJsonFile(`api/card/${cardId}.json`, cardData);

    const counterData = this.counterPayload(cardId);
    this.writeJsonFile(`api/counters/${cardId}.json`, counterData || { card_id: Number(cardId), scripts: [] });
    return true;
  }

  exportLevelBg(bgId) {
    const bgData = this.levelBgPayload(bgId);
    if (!bgData) {
      console.warn(`Background not found: ${bgId}`);
      return false;
    }
    this.writeJsonFile(`api/level-bg/${bgId}.json`, bgData);
    return true;
  }
}

// CLI execution
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--script' && args[i + 1]) flags.script = args[++i];
    else if (args[i] === '--card' && args[i + 1]) flags.card = args[++i];
    else if (args[i] === '--bg' && args[i + 1]) flags.bg = args[++i];
    else if (args[i] === '--out' && args[i + 1]) flags.out = args[++i];
    else if (args[i] === '--all') flags.all = true;
    else if (args[i] === '--all-effects') flags.allEffects = true;
    else if (args[i] === '--dry-run') flags.dryRun = true;
  }

  const exporter = new StaticAnimationExporter({
    outputDir: flags.out || DEFAULT_INDEX_DIR,
    dryRun: flags.dryRun,
  });

  console.log(`Initialized exporter targeting: ${exporter.outputDir}`);
  exporter.exportManifests();

  if (flags.allEffects) {
    console.log('Exporting all missing effect manifests...');
    exporter.exportAllEffects(true);
  }

  if (flags.script) {
    const scripts = flags.script.split(',').map((s) => s.trim()).filter(Boolean);
    for (const script of scripts) {
      console.log(`Exporting animation script: ${script}`);
      exporter.exportScript(script);
    }
  }

  if (flags.card) {
    const cards = flags.card.split(',').map((c) => c.trim()).filter(Boolean);
    for (const card of cards) {
      console.log(`Exporting card: ${card}`);
      exporter.exportCard(card);
    }
  }

  if (flags.bg) {
    console.log(`Exporting level-bg: ${flags.bg}`);
    exporter.exportLevelBg(flags.bg);
  }

  if (flags.all) {
    console.log('Exporting all scripts, cards, and backgrounds...');
    for (const scriptName of exporter.scriptIndex.keys()) {
      exporter.exportScript(scriptName);
    }
    const allCards = exporter.db.prepare('SELECT id FROM cards').all();
    for (const row of allCards) {
      exporter.exportCard(row.id);
    }
    const allBgs = exporter.db.prepare('SELECT id FROM level_bgs').all();
    for (const row of allBgs) {
      exporter.exportLevelBg(row.id);
    }
  }

  console.log('Export finished successfully.');
}
