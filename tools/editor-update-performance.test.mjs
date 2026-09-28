import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const init = fs.readFileSync(new URL('../js-editor/18-init.js', import.meta.url), 'utf8');
const autosaveCode = init.slice(init.indexOf('window.editorAutosaveTimer ='), init.indexOf('document.addEventListener("DOMContentLoaded"'));
function autosaveHarness() {
    const events = {};
    let tick;
    let period;
    let saves = 0;
    const window = {
        setInterval(fn, ms) { tick = fn; period = ms; return 1; },
        clearInterval() {}, clearTimeout() {},
        async autoSaveToCache() { saves++; window.editorAutosaveSavedRevision = window.editorAutosaveChangeRevision; return true; }
    };
    vm.runInNewContext(autosaveCode, {window, document: {addEventListener(name, fn) {events[name] = fn;}}});
    window.startEditorAutosave();
    return {window, events, tick: () => tick(), period: () => period, saves: () => saves};
}

test('autosave ticks every five seconds, skips unchanged data, and coalesces typing', async () => {
    const h = autosaveHarness();
    assert.equal(h.period(), 5000);
    await h.tick();
    assert.equal(h.saves(), 1);
    await h.tick();
    assert.equal(h.saves(), 1);
    const target = {matches: selector => selector === 'input, textarea, select'};
    for (let i=0; i<100; i++) h.events.input({target});
    assert.equal(h.saves(), 1, 'typing must not build snapshots');
    await h.tick();
    assert.equal(h.saves(), 2);
    await h.tick();
    assert.equal(h.saves(), 2);
});

test('pending saves do not overlap; edits during a save remain pending', async () => {
    const h = autosaveHarness();
    let complete;
    let calls = 0;
    h.window.autoSaveToCache = () => {
        calls++;
        const revision = h.window.editorAutosaveChangeRevision;
        return new Promise(resolve => {complete = () => {h.window.editorAutosaveSavedRevision=revision; resolve(true);};});
    };
    const first = h.tick();
    h.window.markEditorDirty();
    await h.tick();
    assert.equal(calls, 1);
    complete(); await first;
    assert.notEqual(h.window.editorAutosaveSavedRevision,h.window.editorAutosaveChangeRevision);
    const second = h.tick();
    assert.equal(calls, 2);
    complete(); await second;
    assert.equal(h.window.editorAutosaveSavedRevision,h.window.editorAutosaveChangeRevision);
});

test('failed autosaves remain dirty and published views cannot autosave', async () => {
    const h=autosaveHarness(); let calls=0;
    h.window.autoSaveToCache=async()=>{calls++;return false;};
    await h.tick(); await h.tick(); assert.equal(calls,2);
    h.window.IS_PUBLISHED=true;
    await h.tick(); assert.equal(calls,2);
});

const editor = fs.readFileSync(new URL('../js-editor/19-click-to-edit.js', import.meta.url),'utf8');
const previewCode=editor.slice(editor.indexOf('let skillPreviewFrame ='),editor.indexOf('// GUI HANDLERS FOR SA & ACTIVE'));
for (const theme of ['abs-clean','abs-style','dokkaninfo']) {
    test(`${theme}: typing batches skill updates without rebuilding the card`,()=>{
        const frames=[];const calls=[];
        const window={
            getCardLayoutRoot:()=>({dataset:{cardLayout:theme}}),markEditorDirty(){},
            renderEditorSkillsInDokkanInfo:()=>calls.push('info'),
            updateAbsStyleSuperAttacks:()=>calls.push('sa'),
            updateAbsStyleActiveSkills:()=>calls.push('active'),
            syncToAbsLayout:()=>{throw Error('unrelated full render');}
        };
        vm.runInNewContext(previewCode,{window,Set,requestAnimationFrame:fn=>{frames.push(fn);return frames.length;}});
        for(let i=0;i<30;i++)window.scheduleEditorSkillPreview('active');
        assert.equal(frames.length,1);assert.equal(calls.length,0);
        frames.shift()();assert.deepEqual(calls,[theme==='dokkaninfo'?'info':'active']);
    });
}

const presentation=fs.readFileSync(new URL('../js-card-details/abs-clean-presentation.js',import.meta.url),'utf8');
const measurementCode=presentation.slice(presentation.indexOf('    function scheduleMeasurements()'),presentation.indexOf('    window.syncAbsCleanPresentationLayout ='));
test('a zoom/resize burst measures once and never reparents the layout',()=>{
    const timers=new Map(); let id=0; let measures=0; let clean=true;
    const window={getCardLayoutRoot:()=>({})};
    const ctx={window,document:{body:{classList:{contains:()=>clean}}},measurementTimer:0,
        setTimeout:fn=>{timers.set(++id,fn);return id;},clearTimeout:key=>timers.delete(key),
        byId:()=>({}),syncArtworkCenterline:()=>measures++,syncOverflowNames:()=>{},contentObserver:{takeRecords(){}},
        syncAbsCleanPresentationLayout:()=>{throw Error('structural work on resize');}};
    vm.createContext(ctx);vm.runInContext(measurementCode,ctx);
    for(let i=0;i<30;i++)ctx.scheduleMeasurements();
    assert.equal(timers.size,1);for(const fn of timers.values())fn();timers.clear();
    assert.equal(measures,1);clean=false;ctx.scheduleMeasurements();assert.equal(timers.size,0);
});
