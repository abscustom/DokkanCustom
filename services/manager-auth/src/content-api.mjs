import { Failure, hash, json } from './security.mjs';
import { PROFILE_SITE_ORIGINS } from './auth.mjs';
import {
  assertCardId,
  expectedRevision,
  normalizeCardInput,
  validateAliasPath
} from './content-domain.mjs';
import {
  adminCatalogRequest,
  applyLinkOperations,
  archiveCard,
  exportContentSnapshot,
  publicCardDetail,
  publicCatalogRequest,
  requireContentDatabase,
  resolvePublicAlias,
  saveCard
} from './content-store.mjs';

const PUBLIC_PREFIX = '/api/public/cards';
const MAX_EXPORT_BYTES = 5 * 1024 * 1024;
const MAX_CARD_REQUEST_BYTES = 1024 * 1024;
const MAX_LINK_REQUEST_BYTES = 64 * 1024;

function publicPath(path) {
  return path === PUBLIC_PREFIX || path.startsWith(`${PUBLIC_PREFIX}/`);
}

function apiError(error, headers = {}) {
  const known = error instanceof Failure;
  const status = known ? error.status : 503;
  const code = known ? error.code : 'CONTENT_UNAVAILABLE';
  const message = known ? error.message : 'The card service is temporarily unavailable.';
  return json({ error: { code, message } }, status, { 'Cache-Control': 'no-store', ...headers });
}

function corsHeaders(origin, { cache = false } = {}) {
  return {
    'Vary': 'Origin',
    ...(PROFILE_SITE_ORIGINS.includes(origin) ? {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Expose-Headers': 'ETag, Cache-Control',
      'Access-Control-Allow-Credentials': 'false'
    } : {}),
    'Cache-Control': cache ? 'public, max-age=0, must-revalidate' : 'no-store'
  };
}

function etagHeaders(body) {
  return hash(JSON.stringify(body)).then(value => ({ ETag: `"${value}"` }));
}

function matchesEtag(request, etag) {
  const value = request.headers.get('If-None-Match') || '';
  return value.split(',').map(item => item.trim()).some(item => item === '*' || item === etag);
}

async function publicResponse(request, body, headers, { cache = false, etag = true } = {}) {
  const extra = etag ? await etagHeaders(body) : {};
  const finalHeaders = { ...headers, ...corsHeaders(request.headers.get('Origin') || '', { cache }), ...extra };
  if (etag && matchesEtag(request, extra.ETag)) return new Response(null, { status: 304, headers: finalHeaders });
  return json(body, 200, finalHeaders);
}

async function readJson(request, maxBytes) {
  if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) {
    throw new Failure(415, 'JSON_REQUIRED', 'Send a JSON request.');
  }
  const reader = request.body?.getReader();
  const chunks = [];
  let size = 0;
  if (reader) {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new Failure(413, 'REQUEST_TOO_LARGE', 'The card request is too large.');
      }
      chunks.push(value);
    }
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new Failure(400, 'INVALID_JSON', 'The card request could not be read.'); }
}

function decodePathId(segment) {
  let id;
  try { id = decodeURIComponent(segment); }
  catch { throw new Failure(400, 'CARD_ID_INVALID', 'Use a valid custom-card ID.'); }
  return assertCardId(id);
}

function canonicalAliasQuery(value) {
  validateAliasPath(value);
  // URLSearchParams decodes spaces in `path=/Custom%20Cards/...`; store keys
  // remain the exact encoded URL pathname seen by browsers.
  return value.replace(/ /g, '%20');
}

