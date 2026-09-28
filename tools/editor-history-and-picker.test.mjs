import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const historySource = fs.readFileSync(new URL('../js-editor/22-editor-history.js', import.meta.url), 'utf8');
const editorSource = fs.readFileSync(new URL('../js-editor/19-click-to-edit.js', import.meta.url), 'utf8');

function makeHistoryContext() {
  const document = { addEventListener() {}, getElementById() { return null; } };
  const window = { EditorAutosaveStore: { async readLatest() { return null; } } };
  const context = { window, document, console, Date, JSON, Map, Set, Promise, String, Number, Object, Array, RegExp };
  vm.runInNewContext(historySource, context);
  return { window, context };
}

test('session history deduplicates autosave timestamps and restores its complete snapshot payload', () => {
  const { window } = makeHistoryContext();
  const history = window.EditorSessionHistory;
  const art = 'data:image/png;base64,AAABBBCCC';
  const baseline = JSON.stringify({ _autosaveSavedAt: 1, inputs: { name: 'Card' }, art });

  assert.equal(history.record(baseline, { description: 'Opened saved card', version: 0 }), true);
  const first = history.getEntries()[0];
  assert.equal(history.record(JSON.stringify({ _autosaveSavedAt: 2, inputs: { name: 'Card' }, art }), { description: 'Autosaved', version: 0 }), false);
  assert.equal(history.getEntries().length, 1);

  history.markChange('Edited Super Attack effect text');
  const capture = history.beginCapture();
  assert.equal(history.record(JSON.stringify({ _autosaveSavedAt: 3, inputs: { name: 'Card' }, effect: 'Raises ATK', art }), capture), true);
  const entries = history.getEntries();
  assert.deepEqual(Array.from(entries, entry => entry.description), ['Opened saved card', 'Edited Super Attack effect text']);
  assert.ok(entries[0].timestamp <= entries[1].timestamp);
  assert.deepEqual(JSON.parse(history.materialize(first.id)), { _autosaveSavedAt: 1, inputs: { name: 'Card' }, art });
  assert.match(history.getScopeLabel(), /only for this browser session/);
  assert.match(history.getScopeLabel(), /reloaded or closed/);
});

function createPickerApplyContext(kind, selection, names) {
  const rendered = [];
  const container = {
    children: rendered,
    replaceChildren() { rendered.length = 0; },
    appendChild(element) { rendered.push(element); }
  };
  const options = names.map(name => {
    const attributes = new Map();
    const classes = new Set();
    return {
      dataset: kind === 'categories' ? { visualId: name.id, visualName: name.name } : { visualName: name },
      classList: { toggle(token, enabled) { if (enabled) classes.add(token); else classes.delete(token); } },
      setAttribute(key, value) { attributes.set(key, value); },
      get pressed() { return attributes.get('aria-pressed'); },
      get selected() { return classes.has('selected'); }
    };
  });
  const picker = { querySelectorAll() { return options; } };
  const document = {
    getElementById(id) { return id === (kind === 'categories' ? 'card-category-container' : 'card-link-container') ? container : null; },
    createElement() {
      return {
        dataset: {}, style: {}, children: [], attributes: new Map(),
        setAttribute(key, value) { this.attributes.set(key, value); },
        append(...elements) { this.children.push(...elements); },
        appendChild(element) { this.children.push(element); }
      };
    },
    querySelector(selector) { return selector.includes(`data-visual-picker="${kind}"`) ? picker : null; }
  };
  const window = {
    contextVisualSelection: { type: kind, items: selection },
    currentCardThemeStyle: 'dokkaninfo',
    currentType: 'agl',
    normalizeEditorCategoryItems() {},
    getLinkSkillLevel10Description() { return ''; },
    CardHubToast: { success() {} },
    autoSaveToCache() {}
  };
  const start = editorSource.indexOf('window.applyContextVisualSelection = function');
  const end = editorSource.indexOf('\nfunction normalizeSAAttackKi', start);
  assert.ok(start >= 0 && end > start);
  vm.runInNewContext(editorSource.slice(start, end), { window, document, String, Array });
  window.applyContextVisualSelection(kind);
  return { rendered, options };
}

test('visual category and Link Skill apply preserve their selected order and identifiers', () => {
  const categories = createPickerApplyContext('categories', [
    { id: '0042', name: 'Dragon Ball Heroes' },
    { id: '0001', name: 'Fusion' }
  ], [
    { id: '0042', name: 'Dragon Ball Heroes' },
    { id: '0001', name: 'Fusion' }
  ]);
  assert.deepEqual(categories.rendered.map(item => item.dataset.categoryId), ['0042', '0001']);
  assert.deepEqual(categories.rendered.map(item => item.dataset.categoryName), ['Dragon Ball Heroes', 'Fusion']);
  assert.equal(categories.options[0].pressed, 'true');

  const links = createPickerApplyContext('links', ['Legendary Power', 'Fierce Battle'], ['Legendary Power', 'Fierce Battle']);
  assert.deepEqual(links.rendered.map(item => item.textContent), ['Legendary Power', 'Fierce Battle']);
  assert.equal(links.options[0].pressed, 'true');
});
