import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source = fs.readFileSync(new URL('../js-card-details/viewer-card-art-loader.js', import.meta.url), 'utf8');

function createHarness() {
    const requests = [];
    class FakeImage {
        constructor() {
            this.complete = false;
            this.naturalWidth = 0;
            this.onload = null;
            this.onerror = null;
            this._src = '';
            requests.push(this);
        }
        set src(value) { this._src = value; }
        get src() { return this._src; }
        finish(loaded = true) {
            this.complete = true;
            this.naturalWidth = loaded ? 1 : 0;
            (loaded ? this.onload : this.onerror)?.();
        }
    }
    const context = vm.createContext({ window: { Image: FakeImage } });
    vm.runInContext(source, context);
    return { loader: context.window.ViewerCardArtLoader.createLoader(FakeImage), requests };
}

test('late artwork from an older character switch cannot win over the current selection', async () => {
    const { loader, requests } = createHarness();
    const firstLoad = loader.load({ background: '/old-bg.png', character: '/old-char.png' });
    const secondLoad = loader.load({ background: '/new-bg.png', character: '/new-char.png' });

    assert.equal(requests[0].src, '');
    const [oldResult, newBackground, newCharacter] = await Promise.all([
        firstLoad,
        Promise.resolve(requests[2]),
        Promise.resolve(requests[3])
    ]);
    assert.equal(oldResult.stale, true);
    newBackground.finish();
    newCharacter.finish();
    const newResult = await secondLoad;
    assert.equal(newResult.stale, false);
    assert.deepEqual(JSON.parse(JSON.stringify(newResult.assets)), {
        background: '/new-bg.png',
        character: '/new-char.png'
    });
});

test('missing optional art layers resolve empty so the previous card asset can be cleared', async () => {
    const { loader, requests } = createHarness();
    const load = loader.load({ background: '', character: '/new-char.png', effect: '/missing-effect.png' });
    requests[1].finish(false);
    requests[0].finish(true);
    const result = await load;
    assert.deepEqual(JSON.parse(JSON.stringify(result.assets)), {
        background: '',
        character: '/new-char.png',
        effect: ''
    });
});