export async function handlePublicContent(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowedOrigin = !origin || PROFILE_SITE_ORIGINS.includes(origin);
  const headers = corsHeaders(origin);
  try {
    if (!allowedOrigin) throw new Failure(403, 'ORIGIN_REJECTED', 'This website origin is not allowed.');
    const url = new URL(request.url);
    const path = url.pathname;
    if (request.method === 'OPTIONS') {
      const requestedMethod = request.headers.get('Access-Control-Request-Method') || '';
      const requestedHeaders = (request.headers.get('Access-Control-Request-Headers') || '').toLowerCase().split(',').map(value => value.trim()).filter(Boolean);
      if (!origin || !PROFILE_SITE_ORIGINS.includes(origin) || requestedMethod !== 'GET' || requestedHeaders.some(value => !['if-none-match', 'content-type'].includes(value))) {
        throw new Failure(403, 'PUBLIC_PREFLIGHT_REJECTED', 'This public card request is not allowed.');
      }
      return new Response(null, { status: 204, headers: {
        ...headers,
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'If-None-Match, Content-Type',
        'Access-Control-Max-Age': '600'
      } });
    }
    if (request.method !== 'GET') throw new Failure(405, 'METHOD_NOT_ALLOWED', 'This public card request method is unavailable.');

    const db = requireContentDatabase(env);
    if (path === PUBLIC_PREFIX) {
      const catalog = await publicCatalogRequest(db, url);
      return await publicResponse(request, catalog, headers, { cache: true });
    }
    if (path === `${PUBLIC_PREFIX}/resolve`) {
      const raw = url.searchParams.get('path');
      if (raw == null) throw new Failure(400, 'CARD_ALIAS_REQUIRED', 'Provide an exact legacy card path.');
      const alias = await resolvePublicAlias(db, canonicalAliasQuery(raw));
      if (!alias) throw new Failure(404, 'CARD_ALIAS_NOT_FOUND', 'This legacy card path is unavailable.');
      return await publicResponse(request, alias, headers, { cache: true });
    }
    const match = path.match(/^\/api\/public\/cards\/([^/]+)$/);
    if (!match) throw new Failure(404, 'CARD_ROUTE_NOT_FOUND', 'This public card route is unavailable.');
    const id = decodePathId(match[1]);
    const detail = await publicCardDetail(db, id);
    if (!detail) throw new Failure(404, 'CARD_NOT_FOUND', 'This card is unavailable.');
    return await publicResponse(request, detail, headers, { cache: true });
  } catch (error) {
    return apiError(error, headers);
  }
}

export function contentAdminMethod(path) {
  if (path === '/api/content/cards' || path === '/api/content/export') return 'GET';
  if (path === '/api/content/links/apply') return 'POST';
  if (/^\/api\/content\/cards\/[^/]+$/.test(path)) return 'PUT';
  if (/^\/api\/content\/cards\/[^/]+\/archive$/.test(path)) return 'POST';
  return null;
}

export function isPublicContentPath(path) {
  return publicPath(path);
}

export async function handleContentAdmin(request, env, actor) {
  const db = requireContentDatabase(env);
  const url = new URL(request.url);
  const path = url.pathname;
  if (request.method === 'GET' && path === '/api/content/cards') {
    return json(await adminCatalogRequest(db, url));
  }
  if (request.method === 'GET' && path === '/api/content/export') {
    const snapshot = await exportContentSnapshot(db);
    if (new TextEncoder().encode(JSON.stringify(snapshot)).byteLength > MAX_EXPORT_BYTES) {
      throw new Failure(413, 'CONTENT_EXPORT_TOO_LARGE', 'The recovery export is too large for one response.');
    }
    return json(snapshot, 200, { 'Cache-Control': 'no-store', 'Content-Disposition': 'attachment; filename="card-content-recovery.json"' });
  }
  if (env.CONTENT_WRITES_ENABLED !== 'true') {
    throw new Failure(503, 'CONTENT_WRITES_DISABLED', 'Card database writes are not enabled.');
  }
  if (request.method === 'PUT') {
    const match = path.match(/^\/api\/content\/cards\/([^/]+)$/);
    if (!match) throw new Failure(404, 'CONTENT_ROUTE_NOT_FOUND', 'This card action is unavailable.');
    const id = decodePathId(match[1]);
    const body = await readJson(request, MAX_CARD_REQUEST_BYTES);
    const expected = expectedRevision(body?.expectedRevision);
    const card = normalizeCardInput(id, body?.card);
    if (card.status === 'archived') throw new Failure(400, 'CARD_STATUS_INVALID', 'Use the archive action to archive a card.');
    return json(await saveCard(db, id, expected, card, actor?.login || 'manager'));
  }
  if (request.method === 'POST' && path === '/api/content/links/apply') {
    const body = await readJson(request, MAX_LINK_REQUEST_BYTES);
    return json(await applyLinkOperations(db, body, actor?.login || 'manager'));
  }
  if (request.method === 'POST') {
    const match = path.match(/^\/api\/content\/cards\/([^/]+)\/archive$/);
    if (match) {
      const id = decodePathId(match[1]);
      const body = await readJson(request, 16 * 1024);
      const expected = expectedRevision(body?.expectedRevision);
      return json(await archiveCard(db, id, expected, actor?.login || 'manager'));
    }
  }
  throw new Failure(404, 'CONTENT_ROUTE_NOT_FOUND', 'This card action is unavailable.');
}
