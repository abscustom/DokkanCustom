import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const projectRoot = path.resolve(import.meta.dirname, '..');
const defaultDatabase = 'C:/Users/Ruffy/Desktop/cardhub v2/tools/database_decrypted.db';
const databasePath = path.resolve(process.argv[2] || process.env.DOKKAN_DATABASE || defaultDatabase);
const outputPath = path.resolve(
  process.argv[3] || path.join(projectRoot, 'json', 'passive_skill_effect_views.json'),
);

if (!fs.existsSync(databasePath)) {
  throw new Error(`Dokkan database not found: ${databasePath}`);
}

const db = new DatabaseSync(databasePath, { readOnly: true });
const rows = db.prepare(`
  SELECT DISTINCT
    psr.passive_skill_set_id,
    pse.id AS passive_skill_effect_id,
    pse.script_name,
    pse.lite_flicker_rate,
    pse.bgm_id
  FROM passive_skill_set_relations psr
  JOIN passive_skills ps
    ON ps.id = psr.passive_skill_id
  JOIN passive_skill_effects pse
    ON pse.id = ps.passive_skill_effect_id
  WHERE pse.script_name IS NOT NULL
    AND TRIM(pse.script_name) <> ''
  ORDER BY psr.passive_skill_set_id, pse.id
`).all();

const byPassiveSkillSet = {};
for (const row of rows) {
  const key = String(row.passive_skill_set_id);
  if (!byPassiveSkillSet[key]) byPassiveSkillSet[key] = [];
  byPassiveSkillSet[key].push({
    effect_id: row.passive_skill_effect_id,
    script_name: row.script_name,
    lite_flicker_rate: row.lite_flicker_rate,
    bgm_id: row.bgm_id,
  });
}

const manifest = {
  generated_from: path.basename(databasePath),
  generated_at: new Date().toISOString(),
  by_passive_skill_set: byPassiveSkillSet,
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`Wrote ${rows.length} passive animation mappings to ${outputPath}`);
