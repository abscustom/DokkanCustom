import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { fixture } from './fixture.mjs';
import { hash, random, now, SESSION_COOKIE } from '../src/security.mjs';

const site = 'https://abscustom.github.io';
const profileCookie = response => response.headers.getSetCookie().find(value=>value.startsWith('__Host-abs_profile_oauth_'))?.split(';')[0];
const managerCookie = response => response.headers.getSetCookie().find(value=>value.startsWith(SESSION_COOKIE+'='))?.split(';')[0];

async function beginProfile(f, { origin=site, callback='project' }={}) {
  const verifier=random(48), nonce=random(), challenge=await hash(verifier);
  const query=new URLSearchParams({origin,challenge,nonce,callback});
  const started=await f.request('/profile/start?'+query,{site:'cross-site'});
  assert.equal(started.status,302,await started.clone().text());
  return {verifier,nonce,challenge,started,cookie:profileCookie(started),state:new URL(started.headers.get('Location')).searchParams.get('state')};
}

async function finishProfile(f, started) {
  const callback=await f.request('/auth/callback?state='+started.state+'&code=synthetic-code',{cookie:started.cookie,site:'cross-site'});
  return {callback,url:new URL(callback.headers.get('Location')||site)};
}

async function exchangeProfile(f, started, callbackUrl, {origin=site,verifier=started.verifier,nonce=started.nonce}={}) {
  const params=new URLSearchParams(callbackUrl.hash.slice(1));
  return f.request('/profile/exchange',{method:'POST',originHeader:origin,site:'cross-site',payload:{ticket:params.get('ticket'),verifier,nonce}});
}

