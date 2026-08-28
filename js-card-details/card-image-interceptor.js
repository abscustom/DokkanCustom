/* ==========================================================================
   absCustom - Global Multi-Stage Image Failover Interceptor (Loop-Protected)
   ========================================================================== */

document.addEventListener('error', function(e) {
    if (!e.target || e.target.tagName !== 'IMG') return;

    const img = e.target;
    if (img.dataset.failed === 'true') return;

    const src = img.src || '';

    // Silence missing extra decorative effect overlays only
    if (img.id === 'abs-art-effect' || src.includes('_effect.png')) {
        img.dataset.failed = 'true';
        img.style.display = 'none';
        return;
    }

    // Auto-resolve central asset icons if requested from relative/missing paths
    const filename = src.split('/').pop().split('?')[0];
    if (filename && /^(card_empty|card_category_label_|passive_skill_dialog_|st_|sp_skill_|pot_skill_|SSR_Icon|TUR_Icon|LR_Icon|frame_|type_|rarity_|superza_abs|default\.png|Card Art Template)/i.test(filename)) {
        img.dataset.failed = 'true';
        if (filename.includes('card_empty')) {
            img.src = 'https://abscustom.github.io/assets/images/SSR_Icon.png';
            return;
        }
        if (!src.includes('abscustom.github.io')) {
            img.src = `https://abscustom.github.io/assets/images/${filename}`;
            return;
        }
        return;
    }

    // Default icon fallback for common HUD elements
    if (src.includes('SSR_Icon.png') || src.includes('card_empty.png') || src.includes('rarity_') || src.includes('frame_') || src.includes('superza_') || src.includes('eza_') || src.includes('ing_label_field.png') || src.includes('special_sticker') || src.includes('general_texture')) {
        img.dataset.failed = 'true';
        return;
    }

    const match = src.match(/card_(\d+)/) || src.match(/(\d{7,8})/);
    if (!match) {
        img.dataset.failed = 'true';
        return;
    }

    let fileIdStr = match[1];
    if (fileIdStr.length >= 8) fileIdStr = fileIdStr.substring(0, 7);

    const folderId = Math.floor(parseInt(fileIdStr, 10) / 10) * 10;
    let parentFolderId = folderId;
    if (fileIdStr.length === 7 && fileIdStr.startsWith('4')) {
        parentFolderId = Math.floor(parseInt('1' + fileIdStr.substring(1), 10) / 10) * 10;
    }

    const isThumb = src.includes('thumb') || img.classList.contains('thumb-img') || img.id === 'abs-thumb-img';
    const isBg = img.id === 'abs-art-bg' || src.includes('_bg.png');
    
    let retries = parseInt(img.dataset.retries || '0', 10) + 1;
    img.dataset.retries = String(retries);

    // Multi-tier Fallback Pipeline
    if (isBg) {
        if (retries === 1 && parentFolderId !== folderId) {
            // Retry with Base Parent Card ID in assets/card/
            img.src = `assets/card/${parentFolderId}/card_${parentFolderId}_bg.png`;
        } else if (retries <= 2) {
            // Retry inside assets/card_bg/
            img.src = `assets/card_bg/${parentFolderId}/card_bg_${parentFolderId}.png`;
        } else if (retries === 3) {
            // Online CDN Mirror fallback
            img.src = `https://images.weserv.nl/?url=dokkaninfo.com/assets/japan/character/card/${parentFolderId}/card_${parentFolderId}_bg.png`;
        } else {
            img.dataset.failed = 'true';
            img.style.display = 'none';
        }
    } else if (isThumb) {
        if (retries === 1) {
            img.src = `https://images.weserv.nl/?url=dokkaninfo.com/assets/japan/character/thumb/card_${folderId}_thumb/card_${folderId}_thumb.png`;
        } else if (retries === 2 && parentFolderId !== folderId) {
            img.src = `https://images.weserv.nl/?url=dokkaninfo.com/assets/japan/character/thumb/card_${parentFolderId}_thumb/card_${parentFolderId}_thumb.png`;
        } else {
            img.dataset.failed = 'true';
            img.src = './assets/images/SSR_Icon.png';
        }
    } else {
        if (retries === 1) {
            img.src = `https://images.weserv.nl/?url=dokkaninfo.com/assets/japan/character/card/${folderId}/card_${folderId}_character.png`;
        } else {
            img.dataset.failed = 'true';
        }
    }
}, true);