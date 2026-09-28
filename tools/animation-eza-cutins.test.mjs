import assert from 'node:assert/strict';
import test from 'node:test';
import { ActionBankRunner, resolveAnimationAssetCardId } from '../js-card-details/action-bank-runner.js';

const baseId = 1032521;
const ezaId = 10325218;
const sezaId = 10325219;
const records = [
    { id: baseId },
    { id: ezaId, parent_id: baseId, is_eza: true },
    { id: sezaId, parent_id: baseId, is_seza: true }
];

test('base animation asset resolution preserves base cards and maps EZA/SEZA records to their parent', () => {
    assert.equal(resolveAnimationAssetCardId(baseId, records), baseId);
    assert.equal(resolveAnimationAssetCardId(ezaId, records), baseId);
    assert.equal(resolveAnimationAssetCardId(sezaId, records), baseId);
    assert.equal(resolveAnimationAssetCardId(ezaId, Object.fromEntries(records.map(card => [card.id, card]))), baseId);
});

for (const [mode, selectedId] of [['EZA', ezaId], ['SEZA', sezaId]]) {
    test(`${mode} ActionBank preloads the base card cut-in texture`, async () => {
        const originalFetch = globalThis.fetch;
        const originalWindow = globalThis.window;
        const requestedUrls = [];
        const rigRequests = [];
        globalThis.window = { DB: { cards: records } };
        globalThis.fetch = async url => {
            const requestUrl = String(url);
            requestedUrls.push(requestUrl);
            if (requestUrl.includes('/api/card/')) {
                return {
                    ok: true,
                    json: async () => ({ textures: {
                        sp_cutin: { name: `card_${baseId}_sp_cutin.png`, url: '/base-cutin.png' }
                    } })
                };
            }
            return { ok: true, blob: async () => new Blob(['base cut-in texture']) };
        };

        try {
            const runner = Object.create(ActionBankRunner.prototype);
            Object.assign(runner, {
                _cancelled: false,
                attackerCardId: selectedId,
                enemyCardId: 0,
                serverUrl: 'http://animation.test',
                charaLayer: { preloadCharacter: async (slot, cardId) => rigRequests.push({ slot, cardId }) },
                _getHeaders: () => ({}),
                _isStatic: () => false,
                onStatus: null,
                log() {},
                cardTextures: new Map(),
                commands: [],
                preparedEffects: new Map(),
                _preloadSoundEffects: async () => {}
            });

            await runner.preload();
            assert.ok(rigRequests.some(request => request.slot === 0 && request.cardId === baseId));
            assert.ok(requestedUrls.includes(`http://animation.test/api/card/${baseId}`));
            assert.equal(await runner.cardTextures.get('sp_cutin').text(), 'base cut-in texture');

            runner.effectTexRules = new Map();
            runner.effectFileCache = new Map();
            runner.animationContext = 'sa1';
            runner.hideEffectPhraseTextures = false;
            const injected = await runner._effectFiles({
                pack_name: 'base-card-cutin',
                files: [{ name: `card_${baseId}_sp_cutin_1.png`, url: '/placeholder.png' }]
            }, { workId: 10 });
            assert.equal(injected[0].name, `card_${baseId}_sp_cutin_1.png`);
            assert.equal(await injected[0].text(), 'base cut-in texture');
        } finally {
            globalThis.fetch = originalFetch;
            if (originalWindow === undefined) delete globalThis.window;
            else globalThis.window = originalWindow;
        }
    });
}
