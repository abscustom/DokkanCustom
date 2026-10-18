import { Failure, hash, now } from './security.mjs';
import { assertCardId, canonicalLinkPair, normalizeCardInput, validateAliasPath } from './content-domain.mjs';

export const REVISION_RETENTION = 20;

function missingDatabase() {
  throw new Failure(503, 'CONTENT_DB_REQUIRED', 'The card-content database is not configured.');
}

export function requireContentDatabase(env) {
  if (!env?.CONTENT_DB) missingDatabase();
  return env.CONTENT_DB;
}

function parseJson(value, fallback) {
  try { return JSON.parse(value); } catch { return fallback; }
}

function isoTime(seconds) {
  return new Date(Number(seconds || 0) * 1000).toISOString();
}

function linkedSlugsFor(row, byId) {
  return [...(byId.get(row.id) || [])].sort();
}

export function cardSummary(row, linkedSlugs = []) {
  return {
    id: row.id,
    slug: row.slug,
    revision: Number(row.revision),
    status: row.status,
    name: row.name,
    title: row.title,
    type: row.type,
    rarity: row.rarity,
    cardClass: row.card_class || '',
    releaseDate: row.release_date || '',
    categoryNames: parseJson(row.category_names_json, []),
    cardArtImageUrl: row.card_art_image_url || '',
    cardArtVideoUrl: row.card_art_video_url || '',
    unitTag: row.unit_tag || '',
    awakeningMode: row.awakening_mode || '',
    thumb: row.thumb || '',
    repoPath: row.repo_path,
    assetBase: row.asset_base,
    linkedSlugs: [...linkedSlugs].sort(),
    updatedAt: isoTime(row.updated_at)
  };
}

function linkedCardSummary(row) {
  return {
    id: row.id,
    slug: row.slug,
    revision: Number(row.revision),
    name: row.name,
    title: row.title,
    type: row.type,
    rarity: row.rarity,
    thumb: row.thumb || '',
    repoPath: row.repo_path,
    assetBase: row.asset_base
  };
}

function cardData(row, linkedCards, builtinForms = parseJson(row.builtin_forms_json, [])) {
  return {
    id: row.id,
    slug: row.slug,
    revision: Number(row.revision),
    status: row.status,
    name: row.name,
    title: row.title,
    type: row.type,
    rarity: row.rarity,
    cardClass: row.card_class || '',
    releaseDate: row.release_date || '',
    categoryNames: parseJson(row.category_names_json, []),
    cardArtImageUrl: row.card_art_image_url || '',
    cardArtVideoUrl: row.card_art_video_url || '',
    unitTag: row.unit_tag || '',
    awakeningMode: row.awakening_mode || '',
    thumb: row.thumb || '',
    repoPath: row.repo_path,
    assetBase: row.asset_base,
    payload: parseJson(row.payload_json, {}),
    builtinForms,
    linkedCards,
    updatedAt: isoTime(row.updated_at)
  };
}

function rawCard(row) {
  return {
    id: row.id,
    slug: row.slug,
    schemaVersion: Number(row.schema_version),
    status: row.status,
    name: row.name,
    title: row.title,
    type: row.type,
    rarity: row.rarity,
    cardClass: row.card_class || '',
    releaseDate: row.release_date || '',
    categoryNames: parseJson(row.category_names_json, []),
    cardArtImageUrl: row.card_art_image_url || '',
    cardArtVideoUrl: row.card_art_video_url || '',
    unitTag: row.unit_tag || '',
    awakeningMode: row.awakening_mode || '',
    thumb: row.thumb || '',
    repoPath: row.repo_path,
    assetBase: row.asset_base,
    payload: parseJson(row.payload_json, {}),
    builtinForms: parseJson(row.builtin_forms_json, []),
    revision: Number(row.revision),
    sourceChecksum: row.source_checksum || null,
    createdAt: isoTime(row.created_at),
    updatedAt: isoTime(row.updated_at)
  };
}

async function neighborRows(db, id, { publishedOnly = true } = {}) {
  const statusClause = publishedOnly ? "AND other.status='published'" : '';
  const result = await db.prepare(`
    SELECT other.*
    FROM card_form_links AS l
    JOIN cards AS other ON other.id = CASE WHEN l.left_id = ? THEN l.right_id ELSE l.left_id END
    WHERE (l.left_id = ? OR l.right_id = ?) ${statusClause}
    ORDER BY other.id
  `).bind(id, id, id).all();
  return result.results || [];
}

async function relatedPublishedRows(db, id) {
  const result = await db.prepare(`
    SELECT DISTINCT other.id,other.revision
    FROM cards AS other
    WHERE other.id<>? AND other.status='published' AND (
      EXISTS (
        SELECT 1 FROM card_form_links AS l
        WHERE (l.left_id=? AND l.right_id=other.id) OR (l.right_id=? AND l.left_id=other.id)
      )
      OR EXISTS (
        SELECT 1 FROM json_each(other.builtin_forms_json) AS form
        WHERE json_extract(form.value,'$.targetId')=?
      )
    )
    ORDER BY other.id
  `).bind(id, id, id, id).all();
  return result.results || [];
}

async function publicBuiltinForms(db, forms) {
  const targetIds = [...new Set(forms.map(form => form?.targetId).filter(Boolean))];
  if (!targetIds.length) return forms;
  const result = await db.prepare(`
    SELECT id FROM cards
    WHERE status='published' AND id IN (SELECT value FROM json_each(?))
  `).bind(JSON.stringify(targetIds)).all();
  const published = new Set((result.results || []).map(row => row.id));
  return forms.filter(form => !form?.targetId || published.has(form.targetId));
}

async function slugsForPage(db, rows) {
  if (!rows.length) return new Map();
  const ids = rows.map(row => row.id);
  const idsJson = JSON.stringify(ids);
  const result = await db.prepare(`
    SELECT l.left_id, l.right_id, left_card.status AS left_status, right_card.status AS right_status
    FROM card_form_links AS l
    JOIN cards AS left_card ON left_card.id = l.left_id
    JOIN cards AS right_card ON right_card.id = l.right_id
    WHERE l.left_id IN (SELECT value FROM json_each(?))
       OR l.right_id IN (SELECT value FROM json_each(?))
  `).bind(idsJson, idsJson).all();
  const wanted = new Set(ids);
  const map = new Map(ids.map(id => [id, new Set()]));
  for (const edge of result.results || []) {
    if (wanted.has(edge.left_id) && edge.right_status === 'published') map.get(edge.left_id).add(edge.right_id);
    if (wanted.has(edge.right_id) && edge.left_status === 'published') map.get(edge.right_id).add(edge.left_id);
  }
  return map;
}

