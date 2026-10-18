import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../js-editor/12-export.js', import.meta.url), 'utf8');
const helperStart = source.indexOf('function setPublishedImageSourceIfChanged');
const helperEnd = source.indexOf('window.ensurePublishedCustomCardRuntime =', helperStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart, 'the published image source helper is present');
const setPublishedImageSourceIfChanged = vm.runInNewContext(
    `${source.slice(helperStart, helperEnd)}\nsetPublishedImageSourceIfChanged;`
);

test('a loaded same-URL image keeps its in-flight decode while failed art can retry', async () => {
    const staticArtUrl = 'https://abscustom.github.io/Custom%20Cards/6231448-vegeta-ultra-ego/card_art.png';
    let src = staticArtUrl;
    let assignments = 0;
    let decoding = true;
    let resolveDecode;
    let rejectDecode;
    const decode = new Promise((resolve, reject) => {
        resolveDecode = resolve;
        rejectDecode = reject;
    });
    const decodeOutcome = decode.then(
        () => 'resolved',
        error => `rejected:${error.message}`
    );
    const image = {
        complete: true,
        naturalWidth: 1376,
        get src() { return src; },
        set src(value) {
            assignments += 1;
            src = value;
            if (decoding) rejectDecode(new Error('The source image cannot be decoded.'));
        }
    };

    assert.equal(setPublishedImageSourceIfChanged(image, staticArtUrl), false,
        'the delayed static probe skips reassigning a decoded image with the same absolute URL');
    decoding = false;
    resolveDecode();
    assert.equal(await decodeOutcome, 'resolved', 'the active browser decode is allowed to finish');
    assert.equal(assignments, 0, 'the same-URL path never reaches the src setter');

    image.naturalWidth = 0;
    assert.equal(setPublishedImageSourceIfChanged(image, staticArtUrl), true,
        'an identical URL still retries after a completed image load failed');
    assert.equal(assignments, 1);

    const replacementUrl = 'https://abscustom.github.io/Custom%20Cards/6231448-vegeta-ultra-ego/replacement.png';
    assert.equal(setPublishedImageSourceIfChanged(image, replacementUrl), true,
        'a different URL is always assigned');
    assert.equal(image.src, replacementUrl);
    assert.equal(assignments, 2);
});
