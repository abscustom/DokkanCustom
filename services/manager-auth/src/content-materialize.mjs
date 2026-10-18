import fs from 'node:fs';
import path from 'node:path';
import { assertCardId, validateAliasPath } from './content-domain.mjs';

const STATUSES = new Set(['published', 'draft', 'archived']);
const BOOTSTRAPPER = '/DokkanCustom/js/custom-card-bootstrapper.js?v=20261017-database-viewer-v1';

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function htmlEscape(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function validateSnapshot(snapshot) {
  if (!snapshot || snapshot.schemaVersion !== 1 || snapshot.kind !== 'dokkan-custom-card-content' ||
      !Array.isArray(snapshot.cards) || !Array.isArray(snapshot.aliases) || !Array.isArray(snapshot.edges)) {
    throw new Error('The recovery snapshot is incomplete or unsupported.');
  }
  const cards = new Map();
  for (const source of snapshot.cards) {
    const id = assertCardId(source?.id);
    if (source.slug !== id || !STATUSES.has(source.status) || cards.has(id)) {
      throw new Error(`The recovery snapshot contains an invalid card record: ${id}.`);
    }
    let assetBase;
    try { assetBase = new URL(source.assetBase); } catch { assetBase = null; }
    if (!assetBase || assetBase.protocol !== 'https:' || assetBase.hostname !== 'abscustom.github.io' ||
        assetBase.username || assetBase.password || !assetBase.pathname.endsWith('/') || assetBase.search || assetBase.hash) {
      throw new Error(`The recovery snapshot has an invalid asset base for ${id}.`);
    }
    cards.set(id, { ...source, id, payload: asObject(source.payload), builtinForms: Array.isArray(source.builtinForms) ? source.builtinForms : [] });
  }
  const edges = [];
  const edgeKeys = new Set();
  for (const edge of snapshot.edges) {
    const leftId = assertCardId(edge?.leftId);
    const rightId = assertCardId(edge?.rightId);
    if (leftId >= rightId || !cards.has(leftId) || !cards.has(rightId)) {
      throw new Error('The recovery snapshot contains an invalid direct card link.');
    }
    const key = `${leftId}\u0000${rightId}`;
    if (edgeKeys.has(key)) throw new Error('The recovery snapshot contains a duplicate direct card link.');
    edgeKeys.add(key);
    edges.push({ leftId, rightId });
  }
  const aliases = [];
  for (const alias of snapshot.aliases) {
    const aliasPath = validateAliasPath(alias?.path);
    const cardId = assertCardId(alias?.cardId);
    if (!cards.has(cardId)) throw new Error(`The recovery snapshot alias references a missing card: ${cardId}.`);
    aliases.push({ path: aliasPath, cardId });
  }
  return { cards, edges, aliases };
}

function linkedForm(target, matchingForm = {}) {
  const imageSrc = matchingForm.imageSrc || target.cardArtImageUrl || target.thumb || '';
  const thumbSrc = target.thumb || matchingForm.thumbSrc || imageSrc;
  return {
    imageSrc,
    imageExportName: String(matchingForm.imageExportName || ''),
    thumbSrc,
    name: String(matchingForm.name || target.name || target.title || target.id),
    link: target.assetBase,
    targetId: target.id,
    adminLinkedSlug: target.id,
    source: 'linked'
  };
}

function formsFor(card, cards, linkedIds) {
  const forms = [];
  const visibleAuthoredForms = [];
  const seenTargets = new Set();
  for (const value of card.builtinForms) {
    const form = { ...asObject(value) };
    const managedId = form.adminLinkedSlug ? assertCardId(form.adminLinkedSlug) : '';
    const targetId = form.targetId ? assertCardId(form.targetId) : '';
    if (managedId) {
      if (!linkedIds.has(managedId) || cards.get(managedId)?.status !== 'published' || seenTargets.has(managedId)) continue;
      const target = cards.get(managedId);
      forms.push(linkedForm(target, form));
      seenTargets.add(managedId);
      continue;
    }
    if (targetId) {
      const target = cards.get(targetId);
      if (!target || target.status !== 'published') continue;
      visibleAuthoredForms.push(form);
      if (seenTargets.has(targetId)) continue;
      if (linkedIds.has(targetId)) forms.push(linkedForm(target, form));
      else forms.push(form);
      seenTargets.add(targetId);
      continue;
    }
    visibleAuthoredForms.push(form);
    forms.push(form);
  }
  for (const targetId of [...linkedIds].sort()) {
    const target = cards.get(targetId);
    if (!target || target.status !== 'published' || seenTargets.has(targetId)) continue;
    forms.push(linkedForm(target));
    seenTargets.add(targetId);
  }
  return { forms, visibleAuthoredForms };
}

function cardJson(card, cards, linkedIds) {
  const result = JSON.parse(JSON.stringify(card.payload));
  result.inputs = { ...asObject(result.inputs), nameInput: card.name };
  if (Number(card.revision) > 1) result.inputs.descInput = card.title;
  result.currentType = card.type;
  result.currentClass = card.cardClass || '';
  result.currentRarity = card.rarity;
  result.currentAwakeningMode = card.awakeningMode || '';
  result.absUnitTag = card.unitTag || '';
  result.cardArtImage = card.cardArtImageUrl || '';
  result.cardArtVideo = card.cardArtVideoUrl || '';
  result.thumbMain = card.thumb || '';
  const normalizedForms = formsFor(card, cards, linkedIds);
  result.formsData = normalizedForms.forms;
  result.builtinForms = normalizedForms.visibleAuthoredForms;
  result.containers = { ...asObject(result.containers), forms: '' };
  return result;
}

function tombstoneJson(card) {
  return {
    schemaVersion: 1,
    id: card.id,
    slug: card.id,
    status: card.status,
    unavailable: true
  };
}

function indexPage(card) {
  if (card.status !== 'published') {
    return `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="abs-card-state" content="${card.status}"><title>Card unavailable</title></head><body><main><h1>Card unavailable</h1><p>This card is not available.</p></main></body></html>\n`;
  }
  const title = htmlEscape(card.title || card.name || card.id);
  return `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light dark"><title>${title}</title><link rel="icon" type="image/png" href="https://abscustom.github.io/assets/images/abs.style.png"></head><body class="is-published card-viewer-page"><div id="abs-loading-screen" class="abs-loader-root" data-loader-ready-event="abs-card-content-ready" data-loader-ready-flag="absCardContentReady" role="status" aria-label="Loading card"><div class="abs-loader-stage"><img class="abs-loader-logo" src="https://abscustom.github.io/assets/images/abs.style.png" alt=""><div class="abs-loader-status">Loading card…</div></div></div><script>window.addEventListener('abs-card-bootstrap-error',event=>{const loader=document.getElementById('abs-loading-screen');if(!loader)return;loader.dataset.loaderError='true';const status=loader.querySelector('.abs-loader-status');if(status)status.textContent=event.detail?.message||'This card is temporarily unavailable. Retry in a moment.';});</script><script src="${BOOTSTRAPPER}"></script></body></html>\n`;
}

function aliasIndexPath(aliasPath) {
  const decoded = decodeURIComponent(validateAliasPath(aliasPath));
  if (/[?#\u0000-\u001f]/.test(decoded)) throw new Error(`The snapshot alias cannot be materialized safely: ${aliasPath}.`);
  let segments = decoded === '/' ? [] : decoded.slice(1).split('/');
  if (segments.at(-1) === '') segments = segments.slice(0, -1);
  if (segments.at(-1) === 'index.html') segments = segments.slice(0, -1);
  else if (segments.at(-1)?.toLowerCase().endsWith('.html')) {
    throw new Error(`Only directory and index.html aliases can be materialized: ${aliasPath}.`);
  }
  const reserved = /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i;
  for (const segment of segments) {
    if (!segment || segment === '.' || segment === '..' || /[<>:"/\\|?*\u0000-\u001f]/.test(segment) || /[. ]$/.test(segment) || reserved.test(segment)) {
      throw new Error(`The snapshot alias cannot be materialized safely: ${aliasPath}.`);
    }
  }
  return segments.length ? path.join(...segments, 'index.html') : 'index.html';
}

export function materializeContentSnapshot(snapshot, outputDirectory) {
  const { cards, edges, aliases } = validateSnapshot(snapshot);
  const destination = path.resolve(outputDirectory);
  const root = path.parse(destination).root;
  if (!root || /^\\\\/.test(root)) throw new Error('Materialization requires a local drive path.');
  if (fs.existsSync(destination)) throw new Error(`Materialization destination already exists: ${destination}`);
  const parent = path.dirname(destination);
  if (!fs.existsSync(parent) || !fs.statSync(parent).isDirectory()) throw new Error(`Materialization parent directory not found: ${parent}`);

  const linkedByCard = new Map([...cards.keys()].map(id => [id, new Set()]));
  for (const edge of edges) {
    linkedByCard.get(edge.leftId).add(edge.rightId);
    linkedByCard.get(edge.rightId).add(edge.leftId);
  }
  const files = new Map();
  const addFile = (relativePath, content) => {
    const normalized = path.normalize(relativePath);
    if (path.isAbsolute(normalized) || normalized === '..' || normalized.startsWith(`..${path.sep}`)) {
      throw new Error('A materialized path escaped its output directory.');
    }
    const key = process.platform === 'win32' ? normalized.toLocaleLowerCase('en-US') : normalized;
    const previous = files.get(key);
    if (previous && (previous.path !== normalized || previous.content !== content)) {
      throw new Error(`Two card aliases map to the same output path: ${normalized}`);
    }
    files.set(key, { path: normalized, content });
  };

  for (const card of cards.values()) {
    const cardDirectory = path.join('Custom Cards', card.id);
    addFile(path.join(cardDirectory, 'index.html'), indexPage(card));
    if (card.status === 'published') {
      const content = cardJson(card, cards, linkedByCard.get(card.id));
      addFile(path.join(cardDirectory, 'card.json'), `${JSON.stringify(content, null, 2)}\n`);
    } else {
      addFile(path.join(cardDirectory, 'card.json'), `${JSON.stringify(tombstoneJson(card), null, 2)}\n`);
    }
  }
  for (const alias of aliases) {
    const card = cards.get(alias.cardId);
    addFile(aliasIndexPath(alias.path), indexPage(card));
  }

  const publishedIds = [...cards.values()].filter(card => card.status === 'published').map(card => card.id).sort();
  const unavailableIds = [...cards.values()].filter(card => card.status !== 'published').map(card => card.id).sort();
  const manifest = {
    schemaVersion: 1,
    kind: 'dokkan-custom-card-materialization',
    snapshotExportedAt: snapshot.exportedAt || null,
    generatedAt: new Date().toISOString(),
    publishedIds,
    unavailableIds,
    aliasCount: aliases.length,
    directEdgeCount: edges.filter(edge => cards.get(edge.leftId).status === 'published' && cards.get(edge.rightId).status === 'published').length
  };
  addFile('content-materialization-manifest.json', `${JSON.stringify(manifest, null, 2)}\n`);

  fs.mkdirSync(destination);
  let writtenFiles = 0;
  try {
    for (const file of files.values()) {
      const absolute = path.resolve(destination, file.path);
      const relative = path.relative(destination, absolute);
      if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('A materialized path escaped its output directory.');
      fs.mkdirSync(path.dirname(absolute), { recursive: true });
      fs.writeFileSync(absolute, file.content, { flag: 'wx' });
      writtenFiles += 1;
    }
  } catch (error) {
    throw new Error(`Materialization stopped after ${writtenFiles}/${files.size} files in ${destination}: ${error.message}`);
  }
  return {
    materialized: true,
    outputDirectory: destination,
    publishedCards: [...cards.values()].filter(card => card.status === 'published').length,
    unavailableCards: [...cards.values()].filter(card => card.status !== 'published').length,
    directEdges: edges.filter(edge => cards.get(edge.leftId).status === 'published' && cards.get(edge.rightId).status === 'published').length,
    aliasCount: aliases.length,
    files: writtenFiles,
    manifest: path.join(destination, 'content-materialization-manifest.json')
  };
}
