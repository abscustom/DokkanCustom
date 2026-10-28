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
    for(const [file,width,motion,nativeSupported=true] of [['editor.html',1440,'no-preference'],['editor.html',390,'no-preference'],['editor.html',1440,'reduce'],['editor.html',1440,'no-preference',false],['card.html?id=4031731',1440,'no-preference']]) {
        const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:motion});
        await page.addInitScript(nativeSupported=>{
            window.themeTransitions=[];
            if(!nativeSupported)document.startViewTransition=undefined;
            if(document.startViewTransition){const native=document.startViewTransition.bind(document);document.startViewTransition=update=>{const transition=native(update);themeTransitions.push(transition);return transition;};}
        },nativeSupported);
        await page.route('**/api/public/cards**',route=>route.fulfill({json:{schemaVersion:1,cards:[],nextCursor:null}}));
        await page.route('https://decapi.me/**',route=>route.fulfill({body:'Channel is offline'}));
        await page.goto(`http://127.0.0.1:${server.address().port}/${file}`,{waitUntil:'domcontentloaded'});
        await page.waitForFunction(()=>window.absShellReady && document.querySelector('#abs-style-dock img.phantom-theme-mark'));
        await page.evaluate(()=>document.querySelector('#abs-loading-screen')?.remove());
        assert.equal(await page.locator('#settingsDrawer .filter-group-title').filter({hasText:/^Card Theme Style$/}).count(),0,'Empty theme section must be removed from Settings');
        assert.equal(await page.locator('#abs-style-dock .hud-btn-indicator,#abs-style-dock small').count(),0);
        await page.waitForFunction(()=>{const logo=document.querySelector('#abs-style-dock img.phantom-theme-mark');return logo.complete && logo.naturalWidth>0;});
        if(file==='editor.html')await page.locator('#nameInput').evaluate(el=>el.value='Unsaved theme test');
        const before=await page.evaluate(()=>({name:document.querySelector('#nameInput')?.value,admin:window.ADMIN_MODE,id:window.currentContentCard?.id}));
        const ids=file==='editor.html'?['theme-btn-phantom','theme-btn-abs','theme-btn-info','theme-btn-sba']:['theme-btn-phantom','theme-btn-abs','theme-btn-sba'];
        for(const id of ids) {
            await page.locator('#'+id).click();
            await page.evaluate(()=>Promise.allSettled(themeTransitions.map(transition=>transition.finished)));
            await page.waitForFunction(id=>document.getElementById(id).classList.contains('active'),id);
            const after=await page.evaluate(()=>({name:document.querySelector('#nameInput')?.value,admin:window.ADMIN_MODE,id:window.currentContentCard?.id}));
            assert.deepEqual(after,before,'Theme changes must preserve the current card and editing state');
        }
        const count=await page.evaluate(()=>themeTransitions.length);
        assert.equal(count,motion==='reduce'||!nativeSupported?0:ids.length,'Style clicks must crossfade with native view transitions, respecting reduced motion');
        await page.evaluate(()=>{document.getElementById('theme-btn-phantom').click();document.getElementById('theme-btn-abs').click();document.getElementById('theme-btn-sba').click();});
        await page.evaluate(()=>Promise.allSettled(themeTransitions.map(transition=>transition.finished)));
        await page.waitForFunction(()=>document.getElementById('theme-btn-sba').classList.contains('active'));
        assert.equal(await page.evaluate(()=>localStorage.getItem('dokkan_published_card_theme')||localStorage.getItem('dokkan_selected_theme')),'abs-clean');
        if(process.env.THEME_SCREENSHOT && width===390)await page.screenshot({path:process.env.THEME_SCREENSHOT});
        await page.reload({waitUntil:'domcontentloaded'});
        await page.waitForFunction(()=>window.absShellReady && document.getElementById('theme-btn-sba')?.classList.contains('active'));
        assert.equal(await page.locator('#settingsDrawer .filter-group-title').filter({hasText:/^Card Theme Style$/}).count(),0);
        console.log(`PASS ${file} ${width}px ${motion} native=${nativeSupported}: clean Settings, Phantom logo, theme switching, transitions, rapid clicks, preserved state and saved preference`);
        await page.close();
    }
} finally {await browser.close();server.close();}
