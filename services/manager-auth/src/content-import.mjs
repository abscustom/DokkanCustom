import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DOMParser } from './html-dom.mjs';
import { canonicalLinkPair, normalizeCardInput, validateAliasPath } from './content-domain.mjs';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.resolve(MODULE_DIR, '../../..');
export const DEFAULT_SOURCE_ROOT = path.resolve(PROJECT_ROOT, '../abscustom/Custom Cards');
export const SITE_ORIGIN = 'https://abscustom.github.io';
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif']);
const DATA_URL_RE = /data:(image\/[A-Za-z0-9.+-]+);base64,([A-Za-z0-9+/=_-]+)/gi;

const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const encodePath = value => value.split('/').map(segment => encodeURIComponent(segment)).join('/');
const toPosix = value => value.split(path.sep).join('/');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function htmlTitle(html) {
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return String(doc.querySelector('title')?.textContent || '').replace(/\s+/g, ' ').trim();
  } catch { return ''; }
}

function parseAnchors(html) {
  try {
    const doc = new DOMParser().parseFromString(`<main id="content-root">${html || ''}</main>`, 'text/html');
    const root = doc.querySelector('#content-root') || doc.body;
    return [...root.querySelectorAll('a[href]')].map(anchor => ({
      href: anchor.getAttribute('href') || '',
      imageSrc: anchor.querySelector('img')?.getAttribute('src') || ''
    }));
  } catch { return []; }
}

