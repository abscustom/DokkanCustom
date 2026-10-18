import test from 'node:test';
import assert from 'node:assert/strict';
import { contentFixture } from './content-fixture.mjs';
import { buildContentImportBundle, DEFAULT_SOURCE_ROOT } from '../src/content-import.mjs';
import { normalizeCardInput, sanitizeHtmlFragment, validateAliasPath } from '../src/content-domain.mjs';
import { applyImportBundle, applyLinkOperations, decodeCursor, exportContentSnapshot, publicCardDetail, restoreContentSnapshot, saveCard } from '../src/content-store.mjs';

const SITE = 'https://abscustom.github.io';

function publicRequest(f, path, options = {}) {
  return f.request(path, { ...options, originHeader: SITE });
}

function adminRequest(f, active, path, { method = 'GET', payload, headers = {} } = {}) {
  return f.request(path, {
    method,
    cookie: active.cookie,
    csrf: active.csrfToken,
    originHeader: method === 'GET' ? '' : f.env.MANAGER_ORIGIN,
    site: 'same-origin',
    payload,
    headers: {
      ...(method === 'GET' ? {} : { 'Content-Type': 'application/json', 'X-CSRF-Token': active.csrfToken }),
      ...headers
    }
  });
}

function cardForWrite(card) {
  return {
    name: card.name,
    title: card.title,
    type: card.type,
    rarity: card.rarity,
    cardClass: card.cardClass,
    releaseDate: card.releaseDate,
    categoryNames: card.categoryNames,
    cardArtImageUrl: card.cardArtImageUrl,
    cardArtVideoUrl: card.cardArtVideoUrl,
    unitTag: card.unitTag,
    awakeningMode: card.awakeningMode,
    thumb: card.thumb,
    repoPath: card.repoPath,
    assetBase: card.assetBase,
    payload: card.payload,
    builtinForms: card.builtinForms,
    status: card.status
  };
}

test('sanitizer keeps passive editor controls and state while removing executable behavior', () => {
  const html = sanitizeHtmlFragment('<section><input id="header" type="text" value="Basic" checked oninput="steal()" formaction="https://evil.test"><textarea id="body" rows="4" oninput="steal()">Effects</textarea><select id="mode" onchange="steal()"><option value="one" selected>One</option></select><button onclick="steal()" type="submit">Save</button><script>steal()</script></section>');
  assert.match(html, /<input\b[^>]*id="header"/);
  assert.match(html, /value="Basic"/);
  assert.match(html, /checked/);
  assert.match(html, /<textarea\b[^>]*id="body"[^>]*>Effects<\/textarea>/);
  assert.match(html, /<option\b[^>]*selected/);
  assert.match(html, /<button\b[^>]*type="button"/);
  assert.doesNotMatch(html, /oninput|onchange|onclick|formaction|<script/i);
  assert.equal(sanitizeHtmlFragment(html), html);
});

test('card IDs and repository paths match viewer stable IDs while historic dotted aliases remain valid', () => {
  assert.throws(() => normalizeCardInput('card.with.dot', {}), error => error.code === 'CARD_ID_INVALID');
  assert.throws(() => normalizeCardInput('valid-card', {
    assetBase: 'https://abscustom.github.io/Custom%20Cards/valid-card/',
    repoPath: 'Custom Cards/card.with.dot', payload: {}
  }), error => error.code === 'CARD_REPO_PATH_INVALID');
  assert.equal(validateAliasPath('/historic/cards/card.with.dot'), '/historic/cards/card.with.dot');
});