async function summariesByIds(db, ids) {
  if (!ids.length) return [];
  const result = await db.prepare(`
    SELECT id,slug,status,name,title,type,rarity,card_class,release_date,category_names_json,
      card_art_image_url,card_art_video_url,unit_tag,awakening_mode,thumb,repo_path,asset_base,revision,updated_at
    FROM cards WHERE id IN (SELECT value FROM json_each(?)) ORDER BY id
  `).bind(JSON.stringify(ids)).all();
  const rows = result.results || [];
  const links = await slugsForPage(db, rows);
  return rows.map(row => cardSummary(row, linkedSlugsFor(row, links)));
}

async function catalogPage(db, { limit = 50, cursor = '', admin = false } = {}) {
  const query = admin
    ? `SELECT id,slug,schema_version,status,name,title,type,rarity,card_class,release_date,category_names_json,card_art_image_url,card_art_video_url,unit_tag,awakening_mode,thumb,repo_path,asset_base,revision,updated_at FROM cards WHERE id > ? ORDER BY id LIMIT ?`
    : `SELECT id,slug,schema_version,status,name,title,type,rarity,card_class,release_date,category_names_json,card_art_image_url,card_art_video_url,unit_tag,awakening_mode,thumb,repo_path,asset_base,revision,updated_at FROM cards WHERE status='published' AND id > ? ORDER BY id LIMIT ?`;
  const result = await db.prepare(query).bind(cursor, limit + 1).all();
  const fetched = result.results || [];
  const hasMore = fetched.length > limit;
  const rows = fetched.slice(0, limit);
  const links = await slugsForPage(db, rows);
  const cards = rows.map(row => cardSummary(row, linkedSlugsFor(row, links)));
  return { schemaVersion: 1, cards, nextCursor: hasMore && rows.length ? encodeCursor(rows.at(-1).id) : null };
}

export async function publicCatalog(db, options = {}) {
  return catalogPage(db, { ...options, admin: false });
}

export async function adminCatalog(db, options = {}) {
  return catalogPage(db, { ...options, admin: true });
}

export async function publicCardDetail(db, id) {
  const row = await db.prepare("SELECT * FROM cards WHERE id=? AND status='published'").bind(id).first();
  if (!row) return null;
  const neighbors = await neighborRows(db, id, { publishedOnly: true });
  const linkedCards = neighbors.map(linkedCardSummary);
  const forms = await publicBuiltinForms(db, parseJson(row.builtin_forms_json, []));
  return { schemaVersion: 1, card: cardData(row, linkedCards, forms) };
}

async function adminCardDetail(db, id) {
  const row = await db.prepare('SELECT * FROM cards WHERE id=?').bind(id).first();
  if (!row) return null;
  const neighbors = await neighborRows(db, id, { publishedOnly: true });
  const linkedCards = neighbors.map(linkedCardSummary);
  return { schemaVersion: 1, card: cardData(row, linkedCards) };
}

export async function resolvePublicAlias(db, path) {
  const row = await db.prepare(`
    SELECT c.id,c.slug FROM card_aliases AS a
    JOIN cards AS c ON c.id=a.card_id
    WHERE a.path=? AND c.status='published'
  `).bind(path).first();
  return row ? { schemaVersion: 1, id: row.id, slug: row.slug } : null;
}

function boundCursor(value) {
  if (typeof value !== 'string' || value.length > 512) throw new Failure(400, 'CURSOR_INVALID', 'The card catalog cursor is invalid.');
  return value;
}

export async function publicCatalogRequest(db, url) {
  const rawLimit = url.searchParams.get('limit');
  const limit = rawLimit == null ? 50 : Number(rawLimit);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new Failure(400, 'LIMIT_INVALID', 'Choose a page size from 1 to 100.');
  const cursor = decodeCursor(boundCursor(url.searchParams.get('cursor') || ''));
  return publicCatalog(db, { limit, cursor });
}

export async function adminCatalogRequest(db, url) {
  const rawLimit = url.searchParams.get('limit');
  const limit = rawLimit == null ? 50 : Number(rawLimit);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new Failure(400, 'LIMIT_INVALID', 'Choose a page size from 1 to 100.');
  const cursor = decodeCursor(boundCursor(url.searchParams.get('cursor') || ''));
  return adminCatalog(db, { limit, cursor });
}

function snapshotObject(row) {
  return { schemaVersion: 1, card: rawCard(row) };
}

function cardValues(card, revision, createdAt, updatedAt, sourceChecksum = null) {
  return [
    card.id, card.slug, card.schemaVersion, card.status, card.name, card.title, card.type, card.rarity,
    card.cardClass || null, card.releaseDate || null, JSON.stringify(card.categoryNames || []),
    card.cardArtImageUrl || null, card.cardArtVideoUrl || null, card.unitTag || null, card.awakeningMode || null,
    card.thumb || null, card.repoPath, card.assetBase, JSON.stringify(card.payload), JSON.stringify(card.builtinForms),
    revision, sourceChecksum, createdAt, updatedAt
  ];
}

function importUpdateSql(card) {
  return `UPDATE cards SET
    slug=?,schema_version=?,status=?,name=?,title=?,type=?,rarity=?,card_class=?,release_date=?,category_names_json=?,
    card_art_image_url=?,card_art_video_url=?,unit_tag=?,awakening_mode=?,thumb=?,repo_path=?,asset_base=?,payload_json=?,builtin_forms_json=?,
    revision=?,source_checksum=?,updated_at=?
    WHERE id=? AND revision=?`;
}

