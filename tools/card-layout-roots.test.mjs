import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const rootSource = fs.readFileSync(new URL('../js-card-details/card-layout-roots.js', import.meta.url), 'utf8');
const themeSource = fs.readFileSync(new URL('../js-editor/17-theme.js', import.meta.url), 'utf8');

class FakeClassList {
  constructor() { this.values = new Set(); }
  add(...values) { values.forEach(value => this.values.add(value)); }
  remove(...values) { values.forEach(value => this.values.delete(value)); }
  contains(value) { return this.values.has(value); }
  toggle(value, force = !this.values.has(value)) {
    if (force) this.values.add(value);
    else this.values.delete(value);
    return force;
  }
}

class FakeElement {
  constructor(id = '', tagName = 'div') {
    this.id = id;
    this.tagName = tagName;
    this.dataset = {};
    this.attributes = new Map();
    this.children = [];
    this.parentElement = null;
    this.hidden = false;
    this.value = '';
    this.classList = new FakeClassList();
    this.style = {
      display: '',
      setProperty() {},
      removeProperty() {}
    };
  }

  appendChild(child) {
    child.parentElement?.removeChild(child);
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index >= 0) this.children.splice(index, 1);
    child.parentElement = null;
  }

  insertAdjacentElement(position, child) {
    if (position !== 'afterend' || !this.parentElement) return null;
    const parent = this.parentElement;
    child.parentElement?.removeChild(child);
    const index = parent.children.indexOf(this);
    child.parentElement = parent;
    parent.children.splice(index + 1, 0, child);
    return child;
  }

  cloneNode(deep = false) {
    const clone = new FakeElement(this.id, this.tagName);
    clone.dataset = { ...this.dataset };
    clone.attributes = new Map(this.attributes);
    clone.hidden = this.hidden;
    clone.value = this.value;
    clone.classList.values = new Set(this.classList.values);
    clone.style.display = this.style.display;
    if (deep) this.children.forEach(child => clone.appendChild(child.cloneNode(true)));
    return clone;
  }

  getAttribute(name) {
    if (name === 'id') return this.id || null;
    return this.attributes.get(name) ?? null;
  }

  setAttribute(name, value) {
    if (name === 'id') this.id = String(value);
    else this.attributes.set(name, String(value));
  }

  toggleAttribute(name, force) {
    if (force) this.attributes.set(name, '');
    else this.attributes.delete(name);
  }

  querySelectorAll(selector) {
    const descendants = [];
    const visit = node => node.children.forEach(child => {
      descendants.push(child);
      visit(child);
    });
    visit(this);
    return descendants.filter(element => matches(element, selector));
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  contains(element) {
    return element === this || this.querySelectorAll('*').includes(element);
  }
}

