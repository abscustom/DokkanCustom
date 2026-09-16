#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDirectory, '..');
const localRoot = process.env.DOKKAN_LOCAL_ROOT
  ? path.resolve(process.env.DOKKAN_LOCAL_ROOT)
  : path.resolve(repoRoot, '..', '..', '..', 'Desktop', 'cardhub v2');
const luaRoot = process.env.DOKKAN_LUA_ROOT
  ? path.resolve(process.env.DOKKAN_LUA_ROOT)
  : path.join(localRoot, 'assets', 'lua', 'ab_script');
const databasePath = process.env.DOKKAN_DATABASE_PATH
  ? path.resolve(process.env.DOKKAN_DATABASE_PATH)
  : path.join(localRoot, 'tools', 'database_decrypted.db');
const outputPath = process.env.DOKKAN_KO_INDEX_OUTPUT
  ? path.resolve(process.env.DOKKAN_KO_INDEX_OUTPUT)
  : path.join(repoRoot, 'json', 'ko_screen_index.json');

function hasKoMarker(value) {
  const text = String(value || '').replace(/[‐‑‒–—]/g, '-');
  return /(?:^|[^A-Za-z0-9])K\s*[._-]?\s*O\.?\s*(?:$|[^A-Za-z0-9])|Ｋ\s*[．._-]?\s*[ＯO]|KOScreen|K\.O\.演出|KO演出/iu.test(text);
}

function findKoEffectIds(source) {
  const assignments = new Map();
  // Support both semicolon-terminated declarations and the common Lua form
  // without a semicolon so comments such as `-- KO` remain detectable.
  const assignmentPattern = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(\d+)\s*;?\s*([^\r\n]*)\r?$/gm;
  for (const match of source.matchAll(assignmentPattern)) {
    assignments.set(match[1], {
      id: Number(match[2]),
      isKo: hasKoMarker(match[1]) || hasKoMarker(match[3]),
    });
  }

  const koEffectIds = new Set();
  const effectCallPattern = /\b(setupMovie|entryEffect(?:Life|Unpausable|Attach|Sub)?)\s*\(([^)]*)\)/g;
  for (const match of source.matchAll(effectCallPattern)) {
    const token = match[2].split(',').map((part) => part.trim())[1];
    const assignment = assignments.get(token);
    const effectId = /^\d+$/.test(token || '') ? Number(token) : assignment?.id;
    const nearbySource = source.slice(Math.max(0, match.index - 180), match.index);
    const isKo = assignment?.isKo || hasKoMarker(token) || hasKoMarker(nearbySource);
    if (effectId && isKo) koEffectIds.add(effectId);
  }

  return koEffectIds;
}

function collectLuaFiles(directory, results = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) collectLuaFiles(fullPath, results);
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.lua')) results.push(fullPath);
  }
  return results;
}

function addCardScript(cardScripts, cardId, scriptName) {
  const numericId = Number(cardId);
  if (!Number.isFinite(numericId) || numericId <= 0) return;

  const ids = [numericId];
  if (numericId >= 10_000_000) ids.push(Math.floor(numericId / 10));
  for (const id of ids) {
    const key = String(id);
    const scripts = cardScripts.get(key) || new Set();
    scripts.add(scriptName);
    cardScripts.set(key, scripts);
  }
}

function readMappedSpecialViews(database) {
  const queries = [
    `SELECT cs.card_id, sv.script_name
       FROM card_specials cs
       JOIN special_views sv ON sv.id = cs.view_id
      UNION
     SELECT cs.card_id, sv.script_name
       FROM card_specials cs
       JOIN special_views sv ON sv.id = cs.bonus_view_id1
      UNION
     SELECT cs.card_id, sv.script_name
       FROM card_specials cs
       JOIN special_views sv ON sv.id = cs.bonus_view_id2`,
    `SELECT cas.card_id, sv.script_name
       FROM card_active_skills cas
       JOIN active_skill_sets skill ON skill.id = cas.active_skill_set_id
       JOIN special_views sv ON sv.id = skill.special_view_id
      UNION
     SELECT cas.card_id, sv.script_name
       FROM card_active_skills cas
       JOIN active_skill_sets skill ON skill.id = cas.active_skill_set_id
       JOIN special_views sv ON sv.id = skill.costume_special_view_id`,
    `SELECT relation.card_id, sv.script_name
       FROM card_finish_skill_set_relations relation
       JOIN finish_skill_sets skill ON skill.id = relation.finish_skill_set_id
       JOIN special_views sv ON sv.id = skill.special_view_id
      UNION
     SELECT relation.card_id, sv.script_name
       FROM card_finish_skill_set_relations relation
       JOIN finish_skill_sets skill ON skill.id = relation.finish_skill_set_id
       JOIN special_views sv ON sv.id = skill.costume_special_view_id`,
    `SELECT card_standby.card_id, sv.script_name
       FROM card_standby_skill_set_relations card_standby
       JOIN standby_skill_set_finish_skill_set_relations standby_finish
         ON standby_finish.standby_skill_set_id = card_standby.standby_skill_set_id
       JOIN finish_skill_sets skill ON skill.id = standby_finish.finish_skill_set_id
       JOIN special_views sv ON sv.id = skill.special_view_id
      UNION
     SELECT card_standby.card_id, sv.script_name
       FROM card_standby_skill_set_relations card_standby
       JOIN standby_skill_set_finish_skill_set_relations standby_finish
         ON standby_finish.standby_skill_set_id = card_standby.standby_skill_set_id
       JOIN finish_skill_sets skill ON skill.id = standby_finish.finish_skill_set_id
       JOIN special_views sv ON sv.id = skill.costume_special_view_id`,
  ];

  return queries.flatMap((query) => database.prepare(query).all());
}

if (!fs.existsSync(luaRoot)) throw new Error(`Lua directory not found: ${luaRoot}`);
if (!fs.existsSync(databasePath)) throw new Error(`Dokkan database not found: ${databasePath}`);

const database = new DatabaseSync(databasePath, { readOnly: true });
const playableEffectIds = new Set(database.prepare(`
  SELECT id
    FROM effect_packs
   WHERE pack_name IS NOT NULL
     AND pack_name <> ''
     AND scene_name IS NOT NULL
     AND scene_name <> ''
`).all().map((row) => Number(row.id)));

const koScripts = new Set();
for (const luaPath of collectLuaFiles(luaRoot)) {
  const source = fs.readFileSync(luaPath, 'utf8');
  const koEffectIds = findKoEffectIds(source);
  if ([...koEffectIds].some((effectId) => playableEffectIds.has(effectId))) {
    koScripts.add(path.basename(luaPath, '.lua').toLowerCase());
  }
}

const cardScripts = new Map();
for (const row of readMappedSpecialViews(database)) {
  const scriptName = String(row.script_name || '').trim().toLowerCase();
  if (koScripts.has(scriptName)) addCardScript(cardScripts, row.card_id, scriptName);
}
database.close();

const cards = Object.fromEntries(
  [...cardScripts.entries()]
    .sort(([first], [second]) => Number(first) - Number(second))
    .map(([cardId, scripts]) => [cardId, [...scripts].sort()]),
);
const output = {
  schema_version: 1,
  generated_at: new Date().toISOString(),
  card_ids: Object.keys(cards),
  scripts: [...koScripts].sort(),
  cards,
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(`KO screen index: ${output.card_ids.length} cards, ${output.scripts.length} scripts`);
console.log(`Written to ${outputPath}`);
