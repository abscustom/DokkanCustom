import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source = readFileSync(new URL('../js/custom-card-bootstrapper.js', import.meta.url),'utf8');
const helper = source.slice(source.indexOf('    function loadScript('),source.indexOf('    // 8.'));
const startup = source.slice(source.indexOf('    const scripts = ['),source.indexOf('    const styleErrors ='));
async function boot({optionalFailure=false,requiredFailure=false}={}) {
    const downloads=[],executions=[];
    const context={repoRoot:'https://example.test/DokkanCustom/',runtimeVersion:'runtime',cleanLayoutRuntimeVersion:'layout',cleanPresentationVersion:'presentation',window:{JSZip:!optionalFailure},console:{warn(){}},document:{
        createElement:tag=>({tag}),
        head:{appendChild:link=>downloads.push(link)},
        body:{appendChild:script=>{
            executions.push(script.src);
            queueMicrotask(()=>{
                if((optionalFailure && script.src.includes('jszip')) || (requiredFailure && script.src.includes('03-core'))) script.onerror(new Error('network failure'));
                else script.onload();
            });
        }}
    }};
    const task=vm.runInNewContext(`(async()=>{${helper}\n${startup}})()`,context);
    return {task,downloads,executions};
}
test('published scripts download together but keep required execution order',async()=>{
    const h=await boot();
    assert.ok(h.downloads.length>30,'preloads exist before the first awaited script completes');
    assert.ok(h.downloads.every(link=>link.rel==='preload' && link.as==='script'));
    await h.task;
    assert.match(h.executions[0],/loading-screen\.js\?v=20261007-stable-ring-v1$/);
    assert.deepEqual(h.executions.slice(1),h.downloads.map(link=>link.href));
    const index=name=>h.executions.findIndex(src=>src.includes(name));
    assert.ok(index('01-state')<index('03-core'));
    assert.ok(index('03-core')<index('08-forms'));
    assert.ok(index('12-export')<index('18-init'));
    assert.ok(index('21-card-admin')<index('abs-clean-presentation'));
    assert.ok(index('card-layout-roots') < index('phantom-presentation'), 'Phantom receives the shared layout resolver');
    assert.ok(index('card-helpers') < index('phantom-presentation'), 'Phantom receives existing passive totals helpers');
    assert.ok(index('abs-clean-presentation') < index('phantom-presentation'), 'Phantom presentation loads after existing style controllers');
    assert.equal(h.executions.filter(src => src.includes('/phantom-presentation.js')).length, 1);
    assert.match(h.executions[index('07-ui-sync')], /\?v=20261010-viewer-character-title-v1$/);
    assert.ok(index('unit-picker.js') < index('viewer-card-picker.js'), 'shared picker loads before its viewer consumer');
    assert.ok(index('custom-card-media.js') < index('20-card-importer.js'), 'shared media resolves custom portraits before importer startup');
    assert.ok(index('custom-card-media.js') < index('viewer-card-picker.js'), 'viewer picker receives the shared media resolver');
    assert.ok(index('sidebar-streamers.js') < index('sidebar-streamers-feed.js'), 'one shared feed uses the existing sidebar renderer');
    assert.equal(h.executions.filter(src => src.includes('/js/abs-navigation.js')).length, 1);
});

test('critical loader geometry installs in HEAD before body or loader markup exists', () => {
    const start = source.indexOf('    function installCriticalLoaderStyles() {');
    const end = source.indexOf('    installCriticalLoaderStyles();', start);
    const styles = [];
    const document = {
        getElementById: id => styles.find(style => style.id === id),
        createElement: () => ({ dataset: {} }),
        head: { prepend: style => styles.unshift(style) }
    };
    vm.runInNewContext(`${source.slice(start, end)}\ninstallCriticalLoaderStyles(); installCriticalLoaderStyles();`, { document });
    assert.equal(styles.length, 1, 'idempotent even when body has not been parsed');
    assert.equal(styles[0].id, 'abs-loader-critical-styles');
    assert.equal(styles[0].textContent, readFileSync(new URL('../css/loading-screen.css', import.meta.url), 'utf8').trim());
});
test('optional vendor failure continues while a required failure stops later scripts',async()=>{
    const optional=await boot({optionalFailure:true}); await optional.task;
    assert.match(optional.executions.at(-1),/phantom-presentation/);
    const required=await boot({requiredFailure:true});
    await assert.rejects(required.task,/required card script failed/);
    assert.ok(!required.executions.some(src=>src.includes('08-forms')));
});
test('injected stylesheet gate waits for readiness and returns failures for startup to report',async()=>{
    const start=source.indexOf('    const stylesReady =');
    const end=source.indexOf('    // 4.',start);
    const links=new Map();
    const context={styles:['cached.css','pending.css','failed.css'],ensureStylesheet:href=>{
        const link=Object.assign(new EventTarget(),{sheet:href==='cached.css'?{}:null}); links.set(href,link); return link;
    },window:{setTimeout:()=>1,clearTimeout(){}},Event};
    const gate=vm.runInNewContext(`(()=>{${source.slice(start,end)} return stylesReady;})()`,context);
    let settled=false; gate.then(()=>settled=true); await Promise.resolve(); assert.equal(settled,false);
    links.get('pending.css').dispatchEvent(new Event('load'));
    links.get('failed.css').dispatchEvent(new Event('error'));
    const errors=await gate;
    assert.equal(errors.filter(Boolean).length,1);
    assert.match(errors.find(Boolean).message,/failed.css/);
});
