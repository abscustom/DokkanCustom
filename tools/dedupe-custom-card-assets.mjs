#!/usr/bin/env node
/**
 * Safely deduplicate identical image files inside each Custom Cards folder.
 * Default mode is a report only. Pass --apply only after reviewing its output.
 *
 * Usage:
 *   node tools/dedupe-custom-card-assets.mjs
 *   node tools/dedupe-custom-card-assets.mjs --root "C:\\...\\Custom Cards" --apply
 */
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultRoot = path.resolve(scriptDir, '..', '..', 'abscustom', 'Custom Cards');
const args = process.argv.slice(2);
const rootFlag = args.indexOf('--root');
const root = path.resolve(rootFlag >= 0 && args[rootFlag + 1] ? args[rootFlag + 1] : defaultRoot);
const apply = args.includes('--apply');
const imageExtension = /\.(?:avif|gif|jpe?g|png|webp)$/i;

const toPosix = value => value.split(path.sep).join('/');
const digestFile = async file => createHash('sha256').update(await fs.readFile(file)).digest('hex');
const fileExists = async file => fs.stat(file).then(() => true).catch(() => false);

async function imageFilesIn(folder) {
    const entries = await fs.readdir(folder, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
        const fullPath = path.join(folder, entry.name);
        if (entry.isDirectory()) files.push(...await imageFilesIn(fullPath));
        else if (entry.isFile() && imageExtension.test(entry.name)) files.push(fullPath);
    }
    return files;
}

function replaceReference(value, replacements) {
    if (typeof value === 'string') {
        let next = value;
        for (const [from, to] of replacements) {
            next = next.replaceAll(from, to).replaceAll(encodeURI(from), encodeURI(to));
        }
        return next;
    }
    if (Array.isArray(value)) return value.map(item => replaceReference(item, replacements));
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceReference(item, replacements)]));
    }
    return value;
}

async function processCardFolder(folder) {
    const files = await imageFilesIn(folder);
    const canonicalByHash = new Map();
    const duplicates = [];
    for (const file of files.sort()) {
        const hash = await digestFile(file);
        const canonical = canonicalByHash.get(hash);
        if (canonical) duplicates.push([file, canonical]);
        else canonicalByHash.set(hash, file);
    }
    if (!duplicates.length) return { files: files.length, duplicates: 0, updated: 0 };

    const replacements = duplicates.map(([from, to]) => [
        toPosix(path.relative(folder, from)),
        toPosix(path.relative(folder, to))
    ]);
    let updated = 0;
    const cardJson = path.join(folder, 'card.json');
    if (await fileExists(cardJson)) {
        const original = await fs.readFile(cardJson, 'utf8');
        try {
            const next = JSON.stringify(replaceReference(JSON.parse(original), replacements), null, 2) + '\n';
            if (next !== original) {
                updated += 1;
                if (apply) await fs.writeFile(cardJson, next);
            }
        } catch {
            console.warn(`Skipping malformed JSON: ${cardJson}`);
        }
    }

    const indexHtml = path.join(folder, 'index.html');
    if (await fileExists(indexHtml)) {
        const original = await fs.readFile(indexHtml, 'utf8');
        const next = replaceReference(original, replacements);
        if (next !== original) {
            updated += 1;
            if (apply) await fs.writeFile(indexHtml, next);
        }
    }

    for (const [from, to] of duplicates) {
        console.log(`${apply ? 'REMOVE' : 'WOULD REMOVE'} ${toPosix(path.relative(root, from))}  ->  ${toPosix(path.relative(root, to))}`);
        if (apply) await fs.unlink(from);
    }
    return { files: files.length, duplicates: duplicates.length, updated };
}

const entries = (await fs.readdir(root, { withFileTypes: true })).filter(entry => entry.isDirectory());
let total = { files: 0, duplicates: 0, updated: 0 };
for (const entry of entries) {
    const result = await processCardFolder(path.join(root, entry.name));
    total = Object.fromEntries(Object.keys(total).map(key => [key, total[key] + result[key]]));
}
console.log(`${apply ? 'Applied' : 'Dry run'}: ${total.duplicates} duplicate image file(s) across ${entries.length} card folder(s); ${total.updated} reference file(s) ${apply ? 'updated' : 'would be updated'}.`);
