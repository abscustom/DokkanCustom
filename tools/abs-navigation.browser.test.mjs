import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {stat,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'file:///C:/Users/Ruffy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const workspace='G:/GitHub', root=path.join(workspace,'DokkanCustom');
const output=path.join(root,'docs/abs-refresh/reports/navigation-evidence');
await mkdir(output,{recursive:true});
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.webm':'video/webm','.lwf':'application/octet-stream'};
const server=createServer(async(req,res)=>{
 try {
  const url=new URL(req.url,'http://local');
  let file=path.resolve(workspace,'.'+decodeURIComponent(url.pathname));
  if(!file.startsWith(path.resolve(workspace)+path.sep))throw Error('outside workspace');
  if((await stat(file)).isDirectory())file=path.join(file,'index.html');
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});createReadStream(file).pipe(res);
 }catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}/DokkanCustom/`;
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const cases=[['home','index.html'],['cards','index.html?view=cards'],['news','index.html?view=news'],['editor','editor.html'],['viewer-clean','card.html?id=4031731&style=abs.clean'],['viewer-abs','card.html?id=4031731&style=abs.style'],['viewer-dokkan','card.html?id=4031731&style=dokkaninfo'],['calculator','calculator.html'],['damage','damage-received.html'],['leader','leader-compatibility.html'],['memory','support-memory.html']];
const requested=process.argv.find(value=>value.startsWith('--page='))?.slice(7);
const results=[];
try {
 for(const [name,url] of cases.filter(row=>!requested||row[0]===requested)) {
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  await context.route('https://api.github.com/**',route=>route.fulfill({status:503,body:'Local shell verification uses local data'}));
  const page=await context.newPage(), errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base+url,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.absShellReady,{timeout:30000});
  assert.equal(await page.locator('#nav-link-manager').count(),0,'unverified profile does not expose Manager on '+name);
  const loader=page.locator('#abs-loading-screen');
  if(await loader.count())await loader.waitFor({state:'hidden',timeout:45000}).catch(()=>{});
  if(name==='leader')await page.keyboard.press('Escape');
  if(name==='calculator') {
   await page.waitForFunction(()=>window.DokkanUnitPicker?.isOpen('unitPickerModal')===true,{timeout:30000});
   await page.keyboard.press('Escape');
   await page.waitForFunction(()=>window.DokkanUnitPicker?.isOpen('unitPickerModal')===false);
  }
  for(const mode of ['expanded','collapsed','mobile']) {
   if(mode==='expanded') { await page.locator('[data-abs-nav-pin]').click(); await page.mouse.move(1100,20); }
   if(mode==='collapsed') { await page.locator('[data-abs-nav-pin]').click(); await page.mouse.move(1100,20); }
   if(mode==='mobile') {
    await page.setViewportSize({width:390,height:844});
    await page.locator('[data-abs-drawer="abs-main-sidebar"]').click();
    const focus=await page.evaluate(()=>document.getElementById('abs-main-sidebar').contains(document.activeElement));
    assert.equal(focus,true,`${name}: drawer receives focus`);
    await page.keyboard.press('Shift+Tab');
    assert.equal(await page.evaluate(()=>document.getElementById('abs-main-sidebar').contains(document.activeElement)),true,`${name}: focus trap`);
   }
   const layout=await page.evaluate(()=>{
    const nav=document.getElementById('abs-main-sidebar'), context=document.getElementById('abs-context-sidebar');
    const bounds=node=>node?{x:node.getBoundingClientRect().x,y:node.getBoundingClientRect().y,width:node.getBoundingClientRect().width,height:node.getBoundingClientRect().height,right:node.getBoundingClientRect().right,bottom:node.getBoundingClientRect().bottom}:null;
    const links=[...nav.querySelectorAll('.hud-nav-link')].filter(node=>node.getClientRects().length);
    return {viewport:innerWidth,documentWidth:document.documentElement.scrollWidth,bodyZoom:getComputedStyle(document.body).zoom,nav:bounds(nav),context:bounds(context),contextVisible:context?getComputedStyle(context).display!=='none':false,navBackground:getComputedStyle(nav).backgroundImage,navCorners:getComputedStyle(nav).borderRadius,navGroups:document.querySelectorAll('#abs-main-sidebar .hud-nav-group').length,legacyWrappers:document.querySelectorAll('.apple-hud-wrapper').length,homeItems:nav.querySelectorAll('.hud-nav-link[aria-label="Home"]').length,sharedNewsSnippets:document.querySelectorAll('.dokkan-news-snippet').length,galaxy:document.querySelectorAll('#stars-bg-video,#abs-clean-grid-circuit').length,title:document.title,bodyScrollLeft:document.body.scrollLeft,content:bounds(document.querySelector('#hubMain,#top-content,#app,main.other-tool-main')),logo:nav.querySelector('.abs-sidebar-brand')?.getAttribute('aria-label'),targets:links.map(node=>{const b=node.getBoundingClientRect();return {label:node.getAttribute('aria-label'),width:b.width,height:b.height,hit:node.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)),visibility:getComputedStyle(node).visibility,inlineStyle:node.getAttribute('style'),visibilityRules:(()=>{const found=[];const scan=rules=>{for(const rule of rules){if(rule.selectorText && rule.style?.getPropertyValue('visibility')){try{if(node.matches(rule.selectorText))found.push({selector:rule.selectorText,value:rule.style.getPropertyValue('visibility'),priority:rule.style.getPropertyPriority('visibility')});}catch{}}if(rule.cssRules && (!rule.conditionText || matchMedia(rule.conditionText).matches))scan(rule.cssRules);}};for(const sheet of document.styleSheets){try{scan(sheet.cssRules);}catch{}}return found;})(),opacity:getComputedStyle(node).opacity,hitNode:document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)?.outerHTML.slice(0,350),parentStyle:[node.parentElement,node.parentElement.parentElement].map(item=>({tag:item.tagName,visibility:getComputedStyle(item).visibility,opacity:getComputedStyle(item).opacity,display:getComputedStyle(item).display,pointerEvents:getComputedStyle(item).pointerEvents})),right:b.right,bottom:b.bottom}}),contextActions:context?.querySelectorAll('.top-hud-btn').length||0,paddingLeft:parseFloat(getComputedStyle(document.body).paddingLeft),paddingRight:parseFloat(getComputedStyle(document.body).paddingRight)};
   });
   const memoryGrid=name==='memory'?await page.locator('#sm-memory-grid').boundingBox():null;
   const failures=[];
   if(errors.length)failures.push('uncaught page error');
   for(const [ok,message] of [[layout.documentWidth<=layout.viewport+1,'page overflow'],[layout.bodyZoom==='1','body zoom'],[layout.navGroups===1,'exactly one main nav group'],[layout.legacyWrappers===0,'obsolete wrapper removed'],[layout.homeItems===0,'Home menu removed'],[layout.sharedNewsSnippets===0,'shared news strips removed'],[layout.galaxy===0,'galaxy removed'],[layout.navBackground==='none','no nav grid'],[layout.logo==='ABS — Home','logo accessible Home link'],[!layout.title.toLowerCase().includes('abscustom'),'display branding'],[layout.targets.every(item=>item.hit),'navigation hit targets'],[layout.targets.every(item=>item.right<=layout.viewport && item.height>=36),'navigation bounds']])if(!ok)failures.push(message);
   if(mode!=='mobile' && layout.nav.x+layout.nav.width>layout.paddingLeft)failures.push('content reservation');
   if(layout.bodyScrollLeft!==0)failures.push('body horizontal scroll');
   if(name==='memory') {
    if(!layout.content || Math.abs(layout.content.x)>1 || Math.abs(layout.content.width-layout.viewport)>1)failures.push('Support Memory full-viewport canvas');
    if(mode!=='mobile' && (!memoryGrid || memoryGrid.x<layout.paddingLeft-1))failures.push('Support Memory inset gallery clears rail reservation');
   } else if(layout.content && (layout.content.x<layout.paddingLeft-1 || layout.content.right>layout.viewport-layout.paddingRight+1))failures.push('main content intersects rail or viewport');
   results.push({name,mode,...layout,errors:[...errors],failures});
   await page.screenshot({path:path.join(output,`${name}-${mode}.png`)});
   console.log(JSON.stringify({name,mode,failures,errors,documentWidth:layout.documentWidth,navWidth:layout.nav.width,contextActions:layout.contextActions}));
   if(mode==='mobile') {
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('[data-abs-drawer="abs-main-sidebar"]').getAttribute('aria-expanded'),'false',`${name}: Escape closes drawer`);
    assert.equal(await page.locator('[data-abs-drawer="abs-main-sidebar"]').evaluate(node=>node===document.activeElement),true,`${name}: Escape restores focus`);
    if(layout.contextActions) {
     await page.locator('[data-abs-drawer="abs-context-sidebar"]').click();
     assert.equal(await page.locator('#abs-main-sidebar').evaluate(node=>node.classList.contains('abs-drawer-open')),false,`${name}: mutually exclusive drawers`);
     await page.screenshot({path:path.join(output,`${name}-context-mobile.png`)});
     await page.keyboard.press('Escape');
    }
   }
  }
  await context.close();
 }
 await writeFile(path.join(output,requested?`${requested}-layout.json`:'layout.json'),JSON.stringify(results,null,2));
 assert.ok(results.every(row=>row.failures.length===0),JSON.stringify(results.filter(row=>row.failures.length).map(({name,mode,failures})=>({name,mode,failures}))));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
