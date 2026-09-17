import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const editorHtmlPath = path.join(rootDir, 'editor.html');
const shellHtmlPath = path.join(rootDir, 'custom-card-shell.html');

const content = fs.readFileSync(editorHtmlPath, 'utf8');

const bodyMatch = content.match(/<body[^>]*>/i);
if (!bodyMatch) {
    console.error('Could not find <body> tag in editor.html');
    process.exit(1);
}

const bodyStartIndex = bodyMatch.index + bodyMatch[0].length;
const scriptsIndex = content.indexOf('<!-- JAVASCRIPT MODULES -->');

if (scriptsIndex === -1) {
    console.error('Could not find <!-- JAVASCRIPT MODULES --> comment in editor.html');
    process.exit(1);
}

let shellMarkup = content.substring(bodyStartIndex, scriptsIndex).trim();

// On custom cards, the Viewer tab is active and Editor tab is inactive
shellMarkup = shellMarkup.replace(
    /<a href="card\.html\?viewer=1" class="hud-nav-link" id="nav-btn-viewer"/g,
    '<a href="card.html?viewer=1" class="hud-nav-link active" id="nav-btn-viewer" aria-current="page"'
);
shellMarkup = shellMarkup.replace(
    /<a href="editor\.html" class="hud-nav-link active"/g,
    '<a href="editor.html" class="hud-nav-link"'
);

fs.writeFileSync(shellHtmlPath, shellMarkup, 'utf8');
console.log(`Generated ${shellHtmlPath} (${shellMarkup.length} bytes)`);
