import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import '../js/published-card-guards.js';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultRoot = path.resolve(scriptDir, '..', '..', 'abscustom', 'Custom Cards');
const target = path.resolve(process.argv[2] || defaultRoot);

if (!fs.existsSync(target)) {
    throw new Error(`Published card path does not exist: ${target}`);
}

const htmlFiles = [];
function collectIndexFiles(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        if (entry.name.startsWith('.')) continue;
        const fullPath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            collectIndexFiles(fullPath);
        } else if (entry.isFile() && entry.name.toLowerCase() === 'index.html') {
            htmlFiles.push(fullPath);
        }
    }
}

if (fs.statSync(target).isFile()) htmlFiles.push(target);
else collectIndexFiles(target);
if (!htmlFiles.length) throw new Error(`No index.html files found under: ${target}`);

let inlineScriptCount = 0;
const failures = [];
for (const htmlPath of htmlFiles) {
    const html = fs.readFileSync(htmlPath, 'utf8');
    try {
        inlineScriptCount += globalThis.assertGeneratedInlineScripts(html, path.relative(target, htmlPath));
    } catch (error) {
        failures.push(`${path.relative(target, htmlPath)}: ${error.message}`);
    }
}

if (failures.length) {
    console.error(`Inline JavaScript validation failed for ${failures.length} page(s):\n${failures.join('\n')}`);
    process.exitCode = 1;
} else {
    console.log(`Validated ${htmlFiles.length} published card pages and ${inlineScriptCount} inline JavaScript blocks.`);
}
