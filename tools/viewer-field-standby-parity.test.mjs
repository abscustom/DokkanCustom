import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../js-card-details/card-renderers.js', import.meta.url), 'utf8');

function runtime(theme) {
    const targets = Object.fromEntries(['abs-field-container', 'abs-standby-container'].map(id => [id, {
        innerHTML: '',
        insertAdjacentHTML(position, html) { this.innerHTML += html; }
    }]));
    const root = { dataset: { cardLayout: theme }, querySelector: () => null };
    const context = {
        window: {
            getCardLayoutRoot: () => root,
            getCardLayoutElement: id => targets[id],
            renderAbsCleanFieldStatBadges: () => '<span class="test-field-stats">Self ATK +10%</span>',
            DokkanAnimation: { resolveSkill: () => 'standby-script', buttonHtml: () => '<button class="test-standby-play">Play</button>' }
        },
        document: {
            body: { classList: { contains: value => value === 'card-viewer-page' || value === `theme-${theme}` } },
            createElement: () => ({ setAttribute() {}, addEventListener() {} })
        },
        DB: {
            fields: { 10: { id: 10, name: 'Dokkan Field: Test Field', description: 'All allies\nATK +10%', condition: 'Turn 3' } },
            standbys: { 20: { id: 20, name: 'Test Standby', description: 'Charge energy', condition: 'Turn 4' } }
        },
        getCardFolderId: card => card.id,
        formatOfficialText: value => value
    };
    vm.createContext(context);
    vm.runInContext(source, context);
    const render = () => {
        context.window.renderDokkanFields({ id: 123, field_id: 10 }, root);
        context.window.renderStandbySkills({ id: 123, standby_id: 20 }, root);
    };
    render();
    return { targets, render };
}

test('Clean fields and standby use the editor floating-header/container contract', () => {
    const { targets, render } = runtime('abs-clean');
    for (const target of Object.values(targets)) {
        assert.match(target.innerHTML, /abs-clean-header-effects/);
        assert.match(target.innerHTML, /abs-active-floating-header abs-sa-floating-header/);
        assert.match(target.innerHTML, /abs-sa-name-group/);
        assert.ok(target.innerHTML.indexOf('abs-active-floating-header') < target.innerHTML.indexOf('class="abs-header"'));
    }
    const field = targets['abs-field-container'].innerHTML;
    assert.match(field, /abs-domain-play-btn/);
    assert.match(field, /test-field-stats/);
    assert.match(field, /All allies ATK \+10%/);
    assert.doesNotMatch(field, /abs-clean-active-divider/);
    const standby = targets['abs-standby-container'].innerHTML;
    assert.equal((standby.match(/test-standby-play/g) || []).length, 1);
    assert.match(standby, /abs-clean-standby-divider/);
    render();
    assert.equal(targets['abs-field-container'].innerHTML, field);
    assert.equal(targets['abs-standby-container'].innerHTML, standby);
});

test('viewer Field and Standby share the editor floating-header positioning rule', () => {
    const css = fs.readFileSync(new URL('../css/abs-clean.css', import.meta.url), 'utf8');
    const viewerCss = fs.readFileSync(new URL('../css/card-viewer-settings.css', import.meta.url), 'utf8');
    const shared = css.slice(css.indexOf('ABS.CLEAN SHARED FLOATING SKILL HEADERS'));
    const rule = shared.split('}').find(block => block.includes('body.card-viewer-page') && block.includes(':is(#clean-abs-field-container, #clean-abs-standby-container)') && block.includes('position: absolute !important'));
    assert.ok(rule, 'Viewer variants must use the shared absolute-positioned floating header rule');
    assert.ok(rule.includes('body.editor-tool-page') && rule.includes('.abs-sa-floating-header'));

    const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, declarations]) => ({ selector, declarations }));
    const viewerStandbyRule = fragment => rules.find(({ selector }) =>
        selector.includes('body.card-viewer-page') &&
        selector.includes('#clean-abs-standby-container') &&
        selector.includes(fragment)
    );
    const headerRule = viewerStandbyRule('> .abs-box > .abs-header');
    const titleRule = viewerStandbyRule('> .abs-header > .abs-sa-header-title');
    const centeredTitleRule = viewerStandbyRule('.abs-sa-title-center');
    assert.ok(headerRule?.selector.includes('body.editor-tool-page'), 'Viewer and editor must share the same Field/Standby header reset');
    assert.match(headerRule.declarations, /padding:\s*0\s*!important/);
    assert.match(headerRule.declarations, /height:\s*auto\s*!important/);
    assert.match(titleRule?.declarations || '', /text-align:\s*center\s*!important/);
    assert.match(titleRule?.declarations || '', /padding:\s*5px 10px 6px\s*!important/);
    assert.match(centeredTitleRule?.declarations || '', /padding:\s*0 8px\s*!important/);

    const viewerRules = [...viewerCss.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
    const standbySurfaceOverrides = viewerRules.filter(([, selector, declarations]) =>
        selector.includes('[data-card-element="abs-standby-container"] > .abs-box') &&
        /\b(?:background|background-color|background-image|border|padding)\s*:/i.test(declarations)
    );
    assert.deepEqual(standbySurfaceOverrides, [], 'Standby surface must come from the same shared rules as the editor');
    assert.doesNotMatch(viewerCss, /\[data-card-element="abs-field-container"\]\s+\.abs-sa-pill-actions\s*\{[^}]*position:\s*absolute/i);
    assert.doesNotMatch(viewerCss, /\[data-card-element="abs-standby-container"\][^{}]*\.abs-clean-standby-divider[^{}]*\{[^}]*display:\s*block/i);
});

test('ABS.Style keeps its inline headers without Clean floating markup', () => {
    const { targets } = runtime('abs-style');
    for (const target of Object.values(targets)) {
        assert.doesNotMatch(target.innerHTML, /abs-active-floating-header|abs-clean-header-effects/);
        assert.match(target.innerHTML, /abs-sa-title-text/);
    }
});

test('Dokkan Info keeps native skill cards', () => {
    const { targets } = runtime('dokkaninfo');
    for (const target of Object.values(targets)) {
        assert.match(target.innerHTML, /info-rendered-skill/);
        assert.doesNotMatch(target.innerHTML, /abs-active-floating-header|abs-clean-header-effects/);
    }
});
