/* Shared saved-card transformations. No network, storage, or script execution. */
(function(root){
root.createManagerCardTransforms = function({DOMParser}) {
const SITE_ROOT = "https://abscustom.github.io/";
    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function encodeRepoPath(path) {
        return String(path || '').split('/').filter(Boolean).map(encodeURIComponent).join('/');
    }

    function resolveCardUrl(src, repoPath) {
        if (!src) return `${SITE_ROOT}assets/images/default.png`;
        try {
            return new URL(src, `${SITE_ROOT}${encodeRepoPath(repoPath)}/`).href;
        } catch (e) {
            return src;
        }
    }

    function parseCard(slug, htmlText, repoPath = slug) {
        const doc = new DOMParser().parseFromString(htmlText, 'text/html');
        let cardJson = null;
        const cardDataEl = doc.querySelector('#card-data, #dokkan-project-data');
        if (cardDataEl) {
            try { cardJson = JSON.parse(cardDataEl.textContent); } catch (e) {}
        }

        const name = cardJson?.inputs?.nameInput
            || doc.querySelector('#char-name, #abs-char-name')?.textContent?.trim()
            || doc.querySelector('title')?.textContent?.replace(/^\[.*?\]\s*/, '').trim()
            || slug;
        const title = cardJson?.inputs?.descInput
            || doc.querySelector('#char-description, #abs-char-title')?.textContent?.trim() || '';
        const marker = doc.querySelector('#pub-site-marker')?.textContent || '';
        const typeMatch = marker.match(/currentType\s*=\s*["']([^"']+)/);
        const rarityMatch = marker.match(/currentRarity\s*=\s*["']([^"']+)/);

        const rarityName = cardJson?.currentRarity || cardJson?.characterState?.cardRarity || rarityMatch?.[1] || 'TUR';
        const isLR = String(rarityName).toUpperCase() === 'LR';
        const type = (cardJson?.characterState?.cardType || cardJson?.currentType || typeMatch?.[1] || 'none').toLowerCase();
        const cardClass = (cardJson?.characterState?.cardClass || cardJson?.currentClass || 'super').toLowerCase();

        const thumbEl = doc.querySelector('#abs-thumb-img, #img-lr, #img-tur, #img-ssr, .thumb-img');
        const rawThumb = cardJson?.thumbMain || (isLR ? cardJson?.thumbLr : cardJson?.thumbTur) || thumbEl?.getAttribute('src');
        const thumb = resolveCardUrl(rawThumb, repoPath);

        const frameEl = doc.querySelector('#abs-frame-img, .card-frame');
        const frame = resolveCardUrl(frameEl?.getAttribute('src') || (type !== 'none' ? `https://abscustom.github.io/assets/images/frame_${type}.png` : 'https://abscustom.github.io/assets/images/frame_none.png'), repoPath);

        const rarityEl = doc.querySelector('#abs-top-rarity-icon, #main-rarity-icon');
        const rarity = resolveCardUrl(rarityEl?.getAttribute('src') || `https://abscustom.github.io/assets/images/rarity_${rarityName}.png`, repoPath);

        const typeEl = doc.querySelector('#abs-top-type-icon, .typing-icon');
        const typeIcon = resolveCardUrl(typeEl?.getAttribute('src') || (type !== 'none' ? `https://abscustom.github.io/assets/images/${cardClass}_type_${type}.png` : 'https://abscustom.github.io/assets/images/type_none.png'), repoPath);

        return {
            slug,
            repoPath,
            name,
            title,
            thumb,
            frame,
            rarity,
            typeIcon,
            type,
            rarityName,
            url: `${SITE_ROOT}${encodeRepoPath(repoPath)}/`,
            htmlText
        };
    }

    function normalizeCardIdentityText(value) {
        return String(value || '')
            .replace(/[\[\]]/g, ' ')
            .trim()
            .replace(/\s+/g, ' ')
            .toLowerCase();
    }

    function normalizeCardIdentityTokens(value) {
        const ignoredFormWords = new Set(['card', 'form', 'giant', 'mode']);
        return normalizeCardIdentityText(value)
            .replace(/[^a-z0-9]+/g, ' ')
            .split(/\s+/)
            .filter(word => word && !ignoredFormWords.has(word))
            .sort()
            .join(' ');
    }

    function getCardIdentityNames(card) {
        const names = new Set();
        const name = String(card?.name || '').trim();
        const title = String(card?.title || '').replace(/[\[\]]/g, '').trim();
        [name, title && name ? `${title} ${name}` : ''].forEach(value => {
            const normalized = normalizeCardIdentityText(value);
            if (normalized) names.add(normalized);
            const tokenKey = normalizeCardIdentityTokens(value);
            if (tokenKey) names.add(`tokens:${tokenKey}`);
        });
        return names;
    }

    function nameTextMatchesCard(value, card) {
        const cardNames = getCardIdentityNames(card);
        const normalized = normalizeCardIdentityText(value);
        const tokenKey = normalizeCardIdentityTokens(value);
        return Boolean(normalized) && (
            cardNames.has(normalized) ||
            (tokenKey && cardNames.has(`tokens:${tokenKey}`))
        );
    }

    function normalizeComparableImage(value, repoPath) {
        if (!value) return '';
        try {
            const url = new URL(value, `${SITE_ROOT}${encodeRepoPath(repoPath)}/`);
            url.hash = '';
            url.search = '';
            return decodeURIComponent(url.href).toLowerCase();
        } catch (e) {
            return String(value).trim().replace(/[?#].*$/, '').toLowerCase();
        }
    }

    function nodeMatchesCard(node, card, kind) {
        const nameElement = kind === 'abs'
            ? node.querySelector('.abs-transform-name')
            : node.querySelector('.form-name-display, .form-name');
        const imageElement = kind === 'abs'
            ? node.querySelector('.thumb-img')
            : node.querySelector('.form-image');
        const nodeName = normalizeCardIdentityText(nameElement?.textContent);
        const possibleThumbs = [
            node.getAttribute('data-thumb-src'),
            imageElement?.getAttribute('src')
        ].filter(Boolean).map(value => normalizeComparableImage(value, card.repoPath));
        const cardThumb = normalizeComparableImage(card.thumb, card.repoPath);
        return !!nodeName && nameTextMatchesCard(nodeName, card) && !!cardThumb && possibleThumbs.includes(cardThumb);
    }

    function nodeMatchesCardName(node, card, kind) {
        const nameElement = kind === 'abs'
            ? node.querySelector('.abs-transform-name')
            : node.querySelector('.form-name-display, .form-name');
        return nameTextMatchesCard(nameElement?.textContent, card);
    }

    function findReusableCardNode(nodes, card, kind, sourceCard, allowUnmatchedFallback = true) {
        const candidates = Array.from(nodes || []);
        // The first form is reserved for the card whose page is being edited.
        // Linked targets may reuse later blocks, but must never take over that
        // first self-form link.
        const linkedFormCandidates = candidates.slice(1);
        const unlinkedCandidates = linkedFormCandidates.filter(node => (
            !node.hasAttribute('data-admin-linked-slug')
            && !nodeMatchesCardName(node, sourceCard, kind)
        ));
        return linkedFormCandidates.find(node => nodeMatchesCard(node, card, kind))
            || linkedFormCandidates.find(node => nodeMatchesCardName(node, card, kind))
            // A manually prepared forms list normally keeps the current card
            // first and the linked form second. This fallback is safe only for
            // a single-link operation with one unclaimed candidate. In a
            // multi-link operation it could assign two targets to one block.
            || (allowUnmatchedFallback && unlinkedCandidates.length === 1 ? unlinkedCandidates[0] : null)
            || null;
    }

    function setNodeCardLink(node, card, kind, adopted = false) {
        const anchor = node.querySelector(kind === 'abs' ? '.abs-transform-link' : '.form-link');
        if (!anchor) return;
        if (adopted && !node.hasAttribute('data-admin-previous-href')) {
            node.setAttribute('data-admin-link-adopted', 'true');
            node.setAttribute('data-admin-previous-href', anchor.getAttribute('href') || '');
        }
        anchor.setAttribute('href', card.url);
        anchor.setAttribute('target', '_self');
        node.setAttribute('data-admin-linked-slug', card.slug);
    }

    function repairCurrentCardLinks(doc, sourceCard, ensureSelfForm = false) {
        const sourceName = escapeHtml(sourceCard.name);
        const sourceThumb = escapeHtml(sourceCard.thumb);
        const sourceUrl = escapeHtml(sourceCard.url);
        const sourceType = escapeHtml(sourceCard.type || 'none');

        const ensureInfoSelfForm = () => {
            const container = doc.getElementById('forms-container');
            if (!container) return;
            const first = container.querySelector('.dokkan-card');
            if (first && (nodeMatchesCard(first, sourceCard, 'info') || nodeMatchesCardName(first, sourceCard, 'info'))) return;
            container.insertAdjacentHTML('afterbegin', `
                <div class="row bg-${sourceType} dokkan-card admin-self-form" data-thumb-src="${sourceThumb}">
                    <div class="col" style="padding: 8px 0 !important;">
                        <div class="row align-items-center m-0 w-100">
                            <div class="col-5 d-flex justify-content-center align-items-center">
                                <a href="${sourceUrl}" class="form-link" target="_self">
                                    <img class="img-fluid form-image" src="${sourceThumb}" data-export-name="" style="max-height: 60px; width: auto; display: block;" alt="${sourceName}">
                                </a>
                            </div>
                            <div class="col-7 form-name form-name-display d-flex justify-content-center align-items-center" style="color:#fff; font-size:16px; text-align:center;">${sourceName}</div>
                        </div>
                    </div>
                </div>`);
            doc.getElementById('forms-card-wrapper')?.style.setProperty('display', 'block');
        };

        const ensureAbsSelfForm = () => {
            const container = doc.getElementById('abs-transformations-container');
            if (!container) return;
            const first = container.querySelector('.abs-transform-row');
            if (first && (nodeMatchesCard(first, sourceCard, 'abs') || nodeMatchesCardName(first, sourceCard, 'abs'))) return;
            const divider = first ? '<div class="abs-transform-divider" data-admin-link-divider="true"></div>' : '';
            container.insertAdjacentHTML('afterbegin', `
                <div class="abs-transform-row admin-self-form">
                    <a href="${sourceUrl}" class="abs-transform-link" target="_self" style="text-decoration:none; color:inherit; display:flex; align-items:center; width:100%;">
                        <div class="abs-composed-icon">
                            <img class="card-frame" src="${escapeHtml(sourceCard.frame)}">
                            <div class="thumb-box"><img class="thumb-img" src="${sourceThumb}" alt="${sourceName}"></div>
                            <img class="rarity-icon" src="${escapeHtml(sourceCard.rarity)}">
                            <img class="type-icon" src="${escapeHtml(sourceCard.typeIcon)}">
                        </div>
                        <div class="abs-transform-name" style="flex:1; text-align:center; font-size:15px; font-weight:bold;">${sourceName}</div>
                    </a>
                </div>${divider}`);
            doc.getElementById('abs-transformations-box')?.classList.remove('d-none');
        };

        if (ensureSelfForm) {
            ensureInfoSelfForm();
            ensureAbsSelfForm();
        }

        const repairNodes = (selector, kind, linkSelector) => {
            const nodes = Array.from(doc.querySelectorAll(selector));
            const first = nodes[0];
            const exactMatches = nodes.filter(node => nodeMatchesCard(node, sourceCard, kind));
            const nameMatches = exactMatches.length
                ? exactMatches
                : nodes.filter(node => nodeMatchesCardName(node, sourceCard, kind));
            const matches = new Set([
                ...(first ? [first] : []),
                ...(exactMatches.length ? exactMatches : (nameMatches.length === 1 ? nameMatches : []))
            ]);
            matches.forEach(node => {
                const anchor = node.querySelector(linkSelector);
                if (!anchor) return;
                anchor.setAttribute('href', sourceCard.url);
                anchor.setAttribute('target', '_self');
            });
            if (first) {
                first.removeAttribute('data-admin-linked-slug');
                first.removeAttribute('data-admin-link-adopted');
                first.removeAttribute('data-admin-previous-href');
            }
        };
        repairNodes('#forms-container .dokkan-card', 'info', '.form-link');
        repairNodes('#abs-transformations-container .abs-transform-row', 'abs', '.abs-transform-link');
    }

    function normalizeTransformDividers(container) {
        if (!container) return;
        const children = Array.from(container.children);
        children.forEach((node, index) => {
            if (!node.classList.contains('abs-transform-divider')) return;
            const previous = children[index - 1];
            const next = children[index + 1];
            if (!previous?.classList.contains('abs-transform-row') || !next?.classList.contains('abs-transform-row')) {
                node.remove();
            }
        });
    }

    function removeLinkedCardNodes(doc, targetSlug) {
        let removed = false;
        Array.from(doc.querySelectorAll('[data-admin-linked-slug]')).forEach(node => {
            if (node.getAttribute('data-admin-linked-slug') !== targetSlug) return;
            if (node.getAttribute('data-admin-link-adopted') === 'true') {
                const anchor = node.querySelector('.form-link, .abs-transform-link');
                if (anchor) anchor.setAttribute('href', node.getAttribute('data-admin-previous-href') || 'javascript:void(0)');
                node.removeAttribute('data-admin-linked-slug');
                node.removeAttribute('data-admin-link-adopted');
                node.removeAttribute('data-admin-previous-href');
                removed = true;
                return;
            }
            if (node.classList.contains('abs-transform-row')) {
                const prev = node.previousElementSibling;
                const next = node.nextElementSibling;
                if (prev?.classList.contains('abs-transform-divider')) prev.remove();
                else if (next?.classList.contains('abs-transform-divider')) next.remove();
            }
            node.remove();
            removed = true;
        });

        const transContainer = doc.getElementById('abs-transformations-container');
        const transBox = doc.getElementById('abs-transformations-box');
        normalizeTransformDividers(transContainer);
        if (transContainer && !transContainer.querySelector('.abs-transform-row')) {
            transContainer.innerHTML = '';
            transBox?.classList.add('d-none');
        }

        const formsContainer = doc.getElementById('forms-container');
        const formsWrapper = doc.getElementById('forms-card-wrapper');
        if (formsContainer && !formsContainer.querySelector('.dokkan-card')) {
            formsWrapper?.setAttribute('style', 'display: none;');
        }
        return removed;
    }

    function addLinkedCardNodes(doc, sourceCard, targetCard, allowUnmatchedFallback = true) {
        const targetName = escapeHtml(targetCard.name);
        const targetSlug = escapeHtml(targetCard.slug);
        const targetUrl = escapeHtml(targetCard.url);
        const targetThumb = escapeHtml(targetCard.thumb);
        const sourceType = escapeHtml(sourceCard.type || 'none');

        const formsContainer = doc.getElementById('forms-container');
        const formsWrapper = doc.getElementById('forms-card-wrapper');
        const matchingInfoForm = findReusableCardNode(
            formsContainer?.querySelectorAll('.dokkan-card'),
            targetCard,
            'info',
            sourceCard,
            allowUnmatchedFallback
        );
        if (matchingInfoForm) {
            setNodeCardLink(matchingInfoForm, targetCard, 'info', true);
        } else if (formsContainer) {
            formsContainer.insertAdjacentHTML('beforeend', `
                <div class="row bg-${sourceType} dokkan-card admin-linked-form" data-thumb-src="${targetThumb}" data-admin-linked-slug="${targetSlug}">
                    <div class="col" style="padding: 8px 0 !important;">
                        <div class="row align-items-center m-0 w-100">
                            <div class="col-5 d-flex justify-content-center align-items-center">
                                <a href="${targetUrl}" class="form-link" target="_self">
                                    <img class="img-fluid form-image" src="${targetThumb}" data-export-name="" style="max-height: 60px; width: auto; display: block;" alt="${targetName}">
                                </a>
                            </div>
                            <div class="col-7 form-name form-name-display d-flex justify-content-center align-items-center" style="color:#fff; font-size:16px; text-align:center;">${targetName}</div>
                        </div>
                    </div>
                </div>`);
            if (formsWrapper) formsWrapper.style.display = 'block';
        }

        const transContainer = doc.getElementById('abs-transformations-container');
        const transBox = doc.getElementById('abs-transformations-box');
        const matchingAbsForm = findReusableCardNode(
            transContainer?.querySelectorAll('.abs-transform-row'),
            targetCard,
            'abs',
            sourceCard,
            allowUnmatchedFallback
        );
        if (matchingAbsForm) {
            setNodeCardLink(matchingAbsForm, targetCard, 'abs', true);
            transBox?.classList.remove('d-none');
        } else if (transContainer) {
            if (transContainer.querySelector('.abs-transform-row')) {
                transContainer.insertAdjacentHTML('beforeend', '<div class="abs-transform-divider" data-admin-link-divider="true"></div>');
            }
            transContainer.insertAdjacentHTML('beforeend', `
                <div class="abs-transform-row" data-admin-linked-slug="${targetSlug}">
                    <a href="${targetUrl}" class="abs-transform-link" target="_self" style="text-decoration:none; color:inherit; display:flex; align-items:center; width:100%;">
                        <div class="abs-composed-icon">
                            <img class="card-frame" src="${escapeHtml(targetCard.frame)}">
                            <div class="thumb-box"><img class="thumb-img" src="${targetThumb}" alt="${targetName}"></div>
                            <img class="rarity-icon" src="${escapeHtml(targetCard.rarity)}">
                            <img class="type-icon" src="${escapeHtml(targetCard.typeIcon)}">
                        </div>
                        <div class="abs-transform-name" style="flex:1; text-align:center; font-size:15px; font-weight:bold;">${targetName}</div>
                    </a>
                </div>`);
            transBox?.classList.remove('d-none');
        }
    }

    // Dynamic pages have no rendered forms DOM. Update their saved form rows
    // directly, adopting an existing named placeholder rather than duplicating it.
    function updateLinkedFormsData(data, targetCard, shouldLink, sourceCard) {
        const forms = Array.isArray(data.formsData) ? data.formsData : [];
        // Older linker runs could overwrite the first (current-card) row.
        // Repair only a row whose name identifies the current card.
        if (sourceCard && forms[0] && normalizeCardIdentityText(forms[0].name) === normalizeCardIdentityText(sourceCard.name)) {
            forms[0] = { ...forms[0], link: sourceCard.url };
            delete forms[0].adminLinkedSlug;
            delete forms[0].adminLinkAdopted;
            delete forms[0].adminPreviousHref;
        }
        const targetPath = decodeURIComponent(new URL(targetCard.url).pathname).replace(/\/+$/, '');
        const matchesLink = form => {
            if (form.adminLinkedSlug === targetCard.slug) return true;
            try {
                return decodeURIComponent(new URL(form.link, SITE_ROOT).pathname).replace(/\/+$/, '') === targetPath;
            } catch { return false; }
        };
        if (!shouldLink) {
            data.formsData = forms.flatMap(form => {
                if (!matchesLink(form)) return [form];
                if (!form.adminLinkAdopted) return [];
                const restored = { ...form, link: form.adminPreviousHref || 'javascript:void(0)' };
                delete restored.adminLinkedSlug;
                delete restored.adminLinkAdopted;
                delete restored.adminPreviousHref;
                return [restored];
            });
            return;
        }
        const matching = forms.filter(matchesLink);
        const placeholders = forms.filter((form, index) => index > 0 && !form.adminLinkedSlug &&
            normalizeCardIdentityText(form.name) !== normalizeCardIdentityText(sourceCard?.name) &&
            normalizeCardIdentityText(form.name) === normalizeCardIdentityText(targetCard.name));
        const existing = matching[0] || (placeholders.length === 1 ? placeholders[0] : null);
        const linked = {
            ...(existing || {}),
            ...(existing && !matching.length ? { adminLinkAdopted: true, adminPreviousHref: existing.link || '' } : {}),
            imageSrc: existing?.imageSrc || targetCard.thumb,
            imageExportName: existing?.imageExportName || '',
            thumbSrc: existing?.thumbSrc || targetCard.thumb,
            name: targetCard.name,
            link: targetCard.url,
            adminLinkedSlug: targetCard.slug
        };
        data.formsData = forms.filter(form => form === existing || !matchesLink(form))
            .map(form => form === existing ? linked : form);
        if (!existing) data.formsData.push(linked);
    }

    function updateLinkedHtml(htmlText, sourceCard, targetCard, shouldLink, allowUnmatchedFallback = true) {
        const doc = new DOMParser().parseFromString(htmlText, 'text/html');
        removeLinkedCardNodes(doc, targetCard.slug);
        repairCurrentCardLinks(doc, sourceCard, shouldLink);
        if (shouldLink) addLinkedCardNodes(doc, sourceCard, targetCard, allowUnmatchedFallback);
        repairCurrentCardLinks(doc, sourceCard);

        const cardDataEl = doc.querySelector('#card-data');
        if (cardDataEl) {
            try {
                const data = JSON.parse(cardDataEl.textContent);
                updateLinkedFormsData(data, targetCard, shouldLink, sourceCard);
                cardDataEl.textContent = JSON.stringify(data, null, 2).replace(/</g, '\\u003c');
            } catch (e) {}
        }

        return '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
    }

    function htmlHasAdminLink(htmlText, targetSlug) {
        const doc = new DOMParser().parseFromString(htmlText, 'text/html');
        const cardDataEl = doc.querySelector('#card-data, #dokkan-project-data');
        if (cardDataEl) {
            try {
                const data = JSON.parse(cardDataEl.textContent);
                if (data.formsData && Array.isArray(data.formsData)) {
                    if (data.formsData.some(f => f.adminLinkedSlug === targetSlug || (f.link && f.link.includes(targetSlug)))) {
                        return true;
                    }
                }
            } catch (e) {}
        }
        return Array.from(doc.querySelectorAll('[data-admin-linked-slug]'))
            .some(node => node.getAttribute('data-admin-linked-slug') === targetSlug);
    }

    function updateLinkedJson(jsonText, updatedHtml, targetCard, shouldLink, sourceCard) {
        if (!jsonText) return null;
        let data;
        try {
            data = JSON.parse(jsonText);
        } catch (e) {
            return jsonText;
        }

        const updatedDoc = new DOMParser().parseFromString(updatedHtml, 'text/html');
        const domForms = Array.from(updatedDoc.querySelectorAll('#forms-container .dokkan-card')).map(form => {
            const image = form.querySelector('.form-image');
            return {
                imageSrc: image?.getAttribute('src') || form.getAttribute('data-thumb-src') || '',
                imageExportName: image?.getAttribute('data-export-name') || '',
                thumbSrc: form.getAttribute('data-thumb-src') || image?.getAttribute('src') || '',
                name: form.querySelector('.form-name-display, .form-name')?.textContent?.trim() || '',
                link: form.querySelector('.form-link')?.getAttribute('href') || 'javascript:void(0)',
                ...(form.getAttribute('data-admin-linked-slug')
                    ? { adminLinkedSlug: form.getAttribute('data-admin-linked-slug') }
                    : {})
            };
        });

        if (domForms.length > 0) {
            data.formsData = domForms;
            data.containers = data.containers || {};
            data.containers.forms = updatedDoc.getElementById('forms-container')?.innerHTML || '';
        } else {
            updateLinkedFormsData(data, targetCard, shouldLink, sourceCard);
        }

        return JSON.stringify(data, null, 2);
    }

    function getLinkedCards(cards) {
        const normalizeUrl = value => {
            try { return decodeURIComponent(new URL(value, SITE_ROOT).pathname).replace(/\/+$/, ''); }
            catch { return ''; }
        };
        const byUrl = new Map(cards.map(card => [normalizeUrl(card.url), card.slug]));
        return cards.map(card => {
            const doc = new DOMParser().parseFromString(card.htmlText, 'text/html');
            const links = new Set();
            const add = (slug, url) => {
                const target = cards.some(c => c.slug === slug) ? slug : byUrl.get(normalizeUrl(url));
                if (target && target !== card.slug) links.add(target);
            };
            try {
                const data = JSON.parse(doc.querySelector('#card-data, #dokkan-project-data')?.textContent || '{}');
                (data.formsData || []).forEach(form => add(form.adminLinkedSlug, form.link));
            } catch {}
            doc.querySelectorAll('#forms-container .form-link, [data-admin-linked-slug]').forEach(node => {
                add(node.getAttribute('data-admin-linked-slug'), node.getAttribute('href') || node.querySelector('.form-link')?.getAttribute('href'));
            });
            return { slug: card.slug, name: card.name, title: card.title, thumb: card.thumb, type: card.type, links: [...links] };
        });
    }


return {parseCard,updateLinkedHtml,updateLinkedJson,htmlHasAdminLink,updateLinkedFormsData,getLinkedCards};
};
})(globalThis);
