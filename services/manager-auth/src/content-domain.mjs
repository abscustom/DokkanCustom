import { DOMParser } from './html-dom.mjs';
import { parseFragment } from 'parse5';
import { Failure } from './security.mjs';

export const CONTENT_SCHEMA_VERSION = 1;
export const MAX_CARD_PAYLOAD_BYTES = 512 * 1024;
export const MAX_CARD_FORMS = 100;
export const MAX_CARD_TEXT = 4096;

const ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const CARD_PATH_RE = /^Custom Cards\/([A-Za-z0-9][A-Za-z0-9_-]{0,127})$/;
const HTML_FIELD_NAMES = new Set([
  'activeblockshtml', 'sablockshtml', 'passivecard', 'passivesidebar', 'links', 'categories'
]);
const DROP_TAGS = new Set([
  'script', 'style', 'iframe', 'object', 'embed', 'svg', 'math', 'template', 'base',
  'meta', 'link', 'form', 'foreignobject'
]);
const DROP_ATTRS = new Set([
  'srcdoc', 'formaction', 'action', 'xlink:href', 'form', 'formmethod', 'formenctype',
  'formtarget', 'formnovalidate'
]);
const URL_ATTRS = new Set(['href', 'src', 'poster', 'cite']);
const PASSIVE_ACTION_ATTRS = new Set(['data-card-content-action', 'data-card-content-id', 'data-card-content-direction', 'data-card-content-target', 'data-card-content-token']);
const PASSIVE_SHORTCUTS = new Set([':atk_down:', ':def_down:', ':stun:', ':seal:', ':break:', ':up:', ':down:', ':ydown:', ':once:', ':inf:']);

export function contentFailure(status, code, message) {
  return new Failure(status, code, message);
}

export function assertCardId(value) {
  if (typeof value !== 'string' || !ID_RE.test(value)) {
    throw contentFailure(400, 'CARD_ID_INVALID', 'Use a valid custom-card ID.');
  }
  return value;
}

function text(value, field, { required = false, max = MAX_CARD_TEXT } = {}) {
  if (value == null && !required) return '';
  if (typeof value !== 'string') throw contentFailure(400, 'CARD_FIELD_INVALID', `The ${field} field must be text.`);
  const result = value.trim();
  if (required && !result) throw contentFailure(400, 'CARD_FIELD_REQUIRED', `The ${field} field is required.`);
  if (result.length > max) throw contentFailure(413, 'CARD_FIELD_TOO_LARGE', `The ${field} field is too large.`);
  return result;
}

function summaryText(value, field, options = {}) {
  const result = text(value, field, options);
  if (/[<>\u0000-\u001f]/.test(result)) {
    throw contentFailure(400, 'CARD_SUMMARY_TEXT_REJECTED', `The ${field} field must be plain text.`);
  }
  return result;
}

function safeHttpsUrl(value, field, { required = false, trailingSlash = false, siteOnly = false, base = 'https://abscustom.github.io/' } = {}) {
  const raw = text(value, field, { required, max: 2048 });
  if (!raw) return '';
  let url;
  try { url = new URL(raw, base); }
  catch { throw contentFailure(400, 'CARD_URL_INVALID', `The ${field} URL is not valid.`); }
  if (url.protocol !== 'https:' || url.username || url.password || (siteOnly && url.hostname !== 'abscustom.github.io')) {
    throw contentFailure(400, 'CARD_URL_REJECTED', `The ${field} URL must use a safe HTTPS address.`);
  }
  if (trailingSlash && !url.pathname.endsWith('/')) throw contentFailure(400, 'CARD_ASSET_BASE_INVALID', 'The asset base must end with a slash.');
  return url.href;
}

const safeSiteUrl = (value, field, options = {}) => safeHttpsUrl(value, field, { ...options, siteOnly: true });

function safeRelativeAssetPath(value, field) {
  const raw = text(value, field, { max: 512 });
  if (!raw) return '';
  if (raw.startsWith('/') || raw.includes('\\') || raw.split('/').some(part => part === '..' || part === '.')) {
    throw contentFailure(400, 'CARD_ASSET_PATH_REJECTED', `The ${field} path is not a safe relative asset path.`);
  }
  return raw;
}

