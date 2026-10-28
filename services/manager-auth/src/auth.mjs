import { Failure, now, random, hash, seal, unseal, userIds, cookie, readCookie, SESSION_COOKIE, OAUTH_COOKIE, PROFILE_OAUTH_COOKIE_PREFIX, SESSION_SECONDS, IDLE_SECONDS, PROFILE_SESSION_SECONDS } from './security.mjs';
export const REPOSITORY = 'abscustom/abscustom.github.io';
export const PROFILE_SITE_ORIGINS = Object.freeze([
  'https://abscustom.github.io',
  'http://localhost:3000', 'http://127.0.0.1:3000',
  'http://localhost:4173', 'http://127.0.0.1:4173'
]);
export const PROFILE_TICKET_SECONDS = 60;
export const authRequired = () => new Failure(401, 'AUTH_REQUIRED', 'Sign in with GitHub to manage cards.');
const AUTHORIZATION_STAGES = Object.freeze({
  PROFILE_IDENTITY: 'GITHUB_PROFILE_IDENTITY',
  ACCOUNT: 'GITHUB_ACCOUNT',
  REPOSITORY: 'GITHUB_REPOSITORY',
  APP_INSTALLATIONS: 'GITHUB_APP_INSTALLATIONS',
  APP_INSTALLATION_REPOSITORIES: 'GITHUB_APP_INSTALLATION_REPOSITORIES'
});
const PROFILE_MANAGER_CODES = new Set(['ACCESS_DENIED','REPOSITORY_ACCESS_DENIED','APP_ACCESS_DENIED','SESSION_CREATE_FAILED', 'GITHUB_UNAVAILABLE', ...Object.values(AUTHORIZATION_STAGES).flatMap(prefix => [
  `${prefix}_FETCH_FAILED`,`${prefix}_TIMEOUT`,`${prefix}_INVALID_RESPONSE`,`${prefix}_HTTP_3XX`,`${prefix}_HTTP_400`,`${prefix}_HTTP_401`,`${prefix}_HTTP_403`,`${prefix}_HTTP_404`,`${prefix}_HTTP_409`,`${prefix}_HTTP_422`,`${prefix}_HTTP_4XX`,`${prefix}_HTTP_429`,`${prefix}_HTTP_5XX`,`${prefix}_HTTP_ERROR`,`${prefix}_PRIMARY_RATE_LIMIT`,`${prefix}_SECONDARY_RATE_LIMIT`,`${prefix}_SSO_REQUIRED`,`${prefix}_PERMISSION_DENIED`
])]);

function safeText(value, limit) {
  return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, limit) : '';
}
function safeAvatarUrl(value) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'avatars.githubusercontent.com' && !url.username && !url.password && (!url.port || url.port === '443') ? url.href : null;
  } catch { return null; }
}
function accountProfile(account) {
  const login = safeText(account?.login, 39);
  return { login, displayName: safeText(account?.name, 80) || login, avatarUrl: safeAvatarUrl(account?.avatar_url) };
}
function profileRole(userId, env) { return userIds(env.ADMIN_USER_IDS).has(String(userId)) ? 'admin' : 'member'; }
function profileResponse(row, env) {
  return {
    profile: { login: row.login, displayName: row.display_name || row.login, avatarUrl: safeAvatarUrl(row.avatar_url), role: profileRole(row.user_id, env) },
    managerAccess: { status: row.manager_access_status, ...(row.manager_access_code ? { code: row.manager_access_code } : {}) }
  };
}
function profileCallbackPath(origin, mode) {
  if (!PROFILE_SITE_ORIGINS.includes(origin) || !['project','root'].includes(mode)) throw new Failure(400, 'PROFILE_CALLBACK_INVALID', 'The profile callback destination is not supported.');
  if (origin === 'https://abscustom.github.io' && mode !== 'project') throw new Failure(400, 'PROFILE_CALLBACK_INVALID', 'The profile callback destination is not supported.');
  return mode === 'project' ? '/DokkanCustom/profile-callback.html' : '/profile-callback.html';
}
function profileCookieName(state) { return `${PROFILE_OAUTH_COOKIE_PREFIX}${state.slice(0, 16)}`; }
function profileReturnUrl(row, fragment) {
  const url = new URL(profileCallbackPath(row.origin, row.callback_mode), row.origin);
  url.hash = new URLSearchParams(fragment).toString();
  return url.href;
}
function managerAccessFailure(error) {
  const code = error instanceof Failure && PROFILE_MANAGER_CODES.has(error.code) ? error.code : 'GITHUB_UNAVAILABLE';
  const restricted = ['ACCESS_DENIED','REPOSITORY_ACCESS_DENIED','APP_ACCESS_DENIED'].includes(code) || /_(?:HTTP_(?:401|403|404)|SSO_REQUIRED|PERMISSION_DENIED)$/.test(code);
  return { status: restricted ? 'restricted' : 'unavailable', code };
}

