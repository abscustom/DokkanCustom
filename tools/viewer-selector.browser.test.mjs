import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {chromium} from 'file:///C:/Users/Ruffy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const root=process.cwd();
const index=await fs.readFile('index.html','utf8');
const styles=[...index.matchAll(/<link[^>]+href="(css\/[^"]+)"[^>]*>/g)].map(match=>`<link rel="stylesheet" href="${match[1]}">`).join('');
const fixture=`<!doctype html><html class="theme-abs-clean-dark"><head><meta name="viewport" content="width=device-width,initial-scale=1">${styles}</head><body class="theme-sba theme-abs-clean theme-abs-clean-dark abs-shell"><button id="nav-btn-viewer">Viewer <svg class="viewer-nav-cue"></svg></button><div id="viewer-card-picker"></div><script>
window.DB={cards:Array.from({length:180},(_,i)=>({id:1000000+i,name:'Test Goku '+i,element:10,rarity:5,categories:[i%2+1],pass_id:i%3+1,is_transform:i===0,open_at:'2026-01-01 00:00:00'})),categories:{1:{name:'Pure Saiyans'},2:{name:'Majin Power'}}};
window.getCardClassAndType=()=>({cardType:'STR'});window.getCardExactRarity=()=> 'TUR';
window.CardContent={enabled:()=>true,listCards:async()=>[{id:'custom',name:'Custom Goku',source:'custom',type:'str',categoryNames:['Pure Saiyans'],isTransformed:true}],toCatalogCard:c=>c,getCard:async()=>({payload:{containers:{passive:'Revives with 70% HP'}}})};
window.selectCard=(id,unused,mode)=>window.selected={id,mode};
</script><script src="js/release-time.js"></script><script src="js/unit-picker.js"></script><script src="js-card-details/viewer-card-picker.js"></script></body></html>`;
const server=http.createServer(async(req,res)=>{
    const pathname=new URL(req.url,'http://local').pathname;
    if(pathname==='/fixture.html')return res.writeHead(200,{'Content-Type':'text/html'}).end(fixture);
    const controlled=req.headers.referer?.includes('/fixture.html');
    if(controlled && pathname==='/json/passive_skills.json')return res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify([{id:1,description:'Revives with 70% HP'},{id:2,description:'Launches an additional attack'},{id:3,description:'Guards all attacks'}]));
    if(controlled && pathname==='/json/active_skills.json')return res.writeHead(200,{'Content-Type':'application/json'}).end('[]');
    const file=path.resolve(root,'.'+pathname);
    if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
    try{const data=await fs.readFile(file);res.writeHead(200,{'Content-Type':({'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream'}).end(data);}catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
    for(const width of [1440,390]) {
        const page=await browser.newPage({viewport:{width,height:900}});
        const errors=[];page.on('pageerror',error=>errors.push(error.message));
        await page.goto(`http://127.0.0.1:${server.address().port}/fixture.html`,{waitUntil:'load'});
        await page.evaluate(()=>toggleViewerCardPicker());
        const picker=page.locator('#viewer-card-picker'),cards=picker.locator('.picker-unit-card');
        await page.waitForFunction(()=>document.querySelectorAll('#viewer-card-picker .picker-unit-card').length>=30);
        await picker.evaluate(el=>Promise.all(el.getAnimations({subtree:true}).map(animation=>animation.finished)));
        assert.equal(await picker.locator('.lc-unit-picker-footer').isVisible(),false);
        assert.equal(await picker.getByText('Show more',{exact:true}).isVisible(),false);
        const custom=picker.locator('[data-source="custom"]');
        const badges=await custom.evaluate(el=>{
            const thumb=el.querySelector('.picker-thumb-wrapper').getBoundingClientRect(), badge=el.querySelector('.picker-state-badges').getBoundingClientRect();
            return {thumbTop:thumb.top,badgeTop:badge.top,badgeBottom:badge.bottom,thumbBottom:thumb.bottom,tooltip:el.title||el.dataset.pickerTooltip};
        });
        assert.ok(badges.badgeTop<=badges.thumbTop+1 && badges.badgeBottom<badges.thumbBottom-15,'Badges must sit at the circle corner');
        assert.match(badges.tooltip,/Custom Goku/);
        await page.evaluate(()=>window.firstPortrait=document.querySelector('#viewer-card-picker .picker-unit-card'));
        for(let attempt=0;attempt<12 && await cards.count()<181;attempt++) {
            const before=await cards.count();
            await picker.locator('.calc-picker-grid-viewport').evaluate(el=>el.scrollTop=el.scrollHeight);
            await page.waitForFunction(previous=>document.querySelectorAll('#viewer-card-picker .picker-unit-card').length>previous,before);
        }
        assert.equal(await cards.count(),181,'Scrolling must expose the entire catalog');
        assert.equal(await page.evaluate(()=>firstPortrait.isConnected),true,'Loading more must preserve existing portrait nodes');
        await picker.getByText('Categories',{exact:true}).click();
        await picker.getByLabel('Search categories',{exact:true}).fill('Pure');
        assert.equal(await picker.getByLabel('Character category',{exact:true}).locator('option[value="Majin Power"]').evaluate(el=>el.hidden),true);
        await picker.getByLabel('Character category',{exact:true}).selectOption('Pure Saiyans');
        await picker.getByText('Mechanics',{exact:true}).click();
        await picker.getByLabel('Character mechanic',{exact:true}).waitFor();
        await page.waitForFunction(()=>!document.querySelector('[aria-label="Character mechanic"]').disabled);
        await picker.getByLabel('Search mechanics',{exact:true}).fill('Revive');
        await picker.getByLabel('Character mechanic',{exact:true}).selectOption('Revive');
        await picker.locator('.picker-search-wrapper input').fill('Test Goku 0');
        assert.equal(await cards.count(),1,'Name, category and mechanic filters must combine');
        await cards.first().click();
        assert.deepEqual(await page.evaluate(()=>selected),{id:'1000000',mode:'base'});
        assert.equal(await picker.evaluate(el=>el.hidden),true,'Selection must dismiss immediately');
        await page.evaluate(()=>toggleViewerCardPicker());
        await page.keyboard.press('Escape');
        assert.equal(await picker.evaluate(el=>el.hidden),true,'Escape must dismiss without closing animation');
        assert.equal(await picker.getAttribute('data-picker-closing'),null);
        assert.equal(await page.locator('#nav-btn-viewer .viewer-nav-cue').evaluate(el=>getComputedStyle(el).color),'rgb(255, 255, 255)');
        await page.evaluate(()=>DokkanUnitPicker.open({id:'other-tool-picker',pageSize:10,items:Array.from({length:40},(_,i)=>i),getSearchText:String,renderItem:id=>{const button=document.createElement('button');button.textContent='Character '+id;return button;},onSelect:id=>window.otherSelection=id}));
        const other=page.locator('#other-tool-picker');
        assert.equal(await other.locator('.calc-picker-grid > button').count(),10,'Other tools keep their existing pagination');
        await other.getByRole('button',{name:'Show more',exact:true}).click();
        assert.equal(await other.locator('.calc-picker-grid > button').count(),20);
        await other.getByRole('button',{name:'Character 0',exact:true}).click();
        assert.equal(await page.evaluate(()=>otherSelection),0);
        assert.deepEqual(errors,[]);
        console.log(`PASS ${width}px: automatic loading, badges, tooltips, searchable category/mechanics filters, selection and immediate dismissal`);
        await page.close();
    }
    const page=await browser.newPage({viewport:{width:1440,height:1000}});
    await page.route('**/api/public/cards**',route=>route.fulfill({json:{schemaVersion:1,cards:[],nextCursor:null}}));
    await page.route('https://decapi.me/**',route=>route.fulfill({body:'Channel is offline'}));
    await page.goto(`http://127.0.0.1:${server.address().port}/calculator.html`,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.openUnitPickerModal && window.DokkanUnitPicker);
    await page.evaluate(()=>{document.querySelector('#abs-loading-screen')?.remove();openUnitPickerModal();});
    await page.locator('#unitPickerGrid .picker-unit-card').first().waitFor({state:'visible',timeout:45000});
    assert.equal(await page.getByLabel('Character type',{exact:true}).count(),1);
    await page.getByLabel('Character type',{exact:true}).selectOption('str');
    await page.waitForFunction(()=>document.querySelectorAll('#unitPickerGrid .picker-unit-card').length>0 && [...document.querySelectorAll('#unitPickerGrid .picker-unit-card')].every(el=>el.dataset.type==='str'));
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#unitPickerModal').isVisible(),false);
    await page.addScriptTag({url:`http://127.0.0.1:${server.address().port}/js-card-details/viewer-card-picker.js`});
    await page.evaluate(()=>{if(!document.querySelector('#viewer-card-picker')){const root=document.createElement('div');root.id='viewer-card-picker';document.body.append(root);}toggleViewerCardPicker();});
    const viewer=page.locator('#viewer-card-picker');
    await viewer.locator('.picker-unit-card').first().waitFor({state:'visible'});
    assert.equal(await viewer.locator('.lc-unit-picker-footer').isVisible(),false);
    await viewer.getByText('Mechanics',{exact:true}).click();
    await page.waitForFunction(()=>!document.querySelector('#viewer-card-picker [aria-label="Character mechanic"]').disabled);
    await viewer.getByLabel('Character mechanic',{exact:true}).selectOption('Revive');
    await viewer.locator('.picker-unit-card').first().waitFor({state:'visible'});
    if(process.env.VIEWER_SCREENSHOT)await page.screenshot({path:process.env.VIEWER_SCREENSHOT});
    await page.keyboard.press('Escape');
    console.log('PASS real Calculator portraits/type filtering/dismissal and real Viewer catalog/mechanics');
    await page.close();
} finally {await browser.close();server.close();}