function htmlUrlIsSafe(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed || trimmed.startsWith('#')) return true;
  if (/^(?:javascript|vbscript|data|file):/i.test(trimmed)) return false;
  try {
    const url = new URL(trimmed, 'https://abscustom.github.io/');
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

function decodeTextareaText(value) {
  // linkedom treats textarea content as literal raw text. Decode it with the
  // HTML5 parser's RCDATA rules so repeated database saves remain byte-stable.
  const safeText = String(value || '').replace(/</g, '&lt;');
  const fragment = parseFragment(`<textarea>${safeText}</textarea>`);
  const textarea = fragment.childNodes.find(node => node.tagName === 'textarea');
  return (textarea?.childNodes || []).map(node => node.value || '').join('');
}

function passiveActionDescriptor(root, element, eventName, code) {
  const tag = String(element.localName || '').toLowerCase();
  const validId = id => /^\d{1,15}$/.test(String(id || '')) && Number.isSafeInteger(Number(id));
  const section = id => validId(id) ? root.querySelector(`#side-sec-${id}`) : null;
  const inSection = id => Boolean(section(id)?.contains(element));
  let match;
  if (eventName === 'oninput' && (match = code.match(/^updateHeader\(\s*(\d+)\s*,\s*this\.value\s*\)$/))) {
    const id = match[1];
    if (tag === 'input' && element.id === `input-sec-hdr-${id}` && inSection(id)) return { action: 'update-header', id };
  }
  if (eventName === 'oninput' && (match = code.match(/^updateSection\(\s*(\d+)\s*,\s*this\.value\s*\)$/))) {
    const id = match[1];
    if (tag === 'textarea' && element.id === `input-sec-${id}` && inSection(id)) return { action: 'update-section', id };
  }
  if (eventName === 'onclick' && (match = code.match(/^toggleSectionCollapse\(\s*(\d+)\s*,\s*(?:this|document\.getElementById\(['"]side-toggle-btn-(\d+)['"]\))\s*\)$/))) {
    const id = match[1];
    const referencedId = match[2];
    if ((!referencedId || referencedId === id) && inSection(id) &&
        ((tag === 'button' && element.id === `side-toggle-btn-${id}`) || tag === 'b')) {
      return { action: 'toggle-section', id };
    }
  }
  if (eventName === 'onclick' && (match = code.match(/^moveSection\(\s*(\d+)\s*,\s*(-?\d+)\s*\)$/))) {
    const id = match[1], delta = Number(match[2]);
    if (tag === 'button' && [-1, 1].includes(delta) && inSection(id)) return { action: 'move-section', id, direction: String(delta) };
  }
  if (eventName === 'onclick' && (match = code.match(/^confirmDeleteSection\(\s*this\s*,\s*(\d+)\s*\)$/))) {
    const id = match[1];
    if (tag === 'button' && inSection(id)) return { action: 'delete-section', id };
  }
  if (eventName === 'onclick' && (match = code.match(/^insertShortcut\(\s*['"](input-sec-hdr-(\d+)|input-sec-(\d+))['"]\s*,\s*['"](:[a-z_]+:)['"]\s*\)$/))) {
    const targetId = match[1], id = match[2] || match[3], token = match[4];
    if (!validId(id)) return null;
    const target = root.querySelector(`#${targetId}`);
    if (tag === 'button' && inSection(id) && target && PASSIVE_SHORTCUTS.has(token)) {
      return { action: 'insert-shortcut', id, target: targetId, token };
    }
  }
  return null;
}

function validatedPassiveAction(root, element, source) {
  if (!source || typeof source.action !== 'string') return null;
  const id = source.id;
  if (!/^\d{1,15}$/.test(String(id || '')) || !Number.isSafeInteger(Number(id))) return null;
  const tag = String(element.localName || '').toLowerCase();
  const section = root.querySelector(`#side-sec-${id}`);
  if (!section || !section.contains(element)) return null;
  switch (source.action) {
    case 'update-header':
      return tag === 'input' && element.id === `input-sec-hdr-${id}` ? { action: source.action, id } : null;
    case 'update-section':
      return tag === 'textarea' && element.id === `input-sec-${id}` ? { action: source.action, id } : null;
    case 'toggle-section':
      return (tag === 'b' || (tag === 'button' && element.id === `side-toggle-btn-${id}`)) ? { action: source.action, id } : null;
    case 'move-section':
      return tag === 'button' && ['-1', '1'].includes(String(source.direction)) ? { action: source.action, id, direction: String(source.direction) } : null;
    case 'delete-section':
      return tag === 'button' ? { action: source.action, id } : null;
    case 'insert-shortcut': {
      const targetId = String(source.target || ''), token = String(source.token || '');
      if (!/^(?:input-sec-hdr|input-sec)-\d+$/.test(targetId) || !targetId.endsWith(`-${id}`)) return null;
      const target = root.querySelector(`#${targetId}`);
      return tag === 'button' && target && PASSIVE_SHORTCUTS.has(token)
        ? { action: source.action, id, target: targetId, token }
        : null;
    }
    default:
      return null;
  }
}

function setPassiveAction(element, descriptor) {
  if (!descriptor) return;
  element.setAttribute('data-card-content-action', descriptor.action);
  element.setAttribute('data-card-content-id', descriptor.id);
  if (descriptor.direction) element.setAttribute('data-card-content-direction', descriptor.direction);
  if (descriptor.target) element.setAttribute('data-card-content-target', descriptor.target);
  if (descriptor.token) element.setAttribute('data-card-content-token', descriptor.token);
}

export function sanitizeHtmlFragment(value, { allowPassiveEditorActions = false } = {}) {
  const html = String(value ?? '');
  const doc = new DOMParser().parseFromString(`<main id="content-root">${html}</main>`, 'text/html');
  const root = doc.querySelector('#content-root') || doc.body;
  for (const element of [...root.querySelectorAll('*')]) {
    const tag = String(element.localName || '').toLowerCase();
    if (DROP_TAGS.has(tag) || tag.includes('-')) {
      element.remove();
      continue;
    }
    if (tag === 'textarea') element.textContent = decodeTextareaText(element.textContent);
    const sourceDescriptor = allowPassiveEditorActions ? {
      action: element.getAttribute('data-card-content-action'),
      id: element.getAttribute('data-card-content-id'),
      direction: element.getAttribute('data-card-content-direction'),
      target: element.getAttribute('data-card-content-target'),
      token: element.getAttribute('data-card-content-token')
    } : null;
    for (const attribute of [...element.attributes]) {
      if (PASSIVE_ACTION_ATTRS.has(String(attribute.name || '').toLowerCase())) element.removeAttribute(attribute.name);
    }
    let descriptor = allowPassiveEditorActions ? validatedPassiveAction(root, element, sourceDescriptor) : null;
    for (const attribute of [...element.attributes]) {
      const name = String(attribute.name || '').toLowerCase();
      const attrValue = String(attribute.value || '');
      if (name.startsWith('on')) {
        if (!descriptor && allowPassiveEditorActions) descriptor = passiveActionDescriptor(root, element, name, attrValue);
        element.removeAttribute(attribute.name);
      } else if (DROP_ATTRS.has(name) || name === 'srcset') {
        element.removeAttribute(attribute.name);
      } else if (URL_ATTRS.has(name) && !htmlUrlIsSafe(attrValue)) {
        element.removeAttribute(attribute.name);
      } else if (name === 'style' && /(?:url\s*\(|expression\s*\(|@import|-moz-binding|behavior\s*:|data:)/i.test(attrValue)) {
        element.removeAttribute(attribute.name);
      }
    }
    // Passive sidebar fragments can contain their editable values. Preserve
    // the native controls and their value/checked/selected state, but never
    // preserve inline handlers or browser submission behavior from source HTML.
    if (tag === 'button') element.setAttribute('type', 'button');
    if (tag === 'input' && ['submit', 'image', 'reset'].includes(String(element.getAttribute('type') || '').toLowerCase())) {
      element.setAttribute('type', 'text');
    }
    if (allowPassiveEditorActions) setPassiveAction(element, descriptor);
    if (element.localName === 'a' && element.getAttribute('target') === '_blank') {
      const rel = new Set((element.getAttribute('rel') || '').split(/\s+/).filter(Boolean));
      rel.add('noopener');
      rel.add('noreferrer');
      element.setAttribute('rel', [...rel].join(' '));
    }
  }
  return root.innerHTML || '';
}

function cloneSafe(value) {
  let parsed;
  try { parsed = JSON.parse(JSON.stringify(value)); }
  catch { throw contentFailure(400, 'CARD_PAYLOAD_INVALID', 'The card payload must be plain JSON.'); }
  const inspect = (node, depth = 0) => {
    if (depth > 50) throw contentFailure(413, 'CARD_PAYLOAD_TOO_DEEP', 'The card payload is nested too deeply.');
    if (Array.isArray(node)) return node.forEach(child => inspect(child, depth + 1));
    if (!node || typeof node !== 'object') return;
    for (const [key, child] of Object.entries(node)) {
      if (key === '__proto__' || key === 'prototype' || key === 'constructor') {
        throw contentFailure(400, 'CARD_PAYLOAD_KEY_REJECTED', 'The card payload contains a reserved field name.');
      }
      if (typeof child === 'string' && /data:(?:image|audio|video)\/[^;,]+;base64,/i.test(child)) {
        throw contentFailure(400, 'CARD_MEDIA_INLINE', 'Store card media at its existing asset URL, not inside D1.');
      }
      inspect(child, depth + 1);
    }
  };
  inspect(parsed);
  return parsed;
}

function sanitizePayload(value) {
  const payload = cloneSafe(value);
  const visit = (node, key = '', inContainers = false) => {
    if (typeof node === 'string') {
      const normalizedKey = key.toLowerCase();
      return HTML_FIELD_NAMES.has(normalizedKey) || normalizedKey.endsWith('html') || normalizedKey.endsWith('htmltext')
        ? sanitizeHtmlFragment(node, { allowPassiveEditorActions: normalizedKey === 'passivesidebar' })
        : node;
    }
    if (Array.isArray(node)) return node.map(child => visit(child, key, inContainers));
    if (!node || typeof node !== 'object') return node;
    const next = {};
    for (const [childKey, child] of Object.entries(node)) {
      if (childKey === 'formsData') {
        next.formsData = [];
        continue;
      }
      if (inContainers && childKey === 'forms') {
        next.forms = '';
        continue;
      }
      next[childKey] = visit(child, childKey, childKey === 'containers');
    }
    return next;
  };
  const result = visit(payload);
  if (!Array.isArray(result.formsData)) result.formsData = [];
  if (result.containers && typeof result.containers === 'object' && !Array.isArray(result.containers)) result.containers.forms = '';
  const bytes = new TextEncoder().encode(JSON.stringify(result)).byteLength;
  if (bytes > MAX_CARD_PAYLOAD_BYTES) throw contentFailure(413, 'CARD_PAYLOAD_TOO_LARGE', 'The card payload is too large.');
  return result;
}

function normalizeForms(value) {
  if (!Array.isArray(value) || value.length > MAX_CARD_FORMS) {
    throw contentFailure(400, 'CARD_FORMS_INVALID', 'The card form list is invalid or too large.');
  }
  return value.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw contentFailure(400, 'CARD_FORM_INVALID', `Form ${index + 1} is invalid.`);
    return {
      name: summaryText(entry.name, `form ${index + 1} name`, { max: 180 }),
      link: safeHttpsUrl(entry.link, `form ${index + 1} link`),
      imageSrc: safeHttpsUrl(entry.imageSrc, `form ${index + 1} image`),
      thumbSrc: safeHttpsUrl(entry.thumbSrc, `form ${index + 1} thumbnail`),
      imageExportName: safeRelativeAssetPath(entry.imageExportName, `form ${index + 1} export name`),
      ...(entry.targetId == null || entry.targetId === '' ? {} : { targetId: assertCardId(entry.targetId) })
    };
  });
}

function categoryNames(value, payload) {
  let source = value;
  if (source == null) source = payload?.categoryNames;
  if (source == null) source = payload?.containers?.categoryNames;
  if (source == null) {
    const html = String(payload?.containers?.categories || '');
    source = [...html.matchAll(/\b(?:data-category-name|alt|title)\s*=\s*(["'])(.*?)\1/gi)].map(match => match[2]);
  }
  if (!Array.isArray(source) || source.length > 200) throw contentFailure(400, 'CARD_CATEGORIES_INVALID', 'The card category list is invalid.');
  return [...new Set(source.map((item, index) => summaryText(item, `category ${index + 1}`, { max: 120 })).filter(Boolean))];
}

export function normalizeCardInput(idValue, value) {
  const id = assertCardId(idValue);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw contentFailure(400, 'CARD_INPUT_INVALID', 'The card record is invalid.');
  const payload = sanitizePayload(value.payload);
  const inputs = payload.inputs && typeof payload.inputs === 'object' ? payload.inputs : {};
  const assetBase = safeSiteUrl(value.assetBase, 'asset base', { required: true, trailingSlash: true });
  const repoPath = text(value.repoPath, 'repository path', { required: true, max: 256 });
  const repoMatch = repoPath.match(CARD_PATH_RE);
  if (!repoMatch || repoMatch[1] !== id) throw contentFailure(400, 'CARD_REPO_PATH_INVALID', 'The repository path must match the card ID.');
  const status = value.status || 'published';
  if (!['published', 'draft'].includes(status)) throw contentFailure(400, 'CARD_STATUS_INVALID', 'Use the archive action to archive a card.');
  const name = summaryText(value.name || inputs.nameInput || id, 'name', { required: true, max: 180 });
  const title = summaryText(value.title || name, 'title', { required: true, max: 300 });
  const type = summaryText(value.type || payload.currentType || 'unknown', 'type', { required: true, max: 32 });
  const rarity = summaryText(value.rarity || payload.currentRarity || 'unknown', 'rarity', { required: true, max: 32 });
  const cardClass = summaryText(value.cardClass ?? payload.currentClass ?? '', 'card class', { max: 64 });
  const releaseDate = summaryText(value.releaseDate ?? inputs.dateInput ?? '', 'release date', { max: 80 });
  const categories = categoryNames(value.categoryNames, payload);
  const thumb = safeHttpsUrl(value.thumb ?? payload.thumbMain ?? '', 'thumbnail');
  const cardArtImageUrl = safeHttpsUrl(value.cardArtImageUrl ?? payload.cardArtImage ?? '', 'card art image');
  const cardArtVideoUrl = safeHttpsUrl(value.cardArtVideoUrl ?? payload.cardArtVideo ?? '', 'card art video');
  const unitTag = summaryText(value.unitTag ?? payload.absUnitTag ?? '', 'unit tag', { max: 120 });
  const awakeningMode = summaryText(value.awakeningMode ?? payload.currentAwakeningMode ?? '', 'awakening mode', { max: 80 });
  const builtinForms = normalizeForms(value.builtinForms ?? []);
  const payloadBytes = new TextEncoder().encode(JSON.stringify(payload)).byteLength;
  if (payloadBytes > MAX_CARD_PAYLOAD_BYTES) throw contentFailure(413, 'CARD_PAYLOAD_TOO_LARGE', 'The card payload is too large.');
  return {
    id,
    slug: id,
    schemaVersion: CONTENT_SCHEMA_VERSION,
    status,
    name,
    title,
    type,
    rarity,
    cardClass,
    releaseDate,
    categoryNames: categories,
    cardArtImageUrl,
    cardArtVideoUrl,
    unitTag,
    awakeningMode,
    thumb,
    repoPath,
    assetBase,
    payload,
    builtinForms
  };
}

export function expectedRevision(value) {
  if (!Number.isSafeInteger(value) || value < 0) throw contentFailure(400, 'EXPECTED_REVISION_INVALID', 'A non-negative expected revision is required.');
  return value;
}

export function canonicalLinkPair(leftValue, rightValue) {
  const left = assertCardId(leftValue), right = assertCardId(rightValue);
  if (left === right) throw contentFailure(400, 'CARD_LINK_SELF', 'A card cannot link to itself.');
  return left < right ? [left, right] : [right, left];
}

export function validateAliasPath(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.length > 2048 || value.includes('\\') || /[?#\u0000-\u001f]/.test(value)) {
    throw contentFailure(400, 'CARD_ALIAS_INVALID', 'The card alias path is invalid.');
  }
  let decoded;
  try { decoded = decodeURIComponent(value); } catch { throw contentFailure(400, 'CARD_ALIAS_INVALID', 'The card alias path is invalid.'); }
  if (decoded.split('/').some(part => part === '.' || part === '..') || decoded.startsWith('//')) {
    throw contentFailure(400, 'CARD_ALIAS_INVALID', 'The card alias path is invalid.');
  }
  return value;
}
