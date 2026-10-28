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
    await page.waitForFunction(() => document.querySelector('#cardsFilterModal .extra-filter-options') && document.querySelectorAll('#categoryFilterList button').length);
    await page.evaluate(() => document.querySelector('#abs-loading-screen')?.remove());
    for (const width of [1440, 768, 390]) {
        await page.setViewportSize({width,height:900});
        await page.locator('#cardsAdvancedFilterBtn').click({force:true});
        const modal = page.locator('#cardsFilterModal');
        await modal.waitFor({state:'visible'});
        await modal.evaluate(el => Promise.all(el.getAnimations({subtree:true}).map(a => a.finished)));
        const geometry = await modal.evaluate(el => {
            const rect = selector => {
                const node = el.querySelector(selector), r = node.getBoundingClientRect(), s = getComputedStyle(node);
                return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:r.height,scrollHeight:node.scrollHeight,clientHeight:node.clientHeight,flexShrink:s.flexShrink,position:s.position};
            };
            return Object.fromEntries(['.cards-filter-columns','.cards-filter-controls','.extra-card-filters','.extra-card-filters section:last-child','.cards-filter-categories','#categoryFilterGroup','.category-filter-heading','.category-filter-search-wrap','#categoryFilterSearch','#categoryFilterStatus','#categoryFilterList'].map(s => [s,rect(s)]));
        });
        if (process.env.LAYOUT_DEBUG) console.log(width, JSON.stringify(geometry));
        assert.ok(geometry['.cards-filter-controls'].bottom <= geometry['.cards-filter-categories'].top + 1, 'Controls overlap categories');
        assert.ok(geometry['.extra-card-filters section:last-child'].bottom <= geometry['.cards-filter-categories'].top + 1, 'Link skills overflow controls and overlap categories');
        assert.ok(geometry['.category-filter-heading'].bottom <= geometry['.category-filter-search-wrap'].top + 1, 'Category heading overlaps search');
        assert.ok(geometry['#categoryFilterSearch'].bottom <= geometry['#categoryFilterStatus'].top + 1, 'Category search overlaps status');
        assert.ok(geometry['#categoryFilterStatus'].bottom <= geometry['#categoryFilterList'].top + 1, 'Category status overlaps options');
        assert.ok(geometry['#categoryFilterSearch'].left >= geometry['.cards-filter-categories'].left && geometry['#categoryFilterSearch'].right <= geometry['.cards-filter-categories'].right + 1, 'Category search escapes drawer');
        const search = page.locator('#categoryFilterSearch');
        await search.fill('Pure Saiyans');
        const category = page.locator('#categoryFilterList button').filter({hasText:/^Pure Saiyans$/});
        await category.click();
        assert.ok(await category.evaluate(el => el.classList.contains('active')), 'Category selection failed');
        assert.equal(await search.inputValue(), 'Pure Saiyans');
        await page.getByLabel('Search mechanics', {exact:true}).fill('Revive');
        assert.equal(await page.locator('.extra-filter-options').first().locator('button:visible').count(), 1);
        await page.getByRole('button', {name:'Revive',exact:true}).click();
        assert.equal(await page.getByRole('button', {name:'Revive',exact:true}).getAttribute('aria-pressed'), 'true');
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
        await page.mouse.click(5, 400);
        await modal.waitFor({state:'hidden'});
        console.log(`PASS ${width}px: sections do not overlap; search, selection, scrolling, retained state, reset and dismissal work`);
    }
    console.log('PASS Cards drawer layout at desktop, tablet and mobile sizes');
} finally { await browser.close(); server.close(); }
