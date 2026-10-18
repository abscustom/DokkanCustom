// Published files are read only; transformations stay in memory.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {fileURLToPath} from 'node:url';
import {DOMParser,createDOMContext} from '../src/html-dom.mjs';
import {chromium} from 'file:///C:/Users/Ruffy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import '../../../js/manager-card-transforms.js';
import {assetMask} from '../src/embedded-assets.mjs';
import {fixture} from './fixture.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const published=process.env.MANAGER_PUBLISHED_CARDS || 'G:/GitHub/abscustom/Custom Cards';
const output=path.join(root,'docs/abs-refresh/reports/manager-auth-evidence');await fs.mkdir(output,{recursive:true});
const transform=globalThis.createManagerCardTransforms({DOMParser});
const sha=text=>crypto.createHash('sha256').update(text).digest('hex');
const cards=[];
for(const item of await fs.readdir(published,{withFileTypes:true}))if(item.isDirectory()){
  const full=path.join(published,item.name,'index.html');let html;try{html=await fs.readFile(full,'utf8');}catch{continue;}
  let json=null;try{json=await fs.readFile(path.join(published,item.name,'card.json'),'utf8');}catch{}
  cards.push({slug:item.name,html,json,originalHash:sha(html),file:full});
}
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true}),results=[];
try{
 const page=await browser.newPage();await page.route('**/*',route=>route.abort());
 await page.addScriptTag({content:await fs.readFile(path.join(root,'js/manager-card-transforms.js'),'utf8')});
 for(let i=0;i<cards.length;i++){
  const a=cards[i],b=cards[(i+1)%cards.length];
  const expected=await page.evaluate(({a,b})=>{
    const t=window.createManagerCardTransforms({DOMParser});const source=t.parseCard(a.slug,a.html,'Custom Cards/'+a.slug),target=t.parseCard(b.slug,b.html,'Custom Cards/'+b.slug);
    const html=t.updateLinkedHtml(a.html,source,target,true);
    return {html,json:a.json===null?null:t.updateLinkedJson(a.json,html,target,true,source)};
  },{a,b});
  const sourceMetadata=transform.parseCard(a.slug,a.html,'Custom Cards/'+a.slug),targetMetadata=transform.parseCard(b.slug,b.html,'Custom Cards/'+b.slug);
  delete sourceMetadata.htmlText;delete targetMetadata.htmlText;
  const times=[];let actual;
  for(let n=0;n<7;n++){
    const start=performance.now(),mask=assetMask(),maskedA=mask.mask(a.html);
    const source=mask.card(sourceMetadata),target=mask.card(targetMetadata),local=globalThis.createManagerCardTransforms({DOMParser:createDOMContext()});
    const html=local.updateLinkedHtml(maskedA,source,target,true);
    const json=a.json===null?null:local.updateLinkedJson(mask.mask(a.json),html,target,true,source);
    actual={html:mask.restore(html),json:json===null?null:mask.restore(json)};
    times.push(performance.now()-start);
  }
  if(actual.html!==expected.html){let index=0;while(index<Math.min(actual.html.length,expected.html.length)&&actual.html[index]===expected.html[index])index++;console.error(JSON.stringify({slug:a.slug,index,actualLength:actual.html.length,expectedLength:expected.html.length,actual:actual.html.slice(Math.max(0,index-100),index+180),expected:expected.html.slice(Math.max(0,index-100),index+180)}));}
  assert.equal(sha(actual.html),sha(expected.html),`Full Chrome HTML parity: ${a.slug}`);
  assert.equal(actual.json===null?null:sha(actual.json),expected.json===null?null:sha(expected.json),`Full Chrome JSON parity: ${a.slug}`);
  assert.equal(sha(await fs.readFile(a.file,'utf8')),a.originalHash,'Published source must stay untouched');
  results.push({slug:a.slug,bytes:Buffer.byteLength(a.html),jsonBytes:a.json===null?0:Buffer.byteLength(a.json),htmlSha256:sha(actual.html),jsonSha256:actual.json===null?null:sha(actual.json),chromeByteParity:true,warmTransformMs:times.slice(2).sort((a,b)=>a-b),publishedUnchanged:true});
 }
 const f=fixture();f.files.clear();f.blobs.clear();for(const c of cards){f.add(`Custom Cards/${c.slug}/index.html`,c.html);if(c.json!==null)f.add(`Custom Cards/${c.slug}/card.json`,c.json);}
 const previousFetch=globalThis.fetch;globalThis.fetch=f.provider;let listing;
 try{const active=await f.login();listing=await f.catalog(active);assert.equal(listing.cards.length,cards.length);assert.equal(f.writes.length,0);}finally{globalThis.fetch=previousFetch;f.sql.close();}
 const report={cards:results,listedActualCards:listing.cards.length,note:'Local Node wall times are diagnostic, not Cloudflare CPU proof. HTML/JSON compared byte for byte against Chromium DOMParser. No published files changed and no live provider requests.',realGitHubWrites:0};
 await fs.writeFile(path.join(output,'real-card-proof.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
