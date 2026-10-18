// Cloudflare workerd runtime, local D1 and SQLite Durable Object only.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
const output=new URL('../../../docs/abs-refresh/reports/manager-auth-evidence/',import.meta.url);
await fs.mkdir(output,{recursive:true});
const bundled=await build({entryPoints:[new URL('../src/worker.mjs',import.meta.url).pathname.replace(/^\/(?=[A-Z]:)/,'')],bundle:true,write:false,format:'esm',platform:'neutral',mainFields:['module','main'],target:'es2022',external:['node:buffer']});
const mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:'manager',modules:true,script:bundled.outputFiles[0].text,compatibilityDate:'2026-10-16',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],durableObjects:{MANAGER_SERVICE:{className:'ManagerService',useSQLite:true}},bindings:{MANAGER_ORIGIN:'https://abs-manager-auth.trashullu.workers.dev',GITHUB_CLIENT_ID:'fixture-app',GITHUB_CLIENT_SECRET:'synthetic-client-secret',GITHUB_REPOSITORY_ID:'123',ADMIN_USER_IDS:'7',DELETE_USER_IDS:'7'},outboundService:()=>{throw new Error('External requests are forbidden in this runtime proof');}}]}));
try{
 const response=await mf.dispatchFetch('https://abs-manager-auth.trashullu.workers.dev/api/session');
 assert.equal(response.status,503);assert.equal((await response.json()).error.code,'CONFIG_REQUIRED');
 assert.equal(response.headers.get('X-Frame-Options'),'DENY');assert.equal(response.headers.get('Access-Control-Allow-Origin'),null);
 const root=await mf.dispatchFetch('https://abs-manager-auth.trashullu.workers.dev/',{redirect:'manual'});assert.equal(root.status,302);assert.equal(root.headers.get('Location'),'/manager.html');
 const db=await mf.getD1Database('DB');for(const filename of ['0001_sessions.sql','0002_card_metadata.sql','0003_profile_accounts.sql'])await db.exec((await fs.readFile(new URL('../migrations/'+filename,import.meta.url),'utf8')).replace(/--[^\n]*/g,'').replace(/\s+/g,' '));
 const tables=await db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
 for(const name of ['sessions','oauth_states','card_metadata','profile_oauth_states','profile_tickets','profile_sessions'])assert.ok(tables.results.some(row=>row.name===name));
 const challenge='c'.repeat(43),nonce='n'.repeat(43),query=new URLSearchParams({origin:'https://abscustom.github.io',challenge,nonce,callback:'project'});
 const started=await mf.dispatchFetch('https://abs-manager-auth.trashullu.workers.dev/profile/start?'+query,{redirect:'manual'});
 assert.equal(started.status,302);const authorization=new URL(started.headers.get('Location'));
 assert.equal(authorization.searchParams.get('redirect_uri'),'https://abs-manager-auth.trashullu.workers.dev/auth/callback');
 assert.equal(authorization.searchParams.get('code_challenge_method'),'S256');assert.match(started.headers.get('Set-Cookie'),/^__Host-abs_profile_oauth_/);
 const allowedOrigin='https://abscustom.github.io';
 const preflight=await mf.dispatchFetch('https://abs-manager-auth.trashullu.workers.dev/profile/exchange',{method:'OPTIONS',headers:{Origin:allowedOrigin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization,content-type'}});
 assert.equal(preflight.status,204);assert.equal(preflight.headers.get('Access-Control-Allow-Origin'),allowedOrigin);assert.equal(preflight.headers.get('Access-Control-Allow-Credentials'),null);
 const blocked=await mf.dispatchFetch('https://abs-manager-auth.trashullu.workers.dev/profile/me',{headers:{Origin:'https://attacker.example',Authorization:'Bearer '+'x'.repeat(43)}});
 assert.equal(blocked.status,403);assert.equal(blocked.headers.get('Access-Control-Allow-Origin'),null);
 const report={runtime:'local workerd/Miniflare',sqliteDurableObjectRouting:true,missingSecretsFailClosed:true,d1Migrations:true,profileStartAndCors:true,securityHeaders:true,externalRequests:0,deployment:false};
 await fs.writeFile(new URL('runtime-proof.json',output),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await mf.dispose();}
