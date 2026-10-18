import { Failure, configuration, profileConfiguration, requireOrigin, body, json, userIds, cookie, SESSION_COOKIE } from './security.mjs';
import { start, callback, profileStart, profileCallback, profileExchange, profileMe, profileLogout, PROFILE_SITE_ORIGINS, session, authorize, logout, createGitHub } from './auth.mjs';
import { snapshot, publicCards, linkChanges, deleteChanges, commit } from './cards.mjs';
import { contentAdminMethod, handleContentAdmin, handlePublicContent, isPublicContentPath } from './content-api.mjs';

export async function handle(request, env) {
  const url = new URL(request.url), path = url.pathname;
  if (isPublicContentPath(path)) return handlePublicContent(request, env);
  if (path.startsWith('/profile/')) {
    profileConfiguration(env);
    if (request.method === 'GET' && path === '/profile/start') return profileStart(request,env);
    const origin = request.headers.get('Origin') || '';
    if (!PROFILE_SITE_ORIGINS.includes(origin)) throw new Failure(403,'PROFILE_ORIGIN_REJECTED','Profile origin is not allowed.');
    if (request.method === 'OPTIONS') {
      const requestedMethod = request.headers.get('Access-Control-Request-Method') || '';
      const requestedHeaders = (request.headers.get('Access-Control-Request-Headers') || '').toLowerCase().split(',').map(value=>value.trim()).filter(Boolean);
      if (!['POST','GET'].includes(requestedMethod) || requestedHeaders.some(header=>!['authorization','content-type'].includes(header))) throw new Failure(403,'PROFILE_PREFLIGHT_REJECTED','Profile request is not allowed.');
      return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Max-Age':'600',Vary:'Origin','Cache-Control':'no-store'}});
    }
    if (path === '/profile/exchange' && request.method === 'POST') return profileExchange(request,env);
    if (path === '/profile/me' && request.method === 'GET') return profileMe(request,env);
    if (path === '/profile/logout' && request.method === 'POST') return profileLogout(request,env);
    if (['/profile/exchange','/profile/me','/profile/logout'].includes(path)) throw new Failure(405,'PROFILE_METHOD_NOT_ALLOWED','This profile request method is not allowed.');
    throw new Failure(404,'PROFILE_NOT_FOUND','This profile action is unavailable.');
  }
  if (path.startsWith('/api/') || path.startsWith('/auth/')) {
    if (request.method === 'GET' && path === '/auth/callback') {
      profileConfiguration(env);
      const profileResponse = await profileCallback(request,env);
      if (profileResponse) return profileResponse;
    }
    configuration(env);
    if (url.origin !== env.MANAGER_ORIGIN) throw new Failure(403,'ORIGIN_REJECTED','Open the configured Manager address.');
    if (request.method === 'GET' && path === '/auth/start') return start(request,env);
    if (request.method === 'GET' && path === '/auth/callback') return callback(request,env);
    const contentMethod = contentAdminMethod(path);
    if (contentMethod) {
      if (contentMethod !== request.method) throw new Failure(405,'METHOD_NOT_ALLOWED','This request method is unavailable.');
      if (request.method === 'GET') {
        if (['cross-site','same-site'].includes(request.headers.get('Sec-Fetch-Site'))) throw new Failure(403,'ORIGIN_REJECTED','Open Manager directly.');
      } else requireOrigin(request,env);
      const active = await session(request,env);
      if (request.method !== 'GET' && request.headers.get('X-CSRF-Token') !== active.row.csrf) throw new Failure(403,'CSRF_REJECTED','Your security check expired. Reload Manager and retry.');
      const api = createGitHub(active.tokens.access_token);
      const archiveAction = path.endsWith('/archive');
      const activeUser = await authorize(env,active.tokens,active.row.user_id,archiveAction,api,false);
      return handleContentAdmin(request,env,activeUser);
    }
    const routes = new Map([['/api/session','GET'],['/api/cards','GET'],['/api/session/logout','POST'],['/api/links/apply','POST'],['/api/cards/delete','POST']]);
    if (!routes.has(path)) throw new Failure(404,'NOT_FOUND','This Manager action is unavailable.');
    if (routes.get(path) !== request.method) throw new Failure(405,'METHOD_NOT_ALLOWED','This request method is unavailable.');
    if (env.CONTENT_WRITES_ENABLED === 'true' && ['/api/links/apply','/api/cards/delete'].includes(path)) {
      throw new Failure(503,'CONTENT_WRITES_ACTIVE','Legacy GitHub card writes are disabled while database ownership is active.');
    }
    if (request.method === 'POST') requireOrigin(request,env);
    else if (['cross-site','same-site'].includes(request.headers.get('Sec-Fetch-Site'))) throw new Failure(403,'ORIGIN_REJECTED','Open Manager directly.');
    const active = await session(request,env);
    if (request.method === 'POST' && request.headers.get('X-CSRF-Token') !== active.row.csrf) throw new Failure(403,'CSRF_REJECTED','Your security check expired. Reload Manager and retry.');
    if (path === '/api/session/logout') return json({ok:true},200,await logout(env,active));
    const api = createGitHub(active.tokens.access_token);
    const activeUser = await authorize(env,active.tokens,active.row.user_id,path === '/api/cards/delete',api,false);
    if (path === '/api/session') return json({login:active.row.login,csrfToken:active.row.csrf,expiresAt:active.row.expires_at,profile:{login:activeUser.login,displayName:activeUser.displayName,avatarUrl:activeUser.avatarUrl,role:'admin'},capabilities:{link:true,delete:userIds(env.DELETE_USER_IDS).has(active.row.user_id)}});
    const payload = request.method === 'POST' ? await body(request) : null;
    const snap = await snapshot(api,env,path === '/api/cards');
    if (snap.pending) return json(snap,202);
    if (path === '/api/cards') return json({cards:publicCards(snap.cards)});
    const changes = path === '/api/links/apply' ? {changes:await linkChanges(api,snap,payload),deletePrefix:''} : await deleteChanges(api,snap,payload);
    const commitSha = await commit(api,snap,changes.changes,changes.deletePrefix,env);
    return json({ok:true,cards:publicCards(snap.cards),commitSha});
  }
  if (!['GET','HEAD'].includes(request.method)) throw new Failure(405,'METHOD_NOT_ALLOWED','This request method is unavailable.');
  if (path === '/') return new Response(null,{status:302,headers:{Location:'/manager.html'}});
  // Only the explicitly assembled Manager assets are available on this origin.
  if (!env.ASSETS) throw new Failure(503,'CONFIG_REQUIRED','Manager assets have not been installed.');
  return env.ASSETS.fetch(request);
}

