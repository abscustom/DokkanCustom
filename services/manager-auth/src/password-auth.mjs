import { scryptSync, timingSafeEqual } from 'node:crypto';
import { Failure, random, hash, now, cookie, readCookie, requireOrigin, body, json, SESSION_COOKIE } from './security.mjs';
import { PROFILE_SITE_ORIGINS } from './auth.mjs';
import { contentAdminMethod, handleContentAdmin } from './content-api.mjs';

const COOKIE = '__Host-abs_password';
const TTL = 8 * 3600;
const profile = { login: 'absadmin', displayName: 'absadmin', avatarUrl: '', role: 'admin' };
const unauthorized = () => new Failure(401, 'PROFILE_AUTH_REQUIRED', 'Sign in again.');

function credential(env) {
  const value = String(env.ABSADMIN_PASSWORD_VERIFIER || '');
  if (!/^scrypt-v1:[a-f0-9]{32}:[a-f0-9]{64}$/.test(value)) {
    throw new Failure(503, 'PROFILE_PASSWORD_UNAVAILABLE', 'Password sign-in has not been activated.');
  }
  return value;
}

function cors(origin) {
  return { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type', Vary: 'Origin' };
}

async function activeSession(request, env, bearer = false) {
  const token = bearer ? /^Bearer lp_([A-Za-z0-9_-]{43})$/.exec(request.headers.get('Authorization') || '')?.[1] : readCookie(request, COOKIE);
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw unauthorized();
  const column = bearer ? 'profile_hash' : 'id_hash';
  const row = await env.DB.prepare(`SELECT * FROM password_sessions WHERE ${column}=?`).bind(await hash(token)).first();
  if (!row || row.expires_at <= now() || row.credential_version !== await hash(credential(env))) throw unauthorized();
  if (bearer && row.origin !== request.headers.get('Origin')) throw unauthorized();
  return row;
}

// A separate credential never impersonates a GitHub user or receives repository tokens.
export async function handlePasswordAuth(request, env) {
  const path = new URL(request.url).pathname;
  if (path.startsWith('/profile/password/')) {
    const origin = request.headers.get('Origin') || '';
    if (!PROFILE_SITE_ORIGINS.includes(origin)) throw new Failure(403, 'PROFILE_ORIGIN_REJECTED', 'Origin not allowed.');
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
    if (/^\/profile\/password\/cards\/[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(path) && request.method === 'POST') {
      await activeSession(request, env, true);
      const target = new URL(request.url);
      target.pathname = path.replace('/profile/password/cards/', '/api/content/cards/');
      const saved = await handleContentAdmin(new Request(target, { method: 'PUT', headers: request.headers, body: request.body, duplex: 'half' }), env, { login: 'absadmin' });
      const response = new Response(saved.body, saved);
      for (const [name, value] of Object.entries(cors(origin))) response.headers.set(name, value);
      response.headers.set('Cache-Control', 'no-store');
      return response;
    }
    const logout = path === '/profile/password/logout' && request.method === 'POST';
    if (!logout && !(path === '/profile/password/me' && request.method === 'GET')) throw new Failure(405, 'PROFILE_METHOD_NOT_ALLOWED', 'Method not allowed.');
    const row = await activeSession(request, env, true);
    if (logout) await env.DB.prepare('DELETE FROM password_sessions WHERE id_hash=?').bind(row.id_hash).run();
    return json(logout ? { ok: true } : { profile, expiresAt: row.expires_at, managerAccess: { status: 'ready' } }, 200, cors(origin));
  }
  if (path === '/auth/password') {
    if (request.method !== 'POST') throw new Failure(405, 'METHOD_NOT_ALLOWED', 'Method not allowed.');
    requireOrigin(request, env);
    const verifier = credential(env);
    const input = await body(request);
    if (!input || typeof input.password !== 'string' || input.password.length > 256 ||
        ![...PROFILE_SITE_ORIGINS, env.MANAGER_ORIGIN].includes(input.origin)) throw new Failure(400, 'PROFILE_REQUEST_INVALID', 'Invalid sign-in request.');
    const time = now(), windowStart = Math.floor(time / 900) * 900;
    // Both per-client and global persistent limits, applied before password hashing.
    const buckets = ['global', await hash(request.headers.get('CF-Connecting-IP') || 'unknown')];
    await env.DB.batch([
      env.DB.prepare('DELETE FROM password_attempts WHERE expires_at<=?').bind(time),
      ...buckets.map(key => env.DB.prepare('INSERT INTO password_attempts(bucket,attempts,expires_at) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET attempts=attempts+1').bind(`${key}:${windowStart}`, windowStart + 900))
    ]);
    for (const [index, key] of buckets.entries()) {
      const row = await env.DB.prepare('SELECT attempts FROM password_attempts WHERE bucket=?').bind(`${key}:${windowStart}`).first();
      if (row.attempts > (index === 0 ? 100 : 10)) throw new Failure(429, 'PROFILE_SIGN_IN_BUSY', 'Too many attempts. Try again in 15 minutes.');
    }
    const [, salt, expected] = verifier.split(':');
    const actual = scryptSync(input.password, Buffer.from(salt, 'hex'), 32, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
    if (!timingSafeEqual(actual, Buffer.from(expected, 'hex'))) throw new Failure(401, 'PROFILE_PASSWORD_INVALID', 'Incorrect password.');
    const id = random(), token = random(), csrf = random(), expiresAt = time + TTL;
    await env.DB.prepare('DELETE FROM password_sessions WHERE expires_at<=?').bind(time).run();
    const inserted = await env.DB.prepare('INSERT INTO password_sessions(id_hash,profile_hash,origin,csrf,credential_version,expires_at) SELECT ?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM password_sessions)<100')
      .bind(await hash(id), await hash(token), input.origin, csrf, await hash(verifier), expiresAt).run();
    if (!inserted.meta.changes) throw new Failure(429, 'PROFILE_SIGN_IN_BUSY', 'Too many active sessions.');
    const response = json({ token: `lp_${token}`, profile, expiresAt, managerAccess: { status: 'ready' } });
    response.headers.append('Set-Cookie', cookie(COOKIE, id, TTL));
    response.headers.append('Set-Cookie', cookie(SESSION_COOKIE, '', 0));
    return response;
  }
  const method = contentAdminMethod(path);
  if (!readCookie(request, COOKIE) || !(method || ['/api/session', '/api/session/logout'].includes(path))) return null;
  if (new URL(request.url).origin !== env.MANAGER_ORIGIN) throw new Failure(403, 'ORIGIN_REJECTED', 'Open Manager directly.');
  const expectedMethod = method || (path === '/api/session' ? 'GET' : 'POST');
  if (request.method !== expectedMethod) throw new Failure(405, 'METHOD_NOT_ALLOWED', 'Method not allowed.');
  if (request.method !== 'GET') requireOrigin(request, env);
  else if (['cross-site', 'same-site'].includes(request.headers.get('Sec-Fetch-Site'))) throw new Failure(403, 'ORIGIN_REJECTED', 'Open Manager directly.');
  const row = await activeSession(request, env);
  if (request.method !== 'GET' && request.headers.get('X-CSRF-Token') !== row.csrf) throw new Failure(403, 'CSRF_REJECTED', 'Reload Manager and retry.');
  if (path === '/api/session') return json({ login: 'absadmin', profile, csrfToken: row.csrf, expiresAt: row.expires_at, capabilities: { link: true, delete: true } });
  if (path === '/api/session/logout') {
    await env.DB.prepare('DELETE FROM password_sessions WHERE id_hash=?').bind(row.id_hash).run();
    return json({ ok: true }, 200, { 'Set-Cookie': cookie(COOKIE, '', 0) });
  }
  return handleContentAdmin(request, env, { login: 'absadmin' });
}
