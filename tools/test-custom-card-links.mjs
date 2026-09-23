import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Exercise the production JSON linker without making GitHub requests.
const source = fs.readFileSync(new URL('../js-editor/21-card-admin.js', import.meta.url), 'utf8');
const normalize = source.slice(source.indexOf('    function normalizeCardIdentityText('), source.indexOf('    function normalizeCardIdentityTokens('));
const linker = source.slice(source.indexOf('    function updateLinkedFormsData('), source.indexOf('    function updateLinkedHtml('));
const context = vm.createContext({ URL, SITE_ROOT: 'https://abscustom.github.io/' });
vm.runInContext(normalize + linker, context);
const update = context.updateLinkedFormsData;
const base = { name: 'Base', slug: 'base', url: 'https://abscustom.github.io/Custom%20Cards/base/' };
const target = { name: 'Other', slug: 'other', url: 'https://abscustom.github.io/Custom%20Cards/other/', thumb: 'other.png' };
const data = { currentType: 'phy', formsData: [
    { name: 'Base', link: target.url, adminLinkedSlug: 'other' },
    { name: 'Other', link: 'https://abscustom.github.io/old-other/', imageSrc: 'custom.png' }
] };
update(data, target, true, base);
assert.equal(data.formsData.length, 2);
assert.equal(data.formsData[0].link, base.url);
assert.equal(data.formsData[0].adminLinkedSlug, undefined);
assert.equal(data.formsData[1].link, target.url);
assert.equal(data.formsData[1].imageSrc, 'custom.png');
update(data, target, true, base);
assert.equal(data.formsData.length, 2, 'repeated linking must be idempotent');
update(data, target, false, base);
assert.equal(data.formsData.length, 2, 'unlink restores an adopted row');
assert.equal(data.formsData[1].link, 'https://abscustom.github.io/old-other/');
assert.equal(data.currentType, 'phy');
const blank = { formsData: [{ name: 'Base', link: base.url }] };
update(blank, target, true, base);
update(blank, target, false, base);
assert.equal(blank.formsData.length, 1, 'unlink removes a newly created row');
const sameName = { formsData: [{ name: 'Base', link: base.url }] };
update(sameName, { ...target, name: 'Base' }, true, base);
assert.equal(sameName.formsData[0].link, base.url, 'same-name cards must not replace self');
assert.equal(sameName.formsData.length, 2);
console.log('PASS: link, relink, unlink, self protection, legacy URL adoption, type preservation');

const editorHtml = fs.readFileSync(new URL('../editor.html', import.meta.url), 'utf8');
assert.match(editorHtml, /value="Golden Fighters" data-id="0099"/);
const categories = { innerHTML: '', insertAdjacentHTML(_position, html) { this.innerHTML += html; } };
const elements = {
    'side-category-input': { value: 'Golden Fighters', focus() {} },
    'category-options': { options: [{ value: 'Golden Fighters', getAttribute() { return '0099'; } }] },
    'card-category-container': categories
};
const editor = vm.createContext({ window: {}, document: {
    getElementById: id => elements[id] || null, querySelectorAll: () => []
}, savedInputs: [], currentType: 'phy', currentClass: 'super', currentRarity: 'LR', currentAwakeningMode: 'none', sIdx: 0, lIdx: 0 });
const categorySource = fs.readFileSync(new URL('../js-editor/06-links-categories.js', import.meta.url), 'utf8');
vm.runInContext(categorySource.slice(categorySource.indexOf('window.addCategory ='), categorySource.indexOf('// --- GLOBAL KEYWORD PARSER')), editor);
editor.window.addCategory();
const exportSource = fs.readFileSync(new URL('../js-editor/12-export.js', import.meta.url), 'utf8');
vm.runInContext(exportSource.slice(exportSource.indexOf('window.getProjectDataObject ='), exportSource.indexOf('window.exportProjectAsJson =')), editor);
const saved = JSON.parse(JSON.stringify(editor.window.getProjectDataObject()));
assert.match(saved.containers.categories, /data-category-id="0099"/);
assert.match(saved.containers.categories, /data-category-name="Golden Fighters"/);
assert.equal(saved.currentType, 'phy');
console.log('PASS: Golden Fighters selection persists in exported project JSON');
