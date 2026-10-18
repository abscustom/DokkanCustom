# Manager GitHub sign-in

Deployed by Planner ASTRA on October 16, 2026 with explicit human authorization. Latest diagnostic version: `de62d222-1368-4d20-9e08-5097a1c2579b` (previous diagnostic: `9085ce5e-f77a-4fbd-af7f-f45eddcb3c7c`; initial: `aca72150-6c65-4544-be0d-03cd6119891e`).

Live Manager: https://abs-manager-auth.trashullu.workers.dev/manager

The initial deployment uploaded 30 allowlisted assets and configured `MANAGER_SERVICE` (SQLite Durable Object) and `DB`. The latest diagnostic deployment updated only the Worker backend; it did not upload assets. Both required secret names exist as `secret_text`; secret values were not read. The GitHub Pages website source has not been pushed or published, so its public Manager entry may still use the previous flow.

Planner's read-only live proof passed at desktop 1280 and mobile 390 pixels with no page errors, missing files or overflow. `/manager.html` redirects with 307 to `/manager`, which returns 200. Unauthenticated `/api/session` returns 401; an invalid-state callback returns 400. `/auth/start` returns 302 with the configured GitHub client, callback, state and S256 PKCE, plus a bound HttpOnly/Secure/SameSite=Lax cookie. Evidence script: `C:/Users/Ruffy/AppData/Local/Temp/abs-manager-live-proof.mjs`.

Actual GitHub account authorization, authenticated catalog loading, permission checks with the real App, token refresh and production capacity remain unverified. The human must sign in to continue that validation. No production card links, writes or deletions were performed during deployment verification.

After diagnostic version `9085ce5e-f77a-4fbd-af7f-f45eddcb3c7c`, a fresh `/auth/start` state was completed with a deliberately invalid dummy code. The callback returned the fixed `OAUTH_TOKEN_CODE_REJECTED` response and Manager remained healthy (`/manager` returned 200). This confirms the token endpoint is reachable and the rejection path works; it does not prove a real OAuth exchange or session creation. The binding cookie stayed in memory and no card writes were made.

After the latest backend-only deployment `de62d222-1368-4d20-9e08-5097a1c2579b`, limited smoke checks returned `/manager` 200 and a sanitized invalid-state callback 400. A fresh real sign-in is still required to identify the failing account/repository/App authorization stage. No valid OAuth session or authenticated catalog access has been verified.

## Runtime and security boundary

Serve Manager and its API at `https://abs-manager-auth.trashullu.workers.dev`. The prepared Pages source routes Manager there; that website change remains unpublished. It does not send authenticated cross-origin requests. Only allowlisted Manager assets are packaged. Published card HTML and the Editor never run on this origin.

The HTTP Worker streams API/auth requests to the bound SQLite-backed `ManagerService` Durable Object. It serializes requests for the fixed repository. Cloudflare documents SQLite Durable Objects on Workers Free, with a default 30-second CPU allowance per invocation. This avoids putting legacy HTML transformations under the HTTP Worker's 10 ms CPU allowance. No paid CPU setting is used. Free quota exhaustion can still reject requests; local timings do not prove production capacity.

