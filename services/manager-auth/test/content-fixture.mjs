import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { fixture as authFixture } from './fixture.mjs';
import { createLocalSqliteBinding } from '../src/local-sqlite-binding.mjs';

export function contentFixture({ contentMetrics = null } = {}) {
  const auth = authFixture();
  const contentSql = new DatabaseSync(':memory:');
  contentSql.exec(fs.readFileSync(new URL('../content-migrations/0001_card_content.sql', import.meta.url), 'utf8'));
  auth.env.CONTENT_DB = createLocalSqliteBinding(contentSql, { metrics: contentMetrics });
  auth.env.CONTENT_WRITES_ENABLED = 'true';
  return Object.assign(auth, { contentSql });
}
