/* Public content reads and editor handoff. No privileged credentials cross origins. */
(function () {
    'use strict';
    const workerOrigin = 'https://abs-manager-auth.trashullu.workers.dev';
    const scriptUrl = document.currentScript?.src || new URL('js/card-content-client.js', location.href).href;
    const appBase = new URL('../', scriptUrl);
    const local = ['localhost', '127.0.0.1'].includes(location.hostname);
    const configured = window.CARD_CONTENT_CONFIG || {};
    const pilotEnabled = new URLSearchParams(location.search).get('content') === 'database';
    const endpoint = local && configured.apiOrigin ? new URL(configured.apiOrigin).origin : workerOrigin;
    const enabled = () => configured.enabled === true || pilotEnabled || Boolean(window.currentContentCard);

    async function read(path) {
        try {
            const response = await fetch(endpoint + path, { credentials: 'omit', cache: 'no-cache', headers: { Accept: 'application/json' } });
            let result;
            try { result = await response.json(); } catch { throw new Error('Card content is temporarily unavailable. Retry without discarding your work.'); }
            if (!response.ok) throw Object.assign(new Error(result.error?.message || 'Card content is temporarily unavailable.'), { status: response.status, code: result.error?.code });
            if (result.schemaVersion !== 1) throw new Error('This card content version is unsupported. Reload the page.');
            document.getElementById('card-content-unavailable')?.remove();
            return result;
        } catch (error) {
            if (document.body && !document.getElementById('card-content-unavailable')) {
                const notice = document.createElement('div');
                notice.id = 'card-content-unavailable'; notice.setAttribute('role', 'alert');
                notice.style.cssText = 'position:fixed;bottom:24px;left:24px;right:24px;z-index:2147483646;padding:16px;background:#341f20;color:#fff;border:1px solid #b76468;border-radius:8px;font:16px system-ui';
                notice.textContent = 'Custom card content is unavailable. Your current edits are preserved. Retry from the card selector or reload after exporting your work.';
                const dismiss = document.createElement('button'); dismiss.textContent = 'Dismiss'; dismiss.style.marginLeft = '12px';
                dismiss.addEventListener('click', () => notice.remove()); notice.append(dismiss); document.body.append(notice);
            }
            throw error;
        }
    }

    async function getCard(id) {
        const result = await read('/api/public/cards/' + encodeURIComponent(id));
        if (!result.card || result.card.id !== id || !Number.isSafeInteger(result.card.revision)) throw new Error('Invalid card response.');
        // Authored transformations can point to cards outside the managed link
        // group. Resolve their portrait metadata without adding extra form rows.
        const known = new Set([id, ...(result.card.linkedCards || []).map(card => card.id)]);
        const missing = new Set((result.card.builtinForms || []).map(form => form.targetId).filter(target => target && !known.has(target)));
        if (missing.size) {
            result.card.formCards = (await listCards()).filter(card => missing.has(card.id));
        }
        return result.card;
    }

    async function resolve(path) {
        return read('/api/public/cards/resolve?path=' + encodeURIComponent(path));
    }

    async function listCards() {
        const cards = [], seen = new Set();
        let cursor = null;
        do {
            const result = await read('/api/public/cards?limit=100' + (cursor ? '&cursor=' + encodeURIComponent(cursor) : ''));
            if (!Array.isArray(result.cards)) throw new Error('Invalid card catalog.');
            cards.push(...result.cards);
            cursor = result.nextCursor;
            if (cursor && (seen.has(cursor) || seen.size >= 100)) throw new Error('Card catalog pagination could not finish.');
            if (cursor) seen.add(cursor);
        } while (cursor);
        return cards;
    }

    function viewerUrl(id) {
        const url = new URL('custom-card.html', appBase);
        url.searchParams.set('id', id);
        return url.href;
    }

    function toCatalogCard(card) {
        return {
            id: card.id, slug: card.slug, name: card.name, title: card.title,
            source: 'custom', contentSource: 'database', revision: card.revision,
            repoPath: card.repoPath, assetBase: card.assetBase, cardUrl: viewerUrl(card.id),
            thumbUrl: card.thumb, thumbFallbacks: [], cardArtImageUrl: card.cardArtImageUrl || '',
            cardArtVideoUrl: card.cardArtVideoUrl || '', type: String(card.type || 'agl').toLowerCase(),
            rarity: String(card.rarity || 'TUR').toUpperCase(), cardClass: String(card.cardClass || 'super').toLowerCase(),
            categoryNames: card.categoryNames || [], linkedCardReferences: card.linkedSlugs || [],
            releaseDate: card.releaseDate || '', sortTime: Date.parse(card.releaseDate || '') || 0,
            summonBrand: typeof window.getSummonBrand === 'function' ? window.getSummonBrand(card.unitTag || '') : '',
            isEza: /eza/i.test(card.awakeningMode || ''), isSeza: /seza/i.test(card.awakeningMode || ''), isFuture: false
        };
    }

    function toProject(card) {
        if (typeof window.CardContentRenderer?.toProject !== 'function') throw new Error('The safe card renderer is unavailable. Reload and retry.');
        return window.CardContentRenderer.toProject(card);
    }

    async function calculatorCard(item) {
        const card = await getCard(item.id), project = toProject(card);
        const doc = new DOMParser().parseFromString('<!doctype html><html><body></body></html>', 'text/html');
        const data = doc.createElement('script');
        data.id = 'card-data'; data.type = 'application/json'; data.textContent = JSON.stringify(project); doc.body.append(data);
        for (const [key, id] of Object.entries({ passiveCard: 'card-passive-container', links: 'card-link-container', categories: 'card-category-container' })) {
            const section = doc.createElement('div'); section.id = id; section.innerHTML = project.containers?.[key] || ''; doc.body.append(section);
        }
        for (const html of [...(project.activeBlocksHTML || []), ...(project.saBlocksHTML || [])]) {
            const section = doc.createElement('div'); section.innerHTML = html; doc.body.append(section);
        }
        return { ...item, ...toCatalogCard(card), cardUrl: card.assetBase, doc, htmlText: doc.documentElement.outerHTML };
    }

    function publishCurrent() {
        const project = window.getProjectDataObject?.();
        const savedFingerprint = window.getCardEditFingerprint?.(project);
        const projectLoadRevision = window.getEditorProjectLoadRevision?.();
        if (!project || project.cardSource === 'official') throw new Error('Select a custom card to publish.');
        const current = window.currentContentCard;
        const id = current?.id || String(project.inputs?.['upload-folder-id'] || document.getElementById('upload-folder-id')?.value || '').trim()
            || String(project.inputs?.nameInput || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0,128);
        if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(id)) throw new Error('Enter a card folder ID before publishing.');
        const repoPath = current?.repoPath || 'Custom Cards/' + id;
        const assetBase = current?.assetBase || 'https://abscustom.github.io/' + repoPath.split('/').map(encodeURIComponent).join('/') + '/';
        const payload = structuredClone(project);
        const renderedForms = payload.formsData || [];
        const builtinForms = renderedForms.filter(form => !form.adminLinkedSlug);
        for (const form of builtinForms) {
            const authored = (current?.builtinForms || []).find(saved => saved.targetId && saved.targetId === form.targetId);
            if (authored) form.link = authored.link;
        }
        // A deduplicated managed button can cover an authored form. A normal
        // card save must preserve that authored form for a later unlink.
        const coveredTargets = new Set(renderedForms.filter(form => form.adminLinkedSlug).map(form => form.adminLinkedSlug));
        for (const form of current?.builtinForms || []) {
            if (form.targetId && coveredTargets.has(form.targetId) && !builtinForms.some(entry => entry.targetId === form.targetId)) builtinForms.push(form);
        }
        delete payload.formsData;
        if (payload.containers) delete payload.containers.forms;
        const request = { expectedRevision: current?.revision || 0, card: {
            name: payload.inputs?.nameInput || current?.name || id, title: payload.inputs?.descInput || '',
            type: payload.currentType || 'agl', rarity: payload.currentRarity || 'TUR',
            thumb: payload.thumbMain || payload.thumbLr || payload.thumbTur || current?.thumb || '',
            repoPath, assetBase, payload, builtinForms, status: 'published'
        } };
        if (/data:(?:image|video|audio)\//i.test(JSON.stringify(request))) throw new Error('Publish the new media assets first, then use their URLs before saving card content. Your offline JSON still contains the media.');
        if (document.getElementById('card-save-dialog')?.open) return;
        const dialog = document.createElement('dialog');
        dialog.id = 'card-save-dialog'; dialog.className = 'abs-action-dialog';
        dialog.setAttribute('aria-labelledby', 'card-save-title');
        dialog.innerHTML = '<h2 id="card-save-title">Save card</h2><p data-card-name></p><p data-save-status role="status">Save this revision to your shared custom card.</p><div class="abs-dialog-actions"><button class="sba-gui-btn" data-save>Save card</button><button class="sba-gui-btn" data-cancel>Keep editing</button></div>';
        dialog.querySelector('[data-card-name]').textContent = request.card.name;
        const status = dialog.querySelector('[data-save-status]');
        const button = dialog.querySelector('[data-save]');
        let busy = false;
        const dismiss = () => { if (!busy) dialog.close(); };
        dialog.addEventListener('click', event => {
            const r = dialog.getBoundingClientRect();
            if (event.target === dialog && (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom)) dismiss();
        });
        dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
        dialog.querySelector('[data-cancel]').addEventListener('click', dismiss);
        dialog.addEventListener('close', () => dialog.remove(), {once:true});
        button.addEventListener('click', async () => {
            if (busy) return;
            busy = true; button.disabled = true; status.textContent = 'Saving…';
            try {
                if (!window.absProfile?.saveCard) throw new Error('Sign in through your profile before saving.');
                const result = await window.absProfile.saveCard(id, request);
                if (!Number.isSafeInteger(result.card?.revision)) throw new Error('Save response was incomplete. Check the latest revision before retrying.');
                acceptSaved({revision:result.card.revision});
                dialog.close();
            } catch (error) {
                status.textContent = error.status === 409 ? 'A newer revision exists. Your edits are still here. Export a backup and reload the latest card before retrying.' : error.message;
            } finally { busy = false; button.disabled = false; }
        });
        function acceptSaved(receipt) {
                // A late save response must not replace another card opened meanwhile.
                if (window.currentContentCard !== current || window.getEditorProjectLoadRevision?.() !== projectLoadRevision) { return; }
                const savedPayload = structuredClone(request.card.payload);
                window.currentContentCard = { ...current, ...request.card, payload: savedPayload, id, slug: id, revision: receipt.revision };
                document.dispatchEvent(new CustomEvent('card-content-saved', { detail: { id, revision: receipt.revision, savedFingerprint } }));
                window.CardHubToast?.success('Card saved', { detail: request.card.name });
        }
        document.body.append(dialog); dialog.showModal(); button.focus();
        return dialog;
    }

    function assertLegacyWriteAllowed(files) {
        if (enabled() && files.some(file => /(?:^|\/)(?:index\.html|card\.json)$/i.test(file.path || ''))) {
            throw Object.assign(new Error('Direct GitHub card HTML/JSON writes are disabled while database publishing is active.'), { code: 'LEGACY_CONTENT_DISABLED' });
        }
    }
    window.CardContent = Object.freeze({ enabled, getCard, resolve, listCards, viewerUrl, toCatalogCard, toProject, calculatorCard, publishCurrent, assertLegacyWriteAllowed });
})();
