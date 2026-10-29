import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {chromium} from 'file:///C:/Users/Ruffy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const root = process.cwd();
const server = http.createServer(async (req, res) => {
    const file = path.resolve(root, '.' + new URL(req.url, 'http://local').pathname);
    if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
    try {
        const data = await fs.readFile(file);
        res.writeHead(200, {'Content-Type': ({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'})[path.extname(file)] || 'application/octet-stream'}).end(data);
    } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({channel:'chrome', headless:true});
try {
    const page = await browser.newPage();
    await page.route('**/api/public/cards**', route => route.fulfill({json:{schemaVersion:1,cards:[],nextCursor:null}}));
    await page.route('https://decapi.me/**', route => route.fulfill({body:'Channel is offline'}));
    await page.goto(`http://127.0.0.1:${server.address().port}/index.html?view=cards`, {waitUntil:'domcontentloaded'});
    await page.waitForFunction(() => document.querySelector('#cardsFilterModal .extra-filter-options button:not(:disabled)') && document.querySelectorAll('#categoryFilterList button').length && document.querySelectorAll('#cardsFilterModal details').length===3);
    await page.evaluate(() => document.querySelector('#abs-loading-screen')?.remove());
    for (const width of [1440, 768, 390]) {
        await page.setViewportSize({width,height:900});
        await page.locator('#cardsAdvancedFilterBtn').click({force:true});
        const modal = page.locator('#cardsFilterModal');
        await modal.waitFor({state:'visible'});
        await modal.evaluate(el => Promise.all(el.getAnimations({subtree:true}).map(a => a.finished)));
        assert.ok(await modal.locator('.calc-picker-title-text').evaluate(el=>el.getBoundingClientRect().width<=1),'Drawer title remains accessible without visible text');
        assert.equal(await modal.locator('.cards-filter-columns > .cards-filter-reset').count(),1);
        assert.equal(await modal.locator('details .mechanic-ko-option #koScreenFilter').count(),1);
        assert.ok(await modal.locator('.filter-pill-group').evaluateAll(groups=>groups.every(group=>{const r=group.getBoundingClientRect();return [...group.querySelectorAll('button')].every(button=>button.getBoundingClientRect().right<=r.right+1);})), 'Compact pills must fit their grid tracks');
        if(width===1440)assert.equal(await modal.locator('details[open]').count(),0,'Filter grids start collapsed');
        await page.getByLabel('EZA Status',{exact:true}).selectOption('eza');
        await page.getByLabel('Class',{exact:true}).selectOption('extreme');
        assert.equal(await page.evaluate(()=>CardSearchFilters.matches({id:'test',isEza:true,cardClass:'extreme'})),true);
        assert.equal(await page.evaluate(()=>CardSearchFilters.matches({id:'test',isEza:true,cardClass:'super'})),false);
        await modal.locator('.cards-filter-reset').click();
        if(process.env.LAYOUT_SCREENSHOT && width===1440)await page.screenshot({path:process.env.LAYOUT_SCREENSHOT.replace('.png','-closed.png')});
        for(const dropdown of await modal.locator('details').all())if(!await dropdown.getAttribute('open').then(value=>value!==null))await dropdown.locator('summary').click();
        const geometry = await modal.evaluate(el => {
            const rect = selector => {
                const node = el.querySelector(selector), r = node.getBoundingClientRect(), s = getComputedStyle(node);
                return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:r.height,scrollHeight:node.scrollHeight,clientHeight:node.clientHeight,flexShrink:s.flexShrink,position:s.position};
            };
            return Object.fromEntries(['.cards-filter-columns','.cards-filter-controls','.extra-card-filters','.extra-card-filters details:last-child','.cards-filter-categories','#categoryFilterGroup','.category-filter-search-wrap','#categoryFilterSearch','#categoryFilterList'].map(s => [s,rect(s)]));
        });
        if (process.env.LAYOUT_DEBUG) console.log(width, JSON.stringify(geometry));
        assert.ok(geometry['.cards-filter-controls'].bottom <= geometry['.cards-filter-categories'].top + 1, 'Controls overlap categories');
        assert.ok(geometry['.extra-card-filters details:last-child'].bottom <= geometry['.cards-filter-categories'].top + 1, 'Link skills overflow controls and overlap categories');
        assert.ok(geometry['#categoryFilterSearch'].bottom <= geometry['#categoryFilterList'].top + 1, 'Category search overlaps options');
        const fields=await modal.locator('input[type=search]').evaluateAll(nodes=>nodes.map(node=>{const s=getComputedStyle(node);return [s.fontFamily,s.fontSize,s.height,s.backgroundColor].join('|');}));
        assert.equal(new Set(fields).size,1,'All filter search fields share the same typography and field styling');
        assert.ok(geometry['#categoryFilterSearch'].left >= geometry['.cards-filter-categories'].left && geometry['#categoryFilterSearch'].right <= geometry['.cards-filter-categories'].right + 1, 'Category search escapes drawer');
        const search = page.locator('#categoryFilterSearch');
        await search.fill('Pure Saiyans');
        const category = page.locator('#categoryFilterList button').filter({hasText:/^Pure Saiyans$/});
        await category.click();
        assert.ok(await category.evaluate(el => el.classList.contains('active')), 'Category selection failed');
        assert.equal(await search.inputValue(), 'Pure Saiyans');
        if(process.env.LAYOUT_DEBUG)console.log('SEARCH INPUTS',await modal.locator('input').evaluateAll(nodes=>nodes.map(n=>({id:n.id,label:n.getAttribute('aria-label'),placeholder:n.placeholder,connected:n.isConnected}))));
        await page.getByLabel('Search mechanics', {exact:true}).fill('Revive');
        assert.equal(await page.locator('.extra-filter-options').first().locator('button:visible').count(), 1);
        await page.getByRole('button', {name:'Revive',exact:true}).click();
        assert.equal(await page.getByRole('button', {name:'Revive',exact:true}).getAttribute('aria-pressed'), 'true');
        await page.getByLabel('Search mechanics',{exact:true}).fill('KO');
        await modal.locator('.mechanic-ko-option').click();
        assert.equal(await page.locator('#koScreenFilter').isChecked(),true);
        await page.getByLabel('Search mechanics',{exact:true}).fill('');
        await search.scrollIntoViewIfNeeded();
        await search.click();
        const hit = await search.evaluate(el => {
            const r = el.getBoundingClientRect();
            return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === el;
        });
        assert.ok(hit, 'Another filter covers the category search after scrolling');
        if (process.env.LAYOUT_SCREENSHOT) await page.screenshot({path:process.env.LAYOUT_SCREENSHOT});
        await page.keyboard.press('Escape');
        await modal.waitFor({state:'hidden'});
        await page.locator('#cardsAdvancedFilterBtn').click({force:true});
        assert.equal(await search.inputValue(), 'Pure Saiyans', 'Closing drawer lost category search');
        assert.equal(await page.getByRole('button', {name:'Revive',exact:true}).getAttribute('aria-pressed'), 'true', 'Closing drawer lost mechanics selection');
        await page.locator('#cardsFilterModal .cards-filter-reset').click();
        assert.equal(await search.inputValue(), '');
        assert.equal(await page.getByRole('button', {name:'Revive',exact:true}).getAttribute('aria-pressed'), 'false');
        assert.equal(await page.locator('#koScreenFilter').isChecked(),false,'Reset clears the existing KO filter');
        await page.mouse.click(5, 400);
        await modal.waitFor({state:'hidden'});
        console.log(`PASS ${width}px: sections do not overlap; search, selection, scrolling, retained state, reset and dismissal work`);
    }
    console.log('PASS Cards drawer layout at desktop, tablet and mobile sizes');
} finally { await browser.close(); server.close(); }
