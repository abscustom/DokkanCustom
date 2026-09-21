import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('ABS passive formatting highlights quoted categories without damaging icons', () => {
  const official = fs.readFileSync(new URL('../js-card-details/card-formatters.js', import.meta.url), 'utf8');
  const source = fs.readFileSync(new URL('../js-editor/07-ui-sync.js', import.meta.url), 'utf8');
  const start = source.indexOf('window.formatCategoryQuotes = function');
  const end = source.indexOf('window.formatLeaderSkillQuotes', start);
  const formatterStart = official.indexOf('function formatOfficialText');
  const formatterEnd = official.indexOf('\nfunction parsePassiveSections', formatterStart);
  const context = { window: {}, CENTRAL_ASSET_URL: 'https://assets/' };
  vm.runInNewContext(official.slice(formatterStart, formatterEnd) + source.slice(start, end), context);
  const input = '{passiveImg:up_g} activates “Pure Saiyans” and "Realm of Gods"';
  const output = context.window.formatCategoryQuotes(context.formatOfficialText(input, false));
  assert.match(output, /passive_skill_dialog_arrow01\.png/);
  assert.match(output, /class="abs-category-quote">"Pure Saiyans"/);
});
