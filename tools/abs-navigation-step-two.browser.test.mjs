import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {stat,mkdir,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'file:///C:/Users/Ruffy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const workspace='G:/GitHub',root=workspace+'/DokkanCustom',out=root+'/docs/abs-refresh/reports/navigation-step-two-evidence';
await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{try{let file=path.resolve(workspace,'.'+decodeURIComponent(new URL(req.url,'http://local').pathname));if(!file.startsWith(path.resolve(workspace)+path.sep))throw Error();if((await stat(file)).isDirectory())file=path.join(file,'index.html');res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream'});createReadStream(file).pipe(res);}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}/DokkanCustom/`;
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const cases=[['home','index.html',0],['cards','index.html?view=cards',0],['news','index.html?view=news',0],['editor','editor.html',4],['viewer-clean','card.html?id=4031731&style=abs.clean',3],['viewer-abs','card.html?id=4031731&style=abs.style',3],['viewer-info','card.html?id=4031731&style=dokkaninfo',3],['calculator','calculator.html',0],['damage','damage-received.html',0],['leader','leader-compatibility.html',0],['memory','support-memory.html',0]];
const results=[];
const iconMap={Cards:['equ_icon_same_chara.png',130,130],Viewer:['equ_icon_specific_chara.png',130,130],Calculator:['sugoroku_jewel_small_0072.png',90,90],Editor:['support_memory_enh_lv_base.png',52,56],News:['myp_icon_campaign.png',66,58],Support:['200254.png',198,198],Leader:['thumb_support_item_01910.png',200,200],Damage:['thumb_support_item_90001.png',200,200],Settings:['equ_icon_category.png',130,130]};
async function icons(page,label){
 const expectedCount=/^(damage|leader|memory) /.test(label)?8:9;
 await page.waitForFunction(count=>[...document.querySelectorAll('#abs-main-sidebar img.abs-nav-icon')].length===count&&[...document.querySelectorAll('#abs-main-sidebar img.abs-nav-icon')].every(n=>n.complete&&n.naturalWidth>0),expectedCount);
 const items=await page.locator('#abs-main-sidebar img.abs-nav-icon').evaluateAll(nodes=>nodes.map(n=>{
  const name=n.closest('.hud-nav-link').getAttribute('aria-label'),r=n.getBoundingClientRect();
  const alphaCenterRatio=name.startsWith('Leader')?101.5/200:name.startsWith('Damage')?96/200:null;
  return {label:name,src:n.src,natural:[n.naturalWidth,n.naturalHeight],layoutBox:[n.offsetWidth,n.offsetHeight],visualBox:[r.width,r.height],visualCenterX:r.x+r.width/2,visibleArtCenterX:alphaCenterRatio===null?null:r.x+r.width*alphaCenterRatio,fit:getComputedStyle(n).objectFit,filter:getComputedStyle(n).filter,alt:n.alt,hidden:n.getAttribute('aria-hidden')};
 }));
 const reference=items.find(i=>!i.label.startsWith('Leader')&&!i.label.startsWith('Damage'));
 assert.ok(reference,label+' standard icon slot for column center');
 for(const i of items){
  const key=Object.keys(iconMap).find(key=>i.label.toLowerCase().startsWith(key.toLowerCase())),expected=iconMap[key];
  assert.ok(expected,label+' mapped icon');assert.ok(i.src.endsWith('/assets/navigation/sidebar/'+expected[0]),label+' web relative icon');
  assert.deepEqual(i.natural,expected.slice(1),label+' original natural size');assert.deepEqual(i.layoutBox,[28,28],label+' fixed 28px layout slot');
  const visualSize=key==='Leader'?32:key==='Damage'?36:28;
  assert.ok(Math.abs(i.visualBox[0]-visualSize)<.1&&Math.abs(i.visualBox[1]-visualSize)<.1,label+' '+key+' visual size');
  if(i.visibleArtCenterX!==null)assert.ok(Math.abs(i.visibleArtCenterX-reference.visualCenterX)<.5,label+' '+key+' visible-art center matches shared icon column');
  assert.equal(i.fit,'contain');assert.equal(i.filter,'none');assert.equal(i.alt,'');assert.equal(i.hidden,'true');
 }
 return items;
}
async function settle(page){await page.waitForTimeout(380);}
async function geometry(page){return page.evaluate(()=>{const n=document.getElementById('abs-main-sidebar'),b=n.getBoundingClientRect(),logo=n.querySelector('.abs-sidebar-brand img'),slot=n.querySelector('.abs-sidebar-style-slot'),controls=slot&&!slot.hidden?[...slot.querySelectorAll('button')]:[];return {x:b.x,width:b.width,height:b.height,padding:parseFloat(getComputedStyle(document.body).paddingLeft),collapsed:document.documentElement.dataset.absNavCollapsed,pinned:document.documentElement.dataset.absNavPinned,logoTransform:getComputedStyle(logo).transform,logoHref:n.querySelector('.abs-sidebar-brand').href,slotHidden:!slot||slot.hidden,slotInert:slot?.inert,controls:controls.map(c=>({id:c.id,label:c.textContent.trim(),class:c.className,pressed:c.getAttribute('aria-pressed'),box:c.getBoundingClientRect().toJSON()})),pinDisplay:getComputedStyle(n.querySelector('[data-abs-nav-pin]')).display,overflow:document.documentElement.scrollWidth>innerWidth+1,contextActions:document.querySelectorAll('#abs-context-sidebar .top-hud-btn').length};});}
async function width(page,expected,label){await settle(page);const g=await geometry(page);assert.equal(g.width,expected,label);assert.equal(g.x,0,label+' flush');assert.equal(g.overflow,false,label+' overflow');if(expected<=224)assert.equal(g.padding,g.pinned==='true'?240:88,label+' pin-only reservation');return g;}
try{
 for(const [name,url,styles] of cases.filter(([name])=>!process.argv.includes('--motion-only')&&(!process.argv.find(v=>v.startsWith('--page='))||name===process.argv.find(v=>v.startsWith('--page=')).slice(7)))){
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  await context.route('https://api.github.com/**',r=>r.fulfill({status:503,body:'Local verification'}));
  const page=await context.newPage(),errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
  await page.goto(base+url,{waitUntil:'domcontentloaded',timeout:60000});await page.waitForFunction(()=>window.absShellReady,{timeout:30000});
  const destinations=await page.locator('#abs-main-sidebar [data-abs-main-destination]').evaluateAll(nodes=>nodes.map(n=>({id:n.dataset.absMainDestination,label:n.getAttribute('aria-label'),href:new URL(n.href).pathname,title:n.title,current:n.getAttribute('aria-current')})));
  if(!destinations.length)console.log(JSON.stringify({name,diagnostic:await page.evaluate(()=>({readyState:document.readyState,otherScript:document.querySelector('script[src*="other-nav.js"]')?.src,groups:document.querySelectorAll('#abs-main-sidebar .hud-nav-group').length,links:[...document.querySelectorAll('#abs-main-sidebar .hud-nav-link')].map(n=>({id:n.id,label:n.getAttribute('aria-label')})),navigation:!!window.absNavigation,bodyClass:document.body.className})),pageErrors:errors,otherRequests:requests.filter(url=>url.includes('other-nav.js'))}));
  assert.deepEqual(destinations.map(({id,label,href,title})=>({id,label,href,title})),[
   {id:'support-memory',label:'Support Memory',href:'/DokkanCustom/support-memory.html',title:'Support Memory'},
   {id:'leader-compatibility',label:'Leader Compatibility',href:'/DokkanCustom/leader-compatibility.html',title:'Leader Compatibility'},
   {id:'damage-received',label:'Damage Received',href:'/DokkanCustom/damage-received.html',title:'Damage Received'}
  ],name+' direct destination order and routes');
  assert.equal(await page.locator('#abs-main-sidebar .sba-other-nav-button,#sba-other-destinations-menu').count(),0,name+' retired Other dropdown');
  const currentDestination={damage:'damage-received',leader:'leader-compatibility',memory:'support-memory'}[name];
  assert.deepEqual(destinations.filter(item=>item.current==='page').map(item=>item.id),currentDestination?[currentDestination]:[],name+' active destination');
  await page.locator('#abs-loading-screen').waitFor({state:'hidden',timeout:45000}).catch(()=>{});
  if(name==='calculator'){await page.waitForFunction(()=>window.DokkanUnitPicker?.isOpen('unitPickerModal')===true,{timeout:30000});await page.keyboard.press('Escape');await page.waitForFunction(()=>window.DokkanUnitPicker?.isOpen('unitPickerModal')===false);}
  await page.keyboard.press('Escape');await page.mouse.click(900,10);await page.mouse.move(1000,500);
  const compact=await width(page,72,name+' compact');compact.icons=await icons(page,name+' compact');assert.equal(compact.logoTransform,'none',name+' upright logo');assert.ok(compact.slotHidden||compact.slotInert,name+' compact styles inert');
  assert.equal(requests.some(u=>u.includes('calculator-critical')),false,name+' existing Calculator icon');
  await page.mouse.move(30,300);const hover=await width(page,224,name+' hover');hover.icons=await icons(page,name+' hover');assert.equal(hover.controls.length,styles,name+' original style count');
  for(const c of hover.controls){assert.ok(c.box.width>=44&&c.box.height>=44,name+' style touch target');assert.ok(c.box.right<=224,name+' style inside rail');}
  await page.screenshot({path:out+'/'+name+'-expanded.png'});
  await page.mouse.move(900,500);await width(page,72,name+' leave');
  await page.mouse.move(30,300);await settle(page);await page.locator('[data-abs-nav-pin]').click();await page.mouse.move(900,500);
  const pinned=await width(page,224,name+' pinned');pinned.icons=await icons(page,name+' pinned');assert.equal(pinned.pinned,'true');assert.equal(await page.locator('[data-abs-nav-pin]').getAttribute('aria-pressed'),'true');
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.absShellReady);await page.locator('#abs-loading-screen').waitFor({state:'hidden',timeout:45000}).catch(()=>{});if(name==='calculator'){await page.waitForFunction(()=>window.DokkanUnitPicker?.isOpen('unitPickerModal')===true,{timeout:30000});}await page.keyboard.press('Escape');await page.mouse.move(900,500);await width(page,224,name+' pin restored');
  await page.locator('[data-abs-nav-pin]').click();await page.mouse.move(900,500);await width(page,72,name+' unpinned');
  await page.evaluate(()=>{document.activeElement?.blur();document.body.tabIndex=-1;document.body.focus();});await page.keyboard.press('Tab');
  // Tab into the existing logo rather than assuming the document's tab order.
  await page.locator('.abs-sidebar-brand').focus();await width(page,224,name+' keyboard');
  await page.evaluate(()=>document.body.focus());await width(page,72,name+' keyboard leave');
  await page.mouse.move(30,300);await settle(page);
  const switches=[];
  for(let i=0;i<styles;i++){const control=page.locator('.abs-sidebar-style-slot button').nth(i);const id=await control.getAttribute('id');await control.click();await settle(page);assert.equal(await control.evaluate(n=>n.classList.contains('active')||n.getAttribute('aria-pressed')==='true'),true,name+' live style callback');switches.push(await page.evaluate(id=>({id,body:document.body.className,button:id?document.getElementById(id)?.className:null,cards:document.body.dataset.cardsLayout,storage:{...localStorage}}),id));}
  if(name==='cards'){
   const layout=page.locator('#hubCardsSection .cards-workspace-actions .cards-layout-switcher');
   assert.equal(await layout.count(),1,'Cards retains the original page layout control');
   assert.equal(await page.locator('#abs-main-sidebar [data-cards-layout]').count(),0,'Cards layout choices are absent from the rail');
   await page.mouse.move(900,500);
   for(const value of ['simple','dokkan']){const control=layout.locator(`[data-cards-layout="${value}"]`);await control.click();await settle(page);assert.equal(await control.getAttribute('aria-pressed'),'true','Cards live page layout callback');assert.equal(await page.evaluate(value=>document.body.classList.contains('cards-layout-'+value),value),true,'Cards applied layout');assert.equal(await page.evaluate(()=>localStorage.getItem('hub_cards_layout')),value,'Cards existing layout storage');switches.push({layout:value,location:'page'});}
   await page.locator('.abs-sidebar-brand').click();await settle(page);assert.equal(await layout.isVisible(),false,'Cards controls hide with the Cards view');assert.ok((await page.url()).endsWith('/index.html'));await page.locator('#nav-btn-cards').click();await settle(page);assert.equal(await layout.isVisible(),true,'Cards controls return on the page');
  }
  await page.setViewportSize({width:390,height:844});await settle(page);await page.locator('[data-abs-drawer="abs-main-sidebar"]').click();await settle(page);
  const mobile=await geometry(page);mobile.icons=await icons(page,name+' mobile');assert.equal(mobile.pinDisplay,'none',name+' mobile pin hidden');assert.equal(await page.evaluate(()=>document.getElementById('abs-main-sidebar').contains(document.activeElement)),true,name+' drawer focus');
  for(const c of mobile.controls)assert.ok(c.box.right<=390&&c.box.width>=44,name+' mobile style reachable');
  await page.screenshot({path:out+'/'+name+'-mobile.png'});await page.keyboard.press('Escape');assert.equal(await page.locator('[data-abs-drawer="abs-main-sidebar"]').getAttribute('aria-expanded'),'false');assert.equal(await page.locator('[data-abs-drawer="abs-main-sidebar"]').evaluate(n=>n===document.activeElement),true);
  await settle(page);const ghosts=await page.evaluate(()=>[...document.querySelectorAll('#abs-main-sidebar *')].filter(n=>n.getClientRects().length&&getComputedStyle(n).visibility!=='hidden'&&getComputedStyle(n).display!=='none').map(n=>({tag:n.tagName,class:n.className,text:n.textContent.slice(0,80),visibility:getComputedStyle(n).visibility,display:getComputedStyle(n).display,html:n.outerHTML.slice(0,400)})));await writeFile(out+'/'+name+'-closed-mobile.json',JSON.stringify(ghosts,null,2));assert.equal(ghosts.length,0,name+' no closed mobile ghosts');
  if(name.startsWith('viewer-')){await page.goto(base+url,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.absShellReady);await page.locator('#abs-loading-screen').waitFor({state:'hidden',timeout:45000});}
  const coverage=[];
  for(const [w,h] of [[1024,768],[1920,1080],[390,844]]){
   await page.setViewportSize({width:w,height:h});await page.mouse.click(w-20,10);await page.mouse.move(w-20,h/2);await settle(page);
   for(const state of w>900?['compact','hover','pinned']:['mobile']){
    if(state==='hover'){await page.mouse.move(25,300);await settle(page);}
    if(state==='pinned'){await page.locator('[data-abs-nav-pin]').click();await page.mouse.move(w-20,h/2);await settle(page);}
    const edge=await page.evaluate(()=>{const b=document.body.getBoundingClientRect(),r=document.documentElement.getBoundingClientRect();return {viewport:[innerWidth,innerHeight],body:b.toJSON(),root:r.toJSON(),bodyColor:getComputedStyle(document.body).backgroundColor,rootColor:getComputedStyle(document.documentElement).backgroundColor,overflow:document.documentElement.scrollWidth>innerWidth+1,padding:parseFloat(getComputedStyle(document.body).paddingLeft),frames:[...document.querySelectorAll('.container-1220,#layout-abs-style')].filter(n=>n.getClientRects().length&&getComputedStyle(n).display!=='none').map(n=>({id:n.id,class:n.className,box:n.getBoundingClientRect().toJSON()})),headerTop:document.querySelector('.cards-workspace-header')?.getBoundingClientRect().top};});
    assert.equal(edge.body.x,0,name+' no outer horizontal margin');assert.ok(edge.body.width>=w&&edge.body.height>=h,name+' body fills viewport');assert.ok(edge.root.height>=h,name+' document fills viewport');assert.equal(edge.overflow,false,name+' common width overflow');assert.ok(edge.bodyColor.startsWith('rgb(')||edge.rootColor.startsWith('rgb('),name+' opaque edge canvas');
    await writeFile(out+'/coverage-diagnostic.json',JSON.stringify({name,state,...edge},null,2));for(const frame of edge.frames)assert.ok(frame.box.x>=0&&frame.box.right<=w+1,name+' child frame fits '+state);await page.screenshot({path:out+`/${name}-coverage-${w}-${state}.png`});coverage.push({state,...edge});
   }
   if(w>900){await page.locator('[data-abs-nav-pin]').click();await page.mouse.move(w-20,h/2);await settle(page);}
  }
  assert.deepEqual(errors,[],name+' errors');results.push({name,compact,hover,pinned,mobile,switches,coverage,errors});console.log(name+' pass');await context.close();
 }
 // Sample actual normal-motion frames and rapid reversals, including stationary hover.
 const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.route('https://api.github.com/**',r=>r.fulfill({status:503,body:'Local verification'}));const page=await context.newPage();await page.goto(base+'index.html?view=cards',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.absShellReady);await page.locator('#abs-loading-screen').waitFor({state:'hidden',timeout:45000}).catch(()=>{});await page.mouse.move(900,500);await settle(page);
 const frames=async()=>page.evaluate(async()=>{const samples=[];for(let i=0;i<24;i++){await new Promise(requestAnimationFrame);const n=document.getElementById('abs-main-sidebar'),b=n.getBoundingClientRect(),icon=n.querySelector('.abs-nav-icon').getBoundingClientRect(),label=n.querySelector('.hud-nav-link > span'),slot=n.querySelector('.abs-sidebar-style-slot');samples.push({width:b.width,padding:parseFloat(getComputedStyle(document.body).paddingLeft),iconX:icon.x,opacity:getComputedStyle(label).opacity,display:getComputedStyle(label).display,styleOpacity:slot?getComputedStyle(slot).opacity:'0',pinOpacity:getComputedStyle(n.querySelector('.abs-nav-pin-label')).opacity,bodyTransition:getComputedStyle(document.body).transition,navTransition:getComputedStyle(n).transition});}return samples;});
 await page.mouse.move(25,300);const enter=await frames();await writeFile(out+'/motion-diagnostic.json',JSON.stringify(enter,null,2));assert.ok(enter.some(g=>g.width>72&&g.width<224),'intermediate widths');assert.ok(enter.every(g=>g.padding===88),'hover overlays without content movement');assert.ok(Math.max(...enter.map(g=>g.iconX))-Math.min(...enter.map(g=>g.iconX))<1,'stable icons');assert.ok(enter.some(g=>Number(g.opacity)>0&&Number(g.opacity)<1),'label fades');await page.screenshot({path:out+'/motion-expanded.png'});
 await settle(page);await page.locator('[data-abs-nav-pin]').click();const pinFrames=await frames();assert.ok(pinFrames.some(g=>g.padding>88&&g.padding<240),'pin reserves space smoothly');await width(page,224,'pin transition end');await page.screenshot({path:out+'/motion-pinned.png'});await page.locator('[data-abs-nav-pin]').click();const unpinFrames=await frames();assert.ok(unpinFrames.some(g=>g.padding>88&&g.padding<240),'unpin releases space smoothly');await width(page,224,'unpin remains hovered overlay');
 for(let i=0;i<6;i++){await page.mouse.move(900,500);await page.waitForTimeout(45);await page.mouse.move(25,300);await page.waitForTimeout(45);}await width(page,224,'rapid hover final');await page.waitForTimeout(600);assert.equal((await geometry(page)).collapsed,'false','stationary hover remains open');await page.mouse.move(900,500);const leave=await frames();await width(page,72,'rapid leave final');
 await icons(page,'normal motion');
 assert.equal(await page.locator('.abs-calculator-icon').count(),0,'withdrawn icon integration removed');
 await page.goto(base+'editor.html',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.absShellReady);await page.locator('#abs-loading-screen').waitFor({state:'hidden',timeout:45000});await page.mouse.click(1000,10);await page.mouse.move(1000,500);await page.keyboard.press('Tab');await page.evaluate(()=>{document.body.tabIndex=-1;document.body.focus();});await settle(page);await page.locator('.abs-sidebar-brand').focus();const editorFocusMotion=await frames();await writeFile(out+'/editor-focus-motion-diagnostic.json',JSON.stringify(editorFocusMotion,null,2));assert.ok(editorFocusMotion.some(g=>Number(g.styleOpacity)>0&&Number(g.styleOpacity)<1),'Existing editor style slot fades');await width(page,224,'normal-motion keyboard expansion');assert.equal((await geometry(page)).controls.length,4,'normal-motion editor style controls');await page.locator('[data-abs-nav-pin]').focus();await page.keyboard.press('Enter');await page.evaluate(()=>{document.body.tabIndex=-1;document.body.focus();});assert.equal((await width(page,224,'normal-motion keyboard pin')).pinned,'true');await page.locator('[data-abs-nav-pin]').focus();await page.keyboard.press('Enter');await page.evaluate(()=>document.body.focus());await width(page,72,'normal-motion keyboard unpin');
 await context.close();
 await writeFile(out+'/'+(process.argv.find(v=>v.startsWith('--page='))?.slice(7)|| (process.argv.includes('--motion-only')?'motion':'results'))+'.json',JSON.stringify({results,motion:{enter,leave,pinFrames,unpinFrames,editorFocusMotion},icons:iconMap},null,2));
 console.log('motion, reversal and supplied PNG icons pass');
}finally{await browser.close();await new Promise(r=>server.close(r));}
