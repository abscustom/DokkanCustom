/* Shared custom-card media handling for the calculator and editor pickers. */
(function attachDokkanCustomCardMedia(global) {
    'use strict';

    function normalizeCustomMediaUrl(value) {
        if (typeof value !== 'string') return '';
        const source = value.trim();
        const dataUrlOffset = source.search(/data:image\//i);
        return dataUrlOffset > 0 ? source.slice(dataUrlOffset) : source;
    }

    function resolveCustomMediaUrl(value, cardUrl = '') {
        const source = normalizeCustomMediaUrl(value);
        if (!source) return '';
        if (/^(?:https?:)?\/\//i.test(source) || /^(?:data:|blob:)/i.test(source)) return source;
        if (!cardUrl) return source;

        const base = `${String(cardUrl).replace(/\/+$/, '')}/`;
        const relative = source.replace(/^\.\//, '');
        try {
            return new URL(relative, base).href;
        } catch (error) {
            return `${base}${relative}`;
        }
    }

    function isPlaceholderMediaUrl(value) {
        return /(?:^|\/)(?:SSR|TUR|LR)_Icon\.png(?:[?#]|$)|(?:^|\/)default\.png(?:[?#]|$)|Card(?:%20| )Art(?:%20| )Template\.png/i.test(String(value || ''));
    }

    function resolveCustomThumbnail(cardData, options = {}) {
        const data = cardData && typeof cardData === 'object' ? cardData : {};
        const cardUrl = options.cardUrl || '';
        const rarity = String(options.rarity || data.currentRarity || '').toUpperCase();
        const preferredThumb = rarity === 'LR'
            ? data.thumbLr
            : (rarity === 'SSR' ? data.thumbSsr : data.thumbTur);
        const artUrl = data.cardArtImage || options.artUrl || '';
        const rawCandidates = [
            data.thumbMain,
            preferredThumb,
            data.thumbLr,
            data.thumbTur,
            data.thumbSsr,
            options.iconUrl,
            artUrl
        ];
        const candidates = [];
        const seen = new Set();

        rawCandidates.forEach((candidate) => {
            const resolved = resolveCustomMediaUrl(candidate, cardUrl);
            if (!resolved || seen.has(resolved)) return;
            seen.add(resolved);
            candidates.push(resolved);
        });

        const primary = candidates.find((candidate) => !isPlaceholderMediaUrl(candidate))
            || candidates[0]
            || '';

        return {
            primary,
            fallbacks: candidates.filter((candidate) => candidate !== primary),
            candidates
        };
    }

    function readEmbeddedCardData(htmlText) {
        if (typeof htmlText !== 'string') return {};
        const match = htmlText.match(/<script\b(?=[^>]*\bid=["'](?:card-data|dokkan-project-data)["'])[^>]*>([\s\S]*?)<\/script>/i);
        if (!match) return {};
        try {
            return JSON.parse(match[1]);
        } catch (error) {
            return {};
        }
    }

    function normalizeCachedCustomCard(card) {
        if (!card || card.source !== 'custom') return card;
        const cardUrl = card.cardUrl || '';
        const embeddedData = readEmbeddedCardData(card.htmlText);
        const embeddedThumbnail = resolveCustomThumbnail(embeddedData, {
            cardUrl,
            rarity: card.rarity || embeddedData?.currentRarity
        });
        const cachedThumbUrl = resolveCustomMediaUrl(card.thumbUrl, cardUrl);
        const thumbUrl = cachedThumbUrl && !isPlaceholderMediaUrl(cachedThumbUrl)
            ? cachedThumbUrl
            : (embeddedThumbnail.primary || cachedThumbUrl);
        const cachedThumbFallbacks = Array.isArray(card.thumbFallbacks)
            ? card.thumbFallbacks.map((url) => resolveCustomMediaUrl(url, cardUrl)).filter(Boolean)
            : [];
        return {
            ...card,
            thumbUrl,
            thumbFallbacks: cachedThumbFallbacks.length
                ? cachedThumbFallbacks
                : embeddedThumbnail.fallbacks,
            cardArtImageUrl: resolveCustomMediaUrl(card.cardArtImageUrl, cardUrl),
            cardArtVideoUrl: resolveCustomMediaUrl(card.cardArtVideoUrl, cardUrl),
            type: String(embeddedData?.characterState?.cardType || embeddedData?.currentType || embeddedData?.type || card.type || 'agl').toLowerCase()
        };
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, (character) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        })[character]);
    }

    function handlePickerCircleError(img, folderId, parentFolderId, isCustom = false) {
        if (!img) return;
        if (isCustom) {
            let fallbacks = [];
            try {
                fallbacks = JSON.parse(img.dataset.pickerFallbacks || '[]');
            } catch (error) {}
            while (fallbacks.length) {
                const next = fallbacks.shift();
                img.dataset.pickerFallbacks = JSON.stringify(fallbacks);
                if (next && next !== img.src) {
                    img.src = next;
                    return;
                }
            }
            img.onerror = null;
            img.classList.add('picker-thumb-error');
            img.removeAttribute('src');
            return;
        }

        if (parentFolderId && parentFolderId !== folderId && !img.dataset.triedParentCircle) {
            img.dataset.triedParentCircle = 'true';
            img.src = `./assets/card-art/cards/${parentFolderId}/card_${parentFolderId}_circle.png`;
            img.onerror = function retryParentCircle() {
                handlePickerCircleError(this, folderId, parentFolderId, false);
            };
            return;
        }

        img.classList.add('is-fallback-thumb');
        img.onerror = function useGenericOfficialFallback() {
            this.onerror = null;
            if (typeof global.handleHubThumbError === 'function') {
                global.handleHubThumbError(this, folderId, parentFolderId);
            } else {
                this.src = 'assets/images/SSR_Icon.png';
            }
        };
        img.src = `https://images.weserv.nl/?url=dokkaninfo.com/assets/japan/character/thumb/card_${folderId}_thumb/card_${folderId}_thumb.png`;
    }

    global.DokkanCustomCardMedia = Object.freeze({
        escapeHtml,
        handlePickerCircleError,
        normalizeCachedCustomCard,
        normalizeCustomMediaUrl,
        resolveCustomMediaUrl,
        resolveCustomThumbnail
    });
})(window);
