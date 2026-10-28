import test from 'node:test';
import assert from 'node:assert/strict';
import {contentFixture} from './content-fixture.mjs';
import {hash,random,now} from '../src/security.mjs';
import {readFileSync} from 'node:fs';

test('in-page saves require origin-bound profile, live admin authorization, and matching revision',async()=>{
 const f=contentFixture(), original=globalThis.fetch;globalThis.fetch=f.provider;
 try {
  const manager=await f.login();const token=random();
  const managerHash=await hash(manager.cookie.split('=')[1]);
  f.sql.prepare('INSERT INTO profile_sessions(id_hash,user_id,origin,login,display_name,manager_access_status,manager_session_hash,created_at,last_seen_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?)').run(await hash(token),'7','https://abscustom.github.io','fixture-admin','Fixture Admin','ready',managerHash,now(),now(),now()+3600);
  const payload={expectedRevision:0,card:{name:'Test',type:'str',rarity:'LR',repoPath:'Custom Cards/test',assetBase:'https://abscustom.github.io/Custom%20Cards/test/',payload:{inputs:{nameInput:'Test'},containers:{}},builtinForms:[],status:'published'}};
  const send=(overrides={})=>f.request('/profile/cards/test',{method:'POST',originHeader:'https://abscustom.github.io',headers:{Authorization:'Bearer '+token},payload,...overrides});
  assert.equal((await send({headers:{}})).status,401);
  assert.equal((await send({originHeader:'https://evil.example'})).status,403);
  const saved=await send();assert.equal(saved.status,200,await saved.clone().text());
  assert.equal(saved.headers.get('Access-Control-Allow-Origin'),'https://abscustom.github.io');
  assert.equal((await saved.json()).card.revision,1);
  assert.equal((await send()).status,409);
  payload.expectedRevision=1;f.push=false;
  assert.equal((await send()).status,403);
  f.push=true;f.sql.prepare('DELETE FROM sessions').run();
  assert.equal((await send()).status,401);
 }finally{globalThis.fetch=original;}
});

test('password profile saves remain origin-bound and revoke when the credential changes',async()=>{
 const f=contentFixture();
 f.sql.exec(readFileSync(new URL('../migrations/0004_password_sessions.sql',import.meta.url),'utf8'));
 f.env.ABSADMIN_PASSWORD_VERIFIER='scrypt-v1:'+ 'a'.repeat(32)+':'+ 'b'.repeat(64);
 const token=random();
 f.sql.prepare('INSERT INTO password_sessions(id_hash,profile_hash,origin,csrf,credential_version,expires_at) VALUES(?,?,?,?,?,?)').run(await hash(random()),await hash(token),'https://abscustom.github.io',random(),await hash(f.env.ABSADMIN_PASSWORD_VERIFIER),now()+3600);
 const payload={expectedRevision:0,card:{name:'Password Test',type:'str',rarity:'LR',repoPath:'Custom Cards/password-test',assetBase:'https://abscustom.github.io/Custom%20Cards/password-test/',payload:{inputs:{nameInput:'Password Test'},containers:{}},builtinForms:[],status:'published'}};
 const send=(overrides={})=>f.request('/profile/password/cards/password-test',{method:'POST',originHeader:'https://abscustom.github.io',headers:{Authorization:'Bearer lp_'+token},payload,...overrides});
 assert.equal((await send({headers:{}})).status,401);
 assert.equal((await send({originHeader:'https://evil.example'})).status,403);
 const saved=await send();assert.equal(saved.status,200,await saved.clone().text());
 assert.equal(saved.headers.get('Access-Control-Allow-Origin'),'https://abscustom.github.io');
 assert.equal((await saved.json()).card.revision,1);
 assert.equal((await send()).status,409);
 f.env.ABSADMIN_PASSWORD_VERIFIER='scrypt-v1:'+ 'c'.repeat(32)+':'+ 'd'.repeat(64);
 assert.equal((await send()).status,401);
});