function insertOrUpdateSql(card) {
  return `INSERT INTO cards (
    id,slug,schema_version,status,name,title,type,rarity,card_class,release_date,category_names_json,
    card_art_image_url,card_art_video_url,unit_tag,awakening_mode,thumb,repo_path,asset_base,payload_json,builtin_forms_json,
    revision,source_checksum,created_at,updated_at
  ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
}

function updateSql(card) {
  return `UPDATE cards SET
    slug=?,schema_version=?,status=?,name=?,title=?,type=?,rarity=?,card_class=?,release_date=?,category_names_json=?,
    card_art_image_url=?,card_art_video_url=?,unit_tag=?,awakening_mode=?,thumb=?,repo_path=?,asset_base=?,payload_json=?,builtin_forms_json=?,
    revision=?,updated_at=?
    WHERE id=? AND revision=?`;
}

function historyStatement(db, row, actor, time) {
  return db.prepare('INSERT INTO card_revisions(card_id,revision,snapshot_json,actor,created_at) VALUES(?,?,?,?,?)')
    .bind(row.id, row.revision, JSON.stringify(snapshotObject(row)), actor || 'manager', time);
}

function historyInsertStatement(db, ids, actor, time) {
  return db.prepare(`
    INSERT INTO card_revisions(card_id,revision,snapshot_json,actor,created_at)
    SELECT c.id,c.revision,
      json_object('schemaVersion',1,'card',json_set(json_patch(
        json_object(
          'id',c.id,'slug',c.slug,'schemaVersion',c.schema_version,'status',c.status,
          'name',c.name,'title',c.title,'type',c.type,'rarity',c.rarity,
          'cardClass',COALESCE(c.card_class,''),'releaseDate',COALESCE(c.release_date,''),
          'categoryNames',json(c.category_names_json),'cardArtImageUrl',COALESCE(c.card_art_image_url,'')
        ),
        json_object(
          'cardArtVideoUrl',COALESCE(c.card_art_video_url,''),'unitTag',COALESCE(c.unit_tag,''),
          'awakeningMode',COALESCE(c.awakening_mode,''),'thumb',COALESCE(c.thumb,''),
          'repoPath',c.repo_path,'assetBase',c.asset_base,
          'payload',json(c.payload_json),'builtinForms',json(c.builtin_forms_json),
          'revision',c.revision,'sourceChecksum',c.source_checksum,
          'createdAt',strftime('%Y-%m-%dT%H:%M:%fZ',c.created_at,'unixepoch'),
          'updatedAt',strftime('%Y-%m-%dT%H:%M:%fZ',c.updated_at,'unixepoch')
        )
      ),'$.sourceChecksum',c.source_checksum)),?,?
    FROM cards AS c
    WHERE c.id IN (SELECT value FROM json_each(?))
    ORDER BY c.id
  `).bind(actor || 'manager', time, JSON.stringify(ids));
}

function revisionUpdateStatement(db, rows, time) {
  const expected = rows.map(row => ({ id: row.id, revision: Number(row.revision) }));
  return db.prepare(`
    WITH expected(id,revision) AS (
      SELECT json_extract(value,'$.id'),json_extract(value,'$.revision') FROM json_each(?)
    )
    UPDATE cards SET revision=revision+1,updated_at=?
    WHERE EXISTS (
      SELECT 1 FROM expected WHERE expected.id=cards.id AND expected.revision=cards.revision
    )
  `).bind(JSON.stringify(expected), time);
}

function assertBatchChangesStatement(db, cardId, actor, time, expectedChanges) {
  // A failed CHECK forces D1.batch() to roll back the whole optimistic update.
  return db.prepare(`
    INSERT INTO card_revisions(card_id,revision,snapshot_json,actor,created_at)
    SELECT ?,0,'{}',?,? WHERE changes()!=?
  `).bind(cardId, actor || 'manager', time, expectedChanges);
}

function trimHistoriesStatement(db, ids) {
  return db.prepare(`DELETE FROM card_revisions
    WHERE card_id IN (SELECT value FROM json_each(?))
      AND revision <= (SELECT MAX(revision)-? FROM card_revisions AS kept WHERE kept.card_id=card_revisions.card_id)`)
    .bind(JSON.stringify(ids), REVISION_RETENTION);
}

function trimHistoryStatement(db, id) {
  return trimHistoriesStatement(db, [id]);
}

async function revisionsChanged(db, expectedRows) {
  if (!expectedRows.length) return false;
  const expected = new Map(expectedRows.map(row => [row.id, Number(row.revision)]));
  const result = await db.prepare('SELECT id,revision FROM cards WHERE id IN (SELECT value FROM json_each(?))')
    .bind(JSON.stringify([...expected.keys()])).all();
  const actual = new Map((result.results || []).map(row => [row.id, Number(row.revision)]));
  return [...expected].some(([id, revision]) => actual.get(id) !== revision);
}

function publicToggleChanged(before, after) {
  return Boolean(before === 'published') !== Boolean(after === 'published');
}

async function revisionNeighbors(db, id) {
  return neighborRows(db, id, { publishedOnly: true });
}

async function validateBuiltinTargets(db, cards, aliases = []) {
  const aliasOwners = new Map();
  for (const alias of aliases) {
    const path = validateAliasPath(alias.path);
    const cardId = assertCardId(alias.cardId);
    if (aliasOwners.has(path) && aliasOwners.get(path) !== cardId) {
      throw new Failure(409, 'CARD_ALIAS_CONFLICT', 'A legacy card path is assigned to multiple cards.');
    }
    aliasOwners.set(path, cardId);
  }
  const cardIds = new Set(cards.map(card => card.id));
  const references = [];
  for (const card of cards) {
    for (const form of card.builtinForms || []) {
      if (!form.targetId) continue;
      const targetId = assertCardId(form.targetId);
      let linkPath;
      try { linkPath = new URL(form.link).pathname; }
      catch { throw new Failure(400, 'BUILTIN_TARGET_ALIAS_MISMATCH', 'An authored card link must match its exact stored alias.'); }
      references.push({ targetId, linkPath });
    }
  }
  const missingAliasPaths = [...new Set(references.map(reference => reference.linkPath).filter(path => !aliasOwners.has(path)))];
  if (missingAliasPaths.length) {
    const result = await db.prepare('SELECT path,card_id FROM card_aliases WHERE path IN (SELECT value FROM json_each(?))')
      .bind(JSON.stringify(missingAliasPaths)).all();
    for (const row of result.results || []) aliasOwners.set(row.path, row.card_id);
  }
  const targetIds = new Set(cardIds);
  const missingTargets = [...new Set(references.map(reference => reference.targetId).filter(id => !cardIds.has(id)))];
  if (missingTargets.length) {
    const result = await db.prepare('SELECT id FROM cards WHERE id IN (SELECT value FROM json_each(?))')
      .bind(JSON.stringify(missingTargets)).all();
    for (const row of result.results || []) targetIds.add(row.id);
  }
  for (const reference of references) {
    if (aliasOwners.get(reference.linkPath) !== reference.targetId) {
      throw new Failure(400, 'BUILTIN_TARGET_ALIAS_MISMATCH', 'An authored card link must match its exact stored alias.');
    }
    if (!targetIds.has(reference.targetId)) {
      throw new Failure(400, 'BUILTIN_TARGET_NOT_FOUND', 'An authored card link references an unknown card.');
    }
  }
}

export async function saveCard(db, id, expected, card, actor = 'manager') {
  const current = await db.prepare('SELECT * FROM cards WHERE id=?').bind(id).first();
  if ((expected === 0 && current) || (expected > 0 && (!current || Number(current.revision) !== expected))) {
    throw new Failure(409, 'REVISION_CONFLICT', 'This card changed since it was loaded. Reload and retry.');
  }
  if (card.id !== id) throw new Failure(400, 'CARD_ID_MISMATCH', 'The card ID cannot be changed.');
  await validateBuiltinTargets(db, [card]);
  const time = now();
  const nextRevision = current ? Number(current.revision) + 1 : 1;
  const neighbors = current && (current.status === 'published' || card.status === 'published')
    ? await relatedPublishedRows(db, id)
    : [];
  const affectedIds = current ? [id, ...neighbors.map(row => row.id)] : [];
  const statements = [];
  if (current) {
    statements.push(historyInsertStatement(db, affectedIds, actor, time));
    statements.push(db.prepare(updateSql(card)).bind(
      card.slug, card.schemaVersion, card.status, card.name, card.title, card.type, card.rarity,
      card.cardClass || null, card.releaseDate || null, JSON.stringify(card.categoryNames || []),
      card.cardArtImageUrl || null, card.cardArtVideoUrl || null, card.unitTag || null, card.awakeningMode || null,
      card.thumb || null, card.repoPath, card.assetBase, JSON.stringify(card.payload), JSON.stringify(card.builtinForms),
      nextRevision, time, id, expected
    ));
    statements.push(assertBatchChangesStatement(db, id, actor, time, 1));
    if (neighbors.length) {
      statements.push(revisionUpdateStatement(db, neighbors, time));
      statements.push(assertBatchChangesStatement(db, id, actor, time, neighbors.length));
    }
    statements.push(trimHistoriesStatement(db, affectedIds));
  } else {
    statements.push(db.prepare(insertOrUpdateSql(card)).bind(...cardValues(card, nextRevision, time, time, null)));
  }
  try {
    await db.batch(statements);
  } catch (error) {
    if (error instanceof Failure) throw error;
    const expectedRows = current ? [{ id, revision: expected }, ...neighbors] : [];
    if (current && await revisionsChanged(db, expectedRows)) {
      throw new Failure(409, 'REVISION_CONFLICT', 'This card changed since it was loaded. Reload and retry.');
    }
    if (!current && await db.prepare('SELECT id FROM cards WHERE id=?').bind(id).first()) {
      throw new Failure(409, 'REVISION_CONFLICT', 'This card changed since it was loaded. Reload and retry.');
    }
    throw new Failure(503, 'CONTENT_SAVE_FAILED', 'The card could not be saved. Retry shortly.');
  }
  return await adminCardDetail(db, id);
}

function normalizeLinkOperations(operations, expectedRevisions) {
  if (!Array.isArray(operations) || operations.length < 1 || operations.length > 12) {
    throw new Failure(400, 'LINK_OPERATIONS_INVALID', 'Apply between 1 and 12 direct link changes per request.');
  }
  if (!expectedRevisions || typeof expectedRevisions !== 'object' || Array.isArray(expectedRevisions)) {
    throw new Failure(400, 'EXPECTED_REVISIONS_REQUIRED', 'Expected revisions are required for every linked card.');
  }
  const expected = new Map();
  for (const [id, revision] of Object.entries(expectedRevisions)) {
    if (!Number.isSafeInteger(revision) || revision < 1) throw new Failure(400, 'EXPECTED_REVISION_INVALID', 'Every expected revision must be a positive integer.');
    expected.set(id, revision);
  }
  const seen = new Map();
  const result = [];
  for (const operation of operations) {
    if (!operation || !['link', 'unlink'].includes(operation.action)) throw new Failure(400, 'LINK_OPERATION_INVALID', 'Choose link or unlink for every change.');
    const [leftId, rightId] = canonicalLinkPair(operation.sourceSlug, operation.targetSlug);
    const key = `${leftId}\u0000${rightId}`;
    const previous = seen.get(key);
    if (previous && previous !== operation.action) throw new Failure(400, 'LINK_OPERATION_CONFLICT', 'A link cannot be both added and removed in the same request.');
    if (previous) continue;
    seen.set(key, operation.action);
    result.push({ action: operation.action, leftId, rightId });
  }
  const participants = [...new Set(result.flatMap(operation => [operation.leftId, operation.rightId]))].sort();
  if (participants.some(id => !expected.has(id))) throw new Failure(400, 'EXPECTED_REVISIONS_REQUIRED', 'Expected revisions are required for every linked card.');
  return { operations: result, participants, expected };
}

export async function applyLinkOperations(db, body, actor = 'manager') {
  const { operations, participants, expected } = normalizeLinkOperations(body?.operations, body?.expectedRevisions);
  const rows = new Map();
  const participantResult = await db.prepare('SELECT * FROM cards WHERE id IN (SELECT value FROM json_each(?))')
    .bind(JSON.stringify(participants)).all();
  for (const row of participantResult.results || []) rows.set(row.id, row);
  for (const id of participants) {
    const row = rows.get(id);
    if (!row) throw new Failure(404, 'CARD_NOT_FOUND', 'A linked card is unavailable.');
    if (Number(row.revision) !== expected.get(id)) throw new Failure(409, 'REVISION_CONFLICT', 'A linked card changed since it was loaded. Reload and retry.');
  }
  for (const operation of operations) {
    if (operation.action === 'link' && (rows.get(operation.leftId).status !== 'published' || rows.get(operation.rightId).status !== 'published')) {
      throw new Failure(400, 'CARD_LINK_UNAVAILABLE', 'Only published cards can be linked.');
    }
  }
  const pairJson = JSON.stringify(operations.map(({ leftId, rightId }) => [leftId, rightId]));
  const currentEdges = await db.prepare(`
    SELECT left_id,right_id FROM card_form_links
    WHERE (left_id,right_id) IN (SELECT json_extract(value,'$[0]'),json_extract(value,'$[1]') FROM json_each(?))
  `).bind(pairJson).all();
  const existing = new Set((currentEdges.results || []).map(edge => `${edge.left_id}\u0000${edge.right_id}`));
  const changes = operations.filter(operation => (operation.action === 'link') !== existing.has(`${operation.leftId}\u0000${operation.rightId}`));
  const affected = [...new Set(changes.flatMap(operation => [operation.leftId, operation.rightId]))].sort();
  if (!changes.length) return { schemaVersion: 1, cards: [] };
  const time = now();
  const affectedRows = affected.map(id => rows.get(id));
  const statements = [
    historyInsertStatement(db, affected, actor, time),
    revisionUpdateStatement(db, affectedRows, time),
    assertBatchChangesStatement(db, affected[0], actor, time, affected.length)
  ];
  const additions = changes.filter(operation => operation.action === 'link').map(operation => [operation.leftId, operation.rightId]);
  const removals = changes.filter(operation => operation.action === 'unlink').map(operation => [operation.leftId, operation.rightId]);
  if (additions.length) {
    statements.push(db.prepare(`
      INSERT INTO card_form_links(left_id,right_id,created_at)
      SELECT json_extract(value,'$[0]'),json_extract(value,'$[1]'),? FROM json_each(?)
    `).bind(time, JSON.stringify(additions)));
  }
  if (removals.length) {
    statements.push(db.prepare(`
      DELETE FROM card_form_links
      WHERE (left_id,right_id) IN (
        SELECT json_extract(value,'$[0]'),json_extract(value,'$[1]') FROM json_each(?)
      )
    `).bind(JSON.stringify(removals)));
  }
  statements.push(trimHistoriesStatement(db, affected));
  try {
    await db.batch(statements);
  } catch (error) {
    if (error instanceof Failure) throw error;
    const expectedRows = participants.map(id => ({ id, revision: expected.get(id) }));
    if (await revisionsChanged(db, expectedRows)) {
      throw new Failure(409, 'REVISION_CONFLICT', 'A linked card changed since it was loaded. Reload and retry.');
    }
    throw new Failure(503, 'CONTENT_LINK_SAVE_FAILED', 'The card links could not be saved. Retry shortly.');
  }
  const cards = await summariesByIds(db, affected);
  return { schemaVersion: 1, cards };
}

export async function archiveCard(db, id, expected, actor = 'manager') {
  const current = await db.prepare('SELECT * FROM cards WHERE id=?').bind(id).first();
  if (!current) throw new Failure(404, 'CARD_NOT_FOUND', 'The card is unavailable.');
  if (Number(current.revision) !== expected) throw new Failure(409, 'REVISION_CONFLICT', 'This card changed since it was loaded. Reload and retry.');
  if (current.status === 'archived') return { schemaVersion: 1, archivedId: id, cards: [] };
  const neighbors = await relatedPublishedRows(db, id);
  const time = now(), affected = [current, ...neighbors];
  const affectedIds = affected.map(row => row.id);
  const statements = [
    historyInsertStatement(db, affectedIds, actor, time),
    db.prepare("UPDATE cards SET status='archived',revision=revision+1,updated_at=? WHERE id=? AND revision=?")
      .bind(time, id, expected),
    assertBatchChangesStatement(db, id, actor, time, 1)
  ];
  if (neighbors.length) {
    statements.push(revisionUpdateStatement(db, neighbors, time));
    statements.push(assertBatchChangesStatement(db, id, actor, time, neighbors.length));
  }
  statements.push(trimHistoriesStatement(db, affectedIds));
  try {
    await db.batch(statements);
  } catch (error) {
    if (error instanceof Failure) throw error;
    if (await revisionsChanged(db, affected)) {
      throw new Failure(409, 'REVISION_CONFLICT', 'A linked card changed since it was loaded. Reload and retry.');
    }
    throw new Failure(503, 'CARD_ARCHIVE_FAILED', 'The card could not be archived. Retry shortly.');
  }
  const cards = await summariesByIds(db, affectedIds);
  return { schemaVersion: 1, archivedId: id, cards };
}

export async function applyImportBundle(db, bundle, actor = 'local-import') {
  if (!bundle || bundle.schemaVersion !== 1 || bundle.kind !== 'dokkan-custom-card-content-import' || bundle.status !== 'ready') {
    throw new Failure(400, 'IMPORT_BUNDLE_INVALID', 'The content import bundle is not ready to apply.');
  }
  if (!Array.isArray(bundle.cards) || !Array.isArray(bundle.aliases) || !Array.isArray(bundle.edges) || !bundle.runId || !bundle.sourceChecksum) {
    throw new Failure(400, 'IMPORT_BUNDLE_INVALID', 'The content import bundle is incomplete.');
  }
  if (typeof bundle.runId !== 'string' || bundle.runId.length > 96 || !/^[A-Za-z0-9._-]+$/.test(bundle.runId) ||
      typeof bundle.sourceChecksum !== 'string' || !/^[a-f0-9]{64}$/i.test(bundle.sourceChecksum)) {
    throw new Failure(400, 'IMPORT_BUNDLE_INVALID', 'The content import bundle identity is invalid.');
  }
  const cards = bundle.cards.map(source => {
    assertCardId(source?.id);
    if (typeof source.sourceChecksum !== 'string' || !/^[a-f0-9]{64}$/i.test(source.sourceChecksum)) {
      throw new Failure(400, 'IMPORT_CARD_CHECKSUM_INVALID', 'A source card checksum is invalid.');
    }
    const normalized = normalizeCardInput(source.id, source);
    normalized.sourceChecksum = source.sourceChecksum;
    normalized.sourcePath = typeof source.sourcePath === 'string' && source.sourcePath.length <= 512
      ? source.sourcePath
      : `Custom Cards/${source.id}/card.json`;
    return normalized;
  });
  const importedIds = new Set(cards.map(card => card.id));
  if (importedIds.size !== cards.length) throw new Failure(400, 'IMPORT_CARD_DUPLICATE', 'The content bundle contains a duplicate card ID.');
  const aliasOwners = new Map();
  for (const alias of bundle.aliases) {
    const path = validateAliasPath(alias?.path);
    const cardId = assertCardId(alias?.cardId);
    if (aliasOwners.has(path) && aliasOwners.get(path) !== cardId) throw new Failure(409, 'CARD_ALIAS_CONFLICT', 'A legacy card path is assigned to multiple cards.');
    aliasOwners.set(path, cardId);
    if (!importedIds.has(cardId) && !(await db.prepare('SELECT id FROM cards WHERE id=?').bind(cardId).first())) {
      throw new Failure(400, 'IMPORT_ALIAS_UNRESOLVED', 'A legacy card path references a missing card.');
    }
  }
  const edgeKeys = new Set();
  for (const edge of bundle.edges) {
    const [leftId, rightId] = canonicalLinkPair(edge?.leftId, edge?.rightId);
    if (leftId !== edge.leftId || rightId !== edge.rightId) throw new Failure(400, 'IMPORT_EDGE_INVALID', 'A direct card link is not in canonical order.');
    const key = `${leftId}\u0000${rightId}`;
    if (edgeKeys.has(key)) throw new Failure(400, 'IMPORT_EDGE_DUPLICATE', 'The content bundle contains a duplicate direct link.');
    edgeKeys.add(key);
  }
  await validateBuiltinTargets(db, cards, bundle.aliases);
  const time = now();
  const outcomes = new Map();
  for (const card of cards) {
    const current = await db.prepare('SELECT * FROM cards WHERE id=?').bind(card.id).first();
    if (!current) outcomes.set(card.id, { result: 'inserted', card });
    else if (current.source_checksum && current.source_checksum === card.sourceChecksum) outcomes.set(card.id, { result: 'unchanged', card, current });
    else if (Number(current.revision) > 1) outcomes.set(card.id, { result: 'conflict', card, current, reason: 'card-edited-after-import' });
    else outcomes.set(card.id, { result: 'updated', card, current });
  }

  for (const alias of bundle.aliases) {
    const existing = await db.prepare('SELECT card_id FROM card_aliases WHERE path=?').bind(alias.path).first();
    if (existing && existing.card_id !== alias.cardId) {
      throw new Failure(409, 'CARD_ALIAS_CONFLICT', 'A legacy card path is already assigned to a different card.');
    }
  }
  const knownIds = importedIds;
  for (const edge of bundle.edges) {
    if ((!knownIds.has(edge.leftId) && !(await db.prepare('SELECT 1 AS found FROM cards WHERE id=?').bind(edge.leftId).first())) ||
        (!knownIds.has(edge.rightId) && !(await db.prepare('SELECT 1 AS found FROM cards WHERE id=?').bind(edge.rightId).first()))) {
      throw new Failure(400, 'IMPORT_EDGE_UNRESOLVED', 'A direct card link references a missing card.');
    }
  }

  const cardReports = [];
  const statements = [db.prepare(`
    INSERT INTO card_import_runs(run_id,source_checksum,status,started_at,finished_at,report_json)
    VALUES(?,?,?,?,?,?)
    ON CONFLICT(run_id) DO UPDATE SET status=excluded.status,finished_at=excluded.finished_at,report_json=excluded.report_json
  `).bind(bundle.runId, bundle.sourceChecksum, 'planned', time, null, JSON.stringify(bundle.report || {}))];

  for (const [id, outcome] of outcomes) {
    const { card, current, result } = outcome;
    const details = outcome.reason ? { reason: outcome.reason } : {};
    cardReports.push({ sourcePath: card.sourcePath || `Custom Cards/${id}/card.json`, cardId: id, sourceChecksum: card.sourceChecksum, result, ...details });
    if (result === 'inserted') {
      statements.push(db.prepare(insertOrUpdateSql(card)).bind(...cardValues(card, 1, time, time, card.sourceChecksum)));
    } else if (result === 'updated') {
      statements.push(historyStatement(db, current, actor, time));
      statements.push(db.prepare(importUpdateSql(card)).bind(
        card.slug, card.schemaVersion, card.status, card.name, card.title, card.type, card.rarity,
        card.cardClass || null, card.releaseDate || null, JSON.stringify(card.categoryNames || []),
        card.cardArtImageUrl || null, card.cardArtVideoUrl || null, card.unitTag || null, card.awakeningMode || null,
        card.thumb || null, card.repoPath, card.assetBase, JSON.stringify(card.payload), JSON.stringify(card.builtinForms),
        Number(current.revision) + 1, card.sourceChecksum, time, id, current.revision
      ));
      statements.push(trimHistoryStatement(db, id));
    }
  }

  for (const alias of bundle.aliases) {
    statements.push(db.prepare('INSERT OR IGNORE INTO card_aliases(path,card_id,provenance,created_at) VALUES(?,?,?,?)')
      .bind(alias.path, alias.cardId, alias.provenance || 'imported', time));
  }
  const skippedEdges = [];
  for (const edge of bundle.edges) {
    if (outcomes.get(edge.leftId)?.result === 'conflict' || outcomes.get(edge.rightId)?.result === 'conflict') {
      skippedEdges.push({ ...edge, reason: 'endpoint-edited-after-import' });
      continue;
    }
    const [leftId, rightId] = edge.leftId < edge.rightId ? [edge.leftId, edge.rightId] : [edge.rightId, edge.leftId];
    statements.push(db.prepare('INSERT OR IGNORE INTO card_form_links(left_id,right_id,created_at) VALUES(?,?,?)')
      .bind(leftId, rightId, time));
  }
  for (const report of cardReports) {
    statements.push(db.prepare(`
      INSERT INTO card_import_items(run_id,source_path,card_id,source_checksum,result,details_json)
      VALUES(?,?,?,?,?,?)
      ON CONFLICT(run_id,source_path) DO UPDATE SET card_id=excluded.card_id,source_checksum=excluded.source_checksum,result=excluded.result,details_json=excluded.details_json
    `).bind(bundle.runId, report.sourcePath, report.cardId, report.sourceChecksum, report.result, JSON.stringify(report.reason ? { reason: report.reason } : {})));
  }
  const finalStatus = cardReports.some(item => item.result === 'conflict') || skippedEdges.length ? 'partial' : 'applied';
  const finalReport = {
    ...(bundle.report || {}),
    cardResults: cardReports,
    skippedEdges,
    aliasesAddedOrConfirmed: bundle.aliases.length,
    sourceChecksum: bundle.sourceChecksum
  };
  statements.push(db.prepare('UPDATE card_import_runs SET status=?,finished_at=?,report_json=? WHERE run_id=?')
    .bind(finalStatus, time, JSON.stringify(finalReport), bundle.runId));
  try {
    await db.batch(statements);
  } catch {
    throw new Failure(503, 'CONTENT_IMPORT_FAILED', 'The content import could not be applied locally.');
  }
  return {
    schemaVersion: 1,
    runId: bundle.runId,
    status: finalStatus,
    sourceChecksum: bundle.sourceChecksum,
    cardResults: cardReports,
    skippedEdges,
    aliasesAddedOrConfirmed: bundle.aliases.length
  };
}

export async function exportContentSnapshot(db) {
  const cards = await db.prepare('SELECT * FROM cards ORDER BY id').all();
  const aliases = await db.prepare('SELECT path,card_id AS cardId,provenance,created_at AS createdAt FROM card_aliases ORDER BY path').all();
  const edges = await db.prepare('SELECT left_id AS leftId,right_id AS rightId,created_at AS createdAt FROM card_form_links ORDER BY left_id,right_id').all();
  const revisions = await db.prepare('SELECT card_id AS cardId,revision,snapshot_json AS snapshotJson,actor,created_at AS createdAt FROM card_revisions ORDER BY card_id,revision').all();
  const runs = await db.prepare('SELECT run_id AS runId,source_checksum AS sourceChecksum,status,started_at AS startedAt,finished_at AS finishedAt,report_json AS reportJson FROM card_import_runs ORDER BY started_at,run_id').all();
  const items = await db.prepare('SELECT run_id AS runId,source_path AS sourcePath,card_id AS cardId,source_checksum AS sourceChecksum,result,details_json AS detailsJson FROM card_import_items ORDER BY run_id,source_path').all();
  const itemsByRun = new Map();
  for (const item of items.results || []) {
    if (!itemsByRun.has(item.runId)) itemsByRun.set(item.runId, []);
    itemsByRun.get(item.runId).push({
      sourcePath: item.sourcePath,
      cardId: item.cardId,
      sourceChecksum: item.sourceChecksum,
      result: item.result,
      details: parseJson(item.detailsJson, {})
    });
  }
  return {
    schemaVersion: 1,
    kind: 'dokkan-custom-card-content',
    exportedAt: new Date().toISOString(),
    cards: (cards.results || []).map(rawCard),
    aliases: (aliases.results || []).map(row => ({ ...row, createdAt: isoTime(row.createdAt) })),
    edges: (edges.results || []).map(row => ({ ...row, createdAt: isoTime(row.createdAt) })),
    revisions: (revisions.results || []).map(row => ({
      cardId: row.cardId,
      revision: Number(row.revision),
      snapshot: parseJson(row.snapshotJson, {}),
      actor: row.actor,
      createdAt: isoTime(row.createdAt)
    })),
    importRuns: (runs.results || []).map(row => ({
      runId: row.runId,
      sourceChecksum: row.sourceChecksum,
      status: row.status,
      startedAt: isoTime(row.startedAt),
      finishedAt: row.finishedAt == null ? null : isoTime(row.finishedAt),
      report: parseJson(row.reportJson, {}),
      items: itemsByRun.get(row.runId) || []
    }))
  };
}

function snapshotSeconds(value, field, { nullable = false } = {}) {
  if (nullable && value == null) return null;
  const parsed = typeof value === 'number' ? value : Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Failure(400, 'CONTENT_SNAPSHOT_INVALID', `The recovery snapshot ${field} timestamp is invalid.`);
  return Math.floor(parsed > 10_000_000_000 ? parsed / 1000 : parsed);
}

export async function restoreContentSnapshot(db, snapshot, actor = 'local-rollback') {
  if (!snapshot || snapshot.schemaVersion !== 1 || snapshot.kind !== 'dokkan-custom-card-content' ||
      !Array.isArray(snapshot.cards) || !Array.isArray(snapshot.aliases) || !Array.isArray(snapshot.edges) ||
      !Array.isArray(snapshot.revisions) || !Array.isArray(snapshot.importRuns)) {
    throw new Failure(400, 'CONTENT_SNAPSHOT_INVALID', 'The recovery snapshot is incomplete or unsupported.');
  }
  const cards = snapshot.cards.map(source => {
    assertCardId(source?.id);
    const normalized = normalizeCardInput(source.id, {
      ...source,
      status: source.status === 'archived' ? 'draft' : source.status
    });
    if (!Number.isSafeInteger(source.revision) || source.revision < 1 || source.slug !== source.id) {
      throw new Failure(400, 'CONTENT_SNAPSHOT_INVALID', 'A recovery snapshot card revision or slug is invalid.');
    }
    normalized.status = source.status;
    normalized.revision = source.revision;
    normalized.sourceChecksum = source.sourceChecksum || null;
    normalized.createdAt = snapshotSeconds(source.createdAt, 'card creation');
    normalized.updatedAt = snapshotSeconds(source.updatedAt, 'card update');
    return normalized;
  });
  const cardIds = new Set(cards.map(card => card.id));
  if (cardIds.size !== cards.length) throw new Failure(400, 'CONTENT_SNAPSHOT_INVALID', 'The recovery snapshot contains duplicate cards.');
  const aliases = snapshot.aliases.map(alias => ({
    path: validateAliasPath(alias?.path),
    cardId: assertCardId(alias?.cardId),
    provenance: String(alias?.provenance || 'restored').slice(0, 80),
    createdAt: snapshotSeconds(alias?.createdAt, 'alias creation')
  }));
  if (aliases.some(alias => !cardIds.has(alias.cardId)) || new Set(aliases.map(alias => alias.path)).size !== aliases.length) {
    throw new Failure(400, 'CONTENT_SNAPSHOT_INVALID', 'A recovery snapshot alias is missing or duplicated.');
  }
  const edges = snapshot.edges.map(edge => {
    const [leftId, rightId] = canonicalLinkPair(edge?.leftId, edge?.rightId);
    if (leftId !== edge.leftId || rightId !== edge.rightId || !cardIds.has(leftId) || !cardIds.has(rightId)) {
      throw new Failure(400, 'CONTENT_SNAPSHOT_INVALID', 'A recovery snapshot direct link is invalid.');
    }
    return { leftId, rightId, createdAt: snapshotSeconds(edge.createdAt, 'link creation') };
  });
  if (new Set(edges.map(edge => `${edge.leftId}\u0000${edge.rightId}`)).size !== edges.length) {
    throw new Failure(400, 'CONTENT_SNAPSHOT_INVALID', 'A recovery snapshot contains duplicate direct links.');
  }
  await validateBuiltinTargets(db, cards, aliases);
  for (const card of cards) {
    if ((card.builtinForms || []).some(form => form.targetId && !cardIds.has(form.targetId))) {
      throw new Failure(400, 'CONTENT_SNAPSHOT_INVALID', 'A recovery snapshot authored link references a card outside the snapshot.');
    }
  }
  const revisions = snapshot.revisions.map(item => {
    assertCardId(item?.cardId);
    if (!cardIds.has(item.cardId) || !Number.isSafeInteger(item.revision) || item.revision < 1 || !item.snapshot || typeof item.snapshot !== 'object') {
      throw new Failure(400, 'CONTENT_SNAPSHOT_INVALID', 'A recovery snapshot revision is invalid.');
    }
    return { ...item, actor: String(item.actor || actor).slice(0, 120), createdAt: snapshotSeconds(item.createdAt, 'revision creation') };
  });
  const runs = snapshot.importRuns.map(run => {
    if (typeof run?.runId !== 'string' || !run.runId || run.runId.length > 96 || typeof run.sourceChecksum !== 'string' || !/^[a-f0-9]{64}$/i.test(run.sourceChecksum) ||
        !['planned', 'applied', 'partial', 'blocked'].includes(run.status) || !Array.isArray(run.items)) {
      throw new Failure(400, 'CONTENT_SNAPSHOT_INVALID', 'A recovery snapshot import run is invalid.');
    }
    return {
      ...run,
      startedAt: snapshotSeconds(run.startedAt, 'import start'),
      finishedAt: snapshotSeconds(run.finishedAt, 'import finish', { nullable: true }),
      items: run.items.map(item => {
        assertCardId(item?.cardId);
        if (typeof item.sourcePath !== 'string' || typeof item.sourceChecksum !== 'string' || !/^[a-f0-9]{64}$/i.test(item.sourceChecksum) ||
            !['inserted', 'updated', 'unchanged', 'conflict', 'blocked'].includes(item.result) || !cardIds.has(item.cardId)) {
          throw new Failure(400, 'CONTENT_SNAPSHOT_INVALID', 'A recovery snapshot import item is invalid.');
        }
        return item;
      })
    };
  });

  const statements = [
    db.prepare('DELETE FROM card_form_links'),
    db.prepare('DELETE FROM card_aliases'),
    db.prepare('DELETE FROM card_revisions'),
    db.prepare('DELETE FROM card_import_items'),
    db.prepare('DELETE FROM card_import_runs'),
    db.prepare('DELETE FROM cards')
  ];
  for (const card of cards) {
    statements.push(db.prepare(insertOrUpdateSql(card)).bind(...cardValues(card, card.revision, card.createdAt, card.updatedAt, card.sourceChecksum)));
  }
  for (const alias of aliases) {
    statements.push(db.prepare('INSERT INTO card_aliases(path,card_id,provenance,created_at) VALUES(?,?,?,?)')
      .bind(alias.path, alias.cardId, alias.provenance, alias.createdAt));
  }
  for (const edge of edges) {
    statements.push(db.prepare('INSERT INTO card_form_links(left_id,right_id,created_at) VALUES(?,?,?)')
      .bind(edge.leftId, edge.rightId, edge.createdAt));
  }
  for (const revision of revisions) {
    statements.push(db.prepare('INSERT INTO card_revisions(card_id,revision,snapshot_json,actor,created_at) VALUES(?,?,?,?,?)')
      .bind(revision.cardId, revision.revision, JSON.stringify(revision.snapshot), revision.actor, revision.createdAt));
  }
  for (const run of runs) {
    statements.push(db.prepare('INSERT INTO card_import_runs(run_id,source_checksum,status,started_at,finished_at,report_json) VALUES(?,?,?,?,?,?)')
      .bind(run.runId, run.sourceChecksum, run.status, run.startedAt, run.finishedAt, JSON.stringify(run.report || {})));
    for (const item of run.items) {
      statements.push(db.prepare('INSERT INTO card_import_items(run_id,source_path,card_id,source_checksum,result,details_json) VALUES(?,?,?,?,?,?)')
        .bind(run.runId, item.sourcePath, item.cardId, item.sourceChecksum, item.result, JSON.stringify(item.details || {})));
    }
  }
  try {
    await db.batch(statements);
  } catch {
    throw new Failure(503, 'CONTENT_RESTORE_FAILED', 'The recovery snapshot could not be restored.');
  }
  return { schemaVersion: 1, restored: true, cards: cards.length, aliases: aliases.length, edges: edges.length, revisions: revisions.length, importRuns: runs.length };
}

export function decodeCursor(value) {
  if (!value) return '';
  try {
    const decoded = new TextDecoder().decode(Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), char => char.charCodeAt(0)));
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(decoded)) throw new Error('bad cursor');
    return decoded;
  } catch {
    throw new Failure(400, 'CURSOR_INVALID', 'The card catalog cursor is invalid.');
  }
}

export function encodeCursor(value) {
  const bytes = new TextEncoder().encode(value);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function assertSnapshotIntegrity(snapshot) {
  const checksum = await hash(JSON.stringify(snapshot));
  return checksum;
}