function authorizationFailureCode(stage, response) {
  const prefix = AUTHORIZATION_STAGES[stage];
  if (!prefix) return 'GITHUB_UNAVAILABLE';
  const status = response.status;
  let kind;
  if (status === 403 || status === 429) {
    const remaining = response.headers.get('x-ratelimit-remaining');
    const retryAfter = response.headers.get('retry-after') || '';
    const sso = response.headers.get('x-github-sso') || '';
    if (remaining === '0') kind = 'PRIMARY_RATE_LIMIT';
    else if (status === 403 && sso.split(';', 1)[0].trim().toLowerCase() === 'required') kind = 'SSO_REQUIRED';
    else if (/^\d{1,6}$/.test(retryAfter)) kind = 'SECONDARY_RATE_LIMIT';
    else if (status === 403 && response.headers.has('x-accepted-github-permissions')) kind = 'PERMISSION_DENIED';
    else kind = status === 403 ? 'HTTP_403' : 'HTTP_429';
  } else if (status >= 300 && status < 400) kind = 'HTTP_3XX';
  else if ([400, 401, 404, 409, 422].includes(status)) kind = `HTTP_${status}`;
  else if (status >= 500 && status < 600) kind = 'HTTP_5XX';
  else if (status >= 400 && status < 500) kind = 'HTTP_4XX';
  else kind = 'HTTP_ERROR';
  return `${prefix}_${kind}`;
}

export function createGitHub(token) {
  let calls = 0;
  const api = (path, options, stage) => { api.reserve(1); calls++; return github(token, path, options, stage); };
  api.reserve = count => { if (calls + count > 42) throw new Failure(413, 'BATCH_LIMIT', 'This operation exceeds the free Manager request limit. Select fewer changes.'); };
  return api;
}

export async function github(token, path, options = {}, stage) {
  // Paths are constructed exclusively by server code. Never accept a client URL.
  if (!path.startsWith('/') || path.startsWith('//')) throw new Error('Invalid GitHub path');
  let response;
  try {
    response = await fetch(`https://api.github.com${path}`, {
      ...options, redirect: 'manual', signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'ABS-Manager', ...(options.body ? { 'Content-Type': 'application/json' } : {}) }
    });
  } catch (error) {
    if (!stage || !AUTHORIZATION_STAGES[stage]) throw error;
    const kind = error?.name === 'TimeoutError' ? 'TIMEOUT' : 'FETCH_FAILED';
    throw new Failure(502, `${AUTHORIZATION_STAGES[stage]}_${kind}`, 'GitHub authorization could not be completed.');
  }
  if (!response.ok) {
    if (stage && AUTHORIZATION_STAGES[stage]) {
      const status = response.status === 401 || response.status === 403 || response.status === 404 ? response.status : (response.status === 409 || response.status === 422 ? 409 : 502);
      throw new Failure(status, authorizationFailureCode(stage, response), 'GitHub authorization could not be completed.');
    }
    if (response.status === 401) throw authRequired();
    if (response.status === 404) throw new Failure(404, 'RESOURCE_MISSING', 'The requested repository resource is unavailable.');
    if (response.status === 409 || response.status === 422) throw new Failure(409, 'REPOSITORY_CHANGED', 'The repository changed. Reload cards before retrying.');
    throw new Failure(response.status === 403 ? 403 : 502, 'GITHUB_UNAVAILABLE', 'GitHub did not permit this operation. Check access or retry later.');
  }
  if (response.status === 204) {
    if (stage && AUTHORIZATION_STAGES[stage]) throw new Failure(502, `${AUTHORIZATION_STAGES[stage]}_INVALID_RESPONSE`, 'GitHub returned an unreadable authorization response.');
    return null;
  }
  let data;
  try { data = await response.json(); }
  catch {
    if (stage && AUTHORIZATION_STAGES[stage]) throw new Failure(502, `${AUTHORIZATION_STAGES[stage]}_INVALID_RESPONSE`, 'GitHub returned an unreadable authorization response.');
    throw new Error('GitHub returned an unreadable response');
  }
  if (stage && AUTHORIZATION_STAGES[stage] && (!data || typeof data !== 'object' || Array.isArray(data))) {
    throw new Failure(502, `${AUTHORIZATION_STAGES[stage]}_INVALID_RESPONSE`, 'GitHub returned an unreadable authorization response.');
  }
  return data;
}

