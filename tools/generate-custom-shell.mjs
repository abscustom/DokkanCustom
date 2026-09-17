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

// On custom cards, the Viewer tab is active and toggles the card picker popover, while Editor tab is inactive
const viewerBtnMarkup = `<button type="button" class="hud-nav-link active" id="nav-btn-viewer" onclick="window.toggleViewerCardPicker ? window.toggleViewerCardPicker() : null" aria-expanded="false" aria-controls="viewer-card-picker" aria-haspopup="dialog" aria-label="Viewer card picker" aria-current="page" title="Click to choose a viewer card">
                        <svg class="hud-nav-svg" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                            <path d="M2.5 12S5.9 6 12 6s9.5 6 9.5 6-3.4 6-9.5 6-9.5-6Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            <circle cx="12" cy="12" r="2.5" stroke="currentColor" stroke-width="2"/>
                        </svg>
                        <span>Viewer</span>
                        <svg class="viewer-nav-cue" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                            <path d="m4 10 4-4 4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </button>`;

shellMarkup = shellMarkup.replace(
    /<a href="card\.html\?viewer=1" class="hud-nav-link" id="nav-btn-viewer"[\s\S]*?<\/a>/,
    viewerBtnMarkup
);
shellMarkup = shellMarkup.replace(
    /<a href="editor\.html" class="hud-nav-link active"/g,
    '<a href="editor.html" class="hud-nav-link"'
);

// Inject #viewer-card-picker right after </header>
const pickerSection = `
    <!-- COMPACT VIEWER CARD SWITCHER (OPENS UP FROM THE VIEWER TAB) -->
    <section id="viewer-card-picker" class="viewer-card-picker" hidden aria-hidden="true" role="dialog" aria-label="Choose viewer card">
        <label class="viewer-card-picker-search" for="viewer-card-picker-input">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2"/>
                <path d="m20 20-4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
            <input id="viewer-card-picker-input" type="search" placeholder="Search cards by name or ID" autocomplete="off">
        </label>
        <div id="viewer-card-picker-results" class="viewer-card-picker-results" role="listbox" aria-label="Viewer cards"></div>
    </section>
`;

shellMarkup = shellMarkup.replace(/(<header class="apple-hud-wrapper">[\s\S]*?<\/header>)/, `$1\n${pickerSection}`);

fs.writeFileSync(shellHtmlPath, shellMarkup, 'utf8');
console.log(`Generated ${shellHtmlPath} (${shellMarkup.length} bytes)`);
