#!/usr/bin/env node

/**
 * Asset repository partition and synchronizer for DokkanCustom live animation.
 *
 * Copies extracted assets from CardHub Console `local-hosting/assets` into the
 * three dedicated public GitHub asset repositories:
 *   1. DokkanCustom-animation-spfx-a (sp_effect_a0_* to a4_*)
 *   2. DokkanCustom-animation-spfx-b (sp_effect_b1_* to b4_*)
 *   3. DokkanCustom-animation-core   (sp_effect_a5-a9, effect, character excluding idle, bg, lua, movie, audio)
 *
 * Keeps original game-relative paths under `assets/`.
 * Supports `--script <name> --card <id>` for single-attack test slices and `--all` for full sync.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { getAssetRepoForPath } from './export-static-animation-index.mjs';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));

export const DEFAULT_CARDHUB_ROOT = 'C:\\Users\\Ruffy\\Desktop\\CardHub Console';
export const DEFAULT_GITHUB_ROOT = 'C:\\Users\\Ruffy\\Documents\\GitHub';
export const DEFAULT_ASSETS_ROOT = path.join(DEFAULT_CARDHUB_ROOT, 'local-hosting', 'assets');
export const DEFAULT_CACHE_SE_ROOT = path.join(DEFAULT_CARDHUB_ROOT, 'local-hosting', 'cache', 'audio', 'se');

export const REPO_PATHS = {
  'DokkanCustom-animation-spfx-a': path.join(DEFAULT_GITHUB_ROOT, 'DokkanCustom-animation-spfx-a'),
  'DokkanCustom-animation-spfx-b': path.join(DEFAULT_GITHUB_ROOT, 'DokkanCustom-animation-spfx-b'),
  'DokkanCustom-animation-core': path.join(DEFAULT_GITHUB_ROOT, 'DokkanCustom-animation-core'),
};

const ALLOWED_EXTS = new Set(['.lwf', '.png', '.jpg', '.jpeg', '.webp', '.lua', '.usm', '.acb', '.awb', '.wav', '.json']);

export function shouldCopyFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (!ALLOWED_EXTS.has(ext)) return false;
  const norm = filePath.replaceAll('\\', '/').toLowerCase();
  if (norm.includes('/character/') && norm.includes('/idle/')) return false;
  if (norm.endsWith('.cpk') || norm.endsWith('.tmp')) return false;
  return true;
}

export function copyAssetFile(sourceFullPath, assetsRoot, repoPaths, dryRun = false) {
  if (!shouldCopyFile(sourceFullPath)) return null;
  const rel = path.relative(assetsRoot, sourceFullPath).replaceAll('\\', '/');
  const targetRepo = getAssetRepoForPath(rel);
  const repoDir = repoPaths[targetRepo];
  if (!repoDir) return null;

  const destFullPath = path.join(repoDir, 'assets', rel);
  if (dryRun) {
    console.log(`[DRY-RUN] Copy ${rel} -> ${targetRepo}`);
    return { rel, targetRepo, bytes: fs.statSync(sourceFullPath).size };
  }

  fs.mkdirSync(path.dirname(destFullPath), { recursive: true });
  fs.copyFileSync(sourceFullPath, destFullPath);
  return { rel, targetRepo, bytes: fs.statSync(sourceFullPath).size };
}

export function copyAssetFolder(sourceDir, assetsRoot, repoPaths, dryRun = false) {
  if (!fs.existsSync(sourceDir)) return [];
  const copied = [];
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        const norm = full.replaceAll('\\', '/').toLowerCase();
        if (norm.includes('/character/') && norm.endsWith('/idle')) continue;
        walk(full);
      } else if (entry.isFile()) {
        const res = copyAssetFile(full, assetsRoot, repoPaths, dryRun);
        if (res) copied.push(res);
      }
    }
  };
  walk(sourceDir);
  return copied;
}

export class AssetPartitioner {
  constructor(options = {}) {
    this.cardhubRoot = path.resolve(options.cardhubRoot || DEFAULT_CARDHUB_ROOT);
    this.assetsRoot = path.resolve(options.assetsRoot || path.join(this.cardhubRoot, 'local-hosting', 'assets'));
    this.githubRoot = path.resolve(options.githubRoot || DEFAULT_GITHUB_ROOT);
    this.cacheSeRoot = path.resolve(options.cacheSeRoot || path.join(this.cardhubRoot, 'local-hosting', 'cache', 'audio', 'se'));
    this.dryRun = Boolean(options.dryRun);

    this.repoPaths = {
      'DokkanCustom-animation-spfx-a': path.join(this.githubRoot, 'DokkanCustom-animation-spfx-a'),
      'DokkanCustom-animation-spfx-b': path.join(this.githubRoot, 'DokkanCustom-animation-spfx-b'),
      'DokkanCustom-animation-core': path.join(this.githubRoot, 'DokkanCustom-animation-core'),
    };

    for (const [name, p] of Object.entries(this.repoPaths)) {
      if (!fs.existsSync(p)) {
        throw new Error(`Target repository folder does not exist: ${p} (${name})`);
      }
    }
  }

  syncScriptSlice(scriptName, cardId) {
    console.log(`Syncing minimal slice for script: ${scriptName}, card: ${cardId}`);
    const results = [];

    // 1. Lua script
    const luaRel = `lua/ab_script/attack_sp/${scriptName}.lua`;
    let luaFull = path.join(this.assetsRoot, luaRel);
    if (!fs.existsSync(luaFull)) {
      // search
      const walk = (d) => {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
          const f = path.join(d, e.name);
          if (e.isDirectory()) walk(f);
          else if (e.name.toLowerCase() === `${scriptName.toLowerCase()}.lua`) luaFull = f;
        }
      };
      walk(path.join(this.assetsRoot, 'lua'));
    }
    if (fs.existsSync(luaFull)) {
      const res = copyAssetFile(luaFull, this.assetsRoot, this.repoPaths, this.dryRun);
      if (res) results.push(res);
    }
    // Common script
    const commonPath = path.join(this.assetsRoot, 'lua', 'ab_script', 'common', 'common.lua');
    if (fs.existsSync(commonPath)) {
      const res = copyAssetFile(commonPath, this.assetsRoot, this.repoPaths, this.dryRun);
      if (res) results.push(res);
    }

    // 2. Character battle & spXX rigs
    if (cardId) {
      const dbPath = path.join(this.cardhubRoot, 'tools', 'database_decrypted.db');
      const db = new DatabaseSync(dbPath, { readOnly: true });
      const card = db.prepare('SELECT character_id, special_motion FROM cards WHERE id = ?').get(Number(cardId));
      if (card) {
        const charaStr = String(card.character_id).padStart(5, '0');
        const charaBaseDir = path.join(this.assetsRoot, 'ingame', 'battle', 'character', charaStr);
        if (fs.existsSync(charaBaseDir)) {
          for (const entry of fs.readdirSync(charaBaseDir, { withFileTypes: true })) {
            if (entry.isDirectory() && entry.name.toLowerCase() !== 'idle') {
              results.push(...copyAssetFolder(path.join(charaBaseDir, entry.name), this.assetsRoot, this.repoPaths, this.dryRun));
            }
          }
        }
      }
    }

    // 3. Effects referenced in Lua
    if (fs.existsSync(luaFull)) {
      const content = fs.readFileSync(luaFull, 'utf8');
      const dbPath = path.join(this.cardhubRoot, 'tools', 'database_decrypted.db');
      const db = new DatabaseSync(dbPath, { readOnly: true });
      const effById = db.prepare('SELECT pack_name FROM effect_packs WHERE id = ?');

      const packNames = new Set();
      for (const m of content.matchAll(/\b(?:entryEffect(?:Life|Unpausable|Attach|Sub)?|setupMovie)\s*\([^,]+,\s*(\d+)/g)) {
        const effId = Number(m[1]);
        const row = effById.get(effId);
        if (row?.pack_name) packNames.add(row.pack_name);
      }
      for (const m of content.matchAll(/(?:SP_\d+|eff_\w+)\s*=\s*(\d+)/g)) {
        const effId = Number(m[1]);
        const row = effById.get(effId);
        if (row?.pack_name) packNames.add(row.pack_name);
      }

      for (const pack of packNames) {
        const candidates = [
          path.join(this.assetsRoot, 'ingame', 'battle', 'sp_effect', pack),
          path.join(this.assetsRoot, 'ingame', 'battle', 'effect', pack),
          path.join(this.assetsRoot, 'battle', pack),
        ];
        for (const dir of candidates) {
          if (fs.existsSync(dir)) {
            results.push(...copyAssetFolder(dir, this.assetsRoot, this.repoPaths, this.dryRun));
          }
        }

        const movieCandidates = [
          path.join(this.assetsRoot, 'movie', 'en', 'ingame', 'battle', 'sp_effect', `${pack}.usm`),
          path.join(this.assetsRoot, 'movie', 'en', 'ingame', 'battle', 'sp_effect', pack, `${pack}.usm`),
          path.join(this.assetsRoot, 'movie', 'en', 'ingame', 'battle', 'effect', `${pack}.usm`),
          path.join(this.assetsRoot, 'movie', 'en', 'ingame', 'battle', 'effect', pack, `${pack}.usm`),
          path.join(this.assetsRoot, 'movie', 'ingame', 'battle', 'sp_effect', `${pack}.usm`),
          path.join(this.assetsRoot, 'movie', 'ingame', 'battle', 'sp_effect', pack, `${pack}.usm`),
          path.join(this.assetsRoot, 'movie', 'ingame', 'battle', 'effect', `${pack}.usm`),
          path.join(this.assetsRoot, 'movie', 'ingame', 'battle', 'effect', pack, `${pack}.usm`),
        ];
        for (const mov of movieCandidates) {
          if (fs.existsSync(mov)) {
            const res = copyAssetFile(mov, this.assetsRoot, this.repoPaths, this.dryRun);
            if (res) results.push(res);
          }
        }
      }

      // 4. Sound cues
      for (const m of content.matchAll(/(?:playSe(?:Life|Ver2)?\s*\(\s*(\d+)|SE_\w+\s*=\s*(\d+))/g)) {
        const cueId = Number(m[1] || m[2]);
        if (Number.isInteger(cueId) && cueId > 0) {
          const wavName = `se_${cueId}.wav`;
          // Check in cache
          const cachedWav = path.join(this.cacheSeRoot, wavName);
          const cachedWavV2 = path.join(this.cacheSeRoot, 'cue-index-v2', wavName);
          const srcWav = fs.existsSync(cachedWavV2) ? cachedWavV2 : (fs.existsSync(cachedWav) ? cachedWav : null);
          if (srcWav) {
            const dest = path.join(this.repoPaths['DokkanCustom-animation-core'], 'assets', 'audio', 'se', wavName);
            if (!this.dryRun) {
              fs.mkdirSync(path.dirname(dest), { recursive: true });
              fs.copyFileSync(srcWav, dest);
            }
            results.push({ rel: `audio/se/${wavName}`, targetRepo: 'DokkanCustom-animation-core', bytes: fs.statSync(srcWav).size });
          }
        }
      }
    }

    // 5. Battle background 1 (sample)
    const bg1Dir = path.join(this.assetsRoot, 'ingame', 'battle', 'bg', 'battle_bg_00001');
    if (fs.existsSync(bg1Dir)) {
      results.push(...copyAssetFolder(bg1Dir, this.assetsRoot, this.repoPaths, this.dryRun));
    }

    console.log(`Copied ${results.length} files in slice.`);
    return results;
  }

  syncAll() {
    console.log('Starting full asset partition across 3 repositories...');
    const results = [];

    // ingame/battle/sp_effect -> partitioned to spfx-a, spfx-b, or core
    const spDir = path.join(this.assetsRoot, 'ingame', 'battle', 'sp_effect');
    if (fs.existsSync(spDir)) {
      console.log('Partitioning sp_effect...');
      results.push(...copyAssetFolder(spDir, this.assetsRoot, this.repoPaths, this.dryRun));
    }

    // ingame/battle/effect -> core
    const effDir = path.join(this.assetsRoot, 'ingame', 'battle', 'effect');
    if (fs.existsSync(effDir)) {
      console.log('Partitioning effect...');
      results.push(...copyAssetFolder(effDir, this.assetsRoot, this.repoPaths, this.dryRun));
    }

    // ingame/battle/character -> core (excluding idle)
    const charaDir = path.join(this.assetsRoot, 'ingame', 'battle', 'character');
    if (fs.existsSync(charaDir)) {
      console.log('Partitioning character (excluding idle)...');
      results.push(...copyAssetFolder(charaDir, this.assetsRoot, this.repoPaths, this.dryRun));
    }

    // ingame/battle/bg -> core
    const bgDir = path.join(this.assetsRoot, 'ingame', 'battle', 'bg');
    if (fs.existsSync(bgDir)) {
      console.log('Partitioning bg...');
      results.push(...copyAssetFolder(bgDir, this.assetsRoot, this.repoPaths, this.dryRun));
    }

    // lua -> core
    const luaDir = path.join(this.assetsRoot, 'lua');
    if (fs.existsSync(luaDir)) {
      console.log('Partitioning lua...');
      results.push(...copyAssetFolder(luaDir, this.assetsRoot, this.repoPaths, this.dryRun));
    }

    // movie -> core
    const movieDir = path.join(this.assetsRoot, 'movie');
    if (fs.existsSync(movieDir)) {
      console.log('Partitioning movie...');
      results.push(...copyAssetFolder(movieDir, this.assetsRoot, this.repoPaths, this.dryRun));
    }

    // se and voice -> core
    for (const folder of ['se', 'voice']) {
      const audioDir = path.join(this.assetsRoot, folder);
      if (fs.existsSync(audioDir)) {
        console.log(`Partitioning ${folder}...`);
        results.push(...copyAssetFolder(audioDir, this.assetsRoot, this.repoPaths, this.dryRun));
      }
    }

    // cached decoded WAVs -> core assets/audio/se
    if (fs.existsSync(this.cacheSeRoot)) {
      console.log('Partitioning decoded WAV sound effects...');
      const walkWav = (d) => {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
          const f = path.join(d, e.name);
          if (e.isDirectory()) walkWav(f);
          else if (e.isFile() && e.name.toLowerCase().endsWith('.wav')) {
            const dest = path.join(this.repoPaths['DokkanCustom-animation-core'], 'assets', 'audio', 'se', e.name);
            if (!this.dryRun) {
              fs.mkdirSync(path.dirname(dest), { recursive: true });
              fs.copyFileSync(f, dest);
            }
            results.push({ rel: `audio/se/${e.name}`, targetRepo: 'DokkanCustom-animation-core', bytes: fs.statSync(f).size });
          }
        }
      };
      walkWav(this.cacheSeRoot);
    }

    console.log(`Full partition complete! Copied ${results.length} total files.`);
    return results;
  }
}

// CLI execution
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--script' && args[i + 1]) flags.script = args[++i];
    else if (args[i] === '--card' && args[i + 1]) flags.card = args[++i];
    else if (args[i] === '--all') flags.all = true;
    else if (args[i] === '--dry-run') flags.dryRun = true;
  }

  const partitioner = new AssetPartitioner({ dryRun: flags.dryRun });

  if (flags.script) {
    const scripts = flags.script.split(',').map((s) => s.trim()).filter(Boolean);
    for (const script of scripts) {
      partitioner.syncScriptSlice(script, flags.card);
    }
  } else if (flags.all) {
    partitioner.syncAll();
  } else {
    console.log('Usage: node sync-animation-asset-repos.mjs [--script <name> --card <id>] | [--all] [--dry-run]');
  }
}