async function exchange(env, fields) {
  let response;
  try {
    response = await fetch('https://github.com/login/oauth/access_token', {
      // Manual mode records redirect status without forwarding the client secret.
      method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(15000),
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'ABS-Manager' },
      body: new URLSearchParams({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, ...fields })
    });
  } catch (error) {
    const code = error?.name === 'TimeoutError' ? 'OAUTH_EXCHANGE_TIMEOUT' : 'OAUTH_EXCHANGE_FETCH_FAILED';
    throw new Failure(502, code, 'GitHub sign-in could not be reached.');
  }
  if (!response.ok) {
    const statusCode = response.status >= 300 && response.status < 400 ? 'OAUTH_EXCHANGE_REDIRECT' : new Map([
      [400, 'OAUTH_EXCHANGE_HTTP_400'], [401, 'OAUTH_EXCHANGE_HTTP_401'],
      [403, 'OAUTH_EXCHANGE_HTTP_403'], [404, 'OAUTH_EXCHANGE_HTTP_404'],
      [429, 'OAUTH_EXCHANGE_HTTP_429']
    ]).get(response.status) || (response.status >= 500 ? 'OAUTH_EXCHANGE_HTTP_5XX' : (response.status >= 400 && response.status < 500 ? 'OAUTH_EXCHANGE_HTTP_4XX' : 'OAUTH_EXCHANGE_HTTP_ERROR'));
    throw new Failure(502, statusCode, 'GitHub rejected or could not complete the sign-in request.');
  }
  let data;
  try { data = await response.json(); }
  catch { throw new Failure(502, 'OAUTH_TOKEN_INVALID', 'GitHub returned an unreadable sign-in response.'); }
  // Require expiring GitHub App user tokens; OAuth/PAT fallback is deliberately absent.
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Failure(502, 'OAUTH_TOKEN_INVALID', 'GitHub returned an incomplete sign-in response.');
  if (data.error) {
    const code = new Map([
      ['incorrect_client_credentials', 'OAUTH_TOKEN_INCORRECT_CREDENTIALS'],
      ['redirect_uri_mismatch', 'OAUTH_TOKEN_REDIRECT_MISMATCH'],
      ['bad_verification_code', 'OAUTH_TOKEN_CODE_REJECTED'],
      ['unverified_user_email', 'OAUTH_TOKEN_EMAIL_UNVERIFIED']
    ]).get(data.error) || 'OAUTH_TOKEN_REJECTED';
    throw new Failure(401, code, 'GitHub did not accept the sign-in response.');
  }
  if (!data.access_token || !data.refresh_token || !Number.isFinite(data.expires_in) || data.expires_in <= 0 || !Number.isFinite(data.refresh_token_expires_in) || data.refresh_token_expires_in <= 0) {
    throw new Failure(502, 'OAUTH_TOKEN_INVALID', 'GitHub returned an incomplete sign-in response.');
  }
  return data;
}

export async function authorize(env, tokens, expectedId, deletion = false, api = createGitHub(tokens.access_token), diagnostics = true) {
  const account = await api('/user', undefined, diagnostics ? 'ACCOUNT' : undefined);
  const id = String(account.id);
  const profile = accountProfile(account);
  if (!userIds(env.ADMIN_USER_IDS).has(id) || (expectedId && id !== expectedId) || (deletion && !userIds(env.DELETE_USER_IDS).has(id))) {
    throw new Failure(403, 'ACCESS_DENIED', 'This GitHub account is not authorized for this Manager action.');
  }
  const repo = await api(`/repos/${REPOSITORY}`, undefined, diagnostics ? 'REPOSITORY' : undefined);
  if (String(repo.id) !== env.GITHUB_REPOSITORY_ID || repo.full_name?.toLowerCase() !== REPOSITORY || !repo.permissions?.push || repo.archived || repo.disabled) {
    throw new Failure(403, 'REPOSITORY_ACCESS_DENIED', 'Repository write access is required.');
  }
  // Confirm the App installation grants Contents write on this exact repository.
  let permitted = false;
  for (let page = 1; page <= 3 && !permitted; page++) {
    const data = await api(`/user/installations?per_page=100&page=${page}`, undefined, diagnostics ? 'APP_INSTALLATIONS' : undefined);
    for (const installation of data.installations || []) {
      if (installation.suspended_at || installation.permissions?.contents !== 'write') continue;
      for (let repoPage = 1; repoPage <= 3; repoPage++) {
        const available = await api(`/user/installations/${installation.id}/repositories?per_page=100&page=${repoPage}`, undefined, diagnostics ? 'APP_INSTALLATION_REPOSITORIES' : undefined);
        if (available.repositories?.some(r => String(r.id) === env.GITHUB_REPOSITORY_ID && r.full_name?.toLowerCase() === REPOSITORY)) { permitted = true; break; }
        if ((available.repositories?.length || 0) < 100) break;
      }
      if (permitted) break;
    }
    if ((data.installations?.length || 0) < 100) break;
  }
  if (!permitted) throw new Failure(403, 'APP_ACCESS_DENIED', 'Install the Manager GitHub App with Contents write access on the custom-card repository.');
  return { id, ...profile };
}

