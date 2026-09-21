import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('ABS SA click resolves the rendered card to its source block', () => {
  const source = fs.readFileSync(new URL('../js-editor/19-click-to-edit.js', import.meta.url), 'utf8');
  const start = source.indexOf('// Click-to-Edit Route Handler');
  const end = source.indexOf('window.passiveUndoStack = []');
  assert.ok(start >= 0 && end > start);

  let listener;
  const block = (name) => {
    const nameEl = { textContent: name };
    const effectsEl = { innerHTML: '' };
    return { classList: { add() {}, remove() {} }, querySelector(selector) {
      if (selector === '.sa-display-name') return nameEl;
      if (selector === '.sa-display-effects-list') return effectsEl;
      return null;
    }, nameEl, effectsEl };
  };
  const first = block('First SA');
  const second = block('Blank SA');
  const rendered = {
    getAttribute(name) { return name === 'data-edit' ? 'sa' : '1'; },
    closest(selector) { return selector === '[data-edit]' ? this : null; }
  };
  const document = {
    addEventListener(type, fn) { if (type === 'click') listener = fn; },
    querySelectorAll(selector) { return selector === '.sa-block' ? [first, second] : []; },
    getElementById() { return null; },
    body: { classList: { contains() { return false; } } }
  };
  const context = {
    document,
    window: {},
    currentSuperAttack: first,
    isPublishedEditorLocked() { return false; },
    ensureGUIContainerExists() {},
    openContextGUI(_x, _y, type, target) {
      context.opened = { type, target };
    }
  };
  vm.runInNewContext(source.slice(start, end), context);
  const nameStart = source.indexOf('window.guiUpdateSAName = function');
  const nameEnd = source.indexOf('window.guiUpdateSAActivation = function', nameStart);
  vm.runInNewContext(source.slice(nameStart, nameEnd), context);
  assert.equal(typeof listener, 'function');

  listener({
    target: rendered,
    clientX: 0,
    clientY: 0,
    preventDefault() {}
  });
  assert.equal(context.opened.type, 'sa');
  assert.equal(context.opened.target, second);
  assert.equal(context.currentSuperAttack, second);
  context.window.guiUpdateSAName('Edited Blank SA');
  context.window.guiUpdateSAEffects('Raises ATK\nRaises DEF');
  assert.equal(first.nameEl.textContent, 'First SA');
  assert.equal(first.effectsEl.innerHTML, '');
  assert.equal(second.nameEl.textContent, 'Edited Blank SA');
  assert.match(second.effectsEl.innerHTML, /Raises ATK/);
  assert.match(second.effectsEl.innerHTML, /Raises DEF/);
});
