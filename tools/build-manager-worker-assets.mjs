import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const managerServiceRoot = path.resolve(repositoryRoot, 'services', 'manager-auth');
const publicDirectory = path.resolve(managerServiceRoot, 'public');
const managerAssets = [
    'manager.html',
    'password-signin.html',
    'js/password-signin.js',
    'card-publisher.html',
    'js/card-content-publisher.js',
    'js/card-content-config.js',
    'assets/navigation/sidebar/200254.png',
    'assets/navigation/sidebar/equ_icon_same_chara.png',
    'assets/navigation/sidebar/equ_icon_specific_chara.png',
    'assets/navigation/sidebar/myp_icon_campaign.png',
    'assets/navigation/sidebar/myp_dragon_radar.png',
    'assets/navigation/sidebar/sugoroku_jewel_small_0072.png',
    'assets/navigation/sidebar/support_memory_enh_lv_base.png',
    'assets/navigation/sidebar/thumb_support_item_01910.png',
    'assets/navigation/sidebar/thumb_support_item_90001.png',
    'css/style.css',
    'css/tool-sba-nav.css',
    'css/other-tools.css',
    'css/other-tool-pages.css',
    'css/ui-toast.css',
    'css/editor-ui.css',
    'css/card-admin.css',
    'css/manager.css',
    'css/abs-navigation.css',
    'css/abs-profile.css',
    'js/manager-auth-config.js',
    'js/abs-profile-config.js',
    'js/abs-profile.js',
    'js/manager-auth-client.js',
    'js/manager-shell-state.js',
    'js/manager-card-transforms.js',
    'js/favicon.js',
    'js/ui-toast.js',
    'js/published-card-guards.js',
    'js/manager-linker-coins.js',
    'js/other-nav.js',
    'js/abs-navigation.js',
    'js-editor/21-card-admin.js'
];

const checkOnly = process.argv.includes('--check');
const bundledAssetPaths = new Set(managerAssets.map(normalizeAssetPath));
const missing = [];
for (const relativePath of managerAssets) {
    const sourcePath = path.resolve(repositoryRoot, relativePath);
    if (!sourcePath.startsWith(`${repositoryRoot}${path.sep}`) || !(await exists(sourcePath))) {
        missing.push(relativePath);
    }
}

if (missing.length) {
    throw new Error(`Manager Worker source files are missing: ${missing.join(', ')}`);
}

await validateLocalReferences();

if (checkOnly) {
    await verifyExistingPublicBundle();
    process.stdout.write(`Validated ${managerAssets.length} Manager Worker asset sources.\n`);
} else {
    await removeStalePublicAssets();
    for (const relativePath of managerAssets) {
        const sourcePath = path.resolve(repositoryRoot, relativePath);
        const destinationPath = path.resolve(publicDirectory, relativePath);
        if (!isWithin(publicDirectory, destinationPath) || destinationPath === publicDirectory) {
            throw new Error(`Refusing to write an asset outside the Worker public directory: ${relativePath}`);
        }
        await fs.mkdir(path.dirname(destinationPath), { recursive: true });
        await fs.copyFile(sourcePath, destinationPath);
    }
    await verifyExistingPublicBundle();
    process.stdout.write(`Copied ${managerAssets.length} Manager Worker assets to services/manager-auth/public.\n`);
}

