import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const leaderSource = readFileSync(new URL('../js/leader-compatibility.js', import.meta.url), 'utf8');
const makeElement = (tag) => {
    const classes = new Set();
    return {
    tag, children: [], attributes: {}, listeners: {}, dataset: {}, rect: null, offsetWidth: 230, offsetHeight: 140,
    style: { setProperty() {} },
    classList: {
        add(name) { classes.add(name); },
        remove(name) { classes.delete(name); },
        contains(name) { return classes.has(name); },
        toggle(name, force) {
            if (force === undefined ? !classes.has(name) : force) classes.add(name);
            else classes.delete(name);
            return classes.has(name);
        }
    },
    append(...nodes) { nodes.forEach((node) => { node.parentElement = this; this.children.push(node); }); },
    appendChild(node) { node.parentElement = this; this.children.push(node); },
    replaceChildren(...nodes) { this.children = nodes; },
    setAttribute(name, value) { this.attributes[name] = value; },
    addEventListener(type, listener) { (this.listeners[type] ||= []).push(listener); },
    contains(node) { return node === this || this.children.some((child) => child === node || child.contains?.(node)); },
    getBoundingClientRect() { return this.rect || { left: 0, top: 0, right: 80, bottom: 94, width: 80, height: 94 }; }
};
};
const documentRoot = { clientWidth: 1000, clientHeight: 760 };
const windowListeners = {};
const documentElements = new Map();
const context = vm.createContext({ URL, window: {
    innerWidth: 1000, innerHeight: 760,
    addEventListener(type, listener) { (windowListeners[type] ||= []).push(listener); }
}, document: {
    baseURI: 'http://localhost/', documentElement: documentRoot,
    getElementById: (id) => {
        if (documentElements.has(id)) return documentElements.get(id);
        const element = makeElement('div');
        if (id === 'leader-compatibility-page') element.dataset.cardPresentation = 'abs';
        documentElements.set(id, element);
        return element;
    }, createElement: makeElement,
    querySelectorAll: () => []
} });
vm.runInContext(leaderSource.replace(/    bindControls\(\);[\s\S]*$/, `
    globalThis.testApi = { state, elements, parseLeaderSkill, evaluateCard, createUnitCard, createLeaderPickerCard, renderUnits, computeTooltipPosition, sortCompatibilityResults, leaderPickerStatModel, resolveInitialLeader, openLeaderPicker, PAGE_SIZE };
})();`), context);
const { state, parseLeaderSkill, evaluateCard } = context.testApi;
assert.equal(context.testApi.elements.page.dataset.cardPresentation, 'abs');
state.categories = [{ id: 1, name: 'Primary' }, { id: 2, name: 'Majin Buu Saga' }];
const parsed = parseLeaderSkill({ description: '"Primary" Category HP +200% and ATK & DEF +170%; plus an additional HP, ATK & DEF +50% for characters who also belong to the "Majin Buu Saga" Category' });
const full = evaluateCard({ categories: [1, 2], element: 22 }, parsed);
assert.equal(full.amount, 690);
assert.equal(full.totalBuff.HP, 250);
assert.equal(full.totalBuff.ATK, 220);
assert.equal(full.totalBuff.DEF, 220);
assert.deepEqual(Array.from(full.reasons), ['Primary']);
assert.deepEqual(Array.from(full.extraCategoryNames), ['Majin Buu Saga']);
const primary = evaluateCard({ categories: [1], element: 22 }, parsed);
assert.equal(primary.amount, 540);
assert.equal(primary.full, false);
assert.equal(evaluateCard({ categories: [2], element: 22 }, parsed), null);
const tile = context.testApi.createUnitCard({ ...full, card: { id: 1034151, name: 'Buu (Kid)', element: 22, rarity: 5 } });
assert.equal(tile.className, 'lc-unit-card lc-unit-card--compact');
assert.equal(tile.children.length, 3);
assert.equal(tile.children[1].children[0].textContent, '690%');
assert.equal(tile.children[1].children[1].className, 'lc-unit-up-arrow is-full');
assert.equal(tile.children[1].children[1].tag, 'img');
assert.match(tile.children[1].children[1].src, /passive_skill_dialog_arrow01.png$/);
assert.equal(tile.children[2].attributes.role, 'tooltip');
assert.equal(tile.children[2].children[0].textContent, 'Buu (Kid)');
assert.equal(tile.children[2].children[1].textContent, 'HP 250% · ATK 220% · DEF 220%');
assert.equal(tile.attributes['aria-describedby'], tile.children[2].id);
const firstColumnPosition = context.testApi.computeTooltipPosition(
    { left: 0, top: 100, right: 80, bottom: 194, width: 80, height: 94 },
    { width: 230, height: 140 }, { width: 1000, height: 760 }
);
assert.equal(firstColumnPosition.viewportLeft, 8);
assert.equal(firstColumnPosition.side, 'below');
assert.ok(firstColumnPosition.viewportTop >= 8);
const lastColumnPosition = context.testApi.computeTooltipPosition(
    { left: 920, top: 650, right: 1000, bottom: 744, width: 80, height: 94 },
    { width: 230, height: 140 }, { width: 1000, height: 760 }
);
assert.ok(lastColumnPosition.viewportLeft + 230 <= 992);
assert.equal(lastColumnPosition.side, 'above');
assert.ok(lastColumnPosition.viewportTop + 140 <= 752);
assert.equal(context.testApi.PAGE_SIZE, 85);
const sortedResults = context.testApi.sortCompatibilityResults([
    { amount: 70, card: { id: 1, name: 'Older 70', open_at: '2024-01-01' } },
    { amount: 90, card: { id: 2, name: 'Top 90', open_at: '2023-01-01' } },
    { amount: 70, card: { id: 3, name: 'Newest 70', open_at: '2026-01-01' } },
    { amount: 70, card: { id: 4, name: 'Next newest 70', open_at: '2026-01-01' } },
    { amount: null, card: { id: 5, name: 'Unknown newest', open_at: '2026-08-01' } },
    { amount: undefined, card: { id: 6, name: 'Unknown older', open_at: '2022-01-01' } }
]);
assert.deepEqual(Array.from(sortedResults, ({ card }) => card.name), [
    'Top 90', 'Next newest 70', 'Newest 70', 'Older 70', 'Unknown newest', 'Unknown older'
]);
tile.rect = { left: 0, top: 100, right: 80, bottom: 194, width: 80, height: 94 };
tile.children[2].rect = { left: 0, top: 0, right: 230, bottom: 140, width: 230, height: 140 };
tile.listeners.pointerenter[0]({ pointerType: 'mouse' });
assert.ok(tile.children[2].classList.contains('is-tooltip-visible'));
assert.equal(tile.children[2].style.left, '8px');
assert.equal(windowListeners.scroll.length, 1);
let escapePrevented = false;
tile.listeners.keydown[0]({ key: 'Escape', preventDefault() { escapePrevented = true; } });
assert.equal(escapePrevented, true);
assert.equal(tile.children[2].classList.contains('is-tooltip-visible'), false);
const partialTile = context.testApi.createUnitCard({ ...primary, card: { id: 1, name: 'Primary only', element: 10 } });
assert.equal(partialTile.children[1].children[1].className, 'lc-unit-up-arrow is-partial');
state.results = [
    { ...full, card: { id: 1, name: 'Full', element: 22 } },
    { ...primary, card: { id: 2, name: 'Partial', element: 22 } }
];
state.matchFilter = 'half';
context.testApi.renderUnits();
assert.equal(context.testApi.elements.unitsGrid.children.length, 1);
assert.match(context.testApi.elements.unitsGrid.children[0].attributes['aria-label'], /^Partial,/);
state.matchFilter = 'full';
context.testApi.renderUnits();
assert.equal(context.testApi.elements.unitsGrid.children.length, 1);
assert.match(context.testApi.elements.unitsGrid.children[0].attributes['aria-label'], /^Full,/);
state.results = Array.from({ length: 87 }, (_, index) => ({
    ...full,
    card: { id: index + 1000, name: `Character ${index}`, element: 22 }
}));
context.testApi.renderUnits();
assert.equal(context.testApi.elements.unitsGrid.children.length, 85);
assert.equal(context.testApi.elements.loadMoreWrap.hidden, false);
state.visibleCount += context.testApi.PAGE_SIZE;
context.testApi.renderUnits(false);
assert.equal(context.testApi.elements.unitsGrid.children.length, 87);
assert.equal(context.testApi.elements.loadMoreWrap.hidden, true);
const supportSource = readFileSync(new URL('../js/support-memory.js', import.meta.url), 'utf8');
assert.match(supportSource, /FILM_ORDER = \['Blue', 'Green'/);
const sortScope = vm.createContext({ validMemories: [
    { id: '1', name: 'A red memory', filmType: 'Red' },
    { id: '2', name: 'Z blue memory', filmType: 'Blue' },
    { id: '3', name: 'A green memory', filmType: 'Green' },
    { id: '4', name: 'A blue memory', filmType: 'Blue' },
    { id: '5', name: 'Unknown film', filmType: null }
] });
vm.runInContext(supportSource.match(/const FILM_ORDER = .*;/)[0]
    + supportSource.slice(supportSource.indexOf('        const filmRank ='), supportSource.indexOf('        state.memories = validMemories;')), sortScope);
assert.deepEqual(Array.from(sortScope.validMemories, (memory) => memory.id), ['4', '2', '3', '1', '5']);
const gallery = supportSource.slice(supportSource.indexOf('function createMemoryCard'), supportSource.indexOf('function renderLibrary'));
assert.doesNotMatch(gallery, /createFilmIcon/);
assert.doesNotMatch(readFileSync(new URL('../leader-compatibility.html', import.meta.url), 'utf8'), /data-match-filter="base"/);
const leaderHtml = readFileSync(new URL('../leader-compatibility.html', import.meta.url), 'utf8');
assert.match(leaderHtml, /lc-results-workspace[\s\S]*lc-workspace-header[\s\S]*lc-results-toolbar/);
assert.match(leaderHtml, /lc-results-toolbar" id="lc-results-toolbar" hidden/);
assert.doesNotMatch(leaderHtml, /Choose a character above|See units/i);
assert.match(leaderHtml, /<h1 class="hub-section-title">LEADER COMPATIBILITY<\/h1>/);
assert.match(leaderHtml, /id="lc-picker-open"[^>]*aria-label="Change leader"/);
assert.match(leaderHtml, /id="lc-picker-open-fallback"[^>]*>SELECT LEADER<\/button>/);
assert.doesNotMatch(leaderHtml, /css\/unit-picker\.css/);
assert.match(leaderHtml, /data-card-presentation="abs"/);
assert.match(leaderHtml, /data-card-presentation-option="abs"[^>]*>ABS</);
assert.match(leaderHtml, /data-card-presentation-option="dokkan"[^>]*>Dokkan</);
assert.ok(leaderHtml.indexOf('id="lc-selected-leader"') < leaderHtml.indexOf('class="lc-results-workspace"'));
const pagesCss = readFileSync(new URL('../css/other-tool-pages.css', import.meta.url), 'utf8');
assert.match(pagesCss, /@media \(max-width: 420px\)[\s\S]*?#lc-picker-open[\s\S]*?font-size: 12px !important;[\s\S]*?letter-spacing: \.04em !important/);
assert.match(pagesCss, /lc-unit-tooltip\.is-tooltip-visible/);
assert.match(pagesCss, /radial-gradient\(circle at 7% 19%/);
assert.match(pagesCss, /grid-template-columns: repeat\(3, 48px\)/);
assert.match(pagesCss, /width: 48px;[\s\S]*?height: 36px/);
assert.match(pagesCss, /body\.fx-static\.theme-abs-clean\.theme-abs-clean-dark\.other-tool-body:has\(\.leader-compatibility-page\)[\s\S]*?background: transparent !important/);
assert.match(pagesCss, /font-size: clamp\(17px, 1\.7vw, 22px\) !important;[\s\S]*?letter-spacing: \.12em !important/);
assert.match(pagesCss, /#lc-picker-open[\s\S]*?text-transform: uppercase !important;[\s\S]*?white-space: nowrap !important/);
assert.match(pagesCss, /lc-unit-card--compact:hover:not\(:focus-visible\)[\s\S]*?outline: none !important/);
assert.match(pagesCss, /lc-unit-card--compact:focus-visible[\s\S]*?outline: 2px solid/);
assert.match(pagesCss, /50% \{ transform: translateY\(2px\); \}/);
const leaderPickerCss = readFileSync(new URL('../css/leader-compatibility-picker.css', import.meta.url), 'utf8');
assert.match(leaderPickerCss, /picker-unit-card \.picker-thumb-wrapper[\s\S]*?width: 64px !important;[\s\S]*?height: 64px !important;/);
assert.match(leaderPickerCss, /clip-path: circle\(50% at 50% 50%\) !important;[\s\S]*?transform: none !important;/);
assert.match(leaderPickerCss, /#lc-leader-picker \.calc-picker-toolbar[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/);
assert.match(leaderPickerCss, /#lc-leader-picker \.picker-search-wrapper[\s\S]*?grid-column: 1 \/ -1;[\s\S]*?width: 100%/);
assert.match(leaderPickerCss, /#lc-leader-picker \.picker-search-wrapper input[\s\S]*?width: 100%;[\s\S]*?max-width: none/);
assert.match(leaderPickerCss, /\.lc-leader-summary[\s\S]*?grid-template-columns: 72px minmax\(0, 1fr\) auto !important;/);
assert.match(leaderPickerCss, /\.lc-leader-summary > #lc-picker-open[\s\S]*?grid-area: action;[\s\S]*?justify-self: end/);
assert.match(leaderPickerCss, /#lc-leader-picker \.lc-leader-picker-select[\s\S]*?grid-template-columns: 64px minmax\(0, 1fr\)/);
assert.match(leaderPickerCss, /#lc-leader-picker \.lc-picker-tooltip[\s\S]*?position: fixed !important/);
assert.match(leaderPickerCss, /data-card-presentation="dokkan"\] \{[\s\S]*?--lc-dokkan-art-height: 125\.34%;[\s\S]*?--lc-dokkan-art-bottom: -8\.67%;/);
assert.match(leaderPickerCss, /data-card-presentation="dokkan"[\s\S]*?img\.lc-portrait-art[\s\S]*?height: var\(--lc-dokkan-art-height, 125\.34%\) !important;[\s\S]*?transform: translateX\(-50%\) !important/);
assert.match(leaderPickerCss, /data-card-presentation="dokkan"\] \.lc-leader-portrait::after\s*\{\s*content: none;/);
assert.match(leaderPickerCss, /img\.lc-dokkan-frame\s*\{\s*z-index: 1 !important/);
assert.doesNotMatch(leaderPickerCss, /data-card-presentation="abs"[^\n]*lc-portrait-art/);
assert.doesNotMatch(leaderSource, /PRESENTATION_KEY|installPresentationToggle/);
assert.match(leaderSource, /SELECTED_LEADER_STORAGE_KEY = 'leader-compatibility-selected-leader'/);
const pickerStats = context.testApi.leaderPickerStatModel(parsed);
assert.deepEqual(Array.from(pickerStats, ({ stat, baseValues, additional, additionalKind }) => ({ stat, baseValues: Array.from(baseValues), additional, additionalKind })), [
    { stat: 'HP', baseValues: [200], additional: 50, additionalKind: 'conditional' },
    { stat: 'ATK', baseValues: [170], additional: 50, additionalKind: 'conditional' },
    { stat: 'DEF', baseValues: [170], additional: 50, additionalKind: 'conditional' }
]);
const pickerCard = context.testApi.createLeaderPickerCard({
    card: { id: 1034151, name: 'Buu (Kid)', element: 22 },
    leader: { name: 'Transcendent Existence' },
    parsed
});
assert.equal(pickerCard.tag, 'div');
assert.equal(pickerCard.children.length, 2, 'leader candidates hide their name in the grid and expose an info control');
const [pickerSelect, pickerInfo] = pickerCard.children;
assert.equal(pickerSelect.tag, 'button');
assert.match(pickerSelect.attributes['aria-label'], /Buu \(Kid\).*Transcendent Existence.*Primary/);
assert.equal(pickerSelect.children[0].className, 'picker-thumb-wrapper');
assert.equal(pickerSelect.children[1].className, 'lc-picker-stats');
assert.equal(pickerSelect.children[1].children[0].children[0].textContent, 'HP');
assert.equal(pickerInfo.className, 'lc-leader-picker-info');
assert.equal(pickerInfo.attributes['aria-controls'], 'lc-leader-picker-tooltip');
assert.equal(pickerInfo.attributes['aria-expanded'], 'false');
const leaderPickerTooltip = documentElements.get('lc-leader-picker').children[0];
assert.equal(leaderPickerTooltip.id, 'lc-leader-picker-tooltip');
pickerCard.listeners.pointerenter[0]({ pointerType: 'mouse' });
assert.equal(leaderPickerTooltip.attributes['aria-hidden'], 'false');
assert.equal(leaderPickerTooltip.children[0].textContent, 'Buu (Kid)');
assert.equal(leaderPickerTooltip.children[1].textContent, 'Transcendent Existence');
assert.equal(leaderPickerTooltip.children[2].textContent, parsed.description);
let propagationStopped = false;
pickerInfo.listeners.click[0]({
    preventDefault() {},
    stopPropagation() { propagationStopped = true; }
});
assert.equal(propagationStopped, true, 'touch detail control does not trigger leader selection');
assert.equal(pickerInfo.attributes['aria-expanded'], 'true');
assert.equal(pickerCard.classList.contains('is-tooltip-pinned'), true);
let tooltipEscapeStopped = false;
pickerCard.listeners.keydown[0]({
    key: 'Escape',
    preventDefault() {},
    stopPropagation() { tooltipEscapeStopped = true; }
});
assert.equal(tooltipEscapeStopped, true);
assert.equal(leaderPickerTooltip.attributes['aria-hidden'], 'true');
state.leaderCards = [{ card: { id: 10 } }, { card: { id: 20 } }];
assert.equal(context.testApi.resolveInitialLeader('10', '20').source, 'url');
assert.equal(context.testApi.resolveInitialLeader('unknown', '20').source, 'storage');
assert.equal(context.testApi.resolveInitialLeader('unknown', 'missing'), null);
const openedPickers = [];
context.window.DokkanUnitPicker = { open(config) { openedPickers.push(config); } };
state.autoPickerAttempted = false;
state.selectedCard = null;
context.testApi.openLeaderPicker({ automatic: true });
context.testApi.openLeaderPicker({ automatic: true });
assert.equal(openedPickers.length, 1, 'automatic picker opens only once after data-ready selection resolution');
context.testApi.openLeaderPicker();
assert.equal(openedPickers.length, 2, 'a deliberate user request may open it again after dismissal');
assert.equal(openedPickers[0].items, state.leaderCards);
console.log('Other tools: leader matching, compact gallery batch, viewport-clamped tooltips, film order, and filter checks passed.');
