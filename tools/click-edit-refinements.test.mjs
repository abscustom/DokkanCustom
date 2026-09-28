import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../js-editor/19-click-to-edit.js', import.meta.url), 'utf8');
const importerSource = fs.readFileSync(new URL('../js-editor/20-card-importer.js', import.meta.url), 'utf8');
const editorHtml = fs.readFileSync(new URL('../editor.html', import.meta.url), 'utf8');
const editorCss = fs.readFileSync(new URL('../css/editor-ui.css', import.meta.url), 'utf8');
const absCleanCss = fs.readFileSync(new URL('../css/abs-clean.css', import.meta.url), 'utf8');
const viewerCss = fs.readFileSync(new URL('../css/card-viewer-settings.css', import.meta.url), 'utf8');
const cacheSource = fs.readFileSync(new URL('../js-editor/16-cache.js', import.meta.url), 'utf8');
const initSource = fs.readFileSync(new URL('../js-editor/18-init.js', import.meta.url), 'utf8');

function makeAutosaveContext({ localPayload = null, indexedDB = true, failLocalWrite = false, records = new Map() } = {}) {
  const localValues = new Map(localPayload === null ? [] : [['dokkan_autosave', localPayload]]);
  let objectStoreCreated = false;
  const database = {
    objectStoreNames: { contains: () => objectStoreCreated },
    createObjectStore() { objectStoreCreated = true; return {}; },
    transaction() {
      const transaction = {
        error: null,
        objectStore() {
          return {
            get(key) {
              const request = {};
              queueMicrotask(() => { request.result = records.get(key) || null; request.onsuccess?.(); });
              return request;
            },
            put(value) {
              queueMicrotask(() => { records.set(value.key, value); transaction.oncomplete?.(); });
            },
            delete(key) {
              queueMicrotask(() => { records.delete(key); transaction.oncomplete?.(); });
            }
          };
        },
        abort() { transaction.onabort?.(); }
      };
      return transaction;
    },
    close() {}
  };
  const idb = indexedDB ? {
    open() {
      const request = {};
      queueMicrotask(() => {
        request.result = database;
        request.onupgradeneeded?.();
        request.onsuccess?.();
      });
      return request;
    }
  } : undefined;
  const localStorage = {
    getItem(key) { return localValues.get(key) ?? null; },
    setItem(key, value) {
      if (failLocalWrite) throw new Error('QuotaExceededError');
      localValues.set(key, value);
    }
  };
  const window = { indexedDB: idb, localStorage, navigator: { storage: { estimate: async () => ({ usage: 100, quota: 1000 }) } } };
  const context = {
    window,
    localStorage,
    document: {},
    console: { error() {}, warn() {} },
    TextEncoder,
    Date,
    JSON,
    Object,
    Array,
    Map,
    Set,
    Promise,
    Error,
    String,
    Number,
    RegExp,
    queueMicrotask
  };
  vm.runInNewContext(cacheSource, context);
  return { context, localValues, records };
}

test('symbol rail keeps names accessible without rendering them beside icons', () => {
  const symbolsStart = source.indexOf('const CLICK_EDITOR_SYMBOLS = [');
  const symbolsEnd = source.indexOf('\n];', symbolsStart) + 3;
  const railStart = source.indexOf('window.renderContextEditorSymbolRail = function');
  const railEnd = source.indexOf('window.renderClickEditorShell = function', railStart);
  assert.ok(symbolsStart >= 0 && symbolsEnd > symbolsStart && railEnd > railStart);

  const context = {
    window: { normalizeAssetUrl: file => '/assets/images/' + file },
    escapeContextHtml(value) {
      return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
  };
  vm.runInNewContext(`${source.slice(symbolsStart, symbolsEnd)}\n${source.slice(railStart, railEnd)}`, context);
  const html = context.window.renderContextEditorSymbolRail('gui-active-effect');

  assert.match(html, /Quick Picks/);
  assert.match(html, /More Symbols/);
  assert.match(html, /:inf:/);
  assert.match(html, /title="Infinite \(∞\)"/);
  assert.match(html, /aria-label="Insert Infinite \(∞\) \(:inf:\)"/);
  const moreSymbols = html.slice(html.indexOf('<details class="context-editor-symbol-more">'));
  assert.match(moreSymbols, /data-symbol-token=":guard:"/);
  assert.match(moreSymbols, /src="\/assets\/images\/st_sp_guard\.png"/);
  assert.match(moreSymbols, /title="Guard" aria-label="Insert Guard \(:guard:\)"/);
  assert.doesNotMatch(html, /<span>/);
});

test('Guard insertion uses the remembered input selection after the symbol button takes focus', () => {
  const insertStart = source.indexOf('window.insertContextEditorSymbol = function');
  const insertEnd = source.indexOf('window.renderContextEditorSymbolRail = function', insertStart);
  assert.ok(insertStart >= 0 && insertEnd > insertStart);

  const rememberedRanges = new Map([['effect-field', { start: 1, end: 3 }]]);
  const field = {
    id: 'effect-field',
    value: 'abcd',
    classList: { contains: name => name === 'context-symbol-target' },
    focus() {},
    setRangeText(text, start, end) { this.value = this.value.slice(0, start) + text + this.value.slice(end); },
    dispatchEvent() {},
    setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; }
  };
  const gui = { contains: candidate => candidate === field };
  const context = {
    window: {
      contextEditorLastTextTargetId: 'effect-field',
      contextEditorSelectionRanges: rememberedRanges,
      captureContextEditorCursor(candidate) {
        this.contextEditorSelectionRanges.set(candidate.id, { start: candidate.selectionStart, end: candidate.selectionEnd });
      }
    },
    document: {
      activeElement: { tagName: 'BUTTON' },
      getElementById(id) { return id === 'context-gui' ? gui : id === 'effect-field' ? field : null; }
    },
    Event: class { constructor(type, options) { this.type = type; this.options = options; } }
  };
  vm.runInNewContext(source.slice(insertStart, insertEnd), context);

  context.window.insertContextEditorSymbol(':guard:', 'other-field');

  assert.equal(field.value, 'a:guard:d');
  assert.equal(field.selectionStart, 8);
  assert.equal(field.selectionEnd, 8);
});