function matches(element, selector) {
  const idMatch = selector.match(/^#([\w-]+)$/);
  if (idMatch) return element.id === idMatch[1];
  const roleMatch = selector.match(/^\[data-card-element="([\w-]+)"\]$/);
  if (roleMatch) return element.dataset.cardElement === roleMatch[1];
  const editMatch = selector.match(/^\[data-edit="([\w-]+)"\]$/);
  if (editMatch) return element.dataset.edit === editMatch[1];
  if (selector === '[id]') return Boolean(element.id);
  if (selector === '*') return true;
  return false;
}

function createRuntime() {
  const body = new FakeElement();
  body.dataset = {};
  body.classList = new FakeClassList();
  const documentElement = new FakeElement();
  documentElement.dataset = {};
  const styleRoot = new FakeElement('layout-abs-style');
  styleRoot.appendChild(new FakeElement('abs-sa-container'));
  styleRoot.appendChild(new FakeElement('abs-passive-container'));
  styleRoot.appendChild(new FakeElement('abs-char-name'));

  const infoRoot = new FakeElement('layout-dokkaninfo');
  const infoName = new FakeElement('char-name');
  const infoSa = new FakeElement('sa-insert-spot');
  infoRoot.appendChild(infoName);
  infoRoot.appendChild(infoSa);
  const passive = new FakeElement('card-passive-container');
  const passiveName = new FakeElement('', 'div');
  passiveName.classList.add('passive-name-display');
  passive.dataset = { edit: 'passive' };
  infoRoot.appendChild(passiveName);
  infoRoot.appendChild(passive);

  body.appendChild(styleRoot);
  body.appendChild(infoRoot);
  const buttons = ['theme-btn-info', 'theme-btn-abs', 'theme-btn-sba'].map(id => new FakeElement(id, 'button'));
  buttons.forEach(button => body.appendChild(button));
  const app = new FakeElement('app');
  body.appendChild(app);

  const document = {
    body,
    documentElement,
    readyState: 'loading',
    listeners: {},
    addEventListener(name, callback) { this.listeners[name] = callback; },
    createElement(tagName) { return new FakeElement('', tagName); },
    getElementById(id) {
      if (body.id === id) return body;
      return [body, ...body.querySelectorAll('*')].find(element => element.id === id) || null;
    },
    querySelector(selector) { return body.querySelector(selector); },
    querySelectorAll(selector) { return body.querySelectorAll(selector); }
  };
  const cardState = {
    name: 'Shared card',
    type: 'str',
    categories: ['7', '19'],
    skills: [{ id: 'sa-1', effect: 'Raises ATK' }]
  };
  const window = {
    cardState,
    addEventListener() {},
    dispatchEvent() {},
    updateSiteFavicon() {},
    refreshEditorLinkingPartners() {},
    syncToAbsLayout() {},
    syncAbsCleanLinkSkillsPlacement() {},
    syncAbsCleanLeaderPlacement() {},
    syncAbsCleanRightRail() {},
    syncAbsCleanSuperAttackPlacement() {},
    syncAbsCleanAwakeningFormsPlacement() {},
    syncAbsCleanHeaderComposition() {},
    syncAbsCleanPassiveSummary() {},
    syncAbsCleanLinkPartnersPlacement() {},
    refreshAbsCleanAsciiBg() {},
    startAbsCleanGridCircuit() {},
    initAbsCleanBackgroundMode() {},
    stopAbsCleanGridCircuit() {}
  };
  const context = {
    document,
    window,
    Event: class { constructor(type) { this.type = type; } },
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
    localStorage: { setItem() {} },
    requestAnimationFrame(callback) { callback(); },
    layoutElement(id) { return window.getCardLayoutElement?.(id) || document.getElementById(id); },
    setTimeout() {},
    clearTimeout() {}
  };
  vm.createContext(context);
  vm.runInContext(rootSource, context);
  return { context, document, window, body, styleRoot, infoRoot, cardState };
}

test('theme aliases resolve to independent layout roots with unique IDs', () => {
  const runtime = createRuntime();
  const { window, document, styleRoot, infoRoot } = runtime;
  const cleanRoot = window.getCardLayoutRoot('sba');

  assert.equal(window.normalizeCardPresentationTheme('abs.clean'), 'abs-clean');
  assert.equal(window.normalizeCardPresentationTheme('abs-style'), 'abs-style');
  assert.equal(window.normalizeCardPresentationTheme('dokkan.info'), 'dokkaninfo');
  assert.equal(window.getCardLayoutRoot('abs-clean'), cleanRoot);
  assert.notEqual(cleanRoot, styleRoot);
  assert.equal(window.getCardLayoutElement('abs-sa-container', cleanRoot)?.id, 'clean-abs-sa-container');
  assert.equal(window.getCardLayoutElement('abs-sa-container', styleRoot)?.id, 'abs-sa-container');
  assert.equal(window.getCardLayoutElement('abs-sa-container', infoRoot)?.id, 'sa-insert-spot');
  assert.ok(infoRoot.classList.contains('card-layout-root-info'));
  assert.equal(window.getCardLayoutElement('abs-category-container', infoRoot), null,
    'an absent Info slot never falls through into another presentation root');

  const allIds = [document.body, ...document.body.querySelectorAll('[id]')]
    .map(element => element.id)
    .filter(Boolean);
  const duplicateIds = allIds.filter((id, index) => allIds.indexOf(id) !== index);
  assert.deepEqual(duplicateIds, [], 'each presentation root has unique element IDs');
});

test('theme switching keeps shared card state while selecting each root', () => {
  const runtime = createRuntime();
  const { context, window, document, cardState, styleRoot, infoRoot } = runtime;
  const stateBefore = JSON.stringify(cardState);
  const start = themeSource.indexOf('window.switchCardTheme = function(themeName) {');
  const end = themeSource.indexOf('\n};\n\n// abs.clean keeps Categories', start);
  assert.ok(start >= 0 && end > start, 'theme switch function is present');
  vm.runInContext(`${themeSource.slice(start, end + 3)};`, context);

  for (const theme of ['sba', 'abs-style', 'dokkan.info', 'abs-clean']) {
    window.switchCardTheme(theme);
    const normalized = window.normalizeCardPresentationTheme(theme);
    assert.equal(document.documentElement.dataset.activeCardLayout, normalized);
    assert.equal(window.getCardLayoutRoot(), window.getCardLayoutRoot(normalized));
    const roots = [window.getCardLayoutRoot('abs-clean'), styleRoot, infoRoot];
    assert.equal(roots.filter(root => !root.hidden).length, 1, 'only the selected presentation root is visible');
    assert.equal(JSON.stringify(cardState), stateBefore);
  }
});

test('populated link and category IDs survive empty legacy arrays', () => {
  const helperSource = fs.readFileSync(new URL('../js-card-details/card-helpers.js', import.meta.url), 'utf8');
  const start = helperSource.indexOf('function getFirstPopulatedCardList');
  const end = helperSource.indexOf('// Count unique characters represented by a category.', start);
  assert.ok(start >= 0 && end > start, 'shared list normalizer is present');
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(helperSource.slice(start, end), context);
  const card = { links: [], link_skill_ids: [4, 8], categories: [], card_categories: [], category_ids: [7, 19] };
  assert.deepEqual(Array.from(context.window.getCardLinkValues(card)), [4, 8]);
  assert.deepEqual(Array.from(context.window.getCardCategoryValues(card)), [7, 19]);
});

test('ABS preview updaters leave Dokkan Info insertion points to native renderers', () => {
  for (const functionName of ['updateAbsStyleSuperAttacks', 'updateAbsStyleActiveSkills']) {
    const start = themeSource.indexOf(`window.${functionName} = function() {`);
    const next = themeSource.indexOf('\nwindow.', start + 1);
    assert.ok(start >= 0 && next > start, `${functionName} is present`);
    const body = themeSource.slice(start, next);
    assert.match(body, /window\.getCardLayoutRoot\?\.\(\)\?\.dataset\?\.cardLayout === 'dokkaninfo'\) return/);
  }
});
