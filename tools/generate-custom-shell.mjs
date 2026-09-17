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

const shellMarkup = content.substring(bodyStartIndex, scriptsIndex).trim();

fs.writeFileSync(shellHtmlPath, shellMarkup, 'utf8');
console.log(`Generated ${shellHtmlPath} (${shellMarkup.length} bytes)`);