test('legacy Ki labels become numeric input values and edits store numbers only', () => {
  const normalizeStart = source.indexOf('function normalizeSAAttackKi');
  const normalizeEnd = source.indexOf('function formatSAAttackKi', normalizeStart);
  const handlerStart = source.indexOf('window.guiUpdateSAKi = function');
  const handlerEnd = source.indexOf('window.guiUpdateSAMultiplierPreview = function', handlerStart);
  assert.ok(normalizeStart >= 0 && normalizeEnd > normalizeStart && handlerEnd > handlerStart);

  const attrs = new Map([['data-ki', '12 Ki']]);
  const context = {
    window: { syncToAbsLayout() {} },
    currentSuperAttack: {
      setAttribute(name, value) { attrs.set(name, value); },
      removeAttribute(name) { attrs.delete(name); }
    }
  };
  vm.runInNewContext(`${source.slice(normalizeStart, normalizeEnd)}\n${source.slice(handlerStart, handlerEnd)}`, context);

  assert.equal(context.normalizeSAAttackKi('12 Ki'), '12');
  context.window.guiUpdateSAKi('18');
  assert.equal(attrs.get('data-ki'), '18');
  context.window.guiUpdateSAKi('');
  assert.equal(attrs.has('data-ki'), false);
});

test('Super Attack Ki editor defaults match the card preview for legacy cards', () => {
  const helperStart = source.indexOf('function defaultSAAttackKi');
  const helperEnd = source.indexOf('function formatSAAttackKi', helperStart);
  assert.ok(helperStart >= 0 && helperEnd > helperStart);
  const context = {};
  vm.runInNewContext(source.slice(helperStart, helperEnd), context);

  assert.equal(context.defaultSAAttackKi('Super Attack'), '12');
  assert.equal(context.defaultSAAttackKi('Ultra Super Attack'), '18');
  assert.equal(context.defaultSAAttackKi('Unit Ultra Super Attack'), '18');
  assert.equal(context.defaultSAAttackKi('EX Super Attack'), '12');
});

test('passive overview and detail have distinct controls and no stale section helper copy', () => {
  const passiveStart = source.indexOf("case 'passive': {");
  const saStart = source.indexOf("case 'sa': {", passiveStart);
  assert.ok(passiveStart >= 0 && saStart > passiveStart);
  const passive = source.slice(passiveStart, saStart);

  assert.doesNotMatch(passive, /Passive sections|Choose a section to edit/);
  assert.match(passive, /passive-editor-nav-row/);
  assert.match(passive, />All Sections</);
  assert.match(passive, /contentHTML: `\$\{passiveEditorHTML\}\$\{passivePreviewHTML\}`/);
  assert.match(passive, /click-editor-layout-passive-overview/);
  assert.match(passive, /passiveHeaderEditorHTML/);
});

