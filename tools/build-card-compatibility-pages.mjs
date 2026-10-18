import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

// Generate into a NEW review directory only. This never opens the published tree.
export async function buildCompatibilityPages(bundle, outputDirectory) {
    if (bundle?.schemaVersion !== 1 || bundle.kind !== 'dokkan-custom-card-content-import' || bundle.status !== 'ready' || !Array.isArray(bundle.cards) || !Array.isArray(bundle.aliases)) {
        throw new Error('Provide a ready, version 1 import bundle.');
    }
    const output = path.resolve(outputDirectory), cards = new Map(bundle.cards.map(card => [card.id, card]));
    const pages = new Map();
    for (const alias of bundle.aliases) {
        const card = cards.get(alias.cardId);
        if (!card || card.status !== 'published') throw new Error('Compatibility aliases must reference published imported cards.');
        const decoded = decodeURIComponent(alias.path);
        if (!decoded.startsWith('/') || decoded.startsWith('//') || /[\\?#\u0000-\u001f]/.test(decoded) || decoded.split('/').some(part => part === '.' || part === '..')) throw new Error('Unsafe compatibility alias.');
        const relative = decoded.slice(1).replace(/\/$/, '') + (decoded.endsWith('/index.html') ? '' : '/index.html');
        const destination = path.resolve(output, relative);
        if (!destination.startsWith(output + path.sep)) throw new Error('Compatibility output escapes review directory.');
        const prior = pages.get(relative);
        if (prior && prior.cardId !== card.id) throw new Error('Two aliases resolve to different cards at the same output path.');
        const viewer = new URL('https://abscustom.github.io/DokkanCustom/custom-card.html');
        viewer.searchParams.set('id', card.id);
        const target = viewer.href;
        const html = `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(card.name)}</title><link rel="canonical" href="${escape(target)}"><meta http-equiv="refresh" content="0;url=${escape(target)}"></head><body><p>Opening ${escape(card.name)}… <a href="${escape(target)}">Continue to card</a></p><script>location.replace(${JSON.stringify(target).replace(/</g, '\\u003c')}+location.hash);</script></body></html>\n`;
        pages.set(relative, { cardId: card.id, assetBase: card.assetBase, html, aliases: [...(prior?.aliases || []), alias.path] });
    }
    // Fail before writing any output if the destination already exists.
    await fs.mkdir(output, { recursive: false });
    const manifest = { schemaVersion: 1, sourceChecksum: bundle.sourceChecksum, generatedAt: new Date().toISOString(), aliasCount: bundle.aliases.length, pages: [] };
    for (const [relative, page] of pages) {
        const target = path.join(output, relative);
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.writeFile(target, page.html, { flag: 'wx' });
        manifest.pages.push({ path: relative.replaceAll(path.sep, '/'), cardId: page.cardId, assetBase: page.assetBase, aliases: page.aliases });
    }
    await fs.writeFile(path.join(output, 'compatibility-manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
    return manifest;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    const args = process.argv.slice(2);
    if (args.length !== 4 || args[0] !== '--bundle' || args[2] !== '--output-dir') throw new Error('Usage: node tools/build-card-compatibility-pages.mjs --bundle FILE --output-dir NEW_REVIEW_DIRECTORY');
    const manifest = await buildCompatibilityPages(JSON.parse(await fs.readFile(args[1], 'utf8')), args[3]);
    console.log(JSON.stringify({ aliasCount: manifest.aliasCount, pageCount: manifest.pages.length, sourceChecksum: manifest.sourceChecksum, outputDirectory: path.resolve(args[3]) }, null, 2));
}
