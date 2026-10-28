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
    const context=await browser.newContext({viewport:{width:1440,height:1000}});
    let mode='live';let uptimeRequests=0;
    await context.route('https://decapi.me/**',route=>{
        const url=route.request().url();
        if(url.includes('/avatar/'))return route.fulfill({body:'https://example.com/avatar.png'});
        uptimeRequests++;
        if(mode==='failed')return route.fulfill({status:503,body:'Service unavailable'});
        if(mode==='invalid')return route.fulfill({body:'Error: please retry in 30 seconds'});
        return route.fulfill({body:mode==='live'?'2 hours, 3 minutes':'Channel is offline'});
    });
    await context.route('https://www.youtube.com/@Goresh',route=>route.fulfill({contentType:'text/html',body:'<title>Goresh channel test</title>'}));
    await context.route('**/api/public/cards**',route=>route.fulfill({json:{schemaVersion:1,cards:[],nextCursor:null}}));
    const page=await context.newPage();
    const open=async file=>{
        await page.goto(`http://127.0.0.1:${server.address().port}/${file}`,{waitUntil:'domcontentloaded'});
        await page.waitForFunction(()=>window.absShellReady && window.ABSSidebarFeed && document.querySelectorAll('#abs-sidebar-twitch a').length===6);
        await page.evaluate(()=>{document.querySelector('#abs-loading-screen')?.remove();return ABSSidebarFeed.refresh();});
    };
    await open('index.html');
    assert.equal(await page.locator('[data-channel="theironcane"]').getAttribute('data-status'),'live');
    mode='failed';await open('support-memory.html');
    const iron=page.locator('[data-channel="theironcane"]');
    assert.equal(await iron.getAttribute('data-status'),'live','A navigation during an outage must preserve the recent confirmed status');
    assert.match(await iron.getAttribute('aria-label'),/last checked/);
    for(const file of ['support-memory.html','leader-compatibility.html','damage-received.html','calculator.html','editor.html','card.html?id=4031731']) {
        await open(file);
        const goresh=page.locator('#abs-sidebar-twitch [data-channel="goresh"]');
        console.log('Checking Goresh link on',file);
        assert.equal(await goresh.getAttribute('href'),'https://www.youtube.com/@Goresh');
        assert.equal(await goresh.getAttribute('data-status'),'not-applicable');
        // Some tools open their character selector on entry. Dismiss it before testing navigation.
        if(file==='calculator.html')await page.locator('#unitPickerModal .picker-unit-card').first().waitFor({state:'visible',timeout:45000});
        await page.keyboard.press('Escape');
        await page.mouse.move(24,500);
        const popupPromise=page.waitForEvent('popup').catch(()=>null);
        await goresh.click();
        const popup=await popupPromise;
        assert.ok(popup,'Goresh click must open the channel');
        await popup.waitForLoadState('domcontentloaded');
        assert.equal(popup.url(),'https://www.youtube.com/@Goresh');
        await popup.close();
    }
    mode='offline';await page.evaluate(()=>ABSSidebarFeed.refresh());
    assert.equal(await page.locator('[data-channel="theironcane"]').getAttribute('data-status'),'offline','A new confirmed response must replace the cached status');
    mode='invalid';await page.evaluate(()=>ABSSidebarFeed.refresh());
    assert.equal(await page.locator('[data-channel="theironcane"]').getAttribute('data-status'),'offline','An error containing seconds must not be treated as live');
    await page.evaluate(()=>{const old=Date.now;Date.now=()=>old()+11*60*1000;});
    mode='failed';await page.evaluate(()=>ABSSidebarFeed.refresh());
    assert.equal(await page.locator('[data-channel="theironcane"]').getAttribute('data-status'),'retrying','Expired results must not continue claiming a channel is live or offline');
    mode='live';const before=uptimeRequests;
    await page.evaluate(()=>Promise.all([ABSSidebarFeed.refresh(),ABSSidebarFeed.refresh(),ABSSidebarFeed.refresh()]));
    assert.equal(uptimeRequests-before,5,'Concurrent refreshes must share a single request per Twitch channel');
    assert.equal(await page.locator('[data-channel="theironcane"]').getAttribute('data-status'),'live');
    const noStorage=await browser.newContext({viewport:{width:390,height:900}});
    await noStorage.addInitScript(()=>Object.defineProperty(window,'sessionStorage',{get(){throw Error('Storage blocked');}}));
    await noStorage.route('https://decapi.me/**',route=>route.fulfill({status:503,body:'Unavailable'}));
    await noStorage.route('https://www.youtube.com/@Goresh',route=>route.fulfill({contentType:'text/html',body:'<title>Goresh channel test</title>'}));
    const mobile=await noStorage.newPage();
    await mobile.goto(`http://127.0.0.1:${server.address().port}/support-memory.html`,{waitUntil:'domcontentloaded'});
    await mobile.waitForFunction(()=>window.ABSSidebarFeed);
    await mobile.evaluate(()=>{document.querySelector('#abs-loading-screen')?.remove();return ABSSidebarFeed.refresh();});
    assert.equal(await mobile.locator('[data-channel="theironcane"]').getAttribute('data-status'),'retrying');
    assert.doesNotMatch(await mobile.locator('[data-channel="theironcane"]').getAttribute('aria-label'),/Status unavailable/i);
    await mobile.locator('[data-abs-drawer="abs-main-sidebar"]').click();
    const mobilePopupPromise=mobile.waitForEvent('popup');
    await mobile.locator('[data-channel="goresh"]').click();
    const mobilePopup=await mobilePopupPromise;
    await mobilePopup.waitForLoadState('domcontentloaded');
    assert.equal(mobilePopup.url(),'https://www.youtube.com/@Goresh');
    await mobilePopup.close();
    if(process.env.STREAMER_SCREENSHOT)await mobile.screenshot({path:process.env.STREAMER_SCREENSHOT});
    console.log('PASS Goresh links across six pages; outages across navigation, stale expiry, recovery, invalid responses, single refresh and blocked storage');
    await noStorage.close();await context.close();
} finally {await browser.close();server.close();}