function parseCategoryNames(html, categoryMap) {
  const result = new Set();
  const push = value => { const cleaned = String(value || '').replace(/\s+/g, ' ').trim(); if (cleaned) result.add(cleaned); };
  for (const match of String(html || '').matchAll(/\bdata-category-name\s*=\s*(["'])(.*?)\1/gi)) push(match[2]);
  for (const match of String(html || '').matchAll(/\bdata-category-id\s*=\s*(["'])(\d+)\1/gi)) {
    const category = categoryMap.get(match[2]);
    if (category) push(category);
  }
  if (!result.size) for (const match of String(html || '').matchAll(/\balt\s*=\s*(["'])(.*?)\1/gi)) push(match[2]);
  return [...result];
}

function categoryMapFromFile(filePath) {
  try {
    const rows = readJson(filePath);
    return new Map((Array.isArray(rows) ? rows : []).map(row => [String(row.id), String(row.name || '')]));
  } catch { return new Map(); }
}

function listImageFiles(root) {
  const files = [];
  const walk = directory => {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(absolute);
      else if (IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        const relativePath = toPosix(path.relative(root, absolute));
        const bytes = fs.readFileSync(absolute);
        files.push({ relativePath, hash: sha256(bytes), bytes: bytes.length });
      }
    }
  };
  walk(root);
  files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return files;
}

function addAlias(aliases, pathValue, cardId, provenance, report) {
  let pathKey;
  try { pathKey = validateAliasPath(pathValue); }
  catch {
    report.unresolvedAliases.push({ path: String(pathValue), cardId, reason: 'invalid-path' });
    return;
  }
  const existing = aliases.get(pathKey);
  if (existing && existing.cardId !== cardId) {
    report.unresolvedAliases.push({ path: pathKey, cardId, conflictWith: existing.cardId, reason: 'alias-collision' });
    return;
  }
  if (!existing) aliases.set(pathKey, { path: pathKey, cardId, provenance });
}

function pathFromUrl(raw, base) {
  try {
    const url = new URL(String(raw || ''), base || SITE_ORIGIN);
    if (url.protocol !== 'https:' || url.hostname !== 'abscustom.github.io') return '';
    return url.pathname;
  } catch { return ''; }
}

function resolveFormTarget(form, aliases, ids, cardId) {
  if (typeof form?.adminLinkedSlug === 'string' && ids.has(form.adminLinkedSlug)) return form.adminLinkedSlug;
  const pathname = pathFromUrl(form?.link, `${SITE_ORIGIN}/Custom%20Cards/${encodeURIComponent(cardId)}/`);
  return aliases.get(pathname)?.cardId || null;
}

function safeUrl(raw, base, field, report, cardId) {
  const value = String(raw || '').trim();
  if (!value) return '';
  try {
    const url = new URL(value, base || SITE_ORIGIN);
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('unsafe scheme or credentials');
    return url.href;
  } catch {
    report.blockers.push({ code: 'UNSAFE_URL', cardId, field, value: value.slice(0, 180) });
    return '';
  }
}

function makeMediaResolver({ sourceRoot, files, report }) {
  const byHash = new Map();
  for (const file of files) {
    if (!byHash.has(file.hash)) byHash.set(file.hash, []);
    byHash.get(file.hash).push(file);
  }
  const seenHashes = new Set();
  const audit = (value, { cardId, targetId = cardId, field = 'source' } = {}) => {
    const raw = String(value || '');
    const match = raw.match(/^data:(image\/[A-Za-z0-9.+-]+);base64,([A-Za-z0-9+/=_-]+)$/i);
    if (!match) return false;
    const bytes = Buffer.from(match[2], 'base64');
    const digest = sha256(bytes);
    seenHashes.add(digest);
    const matches = byHash.get(digest) || [];
    if (!matches.length) {
      report.blockers.push({ code: 'MEDIA_UNMAPPED', cardId, field, mime: match[1], bytes: bytes.length, sha256: digest });
    }
    return true;
  };
  const choosePath = (matches, preferredCardId, formIndex, field) => {
    const preferredPrefix = preferredCardId ? `${preferredCardId}/` : '';
    const preferred = matches.filter(file => preferredPrefix && file.relativePath.startsWith(preferredPrefix));
    if (formIndex != null && preferred.length) {
      const thumbPrefix = `Form_Thumb_${formIndex + 1}_`;
      const thumbs = preferred.filter(file => path.basename(file.relativePath).startsWith(thumbPrefix));
      if (thumbs.length) return thumbs[0];
    }
    if (preferred.length) return preferred[0];
    if (formIndex != null) {
      const thumbs = matches.filter(file => path.basename(file.relativePath).startsWith(`Form_Thumb_${formIndex + 1}_`));
      if (thumbs.length) return thumbs[0];
    }
    return matches[0];
  };
  const resolve = (value, { cardId, targetId = cardId, formIndex = null, field = 'payload' } = {}) => {
    const raw = String(value || '');
    const match = raw.match(/^data:(image\/[A-Za-z0-9.+-]+);base64,([A-Za-z0-9+/=_-]+)$/i);
    if (!match) return raw;
    const bytes = Buffer.from(match[2], 'base64');
    const digest = sha256(bytes);
    const matches = byHash.get(digest) || [];
    seenHashes.add(digest);
    if (!matches.length) {
      report.blockers.push({ code: 'MEDIA_UNMAPPED', cardId, field, mime: match[1], bytes: bytes.length, sha256: digest });
      return raw;
    }
    const selected = choosePath(matches, targetId || cardId, formIndex, field);
    report.media.mappedOutputDataUrlFields += 1;
    if (!report.media.mappings.some(item => item.sha256 === digest && item.targetId === (targetId || cardId))) {
      report.media.mappings.push({
        cardId,
        targetId: targetId || cardId,
        field,
        sha256: digest,
        file: selected.relativePath,
        bytes: bytes.length
      });
    }
    return `${SITE_ORIGIN}/${encodePath(`Custom Cards/${selected.relativePath}`)}`;
  };
  const replace = (value, context) => {
    if (typeof value === 'string') {
      const direct = resolve(value, context);
      if (direct !== value) return direct;
      return value.replace(DATA_URL_RE, full => resolve(full, context));
    }
    if (Array.isArray(value)) return value.map((child, index) => replace(child, { ...context, field: `${context?.field || 'payload'}[${index}]` }));
    if (!value || typeof value !== 'object') return value;
    const result = {};
    for (const [key, child] of Object.entries(value)) {
      if (key === 'formsData') { result.formsData = []; continue; }
      if (context?.inContainers && key === 'forms') { result.forms = ''; continue; }
      result[key] = replace(child, {
        ...context,
        field: `${context?.field || 'payload'}.${key}`,
        inContainers: key === 'containers'
      });
    }
    return result;
  };
  return { resolve, replace, audit, get uniqueDataUriCount() { return seenHashes.size; } };
}

function auditEmbeddedMedia(value, cardId, field, media) {
  if (typeof value === 'string') {
    const matches = [...value.matchAll(new RegExp(DATA_URL_RE.source, 'gi'))];
    for (const match of matches) media.audit(match[0], { cardId, field });
    return matches.length;
  }
  if (Array.isArray(value)) return value.reduce((count, child, index) => count + auditEmbeddedMedia(child, cardId, `${field}[${index}]`, media), 0);
  if (!value || typeof value !== 'object') return 0;
  return Object.entries(value).reduce((count, [key, child]) => count + auditEmbeddedMedia(child, cardId, `${field}.${key}`, media), 0);
}

function folderUrl(cardId) {
  return `${SITE_ORIGIN}/Custom%20Cards/${encodeURIComponent(cardId)}/`;
}

function addFolderAliases(aliases, rootName, cardId, provenance, report) {
  const base = `/${encodeURIComponent(rootName)}`;
  addAlias(aliases, base, cardId, provenance, report);
  addAlias(aliases, `${base}/`, cardId, provenance, report);
  addAlias(aliases, `${base}/index.html`, `${cardId}`, provenance.replace('directory', 'index'), report);
}

function collectRootDirectoryAliases(repoRoot, records, aliases, report) {
  const titleToRecord = new Map();
  for (const record of records) {
    if (!titleToRecord.has(record.title)) titleToRecord.set(record.title, []);
    titleToRecord.get(record.title).push(record);
  }
  for (const entry of fs.readdirSync(repoRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.toLowerCase() === 'custom cards') continue;
    const folder = path.join(repoRoot, entry.name);
    const index = path.join(folder, 'index.html');
    if (!fs.existsSync(index)) continue;
    const title = htmlTitle(fs.readFileSync(index, 'utf8'));
    const matches = titleToRecord.get(title) || [];
    if (matches.length !== 1) continue;
    addFolderAliases(aliases, entry.name, matches[0].id, 'existing-root-directory', report);
  }
}

function inferHistoricFormAliases(records, aliases, idSet, report) {
  for (const record of records) {
    for (const anchor of parseAnchors(record.raw.containers?.forms)) {
      const pathname = pathFromUrl(anchor.href, folderUrl(record.id));
      if (!pathname || aliases.has(pathname)) continue;
      const form = (Array.isArray(record.raw.formsData) ? record.raw.formsData : []).find(item => {
        const formUrl = safeUrl(item?.imageSrc, folderUrl(record.id), 'form image', { blockers: [] }, record.id);
        const anchorUrl = safeUrl(anchor.imageSrc, folderUrl(record.id), 'form anchor image', { blockers: [] }, record.id);
        return formUrl && anchorUrl && formUrl === anchorUrl;
      });
      if (!form) continue;
      const targetId = resolveFormTarget(form, aliases, idSet, record.id);
      if (targetId) addAlias(aliases, pathname, targetId, 'historic-form-link-inference', report);
    }
  }
}

function serializeAliases(aliases) {
  return [...aliases.values()].sort((a, b) => a.path.localeCompare(b.path));
}

function parseJsonFiles(sourceRoot, report) {
  const records = [];
  for (const entry of fs.readdirSync(sourceRoot, { withFileTypes: true }).filter(item => item.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    const cardJsonPath = path.join(sourceRoot, entry.name, 'card.json');
    if (!fs.existsSync(cardJsonPath)) continue;
    const indexPath = path.join(sourceRoot, entry.name, 'index.html');
    const rawText = fs.readFileSync(cardJsonPath, 'utf8');
    let raw;
    try { raw = JSON.parse(rawText); }
    catch (error) {
      report.blockers.push({ code: 'CARD_JSON_INVALID', cardId: entry.name, message: String(error.message).slice(0, 180) });
      continue;
    }
    const indexHtml = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, 'utf8') : '';
    const title = htmlTitle(indexHtml);
    records.push({
      id: entry.name,
      raw,
      title: title || String(raw.inputs?.nameInput || entry.name),
      sourcePath: toPosix(path.relative(path.dirname(sourceRoot), cardJsonPath)),
      cardJsonPath,
      indexPath: fs.existsSync(indexPath) ? indexPath : null,
      cardJsonChecksum: sha256(rawText),
      indexChecksum: indexHtml ? sha256(indexHtml) : null,
      indexHtml
    });
    if (!indexHtml) report.warnings.push({ code: 'CARD_INDEX_MISSING', cardId: entry.name });
  }
  return records;
}

function resolveSiteField(value, cardId, field, report, { media, targetId = cardId, formIndex = null } = {}) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const resolvedMedia = media.resolve(raw, { cardId, targetId, formIndex, field });
  if (resolvedMedia !== raw) return resolvedMedia;
  return safeUrl(raw, folderUrl(targetId || cardId), field, report, cardId);
}

function replaceNestedMedia(value, media, cardId, field = 'payload', inContainers = false) {
  if (typeof value === 'string') {
    if (value.startsWith('data:')) return media.resolve(value, { cardId, targetId: cardId, field });
    return value.replace(DATA_URL_RE, full => media.resolve(full, { cardId, targetId: cardId, field }));
  }
  if (Array.isArray(value)) return value.map((child, index) => replaceNestedMedia(child, media, cardId, `${field}[${index}]`, inContainers));
  if (!value || typeof value !== 'object') return value;
  const result = {};
  for (const [key, child] of Object.entries(value)) {
    if (key === 'formsData') { result.formsData = []; continue; }
    if (inContainers && key === 'forms') { result.forms = ''; continue; }
    result[key] = replaceNestedMedia(child, media, cardId, `${field}.${key}`, key === 'containers');
  }
  return result;
}

function cardSourceChecksum(record) {
  return sha256(`${record.cardJsonChecksum}\n${record.indexChecksum || ''}`);
}

function importRunId(sourceChecksum) {
  return `import-${sourceChecksum.slice(0, 24)}`;
}

export async function buildContentImportBundle({ sourceRoot = DEFAULT_SOURCE_ROOT, categoryMap, siteOrigin = SITE_ORIGIN } = {}) {
  if (siteOrigin !== SITE_ORIGIN) throw new Error('This importer only accepts the configured custom-card site origin.');
  const absoluteSourceRoot = path.resolve(sourceRoot);
  if (!fs.existsSync(absoluteSourceRoot) || !fs.statSync(absoluteSourceRoot).isDirectory()) throw new Error(`Card source folder not found: ${absoluteSourceRoot}`);
  const repoRoot = path.dirname(absoluteSourceRoot);
  const report = {
    cardCount: 0,
    importableCount: 0,
    aliasCount: 0,
    aliasProvenanceCounts: {},
    builtinFormCount: 0,
    adminLinkedRows: 0,
    directEdgeCount: 0,
    asymmetricEdges: [],
    unresolvedReferences: [],
    unresolvedAliases: [],
    excludedFields: ['payload.formsData', 'payload.containers.forms'],
    blockers: [],
    warnings: [],
    media: { embeddedDataUrlFields: 0, mappedOutputDataUrlFields: 0, uniqueDataHashes: 0, mappings: [] },
    sourceFiles: []
  };
  const records = parseJsonFiles(absoluteSourceRoot, report);
  report.cardCount = records.length;
  const ids = new Set(records.map(record => record.id));
  const aliases = new Map();
  for (const record of records) {
    const base = `/Custom%20Cards/${encodeURIComponent(record.id)}`;
    addAlias(aliases, base, record.id, 'card-folder-directory', report);
    addAlias(aliases, `${base}/`, record.id, 'card-folder-directory', report);
    addAlias(aliases, `${base}/index.html`, record.id, 'card-folder-index', report);
    report.sourceFiles.push({
      cardId: record.id,
      repoPath: `Custom Cards/${record.id}`,
      cardJson: { path: record.sourcePath, sha256: record.cardJsonChecksum },
      indexHtml: record.indexChecksum ? { path: `Custom Cards/${record.id}/index.html`, sha256: record.indexChecksum } : null,
      backupFiles: ['card.json', ...(record.indexPath ? ['index.html'] : []), ...(fs.existsSync(path.join(absoluteSourceRoot, record.id, 'index.html.bak')) ? ['index.html.bak'] : [])]
    });
  }
  collectRootDirectoryAliases(repoRoot, records, aliases, report);
  inferHistoricFormAliases(records, aliases, ids, report);
  const assetFiles = listImageFiles(absoluteSourceRoot);
  const media = makeMediaResolver({ sourceRoot: absoluteSourceRoot, files: assetFiles, report });
  report.media.embeddedDataUrlFields = records.reduce((count, record) => count + auditEmbeddedMedia(record.raw, record.id, 'card.json', media), 0);
  const aliasMap = new Map(serializeAliases(aliases).map(item => [item.path, item]));
  const directEdges = new Map();
  const directions = new Map();
  const categoryFile = path.join(PROJECT_ROOT, 'json', 'card_categories.json');
  const categories = categoryMap instanceof Map ? categoryMap : categoryMapFromFile(categoryFile);
  const cards = [];
  for (const record of records) {
    const base = folderUrl(record.id);
    const inputForms = Array.isArray(record.raw.formsData) ? record.raw.formsData : [];
    const builtinForms = inputForms.flatMap((form, index) => {
      if (form?.adminLinkedSlug) {
        report.adminLinkedRows += 1;
        const slug = String(form.adminLinkedSlug);
        if (!ids.has(slug)) report.unresolvedReferences.push({ cardId: record.id, target: slug, source: 'adminLinkedSlug', formIndex: index });
        else {
          const [leftId, rightId] = canonicalLinkPair(record.id, slug);
          directEdges.set(`${leftId}\u0000${rightId}`, { leftId, rightId });
          if (!directions.has(`${leftId}\u0000${rightId}`)) directions.set(`${leftId}\u0000${rightId}`, new Set());
          directions.get(`${leftId}\u0000${rightId}`).add(`${record.id}\u0000${slug}`);
        }
        // The normalized edge table is authoritative for these Manager rows.
        // Preserve the source bytes in the backup, but do not mirror them in
        // the authored builtin navigation list.
        for (const field of ['imageSrc', 'thumbSrc']) {
          const value = String(form?.[field] || '');
          if (value.startsWith('data:')) media.resolve(value, { cardId: record.id, targetId: form.adminLinkedSlug || record.id, formIndex: index, field: `formsData[${index}].${field}` });
        }
        return [];
      }
      const targetId = resolveFormTarget(form, aliasMap, ids, record.id);
      const link = safeUrl(form?.link, base, `formsData[${index}].link`, report, record.id);
      const imageSrc = resolveSiteField(form?.imageSrc, record.id, `formsData[${index}].imageSrc`, report, { media, targetId: targetId || record.id, formIndex: index });
      const thumbSrc = resolveSiteField(form?.thumbSrc, record.id, `formsData[${index}].thumbSrc`, report, { media, targetId: targetId || record.id, formIndex: index });
      const imageExportName = String(form?.imageExportName || '').trim();
      const normalized = { name: String(form?.name || '').replace(/\s+/g, ' ').trim(), link, imageSrc, thumbSrc, imageExportName };
      if (targetId) normalized.targetId = targetId;
      return [normalized];
    });
    report.builtinFormCount += builtinForms.length;

    for (const form of inputForms) {
      if (!form?.link) continue;
      const pathname = pathFromUrl(form.link, base);
      if (!pathname) continue;
      const targetId = resolveFormTarget(form, aliasMap, ids, record.id);
      if (targetId && !aliasMap.has(pathname) && pathname.startsWith('/')) {
        addAlias(aliases, pathname, targetId, 'stored-form-link', report);
        aliasMap.set(pathname, aliases.get(pathname));
      } else if (!targetId) {
        report.unresolvedReferences.push({ cardId: record.id, target: pathname, source: 'authored-form-link', formName: String(form.name || '').slice(0, 120) });
      }
    }

    const sourcePayload = { ...record.raw, formsData: [], containers: { ...(record.raw.containers || {}), forms: '' } };
    const payloadWithMedia = replaceNestedMedia(sourcePayload, media, record.id);
    const name = String(record.raw.inputs?.nameInput || record.title.replace(/^\[[^\]]*\]\s*/, '') || record.id).replace(/\s+/g, ' ').trim();
    const title = record.title || name;
    const categoryNames = parseCategoryNames(record.raw.containers?.categories, categories);
    const mediaUrl = (value, field) => {
      const raw = String(value || '').trim();
      if (!raw) return '';
      return resolveSiteField(raw, record.id, field, report, { media });
    };
    const candidate = {
      status: 'published',
      name,
      title,
      type: String(record.raw.currentType || 'unknown'),
      rarity: String(record.raw.currentRarity || 'unknown'),
      cardClass: String(record.raw.currentClass || ''),
      releaseDate: String(record.raw.inputs?.dateInput || '').trim(),
      categoryNames,
      cardArtImageUrl: mediaUrl(record.raw.cardArtImage, 'cardArtImage'),
      cardArtVideoUrl: mediaUrl(record.raw.cardArtVideo, 'cardArtVideo'),
      unitTag: String(record.raw.absUnitTag || ''),
      awakeningMode: String(record.raw.currentAwakeningMode || ''),
      thumb: mediaUrl(record.raw.thumbMain, 'thumbMain'),
      repoPath: `Custom Cards/${record.id}`,
      assetBase: base,
      payload: payloadWithMedia,
      builtinForms
    };
    try {
      const normalized = normalizeCardInput(record.id, candidate);
      normalized.sourceChecksum = cardSourceChecksum(record);
      normalized.sourcePath = record.sourcePath;
      cards.push(normalized);
    } catch (error) {
      report.blockers.push({ code: error.code || 'CARD_NORMALIZATION_FAILED', cardId: record.id, message: String(error.message || 'Card could not be normalized').slice(0, 180) });
    }
  }
  const edges = [...directEdges.values()].sort((a, b) => a.leftId.localeCompare(b.leftId) || a.rightId.localeCompare(b.rightId));
  for (const edge of edges) {
    const directionsForPair = directions.get(`${edge.leftId}\u0000${edge.rightId}`) || new Set();
    const forward = directionsForPair.has(`${edge.leftId}\u0000${edge.rightId}`);
    const reverse = directionsForPair.has(`${edge.rightId}\u0000${edge.leftId}`);
    if (!forward || !reverse) report.asymmetricEdges.push({ ...edge, fromLeft: forward, fromRight: reverse });
  }
  report.importableCount = cards.length;
  const normalizedAliases = serializeAliases(aliases);
  report.aliasCount = normalizedAliases.length;
  for (const alias of normalizedAliases) report.aliasProvenanceCounts[alias.provenance] = (report.aliasProvenanceCounts[alias.provenance] || 0) + 1;
  report.directEdgeCount = edges.length;
  report.media.uniqueDataHashes = media.uniqueDataUriCount;
  report.media.mappings.sort((a, b) => `${a.cardId}:${a.field}:${a.sha256}`.localeCompare(`${b.cardId}:${b.field}:${b.sha256}`));
  report.sourceFiles.sort((a, b) => a.cardId.localeCompare(b.cardId));
  report.unresolvedReferences = [...new Map(report.unresolvedReferences.map(item => [JSON.stringify(item), item])).values()];
  const sourceChecksum = sha256(records.map(record => `${record.id}:${cardSourceChecksum(record)}`).sort().join('\n'));
  const bundle = {
    schemaVersion: 1,
    kind: 'dokkan-custom-card-content-import',
    runId: importRunId(sourceChecksum),
    sourceRoot: absoluteSourceRoot,
    sourceChecksum,
    generatedAt: new Date().toISOString(),
    status: report.blockers.length ? 'blocked' : 'ready',
    cards,
    aliases: normalizedAliases,
    edges,
    sourceBackups: report.sourceFiles,
    report
  };
  return bundle;
}

export function copySourceBackups(bundle, sourceRoot, backupDirectory) {
  const target = path.resolve(backupDirectory);
  if (fs.existsSync(target)) throw new Error(`Backup destination already exists: ${target}`);
  fs.mkdirSync(target, { recursive: true });
  const root = path.resolve(sourceRoot);
  for (const record of bundle.sourceBackups || []) {
    const files = record.backupFiles || [];
    for (const fileName of files) {
      const source = path.resolve(root, record.cardId, fileName);
      const relative = path.relative(root, source);
      if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Backup path escaped the card source folder.');
      const destination = path.join(target, 'Custom Cards', record.cardId, fileName);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(source, destination, fs.constants.COPYFILE_EXCL);
    }
  }
  fs.writeFileSync(path.join(target, 'source-manifest.json'), JSON.stringify({ schemaVersion: 1, sourceChecksum: bundle.sourceChecksum, records: bundle.sourceBackups }, null, 2), { flag: 'wx' });
  return target;
}
