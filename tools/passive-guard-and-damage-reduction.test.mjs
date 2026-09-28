import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const formatterSource = fs.readFileSync(new URL('../js-card-details/card-formatters.js', import.meta.url), 'utf8');
const passiveSource = fs.readFileSync(new URL('../js-editor/05-passive.js', import.meta.url), 'utf8');
const editorSource = fs.readFileSync(new URL('../js-editor/19-click-to-edit.js', import.meta.url), 'utf8');
const assetBase = 'https://abscustom.github.io/assets/images/';

function loadFormatterFunctions() {
  const formatStart = formatterSource.indexOf('function formatOfficialText(');
  const parseStart = formatterSource.indexOf('\nfunction parsePassiveSections(', formatStart);
  const detectStart = formatterSource.indexOf('\nfunction autoDetectSAStats(', parseStart);
  const renderStart = formatterSource.indexOf('\nfunction renderAbsSpecialEffects(', detectStart);
  assert.ok(formatStart >= 0 && parseStart > formatStart && detectStart > parseStart && renderStart > detectStart);

  const context = { CENTRAL_ASSET_URL: assetBase };
  vm.runInNewContext(`${formatterSource.slice(formatStart, parseStart)}\n${formatterSource.slice(detectStart, renderStart)}`, context);
  return context;
}

test('Guard symbols use the working header asset in passive text and the symbol picker', () => {
  const formatter = loadFormatterFunctions();
  const passiveParser = passiveSource.match(/':guard:':\s*'([^']+)'/)?.[1] || '';
  const pickerEntry = editorSource.match(/\{\s*token:\s*':guard:',\s*label:\s*'Guard',\s*file:\s*'([^']+)'\s*\}/)?.[1];

  assert.match(formatter.formatOfficialText(':guard:'), /st_sp_guard\.png/);
  assert.match(passiveParser, /st_sp_guard\.png/);
  assert.equal(pickerEntry, 'st_sp_guard.png');
  assert.match(passiveSource, /'st_guard_all\.png':\s*':guard:'/); // old saved image tags still round-trip
});

test('Super Attack parser detects ally Damage Reduction with its own icon and duration', () => {
  const formatter = loadFormatterFunctions();
  const text = "Greatly raises ATK for 4 turns, raises DEF for 1 turn and causes mega-colossal damage to enemy; raises Extreme Class allies' Damage Reduction rate 7% for 2 turns";
  const stats = formatter.autoDetectSAStats(text, 'Negative Power Rain');
  const damageReduction = stats.find(stat => stat.icon.endsWith('st_resist_damage_up.png'));

  assert.deepEqual(JSON.parse(JSON.stringify(damageReduction)), {
    icon: `${assetBase}st_resist_damage_up.png`,
    value: '7',
    turns: '2 turns',
    target: 'ally'
  });
  assert.ok(stats.some(stat => stat.icon.endsWith('st_0002.png')), 'the ordinary DEF boost remains parsed');
  assert.ok(!stats.some(stat => stat.icon.endsWith('st_0012.png')), 'Damage Reduction is not treated as DEF Down');
});

test('Damage Reduction text corrects a matching misclassified special-effect row', () => {
  const formatter = loadFormatterFunctions();
  const stats = formatter.autoDetectSAStats(
    "Raises Extreme Class allies' Damage Reduction rate 7% for 2 turns",
    'Negative Power Rain',
    {
      special_effects: [{
        icon: `${assetBase}st_0012.png`,
        value: '7',
        turn: 2,
        target_type: 2
      }]
    }
  );

  assert.equal(stats.length, 1);
  assert.equal(stats[0].icon, `${assetBase}st_resist_damage_up.png`);
  assert.equal(stats[0].value, '7');
  assert.equal(stats[0].turns, '2 turns');
  assert.equal(stats[0].target, 'ally');
});
