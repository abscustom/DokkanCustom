import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import '../js/published-card-guards.js';

const validate = globalThis.assertGeneratedInlineScripts;

test('validates executable inline scripts and skips inert JSON payloads', () => {
    const html = `
        <script type="application/json">{"name":"Majuub"}</script>
        <script src="viewer.js"></script>
        <script>window.cardReady = true;</script>
        <script type="text/javascript">window.cardForm = 'base';</script>
    `;

    assert.equal(validate(html, 'fixture/index.html'), 2);
});

test('reports the page and inline script number for broken bootstrap code', () => {
    const html = `
        <script type="application/json">{"id":1}</script>
        <script>let src = 'https://example.test/bootstrap.js?v=broken;</script>
    `;

    assert.throws(
        () => validate(html, '3600361-majuub/index.html'),
        error => error instanceof SyntaxError
            && /3600361-majuub\/index\.html: inline script #2/.test(error.message)
    );
});

test('fails closed when a generated page adds an inline module script', () => {
    assert.throws(
        () => validate('<script type="module">export const ready = true;</script>', 'fixture/index.html'),
        /inline module script #1 cannot be validated safely/
    );
});

test('loader watchdog is parseable and provides a Retry action', () => {
    const watchdog = globalThis.buildPublishedLoaderWatchdogScript();
    assert.doesNotThrow(() => new vm.Script(watchdog));
    assert.match(watchdog, /Card could not load/);
    assert.match(watchdog, /Retry/);
    assert.match(watchdog, /15000/);
    assert.match(watchdog, /abs-card-bootstrap-error/);
});

test('export, migration, and admin publishing paths validate generated HTML', () => {
    const exporter = fs.readFileSync(new URL('../js-editor/12-export.js', import.meta.url), 'utf8');
    const githubUpload = fs.readFileSync(new URL('../js-editor/13-github.js', import.meta.url), 'utf8');
    const admin = fs.readFileSync(new URL('../js-editor/21-card-admin.js', import.meta.url), 'utf8');
    const migration = fs.readFileSync(new URL('./migrate-cards-to-dynamic.mjs', import.meta.url), 'utf8');
    const bootstrapper = fs.readFileSync(new URL('../js/custom-card-bootstrapper.js', import.meta.url), 'utf8');

    assert.match(exporter, /assertGeneratedInlineScripts\(htmlContent/);
    assert.match(githubUpload, /assertGeneratedInlineScripts\(html, file\.path\)/);
    assert.match(admin, /assertGeneratedInlineScripts\(change\.text, change\.path\)/);
    assert.match(migration, /assertGeneratedInlineScripts\(dynamicHtml/);
    assert.match(bootstrapper, /'js\/published-card-guards\.js'/);
});
