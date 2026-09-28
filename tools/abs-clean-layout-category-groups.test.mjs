import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const layoutVersion = '20260923-abs-clean-layout-category-groups-v1';
const runtimeVersion = '20260923-guard-damage-reduction-v1';
const themeLayoutVersion = '20260923-abs-clean-theme-refresh-v1';
const editorUiVersion = '20260924-image-media-editor-v1';
const clickEditorVersion = '20260924-image-media-editor-v1';
const read = relativePath => readFile(path.join(root, relativePath), 'utf8');

test('ABS.Clean page and custom-card entry points request the current shared layout runtime', async () => {
    const [card, editor, calculator, bootstrapper, migration, helpers] = await Promise.all([
        read('card.html'),
        read('editor.html'),
        read('calculator.html'),
        read('js/custom-card-bootstrapper.js'),
        read('tools/migrate-cards-to-dynamic.mjs'),
        read('js-card-details/card-helpers.js')
    ]);

    for (const source of [card, editor]) {
        assert.ok(source.includes(`css/abs-clean.css?v=${themeLayoutVersion}`));
        assert.ok(source.includes(`js-card-details/card-helpers.js?v=${layoutVersion}`));
    }
    assert.ok(card.includes(`css/abs-style-layout.css?v=${themeLayoutVersion}`));
    assert.ok(card.includes(`js-card-details/card-inspector-core.js?v=${layoutVersion}`));
    assert.ok(card.includes(`js-card-details/card-formatters.js?v=${runtimeVersion}`));
    assert.ok(editor.includes(`css/editor-ui.css?v=${editorUiVersion}`));
    assert.ok(editor.includes(`js-card-details/card-formatters.js?v=${runtimeVersion}`));
    assert.ok(calculator.includes(`js-card-details/card-formatters.js?v=${runtimeVersion}`));
    assert.ok(editor.includes(`js-editor/05-passive.js?v=${runtimeVersion}`));
    assert.ok(editor.includes(`js-editor/19-click-to-edit.js?v=${clickEditorVersion}`));
    assert.ok(bootstrapper.includes(`const runtimeVersion = '${runtimeVersion}'`));
    assert.ok(bootstrapper.includes('css/editor-ui.css?v=${runtimeVersion}'));
    assert.ok(bootstrapper.includes(`const themeLayoutVersion = '${themeLayoutVersion}'`));
    assert.ok(bootstrapper.includes('css/abs-clean.css?v=${themeLayoutVersion}'));
    assert.ok(migration.includes(`custom-card-bootstrapper.js?v=${themeLayoutVersion}`));

    // These are the shared structural operations the refreshed helper exposes.
    assert.ok(helpers.includes("statsBox.classList.add('abs-clean-stats-above-categories')"));
    assert.ok(helpers.includes('formsSlot.appendChild(transformationsContainer)'));
});

test('category picker uses a mixed grid and keeps each image, label, and normalized ID together', async () => {
    const [picker, editor, css, importer] = await Promise.all([
        read('js-editor/19-click-to-edit.js'),
        read('editor.html'),
        read('css/editor-ui.css'),
        read('js-editor/20-card-importer.js')
    ]);
    const optionIds = Array.from(editor.matchAll(/<option value="[^"]+" data-id="([0-9]{4})"/g), match => match[1]);
    assert.equal(new Set(optionIds).size, optionIds.length, 'source category IDs are unique');
    assert.doesNotMatch(picker, /CONTEXT_CATEGORY_COLOR_GROUPS|data-category-color-group|data-category-group/);
    assert.match(picker, /selectedKeys\.has\(id\)/);
    assert.match(picker, /normalizeContextCategoryId\(item\?\.id\)/);
    assert.match(picker, /data-visual-id="\$\{escapeContextHtml\(id\)\}" data-visual-name="\$\{escapeContextHtml\(option\.name\)\}"/);
    assert.match(picker, /card_category_label_\$\{encodeURIComponent\(id\)\}_b_on\.png/);
    assert.match(importer, /resolveEditorCategoryPickerRecord\?\.\(catItem\)/);
    assert.match(importer, /padStart\(4, '0'\)/);
    assert.match(importer, /card_category_label_\$\{padId\}_b_on\.png/);
    assert.match(css, /\.context-category-choice img\s*\{\s*filter:\s*none\s*!important;/);
    assert.match(css, /\.context-visual-choice\.selected\s*\{[^}]*border-color:\s*#fff;/s);
    assert.match(css, /\.context-category-choice\.selected\s*\{\s*order:\s*0;/);
    assert.match(css, /\.context-category-choice:not\(\.selected\)\s*\{\s*order:\s*1;/);
    assert.doesNotMatch(picker, /context-visual-choice-name/);
    assert.doesNotMatch(css, /context-category-color-group|context-category-group-heading|context-category-group-grid/);
});
