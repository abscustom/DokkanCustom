import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../js-editor/19-click-to-edit.js', import.meta.url), 'utf8');
const routeStart = source.indexOf('// Click-to-Edit Route Handler');
const routeEnd = source.indexOf('window.passiveUndoStack = []');
assert.ok(routeStart >= 0 && routeEnd > routeStart);

function makePassiveRoute({ sectionIds = [], cardSection = null, absTitleIndex = null } = {}) {
  let listener;
  const sideSections = sectionIds.map(id => ({ id: `side-sec-${id}` }));
  const absTitles = [{}, {}, {}, {}];
  const absContainer = {
    querySelectorAll(selector) {
      return selector === '.abs-passive-section-title' ? absTitles : [];
    }
  };
  const passiveRoot = { getAttribute: name => name === 'data-edit' ? 'passive' : null };
  const absTitle = Number.isInteger(absTitleIndex) ? absTitles[absTitleIndex] : null;
  const target = {
    closest(selector) {
      if (selector === '#context-gui, #editor, nav, .navbar, #abs-stat-range-slider, .abs-slider-ticks, .glass-modal-overlay') return null;
      if (selector === '[data-edit]') return passiveRoot;
      if (selector === '[data-edit="passive"], #abs-passive-skill-box') return passiveRoot;
      if (selector === '#card-passive-container [id^="card-sec-"]') return cardSection;
      if (selector === '#abs-passive-container') return absTitle ? absContainer : null;
      if (selector === '#abs-passive-container .abs-passive-section-title') return absTitle;
      if (selector === '#abs-passive-container .abs-passive-list') return null;
      return null;
    }
  };
  const document = {
    addEventListener(type, callback) { if (type === 'click') listener = callback; },
    querySelectorAll(selector) {
      return selector === '#sidebar-sections-area [id^="side-sec-"]' ? sideSections : [];
    }
  };
  const context = {
    document,
    window: { ensurePassiveEditorSections() {} },
    isPublishedEditorLocked() { return false; },
    ensureGUIContainerExists() {},
    openContextGUI(_x, _y, type, targetElement) {
      context.opened = { type, target: targetElement };
    }
  };
  vm.runInNewContext(source.slice(routeStart, routeEnd), context);
  return {
    context,
    click() {
      listener({ target, clientX: 0, clientY: 0, preventDefault() {} });
    }
  };
}

test('clicking a classic passive section opens its stable section id', () => {
  const section = { id: 'card-sec-73' };
  const { context, click } = makePassiveRoute({ sectionIds: [18, 73], cardSection: section });

  click();

  assert.equal(context.opened.type, 'passive');
  assert.equal(context.window.passiveEditorView, 'detail');
  assert.equal(context.window.selectedPassiveSectionId, 73);
});

test('clicking the passive header opens the section overview', () => {
  const { context, click } = makePassiveRoute({ sectionIds: [18, 73] });

  click();

  assert.equal(context.opened.type, 'passive');
  assert.equal(context.window.passiveEditorView, 'overview');
  assert.equal(context.window.selectedPassiveSectionId, null);
});

test('ABS rendered section order resolves to the matching stable sidebar id', () => {
  const { context, click } = makePassiveRoute({ sectionIds: [73, 18], absTitleIndex: 1 });

  click();

  assert.equal(context.window.passiveEditorView, 'detail');
  assert.equal(context.window.selectedPassiveSectionId, 18);
});

test('section highlighting targets the selected section and clears cleanly', () => {
  const helperStart = source.indexOf('function getPassiveEditorSectionRecords()');
  const helperEnd = source.indexOf('function ensureGUIContainerExists()', helperStart);
  assert.ok(helperStart >= 0 && helperEnd > helperStart);

  const classList = (initial = []) => {
    const values = new Set(initial);
    return {
      add(value) { values.add(value); },
      remove(value) { values.delete(value); },
      contains(value) { return values.has(value); }
    };
  };
  const cardSections = new Map([29, 42].map(id => [`card-sec-${id}`, { classList: classList() }]));
  const sidebarSections = [29, 42].map(id => ({
    id: `side-sec-${id}`,
    querySelector(selector) {
      if (selector === 'input[type="text"]') return { value: `Heading ${id}` };
      if (selector === 'textarea') return { value: `Effect ${id}` };
      return null;
    }
  }));
  const absTitles = sidebarSections.map(() => ({ classList: classList(), nextElementSibling: null }));
  const absLists = sidebarSections.map(() => ({ classList: classList(['abs-passive-list']) }));
  absTitles.forEach((title, index) => { title.nextElementSibling = absLists[index]; });
  const allRenderNodes = [...cardSections.values(), ...absTitles, ...absLists];
  const absContainer = { querySelectorAll: selector => selector === '.abs-passive-section-title' ? absTitles : [] };
  const document = {
    querySelectorAll(selector) {
      if (selector === '.passive-section-edit-selected') return allRenderNodes.filter(node => node.classList.contains('passive-section-edit-selected'));
      if (selector === '#sidebar-sections-area [id^="side-sec-"]') return sidebarSections;
      return [];
    },
    getElementById(id) {
      return cardSections.get(id) || (id === 'abs-passive-container' ? absContainer : null);
    }
  };
  const context = {
    document,
    window: { currentCardThemeStyle: 'info', ensurePassiveEditorSections() {} }
  };
  vm.runInNewContext(source.slice(helperStart, helperEnd), context);

  context.window.applyPassiveSectionHighlight(42);
  assert.equal(cardSections.get('card-sec-42').classList.contains('passive-section-edit-selected'), true);
  assert.equal(cardSections.get('card-sec-29').classList.contains('passive-section-edit-selected'), false);
  context.window.applyPassiveSectionHighlight(null);
  assert.equal(cardSections.get('card-sec-42').classList.contains('passive-section-edit-selected'), false);

  context.window.currentCardThemeStyle = 'abs-style';
  context.window.applyPassiveSectionHighlight(42);
  assert.equal(absTitles[1].classList.contains('passive-section-edit-selected'), true);
  assert.equal(absLists[1].classList.contains('passive-section-edit-selected'), true);
  assert.equal(absTitles[0].classList.contains('passive-section-edit-selected'), false);
});
