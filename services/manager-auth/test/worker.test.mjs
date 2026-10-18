import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from '../src/worker.mjs';
import { hash, random, unseal, seal, now, SESSION_COOKIE, IDLE_SECONDS } from '../src/security.mjs';
const origin = 'https://abs-manager-auth.trashullu.workers.dev';
const repo = '/repos/abscustom/abscustom.github.io';


import { fixture } from './fixture.mjs';

test('Manager auth and exact semantic GitHub operations (all provider traffic intercepted)',async t=>{
  const realFetch=globalThis.fetch;
  try {
    await t.test('callback displays only fixed diagnostic codes for state, denial, token exchange and allowlist failures', async()=>{
      const f=fixture();globalThis.fetch=f.provider;
      const start=await f.request('/auth/start'),state=new URL(start.headers.get('Location')).searchParams.get('state'),binding=start.headers.get('Set-Cookie').split(';')[0];
      const mismatch=await f.request('/auth/callback?state='+random()+'&code=private-code',{cookie:binding});
      assert.match(await mismatch.text(),/OAUTH_STATE_INVALID/);
      const denied=await f.request('/auth/callback?state='+state+'&error=access_denied&error_description=private-description',{cookie:binding});
      const deniedBody=await denied.text();assert.match(deniedBody,/OAUTH_DENIED/);assert.doesNotMatch(deniedBody,/access_denied|private-description|private-code|state=/);

      const rejectedStart=await f.request('/auth/start'),rejectedState=new URL(rejectedStart.headers.get('Location')).searchParams.get('state'),rejectedCookie=rejectedStart.headers.get('Set-Cookie').split(';')[0];
      const realFetch=f.provider;globalThis.fetch=async(url,init)=>new URL(url).pathname==='/login/oauth/access_token'
        ? new Response(JSON.stringify({error:'bad_verification_code',error_description:'PRIVATE_PROVIDER_TEXT'}),{status:200})
        : realFetch(url,init);
      const rejected=await f.request('/auth/callback?state='+rejectedState+'&code=private-code',{cookie:rejectedCookie});
      const rejectedBody=await rejected.text();assert.match(rejectedBody,/OAUTH_TOKEN_CODE_REJECTED/);assert.doesNotMatch(rejectedBody,/bad_verification_code|PRIVATE_PROVIDER_TEXT|private-code/);

      for(const [providerError,expectedCode] of [
        ['incorrect_client_credentials','OAUTH_TOKEN_INCORRECT_CREDENTIALS'],
        ['redirect_uri_mismatch','OAUTH_TOKEN_REDIRECT_MISMATCH'],
        ['unverified_user_email','OAUTH_TOKEN_EMAIL_UNVERIFIED'],
        ['unspecified_private_error','OAUTH_TOKEN_REJECTED']
      ]) {
        const tokenErrorStart=await f.request('/auth/start'),tokenErrorState=new URL(tokenErrorStart.headers.get('Location')).searchParams.get('state'),tokenErrorCookie=tokenErrorStart.headers.get('Set-Cookie').split(';')[0];
        globalThis.fetch=async(url,init)=>new URL(url).pathname==='/login/oauth/access_token'
          ? new Response(JSON.stringify({error:providerError,error_description:'PRIVATE_PROVIDER_TEXT'}),{status:200})
          : realFetch(url,init);
        const tokenError=await f.request('/auth/callback?state='+tokenErrorState+'&code=private-code',{cookie:tokenErrorCookie});
        const tokenErrorBody=await tokenError.text();assert.match(tokenErrorBody,new RegExp(expectedCode));assert.doesNotMatch(tokenErrorBody,/incorrect_client_credentials|redirect_uri_mismatch|unverified_user_email|unspecified_private_error|PRIVATE_PROVIDER_TEXT|private-code/);
      }

      const httpStart=await f.request('/auth/start'),httpState=new URL(httpStart.headers.get('Location')).searchParams.get('state'),httpCookie=httpStart.headers.get('Set-Cookie').split(';')[0];
      globalThis.fetch=async(url,init)=>new URL(url).pathname==='/login/oauth/access_token'
        ? new Response(JSON.stringify({error:'private-provider-error',error_description:'PRIVATE_HTTP_BODY'}),{status:403})
        : realFetch(url,init);
      const httpFailure=await f.request('/auth/callback?state='+httpState+'&code=private-code',{cookie:httpCookie});
      const httpBody=await httpFailure.text();assert.match(httpBody,/OAUTH_EXCHANGE_HTTP_403/);assert.doesNotMatch(httpBody,/private-provider-error|PRIVATE_HTTP_BODY|private-code/);

      const redirectStart=await f.request('/auth/start'),redirectState=new URL(redirectStart.headers.get('Location')).searchParams.get('state'),redirectCookie=redirectStart.headers.get('Set-Cookie').split(';')[0];
      globalThis.fetch=async(url,init)=>new URL(url).pathname==='/login/oauth/access_token'
        ? new Response('PRIVATE_REDIRECT_BODY',{status:302,headers:{Location:'https://private.example/redirect'}})
        : realFetch(url,init);
      const redirectFailure=await f.request('/auth/callback?state='+redirectState+'&code=private-code',{cookie:redirectCookie});
      const redirectBody=await redirectFailure.text();assert.match(redirectBody,/OAUTH_EXCHANGE_REDIRECT/);assert.doesNotMatch(redirectBody,/PRIVATE_REDIRECT_BODY|private\.example|private-code/);

      const rateLimitStart=await f.request('/auth/start'),rateLimitState=new URL(rateLimitStart.headers.get('Location')).searchParams.get('state'),rateLimitCookie=rateLimitStart.headers.get('Set-Cookie').split(';')[0];
      globalThis.fetch=async(url,init)=>new URL(url).pathname==='/login/oauth/access_token'
        ? new Response('PRIVATE_RATE_LIMIT_BODY',{status:429})
        : realFetch(url,init);
      const rateLimitFailure=await f.request('/auth/callback?state='+rateLimitState+'&code=private-code',{cookie:rateLimitCookie});
      const rateLimitBody=await rateLimitFailure.text();assert.match(rateLimitBody,/OAUTH_EXCHANGE_HTTP_429/);assert.doesNotMatch(rateLimitBody,/PRIVATE_RATE_LIMIT_BODY|private-code/);

      const serverErrorStart=await f.request('/auth/start'),serverErrorState=new URL(serverErrorStart.headers.get('Location')).searchParams.get('state'),serverErrorCookie=serverErrorStart.headers.get('Set-Cookie').split(';')[0];
      globalThis.fetch=async(url,init)=>new URL(url).pathname==='/login/oauth/access_token'
        ? new Response('PRIVATE_SERVER_ERROR_BODY',{status:503})
        : realFetch(url,init);
      const serverError=await f.request('/auth/callback?state='+serverErrorState+'&code=private-code',{cookie:serverErrorCookie});
      const serverErrorBody=await serverError.text();assert.match(serverErrorBody,/OAUTH_EXCHANGE_HTTP_5XX/);assert.doesNotMatch(serverErrorBody,/PRIVATE_SERVER_ERROR_BODY|private-code/);

      const networkStart=await f.request('/auth/start'),networkState=new URL(networkStart.headers.get('Location')).searchParams.get('state'),networkCookie=networkStart.headers.get('Set-Cookie').split(';')[0];
      globalThis.fetch=async(url,init)=>new URL(url).pathname==='/login/oauth/access_token'
        ? Promise.reject(new TypeError('PRIVATE_NETWORK_DETAIL'))
        : realFetch(url,init);
      const networkFailure=await f.request('/auth/callback?state='+networkState+'&code=private-code',{cookie:networkCookie});
      const networkBody=await networkFailure.text();assert.match(networkBody,/OAUTH_EXCHANGE_FETCH_FAILED/);assert.doesNotMatch(networkBody,/PRIVATE_NETWORK_DETAIL|private-code/);

      const timeoutStart=await f.request('/auth/start'),timeoutState=new URL(timeoutStart.headers.get('Location')).searchParams.get('state'),timeoutCookie=timeoutStart.headers.get('Set-Cookie').split(';')[0];
      globalThis.fetch=async(url,init)=>new URL(url).pathname==='/login/oauth/access_token'
        ? Promise.reject(Object.assign(new TypeError('PRIVATE_TIMEOUT_DETAIL'),{name:'TimeoutError'}))
        : realFetch(url,init);
      const timeoutFailure=await f.request('/auth/callback?state='+timeoutState+'&code=private-code',{cookie:timeoutCookie});
      const timeoutBody=await timeoutFailure.text();assert.match(timeoutBody,/OAUTH_EXCHANGE_TIMEOUT/);assert.doesNotMatch(timeoutBody,/PRIVATE_TIMEOUT_DETAIL|private-code/);

      const invalidStart=await f.request('/auth/start'),invalidState=new URL(invalidStart.headers.get('Location')).searchParams.get('state'),invalidCookie=invalidStart.headers.get('Set-Cookie').split(';')[0];
      globalThis.fetch=async(url,init)=>new URL(url).pathname==='/login/oauth/access_token'
        ? new Response('null',{status:200})
        : realFetch(url,init);
      const invalid=await f.request('/auth/callback?state='+invalidState+'&code=private-code',{cookie:invalidCookie});
      const invalidBody=await invalid.text();assert.match(invalidBody,/OAUTH_TOKEN_INVALID/);assert.doesNotMatch(invalidBody,/private-code/);

      const deniedUserStart=await f.request('/auth/start'),deniedUserState=new URL(deniedUserStart.headers.get('Location')).searchParams.get('state'),deniedUserCookie=deniedUserStart.headers.get('Set-Cookie').split(';')[0];
      globalThis.fetch=async(url,init)=>new URL(url).origin==='https://api.github.com'&&new URL(url).pathname==='/user'
        ? new Response(JSON.stringify({id:99,login:'private-login'}),{status:200})
        : realFetch(url,init);
      const deniedUser=await f.request('/auth/callback?state='+deniedUserState+'&code=private-code',{cookie:deniedUserCookie});
      const deniedUserBody=await deniedUser.text();assert.match(deniedUserBody,/ACCESS_DENIED/);assert.doesNotMatch(deniedUserBody,/private-login|private-code|synthetic-access/);

      const apiFailure=async(path,expectedCode,makeResponse,hidden=[])=>{
        const apiStart=await f.request('/auth/start'),apiState=new URL(apiStart.headers.get('Location')).searchParams.get('state'),apiCookie=apiStart.headers.get('Set-Cookie').split(';')[0];
        globalThis.fetch=async(url,init)=>{
          const target=new URL(url);
          if(target.origin==='https://api.github.com'&&target.pathname===path)return makeResponse();
          return realFetch(url,init);
        };
        const result=await f.request('/auth/callback?state='+apiState+'&code=private-code',{cookie:apiCookie});
        const page=await result.text();assert.match(page,new RegExp(expectedCode));
        assert.doesNotMatch(page,/PRIVATE_GITHUB_BODY|private\.example|private-code|257864199|1144608552/);
        for(const value of hidden)assert.doesNotMatch(page,new RegExp(value));
      };
      for(const [path,expectedCode] of [
        ['/user','GITHUB_ACCOUNT_HTTP_403'],
        ['/repos/abscustom/abscustom.github.io','GITHUB_REPOSITORY_HTTP_403'],
        ['/user/installations','GITHUB_APP_INSTALLATIONS_HTTP_403'],
        ['/user/installations/91/repositories','GITHUB_APP_INSTALLATION_REPOSITORIES_HTTP_403']
      ]) await apiFailure(path,expectedCode,()=>new Response('PRIVATE_GITHUB_BODY',{status:403}));
      await apiFailure('/user/installations','GITHUB_APP_INSTALLATIONS_PRIMARY_RATE_LIMIT',()=>new Response('PRIVATE_GITHUB_BODY',{status:403,headers:{'X-RateLimit-Remaining':'0'}}));
      await apiFailure('/user/installations','GITHUB_APP_INSTALLATIONS_SECONDARY_RATE_LIMIT',()=>new Response('PRIVATE_GITHUB_BODY',{status:429,headers:{'Retry-After':'60'}}));
      await apiFailure('/user/installations','GITHUB_APP_INSTALLATIONS_SSO_REQUIRED',()=>new Response('PRIVATE_GITHUB_BODY',{status:403,headers:{'X-GitHub-SSO':'required; url=https://private.example/sso'}}),['https://private']);
      await apiFailure('/user/installations','GITHUB_APP_INSTALLATIONS_PERMISSION_DENIED',()=>new Response('PRIVATE_GITHUB_BODY',{status:403,headers:{'X-Accepted-GitHub-Permissions':'contents=write'}}));
      await apiFailure('/user','GITHUB_ACCOUNT_FETCH_FAILED',()=>Promise.reject(new TypeError('PRIVATE_NETWORK_DETAIL')),['PRIVATE_NETWORK_DETAIL']);
      await apiFailure('/user','GITHUB_ACCOUNT_TIMEOUT',()=>Promise.reject(Object.assign(new TypeError('PRIVATE_TIMEOUT_DETAIL'),{name:'TimeoutError'})),['PRIVATE_TIMEOUT_DETAIL']);
      await apiFailure('/user','GITHUB_ACCOUNT_INVALID_RESPONSE',()=>new Response('PRIVATE_MALFORMED_BODY',{status:200}),['PRIVATE_MALFORMED_BODY']);
      assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM sessions').get().n,0);
      assert.equal(f.writes.length,0);
    });
    await t.test('configuration required; no backend calls',async()=>{const f=fixture();globalThis.fetch=f.provider;f.env.GITHUB_CLIENT_SECRET='';const r=await f.request('/api/session');assert.equal(r.status,503);assert.equal((await r.json()).error.code,'CONFIG_REQUIRED');assert.equal(f.calls.length,0);});
    await t.test('Manager API retains its existing expired-provider-token behavior',async()=>{
      const f=fixture();globalThis.fetch=f.provider;const active=await f.login();const real=f.provider;
      globalThis.fetch=async(url,init)=>new URL(url).origin==='https://api.github.com'&&new URL(url).pathname==='/user'
        ? new Response(JSON.stringify({message:'PRIVATE_PROVIDER_BODY'}),{status:401})
        : real(url,init);
      const response=await f.request('/api/session',active);assert.equal(response.status,401);assert.equal((await response.json()).error.code,'AUTH_REQUIRED');
      assert.match(response.headers.get('Set-Cookie'),/__Host-abs_manager=;.*Max-Age=0/);
    });
    await t.test('PKCE, state binding, one-time callback, HttpOnly opaque session, no credential response',async()=>{
      const f=fixture();globalThis.fetch=f.provider;
      const s=await f.request('/auth/start'),location=new URL(s.headers.get('Location')),state=location.searchParams.get('state'),cookie=s.headers.get('Set-Cookie').split(';')[0];
      assert.equal((await f.request('/auth/callback?state='+state+'&code=x',{cookie:'__Host-abs_manager_oauth='+random()})).status,400);
      assert.equal(f.calls.length,0);
      assert.equal((await f.request('/auth/callback?state='+state+'&code=x',{cookie})).status,303);
      const before=f.calls.length;assert.equal((await f.request('/auth/callback?state='+state+'&code=x',{cookie})).status,400);assert.equal(f.calls.length,before);
      const active=await f.login();assert.ok(active.csrfToken);assert.ok(active.capabilities.delete);
      const data=await (await f.request('/api/session',{cookie:active.cookie})).text();assert.doesNotMatch(data,/synthetic-access|synthetic-refresh|client.secret|tokens/);
      const row=f.sql.prepare('SELECT * FROM sessions ORDER BY created_at DESC LIMIT 1').get();assert.doesNotMatch(row.tokens,/synthetic-access/);assert.equal((await unseal(row.tokens,f.env.TOKEN_ENCRYPTION_KEY)).access_token,'synthetic-access');
      assert.equal(f.writes.length,0);
    });
    await t.test('cross-origin, missing CSRF, unknown action, arbitrary path and wrong delete confirmation never write',async()=>{
      const f=fixture();globalThis.fetch=f.provider;const active=await f.login();
      for(const options of [{originHeader:'https://abscustom.github.io'}, {csrf:''}, {site:'cross-site'}])assert.equal((await f.request('/api/links/apply',{...active,method:'POST',csrf:active.csrfToken,payload:{operations:[]},...options})).status,403);
      for(const payload of [{operations:[{action:'link',sourceSlug:'alpha',targetSlug:'beta',path:'../index.html'}]},{operations:[{action:'proxy',sourceSlug:'alpha',targetSlug:'beta'}]},{operations:[{action:'link',sourceSlug:'alpha',targetSlug:'alpha'}]},{operations:[{action:'link',sourceSlug:'alpha',targetSlug:'beta'}],repo:'attacker/repo'}])assert.equal((await f.request('/api/links/apply',{...active,method:'POST',csrf:active.csrfToken,payload})).status,400);
      assert.equal((await f.request('/api/cards/delete',{...active,method:'POST',csrf:active.csrfToken,payload:{slug:'alpha',confirmSlug:'beta'}})).status,400);
      assert.equal(f.writes.length,0);
    });
    await t.test('identity alone, revoked repo permission, App read-only, separate delete permission fail closed',async()=>{
      const f=fixture();globalThis.fetch=f.provider;const active=await f.login();
      const operation=()=>f.request('/api/links/apply',{...active,method:'POST',csrf:active.csrfToken,payload:{operations:[{action:'link',sourceSlug:'alpha',targetSlug:'beta'}]}});
      f.userId=8;assert.equal((await operation()).status,403);f.userId=7;f.push=false;assert.equal((await operation()).status,403);f.push=true;f.appWrite=false;assert.equal((await operation()).status,403);f.appWrite=true;f.env.DELETE_USER_IDS='';
      assert.equal((await f.request('/api/cards/delete',{...active,method:'POST',csrf:active.csrfToken,payload:{slug:'alpha',confirmSlug:'alpha'}})).status,403);assert.equal(f.writes.length,0);
    });
    await t.test('list, multi-target reciprocal links, unlink and exact delete cleanup use one non-forced commit',async()=>{
      const f=fixture();globalThis.fetch=f.provider;const active=await f.login();
      const listing=await (await f.request('/api/cards',active)).json();assert.equal(listing.cards.length,3);assert.doesNotMatch(JSON.stringify(listing),/htmlText|synthetic-access|<script/);assert.equal(f.writes.length,0);
      const apply=async operations=>{const r=await f.request('/api/links/apply',{...active,method:'POST',csrf:active.csrfToken,payload:{operations}});assert.equal(r.status,200,await r.clone().text());return r.json();};
      const saved=await apply(['beta','gamma'].map(targetSlug=>({action:'link',sourceSlug:'alpha',targetSlug})));
      assert.deepEqual(saved.cards.find(c=>c.slug==='alpha').linkedSlugs,['beta','gamma']);assert.deepEqual(saved.cards.find(c=>c.slug==='beta').linkedSlugs,['alpha']);
      assert.equal(f.writes.filter(w=>w.path.endsWith('/git/refs/heads/main')).length,1);
      for(const slug of ['alpha','beta','gamma']){const json=JSON.parse(f.blobs.get(f.files.get(`Custom Cards/${slug}/card.json`).sha));assert.equal(json.unrelated.keep,true);assert.equal(json.formsData[0].name,slug);}
      await apply([{action:'unlink',sourceSlug:'alpha',targetSlug:'gamma'}]);
      const deleted=await f.request('/api/cards/delete',{...active,method:'POST',csrf:active.csrfToken,payload:{slug:'alpha',confirmSlug:'alpha'}});assert.equal(deleted.status,200,await deleted.clone().text());const result=await deleted.json();assert.equal(result.cards.length,2);assert.deepEqual(result.cards.find(c=>c.slug==='beta').linkedSlugs,[]);
      assert.equal([...f.files.keys()].some(p=>p.startsWith('Custom Cards/alpha/')),false);assert.ok(f.files.has('Custom Cards/beta/portrait.png'));
      assert.ok(f.writes.filter(w=>w.path.endsWith('/git/trees')).every(w=>w.payload.tree.every(e=>e.path.startsWith('Custom Cards/'))));
    });
    await t.test('invalid generated JavaScript blocks all branch writes; upstream conflicts sanitized',async()=>{
      const f=fixture();globalThis.fetch=f.provider;const active=await f.login();
      const path='Custom Cards/alpha/index.html',original=f.blobs.get(f.files.get(path).sha);f.add(path,original.replace('window.fixture=true;','const broken="unterminated;'));
      const operation=()=>f.request('/api/links/apply',{...active,method:'POST',csrf:active.csrfToken,payload:{operations:[{action:'link',sourceSlug:'alpha',targetSlug:'beta'}]}});
      await f.catalog(active);assert.equal((await operation()).status,422);assert.equal(f.writes.length,0);f.add(path,original);await f.catalog(active);f.patchConflict=true;const conflict=await operation();assert.equal(conflict.status,409);assert.doesNotMatch(await conflict.text(),/MUST NOT LEAK/);assert.ok(f.writes.at(-1).payload.force===false);
    });
    await t.test('refresh rotation, idle expiry, logout revocation, encrypted token tampering',async()=>{
      const f=fixture();globalThis.fetch=f.provider;const active=await f.login();
      f.sql.prepare('UPDATE sessions SET access_expires_at=?').run(now()-1);assert.equal((await f.request('/api/session',active)).status,200);assert.equal(f.refreshes,1);
      const logoutResponse=await f.request('/api/session/logout',{...active,method:'POST',csrf:active.csrfToken});assert.equal(logoutResponse.status,200,await logoutResponse.clone().text());assert.equal((await f.request('/api/session',active)).status,401);
      const next=await f.login();f.sql.prepare('UPDATE sessions SET last_seen_at=?').run(now()-IDLE_SECONDS-1);assert.equal((await f.request('/api/session',next)).status,401);
      const final=await f.login();f.sql.prepare("UPDATE sessions SET tokens='tampered'").run();const response=await f.request('/api/session',final);assert.equal(response.status,503);assert.doesNotMatch(await response.text(),/synthetic|tampered|decrypt/i);
    });
  } finally {globalThis.fetch=realFetch;}
});