async function exists(filePath) {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

async function validateLocalReferences() {
    const references = [];
    for (const htmlPath of managerAssets.filter(asset => asset.endsWith('.html'))) {
        const html = await fs.readFile(path.join(repositoryRoot, htmlPath), 'utf8');
        for (const match of html.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)) {
            const assetPath = localReference(match[1]);
            if (assetPath) references.push({ from: htmlPath, path: assetPath });
        }
    }

    for (const cssPath of managerAssets.filter(asset => asset.endsWith('.css'))) {
        const css = await fs.readFile(path.join(repositoryRoot, cssPath), 'utf8');
        for (const match of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) {
            const assetPath = localReference(match[1], path.posix.dirname(cssPath));
            if (assetPath) references.push({ from: cssPath, path: assetPath });
        }
        for (const match of css.matchAll(/@import\s+(?:url\()?\s*["']([^"']+)["']/gi)) {
            const assetPath = localReference(match[1], path.posix.dirname(cssPath));
            if (assetPath) references.push({ from: cssPath, path: assetPath });
        }
    }

    const unbundled = references.filter(reference => !bundledAssetPaths.has(normalizeAssetPath(reference.path)));
    if (unbundled.length) {
        const details = unbundled.map(item => `${item.from} -> ${item.path}`).join(', ');
        throw new Error(`Manager Worker references assets that are not bundled: ${details}`);
    }
}

async function removeStalePublicAssets() {
    const serviceInfo = await fs.lstat(managerServiceRoot);
    if (!serviceInfo.isDirectory() || serviceInfo.isSymbolicLink()) {
        throw new Error('Refusing to clean Manager assets because the service directory is not a regular directory.');
    }

    let publicInfo;
    try {
        publicInfo = await fs.lstat(publicDirectory);
    } catch (error) {
        if (error?.code === 'ENOENT') return;
        throw error;
    }
    if (!publicInfo.isDirectory() || publicInfo.isSymbolicLink()) {
        throw new Error('Refusing to clean Manager assets because public is not a regular directory.');
    }

    await cleanStaleDirectory(publicDirectory);
}

async function cleanStaleDirectory(directory) {
    if (!isWithin(publicDirectory, directory)) {
        throw new Error(`Refusing to inspect a path outside the Manager public directory: ${directory}`);
    }

    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
        const targetPath = path.join(directory, entry.name);
        if (!isWithin(publicDirectory, targetPath) || targetPath === publicDirectory) {
            throw new Error(`Refusing to clean a path outside the Manager public directory: ${targetPath}`);
        }
        const info = await fs.lstat(targetPath);
        if (info.isSymbolicLink()) {
            throw new Error(`Refusing to follow or remove a symlink in the Manager public directory: ${targetPath}`);
        }
        if (info.isDirectory()) {
            await cleanStaleDirectory(targetPath);
            if (!(await fs.readdir(targetPath)).length) await fs.rmdir(targetPath);
        } else if (info.isFile()) {
            const relativePath = normalizeAssetPath(path.relative(publicDirectory, targetPath));
            if (!bundledAssetPaths.has(relativePath)) await fs.unlink(targetPath);
        } else {
            throw new Error(`Refusing to clean an unsupported entry in the Manager public directory: ${targetPath}`);
        }
    }
}

async function verifyExistingPublicBundle() {
    let publicInfo;
    try {
        publicInfo = await fs.lstat(publicDirectory);
    } catch (error) {
        if (error?.code === 'ENOENT' && checkOnly) return;
        throw error;
    }
    if (!publicInfo.isDirectory() || publicInfo.isSymbolicLink()) {
        throw new Error('Refusing to verify Manager assets because public is not a regular directory.');
    }

    const actualPaths = await listPublicFiles(publicDirectory);
    const missingPaths = [...bundledAssetPaths].filter(assetPath => !actualPaths.has(assetPath));
    const unexpectedPaths = [...actualPaths].filter(assetPath => !bundledAssetPaths.has(assetPath));
    if (missingPaths.length || unexpectedPaths.length) {
        throw new Error(`Manager Worker public bundle mismatch; missing: ${missingPaths.join(', ') || 'none'}; unexpected: ${unexpectedPaths.join(', ') || 'none'}`);
    }
}

async function listPublicFiles(directory) {
    if (!isWithin(publicDirectory, directory)) {
        throw new Error(`Refusing to inspect a path outside the Manager public directory: ${directory}`);
    }
    const files = new Set();
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
        const targetPath = path.join(directory, entry.name);
        const info = await fs.lstat(targetPath);
        if (info.isSymbolicLink()) {
            throw new Error(`Refusing to follow a symlink in the Manager public directory: ${targetPath}`);
        }
        if (info.isDirectory()) {
            for (const child of await listPublicFiles(targetPath)) files.add(child);
        } else if (info.isFile()) {
            files.add(normalizeAssetPath(path.relative(publicDirectory, targetPath)));
        } else {
            throw new Error(`Unsupported entry in the Manager public directory: ${targetPath}`);
        }
    }
    return files;
}

function localReference(value, baseDirectory = '') {
    const rawValue = String(value || '').trim();
    if (!rawValue || rawValue.startsWith('#') || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(rawValue) || rawValue.startsWith('var(')) return '';
    const withoutQuery = rawValue.split(/[?#]/, 1)[0];
    if (!withoutQuery) return '';
    const normalized = path.posix.normalize(path.posix.join(baseDirectory, withoutQuery.replace(/^\/+/, '')));
    return normalized.startsWith('../') ? '' : normalized;
}

function normalizeAssetPath(value) {
    return String(value || '').replace(/\\/g, '/').replace(/^\.\//, '');
}

function isWithin(parentDirectory, targetPath) {
    const relative = path.relative(parentDirectory, targetPath);
    return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}
