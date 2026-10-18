// Local HTTP bridge, in-memory D1, synthetic GitHub only. No live provider requests.
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { chromium } from 'file:///C:/Users/Ruffy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import worker from '../src/worker.mjs';
import { fixture } from './fixture.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const output=path.join(root,'docs/abs-refresh/reports/manager-auth-evidence');
await fs.mkdir(output,{recursive:true});
const mime=file=>({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'}[path.extname(file)]||'application/octet-stream');
const providerFetch=globalThis.fetch;
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const results=[];
try {
 for(const width of [1280,390]) {
  const f=fixture();globalThis.fetch=f.provider;
  const canonical=f.env.MANAGER_ORIGIN;
  f.env.ASSETS={async fetch(request){const relative=decodeURIComponent(new URL(request.url).pathname).replace(/^\//,'');const full=path.resolve(root,'services/manager-auth/public',relative);if(!full.startsWith(path.join(root,'services/manager-auth/public')+path.sep))return new Response('',{status:404});try{return new Response(await fs.readFile(full),{headers:{'Content-Type':mime(full)}});}catch{return new Response('',{status:404});}}};
  let local;
  const server=http.createServer(async(req,res)=>{try{
    // Explicit test-only opt-in: ordinary localhost previews must use the hosted
    // Manager. Never change the tracked production routing configuration.
    if(new URL(req.url,'http://fixture').pathname==='/js/manager-auth-config.js') {
      res.writeHead(200,{'Content-Type':'text/javascript','Cache-Control':'no-store'});
      res.end('window.MANAGER_AUTH_CONFIG = Object.freeze('+JSON.stringify({workerOrigin:canonical,pagesOrigin:'https://abscustom.github.io',localWorkerOrigin:local})+');');return;
    }
    if(new URL(req.url,'http://fixture').pathname==='/__synthetic_authorize') {
      const query=new URL(req.url,'http://fixture').searchParams;
      assert.equal(query.get('redirect_uri'),local+'/auth/callback');
      res.writeHead(302,{Location:local+'/auth/callback?code=synthetic-code&state='+query.get('state')});res.end();return;
    }
    const chunks=[];for await(const c of req)chunks.push(c);const data=Buffer.concat(chunks);
    const headers=new Headers(req.headers);if(headers.get('Origin')===local)headers.set('Origin',canonical);
    const request=new Request(canonical+req.url,{method:req.method,headers,...(data.length?{body:data}: {})});
    const response=await worker.fetch(request,f.env);
    res.statusCode=response.status;
    for(const [key,value]of response.headers)if(key!=='set-cookie') {
      if(key==='location'&&value.startsWith('https://github.com/login/oauth/authorize?')) {
        const synthetic=new URL(local+'/__synthetic_authorize');synthetic.search=new URL(value).search;synthetic.searchParams.set('redirect_uri',local+'/auth/callback');res.setHeader(key,synthetic.href);
      } else res.setHeader(key,value);
    }
    const cookies=response.headers.getSetCookie();if(cookies.length)res.setHeader('Set-Cookie',cookies);
    res.end(Buffer.from(await response.arrayBuffer()));
  }catch(error){res.statusCode=500;res.end('Synthetic bridge failure');}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));local='http://127.0.0.1:'+server.address().port;
  const context=await browser.newContext({viewport:{width,height:900}}),errors=[],missing=[];
  await context.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.origin===local)return route.continue();
    if(url.hostname==='github.com') { await route.abort();throw new Error('The synthetic harness must never navigate to GitHub.'); }
    if(/\.(png|webp|jpg|jpeg|gif)(?:\?|$)/i.test(url.href))return route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64')});
    return route.fulfill({status:200,contentType:'text/css',body:''});
  });
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));page.on('response',r=>{if(r.url().startsWith(local)&&r.status()===404)missing.push(r.url().slice(local.length));});
  try {
    await page.goto(local+'/manager.html');await page.waitForFunction(()=>window.ManagerAuth&&window.CardAdminServer);
    await page.waitForFunction(()=>!document.getElementById('card-admin-github-signin').disabled);
    assert.equal(await page.locator('#card-admin-token').count(),0);
    await page.evaluate(()=>localStorage.setItem('gh_token','synthetic-editor-sentinel'));
    await page.locator('#card-admin-github-signin').click();
    await page.waitForFunction(()=>window.CardAdminCoins?.getSnapshot().cards.length===3);
    assert.equal(await page.locator('#card-admin-account').textContent(),'fixture-admin');
    assert.equal(f.writes.length,0);
    await page.locator('[data-coin-slug="alpha"]').click();await page.locator('[data-coin-slug="beta"]').click();
    await page.locator('#manager-coin-link-selected').click();
    assert.equal(f.writes.length,0,'Staging must never write');
    await page.screenshot({path:path.join(output,`manager-auth-${width}-staged.png`),fullPage:true});
    await page.locator('#manager-coin-apply').click();
    await page.waitForFunction(()=>window.CardAdminCoins.getSnapshot().cards.find(c=>c.slug==='alpha').links.includes('beta'));
    assert.equal(f.writes.filter(w=>w.path.endsWith('/git/refs/heads/main')).length,1);
    await page.reload();await page.waitForFunction(()=>window.CardAdminCoins?.getSnapshot().authenticated);
    assert.deepEqual(await page.evaluate(()=>window.CardAdminCoins.getSnapshot().cards.find(c=>c.slug==='beta').links),['alpha']);
    const storage=await page.evaluate(()=>({local:{...localStorage},session:{...sessionStorage},html:document.documentElement.outerHTML}));
    assert.equal(storage.local.gh_token,'synthetic-editor-sentinel');assert.doesNotMatch(JSON.stringify(storage),/synthetic-access|synthetic-refresh|synthetic-client-secret/);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
    await page.locator('[data-card-admin-delete="alpha"]').click();
    await page.locator('#card-admin-delete-confirm').fill('wrong');await page.locator('#card-admin-delete-confirm-button').click();
    assert.equal(f.writes.filter(w=>w.path.endsWith('/git/refs/heads/main')).length,1);
    await page.locator('#card-admin-delete-confirm').fill('alpha');await page.locator('#card-admin-delete-confirm-button').click();
    await page.waitForFunction(()=>window.CardAdminCoins.getSnapshot().cards.length===2);
    assert.equal(f.writes.filter(w=>w.path.endsWith('/git/refs/heads/main')).length,2);
    await page.screenshot({path:path.join(output,`manager-auth-${width}-saved.png`),fullPage:true});
    await page.locator('#card-admin-signout').click();await page.waitForFunction(()=>!window.CardAdminCoins.getSnapshot().authenticated);
    await page.reload();await page.waitForFunction(()=>!document.getElementById('card-admin-github-signin').disabled);
    assert.equal(await page.evaluate(()=>localStorage.getItem('gh_token')),'synthetic-editor-sentinel');
    await page.screenshot({path:path.join(output,`manager-auth-${width}-signed-out.png`),fullPage:true});
    assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
    results.push({width,checks:['GitHub sign-in navigation and callback','three cards loaded','staging has no writes','Apply one reciprocal non-forced commit','reload persists session and links','provider secrets absent from DOM/storage','wrong deletion confirmation blocks','exact deletion cleans reciprocal links','logout and reload signed out','Editor credential isolated','no horizontal overflow'],simulatedCommits:2,providerRequests:f.calls.length,pageErrors:errors,missingFiles:missing,realGitHubWrites:0});
  } catch(error) {
    const diagnostic={width,url:page.url(),text:await page.locator('body').innerText().catch(()=>''),pageErrors:errors,missingFiles:missing,cookieNames:(await context.cookies()).map(c=>c.name),providerPaths:f.calls.map(c=>new URL(c.url).pathname)};
    await fs.writeFile(path.join(output,`failure-${width}.json`),JSON.stringify(diagnostic,null,2));
    console.error(JSON.stringify(diagnostic,null,2));throw error;
  } finally {await context.close();await new Promise(resolve=>server.close(resolve));f.sql.close();}
 }
 await fs.writeFile(path.join(output,'browser-proof.json'),JSON.stringify(results,null,2));
 console.log(JSON.stringify(results,null,2));
} finally {await browser.close();globalThis.fetch=providerFetch;}
