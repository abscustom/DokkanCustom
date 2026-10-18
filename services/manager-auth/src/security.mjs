const encoder = new TextEncoder();
export const SESSION_COOKIE = '__Host-abs_manager';
export const OAUTH_COOKIE = '__Host-abs_manager_oauth';
export const PROFILE_OAUTH_COOKIE_PREFIX = '__Host-abs_profile_oauth_';
export const SESSION_SECONDS = 30 * 86400;
export const IDLE_SECONDS = 7 * 86400;
export const PROFILE_SESSION_SECONDS = 7 * 86400;
export const now = () => Math.floor(Date.now() / 1000);
export class Failure extends Error {
  constructor(status, code, message) { super(message); Object.assign(this, { status, code }); }
}
export function random(bytes = 32) { return base64url(crypto.getRandomValues(new Uint8Array(bytes))); }
export function base64url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function unbase64url(text) {
  if (!/^[A-Za-z0-9_-]+$/.test(text)) throw new Error('Invalid encoded secret');
  return Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
}
export async function hash(value) { return base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)))); }
export function cookie(name, value, seconds) { return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${seconds}`; }
export function readCookie(request, name) {
  const values = (request.headers.get('Cookie') || '').split(';').map(v => v.trim()).filter(v => v.startsWith(`${name}=`));
  return values.length === 1 ? values[0].slice(name.length + 1) : '';
}
export async function seal(value, secret) {
  const bytes = unbase64url(secret);
  if (bytes.length !== 32) throw new Error('Invalid encryption key');
  const key = await crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(JSON.stringify(value)));
  return `${base64url(iv)}.${base64url(new Uint8Array(data))}`;
}
export async function unseal(value, secret) {
  const [iv, data] = value.split('.');
  const key = await crypto.subtle.importKey('raw', unbase64url(secret), 'AES-GCM', false, ['decrypt']);
  return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unbase64url(iv) }, key, unbase64url(data))));
}
export const userIds = value => new Set(String(value || '').split(',').map(s => s.trim()).filter(s => /^\d+$/.test(s)));
export function configuration(env) {
  let valid = false;
  try {
    const origin = new URL(env.MANAGER_ORIGIN);
    valid = origin.origin === env.MANAGER_ORIGIN && origin.protocol === 'https:' &&
      Boolean(env.DB && env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) &&
      /^\d+$/.test(env.GITHUB_REPOSITORY_ID || '') && userIds(env.ADMIN_USER_IDS).size > 0 &&
      unbase64url(env.TOKEN_ENCRYPTION_KEY || '').length === 32;
  } catch {}
  if (!valid) throw new Failure(503, 'CONFIG_REQUIRED', 'Manager sign-in is not configured yet.');
}
export function profileConfiguration(env) {
  let valid = false;
  try {
    const origin = new URL(env.MANAGER_ORIGIN);
    valid = origin.origin === env.MANAGER_ORIGIN && origin.protocol === 'https:' &&
      Boolean(env.DB && env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) && userIds(env.ADMIN_USER_IDS).size > 0;
  } catch {}
  if (!valid) throw new Failure(503, 'PROFILE_CONFIG_REQUIRED', 'Website profile sign-in is not configured yet.');
}
export function requireOrigin(request, env) {
  if (request.headers.get('Origin') !== env.MANAGER_ORIGIN || ['cross-site', 'same-site'].includes(request.headers.get('Sec-Fetch-Site'))) {
    throw new Failure(403, 'ORIGIN_REJECTED', 'Open Manager directly before making changes.');
  }
}
export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers } });
}
export async function body(request) {
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) throw new Failure(415, 'JSON_REQUIRED', 'Send a JSON request.');
  const reader = request.body?.getReader();
  let size = 0; const chunks = [];
  if (reader) while (true) { const { value, done } = await reader.read(); if (done) break; size += value.length; if (size > 16384) { await reader.cancel(); throw new Failure(413, 'REQUEST_TOO_LARGE', 'Select fewer changes and retry.'); } chunks.push(value); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new Failure(400, 'INVALID_JSON', 'The request could not be read.'); }
}
