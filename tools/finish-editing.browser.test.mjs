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
    const page=await browser.newPage({viewport:{width:1440,height:1000}});
    let popups=0;page.on('popup',()=>popups++);
    await page.route('**/api/public/cards**',route=>route.fulfill({json:{schemaVersion:1,cards:[],nextCursor:null}}));
    await page.route('https://decapi.me/**',route=>route.fulfill({body:'Channel is offline'}));
    await page.goto(`http://127.0.0.1:${server.address().port}/editor.html`,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.requestFinishCardEditing && window.CardContent && window.absProfile);
    await page.evaluate(()=>document.querySelector('#abs-loading-screen')?.remove());
    const setup=async()=>page.evaluate(()=>{
        window.IS_PUBLISHED=false;window.ADMIN_MODE=false;
        cardEditBaselineId=null;cardEditBaseline=null;finishAfterCardSave=false;
        window.currentContentCard={id:'save-test',revision:1,name:'Original'};
        window.saveProject={cardSource:'custom',inputs:{nameInput:'Original'},containers:{},currentType:'str'};
        window.getProjectDataObject=()=>structuredClone(saveProject);
        window.saveCalls=[];
        window.absProfile={saveCard:async(id,request)=>{saveCalls.push({id,request});return {card:{revision:2}};}};
        setAdminMode(true);
        saveProject.inputs.nameInput='Edited card';
        window.stopEditorAutosave?.();
    });
    const finish=async()=>{await page.evaluate(()=>requestFinishCardEditing());await page.locator('#finish-card-edit-dialog').waitFor({state:'visible'});};
    await setup();await finish();
    for(const width of [1440,390]) {
        await page.setViewportSize({width,height:1000});
        const styles=await page.evaluate(()=>{
            const dialog=document.querySelector('#finish-card-edit-dialog'),r=dialog.getBoundingClientRect();
            const edit=document.querySelector('.abs-profile-edit'),button=getComputedStyle(edit),line=getComputedStyle(edit,'::after');
            return {green:button.backgroundColor,divider:line.borderBottomWidth,buttons:[...dialog.querySelectorAll('button')].map(node=>{const s=getComputedStyle(node),b=node.getBoundingClientRect();return {padding:s.padding,font:s.fontSize,background:s.backgroundColor,contained:b.left>=r.left && b.right<=r.right,height:b.height};})};
        });
        assert.equal(styles.green,'rgb(25, 68, 45)','Finish editing must be green');
        assert.equal(styles.divider,'1px','Finish editing must have a divider');
        assert.equal(new Set(styles.buttons.map(button=>button.padding+'|'+button.font+'|'+button.background)).size,1,'All finish choices must use the same button theme');
        assert.ok(styles.buttons.every(button=>button.contained && button.height>=36),'Buttons must fit the modal at desktop and phone widths');
        if(process.env.SAVE_SCREENSHOT)await page.screenshot({path:process.env.SAVE_SCREENSHOT});
    }
    await page.locator('[data-finish="cancel"]').click();
    assert.equal(await page.evaluate(()=>ADMIN_MODE),true);
    assert.equal(await page.evaluate(()=>saveCalls.length),0);
    for(const dismiss of ['button','escape','backdrop']) {
        await setup();await finish();
        await page.locator('[data-finish="save"]').click();
        await page.locator('#card-save-dialog').waitFor({state:'visible'});
        assert.equal(await page.evaluate(()=>saveCalls.length),0,'Opening the save modal must not write');
        if(dismiss==='button')await page.locator('[data-cancel]').click();
        if(dismiss==='escape')await page.keyboard.press('Escape');
        if(dismiss==='backdrop')await page.mouse.click(5,5);
        await page.locator('#card-save-dialog').waitFor({state:'detached'});
        assert.equal(await page.evaluate(()=>finishAfterCardSave),false,'Cancelling a save must cancel the pending finish');
        await page.evaluate(()=>CardContent.publishCurrent());
        await page.locator('[data-save]').click();
        await page.waitForFunction(()=>currentContentCard.revision===2);
        assert.equal(await page.evaluate(()=>ADMIN_MODE),true,'A later ordinary save must keep editing');
    }
    await setup();await finish();
    await page.locator('[data-finish="leave"]').click();
    assert.equal(await page.evaluate(()=>ADMIN_MODE),false);
    assert.equal(await page.evaluate(()=>saveCalls.length),0);
    assert.equal(await page.evaluate(()=>saveProject.inputs.nameInput),'Edited card');
    await setup();await finish();
    await page.evaluate(()=>absProfile.saveCard=async()=>{throw Object.assign(Error('Conflict'),{status:409});});
    await page.locator('[data-finish="save"]').click();await page.locator('[data-save]').click();
    await page.waitForFunction(()=>document.querySelector('[data-save-status]').textContent.includes('newer revision'));
    assert.equal(await page.evaluate(()=>currentContentCard.revision),1);
    assert.equal(await page.evaluate(()=>ADMIN_MODE),true);
    assert.equal(await page.evaluate(()=>saveProject.inputs.nameInput),'Edited card');
    await page.locator('[data-cancel]').click();
    await setup();await finish();
    await page.locator('[data-finish="save"]').click();
    await page.evaluate(()=>absProfile.saveCard=()=>new Promise(resolve=>window.completeSave=resolve));
    await page.locator('[data-save]').click();
    await page.keyboard.press('Escape');assert.equal(await page.locator('#card-save-dialog').isVisible(),true,'An active save cannot be dismissed');
    await page.evaluate(()=>{saveProject.inputs.nameInput='Newer unsaved edit';completeSave({card:{revision:2}});});
    await page.waitForFunction(()=>currentContentCard.revision===2);
    assert.equal(await page.evaluate(()=>ADMIN_MODE),true,'New edits made after the snapshot must keep editing');
    assert.equal(await page.evaluate(()=>saveProject.inputs.nameInput),'Newer unsaved edit');
    await setup();await finish();
    await page.locator('[data-finish="save"]').click();await page.locator('[data-save]').click();
    await page.waitForFunction(()=>ADMIN_MODE===false);
    assert.equal(await page.evaluate(()=>currentContentCard.revision),2);
    assert.equal(popups,0,'Saving must stay inside the page');
    console.log('PASS in-page saving; keep editing, leave, save, cancellation, conflict, busy state and snapshot preservation');
} finally {await browser.close();server.close();}
