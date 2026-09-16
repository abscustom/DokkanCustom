# Asset folders

- `card-art/cards/` — character art, cut-ins, circles, and card animation packs, grouped by card ID.
- `card-art/backgrounds/` — card backgrounds and their animation textures.
- `card-art/thumbnails/` — small card portraits.
- `card-art/skins/` — alternate card skins.
- `card-art/stickers/` — sticker textures.
- `super-attacks/battle/` — super attack banners and their animation pack.
- `effects/domains/` — domain backgrounds and animations.
- `effects/dokkan-mode/` — Dokkan mode animation.
- `effects/dokkan-mode-lightning/` — Dokkan mode lightning animation.
- `effects/super-eza/` — Super EZA effects.
- `audio/sound-effects/` — sound effect files.
- `ui/images/` — locally stored interface images.
- `ui/loading-screen/` — loading screen artwork and its source files.
- `ui/type-arrows/` — type arrow icons and animations.
- `news/discord/` — downloaded news images.

Keep each `.lwf` animation beside its textures, with the original filenames and subfolders. Card packs also contain attack cut-ins and text; these stay with their card ID so the loaders can find the complete pack.

The hidden `.sync_manifest.json` records imported files. Its output paths are relative to this folder. Any external import tool must use this layout for future imports.

The animation server in `tools/dokkan-animation-server.mjs` uses a separate game asset directory (configured with `DOKKAN_ASSETS_ROOT`), which retains its original game layout. Third-party asset URLs also retain their original paths.
