/* Home-only palette metadata. Import from the existing dot player, never from card renderers. */
export const NEUTRAL_HOME_RGB = Object.freeze([150, 155, 165]);
const metadataUrl = new URL('../assets/dot_character/palettes.json', import.meta.url);
const generations = new WeakMap();
let metadataPromise;

function applyRgb(home, rgb, id = '') {
    if (!home) return;
    home.style.setProperty('--abs-home-accent-rgb', rgb.join(','));
    // Existing Home divider CSS uses space-separated RGB. Keep compatibility
    // local to Home while NAV retires its old body-wide sampled accent.
    home.style.setProperty('--dot-lwf-accent-rgb', rgb.join(' '));
    // The existing logo treatment offsets sepia by the accepted source hue.
    // Derive it from this already-validated palette, never rendered frames.
    const [red, green, blue] = rgb;
    const maximum = Math.max(...rgb), range = maximum - Math.min(...rgb);
    let hue = range === 0 ? 0 : maximum === red ? 60 * ((green - blue) / range)
        : maximum === green ? 60 * ((blue - red) / range + 2)
        : 60 * ((red - green) / range + 4);
    if (hue < 0) hue += 360;
    home.style.setProperty('--dot-lwf-accent-hue', `${Math.round(hue * 100) / 100}deg`);
    home.dataset.homePaletteId = id;
}

export function resetHomeTheme(home = document.getElementById('hubHomeSection')) {
    if (!home) return;
    generations.set(home, (generations.get(home) || 0) + 1);
    applyRgb(home, NEUTRAL_HOME_RGB);
}

export function validPaletteRgb(rgb) {
    return Array.isArray(rgb) && rgb.length === 3 && rgb.every(value => Number.isInteger(value) && value >= 0 && value <= 255);
}

async function loadMetadata() {
    metadataPromise ??= fetch(metadataUrl, { cache: 'force-cache' })
        .then(response => response.ok ? response.json() : null)
        .catch(() => null);
    return metadataPromise;
}

export async function applyHomeTheme(entry, files, home = document.getElementById('hubHomeSection')) {
    if (!home) return false;
    resetHomeTheme(home);
    const generation = generations.get(home);
    try {
        const metadata = await loadMetadata();
        const palette = metadata?.schemaVersion === 1 && Object.hasOwn(metadata.palettes || {}, entry?.id)
            ? metadata.palettes[entry.id] : null;
        if (!validPaletteRgb(palette?.accentRgb) || !/^[a-f0-9]{64}$/.test(palette?.sourceSha256 || '')) return false;
        const texture = files?.find(file => file.name === palette.sourceName);
        if (!texture || !globalThis.crypto?.subtle) return false;
        const digest = await crypto.subtle.digest('SHA-256', await texture.arrayBuffer());
        const sha256 = [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
        if (sha256 !== palette.sourceSha256 || generations.get(home) !== generation) return false;
        applyRgb(home, palette.accentRgb, entry.id);
        return true;
    } catch {
        // The companion is optional. Missing metadata/assets leave Home neutral.
        return false;
    }
}
