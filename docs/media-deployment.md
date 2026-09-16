# Media deployment

The static site and the game-media service are separate deployments.

## Public site

Deploy the tracked website files and the public asset layout under `assets/`.
Card art, LWF packs, dot characters, and UI art are browser files and remain
part of the site. The four calculator super-attack banner PNGs and the shared
`battle_140000` LWF/texture bundle are also public browser UI assets. Game
character battle packs and audio are private runtime media; they are not
static-site deployment inputs.

The CardHub Console is the source of truth for publishing data and public
assets. Its `tools/asset-publish-layout.js` refuses `ingame`, `battle`,
`movie`, `lua`, `se`, `voice`, `super-attacks`, `audio`, `local-hosting`,
`temporary`, and `backups` paths, including `.cpk`, `.usm`, `.acb`, `.awb`,
and `.lua` files. Do not use the old `cardhub v2` workspace as a publish
source. Console publishing maps approved staging assets into this repository's
current `assets/` layout and leaves existing GitHub files alone.

## Private animation service

The authoritative service is the relocated Console copy:
`C:\Users\Ruffy\Desktop\CardHub Console\tools\dokkan-animation-server.mjs`.
It serves the original game layout from Console `local-hosting/assets` (through
its configured `DOKKAN_ASSETS_ROOT`) on `http://127.0.0.1:3137` and is exposed
to deployed clients at `https://mollusk-fanfare-although.ngrok-free.dev`.

`tools/dokkan-animation-server.mjs` in this repository is a development/legacy
copy. Its default root still points to `C:/Users/Ruffy/Desktop/cardhub v2`; do
not start it for production unless every `DOKKAN_*` path is explicitly
configured to the Console runtime. The Console tray launcher is the supported
way to start the port-3137 server and its Ngrok tunnel. There is no
`start-animation-server.cmd` at the repository root or under `tools/`; the
supported launcher is `tools/dokkan-tray-runner.ps1` in CardHub Console.

### Current media availability status (2026-09-16)

- `http://127.0.0.1:3137/health` refused the connection, so the local service
  is not running or is not bound to port 3137.
- `https://mollusk-fanfare-although.ngrok-free.dev/health` returned HTTP 404.
  The configured tunnel therefore does not currently expose the Console health
  endpoint.

This is a live-media availability issue, not a static-site deployment blocker
once the frontend removes unavailable idle/SA controls and reflows its header.
Start/restart the Console tray service when live animation playback is required.

The calculator's four banner PNGs and `battle_140000` LWF/texture bundle are
referenced by `calculator.html` and `js-calc`. `.gitignore` explicitly
re-includes only those 14 static UI files under `assets/super-attacks/battle/`,
so they can deploy like dot-character LWF assets. All other character
super-attack packs remain private Console media.

## Release checklist

1. Publish only through CardHub Console and confirm its local-only media gate
   passes.
2. Confirm the public static site loads without local filesystem URLs.
3. For live media playback, start the Console tray service and verify both
   `/health` endpoints: local port 3137 and the Ngrok URL.
4. Test a card with idle and super-attack media from the deployed site. Then
   stop the service or test an unavailable pack and confirm the UI removes the
   idle panel and its play controls without leaving a header gap.
5. Before committing, ensure generated game media, caches, decrypted database,
   Console backups, and logs remain ignored. Existing tracked public assets are
   intentionally not removed by `.gitignore`.

## Current audit

At audit time, the repository contained **0 tracked** and **0 staged** files
within the Console local-only path set. The worktree does contain many pending
card-art additions and 14 calculator UI assets; these require normal review
before release. Local-only audio content remains excluded from the worktree's
deployable file set.