test('passiveSidebar converts only exact known editor handlers into safe action descriptors', () => {
  const id = 'safe-controls';
  const passiveSidebar = '<div id="side-sec-4"><b onclick="toggleSectionCollapse(4, document.getElementById(\'side-toggle-btn-4\'))">SECTION 4</b><button id="side-toggle-btn-4" onclick="toggleSectionCollapse(4, this)">−</button><button onclick="moveSection(4, -1)">↑</button><button onclick="confirmDeleteSection(this, 4)">×</button><input id="input-sec-hdr-4" value="Header" oninput="updateHeader(4, this.value)"><textarea id="input-sec-4" oninput="updateSection(4, this.value)">Effects</textarea><button onclick="insertShortcut(\'input-sec-4\', \':up:\')">↑</button><button id="evil" onclick="fetch(\'https://evil.test\')">x</button></div>';
  const candidate = normalizeCardInput(id, {
    status: 'published', name: 'Safe controls', title: 'Safe controls', type: 'agl', rarity: 'LR',
    repoPath: `Custom Cards/${id}`, assetBase: `https://abscustom.github.io/Custom%20Cards/${id}/`,
    payload: { containers: { passiveSidebar } }, builtinForms: []
  });
  const html = candidate.payload.containers.passiveSidebar;
  assert.match(html, /data-card-content-action="toggle-section"/);
  assert.match(html, /data-card-content-action="move-section"/);
  assert.match(html, /data-card-content-id="4"/);
  assert.match(html, /data-card-content-direction="-1"/);
  assert.match(html, /data-card-content-action="delete-section"/);
  assert.match(html, /data-card-content-action="update-header"/);
  assert.match(html, /data-card-content-action="update-section"/);
  assert.match(html, /data-card-content-action="insert-shortcut"/);
  assert.match(html, /data-card-content-target="input-sec-4"/);
  assert.match(html, /data-card-content-token=":up:"/);
  assert.doesNotMatch(html, /onclick\s*=|oninput\s*=|data-card-content-action="evil"|fetch\(/i);
  assert.equal(sanitizeHtmlFragment(html, { allowPassiveEditorActions: true }), html);
});

test('real import is idempotent and preserves sanitized passive markup through authenticated save and reload', async () => {
  const f = contentFixture();
  const realFetch = globalThis.fetch;
  globalThis.fetch = f.provider;
  try {
  const bundle = await buildContentImportBundle({ sourceRoot: DEFAULT_SOURCE_ROOT });
  assert.equal(bundle.status, 'ready', JSON.stringify(bundle.report.blockers));
  assert.equal(bundle.report.cardCount, 14);
  assert.equal(bundle.report.importableCount, 14);
  assert.equal(bundle.report.aliasCount, 64);
  assert.equal(bundle.report.directEdgeCount, 4);
  assert.equal(bundle.report.builtinFormCount, 11);
  assert.deepEqual(bundle.report.asymmetricEdges, []);
  assert.ok(bundle.report.adminLinkedRows > 0);
  assert.equal(bundle.report.media.embeddedDataUrlFields, 22);
  assert.equal(bundle.report.media.uniqueDataHashes, 6);
  assert.deepEqual(bundle.report.blockers, []);
  assert.deepEqual(bundle.report.unresolvedReferences, []);
  assert.deepEqual(bundle.report.unresolvedAliases, []);
  assert.ok(bundle.report.media.mappedOutputDataUrlFields >= bundle.report.media.embeddedDataUrlFields);
  assert.ok(bundle.aliases.some(alias => alias.path === '/mui-giant' && alias.provenance === 'historic-form-link-inference'));
  assert.equal(bundle.aliases.some(alias => ['/Custom%20Cards', '/Custom%20Cards/', '/Custom%20Cards/index.html'].includes(alias.path)), false);
  assert.ok(bundle.cards.every(card => card.builtinForms.every(form => !Object.hasOwn(form, 'adminLinkedSlug'))));

  const initial = await applyImportBundle(f.env.CONTENT_DB, bundle);
  assert.equal(initial.status, 'applied');
  assert.equal(initial.cardResults.filter(item => item.result === 'inserted').length, 14);
  const repeated = await applyImportBundle(f.env.CONTENT_DB, bundle);
  assert.equal(repeated.status, 'applied');
  assert.equal(repeated.cardResults.filter(item => item.result === 'unchanged').length, 14);
  assert.equal((await f.env.CONTENT_DB.prepare('SELECT COUNT(*) AS count FROM cards').first()).count, 14);

  const imported = bundle.cards.find(card => /<input\b|<textarea\b/.test(card.payload?.containers?.passiveSidebar || ''));
  assert.ok(imported, 'expected a real imported card with passive editor controls');
  const databaseDetail = await publicCardDetail(f.env.CONTENT_DB, imported.id);
  assert.ok(databaseDetail?.card.payload.containers.passiveSidebar.includes('<input'));
  assert.ok(databaseDetail.card.payload.containers.passiveSidebar.includes('<textarea'));
  assert.match(databaseDetail.card.payload.containers.passiveSidebar, /data-card-content-action="update-section"/);

  const active = await f.login();
  const firstPayload = structuredClone(databaseDetail.card.payload);
  firstPayload.containers.passiveSidebar = firstPayload.containers.passiveSidebar.replace('Basic effect(s)', 'Saved from database');
  const firstSave = await adminRequest(f, active, `/api/content/cards/${encodeURIComponent(imported.id)}`, {
    method: 'PUT', payload: { expectedRevision: databaseDetail.card.revision, card: { ...cardForWrite(databaseDetail.card), payload: firstPayload } }
  });
  assert.equal(firstSave.status, 200, await firstSave.clone().text());
  const reloaded = (await firstSave.json()).card;
  assert.equal(reloaded.revision, databaseDetail.card.revision + 1);
  assert.match(reloaded.payload.containers.passiveSidebar, /<input\b[^>]*\bid="input-sec-hdr-/);
  assert.match(reloaded.payload.containers.passiveSidebar, /value="Saved from database"/);
  assert.doesNotMatch(reloaded.payload.containers.passiveSidebar, /oninput\s*=|onclick\s*=/i);

  const secondPayload = structuredClone(reloaded.payload);
  secondPayload.containers.passiveSidebar = secondPayload.containers.passiveSidebar.replace('Saved from database', 'Edited after reload');
  const secondSave = await adminRequest(f, active, `/api/content/cards/${encodeURIComponent(imported.id)}`, {
    method: 'PUT', payload: { expectedRevision: reloaded.revision, card: { ...cardForWrite(reloaded), payload: secondPayload } }
  });
  assert.equal(secondSave.status, 200, await secondSave.clone().text());
  assert.match((await secondSave.json()).card.payload.containers.passiveSidebar, /value="Edited after reload"/);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('public catalog uses opaque cursors and exact aliases hide unpublished cards', async () => {
  const f = contentFixture();
  const bundle = await buildContentImportBundle({ sourceRoot: DEFAULT_SOURCE_ROOT });
  await applyImportBundle(f.env.CONTENT_DB, bundle);
  const first = await publicRequest(f, '/api/public/cards?limit=2');
  assert.equal(first.status, 200);
  const page = await first.json();
  assert.equal(page.cards.length, 2);
  assert.ok(page.nextCursor);
  assert.notEqual(page.nextCursor, page.cards.at(-1).id);
  assert.equal(decodeCursor(page.nextCursor), page.cards.at(-1).id);
  const next = await publicRequest(f, `/api/public/cards?limit=2&cursor=${encodeURIComponent(page.nextCursor)}`);
  assert.equal(next.status, 200);
  assert.equal((await next.json()).cards.length, 2);
  const legacy = await publicRequest(f, '/api/public/cards/resolve?path=%2Fmui-giant');
  assert.equal(legacy.status, 200);
  assert.equal((await legacy.json()).id, bundle.aliases.find(alias => alias.path === '/mui-giant').cardId);

  const id = bundle.cards[0].id;
  const detail = await publicCardDetail(f.env.CONTENT_DB, id);
  await f.env.CONTENT_DB.prepare("UPDATE cards SET status='draft' WHERE id=?").bind(id).run();
  const unpublished = await publicRequest(f, `/api/public/cards/${encodeURIComponent(id)}`);
  assert.equal(unpublished.status, 404);
  const adminAlias = await f.env.CONTENT_DB.prepare('SELECT path FROM card_aliases WHERE card_id=? ORDER BY path LIMIT 1').bind(id).first();
  const hiddenAlias = await publicRequest(f, `/api/public/cards/resolve?path=${encodeURIComponent(adminAlias.path)}`);
  assert.equal(hiddenAlias.status, 404);
});

test('authenticated content routes apply reciprocal links, reject stale revisions, and restore snapshots', async () => {
  const f = contentFixture();
  const realFetch = globalThis.fetch;
  globalThis.fetch = f.provider;
  try {
    const bundle = await buildContentImportBundle({ sourceRoot: DEFAULT_SOURCE_ROOT });
    await applyImportBundle(f.env.CONTENT_DB, bundle);
    const active = await f.login();

    const unauthenticated = await f.request('/api/content/cards');
    assert.equal(unauthenticated.status, 401);

    const tooManyLinks = await adminRequest(f, active, '/api/content/links/apply', {
      method: 'POST',
      payload: {
        operations: Array.from({ length: 13 }, () => ({ action: 'link', sourceSlug: 'limit-left', targetSlug: 'limit-right' })),
        expectedRevisions: {}
      }
    });
    assert.equal(tooManyLinks.status, 400);
    assert.equal((await tooManyLinks.json()).error.code, 'LINK_OPERATIONS_INVALID');

    const catalogResponse = await adminRequest(f, active, '/api/content/cards?limit=3');
    assert.equal(catalogResponse.status, 200);
    const adminPage = await catalogResponse.json();
    assert.equal(adminPage.cards.length, 3);
    assert.ok(adminPage.nextCursor);
    assert.ok(adminPage.cards.every(card => !Object.hasOwn(card, 'payload')));

    const existing = new Set(bundle.edges.map(edge => `${edge.leftId}\u0000${edge.rightId}`));
    let pair = null;
    for (let leftIndex = 0; leftIndex < bundle.cards.length && !pair; leftIndex++) {
      for (let rightIndex = leftIndex + 1; rightIndex < bundle.cards.length; rightIndex++) {
        const left = bundle.cards[leftIndex].id < bundle.cards[rightIndex].id ? bundle.cards[leftIndex].id : bundle.cards[rightIndex].id;
        const right = left === bundle.cards[leftIndex].id ? bundle.cards[rightIndex].id : bundle.cards[leftIndex].id;
        if (!existing.has(`${left}\u0000${right}`)) { pair = [left, right]; break; }
      }
    }
    assert.ok(pair, 'expected an unlinked pair in the real import');
    const beforeLeft = await publicCardDetail(f.env.CONTENT_DB, pair[0]);
    const beforeRight = await publicCardDetail(f.env.CONTENT_DB, pair[1]);
    const linkPayload = {
      operations: [{ action: 'link', sourceSlug: pair[0], targetSlug: pair[1] }],
      expectedRevisions: { [pair[0]]: beforeLeft.card.revision, [pair[1]]: beforeRight.card.revision }
    };
    const linkedResponse = await adminRequest(f, active, '/api/content/links/apply', { method: 'POST', payload: linkPayload });
    assert.equal(linkedResponse.status, 200, await linkedResponse.clone().text());
    const linked = await linkedResponse.json();
    assert.equal(linked.cards.length, 2);
    assert.ok(linked.cards.find(card => card.id === pair[0]).linkedSlugs.includes(pair[1]));
    assert.ok(linked.cards.find(card => card.id === pair[1]).linkedSlugs.includes(pair[0]));
    const loadedLeft = await publicCardDetail(f.env.CONTENT_DB, pair[0]);
    const loadedRight = await publicCardDetail(f.env.CONTENT_DB, pair[1]);
    assert.ok(loadedLeft.card.linkedCards.some(card => card.id === pair[1]));
    assert.ok(loadedRight.card.linkedCards.some(card => card.id === pair[0]));

    const staleResponse = await adminRequest(f, active, '/api/content/links/apply', { method: 'POST', payload: linkPayload });
    assert.equal(staleResponse.status, 409);
    assert.equal((await staleResponse.json()).error.code, 'REVISION_CONFLICT');

    const currentLeft = linked.cards.find(card => card.id === pair[0]);
    const currentRight = linked.cards.find(card => card.id === pair[1]);
    const unlinkResponse = await adminRequest(f, active, '/api/content/links/apply', {
      method: 'POST',
      payload: {
        operations: [{ action: 'unlink', sourceSlug: pair[0], targetSlug: pair[1] }],
        expectedRevisions: { [pair[0]]: currentLeft.revision, [pair[1]]: currentRight.revision }
      }
    });
    assert.equal(unlinkResponse.status, 200, await unlinkResponse.clone().text());
    assert.equal((await publicCardDetail(f.env.CONTENT_DB, pair[0])).card.linkedCards.some(card => card.id === pair[1]), false);

    const oldRoutes = await Promise.all([
      f.request('/api/links/apply', { method: 'POST', originHeader: f.env.MANAGER_ORIGIN, payload: { operations: [] } }),
      f.request('/api/cards/delete', { method: 'POST', originHeader: f.env.MANAGER_ORIGIN, payload: { ids: [] } })
    ]);
    for (const response of oldRoutes) {
      assert.equal(response.status, 503);
      assert.equal((await response.json()).error.code, 'CONTENT_WRITES_ACTIVE');
    }

    const snapshot = await exportContentSnapshot(f.env.CONTENT_DB);
    await f.env.CONTENT_DB.prepare("UPDATE cards SET status='draft' WHERE id=?").bind(pair[0]).run();
    const restored = await restoreContentSnapshot(f.env.CONTENT_DB, snapshot);
    assert.equal(restored.restored, true);
    const afterRestore = await exportContentSnapshot(f.env.CONTENT_DB);
    for (const key of ['cards', 'aliases', 'edges', 'revisions', 'importRuns']) assert.deepEqual(afterRestore[key], snapshot[key]);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('maximum link request handles 24 participants within the D1 query and bound-parameter budget', async () => {
  const metrics = {};
  const f = contentFixture({ contentMetrics: metrics });
  const ids = Array.from({ length: 24 }, (_, index) => `budget-card-${String(index + 1).padStart(2, '0')}`);
  for (const id of ids) {
    const card = normalizeCardInput(id, {
      status: 'published', name: id, title: id, type: 'agl', rarity: 'SSR',
      repoPath: `Custom Cards/${id}`, assetBase: `https://abscustom.github.io/Custom%20Cards/${id}/`,
      payload: {}, builtinForms: []
    });
    await saveCard(f.env.CONTENT_DB, id, 0, card, 'budget-test');
  }

  for (const key of Object.keys(metrics)) metrics[key] = 0;
  const request = {
    operations: Array.from({ length: 12 }, (_, index) => ({
      action: 'link', sourceSlug: ids[index * 2], targetSlug: ids[index * 2 + 1]
    })),
    expectedRevisions: Object.fromEntries(ids.map(id => [id, 1]))
  };
  const result = await applyLinkOperations(f.env.CONTENT_DB, request, 'budget-test');

  assert.equal(result.cards.length, 24);
  assert.ok(result.cards.every(card => card.revision === 2));
  assert.ok(result.cards.every(card => card.linkedSlugs.length === 1));
  assert.ok(metrics.statementsExecuted <= 10, `expected at most 10 content SQL statements, got ${metrics.statementsExecuted}`);
  assert.ok(metrics.maxBoundParameters <= 100, `expected at most 100 bound parameters, got ${metrics.maxBoundParameters}`);
  assert.ok(metrics.maxBoundParameters <= 4, `expected compact JSON binding, got ${metrics.maxBoundParameters} bound parameters`);
  assert.ok(metrics.maxJsonObjectArguments <= 32, `expected at most 32 JSON object arguments, got ${metrics.maxJsonObjectArguments}`);

  const snapshots = f.contentSql.prepare('SELECT card_id,snapshot_json FROM card_revisions WHERE revision=1 ORDER BY card_id').all();
  assert.equal(snapshots.length, 24);
  const snapshotCards = snapshots.map(row => JSON.parse(row.snapshot_json).card);
  assert.ok(snapshotCards.every(card => card.revision === 1));
  assert.ok(snapshotCards.every(card => card.sourceChecksum === null));
  assert.ok(snapshotCards.every(card => card.createdAt.endsWith('.000Z')));
});

test('a save with the maximum 100 builtin forms uses bounded alias and target lookups', async () => {
  const metrics = {};
  const f = contentFixture({ contentMetrics: metrics });
  const targetId = 'builtin-target';
  const sourceId = 'builtin-source';
  const sourceBase = normalizeCardInput(sourceId, {
    status: 'published', name: sourceId, title: sourceId, type: 'agl', rarity: 'SSR',
    repoPath: `Custom Cards/${sourceId}`, assetBase: `https://abscustom.github.io/Custom%20Cards/${sourceId}/`,
    payload: {}, builtinForms: []
  });
  await saveCard(f.env.CONTENT_DB, sourceId, 0, sourceBase, 'budget-test');

  const aliasInsert = f.contentSql.prepare('INSERT INTO card_aliases(path,card_id,provenance,created_at) VALUES(?,?,?,?)');
  aliasInsert.run('/legacy/builtin-source', sourceId, 'budget-test', 1);
  const target = normalizeCardInput(targetId, {
    status: 'published', name: targetId, title: targetId, type: 'agl', rarity: 'SSR',
    repoPath: `Custom Cards/${targetId}`, assetBase: `https://abscustom.github.io/Custom%20Cards/${targetId}/`,
    payload: {},
    builtinForms: [{ name: 'Source', link: 'https://abscustom.github.io/legacy/builtin-source', imageSrc: '', thumbSrc: '', imageExportName: '', targetId: sourceId }]
  });
  await saveCard(f.env.CONTENT_DB, targetId, 0, target, 'budget-test');

  const aliases = Array.from({ length: 100 }, (_, index) => `/legacy/builtin-${String(index + 1).padStart(3, '0')}`);
  for (const alias of aliases) aliasInsert.run(alias, targetId, 'budget-test', 1);
  const source = normalizeCardInput(sourceId, {
    status: 'published', name: sourceId, title: sourceId, type: 'agl', rarity: 'SSR',
    repoPath: `Custom Cards/${sourceId}`, assetBase: `https://abscustom.github.io/Custom%20Cards/${sourceId}/`,
    payload: {},
    builtinForms: aliases.map((alias, index) => ({
      name: `Form ${index + 1}`, link: `https://abscustom.github.io${alias}`, imageSrc: '', thumbSrc: '',
      imageExportName: '', targetId
    }))
  });

  for (const key of Object.keys(metrics)) metrics[key] = 0;
  const saved = await saveCard(f.env.CONTENT_DB, sourceId, 1, source, 'budget-test');

  assert.equal(saved.card.builtinForms.length, 100);
  assert.equal(saved.card.revision, 2);
  assert.equal(Number(f.contentSql.prepare('SELECT revision FROM cards WHERE id=?').get(targetId).revision), 2);
  assert.equal(metrics.statementsExecuted, 12, `expected current, two validation, neighbor, six batched writes, and detail queries; got ${metrics.statementsExecuted}`);
  assert.ok(metrics.maxBoundParameters <= 100, `expected at most 100 bound parameters, got ${metrics.maxBoundParameters}`);
  assert.ok(metrics.maxBoundParameters <= 24, `expected compact bulk lookup and one card insert, got ${metrics.maxBoundParameters}`);
  assert.ok(metrics.maxJsonObjectArguments <= 32, `expected at most 32 JSON object arguments, got ${metrics.maxJsonObjectArguments}`);
});

test('archiving filters authored and direct navigation while retaining restoration data', async () => {
  const f = contentFixture();
  const realFetch = globalThis.fetch;
  globalThis.fetch = f.provider;
  try {
    const bundle = await buildContentImportBundle({ sourceRoot: DEFAULT_SOURCE_ROOT });
    await applyImportBundle(f.env.CONTENT_DB, bundle);
    const reference = bundle.cards.find(card => card.builtinForms.some(form => form.targetId && form.targetId !== card.id));
    assert.ok(reference, 'expected an authored cross-card builtin form');
    const form = reference.builtinForms.find(item => item.targetId && item.targetId !== reference.id);
    const targetId = form.targetId;
    const active = await f.login();
    const existingEdge = await f.env.CONTENT_DB.prepare('SELECT 1 AS found FROM card_form_links WHERE (left_id=? AND right_id=?) OR (left_id=? AND right_id=?)')
      .bind(reference.id < targetId ? reference.id : targetId, reference.id < targetId ? targetId : reference.id,
        reference.id < targetId ? targetId : reference.id, reference.id < targetId ? reference.id : targetId).first();
    if (!existingEdge) {
      const referenceDetail = await publicCardDetail(f.env.CONTENT_DB, reference.id);
      const targetDetail = await publicCardDetail(f.env.CONTENT_DB, targetId);
      const linkResponse = await adminRequest(f, active, '/api/content/links/apply', {
        method: 'POST',
        payload: {
          operations: [{ action: 'link', sourceSlug: reference.id, targetSlug: targetId }],
          expectedRevisions: { [reference.id]: referenceDetail.card.revision, [targetId]: targetDetail.card.revision }
        }
      });
      assert.equal(linkResponse.status, 200, await linkResponse.clone().text());
    }
    const referenceBefore = await publicCardDetail(f.env.CONTENT_DB, reference.id);
    const targetBefore = await publicCardDetail(f.env.CONTENT_DB, targetId);
    const archivedResponse = await adminRequest(f, active, `/api/content/cards/${encodeURIComponent(targetId)}/archive`, {
      method: 'POST', payload: { expectedRevision: targetBefore.card.revision }
    });
    assert.equal(archivedResponse.status, 200, await archivedResponse.clone().text());
    const archived = await archivedResponse.json();
    assert.equal(archived.archivedId, targetId);
    assert.equal((await publicCardDetail(f.env.CONTENT_DB, targetId)), null);
    const referenceAfter = await publicCardDetail(f.env.CONTENT_DB, reference.id);
    assert.equal(referenceAfter.card.revision, referenceBefore.card.revision + 1);
    assert.equal(referenceAfter.card.builtinForms.some(item => item.targetId === targetId), false);
    assert.equal(referenceAfter.card.linkedCards.some(item => item.id === targetId), false);
    const retained = await exportContentSnapshot(f.env.CONTENT_DB);
    assert.ok(retained.cards.some(card => card.id === targetId && card.status === 'archived'));
    assert.ok(retained.aliases.some(alias => alias.cardId === targetId));
    assert.ok(retained.edges.some(edge => edge.leftId === targetId || edge.rightId === targetId));
  } finally {
    globalThis.fetch = realFetch;
  }
});
