import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import '../js/published-card-guards.js';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultRoot = path.resolve(scriptDir, '..', '..', 'abscustom', 'Custom Cards');
const cardsRoot = path.resolve(process.argv[2] || defaultRoot);
const expectedCount = Number(process.argv[3] || 14);
const oldVersion = '20260927-clean-motion-update-v17';
const newVersion = '20260928-custom-no-motion-v1';

if (!fs.existsSync(cardsRoot)) throw new Error(`Published card directory does not exist: ${cardsRoot}`);

function collectIndexFiles(directory) {
    const files = [];
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        if (entry.name.startsWith('.')) continue;
        const fullPath = path.join(directory, entry.name);
        if (entry.isDirectory()) files.push(...collectIndexFiles(fullPath));
        else if (entry.isFile() && entry.name.toLowerCase() === 'index.html') files.push(fullPath);
    }
    return files;
}

function findScriptBlocks(html) {
    const blocks = [];
    const pattern = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
    let match;
    while ((match = pattern.exec(html))) {
        blocks.push({ full: match[0], attributes: match[1] || '', source: match[2] || '', index: match.index });
    }
    return blocks;
}

function findCardDataBlock(html) {
    return findScriptBlocks(html).find(block => /\bid\s*=\s*(?:"card-data"|'card-data'|card-data)(?:\s|$)/i.test(block.attributes))?.full || null;
}

function hasTargetQuoteCorruption(source) {
    return source.includes(oldVersion) && new RegExp(`${oldVersion}(?:\\s*[;:)])`).test(source);
}

const plans = [];
for (const filePath of collectIndexFiles(cardsRoot)) {
    const before = fs.readFileSync(filePath, 'utf8');
    const blocks = findScriptBlocks(before);
    const bootstrapBlock = blocks.find(block => block.source.includes('custom-card-bootstrapper.js'));
    let broken = false;
    try {
        globalThis.assertGeneratedInlineScripts(before, path.relative(cardsRoot, filePath));
    } catch (error) {
        broken = true;
        if (!bootstrapBlock || !hasTargetQuoteCorruption(bootstrapBlock.source)) {
            throw new Error(`Unrecognized inline script failure in ${filePath}: ${error.message}`);
        }
    }

    if (!bootstrapBlock || !hasTargetQuoteCorruption(bootstrapBlock.source)) {
        if (broken) throw new Error(`Could not locate the corrupt bootstrap block in ${filePath}`);
        continue;
    }

    let repairedSource = bootstrapBlock.source.replace(
        new RegExp(`(${oldVersion})(\\s*)(?=[;:)])`, 'g'),
        `$1'$2`
    );
    const repairedQuoteCount = (repairedSource.match(new RegExp(`${oldVersion}'(?=\\s*[;:)])`, 'g')) || []).length;
    if (!repairedQuoteCount) throw new Error(`No missing bootstrap URL quotes were repaired in ${filePath}`);
    repairedSource = repairedSource.replaceAll(oldVersion, newVersion);

    const repairedBootstrapBlock = bootstrapBlock.full.replace(bootstrapBlock.source, repairedSource);
    let after = before.slice(0, bootstrapBlock.index)
        + repairedBootstrapBlock
        + before.slice(bootstrapBlock.index + bootstrapBlock.full.length);

    if (!after.includes('id="abs-published-loader-watchdog"')) {
        const lineEnding = before.includes('\r\n') ? '\r\n' : '\n';
        const watchdog = `<script id="abs-published-loader-watchdog">${lineEnding}${globalThis.buildPublishedLoaderWatchdogScript().replace(/\r?\n/g, lineEnding)}${lineEnding}    </script>${lineEnding}    `;
        const bootstrapOffset = after.indexOf(repairedBootstrapBlock);
        after = after.slice(0, bootstrapOffset) + watchdog + after.slice(bootstrapOffset);
    }

    if (findCardDataBlock(before) !== findCardDataBlock(after)) {
        throw new Error(`Embedded card JSON changed unexpectedly in ${filePath}`);
    }
    globalThis.assertGeneratedInlineScripts(after, path.relative(cardsRoot, filePath));
    plans.push({ filePath, before, after, repairedQuoteCount });
}

if (plans.length !== expectedCount) {
    throw new Error(`Expected ${expectedCount} repairable page(s), found ${plans.length}; no files were changed.`);
}

for (const plan of plans) fs.writeFileSync(plan.filePath, plan.after, 'utf8');
console.log(`Repaired ${plans.length} published pages; restored ${plans.reduce((sum, plan) => sum + plan.repairedQuoteCount, 0)} URL quotes. Embedded card JSON was preserved.`);
