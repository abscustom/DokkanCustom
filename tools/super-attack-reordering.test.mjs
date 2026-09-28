import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const read = path => fs.readFileSync(new URL(path, root), 'utf8');
const attackSource = read('js-editor/09-super-attacks.js');
const clickEditorSource = read('js-editor/19-click-to-edit.js');
const previewSource = read('js-editor/17-theme.js');
const exportSource = read('js-editor/12-export.js');
const cacheSource = read('js-editor/16-cache.js');
const bootstrapperSource = read('js/custom-card-bootstrapper.js');
const editorHtml = read('editor.html');
const cardHtml = read('card.html');
const migrationSource = read('tools/migrate-cards-to-dynamic.mjs');

function makeReorderHarness() {
    const children = [];
    const host = {
        insertBefore(node, reference) {
            const currentIndex = children.indexOf(node);
            if (currentIndex >= 0) children.splice(currentIndex, 1);
            const insertIndex = reference === null ? children.length : children.indexOf(reference);
            children.splice(insertIndex < 0 ? children.length : insertIndex, 0, node);
        }
    };
    const makeBlock = id => {
        const attributes = new Map([['data-editor-skill-id', id]]);
        const block = {
            id,
            parentNode: host,
            getAttribute(name) { return attributes.get(name) ?? null; },
            setAttribute(name, value) { attributes.set(name, String(value)); }
        };
        Object.defineProperty(block, 'nextSibling', {
            get() { return children[children.indexOf(block) + 1] || null; }
        });
        return block;
    };
    children.push(makeBlock('sa-1'), makeBlock('sa-2'), makeBlock('sa-3'));

    const position = { textContent: '' };
    const upButton = { disabled: false };
    const downButton = { disabled: false };
    const controls = {
        querySelector(selector) {
            if (selector === '[data-sa-reorder-position]') return position;
            if (selector === '[data-sa-reorder-direction="-1"]') return upButton;
            if (selector === '[data-sa-reorder-direction="1"]') return downButton;
            return null;
        }
    };
    const document = { querySelector: () => controls };
    const window = {
        currentSuperAttack: children[1],
        ensureEditorSkillSourceIds() {},
        getSuperAttackSourceBlocks: () => children,
        getCardLayoutRoot: () => ({ dataset: { cardLayout: 'abs-style' } }),
        getCardLayoutElement: () => ({
            querySelector(selector) {
                const match = selector.match(/data-sa-source-index="(\d+)"/);
                return match && Number(match[1]) === window.renderedIndex ? window.renderedTarget : null;
            }
        }),
        refreshSADropdown() {
            window.renderedIndex = children.indexOf(window.currentSuperAttack);
            window.renderedTarget = { index: window.renderedIndex };
        },
        highlightCardElement(target) { window.highlightedTarget = target; }
    };

    const start = attackSource.indexOf('window.syncSAAttackReorderControls = function() {');
    const end = attackSource.indexOf('window.handleSATypeChange = function(val) {', start);
    assert.ok(start >= 0 && end > start);
    vm.runInNewContext(attackSource.slice(start, end), { window, document });
    return { window, children, position, upButton, downButton };
}

test('Super Attack reordering keeps the selected source, marks saved order, and updates limits', () => {
    const h = makeReorderHarness();
    const selected = h.window.currentSuperAttack;

    assert.equal(h.window.guiMoveSuperAttack(-1), true);
    assert.deepEqual(h.children.map(block => block.id), ['sa-2', 'sa-1', 'sa-3']);
    assert.equal(h.window.currentSuperAttack, selected);
    assert.deepEqual(h.children.map(block => block.getAttribute('data-editor-sa-order')), ['0', '1', '2']);
    assert.equal(h.position.textContent, 'Attack 1 of 3');
    assert.equal(h.upButton.disabled, true);
    assert.equal(h.downButton.disabled, false);
    assert.equal(h.window.activeContextGUITarget, h.window.renderedTarget);
    assert.equal(h.window.highlightedTarget, h.window.renderedTarget);

    h.window.currentSuperAttack = h.children[2];
    h.window.syncSAAttackReorderControls();
    assert.equal(h.downButton.disabled, true);
    assert.equal(h.window.guiMoveSuperAttack(1), false);
    assert.deepEqual(h.children.map(block => block.id), ['sa-2', 'sa-1', 'sa-3']);
});

test('saved source order reaches previews, autosave, JSON export, and published custom cards', () => {
    assert.match(previewSource, /hasManualAttackOrder[\s\S]*?const sortedBlocks = hasManualAttackOrder \? sourceBlocks/);
    assert.match(exportSource, /saBlocksHTML:\s*saHTMLBlocks/);
    assert.match(exportSource, /\.map\(b => b\.outerHTML\)/);
    assert.match(cacheSource, /saBlocksHTML:\s*saHTMLBlocks/);
    assert.match(cacheSource, /data\.saBlocksHTML\.forEach\(html => saSpot\.insertAdjacentHTML\('beforeend'/);
    assert.match(bootstrapperSource, /window\.loadProjectData\(cardData, cardFolderUrl, true\)/);
    assert.match(bootstrapperSource, /window\.updateAbsStyleSuperAttacks\(\)/);
    assert.match(bootstrapperSource, /runtimeVersion = '20260926-sa-order-runtime-v1'/);
    assert.match(bootstrapperSource, /cleanPresentationVersion = '20260926-clean-presentation-v38'/);
    assert.match(migrationSource, /custom-card-bootstrapper\.js\?v=20260926-clean-presentation-v38/);
    assert.match(editorHtml, /09-super-attacks\.js\?v=20260926-sa-reorder-v1/);
    assert.match(cardHtml, /card-viewer-settings\.css\?v=20260926-style-viewer-navbar-v1/);
});

test('requested presentation rules stay scoped to Clean or the ABS.Style viewer', () => {
    const cleanCss = read('css/abs-clean-presentation.css');
    const viewerCss = read('css/card-viewer-settings.css');
    const editorCss = read('css/editor-ui.css');

    assert.match(clickEditorSource, /data-sa-reorder-direction="-1"/);
    assert.match(clickEditorSource, /data-sa-reorder-direction="1"/);
    assert.match(clickEditorSource, /\$\{saQuickPickHTML\}[\s\S]*?sa-auto-generate-stat-effects/);
    assert.match(clickEditorSource, /sa-editor-effects"[\s\S]*?gui-sa-effects[\s\S]*?<\/div>/);
    assert.match(editorCss, /\.sa-editor-reorder-button:disabled/);

    assert.match(cleanCss, /grid-template-columns:\s*repeat\(5, minmax\(0, 1fr\)\)/);
    assert.match(cleanCss, /rgba\(8, 13, 22, \.34\)/);
    assert.match(cleanCss, /\.abs-clean-ex-condition-divider\s*\{[\s\S]*?display: block !important/);
    assert.match(cleanCss, /body\.editor-tool-page\.theme-abs-clean[\s\S]*?#clean-abs-passive-skill-box:hover/);
    assert.match(viewerCss, /body\.card-viewer-page\.theme-abs-style[\s\S]*?var\(--theme-border, #38bdf8\)/);
});