test('website profile login is separate from Manager authorization and preserves unified admin session',async t=>{
  await t.test('idempotent additive migration preserves previously issued Manager sessions',()=>{
    const sql=new DatabaseSync(':memory:');
    for(const filename of ['0001_sessions.sql','0002_card_metadata.sql'])sql.exec(fs.readFileSync(new URL('../migrations/'+filename,import.meta.url),'utf8'));
    sql.prepare('INSERT INTO sessions(id_hash,user_id,login,csrf,tokens,access_expires_at,refresh_expires_at,created_at,last_seen_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?)').run('legacy-hash','7','legacy-login','legacy-csrf','legacy-encrypted-tokens',100,200,1,1,300);
    const profileMigration=fs.readFileSync(new URL('../migrations/0003_profile_accounts.sql',import.meta.url),'utf8');
    sql.exec(profileMigration);sql.exec(profileMigration);
    const legacy=sql.prepare('SELECT * FROM sessions WHERE id_hash=?').get('legacy-hash');
    assert.equal(legacy.login,'legacy-login');assert.equal(legacy.tokens,'legacy-encrypted-tokens');
    for(const name of ['profile_oauth_states','profile_tickets','profile_sessions'])assert.ok(sql.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name));
    sql.close();
  });

  await t.test('ordinary GitHub member gets a scoped profile without repository or App checks',async()=>{
    const f=fixture();globalThis.fetch=f.provider;f.userId=8;f.push=false;f.appWrite=false;f.displayName='';f.avatarUrl='https://untrusted.example/avatar.png';f.env.TOKEN_ENCRYPTION_KEY='';
    const started=await beginProfile(f),auth=await finishProfile(f,started);
    assert.equal(auth.callback.status,303);assert.equal(auth.url.pathname,'/DokkanCustom/profile-callback.html');assert.equal(managerCookie(auth.callback),undefined);
    const exchange=await exchangeProfile(f,started,auth.url);assert.equal(exchange.status,200);
    assert.equal(exchange.headers.get('Access-Control-Allow-Origin'),site);assert.equal(exchange.headers.get('Access-Control-Allow-Credentials'),null);
    const data=await exchange.json();assert.equal(data.profile.login,'fixture-admin');assert.equal(data.profile.displayName,'fixture-admin');assert.equal(data.profile.avatarUrl,null);assert.equal(data.profile.role,'member');
    assert.deepEqual(data.managerAccess,{status:'not_admin'});assert.ok(data.token);assert.doesNotMatch(JSON.stringify(data),/257864199|synthetic-access|synthetic-refresh/);
    assert.equal(f.calls.filter(call=>call.url.startsWith('https://api.github.com/')).length,1);
    assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM sessions').get().n,0);
    assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM profile_sessions').get().n,1);
    assert.equal(f.sql.prepare('SELECT id_hash FROM profile_sessions').get().id_hash,await hash(data.token));
    f.env.TOKEN_ENCRYPTION_KEY=random();
    const managerApi=await f.request('/api/session',{headers:{Authorization:'Bearer '+data.token}});assert.equal(managerApi.status,401);
    assert.equal((await f.request('/profile/me',{originHeader:'http://localhost:3000',headers:{Authorization:'Bearer '+data.token}})).status,401);
    assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM profile_sessions').get().n,1);
    const me=await f.request('/profile/me',{originHeader:site,headers:{Authorization:'Bearer '+data.token}});assert.equal(me.status,200);
    const meData=await me.json();assert.equal(meData.profile.role,'member');assert.equal(meData.profile.login,'fixture-admin');assert.equal(meData.managerAccess.status,'not_admin');assert.equal(meData.token,undefined);
    f.env.ADMIN_USER_IDS='8';
    const refreshedRole=await (await f.request('/profile/me',{originHeader:site,headers:{Authorization:'Bearer '+data.token}})).json();
    assert.equal(refreshedRole.profile.role,'admin');assert.equal(refreshedRole.managerAccess.status,'not_admin');
    f.env.ADMIN_USER_IDS='7';
    f.sql.prepare('INSERT INTO sessions(id_hash,user_id,login,csrf,tokens,access_expires_at,refresh_expires_at,created_at,last_seen_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?)').run('other-user-session','99','other','csrf','encrypted',9999999999,9999999999,now(),now(),9999999999);
    const logout=await f.request('/profile/logout',{method:'POST',originHeader:site,headers:{Authorization:'Bearer '+data.token}});assert.equal(logout.status,200);
    assert.equal((await f.request('/profile/me',{originHeader:site,headers:{Authorization:'Bearer '+data.token}})).status,401);
    assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM sessions WHERE user_id=?').get('99').n,1);
    assert.equal(f.writes.length,0);
  });

  await t.test('admin profile sign-in sets the first-party Manager cookie only after all existing gates pass',async()=>{
    const f=fixture();globalThis.fetch=f.provider;
    const started=await beginProfile(f),auth=await finishProfile(f,started);
    assert.equal(auth.callback.status,303);const manager=managerCookie(auth.callback);assert.ok(manager);
    assert.match(auth.callback.headers.getSetCookie().find(value=>value.startsWith(SESSION_COOKIE+'=')),/HttpOnly; Secure; SameSite=Lax/);
    const exchange=await exchangeProfile(f,started,auth.url);assert.equal(exchange.status,200);const data=await exchange.json();
    assert.equal(data.profile.role,'admin');assert.equal(data.managerAccess.status,'ready');assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM sessions').get().n,1);
    const profileCheck=await f.request('/profile/me',{originHeader:site,headers:{Authorization:'Bearer '+data.token}});
    assert.equal((await profileCheck.json()).managerAccess.status,'ready','Manager access survives the next profile verification');
    const managerSession=await f.request('/api/session',{cookie:manager});assert.equal(managerSession.status,200);const managerData=await managerSession.json();
    assert.deepEqual(managerData.profile,{login:'fixture-admin',displayName:'Fixture Admin',avatarUrl:'https://avatars.githubusercontent.com/u/7?v=4',role:'admin'});
    const signedOut=await f.request('/profile/logout',{method:'POST',originHeader:site,headers:{Authorization:'Bearer '+data.token}});assert.equal(signedOut.status,200);
    assert.equal((await f.request('/api/session',{cookie:manager})).status,401);
    assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM sessions').get().n,0);
    assert.equal(f.writes.length,0);
  });

  await t.test('admin profile remains usable if Manager repository gate is restricted',async()=>{
    const f=fixture();globalThis.fetch=f.provider;f.push=false;
    const started=await beginProfile(f),auth=await finishProfile(f,started);assert.equal(auth.callback.status,303);assert.equal(managerCookie(auth.callback),undefined);
    const exchange=await exchangeProfile(f,started,auth.url);assert.equal(exchange.status,200);const data=await exchange.json();
    assert.equal(data.profile.role,'admin');assert.deepEqual(data.managerAccess,{status:'restricted',code:'REPOSITORY_ACCESS_DENIED'});
    assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM sessions').get().n,0);assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM profile_sessions').get().n,1);
    assert.equal((await f.request('/profile/me',{originHeader:site,headers:{Authorization:'Bearer '+data.token}})).status,200);
    assert.equal(f.writes.length,0);
  });

  await t.test('Manager logout revokes profile handles for the same verified user',async()=>{
    const f=fixture();globalThis.fetch=f.provider;
    const started=await beginProfile(f),auth=await finishProfile(f,started),manager=managerCookie(auth.callback);assert.ok(manager);
    const exchange=await exchangeProfile(f,started,auth.url),data=await exchange.json();
    f.sql.prepare("INSERT INTO profile_sessions(id_hash,user_id,origin,login,display_name,manager_access_status,created_at,last_seen_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?)").run('other-profile-hash','99',site,'other','Other','not_admin',now(),now(),9999999999);
    const session=await (await f.request('/api/session',{cookie:manager})).json();
    const logout=await f.request('/api/session/logout',{method:'POST',cookie:manager,csrf:session.csrfToken});assert.equal(logout.status,200);
    assert.equal((await f.request('/profile/me',{originHeader:site,headers:{Authorization:'Bearer '+data.token}})).status,401);
    assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM profile_sessions WHERE user_id=?').get('99').n,1);
  });

  await t.test('ticket is one-use, PKCE/origin bound, and CORS rejects non-allowlisted origins',async()=>{
    const f=fixture();globalThis.fetch=f.provider;
    const started=await beginProfile(f),auth=await finishProfile(f,started),params=new URLSearchParams(auth.url.hash.slice(1));
    const wrong=await f.request('/profile/exchange',{method:'POST',originHeader:site,payload:{ticket:params.get('ticket'),verifier:random(48),nonce:started.nonce}});assert.equal(wrong.status,400);
    const replay=await f.request('/profile/exchange',{method:'POST',originHeader:site,payload:{ticket:params.get('ticket'),verifier:started.verifier,nonce:started.nonce}});assert.equal(replay.status,400);
    const cors=await f.request('/profile/me',{originHeader:'https://attacker.example',headers:{Authorization:'Bearer '+random()}});assert.equal(cors.status,403);assert.equal(cors.headers.get('Access-Control-Allow-Origin'),null);
    const preflight=await f.request('/profile/exchange',{method:'OPTIONS',originHeader:site,headers:{'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type'}});assert.equal(preflight.status,204);assert.equal(preflight.headers.get('Access-Control-Allow-Origin'),site);assert.equal(preflight.headers.get('Access-Control-Allow-Credentials'),null);
    assert.equal(f.writes.length,0);
  });

  await t.test('profile start accepts only exact origins and fixed callback modes',async()=>{
    const f=fixture();globalThis.fetch=f.provider;
    for(const origin of ['http://localhost:3000','http://127.0.0.1:3000','http://localhost:4173','http://127.0.0.1:4173']) {
      for(const callback of ['project','root']) {
        const started=await beginProfile(f,{origin,callback});
        assert.equal(new URL(started.started.headers.get('Location')).searchParams.get('redirect_uri'),f.env.MANAGER_ORIGIN+'/auth/callback');
      }
    }
    const production=await beginProfile(f,{origin:site,callback:'project'});
    assert.equal(new URL(production.started.headers.get('Location')).searchParams.get('redirect_uri'),f.env.MANAGER_ORIGIN+'/auth/callback');
    for(const query of [
      '?origin=https%3A%2F%2Fattacker.example&challenge='+random()+'&nonce='+random()+'&callback=project',
      '?origin='+encodeURIComponent(site)+'&challenge='+random()+'&nonce='+random()+'&callback=https%3A%2F%2Fattacker.example',
      '?origin='+encodeURIComponent(site)+'&challenge='+random()+'&nonce='+random()+'&callback=root'
    ]) {const response=await f.request('/profile/start'+query);assert.equal(response.status,400);}
  });
});
