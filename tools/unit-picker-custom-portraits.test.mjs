import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publishedCardsRoot = path.resolve(repoRoot, '..', 'abscustom', 'Custom Cards');
const helperSource = fs.readFileSync(path.join(repoRoot, 'js', 'custom-card-media.js'), 'utf8');
const media = {};
const mediaWindow = { URL };
vm.runInNewContext(helperSource, { window: mediaWindow, URL });
Object.assign(media, mediaWindow.DokkanCustomCardMedia);

function loadPublishedCard(folderName) {
    const html = fs.readFileSync(path.join(publishedCardsRoot, folderName, 'index.html'), 'utf8');
    const match = html.match(/<script\b(?=[^>]*\bid=["'](?:card-data|dokkan-project-data)["'])[^>]*>([\s\S]*?)<\/script>/i);
    assert.ok(match, `${folderName} should contain embedded card data`);
    return JSON.parse(match[1]);
}

test('Kid Buu and Tamagami custom portraits use their published PNG data URLs', () => {
    const folders = [
        '5780637-kid-buu',
        '6564727-tamagami-1',
        '1395627-tamagami-2',
        '9885397-tamagami-3'
    ];

    for (const folderName of folders) {
        const cardData = loadPublishedCard(folderName);
        const resolved = media.resolveCustomThumbnail(cardData, {
            cardUrl: `https://abscustom.github.io/Custom%20Cards/${encodeURIComponent(folderName)}/`,
            rarity: cardData.currentRarity
        });

        assert.equal(resolved.primary, cardData.thumbMain, `${folderName} should prefer thumbMain`);
        const png = Buffer.from(resolved.primary.replace(/^data:image\/png;base64,/i, ''), 'base64');
        assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], `${folderName} should contain a PNG`);
        assert.equal(png.readUInt32BE(16), 250, `${folderName} PNG width`);
        assert.equal(png.readUInt32BE(20), 250, `${folderName} PNG height`);

        const cached = media.normalizeCachedCustomCard({
            source: 'custom',
            type: 'agl',
            htmlText: fs.readFileSync(path.join(publishedCardsRoot, folderName, 'index.html'), 'utf8')
        });
        assert.equal(cached.type, cardData.currentType, `${folderName} should keep its published typing color`);
    }
});

test('custom media normalization repairs malformed cached prefixes and resolves relative paths', () => {
    const dataUrl = 'data:image/png;base64,aGVsbG8=';
    const malformed = `https://abscustom.github.io/Custom%20Cards/example/${dataUrl}`;
    assert.equal(media.normalizeCustomMediaUrl(malformed), dataUrl);
    assert.equal(media.resolveCustomMediaUrl(malformed, 'https://abscustom.github.io/Custom%20Cards/example/'), dataUrl);
    assert.equal(media.resolveCustomMediaUrl('../assets/portrait.png', 'https://abscustom.github.io/Custom%20Cards/example/'), 'https://abscustom.github.io/Custom%20Cards/assets/portrait.png');
    assert.equal(media.resolveCustomMediaUrl('https://cdn.example/portrait.png', 'https://abscustom.github.io/example/'), 'https://cdn.example/portrait.png');
    assert.equal(media.resolveCustomMediaUrl('./assets/card-art/cards/1234560/card_1234560_circle.png'), './assets/card-art/cards/1234560/card_1234560_circle.png');
});

test('calculator and editor pickers share the media resolver and accessible portrait buttons', () => {
    const calcSource = fs.readFileSync(path.join(repoRoot, 'js-calc', 'calc-card-loader.js'), 'utf8');
    const importerSource = fs.readFileSync(path.join(repoRoot, 'js-editor', '20-card-importer.js'), 'utf8');
    const calcHtml = fs.readFileSync(path.join(repoRoot, 'calculator.html'), 'utf8');
    const editorHtml = fs.readFileSync(path.join(repoRoot, 'editor.html'), 'utf8');
    const pickerCss = fs.readFileSync(path.join(repoRoot, 'css', 'unit-picker.css'), 'utf8');

    for (const source of [calcSource, importerSource]) {
        assert.match(source, /resolveCustomThumbnail/);
        assert.match(source, /<button type="button" class="picker-unit-card/);
        assert.match(source, /aria-label="\$\{safeAccessibleName\}" data-picker-tooltip="\$\{safeTooltipText\}"/);
        assert.doesNotMatch(source, /<span class="picker-name/);
        assert.match(source, /card_\$\{(?:circleFolderId|folderId)\}_circle\.png/);
    }

    assert.match(importerSource, /cardJson\?\.currentType/);
    assert.match(calcHtml, /js\/custom-card-media\.js/);
    assert.match(editorHtml, /js\/custom-card-media\.js/);
    assert.match(calcHtml, /js\/unit-picker-tooltips\.js/);
    assert.match(editorHtml, /js\/unit-picker-tooltips\.js/);
    assert.match(calcHtml, /css\/unit-picker\.css/);
    assert.match(editorHtml, /css\/unit-picker\.css/);
    assert.match(pickerCss, /clip-path:\s*circle\(50% at 50% 50%\)/);
    assert.match(pickerCss, /\.picker-thumb\s*\{\s*top:\s*0[\s\S]*?width:\s*100%/);
    assert.match(pickerCss, /\.picker-name,[\s\S]*?\.picker-sub\s*\{\s*display:\s*none/);
});
