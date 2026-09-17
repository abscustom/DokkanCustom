import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const customCardsDir = 'C:\\Users\\Ruffy\\Documents\\GitHub\\abscustom\\Custom Cards';

if (!fs.existsSync(customCardsDir)) {
    console.error(`Custom Cards directory not found at: ${customCardsDir}`);
    process.exit(1);
}

const entries = fs.readdirSync(customCardsDir, { withFileTypes: true });
const cardFolders = entries.filter(e => e.isDirectory() && !e.name.startsWith('.'));

console.log(`Found ${cardFolders.length} card folders in ${customCardsDir}`);

const escapeAttr = (str) => String(str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeText = (str) => String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

for (const folder of cardFolders) {
    const folderPath = path.join(customCardsDir, folder.name);
    const jsonPath = path.join(folderPath, 'card.json');
    const htmlPath = path.join(folderPath, 'index.html');
    const bakPath = path.join(folderPath, 'index.html.bak');

    if (!fs.existsSync(jsonPath)) {
        console.warn(`[Skip] No card.json found in ${folder.name}`);
        continue;
    }

    let cardData;
    try {
        cardData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    } catch (e) {
        console.error(`[Error] Failed to parse card.json in ${folder.name}:`, e);
        continue;
    }

    // Read existing HTML to extract original social preview tags if present
    let existingHtml = '';
    if (fs.existsSync(htmlPath)) {
        existingHtml = fs.readFileSync(htmlPath, 'utf8');
        // Create backup if not already backed up
        if (!fs.existsSync(bakPath)) {
            fs.writeFileSync(bakPath, existingHtml, 'utf8');
        }
    }

    const titleMatch = existingHtml.match(/<title>([^<]+)<\/title>/i);
    const ogImgMatch = existingHtml.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
    const descMatch = existingHtml.match(/<meta\s+name=["']description["'][^>]*content=["']([^"']+)["']/i);

    const rawName = cardData.inputs?.nameInput || 'Custom Card';
    const rawDesc = cardData.inputs?.descInput || '';
    const fullTitle = titleMatch ? titleMatch[1] : (rawDesc ? `[${rawDesc}] ${rawName}` : rawName);
    const previewImg = ogImgMatch ? ogImgMatch[1] : (cardData.cardArtImage || cardData.thumbMain || cardData.thumbLr || cardData.thumbTur || cardData.thumbSsr || '');
    const descText = descMatch ? descMatch[1] : (cardData.inputs?.leaderInput || rawDesc || '');

    const dynamicHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeText(fullTitle)}</title>

    <link rel="icon" type="image/png" href="https://abscustom.github.io/DokkanCustom/assets/ui/images/editor-favicon.png?v=1" sizes="48x48">
    <meta name="color-scheme" content="dark">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:site" content="@HarryTurney">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="abs Info">
    <meta name="application-name" content="Dokkan Info!">
    <meta itemprop="name" content="${escapeAttr(fullTitle)}">
    <meta property="og:title" content="${escapeAttr(fullTitle)}">
    <meta name="twitter:title" content="${escapeAttr(fullTitle)}">
    <meta name="apple-mobile-web-app-title" content="${escapeAttr(fullTitle)}">
    ${previewImg ? `<meta itemprop="image" content="${escapeAttr(previewImg)}">\n    <meta property="og:image" content="${escapeAttr(previewImg)}">\n    <meta name="twitter:image" content="${escapeAttr(previewImg)}">` : ''}
    ${descText ? `<meta name="description" id="meta-description" content="${escapeAttr(descText)}">\n    <meta itemprop="description" id="meta-itemprop-description" content="${escapeAttr(descText)}">\n    <meta property="og:description" id="meta-og-description" content="${escapeAttr(descText)}">\n    <meta property="twitter:description" id="meta-twitter-description" content="${escapeAttr(descText)}">` : ''}

    <script id="card-data" type="application/json">
${JSON.stringify(cardData, null, 2)}
    </script>
    <script>
        (function() {
            const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
            let src = 'https://abscustom.github.io/DokkanCustom/js/custom-card-bootstrapper.js';
            if (isLocal) {
                const p = decodeURIComponent(location.pathname);
                const idx = p.indexOf('/abscustom/');
                if (idx !== -1) {
                    src = p.substring(0, idx) + '/DokkanCustom/js/custom-card-bootstrapper.js';
                } else {
                    const isGrouped = p.includes('/Custom Cards/') || p.includes('/Custom%20Cards/');
                    src = isGrouped ? '../../../DokkanCustom/js/custom-card-bootstrapper.js' : '../../DokkanCustom/js/custom-card-bootstrapper.js';
                }
            }
            const s = document.createElement('script');
            s.src = src;
            s.onerror = function() {
                if (s.src !== 'https://abscustom.github.io/DokkanCustom/js/custom-card-bootstrapper.js') {
                    const fallback = document.createElement('script');
                    fallback.src = 'https://abscustom.github.io/DokkanCustom/js/custom-card-bootstrapper.js';
                    document.head.appendChild(fallback);
                }
            };
            document.head.appendChild(s);
        })();
    </script>
</head>
<body class="is-published theme-abs-style">
    <div id="abs-loading-screen" role="status" aria-label="Loading page" class="abs-loader-root" data-loader-ready-event="abs-card-content-ready" data-loader-ready-flag="absCardContentReady">
        <div class="abs-loader-bg-art" aria-hidden="true"><div class="abs-loader-art-backdrop"></div></div>
        <div class="abs-loader-bg-stars" aria-hidden="true"></div>
        <div class="abs-loader-bg-grid" aria-hidden="true"></div>
        <div class="abs-loader-bg-glass" aria-hidden="true"></div>
        <div class="abs-loader-art" aria-hidden="true"></div>
        <div class="abs-loader-stage">
            <img class="abs-loader-logo" src="https://abscustom.github.io/assets/images/abs_logo.png" alt="abs.clean logo" loading="eager" decoding="async">
            <div class="abs-loader-percent" id="abs-loader-percent" aria-live="polite">Loading...</div>
            <div class="abs-loader-sub" aria-hidden="true">custom card</div>
        </div>
    </div>
</body>
</html>`;

    fs.writeFileSync(htmlPath, dynamicHtml, 'utf8');
    const oldSize = existingHtml.length;
    const newSize = dynamicHtml.length;
    console.log(`[Migrated] ${folder.name}: ${oldSize} bytes -> ${newSize} bytes`);
}

console.log("Migration complete!");
