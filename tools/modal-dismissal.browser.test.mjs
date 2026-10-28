import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {chromium} from 'file:///C:/Users/Ruffy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const root=process.cwd();
const server=http.createServer(async(req,res)=>{
    const file=path.resolve(root,'.'+new URL(req.url,'http://local').pathname);
    if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
    try{const data=await fs.readFile(file);res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream'}).end(data);}catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
    for(const [file,width,motion] of [['editor.html',1440,'no-preference'],['editor.html',390,'no-preference'],['editor.html',1440,'reduce'],['calculator.html',1440,'no-preference'],['card.html?id=4031731',1440,'no-preference'],['index.html',1440,'no-preference']]) {
        const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:motion,isMobile:width<900,hasTouch:width<900});
        await page.route('**/api/public/cards**',route=>route.fulfill({json:{schemaVersion:1,cards:[],nextCursor:null}}));
        await page.route('https://decapi.me/**',route=>route.fulfill({body:'Channel is offline'}));
        await page.goto(`http://127.0.0.1:${server.address().port}/${file}`,{waitUntil:'domcontentloaded'});
        await page.waitForFunction(()=>window.absShellReady);
        if(file==='calculator.html')await page.locator('#unitPickerModal .picker-unit-card').first().waitFor({state:'visible',timeout:45000});
        await page.evaluate(()=>{document.querySelector('#abs-loading-screen')?.remove();window.DokkanUnitPicker?.close();});
        await page.evaluate(()=>window.toggleCardViewerSettings?toggleCardViewerSettings(true):toggleSettingsDrawer());
        const settings=page.locator('#settingsDrawer');
        await settings.waitFor({state:'visible'});
        assert.equal(await settings.locator('.close-btn').isVisible(),false);
        await settings.locator('.sidebar-header h2,.sidebar-header .sba-settings-heading').first().click();
        assert.equal(await settings.evaluate(el=>el.classList.contains('open')),true,'Clicking inside Settings must keep it open');
        await page.mouse.click(width-4,4);
        await page.waitForFunction(()=>!document.querySelector('#settingsDrawer').classList.contains('open'));
        await page.evaluate(()=>{
            window.toggleCardViewerSettings?toggleCardViewerSettings(true):toggleSettingsDrawer();
            document.body.dataset.sbaPanelOpenedAt=String(Date.now());
            document.body.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));
        });
        await page.waitForFunction(()=>!document.querySelector('#settingsDrawer').classList.contains('open'));
        const modals=file==='editor.html'?[
            ['#glass-upload-modal','.clean-modal-panel','.clean-modal-close'],
            ['#glass-quicksave-modal','.clean-modal-panel','.clean-modal-close'],
            ['#glass-admin-unlock-modal','.clean-modal-panel','.clean-modal-close'],
            ['#abs-domain-modal-overlay','.abs-domain-modal-dialog','.abs-domain-modal-close']
        ]:file==='calculator.html'?[
            ['#calc-sync-modal-backdrop','.vcard-container','.vcard-close-btn']
        ]:file==='index.html'?[]:[['#abs-domain-modal-overlay','.abs-domain-modal-dialog','.abs-domain-modal-close']];
        for(const [id,panel,close] of modals) {
            const modal=page.locator(id);
            await modal.evaluate(el=>el.style.display='flex');
            await modal.waitFor({state:'visible'});
            assert.equal(await modal.locator(close).isVisible(),false,`${id} must not show an X`);
            await modal.locator(panel).click({position:{x:10,y:10}});
            assert.equal(await modal.isVisible(),true,'Inside clicks must preserve the modal');
            await page.mouse.click(4,4);
            await modal.waitFor({state:'hidden'});
        }
        const dock=page.locator('#abs-style-dock');
        if(await dock.count()) {
            if(width>900)await dock.hover();
            const animation=await dock.evaluate(el=>getComputedStyle(matchMedia('(hover:hover) and (pointer:fine)').matches?el.querySelector('.hud-theme-stack'):el).animationName);
            assert.equal(animation,motion==='reduce'?'none':'abs-dock-enter','The dock must pop up when revealed and respect reduced motion');
            await dock.evaluate(el=>Promise.all(el.getAnimations({subtree:true}).map(animation=>animation.finished)));
            const box=await dock.boundingBox();assert.ok(box.y+box.height<=1000 && box.x>=0 && box.x+box.width<=width,'Dock must fit the viewport');
            if(width>900) {
                await page.mouse.move(width-4,4);
                await dock.locator('button').first().focus();
                assert.equal(await dock.locator('.hud-theme-stack').evaluate(el=>getComputedStyle(el).animationName),motion==='reduce'?'none':'abs-dock-enter','Keyboard focus must reveal the same entrance animation');
            }
        }
        console.log(`PASS ${file} ${width}px ${motion}: Settings, modal outside/inside clicks, hidden X controls and dock entrance`);
        await page.close();
    }
} finally {await browser.close();server.close();}
