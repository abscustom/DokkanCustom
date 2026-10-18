import { DOMParser, createDOMContext } from './html-dom.mjs';
import { parse } from 'acorn';
import { Buffer } from 'node:buffer';
import '../../../js/manager-card-transforms.js';
import { Failure, now } from './security.mjs';
import { REPOSITORY } from './auth.mjs';
import { assetMask } from './embedded-assets.mjs';
const transforms = globalThis.createManagerCardTransforms({ DOMParser });
const root = `/repos/${REPOSITORY}`;
const ignored = new Set(['.github','.vscode','assets','css','json','js','js-calc','js-card-details','js-editor','js-graphics','tools','images','DokkanCustom','CardEditor','Custom Cards','js2','js3']);
const capacity = () => new Failure(413, 'BATCH_LIMIT', 'These cards exceed the free Manager processing limit. No card changes were saved.');
export const validSlug = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,159}$/.test(value);

function fileMap(tree) {
  if (tree.truncated || !Array.isArray(tree.tree)) throw new Failure(503, 'TREE_INCOMPLETE', 'GitHub returned an incomplete repository listing. No changes were saved.');
  return new Map(tree.tree.filter(f => f.type === 'blob').map(f => [f.path, f]));
}
export async function snapshot(api, env, allowBuild = false) {
  const ref = await api(`${root}/git/ref/heads/main`);
  const commit = await api(`${root}/git/commits/${ref.object.sha}`);
  const tree = await api(`${root}/git/trees/${commit.tree.sha}?recursive=1`);
  const files = fileMap(tree), folders = [];
  for (const [path,entry] of files) {
    if (entry.mode !== '100644') continue;
    const pieces = path.split('/');
    if (pieces.at(-1) !== 'index.html') continue;
    if (pieces.length === 3 && pieces[0] === 'Custom Cards' && validSlug(pieces[1])) folders.push({ slug: pieces[1], repoPath: pieces.slice(0, 2).join('/') });
    else if (pieces.length === 2 && validSlug(pieces[0]) && !ignored.has(pieces[0])) folders.push({ slug: pieces[0], repoPath: pieces[0] });
  }
  if (new Set(folders.map(c => c.slug)).size !== folders.length) throw new Failure(409, 'DUPLICATE_FOLDER', 'Two published folders have the same card identifier. Resolve that ambiguity before editing.');
  if (folders.length > 100) throw capacity();
  const keys = folders.map(folder => `${files.get(`${folder.repoPath}/index.html`).sha}:${folder.repoPath}`);
  const cached = keys.length ? await env.DB.prepare(`SELECT cache_key,metadata FROM card_metadata WHERE cache_key IN (${keys.map(()=>'?').join(',')})`).bind(...keys).all() : {results:[]};
  const metadata = new Map(cached.results.map(row=>[row.cache_key,JSON.parse(row.metadata)]));
  const missing = folders.filter((_,index)=>!metadata.has(keys[index]));
  if (missing.length) {
    if (!allowBuild) throw new Failure(409,'CARDS_CHANGED','The published cards changed. Reload Manager before applying changes.');
    const folder=missing[0], file=files.get(`${folder.repoPath}/index.html`), key=`${file.sha}:${folder.repoPath}`;
    const html=await readBlob(api,file), mask=assetMask();
    const isCard=/\bid\s*=\s*["'](?:card-data|dokkan-project-data|char-name|abs-char-name)["']/i.test(html);
    let card={isCard:false};
    if (isCard) {
      const local=globalThis.createManagerCardTransforms({DOMParser:createDOMContext()});
      const masked=mask.mask(html), parsed=local.parseCard(folder.slug,masked,folder.repoPath);
      const identities=folders.filter(f=>f.slug!==folder.slug).map(f=>({slug:f.slug,url:`https://abscustom.github.io/${f.repoPath.split('/').map(encodeURIComponent).join('/')}/`,htmlText:'<html><head></head><body></body></html>'}));
      const linkedSlugs=local.getLinkedCards([parsed,...identities])[0].links;
      delete parsed.htmlText;
      card={...Object.fromEntries(Object.entries(parsed).map(([k,v])=>[k,typeof v==='string'?mask.restore(v):v])),linkedSlugs,isCard:true};
    }
    await env.DB.prepare('INSERT OR REPLACE INTO card_metadata(cache_key,metadata,created_at) VALUES(?,?,?)').bind(key,JSON.stringify(card),now()).run();
    metadata.set(key,card);
    if (missing.length>1) return {pending:true,processed:folders.length-missing.length+1,total:folders.length,retryAfterMs:25};
  }
  const cards=keys.map(key=>metadata.get(key)).filter(card=>card.isCard);
  cards.sort((a,b) => a.name.localeCompare(b.name));
  return { parent: ref.object.sha, baseTree: commit.tree.sha, files, cards };
}
async function readBlob(api, file) {
  if (file.size > 4194304) throw capacity();
  const data = await api(`${root}/git/blobs/${file.sha}`);
  if (data.encoding !== 'base64' || typeof data.content !== 'string' || data.content.length > 5700000) throw capacity();
  return Buffer.from(data.content.replace(/\s/g, ''),'base64').toString('utf8');
}
function safeImage(value) {
  if (typeof value === 'string' && value.length <= 2097152 && /^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(value)) return value;
  try { const url = new URL(value); return url.protocol === 'https:' && url.hostname === 'abscustom.github.io' && !url.port && !url.username && !url.password ? url.href : ''; } catch { return ''; }
}
export function publicCards(cards) {
  const slugs=new Set(cards.map(c=>c.slug));
  return cards.map(c => ({ slug:c.slug, name:String(c.name).slice(0,400), title:String(c.title).slice(0,400),
    portrait:safeImage(c.thumb), thumb:safeImage(c.thumb), type:/^(agl|teq|int|str|phy|none)$/.test(c.type) ? c.type : 'none',
    linkedSlugs:(c.linkedSlugs || []).filter(slug=>slugs.has(slug)), folderPath:c.repoPath, repoPath:c.repoPath }));
}
export function validateInlineScripts(html, Parser=DOMParser) {
  const doc = new Parser().parseFromString(html, 'text/html');
  for (const script of doc.querySelectorAll('script:not([src])')) {
    const type = (script.getAttribute('type') || '').trim().toLowerCase();
    if (type && type !== 'module' && !/^(text|application)\/(java|ecma)script$/.test(type)) continue;
    try { parse(script.textContent || '', { ecmaVersion:'latest', sourceType:type === 'module' ? 'module' : 'script' }); }
    catch { throw new Failure(422, 'CARD_SCRIPT_INVALID', 'A card contains invalid JavaScript. Repair its published bootstrap before saving links.'); }
  }
}
function exactKeys(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !keys.includes(k))) throw new Failure(400, 'INVALID_OPERATION', 'Choose a supported Manager operation.');
}
async function affectedFile(api, snap, card, cache, mask) {
  if (cache.has(card.slug)) return cache.get(card.slug);
  const jsonFile = snap.files.get(`${card.repoPath}/card.json`);
  const html=await readBlob(api,snap.files.get(`${card.repoPath}/index.html`));
  const file = { card:mask.card(card), originalCard:card, html:mask.mask(html), json:jsonFile ? mask.mask(await readBlob(api, jsonFile)) : null };
  // Refuse malformed JSON instead of silently omitting its reciprocal update.
  if (file.json !== null) { try { JSON.parse(file.json); } catch { throw new Failure(422, 'CARD_JSON_INVALID', 'A saved card JSON file is invalid. Repair it before changing links.'); } }
  cache.set(card.slug,file); return file;
}
export async function linkChanges(api, snap, payload) {
  const Parser=createDOMContext(), transforms=globalThis.createManagerCardTransforms({DOMParser:Parser});
  exactKeys(payload, ['operations']);
  if (!Array.isArray(payload.operations) || !payload.operations.length || payload.operations.length > 12) throw capacity();
  const cards = new Map(snap.cards.map(c => [c.slug,c])), cache = new Map(), groups = [], mask=assetMask();
  for (const op of payload.operations) {
    exactKeys(op, ['action','sourceSlug','targetSlug']);
    if (!['link','unlink','unlinkAll'].includes(op.action) || !cards.has(op.sourceSlug) ||
      (op.action !== 'unlinkAll' && (!cards.has(op.targetSlug) || op.sourceSlug === op.targetSlug)) ||
      (op.action === 'unlinkAll' && op.targetSlug !== undefined)) throw new Failure(400,'INVALID_OPERATION','Choose distinct, available cards.');
    const targets = op.action === 'unlinkAll' ? snap.cards.filter(c => c.slug !== op.sourceSlug &&
      (cards.get(op.sourceSlug).linkedSlugs.includes(c.slug) || c.linkedSlugs.includes(op.sourceSlug))).map(c=>c.slug) : [op.targetSlug];
    const action = op.action === 'link' ? 'link' : 'unlink';
    let group = groups.at(-1);
    if (!group || group.source !== op.sourceSlug || group.action !== action) groups.push(group = { source:op.sourceSlug,action,targets:[] });
    group.targets.push(...targets);
  }
  for (const group of groups) {
    const source = cards.get(group.source), targets = [...new Set(group.targets)].map(s=>cards.get(s));
    const a = await affectedFile(api,snap,source,cache,mask), link = group.action === 'link';
    for (const target of targets) {
      const b = await affectedFile(api,snap,target,cache,mask), fallback = targets.length === 1;
      a.html = transforms.updateLinkedHtml(a.html,a.card,b.card,link,fallback);
      b.html = transforms.updateLinkedHtml(b.html,b.card,a.card,link,fallback);
      if (a.json !== null) a.json = transforms.updateLinkedJson(a.json,a.html,b.card,link,a.card);
      if (b.json !== null) b.json = transforms.updateLinkedJson(b.json,b.html,a.card,link,b.card);
    }
  }
  return fromCache(cache,mask,snap.cards,transforms,Parser);
}
function fromCache(cache,mask,cards,transforms,Parser) {
  const changes = [];
  for (const file of cache.values()) {
    validateInlineScripts(file.html,Parser);
    const identities=cards.filter(c=>c.slug!==file.card.slug).map(c=>({...c,htmlText:'<html><head></head><body></body></html>'}));
    file.originalCard.linkedSlugs=transforms.getLinkedCards([{...file.card,htmlText:file.html},...identities])[0].links;
    changes.push({path:`${file.card.repoPath}/index.html`,text:mask.restore(file.html)});
    if (file.json !== null) changes.push({path:`${file.card.repoPath}/card.json`,text:mask.restore(file.json)});
  }
  if (changes.reduce((sum,c)=>sum+c.text.length,0)>16777216) throw capacity();
  return changes;
}
export async function deleteChanges(api,snap,payload) {
  const Parser=createDOMContext(), transforms=globalThis.createManagerCardTransforms({DOMParser:Parser});
  exactKeys(payload,['slug','confirmSlug']);
  const target = snap.cards.find(c=>c.slug === payload.slug);
  if (!target || payload.confirmSlug !== target.slug) throw new Failure(400,'CONFIRMATION_REQUIRED','Type the exact card folder name to confirm deletion.');
  const cache = new Map(), mask=assetMask();
  for (const other of snap.cards) {
    if (other.slug === target.slug || !other.linkedSlugs.includes(target.slug)) continue;
    const file = await affectedFile(api,snap,other,cache,mask), maskedTarget=mask.card(target);
    file.html = transforms.updateLinkedHtml(file.html,file.card,maskedTarget,false);
    if (file.json !== null) file.json = transforms.updateLinkedJson(file.json,file.html,maskedTarget,false,file.card);
  }
  return { changes:fromCache(cache,mask,snap.cards,transforms,Parser), deletePrefix:target.repoPath };
}
export async function commit(api,snap,changes,deletePrefix='',env) {
  const allowed = new Set(snap.cards.flatMap(c=>[`${c.repoPath}/index.html`,`${c.repoPath}/card.json`]));
  for (const change of changes) if (!allowed.has(change.path)) throw new Error('Unexpected write path');
  if (deletePrefix && !snap.cards.some(c=>c.repoPath === deletePrefix)) throw new Error('Unexpected deletion path');
  const tree = [];
  // Reserve the complete branch-write sequence before creating any Git objects.
  api.reserve(changes.length + 3);
  for (const change of changes) {
    const blob = await api(`${root}/git/blobs`, {method:'POST',body:JSON.stringify({content:change.text,encoding:'utf-8'})});
    tree.push({path:change.path,mode:'100644',type:'blob',sha:blob.sha});
    if (change.path.endsWith('/index.html')) {
      const card=snap.cards.find(c=>`${c.repoPath}/index.html`===change.path);
      await env.DB.prepare('INSERT OR REPLACE INTO card_metadata(cache_key,metadata,created_at) VALUES(?,?,?)').bind(`${blob.sha}:${card.repoPath}`,JSON.stringify(card),now()).run();
    }
  }
  if (deletePrefix) for (const [path,file] of snap.files) if (path.startsWith(`${deletePrefix}/`)) tree.push({path,mode:file.mode,type:'blob',sha:null});
  if (!tree.length) return null;
  const created = await api(`${root}/git/trees`,{method:'POST',body:JSON.stringify({base_tree:snap.baseTree,tree})});
  const saved = await api(`${root}/git/commits`,{method:'POST',body:JSON.stringify({message:deletePrefix ? `Delete custom card: ${deletePrefix.split('/').at(-1)}` : 'Update custom form links',tree:created.sha,parents:[snap.parent]})});
  await api(`${root}/git/refs/heads/main`,{method:'PATCH',body:JSON.stringify({sha:saved.sha,force:false})});
  if (deletePrefix) snap.cards = snap.cards.filter(c=>c.repoPath !== deletePrefix);
  return saved.sha;
}