async function managerSessionRecord(env, tokens, user) {
  const id = random(), time = now(), expiry = Math.min(time + SESSION_SECONDS, time + tokens.refresh_token_expires_in);
  const csrf = random();
  const insert = env.DB.prepare('INSERT INTO sessions(id_hash,user_id,login,csrf,tokens,access_expires_at,refresh_expires_at,created_at,last_seen_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?)')
    .bind(await hash(id), user.id, user.login, csrf, await seal({ access_token: tokens.access_token, refresh_token: tokens.refresh_token }, env.TOKEN_ENCRYPTION_KEY), time + tokens.expires_in, time + tokens.refresh_token_expires_in, time, time, expiry);
  return { id, idHash: await hash(id), time, expiry, csrf, insert, cookie: cookie(SESSION_COOKIE, id, expiry - time) };
}

export async function start(request, env) {
  const fetchSite = request.headers.get('Sec-Fetch-Site');
  if (fetchSite === 'cross-site') throw new Failure(403, 'ORIGIN_REJECTED', 'Open Manager before signing in.');
  const state = random(), binding = random(), verifier = random(48), time = now();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM oauth_states WHERE expires_at < ?').bind(time),
    env.DB.prepare('DELETE FROM sessions WHERE expires_at < ? OR last_seen_at < ?').bind(time, time - IDLE_SECONDS)
    ,env.DB.prepare('DELETE FROM card_metadata WHERE created_at < ?').bind(time - 7 * 86400)
  ]);
  const result = await env.DB.prepare('INSERT INTO oauth_states(state_hash,binding_hash,verifier,expires_at) SELECT ?,?,?,? WHERE (SELECT COUNT(*) FROM oauth_states) < 200')
    .bind(await hash(state), await hash(binding), verifier, time + 600).run();
  if (!result.meta.changes) throw new Failure(429, 'SIGN_IN_BUSY', 'Sign-in is busy. Try again shortly.');
  const url = new URL('https://github.com/login/oauth/authorize');
  url.search = new URLSearchParams({ client_id: env.GITHUB_CLIENT_ID, redirect_uri: `${env.MANAGER_ORIGIN}/auth/callback`, state, code_challenge: await hash(verifier), code_challenge_method: 'S256' }).toString();
  return new Response(null, { status: 302, headers: { Location: url.href, 'Set-Cookie': cookie(OAUTH_COOKIE, binding, 600), 'Cache-Control': 'no-store' } });
}