Official references: [DO limits](https://developers.cloudflare.com/durable-objects/platform/limits/), [DO Free quotas](https://developers.cloudflare.com/durable-objects/platform/pricing/), [Worker limits](https://developers.cloudflare.com/workers/platform/limits/).

GitHub App expiring user tokens stay encrypted with AES-GCM in D1. Browser cookies contain opaque session IDs, with HttpOnly, Secure, SameSite=Lax and bounded expiry. OAuth uses browser-bound one-time state and S256 PKCE. Writes require the exact Manager Origin and CSRF token, the configured numeric user ID, current repository push permission, and current App installation Contents write access. Deletion has a separate allowlist and exact folder-name confirmation.

Only `abscustom/abscustom.github.io`, branch `main`, and semantic Manager operations are supported. Clients cannot submit repository paths, HTML, Git trees, arbitrary API URLs, or branch names. Commits use the initial snapshot parent and a non-forced ref update. Concurrent external edits fail instead of being overwritten. No mutation is automatically retried.

Editor token storage/import sanitization is separate work. Isolating Manager keeps Pages imported markup from accessing this session; it does not fix the existing Editor stored-XSS finding or eliminate all possible Manager-origin XSS risks.

## Public configuration

The tracked `wrangler.jsonc` contains only public IDs:

- Worker: `abs-manager-auth`
- Manager origin: `https://abs-manager-auth.trashullu.workers.dev`
- GitHub App client ID: `Iv23li6k5Jp0Nx4C8c5c`
- Target repository ID: `1144608552`
- Admin and delete user ID: `257864199` (`abscustom`), explicitly confirmed by the human
- D1 database: `abs-manager-sessions`, ID `11a072e9-9f6f-4bf1-bfa6-cb89bf4bccd6`, binding `DB`
- SQLite Durable Object binding: `MANAGER_SERVICE`, class `ManagerService`, migration tag `v1-manager-service`

GitHub App homepage: the Manager origin plus `/manager.html`. Callback: the same origin plus `/auth/callback`. Enable expiring user access tokens. Install the App only on the target repository, with Contents read/write and Metadata read. No App private key is needed for this user-token flow.

## Private configuration

Set these only as Cloudflare Worker secrets; never paste their values into chat or tracked files:

- `GITHUB_CLIENT_SECRET`: the GitHub App client secret.
- `TOKEN_ENCRYPTION_KEY`: 32 cryptographically random bytes encoded as base64url. Generate privately, for example using Node's `crypto.randomBytes(32).toString('base64url')` in a private terminal. Key rotation invalidates existing encrypted sessions unless separately migrated.

The human reported the client secret, D1 binding, and D1 SQL creation completed. Planner subsequently confirmed both required secret names exist in Production without reading their values. The human has since confirmed a real sign-in to the existing Manager flow succeeded. Website-wide profile authentication described below is a separate local implementation and has not been migrated or deployed.

## Website profile authentication (local backend implementation)

Website profile authentication uses the existing GitHub App callback `/auth/callback`; it does not require a second callback registration. The full-page flow starts at `GET /profile/start?origin=<allowlisted-origin>&challenge=<S256>&nonce=<random>&callback=project|root`. Production returns only to `/DokkanCustom/profile-callback.html`; local preview paths are fixed by the callback mode. The browser exchanges the 60-second, one-use ticket with `POST /profile/exchange` and keeps only the returned scoped profile handle in `sessionStorage`. `GET /profile/me` and `POST /profile/logout` use that handle as a Bearer token with credentialless, exact-origin CORS. The bearer token never authenticates Manager endpoints.

Regular GitHub accounts use only the GitHub identity endpoint and do not need repository or App permissions. The server derives `member`/`admin` from the numeric allowlist on each profile read. Admin profile sign-in independently runs the existing Manager authorization gates; only success creates the current encrypted Manager session and its first-party HttpOnly cookie. A restricted Manager account can still receive a website profile. Profile logout revokes its handle and that user’s Manager sessions; Manager logout revokes that user’s profile handles. No provider token or Manager cookie is returned to website JavaScript.

Allowed website origins are `https://abscustom.github.io`, `http://localhost:3000`, `http://127.0.0.1:3000`, `http://localhost:4173`, and `http://127.0.0.1:4173`. The additive migration `0003_profile_accounts.sql` preserves existing Manager sessions. This backend implementation is local only: do not deploy it until migration `0003` is applied and the separately owned website callback/navigation integration is ready and reviewed.

## Setup and local checks

1. Confirm existing D1 migrations `0001_sessions.sql` and `0002_card_metadata.sql` are applied. Before releasing the local profile implementation, apply `0003_profile_accounts.sql` as a reviewed, separate migration; it must precede code that uses the new tables.
2. Confirm the five public variables and both private secrets on the same Production Worker.
3. From this service directory, install pinned dependencies using `npm ci --ignore-scripts`.
4. From the repository root run `node tools/build-manager-worker-assets.mjs`. The builder creates a fresh exact allowlisted asset set.
5. From this service directory run `npx --no-install wrangler deploy --dry-run`. This builds only; it does not deploy. The initial real deployment must include the SQLite class migration/binding in `wrangler.jsonc`; pasting only a single generated JavaScript file into the dashboard is insufficient.
6. For future deployments obtain explicit deployment direction after review. The initial deployment is recorded above; these local commands do not themselves deploy. Production card mutations were not used as verification.

Tests from the service directory:

```text
node --test test/worker.test.mjs test/transforms.test.mjs test/profile.test.mjs
node test/browser-proof.mjs
node test/real-card-proof.mjs
node test/runtime-proof.mjs
```

Tests from the repository root:

```text
node --test tools/manager-auth-client.test.mjs
node tools/test-custom-card-links.mjs
```

## Local card-content import and recovery

The card-content pilot uses a separate SQLite/D1 schema. These commands target only a local SQLite file; they never use Wrangler, Cloudflare bindings, or the auth database.

The default `wrangler.jsonc` keeps only the existing Manager auth database. `CONTENT_DB` is declared in `wrangler.content-local.jsonc` with a local-only sentinel ID, so normal deploy configuration does not point at an unprovisioned content database. Use `--config wrangler.content-local.jsonc` and `--local` for local Worker and D1 checks; do not deploy with the local config. Add the real content database binding to production only during separately approved provisioning.

```text
node tools/content-maintenance.mjs dry-run --source "G:/GitHub/abscustom/Custom Cards" --bundle ./content-import.json --backup-dir ./content-source-backup
node tools/content-maintenance.mjs apply --db ./content-local.sqlite --bundle ./content-import.json
node tools/content-maintenance.mjs export --db ./content-local.sqlite --output ./content-recovery.json
node tools/content-maintenance.mjs materialize --snapshot ./content-recovery.json --output-dir ./content-compatible-recovery
node tools/content-maintenance.mjs rollback --db ./content-local.sqlite --snapshot ./content-recovery.json
node tools/content-maintenance.mjs rollback --db ./content-local.sqlite --snapshot ./content-recovery.json --apply
node tools/content-local-diagnostics.mjs
```

`materialize` requires a snapshot exported after the latest edits, links, and archive changes. It writes legacy `card.json` data and dynamic-bootstrap index pages for published cards, plus unavailable pages and status tombstone `card.json` files for drafts and archived cards. The materialization manifest lists published and unavailable IDs for an overlay release. Its output path must be a new local directory; it never overwrites an existing directory.

`content-local-diagnostics.mjs` seeds an in-memory SQLite database from the current source inventory and reports statement, row, changed-row, SQL parameter/result, request/response, and SQLite page-storage counts for one catalog, detail, save, link, and archive operation. These are local SQLite diagnostic counts, not Cloudflare D1 billed-row or CPU measurements.

For local Worker packaging, run `npx --no-install wrangler deploy --config wrangler.content-local.jsonc --dry-run`. For a local Wrangler D1 schema check, run `npx --no-install wrangler d1 migrations apply abs-card-content-local --local --config wrangler.content-local.jsonc`. Do not add `--remote` or deploy with the local config.

Dry-run writes no files unless `--bundle` or `--backup-dir` is provided. Bundle, backup, and export destinations must be new paths. Rollback previews replacement counts unless `--apply` is supplied. Apply and rollback execute their content changes in one local SQLite transaction. Preserve the source backup and recovery export before using a local rollback.

`node --test test/content.test.mjs test/content-maintenance.test.mjs` verifies the real 14-card source import, sanitized passive-editor controls, protected API routes, import retry behavior, local snapshot recovery, and file-compatible materialization.

Browser tests use a synthetic HTTP bridge, in-memory D1 and an intercepted GitHub provider. All authorization redirects in the final harness are local. Real-card proof reads published files without modifying them and compares server HTML/JSON output against Chromium byte for byte. `MANAGER_PUBLISHED_CARDS` can override the default local published directory. Runtime smoke uses local workerd/Miniflare, local SQLite DO and D1; external requests are forbidden.

## Dataset and operation limits

The catalog caches metadata by immutable HTML blob SHA plus folder path. A cold `GET /api/cards` processes one card and can return `202 {pending,processed,total,retryAfterMs}`; only this GET is polled, with a client deadline. Changed repository snapshots missing cached metadata return `CARDS_CHANGED` and require reload. Cached metadata is not a second export format or authority.

HTML edits mask large embedded media data URLs temporarily and restore their exact bytes before saving. The shared transformation implementation is `js/manager-card-transforms.js`; the service supplies an inert HTML5 DOM/serializer adapter. It does not execute card scripts or fetch their resources. HTTPS portraits are restricted to the published site; bounded PNG/JPEG/WebP/GIF data portraits are also supported for existing legacy cards.

Current bounds: 100 discovered card folders, 4 MiB per read blob, 12 submitted operations, 16 MiB generated batch text, 42 GitHub calls per request, 16 KiB API request body. Requests that exceed a limit fail clearly. No partial branch update is performed; unreachable Git objects can exist after a rejected final ref update. The current 14 published cards were verified within these compatibility bounds. Larger future datasets may require revisiting pagination/batch limits.

## Verification status and known limits

- Backend/golden/profile tests: 20 pass locally, including idempotent migration preservation.
- Auth client tests: 6 pass.
- Existing JSON linker/category regression: pass.
- Actual Manager browser flow at 1280 and 390 pixels: pass, no page errors, missing files or overflow; two synthetic commits per viewport, zero real writes.
- Real published library: 14/14 full HTML and JSON outputs match Chromium; all input files unchanged.
- Local workerd: SQLite DO routing, fail-closed missing secrets, D1 migrations and security headers pass; external requests zero.
- Existing Manager browser proof: desktop 1280 and mobile 390 pass with no page errors, missing files, overflow, or real GitHub writes.
- Local `wrangler deploy --dry-run`: pass; no remote migration or deployment was performed.
- Final Free configuration dry run: pass; no `cpu_ms` increase. Planner subsequently performed the explicitly authorized deployment recorded above.
- Live unauthenticated desktop/mobile, routing, OAuth-start parameters/cookie and error checks: pass, as reported by Planner. Diagnostic version `9085ce5e-f77a-4fbd-af7f-f45eddcb3c7c` returned `OAUTH_TOKEN_CODE_REJECTED` for a dummy code. Latest deployed version `de62d222-1368-4d20-9e08-5097a1c2579b` passed limited `/manager` and sanitized invalid-state checks; the human subsequently confirmed the existing Manager GitHub login worked. The local profile API and migration are not deployed, and website profile sign-in remains unverified.

Evidence: `docs/abs-refresh/reports/manager-auth-evidence/` in the main repository. Local Node timings are diagnostic only; production latency, quota consumption, App permissions and real OAuth credentials still require user-directed post-deployment validation.

GitNexus impact was attempted before restructuring. Its native database dependency failed with `spawnSync C:\WINDOWS\system32\cmd.exe ENOENT`; the graph remains unresolved, not a low-risk result. Targeted source/loader inspection and executable parity checks supplement that limitation. Refresh the index when its runtime is repaired. No commit or push was performed.
