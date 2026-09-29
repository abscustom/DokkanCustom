import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../js-card-details/card-inspector-core.js', import.meta.url), 'utf8');
function harness() {
    const cards = [{id: 1000001}, {id: 10000018}, {id: 10000019}, {id: 1000002}, {id: 10000028}, {id: 1034151}];
    const context = vm.createContext({DB: {cards}, window: {history: {replaceState() {}}},
        getFullUnitNetwork: () => ({ezas: [cards[1]], sezas: [cards[2]]}),
        cardLayoutElement: () => null, renderCardDetails: () => {},
        isTransformedCard: () => false, renderAwakeningAndTransformationTrees: () => {},
        updateToggleBarActiveButtons: () => {}});
    vm.runInContext('let selectedCard = null; let currentEzaMode = "base";', context);
    for (const name of ['getCardSiblings', 'selectCard', 'switchEzaForm']) {
        const start = source.indexOf(`function ${name}(`);
        const end = source.indexOf('\nfunction ', start + 1);
        vm.runInContext(source.slice(start, end), context);
    }
    return {run: code => vm.runInContext(code, context)};
}

test('SEZA -> new card rejects stale SEZA mode and returns to base', () => {
    const h = harness();
    h.run('selectCard(10000019)');
    assert.equal(h.run('currentEzaMode'), 'seza');
    h.run('selectCard(1034151, false, "seza")');
    assert.equal(h.run('currentEzaMode'), 'base');
    assert.equal(h.run('selectedCard.id'), 1034151);
    assert.equal(h.run('getCardSiblings(selectedCard).hasSeza'), false);
});

test('EZA and SEZA switches resolve matching rows, unsupported toggles do not leak', () => {
    const h = harness();
    h.run('selectCard(1000001); switchEzaForm("eza")');
    assert.equal(h.run('selectedCard.id'), 10000018);
    h.run('switchEzaForm("seza")');
    assert.equal(h.run('selectedCard.id'), 10000019);
    h.run('selectCard(10000028); switchEzaForm("seza")');
    assert.equal(h.run('currentEzaMode'), 'base');
    assert.equal(h.run('selectedCard.id'), 1000002);
    h.run('switchEzaForm("eza")');
    assert.equal(h.run('selectedCard.id'), 10000028);
    h.run('switchEzaForm("invalid")');
    assert.equal(h.run('currentEzaMode'), 'base');
});