test('passive overview places actions and header controls above the section list', () => {
  const passiveStart = source.indexOf("case 'passive': {");
  const saStart = source.indexOf("case 'sa': {", passiveStart);
  const passive = source.slice(passiveStart, saStart);
  const orderedContent = passive.indexOf('contentHTML: `${passiveEditorHTML}${passiveHeaderEditorHTML}<div class="section-divider"');
  const sectionList = passive.indexOf('${passiveOverviewListHTML}', orderedContent);

  assert.ok(orderedContent >= 0 && sectionList > orderedContent);
  assert.match(passive, /passive-overview-top-actions/);
  assert.match(passive, /aria-label="Copy section" title="Copy section"/);
  assert.match(passive, /passive-overview-copy-btn[^>]*><svg aria-hidden="true"/);
  assert.doesNotMatch(passive, /guiUndoPassiveSection|>Undo</);
  const moveUp = passive.indexOf('guiMovePassiveSection(${section.id}, -1)');
  const moveDown = passive.indexOf('guiMovePassiveSection(${section.id}, 1)');
  const copy = passive.indexOf('guiDuplicatePassiveSection(${section.id})');
  assert.ok(moveUp >= 0 && moveDown > moveUp && copy > moveDown);
  assert.match(editorCss, /\.click-editor-layout-passive-overview \.context-editor-symbol-rail,[\s\S]*?\.click-editor-layout-passive-overview \.click-editor-symbol-toggle/);
  assert.match(editorCss, /\.passive-overview-heading-row \.passive-overview-top-actions[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(editorCss, /\.passive-overview-heading-row \.passive-overview-top-actions > button\s*\{[^}]*width: 100%;[^}]*min-width: 0/);
  assert.match(editorCss, /\.passive-overview-actions:not\(\.passive-overview-top-actions\)\s*\{[^}]*flex-wrap: nowrap/);
  assert.match(passive, /id="gui-passive-badges-toggle-strip"/);
  assert.ok(passive.indexOf('passiveHeaderEditorHTML') < passive.indexOf('${passiveOverviewListHTML}'));
});

test('passive detail puts four navigation actions before the heading and separates preview', () => {
  const passiveStart = source.indexOf("case 'passive': {");
  const saStart = source.indexOf("case 'sa': {", passiveStart);
  const passive = source.slice(passiveStart, saStart);
  const detailStart = passive.indexOf('if (showPassiveDetail) {');
  const detailEnd = passive.indexOf('} else {', detailStart);
  const detail = passive.slice(detailStart, detailEnd);

  assert.ok(detail.indexOf('passive-editor-nav-row') < detail.indexOf('passive-editor-current-title'));
  assert.match(detail, /Delete Section/);
  assert.doesNotMatch(detail, /Duplicate section/i);
  assert.match(detail, /passive-editor-editing-label/);
  assert.match(detail, /passive-editor-title-divider/);
  assert.match(detail, /passive-editor-preview-section/);
  assert.ok(detail.indexOf('</section>') < detail.indexOf('passive-editor-preview-section'));
  assert.match(editorCss, /\.passive-editor-nav-row\s*\{[^}]*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(editorCss, /\.passive-editor-nav-row \.passive-editor-nav-button\s*\{[^}]*width: 100%;[^}]*min-width: 0;[^}]*white-space: normal/);
  assert.match(editorCss, /@media \(max-width: 680px\)\s*\{\s*\.passive-editor-nav-row\s*\{\s*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.doesNotMatch(editorCss, /preview-collapsed/);
});

test('passive deletion offers toast undo and restores the prior position', () => {
  const helperStart = source.indexOf('function showPassiveDeleteUndoToast');
  const deleteStart = source.indexOf('window.guiDeleteSpecificPassiveSection = function');
  const undoEnd = source.indexOf('window.guiAddForm = function', deleteStart);
  assert.ok(helperStart >= 0 && deleteStart > helperStart && undoEnd > deleteStart);
  const actions = source.slice(helperStart, undoEnd);
  assert.doesNotMatch(actions, /window\.confirm\(/);
  assert.match(actions, /index: section\?\.index/);
  assert.match(actions, /showPassiveDeleteUndoToast\([\s\S]*?\$\{heading\} deleted/);
  assert.match(actions, /label: 'Undo'/);
  assert.match(actions, /window\.setTimeout\([\s\S]*?8000\)/);
  assert.match(actions, /window\.moveSection\(id, -1\)/);
  assert.match(actions, /status: 'pending'/);
  assert.match(actions, /status === 'restoring'/);
  assert.match(actions, /Section restored\./);
});

test('passive delete stores neighbor ids and puts Undo in the shared website toast', () => {
  const helperStart = source.indexOf('function showPassiveDeleteUndoToast');
  const deleteStart = source.indexOf('window.guiDeleteSpecificPassiveSection = function');
  const deleteEnd = source.indexOf('window.guiUndoPassiveSection = function', deleteStart);
  assert.ok(helperStart >= 0 && deleteStart > helperStart && deleteEnd > deleteStart);

  const header = { value: 'Third condition' };
  const effects = { value: 'Keep this effect' };
  const section = {
    id: 73,
    index: 2,
    element: { querySelector(selector) { return selector === 'input[type="text"]' ? header : selector === 'textarea' ? effects : null; } }
  };
  const removed = [];
  let expiryCallback;
  let expiryDelay;
  let toastTitle = '';
  let toastOptions = null;
  let pressedListener = null;
  const undoButton = {
    disabled: false,
    classes: new Set(),
    classList: { add(name) { undoButton.classes.add(name); } },
    addEventListener(type, callback) { if (type === 'click') pressedListener = callback; }
  };
  const toast = { querySelector() { return undoButton; } };
  let saveCount = 0;
  const records = [
    { id: 11, index: 0 },
    { id: 22, index: 1 },
    { id: 73, index: 2, element: section.element },
    { id: 44, index: 3 }
  ];
  const context = {
    window: {
      passiveUndoStack: [],
      passiveDeleteToastToken: 0,
      passiveEditorView: 'detail',
      selectedPassiveSectionId: 73,
      removeThisSection(id) {
        removed.push(id);
        records.splice(records.findIndex(entry => entry.id === id), 1);
        records.forEach((entry, index) => { entry.index = index; });
      },
      setTimeout(callback, delay) { expiryCallback = callback; expiryDelay = delay; return 77; },
      clearTimeout() {},
      CardHubToast: {
        show(title, options) { toastTitle = title; toastOptions = options; return 88; },
        dismiss() {}
      },
      autoSaveToCache() { saveCount += 1; }
    },
    document: {
      getElementById(id) {
        if (id === 'side-sec-73') return section.element;
        if (id === 'cardhub-toast-region') return { lastElementChild: toast };
        return null;
      },
      querySelector() { return null; }
    },
    getPassiveEditorSectionRecords() { return records; },
    openContextGUI() {}
  };
  vm.runInNewContext(source.slice(helperStart, deleteEnd), context);

  context.window.guiDeleteSpecificPassiveSection(73);
  assert.deepEqual(removed, [73]);
  assert.deepEqual({ ...context.window.passiveUndoStack[0] }, {
    token: 1, header: 'Third condition', text: 'Keep this effect', index: 2,
    beforeId: 22, afterId: 44, toastId: 88, status: 'pending', expiryTimer: 77
  });
  assert.equal(toastTitle, 'Third condition deleted');
  assert.equal(toastOptions.action.label, 'Undo');
  assert.equal(typeof toastOptions.action.onClick, 'function');
  pressedListener();
  assert.equal(undoButton.disabled, true);
  assert.equal(undoButton.classes.has('passive-delete-undo-pressed'), true);
  assert.equal(context.window.passiveEditorView, 'overview');
  assert.equal(context.window.selectedPassiveSectionId, null);
  assert.equal(saveCount, 1);
  assert.equal(expiryDelay, 8000);

  expiryCallback();
  assert.equal(context.window.passiveUndoStack.length, 0);
});

test('passive undo restores deleted content at its prior section index', () => {
  const undoStart = source.indexOf('window.guiUndoPassiveSection = function');
  const undoEnd = source.indexOf('window.guiAddForm = function', undoStart);
  assert.ok(undoStart >= 0 && undoEnd > undoStart);

  const makeSection = (id, index, heading = `Heading ${id}`, text = `Effect ${id}`) => {
    const header = { value: heading };
    const effects = { value: text };
    return {
      id,
      index,
      element: { querySelector(selector) { return selector === 'input[type="text"]' ? header : selector === 'textarea' ? effects : null; } },
      header,
      effects
    };
  };
  const records = [makeSection(11, 0), makeSection(22, 1), makeSection(33, 2)];
  const moved = [];
  const confirmations = [];
  let nextId = 44;
  const context = {
    window: {
      passiveUndoStack: [{ token: 7, toastId: 5, header: 'Restored condition', text: 'Restored effect', index: 1, beforeId: 11, afterId: 22, status: 'pending' }],
      addNewSection() { records.push(makeSection(nextId++, records.length)); },
      updateHeader(id, value) { records.find(entry => entry.id === id).header.value = value; },
      updateSection(id, value) { records.find(entry => entry.id === id).effects.value = value; },
      moveSection(id, direction) {
        const index = records.findIndex(entry => entry.id === id);
        const swapIndex = index + direction;
        [records[index], records[swapIndex]] = [records[swapIndex], records[index]];
        records.forEach((entry, newIndex) => { entry.index = newIndex; });
        moved.push(direction);
      },
      dismissPassiveDeleteToast(token) {
        assert.equal(token, 7);
        assert.equal(this.passiveUndoStack.length, 1, 'the toast record remains available while it is dismissed');
        this.passiveUndoStack[0].toastId = null;
      },
      clearTimeout() {},
      removeThisSection(id) { const index = records.findIndex(entry => entry.id === id); if (index >= 0) records.splice(index, 1); },
      CardHubToast: { success(title) { confirmations.push(title); }, error() {} }
    },
    document: { querySelector() { return null; } },
    getPassiveEditorSectionRecords() {
      return records.map((entry, index) => ({
        id: entry.id,
        index,
        element: entry.element,
        header: entry.header.value,
        text: entry.effects.value
      }));
    },
    openContextGUI() {}
  };
  vm.runInNewContext(source.slice(undoStart, undoEnd), context);

  const result = context.window.guiUndoPassiveSection(7);

  assert.equal(result, true);
  assert.deepEqual(records.map(entry => entry.id), [11, 44, 22, 33]);
  assert.equal(records[1].header.value, 'Restored condition');
  assert.equal(records[1].effects.value, 'Restored effect');
  assert.deepEqual(moved, [-1, -1]);
  assert.deepEqual(confirmations, ['Section restored.']);
  assert.equal(context.window.passiveUndoStack.length, 0);
  assert.equal(context.window.guiUndoPassiveSection(7), undefined, 'a second click cannot restore the same section twice');
  assert.deepEqual(confirmations, ['Section restored.']);
});

test('passive delete to toast Undo restores the original section once and confirms success', () => {
  const helperStart = source.indexOf('function showPassiveDeleteUndoToast');
  const deleteStart = source.indexOf('window.guiDeleteSpecificPassiveSection = function', helperStart);
  const undoEnd = source.indexOf('window.guiAddForm = function', deleteStart);
  assert.ok(helperStart >= 0 && deleteStart > helperStart && undoEnd > deleteStart);

  const makeSection = (id, headerText, effectText) => {
    const header = { value: headerText };
    const effects = { value: effectText };
    return {
      id,
      header,
      effects,
      element: { querySelector(selector) { return selector === 'input[type="text"]' ? header : selector === 'textarea' ? effects : null; } }
    };
  };
  const sections = [
    makeSection(11, 'Basic effects', 'Ki +3'),
    makeSection(22, 'When receiving an attack', 'DEF +300%'),
    makeSection(33, 'After evading', 'ATK +200%')
  ];
  const confirmations = [];
  let nextId = 34;
  let toastOptions = null;
  let toastTitle = '';
  let toastButtonListener = null;
  const toastButton = {
    disabled: false,
    classes: new Set(),
    classList: { add(name) { toastButton.classes.add(name); } },
    addEventListener(type, callback) { if (type === 'click') toastButtonListener = callback; }
  };
  const toastNode = { querySelector() { return toastButton; } };
  const context = {
    window: {
      passiveUndoStack: [],
      passiveDeleteToastToken: 0,
      passiveEditorView: 'detail',
      selectedPassiveSectionId: 22,
      setTimeout(_callback, delay) { assert.equal(delay, 8000); return 71; },
      clearTimeout() {},
      removeThisSection(id) {
        const index = sections.findIndex(section => section.id === id);
        if (index >= 0) sections.splice(index, 1);
      },
      addNewSection() { sections.push(makeSection(nextId++, 'Basic effect(s)', '- New effect...')); },
      updateHeader(id, value) { sections.find(section => section.id === id).header.value = value; },
      updateSection(id, value) { sections.find(section => section.id === id).effects.value = value; },
      moveSection(id, direction) {
        const index = sections.findIndex(section => section.id === id);
        const nextIndex = index + direction;
        if (index < 0 || nextIndex < 0 || nextIndex >= sections.length) return;
        [sections[index], sections[nextIndex]] = [sections[nextIndex], sections[index]];
      },
      autoSaveToCache() {},
      CardHubToast: {
        show(title, options) { toastTitle = title; toastOptions = options; return 91; },
        dismiss() {},
        success(title) { confirmations.push(title); },
        error(title) { confirmations.push(title); }
      }
    },
    document: {
      getElementById(id) {
        if (id === 'cardhub-toast-region') return { lastElementChild: toastNode };
        const sectionId = Number(String(id).replace('side-sec-', ''));
        return id.startsWith('side-sec-') ? sections.find(section => section.id === sectionId)?.element || null : null;
      }
    },
    getPassiveEditorSectionRecords() {
      return sections.map((section, index) => ({
        id: section.id,
        index,
        element: section.element,
        header: section.header.value,
        text: section.effects.value
      }));
    },
    openContextGUI() {}
  };
  vm.runInNewContext(source.slice(helperStart, undoEnd), context);

  context.window.guiDeleteSpecificPassiveSection(22);
  assert.deepEqual(sections.map(section => section.id), [11, 33]);
  assert.equal(toastTitle, 'When receiving an attack deleted');
  assert.equal(toastOptions.action.label, 'Undo');

  const undoResult = toastOptions.action.onClick();
  toastButtonListener();
  assert.equal(undoResult, true);
  assert.deepEqual(sections.map(section => section.id), [11, 34, 33]);
  assert.equal(sections[1].header.value, 'When receiving an attack');
  assert.equal(sections[1].effects.value, 'DEF +300%');
  assert.deepEqual(confirmations, ['Section restored.']);
  assert.equal(toastButton.disabled, true);
  assert.equal(toastButton.classes.has('passive-delete-undo-pressed'), true);
  assert.equal(context.window.passiveUndoStack.length, 0);

  toastOptions.action.onClick();
  assert.deepEqual(confirmations, ['Section restored.']);
  assert.equal(sections.length, 3, 'repeated Undo cannot insert another copy');
});

test('passive preview toggle changes only preview state and preserves section selection', () => {
  const toggleStart = source.indexOf('window.togglePassiveEditorPreview = function');
  const toggleEnd = source.indexOf("document.addEventListener('DOMContentLoaded'", toggleStart);
  assert.ok(toggleStart >= 0 && toggleEnd > toggleStart);

  const preview = { hidden: false };
  const section = { querySelector(selector) { return selector === '.passive-editor-preview' ? preview : null; } };
  const button = {
    textContent: 'Hide preview',
    attributes: new Map(),
    closest(selector) { return selector === '.passive-editor-preview-section' ? section : null; },
    setAttribute(name, value) { this.attributes.set(name, value); }
  };
  const saved = new Map();
  const context = {
    window: { passiveEditorPreviewExpanded: true, passiveEditorView: 'detail', selectedPassiveSectionId: 73 },
    localStorage: { setItem(key, value) { saved.set(key, value); } }
  };
  vm.runInNewContext(source.slice(toggleStart, toggleEnd), context);

  context.window.togglePassiveEditorPreview(button);

  assert.equal(preview.hidden, true);
  assert.equal(button.textContent, 'Show preview');
  assert.equal(button.attributes.get('aria-expanded'), 'false');
  assert.equal(saved.get('passive-editor-preview-expanded-v1'), 'false');
  assert.equal(context.window.selectedPassiveSectionId, 73);
  assert.equal(context.window.passiveEditorView, 'detail');
});

test('ABS.Clean scopes square editor panels and white preview and keyboard outlines', () => {
  assert.match(absCleanCss, /body\.theme-abs-clean #context-gui\[data-context-type="passive"\],[\s\S]*?border-radius: 0 !important/);
  assert.match(absCleanCss, /body\.theme-abs-clean #context-gui\[data-context-type="passive"\] :focus-visible\s*\{\s*outline: 2px solid #fff !important/);
  assert.match(absCleanCss, /body\.theme-abs-clean\.theme-abs-clean\.theme-abs-clean #layout-abs-style #abs-passive-skill-box #abs-passive-container > \.abs-passive-section-title\.passive-section-edit-selected\s*\{\s*border-color: #fff !important/);
  assert.match(absCleanCss, /body\.theme-abs-clean #layout-abs-style #abs-passive-skill-box\.passive-header-edit-selected,\s*body\.theme-abs-clean #layout-abs-style #abs-passive-container\.passive-header-edit-selected\s*\{\s*outline: 2px solid #fff !important/);
});

test('Super Attack editor retains supported types and activation data without exposing condition controls', () => {
  const saStart = source.indexOf("case 'sa': {");
  const activeStart = source.indexOf("case 'active': {", saStart);
  assert.ok(saStart >= 0 && activeStart > saStart);
  const sa = source.slice(saStart, activeStart);

  for (const type of ['Super Attack', 'Ultra Super Attack', 'EX Super Attack', 'Unit Super Attack', 'Unit Ultra Super Attack']) {
    assert.ok(sa.includes(type), `missing supported attack type: ${type}`);
  }
  assert.match(sa, /type="number"[^>]+id="gui-sa-ki"[^>]+aria-label="Ki amount"/);
  assert.match(sa, /input-group-text[^>]*>Ki</);
  assert.match(sa, /Quick Picks/);
  assert.match(sa, /Advanced Actions/);
  assert.match(sa, /const saQuickPickHTML = `[\s\S]*?Quick Picks/);
  assert.match(sa, /const saAdvancedActionsHTML = `[\s\S]*?Advanced Actions/);
  assert.match(sa, /class="sa-editor-stat-rail"/);
  assert.ok(sa.indexOf('${saStatValueHTML}') < sa.indexOf('${saQuickPickHTML}'));
  assert.ok(sa.indexOf('${saQuickPickHTML}') < sa.indexOf('${saAdvancedActionsHTML}'));
  assert.match(sa, /class="sa-editor-stat-value-add"/);
  assert.doesNotMatch(sa, /guiUndoSA\(\)[^\n]*Undo/);
  assert.match(sa, /class="gui-section-box sa-editor-activation"/);
  assert.match(sa, /isSAActivationType\(saTypeVal\)/);
  assert.match(source, /editorActivation\.hidden = !showActivation/);
  assert.doesNotMatch(sa, /From the effect text|Numbers and duration details/);
  assert.match(source, /window\.guiUpdateSAActivation = function/);
  assert.match(editorCss, /\.sa-editor-ki-field \.form-control,[\s\S]*?#gui-sa-multiplier-preview\s*\{[^}]*border-radius: 0 !important/);
  assert.match(editorCss, /\.sa-editor-category-icons\s*\{[^}]*justify-content: center/);
});

test('category and Link Skill editors use searchable visual pickers and preserve saved selections', () => {
  const linkStart = source.indexOf("case 'links':");
  const categoryStart = source.indexOf("case 'categories':", linkStart);
  const switchEnd = source.indexOf('\n    }\n\n    titleEl.innerHTML', categoryStart);
  assert.ok(linkStart >= 0 && categoryStart > linkStart && switchEnd > categoryStart);
  const cases = source.slice(linkStart, switchEnd);
  assert.match(cases, /renderContextVisualPicker\('links'\)/);
  assert.match(cases, /renderContextVisualPicker\('categories'\)/);
  assert.doesNotMatch(cases, /gui-link-input|gui-category-input|datalist/);
  assert.match(source, /currentCategoryPickerSelection\(\)/);
  assert.match(source, /currentLinkPickerSelection\(\)/);
  assert.match(source, /Object\.values\(databaseLinks\)/);
  assert.match(source, /selection\.items\.forEach\(item =>/);
  assert.match(source, /data-visual-cancel/);
  assert.match(source, /data-visual-apply/);
  assert.match(editorCss, /\.context-visual-grid\s*\{[^}]*display: grid;[^}]*overflow-y: auto/);
  assert.match(editorCss, /@media \(max-width: 680px\)[\s\S]*?\.context-visual-grid\s*\{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
});

test('imported category IDs, labels, and picker images resolve to one category', () => {
  const helperStart = source.indexOf('function escapeContextHtml');
  const helperEnd = source.indexOf('window.cancelContextVisualSelection = function', helperStart);
  assert.ok(helperStart >= 0 && helperEnd > helperStart);

  const options = [
    { dataset: { id: '0017' }, value: 'Pure Saiyans' },
    { dataset: { id: '0018' }, value: 'Namekians' }
  ];
  const image = {
    currentSrc: '',
    getAttribute(name) {
      if (name === 'src') return 'https://abscustom.github.io/assets/images/card_category_label_0017_b_on.png';
      if (name === 'alt') return 'Category 17';
      return null;
    }
  };
  const importedItem = {
    dataset: { categoryId: '17', categoryName: 'Category 17' },
    getAttribute(name) { return name === 'data-category-id' ? '17' : null; },
    matches() { return false; },
    querySelector(selector) { return selector === 'img' ? image : null; }
  };
  const container = { querySelectorAll() { return [importedItem]; } };
  const context = {
    window: { getEditorCategoryItems: () => [importedItem] },
    document: {
      querySelectorAll(selector) { return selector === '#category-options option' ? options : []; },
      getElementById(id) { return id === 'card-category-container' ? container : null; }
    }
  };
  vm.runInNewContext(source.slice(helperStart, helperEnd), context);

  const selected = context.currentCategoryPickerSelection();
  assert.deepEqual(Array.from(selected, item => ({ ...item })), [{ id: '0017', name: 'Pure Saiyans' }]);
  const rendered = context.renderContextCategoryGroups(context.categoryPickerOptions(), new Set(['0017']));
  assert.match(rendered, /data-visual-id="0017" data-visual-name="Pure Saiyans"/);
  assert.match(rendered, /card_category_label_0017_b_on\.png/);
  assert.match(rendered, /aria-pressed="true"/);
  assert.ok(rendered.indexOf('data-visual-id="0017"') < rendered.indexOf('data-visual-id="0018"'), 'selected category renders before unselected categories');
  assert.doesNotMatch(rendered, /<span class="context-visual-choice-name">/);
  assert.doesNotMatch(rendered, /data-category-group|category-color-group/);

  const count = { textContent: '' };
  const button = {
    dataset: { visualKind: 'categories', visualId: '0017', visualName: 'Pure Saiyans' },
    classList: { toggle() {} },
    setAttribute() {},
    closest() { return { querySelector() { return count; } }; }
  };
  context.window.contextVisualSelection = { type: 'categories', items: [{ id: '17', name: 'Pure Saiyans' }] };
  context.window.toggleContextVisualChoice(button);
  assert.equal(context.window.contextVisualSelection.items.length, 0, 'normalized IDs deselect the imported category');
  context.window.toggleContextVisualChoice(button);
  assert.deepEqual(Array.from(context.window.contextVisualSelection.items, item => ({ ...item })), [{ id: '0017', name: 'Pure Saiyans' }]);
});

test('newly selected categories move to the top without losing focus or the grid scroll position', () => {
  const helperStart = source.indexOf('function escapeContextHtml');
  const helperEnd = source.indexOf('window.cancelContextVisualSelection = function', helperStart);
  const selectedClasses = new Set(['selected']);
  const unselectedClasses = new Set();
  const count = { textContent: '1 selected' };
  let restoredFocus = null;
  const picker = { querySelector() { return count; } };
  const grid = {
    children: [],
    scrollTop: 240,
    querySelectorAll() { return this.children; },
    insertBefore(choice, reference) {
      const oldIndex = this.children.indexOf(choice);
      if (oldIndex >= 0) this.children.splice(oldIndex, 1);
      const targetIndex = reference ? this.children.indexOf(reference) : this.children.length;
      this.children.splice(targetIndex < 0 ? this.children.length : targetIndex, 0, choice);
    }
  };
  const makeChoice = (id, classes) => ({
    dataset: { visualKind: 'categories', visualId: id, visualName: `Category ${id}` },
    classList: {
      contains(name) { return classes.has(name); },
      toggle(name, force) { force ? classes.add(name) : classes.delete(name); }
    },
    closest(selector) { return selector === '.context-visual-grid' ? grid : picker; },
    setAttribute() {},
    focus(options) { restoredFocus = options; }
  });
  const first = makeChoice('0017', selectedClasses);
  const second = makeChoice('0018', unselectedClasses);
  const third = makeChoice('0019', new Set());
  grid.children = [first, third, second];
  const context = {
    document: { activeElement: second },
    window: { contextVisualSelection: { type: 'categories', items: [{ id: '0017', name: 'Category 0017' }] } }
  };
  vm.runInNewContext(source.slice(helperStart, helperEnd), context);

  context.window.toggleContextVisualChoice(second);

  assert.deepEqual(grid.children.map(choice => choice.dataset.visualId), ['0017', '0018', '0019']);
  assert.equal(grid.scrollTop, 0, 'selecting a category reveals the selected section at the top');
  assert.equal(restoredFocus?.preventScroll, true);
  assert.equal(count.textContent, '2 selected');
});

test('selected Link Skills render first and move to the top when toggled on', () => {
  const helperStart = source.indexOf('function escapeContextHtml');
  const helperEnd = source.indexOf('window.cancelContextVisualSelection = function', helperStart);
  const options = [
    { value: 'Kamehameha' },
    { value: 'Prepared for Battle' },
    { value: 'Shattering the Limit' }
  ];
  const context = {
    window: { contextVisualSelection: { type: 'links', items: ['Kamehameha'] } },
    document: {
      activeElement: null,
      querySelectorAll(selector) {
        if (selector === '#link-options option') return options;
        return [];
      }
    }
  };
  vm.runInNewContext(source.slice(helperStart, helperEnd), context);
  const rendered = context.renderContextVisualPicker('links');
  assert.ok(rendered.indexOf('data-visual-name="Kamehameha"') < rendered.indexOf('data-visual-name="Prepared for Battle"'));
  assert.match(rendered, /data-visual-name="Kamehameha"[^>]*aria-pressed="true"/);

  const count = { textContent: '1 selected' };
  const picker = { querySelector() { return count; } };
  const grid = {
    children: [],
    scrollTop: 240,
    querySelectorAll() { return this.children; },
    insertBefore(choice, reference) {
      const oldIndex = this.children.indexOf(choice);
      if (oldIndex >= 0) this.children.splice(oldIndex, 1);
      const targetIndex = reference ? this.children.indexOf(reference) : this.children.length;
      this.children.splice(targetIndex < 0 ? this.children.length : targetIndex, 0, choice);
    }
  };
  const makeChoice = (name, selected = false) => {
    const classes = new Set(selected ? ['selected'] : []);
    return {
      dataset: { visualKind: 'links', visualName: name },
      classList: {
        contains(key) { return classes.has(key); },
        toggle(key, force) { force ? classes.add(key) : classes.delete(key); }
      },
      closest(selector) { return selector === '.context-visual-grid' ? grid : picker; },
      setAttribute() {},
      focus() {}
    };
  };
  const current = makeChoice('Kamehameha', true);
  const newlySelected = makeChoice('Prepared for Battle');
  const remaining = makeChoice('Shattering the Limit');
  grid.children = [current, remaining, newlySelected];
  context.document.activeElement = newlySelected;

  context.window.toggleContextVisualChoice(newlySelected);

  assert.deepEqual(grid.children.map(choice => choice.dataset.visualName), [
    'Kamehameha', 'Prepared for Battle', 'Shattering the Limit'
  ]);
  assert.equal(grid.scrollTop, 0);
  assert.equal(count.textContent, '2 selected');
});

test('character import writes the same canonical category ID into its asset path and label', () => {
  const helperStart = source.indexOf('function escapeContextHtml');
  const helperEnd = source.indexOf('window.cancelContextVisualSelection = function', helperStart);
  const importStart = importerSource.indexOf('// 8. CATEGORIES');
  const importEnd = importerSource.indexOf('// 9. MULTI-LAYER HIGH-RES CARD ART', importStart);
  assert.ok(helperStart >= 0 && helperEnd > helperStart && importStart >= 0 && importEnd > importStart);

  const options = [{ dataset: { id: '0017' }, value: 'Pure Saiyans' }];
  const categoryContainer = {
    markup: '',
    insertAdjacentHTML(_position, markup) { this.markup += markup; }
  };
  let normalized = false;
  const context = {
    window: {
      normalizeEditorCategoryItems() { normalized = true; }
    },
    document: {
      querySelectorAll(selector) { return selector === '#category-options option' ? options : []; },
      getElementById(id) { return id === 'card-category-container' ? categoryContainer : null; }
    },
    raw: { categories: [{ id: 17, name: 'Category 17' }] }
  };
  vm.runInNewContext(source.slice(helperStart, helperEnd), context);
  vm.runInNewContext(importerSource.slice(importStart, importEnd), context);

  assert.match(categoryContainer.markup, /data-category-id="0017" data-category-name="Pure Saiyans"/);
  assert.match(categoryContainer.markup, /card_category_label_0017_b_on\.png/);
  assert.match(categoryContainer.markup, /alt="Pure Saiyans"/);
  assert.equal(normalized, true);
});

test('History is in the top bar, replaces editor Undo buttons, and states its session scope', () => {
  const historySource = fs.readFileSync(new URL('../js-editor/22-editor-history.js', import.meta.url), 'utf8');
  assert.match(editorHtml, /id="editor-history-button"[\s\S]*?<span>History<\/span>/);
  assert.match(editorHtml, /js-editor\/22-editor-history\.js/);
  assert.doesNotMatch(source, /onclick="guiUndo(?:SA|Active|Form)\(\).*Undo/);
  assert.match(historySource, /Recent edits, oldest to newest/);
  assert.match(historySource, /only for this browser session/);
  assert.match(historySource, /window\.confirm\(/);
  assert.match(historySource, /EditorAutosaveStore\.save/);
});

test('EX and Unit Super Attack card bars tint the header, type, Ki, and multiplier in ABS.Clean only', () => {
  for (const stylesheet of [absCleanCss, viewerCss]) {
    for (const kind of ['ex', 'unit']) {
      assert.match(stylesheet, new RegExp(`abs-clean-${kind}-super-attack > \\.abs-sa-floating-header`));
      assert.match(stylesheet, new RegExp(`abs-clean-${kind}-super-attack > \\.abs-sa-floating-header :is\\(`));
      assert.match(stylesheet, new RegExp(`abs-clean-${kind}-super-attack > \\.abs-sa-floating-header \\.abs-sa-header-meta > :is\\(\\.abs-sa-ki-pill, \\.abs-sa-damage-pill\\)`));
    }
  }
  assert.match(absCleanCss, /abs-clean-ex-super-attack > \.abs-sa-floating-header\s*\{[^}]*rgba\(161, 98, 7/);
  assert.match(absCleanCss, /abs-clean-unit-super-attack > \.abs-sa-floating-header\s*\{[^}]*rgba\(107, 33, 168/);
});

test('autosave keeps legacy recoverable saves, uses IndexedDB first, and reports only completed saves', () => {
  const autosave = cacheSource.slice(cacheSource.indexOf('window.autoSaveToCache = async function'), cacheSource.indexOf('window.loadFromCache = async function'));
  const storageStore = cacheSource.slice(cacheSource.indexOf('window.EditorAutosaveStore ='), cacheSource.indexOf('function autosaveByteLength'));
  assert.match(cacheSource, /indexedDB\.open/);
  assert.match(storageStore, /readLocalAutosaveRecord/);
  assert.match(storageStore, /localStorage\.setItem\(EDITOR_AUTOSAVE_LOCAL_KEY, payload\)/);
  assert.match(storageStore, /indexed\.savedAt >= local\.savedAt/);
  assert.match(autosave, /containers:\s*\{[\s\S]*?forms: formsHTML/);
  assert.doesNotMatch(autosave, /formsData\s*:/);
  assert.match(cacheSource, /if \(data\.formsData\)\s*\{/);
  assert.match(autosave, /EditorAutosaveStore\.save\(serializedPayload, savedAt\)/);
  assert.ok(autosave.indexOf('await queuedSave') < autosave.indexOf('EditorSessionHistory?.record'));
  assert.match(autosave, /CardHubToast && !options\.silent/);
  assert.ok(autosave.indexOf('await queuedSave') < autosave.indexOf("CardHubToast.success('Autosaved'"));
  assert.match(autosave, /CardHubToast\.error\('Autosave failed'/);
  assert.match(cacheSource, /async function inspectAutosaveStorage[\s\S]*?embeddedImageSourceCount[\s\S]*?topLevelBytes/);
  assert.match(initSource, /await window\.loadFromCache\(\)/);
});

test('autosave payload survives a fresh page context and keeps the prior local save recoverable', async () => {
  const legacyPayload = JSON.stringify({ inputs: { 'input-active-name': 'Older saved edit' } });
  const firstPage = makeAutosaveContext({ localPayload: legacyPayload });
  const legacy = await firstPage.context.window.EditorAutosaveStore.readLatest();
  assert.equal(legacy.storage, 'localStorage');
  assert.equal(JSON.parse(legacy.payload).inputs['input-active-name'], 'Older saved edit');

  const newestPayload = JSON.stringify({ _autosaveSavedAt: 123, inputs: { 'input-active-name': 'Latest edit' } });
  const result = await firstPage.context.window.EditorAutosaveStore.save(newestPayload, 123);
  assert.equal(result.storage, 'IndexedDB');
  assert.equal(firstPage.localValues.get('dokkan_autosave'), legacyPayload);

  const reloadedPage = makeAutosaveContext({ localPayload: legacyPayload, records: firstPage.records });
  const restored = await reloadedPage.context.window.EditorAutosaveStore.readLatest();
  assert.equal(restored.storage, 'IndexedDB');
  assert.equal(JSON.parse(restored.payload).inputs['input-active-name'], 'Latest edit');
});

test('failed fallback autosave preserves the last local recovery snapshot', async () => {
  const legacyPayload = JSON.stringify({ inputs: { 'input-active-name': 'Last saved edit' } });
  const page = makeAutosaveContext({ localPayload: legacyPayload, indexedDB: false, failLocalWrite: true });
  await assert.rejects(page.context.window.EditorAutosaveStore.save('new large payload', 456));
  assert.equal(page.localValues.get('dokkan_autosave'), legacyPayload);
});

test('clearing editor autosave leaves unrelated browser storage alone', async () => {
  const page = makeAutosaveContext({ indexedDB: false });
  await page.context.window.EditorAutosaveStore.clear();
  assert.doesNotMatch(cacheSource, /localStorage\.clear\(\)|sessionStorage\.clear\(\)/);
  assert.doesNotMatch(initSource, /localStorage\.clear\(\)|sessionStorage\.clear\(\)/);
});

test('all click editors keep their controls reachable while hidden-scrollbar regions still scroll', () => {
  for (const editType of ['passive', 'active', 'sa']) {
    assert.match(editorCss, new RegExp(`#context-gui\\[data-context-type="${editType}"\\] #gui-content`));
  }
  assert.match(editorCss, /\.click-editor-layout,\s*\.sa-editor-layout\s*\{[\s\S]*?min-height: 0 !important/);
  assert.match(editorCss, /\.click-editor-fields-scroll\s*\{[\s\S]*?overflow-y: auto/);
  assert.match(editorCss, /\.sa-editor-fields-scroll\s*\{[\s\S]*?overflow-y: auto/);
  assert.match(editorCss, /\.sa-editor-stat-rail\s*\{[\s\S]*?overflow-y: auto/);
  assert.match(editorCss, /@media \(max-width: 680px\)[\s\S]*?#context-gui\[data-context-type="sa"\][\s\S]*?height: 84dvh/);
});

test('Active editor heading follows the selected skill and removes Divider Line control', () => {
  const activeStart = source.indexOf("case 'active': {");
  const artStart = source.indexOf("case 'art':", activeStart);
  assert.ok(activeStart >= 0 && artStart > activeStart);
  const active = source.slice(activeStart, artStart);

  assert.match(active, /data-active-editor-title/);
  assert.match(active, /activeHeadingVal/);
  assert.doesNotMatch(active, />Divider line</i);
});

test('Active editor heading falls back from default placeholders to the skill type', () => {
  const headingStart = source.indexOf('window.getActiveSkillEditorHeadingName = function');
  const headingEnd = source.indexOf('window.guiUpdateActiveName = function', headingStart);
  assert.ok(headingStart >= 0 && headingEnd > headingStart);

  const activeBlock = {
    kind: 'active',
    querySelector(selector) {
      return selector === '.active-type-label' ? { textContent: 'ACTIVE SKILL' } : null;
    }
  };
  const context = {
    window: {
      getActiveSkillKind: block => block?.kind,
      getActiveSkillKindLabel: kind => kind === 'standby' ? 'Standby' : 'Active Skill'
    },
    document: { querySelector() { return null; } }
  };
  vm.runInNewContext(source.slice(headingStart, headingEnd), context);

  assert.equal(context.window.getActiveSkillEditorHeadingName('(Enter Skill Name)', activeBlock), 'Active Skill');
  assert.equal(context.window.getActiveSkillEditorHeadingName('Skill Name', activeBlock), 'Active Skill');
  assert.equal(context.window.getActiveSkillEditorHeadingName('Counter Rush', activeBlock), 'Counter Rush');
  activeBlock.kind = 'standby';
  activeBlock.querySelector = selector => selector === '.active-type-label' ? { textContent: 'Standby' } : null;
  assert.equal(context.window.getActiveSkillEditorHeadingName('', activeBlock), 'Standby');
});