function secure(response) {
  const copy = new Response(response.body,response);
  copy.headers.set('X-Content-Type-Options','nosniff');
  copy.headers.set('Referrer-Policy','no-referrer');
  copy.headers.set('X-Frame-Options','DENY');
  copy.headers.set('Permissions-Policy','camera=(), microphone=(), geolocation=()');
  copy.headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; img-src 'self' https: data:; connect-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'");
  return copy;
}
export const service = {
  async fetch(request,env) {
    try { return secure(await handle(request,env)); }
    catch (error) {
      const known = error instanceof Failure;
      const status = known ? error.status : 503;
      const headers = status === 401 ? {'Set-Cookie':cookie(SESSION_COOKIE,'',0)} : {};
      if (new URL(request.url).pathname.startsWith('/profile/')) {
        const origin = request.headers.get('Origin') || '';
        const profileHeaders = {
          'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store', Vary:'Origin',
          ...(PROFILE_SITE_ORIGINS.includes(origin) ? {'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Max-Age':'600'} : {})
        };
        const code = known && /^PROFILE_[A-Z0-9_]+$/.test(error.code || '') ? error.code : 'PROFILE_UNAVAILABLE';
        return secure(new Response(JSON.stringify({error:{code,message:known ? error.message : 'Profile service is temporarily unavailable.'}}),{status,headers:profileHeaders}));
      }
      if (new URL(request.url).pathname.startsWith('/auth/')) {
        // Only fixed codes cross this boundary. Never render exception messages,
        // callback query values, provider descriptions, or request headers.
        const githubStages = ['GITHUB_ACCOUNT','GITHUB_REPOSITORY','GITHUB_APP_INSTALLATIONS','GITHUB_APP_INSTALLATION_REPOSITORIES'];
        const githubFailures = ['FETCH_FAILED','TIMEOUT','INVALID_RESPONSE','HTTP_3XX','HTTP_400','HTTP_401','HTTP_403','HTTP_404','HTTP_409','HTTP_422','HTTP_4XX','HTTP_429','HTTP_5XX','HTTP_ERROR','PRIMARY_RATE_LIMIT','SECONDARY_RATE_LIMIT','SSO_REQUIRED','PERMISSION_DENIED'];
        const githubStageCodes = githubStages.flatMap(stage=>githubFailures.map(failure=>`${stage}_${failure}`));
        const publicCodes = new Set([
          'CONFIG_REQUIRED','SIGN_IN_BUSY','OAUTH_STATE_INVALID','OAUTH_STATE_STORE_FAILED',
          'OAUTH_DENIED','OAUTH_CODE_MISSING','OAUTH_EXCHANGE_FETCH_FAILED','OAUTH_EXCHANGE_TIMEOUT',
          'OAUTH_EXCHANGE_REDIRECT','OAUTH_EXCHANGE_HTTP_400','OAUTH_EXCHANGE_HTTP_401',
          'OAUTH_EXCHANGE_HTTP_403','OAUTH_EXCHANGE_HTTP_404','OAUTH_EXCHANGE_HTTP_4XX',
          'OAUTH_EXCHANGE_HTTP_429','OAUTH_EXCHANGE_HTTP_5XX','OAUTH_EXCHANGE_HTTP_ERROR',
          'OAUTH_TOKEN_REJECTED','OAUTH_TOKEN_INCORRECT_CREDENTIALS','OAUTH_TOKEN_REDIRECT_MISMATCH',
          'OAUTH_TOKEN_CODE_REJECTED','OAUTH_TOKEN_EMAIL_UNVERIFIED',
          'OAUTH_TOKEN_INVALID','AUTH_REQUIRED','ACCESS_DENIED','REPOSITORY_ACCESS_DENIED',
          'APP_ACCESS_DENIED','GITHUB_UNAVAILABLE','REPOSITORY_CHANGED','SESSION_CREATE_FAILED','PROFILE_STATE_STORE_FAILED',...githubStageCodes
        ]);
        const code = known && publicCodes.has(error.code) ? error.code : 'MANAGER_UNAVAILABLE';
        const message = `Sign-in could not finish. Error code: ${code}. Return to Manager and try again.`;
        const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Manager sign-in</title><body><main><h1>Sign-in could not finish</h1><p>${message}</p><a href="/manager.html">Return to Manager</a></main></body></html>`;
        return secure(new Response(html,{status,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}}));
      }
      // Do not log exceptions, token exchange bodies, cookies, or callback query strings.
      return secure(json({error:{code:known ? error.code : 'MANAGER_UNAVAILABLE',message:known ? error.message : 'Manager could not complete the request. Retry shortly.'}},status,headers));
    }
  }
};

// SQLite-backed namespace is available on Workers Free and has the Durable
// Object CPU allowance. The public HTTP Worker only routes and streams responses.
export class ManagerService {
  constructor(ctx,env) { this.env=env;this.queue=Promise.resolve(); }
  fetch(request) {
    const operation=this.queue.then(()=>service.fetch(request,this.env));
    this.queue=operation.then(()=>undefined,()=>undefined);
    return operation;
  }
}
export default {
  async fetch(request,env) {
    const path=new URL(request.url).pathname;
    if (path.startsWith('/api/') || path.startsWith('/auth/')) {
      if (!env.MANAGER_SERVICE) return secure(json({error:{code:'CONFIG_REQUIRED',message:'Manager service is not configured yet.'}},503));
      try {
        const id=env.MANAGER_SERVICE.idFromName('abscustom/abscustom.github.io/main');
        return await env.MANAGER_SERVICE.get(id).fetch(request);
      } catch {
        return secure(json({error:{code:'MANAGER_UNAVAILABLE',message:'Manager is temporarily unavailable. Retry shortly.'}},503));
      }
    }
    return service.fetch(request,env);
  }
};