export async function profileStart(request, env) {
  const url = new URL(request.url);
  const origin = url.searchParams.get('origin') || '';
  const challenge = url.searchParams.get('challenge') || '';
  const nonce = url.searchParams.get('nonce') || '';
  const callbackMode = url.searchParams.get('callback') || '';
  profileCallbackPath(origin, callbackMode);
  if (!/^[A-Za-z0-9_-]{43}$/.test(challenge) || !/^[A-Za-z0-9_-]{43}$/.test(nonce)) throw new Failure(400, 'PROFILE_REQUEST_INVALID', 'Profile sign-in could not be started.');
  const state = random(), binding = random(), verifier = random(48), time = now();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM profile_oauth_states WHERE expires_at < ?').bind(time),
    env.DB.prepare('DELETE FROM profile_tickets WHERE expires_at < ?').bind(time),
    env.DB.prepare('DELETE FROM profile_sessions WHERE expires_at < ? OR last_seen_at < ?').bind(time, time - PROFILE_SESSION_SECONDS)
  ]);
  const result = await env.DB.prepare('INSERT INTO profile_oauth_states(state_hash,binding_hash,verifier,origin,challenge,nonce,callback_mode,expires_at) SELECT ?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM profile_oauth_states) < 200')
    .bind(await hash(state), await hash(binding), verifier, origin, challenge, nonce, callbackMode, time + 600).run();
  if (!result.meta.changes) throw new Failure(429, 'PROFILE_SIGN_IN_BUSY', 'Profile sign-in is busy. Try again shortly.');
  const authUrl = new URL('https://github.com/login/oauth/authorize');
  authUrl.search = new URLSearchParams({ client_id: env.GITHUB_CLIENT_ID, redirect_uri: `${env.MANAGER_ORIGIN}/auth/callback`, state, code_challenge: await hash(verifier), code_challenge_method: 'S256' }).toString();
  return new Response(null, { status: 302, headers: { Location: authUrl.href, 'Set-Cookie': cookie(profileCookieName(state), binding, 600), 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
}

function profileTicketStatement(env, ticket, row, identity, managerAccess, managerSession, expiresAt) {
  return env.DB.prepare('INSERT INTO profile_tickets(ticket_hash,user_id,login,display_name,avatar_url,origin,challenge,nonce_hash,callback_mode,manager_access_status,manager_access_code,manager_session_hash,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .bind(ticket.hash, identity.id, identity.login, identity.displayName, identity.avatarUrl, row.origin, row.challenge, ticket.nonceHash, row.callback_mode, managerAccess.status, managerAccess.code || null, managerSession?.idHash || null, expiresAt);
}

function profileCallbackRedirect(row, cookieName, fragment) {
  const headers = new Headers({ Location: profileReturnUrl(row, fragment), 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
  headers.append('Set-Cookie', cookie(cookieName, '', 0));
  return new Response(null, { status: 303, headers });
}

export async function profileCallback(request, env) {
  const url = new URL(request.url), state = url.searchParams.get('state') || '';
  if (!/^[A-Za-z0-9_-]{43}$/.test(state)) return null;
  const cookieName = profileCookieName(state), binding = readCookie(request, cookieName);
  if (!/^[A-Za-z0-9_-]{43}$/.test(binding)) return null;
  let row;
  try {
    row = await env.DB.prepare('DELETE FROM profile_oauth_states WHERE state_hash=? AND binding_hash=? AND expires_at>=? RETURNING verifier,origin,challenge,nonce,callback_mode')
      .bind(await hash(state), await hash(binding), now()).first();
  } catch {
    throw new Failure(503, 'PROFILE_STATE_STORE_FAILED', 'The profile sign-in check could not be completed.');
  }
  if (!row) return null;
  try {
    if (url.searchParams.has('error')) return profileCallbackRedirect(row, cookieName, { error: 'PROFILE_SIGN_IN_DENIED', nonce: row.nonce });
    const code = url.searchParams.get('code');
    if (!code) return profileCallbackRedirect(row, cookieName, { error: 'PROFILE_SIGN_IN_FAILED', nonce: row.nonce });
    const tokens = await exchange(env, { code, code_verifier: row.verifier, redirect_uri: `${env.MANAGER_ORIGIN}/auth/callback` });
    const account = await github(tokens.access_token, '/user', undefined, 'PROFILE_IDENTITY');
    const identity = { id: String(account.id), ...accountProfile(account) };
    if (!/^\d+$/.test(identity.id) || !identity.login) return profileCallbackRedirect(row, cookieName, { error: 'PROFILE_SIGN_IN_FAILED', nonce: row.nonce });

    let managerAccess = { status: 'not_admin' }, managerSession = null;
    if (profileRole(identity.id, env) === 'admin') {
      try {
        const authorizedUser = await authorize(env, tokens, identity.id);
        try { managerSession = await managerSessionRecord(env, tokens, authorizedUser); }
        catch { managerAccess = { status: 'unavailable', code: 'SESSION_CREATE_FAILED' }; }
        if (managerSession) managerAccess = { status: 'ready' };
      } catch (error) { managerAccess = managerAccessFailure(error); }
    }

    const rawTicket = random(), expiresAt = now() + PROFILE_TICKET_SECONDS;
    const ticket = { hash: await hash(rawTicket), nonceHash: await hash(row.nonce) };
    let ticketStatement = profileTicketStatement(env, ticket, row, identity, managerAccess, managerSession, expiresAt);
    const outstanding = await env.DB.prepare('SELECT COUNT(*) AS count FROM profile_tickets WHERE expires_at>=?').bind(now()).first();
    if (outstanding.count >= 200) throw new Failure(429, 'PROFILE_SIGN_IN_BUSY', 'Profile sign-in is busy. Try again shortly.');
    try {
      await env.DB.batch(managerSession ? [managerSession.insert, ticketStatement] : [ticketStatement]);
    } catch {
      if (!managerSession) throw new Failure(503, 'PROFILE_TICKET_CREATE_FAILED', 'The profile sign-in could not be completed.');
      managerSession = null;
      managerAccess = { status: 'unavailable', code: 'SESSION_CREATE_FAILED' };
      ticketStatement = profileTicketStatement(env, ticket, row, identity, managerAccess, null, expiresAt);
      await env.DB.batch([ticketStatement]);
    }

    const headers = new Headers({ Location: profileReturnUrl(row, { ticket: rawTicket, nonce: row.nonce }), 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
    headers.append('Set-Cookie', cookie(cookieName, '', 0));
    if (managerSession) {
      headers.append('Set-Cookie', managerSession.cookie);
      headers.append('Set-Cookie', cookie('__Host-abs_password', '', 0));
    }
    return new Response(null, { status: 303, headers });
  } catch {
    return profileCallbackRedirect(row, cookieName, { error: 'PROFILE_SIGN_IN_FAILED', nonce: row.nonce });
  }
}

export async function profileExchange(request, env) {
  const origin = request.headers.get('Origin') || '';
  if (!PROFILE_SITE_ORIGINS.includes(origin)) throw new Failure(403, 'PROFILE_ORIGIN_REJECTED', 'Profile sign-in origin is not allowed.');
  const input = await readProfilePayload(request);
  const ticket = typeof input.ticket === 'string' ? input.ticket : '';
  const verifier = typeof input.verifier === 'string' ? input.verifier : '';
  const nonce = typeof input.nonce === 'string' ? input.nonce : '';
  if (!/^[A-Za-z0-9_-]{43}$/.test(ticket) || !/^[A-Za-z0-9_-]{43,128}$/.test(verifier) || !/^[A-Za-z0-9_-]{43}$/.test(nonce)) throw new Failure(400, 'PROFILE_TICKET_INVALID', 'Profile sign-in ticket is invalid or expired.');
  let row;
  try {
    row = await env.DB.prepare('DELETE FROM profile_tickets WHERE ticket_hash=? AND origin=? AND nonce_hash=? AND expires_at>=? RETURNING user_id,login,display_name,avatar_url,origin,challenge,manager_access_status,manager_access_code,manager_session_hash')
      .bind(await hash(ticket), origin, await hash(nonce), now()).first();
  } catch {
    throw new Failure(503, 'PROFILE_TICKET_STORE_FAILED', 'Profile sign-in could not be completed.');
  }
  if (!row || await hash(verifier) !== row.challenge) throw new Failure(400, 'PROFILE_TICKET_INVALID', 'Profile sign-in ticket is invalid or expired.');
  const id = random(), time = now(), expiresAt = time + PROFILE_SESSION_SECONDS;
  let saved;
  try {
    saved = await env.DB.prepare('INSERT INTO profile_sessions(id_hash,user_id,origin,login,display_name,avatar_url,manager_access_status,manager_access_code,manager_session_hash,created_at,last_seen_at,expires_at) SELECT ?,?,?,?,?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM profile_sessions) < 1000')
      .bind(await hash(id), row.user_id, row.origin, row.login, row.display_name || row.login, safeAvatarUrl(row.avatar_url), row.manager_access_status, row.manager_access_code, row.manager_session_hash, time, time, expiresAt).run();
  } catch {
    throw new Failure(503, 'PROFILE_SESSION_CREATE_FAILED', 'Profile sign-in could not be saved.');
  }
  if (!saved.meta.changes) throw new Failure(429, 'PROFILE_SESSION_LIMIT', 'Too many profile sessions are active. Sign out and retry.');
  const active = { ...row, manager_access_status: row.manager_access_status, manager_access_code: row.manager_access_code };
  const result = { token: id, expiresAt, ...profileResponse(active, env) };
  return jsonProfile(result, 200, origin);
}

async function readProfilePayload(request) {
  if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) throw new Failure(415, 'PROFILE_JSON_REQUIRED', 'Send a JSON profile request.');
  const reader = request.body?.getReader();
  let size = 0; const chunks = [];
  if (reader) while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 4096) { await reader.cancel(); throw new Failure(413, 'PROFILE_REQUEST_TOO_LARGE', 'Profile request is too large.'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try {
    const value = JSON.parse(new TextDecoder().decode(bytes));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError();
    return value;
  } catch { throw new Failure(400, 'PROFILE_JSON_INVALID', 'The profile request could not be read.'); }
}

function jsonProfile(data, status, origin) {
  return new Response(JSON.stringify(data), { status, headers: {
    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Max-Age': '600', Vary: 'Origin'
  } });
}

async function profileSessionFromRequest(request, env) {
  const origin = request.headers.get('Origin') || '';
  if (!PROFILE_SITE_ORIGINS.includes(origin)) throw new Failure(403, 'PROFILE_ORIGIN_REJECTED', 'Profile origin is not allowed.');
  const authorization = request.headers.get('Authorization') || '';
  const match = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(authorization);
  if (!match) throw new Failure(401, 'PROFILE_AUTH_REQUIRED', 'Sign in to view your profile.');
  const idHash = await hash(match[1]), time = now();
  const row = await env.DB.prepare('SELECT * FROM profile_sessions WHERE id_hash=?').bind(idHash).first();
  if (row && row.origin !== origin) throw new Failure(401, 'PROFILE_AUTH_REQUIRED', 'Sign in to view your profile.');
  if (!row || row.expires_at <= time || row.last_seen_at + PROFILE_SESSION_SECONDS <= time) {
    if (row) await env.DB.prepare('DELETE FROM profile_sessions WHERE id_hash=?').bind(idHash).run();
    throw new Failure(401, 'PROFILE_AUTH_REQUIRED', 'Sign in to view your profile.');
  }
  if (row.last_seen_at < time - 300) await env.DB.prepare('UPDATE profile_sessions SET last_seen_at=? WHERE id_hash=?').bind(time, idHash).run();
  let managerAccess = { status: row.manager_access_status, ...(row.manager_access_code ? { code: row.manager_access_code } : {}) };
  if (row.manager_access_status === 'ready') {
    const managerSession = row.manager_session_hash ? await env.DB.prepare('SELECT user_id,expires_at,last_seen_at FROM sessions WHERE id_hash=?').bind(row.manager_session_hash).first() : null;
    if (!managerSession || managerSession.user_id !== row.user_id || managerSession.expires_at <= time || managerSession.last_seen_at + IDLE_SECONDS <= time) {
      managerAccess = { status: 'unavailable', code: 'AUTH_REQUIRED' };
      await env.DB.prepare("UPDATE profile_sessions SET manager_access_status='unavailable',manager_access_code='AUTH_REQUIRED' WHERE id_hash=?").bind(idHash).run();
    }
  }
  return { row, idHash, origin, managerAccess };
}

export async function profileMe(request, env) {
  const active = await profileSessionFromRequest(request, env);
  return jsonProfile({ expiresAt: active.row.expires_at, ...profileResponse({ ...active.row, manager_access_status: active.managerAccess.status, manager_access_code: active.managerAccess.code }, env) }, 200, active.origin);
}

// Website writes use the origin-bound profile bearer and the linked Manager
// session. Reuse expiry, token refresh and live repository authorization.
export async function profileCardActor(request, env) {
  const profile = await profileSessionFromRequest(request, env);
  if (profile.managerAccess.status !== 'ready' || !profile.row.manager_session_hash) throw authRequired();
  const active = await sessionByHash(profile.row.manager_session_hash, env);
  if (active.row.user_id !== profile.row.user_id) throw authRequired();
  return authorize(env, active.tokens, active.row.user_id, false, createGitHub(active.tokens.access_token), false);
}

export async function profileLogout(request, env) {
  const active = await profileSessionFromRequest(request, env);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM profile_sessions WHERE id_hash=?').bind(active.idHash),
    env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(active.row.user_id)
  ]);
  return jsonProfile({ ok: true }, 200, active.origin);
}

export async function callback(request, env) {
  const url = new URL(request.url), state = url.searchParams.get('state') || '', binding = readCookie(request, OAUTH_COOKIE);
  if (!/^[A-Za-z0-9_-]{43}$/.test(state) || !/^[A-Za-z0-9_-]{43}$/.test(binding)) throw new Failure(400, 'OAUTH_STATE_INVALID', 'Sign-in expired or did not match this browser. Start again.');
  // Atomic consumption also prevents concurrent callback replay.
  let row;
  try {
    row = await env.DB.prepare('DELETE FROM oauth_states WHERE state_hash=? AND binding_hash=? AND expires_at>=? RETURNING verifier')
      .bind(await hash(state), await hash(binding), now()).first();
  } catch {
    throw new Failure(503, 'OAUTH_STATE_STORE_FAILED', 'The sign-in check could not be completed.');
  }
  if (!row) throw new Failure(400, 'OAUTH_STATE_INVALID', 'Sign-in expired or did not match this browser. Start again.');
  if (url.searchParams.has('error')) throw new Failure(400, 'OAUTH_DENIED', 'GitHub sign-in was cancelled or denied. Start again.');
  const code = url.searchParams.get('code');
  if (!code) throw new Failure(400, 'OAUTH_CODE_MISSING', 'GitHub did not return a sign-in code. Start again.');
  const tokens = await exchange(env, { code, code_verifier: row.verifier, redirect_uri: `${env.MANAGER_ORIGIN}/auth/callback` });
  let user;
  try { user = await authorize(env, tokens); }
  catch (error) {
    if (error instanceof Failure) throw error;
    throw new Failure(502, 'GITHUB_UNAVAILABLE', 'GitHub account and repository access could not be checked.');
  }
  let managerSession;
  try {
    managerSession = await managerSessionRecord(env, tokens, user);
    await managerSession.insert.run();
  } catch {
    throw new Failure(503, 'SESSION_CREATE_FAILED', 'The Manager session could not be saved.');
  }
  const headers = new Headers({ Location: '/manager.html', 'Cache-Control': 'no-store' });
  headers.append('Set-Cookie', cookie(OAUTH_COOKIE, '', 0)); headers.append('Set-Cookie', managerSession.cookie);
  headers.append('Set-Cookie', cookie('__Host-abs_password', '', 0));
  return new Response(null, { status: 303, headers });
}

export async function session(request, env) {
  const id = readCookie(request, SESSION_COOKIE);
  if (!/^[A-Za-z0-9_-]{43}$/.test(id)) throw authRequired();
  return sessionByHash(await hash(id), env);
}

async function sessionByHash(idHash, env) {
  const time = now();
  const row = await env.DB.prepare('SELECT * FROM sessions WHERE id_hash=?').bind(idHash).first();
  if (!row || row.expires_at <= time || row.last_seen_at + IDLE_SECONDS <= time || !userIds(env.ADMIN_USER_IDS).has(row.user_id)) {
    if (row) await env.DB.prepare('DELETE FROM sessions WHERE id_hash=?').bind(idHash).run();
    throw authRequired();
  }
  let tokens = await unseal(row.tokens, env.TOKEN_ENCRYPTION_KEY);
  if (row.access_expires_at <= time + 60) {
    if (row.refresh_expires_at <= time) throw authRequired();
    const locked = await env.DB.prepare('UPDATE sessions SET refresh_lock_until=? WHERE id_hash=? AND refresh_lock_until<?').bind(time + 30, idHash, time).run();
    if (!locked.meta.changes) throw new Failure(409, 'SESSION_REFRESHING', 'Your session is refreshing. Retry shortly.');
    try {
      const fresh = await exchange(env, { grant_type: 'refresh_token', refresh_token: tokens.refresh_token });
      tokens = { access_token: fresh.access_token, refresh_token: fresh.refresh_token };
      const updated = await env.DB.prepare('UPDATE sessions SET tokens=?,access_expires_at=?,refresh_expires_at=?,refresh_lock_until=0 WHERE id_hash=?')
        .bind(await seal(tokens, env.TOKEN_ENCRYPTION_KEY), time + fresh.expires_in, time + fresh.refresh_token_expires_in, idHash).run();
      if (!updated.meta.changes) throw authRequired();
    } catch (error) {
      await env.DB.prepare('DELETE FROM sessions WHERE id_hash=?').bind(idHash).run();
      throw error;
    }
  }
  if (row.last_seen_at < time - 300) await env.DB.prepare('UPDATE sessions SET last_seen_at=? WHERE id_hash=?').bind(time, idHash).run();
  return { row, tokens, idHash };
}

export async function logout(env, active) {
  // Local revocation is immediate, including other tabs sharing this session.
  await env.DB.batch([
    env.DB.prepare('DELETE FROM sessions WHERE id_hash=?').bind(active.idHash),
    env.DB.prepare('DELETE FROM profile_sessions WHERE user_id=?').bind(active.row.user_id)
  ]);
  return { 'Set-Cookie': cookie(SESSION_COOKIE, '', 0) };
}
