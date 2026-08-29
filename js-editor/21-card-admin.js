/* ============================================================
   CUSTOM CARD ADMIN: BIDIRECTIONAL FORM LINKS + SAFE DELETION
   ============================================================ */
(function () {
    const OWNER = 'abscustom';
    const REPO = 'abscustom.github.io';
    const BRANCH = 'main';
    const SITE_ROOT = 'https://abscustom.github.io/';
    const API_ROOT = `https://api.github.com/repos/${OWNER}/${REPO}`;
    // This is an extra UI confirmation only. The GitHub token remains the real permission check.
    const DELETE_PASSWORD = 'spiderman';
    const IGNORED_ROOT_FOLDERS = new Set([
        '.github', '.vscode', 'assets', 'css', 'json', 'js', 'js-calc',
        'js-card-details', 'js-editor', 'js-graphics', 'tools', 'images',
        'DokkanCustom', 'CardEditor', 'js2', 'js3'
    ]);

    const state = {
        token: '',
        cards: [],
        busy: false,
        linkMode: 'single',
        activeTool: 'link'
    };

    function setStatus(message, type = '') {
        const el = document.getElementById('card-admin-status');
        if (!el) return;
        el.textContent = message;
        el.classList.toggle('is-error', type === 'error');
        el.classList.toggle('is-success', type === 'success');
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function resolveCardUrl(src, slug) {
        if (!src) return `${SITE_ROOT}assets/images/default.png`;
        try {
            return new URL(src, `${SITE_ROOT}${slug}/`).href;
        } catch (e) {
            return src;
        }
    }

    function getToken() {
        return document.getElementById('card-admin-token')?.value.trim() || state.token || '';
    }

    function authHeaders(token, includeJson = false) {
        const headers = {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28'
        };
        if (includeJson) headers['Content-Type'] = 'application/json';
        return headers;
    }

    async function githubRequest(url, token, options = {}) {
        const response = await fetch(url, {
            ...options,
            headers: {
                ...authHeaders(token, !!options.body),
                ...(options.headers || {})
            }
        });

        if (!response.ok) {
            let detail = response.statusText;
            try {
                const data = await response.json();
                if (data && data.message) detail = data.message;
            } catch (e) {}
            const error = new Error(`${response.status}: ${detail}`);
            error.status = response.status;
            throw error;
        }

        if (response.status === 204) return null;
        return response.json();
    }

    function decodeGitHubContent(content) {
        const binary = atob(String(content || '').replace(/\s/g, ''));
        const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
        return new TextDecoder('utf-8').decode(bytes);
    }

    async function getRepoFile(path, token, optional = false) {
        try {
            const data = await githubRequest(`${API_ROOT}/contents/${encodeURI(path)}?ref=${BRANCH}`, token);
            return {
                path,
                text: decodeGitHubContent(data.content),
                sha: data.sha
            };
        } catch (error) {
            if (optional && error.status === 404) return null;
            throw error;
        }
    }

    function parseCard(slug, htmlText) {
        const doc = new DOMParser().parseFromString(htmlText, 'text/html');
        const name = doc.querySelector('#char-name, #abs-char-name')?.textContent?.trim()
            || doc.querySelector('title')?.textContent?.replace(/^\[.*?\]\s*/, '').trim()
            || slug;
        const title = doc.querySelector('#char-description, #abs-char-title')?.textContent?.trim() || '';
        const thumbEl = doc.querySelector('#abs-thumb-img, #img-lr, #img-tur, #img-ssr, .thumb-img');
        const thumb = resolveCardUrl(thumbEl?.getAttribute('src'), slug);
        const frameEl = doc.querySelector('#abs-frame-img, .card-frame');
        const frame = resolveCardUrl(frameEl?.getAttribute('src') || 'assets/images/frame_none.png', slug);
        const rarityEl = doc.querySelector('#abs-top-rarity-icon, #main-rarity-icon');
        const rarity = resolveCardUrl(rarityEl?.getAttribute('src') || 'assets/images/rarity_none.png', slug);
        const typeEl = doc.querySelector('#abs-top-type-icon, .typing-icon');
        const typeIcon = resolveCardUrl(typeEl?.getAttribute('src') || 'assets/images/type_none.png', slug);
        const marker = doc.querySelector('#pub-site-marker')?.textContent || '';
        const typeMatch = marker.match(/currentType\s*=\s*["']([^"']+)/);
        const rarityMatch = marker.match(/currentRarity\s*=\s*["']([^"']+)/);
        const hubId = doc.querySelector('meta[name="hub-id"]')?.getAttribute('content') || 'a';

        return {
            slug,
            name,
            title,
            thumb,
            frame,
            rarity,
            typeIcon,
            type: typeMatch?.[1] || 'none',
            rarityName: rarityMatch?.[1] || 'TUR',
            hubId,
            url: `${SITE_ROOT}${slug}/`,
            htmlText
        };
    }

    function selectedCard(selectId) {
        const slug = document.getElementById(selectId)?.value;
        return state.cards.find(card => card.slug === slug) || null;
    }

    function selectedBaseCard() {
        return selectedCard('card-admin-base-select');
    }

    function selectedCards(selectId) {
        const select = document.getElementById(selectId);
        const selectedSlugs = Array.from(select?.selectedOptions || []).map(option => option.value);
        return state.cards.filter(card => selectedSlugs.includes(card.slug));
    }

    function selectedFormCards() {
        const selectedSlugs = Array.from(document.querySelectorAll('#card-admin-form-checklist input:checked'))
            .map(input => input.value);
        return state.cards.filter(card => selectedSlugs.includes(card.slug));
    }

    function renderPreview(containerId, card) {
        const container = document.getElementById(containerId);
        if (!container) return;
        if (!card) {
            container.innerHTML = '<span>No card selected.</span>';
            return;
        }
        container.innerHTML = `
            <div class="card-admin-preview-item">
                <img src="${escapeHtml(card.thumb)}" alt="${escapeHtml(card.name)}">
                <div>
                    <strong>${escapeHtml(card.name)}</strong>
                    <span>${escapeHtml(card.slug)}</span>
                </div>
            </div>`;
    }

    window.updateCardAdminPreviews = function () {
        renderPreview('card-admin-base-preview', selectedBaseCard());
        refreshMultiFormAvailability();
        const selectedForms = selectedFormCards();
        const container = document.getElementById('card-admin-form-preview');
        if (!container) return;
        if (!selectedForms.length) {
            container.innerHTML = '<span>No linked forms selected.</span>';
            return;
        }
        container.innerHTML = selectedForms.map(card => `
            <div class="card-admin-preview-item">
                <img src="${escapeHtml(card.thumb)}" alt="${escapeHtml(card.name)}">
                <div><strong>${escapeHtml(card.name)}</strong><span>${escapeHtml(card.slug)}</span></div>
            </div>`).join('');
    };

    window.updateCardAdminDeleteHint = function () {
        const select = document.getElementById('card-admin-delete-select');
        const input = document.getElementById('card-admin-delete-confirm');
        renderPreview('card-admin-delete-preview', selectedCard('card-admin-delete-select'));
        if (input) {
            input.value = '';
            input.placeholder = select?.value ? `Type ${select.value}` : 'Select a card first';
        }
    };

    function renderDeletePicker() {
        const picker = document.getElementById('card-admin-delete-picker');
        const selectedSlug = document.getElementById('card-admin-delete-select')?.value || '';
        if (!picker) return;

        picker.innerHTML = state.cards.map(card => `
            <button type="button" class="card-admin-delete-choice ${card.slug === selectedSlug ? 'is-selected' : ''}" data-card-admin-delete="${escapeHtml(card.slug)}" onclick="window.selectCardAdminDeleteCard(this.dataset.cardAdminDelete)" role="option" aria-selected="${card.slug === selectedSlug}">
                <img src="${escapeHtml(card.thumb)}" alt="" onerror="this.src='https://abscustom.github.io/assets/images/default.png'">
                <span class="card-admin-delete-choice-name" title="${escapeHtml(card.name)}">${escapeHtml(card.name)}</span>
                <span class="card-admin-delete-choice-slug">${escapeHtml(card.slug)}</span>
            </button>`).join('');

        window.filterCardAdminDeleteCards(document.getElementById('card-admin-delete-filter')?.value || '');
    }

    window.selectCardAdminDeleteCard = function (slug) {
        const select = document.getElementById('card-admin-delete-select');
        if (!select || !state.cards.some(card => card.slug === slug)) return;
        select.value = slug;
        renderDeletePicker();
        window.updateCardAdminDeleteHint();
    };

    window.filterCardAdminDeleteCards = function (query) {
        const normalized = String(query || '').trim().toLowerCase();
        document.querySelectorAll('#card-admin-delete-picker [data-card-admin-delete]').forEach(item => {
            const card = state.cards.find(entry => entry.slug === item.dataset.cardAdminDelete);
            const haystack = `${card?.name || ''} ${card?.title || ''} ${card?.slug || ''}`.toLowerCase();
            item.hidden = Boolean(normalized && !haystack.includes(normalized));
        });
    };

    function populateCardSelectors() {
        const baseSelect = document.getElementById('card-admin-base-select');
        const deleteSelect = document.getElementById('card-admin-delete-select');

        if (baseSelect) baseSelect.value = state.cards[0]?.slug || '';
        if (deleteSelect) deleteSelect.value = state.cards[0]?.slug || '';

        renderBaseChecklist();
        renderMultiFormChecklist();
        renderDeletePicker();
        window.updateCardAdminPreviews();
        window.updateCardAdminDeleteHint();
    }

    function renderMultiFormChecklist() {
        const checklist = document.getElementById('card-admin-form-checklist');
        if (!checklist) return;
        checklist.innerHTML = state.cards.map(card => `
            <label class="card-admin-form-choice" data-card-admin-form="${escapeHtml(card.slug)}">
                <input type="checkbox" value="${escapeHtml(card.slug)}" onchange="window.handleCardAdminFormChoice(this)">
                <img src="${escapeHtml(card.thumb)}" alt="">
                <span title="${escapeHtml(card.name)}">${escapeHtml(card.name)}</span>
            </label>`).join('');
        refreshMultiFormAvailability();
    }

    function renderBaseChecklist() {
        const checklist = document.getElementById('card-admin-base-checklist');
        if (!checklist) return;
        const selectedSlug = selectedBaseCard()?.slug;
        checklist.innerHTML = state.cards.map(card => `
            <label class="card-admin-form-choice" data-card-admin-base="${escapeHtml(card.slug)}">
                <input type="radio" name="card-admin-base-choice" value="${escapeHtml(card.slug)}" ${card.slug === selectedSlug ? 'checked' : ''} onchange="window.handleCardAdminBaseChoice(this)">
                <img src="${escapeHtml(card.thumb)}" alt="">
                <span title="${escapeHtml(card.name)}">${escapeHtml(card.name)}</span>
            </label>`).join('');
    }

    function refreshMultiFormAvailability() {
        const baseSlug = selectedBaseCard()?.slug;
        document.querySelectorAll('#card-admin-form-checklist input[type="checkbox"]').forEach(input => {
            const isBase = input.value === baseSlug;
            input.disabled = isBase;
            if (isBase) input.checked = false;
            input.closest('.card-admin-form-choice')?.classList.toggle('is-disabled', isBase);
        });
    }

    window.filterCardAdminMultiForms = function (query) {
        const normalized = String(query || '').trim().toLowerCase();
        document.querySelectorAll('#card-admin-form-checklist [data-card-admin-form]').forEach(item => {
            const card = state.cards.find(entry => entry.slug === item.dataset.cardAdminForm);
            const haystack = `${card?.name || ''} ${card?.title || ''} ${card?.slug || ''}`.toLowerCase();
            item.style.display = !normalized || haystack.includes(normalized) ? 'flex' : 'none';
        });
    };

    window.filterCardAdminBaseCards = function (query) {
        const normalized = String(query || '').trim().toLowerCase();
        document.querySelectorAll('#card-admin-base-checklist [data-card-admin-base]').forEach(item => {
            const card = state.cards.find(entry => entry.slug === item.dataset.cardAdminBase);
            const haystack = `${card?.name || ''} ${card?.title || ''} ${card?.slug || ''}`.toLowerCase();
            item.style.display = !normalized || haystack.includes(normalized) ? 'flex' : 'none';
        });
    };

    window.handleCardAdminBaseChoice = function (changedInput) {
        const baseSelect = document.getElementById('card-admin-base-select');
        if (baseSelect && changedInput?.value) baseSelect.value = changedInput.value;
        window.updateCardAdminPreviews();
    };

    window.handleCardAdminFormChoice = function (changedInput) {
        if (state.linkMode === 'single' && changedInput?.checked) {
            document.querySelectorAll('#card-admin-form-checklist input[type="checkbox"]').forEach(input => {
                if (input !== changedInput) input.checked = false;
            });
        }
        window.updateCardAdminPreviews();
    };

    window.setCardAdminLinkMode = function (mode) {
        state.linkMode = mode === 'multiple' ? 'multiple' : 'single';
        const isMultiple = state.linkMode === 'multiple';
        document.getElementById('card-admin-mode-single').classList.toggle('active', !isMultiple);
        document.getElementById('card-admin-mode-multiple').classList.toggle('active', isMultiple);
        if (!isMultiple) {
            const selected = Array.from(document.querySelectorAll('#card-admin-form-checklist input:checked'));
            selected.slice(1).forEach(input => { input.checked = false; });
        }
        window.updateCardAdminPreviews();
    };

    window.openCardAdminModal = function (tool = 'link') {
        const modal = document.getElementById('card-admin-modal');
        const tokenInput = document.getElementById('card-admin-token');
        const tools = document.getElementById('card-admin-tools');
        const linkSection = document.getElementById('card-admin-link-section');
        const deleteSection = document.getElementById('card-admin-delete-section');
        const title = document.getElementById('card-admin-title');
        state.activeTool = tool === 'delete' ? 'delete' : 'link';

        if (linkSection) linkSection.style.display = state.activeTool === 'link' ? '' : 'none';
        if (deleteSection) deleteSection.style.display = state.activeTool === 'delete' ? '' : 'none';
        if (title) title.textContent = state.activeTool === 'delete' ? 'Delete Custom Card' : 'Link Custom Cards';
        if (tokenInput) tokenInput.value = localStorage.getItem('gh_token') || '';
        if (tools) tools.style.display = 'none';
        if (modal) modal.style.display = 'flex';
    };

    window.closeCardAdminModal = function () {
        const modal = document.getElementById('card-admin-modal');
        if (modal && !state.busy) modal.style.display = 'none';
    };

    window.loadCardAdminCards = async function () {
        if (state.busy) return;
        const token = getToken();
        if (token.length < 16) {
            setStatus('Enter a valid GitHub access token first.', 'error');
            return;
        }

        state.busy = true;
        setStatus('Checking password and loading uploaded cards...');
        try {
            await githubRequest('https://api.github.com/user', token);
            const rootItems = await githubRequest(`${API_ROOT}/contents/?ref=${BRANCH}`, token);
            const folders = rootItems.filter(item => item.type === 'dir'
                && !item.name.startsWith('.')
                && !IGNORED_ROOT_FOLDERS.has(item.name));

            const loaded = await Promise.all(folders.map(async folder => {
                try {
                    const indexFile = await getRepoFile(`${folder.name}/index.html`, token, true);
                    return indexFile ? parseCard(folder.name, indexFile.text) : null;
                } catch (e) {
                    return null;
                }
            }));

            state.token = token;
            state.cards = loaded.filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
            localStorage.setItem('gh_token', token);
            populateCardSelectors();
            const tools = document.getElementById('card-admin-tools');
            if (tools) tools.style.display = 'block';
            setStatus(`Unlocked. Loaded ${state.cards.length} custom cards.`, 'success');
        } catch (error) {
            setStatus(`Could not unlock the admin manager: ${error.message}`, 'error');
        } finally {
            state.busy = false;
        }
    };

    function removeLinkedCardNodes(doc, targetSlug) {
        let removed = false;
        Array.from(doc.querySelectorAll('[data-admin-linked-slug]')).forEach(node => {
            if (node.getAttribute('data-admin-linked-slug') !== targetSlug) return;
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

    function addLinkedCardNodes(doc, sourceCard, targetCard) {
        const targetName = escapeHtml(targetCard.name);
        const targetSlug = escapeHtml(targetCard.slug);
        const targetUrl = escapeHtml(targetCard.url);
        const targetThumb = escapeHtml(targetCard.thumb);
        const sourceType = escapeHtml(sourceCard.type || 'none');

        const formsContainer = doc.getElementById('forms-container');
        const formsWrapper = doc.getElementById('forms-card-wrapper');
        if (formsContainer) {
            formsContainer.insertAdjacentHTML('beforeend', `
                <div class="row bg-${sourceType} dokkan-card admin-linked-form" data-hub-letter="${escapeHtml(targetCard.hubId || 'a')}" data-thumb-src="${targetThumb}" data-admin-linked-slug="${targetSlug}">
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
        if (transContainer) {
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

    function updateLinkedHtml(htmlText, sourceCard, targetCard, shouldLink) {
        const doc = new DOMParser().parseFromString(htmlText, 'text/html');
        removeLinkedCardNodes(doc, targetCard.slug);
        if (shouldLink) addLinkedCardNodes(doc, sourceCard, targetCard);
        return '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
    }

    function htmlHasAdminLink(htmlText, targetSlug) {
        const doc = new DOMParser().parseFromString(htmlText, 'text/html');
        return Array.from(doc.querySelectorAll('[data-admin-linked-slug]'))
            .some(node => node.getAttribute('data-admin-linked-slug') === targetSlug);
    }

    function updateLinkedJson(jsonText, updatedHtml, targetCard, shouldLink) {
        if (!jsonText) return null;
        let data;
        try {
            data = JSON.parse(jsonText);
        } catch (e) {
            return jsonText;
        }

        const forms = Array.isArray(data.formsData) ? data.formsData : [];
        data.formsData = forms.filter(form => form?.adminLinkedSlug !== targetCard.slug);
        if (shouldLink) {
            data.formsData.push({
                imageSrc: targetCard.thumb,
                imageExportName: '',
                name: targetCard.name,
                link: targetCard.url,
                hubLetter: targetCard.hubId || 'a',
                adminLinkedSlug: targetCard.slug
            });
        }

        const updatedDoc = new DOMParser().parseFromString(updatedHtml, 'text/html');
        data.containers = data.containers || {};
        data.containers.forms = updatedDoc.getElementById('forms-container')?.innerHTML || '';
        return JSON.stringify(data, null, 2);
    }

    async function commitRepositoryChanges(token, changes, deletePrefix, message) {
        const ref = await githubRequest(`${API_ROOT}/git/ref/heads/${BRANCH}`, token);
        const parentSha = ref.object.sha;
        const parentCommit = await githubRequest(`${API_ROOT}/git/commits/${parentSha}`, token);
        const baseTreeSha = parentCommit.tree.sha;
        const treeItems = [];

        for (const change of changes) {
            const blob = await githubRequest(`${API_ROOT}/git/blobs`, token, {
                method: 'POST',
                body: JSON.stringify({ content: change.text, encoding: 'utf-8' })
            });
            treeItems.push({ path: change.path, mode: '100644', type: 'blob', sha: blob.sha });
        }

        if (deletePrefix) {
            const fullTree = await githubRequest(`${API_ROOT}/git/trees/${baseTreeSha}?recursive=1`, token);
            fullTree.tree
                .filter(item => item.type === 'blob' && item.path.startsWith(`${deletePrefix}/`))
                .forEach(item => treeItems.push({ path: item.path, mode: item.mode || '100644', type: 'blob', sha: null }));
        }

        if (!treeItems.length) throw new Error('No repository changes were found.');

        const tree = await githubRequest(`${API_ROOT}/git/trees`, token, {
            method: 'POST',
            body: JSON.stringify({ base_tree: baseTreeSha, tree: treeItems })
        });
        const commit = await githubRequest(`${API_ROOT}/git/commits`, token, {
            method: 'POST',
            body: JSON.stringify({ message, tree: tree.sha, parents: [parentSha] })
        });
        await githubRequest(`${API_ROOT}/git/refs/heads/${BRANCH}`, token, {
            method: 'PATCH',
            body: JSON.stringify({ sha: commit.sha, force: false })
        });
        return commit.sha;
    }

    async function buildMultiLinkChanges(baseCard, formCards, shouldLink) {
        const affectedCards = [baseCard, ...formCards];
        const files = new Map();

        await Promise.all(affectedCards.map(async card => {
            const [htmlFile, jsonFile] = await Promise.all([
                getRepoFile(`${card.slug}/index.html`, state.token),
                getRepoFile(`${card.slug}/card.json`, state.token, true)
            ]);
            files.set(card.slug, {
                card,
                htmlPath: htmlFile.path,
                htmlText: htmlFile.text,
                jsonPath: jsonFile?.path || '',
                jsonText: jsonFile?.text || null
            });
        }));

        formCards.forEach(formCard => {
            const baseFile = files.get(baseCard.slug);
            const formFile = files.get(formCard.slug);

            baseFile.htmlText = updateLinkedHtml(baseFile.htmlText, baseCard, formCard, shouldLink);
            formFile.htmlText = updateLinkedHtml(formFile.htmlText, formCard, baseCard, shouldLink);

            if (baseFile.jsonText !== null) {
                baseFile.jsonText = updateLinkedJson(baseFile.jsonText, baseFile.htmlText, formCard, shouldLink);
            }
            if (formFile.jsonText !== null) {
                formFile.jsonText = updateLinkedJson(formFile.jsonText, formFile.htmlText, baseCard, shouldLink);
            }
        });

        const changes = [];
        files.forEach(file => {
            changes.push({ path: file.htmlPath, text: file.htmlText });
            if (file.jsonText !== null) changes.push({ path: file.jsonPath, text: file.jsonText });
        });
        return { changes, files };
    }

    async function runMultiLinkOperation(shouldLink) {
        if (state.busy) return;
        if (!state.token || !state.cards.length) {
            setStatus('Unlock and load the custom cards first.', 'error');
            return;
        }
        const baseCard = selectedBaseCard();
        const formCards = selectedFormCards().filter(card => card.slug !== baseCard?.slug);
        if (!baseCard || !formCards.length) {
            setStatus('Choose one main card and at least one different linked form.', 'error');
            return;
        }

        state.busy = true;
        setStatus(`${shouldLink ? 'Linking' : 'Unlinking'} ${baseCard.name} with ${formCards.length} selected form${formCards.length === 1 ? '' : 's'}...`);
        try {
            const { changes, files } = await buildMultiLinkChanges(baseCard, formCards, shouldLink);
            await commitRepositoryChanges(
                state.token,
                changes,
                '',
                `${shouldLink ? 'Link' : 'Unlink'} custom forms: ${baseCard.slug} and ${formCards.map(card => card.slug).join(', ')}`
            );
            files.forEach(file => { file.card.htmlText = file.htmlText; });
            localStorage.removeItem('hub_cached_custom_only');
            setStatus(`${baseCard.name} and ${formCards.length} selected form${formCards.length === 1 ? '' : 's'} were ${shouldLink ? 'linked' : 'unlinked'} both ways.`, 'success');
        } catch (error) {
            setStatus(`The selected cards could not be ${shouldLink ? 'linked' : 'unlinked'}: ${error.message}`, 'error');
        } finally {
            state.busy = false;
        }
    }

    window.linkSelectedCustomCards = function () {
        return runMultiLinkOperation(true);
    };

    window.unlinkSelectedCustomCards = function () {
        return runMultiLinkOperation(false);
    };

    window.deleteSelectedCustomCard = async function () {
        if (state.busy) return;
        if (!state.token || !state.cards.length) {
            setStatus('Unlock and load the custom cards first.', 'error');
            return;
        }

        const card = selectedCard('card-admin-delete-select');
        const password = document.getElementById('card-admin-delete-password')?.value || '';
        const confirmation = document.getElementById('card-admin-delete-confirm')?.value.trim() || '';
        if (password !== DELETE_PASSWORD) {
            setStatus('The separate delete password is incorrect.', 'error');
            return;
        }
        if (!card || confirmation !== card.slug) {
            setStatus(`Type the exact folder name “${card?.slug || ''}” to confirm deletion.`, 'error');
            return;
        }

        state.busy = true;
        setStatus(`Deleting ${card.name} and cleaning its form links...`);
        try {
            const cleanupChanges = [];
            for (const other of state.cards) {
                if (other.slug === card.slug || !htmlHasAdminLink(other.htmlText, card.slug)) continue;
                const updatedHtml = updateLinkedHtml(other.htmlText, other, card, false);

                cleanupChanges.push({ path: `${other.slug}/index.html`, text: updatedHtml });
                const otherJson = await getRepoFile(`${other.slug}/card.json`, state.token, true);
                if (otherJson) {
                    cleanupChanges.push({
                        path: otherJson.path,
                        text: updateLinkedJson(otherJson.text, updatedHtml, card, false)
                    });
                }
            }

            await commitRepositoryChanges(
                state.token,
                cleanupChanges,
                card.slug,
                `Delete custom card: ${card.slug}`
            );

            localStorage.removeItem('hub_cached_custom_only');
            state.cards = state.cards.filter(item => item.slug !== card.slug);
            populateCardSelectors();
            setStatus(`${card.name} was deleted from GitHub. This cannot be undone from the editor.`, 'success');
        } catch (error) {
            setStatus(`The card could not be deleted: ${error.message}`, 'error');
        } finally {
            state.busy = false;
        }
    };
})();
