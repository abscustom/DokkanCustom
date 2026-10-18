import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from '../src/worker.mjs';
import {ManagerService} from '../src/worker.mjs';
import { hash, random, unseal, seal, now, SESSION_COOKIE, IDLE_SECONDS } from '../src/security.mjs';
const origin = 'https://abs-manager-auth.trashullu.workers.dev';
const repo = '/repos/abscustom/abscustom.github.io';

export function fixture() {
  const sql = new DatabaseSync(':memory:');
  sql.exec(fs.readFileSync(new URL('../migrations/0001_sessions.sql',import.meta.url),'utf8'));
  sql.exec(fs.readFileSync(new URL('../migrations/0002_card_metadata.sql',import.meta.url),'utf8'));
  sql.exec(fs.readFileSync(new URL('../migrations/0003_profile_accounts.sql',import.meta.url),'utf8'));
  const DB = {prepare(query) { const stmt=sql.prepare(query);let values=[];return {bind(...args){values=args;return this;},async first(){return stmt.get(...values)||null;},async all(){return {results:stmt.all(...values)};},async run(){const result=stmt.run(...values);return {meta:{changes:Number(result.changes)}};}};},async batch(statements){return Promise.all(statements.map(s=>s.run()));}};
  const env = {DB,MANAGER_ORIGIN:origin,GITHUB_CLIENT_ID:'fixture-app',GITHUB_CLIENT_SECRET:'synthetic-client-secret',GITHUB_REPOSITORY_ID:'123',ADMIN_USER_IDS:'7',DELETE_USER_IDS:'7',TOKEN_ENCRYPTION_KEY:random(),ASSETS:{fetch:()=>new Response('Synthetic Manager')}};
  const object=new ManagerService({},env);
  env.MANAGER_SERVICE={idFromName:name=>name,get:()=>object};
  const files=new Map(), blobs=new Map(), writes=[], calls=[]; let serial=0, patchConflict=false, userId=7, loginName='fixture-admin', displayName='Fixture Admin', avatarUrl='https://avatars.githubusercontent.com/u/7?v=4', push=true, appWrite=true, refreshes=0;
  const add=(path,text,mode='100644')=>{const sha='b'+serial++;blobs.set(sha,text);files.set(path,{path,sha,mode,type:'blob',size:Buffer.byteLength(text)});};
  for(const slug of ['alpha','beta','gamma']) {
    const data={inputs:{nameInput:slug},currentType:'phy',thumbMain:`https://abscustom.github.io/Custom%20Cards/${slug}/portrait.png`,formsData:[{name:slug,link:`https://abscustom.github.io/Custom%20Cards/${slug}/`}],unrelated:{keep:true}};
    add(`Custom Cards/${slug}/index.html`,`<!DOCTYPE html><html><head><title>${slug}</title></head><body><script type="application/json" id="card-data">${JSON.stringify(data)}</script><script>window.fixture=true;</script></body></html>`);
    add(`Custom Cards/${slug}/card.json`,JSON.stringify(data));
    add(`Custom Cards/${slug}/portrait.png`,'SYNTHETIC IMAGE');
  }
  const trees=new Map(), commits=new Map();
  const respond=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
  const provider=async(url,init={})=>{
    const u=new URL(url), method=init.method||'GET';calls.push({url:String(url),method});
    if(u.origin==='https://github.com'&&u.pathname==='/login/oauth/access_token') {
      assert.equal(init.headers['User-Agent'],'ABS-Manager');
      assert.equal(init.redirect,'manual');
      const p=new URLSearchParams(init.body);assert.equal(p.get('client_secret'),env.GITHUB_CLIENT_SECRET);
      if(p.get('grant_type')==='refresh_token') {refreshes++;assert.equal(p.get('refresh_token'),'synthetic-refresh');}
      else {assert.equal(p.get('redirect_uri'),origin+'/auth/callback');assert.ok(p.get('code_verifier'));}
      return respond({access_token:'synthetic-access',refresh_token:'synthetic-refresh',expires_in:28800,refresh_token_expires_in:15552000});
    }
    assert.equal(u.origin,'https://api.github.com','Unexpected external request');
    assert.match(init.headers.Authorization,/^Bearer synthetic-access$/);
    const path=u.pathname;
    if(path==='/user') return respond({id:userId,login:loginName,name:displayName,avatar_url:avatarUrl});
    if(path===repo) return respond({id:123,full_name:'abscustom/abscustom.github.io',permissions:{push},archived:false});
    if(path==='/user/installations')return respond({installations:[{id:91,permissions:{contents:appWrite?'write':'read'}}]});
    if(path==='/user/installations/91/repositories')return respond({repositories:[{id:123,full_name:'abscustom/abscustom.github.io'}]});
    if(path===repo+'/git/ref/heads/main')return respond({object:{sha:'parent'}});
    if(path===repo+'/git/commits/parent')return respond({tree:{sha:'base'}});
    if(path===repo+'/git/trees/base')return respond({truncated:false,tree:[...files.values()]});
    if(method==='GET'&&path.startsWith(repo+'/git/blobs/'))return respond({encoding:'base64',content:Buffer.from(blobs.get(path.split('/').at(-1))).toString('base64')});
    const payload=JSON.parse(init.body||'{}');
    if(method==='POST'&&path===repo+'/git/blobs'){const sha='blob'+serial++;blobs.set(sha,payload.content);writes.push({path,payload});return respond({sha});}
    if(method==='POST'&&path===repo+'/git/trees'){const sha='tree'+serial++;trees.set(sha,payload.tree);writes.push({path,payload});return respond({sha});}
    if(method==='POST'&&path===repo+'/git/commits'){const sha='commit'+serial++;commits.set(sha,payload);writes.push({path,payload});return respond({sha});}
    if(method==='PATCH'&&path===repo+'/git/refs/heads/main'){
      assert.equal(payload.force,false);writes.push({path,payload});if(patchConflict)return respond({message:'synthetic upstream detail MUST NOT LEAK'},422);
      for(const entry of trees.get(commits.get(payload.sha).tree)){if(entry.sha===null)files.delete(entry.path);else files.set(entry.path,{...entry,size:Buffer.byteLength(blobs.get(entry.sha))});}
      return respond({object:{sha:payload.sha}});
    }
    throw new Error('Unexpected fixture GitHub route '+method+' '+path);
  };
  const request=(path,{method='GET',cookie='',csrf='',payload,originHeader=method==='POST'?origin:'',site='same-origin',headers={}}={})=>worker.fetch(new Request(origin+path,{method,headers:{...(cookie?{Cookie:cookie}:{}),'Sec-Fetch-Site':site,...(originHeader?{Origin:originHeader}:{}),...(method==='POST'?{'Content-Type':'application/json','X-CSRF-Token':csrf}:{}),...headers},...(payload===undefined?{}:{body:typeof payload==='string'?payload:JSON.stringify(payload)})}),env);
  const login=async()=>{
    const start=await request('/auth/start');assert.equal(start.status,302);
    const authURL=new URL(start.headers.get('Location'));assert.equal(authURL.searchParams.get('code_challenge_method'),'S256');
    const bind=start.headers.get('Set-Cookie').split(';')[0];
    const state=authURL.searchParams.get('state');
    const row=sql.prepare('SELECT verifier FROM oauth_states WHERE state_hash=?').get(await hash(state));
    assert.equal(await hash(row.verifier),authURL.searchParams.get('code_challenge'));
    const result=await request('/auth/callback?state='+state+'&code=synthetic-code',{cookie:bind,site:'cross-site'});
    assert.equal(result.status,303,await result.clone().text());
    const set=result.headers.getSetCookie().find(c=>c.startsWith(SESSION_COOKIE+'='));
    assert.match(set,/HttpOnly; Secure; SameSite=Lax; Max-Age=/);
    const cookieValue=set.split(';')[0], session=await request('/api/session',{cookie:cookieValue});
    assert.equal(session.status,200);const active={cookie:cookieValue,...await session.json()};
    await catalog(active);return active;
  };
  async function catalog(active) { for(let i=0;i<101;i++){const r=await request('/api/cards',active);if(r.status!==202){assert.equal(r.status,200,await r.clone().text());return r.json();}}throw new Error('Fixture catalog exceeded bounded requests'); }
  return {env,sql,files,blobs,writes,calls,provider,request,login,add,catalog,get refreshes(){return refreshes;},set userId(v){userId=v;},set loginName(v){loginName=v;},set displayName(v){displayName=v;},set avatarUrl(v){avatarUrl=v;},set push(v){push=v;},set appWrite(v){appWrite=v;},set patchConflict(v){patchConflict=v;}};
}
